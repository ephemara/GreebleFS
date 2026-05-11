use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

#[cfg(target_os = "windows")]
pub mod windows_usn;

pub const PATH_INDEX_SCHEMA_VERSION: i64 = 2;
pub const PATH_INDEX_INSERT_CHUNK_SIZE: usize = 50_000;
pub const WINDOWS_USN_APP_SOURCE: &str = "windowsUsn";
pub const WINDOWS_USN_SERVICE_SOURCE: &str = "windowsUsnService";
pub const DEFAULT_USN_JOURNAL_MAXIMUM_SIZE_BYTES: u64 = 512 * 1024 * 1024;
pub const DEFAULT_USN_JOURNAL_ALLOCATION_DELTA_BYTES: u64 = 64 * 1024 * 1024;
pub const PATH_INDEX_SQLITE_BUSY_TIMEOUT_MS: u64 = 5_000;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct IndexedPathRecord {
    pub path: String,
    pub path_key: String,
    pub parent_path: String,
    pub parent_key: String,
    pub name: String,
    pub name_lower: String,
    pub extension: String,
    pub size: u64,
    pub modified_ms: u64,
    pub is_dir: bool,
    pub is_hidden: bool,
    pub is_symlink: bool,
    pub file_ref: Option<String>,
    pub parent_file_ref: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PathIndexBuildSource {
    pub source: String,
    pub volume_key: String,
    pub journal_id: Option<u64>,
    pub last_usn: Option<i64>,
    pub lowest_valid_usn: Option<i64>,
}

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PathIndexWriteStats {
    pub entry_count: i64,
    pub directory_count: i64,
    pub file_count: i64,
}

impl PathIndexWriteStats {
    pub fn observe(&mut self, record: &IndexedPathRecord) {
        self.entry_count += 1;
        if record.is_dir {
            self.directory_count += 1;
        } else {
            self.file_count += 1;
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PathIndexRootSummary {
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
    pub lowest_valid_usn: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PathIndexVolumeState {
    pub volume_key: String,
    pub drive_root: String,
    pub journal_id: Option<u64>,
    pub last_usn: Option<i64>,
    pub lowest_valid_usn: Option<i64>,
    pub source: String,
    pub state: String,
    pub entry_count: u64,
    pub directory_count: u64,
    pub file_count: u64,
    pub last_indexed_at_ms: Option<u64>,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UsnJournalOptions {
    pub maximum_size_bytes: u64,
    pub allocation_delta_bytes: u64,
}

impl Default for UsnJournalOptions {
    fn default() -> Self {
        Self {
            maximum_size_bytes: DEFAULT_USN_JOURNAL_MAXIMUM_SIZE_BYTES,
            allocation_delta_bytes: DEFAULT_USN_JOURNAL_ALLOCATION_DELTA_BYTES,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PathIndexCancellation {
    Continue,
    Cancelled,
}

pub fn ensure_path_index_schema(db_path: &Path) -> Result<(), String> {
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
    tune_connection(&connection)?;
    connection
        .execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS path_index_meta (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS path_index_roots (
                root_id INTEGER PRIMARY KEY,
                root_path TEXT NOT NULL UNIQUE,
                root_key TEXT NOT NULL UNIQUE,
                volume_key TEXT NOT NULL,
                state TEXT NOT NULL,
                source TEXT NOT NULL,
                journal_id INTEGER,
                last_usn INTEGER,
                lowest_valid_usn INTEGER,
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

            CREATE TABLE IF NOT EXISTS path_index_volumes (
                volume_key TEXT PRIMARY KEY,
                drive_root TEXT NOT NULL UNIQUE,
                journal_id INTEGER,
                last_usn INTEGER,
                lowest_valid_usn INTEGER,
                source TEXT NOT NULL,
                state TEXT NOT NULL,
                entry_count INTEGER NOT NULL DEFAULT 0,
                directory_count INTEGER NOT NULL DEFAULT 0,
                file_count INTEGER NOT NULL DEFAULT 0,
                indexed_at_ms INTEGER,
                last_error TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_path_index_entries_parent
                ON path_index_entries(root_id, parent_key, is_hidden, name_lower);
            CREATE INDEX IF NOT EXISTS idx_path_index_entries_name
                ON path_index_entries(root_id, name_lower);
            CREATE INDEX IF NOT EXISTS idx_path_index_entries_file_ref
                ON path_index_entries(root_id, file_ref);
            CREATE INDEX IF NOT EXISTS idx_path_index_volumes_drive_root
                ON path_index_volumes(drive_root);
            "#,
        )
        .map_err(|error| format!("Failed to initialize path index schema: {error}"))?;

    add_column_if_missing(
        &connection,
        "path_index_roots",
        "lowest_valid_usn",
        "INTEGER",
    )?;
    connection
        .execute(
            "INSERT OR REPLACE INTO path_index_meta (key, value) VALUES ('schemaVersion', ?1)",
            params![PATH_INDEX_SCHEMA_VERSION.to_string()],
        )
        .map_err(|error| format!("Failed to persist path index schema version: {error}"))?;
    Ok(())
}

pub fn open_index_connection(db_path: &Path) -> Result<Connection, String> {
    let connection = Connection::open(db_path)
        .map_err(|error| format!("Failed to open path index database: {error}"))?;
    tune_connection(&connection)?;
    Ok(connection)
}

pub fn tune_connection(connection: &Connection) -> Result<(), String> {
    connection
        .busy_timeout(Duration::from_millis(PATH_INDEX_SQLITE_BUSY_TIMEOUT_MS))
        .map_err(|error| format!("Failed to set path index busy timeout: {error}"))?;
    connection
        .pragma_update(None, "journal_mode", "WAL")
        .map_err(|error| format!("Failed to enable WAL for path index database: {error}"))?;
    connection
        .pragma_update(None, "synchronous", "NORMAL")
        .map_err(|error| format!("Failed to tune path index database sync mode: {error}"))?;
    Ok(())
}

pub fn prepare_replace_index_root(
    connection: &mut Connection,
    root_path: &Path,
    root_key: &str,
    source: &PathIndexBuildSource,
) -> Result<i64, String> {
    let tx = connection
        .transaction()
        .map_err(|error| format!("Failed to start path index transaction: {error}"))?;
    tx.execute(
        r#"
        INSERT INTO path_index_roots (
            root_path, root_key, volume_key, state, source, journal_id, last_usn,
            lowest_valid_usn, indexed_at_ms, last_error
        ) VALUES (?1, ?2, ?3, 'building', ?4, ?5, ?6, ?7, ?8, NULL)
        ON CONFLICT(root_key) DO UPDATE SET
            root_path = excluded.root_path,
            volume_key = excluded.volume_key,
            state = 'building',
            source = excluded.source,
            journal_id = excluded.journal_id,
            last_usn = excluded.last_usn,
            lowest_valid_usn = excluded.lowest_valid_usn,
            indexed_at_ms = excluded.indexed_at_ms,
            last_error = NULL
        "#,
        params![
            root_path.to_string_lossy().to_string(),
            root_key,
            &source.volume_key,
            &source.source,
            source.journal_id.map(|value| value as i64),
            source.last_usn,
            source.lowest_valid_usn,
            now_ms() as i64,
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
    tx.commit()
        .map_err(|error| format!("Failed to commit path index root preparation: {error}"))?;
    Ok(root_id)
}

pub fn flush_index_record_chunk(
    connection: &mut Connection,
    root_id: i64,
    chunk: &mut Vec<IndexedPathRecord>,
    stats: &mut PathIndexWriteStats,
) -> Result<(), String> {
    if chunk.is_empty() {
        return Ok(());
    }
    let tx = connection
        .transaction()
        .map_err(|error| format!("Failed to start path index insert chunk: {error}"))?;
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
        for record in chunk.iter() {
            insert
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
                .map_err(|error| {
                    format!("Failed to insert path index entry {}: {error}", record.path)
                })?;
            stats.observe(record);
        }
    }
    tx.commit()
        .map_err(|error| format!("Failed to commit path index insert chunk: {error}"))?;
    chunk.clear();
    Ok(())
}

pub fn finalize_index_root(
    connection: &mut Connection,
    root_id: i64,
    source: &PathIndexBuildSource,
    stats: PathIndexWriteStats,
) -> Result<(), String> {
    connection
        .execute(
            r#"
            UPDATE path_index_roots
            SET state = 'ready',
                source = ?2,
                journal_id = ?3,
                last_usn = ?4,
                lowest_valid_usn = ?5,
                entry_count = ?6,
                directory_count = ?7,
                file_count = ?8,
                indexed_at_ms = ?9,
                last_error = NULL
            WHERE root_id = ?1
            "#,
            params![
                root_id,
                &source.source,
                source.journal_id.map(|value| value as i64),
                source.last_usn,
                source.lowest_valid_usn,
                stats.entry_count,
                stats.directory_count,
                stats.file_count,
                now_ms() as i64,
            ],
        )
        .map_err(|error| format!("Failed to finalize path index root: {error}"))?;
    let _ = upsert_volume_state(
        connection,
        &PathIndexVolumeState {
            volume_key: source.volume_key.clone(),
            drive_root: String::new(),
            journal_id: source.journal_id,
            last_usn: source.last_usn,
            lowest_valid_usn: source.lowest_valid_usn,
            source: source.source.clone(),
            state: "ready".to_string(),
            entry_count: stats.entry_count.max(0) as u64,
            directory_count: stats.directory_count.max(0) as u64,
            file_count: stats.file_count.max(0) as u64,
            last_indexed_at_ms: Some(now_ms()),
            last_error: None,
        },
    );
    Ok(())
}

pub fn upsert_volume_state(
    connection: &Connection,
    state: &PathIndexVolumeState,
) -> Result<(), String> {
    if state.drive_root.trim().is_empty() {
        connection
            .execute(
                r#"
                UPDATE path_index_volumes
                SET journal_id = ?2,
                    last_usn = ?3,
                    lowest_valid_usn = ?4,
                    source = ?5,
                    state = ?6,
                    entry_count = ?7,
                    directory_count = ?8,
                    file_count = ?9,
                    indexed_at_ms = ?10,
                    last_error = ?11
                WHERE volume_key = ?1
                "#,
                params![
                    &state.volume_key,
                    state.journal_id.map(|value| value as i64),
                    state.last_usn,
                    state.lowest_valid_usn,
                    &state.source,
                    &state.state,
                    state.entry_count as i64,
                    state.directory_count as i64,
                    state.file_count as i64,
                    state.last_indexed_at_ms.map(|value| value as i64),
                    &state.last_error,
                ],
            )
            .map_err(|error| format!("Failed to update path index volume state: {error}"))?;
        return Ok(());
    }

    connection
        .execute(
            r#"
            INSERT INTO path_index_volumes (
                volume_key, drive_root, journal_id, last_usn, lowest_valid_usn, source, state,
                entry_count, directory_count, file_count, indexed_at_ms, last_error
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
            ON CONFLICT(volume_key) DO UPDATE SET
                drive_root = excluded.drive_root,
                journal_id = excluded.journal_id,
                last_usn = excluded.last_usn,
                lowest_valid_usn = excluded.lowest_valid_usn,
                source = excluded.source,
                state = excluded.state,
                entry_count = excluded.entry_count,
                directory_count = excluded.directory_count,
                file_count = excluded.file_count,
                indexed_at_ms = excluded.indexed_at_ms,
                last_error = excluded.last_error
            "#,
            params![
                &state.volume_key,
                &state.drive_root,
                state.journal_id.map(|value| value as i64),
                state.last_usn,
                state.lowest_valid_usn,
                &state.source,
                &state.state,
                state.entry_count as i64,
                state.directory_count as i64,
                state.file_count as i64,
                state.last_indexed_at_ms.map(|value| value as i64),
                &state.last_error,
            ],
        )
        .map_err(|error| format!("Failed to upsert path index volume state: {error}"))?;
    Ok(())
}

pub fn mark_volume_error(
    connection: &Connection,
    drive_root: &Path,
    source: &str,
    error: &str,
) -> Result<(), String> {
    let drive_root = normalize_drive_root(drive_root)?;
    let volume_key = volume_key_for_path(&drive_root);
    upsert_volume_state(
        connection,
        &PathIndexVolumeState {
            volume_key,
            drive_root: drive_root.to_string_lossy().to_string(),
            journal_id: None,
            last_usn: None,
            lowest_valid_usn: None,
            source: source.to_string(),
            state: "error".to_string(),
            entry_count: 0,
            directory_count: 0,
            file_count: 0,
            last_indexed_at_ms: Some(now_ms()),
            last_error: Some(error.to_string()),
        },
    )
}

pub fn load_volume_states(db_path: &Path) -> Result<Vec<PathIndexVolumeState>, String> {
    let connection = open_index_connection(db_path)?;
    let mut statement = connection
        .prepare(
            r#"
            SELECT volume_key, drive_root, journal_id, last_usn, lowest_valid_usn, source, state,
                   entry_count, directory_count, file_count, indexed_at_ms, last_error
            FROM path_index_volumes
            ORDER BY drive_root ASC
            "#,
        )
        .map_err(|error| format!("Failed to prepare path index volume status query: {error}"))?;
    let rows = statement
        .query_map([], row_to_volume_state)
        .map_err(|error| format!("Failed to query path index volume status: {error}"))?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Failed to read path index volume status row: {error}"))
}

pub fn load_root_summary_for_key(
    db_path: &Path,
    root_key: &str,
) -> Result<Option<PathIndexRootSummary>, String> {
    let connection = open_index_connection(db_path)?;
    connection
        .query_row(
            r#"
            SELECT root_path, root_key, volume_key, state, source, entry_count,
                   directory_count, file_count, indexed_at_ms, last_error, journal_id,
                   last_usn, lowest_valid_usn
            FROM path_index_roots
            WHERE root_key = ?1
            "#,
            params![root_key],
            row_to_root_summary,
        )
        .optional()
        .map_err(|error| format!("Failed to load path index root summary: {error}"))
}

pub fn normalize_drive_root(path: &Path) -> Result<PathBuf, String> {
    let value = path.to_string_lossy().replace('/', "\\");
    let bytes = value.as_bytes();
    if bytes.len() >= 2 && bytes[1] == b':' {
        return Ok(PathBuf::from(format!("{}\\", &value[..2])));
    }
    Err(format!(
        "Windows drive-root normalization requires a drive-letter path, got {}",
        path.display()
    ))
}

pub fn normalize_path_key(path: &Path) -> String {
    normalize_path_key_raw(path.to_string_lossy().as_ref())
}

pub fn normalize_path_key_raw(raw: &str) -> String {
    #[cfg(target_os = "windows")]
    {
        let mut value = raw.trim().replace('/', "\\");
        if let Some(stripped) = value.strip_prefix(r"\\?\UNC\") {
            value = format!(r"\\{stripped}");
        } else if let Some(stripped) = value.strip_prefix(r"\\?\") {
            value = stripped.to_string();
        }

        let minimum_len = windows_minimum_trailing_separator_len(&value);
        while value.len() > minimum_len && value.ends_with('\\') {
            value.pop();
        }

        value.to_ascii_lowercase()
    }

    #[cfg(not(target_os = "windows"))]
    {
        let mut value = raw.trim().to_string();
        while value.len() > 1 && value.ends_with('/') {
            value.pop();
        }
        value
    }
}

pub fn path_key_is_same_or_descendant(candidate: &str, ancestor: &str) -> bool {
    let normalized_candidate = normalize_path_key_raw(candidate);
    let normalized_ancestor = normalize_path_key_raw(ancestor);
    normalized_candidate == normalized_ancestor
        || normalized_candidate.starts_with(&descendant_prefix(&normalized_ancestor))
}

pub fn descendant_prefix(normalized_key: &str) -> String {
    let separator = path_separator();
    if normalized_key.ends_with(separator) {
        normalized_key.to_string()
    } else {
        format!("{normalized_key}{separator}")
    }
}

pub fn volume_key_for_path(path: &Path) -> String {
    #[cfg(target_os = "windows")]
    {
        if let Ok(root) = normalize_drive_root(path) {
            return normalize_path_key(&root);
        }
    }

    normalize_path_key(path)
}

pub fn indexed_record_from_path_shape(
    path: &Path,
    is_dir: bool,
    is_symlink: bool,
    modified_ms: u64,
    is_hidden: bool,
    file_ref: Option<String>,
    parent_file_ref: Option<String>,
) -> IndexedPathRecord {
    let parent_path = path.parent().unwrap_or(path).to_path_buf();
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_string();
    IndexedPathRecord {
        path: path.to_string_lossy().to_string(),
        path_key: normalize_path_key(path),
        parent_path: parent_path.to_string_lossy().to_string(),
        parent_key: normalize_path_key(&parent_path),
        name: name.clone(),
        name_lower: name.to_ascii_lowercase(),
        extension: if is_dir {
            String::new()
        } else {
            normalized_extension(path)
        },
        size: 0,
        modified_ms,
        is_dir,
        is_hidden: is_hidden || name.starts_with('.'),
        is_symlink,
        file_ref,
        parent_file_ref,
    }
}

pub fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().min(u128::from(u64::MAX)) as u64)
        .unwrap_or(0)
}

pub fn path_separator() -> &'static str {
    #[cfg(target_os = "windows")]
    {
        "\\"
    }
    #[cfg(not(target_os = "windows"))]
    {
        "/"
    }
}

fn add_column_if_missing(
    connection: &Connection,
    table_name: &str,
    column_name: &str,
    column_type: &str,
) -> Result<(), String> {
    if table_has_column(connection, table_name, column_name)? {
        return Ok(());
    }
    connection
        .execute(
            &format!("ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}"),
            [],
        )
        .map_err(|error| {
            format!("Failed to add path index schema column {table_name}.{column_name}: {error}")
        })?;
    Ok(())
}

fn table_has_column(
    connection: &Connection,
    table_name: &str,
    column_name: &str,
) -> Result<bool, String> {
    let mut statement = connection
        .prepare(&format!("PRAGMA table_info({table_name})"))
        .map_err(|error| format!("Failed to inspect path index table {table_name}: {error}"))?;
    let rows = statement
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|error| format!("Failed to read path index table {table_name}: {error}"))?;
    for row in rows {
        if row.map_err(|error| format!("Failed to read path index column: {error}"))? == column_name
        {
            return Ok(true);
        }
    }
    Ok(false)
}

fn row_to_volume_state(row: &rusqlite::Row<'_>) -> rusqlite::Result<PathIndexVolumeState> {
    Ok(PathIndexVolumeState {
        volume_key: row.get(0)?,
        drive_root: row.get(1)?,
        journal_id: row
            .get::<_, Option<i64>>(2)?
            .map(|value| value.max(0) as u64),
        last_usn: row.get(3)?,
        lowest_valid_usn: row.get(4)?,
        source: row.get(5)?,
        state: row.get(6)?,
        entry_count: row.get::<_, i64>(7)?.max(0) as u64,
        directory_count: row.get::<_, i64>(8)?.max(0) as u64,
        file_count: row.get::<_, i64>(9)?.max(0) as u64,
        last_indexed_at_ms: row
            .get::<_, Option<i64>>(10)?
            .map(|value| value.max(0) as u64),
        last_error: row.get(11)?,
    })
}

fn row_to_root_summary(row: &rusqlite::Row<'_>) -> rusqlite::Result<PathIndexRootSummary> {
    Ok(PathIndexRootSummary {
        root_path: row.get(0)?,
        root_key: row.get(1)?,
        volume_key: row.get(2)?,
        state: row.get(3)?,
        source: row.get(4)?,
        entry_count: row.get::<_, i64>(5)?.max(0) as u64,
        directory_count: row.get::<_, i64>(6)?.max(0) as u64,
        file_count: row.get::<_, i64>(7)?.max(0) as u64,
        last_indexed_at_ms: row
            .get::<_, Option<i64>>(8)?
            .map(|value| value.max(0) as u64),
        last_error: row.get(9)?,
        journal_id: row
            .get::<_, Option<i64>>(10)?
            .map(|value| value.max(0) as u64),
        last_usn: row.get(11)?,
        lowest_valid_usn: row.get(12)?,
    })
}

fn normalized_extension(path: &Path) -> String {
    path.extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
}

fn clamp_u64_to_i64(value: u64) -> i64 {
    value.min(i64::MAX as u64) as i64
}

#[cfg(target_os = "windows")]
fn windows_minimum_trailing_separator_len(value: &str) -> usize {
    let bytes = value.as_bytes();
    if bytes.len() >= 3 && bytes[1] == b':' && bytes[2] == b'\\' {
        return 3;
    }
    if value == r"\" {
        return 1;
    }
    0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn path_keys_do_not_match_sibling_prefixes() {
        assert!(path_key_is_same_or_descendant(
            "/workspace/foo/bar.txt",
            "/workspace/foo"
        ));
        assert!(!path_key_is_same_or_descendant(
            "/workspace/foobar/bar.txt",
            "/workspace/foo"
        ));
    }

    #[test]
    fn schema_migrates_to_v2() {
        let temp = tempfile::tempdir().expect("tempdir");
        let db_path = temp.path().join("index.sqlite");
        ensure_path_index_schema(&db_path).expect("schema");
        let connection = Connection::open(&db_path).expect("open");
        let version: String = connection
            .query_row(
                "SELECT value FROM path_index_meta WHERE key = 'schemaVersion'",
                [],
                |row| row.get(0),
            )
            .expect("version");
        assert_eq!(version, "2");
        assert!(
            table_has_column(&connection, "path_index_roots", "lowest_valid_usn")
                .expect("column check")
        );
    }
}
