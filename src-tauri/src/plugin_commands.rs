use notify::{Event, EventKind, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, State};

pub const PLUGIN_WATCH_EVENT: &str = "overlay://plugins-changed";

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type)]
pub struct PluginBackendResult {
    pub stdout: String,
    pub stderr: String,
    pub status: i32,
}

#[derive(Debug, Serialize, Clone, specta::Type, tauri_specta::Event)]
pub struct PluginDirectoryWatchEvent {
    pub root: String,
    pub kind: String,
    pub paths: Vec<String>,
}

struct ActivePluginWatcher {
    root: PathBuf,
    watcher: notify::RecommendedWatcher,
}

#[derive(Default)]
pub struct PluginWatcherState {
    active: Mutex<Option<ActivePluginWatcher>>,
}

#[tauri::command]
#[specta::specta]
pub async fn plugin_run_backend(
    plugins_root: String,
    plugin_id: String,
    entry: String,
    args: Vec<String>,
) -> Result<PluginBackendResult, String> {
    let backend_entry = resolve_backend_entry(&plugins_root, &plugin_id, &entry)?;
    tokio::task::spawn_blocking(move || run_backend_command(&backend_entry, &args))
        .await
        .map_err(|e| format!("Plugin backend task failed to join: {e}"))?
}

#[tauri::command]
#[specta::specta]
pub fn plugin_watch_directory(
    app: AppHandle,
    state: State<'_, PluginWatcherState>,
    path: String,
    ignored_directories: Vec<String>,
) -> Result<(), String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("path cannot be empty".to_string());
    }

    std::fs::create_dir_all(trimmed)
        .map_err(|e| format!("Could not create plugin watch directory: {e}"))?;
    let root = std::fs::canonicalize(trimmed)
        .map_err(|e| format!("Could not resolve plugin watch directory: {e}"))?;
    let event_root = root.to_string_lossy().to_string();
    let ignored_directory_names = normalize_ignored_directory_names(ignored_directories);
    let app_handle = app.clone();

    let mut watcher =
        notify::recommended_watcher(move |res: Result<Event, notify::Error>| match res {
            Ok(event) => {
                if let Some(kind) = map_watch_event_kind(&event.kind) {
                    let paths = event
                        .paths
                        .iter()
                        .filter(|path| {
                            !path_contains_ignored_directory(path, &ignored_directory_names)
                        })
                        .map(|path| path.to_string_lossy().to_string())
                        .collect::<Vec<_>>();
                    if paths.is_empty() {
                        return;
                    }

                    let payload = PluginDirectoryWatchEvent {
                        root: event_root.clone(),
                        kind: kind.to_string(),
                        paths,
                    };
                    let _ = app_handle.emit(PLUGIN_WATCH_EVENT, payload);
                }
            }
            Err(error) => {
                eprintln!("plugin watcher error: {error}");
            }
        })
        .map_err(|e| format!("Could not create plugin watcher: {e}"))?;

    watcher
        .watch(&root, RecursiveMode::Recursive)
        .map_err(|e| format!("Could not watch plugin directory '{}': {e}", root.display()))?;

    let mut active = state
        .active
        .lock()
        .map_err(|_| "plugin watcher state lock poisoned".to_string())?;

    if let Some(mut previous) = active.take() {
        let _ = previous.watcher.unwatch(&previous.root);
    }

    *active = Some(ActivePluginWatcher { root, watcher });
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn plugin_unwatch_directory(state: State<'_, PluginWatcherState>) -> Result<(), String> {
    let mut active = state
        .active
        .lock()
        .map_err(|_| "plugin watcher state lock poisoned".to_string())?;

    if let Some(mut current) = active.take() {
        let _ = current.watcher.unwatch(&current.root);
    }

    Ok(())
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

const PLUGIN_BACKEND_TIMEOUT: Duration = Duration::from_secs(30);

fn run_backend_command(executable: &Path, args: &[String]) -> Result<PluginBackendResult, String> {
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
        cmd.arg("call");
        cmd.arg(normalize_windows_command_path(executable));
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

    command.stdout(Stdio::piped());
    command.stderr(Stdio::piped());

    run_command_with_timeout(command, executable, PLUGIN_BACKEND_TIMEOUT)
}

fn run_command_with_timeout(
    mut command: Command,
    executable: &Path,
    timeout: Duration,
) -> Result<PluginBackendResult, String> {
    let mut child = command.spawn().map_err(|e| {
        format!(
            "Failed to run plugin backend '{}': {}",
            executable.display(),
            e
        )
    })?;

    let start = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                let mut stdout = Vec::new();
                let mut stderr = Vec::new();
                if let Some(mut handle) = child.stdout.take() {
                    let _ = handle.read_to_end(&mut stdout);
                }
                if let Some(mut handle) = child.stderr.take() {
                    let _ = handle.read_to_end(&mut stderr);
                }

                return Ok(PluginBackendResult {
                    stdout: String::from_utf8_lossy(&stdout).to_string(),
                    stderr: String::from_utf8_lossy(&stderr).to_string(),
                    status: status.code().unwrap_or(-1),
                });
            }
            Ok(None) => {
                if start.elapsed() >= timeout {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(format!(
                        "Plugin backend '{}' timed out after {} seconds",
                        executable.display(),
                        timeout.as_secs()
                    ));
                }
                std::thread::sleep(Duration::from_millis(20));
            }
            Err(e) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(format!(
                    "Failed while waiting for plugin backend '{}': {}",
                    executable.display(),
                    e
                ));
            }
        }
    }
}

