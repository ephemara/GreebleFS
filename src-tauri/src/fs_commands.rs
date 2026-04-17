// File system commands for the OverlayTerm file explorer
// Provides: dir listing with metadata, Windows drive enumeration,
// open-with-default-app, open-as-admin (runas), delete, rename, copy.

use crate::archive_ops::{
    self, FsArchiveExtractionMode, FsArchiveExtractionRequest, FsArchiveExtractionResult,
};
use crate::entry_size_cache::{
    delete_entry_size_subtree, load_entry_size_cache, mark_path_and_ancestors_dirty,
    normalize_cache_path, upsert_entry_size_cache, PersistedEntrySize,
};
use crate::explorer_pro_commands::FsBatchRenameItem;
use md5::Context as Md5Context;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::AppHandle;
use tauri_specta::Event;
use uuid::Uuid;
use sha2::{Digest, Sha256};
use yazi_fs::{
    cha::{Cha, ChaType},
    provider::{local::Local, DirReader, FileHolder, Provider},
};
use yazi_scheduler::{
    Scheduler as YaziScheduler, TaskSnap as YaziTaskSnap, TaskTicket as YaziTaskTicket,
};
use yazi_shared::{path::PathLike, strand::StrandLike, url::UrlBuf, Id as YaziTaskId};
use yazi_vfs::provider as yazi_provider;

#[cfg(test)]
use std::sync::atomic::{AtomicU64, Ordering};

#[cfg(target_os = "windows")]
use windows_sys::Win32::{
    Foundation::CloseHandle,
    Security::{GetTokenInformation, TokenElevation, TOKEN_ELEVATION, TOKEN_QUERY},
    System::Threading::{GetCurrentProcess, OpenProcessToken},
};

// ─── Data types ───────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: u64, // unix timestamp millis
    pub extension: String,
    pub is_hidden: bool,
    pub is_symlink: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type)]
pub struct DriveInfo {
    pub letter: String,
    pub label: String,
    pub total_bytes: u64,
    pub free_bytes: u64,
    pub drive_type: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type)]
pub struct EntryStorageInfo {
    pub path: String,
    pub bytes: u64,
    pub is_dir: bool,
    pub is_complete: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct FsChecksumEntryInfo {
    pub path: String,
    pub bytes: u64,
    pub is_dir: bool,
    pub md5: Option<String>,
    pub sha256: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct FsPermissionInfo {
    pub readonly: bool,
    pub display: String,
    pub unix_mode: Option<u32>,
    pub unix_mode_octal: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct FsItemPropertiesInfo {
    pub path: String,
    pub name: String,
    pub is_dir: bool,
    pub is_symlink: bool,
    pub bytes: u64,
    pub modified_at_ms: Option<u64>,
    pub created_at_ms: Option<u64>,
    pub accessed_at_ms: Option<u64>,
    pub permissions: FsPermissionInfo,
}

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct FsJumpFilterEntry {
    pub path: String,
    pub name: String,
    pub is_dir: bool,
    pub sort_order: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct FsJumpFilterRequest {
    pub query: String,
    pub entries: Vec<FsJumpFilterEntry>,
    pub limit: Option<usize>,
}

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct FsJumpFilterMatch {
    pub path: String,
    pub name: String,
    pub is_dir: bool,
    pub sort_order: u64,
    pub score: i64,
    pub matched_indices: Vec<usize>,
}

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type)]
#[serde(tag = "kind", content = "value", rename_all = "camelCase")]
pub enum FsWriteFileContent {
    Text(String),
    Bytes(Vec<u8>),
}

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type, tauri_specta::Event)]
#[serde(rename_all = "camelCase")]
pub struct ExplorerTaskProgressEvent {
    pub task_id: String,
    pub task: ExplorerTaskRecord,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum ExplorerTaskKind {
    Copy,
    Move,
    Delete,
    Trash,
    BatchRename,
    DuplicateScan,
    ExtractArchive,
    RecursiveSize,
    Checksum,
    AudioTransform,
    AudioBatchProcess,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum ExplorerTaskStatus {
    Running,
    Succeeded,
    Failed,
    Cancelled,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum ExplorerTaskHistoryClearScope {
    Completed,
    Failed,
    Finished,
}

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ExplorerTaskRecord {
    pub id: String,
    pub kind: ExplorerTaskKind,
    pub status: ExplorerTaskStatus,
    pub title: String,
    pub detail: String,
    pub progress_current: Option<u64>,
    pub progress_total: Option<u64>,
    pub started_at: u64,
    pub finished_at: Option<u64>,
    pub source_paths: Vec<String>,
    pub destination_path: Option<String>,
    pub error_message: Option<String>,
    pub can_retry: bool,
    pub can_cancel: bool,
    pub can_reveal_output: bool,
    pub can_open_output: bool,
    pub can_undo: bool,
    pub scheduler_task: Option<yazi_specta::YaziSchedulerTaskSnap>,
}

#[derive(Debug, Clone)]
pub(crate) struct ExplorerTaskRegistration {
    pub kind: ExplorerTaskKind,
    pub title: String,
    pub detail: String,
    pub source_paths: Vec<String>,
    pub destination_path: Option<String>,
    pub retry_context: Option<ExplorerTaskRetryContext>,
    pub can_undo: bool,
}

#[derive(Debug, Clone)]
pub(crate) enum ExplorerTaskRetryContext {
    Copy {
        source_path: String,
        destination_path: String,
    },
    Move {
        source_path: String,
        destination_path: String,
    },
    Delete {
        path: String,
        recursive: bool,
    },
    BatchRename {
        items: Vec<FsBatchRenameItem>,
    },
    DuplicateScan {
        root_path: String,
    },
    RecursiveSize {
        paths: Vec<String>,
        force_refresh: bool,
    },
    Checksum {
        paths: Vec<String>,
    },
    ArchiveExtraction {
        request: FsArchiveExtractionRequest,
    },
    AudioTransform {
        request: crate::audio_commands::AudioTransformRequest,
    },
    AudioBatchProcess {
        request: crate::audio_commands::AudioBatchProcessRequest,
    },
}

#[derive(Debug, Clone)]
pub(crate) enum ExplorerTaskCancelContext {
    Yazi { scheduler_task_id: YaziTaskId },
    DuplicateScan { scan_id: String },
    AudioOperation { operation_id: String },
}

#[derive(Debug, Clone)]
struct ExplorerTaskRegistryEntry {
    record: ExplorerTaskRecord,
    retry_context: Option<ExplorerTaskRetryContext>,
    cancel_context: Option<ExplorerTaskCancelContext>,
    cancel_requested: bool,
}

#[derive(Debug, Default)]
struct ExplorerTaskRegistry {
    order: Vec<String>,
    entries: HashMap<String, ExplorerTaskRegistryEntry>,
}

#[derive(Debug, Clone)]
struct CachedEntrySize {
    bytes: u64,
    is_dir: bool,
    is_complete: bool,
    measured_at: Instant,
}

#[derive(Debug, Clone)]
struct CachedDirListing {
    entries: Vec<FileEntry>,
    directory_modified_ms: Option<u64>,
    cached_at: Instant,
}

#[derive(Debug, Clone, Default)]
struct CachedDirListingVariants {
    visible_only: Option<CachedDirListing>,
    include_hidden: Option<CachedDirListing>,
}

impl CachedDirListingVariants {
    fn get(&self, show_hidden: bool) -> Option<&CachedDirListing> {
        if show_hidden {
            self.include_hidden.as_ref()
        } else {
            self.visible_only.as_ref()
        }
    }

    fn set(&mut self, show_hidden: bool, listing: CachedDirListing) {
        if show_hidden {
            self.include_hidden = Some(listing);
        } else {
            self.visible_only = Some(listing);
        }
    }
}

#[derive(Debug, Clone)]
struct CachedSearchNameEntry {
    name_lower: String,
    path_lower: String,
    result: FileSearchResult,
}

#[derive(Debug, Clone)]
struct CachedSearchIndex {
    entries: Vec<CachedSearchNameEntry>,
    cached_at: Instant,
}

#[derive(Debug, Clone, Default)]
struct CachedSearchIndexVariants {
    visible_only: Option<CachedSearchIndex>,
    include_hidden: Option<CachedSearchIndex>,
}

impl CachedSearchIndexVariants {
    fn get(&self, show_hidden: bool) -> Option<&CachedSearchIndex> {
        if show_hidden {
            self.include_hidden.as_ref()
        } else {
            self.visible_only.as_ref()
        }
    }

    fn set(&mut self, show_hidden: bool, index: CachedSearchIndex) {
        if show_hidden {
            self.include_hidden = Some(index);
        } else {
            self.visible_only = Some(index);
        }
    }
}

#[derive(Debug, Clone)]
struct CachedSearchContentEntry {
    name_lower: String,
    result: FileSearchResult,
    content: Option<Arc<str>>,
}

#[derive(Debug, Clone)]
struct CachedSearchContentIndex {
    entries: Vec<CachedSearchContentEntry>,
    cached_at: Instant,
}

#[derive(Debug, Clone, Default)]
struct CachedSearchContentIndexVariants {
    visible_only: Option<CachedSearchContentIndex>,
    include_hidden: Option<CachedSearchContentIndex>,
}

impl CachedSearchContentIndexVariants {
    fn get(&self, show_hidden: bool) -> Option<&CachedSearchContentIndex> {
        if show_hidden {
            self.include_hidden.as_ref()
        } else {
            self.visible_only.as_ref()
        }
    }

    fn set(&mut self, show_hidden: bool, index: CachedSearchContentIndex) {
        if show_hidden {
            self.include_hidden = Some(index);
        } else {
            self.visible_only = Some(index);
        }
    }
}

const DIR_LIST_CACHE_TTL_ENV: &str = "OVERLAYTERM_DIR_LIST_CACHE_TTL_MS";
const SEARCH_NAME_INDEX_CACHE_TTL_ENV: &str = "OVERLAYTERM_SEARCH_NAME_INDEX_CACHE_TTL_MS";
const SEARCH_CONTENT_INDEX_CACHE_TTL_ENV: &str = "OVERLAYTERM_SEARCH_CONTENT_INDEX_CACHE_TTL_MS";
const ENTRY_SIZE_CACHE_TTL_ENV: &str = "OVERLAYTERM_ENTRY_SIZE_CACHE_TTL_MS";
const ENTRY_SIZE_SCAN_BUDGET_ENV: &str = "OVERLAYTERM_ENTRY_SIZE_SCAN_BUDGET_MS";
const SEARCH_CONTENT_INDEX_TOTAL_BYTES_BUDGET_ENV: &str =
    "OVERLAYTERM_SEARCH_CONTENT_INDEX_TOTAL_BYTES_BUDGET";
const MAX_SEARCH_CONTENT_BYTES_ENV: &str = "OVERLAYTERM_SEARCH_MAX_CONTENT_FILE_BYTES";
const SEARCH_MAX_INDEXED_ENTRIES_ENV: &str = "OVERLAYTERM_SEARCH_MAX_INDEXED_ENTRIES";

const DIR_LIST_CACHE_TTL_MS_DEFAULT: u64 = 2_000;
const SEARCH_NAME_INDEX_CACHE_TTL_MS_DEFAULT: u64 = 2_000;
const SEARCH_CONTENT_INDEX_CACHE_TTL_MS_DEFAULT: u64 = 2_000;
const ENTRY_SIZE_CACHE_TTL_MS_DEFAULT: u64 = 10_000;
const ENTRY_SIZE_SCAN_BUDGET_MS_DEFAULT: u64 = 900;
const SEARCH_CONTENT_INDEX_TOTAL_BYTES_BUDGET_DEFAULT: u64 = 12 * 1024 * 1024;
const MAX_SEARCH_CONTENT_BYTES_DEFAULT: u64 = 8 * 1024 * 1024;
const SEARCH_MAX_INDEXED_ENTRIES_DEFAULT: u64 = 25_000;

#[derive(Debug, Clone, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct FsRuntimeCachePolicy {
    pub dir_list_cache_ttl_ms: u64,
    pub search_name_index_cache_ttl_ms: u64,
    pub search_content_index_cache_ttl_ms: u64,
    pub entry_size_cache_ttl_ms: u64,
    pub entry_size_scan_budget_ms: u64,
    pub search_content_index_total_bytes_budget: u64,
    pub max_search_content_file_bytes: u64,
    pub search_max_indexed_entries: u64,
}

#[derive(Debug, Clone)]
struct FsCachePolicy {
    dir_list_cache_ttl: Duration,
    search_name_index_cache_ttl: Duration,
    search_content_index_cache_ttl: Duration,
    entry_size_cache_ttl: Duration,
    entry_size_scan_budget: Duration,
    search_content_index_total_bytes_budget: u64,
    max_search_content_file_bytes: u64,
    search_max_indexed_entries: usize,
}

impl FsCachePolicy {
    fn snapshot(&self) -> FsRuntimeCachePolicy {
        FsRuntimeCachePolicy {
            dir_list_cache_ttl_ms: self.dir_list_cache_ttl.as_millis() as u64,
            search_name_index_cache_ttl_ms: self.search_name_index_cache_ttl.as_millis() as u64,
            search_content_index_cache_ttl_ms: self.search_content_index_cache_ttl.as_millis()
                as u64,
            entry_size_cache_ttl_ms: self.entry_size_cache_ttl.as_millis() as u64,
            entry_size_scan_budget_ms: self.entry_size_scan_budget.as_millis() as u64,
            search_content_index_total_bytes_budget: self.search_content_index_total_bytes_budget,
            max_search_content_file_bytes: self.max_search_content_file_bytes,
            search_max_indexed_entries: self.search_max_indexed_entries as u64,
        }
    }
}

static FS_CACHE_POLICY: OnceLock<FsCachePolicy> = OnceLock::new();
static DIR_LIST_CACHE: OnceLock<Mutex<HashMap<String, CachedDirListingVariants>>> = OnceLock::new();
static SEARCH_NAME_INDEX_CACHE: OnceLock<Mutex<HashMap<String, CachedSearchIndexVariants>>> =
    OnceLock::new();
static SEARCH_CONTENT_INDEX_CACHE: OnceLock<
    Mutex<HashMap<String, CachedSearchContentIndexVariants>>,
> = OnceLock::new();
static ENTRY_SIZE_CACHE: OnceLock<Mutex<HashMap<String, CachedEntrySize>>> = OnceLock::new();
static SEARCH_REQUESTS: OnceLock<Mutex<HashMap<String, u64>>> = OnceLock::new();
static FS_COMMAND_APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();
static FS_COMMAND_YAZI_RUNTIME: OnceLock<Result<(), String>> = OnceLock::new();
static FS_COMMAND_YAZI_SCHEDULER: OnceLock<Arc<YaziScheduler>> = OnceLock::new();
static EXPLORER_TASK_REGISTRY: OnceLock<Mutex<ExplorerTaskRegistry>> = OnceLock::new();

#[cfg(test)]
static SEARCH_ENTRY_TEST_DELAY_MS: AtomicU64 = AtomicU64::new(0);
#[cfg(test)]
static SEARCH_ENTRY_TEST_SCAN_COUNT: AtomicU64 = AtomicU64::new(0);
#[cfg(test)]
static GIT_EXEC_TEST_ENV_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

fn parse_fs_cache_policy_u64(raw: Option<&str>, default: u64) -> u64 {
    raw.map(str::trim)
        .filter(|value| !value.is_empty())
        .and_then(|value| value.parse::<u64>().ok())
        .unwrap_or(default)
}

fn resolve_fs_cache_policy_from_lookup(
    mut lookup: impl FnMut(&str) -> Option<String>,
) -> FsCachePolicy {
    FsCachePolicy {
        dir_list_cache_ttl: Duration::from_millis(parse_fs_cache_policy_u64(
            lookup(DIR_LIST_CACHE_TTL_ENV).as_deref(),
            DIR_LIST_CACHE_TTL_MS_DEFAULT,
        )),
        search_name_index_cache_ttl: Duration::from_millis(parse_fs_cache_policy_u64(
            lookup(SEARCH_NAME_INDEX_CACHE_TTL_ENV).as_deref(),
            SEARCH_NAME_INDEX_CACHE_TTL_MS_DEFAULT,
        )),
        search_content_index_cache_ttl: Duration::from_millis(parse_fs_cache_policy_u64(
            lookup(SEARCH_CONTENT_INDEX_CACHE_TTL_ENV).as_deref(),
            SEARCH_CONTENT_INDEX_CACHE_TTL_MS_DEFAULT,
        )),
        entry_size_cache_ttl: Duration::from_millis(parse_fs_cache_policy_u64(
            lookup(ENTRY_SIZE_CACHE_TTL_ENV).as_deref(),
            ENTRY_SIZE_CACHE_TTL_MS_DEFAULT,
        )),
        entry_size_scan_budget: Duration::from_millis(parse_fs_cache_policy_u64(
            lookup(ENTRY_SIZE_SCAN_BUDGET_ENV).as_deref(),
            ENTRY_SIZE_SCAN_BUDGET_MS_DEFAULT,
        )),
        search_content_index_total_bytes_budget: parse_fs_cache_policy_u64(
            lookup(SEARCH_CONTENT_INDEX_TOTAL_BYTES_BUDGET_ENV).as_deref(),
            SEARCH_CONTENT_INDEX_TOTAL_BYTES_BUDGET_DEFAULT,
        ),
        max_search_content_file_bytes: parse_fs_cache_policy_u64(
            lookup(MAX_SEARCH_CONTENT_BYTES_ENV).as_deref(),
            MAX_SEARCH_CONTENT_BYTES_DEFAULT,
        ),
        search_max_indexed_entries: parse_fs_cache_policy_u64(
            lookup(SEARCH_MAX_INDEXED_ENTRIES_ENV).as_deref(),
            SEARCH_MAX_INDEXED_ENTRIES_DEFAULT,
        )
        .clamp(1, usize::MAX as u64) as usize,
    }
}

fn load_fs_cache_policy() -> FsCachePolicy {
    resolve_fs_cache_policy_from_lookup(|key| std::env::var(key).ok())
}

fn fs_cache_policy() -> &'static FsCachePolicy {
    FS_CACHE_POLICY.get_or_init(load_fs_cache_policy)
}

fn dir_list_cache() -> &'static Mutex<HashMap<String, CachedDirListingVariants>> {
    DIR_LIST_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn search_name_index_cache() -> &'static Mutex<HashMap<String, CachedSearchIndexVariants>> {
    SEARCH_NAME_INDEX_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn search_content_index_cache() -> &'static Mutex<HashMap<String, CachedSearchContentIndexVariants>>
{
    SEARCH_CONTENT_INDEX_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn entry_size_cache() -> &'static Mutex<HashMap<String, CachedEntrySize>> {
    ENTRY_SIZE_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn search_requests() -> &'static Mutex<HashMap<String, u64>> {
    SEARCH_REQUESTS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn explorer_task_registry() -> &'static Mutex<ExplorerTaskRegistry> {
    EXPLORER_TASK_REGISTRY.get_or_init(|| Mutex::new(ExplorerTaskRegistry::default()))
}

pub fn initialize_fs_command_events(app: AppHandle) {
    let _ = FS_COMMAND_APP_HANDLE.set(app);
}

fn fs_command_app_handle() -> Option<&'static AppHandle> {
    FS_COMMAND_APP_HANDLE.get()
}

fn ensure_yazi_runtime() -> Result<(), String> {
    FS_COMMAND_YAZI_RUNTIME
        .get_or_init(|| {
            yazi_shared::init();
            yazi_term::init();
            yazi_fs::init();
            yazi_config::init_default()
                .map_err(|error| format!("Failed to initialize Yazi default config: {error}"))?;
            yazi_vfs::init();
            yazi_boot::init_default();
            yazi_dds::init();
            yazi_dds::serve();
            Ok(())
        })
        .clone()
}

fn fs_command_scheduler() -> Result<&'static Arc<YaziScheduler>, String> {
    ensure_yazi_runtime()?;
    Ok(FS_COMMAND_YAZI_SCHEDULER.get_or_init(|| Arc::new(YaziScheduler::serve())))
}

fn current_epoch_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

fn task_path_label(path: &Path) -> String {
    path.file_name()
        .map(|value| value.to_string_lossy().to_string())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| path.display().to_string())
}

fn task_output_ready(status: ExplorerTaskStatus, destination_path: Option<&String>) -> bool {
    status == ExplorerTaskStatus::Succeeded
        && destination_path
            .map(|value| !value.trim().is_empty())
            .unwrap_or(false)
}

fn refresh_explorer_task_capabilities(entry: &mut ExplorerTaskRegistryEntry) {
    entry.record.can_retry = entry.retry_context.is_some()
        && matches!(
            entry.record.status,
            ExplorerTaskStatus::Failed | ExplorerTaskStatus::Cancelled
        );
    entry.record.can_cancel =
        entry.cancel_context.is_some() && entry.record.status == ExplorerTaskStatus::Running;
    let output_ready =
        task_output_ready(entry.record.status, entry.record.destination_path.as_ref());
    entry.record.can_reveal_output = output_ready;
    entry.record.can_open_output = output_ready;
}

fn emit_explorer_task_progress(record: &ExplorerTaskRecord) {
    let Some(app) = fs_command_app_handle() else {
        return;
    };

    let _ = ExplorerTaskProgressEvent {
        task_id: record.id.clone(),
        task: record.clone(),
    }
    .emit(app);
}

fn sort_explorer_tasks(tasks: &mut [ExplorerTaskRecord]) {
    tasks.sort_by(|left, right| {
        let left_running = left.status == ExplorerTaskStatus::Running;
        let right_running = right.status == ExplorerTaskStatus::Running;
        match right_running.cmp(&left_running) {
            std::cmp::Ordering::Equal => {
                let left_time = if left_running {
                    left.started_at
                } else {
                    left.finished_at.unwrap_or(left.started_at)
                };
                let right_time = if right_running {
                    right.started_at
                } else {
                    right.finished_at.unwrap_or(right.started_at)
                };
                right_time.cmp(&left_time)
            }
            ordering => ordering,
        }
    });
}

fn register_explorer_task(
    task_id: String,
    registration: ExplorerTaskRegistration,
    cancel_context: Option<ExplorerTaskCancelContext>,
) -> ExplorerTaskRecord {
    let mut registry = explorer_task_registry()
        .lock()
        .expect("explorer task registry lock poisoned");
    let started_at = current_epoch_ms();
    let mut entry = ExplorerTaskRegistryEntry {
        record: ExplorerTaskRecord {
            id: task_id.clone(),
            kind: registration.kind,
            status: ExplorerTaskStatus::Running,
            title: registration.title,
            detail: registration.detail,
            progress_current: None,
            progress_total: None,
            started_at,
            finished_at: None,
            source_paths: registration.source_paths,
            destination_path: registration.destination_path,
            error_message: None,
            can_retry: false,
            can_cancel: false,
            can_reveal_output: false,
            can_open_output: false,
            can_undo: registration.can_undo,
            scheduler_task: None,
        },
        retry_context: registration.retry_context,
        cancel_context,
        cancel_requested: false,
    };
    refresh_explorer_task_capabilities(&mut entry);
    if !registry.order.iter().any(|existing| existing == &task_id) {
        registry.order.push(task_id.clone());
    }
    let record = entry.record.clone();
    registry.entries.insert(task_id, entry);
    drop(registry);
    emit_explorer_task_progress(&record);
    record
}

fn mutate_explorer_task(
    task_id: &str,
    mutator: impl FnOnce(&mut ExplorerTaskRegistryEntry),
) -> Result<ExplorerTaskRecord, String> {
    let mut registry = explorer_task_registry()
        .lock()
        .map_err(|_| "Explorer task registry lock was poisoned.".to_string())?;
    let entry = registry
        .entries
        .get_mut(task_id)
        .ok_or_else(|| format!("Explorer task not found: {task_id}"))?;
    mutator(entry);
    refresh_explorer_task_capabilities(entry);
    let record = entry.record.clone();
    drop(registry);
    emit_explorer_task_progress(&record);
    Ok(record)
}

fn update_explorer_task_progress(
    task_id: &str,
    detail: Option<String>,
    progress_current: Option<u64>,
    progress_total: Option<u64>,
) -> Result<ExplorerTaskRecord, String> {
    mutate_explorer_task(task_id, |entry| {
        if entry.record.status == ExplorerTaskStatus::Running {
            if let Some(detail) = detail {
                entry.record.detail = detail;
            }
            entry.record.progress_current = progress_current;
            entry.record.progress_total = progress_total;
        }
    })
}

fn mark_explorer_task_finished(
    task_id: &str,
    status: ExplorerTaskStatus,
    detail: Option<String>,
    error_message: Option<String>,
    can_undo: Option<bool>,
) -> Result<ExplorerTaskRecord, String> {
    mutate_explorer_task(task_id, |entry| {
        entry.record.status = status;
        entry.record.finished_at = Some(current_epoch_ms());
        if let Some(detail) = detail {
            entry.record.detail = detail;
        }
        entry.record.error_message = error_message;
        if let Some(can_undo) = can_undo {
            entry.record.can_undo = can_undo;
        }
    })
}

pub(crate) fn create_manual_explorer_task_with_id(
    task_id: String,
    registration: ExplorerTaskRegistration,
) -> String {
    register_explorer_task(task_id.clone(), registration, None);
    task_id
}

pub(crate) fn create_manual_explorer_task(registration: ExplorerTaskRegistration) -> String {
    create_manual_explorer_task_with_id(Uuid::new_v4().to_string(), registration)
}

pub(crate) fn set_manual_explorer_task_cancel_context(
    task_id: &str,
    cancel_context: ExplorerTaskCancelContext,
) -> Result<ExplorerTaskRecord, String> {
    mutate_explorer_task(task_id, |entry| {
        entry.cancel_context = Some(cancel_context);
    })
}

pub(crate) fn update_manual_explorer_task(
    task_id: &str,
    detail: Option<String>,
    progress_current: Option<u64>,
    progress_total: Option<u64>,
) -> Result<ExplorerTaskRecord, String> {
    update_explorer_task_progress(task_id, detail, progress_current, progress_total)
}

pub(crate) fn complete_manual_explorer_task(
    task_id: &str,
    detail: Option<String>,
    can_undo: Option<bool>,
) -> Result<ExplorerTaskRecord, String> {
    mark_explorer_task_finished(
        task_id,
        ExplorerTaskStatus::Succeeded,
        detail,
        None,
        can_undo,
    )
}

pub(crate) fn fail_manual_explorer_task(
    task_id: &str,
    error_message: String,
) -> Result<ExplorerTaskRecord, String> {
    mark_explorer_task_finished(
        task_id,
        ExplorerTaskStatus::Failed,
        Some(error_message.clone()),
        Some(error_message),
        None,
    )
}

pub(crate) fn cancel_manual_explorer_task(
    task_id: &str,
    detail: Option<String>,
) -> Result<ExplorerTaskRecord, String> {
    mark_explorer_task_finished(
        task_id,
        ExplorerTaskStatus::Cancelled,
        detail.or_else(|| Some("Cancelled".to_string())),
        Some("Cancelled".to_string()),
        None,
    )
}

fn recursive_size_task_detail(current: usize, total: usize) -> String {
    if total == 0 {
        return "Calculating recursive sizes".to_string();
    }
    format!(
        "Calculated {} of {} recursive size item{}",
        current,
        total,
        if total == 1 { "" } else { "s" }
    )
}

fn checksum_task_detail(current: usize, total: usize) -> String {
    if total == 0 {
        return "Calculating checksums".to_string();
    }
    format!(
        "Calculated {} of {} checksum item{}",
        current,
        total,
        if total == 1 { "" } else { "s" }
    )
}

fn batch_recursive_size_task_registration(
    paths: Vec<String>,
    force_refresh: bool,
) -> ExplorerTaskRegistration {
    ExplorerTaskRegistration {
        kind: ExplorerTaskKind::RecursiveSize,
        title: format!(
            "Calculate recursive size for {} item{}",
            paths.len(),
            if paths.len() == 1 { "" } else { "s" }
        ),
        detail: "Calculating recursive sizes".to_string(),
        source_paths: paths.clone(),
        destination_path: None,
        retry_context: Some(ExplorerTaskRetryContext::RecursiveSize {
            paths,
            force_refresh,
        }),
        can_undo: false,
    }
}

fn batch_checksum_task_registration(paths: Vec<String>) -> ExplorerTaskRegistration {
    ExplorerTaskRegistration {
        kind: ExplorerTaskKind::Checksum,
        title: format!(
            "Calculate checksums for {} item{}",
            paths.len(),
            if paths.len() == 1 { "" } else { "s" }
        ),
        detail: "Calculating checksums".to_string(),
        source_paths: paths.clone(),
        destination_path: None,
        retry_context: Some(ExplorerTaskRetryContext::Checksum { paths }),
        can_undo: false,
    }
}

