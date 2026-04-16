use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

const DEFAULT_FFMPEG_BINARY: &str = "ffmpeg";
const VIDEO_TRIM_SCALE_FILTER: &str = "scale=trunc(iw/2)*2:trunc(ih/2)*2";

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

fn format_ffmpeg_seconds(seconds: f64) -> String {
    format!("{seconds:.3}")
}

fn paths_match(left: &Path, right: &Path) -> bool {
    let canonical_left = fs::canonicalize(left).ok();
    let canonical_right = fs::canonicalize(right).ok();
    match (canonical_left, canonical_right) {
        (Some(normalized_left), Some(normalized_right)) => normalized_left == normalized_right,
        _ => left == right,
    }
}
