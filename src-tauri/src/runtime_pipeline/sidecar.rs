//! Generic stdio JSON-lines sidecar lifecycle for `native-sidecar` runtimes.
//!
//! The Python sidecar already implements this protocol; this module provides
//! the polyglot version so Go-authored sidecars (and future Rust/JS ones) can
//! ride the same lifecycle.
//!
//! Wire protocol (one JSON object per line, both directions):
//! ```jsonc
//! { "requestId": "1", "kind": "call", "actionId": "echo", "payloadJson": "{}" }
//! ```
//! response:
//! ```jsonc
//! { "requestId": "1", "ok": true, "resultJson": "{...}", "error": null }
//! ```

use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use std::sync::{Mutex, MutexGuard};

use serde::{Deserialize, Serialize};

use crate::runtime_pipeline::manifest::{RuntimeCompiler, RuntimeKind, RuntimeManifest};

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
    child: Child,
    stdin: ChildStdin,
    stdout: BufReader<ChildStdout>,
    pid: u32,
    request_counter: u64,
    manifest_dir: PathBuf,
    action_ids: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ExternalSidecarRequest<'a> {
    request_id: String,
    kind: &'a str,
    action_id: Option<String>,
    method_id: Option<String>,
    payload_json: Option<String>,
    cwd: Option<String>,
    environment: Option<HashMap<String, String>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExternalSidecarPacketEnvelope {
    request_id: String,
    #[serde(default)]
    kind: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExternalSidecarResponse {
    request_id: String,
    ok: bool,
    result_json: Option<String>,
    error: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExternalSidecarHostCallRequest {
    pub request_id: String,
    pub kind: String,
    pub method_id: String,
    #[serde(default)]
    pub payload_json: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ExternalSidecarHostCallResponse {
    request_id: String,
    kind: &'static str,
    ok: bool,
    result_json: Option<String>,
    error: Option<String>,
}

const SIDECAR_KIND_HOST_CALL: &str = "host-call";
const SIDECAR_KIND_HOST_RESPONSE: &str = "host-response";

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
        let last_error = self
            .last_errors_guard()
            .get(runtime_id)
            .cloned();

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
            let map = self.sessions_guard();
            if map.contains_key(&manifest.id) {
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
        let stdout = BufReader::new(stdout);

        let action_ids = manifest
            .sidecar
            .as_ref()
            .map(|cfg| cfg.actions.iter().map(|a| a.id.clone()).collect())
            .unwrap_or_default();

        let session = ExternalSidecarSession {
            runtime_id: manifest.id.clone(),
            child,
            stdin,
            stdout,
            pid,
            request_counter: 0,
            manifest_dir: PathBuf::from(&manifest.manifest_dir),
            action_ids,
        };

        let mut sessions = self.sessions_guard();
        sessions.insert(manifest.id.clone(), session);
        drop(sessions);

        self.last_errors_guard().remove(&manifest.id);

        Ok(self.status(&manifest.id))
    }

    pub fn stop(&self, runtime_id: &str) -> ExternalRuntimeSidecarStatus {
        let mut sessions = self.sessions_guard();
        if let Some(mut session) = sessions.remove(runtime_id) {
            let _ = session
                .send_request("shutdown", None, None, None, None, None, |_, _, _| {
                    Err("host bridge calls are not allowed during shutdown".to_string())
                })
                .map_err(|error| {
                    self.last_errors_guard()
                        .insert(session.runtime_id.clone(), error);
                });
            let _ = session.child.kill();
            let _ = session.child.wait();
        }
        drop(sessions);
        self.status(runtime_id)
    }

    pub fn call<F>(
        &self,
        runtime_id: &str,
        action_id: &str,
        payload_json: Option<String>,
        cwd: Option<String>,
        environment: Option<HashMap<String, String>>,
        host_bridge_dispatch: F,
    ) -> Result<ExternalRuntimeSidecarCallResponse, String>
    where
        F: FnMut(&str, &str, Option<String>) -> Result<String, String>,
    {
        let mut sessions = self.sessions_guard();
        let session = sessions
            .get_mut(runtime_id)
            .ok_or_else(|| format!("runtime {} sidecar is not running", runtime_id))?;

        let response = session
            .send_request(
                "call",
                Some(action_id.to_string()),
                None,
                payload_json,
                cwd,
                environment,
                host_bridge_dispatch,
            )
            .map_err(|error| {
                self.last_errors_guard()
                    .insert(runtime_id.to_string(), error.clone());
                error
            })?;

        if !response.ok {
            let message = response
                .error
                .clone()
                .unwrap_or_else(|| "sidecar reported failure with no message".to_string());
            return Err(message);
        }

        Ok(ExternalRuntimeSidecarCallResponse {
            runtime_id: runtime_id.to_string(),
            request_id: response.request_id,
            action_id: action_id.to_string(),
            result_json: response.result_json.unwrap_or_else(|| "null".to_string()),
        })
    }
}

impl ExternalSidecarSession {
    fn send_request<F>(
        &mut self,
        kind: &str,
        action_id: Option<String>,
        method_id: Option<String>,
        payload_json: Option<String>,
        cwd: Option<String>,
        environment: Option<HashMap<String, String>>,
        mut host_bridge_dispatch: F,
    ) -> Result<ExternalSidecarResponse, String>
    where
        F: FnMut(&str, &str, Option<String>) -> Result<String, String>,
    {
        self.request_counter += 1;
        let request_id = format!("{}-{}", self.runtime_id, self.request_counter);
        let request = ExternalSidecarRequest {
            request_id: request_id.clone(),
            kind,
            action_id,
            method_id,
            payload_json,
            cwd,
            environment,
        };
        self.write_packet_line(&request)?;

        loop {
            let mut line = String::new();
            let bytes = self
                .stdout
                .read_line(&mut line)
                .map_err(|error| format!("failed to read sidecar stdout: {error}"))?;
            if bytes == 0 {
                return Err("sidecar exited before returning a response".to_string());
            }
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }

            let envelope: ExternalSidecarPacketEnvelope = serde_json::from_str(trimmed)
                .map_err(|error| format!("failed to parse sidecar packet envelope: {error}"))?;
            if envelope.kind == SIDECAR_KIND_HOST_CALL {
                let host_call: ExternalSidecarHostCallRequest = serde_json::from_str(trimmed)
                    .map_err(|error| format!("failed to parse sidecar host call: {error}"))?;
                let host_response = match host_bridge_dispatch(
                    self.runtime_id.as_str(),
                    host_call.method_id.as_str(),
                    host_call.payload_json.clone(),
                ) {
                    Ok(result_json) => ExternalSidecarHostCallResponse {
                        request_id: host_call.request_id,
                        kind: SIDECAR_KIND_HOST_RESPONSE,
                        ok: true,
                        result_json: Some(result_json),
                        error: None,
                    },
                    Err(error) => ExternalSidecarHostCallResponse {
                        request_id: host_call.request_id,
                        kind: SIDECAR_KIND_HOST_RESPONSE,
                        ok: false,
                        result_json: None,
                        error: Some(error),
                    },
                };
                self.write_packet_line(&host_response)?;
                continue;
            }

            let response: ExternalSidecarResponse = serde_json::from_str(trimmed)
                .map_err(|error| format!("failed to parse sidecar response: {error}"))?;
            if response.request_id != request_id {
                return Err(format!(
                    "sidecar response id mismatch: expected {}, got {}",
                    request_id, response.request_id
                ));
            }
            return Ok(response);
        }
    }

    fn write_packet_line<T: Serialize>(&mut self, packet: &T) -> Result<(), String> {
        let serialized = serde_json::to_string(packet)
            .map_err(|error| format!("failed to encode sidecar packet: {error}"))?;
        self.stdin
            .write_all(serialized.as_bytes())
            .and_then(|_| self.stdin.write_all(b"\n"))
            .and_then(|_| self.stdin.flush())
            .map_err(|error| format!("failed to write to sidecar stdin: {error}"))?;
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ExternalRuntimeSidecarCallResponse {
    pub runtime_id: String,
    pub request_id: String,
    pub action_id: String,
    pub result_json: String,
}
