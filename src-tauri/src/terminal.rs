// Copyright 2026 K-Studio. All Rights Reserved.
// Terminal PTY implementation for ULTACODE

use crate::runtime_pipeline::host_events::{
    HostEventBusState, HostEventScope, HOST_EVENT_TOPIC_TERMINAL_OUTPUT,
    HOST_EVENT_TOPIC_TERMINAL_SHELL_INTEGRATION_CHANGED,
};
use crate::telemetry::{finish_native_span, start_native_span};
use greeble_ipc_contracts::{IpcStreamHandle, IpcStreamPacketMetadata};
use portable_pty::{Child, CommandBuilder, MasterPty, NativePtySystem, PtySize, PtySystem};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command as ProcessCommand, Stdio};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager};
use tauri_specta::Event;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NEW_CONSOLE: u32 = 0x0000_0010;

pub struct TerminalInstance {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    _child: Box<dyn Child + Send + Sync>,
}

pub struct TerminalManager {
    terminals: Mutex<HashMap<String, Arc<Mutex<TerminalInstance>>>>,
    shell_states: Mutex<HashMap<String, TerminalShellIntegrationState>>,
    output_streams: Mutex<HashMap<String, IpcStreamHandle>>,
    hidden_host_command_echoes: Mutex<HashMap<String, VecDeque<Vec<u8>>>>,
}

fn to_ipc_stream_packet_metadata(
    metadata: tauri::transport::StreamPacketMetadata,
) -> IpcStreamPacketMetadata {
    IpcStreamPacketMetadata {
        stream_id: metadata.stream_id,
        sequence: metadata.sequence,
        emitted_at_epoch_ms: metadata.emitted_at_epoch_ms,
        byte_length: metadata.byte_length,
    }
}

const TERMINAL_SHELL_INTEGRATION_CWD_PREFIX: &[u8] = b"\x1b]633;GreebleFS;Cwd=";
const TERMINAL_SHELL_INTEGRATION_BEL: u8 = 0x07;

#[derive(Debug, Default)]
struct TerminalShellIntegrationChunk {
    visible_output: Vec<u8>,
    reported_cwds: Vec<String>,
}

#[derive(Debug, Default)]
struct TerminalShellIntegrationOutputParser {
    carryover: Vec<u8>,
}

impl TerminalShellIntegrationOutputParser {
    fn consume(&mut self, chunk: &[u8]) -> TerminalShellIntegrationChunk {
        let mut combined = std::mem::take(&mut self.carryover);
        combined.extend_from_slice(chunk);

        let mut visible_output = Vec::with_capacity(combined.len());
        let mut reported_cwds = Vec::new();
        let mut cursor = 0usize;

        while let Some(relative_start) =
            find_subslice(&combined[cursor..], TERMINAL_SHELL_INTEGRATION_CWD_PREFIX)
        {
            let marker_start = cursor + relative_start;
            visible_output.extend_from_slice(&combined[cursor..marker_start]);

            let payload_start = marker_start + TERMINAL_SHELL_INTEGRATION_CWD_PREFIX.len();
            if let Some(relative_end) = combined[payload_start..]
                .iter()
                .position(|byte| *byte == TERMINAL_SHELL_INTEGRATION_BEL)
            {
                let payload_end = payload_start + relative_end;
                let reported_cwd =
                    String::from_utf8_lossy(&combined[payload_start..payload_end]).to_string();
                if !reported_cwd.trim().is_empty() {
                    reported_cwds.push(reported_cwd);
                }
                cursor = payload_end + 1;
                continue;
            }

            self.carryover = combined[marker_start..].to_vec();
            return TerminalShellIntegrationChunk {
                visible_output,
                reported_cwds,
            };
        }

        let remaining = &combined[cursor..];
        let partial_prefix_len =
            longest_suffix_matching_prefix(remaining, TERMINAL_SHELL_INTEGRATION_CWD_PREFIX);
        if partial_prefix_len > 0 {
            let visible_end = remaining.len() - partial_prefix_len;
            visible_output.extend_from_slice(&remaining[..visible_end]);
            self.carryover = remaining[visible_end..].to_vec();
        } else {
            visible_output.extend_from_slice(remaining);
        }

        TerminalShellIntegrationChunk {
            visible_output,
            reported_cwds,
        }
    }
}

#[derive(Debug, Default)]
struct TerminalHostCommandEchoSuppressor {
    pending_command_echoes: VecDeque<Vec<u8>>,
    visible_carryover: Vec<u8>,
    awaiting_line_ending_after_hidden_command: bool,
}

impl TerminalHostCommandEchoSuppressor {
    fn enqueue_pending_command_echoes<I>(&mut self, commands: I)
    where
        I: IntoIterator<Item = Vec<u8>>,
    {
        self.pending_command_echoes
            .extend(commands.into_iter().filter(|command| !command.is_empty()));
    }

    fn consume(&mut self, chunk: &[u8]) -> Vec<u8> {
        let mut combined = std::mem::take(&mut self.visible_carryover);
        combined.extend_from_slice(chunk);

        let mut visible_output = Vec::with_capacity(combined.len());
        let mut cursor = 0usize;

        if self.awaiting_line_ending_after_hidden_command {
            let (consumed, continue_waiting) =
                consume_optional_hidden_command_line_ending(&combined[cursor..]);
            cursor += consumed;
            self.awaiting_line_ending_after_hidden_command = continue_waiting;
            if consumed == 0 {
                self.awaiting_line_ending_after_hidden_command = false;
            }
        }

        while let Some(command) = self.pending_command_echoes.front() {
            if let Some(relative_start) = find_subslice(&combined[cursor..], command) {
                let command_start = cursor + relative_start;
                visible_output.extend_from_slice(&combined[cursor..command_start]);

                let command_end = command_start + command.len();
                let (consumed_line_ending_bytes, continue_waiting) =
                    consume_optional_hidden_command_line_ending(&combined[command_end..]);
                cursor = command_end + consumed_line_ending_bytes;
                self.awaiting_line_ending_after_hidden_command = continue_waiting
                    || (consumed_line_ending_bytes == 0 && command_end == combined.len());
                self.pending_command_echoes.pop_front();
                continue;
            }

            let remaining = &combined[cursor..];
            let partial_prefix_len = longest_suffix_matching_prefix(remaining, command);
            if partial_prefix_len > 0 {
                let visible_end = remaining.len() - partial_prefix_len;
                visible_output.extend_from_slice(&remaining[..visible_end]);
                self.visible_carryover = remaining[visible_end..].to_vec();
                return visible_output;
            }

            visible_output.extend_from_slice(remaining);
            return visible_output;
        }

        visible_output.extend_from_slice(&combined[cursor..]);
        visible_output
    }
}

fn find_subslice(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    if needle.is_empty() || haystack.len() < needle.len() {
        return None;
    }

    haystack
        .windows(needle.len())
        .position(|window| window == needle)
}

fn longest_suffix_matching_prefix(input: &[u8], prefix: &[u8]) -> usize {
    if input.is_empty() || prefix.is_empty() {
        return 0;
    }

    let max_len = input.len().min(prefix.len().saturating_sub(1));
    for length in (1..=max_len).rev() {
        if input[input.len() - length..] == prefix[..length] {
            return length;
        }
    }

    0
}

fn consume_optional_hidden_command_line_ending(input: &[u8]) -> (usize, bool) {
    match input {
        [b'\r', b'\n', ..] => (2, false),
        [b'\r'] => (1, true),
        [b'\r', ..] => (1, false),
        [b'\n', ..] => (1, false),
        _ => (0, false),
    }
}

fn trim_hidden_host_command_echo_bytes(command: &str) -> Option<Vec<u8>> {
    let trimmed = command.trim_end_matches(['\r', '\n']);
    if trimmed.is_empty() {
        return None;
    }
    Some(trimmed.as_bytes().to_vec())
}

