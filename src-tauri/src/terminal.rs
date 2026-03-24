// Copyright 2026 K-Studio. All Rights Reserved.
// Terminal PTY implementation for ULTACODE

use portable_pty::{Child, CommandBuilder, MasterPty, NativePtySystem, PtySize, PtySystem};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command as ProcessCommand, Stdio};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};

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
    terminals: Mutex<HashMap<String, TerminalInstance>>,
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

#[derive(Debug, Clone, serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct TerminalWriteRequest {
    pub id: String,
    pub data: String,
}

impl TerminalManager {
    pub fn new() -> Self {
        Self {
            terminals: Mutex::new(HashMap::new()),
        }
    }

    /// Get the appropriate shell for the current platform
    fn get_shell(shell_override: Option<&str>) -> (String, Vec<String>) {
        #[cfg(target_os = "windows")]
        {
            let requested = shell_override.unwrap_or("").trim();
            let system_root =
                std::env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".to_string());
            let powershell_path = format!(
                "{}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
                system_root
            );
            let pwsh_path =
                std::env::var("ProgramFiles").unwrap_or_default() + "\\PowerShell\\7\\pwsh.exe";

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
                return (requested.to_string(), Vec::new());
            }

            if normalized.ends_with("pwsh") || normalized.ends_with("pwsh.exe") {
                let executable = if Path::new(&pwsh_path).exists() {
                    pwsh_path
                } else {
                    requested.to_string()
                };
                return (executable, vec!["-NoLogo".to_string()]);
            }

            if normalized.ends_with("powershell") || normalized.ends_with("powershell.exe") {
                let executable = if Path::new(&powershell_path).exists() {
                    powershell_path
                } else {
                    requested.to_string()
                };
                return (executable, vec!["-NoLogo".to_string()]);
            }

            if Path::new(requested).exists() || command_exists(requested) {
                return (requested.to_string(), Vec::new());
            }

            default_shell()
        }

        #[cfg(target_os = "macos")]
        {
            let requested = shell_override.unwrap_or("").trim();
            if !requested.is_empty() {
                return (requested.to_string(), vec!["-l".to_string()]);
            }
            // Use zsh on macOS (default since Catalina)
            if std::path::Path::new("/bin/zsh").exists() {
                return ("/bin/zsh".to_string(), vec!["-l".to_string()]);
            }
            ("/bin/bash".to_string(), vec!["-l".to_string()])
        }

        #[cfg(target_os = "linux")]
        {
            let requested = shell_override.unwrap_or("").trim();
            if !requested.is_empty() {
                return (requested.to_string(), vec!["-l".to_string()]);
            }
            // Check for user's preferred shell
            if let Ok(shell) = std::env::var("SHELL") {
                return (shell, vec!["-l".to_string()]);
            }
            ("/bin/bash".to_string(), vec!["-l".to_string()])
        }

        #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
        {
            let requested = shell_override.unwrap_or("").trim();
            if !requested.is_empty() {
                return (requested.to_string(), Vec::new());
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

        let instance = TerminalInstance {
            master: pair.master,
            writer,
            _child: child,
        };

        let mut terminals = self.terminals.lock().unwrap();
        terminals.insert(id.to_string(), instance);

        Ok(())
    }

    pub fn write(&self, id: &str, data: &[u8]) -> Result<(), String> {
        let mut terminals = self.terminals.lock().unwrap();
        let instance = terminals
            .get_mut(id)
            .ok_or_else(|| format!("Terminal {} not found", id))?;

        instance
            .writer
            .write_all(data)
            .map_err(|e| format!("Write failed: {}", e))?;
        instance
            .writer
            .flush()
            .map_err(|e| format!("Flush failed: {}", e))?;

        Ok(())
    }

    pub fn write_many(&self, writes: &[TerminalWriteRequest]) -> Result<(), String> {
        let mut terminals = self.terminals.lock().unwrap();
        for request in writes {
            let instance = terminals
                .get_mut(&request.id)
                .ok_or_else(|| format!("Terminal {} not found", request.id))?;

            instance
                .writer
                .write_all(request.data.as_bytes())
                .map_err(|e| format!("Write failed for {}: {}", request.id, e))?;
            instance
                .writer
                .flush()
                .map_err(|e| format!("Flush failed for {}: {}", request.id, e))?;
        }

        Ok(())
    }

    pub fn read(&self, id: &str) -> Result<Vec<u8>, String> {
        let mut terminals = self.terminals.lock().unwrap();
        let instance = terminals
            .get_mut(id)
            .ok_or_else(|| format!("Terminal {} not found", id))?;

        let mut reader = instance
            .master
            .try_clone_reader()
            .map_err(|e| format!("Failed to clone reader: {}", e))?;

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
        let terminals = self.terminals.lock().unwrap();
        let instance = terminals
            .get(id)
            .ok_or_else(|| format!("Terminal {} not found", id))?;

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

    pub fn kill(&self, id: &str) -> Result<(), String> {
        let mut terminals = self.terminals.lock().unwrap();
        terminals
            .remove(id)
            .ok_or_else(|| format!("Terminal {} not found", id))?;
        Ok(())
    }

    pub fn start_reader_thread(&self, id: String, app: AppHandle) {
        let terminals = self.terminals.lock().unwrap();
        if let Some(instance) = terminals.get(&id) {
            if let Ok(mut reader) = instance.master.try_clone_reader() {
                let event_name = format!("terminal-output-{}", id);

                std::thread::spawn(move || {
                    let mut buffer = [0u8; 4096];
                    loop {
                        match reader.read(&mut buffer) {
                            Ok(0) => break, // EOF
                            Ok(n) => {
                                let data = String::from_utf8_lossy(&buffer[..n]).to_string();
                                let _ = app.emit(&event_name, data);
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
}

fn command_exists(command: &str) -> bool {
    if command.trim().is_empty() {
        return false;
    }

    let command_path = Path::new(command);
    if command_path.components().count() > 1 || command_path.is_absolute() {
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

    #[cfg(not(target_os = "windows"))]
    let extensions: Vec<String> = Vec::new();

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

#[cfg(any(target_os = "macos", target_os = "linux"))]
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

    let user_args = optional_args(&request.args);
    let executable = request
        .executable
        .clone()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| {
            request
                .shell
                .clone()
                .filter(|value| !value.trim().is_empty())
        })
        .unwrap_or_else(|| TerminalManager::get_shell(None).0);

    let mut command = ProcessCommand::new(executable);
    for arg in user_args {
        command.arg(arg);
    }
    command.current_dir(working_dir);
    command.stdin(Stdio::null());
    command.stdout(Stdio::null());
    command.stderr(Stdio::null());
    Ok(command)
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
    let rows = rows.unwrap_or(24);
    let cols = cols.unwrap_or(80);

    terminal_manager.spawn(&id, working_dir, shell, rows, cols)?;
    terminal_manager.start_reader_thread(id, app);

    Ok(())
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
    terminal_manager: tauri::State<'_, TerminalManager>,
    id: String,
) -> Result<(), String> {
    terminal_manager.kill(&id)
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
    use std::ffi::OsStr;
    use std::sync::{LazyLock, Mutex};
    use tempfile::tempdir;

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
