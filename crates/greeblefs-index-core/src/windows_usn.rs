use crate::{
    flush_index_record_chunk, indexed_record_from_path_shape, load_root_summary_for_key,
    normalize_drive_root, normalize_path_key, open_index_connection,
    path_key_is_same_or_descendant, prepare_replace_index_root, volume_key_for_path,
    IndexedPathRecord, PathIndexBuildSource, PathIndexCancellation, PathIndexRootSummary,
    PathIndexVolumeState, PathIndexWriteStats, UsnJournalOptions, PATH_INDEX_INSERT_CHUNK_SIZE,
    WINDOWS_USN_SERVICE_SOURCE,
};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::ffi::OsStr;
use std::mem::{size_of, zeroed};
use std::os::windows::ffi::OsStrExt;
use std::path::{Path, PathBuf};
use windows_sys::Win32::Foundation::{
    CloseHandle, GetLastError, GENERIC_READ, GENERIC_WRITE, HANDLE, INVALID_HANDLE_VALUE,
};
use windows_sys::Win32::Storage::FileSystem::{
    CreateFileW, FILE_ATTRIBUTE_DIRECTORY, FILE_ATTRIBUTE_HIDDEN, FILE_ATTRIBUTE_REPARSE_POINT,
    FILE_FLAG_BACKUP_SEMANTICS, FILE_SHARE_DELETE, FILE_SHARE_READ, FILE_SHARE_WRITE,
    OPEN_EXISTING,
};
use windows_sys::Win32::System::Ioctl::{
    CREATE_USN_JOURNAL_DATA, FSCTL_CREATE_USN_JOURNAL, FSCTL_ENUM_USN_DATA,
    FSCTL_QUERY_USN_JOURNAL, FSCTL_READ_USN_JOURNAL, MFT_ENUM_DATA_V0, READ_USN_JOURNAL_DATA_V0,
    USN_JOURNAL_DATA_V0,
};
use windows_sys::Win32::System::IO::DeviceIoControl;

const USN_ENUM_BUFFER_BYTES: usize = 1024 * 1024;
const USN_TAIL_BUFFER_BYTES: usize = 256 * 1024;
const USN_STAGE_CHUNK_SIZE: usize = 50_000;
const USN_RESOLVE_FILE_REF_BATCH_SIZE: i64 = 50_000;
const WINDOWS_TICK_MS_DIVISOR: i64 = 10_000;
const WINDOWS_UNIX_EPOCH_TICKS: i64 = 116_444_736_000_000_000;
const ERROR_ACCESS_DENIED: u32 = 5;
const ERROR_HANDLE_EOF: u32 = 38;
const ERROR_JOURNAL_NOT_ACTIVE: u32 = 1179;
const USN_RAW_ACCESS_DENIED_MESSAGE: &str =
    "Windows USN indexing requires raw NTFS volume read permission";
