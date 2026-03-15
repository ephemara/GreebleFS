use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PluginBackendResult {
    pub stdout: String,
    pub stderr: String,
    pub status: i32,
}

#[tauri::command]
pub async fn plugin_run_backend(
    plugins_root: String,
    plugin_id: String,
    entry: String,
    args: Vec<String>,
) -> Result<PluginBackendResult, String> {
    let backend_entry = resolve_backend_entry(&plugins_root, &plugin_id, &entry)?;
    run_backend_command(&backend_entry, &args)
}

fn resolve_backend_entry(
    plugins_root: &str,
    plugin_id: &str,
    entry: &str,
) -> Result<PathBuf, String> {
    if plugin_id.trim().is_empty() {
        return Err("plugin_id cannot be empty".to_string());
    }
    if entry.trim().is_empty() {
        return Err("entry cannot be empty".to_string());
    }

    let root = std::fs::canonicalize(plugins_root)
        .map_err(|e| format!("Could not open plugins root: {}", e))?;
    let plugin_dir = root.join(plugin_id);
    let backend_dir = plugin_dir.join("backend");
    let backend_dir = std::fs::canonicalize(&backend_dir).map_err(|e| {
        format!(
            "Could not open backend dir for plugin '{}': {}",
            plugin_id, e
        )
    })?;

    let candidate = backend_dir.join(entry);
    let canonical = std::fs::canonicalize(&candidate).map_err(|e| {
        format!(
            "Could not resolve backend entry '{}': {}",
            candidate.display(),
            e
        )
    })?;

    if !canonical.starts_with(&backend_dir) {
        return Err("Backend entry must stay inside the plugin backend directory".to_string());
    }

    Ok(canonical)
}

fn run_backend_command(executable: &Path, args: &[String]) -> Result<PluginBackendResult, String> {
    use std::process::Command;

    let extension = executable
        .extension()
        .map(|ext| ext.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    #[cfg(unix)]
    if extension != "ps1" && extension != "cmd" && extension != "bat" {
        ensure_unix_executable_permissions(executable)?;
    }

    let mut command = if extension == "ps1" {
        let mut cmd = Command::new("powershell");
        cmd.args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
        ]);
        cmd.arg(executable);
        cmd
    } else if extension == "cmd" || extension == "bat" {
        let mut cmd = Command::new("cmd");
        cmd.arg("/C");
        cmd.arg(executable);
        cmd
    } else {
        Command::new(executable)
    };

    command.args(args);
    if let Some(parent) = executable.parent() {
        command.current_dir(parent);
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    let output = command.output().map_err(|e| {
        format!(
            "Failed to run plugin backend '{}': {}",
            executable.display(),
            e
        )
    })?;

    Ok(PluginBackendResult {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        status: output.status.code().unwrap_or(-1),
    })
}

#[cfg(unix)]
fn ensure_unix_executable_permissions(executable: &Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;

    let metadata = std::fs::metadata(executable).map_err(|e| {
        format!(
            "Failed to inspect plugin backend '{}': {}",
            executable.display(),
            e
        )
    })?;

    let mut permissions = metadata.permissions();
    let mode = permissions.mode();
    if mode & 0o111 != 0 {
        return Ok(());
    }

    permissions.set_mode(mode | 0o111);
    std::fs::set_permissions(executable, permissions).map_err(|e| {
        format!(
            "Failed to make plugin backend '{}' executable: {}",
            executable.display(),
            e
        )
    })
}
