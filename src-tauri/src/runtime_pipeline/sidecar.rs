//! Generic stdio JSON-lines sidecar lifecycle for `native-sidecar` runtimes.
//!
//! v1 sidecars (`stdio-json-lines`) continue to work through the same
//! request/response action flow they always used.
//!
//! v2 sidecars (`stdio-json-lines-v2`) keep the same action lane but add
//! full-duplex packets for:
//!   - unsolicited host events (`event`, `snapshot`)
//!   - runtime-driven host subscriptions (`subscribe`, `unsubscribe`)
//!   - runtime-driven custom publications (`publish`)
//!   - concurrent nested host calls (`host-call`, `host-response`)

use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Arc, Mutex, MutexGuard};
use std::thread;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::runtime_pipeline::commands::dispatch_runtime_sidecar_host_call;
use crate::runtime_pipeline::extension_host::ExecutionContextSnapshot;
use crate::runtime_pipeline::host_events::{
    HostEventBusState, HostPublishEventRequest, HostSubscriptionRequest,
};
use crate::runtime_pipeline::manifest::{RuntimeCompiler, RuntimeKind, RuntimeManifest};
use crate::runtime_pipeline::registry::RuntimeRegistry;

const SIDECAR_TRANSPORT_V1: &str = "stdio-json-lines";
const SIDECAR_TRANSPORT_V2: &str = "stdio-json-lines-v2";

const SIDECAR_KIND_CALL: &str = "call";
const SIDECAR_KIND_RESPONSE: &str = "response";
const SIDECAR_KIND_SHUTDOWN: &str = "shutdown";
const SIDECAR_KIND_HOST_CALL: &str = "host-call";
const SIDECAR_KIND_HOST_RESPONSE: &str = "host-response";
const SIDECAR_KIND_SUBSCRIBE: &str = "subscribe";
const SIDECAR_KIND_UNSUBSCRIBE: &str = "unsubscribe";
const SIDECAR_KIND_PUBLISH: &str = "publish";
const SIDECAR_KIND_EVENT: &str = "event";
const SIDECAR_KIND_SNAPSHOT: &str = "snapshot";
const SIDECAR_KIND_ACK: &str = "ack";
const SIDECAR_KIND_READY: &str = "ready";
const SIDECAR_KIND_ERROR: &str = "error";

#[derive(Debug, Clone, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ExternalRuntimeSidecarStatus {
    pub runtime_id: String,
    pub running: bool,
    pub pid: Option<u32>,
    pub last_error: Option<String>,
    pub action_ids: Vec<String>,
    pub manifest_dir: String,
}

#[derive(Default)]
pub struct ExternalSidecarManager {
    sessions: Mutex<HashMap<String, ExternalSidecarSession>>,
    last_errors: Mutex<HashMap<String, String>>,
}

struct ExternalSidecarSession {
    runtime_id: String,
    transport: String,
    child: Child,
    pid: u32,
    request_counter: u64,
    manifest_dir: PathBuf,
    action_ids: Vec<String>,
    outbound_tx: Sender<ExternalSidecarPacket>,
    pending_responses: Arc<Mutex<HashMap<String, Sender<ExternalSidecarPacket>>>>,
    current_execution_context: Arc<Mutex<Option<ExecutionContextSnapshot>>>,
    owned_subscription_ids: Arc<Mutex<Vec<String>>>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct ExternalSidecarPacket {
    request_id: String,
    kind: String,
    action_id: Option<String>,
    method_id: Option<String>,
    payload_json: Option<String>,
    cwd: Option<String>,
    environment: Option<HashMap<String, String>>,
    ok: Option<bool>,
    result_json: Option<String>,
    error: Option<String>,
    subscription_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExternalSidecarSubscriptionEnvelope {
    subscription_id: String,
}

#[derive(Debug, Clone, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ExternalRuntimeSidecarCallResponse {
    pub runtime_id: String,
    pub request_id: String,
    pub action_id: String,
    pub result_json: String,
}

impl ExternalSidecarManager {
    fn sessions_guard(&self) -> MutexGuard<'_, HashMap<String, ExternalSidecarSession>> {
        self.sessions
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    fn last_errors_guard(&self) -> MutexGuard<'_, HashMap<String, String>> {
        self.last_errors
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    pub fn status(&self, runtime_id: &str) -> ExternalRuntimeSidecarStatus {
        let last_error = self.last_errors_guard().get(runtime_id).cloned();

        let session_info = self.sessions_guard().get(runtime_id).map(|session| {
            (
                session.pid,
                session.manifest_dir.clone(),
                session.action_ids.clone(),
            )
        });

        match session_info {
            Some((pid, manifest_dir, action_ids)) => ExternalRuntimeSidecarStatus {
                runtime_id: runtime_id.to_string(),
                running: true,
                pid: Some(pid),
                last_error,
                action_ids,
                manifest_dir: manifest_dir.to_string_lossy().to_string(),
            },
            None => ExternalRuntimeSidecarStatus {
                runtime_id: runtime_id.to_string(),
                running: false,
                pid: None,
                last_error,
                action_ids: Vec::new(),
                manifest_dir: String::new(),
            },
        }
    }

