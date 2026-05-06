use crate::audio_engine::analyze_audio_file_native;
use crate::explorer_identity::{
    build_content_revision, build_virtual_identity, record_thumbnail_artifact,
    PersistedThumbnailArtifactRecordInput,
};
use crate::ipc_runtime::artifacts::RegisterArtifactPathRequest;
use ab_glyph::{FontArc, PxScale};
use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use fontdb::{Database, Family, Query, Source};
use greeble_ipc_contracts::{IpcArtifactDescriptor, IpcArtifactRetention};
use image::codecs::png::PngEncoder;
use image::imageops::{resize, FilterType};
use image::{ColorType, ImageEncoder, ImageReader, Rgba, RgbaImage};
use imageproc::drawing::{draw_filled_circle_mut, draw_line_segment_mut, draw_text_mut};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::f32::consts::PI;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{LazyLock, Mutex};
use std::time::UNIX_EPOCH;
use tauri::{AppHandle, Manager};

const THUMBNAIL_MAX_DIMENSION: u32 = 1_024;
const THUMBNAIL_IMAGE_MAX_BYTES: u64 = 64 * 1024 * 1024;
const THUMBNAIL_TEXT_MAX_BYTES: u64 = 256 * 1024;
const THUMBNAIL_RUNTIME_DIR: &str = "explorer-thumbnails";
const THUMBNAIL_VIDEO_FRAME_COUNT_DEFAULT: u32 = 6;
const THUMBNAIL_VIDEO_FRAME_COUNT_MAX: u32 = 10;
const THUMBNAIL_VIDEO_TIMESTAMPS_START_RATIO: f64 = 0.08;
const THUMBNAIL_VIDEO_TIMESTAMPS_END_RATIO: f64 = 0.92;
const THUMBNAIL_VIDEO_POSTER_RATIO: f64 = 0.22;
const THUMBNAIL_DEFAULT_BACKGROUND: Rgba<u8> = Rgba([9, 12, 18, 255]);
const THUMBNAIL_TEXT_COLOR: Rgba<u8> = Rgba([234, 240, 248, 255]);
const THUMBNAIL_MUTED_TEXT_COLOR: Rgba<u8> = Rgba([145, 157, 178, 255]);
const THUMBNAIL_SHADOW_TEXT_COLOR: Rgba<u8> = Rgba([0, 0, 0, 130]);
const THUMBNAIL_WAVEFORM_COLOR: Rgba<u8> = Rgba([240, 246, 255, 210]);
const THUMBNAIL_CODE_BACKGROUND: Rgba<u8> = Rgba([10, 13, 18, 255]);
const THUMBNAIL_CODE_HEADER: Rgba<u8> = Rgba([14, 18, 26, 255]);
const THUMBNAIL_CODE_PANEL: Rgba<u8> = Rgba([16, 21, 30, 255]);
const THUMBNAIL_CODE_PANEL_ALT: Rgba<u8> = Rgba([12, 16, 23, 255]);
const THUMBNAIL_CODE_BORDER: Rgba<u8> = Rgba([39, 49, 65, 255]);
const THUMBNAIL_CODE_GUTTER: Rgba<u8> = Rgba([12, 16, 22, 255]);
const THUMBNAIL_CODE_LINE_NUMBER: Rgba<u8> = Rgba([122, 135, 158, 255]);
const THUMBNAIL_CODE_TEXT: Rgba<u8> = Rgba([234, 240, 248, 255]);
const THUMBNAIL_CODE_KEYWORD: Rgba<u8> = Rgba([124, 171, 255, 255]);
const THUMBNAIL_CODE_STRING: Rgba<u8> = Rgba([100, 214, 169, 255]);
const THUMBNAIL_CODE_NUMBER: Rgba<u8> = Rgba([247, 194, 88, 255]);
const THUMBNAIL_CODE_PROPERTY: Rgba<u8> = Rgba([182, 152, 255, 255]);
const THUMBNAIL_CODE_COMMENT: Rgba<u8> = Rgba([132, 144, 163, 255]);
const DEFAULT_FFMPEG_BINARY: &str = "ffmpeg";
const DEFAULT_FFPROBE_BINARY: &str = "ffprobe";
const VIDEO_FRAME_FILTER_TEMPLATE: &str =
    "scale=w={width}:h={height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:color=0x0b1118ff";

static THUMBNAIL_SANS_FONT_CACHE: LazyLock<Mutex<Option<FontArc>>> =
    LazyLock::new(|| Mutex::new(None));
static THUMBNAIL_MONO_FONT_CACHE: LazyLock<Mutex<Option<FontArc>>> =
    LazyLock::new(|| Mutex::new(None));

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum ExplorerThumbnailKind {
    Image,
    Code,
    Shader,
    Audio,
    Video,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ExplorerVideoHoverFrame {
    pub image_data_url: String,
    pub timestamp_seconds: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ExplorerEntryThumbnail {
    pub kind: ExplorerThumbnailKind,
    pub poster_data_url: String,
    pub hover_frames: Vec<ExplorerVideoHoverFrame>,
    pub hover_frame_delay_ms: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ExplorerEntryThumbnailRequest {
    pub path: String,
    pub max_width: u32,
    pub max_height: u32,
    pub include_video_hover_scrub: Option<bool>,
    pub video_hover_frame_count: Option<u32>,
    #[serde(rename = "entityId")]
    pub entity_id: Option<String>,
    #[serde(rename = "contentRevision")]
    pub content_revision: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ExplorerThumbnailArtifact {
    pub entity_id: String,
    pub content_revision: String,
    pub kind: ExplorerThumbnailKind,
    pub poster: IpcArtifactDescriptor,
    pub hover_frames: Vec<IpcArtifactDescriptor>,
    pub hover_frame_delay_ms: Option<u32>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ThumbnailRenderKind {
    Image,
    Code,
    Shader,
    Audio,
    Video,
}

#[derive(Debug, Clone)]
struct NormalizedThumbnailRequest {
    input_path: PathBuf,
    max_width: u32,
    max_height: u32,
    include_video_hover_scrub: bool,
    video_hover_frame_count: u32,
    entity_id: String,
    content_revision: String,
}

#[derive(Debug, Clone)]
struct ThumbnailFontSpec {
    family: Family<'static>,
}

#[derive(Debug, Clone)]
struct ShaderProfile {
    palette: [Rgba<u8>; 3],
    stripe_frequency: f32,
    stripe_mix: f32,
    fresnel_strength: f32,
    highlight_strength: f32,
}

#[tauri::command]
#[specta::specta]
pub async fn fs_read_entry_thumbnail(
    app: AppHandle,
    request: ExplorerEntryThumbnailRequest,
) -> Result<ExplorerEntryThumbnail, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let normalized = normalize_thumbnail_request(request)?;
        let artifact = build_entry_thumbnail_artifact(
            &app,
            crate::gpu_runtime::global_gpu_runtime(),
            &normalized,
        )?;
        build_entry_thumbnail_from_artifact(&app, &normalized, artifact)
    })
    .await
    .map_err(|error| format!("Thumbnail generation task failed to join: {error}"))?
}

#[tauri::command]
#[specta::specta]
pub async fn fs_read_entry_thumbnail_artifact(
    app: AppHandle,
    request: ExplorerEntryThumbnailRequest,
) -> Result<ExplorerThumbnailArtifact, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let normalized = normalize_thumbnail_request(request)?;
        build_entry_thumbnail_artifact(&app, crate::gpu_runtime::global_gpu_runtime(), &normalized)
    })
    .await
    .map_err(|error| format!("Thumbnail artifact generation task failed to join: {error}"))?
}

#[cfg_attr(not(test), allow(dead_code))]
pub(crate) fn build_image_thumbnail_data_url(
    path: &Path,
    max_width: u32,
    max_height: u32,
) -> Result<String, String> {
    build_image_thumbnail_data_url_with_runtime(None, path, max_width, max_height)
}

pub(crate) fn build_image_thumbnail_data_url_with_runtime(
    gpu_runtime: Option<&crate::gpu_runtime::GpuRuntimeManager>,
    path: &Path,
    max_width: u32,
    max_height: u32,
) -> Result<String, String> {
    let extension = normalized_extension(path);
    if extension == "svg" {
        let bytes = fs::read(path)
            .map_err(|error| format!("Failed to read SVG image '{}': {error}", path.display()))?;
        return Ok(format!(
            "data:image/svg+xml;base64,{}",
            BASE64_STANDARD.encode(bytes)
        ));
    }

    let png = build_image_thumbnail_png_with_runtime(gpu_runtime, path, max_width, max_height)?;
    Ok(png_bytes_to_data_url(&png))
}

