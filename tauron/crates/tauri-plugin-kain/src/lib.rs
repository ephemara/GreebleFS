// Copyright 2019-2024 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
  io::{BufRead, BufReader, Write},
  path::{Path, PathBuf},
  process::{Child, ChildStdin, ChildStdout, Command, Stdio},
  sync::Mutex,
  time::{SystemTime, UNIX_EPOCH},
};
use tauri::{
  plugin::{Builder as PluginBuilder, TauriPlugin},
  AppHandle, Emitter, Manager, Runtime, State, WebviewWindow,
};

pub const PLUGIN_NAME: &str = "kain";
pub const KAIN_TAURI_BRIDGE_SCHEMA_VERSION: u32 = 1;
pub const KAIN_TAURI_BRIDGE_INVOKE_COMMAND: &str = "kain_bridge_dispatch";
pub const KAIN_TAURI_HOT_RELOAD_EVENT: &str = "kain://runtime/reload";
pub const KAIN_TAURI_BRIDGE_READY_EVENT: &str = "kain://bridge/ready";

const BRIDGE_INITIALIZATION_SCRIPT: &str = r#"
if (!window.__KAIN_TAURI__ && window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke) {
  const invokeKain = (command, args) => window.__TAURI_INTERNALS__.invoke(`plugin:kain|${command}`, args || {});
  const dispatch = (request) => invokeKain('dispatch', { request });
  const bridge = Object.freeze({
    status: () => invokeKain('status'),
    manifest: () => invokeKain('manifest'),
    reflection: () => invokeKain('reflection'),
    dispatch,
    invoke: dispatch,
    call: (namespace, method, args, correlationId) => dispatch({ namespace, method, args, correlationId }),
    reload: (reason, strategy) => invokeKain('reload', { reason, strategy })
  });

  Object.defineProperty(window, '__KAIN_TAURI__', {
    configurable: true,
    enumerable: false,
    value: bridge
  });
  Object.defineProperty(window, 'KainTauriBridge', {
    configurable: true,
    enumerable: false,
    value: bridge
  });

  const ready = () => window.dispatchEvent(new CustomEvent('kain:tauri:bridge-ready', {
    detail: { plugin: 'kain', schemaVersion: 1 }
  }));
  if (typeof queueMicrotask === 'function') {
    queueMicrotask(ready);
  } else {
    setTimeout(ready, 0);
  }
}
"#;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(default, rename_all = "camelCase")]
pub struct KainRuntimeProcessConfig {
  pub enabled: bool,
  pub command: Option<PathBuf>,
  pub args: Vec<String>,
  pub cwd: Option<PathBuf>,
  pub entry: Option<PathBuf>,
  #[serde(alias = "dispatch_function")]
  pub dispatch_function: String,
  #[serde(alias = "restart_on_reload")]
  pub restart_on_reload: bool,
}

