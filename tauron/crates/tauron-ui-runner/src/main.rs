// Copyright 2019-2024 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
  collections::VecDeque,
  env, fs, io,
  io::{Read, Write},
  net::{TcpListener, TcpStream},
  path::PathBuf,
  process,
  sync::{
    mpsc::{self, Sender},
    Arc, Mutex,
  },
  thread,
  time::{Duration, SystemTime, UNIX_EPOCH},
};
use tao::{
  dpi::LogicalSize,
  event::{Event, StartCause, WindowEvent},
  event_loop::{ControlFlow, EventLoopBuilder, EventLoopProxy},
  window::WindowBuilder,
};
#[cfg(windows)]
use wry::WebViewBuilderExtWindows;
use wry::{http::Request, PageLoadEvent, WebViewBuilder};

const RUNNER_VERSION: u32 = 1;
const SESSION_MARKER: &str = "TAURON_UI_RUNNER_SESSION ";
const MAX_EVENT_COUNT: usize = 800;
const EVAL_TIMEOUT: Duration = Duration::from_secs(15);

#[derive(Debug, Clone)]
struct RunnerConfig {
  url: String,
  title: String,
  width: f64,
  height: f64,
  rpc_port: u16,
  fixture_path: Option<PathBuf>,
  session_file: Option<PathBuf>,
  devtools: bool,
  visible: bool,
  webview2_visual_hosting_mode: Webview2VisualHostingMode,
  init_scripts: Vec<PathBuf>,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "kebab-case")]
enum Webview2VisualHostingMode {
  Hwnd,
  CompositionController,
}