const USN_JOURNAL_UNAVAILABLE_MESSAGE: &str = "Windows USN journal is unavailable for this volume";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WindowsUsnJournalState {
    pub drive_root: String,
    pub volume_key: String,
    pub journal_id: u64,
    pub first_usn: i64,
    pub next_usn: i64,
    pub lowest_valid_usn: i64,
    pub maximum_size: u64,
    pub allocation_delta: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WindowsUsnTailMarker {
    pub drive_root: String,
    pub volume_key: String,
    pub journal_id: u64,
    pub start_usn: i64,
    pub next_usn: i64,
    pub lowest_valid_usn: i64,
    pub observed_record_count: u32,
    pub requires_rebuild: bool,
    pub rebuild_reason: Option<String>,
}

#[derive(Debug, Clone)]
pub struct WindowsUsnIndexPlan {
    pub source: PathIndexBuildSource,
    pub volume_root: PathBuf,
    pub journal_cursor_usn: i64,
    pub mft_enum_high_usn: i64,
}

#[derive(Debug, Clone)]
struct UsnRecord {
    file_ref: String,
    parent_file_ref: String,
    name: String,
    file_attributes: u32,
    timestamp_ms: u64,
}

struct VolumeHandle(HANDLE);

impl Drop for VolumeHandle {
    fn drop(&mut self) {
        unsafe {
            if self.0 != INVALID_HANDLE_VALUE {
                CloseHandle(self.0);
            }
        }
    }
}

pub fn ensure_usn_journal(
    drive_root: &Path,
    options: &UsnJournalOptions,
) -> Result<WindowsUsnJournalState, String> {
    let volume_root = normalize_drive_root(drive_root)?;
    let handle = open_volume_handle(&volume_root, true)?;
    match query_usn_journal(handle.0, &volume_root) {
        Ok(journal) => Ok(journal_state_from_raw(&volume_root, &journal)),
        Err(error) if is_journal_not_active_error(&error) => {
            create_usn_journal(handle.0, &volume_root, options)?;
            query_usn_journal(handle.0, &volume_root)
                .map(|journal| journal_state_from_raw(&volume_root, &journal))
        }
        Err(error) => Err(error),
    }
}

pub fn prepare_usn_index<F>(
    requested_root_path: &Path,
    options: &UsnJournalOptions,
    source_label: &str,
    auto_create_journal: bool,
    should_cancel: &mut F,
) -> Result<WindowsUsnIndexPlan, String>
where
    F: FnMut() -> PathIndexCancellation,
{
    throw_if_cancelled(should_cancel)?;
    let volume_root = normalize_drive_root(requested_root_path)?;
    let journal_state = if auto_create_journal {
        ensure_usn_journal(&volume_root, options)?
    } else {
        let handle = open_volume_handle(&volume_root, false)?;
        journal_state_from_raw(&volume_root, &query_usn_journal(handle.0, &volume_root)?)
    };
    Ok(WindowsUsnIndexPlan {
        source: PathIndexBuildSource {
            source: source_label.to_string(),
            volume_key: journal_state.volume_key,
            journal_id: Some(journal_state.journal_id),
            last_usn: Some(journal_state.next_usn),
            lowest_valid_usn: Some(journal_state.lowest_valid_usn),
        },
        volume_root,
        journal_cursor_usn: journal_state.next_usn,
        mft_enum_high_usn: full_mft_enum_high_usn(),
    })
}

pub fn build_windows_usn_index<F>(
    db_path: &Path,
    requested_root_path: &Path,
    source_label: &str,
    options: &UsnJournalOptions,
    auto_create_journal: bool,
    mut should_cancel: F,
) -> Result<PathIndexRootSummary, String>
where
    F: FnMut() -> PathIndexCancellation,
{
    let requested_root_path = requested_root_path.to_path_buf();
    let requested_root_key = normalize_path_key(&requested_root_path);
    let plan = prepare_usn_index(
        &requested_root_path,
        options,
        source_label,
        auto_create_journal,
        &mut should_cancel,
    )?;

    let mut connection = open_index_connection(db_path)?;
    let root_id = prepare_replace_index_root(
        &mut connection,
        &requested_root_path,
        &requested_root_key,
        &plan.source,
    )?;
    upsert_volume_building(&connection, &plan.volume_root, &plan.source)?;
    let stats = insert_windows_usn_records_chunked(
        &mut connection,
        root_id,
        &requested_root_path,
        plan.clone(),
        &mut should_cancel,
    )?;
    crate::finalize_index_root(&mut connection, root_id, &plan.source, stats)?;
    crate::upsert_volume_state(
        &connection,
        &PathIndexVolumeState {
            volume_key: plan.source.volume_key.clone(),
            drive_root: plan.volume_root.to_string_lossy().to_string(),
            journal_id: plan.source.journal_id,
            last_usn: plan.source.last_usn,
            lowest_valid_usn: plan.source.lowest_valid_usn,
            source: plan.source.source.clone(),
            state: "ready".to_string(),
            entry_count: stats.entry_count.max(0) as u64,
            directory_count: stats.directory_count.max(0) as u64,
            file_count: stats.file_count.max(0) as u64,
            last_indexed_at_ms: Some(crate::now_ms()),
            last_error: None,
        },
    )?;
    load_root_summary_for_key(db_path, &requested_root_key)?
        .ok_or_else(|| "Path index root disappeared after Windows USN commit".to_string())
}

pub fn build_windows_usn_service_index<F>(
    db_path: &Path,
    drive_root: &Path,
    options: &UsnJournalOptions,
    should_cancel: F,
) -> Result<PathIndexRootSummary, String>
where
    F: FnMut() -> PathIndexCancellation,
{
    build_windows_usn_index(
        db_path,
        drive_root,
        WINDOWS_USN_SERVICE_SOURCE,
        options,
        true,
        should_cancel,
    )
}

pub fn read_windows_usn_tail_marker(
    drive_root: &Path,
    journal_id: u64,
    start_usn: i64,
) -> Result<WindowsUsnTailMarker, String> {
    let volume_root = normalize_drive_root(drive_root)?;
    let handle = open_volume_handle(&volume_root, false)?;
    let journal = query_usn_journal(handle.0, &volume_root)?;
    if journal.UsnJournalID != journal_id {
        return Ok(rebuild_tail_marker(
            &volume_root,
            journal.UsnJournalID,
            start_usn,
            journal.NextUsn,
            journal.LowestValidUsn,
            format!(
                "USN journal id changed from {journal_id} to {}",
                journal.UsnJournalID
            ),
        ));
    }
    if journal.LowestValidUsn > start_usn {
        return Ok(rebuild_tail_marker(
            &volume_root,
            journal.UsnJournalID,
            start_usn,
            journal.NextUsn,
            journal.LowestValidUsn,
            format!(
                "USN journal wrapped: lowest valid USN {} is newer than cursor {start_usn}",
                journal.LowestValidUsn
            ),
        ));
    }

    let mut input = READ_USN_JOURNAL_DATA_V0 {
        StartUsn: start_usn,
        ReasonMask: u32::MAX,
        ReturnOnlyOnClose: 0,
        Timeout: 0,
        BytesToWaitFor: 0,
        UsnJournalID: journal_id,
    };
    let mut output = vec![0u8; USN_TAIL_BUFFER_BYTES];
    let mut returned = 0u32;
    let ok = unsafe {
        DeviceIoControl(
            handle.0,
            FSCTL_READ_USN_JOURNAL,
            &mut input as *mut _ as *mut _,
            size_of::<READ_USN_JOURNAL_DATA_V0>() as u32,
            output.as_mut_ptr() as *mut _,
            output.len() as u32,
            &mut returned,
            std::ptr::null_mut(),
        )
    };
    if ok == 0 {
        let error = unsafe { GetLastError() };
        if error == ERROR_JOURNAL_NOT_ACTIVE {
            return Ok(rebuild_tail_marker(
                &volume_root,
                journal_id,
                start_usn,
                journal.NextUsn,
                journal.LowestValidUsn,
                format!("USN journal became inactive: Win32 error {error}"),
            ));
        }
        if error == ERROR_HANDLE_EOF {
            return Ok(WindowsUsnTailMarker {
                drive_root: volume_root.to_string_lossy().to_string(),
                volume_key: volume_key_for_path(&volume_root),
                journal_id,
                start_usn,
                next_usn: journal.NextUsn,
                lowest_valid_usn: journal.LowestValidUsn,
                observed_record_count: 0,
                requires_rebuild: false,
                rebuild_reason: None,
            });
        }
        return Err(format!(
            "FSCTL_READ_USN_JOURNAL failed for {}: Win32 error {error}",
            volume_root.display()
        ));
    }
    if returned < 8 {
        return Err(format!(
            "FSCTL_READ_USN_JOURNAL returned a short payload for {}",
            volume_root.display()
        ));
    }
    let returned_len = returned as usize;
    let next_usn = read_i64(&output, 0)?;
    Ok(WindowsUsnTailMarker {
        drive_root: volume_root.to_string_lossy().to_string(),
        volume_key: volume_key_for_path(&volume_root),
        journal_id,
        start_usn,
        next_usn,
        lowest_valid_usn: journal.LowestValidUsn,
        observed_record_count: count_usn_tail_records(&output[8..returned_len])?,
        requires_rebuild: false,
        rebuild_reason: None,
    })
}

pub fn update_windows_usn_tail_marker(
    db_path: &Path,
    marker: &WindowsUsnTailMarker,
) -> Result<(), String> {
    let connection = open_index_connection(db_path)?;
    let now = crate::now_ms() as i64;
    let root_key = normalize_path_key(Path::new(&marker.drive_root));
    connection
        .execute(
            r#"
            UPDATE path_index_roots
            SET journal_id = ?2,
                last_usn = ?3,
                lowest_valid_usn = ?4,
                indexed_at_ms = ?5,
                last_error = NULL
            WHERE root_key = ?1
              AND source = ?6
            "#,
            params![
                root_key,
                marker.journal_id as i64,
                marker.next_usn,
                marker.lowest_valid_usn,
                now,
                WINDOWS_USN_SERVICE_SOURCE,
            ],
        )
        .map_err(|error| format!("Failed to update path index root USN cursor: {error}"))?;
    connection
        .execute(
            r#"
            UPDATE path_index_volumes
            SET journal_id = ?2,
                last_usn = ?3,
                lowest_valid_usn = ?4,
                indexed_at_ms = ?5,
                last_error = NULL
            WHERE drive_root = ?1
              AND source = ?6
            "#,
            params![
                &marker.drive_root,
                marker.journal_id as i64,
                marker.next_usn,
                marker.lowest_valid_usn,
                now,
                WINDOWS_USN_SERVICE_SOURCE,
            ],
        )
        .map_err(|error| format!("Failed to update path index volume USN cursor: {error}"))?;
    Ok(())
}

pub fn is_access_denied_error(error: &str) -> bool {
    error.contains(USN_RAW_ACCESS_DENIED_MESSAGE) || error.contains("Win32 error 5")
}

pub fn is_journal_not_active_error(error: &str) -> bool {
    error.contains(USN_JOURNAL_UNAVAILABLE_MESSAGE)
        || error.contains("Win32 error 1179")
        || error.contains("error 1179")
}

pub fn is_first_unavailable_fallback(error: &str) -> bool {
    is_access_denied_error(error) || is_journal_not_active_error(error)
}

fn rebuild_tail_marker(
    volume_root: &Path,
    journal_id: u64,
    start_usn: i64,
    next_usn: i64,
    lowest_valid_usn: i64,
    reason: String,
) -> WindowsUsnTailMarker {
    WindowsUsnTailMarker {
        drive_root: volume_root.to_string_lossy().to_string(),
        volume_key: volume_key_for_path(volume_root),
        journal_id,
        start_usn,
        next_usn,
        lowest_valid_usn,
        observed_record_count: 0,
        requires_rebuild: true,
        rebuild_reason: Some(reason),
    }
}

fn count_usn_tail_records(bytes: &[u8]) -> Result<u32, String> {
    let mut offset = 0usize;
    let mut count = 0u32;
    while offset + 8 <= bytes.len() {
        let record_len = read_u32(bytes, offset)? as usize;
        if record_len == 0 || offset + record_len > bytes.len() {
            break;
        }
        count = count.saturating_add(1);
        offset += record_len;
    }
    Ok(count)
}

fn insert_windows_usn_records_chunked<F>(
    connection: &mut Connection,
    root_id: i64,
    requested_root_path: &Path,
    plan: WindowsUsnIndexPlan,
    should_cancel: &mut F,
) -> Result<PathIndexWriteStats, String>
where
    F: FnMut() -> PathIndexCancellation,
{
    let mut stats = PathIndexWriteStats::default();
    let mut chunk = Vec::with_capacity(PATH_INDEX_INSERT_CHUNK_SIZE);
    throw_if_cancelled(should_cancel)?;
    let requested_root_key = normalize_path_key(requested_root_path);
    let volume_handle = open_volume_handle(&plan.volume_root, false)?;
    create_usn_stage(connection)?;
    stage_usn_records(
        connection,
        volume_handle.0,
        plan.mft_enum_high_usn,
        should_cancel,
    )?;

    create_usn_path_stage(connection, &plan.volume_root, should_cancel)?;
    let mut emitted = false;
    let mut last_path_rowid = 0i64;
    loop {
        throw_if_cancelled(should_cancel)?;
        let records = collect_staged_path_record_batch(
            connection,
            last_path_rowid,
            USN_RESOLVE_FILE_REF_BATCH_SIZE,
        )?;
        if records.is_empty() {
            break;
        }
        for (rowid, path, record) in records {
            last_path_rowid = rowid;
            throw_if_cancelled(should_cancel)?;
            let path_key = normalize_path_key(&path);
            if path_key == requested_root_key
                || path_key_is_same_or_descendant(&path_key, &requested_root_key)
            {
                if path_key == requested_root_key {
                    continue;
                }
                chunk.push(usn_record_to_indexed_record(&path, &record));
                emitted = true;
                if chunk.len() >= PATH_INDEX_INSERT_CHUNK_SIZE {
                    flush_index_record_chunk(connection, root_id, &mut chunk, &mut stats)?;
                }
            }
        }
    }
    drop_usn_stage(connection)?;
    flush_index_record_chunk(connection, root_id, &mut chunk, &mut stats)?;
    if !emitted && requested_root_path.exists() {
        return Err(format!(
            "USN enumeration produced no entries under {}",
            requested_root_path.display()
        ));
    }
    Ok(stats)
}

fn upsert_volume_building(
    connection: &Connection,
    volume_root: &Path,
    source: &PathIndexBuildSource,
) -> Result<(), String> {
    crate::upsert_volume_state(
        connection,
        &PathIndexVolumeState {
            volume_key: source.volume_key.clone(),
            drive_root: volume_root.to_string_lossy().to_string(),
            journal_id: source.journal_id,
            last_usn: source.last_usn,
            lowest_valid_usn: source.lowest_valid_usn,
            source: source.source.clone(),
            state: "building".to_string(),
            entry_count: 0,
            directory_count: 0,
            file_count: 0,
            last_indexed_at_ms: Some(crate::now_ms()),
            last_error: None,
        },
    )
}

fn create_usn_stage(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(
            r#"
            DROP TABLE IF EXISTS temp.path_index_usn_stage;
            CREATE TEMP TABLE path_index_usn_stage (
                file_ref TEXT PRIMARY KEY,
                parent_file_ref TEXT NOT NULL,
                name TEXT NOT NULL,
                file_attributes INTEGER NOT NULL,
                timestamp_ms INTEGER NOT NULL
            );
            CREATE INDEX temp.idx_path_index_usn_stage_parent
                ON path_index_usn_stage(parent_file_ref);
            "#,
        )
        .map_err(|error| format!("Failed to create USN staging table: {error}"))
}

fn drop_usn_stage(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(
            r#"
            DROP TABLE IF EXISTS temp.path_index_usn_paths;
            DROP TABLE IF EXISTS temp.path_index_usn_stage;
            "#,
        )
        .map_err(|error| format!("Failed to clear USN staging table: {error}"))
}

fn stage_usn_records<F>(
    connection: &mut Connection,
    handle: HANDLE,
    high_usn: i64,
    should_cancel: &mut F,
) -> Result<(), String>
where
    F: FnMut() -> PathIndexCancellation,
{
    let mut input = MFT_ENUM_DATA_V0 {
        StartFileReferenceNumber: 0,
        LowUsn: 0,
        HighUsn: high_usn,
    };
    let mut output = vec![0u8; USN_ENUM_BUFFER_BYTES];
    let mut chunk = Vec::<UsnRecord>::with_capacity(USN_STAGE_CHUNK_SIZE);

    loop {
        throw_if_cancelled(should_cancel)?;
        let mut returned = 0u32;
        let ok = unsafe {
            DeviceIoControl(
                handle,
                FSCTL_ENUM_USN_DATA,
                &mut input as *mut _ as *mut _,
                size_of::<MFT_ENUM_DATA_V0>() as u32,
                output.as_mut_ptr() as *mut _,
                output.len() as u32,
                &mut returned,
                std::ptr::null_mut(),
            )
        };
        if ok == 0 {
            let error = unsafe { GetLastError() };
            if error == ERROR_HANDLE_EOF {
                break;
            }
            return Err(format!(
                "FSCTL_ENUM_USN_DATA failed while reading MFT records: Win32 error {error}"
            ));
        }
        if returned <= 8 {
            break;
        }
        let returned_len = returned as usize;
        input.StartFileReferenceNumber = read_u64(&output, 0)?;
        let mut offset = 8usize;
        while offset + 8 <= returned_len {
            let record_len = read_u32(&output, offset)? as usize;
            if record_len == 0 || offset + record_len > returned_len {
                break;
            }
            if let Some(record) = parse_usn_record(&output[offset..offset + record_len])? {
                chunk.push(record);
                if chunk.len() >= USN_STAGE_CHUNK_SIZE {
                    flush_usn_stage_chunk(connection, &mut chunk)?;
                }
            }
            offset += record_len;
        }
    }
    flush_usn_stage_chunk(connection, &mut chunk)
}

fn flush_usn_stage_chunk(
    connection: &mut Connection,
    chunk: &mut Vec<UsnRecord>,
) -> Result<(), String> {
    if chunk.is_empty() {
        return Ok(());
    }
    let tx = connection
        .transaction()
        .map_err(|error| format!("Failed to start USN staging transaction: {error}"))?;
    {
        let mut insert = tx
            .prepare(
                r#"
                INSERT OR REPLACE INTO path_index_usn_stage (
                    file_ref, parent_file_ref, name, file_attributes, timestamp_ms
                ) VALUES (?1, ?2, ?3, ?4, ?5)
                "#,
            )
            .map_err(|error| format!("Failed to prepare USN stage insert: {error}"))?;
        for record in chunk.iter() {
            insert
                .execute(params![
                    &record.file_ref,
                    &record.parent_file_ref,
                    &record.name,
                    record.file_attributes as i64,
                    record.timestamp_ms as i64,
                ])
                .map_err(|error| format!("Failed to insert USN stage record: {error}"))?;
        }
    }
    tx.commit()
        .map_err(|error| format!("Failed to commit USN stage chunk: {error}"))?;
    chunk.clear();
    Ok(())
}

fn create_usn_path_stage<F>(
    connection: &mut Connection,
    volume_root: &Path,
    should_cancel: &mut F,
) -> Result<(), String>
where
    F: FnMut() -> PathIndexCancellation,
{
    connection
        .execute_batch(
            r#"
            DROP TABLE IF EXISTS temp.path_index_usn_paths;
            CREATE TEMP TABLE path_index_usn_paths (
                file_ref TEXT PRIMARY KEY,
                path TEXT NOT NULL,
                depth INTEGER NOT NULL
            );
            CREATE INDEX temp.idx_path_index_usn_paths_depth
                ON path_index_usn_paths(depth);
            "#,
        )
        .map_err(|error| format!("Failed to create USN path staging table: {error}"))?;
    seed_usn_root_paths(connection, volume_root)?;
    expand_usn_paths(connection, should_cancel)
}

fn seed_usn_root_paths(connection: &Connection, volume_root: &Path) -> Result<(), String> {
    let volume_root = volume_root.to_string_lossy().to_string();
    connection
        .execute(
            r#"
            INSERT OR IGNORE INTO path_index_usn_paths (file_ref, path, depth)
            SELECT file_ref, ?1, 0
            FROM path_index_usn_stage
            WHERE name = ''
               OR name = '.'
               OR parent_file_ref = file_ref
            "#,
            params![&volume_root],
        )
        .map_err(|error| format!("Failed to seed USN root path records: {error}"))?;

    let mut missing_parent_statement = connection
        .prepare(
            r#"
            SELECT DISTINCT child.parent_file_ref
            FROM path_index_usn_stage child
            LEFT JOIN path_index_usn_stage parent
              ON parent.file_ref = child.parent_file_ref
            WHERE parent.file_ref IS NULL
            "#,
        )
        .map_err(|error| format!("Failed to prepare missing USN parent query: {error}"))?;
    let missing_parent_refs = missing_parent_statement
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|error| format!("Failed to query missing USN parent refs: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Failed to read missing USN parent ref: {error}"))?;
    for file_ref in missing_parent_refs {
        if is_probable_ntfs_root_file_ref(&file_ref) {
            connection
                .execute(
                    r#"
                    INSERT OR IGNORE INTO path_index_usn_paths (file_ref, path, depth)
                    VALUES (?1, ?2, 0)
                    "#,
                    params![file_ref, &volume_root],
                )
                .map_err(|error| format!("Failed to seed inferred NTFS root path: {error}"))?;
        }
    }

    let root_count: i64 = connection
        .query_row("SELECT COUNT(*) FROM path_index_usn_paths", [], |row| row.get(0))
        .map_err(|error| format!("Failed to count seeded USN root paths: {error}"))?;
    if root_count == 0 {
        return Err(format!(
            "USN path reconstruction could not find a volume root record for {}",
            volume_root
        ));
    }
    Ok(())
}