fn calculate_file_checksums(path: &Path) -> Result<FsChecksumEntryInfo, String> {
    let metadata = fs::metadata(path)
        .map_err(|error| format!("Failed to inspect {}: {error}", path.display()))?;
    if metadata.is_dir() {
        return Ok(FsChecksumEntryInfo {
            path: path.to_string_lossy().to_string(),
            bytes: 0,
            is_dir: true,
            md5: None,
            sha256: None,
            error: Some("Checksums are only supported for regular files.".to_string()),
        });
    }

    let mut file = fs::File::open(path)
        .map_err(|error| format!("Failed to open {}: {error}", path.display()))?;
    let mut md5_hasher = Md5Context::new();
    let mut sha256_hasher = Sha256::new();
    let mut buffer = [0_u8; 128 * 1024];
    let mut bytes = 0_u64;

    loop {
        let read = file
            .read(&mut buffer)
            .map_err(|error| format!("Failed to read {}: {error}", path.display()))?;
        if read == 0 {
            break;
        }
        bytes = bytes.saturating_add(read as u64);
        md5_hasher.consume(&buffer[..read]);
        sha256_hasher.update(&buffer[..read]);
    }

    Ok(FsChecksumEntryInfo {
        path: path.to_string_lossy().to_string(),
        bytes,
        is_dir: false,
        md5: Some(format!("{:x}", md5_hasher.compute())),
        sha256: Some(format!("{:x}", sha256_hasher.finalize())),
        error: None,
    })
}

fn fuzzy_boundary_score(chars: &[char], index: usize) -> i64 {
    if index == 0 {
        return 16;
    }
    let previous = chars[index - 1];
    let current = chars[index];
    if matches!(previous, '/' | '\\' | '.' | '-' | '_' | ' ') {
        14
    } else if previous.is_lowercase() && current.is_uppercase() {
        10
    } else {
        0
    }
}

fn fuzzy_score_text(query: &str, haystack: &str) -> Option<(i64, Vec<usize>)> {
    let query = query.trim();
    if query.is_empty() {
        return Some((0, Vec::new()));
    }

    let lower_query = query.to_lowercase().chars().collect::<Vec<_>>();
    let lower_haystack = haystack.to_lowercase().chars().collect::<Vec<_>>();
    let haystack_chars = haystack.chars().collect::<Vec<_>>();

    let mut matched_indices = Vec::with_capacity(lower_query.len());
    let mut search_start = 0usize;
    let mut score = 0i64;
    let mut last_match = None;

    for (query_index, query_char) in lower_query.iter().enumerate() {
        let mut found = None;
        for index in search_start..lower_haystack.len() {
            if lower_haystack[index] == *query_char {
                found = Some(index);
                break;
            }
        }

        let index = found?;
        matched_indices.push(index);
        score += 20;
        score += fuzzy_boundary_score(&haystack_chars, index);

        if let Some(previous) = last_match {
            let gap = index.saturating_sub(previous + 1);
            if gap == 0 {
                score += 12;
            } else {
                score -= (gap as i64).min(10);
            }
        } else if query_index == 0 && index == 0 {
            score += 20;
        }

        search_start = index + 1;
        last_match = Some(index);
    }

    score -= (haystack_chars.len() as i64 / 6).min(20);
    Some((score, matched_indices))
}

fn fuzzy_score_entry(query: &str, entry: &FsJumpFilterEntry) -> Option<(i64, Vec<usize>)> {
    if let Some(name_match) = fuzzy_score_text(query, &entry.name) {
        let path_bonus = fuzzy_score_text(query, &entry.path)
            .as_ref()
            .map(|(score, _)| *score)
            .unwrap_or(0);
        let mut score = name_match.0.saturating_mul(1_000) + path_bonus.saturating_mul(10);
        if entry.is_dir {
            score += 5;
        }
        Some((score, name_match.1))
    } else if let Some(path_match) = fuzzy_score_text(query, &entry.path) {
        let mut score = path_match.0.saturating_mul(100);
        if entry.is_dir {
            score += 5;
        }
        Some((score, path_match.1))
    } else {
        None
    }
}

async fn run_recursive_size_task(
    paths: Vec<String>,
    force_refresh: bool,
) -> Result<(String, Vec<EntryStorageInfo>), String> {
    if paths.is_empty() {
        return Err("Recursive size request was empty.".to_string());
    }
    let total = paths.len();

    let task_id = create_manual_explorer_task(batch_recursive_size_task_registration(
        paths.clone(),
        force_refresh,
    ));
    let task_id_for_thread = task_id.clone();

    let result = tauri::async_runtime::spawn_blocking(move || {
        let mut results = Vec::with_capacity(total);
        for (index, path) in paths.iter().enumerate() {
            let mut measured = measure_entry_sizes_blocking(vec![path.clone()], force_refresh);
            let entry = measured.pop().unwrap_or_else(|| EntryStorageInfo {
                path: path.clone(),
                bytes: 0,
                is_dir: Path::new(path).is_dir(),
                is_complete: false,
            });
            results.push(entry);
            let _ = update_manual_explorer_task(
                &task_id_for_thread,
                Some(recursive_size_task_detail(index + 1, total)),
                Some((index + 1) as u64),
                Some(total as u64),
            );
        }
        Ok::<Vec<EntryStorageInfo>, String>(results)
    })
    .await
    .map_err(|error| format!("Recursive size task join failure: {error}"))?;

    match result {
        Ok(results) => {
            let _ = complete_manual_explorer_task(
                &task_id,
                Some(recursive_size_task_detail(total, total)),
                None,
            );
            Ok((task_id, results))
        }
        Err(error) => {
            let _ = fail_manual_explorer_task(&task_id, error.clone());
            Err(error)
        }
    }
}

async fn run_checksum_task(
    paths: Vec<String>,
) -> Result<(String, Vec<FsChecksumEntryInfo>), String> {
    if paths.is_empty() {
        return Err("Checksum request was empty.".to_string());
    }
    let total = paths.len();

    let task_id = create_manual_explorer_task(batch_checksum_task_registration(paths.clone()));
    let task_id_for_thread = task_id.clone();

    let result = tauri::async_runtime::spawn_blocking(move || {
        let mut results = Vec::with_capacity(total);
        for (index, path) in paths.iter().enumerate() {
            let entry = match calculate_file_checksums(Path::new(path)) {
                Ok(entry) => entry,
                Err(error) => FsChecksumEntryInfo {
                    path: path.clone(),
                    bytes: 0,
                    is_dir: Path::new(path).is_dir(),
                    md5: None,
                    sha256: None,
                    error: Some(error),
                },
            };
            results.push(entry);
            let _ = update_manual_explorer_task(
                &task_id_for_thread,
                Some(checksum_task_detail(index + 1, total)),
                Some((index + 1) as u64),
                Some(total as u64),
            );
        }
        Ok::<Vec<FsChecksumEntryInfo>, String>(results)
    })
    .await
    .map_err(|error| format!("Checksum task join failure: {error}"))?;

    match result {
        Ok(results) => {
            let _ = complete_manual_explorer_task(
                &task_id,
                Some(checksum_task_detail(total, total)),
                None,
            );
            Ok((task_id, results))
        }
        Err(error) => {
            let _ = fail_manual_explorer_task(&task_id, error.clone());
            Err(error)
        }
    }
}

pub(crate) fn set_recent_trash_task(task_id: Option<&str>) -> Result<(), String> {
    let mut registry = explorer_task_registry()
        .lock()
        .map_err(|_| "Explorer task registry lock was poisoned.".to_string())?;
    let mut changed_records = Vec::new();
    for entry in registry.entries.values_mut() {
        if entry.record.kind != ExplorerTaskKind::Trash {
            continue;
        }
        let should_undo = task_id
            .map(|candidate| candidate == entry.record.id)
            .unwrap_or(false)
            && entry.record.status == ExplorerTaskStatus::Succeeded;
        if entry.record.can_undo != should_undo {
            entry.record.can_undo = should_undo;
            refresh_explorer_task_capabilities(entry);
            changed_records.push(entry.record.clone());
        }
    }
    drop(registry);
    for record in changed_records {
        emit_explorer_task_progress(&record);
    }
    Ok(())
}

fn list_explorer_tasks_snapshot() -> Result<Vec<ExplorerTaskRecord>, String> {
    let registry = explorer_task_registry()
        .lock()
        .map_err(|_| "Explorer task registry lock was poisoned.".to_string())?;
    let mut tasks = registry
        .order
        .iter()
        .filter_map(|task_id| registry.entries.get(task_id))
        .map(|entry| entry.record.clone())
        .collect::<Vec<_>>();
    drop(registry);
    sort_explorer_tasks(&mut tasks);
    Ok(tasks)
}

fn yazi_progress_counts(task: &yazi_specta::YaziSchedulerTaskSnap) -> (Option<u64>, Option<u64>) {
    match &task.prog {
        yazi_specta::YaziSchedulerTaskProg::FileCopy(prog) => {
            if prog.total_bytes > 0 {
                (Some(prog.processed_bytes), Some(prog.total_bytes))
            } else if prog.total_files > 0 {
                (
                    Some((prog.success_files + prog.failed_files).into()),
                    Some(prog.total_files.into()),
                )
            } else {
                (None, None)
            }
        }
        yazi_specta::YaziSchedulerTaskProg::FileCut(prog) => {
            if prog.total_bytes > 0 {
                (Some(prog.processed_bytes), Some(prog.total_bytes))
            } else if prog.total_files > 0 {
                (
                    Some((prog.success_files + prog.failed_files).into()),
                    Some(prog.total_files.into()),
                )
            } else {
                (None, None)
            }
        }
        yazi_specta::YaziSchedulerTaskProg::FileDelete(prog) => {
            if prog.total_bytes > 0 {
                (Some(prog.processed_bytes), Some(prog.total_bytes))
            } else if prog.total_files > 0 {
                (
                    Some((prog.success_files + prog.failed_files).into()),
                    Some(prog.total_files.into()),
                )
            } else {
                (None, None)
            }
        }
        yazi_specta::YaziSchedulerTaskProg::FileDownload(prog) => {
            if prog.total_bytes > 0 {
                (Some(prog.processed_bytes), Some(prog.total_bytes))
            } else if prog.total_files > 0 {
                (
                    Some((prog.success_files + prog.failed_files).into()),
                    Some(prog.total_files.into()),
                )
            } else {
                (None, None)
            }
        }
        yazi_specta::YaziSchedulerTaskProg::FileUpload(prog) => {
            if prog.total_bytes > 0 {
                (Some(prog.processed_bytes), Some(prog.total_bytes))
            } else if prog.total_files > 0 {
                (
                    Some((prog.success_files + prog.failed_files).into()),
                    Some(prog.total_files.into()),
                )
            } else {
                (None, None)
            }
        }
        yazi_specta::YaziSchedulerTaskProg::FileHardlink(prog) => {
            if prog.total > 0 {
                (
                    Some((prog.success + prog.failed).into()),
                    Some(prog.total.into()),
                )
            } else {
                (None, None)
            }
        }
        _ => (None, None),
    }
}

fn yazi_task_failed(task: &yazi_specta::YaziSchedulerTaskSnap) -> bool {
    match &task.prog {
        yazi_specta::YaziSchedulerTaskProg::FileCopy(prog) => {
            prog.cleaned == Some(false) || prog.collected == Some(false)
        }
        yazi_specta::YaziSchedulerTaskProg::FileCut(prog) => {
            prog.cleaned == Some(false) || prog.collected == Some(false)
        }
        yazi_specta::YaziSchedulerTaskProg::FileDelete(prog) => {
            prog.cleaned == Some(false) || prog.collected == Some(false)
        }
        yazi_specta::YaziSchedulerTaskProg::FileDownload(prog) => {
            prog.cleaned == Some(false) || prog.collected == Some(false)
        }
        yazi_specta::YaziSchedulerTaskProg::FileUpload(prog) => {
            prog.cleaned == Some(false) || prog.collected == Some(false)
        }
        yazi_specta::YaziSchedulerTaskProg::FileHardlink(prog) => prog.collected == Some(false),
        yazi_specta::YaziSchedulerTaskProg::FileLink(prog) => prog.state == Some(false),
        yazi_specta::YaziSchedulerTaskProg::FileTrash(prog) => {
            prog.cleaned == Some(false) || prog.state == Some(false)
        }
        _ => false,
    }
}

fn sync_yazi_task_record(
    task_id: &str,
    task: &yazi_specta::YaziSchedulerTaskSnap,
) -> Result<ExplorerTaskRecord, String> {
    let (progress_current, progress_total) = yazi_progress_counts(task);
    mutate_explorer_task(task_id, |entry| {
        entry.record.scheduler_task = Some(task.clone());
        entry.record.progress_current = progress_current;
        entry.record.progress_total = progress_total;
        if !entry.cancel_requested
            && entry.record.status == ExplorerTaskStatus::Running
            && yazi_task_failed(task)
        {
            entry.record.status = ExplorerTaskStatus::Failed;
        }
    })
}

fn explorer_task_cancel_requested(task_id: &str) -> bool {
    explorer_task_registry()
        .lock()
        .ok()
        .and_then(|registry| {
            registry
                .entries
                .get(task_id)
                .map(|entry| entry.cancel_requested)
        })
        .unwrap_or(false)
}

#[derive(Debug, Clone)]
struct ExplorerYaziTaskState {
    snap: yazi_specta::YaziSchedulerTaskSnap,
    running: bool,
    failed: bool,
    logs: String,
}

fn current_explorer_yazi_task_state(task_id: YaziTaskId) -> Option<ExplorerYaziTaskState> {
    let ongoing = fs_command_scheduler().ok()?.ongoing.lock();
    let task = ongoing.values().find(|task| task.id == task_id)?;
    let snap = YaziTaskSnap::from(task);
    Some(ExplorerYaziTaskState {
        running: snap.prog.running(),
        failed: snap.prog.failed(),
        logs: task.logs.clone(),
        snap: snap.into(),
    })
}

fn explorer_yazi_task_error(state: &ExplorerYaziTaskState) -> String {
    state
        .logs
        .lines()
        .rev()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| format!("{} failed", state.snap.name))
}

const EXPLORER_TASK_CANCELLED_ERROR: &str = "Explorer task cancelled.";

async fn await_explorer_yazi_task(
    ticket: YaziTaskTicket,
    registration: ExplorerTaskRegistration,
) -> Result<String, String> {
    ensure_yazi_runtime()?;
    let task_id = ticket.id.to_string();
    register_explorer_task(
        task_id.clone(),
        registration.clone(),
        Some(ExplorerTaskCancelContext::Yazi {
            scheduler_task_id: ticket.id,
        }),
    );
    let mut last_state: Option<ExplorerYaziTaskState> = None;

    loop {
        if explorer_task_cancel_requested(&task_id) {
            if let Ok(scheduler) = fs_command_scheduler() {
                scheduler.cancel(ticket.id);
            }
        }

        if ticket.done.completed() == Some(true) {
            if explorer_task_cancel_requested(&task_id) {
                let _ = cancel_manual_explorer_task(&task_id, None);
                return Err(EXPLORER_TASK_CANCELLED_ERROR.to_string());
            }
            if let Some(state) = &last_state {
                if state.failed {
                    let error_message = explorer_yazi_task_error(state);
                    let _ = fail_manual_explorer_task(&task_id, error_message.clone());
                    if let Ok(scheduler) = fs_command_scheduler() {
                        scheduler.cancel(ticket.id);
                    }
                    return Err(error_message);
                }
            }
            let _ =
                complete_manual_explorer_task(&task_id, Some(registration.detail.clone()), None);
            return Ok(task_id);
        }

        if let Some(state) = current_explorer_yazi_task_state(ticket.id) {
            if last_state
                .as_ref()
                .map(|previous| previous.snap != state.snap)
                .unwrap_or(true)
            {
                let _ = sync_yazi_task_record(&task_id, &state.snap);
            }

            if !state.running {
                if explorer_task_cancel_requested(&task_id) {
                    let _ = cancel_manual_explorer_task(&task_id, None);
                    return Err(EXPLORER_TASK_CANCELLED_ERROR.to_string());
                }
                if state.failed {
                    let error_message = explorer_yazi_task_error(&state);
                    let _ = fail_manual_explorer_task(&task_id, error_message.clone());
                    if let Ok(scheduler) = fs_command_scheduler() {
                        scheduler.cancel(ticket.id);
                    }
                    return Err(error_message);
                }
                let _ = complete_manual_explorer_task(
                    &task_id,
                    Some(registration.detail.clone()),
                    None,
                );
                return Ok(task_id);
            }

            last_state = Some(state);
        } else if let Some(state) = &last_state {
            if explorer_task_cancel_requested(&task_id) {
                let _ = cancel_manual_explorer_task(&task_id, None);
                return Err(EXPLORER_TASK_CANCELLED_ERROR.to_string());
            }
            if state.failed {
                let error_message = explorer_yazi_task_error(state);
                let _ = fail_manual_explorer_task(&task_id, error_message.clone());
                if let Ok(scheduler) = fs_command_scheduler() {
                    scheduler.cancel(ticket.id);
                }
                return Err(error_message);
            }
            let _ =
                complete_manual_explorer_task(&task_id, Some(registration.detail.clone()), None);
            return Ok(task_id);
        }

        tokio::time::sleep(Duration::from_millis(40)).await;
    }
}

fn path_cache_key(path: &Path) -> String {
    normalize_cache_path(path)
}

fn prune_expired_dir_list_cache(cache: &mut HashMap<String, CachedDirListingVariants>) {
    let ttl = fs_cache_policy().dir_list_cache_ttl;
    if ttl.is_zero() {
        cache.clear();
        return;
    }

    for variants in cache.values_mut() {
        if variants
            .visible_only
            .as_ref()
            .map(|listing| listing.cached_at.elapsed() > ttl)
            .unwrap_or(false)
        {
            variants.visible_only = None;
        }

        if variants
            .include_hidden
            .as_ref()
            .map(|listing| listing.cached_at.elapsed() > ttl)
            .unwrap_or(false)
        {
            variants.include_hidden = None;
        }
    }

    cache
        .retain(|_, variants| variants.visible_only.is_some() || variants.include_hidden.is_some());
}

fn prune_expired_search_name_index_cache(cache: &mut HashMap<String, CachedSearchIndexVariants>) {
    let ttl = fs_cache_policy().search_name_index_cache_ttl;
    if ttl.is_zero() {
        cache.clear();
        return;
    }

    for variants in cache.values_mut() {
        if variants
            .visible_only
            .as_ref()
            .map(|index| index.cached_at.elapsed() > ttl)
            .unwrap_or(false)
        {
            variants.visible_only = None;
        }

        if variants
            .include_hidden
            .as_ref()
            .map(|index| index.cached_at.elapsed() > ttl)
            .unwrap_or(false)
        {
            variants.include_hidden = None;
        }
    }

    cache
        .retain(|_, variants| variants.visible_only.is_some() || variants.include_hidden.is_some());
}

fn prune_expired_search_content_index_cache(
    cache: &mut HashMap<String, CachedSearchContentIndexVariants>,
) {
    let ttl = fs_cache_policy().search_content_index_cache_ttl;
    if ttl.is_zero() {
        cache.clear();
        return;
    }

    for variants in cache.values_mut() {
        if variants
            .visible_only
            .as_ref()
            .map(|index| index.cached_at.elapsed() > ttl)
            .unwrap_or(false)
        {
            variants.visible_only = None;
        }

        if variants
            .include_hidden
            .as_ref()
            .map(|index| index.cached_at.elapsed() > ttl)
            .unwrap_or(false)
        {
            variants.include_hidden = None;
        }
    }

    cache
        .retain(|_, variants| variants.visible_only.is_some() || variants.include_hidden.is_some());
}

fn search_request_scope(path: &str, request_scope: Option<String>) -> String {
    request_scope
        .map(|scope| scope.trim().to_string())
        .filter(|scope| !scope.is_empty())
        .unwrap_or_else(|| normalize_cache_path(Path::new(path)))
}

fn register_search_request(scope: &str, request_id: Option<u64>) -> u64 {
    let mut active = search_requests()
        .lock()
        .expect("search request map poisoned");
    match request_id {
        Some(id) => {
            // Explicit request ids come from the caller's lifecycle. Replacing the
            // active value lets a remounted frontend restart its counter without
            // inheriting a stale larger id from an older search session.
            active.insert(scope.to_string(), id);
            id
        }
        None => {
            let next_request_id = active.get(scope).copied().unwrap_or(0).saturating_add(1);
            active.insert(scope.to_string(), next_request_id);
            next_request_id
        }
    }
}

fn is_search_request_active(scope: &str, request_id: u64) -> bool {
    search_requests()
        .lock()
        .ok()
        .and_then(|active| active.get(scope).copied())
        == Some(request_id)
}

#[cfg(test)]
fn pause_search_entry_scan_for_tests() {
    let delay_ms = SEARCH_ENTRY_TEST_DELAY_MS.load(Ordering::Relaxed);
    if delay_ms > 0 {
        std::thread::sleep(Duration::from_millis(delay_ms));
    }
}

#[cfg(not(test))]
#[inline]
fn pause_search_entry_scan_for_tests() {}

#[cfg(test)]
fn record_search_entry_scan_for_tests() {
    SEARCH_ENTRY_TEST_SCAN_COUNT.fetch_add(1, Ordering::Relaxed);
}

#[cfg(not(test))]
#[inline]
fn record_search_entry_scan_for_tests() {}

fn invalidate_entry_size_cache(path: &Path) {
    let key = path_cache_key(path);
    let key_with_separator = if key.ends_with(std::path::MAIN_SEPARATOR) {
        key.clone()
    } else {
        format!("{key}{}", std::path::MAIN_SEPARATOR)
    };

    if let Ok(mut cache) = entry_size_cache().lock() {
        cache.retain(|cached_path, _| {
            if cached_path == &key || cached_path.starts_with(&key_with_separator) {
                return false;
            }

            let cached_path_with_separator = if cached_path.ends_with(std::path::MAIN_SEPARATOR) {
                cached_path.clone()
            } else {
                format!("{cached_path}{}", std::path::MAIN_SEPARATOR)
            };

            !key.starts_with(&cached_path_with_separator)
        });
    }
}

fn invalidate_dir_list_cache(path: &Path) {
    let key = path_cache_key(path);
    let key_with_separator = if key.ends_with(std::path::MAIN_SEPARATOR) {
        key.clone()
    } else {
        format!("{key}{}", std::path::MAIN_SEPARATOR)
    };

    if let Ok(mut cache) = dir_list_cache().lock() {
        cache.retain(|cached_path, _| {
            cached_path != &key && !cached_path.starts_with(&key_with_separator)
        });
    }
}

fn invalidate_search_name_index_cache(path: &Path) {
    let key = path_cache_key(path);
    let key_with_separator = if key.ends_with(std::path::MAIN_SEPARATOR) {
        key.clone()
    } else {
        format!("{key}{}", std::path::MAIN_SEPARATOR)
    };

    if let Ok(mut cache) = search_name_index_cache().lock() {
        cache.retain(|cached_path, _| {
            if cached_path == &key || cached_path.starts_with(&key_with_separator) {
                return false;
            }

            let cached_path_with_separator = if cached_path.ends_with(std::path::MAIN_SEPARATOR) {
                cached_path.clone()
            } else {
                format!("{cached_path}{}", std::path::MAIN_SEPARATOR)
            };

            !key.starts_with(&cached_path_with_separator)
        });
    }
}

fn invalidate_search_content_index_cache(path: &Path) {
    let key = path_cache_key(path);
    let key_with_separator = if key.ends_with(std::path::MAIN_SEPARATOR) {
        key.clone()
    } else {
        format!("{key}{}", std::path::MAIN_SEPARATOR)
    };

    if let Ok(mut cache) = search_content_index_cache().lock() {
        cache.retain(|cached_path, _| {
            if cached_path == &key || cached_path.starts_with(&key_with_separator) {
                return false;
            }

            let cached_path_with_separator = if cached_path.ends_with(std::path::MAIN_SEPARATOR) {
                cached_path.clone()
            } else {
                format!("{cached_path}{}", std::path::MAIN_SEPARATOR)
            };

            !key.starts_with(&cached_path_with_separator)
        });
    }
}

fn invalidate_persisted_entry_size(path: &Path) {
    let _ = delete_entry_size_subtree(path);
    let _ = mark_path_and_ancestors_dirty(path);
}

fn invalidate_all_entry_size_caches(path: &Path) {
    invalidate_entry_size_cache(path);
    invalidate_persisted_entry_size(path);
}

fn invalidate_all_fs_caches(path: &Path) {
    invalidate_all_entry_size_caches(path);
    invalidate_dir_list_cache(path);
    invalidate_search_name_index_cache(path);
    invalidate_search_content_index_cache(path);
}

pub fn invalidate_all_fs_caches_for_path(path: &Path) {
    invalidate_all_fs_caches(path);
}

#[derive(Debug, Clone)]
struct MeasuredPathSize {
    bytes: u64,
    is_dir: bool,
    is_complete: bool,
    modified_ms: Option<u64>,
    entry_bytes: Option<u64>,
}

fn metadata_modified_ms(metadata: &std::fs::Metadata) -> Option<u64> {
    metadata
        .modified()
        .ok()
        .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as u64)
}

fn metadata_created_ms(metadata: &std::fs::Metadata) -> Option<u64> {
    metadata
        .created()
        .ok()
        .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as u64)
}

fn metadata_accessed_ms(metadata: &std::fs::Metadata) -> Option<u64> {
    metadata
        .accessed()
        .ok()
        .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as u64)
}

#[cfg(unix)]
fn unix_permissions_octal(metadata: &std::fs::Metadata) -> u32 {
    use std::os::unix::fs::PermissionsExt;

    metadata.permissions().mode() & 0o777
}

#[cfg(unix)]
fn format_unix_permissions(mode: u32) -> String {
    let mut rendered = String::with_capacity(9);
    for shift in [6, 3, 0] {
        rendered.push(if mode & (0o4 << shift) != 0 { 'r' } else { '-' });
        rendered.push(if mode & (0o2 << shift) != 0 { 'w' } else { '-' });
        rendered.push(if mode & (0o1 << shift) != 0 { 'x' } else { '-' });
    }
    rendered
}

fn describe_permissions(metadata: &std::fs::Metadata) -> FsPermissionInfo {
    #[cfg(unix)]
    {
        let mode = unix_permissions_octal(metadata);
        return FsPermissionInfo {
            readonly: metadata.permissions().readonly(),
            display: format!("{} ({mode:03o})", format_unix_permissions(mode)),
            unix_mode: Some(mode),
            unix_mode_octal: Some(format!("{mode:03o}")),
        };
    }

    #[cfg(not(unix))]
    {
        let readonly = metadata.permissions().readonly();
        FsPermissionInfo {
            readonly,
            display: if readonly {
                "Read-only".to_string()
            } else {
                "Read/Write".to_string()
            },
            unix_mode: None,
            unix_mode_octal: None,
        }
    }
}

fn read_item_properties(path: &Path) -> Result<FsItemPropertiesInfo, String> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| format!("Failed to inspect {}: {error}", path.display()))?;
    Ok(FsItemPropertiesInfo {
        path: path.to_string_lossy().to_string(),
        name: path
            .file_name()
            .map(|value| value.to_string_lossy().to_string())
            .unwrap_or_else(|| path.to_string_lossy().to_string()),
        is_dir: metadata.is_dir(),
        is_symlink: metadata.file_type().is_symlink(),
        bytes: if metadata.is_dir() { 0 } else { metadata.len() },
        modified_at_ms: metadata_modified_ms(&metadata),
        created_at_ms: metadata_created_ms(&metadata),
        accessed_at_ms: metadata_accessed_ms(&metadata),
        permissions: describe_permissions(&metadata),
    })
}

fn cha_modified_ms(metadata: &Cha) -> Option<u64> {
    metadata
        .mtime
        .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as u64)
}

fn current_time_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

fn persisted_entry_is_valid(path: &Path, entry: &PersistedEntrySize) -> bool {
    if entry.dirty {
        return false;
    }

    let metadata = match std::fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(_) => return false,
    };
    let file_type = metadata.file_type();

    if file_type.is_symlink() {
        return entry.bytes == 0 && entry.is_complete;
    }

    if entry.is_dir != metadata.is_dir() {
        return false;
    }

    let modified_ms = metadata_modified_ms(&metadata);
    if entry.modified_ms != modified_ms {
        return false;
    }

    if metadata.is_file() {
        return entry.entry_bytes == Some(metadata.len());
    }

    metadata.is_dir()
}