fn build_image_thumbnail_png_with_runtime(
    gpu_runtime: Option<&crate::gpu_runtime::GpuRuntimeManager>,
    path: &Path,
    max_width: u32,
    max_height: u32,
) -> Result<Vec<u8>, String> {
    validate_thumbnail_bounds(max_width, max_height)?;
    let metadata = fs::metadata(path).map_err(|error| {
        format!(
            "Failed to read image metadata '{}': {error}",
            path.display()
        )
    })?;
    if metadata.len() > THUMBNAIL_IMAGE_MAX_BYTES {
        return Err("Image is too large to thumbnail (> 64 MB)".to_string());
    }

    let image = read_image_file_as_rgba(path)?;
    let thumbnail = if let Some(gpu_runtime) = gpu_runtime {
        let (target_width, target_height) =
            resolve_image_fit_dimensions(image.width(), image.height(), max_width, max_height);
        gpu_runtime
            .render_image_thumbnail(&image, target_width, target_height)
            .unwrap_or_else(|_| resize_image_to_fit(&image, max_width, max_height))
    } else {
        resize_image_to_fit(&image, max_width, max_height)
    };
    encode_rgba_image_as_png(&thumbnail)
}

fn build_entry_thumbnail_from_artifact(
    app: &AppHandle,
    request: &NormalizedThumbnailRequest,
    artifact: ExplorerThumbnailArtifact,
) -> Result<ExplorerEntryThumbnail, String> {
    let poster_path = resolve_registered_thumbnail_artifact_path(app, &artifact.poster)?;
    let poster_data_url = artifact_path_to_data_url(poster_path.as_path())?;
    let hover_timestamps = sample_thumbnail_hover_timestamps(
        request,
        artifact.kind.clone(),
        artifact.hover_frames.len(),
    );
    let hover_frames = artifact
        .hover_frames
        .iter()
        .enumerate()
        .map(|(index, descriptor)| {
            let hover_frame_path = resolve_registered_thumbnail_artifact_path(app, descriptor)?;
            Ok(ExplorerVideoHoverFrame {
                image_data_url: artifact_path_to_data_url(hover_frame_path.as_path())?,
                timestamp_seconds: *hover_timestamps.get(index).unwrap_or(&0.0),
            })
        })
        .collect::<Result<Vec<_>, String>>()?;
    Ok(ExplorerEntryThumbnail {
        kind: artifact.kind,
        poster_data_url,
        hover_frames,
        hover_frame_delay_ms: artifact.hover_frame_delay_ms,
    })
}

fn resolve_registered_thumbnail_artifact_path(
    app: &AppHandle,
    descriptor: &IpcArtifactDescriptor,
) -> Result<PathBuf, String> {
    let ipc_runtime = app.state::<crate::ipc_runtime::IpcRuntimeState>();
    ipc_runtime
        .artifact_path(&descriptor.id)?
        .ok_or_else(|| format!("Thumbnail artifact path is no longer registered: {}", descriptor.id))
}

fn build_entry_thumbnail_artifact(
    app: &AppHandle,
    gpu_runtime: Option<&crate::gpu_runtime::GpuRuntimeManager>,
    request: &NormalizedThumbnailRequest,
) -> Result<ExplorerThumbnailArtifact, String> {
    let kind = classify_thumbnail_kind(&request.input_path)?;
    match kind {
        ThumbnailRenderKind::Image => build_static_thumbnail_artifact(
            app,
            request,
            ExplorerThumbnailKind::Image,
            "image-v1",
            gpu_runtime,
            ensure_image_thumbnail_artifact_path,
        ),
        ThumbnailRenderKind::Code => build_static_thumbnail_artifact(
            app,
            request,
            ExplorerThumbnailKind::Code,
            "code-v3",
            None,
            |artifact_app, _, artifact_request, variant| {
                ensure_cached_static_thumbnail_path(
                    artifact_app,
                    artifact_request,
                    variant,
                    "png",
                    || {
                        render_code_thumbnail_png(
                            &artifact_request.input_path,
                            artifact_request.max_width,
                            artifact_request.max_height,
                        )
                    },
                )
            },
        ),
        ThumbnailRenderKind::Shader => build_static_thumbnail_artifact(
            app,
            request,
            ExplorerThumbnailKind::Shader,
            "shader-v2",
            None,
            |artifact_app, _, artifact_request, variant| {
                ensure_cached_static_thumbnail_path(
                    artifact_app,
                    artifact_request,
                    variant,
                    "png",
                    || {
                        render_shader_thumbnail_png(
                            &artifact_request.input_path,
                            artifact_request.max_width,
                            artifact_request.max_height,
                        )
                    },
                )
            },
        ),
        ThumbnailRenderKind::Audio => build_static_thumbnail_artifact(
            app,
            request,
            ExplorerThumbnailKind::Audio,
            "audio-v2",
            gpu_runtime,
            |artifact_app, artifact_gpu_runtime, artifact_request, variant| {
                ensure_cached_static_thumbnail_path(
                    artifact_app,
                    artifact_request,
                    variant,
                    "png",
                    || {
                        render_audio_thumbnail_png_with_runtime(
                            artifact_gpu_runtime,
                            &artifact_request.input_path,
                            artifact_request.max_width,
                            artifact_request.max_height,
                        )
                    },
                )
            },
        ),
        ThumbnailRenderKind::Video => build_video_thumbnail_artifact(app, request),
    }
}

fn build_static_thumbnail_artifact<F>(
    app: &AppHandle,
    request: &NormalizedThumbnailRequest,
    kind: ExplorerThumbnailKind,
    variant: &str,
    gpu_runtime: Option<&crate::gpu_runtime::GpuRuntimeManager>,
    ensure_poster_path: F,
) -> Result<ExplorerThumbnailArtifact, String>
where
    F: FnOnce(
        &AppHandle,
        Option<&crate::gpu_runtime::GpuRuntimeManager>,
        &NormalizedThumbnailRequest,
        &str,
    ) -> Result<PathBuf, String>,
{
    let poster_path = ensure_poster_path(app, gpu_runtime, request, variant)?;
    let poster =
        register_thumbnail_artifact_descriptor(app, request, "thumbnail.poster", &poster_path)?;
    let artifact = ExplorerThumbnailArtifact {
        entity_id: request.entity_id.clone(),
        content_revision: request.content_revision.clone(),
        kind: kind.clone(),
        poster,
        hover_frames: Vec::new(),
        hover_frame_delay_ms: None,
    };
    persist_thumbnail_artifact_record(app, request, &artifact, variant)?;
    Ok(artifact)
}

fn artifact_path_to_data_url(path: &Path) -> Result<String, String> {
    let bytes = fs::read(path).map_err(|error| {
        format!(
            "Failed to read thumbnail artifact '{}': {error}",
            path.display()
        )
    })?;
    let mime = if normalized_extension(path) == "svg" {
        "image/svg+xml"
    } else {
        "image/png"
    };
    Ok(format!(
        "data:{mime};base64,{}",
        BASE64_STANDARD.encode(bytes)
    ))
}

fn sample_thumbnail_hover_timestamps(
    request: &NormalizedThumbnailRequest,
    kind: ExplorerThumbnailKind,
    frame_count: usize,
) -> Vec<f64> {
    if kind != ExplorerThumbnailKind::Video || frame_count == 0 {
        return vec![0.0; frame_count];
    }
    let duration = probe_video_duration_seconds(&request.input_path).unwrap_or(0.0);
    sample_video_timestamps(duration, frame_count as u32)
}

fn persist_thumbnail_artifact_record(
    app: &AppHandle,
    request: &NormalizedThumbnailRequest,
    artifact: &ExplorerThumbnailArtifact,
    variant: &str,
) -> Result<(), String> {
    record_thumbnail_artifact(
        app,
        PersistedThumbnailArtifactRecordInput {
            entity_id: request.entity_id.clone(),
            content_revision: request.content_revision.clone(),
            kind: thumbnail_kind_storage_label(&artifact.kind).to_string(),
            variant_key: build_thumbnail_variant_key(
                variant,
                request.max_width,
                request.max_height,
                if request.include_video_hover_scrub {
                    Some(request.video_hover_frame_count)
                } else {
                    None
                },
            ),
            poster_path: resolve_registered_thumbnail_artifact_path(app, &artifact.poster)?
                .to_string_lossy()
                .to_string(),
            hover_frame_paths: artifact
                .hover_frames
                .iter()
                .map(|descriptor| {
                    resolve_registered_thumbnail_artifact_path(app, descriptor)
                        .map(|path| path.to_string_lossy().to_string())
                })
                .collect::<Result<Vec<_>, String>>()?,
            hover_frame_delay_ms: artifact.hover_frame_delay_ms,
        },
    )
}

fn register_thumbnail_artifact_descriptor(
    app: &AppHandle,
    request: &NormalizedThumbnailRequest,
    artifact_kind: &str,
    artifact_path: &Path,
) -> Result<IpcArtifactDescriptor, String> {
    let media_type = mime_guess::from_path(artifact_path)
        .first_raw()
        .map(str::to_string);
    let ipc_runtime = app.state::<crate::ipc_runtime::IpcRuntimeState>();
    ipc_runtime.register_artifact_path(app, RegisterArtifactPathRequest {
        kind: artifact_kind.to_string(),
        file_path: artifact_path.to_path_buf(),
        media_type,
        retention: IpcArtifactRetention::Persistent,
        identity_key: Some(request.entity_id.clone()),
        content_revision: Some(request.content_revision.clone()),
        delete_on_release: false,
    })
}

