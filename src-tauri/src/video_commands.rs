use crate::video_engine::{
    resolve_video_ffmpeg_binary, resolve_video_ffprobe_binary, resolve_video_runtime_root,
    sanitize_video_runtime_stem, validate_video_source_path,
};
use rust_ffmpeg::{
    Codec, CodecOptions, Duration as FFmpegDuration, FFmpegBuilder, Input,
    LogLevel as FFmpegLogLevel, Output, PixelFormat,
};
use rust_ffprobe::{FFprobeBuilder, LogLevel as FFprobeLogLevel, ProbeResult, StreamInfo};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration as StdDuration, UNIX_EPOCH};
use tauri::AppHandle;

const VIDEO_PREVIEW_PROXY_AUDIO_BITRATE: &str = "160k";
#[cfg(not(target_os = "linux"))]
const VIDEO_PREVIEW_PROXY_MP4_CRF: u8 = 23;
#[cfg(not(target_os = "linux"))]
const VIDEO_PREVIEW_PROXY_MP4_PRESET: &str = "veryfast";
#[cfg(target_os = "linux")]
const VIDEO_PREVIEW_PROXY_WEBM_CRF: u8 = 31;
const VIDEO_TRIM_AUDIO_BITRATE: &str = "192k";
const VIDEO_TRIM_CRF: u8 = 18;
const VIDEO_TRIM_PRESET: &str = "veryfast";
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

#[derive(Debug, Clone)]
struct VideoPreviewCompatibility {
    direct_playback_supported: bool,
    has_audio_track: bool,
    mime_type: Option<String>,
}

#[tauri::command]
#[specta::specta]
pub async fn video_export_trim(
    request: VideoTrimExportRequest,
) -> Result<VideoTrimExportResult, String> {
    run_video_trim_export(request).await
}

#[tauri::command]
#[specta::specta]
pub async fn video_create_preview_proxy(
    app: AppHandle,
    input_path: String,
) -> Result<ResolvedVideoPreviewSource, String> {
    let input = validate_video_source_path(&input_path)?;
    let compatibility = resolve_video_preview_compatibility(&input).await?;
    let proxy_path =
        ensure_video_preview_proxy(&app, &input, compatibility.has_audio_track).await?;

    Ok(ResolvedVideoPreviewSource {
        source_path: path_to_string(&proxy_path),
        source_kind: VideoPreviewSourceKind::Proxy,
        mime_type: Some(video_preview_proxy_mime_type().to_string()),
        generated_from_path: Some(path_to_string(&input)),
    })
}

#[tauri::command]
#[specta::specta]
pub async fn video_resolve_preview_source(
    app: AppHandle,
    input_path: String,
) -> Result<ResolvedVideoPreviewSource, String> {
    let input = validate_video_source_path(&input_path)?;
    let compatibility = resolve_video_preview_compatibility(&input).await?;

    if compatibility.direct_playback_supported {
        return Ok(ResolvedVideoPreviewSource {
            source_path: path_to_string(&input),
            source_kind: VideoPreviewSourceKind::Direct,
            mime_type: compatibility.mime_type,
            generated_from_path: None,
        });
    }

    let proxy_path =
        ensure_video_preview_proxy(&app, &input, compatibility.has_audio_track).await?;
    Ok(ResolvedVideoPreviewSource {
        source_path: path_to_string(&proxy_path),
        source_kind: VideoPreviewSourceKind::Proxy,
        mime_type: Some(video_preview_proxy_mime_type().to_string()),
        generated_from_path: Some(path_to_string(&input)),
    })
}