fn expand_usn_paths<F>(connection: &Connection, should_cancel: &mut F) -> Result<(), String>
where
    F: FnMut() -> PathIndexCancellation,
{
    let mut depth = 0i64;
    loop {
        throw_if_cancelled(should_cancel)?;
        let inserted = connection
            .execute(
                r#"
                INSERT OR IGNORE INTO path_index_usn_paths (file_ref, path, depth)
                SELECT child.file_ref,
                       CASE
                         WHEN substr(parent.path, length(parent.path), 1) IN ('\', '/')
                           THEN parent.path || child.name
                         ELSE parent.path || '\' || child.name
                       END,
                       ?2
                FROM path_index_usn_stage child
                JOIN path_index_usn_paths parent
                  ON child.parent_file_ref = parent.file_ref
                WHERE parent.depth = ?1
                "#,
                params![depth, depth + 1],
            )
            .map_err(|error| {
                format!("Failed to expand USN path records at depth {depth}: {error}")
            })?;
        if inserted == 0 {
            break;
        }
        depth += 1;
        if depth > 512 {
            return Err("USN path reconstruction exceeded 512 directory levels".to_string());
        }
    }
    Ok(())
}

fn collect_staged_path_record_batch(
    connection: &Connection,
    after_rowid: i64,
    limit: i64,
) -> Result<Vec<(i64, PathBuf, UsnRecord)>, String> {
    let mut statement = connection
        .prepare(
            r#"
            SELECT paths.rowid,
                   paths.path,
                   stage.file_ref,
                   stage.parent_file_ref,
                   stage.name,
                   stage.file_attributes,
                   stage.timestamp_ms
            FROM path_index_usn_paths paths
            JOIN path_index_usn_stage stage
              ON stage.file_ref = paths.file_ref
            WHERE paths.rowid > ?1
            ORDER BY paths.rowid
            LIMIT ?2
            "#,
        )
        .map_err(|error| format!("Failed to prepare USN staged path records query: {error}"))?;
    let rows = statement
        .query_map(params![after_rowid, limit], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                PathBuf::from(row.get::<_, String>(1)?),
                UsnRecord {
                    file_ref: row.get(2)?,
                    parent_file_ref: row.get(3)?,
                    name: row.get(4)?,
                    file_attributes: row.get::<_, i64>(5)? as u32,
                    timestamp_ms: row.get::<_, i64>(6)?.max(0) as u64,
                },
            ))
        })
        .map_err(|error| format!("Failed to query USN staged path records: {error}"))?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Failed to read USN staged path record: {error}"))
}

