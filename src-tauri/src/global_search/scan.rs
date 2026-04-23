use super::ignore::{build_ignored_path_list, is_ignored_path};
use super::index::{
    calculate_dir_size, clear_index, global_search_index_dir, open_or_create_index, read_meta,
    validate_index, write_meta, GlobalSearchMeta, GLOBAL_SEARCH_SCHEMA_VERSION,
};
use super::state::{now_millis, GlobalSearchIndexFields, GlobalSearchState, GLOBAL_SEARCH_STATE};
use super::types::{
    GlobalSearchDriveScanError, GlobalSearchScanSettings, GlobalSearchStatus,
};
use super::utils::metadata_modified_time_unix_ms;
use ignore::WalkBuilder;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Mutex;
use tantivy::{doc, Index, IndexReader, IndexWriter};
use tauri::Manager;

const STATUS_UPDATE_INTERVAL: u64 = 512;

struct CommittedIndexUpdate {
    doc_count: u64,
    index_size_bytes: u64,
    index: Index,
    reader: IndexReader,
    fields: GlobalSearchIndexFields,
}

fn apply_committed_index_status(
    state: &mut GlobalSearchState,
    base_dir: &Path,
    update: CommittedIndexUpdate,
    advance_last_scan_time: bool,
) {
    let CommittedIndexUpdate {
        doc_count,
        index_size_bytes,
        index,
        reader,
        fields,
    } = update;

    state.index = Some(index);
    state.reader = Some(reader);
    state.fields = Some(fields);
    state.status.indexed_item_count = doc_count;
    state.status.index_size_bytes = index_size_bytes;
    state.status.is_index_valid = doc_count > 0;
    if advance_last_scan_time {
        state.status.last_scan_time = Some(now_millis());
    }

    let _ = write_meta(
        base_dir,
        &GlobalSearchMeta {
            last_scan_time: state.status.last_scan_time,
            indexed_item_count: doc_count,
            schema_version: GLOBAL_SEARCH_SCHEMA_VERSION,
        },
    );
}

#[tauri::command]
#[specta::specta]
pub fn global_search_init(app: tauri::AppHandle) -> Result<GlobalSearchStatus, String> {
    let base_dir = app
        .path()
        .app_data_dir()
        .map_err(|error: tauri::Error| error.to_string())?;

    let index_path = global_search_index_dir(&base_dir);
    let is_valid = validate_index(&index_path, &base_dir);

    if !is_valid {
        let _ = clear_index(&index_path);
    }

    let (_index, reader, _fields) = open_or_create_index(&index_path)?;

    let indexed_item_count = reader.searcher().num_docs();
    let index_size_bytes = calculate_dir_size(&index_path);
    let meta = read_meta(&base_dir);

    let mut state = GLOBAL_SEARCH_STATE
        .write()
        .map_err(|error| error.to_string())?;

    state.status.indexed_item_count = indexed_item_count;
    state.status.index_size_bytes = index_size_bytes;
    state.status.last_scan_time = meta.and_then(|entry| entry.last_scan_time);
    state.status.is_index_valid = is_valid && indexed_item_count > 0;

    Ok(state.status.clone())
}

fn add_path_document(writer: &mut IndexWriter, fields: &GlobalSearchIndexFields, path: &Path) {
    let metadata = match std::fs::metadata(path) {
        Ok(metadata) => metadata,
        Err(_) => return,
    };

    let is_dir = metadata.is_dir();
    let is_file = metadata.is_file();
    let name = match path.file_name().and_then(|segment| segment.to_str()) {
        Some(name) => name.to_string(),
        None => return,
    };
    let path_string = path.to_string_lossy().to_string();
    let modified_time = metadata_modified_time_unix_ms(&metadata);
    let size = if is_file { metadata.len() } else { 0 };

    let _ = writer.add_document(doc!(
        fields.path => path_string,
        fields.name => name.clone(),
        fields.name_lower => name.to_lowercase(),
        fields.is_file => if is_file { 1u64 } else { 0u64 },
        fields.is_dir => if is_dir { 1u64 } else { 0u64 },
        fields.modified_time => modified_time,
        fields.size => size,
    ));
}

#[tauri::command]
#[specta::specta]
pub fn global_search_get_status() -> Result<GlobalSearchStatus, String> {
    let state = GLOBAL_SEARCH_STATE
        .read()
        .map_err(|error| error.to_string())?;
    Ok(state.status.clone())
}

