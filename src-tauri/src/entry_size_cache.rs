use crate::fs_commands::invalidate_all_fs_caches_for_path;
use notify::{RecursiveMode, Watcher};
use rusqlite::{params, params_from_iter, Connection, Row};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Manager, State};
use yazi_fs::{
    cha::ChaType,
    provider::{local::Local, Provider},
};
use yazi_shared::url::UrlLike;

const ENTRY_SIZE_DB_ENV: &str = "OVERLAYTERM_ENTRY_SIZE_DB_PATH";
static ENTRY_SIZE_DB_PATH: OnceLock<PathBuf> = OnceLock::new();

#[derive(Debug, Clone)]
pub struct PersistedEntrySize {
    pub path: String,
    pub bytes: u64,
    pub is_dir: bool,
    pub is_complete: bool,
    pub modified_ms: Option<u64>,
    pub entry_bytes: Option<u64>,
    pub measured_at_ms: u64,
    pub dirty: bool,
}

pub fn normalize_cache_path(path: &Path) -> String {
    let raw = path.to_string_lossy().to_string();
    raw.strip_prefix(r"\\?\").unwrap_or(&raw).to_string()
}

pub fn initialize_entry_size_cache(app: &AppHandle) -> Result<(), String> {
    let db_path = app
        .path()
        .app_local_data_dir()
        .map_err(|error| format!("Failed to resolve app local data directory: {error}"))?
        .join("explorer-cache")
        .join("entry-sizes.sqlite3");

    let _ = ENTRY_SIZE_DB_PATH.set(db_path.clone());
    ensure_schema(&db_path)?;
    Ok(())
}

fn resolve_db_path() -> Result<PathBuf, String> {
    if let Ok(override_path) = std::env::var(ENTRY_SIZE_DB_ENV) {
        let trimmed = override_path.trim();
        if !trimmed.is_empty() {
            return Ok(PathBuf::from(trimmed));
        }
    }

    ENTRY_SIZE_DB_PATH
        .get()
        .cloned()
        .ok_or_else(|| "Entry size cache has not been initialized".to_string())
}

fn ensure_schema(path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to create entry size cache directory: {error}"))?;
    }

    let connection = Connection::open(path)
        .map_err(|error| format!("Failed to open entry size cache database: {error}"))?;
    connection
        .execute_batch(
            "
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            PRAGMA temp_store = MEMORY;

            CREATE TABLE IF NOT EXISTS entry_size_cache (
                path TEXT PRIMARY KEY,
                bytes INTEGER NOT NULL,
                is_dir INTEGER NOT NULL,
                is_complete INTEGER NOT NULL,
                modified_ms INTEGER,
                entry_bytes INTEGER,
                measured_at_ms INTEGER NOT NULL,
                dirty INTEGER NOT NULL DEFAULT 0
            );

            CREATE INDEX IF NOT EXISTS idx_entry_size_cache_dirty
            ON entry_size_cache (dirty);
            ",
        )
        .map_err(|error| format!("Failed to initialize entry size cache schema: {error}"))?;
    Ok(())
}

fn with_connection<T>(
    operation: impl FnOnce(&Connection) -> Result<T, String>,
) -> Result<T, String> {
    let db_path = resolve_db_path()?;
    ensure_schema(&db_path)?;
    let connection = Connection::open(&db_path)
        .map_err(|error| format!("Failed to open entry size cache database: {error}"))?;
    operation(&connection)
}

fn u64_to_i64(value: u64) -> Result<i64, String> {
    i64::try_from(value).map_err(|_| format!("Value {value} exceeds SQLite integer range"))
}

fn i64_to_u64(value: i64) -> Result<u64, String> {
    u64::try_from(value).map_err(|_| format!("Negative SQLite value {value} cannot become u64"))
}

fn persisted_entry_size_from_row(row: &Row<'_>) -> rusqlite::Result<PersistedEntrySize> {
    Ok(PersistedEntrySize {
        path: row.get::<_, String>(0)?,
        bytes: i64_to_u64(row.get::<_, i64>(1)?)
            .map_err(|error| rusqlite::Error::ToSqlConversionFailure(error.into()))?,
        is_dir: row.get::<_, i64>(2)? != 0,
        is_complete: row.get::<_, i64>(3)? != 0,
        modified_ms: row
            .get::<_, Option<i64>>(4)?
            .map(i64_to_u64)
            .transpose()
            .map_err(|error| rusqlite::Error::ToSqlConversionFailure(error.into()))?,
        entry_bytes: row
            .get::<_, Option<i64>>(5)?
            .map(i64_to_u64)
            .transpose()
            .map_err(|error| rusqlite::Error::ToSqlConversionFailure(error.into()))?,
        measured_at_ms: i64_to_u64(row.get::<_, i64>(6)?)
            .map_err(|error| rusqlite::Error::ToSqlConversionFailure(error.into()))?,
        dirty: row.get::<_, i64>(7)? != 0,
    })
}