fn full_mft_enum_high_usn() -> i64 {
    i64::MAX
}

fn is_probable_ntfs_root_file_ref(file_ref: &str) -> bool {
    const NTFS_ROOT_MFT_ENTRY_NUMBER: u64 = 5;
    const NTFS_FILE_NUMBER_MASK: u64 = 0x0000_FFFF_FFFF_FFFF;
    if let Ok(value) = file_ref.parse::<u64>() {
        return value & NTFS_FILE_NUMBER_MASK == NTFS_ROOT_MFT_ENTRY_NUMBER;
    }
    let normalized = file_ref.trim();
    if normalized.len() == 32 && normalized.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return normalized.starts_with("0500000000000000")
            || normalized.ends_with("0500000000000000")
            || normalized.ends_with("0000000000000005");
    }
    false
}

fn open_volume_handle(volume_root: &Path, write: bool) -> Result<VolumeHandle, String> {
    let value = volume_root.to_string_lossy();
    let bytes = value.as_bytes();
    if bytes.len() < 2 || bytes[1] != b':' {
        return Err(format!(
            "Cannot derive Win32 volume path from {}",
            volume_root.display()
        ));
    }
    let volume_path = format!(r"\\.\{}", &value[..2]);
    let wide = wide_null(&volume_path);
    let access = if write {
        GENERIC_READ | GENERIC_WRITE
    } else {
        GENERIC_READ
    };
    let handle = unsafe {
        CreateFileW(
            wide.as_ptr(),
            access,
            FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
            std::ptr::null(),
            OPEN_EXISTING,
            FILE_FLAG_BACKUP_SEMANTICS,
            std::ptr::null_mut(),
        )
    };
    if handle == INVALID_HANDLE_VALUE {
        let error = unsafe { GetLastError() };
        if error == ERROR_ACCESS_DENIED {
            return Err(format!(
                "{USN_RAW_ACCESS_DENIED_MESSAGE} for {volume_path}; run the GreebleFS USN service elevated/LocalSystem or run GreebleFS elevated to use the MFT fast path"
            ));
        }
        return Err(format!(
            "Failed to open NTFS volume {volume_path} for USN indexing: Win32 error {error}"
        ));
    }
    Ok(VolumeHandle(handle))
}

