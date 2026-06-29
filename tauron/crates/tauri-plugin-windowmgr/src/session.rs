use crate::types::{
  EmbeddingBackendKind, ExecutableSpec, LaunchStatus, ReservedInsets, WindowMgrError,
  WindowMgrSessionInfo, WindowSurfaceBounds,
};

#[cfg(windows)]
use crate::embedding::{EmbeddingController, WindowEmbeddingBackend};
#[cfg(windows)]
use crate::state::WindowMgrState;
#[cfg(windows)]
use std::sync::{Arc, Mutex};
#[cfg(windows)]
use std::time::Duration;
#[cfg(windows)]
use tauri::{Emitter, Manager};

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct SessionKey {
  pub host_window_label: String,
  pub session_id: String,
}

impl SessionKey {
  pub fn new(host_window_label: impl Into<String>, session_id: impl Into<String>) -> Self {
    Self {
      host_window_label: host_window_label.into(),
      session_id: session_id.into(),
    }
  }
}

pub struct ManagedSession {
  pub info: WindowMgrSessionInfo,
  pub reserved_insets: ReservedInsets,
  pub current_bounds: Option<WindowSurfaceBounds>,
  pub runtime: SessionRuntime,
}

pub enum SessionRuntime {
  #[cfg_attr(not(test), allow(dead_code))]
  Unsupported,
  #[cfg(windows)]
  Windows(WindowsSessionRuntime),
}

#[cfg(windows)]
pub struct WindowsSessionRuntime {
  pub child: Arc<Mutex<std::process::Child>>,
  pub embedding: EmbeddingController,
}

impl ManagedSession {
  #[cfg_attr(not(test), allow(dead_code))]
  pub fn new_unsupported(
    host_window_label: String,
    session_id: String,
    executable: ExecutableSpec,
  ) -> Self {
    Self {
      info: WindowMgrSessionInfo {
        host_window_label,
        session_id,
        executable_id: executable.id.clone(),
        backend_kind: EmbeddingBackendKind::Unsupported,
        pid: None,
        hwnd: None,
        visible: false,
        launch_status: LaunchStatus::Failed,
      },
      reserved_insets: ReservedInsets::default(),
      current_bounds: None,
      runtime: SessionRuntime::Unsupported,
    }
  }

  #[cfg(windows)]
  pub fn new_windows(
    host_window_label: String,
    session_id: String,
    executable: ExecutableSpec,
    child: Arc<Mutex<std::process::Child>>,
    embedding: EmbeddingController,
    pid: u32,
  ) -> Self {
    let backend_kind = embedding.kind();
    let hwnd = embedding.hwnd() as u64;

    Self {
      info: WindowMgrSessionInfo {
        host_window_label,
        session_id,
        executable_id: executable.id.clone(),
        backend_kind,
        pid: Some(pid),
        hwnd: Some(hwnd),
        visible: false,
        launch_status: LaunchStatus::Attached,
      },
      reserved_insets: ReservedInsets::default(),
      current_bounds: None,
      runtime: SessionRuntime::Windows(WindowsSessionRuntime { child, embedding }),
    }
  }

  pub fn set_reserved_insets(
    &mut self,
    reserved_insets: ReservedInsets,
  ) -> Result<(), WindowMgrError> {
    self.reserved_insets = reserved_insets;

    if let Some(bounds) = self.current_bounds {
      self.apply_clip(bounds)?;
    }

    Ok(())
  }

  pub fn update_bounds(&mut self, bounds: WindowSurfaceBounds) -> Result<(), WindowMgrError> {
    self.current_bounds = Some(bounds);

    match &mut self.runtime {
      #[cfg(windows)]
      SessionRuntime::Windows(runtime) => {
        runtime
          .embedding
          .update_bounds(bounds)
          .map_err(|message| WindowMgrError::BackendInitFailed { message })?;
        self.apply_clip(bounds)?;
        Ok(())
      }
      SessionRuntime::Unsupported => Err(WindowMgrError::unsupported()),
    }
  }

  pub fn show(&mut self, bounds: WindowSurfaceBounds) -> Result<(), WindowMgrError> {
    self.current_bounds = Some(bounds);

    match &mut self.runtime {
      #[cfg(windows)]
      SessionRuntime::Windows(runtime) => {
        runtime
          .embedding
          .show(bounds)
          .map_err(|message| WindowMgrError::BackendInitFailed { message })?;
        self.info.visible = true;
        self.info.launch_status = LaunchStatus::Attached;
        self.apply_clip(bounds)?;
        Ok(())
      }
      SessionRuntime::Unsupported => Err(WindowMgrError::unsupported()),
    }
  }

  pub fn hide(&mut self) -> Result<(), WindowMgrError> {
    match &mut self.runtime {
      #[cfg(windows)]
      SessionRuntime::Windows(runtime) => {
        runtime
          .embedding
          .hide()
          .map_err(|message| WindowMgrError::BackendInitFailed { message })?;
        self.info.visible = false;
        self.info.launch_status = LaunchStatus::Hidden;
        Ok(())
      }
      SessionRuntime::Unsupported => Err(WindowMgrError::unsupported()),
    }
  }

  pub fn stop(&mut self) {
    #[cfg(windows)]
    if let SessionRuntime::Windows(runtime) = &mut self.runtime {
      if let Ok(mut child) = runtime.child.lock() {
        let _ = child.kill();
      }
    }

    self.info.visible = false;
    self.info.launch_status = LaunchStatus::Exited;
  }

  fn apply_clip(&mut self, bounds: WindowSurfaceBounds) -> Result<(), WindowMgrError> {
    match &mut self.runtime {
      #[cfg(windows)]
      SessionRuntime::Windows(runtime) => {
        if self.reserved_insets == ReservedInsets::default() {
          runtime
            .embedding
            .clear_clip()
            .map_err(|message| WindowMgrError::BackendInitFailed { message })?;
        } else {
          runtime
            .embedding
            .set_clip(bounds, self.reserved_insets)
            .map_err(|message| WindowMgrError::BackendInitFailed { message })?;
        }

        Ok(())
      }
      SessionRuntime::Unsupported => Err(WindowMgrError::unsupported()),
    }
  }
}

#[cfg(windows)]
pub fn spawn_exit_watcher<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
  key: SessionKey,
  child: Arc<Mutex<std::process::Child>>,
) {
  std::thread::spawn(move || loop {
    let exit_status = {
      if let Ok(mut handle) = child.lock() {
        handle.try_wait().ok().flatten()
      } else {
        None
      }
    };

    if exit_status.is_some() {
      let state = app.state::<WindowMgrState>();
      if let Some(mut session) = state.remove_session(&key) {
        session.info.visible = false;
        session.info.launch_status = LaunchStatus::Exited;
        let _ = app.emit("windowmgr://session-exited", session.info);
      }
      break;
    }

    std::thread::sleep(Duration::from_millis(500));
  });
}