#[cfg(test)]
fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

pub fn load_entry_size_cache(
    paths: &[PathBuf],
) -> Result<HashMap<String, PersistedEntrySize>, String> {
    if paths.is_empty() {
        return Ok(HashMap::new());
    }

    with_connection(|connection| {
        const SQLITE_PARAMETER_LIMIT: usize = 900;

        let mut unique_keys = Vec::with_capacity(paths.len());
        let mut seen = HashMap::with_capacity(paths.len());
        for path in paths {
            let key = normalize_cache_path(path);
            if seen.insert(key.clone(), ()).is_none() {
                unique_keys.push(key);
            }
        }

        let mut entries = HashMap::with_capacity(unique_keys.len());
        for chunk in unique_keys.chunks(SQLITE_PARAMETER_LIMIT) {
            let placeholders = std::iter::repeat_n("?", chunk.len())
                .collect::<Vec<_>>()
                .join(", ");
            let query = format!(
                "
                SELECT path, bytes, is_dir, is_complete, modified_ms, entry_bytes, measured_at_ms, dirty
                FROM entry_size_cache
                WHERE path IN ({placeholders})
                "
            );
            let mut statement = connection
                .prepare(&query)
                .map_err(|error| format!("Failed to prepare entry size cache read: {error}"))?;
            let mut rows = statement
                .query(params_from_iter(chunk.iter()))
                .map_err(|error| format!("Failed to query entry size cache batch: {error}"))?;

            while let Some(row) = rows
                .next()
                .map_err(|error| format!("Failed to read entry size cache row: {error}"))?
            {
                let entry = persisted_entry_size_from_row(row)
                    .map_err(|error| format!("Failed to decode entry size cache row: {error}"))?;
                entries.insert(entry.path.clone(), entry);
            }
        }

        Ok(entries)
    })
}