impl Webview2VisualHostingMode {
  fn parse(value: &str) -> Result<Self, String> {
    match value {
      "hwnd" => Ok(Self::Hwnd),
      "composition-controller" | "compositionController" => Ok(Self::CompositionController),
      _ => Err(format!(
        "invalid WebView2 visual hosting mode {value}; expected hwnd or composition-controller"
      )),
    }
  }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct RunnerSession {
  version: u32,
  pid: u32,
  url: String,
  title: String,
  rpc_port: u16,
  rpc_url: String,
  started_at_epoch_ms: u128,
  fixture_path: Option<String>,
  platform: String,
  webview2_visual_hosting_mode: Webview2VisualHostingMode,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct RunnerEvent {
  sequence: u64,
  kind: String,
  payload: Value,
  created_at_epoch_ms: u128,
}

#[derive(Debug)]
struct RunnerState {
  session: RunnerSession,
  page_url: Option<String>,
  page_loaded: bool,
  event_sequence: u64,
  events: VecDeque<RunnerEvent>,
}

#[derive(Debug)]
enum UserEvent {
  Eval {
    script: String,
    response: Sender<EvalResponse>,
  },
  Close {
    exit_code: i32,
  },
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct EvalRequest {
  script: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct EvalResponse {
  ok: bool,
  result_json: Option<String>,
  error: Option<String>,
}

#[derive(Debug)]
struct HttpRequest {
  method: String,
  path: String,
  body: Vec<u8>,
}

fn main() -> wry::Result<()> {
  let config = parse_config().unwrap_or_else(|error| {
    eprintln!("tauron-ui-runner config error: {error}");
    eprintln!(
      "usage: tauron-ui-runner --url <url> [--port 0] [--fixture file.json] [--session-file file.json] [--webview2-visual-hosting-mode hwnd|composition-controller]"
    );
    process::exit(2);
  });

  let listener = TcpListener::bind(("127.0.0.1", config.rpc_port)).unwrap_or_else(|error| {
    eprintln!("tauron-ui-runner failed to bind RPC listener: {error}");
    process::exit(2);
  });
  let rpc_port = listener
    .local_addr()
    .map(|address| address.port())
    .unwrap_or(config.rpc_port);
  let session = RunnerSession {
    version: RUNNER_VERSION,
    pid: process::id(),
    url: config.url.clone(),
    title: config.title.clone(),
    rpc_port,
    rpc_url: format!("http://127.0.0.1:{rpc_port}"),
    started_at_epoch_ms: epoch_ms(),
    fixture_path: config
      .fixture_path
      .as_ref()
      .map(|path| path.display().to_string()),
    platform: env::consts::OS.to_string(),
    webview2_visual_hosting_mode: config.webview2_visual_hosting_mode,
  };

  write_session(&session, config.session_file.as_ref());
  println!(
    "{SESSION_MARKER}{}",
    serde_json::to_string(&session).unwrap_or_else(|_| "{}".to_string())
  );
  let _ = io::stdout().flush();

  let state = Arc::new(Mutex::new(RunnerState {
    session,
    page_url: None,
    page_loaded: false,
    event_sequence: 0,
    events: VecDeque::with_capacity(MAX_EVENT_COUNT),
  }));

  let event_loop = EventLoopBuilder::<UserEvent>::with_user_event().build();
  let proxy = event_loop.create_proxy();
  start_rpc_server(listener, proxy.clone(), state.clone());

  let window = WindowBuilder::new()
    .with_title(config.title)
    .with_visible(config.visible)
    .with_inner_size(LogicalSize::new(config.width, config.height))
    .build(&event_loop)
    .unwrap_or_else(|error| {
      eprintln!("tauron-ui-runner failed to create window: {error}");
      process::exit(1);
    });

  let fixture = read_fixture(config.fixture_path.as_ref());
  let init_script = build_initialization_script(fixture, &config.init_scripts);
  let ipc_state = state.clone();
  let page_state = state.clone();
  let mut webview_builder = WebViewBuilder::new()
    .with_url(config.url)
    .with_devtools(config.devtools)
    .with_initialization_script(init_script)
    .with_ipc_handler(move |request: Request<String>| {
      append_event(
        &ipc_state,
        "ipc",
        parse_ipc_payload(request.body()).unwrap_or_else(|| json!({ "body": request.body() })),
      );
    })
    .with_on_page_load_handler(move |event, url| {
      if let Ok(mut state) = page_state.lock() {
        state.page_url = Some(url.clone());
        state.page_loaded = matches!(event, PageLoadEvent::Finished);
      }
      append_event(
        &page_state,
        "pageLoad",
        json!({
          "event": match event {
            PageLoadEvent::Started => "started",
            PageLoadEvent::Finished => "finished",
          },
          "url": url,
        }),
      );
    });

  #[cfg(windows)]
  {
    webview_builder = webview_builder.with_webview2_composition_controller(matches!(
      config.webview2_visual_hosting_mode,
      Webview2VisualHostingMode::CompositionController
    ));
  }

  #[cfg(any(
    target_os = "windows",
    target_os = "macos",
    target_os = "ios",
    target_os = "android"
  ))]
  let webview = webview_builder.build(&window)?;
  #[cfg(not(any(
    target_os = "windows",
    target_os = "macos",
    target_os = "ios",
    target_os = "android"
  )))]
  let webview = {
    use tao::platform::unix::WindowExtUnix;
    use wry::WebViewBuilderExtUnix;
    let vbox = window.default_vbox().unwrap();
    webview_builder.build_gtk(vbox)?
  };

  let mut webview = Some(webview);
  let mut exit_code = 0;

  event_loop.run(move |event, _, control_flow| {
    *control_flow = ControlFlow::Wait;

    match event {
      Event::NewEvents(StartCause::Init) => {
        append_event(&state, "runner", json!({ "phase": "started" }));
      }
      Event::WindowEvent {
        event: WindowEvent::CloseRequested,
        ..
      } => {
        let _ = webview.take();
        *control_flow = ControlFlow::Exit;
      }
      Event::UserEvent(UserEvent::Eval { script, response }) => {
        let Some(webview) = webview.as_ref() else {
          let _ = response.send(EvalResponse {
            ok: false,
            result_json: None,
            error: Some("webview is already closed".to_string()),
          });
          return;
        };

        let wrapped_script = wrap_eval_script(&script);
        let sender = response.clone();
        match webview.evaluate_script_with_callback(&wrapped_script, move |result_json| {
          let _ = sender.send(EvalResponse {
            ok: true,
            result_json: Some(result_json),
            error: None,
          });
        }) {
          Ok(()) => {}
          Err(error) => {
            let _ = response.send(EvalResponse {
              ok: false,
              result_json: None,
              error: Some(error.to_string()),
            });
          }
        }
      }
      Event::UserEvent(UserEvent::Close { exit_code: code }) => {
        exit_code = code;
        let _ = webview.take();
        *control_flow = ControlFlow::Exit;
      }
      Event::LoopDestroyed => {
        process::exit(exit_code);
      }
      _ => {}
    }
  });
}

