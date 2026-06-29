// Copyright 2019-2024 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

use crate::{path::SafePathBuf, scope, webview::UriSchemeProtocolHandler};
use http::{header::*, status::StatusCode, Request, Response};
use http_range::HttpRange;
use std::fs::File;
use std::io::{Read, Seek, Write};
use std::{borrow::Cow, io::SeekFrom};
use tauri_utils::mime_type::MimeType;

const FILE_PATH_KIND_DRIVE: &str = "__TAURI_DRIVE__";
const FILE_PATH_KIND_UNC: &str = "__TAURI_UNC__";
const FILE_PATH_KIND_ABSOLUTE: &str = "__TAURI_ABSOLUTE__";
const FILE_PATH_KIND_RELATIVE: &str = "__TAURI_RELATIVE__";

pub fn get(scope: scope::fs::Scope, window_origin: String) -> UriSchemeProtocolHandler {
  Box::new(
    move |_, request, responder| match get_response(request, &scope, &window_origin) {
      Ok(response) => responder.respond(response),
      Err(e) => responder.respond(
        http::Response::builder()
          .status(http::StatusCode::INTERNAL_SERVER_ERROR)
          .header(CONTENT_TYPE, mime::TEXT_PLAIN.essence_str())
          .header("Access-Control-Allow-Origin", &window_origin)
          .body(e.to_string().into_bytes())
          .unwrap(),
      ),
    },
  )
}

fn get_response(
  request: Request<Vec<u8>>,
  scope: &scope::fs::Scope,
  window_origin: &str,
) -> Result<Response<Cow<'static, [u8]>>, Box<dyn std::error::Error>> {
  let path = decode_asset_protocol_path(request.uri().path());

  let mut resp = Response::builder().header("Access-Control-Allow-Origin", window_origin);

  if let Err(e) = SafePathBuf::new(path.clone().into()) {
    log::error!("asset protocol path \"{}\" is not valid: {}", path, e);
    return resp.status(403).body(Vec::new().into()).map_err(Into::into);
  }

  if !scope.is_allowed(&path) {
    log::error!("asset protocol not configured to allow the path: {}", path);
    return resp.status(403).body(Vec::new().into()).map_err(Into::into);
  }

  // Separate block for easier error handling
  let mut file = match File::open(path.clone()) {
    Ok(file) => file,
    Err(e) => {
      #[cfg(target_os = "android")]
      {
        if path.starts_with("/storage/emulated/0/Android/data/") {
          log::error!("Failed to open Android external storage file '{}': {}. This may be due to missing storage permissions.", path, e);
        }
      }
      return if e.kind() == std::io::ErrorKind::NotFound {
        log::error!("File does not exist at path: {}", path);
        return resp.status(404).body(Vec::new().into()).map_err(Into::into);
      } else if e.kind() == std::io::ErrorKind::PermissionDenied {
        log::error!("Missing OS permission to access path \"{}\": {}", path, e);
        return resp.status(403).body(Vec::new().into()).map_err(Into::into);
      } else {
        Err(e.into())
      };
    }
  };

  let len = file.metadata()?.len();
  let (mime_type, read_bytes) = {
    // get file mime type
    let nbytes = len.min(8192);
    let mut magic_buf = Vec::with_capacity(nbytes as usize);
    (&mut file).take(nbytes).read_to_end(&mut magic_buf)?;
    file.rewind()?;
    (
      MimeType::parse(&magic_buf, &path),
      // return the `magic_bytes` if we read the whole file
      // to avoid reading it again later if this is not a range request
      if len < 8192 { Some(magic_buf) } else { None },
    )
  };

  resp = resp.header(CONTENT_TYPE, &mime_type);

  // handle 206 (partial range) http requests
  let response = if let Some(range_header) = request
    .headers()
    .get("range")
    .and_then(|r| r.to_str().map(|r| r.to_string()).ok())
  {
    resp = resp.header(ACCEPT_RANGES, "bytes");
    resp = resp.header(ACCESS_CONTROL_EXPOSE_HEADERS, "content-range");

    let not_satisfiable = || {
      Response::builder()
        .status(StatusCode::RANGE_NOT_SATISFIABLE)
        .header(CONTENT_RANGE, format!("bytes */{len}"))
        .body(vec![].into())
        .map_err(Into::into)
    };

    // parse range header
    let ranges = if let Ok(ranges) = HttpRange::parse(&range_header, len) {
      ranges
        .iter()
        // map the output to spec range <start-end>, example: 0-499
        .map(|r| (r.start, r.start + r.length - 1))
        .collect::<Vec<_>>()
    } else {
      return not_satisfiable();
    };

    /// The Maximum bytes we send in one range
    const MAX_LEN: u64 = 1000 * 1024;

    // single-part range header
    if ranges.len() == 1 {
      let &(start, mut end) = ranges.first().unwrap();

      // check if a range is not satisfiable
      //
      // this should be already taken care of by the range parsing library
      // but checking here again for extra assurance
      if start >= len || end >= len || end < start {
        return not_satisfiable();
      }

      // adjust end byte for MAX_LEN
      end = start + (end - start).min(len - start).min(MAX_LEN - 1);

      // calculate number of bytes needed to be read
      let nbytes = end + 1 - start;

      let buf = {
        let mut buf = Vec::with_capacity(nbytes as usize);
        file.seek(SeekFrom::Start(start))?;
        file.take(nbytes).read_to_end(&mut buf)?;
        buf
      };

      resp = resp.header(CONTENT_RANGE, format!("bytes {start}-{end}/{len}"));
      resp = resp.header(CONTENT_LENGTH, end + 1 - start);
      resp = resp.status(StatusCode::PARTIAL_CONTENT);
      resp.body(buf.into())
    } else {
      let ranges = ranges
        .iter()
        .filter_map(|&(start, mut end)| {
          // filter out unsatisfiable ranges
          //
          // this should be already taken care of by the range parsing library
          // but checking here again for extra assurance
          if start >= len || end >= len || end < start {
            None
          } else {
            // adjust end byte for MAX_LEN
            end = start + (end - start).min(len - start).min(MAX_LEN - 1);
            Some((start, end))
          }
        })
        .collect::<Vec<_>>();

      let boundary = random_boundary();
      let boundary_sep = format!("\r\n--{boundary}\r\n");
      let boundary_closer = format!("\r\n--{boundary}\r\n");

      resp = resp.header(
        CONTENT_TYPE,
        format!("multipart/byteranges; boundary={boundary}"),
      );

      let buf = {
        // multi-part range header
        let mut buf = Vec::new();

        for (start, end) in ranges {
          // a new range is being written, write the range boundary
          buf.write_all(boundary_sep.as_bytes())?;

          // write the needed headers `Content-Type` and `Content-Range`
          buf.write_all(format!("{CONTENT_TYPE}: {mime_type}\r\n").as_bytes())?;
          buf.write_all(format!("{CONTENT_RANGE}: bytes {start}-{end}/{len}\r\n").as_bytes())?;

          // write the separator to indicate the start of the range body
          buf.write_all("\r\n".as_bytes())?;

          // calculate number of bytes needed to be read
          let nbytes = end + 1 - start;

          let mut local_buf = Vec::with_capacity(nbytes as usize);
          file.seek(SeekFrom::Start(start))?;
          (&mut file).take(nbytes).read_to_end(&mut local_buf)?;
          buf.extend_from_slice(&local_buf);
        }
        // all ranges have been written, write the closing boundary
        buf.write_all(boundary_closer.as_bytes())?;

        buf
      };
      resp.body(buf.into())
    }
  } else if request.method() == http::Method::HEAD {
    // if the HEAD method is used, we should not return a body
    resp = resp.header(CONTENT_LENGTH, len);
    resp.body(Vec::new().into())
  } else {
    // avoid reading the file if we already read it
    // as part of mime type detection
    let buf = if let Some(b) = read_bytes {
      b
    } else {
      let mut local_buf = Vec::with_capacity(len as usize);
      file.read_to_end(&mut local_buf)?;
      local_buf
    };
    resp = resp.header(CONTENT_LENGTH, len);
    resp.body(buf.into())
  };

  response.map_err(Into::into)
}

