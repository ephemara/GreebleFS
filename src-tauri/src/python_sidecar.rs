use std::collections::HashMap;
use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use std::sync::Mutex;

use include_dir::{include_dir, Dir, DirEntry};
use serde::de::DeserializeOwned;
use tauri::{AppHandle, Manager};

use crate::python_commands::{
    build_runtime_paths, ensure_runtime_directories, managed_python_path, path_to_string,
    prepare_managed_python_runtime, pythonpath_environment, resolve_runtime_config,
    runtime_status_with_base_interpreter, seed_boilerplate_files, PythonRuntimeConfig,
    PythonRuntimeStatus, RuntimePaths,
};

const PYTHON_SIDECAR_MANIFEST_FILENAME: &str = "greeblefs-python-sidecar.json";
const PYTHON_SIDECAR_WORKSPACE_DIR_NAME: &str = "src-python";
const PYTHON_SIDECAR_LOG_FILENAME: &str = "python-sidecar.log";
const PYTHON_SIDECAR_ENV_RUNTIME_ROOT: &str = "GREEBLEFS_PYTHON_RUNTIME_ROOT";
const PYTHON_SIDECAR_ENV_WORKSPACE_ROOT: &str = "GREEBLEFS_PYTHON_SIDECAR_ROOT";
const PYTHON_SIDECAR_ENV_PROTOCOL: &str = "GREEBLEFS_PYTHON_SIDECAR_PROTOCOL";
const PYTHON_SIDECAR_ENV_UNBUFFERED: &str = "PYTHONUNBUFFERED";
const LOCAL_MODEL_CATALOG_RUNTIME_RELATIVE_PATH: &str = "greeblefs_sidecar/localModelCatalog.json";
const EMBEDDED_LOCAL_MODEL_CATALOG_TEXT: &str =
    include_str!("../../src/config/localModelCatalog.json");

