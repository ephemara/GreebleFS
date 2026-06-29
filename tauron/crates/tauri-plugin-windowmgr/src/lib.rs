mod drag;
mod embedding;
mod manifest;
mod session;
mod state;
mod types;

#[cfg(windows)]
mod platform {
  pub mod windows;
}

use drag::DragManager;
use manifest::validate_manifest;
use session::{ManagedSession, SessionKey};
use state::WindowMgrState;
use tauri::{
  plugin::{Builder, TauriPlugin},
  Emitter, Manager, Runtime,
};
use types::{
  ExecutableSpec, WindowMgrBoundsUpdateRequest, WindowMgrError, WindowMgrErrorPayload,
  WindowMgrInlineSessionRequest, WindowMgrManifest, WindowMgrReservedInsetsRequest,
  WindowMgrSessionInfo, WindowMgrSessionLocator, WindowMgrSessionRequest,
};

fn effective_host_window_label<R: Runtime>(
  window: &tauri::Window<R>,
  requested_label: &str,
) -> String {
  let actual_label = window.label().to_string();
  if requested_label.trim().is_empty() || requested_label == actual_label {
    actual_label
  } else {
    actual_label
  }
}

fn emit_session_error(
  app: &tauri::AppHandle<impl Runtime>,
  host_window_label: &str,
  session_id: &str,
  error: WindowMgrError,
) {
  let _ = app.emit(
    "windowmgr://session-error",
    WindowMgrErrorPayload {
      host_window_label: host_window_label.to_string(),
      session_id: session_id.to_string(),
      error,
    },
  );
}

#[cfg(windows)]
async fn start_with_spec(
  app: tauri::AppHandle<impl Runtime>,
  window: tauri::Window<impl Runtime>,
  state: tauri::State<'_, WindowMgrState>,
  host_window_label: String,
  session_id: String,
  executable_spec: ExecutableSpec,
) -> Result<WindowMgrSessionInfo, WindowMgrError> {
  let key = SessionKey::new(host_window_label.clone(), session_id.clone());

  if let Some(existing_session) = state.has_session(&key) {
    return Ok(existing_session);
  }

  let host_hwnd = window
    .hwnd()
    .map_err(|error| WindowMgrError::BackendInitFailed {
      message: format!("Failed to resolve host HWND: {error}"),
    })?
    .0 as isize;

  let start_result = tauri::async_runtime::spawn_blocking({
    let executable_spec = executable_spec.clone();
    move || platform::windows::launch_and_attach(&executable_spec, host_hwnd)
  })
  .await
  .map_err(|error| WindowMgrError::BackendInitFailed {
    message: format!("Failed to join window attach task: {error}"),
  })??;

  let child = std::sync::Arc::new(std::sync::Mutex::new(start_result.child));
  let pid = start_result.pid;
  let mut managed_session = ManagedSession::new_windows(
    host_window_label.clone(),
    session_id.clone(),
    executable_spec,
    child.clone(),
    start_result.embedding,
    pid,
  );

  managed_session.hide()?;
  let info = managed_session.info.clone();
  state.insert_session(key.clone(), managed_session);
  session::spawn_exit_watcher(app.clone(), key, child);
  let _ = app.emit("windowmgr://session-started", &info);
  Ok(info)
}

#[cfg(not(windows))]
async fn start_with_spec(
  _app: tauri::AppHandle<impl Runtime>,
  _window: tauri::Window<impl Runtime>,
  _state: tauri::State<'_, WindowMgrState>,
  _host_window_label: String,
  _session_id: String,
  _executable_spec: ExecutableSpec,
) -> Result<WindowMgrSessionInfo, WindowMgrError> {
  Err(WindowMgrError::unsupported())
}

#[tauri::command]
fn windowmgr_register_manifest(
  manifest: WindowMgrManifest,
  state: tauri::State<'_, WindowMgrState>,
) -> Result<(), WindowMgrError> {
  let validated_manifest = validate_manifest(manifest)?;
  state.register_manifest(validated_manifest);
  Ok(())
}

#[tauri::command]
async fn windowmgr_start_session<R: Runtime>(
  app: tauri::AppHandle<R>,
  window: tauri::Window<R>,
  request: WindowMgrSessionRequest,
  state: tauri::State<'_, WindowMgrState>,
) -> Result<WindowMgrSessionInfo, WindowMgrError> {
  let host_window_label = effective_host_window_label(&window, &request.host_window_label);
  let executable_spec = state.executable(&request.executable_id)?;

  let result = start_with_spec(
    app.clone(),
    window,
    state,
    host_window_label.clone(),
    request.session_id.clone(),
    executable_spec,
  )
  .await;

  if let Err(error) = result.as_ref() {
    emit_session_error(&app, &host_window_label, &request.session_id, error.clone());
  }

  result
}

