pub mod artifacts;
pub mod binary;
pub mod resources;
pub mod streams;

use artifacts::{ArtifactRegistry, RegisterArtifactPathRequest};
use greeble_ipc_contracts::{
    IpcArtifactDescriptor, IpcRegisterArtifactPathRequest, IpcResourceHandle, IpcStreamHandle,
};
use resources::ResourceRegistry;
use std::path::PathBuf;
use streams::StreamRegistry;
use tauri::State;

#[derive(Default)]
pub struct IpcRuntimeState {
    artifacts: ArtifactRegistry,
    resources: ResourceRegistry,
    streams: StreamRegistry,
}

impl IpcRuntimeState {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn register_artifact_path(
        &self,
        request: RegisterArtifactPathRequest,
    ) -> Result<IpcArtifactDescriptor, String> {
        self.artifacts.register_path(request)
    }

    pub fn release_artifact(&self, id: &str) -> Result<(), String> {
        self.artifacts.release(id)
    }

    pub fn register_resource(
        &self,
        kind: &str,
        stable_key: Option<&str>,
    ) -> Result<IpcResourceHandle, String> {
        self.resources.register(kind, stable_key)
    }

    pub fn release_resource(&self, id: &str) -> Result<(), String> {
        self.resources.release(id)
    }

    pub fn register_stream(
        &self,
        kind: &str,
        stable_key: Option<&str>,
    ) -> Result<IpcStreamHandle, String> {
        self.streams.register(kind, stable_key)
    }

    pub fn release_stream(&self, id: &str) -> Result<(), String> {
        self.streams.release(id)
    }

    pub fn next_stream_packet_metadata(
        &self,
        id: &str,
    ) -> Result<greeble_ipc_contracts::IpcStreamPacketMetadata, String> {
        self.streams.next_packet_metadata(id)
    }
}

#[tauri::command]
#[specta::specta]
pub async fn ipc_register_artifact_path(
    state: State<'_, IpcRuntimeState>,
    request: IpcRegisterArtifactPathRequest,
) -> Result<IpcArtifactDescriptor, String> {
    let trimmed_file_path = request.file_path.trim();
    if trimmed_file_path.is_empty() {
        return Err("IPC artifact registration requires a non-empty filePath.".to_string());
    }

    state.register_artifact_path(RegisterArtifactPathRequest {
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
    state: State<'_, IpcRuntimeState>,
    id: String,
) -> Result<(), String> {
    state.release_artifact(&id)
}

#[tauri::command]
#[specta::specta]
pub async fn ipc_release_resource(
    state: State<'_, IpcRuntimeState>,
    id: String,
) -> Result<(), String> {
    state.release_resource(&id)
}

#[tauri::command]
#[specta::specta]
pub async fn ipc_release_stream(
    state: State<'_, IpcRuntimeState>,
    id: String,
) -> Result<(), String> {
    state.release_stream(&id)
}
