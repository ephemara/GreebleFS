//! Canonical extension-host contract and `.gfsx` bundle helpers.
//!
//! The extension platform is intentionally explorer-first rather than
//! workspace-first. Frontend preview lanes and future workbenches consume an
//! ambient execution-context snapshot, while Rust stays the owner of the
//! versioned host API schema, permission semantics, and install/packaging
//! rules.

use std::collections::BTreeMap;
use std::ffi::OsStr;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Component, Path, PathBuf};

use serde::{Deserialize, Serialize};
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

use crate::runtime_pipeline::manifest::{RuntimeCompiler, RuntimeKind, RuntimePackagePermissions};

pub const EXTENSION_HOST_API_VERSION: &str = "1.0.0";
pub const EXTENSION_BUNDLE_EXTENSION: &str = "gfsx";
pub const EXTENSION_MANIFEST_FILE_NAME: &str = "extension.toml";
pub const EXTENSION_COMPAT_MANIFEST_FILE_NAMES: &[&str] = &[
    EXTENSION_MANIFEST_FILE_NAME,
    "plugin.toml",
    "plugin.json",
    "manifest.toml",
    "manifest.json",
];

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionHostApiSchema {
    pub api_version: String,
    pub transport: String,
    pub methods: Vec<ExtensionHostMethodDescriptor>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionHostMethodDescriptor {
    pub method_id: String,
    pub namespace: String,
    pub summary: String,
    pub required_permissions: Vec<String>,
}

pub fn build_extension_host_api_schema() -> ExtensionHostApiSchema {
    ExtensionHostApiSchema {
        api_version: EXTENSION_HOST_API_VERSION.to_string(),
        transport: "runtime-host-v2".to_string(),
        methods: vec![
            build_method_descriptor(
                "host.get_api_schema",
                "host",
                "Return the canonical extension-host API schema.",
                &[],
            ),
            build_method_descriptor(
                "selection.get_snapshot",
                "selection",
                "Return the ambient explorer execution-context snapshot for the active call.",
                &[],
            ),
            build_method_descriptor(
                "preview.get_session",
                "preview",
                "Return the active preview-session slice from the ambient execution context.",
                &[],
            ),
            build_method_descriptor(
                "files.read_text",
                "files",
                "Read one text file from the host filesystem.",
                &["fsRead"],
            ),
            build_method_descriptor(
                "files.write_text",
                "files",
                "Write one UTF-8 text file through the host filesystem lane.",
                &["fsWrite"],
            ),
            build_method_descriptor(
                "files.list_directory",
                "files",
                "List one explorer-aware directory or virtual location.",
                &["fsRead"],
            ),
            build_method_descriptor(
                "files.stat",
                "files",
                "Inspect one filesystem entry without opening it.",
                &["fsRead"],
            ),
            build_method_descriptor(
                "explorer.list_location",
                "explorer",
                "List one explorer location including breadcrumbs and parent path.",
                &["fsRead"],
            ),
            build_method_descriptor(
                "explorer.open_path",
                "explorer",
                "Open one host path or virtual location using the explorer/open-with lane.",
                &["launchIntents:open-explorer"],
            ),
            build_method_descriptor(
                "repo.exec",
                "repo",
                "Execute one git command against a repository root through the host.",
                &["repoRead|repoWrite"],
            ),
            build_method_descriptor(
                "tasks.run_command",
                "tasks",
                "Run one short-lived external command with captured stdout/stderr.",
                &["taskExecution|spawnProcesses"],
            ),
            build_method_descriptor(
                "terminal.open_external",
                "terminal",
                "Open an external terminal profile at a resolved working directory.",
                &["terminalInteraction", "launchIntents:open-terminal"],
            ),
        ],
    }
}

fn build_method_descriptor(
    method_id: &str,
    namespace: &str,
    summary: &str,
    required_permissions: &[&str],
) -> ExtensionHostMethodDescriptor {
    ExtensionHostMethodDescriptor {
        method_id: method_id.to_string(),
        namespace: namespace.to_string(),
        summary: summary.to_string(),
        required_permissions: required_permissions
            .iter()
            .map(|entry| (*entry).to_string())
            .collect(),
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase", default)]
pub struct ExecutionContextSnapshot {
    pub roots: Vec<ExecutionContextRoot>,
    pub active_directory: Option<String>,
    pub cwd: Option<String>,
    pub focused_entry: Option<ExecutionContextEntry>,
    pub selected_entries: Vec<ExecutionContextEntry>,
    pub preview_session: Option<ExecutionContextPreviewSession>,
    pub pane_id: Option<String>,
    pub repo_context: Option<ExecutionContextRepoContext>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase", default)]
pub struct ExecutionContextRoot {
    pub id: String,
    pub label: String,
    pub path: String,
    pub kind: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase", default)]
pub struct ExecutionContextEntry {
    pub path: String,
    pub name: String,
    pub kind: String,
    pub extension: Option<String>,
    pub is_directory: bool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase", default)]
pub struct ExecutionContextPreviewSession {
    pub lane_id: Option<String>,
    pub lane_type: String,
    pub view_mode: Option<String>,
    pub workflow_tab_id: Option<String>,
    pub file_path: Option<String>,
    pub resolved_path: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase", default)]
pub struct ExecutionContextRepoContext {
    pub root_path: String,
    pub head_ref: Option<String>,
    pub is_dirty: Option<bool>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase", default)]
pub struct FileTypeDescriptor {
    pub id: String,
    pub extensions: Vec<String>,
    pub file_names: Vec<String>,
    pub language_id: Option<String>,
    pub icon_key: Option<String>,
    pub open_behavior: String,
    pub preview_owner: Option<String>,
    pub runtime_affinity: Option<String>,
    pub editable: bool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase", default)]
pub struct HostSubscription {
    pub subscription_id: String,
    pub event_name: String,
    pub supported: bool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase", default)]
pub struct HostEvent {
    pub event_name: String,
    pub payload_json: Option<String>,
    pub execution_context: Option<ExecutionContextSnapshot>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase", default)]
pub struct ExtensionArtifactSpec {
    pub id: String,
    pub kind: String,
    pub path: String,
    pub runtime_id: Option<String>,
    pub target: Option<String>,
    pub integrity: Option<String>,
    pub optional: bool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase", default)]
pub struct ExtensionRuntimeSpec {
    pub id: String,
    pub kind: RuntimeKind,
    pub compiler: RuntimeCompiler,
    pub entry: Option<String>,
    pub module_dir: Option<String>,
    pub permissions: RuntimePackagePermissions,
    pub targets: Vec<String>,
    pub artifact_refs: Vec<String>,
    pub source_fallback: Vec<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase", default)]
pub struct ExtensionPreviewLaneMatchRule {
    pub applies_to: String,
    pub extensions: Vec<String>,
    pub file_names: Vec<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase", default)]
pub struct ExtensionPreviewLaneCapabilities {
    pub editable: bool,
    pub save: bool,
    pub export: bool,
    pub workflow_tabs: bool,
    pub context_menu: bool,
    pub prefetch: bool,
    pub close_guard: bool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase", default)]
pub struct ExtensionPreviewLaneContribution {
    pub id: String,
    pub title: Option<String>,
    pub renderer: Option<String>,
    pub renderer_entry: Option<String>,
    pub runtime_id: Option<String>,
    pub runtime_ref: Option<String>,
    pub priority: Option<i32>,
    #[serde(rename = "match", alias = "match")]
    pub match_rule: Option<ExtensionPreviewLaneMatchRule>,
    pub capabilities: ExtensionPreviewLaneCapabilities,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase", default)]
pub struct ExtensionFontContribution {
    pub id: Option<String>,
    pub name: Option<String>,
    pub family: Option<String>,
    pub face_name: Option<String>,
    pub src: String,
    pub format: Option<String>,
    pub style: Option<String>,
    pub weight: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase", default)]
pub struct ExtensionCommandContribution {
    pub id: Option<String>,
    pub name: Option<String>,
    pub command: String,
    pub description: Option<String>,
    pub run_on_select: Option<bool>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase", default)]
pub struct ExtensionExplorerActionContribution {
    pub id: Option<String>,
    pub label: Option<String>,
    pub command: String,
    pub description: Option<String>,
    pub applies_to: Option<String>,
    pub run_on_select: Option<bool>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase", default)]
pub struct ExtensionContextMenuBackendContribution {
    pub entry: Option<String>,
    pub args: Vec<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase", default)]
pub struct ExtensionContextMenuPanelRequestContribution {
    pub panel_id: Option<String>,
    pub payload: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase", default)]
pub struct ExtensionContextMenuContribution {
    pub id: Option<String>,
    pub title: Option<String>,
    pub label: Option<String>,
    pub description: Option<String>,
    pub contexts: Vec<String>,
    pub applies_to: Option<String>,
    pub group: Option<String>,
    pub order: Option<f64>,
    pub icon_name: Option<String>,
    pub command: Option<String>,
    pub run_on_select: Option<bool>,
    pub backend: Option<ExtensionContextMenuBackendContribution>,
    pub panel_request: Option<ExtensionContextMenuPanelRequestContribution>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase", default)]
pub struct ExtensionContributions {
    pub themes: Vec<String>,
    pub shaders: Vec<String>,
    pub fonts: Vec<ExtensionFontContribution>,
    pub commands: Vec<ExtensionCommandContribution>,
    pub explorer_actions: Vec<ExtensionExplorerActionContribution>,
    pub context_menu_items: Vec<ExtensionContextMenuContribution>,
    pub preview_lanes: Vec<ExtensionPreviewLaneContribution>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase", default)]
pub struct ExtensionManifest {
    pub id: String,
    pub version: Option<String>,
    pub name: Option<String>,
    pub display_name: Option<String>,
    pub description: Option<String>,
    pub api_version: Option<String>,
    pub entry: Option<String>,
    pub default_open: Option<bool>,
    pub keep_mounted: Option<bool>,
    pub permissions: RuntimePackagePermissions,
    pub contributions: ExtensionContributions,
    pub runtimes: Vec<ExtensionRuntimeSpec>,
    pub artifacts: Vec<ExtensionArtifactSpec>,
    pub debug_sources: Vec<String>,
}

impl ExtensionManifest {
    pub fn effective_display_name(&self) -> String {
        self.display_name
            .clone()
            .or_else(|| self.name.clone())
            .unwrap_or_else(|| self.id.clone())
    }

    pub fn effective_api_version(&self) -> String {
        self.api_version
            .clone()
            .unwrap_or_else(|| EXTENSION_HOST_API_VERSION.to_string())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionInspection {
    pub source_kind: String,
    pub root_path: String,
    pub manifest_path: String,
    pub manifest: ExtensionManifest,
    pub entry_count: usize,
    pub archive_entries: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionBuildResult {
    pub source_directory: String,
    pub staging_directory: String,
    pub manifest_path: String,
    pub manifest: ExtensionManifest,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionPackResult {
    pub source_directory: String,
    pub bundle_path: String,
    pub manifest: ExtensionManifest,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionInstallResult {
    pub bundle_path: String,
    pub install_directory: String,
    pub manifest: ExtensionManifest,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct LegacyPluginManifest {
    pub id: Option<String>,
    pub version: Option<serde_json::Value>,
    pub name: Option<String>,
    pub display_name: Option<String>,
    pub description: Option<String>,
    pub api_version: Option<String>,
    pub entry: Option<String>,
    pub default_open: Option<bool>,
    pub keep_mounted: Option<bool>,
    pub permissions: RuntimePackagePermissions,
    pub contributions: ExtensionContributions,
    pub runtimes: Vec<ExtensionRuntimeSpec>,
    pub artifacts: Vec<ExtensionArtifactSpec>,
    pub debug_sources: Vec<String>,
}

impl Default for LegacyPluginManifest {
    fn default() -> Self {
        Self {
            id: None,
            version: None,
            name: None,
            display_name: None,
            description: None,
            api_version: None,
            entry: None,
            default_open: None,
            keep_mounted: None,
            permissions: RuntimePackagePermissions::default(),
            contributions: ExtensionContributions::default(),
            runtimes: Vec::new(),
            artifacts: Vec::new(),
            debug_sources: Vec::new(),
        }
    }
}

pub fn inspect_extension_source(path: &Path) -> Result<ExtensionInspection, String> {
    if path.is_dir() {
        let (manifest_path, manifest) = read_extension_manifest_from_directory(path)?;
        let archive_entries = list_directory_entries_relative(path)?;
        return Ok(ExtensionInspection {
            source_kind: "directory".to_string(),
            root_path: path.to_string_lossy().to_string(),
            manifest_path: manifest_path.to_string_lossy().to_string(),
            entry_count: archive_entries.len(),
            archive_entries,
            manifest,
        });
    }

    if is_extension_bundle_path(path) {
        let file = File::open(path)
            .map_err(|error| format!("Failed to open bundle {}: {error}", path.display()))?;
        let mut archive =
            ZipArchive::new(file).map_err(|error| format!("Failed to read bundle zip: {error}"))?;
        let mut manifest_path = None;
        let mut manifest = None;
        let mut archive_entries = Vec::new();
        for index in 0..archive.len() {
            let mut entry = archive
                .by_index(index)
                .map_err(|error| format!("Failed to read bundle entry {index}: {error}"))?;
            let entry_name = entry.name().to_string();
            archive_entries.push(entry_name.clone());
            if manifest_path.is_some() {
                continue;
            }
            if entry_name.ends_with(EXTENSION_MANIFEST_FILE_NAME) {
                let mut text = String::new();
                entry.read_to_string(&mut text).map_err(|error| {
                    format!(
                        "Failed to read {} from bundle {}: {error}",
                        EXTENSION_MANIFEST_FILE_NAME,
                        path.display()
                    )
                })?;
                let bundle_manifest_directory =
                    entry.enclosed_name().unwrap_or_else(|| PathBuf::from("."));
                manifest = Some(parse_extension_manifest_text(
                    bundle_manifest_directory.as_path(),
                    EXTENSION_MANIFEST_FILE_NAME,
                    &text,
                )?);
                manifest_path = Some(entry_name);
            }
        }
        let manifest = manifest.ok_or_else(|| {
            format!(
                "Bundle {} does not contain {} at its archive root.",
                path.display(),
                EXTENSION_MANIFEST_FILE_NAME
            )
        })?;
        Ok(ExtensionInspection {
            source_kind: "bundle".to_string(),
            root_path: path.to_string_lossy().to_string(),
            manifest_path: manifest_path
                .unwrap_or_else(|| EXTENSION_MANIFEST_FILE_NAME.to_string()),
            entry_count: archive_entries.len(),
            archive_entries,
            manifest,
        })
    } else {
        Err(format!(
            "Unsupported extension source {}. Expected a directory or .{} bundle.",
            path.display(),
            EXTENSION_BUNDLE_EXTENSION
        ))
    }
}

pub fn build_extension_source(
    source_directory: &Path,
    staging_directory: &Path,
    include_debug_sources: bool,
) -> Result<ExtensionBuildResult, String> {
    let (manifest_path, manifest) = read_extension_manifest_from_directory(source_directory)?;
    if staging_directory.exists() {
        fs::remove_dir_all(staging_directory).map_err(|error| {
            format!(
                "Failed to replace staging directory {}: {error}",
                staging_directory.display()
            )
        })?;
    }
    fs::create_dir_all(staging_directory).map_err(|error| {
        format!(
            "Failed to create staging directory {}: {error}",
            staging_directory.display()
        )
    })?;
    copy_directory_recursive(
        source_directory,
        staging_directory,
        &manifest.debug_sources,
        include_debug_sources,
    )?;
    let rendered_manifest = render_extension_manifest_toml(&manifest)?;
    fs::write(
        staging_directory.join(EXTENSION_MANIFEST_FILE_NAME),
        rendered_manifest,
    )
    .map_err(|error| {
        format!(
            "Failed to write normalized {} into {}: {error}",
            EXTENSION_MANIFEST_FILE_NAME,
            staging_directory.display()
        )
    })?;
    Ok(ExtensionBuildResult {
        source_directory: source_directory.to_string_lossy().to_string(),
        staging_directory: staging_directory.to_string_lossy().to_string(),
        manifest_path: manifest_path.to_string_lossy().to_string(),
        manifest,
    })
}

pub fn pack_extension_source(
    source_directory: &Path,
    output_bundle_path: &Path,
    include_debug_sources: bool,
) -> Result<ExtensionPackResult, String> {
    let staging_parent = output_bundle_path
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .join(".gfsx-staging");
    let staging_directory = staging_parent.join(
        source_directory
            .file_name()
            .unwrap_or_else(|| OsStr::new("extension")),
    );
    let build =
        build_extension_source(source_directory, &staging_directory, include_debug_sources)?;
    if let Some(parent) = output_bundle_path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "Failed to create bundle output directory {}: {error}",
                parent.display()
            )
        })?;
    }
    let bundle_file = File::create(output_bundle_path).map_err(|error| {
        format!(
            "Failed to create bundle output {}: {error}",
            output_bundle_path.display()
        )
    })?;
    let mut writer = ZipWriter::new(bundle_file);
    let options = SimpleFileOptions::default()
        .compression_method(CompressionMethod::Deflated)
        .unix_permissions(0o644);
    write_directory_to_zip(&mut writer, &staging_directory, &staging_directory, options)?;
    writer
        .finish()
        .map_err(|error| format!("Failed to finalize bundle zip: {error}"))?;
    let _ = fs::remove_dir_all(staging_parent);
    Ok(ExtensionPackResult {
        source_directory: source_directory.to_string_lossy().to_string(),
        bundle_path: output_bundle_path.to_string_lossy().to_string(),
        manifest: build.manifest,
    })
}

pub fn install_extension_bundle_into(
    bundle_path: &Path,
    install_root: &Path,
    replace_existing: bool,
) -> Result<ExtensionInstallResult, String> {
    let inspection = inspect_extension_source(bundle_path)?;
    let target_directory = install_root.join(&inspection.manifest.id);
    if target_directory.exists() {
        if !replace_existing {
            return Err(format!(
                "Extension install target already exists: {}",
                target_directory.display()
            ));
        }
        fs::remove_dir_all(&target_directory).map_err(|error| {
            format!(
                "Failed to replace installed extension {}: {error}",
                target_directory.display()
            )
        })?;
    }
    fs::create_dir_all(&target_directory).map_err(|error| {
        format!(
            "Failed to create extension install directory {}: {error}",
            target_directory.display()
        )
    })?;

    let file = File::open(bundle_path)
        .map_err(|error| format!("Failed to open bundle {}: {error}", bundle_path.display()))?;
    let mut archive =
        ZipArchive::new(file).map_err(|error| format!("Failed to read bundle zip: {error}"))?;
    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_err(|error| format!("Failed to read bundle entry {index}: {error}"))?;
        let enclosed = entry.enclosed_name().ok_or_else(|| {
            format!(
                "Bundle {} contains an unsafe path at index {}.",
                bundle_path.display(),
                index
            )
        })?;
        let destination = target_directory.join(enclosed);
        if entry.name().ends_with('/') {
            fs::create_dir_all(&destination).map_err(|error| {
                format!(
                    "Failed to create bundle directory {}: {error}",
                    destination.display()
                )
            })?;
            continue;
        }
        if let Some(parent) = destination.parent() {
            fs::create_dir_all(parent).map_err(|error| {
                format!(
                    "Failed to create bundle parent directory {}: {error}",
                    parent.display()
                )
            })?;
        }
        let mut output = File::create(&destination).map_err(|error| {
            format!(
                "Failed to create installed extension file {}: {error}",
                destination.display()
            )
        })?;
        std::io::copy(&mut entry, &mut output).map_err(|error| {
            format!(
                "Failed to extract bundle entry {} into {}: {error}",
                entry.name(),
                destination.display()
            )
        })?;
    }

    Ok(ExtensionInstallResult {
        bundle_path: bundle_path.to_string_lossy().to_string(),
        install_directory: target_directory.to_string_lossy().to_string(),
        manifest: inspection.manifest,
    })
}

pub fn resolve_default_bundle_output_path(source_directory: &Path) -> PathBuf {
    let bundle_name = source_directory
        .file_name()
        .unwrap_or_else(|| OsStr::new("extension"))
        .to_string_lossy();
    source_directory
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .join(format!("{bundle_name}.{}", EXTENSION_BUNDLE_EXTENSION))
}

pub fn read_extension_manifest_from_directory(
    directory: &Path,
) -> Result<(PathBuf, ExtensionManifest), String> {
    for manifest_name in EXTENSION_COMPAT_MANIFEST_FILE_NAMES {
        let candidate = directory.join(manifest_name);
        if !candidate.exists() {
            continue;
        }
        let text = fs::read_to_string(&candidate).map_err(|error| {
            format!(
                "Failed to read extension manifest {}: {error}",
                candidate.display()
            )
        })?;
        let manifest = parse_extension_manifest_text(directory, manifest_name, &text)?;
        return Ok((candidate, manifest));
    }
    Err(format!(
        "No extension manifest was found in {}. Expected one of: {}",
        directory.display(),
        EXTENSION_COMPAT_MANIFEST_FILE_NAMES.join(", ")
    ))
}

pub fn render_extension_manifest_toml(manifest: &ExtensionManifest) -> Result<String, String> {
    toml::to_string_pretty(manifest)
        .map_err(|error| format!("Failed to serialize extension.toml: {error}"))
}

fn parse_extension_manifest_text(
    manifest_directory: &Path,
    manifest_name: &str,
    text: &str,
) -> Result<ExtensionManifest, String> {
    if manifest_name == EXTENSION_MANIFEST_FILE_NAME {
        let manifest: ExtensionManifest = toml::from_str(text).map_err(|error| {
            format!(
                "Failed to parse {} in {}: {error}",
                manifest_name,
                manifest_directory.display()
            )
        })?;
        return normalize_extension_manifest(manifest);
    }

    let is_json = manifest_name.ends_with(".json");
    let legacy = if is_json {
        serde_json::from_str::<LegacyPluginManifest>(text).map_err(|error| {
            format!(
                "Failed to parse {} in {}: {error}",
                manifest_name,
                manifest_directory.display()
            )
        })?
    } else {
        toml::from_str::<LegacyPluginManifest>(text).map_err(|error| {
            format!(
                "Failed to parse {} in {}: {error}",
                manifest_name,
                manifest_directory.display()
            )
        })?
    };
    normalize_extension_manifest(ExtensionManifest {
        id: legacy.id.unwrap_or_else(|| {
            manifest_directory
                .file_name()
                .unwrap_or_else(|| OsStr::new("extension"))
                .to_string_lossy()
                .to_string()
        }),
        version: legacy.version.map(version_value_to_string),
        name: legacy.name,
        display_name: legacy.display_name,
        description: legacy.description,
        api_version: legacy.api_version,
        entry: legacy.entry,
        default_open: legacy.default_open,
        keep_mounted: legacy.keep_mounted,
        permissions: legacy.permissions,
        contributions: normalize_extension_contributions(legacy.contributions),
        runtimes: legacy.runtimes,
        artifacts: legacy.artifacts,
        debug_sources: legacy.debug_sources,
    })
}

fn normalize_extension_manifest(
    mut manifest: ExtensionManifest,
) -> Result<ExtensionManifest, String> {
    manifest.id = manifest.id.trim().to_string();
    if manifest.id.is_empty() {
        return Err("Extension manifest id is required.".to_string());
    }
    manifest.permissions.launch_intents = manifest
        .permissions
        .launch_intents
        .iter()
        .map(|intent| intent.trim().to_string())
        .filter(|intent| !intent.is_empty())
        .collect();
    manifest.contributions = normalize_extension_contributions(manifest.contributions);
    manifest.debug_sources = manifest
        .debug_sources
        .iter()
        .map(|entry| normalize_relative_extension_path(entry))
        .filter(|entry| !entry.is_empty())
        .collect();
    Ok(manifest)
}

fn normalize_extension_contributions(
    mut contributions: ExtensionContributions,
) -> ExtensionContributions {
    contributions.themes = contributions
        .themes
        .iter()
        .map(|entry| normalize_relative_extension_path(entry))
        .filter(|entry| !entry.is_empty())
        .collect();
    contributions.shaders = contributions
        .shaders
        .iter()
        .map(|entry| normalize_relative_extension_path(entry))
        .filter(|entry| !entry.is_empty())
        .collect();
    contributions.preview_lanes = contributions
        .preview_lanes
        .into_iter()
        .map(|mut lane| {
            lane.renderer = lane
                .renderer
                .map(|value| normalize_relative_extension_path(&value))
                .filter(|value| !value.is_empty());
            lane.renderer_entry = lane
                .renderer_entry
                .map(|value| normalize_relative_extension_path(&value))
                .filter(|value| !value.is_empty());
            lane
        })
        .collect();
    contributions
}

fn version_value_to_string(value: serde_json::Value) -> String {
    match value {
        serde_json::Value::String(text) => text,
        other => other.to_string(),
    }
}

fn normalize_relative_extension_path(value: &str) -> String {
    value
        .trim()
        .replace('\\', "/")
        .trim_start_matches('/')
        .to_string()
}

fn list_directory_entries_relative(root: &Path) -> Result<Vec<String>, String> {
    let mut output = Vec::new();
    collect_directory_entries_relative(root, root, &mut output)?;
    output.sort();
    Ok(output)
}

fn collect_directory_entries_relative(
    root: &Path,
    current: &Path,
    output: &mut Vec<String>,
) -> Result<(), String> {
    for entry in fs::read_dir(current)
        .map_err(|error| format!("Failed to read directory {}: {error}", current.display()))?
    {
        let entry = entry.map_err(|error| format!("Failed to read directory entry: {error}"))?;
        let path = entry.path();
        let relative = path
            .strip_prefix(root)
            .map_err(|error| format!("Failed to compute relative path: {error}"))?;
        if relative.as_os_str().is_empty() {
            continue;
        }
        output.push(relative.to_string_lossy().replace('\\', "/"));
        if path.is_dir() {
            collect_directory_entries_relative(root, &path, output)?;
        }
    }
    Ok(())
}

fn copy_directory_recursive(
    source_root: &Path,
    target_root: &Path,
    debug_sources: &[String],
    include_debug_sources: bool,
) -> Result<(), String> {
    copy_directory_recursive_internal(
        source_root,
        source_root,
        target_root,
        debug_sources,
        include_debug_sources,
    )
}

fn copy_directory_recursive_internal(
    original_source_root: &Path,
    current_source_root: &Path,
    current_target_root: &Path,
    debug_sources: &[String],
    include_debug_sources: bool,
) -> Result<(), String> {
    for entry in fs::read_dir(current_source_root).map_err(|error| {
        format!(
            "Failed to read directory {}: {error}",
            current_source_root.display()
        )
    })? {
        let entry = entry.map_err(|error| format!("Failed to read directory entry: {error}"))?;
        let source_path = entry.path();
        let relative = source_path
            .strip_prefix(original_source_root)
            .map_err(|error| format!("Failed to compute relative path: {error}"))?;
        let relative_str = relative.to_string_lossy().replace('\\', "/");
        if !include_debug_sources && should_skip_debug_source(&relative_str, debug_sources) {
            continue;
        }
        let target_path = current_target_root.join(
            source_path
                .file_name()
                .unwrap_or_else(|| OsStr::new("entry")),
        );
        if source_path.is_dir() {
            fs::create_dir_all(&target_path).map_err(|error| {
                format!(
                    "Failed to create directory {}: {error}",
                    target_path.display()
                )
            })?;
            copy_directory_recursive_internal(
                original_source_root,
                &source_path,
                &target_path,
                debug_sources,
                include_debug_sources,
            )?;
        } else {
            if let Some(parent) = target_path.parent() {
                fs::create_dir_all(parent).map_err(|error| {
                    format!("Failed to create directory {}: {error}", parent.display())
                })?;
            }
            fs::copy(&source_path, &target_path).map_err(|error| {
                format!(
                    "Failed to copy extension file {} -> {}: {error}",
                    source_path.display(),
                    target_path.display()
                )
            })?;
        }
    }
    Ok(())
}

fn should_skip_debug_source(candidate_relative_path: &str, debug_sources: &[String]) -> bool {
    debug_sources.iter().any(|debug_source| {
        let normalized = normalize_relative_extension_path(debug_source);
        !normalized.is_empty()
            && (candidate_relative_path == normalized
                || candidate_relative_path.starts_with(format!("{normalized}/").as_str()))
    })
}

fn write_directory_to_zip(
    writer: &mut ZipWriter<File>,
    root: &Path,
    current: &Path,
    options: SimpleFileOptions,
) -> Result<(), String> {
    for entry in fs::read_dir(current)
        .map_err(|error| format!("Failed to read directory {}: {error}", current.display()))?
    {
        let entry = entry.map_err(|error| format!("Failed to read directory entry: {error}"))?;
        let path = entry.path();
        let relative = path
            .strip_prefix(root)
            .map_err(|error| format!("Failed to compute relative archive path: {error}"))?;
        let relative_name = relative.to_string_lossy().replace('\\', "/");
        if path.is_dir() {
            let directory_name = format!("{relative_name}/");
            writer
                .add_directory(directory_name, options)
                .map_err(|error| format!("Failed to add archive directory: {error}"))?;
            write_directory_to_zip(writer, root, &path, options)?;
            continue;
        }
        writer
            .start_file(relative_name, options)
            .map_err(|error| format!("Failed to add archive file header: {error}"))?;
        let mut file = File::open(&path)
            .map_err(|error| format!("Failed to read {}: {error}", path.display()))?;
        let mut buffer = Vec::new();
        file.read_to_end(&mut buffer)
            .map_err(|error| format!("Failed to read {}: {error}", path.display()))?;
        writer
            .write_all(&buffer)
            .map_err(|error| format!("Failed to write archive file payload: {error}"))?;
    }
    Ok(())
}

fn is_extension_bundle_path(path: &Path) -> bool {
    path.extension()
        .and_then(OsStr::to_str)
        .map(|extension| extension.eq_ignore_ascii_case(EXTENSION_BUNDLE_EXTENSION))
        .unwrap_or(false)
}

pub fn resolve_extension_install_root(managed_content_root: &Path) -> PathBuf {
    managed_content_root.join("plugins")
}

pub fn is_safe_relative_archive_path(path: &Path) -> bool {
    !path.components().any(|component| {
        matches!(
            component,
            Component::ParentDir | Component::RootDir | Component::Prefix(_)
        )
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write_legacy_plugin_manifest(root: &Path) {
        fs::create_dir_all(root).expect("mkdir");
        fs::write(
            root.join("plugin.json"),
            r#"{
  "id": "demo-plugin",
  "version": 1,
  "name": "Demo Plugin",
  "entry": "dist/index.js",
  "permissions": {
    "fsRead": true,
    "launchIntents": ["open-explorer"]
  },
  "contributions": {
    "previewLanes": [
      {
        "id": "demo-preview",
        "renderer": "dist/preview.js",
        "match": {
          "extensions": ["demo"]
        }
      }
    ]
  }
}"#,
        )
        .expect("write");
        fs::create_dir_all(root.join("dist")).expect("mkdir dist");
        fs::write(
            root.join("dist/index.js"),
            "export default function Demo() {}",
        )
        .expect("write entry");
        fs::write(
            root.join("dist/preview.js"),
            "export default function DemoPreview() {}",
        )
        .expect("write preview");
    }

    #[test]
    fn reads_legacy_plugin_manifest_as_extension_manifest() {
        let temp = tempfile::tempdir().expect("tempdir");
        write_legacy_plugin_manifest(temp.path());
        let (_manifest_path, manifest) =
            read_extension_manifest_from_directory(temp.path()).expect("manifest");
        assert_eq!(manifest.id, "demo-plugin");
        assert_eq!(manifest.effective_display_name(), "Demo Plugin");
        assert!(manifest.permissions.fs_read);
        assert_eq!(manifest.contributions.preview_lanes.len(), 1);
    }

    #[test]
    fn builds_and_packs_extension_bundle() {
        let temp = tempfile::tempdir().expect("tempdir");
        let source = temp.path().join("plugin");
        write_legacy_plugin_manifest(&source);
        let staging = temp.path().join("staging");
        let build = build_extension_source(&source, &staging, true).expect("build");
        assert!(Path::new(&build.staging_directory)
            .join(EXTENSION_MANIFEST_FILE_NAME)
            .exists());

        let bundle_path = temp.path().join("demo.gfsx");
        let packed = pack_extension_source(&source, &bundle_path, true).expect("pack");
        assert_eq!(packed.manifest.id, "demo-plugin");
        assert!(bundle_path.exists(), "bundle should be written");
    }

    #[test]
    fn installs_bundle_into_plugin_root() {
        let temp = tempfile::tempdir().expect("tempdir");
        let source = temp.path().join("plugin");
        write_legacy_plugin_manifest(&source);
        let bundle_path = temp.path().join("demo.gfsx");
        pack_extension_source(&source, &bundle_path, true).expect("pack");

        let install_root = temp.path().join("usr/plugins");
        let installed =
            install_extension_bundle_into(&bundle_path, &install_root, true).expect("install");
        let installed_root = install_root.join("demo-plugin");
        assert_eq!(installed.manifest.id, "demo-plugin");
        assert!(installed_root.join(EXTENSION_MANIFEST_FILE_NAME).exists());
    }
}