fn measured_to_persisted_entry(path: &Path, measurement: &MeasuredPathSize) -> PersistedEntrySize {
    PersistedEntrySize {
        path: path_cache_key(path),
        bytes: measurement.bytes,
        is_dir: measurement.is_dir,
        is_complete: measurement.is_complete,
        modified_ms: measurement.modified_ms,
        entry_bytes: measurement.entry_bytes,
        measured_at_ms: current_time_millis(),
        dirty: false,
    }
}

fn measure_path_size(path: &Path) -> MeasuredPathSize {
    let metadata = match std::fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(_) => {
            return MeasuredPathSize {
                bytes: 0,
                is_dir: false,
                is_complete: false,
                modified_ms: None,
                entry_bytes: None,
            }
        }
    };

    let file_type = metadata.file_type();
    let modified_ms = metadata_modified_ms(&metadata);
    if file_type.is_symlink() {
        return MeasuredPathSize {
            bytes: 0,
            is_dir: path.is_dir(),
            is_complete: true,
            modified_ms,
            entry_bytes: None,
        };
    }

    if metadata.is_file() {
        return MeasuredPathSize {
            bytes: metadata.len(),
            is_dir: false,
            is_complete: true,
            modified_ms,
            entry_bytes: Some(metadata.len()),
        };
    }

    if !metadata.is_dir() {
        return MeasuredPathSize {
            bytes: 0,
            is_dir: false,
            is_complete: false,
            modified_ms,
            entry_bytes: None,
        };
    }

    let mut total_bytes = 0_u64;
    let mut stack = vec![path.to_path_buf()];
    let mut visited = HashSet::new();
    let deadline = Instant::now() + fs_cache_policy().entry_size_scan_budget;

    while let Some(dir) = stack.pop() {
        if Instant::now() >= deadline {
            return MeasuredPathSize {
                bytes: total_bytes,
                is_dir: true,
                is_complete: false,
                modified_ms,
                entry_bytes: None,
            };
        }

        let canonical = dir.canonicalize().unwrap_or(dir.clone());
        if !visited.insert(canonical) {
            continue;
        }

        let read_dir = match std::fs::read_dir(&dir) {
            Ok(entries) => entries,
            Err(_) => continue,
        };

        for entry in read_dir.flatten() {
            if Instant::now() >= deadline {
                return MeasuredPathSize {
                    bytes: total_bytes,
                    is_dir: true,
                    is_complete: false,
                    modified_ms,
                    entry_bytes: None,
                };
            }

            let entry_path = entry.path();
            let entry_metadata = match std::fs::symlink_metadata(&entry_path) {
                Ok(metadata) => metadata,
                Err(_) => continue,
            };

            let entry_type = entry_metadata.file_type();
            if entry_type.is_symlink() {
                continue;
            }

            if entry_type.is_dir() {
                stack.push(entry_path);
                continue;
            }

            if entry_type.is_file() {
                total_bytes = total_bytes.saturating_add(entry_metadata.len());
            }
        }
    }

    MeasuredPathSize {
        bytes: total_bytes,
        is_dir: true,
        is_complete: true,
        modified_ms,
        entry_bytes: None,
    }
}

fn measure_entry_sizes_blocking(paths: Vec<String>, force_refresh: bool) -> Vec<EntryStorageInfo> {
    let now = Instant::now();
    let entry_size_cache_ttl = fs_cache_policy().entry_size_cache_ttl;
    let mut results = Vec::with_capacity(paths.len());
    let mut pending: Vec<(usize, PathBuf, String)> = Vec::new();
    let path_bufs = paths.iter().map(PathBuf::from).collect::<Vec<_>>();
    let persisted = if force_refresh {
        HashMap::new()
    } else {
        load_entry_size_cache(&path_bufs).unwrap_or_default()
    };

    if let Ok(cache) = entry_size_cache().lock() {
        for (index, raw_path) in paths.iter().enumerate() {
            let path = PathBuf::from(raw_path);
            let key = path_cache_key(&path);
            let cached = if force_refresh {
                None
            } else {
                cache
                    .get(&key)
                    .filter(|entry| {
                        !entry_size_cache_ttl.is_zero()
                            && now.duration_since(entry.measured_at) <= entry_size_cache_ttl
                    })
                    .cloned()
            };

            if let Some(entry) = cached {
                results.push(EntryStorageInfo {
                    path: key,
                    bytes: entry.bytes,
                    is_dir: entry.is_dir,
                    is_complete: entry.is_complete,
                });
            } else if let Some(entry) = persisted
                .get(&key)
                .filter(|entry| persisted_entry_is_valid(&path, entry))
            {
                results.push(EntryStorageInfo {
                    path: entry.path.clone(),
                    bytes: entry.bytes,
                    is_dir: entry.is_dir,
                    is_complete: entry.is_complete,
                });
            } else {
                results.push(EntryStorageInfo {
                    path: key.clone(),
                    bytes: 0,
                    is_dir: path.is_dir(),
                    is_complete: !path.is_dir(),
                });
                pending.push((index, path, key));
            }
        }
    }

    if pending.is_empty() {
        return results;
    }

    let mut cache_updates = Vec::with_capacity(pending.len());
    let mut persisted_updates = Vec::with_capacity(pending.len());
    for (index, path, key) in pending {
        let measured = measure_path_size(&path);
        results[index] = EntryStorageInfo {
            path: key.clone(),
            bytes: measured.bytes,
            is_dir: measured.is_dir,
            is_complete: measured.is_complete,
        };
        cache_updates.push((
            key,
            CachedEntrySize {
                bytes: measured.bytes,
                is_dir: measured.is_dir,
                is_complete: measured.is_complete,
                measured_at: now,
            },
        ));
        persisted_updates.push(measured_to_persisted_entry(&path, &measured));
    }

    if let Ok(mut cache) = entry_size_cache().lock() {
        if !entry_size_cache_ttl.is_zero() {
            for (key, entry) in cache_updates {
                cache.insert(key, entry);
            }
        }
    }

    let _ = upsert_entry_size_cache(&persisted_updates);

    results
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, specta::Type)]
#[serde(rename_all = "snake_case")]
pub enum FileTransferOperation {
    Copy,
    Move,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, specta::Type)]
#[serde(rename_all = "snake_case")]
pub enum FileTransferCollisionPolicy {
    KeepBoth,
    Replace,
    Skip,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, specta::Type)]
#[serde(rename_all = "snake_case")]
pub enum FileTransferDisposition {
    Transferred,
    SkippedExisting,
}

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type)]
pub struct FileTransferCollision {
    pub source_path: String,
    pub source_name: String,
    pub destination_path: String,
    pub operation: FileTransferOperation,
    pub destination_exists: bool,
    pub destination_is_dir: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type)]
pub struct FileTransferResult {
    pub source_path: String,
    pub destination_path: String,
    pub operation: FileTransferOperation,
    pub collision_policy: FileTransferCollisionPolicy,
    pub disposition: FileTransferDisposition,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, specta::Type)]
#[serde(rename_all = "snake_case")]
pub enum FileSearchMatchKind {
    Name,
    Content,
    NameAndContent,
}

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type)]
pub struct FileSearchResult {
    pub name: String,
    pub path: String,
    pub relative_path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: u64,
    pub extension: String,
    pub is_hidden: bool,
    pub is_symlink: bool,
    pub match_kind: FileSearchMatchKind,
    pub snippet: String,
    pub line_number: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, specta::Type)]
#[serde(rename_all = "snake_case")]
pub enum FileSearchExecutionStrategy {
    NameIndexCacheHit,
    ContentIndexCacheHit,
    LiveScan,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, specta::Type)]