static EMBEDDED_PYTHON_WORKSPACE: Dir<'_> = include_dir!("$CARGO_MANIFEST_DIR/../src-python");

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PythonSidecarPackagePreset {
    pub id: String,
    pub label: String,
    pub description: String,
    pub packages: Vec<String>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PythonSidecarActionDescriptor {
    pub id: String,
    pub label: String,
    pub description: String,
    pub payload_example_json: String,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PythonSidecarWorkspaceManifest {
    pub schema_version: u32,
    pub id: String,
    pub display_name: String,
    pub module_name: String,
    pub entry_module: String,
    pub transport: String,
    pub guide_path: String,
    pub package_presets: Vec<PythonSidecarPackagePreset>,
    pub actions: Vec<PythonSidecarActionDescriptor>,
}

#[derive(Debug, Clone, serde::Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PythonSidecarStatus {
    pub runtime_root: String,
    pub workspace_root: String,
    pub manifest_path: String,
    pub guide_path: String,
    pub log_path: String,
    pub running: bool,
    pub pid: Option<u32>,
    pub module_name: String,
    pub entry_module: String,
    pub transport: String,
    pub action_ids: Vec<String>,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PythonSidecarStartResponse {
    pub runtime_status: PythonRuntimeStatus,
    pub sidecar: PythonSidecarStatus,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PythonSidecarActionRequest {
    pub config: Option<PythonRuntimeConfig>,
    pub action_id: String,
    pub payload_json: Option<String>,
    pub working_directory: Option<String>,
    pub environment: Option<HashMap<String, String>>,
    pub start_if_needed: Option<bool>,
}

#[derive(Debug, Clone, serde::Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PythonSidecarActionResponse {
    pub runtime_status: PythonRuntimeStatus,
    pub sidecar: PythonSidecarStatus,
    pub request_id: String,
    pub action_id: String,
    pub result_json: String,
}

pub mod action_ids {
    pub const ACCELERATION_CUDA_PROBE: &str = "acceleration.cuda_probe";
    pub const RUNTIME_SUMMARY: &str = "runtime.summary";
    pub const ML_PROBE: &str = "ml.probe";
    pub const IMAGE_CUTOUT_OPEN_SESSION: &str = "image.cutout_open_session";
    pub const IMAGE_CUTOUT_APPLY_PROMPTS: &str = "image.cutout_apply_prompts";
    pub const IMAGE_CUTOUT_RESET_SESSION: &str = "image.cutout_reset_session";
    pub const IMAGE_CUTOUT_STAGE_EXPORT: &str = "image.cutout_stage_export";
    pub const IMAGE_CUTOUT_CLOSE_SESSION: &str = "image.cutout_close_session";
    pub const FILES_SCAN_DIRECTORY: &str = "files.scan_directory";
    pub const FILES_HASH_PATHS: &str = "files.hash_paths";
    pub const SEMANTIC_INDEX_ROOT: &str = "semantic.index_root";
    pub const SEMANTIC_QUERY_INDEX: &str = "semantic.query_index";
    pub const SEMANTIC_FIND_SIMILAR_FILE: &str = "semantic.find_similar_file";
    pub const SEMANTIC_DELETE_INDEX: &str = "semantic.delete_index";
    pub const SEMANTIC_INDEX_STATUS: &str = "semantic.index_status";
}

#[derive(Debug, Clone)]
pub struct PythonSidecarDecodedActionResponse<TResult> {
    pub raw: PythonSidecarActionResponse,
    pub result: TResult,
}

#[derive(Default)]
pub struct PythonSidecarManager {
    session: Mutex<Option<PythonSidecarSession>>,
    last_error: Mutex<Option<String>>,
}

struct PythonSidecarSession {
    runtime_root: PathBuf,
    sidecar_paths: PythonSidecarPaths,
    manifest: PythonSidecarWorkspaceManifest,
    child: Child,
    stdin: ChildStdin,
    stdout: BufReader<ChildStdout>,
    pid: u32,
    request_counter: u64,
}

#[derive(Debug, Clone)]
struct PythonSidecarPaths {
    workspace_root: PathBuf,
    manifest_path: PathBuf,
    guide_path: PathBuf,
    log_path: PathBuf,
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct PythonSidecarProtocolRequest {
    request_id: String,
    kind: String,
    action_id: Option<String>,
    payload_json: Option<String>,
    cwd: Option<String>,
    environment: Option<HashMap<String, String>>,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct PythonSidecarProtocolResponse {
    request_id: String,
    ok: bool,
    result_json: Option<String>,
    error: Option<String>,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct PythonSidecarHandshakePayload {
    manifest_id: String,
    module_name: String,
    entry_module: String,
    transport: String,
    available_actions: Vec<String>,
}

fn encode_sidecar_payload_json<T: serde::Serialize>(
    payload: Option<&T>,
) -> Result<Option<String>, String> {
    payload
        .map(|value| {
            serde_json::to_string(value)
                .map_err(|error| format!("Failed to serialize Python sidecar payload: {error}"))
        })
        .transpose()
}

fn decode_sidecar_result_json<TResult: DeserializeOwned>(
    result_json: &str,
) -> Result<TResult, String> {
    serde_json::from_str(result_json)
        .map_err(|error| format!("Failed to decode Python sidecar result JSON: {error}"))
}

pub fn get_sidecar_status(
    app: &AppHandle,
    config: Option<PythonRuntimeConfig>,
) -> Result<PythonSidecarStatus, String> {
    get_sidecar_status_impl(app, config)
}

pub fn start_sidecar(
    app: &AppHandle,
    config: Option<PythonRuntimeConfig>,
) -> Result<PythonSidecarStartResponse, String> {
    start_sidecar_impl(app, config)
}

pub fn stop_sidecar(
    app: &AppHandle,
    config: Option<PythonRuntimeConfig>,
) -> Result<PythonSidecarStatus, String> {
    stop_sidecar_impl(app, config)
}

pub fn call_sidecar_action(
    app: &AppHandle,
    request: PythonSidecarActionRequest,
) -> Result<PythonSidecarActionResponse, String> {
    call_sidecar_impl(app, request)
}

pub fn decode_sidecar_action_result<TResult: DeserializeOwned>(
    response: &PythonSidecarActionResponse,
) -> Result<TResult, String> {
    decode_sidecar_result_json(&response.result_json)
}

pub fn call_sidecar_action_json<TPayload, TResult>(
    app: &AppHandle,
    config: Option<PythonRuntimeConfig>,
    action_id: impl Into<String>,
    payload: Option<TPayload>,
    working_directory: Option<String>,
    environment: Option<HashMap<String, String>>,
    start_if_needed: Option<bool>,
) -> Result<PythonSidecarDecodedActionResponse<TResult>, String>
where
    TPayload: serde::Serialize,
    TResult: DeserializeOwned,
{
    let raw = call_sidecar_impl(
        app,
        PythonSidecarActionRequest {
            config,
            action_id: action_id.into(),
            payload_json: encode_sidecar_payload_json(payload.as_ref())?,
            working_directory,
            environment,
            start_if_needed,
        },
    )?;
    let result = decode_sidecar_action_result(&raw)?;

    Ok(PythonSidecarDecodedActionResponse { raw, result })
}

impl PythonSidecarManager {
    fn set_last_error(&self, error: Option<String>) -> Result<(), String> {
        let mut guard = self
            .last_error
            .lock()
            .map_err(|_| "python sidecar error state lock poisoned".to_string())?;
        *guard = error;
        Ok(())
    }

    fn get_last_error(&self) -> Result<Option<String>, String> {
        let guard = self
            .last_error
            .lock()
            .map_err(|_| "python sidecar error state lock poisoned".to_string())?;
        Ok(guard.clone())
    }
}

impl PythonSidecarSession {
    fn send_request(
        &mut self,
        kind: &str,
        action_id: Option<String>,
        payload_json: Option<String>,
        cwd: Option<String>,
        environment: Option<HashMap<String, String>>,
    ) -> Result<PythonSidecarProtocolResponse, String> {
        self.request_counter += 1;
        let request_id = format!("sidecar-{}", self.request_counter);
        let request = PythonSidecarProtocolRequest {
            request_id: request_id.clone(),
            kind: kind.to_string(),
            action_id,
            payload_json,
            cwd,
            environment,
        };

        let serialized = serde_json::to_string(&request)
            .map_err(|error| format!("Failed to serialize sidecar request: {error}"))?;
        self.stdin
            .write_all(serialized.as_bytes())
            .and_then(|_| self.stdin.write_all(b"\n"))
            .and_then(|_| self.stdin.flush())
            .map_err(|error| format!("Failed to write to Python sidecar stdin: {error}"))?;

        let mut response_line = String::new();
        let bytes_read = self
            .stdout
            .read_line(&mut response_line)
            .map_err(|error| format!("Failed to read Python sidecar stdout: {error}"))?;
        if bytes_read == 0 {
            return Err("Python sidecar exited before returning a response.".to_string());
        }

        let response: PythonSidecarProtocolResponse = serde_json::from_str(response_line.trim())
            .map_err(|error| {
                format!(
                    "Failed to parse Python sidecar response '{}': {error}",
                    response_line.trim()
                )
            })?;

        if response.request_id != request_id {
            return Err(format!(
                "Python sidecar response id mismatch. Expected {}, got {}.",
                request_id, response.request_id
            ));
        }

        Ok(response)
    }

    fn stop(&mut self) {
        let _ = self.send_request("shutdown", None, None, None, None);
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

fn repo_python_workspace_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../src-python")
}

fn repo_local_model_catalog_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../src/config/localModelCatalog.json")
}

fn should_skip_workspace_entry(path: &Path) -> bool {
    path.components().any(|component| {
        matches!(
            component.as_os_str().to_string_lossy().as_ref(),
            "__pycache__" | ".pytest_cache"
        )
    })
}

fn build_sidecar_paths(
    paths: &RuntimePaths,
    manifest: &PythonSidecarWorkspaceManifest,
) -> PythonSidecarPaths {
    let workspace_root = paths.root_dir.join(PYTHON_SIDECAR_WORKSPACE_DIR_NAME);
    PythonSidecarPaths {
        manifest_path: workspace_root.join(PYTHON_SIDECAR_MANIFEST_FILENAME),
        guide_path: workspace_root.join(&manifest.guide_path),
        workspace_root,
        log_path: paths.logs_dir.join(PYTHON_SIDECAR_LOG_FILENAME),
    }
}

fn read_manifest_from_text(text: &str) -> Result<PythonSidecarWorkspaceManifest, String> {
    serde_json::from_str(text)
        .map_err(|error| format!("Failed to parse Python sidecar manifest: {error}"))
}

fn load_sidecar_manifest() -> Result<PythonSidecarWorkspaceManifest, String> {
    let repo_manifest_path = repo_python_workspace_root().join(PYTHON_SIDECAR_MANIFEST_FILENAME);
    if repo_manifest_path.exists() {
        let text = fs::read_to_string(&repo_manifest_path).map_err(|error| {
            format!(
                "Failed to read Python sidecar manifest {}: {error}",
                path_to_string(&repo_manifest_path)
            )
        })?;
        return read_manifest_from_text(&text);
    }

    let embedded = EMBEDDED_PYTHON_WORKSPACE
        .get_file(PYTHON_SIDECAR_MANIFEST_FILENAME)
        .ok_or_else(|| "Embedded Python sidecar manifest is missing.".to_string())?;
    let text = std::str::from_utf8(embedded.contents())
        .map_err(|error| format!("Embedded Python sidecar manifest is not valid UTF-8: {error}"))?;
    read_manifest_from_text(text)
}

fn copy_embedded_workspace(target_root: &Path) -> Result<(), String> {
    for entry in EMBEDDED_PYTHON_WORKSPACE.entries() {
        match entry {
            DirEntry::Dir(dir) => copy_embedded_directory(target_root, dir)?,
            DirEntry::File(file) => {
                let target_path = target_root.join(file.path());
                if let Some(parent) = target_path.parent() {
                    fs::create_dir_all(parent).map_err(|error| {
                        format!(
                            "Failed to create embedded Python sidecar directory {}: {error}",
                            path_to_string(parent)
                        )
                    })?;
                }
                fs::write(&target_path, file.contents()).map_err(|error| {
                    format!(
                        "Failed to write embedded Python sidecar file {}: {error}",
                        path_to_string(&target_path)
                    )
                })?;
            }
        }
    }

    Ok(())
}

fn copy_embedded_directory(target_root: &Path, dir: &Dir<'_>) -> Result<(), String> {
    let directory_path = target_root.join(dir.path());
    fs::create_dir_all(&directory_path).map_err(|error| {
        format!(
            "Failed to create embedded Python sidecar directory {}: {error}",
            path_to_string(&directory_path)
        )
    })?;

    for entry in dir.entries() {
        match entry {
            DirEntry::Dir(child) => copy_embedded_directory(target_root, child)?,
            DirEntry::File(file) => {
                let file_path = target_root.join(file.path());
                if let Some(parent) = file_path.parent() {
                    fs::create_dir_all(parent).map_err(|error| {
                        format!(
                            "Failed to create embedded Python sidecar directory {}: {error}",
                            path_to_string(parent)
                        )
                    })?;
                }
                fs::write(&file_path, file.contents()).map_err(|error| {
                    format!(
                        "Failed to write embedded Python sidecar file {}: {error}",
                        path_to_string(&file_path)
                    )
                })?;
            }
        }
    }

    Ok(())
}

fn copy_filesystem_workspace(source_root: &Path, target_root: &Path) -> Result<(), String> {
    fn recurse(source_root: &Path, current: &Path, target_root: &Path) -> Result<(), String> {
        let entries = fs::read_dir(current).map_err(|error| {
            format!(
                "Failed to read Python sidecar source directory {}: {error}",
                path_to_string(current)
            )
        })?;

        for entry in entries {
            let entry = entry.map_err(|error| {
                format!(
                    "Failed to read Python sidecar source entry inside {}: {error}",
                    path_to_string(current)
                )
            })?;
            let path = entry.path();
            let relative_path = path.strip_prefix(source_root).map_err(|error| {
                format!(
                    "Failed to resolve Python sidecar relative path for {}: {error}",
                    path_to_string(&path)
                )
            })?;

            if should_skip_workspace_entry(relative_path) {
                continue;
            }

            let target_path = target_root.join(relative_path);
            if path.is_dir() {
                fs::create_dir_all(&target_path).map_err(|error| {
                    format!(
                        "Failed to create Python sidecar target directory {}: {error}",
                        path_to_string(&target_path)
                    )
                })?;
                recurse(source_root, &path, target_root)?;
            } else {
                if let Some(parent) = target_path.parent() {
                    fs::create_dir_all(parent).map_err(|error| {
                        format!(
                            "Failed to create Python sidecar target directory {}: {error}",
                            path_to_string(parent)
                        )
                    })?;
                }
                fs::copy(&path, &target_path).map_err(|error| {
                    format!(
                        "Failed to copy Python sidecar file {} to {}: {error}",
                        path_to_string(&path),
                        path_to_string(&target_path)
                    )
                })?;
            }
        }

        Ok(())
    }

    recurse(source_root, source_root, target_root)
}

fn load_local_model_catalog_text() -> Result<String, String> {
    let repo_catalog_path = repo_local_model_catalog_path();
    if repo_catalog_path.exists() {
        return fs::read_to_string(&repo_catalog_path).map_err(|error| {
            format!(
                "Failed to read local model catalog {}: {error}",
                path_to_string(&repo_catalog_path)
            )
        });
    }

    Ok(EMBEDDED_LOCAL_MODEL_CATALOG_TEXT.to_string())
}

fn sync_sidecar_runtime_assets(target_root: &Path) -> Result<(), String> {
    let local_model_catalog_path = target_root.join(LOCAL_MODEL_CATALOG_RUNTIME_RELATIVE_PATH);
    if let Some(parent) = local_model_catalog_path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "Failed to create Python sidecar runtime asset directory {}: {error}",
                path_to_string(parent)
            )
        })?;
    }

    let local_model_catalog_text = load_local_model_catalog_text()?;
    fs::write(&local_model_catalog_path, local_model_catalog_text).map_err(|error| {
        format!(
            "Failed to write Python sidecar local model catalog {}: {error}",
            path_to_string(&local_model_catalog_path)
        )
    })?;

    Ok(())
}

fn sync_python_workspace(
    paths: &RuntimePaths,
) -> Result<(PythonSidecarWorkspaceManifest, PythonSidecarPaths), String> {
    let manifest = load_sidecar_manifest()?;
    let sidecar_paths = build_sidecar_paths(paths, &manifest);

    if sidecar_paths.workspace_root.exists() {
        fs::remove_dir_all(&sidecar_paths.workspace_root).map_err(|error| {
            format!(
                "Failed to replace Python sidecar workspace {}: {error}",
                path_to_string(&sidecar_paths.workspace_root)
            )
        })?;
    }
    fs::create_dir_all(&sidecar_paths.workspace_root).map_err(|error| {
        format!(
            "Failed to create Python sidecar workspace {}: {error}",
            path_to_string(&sidecar_paths.workspace_root)
        )
    })?;

    let repo_root = repo_python_workspace_root();
    if repo_root.exists() {
        copy_filesystem_workspace(&repo_root, &sidecar_paths.workspace_root)?;
    } else {
        copy_embedded_workspace(&sidecar_paths.workspace_root)?;
    }
    sync_sidecar_runtime_assets(&sidecar_paths.workspace_root)?;

    Ok((manifest, sidecar_paths))
}

fn prepend_python_workspace_to_environment(
    paths: &RuntimePaths,
    workspace_root: &Path,
) -> HashMap<String, String> {
    let mut environment = pythonpath_environment(paths, None);
    let separator = if cfg!(target_os = "windows") {
        ";"
    } else {
        ":"
    };
    let workspace_root_string = path_to_string(workspace_root);
    let current_pythonpath = environment.get("PYTHONPATH").cloned().unwrap_or_default();
    let pythonpath = if current_pythonpath.trim().is_empty() {
        workspace_root_string.clone()
    } else {
        format!("{workspace_root_string}{separator}{current_pythonpath}")
    };
    environment.insert("PYTHONPATH".to_string(), pythonpath);
    environment.insert(
        PYTHON_SIDECAR_ENV_RUNTIME_ROOT.to_string(),
        path_to_string(&paths.root_dir),
    );
    environment.insert(
        PYTHON_SIDECAR_ENV_WORKSPACE_ROOT.to_string(),
        workspace_root_string,
    );
    environment.insert(
        PYTHON_SIDECAR_ENV_PROTOCOL.to_string(),
        "stdio-json-lines".to_string(),
    );
    environment.insert(PYTHON_SIDECAR_ENV_UNBUFFERED.to_string(), "1".to_string());
    environment
}

fn spawn_sidecar_session(
    paths: &RuntimePaths,
    manifest: PythonSidecarWorkspaceManifest,
    sidecar_paths: PythonSidecarPaths,
) -> Result<PythonSidecarSession, String> {
    let managed_python = managed_python_path(paths);
    let log_file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&sidecar_paths.log_path)
        .map_err(|error| {
            format!(
                "Failed to open Python sidecar log file {}: {error}",
                path_to_string(&sidecar_paths.log_path)
            )
        })?;

    let mut command = Command::new(&managed_python);
    command
        .arg("-m")
        .arg(&manifest.entry_module)
        .arg("--stdio")
        .current_dir(&sidecar_paths.workspace_root)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::from(log_file));

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    for (key, value) in
        prepend_python_workspace_to_environment(paths, &sidecar_paths.workspace_root)
    {
        command.env(key, value);
    }

    let mut child = command.spawn().map_err(|error| {
        format!(
            "Failed to launch Python sidecar with {}: {error}",
            path_to_string(&managed_python)
        )
    })?;
    let pid = child.id();
    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| "Python sidecar stdin pipe was not available.".to_string())?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Python sidecar stdout pipe was not available.".to_string())?;
    let mut session = PythonSidecarSession {
        runtime_root: paths.root_dir.clone(),
        sidecar_paths,
        manifest: manifest.clone(),
        child,
        stdin,
        stdout: BufReader::new(stdout),
        pid,
        request_counter: 0,
    };

    let handshake = session.send_request("handshake", None, None, None, None)?;
    if !handshake.ok {
        let error = handshake
            .error
            .unwrap_or_else(|| "Python sidecar handshake failed.".to_string());
        session.stop();
        return Err(error);
    }

    let handshake_payload = handshake
        .result_json
        .ok_or_else(|| "Python sidecar handshake returned no payload.".to_string())
        .and_then(|payload| {
            serde_json::from_str::<PythonSidecarHandshakePayload>(&payload).map_err(|error| {
                format!("Failed to parse Python sidecar handshake payload: {error}")
            })
        })?;

    if handshake_payload.manifest_id != manifest.id
        || handshake_payload.module_name != manifest.module_name
        || handshake_payload.entry_module != manifest.entry_module
        || handshake_payload.transport != manifest.transport
    {
        session.stop();
        return Err("Python sidecar handshake did not match the local manifest.".to_string());
    }

    let mut expected_actions = manifest
        .actions
        .iter()
        .map(|action| action.id.clone())
        .collect::<Vec<_>>();
    expected_actions.sort();
    if handshake_payload.available_actions != expected_actions {
        session.stop();
        return Err("Python sidecar handshake returned an unexpected action registry.".to_string());
    }

    Ok(session)
}