    pub fn start(
        &self,
        app: &AppHandle,
        manifest: &RuntimeManifest,
        binary_path: &PathBuf,
    ) -> Result<ExternalRuntimeSidecarStatus, String> {
        if !matches!(manifest.kind, RuntimeKind::NativeSidecar) {
            return Err(format!(
                "runtime {} is not a native-sidecar (kind = {})",
                manifest.id,
                manifest.kind.as_str()
            ));
        }

        if manifest.compiler == RuntimeCompiler::PythonSidecar {
            return Err(
                "Python sidecars stay on the legacy python_sidecar lane; do not start through external runtime manager".to_string(),
            );
        }

        {
            let sessions = self.sessions_guard();
            if sessions.contains_key(&manifest.id) {
                return Ok(self.status(&manifest.id));
            }
        }

        let mut command = Command::new(binary_path);
        command
            .args(&manifest.args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .envs(manifest.env.iter());
        if let Some(cwd) = manifest.working_directory.as_ref() {
            command.current_dir(cwd);
        } else {
            command.current_dir(&manifest.module_dir);
        }

        let mut child = command
            .spawn()
            .map_err(|error| format!("Failed to spawn sidecar {}: {error}", manifest.id))?;

        let pid = child.id();
        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| format!("sidecar {} did not expose stdin", manifest.id))?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| format!("sidecar {} did not expose stdout", manifest.id))?;
        let transport = manifest
            .sidecar
            .as_ref()
            .map(|sidecar| sidecar.transport.trim().to_string())
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| SIDECAR_TRANSPORT_V1.to_string());

        let action_ids = manifest
            .sidecar
            .as_ref()
            .map(|cfg| cfg.actions.iter().map(|action| action.id.clone()).collect())
            .unwrap_or_default();

        let (outbound_tx, outbound_rx) = mpsc::channel::<ExternalSidecarPacket>();
        let pending_responses = Arc::new(Mutex::new(HashMap::new()));
        let current_execution_context = Arc::new(Mutex::new(None));
        let owned_subscription_ids = Arc::new(Mutex::new(Vec::new()));

        spawn_sidecar_writer_thread(
            manifest.id.clone(),
            transport.clone(),
            stdin,
            outbound_rx,
        );
        spawn_sidecar_reader_thread(
            app.clone(),
            manifest.id.clone(),
            transport.clone(),
            stdout,
            outbound_tx.clone(),
            Arc::clone(&pending_responses),
            Arc::clone(&current_execution_context),
            Arc::clone(&owned_subscription_ids),
        );

        let session = ExternalSidecarSession {
            runtime_id: manifest.id.clone(),
            transport,
            child,
            pid,
            request_counter: 0,
            manifest_dir: PathBuf::from(&manifest.manifest_dir),
            action_ids,
            outbound_tx,
            pending_responses,
            current_execution_context,
            owned_subscription_ids,
        };

        let mut sessions = self.sessions_guard();
        sessions.insert(manifest.id.clone(), session);
        drop(sessions);
        self.last_errors_guard().remove(&manifest.id);

