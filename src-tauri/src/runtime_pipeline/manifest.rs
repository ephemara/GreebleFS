//! `runtime.toml` schema for the universal polyglot runtime pipeline.
//!
//! A runtime package is a self-describing folder containing one `runtime.toml`
//! at its root. Plugins, actions, themes, and the host can reference it by
//! `id`. The schema deliberately stays toml-only on disk; JSON is only used at
//! the Tauri/Specta IPC boundary where Specta-derived `serde` types still
//! travel as camelCase JSON objects.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

/// All runtime kinds the v1 pipeline understands. New kinds belong here so
/// every layer (manifest, registry, command surface, frontend) keeps a single
/// canonical enum.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "kebab-case")]
pub enum RuntimeKind {
    NativeSidecar,
    NativeCommand,
    NativeTui,
    WasmPanel,
    WasmWorker,
}

impl Default for RuntimeKind {
    fn default() -> Self {
        Self::NativeSidecar
    }
}

impl RuntimeKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            RuntimeKind::NativeSidecar => "native-sidecar",
            RuntimeKind::NativeCommand => "native-command",
            RuntimeKind::NativeTui => "native-tui",
            RuntimeKind::WasmPanel => "wasm-panel",
            RuntimeKind::WasmWorker => "wasm-worker",
        }
    }

    /// True for kinds that produce a long-lived process owned by the host.
    pub fn is_long_lived(&self) -> bool {
        matches!(self, RuntimeKind::NativeSidecar)
    }

    /// True for kinds that compile to Wasm bytes consumed by the frontend.
    pub fn is_wasm(&self) -> bool {
        matches!(self, RuntimeKind::WasmPanel | RuntimeKind::WasmWorker)
    }
}

/// Compiler/toolchain selection for a runtime package. The host decides which
/// language family to invoke based on this discriminant — never on raw `kind`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "kebab-case")]
pub enum RuntimeCompiler {
    /// Standard `go build` for native binaries and `GOOS=js GOARCH=wasm` panels
    /// when paired with a wasm-* kind.
    GoNative,
    /// Native Rust/Cargo compilation for long-lived sidecars, commands, and TUIs.
    CargoNative,
    /// Planned native C toolchain lane. The manifest accepts it so authored
    /// bundles can declare the future target now, but the current host still
    /// returns an explicit unsupported-driver error when asked to build it.
    CNative,
    /// Explicit `GOOS=js GOARCH=wasm` build using the standard toolchain.
    GoJsWasm,
    /// `tinygo build -target wasm` for size-constrained workers/panels.
    TinygoWasm,
    /// `cargo build --target wasm32-unknown-unknown` followed by
    /// `wasm-bindgen --target web` for Rust-authored browser/webview runtimes.
    CargoWasmBindgen,
    /// The legacy Python sidecar lane, migrated onto this manifest.
    PythonSidecar,
    /// Kain-authored runtime scripts launched through the bundled Kain CLI.
    KainScript,
}

impl Default for RuntimeCompiler {
    fn default() -> Self {
        Self::GoNative
    }
}

impl RuntimeCompiler {
    pub fn as_str(&self) -> &'static str {
        match self {
            RuntimeCompiler::GoNative => "go-native",
            RuntimeCompiler::CargoNative => "cargo-native",
            RuntimeCompiler::CNative => "c-native",
            RuntimeCompiler::GoJsWasm => "go-js-wasm",
            RuntimeCompiler::TinygoWasm => "tinygo-wasm",
            RuntimeCompiler::CargoWasmBindgen => "cargo-wasm-bindgen",
            RuntimeCompiler::PythonSidecar => "python-sidecar",
            RuntimeCompiler::KainScript => "kain-script",
        }
    }

    pub fn is_go(&self) -> bool {
        matches!(
            self,
            RuntimeCompiler::GoNative | RuntimeCompiler::GoJsWasm | RuntimeCompiler::TinygoWasm
        )
    }

    pub fn is_native_host_compiler(&self) -> bool {
        matches!(
            self,
            RuntimeCompiler::GoNative
                | RuntimeCompiler::CargoNative
                | RuntimeCompiler::CNative
                | RuntimeCompiler::PythonSidecar
                | RuntimeCompiler::KainScript
        )
    }

    pub fn produces_wasm(&self) -> bool {
        matches!(
            self,
            RuntimeCompiler::GoJsWasm
                | RuntimeCompiler::TinygoWasm
                | RuntimeCompiler::CargoWasmBindgen
        )
    }
}