fn sidecar_status_from_parts(
    paths: &RuntimePaths,
    manifest: &PythonSidecarWorkspaceManifest,
    sidecar_paths: &PythonSidecarPaths,
    running: bool,
    pid: Option<u32>,
    last_error: Option<String>,
) -> PythonSidecarStatus {
    PythonSidecarStatus {
        runtime_root: path_to_string(&paths.root_dir),
        workspace_root: path_to_string(&sidecar_paths.workspace_root),
        manifest_path: path_to_string(&sidecar_paths.manifest_path),
        guide_path: path_to_string(&sidecar_paths.guide_path),
        log_path: path_to_string(&sidecar_paths.log_path),
        running,
        pid,
        module_name: manifest.module_name.clone(),
        entry_module: manifest.entry_module.clone(),
        transport: manifest.transport.clone(),
        action_ids: manifest
            .actions
            .iter()
            .map(|action| action.id.clone())
            .collect(),
        last_error,
    }
}

fn session_matches_runtime_root(session: &PythonSidecarSession, runtime_root: &Path) -> bool {
    session.runtime_root == runtime_root
}

fn current_sidecar_process_status(
    manager: &PythonSidecarManager,
    runtime_root: &Path,
) -> Result<(bool, Option<u32>), String> {
    let mut session_guard = manager
        .session
        .lock()
        .map_err(|_| "python sidecar session lock poisoned".to_string())?;

    let Some(session) = session_guard.as_mut() else {
        return Ok((false, None));
    };

    if !session_matches_runtime_root(session, runtime_root) {
        return Ok((false, None));
    }

    match session.child.try_wait() {
        Ok(Some(status)) => {
            manager.set_last_error(Some(format!(
                "Python sidecar exited with status {}.",
                status.code().unwrap_or(-1)
            )))?;
            *session_guard = None;
            Ok((false, None))
        }
        Ok(None) => Ok((true, Some(session.pid))),
        Err(error) => {
            manager.set_last_error(Some(format!(
                "Failed to inspect Python sidecar process state: {error}"
            )))?;
            *session_guard = None;
            Ok((false, None))
        }
    }
}

