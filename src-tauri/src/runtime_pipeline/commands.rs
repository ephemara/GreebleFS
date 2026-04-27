//! Tauri/Specta command surface for the universal runtime pipeline.
//!
//! These commands form the `runtime-host-v1` bridge. The frontend's
//! `externalRuntimeBackend.ts` is the canonical TS consumer, and the
//! `goRuntimeBackend.ts` convenience layer composes them into Go-flavored
//! ergonomics on top.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

use crate::runtime_pipeline::cache::{CacheKeyParts, CompileCacheLayout};
use crate::runtime_pipeline::command_runtime::{
    run_native_command, ExternalRuntimeCommandRequest, ExternalRuntimeCommandResult,
};
use crate::runtime_pipeline::discovery::{
    DiscoveredRuntimePackage, RuntimeDiscoveryRoot, RuntimePackageOrigin,
};
use crate::runtime_pipeline::manifest::{
    RuntimeCompiler, RuntimeKind, RuntimeManifest,
};
use crate::runtime_pipeline::registry::RuntimeRegistry;
use crate::runtime_pipeline::sidecar::{
    ExternalRuntimeSidecarCallResponse, ExternalRuntimeSidecarStatus, ExternalSidecarManager,
};
use crate::runtime_pipeline::toolchain::{probe_runtime_toolchains, RuntimeToolchainStatus};
use crate::runtime_pipeline::tui::{build_tui_launch, ExternalRuntimeTuiLaunch};

