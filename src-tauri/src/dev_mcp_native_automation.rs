use std::collections::{HashMap, VecDeque};
use std::env;
use std::fs;
use std::net::TcpListener as StdTcpListener;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use axum::extract::{Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::async_runtime;
use tauri::{AppHandle, Manager};
use tokio::sync::watch;
use uuid::Uuid;

use crate::runtime_pipeline::commands::dispatch_native_dev_host_call;
use crate::runtime_pipeline::{
    ExtensionHostCallRequest, HostEventBusState, HostEventEnvelope, HostSubscriptionRequest,
    RuntimeRegistryState,
};
use crate::secondary_windows::{SecondaryWindowManagerState, SecondaryWindowSurfaceKind};
use crate::telemetry::TelemetryManager;

const ENV_GREEBLEFS_MCP_ENABLED: &str = "GREEBLEFS_MCP_ENABLED";
const ENV_OVERLAYTERM_MCP_ENABLED: &str = "OVERLAYTERM_MCP_ENABLED";
const ENV_GREEBLEFS_MCP_NATIVE_AUTOMATION_FILE: &str = "GREEBLEFS_MCP_NATIVE_AUTOMATION_FILE";
const ENV_OVERLAYTERM_MCP_NATIVE_AUTOMATION_FILE: &str =
    "OVERLAYTERM_MCP_NATIVE_AUTOMATION_FILE";
const MAX_SUBSCRIPTION_EVENTS: usize = 1_024;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DevMcpNativeAutomationCapabilities {
    health: bool,
    host_api: bool,
    host_events: bool,
    telemetry: bool,
    usr_profiles: bool,
    window_metadata: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DevMcpNativeAutomationSessionRecord {
    version: u32,
    pid: u32,
    started_at_unix_ms: u64,
    updated_at_unix_ms: u64,
    file_path: String,
    base_url: String,
    health_url: String,
    rpc_url: String,
    host_events_subscribe_url: String,
    host_events_read_url: String,
    host_events_unsubscribe_url: String,
    auth_token: String,
    capabilities: DevMcpNativeAutomationCapabilities,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DevMcpNativeAutomationWindowRecord {
    window_label: String,
    title: String,
    visible: Option<bool>,
    secondary_window_id: Option<String>,
    secondary_window_kind: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DevMcpNativeAutomationRpcRequest {
    method: String,
    #[serde(default)]
    payload: Option<Value>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DevMcpNativeAutomationRpcResponse {
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NativeHostEventsReadQuery {
    subscription_id: String,
    #[serde(default)]
    after_sequence: Option<u64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NativeHostEventsUnsubscribeRequest {
    subscription_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct NativeHostEventsSubscriptionSummary {
    subscription_id: String,
    host_subscription_id: String,
    created_at_unix_ms: u64,
    updated_at_unix_ms: u64,
    dropped_events: u64,
    latest_sequence: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct NativeHostEventsReadResponse {
    subscription: NativeHostEventsSubscriptionSummary,
    events: Vec<HostEventEnvelope>,
}

#[derive(Debug)]
struct NativeHostEventsSubscriptionState {
    request: HostSubscriptionRequest,
    host_subscription_id: String,
    created_at_unix_ms: u64,
    updated_at_unix_ms: u64,
    dropped_events: u64,
    events: VecDeque<HostEventEnvelope>,
}

impl NativeHostEventsSubscriptionState {
    fn new(request: HostSubscriptionRequest, host_subscription_id: String) -> Self {
        let now = now_unix_ms();
        Self {
            request,
            host_subscription_id,
            created_at_unix_ms: now,
            updated_at_unix_ms: now,
            dropped_events: 0,
            events: VecDeque::new(),
        }
    }

    fn push_event(&mut self, event: HostEventEnvelope) {
        self.updated_at_unix_ms = now_unix_ms();
        if self.events.len() >= MAX_SUBSCRIPTION_EVENTS {
            self.events.pop_front();
            self.dropped_events += 1;
        }
        self.events.push_back(event);
    }

    fn summary(&self, subscription_id: &str) -> NativeHostEventsSubscriptionSummary {
        NativeHostEventsSubscriptionSummary {
            subscription_id: subscription_id.to_string(),
            host_subscription_id: self.host_subscription_id.clone(),
            created_at_unix_ms: self.created_at_unix_ms,
            updated_at_unix_ms: self.updated_at_unix_ms,
            dropped_events: self.dropped_events,
            latest_sequence: self.events.back().map(|event| event.sequence),
        }
    }
}

#[derive(Clone)]
struct DevMcpNativeAutomationState {
    app: AppHandle,
    auth_token: String,
    session_record: DevMcpNativeAutomationSessionRecord,
    subscriptions: Arc<Mutex<HashMap<String, NativeHostEventsSubscriptionState>>>,
}

#[derive(Clone)]
pub struct DevMcpNativeAutomationServerHandle {
    shutdown: watch::Sender<bool>,
    session_file_path: PathBuf,
}

impl Drop for DevMcpNativeAutomationServerHandle {
    fn drop(&mut self) {
        let _ = self.shutdown.send(true);
        let _ = fs::remove_file(&self.session_file_path);
    }
}

pub fn start_dev_mcp_native_automation_server(
    app: &AppHandle,
) -> Result<Option<DevMcpNativeAutomationServerHandle>, String> {
    if !read_enabled_environment_flag() {
        return Ok(None);
    }

    let session_file_path = match resolve_session_file_path() {
        Some(path) => path,
        None => return Ok(None),
    };

    let std_listener = StdTcpListener::bind("127.0.0.1:0")
        .map_err(|error| format!("Failed to bind the dev MCP native automation server: {error}"))?;
    std_listener.set_nonblocking(true).map_err(|error| {
        format!("Failed to configure the dev MCP native automation server socket: {error}")
    })?;
    let socket_addr = std_listener
        .local_addr()
        .map_err(|error| format!("Failed to resolve the dev MCP automation socket address: {error}"))?;
    let auth_token = Uuid::new_v4().to_string();
    let started_at_unix_ms = now_unix_ms();
    let base_url = format!("http://127.0.0.1:{}", socket_addr.port());
    let session_record = DevMcpNativeAutomationSessionRecord {
        version: 1,
        pid: std::process::id(),
        started_at_unix_ms,
        updated_at_unix_ms: started_at_unix_ms,
        file_path: normalize_path_for_json(&session_file_path),
        base_url: base_url.clone(),
        health_url: format!("{base_url}/health"),
        rpc_url: format!("{base_url}/rpc"),
        host_events_subscribe_url: format!("{base_url}/host-events/subscribe"),
        host_events_read_url: format!("{base_url}/host-events/read"),
        host_events_unsubscribe_url: format!("{base_url}/host-events/unsubscribe"),
        auth_token: auth_token.clone(),
        capabilities: DevMcpNativeAutomationCapabilities {
            health: true,
            host_api: true,
            host_events: true,
            telemetry: true,
            usr_profiles: true,
            window_metadata: true,
        },
    };
    write_session_record(&session_file_path, &session_record)?;

    let state = DevMcpNativeAutomationState {
        app: app.clone(),
        auth_token,
        session_record,
        subscriptions: Arc::new(Mutex::new(HashMap::new())),
    };
    let router = Router::new()
        .route("/health", get(handle_health))
        .route("/rpc", post(handle_rpc))
        .route("/host-events/subscribe", post(handle_host_events_subscribe))
        .route("/host-events/read", get(handle_host_events_read))
        .route("/host-events/unsubscribe", post(handle_host_events_unsubscribe))
        .with_state(state);

    let (shutdown_tx, mut shutdown_rx) = watch::channel(false);
    let session_file_path_for_server = session_file_path.clone();
    async_runtime::spawn(async move {
        let listener = match tokio::net::TcpListener::from_std(std_listener) {
            Ok(listener) => listener,
            Err(error) => {
                eprintln!(
                    "GreebleFS: failed to create the Tokio listener for dev MCP native automation: {error}"
                );
                let _ = fs::remove_file(&session_file_path_for_server);
                return;
            }
        };

        let _ = axum::serve(listener, router)
            .with_graceful_shutdown(async move {
                while shutdown_rx.changed().await.is_ok() {
                    if *shutdown_rx.borrow() {
                        break;
                    }
                }
            })
            .await;
    });

    Ok(Some(DevMcpNativeAutomationServerHandle {
        shutdown: shutdown_tx,
        session_file_path,
    }))
}

async fn handle_health(
    State(state): State<DevMcpNativeAutomationState>,
    headers: HeaderMap,
) -> Response {
    match authorize_request(&headers, &state) {
        Ok(()) => Json(serde_json::json!({
            "ok": true,
            "pid": std::process::id(),
            "startedAtUnixMs": state.session_record.started_at_unix_ms,
            "updatedAtUnixMs": now_unix_ms(),
            "windows": collect_window_records(&state.app),
            "subscriptionCount": state.subscriptions.lock().map(|records| records.len()).unwrap_or(0),
            "capabilities": state.session_record.capabilities,
        }))
        .into_response(),
        Err(response) => response,
    }
}

async fn handle_rpc(
    State(state): State<DevMcpNativeAutomationState>,
    headers: HeaderMap,
    Json(request): Json<DevMcpNativeAutomationRpcRequest>,
) -> Response {
    if let Err(response) = authorize_request(&headers, &state) {
        return response;
    }

    let response = match dispatch_rpc_request(&state, request).await {
        Ok(result) => DevMcpNativeAutomationRpcResponse {
            ok: true,
            result: Some(result),
            error: None,
        },
        Err(error) => DevMcpNativeAutomationRpcResponse {
            ok: false,
            result: None,
            error: Some(error),
        },
    };
    Json(response).into_response()
}

async fn handle_host_events_subscribe(
    State(state): State<DevMcpNativeAutomationState>,
    headers: HeaderMap,
    Json(request): Json<HostSubscriptionRequest>,
) -> Response {
    if let Err(response) = authorize_request(&headers, &state) {
        return response;
    }

    match create_native_host_subscription(&state, request) {
        Ok(result) => Json(result).into_response(),
        Err(error) => error_response(StatusCode::BAD_REQUEST, error),
    }
}

async fn handle_host_events_read(
    State(state): State<DevMcpNativeAutomationState>,
    headers: HeaderMap,
    Query(query): Query<NativeHostEventsReadQuery>,
) -> Response {
    if let Err(response) = authorize_request(&headers, &state) {
        return response;
    }

    let records = match state.subscriptions.lock() {
        Ok(records) => records,
        Err(_) => return error_response(StatusCode::INTERNAL_SERVER_ERROR, "Native host-event registry lock poisoned."),
    };
    let record = match records.get(query.subscription_id.as_str()) {
        Some(record) => record,
        None => {
            return error_response(
                StatusCode::NOT_FOUND,
                format!(
                    "Unknown native host-event subscription id: {}",
                    query.subscription_id
                ),
            )
        }
    };

    let events = record
        .events
        .iter()
        .filter(|event| match query.after_sequence {
            Some(after_sequence) => event.sequence > after_sequence,
            None => true,
        })
        .cloned()
        .collect::<Vec<_>>();
    Json(NativeHostEventsReadResponse {
        subscription: record.summary(query.subscription_id.as_str()),
        events,
    })
    .into_response()
}

async fn handle_host_events_unsubscribe(
    State(state): State<DevMcpNativeAutomationState>,
    headers: HeaderMap,
    Json(request): Json<NativeHostEventsUnsubscribeRequest>,
) -> Response {
    if let Err(response) = authorize_request(&headers, &state) {
        return response;
    }

    let removed = match state.subscriptions.lock() {
        Ok(mut records) => records.remove(request.subscription_id.as_str()),
        Err(_) => return error_response(StatusCode::INTERNAL_SERVER_ERROR, "Native host-event registry lock poisoned."),
    };
    let Some(record) = removed else {
        return Json(serde_json::json!({
            "ok": true,
            "unsubscribed": false,
            "subscriptionId": request.subscription_id,
        }))
        .into_response();
    };

    let host_event_bus = state.app.state::<HostEventBusState>();
    let _ = host_event_bus.unsubscribe(&state.app, record.host_subscription_id.as_str());

    Json(serde_json::json!({
        "ok": true,
        "unsubscribed": true,
        "subscriptionId": request.subscription_id,
        "hostSubscriptionId": record.host_subscription_id,
    }))
    .into_response()
}

async fn dispatch_rpc_request(
    state: &DevMcpNativeAutomationState,
    request: DevMcpNativeAutomationRpcRequest,
) -> Result<Value, String> {
    match request.method.as_str() {
        "host.get_api_schema" => {
            let schema = crate::runtime_pipeline::build_extension_host_api_schema();
            serde_json::to_value(schema)
                .map_err(|error| format!("Failed to serialize the extension-host API schema: {error}"))
        }
        "host.call" => {
            let payload = request
                .payload
                .ok_or_else(|| "host.call requires a payload object.".to_string())?;
            let method_id = payload
                .get("methodId")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .ok_or_else(|| "host.call requires a non-empty string methodId.".to_string())?;
            let host_payload_json = payload
                .get("payload")
                .map(serde_json::to_string)
                .transpose()
                .map_err(|error| format!("Failed to encode the native host-call payload: {error}"))?;
            let execution_context = payload
                .get("executionContext")
                .cloned()
                .map(serde_json::from_value)
                .transpose()
                .map_err(|error| format!("Failed to decode host.call executionContext: {error}"))?;
            let response_json = dispatch_native_dev_host_call(
                state.app.clone(),
                &state.app.state::<RuntimeRegistryState>(),
                ExtensionHostCallRequest {
                    caller_plugin_id: None,
                    caller_runtime_id: None,
                    method_id: method_id.to_string(),
                    payload_json: host_payload_json,
                    execution_context,
                },
            )
            .await?;
            serde_json::from_str::<Value>(&response_json).map_err(|error| {
                format!("Failed to decode the native host-call JSON response: {error}")
            })
        }
        "host.events.get_snapshot" => {
            let payload = request
                .payload
                .ok_or_else(|| "host.events.get_snapshot requires a payload object.".to_string())?;
            let subscription_request: HostSubscriptionRequest =
                serde_json::from_value(payload).map_err(|error| {
                    format!("Failed to decode the host-events snapshot request: {error}")
                })?;
            let host_event_bus = state.app.state::<HostEventBusState>();
            serde_json::to_value(host_event_bus.snapshots_for_request(&subscription_request))
                .map_err(|error| {
                    format!("Failed to serialize the native host-events snapshot response: {error}")
                })
        }
        "telemetry.get_status" => serde_json::to_value(crate::telemetry::telemetry_get_status(
            state.app.clone(),
            state.app.state::<TelemetryManager>(),
        )?)
        .map_err(|error| format!("Failed to serialize the native telemetry status: {error}")),
        "telemetry.get_recent_records" => {
            let limit = request
                .payload
                .as_ref()
                .and_then(|value| value.get("limit"))
                .and_then(Value::as_u64)
                .map(|value| value as usize);
            serde_json::to_value(crate::telemetry::telemetry_get_recent_records(
                state.app.state::<TelemetryManager>(),
                limit,
            )?)
            .map_err(|error| format!("Failed to serialize the native telemetry records: {error}"))
        }
        "usr_profiles.get_runtime_snapshot" => serde_json::to_value(
            crate::usr_profiles::usr_profiles_get_runtime_snapshot(state.app.clone()).await?,
        )
        .map_err(|error| {
            format!("Failed to serialize the native USR profile runtime snapshot: {error}")
        }),
        "windows.get_metadata" => serde_json::to_value(collect_window_records(&state.app))
            .map_err(|error| format!("Failed to serialize native window metadata: {error}")),
        other => Err(format!("Unsupported dev MCP native automation RPC method: {other}")),
    }
}

fn create_native_host_subscription(
    state: &DevMcpNativeAutomationState,
    request: HostSubscriptionRequest,
) -> Result<NativeHostEventsReadResponse, String> {
    let subscription_id = Uuid::new_v4().to_string();
    let subscriptions = Arc::clone(&state.subscriptions);
    let subscription_id_for_sink = subscription_id.clone();
    let host_event_bus = state.app.state::<HostEventBusState>();
    let subscription = host_event_bus.subscribe_callback(
        request.clone(),
        "dev-mcp-native-automation".to_string(),
        Arc::new(move |event| {
            if let Ok(mut records) = subscriptions.lock() {
                if let Some(record) = records.get_mut(subscription_id_for_sink.as_str()) {
                    record.push_event(event);
                }
            }
        }),
    )?;

    let mut record =
        NativeHostEventsSubscriptionState::new(request.clone(), subscription.subscription_id);
    let snapshots = host_event_bus.snapshots_for_request(&request);
    for mut event in snapshots {
        event.subscription_id = Some(subscription_id.clone());
        record.push_event(event);
    }

    let response = NativeHostEventsReadResponse {
        subscription: record.summary(subscription_id.as_str()),
        events: record.events.iter().cloned().collect(),
    };

    state
        .subscriptions
        .lock()
        .map_err(|_| "Native host-event registry lock poisoned.".to_string())?
        .insert(subscription_id, record);
    Ok(response)
}

fn collect_window_records(app: &AppHandle) -> Vec<DevMcpNativeAutomationWindowRecord> {
    let secondary_windows = app.state::<SecondaryWindowManagerState>();
    let mut records = app
        .webview_windows()
        .into_iter()
        .map(|(window_label, window)| {
            let descriptor = secondary_windows.find_descriptor_by_window_label(window_label.as_str());
            DevMcpNativeAutomationWindowRecord {
                title: window.title().unwrap_or_else(|_| window_label.clone()),
                visible: window.is_visible().ok(),
                secondary_window_id: descriptor.as_ref().map(|value| value.window_id.clone()),
                secondary_window_kind: descriptor
                    .as_ref()
                    .map(|value| secondary_window_kind_to_string(&value.surface_kind)),
                window_label,
            }
        })
        .collect::<Vec<_>>();
    records.sort_by(|left, right| left.window_label.cmp(&right.window_label));
    records
}

fn secondary_window_kind_to_string(kind: &SecondaryWindowSurfaceKind) -> String {
    match kind {
        SecondaryWindowSurfaceKind::ExplorerPicker => "explorer-picker".to_string(),
        SecondaryWindowSurfaceKind::FileOperations => "file-operations".to_string(),
        SecondaryWindowSurfaceKind::Panel => "panel".to_string(),
        SecondaryWindowSurfaceKind::PluginPanel => "plugin-panel".to_string(),
        SecondaryWindowSurfaceKind::ActionWidget => "action-widget".to_string(),
    }
}

fn authorize_request(
    headers: &HeaderMap,
    state: &DevMcpNativeAutomationState,
) -> Result<(), Response> {
    let provided_token = headers
        .get("x-greeblefs-dev-token")
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty());
    if provided_token == Some(state.auth_token.as_str()) {
        return Ok(());
    }
    Err(error_response(
        StatusCode::UNAUTHORIZED,
        "Unauthorized dev MCP native automation request.",
    ))
}

fn error_response(status: StatusCode, message: impl Into<String>) -> Response {
    (
        status,
        Json(serde_json::json!({
            "ok": false,
            "error": message.into(),
        })),
    )
        .into_response()
}

fn read_enabled_environment_flag() -> bool {
    matches!(
        env::var(ENV_GREEBLEFS_MCP_ENABLED)
            .ok()
            .or_else(|| env::var(ENV_OVERLAYTERM_MCP_ENABLED).ok())
            .as_deref(),
        Some("1" | "true" | "TRUE" | "yes" | "YES")
    )
}

fn resolve_session_file_path() -> Option<PathBuf> {
    env::var(ENV_GREEBLEFS_MCP_NATIVE_AUTOMATION_FILE)
        .ok()
        .or_else(|| env::var(ENV_OVERLAYTERM_MCP_NATIVE_AUTOMATION_FILE).ok())
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
}

fn write_session_record(
    session_file_path: &Path,
    record: &DevMcpNativeAutomationSessionRecord,
) -> Result<(), String> {
    if let Some(parent) = session_file_path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "Failed to create the dev MCP native automation directory {}: {error}",
                parent.display()
            )
        })?;
    }
    let content = serde_json::to_string_pretty(record).map_err(|error| {
        format!("Failed to encode the dev MCP native automation session record: {error}")
    })?;
    fs::write(session_file_path, format!("{content}\n")).map_err(|error| {
        format!(
            "Failed to write the dev MCP native automation session record {}: {error}",
            session_file_path.display()
        )
    })
}

fn normalize_path_for_json(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

fn now_unix_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or_default()
}