fn stop_current_sidecar_session(manager: &PythonSidecarManager) -> Result<(), String> {
    let mut session_guard = manager
        .session
        .lock()
        .map_err(|_| "python sidecar session lock poisoned".to_string())?;
    if let Some(session) = session_guard.as_mut() {
        session.stop();
    }
    *session_guard = None;
    Ok(())
}

fn get_sidecar_status_impl(
    app: &AppHandle,
    config: Option<PythonRuntimeConfig>,
) -> Result<PythonSidecarStatus, String> {
    let manager = app.state::<PythonSidecarManager>();
    let manifest = load_sidecar_manifest()?;
    let resolved = resolve_runtime_config(app, config)?;
    let paths = build_runtime_paths(&resolved.runtime_root);
    let sidecar_paths = build_sidecar_paths(&paths, &manifest);
    let (running, pid) = current_sidecar_process_status(&manager, &paths.root_dir)?;

    Ok(sidecar_status_from_parts(
        &paths,
        &manifest,
        &sidecar_paths,
        running,
        pid,
        manager.get_last_error()?,
    ))
}

fn start_sidecar_impl(
    app: &AppHandle,
    config: Option<PythonRuntimeConfig>,
) -> Result<PythonSidecarStartResponse, String> {
    let manager = app.state::<PythonSidecarManager>();
    let (resolved, paths, interpreters, base_interpreter) =
        prepare_managed_python_runtime(app, config)?;
    if resolved.create_boilerplate {
        seed_boilerplate_files(&paths, &resolved.bootstrap_packages)?;
    } else {
        ensure_runtime_directories(&paths)?;
    }

    let runtime_status = runtime_status_with_base_interpreter(
        &resolved,
        &paths,
        interpreters,
        Some(base_interpreter),
    );

    let manifest = load_sidecar_manifest()?;
    let sidecar_paths = build_sidecar_paths(&paths, &manifest);
    let (running, pid) = current_sidecar_process_status(&manager, &paths.root_dir)?;
    if running {
        manager.set_last_error(None)?;
        return Ok(PythonSidecarStartResponse {
            runtime_status,
            sidecar: sidecar_status_from_parts(&paths, &manifest, &sidecar_paths, true, pid, None),
        });
    }

    stop_current_sidecar_session(&manager)?;

    let (synced_manifest, synced_paths) = sync_python_workspace(&paths)?;
    let session = spawn_sidecar_session(&paths, synced_manifest.clone(), synced_paths.clone())?;
    let pid = session.pid;
    {
        let mut session_guard = manager
            .session
            .lock()
            .map_err(|_| "python sidecar session lock poisoned".to_string())?;
        *session_guard = Some(session);
    }
    manager.set_last_error(None)?;

    Ok(PythonSidecarStartResponse {
        runtime_status,
        sidecar: sidecar_status_from_parts(
            &paths,
            &synced_manifest,
            &synced_paths,
            true,
            Some(pid),
            None,
        ),
    })
}