fn thumbnail_kind_storage_label(kind: &ExplorerThumbnailKind) -> &'static str {
    match kind {
        ExplorerThumbnailKind::Image => "image",
        ExplorerThumbnailKind::Code => "code",
        ExplorerThumbnailKind::Shader => "shader",
        ExplorerThumbnailKind::Audio => "audio",
        ExplorerThumbnailKind::Video => "video",
    }
}

fn normalize_thumbnail_request(
    request: ExplorerEntryThumbnailRequest,
) -> Result<NormalizedThumbnailRequest, String> {
    validate_thumbnail_bounds(request.max_width, request.max_height)?;
    let trimmed_path = request.path.trim();
    if trimmed_path.is_empty() {
        return Err("Thumbnail path cannot be empty.".to_string());
    }
    let input_path = PathBuf::from(trimmed_path);
    if !input_path.exists() {
        return Err(format!(
            "Thumbnail path does not exist: {}",
            input_path.display()
        ));
    }
    if !input_path.is_file() {
        return Err(format!(
            "Thumbnail path is not a file: {}",
            input_path.display()
        ));
    }
    let metadata = fs::symlink_metadata(&input_path).map_err(|error| {
        format!(
            "Failed to inspect thumbnail source '{}': {error}",
            input_path.display()
        )
    })?;
    let is_symlink = metadata.file_type().is_symlink();
    let is_dir = metadata.is_dir();
    let size = if is_dir { 0 } else { metadata.len() };
    let modified = metadata
        .modified()
        .ok()
        .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
        .map(|value| value.as_millis() as u64)
        .unwrap_or(0);
    let fallback_content_revision = build_content_revision(size, modified, is_dir, is_symlink);
    let content_revision = request
        .content_revision
        .unwrap_or(fallback_content_revision);
    let entity_id = request.entity_id.unwrap_or_else(|| {
        build_virtual_identity(
            "thumbnail-path",
            &input_path.to_string_lossy(),
            &content_revision,
        )
        .entity_id
    });
    Ok(NormalizedThumbnailRequest {
        input_path,
        max_width: request.max_width,
        max_height: request.max_height,
        include_video_hover_scrub: request.include_video_hover_scrub.unwrap_or(false),
        video_hover_frame_count: request
            .video_hover_frame_count
            .unwrap_or(THUMBNAIL_VIDEO_FRAME_COUNT_DEFAULT)
            .clamp(1, THUMBNAIL_VIDEO_FRAME_COUNT_MAX),
        entity_id,
        content_revision,
    })
}

fn validate_thumbnail_bounds(max_width: u32, max_height: u32) -> Result<(), String> {
    if max_width == 0 || max_height == 0 {
        return Err("Thumbnail bounds must be greater than zero.".to_string());
    }
    if max_width > THUMBNAIL_MAX_DIMENSION || max_height > THUMBNAIL_MAX_DIMENSION {
        return Err(format!(
            "Thumbnail bounds must be <= {} px.",
            THUMBNAIL_MAX_DIMENSION
        ));
    }
    Ok(())
}

fn classify_thumbnail_kind(path: &Path) -> Result<ThumbnailRenderKind, String> {
    let extension = normalized_extension(path);
    if extension == "svg" {
        return Ok(ThumbnailRenderKind::Image);
    }

    if fs::metadata(path)
        .map_err(|error| format!("Failed to read file metadata '{}': {error}", path.display()))?
        .len()
        <= THUMBNAIL_IMAGE_MAX_BYTES
        && read_image_file_as_rgba(path).is_ok()
    {
        return Ok(ThumbnailRenderKind::Image);
    }

    if is_video_extension(&extension) {
        return Ok(ThumbnailRenderKind::Video);
    }
    if is_audio_extension(&extension) {
        return Ok(ThumbnailRenderKind::Audio);
    }
    if is_shader_extension(&extension) {
        return Ok(ThumbnailRenderKind::Shader);
    }
    if is_code_extension(&extension) || file_looks_like_text(path)? {
        return Ok(ThumbnailRenderKind::Code);
    }

    Err(format!(
        "No thumbnail renderer is available for '{}'.",
        path.display()
    ))
}

fn normalized_extension(path: &Path) -> String {
    path.extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .trim()
        .trim_start_matches('.')
        .to_ascii_lowercase()
}

fn is_video_extension(extension: &str) -> bool {
    matches!(
        extension,
        "3g2"
            | "3gp"
            | "asf"
            | "avi"
            | "flv"
            | "m2ts"
            | "m2v"
            | "m4v"
            | "mkv"
            | "mov"
            | "mp4"
            | "mpe"
            | "mpeg"
            | "mpg"
            | "mts"
            | "ogv"
            | "qt"
            | "webm"
            | "wmv"
    )
}

fn is_audio_extension(extension: &str) -> bool {
    matches!(
        extension,
        "aac"
            | "aif"
            | "aiff"
            | "aifc"
            | "alac"
            | "amr"
            | "caf"
            | "flac"
            | "m4a"
            | "m4b"
            | "mid"
            | "midi"
            | "mka"
            | "mp3"
            | "oga"
            | "ogg"
            | "opus"
            | "wav"
            | "wave"
            | "weba"
            | "wma"
    )
}

fn is_shader_extension(extension: &str) -> bool {
    matches!(extension, "glsl" | "hlsl" | "wgsl")
}

fn is_code_extension(extension: &str) -> bool {
    matches!(
        extension,
        "txt"
            | "md"
            | "mdx"
            | "log"
            | "json"
            | "yaml"
            | "yml"
            | "toml"
            | "xml"
            | "ini"
            | "cfg"
            | "csv"
            | "ts"
            | "tsx"
            | "js"
            | "jsx"
            | "mjs"
            | "cjs"
            | "rs"
            | "py"
            | "go"
            | "c"
            | "h"
            | "cpp"
            | "hpp"
            | "cc"
            | "cxx"
            | "cs"
            | "java"
            | "kt"
            | "kts"
            | "rb"
            | "php"
            | "swift"
            | "dart"
            | "lua"
            | "zig"
            | "html"
            | "htm"
            | "css"
            | "scss"
            | "sass"
            | "less"
            | "sh"
            | "bash"
            | "zsh"
            | "ps1"
            | "bat"
            | "cmd"
            | "env"
            | "sql"
            | "kain"
            | "ink"
    )
}

fn file_looks_like_text(path: &Path) -> Result<bool, String> {
    let metadata = fs::metadata(path)
        .map_err(|error| format!("Failed to inspect file '{}': {error}", path.display()))?;
    if metadata.len() > THUMBNAIL_TEXT_MAX_BYTES {
        return Ok(false);
    }
    let bytes = fs::read(path).map_err(|error| {
        format!(
            "Failed to read text thumbnail source '{}': {error}",
            path.display()
        )
    })?;
    Ok(std::str::from_utf8(&bytes).is_ok())
}

fn read_image_file_as_rgba(path: &Path) -> Result<RgbaImage, String> {
    ImageReader::open(path)
        .map_err(|error| format!("Failed to open image '{}': {error}", path.display()))?
        .with_guessed_format()
        .map_err(|error| {
            format!(
                "Failed to detect image format for '{}': {error}",
                path.display()
            )
        })?
        .decode()
        .map(|image| image.to_rgba8())
        .map_err(|error| format!("Failed to decode image '{}': {error}", path.display()))
}

fn resize_image_to_fit(image: &RgbaImage, max_width: u32, max_height: u32) -> RgbaImage {
    let (width, height) =
        resolve_image_fit_dimensions(image.width(), image.height(), max_width, max_height);
    if width == image.width() && height == image.height() {
        return image.clone();
    }
    resize(image, width, height, FilterType::Lanczos3)
}

fn resolve_image_fit_dimensions(
    image_width: u32,
    image_height: u32,
    max_width: u32,
    max_height: u32,
) -> (u32, u32) {
    if image_width <= max_width && image_height <= max_height {
        return (image_width.max(1), image_height.max(1));
    }

    let scale = f32::min(
        max_width as f32 / image_width as f32,
        max_height as f32 / image_height as f32,
    );
    (
        ((image_width as f32) * scale).round().max(1.0) as u32,
        ((image_height as f32) * scale).round().max(1.0) as u32,
    )
}

fn encode_rgba_image_as_png(image: &RgbaImage) -> Result<Vec<u8>, String> {
    let mut bytes = Vec::new();
    PngEncoder::new(&mut bytes)
        .write_image(
            image.as_raw(),
            image.width(),
            image.height(),
            ColorType::Rgba8.into(),
        )
        .map_err(|error| format!("Failed to encode thumbnail as PNG: {error}"))?;
    Ok(bytes)
}

fn png_bytes_to_data_url(bytes: &[u8]) -> String {
    format!("data:image/png;base64,{}", BASE64_STANDARD.encode(bytes))
}