#[serde(rename_all = "snake_case")]
pub enum FileSearchContentCacheStatus {
    NotRequested,
    CacheHit,
    Warmed,
    Disabled,
    OverBudgetFallback,
    ReadFailureFallback,
}

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct FileSearchDiagnostics {
    pub execution_strategy: FileSearchExecutionStrategy,
    pub content_cache_status: FileSearchContentCacheStatus,
    pub scanned_entry_count: u64,
    pub indexed_entry_count: u64,
    pub content_cache_stored_file_count: u64,
    pub content_cache_stored_byte_count: u64,
    pub truncated_by_scan_budget: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct FileSearchResponse {
    pub results: Vec<FileSearchResult>,
    pub diagnostics: FileSearchDiagnostics,
}

struct ListedFileEntry {
    sort_name: String,
    entry: FileEntry,
}

#[derive(Debug, Clone)]
struct SearchableEntry {
    path: PathBuf,
    name_lower: String,
    result: FileSearchResult,
    content_searchable: bool,
}

// ─── fs_list_dir ─────────────────────────────────────────────────────────────

async fn build_listed_file_entry<T>(
    entry: T,
    show_hidden: bool,
) -> Result<Option<ListedFileEntry>, String>
where
    T: FileHolder,
{
    let name = entry.name().to_string_lossy().into_owned();
    let path = entry
        .path()
        .to_os_owned()
        .map_err(|error| format!("Failed to resolve Yazi entry path: {error}"))?;
    let provider = Local::regular(&path);
    let file_type = entry.file_type().await.map_err(|error| {
        format!(
            "Failed to inspect entry type '{}': {error}",
            path.to_string_lossy()
        )
    })?;
    let entry_metadata = provider.symlink_metadata().await.map_err(|error| {
        format!(
            "Failed to read entry metadata '{}': {error}",
            path.to_string_lossy()
        )
    })?;
    let is_hidden = entry_metadata.is_hidden() || is_hidden_name(&name);
    if is_hidden && !show_hidden {
        return Ok(None);
    }

    let target_metadata = if file_type == ChaType::Link {
        Some(provider.metadata().await.map_err(|error| {
            format!(
                "Failed to read symlink target metadata '{}': {error}",
                path.to_string_lossy()
            )
        })?)
    } else {
        None
    };
    let metadata = target_metadata.as_ref().unwrap_or(&entry_metadata);
    let is_symlink = file_type == ChaType::Link;
    let is_dir = file_type.is_dir() || ChaType::from(metadata.mode).is_dir();

    Ok(Some(ListedFileEntry {
        sort_name: name.to_lowercase(),
        entry: FileEntry {
            name,
            path: path.to_string_lossy().to_string(),
            is_dir,
            size: if is_dir { 0 } else { metadata.len },
            modified: cha_modified_ms(metadata).unwrap_or(0),
            extension: if is_dir {
                String::new()
            } else {
                normalized_extension(&path)
            },
            is_hidden,
            is_symlink,
        },
    }))
}

async fn list_dir_via_yazi(dir_path: &Path, show_hidden: bool) -> Result<Vec<FileEntry>, String> {
    let mut read_dir = Local::regular(dir_path)
        .read_dir()
        .await
        .map_err(|error| format!("Failed to read directory: {error}"))?;

    let mut entries = Vec::new();
    while let Some(entry) = read_dir
        .next()
        .await
        .map_err(|error| format!("Failed to read directory: {error}"))?
    {
        if let Some(listed) = build_listed_file_entry(entry, show_hidden).await? {
            entries.push(listed);
        }
    }

    // Sort once using precomputed lowercase names so large directories don't
    // allocate lowercase strings repeatedly during comparison.
    entries.sort_unstable_by(
        |left, right| match (left.entry.is_dir, right.entry.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => left.sort_name.cmp(&right.sort_name),
        },
    );

    Ok(entries.into_iter().map(|listed| listed.entry).collect())
}

async fn build_searchable_entry<T>(
    entry: T,
    root: &Path,
    show_hidden: bool,
    max_search_content_file_bytes: u64,
) -> Option<SearchableEntry>
where
    T: FileHolder,
{
    let name = entry.name().to_string_lossy().into_owned();
    let path = entry.path().to_os_owned().ok()?;
    let provider = Local::regular(&path);
    let file_type = entry.file_type().await.ok()?;
    let entry_metadata = provider.symlink_metadata().await.ok()?;
    let is_hidden = entry_metadata.is_hidden() || is_hidden_name(&name);
    if is_hidden && !show_hidden {
        return None;
    }

    let target_metadata = if file_type == ChaType::Link {
        provider.metadata().await.ok()
    } else {
        None
    };
    let metadata = target_metadata.as_ref().unwrap_or(&entry_metadata);
    let is_symlink = file_type == ChaType::Link;
    let is_dir = file_type.is_dir() || ChaType::from(metadata.mode).is_dir();
    let relative_path = path
        .strip_prefix(root)
        .map(|relative| relative.to_string_lossy().to_string())
        .unwrap_or_else(|_| path.to_string_lossy().to_string());

    Some(SearchableEntry {
        content_searchable: !is_dir
            && metadata.len <= max_search_content_file_bytes
            && is_searchable_text_file(&path),
        name_lower: name.to_ascii_lowercase(),
        path: path.clone(),
        result: FileSearchResult {
            name,
            path: path.to_string_lossy().to_string(),
            relative_path,
            is_dir,
            size: if is_dir { 0 } else { metadata.len },
            modified: cha_modified_ms(metadata).unwrap_or(0),
            extension: if is_dir {
                String::new()
            } else {
                normalized_extension(&path)
            },
            is_hidden,
            is_symlink,
            match_kind: FileSearchMatchKind::Name,
            snippet: String::new(),
            line_number: None,
        },
    })
}

async fn list_dir(
    dir_path: PathBuf,
    show_hidden: bool,
    bypass_cache: bool,
) -> Result<Vec<FileEntry>, String> {
    let policy = fs_cache_policy();
    let path_label = dir_path.to_string_lossy().to_string();
    if !dir_path.exists() {
        return Err(format!("Path does not exist: {}", path_label));
    }
    if !dir_path.is_dir() {
        return Err(format!("Path is not a directory: {}", path_label));
    }

    let cache_key = path_cache_key(&dir_path);
    let directory_modified_ms = std::fs::metadata(&dir_path)
        .ok()
        .and_then(|metadata| metadata_modified_ms(&metadata));
    if !bypass_cache && !policy.dir_list_cache_ttl.is_zero() {
        if let Ok(mut cache) = dir_list_cache().lock() {
            prune_expired_dir_list_cache(&mut cache);
            if let Some(cached) = cache
                .get(&cache_key)
                .and_then(|variants| variants.get(show_hidden))
            {
                if cached.directory_modified_ms == directory_modified_ms {
                    return Ok(cached.entries.clone());
                }
            }
        }
    }

    let entries = list_dir_via_yazi(&dir_path, show_hidden).await?;
    if !policy.dir_list_cache_ttl.is_zero() {
        if let Ok(mut cache) = dir_list_cache().lock() {
            prune_expired_dir_list_cache(&mut cache);
            cache.entry(cache_key).or_default().set(
                show_hidden,
                CachedDirListing {
                    entries: entries.clone(),
                    directory_modified_ms,
                    cached_at: Instant::now(),
                },
            );
        }
    }

    Ok(entries)
}

#[tauri::command]
#[specta::specta]
pub fn fs_get_runtime_cache_policy() -> FsRuntimeCachePolicy {
    fs_cache_policy().snapshot()
}

#[tauri::command]
#[specta::specta]
pub async fn fs_list_dir(path: String, show_hidden: bool) -> Result<Vec<FileEntry>, String> {
    list_dir(PathBuf::from(path), show_hidden, false).await
}

#[tauri::command]
#[specta::specta]
pub async fn fs_list_dir_uncached(
    path: String,
    show_hidden: bool,
) -> Result<Vec<FileEntry>, String> {
    list_dir(PathBuf::from(path), show_hidden, true).await
}

#[tauri::command]
#[specta::specta]
pub async fn fs_measure_entry_sizes(
    paths: Vec<String>,
    force_refresh: Option<bool>,
) -> Result<Vec<EntryStorageInfo>, String> {
    let deduped_paths = paths
        .into_iter()
        .filter(|path| !path.trim().is_empty())
        .collect::<Vec<_>>();

    tauri::async_runtime::spawn_blocking(move || {
        measure_entry_sizes_blocking(deduped_paths, force_refresh.unwrap_or(false))
    })
    .await
    .map_err(|error| format!("Failed to measure entry sizes: {error}"))
}

#[tauri::command]
#[specta::specta]
pub async fn fs_calculate_recursive_sizes(
    paths: Vec<String>,
    force_refresh: Option<bool>,
) -> Result<Vec<EntryStorageInfo>, String> {
    let (_, results) = run_recursive_size_task(
        paths
            .into_iter()
            .filter(|path| !path.trim().is_empty())
            .collect::<Vec<_>>(),
        force_refresh.unwrap_or(false),
    )
    .await?;
    Ok(results)
}

#[tauri::command]
#[specta::specta]
pub async fn fs_calculate_checksums(
    paths: Vec<String>,
) -> Result<Vec<FsChecksumEntryInfo>, String> {
    let (_, results) = run_checksum_task(
        paths
            .into_iter()
            .filter(|path| !path.trim().is_empty())
            .collect::<Vec<_>>(),
    )
    .await?;
    Ok(results)
}

#[tauri::command]
#[specta::specta]
pub async fn fs_get_item_properties(path: String) -> Result<FsItemPropertiesInfo, String> {
    let target = PathBuf::from(&path);
    if !target.exists() {
        return Err(format!("Path does not exist: {path}"));
    }
    read_item_properties(&target)
}

#[tauri::command]
#[specta::specta]
pub async fn fs_fuzzy_filter_entries(
    request: FsJumpFilterRequest,
) -> Result<Vec<FsJumpFilterMatch>, String> {
    let limit = request.limit.unwrap_or(usize::MAX);
    let mut matches = request
        .entries
        .into_iter()
        .filter_map(|entry| {
            fuzzy_score_entry(&request.query, &entry).map(|(score, matched_indices)| {
                FsJumpFilterMatch {
                    path: entry.path,
                    name: entry.name,
                    is_dir: entry.is_dir,
                    sort_order: entry.sort_order,
                    score,
                    matched_indices,
                }
            })
        })
        .collect::<Vec<_>>();

    matches.sort_by(|left, right| {
        right
            .score
            .cmp(&left.score)
            .then_with(|| left.sort_order.cmp(&right.sort_order))
            .then_with(|| left.name.to_lowercase().cmp(&right.name.to_lowercase()))
            .then_with(|| left.path.cmp(&right.path))
    });
    matches.truncate(limit);
    Ok(matches)
}

// ─── fs_get_drives (Windows) ──────────────────────────────────────────────────

#[tauri::command]
#[specta::specta]
pub async fn fs_get_drives() -> Result<Vec<DriveInfo>, String> {
    #[cfg(target_os = "windows")]
    {
        let drives = get_windows_drives()?;
        return Ok(drives);
    }

    #[cfg(target_os = "macos")]
    {
        let mut drives = Vec::new();
        if let Some(home_drive) = unix_home_drive_info() {
            drives.push(home_drive);
        }
        drives.push(root_drive_info());
        drives.extend(read_unix_mount_directories("/Volumes"));
        return Ok(drives);
    }

    #[cfg(target_os = "linux")]
    {
        let mut drives = Vec::new();
        if let Some(home_drive) = unix_home_drive_info() {
            drives.push(home_drive);
        }
        drives.push(root_drive_info());
        drives.extend(read_unix_mount_directories("/media"));
        drives.extend(read_unix_mount_directories("/mnt"));
        return Ok(deduplicate_drives(drives));
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Ok(vec![root_drive_info()])
    }
}

#[cfg(target_os = "windows")]
fn get_windows_drives() -> Result<Vec<DriveInfo>, String> {
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;

    // GetLogicalDriveStringsW returns a multi-string (double-null terminated)
    let mut buffer = vec![0u16; 256];
    let len = unsafe {
        windows_sys::Win32::Storage::FileSystem::GetLogicalDriveStringsW(
            buffer.len() as u32,
            buffer.as_mut_ptr(),
        )
    };

    if len == 0 {
        return Err("Failed to enumerate drives".to_string());
    }

    let mut drives = Vec::new();
    let mut start = 0;
    for i in 0..len as usize {
        if buffer[i] == 0 {
            if i > start {
                let drive_str = OsString::from_wide(&buffer[start..i])
                    .to_string_lossy()
                    .to_string();
                let letter = drive_str.trim_end_matches('\\').to_string();

                // Get drive info
                let mut total_bytes: u64 = 0;
                let mut free_bytes: u64 = 0;
                let drive_w: Vec<u16> =
                    drive_str.encode_utf16().chain(std::iter::once(0)).collect();

                unsafe {
                    windows_sys::Win32::Storage::FileSystem::GetDiskFreeSpaceExW(
                        drive_w.as_ptr(),
                        std::ptr::null_mut(),
                        &mut total_bytes as *mut u64,
                        &mut free_bytes as *mut u64,
                    );
                }

                let drive_type = unsafe {
                    let t =
                        windows_sys::Win32::Storage::FileSystem::GetDriveTypeW(drive_w.as_ptr());
                    match t {
                        2 => "removable",
                        3 => "fixed",
                        4 => "remote",
                        5 => "cdrom",
                        6 => "ramdisk",
                        _ => "unknown",
                    }
                };

                // Get volume label
                let mut vol_buf = vec![0u16; 128];
                unsafe {
                    windows_sys::Win32::Storage::FileSystem::GetVolumeInformationW(
                        drive_w.as_ptr(),
                        vol_buf.as_mut_ptr(),
                        vol_buf.len() as u32,
                        std::ptr::null_mut(),
                        std::ptr::null_mut(),
                        std::ptr::null_mut(),
                        std::ptr::null_mut(),
                        0,
                    );
                }
                let label_end = vol_buf.iter().position(|&c| c == 0).unwrap_or(0);
                let label = OsString::from_wide(&vol_buf[..label_end])
                    .to_string_lossy()
                    .to_string();
                let label = if label.is_empty() {
                    letter.clone()
                } else {
                    label
                };

                drives.push(DriveInfo {
                    letter: letter.clone(),
                    label,
                    total_bytes,
                    free_bytes,
                    drive_type: drive_type.to_string(),
                });
            }
            start = i + 1;
        }
    }

    Ok(drives)
}

#[cfg(not(target_os = "windows"))]
fn root_drive_info() -> DriveInfo {
    DriveInfo {
        letter: "/".to_string(),
        label: "Root".to_string(),
        total_bytes: 0,
        free_bytes: 0,
        drive_type: "fixed".to_string(),
    }
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
fn unix_home_drive_info() -> Option<DriveInfo> {
    let home_dir = dirs::home_dir()?;
    let normalized_path = home_dir.to_string_lossy().trim().to_string();
    if normalized_path.is_empty() {
        return None;
    }

    Some(DriveInfo {
        letter: normalized_path,
        label: "Home".to_string(),
        total_bytes: 0,
        free_bytes: 0,
        drive_type: "home".to_string(),
    })
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
fn read_unix_mount_directories(base_path: &str) -> Vec<DriveInfo> {
    let path = Path::new(base_path);
    let read_dir = match std::fs::read_dir(path) {
        Ok(entries) => entries,
        Err(_) => return Vec::new(),
    };

    let mut drives = Vec::new();
    for entry in read_dir.flatten() {
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if !file_type.is_dir() {
            continue;
        }

        let mount_path = entry.path();
        let label = entry.file_name().to_string_lossy().to_string();
        drives.push(DriveInfo {
            letter: mount_path.to_string_lossy().to_string(),
            label: if label.is_empty() {
                mount_path.to_string_lossy().to_string()
            } else {
                label
            },
            total_bytes: 0,
            free_bytes: 0,
            drive_type: "mounted".to_string(),
        });
    }

    drives.sort_by(|a, b| a.label.to_lowercase().cmp(&b.label.to_lowercase()));
    drives
}

#[cfg(target_os = "linux")]
fn deduplicate_drives(drives: Vec<DriveInfo>) -> Vec<DriveInfo> {
    use std::collections::HashSet;

    let mut seen = HashSet::new();
    let mut unique = Vec::new();
    for drive in drives {
        if seen.insert(drive.letter.clone()) {
            unique.push(drive);
        }
    }
    unique
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
fn shell_quote_single(value: &str) -> String {
    format!("'{}'", value.replace('\'', r#"'\''"#))
}

#[cfg(target_os = "macos")]
fn escape_applescript_string(value: &str) -> String {
    value.replace('\\', "\\\\").replace('\"', "\\\"")
}

fn normalized_extension(path: &Path) -> String {
    path.extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
}

fn is_hidden_name(name: &str) -> bool {
    name.starts_with('.')
}

fn is_searchable_text_file(path: &Path) -> bool {
    const EXTENSIONS: &[&str] = &[
        "txt", "md", "mdx", "log", "json", "yaml", "yml", "toml", "xml", "ini", "cfg", "csv", "ts",
        "tsx", "js", "jsx", "mjs", "cjs", "rs", "py", "go", "c", "h", "cpp", "hpp", "cc", "cxx",
        "cs", "java", "kt", "kts", "rb", "php", "swift", "dart", "lua", "zig", "html", "htm",
        "css", "scss", "sass", "less", "sh", "bash", "zsh", "ps1", "bat", "cmd", "env", "glsl",
        "hlsl", "wgsl", "sql", "kain", "ink",
    ];

    let ext = normalized_extension(path);
    if EXTENSIONS.contains(&ext.as_str()) {
        return true;
    }

    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();

    matches!(
        name.as_str(),
        "dockerfile"
            | "makefile"
            | "readme"
            | "license"
            | "changelog"
            | ".gitignore"
            | ".gitattributes"
            | ".env"
            | ".env.local"
            | ".env.development"
            | ".env.production"
    )
}

fn build_search_snippet(line: &str, query_lower: &str) -> String {
    let normalized = line.trim().replace('\t', " ");
    if normalized.is_empty() {
        return String::new();
    }

    let lower = normalized.to_ascii_lowercase();
    if let Some(pos) = lower.find(query_lower) {
        let mut start = pos.saturating_sub(40);
        let mut end = (pos + query_lower.len() + 80).min(normalized.len());

        while start > 0 && !normalized.is_char_boundary(start) {
            start -= 1;
        }
        while end < normalized.len() && !normalized.is_char_boundary(end) {
            end += 1;
        }

        let mut snippet = normalized[start..end].trim().to_string();
        if start > 0 {
            snippet = format!("…{}", snippet);
        }
        if end < normalized.len() {
            snippet.push('…');
        }
        return snippet;
    }

    let mut snippet: String = normalized.chars().take(180).collect();
    if normalized.chars().count() > 180 {
        snippet.push('…');
    }
    snippet
}

fn search_reader_for_match<R: std::io::BufRead>(
    reader: R,
    query_lower: &str,
    request_scope: &str,
    request_id: u64,
) -> Result<Option<(String, Option<u64>)>, ()> {
    for (idx, line_result) in reader.lines().enumerate() {
        if idx % 32 == 0 && !is_search_request_active(request_scope, request_id) {
            return Err(());
        }
        let line = match line_result {
            Ok(value) => value,
            Err(_) => return Ok(None),
        };
        if line.to_ascii_lowercase().contains(query_lower) {
            return Ok(Some((
                build_search_snippet(&line, query_lower),
                Some((idx + 1) as u64),
            )));
        }
    }

    Ok(None)
}

fn search_file_content_for_match(
    path: &Path,
    query_lower: &str,
    request_scope: &str,
    request_id: u64,
) -> Result<Option<(String, Option<u64>)>, ()> {
    let file = match std::fs::File::open(path) {
        Ok(value) => value,
        Err(_) => return Ok(None),
    };

    search_reader_for_match(
        std::io::BufReader::new(file),
        query_lower,
        request_scope,
        request_id,
    )
}

fn search_cached_content_for_match(
    content: &str,
    query_lower: &str,
    request_scope: &str,
    request_id: u64,
) -> Result<Option<(String, Option<u64>)>, ()> {
    search_reader_for_match(
        std::io::Cursor::new(content.as_bytes()),
        query_lower,
        request_scope,
        request_id,
    )
}

fn sort_search_results(results: &mut [FileSearchResult]) {
    results.sort_by(|a, b| {
        let rank = |kind: FileSearchMatchKind| match kind {
            FileSearchMatchKind::NameAndContent => 0u8,
            FileSearchMatchKind::Content => 1u8,
            FileSearchMatchKind::Name => 2u8,
        };

        rank(a.match_kind)
            .cmp(&rank(b.match_kind))
            .then_with(|| {
                a.path
                    .to_ascii_lowercase()
                    .cmp(&b.path.to_ascii_lowercase())
            })
            .then_with(|| {
                a.name
                    .to_ascii_lowercase()
                    .cmp(&b.name.to_ascii_lowercase())
            })
    });
}

fn lookup_cached_name_search_results(
    root: &Path,
    query_lower: &str,
    show_hidden: bool,
    max_results: usize,
) -> Option<(Vec<FileSearchResult>, usize)> {
    if fs_cache_policy().search_name_index_cache_ttl.is_zero() {
        return None;
    }

    let key = path_cache_key(root);
    let cached_entries = {
        let mut cache = search_name_index_cache()
            .lock()
            .expect("search name index cache poisoned");
        prune_expired_search_name_index_cache(&mut cache);
        cache.get(&key)?.get(show_hidden)?.entries.clone()
    };
    let indexed_entry_count = cached_entries.len();

    let mut matches = cached_entries
        .into_iter()
        .filter(|entry| entry.name_lower.contains(query_lower))
        .collect::<Vec<_>>();
    matches.sort_by(|a, b| {
        a.path_lower
            .cmp(&b.path_lower)
            .then_with(|| a.name_lower.cmp(&b.name_lower))
    });
    matches.truncate(max_results);

    Some((
        matches.into_iter().map(|entry| entry.result).collect(),
        indexed_entry_count,
    ))
}

fn store_search_name_index(root: &Path, show_hidden: bool, entries: Vec<CachedSearchNameEntry>) {
    if fs_cache_policy().search_name_index_cache_ttl.is_zero() {
        return;
    }

    let key = path_cache_key(root);
    let mut cache = search_name_index_cache()
        .lock()
        .expect("search name index cache poisoned");
    prune_expired_search_name_index_cache(&mut cache);
    cache.entry(key).or_default().set(
        show_hidden,
        CachedSearchIndex {
            entries,
            cached_at: Instant::now(),
        },
    );
}

fn lookup_cached_content_search_results(
    root: &Path,
    query_lower: &str,
    show_hidden: bool,
    max_results: usize,
    request_scope: &str,
    request_id: u64,
) -> Option<(Vec<FileSearchResult>, usize)> {
    let policy = fs_cache_policy();
    if policy.search_content_index_cache_ttl.is_zero()
        || policy.search_content_index_total_bytes_budget == 0
    {
        return None;
    }

    let key = path_cache_key(root);
    let cached_entries = {
        let mut cache = search_content_index_cache()
            .lock()
            .expect("search content index cache poisoned");
        prune_expired_search_content_index_cache(&mut cache);
        cache.get(&key)?.get(show_hidden)?.entries.clone()
    };

    let mut combined_matches: Vec<FileSearchResult> = Vec::new();
    let mut content_matches: Vec<FileSearchResult> = Vec::new();
    let mut name_matches: Vec<FileSearchResult> = Vec::new();

    for (index, entry) in cached_entries.iter().enumerate() {
        if index % 32 == 0 && !is_search_request_active(request_scope, request_id) {
            return Some((Vec::new(), cached_entries.len()));
        }

        let name_hit = entry.name_lower.contains(query_lower);
        let content_match = match entry.content.as_deref() {
            Some(content) => match search_cached_content_for_match(
                content,
                query_lower,
                request_scope,
                request_id,
            ) {
                Ok(value) => value,
                Err(()) => return Some((Vec::new(), cached_entries.len())),
            },
            None => None,
        };
        let content_hit = content_match.is_some();
        if !name_hit && !content_hit {
            continue;
        }

        let mut result = entry.result.clone();
        result.match_kind = match (name_hit, content_hit) {
            (true, true) => FileSearchMatchKind::NameAndContent,
            (false, true) => FileSearchMatchKind::Content,
            _ => FileSearchMatchKind::Name,
        };
        if let Some((snippet, line_number)) = content_match {
            result.snippet = snippet;
            result.line_number = line_number;
        }

        match result.match_kind {
            FileSearchMatchKind::NameAndContent => combined_matches.push(result),
            FileSearchMatchKind::Content => content_matches.push(result),
            FileSearchMatchKind::Name => name_matches.push(result),
        }
    }

    let mut results = Vec::new();
    results.extend(combined_matches);
    results.extend(content_matches);
    results.extend(name_matches);
    sort_search_results(&mut results);
    results.truncate(max_results);
    Some((results, cached_entries.len()))
}

fn store_search_content_index(
    root: &Path,
    show_hidden: bool,
    entries: Vec<CachedSearchContentEntry>,
) {
    let policy = fs_cache_policy();
    if policy.search_content_index_cache_ttl.is_zero()
        || policy.search_content_index_total_bytes_budget == 0
    {
        return;
    }

    let key = path_cache_key(root);
    let mut cache = search_content_index_cache()
        .lock()
        .expect("search content index cache poisoned");
    prune_expired_search_content_index_cache(&mut cache);
    cache.entry(key).or_default().set(
        show_hidden,
        CachedSearchContentIndex {
            entries,
            cached_at: Instant::now(),
        },
    );
}

fn empty_search_response(
    execution_strategy: FileSearchExecutionStrategy,
    content_cache_status: FileSearchContentCacheStatus,
    scanned_entry_count: u64,
    indexed_entry_count: u64,
    truncated_by_scan_budget: bool,
) -> FileSearchResponse {
    FileSearchResponse {
        results: Vec::new(),
        diagnostics: FileSearchDiagnostics {
            execution_strategy,
            content_cache_status,
            scanned_entry_count,
            indexed_entry_count,
            content_cache_stored_file_count: 0,
            content_cache_stored_byte_count: 0,
            truncated_by_scan_budget,
        },
    }
}

async fn search_entries(
    path: String,
    query: String,
    show_hidden: bool,
    include_content: bool,
    limit: Option<usize>,
    request_scope: String,
    request_id: u64,
) -> Result<FileSearchResponse, String> {
    let policy = fs_cache_policy();
    let root = PathBuf::from(&path);
    if !root.exists() {
        return Err(format!("Path does not exist: {}", path));
    }
    if !root.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    let query = query.trim().to_string();
    if query.is_empty() {
        return Ok(empty_search_response(
            FileSearchExecutionStrategy::LiveScan,
            if include_content {
                if policy.search_content_index_cache_ttl.is_zero()
                    || policy.search_content_index_total_bytes_budget == 0
                {
                    FileSearchContentCacheStatus::Disabled
                } else {
                    FileSearchContentCacheStatus::Warmed
                }
            } else {
                FileSearchContentCacheStatus::NotRequested
            },
            0,
            0,
            false,
        ));
    }

    let query_lower = query.to_ascii_lowercase();
    let max_results = limit.unwrap_or(250).clamp(1, 1000);
    if include_content {
        if let Some((results, indexed_entry_count)) = lookup_cached_content_search_results(
            &root,
            &query_lower,
            show_hidden,
            max_results,
            &request_scope,
            request_id,
        ) {
            if !is_search_request_active(&request_scope, request_id) {
                return Ok(empty_search_response(
                    FileSearchExecutionStrategy::ContentIndexCacheHit,
                    FileSearchContentCacheStatus::CacheHit,
                    0,
                    indexed_entry_count as u64,
                    false,
                ));
            }
            return Ok(FileSearchResponse {
                results,
                diagnostics: FileSearchDiagnostics {
                    execution_strategy: FileSearchExecutionStrategy::ContentIndexCacheHit,
                    content_cache_status: FileSearchContentCacheStatus::CacheHit,
                    scanned_entry_count: 0,
                    indexed_entry_count: indexed_entry_count as u64,
                    content_cache_stored_file_count: 0,
                    content_cache_stored_byte_count: 0,
                    truncated_by_scan_budget: false,
                },
            });
        }
    } else {
        if let Some((results, indexed_entry_count)) =
            lookup_cached_name_search_results(&root, &query_lower, show_hidden, max_results)
        {
            if !is_search_request_active(&request_scope, request_id) {
                return Ok(empty_search_response(
                    FileSearchExecutionStrategy::NameIndexCacheHit,
                    FileSearchContentCacheStatus::NotRequested,
                    0,
                    indexed_entry_count as u64,
                    false,
                ));
            }
            return Ok(FileSearchResponse {
                results,
                diagnostics: FileSearchDiagnostics {
                    execution_strategy: FileSearchExecutionStrategy::NameIndexCacheHit,
                    content_cache_status: FileSearchContentCacheStatus::NotRequested,
                    scanned_entry_count: 0,
                    indexed_entry_count: indexed_entry_count as u64,
                    content_cache_stored_file_count: 0,
                    content_cache_stored_byte_count: 0,
                    truncated_by_scan_budget: false,
                },
            });
        }
    }

    let mut stack = vec![root.clone()];
    let mut combined_matches: Vec<FileSearchResult> = Vec::new();
    let mut content_matches: Vec<FileSearchResult> = Vec::new();
    let mut name_matches: Vec<FileSearchResult> = Vec::new();
    let mut cached_name_entries: Vec<CachedSearchNameEntry> = Vec::new();
    let mut cached_content_entries = include_content.then(|| Vec::new());
    let mut content_cache_complete = include_content;
    let mut cached_content_bytes = 0_u64;
    let mut truncated_by_scan_budget = false;
    let content_cache_enabled = include_content
        && !policy.search_content_index_cache_ttl.is_zero()
        && policy.search_content_index_total_bytes_budget > 0;
    let mut scanned_entry_count = 0_u64;
    let mut content_cache_status = if include_content {
        if content_cache_enabled {
            FileSearchContentCacheStatus::Warmed
        } else {
            FileSearchContentCacheStatus::Disabled
        }
    } else {
        FileSearchContentCacheStatus::NotRequested
    };

    'search: while let Some(current_dir) = stack.pop() {
        if !is_search_request_active(&request_scope, request_id) {
            return Ok(empty_search_response(
                FileSearchExecutionStrategy::LiveScan,
                content_cache_status,
                scanned_entry_count,
                cached_name_entries.len() as u64,
                truncated_by_scan_budget,
            ));
        }

        let mut read_dir = match Local::regular(&current_dir).read_dir().await {
            Ok(entries) => entries,
            Err(_) => continue,
        };

        loop {
            if !is_search_request_active(&request_scope, request_id) {
                return Ok(empty_search_response(
                    FileSearchExecutionStrategy::LiveScan,
                    content_cache_status,
                    scanned_entry_count,
                    cached_name_entries.len() as u64,
                    truncated_by_scan_budget,
                ));
            }
            pause_search_entry_scan_for_tests();
            record_search_entry_scan_for_tests();

            if scanned_entry_count >= policy.search_max_indexed_entries as u64 {
                truncated_by_scan_budget = true;
                break 'search;
            }

            let entry = match read_dir.next().await {
                Ok(Some(value)) => value,
                Ok(None) => break,
                Err(_) => break,
            };
            scanned_entry_count = scanned_entry_count.saturating_add(1);

            let Some(candidate) = build_searchable_entry(
                entry,
                &root,
                show_hidden,
                policy.max_search_content_file_bytes,
            )
            .await
            else {
                continue;
            };

            let SearchableEntry {
                path: path_buf,
                name_lower,
                result: cached_name_result,
                content_searchable,
            } = candidate;
            cached_name_entries.push(CachedSearchNameEntry {
                name_lower: name_lower.clone(),
                path_lower: cached_name_result.path.to_ascii_lowercase(),
                result: cached_name_result.clone(),
            });
            let name_hit = name_lower.contains(&query_lower);

            if cached_name_result.is_dir {
                if name_hit {
                    name_matches.push(cached_name_result.clone());
                }

                if !cached_name_result.is_symlink {
                    stack.push(path_buf);
                }
                continue;
            }

            let mut content_hit = false;
            let mut snippet = String::new();
            let mut line_number = None;
            let mut cached_content = None;

            if include_content && content_searchable {
                if content_cache_complete
                    && cached_content_bytes.saturating_add(cached_name_result.size)
                        <= policy.search_content_index_total_bytes_budget
                {
                    match Local::regular(&path_buf).read_to_string().await {
                        Ok(content) => {
                            match search_cached_content_for_match(
                                &content,
                                &query_lower,
                                &request_scope,
                                request_id,
                            ) {
                                Ok(Some((matched_snippet, matched_line_number))) => {
                                    content_hit = true;
                                    snippet = matched_snippet;
                                    line_number = matched_line_number;
                                }
                                Ok(None) => {}
                                Err(()) => {
                                    return Ok(empty_search_response(
                                        FileSearchExecutionStrategy::LiveScan,
                                        content_cache_status,
                                        scanned_entry_count,
                                        cached_name_entries.len() as u64,
                                        truncated_by_scan_budget,
                                    ))
                                }
                            }
                            cached_content_bytes =
                                cached_content_bytes.saturating_add(cached_name_result.size);
                            cached_content = Some(Arc::<str>::from(content));
                        }
                        Err(_) => {
                            content_cache_complete = false;
                            if content_cache_enabled {
                                content_cache_status =
                                    FileSearchContentCacheStatus::ReadFailureFallback;
                            }
                            match search_file_content_for_match(
                                &path_buf,
                                &query_lower,
                                &request_scope,
                                request_id,
                            ) {
                                Ok(Some((matched_snippet, matched_line_number))) => {
                                    content_hit = true;
                                    snippet = matched_snippet;
                                    line_number = matched_line_number;
                                }
                                Ok(None) => {}
                                Err(()) => {
                                    return Ok(empty_search_response(
                                        FileSearchExecutionStrategy::LiveScan,
                                        content_cache_status,
                                        scanned_entry_count,
                                        cached_name_entries.len() as u64,
                                        truncated_by_scan_budget,
                                    ))
                                }
                            }
                        }
                    }
                } else {
                    content_cache_complete = false;
                    if content_cache_enabled {
                        content_cache_status = FileSearchContentCacheStatus::OverBudgetFallback;
                    }
                    match search_file_content_for_match(
                        &path_buf,
                        &query_lower,
                        &request_scope,
                        request_id,
                    ) {
                        Ok(Some((matched_snippet, matched_line_number))) => {
                            content_hit = true;
                            snippet = matched_snippet;
                            line_number = matched_line_number;
                        }
                        Ok(None) => {}
                        Err(()) => {
                            return Ok(empty_search_response(
                                FileSearchExecutionStrategy::LiveScan,
                                content_cache_status,
                                scanned_entry_count,
                                cached_name_entries.len() as u64,
                                truncated_by_scan_budget,
                            ))
                        }
                    }
                }
            }

            if let Some(entries) = cached_content_entries.as_mut() {
                entries.push(CachedSearchContentEntry {
                    name_lower: name_lower.clone(),
                    result: cached_name_result.clone(),
                    content: cached_content,
                });
            }

            if !name_hit && !content_hit {
                continue;
            }

            let mut result = cached_name_result;
            result.match_kind = match (name_hit, content_hit) {
                (true, true) => FileSearchMatchKind::NameAndContent,
                (false, true) => FileSearchMatchKind::Content,
                _ => FileSearchMatchKind::Name,
            };
            result.snippet = snippet;
            result.line_number = line_number;

            match result.match_kind {
                FileSearchMatchKind::NameAndContent => combined_matches.push(result),
                FileSearchMatchKind::Content => content_matches.push(result),
                FileSearchMatchKind::Name => name_matches.push(result),
            }
        }
    }

    if !is_search_request_active(&request_scope, request_id) {
        return Ok(empty_search_response(
            FileSearchExecutionStrategy::LiveScan,
            content_cache_status,
            scanned_entry_count,
            cached_name_entries.len() as u64,
            truncated_by_scan_budget,
        ));
    }
    let indexed_entry_count = cached_name_entries.len() as u64;
    if !truncated_by_scan_budget {
        store_search_name_index(&root, show_hidden, cached_name_entries);
    }
    let mut content_cache_stored_file_count = 0_u64;
    let mut content_cache_stored_byte_count = 0_u64;
    if content_cache_complete && !truncated_by_scan_budget {
        if let Some(entries) = cached_content_entries {
            content_cache_stored_file_count = entries
                .iter()
                .filter(|entry| entry.content.is_some())
                .count() as u64;
            content_cache_stored_byte_count = cached_content_bytes;
            store_search_content_index(&root, show_hidden, entries);
        }
    }

    let mut results = Vec::new();
    results.extend(combined_matches);
    results.extend(content_matches);
    results.extend(name_matches);
    sort_search_results(&mut results);
    results.truncate(max_results);
    Ok(FileSearchResponse {
        results,
        diagnostics: FileSearchDiagnostics {
            execution_strategy: FileSearchExecutionStrategy::LiveScan,
            content_cache_status,
            scanned_entry_count,
            indexed_entry_count,
            content_cache_stored_file_count,
            content_cache_stored_byte_count,
            truncated_by_scan_budget,
        },
    })
}

async fn execute_search_entries_command(
    path: String,
    query: String,
    show_hidden: bool,
    include_content: bool,
    limit: Option<usize>,
    request_id: Option<u64>,
    request_scope: Option<String>,
) -> Result<FileSearchResponse, String> {
    let scope = search_request_scope(&path, request_scope);
    let active_request_id = register_search_request(&scope, request_id);

    search_entries(
        path,
        query,
        show_hidden,
        include_content,
        limit,
        scope,
        active_request_id,
    )
    .await
}

#[tauri::command]
#[specta::specta]
pub fn fs_cancel_search_entries(
    path: String,
    request_id: Option<u64>,
    request_scope: Option<String>,
) -> Result<(), String> {
    let scope = search_request_scope(&path, request_scope);
    register_search_request(&scope, request_id);
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn fs_search_entries(
    path: String,
    query: String,
    show_hidden: bool,
    include_content: bool,
    limit: Option<usize>,
    request_id: Option<u64>,
    request_scope: Option<String>,
) -> Result<Vec<FileSearchResult>, String> {
    Ok(execute_search_entries_command(
        path,
        query,
        show_hidden,
        include_content,
        limit,
        request_id,
        request_scope,
    )
    .await?
    .results)
}

#[tauri::command]
#[specta::specta]
pub async fn fs_search_entries_with_diagnostics(
    path: String,
    query: String,
    show_hidden: bool,
    include_content: bool,
    limit: Option<usize>,
    request_id: Option<u64>,
    request_scope: Option<String>,
) -> Result<FileSearchResponse, String> {
    execute_search_entries_command(
        path,
        query,
        show_hidden,
        include_content,
        limit,
        request_id,
        request_scope,
    )
    .await
}

#[cfg(any(target_os = "windows", target_os = "macos"))]
fn map_default_open_result(result: file_opening::OpenResult) -> Result<(), String> {
    match result {
        file_opening::OpenResult::Success => Ok(()),
        file_opening::OpenResult::FileNotFound { path } => Err(format!("File not found: {}", path)),
        file_opening::OpenResult::AppNotFound { app_id } => Err(format!(
            "Application not found for file open request: {}",
            app_id
        )),
        file_opening::OpenResult::PermissionDenied { path } => {
            Err(format!("Permission denied while opening: {}", path))
        }
        file_opening::OpenResult::PlatformError { message } => Err(message),
    }
}

fn should_execute_path(path: &Path) -> bool {
    if path.is_dir() {
        return false;
    }

    let extension = normalized_extension(path);
    if matches!(
        extension.as_str(),
        "exe" | "msi" | "com" | "bat" | "cmd" | "ps1" | "sh" | "bash" | "zsh" | "fish"
    ) {
        return true;
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;

        return std::fs::metadata(path)
            .map(|metadata| metadata.permissions().mode() & 0o111 != 0)
            .unwrap_or(false);
    }

    #[cfg(not(unix))]
    {
        false
    }
}

fn open_with_default_application(path: &Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use file_opening::FileOpener;
        use file_opening_windows::WindowsFileOpener;

        let opener = WindowsFileOpener;
        return map_default_open_result(
            opener
                .open_with_default(path)
                .map_err(|error| error.to_string())?,
        );
    }

    #[cfg(target_os = "macos")]
    {
        use file_opening::FileOpener;
        use file_opening_macos::MacFileOpener;

        let opener = MacFileOpener;
        return map_default_open_result(
            opener
                .open_with_default(path)
                .map_err(|error| error.to_string())?,
        );
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(path)
            .spawn()
            .map_err(|error| error.to_string())?;
        return Ok(());
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Err("Opening files is not supported on this platform.".to_string())
    }
}

#[cfg(target_os = "windows")]
fn escape_powershell_single_quoted_string(value: &str) -> String {
    value.replace('\'', "''")
}

fn open_with_system_picker(path: &Path) -> Result<(), String> {
    let _ = path;

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("rundll32.exe")
            .arg("shell32.dll,OpenAs_RunDLL")
            .arg(path)
            .spawn()
            .map_err(|error| error.to_string())?;
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        let script = format!(
            "set targetFile to POSIX file \"{}\"\nset chosenApp to choose application with prompt \"Open With\"\ntell application chosenApp\n  activate\n  open targetFile\nend tell",
            escape_applescript_string(&path.to_string_lossy())
        );

        std::process::Command::new("osascript")
            .arg("-e")
            .arg(script)
            .spawn()
            .map_err(|error| error.to_string())?;
        return Ok(());
    }

    #[cfg(target_os = "linux")]
    {
        Err("Native Open With dialogs are not currently supported on Linux.".to_string())
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Err("Open With is not supported on this platform.".to_string())
    }
}

fn show_path_properties(path: &Path) -> Result<(), String> {
    let _ = path;

    #[cfg(target_os = "windows")]
    {
        let script = format!(
            "$path = '{}'; $shell = New-Object -ComObject Shell.Application; $folder = Split-Path -LiteralPath $path; $name = Split-Path -Leaf -LiteralPath $path; $item = $shell.Namespace($folder).ParseName($name); if ($null -eq $item) {{ throw 'Unable to resolve shell item.' }}; $item.InvokeVerb('properties')",
            escape_powershell_single_quoted_string(&path.to_string_lossy())
        );

        std::process::Command::new("powershell")
            .arg("-NoProfile")
            .arg("-Command")
            .arg(script)
            .spawn()
            .map_err(|error| error.to_string())?;
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        let script = format!(
            "tell application \"Finder\"\n  activate\n  set targetItem to POSIX file \"{}\" as alias\n  select targetItem\n  open information window of targetItem\nend tell",
            escape_applescript_string(&path.to_string_lossy())
        );

        std::process::Command::new("osascript")
            .arg("-e")
            .arg(script)
            .spawn()
            .map_err(|error| error.to_string())?;
        return Ok(());
    }

    #[cfg(target_os = "linux")]
    {
        Err("Native file properties are not currently supported on Linux.".to_string())
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Err("File properties are not supported on this platform.".to_string())
    }
}

fn execute_path(path: &Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let extension = normalized_extension(path);

        if extension == "ps1" {
            let mut command = std::process::Command::new("powershell");
            command
                .arg("-NoProfile")
                .arg("-ExecutionPolicy")
                .arg("Bypass")
                .arg("-File")
                .arg(path);
            if let Some(parent) = path.parent() {
                command.current_dir(parent);
            }
            command.spawn().map_err(|error| error.to_string())?;
            return Ok(());
        }

        if matches!(extension.as_str(), "sh" | "bash" | "zsh" | "fish") {
            for shell in ["bash", "sh"] {
                let mut command = std::process::Command::new(shell);
                command.arg(path);
                if let Some(parent) = path.parent() {
                    command.current_dir(parent);
                }

                match command.spawn() {
                    Ok(_) => return Ok(()),
                    Err(error) if error.kind() == std::io::ErrorKind::NotFound => continue,
                    Err(error) => return Err(error.to_string()),
                }
            }

            return Err(
                "No supported shell interpreter was found in PATH for this script.".to_string(),
            );
        }

        return open_with_default_application(path);
    }

    #[cfg(any(target_os = "macos", target_os = "linux"))]
    {
        let extension = normalized_extension(path);

        if matches!(extension.as_str(), "sh" | "bash" | "zsh" | "fish") {
            let interpreter = match extension.as_str() {
                "bash" => "bash",
                "zsh" => "zsh",
                "fish" => "fish",
                _ => "sh",
            };

            let mut command = std::process::Command::new(interpreter);
            command.arg(path);
            if let Some(parent) = path.parent() {
                command.current_dir(parent);
            }
            command.spawn().map_err(|error| error.to_string())?;
            return Ok(());
        }

        if extension == "ps1" {
            for shell in ["pwsh", "powershell"] {
                let mut command = std::process::Command::new(shell);
                command
                    .arg("-NoProfile")
                    .arg("-ExecutionPolicy")
                    .arg("Bypass")
                    .arg("-File")
                    .arg(path);
                if let Some(parent) = path.parent() {
                    command.current_dir(parent);
                }

                match command.spawn() {
                    Ok(_) => return Ok(()),
                    Err(error) if error.kind() == std::io::ErrorKind::NotFound => continue,
                    Err(error) => return Err(error.to_string()),
                }
            }

            return Err(
                "No supported PowerShell interpreter was found in PATH for this script."
                    .to_string(),
            );
        }

        let mut command = std::process::Command::new(path);
        if let Some(parent) = path.parent() {
            command.current_dir(parent);
        }
        command.spawn().map_err(|error| error.to_string())?;
        return Ok(());
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Err("Executing files is not supported on this platform.".to_string())
    }
}

// ─── fs_read_text_file ────────────────────────────────────────────────────────

#[tauri::command]
#[specta::specta]
pub async fn fs_read_text_file(path: String) -> Result<String, String> {
    // Limit file size to 10 MB to avoid hanging Monaco
    let meta = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    if meta.len() > 10 * 1024 * 1024 {
        return Err("File is too large to preview (> 10 MB)".to_string());
    }
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

// ─── fs_open_file ─────────────────────────────────────────────────────────────

#[tauri::command]
#[specta::specta]
pub async fn fs_open_file(path: String) -> Result<(), String> {
    let target = PathBuf::from(&path);
    if !target.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    if should_execute_path(&target) {
        return execute_path(&target);
    }

    open_with_default_application(&target)
}

#[tauri::command]
#[specta::specta]
pub async fn fs_open_archive(path: String) -> Result<FsArchiveExtractionResult, String> {
    let target = PathBuf::from(path);
    tauri::async_runtime::spawn_blocking(move || archive_ops::open_archive_cached(&target))
        .await
        .map_err(|error| format!("Archive open task join failure: {error}"))?
}

#[tauri::command]
#[specta::specta]
pub async fn fs_extract_archive(
    request: FsArchiveExtractionRequest,
) -> Result<FsArchiveExtractionResult, String> {
    if request.mode == FsArchiveExtractionMode::OpenCached {
        return Err("Use fs_open_archive for cached archive opening.".to_string());
    }

    let (_, result) = run_archive_extraction_task_with_result(request).await?;
    Ok(result)
}

#[tauri::command]
#[specta::specta]
pub async fn fs_open_with_dialog(path: String) -> Result<(), String> {
    let target = PathBuf::from(&path);
    if !target.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    open_with_system_picker(&target)
}

// ─── fs_open_as_admin (Windows runas) ────────────────────────────────────────

#[tauri::command]
#[specta::specta]
pub async fn fs_open_as_admin(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::ffi::OsStr;
        use std::os::windows::ffi::OsStrExt;

        let verb: Vec<u16> = OsStr::new("runas")
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        let file: Vec<u16> = OsStr::new(&path)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let result = unsafe {
            windows_sys::Win32::UI::Shell::ShellExecuteW(
                std::ptr::null_mut(),
                verb.as_ptr(),
                file.as_ptr(),
                std::ptr::null(),
                std::ptr::null(),
                1, // SW_SHOWNORMAL
            )
        };

        if result as isize <= 32 {
            return Err(format!(
                "ShellExecuteW failed with code: {}",
                result as isize
            ));
        }
        return Ok(());
    }
    #[cfg(target_os = "linux")]
    {
        let display = std::env::var("DISPLAY").unwrap_or_default();
        let xauthority = std::env::var("XAUTHORITY").unwrap_or_default();
        let runtime_dir = std::env::var("XDG_RUNTIME_DIR").unwrap_or_default();
        let command = format!(
            "DISPLAY={} XAUTHORITY={} XDG_RUNTIME_DIR={} xdg-open {}",
            shell_quote_single(&display),
            shell_quote_single(&xauthority),
            shell_quote_single(&runtime_dir),
            shell_quote_single(&path)
        );

        std::process::Command::new("pkexec")
            .arg("sh")
            .arg("-lc")
            .arg(command)
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        let shell_command = format!("open {}", shell_quote_single(&path));
        let script = format!(
            "do shell script \"{}\" with administrator privileges",
            escape_applescript_string(&shell_command)
        );

        std::process::Command::new("osascript")
            .arg("-e")
            .arg(script)
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }

    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
    {
        Err("Admin elevation is not implemented for this operating system.".to_string())
    }
}

// ─── fs_reveal_in_explorer ────────────────────────────────────────────────────

#[tauri::command]
#[specta::specta]
pub async fn fs_reveal_in_explorer(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg("/select,")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("-R")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(
                std::path::Path::new(&path)
                    .parent()
                    .unwrap_or(std::path::Path::new("/")),
            )
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }
}

#[tauri::command]
#[specta::specta]
pub async fn fs_show_item_properties(path: String) -> Result<(), String> {
    let target = PathBuf::from(&path);
    if !target.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    show_path_properties(&target)
}

// ─── fs_delete ────────────────────────────────────────────────────────────────

#[tauri::command]
#[specta::specta]
pub async fn fs_delete(path: String, recursive: bool) -> Result<(), String> {
    let p = Path::new(&path);
    ensure_nonrecursive_delete_allowed(p, recursive)?;
    delete_path_with_scheduler(p, recursive).await?;

    invalidate_all_fs_caches(p);
    if let Some(parent) = p.parent() {
        invalidate_all_fs_caches(parent);
    }

    Ok(())
}

// ─── fs_rename ────────────────────────────────────────────────────────────────

#[tauri::command]
#[specta::specta]
pub async fn fs_rename(old_path: String, new_path: String) -> Result<(), String> {
    ensure_yazi_runtime()?;
    let old_path_ref = Path::new(&old_path);
    let new_path_ref = Path::new(&new_path);
    let result = yazi_provider::rename(UrlBuf::from(old_path_ref), UrlBuf::from(new_path_ref))
        .await
        .map_err(|error| error.to_string());
    if result.is_ok() {
        invalidate_all_fs_caches(old_path_ref);
        invalidate_all_fs_caches(new_path_ref);
        if let Some(parent) = old_path_ref.parent() {
            invalidate_all_fs_caches(parent);
        }
        if let Some(parent) = new_path_ref.parent() {
            invalidate_all_fs_caches(parent);
        }
    }
    result
}

#[tauri::command]
#[specta::specta]
pub async fn fs_move(src: String, dst: String) -> Result<(), String> {
    let src_path = Path::new(&src);
    let dst_path = Path::new(&dst);
    validate_transfer_destination(src_path, dst_path, FileTransferOperation::Move)?;
    move_path(src_path, dst_path, true).await?;

    invalidate_all_fs_caches(src_path);
    invalidate_all_fs_caches(dst_path);
    if let Some(parent) = src_path.parent() {
        invalidate_all_fs_caches(parent);
    }
    if let Some(parent) = dst_path.parent() {
        invalidate_all_fs_caches(parent);
    }

    Ok(())
}

// ─── fs_copy ─────────────────────────────────────────────────────────────────

#[tauri::command]
#[specta::specta]
pub async fn fs_copy(src: String, dst: String) -> Result<(), String> {
    let src_path = Path::new(&src);
    let dst_path = Path::new(&dst);
    validate_transfer_destination(src_path, dst_path, FileTransferOperation::Copy)?;
    copy_path(src_path, dst_path, true).await?;

    invalidate_all_fs_caches(dst_path);
    if let Some(parent) = dst_path.parent() {
        invalidate_all_fs_caches(parent);
    }

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn fs_plan_transfer_items(
    target_dir: String,
    sources: Vec<String>,
    operation: FileTransferOperation,
) -> Result<Vec<FileTransferCollision>, String> {
    let target_dir_path = Path::new(&target_dir);
    if !target_dir_path.exists() {
        return Err(format!("Target directory does not exist: {}", target_dir));
    }
    if !target_dir_path.is_dir() {
        return Err(format!("Target path is not a directory: {}", target_dir));
    }

    let mut collisions = Vec::new();

    for source in sources {
        let source_path = PathBuf::from(&source);
        if !source_path.exists() {
            return Err(format!("Source path does not exist: {}", source));
        }

        let Some(file_name) = source_path.file_name() else {
            return Err(format!("Source path has no file name: {}", source));
        };

        let preferred_destination = target_dir_path.join(file_name);
        if preferred_destination == source_path {
            continue;
        }

        if !preferred_destination.exists() {
            continue;
        }

        collisions.push(FileTransferCollision {
            source_path: source_path.to_string_lossy().to_string(),
            source_name: file_name.to_string_lossy().to_string(),
            destination_path: preferred_destination.to_string_lossy().to_string(),
            operation,
            destination_exists: true,
            destination_is_dir: preferred_destination.is_dir(),
        });
    }

    Ok(collisions)
}

#[tauri::command]
#[specta::specta]
pub async fn fs_transfer_items(
    target_dir: String,
    sources: Vec<String>,
    operation: FileTransferOperation,
    collision_policy: Option<FileTransferCollisionPolicy>,
) -> Result<Vec<FileTransferResult>, String> {
    let target_dir_path = Path::new(&target_dir);
    if !target_dir_path.exists() {
        return Err(format!("Target directory does not exist: {}", target_dir));
    }
    if !target_dir_path.is_dir() {
        return Err(format!("Target path is not a directory: {}", target_dir));
    }

    let mut results = Vec::new();
    let resolved_collision_policy =
        collision_policy.unwrap_or(FileTransferCollisionPolicy::KeepBoth);

    for source in sources {
        let source_path = PathBuf::from(&source);
        if !source_path.exists() {
            return Err(format!("Source path does not exist: {}", source));
        }

        let Some(file_name) = source_path.file_name() else {
            return Err(format!("Source path has no file name: {}", source));
        };

        let preferred_destination = target_dir_path.join(file_name);
        let destination = resolve_transfer_destination(
            preferred_destination.clone(),
            operation,
            &source_path,
            resolved_collision_policy,
        );

        if source_path == destination {
            continue;
        }

        if resolved_collision_policy == FileTransferCollisionPolicy::Skip
            && preferred_destination.exists()
            && preferred_destination != source_path
        {
            results.push(FileTransferResult {
                source_path: source_path.to_string_lossy().to_string(),
                destination_path: preferred_destination.to_string_lossy().to_string(),
                operation,
                collision_policy: resolved_collision_policy,
                disposition: FileTransferDisposition::SkippedExisting,
            });
            continue;
        }

        validate_transfer_destination(&source_path, &destination, operation)?;

        let operation_result = match operation {
            FileTransferOperation::Copy => copy_path(&source_path, &destination, true).await,
            FileTransferOperation::Move => move_path(&source_path, &destination, true).await,
        };

        if let Err(error) = operation_result {
            return Err(error);
        }

        results.push(FileTransferResult {
            source_path: source_path.to_string_lossy().to_string(),
            destination_path: destination.to_string_lossy().to_string(),
            operation,
            collision_policy: resolved_collision_policy,
            disposition: FileTransferDisposition::Transferred,
        });
    }

    for result in &results {
        invalidate_all_fs_caches(Path::new(&result.source_path));
        invalidate_all_fs_caches(Path::new(&result.destination_path));
        if let Some(parent) = Path::new(&result.source_path).parent() {
            invalidate_all_fs_caches(parent);
        }
        if let Some(parent) = Path::new(&result.destination_path).parent() {
            invalidate_all_fs_caches(parent);
        }
    }

    Ok(results)
}

#[tauri::command]
#[specta::specta]
pub async fn fs_list_explorer_tasks() -> Result<Vec<ExplorerTaskRecord>, String> {
    list_explorer_tasks_snapshot()
}

fn should_clear_explorer_task(
    scope: ExplorerTaskHistoryClearScope,
    status: ExplorerTaskStatus,
) -> bool {
    match scope {
        ExplorerTaskHistoryClearScope::Completed => status == ExplorerTaskStatus::Succeeded,
        ExplorerTaskHistoryClearScope::Failed => {
            matches!(
                status,
                ExplorerTaskStatus::Failed | ExplorerTaskStatus::Cancelled
            )
        }
        ExplorerTaskHistoryClearScope::Finished => status != ExplorerTaskStatus::Running,
    }
}

#[tauri::command]
#[specta::specta]
pub async fn fs_clear_explorer_task_history(
    scope: ExplorerTaskHistoryClearScope,
) -> Result<(), String> {
    let mut registry = explorer_task_registry()
        .lock()
        .map_err(|_| "Explorer task registry lock was poisoned.".to_string())?;
    let retained_task_ids = registry
        .order
        .iter()
        .filter_map(|task_id| {
            registry.entries.get(task_id).and_then(|entry| {
                if should_clear_explorer_task(scope, entry.record.status) {
                    None
                } else {
                    Some(task_id.clone())
                }
            })
        })
        .collect::<Vec<_>>();
    registry.order = retained_task_ids;
    registry
        .entries
        .retain(|_, entry| !should_clear_explorer_task(scope, entry.record.status));
    Ok(())
}

fn retry_context_for_task(task_id: &str) -> Result<ExplorerTaskRetryContext, String> {
    let registry = explorer_task_registry()
        .lock()
        .map_err(|_| "Explorer task registry lock was poisoned.".to_string())?;
    let entry = registry
        .entries
        .get(task_id)
        .ok_or_else(|| format!("Explorer task not found: {task_id}"))?;
    if !entry.record.can_retry {
        return Err(format!("Explorer task is not retryable: {task_id}"));
    }
    entry
        .retry_context
        .clone()
        .ok_or_else(|| format!("Explorer task has no retry context: {task_id}"))
}

#[tauri::command]
#[specta::specta]
pub async fn fs_retry_explorer_task(
    app: AppHandle,
    task_id: String,
) -> Result<ExplorerTaskRecord, String> {
    let retry_context = retry_context_for_task(&task_id)?;
    let next_task_id = match retry_context {
        ExplorerTaskRetryContext::Copy {
            source_path,
            destination_path,
        } => copy_path(Path::new(&source_path), Path::new(&destination_path), true).await?,
        ExplorerTaskRetryContext::Move {
            source_path,
            destination_path,
        } => move_path(Path::new(&source_path), Path::new(&destination_path), true).await?,
        ExplorerTaskRetryContext::Delete { path, recursive } => {
            let path_ref = Path::new(&path);
            ensure_nonrecursive_delete_allowed(path_ref, recursive)?;
            delete_path_with_scheduler(path_ref, recursive).await?
        }
        ExplorerTaskRetryContext::BatchRename { items } => {
            crate::explorer_pro_commands::run_batch_rename_task(items).await?
        }
        ExplorerTaskRetryContext::DuplicateScan { root_path } => {
            crate::explorer_pro_commands::start_duplicate_scan_task(app, root_path)?
        }
        ExplorerTaskRetryContext::RecursiveSize {
            paths,
            force_refresh,
        } => run_recursive_size_task(paths, force_refresh).await?.0,
        ExplorerTaskRetryContext::Checksum { paths } => run_checksum_task(paths).await?.0,
        ExplorerTaskRetryContext::ArchiveExtraction { request } => {
            run_archive_extraction_task(request).await?
        }
        ExplorerTaskRetryContext::AudioTransform { request } => {
            crate::audio_commands::audio_export_transform(app, request)
                .await?
                .task_id
        }
        ExplorerTaskRetryContext::AudioBatchProcess { request } => {
            crate::audio_commands::audio_batch_process(app, request)
                .await?
                .task_id
        }
    };
    let tasks = list_explorer_tasks_snapshot()?;
    tasks
        .into_iter()
        .find(|record| record.id == next_task_id)
        .ok_or_else(|| format!("Retried explorer task was not registered: {next_task_id}"))
}

fn cancel_context_for_task(task_id: &str) -> Result<ExplorerTaskCancelContext, String> {
    let mut registry = explorer_task_registry()
        .lock()
        .map_err(|_| "Explorer task registry lock was poisoned.".to_string())?;
    let entry = registry
        .entries
        .get_mut(task_id)
        .ok_or_else(|| format!("Explorer task not found: {task_id}"))?;
    if !entry.record.can_cancel {
        return Err(format!("Explorer task is not cancellable: {task_id}"));
    }
    entry.cancel_requested = true;
    entry
        .cancel_context
        .clone()
        .ok_or_else(|| format!("Explorer task has no cancel context: {task_id}"))
}

#[tauri::command]
#[specta::specta]
pub async fn fs_cancel_explorer_task(task_id: String) -> Result<ExplorerTaskRecord, String> {
    let cancel_context = cancel_context_for_task(&task_id)?;
    match cancel_context {
        ExplorerTaskCancelContext::Yazi { scheduler_task_id } => {
            if let Ok(scheduler) = fs_command_scheduler() {
                scheduler.cancel(scheduler_task_id);
            }
        }
        ExplorerTaskCancelContext::DuplicateScan { scan_id } => {
            crate::explorer_pro_commands::cancel_duplicate_scan_task(&scan_id)?;
        }
        ExplorerTaskCancelContext::AudioOperation { operation_id } => {
            crate::audio_commands::cancel_audio_task(&operation_id)?;
        }
    }
    cancel_manual_explorer_task(&task_id, None)
}

fn ensure_nonrecursive_delete_allowed(path: &Path, recursive: bool) -> Result<(), String> {
    if recursive || !path.is_dir() {
        return Ok(());
    }

    let mut entries = std::fs::read_dir(path).map_err(|error| error.to_string())?;
    let has_entries = entries
        .next()
        .transpose()
        .map_err(|error| error.to_string())?
        .is_some();

    if has_entries {
        return Err(format!("Directory is not empty: {}", path.display()));
    }

    Ok(())
}

fn validate_transfer_destination(
    source_path: &Path,
    destination: &Path,
    operation: FileTransferOperation,
) -> Result<(), String> {
    if !source_path.is_dir() {
        return Ok(());
    }

    let normalized_source = if source_path.is_absolute() {
        source_path.to_path_buf()
    } else {
        std::env::current_dir()
            .map(|cwd| cwd.join(source_path))
            .unwrap_or_else(|_| source_path.to_path_buf())
    };
    let normalized_destination = if destination.is_absolute() {
        destination.to_path_buf()
    } else {
        std::env::current_dir()
            .map(|cwd| cwd.join(destination))
            .unwrap_or_else(|_| destination.to_path_buf())
    };

    if normalized_destination.starts_with(&normalized_source) {
        return Err(format!(
            "Cannot {:?} a folder into itself or one of its descendants: {} -> {}",
            operation,
            source_path.display(),
            destination.display()
        ));
    }

    Ok(())
}

async fn ensure_destination_parent_dir(path: &Path) -> Result<(), String> {
    let Some(parent) = path.parent() else {
        return Ok(());
    };

    if parent.as_os_str().is_empty() {
        return Ok(());
    }

    ensure_yazi_runtime()?;
    yazi_provider::create_dir_all(UrlBuf::from(parent))
        .await
        .map_err(|error| {
            format!(
                "Failed to create destination parent directory {} via Yazi VFS: {error}",
                parent.display()
            )
        })
}

fn yazi_task_registration(
    kind: ExplorerTaskKind,
    title: String,
    detail: String,
    source_paths: Vec<String>,
    destination_path: Option<String>,
    retry_context: Option<ExplorerTaskRetryContext>,
) -> ExplorerTaskRegistration {
    ExplorerTaskRegistration {
        kind,
        title,
        detail,
        source_paths,
        destination_path,
        retry_context,
        can_undo: false,
    }
}

fn archive_task_initial_output_path(request: &FsArchiveExtractionRequest) -> Option<String> {
    match request.mode {
        FsArchiveExtractionMode::ExtractHere => Path::new(&request.archive_path)
            .parent()
            .map(|path| path.to_string_lossy().into_owned()),
        FsArchiveExtractionMode::OpenCached | FsArchiveExtractionMode::ExtractToNewFolder => None,
    }
}

fn archive_task_registration(
    request: &FsArchiveExtractionRequest,
    output_path: Option<String>,
) -> ExplorerTaskRegistration {
    let archive_path = Path::new(&request.archive_path);
    let archive_label = task_path_label(archive_path);
    let (title_prefix, detail_suffix) = match request.mode {
        FsArchiveExtractionMode::OpenCached => ("Open", "cached contents"),
        FsArchiveExtractionMode::ExtractHere => ("Extract", "here"),
        FsArchiveExtractionMode::ExtractToNewFolder => ("Extract", "to a new folder"),
    };
    let detail = output_path
        .as_ref()
        .map(|path| format!("{} -> {}", archive_path.display(), path))
        .unwrap_or_else(|| format!("{} -> {}", archive_path.display(), detail_suffix));

    ExplorerTaskRegistration {
        kind: ExplorerTaskKind::ExtractArchive,
        title: format!("{title_prefix} {archive_label}"),
        detail,
        source_paths: vec![request.archive_path.clone()],
        destination_path: output_path,
        retry_context: Some(ExplorerTaskRetryContext::ArchiveExtraction {
            request: request.clone(),
        }),
        can_undo: false,
    }
}

fn archive_task_success_detail(result: &FsArchiveExtractionResult) -> String {
    if result.reused_cached_output {
        return format!("Reused extracted contents at {}", result.output_path);
    }

    let item_label = if result.extracted_entry_count == 1 {
        "item"
    } else {
        "items"
    };
    format!(
        "Extracted {} {} to {}",
        result.extracted_entry_count, item_label, result.output_path
    )
}

fn complete_archive_extraction_task(
    task_id: &str,
    result: &FsArchiveExtractionResult,
) -> Result<ExplorerTaskRecord, String> {
    mutate_explorer_task(task_id, |entry| {
        entry.record.status = ExplorerTaskStatus::Succeeded;
        entry.record.finished_at = Some(current_epoch_ms());
        entry.record.detail = archive_task_success_detail(result);
        entry.record.destination_path = Some(result.output_path.clone());
        entry.record.error_message = None;
    })
}

async fn execute_archive_extraction(
    request: FsArchiveExtractionRequest,
) -> Result<FsArchiveExtractionResult, String> {
    tauri::async_runtime::spawn_blocking(move || archive_ops::extract_archive(&request))
        .await
        .map_err(|error| format!("Archive extraction task join failure: {error}"))?
}

async fn run_archive_extraction_task_with_result(
    request: FsArchiveExtractionRequest,
) -> Result<(String, FsArchiveExtractionResult), String> {
    let task_id = create_manual_explorer_task(archive_task_registration(
        &request,
        archive_task_initial_output_path(&request),
    ));
    match execute_archive_extraction(request).await {
        Ok(result) => {
            complete_archive_extraction_task(&task_id, &result)?;
            Ok((task_id, result))
        }
        Err(error) => {
            let _ = fail_manual_explorer_task(&task_id, error.clone());
            Err(error)
        }
    }
}

async fn run_archive_extraction_task(
    request: FsArchiveExtractionRequest,
) -> Result<String, String> {
    let (task_id, _) = run_archive_extraction_task_with_result(request).await?;
    Ok(task_id)
}

async fn copy_path(src: &Path, dst: &Path, force: bool) -> Result<String, String> {
    ensure_destination_parent_dir(dst).await?;
    let ticket = fs_command_scheduler()?.file_copy_ticket(
        UrlBuf::from(src),
        UrlBuf::from(dst),
        force,
        false,
    );
    await_explorer_yazi_task(
        ticket,
        yazi_task_registration(
            ExplorerTaskKind::Copy,
            format!("Copy {}", task_path_label(src)),
            format!("{} -> {}", src.display(), dst.display()),
            vec![src.to_string_lossy().to_string()],
            Some(dst.to_string_lossy().to_string()),
            Some(ExplorerTaskRetryContext::Copy {
                source_path: src.to_string_lossy().to_string(),
                destination_path: dst.to_string_lossy().to_string(),
            }),
        ),
    )
    .await
}

async fn yazi_path_metadata(path: &Path) -> Result<Option<Cha>, String> {
    ensure_yazi_runtime()?;

    match yazi_provider::symlink_metadata(UrlBuf::from(path)).await {
        Ok(metadata) => Ok(Some(metadata)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!(
            "Failed to inspect {} via Yazi VFS: {error}",
            path.display()
        )),
    }
}

async fn cleanup_residual_move_source(source: &Path, metadata: Cha) -> Result<(), String> {
    let url = UrlBuf::from(source);
    let cleanup_result = if metadata.is_dir() && !metadata.is_link() {
        yazi_provider::remove_dir_all(url).await
    } else {
        yazi_provider::remove_file(url).await
    };

    cleanup_result.map_err(|error| {
        format!(
            "Move completed but residual source cleanup failed for {}: {error}",
            source.display()
        )
    })
}

async fn move_path(src: &Path, dst: &Path, force: bool) -> Result<String, String> {
    ensure_destination_parent_dir(dst).await?;
    let ticket =
        fs_command_scheduler()?.file_cut_ticket(UrlBuf::from(src), UrlBuf::from(dst), force);
    let task_id = await_explorer_yazi_task(
        ticket,
        yazi_task_registration(
            ExplorerTaskKind::Move,
            format!("Move {}", task_path_label(src)),
            format!("{} -> {}", src.display(), dst.display()),
            vec![src.to_string_lossy().to_string()],
            Some(dst.to_string_lossy().to_string()),
            Some(ExplorerTaskRetryContext::Move {
                source_path: src.to_string_lossy().to_string(),
                destination_path: dst.to_string_lossy().to_string(),
            }),
        ),
    )
    .await?;

    let destination_metadata = yazi_path_metadata(dst).await?;
    let source_metadata = yazi_path_metadata(src).await?;

    match (destination_metadata, source_metadata) {
        (None, _) => Err(format!(
            "Move completed but destination is missing: {}",
            dst.display()
        )),
        (Some(_), None) => Ok(()),
        (Some(_), Some(metadata)) => cleanup_residual_move_source(src, metadata).await,
    }?;

    Ok(task_id)
}

async fn delete_path_with_scheduler(path: &Path, recursive: bool) -> Result<String, String> {
    let ticket = fs_command_scheduler()?.file_delete_ticket(UrlBuf::from(path));
    await_explorer_yazi_task(
        ticket,
        yazi_task_registration(
            ExplorerTaskKind::Delete,
            format!("Delete {}", task_path_label(path)),
            path.display().to_string(),
            vec![path.to_string_lossy().to_string()],
            None,
            Some(ExplorerTaskRetryContext::Delete {
                path: path.to_string_lossy().to_string(),
                recursive,
            }),
        ),
    )
    .await
}

fn resolve_transfer_destination(
    preferred_path: PathBuf,
    operation: FileTransferOperation,
    source_path: &Path,
    collision_policy: FileTransferCollisionPolicy,
) -> PathBuf {
    match collision_policy {
        FileTransferCollisionPolicy::KeepBoth => {
            collision_free_destination(preferred_path, operation, source_path)
        }
        FileTransferCollisionPolicy::Replace | FileTransferCollisionPolicy::Skip => preferred_path,
    }
}

fn collision_free_destination(
    preferred_path: PathBuf,
    operation: FileTransferOperation,
    source_path: &Path,
) -> PathBuf {
    if !preferred_path.exists() || preferred_path == source_path {
        return preferred_path;
    }

    let parent = preferred_path
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from("."));
    let file_name = preferred_path
        .file_name()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|| "item".to_string());

    if preferred_path.is_dir() || source_path.is_dir() {
        return numbered_destination(&parent, &file_name, "", operation);
    }

    let stem = preferred_path
        .file_stem()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|| file_name.clone());
    let ext = preferred_path
        .extension()
        .map(|value| format!(".{}", value.to_string_lossy()))
        .unwrap_or_default();

    numbered_destination(&parent, &stem, &ext, operation)
}

