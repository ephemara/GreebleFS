// Copyright 2026 K-Studio. All Rights Reserved.
// Terminal PTY implementation for ULTACODE

use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem, MasterPty, Child};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};

pub struct TerminalInstance {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    _child: Box<dyn Child + Send + Sync>,
}

pub struct TerminalManager {
    terminals: Mutex<HashMap<String, TerminalInstance>>,
}

impl TerminalManager {
    pub fn new() -> Self {
        Self {
            terminals: Mutex::new(HashMap::new()),
        }
    }

    /// Get the appropriate shell for the current platform
    fn get_shell() -> (String, Vec<&'static str>) {
        #[cfg(target_os = "windows")]
        {
            // Try PowerShell Core (pwsh) first, then Windows PowerShell, then cmd
            let pwsh_paths = [
                std::env::var("ProgramFiles").unwrap_or_default() + "\\PowerShell\\7\\pwsh.exe",
                std::env::var("LOCALAPPDATA").unwrap_or_default() + "\\Microsoft\\WindowsApps\\pwsh.exe",
            ];
            
            for path in &pwsh_paths {
                if std::path::Path::new(path).exists() {
                    return (path.clone(), vec!["-NoLogo"]);
                }
            }
            
            // Try Windows PowerShell via full path
            let system_root = std::env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".to_string());
            let powershell_path = format!("{}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe", system_root);
            
            if std::path::Path::new(&powershell_path).exists() {
                return (powershell_path, vec!["-NoLogo", "-NoExit"]);
            }
            
            // Fallback to cmd.exe
            let cmd_path = format!("{}\\System32\\cmd.exe", system_root);
            (cmd_path, vec![])
        }
        
        #[cfg(target_os = "macos")]
        {
            // Use zsh on macOS (default since Catalina)
            if std::path::Path::new("/bin/zsh").exists() {
                return ("/bin/zsh".to_string(), vec!["-l"]);
            }
            ("/bin/bash".to_string(), vec!["-l"])
        }
        
        #[cfg(target_os = "linux")]
        {
            // Check for user's preferred shell
            if let Ok(shell) = std::env::var("SHELL") {
                return (shell, vec!["-l"]);
            }
            ("/bin/bash".to_string(), vec!["-l"])
        }
        
        #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
        {
            ("/bin/sh".to_string(), vec![])
        }
    }

    pub fn spawn(&self, id: &str, working_dir: Option<String>, rows: u16, cols: u16) -> Result<(), String> {
        let pty_system = NativePtySystem::default();
        
        let pair = pty_system.openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        }).map_err(|e| format!("Failed to open PTY: {}", e))?;

        // Try to find PowerShell, fall back to cmd.exe
        let (shell, args) = Self::get_shell();
        let mut cmd = CommandBuilder::new(&shell);
        for arg in args {
            cmd.arg(arg);
        }
        
        if let Some(dir) = &working_dir {
            // Normalize path separators for Windows
            let normalized = dir.replace("/", "\\");
            cmd.cwd(&normalized);
        }

        let child = pair.slave.spawn_command(cmd)
            .map_err(|e| format!("Failed to spawn shell: {}", e))?;
        
        let writer = pair.master.take_writer()
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
        let instance = terminals.get_mut(id)
            .ok_or_else(|| format!("Terminal {} not found", id))?;
        
        instance.writer.write_all(data)
            .map_err(|e| format!("Write failed: {}", e))?;
        instance.writer.flush()
            .map_err(|e| format!("Flush failed: {}", e))?;
        
        Ok(())
    }

    pub fn read(&self, id: &str) -> Result<Vec<u8>, String> {
        let mut terminals = self.terminals.lock().unwrap();
        let instance = terminals.get_mut(id)
            .ok_or_else(|| format!("Terminal {} not found", id))?;
        
        let mut reader = instance.master.try_clone_reader()
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
        let instance = terminals.get(id)
            .ok_or_else(|| format!("Terminal {} not found", id))?;
        
        instance.master.resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        }).map_err(|e| format!("Resize failed: {}", e))?;
        
        Ok(())
    }

    pub fn kill(&self, id: &str) -> Result<(), String> {
        let mut terminals = self.terminals.lock().unwrap();
        terminals.remove(id)
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

// Tauri commands
#[tauri::command]
pub async fn terminal_spawn(
    terminal_manager: tauri::State<'_, TerminalManager>,
    app: AppHandle,
    id: String,
    working_dir: Option<String>,
    rows: Option<u16>,
    cols: Option<u16>,
) -> Result<(), String> {
    let rows = rows.unwrap_or(24);
    let cols = cols.unwrap_or(80);
    
    terminal_manager.spawn(&id, working_dir, rows, cols)?;
    terminal_manager.start_reader_thread(id, app);
    
    Ok(())
}

#[tauri::command]
pub async fn terminal_write(
    terminal_manager: tauri::State<'_, TerminalManager>,
    id: String,
    data: String,
) -> Result<(), String> {
    terminal_manager.write(&id, data.as_bytes())
}

#[tauri::command]
pub async fn terminal_resize(
    terminal_manager: tauri::State<'_, TerminalManager>,
    id: String,
    rows: u16,
    cols: u16,
) -> Result<(), String> {
    terminal_manager.resize(&id, rows, cols)
}

#[tauri::command]
pub async fn terminal_kill(
    terminal_manager: tauri::State<'_, TerminalManager>,
    id: String,
) -> Result<(), String> {
    terminal_manager.kill(&id)
}