#[derive(Debug, serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ExternalTerminalRequest {
    pub working_dir: String,
    pub profile: Option<String>,
    pub executable: Option<String>,
    pub args: Option<Vec<String>>,
    pub shell: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum TerminalShellKind {
    Bash,
    Zsh,
    Fish,
    PowerShell,
    Cmd,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct TerminalShellIntegrationState {
    pub shell_kind: TerminalShellKind,
    pub supports_auto_cd: bool,
    pub at_prompt: bool,
    pub reported_cwd: Option<String>,
    pub pending_cwd: Option<String>,
    pub last_synced_cwd: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct TerminalShellIntegrationRequest {
    pub id: String,
    pub shell_kind: Option<TerminalShellKind>,
    pub supports_auto_cd: Option<bool>,
    pub at_prompt: Option<bool>,
    pub reported_cwd: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type, tauri_specta::Event)]
#[serde(rename_all = "camelCase")]
pub struct TerminalShellIntegrationStateEvent {
    pub id: String,
    pub state: TerminalShellIntegrationState,
    pub applied_cwd: Option<String>,
}

#[derive(Debug, Clone, serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct TerminalWriteRequest {
    pub id: String,
    pub data: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct TerminalOutputStreamPacket {
    pub terminal_id: String,
    pub metadata: IpcStreamPacketMetadata,
    pub data: String,
}

fn emit_terminal_shell_integration_state_event(
    app: &AppHandle,
    id: String,
    state: TerminalShellIntegrationState,
    applied_cwd: Option<String>,
) {
    let payload = TerminalShellIntegrationStateEvent {
        id: id.clone(),
        state: state.clone(),
        applied_cwd: applied_cwd.clone(),
    };
    let _ = TerminalShellIntegrationStateEvent {
        id: id.clone(),
        state,
        applied_cwd,
    }
    .emit(app);
    publish_terminal_shell_integration_host_event(app, payload);
}

fn publish_terminal_output_host_event(app: &AppHandle, payload: &TerminalOutputStreamPacket) {
    let host_event_bus = app.state::<HostEventBusState>();
    let _ = host_event_bus.publish_host_topic(
        HOST_EVENT_TOPIC_TERMINAL_OUTPUT,
        serde_json::to_string(payload).ok(),
        None,
        HostEventScope {
            path: Some(payload.terminal_id.clone()),
            ..HostEventScope::default()
        },
        false,
    );
}

fn publish_terminal_shell_integration_host_event(
    app: &AppHandle,
    payload: TerminalShellIntegrationStateEvent,
) {
    let host_event_bus = app.state::<HostEventBusState>();
    let _ = host_event_bus.publish_host_topic(
        HOST_EVENT_TOPIC_TERMINAL_SHELL_INTEGRATION_CHANGED,
        serde_json::to_string(&payload).ok(),
        None,
        HostEventScope {
            path: Some(payload.id.clone()),
            ..HostEventScope::default()
        },
        false,
    );
}

impl TerminalManager {
    pub fn new() -> Self {
        Self {
            terminals: Mutex::new(HashMap::new()),
            shell_states: Mutex::new(HashMap::new()),
            output_streams: Mutex::new(HashMap::new()),
            hidden_host_command_echoes: Mutex::new(HashMap::new()),
        }
    }

    /// Get the appropriate shell for the current platform
    fn get_shell(shell_override: Option<&str>) -> (String, Vec<String>) {
        let (requested_executable, requested_args) = shell_override
            .map(parse_shell_command)
            .unwrap_or_else(|| (String::new(), Vec::new()));

        #[cfg(target_os = "windows")]
        {
            let requested = requested_executable.as_str();
            let requested_args = requested_args.clone();
            let system_root =
                std::env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".to_string());
            let powershell_path = format!(
                "{}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
                system_root
            );
            let pwsh_path =
                std::env::var("ProgramFiles").unwrap_or_default() + "\\PowerShell\\7\\pwsh.exe";
            let requested_path_is_explicit = command_looks_like_path(requested);

            let default_shell = || {
                if Path::new(&pwsh_path).exists() {
                    (pwsh_path.clone(), vec!["-NoLogo".to_string()])
                } else if Path::new(&powershell_path).exists() {
                    (powershell_path.clone(), vec!["-NoLogo".to_string()])
                } else {
                    let cmd_path = format!("{}\\System32\\cmd.exe", system_root);
                    (cmd_path, Vec::new())
                }
            };

            if requested.is_empty() {
                return default_shell();
            }

            let normalized = requested.to_ascii_lowercase();
            if normalized.ends_with("cmd") || normalized.ends_with("cmd.exe") {
                let executable = if requested_path_is_explicit {
                    requested.to_string()
                } else {
                    format!("{}\\System32\\cmd.exe", system_root)
                };
                return (
                    executable,
                    if requested_args.is_empty() {
                        Vec::new()
                    } else {
                        requested_args
                    },
                );
            }

            if normalized.ends_with("pwsh") || normalized.ends_with("pwsh.exe") {
                let executable = if requested_path_is_explicit {
                    requested.to_string()
                } else if Path::new(&pwsh_path).exists() {
                    pwsh_path
                } else if command_exists(requested) {
                    requested.to_string()
                } else if Path::new(&powershell_path).exists() {
                    powershell_path.clone()
                } else {
                    default_shell().0
                };
                return (
                    executable,
                    if requested_args.is_empty() {
                        vec!["-NoLogo".to_string()]
                    } else {
                        requested_args
                    },
                );
            }

            if normalized.ends_with("powershell") || normalized.ends_with("powershell.exe") {
                let executable = if requested_path_is_explicit {
                    requested.to_string()
                } else if Path::new(&powershell_path).exists() {
                    powershell_path
                } else if command_exists(requested) {
                    requested.to_string()
                } else {
                    default_shell().0
                };
                return (
                    executable,
                    if requested_args.is_empty() {
                        vec!["-NoLogo".to_string()]
                    } else {
                        requested_args
                    },
                );
            }

            if Path::new(requested).exists() || command_exists(requested) {
                return (requested.to_string(), requested_args);
            }

            default_shell()
        }

        #[cfg(target_os = "macos")]
        {
            if !requested_executable.is_empty() {
                return (
                    requested_executable.clone(),
                    if requested_args.is_empty() {
                        vec!["-l".to_string()]
                    } else {
                        requested_args
                    },
                );
            }
            // Use zsh on macOS (default since Catalina)
            if std::path::Path::new("/bin/zsh").exists() {
                return ("/bin/zsh".to_string(), vec!["-l".to_string()]);
            }
            ("/bin/bash".to_string(), vec!["-l".to_string()])
        }

        #[cfg(target_os = "linux")]
        {
            if !requested_executable.is_empty() {
                return (
                    requested_executable.clone(),
                    if requested_args.is_empty() {
                        vec!["-l".to_string()]
                    } else {
                        requested_args
                    },
                );
            }
            // Check for user's preferred shell
            if let Ok(shell) = std::env::var("SHELL") {
                return (shell, vec!["-l".to_string()]);
            }
            ("/bin/bash".to_string(), vec!["-l".to_string()])
        }

        #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
        {
            if !requested_executable.is_empty() {
                return (requested_executable.clone(), requested_args);
            }
            ("/bin/sh".to_string(), vec![])
        }
    }

    pub fn spawn(
        &self,
        id: &str,
        working_dir: Option<String>,
        shell: Option<String>,
        rows: u16,
        cols: u16,
    ) -> Result<(), String> {
        let pty_system = NativePtySystem::default();

        let pair = pty_system
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to open PTY: {}", e))?;

        // Try to find PowerShell, fall back to cmd.exe
        let (shell, args) = Self::get_shell(shell.as_deref());
        let mut cmd = CommandBuilder::new(&shell);
        for arg in args {
            cmd.arg(arg);
        }

        if let Some(dir) = &working_dir {
            // Normalize path separators for Windows
            #[cfg(target_os = "windows")]
            let normalized = dir.replace("/", "\\");

            #[cfg(not(target_os = "windows"))]
            let normalized = dir.to_string();

            cmd.cwd(&normalized);
        }

        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("Failed to spawn shell: {}", e))?;

        let writer = pair
            .master
            .take_writer()
            .map_err(|e| format!("Failed to get writer: {}", e))?;

        let instance = Arc::new(Mutex::new(TerminalInstance {
            master: pair.master,
            writer,
            _child: child,
        }));

        let mut terminals = self.terminals.lock().unwrap();
        terminals.insert(id.to_string(), instance);
        drop(terminals);

        let shell_kind = terminal_shell_kind_from_executable(&shell);
        let mut shell_states = self.shell_states.lock().unwrap();
        shell_states.insert(
            id.to_string(),
            TerminalShellIntegrationState {
                shell_kind,
                supports_auto_cd: true,
                at_prompt: true,
                reported_cwd: working_dir,
                pending_cwd: None,
                last_synced_cwd: None,
            },
        );
        drop(shell_states);

        if let Some(bootstrap_command) = terminal_shell_integration_bootstrap_command(
            &terminal_shell_kind_from_executable(&shell),
        ) {
            if let Err(error) = self.write_hidden_host_command(id, &bootstrap_command) {
                log::warn!("failed to install terminal shell integration for {id}: {error}");
            }
        }

        Ok(())
    }

    pub fn write(&self, id: &str, data: &[u8]) -> Result<(), String> {
        if data.is_empty() {
            return Ok(());
        }

        let instance = self.terminal_instance(id)?;
        let mut instance = instance.lock().unwrap();

        instance
            .writer
            .write_all(data)
            .map_err(|e| format!("Write failed: {}", e))?;

        Ok(())
    }

    pub fn write_many(&self, writes: &[TerminalWriteRequest]) -> Result<(), String> {
        for request in writes {
            if request.data.is_empty() {
                continue;
            }

            let instance = self.terminal_instance(&request.id)?;
            let mut instance = instance.lock().unwrap();

            instance
                .writer
                .write_all(request.data.as_bytes())
                .map_err(|e| format!("Write failed for {}: {}", request.id, e))?;
        }

        Ok(())
    }

    fn write_hidden_host_command(&self, id: &str, command: &str) -> Result<(), String> {
        let trimmed_command = trim_hidden_host_command_echo_bytes(command);
        if let Some(trimmed_command) = trimmed_command.clone() {
            let mut hidden_host_command_echoes = self
                .hidden_host_command_echoes
                .lock()
                .map_err(|_| "terminal hidden host command echoes lock poisoned".to_string())?;
            hidden_host_command_echoes
                .entry(id.to_string())
                .or_default()
                .push_back(trimmed_command);
        }
        if let Err(error) = self.write(id, command.as_bytes()) {
            if trimmed_command.is_some() {
                if let Ok(mut hidden_host_command_echoes) = self.hidden_host_command_echoes.lock() {
                    if let Some(queued_commands) = hidden_host_command_echoes.get_mut(id) {
                        queued_commands.pop_back();
                        if queued_commands.is_empty() {
                            hidden_host_command_echoes.remove(id);
                        }
                    }
                }
            }
            return Err(error);
        }
        Ok(())
    }

    fn drain_hidden_host_command_echoes(&self, id: &str) -> Vec<Vec<u8>> {
        let Ok(mut hidden_host_command_echoes) = self.hidden_host_command_echoes.lock() else {
            return Vec::new();
        };
        hidden_host_command_echoes
            .remove(id)
            .map(|commands| commands.into_iter().collect())
            .unwrap_or_default()
    }

    pub fn read(&self, id: &str) -> Result<Vec<u8>, String> {
        let instance = self.terminal_instance(id)?;
        let mut reader = {
            let instance = instance.lock().unwrap();
            instance
                .master
                .try_clone_reader()
                .map_err(|e| format!("Failed to clone reader: {}", e))?
        };

        let mut buffer = vec![0u8; 4096];

        // Non-blocking read attempt
        match reader.read(&mut buffer) {
            Ok(n) if n > 0 => {
                buffer.truncate(n);
                Ok(buffer)
            }
            Ok(_) => Ok(vec![]),
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => Ok(vec![]),
            Err(e) => Err(format!("Read failed: {}", e)),
        }
    }

    pub fn resize(&self, id: &str, rows: u16, cols: u16) -> Result<(), String> {
        let instance = self.terminal_instance(id)?;
        let instance = instance.lock().unwrap();

        instance
            .master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Resize failed: {}", e))?;

        Ok(())
    }

    fn terminal_instance(&self, id: &str) -> Result<Arc<Mutex<TerminalInstance>>, String> {
        let terminals = self.terminals.lock().unwrap();
        terminals
            .get(id)
            .cloned()
            .ok_or_else(|| format!("Terminal {} not found", id))
    }

    pub fn open_output_stream(&self, id: &str, app: &AppHandle) -> Result<IpcStreamHandle, String> {
        let _ = self.terminal_instance(id)?;
        if let Some(existing) = self
            .output_streams
            .lock()
            .map_err(|_| "terminal output stream lock poisoned".to_string())?
            .get(id)
            .cloned()
        {
            return Ok(existing);
        }

        let handle = tauri::transport::register_stream(app, "terminal-output", Some(id))?;
        let handle = IpcStreamHandle {
            id: handle.id,
            kind: handle.kind,
        };
        let mut output_streams = self
            .output_streams
            .lock()
            .map_err(|_| "terminal output stream lock poisoned".to_string())?;
        output_streams.insert(id.to_string(), handle.clone());
        Ok(handle)
    }

    pub fn kill(&self, id: &str, app: &AppHandle) -> Result<(), String> {
        let mut terminals = self.terminals.lock().unwrap();
        terminals
            .remove(id)
            .ok_or_else(|| format!("Terminal {} not found", id))?;
        drop(terminals);
        let mut shell_states = self.shell_states.lock().unwrap();
        shell_states.remove(id);
        drop(shell_states);
        if let Some(stream_handle) = self
            .output_streams
            .lock()
            .map_err(|_| "terminal output stream lock poisoned".to_string())?
            .remove(id)
        {
            tauri::transport::close_stream(app, &stream_handle.id)?;
        }
        if let Ok(mut hidden_host_command_echoes) = self.hidden_host_command_echoes.lock() {
            hidden_host_command_echoes.remove(id);
        }
        Ok(())
    }

    pub fn register_shell_integration(
        &self,
        request: &TerminalShellIntegrationRequest,
    ) -> Result<TerminalShellIntegrationState, String> {
        let mut states = self.shell_states.lock().unwrap();
        let state =
            states
                .entry(request.id.clone())
                .or_insert_with(|| TerminalShellIntegrationState {
                    shell_kind: request
                        .shell_kind
                        .clone()
                        .unwrap_or(TerminalShellKind::Unknown),
                    supports_auto_cd: request.supports_auto_cd.unwrap_or(true),
                    at_prompt: request.at_prompt.unwrap_or(true),
                    reported_cwd: request.reported_cwd.clone(),
                    pending_cwd: None,
                    last_synced_cwd: None,
                });

        if let Some(shell_kind) = &request.shell_kind {
            state.shell_kind = shell_kind.clone();
        }
        if let Some(supports_auto_cd) = request.supports_auto_cd {
            state.supports_auto_cd = supports_auto_cd;
        }
        if let Some(at_prompt) = request.at_prompt {
            state.at_prompt = at_prompt;
        }
        if let Some(reported_cwd) = &request.reported_cwd {
            state.reported_cwd = Some(reported_cwd.clone());
        }

        Ok(state.clone())
    }

    pub fn request_cwd_sync(
        &self,
        id: &str,
        cwd: &str,
    ) -> Result<(TerminalShellIntegrationState, Option<String>), String> {
        let mut states = self.shell_states.lock().unwrap();
        let state = states
            .get_mut(id)
            .ok_or_else(|| format!("Terminal {} shell state not found", id))?;
        state.reported_cwd = Some(cwd.to_string());
        state.pending_cwd = Some(cwd.to_string());
        if state.supports_auto_cd && state.at_prompt {
            let applied = self.flush_pending_cwd_locked(id, state)?;
            return Ok((state.clone(), applied));
        }
        Ok((state.clone(), None))
    }

    pub fn set_prompt_state(
        &self,
        id: &str,
        at_prompt: bool,
        reported_cwd: Option<String>,
    ) -> Result<(TerminalShellIntegrationState, Option<String>), String> {
        let mut states = self.shell_states.lock().unwrap();
        let state = states
            .get_mut(id)
            .ok_or_else(|| format!("Terminal {} shell state not found", id))?;
        state.at_prompt = at_prompt;
        if let Some(reported_cwd) = reported_cwd {
            state.reported_cwd = Some(reported_cwd);
        }
        let applied = if state.at_prompt {
            self.flush_pending_cwd_locked(id, state)?
        } else {
            None
        };
        Ok((state.clone(), applied))
    }

    pub fn report_prompt_ready_cwd(
        &self,
        id: &str,
        reported_cwd: &str,
    ) -> Result<Option<(TerminalShellIntegrationState, Option<String>)>, String> {
        let mut states = self.shell_states.lock().unwrap();
        let state = states
            .get_mut(id)
            .ok_or_else(|| format!("Terminal {} shell state not found", id))?;
        let normalized_reported_cwd =
            normalize_reported_terminal_cwd(&state.shell_kind, reported_cwd);
        if normalized_reported_cwd.is_empty() {
            return Ok(None);
        }

        let should_emit = !state.at_prompt
            || state.reported_cwd.as_deref() != Some(normalized_reported_cwd.as_str())
            || state.pending_cwd.is_some();

        state.at_prompt = true;
        state.reported_cwd = Some(normalized_reported_cwd);
        let applied = self.flush_pending_cwd_locked(id, state)?;
        if !should_emit && applied.is_none() {
            return Ok(None);
        }

        Ok(Some((state.clone(), applied)))
    }

    fn flush_pending_cwd_locked(
        &self,
        id: &str,
        state: &mut TerminalShellIntegrationState,
    ) -> Result<Option<String>, String> {
        let Some(cwd) = state.pending_cwd.clone() else {
            return Ok(None);
        };
        if !state.supports_auto_cd {
            return Ok(None);
        }
        if state.last_synced_cwd.as_deref() == Some(cwd.as_str()) {
            state.pending_cwd = None;
            return Ok(None);
        }

        let Some(command) = terminal_auto_cd_command(&state.shell_kind, &cwd) else {
            return Ok(None);
        };
        self.write_hidden_host_command(id, &command)?;
        state.last_synced_cwd = Some(cwd.clone());
        state.pending_cwd = None;
        Ok(Some(cwd))
    }

    pub fn start_reader_thread(&self, id: String, app: AppHandle) {
        let reader = self.terminal_instance(&id).ok().and_then(|instance| {
            let instance = instance.lock().unwrap();
            instance.master.try_clone_reader().ok()
        });

        if let Some(mut reader) = reader {
            let stream_handle = match self.open_output_stream(&id, &app) {
                Ok(handle) => handle,
                Err(error) => {
                    log::warn!("failed to open terminal output stream for {id}: {error}");
                    return;
                }
            };
            let terminal_id = id.clone();

            std::thread::spawn(move || {
                let mut buffer = [0u8; 4096];
                let mut shell_integration_parser = TerminalShellIntegrationOutputParser::default();
                let mut hidden_host_command_echo_suppressor =
                    TerminalHostCommandEchoSuppressor::default();
                loop {
                    match reader.read(&mut buffer) {
                        Ok(0) => break, // EOF
                        Ok(n) => {
                            let parsed_chunk = shell_integration_parser.consume(&buffer[..n]);
                            let terminal_manager = app.state::<TerminalManager>();
                            hidden_host_command_echo_suppressor.enqueue_pending_command_echoes(
                                terminal_manager.drain_hidden_host_command_echoes(&terminal_id),
                            );
                            let visible_output = hidden_host_command_echo_suppressor
                                .consume(&parsed_chunk.visible_output);
                            if !visible_output.is_empty() {
                                let data = String::from_utf8_lossy(&visible_output).to_string();
                                let packet = match tauri::transport::publish_stream_packet(
                                    &app,
                                    &stream_handle.id,
                                    |metadata| {
                                        Ok(TerminalOutputStreamPacket {
                                            terminal_id: terminal_id.clone(),
                                            metadata: to_ipc_stream_packet_metadata(metadata),
                                            data,
                                        })
                                    },
                                ) {
                                    Ok((packet, _outcome)) => packet,
                                    Err(error) => {
                                        log::warn!(
                                            "failed to publish terminal stream packet for {}: {}",
                                            terminal_id,
                                            error
                                        );
                                        continue;
                                    }
                                };
                                publish_terminal_output_host_event(&app, &packet);
                            }

                            for reported_cwd in parsed_chunk.reported_cwds {
                                match terminal_manager
                                    .report_prompt_ready_cwd(&terminal_id, &reported_cwd)
                                {
                                    Ok(Some((state, applied_cwd))) => {
                                        emit_terminal_shell_integration_state_event(
                                            &app,
                                            terminal_id.clone(),
                                            state,
                                            applied_cwd,
                                        );
                                    }
                                    Ok(None) => {}
                                    Err(error) => {
                                        log::warn!(
                                            "failed to apply reported cwd for {}: {}",
                                            terminal_id,
                                            error
                                        );
                                    }
                                }
                            }
                        }
                        Err(e) => {
                            log::error!("Terminal read error: {}", e);
                            break;
                        }
                    }
                }
            });
        }
    }
}