/// Permissions a runtime package declares it needs from the host. The host
/// allowlists every host-bridge call against this set; missing entries cause
/// a typed runtime error at the bridge.
#[derive(Debug, Clone, Default, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase", default)]
pub struct RuntimePackagePermissions {
    /// Allow reads from the host filesystem.
    pub fs_read: bool,
    /// Allow writes to the host filesystem.
    pub fs_write: bool,
    /// Allow watching filesystem locations for changes.
    pub fs_watch: bool,
    /// Allow outbound network calls.
    pub network: bool,
    /// Allow spawning child processes from inside the runtime.
    pub spawn_processes: bool,
    /// Allow interacting with the terminal subsystem.
    pub terminal_interaction: bool,
    /// Allow read-only repository/git operations through the host.
    pub repo_read: bool,
    /// Allow repository mutations through the host.
    pub repo_write: bool,
    /// Allow preview-lane save flows that mutate the active document.
    pub preview_save: bool,
    /// Allow preview-lane export flows that emit derived outputs.
    pub preview_export: bool,
    /// Allow host-owned task execution lanes.
    pub task_execution: bool,
    /// Allow listening to host shell events.
    pub host_events: bool,
    /// Allow reading from the host clipboard.
    pub clipboard_read: bool,
    /// Allow writing to the host clipboard.
    pub clipboard_write: bool,
    /// Free-form launch intent declarations (`open-explorer`, `open-terminal`).
    pub launch_intents: Vec<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase", default)]
pub struct RuntimeSidecarConfig {
    /// Wire transport for sidecars. v1 only validates `stdio-json-lines`.
    #[serde(default = "default_sidecar_transport")]
    pub transport: String,
    /// Optional package preset list for ad hoc ML/data presets in the UI.
    pub package_presets: Vec<RuntimePackagePreset>,
    /// Action descriptors mirrored to the frontend for discoverability.
    pub actions: Vec<RuntimeActionDescriptor>,
}

fn default_sidecar_transport() -> String {
    "stdio-json-lines".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct RuntimePackagePreset {
    pub id: String,
    pub label: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub packages: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeActionDescriptor {
    pub id: String,
    pub label: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub payload_example_json: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase", default)]
pub struct RuntimePanelConfig {
    /// Frontend panel id used for plugin/dock placement when this runtime is
    /// referenced as a `runtimePanel`.
    pub panel_id: Option<String>,
    /// Display label for the rendered panel.
    pub display_name: Option<String>,
    /// Optional preferred mount root id (defaults to a host-decided root).
    pub host_root_id: Option<String>,
    /// Suggested intrinsic width in pixels for fixed-size docks.
    pub preferred_width_px: Option<u32>,
    /// Suggested intrinsic height in pixels for fixed-size docks.
    pub preferred_height_px: Option<u32>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase", default)]
pub struct RuntimeCommandConfig {
    /// Description shown in the command palette / actions surface.
    pub label: Option<String>,
    /// Optional declared input contract (informational; not enforced).
    pub argument_doc: Option<String>,
    /// Maximum wall-clock seconds the host should allow for one invocation.
    pub timeout_secs: Option<u64>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase", default)]
pub struct RuntimeTuiConfig {
    /// Display label shown in the embedded terminal tab.
    pub label: Option<String>,
    /// If true, the host will treat exit-code 0 as success (default true).
    #[serde(default = "default_true")]
    pub treat_zero_exit_as_success: bool,
}

fn default_true() -> bool {
    true
}

/// On-disk shape of a single `runtime.toml`. Once parsed we resolve relative
/// paths against `manifest_dir` and produce [`RuntimeManifest`].
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeManifestRaw {
    pub id: String,
    #[serde(default)]
    pub display_name: Option<String>,
    #[serde(default)]
    pub language: Option<String>,
    pub kind: RuntimeKind,
    pub compiler: RuntimeCompiler,
    #[serde(default)]
    pub module_dir: Option<String>,
    #[serde(default)]
    pub entry: Option<String>,
    #[serde(default)]
    pub watch_globs: Vec<String>,
    #[serde(default)]
    pub env: BTreeMap<String, String>,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub working_directory: Option<String>,
    #[serde(default)]
    pub permissions: RuntimePackagePermissions,
    #[serde(default)]
    pub panel: Option<RuntimePanelConfig>,
    #[serde(default)]
    pub command: Option<RuntimeCommandConfig>,
    #[serde(default)]
    pub sidecar: Option<RuntimeSidecarConfig>,
    #[serde(default)]
    pub tui: Option<RuntimeTuiConfig>,
}

/// Fully resolved runtime manifest. All paths are absolute and validated for
/// `kind`/`compiler` compatibility before reaching consumers.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeManifest {
    pub id: String,
    pub display_name: String,
    pub language: String,
    pub kind: RuntimeKind,
    pub compiler: RuntimeCompiler,
    /// Folder containing the `runtime.toml`. Source roots are resolved relative
    /// to this directory.
    pub manifest_dir: String,
    /// Resolved module directory (absolute). Defaults to `manifest_dir`.
    pub module_dir: String,
    /// Resolved entry file (absolute). Optional for kinds that derive entry
    /// from convention (Python sidecar uses `entryModule`).
    pub entry: Option<String>,
    pub watch_globs: Vec<String>,
    pub env: BTreeMap<String, String>,
    pub args: Vec<String>,
    pub working_directory: Option<String>,
    pub permissions: RuntimePackagePermissions,
    pub panel: Option<RuntimePanelConfig>,
    pub command: Option<RuntimeCommandConfig>,
    pub sidecar: Option<RuntimeSidecarConfig>,
    pub tui: Option<RuntimeTuiConfig>,
    /// Source signature digest the cache uses to invalidate stale builds.
    pub source_signature: String,
}

impl RuntimeManifest {
    pub const FILE_NAME: &'static str = "runtime.toml";

    /// Parse a `runtime.toml` from a directory. The manifest's relative paths
    /// are resolved here so downstream consumers never have to redo it.
    pub fn from_dir(manifest_dir: &Path) -> Result<Self, String> {
        let manifest_path = manifest_dir.join(Self::FILE_NAME);
        let raw_text = std::fs::read_to_string(&manifest_path).map_err(|error| {
            format!(
                "Failed to read runtime manifest {}: {error}",
                manifest_path.to_string_lossy()
            )
        })?;
        Self::from_raw_text(manifest_dir, &raw_text)
    }

    /// Parse from a string. Used by tests and embedded builtin runtime metadata.
    pub fn from_raw_text(manifest_dir: &Path, raw_text: &str) -> Result<Self, String> {
        let raw: RuntimeManifestRaw = toml::from_str(raw_text).map_err(|error| {
            format!(
                "Failed to parse runtime.toml in {}: {error}",
                manifest_dir.to_string_lossy()
            )
        })?;
        Self::from_raw(manifest_dir, raw)
    }

    fn from_raw(manifest_dir: &Path, raw: RuntimeManifestRaw) -> Result<Self, String> {
        validate_kind_compiler_pairing(raw.kind, raw.compiler)?;

        let canonical_manifest_dir = manifest_dir
            .canonicalize()
            .unwrap_or_else(|_| manifest_dir.to_path_buf());

        let module_dir = raw
            .module_dir
            .as_deref()
            .map(|relative| resolve_within(&canonical_manifest_dir, relative))
            .unwrap_or_else(|| canonical_manifest_dir.clone());

        let entry = raw
            .entry
            .as_deref()
            .map(|relative| resolve_within(&canonical_manifest_dir, relative));

        let working_directory = raw
            .working_directory
            .as_deref()
            .map(|relative| resolve_within(&canonical_manifest_dir, relative));

        let display_name = raw.display_name.unwrap_or_else(|| raw.id.clone());
        let language = raw.language.unwrap_or_else(|| match raw.compiler {
            RuntimeCompiler::PythonSidecar => "python".to_string(),
            RuntimeCompiler::KainScript => "kain".to_string(),
            RuntimeCompiler::CargoNative | RuntimeCompiler::CargoWasmBindgen => "rust".to_string(),
            RuntimeCompiler::CNative => "c".to_string(),
            _ => "go".to_string(),
        });

        let source_signature =
            crate::runtime_pipeline::cache::compute_source_signature(&module_dir)
                .unwrap_or_else(|_| "unsigned".to_string());

        Ok(Self {
            id: raw.id,
            display_name,
            language,
            kind: raw.kind,
            compiler: raw.compiler,
            manifest_dir: path_to_string(&canonical_manifest_dir),
            module_dir: path_to_string(&module_dir),
            entry: entry.map(|p| path_to_string(&p)),
            watch_globs: raw.watch_globs,
            env: raw.env,
            args: raw.args,
            working_directory: working_directory.map(|p| path_to_string(&p)),
            permissions: raw.permissions,
            panel: raw.panel,
            command: raw.command,
            sidecar: raw.sidecar,
            tui: raw.tui,
            source_signature,
        })
    }
}

fn resolve_within(base: &Path, relative: &str) -> PathBuf {
    let candidate = Path::new(relative);
    if candidate.is_absolute() {
        candidate.to_path_buf()
    } else {
        base.join(candidate)
    }
}

fn path_to_string(path: &Path) -> String {
    let raw = path.to_string_lossy().to_string();
    if let Some(stripped_unc) = raw.strip_prefix(r"\\?\UNC\") {
        return format!(r"\\{}", stripped_unc);
    }
    raw.strip_prefix(r"\\?\").unwrap_or(&raw).to_string()
}

/// Reject combinations the host cannot service so runtime authors find errors
/// at parse time instead of at first-call time.
fn validate_kind_compiler_pairing(
    kind: RuntimeKind,
    compiler: RuntimeCompiler,
) -> Result<(), String> {
    let ok = match (kind, compiler) {
        (RuntimeKind::NativeSidecar, RuntimeCompiler::GoNative)
        | (RuntimeKind::NativeSidecar, RuntimeCompiler::CargoNative)
        | (RuntimeKind::NativeSidecar, RuntimeCompiler::CNative)
        | (RuntimeKind::NativeSidecar, RuntimeCompiler::PythonSidecar)
        | (RuntimeKind::NativeSidecar, RuntimeCompiler::KainScript)
        | (RuntimeKind::NativeCommand, RuntimeCompiler::GoNative)
        | (RuntimeKind::NativeCommand, RuntimeCompiler::CargoNative)
        | (RuntimeKind::NativeCommand, RuntimeCompiler::CNative)
        | (RuntimeKind::NativeTui, RuntimeCompiler::GoNative)
        | (RuntimeKind::NativeTui, RuntimeCompiler::CargoNative)
        | (RuntimeKind::NativeTui, RuntimeCompiler::CNative)
        | (RuntimeKind::WasmPanel, RuntimeCompiler::GoJsWasm)
        | (RuntimeKind::WasmPanel, RuntimeCompiler::TinygoWasm)
        | (RuntimeKind::WasmPanel, RuntimeCompiler::GoNative)
        | (RuntimeKind::WasmPanel, RuntimeCompiler::CargoWasmBindgen)
        | (RuntimeKind::WasmWorker, RuntimeCompiler::GoJsWasm)
        | (RuntimeKind::WasmWorker, RuntimeCompiler::TinygoWasm)
        | (RuntimeKind::WasmWorker, RuntimeCompiler::CargoWasmBindgen) => true,
        _ => false,
    };
    if ok {
        Ok(())
    } else {
        Err(format!(
            "runtime.toml uses unsupported kind/compiler pairing: kind={}, compiler={}",
            kind.as_str(),
            compiler.as_str()
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn write_manifest(dir: &Path, text: &str) {
        std::fs::write(dir.join(RuntimeManifest::FILE_NAME), text).expect("write runtime.toml");
    }

    #[test]
    fn parses_minimal_native_sidecar_manifest() {
        let dir = tempdir().expect("tempdir");
        write_manifest(
            dir.path(),
            r#"
id = "echo-sidecar"
displayName = "Echo Sidecar"
language = "go"
kind = "native-sidecar"
compiler = "go-native"
entry = "main.go"

[sidecar]
transport = "stdio-json-lines"
            "#,
        );

        let manifest = RuntimeManifest::from_dir(dir.path()).expect("parse");
        assert_eq!(manifest.id, "echo-sidecar");
        assert_eq!(manifest.display_name, "Echo Sidecar");
        assert_eq!(manifest.kind, RuntimeKind::NativeSidecar);
        assert_eq!(manifest.compiler, RuntimeCompiler::GoNative);
        assert!(manifest.entry.is_some(), "entry should be resolved");
        assert!(
            manifest.sidecar.is_some(),
            "sidecar block should round-trip"
        );
    }

    #[test]
    fn parses_kain_native_sidecar_manifest() {
        let dir = tempdir().expect("tempdir");
        write_manifest(
            dir.path(),
            r#"
id = "kain-smoke"
kind = "native-sidecar"
compiler = "kain-script"
entry = "src/sidecar.kn"

[sidecar]
transport = "stdio-json-lines-v2"
            "#,
        );

        let manifest = RuntimeManifest::from_dir(dir.path()).expect("parse");
        assert_eq!(manifest.language, "kain");
        assert_eq!(manifest.compiler, RuntimeCompiler::KainScript);
        assert_eq!(manifest.kind, RuntimeKind::NativeSidecar);
    }

    #[test]
    fn rejects_invalid_kind_compiler_pairing() {
        let dir = tempdir().expect("tempdir");
        write_manifest(
            dir.path(),
            r#"
id = "invalid"
kind = "wasm-panel"
compiler = "python-sidecar"
            "#,
        );

        let parsed = RuntimeManifest::from_dir(dir.path());
        assert!(parsed.is_err(), "wasm-panel + python-sidecar must fail");
    }

    #[test]
    fn defaults_module_dir_to_manifest_dir() {
        let dir = tempdir().expect("tempdir");
        write_manifest(
            dir.path(),
            r#"
id = "panel"
kind = "wasm-panel"
compiler = "go-js-wasm"
entry = "main.go"
            "#,
        );

        let manifest = RuntimeManifest::from_dir(dir.path()).expect("parse");
        assert_eq!(manifest.module_dir, manifest.manifest_dir);
    }

    #[test]
    fn strips_windows_verbatim_prefixes_from_serialized_paths() {
        assert_eq!(
            path_to_string(Path::new(r"\\?\C:\Dev\GreebleFS\src-go")),
            r"C:\Dev\GreebleFS\src-go"
        );
        assert_eq!(
            path_to_string(Path::new(r"\\?\UNC\server\share\greeblefs")),
            r"\\server\share\greeblefs"
        );
    }

    #[test]
    fn permissions_default_to_locked_down() {
        let dir = tempdir().expect("tempdir");
        write_manifest(
            dir.path(),
            r#"
id = "echo"
kind = "native-command"
compiler = "go-native"
entry = "main.go"
            "#,
        );

        let manifest = RuntimeManifest::from_dir(dir.path()).expect("parse");
        assert!(!manifest.permissions.fs_write);
        assert!(!manifest.permissions.network);
        assert!(!manifest.permissions.spawn_processes);
    }
}