fn query_usn_journal(handle: HANDLE, volume_root: &Path) -> Result<USN_JOURNAL_DATA_V0, String> {
    let mut output = unsafe { zeroed::<USN_JOURNAL_DATA_V0>() };
    let mut returned = 0u32;
    let ok = unsafe {
        DeviceIoControl(
            handle,
            FSCTL_QUERY_USN_JOURNAL,
            std::ptr::null(),
            0,
            &mut output as *mut _ as *mut _,
            size_of::<USN_JOURNAL_DATA_V0>() as u32,
            &mut returned,
            std::ptr::null_mut(),
        )
    };
    if ok == 0 {
        let error = unsafe { GetLastError() };
        if error == ERROR_ACCESS_DENIED {
            return Err(format!(
                "{USN_RAW_ACCESS_DENIED_MESSAGE} while querying {}; run the GreebleFS USN service elevated/LocalSystem or run GreebleFS elevated to use the MFT fast path",
                volume_root.display()
            ));
        }
        if error == ERROR_JOURNAL_NOT_ACTIVE {
            return Err(format!(
                "{USN_JOURNAL_UNAVAILABLE_MESSAGE}: FSCTL_QUERY_USN_JOURNAL returned Win32 error {error} for {}",
                volume_root.display()
            ));
        }
        return Err(format!(
            "FSCTL_QUERY_USN_JOURNAL failed: Win32 error {error}"
        ));
    }
    Ok(output)
}