        Ok(self.status(&manifest.id))
    }

    pub fn stop(&self, app: &AppHandle, runtime_id: &str) -> ExternalRuntimeSidecarStatus {
        let mut sessions = self.sessions_guard();
        if let Some(mut session) = sessions.remove(runtime_id) {
            let _ = session.outbound_tx.send(ExternalSidecarPacket {
                request_id: format!("{runtime_id}-shutdown"),
                kind: SIDECAR_KIND_SHUTDOWN.to_string(),
                ..ExternalSidecarPacket::default()
            });
            cleanup_sidecar_subscriptions(app, &session);
            let _ = session.child.kill();
            let _ = session.child.wait();
        }
        drop(sessions);
        self.status(runtime_id)
    }

    pub fn call(
        &self,
        runtime_id: &str,
        action_id: &str,
        payload_json: Option<String>,
        cwd: Option<String>,
        environment: Option<HashMap<String, String>>,
        execution_context: Option<ExecutionContextSnapshot>,
    ) -> Result<ExternalRuntimeSidecarCallResponse, String> {
        let (request_id, outbound_tx, pending_responses, current_execution_context) = {
            let mut sessions = self.sessions_guard();
            let session = sessions
                .get_mut(runtime_id)
                .ok_or_else(|| format!("runtime {} sidecar is not running", runtime_id))?;
            session.request_counter += 1;
            (
                format!("{}-{}", session.runtime_id, session.request_counter),
                session.outbound_tx.clone(),
                Arc::clone(&session.pending_responses),
                Arc::clone(&session.current_execution_context),
            )
        };

        {
            let mut guard = current_execution_context
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            *guard = execution_context;
        }

        let (response_tx, response_rx) = mpsc::channel::<ExternalSidecarPacket>();
        pending_responses
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .insert(request_id.clone(), response_tx);

        let send_result = outbound_tx.send(ExternalSidecarPacket {
            request_id: request_id.clone(),
            kind: SIDECAR_KIND_CALL.to_string(),
            action_id: Some(action_id.to_string()),
            payload_json,
            cwd,
            environment,
            ..ExternalSidecarPacket::default()
        });
        if let Err(error) = send_result {
            pending_responses
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner())
                .remove(&request_id);
            self.last_errors_guard()
                .insert(runtime_id.to_string(), error.to_string());
            return Err(format!("failed to send sidecar call packet: {error}"));
        }

        let response = response_rx
            .recv()
            .map_err(|error| format!("sidecar {} did not respond: {error}", runtime_id))?;
        {
            let mut guard = current_execution_context
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            *guard = None;
        }

        if response.ok != Some(true) {
            let message = response
                .error
                .clone()
                .unwrap_or_else(|| "sidecar reported failure with no message".to_string());
            self.last_errors_guard()
                .insert(runtime_id.to_string(), message.clone());
            return Err(message);
        }

        Ok(ExternalRuntimeSidecarCallResponse {
            runtime_id: runtime_id.to_string(),
            request_id,
            action_id: action_id.to_string(),
            result_json: response
                .result_json
                .unwrap_or_else(|| "null".to_string()),
        })
    }
}

fn spawn_sidecar_writer_thread(
    runtime_id: String,
    transport: String,
    mut stdin: ChildStdin,
    outbound_rx: Receiver<ExternalSidecarPacket>,
) {
    thread::spawn(move || {
        while let Ok(packet) = outbound_rx.recv() {
            if let Err(error) = write_packet_line(&mut stdin, &packet) {
                eprintln!(
                    "[greeblefs-runtime] failed to write {} sidecar packet for {}: {}",
                    transport, runtime_id, error
                );
                break;
            }
            if packet.kind == SIDECAR_KIND_SHUTDOWN {
                break;
            }
        }
    });
}

