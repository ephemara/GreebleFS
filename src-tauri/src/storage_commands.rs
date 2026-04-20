use serde::{Deserialize, Serialize};
use std::cmp::Reverse;
use std::collections::{BinaryHeap, HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use std::time::{Duration, Instant};
use uuid::Uuid;

const STORAGE_SCAN_TOP_FILE_LIMIT: usize = 192;
const STORAGE_SCAN_TOP_DIRECTORY_LIMIT: usize = 160;
const STORAGE_SCAN_LARGEST_ENTRY_LIMIT: usize = 96;
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
    pub bytes: u64,
    pub file_count: u64,
    pub directory_count: u64,
    pub depth: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct StorageTreeNode {
    pub path: String,
    pub name: String,
    pub kind: StorageNodeKind,
    pub bytes: u64,
    pub file_count: u64,
    pub directory_count: u64,
    pub children: Vec<StorageTreeNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct StorageScanStatus {
    pub scan_id: String,
    pub root_path: String,
    pub root_name: String,
    pub scanned_file_count: u64,
    pub scanned_directory_count: u64,
    pub total_bytes: u64,
    pub error_count: u64,
    pub sample_errors: Vec<String>,
    pub completed: bool,
    pub cancelled: bool,
    pub error: Option<String>,
    pub current_path: Option<String>,
    pub elapsed_ms: u64,
    pub tree: Option<StorageTreeNode>,
    pub largest_entries: Vec<StoragePathSummary>,
}

#[derive(Debug)]
struct StorageScanProgress {
    root_path: String,
    root_name: String,
    scanned_file_count: u64,
    scanned_directory_count: u64,
    total_bytes: u64,
    error_count: u64,
    sample_errors: Vec<String>,
    completed: bool,
    cancelled: bool,
    error: Option<String>,
    current_path: Option<String>,
    tree: Option<StorageTreeNode>,
    largest_entries: Vec<StoragePathSummary>,
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
            total_bytes: self.total_bytes,
            error_count: self.error_count,
            sample_errors: self.sample_errors.clone(),
            completed: self.completed,
            cancelled: self.cancelled,
            error: self.error.clone(),
            current_path: self.current_path.clone(),
            elapsed_ms: self.started_at.elapsed().as_millis() as u64,
            tree: self.tree.clone(),
            largest_entries: self.largest_entries.clone(),
        }
    }
}

#[derive(Debug)]
struct PendingStorageDirectory {
    path: PathBuf,
    name: String,
    depth: u32,
    read_dir: fs::ReadDir,
    bytes: u64,
    file_count: u64,
    directory_count: u64,
}

#[derive(Debug, Clone, Eq, PartialEq)]
struct StorageFileCandidate {
    path: PathBuf,
    name: String,
    bytes: u64,
    depth: u32,
}

impl Ord for StorageFileCandidate {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        self.bytes
            .cmp(&other.bytes)
            .then_with(|| self.path.cmp(&other.path))
    }
}

impl PartialOrd for StorageFileCandidate {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

#[derive(Debug, Clone, Eq, PartialEq)]
struct StorageDirectorySummary {
    path: PathBuf,
    name: String,
    bytes: u64,
    file_count: u64,
    directory_count: u64,
    depth: u32,
}

impl Ord for StorageDirectorySummary {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        self.bytes
            .cmp(&other.bytes)
            .then_with(|| self.path.cmp(&other.path))
    }
}

impl PartialOrd for StorageDirectorySummary {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

#[derive(Debug)]
struct StorageScanCompletedSnapshot {
    tree: StorageTreeNode,
    largest_entries: Vec<StoragePathSummary>,
    scanned_file_count: u64,
    scanned_directory_count: u64,
    total_bytes: u64,
    error_count: u64,
    sample_errors: Vec<String>,
}

fn storage_scan_registry() -> &'static Mutex<HashMap<String, Arc<Mutex<StorageScanProgress>>>> {
    STORAGE_SCAN_REGISTRY.get_or_init(|| Mutex::new(HashMap::new()))
}