async fn run_video_trim_export(
    request: VideoTrimExportRequest,
) -> Result<VideoTrimExportResult, String> {
    let normalized_request = normalize_trim_export_request(request)?;
    let input_path = PathBuf::from(&normalized_request.input_path);
    let compatibility = resolve_video_preview_compatibility(&input_path).await?;
    let ffmpeg_binary = resolve_video_ffmpeg_binary();
    let clip_duration_seconds =
        normalized_request.end_time_seconds - normalized_request.start_time_seconds;

    let trim_input = Input::new(normalized_request.input_path.clone())
        .seek(ffmpeg_duration_from_seconds(
            normalized_request.start_time_seconds,
        ))
        .duration(ffmpeg_duration_from_seconds(clip_duration_seconds));

    let trim_output = build_trim_export_output(
        Path::new(&normalized_request.output_path),
        compatibility.has_audio_track,
    );

    let builder = FFmpegBuilder::with_executable(ffmpeg_binary.clone())
        .log_level(FFmpegLogLevel::Error)
        .input(trim_input)
        .raw_args(["-vf", VIDEO_TRIM_SCALE_FILTER]);
    let builder = if normalized_request.overwrite_existing {
        builder.overwrite()
    } else {
        builder.no_overwrite()
    };

    builder
        .output(trim_output)
        .run()
        .await
        .map_err(|error| format!("Video trim export failed: {error}"))?;

    Ok(VideoTrimExportResult {
        output_path: normalized_request.output_path,
        start_time_seconds: normalized_request.start_time_seconds,
        end_time_seconds: normalized_request.end_time_seconds,
        duration_seconds: clip_duration_seconds,
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

fn resolve_video_temp_root(app: &AppHandle) -> Result<PathBuf, String> {
    let root = resolve_video_runtime_root(app)?.join("temp");
    fs::create_dir_all(&root).map_err(|error| {
        format!(
            "Failed to create video temp directory '{}': {error}",
            root.display()
        )
    })?;
    Ok(root)
}

fn video_preview_proxy_path(app: &AppHandle, input_path: &Path) -> Result<PathBuf, String> {
    let temp_root = resolve_video_temp_root(app)?.join("preview-proxies");
    fs::create_dir_all(&temp_root).map_err(|error| {
        format!(
            "Failed to create video proxy directory '{}': {error}",
            temp_root.display()
        )
    })?;

    let metadata = fs::metadata(input_path).map_err(|error| {
        format!(
            "Failed to read video metadata '{}': {error}",
            input_path.display()
        )
    })?;
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
    let stem = sanitize_video_runtime_stem(
        input_path
            .file_stem()
            .and_then(|value| value.to_str())
            .unwrap_or("video"),
    );

    Ok(temp_root.join(format!(
        "{stem}.{digest_prefix}.preview.{}",
        video_preview_proxy_extension()
    )))
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

async fn ensure_video_preview_proxy(
    app: &AppHandle,
    input_path: &Path,
    has_audio_track: bool,
) -> Result<PathBuf, String> {
    let proxy_path = video_preview_proxy_path(app, input_path)?;
    if !can_reuse_video_preview_proxy(input_path, &proxy_path) {
        generate_video_preview_proxy(input_path, &proxy_path, has_audio_track).await?;
    }
    Ok(proxy_path)
}

async fn generate_video_preview_proxy(
    input_path: &Path,
    proxy_path: &Path,
    has_audio_track: bool,
) -> Result<(), String> {
    if let Some(parent) = proxy_path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "Failed to create preview proxy directory '{}': {error}",
                parent.display()
            )
        })?;
    }

    FFmpegBuilder::with_executable(resolve_video_ffmpeg_binary())
        .log_level(FFmpegLogLevel::Error)
        .overwrite()
        .input_path(path_to_string(input_path))
        .raw_args(["-vf", VIDEO_TRIM_SCALE_FILTER])
        .output(build_preview_proxy_output(proxy_path, has_audio_track))
        .run()
        .await
        .map_err(|error| format!("Video preview proxy generation failed: {error}"))?;

    Ok(())
}

fn build_preview_proxy_output(proxy_path: &Path, has_audio_track: bool) -> Output {
    #[cfg(target_os = "linux")]
    let output = Output::new(path_to_string(proxy_path))
        .format("webm")
        .video_codec_opts(
            CodecOptions::new(Codec::new("libvpx-vp9"))
                .quality(VIDEO_PREVIEW_PROXY_WEBM_CRF)
                .pixel_format(PixelFormat::yuv420p())
                .option("b:v", "0")
                .option("row-mt", "1")
                .option("cpu-used", "4"),
        )
        .option("deadline", "good");

    #[cfg(not(target_os = "linux"))]
    let output = Output::new(path_to_string(proxy_path))
        .format("mp4")
        .video_codec_opts(
            CodecOptions::new(Codec::new("libx264"))
                .quality(VIDEO_PREVIEW_PROXY_MP4_CRF)
                .pixel_format(PixelFormat::yuv420p()),
        )
        .preset(VIDEO_PREVIEW_PROXY_MP4_PRESET)
        .faststart();

    if has_audio_track {
        #[cfg(target_os = "linux")]
        {
            output.audio_codec_opts(
                CodecOptions::new(Codec::new("libopus")).bitrate(VIDEO_PREVIEW_PROXY_AUDIO_BITRATE),
            )
        }

        #[cfg(not(target_os = "linux"))]
        {
            output.audio_codec_opts(
                CodecOptions::new(Codec::aac()).bitrate(VIDEO_PREVIEW_PROXY_AUDIO_BITRATE),
            )
        }
    } else {
        output.no_audio()
    }
}