fn spawn_sidecar_reader_thread(
    app: AppHandle,
    runtime_id: String,
    transport: String,
    stdout: ChildStdout,
    outbound_tx: Sender<ExternalSidecarPacket>,
    pending_responses: Arc<Mutex<HashMap<String, Sender<ExternalSidecarPacket>>>>,
    current_execution_context: Arc<Mutex<Option<ExecutionContextSnapshot>>>,
    owned_subscription_ids: Arc<Mutex<Vec<String>>>,
) {
    thread::spawn(move || {
        let mut stdout_reader = BufReader::new(stdout);
        loop {
            let mut line = String::new();
            let bytes = match stdout_reader.read_line(&mut line) {
                Ok(bytes) => bytes,
                Err(error) => {
                    resolve_pending_sidecar_failures(
                        &pending_responses,
                        format!("failed to read sidecar stdout: {error}"),
                    );
                    break;
                }
            };
            if bytes == 0 {
                resolve_pending_sidecar_failures(
                    &pending_responses,
                    "sidecar exited before returning a response".to_string(),
                );
                break;
            }
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }

            let packet: ExternalSidecarPacket = match serde_json::from_str(trimmed) {
                Ok(packet) => packet,
                Err(error) => {
                    resolve_pending_sidecar_failures(
                        &pending_responses,
                        format!("failed to parse sidecar packet: {error}"),
                    );
                    break;
                }
            };

            match packet.kind.as_str() {
                SIDECAR_KIND_HOST_CALL => {
                    let execution_context = current_execution_context
                        .lock()
                        .unwrap_or_else(|poisoned| poisoned.into_inner())
                        .clone()
                        .or_else(|| {
                            let host_event_bus = app.state::<HostEventBusState>();
                            host_event_bus.active_execution_context_snapshot()
                        });
                    let runtime_registry = app.state::<RuntimeRegistry>();
                    let result = dispatch_runtime_sidecar_host_call(
                        &app,
                        &runtime_registry,
                        runtime_id.as_str(),
                        packet.method_id.as_deref().unwrap_or_default(),
                        packet.payload_json.clone(),
                        execution_context,
                    );
                    let response_packet = match result {
                        Ok(result_json) => ExternalSidecarPacket {
                            request_id: packet.request_id.clone(),
                            kind: SIDECAR_KIND_HOST_RESPONSE.to_string(),
                            ok: Some(true),
                            result_json: Some(result_json),
                            ..ExternalSidecarPacket::default()
                        },
                        Err(error) => ExternalSidecarPacket {
                            request_id: packet.request_id.clone(),
                            kind: SIDECAR_KIND_HOST_RESPONSE.to_string(),
                            ok: Some(false),
                            error: Some(error),
                            ..ExternalSidecarPacket::default()
                        },
                    };
                    let _ = outbound_tx.send(response_packet);
                }
                SIDECAR_KIND_SUBSCRIBE => {
                    handle_runtime_sidecar_subscription_packet(
                        &app,
                        &runtime_id,
                        &transport,
                        packet,
                        &outbound_tx,
                        &owned_subscription_ids,
                    );
                }
                SIDECAR_KIND_UNSUBSCRIBE => {
                    handle_runtime_sidecar_unsubscribe_packet(
                        &app,
                        &runtime_id,
                        packet,
                        &outbound_tx,
                        &owned_subscription_ids,
                    );
                }
                SIDECAR_KIND_PUBLISH => {
                    handle_runtime_sidecar_publish_packet(
                        &app,
                        &runtime_id,
                        packet,
                        &outbound_tx,
                    );
                }
                SIDECAR_KIND_ACK
                | SIDECAR_KIND_HOST_RESPONSE
                | SIDECAR_KIND_RESPONSE
                | SIDECAR_KIND_READY
                | SIDECAR_KIND_ERROR
                | "" => {
                    resolve_pending_sidecar_response(&pending_responses, packet);
                }
                _ => {
                    resolve_pending_sidecar_response(&pending_responses, packet);
                }
            }
        }
    });
}

fn resolve_pending_sidecar_response(
    pending_responses: &Arc<Mutex<HashMap<String, Sender<ExternalSidecarPacket>>>>,
    packet: ExternalSidecarPacket,
) {
    if let Some(sender) = pending_responses
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .remove(packet.request_id.as_str())
    {
        let _ = sender.send(packet);
    }
}

