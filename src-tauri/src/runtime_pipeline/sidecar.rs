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
use std::sync::Mutex;

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
    payload_json: Option<String>,
    cwd: Option<String>,
    environment: Option<HashMap<String, String>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExternalSidecarResponse {
    request_id: String,
    ok: bool,
    result_json: Option<String>,
    error: Option<String>,
}

impl ExternalSidecarManager {
    pub fn status(&self, runtime_id: &str) -> ExternalRuntimeSidecarStatus {
        let last_error = self
            .last_errors
            .lock()
            .ok()
            .and_then(|map| map.get(runtime_id).cloned());

        let session_info = self
            .sessions
            .lock()
            .ok()
            .and_then(|map| {
                map.get(runtime_id)
                    .map(|session| (session.pid, session.manifest_dir.clone(), session.action_ids.clone()))
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

        if let Some(map) = self.sessions.lock().ok() {
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

        let mut sessions = self
            .sessions
            .lock()
            .map_err(|_| "external runtime sidecar map lock poisoned".to_string())?;
        sessions.insert(manifest.id.clone(), session);
        drop(sessions);

        if let Ok(mut errors) = self.last_errors.lock() {
            errors.remove(&manifest.id);
        }

        Ok(self.status(&manifest.id))
    }

    pub fn stop(&self, runtime_id: &str) -> ExternalRuntimeSidecarStatus {
        if let Ok(mut sessions) = self.sessions.lock() {
            if let Some(mut session) = sessions.remove(runtime_id) {
                let _ = session
                    .send_request("shutdown", None, None, None, None)
                    .map_err(|error| {
                        if let Ok(mut errors) = self.last_errors.lock() {
                            errors.insert(session.runtime_id.clone(), error);
                        }
                    });
                let _ = session.child.kill();
                let _ = session.child.wait();
            }
        }
        self.status(runtime_id)
    }

    pub fn call(
        &self,
        runtime_id: &str,
        action_id: &str,
        payload_json: Option<String>,
        cwd: Option<String>,
        environment: Option<HashMap<String, String>>,
    ) -> Result<ExternalRuntimeSidecarCallResponse, String> {
        let mut sessions = self
            .sessions
            .lock()
            .map_err(|_| "external runtime sidecar map lock poisoned".to_string())?;
        let session = sessions
            .get_mut(runtime_id)
            .ok_or_else(|| format!("runtime {} sidecar is not running", runtime_id))?;

        let response = session
            .send_request("call", Some(action_id.to_string()), payload_json, cwd, environment)
            .map_err(|error| {
                if let Ok(mut errors) = self.last_errors.lock() {
                    errors.insert(runtime_id.to_string(), error.clone());
                }
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
    fn send_request(
        &mut self,
        kind: &str,
        action_id: Option<String>,
        payload_json: Option<String>,
        cwd: Option<String>,
        environment: Option<HashMap<String, String>>,
    ) -> Result<ExternalSidecarResponse, String> {
        self.request_counter += 1;
        let request_id = format!("{}-{}", self.runtime_id, self.request_counter);
        let request = ExternalSidecarRequest {
            request_id: request_id.clone(),
            kind,
            action_id,
            payload_json,
            cwd,
            environment,
        };
        let serialized = serde_json::to_string(&request)
            .map_err(|error| format!("failed to encode sidecar request: {error}"))?;
        self.stdin
            .write_all(serialized.as_bytes())
            .and_then(|_| self.stdin.write_all(b"\n"))
            .and_then(|_| self.stdin.flush())
            .map_err(|error| format!("failed to write to sidecar stdin: {error}"))?;

        let mut line = String::new();
        let bytes = self
            .stdout
            .read_line(&mut line)
            .map_err(|error| format!("failed to read sidecar stdout: {error}"))?;
        if bytes == 0 {
            return Err("sidecar exited before returning a response".to_string());
        }
        let response: ExternalSidecarResponse = serde_json::from_str(line.trim())
            .map_err(|error| format!("failed to parse sidecar response: {error}"))?;
        if response.request_id != request_id {
            return Err(format!(
                "sidecar response id mismatch: expected {}, got {}",
                request_id, response.request_id
            ));
        }
        Ok(response)
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