fn map_watch_event_kind(kind: &EventKind) -> Option<&'static str> {
    match kind {
        EventKind::Create(_) => Some("create"),
        EventKind::Modify(_) => Some("modify"),
        EventKind::Remove(_) => Some("remove"),
        EventKind::Any => Some("any"),
        _ => None,
    }
}

fn normalize_ignored_directory_names(ignored_directories: Vec<String>) -> Vec<String> {
    ignored_directories
        .into_iter()
        .map(|value| value.trim().to_ascii_lowercase())
        .filter(|value| !value.is_empty())
        .collect()
}

fn path_contains_ignored_directory(path: &Path, ignored_directories: &[String]) -> bool {
    path.components().any(|component| {
        let segment = component
            .as_os_str()
            .to_string_lossy()
            .trim()
            .to_ascii_lowercase();
        !segment.is_empty()
            && ignored_directories
                .iter()
                .any(|ignored| ignored == &segment)
    })
}

#[cfg(target_os = "windows")]
fn normalize_windows_command_path(path: &Path) -> PathBuf {
    let path_str = path.as_os_str().to_string_lossy();
    if let Some(stripped) = path_str.strip_prefix(r"\\?\") {
        PathBuf::from(stripped)
    } else {
        path.to_path_buf()
    }
}

#[cfg(not(target_os = "windows"))]
fn normalize_windows_command_path(path: &Path) -> PathBuf {
    path.to_path_buf()
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[tokio::test]
    async fn plugin_run_backend_executes_windows_cmd_backends() {
        let tempdir = tempfile::tempdir().expect("tempdir should be created");
        let plugins_root = tempdir.path();
        let backend_dir = plugins_root.join("sample-plugin").join("backend");
        fs::create_dir_all(&backend_dir).expect("backend dir should be created");

        let script_path = backend_dir.join("echo-backend.cmd");
        fs::write(&script_path, "@echo off\r\nexit /b 0\r\n")
            .expect("backend script should be written");

        let result = plugin_run_backend(
            plugins_root.to_string_lossy().to_string(),
            "sample-plugin".to_string(),
            "echo-backend.cmd".to_string(),
            vec![],
        )
        .await
        .expect("backend should execute successfully");

        assert_eq!(result.status, 0);
        assert!(result.stdout.trim().is_empty());
    }

    #[tokio::test]
    async fn plugin_run_backend_rejects_path_traversal() {
        let tempdir = tempfile::tempdir().expect("tempdir should be created");
        let plugins_root = tempdir.path();
        let plugin_dir = plugins_root.join("sample-plugin");
        let backend_dir = plugin_dir.join("backend");
        fs::create_dir_all(&backend_dir).expect("backend dir should be created");
        fs::write(
            plugin_dir.join("outside.cmd"),
            "@echo off\r\necho outside\r\n",
        )
        .expect("traversal target should exist");

        let error = plugin_run_backend(
            plugins_root.to_string_lossy().to_string(),
            "sample-plugin".to_string(),
            "..\\outside.cmd".to_string(),
            vec![],
        )
        .await
        .expect_err("path traversal should be rejected");

        assert!(error.contains("stay inside"));
    }

    #[test]
    fn resolve_backend_entry_rejects_empty_fields() {
        let error = resolve_backend_entry("C:\\does-not-matter", "", "entry.cmd")
            .expect_err("empty plugin_id should fail");
        assert!(error.contains("plugin_id cannot be empty"));

        let error = resolve_backend_entry("C:\\does-not-matter", "plugin-a", "  ")
            .expect_err("empty entry should fail");
        assert!(error.contains("entry cannot be empty"));
    }

    #[test]
    fn resolve_backend_entry_resolves_valid_path() {
        let temp = tempdir().expect("tempdir");
        let plugins_root = temp.path().join("plugins");
        let backend_dir = plugins_root.join("plugin-a").join("backend");
        std::fs::create_dir_all(&backend_dir).expect("create backend dir");
        let entry = backend_dir.join("worker.cmd");
        std::fs::write(&entry, "@echo off\r\necho ok\r\n").expect("write backend entry");

        let resolved = resolve_backend_entry(
            plugins_root.to_str().expect("plugins root utf8"),
            "plugin-a",
            "worker.cmd",
        )
        .expect("entry should resolve");

        assert_eq!(
            resolved,
            std::fs::canonicalize(entry).expect("canonical entry")
        );
    }

    #[test]
    fn resolve_backend_entry_blocks_traversal_outside_backend() {
        let temp = tempdir().expect("tempdir");
        let plugins_root = temp.path().join("plugins");
        let backend_dir = plugins_root.join("plugin-a").join("backend");
        std::fs::create_dir_all(&backend_dir).expect("create backend dir");

        let outside = plugins_root.join("escape.cmd");
        std::fs::write(&outside, "@echo off\r\necho escaped\r\n").expect("write outside file");

        let escape_entry = format!(
            "..{}..{}escape.cmd",
            std::path::MAIN_SEPARATOR,
            std::path::MAIN_SEPARATOR
        );
        let error = resolve_backend_entry(
            plugins_root.to_str().expect("plugins root utf8"),
            "plugin-a",
            &escape_entry,
        )
        .expect_err("traversal should be rejected");

        assert!(error.contains("must stay inside"));
    }

    #[test]
    fn run_backend_command_returns_error_for_missing_executable() {
        let temp = tempdir().expect("tempdir");
        let missing = temp.path().join("definitely-missing-plugin-backend.exe");
        let error = run_backend_command(&missing, &[]).expect_err("missing executable should fail");
        assert!(error.contains("Failed to run plugin backend"));
    }

    #[test]
    fn normalize_ignored_directory_names_trims_and_lowercases_values() {
        let normalized = normalize_ignored_directory_names(vec![
            " node_modules ".to_string(),
            "Backend".to_string(),
            String::new(),
        ]);

        assert_eq!(
            normalized,
            vec!["node_modules".to_string(), "backend".to_string()]
        );
    }

    #[test]
    fn path_contains_ignored_directory_detects_nested_segments_case_insensitively() {
        let ignored = vec!["node_modules".to_string(), "backend".to_string()];

        assert!(path_contains_ignored_directory(
            Path::new(r"C:\plugins\alpha\node_modules\react\index.js"),
            &ignored,
        ));
        assert!(path_contains_ignored_directory(
            Path::new(r"C:\plugins\alpha\Backend\worker.cmd"),
            &ignored,
        ));
        assert!(!path_contains_ignored_directory(
            Path::new(r"C:\plugins\alpha\dist\index.js"),
            &ignored,
        ));
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn run_backend_command_executes_cmd_and_captures_output() {
        let temp = tempdir().expect("tempdir");
        let script = temp.path().join("backend.cmd");
        std::fs::write(
            &script,
            "@echo off\r\necho out:%1\r\necho errline 1>&2\r\nexit /b 7\r\n",
        )
        .expect("write script");

        let result = run_backend_command(&script, &[String::from("hello")])
            .expect("cmd execution should succeed");

        assert_eq!(result.status, 7);
        assert!(result.stdout.contains("out:hello"));
        assert!(result.stderr.contains("errline"));
    }
}