fn terminal_shell_kind_from_executable(shell: &str) -> TerminalShellKind {
    let executable = shell_executable_name(shell).to_ascii_lowercase();
    if executable.contains("pwsh") || executable.contains("powershell") {
        TerminalShellKind::PowerShell
    } else if executable.ends_with("cmd") || executable.ends_with("cmd.exe") {
        TerminalShellKind::Cmd
    } else if executable.ends_with("fish") {
        TerminalShellKind::Fish
    } else if executable.ends_with("zsh") {
        TerminalShellKind::Zsh
    } else if executable.ends_with("bash") {
        TerminalShellKind::Bash
    } else {
        TerminalShellKind::Unknown
    }
}

fn terminal_auto_cd_command(shell_kind: &TerminalShellKind, cwd: &str) -> Option<String> {
    match shell_kind {
        TerminalShellKind::Cmd => Some(format!("cd /d \"{}\"\r\n", cwd.replace('"', "\"\""))),
        TerminalShellKind::PowerShell => Some(format!(
            "Set-Location -LiteralPath '{}'\r\n",
            cwd.replace('\'', "''")
        )),
        TerminalShellKind::Fish | TerminalShellKind::Zsh | TerminalShellKind::Bash => {
            Some(format!("builtin cd -- {}\n", shell_quote_single(cwd)))
        }
        TerminalShellKind::Unknown => Some(format!("cd -- {}\n", shell_quote_single(cwd))),
    }
}

