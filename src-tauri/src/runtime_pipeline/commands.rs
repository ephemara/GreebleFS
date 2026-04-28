//! Tauri/Specta command surface for the universal runtime pipeline.
//!
//! These commands form the `runtime-host-v1` bridge. The frontend's
//! `externalRuntimeBackend.ts` is the canonical TS consumer, and the
//! `goRuntimeBackend.ts` convenience layer composes them into Go-flavored
//! ergonomics on top.

use std::collections::HashMap;
use std::path::PathBuf;
use std::process::{Command as ProcessCommand, Stdio};
use std::thread;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};
use url::Url;

use crate::cloud_commands::{cloud_list_dir, cloud_open_file, CloudRuntimeState};
use crate::explorer_identity::{
    build_content_revision, build_virtual_identity, ExplorerIdentityManager,
};
use crate::fs_commands::{
    fs_list_archive_dir, fs_list_dir, fs_open_file, fs_read_text_file, fs_write_file, git_exec,
    FileEntry, FsWriteFileContent,
};
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
    ExtensionHostApiSchema, ExtensionInspection, ExtensionInstallResult, ExtensionPackResult,
};
use crate::runtime_pipeline::manifest::{RuntimeCompiler, RuntimeKind, RuntimePackagePermissions};
use crate::runtime_pipeline::registry::RuntimeRegistry;
use crate::runtime_pipeline::sidecar::{
    ExternalRuntimeSidecarCallResponse, ExternalRuntimeSidecarStatus, ExternalSidecarManager,
};
use crate::runtime_pipeline::toolchain::{probe_runtime_toolchains, RuntimeToolchainStatus};
use crate::runtime_pipeline::tui::{build_tui_launch, ExternalRuntimeTuiLaunch};
use crate::terminal::ExternalTerminalRequest;
use crate::usr::resolve_managed_content_root;

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
    let Some(caller_label) = caller_label else {
        return Err(format!(
            "Extension host method requires caller identity and permission `{}`.",
            permission_label
        ));
    };
    let Some(permissions) = permissions else {
        return Err(format!(
            "Extension host method caller {} has no resolved permissions for `{}`.",
            caller_label, permission_label
        ));
    };
    if check(permissions) {
        Ok(())
    } else {
        Err(format!(
            "Extension host caller {} does not declare required permission `{}`.",
            caller_label, permission_label
        ))
    }
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
    let working_directory = request
        .working_directory
        .clone()
        .or_else(|| execution_context.and_then(|context| context.cwd.clone()))
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| {
            "tasks.run_command requires a working directory or execution context cwd.".to_string()
        })?;
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
        "selection.get_snapshot" => {
            encode_runtime_host_bridge_result(&request.execution_context.unwrap_or_default())
        }
        "preview.get_session" => {
            let preview_session: Option<ExecutionContextPreviewSession> = request
                .execution_context
                .as_ref()
                .and_then(|context| context.preview_session.clone());
            encode_runtime_host_bridge_result(&preview_session)
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
            let content = fs_read_text_file(payload.path).await?;
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

fn dispatch_runtime_sidecar_host_call(
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

    let request_for_sidecar_call = request.clone();
    let app_for_sidecar_call = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let sidecar_state = app_for_sidecar_call.state::<ExternalSidecarManager>();
        let runtime_registry = app_for_sidecar_call.state::<RuntimeRegistry>();
        let sidecar_execution_context = request_for_sidecar_call.execution_context.clone();
        sidecar_state.call(
            &request_for_sidecar_call.runtime_id,
            &request_for_sidecar_call.action_id,
            request_for_sidecar_call.payload_json,
            request_for_sidecar_call.working_directory,
            request_for_sidecar_call.environment,
            |runtime_id, method_id, payload_json| {
                dispatch_runtime_sidecar_host_call(
                    &app_for_sidecar_call,
                    &runtime_registry,
                    runtime_id,
                    method_id,
                    payload_json,
                    sidecar_execution_context.clone(),
                )
            },
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
    let result_json = dispatch_extension_host_call(app, &registry, request).await?;
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
