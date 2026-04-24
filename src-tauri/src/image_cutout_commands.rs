use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::UNIX_EPOCH;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};

use crate::python_commands::PythonRuntimeConfig;
use crate::python_sidecar::{self, PythonSidecarDecodedActionResponse};
use crate::screenshot_commands::copy_rgba_image_to_clipboard;

const IMAGE_CUTOUT_STAGE_DIR: &str = "image-cutout-staging";
const DEFAULT_IMAGE_CUTOUT_PREVIEW_MAX_DIMENSION: u32 = 1280;
static IMAGE_CUTOUT_STAGE_SEQUENCE: AtomicU64 = AtomicU64::new(1);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum ImageCutoutPromptKind {
    Positive,
    Negative,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ImageCutoutPromptPoint {
    pub x_norm: f32,
    pub y_norm: f32,
    pub kind: ImageCutoutPromptKind,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ImageCutoutPreviewMask {
    pub data_url: String,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ImageCutoutProviderDiagnostics {
    pub provider_kind: String,
    pub backend_kind: String,
    pub model_id: Option<String>,
    pub provider_model_id: Option<String>,
    pub family: Option<String>,
    pub message: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ImageCutoutSessionOpenRequest {
    pub input_path: Option<String>,
    pub input_data_url: Option<String>,
    pub logical_output_path: Option<String>,
    pub preview_max_dimension: Option<u32>,
    pub config: Option<PythonRuntimeConfig>,
    pub model_id: Option<String>,
    pub backend_preference: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ImageCutoutApplyPromptsRequest {
    pub session_id: String,
    pub prompts: Vec<ImageCutoutPromptPoint>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ImageCutoutResetSessionRequest {
    pub session_id: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ImageCutoutExportFilterState {
    pub brightness: f32,
    pub contrast: f32,
    pub saturate: f32,
    pub hue_rotate: f32,
    pub grayscale: f32,
    pub sepia: f32,
    pub invert: f32,
    pub blur: f32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum ImageCutoutExportMode {
    Staging,
    SiblingPng,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ImageCutoutStageExportRequest {
    pub session_id: String,
    pub export_mode: ImageCutoutExportMode,
    pub logical_output_path: Option<String>,
    pub filters: Option<ImageCutoutExportFilterState>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ImageCutoutCopyToClipboardRequest {
    pub session_id: String,
    pub logical_output_path: Option<String>,
    pub filters: Option<ImageCutoutExportFilterState>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ImageCutoutSessionSnapshot {
    pub session_id: String,
    pub preview_mask: ImageCutoutPreviewMask,
    pub cutout_preview_data_url: String,
    pub preview_width: u32,
    pub preview_height: u32,
    pub prompt_count: usize,
    pub can_undo: bool,
    pub can_redo: bool,
    pub diagnostics: ImageCutoutProviderDiagnostics,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ImageCutoutStagedExportArtifact {
    pub session_id: String,
    pub mode: ImageCutoutExportMode,
    pub output_path: String,
    pub file_name: String,
    pub width: u32,
    pub height: u32,
}

#[derive(Clone, Default)]
pub struct ImageCutoutManager {
    inner: Arc<ImageCutoutManagerInner>,
}

#[derive(Default)]
struct ImageCutoutManagerInner {
    next_session_id: AtomicU64,
    sessions: Mutex<HashMap<String, ImageCutoutSession>>,
}

#[derive(Clone)]
struct ImageCutoutSession {
    logical_output_path: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PythonImageCutoutOpenSessionPayload {
    session_id: String,
    input_path: Option<String>,
    input_data_url: Option<String>,
    logical_output_path: Option<String>,
    preview_max_dimension: u32,
    model_id: Option<String>,
    backend_preference: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PythonImageCutoutApplyPromptsPayload {
    session_id: String,
    prompts: Vec<ImageCutoutPromptPoint>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PythonImageCutoutSessionIdPayload {
    session_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PythonImageCutoutStageExportPayload {
    session_id: String,
    output_path: String,
    filters: Option<ImageCutoutExportFilterState>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PythonImageCutoutSessionSnapshot {
    session_id: String,
    preview_mask_data_url: String,
    cutout_preview_data_url: String,
    preview_width: u32,
    preview_height: u32,
    prompt_count: usize,
    diagnostics: PythonImageCutoutDiagnostics,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PythonImageCutoutDiagnostics {
    provider_kind: String,
    backend_kind: String,
    model_id: Option<String>,
    provider_model_id: Option<String>,
    family: Option<String>,
    message: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PythonImageCutoutStageExportResult {
    output_path: String,
    width: u32,
    height: u32,
}

#[tauri::command]
#[specta::specta]
pub async fn image_cutout_open_session(
    app: AppHandle,
    manager: State<'_, ImageCutoutManager>,
    request: ImageCutoutSessionOpenRequest,
) -> Result<ImageCutoutSessionSnapshot, String> {
    let manager = manager.inner().clone();
    tauri::async_runtime::spawn_blocking(move || manager.open_session(app, request))
        .await
        .map_err(|error| format!("Image cutout open-session task failed to join: {error}"))?
}

#[tauri::command]
#[specta::specta]
pub async fn image_cutout_apply_prompts(
    app: AppHandle,
    manager: State<'_, ImageCutoutManager>,
    request: ImageCutoutApplyPromptsRequest,
) -> Result<ImageCutoutSessionSnapshot, String> {
    let manager = manager.inner().clone();
    tauri::async_runtime::spawn_blocking(move || manager.apply_prompts(app, request))
        .await
        .map_err(|error| format!("Image cutout prompt task failed to join: {error}"))?
}

#[tauri::command]
#[specta::specta]
pub async fn image_cutout_reset_session(
    app: AppHandle,
    manager: State<'_, ImageCutoutManager>,
    request: ImageCutoutResetSessionRequest,
) -> Result<ImageCutoutSessionSnapshot, String> {
    let manager = manager.inner().clone();
    tauri::async_runtime::spawn_blocking(move || manager.reset_session(app, request))
        .await
        .map_err(|error| format!("Image cutout reset task failed to join: {error}"))?
}

#[tauri::command]
#[specta::specta]
pub async fn image_cutout_stage_export(
    app: AppHandle,
    manager: State<'_, ImageCutoutManager>,
    request: ImageCutoutStageExportRequest,
) -> Result<ImageCutoutStagedExportArtifact, String> {
    let manager = manager.inner().clone();
    tauri::async_runtime::spawn_blocking(move || manager.stage_export(app, request))
        .await
        .map_err(|error| format!("Image cutout stage-export task failed to join: {error}"))?
}

#[tauri::command]
#[specta::specta]
pub async fn image_cutout_copy_to_clipboard(
    app: AppHandle,
    manager: State<'_, ImageCutoutManager>,
    request: ImageCutoutCopyToClipboardRequest,
) -> Result<ImageCutoutStagedExportArtifact, String> {
    let manager = manager.inner().clone();
    tauri::async_runtime::spawn_blocking(move || manager.copy_to_clipboard(app, request))
        .await
        .map_err(|error| format!("Image cutout clipboard task failed to join: {error}"))?
}

#[tauri::command]
#[specta::specta]
pub fn image_cutout_close_session(
    app: AppHandle,
    manager: State<'_, ImageCutoutManager>,
    session_id: String,
) -> Result<(), String> {
    manager.close_session(app, session_id)
}

impl ImageCutoutManager {
    fn open_session(
        &self,
        app: AppHandle,
        request: ImageCutoutSessionOpenRequest,
    ) -> Result<ImageCutoutSessionSnapshot, String> {
        validate_cutout_input(&request)?;
        let session_id = format!(
            "image-cutout-{}",
            self.inner.next_session_id.fetch_add(1, Ordering::Relaxed) + 1
        );
        let preview_max_dimension = request
            .preview_max_dimension
            .unwrap_or(DEFAULT_IMAGE_CUTOUT_PREVIEW_MAX_DIMENSION)
            .clamp(256, 2048);
        let logical_output_path = normalize_optional_output_path(request.logical_output_path.clone());

        let PythonSidecarDecodedActionResponse { result, .. }: PythonSidecarDecodedActionResponse<
            PythonImageCutoutSessionSnapshot,
        > = python_sidecar::call_sidecar_action_json(
            &app,
            request.config.clone(),
            python_sidecar::action_ids::IMAGE_CUTOUT_OPEN_SESSION,
            Some(PythonImageCutoutOpenSessionPayload {
                session_id: session_id.clone(),
                input_path: request.input_path.clone(),
                input_data_url: request.input_data_url.clone(),
                logical_output_path: logical_output_path.clone(),
                preview_max_dimension,
                model_id: request.model_id.clone(),
                backend_preference: request.backend_preference.clone(),
            }),
            None,
            None,
            Some(true),
        )?;

        self.inner
            .sessions
            .lock()
            .map_err(|_| "Image cutout session map was poisoned.".to_string())?
            .insert(
                session_id.clone(),
                ImageCutoutSession {
                    logical_output_path,
                },
            );

        Ok(build_cutout_snapshot(result))
    }

    fn apply_prompts(
        &self,
        app: AppHandle,
        request: ImageCutoutApplyPromptsRequest,
    ) -> Result<ImageCutoutSessionSnapshot, String> {
        let session_id = request.session_id.trim().to_string();
        self.get_session(&session_id)?;

        let PythonSidecarDecodedActionResponse { result, .. }: PythonSidecarDecodedActionResponse<
            PythonImageCutoutSessionSnapshot,
        > = python_sidecar::call_sidecar_action_json(
            &app,
            None,
            python_sidecar::action_ids::IMAGE_CUTOUT_APPLY_PROMPTS,
            Some(PythonImageCutoutApplyPromptsPayload {
                session_id,
                prompts: request.prompts,
            }),
            None,
            None,
            Some(true),
        )?;

        Ok(build_cutout_snapshot(result))
    }

    fn reset_session(
        &self,
        app: AppHandle,
        request: ImageCutoutResetSessionRequest,
    ) -> Result<ImageCutoutSessionSnapshot, String> {
        let session_id = request.session_id.trim().to_string();
        self.get_session(&session_id)?;

        let PythonSidecarDecodedActionResponse { result, .. }: PythonSidecarDecodedActionResponse<
            PythonImageCutoutSessionSnapshot,
        > = python_sidecar::call_sidecar_action_json(
            &app,
            None,
            python_sidecar::action_ids::IMAGE_CUTOUT_RESET_SESSION,
            Some(PythonImageCutoutSessionIdPayload { session_id }),
            None,
            None,
            Some(true),
        )?;

        Ok(build_cutout_snapshot(result))
    }

    fn stage_export(
        &self,
        app: AppHandle,
        request: ImageCutoutStageExportRequest,
    ) -> Result<ImageCutoutStagedExportArtifact, String> {
        let session_id = request.session_id.trim().to_string();
        let session = self.get_session(&session_id)?;
        let output_path = match request.export_mode {
            ImageCutoutExportMode::Staging => {
                let stage_root = resolve_cutout_stage_root(&app)?;
                create_cutout_stage_path(
                    &stage_root,
                    request
                        .logical_output_path
                        .as_deref()
                        .or(session.logical_output_path.as_deref()),
                )?
            }
            ImageCutoutExportMode::SiblingPng => resolve_cutout_sibling_output_path(
                request
                    .logical_output_path
                    .as_deref()
                    .or(session.logical_output_path.as_deref()),
            )?,
        };
        self.stage_export_to_path(
            app,
            &session_id,
            output_path,
            request.export_mode,
            request.filters,
        )
    }

    fn copy_to_clipboard(
        &self,
        app: AppHandle,
        request: ImageCutoutCopyToClipboardRequest,
    ) -> Result<ImageCutoutStagedExportArtifact, String> {
        let export = self.stage_export(
            app.clone(),
            ImageCutoutStageExportRequest {
                session_id: request.session_id.clone(),
                export_mode: ImageCutoutExportMode::Staging,
                logical_output_path: request.logical_output_path.clone(),
                filters: request.filters,
            },
        )?;
        let image = image::ImageReader::open(&export.output_path)
            .map_err(|error| {
                format!(
                    "Failed to open staged image cutout '{}': {error}",
                    export.output_path
                )
            })?
            .decode()
            .map_err(|error| {
                format!(
                    "Failed to decode staged image cutout '{}': {error}",
                    export.output_path
                )
            })?
            .to_rgba8();
        copy_rgba_image_to_clipboard(image)?;
        Ok(export)
    }

    fn close_session(&self, app: AppHandle, session_id: String) -> Result<(), String> {
        let trimmed_session_id = session_id.trim().to_string();
        self.inner
            .sessions
            .lock()
            .map_err(|_| "Image cutout session map was poisoned.".to_string())?
            .remove(trimmed_session_id.as_str());

        let _ = python_sidecar::call_sidecar_action_json::<_, serde_json::Value>(
            &app,
            None,
            python_sidecar::action_ids::IMAGE_CUTOUT_CLOSE_SESSION,
            Some(PythonImageCutoutSessionIdPayload {
                session_id: trimmed_session_id,
            }),
            None,
            None,
            Some(true),
        );

        Ok(())
    }

    fn get_session(&self, session_id: &str) -> Result<ImageCutoutSession, String> {
        self.inner
            .sessions
            .lock()
            .map_err(|_| "Image cutout session map was poisoned.".to_string())?
            .get(session_id)
            .cloned()
            .ok_or_else(|| format!("Image cutout session was not found: {session_id}"))
    }

    fn stage_export_to_path(
        &self,
        app: AppHandle,
        session_id: &str,
        output_path: PathBuf,
        mode: ImageCutoutExportMode,
        filters: Option<ImageCutoutExportFilterState>,
    ) -> Result<ImageCutoutStagedExportArtifact, String> {
        let output_path_string = output_path.to_string_lossy().to_string();
        let PythonSidecarDecodedActionResponse { result, .. }: PythonSidecarDecodedActionResponse<
            PythonImageCutoutStageExportResult,
        > = python_sidecar::call_sidecar_action_json(
            &app,
            None,
            python_sidecar::action_ids::IMAGE_CUTOUT_STAGE_EXPORT,
            Some(PythonImageCutoutStageExportPayload {
                session_id: session_id.to_string(),
                output_path: output_path_string,
                filters,
            }),
            None,
            None,
            Some(true),
        )?;

        let file_name = Path::new(&result.output_path)
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("cutout.png")
            .to_string();

        Ok(ImageCutoutStagedExportArtifact {
            session_id: session_id.to_string(),
            mode,
            output_path: result.output_path,
            file_name,
            width: result.width,
            height: result.height,
        })
    }
}

fn build_cutout_snapshot(snapshot: PythonImageCutoutSessionSnapshot) -> ImageCutoutSessionSnapshot {
    let prompt_count = snapshot.prompt_count;
    let preview_width = snapshot.preview_width;
    let preview_height = snapshot.preview_height;
    ImageCutoutSessionSnapshot {
        session_id: snapshot.session_id,
        preview_mask: ImageCutoutPreviewMask {
            data_url: snapshot.preview_mask_data_url,
            width: preview_width,
            height: preview_height,
        },
        cutout_preview_data_url: snapshot.cutout_preview_data_url,
        preview_width,
        preview_height,
        prompt_count,
        can_undo: prompt_count > 0,
        can_redo: false,
        diagnostics: ImageCutoutProviderDiagnostics {
            provider_kind: snapshot.diagnostics.provider_kind,
            backend_kind: snapshot.diagnostics.backend_kind,
            model_id: snapshot.diagnostics.model_id,
            provider_model_id: snapshot.diagnostics.provider_model_id,
            family: snapshot.diagnostics.family,
            message: snapshot.diagnostics.message,
        },
    }
}

fn validate_cutout_input(request: &ImageCutoutSessionOpenRequest) -> Result<(), String> {
    let has_input_path = request
        .input_path
        .as_deref()
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false);
    let has_input_data_url = request
        .input_data_url
        .as_deref()
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false);
    if !has_input_path && !has_input_data_url {
        return Err(
            "Image cutout session open requires either an inputPath or inputDataUrl.".to_string(),
        );
    }
    Ok(())
}

fn normalize_optional_output_path(path: Option<String>) -> Option<String> {
    path.and_then(|value| {
        let trimmed = value.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    })
}

fn resolve_cutout_stage_root(app: &AppHandle) -> Result<PathBuf, String> {
    let root = app
        .path()
        .app_local_data_dir()
        .map(|path| path.join(IMAGE_CUTOUT_STAGE_DIR))
        .map_err(|error| format!("Failed to resolve cutout staging directory: {error}"))?;
    resolve_cutout_stage_root_under(&root)
}

fn resolve_cutout_stage_root_under(root: &Path) -> Result<PathBuf, String> {
    fs::create_dir_all(root).map_err(|error| {
        format!(
            "Failed to create image cutout staging directory '{}': {error}",
            root.display()
        )
    })?;
    Ok(root.to_path_buf())
}

fn create_cutout_stage_path(
    stage_root: &Path,
    logical_output_path: Option<&str>,
) -> Result<PathBuf, String> {
    let created_at = current_timestamp_millis()?;
    let sequence = IMAGE_CUTOUT_STAGE_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    let file_stem = sanitize_cutout_file_stem(
        logical_output_path
            .and_then(cutout_source_file_stem)
            .unwrap_or("cutout"),
    );
    Ok(stage_root.join(format!(
        "{file_stem}-{created_at}-{sequence}.png"
    )))
}

fn resolve_cutout_sibling_output_path(logical_output_path: Option<&str>) -> Result<PathBuf, String> {
    let source_path = normalize_local_output_source_path(logical_output_path)?;
    let parent = source_path.parent().ok_or_else(|| {
        format!(
            "Image cutout could not resolve a sibling directory for '{}'.",
            source_path.display()
        )
    })?;
    let cutout_stem = sanitize_cutout_file_stem(
        cutout_source_file_stem(logical_output_path.unwrap_or_default()).unwrap_or("cutout"),
    );
    Ok(parent.join(format!("{cutout_stem}.cutout.png")))
}

fn normalize_local_output_source_path(logical_output_path: Option<&str>) -> Result<PathBuf, String> {
    let candidate = logical_output_path
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| {
            "Image cutout save/export requires a local source path for sibling naming.".to_string()
        })?;
    if candidate.contains("://") {
        return Err(
            "Image cutout sibling export only supports local filesystem paths right now."
                .to_string(),
        );
    }
    let path = PathBuf::from(candidate);
    if !path.is_absolute() {
        return Err("Image cutout sibling export requires an absolute local path.".to_string());
    }
    Ok(path)
}

fn cutout_source_file_stem(logical_output_path: &str) -> Option<&str> {
    Path::new(logical_output_path)
        .file_stem()
        .and_then(|value| value.to_str())
        .filter(|value| !value.trim().is_empty())
        .map(|value| value.trim_end_matches(".cutout"))
}

fn sanitize_cutout_file_stem(value: &str) -> String {
    let sanitized = value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() {
                character.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect::<String>()
        .split('-')
        .filter(|segment| !segment.is_empty())
        .collect::<Vec<_>>()
        .join("-");

    if sanitized.is_empty() {
        "cutout".to_string()
    } else {
        sanitized
    }
}

fn current_timestamp_millis() -> Result<u128, String> {
    Ok(std::time::SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("Failed to measure current time: {error}"))?
        .as_millis())
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use super::{
        create_cutout_stage_path, normalize_local_output_source_path,
        resolve_cutout_sibling_output_path, resolve_cutout_stage_root_under,
        sanitize_cutout_file_stem, ImageCutoutManager,
    };
    use tempfile::tempdir;

    #[test]
    fn stage_root_creation_stays_within_requested_root() {
        let tempdir = tempdir().expect("cutout stage tempdir");
        let root = resolve_cutout_stage_root_under(tempdir.path()).expect("stage root");
        let stage_path =
            create_cutout_stage_path(&root, Some("/tmp/Dog Portrait.png")).expect("stage path");
        assert!(stage_path.starts_with(&root));
        assert_eq!(
            stage_path.extension().and_then(|value| value.to_str()),
            Some("png")
        );
    }

    #[test]
    fn sibling_export_uses_cutout_suffix_and_local_parent() {
        let output_path =
            resolve_cutout_sibling_output_path(Some("/tmp/Forest Shot.webp")).expect("sibling");
        assert_eq!(output_path, PathBuf::from("/tmp/forest-shot.cutout.png"));
    }

    #[test]
    fn invalid_sibling_output_paths_are_rejected() {
        assert!(normalize_local_output_source_path(Some("cloud://asset.png")).is_err());
        assert!(normalize_local_output_source_path(Some("relative/path.png")).is_err());
        assert!(resolve_cutout_sibling_output_path(None).is_err());
    }

    #[test]
    fn missing_session_lookup_is_rejected() {
        let manager = ImageCutoutManager::default();
        assert!(manager.get_session("missing-session").is_err());
    }

    #[test]
    fn sanitize_cutout_file_stem_normalizes_ascii_tokens() {
        assert_eq!(sanitize_cutout_file_stem("Dog Portrait 01"), "dog-portrait-01");
        assert_eq!(sanitize_cutout_file_stem(""), "cutout");
    }
}