fn stop_sidecar_impl(
    app: &AppHandle,
    config: Option<PythonRuntimeConfig>,
) -> Result<PythonSidecarStatus, String> {
    let manager = app.state::<PythonSidecarManager>();
    let manifest = load_sidecar_manifest()?;
    let resolved = resolve_runtime_config(app, config)?;
    let paths = build_runtime_paths(&resolved.runtime_root);
    let sidecar_paths = build_sidecar_paths(&paths, &manifest);

    stop_current_sidecar_session(&manager)?;
    manager.set_last_error(None)?;

    Ok(sidecar_status_from_parts(
        &paths,
        &manifest,
        &sidecar_paths,
        false,
        None,
        None,
    ))
}

fn call_sidecar_impl(
    app: &AppHandle,
    request: PythonSidecarActionRequest,
) -> Result<PythonSidecarActionResponse, String> {
    let manager = app.state::<PythonSidecarManager>();
    let start_if_needed = request.start_if_needed.unwrap_or(true);
    let action_id = request.action_id.trim().to_string();
    if action_id.is_empty() {
        return Err("Python sidecar action id cannot be empty.".to_string());
    }

    let start_response = if start_if_needed {
        Some(start_sidecar_impl(app, request.config.clone())?)
    } else {
        None
    };

    let runtime_status = if let Some(response) = start_response {
        response.runtime_status
    } else {
        let (resolved, paths, interpreters, base_interpreter) =
            prepare_managed_python_runtime(app, request.config.clone())?;
        runtime_status_with_base_interpreter(
            &resolved,
            &paths,
            interpreters,
            Some(base_interpreter),
        )
    };

    let mut session_guard = manager
        .session
        .lock()
        .map_err(|_| "python sidecar session lock poisoned".to_string())?;
    let session = session_guard
        .as_mut()
        .ok_or_else(|| "Python sidecar is not running.".to_string())?;

    if !session_matches_runtime_root(session, Path::new(&runtime_status.runtime_root)) {
        return Err("Python sidecar is running for a different runtime root.".to_string());
    }

    let working_directory = request
        .working_directory
        .clone()
        .unwrap_or_else(|| runtime_status.runtime_root.clone());
    let response = session.send_request(
        "action",
        Some(action_id.clone()),
        request.payload_json.clone(),
        Some(working_directory),
        request.environment.clone(),
    )?;

    if !response.ok {
        let error = response
            .error
            .clone()
            .unwrap_or_else(|| format!("Python sidecar action '{}' failed.", action_id));
        manager.set_last_error(Some(error.clone()))?;
        return Err(error);
    }

    manager.set_last_error(None)?;

    Ok(PythonSidecarActionResponse {
        runtime_status,
        sidecar: sidecar_status_from_parts(
            &build_runtime_paths(&session.runtime_root),
            &session.manifest,
            &session.sidecar_paths,
            true,
            Some(session.pid),
            None,
        ),
        request_id: response.request_id,
        action_id,
        result_json: response.result_json.unwrap_or_else(|| "null".to_string()),
    })
}