fn parse_config() -> Result<RunnerConfig, String> {
  let mut args = env::args().skip(1);
  let mut url = env::var("TAURON_UI_RUNNER_URL").ok();
  let mut title = env::var("TAURON_UI_RUNNER_TITLE")
    .ok()
    .unwrap_or_else(|| "Tauron UI Runner".to_string());
  let mut width = env_f64("TAURON_UI_RUNNER_WIDTH", 1440.0);
  let mut height = env_f64("TAURON_UI_RUNNER_HEIGHT", 920.0);
  let mut rpc_port = env_u16("TAURON_UI_RUNNER_PORT", 0);
  let mut fixture_path = env::var_os("TAURON_UI_RUNNER_FIXTURE").map(PathBuf::from);
  let mut session_file = env::var_os("TAURON_UI_RUNNER_SESSION_FILE").map(PathBuf::from);
  let mut devtools = env_bool("TAURON_UI_RUNNER_DEVTOOLS", false);
  let mut visible = !env_bool("TAURON_UI_RUNNER_HIDDEN", false);
  let mut webview2_visual_hosting_mode = env::var("TAURON_UI_RUNNER_WEBVIEW2_VISUAL_HOSTING_MODE")
    .ok()
    .map(|value| Webview2VisualHostingMode::parse(&value))
    .transpose()?
    .unwrap_or(Webview2VisualHostingMode::Hwnd);
  let mut init_scripts = Vec::new();

  while let Some(arg) = args.next() {
    match arg.as_str() {
      "--url" => url = args.next(),
      "--title" => {
        title = args
          .next()
          .ok_or_else(|| "--title requires a value".to_string())?
      }
      "--width" => {
        width = args
          .next()
          .ok_or_else(|| "--width requires a value".to_string())?
          .parse::<f64>()
          .map_err(|error| format!("invalid --width: {error}"))?
      }
      "--height" => {
        height = args
          .next()
          .ok_or_else(|| "--height requires a value".to_string())?
          .parse::<f64>()
          .map_err(|error| format!("invalid --height: {error}"))?
      }
      "--port" => {
        rpc_port = args
          .next()
          .ok_or_else(|| "--port requires a value".to_string())?
          .parse::<u16>()
          .map_err(|error| format!("invalid --port: {error}"))?
      }
      "--fixture" => {
        fixture_path = Some(PathBuf::from(
          args
            .next()
            .ok_or_else(|| "--fixture requires a value".to_string())?,
        ))
      }
      "--session-file" => {
        session_file =
          Some(PathBuf::from(args.next().ok_or_else(|| {
            "--session-file requires a value".to_string()
          })?))
      }
      "--init-script" => {
        init_scripts.push(PathBuf::from(
          args
            .next()
            .ok_or_else(|| "--init-script requires a value".to_string())?,
        ));
      }
      "--webview2-visual-hosting-mode" => {
        webview2_visual_hosting_mode = Webview2VisualHostingMode::parse(
          &args
            .next()
            .ok_or_else(|| "--webview2-visual-hosting-mode requires a value".to_string())?,
        )?
      }
      "--devtools" => devtools = true,
      "--no-devtools" => devtools = false,
      "--hidden" => visible = false,
      "--visible" => visible = true,
      "--help" | "-h" => return Err("help requested".to_string()),
      unknown => return Err(format!("unknown argument {unknown}")),
    }
  }

  let url = url.ok_or_else(|| "--url is required".to_string())?;
  Ok(RunnerConfig {
    url,
    title,
    width,
    height,
    rpc_port,
    fixture_path,
    session_file,
    devtools,
    visible,
    webview2_visual_hosting_mode,
    init_scripts,
  })
}