fn create_usn_journal(
    handle: HANDLE,
    volume_root: &Path,
    options: &UsnJournalOptions,
) -> Result<(), String> {
    let mut input = CREATE_USN_JOURNAL_DATA {
        MaximumSize: options.maximum_size_bytes,
        AllocationDelta: options.allocation_delta_bytes,
    };
    let mut returned = 0u32;
    let ok = unsafe {
        DeviceIoControl(
            handle,
            FSCTL_CREATE_USN_JOURNAL,
            &mut input as *mut _ as *mut _,
            size_of::<CREATE_USN_JOURNAL_DATA>() as u32,
            std::ptr::null_mut(),
            0,
            &mut returned,
            std::ptr::null_mut(),
        )
    };
    if ok == 0 {
        let error = unsafe { GetLastError() };
        return Err(format!(
            "FSCTL_CREATE_USN_JOURNAL failed for {}: Win32 error {error}",
            volume_root.display()
        ));
    }
    Ok(())
}

fn journal_state_from_raw(
    volume_root: &Path,
    journal: &USN_JOURNAL_DATA_V0,
) -> WindowsUsnJournalState {
    WindowsUsnJournalState {
        drive_root: volume_root.to_string_lossy().to_string(),
        volume_key: volume_key_for_path(volume_root),
        journal_id: journal.UsnJournalID,
        first_usn: journal.FirstUsn,
        next_usn: journal.NextUsn,
        lowest_valid_usn: journal.LowestValidUsn,
        maximum_size: journal.MaximumSize,
        allocation_delta: journal.AllocationDelta,
    }
}