fn ensure_cached_static_thumbnail_path<F>(
    app: &AppHandle,
    request: &NormalizedThumbnailRequest,
    variant: &str,
    output_extension: &str,
    render_png: F,
) -> Result<PathBuf, String>
where
    F: FnOnce() -> Result<Vec<u8>, String>,
{
    let cache_path =
        thumbnail_artifact_cache_path(app, request, variant, output_extension, None, None)?;
    if !cache_path.exists() {
        let png = render_png()?;
        if let Some(parent) = cache_path.parent() {
            fs::create_dir_all(parent).map_err(|error| {
                format!(
                    "Failed to create thumbnail cache directory '{}': {error}",
                    parent.display()
                )
            })?;
        }
        fs::write(&cache_path, &png).map_err(|error| {
            format!(
                "Failed to write cached thumbnail '{}': {error}",
                cache_path.display()
            )
        })?;
    }
    Ok(cache_path)
}

fn resolve_thumbnail_runtime_root(app: &AppHandle) -> Result<PathBuf, String> {
    let root = app
        .path()
        .app_local_data_dir()
        .map(|path| path.join(THUMBNAIL_RUNTIME_DIR))
        .map_err(|error| format!("Failed to resolve app local data directory: {error}"))?;
    fs::create_dir_all(&root).map_err(|error| {
        format!(
            "Failed to create thumbnail runtime directory '{}': {error}",
            root.display()
        )
    })?;
    Ok(root)
}

fn thumbnail_artifact_cache_path(
    app: &AppHandle,
    request: &NormalizedThumbnailRequest,
    variant: &str,
    output_extension: &str,
    extra_number: Option<u32>,
    frame_index: Option<u32>,
) -> Result<PathBuf, String> {
    let root = resolve_thumbnail_runtime_root(app)?.join("artifacts");
    let digest = thumbnail_artifact_digest(
        request,
        variant,
        extra_number,
        frame_index,
        output_extension,
    );
    let digest_prefix = &digest[..16];
    let stem = sanitize_thumbnail_file_stem(
        request
            .input_path
            .file_stem()
            .and_then(|value| value.to_str())
            .unwrap_or("thumb"),
    );
    let variant_key =
        build_thumbnail_variant_key(variant, request.max_width, request.max_height, extra_number);
    let index_suffix = frame_index
        .map(|index| format!(".{:02}", index + 1))
        .unwrap_or_default();
    Ok(root.join(format!(
        "{stem}.{digest_prefix}.{variant_key}{index_suffix}.{output_extension}"
    )))
}

fn build_video_hover_frame_artifact_paths(
    app: &AppHandle,
    request: &NormalizedThumbnailRequest,
    frame_count: u32,
) -> Result<Vec<PathBuf>, String> {
    Ok((0..frame_count)
        .map(|index| {
            thumbnail_artifact_cache_path(
                app,
                request,
                "video-hover",
                "png",
                Some(frame_count),
                Some(index),
            )
        })
        .collect::<Result<Vec<_>, String>>()?)
}

fn thumbnail_artifact_digest(
    request: &NormalizedThumbnailRequest,
    variant: &str,
    extra_number: Option<u32>,
    frame_index: Option<u32>,
    output_extension: &str,
) -> String {
    let mut hasher = Sha256::new();
    hasher.update(request.entity_id.as_bytes());
    hasher.update(request.content_revision.as_bytes());
    hasher.update(request.max_width.to_le_bytes());
    hasher.update(request.max_height.to_le_bytes());
    hasher.update(variant.as_bytes());
    if let Some(extra_number) = extra_number {
        hasher.update(extra_number.to_le_bytes());
    }
    if let Some(frame_index) = frame_index {
        hasher.update(frame_index.to_le_bytes());
    }
    hasher.update(output_extension.as_bytes());
    format!("{:x}", hasher.finalize())
}

fn build_thumbnail_variant_key(
    variant: &str,
    max_width: u32,
    max_height: u32,
    extra_number: Option<u32>,
) -> String {
    match extra_number {
        Some(extra_number) => format!("{variant}-{max_width}x{max_height}-{extra_number}"),
        None => format!("{variant}-{max_width}x{max_height}"),
    }
}

fn ensure_image_thumbnail_artifact_path(
    app: &AppHandle,
    gpu_runtime: Option<&crate::gpu_runtime::GpuRuntimeManager>,
    request: &NormalizedThumbnailRequest,
    variant: &str,
) -> Result<PathBuf, String> {
    if normalized_extension(&request.input_path) == "svg" {
        let cache_path = thumbnail_artifact_cache_path(app, request, variant, "svg", None, None)?;
        if !cache_path.exists() {
            if let Some(parent) = cache_path.parent() {
                fs::create_dir_all(parent).map_err(|error| {
                    format!(
                        "Failed to create thumbnail cache directory '{}': {error}",
                        parent.display()
                    )
                })?;
            }
            fs::copy(&request.input_path, &cache_path).map_err(|error| {
                format!(
                    "Failed to copy SVG thumbnail artifact '{}' to '{}': {error}",
                    request.input_path.display(),
                    cache_path.display()
                )
            })?;
        }
        return Ok(cache_path);
    }

    ensure_cached_static_thumbnail_path(app, request, variant, "png", || {
        build_image_thumbnail_png_with_runtime(
            gpu_runtime,
            &request.input_path,
            request.max_width,
            request.max_height,
        )
    })
}

fn sanitize_thumbnail_file_stem(value: &str) -> String {
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
        "thumbnail".to_string()
    } else {
        collapsed.to_string()
    }
}

fn render_code_thumbnail_png(
    input_path: &Path,
    max_width: u32,
    max_height: u32,
) -> Result<Vec<u8>, String> {
    render_text_thumbnail_png(input_path, max_width, max_height, false)
}

fn render_shader_thumbnail_png(
    input_path: &Path,
    max_width: u32,
    max_height: u32,
) -> Result<Vec<u8>, String> {
    render_text_thumbnail_png(input_path, max_width, max_height, true)
}

fn render_text_thumbnail_png(
    input_path: &Path,
    max_width: u32,
    max_height: u32,
    shader_mode: bool,
) -> Result<Vec<u8>, String> {
    let metadata = fs::metadata(input_path).map_err(|error| {
        format!(
            "Failed to read text thumbnail metadata '{}': {error}",
            input_path.display()
        )
    })?;
    if metadata.len() > THUMBNAIL_TEXT_MAX_BYTES {
        return Err("Text source is too large to thumbnail.".to_string());
    }

    let bytes = fs::read(input_path).map_err(|error| {
        format!(
            "Failed to read text thumbnail source '{}': {error}",
            input_path.display()
        )
    })?;
    let content = String::from_utf8_lossy(&bytes).to_string();
    let extension = normalized_extension(input_path);
    let accent = extension_accent_color(&extension);
    if !shader_mode {
        return render_code_thumbnail_card_png(
            input_path, &content, &extension, accent, max_width, max_height,
        );
    }
    let mut image = RgbaImage::from_pixel(max_width, max_height, THUMBNAIL_DEFAULT_BACKGROUND);
    let secondary = tint_color(accent, 0.55, 40);
    draw_vertical_gradient(
        &mut image,
        THUMBNAIL_DEFAULT_BACKGROUND,
        tint_color(accent, 0.15, 0),
    );
    fill_rect(
        &mut image,
        0,
        0,
        max_width,
        max_height.min(44),
        tint_color(accent, 0.22, 10),
    );
    fill_rect(&mut image, 0, 44, 6, max_height, accent);
    let preview_panel_top = 52;
    let preview_panel_bottom = max_height.saturating_sub(16);
    fill_rect(
        &mut image,
        12,
        preview_panel_top,
        max_width.saturating_sub(12),
        preview_panel_bottom,
        Rgba([11, 15, 22, 232]),
    );
    fill_rect(
        &mut image,
        12,
        preview_panel_top,
        max_width.saturating_sub(12),
        preview_panel_top + 18,
        tint_color(accent, 0.16, 10),
    );
    fill_rect(
        &mut image,
        12,
        preview_panel_top,
        16,
        preview_panel_bottom,
        accent,
    );

    let sans_font = load_thumbnail_font(ThumbnailFontSpec {
        family: Family::SansSerif,
    })
    .ok();
    let mono_font = load_thumbnail_font(ThumbnailFontSpec {
        family: Family::Monospace,
    })
    .ok();

    if let Some(font) = sans_font.as_ref() {
        let title = input_path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("code");
        let title_scale = if shader_mode { 15.5 } else { 16.5 };
        draw_text_with_shadow(
            &mut image,
            font,
            PxScale::from(title_scale),
            (16.0, 10.0),
            &truncate_text(title, 24),
            THUMBNAIL_TEXT_COLOR,
        );
        let subtitle = if shader_mode {
            "Shader material preview"
        } else {
            "Source snapshot"
        };
        draw_text_with_shadow(
            &mut image,
            font,
            PxScale::from(10.5),
            (16.0, 28.0),
            subtitle,
            THUMBNAIL_MUTED_TEXT_COLOR,
        );
        let badge_text = if extension.is_empty() {
            "text".to_string()
        } else {
            extension.to_ascii_uppercase()
        };
        let badge_width = 14 + (badge_text.len() as u32 * 8);
        fill_rounded_badge(
            &mut image,
            max_width.saturating_sub(badge_width + 12),
            10,
            badge_width,
            22,
            secondary,
        );
        draw_text_with_shadow(
            &mut image,
            font,
            PxScale::from(11.0),
            (max_width.saturating_sub(badge_width + 2) as f32, 15.0),
            &badge_text,
            THUMBNAIL_TEXT_COLOR,
        );
    }

    if shader_mode {
        let profile = build_shader_profile(&content);
        let sphere_size = max_width.min(max_height).saturating_mul(30) / 100;
        let sphere_left = max_width.saturating_sub(sphere_size + 18);
        let sphere_top = 64;
        draw_shader_sphere(
            &mut image,
            sphere_left,
            sphere_top.min(max_height.saturating_sub(sphere_size + 12)),
            sphere_size,
            &profile,
        );
    }

    let preview_lines = {
        let lines = collect_text_thumbnail_preview_lines(&content, 4);
        if lines.is_empty() {
            vec![if shader_mode {
                "Shader source preview".to_string()
            } else {
                "Empty source file".to_string()
            }]
        } else {
            lines
        }
    };
    if let Some(font) = mono_font.as_ref() {
        let line_height = if shader_mode { 24 } else { 22 };
        let text_scale = if shader_mode { 13.0 } else { 13.5 };
        let text_max_chars = if shader_mode { 16 } else { 22 };
        let preview_text_left = 42;
        let preview_line_left = 22;
        let preview_start_y = preview_panel_top + 26;
        for (index, line) in preview_lines.iter().enumerate() {
            let y = preview_start_y + (index as u32 * line_height);
            if y + line_height as u32 >= preview_panel_bottom {
                break;
            }
            let line_color = text_thumbnail_line_color(line, accent);
            fill_rect(
                &mut image,
                preview_line_left,
                y + 6,
                preview_line_left + 10,
                y + 16,
                line_color,
            );
            draw_text_with_shadow(
                &mut image,
                font,
                PxScale::from(text_scale),
                (preview_text_left as f32, y as f32),
                &truncate_text(line, text_max_chars),
                line_color,
            );
        }
    } else {
        draw_text_thumbnail_fallback_bars(&mut image, preview_panel_top, accent, shader_mode);
    }

    encode_rgba_image_as_png(&image)
}

