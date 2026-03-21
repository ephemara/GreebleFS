use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::{AppHandle, Manager};

const PYTHON_PROBE_SCRIPT: &str = r#"import json, sys
print(json.dumps({
    "executable": sys.executable,
    "version": ".".join(str(part) for part in sys.version_info[:3]),
    "major": sys.version_info[0],
    "minor": sys.version_info[1],
    "micro": sys.version_info[2],
}))
"#;

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PythonRuntimeConfig {
    pub preferred_interpreter_path: Option<String>,
    pub runtime_root: Option<String>,
    pub bootstrap_packages: Option<String>,
    pub auto_upgrade_pip: Option<bool>,
    pub create_boilerplate: Option<bool>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PythonPackageInstallRequest {
    pub config: Option<PythonRuntimeConfig>,
    pub package_input: String,
    pub persist_to_requirements: Option<bool>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub enum PythonExecutionMode {
    Inline,
    Script,
    Module,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PythonExecutionRequest {
    pub config: Option<PythonRuntimeConfig>,
    pub execution_mode: PythonExecutionMode,
    pub entry: String,
    pub arguments: Option<Vec<String>>,
    pub working_directory: Option<String>,
    pub environment: Option<HashMap<String, String>>,
    pub use_managed_environment: Option<bool>,
}

#[derive(Debug, Clone, serde::Deserialize)]
struct PythonProbeResult {
    executable: String,
    version: String,
    major: u8,
    minor: u8,
    micro: u8,
}

#[derive(Debug, Clone)]
struct InterpreterCandidate {
    id: String,
    label: String,
    command: String,
    args: Vec<String>,
    source: String,
    preferred: bool,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PythonInterpreterDescriptor {
    pub id: String,
    pub label: String,
    pub command: String,
    pub args: Vec<String>,
    pub source: String,
    pub preferred: bool,
    pub recommended: bool,
    pub executable: String,
    pub version: String,
    pub major: u8,
    pub minor: u8,
    pub micro: u8,
}

#[derive(Debug, Clone)]
struct DetectedInterpreter {
    descriptor: PythonInterpreterDescriptor,
}

#[derive(Debug, Clone)]
struct RuntimePaths {
    root_dir: PathBuf,
    env_dir: PathBuf,
    scripts_dir: PathBuf,
    package_dir: PathBuf,
    temp_dir: PathBuf,
    logs_dir: PathBuf,
    requirements_path: PathBuf,
    readme_path: PathBuf,
    hello_script_path: PathBuf,
    probe_script_path: PathBuf,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PythonBoilerplateFiles {
    pub readme_path: String,
    pub requirements_path: String,
    pub package_dir: String,
    pub hello_script_path: String,
    pub probe_script_path: String,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PythonRuntimeStatus {
    pub runtime_root: String,
    pub env_dir: String,
    pub scripts_dir: String,
    pub temp_dir: String,
    pub logs_dir: String,
    pub managed_python_path: String,
    pub env_exists: bool,
    pub ready: bool,
    pub managed_python_version: Option<String>,
    pub managed_pip_version: Option<String>,
    pub preferred_interpreter_path: Option<String>,
    pub bootstrap_packages: Vec<String>,
    pub interpreter_hint: String,
    pub base_interpreter: Option<PythonInterpreterDescriptor>,
    pub discovered_interpreters: Vec<PythonInterpreterDescriptor>,
    pub boilerplate: PythonBoilerplateFiles,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PythonCommandResult {
    pub command: String,
    pub working_directory: String,
    pub exit_code: i32,
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PythonActionResponse {
    pub status: PythonRuntimeStatus,
    pub result: PythonCommandResult,
}

#[derive(Debug, Clone)]
struct ResolvedRuntimeConfig {
    preferred_interpreter_path: Option<String>,
    runtime_root: PathBuf,
    bootstrap_packages: Vec<String>,
    auto_upgrade_pip: bool,
    create_boilerplate: bool,
}

fn normalize_optional_string(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().to_string()
}

fn parse_package_input(raw: &str) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut packages = Vec::new();

    for line in raw.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        for entry in trimmed.split(',') {
            let package = entry.trim();
            if package.is_empty() || package.starts_with('#') {
                continue;
            }

            let dedupe_key = package.to_ascii_lowercase();
            if seen.insert(dedupe_key) {
                packages.push(package.to_string());
            }
        }
    }

    packages
}

fn is_ml_friendly_version(major: u8, minor: u8) -> bool {
    major == 3 && matches!(minor, 10 | 11 | 12)
}

fn python_candidate_list(preferred: Option<&str>) -> Vec<InterpreterCandidate> {
    let mut candidates = Vec::new();
    let mut seen = HashSet::new();

    let mut push_candidate =
        |label: &str, command: String, args: Vec<String>, source: &str, preferred: bool| {
            let key = format!("{}|{}", command, args.join("\u{1f}"));
            if seen.insert(key) {
                candidates.push(InterpreterCandidate {
                    id: format!("python-{}", candidates.len() + 1),
                    label: label.to_string(),
                    command,
                    args,
                    source: source.to_string(),
                    preferred,
                });
            }
        };

    if let Some(preferred_path) = normalize_optional_string(preferred) {
        push_candidate(
            "Preferred Interpreter",
            preferred_path,
            Vec::new(),
            "settings",
            true,
        );
    }

    #[cfg(target_os = "windows")]
    {
        push_candidate(
            "Python Launcher 3.11",
            "py".to_string(),
            vec!["-3.11".to_string()],
            "launcher",
            false,
        );
        push_candidate(
            "Python Launcher 3.10",
            "py".to_string(),
            vec!["-3.10".to_string()],
            "launcher",
            false,
        );
        push_candidate(
            "Python Launcher",
            "py".to_string(),
            vec!["-3".to_string()],
            "launcher",
            false,
        );
        push_candidate(
            "python3.11",
            "python3.11".to_string(),
            Vec::new(),
            "path",
            false,
        );
        push_candidate(
            "python3.10",
            "python3.10".to_string(),
            Vec::new(),
            "path",
            false,
        );
        push_candidate("python3", "python3".to_string(), Vec::new(), "path", false);
        push_candidate("python", "python".to_string(), Vec::new(), "path", false);
    }

    #[cfg(not(target_os = "windows"))]
    {
        push_candidate(
            "python3.11",
            "python3.11".to_string(),
            Vec::new(),
            "path",
            false,
        );
        push_candidate(
            "python3.10",
            "python3.10".to_string(),
            Vec::new(),
            "path",
            false,
        );
        push_candidate(
            "python3.12",
            "python3.12".to_string(),
            Vec::new(),
            "path",
            false,
        );
        push_candidate("python3", "python3".to_string(), Vec::new(), "path", false);
        push_candidate("python", "python".to_string(), Vec::new(), "path", false);
    }

    candidates
}

fn detect_interpreters(preferred: Option<&str>) -> Vec<DetectedInterpreter> {
    let mut detected = Vec::new();

    for candidate in python_candidate_list(preferred) {
        let output = Command::new(&candidate.command)
            .args(&candidate.args)
            .arg("-c")
            .arg(PYTHON_PROBE_SCRIPT)
            .output();

        let Ok(output) = output else {
            continue;
        };

        if !output.status.success() {
            continue;
        }

        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let Ok(probe) = serde_json::from_str::<PythonProbeResult>(&stdout) else {
            continue;
        };

        detected.push(DetectedInterpreter {
            descriptor: PythonInterpreterDescriptor {
                id: candidate.id,
                label: candidate.label,
                command: candidate.command,
                args: candidate.args,
                source: candidate.source,
                preferred: candidate.preferred,
                recommended: is_ml_friendly_version(probe.major, probe.minor),
                executable: probe.executable,
                version: probe.version,
                major: probe.major,
                minor: probe.minor,
                micro: probe.micro,
            },
        });
    }

    detected
}

fn choose_base_interpreter(interpreters: &[DetectedInterpreter]) -> Option<DetectedInterpreter> {
    interpreters
        .iter()
        .find(|item| item.descriptor.preferred)
        .cloned()
        .or_else(|| {
            interpreters
                .iter()
                .find(|item| item.descriptor.recommended)
                .cloned()
        })
        .or_else(|| interpreters.first().cloned())
}

fn resolve_runtime_root(app: &AppHandle, config: &PythonRuntimeConfig) -> Result<PathBuf, String> {
    if let Some(path) = normalize_optional_string(config.runtime_root.as_deref()) {
        return Ok(PathBuf::from(path));
    }

    app.path()
        .app_local_data_dir()
        .map(|path| path.join("python-runtime"))
        .map_err(|error| format!("Failed to resolve app local data directory: {error}"))
}

fn resolve_runtime_config(
    app: &AppHandle,
    config: Option<PythonRuntimeConfig>,
) -> Result<ResolvedRuntimeConfig, String> {
    let config = config.unwrap_or_default();
    Ok(ResolvedRuntimeConfig {
        preferred_interpreter_path: normalize_optional_string(
            config.preferred_interpreter_path.as_deref(),
        ),
        runtime_root: resolve_runtime_root(app, &config)?,
        bootstrap_packages: parse_package_input(config.bootstrap_packages.as_deref().unwrap_or("")),
        auto_upgrade_pip: config.auto_upgrade_pip.unwrap_or(true),
        create_boilerplate: config.create_boilerplate.unwrap_or(true),
    })
}

fn build_runtime_paths(root_dir: &Path) -> RuntimePaths {
    RuntimePaths {
        root_dir: root_dir.to_path_buf(),
        env_dir: root_dir.join("env"),
        scripts_dir: root_dir.join("scripts"),
        package_dir: root_dir.join("overlayterm_runtime"),
        temp_dir: root_dir.join("temp"),
        logs_dir: root_dir.join("logs"),
        requirements_path: root_dir.join("requirements.txt"),
        readme_path: root_dir.join("README.md"),
        hello_script_path: root_dir.join("scripts").join("hello_runtime.py"),
        probe_script_path: root_dir.join("scripts").join("onnx_probe.py"),
    }
}

fn managed_python_path(paths: &RuntimePaths) -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        paths.env_dir.join("Scripts").join("python.exe")
    }

    #[cfg(not(target_os = "windows"))]
    {
        paths.env_dir.join("bin").join("python")
    }
}

fn ensure_runtime_directories(paths: &RuntimePaths) -> Result<(), String> {
    for dir in [
        &paths.root_dir,
        &paths.scripts_dir,
        &paths.package_dir,
        &paths.temp_dir,
        &paths.logs_dir,
    ] {
        fs::create_dir_all(dir).map_err(|error| {
            format!(
                "Failed to create runtime directory {}: {error}",
                path_to_string(dir)
            )
        })?;
    }

    Ok(())
}

fn requirements_file_contents(packages: &[String]) -> String {
    let mut lines = vec![
        "# OverlayTerm managed Python environment".to_string(),
        "# Add packages here or install them from the Python panel.".to_string(),
        String::new(),
    ];
    lines.extend(packages.iter().cloned());
    format!("{}\n", lines.join("\n"))
}

fn readme_file_contents(paths: &RuntimePaths) -> String {
    let runtime_root = path_to_string(&paths.root_dir);
    let requirements = path_to_string(&paths.requirements_path);
    let hello_script = path_to_string(&paths.hello_script_path);
    let probe_script = path_to_string(&paths.probe_script_path);

    format!(
        "# OverlayTerm Python Runtime\n\n\
This folder is a managed Python workspace for OverlayTerm.\n\n\
Paths:\n\
- Runtime root: {runtime_root}\n\
- Requirements: {requirements}\n\
- Hello script: {hello_script}\n\
- ONNX probe: {probe_script}\n\n\
Workflow:\n\
1. Bootstrap the runtime from the Python panel.\n\
2. Install libraries into the managed virtual environment.\n\
3. Run scripts, modules, or inline Python from the app.\n"
    )
}

fn bridge_init_contents() -> String {
    [
        "\"\"\"OverlayTerm Python helpers.\"\"\"",
        "",
        "from .bridge import emit_json, runtime_summary",
        "",
        "__all__ = [\"emit_json\", \"runtime_summary\"]",
        "",
    ]
    .join("\n")
}

fn bridge_module_contents() -> String {
    [
        "import json",
        "import os",
        "import platform",
        "import sys",
        "from pathlib import Path",
        "",
        "",
        "def runtime_root() -> Path:",
        "    return Path(__file__).resolve().parent.parent",
        "",
        "",
        "def runtime_summary() -> dict:",
        "    return {",
        "        \"python\": sys.version.split()[0],",
        "        \"executable\": sys.executable,",
        "        \"platform\": platform.platform(),",
        "        \"cwd\": os.getcwd(),",
        "        \"runtimeRoot\": str(runtime_root()),",
        "    }",
        "",
        "",
        "def emit_json(payload: dict) -> None:",
        "    print(json.dumps(payload, ensure_ascii=False))",
        "",
    ]
    .join("\n")
}

fn hello_script_contents() -> String {
    [
        "from overlayterm_runtime import emit_json, runtime_summary",
        "",
        "emit_json({",
        "    \"status\": \"ready\",",
        "    \"message\": \"OverlayTerm managed Python runtime is online.\",",
        "    \"summary\": runtime_summary(),",
        "})",
        "",
    ]
    .join("\n")
}

fn probe_script_contents() -> String {
    [
        "import importlib.util",
        "",
        "from overlayterm_runtime import emit_json, runtime_summary",
        "",
        "",
        "def has_module(name: str) -> bool:",
        "    return importlib.util.find_spec(name) is not None",
        "",
        "",
        "emit_json({",
        "    \"summary\": runtime_summary(),",
        "    \"onnx\": has_module(\"onnx\"),",
        "    \"onnxruntime\": has_module(\"onnxruntime\"),",
        "    \"numpy\": has_module(\"numpy\"),",
        "})",
        "",
    ]
    .join("\n")
}

fn seed_boilerplate_files(paths: &RuntimePaths, packages: &[String]) -> Result<(), String> {
    ensure_runtime_directories(paths)?;

    if !paths.requirements_path.exists() {
        fs::write(
            &paths.requirements_path,
            requirements_file_contents(packages),
        )
        .map_err(|error| {
            format!(
                "Failed to write requirements file {}: {error}",
                path_to_string(&paths.requirements_path)
            )
        })?;
    }

    if !paths.readme_path.exists() {
        fs::write(&paths.readme_path, readme_file_contents(paths)).map_err(|error| {
            format!(
                "Failed to write runtime README {}: {error}",
                path_to_string(&paths.readme_path)
            )
        })?;
    }

    let init_path = paths.package_dir.join("__init__.py");
    if !init_path.exists() {
        fs::write(&init_path, bridge_init_contents()).map_err(|error| {
            format!(
                "Failed to write runtime package init {}: {error}",
                path_to_string(&init_path)
            )
        })?;
    }

    let bridge_path = paths.package_dir.join("bridge.py");
    if !bridge_path.exists() {
        fs::write(&bridge_path, bridge_module_contents()).map_err(|error| {
            format!(
                "Failed to write runtime bridge module {}: {error}",
                path_to_string(&bridge_path)
            )
        })?;
    }

    if !paths.hello_script_path.exists() {
        fs::write(&paths.hello_script_path, hello_script_contents()).map_err(|error| {
            format!(
                "Failed to write hello script {}: {error}",
                path_to_string(&paths.hello_script_path)
            )
        })?;
    }

    if !paths.probe_script_path.exists() {
        fs::write(&paths.probe_script_path, probe_script_contents()).map_err(|error| {
            format!(
                "Failed to write probe script {}: {error}",
                path_to_string(&paths.probe_script_path)
            )
        })?;
    }

    Ok(())
}

fn append_requirements(path: &Path, packages: &[String]) -> Result<(), String> {
    if packages.is_empty() {
        return Ok(());
    }

    let existing = if path.exists() {
        fs::read_to_string(path).map_err(|error| {
            format!(
                "Failed to read requirements file {}: {error}",
                path_to_string(path)
            )
        })?
    } else {
        String::new()
    };

    let mut seen = HashSet::new();
    for package in parse_package_input(&existing) {
        seen.insert(package.to_ascii_lowercase());
    }

    let mut additions = Vec::new();
    for package in packages {
        let key = package.to_ascii_lowercase();
        if seen.insert(key) {
            additions.push(package.clone());
        }
    }

    if additions.is_empty() {
        if !path.exists() {
            fs::write(path, requirements_file_contents(packages)).map_err(|error| {
                format!(
                    "Failed to create requirements file {}: {error}",
                    path_to_string(path)
                )
            })?;
        }
        return Ok(());
    }

    let mut next = existing;
    if !next.ends_with('\n') && !next.is_empty() {
        next.push('\n');
    }
    if next.is_empty() {
        next = requirements_file_contents(&[]);
    }
    next.push_str(&format!("{}\n", additions.join("\n")));

    fs::write(path, next).map_err(|error| {
        format!(
            "Failed to update requirements file {}: {error}",
            path_to_string(path)
        )
    })
}

fn command_to_string(program: &str, args: &[String]) -> String {
    if args.is_empty() {
        program.to_string()
    } else {
        format!("{} {}", program, args.join(" "))
    }
}

fn run_command(
    program: &str,
    args: &[String],
    working_directory: &Path,
    environment: &HashMap<String, String>,
) -> Result<PythonCommandResult, String> {
    let mut command = Command::new(program);
    command.args(args);
    command.current_dir(working_directory);
    for (key, value) in environment {
        command.env(key, value);
    }

    let output = command.output().map_err(|error| {
        format!(
            "Failed to run command '{}' in {}: {error}",
            command_to_string(program, args),
            path_to_string(working_directory)
        )
    })?;

    Ok(PythonCommandResult {
        command: command_to_string(program, args),
        working_directory: path_to_string(working_directory),
        exit_code: output.status.code().unwrap_or(-1),
        success: output.status.success(),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
    })
}

fn pythonpath_environment(
    paths: &RuntimePaths,
    overrides: Option<HashMap<String, String>>,
) -> HashMap<String, String> {
    let mut environment = overrides.unwrap_or_default();
    let runtime_root = path_to_string(&paths.root_dir);
    let separator = if cfg!(target_os = "windows") {
        ";"
    } else {
        ":"
    };

    let next_pythonpath = match environment.get("PYTHONPATH").cloned() {
        Some(existing) if !existing.trim().is_empty() => {
            format!("{runtime_root}{separator}{existing}")
        }
        _ => runtime_root,
    };
    environment.insert("PYTHONPATH".to_string(), next_pythonpath);
    environment
}

fn build_status(
    config: &ResolvedRuntimeConfig,
    paths: &RuntimePaths,
    discovered_interpreters: Vec<DetectedInterpreter>,
    base_interpreter: Option<DetectedInterpreter>,
) -> PythonRuntimeStatus {
    let managed_python = managed_python_path(paths);
    let env_exists = managed_python.exists();
    let managed_python_version = if env_exists {
        run_command(
            &path_to_string(&managed_python),
            &["--version".to_string()],
            &paths.root_dir,
            &HashMap::new(),
        )
        .ok()
        .and_then(|result| {
            if result.stdout.trim().is_empty() {
                Some(result.stderr.trim().to_string()).filter(|value| !value.is_empty())
            } else {
                Some(result.stdout.trim().to_string())
            }
        })
    } else {
        None
    };

    let managed_pip_version = if env_exists {
        run_command(
            &path_to_string(&managed_python),
            &["-m".to_string(), "pip".to_string(), "--version".to_string()],
            &paths.root_dir,
            &HashMap::new(),
        )
        .ok()
        .map(|result| result.stdout.trim().to_string())
        .filter(|value| !value.is_empty())
    } else {
        None
    };

    PythonRuntimeStatus {
        runtime_root: path_to_string(&paths.root_dir),
        env_dir: path_to_string(&paths.env_dir),
        scripts_dir: path_to_string(&paths.scripts_dir),
        temp_dir: path_to_string(&paths.temp_dir),
        logs_dir: path_to_string(&paths.logs_dir),
        managed_python_path: path_to_string(&managed_python),
        env_exists,
        ready: env_exists,
        managed_python_version,
        managed_pip_version,
        preferred_interpreter_path: config.preferred_interpreter_path.clone(),
        bootstrap_packages: config.bootstrap_packages.clone(),
        interpreter_hint:
            "Python 3.11 is preferred because ML wheels like ONNX are typically easiest to install there."
                .to_string(),
        base_interpreter: base_interpreter.map(|item| item.descriptor),
        discovered_interpreters: discovered_interpreters.into_iter().map(|item| item.descriptor).collect(),
        boilerplate: PythonBoilerplateFiles {
            readme_path: path_to_string(&paths.readme_path),
            requirements_path: path_to_string(&paths.requirements_path),
            package_dir: path_to_string(&paths.package_dir),
            hello_script_path: path_to_string(&paths.hello_script_path),
            probe_script_path: path_to_string(&paths.probe_script_path),
        },
    }
}

fn bootstrap_runtime(
    config: &ResolvedRuntimeConfig,
) -> Result<
    (
        RuntimePaths,
        Vec<DetectedInterpreter>,
        DetectedInterpreter,
        PythonCommandResult,
    ),
    String,
> {
    let paths = build_runtime_paths(&config.runtime_root);
    ensure_runtime_directories(&paths)?;
    if config.create_boilerplate {
        seed_boilerplate_files(&paths, &config.bootstrap_packages)?;
    }

    let interpreters = detect_interpreters(config.preferred_interpreter_path.as_deref());
    let base_interpreter = choose_base_interpreter(&interpreters).ok_or_else(|| {
        "No usable Python interpreter was found. Install Python 3.11+ or set a preferred interpreter path in the Python panel.".to_string()
    })?;

    let managed_python = managed_python_path(&paths);
    let mut log_sections = Vec::new();
    let mut final_exit_code = 0;
    let mut final_success = true;

    if !managed_python.exists() {
        let create_result = run_command(
            &base_interpreter.descriptor.command,
            &{
                let mut args = base_interpreter.descriptor.args.clone();
                args.push("-m".to_string());
                args.push("venv".to_string());
                args.push(path_to_string(&paths.env_dir));
                args
            },
            &paths.root_dir,
            &HashMap::new(),
        )?;
        final_exit_code = create_result.exit_code;
        final_success &= create_result.success;
        log_sections.push(format!(
            "$ {}\n{}\n{}",
            create_result.command, create_result.stdout, create_result.stderr
        ));
        if !create_result.success {
            return Err(format!(
                "Failed to create managed virtual environment.\n{}",
                log_sections.join("\n\n")
            ));
        }
    }

    if config.auto_upgrade_pip {
        let upgrade_result = run_command(
            &path_to_string(&managed_python),
            &[
                "-m".to_string(),
                "pip".to_string(),
                "install".to_string(),
                "--upgrade".to_string(),
                "pip".to_string(),
                "setuptools".to_string(),
                "wheel".to_string(),
            ],
            &paths.root_dir,
            &HashMap::new(),
        )?;
        final_exit_code = upgrade_result.exit_code;
        final_success &= upgrade_result.success;
        log_sections.push(format!(
            "$ {}\n{}\n{}",
            upgrade_result.command, upgrade_result.stdout, upgrade_result.stderr
        ));
        if !upgrade_result.success {
            return Err(format!(
                "Failed to upgrade pip in the managed environment.\n{}",
                log_sections.join("\n\n")
            ));
        }
    }

    if !config.bootstrap_packages.is_empty() {
        let install_result = run_command(
            &path_to_string(&managed_python),
            &{
                let mut args = vec!["-m".to_string(), "pip".to_string(), "install".to_string()];
                args.extend(config.bootstrap_packages.iter().cloned());
                args
            },
            &paths.root_dir,
            &HashMap::new(),
        )?;
        final_exit_code = install_result.exit_code;
        final_success &= install_result.success;
        log_sections.push(format!(
            "$ {}\n{}\n{}",
            install_result.command, install_result.stdout, install_result.stderr
        ));
        if !install_result.success {
            return Err(format!(
                "Failed to install bootstrap packages.\n{}",
                log_sections.join("\n\n")
            ));
        }
        append_requirements(&paths.requirements_path, &config.bootstrap_packages)?;
    }

    Ok((
        paths.clone(),
        interpreters,
        base_interpreter,
        PythonCommandResult {
            command: "bootstrap".to_string(),
            working_directory: path_to_string(&paths.root_dir),
            exit_code: final_exit_code,
            success: final_success,
            stdout: log_sections.join("\n\n"),
            stderr: String::new(),
        },
    ))
}

fn ensure_managed_environment(
    config: &ResolvedRuntimeConfig,
) -> Result<(RuntimePaths, Vec<DetectedInterpreter>, DetectedInterpreter), String> {
    let paths = build_runtime_paths(&config.runtime_root);
    if config.create_boilerplate {
        seed_boilerplate_files(&paths, &config.bootstrap_packages)?;
    } else {
        ensure_runtime_directories(&paths)?;
    }

    let interpreters = detect_interpreters(config.preferred_interpreter_path.as_deref());
    let base_interpreter = choose_base_interpreter(&interpreters).ok_or_else(|| {
        "No usable Python interpreter was found. Install Python 3.11+ or set a preferred interpreter path in the Python panel.".to_string()
    })?;

    if !managed_python_path(&paths).exists() {
        let _ = bootstrap_runtime(config)?;
        let refreshed = detect_interpreters(config.preferred_interpreter_path.as_deref());
        let base = choose_base_interpreter(&refreshed).ok_or_else(|| {
            "Managed Python environment was created, but the base interpreter could not be resolved afterward.".to_string()
        })?;
        return Ok((paths, refreshed, base));
    }

    Ok((paths, interpreters, base_interpreter))
}

fn write_inline_script(paths: &RuntimePaths, contents: &str) -> Result<PathBuf, String> {
    ensure_runtime_directories(paths)?;
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let script_path = paths.temp_dir.join(format!("inline-run-{timestamp}.py"));
    fs::write(&script_path, contents).map_err(|error| {
        format!(
            "Failed to write inline Python script {}: {error}",
            path_to_string(&script_path)
        )
    })?;
    Ok(script_path)
}

fn resolve_execution_path(
    paths: &RuntimePaths,
    entry: &str,
    working_directory: Option<&str>,
) -> PathBuf {
    let trimmed = entry.trim();
    let direct = PathBuf::from(trimmed);
    if direct.is_absolute() {
        return direct;
    }

    if let Some(working_directory) = normalize_optional_string(working_directory) {
        let candidate = PathBuf::from(&working_directory).join(trimmed);
        if candidate.exists() {
            return candidate;
        }
    }

    let script_candidate = paths.scripts_dir.join(trimmed);
    if script_candidate.exists() {
        return script_candidate;
    }

    direct
}

#[tauri::command]
pub async fn python_get_runtime_status(
    app: AppHandle,
    config: Option<PythonRuntimeConfig>,
) -> Result<PythonRuntimeStatus, String> {
    let resolved = resolve_runtime_config(&app, config)?;
    let paths = build_runtime_paths(&resolved.runtime_root);
    if resolved.create_boilerplate {
        seed_boilerplate_files(&paths, &resolved.bootstrap_packages)?;
    } else {
        ensure_runtime_directories(&paths)?;
    }
    let interpreters = detect_interpreters(resolved.preferred_interpreter_path.as_deref());
    let base_interpreter = choose_base_interpreter(&interpreters);
    Ok(build_status(
        &resolved,
        &paths,
        interpreters,
        base_interpreter,
    ))
}

#[tauri::command]
pub async fn python_bootstrap_runtime(
    app: AppHandle,
    config: Option<PythonRuntimeConfig>,
) -> Result<PythonActionResponse, String> {
    let resolved = resolve_runtime_config(&app, config)?;
    let (paths, interpreters, base_interpreter, result) = bootstrap_runtime(&resolved)?;
    let status = build_status(&resolved, &paths, interpreters, Some(base_interpreter));
    Ok(PythonActionResponse { status, result })
}

#[tauri::command]
pub async fn python_install_packages(
    app: AppHandle,
    request: PythonPackageInstallRequest,
) -> Result<PythonActionResponse, String> {
    let resolved = resolve_runtime_config(&app, request.config)?;
    let packages = parse_package_input(&request.package_input);
    if packages.is_empty() {
        return Err("No packages were provided.".to_string());
    }

    let (paths, interpreters, base_interpreter) = ensure_managed_environment(&resolved)?;
    let environment = pythonpath_environment(&paths, None);
    let managed_python = managed_python_path(&paths);

    let result = run_command(
        &path_to_string(&managed_python),
        &{
            let mut args = vec!["-m".to_string(), "pip".to_string(), "install".to_string()];
            args.extend(packages.iter().cloned());
            args
        },
        &paths.root_dir,
        &environment,
    )?;

    if !result.success {
        return Err(format!(
            "Package installation failed.\n{}\n{}",
            result.stdout, result.stderr
        ));
    }

    if request.persist_to_requirements.unwrap_or(true) {
        append_requirements(&paths.requirements_path, &packages)?;
    }

    let status = build_status(&resolved, &paths, interpreters, Some(base_interpreter));
    Ok(PythonActionResponse { status, result })
}

#[tauri::command]
pub async fn python_execute(
    app: AppHandle,
    request: PythonExecutionRequest,
) -> Result<PythonActionResponse, String> {
    let resolved = resolve_runtime_config(&app, request.config)?;
    let use_managed_environment = request.use_managed_environment.unwrap_or(true);
    let (paths, interpreters, base_interpreter) = if use_managed_environment {
        ensure_managed_environment(&resolved)?
    } else {
        let paths = build_runtime_paths(&resolved.runtime_root);
        ensure_runtime_directories(&paths)?;
        let interpreters = detect_interpreters(resolved.preferred_interpreter_path.as_deref());
        let base_interpreter = choose_base_interpreter(&interpreters).ok_or_else(|| {
            "No usable Python interpreter was found. Install Python or set a preferred interpreter path.".to_string()
        })?;
        (paths, interpreters, base_interpreter)
    };

    if resolved.create_boilerplate {
        seed_boilerplate_files(&paths, &resolved.bootstrap_packages)?;
    }

    let working_directory = normalize_optional_string(request.working_directory.as_deref())
        .map(PathBuf::from)
        .unwrap_or_else(|| paths.root_dir.clone());
    fs::create_dir_all(&working_directory).map_err(|error| {
        format!(
            "Failed to prepare Python working directory {}: {error}",
            path_to_string(&working_directory)
        )
    })?;

    let python_program = if use_managed_environment {
        path_to_string(&managed_python_path(&paths))
    } else {
        base_interpreter.descriptor.command.clone()
    };

    let mut args = if use_managed_environment {
        Vec::new()
    } else {
        base_interpreter.descriptor.args.clone()
    };

    match request.execution_mode {
        PythonExecutionMode::Inline => {
            let script_path = write_inline_script(&paths, &request.entry)?;
            args.push(path_to_string(&script_path));
        }
        PythonExecutionMode::Script => {
            let script_path = resolve_execution_path(
                &paths,
                &request.entry,
                request.working_directory.as_deref(),
            );
            args.push(path_to_string(&script_path));
        }
        PythonExecutionMode::Module => {
            let entry = request.entry.trim();
            if entry.is_empty() {
                return Err("Module execution requires a module name.".to_string());
            }
            args.push("-m".to_string());
            args.push(entry.to_string());
        }
    }

    if let Some(extra_args) = request.arguments {
        args.extend(extra_args);
    }

    let environment = pythonpath_environment(&paths, request.environment);
    let result = run_command(&python_program, &args, &working_directory, &environment)?;
    if !result.success {
        return Err(format!(
            "Python execution failed.\n{}\n{}",
            result.stdout, result.stderr
        ));
    }

    let status = build_status(&resolved, &paths, interpreters, Some(base_interpreter));
    Ok(PythonActionResponse { status, result })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_package_input_skips_comments_and_dedupes() {
        let packages = parse_package_input(
            "\n# core\nnumpy\nonnxruntime, numpy\npillow\n# skip\nonnxruntime\n",
        );
        assert_eq!(
            packages,
            vec![
                "numpy".to_string(),
                "onnxruntime".to_string(),
                "pillow".to_string()
            ]
        );
    }

    #[test]
    fn build_runtime_paths_uses_expected_layout() {
        let root = PathBuf::from("M:/OverlayTerm/runtime");
        let paths = build_runtime_paths(&root);
        assert_eq!(paths.env_dir, root.join("env"));
        assert_eq!(paths.scripts_dir, root.join("scripts"));
        assert_eq!(paths.package_dir, root.join("overlayterm_runtime"));
        assert_eq!(paths.requirements_path, root.join("requirements.txt"));
    }

    #[test]
    fn resolve_execution_path_prefers_working_directory_when_file_exists() {
        let temp = tempfile::tempdir().expect("tempdir should be created");
        let working_dir = temp.path().join("job");
        fs::create_dir_all(&working_dir).expect("create working dir");
        let script_path = working_dir.join("task.py");
        fs::write(&script_path, "print('ok')").expect("write script");

        let runtime = build_runtime_paths(temp.path());
        let resolved =
            resolve_execution_path(&runtime, "task.py", Some(&working_dir.to_string_lossy()));
        assert_eq!(resolved, script_path);
    }
}