fn start_rpc_server(
  listener: TcpListener,
  proxy: EventLoopProxy<UserEvent>,
  state: Arc<Mutex<RunnerState>>,
) {
  thread::spawn(move || {
    for stream in listener.incoming() {
      match stream {
        Ok(stream) => {
          let proxy = proxy.clone();
          let state = state.clone();
          thread::spawn(move || {
            if let Err(error) = handle_http_connection(stream, proxy, state) {
              eprintln!("tauron-ui-runner RPC error: {error}");
            }
          });
        }
        Err(error) => eprintln!("tauron-ui-runner RPC accept error: {error}"),
      }
    }
  });
}

fn handle_http_connection(
  mut stream: TcpStream,
  proxy: EventLoopProxy<UserEvent>,
  state: Arc<Mutex<RunnerState>>,
) -> io::Result<()> {
  let request = read_http_request(&mut stream)?;
  let response = match (request.method.as_str(), request.path.as_str()) {
    ("GET", "/health") => http_json(200, snapshot_state(&state)),
    ("GET", "/events") => {
      let events = state
        .lock()
        .map(|state| state.events.iter().cloned().collect::<Vec<_>>())
        .unwrap_or_default();
      http_json(200, json!({ "events": events }))
    }
    ("POST", "/eval") => {
      let eval_request = serde_json::from_slice::<EvalRequest>(&request.body);
      match eval_request {
        Ok(eval_request) => {
          let (sender, receiver) = mpsc::channel();
          if let Err(error) = proxy.send_event(UserEvent::Eval {
            script: eval_request.script,
            response: sender,
          }) {
            http_json(
              500,
              json!({
                "ok": false,
                "error": format!("failed to send eval request to UI thread: {error}")
              }),
            )
          } else {
            match receiver.recv_timeout(EVAL_TIMEOUT) {
              Ok(response) => http_json(200, serde_json::to_value(response).unwrap_or(Value::Null)),
              Err(error) => http_json(
                504,
                json!({
                  "ok": false,
                  "error": format!("timed out waiting for eval response: {error}")
                }),
              ),
            }
          }
        }
        Err(error) => http_json(
          400,
          json!({
            "ok": false,
            "error": format!("invalid eval request: {error}")
          }),
        ),
      }
    }
    ("POST", "/close") => {
      let exit_code = serde_json::from_slice::<Value>(&request.body)
        .ok()
        .and_then(|value| value.get("exitCode").and_then(Value::as_i64))
        .unwrap_or(0) as i32;
      let _ = proxy.send_event(UserEvent::Close { exit_code });
      http_json(200, json!({ "ok": true }))
    }
    _ => http_json(
      404,
      json!({
        "ok": false,
        "error": "unknown tauron-ui-runner RPC endpoint"
      }),
    ),
  };

  stream.write_all(response.as_bytes())?;
  stream.flush()
}

