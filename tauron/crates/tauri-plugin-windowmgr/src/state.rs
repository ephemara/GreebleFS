use crate::session::{ManagedSession, SessionKey};
use crate::types::{ExecutableSpec, WindowMgrError, WindowMgrSessionInfo};
use parking_lot::RwLock;
use std::collections::HashMap;

pub struct WindowMgrState {
  manifest: RwLock<HashMap<String, ExecutableSpec>>,
  sessions: RwLock<HashMap<SessionKey, ManagedSession>>,
}

impl WindowMgrState {
  pub fn new() -> Self {
    Self {
      manifest: RwLock::new(HashMap::new()),
      sessions: RwLock::new(HashMap::new()),
    }
  }

  pub fn register_manifest(&self, manifest: HashMap<String, ExecutableSpec>) {
    let mut current_manifest = self.manifest.write();
    *current_manifest = manifest;
  }

  pub fn executable(&self, executable_id: &str) -> Result<ExecutableSpec, WindowMgrError> {
    self
      .manifest
      .read()
      .get(executable_id)
      .cloned()
      .ok_or_else(|| WindowMgrError::ManifestValidationFailed {
        message: format!(
          "Executable '{}' is not registered in the active manifest",
          executable_id
        ),
      })
  }

  #[cfg_attr(not(any(windows, test)), allow(dead_code))]
  pub fn has_session(&self, key: &SessionKey) -> Option<WindowMgrSessionInfo> {
    self
      .sessions
      .read()
      .get(key)
      .map(|session| session.info.clone())
  }

  #[cfg_attr(not(any(windows, test)), allow(dead_code))]
  pub fn insert_session(&self, key: SessionKey, session: ManagedSession) {
    self.sessions.write().insert(key, session);
  }

  pub fn with_session_mut<T>(
    &self,
    key: &SessionKey,
    updater: impl FnOnce(&mut ManagedSession) -> Result<T, WindowMgrError>,
  ) -> Result<T, WindowMgrError> {
    let mut sessions = self.sessions.write();
    let session = sessions
      .get_mut(key)
      .ok_or_else(|| WindowMgrError::SessionNotFound {
        message: format!(
          "Session '{}' for host '{}' was not found",
          key.session_id, key.host_window_label
        ),
      })?;
    updater(session)
  }

  pub fn remove_session(&self, key: &SessionKey) -> Option<ManagedSession> {
    self.sessions.write().remove(key)
  }

  pub fn remove_host_sessions(&self, host_window_label: &str) -> Vec<(SessionKey, ManagedSession)> {
    let mut sessions = self.sessions.write();
    let matching_keys = sessions
      .keys()
      .filter(|key| key.host_window_label == host_window_label)
      .cloned()
      .collect::<Vec<_>>();

    matching_keys
      .into_iter()
      .filter_map(|key| sessions.remove(&key).map(|session| (key, session)))
      .collect()
  }

  pub fn session_infos(&self) -> Vec<WindowMgrSessionInfo> {
    self
      .sessions
      .read()
      .values()
      .map(|session| session.info.clone())
      .collect()
  }
}

impl Default for WindowMgrState {
  fn default() -> Self {
    Self::new()
  }
}

#[cfg(test)]
mod tests {
  use super::WindowMgrState;
  use crate::session::{ManagedSession, SessionKey};
  use crate::types::{ExecutableSpec, WindowMgrError};

  fn executable(id: &str) -> ExecutableSpec {
    ExecutableSpec {
      id: id.to_string(),
      display_name: None,
      executable_path: format!("C:\\{id}.exe"),
      args: Vec::new(),
      working_directory: None,
      backend_preference: Default::default(),
      short_name: None,
      icon: None,
      color: None,
      extra: Default::default(),
    }
  }

  #[test]
  fn sessions_are_keyed_by_host_window_and_session_id() {
    let state = WindowMgrState::new();
    let first_key = SessionKey::new("main", "cursor");
    let second_key = SessionKey::new("secondary", "cursor");

    state.insert_session(
      first_key.clone(),
      ManagedSession::new_unsupported(
        "main".to_string(),
        "cursor".to_string(),
        executable("cursor"),
      ),
    );
    state.insert_session(
      second_key.clone(),
      ManagedSession::new_unsupported(
        "secondary".to_string(),
        "cursor".to_string(),
        executable("cursor"),
      ),
    );

    let first_info = state
      .has_session(&first_key)
      .expect("first session should exist");
    let second_info = state
      .has_session(&second_key)
      .expect("second session should exist");

    assert_eq!(first_info.host_window_label, "main");
    assert_eq!(second_info.host_window_label, "secondary");
    assert_ne!(first_info.host_window_label, second_info.host_window_label);
  }

  #[test]
  fn missing_manifest_entry_returns_structured_error() {
    let state = WindowMgrState::new();
    let error = state
      .executable("missing")
      .expect_err("missing executable should return an error");

    assert!(matches!(
      error,
      WindowMgrError::ManifestValidationFailed { .. }
    ));
  }
}
