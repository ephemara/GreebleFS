// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::cmp::Ordering;
use std::collections::HashMap;
use std::fs::File;
use std::io::Read;
use std::path::{Component, Path, PathBuf};
use std::time::UNIX_EPOCH;

use axum::body::Body;
use axum::extract::{DefaultBodyLimit, Multipart, Path as AxumPath, Query, State};
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::{Html, IntoResponse, Response};
use axum::routing::{get, post};
use axum::Json;
use axum::Router;
use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine as _;
use lopdf::Document;
use serde::{Deserialize, Serialize};
use tauri::Manager;

use super::handlers::handle_multipart_upload;
use super::mobile_plugins::{
    mobile_plugin_asset_handler, mobile_plugin_backend_handler, mobile_plugin_catalog_handler,
};
use super::push::{
    get_mobile_push_config, register_mobile_push_subscription, unregister_mobile_push_subscription,
    MobilePushSubscriptionInput, MobilePushSubscriptionRemovalRequest,
};
use super::streaming::{resolve_sub_path, share_root_label, stream_file_response};
use super::types::{
    MobileFolderIconRuleSnapshot, MobileIconThemeSnapshot, MobileLayoutSortBy,
    MobileLayoutSortOrder, MobileThemeSnapshot, ShareState, ACTIVE_MOBILE_THEME_SNAPSHOT,
    APPLE_TOUCH_ICON_PNG, APP_ICON_PNG, FTP_MAX_UPLOAD_BYTES,
};
use crate::archive_ops::{self, FsArchiveEntryListingEntry};
use crate::global_search::{
    self, GlobalSearchQueryOptions, GlobalSearchResultEntry, GlobalSearchScanSettings,
    GlobalSearchStatus,
};
use crate::thumbnail_commands::{self, ExplorerEntryThumbnailRequest};

