use crate::acceleration_runtime::AccelerationRoutingMode;
use crate::explorer_pro_commands::ExplorerSearchMode;
use crate::fs_commands::{
    complete_manual_explorer_task, create_manual_explorer_task_with_id,
    fail_manual_explorer_task, update_manual_explorer_task, ExplorerTaskKind,
    ExplorerTaskRegistration,
};
use crate::python_commands::PythonRuntimeConfig;
use crate::python_sidecar::{self, PythonSidecarDecodedActionResponse};
use crate::telemetry::{finish_native_span, start_native_span};
use ignore::WalkBuilder;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use std::thread;
use tauri::{AppHandle, Manager};
use uuid::Uuid;

const SEMANTIC_SEARCH_DIRECTORY: &str = "semantic-search";
const SEMANTIC_SEARCH_DATABASE_FILENAME: &str = "semantic-index-v1.sqlite3";
const SEMANTIC_SEARCH_SCHEMA_VERSION: u32 = 1;
const SEMANTIC_SEARCH_MAX_INDEXABLE_FILE_BYTES: u64 = 2 * 1024 * 1024;
const SEMANTIC_SEARCH_DEFAULT_RESULT_LIMIT: usize = 60;
const SEMANTIC_SEARCH_MAX_RESULT_LIMIT: usize = 250;
const SEMANTIC_SEARCH_FILE_TYPES_JSON: &str =
    include_str!("../../src/config/semanticSearchFileTypes.json");

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SemanticSearchFileTypeManifest {
    schema_version: u32,
    text_like_extensions: Vec<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum ExplorerSemanticIndexBuildMode {
    Build,
    Rebuild,
    Clear,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum ExplorerSemanticSearchQueryKind {
    Query,
    Similarity,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ExplorerSemanticIndexSummary {
    pub root_path: String,
    pub indexed: bool,
    pub stale: bool,
    pub file_count: u64,
    pub chunk_count: u64,
    pub indexed_at: Option<u64>,
    pub model_id: Option<String>,
    pub backend_kind: Option<String>,
    pub provider_kind: Option<String>,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ExplorerSemanticIndexBuildRequest {
    pub config: Option<PythonRuntimeConfig>,
    pub root_path: String,
    pub mode: ExplorerSemanticIndexBuildMode,
    pub routing_mode: Option<AccelerationRoutingMode>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ExplorerSemanticIndexBuildStartResponse {
    pub task_id: String,
    pub root_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ExplorerSemanticSearchRequest {
    pub config: Option<PythonRuntimeConfig>,
    pub root_path: String,
    pub query: String,
    pub limit: Option<usize>,
    pub routing_mode: Option<AccelerationRoutingMode>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ExplorerSemanticFindSimilarRequest {
    pub config: Option<PythonRuntimeConfig>,
    pub root_path: String,
    pub target_path: String,
    pub limit: Option<usize>,
    pub routing_mode: Option<AccelerationRoutingMode>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ExplorerSemanticSearchResult {
    pub name: String,
    pub path: String,
    pub relative_path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: u64,
    pub extension: String,
    pub is_hidden: bool,
    pub is_symlink: bool,
    pub match_kind: Option<crate::fs_commands::FileSearchMatchKind>,
    pub snippet: String,
    pub line_number: Option<u64>,
    pub semantic_score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ExplorerSemanticSearchDiagnostics {
    pub query_kind: ExplorerSemanticSearchQueryKind,
    pub backend_kind: String,
    pub provider_kind: String,
    pub model_id: String,
    pub indexed_file_count: u64,
    pub indexed_chunk_count: u64,
    pub stale_index: bool,
    pub result_limit: u64,
    pub force_cpu: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ExplorerSemanticSearchResponse {
    pub results: Vec<ExplorerSemanticSearchResult>,
    pub diagnostics: ExplorerSemanticSearchDiagnostics,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PythonSemanticIndexRootPayload {
    db_path: String,
    root_path: String,
    allowed_extensions: Vec<String>,
    max_file_bytes: u64,
    source_signature: String,
    force_cpu: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PythonSemanticIndexRootResult {
    indexed: bool,
    root_path: String,
    file_count: u64,
    chunk_count: u64,
    indexed_at: Option<u64>,
    model_id: String,
    backend_kind: String,
    provider_kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PythonSemanticDeleteIndexPayload {
    db_path: String,
    root_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PythonSemanticIndexStatusPayload {
    db_path: String,
    root_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PythonSemanticIndexStatusResult {
    indexed: bool,
    root_path: String,
    file_count: u64,
    chunk_count: u64,
    indexed_at: Option<u64>,
    model_id: Option<String>,
    backend_kind: Option<String>,
    provider_kind: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PythonSemanticSearchPayload {
    db_path: String,
    root_path: String,
    query: String,
    limit: usize,
    force_cpu: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PythonSemanticFindSimilarPayload {
    db_path: String,
    root_path: String,
    target_path: String,
    limit: usize,
    force_cpu: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PythonSemanticSearchDiagnostics {
    backend_kind: String,
    provider_kind: String,
    model_id: String,
    indexed_file_count: u64,
    indexed_chunk_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PythonSemanticSearchResponse {
    results: Vec<ExplorerSemanticSearchResult>,
    diagnostics: PythonSemanticSearchDiagnostics,
}

#[derive(Debug, Clone)]
struct IndexedRootRow {
    file_count: u64,
    chunk_count: u64,
    indexed_at: u64,
    model_id: String,
    backend_kind: String,
    provider_kind: String,
    source_signature: String,
    last_error: Option<String>,
}

fn semantic_search_manifest() -> &'static SemanticSearchFileTypeManifest {
    static MANIFEST: OnceLock<SemanticSearchFileTypeManifest> = OnceLock::new();
    MANIFEST.get_or_init(|| {
        serde_json::from_str(SEMANTIC_SEARCH_FILE_TYPES_JSON)
            .expect("semantic search file-type manifest must decode")
    })
}

fn semantic_search_extensions() -> &'static HashSet<String> {
    static EXTENSIONS: OnceLock<HashSet<String>> = OnceLock::new();
    EXTENSIONS.get_or_init(|| {
        semantic_search_manifest()
            .text_like_extensions
            .iter()
            .map(|extension| extension.trim().to_ascii_lowercase())
            .filter(|extension| !extension.is_empty())
            .collect()
    })
}

fn semantic_search_allowed_extension_list() -> Vec<String> {
    let mut extensions = semantic_search_extensions()
        .iter()
        .cloned()
        .collect::<Vec<_>>();
    extensions.sort_unstable();
    extensions
}

fn semantic_search_path_to_string(path: &Path) -> String {
    path.to_string_lossy().to_string()
}

fn semantic_search_data_root(app: &AppHandle) -> Result<PathBuf, String> {
    let root = app
        .path()
        .app_local_data_dir()
        .map_err(|error| format!("Failed to resolve semantic-search data root: {error}"))?
        .join("explorer")
        .join(SEMANTIC_SEARCH_DIRECTORY);
    fs::create_dir_all(&root)
        .map_err(|error| format!("Failed to create semantic-search data root: {error}"))?;
    Ok(root)
}

fn semantic_search_database_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(semantic_search_data_root(app)?.join(SEMANTIC_SEARCH_DATABASE_FILENAME))
}

fn open_semantic_search_connection(app: &AppHandle) -> Result<Connection, String> {
    let database_path = semantic_search_database_path(app)?;
    let connection = Connection::open(&database_path).map_err(|error| {
        format!(
            "Failed to open semantic-search database '{}': {error}",
            database_path.display()
        )
    })?;
    connection
        .pragma_update(None, "journal_mode", "WAL")
        .map_err(|error| format!("Failed to enable semantic-search WAL mode: {error}"))?;
    connection
        .pragma_update(None, "foreign_keys", "ON")
        .map_err(|error| format!("Failed to enable semantic-search foreign keys: {error}"))?;
    ensure_semantic_search_schema(&connection)?;
    Ok(connection)
}

fn ensure_semantic_search_schema(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(
            "
            CREATE TABLE IF NOT EXISTS semantic_meta (
              key TEXT PRIMARY KEY NOT NULL,
              value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS indexed_roots (
              id TEXT PRIMARY KEY NOT NULL,
              root_path TEXT NOT NULL UNIQUE,
              model_id TEXT NOT NULL,
              backend_kind TEXT NOT NULL,
              provider_kind TEXT NOT NULL,
              source_signature TEXT NOT NULL,
              indexed_at_ms INTEGER NOT NULL,
              file_count INTEGER NOT NULL,
              chunk_count INTEGER NOT NULL,
              last_error TEXT
            );

            CREATE TABLE IF NOT EXISTS indexed_files (
              id TEXT PRIMARY KEY NOT NULL,
              root_id TEXT NOT NULL,
              path TEXT NOT NULL,
              relative_path TEXT NOT NULL,
              name TEXT NOT NULL,
              extension TEXT NOT NULL,
              size_bytes INTEGER NOT NULL,
              modified_ms INTEGER NOT NULL,
              chunk_count INTEGER NOT NULL,
              snippet_preview TEXT NOT NULL,
              embedding_json TEXT NOT NULL,
              UNIQUE(root_id, path),
              FOREIGN KEY(root_id) REFERENCES indexed_roots(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS indexed_chunks (
              id TEXT PRIMARY KEY NOT NULL,
              file_id TEXT NOT NULL,
              chunk_index INTEGER NOT NULL,
              line_start INTEGER,
              line_end INTEGER,
              snippet TEXT NOT NULL,
              embedding_json TEXT NOT NULL,
              UNIQUE(file_id, chunk_index),
              FOREIGN KEY(file_id) REFERENCES indexed_files(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS indexed_files_root_id_idx
              ON indexed_files(root_id);
            CREATE INDEX IF NOT EXISTS indexed_chunks_file_id_idx
              ON indexed_chunks(file_id);
            ",
        )
        .map_err(|error| format!("Failed to initialize semantic-search schema: {error}"))?;
    connection
        .execute(
            "INSERT OR REPLACE INTO semantic_meta(key, value) VALUES ('schemaVersion', ?1)",
            params![SEMANTIC_SEARCH_SCHEMA_VERSION.to_string()],
        )
        .map_err(|error| format!("Failed to persist semantic-search schema version: {error}"))?;
    Ok(())
}

fn canonicalize_local_directory(raw_path: &str) -> Result<PathBuf, String> {
    let trimmed = raw_path.trim();
    if trimmed.is_empty() {
        return Err("Semantic-search root path cannot be empty.".to_string());
    }
    let input_path = PathBuf::from(trimmed);
    let canonical_path = fs::canonicalize(&input_path).map_err(|error| {
        format!(
            "Failed to resolve semantic-search root '{}': {error}",
            input_path.display()
        )
    })?;
    if !canonical_path.is_dir() {
        return Err(format!(
            "Semantic-search root is not a directory: {}",
            canonical_path.display()
        ));
    }
    Ok(canonical_path)
}

fn canonicalize_local_file(raw_path: &str) -> Result<PathBuf, String> {
    let trimmed = raw_path.trim();
    if trimmed.is_empty() {
        return Err("Semantic-search target path cannot be empty.".to_string());
    }
    let input_path = PathBuf::from(trimmed);
    let canonical_path = fs::canonicalize(&input_path).map_err(|error| {
        format!(
            "Failed to resolve semantic-search target '{}': {error}",
            input_path.display()
        )
    })?;
    if !canonical_path.is_file() {
        return Err(format!(
            "Semantic-search target is not a file: {}",
            canonical_path.display()
        ));
    }
    Ok(canonical_path)
}

fn ensure_path_within_root(root_path: &Path, candidate_path: &Path) -> Result<(), String> {
    if candidate_path.starts_with(root_path) {
        return Ok(());
    }
    Err(format!(
        "Semantic-search target '{}' is outside indexed root '{}'.",
        candidate_path.display(),
        root_path.display()
    ))
}

fn normalized_extension(path: &Path) -> Option<String> {
    path.extension()
        .and_then(|value| value.to_str())
        .map(|value| value.trim().trim_start_matches('.').to_ascii_lowercase())
        .filter(|value| !value.is_empty())
}

fn is_indexable_semantic_file(path: &Path, metadata_len: u64) -> bool {
    if metadata_len == 0 || metadata_len > SEMANTIC_SEARCH_MAX_INDEXABLE_FILE_BYTES {
        return false;
    }
    normalized_extension(path)
        .map(|extension| semantic_search_extensions().contains(&extension))
        .unwrap_or(false)
}

fn compute_root_source_signature(root_path: &Path) -> Result<(String, u64), String> {
    let mut walker = WalkBuilder::new(root_path);
    walker.standard_filters(true).require_git(false);

    let mut descriptors = Vec::new();
    let mut indexed_file_count = 0_u64;
    for result in walker.build() {
        let entry = result.map_err(|error| {
            format!(
                "Failed to walk semantic-search root '{}': {error}",
                root_path.display()
            )
        })?;
        let path = entry.path();
        let metadata = match fs::metadata(path) {
            Ok(metadata) => metadata,
            Err(error) => {
                return Err(format!(
                    "Failed to inspect semantic-search candidate '{}': {error}",
                    path.display()
                ));
            }
        };
        if !metadata.is_file() || !is_indexable_semantic_file(path, metadata.len()) {
            continue;
        }
        let relative_path = path
            .strip_prefix(root_path)
            .map_err(|error| {
                format!(
                    "Failed to normalize semantic-search path '{}': {error}",
                    path.display()
                )
            })?
            .to_string_lossy()
            .replace('\\', "/");
        let modified_ms = metadata
            .modified()
            .ok()
            .and_then(|value| value.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|value| value.as_millis() as u64)
            .unwrap_or(0);
        descriptors.push(format!("{relative_path}|{}|{modified_ms}", metadata.len()));
        indexed_file_count += 1;
    }

    descriptors.sort_unstable();
    let mut hasher = Sha256::new();
    for descriptor in descriptors {
        hasher.update(descriptor.as_bytes());
        hasher.update(b"\n");
    }
    Ok((format!("{:x}", hasher.finalize()), indexed_file_count))
}

fn read_indexed_root_row(
    connection: &Connection,
    root_path: &str,
) -> Result<Option<IndexedRootRow>, String> {
    connection
        .query_row(
            "
            SELECT
              file_count,
              chunk_count,
              indexed_at_ms,
              model_id,
              backend_kind,
              provider_kind,
              source_signature,
              last_error
            FROM indexed_roots
            WHERE root_path = ?1
            ",
            params![root_path],
            |row| {
                Ok(IndexedRootRow {
                    file_count: row.get::<_, u64>(0)?,
                    chunk_count: row.get::<_, u64>(1)?,
                    indexed_at: row.get::<_, u64>(2)?,
                    model_id: row.get::<_, String>(3)?,
                    backend_kind: row.get::<_, String>(4)?,
                    provider_kind: row.get::<_, String>(5)?,
                    source_signature: row.get::<_, String>(6)?,
                    last_error: row.get::<_, Option<String>>(7)?,
                })
            },
        )
        .optional()
        .map_err(|error| format!("Failed to read semantic-search index status: {error}"))
}

fn read_semantic_index_summary_for_root(
    app: &AppHandle,
    root_path: &Path,
) -> Result<ExplorerSemanticIndexSummary, String> {
    let connection = open_semantic_search_connection(app)?;
    let root_path_string = semantic_search_path_to_string(root_path);
    let Some(row) = read_indexed_root_row(&connection, &root_path_string)? else {
        return Ok(ExplorerSemanticIndexSummary {
            root_path: root_path_string,
            indexed: false,
            stale: false,
            file_count: 0,
            chunk_count: 0,
            indexed_at: None,
            model_id: None,
            backend_kind: None,
            provider_kind: None,
            last_error: None,
        });
    };

    let (current_signature, _) = compute_root_source_signature(root_path)?;
    Ok(ExplorerSemanticIndexSummary {
        root_path: root_path_string,
        indexed: true,
        stale: current_signature != row.source_signature,
        file_count: row.file_count,
        chunk_count: row.chunk_count,
        indexed_at: Some(row.indexed_at),
        model_id: Some(row.model_id),
        backend_kind: Some(row.backend_kind),
        provider_kind: Some(row.provider_kind),
        last_error: row.last_error,
    })
}

fn semantic_force_cpu(routing_mode: Option<AccelerationRoutingMode>) -> bool {
    matches!(routing_mode, Some(AccelerationRoutingMode::CpuOnly))
}

fn normalize_result_limit(limit: Option<usize>) -> usize {
    limit
        .unwrap_or(SEMANTIC_SEARCH_DEFAULT_RESULT_LIMIT)
        .clamp(1, SEMANTIC_SEARCH_MAX_RESULT_LIMIT)
}

fn semantic_index_task_detail(
    mode: ExplorerSemanticIndexBuildMode,
    root_path: &Path,
    summary: Option<&ExplorerSemanticIndexSummary>,
) -> String {
    match mode {
        ExplorerSemanticIndexBuildMode::Build => {
            if let Some(summary) = summary {
                format!(
                    "Indexed {} files into {} chunks via {} / {}.",
                    summary.file_count,
                    summary.chunk_count,
                    summary.backend_kind.as_deref().unwrap_or("unknown"),
                    summary.provider_kind.as_deref().unwrap_or("unknown")
                )
            } else {
                format!("Building semantic index for {}", root_path.display())
            }
        }
        ExplorerSemanticIndexBuildMode::Rebuild => {
            if let Some(summary) = summary {
                format!(
                    "Rebuilt semantic index: {} files, {} chunks.",
                    summary.file_count, summary.chunk_count
                )
            } else {
                format!("Rebuilding semantic index for {}", root_path.display())
            }
        }
        ExplorerSemanticIndexBuildMode::Clear => {
            format!("Cleared semantic index for {}", root_path.display())
        }
    }
}

fn semantic_index_task_registration(
    root_path: &Path,
    mode: ExplorerSemanticIndexBuildMode,
) -> ExplorerTaskRegistration {
    let title = match mode {
        ExplorerSemanticIndexBuildMode::Build => {
            format!("Build semantic index for {}", root_path.display())
        }
        ExplorerSemanticIndexBuildMode::Rebuild => {
            format!("Rebuild semantic index for {}", root_path.display())
        }
        ExplorerSemanticIndexBuildMode::Clear => {
            format!("Clear semantic index for {}", root_path.display())
        }
    };
    let detail = match mode {
        ExplorerSemanticIndexBuildMode::Build => {
            "Preparing manual semantic-index build".to_string()
        }
        ExplorerSemanticIndexBuildMode::Rebuild => {
            "Preparing semantic-index rebuild".to_string()
        }
        ExplorerSemanticIndexBuildMode::Clear => {
            "Removing semantic-index data for this root".to_string()
        }
    };
    ExplorerTaskRegistration {
        kind: ExplorerTaskKind::SemanticIndex,
        title,
        detail,
        source_paths: vec![semantic_search_path_to_string(root_path)],
        destination_path: None,
        retry_context: None,
        can_undo: false,
    }
}

fn semantic_search_db_path_string(app: &AppHandle) -> Result<String, String> {
    semantic_search_database_path(app).map(|path| semantic_search_path_to_string(&path))
}

fn run_semantic_index_task(
    app: AppHandle,
    task_id: String,
    request: ExplorerSemanticIndexBuildRequest,
) -> Result<(), String> {
    let root_path = canonicalize_local_directory(&request.root_path)?;
    let db_path = semantic_search_db_path_string(&app)?;
    let root_path_string = semantic_search_path_to_string(&root_path);
    let force_cpu = semantic_force_cpu(request.routing_mode);
    let _ = update_manual_explorer_task(
        &task_id,
        Some("Preparing semantic-search runtime".to_string()),
        Some(1),
        Some(3),
    );

    match request.mode {
        ExplorerSemanticIndexBuildMode::Clear => {
            let _: PythonSidecarDecodedActionResponse<PythonSemanticIndexStatusResult> =
                python_sidecar::call_sidecar_action_json(
                    &app,
                    request.config,
                    python_sidecar::action_ids::SEMANTIC_DELETE_INDEX,
                    Some(PythonSemanticDeleteIndexPayload {
                        db_path,
                        root_path: root_path_string.clone(),
                    }),
                    Some(root_path_string.clone()),
                    Some(BTreeMap::from([(
                        "TOKENIZERS_PARALLELISM".to_string(),
                        "false".to_string(),
                    )])
                    .into_iter()
                    .collect()),
                    Some(true),
                )?;
            let _ = complete_manual_explorer_task(
                &task_id,
                Some(semantic_index_task_detail(request.mode, &root_path, None)),
                Some(false),
            );
            return Ok(());
        }
        ExplorerSemanticIndexBuildMode::Build | ExplorerSemanticIndexBuildMode::Rebuild => {}
    }

    let (source_signature, _) = compute_root_source_signature(&root_path)?;
    let _ = update_manual_explorer_task(
        &task_id,
        Some("Indexing local text/code files through the Python sidecar".to_string()),
        Some(2),
        Some(3),
    );
    let _: PythonSidecarDecodedActionResponse<PythonSemanticIndexRootResult> =
        python_sidecar::call_sidecar_action_json(
            &app,
            request.config,
            python_sidecar::action_ids::SEMANTIC_INDEX_ROOT,
            Some(PythonSemanticIndexRootPayload {
                db_path,
                root_path: root_path_string.clone(),
                allowed_extensions: semantic_search_allowed_extension_list(),
                max_file_bytes: SEMANTIC_SEARCH_MAX_INDEXABLE_FILE_BYTES,
                source_signature,
                force_cpu,
            }),
            Some(root_path_string.clone()),
            Some(BTreeMap::from([(
                "TOKENIZERS_PARALLELISM".to_string(),
                "false".to_string(),
            )])
            .into_iter()
            .collect()),
            Some(true),
        )?;

    let summary = read_semantic_index_summary_for_root(&app, &root_path)?;
    let _ = update_manual_explorer_task(
        &task_id,
        Some("Finalizing semantic-search index metadata".to_string()),
        Some(3),
        Some(3),
    );
    let _ = complete_manual_explorer_task(
        &task_id,
        Some(semantic_index_task_detail(
            request.mode,
            &root_path,
            Some(&summary),
        )),
        Some(false),
    );
    Ok(())
}

fn build_semantic_search_response(
    query_kind: ExplorerSemanticSearchQueryKind,
    stale_index: bool,
    force_cpu: bool,
    result_limit: usize,
    response: PythonSemanticSearchResponse,
) -> ExplorerSemanticSearchResponse {
    ExplorerSemanticSearchResponse {
        results: response.results,
        diagnostics: ExplorerSemanticSearchDiagnostics {
            query_kind,
            backend_kind: response.diagnostics.backend_kind,
            provider_kind: response.diagnostics.provider_kind,
            model_id: response.diagnostics.model_id,
            indexed_file_count: response.diagnostics.indexed_file_count,
            indexed_chunk_count: response.diagnostics.indexed_chunk_count,
            stale_index,
            result_limit: result_limit as u64,
            force_cpu,
        },
    }
}

#[tauri::command]
#[specta::specta]
pub async fn explorer_semantic_index_get_summary(
    app: AppHandle,
    root_path: String,
) -> Result<ExplorerSemanticIndexSummary, String> {
    let canonical_root = canonicalize_local_directory(&root_path)?;
    tauri::async_runtime::spawn_blocking(move || {
        read_semantic_index_summary_for_root(&app, &canonical_root)
    })
    .await
    .map_err(|error| format!("Semantic index summary task failed to join: {error}"))?
}

#[tauri::command]
#[specta::specta]
pub async fn explorer_semantic_index_build(
    app: AppHandle,
    request: ExplorerSemanticIndexBuildRequest,
) -> Result<ExplorerSemanticIndexBuildStartResponse, String> {
    let canonical_root = canonicalize_local_directory(&request.root_path)?;
    let task_id = Uuid::new_v4().to_string();
    create_manual_explorer_task_with_id(
        task_id.clone(),
        semantic_index_task_registration(&canonical_root, request.mode),
    );

    let thread_app = app.clone();
    let thread_request = ExplorerSemanticIndexBuildRequest {
        root_path: semantic_search_path_to_string(&canonical_root),
        ..request
    };
    let thread_task_id = task_id.clone();
    thread::spawn(move || {
        if let Err(error) = run_semantic_index_task(thread_app, thread_task_id.clone(), thread_request)
        {
            let _ = fail_manual_explorer_task(&thread_task_id, error);
        }
    });

    Ok(ExplorerSemanticIndexBuildStartResponse {
        task_id,
        root_path: semantic_search_path_to_string(&canonical_root),
    })
}

#[tauri::command]
#[specta::specta]
pub async fn explorer_semantic_search(
    app: AppHandle,
    request: ExplorerSemanticSearchRequest,
) -> Result<ExplorerSemanticSearchResponse, String> {
    let span = start_native_span(
        &app,
        "rust",
        "explorer_semantic_search",
        BTreeMap::from([
            ("rootPath".to_string(), request.root_path.clone()),
            ("queryLength".to_string(), request.query.len().to_string()),
        ]),
    );
    let canonical_root = canonicalize_local_directory(&request.root_path)?;
    let query = request.query.trim().to_string();
    if query.is_empty() {
        finish_native_span(
            &app,
            span,
            "error",
            BTreeMap::new(),
            Some("Semantic search query cannot be empty.".to_string()),
        );
        return Err("Semantic search query cannot be empty.".to_string());
    }

    let summary = read_semantic_index_summary_for_root(&app, &canonical_root)?;
    if !summary.indexed {
        finish_native_span(
            &app,
            span,
            "error",
            BTreeMap::new(),
            Some("Semantic index has not been built for this root.".to_string()),
        );
        return Err("Semantic index has not been built for this root.".to_string());
    }

    let result_limit = normalize_result_limit(request.limit);
    let force_cpu = semantic_force_cpu(request.routing_mode);
    let response = python_sidecar::call_sidecar_action_json::<
        PythonSemanticSearchPayload,
        PythonSemanticSearchResponse,
    >(
        &app,
        request.config,
        python_sidecar::action_ids::SEMANTIC_QUERY_INDEX,
        Some(PythonSemanticSearchPayload {
            db_path: semantic_search_db_path_string(&app)?,
            root_path: semantic_search_path_to_string(&canonical_root),
            query,
            limit: result_limit,
            force_cpu,
        }),
        Some(semantic_search_path_to_string(&canonical_root)),
        Some(BTreeMap::from([(
            "TOKENIZERS_PARALLELISM".to_string(),
            "false".to_string(),
        )])
        .into_iter()
        .collect()),
        Some(true),
    )
    .map(|response| {
        build_semantic_search_response(
            ExplorerSemanticSearchQueryKind::Query,
            summary.stale,
            force_cpu,
            result_limit,
            response.result,
        )
    });

    let status = if response.is_ok() { "ok" } else { "error" };
    let error = response.as_ref().err().cloned();
    let result_count = response
        .as_ref()
        .map(|payload| payload.results.len().to_string())
        .unwrap_or_else(|_| "0".to_string());
    finish_native_span(
        &app,
        span,
        status,
        BTreeMap::from([("resultCount".to_string(), result_count)]),
        error,
    );
    response
}

#[tauri::command]
#[specta::specta]
pub async fn explorer_semantic_find_similar(
    app: AppHandle,
    request: ExplorerSemanticFindSimilarRequest,
) -> Result<ExplorerSemanticSearchResponse, String> {
    let span = start_native_span(
        &app,
        "rust",
        "explorer_semantic_find_similar",
        BTreeMap::from([
            ("rootPath".to_string(), request.root_path.clone()),
            ("targetPath".to_string(), request.target_path.clone()),
        ]),
    );
    let canonical_root = canonicalize_local_directory(&request.root_path)?;
    let canonical_target = canonicalize_local_file(&request.target_path)?;
    ensure_path_within_root(&canonical_root, &canonical_target)?;

    let summary = read_semantic_index_summary_for_root(&app, &canonical_root)?;
    if !summary.indexed {
        finish_native_span(
            &app,
            span,
            "error",
            BTreeMap::new(),
            Some("Semantic index has not been built for this root.".to_string()),
        );
        return Err("Semantic index has not been built for this root.".to_string());
    }

    let result_limit = normalize_result_limit(request.limit);
    let force_cpu = semantic_force_cpu(request.routing_mode);
    let response = python_sidecar::call_sidecar_action_json::<
        PythonSemanticFindSimilarPayload,
        PythonSemanticSearchResponse,
    >(
        &app,
        request.config,
        python_sidecar::action_ids::SEMANTIC_FIND_SIMILAR_FILE,
        Some(PythonSemanticFindSimilarPayload {
            db_path: semantic_search_db_path_string(&app)?,
            root_path: semantic_search_path_to_string(&canonical_root),
            target_path: semantic_search_path_to_string(&canonical_target),
            limit: result_limit,
            force_cpu,
        }),
        Some(semantic_search_path_to_string(&canonical_root)),
        Some(BTreeMap::from([(
            "TOKENIZERS_PARALLELISM".to_string(),
            "false".to_string(),
        )])
        .into_iter()
        .collect()),
        Some(true),
    )
    .map(|response| {
        build_semantic_search_response(
            ExplorerSemanticSearchQueryKind::Similarity,
            summary.stale,
            force_cpu,
            result_limit,
            response.result,
        )
    });

    let status = if response.is_ok() { "ok" } else { "error" };
    let error = response.as_ref().err().cloned();
    let result_count = response
        .as_ref()
        .map(|payload| payload.results.len().to_string())
        .unwrap_or_else(|_| "0".to_string());
    finish_native_span(
        &app,
        span,
        status,
        BTreeMap::from([("resultCount".to_string(), result_count)]),
        error,
    );
    response
}

#[cfg(test)]
mod tests {
    use super::{
        compute_root_source_signature, is_indexable_semantic_file,
        normalize_result_limit, semantic_search_extensions, ExplorerSemanticIndexSummary,
    };
    use std::fs;
    use std::path::Path;
    use tempfile::tempdir;

    #[test]
    fn semantic_search_manifest_contains_common_extensions() {
        let extensions = semantic_search_extensions();
        assert!(extensions.contains("rs"));
        assert!(extensions.contains("md"));
        assert!(extensions.contains("ts"));
    }

    #[test]
    fn semantic_search_result_limit_is_clamped() {
        assert_eq!(normalize_result_limit(None), 60);
        assert_eq!(normalize_result_limit(Some(0)), 1);
        assert_eq!(normalize_result_limit(Some(999)), 250);
    }

    #[test]
    fn semantic_search_rejects_large_or_unknown_files() {
        assert!(is_indexable_semantic_file(Path::new("example.rs"), 128));
        assert!(!is_indexable_semantic_file(Path::new("example.bin"), 128));
        assert!(!is_indexable_semantic_file(Path::new("example.rs"), 3 * 1024 * 1024));
    }

    #[test]
    fn semantic_search_signature_changes_when_indexable_files_change() {
        let temp = tempdir().expect("tempdir");
        let root = temp.path();
        fs::write(root.join("first.rs"), "fn main() {}\n").expect("write first");
        let (before, count_before) = compute_root_source_signature(root).expect("signature before");
        fs::write(root.join("second.ts"), "export const value = 1;\n").expect("write second");
        let (after, count_after) = compute_root_source_signature(root).expect("signature after");
        assert_ne!(before, after);
        assert_eq!(count_before, 1);
        assert_eq!(count_after, 2);
    }

    #[test]
    fn semantic_search_summary_defaults_to_not_indexed() {
        let summary = ExplorerSemanticIndexSummary {
            root_path: "/tmp/example".to_string(),
            indexed: false,
            stale: false,
            file_count: 0,
            chunk_count: 0,
            indexed_at: None,
            model_id: None,
            backend_kind: None,
            provider_kind: None,
            last_error: None,
        };
        assert!(!summary.indexed);
        assert_eq!(summary.file_count, 0);
    }
}
