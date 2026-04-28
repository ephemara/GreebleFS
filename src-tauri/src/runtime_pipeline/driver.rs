//! Compiler-driver metadata and build invocation for the runtime pipeline.
//!
//! `commands.rs` should stay focused on the Tauri/Specta surface. Compiler-
//! specific defaults, artifact naming, toolchain routing, and build strategy
//! belong here so future compilers can plug in without reopening the command
//! transport layer.

use std::path::{Path, PathBuf};
use std::process::Command;

use crate::runtime_pipeline::manifest::{RuntimeCompiler, RuntimeManifest};
use crate::runtime_pipeline::toolchain::{
    probe_runtime_toolchains, RuntimeToolchainStatus, ToolchainProbe,
};

type ToolchainProbeSelector = for<'a> fn(&'a RuntimeToolchainStatus) -> &'a ToolchainProbe;
type RuntimeBuildInvoker =
    fn(&RuntimeManifest, &Path, &str, &str) -> Result<RuntimeCompilerBuildOutput, String>;

#[derive(Debug, Default)]
pub struct RuntimeCompilerBuildOutput {
    pub stdout: String,
    pub stderr: String,
}

struct RuntimeCompilerDriver {
    default_target_resolver: fn() -> String,
    toolchain_probe_selector: ToolchainProbeSelector,
    artifact_name_builder: fn(&str) -> String,
    build_invoker: RuntimeBuildInvoker,
}

impl RuntimeCompilerDriver {
    fn default_target(&self) -> String {
        (self.default_target_resolver)()
    }

    fn resolve_toolchain_version(&self) -> Result<String, String> {
        let probe = probe_runtime_toolchains();
        let toolchain_probe = (self.toolchain_probe_selector)(&probe);
        resolve_installed_toolchain_version(toolchain_probe)
    }

    fn artifact_name(&self, runtime_id: &str) -> String {
        (self.artifact_name_builder)(runtime_id)
    }

    fn invoke_build(
        &self,
        manifest: &RuntimeManifest,
        artifact_path: &Path,
        target: &str,
        mode: &str,
    ) -> Result<RuntimeCompilerBuildOutput, String> {
        (self.build_invoker)(manifest, artifact_path, target, mode)
    }
}

const GO_NATIVE_DRIVER: RuntimeCompilerDriver = RuntimeCompilerDriver {
    default_target_resolver: host_target_triple,
    toolchain_probe_selector: select_go_toolchain_probe,
    artifact_name_builder: build_native_binary_artifact_name,
    build_invoker: invoke_go_build_script,
};

const GO_JS_WASM_DRIVER: RuntimeCompilerDriver = RuntimeCompilerDriver {
    default_target_resolver: default_js_wasm_target,
    toolchain_probe_selector: select_go_toolchain_probe,
    artifact_name_builder: build_wasm_artifact_name,
    build_invoker: invoke_go_build_script,
};

const TINYGO_WASM_DRIVER: RuntimeCompilerDriver = RuntimeCompilerDriver {
    default_target_resolver: default_tinygo_wasm_target,
    toolchain_probe_selector: select_tinygo_toolchain_probe,
    artifact_name_builder: build_wasm_artifact_name,
    build_invoker: invoke_go_build_script,
};

const PYTHON_SIDECAR_DRIVER: RuntimeCompilerDriver = RuntimeCompilerDriver {
    default_target_resolver: default_python_host_target,
    toolchain_probe_selector: select_python_toolchain_probe,
    artifact_name_builder: build_python_sidecar_artifact_name,
    build_invoker: skip_host_build,
};

pub fn default_target_for_compiler(compiler: RuntimeCompiler) -> String {
    require_runtime_compiler_driver(compiler).default_target()
}

pub fn resolve_toolchain_version(compiler: RuntimeCompiler) -> Result<String, String> {
    require_runtime_compiler_driver(compiler).resolve_toolchain_version()
}

pub fn artifact_name_for_compiler(compiler: RuntimeCompiler, runtime_id: &str) -> String {
    require_runtime_compiler_driver(compiler).artifact_name(runtime_id)
}

pub fn invoke_build_script(
    manifest: &RuntimeManifest,
    artifact_path: &Path,
    target: &str,
    mode: &str,
) -> Result<RuntimeCompilerBuildOutput, String> {
    require_runtime_compiler_driver(manifest.compiler).invoke_build(
        manifest,
        artifact_path,
        target,
        mode,
    )
}

fn require_runtime_compiler_driver(compiler: RuntimeCompiler) -> &'static RuntimeCompilerDriver {
    match compiler {
        RuntimeCompiler::GoNative => &GO_NATIVE_DRIVER,
        RuntimeCompiler::GoJsWasm => &GO_JS_WASM_DRIVER,
        RuntimeCompiler::TinygoWasm => &TINYGO_WASM_DRIVER,
        RuntimeCompiler::PythonSidecar => &PYTHON_SIDECAR_DRIVER,
    }
}