const MOBILE_DEFAULT_PAGE_SIZE: usize = 160;
const MOBILE_MAX_PAGE_SIZE: usize = 320;
const MOBILE_SEARCH_DEFAULT_LIMIT: usize = 48;
const MOBILE_SEARCH_MAX_LIMIT: usize = 120;
const MOBILE_THUMBNAIL_WIDTH: u32 = 160;
const MOBILE_THUMBNAIL_HEIGHT: u32 = 160;
const MOBILE_PREVIEW_TEXT_BYTES: usize = 48 * 1024;
const MOBILE_FOLDER_PREVIEW_ENTRY_LIMIT: usize = 60;
const MOBILE_ARCHIVE_PREVIEW_ENTRY_LIMIT: usize = 60;

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
enum MobileEntryKind {
    Directory,
    Image,
    Video,
    Audio,
    Pdf,
    Archive,
    Text,
    Code,
    Shader,
    Model,
    Font,
    Document,
    File,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
enum MobilePreviewKind {
    Image,
    Video,
    Audio,
    Pdf,
    Text,
    Folder,
    Archive,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct MobileListQuery {
    path: Option<String>,
    offset: Option<usize>,
    limit: Option<usize>,
    show_hidden_files: Option<bool>,
    sort_by: Option<MobileLayoutSortBy>,
    sort_order: Option<MobileLayoutSortOrder>,
    directories_first: Option<bool>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct MobileSearchQuery {
    query: String,
    limit: Option<usize>,
    show_hidden_files: Option<bool>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct MobilePathQuery {
    path: String,
    show_hidden_files: Option<bool>,
}

#[derive(Deserialize)]
struct MobileThumbnailQuery {
    path: String,
    w: Option<u32>,
    h: Option<u32>,
}

#[derive(Deserialize)]
struct MobileIconQuery {
    id: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MobileEntryInfo {
    name: String,
    relative_path: String,
    is_dir: bool,
    is_hidden: bool,
    size: u64,
    extension: String,
    mime_type: Option<String>,
    modified_ms: Option<u64>,
    entry_kind: MobileEntryKind,
    icon_id: String,
    thumbnail_url: Option<String>,
    preview_kind: Option<MobilePreviewKind>,
    can_preview: bool,
    can_download: bool,
    file_url: Option<String>,
    download_url: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MobileListResponse {
    current_path: String,
    parent_path: String,
    can_go_up: bool,
    share_name: String,
    hub_mode: bool,
    total_count: usize,
    offset: usize,
    limit: usize,
    next_offset: Option<usize>,
    entries: Vec<MobileEntryInfo>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MobileSearchEntry {
    name: String,
    relative_path: String,
    parent_relative_path: String,
    is_dir: bool,
    is_hidden: bool,
    size: u64,
    extension: String,
    mime_type: Option<String>,
    modified_ms: Option<u64>,
    entry_kind: MobileEntryKind,
    icon_id: String,
    thumbnail_url: Option<String>,
    preview_kind: Option<MobilePreviewKind>,
    can_preview: bool,
    can_download: bool,
    file_url: Option<String>,
    download_url: Option<String>,
    score: f32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MobileSearchResponse {
    query: String,
    share_name: String,
    scope_path: String,
    total_count: usize,
    entries: Vec<MobileSearchEntry>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MobileSearchStatusResponse {
    share_name: String,
    scope_path: String,
    search_available: bool,
    message: Option<String>,
    status: Option<GlobalSearchStatus>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MobileDirectoryPreviewSummary {
    folder_count: usize,
    file_count: usize,
    total_visible_file_bytes: u64,
    truncated: bool,
    entries: Vec<MobileEntryInfo>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MobileArchivePreviewSummary {
    format_label: String,
    folder_count: usize,
    file_count: usize,
    truncated: bool,
    entries: Vec<MobileEntryInfo>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MobilePreviewResponse {
    entry: MobileEntryInfo,
    preview_kind: Option<MobilePreviewKind>,
    media_url: Option<String>,
    poster_url: Option<String>,
    open_url: Option<String>,
    page_count: Option<u32>,
    text_excerpt: Option<String>,
    text_truncated: bool,
    folder_summary: Option<MobileDirectoryPreviewSummary>,
    archive_summary: Option<MobileArchivePreviewSummary>,
}

struct ResolvedMobileTarget {
    absolute_path: PathBuf,
    relative_path: String,
}

struct MobileEntryMetadata {
    name: String,
    relative_path: String,
    absolute_path: Option<PathBuf>,
    is_dir: bool,
    is_hidden: bool,
    size: u64,
    extension: String,
    mime_type: Option<String>,
    modified_ms: Option<u64>,
}

#[derive(Clone, Copy, Debug)]
struct MobileBrowsePolicy {
    show_hidden_files: bool,
    sort_by: MobileLayoutSortBy,
    sort_order: MobileLayoutSortOrder,
    directories_first: bool,
}

impl Default for MobileBrowsePolicy {
    fn default() -> Self {
        Self {
            show_hidden_files: false,
            sort_by: MobileLayoutSortBy::Name,
            sort_order: MobileLayoutSortOrder::Asc,
            directories_first: true,
        }
    }
}

pub(super) fn build_mobile_router(state: ShareState) -> Router {
    Router::new()
        .route("/api/list", get(mobile_list_handler))
        .route("/api/theme", get(mobile_theme_handler))
        .route("/api/search", get(mobile_search_handler))
        .route("/api/search/status", get(mobile_search_status_handler))
        .route("/api/search/scan", post(mobile_search_scan_handler))
        .route("/api/search/cancel", post(mobile_search_cancel_handler))
        .route("/api/preview", get(mobile_preview_handler))
        .route("/api/thumbnail", get(mobile_thumbnail_handler))
        .route("/api/icon", get(mobile_icon_handler))
        .route("/api/upload", post(mobile_upload_handler))
        .route("/api/plugins", get(mobile_plugin_catalog_handler))
        .route(
            "/api/plugins/{plugin_id}/backend",
            post(mobile_plugin_backend_handler),
        )
        .route(
            "/api/plugins/{plugin_id}/assets/{*asset_path}",
            get(mobile_plugin_asset_handler),
        )
        .route("/api/push/config", get(mobile_push_config_handler))
        .route("/api/push/subscribe", post(mobile_push_subscribe_handler))
        .route(
            "/api/push/unsubscribe",
            post(mobile_push_unsubscribe_handler),
        )
        .route("/files/{*path}", get(mobile_file_handler))
        .route("/icons/{*path}", get(mobile_built_in_icon_handler))
        .route("/app-icon.png", get(app_icon_handler))
        .route("/apple-touch-icon.png", get(apple_touch_icon_handler))
        .route("/", get(mobile_index_handler))
        .route("/{*path}", get(mobile_spa_handler))
        .layer(DefaultBodyLimit::max(FTP_MAX_UPLOAD_BYTES))
        .with_state(state)
}

async fn app_icon_handler() -> Response {
    build_icon_response(APP_ICON_PNG)
}

async fn apple_touch_icon_handler() -> Response {
    build_icon_response(APPLE_TOUCH_ICON_PNG)
}

async fn mobile_theme_handler() -> Response {
    let snapshot: MobileThemeSnapshot = ACTIVE_MOBILE_THEME_SNAPSHOT.read().await.clone();
    axum::Json(snapshot).into_response()
}

async fn mobile_push_config_handler(State(state): State<ShareState>) -> Response {
    match get_mobile_push_config(&state.app_handle).await {
        Ok(config) => (StatusCode::OK, Json(config)).into_response(),
        Err(error) => (StatusCode::INTERNAL_SERVER_ERROR, error).into_response(),
    }
}

async fn mobile_push_subscribe_handler(
    State(state): State<ShareState>,
    Json(input): Json<MobilePushSubscriptionInput>,
) -> Response {
    match register_mobile_push_subscription(&state.app_handle, input).await {
        Ok(config) => (StatusCode::OK, Json(config)).into_response(),
        Err(error) => (StatusCode::BAD_REQUEST, error).into_response(),
    }
}

async fn mobile_push_unsubscribe_handler(
    State(state): State<ShareState>,
    Json(request): Json<MobilePushSubscriptionRemovalRequest>,
) -> Response {
    match unregister_mobile_push_subscription(&state.app_handle, &request.endpoint).await {
        Ok(config) => (StatusCode::OK, Json(config)).into_response(),
        Err(error) => (StatusCode::BAD_REQUEST, error).into_response(),
    }
}

async fn mobile_search_status_handler(State(state): State<ShareState>) -> Response {
    if state.file_hub.is_some() {
        let response = MobileSearchStatusResponse {
            share_name: share_root_label(&state.share_path),
            scope_path: String::new(),
            search_available: false,
            message: Some("Indexed search is unavailable for multi-file mobile hubs.".to_string()),
            status: None,
        };
        return (StatusCode::OK, axum::Json(response)).into_response();
    }

    let status = match global_search::global_search_init(state.app_handle.clone()) {
        Ok(status) => status,
        Err(error) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to initialize mobile search: {error}"),
            )
                .into_response()
        }
    };

    let response = MobileSearchStatusResponse {
        share_name: share_root_label(&state.share_path),
        scope_path: String::new(),
        search_available: true,
        message: None,
        status: Some(status),
    };
    (StatusCode::OK, axum::Json(response)).into_response()
}

async fn mobile_search_handler(
    State(state): State<ShareState>,
    Query(query): Query<MobileSearchQuery>,
) -> Response {
    let snapshot = ACTIVE_MOBILE_THEME_SNAPSHOT.read().await.clone();
    let browse_policy = MobileBrowsePolicy {
        show_hidden_files: query
            .show_hidden_files
            .unwrap_or(snapshot.layout.show_hidden_files),
        ..MobileBrowsePolicy::default()
    };
    let search_limit = query
        .limit
        .unwrap_or(MOBILE_SEARCH_DEFAULT_LIMIT)
        .clamp(1, MOBILE_SEARCH_MAX_LIMIT);
    let trimmed_query = query.query.trim();

    if trimmed_query.is_empty() {
        let response = MobileSearchResponse {
            query: String::new(),
            share_name: share_root_label(&state.share_path),
            scope_path: String::new(),
            total_count: 0,
            entries: Vec::new(),
        };
        return (StatusCode::OK, axum::Json(response)).into_response();
    }

    if let Some(hub) = &state.file_hub {
        let entries =
            build_hub_search_entries(hub, trimmed_query, search_limit, browse_policy, &snapshot);
        let response = MobileSearchResponse {
            query: trimmed_query.to_string(),
            share_name: share_root_label(&state.share_path),
            scope_path: String::new(),
            total_count: entries.len(),
            entries,
        };
        return (StatusCode::OK, axum::Json(response)).into_response();
    }

    if let Err(error) = global_search::global_search_init(state.app_handle.clone()) {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to initialize mobile search: {error}"),
        )
            .into_response();
    }

    let search_options = GlobalSearchQueryOptions {
        limit: search_limit,
        include_files: true,
        include_directories: true,
        exact_match: false,
        typo_tolerance: true,
        min_score_threshold: None,
    };
    let share_root = state.share_path.to_string_lossy().into_owned();
    let results = match crate::global_search::query::global_search_query_under_path(
        state.app_handle.clone(),
        share_root,
        trimmed_query.to_string(),
        search_options,
    )
    .await
    {
        Ok(results) => results,
        Err(error) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to query mobile search index: {error}"),
            )
                .into_response()
        }
    };

    let entries = results
        .into_iter()
        .filter_map(|result| {
            build_mobile_search_entry_from_result(
                &state.share_path,
                result,
                browse_policy,
                &snapshot,
            )
        })
        .collect::<Vec<_>>();
    let mut entries = entries;
    sort_mobile_search_entries(&mut entries, browse_policy);

    let response = MobileSearchResponse {
        query: trimmed_query.to_string(),
        share_name: share_root_label(&state.share_path),
        scope_path: String::new(),
        total_count: entries.len(),
        entries,
    };
    (StatusCode::OK, axum::Json(response)).into_response()
}

async fn mobile_search_scan_handler(State(state): State<ShareState>) -> Response {
    if state.file_hub.is_some() {
        return (
            StatusCode::BAD_REQUEST,
            "Indexed search is unavailable for multi-file mobile hubs",
        )
            .into_response();
    }

    if let Err(error) = global_search::global_search_init(state.app_handle.clone()) {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to initialize mobile search: {error}"),
        )
            .into_response();
    }

    let settings = GlobalSearchScanSettings {
        scan_depth: 7,
        ignored_paths: vec!["/node_modules".to_string()],
        drive_roots: vec![state.share_path.to_string_lossy().into_owned()],
        parallel_scan: false,
    };

    match global_search::global_search_start_scan(state.app_handle.clone(), settings).await {
        Ok(()) => StatusCode::ACCEPTED.into_response(),
        Err(error) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to start mobile search scan: {error}"),
        )
            .into_response(),
    }
}

async fn mobile_search_cancel_handler(State(state): State<ShareState>) -> Response {
    if state.file_hub.is_some() {
        return StatusCode::NO_CONTENT.into_response();
    }

    match global_search::global_search_cancel_scan() {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(error) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to cancel mobile search scan: {error}"),
        )
            .into_response(),
    }
}

async fn mobile_upload_handler(
    State(state): State<ShareState>,
    Query(query): Query<super::types::UploadQuery>,
    multipart: Multipart,
) -> Response {
    handle_multipart_upload(&state, query.path.as_deref(), multipart).await
}

async fn mobile_preview_handler(
    State(state): State<ShareState>,
    Query(query): Query<MobilePathQuery>,
) -> Response {
    let snapshot = ACTIVE_MOBILE_THEME_SNAPSHOT.read().await.clone();
    let browse_policy = MobileBrowsePolicy {
        show_hidden_files: query
            .show_hidden_files
            .unwrap_or(snapshot.layout.show_hidden_files),
        ..MobileBrowsePolicy::default()
    };
    let resolved = match resolve_mobile_target(&state, &query.path) {
        Ok(target) => target,
        Err(status) => return (status, "Invalid path").into_response(),
    };

    let metadata =
        match build_target_metadata(&resolved.absolute_path, resolved.relative_path.clone()) {
            Ok(metadata) => metadata,
            Err(status) => return (status, "Preview target not found").into_response(),
        };

    let entry = build_mobile_entry_info(metadata, &snapshot);
    let preview_kind = entry.preview_kind;
    let media_url = entry.file_url.clone();
    let poster_url = entry.thumbnail_url.clone();
    let open_url = entry.file_url.clone();

    let response = match preview_kind {
        Some(MobilePreviewKind::Folder) => MobilePreviewResponse {
            entry,
            preview_kind,
            media_url: None,
            poster_url,
            open_url: None,
            page_count: None,
            text_excerpt: None,
            text_truncated: false,
            folder_summary: build_folder_preview_summary(
                &resolved.absolute_path,
                &resolved.relative_path,
                browse_policy,
                &snapshot,
            )
            .ok(),
            archive_summary: None,
        },
        Some(MobilePreviewKind::Archive) => MobilePreviewResponse {
            entry,
            preview_kind,
            media_url: None,
            poster_url,
            open_url,
            page_count: None,
            text_excerpt: None,
            text_truncated: false,
            folder_summary: None,
            archive_summary: build_archive_preview_summary(
                &resolved.absolute_path,
                browse_policy,
                &snapshot,
            )
            .ok(),
        },
        Some(MobilePreviewKind::Text) => {
            let (text_excerpt, text_truncated) = read_text_excerpt(&resolved.absolute_path);
            MobilePreviewResponse {
                entry,
                preview_kind,
                media_url,
                poster_url,
                open_url,
                page_count: None,
                text_excerpt: Some(text_excerpt),
                text_truncated,
                folder_summary: None,
                archive_summary: None,
            }
        }
        Some(MobilePreviewKind::Pdf) => MobilePreviewResponse {
            entry,
            preview_kind,
            media_url,
            poster_url,
            open_url,
            page_count: pdf_page_count(&resolved.absolute_path),
            text_excerpt: None,
            text_truncated: false,
            folder_summary: None,
            archive_summary: None,
        },
        Some(MobilePreviewKind::Image)
        | Some(MobilePreviewKind::Video)
        | Some(MobilePreviewKind::Audio) => MobilePreviewResponse {
            entry,
            preview_kind,
            media_url,
            poster_url,
            open_url,
            page_count: None,
            text_excerpt: None,
            text_truncated: false,
            folder_summary: None,
            archive_summary: None,
        },
        None => MobilePreviewResponse {
            entry,
            preview_kind: None,
            media_url,
            poster_url,
            open_url,
            page_count: None,
            text_excerpt: None,
            text_truncated: false,
            folder_summary: None,
            archive_summary: None,
        },
    };

    (StatusCode::OK, axum::Json(response)).into_response()
}

async fn mobile_thumbnail_handler(
    State(state): State<ShareState>,
    Query(query): Query<MobileThumbnailQuery>,
) -> Response {
    let resolved = match resolve_mobile_target(&state, &query.path) {
        Ok(target) => target,
        Err(status) => return (status, "Invalid thumbnail path").into_response(),
    };

    if !resolved.absolute_path.is_file() {
        return (StatusCode::NOT_FOUND, "Thumbnail target not found").into_response();
    }

    let request = ExplorerEntryThumbnailRequest {
        path: resolved.absolute_path.to_string_lossy().into_owned(),
        max_width: query.w.unwrap_or(MOBILE_THUMBNAIL_WIDTH).max(1),
        max_height: query.h.unwrap_or(MOBILE_THUMBNAIL_HEIGHT).max(1),
        include_video_hover_scrub: Some(false),
        video_hover_frame_count: Some(0),
        entity_id: None,
        content_revision: None,
    };

    let thumbnail = match thumbnail_commands::fs_read_entry_thumbnail(
        state.app_handle.clone(),
        request,
    )
    .await
    {
        Ok(thumbnail) => thumbnail,
        Err(error) => {
            return (
                StatusCode::NOT_FOUND,
                format!("Thumbnail is unavailable: {error}"),
            )
                .into_response()
        }
    };

    data_url_response(&thumbnail.poster_data_url)
}

async fn mobile_icon_handler(Query(query): Query<MobileIconQuery>) -> Response {
    let snapshot = ACTIVE_MOBILE_THEME_SNAPSHOT.read().await.clone();
    let normalized_id = normalize_icon_id(&query.id);

    let Some(source) = snapshot.icon_theme.icon_definitions.get(&normalized_id) else {
        return (StatusCode::NOT_FOUND, "Icon not found").into_response();
    };

    resolve_icon_source_response(source)
}

async fn mobile_built_in_icon_handler(
    State(state): State<ShareState>,
    AxumPath(requested_path): AxumPath<String>,
) -> Response {
    let normalized_requested_path = requested_path.trim_start_matches('/');
    if normalized_requested_path.is_empty() {
        return (StatusCode::NOT_FOUND, "Icon not found").into_response();
    }

    serve_mobile_bundle_asset(
        &state.app_handle,
        &format!("icons/{normalized_requested_path}"),
        true,
    )
    .await
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
        let cache_immutable = normalized_requested_path.starts_with("assets/")
            || normalized_requested_path.starts_with("icons/");
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
    let snapshot = ACTIVE_MOBILE_THEME_SNAPSHOT.read().await.clone();
    let browse_policy = resolve_mobile_browse_policy(&snapshot, &query);

    if state.file_hub.is_some() {
        return mobile_hub_list_response(&state, &query, browse_policy, &snapshot);
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
    let mut entries = match collect_mobile_entries_for_directory(
        &target,
        &current_relative_path,
        browse_policy,
        &snapshot,
    ) {
        Ok(entries) => entries,
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to read directory",
            )
                .into_response()
        }
    };
    sort_mobile_entries(&mut entries, browse_policy);

    build_mobile_list_response(
        &state.share_path,
        &current_relative_path,
        false,
        offset,
        limit,
        entries,
    )
}

fn mobile_hub_list_response(
    state: &ShareState,
    query: &MobileListQuery,
    browse_policy: MobileBrowsePolicy,
    snapshot: &MobileThemeSnapshot,
) -> Response {
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
        let metadata = match build_target_metadata(path, index.to_string()) {
            Ok(metadata) => metadata,
            Err(_) => continue,
        };
        if metadata.is_hidden && !browse_policy.show_hidden_files {
            continue;
        }
        entries.push(build_mobile_entry_info(metadata, snapshot));
    }

    sort_mobile_entries(&mut entries, browse_policy);

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
        parent_path: parent_relative_path(current_relative_path),
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
    let canonical_base = base_path
        .canonicalize()
        .unwrap_or_else(|_| base_path.to_path_buf());
    let canonical_target = target_path
        .canonicalize()
        .unwrap_or_else(|_| target_path.to_path_buf());
    canonical_target
        .strip_prefix(canonical_base)
        .unwrap_or(Path::new(""))
        .to_string_lossy()
        .replace('\\', "/")
}

fn resolve_mobile_browse_policy(
    snapshot: &MobileThemeSnapshot,
    query: &MobileListQuery,
) -> MobileBrowsePolicy {
    MobileBrowsePolicy {
        show_hidden_files: query
            .show_hidden_files
            .unwrap_or(snapshot.layout.show_hidden_files),
        sort_by: query.sort_by.unwrap_or(snapshot.layout.sort_by),
        sort_order: query.sort_order.unwrap_or(snapshot.layout.sort_order),
        directories_first: query
            .directories_first
            .unwrap_or(snapshot.layout.directories_first),
    }
}

fn collect_mobile_entries_for_directory(
    folder_path: &Path,
    current_relative_path: &str,
    browse_policy: MobileBrowsePolicy,
    snapshot: &MobileThemeSnapshot,
) -> Result<Vec<MobileEntryInfo>, std::io::Error> {
    let read_dir = std::fs::read_dir(folder_path)?;
    let mut entries = Vec::new();
    for entry in read_dir.flatten() {
        let Some(metadata) = build_mobile_entry_from_dir(current_relative_path, entry) else {
            continue;
        };
        if metadata.is_hidden && !browse_policy.show_hidden_files {
            continue;
        }
        entries.push(build_mobile_entry_info(metadata, snapshot));
    }
    Ok(entries)
}

fn build_mobile_entry_from_dir(
    current_relative_path: &str,
    entry: std::fs::DirEntry,
) -> Option<MobileEntryMetadata> {
    let metadata = entry.metadata().ok()?;
    let name = entry.file_name().to_string_lossy().to_string();
    let is_dir = metadata.is_dir();
    let is_hidden = mobile_metadata_is_hidden(&name, &metadata);
    let relative_path = if current_relative_path.is_empty() {
        name.clone()
    } else {
        format!("{current_relative_path}/{name}")
    };

    Some(MobileEntryMetadata {
        name: name.clone(),
        relative_path,
        absolute_path: Some(entry.path()),
        is_dir,
        is_hidden,
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

fn build_mobile_search_entry_from_result(
    share_root: &Path,
    result: GlobalSearchResultEntry,
    browse_policy: MobileBrowsePolicy,
    snapshot: &MobileThemeSnapshot,
) -> Option<MobileSearchEntry> {
    let absolute_path = PathBuf::from(&result.path);
    let relative_path = compute_relative_path(share_root, &absolute_path);
    if relative_path.is_empty() && absolute_path != share_root {
        return None;
    }
    if !browse_policy.show_hidden_files && mobile_relative_path_is_hidden(&relative_path) {
        return None;
    }

    let name = result.name;
    let extension = result
        .extension
        .unwrap_or_else(|| normalized_extension_from_name(&name));
    let mime_type = if result.is_dir {
        None
    } else {
        mime_guess::from_path(&absolute_path)
            .first_raw()
            .map(str::to_string)
    };
    let metadata = MobileEntryMetadata {
        name: name.clone(),
        relative_path: relative_path.clone(),
        absolute_path: Some(absolute_path),
        is_dir: result.is_dir,
        is_hidden: mobile_relative_path_is_hidden(&relative_path),
        size: if result.is_dir { 0 } else { result.size },
        extension,
        mime_type,
        modified_ms: Some(result.modified_time),
    };
    let entry = build_mobile_entry_info(metadata, snapshot);
    let parent_relative_path = parent_relative_path(&relative_path);

    Some(MobileSearchEntry {
        name: entry.name,
        relative_path: entry.relative_path,
        parent_relative_path,
        is_dir: entry.is_dir,
        is_hidden: entry.is_hidden,
        size: entry.size,
        extension: entry.extension,
        mime_type: entry.mime_type,
        modified_ms: entry.modified_ms,
        entry_kind: entry.entry_kind,
        icon_id: entry.icon_id,
        thumbnail_url: entry.thumbnail_url,
        preview_kind: entry.preview_kind,
        can_preview: entry.can_preview,
        can_download: entry.can_download,
        file_url: entry.file_url,
        download_url: entry.download_url,
        score: result.score,
    })
}

fn build_hub_search_entries(
    hub: &[PathBuf],
    query: &str,
    limit: usize,
    browse_policy: MobileBrowsePolicy,
    snapshot: &MobileThemeSnapshot,
) -> Vec<MobileSearchEntry> {
    let normalized_query = query.to_lowercase();
    let mut entries = Vec::new();

    for (index, path) in hub.iter().enumerate() {
        let name = path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_string();
        let normalized_name = name.to_lowercase();
        if !normalized_name.contains(&normalized_query) {
            continue;
        }

        let metadata = match build_target_metadata(path, index.to_string()) {
            Ok(metadata) => metadata,
            Err(_) => continue,
        };
        if metadata.is_hidden && !browse_policy.show_hidden_files {
            continue;
        }
        let entry = build_mobile_entry_info(metadata, snapshot);
        let score = if normalized_name.starts_with(&normalized_query) {
            1.0
        } else {
            0.6
        };

        entries.push(MobileSearchEntry {
            name: entry.name,
            relative_path: entry.relative_path,
            parent_relative_path: String::new(),
            is_dir: entry.is_dir,
            is_hidden: entry.is_hidden,
            size: entry.size,
            extension: entry.extension,
            mime_type: entry.mime_type,
            modified_ms: entry.modified_ms,
            entry_kind: entry.entry_kind,
            icon_id: entry.icon_id,
            thumbnail_url: entry.thumbnail_url,
            preview_kind: entry.preview_kind,
            can_preview: entry.can_preview,
            can_download: entry.can_download,
            file_url: entry.file_url,
            download_url: entry.download_url,
            score,
        });
    }

    sort_mobile_search_entries(&mut entries, browse_policy);
    entries.truncate(limit);
    entries
}

fn build_target_metadata(
    absolute_path: &Path,
    relative_path: String,
) -> Result<MobileEntryMetadata, StatusCode> {
    let metadata = std::fs::metadata(absolute_path).map_err(|_| StatusCode::NOT_FOUND)?;
    let name = absolute_path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_string();
    let is_dir = metadata.is_dir();

    Ok(MobileEntryMetadata {
        name: name.clone(),
        relative_path,
        absolute_path: Some(absolute_path.to_path_buf()),
        is_dir,
        is_hidden: mobile_metadata_is_hidden(&name, &metadata),
        size: if is_dir { 0 } else { metadata.len() },
        extension: if is_dir {
            String::new()
        } else {
            normalized_extension_from_name(&name)
        },
        mime_type: if is_dir {
            None
        } else {
            mime_guess::from_path(absolute_path)
                .first_raw()
                .map(str::to_string)
        },
        modified_ms: metadata_modified_ms(&metadata),
    })
}

fn build_mobile_entry_info(
    metadata: MobileEntryMetadata,
    snapshot: &MobileThemeSnapshot,
) -> MobileEntryInfo {
    let entry_kind = classify_mobile_entry_kind(
        metadata.absolute_path.as_deref(),
        &metadata.name,
        &metadata.extension,
        metadata.mime_type.as_deref(),
        metadata.is_dir,
    );
    let preview_kind = preview_kind_for_entry_kind(entry_kind, metadata.is_dir);
    let icon_id = resolve_mobile_icon_id(
        snapshot,
        metadata.absolute_path.as_deref(),
        &metadata.relative_path,
        &metadata.name,
        &metadata.extension,
        metadata.is_dir,
    );
    let file_url = (!metadata.is_dir).then(|| build_mobile_file_url(&metadata.relative_path));
    let thumbnail_url = (supports_mobile_thumbnail(entry_kind) && !metadata.is_dir)
        .then(|| build_mobile_thumbnail_url(&metadata.relative_path));

    MobileEntryInfo {
        name: metadata.name,
        relative_path: metadata.relative_path,
        is_dir: metadata.is_dir,
        is_hidden: metadata.is_hidden,
        size: metadata.size,
        extension: metadata.extension,
        mime_type: metadata.mime_type,
        modified_ms: metadata.modified_ms,
        entry_kind,
        icon_id,
        thumbnail_url,
        preview_kind,
        can_preview: preview_kind.is_some(),
        can_download: !metadata.is_dir,
        download_url: file_url.clone(),
        file_url,
    }
}

fn classify_mobile_entry_kind(
    absolute_path: Option<&Path>,
    name: &str,
    extension: &str,
    mime_type: Option<&str>,
    is_dir: bool,
) -> MobileEntryKind {
    if is_dir {
        return MobileEntryKind::Directory;
    }

    let normalized_extension = extension.trim().to_ascii_lowercase();
    let lower_mime = mime_type.unwrap_or("").to_ascii_lowercase();

    if absolute_path
        .map(archive_ops::is_supported_archive_path)
        .unwrap_or(false)
        || matches!(
            normalized_extension.as_str(),
            "zip"
                | "7z"
                | "rar"
                | "tar"
                | "gz"
                | "bz2"
                | "xz"
                | "tgz"
                | "tbz2"
                | "txz"
                | "cbz"
                | "jar"
                | "apk"
        )
    {
        return MobileEntryKind::Archive;
    }

    if lower_mime.starts_with("image/")
        || matches!(
            normalized_extension.as_str(),
            "jpg"
                | "jpeg"
                | "png"
                | "gif"
                | "webp"
                | "svg"
                | "bmp"
                | "ico"
                | "avif"
                | "tiff"
                | "tif"
        )
    {
        return MobileEntryKind::Image;
    }

    if lower_mime.starts_with("video/")
        || matches!(
            normalized_extension.as_str(),
            "mp4" | "m4v" | "mov" | "webm" | "ogv" | "mkv" | "avi" | "wmv" | "mpeg" | "mpg"
        )
    {
        return MobileEntryKind::Video;
    }

    if lower_mime.starts_with("audio/")
        || matches!(
            normalized_extension.as_str(),
            "mp3" | "wav" | "flac" | "ogg" | "opus" | "m4a" | "aac" | "aiff" | "aif" | "weba"
        )
    {
        return MobileEntryKind::Audio;
    }

    if normalized_extension == "pdf" || lower_mime == "application/pdf" {
        return MobileEntryKind::Pdf;
    }

    if matches!(
        normalized_extension.as_str(),
        "wgsl" | "glsl" | "hlsl" | "vert" | "frag" | "comp" | "slang" | "shader"
    ) {
        return MobileEntryKind::Shader;
    }

    if matches!(
        normalized_extension.as_str(),
        "rs" | "ts"
            | "tsx"
            | "js"
            | "jsx"
            | "json"
            | "toml"
            | "yaml"
            | "yml"
            | "md"
            | "py"
            | "go"
            | "lua"
            | "java"
            | "kt"
            | "c"
            | "cpp"
            | "h"
            | "hpp"
            | "swift"
            | "css"
            | "scss"
            | "html"
            | "xml"
            | "sh"
            | "bash"
            | "zsh"
    ) {
        return MobileEntryKind::Code;
    }

    if lower_mime.starts_with("text/")
        || matches!(
            normalized_extension.as_str(),
            "txt" | "log" | "ini" | "cfg" | "csv" | "env"
        )
    {
        return MobileEntryKind::Text;
    }

    if matches!(
        normalized_extension.as_str(),
        "obj" | "fbx" | "gltf" | "glb" | "blend" | "stl" | "usd" | "usdz"
    ) {
        return MobileEntryKind::Model;
    }

    if matches!(
        normalized_extension.as_str(),
        "ttf" | "otf" | "woff" | "woff2"
    ) {
        return MobileEntryKind::Font;
    }

    if matches!(
        normalized_extension.as_str(),
        "doc" | "docx" | "xls" | "xlsx" | "ppt" | "pptx"
    ) {
        return MobileEntryKind::Document;
    }

    let _ = name;
    MobileEntryKind::File
}

fn preview_kind_for_entry_kind(
    entry_kind: MobileEntryKind,
    is_dir: bool,
) -> Option<MobilePreviewKind> {
    if is_dir {
        return Some(MobilePreviewKind::Folder);
    }

    match entry_kind {
        MobileEntryKind::Image => Some(MobilePreviewKind::Image),
        MobileEntryKind::Video => Some(MobilePreviewKind::Video),
        MobileEntryKind::Audio => Some(MobilePreviewKind::Audio),
        MobileEntryKind::Pdf => Some(MobilePreviewKind::Pdf),
        MobileEntryKind::Archive => Some(MobilePreviewKind::Archive),
        MobileEntryKind::Text | MobileEntryKind::Code | MobileEntryKind::Shader => {
            Some(MobilePreviewKind::Text)
        }
        _ => None,
    }
}

fn supports_mobile_thumbnail(entry_kind: MobileEntryKind) -> bool {
    matches!(
        entry_kind,
        MobileEntryKind::Image
            | MobileEntryKind::Video
            | MobileEntryKind::Audio
            | MobileEntryKind::Code
            | MobileEntryKind::Shader
    )
}

fn build_mobile_file_url(relative_path: &str) -> String {
    if relative_path.is_empty() {
        "/files".to_string()
    } else {
        format!("/files/{}", encode_relative_path(relative_path))
    }
}

fn build_mobile_thumbnail_url(relative_path: &str) -> String {
    format!(
        "/api/thumbnail?path={}&w={}&h={}",
        urlencoding::encode(relative_path),
        MOBILE_THUMBNAIL_WIDTH,
        MOBILE_THUMBNAIL_HEIGHT
    )
}

fn parent_relative_path(relative_path: &str) -> String {
    let mut segments = relative_path
        .split('/')
        .filter(|segment| !segment.is_empty())
        .collect::<Vec<_>>();
    if segments.len() <= 1 {
        return String::new();
    }
    segments.pop();
    segments.join("/")
}

fn mobile_metadata_is_hidden(name: &str, metadata: &std::fs::Metadata) -> bool {
    mobile_name_is_hidden(name) || mobile_platform_hidden(metadata)
}

fn mobile_name_is_hidden(name: &str) -> bool {
    name.starts_with('.')
}

fn mobile_relative_path_is_hidden(relative_path: &str) -> bool {
    relative_path
        .split(['/', '\\'])
        .filter(|segment| !segment.is_empty())
        .any(mobile_name_is_hidden)
}

#[cfg(windows)]
fn mobile_platform_hidden(metadata: &std::fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;

    const FILE_ATTRIBUTE_HIDDEN: u32 = 0x2;
    (metadata.file_attributes() & FILE_ATTRIBUTE_HIDDEN) != 0
}

#[cfg(not(windows))]
fn mobile_platform_hidden(_: &std::fs::Metadata) -> bool {
    false
}

fn sort_mobile_entries(entries: &mut [MobileEntryInfo], browse_policy: MobileBrowsePolicy) {
    entries.sort_by(|left, right| compare_mobile_entries(left, right, browse_policy));
}

fn sort_mobile_search_entries(
    entries: &mut [MobileSearchEntry],
    browse_policy: MobileBrowsePolicy,
) {
    entries.sort_by(|left, right| {
        right
            .score
            .partial_cmp(&left.score)
            .unwrap_or(Ordering::Equal)
            .then_with(|| {
                compare_mobile_entry_fields(
                    left.is_dir,
                    &left.name,
                    left.modified_ms,
                    left.size,
                    &left.extension,
                    right.is_dir,
                    &right.name,
                    right.modified_ms,
                    right.size,
                    &right.extension,
                    browse_policy,
                )
            })
    });
}

fn compare_mobile_entries(
    left: &MobileEntryInfo,
    right: &MobileEntryInfo,
    browse_policy: MobileBrowsePolicy,
) -> Ordering {
    compare_mobile_entry_fields(
        left.is_dir,
        &left.name,
        left.modified_ms,
        left.size,
        &left.extension,
        right.is_dir,
        &right.name,
        right.modified_ms,
        right.size,
        &right.extension,
        browse_policy,
    )
}

fn compare_mobile_entry_fields(
    left_is_dir: bool,
    left_name: &str,
    left_modified_ms: Option<u64>,
    left_size: u64,
    left_extension: &str,
    right_is_dir: bool,
    right_name: &str,
    right_modified_ms: Option<u64>,
    right_size: u64,
    right_extension: &str,
    browse_policy: MobileBrowsePolicy,
) -> Ordering {
    let directory_order = if browse_policy.directories_first {
        right_is_dir.cmp(&left_is_dir)
    } else {
        Ordering::Equal
    };
    if directory_order != Ordering::Equal {
        return directory_order;
    }

    let primary_order = match browse_policy.sort_by {
        MobileLayoutSortBy::Name => natural_case_insensitive_cmp(left_name, right_name),
        MobileLayoutSortBy::Date => left_modified_ms
            .unwrap_or(0)
            .cmp(&right_modified_ms.unwrap_or(0)),
        MobileLayoutSortBy::Size => left_size.cmp(&right_size),
        MobileLayoutSortBy::Type => natural_case_insensitive_cmp(left_extension, right_extension)
            .then_with(|| natural_case_insensitive_cmp(left_name, right_name)),
    };

    let applied_primary_order = match browse_policy.sort_order {
        MobileLayoutSortOrder::Asc => primary_order,
        MobileLayoutSortOrder::Desc => primary_order.reverse(),
    };

    if applied_primary_order != Ordering::Equal {
        return applied_primary_order;
    }

    natural_case_insensitive_cmp(left_name, right_name)
}

fn natural_case_insensitive_cmp(left: &str, right: &str) -> Ordering {
    let left_chars = left.chars().collect::<Vec<_>>();
    let right_chars = right.chars().collect::<Vec<_>>();
    let mut left_index = 0_usize;
    let mut right_index = 0_usize;

    while left_index < left_chars.len() && right_index < right_chars.len() {
        let left_char = left_chars[left_index];
        let right_char = right_chars[right_index];

        if left_char.is_ascii_digit() && right_char.is_ascii_digit() {
            let left_start = left_index;
            let right_start = right_index;
            while left_index < left_chars.len() && left_chars[left_index].is_ascii_digit() {
                left_index += 1;
            }
            while right_index < right_chars.len() && right_chars[right_index].is_ascii_digit() {
                right_index += 1;
            }

            let left_digits = left_chars[left_start..left_index]
                .iter()
                .collect::<String>();
            let right_digits = right_chars[right_start..right_index]
                .iter()
                .collect::<String>();
            let left_trimmed = left_digits.trim_start_matches('0');
            let right_trimmed = right_digits.trim_start_matches('0');
            let left_normalized = if left_trimmed.is_empty() {
                "0"
            } else {
                left_trimmed
            };
            let right_normalized = if right_trimmed.is_empty() {
                "0"
            } else {
                right_trimmed
            };

            let numeric_order = left_normalized
                .len()
                .cmp(&right_normalized.len())
                .then_with(|| left_normalized.cmp(right_normalized));
            if numeric_order != Ordering::Equal {
                return numeric_order;
            }

            let width_order = left_digits.len().cmp(&right_digits.len());
            if width_order != Ordering::Equal {
                return width_order;
            }

            continue;
        }

        let left_folded = left_char.to_ascii_lowercase();
        let right_folded = right_char.to_ascii_lowercase();
        let character_order = left_folded.cmp(&right_folded);
        if character_order != Ordering::Equal {
            return character_order;
        }

        left_index += 1;
        right_index += 1;
    }

    left_chars.len().cmp(&right_chars.len())
}

fn encode_relative_path(path: &str) -> String {
    path.split('/')
        .filter(|segment| !segment.is_empty())
        .map(urlencoding::encode)
        .collect::<Vec<_>>()
        .join("/")
}

fn resolve_mobile_target(
    state: &ShareState,
    relative_path: &str,
) -> Result<ResolvedMobileTarget, StatusCode> {
    if let Some(hub) = &state.file_hub {
        let index = relative_path
            .trim()
            .parse::<usize>()
            .map_err(|_| StatusCode::BAD_REQUEST)?;
        let target = hub.get(index).ok_or(StatusCode::NOT_FOUND)?;
        return Ok(ResolvedMobileTarget {
            absolute_path: target.clone(),
            relative_path: index.to_string(),
        });
    }

    let absolute_path =
        resolve_sub_path(&state.share_path, Some(relative_path)).map_err(|status| status)?;
    let relative_path = compute_relative_path(&state.share_path, &absolute_path);

    Ok(ResolvedMobileTarget {
        absolute_path,
        relative_path,
    })
}

fn read_text_excerpt(path: &Path) -> (String, bool) {
    let mut file = match File::open(path) {
        Ok(file) => file,
        Err(error) => return (format!("Failed to read preview text: {error}"), false),
    };
    let mut buffer = vec![0_u8; MOBILE_PREVIEW_TEXT_BYTES + 1];
    let bytes_read = match file.read(&mut buffer) {
        Ok(bytes_read) => bytes_read,
        Err(error) => return (format!("Failed to read preview text: {error}"), false),
    };
    let truncated = bytes_read > MOBILE_PREVIEW_TEXT_BYTES;
    let excerpt =
        String::from_utf8_lossy(&buffer[..bytes_read.min(MOBILE_PREVIEW_TEXT_BYTES)]).to_string();
    (excerpt, truncated)
}

fn pdf_page_count(path: &Path) -> Option<u32> {
    let document = Document::load(path).ok()?;
    u32::try_from(document.get_pages().len()).ok()
}

fn build_folder_preview_summary(
    folder_path: &Path,
    folder_relative_path: &str,
    browse_policy: MobileBrowsePolicy,
    snapshot: &MobileThemeSnapshot,
) -> Result<MobileDirectoryPreviewSummary, String> {
    let mut entries = collect_mobile_entries_for_directory(
        folder_path,
        folder_relative_path,
        browse_policy,
        snapshot,
    )
    .map_err(|error| {
        format!(
            "Failed to read folder preview '{}': {error}",
            folder_path.display()
        )
    })?;
    let mut folder_count = 0_usize;
    let mut file_count = 0_usize;
    let mut total_visible_file_bytes = 0_u64;

    for entry in &entries {
        if entry.is_dir {
            folder_count += 1;
        } else {
            file_count += 1;
            total_visible_file_bytes = total_visible_file_bytes.saturating_add(entry.size);
        }
    }

    sort_mobile_entries(&mut entries, browse_policy);

    let truncated = entries.len() > MOBILE_FOLDER_PREVIEW_ENTRY_LIMIT;
    entries.truncate(MOBILE_FOLDER_PREVIEW_ENTRY_LIMIT);

    Ok(MobileDirectoryPreviewSummary {
        folder_count,
        file_count,
        total_visible_file_bytes,
        truncated,
        entries,
    })
}

fn build_archive_preview_summary(
    archive_path: &Path,
    browse_policy: MobileBrowsePolicy,
    snapshot: &MobileThemeSnapshot,
) -> Result<MobileArchivePreviewSummary, String> {
    let entries = archive_ops::list_archive_dir(archive_path, "")?;
    let mut visible_entries = entries
        .into_iter()
        .filter(|entry| {
            browse_policy.show_hidden_files || !mobile_relative_path_is_hidden(&entry.relative_path)
        })
        .collect::<Vec<_>>();
    visible_entries.sort_by(|left, right| {
        compare_mobile_entry_fields(
            left.is_dir,
            &left.name,
            Some(left.modified),
            left.size,
            &left.extension,
            right.is_dir,
            &right.name,
            Some(right.modified),
            right.size,
            &right.extension,
            browse_policy,
        )
    });
    let folder_count = visible_entries.iter().filter(|entry| entry.is_dir).count();
    let file_count = visible_entries.iter().filter(|entry| !entry.is_dir).count();
    let truncated = visible_entries.len() > MOBILE_ARCHIVE_PREVIEW_ENTRY_LIMIT;
    let preview_entries = visible_entries
        .into_iter()
        .take(MOBILE_ARCHIVE_PREVIEW_ENTRY_LIMIT)
        .map(|entry| build_mobile_entry_from_archive(entry, snapshot))
        .collect::<Vec<_>>();

    Ok(MobileArchivePreviewSummary {
        format_label: archive_format_label(archive_path),
        folder_count,
        file_count,
        truncated,
        entries: preview_entries,
    })
}

fn build_mobile_entry_from_archive(
    entry: FsArchiveEntryListingEntry,
    snapshot: &MobileThemeSnapshot,
) -> MobileEntryInfo {
    let relative_path = entry.relative_path;
    let is_hidden = mobile_relative_path_is_hidden(&relative_path);
    let metadata = MobileEntryMetadata {
        name: entry.name,
        relative_path,
        absolute_path: None,
        is_dir: entry.is_dir,
        is_hidden,
        size: if entry.is_dir { 0 } else { entry.size },
        extension: entry.extension,
        mime_type: None,
        modified_ms: Some(entry.modified),
    };
    let mut resolved = build_mobile_entry_info(metadata, snapshot);
    resolved.thumbnail_url = None;
    resolved.can_preview = false;
    resolved.preview_kind = None;
    resolved.can_download = false;
    resolved.file_url = None;
    resolved.download_url = None;
    resolved
}

fn archive_format_label(path: &Path) -> String {
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();

    if name.ends_with(".tar.gz") || name.ends_with(".tgz") {
        "TAR.GZ".to_string()
    } else if name.ends_with(".tar.bz2") || name.ends_with(".tbz2") {
        "TAR.BZ2".to_string()
    } else if name.ends_with(".tar.xz") || name.ends_with(".txz") {
        "TAR.XZ".to_string()
    } else {
        path.extension()
            .and_then(|value| value.to_str())
            .map(|value| value.to_ascii_uppercase())
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| "ARCHIVE".to_string())
    }
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
    headers: HeaderMap,
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

fn resolve_mobile_icon_id(
    snapshot: &MobileThemeSnapshot,
    absolute_path: Option<&Path>,
    relative_path: &str,
    name: &str,
    extension: &str,
    is_dir: bool,
) -> String {
    if is_dir {
        return resolve_mobile_folder_icon_id(snapshot, relative_path);
    }

    let normalized_name = name.trim().to_ascii_lowercase();
    let normalized_extension = extension
        .trim()
        .trim_start_matches('.')
        .to_ascii_lowercase();
    if let Some(icon_id) = snapshot.icon_theme.file_names.get(&normalized_name) {
        return normalize_mobile_icon_candidate(snapshot, icon_id, &snapshot.icon_theme.file);
    }
    if let Some(icon_id) = snapshot
        .icon_theme
        .file_extensions
        .get(&normalized_extension)
    {
        return normalize_mobile_icon_candidate(snapshot, icon_id, &snapshot.icon_theme.file);
    }

    if let Some(path) = absolute_path {
        if archive_ops::is_supported_archive_path(path) {
            return normalize_mobile_icon_candidate(snapshot, "archive", &snapshot.icon_theme.file);
        }
    }

    normalize_mobile_icon_candidate(
        snapshot,
        &snapshot.icon_theme.file,
        &snapshot.icon_theme.file,
    )
}

fn resolve_mobile_folder_icon_id(snapshot: &MobileThemeSnapshot, folder_path: &str) -> String {
    let effective_rules = build_effective_folder_icon_rules(snapshot);
    let candidates = build_folder_icon_candidate_matchers(folder_path);

    for rule in effective_rules {
        if rule
            .matchers
            .iter()
            .map(|matcher| normalize_folder_icon_matcher(matcher))
            .any(|matcher| !matcher.is_empty() && candidates.contains(&matcher))
        {
            return normalize_mobile_icon_candidate(
                snapshot,
                &rule.icon,
                &snapshot.default_folder_icon,
            );
        }
    }

    normalize_mobile_icon_candidate(
        snapshot,
        &snapshot.default_folder_icon,
        &snapshot.icon_theme.folder,
    )
}

fn build_effective_folder_icon_rules(
    snapshot: &MobileThemeSnapshot,
) -> Vec<MobileFolderIconRuleSnapshot> {
    let mut grouped_theme_rules = HashMap::<String, Vec<String>>::new();
    for (matcher, icon_id) in &snapshot.icon_theme.folder_names {
        let normalized_icon_id = normalize_icon_id(icon_id);
        if !is_folder_icon_id(&snapshot.icon_theme, &normalized_icon_id) {
            continue;
        }
        let normalized_matcher = normalize_folder_icon_matcher(matcher);
        if normalized_matcher.is_empty() {
            continue;
        }
        grouped_theme_rules
            .entry(normalized_icon_id)
            .or_default()
            .push(normalized_matcher);
    }

    let mut rules = grouped_theme_rules
        .into_iter()
        .map(|(icon, matchers)| MobileFolderIconRuleSnapshot {
            id: icon.clone(),
            label: icon.clone(),
            matchers,
            icon,
        })
        .collect::<Vec<_>>();
    rules.extend(snapshot.folder_icon_rules.clone());
    rules
}

fn is_folder_icon_id(icon_theme: &MobileIconThemeSnapshot, icon_id: &str) -> bool {
    icon_id == normalize_icon_id(&icon_theme.folder) || icon_id.starts_with("folder_")
}

fn normalize_mobile_icon_candidate(
    snapshot: &MobileThemeSnapshot,
    candidate: &str,
    fallback: &str,
) -> String {
    let normalized_candidate = normalize_icon_id(candidate);
    if snapshot
        .icon_theme
        .icon_definitions
        .contains_key(&normalized_candidate)
    {
        return normalized_candidate;
    }

    let normalized_fallback = normalize_icon_id(fallback);
    if snapshot
        .icon_theme
        .icon_definitions
        .contains_key(&normalized_fallback)
    {
        return normalized_fallback;
    }

    normalize_icon_id(&snapshot.icon_theme.file)
}

fn normalize_icon_id(value: &str) -> String {
    value
        .trim()
        .to_ascii_lowercase()
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || character == '_' {
                character
            } else {
                '_'
            }
        })
        .collect::<String>()
        .trim_matches('_')
        .to_string()
}

fn normalize_folder_icon_matcher(value: &str) -> String {
    let characters = value.chars().collect::<Vec<_>>();
    let mut expanded = String::new();

    for (index, character) in characters.iter().enumerate() {
        if index > 0 {
            let previous = characters[index - 1];
            let next = characters.get(index + 1).copied();
            if (previous.is_ascii_lowercase() || previous.is_ascii_digit())
                && character.is_ascii_uppercase()
            {
                expanded.push(' ');
            } else if previous.is_ascii_uppercase()
                && character.is_ascii_uppercase()
                && next
                    .map(|value| value.is_ascii_lowercase())
                    .unwrap_or(false)
            {
                expanded.push(' ');
            }
        }
        expanded.push(*character);
    }

    let mut normalized = String::new();
    let mut previous_was_underscore = false;
    for character in expanded.to_ascii_lowercase().chars() {
        if character.is_ascii_alphanumeric() {
            normalized.push(character);
            previous_was_underscore = false;
        } else if !previous_was_underscore {
            normalized.push('_');
            previous_was_underscore = true;
        }
    }

    normalized.trim_matches('_').to_string()
}

fn tokenize_folder_segment(value: &str) -> Vec<String> {
    normalize_folder_icon_matcher(value)
        .split('_')
        .filter(|segment| !segment.is_empty())
        .map(str::to_string)
        .collect()
}

fn build_folder_icon_segment_variants(segment: &str) -> Vec<String> {
    let tokens = tokenize_folder_segment(segment);
    if tokens.is_empty() {
        return Vec::new();
    }

    let mut variants = Vec::new();
    let joined = tokens.join("_");
    variants.push(joined.clone());

    if tokens.len() > 1 {
        variants.push(tokens.join(""));
        variants.push(tokens[0].clone());
        variants.push(tokens[tokens.len() - 1].clone());
    }

    if let Some(last_token) = tokens.last() {
        if last_token.ends_with('s') && last_token.len() > 3 {
            let mut singular_tokens = tokens.clone();
            if let Some(last_value) = singular_tokens.last_mut() {
                last_value.pop();
            }
            variants.push(singular_tokens.join("_"));
            if let Some(last_value) = singular_tokens.last() {
                variants.push(last_value.clone());
            }
        }
    }

    variants.sort();
    variants.dedup();
    variants
}

fn build_folder_icon_candidate_matchers(folder_path: &str) -> Vec<String> {
    let path_segments = folder_path
        .split(['/', '\\'])
        .filter(|segment| !segment.is_empty())
        .collect::<Vec<_>>();
    if path_segments.is_empty() {
        return Vec::new();
    }

    let mut candidates = Vec::new();
    let recent_segments = path_segments
        .iter()
        .rev()
        .take(4)
        .copied()
        .collect::<Vec<_>>();

    for segment in recent_segments.iter().rev() {
        candidates.extend(build_folder_icon_segment_variants(segment));
    }

    for width in 2..=3 {
        if path_segments.len() < width {
            continue;
        }
        let slice = &path_segments[path_segments.len() - width..];
        let tokens = slice
            .iter()
            .flat_map(|segment| tokenize_folder_segment(segment))
            .collect::<Vec<_>>();
        if tokens.is_empty() {
            continue;
        }
        candidates.push(tokens.join("_"));
        candidates.push(tokens.join(""));
    }

    candidates.sort();
    candidates.dedup();
    candidates
}

fn resolve_icon_source_response(source: &str) -> Response {
    if source.starts_with("data:") {
        return data_url_response(source);
    }

    if let Some(icon_relative_path) = source.strip_prefix("/icons/") {
        let icon_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../dist-mobile/icons")
            .join(icon_relative_path);
        if let Ok(bytes) = std::fs::read(&icon_path) {
            let content_type = mime_guess::from_path(&icon_path)
                .first_raw()
                .unwrap_or("application/octet-stream");
            return Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, content_type)
                .header(header::CACHE_CONTROL, "public, max-age=86400")
                .body(Body::from(bytes))
                .unwrap_or_else(|_| {
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        "Failed to build icon asset response",
                    )
                        .into_response()
                });
        }
    }