impl Default for KainRuntimeProcessConfig {
  fn default() -> Self {
    Self {
      enabled: true,
      command: None,
      args: Vec::new(),
      cwd: None,
      entry: None,
      dispatch_function: KAIN_TAURI_BRIDGE_INVOKE_COMMAND.into(),
      restart_on_reload: true,
    }
  }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KainRuntimeProcessStatus {
  pub configured: bool,
  pub enabled: bool,
  pub running: bool,
  pub command: Option<String>,
  pub entry: Option<String>,
  pub cwd: Option<String>,
  pub last_error: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(default, rename_all = "camelCase")]
pub struct KainPluginConfig {
  pub enabled: bool,
  #[serde(alias = "manifest_path")]
  pub manifest_path: Option<PathBuf>,
  pub manifest: Option<Value>,
  pub runtime: Option<KainRuntimeProcessConfig>,
  pub inject_bridge: bool,
  #[serde(alias = "hot_reload_event")]
  pub hot_reload_event: String,
  #[serde(alias = "bridge_ready_event")]
  pub bridge_ready_event: String,
}

impl Default for KainPluginConfig {
  fn default() -> Self {
    Self {
      enabled: true,
      manifest_path: None,
      manifest: None,
      runtime: None,
      inject_bridge: true,
      hot_reload_event: KAIN_TAURI_HOT_RELOAD_EVENT.into(),
      bridge_ready_event: KAIN_TAURI_BRIDGE_READY_EVENT.into(),
    }
  }
}

#[derive(Default, Deserialize)]
#[serde(default, rename_all = "camelCase")]
struct KainPluginConfigPatch {
  enabled: Option<bool>,
  #[serde(alias = "manifest_path")]
  manifest_path: Option<PathBuf>,
  manifest: Option<Value>,
  runtime: Option<KainRuntimeProcessConfig>,
  inject_bridge: Option<bool>,
  #[serde(alias = "hot_reload_event")]
  hot_reload_event: Option<String>,
  #[serde(alias = "bridge_ready_event")]
  bridge_ready_event: Option<String>,
}

impl KainPluginConfig {
  fn apply_json_patch(mut self, value: &Value) -> Self {
    let Ok(patch) = serde_json::from_value::<KainPluginConfigPatch>(value.clone()) else {
      return self;
    };

    if let Some(enabled) = patch.enabled {
      self.enabled = enabled;
    }
    if patch.manifest_path.is_some() {
      self.manifest_path = patch.manifest_path;
    }
    if patch.manifest.is_some() {
      self.manifest = patch.manifest;
    }
    if patch.runtime.is_some() {
      self.runtime = patch.runtime;
    }
    if let Some(inject_bridge) = patch.inject_bridge {
      self.inject_bridge = inject_bridge;
    }
    if let Some(hot_reload_event) = patch.hot_reload_event {
      self.hot_reload_event = hot_reload_event;
    }
    if let Some(bridge_ready_event) = patch.bridge_ready_event {
      self.bridge_ready_event = bridge_ready_event;
    }

    self
  }
}

#[derive(Clone, Debug)]
struct LoadedKainManifest {
  manifest: Value,
  manifest_loaded: bool,
  manifest_path: Option<PathBuf>,
  manifest_error: Option<String>,
}

impl LoadedKainManifest {
  fn default_unloaded() -> Self {
    Self {
      manifest: default_bridge_manifest(),
      manifest_loaded: false,
      manifest_path: None,
      manifest_error: None,
    }
  }
}

pub struct KainPluginState {
  config: KainPluginConfig,
  loaded_manifest: Mutex<LoadedKainManifest>,
  runtime_process: Mutex<Option<KainRuntimeProcess>>,
  runtime_last_error: Mutex<Option<String>>,
  started_at_epoch_ms: u64,
}

impl KainPluginState {
  fn new<R: Runtime>(app: &AppHandle<R>, config: KainPluginConfig) -> Self {
    let loaded_manifest = load_manifest(app, &config);
    Self {
      config,
      loaded_manifest: Mutex::new(loaded_manifest),
      runtime_process: Mutex::new(None),
      runtime_last_error: Mutex::new(None),
      started_at_epoch_ms: epoch_millis(),
    }
  }

  fn loaded_manifest(&self) -> LoadedKainManifest {
    self
      .loaded_manifest
      .lock()
      .map(|manifest| manifest.clone())
      .unwrap_or_else(|_| LoadedKainManifest::default_unloaded())
  }

  fn status(&self) -> KainBridgeStatus {
    let loaded = self.loaded_manifest();
    KainBridgeStatus {
      enabled: self.config.enabled,
      bridge_installed: self.config.inject_bridge,
      manifest_loaded: loaded.manifest_loaded,
      schema_version: schema_version_from_manifest(&loaded.manifest),
      manifest_path: loaded
        .manifest_path
        .as_ref()
        .map(|path| path.to_string_lossy().to_string()),
      manifest_error: loaded.manifest_error,
      app_id: string_field(&loaded.manifest, "appId")
        .or_else(|| string_field(&loaded.manifest, "app_id")),
      app_name: string_field(&loaded.manifest, "appName")
        .or_else(|| string_field(&loaded.manifest, "app_name")),
      window_label: string_field(&loaded.manifest, "windowLabel")
        .or_else(|| string_field(&loaded.manifest, "window_label")),
      hot_reload_event: self.config.hot_reload_event.clone(),
      bridge_ready_event: self.config.bridge_ready_event.clone(),
      runtime: self.runtime_status(),
      started_at_epoch_ms: self.started_at_epoch_ms,
    }
  }