fn numbered_destination(
    parent: &Path,
    base_name: &str,
    extension: &str,
    operation: FileTransferOperation,
) -> PathBuf {
    let copy_suffix = "copy";
    let first_candidate = match operation {
        FileTransferOperation::Copy => format!("{base_name} ({copy_suffix}){extension}"),
        FileTransferOperation::Move => format!("{base_name} (moved){extension}"),
    };

    let first_path = parent.join(&first_candidate);
    if !first_path.exists() {
        return first_path;
    }

    for index in 2..10_000 {
        let candidate = match operation {
            FileTransferOperation::Copy => {
                format!("{base_name} ({copy_suffix} {index}){extension}")
            }
            FileTransferOperation::Move => format!("{base_name} (moved {index}){extension}"),
        };
        let candidate_path = parent.join(candidate);
        if !candidate_path.exists() {
            return candidate_path;
        }
    }

    parent.join(format!("{base_name}-fallback{extension}"))
}

// ─── fs_create_dir ────────────────────────────────────────────────────────────

#[tauri::command]
#[specta::specta]
pub async fn fs_create_dir(path: String) -> Result<(), String> {
    ensure_yazi_runtime()?;
    let result = yazi_provider::create_dir_all(UrlBuf::from(Path::new(&path)))
        .await
        .map_err(|e| e.to_string());
    if result.is_ok() {
        let path_ref = Path::new(&path);
        invalidate_all_fs_caches(path_ref);
        if let Some(parent) = path_ref.parent() {
            invalidate_all_fs_caches(parent);
        }
    }
    result
}

// ─── fs_write_file ────────────────────────────────────────────────────────────

#[tauri::command]
#[specta::specta]
pub async fn fs_write_file(path: String, content: FsWriteFileContent) -> Result<(), String> {
    if let Some(parent) = std::path::Path::new(&path).parent() {
        ensure_yazi_runtime()?;
        yazi_provider::create_dir_all(UrlBuf::from(parent))
            .await
            .map_err(|e| e.to_string())?;
    }
    let bytes = match content {
        FsWriteFileContent::Text(text) => text.into_bytes(),
        FsWriteFileContent::Bytes(bytes) => bytes,
    };
    let result = yazi_provider::write(UrlBuf::from(Path::new(&path)), bytes)
        .await
        .map(|_| ())
        .map_err(|e| e.to_string());
    if result.is_ok() {
        let path_ref = Path::new(&path);
        invalidate_all_fs_caches(path_ref);
        if let Some(parent) = path_ref.parent() {
            invalidate_all_fs_caches(parent);
        }
    }
    result
}

// ─── git_exec ─────────────────────────────────────────────────────────────────
// Executes a git command in the specified directory and returns stdout (or stderr on failure)
const GIT_EXEC_TIMEOUT: Duration = Duration::from_secs(20);

fn git_command_program() -> String {
    std::env::var("OVERLAYTERM_GIT_EXECUTABLE")
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "git".to_string())
}

fn run_git_command(repo_path: &str, args: &[String], timeout: Duration) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    use std::os::windows::process::CommandExt;

    let program = git_command_program();
    let mut cmd = Command::new(&program);
    cmd.current_dir(repo_path)
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to run git via '{}': {}", program, e))?;

    let started = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(_)) => {
                let output = child
                    .wait_with_output()
                    .map_err(|e| format!("Failed to collect git output: {}", e))?;
                return if output.status.success() {
                    Ok(String::from_utf8_lossy(&output.stdout).to_string())
                } else {
                    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
                    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    let exit_code = output
                        .status
                        .code()
                        .map(|code| code.to_string())
                        .unwrap_or_else(|| "signal".to_string());
                    let output_detail = if !stderr.is_empty() {
                        stderr
                    } else if !stdout.is_empty() {
                        stdout
                    } else {
                        "no output".to_string()
                    };
                    Err(format!(
                        "Git command failed (exit {}): {}",
                        exit_code, output_detail
                    ))
                };
            }
            Ok(None) => {
                if started.elapsed() >= timeout {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(format!(
                        "Git command timed out after {}s: {} {}",
                        timeout.as_secs(),
                        program,
                        args.join(" ")
                    ));
                }
                thread::sleep(Duration::from_millis(15));
            }
            Err(e) => return Err(format!("Failed while waiting for git: {}", e)),
        }
    }
}

#[tauri::command]
#[specta::specta]
pub async fn git_exec(repo_path: String, args: Vec<String>) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        run_git_command(&repo_path, &args, GIT_EXEC_TIMEOUT)
    })
    .await
    .map_err(|join_error| format!("Git task join failure: {}", join_error))?
}

// ─── fs_read_file_base64 ─────────────────────────────────────────────────────
// Returns the file as a data-URI so the frontend can render it without
// needing the asset:// protocol (which requires allow-listed paths).
const FS_READ_FILE_BASE64_MAX_BYTES: u64 = 12 * 1024 * 1024;
#[tauri::command]
#[specta::specta]
pub async fn fs_read_file_base64(path: String) -> Result<String, String> {
    use std::io::Read;
    let meta = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    // Keep previews responsive: this path reads the full file into memory and base64 inflates it.
    if meta.len() > FS_READ_FILE_BASE64_MAX_BYTES {
        return Err("File is too large to preview (> 12 MB)".to_string());
    }
    let mut file = std::fs::File::open(&path).map_err(|e| e.to_string())?;
    let mut buf = Vec::new();
    file.read_to_end(&mut buf).map_err(|e| e.to_string())?;

    // Determine MIME type from extension
    let ext = std::path::Path::new(&path)
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    let mime = match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        "ico" => "image/x-icon",
        "svg" => "image/svg+xml",
        "tiff" | "tif" => "image/tiff",
        "avif" => "image/avif",
        "glb" => "model/gltf-binary",
        "gltf" => "model/gltf+json",
        "obj" => "text/plain",
        "stl" => "model/stl",
        "fbx" => "application/octet-stream",
        _ => "application/octet-stream",
    };

    // Use a simple base64 encoder (no external crate needed — stdlib in Rust is fine)
    let b64 = base64_encode(&buf);
    Ok(format!("data:{};base64,{}", mime, b64))
}

