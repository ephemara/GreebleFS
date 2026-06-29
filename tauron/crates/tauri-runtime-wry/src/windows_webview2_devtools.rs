use crate::{WebviewId, WebviewKind};
use serde::Serialize;
use std::{
  collections::BTreeMap,
  env, fs,
  path::{Path, PathBuf},
  process,
  sync::{LazyLock, Mutex},
  time::{SystemTime, UNIX_EPOCH},
};
use tao::window::Theme as TaoTheme;
use tauri_runtime::webview::{ScrollBarStyle, WindowsWebview2VisualHostingMode};

const ENV_TAURON_WEBVIEW2_REMOTE_DEBUGGING_PORT: &str = "TAURON_WEBVIEW2_REMOTE_DEBUGGING_PORT";
const ENV_TAURON_WEBVIEW2_ADDITIONAL_BROWSER_ARGS: &str = "TAURON_WEBVIEW2_ADDITIONAL_BROWSER_ARGS";
const ENV_TAURON_WEBVIEW2_DIAGNOSTICS_FILE: &str = "TAURON_WEBVIEW2_DIAGNOSTICS_FILE";
const ENV_TAURON_WEBVIEW2_LOG: &str = "TAURON_WEBVIEW2_LOG";
const ENV_WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: &str = "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS";

static WINDOWS_WEBVIEW2_DIAGNOSTICS_SESSION: LazyLock<
  Mutex<WindowsWebview2DiagnosticsSessionState>,
> = LazyLock::new(|| Mutex::new(WindowsWebview2DiagnosticsSessionState::new()));