#[cfg(target_os = "linux")]
fn video_preview_proxy_extension() -> &'static str {
    "webm"
}

#[cfg(not(target_os = "linux"))]
fn video_preview_proxy_extension() -> &'static str {
    "mp4"
}

#[cfg(target_os = "linux")]
fn video_preview_proxy_mime_type() -> &'static str {
    "video/webm"
}

#[cfg(not(target_os = "linux"))]
fn video_preview_proxy_mime_type() -> &'static str {
    "video/mp4"
}

fn build_trim_export_output(output_path: &Path, has_audio_track: bool) -> Output {
    let output = Output::new(path_to_string(output_path))
        .format("mp4")
        .video_codec_opts(
            CodecOptions::new(Codec::new("libx264"))
                .quality(VIDEO_TRIM_CRF)
                .pixel_format(PixelFormat::yuv420p()),
        )
        .preset(VIDEO_TRIM_PRESET)
        .faststart();

    if has_audio_track {
        output.audio_codec_opts(CodecOptions::new(Codec::aac()).bitrate(VIDEO_TRIM_AUDIO_BITRATE))
    } else {
        output.no_audio()
    }
}

async fn resolve_video_preview_compatibility(
    input_path: &Path,
) -> Result<VideoPreviewCompatibility, String> {
    let probe = probe_video_media(input_path).await?;
    let video_stream = probe
        .primary_video_stream()
        .ok_or_else(|| format!("No video stream was found in '{}'.", input_path.display()))?;
    let audio_stream = probe.primary_audio_stream();
    let extension = lowercase_extension(input_path);
    let direct_playback_supported = match extension.as_deref() {
        Some("mp4" | "m4v") => {
            is_mp4_video_stream_supported(video_stream)
                && audio_stream
                    .map(is_mp4_audio_stream_supported)
                    .unwrap_or(true)
        }
        Some("webm") => {
            is_webm_video_stream_supported(video_stream)
                && audio_stream
                    .map(is_webm_audio_stream_supported)
                    .unwrap_or(true)
        }
        Some("ogv") => {
            is_ogv_video_stream_supported(video_stream)
                && audio_stream
                    .map(is_ogv_audio_stream_supported)
                    .unwrap_or(true)
        }
        _ => false,
    };

    Ok(VideoPreviewCompatibility {
        direct_playback_supported,
        has_audio_track: audio_stream.is_some(),
        mime_type: direct_video_preview_mime_type(input_path),
    })
}

async fn probe_video_media(input_path: &Path) -> Result<ProbeResult, String> {
    FFprobeBuilder::with_executable(resolve_video_ffprobe_binary())
        .input(path_to_string(input_path))
        .show_format()
        .show_streams()
        .log_level(FFprobeLogLevel::Error)
        .run()
        .await
        .map_err(|error| format!("Video probe failed for '{}': {error}", input_path.display()))
}

fn is_mp4_video_stream_supported(video_stream: &StreamInfo) -> bool {
    let Some(codec_name) = lowercase_codec_name(video_stream) else {
        return false;
    };
    if !matches!(codec_name.as_str(), "h264" | "avc1") {
        return false;
    }

    match lowercase_optional(video_stream.pix_fmt.as_deref()) {
        Some(pixel_format) => {
            pixel_format.contains("420") || pixel_format == "nv12" || pixel_format == "yuvj420p"
        }
        None => true,
    }
}

fn is_mp4_audio_stream_supported(audio_stream: &StreamInfo) -> bool {
    matches!(
        lowercase_codec_name(audio_stream).as_deref(),
        Some("aac" | "mp3" | "mp4a")
    )
}

fn is_webm_video_stream_supported(video_stream: &StreamInfo) -> bool {
    matches!(
        lowercase_codec_name(video_stream).as_deref(),
        Some("vp8" | "vp9")
    )
}