fn prune_completed_storage_scans(
    registry: &mut HashMap<String, Arc<Mutex<StorageScanProgress>>>,
) {
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
    total_bytes: u64,
    error_count: u64,
    sample_errors: &[String],
    current_path: Option<&Path>,
) -> Result<bool, String> {
    let mut state = progress
        .lock()
        .map_err(|_| "Storage scan progress lock was poisoned.".to_string())?;
    state.scanned_file_count = scanned_file_count;
    state.scanned_directory_count = scanned_directory_count;
    state.total_bytes = total_bytes;
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

fn build_storage_snapshot(
    root: &Path,
    root_summary: &StorageDirectorySummary,
    required_directory_summaries: &HashMap<PathBuf, StorageDirectorySummary>,
    top_directories: &[StorageDirectorySummary],
    top_files: &[StorageFileCandidate],
    scanned_file_count: u64,
    scanned_directory_count: u64,
    total_bytes: u64,
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
        .map(|file| {
            (
                file.path.clone(),
                StoragePathSummary {
                    path: file.path.to_string_lossy().to_string(),
                    name: file.name.clone(),
                    kind: StorageNodeKind::File,
                    bytes: file.bytes,
                    file_count: 1,
                    directory_count: 0,
                    depth: file.depth,
                },
            )
        })
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
                bytes: summary.bytes,
                file_count: summary.file_count,
                directory_count: summary.directory_count,
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
                .bytes
                .cmp(&left.bytes)
                .then_with(|| left.name.cmp(&right.name))
        });

        let visible_bytes = children.iter().map(|child| child.bytes).sum::<u64>();
        let visible_file_count = children.iter().map(|child| child.file_count).sum::<u64>();
        let visible_directory_count = children
            .iter()
            .map(visible_directory_contribution)
            .sum::<u64>();
        let remaining_bytes = summary.bytes.saturating_sub(visible_bytes);
        let remaining_file_count = summary.file_count.saturating_sub(visible_file_count);
        let remaining_directory_count = summary
            .directory_count
            .saturating_sub(visible_directory_count);
        if remaining_bytes > 0 || remaining_file_count > 0 || remaining_directory_count > 0 {
            children.push(StorageTreeNode {
                path: format!("{}::other", summary.path.to_string_lossy()),
                name: "Other".to_string(),
                kind: StorageNodeKind::Other,
                bytes: remaining_bytes,
                file_count: remaining_file_count,
                directory_count: remaining_directory_count,
                children: Vec::new(),
            });
            children.sort_by(|left, right| {
                right
                    .bytes
                    .cmp(&left.bytes)
                    .then_with(|| left.name.cmp(&right.name))
            });
        }

        Ok(StorageTreeNode {
            path: summary.path.to_string_lossy().to_string(),
            name: summary.name.clone(),
            kind: StorageNodeKind::Directory,
            bytes: summary.bytes,
            file_count: summary.file_count,
            directory_count: summary.directory_count,
            children,
        })
    }

    let mut largest_entries = top_directories
        .iter()
        .map(|directory| StoragePathSummary {
            path: directory.path.to_string_lossy().to_string(),
            name: directory.name.clone(),
            kind: StorageNodeKind::Directory,
            bytes: directory.bytes,
            file_count: directory.file_count,
            directory_count: directory.directory_count,
            depth: directory.depth,
        })
        .chain(top_files.iter().map(|file| StoragePathSummary {
            path: file.path.to_string_lossy().to_string(),
            name: file.name.clone(),
            kind: StorageNodeKind::File,
            bytes: file.bytes,
            file_count: 1,
            directory_count: 0,
            depth: file.depth,
        }))
        .collect::<Vec<_>>();

    largest_entries.sort_by(|left, right| {
        right
            .bytes
            .cmp(&left.bytes)
            .then_with(|| left.path.cmp(&right.path))
    });
    largest_entries.truncate(STORAGE_SCAN_LARGEST_ENTRY_LIMIT);

    Ok(StorageScanCompletedSnapshot {
        tree: build_tree_node(
            root,
            &selected_directory_summaries,
            &selected_file_summaries,
            &children_by_parent,
        )?,
        largest_entries,
        scanned_file_count,
        scanned_directory_count,
        total_bytes,
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
        bytes: 0,
        file_count: 0,
        directory_count: 0,
    }];
    let mut top_files = BinaryHeap::<Reverse<StorageFileCandidate>>::new();
    let mut top_directories = BinaryHeap::<Reverse<StorageDirectorySummary>>::new();
    let mut required_directory_paths = HashSet::from([root.to_path_buf()]);
    let mut required_directory_summaries = HashMap::<PathBuf, StorageDirectorySummary>::new();
    let mut scanned_file_count = 0_u64;
    let mut scanned_directory_count = 0_u64;
    let mut total_bytes = 0_u64;
    let mut error_count = 0_u64;
    let mut sample_errors = Vec::<String>::new();
    let mut current_path: Option<PathBuf> = None;
    let mut processed_entries_since_flush = 0_u64;
    let mut last_flush = Instant::now();
    let mut root_summary: Option<StorageDirectorySummary> = None;

    loop {
        let should_flush = processed_entries_since_flush >= STORAGE_SCAN_PROGRESS_FLUSH_ENTRY_INTERVAL
            || last_flush.elapsed() >= STORAGE_SCAN_PROGRESS_FLUSH_INTERVAL;
        if should_flush {
            let cancelled = flush_storage_scan_progress(
                progress,
                scanned_file_count,
                scanned_directory_count,
                total_bytes,
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
                    let depth = current_directory.depth.saturating_add(1);
                    match fs::read_dir(&path) {
                        Ok(read_dir) => {
                            stack.push(PendingStorageDirectory {
                                path: path.clone(),
                                name: storage_display_name(&path),
                                depth,
                                read_dir,
                                bytes: 0,
                                file_count: 0,
                                directory_count: 0,
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
                    let bytes = metadata.len();
                    scanned_file_count = scanned_file_count.saturating_add(1);
                    total_bytes = total_bytes.saturating_add(bytes);
                    current_directory.bytes = current_directory.bytes.saturating_add(bytes);
                    current_directory.file_count = current_directory.file_count.saturating_add(1);

                    let file_candidate = StorageFileCandidate {
                        path: path.clone(),
                        name: storage_display_name(&path),
                        bytes,
                        depth: path_depth(root, &path),
                    };
                    if push_top_file_candidate(
                        &mut top_files,
                        file_candidate,
                        STORAGE_SCAN_TOP_FILE_LIMIT,
                    ) {
                        insert_required_ancestor_paths(
                            &mut required_directory_paths,
                            &stack,
                            None,
                        );
                    }
                }
            }
            Some(Err(error)) => {
                processed_entries_since_flush = processed_entries_since_flush.saturating_add(1);
                maybe_push_scan_error(
                    &mut sample_errors,
                    &mut error_count,
                    format!("Failed to read {}: {error}", current_directory.path.display()),
                );
            }
            None => {
                processed_entries_since_flush = processed_entries_since_flush.saturating_add(1);
                let finished_directory = stack
                    .pop()
                    .ok_or_else(|| "Storage scan stack underflowed unexpectedly.".to_string())?;
                let summary = StorageDirectorySummary {
                    path: finished_directory.path.clone(),
                    name: finished_directory.name.clone(),
                    bytes: finished_directory.bytes,
                    file_count: finished_directory.file_count,
                    directory_count: finished_directory.directory_count,
                    depth: finished_directory.depth,
                };

                if summary.depth > 0
                    && summary.bytes > 0
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
                    parent.bytes = parent.bytes.saturating_add(summary.bytes);
                    parent.file_count = parent.file_count.saturating_add(summary.file_count);
                    parent.directory_count = parent
                        .directory_count
                        .saturating_add(summary.directory_count)
                        .saturating_add(1);
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
        scanned_file_count,
        scanned_directory_count,
        total_bytes,
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
            state.total_bytes = snapshot.total_bytes;
            state.error_count = snapshot.error_count;
            state.sample_errors = snapshot.sample_errors;
            state.tree = Some(snapshot.tree);
            state.largest_entries = snapshot.largest_entries;
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
        total_bytes: 0,
        error_count: 0,
        sample_errors: Vec::new(),
        completed: false,
        cancelled: false,
        error: None,
        current_path: None,
        tree: None,
        largest_entries: Vec::new(),
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
            total_bytes: 0,
            error_count: 0,
            sample_errors: Vec::new(),
            completed: false,
            cancelled: false,
            error: None,
            current_path: None,
            tree: None,
            largest_entries: Vec::new(),
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
        write_test_file(&root.join("Windows").join("System32").join("kernel.bin"), 128);
        fs::create_dir_all(root.join("EmptyFolder")).expect("failed to create empty folder");

        let progress = create_test_progress(root);
        let snapshot = scan_storage_root(root, &progress)
            .expect("storage scan failed")
            .expect("storage scan should complete");

        assert_eq!(snapshot.total_bytes, 304);
        assert_eq!(snapshot.scanned_file_count, 4);
        assert_eq!(snapshot.scanned_directory_count, 5);
        assert!(snapshot.largest_entries.iter().any(|entry| {
            entry.path.ends_with("Windows\\System32\\kernel.bin")
                || entry.path.ends_with("Windows/System32/kernel.bin")
        }));

        let tree = snapshot.tree;
        let windows = find_child(&tree, "Windows");
        assert_eq!(windows.bytes, 128);
        let projects = find_child(&tree, "Projects");
        assert_eq!(projects.bytes, 144);
        let root_file = find_child(&tree, "root-file.bin");
        assert_eq!(root_file.bytes, 32);
        let other = find_child(&tree, "Other");
        assert!(other.directory_count >= 1);
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