fn read_http_request(stream: &mut TcpStream) -> io::Result<HttpRequest> {
  stream.set_read_timeout(Some(Duration::from_secs(10)))?;
  let mut buffer = Vec::new();
  let mut temp = [0_u8; 4096];
  let header_end = loop {
    let read = stream.read(&mut temp)?;
    if read == 0 {
      return Err(io::Error::new(
        io::ErrorKind::UnexpectedEof,
        "connection closed before headers",
      ));
    }
    buffer.extend_from_slice(&temp[..read]);
    if let Some(index) = find_header_end(&buffer) {
      break index;
    }
    if buffer.len() > 128 * 1024 {
      return Err(io::Error::new(
        io::ErrorKind::InvalidData,
        "headers exceeded 128 KiB",
      ));
    }
  };

  let header_text = String::from_utf8_lossy(&buffer[..header_end]);
  let mut lines = header_text.lines();
  let request_line = lines
    .next()
    .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "missing request line"))?;
  let mut request_parts = request_line.split_whitespace();
  let method = request_parts
    .next()
    .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "missing method"))?
    .to_string();
  let path = request_parts
    .next()
    .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "missing path"))?
    .split('?')
    .next()
    .unwrap_or("/")
    .to_string();
  let content_length = lines
    .filter_map(|line| line.split_once(':'))
    .find_map(|(name, value)| {
      if name.trim().eq_ignore_ascii_case("content-length") {
        value.trim().parse::<usize>().ok()
      } else {
        None
      }
    })
    .unwrap_or(0);

  let body_start = header_end + 4;
  let mut body = buffer.get(body_start..).unwrap_or_default().to_vec();
  while body.len() < content_length {
    let read = stream.read(&mut temp)?;
    if read == 0 {
      break;
    }
    body.extend_from_slice(&temp[..read]);
  }
  body.truncate(content_length);

  Ok(HttpRequest { method, path, body })
}

fn find_header_end(buffer: &[u8]) -> Option<usize> {
  buffer.windows(4).position(|window| window == b"\r\n\r\n")
}

fn http_json(status: u16, body: Value) -> String {
  let reason = match status {
    200 => "OK",
    400 => "Bad Request",
    404 => "Not Found",
    500 => "Internal Server Error",
    504 => "Gateway Timeout",
    _ => "OK",
  };
  let body = serde_json::to_string(&body).unwrap_or_else(|_| "{}".to_string());
  format!(
    "HTTP/1.1 {status} {reason}\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
    body.len()
  )
}

fn snapshot_state(state: &Arc<Mutex<RunnerState>>) -> Value {
  state
    .lock()
    .map(|state| {
      json!({
        "ok": true,
        "session": state.session,
        "page": {
          "url": state.page_url,
          "loaded": state.page_loaded,
        },
        "eventCount": state.events.len(),
        "lastEventSequence": state.event_sequence,
      })
    })
    .unwrap_or_else(|_| json!({ "ok": false, "error": "runner state lock poisoned" }))
}

fn append_event(state: &Arc<Mutex<RunnerState>>, kind: impl Into<String>, payload: Value) {
  let Ok(mut state) = state.lock() else {
    return;
  };
  state.event_sequence = state.event_sequence.saturating_add(1);
  let sequence = state.event_sequence;
  if state.events.len() >= MAX_EVENT_COUNT {
    state.events.pop_front();
  }
  state.events.push_back(RunnerEvent {
    sequence,
    kind: kind.into(),
    payload,
    created_at_epoch_ms: epoch_ms(),
  });
}

fn parse_ipc_payload(body: &str) -> Option<Value> {
  serde_json::from_str(body).ok()
}

