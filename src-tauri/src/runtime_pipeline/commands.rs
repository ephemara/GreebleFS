//! Tauri/Specta command surface for the universal runtime pipeline.
//!
//! These commands form the `runtime-host-v1` bridge. The frontend's
//! `externalRuntimeBackend.ts` is the canonical TS consumer, and the
//! `goRuntimeBackend.ts` convenience layer composes them into Go-flavored
//! ergonomics on top.

use std::collections::HashMap;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Child, Command as ProcessCommand, Stdio};
use std::sync::{Arc, Mutex, MutexGuard};
use std::thread;
use std::time::{Duration, Instant};

use notify::{EventKind, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};
use url::Url;
use uuid::Uuid;

use crate::cloud_commands::{cloud_list_dir, cloud_open_file, CloudRuntimeState};
use crate::explorer_identity::{
    build_content_revision, build_virtual_identity, ExplorerIdentityManager,
};
use crate::explorer_pro_commands::fs_trash;
use crate::fs_commands::{
    fs_copy, fs_create_dir, fs_delete, fs_delete_many, fs_list_archive_dir, fs_list_dir, fs_move,
    fs_open_file, fs_read_text_file, fs_rename, fs_write_file, git_exec, FileEntry,
    FsWriteFileContent,
};
use crate::global_search::{GlobalSearchIndexQueryRequest, GlobalSearchScanSettings};
use crate::native_task_graph::NativeTaskGraphManager;
use crate::preview_streaming::PreviewStreamingManager;
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
use crate::runtime_pipeline::extension_host::{
    build_extension_host_api_schema, build_extension_source, inspect_extension_source,
    install_extension_bundle_into, pack_extension_source, read_extension_manifest_from_directory,
    resolve_default_bundle_output_path, resolve_extension_install_root,
    ExecutionContextPreviewSession, ExecutionContextSnapshot, ExtensionBuildResult,
    ExtensionHostApiSchema, ExtensionHostFileUnwatchRequest, ExtensionHostFileWatchEvent,
    ExtensionHostFileWatchHandle, ExtensionHostFileWatchRequest, ExtensionHostTaskHandle,
    ExtensionHostTaskOutputEvent, ExtensionHostTaskProgressEvent,
    ExtensionHostTaskStartProcessRequest, ExtensionHostTaskStopProcessRequest, ExtensionInspection,
    ExtensionInstallResult, ExtensionPackResult,
};
use crate::runtime_pipeline::host_events::{
    builtin_host_topic_catalog, HostContextSyncRequest, HostEventBusState, HostEventScope,
    HostPublishEventRequest, HostSubscriptionRequest,
};
use crate::runtime_pipeline::manifest::{RuntimeCompiler, RuntimeKind, RuntimePackagePermissions};
use crate::runtime_pipeline::registry::RuntimeRegistry;
use crate::runtime_pipeline::sidecar::{
    ExternalRuntimeSidecarCallResponse, ExternalRuntimeSidecarStatus, ExternalSidecarManager,
};
use crate::runtime_pipeline::toolchain::{
    probe_runtime_toolchains_with_context, RuntimeToolchainContext, RuntimeToolchainStatus,
};
use crate::runtime_pipeline::tui::{build_tui_launch, ExternalRuntimeTuiLaunch};
use crate::semantic_search::{
    ExplorerSemanticFindSimilarRequest, ExplorerSemanticIndexBuildRequest,
    ExplorerSemanticSearchRequest,
};
use crate::terminal::{
    ExternalTerminalRequest, TerminalShellIntegrationRequest, TerminalWriteRequest,
};
use crate::usr::resolve_managed_content_root;

