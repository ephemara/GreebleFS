use crate::fs_commands::{
    complete_manual_explorer_task, create_manual_explorer_task,
    create_manual_explorer_task_with_id, fail_manual_explorer_task,
    invalidate_all_fs_caches_for_path, set_manual_explorer_task_cancel_context,
    set_recent_trash_task, update_manual_explorer_task, ExplorerTaskCancelContext,
    ExplorerTaskKind, ExplorerTaskRegistration, ExplorerTaskRetryContext, FileEntry,
};
use chrono::Local;
use ignore::WalkBuilder;
use md5::Context as Md5Context;
use regex::Regex;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use tauri::{AppHandle, Manager};
use uuid::Uuid;

const EXPLORER_PRO_DIRECTORY: &str = "explorer";
const EXPLORER_METADATA_FILE: &str = "metadata.json";
const EXPLORER_TRASH_DIRECTORY: &str = "trash";
const EXPLORER_METADATA_VERSION: u32 = 1;

static DUPLICATE_SCAN_REGISTRY: OnceLock<
    Mutex<HashMap<String, Arc<Mutex<ExplorerDuplicateScanProgress>>>>,
> = OnceLock::new();

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ExplorerTagRecord {
    pub id: String,
    pub label: String,
    pub color: Option<String>,
    pub path_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ExplorerPathTagAssignment {
    pub path: String,
    pub tag_ids: Vec<String>,
    pub tag_labels: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ExplorerTagSnapshot {
    pub tags: Vec<ExplorerTagRecord>,
    pub assignments: Vec<ExplorerPathTagAssignment>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "snake_case")]
pub enum ExplorerTagMutationMode {
    Add,
    Remove,
    Replace,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ExplorerTagMutationRequest {
    pub paths: Vec<String>,
    pub tag_names: Vec<String>,
    pub mode: ExplorerTagMutationMode,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ExplorerSavedSearchRecord {
    pub id: String,
    pub name: String,
    pub root_path: String,
    pub query: String,
    pub include_content: bool,
    pub tag_filter_ids: Vec<String>,
    pub created_at: u64,
    pub updated_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ExplorerSavedSearchSaveRequest {
    pub id: Option<String>,
    pub name: String,
    pub root_path: String,
    pub query: String,
    pub include_content: bool,
    pub tag_filter_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ExplorerTrashedEntryRecord {
    pub original_path: String,
    pub trash_path: String,
    pub is_dir: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ExplorerTrashActionRecord {
    pub id: String,
    pub trashed_at: u64,
    pub entries: Vec<ExplorerTrashedEntryRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ExplorerTrashRestoreResult {
    pub restored_paths: Vec<String>,
    pub missing_paths: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct FsBatchRenameItem {
    pub source_path: String,
    pub destination_path: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum FsBatchRenameMode {
    Literal,
    Regex,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct FsBatchRenameRecipe {
    pub source_paths: Vec<String>,
    pub search: String,
    pub replacement: String,
    pub prefix: String,
    pub suffix: String,
    pub mode: FsBatchRenameMode,
    pub start_index: Option<u64>,
    pub index_padding: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct FsBatchRenamePreviewRow {
    pub source_path: String,
    pub current_name: String,
    pub next_name: String,
    pub destination_path: String,
    pub collision: bool,
    pub validation_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct FsBatchRenameResult {
    pub source_path: String,
    pub destination_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ExplorerDuplicateScanStartResponse {
    pub scan_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ExplorerDuplicateGroup {
    pub file_size: u64,
    pub content_hash: String,
    pub entries: Vec<FileEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ExplorerDuplicateScanStatus {
    pub scan_id: String,
    pub root_path: String,
    pub scanned_file_count: u64,
    pub candidate_file_count: u64,
    pub completed: bool,
    pub cancelled: bool,
    pub error: Option<String>,
    pub groups: Vec<ExplorerDuplicateGroup>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExplorerTagDefinition {
    id: String,
    label: String,
    color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExplorerMetadataDocument {
    version: u32,
    tags: Vec<ExplorerTagDefinition>,
    path_tag_ids: HashMap<String, Vec<String>>,
    saved_searches: Vec<ExplorerSavedSearchRecord>,
    recent_trash_action: Option<ExplorerTrashActionRecord>,
}

impl Default for ExplorerMetadataDocument {
    fn default() -> Self {
        Self {
            version: EXPLORER_METADATA_VERSION,
            tags: Vec::new(),
            path_tag_ids: HashMap::new(),
            saved_searches: Vec::new(),
            recent_trash_action: None,
        }
    }
}

#[derive(Debug)]
struct ExplorerDuplicateScanProgress {
    root_path: String,
    scanned_file_count: u64,
    candidate_file_count: u64,
    completed: bool,
    cancelled: bool,
    error: Option<String>,
    groups: Vec<ExplorerDuplicateGroup>,
}

impl ExplorerDuplicateScanProgress {
    fn into_status(&self, scan_id: String) -> ExplorerDuplicateScanStatus {
        ExplorerDuplicateScanStatus {
            scan_id,
            root_path: self.root_path.clone(),
            scanned_file_count: self.scanned_file_count,
            candidate_file_count: self.candidate_file_count,
            completed: self.completed,
            cancelled: self.cancelled,
            error: self.error.clone(),
            groups: self.groups.clone(),
        }
    }
}

fn duplicate_scan_registry(
) -> &'static Mutex<HashMap<String, Arc<Mutex<ExplorerDuplicateScanProgress>>>> {
    DUPLICATE_SCAN_REGISTRY.get_or_init(|| Mutex::new(HashMap::new()))
}

fn explorer_data_root(app: &AppHandle) -> Result<PathBuf, String> {
    let root = app
        .path()
        .app_local_data_dir()
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))?
        .join(EXPLORER_PRO_DIRECTORY);
    fs::create_dir_all(&root)
        .map_err(|error| format!("Failed to create explorer metadata directory: {error}"))?;
    Ok(root)
}

fn explorer_metadata_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(explorer_data_root(app)?.join(EXPLORER_METADATA_FILE))
}

fn explorer_trash_root(app: &AppHandle) -> Result<PathBuf, String> {
    let root = explorer_data_root(app)?.join(EXPLORER_TRASH_DIRECTORY);
    fs::create_dir_all(&root)
        .map_err(|error| format!("Failed to create explorer trash directory: {error}"))?;
    Ok(root)
}

fn read_explorer_metadata(app: &AppHandle) -> Result<ExplorerMetadataDocument, String> {
    let metadata_path = explorer_metadata_path(app)?;
    if !metadata_path.exists() {
        return Ok(ExplorerMetadataDocument::default());
    }

    let source = fs::read_to_string(&metadata_path)
        .map_err(|error| format!("Failed to read explorer metadata: {error}"))?;
    let mut document: ExplorerMetadataDocument = serde_json::from_str(&source)
        .map_err(|error| format!("Failed to decode explorer metadata: {error}"))?;
    if document.version != EXPLORER_METADATA_VERSION {
        document.version = EXPLORER_METADATA_VERSION;
    }
    Ok(document)
}

fn write_explorer_metadata(
    app: &AppHandle,
    document: &ExplorerMetadataDocument,
) -> Result<(), String> {
    let metadata_path = explorer_metadata_path(app)?;
    let parent = metadata_path
        .parent()
        .ok_or_else(|| "Explorer metadata path had no parent directory.".to_string())?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("Failed to prepare explorer metadata directory: {error}"))?;
    let serialized = serde_json::to_vec_pretty(document)
        .map_err(|error| format!("Failed to encode explorer metadata: {error}"))?;
    let mut file = fs::File::create(&metadata_path)
        .map_err(|error| format!("Failed to write explorer metadata: {error}"))?;
    file.write_all(&serialized)
        .map_err(|error| format!("Failed to flush explorer metadata: {error}"))?;
    Ok(())
}

fn now_epoch_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

fn explorer_task_registration(
    kind: ExplorerTaskKind,
    title: String,
    detail: String,
    source_paths: Vec<String>,
    destination_path: Option<String>,
    retry_context: Option<ExplorerTaskRetryContext>,
    can_undo: bool,
) -> ExplorerTaskRegistration {
    ExplorerTaskRegistration {
        kind,
        title,
        detail,
        source_paths,
        destination_path,
        retry_context,
        can_undo,
    }
}

fn duplicate_scan_task_detail(progress: &ExplorerDuplicateScanProgress) -> String {
    if let Some(error) = &progress.error {
        return error.clone();
    }
    if progress.cancelled {
        return "Cancelled".to_string();
    }
    if progress.completed {
        return format!(
            "Scanned {} files · {} duplicate groups",
            progress.scanned_file_count,
            progress.groups.len()
        );
    }
    format!(
        "Scanned {} files · {} duplicate candidates",
        progress.scanned_file_count, progress.candidate_file_count
    )
}

fn sync_duplicate_scan_task(task_id: &str, progress: &ExplorerDuplicateScanProgress) {
    let _ = update_manual_explorer_task(
        task_id,
        Some(duplicate_scan_task_detail(progress)),
        Some(progress.scanned_file_count),
        None,
    );
}

fn normalize_path_key(path: &str) -> String {
    path.trim().to_string()
}

fn normalize_tag_label(label: &str) -> String {
    label.trim().to_lowercase()
}

fn build_tag_snapshot(
    document: &ExplorerMetadataDocument,
    paths: Option<Vec<String>>,
) -> ExplorerTagSnapshot {
    let mut path_counts = HashMap::<String, u64>::new();
    for tag_ids in document.path_tag_ids.values() {
        let mut seen = HashSet::new();
        for tag_id in tag_ids {
            if seen.insert(tag_id) {
                *path_counts.entry(tag_id.clone()).or_insert(0) += 1;
            }
        }
    }

    let mut tags = document
        .tags
        .iter()
        .map(|tag| ExplorerTagRecord {
            id: tag.id.clone(),
            label: tag.label.clone(),
            color: tag.color.clone(),
            path_count: path_counts.get(&tag.id).copied().unwrap_or(0),
        })
        .collect::<Vec<_>>();
    tags.sort_by(|left, right| left.label.to_lowercase().cmp(&right.label.to_lowercase()));

    let requested_paths = paths.unwrap_or_default();
    let assignments = requested_paths
        .into_iter()
        .map(|path| {
            let tag_ids = document
                .path_tag_ids
                .get(&normalize_path_key(&path))
                .cloned()
                .unwrap_or_default();
            let tag_labels = tag_ids
                .iter()
                .filter_map(|tag_id| document.tags.iter().find(|tag| tag.id == *tag_id))
                .map(|tag| tag.label.clone())
                .collect::<Vec<_>>();
            ExplorerPathTagAssignment {
                path,
                tag_ids,
                tag_labels,
            }
        })
        .collect();

    ExplorerTagSnapshot { tags, assignments }
}

fn ensure_tag_id(document: &mut ExplorerMetadataDocument, raw_label: &str) -> Option<String> {
    let label = raw_label.trim();
    if label.is_empty() {
        return None;
    }

    let normalized = normalize_tag_label(label);
    if let Some(existing) = document
        .tags
        .iter()
        .find(|tag| normalize_tag_label(&tag.label) == normalized)
    {
        return Some(existing.id.clone());
    }

    let next = ExplorerTagDefinition {
        id: Uuid::new_v4().to_string(),
        label: label.to_string(),
        color: None,
    };
    let id = next.id.clone();
    document.tags.push(next);
    Some(id)
}

fn unique_path_in_directory(directory: &Path, preferred_name: &str) -> PathBuf {
    let candidate = directory.join(preferred_name);
    if !candidate.exists() {
        return candidate;
    }

    let preferred_path = PathBuf::from(preferred_name);
    let stem = preferred_path
        .file_stem()
        .map(|value| value.to_string_lossy().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| preferred_name.to_string());
    let extension = preferred_path
        .extension()
        .map(|value| value.to_string_lossy().to_string());

    for index in 2..10_000 {
        let file_name = match &extension {
            Some(extension) if !extension.is_empty() => format!("{stem}-{index}.{extension}"),
            _ => format!("{stem}-{index}"),
        };
        let next = directory.join(file_name);
        if !next.exists() {
            return next;
        }
    }

    directory.join(format!("{}-{}", Uuid::new_v4(), preferred_name))
}

fn batch_rename_split_name(name: &str) -> (String, String) {
    let path = Path::new(name);
    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or(name)
        .to_string();
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_string();
    (stem, extension)
}

fn batch_rename_parent_label(path: &Path) -> String {
    path.parent()
        .and_then(|parent| parent.file_name())
        .and_then(|name| name.to_str())
        .unwrap_or("")
        .to_string()
}

fn batch_rename_token_date() -> String {
    Local::now().format("%Y-%m-%d").to_string()
}

fn batch_rename_expand_tokens(template: &str, index: u64, parent: &str, padding: u32) -> String {
    let index_text = if padding == 0 {
        index.to_string()
    } else {
        format!("{index:0width$}", width = padding as usize)
    };
    let date_text = batch_rename_token_date();

    let mut rendered = template.replace("{{date}}", &date_text);
    rendered = rendered.replace("{{parent}}", parent);
    rendered = rendered.replace("{{index}}", &index_text);
    rendered
}

fn batch_rename_expand_capture_template(template: &str, captures: &regex::Captures<'_>) -> String {
    let mut rendered = String::with_capacity(template.len());
    let mut chars = template.chars().peekable();

    while let Some(character) = chars.next() {
        if character != '$' {
            rendered.push(character);
            continue;
        }

        match chars.peek().copied() {
            Some('$') => {
                rendered.push('$');
                chars.next();
            }
            Some('{') => {
                chars.next();
                let mut name = String::new();
                while let Some(next) = chars.next() {
                    if next == '}' {
                        break;
                    }
                    name.push(next);
                }
                if !name.is_empty() {
                    if let Some(value) = captures.name(&name) {
                        rendered.push_str(value.as_str());
                    }
                }
            }
            Some(next) if next.is_ascii_digit() => {
                let mut digits = String::new();
                while let Some(next) = chars.peek().copied() {
                    if next.is_ascii_digit() {
                        digits.push(next);
                        chars.next();
                    } else {
                        break;
                    }
                }
                if let Ok(index) = digits.parse::<usize>() {
                    if let Some(value) = captures.get(index) {
                        rendered.push_str(value.as_str());
                    }
                }
            }
            _ => rendered.push('$'),
        }
    }

    rendered
}

fn batch_rename_apply_pattern(stem: &str, recipe: &FsBatchRenameRecipe) -> Result<String, String> {
    let search = recipe.search.clone();
    if search.trim().is_empty() {
        return Ok(stem.to_string());
    }

    let compiled = match recipe.mode {
        FsBatchRenameMode::Literal => Regex::new(&regex::escape(&search))
            .map_err(|error| format!("Failed to prepare literal rename matcher: {error}"))?,
        FsBatchRenameMode::Regex => {
            Regex::new(&search).map_err(|error| format!("Invalid rename regex: {error}"))?
        }
    };

    let replaced = match recipe.mode {
        FsBatchRenameMode::Literal => compiled
            .replace_all(stem, |_captures: &regex::Captures<'_>| {
                recipe.replacement.clone()
            })
            .to_string(),
        FsBatchRenameMode::Regex => compiled
            .replace_all(stem, |captures: &regex::Captures<'_>| {
                batch_rename_expand_capture_template(&recipe.replacement, captures)
            })
            .to_string(),
    };

    Ok(replaced)
}

fn batch_rename_preview_rows(
    recipe: &FsBatchRenameRecipe,
) -> Result<Vec<FsBatchRenamePreviewRow>, String> {
    if recipe.source_paths.is_empty() {
        return Err("Batch rename request was empty.".to_string());
    }

    let start_index = recipe.start_index.unwrap_or(1);
    let index_padding = recipe.index_padding.unwrap_or(0);
    let source_set = recipe.source_paths.iter().cloned().collect::<HashSet<_>>();
    let mut rows = Vec::with_capacity(recipe.source_paths.len());

    for (offset, source_path) in recipe.source_paths.iter().enumerate() {
        let source = PathBuf::from(source_path);
        let current_name = source
            .file_name()
            .map(|value| value.to_string_lossy().to_string())
            .unwrap_or_else(|| source_path.clone());
        let mut validation_error = None;

        if source_path.trim().is_empty() {
            validation_error = Some("Source path cannot be empty.".to_string());
        } else if !source.exists() {
            validation_error = Some(format!("Source path does not exist: {source_path}"));
        }

        let parent = source.parent().map(|path| path.to_path_buf());
        let parent_label = batch_rename_parent_label(&source);
        let (stem, extension) = batch_rename_split_name(&current_name);
        let applied_stem = if validation_error.is_none() {
            match batch_rename_apply_pattern(&stem, recipe) {
                Ok(rendered) => {
                    let rename_index = start_index + offset as u64;
                    let expanded_prefix = batch_rename_expand_tokens(
                        &recipe.prefix,
                        rename_index,
                        &parent_label,
                        index_padding,
                    );
                    let expanded_stem = batch_rename_expand_tokens(
                        &rendered,
                        rename_index,
                        &parent_label,
                        index_padding,
                    );
                    let expanded_suffix = batch_rename_expand_tokens(
                        &recipe.suffix,
                        rename_index,
                        &parent_label,
                        index_padding,
                    );
                    format!("{expanded_prefix}{expanded_stem}{expanded_suffix}")
                }
                Err(error) => {
                    validation_error = Some(error);
                    stem.clone()
                }
            }
        } else {
            stem.clone()
        };

        let next_name = if extension.is_empty() {
            applied_stem.clone()
        } else {
            format!("{applied_stem}.{extension}")
        };

        if next_name.trim().is_empty() {
            validation_error
                .get_or_insert_with(|| "Batch rename produced an empty file name.".to_string());
        }

        if next_name.contains('/') || next_name.contains('\\') {
            validation_error.get_or_insert_with(|| {
                format!("Batch rename produced an invalid file name: {next_name}")
            });
        }

        let destination_path = parent
            .as_ref()
            .map(|directory| directory.join(&next_name))
            .unwrap_or_else(|| PathBuf::from(&next_name));
        rows.push(FsBatchRenamePreviewRow {
            source_path: source_path.clone(),
            current_name,
            next_name,
            destination_path: destination_path.to_string_lossy().to_string(),
            collision: false,
            validation_error,
        });
    }

    let mut destination_counts = HashMap::<String, usize>::new();
    for row in &rows {
        *destination_counts
            .entry(row.destination_path.clone())
            .or_insert(0) += 1;
    }

    for row in rows.iter_mut() {
        let destination_exists = Path::new(&row.destination_path).exists();
        let destination_is_source = source_set.contains(&row.destination_path);
        let source_equals_destination = row.source_path == row.destination_path;
        let is_duplicate_destination = destination_counts
            .get(&row.destination_path)
            .copied()
            .unwrap_or(0)
            > 1;

        if source_equals_destination {
            row.collision = true;
            row.validation_error.get_or_insert_with(|| {
                format!(
                    "Source and destination cannot be identical: {}",
                    row.source_path
                )
            });
        }

        if is_duplicate_destination {
            row.collision = true;
            row.validation_error.get_or_insert_with(|| {
                format!(
                    "Duplicate destination path in batch rename: {}",
                    row.destination_path
                )
            });
        }

        if destination_exists && !destination_is_source && !source_equals_destination {
            row.collision = true;
            row.validation_error.get_or_insert_with(|| {
                format!("Destination already exists: {}", row.destination_path)
            });
        }
    }

    Ok(rows)
}

fn copy_path_recursive(source: &Path, destination: &Path) -> Result<(), String> {
    let metadata = fs::symlink_metadata(source)
        .map_err(|error| format!("Failed to inspect path {}: {error}", source.display()))?;

    if metadata.is_dir() {
        fs::create_dir_all(destination).map_err(|error| {
            format!(
                "Failed to create directory {} while copying {}: {error}",
                destination.display(),
                source.display()
            )
        })?;
        for entry in fs::read_dir(source)
            .map_err(|error| format!("Failed to read directory {}: {error}", source.display()))?
        {
            let entry = entry.map_err(|error| {
                format!(
                    "Failed to read directory entry {}: {error}",
                    source.display()
                )
            })?;
            let child_source = entry.path();
            let child_destination = destination.join(entry.file_name());
            copy_path_recursive(&child_source, &child_destination)?;
        }
        return Ok(());
    }

    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "Failed to prepare destination parent {}: {error}",
                parent.display()
            )
        })?;
    }

    fs::copy(source, destination).map(|_| ()).map_err(|error| {
        format!(
            "Failed to copy {} to {}: {error}",
            source.display(),
            destination.display()
        )
    })
}

fn remove_path_recursive(path: &Path) -> Result<(), String> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| format!("Failed to inspect path {}: {error}", path.display()))?;
    if metadata.is_dir() {
        fs::remove_dir_all(path)
            .map_err(|error| format!("Failed to remove directory {}: {error}", path.display()))
    } else {
        fs::remove_file(path)
            .map_err(|error| format!("Failed to remove file {}: {error}", path.display()))
    }
}

fn move_path_preserving_contents(source: &Path, destination: &Path) -> Result<(), String> {
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to create {}: {error}", parent.display()))?;
    }

    match fs::rename(source, destination) {
        Ok(()) => Ok(()),
        Err(rename_error) => {
            copy_path_recursive(source, destination)?;
            remove_path_recursive(source)?;
            if destination.exists() {
                Ok(())
            } else {
                Err(format!(
                    "Move from {} to {} failed after rename error {rename_error}",
                    source.display(),
                    destination.display()
                ))
            }
        }
    }
}

fn ensure_batch_rename_is_valid(items: &[FsBatchRenameItem]) -> Result<(), String> {
    if items.is_empty() {
        return Err("Batch rename request was empty.".to_string());
    }

    let mut seen_sources = HashSet::new();
    let mut seen_destinations = HashSet::new();

    for item in items {
        let source = PathBuf::from(&item.source_path);
        let destination = PathBuf::from(&item.destination_path);
        if !source.exists() {
            return Err(format!("Source path does not exist: {}", item.source_path));
        }
        if source == destination {
            return Err(format!(
                "Source and destination cannot be identical: {}",
                item.source_path
            ));
        }
        if !seen_sources.insert(item.source_path.clone()) {
            return Err(format!(
                "Duplicate source path in batch rename: {}",
                item.source_path
            ));
        }
        if !seen_destinations.insert(item.destination_path.clone()) {
            return Err(format!(
                "Duplicate destination path in batch rename: {}",
                item.destination_path
            ));
        }
    }

    let source_set = items
        .iter()
        .map(|item| item.source_path.clone())
        .collect::<HashSet<_>>();

    for item in items {
        let destination = PathBuf::from(&item.destination_path);
        if destination.exists() && !source_set.contains(&item.destination_path) {
            return Err(format!(
                "Destination already exists: {}",
                item.destination_path
            ));
        }
    }

    Ok(())
}

fn compute_file_hash(path: &Path) -> Result<String, String> {
    let mut file = fs::File::open(path)
        .map_err(|error| format!("Failed to open {} for hashing: {error}", path.display()))?;
    let mut buffer = [0_u8; 64 * 1024];
    let mut hasher = Sha256::new();
    loop {
        let read_count = file.read(&mut buffer).map_err(|error| {
            format!("Failed to read {} during hashing: {error}", path.display())
        })?;
        if read_count == 0 {
            break;
        }
        hasher.update(&buffer[..read_count]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

pub(crate) fn compute_file_checksums(path: &Path) -> Result<(String, String), String> {
    let mut file = fs::File::open(path)
        .map_err(|error| format!("Failed to open {} for hashing: {error}", path.display()))?;
    let mut buffer = [0_u8; 64 * 1024];
    let mut md5_hasher = Md5Context::new();
    let mut sha256_hasher = Sha256::new();
    loop {
        let read_count = file.read(&mut buffer).map_err(|error| {
            format!("Failed to read {} during hashing: {error}", path.display())
        })?;
        if read_count == 0 {
            break;
        }
        let chunk = &buffer[..read_count];
        md5_hasher.consume(chunk);
        sha256_hasher.update(chunk);
    }
    Ok((
        format!("{:x}", md5_hasher.compute()),
        format!("{:x}", sha256_hasher.finalize()),
    ))
}

fn duplicate_scan_walker(root: &Path) -> ignore::Walk {
    // Use the shared ignore walker so duplicate scans respect repo ignore rules
    // and do not waste time descending into generated or dependency trees.
    let mut builder = WalkBuilder::new(root);
    builder.standard_filters(true).require_git(false);
    builder.build()
}

fn to_file_entry(path: &Path) -> Result<FileEntry, String> {
    let metadata = fs::symlink_metadata(path).map_err(|error| {
        format!(
            "Failed to inspect duplicate candidate {}: {error}",
            path.display()
        )
    })?;
    let name = path
        .file_name()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|| path.display().to_string());
    let is_dir = metadata.is_dir();
    let modified = metadata
        .modified()
        .ok()
        .and_then(|value| value.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|value| value.as_millis() as u64)
        .unwrap_or(0);

    Ok(FileEntry {
        name,
        path: path.to_string_lossy().to_string(),
        is_dir,
        size: if is_dir { 0 } else { metadata.len() },
        modified,
        extension: path
            .extension()
            .map(|value| value.to_string_lossy().to_string())
            .unwrap_or_default(),
        is_hidden: path
            .file_name()
            .map(|value| value.to_string_lossy().starts_with('.'))
            .unwrap_or(false),
        is_symlink: metadata.file_type().is_symlink(),
    })
}

fn collect_duplicate_candidates(
    root: &Path,
    task_id: &str,
    progress: &Arc<Mutex<ExplorerDuplicateScanProgress>>,
    groups_by_size: &mut HashMap<u64, Vec<PathBuf>>,
) -> Result<(), String> {
    for result in duplicate_scan_walker(root) {
        if progress
            .lock()
            .map_err(|_| "Duplicate scan lock was poisoned.".to_string())?
            .cancelled
        {
            return Ok(());
        }

        let entry = result.map_err(|error| {
            format!(
                "Failed to walk duplicate scan tree {}: {error}",
                root.display()
            )
        })?;
        let path = entry.path().to_path_buf();
        let metadata = fs::symlink_metadata(&path).map_err(|error| {
            format!(
                "Failed to inspect duplicate scan path {}: {error}",
                path.display()
            )
        })?;

        if !metadata.is_file() {
            continue;
        }

        let size = metadata.len();
        groups_by_size.entry(size).or_default().push(path);
        let mut state = progress
            .lock()
            .map_err(|_| "Duplicate scan lock was poisoned.".to_string())?;
        state.scanned_file_count += 1;
        if state.scanned_file_count % 32 == 0 {
            sync_duplicate_scan_task(task_id, &state);
        }
        if state.cancelled {
            return Ok(());
        }
    }

    Ok(())
}

fn run_duplicate_scan(
    scan_id: String,
    root_path: String,
    progress: Arc<Mutex<ExplorerDuplicateScanProgress>>,
) {
    let root = PathBuf::from(&root_path);
    let result = (|| -> Result<(), String> {
        if !root.exists() {
            return Err(format!(
                "Duplicate scan root does not exist: {}",
                root.display()
            ));
        }
        if !root.is_dir() {
            return Err(format!(
                "Duplicate scan root is not a directory: {}",
                root.display()
            ));
        }

        let mut groups_by_size = HashMap::<u64, Vec<PathBuf>>::new();
        collect_duplicate_candidates(&root, &scan_id, &progress, &mut groups_by_size)?;

        for (size, paths) in groups_by_size
            .into_iter()
            .filter(|(_, paths)| paths.len() > 1)
        {
            {
                let mut state = progress
                    .lock()
                    .map_err(|_| "Duplicate scan lock was poisoned.".to_string())?;
                state.candidate_file_count += paths.len() as u64;
                sync_duplicate_scan_task(&scan_id, &state);
                if state.cancelled {
                    break;
                }
            }

            let mut hash_groups = HashMap::<String, Vec<FileEntry>>::new();
            for path in paths {
                {
                    let state = progress
                        .lock()
                        .map_err(|_| "Duplicate scan lock was poisoned.".to_string())?;
                    if state.cancelled {
                        break;
                    }
                }
                let hash = compute_file_hash(&path)?;
                let entry = to_file_entry(&path)?;
                hash_groups.entry(hash).or_default().push(entry);
            }

            let duplicate_groups = hash_groups
                .into_iter()
                .filter_map(|(content_hash, entries)| {
                    if entries.len() < 2 {
                        return None;
                    }
                    Some(ExplorerDuplicateGroup {
                        file_size: size,
                        content_hash,
                        entries,
                    })
                })
                .collect::<Vec<_>>();

            if duplicate_groups.is_empty() {
                continue;
            }

            let mut state = progress
                .lock()
                .map_err(|_| "Duplicate scan lock was poisoned.".to_string())?;
            state.groups.extend(duplicate_groups);
            sync_duplicate_scan_task(&scan_id, &state);
        }

        Ok(())
    })();

    let mut state = match progress.lock() {
        Ok(guard) => guard,
        Err(_) => return,
    };
    if let Err(error) = result {
        state.error = Some(error);
    }
    state.completed = true;
    sync_duplicate_scan_task(&scan_id, &state);
    if let Some(error) = state.error.clone() {
        let _ = fail_manual_explorer_task(&scan_id, error);
    } else if state.cancelled {
        let _ = crate::fs_commands::cancel_manual_explorer_task(
            &scan_id,
            Some("Cancelled".to_string()),
        );
    } else {
        let _ =
            complete_manual_explorer_task(&scan_id, Some(duplicate_scan_task_detail(&state)), None);
    }
}

#[tauri::command]
#[specta::specta]
pub async fn explorer_tags_list(
    app: AppHandle,
    paths: Option<Vec<String>>,
) -> Result<ExplorerTagSnapshot, String> {
    let document = read_explorer_metadata(&app)?;
    Ok(build_tag_snapshot(&document, paths))
}

#[tauri::command]
#[specta::specta]
pub async fn explorer_tags_set_for_paths(
    app: AppHandle,
    request: ExplorerTagMutationRequest,
) -> Result<ExplorerTagSnapshot, String> {
    let mut document = read_explorer_metadata(&app)?;
    let tag_ids = request
        .tag_names
        .iter()
        .filter_map(|label| ensure_tag_id(&mut document, label))
        .collect::<Vec<_>>();

    for raw_path in &request.paths {
        let path = normalize_path_key(raw_path);
        if path.is_empty() {
            continue;
        }
        let existing = document.path_tag_ids.entry(path).or_default();
        match request.mode {
            ExplorerTagMutationMode::Add => {
                for tag_id in &tag_ids {
                    if !existing.contains(tag_id) {
                        existing.push(tag_id.clone());
                    }
                }
            }
            ExplorerTagMutationMode::Remove => {
                existing.retain(|tag_id| !tag_ids.contains(tag_id));
            }
            ExplorerTagMutationMode::Replace => {
                *existing = tag_ids.clone();
            }
        }
        if existing.is_empty() {
            let normalized_path = normalize_path_key(raw_path);
            document
                .path_tag_ids
                .retain(|key, _| key != &normalized_path);
        }
    }

    write_explorer_metadata(&app, &document)?;
    Ok(build_tag_snapshot(&document, Some(request.paths)))
}

#[tauri::command]
#[specta::specta]
pub async fn explorer_saved_searches_list(
    app: AppHandle,
) -> Result<Vec<ExplorerSavedSearchRecord>, String> {
    let mut searches = read_explorer_metadata(&app)?.saved_searches;
    searches.sort_by(|left, right| right.updated_at.cmp(&left.updated_at));
    Ok(searches)
}

#[tauri::command]
#[specta::specta]
pub async fn explorer_saved_searches_save(
    app: AppHandle,
    request: ExplorerSavedSearchSaveRequest,
) -> Result<ExplorerSavedSearchRecord, String> {
    let mut document = read_explorer_metadata(&app)?;
    let name = request.name.trim();
    let root_path = request.root_path.trim();
    let query = request.query.trim();
    if name.is_empty() {
        return Err("Saved search name cannot be empty.".to_string());
    }
    if root_path.is_empty() {
        return Err("Saved search root path cannot be empty.".to_string());
    }
    if query.is_empty() {
        return Err("Saved search query cannot be empty.".to_string());
    }

    let now = now_epoch_ms();
    let id = request
        .id
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| Uuid::new_v4().to_string());
    let created_at = document
        .saved_searches
        .iter()
        .find(|search| search.id == id)
        .map(|search| search.created_at)
        .unwrap_or(now);

    let record = ExplorerSavedSearchRecord {
        id: id.clone(),
        name: name.to_string(),
        root_path: root_path.to_string(),
        query: query.to_string(),
        include_content: request.include_content,
        tag_filter_ids: request.tag_filter_ids,
        created_at,
        updated_at: now,
    };

    document.saved_searches.retain(|search| search.id != id);
    document.saved_searches.push(record.clone());
    write_explorer_metadata(&app, &document)?;
    Ok(record)
}

#[tauri::command]
#[specta::specta]
pub async fn explorer_saved_searches_delete(app: AppHandle, id: String) -> Result<(), String> {
    let mut document = read_explorer_metadata(&app)?;
    let previous_len = document.saved_searches.len();
    document.saved_searches.retain(|search| search.id != id);
    if previous_len != document.saved_searches.len() {
        write_explorer_metadata(&app, &document)?;
    }
    Ok(())
}

pub(crate) async fn run_batch_rename_task(items: Vec<FsBatchRenameItem>) -> Result<String, String> {
    ensure_batch_rename_is_valid(&items)?;
    let destination_parent = items
        .first()
        .and_then(|item| Path::new(&item.destination_path).parent())
        .map(|path| path.to_string_lossy().to_string());
    let task_id = create_manual_explorer_task(explorer_task_registration(
        ExplorerTaskKind::BatchRename,
        format!(
            "Batch rename {} item{}",
            items.len(),
            if items.len() == 1 { "" } else { "s" }
        ),
        items
            .first()
            .map(|item| item.destination_path.clone())
            .unwrap_or_else(|| "Batch rename".to_string()),
        items.iter().map(|item| item.source_path.clone()).collect(),
        destination_parent,
        Some(ExplorerTaskRetryContext::BatchRename {
            items: items.clone(),
        }),
        false,
    ));

    let temporary_renames = items
        .iter()
        .map(|item| {
            let source = PathBuf::from(&item.source_path);
            let temporary_name = format!(".greeble-rename-{}-{}", now_epoch_ms(), Uuid::new_v4());
            let temporary_path = source
                .parent()
                .map(|parent| parent.join(temporary_name))
                .ok_or_else(|| format!("Source path has no parent: {}", source.display()))?;
            Ok((source, temporary_path))
        })
        .collect::<Result<Vec<_>, String>>();

    let result = async {
        let temporary_renames = temporary_renames?;

        for (source, temporary_path) in &temporary_renames {
            move_path_preserving_contents(source, temporary_path)?;
        }

        let mut applied_results = Vec::new();
        for (index, (item, (_, temporary_path))) in
            items.iter().zip(temporary_renames.iter()).enumerate()
        {
            let destination = PathBuf::from(&item.destination_path);
            move_path_preserving_contents(temporary_path, &destination)?;
            invalidate_all_fs_caches_for_path(&destination);
            if let Some(parent) = destination.parent() {
                invalidate_all_fs_caches_for_path(parent);
            }
            applied_results.push(FsBatchRenameResult {
                source_path: item.source_path.clone(),
                destination_path: item.destination_path.clone(),
            });
            let _ = update_manual_explorer_task(
                &task_id,
                Some(format!("Renamed {} of {}", index + 1, items.len())),
                Some((index + 1) as u64),
                Some(items.len() as u64),
            );
        }

        Ok::<Vec<FsBatchRenameResult>, String>(applied_results)
    }
    .await;

    match result {
        Ok(_) => {
            let _ = complete_manual_explorer_task(
                &task_id,
                Some(format!(
                    "Renamed {} item{}",
                    items.len(),
                    if items.len() == 1 { "" } else { "s" }
                )),
                None,
            );
            Ok(task_id)
        }
        Err(error) => {
            let _ = fail_manual_explorer_task(&task_id, error.clone());
            Err(error)
        }
    }
}

pub(crate) fn start_duplicate_scan_task(
    _app: AppHandle,
    root_path: String,
) -> Result<String, String> {
    let normalized_root = root_path.trim().to_string();
    if normalized_root.is_empty() {
        return Err("Duplicate scan root path cannot be empty.".to_string());
    }

    let scan_id = Uuid::new_v4().to_string();
    let progress = Arc::new(Mutex::new(ExplorerDuplicateScanProgress {
        root_path: normalized_root.clone(),
        scanned_file_count: 0,
        candidate_file_count: 0,
        completed: false,
        cancelled: false,
        error: None,
        groups: Vec::new(),
    }));

    duplicate_scan_registry()
        .lock()
        .map_err(|_| "Duplicate scan registry lock was poisoned.".to_string())?
        .insert(scan_id.clone(), progress.clone());

    create_manual_explorer_task_with_id(
        scan_id.clone(),
        explorer_task_registration(
            ExplorerTaskKind::DuplicateScan,
            format!(
                "Scan duplicates in {}",
                Path::new(&normalized_root)
                    .file_name()
                    .map(|value| value.to_string_lossy().to_string())
                    .filter(|value| !value.trim().is_empty())
                    .unwrap_or_else(|| normalized_root.clone())
            ),
            normalized_root.clone(),
            vec![normalized_root.clone()],
            Some(normalized_root.clone()),
            Some(ExplorerTaskRetryContext::DuplicateScan {
                root_path: normalized_root.clone(),
            }),
            false,
        ),
    );
    let _ = set_manual_explorer_task_cancel_context(
        &scan_id,
        ExplorerTaskCancelContext::DuplicateScan {
            scan_id: scan_id.clone(),
        },
    );
    let thread_scan_id = scan_id.clone();
    let thread_progress = progress.clone();
    thread::spawn(move || run_duplicate_scan(thread_scan_id, normalized_root, thread_progress));

    Ok(scan_id)
}

pub(crate) fn cancel_duplicate_scan_task(scan_id: &str) -> Result<(), String> {
    let registry = duplicate_scan_registry()
        .lock()
        .map_err(|_| "Duplicate scan registry lock was poisoned.".to_string())?;
    let progress = registry
        .get(scan_id)
        .ok_or_else(|| format!("Duplicate scan not found: {scan_id}"))?;
    let mut state = progress
        .lock()
        .map_err(|_| "Duplicate scan lock was poisoned.".to_string())?;
    state.cancelled = true;
    sync_duplicate_scan_task(scan_id, &state);
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn fs_trash(
    app: AppHandle,
    paths: Vec<String>,
) -> Result<ExplorerTrashActionRecord, String> {
    if paths.is_empty() {
        return Err("Trash request was empty.".to_string());
    }

    let task_id = create_manual_explorer_task(explorer_task_registration(
        ExplorerTaskKind::Trash,
        format!(
            "Move {} item{} to trash",
            paths.len(),
            if paths.len() == 1 { "" } else { "s" }
        ),
        paths
            .first()
            .cloned()
            .unwrap_or_else(|| "Trash".to_string()),
        paths.clone(),
        None,
        None,
        false,
    ));

    let trash_root = explorer_trash_root(&app)?;
    let action_id = Uuid::new_v4().to_string();
    let action_root = trash_root.join(&action_id);
    let result = (|| -> Result<ExplorerTrashActionRecord, String> {
        fs::create_dir_all(&action_root)
            .map_err(|error| format!("Failed to create trash action directory: {error}"))?;

        let mut entries = Vec::new();
        for (index, raw_path) in paths.into_iter().enumerate() {
            let source = PathBuf::from(&raw_path);
            if !source.exists() {
                return Err(format!("Path does not exist: {}", source.display()));
            }
            let file_name = source
                .file_name()
                .map(|value| value.to_string_lossy().to_string())
                .ok_or_else(|| format!("Path has no file name: {}", source.display()))?;
            let trash_destination = unique_path_in_directory(&action_root, &file_name);
            let is_dir = source.is_dir();
            move_path_preserving_contents(&source, &trash_destination)?;
            invalidate_all_fs_caches_for_path(&source);
            if let Some(parent) = source.parent() {
                invalidate_all_fs_caches_for_path(parent);
            }
            entries.push(ExplorerTrashedEntryRecord {
                original_path: source.to_string_lossy().to_string(),
                trash_path: trash_destination.to_string_lossy().to_string(),
                is_dir,
            });
            let _ = update_manual_explorer_task(
                &task_id,
                Some(format!(
                    "Moved {} of {} item{}",
                    index + 1,
                    entries.len().max(index + 1),
                    if entries.len() == 1 { "" } else { "s" }
                )),
                Some((index + 1) as u64),
                Some((index + 1) as u64),
            );
        }

        let action = ExplorerTrashActionRecord {
            id: action_id,
            trashed_at: now_epoch_ms(),
            entries,
        };

        let mut document = read_explorer_metadata(&app)?;
        document.recent_trash_action = Some(action.clone());
        write_explorer_metadata(&app, &document)?;
        Ok(action)
    })();

    match result {
        Ok(action) => {
            let _ = complete_manual_explorer_task(
                &task_id,
                Some(format!(
                    "Moved {} item{} to trash",
                    action.entries.len(),
                    if action.entries.len() == 1 { "" } else { "s" }
                )),
                Some(true),
            );
            let _ = set_recent_trash_task(Some(&task_id));
            Ok(action)
        }
        Err(error) => {
            let _ = fail_manual_explorer_task(&task_id, error.clone());
            Err(error)
        }
    }
}

#[tauri::command]
#[specta::specta]
pub async fn fs_restore_recent_trash_action(
    app: AppHandle,
) -> Result<Option<ExplorerTrashRestoreResult>, String> {
    let mut document = read_explorer_metadata(&app)?;
    let Some(action) = document.recent_trash_action.clone() else {
        return Ok(None);
    };

    let mut restored_paths = Vec::new();
    let mut missing_paths = Vec::new();

    for entry in &action.entries {
        let trash_path = PathBuf::from(&entry.trash_path);
        let original_path = PathBuf::from(&entry.original_path);
        if !trash_path.exists() {
            missing_paths.push(entry.original_path.clone());
            continue;
        }
        if let Some(parent) = original_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("Failed to prepare restore parent directory: {error}"))?;
        }
        move_path_preserving_contents(&trash_path, &original_path)?;
        invalidate_all_fs_caches_for_path(&original_path);
        if let Some(parent) = original_path.parent() {
            invalidate_all_fs_caches_for_path(parent);
        }
        restored_paths.push(entry.original_path.clone());
    }

    let action_root = explorer_trash_root(&app)?.join(action.id);
    if action_root.exists() {
        let _ = fs::remove_dir_all(action_root);
    }

    document.recent_trash_action = None;
    write_explorer_metadata(&app, &document)?;
    let _ = set_recent_trash_task(None);

    Ok(Some(ExplorerTrashRestoreResult {
        restored_paths,
        missing_paths,
    }))
}

#[tauri::command]
#[specta::specta]
pub async fn fs_batch_rename_preview(
    recipe: FsBatchRenameRecipe,
) -> Result<Vec<FsBatchRenamePreviewRow>, String> {
    batch_rename_preview_rows(&recipe)
}

#[tauri::command]
#[specta::specta]
pub async fn fs_batch_rename_apply(
    recipe: FsBatchRenameRecipe,
) -> Result<Vec<FsBatchRenameResult>, String> {
    let preview = batch_rename_preview_rows(&recipe)?;
    if let Some(error) = preview.iter().find_map(|row| row.validation_error.clone()) {
        return Err(error);
    }
    if preview.iter().any(|row| row.collision) {
        return Err("Batch rename contains conflicting destinations.".to_string());
    }

    let items = preview
        .iter()
        .filter(|row| row.source_path != row.destination_path)
        .map(|row| FsBatchRenameItem {
            source_path: row.source_path.clone(),
            destination_path: row.destination_path.clone(),
        })
        .collect::<Vec<_>>();

    if items.is_empty() {
        return Ok(Vec::new());
    }

    let task_id = run_batch_rename_task(items.clone()).await?;
    let _ = task_id;
    Ok(items
        .into_iter()
        .map(|item| FsBatchRenameResult {
            source_path: item.source_path,
            destination_path: item.destination_path,
        })
        .collect())
}

#[tauri::command]
#[specta::specta]
pub async fn fs_batch_rename(
    items: Vec<FsBatchRenameItem>,
) -> Result<Vec<FsBatchRenameResult>, String> {
    let task_id = run_batch_rename_task(items.clone()).await?;
    let _ = task_id;
    Ok(items
        .into_iter()
        .map(|item| FsBatchRenameResult {
            source_path: item.source_path,
            destination_path: item.destination_path,
        })
        .collect())
}

#[tauri::command]
#[specta::specta]
pub async fn fs_find_duplicates_start(
    app: AppHandle,
    root_path: String,
) -> Result<ExplorerDuplicateScanStartResponse, String> {
    let scan_id = start_duplicate_scan_task(app, root_path)?;
    Ok(ExplorerDuplicateScanStartResponse { scan_id })
}

#[tauri::command]
#[specta::specta]
pub async fn fs_find_duplicates_poll(
    scan_id: String,
) -> Result<ExplorerDuplicateScanStatus, String> {
    let registry = duplicate_scan_registry()
        .lock()
        .map_err(|_| "Duplicate scan registry lock was poisoned.".to_string())?;
    let progress = registry
        .get(&scan_id)
        .ok_or_else(|| format!("Duplicate scan not found: {scan_id}"))?;
    let status = progress
        .lock()
        .map_err(|_| "Duplicate scan lock was poisoned.".to_string())?
        .into_status(scan_id);
    Ok(status)
}

#[tauri::command]
#[specta::specta]
pub async fn fs_find_duplicates_cancel(scan_id: String) -> Result<(), String> {
    cancel_duplicate_scan_task(&scan_id)
}

#[cfg(test)]
mod tests {
    use super::{
        batch_rename_preview_rows, collect_duplicate_candidates, ensure_batch_rename_is_valid,
        fs_batch_rename_apply, ExplorerDuplicateScanProgress, ExplorerSavedSearchSaveRequest,
        FsBatchRenameItem, FsBatchRenameMode, FsBatchRenameRecipe,
    };
    use std::collections::HashMap;
    use std::fs;
    use std::sync::{Arc, Mutex};
    use tempfile::tempdir;

    #[test]
    fn batch_rename_rejects_duplicate_destinations() {
        let temp = tempdir().expect("tempdir");
        let first = temp.path().join("alpha.txt");
        let second = temp.path().join("beta.txt");
        fs::write(&first, "alpha").expect("write alpha");
        fs::write(&second, "beta").expect("write beta");

        let result = ensure_batch_rename_is_valid(&[
            FsBatchRenameItem {
                source_path: first.to_string_lossy().to_string(),
                destination_path: temp.path().join("shared.txt").to_string_lossy().to_string(),
            },
            FsBatchRenameItem {
                source_path: second.to_string_lossy().to_string(),
                destination_path: temp.path().join("shared.txt").to_string_lossy().to_string(),
            },
        ]);

        assert!(result.is_err());
    }

    #[test]
    fn duplicate_scan_skips_gitignored_directories() {
        let temp = tempdir().expect("tempdir");
        let src_dir = temp.path().join("src");
        let ignored_dir = temp.path().join("node_modules").join("pkg");
        fs::create_dir_all(&src_dir).expect("create src dir");
        fs::create_dir_all(&ignored_dir).expect("create ignored dir");
        fs::write(temp.path().join(".gitignore"), "node_modules/\n").expect("write gitignore");

        let kept_file = src_dir.join("duplicate.txt");
        let ignored_file = ignored_dir.join("duplicate.txt");
        fs::write(&kept_file, "duplicate payload").expect("write kept file");
        fs::write(&ignored_file, "duplicate payload").expect("write ignored file");

        let progress = Arc::new(Mutex::new(ExplorerDuplicateScanProgress {
            root_path: temp.path().to_string_lossy().to_string(),
            scanned_file_count: 0,
            candidate_file_count: 0,
            completed: false,
            cancelled: false,
            error: None,
            groups: Vec::new(),
        }));
        let mut groups_by_size = HashMap::new();

        collect_duplicate_candidates(temp.path(), "scan-1", &progress, &mut groups_by_size)
            .expect("collect duplicate candidates");

        let file_size = fs::metadata(&kept_file).expect("kept file metadata").len();
        let candidates = groups_by_size
            .get(&file_size)
            .expect("expected candidate size bucket");
        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0], kept_file);
        assert_eq!(
            progress.lock().expect("progress lock").scanned_file_count,
            1
        );
    }

    #[test]
    fn saved_search_save_request_carries_tag_filters() {
        let request = ExplorerSavedSearchSaveRequest {
            id: None,
            name: "Images".to_string(),
            root_path: "/tmp/project".to_string(),
            query: "png".to_string(),
            include_content: false,
            tag_filter_ids: vec!["visual".to_string(), "approved".to_string()],
        };

        assert_eq!(request.tag_filter_ids.len(), 2);
    }

    #[test]
    fn batch_rename_preview_supports_regex_tokens_and_extension_preservation() {
        let temp = tempdir().expect("tempdir");
        let source = temp.path().join("ship_42.png");
        fs::write(&source, "ship").expect("write ship");

        let rows = batch_rename_preview_rows(&FsBatchRenameRecipe {
            source_paths: vec![source.to_string_lossy().to_string()],
            search: "^(?<name>[a-z]+)_(\\d+)$".to_string(),
            replacement: "${name}-{{parent}}-$2-{{index}}".to_string(),
            prefix: String::new(),
            suffix: String::new(),
            mode: FsBatchRenameMode::Regex,
            start_index: Some(3),
            index_padding: Some(2),
        })
        .expect("preview rows");

        let row = rows.first().expect("row");
        assert!(row.next_name.ends_with("-03.png"));
        assert!(row.next_name.contains("ship-"));
        assert!(row.validation_error.is_none());
    }

    #[test]
    fn batch_rename_preview_rejects_invalid_regex() {
        let temp = tempdir().expect("tempdir");
        let source = temp.path().join("alpha.txt");
        fs::write(&source, "alpha").expect("write alpha");

        let rows = batch_rename_preview_rows(&FsBatchRenameRecipe {
            source_paths: vec![source.to_string_lossy().to_string()],
            search: "(".to_string(),
            replacement: "$1".to_string(),
            prefix: String::new(),
            suffix: String::new(),
            mode: FsBatchRenameMode::Regex,
            start_index: Some(1),
            index_padding: Some(0),
        })
        .expect("preview rows");

        assert!(rows[0]
            .validation_error
            .as_deref()
            .unwrap()
            .contains("Invalid rename regex"));
    }

    #[tokio::test]
    async fn batch_rename_apply_uses_the_preview_evaluator() {
        let temp = tempdir().expect("tempdir");
        let source = temp.path().join("alpha.txt");
        fs::write(&source, "alpha").expect("write alpha");

        let results = fs_batch_rename_apply(FsBatchRenameRecipe {
            source_paths: vec![source.to_string_lossy().to_string()],
            search: "alpha".to_string(),
            replacement: "{{parent}}-{{index}}".to_string(),
            prefix: String::new(),
            suffix: String::new(),
            mode: FsBatchRenameMode::Literal,
            start_index: Some(5),
            index_padding: Some(2),
        })
        .await
        .expect("batch rename apply");

        assert_eq!(results.len(), 1);
        let renamed = temp.path().join(format!(
            "{}-05.txt",
            temp.path()
                .file_name()
                .expect("tempdir file name")
                .to_string_lossy()
        ));
        assert!(renamed.exists(), "renamed file should exist");
        assert!(!source.exists(), "source should be moved");
    }
}