  fn manifest(&self) -> Value {
    self.loaded_manifest().manifest
  }

  fn reflection(&self) -> Value {
    self
      .manifest()
      .get("reflection")
      .cloned()
      .unwrap_or_else(default_reflection_payload)
  }

  fn reload_manifest<R: Runtime>(&self, app: &AppHandle<R>) -> Result<LoadedKainManifest, String> {
    let loaded = load_manifest(app, &self.config);
    *self
      .loaded_manifest
      .lock()
      .map_err(|_| "Kain manifest state lock was poisoned".to_string())? = loaded.clone();
    Ok(loaded)
  }

  fn runtime_status(&self) -> KainRuntimeProcessStatus {
    let configured = self.config.runtime.is_some();
    let runtime_config = self.config.runtime.as_ref();
    let running = self.runtime_running();
    let last_error = self
      .runtime_last_error
      .lock()
      .ok()
      .and_then(|error| error.clone());

    KainRuntimeProcessStatus {
      configured,
      enabled: runtime_config
        .map(|runtime| runtime.enabled)
        .unwrap_or(false),
      running,
      command: runtime_config
        .and_then(|runtime| runtime.command.as_ref())
        .map(|path| path.to_string_lossy().to_string()),
      entry: runtime_config
        .and_then(|runtime| runtime.entry.as_ref())
        .map(|path| path.to_string_lossy().to_string()),
      cwd: runtime_config
        .and_then(|runtime| runtime.cwd.as_ref())
        .map(|path| path.to_string_lossy().to_string()),
      last_error,
    }
  }

  fn runtime_running(&self) -> bool {
    let Ok(mut process) = self.runtime_process.lock() else {
      return false;
    };

    let Some(runtime_process) = process.as_mut() else {
      return false;
    };

    match runtime_process.child.try_wait() {
      Ok(None) => true,
      Ok(Some(_)) => {
        *process = None;
        false
      }
      Err(_) => false,
    }
  }

  fn clear_runtime_process(&self) {
    if let Ok(mut process) = self.runtime_process.lock() {
      *process = None;
    }
  }

  fn set_runtime_error(&self, error: Option<String>) {
    if let Ok(mut runtime_error) = self.runtime_last_error.lock() {
      *runtime_error = error;
    }
  }