fn resolve_pending_sidecar_failures(
    pending_responses: &Arc<Mutex<HashMap<String, Sender<ExternalSidecarPacket>>>>,
    error: String,
) {
    let mut pending = pending_responses
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    let senders = pending.drain().map(|(_, sender)| sender).collect::<Vec<_>>();
    drop(pending);
    for sender in senders {
        let _ = sender.send(ExternalSidecarPacket {
            request_id: "sidecar-failure".to_string(),
            kind: SIDECAR_KIND_ERROR.to_string(),
            ok: Some(false),
            error: Some(error.clone()),
            ..ExternalSidecarPacket::default()
        });
    }
}

fn handle_runtime_sidecar_subscription_packet(
    app: &AppHandle,
    runtime_id: &str,
    transport: &str,
    packet: ExternalSidecarPacket,
    outbound_tx: &Sender<ExternalSidecarPacket>,
    owned_subscription_ids: &Arc<Mutex<Vec<String>>>,
) {
    if transport != SIDECAR_TRANSPORT_V2 {
        let _ = outbound_tx.send(ExternalSidecarPacket {
            request_id: packet.request_id,
            kind: SIDECAR_KIND_ACK.to_string(),
            ok: Some(false),
            error: Some(
                "Host subscriptions require `stdio-json-lines-v2` transport.".to_string(),
            ),
            ..ExternalSidecarPacket::default()
        });
        return;
    }

    let payload_json = packet.payload_json.unwrap_or_else(|| "null".to_string());
    let request: HostSubscriptionRequest = match serde_json::from_str(payload_json.as_str()) {
        Ok(request) => request,
        Err(error) => {
            let _ = outbound_tx.send(ExternalSidecarPacket {
                request_id: packet.request_id,
                kind: SIDECAR_KIND_ACK.to_string(),
                ok: Some(false),
                error: Some(format!("Invalid subscribe payload: {error}")),
                ..ExternalSidecarPacket::default()
            });
            return;
        }
    };

    let host_event_bus = app.state::<HostEventBusState>();
    let runtime_id_for_scope = runtime_id.to_string();
    let sender = outbound_tx.clone();
    let subscription = host_event_bus.subscribe_callback(
        request.clone(),
        format!("runtime-sidecar:{runtime_id}"),
        Arc::new(move |event| {
            let payload_json = serde_json::to_string(&event).ok();
            let _ = sender.send(ExternalSidecarPacket {
                request_id: event.event_id.clone(),
                kind: if event.snapshot {
                    SIDECAR_KIND_SNAPSHOT.to_string()
                } else {
                    SIDECAR_KIND_EVENT.to_string()
                },
                payload_json,
                subscription_id: event.subscription_id.clone(),
                ..ExternalSidecarPacket::default()
            });
        }),
    );

    match subscription {
        Ok(subscription) => {
            owned_subscription_ids
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner())
                .push(subscription.subscription_id.clone());
            let _ = outbound_tx.send(ExternalSidecarPacket {
                request_id: packet.request_id.clone(),
                kind: SIDECAR_KIND_ACK.to_string(),
                ok: Some(true),
                result_json: serde_json::to_string(&subscription).ok(),
                subscription_id: Some(subscription.subscription_id.clone()),
                ..ExternalSidecarPacket::default()
            });

            if request.include_snapshot {
                let snapshots = host_event_bus.snapshots_for_request(&request);
                for mut snapshot in snapshots {
                    snapshot.subscription_id = Some(subscription.subscription_id.clone());
                    snapshot.scope.runtime_id = Some(runtime_id_for_scope.clone());
                    let _ = outbound_tx.send(ExternalSidecarPacket {
                        request_id: snapshot.event_id.clone(),
                        kind: SIDECAR_KIND_SNAPSHOT.to_string(),
                        payload_json: serde_json::to_string(&snapshot).ok(),
                        subscription_id: Some(subscription.subscription_id.clone()),
                        ..ExternalSidecarPacket::default()
                    });
                }
            }
        }
        Err(error) => {
            let _ = outbound_tx.send(ExternalSidecarPacket {
                request_id: packet.request_id,
                kind: SIDECAR_KIND_ACK.to_string(),
                ok: Some(false),
                error: Some(error),
                ..ExternalSidecarPacket::default()
            });
        }
    }
}

