use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum IpcArtifactRetention {
    Ephemeral,
    Persistent,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct IpcRegisterArtifactPathRequest {
    pub kind: String,
    pub file_path: String,
    pub media_type: Option<String>,
    pub retention: IpcArtifactRetention,
    pub identity_key: Option<String>,
    pub content_revision: Option<String>,
    pub delete_on_release: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct IpcArtifactRef {
    pub id: String,
    pub kind: String,
    pub file_path: String,
    pub media_type: Option<String>,
    pub identity_key: Option<String>,
    pub content_revision: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct IpcArtifactDescriptor {
    pub id: String,
    pub kind: String,
    pub file_path: String,
    pub media_type: Option<String>,
    pub byte_length: Option<u64>,
    pub retention: IpcArtifactRetention,
    pub identity_key: Option<String>,
    pub content_revision: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct IpcResourceHandle {
    pub id: String,
    pub kind: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct IpcStreamHandle {
    pub id: String,
    pub kind: String,
    pub event_name: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct IpcStreamPacketMetadata {
    pub stream_id: String,
    pub sequence: u64,
    pub emitted_at_epoch_ms: u64,
}