#[tauri::command]
#[specta::specta]
pub fn global_search_cancel_scan() -> Result<(), String> {
    let state = GLOBAL_SEARCH_STATE
        .read()
        .map_err(|error| error.to_string())?;
    state.cancel_flag.store(true, Ordering::SeqCst);
    Ok(())
}

fn build_walker(root_path: &Path, scan_depth: usize) -> ignore::Walk {
    let mut builder = WalkBuilder::new(root_path);
    builder
        .follow_links(false)
        .hidden(false)
        .git_ignore(false)
        .git_exclude(false)
        .git_global(false)
        .parents(false)
        .max_depth(Some(scan_depth.max(1)));
    builder.build()
}

fn scan_drive(
    root: &str,
    scan_depth: usize,
    ignored_paths: &[String],
    fields: &GlobalSearchIndexFields,
    writer: &Mutex<IndexWriter>,
    indexed_count: &AtomicU64,
    cancel_flag: &AtomicBool,
) -> Result<(), GlobalSearchDriveScanError> {
    let root_path = PathBuf::from(root);

    if let Err(error) = std::fs::read_dir(&root_path) {
        return Err(GlobalSearchDriveScanError {
            drive_root: root.to_string(),
            message: error.to_string(),
        });
    }

    let mut items_since_last_update = 0u64;
    for entry_result in build_walker(&root_path, scan_depth) {
        if cancel_flag.load(Ordering::SeqCst) {
            break;
        }

        let entry = match entry_result {
            Ok(entry) => entry,
            Err(_) => continue,
        };
        if entry.depth() == 0 {
            continue;
        }

        let path = entry.path();
        let path_string = path.to_string_lossy().to_string();
        if is_ignored_path(&path_string, ignored_paths) {
            continue;
        }

        if let Ok(mut locked_writer) = writer.lock() {
            add_path_document(&mut locked_writer, fields, path);
        }

        indexed_count.fetch_add(1, Ordering::Relaxed);
        items_since_last_update += 1;

        if items_since_last_update >= STATUS_UPDATE_INTERVAL {
            if let Ok(mut state) = GLOBAL_SEARCH_STATE.write() {
                state.status.indexed_item_count = indexed_count.load(Ordering::Relaxed);
            }
            items_since_last_update = 0;
        }
    }

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn global_search_start_scan(
    app: tauri::AppHandle,
    settings: GlobalSearchScanSettings,
) -> Result<(), String> {
    {
        let mut state = GLOBAL_SEARCH_STATE
            .write()
            .map_err(|error| error.to_string())?;
        if state.status.is_scan_in_progress {
            return Ok(());
        }
        state.status.is_scan_in_progress = true;
        state.status.is_parallel_scan = settings.parallel_scan && settings.drive_roots.len() > 1;
        state.status.current_drive_root = None;
        state.status.indexed_item_count = 0;
        state.status.drive_scan_errors = Vec::new();
        state.status.scanned_drives_count = 0;
        state.status.total_drives_count = settings.drive_roots.len() as u32;
        state.cancel_flag.store(false, Ordering::SeqCst);
    }

    let base_dir = app
        .path()
        .app_data_dir()
        .map_err(|error: tauri::Error| error.to_string())?;
    let index_path = global_search_index_dir(&base_dir);
    let cancel_flag = {
        let state = GLOBAL_SEARCH_STATE
            .read()
            .map_err(|error| error.to_string())?;
        state.cancel_flag.clone()
    };

    tauri::async_runtime::spawn(async move {
        let result =
            (|| -> Result<(u64, Index, IndexReader, GlobalSearchIndexFields, u64), String> {
                let (index, reader, fields) = open_or_create_index(&index_path)?;
                let mut writer = index
                    .writer(100_000_000)
                    .map_err(|error| error.to_string())?;
                writer
                    .delete_all_documents()
                    .map_err(|error| error.to_string())?;
                let writer = Mutex::new(writer);

                let ignored_paths = build_ignored_path_list(&settings.ignored_paths);
                let valid_drive_roots: Vec<String> = settings
                    .drive_roots
                    .iter()
                    .map(|root| root.trim())
                    .filter(|root| !root.is_empty())
                    .filter(|root| {
                        let path = Path::new(root);
                        path.exists() && path.is_dir()
                    })
                    .map(|root| root.to_string())
                    .collect();

                if valid_drive_roots.is_empty() {
                    if let Ok(mut state) = GLOBAL_SEARCH_STATE.write() {
                        state.status.is_scan_in_progress = false;
                        state.status.total_drives_count = 0;
                        state.status.current_drive_root = None;
                    }
                    return Err("No valid drive roots were available for global search.".to_string());
                }

                if let Ok(mut state) = GLOBAL_SEARCH_STATE.write() {
                    state.status.total_drives_count = valid_drive_roots.len() as u32;
                }

                let indexed_count = AtomicU64::new(0);
                let mut errors = Vec::new();

                if settings.parallel_scan && valid_drive_roots.len() > 1 {
                    std::thread::scope(|scope| {
                        let handles: Vec<_> = valid_drive_roots
                            .iter()
                            .map(|root| {
                                let root = root.clone();
                                let ignored_paths = ignored_paths.clone();
                                let writer_ref = &writer;
                                let indexed_count_ref = &indexed_count;
                                let cancel_flag_ref = &cancel_flag;
                                let scan_depth = settings.scan_depth;

                                scope.spawn(move || {
                                    if let Ok(mut state) = GLOBAL_SEARCH_STATE.write() {
                                        state.status.current_drive_root = Some(root.clone());
                                    }

                                    let scan_result = scan_drive(
                                        &root,
                                        scan_depth,
                                        &ignored_paths,
                                        &fields,
                                        writer_ref,
                                        indexed_count_ref,
                                        cancel_flag_ref,
                                    );

                                    if let Ok(mut state) = GLOBAL_SEARCH_STATE.write() {
                                        state.status.scanned_drives_count += 1;
                                        state.status.indexed_item_count =
                                            indexed_count_ref.load(Ordering::Relaxed);
                                    }

                                    scan_result
                                })
                            })
                            .collect();

                        for handle in handles {
                            if let Ok(Err(error)) = handle.join() {
                                errors.push(error);
                            }
                        }
                    });
                } else {
                    for (index, root) in valid_drive_roots.iter().enumerate() {
                        if cancel_flag.load(Ordering::SeqCst) {
                            break;
                        }

                        if let Ok(mut state) = GLOBAL_SEARCH_STATE.write() {
                            state.status.current_drive_root = Some(root.clone());
                        }

                        if let Err(error) = scan_drive(
                            root,
                            settings.scan_depth,
                            &ignored_paths,
                            &fields,
                            &writer,
                            &indexed_count,
                            &cancel_flag,
                        ) {
                            errors.push(error);
                        }

                        if let Ok(mut state) = GLOBAL_SEARCH_STATE.write() {
                            state.status.scanned_drives_count = (index + 1) as u32;
                            state.status.indexed_item_count = indexed_count.load(Ordering::Relaxed);
                        }
                    }
                }

                if let Ok(mut state) = GLOBAL_SEARCH_STATE.write() {
                    state.status.drive_scan_errors = errors;
                    state.status.current_drive_root = None;
                    state.status.is_committing = true;
                }

                let mut locked_writer = writer.lock().map_err(|error| error.to_string())?;
                locked_writer.commit().map_err(|error| error.to_string())?;
                drop(locked_writer);

                reader.reload().map_err(|error| error.to_string())?;

                if let Ok(mut state) = GLOBAL_SEARCH_STATE.write() {
                    state.status.is_committing = false;
                }

                let indexed_item_count = indexed_count.load(Ordering::Relaxed);
                let index_size_bytes = calculate_dir_size(&index_path);
                Ok((indexed_item_count, index, reader, fields, index_size_bytes))
            })();

        if let Ok(mut state) = GLOBAL_SEARCH_STATE.write() {
            state.status.is_scan_in_progress = false;
            state.status.is_parallel_scan = false;
            state.status.current_drive_root = None;

            let was_cancelled = state.cancel_flag.load(Ordering::SeqCst);
            if let Ok((doc_count, index, reader, fields, index_size_bytes)) = result {
                apply_committed_index_status(
                    &mut state,
                    &base_dir,
                    CommittedIndexUpdate {
                        doc_count,
                        index_size_bytes,
                        index,
                        reader,
                        fields,
                    },
                    !was_cancelled,
                );
            }
        }
    });

    Ok(())
}
