// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::path::{Component, Path, PathBuf};
use std::time::UNIX_EPOCH;

use axum::body::Body;
use axum::extract::{Path as AxumPath, Query, State};
use axum::http::{header, StatusCode};
use axum::response::{Html, IntoResponse, Response};
use axum::routing::get;
use axum::Router;
use serde::{Deserialize, Serialize};
use tauri::Manager;

use super::streaming::{resolve_sub_path, share_root_label, stream_file_response};
use super::types::{APP_ICON_PNG, APPLE_TOUCH_ICON_PNG, ShareState};

const MOBILE_DEFAULT_PAGE_SIZE: usize = 160;
const MOBILE_MAX_PAGE_SIZE: usize = 320;

#[derive(Deserialize)]
struct MobileListQuery {
    path: Option<String>,
    offset: Option<usize>,
    limit: Option<usize>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MobileEntryInfo {
    name: String,
    relative_path: String,
    is_dir: bool,
    size: u64,
    extension: String,
    mime_type: Option<String>,
    modified_ms: Option<u64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MobileListResponse {
    current_path: String,
    can_go_up: bool,
    share_name: String,
    hub_mode: bool,
    total_count: usize,
    offset: usize,
    limit: usize,
    next_offset: Option<usize>,
    entries: Vec<MobileEntryInfo>,
}

pub(super) fn build_mobile_router(state: ShareState) -> Router {
    Router::new()
        .route("/api/list", get(mobile_list_handler))
        .route("/files/{*path}", get(mobile_file_handler))
        .route("/app-icon.png", get(app_icon_handler))
        .route("/apple-touch-icon.png", get(apple_touch_icon_handler))
        .route("/", get(mobile_index_handler))
        .route("/{*path}", get(mobile_spa_handler))
        .with_state(state)
}

async fn app_icon_handler() -> Response {
    build_icon_response(APP_ICON_PNG)
}

async fn apple_touch_icon_handler() -> Response {
    build_icon_response(APPLE_TOUCH_ICON_PNG)
}

fn build_icon_response(bytes: &'static [u8]) -> Response {
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "image/png")
        .header(header::CACHE_CONTROL, "public, max-age=86400")
        .body(Body::from(bytes))
        .unwrap_or_else(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to build icon response",
            )
                .into_response()
        })
}

async fn mobile_index_handler(State(state): State<ShareState>) -> Response {
    serve_mobile_bundle_asset(&state.app_handle, "index.html", false).await
}

async fn mobile_spa_handler(
    State(state): State<ShareState>,
    AxumPath(requested_path): AxumPath<String>,
) -> Response {
    let normalized_requested_path = requested_path.trim_start_matches('/');

    if normalized_requested_path.is_empty() {
        return serve_mobile_bundle_asset(&state.app_handle, "index.html", false).await;
    }

    if resolve_mobile_bundle_path(&state.app_handle, normalized_requested_path).is_some() {
        let cache_immutable = normalized_requested_path.starts_with("assets/");
        return serve_mobile_bundle_asset(
            &state.app_handle,
            normalized_requested_path,
            cache_immutable,
        )
        .await;
    }

    if Path::new(normalized_requested_path).extension().is_none() {
        return serve_mobile_bundle_asset(&state.app_handle, "index.html", false).await;
    }

    if mobile_bundle_root_exists(&state.app_handle) {
        return (StatusCode::NOT_FOUND, "Mobile asset not found").into_response();
    }

    mobile_bundle_missing_response()
}

async fn serve_mobile_bundle_asset(
    app_handle: &tauri::AppHandle,
    relative_path: &str,
    cache_immutable: bool,
) -> Response {
    let Some(asset_path) = resolve_mobile_bundle_path(app_handle, relative_path) else {
        return mobile_bundle_missing_response();
    };

    let bytes = match tokio::fs::read(&asset_path).await {
        Ok(bytes) => bytes,
        Err(error) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!(
                    "Failed to read mobile asset '{}': {error}",
                    asset_path.display()
                ),
            )
                .into_response()
        }
    };

    let cache_header = if cache_immutable {
        "public, max-age=31536000, immutable"
    } else {
        "no-cache"
    };
    let content_type = mime_guess::from_path(&asset_path)
        .first_raw()
        .unwrap_or("application/octet-stream");

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, content_type)
        .header(header::CACHE_CONTROL, cache_header)
        .body(Body::from(bytes))
        .unwrap_or_else(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to build mobile asset response",
            )
                .into_response()
        })
}

