use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::UNIX_EPOCH;
use tauri::AppHandle;
use tauri::Manager;

const DEFAULT_FFMPEG_BINARY: &str = "ffmpeg";
const VIDEO_PREVIEW_PROXY_EXTENSION: &str = "mp4";
const VIDEO_PREVIEW_PROXY_AUDIO_BITRATE: &str = "160k";
const VIDEO_PREVIEW_PROXY_CRF: &str = "23";
const VIDEO_PREVIEW_PROXY_PRESET: &str = "veryfast";
const VIDEO_PREVIEW_PROXY_MIME_TYPE: &str = "video/mp4";
const VIDEO_TRIM_SCALE_FILTER: &str = "scale=trunc(iw/2)*2:trunc(ih/2)*2";

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum VideoPreviewSourceKind {
    Direct,
    Proxy,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedVideoPreviewSource {
    pub source_path: String,
    pub source_kind: VideoPreviewSourceKind,
    pub mime_type: Option<String>,
    pub generated_from_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct VideoTrimExportRequest {
    pub input_path: String,
    pub output_path: String,
    pub start_time_seconds: f64,
    pub end_time_seconds: f64,
    pub overwrite_existing: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct VideoTrimExportResult {
    pub output_path: String,
    pub start_time_seconds: f64,
    pub end_time_seconds: f64,
    pub duration_seconds: f64,
    pub ffmpeg_binary: String,
}

#[tauri::command]
#[specta::specta]
pub async fn video_export_trim(
    request: VideoTrimExportRequest,
) -> Result<VideoTrimExportResult, String> {
    tauri::async_runtime::spawn_blocking(move || run_video_trim_export(request))
        .await
        .map_err(|error| format!("Video trim export task failed to join: {error}"))?
}

#[tauri::command]
#[specta::specta]
pub async fn video_create_preview_proxy(
    app: AppHandle,
    input_path: String,
) -> Result<ResolvedVideoPreviewSource, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let input = normalize_video_input_path(&input_path)?;
        let proxy_path = video_preview_proxy_path(&app, &input)?;

        if !can_reuse_video_preview_proxy(&input, &proxy_path) {
            generate_video_preview_proxy(&input, &proxy_path)?;
        }

        Ok(ResolvedVideoPreviewSource {
            source_path: path_to_string(&proxy_path),
            source_kind: VideoPreviewSourceKind::Proxy,
            mime_type: Some(VIDEO_PREVIEW_PROXY_MIME_TYPE.to_string()),
            generated_from_path: Some(path_to_string(&input)),
        })
    })
    .await
    .map_err(|error| format!("Video preview proxy task failed to join: {error}"))?
}

#[tauri::command]
#[specta::specta]
pub async fn video_resolve_preview_source(
    input_path: String,
) -> Result<ResolvedVideoPreviewSource, String> {
    let input = normalize_video_input_path(&input_path)?;
    Ok(ResolvedVideoPreviewSource {
        source_path: path_to_string(&input),
        source_kind: VideoPreviewSourceKind::Direct,
        mime_type: direct_video_preview_mime_type(&input),
        generated_from_path: None,
    })
}

fn run_video_trim_export(request: VideoTrimExportRequest) -> Result<VideoTrimExportResult, String> {
    let normalized_request = normalize_trim_export_request(request)?;
    let ffmpeg_binary = resolve_ffmpeg_binary();

    let mut command = Command::new(&ffmpeg_binary);
    command.args(["-hide_banner", "-loglevel", "error"]);
    command.arg(if normalized_request.overwrite_existing {
        "-y"
    } else {
        "-n"
    });
    command.args(["-i", &normalized_request.input_path]);
    command.args(["-ss", &format_ffmpeg_seconds(normalized_request.start_time_seconds)]);
    command.args(["-to", &format_ffmpeg_seconds(normalized_request.end_time_seconds)]);
    command.args([
        "-vf",
        VIDEO_TRIM_SCALE_FILTER,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "18",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-movflags",
        "+faststart",
        &normalized_request.output_path,
    ]);

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    let output = command
        .output()
        .map_err(|error| format!("Failed to launch ffmpeg at '{ffmpeg_binary}': {error}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let message = if !stderr.is_empty() {
            stderr
        } else if !stdout.is_empty() {
            stdout
        } else {
            format!("ffmpeg exited with status {}", output.status)
        };
        return Err(format!("Video trim export failed: {message}"));
    }

    Ok(VideoTrimExportResult {
        output_path: normalized_request.output_path,
        start_time_seconds: normalized_request.start_time_seconds,
        end_time_seconds: normalized_request.end_time_seconds,
        duration_seconds: normalized_request.end_time_seconds - normalized_request.start_time_seconds,
        ffmpeg_binary,
    })
}