fn handle_runtime_sidecar_unsubscribe_packet(
    app: &AppHandle,
    _runtime_id: &str,
    packet: ExternalSidecarPacket,
    outbound_tx: &Sender<ExternalSidecarPacket>,
    owned_subscription_ids: &Arc<Mutex<Vec<String>>>,
) {
    let subscription_id = packet
        .subscription_id
        .clone()
        .or_else(|| {
            packet.payload_json.as_ref().and_then(|payload_json| {
                serde_json::from_str::<ExternalSidecarSubscriptionEnvelope>(payload_json)
                    .ok()
                    .map(|payload| payload.subscription_id)
            })
        })
        .unwrap_or_default();
    if subscription_id.trim().is_empty() {
        let _ = outbound_tx.send(ExternalSidecarPacket {
            request_id: packet.request_id,
            kind: SIDECAR_KIND_ACK.to_string(),
            ok: Some(false),
            error: Some("unsubscribe requires a subscriptionId".to_string()),
            ..ExternalSidecarPacket::default()
        });
        return;
    }

    let host_event_bus = app.state::<HostEventBusState>();
    let removed = host_event_bus.unsubscribe(subscription_id.as_str());
    owned_subscription_ids
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .retain(|value| value != subscription_id.as_str());
    let _ = outbound_tx.send(ExternalSidecarPacket {
        request_id: packet.request_id,
        kind: SIDECAR_KIND_ACK.to_string(),
        ok: Some(true),
        result_json: serde_json::to_string(&removed).ok(),
        subscription_id: Some(subscription_id),
        ..ExternalSidecarPacket::default()
    });
}

fn handle_runtime_sidecar_publish_packet(
    app: &AppHandle,
    runtime_id: &str,
    packet: ExternalSidecarPacket,
    outbound_tx: &Sender<ExternalSidecarPacket>,
) {
    let payload_json = packet.payload_json.unwrap_or_else(|| "null".to_string());
    let payload: HostPublishEventRequest = match serde_json::from_str(payload_json.as_str()) {
        Ok(payload) => payload,
        Err(error) => {
            let _ = outbound_tx.send(ExternalSidecarPacket {
                request_id: packet.request_id,
                kind: SIDECAR_KIND_ACK.to_string(),
                ok: Some(false),
                error: Some(format!("Invalid publish payload: {error}")),
                ..ExternalSidecarPacket::default()
            });
            return;
        }
    };
    let host_event_bus = app.state::<HostEventBusState>();
    let execution_context = host_event_bus.active_execution_context_snapshot();
    let result = host_event_bus.publish_extension_event(
        payload.topic.as_str(),
        payload.payload_json,
        execution_context,
        Some(runtime_id),
    );
    match result {
        Ok(envelope) => {
            let _ = outbound_tx.send(ExternalSidecarPacket {
                request_id: packet.request_id,
                kind: SIDECAR_KIND_ACK.to_string(),
                ok: Some(true),
                result_json: serde_json::to_string(&envelope).ok(),
                ..ExternalSidecarPacket::default()
            });
        }
        Err(error) => {
            let _ = outbound_tx.send(ExternalSidecarPacket {
                request_id: packet.request_id,
                kind: SIDECAR_KIND_ACK.to_string(),
                ok: Some(false),
                error: Some(error),
                ..ExternalSidecarPacket::default()
            });
        }
    }
}

fn cleanup_sidecar_subscriptions(app: &AppHandle, session: &ExternalSidecarSession) {
    let subscription_ids = session
        .owned_subscription_ids
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .clone();
    if subscription_ids.is_empty() {
        return;
    }
    let host_event_bus = app.state::<HostEventBusState>();
    for subscription_id in subscription_ids {
        host_event_bus.unsubscribe(subscription_id.as_str());
    }
}

fn write_packet_line(
    stdin: &mut ChildStdin,
    packet: &ExternalSidecarPacket,
) -> Result<(), String> {
    let serialized = serde_json::to_string(packet)
        .map_err(|error| format!("failed to encode sidecar packet: {error}"))?;
    stdin
        .write_all(serialized.as_bytes())
        .and_then(|_| stdin.write_all(b"\n"))
        .and_then(|_| stdin.flush())
        .map_err(|error| format!("failed to write to sidecar stdin: {error}"))?;
    Ok(())
}
