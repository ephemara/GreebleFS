//! Tauri/Specta command surface for the universal runtime pipeline.
//!
//! These commands form the `runtime-host-v1` bridge. The frontend's
//! `externalRuntimeBackend.ts` is the canonical TS consumer, and the
//! `goRuntimeBackend.ts` convenience layer composes them into Go-flavored
//! ergonomics on top.

use std::collections::HashMap;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};
use url::Url;

use crate::cloud_commands::{cloud_list_dir, cloud_open_file, CloudRuntimeState};
use crate::explorer_identity::{
    build_content_revision, build_virtual_identity, ExplorerIdentityManager,
};
use crate::fs_commands::{fs_list_archive_dir, fs_list_dir, fs_open_file, FileEntry};
use crate::remote_storage_commands::{remote_list_dir, remote_open_file, RemoteStorageState};
use crate::runtime_pipeline::cache::{CacheKeyParts, CompileCacheLayout};
use crate::runtime_pipeline::command_runtime::{
    run_native_command, ExternalRuntimeCommandRequest, ExternalRuntimeCommandResult,
};
use crate::runtime_pipeline::discovery::{
    DiscoveredRuntimePackage, RuntimeDiscoveryRoot, RuntimePackageOrigin,
};
use crate::runtime_pipeline::driver::{
    artifact_name_for_compiler, default_target_for_compiler, invoke_build_script,
    resolve_toolchain_version,
};
use crate::runtime_pipeline::manifest::{RuntimeCompiler, RuntimeKind};
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
const EXPLORER_ARCHIVE_VIRTUAL_SCHEME: &str = "greeblefs://archive";
const REMOTE_PROTOCOL_PREFIX: &str = "remote://sftp/";

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeHostExplorerListLocationRequest {
    path: String,
    #[serde(default)]
    show_hidden: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeHostExplorerOpenPathRequest {
    path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeHostExplorerBreadcrumb {
    label: String,
    path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeHostExplorerLocationListing {
    kind: String,
    path: String,
    parent_path: Option<String>,
    breadcrumbs: Vec<RuntimeHostExplorerBreadcrumb>,
    entries: Vec<FileEntry>,
}

#[derive(Debug, Clone)]
struct RuntimeArchiveVirtualLocation {
    archive_path: String,
    entry_path: String,
}

fn is_cloud_explorer_path(path: &str) -> bool {
    path.trim().starts_with("cloud://")
}

fn is_remote_explorer_path(path: &str) -> bool {
    path.trim().starts_with(REMOTE_PROTOCOL_PREFIX)
}

fn normalize_runtime_archive_entry_path(value: &str) -> String {
    value
        .trim()
        .replace('\\', "/")
        .trim_matches('/')
        .to_string()
}

fn parse_runtime_archive_virtual_path(path: &str) -> Option<RuntimeArchiveVirtualLocation> {
    let parsed = Url::parse(path.trim()).ok()?;
    let normalized_base = format!(
        "{}//{}",
        parsed.scheme(),
        parsed.host_str().unwrap_or_default()
    )
    .to_lowercase();
    if normalized_base != EXPLORER_ARCHIVE_VIRTUAL_SCHEME {
        return None;
    }
    let archive_path = parsed.query_pairs().find_map(|(key, value)| {
        if key == "archive" {
            Some(value.trim().to_string())
        } else {
            None
        }
    })?;
    if archive_path.is_empty() {
        return None;
    }
    let entry_path = parsed
        .query_pairs()
        .find_map(|(key, value)| {
            if key == "entry" {
                Some(value.to_string())
            } else {
                None
            }
        })
        .unwrap_or_default();
    Some(RuntimeArchiveVirtualLocation {
        archive_path,
        entry_path: normalize_runtime_archive_entry_path(&entry_path),
    })
}

fn build_runtime_archive_virtual_path(archive_path: &str, entry_path: &str) -> String {
    let mut url = Url::parse(EXPLORER_ARCHIVE_VIRTUAL_SCHEME)
        .expect("archive virtual scheme should always be valid");
    url.query_pairs_mut()
        .append_pair("archive", archive_path.trim());
    let normalized_entry_path = normalize_runtime_archive_entry_path(entry_path);
    if !normalized_entry_path.is_empty() {
        url.query_pairs_mut()
            .append_pair("entry", normalized_entry_path.as_str());
    }
    url.to_string()
}

fn build_runtime_local_breadcrumbs(path: &str) -> Vec<RuntimeHostExplorerBreadcrumb> {
    let normalized_path = path.trim();
    if normalized_path.is_empty() {
        return Vec::new();
    }

    if normalized_path.len() >= 2
        && normalized_path.as_bytes()[1] == b':'
        && normalized_path
            .chars()
            .next()
            .is_some_and(|character| character.is_ascii_alphabetic())
        && normalized_path.trim_end_matches('\\').len() == 2
    {
        let drive_path = if normalized_path.ends_with('\\') {
            normalized_path.to_string()
        } else {
            format!("{normalized_path}\\")
        };
        return vec![RuntimeHostExplorerBreadcrumb {
            label: drive_path.clone(),
            path: drive_path,
        }];
    }

    let is_windows_path = normalized_path.len() >= 3
        && normalized_path.as_bytes()[1] == b':'
        && (normalized_path.as_bytes()[2] == b'\\' || normalized_path.as_bytes()[2] == b'/');
    if is_windows_path {
        let drive_root = format!("{}\\", &normalized_path[..2]);
        let parts: Vec<&str> = normalized_path
            .trim_end_matches(['\\', '/'])
            .split(['\\', '/'])
            .filter(|segment| !segment.is_empty())
            .collect();
        let mut breadcrumbs = vec![RuntimeHostExplorerBreadcrumb {
            label: drive_root.clone(),
            path: drive_root,
        }];
        for index in 1..parts.len() {
            breadcrumbs.push(RuntimeHostExplorerBreadcrumb {
                label: parts[index].to_string(),
                path: parts[..=index].join("\\"),
            });
        }
        return breadcrumbs;
    }

    if normalized_path.starts_with('/') {
        let parts: Vec<&str> = normalized_path
            .trim_end_matches('/')
            .split('/')
            .filter(|segment| !segment.is_empty())
            .collect();
        let mut breadcrumbs = vec![RuntimeHostExplorerBreadcrumb {
            label: "/".to_string(),
            path: "/".to_string(),
        }];
        for index in 0..parts.len() {
            breadcrumbs.push(RuntimeHostExplorerBreadcrumb {
                label: parts[index].to_string(),
                path: format!("/{}", parts[..=index].join("/")),
            });
        }
        return breadcrumbs;
    }

    let parts: Vec<&str> = normalized_path
        .trim_end_matches(['\\', '/'])
        .split(['\\', '/'])
        .filter(|segment| !segment.is_empty())
        .collect();
    parts
        .iter()
        .enumerate()
        .map(|(index, label)| RuntimeHostExplorerBreadcrumb {
            label: (*label).to_string(),
            path: parts[..=index].join("/"),
        })
        .collect()
}

fn get_runtime_local_parent_path(path: &str) -> Option<String> {
    let normalized = path.trim();
    if normalized.is_empty() {
        return None;
    }

    if (normalized.len() >= 2
        && normalized.as_bytes()[1] == b':'
        && normalized
            .chars()
            .next()
            .is_some_and(|character| character.is_ascii_alphabetic())
        && normalized.trim_end_matches('\\').len() == 2)
        || normalized == "/"
    {
        return None;
    }

    let trimmed = normalized.trim_end_matches(['\\', '/']);
    let parts: Vec<&str> = trimmed.split(['\\', '/']).collect();
    if parts.len() <= 1 {
        return None;
    }

    if parts
        .first()
        .is_some_and(|segment| segment.len() == 2 && segment.ends_with(':'))
    {
        return if parts.len() == 2 {
            Some(format!("{}\\", parts[0]))
        } else {
            Some(format!("{}\\", parts[..parts.len() - 1].join("\\")))
        };
    }

    if trimmed.starts_with('/') {
        let joined = parts[..parts.len() - 1]
            .iter()
            .filter(|segment| !segment.is_empty())
            .copied()
            .collect::<Vec<_>>()
            .join("/");
        return Some(if joined.is_empty() {
            "/".to_string()
        } else {
            format!("/{joined}")
        });
    }

    Some(parts[..parts.len() - 1].join("/"))
}

fn build_runtime_archive_breadcrumbs(
    archive_path: &str,
    entry_path: &str,
) -> Vec<RuntimeHostExplorerBreadcrumb> {
    let mut breadcrumbs = Vec::new();
    if let Some(container_path) = get_runtime_local_parent_path(archive_path) {
        breadcrumbs.extend(build_runtime_local_breadcrumbs(&container_path));
    }
    let archive_root_path = build_runtime_archive_virtual_path(archive_path, "");
    let archive_root_label = archive_path
        .trim()
        .trim_end_matches(['\\', '/'])
        .split(['\\', '/'])
        .filter(|segment| !segment.is_empty())
        .last()
        .unwrap_or(archive_path)
        .to_string();
    breadcrumbs.push(RuntimeHostExplorerBreadcrumb {
        label: archive_root_label,
        path: archive_root_path,
    });

    let entry_segments: Vec<&str> = entry_path
        .split('/')
        .filter(|segment| !segment.is_empty())
        .collect();
    for index in 0..entry_segments.len() {
        breadcrumbs.push(RuntimeHostExplorerBreadcrumb {
            label: entry_segments[index].to_string(),
            path: build_runtime_archive_virtual_path(
                archive_path,
                &entry_segments[..=index].join("/"),
            ),
        });
    }
    breadcrumbs
}

fn to_runtime_archive_virtual_entry(
    archive_path: &str,
    entry: crate::archive_ops::FsArchiveEntryListingEntry,
) -> FileEntry {
    let normalized_relative_path = normalize_runtime_archive_entry_path(&entry.relative_path);
    let content_revision = build_content_revision(entry.size, entry.modified, entry.is_dir, false);
    let identity = build_virtual_identity(
        "archive-entry",
        format!("{archive_path}::{normalized_relative_path}").as_str(),
        &content_revision,
    );
    FileEntry {
        name: entry.name,
        path: build_runtime_archive_virtual_path(archive_path, &normalized_relative_path),
        is_dir: entry.is_dir,
        size: entry.size,
        modified: entry.modified,
        extension: entry.extension,
        is_hidden: false,
        is_symlink: false,
        entity_id: identity.entity_id,
        identity_kind: identity.identity_kind,
        content_revision: identity.content_revision,
    }
}

fn decode_runtime_host_bridge_payload<T: for<'de> Deserialize<'de>>(
    method_id: &str,
    payload_json: Option<String>,
) -> Result<T, String> {
    let payload_json = payload_json.unwrap_or_else(|| "null".to_string());
    serde_json::from_str(payload_json.as_str())
        .map_err(|error| format!("Invalid payload for {method_id}: {error}"))
}

fn encode_runtime_host_bridge_result<T: Serialize>(value: &T) -> Result<String, String> {
    serde_json::to_string(value)
        .map_err(|error| format!("Failed to encode runtime host bridge result: {error}"))
}

async fn runtime_host_list_explorer_location(
    app: AppHandle,
    request: RuntimeHostExplorerListLocationRequest,
) -> Result<RuntimeHostExplorerLocationListing, String> {
    let path = request.path.trim().to_string();
    if path.is_empty() {
        return Err("Explorer host bridge path is required.".to_string());
    }

    if let Some(archive_location) = parse_runtime_archive_virtual_path(path.as_str()) {
        let entries = fs_list_archive_dir(
            archive_location.archive_path.clone(),
            archive_location.entry_path.clone(),
        )
        .await?
        .into_iter()
        .map(|entry| to_runtime_archive_virtual_entry(&archive_location.archive_path, entry))
        .collect();
        let parent_path = if archive_location.entry_path.is_empty() {
            get_runtime_local_parent_path(&archive_location.archive_path)
        } else {
            let mut segments: Vec<&str> = archive_location
                .entry_path
                .split('/')
                .filter(|segment| !segment.is_empty())
                .collect();
            segments.pop();
            Some(build_runtime_archive_virtual_path(
                &archive_location.archive_path,
                &segments.join("/"),
            ))
        };
        return Ok(RuntimeHostExplorerLocationListing {
            kind: "archive".to_string(),
            path,
            parent_path,
            breadcrumbs: build_runtime_archive_breadcrumbs(
                &archive_location.archive_path,
                &archive_location.entry_path,
            ),
            entries,
        });
    }

    if is_cloud_explorer_path(path.as_str()) {
        let state = app.state::<CloudRuntimeState>();
        let listing = cloud_list_dir(app.clone(), state, path.clone()).await?;
        return Ok(RuntimeHostExplorerLocationListing {
            kind: "cloud".to_string(),
            path: listing.path,
            parent_path: listing.parent_path,
            breadcrumbs: listing
                .breadcrumbs
                .into_iter()
                .map(|breadcrumb| RuntimeHostExplorerBreadcrumb {
                    label: breadcrumb.label,
                    path: breadcrumb.path,
                })
                .collect(),
            entries: listing.entries,
        });
    }

    if is_remote_explorer_path(path.as_str()) {
        let state = app.state::<RemoteStorageState>();
        let listing = remote_list_dir(app.clone(), state, path.clone()).await?;
        return Ok(RuntimeHostExplorerLocationListing {
            kind: "remote".to_string(),
            path: listing.path,
            parent_path: listing.parent_path,
            breadcrumbs: listing
                .breadcrumbs
                .into_iter()
                .map(|breadcrumb| RuntimeHostExplorerBreadcrumb {
                    label: breadcrumb.label,
                    path: breadcrumb.path,
                })
                .collect(),
            entries: listing.entries,
        });
    }

    let identity_manager = app.state::<ExplorerIdentityManager>();
    let entries = fs_list_dir(
        app.clone(),
        identity_manager,
        path.clone(),
        request.show_hidden,
    )
    .await?;
    Ok(RuntimeHostExplorerLocationListing {
        kind: "local".to_string(),
        path: path.clone(),
        parent_path: get_runtime_local_parent_path(path.as_str()),
        breadcrumbs: build_runtime_local_breadcrumbs(path.as_str()),
        entries,
    })
}

async fn runtime_host_open_explorer_path(
    app: AppHandle,
    request: RuntimeHostExplorerOpenPathRequest,
) -> Result<(), String> {
    let path = request.path.trim().to_string();
    if path.is_empty() {
        return Err("Explorer open-path payload requires a path.".to_string());
    }
    if is_cloud_explorer_path(path.as_str()) {
        let state = app.state::<CloudRuntimeState>();
        return cloud_open_file(app.clone(), state, path).await;
    }
    if is_remote_explorer_path(path.as_str()) {
        let state = app.state::<RemoteStorageState>();
        return remote_open_file(app.clone(), state, path).await;
    }
    fs_open_file(path).await
}

fn dispatch_runtime_sidecar_host_call(
    app: &AppHandle,
    runtime_id: &str,
    method_id: &str,
    payload_json: Option<String>,
) -> Result<String, String> {
    match method_id {
        "explorer.list_location" => {
            let request: RuntimeHostExplorerListLocationRequest =
                decode_runtime_host_bridge_payload(method_id, payload_json)?;
            let listing = tauri::async_runtime::block_on(runtime_host_list_explorer_location(
                app.clone(),
                request,
            ))?;
            encode_runtime_host_bridge_result(&listing)
        }
        "explorer.open_path" => {
            let request: RuntimeHostExplorerOpenPathRequest =
                decode_runtime_host_bridge_payload(method_id, payload_json)?;
            tauri::async_runtime::block_on(runtime_host_open_explorer_path(app.clone(), request))?;
            Ok("null".to_string())
        }
        _ => Err(format!(
            "Runtime sidecar {} requested unknown host method {}.",
            runtime_id, method_id
        )),
    }
}

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
        |runtime_id, method_id, payload_json| {
            dispatch_runtime_sidecar_host_call(&app, runtime_id, method_id, payload_json)
        },
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
