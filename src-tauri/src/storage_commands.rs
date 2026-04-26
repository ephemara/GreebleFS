use serde::{Deserialize, Serialize};
use std::cmp::Reverse;
use std::collections::{BinaryHeap, HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use std::time::{Duration, Instant};
use uuid::Uuid;

use crate::volume_inventory::is_same_volume;

#[cfg(target_os = "windows")]
use std::os::windows::ffi::OsStrExt;

const STORAGE_SCAN_TOP_FILE_LIMIT: usize = 192;
const STORAGE_SCAN_TOP_DIRECTORY_LIMIT: usize = 160;
const STORAGE_SCAN_LARGEST_ENTRY_LIMIT: usize = 96;
const STORAGE_SCAN_TYPE_BUCKET_ENTRY_LIMIT: usize = 16;
const STORAGE_SCAN_PROGRESS_FLUSH_ENTRY_INTERVAL: u64 = 256;
const STORAGE_SCAN_PROGRESS_FLUSH_INTERVAL: Duration = Duration::from_millis(150);
const STORAGE_SCAN_SAMPLE_ERROR_LIMIT: usize = 16;

static STORAGE_SCAN_REGISTRY: OnceLock<Mutex<HashMap<String, Arc<Mutex<StorageScanProgress>>>>> =
    OnceLock::new();

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum StorageNodeKind {
    Directory,
    File,
    Other,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct StorageScanStartResponse {
    pub scan_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct StoragePathSummary {
    pub path: String,
    pub name: String,
    pub kind: StorageNodeKind,
    pub logical_bytes: u64,
    pub allocated_bytes: u64,
    pub waste_bytes: u64,
    pub file_count: u64,
    pub directory_count: u64,
    pub depth: u32,
    pub extension: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct StorageTreeNode {
    pub path: String,
    pub name: String,
    pub kind: StorageNodeKind,
    pub logical_bytes: u64,
    pub allocated_bytes: u64,
    pub waste_bytes: u64,
    pub file_count: u64,
    pub directory_count: u64,
    pub extension: Option<String>,
    pub children: Vec<StorageTreeNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct StorageTypeBucketSummary {
    pub id: String,
    pub label: String,
    pub file_count: u64,
    pub logical_bytes: u64,
    pub allocated_bytes: u64,
    pub waste_bytes: u64,
    pub largest_entries: Vec<StoragePathSummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct StorageScanStatus {
    pub scan_id: String,
    pub root_path: String,
    pub root_name: String,
    pub scanned_file_count: u64,
    pub scanned_directory_count: u64,
    pub total_logical_bytes: u64,
    pub total_allocated_bytes: u64,
    pub total_waste_bytes: u64,
    pub error_count: u64,
    pub sample_errors: Vec<String>,
    pub completed: bool,
    pub cancelled: bool,
    pub error: Option<String>,
    pub current_path: Option<String>,
    pub elapsed_ms: u64,
    pub tree: Option<StorageTreeNode>,
    pub largest_entries: Vec<StoragePathSummary>,
    pub type_buckets: Vec<StorageTypeBucketSummary>,
}

#[derive(Debug)]
struct StorageScanProgress {
    root_path: String,
    root_name: String,
    scanned_file_count: u64,
    scanned_directory_count: u64,
    total_logical_bytes: u64,
    total_allocated_bytes: u64,
    error_count: u64,
    sample_errors: Vec<String>,
    completed: bool,
    cancelled: bool,
    error: Option<String>,
    current_path: Option<String>,
    tree: Option<StorageTreeNode>,
    largest_entries: Vec<StoragePathSummary>,
    type_buckets: Vec<StorageTypeBucketSummary>,
    directory_entries: HashMap<String, Vec<StoragePathSummary>>,
    started_at: Instant,
}

impl StorageScanProgress {
    fn into_status(&self, scan_id: String) -> StorageScanStatus {
        StorageScanStatus {
            scan_id,
            root_path: self.root_path.clone(),
            root_name: self.root_name.clone(),
            scanned_file_count: self.scanned_file_count,
            scanned_directory_count: self.scanned_directory_count,
            total_logical_bytes: self.total_logical_bytes,
            total_allocated_bytes: self.total_allocated_bytes,
            total_waste_bytes: self
                .total_allocated_bytes
                .saturating_sub(self.total_logical_bytes),
            error_count: self.error_count,
            sample_errors: self.sample_errors.clone(),
            completed: self.completed,
            cancelled: self.cancelled,
            error: self.error.clone(),
            current_path: self.current_path.clone(),
            elapsed_ms: self.started_at.elapsed().as_millis() as u64,
            tree: self.tree.clone(),
            largest_entries: self.largest_entries.clone(),
            type_buckets: self.type_buckets.clone(),
        }
    }
}

#[derive(Debug)]
struct PendingStorageDirectory {
    path: PathBuf,
    name: String,
    depth: u32,
    read_dir: fs::ReadDir,
    logical_bytes: u64,
    allocated_bytes: u64,
    file_count: u64,
    directory_count: u64,
    children: Vec<StoragePathSummary>,
}

#[derive(Debug, Clone)]
struct StorageDirectorySummary {
    path: PathBuf,
    name: String,
    logical_bytes: u64,
    allocated_bytes: u64,
    file_count: u64,
    directory_count: u64,
    depth: u32,
}

impl StorageDirectorySummary {
    fn to_path_summary(&self) -> StoragePathSummary {
        make_storage_path_summary(
            self.path.to_string_lossy().to_string(),
            self.name.clone(),
            StorageNodeKind::Directory,
            self.logical_bytes,
            self.allocated_bytes,
            self.file_count,
            self.directory_count,
            self.depth,
            None,
        )
    }
}

impl Eq for StorageDirectorySummary {}
impl PartialEq for StorageDirectorySummary {
    fn eq(&self, other: &Self) -> bool {
        self.path == other.path
            && self.allocated_bytes == other.allocated_bytes
            && self.logical_bytes == other.logical_bytes
    }
}
impl Ord for StorageDirectorySummary {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        self.allocated_bytes
            .cmp(&other.allocated_bytes)
            .then_with(|| self.logical_bytes.cmp(&other.logical_bytes))
            .then_with(|| self.path.cmp(&other.path))
    }
}
impl PartialOrd for StorageDirectorySummary {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

#[derive(Debug, Clone)]
struct StorageFileCandidate {
    path: PathBuf,
    name: String,
    logical_bytes: u64,
    allocated_bytes: u64,
    depth: u32,
    extension: Option<String>,
}

impl StorageFileCandidate {
    fn to_path_summary(&self) -> StoragePathSummary {
        make_storage_path_summary(
            self.path.to_string_lossy().to_string(),
            self.name.clone(),
            StorageNodeKind::File,
            self.logical_bytes,
            self.allocated_bytes,
            1,
            0,
            self.depth,
            self.extension.clone(),
        )
    }
}

impl Eq for StorageFileCandidate {}
impl PartialEq for StorageFileCandidate {
    fn eq(&self, other: &Self) -> bool {
        self.path == other.path
            && self.allocated_bytes == other.allocated_bytes
            && self.logical_bytes == other.logical_bytes
    }
}
impl Ord for StorageFileCandidate {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        self.allocated_bytes
            .cmp(&other.allocated_bytes)
            .then_with(|| self.logical_bytes.cmp(&other.logical_bytes))
            .then_with(|| self.path.cmp(&other.path))
    }
}
impl PartialOrd for StorageFileCandidate {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

#[derive(Debug, Clone)]
struct StorageTypeBucketAggregate {
    id: String,
    label: String,
    file_count: u64,
    logical_bytes: u64,
    allocated_bytes: u64,
    largest_entries: Vec<StoragePathSummary>,
}

#[derive(Debug)]
struct StorageScanCompletedSnapshot {
    tree: StorageTreeNode,
    largest_entries: Vec<StoragePathSummary>,
    type_buckets: Vec<StorageTypeBucketSummary>,
    directory_entries: HashMap<String, Vec<StoragePathSummary>>,
    scanned_file_count: u64,
    scanned_directory_count: u64,
    total_logical_bytes: u64,
    total_allocated_bytes: u64,
    error_count: u64,
    sample_errors: Vec<String>,
}

#[derive(Debug, Clone)]
struct StorageFileMeasurement {
    logical_bytes: u64,
    allocated_bytes: u64,
    extension: Option<String>,
}

fn storage_scan_registry() -> &'static Mutex<HashMap<String, Arc<Mutex<StorageScanProgress>>>> {
    STORAGE_SCAN_REGISTRY.get_or_init(|| Mutex::new(HashMap::new()))
}

fn prune_completed_storage_scans(registry: &mut HashMap<String, Arc<Mutex<StorageScanProgress>>>) {
    registry.retain(|_, progress| {
        progress
            .lock()
            .map(|state| !state.completed)
            .unwrap_or(true)
    });
}

fn normalize_storage_scan_root(raw_path: &str) -> String {
    let trimmed = raw_path.trim();
    #[cfg(target_os = "windows")]
    {
        if trimmed.len() == 2 {
            let bytes = trimmed.as_bytes();
            if bytes[0].is_ascii_alphabetic() && bytes[1] == b':' {
                return format!("{trimmed}\\");
            }
        }
    }
    trimmed.to_string()
}

fn normalize_storage_lookup_path(raw_path: &str) -> String {
    let trimmed = raw_path.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    let without_trailing = trimmed.trim_end_matches(['/', '\\']);
    #[cfg(target_os = "windows")]
    {
        if without_trailing.len() == 2 {
            let bytes = without_trailing.as_bytes();
            if bytes[0].is_ascii_alphabetic() && bytes[1] == b':' {
                return format!("{without_trailing}\\");
            }
        }
    }
    if without_trailing.is_empty() {
        trimmed.to_string()
    } else {
        without_trailing.to_string()
    }
}

fn storage_display_name(path: &Path) -> String {
    path.file_name()
        .map(|value| value.to_string_lossy().trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| path.to_string_lossy().to_string())
}

fn path_depth(root: &Path, path: &Path) -> u32 {
    path.components()
        .count()
        .saturating_sub(root.components().count()) as u32
}

fn maybe_push_scan_error(sample_errors: &mut Vec<String>, error_count: &mut u64, message: String) {
    *error_count += 1;
    if sample_errors.len() < STORAGE_SCAN_SAMPLE_ERROR_LIMIT {
        sample_errors.push(message);
    }
}

fn make_storage_path_summary(
    path: String,
    name: String,
    kind: StorageNodeKind,
    logical_bytes: u64,
    allocated_bytes: u64,
    file_count: u64,
    directory_count: u64,
    depth: u32,
    extension: Option<String>,
) -> StoragePathSummary {
    StoragePathSummary {
        path,
        name,
        kind,
        logical_bytes,
        allocated_bytes,
        waste_bytes: allocated_bytes.saturating_sub(logical_bytes),
        file_count,
        directory_count,
        depth,
        extension,
    }
}

fn sort_storage_path_summaries(entries: &mut [StoragePathSummary]) {
    entries.sort_by(|left, right| {
        right
            .allocated_bytes
            .cmp(&left.allocated_bytes)
            .then_with(|| right.logical_bytes.cmp(&left.logical_bytes))
            .then_with(|| left.name.cmp(&right.name))
            .then_with(|| left.path.cmp(&right.path))
    });
}

fn normalized_storage_extension(path: &Path) -> Option<String> {
    path.extension()
        .map(|value| value.to_string_lossy().trim().to_ascii_lowercase())
        .map(|value| value.trim_start_matches('.').to_string())
        .filter(|value| !value.is_empty())
}

#[cfg(target_os = "windows")]
fn query_allocated_file_bytes(path: &Path, logical_bytes: u64) -> u64 {
    use windows_sys::Win32::Foundation::GetLastError;
    use windows_sys::Win32::Storage::FileSystem::GetCompressedFileSizeW;

    let wide_path = path
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<u16>>();
    let mut high = 0_u32;
    let low = unsafe { GetCompressedFileSizeW(wide_path.as_ptr(), &mut high) };
    if low == u32::MAX {
        let error = unsafe { GetLastError() };
        if error != 0 {
            return logical_bytes;
        }
    }

    ((high as u64) << 32) | (low as u64)
}

#[cfg(not(target_os = "windows"))]
fn query_allocated_file_bytes(_path: &Path, logical_bytes: u64) -> u64 {
    logical_bytes
}

fn measure_storage_file(path: &Path, metadata: &fs::Metadata) -> StorageFileMeasurement {
    let logical_bytes = metadata.len();
    let allocated_bytes = query_allocated_file_bytes(path, logical_bytes).max(logical_bytes);
    StorageFileMeasurement {
        logical_bytes,
        allocated_bytes,
        extension: normalized_storage_extension(path),
    }
}

fn push_top_file_candidate(
    heap: &mut BinaryHeap<Reverse<StorageFileCandidate>>,
    candidate: StorageFileCandidate,
    limit: usize,
) -> bool {
    if heap.len() < limit {
        heap.push(Reverse(candidate));
        return true;
    }

    let should_replace = heap
        .peek()
        .map(|smallest| candidate > smallest.0)
        .unwrap_or(true);
    if should_replace {
        let _ = heap.pop();
        heap.push(Reverse(candidate));
        return true;
    }

    false
}

fn push_top_directory_candidate(
    heap: &mut BinaryHeap<Reverse<StorageDirectorySummary>>,
    candidate: StorageDirectorySummary,
    limit: usize,
) -> bool {
    if heap.len() < limit {
        heap.push(Reverse(candidate));
        return true;
    }

    let should_replace = heap
        .peek()
        .map(|smallest| candidate > smallest.0)
        .unwrap_or(true);
    if should_replace {
        let _ = heap.pop();
        heap.push(Reverse(candidate));
        return true;
    }

    false
}

fn collect_sorted_files(
    heap: BinaryHeap<Reverse<StorageFileCandidate>>,
) -> Vec<StorageFileCandidate> {
    let mut entries = heap
        .into_sorted_vec()
        .into_iter()
        .map(|entry| entry.0)
        .collect::<Vec<_>>();
    entries.reverse();
    entries
}

fn collect_sorted_directories(
    heap: BinaryHeap<Reverse<StorageDirectorySummary>>,
) -> Vec<StorageDirectorySummary> {
    let mut entries = heap
        .into_sorted_vec()
        .into_iter()
        .map(|entry| entry.0)
        .collect::<Vec<_>>();
    entries.reverse();
    entries
}

fn flush_storage_scan_progress(
    progress: &Arc<Mutex<StorageScanProgress>>,
    scanned_file_count: u64,
    scanned_directory_count: u64,
    total_logical_bytes: u64,
    total_allocated_bytes: u64,
    error_count: u64,
    sample_errors: &[String],
    current_path: Option<&Path>,
) -> Result<bool, String> {
    let mut state = progress
        .lock()
        .map_err(|_| "Storage scan progress lock was poisoned.".to_string())?;
    state.scanned_file_count = scanned_file_count;
    state.scanned_directory_count = scanned_directory_count;
    state.total_logical_bytes = total_logical_bytes;
    state.total_allocated_bytes = total_allocated_bytes;
    state.error_count = error_count;
    state.sample_errors = sample_errors.to_vec();
    state.current_path = current_path.map(|value| value.to_string_lossy().to_string());
    Ok(state.cancelled)
}

fn insert_required_ancestor_paths(
    required_paths: &mut HashSet<PathBuf>,
    stack: &[PendingStorageDirectory],
    include_self: Option<&Path>,
) {
    for directory in stack {
        required_paths.insert(directory.path.clone());
    }
    if let Some(path) = include_self {
        required_paths.insert(path.to_path_buf());
    }
}

fn storage_type_bucket_identity(extension: Option<&str>) -> (String, String) {
    match extension {
        Some(extension) if !extension.trim().is_empty() => {
            (extension.to_string(), format!(".{extension}"))
        }
        _ => ("(none)".to_string(), "No Extension".to_string()),
    }
}

fn update_storage_type_bucket(
    buckets: &mut HashMap<String, StorageTypeBucketAggregate>,
    file_summary: &StoragePathSummary,
) {
    let (bucket_id, bucket_label) = storage_type_bucket_identity(file_summary.extension.as_deref());
    let bucket = buckets
        .entry(bucket_id.clone())
        .or_insert_with(|| StorageTypeBucketAggregate {
            id: bucket_id,
            label: bucket_label,
            file_count: 0,
            logical_bytes: 0,
            allocated_bytes: 0,
            largest_entries: Vec::new(),
        });

    bucket.file_count = bucket.file_count.saturating_add(1);
    bucket.logical_bytes = bucket
        .logical_bytes
        .saturating_add(file_summary.logical_bytes);
    bucket.allocated_bytes = bucket
        .allocated_bytes
        .saturating_add(file_summary.allocated_bytes);
    bucket.largest_entries.push(file_summary.clone());
    sort_storage_path_summaries(&mut bucket.largest_entries);
    bucket
        .largest_entries
        .truncate(STORAGE_SCAN_TYPE_BUCKET_ENTRY_LIMIT);
}

fn finalize_storage_type_buckets(
    buckets: HashMap<String, StorageTypeBucketAggregate>,
) -> Vec<StorageTypeBucketSummary> {
    let mut values = buckets
        .into_values()
        .map(|bucket| StorageTypeBucketSummary {
            id: bucket.id,
            label: bucket.label,
            file_count: bucket.file_count,
            logical_bytes: bucket.logical_bytes,
            allocated_bytes: bucket.allocated_bytes,
            waste_bytes: bucket.allocated_bytes.saturating_sub(bucket.logical_bytes),
            largest_entries: bucket.largest_entries,
        })
        .collect::<Vec<_>>();

    values.sort_by(|left, right| {
        right
            .allocated_bytes
            .cmp(&left.allocated_bytes)
            .then_with(|| left.label.cmp(&right.label))
    });
    values
}

fn build_storage_snapshot(
    root: &Path,
    root_summary: &StorageDirectorySummary,
    required_directory_summaries: &HashMap<PathBuf, StorageDirectorySummary>,
    top_directories: &[StorageDirectorySummary],
    top_files: &[StorageFileCandidate],
    type_buckets: Vec<StorageTypeBucketSummary>,
    directory_entries: HashMap<String, Vec<StoragePathSummary>>,
    scanned_file_count: u64,
    scanned_directory_count: u64,
    total_logical_bytes: u64,
    total_allocated_bytes: u64,
    error_count: u64,
    sample_errors: &[String],
) -> Result<StorageScanCompletedSnapshot, String> {
    let mut selected_directory_paths = HashSet::from([root.to_path_buf()]);

    for directory in top_directories {
        let mut current = Some(directory.path.as_path());
        while let Some(path) = current {
            if !path.starts_with(root) {
                break;
            }
            selected_directory_paths.insert(path.to_path_buf());
            if path == root {
                break;
            }
            current = path.parent();
        }
    }

    for file in top_files {
        let mut current = file.path.parent();
        while let Some(path) = current {
            if !path.starts_with(root) {
                break;
            }
            selected_directory_paths.insert(path.to_path_buf());
            if path == root {
                break;
            }
            current = path.parent();
        }
    }

    let selected_file_summaries = top_files
        .iter()
        .map(|file| (file.path.clone(), file.to_path_summary()))
        .collect::<HashMap<_, _>>();

    let selected_directory_summaries = selected_directory_paths
        .iter()
        .map(|path| {
            if path == root {
                return Ok((path.clone(), root_summary.clone()));
            }

            required_directory_summaries
                .get(path)
                .cloned()
                .map(|summary| (path.clone(), summary))
                .ok_or_else(|| {
                    format!(
                        "Storage scan summary was missing a required directory record for {}",
                        path.display()
                    )
                })
        })
        .collect::<Result<HashMap<_, _>, _>>()?;

    let mut children_by_parent = HashMap::<PathBuf, Vec<PathBuf>>::new();
    for path in selected_directory_summaries.keys() {
        if path == root {
            continue;
        }
        if let Some(parent) = path.parent() {
            children_by_parent
                .entry(parent.to_path_buf())
                .or_default()
                .push(path.clone());
        }
    }
    for path in selected_file_summaries.keys() {
        if let Some(parent) = path.parent() {
            children_by_parent
                .entry(parent.to_path_buf())
                .or_default()
                .push(path.clone());
        }
    }

    fn visible_directory_contribution(node: &StorageTreeNode) -> u64 {
        match node.kind {
            StorageNodeKind::Directory => node.directory_count.saturating_add(1),
            StorageNodeKind::Other => node.directory_count,
            StorageNodeKind::File => 0,
        }
    }

    fn build_tree_node(
        path: &Path,
        directory_summaries: &HashMap<PathBuf, StorageDirectorySummary>,
        file_summaries: &HashMap<PathBuf, StoragePathSummary>,
        children_by_parent: &HashMap<PathBuf, Vec<PathBuf>>,
    ) -> Result<StorageTreeNode, String> {
        if let Some(summary) = file_summaries.get(path) {
            return Ok(StorageTreeNode {
                path: summary.path.clone(),
                name: summary.name.clone(),
                kind: StorageNodeKind::File,
                logical_bytes: summary.logical_bytes,
                allocated_bytes: summary.allocated_bytes,
                waste_bytes: summary.waste_bytes,
                file_count: summary.file_count,
                directory_count: summary.directory_count,
                extension: summary.extension.clone(),
                children: Vec::new(),
            });
        }

        let summary = directory_summaries.get(path).ok_or_else(|| {
            format!(
                "Storage scan tree was missing a directory summary for {}",
                path.display()
            )
        })?;
        let mut children = children_by_parent
            .get(path)
            .cloned()
            .unwrap_or_default()
            .into_iter()
            .map(|child| {
                build_tree_node(
                    &child,
                    directory_summaries,
                    file_summaries,
                    children_by_parent,
                )
            })
            .collect::<Result<Vec<_>, _>>()?;

        children.sort_by(|left, right| {
            right
                .allocated_bytes
                .cmp(&left.allocated_bytes)
                .then_with(|| right.logical_bytes.cmp(&left.logical_bytes))
                .then_with(|| left.name.cmp(&right.name))
        });

        let visible_allocated_bytes = children
            .iter()
            .map(|child| child.allocated_bytes)
            .sum::<u64>();
        let visible_logical_bytes = children
            .iter()
            .map(|child| child.logical_bytes)
            .sum::<u64>();
        let visible_file_count = children.iter().map(|child| child.file_count).sum::<u64>();
        let visible_directory_count = children
            .iter()
            .map(visible_directory_contribution)
            .sum::<u64>();
        let remaining_allocated_bytes = summary
            .allocated_bytes
            .saturating_sub(visible_allocated_bytes);
        let remaining_logical_bytes = summary.logical_bytes.saturating_sub(visible_logical_bytes);
        let remaining_file_count = summary.file_count.saturating_sub(visible_file_count);
        let remaining_directory_count = summary
            .directory_count
            .saturating_sub(visible_directory_count);

        if remaining_allocated_bytes > 0
            || remaining_logical_bytes > 0
            || remaining_file_count > 0
            || remaining_directory_count > 0
        {
            children.push(StorageTreeNode {
                path: format!("{}::other", summary.path.to_string_lossy()),
                name: "Other".to_string(),
                kind: StorageNodeKind::Other,
                logical_bytes: remaining_logical_bytes,
                allocated_bytes: remaining_allocated_bytes,
                waste_bytes: remaining_allocated_bytes.saturating_sub(remaining_logical_bytes),
                file_count: remaining_file_count,
                directory_count: remaining_directory_count,
                extension: None,
                children: Vec::new(),
            });
            children.sort_by(|left, right| {
                right
                    .allocated_bytes
                    .cmp(&left.allocated_bytes)
                    .then_with(|| right.logical_bytes.cmp(&left.logical_bytes))
                    .then_with(|| left.name.cmp(&right.name))
            });
        }

        Ok(StorageTreeNode {
            path: summary.path.to_string_lossy().to_string(),
            name: summary.name.clone(),
            kind: StorageNodeKind::Directory,
            logical_bytes: summary.logical_bytes,
            allocated_bytes: summary.allocated_bytes,
            waste_bytes: summary
                .allocated_bytes
                .saturating_sub(summary.logical_bytes),
            file_count: summary.file_count,
            directory_count: summary.directory_count,
            extension: None,
            children,
        })
    }

    let mut largest_entries = top_directories
        .iter()
        .map(StorageDirectorySummary::to_path_summary)
        .chain(top_files.iter().map(StorageFileCandidate::to_path_summary))
        .collect::<Vec<_>>();

    sort_storage_path_summaries(&mut largest_entries);
    largest_entries.truncate(STORAGE_SCAN_LARGEST_ENTRY_LIMIT);

    Ok(StorageScanCompletedSnapshot {
        tree: build_tree_node(
            root,
            &selected_directory_summaries,
            &selected_file_summaries,
            &children_by_parent,
        )?,
        largest_entries,
        type_buckets,
        directory_entries,
        scanned_file_count,
        scanned_directory_count,
        total_logical_bytes,
        total_allocated_bytes,
        error_count,
        sample_errors: sample_errors.to_vec(),
    })
}

fn scan_storage_root(
    root: &Path,
    progress: &Arc<Mutex<StorageScanProgress>>,
) -> Result<Option<StorageScanCompletedSnapshot>, String> {
    if !root.exists() {
        return Err(format!(
            "Storage scan root does not exist: {}",
            root.display()
        ));
    }
    if !root.is_dir() {
        return Err(format!(
            "Storage scan root is not a directory: {}",
            root.display()
        ));
    }

    let root_read_dir = fs::read_dir(root).map_err(|error| {
        format!(
            "Failed to enumerate storage scan root {}: {error}",
            root.display()
        )
    })?;

    let mut stack = vec![PendingStorageDirectory {
        path: root.to_path_buf(),
        name: storage_display_name(root),
        depth: 0,
        read_dir: root_read_dir,
        logical_bytes: 0,
        allocated_bytes: 0,
        file_count: 0,
        directory_count: 0,
        children: Vec::new(),
    }];
    let mut top_files = BinaryHeap::<Reverse<StorageFileCandidate>>::new();
    let mut top_directories = BinaryHeap::<Reverse<StorageDirectorySummary>>::new();
    let mut required_directory_paths = HashSet::from([root.to_path_buf()]);
    let mut required_directory_summaries = HashMap::<PathBuf, StorageDirectorySummary>::new();
    let mut directory_entries = HashMap::<String, Vec<StoragePathSummary>>::new();
    let mut type_buckets = HashMap::<String, StorageTypeBucketAggregate>::new();
    let mut scanned_file_count = 0_u64;
    let mut scanned_directory_count = 0_u64;
    let mut total_logical_bytes = 0_u64;
    let mut total_allocated_bytes = 0_u64;
    let mut error_count = 0_u64;
    let mut sample_errors = Vec::<String>::new();
    let mut current_path: Option<PathBuf> = None;
    let mut processed_entries_since_flush = 0_u64;
    let mut last_flush = Instant::now();
    let mut root_summary: Option<StorageDirectorySummary> = None;

    loop {
        let should_flush = processed_entries_since_flush
            >= STORAGE_SCAN_PROGRESS_FLUSH_ENTRY_INTERVAL
            || last_flush.elapsed() >= STORAGE_SCAN_PROGRESS_FLUSH_INTERVAL;
        if should_flush {
            let cancelled = flush_storage_scan_progress(
                progress,
                scanned_file_count,
                scanned_directory_count,
                total_logical_bytes,
                total_allocated_bytes,
                error_count,
                &sample_errors,
                current_path.as_deref(),
            )?;
            if cancelled {
                return Ok(None);
            }
            processed_entries_since_flush = 0;
            last_flush = Instant::now();
        }

        let Some(current_directory) = stack.last_mut() else {
            break;
        };

        match current_directory.read_dir.next() {
            Some(Ok(entry)) => {
                let path = entry.path();
                current_path = Some(path.clone());
                processed_entries_since_flush = processed_entries_since_flush.saturating_add(1);

                let metadata = match fs::symlink_metadata(&path) {
                    Ok(metadata) => metadata,
                    Err(error) => {
                        maybe_push_scan_error(
                            &mut sample_errors,
                            &mut error_count,
                            format!("Failed to inspect {}: {error}", path.display()),
                        );
                        continue;
                    }
                };

                if metadata.file_type().is_symlink() {
                    continue;
                }

                if metadata.is_dir() {
                    scanned_directory_count = scanned_directory_count.saturating_add(1);
                    if !is_same_volume(root, &path) {
                        current_directory.directory_count =
                            current_directory.directory_count.saturating_add(1);
                        continue;
                    }
                    let depth = current_directory.depth.saturating_add(1);
                    match fs::read_dir(&path) {
                        Ok(read_dir) => {
                            stack.push(PendingStorageDirectory {
                                path: path.clone(),
                                name: storage_display_name(&path),
                                depth,
                                read_dir,
                                logical_bytes: 0,
                                allocated_bytes: 0,
                                file_count: 0,
                                directory_count: 0,
                                children: Vec::new(),
                            });
                        }
                        Err(error) => {
                            current_directory.directory_count =
                                current_directory.directory_count.saturating_add(1);
                            maybe_push_scan_error(
                                &mut sample_errors,
                                &mut error_count,
                                format!("Failed to open {}: {error}", path.display()),
                            );
                        }
                    }
                    continue;
                }

                if metadata.is_file() {
                    let measurement = measure_storage_file(&path, &metadata);
                    scanned_file_count = scanned_file_count.saturating_add(1);
                    total_logical_bytes =
                        total_logical_bytes.saturating_add(measurement.logical_bytes);
                    total_allocated_bytes =
                        total_allocated_bytes.saturating_add(measurement.allocated_bytes);
                    current_directory.logical_bytes = current_directory
                        .logical_bytes
                        .saturating_add(measurement.logical_bytes);
                    current_directory.allocated_bytes = current_directory
                        .allocated_bytes
                        .saturating_add(measurement.allocated_bytes);
                    current_directory.file_count = current_directory.file_count.saturating_add(1);

                    let file_summary = make_storage_path_summary(
                        path.to_string_lossy().to_string(),
                        storage_display_name(&path),
                        StorageNodeKind::File,
                        measurement.logical_bytes,
                        measurement.allocated_bytes,
                        1,
                        0,
                        path_depth(root, &path),
                        measurement.extension.clone(),
                    );
                    current_directory.children.push(file_summary.clone());
                    update_storage_type_bucket(&mut type_buckets, &file_summary);

                    let file_candidate = StorageFileCandidate {
                        path: path.clone(),
                        name: file_summary.name.clone(),
                        logical_bytes: measurement.logical_bytes,
                        allocated_bytes: measurement.allocated_bytes,
                        depth: file_summary.depth,
                        extension: measurement.extension,
                    };
                    if push_top_file_candidate(
                        &mut top_files,
                        file_candidate,
                        STORAGE_SCAN_TOP_FILE_LIMIT,
                    ) {
                        insert_required_ancestor_paths(&mut required_directory_paths, &stack, None);
                    }
                }
            }
            Some(Err(error)) => {
                processed_entries_since_flush = processed_entries_since_flush.saturating_add(1);
                maybe_push_scan_error(
                    &mut sample_errors,
                    &mut error_count,
                    format!(
                        "Failed to read {}: {error}",
                        current_directory.path.display()
                    ),
                );
            }
            None => {
                processed_entries_since_flush = processed_entries_since_flush.saturating_add(1);
                let mut finished_directory = stack
                    .pop()
                    .ok_or_else(|| "Storage scan stack underflowed unexpectedly.".to_string())?;

                sort_storage_path_summaries(&mut finished_directory.children);
                let summary = StorageDirectorySummary {
                    path: finished_directory.path.clone(),
                    name: finished_directory.name.clone(),
                    logical_bytes: finished_directory.logical_bytes,
                    allocated_bytes: finished_directory.allocated_bytes,
                    file_count: finished_directory.file_count,
                    directory_count: finished_directory.directory_count,
                    depth: finished_directory.depth,
                };

                directory_entries.insert(
                    summary.path.to_string_lossy().to_string(),
                    finished_directory.children.clone(),
                );

                if summary.depth > 0
                    && (summary.allocated_bytes > 0 || summary.logical_bytes > 0)
                    && push_top_directory_candidate(
                        &mut top_directories,
                        summary.clone(),
                        STORAGE_SCAN_TOP_DIRECTORY_LIMIT,
                    )
                {
                    insert_required_ancestor_paths(
                        &mut required_directory_paths,
                        &stack,
                        Some(&summary.path),
                    );
                }

                if required_directory_paths.contains(&summary.path) {
                    required_directory_summaries.insert(summary.path.clone(), summary.clone());
                }

                if let Some(parent) = stack.last_mut() {
                    parent.logical_bytes =
                        parent.logical_bytes.saturating_add(summary.logical_bytes);
                    parent.allocated_bytes = parent
                        .allocated_bytes
                        .saturating_add(summary.allocated_bytes);
                    parent.file_count = parent.file_count.saturating_add(summary.file_count);
                    parent.directory_count = parent
                        .directory_count
                        .saturating_add(summary.directory_count)
                        .saturating_add(1);
                    parent.children.push(summary.to_path_summary());
                } else {
                    root_summary = Some(summary);
                }
            }
        }
    }

    let root_summary = root_summary.ok_or_else(|| {
        format!(
            "Storage scan did not produce a root summary for {}",
            root.display()
        )
    })?;
    required_directory_summaries.insert(root.to_path_buf(), root_summary.clone());

    let top_files = collect_sorted_files(top_files);
    let top_directories = collect_sorted_directories(top_directories);
    build_storage_snapshot(
        root,
        &root_summary,
        &required_directory_summaries,
        &top_directories,
        &top_files,
        finalize_storage_type_buckets(type_buckets),
        directory_entries,
        scanned_file_count,
        scanned_directory_count,
        total_logical_bytes,
        total_allocated_bytes,
        error_count,
        &sample_errors,
    )
    .map(Some)
}

fn run_storage_scan(progress: Arc<Mutex<StorageScanProgress>>) {
    let root_path = match progress.lock() {
        Ok(state) => state.root_path.clone(),
        Err(_) => return,
    };
    let root = PathBuf::from(&root_path);

    let result = scan_storage_root(&root, &progress);
    let mut state = match progress.lock() {
        Ok(guard) => guard,
        Err(_) => return,
    };
    match result {
        Ok(Some(snapshot)) => {
            state.scanned_file_count = snapshot.scanned_file_count;
            state.scanned_directory_count = snapshot.scanned_directory_count;
            state.total_logical_bytes = snapshot.total_logical_bytes;
            state.total_allocated_bytes = snapshot.total_allocated_bytes;
            state.error_count = snapshot.error_count;
            state.sample_errors = snapshot.sample_errors;
            state.tree = Some(snapshot.tree);
            state.largest_entries = snapshot.largest_entries;
            state.type_buckets = snapshot.type_buckets;
            state.directory_entries = snapshot.directory_entries;
        }
        Ok(None) => {}
        Err(error) => {
            state.error = Some(error);
        }
    }
    state.current_path = None;
    state.completed = true;
}

#[tauri::command]
#[specta::specta]
pub async fn storage_scan_start(root_path: String) -> Result<StorageScanStartResponse, String> {
    let normalized_root = normalize_storage_scan_root(&root_path);
    if normalized_root.is_empty() {
        return Err("Storage scan root path cannot be empty.".to_string());
    }

    let root = PathBuf::from(&normalized_root);
    let scan_id = Uuid::new_v4().to_string();
    let progress = Arc::new(Mutex::new(StorageScanProgress {
        root_path: normalized_root.clone(),
        root_name: storage_display_name(&root),
        scanned_file_count: 0,
        scanned_directory_count: 0,
        total_logical_bytes: 0,
        total_allocated_bytes: 0,
        error_count: 0,
        sample_errors: Vec::new(),
        completed: false,
        cancelled: false,
        error: None,
        current_path: None,
        tree: None,
        largest_entries: Vec::new(),
        type_buckets: Vec::new(),
        directory_entries: HashMap::new(),
        started_at: Instant::now(),
    }));

    let mut registry = storage_scan_registry()
        .lock()
        .map_err(|_| "Storage scan registry lock was poisoned.".to_string())?;
    prune_completed_storage_scans(&mut registry);
    registry.insert(scan_id.clone(), progress.clone());

    thread::spawn(move || run_storage_scan(progress));

    Ok(StorageScanStartResponse { scan_id })
}

#[tauri::command]
#[specta::specta]
pub async fn storage_scan_poll(scan_id: String) -> Result<StorageScanStatus, String> {
    let registry = storage_scan_registry()
        .lock()
        .map_err(|_| "Storage scan registry lock was poisoned.".to_string())?;
    let progress = registry
        .get(&scan_id)
        .ok_or_else(|| format!("Storage scan not found: {scan_id}"))?;
    let state = progress
        .lock()
        .map_err(|_| "Storage scan progress lock was poisoned.".to_string())?;
    Ok(state.into_status(scan_id))
}

#[tauri::command]
#[specta::specta]
pub async fn storage_scan_list_directory(
    scan_id: String,
    directory_path: String,
) -> Result<Vec<StoragePathSummary>, String> {
    let normalized_path = normalize_storage_lookup_path(&directory_path);
    if normalized_path.is_empty() {
        return Err("Storage directory path cannot be empty.".to_string());
    }

    let registry = storage_scan_registry()
        .lock()
        .map_err(|_| "Storage scan registry lock was poisoned.".to_string())?;
    let progress = registry
        .get(&scan_id)
        .ok_or_else(|| format!("Storage scan not found: {scan_id}"))?;
    let state = progress
        .lock()
        .map_err(|_| "Storage scan progress lock was poisoned.".to_string())?;
    let entries = state
        .directory_entries
        .get(&normalized_path)
        .cloned()
        .ok_or_else(|| format!("Storage directory listing not found: {normalized_path}"))?;
    Ok(entries)
}

#[tauri::command]
#[specta::specta]
pub async fn storage_scan_cancel(scan_id: String) -> Result<(), String> {
    let registry = storage_scan_registry()
        .lock()
        .map_err(|_| "Storage scan registry lock was poisoned.".to_string())?;
    let progress = registry
        .get(&scan_id)
        .ok_or_else(|| format!("Storage scan not found: {scan_id}"))?;
    let mut state = progress
        .lock()
        .map_err(|_| "Storage scan progress lock was poisoned.".to_string())?;
    state.cancelled = true;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn write_test_file(path: &Path, size: usize) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).expect("failed to create test parent directory");
        }
        let mut file = fs::File::create(path).expect("failed to create test file");
        file.write_all(&vec![b'x'; size])
            .expect("failed to write test file");
    }

    fn create_test_progress(root: &Path) -> Arc<Mutex<StorageScanProgress>> {
        Arc::new(Mutex::new(StorageScanProgress {
            root_path: root.to_string_lossy().to_string(),
            root_name: storage_display_name(root),
            scanned_file_count: 0,
            scanned_directory_count: 0,
            total_logical_bytes: 0,
            total_allocated_bytes: 0,
            error_count: 0,
            sample_errors: Vec::new(),
            completed: false,
            cancelled: false,
            error: None,
            current_path: None,
            tree: None,
            largest_entries: Vec::new(),
            type_buckets: Vec::new(),
            directory_entries: HashMap::new(),
            started_at: Instant::now(),
        }))
    }

    fn find_child<'a>(node: &'a StorageTreeNode, name: &str) -> &'a StorageTreeNode {
        node.children
            .iter()
            .find(|child| child.name == name)
            .unwrap_or_else(|| panic!("expected child named {name}"))
    }

    #[test]
    fn storage_scan_builds_a_condensed_tree_and_largest_entries() {
        let temp = tempfile::tempdir().expect("failed to create tempdir");
        let root = temp.path();
        write_test_file(&root.join("root-file.bin"), 32);
        write_test_file(&root.join("Projects").join("alpha.bin"), 96);
        write_test_file(&root.join("Projects").join("nested").join("beta.bin"), 48);
        write_test_file(
            &root.join("Windows").join("System32").join("kernel.dll"),
            128,
        );
        fs::create_dir_all(root.join("EmptyFolder")).expect("failed to create empty folder");

        let progress = create_test_progress(root);
        let snapshot = scan_storage_root(root, &progress)
            .expect("storage scan failed")
            .expect("storage scan should complete");

        assert_eq!(snapshot.total_logical_bytes, 304);
        assert_eq!(snapshot.scanned_file_count, 4);
        assert_eq!(snapshot.scanned_directory_count, 5);
        assert!(snapshot.largest_entries.iter().any(|entry| {
            entry.path.ends_with("Windows\\System32\\kernel.dll")
                || entry.path.ends_with("Windows/System32/kernel.dll")
        }));

        let tree = snapshot.tree;
        let windows = find_child(&tree, "Windows");
        assert_eq!(windows.logical_bytes, 128);
        let projects = find_child(&tree, "Projects");
        assert_eq!(projects.logical_bytes, 144);
        let root_file = find_child(&tree, "root-file.bin");
        assert_eq!(root_file.logical_bytes, 32);
        let other = find_child(&tree, "Other");
        assert!(other.directory_count >= 1);
    }

    #[test]
    fn storage_scan_records_type_buckets_and_directory_entries() {
        let temp = tempfile::tempdir().expect("failed to create tempdir");
        let root = temp.path();
        write_test_file(&root.join("alpha.dll"), 64);
        write_test_file(&root.join("beta.dll"), 96);
        write_test_file(&root.join("gamma.bin"), 128);
        write_test_file(&root.join("Nested").join("delta.dll"), 32);

        let progress = create_test_progress(root);
        let snapshot = scan_storage_root(root, &progress)
            .expect("storage scan failed")
            .expect("storage scan should complete");

        let dll_bucket = snapshot
            .type_buckets
            .iter()
            .find(|bucket| bucket.id == "dll")
            .expect("expected dll bucket");
        assert_eq!(dll_bucket.file_count, 3);
        assert_eq!(dll_bucket.logical_bytes, 192);
        assert!(dll_bucket.largest_entries[0].name.ends_with("beta.dll"));

        let root_entries = snapshot
            .directory_entries
            .get(&root.to_string_lossy().to_string())
            .expect("expected root directory entries");
        assert!(root_entries.iter().any(|entry| entry.name == "Nested"));
        assert!(root_entries.iter().any(|entry| entry.name == "gamma.bin"));
    }

    #[test]
    fn storage_scan_cancel_stops_before_completion() {
        let temp = tempfile::tempdir().expect("failed to create tempdir");
        let root = temp.path();
        for index in 0..256 {
            write_test_file(&root.join(format!("chunk-{index}.bin")), 4 * 1024);
        }

        let progress = create_test_progress(root);
        {
            let mut state = progress.lock().expect("progress lock poisoned");
            state.cancelled = true;
        }

        let snapshot = scan_storage_root(root, &progress).expect("storage scan failed");
        assert!(snapshot.is_none());
    }
}