fn parse_usn_record(bytes: &[u8]) -> Result<Option<UsnRecord>, String> {
    if bytes.len() < 8 {
        return Ok(None);
    }
    let major = read_u16(bytes, 4)?;
    match major {
        2 => parse_usn_record_v2(bytes).map(Some),
        3 => parse_usn_record_v3(bytes).map(Some),
        _ => Ok(None),
    }
}

fn parse_usn_record_v2(bytes: &[u8]) -> Result<UsnRecord, String> {
    if bytes.len() < 60 {
        return Err("Short USN_RECORD_V2 payload".to_string());
    }
    let file_ref = read_u64(bytes, 8)?.to_string();
    let parent_file_ref = read_u64(bytes, 16)?.to_string();
    let timestamp_ms = filetime_to_unix_ms(read_i64(bytes, 32)?);
    let file_attributes = read_u32(bytes, 52)?;
    let name_len = read_u16(bytes, 56)? as usize;
    let name_offset = read_u16(bytes, 58)? as usize;
    let name = read_utf16_name(bytes, name_offset, name_len)?;
    Ok(UsnRecord {
        file_ref,
        parent_file_ref,
        name,
        file_attributes,
        timestamp_ms,
    })
}

fn parse_usn_record_v3(bytes: &[u8]) -> Result<UsnRecord, String> {
    if bytes.len() < 76 {
        return Err("Short USN_RECORD_V3 payload".to_string());
    }
    let file_ref = hex_128(&bytes[8..24]);
    let parent_file_ref = hex_128(&bytes[24..40]);
    let timestamp_ms = filetime_to_unix_ms(read_i64(bytes, 48)?);
    let file_attributes = read_u32(bytes, 68)?;
    let name_len = read_u16(bytes, 72)? as usize;
    let name_offset = read_u16(bytes, 74)? as usize;
    let name = read_utf16_name(bytes, name_offset, name_len)?;
    Ok(UsnRecord {
        file_ref,
        parent_file_ref,
        name,
        file_attributes,
        timestamp_ms,
    })
}