const BUILTIN_RUNTIMES_ROOT_ID: &str = "builtin";
const MANAGED_RUNTIMES_ROOT_ID: &str = "managed";
const RUNTIMES_MANAGED_DIR_NAME: &str = "runtimes";
const BUILTIN_RUNTIMES_REPO_RELATIVE: &str = "../src-go/builtin-runtimes";

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeListPackagesRequest {
    /// Optional extra discovery roots passed in from the frontend (e.g. dev
    /// time `runtimes/` in the workspace). Always merged with the host's
    /// builtin and managed roots.
    #[serde(default)]
    pub additional_roots: Vec<RuntimeDiscoveryRootDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeDiscoveryRootDto {
    pub root_id: String,
    pub origin: RuntimePackageOrigin,
    pub directory: String,
}

#[derive(Debug, Clone, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeListPackagesResponse {
    pub packages: Vec<DiscoveredRuntimePackage>,
    pub builtin_root: Option<String>,
    pub managed_root: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct RuntimePreparePackageRequest {
    pub runtime_id: String,
    /// Build mode: `release` or `debug`. Defaults to `release`.
    #[serde(default = "default_release_mode")]
    pub mode: String,
    /// Target triple for native artifacts (host triple by default), or
    /// `js-wasm` / `tinygo-wasm` for wasm-* kinds. Resolved automatically
    /// from compiler when omitted.
    #[serde(default)]
    pub target: Option<String>,
    /// Force rebuild even when the cache hits.
    #[serde(default)]
    pub force_rebuild: bool,
}

fn default_release_mode() -> String {
    "release".to_string()
}

#[derive(Debug, Clone, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct RuntimePreparePackageResponse {
    pub runtime_id: String,
    pub artifact_path: String,
    pub artifact_kind: String,
    pub cache_key: String,
    pub cache_hit: bool,
    pub toolchain_version: String,
    pub mode: String,
    pub target: String,
    pub source_signature: String,
    pub stdout: String,
    pub stderr: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeStartSidecarRequest {
    pub runtime_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeStopSidecarRequest {
    pub runtime_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeCallRequest {
    pub runtime_id: String,
    pub action_id: String,
    #[serde(default)]
    pub payload_json: Option<String>,
    #[serde(default)]
    pub working_directory: Option<String>,
    #[serde(default)]
    pub environment: Option<HashMap<String, String>>,
    #[serde(default)]
    pub start_if_needed: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeOpenTuiRequest {
    pub runtime_id: String,
}

#[tauri::command]
#[specta::specta]
pub async fn runtime_list_packages(
    app: AppHandle,
    registry: State<'_, RuntimeRegistry>,
    request: Option<RuntimeListPackagesRequest>,
) -> Result<RuntimeListPackagesResponse, String> {
    let request = request.unwrap_or(RuntimeListPackagesRequest::default_empty());
    let mut roots = build_default_discovery_roots(&app);
    let builtin_root = roots
        .iter()
        .find(|root| root.root_id == BUILTIN_RUNTIMES_ROOT_ID)
        .map(|root| root.directory.to_string_lossy().to_string());
    let managed_root = roots
        .iter()
        .find(|root| root.root_id == MANAGED_RUNTIMES_ROOT_ID)
        .map(|root| root.directory.to_string_lossy().to_string());
    for additional in request.additional_roots {
        roots.push(RuntimeDiscoveryRoot::new(
            additional.root_id,
            additional.origin,
            PathBuf::from(additional.directory),
        ));
    }
    let packages = registry.refresh_from_roots(roots);
    Ok(RuntimeListPackagesResponse {
        packages,
        builtin_root,
        managed_root,
    })
}

impl RuntimeListPackagesRequest {
    fn default_empty() -> Self {
        Self {
            additional_roots: Vec::new(),
        }
    }
}

#[tauri::command]
#[specta::specta]
pub async fn runtime_get_toolchain_status() -> Result<RuntimeToolchainStatus, String> {
    Ok(probe_runtime_toolchains())
}

#[tauri::command]
#[specta::specta]
pub async fn runtime_prepare_package(
    app: AppHandle,
    registry: State<'_, RuntimeRegistry>,
    request: RuntimePreparePackageRequest,
) -> Result<RuntimePreparePackageResponse, String> {
    let package = require_package(&registry, &app, &request.runtime_id)?;
    let manifest = &package.manifest;

    let target = request
        .target
        .clone()
        .unwrap_or_else(|| default_target_for_compiler(manifest.compiler));
    let mode = request.mode.clone();

    let toolchain_version = resolve_toolchain_version(manifest.compiler)?;

    let layout = CompileCacheLayout::from_app(&app)?;
    let cache_key = CacheKeyParts {
        runtime_id: &manifest.id,
        compiler: manifest.compiler.as_str(),
        toolchain_version: &toolchain_version,
        target: &target,
        mode: &mode,
        source_signature: &manifest.source_signature,
    }
    .finalize();
    let entry = layout.entry_for(&cache_key);
    entry.ensure_dir()?;

    let artifact_name = artifact_name_for_compiler(manifest.compiler, &manifest.id);
    let artifact_path = entry.artifact_path(&artifact_name);

    let cache_hit = !request.force_rebuild && artifact_path.exists();
    let mut stdout = String::new();
    let mut stderr = String::new();
    if !cache_hit {
        let build_result = invoke_build_script(manifest, &artifact_path, &target, &mode)?;
        stdout = build_result.stdout;
        stderr = build_result.stderr;
    }

    Ok(RuntimePreparePackageResponse {
        runtime_id: manifest.id.clone(),
        artifact_path: artifact_path.to_string_lossy().to_string(),
        artifact_kind: artifact_name,
        cache_key,
        cache_hit,
        toolchain_version,
        mode,
        target,
        source_signature: manifest.source_signature.clone(),
        stdout,
        stderr,
    })
}

#[tauri::command]
#[specta::specta]
pub async fn runtime_start_sidecar(
    app: AppHandle,
    registry: State<'_, RuntimeRegistry>,
    sidecar_state: State<'_, ExternalSidecarManager>,
    request: RuntimeStartSidecarRequest,
) -> Result<ExternalRuntimeSidecarStatus, String> {
    let package = require_package(&registry, &app, &request.runtime_id)?;
    if matches!(package.manifest.compiler, RuntimeCompiler::PythonSidecar) {
        return Err(
            "Use the legacy `python_*` Tauri commands for Python sidecars; this lane is for Go/Wasm runtimes."
                .to_string(),
        );
    }

    let prepared = runtime_prepare_package(
        app.clone(),
        registry.clone(),
        RuntimePreparePackageRequest {
            runtime_id: package.manifest.id.clone(),
            mode: "release".to_string(),
            target: None,
            force_rebuild: false,
        },
    )
    .await?;
    let binary_path = PathBuf::from(prepared.artifact_path);
    sidecar_state.start(&package.manifest, &binary_path)
}

#[tauri::command]
#[specta::specta]
pub async fn runtime_stop_sidecar(
    sidecar_state: State<'_, ExternalSidecarManager>,
    request: RuntimeStopSidecarRequest,
) -> Result<ExternalRuntimeSidecarStatus, String> {
    Ok(sidecar_state.stop(&request.runtime_id))
}

#[tauri::command]
#[specta::specta]
pub async fn runtime_call(
    app: AppHandle,
    registry: State<'_, RuntimeRegistry>,
    sidecar_state: State<'_, ExternalSidecarManager>,
    request: RuntimeCallRequest,
) -> Result<ExternalRuntimeSidecarCallResponse, String> {
    let package = require_package(&registry, &app, &request.runtime_id)?;
    if !matches!(package.manifest.kind, RuntimeKind::NativeSidecar) {
        return Err(format!(
            "runtime_call requires a native-sidecar runtime (got kind = {})",
            package.manifest.kind.as_str()
        ));
    }

    if request.start_if_needed.unwrap_or(true) {
        let status = sidecar_state.status(&request.runtime_id);
        if !status.running {
            let _ = runtime_start_sidecar(
                app.clone(),
                registry.clone(),
                sidecar_state.clone(),
                RuntimeStartSidecarRequest {
                    runtime_id: request.runtime_id.clone(),
                },
            )
            .await?;
        }
    }

    sidecar_state.call(
        &request.runtime_id,
        &request.action_id,
        request.payload_json,
        request.working_directory,
        request.environment,
    )
}

#[tauri::command]
#[specta::specta]
pub async fn runtime_run_command(
    app: AppHandle,
    registry: State<'_, RuntimeRegistry>,
    request: ExternalRuntimeCommandRequest,
) -> Result<ExternalRuntimeCommandResult, String> {
    let package = require_package(&registry, &app, &request.runtime_id)?;
    if !matches!(package.manifest.kind, RuntimeKind::NativeCommand) {
        return Err(format!(
            "runtime_run_command requires a native-command runtime (got kind = {})",
            package.manifest.kind.as_str()
        ));
    }

    let prepared = runtime_prepare_package(
        app,
        registry,
        RuntimePreparePackageRequest {
            runtime_id: package.manifest.id.clone(),
            mode: "release".to_string(),
            target: None,
            force_rebuild: false,
        },
    )
    .await?;
    let binary_path = PathBuf::from(prepared.artifact_path);
    run_native_command(&package.manifest, &binary_path, request)
}

#[tauri::command]
#[specta::specta]
pub async fn runtime_open_tui(
    app: AppHandle,
    registry: State<'_, RuntimeRegistry>,
    request: RuntimeOpenTuiRequest,
) -> Result<ExternalRuntimeTuiLaunch, String> {
    let package = require_package(&registry, &app, &request.runtime_id)?;
    if !matches!(package.manifest.kind, RuntimeKind::NativeTui) {
        return Err(format!(
            "runtime_open_tui requires a native-tui runtime (got kind = {})",
            package.manifest.kind.as_str()
        ));
    }
    let prepared = runtime_prepare_package(
        app,
        registry,
        RuntimePreparePackageRequest {
            runtime_id: package.manifest.id.clone(),
            mode: "release".to_string(),
            target: None,
            force_rebuild: false,
        },
    )
    .await?;
    build_tui_launch(&package.manifest, prepared.artifact_path)
}

// ---------- helpers ----------

fn require_package(
    registry: &RuntimeRegistry,
    app: &AppHandle,
    runtime_id: &str,
) -> Result<DiscoveredRuntimePackage, String> {
    if let Some(pkg) = registry.get_by_id(runtime_id) {
        return Ok(pkg);
    }
    let roots = build_default_discovery_roots(app);
    registry.refresh_from_roots(roots);
    registry
        .get_by_id(runtime_id)
        .ok_or_else(|| format!("runtime package {} is not registered", runtime_id))
}

fn build_default_discovery_roots(app: &AppHandle) -> Vec<RuntimeDiscoveryRoot> {
    let mut roots = Vec::new();
    if let Some(builtin) = repo_builtin_runtimes_root() {
        if builtin.exists() {
            roots.push(RuntimeDiscoveryRoot::new(
                BUILTIN_RUNTIMES_ROOT_ID,
                RuntimePackageOrigin::Builtin,
                builtin,
            ));
        }
    }
    // Migrated Python sidecar — same lifecycle as before, but now registered
    // through the polyglot registry so frontends see one unified catalog.
    if let Some(python_root) = repo_python_sidecar_root() {
        if python_root.join("runtime.toml").exists() {
            roots.push(RuntimeDiscoveryRoot::new(
                BUILTIN_RUNTIMES_ROOT_ID,
                RuntimePackageOrigin::Builtin,
                python_root,
            ));
        }
    }
    if let Some(managed) = managed_runtimes_root(app) {
        if managed.exists() {
            roots.push(RuntimeDiscoveryRoot::new(
                MANAGED_RUNTIMES_ROOT_ID,
                RuntimePackageOrigin::ManagedContent,
                managed,
            ));
        }
    }
    roots
}

fn repo_python_sidecar_root() -> Option<PathBuf> {
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").ok()?;
    Some(PathBuf::from(manifest_dir).join("../src-python"))
}

fn repo_builtin_runtimes_root() -> Option<PathBuf> {
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").ok()?;
    Some(PathBuf::from(manifest_dir).join(BUILTIN_RUNTIMES_REPO_RELATIVE))
}

fn managed_runtimes_root(app: &AppHandle) -> Option<PathBuf> {
    if cfg!(debug_assertions) {
        // In dev, prefer the workspace `runtimes/` so authored content stays
        // discoverable without needing app-local migration.
        if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
            let candidate = PathBuf::from(manifest_dir).join("../runtimes");
            if candidate.exists() {
                return Some(candidate);
            }
        }
    }
    let local = app.path().app_local_data_dir().ok()?;
    Some(local.join(RUNTIMES_MANAGED_DIR_NAME))
}

fn default_target_for_compiler(compiler: RuntimeCompiler) -> String {
    match compiler {
        RuntimeCompiler::GoNative => host_target_triple(),
        RuntimeCompiler::GoJsWasm => "js-wasm".to_string(),
        RuntimeCompiler::TinygoWasm => "tinygo-wasm".to_string(),
        RuntimeCompiler::PythonSidecar => "python-host".to_string(),
    }
}

fn host_target_triple() -> String {
    format!("{}-{}", std::env::consts::OS, std::env::consts::ARCH)
}

fn resolve_toolchain_version(compiler: RuntimeCompiler) -> Result<String, String> {
    let probe = probe_runtime_toolchains();
    let probe_for_compiler = match compiler {
        RuntimeCompiler::GoNative | RuntimeCompiler::GoJsWasm => &probe.go,
        RuntimeCompiler::TinygoWasm => &probe.tinygo,
        RuntimeCompiler::PythonSidecar => &probe.python,
    };
    if !probe_for_compiler.installed {
        return Err(format!(
            "toolchain {} is not installed: {}",
            probe_for_compiler.id,
            probe_for_compiler
                .error
                .clone()
                .unwrap_or_else(|| "missing".to_string())
        ));
    }
    Ok(probe_for_compiler
        .version
        .clone()
        .unwrap_or_else(|| "unknown".to_string()))
}

fn artifact_name_for_compiler(compiler: RuntimeCompiler, runtime_id: &str) -> String {
    match compiler {
        RuntimeCompiler::GoNative => {
            if cfg!(target_os = "windows") {
                format!("{runtime_id}.exe")
            } else {
                runtime_id.to_string()
            }
        }
        RuntimeCompiler::GoJsWasm | RuntimeCompiler::TinygoWasm => format!("{runtime_id}.wasm"),
        RuntimeCompiler::PythonSidecar => "python-sidecar.entry".to_string(),
    }
}

#[derive(Debug, Default)]
struct BuildScriptResult {
    stdout: String,
    stderr: String,
}

fn invoke_build_script(
    manifest: &RuntimeManifest,
    artifact_path: &Path,
    target: &str,
    mode: &str,
) -> Result<BuildScriptResult, String> {
    if matches!(manifest.compiler, RuntimeCompiler::PythonSidecar) {
        // Python sidecars have no host-side compilation step.
        return Ok(BuildScriptResult::default());
    }

    let script_path = resolve_go_build_script_path().ok_or_else(|| {
        "scripts/go/build.sh could not be located. Set GREEBLEFS_GO_BUILD_SCRIPT or reinstall the app so app-local data contains scripts/go/build.sh.".to_string()
    })?;
    let mut command = Command::new("bash");
    command
        .arg(&script_path)
        .arg("--runtime-id")
        .arg(&manifest.id)
        .arg("--module-dir")
        .arg(&manifest.module_dir)
        .arg("--entry")
        .arg(manifest.entry.as_deref().unwrap_or("."))
        .arg("--compiler")
        .arg(manifest.compiler.as_str())
        .arg("--target")
        .arg(target)
        .arg("--mode")
        .arg(mode)
        .arg("--output")
        .arg(artifact_path);

    let output = command
        .output()
        .map_err(|error| format!("failed to run go build script: {error}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if !output.status.success() {
        return Err(format!(
            "go build script exited with status {}: {}",
            output.status,
            if stderr.is_empty() { stdout.as_str() } else { stderr.as_str() }
        ));
    }
    Ok(BuildScriptResult { stdout, stderr })
}

/// Resolve the Go build script for the running host. Order of precedence:
///
///   1. `GREEBLEFS_GO_BUILD_SCRIPT` environment override (lets ops point at a
///      vendored toolchain, container path, or repo checkout).
///   2. App-local data root (`<app_local_data>/scripts/go/build.sh`) — what
///      installer scripts copy on release builds.
///   3. The dev-only repo path relative to `CARGO_MANIFEST_DIR`.
///
/// Returns `None` only when none of the candidates exist on disk; the caller
/// turns that into a stable error message that points engineers at the env
/// override or the install path so installed builds with a missing
/// `scripts/go/` are diagnosable.
pub(crate) fn resolve_go_build_script_path() -> Option<PathBuf> {
    for candidate in candidate_go_build_script_paths() {
        if candidate.exists() {
            return Some(candidate);
        }
    }
    None
}

fn candidate_go_build_script_paths() -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    if let Ok(override_path) = std::env::var("GREEBLEFS_GO_BUILD_SCRIPT") {
        if !override_path.is_empty() {
            candidates.push(PathBuf::from(override_path));
        }
    }
    if let Some(app_local) = app_local_data_dir_for_resolution() {
        candidates.push(app_local.join("scripts/go/build.sh"));
    }
    if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
        candidates.push(PathBuf::from(manifest_dir).join("../scripts/go/build.sh"));
    }
    candidates
}

#[cfg(test)]
mod build_script_resolution_tests {
    use super::*;
    use std::sync::Mutex;

    // Env var manipulation in tests must serialize because std::env::set_var
    // mutates process-global state.
    static ENV_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn env_override_wins_when_path_exists() {
        let _guard = ENV_LOCK.lock().unwrap();
        let temp = tempfile::tempdir().expect("tempdir");
        let fake = temp.path().join("custom-build.sh");
        std::fs::write(&fake, "#!/bin/sh\nexit 0\n").expect("write");

        let prev = std::env::var("GREEBLEFS_GO_BUILD_SCRIPT").ok();
        std::env::set_var("GREEBLEFS_GO_BUILD_SCRIPT", &fake);
        let resolved = resolve_go_build_script_path();
        if let Some(prev) = prev {
            std::env::set_var("GREEBLEFS_GO_BUILD_SCRIPT", prev);
        } else {
            std::env::remove_var("GREEBLEFS_GO_BUILD_SCRIPT");
        }

        assert_eq!(resolved.as_deref(), Some(fake.as_path()));
    }

    #[test]
    fn missing_env_override_does_not_block_other_candidates() {
        let _guard = ENV_LOCK.lock().unwrap();
        let temp = tempfile::tempdir().expect("tempdir");
        let nonexistent = temp.path().join("does-not-exist.sh");

        let prev = std::env::var("GREEBLEFS_GO_BUILD_SCRIPT").ok();
        std::env::set_var("GREEBLEFS_GO_BUILD_SCRIPT", &nonexistent);
        let resolved = resolve_go_build_script_path();
        if let Some(prev) = prev {
            std::env::set_var("GREEBLEFS_GO_BUILD_SCRIPT", prev);
        } else {
            std::env::remove_var("GREEBLEFS_GO_BUILD_SCRIPT");
        }

        // The dev-checkout fallback should still resolve under cargo test.
        assert!(
            resolved.is_some(),
            "build script resolution must fall through to dev fallback"
        );
    }

    /// Lazy compilation in installed/release builds: the dev repo is not on
    /// disk, but the installer has copied `scripts/go/build.sh` under the
    /// app-local data root. The resolver must pick that up via the
    /// `GREEBLEFS_APP_LOCAL_DATA_DIR` override without depending on the
    /// `CARGO_MANIFEST_DIR` fallback. This is the exact path runtime_prepare
    /// hits when a packaged build needs to compile a Go runtime on first use.
    #[test]
    fn app_local_install_layout_resolves_for_lazy_compilation() {
        let _guard = ENV_LOCK.lock().unwrap();
        let temp = tempfile::tempdir().expect("tempdir");
        let app_local = temp.path().join("install-root");
        let scripts_dir = app_local.join("scripts/go");
        std::fs::create_dir_all(&scripts_dir).expect("mkdir");
        let installed_script = scripts_dir.join("build.sh");
        std::fs::write(&installed_script, "#!/bin/sh\nexit 0\n").expect("write");

        let prev_override = std::env::var("GREEBLEFS_GO_BUILD_SCRIPT").ok();
        let prev_app_local = std::env::var("GREEBLEFS_APP_LOCAL_DATA_DIR").ok();
        std::env::remove_var("GREEBLEFS_GO_BUILD_SCRIPT");
        std::env::set_var("GREEBLEFS_APP_LOCAL_DATA_DIR", &app_local);

        let resolved = resolve_go_build_script_path();

        if let Some(prev) = prev_override {
            std::env::set_var("GREEBLEFS_GO_BUILD_SCRIPT", prev);
        } else {
            std::env::remove_var("GREEBLEFS_GO_BUILD_SCRIPT");
        }
        if let Some(prev) = prev_app_local {
            std::env::set_var("GREEBLEFS_APP_LOCAL_DATA_DIR", prev);
        } else {
            std::env::remove_var("GREEBLEFS_APP_LOCAL_DATA_DIR");
        }

        assert_eq!(
            resolved.as_deref(),
            Some(installed_script.as_path()),
            "installed app-local layout must resolve the build script for lazy compile"
        );
    }
}

/// Best-effort app-local data resolution that does not require a Tauri
/// `AppHandle`. We use the well-known XDG-style locations Tauri itself
/// resolves on each platform; the installer copies `scripts/` under that
/// root, so this is the right lookup for installed builds.
fn app_local_data_dir_for_resolution() -> Option<PathBuf> {
    if let Ok(env_root) = std::env::var("GREEBLEFS_APP_LOCAL_DATA_DIR") {
        if !env_root.is_empty() {
            return Some(PathBuf::from(env_root));
        }
    }
    #[cfg(target_os = "linux")]
    {
        let base = std::env::var_os("XDG_DATA_HOME")
            .map(PathBuf::from)
            .or_else(|| std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".local/share")))?;
        return Some(base.join("co.greeblefs.app"));
    }
    #[cfg(target_os = "macos")]
    {
        let home = std::env::var_os("HOME").map(PathBuf::from)?;
        return Some(home.join("Library/Application Support/co.greeblefs.app"));
    }
    #[cfg(target_os = "windows")]
    {
        let appdata = std::env::var_os("LOCALAPPDATA")
            .or_else(|| std::env::var_os("APPDATA"))
            .map(PathBuf::from)?;
        return Some(appdata.join("co.greeblefs.app"));
    }
    #[allow(unreachable_code)]
    None
}