fn decode_asset_protocol_path(path: &str) -> String {
  let trimmed_path = path.trim_start_matches('/');
  let decoded_legacy_path = percent_encoding::percent_decode_str(trimmed_path)
    .decode_utf8_lossy()
    .to_string();
  let segments = trimmed_path
    .split('/')
    .filter(|segment| !segment.is_empty())
    .map(|segment| {
      percent_encoding::percent_decode_str(segment)
        .decode_utf8_lossy()
        .to_string()
    })
    .collect::<Vec<_>>();

  if segments.is_empty() {
    return decoded_legacy_path;
  }

  match segments[0].as_str() {
    FILE_PATH_KIND_DRIVE if segments.len() >= 2 => {
      let drive = segments[1].trim_end_matches(':');
      if segments.len() == 2 {
        format!("{drive}:/")
      } else {
        format!("{drive}:/{}", segments[2..].join("/"))
      }
    }
    FILE_PATH_KIND_UNC if segments.len() >= 2 => format!("//{}", segments[1..].join("/")),
    FILE_PATH_KIND_ABSOLUTE => {
      if segments.len() == 1 {
        "/".into()
      } else {
        format!("/{}", segments[1..].join("/"))
      }
    }
    FILE_PATH_KIND_RELATIVE => {
      if segments.len() == 1 {
        ".".into()
      } else {
        segments[1..].join("/")
      }
    }
    _ => decoded_legacy_path,
  }
}

fn random_boundary() -> String {
  let mut x = [0_u8; 30];
  getrandom::fill(&mut x).expect("failed to get random bytes");
  (x[..])
    .iter()
    .map(|&x| format!("{x:x}"))
    .fold(String::new(), |mut a, x| {
      a.push_str(x.as_str());
      a
    })
}

#[cfg(test)]
mod tests {
  use super::decode_asset_protocol_path;

  #[test]
  fn decodes_legacy_flattened_windows_path() {
    let path = decode_asset_protocol_path("/C%3A%5CUsers%5CAdmin%5Cfile.txt");
    assert_eq!(path, "C:\\Users\\Admin\\file.txt");
  }

  #[test]
  fn decodes_drive_preserving_path_segments() {
    let path = decode_asset_protocol_path("/__TAURI_DRIVE__/D/project/assets/index.html");
    assert_eq!(path, "D:/project/assets/index.html");
  }

  #[test]
  fn decodes_unc_preserving_path_segments() {
    let path = decode_asset_protocol_path("/__TAURI_UNC__/server/share/assets/poster.png");
    assert_eq!(path, "//server/share/assets/poster.png");
  }

  #[test]
  fn decodes_absolute_preserving_path_segments() {
    let path = decode_asset_protocol_path("/__TAURI_ABSOLUTE__/var/data/thumb.webp");
    assert_eq!(path, "/var/data/thumb.webp");
  }
}
