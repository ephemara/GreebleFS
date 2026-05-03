use crate::explorer_path_key::ExplorerPathKey;
use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

const EXPLORER_IDENTITY_DB_ENV: &str = "OVERLAYTERM_EXPLORER_IDENTITY_DB_PATH";
static EXPLORER_IDENTITY_DB_PATH: OnceLock<PathBuf> = OnceLock::new();

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum ExplorerIdentityKind {
    Native,
    Operation,
    Derived,
}

#[derive(Debug, Clone)]
pub struct ExplorerResolvedIdentity {
    pub entity_id: String,
    pub identity_kind: ExplorerIdentityKind,
    pub content_revision: String,
}

#[derive(Debug, Clone)]
pub struct PersistedThumbnailArtifactRecordInput {
    pub entity_id: String,
    pub content_revision: String,
    pub kind: String,
    pub variant_key: String,
    pub poster_path: String,
    pub hover_frame_paths: Vec<String>,
    pub hover_frame_delay_ms: Option<u32>,
}

#[derive(Debug, Clone)]
struct PersistedPathIdentityAlias {
    path_key: String,
    entity_id: String,
    identity_kind: ExplorerIdentityKind,
    updated_at_ms: u64,
}

#[derive(Debug, Default)]
pub struct ExplorerIdentityManager {
    path_identity_aliases: Mutex<HashMap<String, PersistedPathIdentityAlias>>,
}

pub fn initialize_explorer_identity_store(app: &AppHandle) -> Result<(), String> {
    let db_path = app
        .path()
        .app_local_data_dir()
        .map_err(|error| format!("Failed to resolve app local data directory: {error}"))?
        .join("explorer-cache")
        .join("explorer-identity.sqlite3");

    let _ = EXPLORER_IDENTITY_DB_PATH.set(db_path.clone());
    ensure_schema(&db_path)?;
    Ok(())
}

pub fn build_content_revision(size: u64, modified: u64, is_dir: bool, is_symlink: bool) -> String {
    let mut hasher = Sha256::new();
    hasher.update(size.to_le_bytes());
    hasher.update(modified.to_le_bytes());
    hasher.update([if is_dir { 1 } else { 0 }]);
    hasher.update([if is_symlink { 1 } else { 0 }]);
    format!("rev-{:x}", hasher.finalize())
}

pub fn build_virtual_identity(
    namespace: &str,
    stable_key: &str,
    content_revision: &str,
) -> ExplorerResolvedIdentity {
    ExplorerResolvedIdentity {
        entity_id: build_entity_id(namespace, stable_key),
        identity_kind: ExplorerIdentityKind::Derived,
        content_revision: content_revision.to_string(),
    }
}

pub fn resolve_local_identity(
    app: &AppHandle,
    manager: &ExplorerIdentityManager,
    path: &Path,
    content_revision: &str,
) -> Result<ExplorerResolvedIdentity, String> {
    if let Some(native_key) = resolve_native_identity_key(path)? {
        let path_key = normalize_path_key(path);
        let _ = remove_path_identity_alias(app, manager, &path_key);
        return Ok(ExplorerResolvedIdentity {
            entity_id: build_entity_id("native", &native_key),
            identity_kind: ExplorerIdentityKind::Native,
            content_revision: content_revision.to_string(),
        });
    }

    let path_key = normalize_path_key(path);
    if let Some(alias) = load_path_identity_alias(app, manager, &path_key)? {
        return Ok(ExplorerResolvedIdentity {
            entity_id: alias.entity_id,
            identity_kind: alias.identity_kind,
            content_revision: content_revision.to_string(),
        });
    }

    let alias = PersistedPathIdentityAlias {
        path_key: path_key.clone(),
        entity_id: build_entity_id("derived", &path_key),
        identity_kind: ExplorerIdentityKind::Derived,
        updated_at_ms: now_ms(),
    };
    upsert_path_identity_alias(app, manager, alias.clone())?;
    Ok(ExplorerResolvedIdentity {
        entity_id: alias.entity_id,
        identity_kind: alias.identity_kind,
        content_revision: content_revision.to_string(),
    })
}

pub fn resolve_fast_local_listing_identity(
    manager: &ExplorerIdentityManager,
    path: &Path,
    content_revision: &str,
) -> ExplorerResolvedIdentity {
    let path_key = normalize_path_key(path);
    if let Ok(cache) = manager.path_identity_aliases.lock() {
        if let Some(alias) = cache.get(&path_key) {
            return ExplorerResolvedIdentity {
                entity_id: alias.entity_id.clone(),
                identity_kind: alias.identity_kind,
                content_revision: content_revision.to_string(),
            };
        }
    }

    build_virtual_identity("derived", &path_key, content_revision)
}