fn terminal_shell_integration_bootstrap_command(shell_kind: &TerminalShellKind) -> Option<String> {
    match shell_kind {
        TerminalShellKind::Bash => Some(concat!(
            "__greeblefs_prompt_cwd(){ printf '\\033]633;GreebleFS;Cwd=%s\\a' \"$PWD\"; }; ",
            "case \";${PROMPT_COMMAND};\" in ",
            "*\";__greeblefs_prompt_cwd;\"*) ;; ",
            "*) PROMPT_COMMAND=\"__greeblefs_prompt_cwd${PROMPT_COMMAND:+;${PROMPT_COMMAND}}\" ;; ",
            "esac\n",
        )
        .to_string()),
        TerminalShellKind::Zsh => Some(concat!(
            "__greeblefs_precmd(){ printf '\\033]633;GreebleFS;Cwd=%s\\a' \"$PWD\"; }; ",
            "typeset -ga precmd_functions; ",
            "(( ${precmd_functions[(Ie)__greeblefs_precmd]} )) || precmd_functions=(__greeblefs_precmd $precmd_functions)\n",
        )
        .to_string()),
        TerminalShellKind::Fish => Some(concat!(
            "functions -q __greeblefs_original_fish_prompt; or functions -c fish_prompt __greeblefs_original_fish_prompt; ",
            "function fish_prompt; printf '\\e]633;GreebleFS;Cwd=%s\\a' \"$PWD\"; __greeblefs_original_fish_prompt; end\n",
        )
        .to_string()),
        TerminalShellKind::PowerShell => Some(
            concat!(
                "if (-not (Test-Path function:__GreebleFSOriginalPrompt)) { Copy-Item function:prompt function:__GreebleFSOriginalPrompt -ErrorAction SilentlyContinue }; ",
                "function global:prompt { ",
                "$cwd = $executionContext.SessionState.Path.CurrentLocation.Path; ",
                "[Console]::Out.Write(\"`e]633;GreebleFS;Cwd=$cwd`a\"); ",
                "if (Test-Path function:__GreebleFSOriginalPrompt) { & __GreebleFSOriginalPrompt } else { \"PS $cwd> \" } ",
                "}\r\n",
            )
            .to_string(),
        ),
        TerminalShellKind::Cmd => Some(format!(
            "prompt $E]633;GreebleFS;Cwd=$P{}$P$G\r\n",
            '\u{7}'
        )),
        TerminalShellKind::Unknown => None,
    }
}

