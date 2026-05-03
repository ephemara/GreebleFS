use std::fs::File;
use std::io::Read;
use std::path::Path;
use std::sync::Arc;

use serde::Deserialize;

use crate::native_task_graph::NativeTaskCancellationToken;

const DEFAULT_CHUNK_BYTES: usize = 64 * 1024;
const DEFAULT_TEXT_MAX_BYTES: u64 = 10 * 1024 * 1024;
const DEFAULT_DATA_URI_MAX_BYTES: u64 = 12 * 1024 * 1024;
const DEFAULT_BINARY_MAX_BYTES: u64 = 256 * 1024 * 1024;
const DEFAULT_ARCHIVE_ENTRY_MAX_BYTES: u64 = 256 * 1024 * 1024;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PreviewStreamingPolicy {
    pub enabled: bool,
    pub chunk_bytes: usize,
    pub text_max_bytes: u64,
    pub data_uri_max_bytes: u64,
    pub binary_max_bytes: u64,
    pub archive_entry_max_bytes: u64,
}

impl PreviewStreamingPolicy {
    #[cfg(not(test))]
    pub fn from_app(app: &tauri::AppHandle) -> Self {
        crate::usr::read_usr_text_file(
            app,
            "profiles/default/explorer-performance/greeblefs-core/explorer-performance.json",
        )
        .ok()
        .as_deref()
        .map(Self::from_explorer_performance_json)
        .unwrap_or_default()
    }

    pub fn from_explorer_performance_json(source: &str) -> Self {
        let Ok(document) = serde_json::from_str::<AuthoredExplorerPerformanceManifest>(source)
        else {
            return Self::default();
        };
        Self::from_authored(document.preview_streaming)
    }

    fn from_authored(authored: Option<AuthoredPreviewStreamingPolicy>) -> Self {
        let defaults = Self::default();
        let Some(authored) = authored else {
            return defaults;
        };

        Self {
            enabled: authored.enabled.unwrap_or(defaults.enabled),
            chunk_bytes: clamp_usize(
                authored.chunk_bytes,
                defaults.chunk_bytes,
                4 * 1024,
                1024 * 1024,
            ),
            text_max_bytes: clamp_u64(
                authored.text_max_bytes,
                defaults.text_max_bytes,
                1024,
                64 * 1024 * 1024,
            ),
            data_uri_max_bytes: clamp_u64(
                authored.data_uri_max_bytes,
                defaults.data_uri_max_bytes,
                1024,
                64 * 1024 * 1024,
            ),
            binary_max_bytes: clamp_u64(
                authored.binary_max_bytes,
                defaults.binary_max_bytes,
                1024,
                512 * 1024 * 1024,
            ),
            archive_entry_max_bytes: clamp_u64(
                authored.archive_entry_max_bytes,
                defaults.archive_entry_max_bytes,
                1024,
                512 * 1024 * 1024,
            ),
        }
    }
}

impl Default for PreviewStreamingPolicy {
    fn default() -> Self {
        Self {
            enabled: true,
            chunk_bytes: DEFAULT_CHUNK_BYTES,
            text_max_bytes: DEFAULT_TEXT_MAX_BYTES,
            data_uri_max_bytes: DEFAULT_DATA_URI_MAX_BYTES,
            binary_max_bytes: DEFAULT_BINARY_MAX_BYTES,
            archive_entry_max_bytes: DEFAULT_ARCHIVE_ENTRY_MAX_BYTES,
        }
    }
}

#[derive(Clone)]
pub struct PreviewStreamingManager {
    policy: Arc<PreviewStreamingPolicy>,
}

impl PreviewStreamingManager {
    pub fn new(policy: PreviewStreamingPolicy) -> Self {
        Self {
            policy: Arc::new(policy),
        }
    }

    #[cfg(not(test))]
    pub fn from_app(app: &tauri::AppHandle) -> Self {
        Self::new(PreviewStreamingPolicy::from_app(app))
    }

    pub fn policy(&self) -> &PreviewStreamingPolicy {
        &self.policy
    }
}

impl Default for PreviewStreamingManager {
    fn default() -> Self {
        Self::new(PreviewStreamingPolicy::default())
    }
}

pub fn read_local_preview_bytes(
    path: &Path,
    requested_max_bytes: Option<u64>,
    policy: &PreviewStreamingPolicy,
    token: &NativeTaskCancellationToken,
) -> Result<Vec<u8>, String> {
    let allowed_bytes = resolve_preview_byte_limit(requested_max_bytes, policy.binary_max_bytes);
    read_local_file_bytes_with_limit(
        path,
        allowed_bytes,
        policy.chunk_bytes,
        token,
        "native preview transport",
    )
}

