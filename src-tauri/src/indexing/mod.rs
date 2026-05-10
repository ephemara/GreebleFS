use crate::explorer_identity::{build_content_revision, build_virtual_identity};
use crate::explorer_path_key::ExplorerPathKey;
use crate::fs_commands::FileEntry;
use crate::native_pool_snapshots::{
    encode_directory_listing_snapshot, DirectoryListingSnapshotEntry,
    DirectoryListingSnapshotIdentityKind,
};
use crate::native_task_graph::{
    NativeTaskCancellationToken, NativeTaskGraphManager, NativeTaskLane, NativeTaskPriority,
    NativeTaskRequest, NativeTaskWorkKey,
};
use notify::{Event, RecommendedWatcher, RecursiveMode, Watcher};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager, State};
use uuid::Uuid;

#[cfg(target_os = "windows")]
mod windows_usn;

const PATH_INDEX_DB_ENV: &str = "GREEBLEFS_PATH_INDEX_DB_PATH";
const PATH_INDEX_SCHEMA_VERSION: i64 = 1;

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PathIndexStartRequest {
    pub root_path: String,
    pub force_rebuild: Option<bool>,
    pub recursive_fallback: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PathIndexStartResponse {
    pub task_id: Option<String>,
    pub root_path: String,
    pub root_key: String,
    pub state: String,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PathIndexStatus {
    pub enabled: bool,
    pub database_path: String,
    pub active_tasks: Vec<PathIndexActiveTask>,
    pub roots: Vec<PathIndexRootStatus>,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PathIndexActiveTask {
    pub root_key: String,
    pub task_id: String,
    pub started_at_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PathIndexRootStatus {
    pub root_path: String,
    pub root_key: String,
    pub volume_key: String,
    pub state: String,
    pub source: String,
    pub entry_count: u64,
    pub directory_count: u64,
    pub file_count: u64,
    pub last_indexed_at_ms: Option<u64>,
    pub last_error: Option<String>,
    pub journal_id: Option<u64>,
    pub last_usn: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PathIndexListDirectoryRequest {
    pub path: String,
    pub show_hidden: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PathIndexSearchRequest {
    pub root_path: Option<String>,
    pub query: String,
    pub limit: Option<u32>,
    pub include_hidden: Option<bool>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NativePoolPathIndexListDirSnapshotArgs {
    path: String,
    show_hidden: bool,
    stream_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct NativePoolPostedPayloadResponse {
    stream_id: String,
    sequence: u64,
    byte_length: u64,
    schema_version: Option<u32>,
    entry_count: Option<u64>,
    allocation_count: u64,
    reuse_count: u64,
    copy_count: u64,
    copied_bytes: u64,
    webview_post_time_us: u64,
}

#[derive(Debug, Clone)]
struct PathIndexBuildInput {
    requested_root_path: PathBuf,
    requested_root_key: String,
    recursive_fallback: bool,
}

#[derive(Debug, Clone)]
struct IndexedPathRecord {
    path: String,
    path_key: String,
    parent_path: String,
    parent_key: String,
    name: String,
    name_lower: String,
    extension: String,
    size: u64,
    modified_ms: u64,
    is_dir: bool,
    is_hidden: bool,
    is_symlink: bool,
    file_ref: Option<String>,
    parent_file_ref: Option<String>,
}

#[derive(Debug)]
struct IndexedPathBuildOutput {
    source: String,
    volume_key: String,
    journal_id: Option<u64>,
    last_usn: Option<i64>,
    records: Vec<IndexedPathRecord>,
}

#[derive(Debug, Clone)]
struct ActivePathIndexTask {
    task_id: String,
    started_at_ms: u64,
}

struct PathIndexInner {
    db_path: PathBuf,
    event_sender: mpsc::Sender<PathIndexFsEvent>,
    active_tasks: Mutex<HashMap<String, ActivePathIndexTask>>,
    watchers: Mutex<HashMap<String, RecommendedWatcher>>,
    last_error: Mutex<Option<String>>,
}

#[derive(Clone)]
pub struct PathIndexManager {
    inner: Arc<PathIndexInner>,
}

#[derive(Debug, Clone)]
struct PathIndexFsEvent {
    root_key: String,
    paths: Vec<PathBuf>,
}

impl PathIndexManager {
    pub fn from_app(app: &AppHandle) -> Result<Self, String> {
        let db_path = resolve_path_index_db_path(app)?;
        ensure_schema(&db_path)?;
        let (event_sender, event_receiver) = mpsc::channel::<PathIndexFsEvent>();
        let manager = Self {
            inner: Arc::new(PathIndexInner {
                db_path: db_path.clone(),
                event_sender,
                active_tasks: Mutex::new(HashMap::new()),
                watchers: Mutex::new(HashMap::new()),
                last_error: Mutex::new(None),
            }),
        };
        spawn_path_index_event_worker(db_path, event_receiver);
        Ok(manager)
    }

    pub fn status(&self) -> Result<PathIndexStatus, String> {
        let active_tasks = self
            .inner
            .active_tasks
            .lock()
            .map_err(|_| "Path index active task state is poisoned".to_string())?
            .iter()
            .map(|(root_key, task)| PathIndexActiveTask {
                root_key: root_key.clone(),
                task_id: task.task_id.clone(),
                started_at_ms: task.started_at_ms,
            })
            .collect::<Vec<_>>();
        let last_error = self
            .inner
            .last_error
            .lock()
            .map_err(|_| "Path index error state is poisoned".to_string())?
            .clone();
        Ok(PathIndexStatus {
            enabled: true,
            database_path: self.inner.db_path.to_string_lossy().to_string(),
            active_tasks,
            roots: load_root_statuses(&self.inner.db_path)?,
            last_error,
        })
    }

    pub fn start_index(
        &self,
        native_task_graph: NativeTaskGraphManager,
        request: PathIndexStartRequest,
    ) -> Result<PathIndexStartResponse, String> {
        let requested_root_path = normalize_requested_root_path(&request.root_path)?;
        let requested_root_key = ExplorerPathKey::from_path(&requested_root_path).into_string();
        let force_rebuild = request.force_rebuild.unwrap_or(false);
        let recursive_fallback = request.recursive_fallback.unwrap_or(true);

        if !force_rebuild {
            if let Some(root) = load_root_status_for_key(&self.inner.db_path, &requested_root_key)?
            {
                if root.state == "ready" && root.entry_count > 0 {
                    self.register_watcher(requested_root_path.clone(), requested_root_key.clone())?;
                    return Ok(PathIndexStartResponse {
                        task_id: None,
                        root_path: root.root_path,
                        root_key: root.root_key,
                        state: root.state,
                        source: root.source,
                    });
                }
            }
        }

        {
            let active = self
                .inner
                .active_tasks
                .lock()
                .map_err(|_| "Path index active task state is poisoned".to_string())?;
            if let Some(task) = active.get(&requested_root_key) {
                return Ok(PathIndexStartResponse {
                    task_id: Some(task.task_id.clone()),
                    root_path: requested_root_path.to_string_lossy().to_string(),
                    root_key: requested_root_key,
                    state: "building".to_string(),
                    source: "activeTask".to_string(),
                });
            }
        }

        mark_root_building(
            &self.inner.db_path,
            &requested_root_path,
            &requested_root_key,
            "pending",
            None,
            None,
        )?;

        let task_id = Uuid::new_v4().to_string();
        let manager_for_task = self.clone();
        let root_key_for_task = requested_root_key.clone();
        let task_input = PathIndexBuildInput {
            requested_root_path: requested_root_path.clone(),
            requested_root_key: requested_root_key.clone(),
            recursive_fallback,
        };

        let submission = native_task_graph.submit_blocking(
            NativeTaskRequest::new(
                NativeTaskLane::Indexing,
                NativeTaskPriority::Prefetch,
                format!(
                    "Index filesystem hierarchy: {}",
                    requested_root_path.display()
                ),
            )
            .with_task_id(task_id.clone())
            .with_work_key(NativeTaskWorkKey::new(format!(
                "path-index:{}",
                requested_root_key
            )))
            .cancel_stale(true)
            .user_visible(false),
            move |token| manager_for_task.build_index_blocking(task_input, token),
        )?;

        {
            let mut active = self
                .inner
                .active_tasks
                .lock()
                .map_err(|_| "Path index active task state is poisoned".to_string())?;
            active.insert(
                requested_root_key.clone(),
                ActivePathIndexTask {
                    task_id: task_id.clone(),
                    started_at_ms: now_ms(),
                },
            );
        }

        let manager_for_completion = self.clone();
        let task_id_for_completion = task_id.clone();
        tauri::async_runtime::spawn(async move {
            let result = submission.wait().await;
            manager_for_completion.finish_index_task(
                &root_key_for_task,
                &task_id_for_completion,
                result,
            );
        });

        Ok(PathIndexStartResponse {
            task_id: Some(task_id),
            root_path: requested_root_path.to_string_lossy().to_string(),
            root_key: requested_root_key,
            state: "building".to_string(),
            source: "nativeTaskGraph".to_string(),
        })
    }

    pub fn list_directory(&self, path: &str, show_hidden: bool) -> Result<Vec<FileEntry>, String> {
        let path = normalize_requested_root_path(path)?;
        let path_key = ExplorerPathKey::from_path(&path).into_string();
        let root = find_best_ready_root(&self.inner.db_path, &path_key)?
            .ok_or_else(|| format!("Path index has no ready root for {}", path.display()))?;
        let mut entries = load_directory_entries(&self.inner.db_path, root.root_id, &path_key)?;
        if !show_hidden {
            entries.retain(|entry| !entry.is_hidden);
        }
        let mut file_entries = entries
            .into_iter()
            .map(indexed_record_to_file_entry)
            .collect::<Vec<_>>();
        file_entries.sort_by(|left, right| {
            right
                .is_dir
                .cmp(&left.is_dir)
                .then_with(|| left.name.to_lowercase().cmp(&right.name.to_lowercase()))
        });
        Ok(file_entries)
    }

    pub fn search(&self, request: PathIndexSearchRequest) -> Result<Vec<FileEntry>, String> {
        let query = request.query.trim().to_ascii_lowercase();
        if query.is_empty() {
            return Ok(Vec::new());
        }
        let limit = request.limit.unwrap_or(256).clamp(1, 4096);
        let include_hidden = request.include_hidden.unwrap_or(false);
        let root_key = request
            .root_path
            .as_deref()
            .map(normalize_requested_root_path)
            .transpose()?
            .map(|path| ExplorerPathKey::from_path(&path).into_string());
        let records = search_entries(
            &self.inner.db_path,
            root_key.as_deref(),
            &query,
            limit,
            include_hidden,
        )?;
        Ok(records
            .into_iter()
            .map(indexed_record_to_file_entry)
            .collect())
    }

    fn build_index_blocking(
        &self,
        input: PathIndexBuildInput,
        token: NativeTaskCancellationToken,
    ) -> Result<PathIndexRootStatus, String> {
        token.throw_if_cancelled()?;
        let output = build_index_records(&input, &token)?;
        token.throw_if_cancelled()?;
        let status = replace_index_root(
            &self.inner.db_path,
            &input.requested_root_path,
            &input.requested_root_key,
            output,
        )?;
        self.register_watcher(input.requested_root_path, input.requested_root_key)?;
        Ok(status)
    }

    fn register_watcher(&self, root_path: PathBuf, root_key: String) -> Result<(), String> {
        if !root_path.exists() {
            return Ok(());
        }
        {
            let watchers = self
                .inner
                .watchers
                .lock()
                .map_err(|_| "Path index watcher state is poisoned".to_string())?;
            if watchers.contains_key(&root_key) {
                return Ok(());
            }
        }
        let event_sender = self.inner.event_sender.clone();
        let root_key_for_events = root_key.clone();
        let mut watcher = notify::recommended_watcher(move |result: notify::Result<Event>| {
            if let Ok(event) = result {
                let paths = event.paths.into_iter().collect::<Vec<_>>();
                if !paths.is_empty() {
                    let _ = event_sender.send(PathIndexFsEvent {
                        root_key: root_key_for_events.clone(),
                        paths,
                    });
                }
            }
        })
        .map_err(|error| format!("Failed to create path index watcher: {error}"))?;
        watcher
            .watch(&root_path, RecursiveMode::Recursive)
            .map_err(|error| {
                format!(
                    "Failed to watch indexed root {}: {error}",
                    root_path.display()
                )
            })?;
        let mut watchers = self
            .inner
            .watchers
            .lock()
            .map_err(|_| "Path index watcher state is poisoned".to_string())?;
        watchers.insert(root_key, watcher);
        Ok(())
    }

    fn finish_index_task(
        &self,
        root_key: &str,
        task_id: &str,
        result: Result<PathIndexRootStatus, String>,
    ) {
        if let Ok(mut active) = self.inner.active_tasks.lock() {
            if active
                .get(root_key)
                .map(|task| task.task_id.as_str() == task_id)
                .unwrap_or(false)
            {
                active.remove(root_key);
            }
        }
        if let Err(error) = result {
            let _ = mark_root_error(&self.inner.db_path, root_key, &error);
            if let Ok(mut last_error) = self.inner.last_error.lock() {
                *last_error = Some(error);
            }
        }
    }
}

#[tauri::command]
#[specta::specta]
pub fn path_index_get_status(
    manager: State<'_, PathIndexManager>,
) -> Result<PathIndexStatus, String> {
    manager.status()
}

#[tauri::command]
#[specta::specta]
pub fn path_index_start(
    manager: State<'_, PathIndexManager>,
    native_task_graph: State<'_, NativeTaskGraphManager>,
    request: PathIndexStartRequest,
) -> Result<PathIndexStartResponse, String> {
    manager.start_index(native_task_graph.inner().clone(), request)
}

#[tauri::command]
#[specta::specta]
pub fn path_index_list_dir(
    manager: State<'_, PathIndexManager>,
    request: PathIndexListDirectoryRequest,
) -> Result<Vec<FileEntry>, String> {
    manager.list_directory(&request.path, request.show_hidden)
}

#[tauri::command]
#[specta::specta]
pub fn path_index_search(
    manager: State<'_, PathIndexManager>,
    request: PathIndexSearchRequest,
) -> Result<Vec<FileEntry>, String> {
    manager.search(request)
}

pub fn register_native_handlers(app: &AppHandle) -> Result<(), String> {
    let app_for_status = app.clone();
    tauri::native_control::register_handler(app, "explorer", "pathIndexStatus", move |_request| {
        let manager = app_for_status.state::<PathIndexManager>();
        serialize_native_control_response(manager.status()?)
    })?;

    let app_for_start = app.clone();
    tauri::native_control::register_handler(app, "explorer", "pathIndexStart", move |request| {
        let args: PathIndexStartRequest = parse_native_args(request)?;
        let manager = app_for_start.state::<PathIndexManager>();
        let native_task_graph = app_for_start.state::<NativeTaskGraphManager>();
        serialize_native_control_response(
            manager.start_index(native_task_graph.inner().clone(), args)?,
        )
    })?;

    let app_for_search = app.clone();
    tauri::native_control::register_handler(app, "explorer", "pathIndexSearch", move |request| {
        let args: PathIndexSearchRequest = parse_native_args(request)?;
        let manager = app_for_search.state::<PathIndexManager>();
        serialize_native_control_response(manager.search(args)?)
    })?;

    let app_for_list = app.clone();
    tauri::native_control::register_handler(
        app,
        "explorer",
        "pathIndexListDirSnapshot",
        move |request| {
            let webview_label = require_native_pool_webview_label(&request)?;
            let args: NativePoolPathIndexListDirSnapshotArgs = parse_native_args(request)?;
            let stream_id = require_native_pool_stream_id(args.stream_id)?;
            let manager = app_for_list.state::<PathIndexManager>();
            let entries = manager.list_directory(&args.path, args.show_hidden)?;
            let entry_count = entries.len() as u64;
            let bytes = encode_file_entries_snapshot(&entries)?;
            serialize_native_pool_response(post_native_pool_payload(
                &app_for_list,
                &webview_label,
                stream_id,
                bytes,
                Some(1),
                Some(entry_count),
            )?)
        },
    )?;

    Ok(())
}

fn build_index_records(
    input: &PathIndexBuildInput,
    token: &NativeTaskCancellationToken,
) -> Result<IndexedPathBuildOutput, String> {
    #[cfg(target_os = "windows")]
    {
        match windows_usn::build_records_from_usn(&input.requested_root_path, token) {
            Ok(output) => return Ok(output),
            Err(error) if input.recursive_fallback => {
                eprintln!("GreebleFS path index: Windows USN index fallback: {error}");
            }
            Err(error) => return Err(error),
        }
    }

    build_records_by_recursive_walk(&input.requested_root_path, token)
}

fn build_records_by_recursive_walk(
    root_path: &Path,
    token: &NativeTaskCancellationToken,
) -> Result<IndexedPathBuildOutput, String> {
    let mut records = Vec::new();
    collect_walk_records(root_path, &mut records, token)?;
    Ok(IndexedPathBuildOutput {
        source: "recursiveWalk".to_string(),
        volume_key: volume_key_for_path(root_path),
        journal_id: None,
        last_usn: None,
        records: records
            .into_iter()
            .filter(|record| record.path_key != ExplorerPathKey::from_path(root_path).as_str())
            .collect(),
    })
}

fn collect_walk_records(
    directory: &Path,
    records: &mut Vec<IndexedPathRecord>,
    token: &NativeTaskCancellationToken,
) -> Result<(), String> {
    token.throw_if_cancelled()?;
    let read_dir = fs::read_dir(directory).map_err(|error| {
        format!(
            "Failed to walk indexed directory {}: {error}",
            directory.display()
        )
    })?;
    for entry in read_dir {
        token.throw_if_cancelled()?;
        let entry = match entry {
            Ok(value) => value,
            Err(_) => continue,
        };
        let path = entry.path();
        let metadata = match fs::symlink_metadata(&path) {
            Ok(value) => value,
            Err(_) => continue,
        };
        let record = indexed_record_from_metadata(&path, &metadata, None, None);
        let is_dir = record.is_dir;
        let is_symlink = record.is_symlink;
        records.push(record);
        if is_dir && !is_symlink {
            let _ = collect_walk_records(&path, records, token);
        }
    }
    Ok(())
}

fn indexed_record_from_metadata(
    path: &Path,
    metadata: &fs::Metadata,
    file_ref: Option<String>,
    parent_file_ref: Option<String>,
) -> IndexedPathRecord {
    let parent_path = path.parent().unwrap_or(path).to_path_buf();
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_string();
    let file_type = metadata.file_type();
    let is_symlink = file_type.is_symlink();
    let is_dir = metadata.is_dir();
    IndexedPathRecord {
        path: path.to_string_lossy().to_string(),
        path_key: ExplorerPathKey::from_path(path).into_string(),
        parent_path: parent_path.to_string_lossy().to_string(),
        parent_key: ExplorerPathKey::from_path(&parent_path).into_string(),
        name: name.clone(),
        name_lower: name.to_ascii_lowercase(),
        extension: if is_dir {
            String::new()
        } else {
            normalized_extension(path)
        },
        size: if is_dir { 0 } else { metadata.len() },
        modified_ms: metadata_modified_ms(metadata),
        is_dir,
        is_hidden: is_hidden_path(path, metadata),
        is_symlink,
        file_ref,
        parent_file_ref,
    }
}

#[cfg(target_os = "windows")]
fn is_hidden_path(path: &Path, metadata: &fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;
    const FILE_ATTRIBUTE_HIDDEN: u32 = 0x2;
    metadata.file_attributes() & FILE_ATTRIBUTE_HIDDEN != 0
        || path
            .file_name()
            .and_then(|value| value.to_str())
            .map(|name| name.starts_with('.'))
            .unwrap_or(false)
}

#[cfg(not(target_os = "windows"))]
fn is_hidden_path(path: &Path, _metadata: &fs::Metadata) -> bool {
    path.file_name()
        .and_then(|value| value.to_str())
        .map(|name| name.starts_with('.'))
        .unwrap_or(false)
}

fn indexed_record_to_file_entry(mut record: IndexedPathRecord) -> FileEntry {
    hydrate_record_metadata(&mut record);
    let content_revision = build_content_revision(
        record.size,
        record.modified_ms,
        record.is_dir,
        record.is_symlink,
    );
    let identity = build_virtual_identity("path-index", &record.path_key, &content_revision);
    FileEntry {
        name: record.name,
        path: record.path,
        is_dir: record.is_dir,
        size: record.size,
        modified: record.modified_ms,
        extension: record.extension,
        is_hidden: record.is_hidden,
        is_symlink: record.is_symlink,
        entity_id: identity.entity_id,
        identity_kind: identity.identity_kind,
        content_revision: identity.content_revision,
    }
}

fn hydrate_record_metadata(record: &mut IndexedPathRecord) {
    if let Ok(metadata) = fs::symlink_metadata(&record.path) {
        record.is_dir = metadata.is_dir();
        record.is_symlink = metadata.file_type().is_symlink();
        record.size = if record.is_dir { 0 } else { metadata.len() };
        record.modified_ms = metadata_modified_ms(&metadata);
        record.is_hidden = is_hidden_path(Path::new(&record.path), &metadata);
        record.extension = if record.is_dir {
            String::new()
        } else {
            normalized_extension(Path::new(&record.path))
        };
    }
}

fn spawn_path_index_event_worker(
    db_path: PathBuf,
    event_receiver: mpsc::Receiver<PathIndexFsEvent>,
) {
    thread::Builder::new()
        .name("greeblefs-path-index-events".to_string())
        .spawn(move || {
            while let Ok(event) = event_receiver.recv() {
                for path in event.paths {
                    let _ = apply_filesystem_event_path(&db_path, &event.root_key, &path);
                }
            }
        })
        .expect("spawn path index event worker");
}

fn apply_filesystem_event_path(db_path: &Path, root_key: &str, path: &Path) -> Result<(), String> {
    let Some(root) = load_root_record_for_key(db_path, root_key)? else {
        return Ok(());
    };
    let path_key = ExplorerPathKey::from_path(path).into_string();
    if !path.exists() {
        delete_entry_subtree(db_path, root.root_id, &path_key)?;
        return Ok(());
    }
    let metadata = fs::symlink_metadata(path).map_err(|error| {
        format!(
            "Failed to inspect changed indexed path {}: {error}",
            path.display()
        )
    })?;
    let record = indexed_record_from_metadata(path, &metadata, None, None);
    upsert_index_entry(db_path, root.root_id, &record)
}

fn ensure_schema(db_path: &Path) -> Result<(), String> {
    if let Some(parent) = db_path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "Failed to create path index directory {}: {error}",
                parent.display()
            )
        })?;
    }
    let connection = Connection::open(db_path).map_err(|error| {
        format!(
            "Failed to open path index database {}: {error}",
            db_path.display()
        )
    })?;
    connection
        .pragma_update(None, "journal_mode", "WAL")
        .map_err(|error| format!("Failed to enable WAL for path index database: {error}"))?;
    connection
        .pragma_update(None, "synchronous", "NORMAL")
        .map_err(|error| format!("Failed to tune path index database sync mode: {error}"))?;
    connection
        .execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS path_index_meta (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            INSERT OR REPLACE INTO path_index_meta (key, value)
            VALUES ('schemaVersion', '1');

            CREATE TABLE IF NOT EXISTS path_index_roots (
                root_id INTEGER PRIMARY KEY,
                root_path TEXT NOT NULL UNIQUE,
                root_key TEXT NOT NULL UNIQUE,
                volume_key TEXT NOT NULL,
                state TEXT NOT NULL,
                source TEXT NOT NULL,
                journal_id INTEGER,
                last_usn INTEGER,
                indexed_at_ms INTEGER,
                entry_count INTEGER NOT NULL DEFAULT 0,
                directory_count INTEGER NOT NULL DEFAULT 0,
                file_count INTEGER NOT NULL DEFAULT 0,
                last_error TEXT
            );

            CREATE TABLE IF NOT EXISTS path_index_entries (
                root_id INTEGER NOT NULL,
                file_ref TEXT,
                parent_file_ref TEXT,
                path TEXT NOT NULL,
                path_key TEXT NOT NULL,
                parent_path TEXT NOT NULL,
                parent_key TEXT NOT NULL,
                name TEXT NOT NULL,
                name_lower TEXT NOT NULL,
                extension TEXT NOT NULL,
                size INTEGER NOT NULL DEFAULT 0,
                modified_ms INTEGER NOT NULL DEFAULT 0,
                is_dir INTEGER NOT NULL,
                is_hidden INTEGER NOT NULL,
                is_symlink INTEGER NOT NULL,
                PRIMARY KEY(root_id, path_key),
                FOREIGN KEY(root_id) REFERENCES path_index_roots(root_id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_path_index_entries_parent
                ON path_index_entries(root_id, parent_key, is_hidden, name_lower);
            CREATE INDEX IF NOT EXISTS idx_path_index_entries_name
                ON path_index_entries(root_id, name_lower);
            CREATE INDEX IF NOT EXISTS idx_path_index_entries_file_ref
                ON path_index_entries(root_id, file_ref);
            "#,
        )
        .map_err(|error| format!("Failed to initialize path index schema: {error}"))?;
    let schema_version: i64 = connection
        .query_row(
            "SELECT value FROM path_index_meta WHERE key = 'schemaVersion'",
            [],
            |row| row.get::<_, String>(0),
        )
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(0);
    if schema_version != PATH_INDEX_SCHEMA_VERSION {
        return Err(format!(
            "Unsupported path index schema version {schema_version}; expected {PATH_INDEX_SCHEMA_VERSION}"
        ));
    }
    Ok(())
}

fn mark_root_building(
    db_path: &Path,
    root_path: &Path,
    root_key: &str,
    source: &str,
    journal_id: Option<u64>,
    last_usn: Option<i64>,
) -> Result<i64, String> {
    let connection = Connection::open(db_path)
        .map_err(|error| format!("Failed to open path index database: {error}"))?;
    connection
        .execute(
            r#"
            INSERT INTO path_index_roots (
                root_path, root_key, volume_key, state, source, journal_id, last_usn, indexed_at_ms, last_error
            ) VALUES (?1, ?2, ?3, 'building', ?4, ?5, ?6, ?7, NULL)
            ON CONFLICT(root_key) DO UPDATE SET
                root_path = excluded.root_path,
                volume_key = excluded.volume_key,
                state = 'building',
                source = excluded.source,
                journal_id = excluded.journal_id,
                last_usn = excluded.last_usn,
                indexed_at_ms = excluded.indexed_at_ms,
                last_error = NULL
            "#,
            params![
                root_path.to_string_lossy().to_string(),
                root_key,
                volume_key_for_path(root_path),
                source,
                journal_id.map(|value| value as i64),
                last_usn,
                now_ms() as i64
            ],
        )
        .map_err(|error| format!("Failed to mark path index root as building: {error}"))?;
    connection
        .query_row(
            "SELECT root_id FROM path_index_roots WHERE root_key = ?1",
            params![root_key],
            |row| row.get::<_, i64>(0),
        )
        .map_err(|error| format!("Failed to load path index root id: {error}"))
}

fn replace_index_root(
    db_path: &Path,
    root_path: &Path,
    root_key: &str,
    output: IndexedPathBuildOutput,
) -> Result<PathIndexRootStatus, String> {
    let mut connection = Connection::open(db_path)
        .map_err(|error| format!("Failed to open path index database: {error}"))?;
    let tx = connection
        .transaction()
        .map_err(|error| format!("Failed to start path index transaction: {error}"))?;
    tx.execute(
        r#"
        INSERT INTO path_index_roots (
            root_path, root_key, volume_key, state, source, journal_id, last_usn, indexed_at_ms, last_error
        ) VALUES (?1, ?2, ?3, 'building', ?4, ?5, ?6, ?7, NULL)
        ON CONFLICT(root_key) DO UPDATE SET
            root_path = excluded.root_path,
            volume_key = excluded.volume_key,
            state = 'building',
            source = excluded.source,
            journal_id = excluded.journal_id,
            last_usn = excluded.last_usn,
            indexed_at_ms = excluded.indexed_at_ms,
            last_error = NULL
        "#,
        params![
            root_path.to_string_lossy().to_string(),
            root_key,
            output.volume_key,
            output.source,
            output.journal_id.map(|value| value as i64),
            output.last_usn,
            now_ms() as i64
        ],
    )
    .map_err(|error| format!("Failed to upsert path index root: {error}"))?;
    let root_id: i64 = tx
        .query_row(
            "SELECT root_id FROM path_index_roots WHERE root_key = ?1",
            params![root_key],
            |row| row.get(0),
        )
        .map_err(|error| format!("Failed to resolve path index root id: {error}"))?;
    tx.execute(
        "DELETE FROM path_index_entries WHERE root_id = ?1",
        params![root_id],
    )
    .map_err(|error| format!("Failed to clear old path index entries: {error}"))?;
    {
        let mut insert = tx
            .prepare(
                r#"
                INSERT OR REPLACE INTO path_index_entries (
                    root_id, file_ref, parent_file_ref, path, path_key, parent_path, parent_key,
                    name, name_lower, extension, size, modified_ms, is_dir, is_hidden, is_symlink
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
                "#,
            )
            .map_err(|error| format!("Failed to prepare path index insert: {error}"))?;
        for record in &output.records {
            insert_index_record(root_id, record, &mut insert)?;
        }
    }
    let directory_count = output.records.iter().filter(|entry| entry.is_dir).count() as i64;
    let file_count = output.records.len() as i64 - directory_count;
    tx.execute(
        r#"
        UPDATE path_index_roots
        SET state = 'ready',
            entry_count = ?2,
            directory_count = ?3,
            file_count = ?4,
            indexed_at_ms = ?5,
            last_error = NULL
        WHERE root_id = ?1
        "#,
        params![
            root_id,
            output.records.len() as i64,
            directory_count,
            file_count,
            now_ms() as i64
        ],
    )
    .map_err(|error| format!("Failed to finalize path index root: {error}"))?;
    tx.commit()
        .map_err(|error| format!("Failed to commit path index transaction: {error}"))?;
    load_root_status_for_key(db_path, root_key)?
        .ok_or_else(|| "Path index root disappeared after commit".to_string())
}

fn insert_index_record(
    root_id: i64,
    record: &IndexedPathRecord,
    statement: &mut rusqlite::Statement<'_>,
) -> Result<(), String> {
    statement
        .execute(params![
            root_id,
            record.file_ref,
            record.parent_file_ref,
            record.path,
            record.path_key,
            record.parent_path,
            record.parent_key,
            record.name,
            record.name_lower,
            record.extension,
            clamp_u64_to_i64(record.size),
            clamp_u64_to_i64(record.modified_ms),
            if record.is_dir { 1 } else { 0 },
            if record.is_hidden { 1 } else { 0 },
            if record.is_symlink { 1 } else { 0 }
        ])
        .map_err(|error| format!("Failed to insert path index entry {}: {error}", record.path))?;
    Ok(())
}

fn upsert_index_entry(
    db_path: &Path,
    root_id: i64,
    record: &IndexedPathRecord,
) -> Result<(), String> {
    let connection = Connection::open(db_path)
        .map_err(|error| format!("Failed to open path index database: {error}"))?;
    connection
        .execute(
            r#"
            INSERT OR REPLACE INTO path_index_entries (
                root_id, file_ref, parent_file_ref, path, path_key, parent_path, parent_key,
                name, name_lower, extension, size, modified_ms, is_dir, is_hidden, is_symlink
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
            "#,
            params![
                root_id,
                record.file_ref,
                record.parent_file_ref,
                record.path,
                record.path_key,
                record.parent_path,
                record.parent_key,
                record.name,
                record.name_lower,
                record.extension,
                clamp_u64_to_i64(record.size),
                clamp_u64_to_i64(record.modified_ms),
                if record.is_dir { 1 } else { 0 },
                if record.is_hidden { 1 } else { 0 },
                if record.is_symlink { 1 } else { 0 }
            ],
        )
        .map_err(|error| format!("Failed to upsert path index entry: {error}"))?;
    Ok(())
}

fn delete_entry_subtree(db_path: &Path, root_id: i64, path_key: &str) -> Result<(), String> {
    let connection = Connection::open(db_path)
        .map_err(|error| format!("Failed to open path index database: {error}"))?;
    let prefix = format!(
        "{}{}",
        path_key.trim_end_matches('\\').trim_end_matches('/'),
        path_separator()
    );
    connection
        .execute(
            "DELETE FROM path_index_entries WHERE root_id = ?1 AND (path_key = ?2 OR path_key LIKE ?3)",
            params![root_id, path_key, format!("{prefix}%")],
        )
        .map_err(|error| format!("Failed to delete path index subtree: {error}"))?;
    Ok(())
}

fn mark_root_error(db_path: &Path, root_key: &str, error: &str) -> Result<(), String> {
    let connection = Connection::open(db_path)
        .map_err(|error| format!("Failed to open path index database: {error}"))?;
    connection
        .execute(
            "UPDATE path_index_roots SET state = 'error', last_error = ?2 WHERE root_key = ?1",
            params![root_key, error],
        )
        .map_err(|error| format!("Failed to mark path index root error: {error}"))?;
    Ok(())
}

#[derive(Debug)]
struct PathIndexRootRecord {
    root_id: i64,
    root_key: String,
}

fn load_root_statuses(db_path: &Path) -> Result<Vec<PathIndexRootStatus>, String> {
    let connection = Connection::open(db_path)
        .map_err(|error| format!("Failed to open path index database: {error}"))?;
    let mut statement = connection
        .prepare(
            r#"
            SELECT root_path, root_key, volume_key, state, source, entry_count,
                   directory_count, file_count, indexed_at_ms, last_error, journal_id, last_usn
            FROM path_index_roots
            ORDER BY indexed_at_ms DESC, root_path ASC
            "#,
        )
        .map_err(|error| format!("Failed to prepare path index status query: {error}"))?;
    let rows = statement
        .query_map([], row_to_root_status)
        .map_err(|error| format!("Failed to query path index status: {error}"))?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Failed to read path index status row: {error}"))
}

fn load_root_status_for_key(
    db_path: &Path,
    root_key: &str,
) -> Result<Option<PathIndexRootStatus>, String> {
    let connection = Connection::open(db_path)
        .map_err(|error| format!("Failed to open path index database: {error}"))?;
    connection
        .query_row(
            r#"
            SELECT root_path, root_key, volume_key, state, source, entry_count,
                   directory_count, file_count, indexed_at_ms, last_error, journal_id, last_usn
            FROM path_index_roots
            WHERE root_key = ?1
            "#,
            params![root_key],
            row_to_root_status,
        )
        .optional()
        .map_err(|error| format!("Failed to load path index root status: {error}"))
}

fn load_root_record_for_key(
    db_path: &Path,
    root_key: &str,
) -> Result<Option<PathIndexRootRecord>, String> {
    let connection = Connection::open(db_path)
        .map_err(|error| format!("Failed to open path index database: {error}"))?;
    connection
        .query_row(
            "SELECT root_id, root_path, root_key, state FROM path_index_roots WHERE root_key = ?1",
            params![root_key],
            |row| {
                Ok(PathIndexRootRecord {
                    root_id: row.get(0)?,
                    root_key: row.get(2)?,
                })
            },
        )
        .optional()
        .map_err(|error| format!("Failed to load path index root record: {error}"))
}

fn find_best_ready_root(
    db_path: &Path,
    path_key: &str,
) -> Result<Option<PathIndexRootRecord>, String> {
    let connection = Connection::open(db_path)
        .map_err(|error| format!("Failed to open path index database: {error}"))?;
    let mut statement = connection
        .prepare(
            "SELECT root_id, root_path, root_key, state FROM path_index_roots WHERE state = 'ready'",
        )
        .map_err(|error| format!("Failed to prepare path index root lookup: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok(PathIndexRootRecord {
                root_id: row.get(0)?,
                root_key: row.get(2)?,
            })
        })
        .map_err(|error| format!("Failed to query path index roots: {error}"))?;
    let mut best: Option<PathIndexRootRecord> = None;
    for row in rows {
        let root = row.map_err(|error| format!("Failed to read path index root: {error}"))?;
        let root_key = ExplorerPathKey::from_raw(&root.root_key);
        let candidate_key = ExplorerPathKey::from_raw(path_key);
        if candidate_key.is_same_or_descendant_of(&root_key)
            && best
                .as_ref()
                .map(|current| root.root_key.len() > current.root_key.len())
                .unwrap_or(true)
        {
            best = Some(root);
        }
    }
    Ok(best)
}

fn load_directory_entries(
    db_path: &Path,
    root_id: i64,
    parent_key: &str,
) -> Result<Vec<IndexedPathRecord>, String> {
    let connection = Connection::open(db_path)
        .map_err(|error| format!("Failed to open path index database: {error}"))?;
    let mut statement = connection
        .prepare(
            r#"
            SELECT file_ref, parent_file_ref, path, path_key, parent_path, parent_key,
                   name, name_lower, extension, size, modified_ms, is_dir, is_hidden, is_symlink
            FROM path_index_entries
            WHERE root_id = ?1 AND parent_key = ?2
            "#,
        )
        .map_err(|error| format!("Failed to prepare indexed directory query: {error}"))?;
    let rows = statement
        .query_map(params![root_id, parent_key], row_to_index_record)
        .map_err(|error| format!("Failed to query indexed directory: {error}"))?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Failed to read indexed directory row: {error}"))
}

fn search_entries(
    db_path: &Path,
    root_key: Option<&str>,
    query: &str,
    limit: u32,
    include_hidden: bool,
) -> Result<Vec<IndexedPathRecord>, String> {
    let connection = Connection::open(db_path)
        .map_err(|error| format!("Failed to open path index database: {error}"))?;
    let sql = if root_key.is_some() {
        r#"
        SELECT entry.file_ref, entry.parent_file_ref, entry.path, entry.path_key, entry.parent_path,
               entry.parent_key, entry.name, entry.name_lower, entry.extension, entry.size,
               entry.modified_ms, entry.is_dir, entry.is_hidden, entry.is_symlink
        FROM path_index_entries entry
        JOIN path_index_roots root ON root.root_id = entry.root_id
        WHERE root.state = 'ready'
          AND (?1 IS NULL OR root.root_key = ?1 OR entry.path_key LIKE ?1 || ?2)
          AND entry.name_lower LIKE ?3
          AND (?4 OR entry.is_hidden = 0)
        ORDER BY entry.is_dir DESC, entry.name_lower ASC
        LIMIT ?5
        "#
    } else {
        r#"
        SELECT entry.file_ref, entry.parent_file_ref, entry.path, entry.path_key, entry.parent_path,
               entry.parent_key, entry.name, entry.name_lower, entry.extension, entry.size,
               entry.modified_ms, entry.is_dir, entry.is_hidden, entry.is_symlink
        FROM path_index_entries entry
        JOIN path_index_roots root ON root.root_id = entry.root_id
        WHERE root.state = 'ready'
          AND entry.name_lower LIKE ?3
          AND (?4 OR entry.is_hidden = 0)
        ORDER BY entry.is_dir DESC, entry.name_lower ASC
        LIMIT ?5
        "#
    };
    let mut statement = connection
        .prepare(sql)
        .map_err(|error| format!("Failed to prepare path index search: {error}"))?;
    let rows = statement
        .query_map(
            params![
                root_key,
                format!("{}{}", path_separator(), "%"),
                format!("%{query}%"),
                include_hidden,
                limit as i64
            ],
            row_to_index_record,
        )
        .map_err(|error| format!("Failed to query path index search: {error}"))?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Failed to read path index search row: {error}"))
}

fn row_to_root_status(row: &rusqlite::Row<'_>) -> rusqlite::Result<PathIndexRootStatus> {
    let indexed_at_ms = row
        .get::<_, Option<i64>>(8)?
        .map(|value| value.max(0) as u64);
    let journal_id = row
        .get::<_, Option<i64>>(10)?
        .map(|value| value.max(0) as u64);
    Ok(PathIndexRootStatus {
        root_path: row.get(0)?,
        root_key: row.get(1)?,
        volume_key: row.get(2)?,
        state: row.get(3)?,
        source: row.get(4)?,
        entry_count: row.get::<_, i64>(5)?.max(0) as u64,
        directory_count: row.get::<_, i64>(6)?.max(0) as u64,
        file_count: row.get::<_, i64>(7)?.max(0) as u64,
        last_indexed_at_ms: indexed_at_ms,
        last_error: row.get(9)?,
        journal_id,
        last_usn: row.get(11)?,
    })
}

fn row_to_index_record(row: &rusqlite::Row<'_>) -> rusqlite::Result<IndexedPathRecord> {
    Ok(IndexedPathRecord {
        file_ref: row.get(0)?,
        parent_file_ref: row.get(1)?,
        path: row.get(2)?,
        path_key: row.get(3)?,
        parent_path: row.get(4)?,
        parent_key: row.get(5)?,
        name: row.get(6)?,
        name_lower: row.get(7)?,
        extension: row.get(8)?,
        size: row.get::<_, i64>(9)?.max(0) as u64,
        modified_ms: row.get::<_, i64>(10)?.max(0) as u64,
        is_dir: row.get::<_, i64>(11)? != 0,
        is_hidden: row.get::<_, i64>(12)? != 0,
        is_symlink: row.get::<_, i64>(13)? != 0,
    })
}

fn parse_native_args<T: for<'de> Deserialize<'de>>(
    request: tauri::native_control::NativeControlRequest,
) -> Result<T, String> {
    serde_json::from_value(request.args)
        .map_err(|error| format!("Invalid path index native args: {error}"))
}

fn require_native_pool_stream_id(stream_id: String) -> Result<String, String> {
    let trimmed = stream_id.trim();
    if trimmed.is_empty() {
        return Err("path index native pool request requires streamId".to_string());
    }
    Ok(trimmed.to_string())
}

fn require_native_pool_webview_label(
    request: &tauri::native_control::NativeControlRequest,
) -> Result<String, String> {
    request
        .webview_label
        .as_ref()
        .map(|label| label.trim())
        .filter(|label| !label.is_empty())
        .map(ToString::to_string)
        .ok_or_else(|| "path index native pool request requires a WebView label".to_string())
}

fn serialize_native_pool_response(
    response: NativePoolPostedPayloadResponse,
) -> Result<serde_json::Value, String> {
    serde_json::to_value(response)
        .map_err(|error| format!("Failed to serialize path index native pool response: {error}"))
}

fn serialize_native_control_response<T: Serialize>(
    response: T,
) -> Result<serde_json::Value, String> {
    serde_json::to_value(response)
        .map_err(|error| format!("Failed to serialize path index native control response: {error}"))
}

fn post_native_pool_payload(
    app: &AppHandle,
    webview_label: &str,
    stream_id: String,
    bytes: Vec<u8>,
    schema_version: Option<u32>,
    entry_count: Option<u64>,
) -> Result<NativePoolPostedPayloadResponse, String> {
    let Some(webview_window) = app.get_webview_window(webview_label) else {
        return Err(format!(
            "path index native pool WebView not found for label '{webview_label}'"
        ));
    };
    let state = app.state::<tauri::native_buffer_pool::NativeBufferPoolState>();
    let metrics = tauri::native_buffer_pool::post_pooled_packet_to_webview(
        webview_window.as_ref(),
        state.inner(),
        webview_label,
        &stream_id,
        0,
        &bytes,
    )?;
    Ok(NativePoolPostedPayloadResponse {
        stream_id,
        sequence: 0,
        byte_length: bytes.len() as u64,
        schema_version,
        entry_count,
        allocation_count: metrics.allocation_count,
        reuse_count: metrics.reuse_count,
        copy_count: metrics.copy_count,
        copied_bytes: metrics.copied_bytes,
        webview_post_time_us: metrics.webview_post_time_us,
    })
}

fn encode_file_entries_snapshot(entries: &[FileEntry]) -> Result<Vec<u8>, String> {
    let snapshot_entries = entries
        .iter()
        .map(|entry| DirectoryListingSnapshotEntry {
            name: &entry.name,
            path: &entry.path,
            extension: &entry.extension,
            entity_id: &entry.entity_id,
            content_revision: &entry.content_revision,
            size: entry.size,
            modified: entry.modified,
            is_dir: entry.is_dir,
            is_hidden: entry.is_hidden,
            is_symlink: entry.is_symlink,
            identity_kind: match entry.identity_kind {
                crate::explorer_identity::ExplorerIdentityKind::Native => {
                    DirectoryListingSnapshotIdentityKind::Native
                }
                crate::explorer_identity::ExplorerIdentityKind::Operation => {
                    DirectoryListingSnapshotIdentityKind::Operation
                }
                crate::explorer_identity::ExplorerIdentityKind::Derived => {
                    DirectoryListingSnapshotIdentityKind::Derived
                }
            },
        })
        .collect::<Vec<_>>();
    encode_directory_listing_snapshot(&snapshot_entries)
}

fn normalize_requested_root_path(raw: &str) -> Result<PathBuf, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err("Path index root path cannot be empty".to_string());
    }
    let normalized =
        if cfg!(target_os = "windows") && trimmed.len() == 2 && trimmed.as_bytes()[1] == b':' {
            format!("{trimmed}\\")
        } else {
            trimmed.to_string()
        };
    Ok(PathBuf::from(normalized))
}

fn normalized_extension(path: &Path) -> String {
    path.extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
}

fn metadata_modified_ms(metadata: &fs::Metadata) -> u64 {
    metadata
        .modified()
        .ok()
        .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

fn resolve_path_index_db_path(app: &AppHandle) -> Result<PathBuf, String> {
    if let Ok(path) = std::env::var(PATH_INDEX_DB_ENV) {
        let trimmed = path.trim();
        if !trimmed.is_empty() {
            return Ok(PathBuf::from(trimmed));
        }
    }
    Ok(app
        .path()
        .app_local_data_dir()
        .map_err(|error| format!("Failed to resolve app local data directory: {error}"))?
        .join("indexing")
        .join("path-index.sqlite3"))
}

fn volume_key_for_path(path: &Path) -> String {
    #[cfg(target_os = "windows")]
    {
        let value = path.to_string_lossy();
        let bytes = value.as_bytes();
        if bytes.len() >= 2 && bytes[1] == b':' {
            return value[..2].to_ascii_uppercase();
        }
    }
    path.components()
        .next()
        .map(|component| component.as_os_str().to_string_lossy().to_string())
        .unwrap_or_else(|| "/".to_string())
}

fn path_separator() -> &'static str {
    if cfg!(target_os = "windows") {
        "\\"
    } else {
        "/"
    }
}

fn clamp_u64_to_i64(value: u64) -> i64 {
    value.min(i64::MAX as u64) as i64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_drive_roots() {
        let path = normalize_requested_root_path("D:").unwrap();
        if cfg!(target_os = "windows") {
            assert_eq!(path.to_string_lossy(), "D:\\");
        }
    }
}