#[tauri::command]
async fn windowmgr_start_inline_session<R: Runtime>(
  app: tauri::AppHandle<R>,
  window: tauri::Window<R>,
  request: WindowMgrInlineSessionRequest,
  state: tauri::State<'_, WindowMgrState>,
) -> Result<WindowMgrSessionInfo, WindowMgrError> {
  let host_window_label = effective_host_window_label(&window, &request.host_window_label);

  let result = start_with_spec(
    app.clone(),
    window,
    state,
    host_window_label.clone(),
    request.session_id.clone(),
    request.executable_spec,
  )
  .await;

  if let Err(error) = result.as_ref() {
    emit_session_error(&app, &host_window_label, &request.session_id, error.clone());
  }

  result
}

#[tauri::command]
fn windowmgr_show_session<R: Runtime>(
  app: tauri::AppHandle<R>,
  request: WindowMgrBoundsUpdateRequest,
  state: tauri::State<'_, WindowMgrState>,
) -> Result<WindowMgrSessionInfo, WindowMgrError> {
  let key = SessionKey::new(
    request.host_window_label.clone(),
    request.session_id.clone(),
  );
  let info = state.with_session_mut(&key, |session| {
    session.show(request.bounds)?;
    Ok(session.info.clone())
  })?;
  let _ = app.emit("windowmgr://session-shown", &info);
  Ok(info)
}

#[tauri::command]
fn windowmgr_hide_session<R: Runtime>(
  app: tauri::AppHandle<R>,
  request: WindowMgrSessionLocator,
  state: tauri::State<'_, WindowMgrState>,
) -> Result<WindowMgrSessionInfo, WindowMgrError> {
  let key = SessionKey::new(
    request.host_window_label.clone(),
    request.session_id.clone(),
  );
  let info = state.with_session_mut(&key, |session| {
    session.hide()?;
    Ok(session.info.clone())
  })?;
  let _ = app.emit("windowmgr://session-hidden", &info);
  Ok(info)
}

#[tauri::command]
fn windowmgr_update_session_bounds<R: Runtime>(
  app: tauri::AppHandle<R>,
  request: WindowMgrBoundsUpdateRequest,
  state: tauri::State<'_, WindowMgrState>,
) -> Result<WindowMgrSessionInfo, WindowMgrError> {
  let key = SessionKey::new(
    request.host_window_label.clone(),
    request.session_id.clone(),
  );
  let info = state.with_session_mut(&key, |session| {
    session.update_bounds(request.bounds)?;
    Ok(session.info.clone())
  })?;
  let _ = app.emit("windowmgr://session-bounds-updated", &info);
  Ok(info)
}

#[tauri::command]
fn windowmgr_set_reserved_insets(
  request: WindowMgrReservedInsetsRequest,
  state: tauri::State<'_, WindowMgrState>,
) -> Result<WindowMgrSessionInfo, WindowMgrError> {
  let key = SessionKey::new(request.host_window_label, request.session_id);
  state.with_session_mut(&key, |session| {
    session.set_reserved_insets(request.reserved_insets)?;
    Ok(session.info.clone())
  })
}

#[tauri::command]
fn windowmgr_stop_session<R: Runtime>(
  app: tauri::AppHandle<R>,
  request: WindowMgrSessionLocator,
  state: tauri::State<'_, WindowMgrState>,
) -> Result<WindowMgrSessionInfo, WindowMgrError> {
  let key = SessionKey::new(
    request.host_window_label.clone(),
    request.session_id.clone(),
  );
  let mut session = state
    .remove_session(&key)
    .ok_or_else(|| WindowMgrError::SessionNotFound {
      message: format!(
        "Session '{}' for host '{}' was not found",
        request.session_id, request.host_window_label
      ),
    })?;
  session.stop();
  let info = session.info;
  let _ = app.emit("windowmgr://session-exited", &info);
  Ok(info)
}

#[tauri::command]
fn windowmgr_stop_host_sessions<R: Runtime>(
  app: tauri::AppHandle<R>,
  host_window_label: String,
  state: tauri::State<'_, WindowMgrState>,
) -> Result<usize, WindowMgrError> {
  let removed_sessions = state.remove_host_sessions(&host_window_label);
  let removed_count = removed_sessions.len();

  for (_, mut session) in removed_sessions {
    session.stop();
    let _ = app.emit("windowmgr://session-exited", &session.info);
  }

  Ok(removed_count)
}

#[tauri::command]
fn windowmgr_list_sessions(
  state: tauri::State<'_, WindowMgrState>,
) -> Result<Vec<WindowMgrSessionInfo>, WindowMgrError> {
  Ok(state.session_infos())
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
  Builder::<R>::new("windowmgr")
    .setup(|app, _| {
      app.manage(WindowMgrState::new());
      app.manage(DragManager::new());
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      windowmgr_register_manifest,
      windowmgr_start_session,
      windowmgr_start_inline_session,
      windowmgr_show_session,
      windowmgr_hide_session,
      windowmgr_update_session_bounds,
      windowmgr_set_reserved_insets,
      windowmgr_stop_session,
      windowmgr_stop_host_sessions,
      windowmgr_list_sessions,
      drag::windowmgr_drag_begin,
      drag::windowmgr_drag_get_session,
      drag::windowmgr_drag_end,
      drag::windowmgr_drag_drop
    ])
    .build()
}