fn render_code_thumbnail_card_png(
    input_path: &Path,
    content: &str,
    extension: &str,
    accent: Rgba<u8>,
    max_width: u32,
    max_height: u32,
) -> Result<Vec<u8>, String> {
    let mut image = RgbaImage::from_pixel(max_width, max_height, THUMBNAIL_CODE_BACKGROUND);
    let header_height = max_height.min(34);
    let body_top = header_height.saturating_add(8);
    let body_left: u32 = 12;
    let body_right = max_width.saturating_sub(12);
    let body_bottom = max_height.saturating_sub(12);
    let gutter_right = body_left.saturating_add(42).min(body_right);

    fill_rect(
        &mut image,
        0,
        0,
        max_width,
        max_height,
        THUMBNAIL_CODE_BACKGROUND,
    );
    fill_rect(
        &mut image,
        0,
        0,
        max_width,
        header_height,
        THUMBNAIL_CODE_HEADER,
    );
    fill_rect(
        &mut image,
        0,
        header_height.saturating_sub(1),
        max_width,
        header_height,
        THUMBNAIL_CODE_BORDER,
    );
    fill_rect(
        &mut image,
        body_left,
        body_top,
        body_right,
        body_bottom,
        THUMBNAIL_CODE_PANEL,
    );
    fill_rect(
        &mut image,
        body_left.saturating_add(1),
        body_top.saturating_add(1),
        body_right.saturating_sub(1),
        body_bottom.saturating_sub(1),
        THUMBNAIL_CODE_PANEL_ALT,
    );
    fill_rect(
        &mut image,
        body_left,
        body_top,
        gutter_right,
        body_bottom,
        THUMBNAIL_CODE_GUTTER,
    );
    fill_rect(
        &mut image,
        body_left,
        body_top,
        body_left.saturating_add(1),
        body_bottom,
        accent,
    );
    fill_rect(
        &mut image,
        body_left,
        body_top,
        body_right,
        body_top.saturating_add(1),
        THUMBNAIL_CODE_BORDER,
    );
    fill_rect(
        &mut image,
        body_left,
        body_bottom.saturating_sub(1),
        body_right,
        body_bottom,
        THUMBNAIL_CODE_BORDER,
    );
    fill_rect(
        &mut image,
        body_right.saturating_sub(1),
        body_top,
        body_right,
        body_bottom,
        THUMBNAIL_CODE_BORDER,
    );

    let sans_font = load_thumbnail_font(ThumbnailFontSpec {
        family: Family::SansSerif,
    })
    .ok();
    let mono_font = load_thumbnail_font(ThumbnailFontSpec {
        family: Family::Monospace,
    })
    .ok();

    if let Some(font) = sans_font.as_ref() {
        let title = input_path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("code");
        draw_text_with_shadow(
            &mut image,
            font,
            PxScale::from(13.5),
            (16.0, 9.0),
            &truncate_text(title, 28),
            THUMBNAIL_CODE_TEXT,
        );

        let badge_text = if extension.is_empty() {
            "TEXT".to_string()
        } else {
            extension.to_ascii_uppercase()
        };
        let badge_width = 18 + (badge_text.len() as u32 * 8);
        let badge_left = max_width.saturating_sub(badge_width + 12);
        fill_rounded_badge(
            &mut image,
            badge_left,
            8,
            badge_width,
            20,
            tint_color(accent, 0.24, 16),
        );
        draw_text_with_shadow(
            &mut image,
            font,
            PxScale::from(10.5),
            (badge_left.saturating_add(10) as f32, 13.0),
            &badge_text,
            THUMBNAIL_CODE_TEXT,
        );
    }

    let preview_lines = {
        let lines = collect_text_thumbnail_preview_lines(content, 5);
        if lines.is_empty() {
            vec![
                "use crate::code_preview;".to_string(),
                "fn render_snippet() {".to_string(),
                "    println!(\"empty file\");".to_string(),
                "}".to_string(),
            ]
        } else {
            lines
        }
    };

    if let Some(font) = mono_font.as_ref() {
        let line_height = 19;
        let line_number_scale = PxScale::from(9.5);
        let text_scale = PxScale::from(11.5);
        let line_number_x = body_left.saturating_add(12) as f32;
        let marker_x = body_left.saturating_add(25) as i32;
        let text_x = body_left.saturating_add(40) as f32;
        let text_max_chars = if max_width >= 320 { 30 } else { 24 };
        let preview_start_y = body_top.saturating_add(10);

        for (index, line) in preview_lines.iter().enumerate() {
            let y = preview_start_y + (index as u32 * line_height);
            if y + line_height >= body_bottom {
                break;
            }

            let line_color = code_thumbnail_syntax_color(line);
            draw_filled_circle_mut(&mut image, (marker_x, y as i32 + 8), 3, line_color);
            draw_text_with_shadow(
                &mut image,
                font,
                line_number_scale,
                (line_number_x, y as f32 + 1.0),
                &(index + 1).to_string(),
                THUMBNAIL_CODE_LINE_NUMBER,
            );
            draw_text_with_shadow(
                &mut image,
                font,
                text_scale,
                (text_x, y as f32),
                &truncate_text(line, text_max_chars),
                line_color,
            );
        }
    } else {
        draw_text_thumbnail_fallback_bars(&mut image, body_top, accent, false);
    }

    encode_rgba_image_as_png(&image)
}

fn render_audio_thumbnail_png(
    input_path: &Path,
    max_width: u32,
    max_height: u32,
) -> Result<Vec<u8>, String> {
    let analysis = analyze_audio_file_native(input_path)?;
    let mut image = RgbaImage::from_pixel(max_width, max_height, THUMBNAIL_DEFAULT_BACKGROUND);
    draw_vertical_gradient(&mut image, Rgba([7, 10, 16, 255]), Rgba([14, 24, 36, 255]));
    fill_rect(
        &mut image,
        0,
        0,
        max_width,
        max_height.min(38),
        Rgba([12, 18, 27, 235]),
    );
    if let Ok(font) = load_thumbnail_font(ThumbnailFontSpec {
        family: Family::SansSerif,
    }) {
        let title = input_path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("audio");
        draw_text_with_shadow(
            &mut image,
            &font,
            PxScale::from(14.0),
            (14.0, 9.0),
            &truncate_text(title, 26),
            THUMBNAIL_TEXT_COLOR,
        );
        let subtitle = format!(
            "{:.1}s · {} ch · {} Hz",
            analysis.duration_seconds,
            analysis.channels.unwrap_or(0),
            analysis.sample_rate_hz.unwrap_or(0)
        );
        draw_text_with_shadow(
            &mut image,
            &font,
            PxScale::from(9.5),
            (14.0, 24.0),
            &subtitle,
            THUMBNAIL_MUTED_TEXT_COLOR,
        );
    }

    let waveform_top = 46;
    let waveform_height = max_height.saturating_sub(waveform_top + 16);
    let baseline = waveform_top + waveform_height / 2;
    let bucket_count = analysis.waveform_buckets.len().max(1) as u32;
    let spectral_len = analysis.spectral_bands.len().max(1) as u32;
    for (index, bucket) in analysis.waveform_buckets.iter().enumerate() {
        let x = 10 + (index as u32 * max_width.saturating_sub(20)) / bucket_count;
        let band_index = ((index as u32 * spectral_len) / bucket_count) as usize;
        let energy = analysis
            .spectral_bands
            .get(band_index.min(analysis.spectral_bands.len().saturating_sub(1)))
            .copied()
            .unwrap_or(0.15)
            .clamp(0.0, 1.0);
        let color = lerp_rgba(
            Rgba([69, 153, 255, 210]),
            Rgba([255, 107, 107, 230]),
            band_index as f32 / spectral_len.max(1) as f32,
        );
        let peak_height = ((waveform_height as f64 * 0.42) * bucket.peak_level.clamp(0.0, 1.0))
            .round()
            .max(1.0) as i32;
        let rms_height = ((waveform_height as f64 * 0.32) * bucket.rms_level.clamp(0.0, 1.0))
            .round()
            .max(1.0) as i32;
        draw_line_segment_mut(
            &mut image,
            (x as f32, (baseline as i32 - peak_height) as f32),
            (x as f32, (baseline as i32 + peak_height) as f32),
            with_alpha(color, (110.0 + energy as f32 * 90.0) as u8),
        );
        draw_line_segment_mut(
            &mut image,
            (x as f32, (baseline as i32 - rms_height) as f32),
            (x as f32, (baseline as i32 + rms_height) as f32),
            with_alpha(THUMBNAIL_WAVEFORM_COLOR, 220),
        );
    }
    draw_line_segment_mut(
        &mut image,
        (10.0, baseline as f32),
        (max_width.saturating_sub(10) as f32, baseline as f32),
        Rgba([255, 255, 255, 30]),
    );
    encode_rgba_image_as_png(&image)
}