pub fn upsert_entry_size_cache(entries: &[PersistedEntrySize]) -> Result<(), String> {
    if entries.is_empty() {
        return Ok(());
    }

    with_connection(|connection| {
        let mut statement = connection
            .prepare_cached(
                "
                INSERT INTO entry_size_cache (
                    path, bytes, is_dir, is_complete, modified_ms, entry_bytes, measured_at_ms, dirty
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
                ON CONFLICT(path) DO UPDATE SET
                    bytes = excluded.bytes,
                    is_dir = excluded.is_dir,
                    is_complete = excluded.is_complete,
                    modified_ms = excluded.modified_ms,
                    entry_bytes = excluded.entry_bytes,
                    measured_at_ms = excluded.measured_at_ms,
                    dirty = excluded.dirty
                ",
            )
            .map_err(|error| format!("Failed to prepare entry size cache upsert: {error}"))?;

        for entry in entries {
            statement
                .execute(params![
                    entry.path,
                    u64_to_i64(entry.bytes)?,
                    if entry.is_dir { 1_i64 } else { 0_i64 },
                    if entry.is_complete { 1_i64 } else { 0_i64 },
                    entry.modified_ms.map(u64_to_i64).transpose()?,
                    entry.entry_bytes.map(u64_to_i64).transpose()?,
                    u64_to_i64(entry.measured_at_ms)?,
                    if entry.dirty { 1_i64 } else { 0_i64 },
                ])
                .map_err(|error| {
                    format!(
                        "Failed to upsert cached entry size for {}: {error}",
                        entry.path
                    )
                })?;
        }

        Ok(())
    })
}

pub fn delete_entry_size_subtree(path: &Path) -> Result<(), String> {
    let key = normalize_cache_path(path);
    let subtree_prefix = format!("{}{}%", key, std::path::MAIN_SEPARATOR);

    with_connection(|connection| {
        connection
            .execute(
                "
                DELETE FROM entry_size_cache
                WHERE path = ?1 OR path LIKE ?2
                ",
                params![key, subtree_prefix],
            )
            .map_err(|error| {
                format!(
                    "Failed to delete cached subtree for {}: {error}",
                    path.display()
                )
            })?;
        Ok(())
    })
}

pub fn mark_path_and_ancestors_dirty(path: &Path) -> Result<(), String> {
    let mut keys = Vec::new();
    for ancestor in path.ancestors() {
        let key = normalize_cache_path(ancestor);
        if !key.is_empty() {
            keys.push(key);
        }
    }

    if keys.is_empty() {
        return Ok(());
    }

    with_connection(|connection| {
        let mut statement = connection
            .prepare_cached("UPDATE entry_size_cache SET dirty = 1 WHERE path = ?1")
            .map_err(|error| format!("Failed to prepare entry size dirty update: {error}"))?;

        for key in keys {
            statement
                .execute(params![key])
                .map_err(|error| format!("Failed to mark cached path dirty: {error}"))?;
        }

        Ok(())
    })
}

#[derive(Debug)]
struct ActiveEntrySizeWatcher {
    root: PathBuf,
    watcher: notify::RecommendedWatcher,
    ref_count: usize,
}

#[derive(Default)]
pub struct EntrySizeWatcherState {
    active: Mutex<HashMap<String, ActiveEntrySizeWatcher>>,
}

fn watch_key_for_path(path: &Path) -> String {
    std::fs::canonicalize(path)
        .map(|value| normalize_cache_path(&value))
        .unwrap_or_else(|_| normalize_cache_path(path))
}

fn handle_watch_event(event: notify::Event) {
    for path in event.paths {
        invalidate_all_fs_caches_for_path(&path);
    }
}

async fn resolve_watch_root(path: &str) -> Result<PathBuf, String> {
    let root = PathBuf::from(path);
    let provider = Local::regular(&root);
    let metadata = provider
        .metadata()
        .await
        .map_err(|error| format!("Path is not available for watching '{}': {error}", path))?;
    if !ChaType::from(metadata.mode).is_dir() {
        return Err(format!("Path is not a directory: {path}"));
    }

    Ok(provider
        .canonicalize()
        .await
        .ok()
        .and_then(|url| url.as_local().map(PathBuf::from))
        .unwrap_or(root))
}

#[tauri::command]
#[specta::specta]
pub async fn fs_watch_entry_size_root(
    state: State<'_, EntrySizeWatcherState>,
    path: String,
) -> Result<(), String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("path cannot be empty".to_string());
    }

    let root = resolve_watch_root(trimmed).await?;
    let watch_key = watch_key_for_path(&root);
    let mut active = state
        .active
        .lock()
        .map_err(|_| "entry size watcher state lock poisoned".to_string())?;

    if let Some(existing) = active.get_mut(&watch_key) {
        existing.ref_count += 1;
        return Ok(());
    }

    let watch_root = root.clone();
    let mut watcher = notify::recommended_watcher(move |result| {
        if let Ok(event) = result {
            handle_watch_event(event);
        }
    })
    .map_err(|error| format!("Could not create entry size watcher: {error}"))?;

    watcher
        .watch(&watch_root, RecursiveMode::Recursive)
        .map_err(|error| {
            format!(
                "Could not watch entry size root '{}': {error}",
                watch_root.display()
            )
        })?;

    active.insert(
        watch_key,
        ActiveEntrySizeWatcher {
            root: watch_root,
            watcher,
            ref_count: 1,
        },
    );

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn fs_unwatch_entry_size_root(
    state: State<'_, EntrySizeWatcherState>,
    path: String,
) -> Result<(), String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Ok(());
    }

    let watch_key = watch_key_for_path(Path::new(trimmed));
    let mut active = state
        .active
        .lock()
        .map_err(|_| "entry size watcher state lock poisoned".to_string())?;

    let should_remove = active
        .get(&watch_key)
        .map(|watcher| watcher.ref_count <= 1)
        .unwrap_or(false);

    if !should_remove {
        if let Some(existing) = active.get_mut(&watch_key) {
            existing.ref_count -= 1;
        }
        return Ok(());
    }

    if let Some(mut current) = active.remove(&watch_key) {
        let _ = current.watcher.unwatch(&current.root);
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::ffi::OsString;
    use tempfile::TempDir;

    static TEST_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

    fn test_lock() -> &'static Mutex<()> {
        TEST_LOCK.get_or_init(|| Mutex::new(()))
    }

    fn test_db_path(dir: &TempDir) -> PathBuf {
        dir.path().join("entry-size-cache.sqlite3")
    }

    struct EnvVarGuard {
        key: &'static str,
        previous: Option<OsString>,
    }

    impl EnvVarGuard {
        fn set(key: &'static str, value: &Path) -> Self {
            let previous = std::env::var_os(key);
            std::env::set_var(key, value);
            Self { key, previous }
        }
    }

    impl Drop for EnvVarGuard {
        fn drop(&mut self) {
            if let Some(previous) = self.previous.take() {
                std::env::set_var(self.key, previous);
            } else {
                std::env::remove_var(self.key);
            }
        }
    }

    #[test]
    fn persisted_entry_sizes_round_trip() {
        let _guard = test_lock().lock().expect("test lock");
        let dir = TempDir::new().expect("temp dir");
        let db_path = test_db_path(&dir);
        let _env_guard = EnvVarGuard::set(ENTRY_SIZE_DB_ENV, &db_path);

        let entry = PersistedEntrySize {
            path: normalize_cache_path(Path::new("C:\\cache\\assets")),
            bytes: 1024,
            is_dir: true,
            is_complete: true,
            modified_ms: Some(123),
            entry_bytes: None,
            measured_at_ms: now_ms(),
            dirty: false,
        };
        upsert_entry_size_cache(&[entry.clone()]).expect("upsert");

        let loaded =
            load_entry_size_cache(&[PathBuf::from("C:\\cache\\assets")]).expect("load round trip");
        let loaded_entry = loaded.get(&entry.path).expect("entry missing");
        assert_eq!(loaded_entry.bytes, entry.bytes);
        assert!(loaded_entry.is_dir);
        assert!(loaded_entry.is_complete);
    }

    #[test]
    fn dirty_marking_updates_ancestors() {
        let _guard = test_lock().lock().expect("test lock");
        let dir = TempDir::new().expect("temp dir");
        let db_path = test_db_path(&dir);
        let _env_guard = EnvVarGuard::set(ENTRY_SIZE_DB_ENV, &db_path);

        let root = dir.path().join("root");
        let nested = root.join("nested");
        let file = nested.join("payload.bin");

        let entries = [
            PersistedEntrySize {
                path: normalize_cache_path(&root),
                bytes: 10,
                is_dir: true,
                is_complete: true,
                modified_ms: Some(1),
                entry_bytes: None,
                measured_at_ms: now_ms(),
                dirty: false,
            },
            PersistedEntrySize {
                path: normalize_cache_path(&nested),
                bytes: 10,
                is_dir: true,
                is_complete: true,
                modified_ms: Some(2),
                entry_bytes: None,
                measured_at_ms: now_ms(),
                dirty: false,
            },
            PersistedEntrySize {
                path: normalize_cache_path(&file),
                bytes: 10,
                is_dir: false,
                is_complete: true,
                modified_ms: Some(3),
                entry_bytes: Some(10),
                measured_at_ms: now_ms(),
                dirty: false,
            },
        ];
        upsert_entry_size_cache(&entries).expect("seed");

        mark_path_and_ancestors_dirty(&file).expect("mark dirty");
        let loaded = load_entry_size_cache(&[root, nested, file]).expect("load dirty");
        assert!(loaded.values().all(|entry| entry.dirty));
    }

    #[test]
    fn load_entry_size_cache_batches_duplicate_and_missing_paths() {
        let _guard = test_lock().lock().expect("test lock");
        let dir = TempDir::new().expect("temp dir");
        let db_path = test_db_path(&dir);
        let _env_guard = EnvVarGuard::set(ENTRY_SIZE_DB_ENV, &db_path);

        let present_a = dir.path().join("present-a");
        let present_b = dir.path().join("present-b");
        let missing = dir.path().join("missing");
        let entries = [
            PersistedEntrySize {
                path: normalize_cache_path(&present_a),
                bytes: 64,
                is_dir: false,
                is_complete: true,
                modified_ms: Some(11),
                entry_bytes: Some(64),
                measured_at_ms: now_ms(),
                dirty: false,
            },
            PersistedEntrySize {
                path: normalize_cache_path(&present_b),
                bytes: 128,
                is_dir: true,
                is_complete: false,
                modified_ms: Some(22),
                entry_bytes: None,
                measured_at_ms: now_ms(),
                dirty: true,
            },
        ];
        upsert_entry_size_cache(&entries).expect("seed");

        let loaded =
            load_entry_size_cache(&[present_a.clone(), present_b.clone(), present_a, missing])
                .expect("batched load");

        assert_eq!(loaded.len(), 2);
        assert_eq!(
            loaded
                .get(&normalize_cache_path(&present_b))
                .expect("present b")
                .bytes,
            128
        );
        assert!(
            loaded
                .get(&normalize_cache_path(&present_b))
                .expect("present b")
                .dirty
        );
    }
}