  fn dispatch_to_runtime<R: Runtime>(
    &self,
    app: &AppHandle<R>,
    request: &KainBridgeRequest,
  ) -> Result<Value, String> {
    let Some(runtime_config) = self.config.runtime.as_ref() else {
      return Err(format!(
        "Unknown Kain bridge request: {}.{}",
        request.namespace, request.method
      ));
    };

    if !runtime_config.enabled {
      return Err("Kain runtime process bridge is disabled".into());
    }

    let mut process_guard = self
      .runtime_process
      .lock()
      .map_err(|_| "Kain runtime process lock was poisoned".to_string())?;

    let process_needs_restart = match process_guard.as_mut() {
      Some(process) => process.child.try_wait().map(|status| status.is_some()),
      None => Ok(true),
    }
    .map_err(|error| format!("Failed to inspect Kain runtime process: {error}"))?;

    if process_needs_restart {
      *process_guard = Some(spawn_runtime_process(app, runtime_config)?);
    }

    let process = process_guard
      .as_mut()
      .ok_or_else(|| "Kain runtime process did not start".to_string())?;

    match process.dispatch(request) {
      Ok(result) => {
        self.set_runtime_error(None);
        Ok(result)
      }
      Err(error) => {
        self.set_runtime_error(Some(error.clone()));
        *process_guard = None;
        Err(error)
      }
    }
  }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KainBridgeStatus {
  pub enabled: bool,
  pub bridge_installed: bool,
  pub manifest_loaded: bool,
  pub schema_version: u32,
  pub manifest_path: Option<String>,
  pub manifest_error: Option<String>,
  pub app_id: Option<String>,
  pub app_name: Option<String>,
  pub window_label: Option<String>,
  pub hot_reload_event: String,
  pub bridge_ready_event: String,
  pub runtime: KainRuntimeProcessStatus,
  pub started_at_epoch_ms: u64,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KainBridgeRequest {
  pub namespace: String,
  pub method: String,
  #[serde(default)]
  pub args: Value,
  pub correlation_id: Option<String>,
}

#[tauri::command]
fn status(state: State<'_, KainPluginState>) -> KainBridgeStatus {
  state.status()
}

#[tauri::command]
fn manifest(state: State<'_, KainPluginState>) -> Value {
  state.manifest()
}

#[tauri::command]
fn reflection(state: State<'_, KainPluginState>) -> Value {
  state.reflection()
}

#[tauri::command]
fn dispatch<R: Runtime>(
  app: AppHandle<R>,
  window: WebviewWindow<R>,
  state: State<'_, KainPluginState>,
  request: KainBridgeRequest,
) -> Result<Value, String> {
  if !state.config.enabled {
    return Err("Kain bridge is disabled for this application".into());
  }

  let namespace = request.namespace.trim().to_ascii_lowercase();
  let method = request.method.trim().to_ascii_lowercase();

  match (namespace.as_str(), method.as_str()) {
    ("host", "ping") | ("runtime", "ping") => Ok(json!({
      "ok": true,
      "namespace": request.namespace,
      "method": request.method,
      "windowLabel": window.label(),
      "schemaVersion": KAIN_TAURI_BRIDGE_SCHEMA_VERSION,
      "correlationId": request.correlation_id,
    })),
    ("host", "status") | ("runtime", "status") | ("bridge", "status") => {
      serde_json::to_value(state.status()).map_err(|error| error.to_string())
    }
    ("host", "manifest") | ("bridge", "manifest") => Ok(state.manifest()),
    ("host", "reflection") | ("bridge", "reflection") => Ok(state.reflection()),
    ("runtime", "reload") | ("bridge", "reload") => reload(
      app,
      state,
      string_argument(&request.args, "reason"),
      string_argument(&request.args, "strategy"),
    ),
    ("event", "emit") => emit_event(app, &request.args),
    ("window", "reload") => {
      window
        .eval("window.location.reload();")
        .map_err(|error| error.to_string())?;
      Ok(json!({ "ok": true, "namespace": request.namespace, "method": request.method }))
    }
    ("runtime", _) if state.config.runtime.is_none() => Ok(json!({
      "ok": true,
      "status": "accepted",
      "namespace": request.namespace,
      "method": request.method,
      "args": request.args,
      "correlationId": request.correlation_id,
    })),
    _ => state.dispatch_to_runtime(&app, &request),
  }
}

#[tauri::command]
fn reload<R: Runtime>(
  app: AppHandle<R>,
  state: State<'_, KainPluginState>,
  reason: Option<String>,
  strategy: Option<String>,
) -> Result<Value, String> {
  let loaded = state.reload_manifest(&app)?;
  let restart_runtime = state
    .config
    .runtime
    .as_ref()
    .map(|runtime| runtime.restart_on_reload)
    .unwrap_or(false);
  if restart_runtime {
    state.clear_runtime_process();
  }
  let payload = json!({
    "ok": loaded.manifest_error.is_none(),
    "reason": reason.unwrap_or_else(|| "manual".into()),
    "strategy": strategy.unwrap_or_else(|| "manifest".into()),
    "manifestLoaded": loaded.manifest_loaded,
    "manifestPath": loaded.manifest_path.map(|path| path.to_string_lossy().to_string()),
    "manifestError": loaded.manifest_error,
    "schemaVersion": schema_version_from_manifest(&loaded.manifest),
    "runtime": state.runtime_status(),
  });
  app
    .emit(&state.config.hot_reload_event, payload.clone())
    .map_err(|error| error.to_string())?;
  Ok(payload)
}

fn emit_event<R: Runtime>(app: AppHandle<R>, args: &Value) -> Result<Value, String> {
  let event = string_argument(args, "event").ok_or_else(|| {
    "Kain event.emit dispatch requires args.event to be a non-empty string".to_string()
  })?;
  let payload = args.get("payload").cloned().unwrap_or(Value::Null);

  if let Some(target) = string_argument(args, "target") {
    app
      .emit_to(target, &event, payload)
      .map_err(|error| error.to_string())?;
  } else {
    app
      .emit(&event, payload)
      .map_err(|error| error.to_string())?;
  }

  Ok(json!({ "ok": true, "event": event }))
}

struct KainRuntimeProcess {
  child: Child,
  stdin: ChildStdin,
  stdout: BufReader<ChildStdout>,
  next_id: u64,
}

impl KainRuntimeProcess {
  fn dispatch(&mut self, request: &KainBridgeRequest) -> Result<Value, String> {
    self.next_id = self.next_id.saturating_add(1);
    let request_id = self.next_id;
    let mut wire_request = serde_json::to_value(request)
      .map_err(|error| format!("Failed to encode request: {error}"))?;

    match &mut wire_request {
      Value::Object(object) => {
        object.insert("id".into(), Value::from(request_id));
      }
      _ => {
        return Err("Failed to encode Kain bridge request as a JSON object".into());
      }
    }

    let request_line = serde_json::to_string(&wire_request)
      .map_err(|error| format!("Failed to encode request: {error}"))?;
    self
      .stdin
      .write_all(request_line.as_bytes())
      .map_err(|error| format!("Failed to write Kain runtime request: {error}"))?;
    self
      .stdin
      .write_all(b"\n")
      .map_err(|error| format!("Failed to terminate Kain runtime request: {error}"))?;
    self
      .stdin
      .flush()
      .map_err(|error| format!("Failed to flush Kain runtime request: {error}"))?;

    loop {
      let mut line = String::new();
      let bytes_read = self
        .stdout
        .read_line(&mut line)
        .map_err(|error| format!("Failed to read Kain runtime response: {error}"))?;

      if bytes_read == 0 {
        return Err("Kain runtime process closed stdout before responding".into());
      }

      let trimmed = line.trim();
      if trimmed.is_empty() {
        continue;
      }

      let Ok(response) = serde_json::from_str::<Value>(trimmed) else {
        continue;
      };

      if response.get("id").and_then(Value::as_u64) != Some(request_id) {
        continue;
      }

      if response.get("ok").and_then(Value::as_bool).unwrap_or(false) {
        return Ok(response.get("result").cloned().unwrap_or(Value::Null));
      }

      return Err(
        response
          .get("error")
          .and_then(Value::as_str)
          .unwrap_or("Kain runtime request failed without an error message")
          .to_string(),
      );
    }
  }
}

impl Drop for KainRuntimeProcess {
  fn drop(&mut self) {
    let _ = self.child.kill();
    let _ = self.child.wait();
  }
}

fn spawn_runtime_process<R: Runtime>(
  app: &AppHandle<R>,
  config: &KainRuntimeProcessConfig,
) -> Result<KainRuntimeProcess, String> {
  let command_path = resolve_runtime_command(app, config.command.as_deref());
  let cwd = resolve_runtime_cwd(app, config)?;
  let mut command = Command::new(&command_path);
  command.current_dir(&cwd);
  command.stdin(Stdio::piped());
  command.stdout(Stdio::piped());
  command.stderr(Stdio::inherit());

  for arg in &config.args {
    command.arg(arg);
  }

  if let Some(entry) = &config.entry {
    let entry_path = resolve_runtime_entry_path(app, &cwd, entry);
    command
      .arg("bridge")
      .arg("serve")
      .arg("--entry")
      .arg(entry_path)
      .arg("--dispatch-function")
      .arg(&config.dispatch_function);
  }

  let mut child = command.spawn().map_err(|error| {
    format!(
      "Failed to spawn Kain runtime process `{}`: {error}",
      command_path.to_string_lossy()
    )
  })?;
  let stdin = child
    .stdin
    .take()
    .ok_or_else(|| "Kain runtime process did not expose stdin".to_string())?;
  let stdout = child
    .stdout
    .take()
    .ok_or_else(|| "Kain runtime process did not expose stdout".to_string())?;

  Ok(KainRuntimeProcess {
    child,
    stdin,
    stdout: BufReader::new(stdout),
    next_id: 0,
  })
}

fn resolve_runtime_command<R: Runtime>(
  app: &AppHandle<R>,
  configured_command: Option<&Path>,
) -> PathBuf {
  if let Some(command) = configured_command {
    return resolve_path_with_app(app, command);
  }

  for env_name in ["GREEBLEFS_KAIN_EXE", "KAIN_EXE"] {
    if let Some(path) = non_empty_env_path(env_name) {
      return path;
    }
  }

  for candidate in runtime_command_candidates(app) {
    if candidate.exists() {
      return candidate;
    }
  }

  PathBuf::from(if cfg!(windows) { "kain.exe" } else { "kain" })
}

fn resolve_runtime_cwd<R: Runtime>(
  app: &AppHandle<R>,
  config: &KainRuntimeProcessConfig,
) -> Result<PathBuf, String> {
  if let Some(cwd) = &config.cwd {
    return Ok(resolve_path_with_app(app, cwd));
  }

  if let Some(entry) = &config.entry {
    let entry_path = resolve_path_with_app(app, entry);
    if let Some(parent) = entry_path.parent() {
      return Ok(parent.to_path_buf());
    }
  }

  std::env::current_dir().map_err(|error| format!("Failed to resolve current directory: {error}"))
}

fn resolve_runtime_entry_path<R: Runtime>(app: &AppHandle<R>, cwd: &Path, entry: &Path) -> PathBuf {
  if entry.is_absolute() {
    return entry.to_path_buf();
  }

  let cwd_candidate = cwd.join(entry);
  if cwd_candidate.exists() {
    return cwd_candidate;
  }

  resolve_path_with_app(app, entry)
}

fn resolve_path_with_app<R: Runtime>(app: &AppHandle<R>, path: &Path) -> PathBuf {
  if path.is_absolute() {
    return path.to_path_buf();
  }

  if let Ok(current_dir) = std::env::current_dir() {
    let candidate = current_dir.join(path);
    if candidate.exists() {
      return candidate;
    }

    if let Some(parent) = current_dir.parent() {
      let parent_candidate = parent.join(path);
      if parent_candidate.exists() {
        return parent_candidate;
      }
    }
  }

  if let Ok(resource_dir) = app.path().resource_dir() {
    let candidate = resource_dir.join(path);
    if candidate.exists() {
      return candidate;
    }
  }

  path.to_path_buf()
}

fn runtime_command_candidates<R: Runtime>(app: &AppHandle<R>) -> Vec<PathBuf> {
  let executable = if cfg!(windows) { "kain.exe" } else { "kain" };
  let mut candidates = Vec::new();

  if let Ok(resource_dir) = app.path().resource_dir() {
    candidates.push(
      resource_dir
        .join("toolchains")
        .join("kain")
        .join("bin")
        .join(executable),
    );
    candidates.push(
      resource_dir
        .join("toolchains")
        .join("kain")
        .join("payload")
        .join("bin")
        .join(executable),
    );
  }

  if let Ok(current_dir) = std::env::current_dir() {
    candidates.push(
      current_dir
        .join("toolchains")
        .join("kain")
        .join("payload")
        .join("bin")
        .join(executable),
    );
    if let Some(parent) = current_dir.parent() {
      candidates.push(
        parent
          .join("toolchains")
          .join("kain")
          .join("payload")
          .join("bin")
          .join(executable),
      );
    }
  }

  candidates
}

fn non_empty_env_path(name: &str) -> Option<PathBuf> {
  std::env::var_os(name)
    .map(PathBuf::from)
    .filter(|path| !path.as_os_str().is_empty())
}

fn load_manifest<R: Runtime>(app: &AppHandle<R>, config: &KainPluginConfig) -> LoadedKainManifest {
  if let Some(manifest) = &config.manifest {
    return LoadedKainManifest {
      manifest: manifest.clone(),
      manifest_loaded: true,
      manifest_path: None,
      manifest_error: None,
    };
  }

  let Some(manifest_path) = &config.manifest_path else {
    return LoadedKainManifest::default_unloaded();
  };

  let resolved_path = resolve_manifest_path(app, manifest_path);
  match std::fs::read_to_string(&resolved_path) {
    Ok(raw_manifest) => match serde_json::from_str::<Value>(&raw_manifest) {
      Ok(manifest) => LoadedKainManifest {
        manifest,
        manifest_loaded: true,
        manifest_path: Some(resolved_path),
        manifest_error: None,
      },
      Err(error) => LoadedKainManifest {
        manifest: default_bridge_manifest(),
        manifest_loaded: false,
        manifest_path: Some(resolved_path),
        manifest_error: Some(format!("Failed to parse Kain bridge manifest: {error}")),
      },
    },
    Err(error) => LoadedKainManifest {
      manifest: default_bridge_manifest(),
      manifest_loaded: false,
      manifest_path: Some(resolved_path),
      manifest_error: Some(format!("Failed to read Kain bridge manifest: {error}")),
    },
  }
}

fn resolve_manifest_path<R: Runtime>(app: &AppHandle<R>, manifest_path: &Path) -> PathBuf {
  if manifest_path.is_absolute() {
    return manifest_path.to_path_buf();
  }

  if let Ok(resource_dir) = app.path().resource_dir() {
    let candidate = resource_dir.join(manifest_path);
    if candidate.exists() {
      return candidate;
    }
  }

  std::env::current_dir()
    .map(|current_dir| current_dir.join(manifest_path))
    .unwrap_or_else(|_| manifest_path.to_path_buf())
}

fn default_bridge_manifest() -> Value {
  json!({
    "schemaVersion": KAIN_TAURI_BRIDGE_SCHEMA_VERSION,
    "invokeCommand": KAIN_TAURI_BRIDGE_INVOKE_COMMAND,
    "hotReloadEvent": KAIN_TAURI_HOT_RELOAD_EVENT,
    "bridgeReadyEvent": KAIN_TAURI_BRIDGE_READY_EVENT,
    "supportedNamespaces": ["host", "runtime", "bridge", "event", "window"],
    "source": "tauri-plugin-kain"
  })
}

fn default_reflection_payload() -> Value {
  json!({
    "schemaVersion": KAIN_TAURI_BRIDGE_SCHEMA_VERSION,
    "source": "tauri-plugin-kain",
    "availableNamespaces": ["host", "runtime", "bridge", "event", "window"],
  })
}

fn schema_version_from_manifest(manifest: &Value) -> u32 {
  manifest
    .get("schemaVersion")
    .or_else(|| manifest.get("schema_version"))
    .and_then(Value::as_u64)
    .and_then(|version| u32::try_from(version).ok())
    .unwrap_or(KAIN_TAURI_BRIDGE_SCHEMA_VERSION)
}

fn string_field(value: &Value, field_name: &str) -> Option<String> {
  value
    .get(field_name)
    .and_then(Value::as_str)
    .map(str::trim)
    .filter(|value| !value.is_empty())
    .map(ToOwned::to_owned)
}

fn string_argument(value: &Value, field_name: &str) -> Option<String> {
  string_field(value, field_name)
}

fn epoch_millis() -> u64 {
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|duration| duration.as_millis().try_into().unwrap_or(u64::MAX))
    .unwrap_or_default()
}

pub struct Builder {
  config: KainPluginConfig,
}

impl Default for Builder {
  fn default() -> Self {
    Self {
      config: KainPluginConfig::default(),
    }
  }
}

impl Builder {
  pub fn new() -> Self {
    Self::default()
  }

