pub mod artifacts;
pub mod binary;

use artifacts::{ArtifactRegistry, RegisterArtifactPathRequest};
use greeble_ipc_contracts::{IpcArtifactDescriptor, IpcRegisterArtifactPathRequest};
use std::path::PathBuf;
use tauri::{AppHandle, State};

pub struct IpcRuntimeState {
    artifacts: ArtifactRegistry,
}

impl IpcRuntimeState {
    pub fn new() -> Self {
        Self {
            artifacts: ArtifactRegistry::default(),
        }
    }

    #[cfg(not(test))]
    pub fn from_app(_app: &AppHandle) -> Self {
        Self::new()
    }

    pub fn register_artifact_path(
        &self,
        app: &AppHandle,
        request: RegisterArtifactPathRequest,
    ) -> Result<IpcArtifactDescriptor, String> {
        self.artifacts.register_path(app, request)
    }

    pub fn release_artifact(&self, app: &AppHandle, id: &str) -> Result<(), String> {
        self.artifacts.release(app, id)
    }

    pub fn artifact_path(&self, id: &str) -> Result<Option<PathBuf>, String> {
        self.artifacts.artifact_path(id)
    }
}

impl Default for IpcRuntimeState {
    fn default() -> Self {
        Self::new()
    }
}

#[tauri::command]
#[specta::specta]
pub async fn ipc_register_artifact_path(
    app: AppHandle,
    state: State<'_, IpcRuntimeState>,
    request: IpcRegisterArtifactPathRequest,
) -> Result<IpcArtifactDescriptor, String> {
    let trimmed_file_path = request.file_path.trim();
    if trimmed_file_path.is_empty() {
        return Err("IPC artifact registration requires a non-empty filePath.".to_string());
    }

    state.register_artifact_path(&app, RegisterArtifactPathRequest {
        kind: request.kind,
        file_path: PathBuf::from(trimmed_file_path),
        media_type: request.media_type,
        retention: request.retention,
        identity_key: request.identity_key,
        content_revision: request.content_revision,
        delete_on_release: request.delete_on_release,
    })
}

#[tauri::command]
#[specta::specta]
pub async fn ipc_release_artifact(
    app: AppHandle,
    state: State<'_, IpcRuntimeState>,
    id: String,
) -> Result<(), String> {
    state.release_artifact(&app, &id)
}