fn render_audio_thumbnail_png_with_runtime(
    gpu_runtime: Option<&crate::gpu_runtime::GpuRuntimeManager>,
    input_path: &Path,
    max_width: u32,
    max_height: u32,
) -> Result<Vec<u8>, String> {
    if let Some(gpu_runtime) = gpu_runtime {
        if let Ok((mono_samples, _sample_rate_hz)) =
            crate::audio_engine::decode_audio_preview_mono_samples(input_path)
        {
            if let Ok(image) =
                gpu_runtime.render_audio_thumbnail(&mono_samples, max_width, max_height)
            {
                return encode_rgba_image_as_png(&image);
            }
        }
    }

    render_audio_thumbnail_png(input_path, max_width, max_height)
}

fn build_video_thumbnail_artifact(
    app: &AppHandle,
    request: &NormalizedThumbnailRequest,
) -> Result<ExplorerThumbnailArtifact, String> {
    let poster_path =
        ensure_cached_static_thumbnail_path(app, request, "video-poster", "png", || {
            render_video_poster_png(&request.input_path, request.max_width, request.max_height)
        })?;
    let poster =
        register_thumbnail_artifact_descriptor(app, request, "thumbnail.poster", &poster_path)?;
    let mut hover_frames = Vec::new();
    let mut hover_frame_delay_ms = None;
    if request.include_video_hover_scrub {
        let frame_paths = build_and_render_video_hover_frame_paths(
            app,
            request,
            request.video_hover_frame_count,
        )?;
        hover_frame_delay_ms = Some(150);
        hover_frames = frame_paths
            .into_iter()
            .map(|path| {
                register_thumbnail_artifact_descriptor(app, request, "thumbnail.hover-frame", &path)
            })
            .collect::<Result<Vec<_>, String>>()?;
    }
    let artifact = ExplorerThumbnailArtifact {
        entity_id: request.entity_id.clone(),
        content_revision: request.content_revision.clone(),
        kind: ExplorerThumbnailKind::Video,
        poster,
        hover_frames,
        hover_frame_delay_ms,
    };
    persist_thumbnail_artifact_record(app, request, &artifact, "video-poster")?;
    Ok(artifact)
}

fn render_video_poster_png(
    input_path: &Path,
    max_width: u32,
    max_height: u32,
) -> Result<Vec<u8>, String> {
    let duration = probe_video_duration_seconds(input_path).unwrap_or(0.0);
    let timestamp = if duration > 0.15 {
        (duration * THUMBNAIL_VIDEO_POSTER_RATIO).clamp(0.0, duration.max(0.15))
    } else {
        0.0
    };
    let temp = tempfile_path_for_render("video-poster.png");
    generate_video_frame_png(input_path, &temp, max_width, max_height, timestamp)?;
    let png = fs::read(&temp).map_err(|error| {
        format!(
            "Failed to read generated video poster '{}': {error}",
            temp.display()
        )
    })?;
    let _ = fs::remove_file(temp);
    Ok(png)
}

fn build_and_render_video_hover_frame_paths(
    app: &AppHandle,
    request: &NormalizedThumbnailRequest,
    frame_count: u32,
) -> Result<Vec<PathBuf>, String> {
    let frame_paths = build_video_hover_frame_artifact_paths(app, request, frame_count)?;
    let duration = probe_video_duration_seconds(&request.input_path).unwrap_or(0.0);
    let timestamps = sample_video_timestamps(duration, frame_count);
    for (index, frame_path) in frame_paths.iter().enumerate() {
        if frame_path.exists() {
            continue;
        }
        if let Some(parent) = frame_path.parent() {
            fs::create_dir_all(parent).map_err(|error| {
                format!(
                    "Failed to create video hover cache directory '{}': {error}",
                    parent.display()
                )
            })?;
        }
        generate_video_frame_png(
            &request.input_path,
            frame_path,
            request.max_width,
            request.max_height,
            *timestamps.get(index).unwrap_or(&0.0),
        )?;
    }
    Ok(frame_paths)
}

fn sample_video_timestamps(duration_seconds: f64, frame_count: u32) -> Vec<f64> {
    if frame_count <= 1 {
        return vec![(duration_seconds * THUMBNAIL_VIDEO_POSTER_RATIO).max(0.0)];
    }
    if duration_seconds <= 0.1 {
        return (0..frame_count).map(|_| 0.0).collect();
    }
    let start = duration_seconds * THUMBNAIL_VIDEO_TIMESTAMPS_START_RATIO;
    let end = duration_seconds * THUMBNAIL_VIDEO_TIMESTAMPS_END_RATIO;
    let span = (end - start).max(0.01);
    (0..frame_count)
        .map(|index| {
            let alpha = index as f64 / (frame_count - 1) as f64;
            (start + (span * alpha)).clamp(0.0, duration_seconds)
        })
        .collect()
}

fn resolve_ffmpeg_binary() -> String {
    std::env::var("GREEBLEFS_FFMPEG_BINARY")
        .or_else(|_| std::env::var("OVERLAYTERM_FFMPEG_BINARY"))
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| DEFAULT_FFMPEG_BINARY.to_string())
}

fn resolve_ffprobe_binary() -> String {
    std::env::var("GREEBLEFS_FFPROBE_BINARY")
        .or_else(|_| std::env::var("OVERLAYTERM_FFPROBE_BINARY"))
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| DEFAULT_FFPROBE_BINARY.to_string())
}

fn probe_video_duration_seconds(input_path: &Path) -> Option<f64> {
    let ffprobe_binary = resolve_ffprobe_binary();
    let ffprobe_output = Command::new(&ffprobe_binary)
        .args([
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            &input_path.to_string_lossy(),
        ])
        .output();
    if let Ok(output) = ffprobe_output {
        if output.status.success() {
            let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if let Ok(parsed) = value.parse::<f64>() {
                if parsed.is_finite() && parsed >= 0.0 {
                    return Some(parsed);
                }
            }
        }
    }

    let ffmpeg_binary = resolve_ffmpeg_binary();
    let ffmpeg_output = Command::new(&ffmpeg_binary)
        .args(["-i", &input_path.to_string_lossy()])
        .output()
        .ok()?;
    let stderr = String::from_utf8_lossy(&ffmpeg_output.stderr);
    parse_ffmpeg_duration(stderr.as_ref())
}

fn parse_ffmpeg_duration(stderr: &str) -> Option<f64> {
    let marker = "Duration:";
    let index = stderr.find(marker)?;
    let duration = stderr[index + marker.len()..].split(',').next()?.trim();
    let mut parts = duration.split(':');
    let hours = parts.next()?.trim().parse::<f64>().ok()?;
    let minutes = parts.next()?.trim().parse::<f64>().ok()?;
    let seconds = parts.next()?.trim().parse::<f64>().ok()?;
    Some((hours * 3600.0) + (minutes * 60.0) + seconds)
}

