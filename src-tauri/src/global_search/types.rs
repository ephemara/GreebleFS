use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct GlobalSearchScanSettings {
    pub scan_depth: usize,
    pub ignored_paths: Vec<String>,
    pub drive_roots: Vec<String>,
    pub parallel_scan: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct GlobalSearchDriveScanError {
    pub drive_root: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct GlobalSearchQueryOptions {
    pub limit: usize,
    pub include_files: bool,
    pub include_directories: bool,
    pub exact_match: bool,
    pub typo_tolerance: bool,
    pub min_score_threshold: Option<f32>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, specta::Type, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum GlobalSearchIndexSortKey {
    Relevance,
    ModifiedTime,
    Name,
    Path,
    Size,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, specta::Type, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum GlobalSearchIndexSortDirection {
    Asc,
    Desc,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct GlobalSearchIndexQueryRequest {
    pub query: Option<String>,
    pub limit: usize,
    pub offset: usize,
    pub include_files: bool,
    pub include_directories: bool,
    pub include_hidden: bool,
    pub extensions: Vec<String>,
    pub root_paths: Vec<String>,
    pub exact_match: bool,
    pub typo_tolerance: bool,
    pub min_score_threshold: Option<f32>,
    pub sort_key: Option<GlobalSearchIndexSortKey>,
    pub sort_direction: Option<GlobalSearchIndexSortDirection>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct GlobalSearchResultEntry {
    pub name: String,
    pub extension: Option<String>,
    pub path: String,
    pub size: u64,
    pub modified_time: u64,
    pub accessed_time: u64,
    pub created_time: u64,
    pub is_file: bool,
    pub is_dir: bool,
    pub is_symlink: bool,
    pub is_hidden: bool,
    pub score: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct GlobalSearchStatus {
    pub is_scan_in_progress: bool,
    pub is_committing: bool,
    pub is_parallel_scan: bool,
    pub last_scan_time: Option<u64>,
    pub indexed_item_count: u64,
    pub index_size_bytes: u64,
    pub current_drive_root: Option<String>,
    pub drive_scan_errors: Vec<GlobalSearchDriveScanError>,
    pub is_index_valid: bool,
    pub scanned_drives_count: u32,
    pub total_drives_count: u32,
}