fn normalize_reported_terminal_cwd(_shell_kind: &TerminalShellKind, reported_cwd: &str) -> String {
    let trimmed = reported_cwd.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    #[cfg(target_os = "windows")]
    {
        let supports_posix_windows_paths = matches!(
            _shell_kind,
            TerminalShellKind::Bash | TerminalShellKind::Zsh | TerminalShellKind::Fish
        );
        if supports_posix_windows_paths {
            if let Some(converted) = convert_posix_windows_shell_path(trimmed) {
                return converted;
            }
        }

        if let Some(converted) = normalize_windows_drive_path(trimmed) {
            return converted;
        }
    }

    trimmed.to_string()
}

#[cfg(target_os = "windows")]
fn convert_posix_windows_shell_path(path: &str) -> Option<String> {
    let stripped = path.strip_prefix('/')?;
    let bytes = stripped.as_bytes();
    let drive_letter = (*bytes.first()?).to_ascii_uppercase();
    if !drive_letter.is_ascii_alphabetic() {
        return None;
    }

    if bytes.len() == 1 {
        return Some(format!("{}:\\", drive_letter as char));
    }

    if bytes[1] != b'/' {
        return None;
    }

    let remainder = stripped[2..].replace('/', "\\");
    if remainder.is_empty() {
        Some(format!("{}:\\", drive_letter as char))
    } else {
        Some(format!("{}:\\{}", drive_letter as char, remainder))
    }
}

#[cfg(target_os = "windows")]
fn normalize_windows_drive_path(path: &str) -> Option<String> {
    let bytes = path.as_bytes();
    if bytes.len() < 2 || !bytes[0].is_ascii_alphabetic() || bytes[1] != b':' {
        return None;
    }

    let drive_letter = bytes[0].to_ascii_uppercase() as char;
    if bytes.len() == 2 {
        return Some(format!("{}:\\", drive_letter));
    }

    let remainder = path[2..].replace('/', "\\");
    if remainder.starts_with('\\') {
        Some(format!("{}:{}", drive_letter, remainder))
    } else {
        Some(format!("{}:\\{}", drive_letter, remainder))
    }
}

fn parse_shell_command(shell: &str) -> (String, Vec<String>) {
    let trimmed = shell.trim();
    if trimmed.is_empty() {
        return (String::new(), Vec::new());
    }

    let mut tokens = Vec::new();
    let mut current = String::new();
    let mut active_quote: Option<char> = None;
    let mut chars = trimmed.chars();

    while let Some(ch) = chars.next() {
        if let Some(quote) = active_quote {
            if quote == '"' && ch == '\\' {
                if let Some(next) = chars.next() {
                    if next == '"' || next == '\\' {
                        current.push(next);
                    } else {
                        current.push('\\');
                        current.push(next);
                    }
                } else {
                    current.push('\\');
                }
                continue;
            }

            if ch == quote {
                active_quote = None;
                continue;
            }

            current.push(ch);
            continue;
        }

        match ch {
            '"' | '\'' => {
                active_quote = Some(ch);
            }
            ch if ch.is_whitespace() => {
                if !current.is_empty() {
                    tokens.push(std::mem::take(&mut current));
                }
            }
            _ => current.push(ch),
        }
    }

    if !current.is_empty() {
        tokens.push(current);
    }

    let executable = tokens.first().cloned().unwrap_or_default();
    let args = tokens.into_iter().skip(1).collect();
    (executable, args)
}

fn shell_executable_name(shell: &str) -> String {
    parse_shell_command(shell).0
}

fn command_looks_like_path(command: &str) -> bool {
    let command_path = Path::new(command);
    command_path.components().count() > 1 || command_path.is_absolute()
}

fn command_exists(command: &str) -> bool {
    if command.trim().is_empty() {
        return false;
    }

    let command_path = Path::new(command);
    if command_looks_like_path(command) {
        return command_path.exists();
    }

    let path_env = match std::env::var_os("PATH") {
        Some(value) => value,
        None => return false,
    };

    #[cfg(target_os = "windows")]
    let extensions: Vec<String> = std::env::var("PATHEXT")
        .unwrap_or_else(|_| ".EXE;.CMD;.BAT;.COM".to_string())
        .split(';')
        .map(|value| value.trim().to_ascii_lowercase())
        .filter(|value| !value.is_empty())
        .collect();

    for dir in std::env::split_paths(&path_env) {
        let direct = dir.join(command);
        if direct.exists() {
            return true;
        }

        #[cfg(target_os = "windows")]
        {
            let has_extension = Path::new(command).extension().is_some();
            if !has_extension {
                for ext in &extensions {
                    let candidate = dir.join(format!("{}{}", command, ext));
                    if candidate.exists() {
                        return true;
                    }
                }
            }
        }
    }

    false
}

fn normalize_working_dir(path: &str) -> String {
    #[cfg(target_os = "windows")]
    {
        path.replace("/", "\\")
    }

    #[cfg(not(target_os = "windows"))]
    {
        path.to_string()
    }
}

fn resolve_working_dir(path: &str) -> Result<PathBuf, String> {
    let normalized = normalize_working_dir(path);
    let directory = PathBuf::from(normalized);
    if directory.exists() {
        Ok(directory)
    } else {
        Err(format!("Working directory does not exist: {}", path))
    }
}

fn optional_args(args: &Option<Vec<String>>) -> Vec<String> {
    args.clone().unwrap_or_default()
}