    (
        StatusCode::NOT_FOUND,
        "Resolved icon source is unavailable for mobile delivery",
    )
        .into_response()
}

fn data_url_response(source: &str) -> Response {
    let Some((metadata, data)) = source.split_once(',') else {
        return (StatusCode::BAD_REQUEST, "Invalid data URL").into_response();
    };
    let content_type = metadata
        .strip_prefix("data:")
        .and_then(|value| value.split(';').next())
        .filter(|value| !value.is_empty())
        .unwrap_or("application/octet-stream");

    let bytes = if metadata.ends_with(";base64") {
        match BASE64_STANDARD.decode(data) {
            Ok(bytes) => bytes,
            Err(_) => return (StatusCode::BAD_REQUEST, "Invalid base64 data URL").into_response(),
        }
    } else {
        match urlencoding::decode(data) {
            Ok(decoded) => decoded.into_owned().into_bytes(),
            Err(_) => return (StatusCode::BAD_REQUEST, "Invalid encoded data URL").into_response(),
        }
    };

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, content_type)
        .header(header::CACHE_CONTROL, "public, max-age=86400")
        .body(Body::from(bytes))
        .unwrap_or_else(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to build data URL response",
            )
                .into_response()
        })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::lan_share::types::{
        MobileFolderIconRuleSnapshot, MobileIconThemeSnapshot, MobileThemeSnapshot,
    };
    use std::collections::BTreeMap;

    fn test_theme_snapshot() -> MobileThemeSnapshot {
        MobileThemeSnapshot {
            icon_theme: MobileIconThemeSnapshot {
                id: "test".to_string(),
                name: "Test".to_string(),
                file: "txt".to_string(),
                folder: "folder".to_string(),
                folder_expanded: "folder_open".to_string(),
                icon_definitions: BTreeMap::from([
                    ("txt".to_string(), "/icons/txt.svg".to_string()),
                    ("folder".to_string(), "/icons/folder.svg".to_string()),
                    (
                        "folder_open".to_string(),
                        "/icons/folder_open.svg".to_string(),
                    ),
                    ("rust".to_string(), "/icons/rust.svg".to_string()),
                    (
                        "dockerfile".to_string(),
                        "/icons/dockerfile.svg".to_string(),
                    ),
                    (
                        "folder_src".to_string(),
                        "/icons/folder_src.svg".to_string(),
                    ),
                    (
                        "folder_docs".to_string(),
                        "/icons/folder_docs.svg".to_string(),
                    ),
                    ("image".to_string(), "/icons/image.svg".to_string()),
                ]),
                file_extensions: BTreeMap::from([
                    ("rs".to_string(), "rust".to_string()),
                    ("png".to_string(), "image".to_string()),
                ]),
                file_names: BTreeMap::from([("dockerfile".to_string(), "dockerfile".to_string())]),
                folder_names: BTreeMap::from([("src".to_string(), "folder_src".to_string())]),
                folder_names_expanded: BTreeMap::new(),
                ui_icons: BTreeMap::new(),
            },
            folder_icon_rules: vec![MobileFolderIconRuleSnapshot {
                id: "docs".to_string(),
                label: "Docs".to_string(),
                matchers: vec!["docs".to_string()],
                icon: "folder_docs".to_string(),
            }],
            default_folder_icon: "folder".to_string(),
            ..MobileThemeSnapshot::default()
        }
    }

    #[test]
    fn compute_relative_path_uses_forward_slashes() {
        let root = tempfile::tempdir().expect("tempdir");
        let nested = root.path().join("alpha").join("beta");
        std::fs::create_dir_all(&nested).expect("create nested");

        let relative = compute_relative_path(root.path(), &nested);
        assert_eq!(relative, "alpha/beta");
    }

    #[test]
    fn resolve_mobile_icon_id_prefers_file_name_and_extension_matches() {
        let snapshot = test_theme_snapshot();

        assert_eq!(
            resolve_mobile_icon_id(&snapshot, None, "Dockerfile", "Dockerfile", "", false),
            "dockerfile"
        );
        assert_eq!(
            resolve_mobile_icon_id(&snapshot, None, "src/main.rs", "main.rs", "rs", false),
            "rust"
        );
    }

    #[test]
    fn resolve_mobile_folder_icon_id_uses_theme_and_user_rules() {
        let snapshot = test_theme_snapshot();

        assert_eq!(
            resolve_mobile_folder_icon_id(&snapshot, "workspace/src"),
            "folder_src"
        );
        assert_eq!(
            resolve_mobile_folder_icon_id(&snapshot, "workspace/docs"),
            "folder_docs"
        );
        assert_eq!(
            resolve_mobile_folder_icon_id(&snapshot, "workspace/misc"),
            "folder"
        );
    }

    #[test]
    fn classify_mobile_entry_kind_detects_previewable_types() {
        assert!(matches!(
            classify_mobile_entry_kind(None, "cover.png", "png", Some("image/png"), false),
            MobileEntryKind::Image
        ));
        assert!(matches!(
            classify_mobile_entry_kind(None, "clip.mp4", "mp4", Some("video/mp4"), false),
            MobileEntryKind::Video
        ));
        assert!(matches!(
            classify_mobile_entry_kind(None, "notes.md", "md", Some("text/markdown"), false),
            MobileEntryKind::Code
        ));
    }
}