fn generate_video_frame_png(
    input_path: &Path,
    output_path: &Path,
    max_width: u32,
    max_height: u32,
    timestamp_seconds: f64,
) -> Result<(), String> {
    let ffmpeg_binary = resolve_ffmpeg_binary();
    let filter = VIDEO_FRAME_FILTER_TEMPLATE
        .replace("{width}", &max_width.to_string())
        .replace("{height}", &max_height.to_string());
    let mut command = Command::new(&ffmpeg_binary);
    command.args(["-hide_banner", "-loglevel", "error", "-y"]);
    if timestamp_seconds > 0.0 {
        command.args(["-ss", &format!("{timestamp_seconds:.3}")]);
    }
    command.args(["-i", &input_path.to_string_lossy()]);
    command.args([
        "-frames:v",
        "1",
        "-vf",
        &filter,
        &output_path.to_string_lossy(),
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
        return Err(format!("Video thumbnail generation failed: {message}"));
    }
    Ok(())
}

fn tempfile_path_for_render(file_name: &str) -> PathBuf {
    std::env::temp_dir().join(format!(
        "greeblefs-thumbnail-{}-{}",
        uuid::Uuid::new_v4(),
        file_name
    ))
}

fn extension_accent_color(extension: &str) -> Rgba<u8> {
    let normalized = if extension.is_empty() {
        "txt"
    } else {
        extension
    };
    let mut hasher = Sha256::new();
    hasher.update(normalized.as_bytes());
    let digest = hasher.finalize();
    Rgba([
        72_u8.saturating_add(digest[0] % 120),
        92_u8.saturating_add(digest[1] % 100),
        110_u8.saturating_add(digest[2] % 100),
        255,
    ])
}

fn build_shader_profile(source: &str) -> ShaderProfile {
    let mut hasher = Sha256::new();
    hasher.update(source.as_bytes());
    let digest = hasher.finalize();
    let keyword_weight = [
        source.matches("time").count() as f32,
        source.matches("texture").count() as f32,
        source.matches("sin").count() as f32 + source.matches("cos").count() as f32,
    ];
    let palette = [
        Rgba([
            58 + digest[0] % 90,
            82 + digest[1] % 110,
            120 + digest[2] % 100,
            255,
        ]),
        Rgba([
            90 + digest[3] % 120,
            60 + digest[4] % 90,
            120 + digest[5] % 110,
            255,
        ]),
        Rgba([
            40 + digest[6] % 120,
            110 + digest[7] % 110,
            90 + digest[8] % 120,
            255,
        ]),
    ];
    ShaderProfile {
        palette,
        stripe_frequency: 3.0 + (digest[9] as f32 / 255.0 * 8.0) + keyword_weight[2].min(6.0),
        stripe_mix: 0.25 + (digest[10] as f32 / 255.0 * 0.45),
        fresnel_strength: 0.22 + (keyword_weight[1].min(5.0) * 0.03),
        highlight_strength: 0.36 + (digest[11] as f32 / 255.0 * 0.4),
    }
}

fn draw_shader_sphere(
    image: &mut RgbaImage,
    left: u32,
    top: u32,
    size: u32,
    profile: &ShaderProfile,
) {
    if size < 24 {
        return;
    }
    let radius = size as f32 / 2.0;
    let center_x = left as f32 + radius;
    let center_y = top as f32 + radius;
    let shadow_color = Rgba([0, 0, 0, 120]);
    draw_filled_circle_mut(
        image,
        (center_x.round() as i32 + 6, center_y.round() as i32 + 8),
        radius.round() as i32,
        shadow_color,
    );

    for y in top..top.saturating_add(size).min(image.height()) {
        for x in left..left.saturating_add(size).min(image.width()) {
            let nx = (x as f32 + 0.5 - center_x) / radius;
            let ny = (y as f32 + 0.5 - center_y) / radius;
            let distance_sq = nx * nx + ny * ny;
            if distance_sq > 1.0 {
                continue;
            }
            let nz = (1.0 - distance_sq).sqrt();
            let stripe = (((nx * profile.stripe_frequency) + (ny * 1.4) + (nz * 1.8)) * PI).sin();
            let stripe_mix = (stripe * 0.5 + 0.5).clamp(0.0, 1.0);
            let fresnel = (1.0 - nz).powf(3.2) * profile.fresnel_strength;
            let diffuse = (0.25 + (nz * 0.75)).clamp(0.0, 1.0);
            let light_dir = normalize_vec3((0.48, -0.58, 0.66));
            let view_dir = (0.0, 0.0, 1.0);
            let normal = normalize_vec3((nx, ny, nz));
            let ndotl = dot_vec3(normal, light_dir).max(0.0);
            let reflected = reflect_vec3((-light_dir.0, -light_dir.1, -light_dir.2), normal);
            let specular =
                dot_vec3(reflected, view_dir).max(0.0).powf(24.0) * profile.highlight_strength;
            let base = lerp_rgba(profile.palette[0], profile.palette[1], stripe_mix);
            let shaded = lerp_rgba(base, profile.palette[2], fresnel + profile.stripe_mix * 0.1);
            let lit = brighten_color(shaded, diffuse * 0.28 + ndotl * 0.42 + specular * 0.6);
            image.put_pixel(x, y, lit);
        }
    }
}

fn draw_text_thumbnail_fallback_bars(
    image: &mut RgbaImage,
    top: u32,
    accent: Rgba<u8>,
    shader_mode: bool,
) {
    let line_count = if shader_mode { 6 } else { 6 };
    for index in 0..line_count {
        let y = top + 14 + index * 20;
        if y + 10 >= image.height() {
            break;
        }
        let width = image.width().saturating_sub(64 + (index as u32 * 11 % 56));
        fill_rect(image, 18, y, 30, y + 10, tint_color(accent, 0.24, 42));
        fill_rect(
            image,
            42,
            y,
            42 + width,
            y + 10,
            if index % 2 == 0 {
                THUMBNAIL_TEXT_COLOR
            } else {
                THUMBNAIL_MUTED_TEXT_COLOR
            },
        );
    }
}

fn code_thumbnail_syntax_color(line: &str) -> Rgba<u8> {
    let trimmed = line.trim_start();
    if trimmed.is_empty() {
        return THUMBNAIL_CODE_COMMENT;
    }
    if trimmed.starts_with("//")
        || trimmed.starts_with("/*")
        || trimmed.starts_with('*')
        || trimmed.starts_with("<!--")
        || trimmed.starts_with('#')
    {
        return THUMBNAIL_CODE_COMMENT;
    }
    if trimmed.starts_with("use ")
        || trimmed.starts_with("import ")
        || trimmed.starts_with("from ")
        || trimmed.starts_with("const ")
        || trimmed.starts_with("let ")
        || trimmed.starts_with("var ")
        || trimmed.starts_with("pub ")
        || trimmed.starts_with("fn ")
        || trimmed.starts_with("def ")
        || trimmed.starts_with("class ")
        || trimmed.starts_with("export ")
        || trimmed.starts_with("type ")
        || trimmed.starts_with("interface ")
        || trimmed.starts_with("struct ")
        || trimmed.starts_with("enum ")
        || trimmed.starts_with("fn(")
    {
        return THUMBNAIL_CODE_KEYWORD;
    }
    if trimmed.contains('"') || trimmed.contains('\'') {
        return THUMBNAIL_CODE_STRING;
    }
    if trimmed.chars().any(|character| character.is_ascii_digit()) {
        return THUMBNAIL_CODE_NUMBER;
    }
    if trimmed.contains(':') || trimmed.contains("=>") || trimmed.contains("->") {
        return THUMBNAIL_CODE_PROPERTY;
    }
    THUMBNAIL_TEXT_COLOR
}

fn collect_text_thumbnail_preview_lines(content: &str, max_lines: usize) -> Vec<String> {
    content
        .lines()
        .map(|line| line.replace('\t', "    ").trim_end().to_string())
        .filter(|line| !line.trim().is_empty())
        .take(max_lines)
        .collect()
}

fn text_thumbnail_line_color(line: &str, accent: Rgba<u8>) -> Rgba<u8> {
    let trimmed = line.trim_start();
    if trimmed.is_empty() {
        return THUMBNAIL_MUTED_TEXT_COLOR;
    }
    if trimmed.starts_with("//")
        || trimmed.starts_with("/*")
        || trimmed.starts_with('*')
        || trimmed.starts_with("<!--")
    {
        return THUMBNAIL_MUTED_TEXT_COLOR;
    }
    if trimmed.starts_with('#') {
        return accent;
    }
    if trimmed.starts_with("use ")
        || trimmed.starts_with("import ")
        || trimmed.starts_with("from ")
        || trimmed.starts_with("const ")
        || trimmed.starts_with("let ")
        || trimmed.starts_with("pub ")
        || trimmed.starts_with("fn ")
        || trimmed.starts_with("def ")
        || trimmed.starts_with("class ")
        || trimmed.starts_with("export ")
        || trimmed.starts_with("return ")
    {
        return THUMBNAIL_TEXT_COLOR;
    }
    tint_color(THUMBNAIL_TEXT_COLOR, 0.08, 0)
}

fn load_thumbnail_font(spec: ThumbnailFontSpec) -> Result<FontArc, String> {
    let cache = match spec.family {
        Family::Monospace => &THUMBNAIL_MONO_FONT_CACHE,
        _ => &THUMBNAIL_SANS_FONT_CACHE,
    };
    let mut cache_guard = cache
        .lock()
        .map_err(|_| "Failed to lock thumbnail font cache.".to_string())?;
    if let Some(font) = cache_guard.as_ref() {
        return Ok(font.clone());
    }

    let mut database = Database::new();
    database.load_system_fonts();
    let query = Query {
        families: &[spec.family],
        ..Query::default()
    };
    let face_id = database
        .query(&query)
        .ok_or_else(|| "Failed to locate a system font for thumbnail rendering.".to_string())?;
    let face = database
        .face(face_id)
        .ok_or_else(|| "Resolved thumbnail font face is unavailable.".to_string())?;

    let bytes = match &face.source {
        Source::Binary(data) => data.as_ref().as_ref().to_vec(),
        Source::File(path) => fs::read(path).map_err(|error| {
            format!(
                "Failed to read thumbnail font '{}': {error}",
                path.display()
            )
        })?,
        Source::SharedFile(path, _) => fs::read(path).map_err(|error| {
            format!(
                "Failed to read thumbnail font '{}': {error}",
                path.display()
            )
        })?,
    };
    let font = FontArc::try_from_vec(bytes)
        .map_err(|_| "Failed to decode the system font used for thumbnails.".to_string())?;
    *cache_guard = Some(font.clone());
    Ok(font)
}

fn draw_text_with_shadow(
    image: &mut RgbaImage,
    font: &FontArc,
    scale: PxScale,
    origin: (f32, f32),
    text: &str,
    color: Rgba<u8>,
) {
    let x = origin.0.round() as i32;
    let y = origin.1.round() as i32;
    draw_text_mut(
        image,
        THUMBNAIL_SHADOW_TEXT_COLOR,
        x + 1,
        y + 1,
        scale,
        font,
        text,
    );
    draw_text_mut(image, color, x, y, scale, font, text);
}

fn fill_rect(image: &mut RgbaImage, left: u32, top: u32, right: u32, bottom: u32, color: Rgba<u8>) {
    let bounded_right = right.min(image.width());
    let bounded_bottom = bottom.min(image.height());
    for y in top.min(image.height())..bounded_bottom {
        for x in left.min(image.width())..bounded_right {
            image.put_pixel(x, y, color);
        }
    }
}

fn draw_vertical_gradient(image: &mut RgbaImage, top_color: Rgba<u8>, bottom_color: Rgba<u8>) {
    let height = image.height().max(1);
    for y in 0..image.height() {
        let alpha = y as f32 / height as f32;
        let row_color = lerp_rgba(top_color, bottom_color, alpha);
        for x in 0..image.width() {
            image.put_pixel(x, y, row_color);
        }
    }
}

fn fill_rounded_badge(
    image: &mut RgbaImage,
    left: u32,
    top: u32,
    width: u32,
    height: u32,
    color: Rgba<u8>,
) {
    let radius = (height / 2) as i32;
    fill_rect(
        image,
        left.saturating_add(radius as u32),
        top,
        left.saturating_add(width).saturating_sub(radius as u32),
        top.saturating_add(height),
        color,
    );
    draw_filled_circle_mut(
        image,
        (
            left.saturating_add(radius as u32) as i32,
            top.saturating_add(radius as u32) as i32,
        ),
        radius,
        color,
    );
    draw_filled_circle_mut(
        image,
        (
            left.saturating_add(width).saturating_sub(radius as u32) as i32,
            top.saturating_add(radius as u32) as i32,
        ),
        radius,
        color,
    );
}

fn truncate_text(text: &str, max_chars: usize) -> String {
    let trimmed = text.trim();
    if trimmed.chars().count() <= max_chars {
        return trimmed.to_string();
    }
    let mut output = trimmed
        .chars()
        .take(max_chars.saturating_sub(1))
        .collect::<String>();
    output.push('…');
    output
}

fn tint_color(color: Rgba<u8>, mix: f32, lift: u8) -> Rgba<u8> {
    let clamped_mix = mix.clamp(0.0, 1.0);
    let mix_channel = |channel: u8| -> u8 {
        let mixed = channel as f32 * (1.0 - clamped_mix) + 255.0 * clamped_mix;
        mixed.round().clamp(0.0, 255.0) as u8
    };
    Rgba([
        mix_channel(color[0]).saturating_add(lift),
        mix_channel(color[1]).saturating_add(lift),
        mix_channel(color[2]).saturating_add(lift),
        color[3],
    ])
}

fn brighten_color(color: Rgba<u8>, amount: f32) -> Rgba<u8> {
    let clamped = amount.clamp(0.0, 1.2);
    Rgba([
        ((color[0] as f32) * (1.0 + clamped)).clamp(0.0, 255.0) as u8,
        ((color[1] as f32) * (1.0 + clamped)).clamp(0.0, 255.0) as u8,
        ((color[2] as f32) * (1.0 + clamped)).clamp(0.0, 255.0) as u8,
        color[3],
    ])
}

fn with_alpha(color: Rgba<u8>, alpha: u8) -> Rgba<u8> {
    Rgba([color[0], color[1], color[2], alpha])
}

fn lerp_rgba(start: Rgba<u8>, end: Rgba<u8>, amount: f32) -> Rgba<u8> {
    let alpha = amount.clamp(0.0, 1.0);
    let lerp_channel = |a: u8, b: u8| -> u8 {
        ((a as f32) + ((b as f32 - a as f32) * alpha))
            .round()
            .clamp(0.0, 255.0) as u8
    };
    Rgba([
        lerp_channel(start[0], end[0]),
        lerp_channel(start[1], end[1]),
        lerp_channel(start[2], end[2]),
        lerp_channel(start[3], end[3]),
    ])
}

fn dot_vec3(left: (f32, f32, f32), right: (f32, f32, f32)) -> f32 {
    (left.0 * right.0) + (left.1 * right.1) + (left.2 * right.2)
}

fn normalize_vec3(input: (f32, f32, f32)) -> (f32, f32, f32) {
    let length = (input.0 * input.0 + input.1 * input.1 + input.2 * input.2).sqrt();
    if length <= f32::EPSILON {
        return (0.0, 0.0, 1.0);
    }
    (input.0 / length, input.1 / length, input.2 / length)
}

fn reflect_vec3(input: (f32, f32, f32), normal: (f32, f32, f32)) -> (f32, f32, f32) {
    let dot = dot_vec3(input, normal);
    (
        input.0 - 2.0 * dot * normal.0,
        input.1 - 2.0 * dot * normal.1,
        input.2 - 2.0 * dot * normal.2,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::RgbaImage;
    use tempfile::tempdir;

    #[test]
    fn sample_video_timestamps_spans_the_clip() {
        let timestamps = sample_video_timestamps(120.0, 6);
        assert_eq!(timestamps.len(), 6);
        assert!(timestamps.first().copied().unwrap_or_default() >= 9.0);
        assert!(timestamps.last().copied().unwrap_or_default() <= 111.0);
    }

    #[test]
    fn parse_ffmpeg_duration_handles_standard_output() {
        let stderr = "Duration: 00:01:42.53, start: 0.000000, bitrate: 4143 kb/s";
        let duration = parse_ffmpeg_duration(stderr).expect("duration");
        assert!((duration - 102.53).abs() < 0.01);
    }

    #[test]
    fn render_code_thumbnail_png_returns_png_bytes() {
        let workspace = tempdir().expect("tempdir");
        let file_path = workspace.path().join("sample.rs");
        fs::write(&file_path, "fn main() {\n    println!(\"hello\");\n}\n").expect("write");
        let png = render_code_thumbnail_png(&file_path, 320, 180).expect("thumbnail png");
        let decoded = image::load_from_memory(&png).expect("decode png");
        assert_eq!(decoded.width(), 320);
        assert_eq!(decoded.height(), 180);
    }

    #[test]
    fn render_shader_thumbnail_png_returns_png_bytes() {
        let workspace = tempdir().expect("tempdir");
        let file_path = workspace.path().join("material.glsl");
        fs::write(
            &file_path,
            "void mainImage(out vec4 fragColor, in vec2 fragCoord) {\n  float t = sin(iTime);\n  fragColor = vec4(vec3(t), 1.0);\n}\n",
        )
        .expect("write");
        let png = render_shader_thumbnail_png(&file_path, 320, 180).expect("thumbnail png");
        let decoded = image::load_from_memory(&png).expect("decode png");
        assert_eq!(decoded.width(), 320);
        assert_eq!(decoded.height(), 180);
    }

    #[test]
    fn collect_text_thumbnail_preview_lines_skips_blank_lines_and_expands_tabs() {
        let lines =
            collect_text_thumbnail_preview_lines("fn main() {\n\n\tprintln!(\"hello\");\n}\n", 4);
        assert_eq!(
            lines,
            vec![
                "fn main() {".to_string(),
                "    println!(\"hello\");".to_string(),
                "}".to_string(),
            ]
        );
    }

    #[test]
    fn build_image_thumbnail_data_url_returns_png_data_url() {
        let workspace = tempdir().expect("tempdir");
        let file_path = workspace.path().join("sample.png");
        let image = RgbaImage::from_pixel(640, 480, Rgba([32, 48, 96, 255]));
        image.save(&file_path).expect("save image");
        let data_url =
            build_image_thumbnail_data_url(&file_path, 256, 256).expect("thumbnail data url");
        assert!(data_url.starts_with("data:image/png;base64,"));
    }
}