fn build_initialization_script(fixture: Value, init_scripts: &[PathBuf]) -> String {
  let fixture_json = serde_json::to_string(&fixture).unwrap_or_else(|_| "null".to_string());
  let mut script = format!(
    r#"
(() => {{
  const runnerFixture = {fixture_json};
  const postRunnerMessage = (payload) => {{
    try {{
      const envelope = {{
        source: 'tauron-ui-runner',
        createdAt: Date.now(),
        ...payload,
      }};
      window.ipc?.postMessage(JSON.stringify(envelope));
    }} catch (_) {{}}
  }};
  const summarize = (value) => {{
    if (value instanceof Error) {{
      return {{ name: value.name, message: value.message, stack: value.stack || null }};
    }}
    if (typeof value === 'function') {{
      return `[function ${{value.name || 'anonymous'}}]`;
    }}
    return value;
  }};
  Object.defineProperty(window, '__TAURON_UI_RUNNER__', {{
    configurable: true,
    value: {{
      version: 1,
      fixture: runnerFixture,
      postMessage: postRunnerMessage,
      startedAt: Date.now(),
    }},
  }});
  for (const level of ['debug', 'info', 'log', 'warn', 'error']) {{
    const original = console[level]?.bind(console);
    if (!original) {{
      continue;
    }}
    console[level] = (...values) => {{
      postRunnerMessage({{
        kind: 'console',
        level,
        values: values.map(summarize),
        message: values.map((value) => {{
          if (typeof value === 'string') return value;
          try {{ return JSON.stringify(summarize(value)); }} catch (_) {{ return String(value); }}
        }}).join(' '),
      }});
      original(...values);
    }};
  }}
  window.addEventListener('error', (event) => {{
    postRunnerMessage({{
      kind: 'window-error',
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: summarize(event.error),
    }});
  }});
  window.addEventListener('unhandledrejection', (event) => {{
    postRunnerMessage({{
      kind: 'unhandled-rejection',
      reason: summarize(event.reason),
    }});
  }});
}})();
"#
  );

  for path in init_scripts {
    match fs::read_to_string(path) {
      Ok(extra_script) => {
        script.push_str("\n;(() => {\n");
        script.push_str(&extra_script);
        script.push_str("\n})();\n");
      }
      Err(error) => {
        eprintln!(
          "tauron-ui-runner could not read init script {}: {error}",
          path.display()
        );
      }
    }
  }

  script
}

fn wrap_eval_script(script: &str) -> String {
  format!(
    r#"
(() => {{
  try {{
    const value = (() => {{
{script}
    }})();
    return {{
      ok: true,
      value,
    }};
  }} catch (error) {{
    return {{
      ok: false,
      error: String(error && error.stack ? error.stack : error),
    }};
  }}
}})()
"#
  )
}

fn read_fixture(path: Option<&PathBuf>) -> Value {
  let Some(path) = path else {
    return Value::Null;
  };
  match fs::read_to_string(path) {
    Ok(contents) => serde_json::from_str(&contents).unwrap_or_else(|error| {
      eprintln!(
        "tauron-ui-runner fixture {} is not valid JSON: {error}",
        path.display()
      );
      Value::Null
    }),
    Err(error) => {
      eprintln!(
        "tauron-ui-runner could not read fixture {}: {error}",
        path.display()
      );
      Value::Null
    }
  }
}

fn write_session(session: &RunnerSession, session_file: Option<&PathBuf>) {
  let Some(path) = session_file else {
    return;
  };
  if let Some(parent) = path.parent() {
    if let Err(error) = fs::create_dir_all(parent) {
      eprintln!(
        "tauron-ui-runner could not create session directory {}: {error}",
        parent.display()
      );
      return;
    }
  }
  match serde_json::to_string_pretty(session) {
    Ok(json) => {
      if let Err(error) = fs::write(path, json) {
        eprintln!(
          "tauron-ui-runner could not write session file {}: {error}",
          path.display()
        );
      }
    }
    Err(error) => eprintln!("tauron-ui-runner could not encode session: {error}"),
  }
}

fn env_u16(name: &str, default_value: u16) -> u16 {
  env::var(name)
    .ok()
    .and_then(|value| value.parse::<u16>().ok())
    .unwrap_or(default_value)
}

fn env_f64(name: &str, default_value: f64) -> f64 {
  env::var(name)
    .ok()
    .and_then(|value| value.parse::<f64>().ok())
    .unwrap_or(default_value)
}

fn env_bool(name: &str, default_value: bool) -> bool {
  env::var(name)
    .ok()
    .map(|value| matches!(value.as_str(), "1" | "true" | "TRUE" | "yes" | "YES"))
    .unwrap_or(default_value)
}

fn epoch_ms() -> u128 {
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|duration| duration.as_millis())
    .unwrap_or(0)
}