fn usn_record_to_indexed_record(path: &Path, record: &UsnRecord) -> IndexedPathRecord {
    let is_dir = record.file_attributes & FILE_ATTRIBUTE_DIRECTORY != 0;
    let is_symlink = record.file_attributes & FILE_ATTRIBUTE_REPARSE_POINT != 0;
    indexed_record_from_path_shape(
        path,
        is_dir,
        is_symlink,
        record.timestamp_ms,
        record.file_attributes & FILE_ATTRIBUTE_HIDDEN != 0,
        Some(record.file_ref.clone()),
        Some(record.parent_file_ref.clone()),
    )
}

fn throw_if_cancelled<F>(should_cancel: &mut F) -> Result<(), String>
where
    F: FnMut() -> PathIndexCancellation,
{
    match should_cancel() {
        PathIndexCancellation::Continue => Ok(()),
        PathIndexCancellation::Cancelled => {
            Err("Path index Windows USN operation cancelled".to_string())
        }
    }
}

fn wide_null(value: &str) -> Vec<u16> {
    OsStr::new(value)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect()
}

fn read_utf16_name(bytes: &[u8], offset: usize, byte_len: usize) -> Result<String, String> {
    if offset + byte_len > bytes.len() || byte_len % 2 != 0 {
        return Err("Invalid USN filename range".to_string());
    }
    let units = bytes[offset..offset + byte_len]
        .chunks_exact(2)
        .map(|chunk| u16::from_le_bytes([chunk[0], chunk[1]]))
        .collect::<Vec<_>>();
    String::from_utf16(&units).map_err(|error| format!("Invalid UTF-16 USN filename: {error}"))
}

fn read_u16(bytes: &[u8], offset: usize) -> Result<u16, String> {
    if offset + 2 > bytes.len() {
        return Err("USN read_u16 out of bounds".to_string());
    }
    Ok(u16::from_le_bytes([bytes[offset], bytes[offset + 1]]))
}

fn read_u32(bytes: &[u8], offset: usize) -> Result<u32, String> {
    if offset + 4 > bytes.len() {
        return Err("USN read_u32 out of bounds".to_string());
    }
    Ok(u32::from_le_bytes([
        bytes[offset],
        bytes[offset + 1],
        bytes[offset + 2],
        bytes[offset + 3],
    ]))
}

fn read_u64(bytes: &[u8], offset: usize) -> Result<u64, String> {
    if offset + 8 > bytes.len() {
        return Err("USN read_u64 out of bounds".to_string());
    }
    Ok(u64::from_le_bytes([
        bytes[offset],
        bytes[offset + 1],
        bytes[offset + 2],
        bytes[offset + 3],
        bytes[offset + 4],
        bytes[offset + 5],
        bytes[offset + 6],
        bytes[offset + 7],
    ]))
}

fn read_i64(bytes: &[u8], offset: usize) -> Result<i64, String> {
    Ok(read_u64(bytes, offset)? as i64)
}

fn filetime_to_unix_ms(filetime: i64) -> u64 {
    if filetime <= WINDOWS_UNIX_EPOCH_TICKS {
        return 0;
    }
    ((filetime - WINDOWS_UNIX_EPOCH_TICKS) / WINDOWS_TICK_MS_DIVISOR) as u64
}

fn hex_128(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn journal_1179_is_classified_as_inactive() {
        assert!(is_journal_not_active_error(
            "FSCTL_QUERY_USN_JOURNAL failed: Win32 error 1179"
        ));
    }

    #[test]
    fn access_denied_is_classified_as_unavailable() {
        assert!(is_access_denied_error(
            "Windows USN indexing requires raw NTFS volume read permission"
        ));
    }

    #[test]
    fn full_mft_enumeration_uses_unbounded_usn_ceiling() {
        assert_eq!(full_mft_enum_high_usn(), i64::MAX);
    }

    #[test]
    fn ntfs_root_file_reference_is_recognized_from_file_number_bits() {
        assert!(is_probable_ntfs_root_file_ref("1407374883553285"));
        assert!(is_probable_ntfs_root_file_ref("5"));
        assert!(!is_probable_ntfs_root_file_ref("97380"));
    }
}