fn host_target_triple() -> String {
    format!("{}-{}", std::env::consts::OS, std::env::consts::ARCH)
}

fn default_js_wasm_target() -> String {
    "js-wasm".to_string()
}

fn default_tinygo_wasm_target() -> String {
    "tinygo-wasm".to_string()
}

fn default_python_host_target() -> String {
    "python-host".to_string()
}

fn select_go_toolchain_probe(status: &RuntimeToolchainStatus) -> &ToolchainProbe {
    &status.go
}

fn select_tinygo_toolchain_probe(status: &RuntimeToolchainStatus) -> &ToolchainProbe {
    &status.tinygo
}

fn select_python_toolchain_probe(status: &RuntimeToolchainStatus) -> &ToolchainProbe {
    &status.python
}

fn resolve_installed_toolchain_version(probe: &ToolchainProbe) -> Result<String, String> {
    if !probe.installed {
        return Err(format!(
            "toolchain {} is not installed: {}",
            probe.id,
            probe.error.clone().unwrap_or_else(|| "missing".to_string())
        ));
    }
    Ok(probe
        .version
        .clone()
        .unwrap_or_else(|| "unknown".to_string()))
}

fn build_native_binary_artifact_name(runtime_id: &str) -> String {
    if cfg!(target_os = "windows") {
        format!("{runtime_id}.exe")
    } else {
        runtime_id.to_string()
    }
}

fn build_wasm_artifact_name(runtime_id: &str) -> String {
    format!("{runtime_id}.wasm")
}

fn build_python_sidecar_artifact_name(_: &str) -> String {
    "python-sidecar.entry".to_string()
}

fn skip_host_build(
    _: &RuntimeManifest,
    _: &Path,
    _: &str,
    _: &str,
) -> Result<RuntimeCompilerBuildOutput, String> {
    Ok(RuntimeCompilerBuildOutput::default())
}

fn invoke_go_build_script(
    manifest: &RuntimeManifest,
    artifact_path: &Path,
    target: &str,
    mode: &str,
) -> Result<RuntimeCompilerBuildOutput, String> {
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
            if stderr.is_empty() {
                stdout.as_str()
            } else {
                stderr.as_str()
            }
        ));
    }
    Ok(RuntimeCompilerBuildOutput { stdout, stderr })
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
            .or_else(|| {
                std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".local/share"))
            })?;
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn resolves_expected_driver_defaults() {
        assert!(default_target_for_compiler(RuntimeCompiler::GoNative).contains('-'));
        assert_eq!(
            default_target_for_compiler(RuntimeCompiler::GoJsWasm),
            "js-wasm"
        );
        assert_eq!(
            default_target_for_compiler(RuntimeCompiler::TinygoWasm),
            "tinygo-wasm"
        );
        assert_eq!(
            default_target_for_compiler(RuntimeCompiler::PythonSidecar),
            "python-host"
        );
    }

    #[test]
    fn resolves_expected_driver_artifact_names() {
        let native_artifact =
            artifact_name_for_compiler(RuntimeCompiler::GoNative, "notes-preview");
        if cfg!(target_os = "windows") {
            assert_eq!(native_artifact, "notes-preview.exe");
        } else {
            assert_eq!(native_artifact, "notes-preview");
        }
        assert_eq!(
            artifact_name_for_compiler(RuntimeCompiler::GoJsWasm, "notes-preview"),
            "notes-preview.wasm"
        );
        assert_eq!(
            artifact_name_for_compiler(RuntimeCompiler::TinygoWasm, "notes-preview"),
            "notes-preview.wasm"
        );
        assert_eq!(
            artifact_name_for_compiler(RuntimeCompiler::PythonSidecar, "ignored"),
            "python-sidecar.entry"
        );
    }

    #[test]
    fn python_sidecar_skips_host_build() {
        let output = skip_host_build(
            &RuntimeManifest {
                id: "python-preview".to_string(),
                display_name: "python-preview".to_string(),
                language: "python".to_string(),
                kind: crate::runtime_pipeline::manifest::RuntimeKind::NativeSidecar,
                compiler: RuntimeCompiler::PythonSidecar,
                manifest_dir: "/tmp".to_string(),
                module_dir: "/tmp".to_string(),
                entry: None,
                watch_globs: Vec::new(),
                env: Default::default(),
                args: Vec::new(),
                working_directory: None,
                permissions: Default::default(),
                panel: None,
                command: None,
                sidecar: None,
                tui: None,
                source_signature: "unsigned".to_string(),
            },
            Path::new("/tmp/python-sidecar.entry"),
            "python-host",
            "release",
        )
        .expect("python sidecar build should no-op");
        assert!(output.stdout.is_empty());
        assert!(output.stderr.is_empty());
    }

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

        assert!(
            resolved.is_some(),
            "build script resolution must fall through to dev fallback"
        );
    }

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
