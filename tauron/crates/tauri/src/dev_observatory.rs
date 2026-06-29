//! Dev-only loopback observatory for native lane telemetry and app diagnostics.
#![allow(missing_docs)]

use std::{
  collections::{BTreeMap, VecDeque},
  fs,
  io::{Read, Write},
  net::{TcpListener, TcpStream},
  path::PathBuf,
  process::{Command, Stdio},
  sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
  },
  thread,
  time::{Duration, SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{
  native_control::{self, NativeControlRequest},
  plugin::{Builder as PluginBuilder, TauriPlugin},
  AppHandle, Manager, Runtime,
};

pub const DEV_OBSERVATORY_PLUGIN_NAME: &str = "dev-observatory";
const MAX_EVENTS: usize = 2048;

type DevObservatoryProvider = dyn Fn() -> Result<Value, String> + Send + Sync + 'static;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DevObservatoryConfig {
  pub enabled: bool,
  pub app_name: String,
  pub session_file_path: Option<PathBuf>,
  pub log_file_paths: Vec<PathBuf>,
}

impl DevObservatoryConfig {
  pub fn dev_default(app_name: impl Into<String>) -> Self {
    Self {
      enabled: cfg!(debug_assertions)
        && std::env::var("TAURON_DEV_OBSERVATORY")
          .map(|value| value.trim() != "0" && !value.eq_ignore_ascii_case("false"))
          .unwrap_or(true),
      app_name: app_name.into(),
      session_file_path: std::env::var_os("TAURON_DEV_OBSERVATORY_SESSION_FILE").map(PathBuf::from),
      log_file_paths: Vec::new(),
    }
  }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DevObservatoryEvent {
  pub source: String,
  pub severity: String,
  pub message: String,
  #[serde(default)]
  pub lane: Option<String>,
  #[serde(default)]
  pub system_id: Option<String>,
  #[serde(default)]
  pub payload: Option<Value>,
  #[serde(default = "current_epoch_ms")]
  pub at_epoch_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DevObservatoryProviderDescriptor {
  pub id: String,
  pub label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DevObservatorySessionRecord {
  pub version: u32,
  pub app_name: String,
  pub pid: u32,
  pub platform: String,
  pub started_at_epoch_ms: u64,
  pub updated_at_epoch_ms: u64,
  pub session_file_path: String,
  pub base_url: String,
  pub health_url: String,
  pub snapshot_url: String,
  pub events_url: String,
  pub logs_url: String,
  pub providers_url: String,
  pub launch_url: String,
  pub auth_token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DevObservatorySnapshot {
  pub session: Option<DevObservatorySessionRecord>,
  pub runtime: Value,
  pub lanes: Value,
  pub providers: BTreeMap<String, Value>,
  pub logs: Value,
  pub events: Vec<DevObservatoryEvent>,
  pub errors: Vec<String>,
}

struct RegisteredProvider {
  id: String,
  label: String,
  callback: Arc<DevObservatoryProvider>,
}

struct DevObservatoryServerHandle {
  shutdown: Arc<AtomicBool>,
  session_file_path: PathBuf,
  latest_session_file_path: Option<PathBuf>,
}

impl Drop for DevObservatoryServerHandle {
  fn drop(&mut self) {
    self.shutdown.store(true, Ordering::Relaxed);
    let _ = fs::remove_file(&self.session_file_path);
    if let Some(latest) = &self.latest_session_file_path {
      let _ = fs::remove_file(latest);
    }
  }
}

#[derive(Default)]
struct DevObservatoryInner {
  enabled: bool,
  config: Option<DevObservatoryConfig>,
  session: Option<DevObservatorySessionRecord>,
  providers: BTreeMap<String, RegisteredProvider>,
  events: VecDeque<DevObservatoryEvent>,
  server: Option<DevObservatoryServerHandle>,
}

#[derive(Default, Clone)]
pub struct DevObservatoryState {
  inner: Arc<Mutex<DevObservatoryInner>>,
}

impl DevObservatoryState {
  fn init<R: Runtime>(
    &self,
    app: &AppHandle<R>,
    config: DevObservatoryConfig,
  ) -> Result<(), String> {
    let mut inner = self
      .inner
      .lock()
      .map_err(|_| "dev observatory state lock poisoned".to_string())?;
    if inner.server.is_some() {
      inner.enabled = true;
      inner.config = Some(config);
      return Ok(());
    }
    inner.enabled = config.enabled;
    inner.config = Some(config.clone());
    drop(inner);

    if !config.enabled {
      return Ok(());
    }

    register_builtin_providers(app)?;
    let handle = start_http_server(self.clone(), config)?;
    let session = handle.session_record.clone();
    let mut inner = self
      .inner
      .lock()
      .map_err(|_| "dev observatory state lock poisoned".to_string())?;
    inner.session = Some(session);
    inner.server = Some(handle.handle);
    inner.enabled = true;
    Ok(())
  }

  fn register_provider<F>(&self, id: &str, label: &str, callback: F) -> Result<(), String>
  where
    F: Fn() -> Result<Value, String> + Send + Sync + 'static,
  {
    let id = id.trim();
    if id.is_empty() {
      return Err("dev observatory provider id is required".to_string());
    }
    let mut inner = self
      .inner
      .lock()
      .map_err(|_| "dev observatory state lock poisoned".to_string())?;
    inner.providers.insert(
      id.to_string(),
      RegisteredProvider {
        id: id.to_string(),
        label: label.trim().to_string(),
        callback: Arc::new(callback),
      },
    );
    Ok(())
  }

  fn record_event(&self, mut event: DevObservatoryEvent) -> Result<(), String> {
    if event.at_epoch_ms == 0 {
      event.at_epoch_ms = current_epoch_ms();
    }
    let mut inner = self
      .inner
      .lock()
      .map_err(|_| "dev observatory state lock poisoned".to_string())?;
    inner.events.push_back(event);
    while inner.events.len() > MAX_EVENTS {
      inner.events.pop_front();
    }
    Ok(())
  }

  fn provider_descriptors(&self) -> Vec<DevObservatoryProviderDescriptor> {
    self
      .inner
      .lock()
      .map(|inner| {
        inner
          .providers
          .values()
          .map(|provider| DevObservatoryProviderDescriptor {
            id: provider.id.clone(),
            label: provider.label.clone(),
          })
          .collect()
      })
      .unwrap_or_default()
  }

  fn events(&self) -> Vec<DevObservatoryEvent> {
    self
      .inner
      .lock()
      .map(|inner| inner.events.iter().cloned().collect())
      .unwrap_or_default()
  }

  fn snapshot(&self) -> DevObservatorySnapshot {
    let (session, providers, events, config) = match self.inner.lock() {
      Ok(inner) => (
        inner.session.clone(),
        inner
          .providers
          .values()
          .map(|provider| {
            (
              provider.id.clone(),
              provider.label.clone(),
              Arc::clone(&provider.callback),
            )
          })
          .collect::<Vec<_>>(),
        inner.events.iter().cloned().collect::<Vec<_>>(),
        inner.config.clone(),
      ),
      Err(_) => {
        return DevObservatorySnapshot {
          session: None,
          runtime: serde_json::json!({ "error": "dev observatory state lock poisoned" }),
          lanes: serde_json::json!({}),
          providers: BTreeMap::new(),
          logs: serde_json::json!({}),
          events: Vec::new(),
          errors: vec!["dev observatory state lock poisoned".to_string()],
        };
      }
    };

    let mut provider_values = BTreeMap::new();
    let mut errors = Vec::new();
    for (id, label, callback) in providers {
      match callback() {
        Ok(value) => {
          provider_values.insert(id, serde_json::json!({ "label": label, "value": value }));
        }
        Err(error) => {
          errors.push(format!("provider {id} failed: {error}"));
          provider_values.insert(id, serde_json::json!({ "label": label, "error": error }));
        }
      }
    }

    DevObservatorySnapshot {
      session: session.clone(),
      runtime: serde_json::json!({
        "pid": std::process::id(),
        "platform": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "executable": std::env::current_exe().ok().map(normalize_path_for_json),
      }),
      lanes: provider_values
        .get("tauron.lanes")
        .and_then(|value| value.get("value"))
        .cloned()
        .unwrap_or_else(|| serde_json::json!({})),
      providers: provider_values,
      logs: read_log_snapshot(config.as_ref()),
      events,
      errors,
    }
  }
}

struct StartedServer {
  session_record: DevObservatorySessionRecord,
  handle: DevObservatoryServerHandle,
}

pub fn init<R: Runtime>(app: &AppHandle<R>, config: DevObservatoryConfig) -> Result<(), String> {
  ensure_state(app);
  let state = app.state::<DevObservatoryState>().inner().clone();
  state.init(app, config)
}

pub fn register_json_provider<R: Runtime, M: Manager<R>, F>(
  manager: &M,
  id: &str,
  label: &str,
  callback: F,
) -> Result<(), String>
where
  F: Fn() -> Result<Value, String> + Send + Sync + 'static,
{
  ensure_state(manager);
  manager
    .state::<DevObservatoryState>()
    .register_provider(id, label, callback)
}

pub fn record_event<R: Runtime, M: Manager<R>>(
  manager: &M,
  event: DevObservatoryEvent,
) -> Result<(), String> {
  ensure_state(manager);
  manager.state::<DevObservatoryState>().record_event(event)
}

fn ensure_state<R: Runtime, M: Manager<R>>(manager: &M) {
  if manager.try_state::<DevObservatoryState>().is_none() {
    let _ = manager.manage(DevObservatoryState::default());
  }
}

fn register_builtin_providers<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
  let app_for_lanes = app.clone();
  register_json_provider(app, "tauron.lanes", "Tauron Native Lanes", move || {
    let native_buffer_pool = app_for_lanes
      .try_state::<crate::native_buffer_pool::NativeBufferPoolState>()
      .map(|state| serde_json::to_value(state.telemetry()))
      .transpose()
      .map_err(|error| format!("failed to serialize native buffer pool telemetry: {error}"))?;
    let native_stream = app_for_lanes
      .try_state::<crate::native_stream::NativeByteStreamState>()
      .map(|state| serde_json::to_value(state.telemetry_snapshot()))
      .transpose()
      .map_err(|error| format!("failed to serialize native stream telemetry: {error}"))?;
    Ok(serde_json::json!({
      "nativeControl": {
        "available": cfg!(all(windows, feature = "wry")),
        "controlPlane": "native-control"
      },
      "nativeBufferPool": native_buffer_pool.unwrap_or(Value::Null),
      "nativeStream": native_stream.unwrap_or(Value::Null),
      "nativeRing": {
        "available": cfg!(all(windows, feature = "wry")),
        "globalTelemetry": null,
        "reason": "native ring v1 is benchmark/probe scoped"
      },
      "transport": {
        "available": true,
        "globalTelemetry": null,
        "reason": "transport stream telemetry is per-stream/replay scoped"
      }
    }))
  })?;

  let app_for_windows = app.clone();
  register_json_provider(
    app,
    "tauron.windows",
    "Tauron Windows/WebViews",
    move || {
      let webviews = app_for_windows
        .webview_windows()
        .into_iter()
        .map(|(label, window)| {
          serde_json::json!({
            "label": label,
            "title": window.title().ok(),
            "visible": window.is_visible().ok(),
            "focused": window.is_focused().ok(),
          })
        })
        .collect::<Vec<_>>();
      Ok(serde_json::json!({ "webviews": webviews }))
    },
  )?;
  Ok(())
}

fn start_http_server(
  state: DevObservatoryState,
  config: DevObservatoryConfig,
) -> Result<StartedServer, String> {
  let listener = TcpListener::bind("127.0.0.1:0")
    .map_err(|error| format!("failed to bind dev observatory server: {error}"))?;
  listener
    .set_nonblocking(true)
    .map_err(|error| format!("failed to set dev observatory server nonblocking: {error}"))?;
  let socket_addr = listener
    .local_addr()
    .map_err(|error| format!("failed to read dev observatory server address: {error}"))?;
  let token = generate_token();
  let base_url = format!("http://127.0.0.1:{}", socket_addr.port());
  let session_file_path = config
    .session_file_path
    .clone()
    .unwrap_or_else(default_session_file_path);
  let latest_session_file_path = default_latest_session_file_path();
  let session_record = DevObservatorySessionRecord {
    version: 1,
    app_name: config.app_name.clone(),
    pid: std::process::id(),
    platform: std::env::consts::OS.to_string(),
    started_at_epoch_ms: current_epoch_ms(),
    updated_at_epoch_ms: current_epoch_ms(),
    session_file_path: normalize_path_for_json(&session_file_path),
    base_url: base_url.clone(),
    health_url: format!("{base_url}/health"),
    snapshot_url: format!("{base_url}/snapshot"),
    events_url: format!("{base_url}/events"),
    logs_url: format!("{base_url}/logs"),
    providers_url: format!("{base_url}/providers"),
    launch_url: format!("{base_url}/launch"),
    auth_token: token.clone(),
  };
  write_session_file(&session_file_path, &session_record)?;
  if let Some(latest) = &latest_session_file_path {
    let _ = write_session_file(latest, &session_record);
  }

  let shutdown = Arc::new(AtomicBool::new(false));
  let shutdown_for_thread = Arc::clone(&shutdown);
  let session_for_thread = session_record.clone();
  thread::Builder::new()
    .name("tauron-dev-observatory".to_string())
    .spawn(move || {
      while !shutdown_for_thread.load(Ordering::Relaxed) {
        match listener.accept() {
          Ok((stream, _)) => {
            handle_http_stream(stream, &state, &session_for_thread, &token);
          }
          Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
            thread::sleep(Duration::from_millis(25));
          }
          Err(error) => {
            eprintln!("tauron dev observatory server error: {error}");
            thread::sleep(Duration::from_millis(100));
          }
        }
      }
    })
    .map_err(|error| format!("failed to spawn dev observatory server: {error}"))?;

  Ok(StartedServer {
    session_record,
    handle: DevObservatoryServerHandle {
      shutdown,
      session_file_path,
      latest_session_file_path,
    },
  })
}

fn handle_http_stream(
  mut stream: TcpStream,
  state: &DevObservatoryState,
  session: &DevObservatorySessionRecord,
  token: &str,
) {
  let mut buffer = [0u8; 8192];
  let read = match stream.read(&mut buffer) {
    Ok(read) => read,
    Err(_) => return,
  };
  let request = String::from_utf8_lossy(&buffer[..read]);
  let Some(first_line) = request.lines().next() else {
    return;
  };
  let mut parts = first_line.split_whitespace();
  let method = parts.next().unwrap_or("");
  let target = parts.next().unwrap_or("/");
  if !is_authorized(&request, target, token) {
    write_json_response(
      &mut stream,
      401,
      &serde_json::json!({ "ok": false, "error": "unauthorized" }),
    );
    return;
  }
  let path = target.split('?').next().unwrap_or(target);
  match (method, path) {
    ("GET", "/health") => write_json_response(
      &mut stream,
      200,
      &serde_json::json!({ "ok": true, "session": session }),
    ),
    ("GET", "/snapshot") => write_json_response(&mut stream, 200, &state.snapshot()),
    ("GET", "/events") => write_json_response(
      &mut stream,
      200,
      &serde_json::json!({ "events": state.events() }),
    ),
    ("GET", "/logs") => write_json_response(
      &mut stream,
      200,
      &read_log_snapshot(
        state
          .inner
          .lock()
          .ok()
          .and_then(|inner| inner.config.clone())
          .as_ref(),
      ),
    ),
    ("GET", "/providers") => write_json_response(
      &mut stream,
      200,
      &serde_json::json!({ "providers": state.provider_descriptors() }),
    ),
    ("POST", "/launch") | ("GET", "/launch") => {
      let result = launch_observatory_app(&session.session_file_path);
      write_json_response(
        &mut stream,
        if result.is_ok() { 200 } else { 500 },
        &serde_json::json!({ "ok": result.is_ok(), "error": result.err() }),
      );
    }
    _ => write_json_response(
      &mut stream,
      404,
      &serde_json::json!({ "ok": false, "error": "not found" }),
    ),
  }
}

fn is_authorized(request: &str, target: &str, token: &str) -> bool {
  if target.contains(&format!("token={token}")) {
    return true;
  }
  let expected = format!("authorization: bearer {token}");
  request
    .lines()
    .any(|line| line.trim().to_ascii_lowercase() == expected)
}

fn write_json_response<T: Serialize>(stream: &mut TcpStream, status: u16, value: &T) {
  let body = serde_json::to_string_pretty(value)
    .unwrap_or_else(|error| format!(r#"{{"error":"failed to serialize response: {error}"}}"#));
  let status_text = match status {
    200 => "OK",
    401 => "Unauthorized",
    404 => "Not Found",
    _ => "Error",
  };
  let response = format!(
    "HTTP/1.1 {status} {status_text}\r\nContent-Type: application/json; charset=utf-8\r\nAccess-Control-Allow-Origin: *\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
    body.len()
  );
  let _ = stream.write_all(response.as_bytes());
}

fn read_log_snapshot(config: Option<&DevObservatoryConfig>) -> Value {
  let files = config
    .map(|config| {
      config
        .log_file_paths
        .iter()
        .map(|path| {
          let tail = fs::read_to_string(path)
            .ok()
            .map(|text| tail_text(&text, 64 * 1024));
          serde_json::json!({
            "path": normalize_path_for_json(path),
            "exists": path.exists(),
            "tail": tail,
          })
        })
        .collect::<Vec<_>>()
    })
    .unwrap_or_default();
  serde_json::json!({ "files": files })
}

fn tail_text(text: &str, max_bytes: usize) -> String {
  if text.len() <= max_bytes {
    return text.to_string();
  }
  text[text.len().saturating_sub(max_bytes)..].to_string()
}

fn write_session_file(path: &PathBuf, session: &DevObservatorySessionRecord) -> Result<(), String> {
  if let Some(parent) = path.parent() {
    fs::create_dir_all(parent)
      .map_err(|error| format!("failed to create dev observatory directory: {error}"))?;
  }
  let json = serde_json::to_string_pretty(session)
    .map_err(|error| format!("failed to serialize dev observatory session: {error}"))?;
  fs::write(path, json)
    .map_err(|error| format!("failed to write dev observatory session file: {error}"))
}

fn default_session_file_path() -> PathBuf {
  default_session_directory().join(format!("session-{}.json", std::process::id()))
}

fn default_latest_session_file_path() -> Option<PathBuf> {
  Some(default_session_directory().join("latest.json"))
}

fn default_session_directory() -> PathBuf {
  std::env::temp_dir().join("tauron-dev-observatory")
}

fn launch_observatory_app(session_file_path: &str) -> Result<(), String> {
  let script = std::env::var_os("TAURON_DEV_OBSERVATORY_APP")
    .map(PathBuf::from)
    .unwrap_or_else(default_observatory_app_script);
  if !script.exists() {
    return Err(format!(
      "dev observatory app script not found: {}",
      script.display()
    ));
  }
  Command::new("node")
    .arg(script)
    .arg("--session")
    .arg(session_file_path)
    .arg("--open")
    .stdin(Stdio::null())
    .stdout(Stdio::null())
    .stderr(Stdio::null())
    .spawn()
    .map(|_| ())
    .map_err(|error| format!("failed to launch dev observatory app: {error}"))
}

fn default_observatory_app_script() -> PathBuf {
  PathBuf::from(env!("CARGO_MANIFEST_DIR"))
    .join("..")
    .join("..")
    .join("packages")
    .join("dev-observatory")
    .join("server.mjs")
}

fn normalize_path_for_json(path: impl AsRef<std::path::Path>) -> String {
  path.as_ref().to_string_lossy().replace('\\', "/")
}

fn generate_token() -> String {
  format!(
    "{}-{}-{}",
    std::process::id(),
    current_epoch_ms(),
    std::thread::current().name().unwrap_or("tauron")
  )
}

fn current_epoch_ms() -> u64 {
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|duration| duration.as_millis() as u64)
    .unwrap_or(0)
}

fn register_native_control_handlers<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
  ensure_state(app);
  let app_for_snapshot = app.clone();
  native_control::register_handler(app, "devObservatory", "snapshot", move |_request| {
    let state = app_for_snapshot.state::<DevObservatoryState>();
    serde_json::to_value(state.snapshot())
      .map_err(|error| format!("failed to serialize dev observatory snapshot: {error}"))
  })?;

  let app_for_record = app.clone();
  native_control::register_handler(app, "devObservatory", "recordEvent", move |request| {
    let event = decode_event_request(request)?;
    app_for_record
      .state::<DevObservatoryState>()
      .record_event(event)?;
    Ok(serde_json::json!({ "ok": true }))
  })?;

  let app_for_open = app.clone();
  native_control::register_handler(app, "devObservatory", "open", move |_request| {
    open_observatory_from_state(&app_for_open)
  })?;

  let app_for_toggle = app.clone();
  native_control::register_handler(app, "devObservatory", "toggle", move |_request| {
    open_observatory_from_state(&app_for_toggle)
  })?;

  let app_for_focus = app.clone();
  native_control::register_handler(app, "devObservatory", "focus", move |_request| {
    open_observatory_from_state(&app_for_focus)
  })?;
  Ok(())
}

fn decode_event_request(request: NativeControlRequest) -> Result<DevObservatoryEvent, String> {
  serde_json::from_value(request.args)
    .map_err(|error| format!("failed to decode dev observatory event: {error}"))
}

fn open_observatory_from_state<R: Runtime>(app: &AppHandle<R>) -> Result<Value, String> {
  let state = app.state::<DevObservatoryState>();
  let session_file_path = state
    .inner
    .lock()
    .map_err(|_| "dev observatory state lock poisoned".to_string())?
    .session
    .as_ref()
    .map(|session| session.session_file_path.clone())
    .ok_or_else(|| "dev observatory is not initialized".to_string())?;
  launch_observatory_app(&session_file_path)?;
  Ok(serde_json::json!({ "ok": true, "sessionFilePath": session_file_path }))
}

pub(crate) fn plugin<R: Runtime>() -> TauriPlugin<R> {
  PluginBuilder::new(DEV_OBSERVATORY_PLUGIN_NAME)
    .setup(|app, _api| {
      ensure_state(app);
      register_native_control_handlers(app)
        .map_err(|error| std::io::Error::new(std::io::ErrorKind::Other, error).into())
    })
    .js_init_script(dev_observatory_init_script())
    .build()
}

fn dev_observatory_init_script() -> String {
  r#"
    (function () {
      if (window.__TAURI_DEV_OBSERVATORY_HOTKEY__) {
        return;
      }
      window.__TAURI_DEV_OBSERVATORY_HOTKEY__ = true;
      window.addEventListener('keydown', function (event) {
        if (!event.ctrlKey || !event.shiftKey || event.altKey || event.metaKey || event.code !== 'F12' || event.repeat) {
          return;
        }
        event.preventDefault();
        const bridge = window.__TAURI_NATIVE_CONTROL__;
        if (!bridge || !bridge.available) {
          return;
        }
        bridge.call({
          namespace: 'devObservatory',
          method: 'toggle',
          args: { source: 'hotkey' }
        }).catch(function (error) {
          console.warn('Tauron dev observatory hotkey failed', error);
        });
      }, { capture: true });
    })();
  "#
  .to_string()
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn event_ring_truncates_old_records() {
    let state = DevObservatoryState::default();
    for index in 0..(MAX_EVENTS + 8) {
      state
        .record_event(DevObservatoryEvent {
          source: "test".into(),
          severity: "info".into(),
          message: format!("event-{index}"),
          lane: None,
          system_id: None,
          payload: None,
          at_epoch_ms: index as u64,
        })
        .unwrap();
    }
    let events = state.events();
    assert_eq!(events.len(), MAX_EVENTS);
    assert_eq!(events.first().unwrap().message, "event-8");
  }

  #[test]
  fn provider_snapshot_collects_values() {
    let state = DevObservatoryState::default();
    state
      .register_provider("test.provider", "Test Provider", || {
        Ok(serde_json::json!({ "ok": true }))
      })
      .unwrap();
    let snapshot = state.snapshot();
    assert_eq!(
      snapshot.providers["test.provider"]["value"]["ok"],
      serde_json::json!(true)
    );
  }

  #[test]
  fn rejects_empty_provider_id() {
    let state = DevObservatoryState::default();
    assert!(state
      .register_provider("", "Bad", || Ok(serde_json::json!({})))
      .is_err());
  }
}