  pub fn enabled(mut self, enabled: bool) -> Self {
    self.config.enabled = enabled;
    self
  }

  pub fn manifest(mut self, manifest: Value) -> Self {
    self.config.manifest = Some(manifest);
    self
  }

  pub fn manifest_path(mut self, manifest_path: impl Into<PathBuf>) -> Self {
    self.config.manifest_path = Some(manifest_path.into());
    self
  }

  pub fn runtime(mut self, runtime: KainRuntimeProcessConfig) -> Self {
    self.config.runtime = Some(runtime);
    self
  }

  pub fn runtime_entry(mut self, entry: impl Into<PathBuf>) -> Self {
    let runtime = self
      .config
      .runtime
      .get_or_insert_with(KainRuntimeProcessConfig::default);
    runtime.entry = Some(entry.into());
    self
  }

  pub fn runtime_command(mut self, command: impl Into<PathBuf>) -> Self {
    let runtime = self
      .config
      .runtime
      .get_or_insert_with(KainRuntimeProcessConfig::default);
    runtime.command = Some(command.into());
    self
  }

  pub fn inject_bridge(mut self, inject_bridge: bool) -> Self {
    self.config.inject_bridge = inject_bridge;
    self
  }

  pub fn hot_reload_event(mut self, hot_reload_event: impl Into<String>) -> Self {
    self.config.hot_reload_event = hot_reload_event.into();
    self
  }