#[tauri::command]
#[specta::specta]
pub async fn fs_read_image_thumbnail(
    path: String,
    max_width: u32,
    max_height: u32,
) -> Result<String, String> {
    crate::thumbnail_commands::build_image_thumbnail_data_url(
        std::path::Path::new(&path),
        max_width,
        max_height,
    )
}

/// Minimal, allocation-efficient base64 encoder (RFC 4648, no padding issues)
fn base64_encode(input: &[u8]) -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity((input.len() + 2) / 3 * 4);
    for chunk in input.chunks(3) {
        let b0 = chunk[0] as usize;
        let b1 = if chunk.len() > 1 {
            chunk[1] as usize
        } else {
            0
        };
        let b2 = if chunk.len() > 2 {
            chunk[2] as usize
        } else {
            0
        };
        out.push(CHARS[b0 >> 2] as char);
        out.push(CHARS[((b0 & 3) << 4) | (b1 >> 4)] as char);
        out.push(if chunk.len() > 1 {
            CHARS[((b1 & 15) << 2) | (b2 >> 6)] as char
        } else {
            '='
        });
        out.push(if chunk.len() > 2 {
            CHARS[b2 & 63] as char
        } else {
            '='
        });
    }
    out
}

// ─── fs_get_home_dir ──────────────────────────────────────────────────────────

#[tauri::command]
#[specta::specta]
pub async fn fs_get_home_dir() -> Result<String, String> {
    dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| "Could not determine home directory".to_string())
}

#[cfg(target_os = "windows")]
fn current_process_is_elevated() -> Result<bool, String> {
    unsafe {
        let mut token_handle = std::ptr::null_mut();
        if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token_handle) == 0 {
            return Err(std::io::Error::last_os_error().to_string());
        }

        struct TokenGuard(isize);
        impl Drop for TokenGuard {
            fn drop(&mut self) {
                unsafe {
                    CloseHandle(self.0 as _);
                }
            }
        }

        let _token_guard = TokenGuard(token_handle as isize);
        let mut elevation = TOKEN_ELEVATION { TokenIsElevated: 0 };
        let mut bytes_returned = 0u32;

        if GetTokenInformation(
            token_handle,
            TokenElevation,
            &mut elevation as *mut _ as *mut _,
            std::mem::size_of::<TOKEN_ELEVATION>() as u32,
            &mut bytes_returned,
        ) == 0
        {
            return Err(std::io::Error::last_os_error().to_string());
        }

        Ok(elevation.TokenIsElevated != 0)
    }
}

#[tauri::command]
#[specta::specta]
pub async fn fs_is_process_elevated() -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        return current_process_is_elevated();
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(false)
    }
}

// ─── Unit Tests ───────────────────────────────────────────────────────────────
// Run with: cargo test -p tauri-app

#[cfg(test)]
mod tests {
    use super::*;
    use image::{Rgba, RgbaImage};
    use std::fs;
    use std::path::PathBuf;
    use tempfile::TempDir;

    // ── helper: build a FileEntry directly (bypasses async/Tauri) ──────────────

    fn make_entry(name: &str, is_dir: bool, size: u64, ext: &str, hidden: bool) -> FileEntry {
        FileEntry {
            name: name.to_string(),
            path: format!("C:\\test\\{}", name),
            is_dir,
            size,
            modified: 1_700_000_000_000,
            extension: ext.to_string(),
            is_hidden: hidden,
            is_symlink: false,
        }
    }

    // ── Sorting logic (extracted so we can test it without async/Tauri) ─────────