pub fn read_local_text_file(
    path: &Path,
    policy: &PreviewStreamingPolicy,
    token: &NativeTaskCancellationToken,
) -> Result<String, String> {
    let bytes = read_local_file_bytes_with_limit(
        path,
        policy.text_max_bytes,
        policy.chunk_bytes,
        token,
        "text preview",
    )?;
    String::from_utf8(bytes).map_err(|error| format!("File is not valid UTF-8: {error}"))
}

pub fn read_local_file_data_url(
    path: &Path,
    policy: &PreviewStreamingPolicy,
    token: &NativeTaskCancellationToken,
) -> Result<String, String> {
    let bytes = read_local_file_bytes_with_limit(
        path,
        policy.data_uri_max_bytes,
        policy.chunk_bytes,
        token,
        "data-URI preview",
    )?;
    Ok(format!(
        "data:{};base64,{}",
        preview_mime_type(path),
        base64_encode(&bytes)
    ))
}

pub fn read_reader_to_bounded_vec<R: Read + ?Sized>(
    reader: &mut R,
    known_size: Option<u64>,
    max_bytes: u64,
    chunk_bytes: usize,
    token: &NativeTaskCancellationToken,
    subject: &str,
) -> Result<Vec<u8>, String> {
    let chunk_bytes = chunk_bytes.max(1);
    if let Some(known_size) = known_size {
        ensure_size_within_limit(known_size, max_bytes, subject)?;
    }

    let capacity = known_size
        .map(|size| size.min(max_bytes) as usize)
        .unwrap_or_else(|| chunk_bytes.min(max_bytes as usize));
    let mut output = Vec::with_capacity(capacity);
    let mut buffer = vec![0u8; chunk_bytes];

    loop {
        token.throw_if_cancelled()?;
        let read = reader
            .read(&mut buffer)
            .map_err(|error| format!("Failed to read {subject}: {error}"))?;
        if read == 0 {
            break;
        }
        if output.len() as u64 + read as u64 > max_bytes {
            return Err(limit_error(subject, max_bytes));
        }
        output.extend_from_slice(&buffer[..read]);
        token.throw_if_cancelled()?;
    }

    Ok(output)
}

pub fn resolve_preview_byte_limit(requested_bytes: Option<u64>, hard_limit_bytes: u64) -> u64 {
    requested_bytes
        .unwrap_or(hard_limit_bytes)
        .max(1)
        .min(hard_limit_bytes)
}

pub fn format_preview_byte_limit(limit_bytes: u64) -> String {
    let limit_mebibytes = limit_bytes.div_ceil(1024 * 1024);
    format!("{limit_mebibytes} MB")
}

fn read_local_file_bytes_with_limit(
    path: &Path,
    max_bytes: u64,
    chunk_bytes: usize,
    token: &NativeTaskCancellationToken,
    subject: &str,
) -> Result<Vec<u8>, String> {
    let metadata = std::fs::metadata(path).map_err(|error| error.to_string())?;
    if !metadata.is_file() {
        return Err(format!("Path is not a file: {}", path.display()));
    }
    ensure_size_within_limit(metadata.len(), max_bytes, subject)?;

    let mut file = File::open(path).map_err(|error| error.to_string())?;
    read_reader_to_bounded_vec(
        &mut file,
        Some(metadata.len()),
        max_bytes,
        chunk_bytes,
        token,
        subject,
    )
}

fn ensure_size_within_limit(size: u64, max_bytes: u64, subject: &str) -> Result<(), String> {
    if size > max_bytes {
        return Err(limit_error(subject, max_bytes));
    }
    Ok(())
}

fn limit_error(subject: &str, max_bytes: u64) -> String {
    format!(
        "File is too large for {subject} (> {})",
        format_preview_byte_limit(max_bytes)
    )
}

fn preview_mime_type(path: &Path) -> &'static str {
    match path
        .extension()
        .map(|extension| extension.to_string_lossy().to_lowercase())
        .unwrap_or_default()
        .as_str()
    {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        "ico" => "image/x-icon",
        "svg" => "image/svg+xml",
        "tiff" | "tif" => "image/tiff",
        "avif" => "image/avif",
        "glb" => "model/gltf-binary",
        "gltf" => "model/gltf+json",
        "obj" => "text/plain",
        "stl" => "model/stl",
        "fbx" => "application/octet-stream",
        _ => "application/octet-stream",
    }
}

