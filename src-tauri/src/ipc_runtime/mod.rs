pub mod artifacts;
pub mod binary;
pub mod resources;
pub mod streams;

use crate::message_ring::{MessageRingWriteOutcome, MessageStreamsPolicy};
use artifacts::{ArtifactRegistry, RegisterArtifactPathRequest};
use greeble_ipc_contracts::{
    IpcArtifactDescriptor, IpcRegisterArtifactPathRequest, IpcResourceHandle, IpcStreamHandle,
};
use resources::ResourceRegistry;
use std::path::PathBuf;
use streams::{IpcStreamReplayResponse, IpcStreamStatus, StreamRegistry};
use tauri::State;

pub struct IpcRuntimeState {
    artifacts: ArtifactRegistry,
    resources: ResourceRegistry,
    streams: StreamRegistry,
}

impl IpcRuntimeState {
    pub fn new() -> Self {
        Self::with_message_stream_policy(MessageStreamsPolicy::default())
    }

    pub fn with_message_stream_policy(message_stream_policy: MessageStreamsPolicy) -> Self {
        Self {
            artifacts: ArtifactRegistry::default(),
            resources: ResourceRegistry::default(),
            streams: StreamRegistry::new(message_stream_policy),
        }
    }

    #[cfg(not(test))]
    pub fn from_app(app: &tauri::AppHandle) -> Self {
        Self::with_message_stream_policy(MessageStreamsPolicy::from_app(app))
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

    pub fn publish_stream_packet<TPayload, TBuild>(
        &self,
        id: &str,
        build: TBuild,
    ) -> Result<(TPayload, MessageRingWriteOutcome), String>
    where
        TPayload: serde::Serialize,
        TBuild: FnOnce(greeble_ipc_contracts::IpcStreamPacketMetadata) -> Result<TPayload, String>,
    {
        self.streams.publish_packet(id, build)
    }

    pub fn replay_stream(
        &self,
        id: &str,
        from_sequence: Option<u64>,
        limit: Option<usize>,
    ) -> Result<IpcStreamReplayResponse, String> {
        self.streams.replay(id, from_sequence, limit)
    }

    pub fn stream_status(&self, id: &str) -> Result<IpcStreamStatus, String> {
        self.streams.status(id)
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

#[tauri::command]
#[specta::specta]
pub async fn ipc_replay_stream(
    state: State<'_, IpcRuntimeState>,
    id: String,
    from_sequence: Option<u64>,
    limit: Option<usize>,
) -> Result<IpcStreamReplayResponse, String> {
    state.replay_stream(&id, from_sequence, limit)
}

#[tauri::command]
#[specta::specta]
pub async fn ipc_get_stream_status(
    state: State<'_, IpcRuntimeState>,
    id: String,
) -> Result<IpcStreamStatus, String> {
    state.stream_status(&id)
}