    fn sort_entries(entries: &mut Vec<FileEntry>) {
        entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        });
    }

    // ── Extension extraction helper ─────────────────────────────────────────────

    fn get_extension(path: &str) -> String {
        std::path::Path::new(path)
            .extension()
            .map(|e| e.to_string_lossy().to_lowercase())
            .unwrap_or_default()
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Sorting
    // ═══════════════════════════════════════════════════════════════════════════

    #[test]
    fn sort_dirs_before_files() {
        let mut entries = vec![
            make_entry("zebra.txt", false, 100, "txt", false),
            make_entry("alpha", true, 0, "", false),
            make_entry("mango.rs", false, 200, "rs", false),
            make_entry("beta", true, 0, "", false),
        ];
        sort_entries(&mut entries);

        // First two must be directories
        assert!(
            entries[0].is_dir,
            "entry[0] should be dir, got '{}'",
            entries[0].name
        );
        assert!(
            entries[1].is_dir,
            "entry[1] should be dir, got '{}'",
            entries[1].name
        );
        // Last two must be files
        assert!(
            !entries[2].is_dir,
            "entry[2] should be file, got '{}'",
            entries[2].name
        );
        assert!(
            !entries[3].is_dir,
            "entry[3] should be file, got '{}'",
            entries[3].name
        );
    }

    #[test]
    fn sort_dirs_alphabetically() {
        let mut entries = vec![
            make_entry("Zeta", true, 0, "", false),
            make_entry("alpha", true, 0, "", false),
            make_entry("Beta", true, 0, "", false),
        ];
        sort_entries(&mut entries);
        assert_eq!(entries[0].name, "alpha");
        assert_eq!(entries[1].name, "Beta");
        assert_eq!(entries[2].name, "Zeta");
    }

    #[test]
    fn sort_files_alphabetically() {
        let mut entries = vec![
            make_entry("zebra.txt", false, 10, "txt", false),
            make_entry("Apple.rs", false, 20, "rs", false),
            make_entry("mango.json", false, 30, "json", false),
        ];
        sort_entries(&mut entries);
        assert_eq!(entries[0].name, "Apple.rs");
        assert_eq!(entries[1].name, "mango.json");
        assert_eq!(entries[2].name, "zebra.txt");
    }

    #[test]
    fn sort_empty_list_is_noop() {
        let mut entries: Vec<FileEntry> = vec![];
        sort_entries(&mut entries);
        assert!(entries.is_empty());
    }

    #[test]
    fn sort_single_entry_unchanged() {
        let mut entries = vec![make_entry("lone.txt", false, 1, "txt", false)];
        sort_entries(&mut entries);
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].name, "lone.txt");
    }

    #[test]
    fn sort_case_insensitive_mixed() {
        let mut entries = vec![
            make_entry("ZZZ", true, 0, "", false),
            make_entry("aaa", true, 0, "", false),
            make_entry("MMM", true, 0, "", false),
        ];
        sort_entries(&mut entries);
        assert_eq!(entries[0].name, "aaa");
        assert_eq!(entries[1].name, "MMM");
        assert_eq!(entries[2].name, "ZZZ");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Extension extraction
    // ═══════════════════════════════════════════════════════════════════════════

    #[test]
    fn extension_simple() {
        assert_eq!(get_extension("file.txt"), "txt");
        assert_eq!(get_extension("file.RS"), "rs"); // lowercased
        assert_eq!(get_extension("file.JSON"), "json");
    }

    #[test]
    fn extension_multi_dot() {
        // Only the last extension
        assert_eq!(get_extension("archive.tar.gz"), "gz");
        assert_eq!(get_extension("vite.config.ts"), "ts");
    }

    #[test]
    fn extension_no_extension() {
        assert_eq!(get_extension("Makefile"), "");
        assert_eq!(get_extension("README"), "");
    }

    #[test]
    fn extension_hidden_unix_file() {
        // ".gitignore" has no extension (the name IS the dot-file)
        assert_eq!(get_extension(".gitignore"), "");
        // ".env" has no extension either
        assert_eq!(get_extension(".env"), "");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // FileEntry serialisation (snapshot of struct field types)
    // ═══════════════════════════════════════════════════════════════════════════

    #[test]
    fn file_entry_serialises_to_json() {
        let entry = make_entry("test.ts", false, 2048, "ts", false);
        let json = serde_json::to_string(&entry).expect("serialisation failed");

        // Check all required fields are present in the JSON blob
        for field in &[
            "name",
            "path",
            "is_dir",
            "size",
            "modified",
            "extension",
            "is_hidden",
            "is_symlink",
        ] {
            assert!(
                json.contains(field),
                "missing field '{}' in JSON: {}",
                field,
                json
            );
        }
        assert!(json.contains("\"name\":\"test.ts\""), "name mismatch");
        assert!(json.contains("\"size\":2048"), "size mismatch");
        assert!(json.contains("\"extension\":\"ts\""), "extension mismatch");
        assert!(json.contains("\"is_dir\":false"), "is_dir mismatch");
    }

    #[test]
    fn drive_info_serialises_to_json() {
        let drive = DriveInfo {
            letter: "C:".to_string(),
            label: "OS".to_string(),
            total_bytes: 512_000_000_000,
            free_bytes: 128_000_000_000,
            drive_type: "fixed".to_string(),
        };
        let json = serde_json::to_string(&drive).expect("serialisation failed");
        assert!(json.contains("\"letter\":\"C:\""));
        assert!(json.contains("\"drive_type\":\"fixed\""));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Real filesystem integration tests (uses tempdir — always safe)
    // ═══════════════════════════════════════════════════════════════════════════

    fn tmp_dir() -> TempDir {
        tempfile::tempdir().expect("failed to create tempdir")
    }

    #[cfg(test)]
    struct SearchScanDelayGuard;

    #[cfg(test)]
    impl Drop for SearchScanDelayGuard {
        fn drop(&mut self) {
            SEARCH_ENTRY_TEST_DELAY_MS.store(0, Ordering::Relaxed);
            SEARCH_ENTRY_TEST_SCAN_COUNT.store(0, Ordering::Relaxed);
        }
    }

    #[cfg(test)]
    fn set_search_scan_delay(delay_ms: u64) -> SearchScanDelayGuard {
        SEARCH_ENTRY_TEST_DELAY_MS.store(delay_ms, Ordering::Relaxed);
        SEARCH_ENTRY_TEST_SCAN_COUNT.store(0, Ordering::Relaxed);
        SearchScanDelayGuard
    }

    #[cfg(test)]
    fn reset_search_scan_count() {
        SEARCH_ENTRY_TEST_SCAN_COUNT.store(0, Ordering::Relaxed);
    }

    #[cfg(test)]
    fn search_scan_count() -> u64 {
        SEARCH_ENTRY_TEST_SCAN_COUNT.load(Ordering::Relaxed)
    }

    #[cfg(test)]
    async fn search_test_serial_lock() -> tokio::sync::MutexGuard<'static, ()> {
        static SEARCH_TEST_SERIAL_MUTEX: OnceLock<tokio::sync::Mutex<()>> = OnceLock::new();
        let guard = SEARCH_TEST_SERIAL_MUTEX
            .get_or_init(|| tokio::sync::Mutex::new(()))
            .lock()
            .await;

        SEARCH_ENTRY_TEST_DELAY_MS.store(0, Ordering::Relaxed);
        SEARCH_ENTRY_TEST_SCAN_COUNT.store(0, Ordering::Relaxed);

        if let Ok(mut requests) = search_requests().lock() {
            requests.clear();
        }
        if let Ok(mut cache) = search_name_index_cache().lock() {
            cache.clear();
        }
        if let Ok(mut cache) = search_content_index_cache().lock() {
            cache.clear();
        }

        guard
    }

    #[test]
    fn parse_fs_cache_policy_u64_defaults_for_missing_blank_and_invalid_values() {
        assert_eq!(parse_fs_cache_policy_u64(None, 42), 42);
        assert_eq!(parse_fs_cache_policy_u64(Some(""), 42), 42);
        assert_eq!(parse_fs_cache_policy_u64(Some("  "), 42), 42);
        assert_eq!(parse_fs_cache_policy_u64(Some("invalid"), 42), 42);
    }

    #[test]
    fn resolve_fs_cache_policy_uses_defaults_without_overrides() {
        let policy = resolve_fs_cache_policy_from_lookup(|_| None);
        let snapshot = policy.snapshot();

        assert_eq!(
            snapshot.dir_list_cache_ttl_ms,
            DIR_LIST_CACHE_TTL_MS_DEFAULT
        );
        assert_eq!(
            snapshot.search_name_index_cache_ttl_ms,
            SEARCH_NAME_INDEX_CACHE_TTL_MS_DEFAULT
        );
        assert_eq!(
            snapshot.search_content_index_cache_ttl_ms,
            SEARCH_CONTENT_INDEX_CACHE_TTL_MS_DEFAULT
        );
        assert_eq!(
            snapshot.entry_size_cache_ttl_ms,
            ENTRY_SIZE_CACHE_TTL_MS_DEFAULT
        );
        assert_eq!(
            snapshot.entry_size_scan_budget_ms,
            ENTRY_SIZE_SCAN_BUDGET_MS_DEFAULT
        );
        assert_eq!(
            snapshot.search_content_index_total_bytes_budget,
            SEARCH_CONTENT_INDEX_TOTAL_BYTES_BUDGET_DEFAULT
        );
        assert_eq!(
            snapshot.max_search_content_file_bytes,
            MAX_SEARCH_CONTENT_BYTES_DEFAULT
        );
        assert_eq!(
            snapshot.search_max_indexed_entries,
            SEARCH_MAX_INDEXED_ENTRIES_DEFAULT
        );
    }

    #[test]
    fn resolve_fs_cache_policy_applies_valid_overrides() {
        let overrides = HashMap::from([
            (DIR_LIST_CACHE_TTL_ENV, "1250".to_string()),
            (SEARCH_NAME_INDEX_CACHE_TTL_ENV, "2200".to_string()),
            (SEARCH_CONTENT_INDEX_CACHE_TTL_ENV, "3200".to_string()),
            (ENTRY_SIZE_CACHE_TTL_ENV, "15000".to_string()),
            (ENTRY_SIZE_SCAN_BUDGET_ENV, "1200".to_string()),
            (
                SEARCH_CONTENT_INDEX_TOTAL_BYTES_BUDGET_ENV,
                "1048576".to_string(),
            ),
            (MAX_SEARCH_CONTENT_BYTES_ENV, "2048".to_string()),
            (SEARCH_MAX_INDEXED_ENTRIES_ENV, "8192".to_string()),
        ]);
        let policy = resolve_fs_cache_policy_from_lookup(|key| overrides.get(key).cloned());
        let snapshot = policy.snapshot();

        assert_eq!(snapshot.dir_list_cache_ttl_ms, 1250);
        assert_eq!(snapshot.search_name_index_cache_ttl_ms, 2200);
        assert_eq!(snapshot.search_content_index_cache_ttl_ms, 3200);
        assert_eq!(snapshot.entry_size_cache_ttl_ms, 15000);
        assert_eq!(snapshot.entry_size_scan_budget_ms, 1200);
        assert_eq!(snapshot.search_content_index_total_bytes_budget, 1_048_576);
        assert_eq!(snapshot.max_search_content_file_bytes, 2048);
        assert_eq!(snapshot.search_max_indexed_entries, 8192);
    }

    #[tokio::test]
    async fn list_dir_returns_files_and_dirs() {
        let dir = tmp_dir();
        let dir_path = dir.path();

        // Create a sub-directory and two files
        fs::create_dir(dir_path.join("subdir")).unwrap();
        fs::write(dir_path.join("hello.txt"), b"hello").unwrap();
        fs::write(dir_path.join("data.json"), b"{}").unwrap();

        let result = fs_list_dir(dir_path.to_string_lossy().into(), false).await;
        let entries = result.expect("fs_list_dir failed");

        assert!(
            entries.len() >= 3,
            "expected at least 3 entries, got {}",
            entries.len()
        );

        let subdirs: Vec<_> = entries.iter().filter(|e| e.is_dir).collect();
        let files: Vec<_> = entries.iter().filter(|e| !e.is_dir).collect();
        assert!(!subdirs.is_empty(), "no directories found");
        assert!(files.len() >= 2, "expected at least 2 files");
    }

    #[tokio::test]
    async fn list_dir_dirs_come_first() {
        let dir = tmp_dir();
        fs::create_dir(dir.path().join("zzz_dir")).unwrap();
        fs::write(dir.path().join("aaa.txt"), b"a").unwrap();

        let entries = fs_list_dir(dir.path().to_string_lossy().into(), false)
            .await
            .expect("fs_list_dir failed");

        // The directory "zzz_dir" should appear BEFORE "aaa.txt" despite 'z' > 'a'
        let first = &entries[0];
        assert!(
            first.is_dir,
            "first entry should be a directory (dirs-first sort)"
        );
    }

    #[tokio::test]
    async fn list_dir_preserves_unicode_case_insensitive_sorting() {
        let dir = tmp_dir();
        fs::write(dir.path().join("jar.txt"), b"j").unwrap();
        fs::write(dir.path().join("İstanbul.txt"), b"i").unwrap();

        let entries = fs_list_dir(dir.path().to_string_lossy().into(), false)
            .await
            .expect("fs_list_dir failed");

        let file_names: Vec<_> = entries
            .iter()
            .filter(|entry| !entry.is_dir)
            .map(|entry| entry.name.as_str())
            .collect();
        assert_eq!(
            file_names,
            vec!["İstanbul.txt", "jar.txt"],
            "fs_list_dir should keep Unicode-aware case-insensitive ordering"
        );
    }

    #[tokio::test]
    async fn list_dir_hides_hidden_files_by_default() {
        let dir = tmp_dir();
        fs::write(dir.path().join(".hidden"), b"secret").unwrap();
        fs::write(dir.path().join("visible.txt"), b"public").unwrap();

        let entries_no_hidden = fs_list_dir(dir.path().to_string_lossy().into(), false)
            .await
            .expect("fs_list_dir failed");

        let has_hidden = entries_no_hidden.iter().any(|e| e.name.starts_with('.'));
        assert!(
            !has_hidden,
            "hidden file should not appear when show_hidden=false"
        );
    }

    #[tokio::test]
    async fn list_dir_shows_hidden_files_when_requested() {
        let dir = tmp_dir();
        fs::write(dir.path().join(".hidden"), b"secret").unwrap();
        fs::write(dir.path().join("visible.txt"), b"public").unwrap();

        let entries_with_hidden = fs_list_dir(dir.path().to_string_lossy().into(), true)
            .await
            .expect("fs_list_dir failed");

        let has_hidden = entries_with_hidden.iter().any(|e| e.name.starts_with('.'));
        assert!(
            has_hidden,
            "hidden file should appear when show_hidden=true"
        );
    }

    #[tokio::test]
    async fn list_dir_does_not_reuse_filtered_cache_for_show_hidden_requests() {
        let dir = tmp_dir();
        fs::write(dir.path().join(".hidden"), b"secret").unwrap();
        fs::write(dir.path().join("visible.txt"), b"public").unwrap();

        let entries_without_hidden = fs_list_dir(dir.path().to_string_lossy().into(), false)
            .await
            .expect("initial filtered fs_list_dir failed");
        assert!(
            entries_without_hidden
                .iter()
                .all(|entry| !entry.name.starts_with('.')),
            "filtered listing should not contain hidden entries"
        );

        let entries_with_hidden = fs_list_dir(dir.path().to_string_lossy().into(), true)
            .await
            .expect("show_hidden fs_list_dir failed");
        assert!(
            entries_with_hidden
                .iter()
                .any(|entry| entry.name.starts_with('.')),
            "show_hidden listing should bypass the filtered cache variant"
        );
    }

    #[tokio::test]
    async fn list_dir_uncached_refreshes_entry_metadata_after_external_write() {
        let dir = tmp_dir();
        let dir_path = dir.path().to_string_lossy().into_owned();
        let file_path = dir.path().join("alpha.txt");
        fs::write(&file_path, b"alpha").unwrap();

        let cached_entries = fs_list_dir(dir_path.clone(), false)
            .await
            .expect("initial fs_list_dir failed");
        let cached_size = cached_entries
            .iter()
            .find(|entry| entry.name == "alpha.txt")
            .expect("cached file entry missing")
            .size;
        assert_eq!(cached_size, 5);

        fs::write(&file_path, b"alpha-with-more-bytes").unwrap();

        let refreshed_entries = fs_list_dir_uncached(dir_path, false)
            .await
            .expect("uncached fs_list_dir failed");
        let refreshed_size = refreshed_entries
            .iter()
            .find(|entry| entry.name == "alpha.txt")
            .expect("refreshed file entry missing")
            .size;
        assert_eq!(
            refreshed_size, 21,
            "uncached listing should re-read file metadata after external writes"
        );
    }

    #[tokio::test]
    async fn list_dir_marks_symlinked_directories() {
        #[cfg(not(any(target_family = "windows", target_family = "unix")))]
        {
            return;
        }

        let dir = tmp_dir();
        let real_dir = dir.path().join("real");
        let linked_dir = dir.path().join("linked");
        fs::create_dir_all(&real_dir).unwrap();
        fs::write(real_dir.join("payload.txt"), b"hello").unwrap();

        #[cfg(target_family = "unix")]
        std::os::unix::fs::symlink(&real_dir, &linked_dir).unwrap();

        #[cfg(target_family = "windows")]
        std::os::windows::fs::symlink_dir(&real_dir, &linked_dir).unwrap();

        let entries = fs_list_dir(dir.path().to_string_lossy().into(), false)
            .await
            .expect("fs_list_dir failed");

        let linked = entries
            .iter()
            .find(|entry| entry.name == "linked")
            .expect("symlinked directory missing from listing");

        assert!(linked.is_dir, "symlinked directory should stay navigable");
        assert!(linked.is_symlink, "symlinked directory should be marked");
        assert_eq!(
            linked.size, 0,
            "directory listings should not hydrate sizes"
        );
    }

    #[tokio::test]
    async fn list_dir_fails_for_nonexistent_path() {
        let result = fs_list_dir("C:\\nonexistent\\path\\xyz_abc".to_string(), false).await;
        assert!(result.is_err(), "expected Err for nonexistent path");
        let msg = result.unwrap_err();
        assert!(
            msg.contains("not exist") || msg.contains("exist"),
            "error message: {}",
            msg
        );
    }

    #[tokio::test]
    async fn list_dir_fails_for_file_path() {
        let dir = tmp_dir();
        let file_path = dir.path().join("some.txt");
        fs::write(&file_path, b"data").unwrap();

        let result = fs_list_dir(file_path.to_string_lossy().into(), false).await;
        assert!(
            result.is_err(),
            "expected Err when path is a file, not a dir"
        );
    }

    #[tokio::test]
    async fn write_file_invalidates_parent_directory_listing_cache() {
        let dir = tmp_dir();
        let dir_path = dir.path().to_string_lossy().into_owned();
        let alpha_path = dir.path().join("alpha.txt");
        let beta_path = dir.path().join("beta.txt");
        fs::write(&alpha_path, b"alpha").unwrap();

        let initial_entries = fs_list_dir(dir_path.clone(), false)
            .await
            .expect("initial fs_list_dir failed");
        assert_eq!(
            initial_entries
                .iter()
                .map(|entry| entry.name.as_str())
                .collect::<Vec<_>>(),
            vec!["alpha.txt"]
        );

        fs_write_file(
            beta_path.to_string_lossy().into_owned(),
            FsWriteFileContent::Text("beta".to_string()),
        )
        .await
        .expect("fs_write_file failed");

        let refreshed_entries = fs_list_dir(dir_path, false)
            .await
            .expect("refreshed fs_list_dir failed");
        assert_eq!(
            refreshed_entries
                .iter()
                .map(|entry| entry.name.as_str())
                .collect::<Vec<_>>(),
            vec!["alpha.txt", "beta.txt"]
        );
    }

    #[tokio::test]
    async fn rename_invalidates_parent_directory_listing_cache() {
        let dir = tmp_dir();
        let dir_path = dir.path().to_string_lossy().into_owned();
        let old_path = dir.path().join("alpha.txt");
        let new_path = dir.path().join("beta.txt");
        fs::write(&old_path, b"alpha").unwrap();

        let initial_entries = fs_list_dir(dir_path.clone(), false)
            .await
            .expect("initial fs_list_dir failed");
        assert_eq!(
            initial_entries
                .iter()
                .map(|entry| entry.name.as_str())
                .collect::<Vec<_>>(),
            vec!["alpha.txt"]
        );

        fs_rename(
            old_path.to_string_lossy().into_owned(),
            new_path.to_string_lossy().into_owned(),
        )
        .await
        .expect("fs_rename failed");

        let refreshed_entries = fs_list_dir(dir_path, false)
            .await
            .expect("refreshed fs_list_dir failed");
        assert_eq!(
            refreshed_entries
                .iter()
                .map(|entry| entry.name.as_str())
                .collect::<Vec<_>>(),
            vec!["beta.txt"]
        );
    }

    #[test]
    fn dir_list_cache_prunes_expired_variants() {
        let dir_list_ttl = Duration::from_millis(DIR_LIST_CACHE_TTL_MS_DEFAULT);
        let expired_at = Instant::now()
            .checked_sub(dir_list_ttl + Duration::from_millis(25))
            .expect("failed to construct expired instant");
        let stale_key = format!("prune-test-{}", current_time_millis());

        {
            let mut cache = dir_list_cache().lock().expect("dir list cache poisoned");
            cache.insert(
                stale_key.clone(),
                CachedDirListingVariants {
                    visible_only: Some(CachedDirListing {
                        entries: Vec::new(),
                        directory_modified_ms: None,
                        cached_at: expired_at,
                    }),
                    include_hidden: None,
                },
            );
            prune_expired_dir_list_cache(&mut cache);
        }

        let cache = dir_list_cache().lock().expect("dir list cache poisoned");
        assert!(
            !cache.contains_key(&stale_key),
            "expired directory listings should be pruned instead of growing unbounded"
        );
    }

    #[tokio::test]
    async fn external_path_invalidation_refreshes_parent_directory_listing_cache() {
        let dir = tmp_dir();
        let dir_path = dir.path().to_string_lossy().into_owned();
        let alpha_path = dir.path().join("alpha.txt");
        let beta_path = dir.path().join("beta.txt");
        fs::write(&alpha_path, b"alpha").unwrap();

        let initial_entries = fs_list_dir(dir_path.clone(), false)
            .await
            .expect("initial fs_list_dir failed");
        assert_eq!(
            initial_entries
                .iter()
                .map(|entry| entry.name.as_str())
                .collect::<Vec<_>>(),
            vec!["alpha.txt"]
        );

        fs::write(&beta_path, b"beta").unwrap();
        invalidate_all_fs_caches_for_path(&beta_path);

        let refreshed_entries = fs_list_dir(dir_path, false)
            .await
            .expect("refreshed fs_list_dir failed");
        assert_eq!(
            refreshed_entries
                .iter()
                .map(|entry| entry.name.as_str())
                .collect::<Vec<_>>(),
            vec!["alpha.txt", "beta.txt"]
        );
    }

    #[tokio::test]
    async fn search_entries_skip_symlinked_directories() {
        let _serial_guard = search_test_serial_lock().await;
        #[cfg(not(any(target_family = "windows", target_family = "unix")))]
        {
            return;
        }

        let dir = tmp_dir();
        let real_dir = dir.path().join("real");
        let linked_dir = dir.path().join("linked");
        fs::create_dir_all(&real_dir).unwrap();
        fs::write(real_dir.join("needle.txt"), b"needle").unwrap();

        #[cfg(target_family = "unix")]
        std::os::unix::fs::symlink(&real_dir, &linked_dir).unwrap();

        #[cfg(target_family = "windows")]
        std::os::windows::fs::symlink_dir(&real_dir, &linked_dir).unwrap();

        let results = fs_search_entries(
            dir.path().to_string_lossy().into(),
            "needle".to_string(),
            false,
            false,
            Some(10),
            None,
            None,
        )
        .await
        .expect("fs_search_entries failed");

        assert_eq!(
            results.len(),
            1,
            "symlinked directories should not duplicate recursive search results"
        );
        assert_eq!(
            results[0].relative_path,
            "real\\needle.txt".replace('\\', std::path::MAIN_SEPARATOR_STR)
        );
    }

    #[tokio::test]
    async fn measure_entry_sizes_reports_files_and_nested_directory_totals() {
        let dir = tmp_dir();
        let nested_dir = dir.path().join("assets");
        let deep_dir = nested_dir.join("nested");
        let loose_file = dir.path().join("note.txt");

        fs::create_dir_all(&deep_dir).unwrap();
        fs::write(nested_dir.join("a.bin"), vec![0_u8; 128]).unwrap();
        fs::write(deep_dir.join("b.bin"), vec![0_u8; 256]).unwrap();
        fs::write(&loose_file, vec![0_u8; 64]).unwrap();

        let results = fs_measure_entry_sizes(
            vec![
                nested_dir.to_string_lossy().into_owned(),
                loose_file.to_string_lossy().into_owned(),
            ],
            Some(true),
        )
        .await
        .expect("fs_measure_entry_sizes failed");

        assert_eq!(results.len(), 2);

        let dir_result = results
            .iter()
            .find(|entry| entry.path == nested_dir.to_string_lossy())
            .expect("directory result missing");
        assert!(
            dir_result.is_dir,
            "directory should be marked as a directory"
        );
        assert!(
            dir_result.is_complete,
            "small directory scan should complete"
        );
        assert_eq!(
            dir_result.bytes, 384,
            "directory size should include nested files"
        );

        let file_result = results
            .iter()
            .find(|entry| entry.path == loose_file.to_string_lossy())
            .expect("file result missing");
        assert!(
            !file_result.is_dir,
            "file should not be marked as a directory"
        );
        assert!(file_result.is_complete, "files should resolve immediately");
        assert_eq!(file_result.bytes, 64);
    }

    #[tokio::test]
    async fn measure_entry_sizes_skips_symlink_targets() {
        #[cfg(not(any(target_family = "windows", target_family = "unix")))]
        {
            return;
        }

        let dir = tmp_dir();
        let real_dir = dir.path().join("real");
        let linked_dir = dir.path().join("linked");
        fs::create_dir_all(&real_dir).unwrap();
        fs::write(real_dir.join("payload.bin"), vec![0_u8; 512]).unwrap();

        #[cfg(target_family = "unix")]
        std::os::unix::fs::symlink(&real_dir, &linked_dir).unwrap();

        #[cfg(target_family = "windows")]
        std::os::windows::fs::symlink_dir(&real_dir, &linked_dir).unwrap();

        let results =
            fs_measure_entry_sizes(vec![linked_dir.to_string_lossy().into_owned()], Some(true))
                .await
                .expect("fs_measure_entry_sizes failed");

        assert_eq!(results.len(), 1);
        assert_eq!(
            results[0].bytes, 0,
            "symlinked directories should not be traversed"
        );
        assert!(
            results[0].is_complete,
            "symlink handling should return immediately"
        );
    }

    #[tokio::test]
    async fn calculate_checksums_returns_md5_and_sha256() {
        let dir = tmp_dir();
        let file_path = dir.path().join("payload.txt");
        let content = b"hello world";
        fs::write(&file_path, content).unwrap();

        let results = fs_calculate_checksums(vec![file_path.to_string_lossy().into_owned()])
            .await
            .expect("fs_calculate_checksums failed");

        assert_eq!(results.len(), 1);
        let entry = &results[0];
        assert_eq!(entry.path, file_path.to_string_lossy());
        assert_eq!(entry.bytes, content.len() as u64);
        let expected_md5 = format!("{:x}", md5::compute(content));
        assert_eq!(entry.md5.as_deref(), Some(expected_md5.as_str()));
        let expected_sha256 = format!("{:x}", Sha256::digest(content));
        assert_eq!(entry.sha256.as_deref(), Some(expected_sha256.as_str()));
        assert!(entry.error.is_none());
    }

    #[tokio::test]
    async fn recursive_size_task_returns_directory_totals() {
        let dir = tmp_dir();
        let root = dir.path().join("assets");
        let nested = root.join("nested");
        fs::create_dir_all(&nested).unwrap();
        fs::write(root.join("a.bin"), vec![0_u8; 32]).unwrap();
        fs::write(nested.join("b.bin"), vec![0_u8; 64]).unwrap();

        let results = fs_calculate_recursive_sizes(vec![root.to_string_lossy().into_owned()], Some(true))
            .await
            .expect("fs_calculate_recursive_sizes failed");

        assert_eq!(results.len(), 1);
        let entry = &results[0];
        assert!(entry.is_dir);
        assert!(entry.is_complete);
        assert_eq!(entry.bytes, 96);
    }

    #[tokio::test]
    async fn fuzzy_jump_filter_prefers_filename_matches_but_keeps_path_matches() {
        let results = fs_fuzzy_filter_entries(FsJumpFilterRequest {
            query: "proj".to_string(),
            entries: vec![
                FsJumpFilterEntry {
                    path: "/tmp/project/readme.txt".to_string(),
                    name: "readme.txt".to_string(),
                    is_dir: false,
                    sort_order: 1,
                },
                FsJumpFilterEntry {
                    path: "/tmp/elsewhere/project.txt".to_string(),
                    name: "project.txt".to_string(),
                    is_dir: false,
                    sort_order: 0,
                },
            ],
            limit: Some(10),
        })
        .await
        .expect("fs_fuzzy_filter_entries failed");

        assert_eq!(results.len(), 2);
        assert_eq!(results[0].name, "project.txt");
        assert_eq!(results[1].name, "readme.txt");
        assert!(!results[0].matched_indices.is_empty());
    }

    #[test]
    fn measure_path_size_can_return_partial_for_large_scans() {
        let dir = tmp_dir();
        let root = dir.path().join("huge");
        fs::create_dir_all(&root).unwrap();

        for index in 0..15_000 {
            fs::write(root.join(format!("chunk-{index}.bin")), [0_u8; 32]).unwrap();
        }

        let measured = measure_path_size(&root);
        assert!(
            measured.is_dir,
            "directory should still be identified as a directory"
        );
        if !measured.is_complete {
            return;
        }

        // Fast machines may still finish inside the budget; in that case the full scan is still valid.
        assert!(measured.is_complete);
    }

    #[tokio::test]
    async fn read_text_file_reads_content() {
        let dir = tmp_dir();
        let file_path = dir.path().join("data.toml");
        let content = "[package]\nname = \"test\"";
        fs::write(&file_path, content).unwrap();

        let result = fs_read_text_file(file_path.to_string_lossy().into()).await;
        assert!(result.is_ok(), "expected Ok, got {:?}", result);
        assert_eq!(result.unwrap(), content);
    }

    #[tokio::test]
    async fn read_text_file_rejects_large_file() {
        let dir = tmp_dir();
        let path = dir.path().join("big.bin");
        // Create a file just over 10 MB
        let big_data = vec![0u8; 10 * 1024 * 1024 + 1];
        fs::write(&path, &big_data).unwrap();

        let result = fs_read_text_file(path.to_string_lossy().into()).await;
        assert!(result.is_err(), "expected Err for file > 10 MB");
        assert!(
            result.unwrap_err().contains("too large"),
            "wrong error message"
        );
    }

    #[tokio::test]
    async fn search_entries_finds_nested_content_matches() {
        let _serial_guard = search_test_serial_lock().await;
        let dir = tmp_dir();
        let nested = dir.path().join("src").join("deep");
        fs::create_dir_all(&nested).unwrap();
        let file_path = nested.join("notes.kain");
        fs::write(&file_path, "alpha\nbeta search term gamma\nomega").unwrap();

        let result = fs_search_entries(
            dir.path().to_string_lossy().into(),
            "search term".to_string(),
            true,
            true,
            Some(50),
            None,
            None,
        )
        .await;

        assert!(result.is_ok(), "search_entries failed: {:?}", result);
        let results = result.unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].path, file_path.to_string_lossy());
        assert_eq!(results[0].line_number, Some(2));
        assert!(results[0].snippet.contains("search term"));
    }

    #[tokio::test]
    async fn search_entries_can_skip_content_matches() {
        let _serial_guard = search_test_serial_lock().await;
        let dir = tmp_dir();
        let named = dir.path().join("search-term-note.txt");
        let content_only = dir.path().join("other-note.txt");
        fs::write(&named, "no match in body").unwrap();
        fs::write(&content_only, "alpha\nsearch-term beta\nomega").unwrap();

        let result = fs_search_entries(
            dir.path().to_string_lossy().into(),
            "search-term".to_string(),
            true,
            false,
            Some(50),
            None,
            None,
        )
        .await;

        assert!(result.is_ok(), "search_entries failed: {:?}", result);
        let results = result.unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].path, named.to_string_lossy());
        assert!(results[0].snippet.is_empty());
        assert_eq!(results[0].line_number, None);
    }

    #[tokio::test]
    async fn search_entries_names_only_reuse_cached_index() {
        let _serial_guard = search_test_serial_lock().await;
        let _delay_guard = set_search_scan_delay(1);
        let dir = tmp_dir();

        for index in 0..64 {
            fs::write(
                dir.path().join(format!("alpha-note-{index:03}.txt")),
                format!("payload {index}"),
            )
            .unwrap();
        }

        let root = dir.path().to_string_lossy().into_owned();
        let first_results = fs_search_entries(
            root.clone(),
            "alpha-note".to_string(),
            true,
            false,
            Some(100),
            None,
            None,
        )
        .await
        .expect("first fs_search_entries failed");

        assert_eq!(first_results.len(), 64);
        assert!(
            search_scan_count() >= 64,
            "initial names-only search should walk the filesystem before the cache exists"
        );

        reset_search_scan_count();

        let cached_results = fs_search_entries(
            root.clone(),
            "alpha-note-01".to_string(),
            true,
            false,
            Some(100),
            None,
            None,
        )
        .await
        .expect("cached fs_search_entries failed");

        assert!(
            !cached_results.is_empty(),
            "cached names-only query should still return filtered matches"
        );
        assert_eq!(
            search_scan_count(),
            0,
            "warm names-only searches should reuse the cached recursive name index"
        );
    }

    #[tokio::test]
    async fn search_entries_with_diagnostics_reports_name_index_cache_hits() {
        let _serial_guard = search_test_serial_lock().await;
        let dir = tmp_dir();

        for index in 0..12 {
            fs::write(
                dir.path().join(format!("alpha-note-{index:03}.txt")),
                format!("payload {index}"),
            )
            .unwrap();
        }

        let root = dir.path().to_string_lossy().into_owned();
        fs_search_entries(
            root.clone(),
            "alpha-note".to_string(),
            true,
            false,
            Some(50),
            None,
            None,
        )
        .await
        .expect("initial fs_search_entries failed");

        let response = fs_search_entries_with_diagnostics(
            root,
            "alpha-note-00".to_string(),
            true,
            false,
            Some(50),
            None,
            None,
        )
        .await
        .expect("fs_search_entries_with_diagnostics failed");

        assert_eq!(
            response.diagnostics.execution_strategy,
            FileSearchExecutionStrategy::NameIndexCacheHit
        );
        assert_eq!(
            response.diagnostics.content_cache_status,
            FileSearchContentCacheStatus::NotRequested
        );
        assert_eq!(response.diagnostics.scanned_entry_count, 0);
        assert_eq!(response.diagnostics.indexed_entry_count, 12);
        assert_eq!(response.results.len(), 10);
    }

    #[tokio::test]
    async fn search_entries_content_reuse_cached_index() {
        let _serial_guard = search_test_serial_lock().await;
        let _delay_guard = set_search_scan_delay(1);
        let dir = tmp_dir();

        for index in 0..40 {
            fs::write(
                dir.path().join(format!("entry-{index:03}.txt")),
                format!("alpha body line\npayload-match-{index:03}\nomega"),
            )
            .unwrap();
        }

        let root_path = dir.path();
        let root = root_path.to_string_lossy().into_owned();
        let root_key = path_cache_key(root_path);
        let first_results = fs_search_entries(
            root.clone(),
            "alpha body line".to_string(),
            true,
            true,
            Some(100),
            None,
            None,
        )
        .await
        .expect("first content fs_search_entries failed");

        assert_eq!(first_results.len(), 40);
        assert!(
            search_scan_count() >= 40,
            "initial content-enabled search should walk the filesystem before the cache exists"
        );
        {
            let cache = search_content_index_cache()
                .lock()
                .expect("search content index cache poisoned");
            assert!(
                cache
                    .get(&root_key)
                    .and_then(|variants| variants.get(true))
                    .is_some(),
                "content-enabled search should populate the cached recursive content index when it fits the byte budget"
            );
        }

        reset_search_scan_count();

        let cached_results = fs_search_entries(
            root,
            "payload-match-017".to_string(),
            true,
            true,
            Some(100),
            None,
            None,
        )
        .await
        .expect("cached content fs_search_entries failed");

        assert_eq!(cached_results.len(), 1);
        assert_eq!(cached_results[0].line_number, Some(2));
        assert_eq!(
            search_scan_count(),
            0,
            "warm content-enabled searches should reuse the cached recursive content index"
        );
    }

    #[tokio::test]
    async fn search_entries_content_over_budget_stays_uncached() {
        let _serial_guard = search_test_serial_lock().await;
        let _delay_guard = set_search_scan_delay(1);
        let dir = tmp_dir();
        let first_file = dir.path().join("bulk-a.txt");
        let second_file = dir.path().join("bulk-b.txt");
        let repeated_a = "alpha payload line\n".repeat(350_000);
        let repeated_b = "target payload line\n".repeat(350_000);
        fs::write(&first_file, repeated_a).unwrap();
        fs::write(&second_file, repeated_b).unwrap();

        let root_path = dir.path();
        let root = root_path.to_string_lossy().into_owned();
        let root_key = path_cache_key(root_path);

        let first_results = fs_search_entries(
            root.clone(),
            "target payload line".to_string(),
            true,
            true,
            Some(20),
            None,
            None,
        )
        .await
        .expect("first over-budget content fs_search_entries failed");

        assert_eq!(first_results.len(), 1);
        assert_eq!(first_results[0].path, second_file.to_string_lossy());
        assert!(
            search_scan_count() >= 2,
            "initial over-budget content search should still scan the live filesystem"
        );
        {
            let cache = search_content_index_cache()
                .lock()
                .expect("search content index cache poisoned");
            assert!(
                cache
                    .get(&root_key)
                    .and_then(|variants| variants.get(true))
                    .is_none(),
                "over-budget content searches must not persist a partial recursive content index"
            );
        }

        reset_search_scan_count();

        let second_results = fs_search_entries(
            root,
            "target payload line".to_string(),
            true,
            true,
            Some(20),
            None,
            None,
        )
        .await
        .expect("second over-budget content fs_search_entries failed");

        assert_eq!(second_results.len(), 1);
        assert_eq!(second_results[0].path, second_file.to_string_lossy());
        assert!(
            search_scan_count() >= 2,
            "repeated over-budget content searches should stay on the cold scan path"
        );
        {
            let cache = search_content_index_cache()
                .lock()
                .expect("search content index cache poisoned");
            assert!(
                cache
                    .get(&root_key)
                    .and_then(|variants| variants.get(true))
                    .is_none(),
                "over-budget content searches must remain uncached across repeated queries"
            );
        }
    }

    #[tokio::test]
    async fn search_entries_with_diagnostics_reports_over_budget_content_fallback() {
        let _serial_guard = search_test_serial_lock().await;
        let dir = tmp_dir();
        let first_file = dir.path().join("bulk-a.txt");
        let second_file = dir.path().join("bulk-b.txt");
        let repeated_a = "alpha payload line\n".repeat(350_000);
        let repeated_b = "target payload line\n".repeat(350_000);
        fs::write(&first_file, repeated_a).unwrap();
        fs::write(&second_file, repeated_b).unwrap();

        let response = fs_search_entries_with_diagnostics(
            dir.path().to_string_lossy().into_owned(),
            "target payload line".to_string(),
            true,
            true,
            Some(20),
            None,
            None,
        )
        .await
        .expect("fs_search_entries_with_diagnostics failed");

        assert_eq!(
            response.diagnostics.execution_strategy,
            FileSearchExecutionStrategy::LiveScan
        );
        assert_eq!(
            response.diagnostics.content_cache_status,
            FileSearchContentCacheStatus::OverBudgetFallback
        );
        assert_eq!(response.diagnostics.content_cache_stored_file_count, 0);
        assert_eq!(response.diagnostics.content_cache_stored_byte_count, 0);
        assert!(
            response.diagnostics.scanned_entry_count >= 2,
            "over-budget fallback should still report live scanned entries"
        );
        assert_eq!(response.results.len(), 1);
        assert_eq!(response.results[0].path, second_file.to_string_lossy());
    }

    #[tokio::test]
    async fn external_path_invalidation_clears_recursive_search_caches() {
        let _serial_guard = search_test_serial_lock().await;
        let dir = tmp_dir();
        let original = dir.path().join("alpha-note.txt");
        let nested_dir = dir.path().join("nested");
        let nested_match = nested_dir.join("beta-note.txt");
        fs::write(&original, "alpha body").unwrap();
        fs::create_dir_all(&nested_dir).unwrap();

        let root_path = dir.path();
        let root = root_path.to_string_lossy().into_owned();
        let root_key = path_cache_key(root_path);

        let initial_name_results = fs_search_entries(
            root.clone(),
            "alpha-note".to_string(),
            true,
            false,
            Some(50),
            None,
            None,
        )
        .await
        .expect("initial names-only fs_search_entries failed");
        assert_eq!(initial_name_results.len(), 1);

        let initial_content_results = fs_search_entries(
            root.clone(),
            "alpha body".to_string(),
            true,
            true,
            Some(50),
            None,
            None,
        )
        .await
        .expect("initial content fs_search_entries failed");
        assert_eq!(initial_content_results.len(), 1);

        {
            let name_cache = search_name_index_cache()
                .lock()
                .expect("search name index cache poisoned");
            assert!(
                name_cache
                    .get(&root_key)
                    .and_then(|variants| variants.get(true))
                    .is_some(),
                "initial names-only search should populate the cached recursive name index"
            );
        }
        {
            let content_cache = search_content_index_cache()
                .lock()
                .expect("search content index cache poisoned");
            assert!(
                content_cache
                    .get(&root_key)
                    .and_then(|variants| variants.get(true))
                    .is_some(),
                "initial content-enabled search should populate the cached recursive content index"
            );
        }

        fs::write(&nested_match, "beta body").unwrap();
        invalidate_all_fs_caches_for_path(&nested_match);

        {
            let name_cache = search_name_index_cache()
                .lock()
                .expect("search name index cache poisoned");
            assert!(
                name_cache.get(&root_key).is_none(),
                "external invalidation should clear ancestor recursive name-search caches"
            );
        }
        {
            let content_cache = search_content_index_cache()
                .lock()
                .expect("search content index cache poisoned");
            assert!(
                content_cache.get(&root_key).is_none(),
                "external invalidation should clear ancestor recursive content-search caches"
            );
        }

        let refreshed_name_results = fs_search_entries(
            root.clone(),
            "beta-note".to_string(),
            true,
            false,
            Some(50),
            None,
            None,
        )
        .await
        .expect("refreshed names-only fs_search_entries failed");
        assert_eq!(refreshed_name_results.len(), 1);
        assert_eq!(
            refreshed_name_results[0].path,
            nested_match.to_string_lossy()
        );

        let refreshed_content_results = fs_search_entries(
            root,
            "beta body".to_string(),
            true,
            true,
            Some(50),
            None,
            None,
        )
        .await
        .expect("refreshed content fs_search_entries failed");
        assert_eq!(refreshed_content_results.len(), 1);
        assert_eq!(
            refreshed_content_results[0].path,
            nested_match.to_string_lossy()
        );
    }

    #[tokio::test]
    async fn search_entries_content_index_is_invalidated_by_fs_write_file() {
        let _serial_guard = search_test_serial_lock().await;
        let dir = tmp_dir();
        let original = dir.path().join("notes.txt");
        fs::write(&original, "alpha body").unwrap();

        let root_path = dir.path();
        let root = root_path.to_string_lossy().into_owned();
        let root_key = path_cache_key(root_path);

        let initial_results = fs_search_entries(
            root.clone(),
            "alpha body".to_string(),
            true,
            true,
            Some(50),
            None,
            None,
        )
        .await
        .expect("initial content fs_search_entries failed");

        assert_eq!(initial_results.len(), 1);
        {
            let cache = search_content_index_cache()
                .lock()
                .expect("search content index cache poisoned");
            assert!(
                cache
                    .get(&root_key)
                    .and_then(|variants| variants.get(true))
                    .is_some(),
                "initial content-enabled search should populate the cached recursive content index"
            );
        }

        let created_path = dir.path().join("nested").join("beta.txt");
        fs_write_file(
            created_path.to_string_lossy().into_owned(),
            FsWriteFileContent::Text("beta body".to_string()),
        )
        .await
        .expect("fs_write_file failed");

        {
            let cache = search_content_index_cache()
                .lock()
                .expect("search content index cache poisoned");
            assert!(
                cache.get(&root_key).is_none(),
                "fs_write_file should invalidate ancestor recursive content-search caches"
            );
        }

        let refreshed_results = fs_search_entries(
            root,
            "beta body".to_string(),
            true,
            true,
            Some(50),
            None,
            None,
        )
        .await
        .expect("refreshed content fs_search_entries failed");

        assert_eq!(refreshed_results.len(), 1);
        assert_eq!(refreshed_results[0].path, created_path.to_string_lossy());
    }

    #[tokio::test]
    async fn search_entries_content_index_is_invalidated_by_fs_rename() {
        let _serial_guard = search_test_serial_lock().await;
        let dir = tmp_dir();
        let old_path = dir.path().join("notes.txt");
        let new_path = dir.path().join("renamed-notes.txt");
        fs::write(&old_path, "alpha body").unwrap();

        let root_path = dir.path();
        let root = root_path.to_string_lossy().into_owned();
        let root_key = path_cache_key(root_path);

        let initial_results = fs_search_entries(
            root.clone(),
            "alpha body".to_string(),
            true,
            true,
            Some(50),
            None,
            None,
        )
        .await
        .expect("initial content fs_search_entries failed");

        assert_eq!(initial_results.len(), 1);
        {
            let cache = search_content_index_cache()
                .lock()
                .expect("search content index cache poisoned");
            assert!(
                cache
                    .get(&root_key)
                    .and_then(|variants| variants.get(true))
                    .is_some(),
                "initial content-enabled search should populate the cached recursive content index"
            );
        }

        fs_rename(
            old_path.to_string_lossy().into_owned(),
            new_path.to_string_lossy().into_owned(),
        )
        .await
        .expect("fs_rename failed");

        {
            let cache = search_content_index_cache()
                .lock()
                .expect("search content index cache poisoned");
            assert!(
                cache.get(&root_key).is_none(),
                "fs_rename should invalidate ancestor recursive content-search caches"
            );
        }

        let refreshed_results = fs_search_entries(
            root,
            "alpha body".to_string(),
            true,
            true,
            Some(50),
            None,
            None,
        )
        .await
        .expect("refreshed content fs_search_entries failed");

        assert_eq!(refreshed_results.len(), 1);
        assert_eq!(refreshed_results[0].path, new_path.to_string_lossy());
    }

    #[tokio::test]
    async fn search_entries_content_index_is_invalidated_by_fs_delete() {
        let _serial_guard = search_test_serial_lock().await;
        let dir = tmp_dir();
        let file_path = dir.path().join("notes.txt");
        fs::write(&file_path, "alpha body").unwrap();

        let root_path = dir.path();
        let root = root_path.to_string_lossy().into_owned();
        let root_key = path_cache_key(root_path);

        let initial_results = fs_search_entries(
            root.clone(),
            "alpha body".to_string(),
            true,
            true,
            Some(50),
            None,
            None,
        )
        .await
        .expect("initial content fs_search_entries failed");

        assert_eq!(initial_results.len(), 1);
        {
            let cache = search_content_index_cache()
                .lock()
                .expect("search content index cache poisoned");
            assert!(
                cache
                    .get(&root_key)
                    .and_then(|variants| variants.get(true))
                    .is_some(),
                "initial content-enabled search should populate the cached recursive content index"
            );
        }

        fs_delete(file_path.to_string_lossy().into_owned(), false)
            .await
            .expect("fs_delete failed");

        {
            let cache = search_content_index_cache()
                .lock()
                .expect("search content index cache poisoned");
            assert!(
                cache.get(&root_key).is_none(),
                "fs_delete should invalidate ancestor recursive content-search caches"
            );
        }

        let refreshed_results = fs_search_entries(
            root,
            "alpha body".to_string(),
            true,
            true,
            Some(50),
            None,
            None,
        )
        .await
        .expect("refreshed content fs_search_entries failed");

        assert!(
            refreshed_results.is_empty(),
            "rebuilt content search should drop deleted files"
        );
    }

    #[tokio::test]
    async fn search_entries_name_index_is_invalidated_by_fs_write_file() {
        let _serial_guard = search_test_serial_lock().await;
        let dir = tmp_dir();
        let original = dir.path().join("alpha-note.txt");
        fs::write(&original, "payload").unwrap();

        let root_path = dir.path();
        let root = root_path.to_string_lossy().into_owned();
        let root_key = path_cache_key(root_path);

        let initial_results = fs_search_entries(
            root.clone(),
            "alpha-note".to_string(),
            true,
            false,
            Some(50),
            None,
            None,
        )
        .await
        .expect("initial fs_search_entries failed");

        assert_eq!(initial_results.len(), 1);
        {
            let cache = search_name_index_cache()
                .lock()
                .expect("search name index cache poisoned");
            assert!(
                cache
                    .get(&root_key)
                    .and_then(|variants| variants.get(true))
                    .is_some(),
                "initial names-only search should populate the cached recursive name index"
            );
        }

        fs_write_file(
            dir.path()
                .join("nested")
                .join("alpha-note-2.txt")
                .to_string_lossy()
                .into_owned(),
            FsWriteFileContent::Text("payload".to_string()),
        )
        .await
        .expect("fs_write_file failed");

        {
            let cache = search_name_index_cache()
                .lock()
                .expect("search name index cache poisoned");
            assert!(
                cache.get(&root_key).is_none(),
                "fs_write_file should invalidate ancestor recursive search caches"
            );
        }

        let refreshed_results = fs_search_entries(
            root,
            "alpha-note".to_string(),
            true,
            false,
            Some(50),
            None,
            None,
        )
        .await
        .expect("refreshed fs_search_entries failed");

        assert_eq!(
            refreshed_results.len(),
            2,
            "rebuilt names-only index should include files created after invalidation"
        );
    }

    #[tokio::test]
    async fn search_entries_name_index_is_invalidated_by_fs_rename() {
        let _serial_guard = search_test_serial_lock().await;
        let dir = tmp_dir();
        let old_path = dir.path().join("alpha-note.txt");
        let new_path = dir.path().join("beta-note.txt");
        fs::write(&old_path, "payload").unwrap();

        let root_path = dir.path();
        let root = root_path.to_string_lossy().into_owned();
        let root_key = path_cache_key(root_path);

        let initial_results = fs_search_entries(
            root.clone(),
            "alpha-note".to_string(),
            true,
            false,
            Some(50),
            None,
            None,
        )
        .await
        .expect("initial fs_search_entries failed");

        assert_eq!(initial_results.len(), 1);
        {
            let cache = search_name_index_cache()
                .lock()
                .expect("search name index cache poisoned");
            assert!(
                cache
                    .get(&root_key)
                    .and_then(|variants| variants.get(true))
                    .is_some(),
                "initial names-only search should populate the cached recursive name index"
            );
        }

        fs_rename(
            old_path.to_string_lossy().into_owned(),
            new_path.to_string_lossy().into_owned(),
        )
        .await
        .expect("fs_rename failed");

        {
            let cache = search_name_index_cache()
                .lock()
                .expect("search name index cache poisoned");
            assert!(
                cache.get(&root_key).is_none(),
                "fs_rename should invalidate ancestor recursive search caches"
            );
        }

        let old_name_results = fs_search_entries(
            root.clone(),
            "alpha-note".to_string(),
            true,
            false,
            Some(50),
            None,
            None,
        )
        .await
        .expect("old-name fs_search_entries failed");
        assert!(
            old_name_results.is_empty(),
            "renamed files should disappear from rebuilt names-only search indexes"
        );

        let new_name_results = fs_search_entries(
            root,
            "beta-note".to_string(),
            true,
            false,
            Some(50),
            None,
            None,
        )
        .await
        .expect("new-name fs_search_entries failed");
        assert_eq!(
            new_name_results.len(),
            1,
            "rebuilt names-only index should include renamed files under the new name"
        );
        assert_eq!(new_name_results[0].path, new_path.to_string_lossy());
    }

    #[tokio::test]
    async fn search_entries_name_index_is_invalidated_by_fs_delete() {
        let _serial_guard = search_test_serial_lock().await;
        let dir = tmp_dir();
        let file_path = dir.path().join("alpha-note.txt");
        fs::write(&file_path, "payload").unwrap();

        let root_path = dir.path();
        let root = root_path.to_string_lossy().into_owned();
        let root_key = path_cache_key(root_path);

        let initial_results = fs_search_entries(
            root.clone(),
            "alpha-note".to_string(),
            true,
            false,
            Some(50),
            None,
            None,
        )
        .await
        .expect("initial fs_search_entries failed");

        assert_eq!(initial_results.len(), 1);
        {
            let cache = search_name_index_cache()
                .lock()
                .expect("search name index cache poisoned");
            assert!(
                cache
                    .get(&root_key)
                    .and_then(|variants| variants.get(true))
                    .is_some(),
                "initial names-only search should populate the cached recursive name index"
            );
        }

        fs_delete(file_path.to_string_lossy().into_owned(), false)
            .await
            .expect("fs_delete failed");

        {
            let cache = search_name_index_cache()
                .lock()
                .expect("search name index cache poisoned");
            assert!(
                cache.get(&root_key).is_none(),
                "fs_delete should invalidate ancestor recursive search caches"
            );
        }

        let refreshed_results = fs_search_entries(
            root,
            "alpha-note".to_string(),
            true,
            false,
            Some(50),
            None,
            None,
        )
        .await
        .expect("refreshed fs_search_entries failed");

        assert!(
            refreshed_results.is_empty(),
            "rebuilt names-only index should drop deleted files"
        );
    }

    #[tokio::test]
    async fn search_entries_cancel_stale_requests_within_the_same_scope() {
        let _serial_guard = search_test_serial_lock().await;
        let _delay_guard = set_search_scan_delay(2);
        let dir = tmp_dir();

        for index in 0..120 {
            fs::write(
                dir.path().join(format!("entry-{index:03}.txt")),
                format!("payload {index}"),
            )
            .unwrap();
        }
        let winning_file = dir.path().join("winning-match.txt");
        fs::write(&winning_file, "winner").unwrap();

        let root = dir.path().to_string_lossy().into_owned();
        let scope = format!("search-test-{}", root);

        let stale_search = tokio::spawn(fs_search_entries(
            root.clone(),
            "missing-value".to_string(),
            true,
            false,
            Some(500),
            Some(1),
            Some(scope.clone()),
        ));

        tokio::time::sleep(Duration::from_millis(12)).await;

        let fresh_results = fs_search_entries(
            root.clone(),
            "winning-match".to_string(),
            true,
            false,
            Some(20),
            Some(2),
            Some(scope),
        )
        .await
        .expect("fresh fs_search_entries failed");

        let stale_results = stale_search
            .await
            .expect("stale search task panicked")
            .expect("stale fs_search_entries failed");

        assert!(
            stale_results.is_empty(),
            "superseded search should stop and return no results"
        );
        assert_eq!(fresh_results.len(), 1);
        assert_eq!(fresh_results[0].path, winning_file.to_string_lossy());
    }

    #[tokio::test]
    async fn search_entries_allow_lower_request_id_after_scope_restart() {
        let _serial_guard = search_test_serial_lock().await;
        let dir = tmp_dir();
        let winning_file = dir.path().join("winning-match.txt");
        fs::write(&winning_file, "winner").unwrap();

        let root = dir.path().to_string_lossy().into_owned();
        let scope = format!("search-restart-{}", root);

        fs_cancel_search_entries(root.clone(), Some(8), Some(scope.clone()))
            .expect("failed to register prior search request");

        let fresh_results = fs_search_entries(
            root,
            "winning-match".to_string(),
            true,
            false,
            Some(20),
            Some(1),
            Some(scope),
        )
        .await
        .expect("remounted fs_search_entries failed");

        assert_eq!(
            fresh_results.len(),
            1,
            "lower explicit request ids should still work after scope restart"
        );
        assert_eq!(fresh_results[0].path, winning_file.to_string_lossy());
    }

    #[tokio::test]
    async fn create_dir_creates_nested_directories() {
        let dir = tmp_dir();
        let new_path = dir.path().join("a").join("b").join("c");
        let result = fs_create_dir(new_path.to_string_lossy().into()).await;
        assert!(result.is_ok(), "fs_create_dir failed: {:?}", result);
        assert!(new_path.exists(), "directory was not created");
        assert!(new_path.is_dir(), "path is not a directory");
    }

    #[tokio::test]
    async fn write_file_accepts_binary_payloads() {
        let dir = tmp_dir();
        let new_path = dir.path().join("nested").join("payload.bin");
        let payload = vec![0_u8, 1, 2, 3, 255];
        let result = fs_write_file(
            new_path.to_string_lossy().into(),
            FsWriteFileContent::Bytes(payload.clone()),
        )
        .await;
        assert!(result.is_ok(), "fs_write_file failed: {:?}", result);
        assert_eq!(fs::read(&new_path).unwrap(), payload);
    }

    #[tokio::test]
    async fn rename_renames_file() {
        let dir = tmp_dir();
        let src = dir.path().join("old.txt");
        let dst = dir.path().join("new.txt");
        fs::write(&src, b"content").unwrap();

        let result = fs_rename(src.to_string_lossy().into(), dst.to_string_lossy().into()).await;

        assert!(result.is_ok(), "fs_rename failed: {:?}", result);
        assert!(!src.exists(), "source should no longer exist");
        assert!(dst.exists(), "destination should exist");
        assert_eq!(fs::read(&dst).unwrap(), b"content");
    }

    #[tokio::test]
    async fn move_moves_file() {
        let dir = tmp_dir();
        let src = dir.path().join("move-me.txt");
        let dst = dir.path().join("nested").join("moved.txt");
        fs::write(&src, b"payload").unwrap();

        let result = fs_move(src.to_string_lossy().into(), dst.to_string_lossy().into()).await;

        assert!(result.is_ok(), "fs_move failed: {:?}", result);
        assert!(!src.exists(), "source should no longer exist");
        assert!(dst.exists(), "destination should exist");
        assert_eq!(fs::read(&dst).unwrap(), b"payload");
    }

    #[tokio::test]
    async fn copy_copies_single_file() {
        let dir = tmp_dir();
        let src = dir.path().join("original.txt");
        let dst = dir.path().join("copy.txt");
        fs::write(&src, b"hello world").unwrap();

        let result = fs_copy(src.to_string_lossy().into(), dst.to_string_lossy().into()).await;

        assert!(result.is_ok(), "fs_copy failed: {:?}", result);
        assert!(src.exists(), "source should still exist after copy");
        assert!(dst.exists(), "destination should exist");
        assert_eq!(fs::read(&dst).unwrap(), b"hello world");
    }

    #[tokio::test]
    async fn copy_copies_directory_recursively() {
        let dir = tmp_dir();
        let src_dir = dir.path().join("src_folder");
        let dst_dir = dir.path().join("dst_folder");

        fs::create_dir(&src_dir).unwrap();
        fs::write(src_dir.join("file1.txt"), b"one").unwrap();
        fs::create_dir(src_dir.join("nested")).unwrap();
        fs::write(src_dir.join("nested").join("file2.txt"), b"two").unwrap();

        let result = fs_copy(
            src_dir.to_string_lossy().into(),
            dst_dir.to_string_lossy().into(),
        )
        .await;

        assert!(result.is_ok(), "recursive copy failed: {:?}", result);
        assert!(
            dst_dir.join("file1.txt").exists(),
            "file1.txt missing in dst"
        );
        assert!(
            dst_dir.join("nested").join("file2.txt").exists(),
            "nested/file2.txt missing"
        );
        assert_eq!(
            fs::read(dst_dir.join("nested").join("file2.txt")).unwrap(),
            b"two"
        );
    }

    #[tokio::test]
    async fn transfer_items_copies_with_collision_safe_names() {
        let dir = tmp_dir();
        let target_dir = dir.path().join("target");
        fs::create_dir(&target_dir).unwrap();

        let original = target_dir.join("note.txt");
        fs::write(&original, b"original").unwrap();

        let external = dir.path().join("note.txt");
        fs::write(&external, b"external").unwrap();

        let result = fs_transfer_items(
            target_dir.to_string_lossy().into(),
            vec![external.to_string_lossy().into()],
            FileTransferOperation::Copy,
            None,
        )
        .await
        .expect("fs_transfer_items should copy");

        assert_eq!(result.len(), 1);
        let copied_path = PathBuf::from(&result[0].destination_path);
        assert!(copied_path.exists(), "copied file should exist");
        assert_ne!(
            copied_path, original,
            "copy should not overwrite existing file"
        );
        assert_eq!(fs::read(copied_path).unwrap(), b"external");
        assert_eq!(fs::read(original).unwrap(), b"original");
    }

    #[tokio::test]
    async fn plan_transfer_items_reports_existing_destination_collisions() {
        let dir = tmp_dir();
        let target_dir = dir.path().join("target");
        fs::create_dir(&target_dir).unwrap();

        let existing = target_dir.join("note.txt");
        fs::write(&existing, b"original").unwrap();

        let external = dir.path().join("note.txt");
        fs::write(&external, b"external").unwrap();

        let collisions = fs_plan_transfer_items(
            target_dir.to_string_lossy().into(),
            vec![external.to_string_lossy().into()],
            FileTransferOperation::Copy,
        )
        .await
        .expect("fs_plan_transfer_items should succeed");

        assert_eq!(collisions.len(), 1);
        assert_eq!(collisions[0].source_path, external.to_string_lossy());
        assert_eq!(collisions[0].destination_path, existing.to_string_lossy());
        assert!(collisions[0].destination_exists);
    }

    #[tokio::test]
    async fn transfer_items_replace_policy_overwrites_existing_destination() {
        let dir = tmp_dir();
        let target_dir = dir.path().join("target");
        fs::create_dir(&target_dir).unwrap();

        let existing = target_dir.join("note.txt");
        fs::write(&existing, b"original").unwrap();

        let external = dir.path().join("note.txt");
        fs::write(&external, b"external").unwrap();

        let result = fs_transfer_items(
            target_dir.to_string_lossy().into(),
            vec![external.to_string_lossy().into()],
            FileTransferOperation::Copy,
            Some(FileTransferCollisionPolicy::Replace),
        )
        .await
        .expect("fs_transfer_items should replace");

        assert_eq!(result.len(), 1);
        assert_eq!(result[0].destination_path, existing.to_string_lossy());
        assert_eq!(
            result[0].collision_policy,
            FileTransferCollisionPolicy::Replace
        );
        assert_eq!(result[0].disposition, FileTransferDisposition::Transferred);
        assert_eq!(fs::read(existing).unwrap(), b"external");
    }

    #[tokio::test]
    async fn transfer_items_skip_policy_leaves_existing_destination_untouched() {
        let dir = tmp_dir();
        let target_dir = dir.path().join("target");
        fs::create_dir(&target_dir).unwrap();

        let existing = target_dir.join("note.txt");
        fs::write(&existing, b"original").unwrap();

        let external = dir.path().join("note.txt");
        fs::write(&external, b"external").unwrap();

        let result = fs_transfer_items(
            target_dir.to_string_lossy().into(),
            vec![external.to_string_lossy().into()],
            FileTransferOperation::Copy,
            Some(FileTransferCollisionPolicy::Skip),
        )
        .await
        .expect("fs_transfer_items should skip");

        assert_eq!(result.len(), 1);
        assert_eq!(result[0].destination_path, existing.to_string_lossy());
        assert_eq!(
            result[0].collision_policy,
            FileTransferCollisionPolicy::Skip
        );
        assert_eq!(
            result[0].disposition,
            FileTransferDisposition::SkippedExisting
        );
        assert_eq!(fs::read(existing).unwrap(), b"original");
        assert_eq!(fs::read(external).unwrap(), b"external");
    }

    #[tokio::test]
    async fn transfer_items_moves_multiple_entries() {
        let dir = tmp_dir();
        let source_dir = dir.path().join("source");
        let target_dir = dir.path().join("target");
        fs::create_dir(&source_dir).unwrap();
        fs::create_dir(&target_dir).unwrap();

        let file_a = source_dir.join("a.txt");
        let folder_b = source_dir.join("folder-b");
        fs::write(&file_a, b"a").unwrap();
        fs::create_dir(&folder_b).unwrap();
        fs::write(folder_b.join("nested.txt"), b"nested").unwrap();

        let result = fs_transfer_items(
            target_dir.to_string_lossy().into(),
            vec![
                file_a.to_string_lossy().into(),
                folder_b.to_string_lossy().into(),
            ],
            FileTransferOperation::Move,
            None,
        )
        .await
        .expect("fs_transfer_items should move");

        assert_eq!(result.len(), 2);
        assert!(!file_a.exists(), "moved file should be removed from source");
        assert!(
            !folder_b.exists(),
            "moved folder should be removed from source"
        );
        assert!(
            target_dir.join("a.txt").exists(),
            "target should contain moved file"
        );
        assert!(
            target_dir.join("folder-b").join("nested.txt").exists(),
            "target should contain moved folder contents"
        );
    }

    #[tokio::test]
    async fn transfer_items_move_invalidates_recursive_search_caches() {
        let _serial_guard = search_test_serial_lock().await;
        let dir = tmp_dir();
        let source_dir = dir.path().join("source");
        let target_dir = dir.path().join("target");
        fs::create_dir(&source_dir).unwrap();
        fs::create_dir(&target_dir).unwrap();

        let source_file = source_dir.join("alpha-note.txt");
        let moved_file = target_dir.join("alpha-note.txt");
        fs::write(&source_file, "alpha body").unwrap();

        let root = dir.path().to_string_lossy().into_owned();
        let root_key = path_cache_key(dir.path());

        let initial_name_results = fs_search_entries(
            root.clone(),
            "alpha-note".to_string(),
            true,
            false,
            Some(50),
            None,
            None,
        )
        .await
        .expect("initial names-only fs_search_entries failed");
        assert_eq!(initial_name_results.len(), 1);
        assert_eq!(initial_name_results[0].path, source_file.to_string_lossy());

        let initial_content_results = fs_search_entries(
            root.clone(),
            "alpha body".to_string(),
            true,
            true,
            Some(50),
            None,
            None,
        )
        .await
        .expect("initial content fs_search_entries failed");
        assert_eq!(initial_content_results.len(), 1);
        assert_eq!(
            initial_content_results[0].path,
            source_file.to_string_lossy()
        );

        {
            let name_cache = search_name_index_cache()
                .lock()
                .expect("search name index cache poisoned");
            assert!(
                name_cache
                    .get(&root_key)
                    .and_then(|variants| variants.get(true))
                    .is_some(),
                "initial names-only search should populate the cached recursive name index"
            );
        }
        {
            let content_cache = search_content_index_cache()
                .lock()
                .expect("search content index cache poisoned");
            assert!(
                content_cache
                    .get(&root_key)
                    .and_then(|variants| variants.get(true))
                    .is_some(),
                "initial content-enabled search should populate the cached recursive content index"
            );
        }

        let transfer_results = fs_transfer_items(
            target_dir.to_string_lossy().into_owned(),
            vec![source_file.to_string_lossy().into_owned()],
            FileTransferOperation::Move,
            None,
        )
        .await
        .expect("fs_transfer_items should move and invalidate caches");
        assert_eq!(transfer_results.len(), 1);
        assert!(!source_file.exists(), "source file should be moved away");
        assert!(moved_file.exists(), "target file should exist after move");

        {
            let name_cache = search_name_index_cache()
                .lock()
                .expect("search name index cache poisoned");
            assert!(
                name_cache.get(&root_key).is_none(),
                "transfer move should clear ancestor recursive name-search caches"
            );
        }
        {
            let content_cache = search_content_index_cache()
                .lock()
                .expect("search content index cache poisoned");
            assert!(
                content_cache.get(&root_key).is_none(),
                "transfer move should clear ancestor recursive content-search caches"
            );
        }

        let refreshed_name_results = fs_search_entries(
            root.clone(),
            "alpha-note".to_string(),
            true,
            false,
            Some(50),
            None,
            None,
        )
        .await
        .expect("refreshed names-only fs_search_entries failed");
        assert_eq!(refreshed_name_results.len(), 1);
        assert_eq!(refreshed_name_results[0].path, moved_file.to_string_lossy());

        let refreshed_content_results = fs_search_entries(
            root,
            "alpha body".to_string(),
            true,
            true,
            Some(50),
            None,
            None,
        )
        .await
        .expect("refreshed content fs_search_entries failed");
        assert_eq!(refreshed_content_results.len(), 1);
        assert_eq!(
            refreshed_content_results[0].path,
            moved_file.to_string_lossy()
        );
    }

    #[tokio::test]
    async fn transfer_items_copy_invalidates_recursive_search_caches() {
        let _serial_guard = search_test_serial_lock().await;
        let dir = tmp_dir();
        let source_dir = dir.path().join("source");
        let target_dir = dir.path().join("target");
        fs::create_dir(&source_dir).unwrap();
        fs::create_dir(&target_dir).unwrap();

        let source_file = source_dir.join("alpha-note.txt");
        let copied_file = target_dir.join("alpha-note.txt");
        fs::write(&source_file, "alpha body").unwrap();

        let root = dir.path().to_string_lossy().into_owned();
        let root_key = path_cache_key(dir.path());

        let initial_name_results = fs_search_entries(
            root.clone(),
            "alpha-note".to_string(),
            true,
            false,
            Some(50),
            None,
            None,
        )
        .await
        .expect("initial names-only fs_search_entries failed");
        assert_eq!(initial_name_results.len(), 1);
        assert_eq!(initial_name_results[0].path, source_file.to_string_lossy());

        let initial_content_results = fs_search_entries(
            root.clone(),
            "alpha body".to_string(),
            true,
            true,
            Some(50),
            None,
            None,
        )
        .await
        .expect("initial content fs_search_entries failed");
        assert_eq!(initial_content_results.len(), 1);
        assert_eq!(
            initial_content_results[0].path,
            source_file.to_string_lossy()
        );

        {
            let name_cache = search_name_index_cache()
                .lock()
                .expect("search name index cache poisoned");
            assert!(
                name_cache
                    .get(&root_key)
                    .and_then(|variants| variants.get(true))
                    .is_some(),
                "initial names-only search should populate the cached recursive name index"
            );
        }
        {
            let content_cache = search_content_index_cache()
                .lock()
                .expect("search content index cache poisoned");
            assert!(
                content_cache
                    .get(&root_key)
                    .and_then(|variants| variants.get(true))
                    .is_some(),
                "initial content-enabled search should populate the cached recursive content index"
            );
        }

        let transfer_results = fs_transfer_items(
            target_dir.to_string_lossy().into_owned(),
            vec![source_file.to_string_lossy().into_owned()],
            FileTransferOperation::Copy,
            None,
        )
        .await
        .expect("fs_transfer_items should copy and invalidate caches");
        assert_eq!(transfer_results.len(), 1);
        assert!(source_file.exists(), "source file should remain after copy");
        assert!(copied_file.exists(), "target file should exist after copy");

        {
            let name_cache = search_name_index_cache()
                .lock()
                .expect("search name index cache poisoned");
            assert!(
                name_cache.get(&root_key).is_none(),
                "transfer copy should clear ancestor recursive name-search caches"
            );
        }
        {
            let content_cache = search_content_index_cache()
                .lock()
                .expect("search content index cache poisoned");
            assert!(
                content_cache.get(&root_key).is_none(),
                "transfer copy should clear ancestor recursive content-search caches"
            );
        }

        let refreshed_name_results = fs_search_entries(
            root.clone(),
            "alpha-note".to_string(),
            true,
            false,
            Some(50),
            None,
            None,
        )
        .await
        .expect("refreshed names-only fs_search_entries failed");
        assert_eq!(refreshed_name_results.len(), 2);
        assert_eq!(
            refreshed_name_results
                .iter()
                .filter(|entry| entry.path == source_file.to_string_lossy())
                .count(),
            1,
            "copied searches should continue to include the source entry"
        );
        assert_eq!(
            refreshed_name_results
                .iter()
                .filter(|entry| entry.path == copied_file.to_string_lossy())
                .count(),
            1,
            "copied searches should include the destination entry"
        );

        let refreshed_content_results = fs_search_entries(
            root,
            "alpha body".to_string(),
            true,
            true,
            Some(50),
            None,
            None,
        )
        .await
        .expect("refreshed content fs_search_entries failed");
        assert_eq!(refreshed_content_results.len(), 2);
        assert_eq!(
            refreshed_content_results
                .iter()
                .filter(|entry| entry.path == source_file.to_string_lossy())
                .count(),
            1,
            "copied content searches should continue to include the source entry"
        );
        assert_eq!(
            refreshed_content_results
                .iter()
                .filter(|entry| entry.path == copied_file.to_string_lossy())
                .count(),
            1,
            "copied content searches should include the destination entry"
        );
    }

    #[tokio::test]
    async fn transfer_items_rejects_moving_folder_into_its_descendant() {
        let dir = tmp_dir();
        let source_dir = dir.path().join("source");
        let nested_target = source_dir.join("nested");
        fs::create_dir(&source_dir).unwrap();
        fs::create_dir(&nested_target).unwrap();
        fs::write(source_dir.join("root.txt"), b"root").unwrap();

        let result = fs_transfer_items(
            nested_target.to_string_lossy().into(),
            vec![source_dir.to_string_lossy().into()],
            FileTransferOperation::Move,
            None,
        )
        .await;

        assert!(result.is_err(), "self-nesting move should be rejected");
        let message = result.err().unwrap();
        assert!(
            message.contains("descendants"),
            "unexpected error message: {message}"
        );
    }

    #[tokio::test]
    async fn delete_removes_a_file() {
        let dir = tmp_dir();
        let file = dir.path().join("gone.txt");
        fs::write(&file, b"bye").unwrap();

        let result = fs_delete(file.to_string_lossy().into(), false).await;
        assert!(result.is_ok(), "delete failed: {:?}", result);
        assert!(!file.exists(), "file should be gone");
    }

    #[tokio::test]
    async fn delete_removes_directory_when_recursive() {
        let dir = tmp_dir();
        let sub = dir.path().join("to_delete");
        fs::create_dir(&sub).unwrap();
        fs::write(sub.join("inner.txt"), b"data").unwrap();

        let result = fs_delete(sub.to_string_lossy().into(), true).await;
        assert!(result.is_ok(), "recursive delete failed: {:?}", result);
        assert!(!sub.exists(), "directory should be gone");
    }

    #[tokio::test]
    async fn delete_fails_non_empty_dir_without_recursive() {
        let dir = tmp_dir();
        let sub = dir.path().join("non_empty");
        fs::create_dir(&sub).unwrap();
        fs::write(sub.join("file.txt"), b"data").unwrap();

        let result = fs_delete(sub.to_string_lossy().into(), false).await;
        assert!(
            result.is_err(),
            "expected Err when deleting non-empty dir without recursive"
        );
    }

    #[tokio::test]
    async fn get_home_dir_returns_a_path() {
        let result = fs_get_home_dir().await;
        assert!(result.is_ok(), "fs_get_home_dir failed: {:?}", result);
        let home = result.unwrap();
        assert!(!home.is_empty(), "home dir should not be empty");
        // Should be an absolute path
        let p = std::path::Path::new(&home);
        assert!(p.is_absolute(), "home dir '{}' should be absolute", home);
    }

    #[cfg(any(target_os = "macos", target_os = "linux"))]
    #[test]
    fn unix_home_drive_info_returns_absolute_home_drive() {
        let drive = unix_home_drive_info().expect("unix home drive should exist");
        assert_eq!(drive.label, "Home");
        assert_eq!(drive.drive_type, "home");
        assert!(
            Path::new(&drive.letter).is_absolute(),
            "home drive path '{}' should be absolute",
            drive.letter
        );
    }

    #[tokio::test]
    async fn fs_read_file_base64_returns_data_url_for_small_file() {
        let dir = tmp_dir();
        let file_path = dir.path().join("preview.png");
        fs::write(&file_path, b"png-data").unwrap();

        let result = fs_read_file_base64(file_path.to_string_lossy().into()).await;
        let data_url = result.expect("small preview should succeed");
        assert!(
            data_url.starts_with("data:image/png;base64,"),
            "unexpected data url: {data_url}"
        );
    }

    #[tokio::test]
    async fn fs_read_file_base64_rejects_large_files() {
        let dir = tmp_dir();
        let file_path = dir.path().join("huge-preview.bin");
        let oversized = vec![0u8; (FS_READ_FILE_BASE64_MAX_BYTES as usize) + 1];
        fs::write(&file_path, oversized).unwrap();

        let result = fs_read_file_base64(file_path.to_string_lossy().into()).await;
        let error = result.expect_err("oversized preview should be rejected");
        assert!(error.contains("> 12 MB"), "unexpected error: {error}");
    }

    #[tokio::test]
    async fn fs_read_image_thumbnail_returns_png_data_url_for_image_file() {
        let dir = tmp_dir();
        let file_path = dir.path().join("thumbnail-source.png");
        let image = RgbaImage::from_pixel(1600, 900, Rgba([12, 34, 56, 255]));
        image.save(&file_path).expect("write image");

        let result = fs_read_image_thumbnail(file_path.to_string_lossy().into(), 320, 240).await;
        let data_url = result.expect("thumbnail preview should succeed");
        assert!(
            data_url.starts_with("data:image/png;base64,"),
            "unexpected thumbnail data url: {data_url}"
        );
    }

    #[tokio::test]
    async fn fs_read_image_thumbnail_rejects_invalid_bounds() {
        let dir = tmp_dir();
        let file_path = dir.path().join("thumbnail-source.png");
        let image = RgbaImage::from_pixel(64, 64, Rgba([255, 0, 0, 255]));
        image.save(&file_path).expect("write image");

        let result = fs_read_image_thumbnail(file_path.to_string_lossy().into(), 0, 240).await;
        let error = result.expect_err("thumbnail preview should reject invalid bounds");
        assert!(
            error.contains("greater than zero"),
            "unexpected thumbnail bounds error: {error}"
        );
    }

    #[tokio::test]
    async fn git_exec_returns_stdout_for_successful_command() {
        let _env_guard = GIT_EXEC_TEST_ENV_LOCK
            .get_or_init(|| Mutex::new(()))
            .lock()
            .expect("git env lock");

        unsafe {
            std::env::remove_var("OVERLAYTERM_GIT_EXECUTABLE");
        }

        let dir = TempDir::new().expect("temp dir");
        let output = git_exec(
            dir.path().to_string_lossy().to_string(),
            vec!["--version".to_string()],
        )
        .await
        .expect("git --version should succeed");

        assert!(output.to_lowercase().contains("git version"));
    }

    #[tokio::test]
    async fn git_exec_reports_exit_code_for_failed_command() {
        let _env_guard = GIT_EXEC_TEST_ENV_LOCK
            .get_or_init(|| Mutex::new(()))
            .lock()
            .expect("git env lock");

        let dir = TempDir::new().expect("temp dir");
        let script_path = dir.path().join(if cfg!(target_os = "windows") {
            "fake-git-failure.cmd"
        } else {
            "fake-git-failure.sh"
        });

        #[cfg(target_os = "windows")]
        let script_body = "@echo off\r\necho boom 1>&2\r\nexit /b 7\r\n";

        #[cfg(not(target_os = "windows"))]
        let script_body = "#!/bin/sh\necho boom >&2\nexit 7\n";

        fs::write(&script_path, script_body).expect("write fake git script");

        #[cfg(not(target_os = "windows"))]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut permissions = fs::metadata(&script_path).expect("metadata").permissions();
            permissions.set_mode(0o755);
            fs::set_permissions(&script_path, permissions).expect("chmod fake git script");
        }

        unsafe {
            std::env::set_var("OVERLAYTERM_GIT_EXECUTABLE", &script_path);
        }

        let result = run_git_command(
            dir.path().to_string_lossy().as_ref(),
            &["status".to_string()],
            Duration::from_secs(1),
        );

        unsafe {
            std::env::remove_var("OVERLAYTERM_GIT_EXECUTABLE");
        }

        let error = result.expect_err("failing fake git should return an error");
        assert!(error.contains("exit 7"), "unexpected error: {error}");
        assert!(error.contains("boom"), "unexpected error: {error}");
    }
    #[tokio::test]
    async fn git_exec_times_out_and_kills_slow_process() {
        let _env_guard = GIT_EXEC_TEST_ENV_LOCK
            .get_or_init(|| Mutex::new(()))
            .lock()
            .expect("git env lock");

        let dir = TempDir::new().expect("temp dir");
        let script_path = dir.path().join(if cfg!(target_os = "windows") {
            "fake-git-timeout.cmd"
        } else {
            "fake-git-timeout.sh"
        });

        #[cfg(target_os = "windows")]
        let script_body = "@echo off\r\nping 127.0.0.1 -n 6 >nul\r\necho should-not-complete\r\n";

        #[cfg(not(target_os = "windows"))]
        let script_body = "#!/bin/sh\nsleep 5\necho should-not-complete\n";

        fs::write(&script_path, script_body).expect("write fake git script");

        #[cfg(not(target_os = "windows"))]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut permissions = fs::metadata(&script_path).expect("metadata").permissions();
            permissions.set_mode(0o755);
            fs::set_permissions(&script_path, permissions).expect("chmod fake git script");
        }

        unsafe {
            std::env::set_var("OVERLAYTERM_GIT_EXECUTABLE", &script_path);
        }

        let result = run_git_command(
            dir.path().to_string_lossy().as_ref(),
            &["status".to_string()],
            Duration::from_millis(150),
        );

        unsafe {
            std::env::remove_var("OVERLAYTERM_GIT_EXECUTABLE");
        }

        let error = result.expect_err("slow fake git should time out");
        assert!(error.contains("timed out"), "unexpected error: {error}");
    }
}
