// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::collections::BTreeMap;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use axum::extract::{Path as AxumPath, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::streaming::{resolve_sub_path, stream_file_response};
use super::types::ShareState;

const MOBILE_PLUGIN_MANIFEST_NAMES: &[&str] = &[
    "extension.toml",
    "plugin.json",
    "plugin.toml",
    "manifest.json",
    "manifest.toml",
];
const MOBILE_PLUGIN_BACKEND_DIRECTORY_NAME: &str = "backend";
const MOBILE_PLUGIN_USR_RELATIVE_ROOT: &str = "plugins";
const MOBILE_PLUGIN_ASSET_ROUTE_PREFIX: &str = "/api/plugins";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct MobilePluginCatalogResponse {
    plugin_root: String,
    refreshed_at_ms: u64,
    plugins: Vec<MobilePluginSummary>,
    panes: Vec<MobilePluginPane>,
    warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct MobilePluginSummary {
    id: String,
    manifest_id: String,
    directory_name: String,
    name: String,
    description: String,
    category: String,
    tags: Vec<String>,
    capabilities: MobilePluginCapabilitySummary,
    root_access: MobilePluginRootAccess,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct MobilePluginCapabilitySummary {
    desktop_panel: bool,
    mobile_panes: usize,
    backend_actions: usize,
    themes: usize,
    shaders: usize,
    fonts: usize,
    commands: usize,
    preview_lanes: usize,
    settings_slots: usize,
    context_menu_items: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct MobilePluginRootAccess {
    same_root_as_desktop_plugins: bool,
    usr_relative_root: String,
    plugin_directory_name: String,
    backend_directory_name: String,
    can_run_backend: bool,
    backend_route: String,
    asset_route_prefix: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct MobilePluginPane {
    id: String,
    local_id: String,
    plugin_id: String,
    manifest_id: String,
    plugin_name: String,
    title: String,
    description: String,
    icon_name: String,
    icon_id: String,
    order: i32,
    category: String,
    kind: String,
    renderer: String,
    renderer_url: String,
    styles: Vec<String>,
    style_urls: Vec<String>,
    theme: MobilePluginPaneTheme,
    sections: Vec<MobilePluginPaneSection>,
    actions: Vec<MobilePluginPaneAction>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct MobilePluginPaneTheme {
    accent: String,
    css_vars: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct MobilePluginPaneSection {
    id: String,
    title: String,
    body: String,
    asset_path: String,
    asset_url: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct MobilePluginPaneAction {
    id: String,
    label: String,
    description: String,
    icon_name: String,
    tone: String,
    kind: String,
    href: String,
    copy_text: String,
    backend: Option<MobilePluginPaneBackendAction>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct MobilePluginPaneBackendAction {
    entry: String,
    args: Vec<String>,
    success_message: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct MobilePluginBackendRunRequest {
    entry: String,
    args: Option<Vec<String>>,
    context_path: Option<String>,
    pane_id: Option<String>,
    action_id: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct MobilePluginBackendRunResponse {
    plugin_id: String,
    entry: String,
    context_path: String,
    context_absolute_path: String,
    pane_id: String,
    action_id: String,
    stdout: String,
    stderr: String,
    status: i32,
}

struct ParsedMobilePluginManifest {
    summary: MobilePluginSummary,
    panes: Vec<MobilePluginPane>,
    warnings: Vec<String>,
}

struct ResolvedMobilePluginContext {
    absolute_path: PathBuf,
    relative_path: String,
}

pub(super) async fn mobile_plugin_catalog_handler(State(state): State<ShareState>) -> Response {
    match build_mobile_plugin_catalog(&state) {
        Ok(catalog) => (StatusCode::OK, Json(catalog)).into_response(),
        Err(error) => (StatusCode::INTERNAL_SERVER_ERROR, error).into_response(),
    }
}

pub(super) async fn mobile_plugin_backend_handler(
    State(state): State<ShareState>,
    AxumPath(plugin_id): AxumPath<String>,
    Json(request): Json<MobilePluginBackendRunRequest>,
) -> Response {
    let plugin_route_id = match normalize_safe_path_segment(&plugin_id) {
        Some(value) => value,
        None => return (StatusCode::BAD_REQUEST, "Invalid plugin id").into_response(),
    };
    let backend_entry = match normalize_safe_relative_path(&request.entry) {
        Some(value) => value,
        None => return (StatusCode::BAD_REQUEST, "Invalid backend entry").into_response(),
    };

    let plugins_root = match resolve_mobile_plugins_root(&state) {
        Ok(path) => path,
        Err(error) => return (StatusCode::INTERNAL_SERVER_ERROR, error).into_response(),
    };
    if !plugins_root.join(&plugin_route_id).exists() {
        return (StatusCode::NOT_FOUND, "Plugin not found").into_response();
    }

    let context = match resolve_mobile_plugin_context(&state, request.context_path.as_deref()) {
        Ok(context) => context,
        Err(status) => return (status, "Invalid plugin context path").into_response(),
    };
    let template_values = build_backend_template_values(
        &state,
        &plugin_route_id,
        &context.relative_path,
        &context.absolute_path,
        request.pane_id.as_deref().unwrap_or_default(),
        request.action_id.as_deref().unwrap_or_default(),
    );
    let resolved_args = request
        .args
        .unwrap_or_default()
        .into_iter()
        .map(|arg| replace_mobile_plugin_template_tokens(&arg, &template_values))
        .collect::<Vec<_>>();

    let result = match crate::plugin_commands::plugin_run_backend(
        state.app_handle.clone(),
        plugins_root.to_string_lossy().into_owned(),
        plugin_route_id.clone(),
        backend_entry.clone(),
        resolved_args,
    )
    .await
    {
        Ok(result) => result,
        Err(error) => return (StatusCode::BAD_REQUEST, error).into_response(),
    };

    let response = MobilePluginBackendRunResponse {
        plugin_id: plugin_route_id,
        entry: backend_entry,
        context_path: context.relative_path,
        context_absolute_path: context.absolute_path.to_string_lossy().into_owned(),
        pane_id: request.pane_id.unwrap_or_default(),
        action_id: request.action_id.unwrap_or_default(),
        stdout: result.stdout,
        stderr: result.stderr,
        status: result.status,
    };
    (StatusCode::OK, Json(response)).into_response()
}

pub(super) async fn mobile_plugin_asset_handler(
    State(state): State<ShareState>,
    AxumPath((plugin_id, asset_path)): AxumPath<(String, String)>,
    headers: HeaderMap,
) -> Response {
    let plugin_route_id = match normalize_safe_path_segment(&plugin_id) {
        Some(value) => value,
        None => return (StatusCode::BAD_REQUEST, "Invalid plugin id").into_response(),
    };
    let safe_asset_path = match normalize_safe_relative_path(&asset_path) {
        Some(value) => value,
        None => return (StatusCode::BAD_REQUEST, "Invalid asset path").into_response(),
    };
    let plugins_root = match resolve_mobile_plugins_root(&state) {
        Ok(path) => path,
        Err(error) => return (StatusCode::INTERNAL_SERVER_ERROR, error).into_response(),
    };

    let plugin_dir = plugins_root.join(&plugin_route_id);
    let canonical_plugin_dir = match fs::canonicalize(&plugin_dir) {
        Ok(path) => path,
        Err(_) => return (StatusCode::NOT_FOUND, "Plugin not found").into_response(),
    };
    let candidate = plugin_dir.join(&safe_asset_path);
    let canonical_asset = match fs::canonicalize(&candidate) {
        Ok(path) => path,
        Err(_) => return (StatusCode::NOT_FOUND, "Plugin asset not found").into_response(),
    };

    if !canonical_asset.starts_with(&canonical_plugin_dir) || !canonical_asset.is_file() {
        return (
            StatusCode::FORBIDDEN,
            "Plugin asset must stay inside the plugin",
        )
            .into_response();
    }

    stream_file_response(&canonical_asset, &headers).await
}

fn build_mobile_plugin_catalog(state: &ShareState) -> Result<MobilePluginCatalogResponse, String> {
    let plugins_root = resolve_mobile_plugins_root(state)?;
    let plugin_root_display = plugins_root.to_string_lossy().into_owned();
    let mut warnings = Vec::new();
    let mut plugins = Vec::new();
    let mut panes = Vec::new();

    let directory_entries = fs::read_dir(&plugins_root)
        .map_err(|error| format!("Failed to read mobile plugin root: {error}"))?;
    for directory_entry in directory_entries {
        let directory_entry = match directory_entry {
            Ok(value) => value,
            Err(error) => {
                warnings.push(format!("Failed to read plugin directory entry: {error}"));
                continue;
            }
        };
        let plugin_dir = directory_entry.path();
        if !plugin_dir.is_dir() {
            continue;
        }

        let directory_name = directory_entry.file_name().to_string_lossy().into_owned();
        let Some(plugin_route_id) = normalize_safe_path_segment(&directory_name) else {
            warnings.push(format!(
                "Skipped mobile plugin directory with unsafe name: {directory_name}"
            ));
            continue;
        };
        let Some(manifest_path) = find_mobile_plugin_manifest(&plugin_dir) else {
            continue;
        };

        match parse_mobile_plugin_manifest(&plugin_route_id, &manifest_path) {
            Ok(parsed) => {
                warnings.extend(parsed.warnings);
                panes.extend(parsed.panes);
                plugins.push(parsed.summary);
            }
            Err(error) => {
                warnings.push(format!(
                    "Failed to parse mobile plugin manifest '{}': {error}",
                    manifest_path.display()
                ));
            }
        }
    }

    plugins.sort_by(|left, right| left.name.cmp(&right.name).then(left.id.cmp(&right.id)));
    panes.sort_by(|left, right| {
        left.order
            .cmp(&right.order)
            .then(left.title.cmp(&right.title))
            .then(left.id.cmp(&right.id))
    });

    Ok(MobilePluginCatalogResponse {
        plugin_root: plugin_root_display,
        refreshed_at_ms: now_ms(),
        plugins,
        panes,
        warnings,
    })
}

fn parse_mobile_plugin_manifest(
    plugin_route_id: &str,
    manifest_path: &Path,
) -> Result<ParsedMobilePluginManifest, String> {
    let manifest_value = read_manifest_as_json_value(manifest_path)?;
    let manifest_id =
        as_string(manifest_value.get("id")).unwrap_or_else(|| plugin_route_id.to_string());
    let plugin_name = as_string(manifest_value.get("name"))
        .or_else(|| as_string(manifest_value.get("displayName")))
        .unwrap_or_else(|| derive_display_name(plugin_route_id));
    let description = as_string(manifest_value.get("description")).unwrap_or_default();
    let category =
        as_string(manifest_value.get("category")).unwrap_or_else(|| "Plugins".to_string());
    let tags = as_string_array(manifest_value.get("tags"));
    let contributions = manifest_value.get("contributions");
    let mobile_pane_values = as_array(contributions.and_then(|value| value.get("mobilePanes")));
    let mobile_panes = mobile_pane_values
        .iter()
        .enumerate()
        .filter_map(|(index, value)| {
            normalize_mobile_plugin_pane(
                plugin_route_id,
                &manifest_id,
                &plugin_name,
                &category,
                index,
                value,
            )
        })
        .collect::<Vec<_>>();
    let backend_action_count = mobile_panes
        .iter()
        .map(|pane| {
            pane.actions
                .iter()
                .filter(|action| action.backend.is_some())
                .count()
        })
        .sum();
    let can_run_backend = manifest_path
        .parent()
        .map(|plugin_dir| {
            plugin_dir
                .join(MOBILE_PLUGIN_BACKEND_DIRECTORY_NAME)
                .is_dir()
        })
        .unwrap_or(false);

    let root_access = MobilePluginRootAccess {
        same_root_as_desktop_plugins: true,
        usr_relative_root: MOBILE_PLUGIN_USR_RELATIVE_ROOT.to_string(),
        plugin_directory_name: plugin_route_id.to_string(),
        backend_directory_name: MOBILE_PLUGIN_BACKEND_DIRECTORY_NAME.to_string(),
        can_run_backend,
        backend_route: format!("/api/plugins/{plugin_route_id}/backend"),
        asset_route_prefix: format!("/api/plugins/{plugin_route_id}/assets"),
    };
    let summary = MobilePluginSummary {
        id: plugin_route_id.to_string(),
        manifest_id,
        directory_name: plugin_route_id.to_string(),
        name: plugin_name,
        description,
        category,
        tags,
        capabilities: MobilePluginCapabilitySummary {
            desktop_panel: as_string(manifest_value.get("entry")).is_some(),
            mobile_panes: mobile_panes.len(),
            backend_actions: backend_action_count,
            themes: as_array(contributions.and_then(|value| value.get("themes"))).len(),
            shaders: as_array(contributions.and_then(|value| value.get("shaders"))).len(),
            fonts: as_array(contributions.and_then(|value| value.get("fonts"))).len(),
            commands: as_array(contributions.and_then(|value| value.get("commands"))).len(),
            preview_lanes: as_array(contributions.and_then(|value| value.get("previewLanes")))
                .len(),
            settings_slots: as_array(contributions.and_then(|value| value.get("settingsSlots")))
                .len(),
            context_menu_items: as_array(
                contributions.and_then(|value| value.get("contextMenuItems")),
            )
            .len(),
        },
        root_access,
    };

    Ok(ParsedMobilePluginManifest {
        summary,
        panes: mobile_panes,
        warnings: Vec::new(),
    })
}

fn normalize_mobile_plugin_pane(
    plugin_route_id: &str,
    manifest_id: &str,
    plugin_name: &str,
    fallback_category: &str,
    index: usize,
    value: &Value,
) -> Option<MobilePluginPane> {
    let record = value.as_object()?;
    let title = as_string(record.get("title"))
        .or_else(|| as_string(record.get("name")))
        .unwrap_or_else(|| format!("{} Mobile", plugin_name));
    let local_id = as_string(record.get("id"))
        .and_then(|id| normalize_safe_id(&id))
        .unwrap_or_else(|| derive_safe_id(&title, &format!("pane-{index}")));
    let pane_id = format!("{plugin_route_id}.mobile-pane.{local_id}");
    let description = as_string(record.get("description")).unwrap_or_default();
    let icon_name = as_string(record.get("iconName"))
        .or_else(|| as_string(record.get("icon")))
        .unwrap_or_else(|| "Puzzle".to_string());
    let icon_id = as_string(record.get("iconId")).unwrap_or_default();
    let order = as_i32(record.get("order")).unwrap_or((index as i32) * 10 + 200);
    let category =
        as_string(record.get("category")).unwrap_or_else(|| fallback_category.to_string());
    let kind = normalize_pane_kind(as_string(record.get("kind")).as_deref());
    let renderer = as_string(record.get("renderer"))
        .or_else(|| as_string(record.get("rendererEntry")))
        .and_then(|path| normalize_safe_relative_path(&path))
        .unwrap_or_default();
    let renderer_url = if renderer.is_empty() {
        String::new()
    } else {
        build_mobile_plugin_asset_url(plugin_route_id, &renderer)
    };
    let styles = as_string_array(record.get("styles"))
        .into_iter()
        .filter_map(|path| normalize_safe_relative_path(&path))
        .collect::<Vec<_>>();
    let style_urls = styles
        .iter()
        .map(|path| build_mobile_plugin_asset_url(plugin_route_id, path))
        .collect::<Vec<_>>();
    let theme = normalize_mobile_plugin_pane_theme(record.get("theme"));
    let sections = as_array(record.get("sections"))
        .iter()
        .enumerate()
        .filter_map(|(section_index, section)| {
            normalize_mobile_plugin_pane_section(plugin_route_id, section_index, section)
        })
        .collect::<Vec<_>>();
    let actions = as_array(record.get("actions"))
        .iter()
        .enumerate()
        .filter_map(|(action_index, action)| {
            normalize_mobile_plugin_pane_action(action_index, action)
        })
        .collect::<Vec<_>>();

    Some(MobilePluginPane {
        id: pane_id,
        local_id,
        plugin_id: plugin_route_id.to_string(),
        manifest_id: manifest_id.to_string(),
        plugin_name: plugin_name.to_string(),
        title,
        description,
        icon_name,
        icon_id,
        order,
        category,
        kind,
        renderer,
        renderer_url,
        styles,
        style_urls,
        theme,
        sections,
        actions,
    })
}

fn normalize_mobile_plugin_pane_theme(value: Option<&Value>) -> MobilePluginPaneTheme {
    let record = value.and_then(Value::as_object);
    let accent = record
        .and_then(|theme| as_string(theme.get("accent")))
        .unwrap_or_default();
    let css_vars = record
        .and_then(|theme| theme.get("cssVars"))
        .and_then(Value::as_object)
        .map(|entries| {
            entries
                .iter()
                .filter_map(|(key, value)| {
                    let normalized_key = key.trim();
                    if !normalized_key.starts_with("--") {
                        return None;
                    }
                    as_string(Some(value)).map(|css_value| (normalized_key.to_string(), css_value))
                })
                .collect::<BTreeMap<_, _>>()
        })
        .unwrap_or_default();

    MobilePluginPaneTheme { accent, css_vars }
}

fn normalize_mobile_plugin_pane_section(
    plugin_route_id: &str,
    index: usize,
    value: &Value,
) -> Option<MobilePluginPaneSection> {
    let record = value.as_object()?;
    let title = as_string(record.get("title")).unwrap_or_else(|| format!("Section {}", index + 1));
    let id = as_string(record.get("id"))
        .and_then(|id| normalize_safe_id(&id))
        .unwrap_or_else(|| derive_safe_id(&title, &format!("section-{index}")));
    let body = as_string(record.get("body"))
        .or_else(|| as_string(record.get("description")))
        .unwrap_or_default();
    let asset_path = as_string(record.get("assetPath"))
        .and_then(|path| normalize_safe_relative_path(&path))
        .unwrap_or_default();
    let asset_url = if asset_path.is_empty() {
        String::new()
    } else {
        build_mobile_plugin_asset_url(plugin_route_id, &asset_path)
    };

    Some(MobilePluginPaneSection {
        id,
        title,
        body,
        asset_path,
        asset_url,
    })
}

fn normalize_mobile_plugin_pane_action(
    index: usize,
    value: &Value,
) -> Option<MobilePluginPaneAction> {
    let record = value.as_object()?;
    let label = as_string(record.get("label"))
        .or_else(|| as_string(record.get("title")))
        .unwrap_or_else(|| format!("Action {}", index + 1));
    let id = as_string(record.get("id"))
        .and_then(|id| normalize_safe_id(&id))
        .unwrap_or_else(|| derive_safe_id(&label, &format!("action-{index}")));
    let backend_record = record.get("backend").and_then(Value::as_object);
    let backend_entry = backend_record.and_then(|backend| as_string(backend.get("entry")));
    let kind = normalize_action_kind(
        as_string(record.get("kind")).as_deref(),
        backend_entry.as_deref(),
    );
    let backend = backend_entry
        .and_then(|entry| normalize_safe_relative_path(&entry))
        .map(|entry| MobilePluginPaneBackendAction {
            entry,
            args: as_string_array(backend_record.and_then(|backend| backend.get("args"))),
            success_message: backend_record
                .and_then(|backend| as_string(backend.get("successMessage")))
                .unwrap_or_else(|| "Plugin action finished.".to_string()),
        });

    Some(MobilePluginPaneAction {
        id,
        label,
        description: as_string(record.get("description")).unwrap_or_default(),
        icon_name: as_string(record.get("iconName"))
            .or_else(|| as_string(record.get("icon")))
            .unwrap_or_else(|| match kind.as_str() {
                "backend" => "Play".to_string(),
                "link" => "ExternalLink".to_string(),
                "copy" => "Copy".to_string(),
                _ => "Puzzle".to_string(),
            }),
        tone: normalize_action_tone(as_string(record.get("tone")).as_deref()),
        kind,
        href: as_string(record.get("href")).unwrap_or_default(),
        copy_text: as_string(record.get("copyText")).unwrap_or_default(),
        backend,
    })
}

fn read_manifest_as_json_value(path: &Path) -> Result<Value, String> {
    let text = fs::read_to_string(path)
        .map_err(|error| format!("Failed to read manifest '{}': {error}", path.display()))?;
    let extension = path
        .extension()
        .map(|value| value.to_string_lossy().to_ascii_lowercase())
        .unwrap_or_default();

    if extension == "json" {
        serde_json::from_str(&text)
            .map_err(|error| format!("Failed to parse JSON manifest: {error}"))
    } else {
        let value = toml::from_str::<toml::Value>(&text)
            .map_err(|error| format!("Failed to parse TOML manifest: {error}"))?;
        serde_json::to_value(value)
            .map_err(|error| format!("Failed to normalize manifest: {error}"))
    }
}

fn find_mobile_plugin_manifest(plugin_dir: &Path) -> Option<PathBuf> {
    MOBILE_PLUGIN_MANIFEST_NAMES
        .iter()
        .map(|name| plugin_dir.join(name))
        .find(|path| path.is_file())
}

fn resolve_mobile_plugins_root(state: &ShareState) -> Result<PathBuf, String> {
    crate::usr::resolve_usr_relative_path(&state.app_handle, MOBILE_PLUGIN_USR_RELATIVE_ROOT)
}

fn resolve_mobile_plugin_context(
    state: &ShareState,
    context_path: Option<&str>,
) -> Result<ResolvedMobilePluginContext, StatusCode> {
    if let Some(hub) = &state.file_hub {
        let index = context_path
            .unwrap_or_default()
            .trim()
            .parse::<usize>()
            .unwrap_or(0);
        let target = hub.get(index).ok_or(StatusCode::NOT_FOUND)?;
        return Ok(ResolvedMobilePluginContext {
            absolute_path: target.clone(),
            relative_path: index.to_string(),
        });
    }

    let relative_path = context_path.unwrap_or_default().trim();
    let absolute_path = resolve_sub_path(&state.share_path, Some(relative_path))?;
    let normalized_relative_path = compute_relative_path(&state.share_path, &absolute_path);
    Ok(ResolvedMobilePluginContext {
        absolute_path,
        relative_path: normalized_relative_path,
    })
}

fn compute_relative_path(base: &Path, path: &Path) -> String {
    path.strip_prefix(base)
        .ok()
        .map(|relative| {
            relative
                .components()
                .filter_map(|component| match component {
                    Component::Normal(segment) => Some(segment.to_string_lossy().into_owned()),
                    _ => None,
                })
                .collect::<Vec<_>>()
                .join("/")
        })
        .unwrap_or_default()
}

fn build_backend_template_values(
    state: &ShareState,
    plugin_route_id: &str,
    context_path: &str,
    context_absolute_path: &Path,
    pane_id: &str,
    action_id: &str,
) -> BTreeMap<String, String> {
    BTreeMap::from([
        ("{actionId}".to_string(), action_id.to_string()),
        (
            "{contextAbsolutePath}".to_string(),
            context_absolute_path.to_string_lossy().into_owned(),
        ),
        ("{contextPath}".to_string(), context_path.to_string()),
        (
            "{currentAbsolutePath}".to_string(),
            context_absolute_path.to_string_lossy().into_owned(),
        ),
        ("{currentPath}".to_string(), context_path.to_string()),
        ("{paneId}".to_string(), pane_id.to_string()),
        ("{path}".to_string(), context_path.to_string()),
        ("{pluginId}".to_string(), plugin_route_id.to_string()),
        (
            "{shareRoot}".to_string(),
            state.share_path.to_string_lossy().into_owned(),
        ),
    ])
}

fn replace_mobile_plugin_template_tokens(
    value: &str,
    replacements: &BTreeMap<String, String>,
) -> String {
    replacements
        .iter()
        .fold(value.to_string(), |current, (token, replacement)| {
            current.replace(token, replacement)
        })
}

fn build_mobile_plugin_asset_url(plugin_route_id: &str, asset_path: &str) -> String {
    format!(
        "{MOBILE_PLUGIN_ASSET_ROUTE_PREFIX}/{}/assets/{}",
        urlencoding::encode(plugin_route_id),
        encode_relative_path(asset_path)
    )
}

fn encode_relative_path(path: &str) -> String {
    path.split('/')
        .filter(|segment| !segment.is_empty())
        .map(urlencoding::encode)
        .collect::<Vec<_>>()
        .join("/")
}

fn normalize_safe_path_segment(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty()
        || trimmed == "."
        || trimmed == ".."
        || trimmed.contains('/')
        || trimmed.contains('\\')
        || trimmed.contains(':')
    {
        return None;
    }
    Some(trimmed.to_string())
}

fn normalize_safe_relative_path(value: &str) -> Option<String> {
    let normalized = value.trim().replace('\\', "/");
    if normalized.is_empty()
        || normalized.starts_with('/')
        || normalized.contains(':')
        || normalized
            .split('/')
            .any(|segment| segment.is_empty() || segment == "." || segment == "..")
    {
        return None;
    }
    Some(normalized)
}

fn normalize_safe_id(value: &str) -> Option<String> {
    let normalized = derive_safe_id(value, "");
    if normalized.is_empty() {
        None
    } else {
        Some(normalized)
    }
}

fn derive_safe_id(value: &str, fallback: &str) -> String {
    let mut output = String::new();
    let mut last_dash = false;
    for character in value.chars() {
        let normalized = character.to_ascii_lowercase();
        if normalized.is_ascii_alphanumeric() {
            output.push(normalized);
            last_dash = false;
        } else if !last_dash {
            output.push('-');
            last_dash = true;
        }
    }
    let output = output.trim_matches('-').to_string();
    if output.is_empty() {
        fallback.to_string()
    } else {
        output
    }
}

fn derive_display_name(value: &str) -> String {
    value
        .replace('-', " ")
        .replace('_', " ")
        .split_whitespace()
        .map(|part| {
            let mut chars = part.chars();
            match chars.next() {
                Some(first) => format!("{}{}", first.to_uppercase(), chars.as_str()),
                None => String::new(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn normalize_pane_kind(value: Option<&str>) -> String {
    match value.unwrap_or_default() {
        "dashboard" | "tool" | "inspector" | "viewer" => value.unwrap_or_default().to_string(),
        _ => "dashboard".to_string(),
    }
}

fn normalize_action_kind(value: Option<&str>, backend_entry: Option<&str>) -> String {
    match value.unwrap_or_default() {
        "backend" | "link" | "copy" => value.unwrap_or_default().to_string(),
        _ if backend_entry.is_some() => "backend".to_string(),
        _ => "link".to_string(),
    }
}

fn normalize_action_tone(value: Option<&str>) -> String {
    match value.unwrap_or_default() {
        "accent" | "danger" | "success" | "warning" => value.unwrap_or_default().to_string(),
        _ => "neutral".to_string(),
    }
}

fn as_array(value: Option<&Value>) -> Vec<Value> {
    value.and_then(Value::as_array).cloned().unwrap_or_default()
}

fn as_string(value: Option<&Value>) -> Option<String> {
    value
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn as_string_array(value: Option<&Value>) -> Vec<String> {
    value
        .and_then(Value::as_array)
        .map(|entries| {
            entries
                .iter()
                .filter_map(|entry| as_string(Some(entry)))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default()
}

fn as_i32(value: Option<&Value>) -> Option<i32> {
    value
        .and_then(Value::as_i64)
        .and_then(|value| i32::try_from(value).ok())
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().min(u128::from(u64::MAX)) as u64)
        .unwrap_or_default()
}