const BUILTIN_RUNTIMES_ROOT_ID: &str = "builtin";
const MANAGED_RUNTIMES_ROOT_ID: &str = "managed";
const RUNTIMES_MANAGED_DIR_NAME: &str = "runtimes";
const BUILTIN_RUNTIMES_REPO_RELATIVE: &str = "../src-go/builtin-runtimes";
const BUILTIN_KAIN_RUNTIMES_REPO_RELATIVE: &str = "../src-kain/runtimes";
const BUILTIN_KAIN_RUNTIMES_RESOURCE_RELATIVE: &str = "runtimes/kain";
const EXPLORER_ARCHIVE_VIRTUAL_SCHEME: &str = "greeblefs://archive";
const REMOTE_PROTOCOL_PREFIX: &str = "remote://sftp/";
const RUNTIME_ARTIFACT_BYTES_MAX_BYTES: u64 = 256 * 1024 * 1024;

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

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeHostTerminalSpawnRequest {
    id: String,
    #[serde(default)]
    working_dir: Option<String>,
    #[serde(default)]
    shell: Option<String>,
    #[serde(default)]
    rows: Option<u16>,
    #[serde(default)]
    cols: Option<u16>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeHostTerminalOpenOutputStreamRequest {
    id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeHostTerminalResizeRequest {
    id: String,
    rows: u16,
    cols: u16,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeHostTerminalKillRequest {
    id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeHostTerminalSyncCwdRequest {
    id: String,
    cwd: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeHostTerminalSetPromptStateRequest {
    id: String,
    at_prompt: bool,
    #[serde(default)]
    reported_cwd: Option<String>,
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

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionHostCallRequest {
    #[serde(default)]
    pub caller_plugin_id: Option<String>,
    #[serde(default)]
    pub caller_runtime_id: Option<String>,
    pub method_id: String,
    #[serde(default)]
    pub payload_json: Option<String>,
    #[serde(default)]
    pub execution_context: Option<ExecutionContextSnapshot>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionHostCallResponse {
    pub method_id: String,
    pub result_json: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionInspectRequest {
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionBuildRequest {
    pub source_directory: String,
    #[serde(default)]
    pub output_directory: Option<String>,
    #[serde(default)]
    pub include_debug_sources: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionPackRequest {
    pub source_directory: String,
    #[serde(default)]
    pub output_path: Option<String>,
    #[serde(default)]
    pub include_debug_sources: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionInstallRequest {
    pub bundle_path: String,
    #[serde(default)]
    pub replace_existing: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExtensionHostReadTextRequest {
    path: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExtensionHostWriteTextRequest {
    path: String,
    content: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExtensionHostListDirectoryRequest {
    path: String,
    #[serde(default)]
    show_hidden: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExtensionHostCreateDirectoryRequest {
    path: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExtensionHostDeleteRequest {
    path: String,
    #[serde(default)]
    recursive: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExtensionHostDeleteManyRequest {
    paths: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExtensionHostRenameRequest {
    old_path: String,
    new_path: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExtensionHostTransferRequest {
    src: String,
    dst: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExtensionHostTrashRequest {
    paths: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
struct ExtensionHostFileStat {
    path: String,
    exists: bool,
    is_directory: bool,
    size: u64,
    modified_ms: Option<u64>,
    extension: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExtensionHostFileStatRequest {
    path: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExtensionHostSemanticRootRequest {
    root_path: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExtensionHostRepoExecRequest {
    #[serde(default)]
    repo_path: Option<String>,
    args: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExtensionHostTaskRunCommandRequest {
    program: String,
    #[serde(default)]
    args: Vec<String>,
    #[serde(default)]
    working_directory: Option<String>,
    #[serde(default)]
    environment: Option<HashMap<String, String>>,
    #[serde(default)]
    timeout_secs: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
struct ExtensionHostTaskRunCommandResult {
    status: i32,
    stdout: String,
    stderr: String,
}

#[derive(Default)]
pub struct RuntimeTaskProcessManager {
    tasks: Mutex<HashMap<String, Arc<Mutex<Child>>>>,
}

impl RuntimeTaskProcessManager {
    fn tasks_guard(&self) -> MutexGuard<'_, HashMap<String, Arc<Mutex<Child>>>> {
        self.tasks
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    fn insert(&self, task_id: String, child: Arc<Mutex<Child>>) {
        self.tasks_guard().insert(task_id, child);
    }

    fn remove(&self, task_id: &str) {
        self.tasks_guard().remove(task_id);
    }

    fn stop(&self, task_id: &str) -> Result<bool, String> {
        let Some(child) = self.tasks_guard().get(task_id).cloned() else {
            return Ok(false);
        };
        let mut guard = child
            .lock()
            .map_err(|_| "task child lock poisoned".to_string())?;
        guard
            .kill()
            .map_err(|error| format!("Failed to kill task {task_id}: {error}"))?;
        Ok(true)
    }
}

struct RuntimeFileWatchRecord {
    _watcher: notify::RecommendedWatcher,
    path: String,
    recursive: bool,
}

#[derive(Default)]
pub struct RuntimeFileWatchManager {
    watches: Mutex<HashMap<String, RuntimeFileWatchRecord>>,
}

impl RuntimeFileWatchManager {
    fn watches_guard(&self) -> MutexGuard<'_, HashMap<String, RuntimeFileWatchRecord>> {
        self.watches
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    fn insert(&self, watch_id: String, record: RuntimeFileWatchRecord) {
        self.watches_guard().insert(watch_id, record);
    }

    fn remove(&self, watch_id: &str) -> Option<RuntimeFileWatchRecord> {
        self.watches_guard().remove(watch_id)
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExtensionHostUnsubscribeRequest {
    subscription_id: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ExtensionHostDispatchTransport {
    BrowserIpc,
    RuntimeSidecar,
}

pub(crate) async fn dispatch_native_dev_host_call(
    app: AppHandle,
    registry: &RuntimeRegistry,
    request: ExtensionHostCallRequest,
) -> Result<String, String> {
    dispatch_extension_host_call(
        app,
        registry,
        request,
        ExtensionHostDispatchTransport::BrowserIpc,
    )
    .await
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
        let native_task_graph = app.state::<NativeTaskGraphManager>();
        let entries = fs_list_archive_dir(
            native_task_graph,
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

fn resolve_extension_host_caller_permissions(
    app: &AppHandle,
    registry: &RuntimeRegistry,
    caller_runtime_id: Option<&str>,
    caller_plugin_id: Option<&str>,
) -> Result<Option<(String, RuntimePackagePermissions)>, String> {
    if let Some(runtime_id) = caller_runtime_id {
        let package = require_package(registry, app, runtime_id)?;
        return Ok(Some((
            format!("runtime {}", runtime_id),
            package.manifest.permissions.clone(),
        )));
    }
    if let Some(plugin_id) = caller_plugin_id {
        let managed_root = resolve_managed_content_root(app)?;
        let plugins_root = resolve_extension_install_root(&managed_root);
        let plugin_directory = plugins_root.join(plugin_id);
        let (_, manifest) = read_extension_manifest_from_directory(&plugin_directory)?;
        return Ok(Some((
            format!("plugin {}", plugin_id),
            manifest.permissions,
        )));
    }
    Ok(None)
}

fn ensure_extension_host_permission(
    caller_label: Option<&str>,
    permissions: Option<&RuntimePackagePermissions>,
    check: impl Fn(&RuntimePackagePermissions) -> bool,
    permission_label: &str,
) -> Result<(), String> {
    let _ = caller_label;
    let _ = permissions;
    let _ = check;
    let _ = permission_label;
    Ok(())
}

fn ensure_extension_host_launch_intent(
    caller_label: Option<&str>,
    permissions: Option<&RuntimePackagePermissions>,
    launch_intent: &str,
) -> Result<(), String> {
    let permission_label = format!("launchIntents:{launch_intent}");
    ensure_extension_host_permission(
        caller_label,
        permissions,
        |resolved| {
            resolved
                .launch_intents
                .iter()
                .any(|intent| intent == launch_intent)
        },
        permission_label.as_str(),
    )
}

fn resolve_extension_context_path(
    requested_path: Option<&str>,
    execution_context: Option<&ExecutionContextSnapshot>,
) -> Option<String> {
    let requested_path = requested_path
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    if requested_path.is_some() {
        return requested_path;
    }
    execution_context
        .and_then(|context| context.cwd.clone().or(context.active_directory.clone()))
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn extension_host_repo_command_requires_write(args: &[String]) -> bool {
    let Some(command) = args.first().map(|entry| entry.trim()) else {
        return false;
    };
    if command.is_empty() {
        return false;
    }
    let read_only_commands = [
        "branch",
        "cat-file",
        "check-ignore",
        "config",
        "describe",
        "diff",
        "grep",
        "log",
        "ls-files",
        "merge-base",
        "name-rev",
        "remote",
        "rev-list",
        "rev-parse",
        "show",
        "show-ref",
        "status",
        "symbolic-ref",
        "tag",
    ];
    if command == "branch" {
        return args.len() > 1 && !args.iter().any(|entry| entry == "--show-current");
    }
    !read_only_commands.contains(&command)
}

fn run_extension_host_task_command(
    request: ExtensionHostTaskRunCommandRequest,
    execution_context: Option<&ExecutionContextSnapshot>,
) -> Result<ExtensionHostTaskRunCommandResult, String> {
    let working_directory = resolve_extension_host_working_directory(
        request.working_directory.clone(),
        execution_context,
    )?;
    let timeout = Duration::from_secs(request.timeout_secs.unwrap_or(120).max(1));
    let mut command = ProcessCommand::new(request.program.trim());
    command
        .args(&request.args)
        .current_dir(working_directory)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some(environment) = request.environment.as_ref() {
        command.envs(environment);
    }
    let mut child = command
        .spawn()
        .map_err(|error| format!("Failed to spawn task command: {error}"))?;
    let started_at = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(_status)) => break,
            Ok(None) => {
                if started_at.elapsed() > timeout {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(format!(
                        "Task command timed out after {}s.",
                        timeout.as_secs()
                    ));
                }
                thread::sleep(Duration::from_millis(15));
            }
            Err(error) => {
                return Err(format!("Failed while waiting for task command: {error}"));
            }
        }
    }
    let output = child
        .wait_with_output()
        .map_err(|error| format!("Failed to collect task command output: {error}"))?;
    Ok(ExtensionHostTaskRunCommandResult {
        status: output.status.code().unwrap_or(-1),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
    })
}

fn resolve_extension_host_working_directory(
    working_directory: Option<String>,
    execution_context: Option<&ExecutionContextSnapshot>,
) -> Result<String, String> {
    working_directory
        .or_else(|| execution_context.and_then(|context| context.cwd.clone()))
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| {
            "tasks.start_process requires a working directory or execution context cwd.".to_string()
        })
}

fn publish_host_bus_event(
    app: &AppHandle,
    topic: &str,
    payload_json: Option<String>,
    execution_context: Option<ExecutionContextSnapshot>,
    scope: HostEventScope,
    snapshot: bool,
) {
    let host_event_bus = app.state::<HostEventBusState>();
    let _ =
        host_event_bus.publish_host_topic(topic, payload_json, execution_context, scope, snapshot);
}

fn spawn_streamed_task_process(
    app: AppHandle,
    request: ExtensionHostTaskStartProcessRequest,
    execution_context: Option<ExecutionContextSnapshot>,
) -> Result<ExtensionHostTaskHandle, String> {
    let working_directory = resolve_extension_host_working_directory(
        request.working_directory.clone(),
        execution_context.as_ref(),
    )?;
    let task_id = Uuid::new_v4().to_string();
    let mut command = ProcessCommand::new(request.program.trim());
    command
        .args(&request.args)
        .current_dir(working_directory.clone())
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some(environment) = request.environment.as_ref() {
        command.envs(environment);
    }

    let mut child = command
        .spawn()
        .map_err(|error| format!("Failed to spawn streamed task process: {error}"))?;
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let child = Arc::new(Mutex::new(child));
    let task_processes = app.state::<RuntimeTaskProcessManager>();
    task_processes.insert(task_id.clone(), Arc::clone(&child));

    let base_scope = HostEventScope {
        path: Some(working_directory.clone()),
        task_id: Some(task_id.clone()),
        ..HostEventScope::default()
    };
    publish_host_bus_event(
        &app,
        "tasks.progress",
        serde_json::to_string(&ExtensionHostTaskProgressEvent {
            task_id: task_id.clone(),
            phase: "started".to_string(),
            program: Some(request.program.clone()),
            working_directory: Some(working_directory.clone()),
            exit_code: None,
            stream: None,
            error: None,
        })
        .ok(),
        execution_context.clone(),
        base_scope.clone(),
        false,
    );

    if let Some(stdout) = stdout {
        let app_for_stdout = app.clone();
        let task_id_for_stdout = task_id.clone();
        let execution_context_for_stdout = execution_context.clone();
        let scope_for_stdout = base_scope.clone();
        thread::spawn(move || {
            stream_task_output(
                &app_for_stdout,
                stdout,
                task_id_for_stdout.as_str(),
                "stdout",
                execution_context_for_stdout,
                scope_for_stdout,
            );
        });
    }

    if let Some(stderr) = stderr {
        let app_for_stderr = app.clone();
        let task_id_for_stderr = task_id.clone();
        let execution_context_for_stderr = execution_context.clone();
        let scope_for_stderr = base_scope.clone();
        thread::spawn(move || {
            stream_task_output(
                &app_for_stderr,
                stderr,
                task_id_for_stderr.as_str(),
                "stderr",
                execution_context_for_stderr,
                scope_for_stderr,
            );
        });
    }

    let app_for_wait = app.clone();
    let task_id_for_wait = task_id.clone();
    let execution_context_for_wait = execution_context;
    thread::spawn(move || {
        let exit_result = child
            .lock()
            .map_err(|_| "task child lock poisoned".to_string())
            .and_then(|mut locked_child| {
                locked_child
                    .wait()
                    .map_err(|error| format!("Failed to wait for task process: {error}"))
            });
        let scope = HostEventScope {
            task_id: Some(task_id_for_wait.clone()),
            ..base_scope
        };
        match exit_result {
            Ok(status) => {
                publish_host_bus_event(
                    &app_for_wait,
                    "tasks.progress",
                    serde_json::to_string(&ExtensionHostTaskProgressEvent {
                        task_id: task_id_for_wait.clone(),
                        phase: "exited".to_string(),
                        program: None,
                        working_directory: None,
                        exit_code: status.code(),
                        stream: None,
                        error: None,
                    })
                    .ok(),
                    execution_context_for_wait,
                    scope,
                    false,
                );
            }
            Err(error) => {
                publish_host_bus_event(
                    &app_for_wait,
                    "tasks.progress",
                    serde_json::to_string(&ExtensionHostTaskProgressEvent {
                        task_id: task_id_for_wait.clone(),
                        phase: "failed".to_string(),
                        program: None,
                        working_directory: None,
                        exit_code: None,
                        stream: None,
                        error: Some(error),
                    })
                    .ok(),
                    execution_context_for_wait,
                    scope,
                    false,
                );
            }
        }
        let task_processes = app_for_wait.state::<RuntimeTaskProcessManager>();
        task_processes.remove(task_id_for_wait.as_str());
    });

    Ok(ExtensionHostTaskHandle {
        task_id,
        program: request.program,
        working_directory,
    })
}

fn stream_task_output(
    app: &AppHandle,
    mut stream: impl Read,
    task_id: &str,
    stream_name: &str,
    execution_context: Option<ExecutionContextSnapshot>,
    scope: HostEventScope,
) {
    let mut buffer = [0u8; 8192];
    loop {
        match stream.read(&mut buffer) {
            Ok(0) => break,
            Ok(bytes_read) => {
                let chunk = String::from_utf8_lossy(&buffer[..bytes_read]).to_string();
                publish_host_bus_event(
                    app,
                    "tasks.output",
                    serde_json::to_string(&ExtensionHostTaskOutputEvent {
                        task_id: task_id.to_string(),
                        stream: stream_name.to_string(),
                        chunk,
                    })
                    .ok(),
                    execution_context.clone(),
                    scope.clone(),
                    false,
                );
            }
            Err(error) => {
                publish_host_bus_event(
                    app,
                    "tasks.progress",
                    serde_json::to_string(&ExtensionHostTaskProgressEvent {
                        task_id: task_id.to_string(),
                        phase: "stream-error".to_string(),
                        program: None,
                        working_directory: None,
                        exit_code: None,
                        stream: Some(stream_name.to_string()),
                        error: Some(error.to_string()),
                    })
                    .ok(),
                    execution_context.clone(),
                    scope.clone(),
                    false,
                );
                break;
            }
        }
    }
}

fn start_host_file_watch(
    app: AppHandle,
    request: ExtensionHostFileWatchRequest,
    execution_context: Option<ExecutionContextSnapshot>,
) -> Result<ExtensionHostFileWatchHandle, String> {
    let path = request.path.trim().to_string();
    if path.is_empty() {
        return Err("files.watch requires a non-empty path.".to_string());
    }
    let watch_id = Uuid::new_v4().to_string();
    let app_for_watch = app.clone();
    let watch_id_for_events = watch_id.clone();
    let watched_path = path.clone();
    let recursive = request.recursive;
    let execution_context_for_events = execution_context.clone();
    let mut watcher = notify::recommended_watcher(
        move |result: Result<notify::Event, notify::Error>| match result {
            Ok(event) => {
                let change_kind = classify_file_watch_event_kind(&event.kind);
                publish_host_bus_event(
                    &app_for_watch,
                    "files.watch",
                    serde_json::to_string(&ExtensionHostFileWatchEvent {
                        watch_id: watch_id_for_events.clone(),
                        kind: change_kind.to_string(),
                        paths: event
                            .paths
                            .iter()
                            .map(|value: &PathBuf| value.to_string_lossy().to_string())
                            .collect::<Vec<_>>(),
                        error: None,
                    })
                    .ok(),
                    execution_context_for_events.clone(),
                    HostEventScope {
                        path: Some(watched_path.clone()),
                        ..HostEventScope::default()
                    },
                    false,
                );
            }
            Err(error) => {
                publish_host_bus_event(
                    &app_for_watch,
                    "files.watch",
                    serde_json::to_string(&ExtensionHostFileWatchEvent {
                        watch_id: watch_id_for_events.clone(),
                        kind: "error".to_string(),
                        paths: Vec::new(),
                        error: Some(error.to_string()),
                    })
                    .ok(),
                    execution_context_for_events.clone(),
                    HostEventScope {
                        path: Some(watched_path.clone()),
                        ..HostEventScope::default()
                    },
                    false,
                );
            }
        },
    )
    .map_err(|error| format!("Failed to create filesystem watcher: {error}"))?;
    watcher
        .watch(
            Path::new(&path),
            if recursive {
                RecursiveMode::Recursive
            } else {
                RecursiveMode::NonRecursive
            },
        )
        .map_err(|error| format!("Failed to start filesystem watcher: {error}"))?;

    let watch_manager = app.state::<RuntimeFileWatchManager>();
    watch_manager.insert(
        watch_id.clone(),
        RuntimeFileWatchRecord {
            _watcher: watcher,
            path: path.clone(),
            recursive,
        },
    );
    Ok(ExtensionHostFileWatchHandle {
        watch_id,
        path,
        recursive,
    })
}

fn classify_file_watch_event_kind(kind: &EventKind) -> &'static str {
    match kind {
        EventKind::Create(_) => "create",
        EventKind::Modify(_) => "modify",
        EventKind::Remove(_) => "remove",
        EventKind::Any => "any",
        EventKind::Access(_) => "access",
        EventKind::Other => "other",
    }
}

async fn extension_host_stat_path(path: String) -> Result<ExtensionHostFileStat, String> {
    let metadata = match std::fs::metadata(&path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Ok(ExtensionHostFileStat {
                path: path.clone(),
                exists: false,
                is_directory: false,
                size: 0,
                modified_ms: None,
                extension: PathBuf::from(&path)
                    .extension()
                    .and_then(|value| value.to_str())
                    .map(|value| value.to_string()),
            });
        }
        Err(error) => {
            return Err(format!(
                "Failed to inspect extension host path {}: {error}",
                path
            ));
        }
    };
    let modified_ms = metadata
        .modified()
        .ok()
        .and_then(|timestamp| timestamp.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as u64);
    Ok(ExtensionHostFileStat {
        path: path.clone(),
        exists: true,
        is_directory: metadata.is_dir(),
        size: metadata.len(),
        modified_ms,
        extension: PathBuf::from(&path)
            .extension()
            .and_then(|value| value.to_str())
            .map(|value| value.to_string()),
    })
}

async fn dispatch_extension_host_call(
    app: AppHandle,
    registry: &RuntimeRegistry,
    request: ExtensionHostCallRequest,
    dispatch_transport: ExtensionHostDispatchTransport,
) -> Result<String, String> {
    let caller = resolve_extension_host_caller_permissions(
        &app,
        registry,
        request.caller_runtime_id.as_deref(),
        request.caller_plugin_id.as_deref(),
    )?;
    let caller_label = caller.as_ref().map(|(label, _)| label.as_str());
    let caller_permissions = caller.as_ref().map(|(_, permissions)| permissions);

    match request.method_id.as_str() {
        "host.get_api_schema" => {
            encode_runtime_host_bridge_result(&build_extension_host_api_schema())
        }
        "context.sync_snapshot" => {
            let payload: HostContextSyncRequest =
                decode_runtime_host_bridge_payload(&request.method_id, request.payload_json)?;
            let host_event_bus = app.state::<HostEventBusState>();
            host_event_bus.sync_execution_context(payload)?;
            Ok("null".to_string())
        }
        "selection.get_snapshot" => {
            let host_event_bus = app.state::<HostEventBusState>();
            let snapshot = request
                .execution_context
                .or_else(|| host_event_bus.active_execution_context_snapshot())
                .unwrap_or_default();
            encode_runtime_host_bridge_result(&snapshot)
        }
        "preview.get_session" => {
            let preview_session: Option<ExecutionContextPreviewSession> = request
                .execution_context
                .as_ref()
                .and_then(|context| context.preview_session.clone())
                .or_else(|| {
                    let host_event_bus = app.state::<HostEventBusState>();
                    host_event_bus
                        .active_execution_context_snapshot()
                        .and_then(|context| context.preview_session)
                });
            encode_runtime_host_bridge_result(&preview_session)
        }
        "index.init" => {
            let status = crate::global_search::global_search_init(app.clone())?;
            encode_runtime_host_bridge_result(&status)
        }
        "index.get_status" => {
            let status = crate::global_search::global_search_get_status()?;
            encode_runtime_host_bridge_result(&status)
        }
        "index.start_scan" => {
            ensure_extension_host_permission(
                caller_label,
                caller_permissions,
                |permissions| permissions.fs_read,
                "fsRead",
            )?;
            let payload: GlobalSearchScanSettings =
                decode_runtime_host_bridge_payload(&request.method_id, request.payload_json)?;
            crate::global_search::global_search_start_scan(app.clone(), payload).await?;
            Ok("null".to_string())
        }
        "index.cancel_scan" => {
            crate::global_search::global_search_cancel_scan()?;
            Ok("null".to_string())
        }
        "index.search" => {
            ensure_extension_host_permission(
                caller_label,
                caller_permissions,
                |permissions| permissions.fs_read,
                "fsRead",
            )?;
            let payload: GlobalSearchIndexQueryRequest =
                decode_runtime_host_bridge_payload(&request.method_id, request.payload_json)?;
            let results =
                crate::global_search::global_search_query_index(app.clone(), payload).await?;
            encode_runtime_host_bridge_result(&results)
        }
        "semantic.get_summary" => {
            ensure_extension_host_permission(
                caller_label,
                caller_permissions,
                |permissions| permissions.fs_read,
                "fsRead",
            )?;
            let payload: ExtensionHostSemanticRootRequest =
                decode_runtime_host_bridge_payload(&request.method_id, request.payload_json)?;
            let summary = crate::semantic_search::explorer_semantic_index_get_summary(
                app.clone(),
                payload.root_path,
            )
            .await?;
            encode_runtime_host_bridge_result(&summary)
        }
        "semantic.build" => {
            ensure_extension_host_permission(
                caller_label,
                caller_permissions,
                |permissions| permissions.fs_read,
                "fsRead",
            )?;
            let payload: ExplorerSemanticIndexBuildRequest =
                decode_runtime_host_bridge_payload(&request.method_id, request.payload_json)?;
            let started =
                crate::semantic_search::explorer_semantic_index_build(app.clone(), payload).await?;
            encode_runtime_host_bridge_result(&started)
        }
        "semantic.search" => {
            ensure_extension_host_permission(
                caller_label,
                caller_permissions,
                |permissions| permissions.fs_read,
                "fsRead",
            )?;
            let payload: ExplorerSemanticSearchRequest =
                decode_runtime_host_bridge_payload(&request.method_id, request.payload_json)?;
            let response =
                crate::semantic_search::explorer_semantic_search(app.clone(), payload).await?;
            encode_runtime_host_bridge_result(&response)
        }
        "semantic.find_similar" => {
            ensure_extension_host_permission(
                caller_label,
                caller_permissions,
                |permissions| permissions.fs_read,
                "fsRead",
            )?;
            let payload: ExplorerSemanticFindSimilarRequest =
                decode_runtime_host_bridge_payload(&request.method_id, request.payload_json)?;
            let response =
                crate::semantic_search::explorer_semantic_find_similar(app.clone(), payload)
                    .await?;
            encode_runtime_host_bridge_result(&response)
        }
        "events.describe_topics" => {
            encode_runtime_host_bridge_result(&builtin_host_topic_catalog())
        }
        "events.subscribe" => {
            let payload: HostSubscriptionRequest =
                decode_runtime_host_bridge_payload(&request.method_id, request.payload_json)?;
            let host_event_bus = app.state::<HostEventBusState>();
            match dispatch_transport {
                ExtensionHostDispatchTransport::BrowserIpc => {
                    let subscription = host_event_bus.subscribe_browser(app.clone(), payload)?;
                    encode_runtime_host_bridge_result(&subscription)
                }
                ExtensionHostDispatchTransport::RuntimeSidecar => Err(
                    "Sidecars must use the stdio-json-lines-v2 `subscribe` packet instead of host-call `events.subscribe`."
                        .to_string(),
                ),
            }
        }
        "events.unsubscribe" => {
            let payload: ExtensionHostUnsubscribeRequest =
                decode_runtime_host_bridge_payload(&request.method_id, request.payload_json)?;
            let host_event_bus = app.state::<HostEventBusState>();
            let subscription = host_event_bus.unsubscribe(&app, payload.subscription_id.as_str());
            encode_runtime_host_bridge_result(&subscription)
        }
        "events.get_snapshot" => {
            let payload: HostSubscriptionRequest =
                decode_runtime_host_bridge_payload(&request.method_id, request.payload_json)?;
            let host_event_bus = app.state::<HostEventBusState>();
            let events = host_event_bus.snapshots_for_request(&payload);
            encode_runtime_host_bridge_result(&events)
        }
        "events.publish" => {
            let payload: HostPublishEventRequest =
                decode_runtime_host_bridge_payload(&request.method_id, request.payload_json)?;
            let host_event_bus = app.state::<HostEventBusState>();
            let caller_extension_id = request
                .caller_plugin_id
                .clone()
                .or_else(|| request.caller_runtime_id.clone());
            let envelope = host_event_bus.publish_extension_event(
                payload.topic.as_str(),
                payload.payload_json,
                request
                    .execution_context
                    .clone()
                    .or_else(|| host_event_bus.active_execution_context_snapshot()),
                caller_extension_id.as_deref(),
            )?;
            encode_runtime_host_bridge_result(&envelope)
        }
        "files.read_text" => {
            ensure_extension_host_permission(
                caller_label,
                caller_permissions,
                |permissions| permissions.fs_read,
                "fsRead",
            )?;
            let payload: ExtensionHostReadTextRequest =
                decode_runtime_host_bridge_payload(&request.method_id, request.payload_json)?;
            let native_task_graph = app.state::<NativeTaskGraphManager>();
            let preview_streaming = app.state::<PreviewStreamingManager>();
            let content =
                fs_read_text_file(native_task_graph, preview_streaming, payload.path).await?;
            encode_runtime_host_bridge_result(&content)
        }
        "files.write_text" => {
            ensure_extension_host_permission(
                caller_label,
                caller_permissions,
                |permissions| permissions.fs_write,
                "fsWrite",
            )?;
            let payload: ExtensionHostWriteTextRequest =
                decode_runtime_host_bridge_payload(&request.method_id, request.payload_json)?;
            fs_write_file(payload.path, FsWriteFileContent::Text(payload.content)).await?;
            Ok("null".to_string())
        }
        "files.create_directory" => {
            ensure_extension_host_permission(
                caller_label,
                caller_permissions,
                |permissions| permissions.fs_write,
                "fsWrite",
            )?;
            let payload: ExtensionHostCreateDirectoryRequest =
                decode_runtime_host_bridge_payload(&request.method_id, request.payload_json)?;
            fs_create_dir(payload.path).await?;
            Ok("null".to_string())
        }
        "files.delete" => {
            ensure_extension_host_permission(
                caller_label,
                caller_permissions,
                |permissions| permissions.fs_write,
                "fsWrite",
            )?;
            let payload: ExtensionHostDeleteRequest =
                decode_runtime_host_bridge_payload(&request.method_id, request.payload_json)?;
            fs_delete(payload.path, payload.recursive).await?;
            Ok("null".to_string())
        }
        "files.delete_many" => {
            ensure_extension_host_permission(
                caller_label,
                caller_permissions,
                |permissions| permissions.fs_write,
                "fsWrite",
            )?;
            let payload: ExtensionHostDeleteManyRequest =
                decode_runtime_host_bridge_payload(&request.method_id, request.payload_json)?;
            fs_delete_many(payload.paths).await?;
            Ok("null".to_string())
        }
        "files.rename" => {
            ensure_extension_host_permission(
                caller_label,
                caller_permissions,
                |permissions| permissions.fs_write,
                "fsWrite",
            )?;
            let payload: ExtensionHostRenameRequest =
                decode_runtime_host_bridge_payload(&request.method_id, request.payload_json)?;
            let identity_manager = app.state::<ExplorerIdentityManager>();
            fs_rename(
                app.clone(),
                identity_manager,
                payload.old_path,
                payload.new_path,
            )
            .await?;
            Ok("null".to_string())
        }
        "files.move" => {
            ensure_extension_host_permission(
                caller_label,
                caller_permissions,
                |permissions| permissions.fs_write,
                "fsWrite",
            )?;
            let payload: ExtensionHostTransferRequest =
                decode_runtime_host_bridge_payload(&request.method_id, request.payload_json)?;
            let identity_manager = app.state::<ExplorerIdentityManager>();
            fs_move(app.clone(), identity_manager, payload.src, payload.dst).await?;
            Ok("null".to_string())
        }
        "files.copy" => {
            ensure_extension_host_permission(
                caller_label,
                caller_permissions,
                |permissions| permissions.fs_write,
                "fsWrite",
            )?;
            let payload: ExtensionHostTransferRequest =
                decode_runtime_host_bridge_payload(&request.method_id, request.payload_json)?;
            fs_copy(payload.src, payload.dst).await?;
            Ok("null".to_string())
        }
        "files.trash" => {
            ensure_extension_host_permission(
                caller_label,
                caller_permissions,
                |permissions| permissions.fs_write,
                "fsWrite",
            )?;
            let payload: ExtensionHostTrashRequest =
                decode_runtime_host_bridge_payload(&request.method_id, request.payload_json)?;
            let record = fs_trash(app.clone(), payload.paths).await?;
            encode_runtime_host_bridge_result(&record)
        }
        "files.list_directory" | "explorer.list_location" => {
            ensure_extension_host_permission(
                caller_label,
                caller_permissions,
                |permissions| permissions.fs_read,
                "fsRead",
            )?;
            let payload: ExtensionHostListDirectoryRequest =
                decode_runtime_host_bridge_payload(&request.method_id, request.payload_json)?;
            let listing = runtime_host_list_explorer_location(
                app.clone(),
                RuntimeHostExplorerListLocationRequest {
                    path: payload.path,
                    show_hidden: payload.show_hidden,
                },
            )
            .await?;
            encode_runtime_host_bridge_result(&listing)
        }
        "files.stat" => {
            ensure_extension_host_permission(
                caller_label,
                caller_permissions,
                |permissions| permissions.fs_read,
                "fsRead",
            )?;
            let payload: ExtensionHostFileStatRequest =
                decode_runtime_host_bridge_payload(&request.method_id, request.payload_json)?;
            let stat = extension_host_stat_path(payload.path).await?;
            encode_runtime_host_bridge_result(&stat)
        }
        "files.watch" => {
            ensure_extension_host_permission(
                caller_label,
                caller_permissions,
                |permissions| permissions.fs_watch,
                "fsWatch",
            )?;
            let payload: ExtensionHostFileWatchRequest =
                decode_runtime_host_bridge_payload(&request.method_id, request.payload_json)?;
            let handle =
                start_host_file_watch(app.clone(), payload, request.execution_context.clone())?;
            encode_runtime_host_bridge_result(&handle)
        }
        "files.unwatch" => {
            ensure_extension_host_permission(
                caller_label,
                caller_permissions,
                |permissions| permissions.fs_watch,
                "fsWatch",
            )?;
            let payload: ExtensionHostFileUnwatchRequest =
                decode_runtime_host_bridge_payload(&request.method_id, request.payload_json)?;
            let watch_manager = app.state::<RuntimeFileWatchManager>();
            let removed = watch_manager
                .remove(payload.watch_id.as_str())
                .map(|record| ExtensionHostFileWatchHandle {
                    watch_id: payload.watch_id.clone(),
                    path: record.path,
                    recursive: record.recursive,
                });
            encode_runtime_host_bridge_result(&removed)
        }
        "explorer.open_path" => {
            ensure_extension_host_launch_intent(caller_label, caller_permissions, "open-explorer")?;
            let payload: RuntimeHostExplorerOpenPathRequest =
                decode_runtime_host_bridge_payload(&request.method_id, request.payload_json)?;
            runtime_host_open_explorer_path(app.clone(), payload).await?;
            Ok("null".to_string())
        }
        "repo.exec" => {
            let payload: ExtensionHostRepoExecRequest =
                decode_runtime_host_bridge_payload(&request.method_id, request.payload_json)?;
            let repo_path = payload
                .repo_path
                .clone()
                .or_else(|| {
                    request
                        .execution_context
                        .as_ref()
                        .and_then(|context| context.repo_context.as_ref())
                        .map(|context| context.root_path.clone())
                })
                .or_else(|| {
                    request
                        .execution_context
                        .as_ref()
                        .and_then(|context| context.cwd.clone())
                })
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty())
                .ok_or_else(|| {
                    "repo.exec requires a repository path or execution context repo root."
                        .to_string()
                })?;
            let requires_write = extension_host_repo_command_requires_write(&payload.args);
            if requires_write {
                ensure_extension_host_permission(
                    caller_label,
                    caller_permissions,
                    |permissions| permissions.repo_write,
                    "repoWrite",
                )?;
            } else {
                ensure_extension_host_permission(
                    caller_label,
                    caller_permissions,
                    |permissions| permissions.repo_read || permissions.repo_write,
                    "repoRead",
                )?;
            }
            let result = git_exec(repo_path, payload.args).await?;
            encode_runtime_host_bridge_result(&result)
        }
        "tasks.run_command" => {
            ensure_extension_host_permission(
                caller_label,
                caller_permissions,
                |permissions| permissions.task_execution || permissions.spawn_processes,
                "taskExecution",
            )?;
            let payload: ExtensionHostTaskRunCommandRequest =
                decode_runtime_host_bridge_payload(&request.method_id, request.payload_json)?;
            let result =
                run_extension_host_task_command(payload, request.execution_context.as_ref())?;
            encode_runtime_host_bridge_result(&result)
        }
        "tasks.start_process" => {
            let payload: ExtensionHostTaskStartProcessRequest =
                decode_runtime_host_bridge_payload(&request.method_id, request.payload_json)?;
            let handle = spawn_streamed_task_process(
                app.clone(),
                payload,
                request.execution_context.clone(),
            )?;
            encode_runtime_host_bridge_result(&handle)
        }
        "tasks.stop_process" => {
            let payload: ExtensionHostTaskStopProcessRequest =
                decode_runtime_host_bridge_payload(&request.method_id, request.payload_json)?;
            let task_processes = app.state::<RuntimeTaskProcessManager>();
            let stopped = task_processes.stop(payload.task_id.as_str())?;
            if stopped {
                task_processes.remove(payload.task_id.as_str());
                publish_host_bus_event(
                    &app,
                    "tasks.progress",
                    serde_json::to_string(&ExtensionHostTaskProgressEvent {
                        task_id: payload.task_id.clone(),
                        phase: "stopped".to_string(),
                        program: None,
                        working_directory: None,
                        exit_code: None,
                        stream: None,
                        error: None,
                    })
                    .ok(),
                    request.execution_context.clone(),
                    HostEventScope {
                        task_id: Some(payload.task_id),
                        ..HostEventScope::default()
                    },
                    false,
                );
            }
            encode_runtime_host_bridge_result(&stopped)
        }
        "terminal.spawn" => {
            ensure_extension_host_permission(
                caller_label,
                caller_permissions,
                |permissions| permissions.terminal_interaction,
                "terminalInteraction",
            )?;
            let mut payload: RuntimeHostTerminalSpawnRequest =
                decode_runtime_host_bridge_payload(&request.method_id, request.payload_json)?;
            if payload
                .working_dir
                .as_ref()
                .map(|value| value.trim().is_empty())
                != Some(false)
            {
                payload.working_dir =
                    resolve_extension_context_path(None, request.execution_context.as_ref());
            }
            crate::terminal::terminal_spawn(
                app.state::<crate::terminal::TerminalManager>(),
                app.clone(),
                payload.id,
                payload.working_dir,
                payload.shell,
                payload.rows,
                payload.cols,
            )
            .await?;
            Ok("null".to_string())
        }
        "terminal.write" => {
            ensure_extension_host_permission(
                caller_label,
                caller_permissions,
                |permissions| permissions.terminal_interaction,
                "terminalInteraction",
            )?;
            let payload: TerminalWriteRequest =
                decode_runtime_host_bridge_payload(&request.method_id, request.payload_json)?;
            crate::terminal::terminal_write(
                app.state::<crate::terminal::TerminalManager>(),
                payload.id,
                payload.data,
            )
            .await?;
            Ok("null".to_string())
        }
        "terminal.write_many" => {
            ensure_extension_host_permission(
                caller_label,
                caller_permissions,
                |permissions| permissions.terminal_interaction,
                "terminalInteraction",
            )?;
            let payload: Vec<TerminalWriteRequest> =
                decode_runtime_host_bridge_payload(&request.method_id, request.payload_json)?;
            crate::terminal::terminal_write_many(
                app.state::<crate::terminal::TerminalManager>(),
                payload,
            )
            .await?;
            Ok("null".to_string())
        }
        "terminal.resize" => {
            ensure_extension_host_permission(
                caller_label,
                caller_permissions,
                |permissions| permissions.terminal_interaction,
                "terminalInteraction",
            )?;
            let payload: RuntimeHostTerminalResizeRequest =
                decode_runtime_host_bridge_payload(&request.method_id, request.payload_json)?;
            crate::terminal::terminal_resize(
                app.state::<crate::terminal::TerminalManager>(),
                payload.id,
                payload.rows,
                payload.cols,
            )
            .await?;
            Ok("null".to_string())
        }
        "terminal.kill" => {
            ensure_extension_host_permission(
                caller_label,
                caller_permissions,
                |permissions| permissions.terminal_interaction,
                "terminalInteraction",
            )?;
            let payload: RuntimeHostTerminalKillRequest =
                decode_runtime_host_bridge_payload(&request.method_id, request.payload_json)?;
            crate::terminal::terminal_kill(
                app.clone(),
                app.state::<crate::terminal::TerminalManager>(),
                payload.id,
            )
            .await?;
            Ok("null".to_string())
        }
        "terminal.open_output_stream" => {
            ensure_extension_host_permission(
                caller_label,
                caller_permissions,
                |permissions| permissions.terminal_interaction,
                "terminalInteraction",
            )?;
            let payload: RuntimeHostTerminalOpenOutputStreamRequest =
                decode_runtime_host_bridge_payload(&request.method_id, request.payload_json)?;
            let stream = crate::terminal::terminal_open_output_stream(
                app.clone(),
                app.state::<crate::terminal::TerminalManager>(),
                payload.id,
            )
            .await?;
            encode_runtime_host_bridge_result(&stream)
        }
        "terminal.register_shell_integration" => {
            ensure_extension_host_permission(
                caller_label,
                caller_permissions,
                |permissions| permissions.terminal_interaction,
                "terminalInteraction",
            )?;
            let payload: TerminalShellIntegrationRequest =
                decode_runtime_host_bridge_payload(&request.method_id, request.payload_json)?;
            let state = crate::terminal::terminal_register_shell_integration(
                app.clone(),
                app.state::<crate::terminal::TerminalManager>(),
                payload,
            )
            .await?;
            encode_runtime_host_bridge_result(&state)
        }
        "terminal.sync_cwd" => {
            ensure_extension_host_permission(
                caller_label,
                caller_permissions,
                |permissions| permissions.terminal_interaction,
                "terminalInteraction",
            )?;
            let payload: RuntimeHostTerminalSyncCwdRequest =
                decode_runtime_host_bridge_payload(&request.method_id, request.payload_json)?;
            let state = crate::terminal::terminal_sync_cwd(
                app.clone(),
                app.state::<crate::terminal::TerminalManager>(),
                payload.id,
                payload.cwd,
            )
            .await?;
            encode_runtime_host_bridge_result(&state)
        }
        "terminal.set_prompt_state" => {
            ensure_extension_host_permission(
                caller_label,
                caller_permissions,
                |permissions| permissions.terminal_interaction,
                "terminalInteraction",
            )?;
            let payload: RuntimeHostTerminalSetPromptStateRequest =
                decode_runtime_host_bridge_payload(&request.method_id, request.payload_json)?;
            let state = crate::terminal::terminal_set_prompt_state(
                app.clone(),
                app.state::<crate::terminal::TerminalManager>(),
                payload.id,
                payload.at_prompt,
                payload.reported_cwd,
            )
            .await?;
            encode_runtime_host_bridge_result(&state)
        }
        "terminal.open_external" => {
            ensure_extension_host_permission(
                caller_label,
                caller_permissions,
                |permissions| permissions.terminal_interaction,
                "terminalInteraction",
            )?;
            ensure_extension_host_launch_intent(caller_label, caller_permissions, "open-terminal")?;
            let mut payload: ExternalTerminalRequest =
                decode_runtime_host_bridge_payload(&request.method_id, request.payload_json)?;
            if payload.working_dir.trim().is_empty() {
                payload.working_dir = resolve_extension_context_path(
                    None,
                    request.execution_context.as_ref(),
                )
                .ok_or_else(|| {
                    "terminal.open_external requires a working directory or execution context cwd."
                        .to_string()
                })?;
            }
            crate::terminal::terminal_open_external(payload).await?;
            Ok("null".to_string())
        }
        _ => Err(format!(
            "Extension host requested unknown method {}.",
            request.method_id
        )),
    }
}

pub(crate) fn dispatch_runtime_sidecar_host_call(
    app: &AppHandle,
    registry: &RuntimeRegistry,
    runtime_id: &str,
    method_id: &str,
    payload_json: Option<String>,
    execution_context: Option<ExecutionContextSnapshot>,
) -> Result<String, String> {
    tauri::async_runtime::block_on(dispatch_extension_host_call(
        app.clone(),
        registry,
        ExtensionHostCallRequest {
            caller_plugin_id: None,
            caller_runtime_id: Some(runtime_id.to_string()),
            method_id: method_id.to_string(),
            payload_json,
            execution_context,
        },
        ExtensionHostDispatchTransport::RuntimeSidecar,
    ))
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeReadArtifactBytesRequest {
    pub runtime_id: String,
    pub cache_key: String,
    pub artifact_kind: String,
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
    pub execution_context: Option<ExecutionContextSnapshot>,
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
pub async fn runtime_get_toolchain_status(
    app: AppHandle,
) -> Result<RuntimeToolchainStatus, String> {
    let context = runtime_toolchain_context(&app);
    Ok(probe_runtime_toolchains_with_context(&context))
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
    let toolchain_context = runtime_toolchain_context(&app);

    let toolchain_version = resolve_toolchain_version(manifest.compiler, &toolchain_context)?;

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
        let build_result =
            invoke_build_script(manifest, &artifact_path, &target, &mode, &toolchain_context)?;
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

fn validate_runtime_artifact_cache_key(cache_key: &str) -> Result<(), String> {
    if cache_key.len() == 64
        && cache_key
            .chars()
            .all(|character| character.is_ascii_hexdigit())
    {
        return Ok(());
    }

    Err("Runtime artifact cache keys must be 64-character SHA-256 hex digests.".to_string())
}

fn validate_runtime_artifact_file_name(artifact_kind: &str) -> Result<(), String> {
    if artifact_kind.trim().is_empty() {
        return Err("Runtime artifact kind cannot be empty.".to_string());
    }

    if artifact_kind.contains('/') || artifact_kind.contains('\\') {
        return Err("Runtime artifact kind must be a file name, not a path.".to_string());
    }

    if artifact_kind == "." || artifact_kind == ".." {
        return Err("Runtime artifact kind cannot be a relative path segment.".to_string());
    }

    Ok(())
}

fn resolve_runtime_artifact_cache_path(
    layout: &CompileCacheLayout,
    request: &RuntimeReadArtifactBytesRequest,
) -> Result<PathBuf, String> {
    validate_runtime_artifact_cache_key(&request.cache_key)?;
    validate_runtime_artifact_file_name(&request.artifact_kind)?;
    Ok(layout
        .entry_for(&request.cache_key)
        .artifact_path(&request.artifact_kind))
}

fn canonicalize_runtime_artifact_inside_cache(
    layout: &CompileCacheLayout,
    artifact_path: &Path,
) -> Result<PathBuf, String> {
    let cache_root = std::fs::canonicalize(&layout.root_dir).map_err(|error| {
        format!(
            "Failed to resolve runtime cache root '{}': {error}",
            layout.root_dir.display()
        )
    })?;
    let artifact = std::fs::canonicalize(artifact_path).map_err(|error| {
        format!(
            "Failed to resolve runtime artifact '{}': {error}",
            artifact_path.display()
        )
    })?;

    if !artifact.starts_with(&cache_root) {
        return Err(format!(
            "Runtime artifact '{}' is outside the runtime cache root.",
            artifact.display()
        ));
    }

    Ok(artifact)
}

#[tauri::command]
pub async fn runtime_read_artifact_bytes(
    app: AppHandle,
    registry: State<'_, RuntimeRegistry>,
    request: RuntimeReadArtifactBytesRequest,
) -> Result<tauri::transport::BinaryResponse, String> {
    let package = require_package(&registry, &app, &request.runtime_id)?;
    if !package.manifest.kind.is_wasm() || !package.manifest.compiler.produces_wasm() {
        return Err(format!(
            "runtime_read_artifact_bytes requires a wasm runtime (got kind = {}, compiler = {})",
            package.manifest.kind.as_str(),
            package.manifest.compiler.as_str()
        ));
    }

    let expected_artifact_kind =
        artifact_name_for_compiler(package.manifest.compiler, &package.manifest.id);
    if request.artifact_kind != expected_artifact_kind {
        return Err(format!(
            "Runtime artifact kind '{}' does not match expected artifact '{}' for runtime '{}'.",
            request.artifact_kind, expected_artifact_kind, package.manifest.id
        ));
    }

    let layout = CompileCacheLayout::from_app(&app)?;
    let artifact_path = resolve_runtime_artifact_cache_path(&layout, &request)?;
    let artifact_path = canonicalize_runtime_artifact_inside_cache(&layout, &artifact_path)?;
    let metadata = tokio::fs::metadata(&artifact_path).await.map_err(|error| {
        format!(
            "Failed to inspect runtime artifact '{}': {error}",
            artifact_path.display()
        )
    })?;
    if !metadata.is_file() {
        return Err(format!(
            "Runtime artifact '{}' is not a file.",
            artifact_path.display()
        ));
    }
    if metadata.len() > RUNTIME_ARTIFACT_BYTES_MAX_BYTES {
        return Err(format!(
            "Runtime artifact '{}' is too large to load into a wasm panel (> {} MB).",
            artifact_path.display(),
            RUNTIME_ARTIFACT_BYTES_MAX_BYTES / (1024 * 1024)
        ));
    }

    let bytes = tokio::fs::read(&artifact_path).await.map_err(|error| {
        format!(
            "Failed to read runtime artifact '{}': {error}",
            artifact_path.display()
        )
    })?;
    Ok(tauri::transport::BinaryResponse::new(bytes))
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
            "Use the legacy `python_*` Tauri commands for Python sidecars; this lane is for external native/Wasm/Kain runtimes."
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
    sidecar_state.start(&app, &package.manifest, &binary_path)
}

#[tauri::command]
#[specta::specta]
pub async fn runtime_stop_sidecar(
    app: AppHandle,
    sidecar_state: State<'_, ExternalSidecarManager>,
    request: RuntimeStopSidecarRequest,
) -> Result<ExternalRuntimeSidecarStatus, String> {
    Ok(sidecar_state.stop(&app, &request.runtime_id))
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

    let request_for_sidecar_call = request.clone();
    let app_for_sidecar_call = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let sidecar_state = app_for_sidecar_call.state::<ExternalSidecarManager>();
        sidecar_state.call(
            &request_for_sidecar_call.runtime_id,
            &request_for_sidecar_call.action_id,
            request_for_sidecar_call.payload_json,
            request_for_sidecar_call.working_directory,
            request_for_sidecar_call.environment,
            request_for_sidecar_call.execution_context.clone(),
        )
    })
    .await
    .map_err(|error| format!("Runtime sidecar call task failed to join: {error}"))?
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

#[tauri::command]
#[specta::specta]
pub async fn extension_host_get_api_schema() -> Result<ExtensionHostApiSchema, String> {
    Ok(build_extension_host_api_schema())
}

#[tauri::command]
#[specta::specta]
pub async fn extension_host_call(
    app: AppHandle,
    registry: State<'_, RuntimeRegistry>,
    request: ExtensionHostCallRequest,
) -> Result<ExtensionHostCallResponse, String> {
    let method_id = request.method_id.clone();
    let result_json = dispatch_extension_host_call(
        app,
        &registry,
        request,
        ExtensionHostDispatchTransport::BrowserIpc,
    )
    .await?;
    Ok(ExtensionHostCallResponse {
        method_id,
        result_json,
    })
}

#[tauri::command]
#[specta::specta]
pub async fn extension_inspect(
    request: ExtensionInspectRequest,
) -> Result<ExtensionInspection, String> {
    let source_path = PathBuf::from(request.path);
    inspect_extension_source(source_path.as_path())
}

#[tauri::command]
#[specta::specta]
pub async fn extension_build(
    request: ExtensionBuildRequest,
) -> Result<ExtensionBuildResult, String> {
    let source_directory = PathBuf::from(&request.source_directory);
    let output_directory = request
        .output_directory
        .clone()
        .map(PathBuf::from)
        .unwrap_or_else(|| source_directory.join(".greeble-build"));
    build_extension_source(
        &source_directory,
        &output_directory,
        request.include_debug_sources,
    )
}

#[tauri::command]
#[specta::specta]
pub async fn extension_pack(request: ExtensionPackRequest) -> Result<ExtensionPackResult, String> {
    let source_directory = PathBuf::from(&request.source_directory);
    let output_path = request
        .output_path
        .clone()
        .map(PathBuf::from)
        .unwrap_or_else(|| resolve_default_bundle_output_path(&source_directory));
    pack_extension_source(
        &source_directory,
        &output_path,
        request.include_debug_sources,
    )
}

#[tauri::command]
#[specta::specta]
pub async fn extension_install(
    app: AppHandle,
    request: ExtensionInstallRequest,
) -> Result<ExtensionInstallResult, String> {
    let managed_root = resolve_managed_content_root(&app)?;
    let install_root = resolve_extension_install_root(&managed_root);
    let bundle_path = PathBuf::from(&request.bundle_path);
    install_extension_bundle_into(
        bundle_path.as_path(),
        &install_root,
        request.replace_existing,
    )
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
    for kain_root in builtin_kain_runtimes_roots(app) {
        if kain_root.exists() {
            roots.push(RuntimeDiscoveryRoot::new(
                BUILTIN_RUNTIMES_ROOT_ID,
                RuntimePackageOrigin::Builtin,
                kain_root,
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

fn runtime_toolchain_context(app: &AppHandle) -> RuntimeToolchainContext {
    RuntimeToolchainContext {
        resource_dir: app.path().resource_dir().ok(),
    }
}

fn repo_python_sidecar_root() -> Option<PathBuf> {
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").ok()?;
    Some(PathBuf::from(manifest_dir).join("../src-python"))
}

fn repo_builtin_runtimes_root() -> Option<PathBuf> {
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").ok()?;
    Some(PathBuf::from(manifest_dir).join(BUILTIN_RUNTIMES_REPO_RELATIVE))
}

fn builtin_kain_runtimes_roots(app: &AppHandle) -> Vec<PathBuf> {
    let mut roots = Vec::new();
    if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
        roots.push(PathBuf::from(manifest_dir).join(BUILTIN_KAIN_RUNTIMES_REPO_RELATIVE));
    }
    if let Ok(resource_dir) = app.path().resource_dir() {
        roots.push(resource_dir.join(BUILTIN_KAIN_RUNTIMES_RESOURCE_RELATIVE));
    }
    roots
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

#[cfg(test)]
mod tests {
    use super::{
        build_runtime_archive_virtual_path, build_runtime_local_breadcrumbs,
        extension_host_repo_command_requires_write, normalize_runtime_archive_entry_path,
        parse_runtime_archive_virtual_path, resolve_extension_context_path,
        resolve_extension_host_working_directory, ExecutionContextSnapshot,
    };

    #[test]
    fn runtime_archive_virtual_paths_round_trip_and_normalize_entries() {
        let built =
            build_runtime_archive_virtual_path(r"C:\assets\shots.zip", r"\nested\frames\hero.png\");
        let parsed =
            parse_runtime_archive_virtual_path(&built).expect("archive virtual path should parse");

        assert_eq!(parsed.archive_path, r"C:\assets\shots.zip");
        assert_eq!(parsed.entry_path, "nested/frames/hero.png");
        assert_eq!(
            normalize_runtime_archive_entry_path(r"\nested\frames\hero.png\"),
            "nested/frames/hero.png",
        );
    }

    #[test]
    fn extension_context_path_prefers_explicit_requested_path() {
        let execution_context = ExecutionContextSnapshot {
            cwd: Some("/workspace/current".to_string()),
            active_directory: Some("/workspace/active".to_string()),
            ..ExecutionContextSnapshot::default()
        };

        assert_eq!(
            resolve_extension_context_path(Some("  /override/path  "), Some(&execution_context)),
            Some("/override/path".to_string()),
        );
        assert_eq!(
            resolve_extension_context_path(None, Some(&execution_context)),
            Some("/workspace/current".to_string()),
        );
    }

    #[test]
    fn extension_host_working_directory_falls_back_to_execution_context_cwd() {
        let execution_context = ExecutionContextSnapshot {
            cwd: Some("/workspace/runtime".to_string()),
            ..ExecutionContextSnapshot::default()
        };

        let resolved = resolve_extension_host_working_directory(None, Some(&execution_context))
            .expect("cwd fallback should resolve");
        assert_eq!(resolved, "/workspace/runtime");

        let error = resolve_extension_host_working_directory(None, None)
            .expect_err("missing cwd should fail");
        assert!(error.contains("working directory"));
    }

    #[test]
    fn repo_command_write_detection_distinguishes_status_from_mutations() {
        assert!(!extension_host_repo_command_requires_write(&[
            String::from("status")
        ]));
        assert!(!extension_host_repo_command_requires_write(&[
            String::from("branch"),
            String::from("--show-current"),
        ]));
        assert!(extension_host_repo_command_requires_write(&[
            String::from("commit"),
            String::from("-m"),
            String::from("ship it"),
        ]));
        assert!(extension_host_repo_command_requires_write(&[
            String::from("branch"),
            String::from("feature/proof"),
        ]));
    }

    #[test]
    fn runtime_local_breadcrumbs_keep_windows_drive_roots_stable() {
        let breadcrumbs = build_runtime_local_breadcrumbs(r"C:\Users\Admin\Projects");
        let labels = breadcrumbs
            .iter()
            .map(|entry| entry.label.as_str())
            .collect::<Vec<_>>();
        assert_eq!(labels, vec![r"C:\\", "Users", "Admin", "Projects"]);
    }
}