#[cfg(target_os = "macos")]
fn applescript_escape(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

fn shell_quote_single(value: &str) -> String {
    format!("'{}'", value.replace('\'', r#"'\"'\"'"#))
}

#[cfg(target_os = "macos")]
fn app_exists(app_name: &str) -> bool {
    let candidates = [
        format!("/Applications/{}.app", app_name),
        format!(
            "{}/Applications/{}.app",
            dirs::home_dir().unwrap_or_default().to_string_lossy(),
            app_name
        ),
    ];

    candidates.iter().any(|path| Path::new(path).exists())
}

#[cfg(target_os = "windows")]
fn build_windows_external_command(
    request: &ExternalTerminalRequest,
    working_dir: &Path,
) -> Result<ProcessCommand, String> {
    let requested_profile = request.profile.as_deref().unwrap_or("auto");
    let resolved_profile = match requested_profile {
        "auto" => {
            if command_exists("wt.exe") {
                "windows-terminal"
            } else if command_exists("pwsh.exe") {
                "pwsh"
            } else {
                "powershell"
            }
        }
        other => other,
    };

    let user_args = optional_args(&request.args);
    let shell = request
        .shell
        .clone()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| TerminalManager::get_shell(None).0);

    let working_dir_string = working_dir.to_string_lossy().to_string();

    let mut command = match resolved_profile {
        "windows-terminal" => {
            let executable = request
                .executable
                .clone()
                .filter(|value| !value.trim().is_empty())
                .unwrap_or_else(|| "wt.exe".to_string());
            let mut command = ProcessCommand::new(executable);
            command.arg("-d").arg(&working_dir_string);
            command.arg(&shell);
            for arg in user_args {
                command.arg(arg);
            }
            command
        }
        "pwsh" => {
            let executable = request
                .executable
                .clone()
                .filter(|value| !value.trim().is_empty())
                .unwrap_or_else(|| "pwsh.exe".to_string());
            let mut command = ProcessCommand::new(executable);
            if user_args.is_empty() {
                command.arg("-NoLogo");
            } else {
                for arg in user_args {
                    command.arg(arg);
                }
            }
            command
        }
        "powershell" => {
            let executable = request
                .executable
                .clone()
                .filter(|value| !value.trim().is_empty())
                .unwrap_or_else(|| "powershell.exe".to_string());
            let mut command = ProcessCommand::new(executable);
            if user_args.is_empty() {
                command.arg("-NoLogo").arg("-NoExit");
            } else {
                for arg in user_args {
                    command.arg(arg);
                }
            }
            command
        }
        "cmd" => {
            let executable = request
                .executable
                .clone()
                .filter(|value| !value.trim().is_empty())
                .unwrap_or_else(|| "cmd.exe".to_string());
            let mut command = ProcessCommand::new(executable);
            if user_args.is_empty() {
                command.arg("/K");
            } else {
                for arg in user_args {
                    command.arg(arg);
                }
            }
            command
        }
        "custom" => {
            let executable = request
                .executable
                .clone()
                .filter(|value| !value.trim().is_empty())
                .ok_or_else(|| {
                    "Custom external terminal profile requires an executable.".to_string()
                })?;
            let mut command = ProcessCommand::new(executable);
            for arg in user_args {
                command.arg(arg);
            }
            command
        }
        other => {
            return Err(format!("Unsupported external terminal profile: {}", other));
        }
    };

    command.current_dir(working_dir);
    command.stdin(Stdio::null());
    command.stdout(Stdio::null());
    command.stderr(Stdio::null());
    command.creation_flags(CREATE_NEW_CONSOLE);
    Ok(command)
}

#[cfg(not(target_os = "windows"))]
fn build_unix_external_command(
    request: &ExternalTerminalRequest,
    working_dir: &Path,
) -> Result<ProcessCommand, String> {
    #[cfg(target_os = "macos")]
    {
        let requested_profile = request.profile.as_deref().unwrap_or("auto");
        let resolved_profile = match requested_profile {
            "auto" => {
                if app_exists("iTerm") {
                    "iterm"
                } else {
                    "terminal"
                }
            }
            "system" => "terminal",
            other => other,
        };

        if resolved_profile == "custom" {
            let user_args = optional_args(&request.args);
            let executable = request
                .executable
                .clone()
                .filter(|value| !value.trim().is_empty())
                .ok_or_else(|| {
                    "Custom external terminal profile requires an executable.".to_string()
                })?;

            let mut command = ProcessCommand::new(executable);
            for arg in user_args {
                command.arg(arg);
            }
            command.current_dir(working_dir);
            command.stdin(Stdio::null());
            command.stdout(Stdio::null());
            command.stderr(Stdio::null());
            return Ok(command);
        }

        let shell = request
            .shell
            .clone()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| TerminalManager::get_shell(None).0);
        let user_args = optional_args(&request.args).join(" ");
        let shell_command = if user_args.trim().is_empty() {
            format!("cd {}", shell_quote_single(&working_dir.to_string_lossy()))
        } else {
            format!(
                "cd {} && {} {}",
                shell_quote_single(&working_dir.to_string_lossy()),
                shell,
                user_args
            )
        };

        let script = match resolved_profile {
            "iterm" => format!(
                r#"tell application "iTerm"
activate
if (count of windows) = 0 then
  create window with default profile
end if
tell current session of current window
  write text "{}"
end tell
end tell"#,
                applescript_escape(&shell_command)
            ),
            "terminal" => format!(
                r#"tell application "Terminal"
activate
do script "{}"
end tell"#,
                applescript_escape(&shell_command)
            ),
            other => return Err(format!("Unsupported external terminal profile: {}", other)),
        };

        let mut command = ProcessCommand::new("osascript");
        command.arg("-e").arg(script);
        command.current_dir(working_dir);
        command.stdin(Stdio::null());
        command.stdout(Stdio::null());
        command.stderr(Stdio::null());
        return Ok(command);
    }

    #[cfg(target_os = "linux")]
    {
        let requested_profile = request.profile.as_deref().unwrap_or("auto");
        let resolved_profile = match requested_profile {
            "auto" => {
                if command_exists("x-terminal-emulator") {
                    "system"
                } else if command_exists("gnome-terminal") {
                    "gnome-terminal"
                } else if command_exists("konsole") {
                    "konsole"
                } else {
                    "xterm"
                }
            }
            other => other,
        };

        let user_args = optional_args(&request.args);
        let executable_override = request
            .executable
            .clone()
            .filter(|value| !value.trim().is_empty());

        let mut command = match resolved_profile {
            "system" => ProcessCommand::new(
                executable_override.unwrap_or_else(|| "x-terminal-emulator".to_string()),
            ),
            "gnome-terminal" => {
                let mut command = ProcessCommand::new(
                    executable_override.unwrap_or_else(|| "gnome-terminal".to_string()),
                );
                command.arg("--working-directory").arg(working_dir);
                command
            }
            "konsole" => {
                let mut command = ProcessCommand::new(
                    executable_override.unwrap_or_else(|| "konsole".to_string()),
                );
                command.arg("--workdir").arg(working_dir);
                command
            }
            "xterm" => {
                let shell = request
                    .shell
                    .clone()
                    .filter(|value| !value.trim().is_empty())
                    .unwrap_or_else(|| TerminalManager::get_shell(None).0);
                let mut command =
                    ProcessCommand::new(executable_override.unwrap_or_else(|| "xterm".to_string()));
                command.arg("-e").arg(format!(
                    "cd {} && exec {}",
                    shell_quote_single(&working_dir.to_string_lossy()),
                    shell
                ));
                command
            }
            "custom" => {
                let executable = executable_override.ok_or_else(|| {
                    "Custom external terminal profile requires an executable.".to_string()
                })?;
                ProcessCommand::new(executable)
            }
            other => return Err(format!("Unsupported external terminal profile: {}", other)),
        };

        for arg in user_args {
            command.arg(arg);
        }
        command.current_dir(working_dir);
        command.stdin(Stdio::null());
        command.stdout(Stdio::null());
        command.stderr(Stdio::null());
        return Ok(command);
    }
}

// Tauri commands
#[tauri::command]
#[specta::specta]
pub async fn terminal_spawn(
    terminal_manager: tauri::State<'_, TerminalManager>,
    app: AppHandle,
    id: String,
    working_dir: Option<String>,
    shell: Option<String>,
    rows: Option<u16>,
    cols: Option<u16>,
) -> Result<(), String> {
    let span = start_native_span(
        &app,
        "rust",
        "terminal_spawn",
        std::collections::BTreeMap::from([
            ("terminalId".to_string(), id.clone()),
            (
                "workingDir".to_string(),
                working_dir.clone().unwrap_or_default(),
            ),
            ("rows".to_string(), rows.unwrap_or(24).to_string()),
            ("cols".to_string(), cols.unwrap_or(80).to_string()),
        ]),
    );
    let rows = rows.unwrap_or(24);
    let cols = cols.unwrap_or(80);

    let result = terminal_manager.spawn(&id, working_dir, shell, rows, cols);
    if result.is_ok() {
        if let Err(error) = terminal_manager.open_output_stream(&id, &app) {
            log::warn!("failed to prime terminal output stream for {id}: {error}");
        }
        terminal_manager.start_reader_thread(id, app.clone());
    }
    let status = if result.is_ok() { "ok" } else { "error" };
    let error = result.as_ref().err().cloned();
    finish_native_span(&app, span, status, std::collections::BTreeMap::new(), error);
    result
}

#[tauri::command]
#[specta::specta]
pub async fn terminal_open_output_stream(
    app: AppHandle,
    terminal_manager: tauri::State<'_, TerminalManager>,
    id: String,
) -> Result<IpcStreamHandle, String> {
    terminal_manager.open_output_stream(&id, &app)
}

#[tauri::command]
#[specta::specta]
pub async fn terminal_write(
    terminal_manager: tauri::State<'_, TerminalManager>,
    id: String,
    data: String,
) -> Result<(), String> {
    terminal_manager.write(&id, data.as_bytes())
}

#[tauri::command]
#[specta::specta]
pub async fn terminal_write_many(
    terminal_manager: tauri::State<'_, TerminalManager>,
    writes: Vec<TerminalWriteRequest>,
) -> Result<(), String> {
    if writes.is_empty() {
        return Ok(());
    }

    terminal_manager.write_many(&writes)
}

#[tauri::command]
#[specta::specta]
pub async fn terminal_resize(
    terminal_manager: tauri::State<'_, TerminalManager>,
    id: String,
    rows: u16,
    cols: u16,
) -> Result<(), String> {
    terminal_manager.resize(&id, rows, cols)
}

#[tauri::command]
#[specta::specta]
pub async fn terminal_kill(
    app: AppHandle,
    terminal_manager: tauri::State<'_, TerminalManager>,
    id: String,
) -> Result<(), String> {
    terminal_manager.kill(&id, &app)
}

#[tauri::command]
#[specta::specta]
pub async fn terminal_register_shell_integration(
    app: AppHandle,
    terminal_manager: tauri::State<'_, TerminalManager>,
    request: TerminalShellIntegrationRequest,
) -> Result<TerminalShellIntegrationState, String> {
    let state = terminal_manager.register_shell_integration(&request)?;
    emit_terminal_shell_integration_state_event(
        &app,
        request.id,
        state.clone(),
        state.last_synced_cwd.clone(),
    );
    Ok(state)
}

#[tauri::command]
#[specta::specta]
pub async fn terminal_sync_cwd(
    app: AppHandle,
    terminal_manager: tauri::State<'_, TerminalManager>,
    id: String,
    cwd: String,
) -> Result<TerminalShellIntegrationState, String> {
    let (state, applied_cwd) = terminal_manager.request_cwd_sync(&id, &cwd)?;
    emit_terminal_shell_integration_state_event(&app, id, state.clone(), applied_cwd);
    Ok(state)
}

#[tauri::command]
#[specta::specta]
pub async fn terminal_set_prompt_state(
    app: AppHandle,
    terminal_manager: tauri::State<'_, TerminalManager>,
    id: String,
    at_prompt: bool,
    reported_cwd: Option<String>,
) -> Result<TerminalShellIntegrationState, String> {
    let (state, applied_cwd) = terminal_manager.set_prompt_state(&id, at_prompt, reported_cwd)?;
    emit_terminal_shell_integration_state_event(&app, id, state.clone(), applied_cwd);
    Ok(state)
}

#[tauri::command]
#[specta::specta]
pub async fn terminal_open_external(request: ExternalTerminalRequest) -> Result<(), String> {
    let working_dir = resolve_working_dir(&request.working_dir)?;

    #[cfg(target_os = "windows")]
    let mut command = build_windows_external_command(&request, &working_dir)?;

    #[cfg(not(target_os = "windows"))]
    let mut command = build_unix_external_command(&request, &working_dir)?;

    command
        .spawn()
        .map_err(|error| format!("Failed to open external terminal: {}", error))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[cfg(target_os = "windows")]
    use std::ffi::OsStr;

    #[cfg(target_os = "windows")]
    use std::sync::{LazyLock, Mutex};

    #[cfg(target_os = "windows")]
    static ENV_TEST_LOCK: LazyLock<Mutex<()>> = LazyLock::new(|| Mutex::new(()));

    #[test]
    fn command_exists_rejects_empty_input() {
        assert!(!command_exists(""));
        assert!(!command_exists("   "));
    }

    #[test]
    fn command_exists_accepts_existing_absolute_path() {
        let temp = tempdir().expect("tempdir");
        let file = temp.path().join("tool.exe");
        std::fs::write(&file, "binary").expect("write fake executable");
        assert!(command_exists(file.to_str().expect("utf8 path")));
    }

    #[test]
    fn terminal_auto_cd_command_uses_shell_specific_syntax() {
        let command = terminal_auto_cd_command(&TerminalShellKind::Bash, "/tmp/demo")
            .expect("bash auto-cd command");
        assert_eq!(command, "builtin cd -- '/tmp/demo'\n");
    }

    #[test]
    fn terminal_shell_state_queues_cwd_until_prompt_is_ready() {
        let manager = TerminalManager::new();
        let request = TerminalShellIntegrationRequest {
            id: "terminal-a".to_string(),
            shell_kind: Some(TerminalShellKind::Fish),
            supports_auto_cd: Some(true),
            at_prompt: Some(false),
            reported_cwd: None,
        };

        let state = manager
            .register_shell_integration(&request)
            .expect("register shell integration");
        assert!(!state.at_prompt);

        let (updated_state, applied) = manager
            .request_cwd_sync("terminal-a", "/tmp/workspace")
            .expect("queue cwd sync");
        assert_eq!(updated_state.pending_cwd.as_deref(), Some("/tmp/workspace"));
        assert!(applied.is_none());
    }

    #[test]
    fn terminal_shell_integration_parser_extracts_cwd_markers_across_chunks() {
        let mut parser = TerminalShellIntegrationOutputParser::default();

        let first_chunk = parser.consume(b"hello\x1b]633;GreebleFS;Cwd=/tmp");
        assert_eq!(
            String::from_utf8_lossy(&first_chunk.visible_output),
            "hello"
        );
        assert!(first_chunk.reported_cwds.is_empty());

        let second_chunk = parser.consume(b"/workspace\x07world");
        assert_eq!(
            String::from_utf8_lossy(&second_chunk.visible_output),
            "world"
        );
        assert_eq!(
            second_chunk.reported_cwds,
            vec!["/tmp/workspace".to_string()]
        );
    }

    #[test]
    fn terminal_shell_integration_parser_preserves_regular_escape_output() {
        let mut parser = TerminalShellIntegrationOutputParser::default();
        let chunk = parser.consume(b"\x1b[32mok\x1b[0m");

        assert_eq!(
            String::from_utf8_lossy(&chunk.visible_output),
            "\x1b[32mok\x1b[0m"
        );
        assert!(chunk.reported_cwds.is_empty());
    }

    #[test]
    fn terminal_host_command_echo_suppressor_hides_app_owned_commands() {
        let mut suppressor = TerminalHostCommandEchoSuppressor::default();
        suppressor.enqueue_pending_command_echoes(vec![b"builtin cd -- '/tmp/demo'".to_vec()]);

        let chunk = suppressor.consume(b"builtin cd -- '/tmp/demo'\r\nprompt");
        assert_eq!(String::from_utf8_lossy(&chunk), "prompt");
    }

    #[test]
    fn terminal_host_command_echo_suppressor_handles_split_commands_and_crlf_boundaries() {
        let mut suppressor = TerminalHostCommandEchoSuppressor::default();
        let bootstrap_command =
            terminal_shell_integration_bootstrap_command(&TerminalShellKind::Bash)
                .expect("bash bootstrap");
        let bootstrap_echo = trim_hidden_host_command_echo_bytes(&bootstrap_command)
            .expect("trimmed bootstrap echo");
        let bootstrap_split_index = bootstrap_echo.len() / 2;
        let auto_cd_command = terminal_auto_cd_command(&TerminalShellKind::Bash, "/tmp/demo")
            .expect("bash auto-cd command");
        let auto_cd_echo =
            trim_hidden_host_command_echo_bytes(&auto_cd_command).expect("trimmed auto-cd echo");
        suppressor
            .enqueue_pending_command_echoes(vec![bootstrap_echo.clone(), auto_cd_echo.clone()]);

        let first_chunk = [
            b"old prompt> ".as_slice(),
            &bootstrap_echo[..bootstrap_split_index],
        ]
        .concat();
        assert_eq!(
            String::from_utf8_lossy(&suppressor.consume(&first_chunk)),
            "old prompt> "
        );

        let second_chunk = [
            &bootstrap_echo[bootstrap_split_index..],
            b"\r\nnext prompt> ".as_slice(),
            auto_cd_echo.as_slice(),
            b"\r".as_slice(),
        ]
        .concat();
        assert_eq!(
            String::from_utf8_lossy(&suppressor.consume(&second_chunk)),
            "next prompt> "
        );

        let third_chunk = b"\nfinal prompt".to_vec();
        assert_eq!(
            String::from_utf8_lossy(&suppressor.consume(&third_chunk)),
            "final prompt"
        );
    }

    #[test]
    fn terminal_shell_integration_bootstrap_commands_cover_supported_shells() {
        let bash_command = terminal_shell_integration_bootstrap_command(&TerminalShellKind::Bash)
            .expect("bash bootstrap");
        assert!(bash_command.contains("__greeblefs_prompt_cwd"));
        assert!(bash_command.contains("633;GreebleFS;Cwd="));

        let power_shell_command =
            terminal_shell_integration_bootstrap_command(&TerminalShellKind::PowerShell)
                .expect("powershell bootstrap");
        assert!(power_shell_command.contains("function global:prompt"));
        assert!(power_shell_command.contains("633;GreebleFS;Cwd="));

        let cmd_command = terminal_shell_integration_bootstrap_command(&TerminalShellKind::Cmd)
            .expect("cmd bootstrap");
        assert!(cmd_command.starts_with("prompt $E]633;GreebleFS;Cwd=$P"));
        assert!(cmd_command.contains('\u{7}'));
    }

    #[test]
    fn terminal_shell_state_accepts_reported_cwd_from_shell_integration() {
        let manager = TerminalManager::new();
        manager
            .register_shell_integration(&TerminalShellIntegrationRequest {
                id: "terminal-b".to_string(),
                shell_kind: Some(TerminalShellKind::Bash),
                supports_auto_cd: Some(true),
                at_prompt: Some(false),
                reported_cwd: None,
            })
            .expect("register shell integration");

        let reported = manager
            .report_prompt_ready_cwd("terminal-b", "/tmp/project")
            .expect("report cwd")
            .expect("state update");
        assert_eq!(reported.0.reported_cwd.as_deref(), Some("/tmp/project"));
        assert!(reported.0.at_prompt);
        assert!(reported.1.is_none());
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn command_exists_uses_path_and_pathext_lookup() {
        let _guard = ENV_TEST_LOCK.lock().expect("env lock");
        let temp = tempdir().expect("tempdir");
        let tool = temp.path().join("overlay-test-tool.cmd");
        std::fs::write(&tool, "@echo off\r\necho ok\r\n").expect("write tool");

        let original_path = std::env::var_os("PATH");
        let original_pathext = std::env::var_os("PATHEXT");
        std::env::set_var("PATH", temp.path());
        std::env::set_var("PATHEXT", ".CMD;.EXE");

        assert!(command_exists("overlay-test-tool"));
        assert!(command_exists("overlay-test-tool.cmd"));
        assert!(!command_exists("overlay-test-tool-missing"));

        if let Some(path) = original_path {
            std::env::set_var("PATH", path);
        } else {
            std::env::remove_var("PATH");
        }
        if let Some(path_ext) = original_pathext {
            std::env::set_var("PATHEXT", path_ext);
        } else {
            std::env::remove_var("PATHEXT");
        }
    }

    #[test]
    fn resolve_working_dir_accepts_existing_directories() {
        let dir = tempfile::tempdir().expect("tempdir should be created");
        let path_with_forward_slashes = dir.path().to_string_lossy().replace('\\', "/");

        let resolved = resolve_working_dir(&path_with_forward_slashes)
            .expect("existing directory should resolve");

        assert_eq!(resolved, dir.path());
    }

    #[test]
    fn resolve_working_dir_rejects_missing_directories() {
        let missing = std::env::temp_dir().join(format!(
            "overlayterm-missing-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("clock should be monotonic")
                .as_nanos(),
        ));

        let error = resolve_working_dir(&missing.to_string_lossy())
            .expect_err("missing directory should fail");
        assert!(error.contains("Working directory does not exist"));
    }

    #[test]
    fn optional_args_defaults_to_empty_vec() {
        assert!(optional_args(&None).is_empty());
    }

    #[test]
    fn shell_executable_name_strips_arguments_and_quotes() {
        assert_eq!(shell_executable_name("pwsh.exe -NoLogo"), "pwsh.exe");
        assert_eq!(
            shell_executable_name("\"C:\\Tools\\PowerShell\\pwsh.exe\" -NoLogo"),
            "C:\\Tools\\PowerShell\\pwsh.exe"
        );
        assert_eq!(
            shell_executable_name("'C:\\Tools\\cmd.exe' /c"),
            "C:\\Tools\\cmd.exe"
        );
    }

    #[test]
    fn parse_shell_command_preserves_a_quoted_shell_path_and_args() {
        let (executable, args) = parse_shell_command(
            "\"C:\\Program Files\\PowerShell\\7\\pwsh.exe\" -NoLogo -NoProfile",
        );

        assert_eq!(executable, "C:\\Program Files\\PowerShell\\7\\pwsh.exe");
        assert_eq!(args, vec!["-NoLogo".to_string(), "-NoProfile".to_string()]);
    }

    #[test]
    fn optional_args_clones_the_input_vector() {
        let args = Some(vec!["--flag".to_string(), "value".to_string()]);
        assert_eq!(
            optional_args(&args),
            vec!["--flag".to_string(), "value".to_string()]
        );
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn build_windows_external_command_uses_cmd_profile_defaults() {
        let working_dir = std::env::temp_dir();
        let request = ExternalTerminalRequest {
            working_dir: working_dir.to_string_lossy().to_string(),
            profile: Some("cmd".to_string()),
            executable: None,
            args: None,
            shell: None,
        };

        let command = build_windows_external_command(&request, &working_dir)
            .expect("cmd profile should build");

        assert_eq!(command.get_program(), OsStr::new("cmd.exe"));
        let args: Vec<_> = command
            .get_args()
            .map(|arg| arg.to_string_lossy().to_string())
            .collect();
        assert_eq!(args, vec!["/K".to_string()]);
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn windows_shell_resolution_keeps_requested_pwsh_args() {
        let (shell, args) = TerminalManager::get_shell(Some(
            "\"C:\\Program Files\\PowerShell\\7\\pwsh.exe\" -NoLogo -NoProfile",
        ));

        assert_eq!(shell, "C:\\Program Files\\PowerShell\\7\\pwsh.exe");
        assert_eq!(args, vec!["-NoLogo".to_string(), "-NoProfile".to_string()]);
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn build_windows_external_command_keeps_custom_executable_and_args() {
        let working_dir = std::env::temp_dir();
        let request = ExternalTerminalRequest {
            working_dir: working_dir.to_string_lossy().to_string(),
            profile: Some("custom".to_string()),
            executable: Some("C:\\Tools\\launcher.exe".to_string()),
            args: Some(vec!["--alpha".to_string(), "beta".to_string()]),
            shell: Some("ignored.exe".to_string()),
        };

        let command = build_windows_external_command(&request, &working_dir)
            .expect("custom profile should build");

        assert_eq!(command.get_program(), OsStr::new("C:\\Tools\\launcher.exe"));
        let args: Vec<_> = command
            .get_args()
            .map(|arg| arg.to_string_lossy().to_string())
            .collect();
        assert_eq!(args, vec!["--alpha".to_string(), "beta".to_string()]);
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn windows_command_builder_rejects_invalid_profiles() {
        let temp = tempdir().expect("tempdir");
        let request = ExternalTerminalRequest {
            working_dir: temp.path().to_string_lossy().to_string(),
            profile: Some("not-a-profile".to_string()),
            executable: None,
            args: None,
            shell: None,
        };

        let error = build_windows_external_command(&request, temp.path())
            .expect_err("invalid profile should fail");
        assert!(error.contains("Unsupported external terminal profile"));
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn windows_command_builder_requires_custom_executable() {
        let temp = tempdir().expect("tempdir");
        let request = ExternalTerminalRequest {
            working_dir: temp.path().to_string_lossy().to_string(),
            profile: Some("custom".to_string()),
            executable: Some("   ".to_string()),
            args: Some(vec!["--foo".to_string()]),
            shell: None,
        };

        let error = build_windows_external_command(&request, temp.path())
            .expect_err("custom profile without executable should fail");
        assert!(error.contains("requires an executable"));
    }

    #[tokio::test]
    async fn terminal_open_external_rejects_missing_working_dir() {
        let temp = tempdir().expect("tempdir");
        let missing = temp.path().join("definitely-missing-working-dir");
        let request = ExternalTerminalRequest {
            working_dir: missing.to_string_lossy().to_string(),
            profile: Some("auto".to_string()),
            executable: None,
            args: None,
            shell: None,
        };

        let error = terminal_open_external(request)
            .await
            .expect_err("missing working dir should fail");
        assert!(error.contains("Working directory does not exist"));
    }
}