fn normalize_trim_export_request(
    request: VideoTrimExportRequest,
) -> Result<VideoTrimExportRequest, String> {
    let input_path = request.input_path.trim();
    let output_path = request.output_path.trim();
    if input_path.is_empty() {
        return Err("Input video path cannot be empty.".to_string());
    }
    if output_path.is_empty() {
        return Err("Output video path cannot be empty.".to_string());
    }
    if !request.start_time_seconds.is_finite() || !request.end_time_seconds.is_finite() {
        return Err("Trim points must be finite numbers.".to_string());
    }
    if request.start_time_seconds < 0.0 {
        return Err("Trim start cannot be negative.".to_string());
    }
    if request.end_time_seconds <= request.start_time_seconds {
        return Err("Trim end must be greater than trim start.".to_string());
    }

    let input = PathBuf::from(input_path);
    if !input.exists() {
        return Err(format!("Input video does not exist: {}", input.display()));
    }
    if !input.is_file() {
        return Err(format!("Input path is not a file: {}", input.display()));
    }

    let output = PathBuf::from(output_path);
    if paths_match(&input, &output) {
        return Err("Trim export must write to a different output path.".to_string());
    }

    if let Some(parent) = output.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent).map_err(|error| {
                format!(
                    "Failed to create output directory '{}': {error}",
                    parent.display()
                )
            })?;
        }
    }

    if output.exists() && !request.overwrite_existing {
        return Err(format!(
            "Output path already exists and overwrite is disabled: {}",
            output.display()
        ));
    }

    Ok(VideoTrimExportRequest {
        input_path: input.to_string_lossy().to_string(),
        output_path: output.to_string_lossy().to_string(),
        start_time_seconds: request.start_time_seconds,
        end_time_seconds: request.end_time_seconds,
        overwrite_existing: request.overwrite_existing,
    })
}

fn resolve_ffmpeg_binary() -> String {
    std::env::var("FFMPEG_BIN")
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| DEFAULT_FFMPEG_BINARY.to_string())
}

fn normalize_video_input_path(input_path: &str) -> Result<PathBuf, String> {
    let trimmed = input_path.trim();
    if trimmed.is_empty() {
        return Err("Input video path cannot be empty.".to_string());
    }
    let input = PathBuf::from(trimmed);
    if !input.exists() {
        return Err(format!("Input video does not exist: {}", input.display()));
    }
    if !input.is_file() {
        return Err(format!("Input path is not a file: {}", input.display()));
    }
    Ok(input)
}

fn resolve_video_runtime_root(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_local_data_dir()
        .map(|path| path.join("video-workbench"))
        .map_err(|error| format!("Failed to resolve app local data directory: {error}"))
}

fn resolve_video_temp_root(app: &AppHandle) -> Result<PathBuf, String> {
    let root = resolve_video_runtime_root(app)?.join("temp");
    fs::create_dir_all(&root)
        .map_err(|error| format!("Failed to create video temp directory '{}': {error}", root.display()))?;
    Ok(root)
}

fn video_preview_proxy_path(app: &AppHandle, input_path: &Path) -> Result<PathBuf, String> {
    let temp_root = resolve_video_temp_root(app)?.join("preview-proxies");
    fs::create_dir_all(&temp_root)
        .map_err(|error| format!("Failed to create video proxy directory '{}': {error}", temp_root.display()))?;

    let metadata = fs::metadata(input_path)
        .map_err(|error| format!("Failed to read video metadata '{}': {error}", input_path.display()))?;
    let modified_nanos = metadata
        .modified()
        .ok()
        .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
        .map(|value| value.as_nanos())
        .unwrap_or_default();

    let mut hasher = Sha256::new();
    hasher.update(input_path.to_string_lossy().as_bytes());
    hasher.update(metadata.len().to_le_bytes());
    hasher.update(modified_nanos.to_le_bytes());
    let digest = format!("{:x}", hasher.finalize());
    let digest_prefix = &digest[..16];
    let stem = sanitize_proxy_file_stem(
        input_path
            .file_stem()
            .and_then(|value| value.to_str())
            .unwrap_or("video"),
    );

    Ok(temp_root.join(format!(
        "{stem}.{digest_prefix}.preview.{VIDEO_PREVIEW_PROXY_EXTENSION}"
    )))
}

fn sanitize_proxy_file_stem(value: &str) -> String {
    let sanitized: String = value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || character == '-' || character == '_' {
                character
            } else {
                '-'
            }
        })
        .collect();
    let collapsed = sanitized.trim_matches('-');
    if collapsed.is_empty() {
        "video".to_string()
    } else {
        collapsed.to_string()
    }
}

