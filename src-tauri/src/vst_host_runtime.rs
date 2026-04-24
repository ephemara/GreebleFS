use std::collections::HashMap;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::{AppHandle, Manager};
use uuid::Uuid;
use vst_host::HeadlessVstHost;

use crate::audio_engine::AudioDeckId;

#[derive(Default)]
pub struct VstHostRuntimeManager {
    sessions: Mutex<HashMap<String, VstEditorSessionState>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum VstEditorAttachMode {
    Inline,
    Detached,
    Unavailable,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct VstEditorHostRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub scale_factor: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct VstEditorSessionState {
    pub session_id: String,
    pub deck_id: AudioDeckId,
    pub plugin_path: String,
    pub attach_mode: VstEditorAttachMode,
    pub status_label: String,
    pub last_rect: Option<VstEditorHostRect>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct VstEditorSessionCreateRequest {
    pub deck_id: AudioDeckId,
    pub plugin_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct VstEditorSessionRectRequest {
    pub session_id: String,
    pub rect: VstEditorHostRect,
}

fn manager(app: &AppHandle) -> tauri::State<'_, VstHostRuntimeManager> {
    app.state::<VstHostRuntimeManager>()
}

#[tauri::command]
#[specta::specta]
pub fn vst_host_create_editor_session(
    app: AppHandle,
    request: VstEditorSessionCreateRequest,
) -> Result<VstEditorSessionState, String> {
    let session_id = Uuid::new_v4().to_string();
    let (attach_mode, status_label) = match HeadlessVstHost::load_plugin(&request.plugin_path) {
        Ok(host) if host.edit_controller.is_some() => (
            VstEditorAttachMode::Unavailable,
            "Plugin editor controller loaded. Native editor attachment is not available in the current host bridge."
                .to_string(),
        ),
        Ok(_) => (
            VstEditorAttachMode::Unavailable,
            "Plugin loaded, but no editor controller was exposed by this VST3."
                .to_string(),
        ),
        Err(error) => (
            VstEditorAttachMode::Unavailable,
            format!("Failed to load the plugin into the native host bridge: {error}"),
        ),
    };

    let session = VstEditorSessionState {
        session_id: session_id.clone(),
        deck_id: request.deck_id,
        plugin_path: request.plugin_path,
        attach_mode,
        status_label,
        last_rect: None,
    };

    manager(&app)
        .sessions
        .lock()
        .map_err(|_| "VST host runtime session lock was poisoned.".to_string())?
        .insert(session_id, session.clone());

    Ok(session)
}

#[tauri::command]
#[specta::specta]
pub fn vst_host_update_editor_session_rect(
    app: AppHandle,
    request: VstEditorSessionRectRequest,
) -> Result<VstEditorSessionState, String> {
    let host_manager = manager(&app);
    let mut sessions = host_manager
        .sessions
        .lock()
        .map_err(|_| "VST host runtime session lock was poisoned.".to_string())?;
    let session = sessions
        .get_mut(&request.session_id)
        .ok_or_else(|| "Unknown VST editor session.".to_string())?;

    session.last_rect = Some(request.rect.clone());
    if request.rect.width > 0.0 && request.rect.height > 0.0 {
        session.status_label = format!(
            "Host rect synced to {:.0}×{:.0}. Native editor attachment remains unavailable in the current bridge.",
            request.rect.width, request.rect.height
        );
    }

    Ok(session.clone())
}

#[tauri::command]
#[specta::specta]
pub fn vst_host_focus_editor_session(
    app: AppHandle,
    session_id: String,
) -> Result<VstEditorSessionState, String> {
    let host_manager = manager(&app);
    let sessions = host_manager
        .sessions
        .lock()
        .map_err(|_| "VST host runtime session lock was poisoned.".to_string())?;
    sessions
        .get(&session_id)
        .cloned()
        .ok_or_else(|| "Unknown VST editor session.".to_string())
}

#[tauri::command]
#[specta::specta]
pub fn vst_host_destroy_editor_session(app: AppHandle, session_id: String) -> Result<(), String> {
    manager(&app)
        .sessions
        .lock()
        .map_err(|_| "VST host runtime session lock was poisoned.".to_string())?
        .remove(&session_id);
    Ok(())
}
