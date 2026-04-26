use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::UNIX_EPOCH;

use greeble_ipc_contracts::{IpcArtifactDescriptor, IpcArtifactRef};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

use crate::python_commands::PythonRuntimeConfig;
use crate::python_sidecar::{self, PythonSidecarDecodedActionResponse};
use crate::screenshot_commands::copy_rgba_image_to_clipboard;

const IMAGE_CUTOUT_STAGE_DIR: &str = "image-cutout-staging";
const DEFAULT_IMAGE_CUTOUT_PREVIEW_MAX_DIMENSION: u32 = 1280;
const PREVIEW_MASK_ARTIFACT_TOKEN: &str = "preview-mask";
const CUTOUT_PREVIEW_ARTIFACT_TOKEN: &str = "cutout-preview";
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
    pub artifact: IpcArtifactDescriptor,
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum ImageCutoutWorkflowMode {
    Cutout,
    RemoveBackground,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ImageCutoutSessionOpenRequest {
    pub input_path: Option<String>,
    pub input_artifact: Option<IpcArtifactRef>,
    pub input_data_url: Option<String>,
    pub logical_output_path: Option<String>,
    pub preview_max_dimension: Option<u32>,
    pub config: Option<PythonRuntimeConfig>,
    pub model_id: Option<String>,
    pub backend_preference: Option<String>,
    pub workflow_mode: ImageCutoutWorkflowMode,
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
    pub override_mask_artifact: Option<IpcArtifactRef>,
    pub override_mask_data_url: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ImageCutoutCopyToClipboardRequest {
    pub session_id: String,
    pub logical_output_path: Option<String>,
    pub filters: Option<ImageCutoutExportFilterState>,
    pub override_mask_artifact: Option<IpcArtifactRef>,
    pub override_mask_data_url: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ImageCutoutSessionSnapshot {
    pub session_id: String,
    pub preview_mask: ImageCutoutPreviewMask,
    pub cutout_preview_artifact: IpcArtifactDescriptor,
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
    workflow_mode: ImageCutoutWorkflowMode,
    preview_mask_artifact_id: Option<String>,
    cutout_preview_artifact_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PythonImageCutoutOpenSessionPayload {
    session_id: String,
    input_path: Option<String>,
    input_artifact_id: Option<String>,
    input_data_url: Option<String>,
    logical_output_path: Option<String>,
    preview_max_dimension: u32,
    model_id: Option<String>,
    backend_preference: Option<String>,
    workflow_mode: ImageCutoutWorkflowMode,
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
    override_mask_artifact_id: Option<String>,
    override_mask_data_url: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PythonImageCutoutSessionSnapshot {
    session_id: String,
    preview_mask_artifact_token: String,
    cutout_preview_artifact_token: String,
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
        let logical_output_path =
            normalize_optional_output_path(request.logical_output_path.clone());
        let workflow_mode = request.workflow_mode;

        let response: PythonSidecarDecodedActionResponse<PythonImageCutoutSessionSnapshot> =
            python_sidecar::call_sidecar_action_json_with_ipc(
            &app,
            request.config.clone(),
            python_sidecar::action_ids::IMAGE_CUTOUT_OPEN_SESSION,
            Some(PythonImageCutoutOpenSessionPayload {
                session_id: session_id.clone(),
                input_path: request.input_path.clone(),
                input_artifact_id: request.input_artifact.as_ref().map(|artifact| artifact.id.clone()),
                input_data_url: request.input_data_url.clone(),
                logical_output_path: logical_output_path.clone(),
                preview_max_dimension,
                model_id: request.model_id.clone(),
                backend_preference: request.backend_preference.clone(),
                workflow_mode,
            }),
            request.input_artifact.clone().map(|artifact| vec![artifact]),
            None,
            None,
            None,
            Some(true),
        )?;
        let snapshot = build_cutout_snapshot(
            response.result,
            &response.raw.output_artifacts,
            &response.raw.output_artifact_tokens,
        )?;

        let snapshot_artifact_ids = collect_snapshot_artifact_ids(&snapshot);
        let mut sessions = self
            .inner
            .sessions
            .lock()
            .map_err(|_| {
                release_ipc_artifacts(&app, &snapshot_artifact_ids);
                "Image cutout session map was poisoned.".to_string()
            })?;
        sessions.insert(
            session_id.clone(),
            ImageCutoutSession {
                logical_output_path,
                workflow_mode,
                preview_mask_artifact_id: Some(snapshot.preview_mask.artifact.id.clone()),
                cutout_preview_artifact_id: Some(snapshot.cutout_preview_artifact.id.clone()),
            },
        );

        Ok(snapshot)
    }

    fn apply_prompts(
        &self,
        app: AppHandle,
        request: ImageCutoutApplyPromptsRequest,
    ) -> Result<ImageCutoutSessionSnapshot, String> {
        let session_id = request.session_id.trim().to_string();
        self.get_session(&session_id)?;
        let session_id_for_update = session_id.clone();

        let response: PythonSidecarDecodedActionResponse<PythonImageCutoutSessionSnapshot> =
            python_sidecar::call_sidecar_action_json(
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
        let snapshot = build_cutout_snapshot(
            response.result,
            &response.raw.output_artifacts,
            &response.raw.output_artifact_tokens,
        )?;
        self.replace_session_preview_artifacts(&app, &session_id_for_update, &snapshot)?;
        Ok(snapshot)
    }

    fn reset_session(
        &self,
        app: AppHandle,
        request: ImageCutoutResetSessionRequest,
    ) -> Result<ImageCutoutSessionSnapshot, String> {
        let session_id = request.session_id.trim().to_string();
        self.get_session(&session_id)?;
        let session_id_for_update = session_id.clone();

        let response: PythonSidecarDecodedActionResponse<PythonImageCutoutSessionSnapshot> =
            python_sidecar::call_sidecar_action_json(
            &app,
            None,
            python_sidecar::action_ids::IMAGE_CUTOUT_RESET_SESSION,
            Some(PythonImageCutoutSessionIdPayload { session_id }),
            None,
            None,
            Some(true),
        )?;
        let snapshot = build_cutout_snapshot(
            response.result,
            &response.raw.output_artifacts,
            &response.raw.output_artifact_tokens,
        )?;
        self.replace_session_preview_artifacts(&app, &session_id_for_update, &snapshot)?;
        Ok(snapshot)
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
            request.override_mask_artifact,
            request.override_mask_data_url,
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
                override_mask_artifact: request.override_mask_artifact,
                override_mask_data_url: request.override_mask_data_url,
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
        let removed_session = self.inner
            .sessions
            .lock()
            .map_err(|_| "Image cutout session map was poisoned.".to_string())?
            .remove(trimmed_session_id.as_str());
        if let Some(session) = removed_session {
            release_ipc_artifacts(
                &app,
                &collect_session_preview_artifact_ids(&session),
            );
        }

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

    fn replace_session_preview_artifacts(
        &self,
        app: &AppHandle,
        session_id: &str,
        snapshot: &ImageCutoutSessionSnapshot,
    ) -> Result<(), String> {
        let new_artifact_ids = collect_snapshot_artifact_ids(snapshot);
        let previous_artifact_ids = {
            let mut sessions = self
                .inner
                .sessions
                .lock()
                .map_err(|_| {
                    release_ipc_artifacts(app, &new_artifact_ids);
                    "Image cutout session map was poisoned.".to_string()
                })?;
            let session = sessions
                .get_mut(session_id)
                .ok_or_else(|| {
                    release_ipc_artifacts(app, &new_artifact_ids);
                    format!("Image cutout session was not found: {session_id}")
                })?;
            let previous_artifact_ids = collect_session_preview_artifact_ids(session);
            session.preview_mask_artifact_id = Some(snapshot.preview_mask.artifact.id.clone());
            session.cutout_preview_artifact_id = Some(snapshot.cutout_preview_artifact.id.clone());
            previous_artifact_ids
        };

        release_ipc_artifacts(app, &previous_artifact_ids);
        Ok(())
    }

    fn stage_export_to_path(
        &self,
        app: AppHandle,
        session_id: &str,
        output_path: PathBuf,
        mode: ImageCutoutExportMode,
        filters: Option<ImageCutoutExportFilterState>,
        override_mask_artifact: Option<IpcArtifactRef>,
        override_mask_data_url: Option<String>,
    ) -> Result<ImageCutoutStagedExportArtifact, String> {
        let output_path_string = output_path.to_string_lossy().to_string();
        let response: PythonSidecarDecodedActionResponse<PythonImageCutoutStageExportResult> =
            python_sidecar::call_sidecar_action_json_with_ipc(
            &app,
            None,
            python_sidecar::action_ids::IMAGE_CUTOUT_STAGE_EXPORT,
            Some(PythonImageCutoutStageExportPayload {
                session_id: session_id.to_string(),
                output_path: output_path_string,
                filters,
                override_mask_artifact_id: override_mask_artifact
                    .as_ref()
                    .map(|artifact| artifact.id.clone()),
                override_mask_data_url,
            }),
            override_mask_artifact.map(|artifact| vec![artifact]),
            None,
            None,
            None,
            Some(true),
        )?;
        let result = response.result;

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

fn resolve_output_artifact_descriptor_by_token(
    output_artifacts: &[IpcArtifactDescriptor],
    output_artifact_tokens: &[Option<String>],
    token: &str,
    fallback_index: usize,
) -> Result<IpcArtifactDescriptor, String> {
    if let Some((index, _)) = output_artifact_tokens
        .iter()
        .enumerate()
        .find(|(_, candidate)| candidate.as_deref() == Some(token))
    {
        return output_artifacts
            .get(index)
            .cloned()
            .ok_or_else(|| format!("Python cutout artifact token was missing a descriptor: {token}"));
    }

    output_artifacts.get(fallback_index).cloned().ok_or_else(|| {
        format!(
            "Python cutout response did not include the expected artifact token or fallback index: {token}"
        )
    })
}

fn build_cutout_snapshot(
    snapshot: PythonImageCutoutSessionSnapshot,
    output_artifacts: &[IpcArtifactDescriptor],
    output_artifact_tokens: &[Option<String>],
) -> Result<ImageCutoutSessionSnapshot, String> {
    let prompt_count = snapshot.prompt_count;
    let preview_width = snapshot.preview_width;
    let preview_height = snapshot.preview_height;
    let preview_mask_artifact = resolve_output_artifact_descriptor_by_token(
        output_artifacts,
        output_artifact_tokens,
        snapshot.preview_mask_artifact_token.as_str(),
        0,
    )?;
    let cutout_preview_artifact = resolve_output_artifact_descriptor_by_token(
        output_artifacts,
        output_artifact_tokens,
        snapshot.cutout_preview_artifact_token.as_str(),
        1,
    )?;

    Ok(ImageCutoutSessionSnapshot {
        session_id: snapshot.session_id,
        preview_mask: ImageCutoutPreviewMask {
            artifact: preview_mask_artifact,
            width: preview_width,
            height: preview_height,
        },
        cutout_preview_artifact,
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
    })
}

fn collect_snapshot_artifact_ids(snapshot: &ImageCutoutSessionSnapshot) -> Vec<String> {
    vec![
        snapshot.preview_mask.artifact.id.clone(),
        snapshot.cutout_preview_artifact.id.clone(),
    ]
}

fn collect_session_preview_artifact_ids(session: &ImageCutoutSession) -> Vec<String> {
    session
        .preview_mask_artifact_id
        .iter()
        .chain(session.cutout_preview_artifact_id.iter())
        .cloned()
        .collect()
}

fn release_ipc_artifacts(app: &AppHandle, artifact_ids: &[String]) {
    let ipc_runtime = app.state::<crate::ipc_runtime::IpcRuntimeState>();
    for artifact_id in artifact_ids {
        let _ = ipc_runtime.release_artifact(artifact_id);
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
    let has_input_artifact = request
        .input_artifact
        .as_ref()
        .map(|artifact| !artifact.id.trim().is_empty() && !artifact.file_path.trim().is_empty())
        .unwrap_or(false);
    if !has_input_path && !has_input_data_url && !has_input_artifact {
        return Err("Image cutout session open requires an inputPath, inputArtifact, or inputDataUrl.".to_string());
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
    Ok(stage_root.join(format!("{file_stem}-{created_at}-{sequence}.png")))
}

fn resolve_cutout_sibling_output_path(
    logical_output_path: Option<&str>,
) -> Result<PathBuf, String> {
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

fn normalize_local_output_source_path(
    logical_output_path: Option<&str>,
) -> Result<PathBuf, String> {
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
    use serde_json::json;
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
        assert_eq!(
            sanitize_cutout_file_stem("Dog Portrait 01"),
            "dog-portrait-01"
        );
        assert_eq!(sanitize_cutout_file_stem(""), "cutout");
    }

    #[test]
    fn open_request_carries_workflow_mode() {
        let request = super::ImageCutoutSessionOpenRequest {
            input_path: Some("/tmp/sample.png".to_string()),
            input_artifact: None,
            input_data_url: None,
            logical_output_path: None,
            preview_max_dimension: None,
            config: None,
            model_id: None,
            backend_preference: None,
            workflow_mode: super::ImageCutoutWorkflowMode::RemoveBackground,
        };
        assert_eq!(
            request.workflow_mode,
            super::ImageCutoutWorkflowMode::RemoveBackground
        );
    }

    #[test]
    fn workflow_mode_serializes_with_camel_case_contract() {
        let serialized = serde_json::to_value(super::ImageCutoutWorkflowMode::RemoveBackground)
            .expect("serialize workflow mode");
        assert_eq!(serialized, json!("removeBackground"));
    }
}