fn can_reuse_video_preview_proxy(input_path: &Path, proxy_path: &Path) -> bool {
    let Ok(proxy_metadata) = fs::metadata(proxy_path) else {
        return false;
    };
    if !proxy_metadata.is_file() || proxy_metadata.len() == 0 {
        return false;
    }

    let Ok(input_metadata) = fs::metadata(input_path) else {
        return false;
    };
    let input_modified = input_metadata.modified().ok();
    let proxy_modified = proxy_metadata.modified().ok();
    match (input_modified, proxy_modified) {
        (Some(input_time), Some(proxy_time)) => proxy_time >= input_time,
        _ => false,
    }
}

fn generate_video_preview_proxy(input_path: &Path, proxy_path: &Path) -> Result<(), String> {
    let ffmpeg_binary = resolve_ffmpeg_binary();
    if let Some(parent) = proxy_path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "Failed to create preview proxy directory '{}': {error}",
                parent.display()
            )
        })?;
    }

    let mut command = Command::new(&ffmpeg_binary);
    command.args(["-hide_banner", "-loglevel", "error", "-y"]);
    command.args(["-i", &path_to_string(input_path)]);
    command.args([
        "-vf",
        VIDEO_TRIM_SCALE_FILTER,
        "-c:v",
        "libx264",
        "-preset",
        VIDEO_PREVIEW_PROXY_PRESET,
        "-crf",
        VIDEO_PREVIEW_PROXY_CRF,
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        VIDEO_PREVIEW_PROXY_AUDIO_BITRATE,
        "-movflags",
        "+faststart",
        &path_to_string(proxy_path),
    ]);

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    let output = command
        .output()
        .map_err(|error| format!("Failed to launch ffmpeg at '{ffmpeg_binary}': {error}"))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let message = if !stderr.is_empty() {
            stderr
        } else if !stdout.is_empty() {
            stdout
        } else {
            format!("ffmpeg exited with status {}", output.status)
        };
        return Err(format!("Video preview proxy generation failed: {message}"));
    }

    Ok(())
}

fn direct_video_preview_mime_type(input_path: &Path) -> Option<String> {
    let extension = input_path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.trim().trim_start_matches('.').to_ascii_lowercase())?;
    let mime_type = match extension.as_str() {
        "3g2" => "video/3gpp2",
        "3gp" => "video/3gpp",
        "asf" => "video/x-ms-asf",
        "avi" => "video/x-msvideo",
        "flv" => "video/x-flv",
        "m2ts" | "mts" => "video/mp2t",
        "m2v" | "mpe" | "mpeg" | "mpg" => "video/mpeg",
        "m4v" => "video/x-m4v",
        "mkv" => "video/x-matroska",
        "mov" | "qt" => "video/quicktime",
        "mp4" => "video/mp4",
        "ogv" => "video/ogg",
        "webm" => "video/webm",
        "wmv" => "video/x-ms-wmv",
        _ => return None,
    };
    Some(mime_type.to_string())
}

fn format_ffmpeg_seconds(seconds: f64) -> String {
    format!("{seconds:.3}")
}

fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().to_string()
}

fn paths_match(left: &Path, right: &Path) -> bool {
    let canonical_left = fs::canonicalize(left).ok();
    let canonical_right = fs::canonicalize(right).ok();
    match (canonical_left, canonical_right) {
        (Some(normalized_left), Some(normalized_right)) => normalized_left == normalized_right,
        _ => left == right,
    }
}

#[cfg(test)]
mod tests {
    use super::{
        direct_video_preview_mime_type, normalize_trim_export_request, sanitize_proxy_file_stem,
        VideoTrimExportRequest,
    };
    use std::path::Path;

    #[test]
    fn normalize_trim_export_request_rejects_same_input_and_output() {
        let request = VideoTrimExportRequest {
            input_path: "/tmp/demo.mp4".to_string(),
            output_path: "/tmp/demo.mp4".to_string(),
            start_time_seconds: 0.0,
            end_time_seconds: 5.0,
            overwrite_existing: true,
        };

        let result = normalize_trim_export_request(request);
        assert!(result.is_err());
    }

    #[test]
    fn direct_video_preview_mime_type_matches_known_extensions() {
        assert_eq!(
            direct_video_preview_mime_type(Path::new("/tmp/demo.mov")).as_deref(),
            Some("video/quicktime")
        );
        assert_eq!(
            direct_video_preview_mime_type(Path::new("/tmp/demo.mp4")).as_deref(),
            Some("video/mp4")
        );
        assert_eq!(
            direct_video_preview_mime_type(Path::new("/tmp/demo.unknown")),
            None
        );
    }

    #[test]
    fn sanitize_proxy_file_stem_preserves_safe_characters() {
        assert_eq!(sanitize_proxy_file_stem("Demo Clip 01"), "Demo-Clip-01");
        assert_eq!(sanitize_proxy_file_stem("___"), "___");
        assert_eq!(sanitize_proxy_file_stem("..."), "video");
    }
}