fn is_webm_audio_stream_supported(audio_stream: &StreamInfo) -> bool {
    matches!(
        lowercase_codec_name(audio_stream).as_deref(),
        Some("opus" | "vorbis")
    )
}

fn is_ogv_video_stream_supported(video_stream: &StreamInfo) -> bool {
    matches!(
        lowercase_codec_name(video_stream).as_deref(),
        Some("theora")
    )
}

fn is_ogv_audio_stream_supported(audio_stream: &StreamInfo) -> bool {
    matches!(
        lowercase_codec_name(audio_stream).as_deref(),
        Some("opus" | "vorbis")
    )
}

fn lowercase_extension(input_path: &Path) -> Option<String> {
    input_path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.trim().trim_start_matches('.').to_ascii_lowercase())
}

fn lowercase_codec_name(stream: &StreamInfo) -> Option<String> {
    lowercase_optional(stream.codec_name.as_deref())
}

fn lowercase_optional(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_ascii_lowercase)
}

fn direct_video_preview_mime_type(input_path: &Path) -> Option<String> {
    let extension = lowercase_extension(input_path)?;
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

fn ffmpeg_duration_from_seconds(seconds: f64) -> FFmpegDuration {
    StdDuration::from_secs_f64(seconds.max(0.0)).into()
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
        build_preview_proxy_output, direct_video_preview_mime_type, generate_video_preview_proxy,
        normalize_trim_export_request, resolve_video_preview_compatibility, run_video_trim_export,
        video_preview_proxy_extension, VideoTrimExportRequest,
    };
    use crate::video_engine::{
        resolve_video_ffmpeg_binary, resolve_video_ffprobe_binary, sanitize_video_runtime_stem,
    };
    use serde::Deserialize;
    use std::path::{Path, PathBuf};
    use std::process::Command;
    use tempfile::tempdir;

    #[derive(Debug, Deserialize)]
    struct TestFfprobeResponse {
        streams: Vec<TestFfprobeStream>,
        format: Option<TestFfprobeFormat>,
    }

    #[derive(Debug, Deserialize)]
    struct TestFfprobeStream {
        codec_type: Option<String>,
        codec_name: Option<String>,
    }

    #[derive(Debug, Deserialize)]
    struct TestFfprobeFormat {
        duration: Option<String>,
    }

    fn ensure_video_toolchain_available() -> Option<(String, String)> {
        let ffmpeg_binary = resolve_video_ffmpeg_binary();
        let ffprobe_binary = resolve_video_ffprobe_binary();

        let ffmpeg_ready = Command::new(&ffmpeg_binary)
            .arg("-version")
            .output()
            .map(|output| output.status.success())
            .unwrap_or(false);
        let ffprobe_ready = Command::new(&ffprobe_binary)
            .arg("-version")
            .output()
            .map(|output| output.status.success())
            .unwrap_or(false);

        if ffmpeg_ready && ffprobe_ready {
            Some((ffmpeg_binary, ffprobe_binary))
        } else {
            eprintln!(
                "Skipping real video toolchain test because ffmpeg ({ffmpeg_binary}) or ffprobe ({ffprobe_binary}) was unavailable."
            );
            None
        }
    }

    fn generate_test_video_fixture(
        ffmpeg_binary: &str,
        output_path: &Path,
        with_audio_track: bool,
    ) {
        let extension = output_path
            .extension()
            .and_then(|value| value.to_str())
            .expect("fixture extension")
            .to_ascii_lowercase();

        let mut command = Command::new(ffmpeg_binary);
        command.args(["-hide_banner", "-loglevel", "error", "-y"]);
        command.args(["-f", "lavfi", "-i", "testsrc=size=320x180:rate=24"]);
        if with_audio_track {
            command.args(["-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000"]);
        }
        command.args(["-t", "1.5", "-shortest"]);

        match extension.as_str() {
            "mp4" => {
                command.args(["-c:v", "libx264", "-pix_fmt", "yuv420p"]);
                if with_audio_track {
                    command.args(["-c:a", "aac", "-b:a", "128k"]);
                } else {
                    command.arg("-an");
                }
            }
            "mov" | "mkv" => {
                command.args(["-c:v", "libx264", "-pix_fmt", "yuv420p"]);
                if with_audio_track {
                    command.args(["-c:a", "aac", "-b:a", "128k"]);
                } else {
                    command.arg("-an");
                }
            }
            "webm" => {
                command.args(["-c:v", "libvpx-vp9", "-pix_fmt", "yuv420p"]);
                if with_audio_track {
                    command.args(["-c:a", "libopus", "-b:a", "96k"]);
                } else {
                    command.arg("-an");
                }
            }
            "avi" => {
                command.args(["-c:v", "mpeg4", "-qscale:v", "4"]);
                if with_audio_track {
                    command.args(["-c:a", "pcm_s16le"]);
                } else {
                    command.arg("-an");
                }
            }
            other => panic!("unsupported fixture extension: {other}"),
        }

        command.arg(output_path);

        let output = command.output().expect("launch ffmpeg for fixture");
        if !output.status.success() {
            panic!(
                "failed to generate video fixture '{}': {}",
                output_path.display(),
                String::from_utf8_lossy(&output.stderr)
            );
        }
    }

    fn probe_media_summary(ffprobe_binary: &str, input_path: &Path) -> TestFfprobeResponse {
        let output = Command::new(ffprobe_binary)
            .args([
                "-v",
                "error",
                "-show_streams",
                "-show_format",
                "-print_format",
                "json",
                &input_path.to_string_lossy(),
            ])
            .output()
            .expect("launch ffprobe");

        if !output.status.success() {
            panic!(
                "ffprobe failed for '{}': {}",
                input_path.display(),
                String::from_utf8_lossy(&output.stderr)
            );
        }

        serde_json::from_slice(&output.stdout).expect("parse ffprobe json")
    }

    fn build_fixture_path(root: &Path, file_name: &str) -> PathBuf {
        root.join(file_name)
    }

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
    fn sanitize_video_runtime_stem_preserves_safe_characters() {
        assert_eq!(sanitize_video_runtime_stem("Demo Clip 01"), "Demo-Clip-01");
        assert_eq!(sanitize_video_runtime_stem("___"), "___");
        assert_eq!(sanitize_video_runtime_stem("..."), "video");
    }

    #[tokio::test]
    async fn preview_compatibility_prefers_direct_playback_only_for_web_safe_codec_pairs() {
        let Some((ffmpeg_binary, _ffprobe_binary)) = ensure_video_toolchain_available() else {
            return;
        };

        let temp_directory = tempdir().expect("video compatibility tempdir");
        let mp4_path = build_fixture_path(temp_directory.path(), "direct.mp4");
        let webm_path = build_fixture_path(temp_directory.path(), "direct.webm");
        let mov_path = build_fixture_path(temp_directory.path(), "proxy.mov");
        let mkv_path = build_fixture_path(temp_directory.path(), "proxy.mkv");
        let avi_path = build_fixture_path(temp_directory.path(), "proxy.avi");

        generate_test_video_fixture(&ffmpeg_binary, &mp4_path, true);
        generate_test_video_fixture(&ffmpeg_binary, &webm_path, true);
        generate_test_video_fixture(&ffmpeg_binary, &mov_path, true);
        generate_test_video_fixture(&ffmpeg_binary, &mkv_path, true);
        generate_test_video_fixture(&ffmpeg_binary, &avi_path, true);

        assert!(
            resolve_video_preview_compatibility(&mp4_path)
                .await
                .expect("mp4 compatibility")
                .direct_playback_supported
        );
        assert!(
            resolve_video_preview_compatibility(&webm_path)
                .await
                .expect("webm compatibility")
                .direct_playback_supported
        );
        assert!(
            !resolve_video_preview_compatibility(&mov_path)
                .await
                .expect("mov compatibility")
                .direct_playback_supported
        );
        assert!(
            !resolve_video_preview_compatibility(&mkv_path)
                .await
                .expect("mkv compatibility")
                .direct_playback_supported
        );
        assert!(
            !resolve_video_preview_compatibility(&avi_path)
                .await
                .expect("avi compatibility")
                .direct_playback_supported
        );
    }

    #[tokio::test]
    async fn preview_proxy_generation_transcodes_common_container_formats_into_platform_safe_outputs(
    ) {
        let Some((ffmpeg_binary, ffprobe_binary)) = ensure_video_toolchain_available() else {
            return;
        };

        let temp_directory = tempdir().expect("video proxy tempdir");
        let expected_output_extension = video_preview_proxy_extension();
        let expected_video_codec = if cfg!(target_os = "linux") {
            "vp9"
        } else {
            "h264"
        };
        let expected_audio_codec = if cfg!(target_os = "linux") {
            "opus"
        } else {
            "aac"
        };
        for extension in ["mov", "mkv", "avi"] {
            let input_path =
                build_fixture_path(temp_directory.path(), &format!("proxy-source.{extension}"));
            let output_path = build_fixture_path(
                temp_directory.path(),
                &format!("proxy-output-{extension}.{expected_output_extension}"),
            );

            generate_test_video_fixture(&ffmpeg_binary, &input_path, true);

            generate_video_preview_proxy(&input_path, &output_path, true)
                .await
                .unwrap_or_else(|error| {
                    panic!(
                        "proxy generation should succeed for '{}' but failed: {error}",
                        input_path.display()
                    )
                });

            let probe = probe_media_summary(&ffprobe_binary, &output_path);
            let codec_types = probe
                .streams
                .iter()
                .filter_map(|stream| stream.codec_type.as_deref())
                .collect::<Vec<_>>();
            let codec_names = probe
                .streams
                .iter()
                .filter_map(|stream| stream.codec_name.as_deref())
                .collect::<Vec<_>>();

            assert!(codec_types.contains(&"video"), "{}", output_path.display());
            assert!(codec_types.contains(&"audio"), "{}", output_path.display());
            assert!(
                codec_names.contains(&expected_video_codec),
                "{}",
                output_path.display()
            );
            assert!(
                codec_names.contains(&expected_audio_codec),
                "{}",
                output_path.display()
            );
        }
    }

    #[tokio::test]
    async fn trim_export_transcodes_common_containers_into_seekable_mp4_outputs() {
        let Some((ffmpeg_binary, ffprobe_binary)) = ensure_video_toolchain_available() else {
            return;
        };

        let temp_directory = tempdir().expect("video trim tempdir");
        for extension in ["mp4", "mov", "webm", "mkv", "avi"] {
            let input_path =
                build_fixture_path(temp_directory.path(), &format!("trim-source.{extension}"));
            let output_path = build_fixture_path(
                temp_directory.path(),
                &format!("trim-output-{extension}.mp4"),
            );

            generate_test_video_fixture(&ffmpeg_binary, &input_path, true);

            let result = run_video_trim_export(VideoTrimExportRequest {
                input_path: input_path.to_string_lossy().to_string(),
                output_path: output_path.to_string_lossy().to_string(),
                start_time_seconds: 0.2,
                end_time_seconds: 1.1,
                overwrite_existing: true,
            })
            .await
            .unwrap_or_else(|error| {
                panic!(
                    "trim export should succeed for '{}' but failed: {error}",
                    input_path.display()
                )
            });

            assert_eq!(result.output_path, output_path.to_string_lossy());
            assert!(output_path.exists(), "{}", output_path.display());

            let probe = probe_media_summary(&ffprobe_binary, &output_path);
            let duration_seconds = probe
                .format
                .as_ref()
                .and_then(|format| format.duration.as_deref())
                .and_then(|value| value.parse::<f64>().ok())
                .unwrap_or_default();
            let codec_types = probe
                .streams
                .iter()
                .filter_map(|stream| stream.codec_type.as_deref())
                .collect::<Vec<_>>();
            let codec_names = probe
                .streams
                .iter()
                .filter_map(|stream| stream.codec_name.as_deref())
                .collect::<Vec<_>>();

            assert!(
                duration_seconds > 0.5 && duration_seconds < 1.5,
                "{}",
                output_path.display()
            );
            assert!(codec_types.contains(&"video"), "{}", output_path.display());
            assert!(codec_types.contains(&"audio"), "{}", output_path.display());
            assert!(codec_names.contains(&"h264"), "{}", output_path.display());
            assert!(codec_names.contains(&"aac"), "{}", output_path.display());
        }
    }

    #[test]
    fn preview_proxy_output_uses_platform_safe_container_defaults() {
        let output = build_preview_proxy_output(
            Path::new(&format!("/tmp/proxy.{}", video_preview_proxy_extension())),
            true,
        );
        let args = output.build_args();
        assert!(args.contains(&"-f".to_string()));
        assert!(args.contains(&video_preview_proxy_extension().to_string()));
    }
}
