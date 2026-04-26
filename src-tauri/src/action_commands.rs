use crate::telemetry::{finish_native_span, start_native_span};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant};
use tauri::AppHandle;
use uuid::Uuid;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NEW_CONSOLE: u32 = 0x0000_0010;

const DEFAULT_ACTION_TIMEOUT: Duration = Duration::from_secs(120);
const ACTION_CONTEXT_ENV_KEY: &str = "GREEBLEFS_ACTION_CONTEXT_FILE";
const ACTION_ID_ENV_KEY: &str = "GREEBLEFS_ACTION_ID";
const ACTION_PACK_ID_ENV_KEY: &str = "GREEBLEFS_ACTION_PACK_ID";
const CURRENT_LOCATION_ENV_KEY: &str = "GREEBLEFS_CURRENT_LOCATION";
const PRIMARY_PATH_ENV_KEY: &str = "GREEBLEFS_PRIMARY_PATH";
const SELECTED_COUNT_ENV_KEY: &str = "GREEBLEFS_SELECTED_COUNT";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum ActionRunnerKind {
    Interpreter,
    Shell,
    Cargo,
    Binary,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum ActionOutputTarget {
    TaskCenter,
    PreviewTerminal,
    NativeTerminal,
    Silent,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "kebab-case")]
pub enum ActionMenuContextKind {
    Entry,
    Background,
    MultiSelect,
    SearchResult,
    PreviewPane,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ActionExecutionDefinition {
    pub runner: ActionRunnerKind,
    pub entry: String,
    pub args: Vec<String>,
    pub env: BTreeMap<String, String>,
    pub interpreter: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ActionInvocationEntry {
    pub path: String,
    pub name: String,
    pub parent_path: String,
    pub extension: String,
    pub stem: String,
    pub is_directory: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ActionPreviewContext {
    pub preview_kind: String,
    pub workflow_tab_id: Option<String>,
    pub workflow_base_mode: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ActionSearchResultContext {
    pub query: String,
    pub search_mode: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ActionInvocationCapabilities {
    pub mouse: bool,
    pub touch: bool,
    pub pen: bool,
    pub keyboard: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ActionInvocationContext {
    pub kind: ActionMenuContextKind,
    pub current_location: String,
    pub selected_entries: Vec<ActionInvocationEntry>,
    pub primary_entry: Option<ActionInvocationEntry>,
    pub search_result: Option<ActionSearchResultContext>,
    pub preview_target: Option<ActionInvocationEntry>,
    pub preview_context: Option<ActionPreviewContext>,
    pub input_modality: String,
    pub reduced_motion: bool,
    pub capabilities: ActionInvocationCapabilities,
    pub runtime_platform: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ActionExecutionRequest {
    pub pack_id: String,
    pub action_id: String,
    pub action_title: String,
    pub action_directory: String,
    pub execution: ActionExecutionDefinition,
    pub output_target: ActionOutputTarget,
    pub timeout_ms: Option<u64>,
    pub context: ActionInvocationContext,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ActionExecutionResult {
    pub pack_id: String,
    pub action_id: String,
    pub action_title: String,
    pub runner: ActionRunnerKind,
    pub output_target: ActionOutputTarget,
    pub runtime_used: String,
    pub command_display: String,
    pub working_directory: String,
    pub exit_code: i32,
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub timed_out: bool,
    pub launched_in_native_terminal: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ActionContextFilePayload {
    action_id: String,
    pack_id: String,
    action_title: String,
    action_directory: String,
    output_target: ActionOutputTarget,
    invocation: ActionInvocationContext,
}

#[derive(Debug, Clone)]
struct RuntimeEntry {
    extension: &'static str,
    windows_candidates: &'static [&'static str],
    unix_candidates: &'static [&'static str],
}

static INTERPRETER_RUNTIME_TABLE: &[RuntimeEntry] = &[
    RuntimeEntry {
        extension: ".py",
        windows_candidates: &[
            ".venv/Scripts/python.exe",
            "venv/Scripts/python.exe",
            "python",
            "python3",
        ],
        unix_candidates: &[".venv/bin/python", "venv/bin/python", "python3", "python"],
    },
    RuntimeEntry {
        extension: ".lua",
        windows_candidates: &["lua", "luajit"],
        unix_candidates: &["lua", "luajit"],
    },
    RuntimeEntry {
        extension: ".js",
        windows_candidates: &["bun", "node"],
        unix_candidates: &["bun", "node"],
    },
    RuntimeEntry {
        extension: ".ts",
        windows_candidates: &["bun", "tsx", "deno", "ts-node"],
        unix_candidates: &["bun", "tsx", "deno", "ts-node"],
    },
    RuntimeEntry {
        extension: ".rb",
        windows_candidates: &["ruby"],
        unix_candidates: &["ruby"],
    },
    RuntimeEntry {
        extension: ".sh",
        windows_candidates: &["bash", "sh"],
        unix_candidates: &["sh", "bash"],
    },
    RuntimeEntry {
        extension: ".bash",
        windows_candidates: &["bash", "sh"],
        unix_candidates: &["bash", "sh"],
    },
    RuntimeEntry {
        extension: ".ps1",
        windows_candidates: &["pwsh", "powershell"],
        unix_candidates: &["pwsh"],
    },
];

#[derive(Debug, Clone)]
struct PreparedActionCommand {
    runner: ActionRunnerKind,
    runtime_used: String,
    program: String,
    args: Vec<String>,
    env: BTreeMap<String, String>,
    working_directory: PathBuf,
    command_display: String,
}

struct ChildGuard {
    child: Option<Child>,
}

impl ChildGuard {
    fn new(child: Child) -> Self {
        Self { child: Some(child) }
    }

    fn child_mut(&mut self) -> Result<&mut Child, String> {
        self.child
            .as_mut()
            .ok_or_else(|| "Child process handle is no longer available.".to_string())
    }

    fn into_child(mut self) -> Result<Child, String> {
        self.child
            .take()
            .ok_or_else(|| "Child process handle is no longer available.".to_string())
    }
}

impl Drop for ChildGuard {
    fn drop(&mut self) {
        if let Some(child) = self.child.as_mut() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

#[tauri::command]
#[specta::specta]
pub async fn action_execute(
    app: AppHandle,
    request: ActionExecutionRequest,
) -> Result<ActionExecutionResult, String> {
    let span = start_native_span(
        &app,
        "action",
        "action_execute",
        BTreeMap::from([
            ("packId".to_string(), request.pack_id.clone()),
            ("actionId".to_string(), request.action_id.clone()),
            (
                "runner".to_string(),
                format!("{:?}", request.execution.runner),
            ),
        ]),
    );

    let request_for_task = request.clone();
    let result =
        tauri::async_runtime::spawn_blocking(move || execute_action_request(&request_for_task))
            .await
            .map_err(|error| format!("Action execution task failed to join: {error}"))?;

    let status = if result.is_ok() { "ok" } else { "error" };
    let error = result.as_ref().err().cloned();
    let exit_code = result
        .as_ref()
        .ok()
        .map(|value| value.exit_code.to_string())
        .unwrap_or_default();

    finish_native_span(
        &app,
        span,
        status,
        BTreeMap::from([("exitCode".to_string(), exit_code)]),
        error,
    );

    result
}

fn execute_action_request(
    request: &ActionExecutionRequest,
) -> Result<ActionExecutionResult, String> {
    let action_directory = resolve_action_directory(&request.action_directory)?;
    let temp_root = ensure_action_temp_root()?;
    let context_file_path = write_action_context_file(request, &action_directory, &temp_root)?;

    let injected_env = build_injected_action_env(request, &action_directory, &context_file_path);
    let prepared =
        prepare_action_command(request, &action_directory, &context_file_path, injected_env)?;

    match request.output_target {
        ActionOutputTarget::NativeTerminal => {
            launch_prepared_action_in_native_terminal(request, &prepared, &temp_root)
        }
        _ => {
            let result = run_prepared_action(request, &prepared);
            let _ = fs::remove_file(&context_file_path);
            result
        }
    }
}

fn resolve_action_directory(action_directory: &str) -> Result<PathBuf, String> {
    let trimmed = action_directory.trim();
    if trimmed.is_empty() {
        return Err("Action directory cannot be empty.".to_string());
    }

    let directory = fs::canonicalize(trimmed)
        .map_err(|error| format!("Could not resolve action directory '{trimmed}': {error}"))?;
    if !directory.is_dir() {
        return Err(format!(
            "Action directory '{}' is not a folder.",
            directory.display()
        ));
    }
    Ok(directory)
}

fn ensure_action_temp_root() -> Result<PathBuf, String> {
    let temp_root = std::env::temp_dir().join("greeblefs-actions");
    fs::create_dir_all(&temp_root).map_err(|error| {
        format!(
            "Failed to create the GreebleFS action temp root '{}': {error}",
            temp_root.display()
        )
    })?;
    Ok(temp_root)
}

fn write_action_context_file(
    request: &ActionExecutionRequest,
    action_directory: &Path,
    temp_root: &Path,
) -> Result<PathBuf, String> {
    let file_name = format!(
        "{}-{}-{}.json",
        sanitize_file_stem(&request.pack_id),
        sanitize_file_stem(&request.action_id),
        Uuid::new_v4()
    );
    let file_path = temp_root.join(file_name);
    let payload = ActionContextFilePayload {
        action_id: request.action_id.clone(),
        pack_id: request.pack_id.clone(),
        action_title: request.action_title.clone(),
        action_directory: action_directory.to_string_lossy().to_string(),
        output_target: request.output_target,
        invocation: request.context.clone(),
    };
    let content = serde_json::to_vec_pretty(&payload)
        .map_err(|error| format!("Failed to serialize action context payload: {error}"))?;
    fs::write(&file_path, content).map_err(|error| {
        format!(
            "Failed to write the action context file '{}': {error}",
            file_path.display()
        )
    })?;
    Ok(file_path)
}

fn sanitize_file_stem(value: &str) -> String {
    let sanitized = value
        .trim()
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || character == '-' || character == '_' {
                character
            } else {
                '-'
            }
        })
        .collect::<String>()
        .trim_matches('-')
        .to_string();

    if sanitized.is_empty() {
        "action".to_string()
    } else {
        sanitized
    }
}

fn build_injected_action_env(
    request: &ActionExecutionRequest,
    action_directory: &Path,
    context_file_path: &Path,
) -> BTreeMap<String, String> {
    let mut env = request.execution.env.clone();
    env.insert(
        ACTION_CONTEXT_ENV_KEY.to_string(),
        context_file_path.to_string_lossy().to_string(),
    );
    env.insert(ACTION_ID_ENV_KEY.to_string(), request.action_id.clone());
    env.insert(ACTION_PACK_ID_ENV_KEY.to_string(), request.pack_id.clone());
    env.insert(
        CURRENT_LOCATION_ENV_KEY.to_string(),
        request.context.current_location.clone(),
    );
    env.insert(
        "GREEBLEFS_ACTION_ROOT".to_string(),
        action_directory.to_string_lossy().to_string(),
    );
    env.insert(
        SELECTED_COUNT_ENV_KEY.to_string(),
        request.context.selected_entries.len().to_string(),
    );

    if let Some(primary_entry) = request.context.primary_entry.as_ref() {
        env.insert(PRIMARY_PATH_ENV_KEY.to_string(), primary_entry.path.clone());
    }

    env
}

fn prepare_action_command(
    request: &ActionExecutionRequest,
    action_directory: &Path,
    context_file_path: &Path,
    injected_env: BTreeMap<String, String>,
) -> Result<PreparedActionCommand, String> {
    let working_directory = resolve_action_working_directory(request, action_directory);

    match request.execution.runner {
        ActionRunnerKind::Interpreter => prepare_interpreter_action(
            request,
            action_directory,
            &working_directory,
            context_file_path,
            injected_env,
        ),
        ActionRunnerKind::Binary => prepare_binary_action(
            request,
            action_directory,
            &working_directory,
            context_file_path,
            injected_env,
        ),
        ActionRunnerKind::Cargo => prepare_cargo_action(
            request,
            action_directory,
            &working_directory,
            context_file_path,
            injected_env,
        ),
        ActionRunnerKind::Shell => prepare_shell_action(
            request,
            action_directory,
            &working_directory,
            context_file_path,
            injected_env,
        ),
    }
}

fn prepare_interpreter_action(
    request: &ActionExecutionRequest,
    action_directory: &Path,
    working_directory: &Path,
    _context_file_path: &Path,
    injected_env: BTreeMap<String, String>,
) -> Result<PreparedActionCommand, String> {
    let entry_path = resolve_relative_action_path(
        action_directory,
        &request.execution.entry,
        "interpreter entry",
    )?;
    let interpreter = if let Some(candidate) = request.execution.interpreter.as_deref() {
        resolve_command_candidate(candidate, action_directory)?
    } else {
        resolve_interpreter_for_entry(&entry_path, action_directory)?
    };

    let mut args = vec![entry_path.to_string_lossy().to_string()];
    args.extend(request.execution.args.iter().cloned());
    let command_display = build_command_display(&interpreter, &args);

    Ok(PreparedActionCommand {
        runner: ActionRunnerKind::Interpreter,
        runtime_used: interpreter.clone(),
        program: interpreter,
        args,
        env: injected_env,
        working_directory: working_directory.to_path_buf(),
        command_display,
    })
}

fn prepare_binary_action(
    request: &ActionExecutionRequest,
    action_directory: &Path,
    working_directory: &Path,
    _context_file_path: &Path,
    injected_env: BTreeMap<String, String>,
) -> Result<PreparedActionCommand, String> {
    let entry_path =
        resolve_relative_action_path(action_directory, &request.execution.entry, "binary entry")?;
    ensure_unix_executable_permissions_if_present(&entry_path)?;

    let program = normalize_windows_command_path(&entry_path)
        .to_string_lossy()
        .to_string();
    let args = request.execution.args.clone();
    let command_display = build_command_display(&program, &args);

    Ok(PreparedActionCommand {
        runner: ActionRunnerKind::Binary,
        runtime_used: program.clone(),
        program,
        args,
        env: injected_env,
        working_directory: working_directory.to_path_buf(),
        command_display,
    })
}

fn prepare_cargo_action(
    request: &ActionExecutionRequest,
    action_directory: &Path,
    working_directory: &Path,
    _context_file_path: &Path,
    injected_env: BTreeMap<String, String>,
) -> Result<PreparedActionCommand, String> {
    let manifest_path = resolve_cargo_manifest_path(action_directory, &request.execution.entry)?;
    let cargo_binary = resolve_command_candidate("cargo", action_directory)?;

    let mut args = vec![
        "run".to_string(),
        "--manifest-path".to_string(),
        manifest_path.to_string_lossy().to_string(),
        "--".to_string(),
    ];
    args.extend(request.execution.args.iter().cloned());
    let command_display = build_command_display(&cargo_binary, &args);

    Ok(PreparedActionCommand {
        runner: ActionRunnerKind::Cargo,
        runtime_used: cargo_binary.clone(),
        program: cargo_binary,
        args,
        env: injected_env,
        working_directory: working_directory.to_path_buf(),
        command_display,
    })
}

fn prepare_shell_action(
    request: &ActionExecutionRequest,
    action_directory: &Path,
    working_directory: &Path,
    _context_file_path: &Path,
    injected_env: BTreeMap<String, String>,
) -> Result<PreparedActionCommand, String> {
    let shell = resolve_shell_program(request.execution.interpreter.as_deref(), action_directory)?;
    let mut args = shell.prefix_args;
    let command = append_shell_arguments(&request.execution.entry, &request.execution.args);
    args.push(command);

    let command_display = build_command_display(&shell.program, &args);

    Ok(PreparedActionCommand {
        runner: ActionRunnerKind::Shell,
        runtime_used: shell.program.clone(),
        program: shell.program,
        args,
        env: injected_env,
        working_directory: working_directory.to_path_buf(),
        command_display,
    })
}

fn resolve_action_working_directory(
    request: &ActionExecutionRequest,
    action_directory: &Path,
) -> PathBuf {
    let current_location = PathBuf::from(request.context.current_location.trim());
    if current_location.exists() {
        if current_location.is_dir() {
            return current_location;
        }
        if let Some(parent) = current_location.parent() {
            if parent.exists() {
                return parent.to_path_buf();
            }
        }
    }

    if let Some(primary_entry) = request.context.primary_entry.as_ref() {
        let primary_path = PathBuf::from(primary_entry.path.trim());
        if primary_path.exists() {
            if primary_path.is_dir() {
                return primary_path;
            }
            if let Some(parent) = primary_path.parent() {
                if parent.exists() {
                    return parent.to_path_buf();
                }
            }
        }
    }

    action_directory.to_path_buf()
}

fn resolve_relative_action_path(
    action_directory: &Path,
    entry: &str,
    label: &str,
) -> Result<PathBuf, String> {
    let trimmed = entry.trim();
    if trimmed.is_empty() {
        return Err(format!("{label} cannot be empty."));
    }

    let candidate = action_directory.join(trimmed);
    let resolved = fs::canonicalize(&candidate).map_err(|error| {
        format!(
            "Could not resolve {label} '{}' inside '{}': {error}",
            trimmed,
            action_directory.display()
        )
    })?;

    if !resolved.starts_with(action_directory) {
        return Err(format!(
            "{} must stay inside the action directory.",
            capitalize_first(label)
        ));
    }

    Ok(resolved)
}

fn resolve_cargo_manifest_path(action_directory: &Path, entry: &str) -> Result<PathBuf, String> {
    let resolved = resolve_relative_action_path(action_directory, entry, "cargo entry")?;
    if resolved.is_dir() {
        let manifest = resolved.join("Cargo.toml");
        if !manifest.exists() {
            return Err(format!(
                "Cargo entry '{}' does not contain a Cargo.toml manifest.",
                resolved.display()
            ));
        }
        return Ok(manifest);
    }

    if resolved
        .file_name()
        .and_then(|value| value.to_str())
        .is_some_and(|value| value.eq_ignore_ascii_case("Cargo.toml"))
    {
        return Ok(resolved);
    }

    Err(format!(
        "Cargo entry '{}' must resolve to a directory or Cargo.toml file.",
        resolved.display()
    ))
}

fn capitalize_first(value: &str) -> String {
    let mut characters = value.chars();
    match characters.next() {
        Some(first) => format!("{}{}", first.to_ascii_uppercase(), characters.as_str()),
        None => String::new(),
    }
}

fn resolve_interpreter_for_entry(
    entry_path: &Path,
    action_directory: &Path,
) -> Result<String, String> {
    let extension = entry_path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| format!(".{}", value.to_ascii_lowercase()))
        .ok_or_else(|| {
            format!(
                "Could not infer an interpreter for '{}': the file has no extension.",
                entry_path.display()
            )
        })?;

    let runtime_entry = INTERPRETER_RUNTIME_TABLE
        .iter()
        .find(|candidate| candidate.extension.eq_ignore_ascii_case(&extension))
        .ok_or_else(|| {
            format!(
                "No interpreter candidates are configured for '{}'.",
                extension
            )
        })?;

    let candidates = if cfg!(windows) {
        runtime_entry.windows_candidates
    } else {
        runtime_entry.unix_candidates
    };

    for candidate in candidates {
        if let Ok(resolved) = resolve_command_candidate(candidate, action_directory) {
            return Ok(resolved);
        }
    }

    Err(format!(
        "No interpreter found for '{}'. Tried: {:?}",
        extension, candidates
    ))
}

fn resolve_command_candidate(candidate: &str, action_directory: &Path) -> Result<String, String> {
    let trimmed = candidate.trim();
    if trimmed.is_empty() {
        return Err("Interpreter or command candidate cannot be empty.".to_string());
    }

    let candidate_path = Path::new(trimmed);
    if candidate_path.is_absolute() {
        if candidate_path.exists() {
            return Ok(candidate_path.to_string_lossy().to_string());
        }
        return Err(format!("Command candidate '{}' does not exist.", trimmed));
    }

    if candidate_path.components().count() > 1 {
        let resolved = action_directory.join(candidate_path);
        if resolved.exists() {
            return Ok(resolved.to_string_lossy().to_string());
        }
    }

    if command_exists(trimmed) {
        return Ok(trimmed.to_string());
    }

    Err(format!("Command candidate '{}' is not available.", trimmed))
}

#[derive(Debug, Clone)]
struct ShellProgram {
    program: String,
    prefix_args: Vec<String>,
}

fn resolve_shell_program(
    shell_override: Option<&str>,
    action_directory: &Path,
) -> Result<ShellProgram, String> {
    if let Some(candidate) = shell_override {
        let resolved = resolve_command_candidate(candidate, action_directory)?;
        return Ok(ShellProgram {
            prefix_args: infer_shell_prefix_args(&resolved),
            program: resolved,
        });
    }

    #[cfg(target_os = "windows")]
    let candidates = ["pwsh", "powershell", "cmd"];

    #[cfg(not(target_os = "windows"))]
    let candidates = ["sh", "bash"];

    for candidate in candidates {
        if let Ok(resolved) = resolve_command_candidate(candidate, action_directory) {
            return Ok(ShellProgram {
                prefix_args: infer_shell_prefix_args(&resolved),
                program: resolved,
            });
        }
    }

    Err("Could not resolve a shell runtime for the action.".to_string())
}

fn infer_shell_prefix_args(program: &str) -> Vec<String> {
    let executable_name = Path::new(program)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(program)
        .to_ascii_lowercase();

    if executable_name.contains("pwsh") || executable_name.contains("powershell") {
        vec![
            "-NoProfile".to_string(),
            "-NonInteractive".to_string(),
            "-Command".to_string(),
        ]
    } else if executable_name == "cmd" || executable_name == "cmd.exe" {
        vec!["/C".to_string()]
    } else {
        vec!["-lc".to_string()]
    }
}

fn append_shell_arguments(command: &str, args: &[String]) -> String {
    if args.is_empty() {
        return command.to_string();
    }

    let mut merged = command.to_string();
    for argument in args {
        merged.push(' ');
        merged.push_str(&shell_quote_single(argument));
    }
    merged
}

fn build_command_display(program: &str, args: &[String]) -> String {
    let mut parts = vec![program.to_string()];
    parts.extend(args.iter().map(|argument| shell_quote_single(argument)));
    parts.join(" ")
}

fn run_prepared_action(
    request: &ActionExecutionRequest,
    prepared: &PreparedActionCommand,
) -> Result<ActionExecutionResult, String> {
    let timeout = Duration::from_millis(
        request
            .timeout_ms
            .unwrap_or(DEFAULT_ACTION_TIMEOUT.as_millis() as u64),
    );

    let mut command = Command::new(&prepared.program);
    command
        .args(&prepared.args)
        .current_dir(&prepared.working_directory)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .envs(&prepared.env);

    #[cfg(target_os = "windows")]
    {
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    let child = command.spawn().map_err(|error| {
        format!(
            "Failed to launch action '{}' with '{}': {error}",
            request.action_title, prepared.program
        )
    })?;

    let mut child_guard = ChildGuard::new(child);
    let start = Instant::now();

    loop {
        match child_guard.child_mut()?.try_wait() {
            Ok(Some(_status)) => {
                let output = child_guard
                    .into_child()?
                    .wait_with_output()
                    .map_err(|error| format!("Failed to collect action output: {error}"))?;
                let exit_code = output.status.code().unwrap_or(-1);
                let stdout = String::from_utf8_lossy(&output.stdout)
                    .trim_end()
                    .to_string();
                let stderr = String::from_utf8_lossy(&output.stderr)
                    .trim_end()
                    .to_string();
                return Ok(ActionExecutionResult {
                    pack_id: request.pack_id.clone(),
                    action_id: request.action_id.clone(),
                    action_title: request.action_title.clone(),
                    runner: prepared.runner,
                    output_target: request.output_target,
                    runtime_used: prepared.runtime_used.clone(),
                    command_display: prepared.command_display.clone(),
                    working_directory: prepared.working_directory.to_string_lossy().to_string(),
                    exit_code,
                    success: output.status.success(),
                    stdout,
                    stderr,
                    timed_out: false,
                    launched_in_native_terminal: false,
                });
            }
            Ok(None) => {
                if start.elapsed() >= timeout {
                    return Ok(ActionExecutionResult {
                        pack_id: request.pack_id.clone(),
                        action_id: request.action_id.clone(),
                        action_title: request.action_title.clone(),
                        runner: prepared.runner,
                        output_target: request.output_target,
                        runtime_used: prepared.runtime_used.clone(),
                        command_display: prepared.command_display.clone(),
                        working_directory: prepared.working_directory.to_string_lossy().to_string(),
                        exit_code: -1,
                        success: false,
                        stdout: String::new(),
                        stderr: format!(
                            "Action timed out after {} seconds and was terminated.",
                            timeout.as_secs_f32()
                        ),
                        timed_out: true,
                        launched_in_native_terminal: false,
                    });
                }
                std::thread::sleep(Duration::from_millis(20));
            }
            Err(error) => {
                return Err(format!(
                    "Failed while waiting for action execution: {error}"
                ));
            }
        }
    }
}

fn launch_prepared_action_in_native_terminal(
    request: &ActionExecutionRequest,
    prepared: &PreparedActionCommand,
    temp_root: &Path,
) -> Result<ActionExecutionResult, String> {
    #[cfg(target_os = "windows")]
    launch_prepared_action_in_native_terminal_windows(request, prepared, temp_root)?;

    #[cfg(target_os = "macos")]
    launch_prepared_action_in_native_terminal_macos(request, prepared, temp_root)?;

    #[cfg(target_os = "linux")]
    launch_prepared_action_in_native_terminal_linux(request, prepared, temp_root)?;

    Ok(ActionExecutionResult {
        pack_id: request.pack_id.clone(),
        action_id: request.action_id.clone(),
        action_title: request.action_title.clone(),
        runner: prepared.runner,
        output_target: request.output_target,
        runtime_used: prepared.runtime_used.clone(),
        command_display: prepared.command_display.clone(),
        working_directory: prepared.working_directory.to_string_lossy().to_string(),
        exit_code: 0,
        success: true,
        stdout: String::new(),
        stderr: String::new(),
        timed_out: false,
        launched_in_native_terminal: true,
    })
}

#[cfg(target_os = "windows")]
fn launch_prepared_action_in_native_terminal_windows(
    request: &ActionExecutionRequest,
    prepared: &PreparedActionCommand,
    temp_root: &Path,
) -> Result<(), String> {
    let wrapper_path = temp_root.join(format!(
        "{}-{}-{}.cmd",
        sanitize_file_stem(&request.pack_id),
        sanitize_file_stem(&request.action_id),
        Uuid::new_v4()
    ));
    let wrapper = build_windows_action_wrapper(prepared);
    fs::write(&wrapper_path, wrapper).map_err(|error| {
        format!(
            "Failed to write Windows action wrapper '{}': {error}",
            wrapper_path.display()
        )
    })?;

    let mut command = Command::new("cmd.exe");
    command
        .arg("/K")
        .arg(normalize_windows_command_path(&wrapper_path))
        .current_dir(&prepared.working_directory)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .creation_flags(CREATE_NEW_CONSOLE);
    command
        .spawn()
        .map_err(|error| format!("Failed to launch the action in an external terminal: {error}"))?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn launch_prepared_action_in_native_terminal_macos(
    request: &ActionExecutionRequest,
    prepared: &PreparedActionCommand,
    temp_root: &Path,
) -> Result<(), String> {
    let wrapper_path = write_unix_action_wrapper(request, prepared, temp_root)?;
    let shell_command = format!("sh {}", shell_quote_single(&wrapper_path.to_string_lossy()));
    let applescript = format!(
        "tell application \"Terminal\"\nactivate\ndo script \"{}\"\nend tell",
        applescript_escape(&shell_command)
    );

    let mut command = Command::new("osascript");
    command
        .arg("-e")
        .arg(applescript)
        .current_dir(&prepared.working_directory)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    command
        .spawn()
        .map_err(|error| format!("Failed to launch Terminal for the action: {error}"))?;
    Ok(())
}

#[cfg(target_os = "linux")]
fn launch_prepared_action_in_native_terminal_linux(
    request: &ActionExecutionRequest,
    prepared: &PreparedActionCommand,
    temp_root: &Path,
) -> Result<(), String> {
    let wrapper_path = write_unix_action_wrapper(request, prepared, temp_root)?;
    let wrapper_arg = wrapper_path.to_string_lossy().to_string();

    let mut command = if command_exists("gnome-terminal") {
        let mut command = Command::new("gnome-terminal");
        command
            .arg("--working-directory")
            .arg(&prepared.working_directory)
            .arg("--")
            .arg("sh")
            .arg("-lc")
            .arg(wrapper_arg.clone());
        command
    } else if command_exists("konsole") {
        let mut command = Command::new("konsole");
        command
            .arg("--workdir")
            .arg(&prepared.working_directory)
            .arg("-e")
            .arg("sh")
            .arg("-lc")
            .arg(wrapper_arg.clone());
        command
    } else if command_exists("x-terminal-emulator") {
        let mut command = Command::new("x-terminal-emulator");
        command
            .arg("-e")
            .arg("sh")
            .arg("-lc")
            .arg(wrapper_arg.clone());
        command
    } else if command_exists("xterm") {
        let mut command = Command::new("xterm");
        command
            .arg("-e")
            .arg("sh")
            .arg("-lc")
            .arg(wrapper_arg.clone());
        command
    } else {
        return Err(
            "Could not find a Linux terminal emulator for native-terminal action output."
                .to_string(),
        );
    };

    command
        .current_dir(&prepared.working_directory)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| format!("Failed to launch the action in a terminal window: {error}"))?;

    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn write_unix_action_wrapper(
    request: &ActionExecutionRequest,
    prepared: &PreparedActionCommand,
    temp_root: &Path,
) -> Result<PathBuf, String> {
    let wrapper_path = temp_root.join(format!(
        "{}-{}-{}.sh",
        sanitize_file_stem(&request.pack_id),
        sanitize_file_stem(&request.action_id),
        Uuid::new_v4()
    ));
    let wrapper = build_unix_action_wrapper(prepared);
    fs::write(&wrapper_path, wrapper).map_err(|error| {
        format!(
            "Failed to write Unix action wrapper '{}': {error}",
            wrapper_path.display()
        )
    })?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut permissions = fs::metadata(&wrapper_path)
            .map_err(|error| format!("Failed to inspect action wrapper permissions: {error}"))?
            .permissions();
        permissions.set_mode(0o700);
        fs::set_permissions(&wrapper_path, permissions)
            .map_err(|error| format!("Failed to set action wrapper permissions: {error}"))?;
    }

    Ok(wrapper_path)
}

#[cfg(target_os = "windows")]
fn build_windows_action_wrapper(prepared: &PreparedActionCommand) -> String {
    let mut lines = vec!["@echo off".to_string(), "setlocal".to_string()];

    for (key, value) in &prepared.env {
        lines.push(format!(
            "set \"{}={}\"",
            key,
            escape_windows_env_value(value)
        ));
    }

    lines.push(format!(
        "cd /d \"{}\"",
        escape_windows_path_for_quotes(&prepared.working_directory.to_string_lossy())
    ));
    lines.push(build_windows_command_line(
        &prepared.program,
        &prepared.args,
    ));
    lines.push("set \"GREEBLEFS_ACTION_EXIT=%ERRORLEVEL%\"".to_string());
    lines.push("echo.".to_string());
    lines
        .push("echo [ GreebleFS action finished with status %GREEBLEFS_ACTION_EXIT% ]".to_string());
    lines.push("pause".to_string());
    lines.push("exit /b %GREEBLEFS_ACTION_EXIT%".to_string());
    lines.join("\r\n")
}

#[cfg(not(target_os = "windows"))]
fn build_unix_action_wrapper(prepared: &PreparedActionCommand) -> String {
    let mut lines = vec!["#!/bin/sh".to_string()];

    for (key, value) in &prepared.env {
        lines.push(format!("export {}={}", key, shell_quote_single(value)));
    }

    lines.push(format!(
        "cd {} || exit 1",
        shell_quote_single(&prepared.working_directory.to_string_lossy())
    ));
    lines.push(build_unix_exec_line(&prepared.program, &prepared.args));
    lines.push("GREEBLEFS_ACTION_EXIT=$?".to_string());
    lines.push(
        "printf '\\n[ GreebleFS action finished with status %s ]\\n' \"$GREEBLEFS_ACTION_EXIT\""
            .to_string(),
    );
    lines.push("printf 'Press Enter to close... '".to_string());
    lines.push("read _greeblefs_action_ack".to_string());
    lines.push("exit \"$GREEBLEFS_ACTION_EXIT\"".to_string());
    lines.join("\n")
}

#[cfg(not(target_os = "windows"))]
fn build_unix_exec_line(program: &str, args: &[String]) -> String {
    let mut parts = vec![shell_quote_single(program)];
    parts.extend(args.iter().map(|argument| shell_quote_single(argument)));
    parts.join(" ")
}

#[cfg(target_os = "windows")]
fn build_windows_command_line(program: &str, args: &[String]) -> String {
    let mut parts = vec![quote_windows_command_argument(program)];
    parts.extend(
        args.iter()
            .map(|argument| quote_windows_command_argument(argument)),
    );
    parts.join(" ")
}

#[cfg(target_os = "windows")]
fn escape_windows_env_value(value: &str) -> String {
    value.replace('%', "%%")
}

#[cfg(target_os = "windows")]
fn escape_windows_path_for_quotes(value: &str) -> String {
    value.replace('"', "\"\"")
}

#[cfg(target_os = "windows")]
fn quote_windows_command_argument(value: &str) -> String {
    format!("\"{}\"", value.replace('"', "\\\""))
}

#[cfg(target_os = "macos")]
fn applescript_escape(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

fn shell_quote_single(value: &str) -> String {
    format!("'{}'", value.replace('\'', r#"'\"'\"'"#))
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

fn command_exists(command: &str) -> bool {
    if command.trim().is_empty() {
        return false;
    }

    let command_path = Path::new(command);
    if command_path.is_absolute() || command_path.components().count() > 1 {
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

    for directory in std::env::split_paths(&path_env) {
        let direct = directory.join(command);
        if direct.exists() {
            return true;
        }

        #[cfg(target_os = "windows")]
        {
            let has_extension = Path::new(command).extension().is_some();
            if !has_extension {
                for extension in &extensions {
                    let candidate = directory.join(format!("{}{}", command, extension));
                    if candidate.exists() {
                        return true;
                    }
                }
            }
        }
    }

    false
}

#[cfg(unix)]
fn ensure_unix_executable_permissions_if_present(executable: &Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;

    if !executable.exists() {
        return Ok(());
    }

    let metadata = fs::metadata(executable).map_err(|error| {
        format!(
            "Failed to inspect the executable permissions for '{}': {error}",
            executable.display()
        )
    })?;
    let mut permissions = metadata.permissions();
    let mode = permissions.mode();
    if mode & 0o111 != 0 {
        return Ok(());
    }

    permissions.set_mode(mode | 0o111);
    fs::set_permissions(executable, permissions).map_err(|error| {
        format!(
            "Failed to make '{}' executable: {error}",
            executable.display()
        )
    })
}

#[cfg(not(unix))]
fn ensure_unix_executable_permissions_if_present(_executable: &Path) -> Result<(), String> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn build_test_request(action_directory: &Path) -> ActionExecutionRequest {
        ActionExecutionRequest {
            pack_id: "test-pack".to_string(),
            action_id: "test-action".to_string(),
            action_title: "Test Action".to_string(),
            action_directory: action_directory.to_string_lossy().to_string(),
            execution: ActionExecutionDefinition {
                runner: ActionRunnerKind::Shell,
                entry: String::new(),
                args: Vec::new(),
                env: BTreeMap::new(),
                interpreter: None,
            },
            output_target: ActionOutputTarget::TaskCenter,
            timeout_ms: Some(30_000),
            context: ActionInvocationContext {
                kind: ActionMenuContextKind::Entry,
                current_location: action_directory.to_string_lossy().to_string(),
                selected_entries: vec![ActionInvocationEntry {
                    path: action_directory
                        .join("sample.txt")
                        .to_string_lossy()
                        .to_string(),
                    name: "sample.txt".to_string(),
                    parent_path: action_directory.to_string_lossy().to_string(),
                    extension: "txt".to_string(),
                    stem: "sample".to_string(),
                    is_directory: false,
                }],
                primary_entry: None,
                search_result: None,
                preview_target: None,
                preview_context: None,
                input_modality: "mouse".to_string(),
                reduced_motion: false,
                capabilities: ActionInvocationCapabilities {
                    mouse: true,
                    touch: false,
                    pen: false,
                    keyboard: true,
                },
                runtime_platform: if cfg!(target_os = "windows") {
                    "windows".to_string()
                } else if cfg!(target_os = "macos") {
                    "macos".to_string()
                } else {
                    "linux".to_string()
                },
            },
        }
    }

    #[test]
    fn resolve_relative_action_path_rejects_path_traversal() {
        let temp = tempfile::tempdir().expect("tempdir should be created");
        let action_root = temp.path().join("action");
        fs::create_dir_all(&action_root).expect("action root should be created");
        let external = temp.path().join("outside.txt");
        fs::write(&external, "outside").expect("external file should be written");

        let error = resolve_relative_action_path(&action_root, "../outside.txt", "binary entry")
            .expect_err("path traversal should fail");
        assert!(error.contains("must stay inside the action directory"));
    }

    #[test]
    fn resolve_cargo_manifest_path_accepts_directory_entries() {
        let temp = tempfile::tempdir().expect("tempdir should be created");
        let action_root = temp.path().join("action");
        let crate_dir = action_root.join("cargo-tool");
        fs::create_dir_all(&crate_dir).expect("crate dir should be created");
        fs::write(
            crate_dir.join("Cargo.toml"),
            "[package]\nname=\"demo\"\nversion=\"0.1.0\"\n",
        )
        .expect("manifest should be written");

        let manifest = resolve_cargo_manifest_path(&action_root, "cargo-tool")
            .expect("crate directory should resolve to Cargo.toml");
        assert!(manifest.ends_with("Cargo.toml"));
    }

    #[test]
    fn write_action_context_file_includes_action_metadata() {
        let temp = tempfile::tempdir().expect("tempdir should be created");
        let action_root = temp.path().join("action");
        fs::create_dir_all(&action_root).expect("action root should be created");
        let request = build_test_request(&action_root);

        let context_path = write_action_context_file(&request, &action_root, temp.path())
            .expect("context file should be written");
        let content = fs::read_to_string(&context_path).expect("context file should be readable");

        assert!(content.contains("\"actionId\": \"test-action\""));
        assert!(content.contains("\"packId\": \"test-pack\""));
        assert!(content.contains("\"currentLocation\""));
    }

    #[cfg(not(target_os = "windows"))]
    #[test]
    fn shell_runner_executes_and_captures_stdout() {
        let temp = tempfile::tempdir().expect("tempdir should be created");
        let action_root = temp.path().join("action");
        fs::create_dir_all(&action_root).expect("action root should be created");

        let mut request = build_test_request(&action_root);
        request.execution.entry = "printf '%s' \"$GREEBLEFS_ACTION_ID\"".to_string();
        request.execution.interpreter = Some("sh".to_string());

        let result = execute_action_request(&request).expect("shell action should execute");
        assert!(result.success);
        assert_eq!(result.stdout, "test-action");
        assert_eq!(result.exit_code, 0);
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn shell_runner_executes_and_captures_stdout() {
        let temp = tempfile::tempdir().expect("tempdir should be created");
        let action_root = temp.path().join("action");
        fs::create_dir_all(&action_root).expect("action root should be created");

        let mut request = build_test_request(&action_root);
        request.execution.entry = "Write-Output $env:GREEBLEFS_ACTION_ID".to_string();
        request.execution.interpreter = Some("powershell".to_string());

        let result = execute_action_request(&request).expect("shell action should execute");
        assert!(result.success);
        assert_eq!(result.stdout.trim(), "test-action");
        assert_eq!(result.exit_code, 0);
    }
}