fn mobile_bundle_missing_response() -> Response {
    Html(
        "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><title>GreebleFS Mobile Bundle Missing</title><style>body{font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif;background:#081019;color:#e7f1ff;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px}main{max-width:540px;padding:24px;border:1px solid rgba(121,214,255,.2);border-radius:18px;background:rgba(7,18,28,.92)}code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#79d6ff}</style></head><body><main><h1>GreebleFS mobile bundle is not built</h1><p>Run <code>bun run build:mobile</code> from the repository root, then start the mobile share again.</p></main></body></html>"
            .to_string(),
    )
    .into_response()
}

fn mobile_bundle_root_exists(app_handle: &tauri::AppHandle) -> bool {
    mobile_bundle_root_candidates(app_handle)
        .into_iter()
        .any(|candidate| candidate.is_dir())
}

fn mobile_bundle_root_candidates(app_handle: &tauri::AppHandle) -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    if let Ok(resource_dir) = app_handle.path().resource_dir() {
        candidates.push(resource_dir.join("mobile-dist"));
    }

    candidates.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../dist-mobile"));
    candidates
}

fn resolve_mobile_bundle_path(
    app_handle: &tauri::AppHandle,
    relative_path: &str,
) -> Option<PathBuf> {
    let requested_path = Path::new(relative_path);
    if requested_path.is_absolute() {
        return None;
    }
    if requested_path
        .components()
        .any(|component| matches!(component, Component::ParentDir))
    {
        return None;
    }

    for root in mobile_bundle_root_candidates(app_handle) {
        let candidate = root.join(requested_path);
        if candidate.is_file() {
            return Some(candidate);
        }
    }

    None
}

async fn mobile_list_handler(
    State(state): State<ShareState>,
    Query(query): Query<MobileListQuery>,
) -> Response {
    if state.file_hub.is_some() {
        return mobile_hub_list_response(&state, &query);
    }

    let target = match resolve_sub_path(&state.share_path, query.path.as_deref()) {
        Ok(path) => path,
        Err(status) => return (status, "Invalid path").into_response(),
    };

    if !target.is_dir() {
        return (StatusCode::BAD_REQUEST, "Not a directory").into_response();
    }

    let offset = query.offset.unwrap_or(0);
    let limit = query
        .limit
        .unwrap_or(MOBILE_DEFAULT_PAGE_SIZE)
        .clamp(1, MOBILE_MAX_PAGE_SIZE);

    let current_relative_path = compute_relative_path(&state.share_path, &target);

    let mut entries: Vec<MobileEntryInfo> = match std::fs::read_dir(&target) {
        Ok(read_dir) => read_dir
            .flatten()
            .filter_map(|entry| build_mobile_entry_from_dir(&current_relative_path, entry))
            .collect(),
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to read directory",
            )
                .into_response()
        }
    };

    entries.sort_by(|left, right| {
        right
            .is_dir
            .cmp(&left.is_dir)
            .then_with(|| left.name.to_lowercase().cmp(&right.name.to_lowercase()))
    });

    build_mobile_list_response(
        &state.share_path,
        &current_relative_path,
        false,
        offset,
        limit,
        entries,
    )
}

fn mobile_hub_list_response(state: &ShareState, query: &MobileListQuery) -> Response {
    if query
        .path
        .as_deref()
        .map(|path| !path.is_empty())
        .unwrap_or(false)
    {
        return (StatusCode::BAD_REQUEST, "Invalid hub path").into_response();
    }

    let offset = query.offset.unwrap_or(0);
    let limit = query
        .limit
        .unwrap_or(MOBILE_DEFAULT_PAGE_SIZE)
        .clamp(1, MOBILE_MAX_PAGE_SIZE);

    let hub = state.file_hub.as_ref().expect("hub mode checked above");
    let mut entries = Vec::new();
    for (index, path) in hub.iter().enumerate() {
        let metadata = match std::fs::metadata(path) {
            Ok(metadata) => metadata,
            Err(_) => continue,
        };
        let name = path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        entries.push(MobileEntryInfo {
            name: name.clone(),
            relative_path: index.to_string(),
            is_dir: false,
            size: metadata.len(),
            extension: normalized_extension_from_name(&name),
            mime_type: mime_guess::from_path(path).first_raw().map(str::to_string),
            modified_ms: metadata_modified_ms(&metadata),
        });
    }

    entries.sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));

    build_mobile_list_response(&state.share_path, "", true, offset, limit, entries)
}

