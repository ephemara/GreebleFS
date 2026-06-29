use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub enum BackendPreference {
  #[default]
  Auto,
  DirectComposition,
  LegacyOwnedWindow,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum EmbeddingBackendKind {
  DirectComposition,
  LegacyOwnedWindow,
  Unsupported,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum LaunchStatus {
  Starting,
  Attached,
  Hidden,
  Exited,
  Failed,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct ReservedInsets {
  pub top: i32,
  pub right: i32,
  pub bottom: i32,
  pub left: i32,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WindowSurfaceBounds {
  pub x: i32,
  pub y: i32,
  pub width: i32,
  pub height: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutableSpec {
  pub id: String,
  #[serde(default, alias = "name")]
  pub display_name: Option<String>,
  #[serde(default, alias = "executablePath")]
  pub executable_path: String,
  #[serde(default)]
  pub args: Vec<String>,
  #[serde(default, alias = "workingDirectory")]
  pub working_directory: Option<String>,
  #[serde(default, alias = "backendPreference")]
  pub backend_preference: BackendPreference,
  #[serde(default)]
  pub short_name: Option<String>,
  #[serde(default)]
  pub icon: Option<String>,
  #[serde(default)]
  pub color: Option<String>,
  #[serde(flatten)]
  pub extra: HashMap<String, serde_json::Value>,
}

impl ExecutableSpec {
  #[cfg_attr(not(windows), allow(dead_code))]
  pub fn display_name(&self) -> &str {
    self
      .display_name
      .as_deref()
      .or(self.short_name.as_deref())
      .unwrap_or(&self.id)
  }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct WindowMgrManifest {
  #[serde(default, alias = "apps")]
  pub executables: Vec<ExecutableSpec>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowMgrSessionRequest {
  pub host_window_label: String,
  pub session_id: String,
  pub executable_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowMgrInlineSessionRequest {
  pub host_window_label: String,
  pub session_id: String,
  pub executable_spec: ExecutableSpec,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowMgrSessionLocator {
  pub host_window_label: String,
  pub session_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowMgrBoundsUpdateRequest {
  pub host_window_label: String,
  pub session_id: String,
  pub bounds: WindowSurfaceBounds,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowMgrReservedInsetsRequest {
  pub host_window_label: String,
  pub session_id: String,
  pub reserved_insets: ReservedInsets,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowMgrSessionInfo {
  pub host_window_label: String,
  pub session_id: String,
  pub executable_id: String,
  pub backend_kind: EmbeddingBackendKind,
  pub pid: Option<u32>,
  pub hwnd: Option<u64>,
  pub visible: bool,
  pub launch_status: LaunchStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowMgrErrorPayload {
  pub host_window_label: String,
  pub session_id: String,
  pub error: WindowMgrError,
}

#[derive(Debug, Clone, Serialize, Deserialize, thiserror::Error)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum WindowMgrError {
  #[error("{message}")]
  UnsupportedPlatform { message: String },
  #[error("{message}")]
  ExecutableLaunchFailed { message: String },
  #[error("{message}")]
  HwndNotFound { message: String },
  #[error("{message}")]
  BackendInitFailed { message: String },
  #[error("{message}")]
  SessionNotFound { message: String },
  #[error("{message}")]
  ManifestValidationFailed { message: String },
}

impl WindowMgrError {
  pub fn unsupported() -> Self {
    Self::UnsupportedPlatform {
      message: "windowmgr executable embedding is only supported on Windows".to_string(),
    }
  }
}