#[derive(Clone, Debug)]
pub struct WindowsWebview2DevtoolsCapture {
  label: String,
  webview_kind: &'static str,
  visual_hosting_mode: &'static str,
  url: String,
  data_directory: Option<String>,
  requested_additional_browser_args: Option<String>,
  tauron_additional_browser_args: Option<String>,
  raw_webview2_additional_browser_arguments_env: Option<String>,
  resolved_additional_browser_args: Option<String>,
  remote_debugging_port: Option<u16>,
  browser_extensions_enabled: bool,
  scroll_bar_style: &'static str,
  devtools_enabled: bool,
  use_https_scheme: bool,
  incognito: bool,
  transparent: bool,
  focused: bool,
  automation_requested: bool,
  automation_context_enabled: bool,
  custom_environment_provided: bool,
  reused_existing_web_context: bool,
  window_theme: &'static str,
  diagnostics_file_path: Option<PathBuf>,
  log_enabled: bool,
  configuration_warnings: Vec<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct WindowsWebview2DiagnosticsSessionState {
  version: u32,
  runtime: String,
  platform: String,
  pid: u32,
  process_path: Option<String>,
  webview_runtime_installed: bool,
  webview_runtime_version: Option<String>,
  diagnostics_file_path: Option<String>,
  session_started_at_unix_ms: u64,
  updated_at_unix_ms: u64,
  last_event: Option<String>,
  last_error: Option<String>,
  recent_events: Vec<WindowsWebview2DiagnosticsEventRecord>,
  webviews: BTreeMap<String, WindowsWebview2SessionWebviewRecord>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct WindowsWebview2DiagnosticsEventRecord {
  name: String,
  detail: Option<String>,
  unix_ms: u64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct WindowsWebview2SessionWebviewRecord {
  label: String,
  status: String,
  webview_kind: String,
  visual_hosting_mode: String,
  webview_id: Option<WebviewId>,
  native_window_handle: Option<String>,
  url: String,
  data_directory: Option<String>,
  requested_additional_browser_args: Option<String>,
  tauron_additional_browser_args: Option<String>,
  raw_webview2_additional_browser_arguments_env: Option<String>,
  resolved_additional_browser_args: Option<String>,
  remote_debugging_port: Option<u16>,
  browser_extensions_enabled: bool,
  scroll_bar_style: String,
  devtools_enabled: bool,
  use_https_scheme: bool,
  incognito: bool,
  transparent: bool,
  focused: bool,
  automation_requested: bool,
  automation_context_enabled: bool,
  custom_environment_provided: bool,
  reused_existing_web_context: bool,
  window_theme: String,
  configuration_warnings: Vec<String>,
  created_at_unix_ms: u64,
  updated_at_unix_ms: u64,
  last_error: Option<String>,
}

impl WindowsWebview2DevtoolsCapture {
  #[allow(clippy::too_many_arguments)]
  pub fn new(
    label: &str,
    webview_kind: WebviewKind,
    visual_hosting_mode: WindowsWebview2VisualHostingMode,
    url: &str,
    data_directory: Option<&Path>,
    requested_additional_browser_args: Option<&str>,
    browser_extensions_enabled: bool,
    scroll_bar_style: ScrollBarStyle,
    devtools_enabled: bool,
    use_https_scheme: bool,
    incognito: bool,
    transparent: bool,
    focused: bool,
    automation_requested: bool,
    automation_context_enabled: bool,
    custom_environment_provided: bool,
    reused_existing_web_context: bool,
    window_theme: TaoTheme,
  ) -> Self {
    let requested_additional_browser_args =
      requested_additional_browser_args.and_then(trimmed_string);
    let tauron_additional_browser_args =
      read_trimmed_environment_variable(ENV_TAURON_WEBVIEW2_ADDITIONAL_BROWSER_ARGS);
    let diagnostics_file_path =
      read_trimmed_environment_variable(ENV_TAURON_WEBVIEW2_DIAGNOSTICS_FILE).map(PathBuf::from);
    let raw_webview2_additional_browser_arguments_env =
      read_trimmed_environment_variable(ENV_WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS);
    let log_enabled = read_boolean_environment_variable(ENV_TAURON_WEBVIEW2_LOG);
    let mut configuration_warnings = Vec::new();
    let mut resolved_additional_browser_args = requested_additional_browser_args.clone();

    if let Some(tauron_additional_browser_args) = tauron_additional_browser_args.as_deref() {
      resolved_additional_browser_args = append_browser_argument_segment(
        resolved_additional_browser_args,
        tauron_additional_browser_args,
      );
    }

    let requested_remote_debugging_port =
      extract_remote_debugging_port(requested_additional_browser_args.as_deref());
    let tauron_additional_args_remote_debugging_port =
      extract_remote_debugging_port(tauron_additional_browser_args.as_deref());
    let raw_webview2_remote_debugging_port =
      extract_remote_debugging_port(raw_webview2_additional_browser_arguments_env.as_deref());

    if let (Some(requested_port), Some(tauron_port)) = (
      requested_remote_debugging_port,
      tauron_additional_args_remote_debugging_port,
    ) {
      if requested_port != tauron_port {
        configuration_warnings.push(format!(
          "{ENV_TAURON_WEBVIEW2_ADDITIONAL_BROWSER_ARGS} requested remote-debugging-port={tauron_port}, but the webview already requested remote-debugging-port={requested_port}. The webview-level request will win."
        ));
      }
    }

    let requested_remote_debugging_port_from_env = match read_trimmed_environment_variable(
      ENV_TAURON_WEBVIEW2_REMOTE_DEBUGGING_PORT,
    ) {
      Some(raw_port) => match raw_port.parse::<u16>() {
        Ok(port) => Some(port),
        Err(_) => {
          configuration_warnings.push(format!(
              "Ignoring {ENV_TAURON_WEBVIEW2_REMOTE_DEBUGGING_PORT}={raw_port} because it is not a valid TCP port."
            ));
          None
        }
      },
      None => None,
    };

    let mut resolved_remote_debugging_port =
      extract_remote_debugging_port(resolved_additional_browser_args.as_deref());

    if let Some(remote_debugging_port) = requested_remote_debugging_port_from_env {
      if let Some(existing_remote_debugging_port) = resolved_remote_debugging_port {
        if existing_remote_debugging_port != remote_debugging_port {
          configuration_warnings.push(format!(
            "Ignoring {ENV_TAURON_WEBVIEW2_REMOTE_DEBUGGING_PORT}={remote_debugging_port} because the resolved browser args already specify remote-debugging-port={existing_remote_debugging_port}."
          ));
        }
      } else {
        resolved_additional_browser_args = append_single_browser_argument(
          resolved_additional_browser_args,
          &format!("--remote-debugging-port={remote_debugging_port}"),
        );
        resolved_remote_debugging_port = Some(remote_debugging_port);
      }
    }

    if let (Some(raw_env_port), Some(resolved_port)) = (
      raw_webview2_remote_debugging_port,
      resolved_remote_debugging_port,
    ) {
      if raw_env_port != resolved_port {
        configuration_warnings.push(format!(
          "{ENV_WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS} requested remote-debugging-port={raw_env_port}, but tauron resolved remote-debugging-port={resolved_port}. Remove one source to avoid ambiguous attach behavior."
        ));
      }
    }

    Self {
      label: label.to_string(),
      webview_kind: match webview_kind {
        WebviewKind::WindowChild => "window-child",
        WebviewKind::WindowContent => "window-content",
      },
      visual_hosting_mode: match visual_hosting_mode {
        WindowsWebview2VisualHostingMode::Hwnd => "hwnd",
        WindowsWebview2VisualHostingMode::CompositionController => "composition-controller",
      },
      url: url.to_string(),
      data_directory: data_directory.map(normalize_path_for_json),
      requested_additional_browser_args,
      tauron_additional_browser_args,
      raw_webview2_additional_browser_arguments_env,
      resolved_additional_browser_args,
      remote_debugging_port: resolved_remote_debugging_port.or(raw_webview2_remote_debugging_port),
      browser_extensions_enabled,
      scroll_bar_style: match scroll_bar_style {
        ScrollBarStyle::Default => "default",
        ScrollBarStyle::FluentOverlay => "fluent-overlay",
        _ => "unknown",
      },
      devtools_enabled,
      use_https_scheme,
      incognito,
      transparent,
      focused,
      automation_requested,
      automation_context_enabled,
      custom_environment_provided,
      reused_existing_web_context,
      window_theme: match window_theme {
        TaoTheme::Light => "light",
        TaoTheme::Dark => "dark",
        _ => "unknown",
      },
      diagnostics_file_path,
      log_enabled,
      configuration_warnings,
    }
  }

  pub fn resolved_additional_browser_args(&self) -> Option<&str> {
    self.resolved_additional_browser_args.as_deref()
  }

  pub fn publish_create_attempt(&self) {
    for warning in &self.configuration_warnings {
      log::warn!("tauron.webview2.warn label={} {}", self.label, warning);
    }

    if self.log_enabled {
      log::info!(
        "tauron.webview2.create-start label={} kind={} visualHosting={} url={} remoteDebuggingPort={:?} dataDirectory={} devtoolsEnabled={} browserExtensionsEnabled={} reusedExistingContext={} customEnvironmentProvided={} resolvedAdditionalBrowserArgs={}",
        self.label,
        self.webview_kind,
        self.visual_hosting_mode,
        self.url,
        self.remote_debugging_port,
        self
          .data_directory
          .as_deref()
          .unwrap_or("<default-app-data-dir>"),
        self.devtools_enabled,
        self.browser_extensions_enabled,
        self.reused_existing_web_context,
        self.custom_environment_provided,
        self
          .resolved_additional_browser_args
          .as_deref()
          .unwrap_or("<none>"),
      );
    }

    if !self.should_publish_session_state() {
      return;
    }

    update_session_state(self.diagnostics_file_path.as_deref(), |session_state| {
      session_state.last_event = Some("webview-create-start".to_string());
      session_state.last_error = None;
      push_session_event(
        session_state,
        "webview-create-start",
        Some(format!(
          "label={} visualHosting={} remoteDebuggingPort={:?}",
          self.label, self.visual_hosting_mode, self.remote_debugging_port
        )),
      );
      session_state.webviews.insert(
        self.label.clone(),
        self.to_session_record("launching", None, None, None),
      );
    });
  }

  pub fn publish_create_success(&self, webview_id: WebviewId, native_window_handle: &str) {
    if self.log_enabled {
      log::info!(
        "tauron.webview2.create-success label={} kind={} visualHosting={} webviewId={} nativeWindowHandle={} remoteDebuggingPort={:?}",
        self.label,
        self.webview_kind,
        self.visual_hosting_mode,
        webview_id,
        native_window_handle,
        self.remote_debugging_port,
      );
    }

    if !self.should_publish_session_state() {
      return;
    }

    update_session_state(self.diagnostics_file_path.as_deref(), |session_state| {
      session_state.last_event = Some("webview-create-success".to_string());
      session_state.last_error = None;
      push_session_event(
        session_state,
        "webview-create-success",
        Some(format!(
          "label={} visualHosting={} webviewId={} nativeWindowHandle={}",
          self.label, self.visual_hosting_mode, webview_id, native_window_handle
        )),
      );
      session_state.webviews.insert(
        self.label.clone(),
        self.to_session_record(
          "created",
          Some(webview_id),
          Some(native_window_handle.to_string()),
          None,
        ),
      );
    });
  }

  pub fn publish_create_failure(&self, error_message: &str) {
    log::error!(
      "tauron.webview2.create-failure label={} kind={} visualHosting={} error={}",
      self.label,
      self.webview_kind,
      self.visual_hosting_mode,
      error_message,
    );

    if !self.should_publish_session_state() {
      return;
    }

    update_session_state(self.diagnostics_file_path.as_deref(), |session_state| {
      session_state.last_event = Some("webview-create-failure".to_string());
      session_state.last_error = Some(error_message.to_string());
      push_session_event(
        session_state,
        "webview-create-failure",
        Some(format!(
          "label={} visualHosting={} error={}",
          self.label, self.visual_hosting_mode, error_message
        )),
      );
      session_state.webviews.insert(
        self.label.clone(),
        self.to_session_record("failed", None, None, Some(error_message.to_string())),
      );
    });
  }

  fn should_publish_session_state(&self) -> bool {
    self.diagnostics_file_path.is_some()
  }

  fn to_session_record(
    &self,
    status: &str,
    webview_id: Option<WebviewId>,
    native_window_handle: Option<String>,
    last_error: Option<String>,
  ) -> WindowsWebview2SessionWebviewRecord {
    let now = unix_time_now_ms();
    WindowsWebview2SessionWebviewRecord {
      label: self.label.clone(),
      status: status.to_string(),
      webview_kind: self.webview_kind.to_string(),
      visual_hosting_mode: self.visual_hosting_mode.to_string(),
      webview_id,
      native_window_handle,
      url: self.url.clone(),
      data_directory: self.data_directory.clone(),
      requested_additional_browser_args: self.requested_additional_browser_args.clone(),
      tauron_additional_browser_args: self.tauron_additional_browser_args.clone(),
      raw_webview2_additional_browser_arguments_env: self
        .raw_webview2_additional_browser_arguments_env
        .clone(),
      resolved_additional_browser_args: self.resolved_additional_browser_args.clone(),
      remote_debugging_port: self.remote_debugging_port,
      browser_extensions_enabled: self.browser_extensions_enabled,
      scroll_bar_style: self.scroll_bar_style.to_string(),
      devtools_enabled: self.devtools_enabled,
      use_https_scheme: self.use_https_scheme,
      incognito: self.incognito,
      transparent: self.transparent,
      focused: self.focused,
      automation_requested: self.automation_requested,
      automation_context_enabled: self.automation_context_enabled,
      custom_environment_provided: self.custom_environment_provided,
      reused_existing_web_context: self.reused_existing_web_context,
      window_theme: self.window_theme.to_string(),
      configuration_warnings: self.configuration_warnings.clone(),
      created_at_unix_ms: now,
      updated_at_unix_ms: now,
      last_error,
    }
  }
}

impl WindowsWebview2DiagnosticsSessionState {
  fn new() -> Self {
    let now = unix_time_now_ms();
    Self {
      version: 1,
      runtime: "tauron-webview2".to_string(),
      platform: "windows".to_string(),
      pid: process::id(),
      process_path: env::current_exe()
        .ok()
        .as_deref()
        .map(normalize_path_for_json),
      webview_runtime_installed: false,
      webview_runtime_version: None,
      diagnostics_file_path: None,
      session_started_at_unix_ms: now,
      updated_at_unix_ms: now,
      last_event: None,
      last_error: None,
      recent_events: Vec::new(),
      webviews: BTreeMap::new(),
    }
  }
}

pub fn publish_runtime_bootstrap(
  webview_runtime_installed: bool,
  webview_runtime_version: Option<&str>,
) {
  let diagnostics_file_path =
    read_trimmed_environment_variable(ENV_TAURON_WEBVIEW2_DIAGNOSTICS_FILE).map(PathBuf::from);
  let log_enabled = read_boolean_environment_variable(ENV_TAURON_WEBVIEW2_LOG);
  let resolved_webview_runtime_version = webview_runtime_version.and_then(trimmed_string);

  if log_enabled {
    log::info!(
      "tauron.webview2.runtime-initialized webviewRuntimeInstalled={} webviewRuntimeVersion={} diagnosticsFile={}",
      webview_runtime_installed,
      resolved_webview_runtime_version
        .as_deref()
        .unwrap_or("<unavailable>"),
      diagnostics_file_path
        .as_deref()
        .map(normalize_path_for_json)
        .unwrap_or_else(|| "<disabled>".to_string()),
    );
  }

  if diagnostics_file_path.is_none() {
    return;
  }

  update_session_state(diagnostics_file_path.as_deref(), |session_state| {
    session_state.webview_runtime_installed = webview_runtime_installed;
    session_state.webview_runtime_version = resolved_webview_runtime_version.clone();
    session_state.last_event = Some("runtime-initialized".to_string());
    session_state.last_error = None;
    push_session_event(
      session_state,
      "runtime-initialized",
      Some(format!(
        "webviewRuntimeInstalled={} webviewRuntimeVersion={}",
        webview_runtime_installed,
        resolved_webview_runtime_version
          .as_deref()
          .unwrap_or("<unavailable>")
      )),
    );
  });
}

pub fn drop_webview_diagnostics_record(label: &str) {
  let should_persist = {
    let mut session_state = WINDOWS_WEBVIEW2_DIAGNOSTICS_SESSION.lock().unwrap();
    let removed = session_state.webviews.remove(label).is_some();
    if !removed {
      return;
    }
    session_state.last_event = Some("webview-dropped".to_string());
    push_session_event(
      &mut session_state,
      "webview-dropped",
      Some(format!("label={label}")),
    );
    session_state.updated_at_unix_ms = unix_time_now_ms();
    session_state.diagnostics_file_path.is_some()
  };

  if should_persist {
    persist_session_state_snapshot();
  }
}

fn update_session_state(
  diagnostics_file_path: Option<&Path>,
  mutate_session_state: impl FnOnce(&mut WindowsWebview2DiagnosticsSessionState),
) {
  {
    let mut session_state = WINDOWS_WEBVIEW2_DIAGNOSTICS_SESSION.lock().unwrap();
    if let Some(diagnostics_file_path) = diagnostics_file_path {
      session_state.diagnostics_file_path = Some(normalize_path_for_json(diagnostics_file_path));
    }
    mutate_session_state(&mut session_state);
    session_state.updated_at_unix_ms = unix_time_now_ms();
  }

  persist_session_state_snapshot();
}

fn persist_session_state_snapshot() {
  let (diagnostics_file_path, payload) = {
    let session_state = WINDOWS_WEBVIEW2_DIAGNOSTICS_SESSION.lock().unwrap();
    let Some(diagnostics_file_path) = session_state.diagnostics_file_path.clone() else {
      return;
    };
    let payload = match serde_json::to_vec_pretty(&*session_state) {
      Ok(payload) => payload,
      Err(error) => {
        log::error!(
          "tauron.webview2.diagnostics-serialize-failure error={}",
          error
        );
        return;
      }
    };
    (PathBuf::from(diagnostics_file_path), payload)
  };

  if let Some(parent_directory) = diagnostics_file_path.parent() {
    if let Err(error) = fs::create_dir_all(parent_directory) {
      log::error!(
        "tauron.webview2.diagnostics-directory-failure path={} error={}",
        normalize_path_for_json(parent_directory),
        error,
      );
      return;
    }
  }

  if let Err(error) = fs::write(&diagnostics_file_path, payload) {
    log::error!(
      "tauron.webview2.diagnostics-write-failure path={} error={}",
      normalize_path_for_json(&diagnostics_file_path),
      error,
    );
  }
}

fn push_session_event(
  session_state: &mut WindowsWebview2DiagnosticsSessionState,
  name: &str,
  detail: Option<String>,
) {
  const MAX_RECENT_EVENTS: usize = 64;

  session_state
    .recent_events
    .push(WindowsWebview2DiagnosticsEventRecord {
      name: name.to_string(),
      detail,
      unix_ms: unix_time_now_ms(),
    });
  if session_state.recent_events.len() > MAX_RECENT_EVENTS {
    let overflow = session_state.recent_events.len() - MAX_RECENT_EVENTS;
    session_state.recent_events.drain(0..overflow);
  }
}

fn unix_time_now_ms() -> u64 {
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|duration| duration.as_millis().min(u64::MAX as u128) as u64)
    .unwrap_or_default()
}

fn normalize_path_for_json(path: &Path) -> String {
  path.to_string_lossy().replace('\\', "/")
}

fn read_trimmed_environment_variable(key: &str) -> Option<String> {
  env::var(key).ok().and_then(trimmed_string)
}

fn read_boolean_environment_variable(key: &str) -> bool {
  matches!(
    read_trimmed_environment_variable(key)
      .as_deref()
      .map(|value| value.to_ascii_lowercase()),
    Some(value) if matches!(value.as_str(), "1" | "true" | "yes" | "on")
  )
}

fn trimmed_string(value: impl AsRef<str>) -> Option<String> {
  let trimmed = value.as_ref().trim();
  if trimmed.is_empty() {
    None
  } else {
    Some(trimmed.to_string())
  }
}

fn append_browser_argument_segment(
  existing_arguments: Option<String>,
  new_segment: &str,
) -> Option<String> {
  let Some(new_segment) = trimmed_string(new_segment) else {
    return existing_arguments;
  };

  match existing_arguments {
    Some(existing_arguments) if existing_arguments.contains(&new_segment) => {
      Some(existing_arguments)
    }
    Some(existing_arguments) => Some(format!("{existing_arguments} {new_segment}")),
    None => Some(new_segment),
  }
}

fn append_single_browser_argument(
  existing_arguments: Option<String>,
  argument: &str,
) -> Option<String> {
  let Some(argument) = trimmed_string(argument) else {
    return existing_arguments;
  };

  match existing_arguments {
    Some(existing_arguments)
      if existing_arguments
        .split_whitespace()
        .any(|existing_argument| existing_argument == argument) =>
    {
      Some(existing_arguments)
    }
    Some(existing_arguments) => Some(format!("{existing_arguments} {argument}")),
    None => Some(argument),
  }
}

fn extract_remote_debugging_port(arguments: Option<&str>) -> Option<u16> {
  const REMOTE_DEBUGGING_PORT_PREFIX: &str = "--remote-debugging-port=";

  arguments.and_then(|arguments| {
    arguments
      .split_whitespace()
      .find_map(|argument| argument.strip_prefix(REMOTE_DEBUGGING_PORT_PREFIX))
      .and_then(|port| port.parse::<u16>().ok())
  })
}