fn build_mobile_list_response(
    share_path: &Path,
    current_relative_path: &str,
    hub_mode: bool,
    offset: usize,
    limit: usize,
    entries: Vec<MobileEntryInfo>,
) -> Response {
    let total_count = entries.len();
    let safe_offset = offset.min(total_count);
    let paged_entries = entries
        .into_iter()
        .skip(safe_offset)
        .take(limit)
        .collect::<Vec<_>>();
    let next_offset = if safe_offset + paged_entries.len() < total_count {
        Some(safe_offset + paged_entries.len())
    } else {
        None
    };

    let response = MobileListResponse {
        current_path: current_relative_path.to_string(),
        can_go_up: !hub_mode && !current_relative_path.is_empty(),
        share_name: share_root_label(share_path),
        hub_mode,
        total_count,
        offset: safe_offset,
        limit,
        next_offset,
        entries: paged_entries,
    };

    (StatusCode::OK, axum::Json(response)).into_response()
}

fn compute_relative_path(base_path: &Path, target_path: &Path) -> String {
    let canonical_base = base_path.canonicalize().unwrap_or_else(|_| base_path.to_path_buf());
    let canonical_target = target_path
        .canonicalize()
        .unwrap_or_else(|_| target_path.to_path_buf());
    canonical_target
        .strip_prefix(canonical_base)
        .unwrap_or(Path::new(""))
        .to_string_lossy()
        .replace('\\', "/")
}

fn build_mobile_entry_from_dir(
    current_relative_path: &str,
    entry: std::fs::DirEntry,
) -> Option<MobileEntryInfo> {
    let metadata = entry.metadata().ok()?;
    let name = entry.file_name().to_string_lossy().to_string();
    let is_dir = metadata.is_dir();
    let relative_path = if current_relative_path.is_empty() {
        name.clone()
    } else {
        format!("{current_relative_path}/{name}")
    };

    Some(MobileEntryInfo {
        name: name.clone(),
        relative_path,
        is_dir,
        size: if is_dir { 0 } else { metadata.len() },
        extension: if is_dir {
            String::new()
        } else {
            normalized_extension_from_name(&name)
        },
        mime_type: if is_dir {
            None
        } else {
            mime_guess::from_path(entry.path())
                .first_raw()
                .map(str::to_string)
        },
        modified_ms: metadata_modified_ms(&metadata),
    })
}

fn normalized_extension_from_name(name: &str) -> String {
    name.rsplit_once('.')
        .map(|(_, extension)| extension.trim().to_ascii_lowercase())
        .filter(|extension| !extension.is_empty())
        .unwrap_or_default()
}

fn metadata_modified_ms(metadata: &std::fs::Metadata) -> Option<u64> {
    metadata
        .modified()
        .ok()
        .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
        .and_then(|duration| u64::try_from(duration.as_millis()).ok())
}

async fn mobile_file_handler(
    State(state): State<ShareState>,
    headers: axum::http::HeaderMap,
    AxumPath(file_path): AxumPath<String>,
) -> Response {
    if let Some(hub) = &state.file_hub {
        let target = match file_path.parse::<usize>() {
            Ok(index) => hub.get(index),
            Err(_) => None,
        };

        let Some(target) = target else {
            return (StatusCode::NOT_FOUND, "File not found").into_response();
        };

        if !target.is_file() {
            return (StatusCode::NOT_FOUND, "File not found").into_response();
        }

        return stream_file_response(target, &headers).await;
    }

    let target = match resolve_sub_path(&state.share_path, Some(&file_path)) {
        Ok(path) => path,
        Err(status) => return (status, "Invalid path").into_response(),
    };

    if !target.is_file() {
        return (StatusCode::NOT_FOUND, "File not found").into_response();
    }

    stream_file_response(&target, &headers).await
}