fn base64_encode(input: &[u8]) -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut output = String::with_capacity(input.len().div_ceil(3) * 4);

    for chunk in input.chunks(3) {
        let first = chunk[0];
        let second = *chunk.get(1).unwrap_or(&0);
        let third = *chunk.get(2).unwrap_or(&0);

        output.push(CHARS[(first >> 2) as usize] as char);
        output.push(CHARS[(((first & 0b0000_0011) << 4) | (second >> 4)) as usize] as char);

        if chunk.len() > 1 {
            output.push(CHARS[(((second & 0b0000_1111) << 2) | (third >> 6)) as usize] as char);
        } else {
            output.push('=');
        }

        if chunk.len() > 2 {
            output.push(CHARS[(third & 0b0011_1111) as usize] as char);
        } else {
            output.push('=');
        }
    }

    output
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuthoredExplorerPerformanceManifest {
    preview_streaming: Option<AuthoredPreviewStreamingPolicy>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuthoredPreviewStreamingPolicy {
    enabled: Option<bool>,
    chunk_bytes: Option<usize>,
    text_max_bytes: Option<u64>,
    data_uri_max_bytes: Option<u64>,
    binary_max_bytes: Option<u64>,
    archive_entry_max_bytes: Option<u64>,
}

fn clamp_usize(value: Option<usize>, fallback: usize, minimum: usize, maximum: usize) -> usize {
    value.unwrap_or(fallback).clamp(minimum, maximum)
}

fn clamp_u64(value: Option<u64>, fallback: u64, minimum: u64, maximum: u64) -> u64 {
    value.unwrap_or(fallback).clamp(minimum, maximum)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn policy_defaults_and_clamps_authored_values() {
        let defaults = PreviewStreamingPolicy::from_explorer_performance_json("{}");
        assert_eq!(defaults, PreviewStreamingPolicy::default());

        let malformed = PreviewStreamingPolicy::from_explorer_performance_json("{ nope");
        assert_eq!(malformed, PreviewStreamingPolicy::default());

        let clamped = PreviewStreamingPolicy::from_explorer_performance_json(
            r#"{
                "previewStreaming": {
                    "enabled": false,
                    "chunkBytes": 1,
                    "textMaxBytes": 1,
                    "dataUriMaxBytes": 999999999,
                    "binaryMaxBytes": 999999999,
                    "archiveEntryMaxBytes": 999999999
                }
            }"#,
        );

        assert!(!clamped.enabled);
        assert_eq!(clamped.chunk_bytes, 4 * 1024);
        assert_eq!(clamped.text_max_bytes, 1024);
        assert_eq!(clamped.data_uri_max_bytes, 64 * 1024 * 1024);
        assert_eq!(clamped.binary_max_bytes, 512 * 1024 * 1024);
        assert_eq!(clamped.archive_entry_max_bytes, 512 * 1024 * 1024);
    }

    #[test]
    fn local_preview_reads_in_chunks_and_enforces_limits() {
        let workspace = tempdir().expect("tempdir");
        let file_path = workspace.path().join("preview.bin");
        std::fs::write(&file_path, [1u8, 2, 3, 4, 5]).expect("write preview");
        let policy = PreviewStreamingPolicy {
            chunk_bytes: 2,
            ..PreviewStreamingPolicy::default()
        };
        let token = NativeTaskCancellationToken::new();

        let bytes = read_local_preview_bytes(&file_path, Some(8), &policy, &token)
            .expect("read preview bytes");
        assert_eq!(bytes, vec![1, 2, 3, 4, 5]);

        let error = read_local_preview_bytes(&file_path, Some(4), &policy, &token)
            .expect_err("limit should reject oversized preview");
        assert!(error.contains("native preview transport"));
    }

    #[test]
    fn local_text_preview_requires_utf8() {
        let workspace = tempdir().expect("tempdir");
        let text_path = workspace.path().join("notes.txt");
        std::fs::write(&text_path, "hello").expect("write text");
        let bad_path = workspace.path().join("bad.txt");
        std::fs::write(&bad_path, [0xff, 0xfe]).expect("write invalid utf8");
        let policy = PreviewStreamingPolicy::default();
        let token = NativeTaskCancellationToken::new();

        assert_eq!(
            read_local_text_file(&text_path, &policy, &token).expect("read text"),
            "hello"
        );
        let error =
            read_local_text_file(&bad_path, &policy, &token).expect_err("invalid utf8 should fail");
        assert!(error.contains("UTF-8"));
    }

    #[test]
    fn local_data_uri_uses_mime_and_base64() {
        let workspace = tempdir().expect("tempdir");
        let file_path = workspace.path().join("preview.png");
        std::fs::write(&file_path, b"png-data").expect("write png");
        let policy = PreviewStreamingPolicy::default();
        let token = NativeTaskCancellationToken::new();

        let data_url =
            read_local_file_data_url(&file_path, &policy, &token).expect("read data uri");
        assert_eq!(data_url, "data:image/png;base64,cG5nLWRhdGE=");
    }

    #[test]
    fn reader_checks_cancellation_before_reading() {
        let mut source = std::io::Cursor::new(vec![1u8, 2, 3]);
        let token = NativeTaskCancellationToken::new();
        token.cancel();

        let error =
            read_reader_to_bounded_vec(&mut source, Some(3), 8, 2, &token, "cancelled preview")
                .expect_err("cancelled token should fail");
        assert_eq!(error, crate::native_task_graph::NATIVE_TASK_CANCELLED_ERROR);
    }
}
