//! Short-lived `native-command` execution.
//!
//! The host runs the compiled binary, captures stdout/stderr/exit, applies
//! a wall-clock timeout from the manifest, and surfaces a structured result.
//! This is intentionally similar to the existing `plugin_run_backend` lane,
//! but routes through the runtime registry instead of plugin folders.

use std::collections::HashMap;
use std::path::Path;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};

use crate::runtime_pipeline::manifest::{RuntimeKind, RuntimeManifest};

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ExternalRuntimeCommandRequest {
    pub runtime_id: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub stdin: Option<String>,
    #[serde(default)]
    pub working_directory: Option<String>,
    #[serde(default)]
    pub environment: Option<HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ExternalRuntimeCommandResult {
    pub runtime_id: String,
    pub exit_status: i32,
    pub stdout: String,
    pub stderr: String,
    pub duration_ms: u64,
    pub timed_out: bool,
}

pub fn run_native_command(
    manifest: &RuntimeManifest,
    binary_path: &Path,
    request: ExternalRuntimeCommandRequest,
) -> Result<ExternalRuntimeCommandResult, String> {
    if !matches!(manifest.kind, RuntimeKind::NativeCommand) {
        return Err(format!(
            "runtime {} is not a native-command (kind = {})",
            manifest.id,
            manifest.kind.as_str()
        ));
    }

    let timeout = manifest
        .command
        .as_ref()
        .and_then(|c| c.timeout_secs)
        .map(Duration::from_secs)
        .unwrap_or_else(|| Duration::from_secs(60));

    let started_at = Instant::now();

    let mut command = Command::new(binary_path);
    command
        .args(&manifest.args)
        .args(&request.args)
        .envs(manifest.env.iter())
        .stdin(if request.stdin.is_some() {
            Stdio::piped()
        } else {
            Stdio::null()
        })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    if let Some(env) = request.environment.as_ref() {
        command.envs(env.iter());
    }
    let cwd = request
        .working_directory
        .clone()
        .or_else(|| manifest.working_directory.clone())
        .unwrap_or_else(|| manifest.module_dir.clone());
    command.current_dir(&cwd);

    let mut child = command
        .spawn()
        .map_err(|error| format!("failed to spawn native-command {}: {error}", manifest.id))?;

    if let (Some(payload), Some(mut stdin)) = (request.stdin.as_ref(), child.stdin.take()) {
        use std::io::Write as _;
        let _ = stdin.write_all(payload.as_bytes());
        drop(stdin);
    }

    // We poll with `try_wait` instead of using a third-party watchdog crate so
    // the dep surface stays minimal. For most authored Go commands the runtime
    // wall is short and this is good enough; long-running work belongs in
    // `native-sidecar`.
    let mut timed_out = false;
    let exit_status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) => {
                if started_at.elapsed() >= timeout {
                    timed_out = true;
                    let _ = child.kill();
                    break child
                        .wait()
                        .map_err(|error| format!("failed to wait on killed child: {error}"))?;
                }
                std::thread::sleep(Duration::from_millis(20));
            }
            Err(error) => return Err(format!("failed to poll native-command status: {error}")),
        }
    };

    let mut stdout = String::new();
    let mut stderr = String::new();
    if let Some(mut handle) = child.stdout.take() {
        use std::io::Read as _;
        let _ = handle.read_to_string(&mut stdout);
    }
    if let Some(mut handle) = child.stderr.take() {
        use std::io::Read as _;
        let _ = handle.read_to_string(&mut stderr);
    }

    Ok(ExternalRuntimeCommandResult {
        runtime_id: manifest.id.clone(),
        exit_status: exit_status.code().unwrap_or(-1),
        stdout,
        stderr,
        duration_ms: started_at.elapsed().as_millis() as u64,
        timed_out,
    })
}