pub fn prepare_move_operation_continuity(
    app: &AppHandle,
    manager: &ExplorerIdentityManager,
    source_path: &Path,
    content_revision: &str,
) -> Result<Option<String>, String> {
    let identity = resolve_local_identity(app, manager, source_path, content_revision)?;
    if identity.identity_kind == ExplorerIdentityKind::Native {
        return Ok(None);
    }
    Ok(Some(identity.entity_id))
}

pub fn apply_move_operation_continuity(
    app: &AppHandle,
    manager: &ExplorerIdentityManager,
    source_path: &Path,
    destination_path: &Path,
    entity_id: Option<&str>,
) -> Result<(), String> {
    let source_key = normalize_path_key(source_path);
    remove_path_identity_alias(app, manager, &source_key)?;

    let Some(entity_id) = entity_id else {
        return Ok(());
    };

    let destination_key = normalize_path_key(destination_path);
    upsert_path_identity_alias(
        app,
        manager,
        PersistedPathIdentityAlias {
            path_key: destination_key,
            entity_id: entity_id.to_string(),
            identity_kind: ExplorerIdentityKind::Operation,
            updated_at_ms: now_ms(),
        },
    )
}

pub fn record_thumbnail_artifact(
    app: &AppHandle,
    record: PersistedThumbnailArtifactRecordInput,
) -> Result<(), String> {
    let artifact_key = build_thumbnail_artifact_key(
        &record.entity_id,
        &record.content_revision,
        &record.variant_key,
        &record.kind,
    );

    with_connection(app, |connection| {
        let hover_frame_paths = serde_json::to_string(&record.hover_frame_paths)
            .map_err(|error| format!("Failed to serialize thumbnail hover frame paths: {error}"))?;
        connection
            .execute(
                "
                INSERT INTO explorer_thumbnail_artifacts (
                    artifact_key,
                    entity_id,
                    content_revision,
                    kind,
                    variant_key,
                    poster_path,
                    hover_frame_paths_json,
                    hover_frame_delay_ms,
                    updated_at_ms
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
                ON CONFLICT(artifact_key) DO UPDATE SET
                    entity_id = excluded.entity_id,
                    content_revision = excluded.content_revision,
                    kind = excluded.kind,
                    variant_key = excluded.variant_key,
                    poster_path = excluded.poster_path,
                    hover_frame_paths_json = excluded.hover_frame_paths_json,
                    hover_frame_delay_ms = excluded.hover_frame_delay_ms,
                    updated_at_ms = excluded.updated_at_ms
                ",
                params![
                    artifact_key,
                    record.entity_id,
                    record.content_revision,
                    record.kind,
                    record.variant_key,
                    record.poster_path,
                    hover_frame_paths,
                    record.hover_frame_delay_ms.map(i64::from),
                    u64_to_i64(now_ms())?,
                ],
            )
            .map_err(|error| {
                format!("Failed to persist explorer thumbnail artifact record: {error}")
            })?;
        Ok(())
    })
}

fn resolve_db_path(app: &AppHandle) -> Result<PathBuf, String> {
    if let Ok(override_path) = std::env::var(EXPLORER_IDENTITY_DB_ENV) {
        let trimmed = override_path.trim();
        if !trimmed.is_empty() {
            return Ok(PathBuf::from(trimmed));
        }
    }

    if let Some(existing_path) = EXPLORER_IDENTITY_DB_PATH.get() {
        return Ok(existing_path.clone());
    }

    let db_path = app
        .path()
        .app_local_data_dir()
        .map_err(|error| format!("Failed to resolve app local data directory: {error}"))?
        .join("explorer-cache")
        .join("explorer-identity.sqlite3");
    let _ = EXPLORER_IDENTITY_DB_PATH.set(db_path.clone());
    Ok(db_path)
}

fn ensure_schema(path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to create explorer identity directory: {error}"))?;
    }

    let connection = Connection::open(path)
        .map_err(|error| format!("Failed to open explorer identity database: {error}"))?;
    connection
        .execute_batch(
            "
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            PRAGMA temp_store = MEMORY;

            CREATE TABLE IF NOT EXISTS explorer_path_identity_aliases (
                path_key TEXT PRIMARY KEY,
                entity_id TEXT NOT NULL,
                identity_kind TEXT NOT NULL,
                updated_at_ms INTEGER NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_explorer_path_identity_aliases_updated_at
            ON explorer_path_identity_aliases (updated_at_ms);

            CREATE TABLE IF NOT EXISTS explorer_thumbnail_artifacts (
                artifact_key TEXT PRIMARY KEY,
                entity_id TEXT NOT NULL,
                content_revision TEXT NOT NULL,
                kind TEXT NOT NULL,
                variant_key TEXT NOT NULL,
                poster_path TEXT NOT NULL,
                hover_frame_paths_json TEXT NOT NULL,
                hover_frame_delay_ms INTEGER,
                updated_at_ms INTEGER NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_explorer_thumbnail_artifacts_entity_revision
            ON explorer_thumbnail_artifacts (entity_id, content_revision);
            ",
        )
        .map_err(|error| format!("Failed to initialize explorer identity schema: {error}"))?;
    Ok(())
}

fn with_connection<T>(
    app: &AppHandle,
    operation: impl FnOnce(&Connection) -> Result<T, String>,
) -> Result<T, String> {
    let db_path = resolve_db_path(app)?;
    ensure_schema(&db_path)?;
    let connection = Connection::open(&db_path)
        .map_err(|error| format!("Failed to open explorer identity database: {error}"))?;
    operation(&connection)
}

fn build_entity_id(namespace: &str, stable_key: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(namespace.as_bytes());
    hasher.update(b":");
    hasher.update(stable_key.as_bytes());
    format!("entity-{:x}", hasher.finalize())
}

fn build_thumbnail_artifact_key(
    entity_id: &str,
    content_revision: &str,
    variant_key: &str,
    kind: &str,
) -> String {
    let mut hasher = Sha256::new();
    hasher.update(entity_id.as_bytes());
    hasher.update(b":");
    hasher.update(content_revision.as_bytes());
    hasher.update(b":");
    hasher.update(variant_key.as_bytes());
    hasher.update(b":");
    hasher.update(kind.as_bytes());
    format!("artifact-{:x}", hasher.finalize())
}

fn load_path_identity_alias(
    app: &AppHandle,
    manager: &ExplorerIdentityManager,
    path_key: &str,
) -> Result<Option<PersistedPathIdentityAlias>, String> {
    if let Ok(cache) = manager.path_identity_aliases.lock() {
        if let Some(alias) = cache.get(path_key) {
            return Ok(Some(alias.clone()));
        }
    }

    let alias = with_connection(app, |connection| {
        connection
            .query_row(
                "
                SELECT path_key, entity_id, identity_kind, updated_at_ms
                FROM explorer_path_identity_aliases
                WHERE path_key = ?1
                ",
                params![path_key],
                persisted_path_identity_alias_from_row,
            )
            .optional()
            .map_err(|error| format!("Failed to query explorer path identity alias: {error}"))
    })?;

    if let Some(alias) = alias.as_ref() {
        if let Ok(mut cache) = manager.path_identity_aliases.lock() {
            cache.insert(path_key.to_string(), alias.clone());
        }
    }

    Ok(alias)
}

fn upsert_path_identity_alias(
    app: &AppHandle,
    manager: &ExplorerIdentityManager,
    alias: PersistedPathIdentityAlias,
) -> Result<(), String> {
    with_connection(app, |connection| {
        connection
            .execute(
                "
                INSERT INTO explorer_path_identity_aliases (
                    path_key,
                    entity_id,
                    identity_kind,
                    updated_at_ms
                )
                VALUES (?1, ?2, ?3, ?4)
                ON CONFLICT(path_key) DO UPDATE SET
                    entity_id = excluded.entity_id,
                    identity_kind = excluded.identity_kind,
                    updated_at_ms = excluded.updated_at_ms
                ",
                params![
                    alias.path_key,
                    alias.entity_id,
                    identity_kind_to_storage(alias.identity_kind),
                    u64_to_i64(alias.updated_at_ms)?,
                ],
            )
            .map_err(|error| format!("Failed to upsert explorer path identity alias: {error}"))?;
        Ok(())
    })?;

    if let Ok(mut cache) = manager.path_identity_aliases.lock() {
        cache.insert(alias.path_key.clone(), alias);
    }
    Ok(())
}

fn remove_path_identity_alias(
    app: &AppHandle,
    manager: &ExplorerIdentityManager,
    path_key: &str,
) -> Result<(), String> {
    with_connection(app, |connection| {
        connection
            .execute(
                "
                DELETE FROM explorer_path_identity_aliases
                WHERE path_key = ?1
                ",
                params![path_key],
            )
            .map_err(|error| format!("Failed to delete explorer path identity alias: {error}"))?;
        Ok(())
    })?;

    if let Ok(mut cache) = manager.path_identity_aliases.lock() {
        cache.remove(path_key);
    }
    Ok(())
}

fn persisted_path_identity_alias_from_row(
    row: &Row<'_>,
) -> rusqlite::Result<PersistedPathIdentityAlias> {
    let identity_kind = identity_kind_from_storage(&row.get::<_, String>(2)?)
        .map_err(|error| rusqlite::Error::ToSqlConversionFailure(error.into()))?;
    Ok(PersistedPathIdentityAlias {
        path_key: row.get(0)?,
        entity_id: row.get(1)?,
        identity_kind,
        updated_at_ms: i64_to_u64(row.get::<_, i64>(3)?)
            .map_err(|error| rusqlite::Error::ToSqlConversionFailure(error.into()))?,
    })
}

fn identity_kind_to_storage(value: ExplorerIdentityKind) -> &'static str {
    match value {
        ExplorerIdentityKind::Native => "native",
        ExplorerIdentityKind::Operation => "operation",
        ExplorerIdentityKind::Derived => "derived",
    }
}

fn identity_kind_from_storage(value: &str) -> Result<ExplorerIdentityKind, String> {
    match value {
        "native" => Ok(ExplorerIdentityKind::Native),
        "operation" => Ok(ExplorerIdentityKind::Operation),
        "derived" => Ok(ExplorerIdentityKind::Derived),
        other => Err(format!("Unsupported explorer identity kind '{other}'")),
    }
}

fn normalize_path_key(path: &Path) -> String {
    ExplorerPathKey::from_path(path).into_string()
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

fn u64_to_i64(value: u64) -> Result<i64, String> {
    i64::try_from(value).map_err(|_| format!("Value {value} exceeds SQLite integer range"))
}

fn i64_to_u64(value: i64) -> Result<u64, String> {
    u64::try_from(value).map_err(|_| format!("Negative SQLite value {value} cannot become u64"))
}

#[cfg(target_family = "unix")]
fn resolve_native_identity_key(path: &Path) -> Result<Option<String>, String> {
    use std::os::unix::fs::MetadataExt;

    let metadata = std::fs::symlink_metadata(path).map_err(|error| {
        format!(
            "Failed to inspect local entry identity metadata '{}': {error}",
            path.display()
        )
    })?;
    let device_id = metadata.dev();
    let inode = metadata.ino();
    if inode == 0 {
        return Ok(None);
    }
    Ok(Some(format!("unix:{device_id}:{inode}")))
}

#[cfg(target_os = "windows")]
fn resolve_native_identity_key(path: &Path) -> Result<Option<String>, String> {
    use std::os::windows::fs::OpenOptionsExt;
    use std::os::windows::io::AsRawHandle;
    use windows_sys::Win32::Storage::FileSystem::{
        GetFileInformationByHandle, BY_HANDLE_FILE_INFORMATION, FILE_FLAG_BACKUP_SEMANTICS,
        FILE_FLAG_OPEN_REPARSE_POINT,
    };

    let file = std::fs::OpenOptions::new()
        .read(true)
        .custom_flags(FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT)
        .open(path);
    let Ok(file) = file else {
        return Ok(None);
    };

    let mut info = std::mem::MaybeUninit::<BY_HANDLE_FILE_INFORMATION>::zeroed();
    let handle = file.as_raw_handle();
    let success = unsafe { GetFileInformationByHandle(handle, info.as_mut_ptr()) };
    if success == 0 {
        return Ok(None);
    }

    let info = unsafe { info.assume_init() };
    let file_index = ((info.nFileIndexHigh as u64) << 32) | u64::from(info.nFileIndexLow);
    if file_index == 0 {
        return Ok(None);
    }

    Ok(Some(format!(
        "windows:{}:{}",
        info.dwVolumeSerialNumber, file_index
    )))
}

#[cfg(not(any(target_family = "unix", target_os = "windows")))]
fn resolve_native_identity_key(_path: &Path) -> Result<Option<String>, String> {
    Ok(None)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_virtual_identity_is_stable_for_same_key() {
        let revision = build_content_revision(42, 84, false, false);
        let left = build_virtual_identity("cloud", "cloud://test/item", &revision);
        let right = build_virtual_identity("cloud", "cloud://test/item", &revision);
        assert_eq!(left.entity_id, right.entity_id);
        assert_eq!(left.identity_kind, ExplorerIdentityKind::Derived);
        assert_eq!(left.content_revision, right.content_revision);
    }

    #[test]
    fn fast_listing_identity_uses_derived_path_identity_without_store_access() {
        let manager = ExplorerIdentityManager::default();
        let revision = build_content_revision(12, 34, false, false);
        let path = Path::new("C:\\workspace\\entry.txt");

        let left = resolve_fast_local_listing_identity(&manager, path, &revision);
        let right = resolve_fast_local_listing_identity(&manager, path, &revision);

        assert_eq!(left.entity_id, right.entity_id);
        assert_eq!(left.identity_kind, ExplorerIdentityKind::Derived);
        assert_eq!(left.content_revision, revision);
    }
}