#[tauri::command]
#[specta::specta]
pub async fn python_get_sidecar_status(
    app: AppHandle,
    config: Option<PythonRuntimeConfig>,
) -> Result<PythonSidecarStatus, String> {
    tokio::task::spawn_blocking(move || get_sidecar_status_impl(&app, config))
        .await
        .map_err(|error| format!("Python sidecar status task failed to join: {error}"))?
}

#[tauri::command]
#[specta::specta]
pub async fn python_start_sidecar(
    app: AppHandle,
    config: Option<PythonRuntimeConfig>,
) -> Result<PythonSidecarStartResponse, String> {
    tokio::task::spawn_blocking(move || start_sidecar_impl(&app, config))
        .await
        .map_err(|error| format!("Python sidecar start task failed to join: {error}"))?
}

#[tauri::command]
#[specta::specta]
pub async fn python_stop_sidecar(
    app: AppHandle,
    config: Option<PythonRuntimeConfig>,
) -> Result<PythonSidecarStatus, String> {
    tokio::task::spawn_blocking(move || stop_sidecar_impl(&app, config))
        .await
        .map_err(|error| format!("Python sidecar stop task failed to join: {error}"))?
}

#[tauri::command]
#[specta::specta]
pub async fn python_sidecar_call(
    app: AppHandle,
    request: PythonSidecarActionRequest,
) -> Result<PythonSidecarActionResponse, String> {
    tokio::task::spawn_blocking(move || call_sidecar_impl(&app, request))
        .await
        .map_err(|error| format!("Python sidecar action task failed to join: {error}"))?
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn sidecar_manifest_parses_expected_shape() {
        let manifest = load_sidecar_manifest().expect("manifest should parse");
        assert_eq!(manifest.id, "greeblefs-python-sidecar");
        assert_eq!(manifest.module_name, "greeblefs_sidecar");
        assert!(manifest
            .actions
            .iter()
            .any(|action| action.id == action_ids::ML_PROBE));
        assert!(manifest
            .actions
            .iter()
            .any(|action| action.id == action_ids::RUNTIME_SUMMARY));
    }

    #[test]
    fn sidecar_paths_live_under_the_runtime_root() {
        let manifest = load_sidecar_manifest().expect("manifest should parse");
        let runtime_paths = build_runtime_paths(Path::new("/tmp/greeblefs-python-runtime"));
        let sidecar_paths = build_sidecar_paths(&runtime_paths, &manifest);
        assert_eq!(
            sidecar_paths.workspace_root,
            runtime_paths
                .root_dir
                .join(PYTHON_SIDECAR_WORKSPACE_DIR_NAME)
        );
        assert_eq!(
            sidecar_paths.manifest_path,
            sidecar_paths
                .workspace_root
                .join(PYTHON_SIDECAR_MANIFEST_FILENAME)
        );
        assert_eq!(
            sidecar_paths.log_path,
            runtime_paths.logs_dir.join(PYTHON_SIDECAR_LOG_FILENAME)
        );
    }

    #[test]
    fn sidecar_result_json_decodes_into_typed_payload() {
        let decoded: serde_json::Value =
            decode_sidecar_result_json("{\"status\":\"ok\",\"count\":3}")
                .expect("json should decode");

        assert_eq!(decoded["status"], "ok");
        assert_eq!(decoded["count"], 3);
    }

    #[test]
    fn sync_python_workspace_seeds_local_model_catalog_into_runtime_workspace() {
        let temp_dir = tempdir().expect("tempdir should be created");
        let runtime_paths = build_runtime_paths(temp_dir.path());
        let (_, sidecar_paths) =
            sync_python_workspace(&runtime_paths).expect("sidecar workspace should sync");
        let seeded_catalog_path = sidecar_paths
            .workspace_root
            .join(LOCAL_MODEL_CATALOG_RUNTIME_RELATIVE_PATH);
        let seeded_catalog_text =
            fs::read_to_string(&seeded_catalog_path).expect("seeded catalog should be readable");
        let expected_catalog_text =
            load_local_model_catalog_text().expect("expected catalog should load");

        let seeded_catalog_json: serde_json::Value = serde_json::from_str(&seeded_catalog_text)
            .expect("seeded catalog should be valid json");
        let expected_catalog_json: serde_json::Value = serde_json::from_str(&expected_catalog_text)
            .expect("expected catalog should be valid json");

        assert_eq!(seeded_catalog_json, expected_catalog_json);
    }
}