  pub fn bridge_ready_event(mut self, bridge_ready_event: impl Into<String>) -> Self {
    self.config.bridge_ready_event = bridge_ready_event.into();
    self
  }

  pub fn build<R: Runtime>(self) -> TauriPlugin<R, Value> {
    let builder_config = self.config;
    let inject_bridge = builder_config.inject_bridge;
    let setup_config = builder_config.clone();
    let mut plugin = PluginBuilder::<R, Value>::new(PLUGIN_NAME).setup(move |app, api| {
      let config = setup_config.clone().apply_json_patch(api.config());
      let state = KainPluginState::new(app, config.clone());
      let status = serde_json::to_value(state.status())?;
      app.manage(state);

      if config.enabled {
        app.emit(&config.bridge_ready_event, status)?;
      }

      Ok(())
    });

    if inject_bridge {
      plugin = plugin.js_init_script(BRIDGE_INITIALIZATION_SCRIPT);
    }

    plugin
      .invoke_handler(tauri::generate_handler![
        status, manifest, reflection, dispatch, reload
      ])
      .build()
  }
}

pub fn init<R: Runtime>() -> TauriPlugin<R, Value> {
  Builder::default().build()
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn default_manifest_uses_kain_schema_version() {
    let manifest = default_bridge_manifest();
    assert_eq!(
      schema_version_from_manifest(&manifest),
      KAIN_TAURI_BRIDGE_SCHEMA_VERSION
    );
  }

  #[test]
  fn config_patch_accepts_camel_case_and_snake_case() {
    let config = KainPluginConfig::default().apply_json_patch(&json!({
      "enabled": false,
      "manifest_path": "bridge.json",
      "runtime": {
        "entry": "app/main.kn",
        "dispatch_function": "dispatch_ui",
        "restartOnReload": false
      },
      "hotReloadEvent": "kain://custom/reload",
      "bridge_ready_event": "kain://custom/ready"
    }));

    assert!(!config.enabled);
    assert_eq!(config.manifest_path, Some(PathBuf::from("bridge.json")));
    let runtime = config
      .runtime
      .expect("runtime config patch should be accepted");
    assert_eq!(runtime.entry, Some(PathBuf::from("app/main.kn")));
    assert_eq!(runtime.dispatch_function, "dispatch_ui");
    assert!(!runtime.restart_on_reload);
    assert_eq!(config.hot_reload_event, "kain://custom/reload");
    assert_eq!(config.bridge_ready_event, "kain://custom/ready");
  }

  #[test]
  fn initialization_script_installs_global_bridge() {
    assert!(BRIDGE_INITIALIZATION_SCRIPT.contains("__KAIN_TAURI__"));
    assert!(BRIDGE_INITIALIZATION_SCRIPT.contains("plugin:kain|"));
    assert!(BRIDGE_INITIALIZATION_SCRIPT.contains("kain:tauri:bridge-ready"));
  }
}
