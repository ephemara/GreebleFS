use crate::explorer_identity::{build_content_revision, build_virtual_identity};
use crate::fs_commands::{
    fs_open_file, FileEntry, FileTransferCollisionPolicy, FileTransferDisposition,
    FileTransferOperation, FileTransferResult, FsWriteFileContent,
};
use base64::Engine as _;
use keyring::{Entry, Error as KeyringError};
use russh::{
    client::Handle as RusshHandle,
    keys::{HashAlg, PrivateKeyWithHashAlg, PublicKey, PublicKeyBase64},
};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    ffi::OsStr,
    fs,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager, State};
use tokio::{
    fs as tokio_fs,
    io::{AsyncReadExt, AsyncWriteExt},
    sync::Mutex as AsyncMutex,
};
use url::Url;
use uuid::Uuid;
use yazi_sftp::{
    fs::{Attrs, DirEntry as SftpDirEntry, Flags, ReadDir as SftpReadDir},
    Operator as SftpOperator,
};

const REMOTE_STORAGE_DIRECTORY: &str = "remote-storage";
const REMOTE_CONNECTIONS_FILE: &str = "connections.json";
const REMOTE_TRUSTED_HOSTS_FILE: &str = "trusted-hosts.json";
const REMOTE_TEMP_DIRECTORY: &str = "temp";
const REMOTE_KEYRING_SERVICE: &str = "co.greeblefs.app.remote-storage";
const REMOTE_TEXT_PREVIEW_MAX_BYTES: usize = 10 * 1024 * 1024;
const REMOTE_BASE64_PREVIEW_MAX_BYTES: usize = 12 * 1024 * 1024;
const REMOTE_PREVIEW_BYTES_MAX_BYTES: usize = 256 * 1024 * 1024;
const UNIX_S_IFMT: u32 = 0o170000;
const UNIX_S_IFDIR: u32 = 0o040000;
const UNIX_S_IFLNK: u32 = 0o120000;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, specta::Type, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum RemoteProtocol {
    Sftp,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, specta::Type, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum RemoteAuthMode {
    Password,
    PrivateKeyFile,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, specta::Type, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RemoteConnectionStatus {
    Disconnected,
    Connecting,
    Connected,
    Error,
    UntrustedHost,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct RemoteBreadcrumb {
    pub label: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct RemotePendingHostVerification {
    pub connection_id: String,
    pub host: String,
    pub port: u16,
    pub algorithm: String,
    pub fingerprint_sha256: String,
    pub public_key: String,
    pub observed_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct RemoteTrustedHostRecord {
    pub host: String,
    pub port: u16,
    pub algorithm: String,
    pub fingerprint_sha256: String,
    pub public_key: String,
    pub trusted_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct RemoteConnectionSummary {
    pub id: String,
    pub label: String,
    pub protocol: RemoteProtocol,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub start_path: String,
    pub auth_mode: RemoteAuthMode,
    pub private_key_path: Option<String>,
    pub status: RemoteConnectionStatus,
    pub last_error: Option<String>,
    pub pending_host_verification: Option<RemotePendingHostVerification>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct RemoteConnectionUpsertRequest {
    pub id: Option<String>,
    pub label: String,
    pub host: String,
    pub port: Option<u16>,
    pub username: String,
    pub start_path: String,
    pub auth_mode: RemoteAuthMode,
    pub private_key_path: Option<String>,
    pub password: Option<String>,
    pub key_passphrase: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct RemoteTrustedHostRemovalRequest {
    pub host: String,
    pub port: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct RemoteDirectoryListing {
    pub path: String,
    pub parent_path: Option<String>,
    pub breadcrumbs: Vec<RemoteBreadcrumb>,
    pub entries: Vec<FileEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PersistedRemoteConnections {
    connections: Vec<PersistedRemoteConnection>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PersistedRemoteConnection {
    id: String,
    label: String,
    protocol: RemoteProtocol,
    host: String,
    port: u16,
    username: String,
    start_path: String,
    auth_mode: RemoteAuthMode,
    private_key_path: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct PersistedTrustedHosts {
    hosts: Vec<RemoteTrustedHostRecord>,
}

#[derive(Debug, Clone)]
struct RemoteConnectionRuntimeStatus {
    status: RemoteConnectionStatus,
    last_error: Option<String>,
}

struct RemoteSftpSession {
    operator: AsyncMutex<SftpOperator>,
}

pub struct RemoteStorageState {
    sessions: AsyncMutex<HashMap<String, Arc<RemoteSftpSession>>>,
    statuses: Mutex<HashMap<String, RemoteConnectionRuntimeStatus>>,
    pending_host_verifications: Arc<Mutex<HashMap<String, RemotePendingHostVerification>>>,
}

impl Default for RemoteStorageState {
    fn default() -> Self {
        Self {
            sessions: AsyncMutex::new(HashMap::new()),
            statuses: Mutex::new(HashMap::new()),
            pending_host_verifications: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

#[derive(Debug, Clone)]
struct RemoteVirtualPath {
    connection_id: String,
    relative_segments: Vec<String>,
}

#[derive(Debug, Clone)]
struct RemoteHostKeyObservation {
    algorithm: String,
    fingerprint_sha256: String,
    public_key: String,
}

#[derive(Clone)]
struct RemoteClientHandler {
    connection_id: String,
    host: String,
    port: u16,
    trusted_host: Option<RemoteTrustedHostRecord>,
    pending_host_verifications: Arc<Mutex<HashMap<String, RemotePendingHostVerification>>>,
}

impl russh::client::Handler for RemoteClientHandler {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        server_public_key: &PublicKey,
    ) -> Result<bool, Self::Error> {
        let observation = observe_remote_host_key(server_public_key);
        match &self.trusted_host {
            Some(trusted)
                if trusted.algorithm == observation.algorithm
                    && trusted.fingerprint_sha256 == observation.fingerprint_sha256
                    && trusted.public_key == observation.public_key =>
            {
                clear_pending_host_verification(
                    &self.pending_host_verifications,
                    &self.connection_id,
                )
                .map_err(russh::Error::InvalidConfig)?;
                Ok(true)
            }
            _ => {
                record_pending_host_verification(
                    &self.pending_host_verifications,
                    RemotePendingHostVerification {
                        connection_id: self.connection_id.clone(),
                        host: self.host.clone(),
                        port: self.port,
                        algorithm: observation.algorithm,
                        fingerprint_sha256: observation.fingerprint_sha256,
                        public_key: observation.public_key,
                        observed_at: now_ms(),
                    },
                )?;
                Err(russh::Error::InvalidConfig(format!(
                    "Host key for {}:{} is not trusted yet.",
                    self.host, self.port
                )))
            }
        }
    }
}

#[tauri::command]
#[specta::specta]
pub async fn remote_list_connections(
    app: AppHandle,
    state: State<'_, RemoteStorageState>,
) -> Result<Vec<RemoteConnectionSummary>, String> {
    let persisted = read_remote_connections(&app)?;
    let statuses = clone_remote_statuses(&state)?;
    let pending = clone_pending_host_verifications(&state)?;
    let mut connections = persisted
        .connections
        .into_iter()
        .map(|connection| {
            let runtime = statuses.get(&connection.id);
            RemoteConnectionSummary {
                id: connection.id.clone(),
                label: connection.label.clone(),
                protocol: connection.protocol,
                host: connection.host.clone(),
                port: connection.port,
                username: connection.username.clone(),
                start_path: connection.start_path.clone(),
                auth_mode: connection.auth_mode,
                private_key_path: connection.private_key_path.clone(),
                status: runtime
                    .map(|status| status.status)
                    .unwrap_or(RemoteConnectionStatus::Disconnected),
                last_error: runtime.and_then(|status| status.last_error.clone()),
                pending_host_verification: pending.get(&connection.id).cloned(),
            }
        })
        .collect::<Vec<_>>();
    connections.sort_by(|left, right| {
        left.label
            .to_ascii_lowercase()
            .cmp(&right.label.to_ascii_lowercase())
            .then_with(|| left.host.cmp(&right.host))
            .then_with(|| left.start_path.cmp(&right.start_path))
    });
    Ok(connections)
}

#[tauri::command]
#[specta::specta]
pub async fn remote_upsert_connection(
    app: AppHandle,
    state: State<'_, RemoteStorageState>,
    request: RemoteConnectionUpsertRequest,
) -> Result<RemoteConnectionSummary, String> {
    let existing_connections = read_remote_connections(&app)?;
    let existing = request.id.as_deref().and_then(|id| {
        existing_connections
            .connections
            .iter()
            .find(|connection| connection.id == id)
            .cloned()
    });

    let id = request
        .id
        .clone()
        .unwrap_or_else(|| Uuid::new_v4().to_string());
    let label = normalize_required_text(&request.label, "Remote connection label")?;
    let host = normalize_required_text(&request.host, "Remote host")?;
    let username = normalize_required_text(&request.username, "Remote username")?;
    let start_path = normalize_remote_start_path(&request.start_path)?;
    let port = request.port.unwrap_or(22).max(1);

    let private_key_path = match request.auth_mode {
        RemoteAuthMode::Password => None,
        RemoteAuthMode::PrivateKeyFile => Some(normalize_required_text(
            request.private_key_path.as_deref().ok_or_else(|| {
                "Private key file path is required for private-key authentication.".to_string()
            })?,
            "Private key file path",
        )?),
    };

    let connection = PersistedRemoteConnection {
        id: id.clone(),
        label,
        protocol: RemoteProtocol::Sftp,
        host,
        port,
        username,
        start_path,
        auth_mode: request.auth_mode,
        private_key_path,
    };

    persist_remote_auth_secrets(&connection, &request, existing.as_ref())?;
    upsert_remote_connection(&app, connection.clone())?;
    remote_disconnect_inner(&state, &id).await?;
    update_remote_status(&state, &id, RemoteConnectionStatus::Disconnected, None)?;
    summarize_remote_connection(&state, connection)
}

#[tauri::command]
#[specta::specta]
pub async fn remote_delete_connection(
    app: AppHandle,
    state: State<'_, RemoteStorageState>,
    connection_id: String,
) -> Result<(), String> {
    remove_remote_connection(&app, &connection_id)?;
    delete_remote_auth_secrets(&connection_id)?;
    remote_disconnect_inner(&state, &connection_id).await?;
    clear_remote_status(&state, &connection_id)?;
    clear_pending_host_verification(&state.pending_host_verifications, &connection_id)?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn remote_connect(
    app: AppHandle,
    state: State<'_, RemoteStorageState>,
    connection_id: String,
) -> Result<RemoteConnectionSummary, String> {
    let connection = load_remote_connection(&app, &connection_id)?;
    let _ = get_or_connect_remote_session(&app, &state, &connection).await?;
    summarize_remote_connection(&state, connection)
}

#[tauri::command]
#[specta::specta]
pub async fn remote_disconnect(
    state: State<'_, RemoteStorageState>,
    connection_id: String,
) -> Result<(), String> {
    remote_disconnect_inner(&state, &connection_id).await
}

#[tauri::command]
#[specta::specta]
pub async fn remote_list_trusted_hosts(
    app: AppHandle,
) -> Result<Vec<RemoteTrustedHostRecord>, String> {
    let mut trusted_hosts = read_trusted_hosts(&app)?.hosts;
    trusted_hosts.sort_by(|left, right| {
        left.host
            .cmp(&right.host)
            .then_with(|| left.port.cmp(&right.port))
    });
    Ok(trusted_hosts)
}

#[tauri::command]
#[specta::specta]
pub async fn remote_trust_pending_host(
    app: AppHandle,
    state: State<'_, RemoteStorageState>,
    connection_id: String,
) -> Result<RemoteTrustedHostRecord, String> {
    let pending = {
        let pending = state
            .pending_host_verifications
            .lock()
            .map_err(|_| "remote pending host verification lock poisoned".to_string())?;
        pending.get(&connection_id).cloned().ok_or_else(|| {
            "No pending host verification is available for that connection.".to_string()
        })?
    };
    let trusted = RemoteTrustedHostRecord {
        host: pending.host.clone(),
        port: pending.port,
        algorithm: pending.algorithm.clone(),
        fingerprint_sha256: pending.fingerprint_sha256.clone(),
        public_key: pending.public_key.clone(),
        trusted_at: now_ms(),
    };
    upsert_trusted_host(&app, trusted.clone())?;
    clear_pending_host_verification(&state.pending_host_verifications, &connection_id)?;
    remote_disconnect_inner(&state, &connection_id).await?;
    update_remote_status(
        &state,
        &connection_id,
        RemoteConnectionStatus::Disconnected,
        None,
    )?;
    Ok(trusted)
}

#[tauri::command]
#[specta::specta]
pub async fn remote_remove_trusted_host(
    app: AppHandle,
    state: State<'_, RemoteStorageState>,
    request: RemoteTrustedHostRemovalRequest,
) -> Result<(), String> {
    remove_trusted_host(&app, &request.host, request.port)?;
    clear_pending_hosts_for_target(
        &state.pending_host_verifications,
        &request.host,
        request.port,
    )?;
    disconnect_sessions_for_host(&app, &state, &request.host, request.port).await?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn remote_list_dir(
    app: AppHandle,
    state: State<'_, RemoteStorageState>,
    path: String,
) -> Result<RemoteDirectoryListing, String> {
    let parsed = parse_remote_virtual_path(&path)?;
    let connection = load_remote_connection(&app, &parsed.connection_id)?;
    let session = get_or_connect_remote_session(&app, &state, &connection).await?;
    let actual_path = build_actual_remote_path(&connection.start_path, &parsed.relative_segments)?;
    let mut reader = {
        let operator = session.operator.lock().await;
        operator
            .read_dir(actual_path.as_str())
            .await
            .map_err(|error| remote_operation_error(error, true).message)?
    };
    let mut entries = Vec::new();
    while let Some(entry) = reader
        .next()
        .await
        .map_err(|error| remote_operation_error(error, true).message)?
    {
        entries.push(remote_dir_entry_to_file_entry(&connection, &parsed, entry));
    }
    sort_entries(&mut entries);
    Ok(RemoteDirectoryListing {
        path: build_remote_virtual_path(&connection.id, &parsed.relative_segments),
        parent_path: parsed.parent_path(),
        breadcrumbs: build_remote_breadcrumbs(&connection, &parsed.relative_segments),
        entries,
    })
}

#[tauri::command]
#[specta::specta]
pub async fn remote_open_file(
    app: AppHandle,
    state: State<'_, RemoteStorageState>,
    path: String,
) -> Result<(), String> {
    let staged_path = stage_remote_file(&app, &state, &path).await?;
    fs_open_file(staged_path.to_string_lossy().into_owned()).await
}

#[tauri::command]
#[specta::specta]
pub async fn remote_read_text_file(
    app: AppHandle,
    state: State<'_, RemoteStorageState>,
    path: String,
) -> Result<String, String> {
    let bytes =
        read_remote_file_bytes(&app, &state, &path, REMOTE_TEXT_PREVIEW_MAX_BYTES as u64).await?;
    String::from_utf8(bytes).map_err(|error| format!("Remote file is not valid UTF-8: {error}"))
}

#[tauri::command]
#[specta::specta]
pub async fn remote_read_file_base64(
    app: AppHandle,
    state: State<'_, RemoteStorageState>,
    path: String,
) -> Result<String, String> {
    let bytes =
        read_remote_file_bytes(&app, &state, &path, REMOTE_BASE64_PREVIEW_MAX_BYTES as u64).await?;
    Ok(base64::engine::general_purpose::STANDARD.encode(bytes))
}

#[tauri::command]
pub async fn remote_read_preview_bytes(
    app: AppHandle,
    state: State<'_, RemoteStorageState>,
    path: String,
    max_bytes: Option<u64>,
) -> Result<tauri::transport::BinaryResponse, String> {
    let bytes = read_remote_file_bytes(
        &app,
        &state,
        &path,
        resolve_preview_byte_limit(max_bytes, REMOTE_PREVIEW_BYTES_MAX_BYTES as u64),
    )
    .await?;
    Ok(tauri::transport::BinaryResponse::new(bytes))
}

#[tauri::command]
#[specta::specta]
pub async fn remote_write_file(
    app: AppHandle,
    state: State<'_, RemoteStorageState>,
    path: String,
    content: FsWriteFileContent,
) -> Result<(), String> {
    let parsed = parse_remote_virtual_path(&path)?;
    let connection = load_remote_connection(&app, &parsed.connection_id)?;
    let session = get_or_connect_remote_session(&app, &state, &connection).await?;
    let actual_path = build_actual_remote_path(&connection.start_path, &parsed.relative_segments)?;
    write_remote_file_content(&session, &actual_path, content).await
}

#[tauri::command]
#[specta::specta]
pub async fn remote_create_file(
    app: AppHandle,
    state: State<'_, RemoteStorageState>,
    parent_path: String,
    name: String,
    content: FsWriteFileContent,
) -> Result<(), String> {
    let parsed = parse_remote_virtual_path(&parent_path)?;
    let connection = load_remote_connection(&app, &parsed.connection_id)?;
    let session = get_or_connect_remote_session(&app, &state, &connection).await?;
    let child_name = normalize_remote_leaf_name(&name)?;
    let mut relative_segments = parsed.relative_segments.clone();
    relative_segments.push(child_name);
    let actual_path = build_actual_remote_path(&connection.start_path, &relative_segments)?;
    write_remote_file_content(&session, &actual_path, content).await
}

#[tauri::command]
#[specta::specta]
pub async fn remote_create_directory(
    app: AppHandle,
    state: State<'_, RemoteStorageState>,
    parent_path: String,
    name: String,
) -> Result<(), String> {
    let parsed = parse_remote_virtual_path(&parent_path)?;
    let connection = load_remote_connection(&app, &parsed.connection_id)?;
    let session = get_or_connect_remote_session(&app, &state, &connection).await?;
    let child_name = normalize_remote_leaf_name(&name)?;
    let mut relative_segments = parsed.relative_segments.clone();
    relative_segments.push(child_name);
    let actual_path = build_actual_remote_path(&connection.start_path, &relative_segments)?;
    create_remote_directory(&session, &actual_path).await
}

#[tauri::command]
#[specta::specta]
pub async fn remote_rename_path(
    app: AppHandle,
    state: State<'_, RemoteStorageState>,
    path: String,
    new_name: String,
) -> Result<(), String> {
    let parsed = parse_remote_virtual_path(&path)?;
    if parsed.relative_segments.is_empty() {
        return Err("Remote root paths cannot be renamed.".to_string());
    }
    let connection = load_remote_connection(&app, &parsed.connection_id)?;
    let session = get_or_connect_remote_session(&app, &state, &connection).await?;
    let mut destination_segments = parsed.relative_segments.clone();
    *destination_segments
        .last_mut()
        .expect("non-root remote paths always have at least one segment") =
        normalize_remote_leaf_name(&new_name)?;
    let source_actual_path =
        build_actual_remote_path(&connection.start_path, &parsed.relative_segments)?;
    let destination_actual_path =
        build_actual_remote_path(&connection.start_path, &destination_segments)?;
    rename_remote_path(&session, &source_actual_path, &destination_actual_path).await
}

#[tauri::command]
#[specta::specta]
pub async fn remote_delete_path(
    app: AppHandle,
    state: State<'_, RemoteStorageState>,
    path: String,
) -> Result<(), String> {
    let parsed = parse_remote_virtual_path(&path)?;
    if parsed.relative_segments.is_empty() {
        return Err("Remote root paths cannot be deleted.".to_string());
    }
    let connection = load_remote_connection(&app, &parsed.connection_id)?;
    let session = get_or_connect_remote_session(&app, &state, &connection).await?;
    let actual_path = build_actual_remote_path(&connection.start_path, &parsed.relative_segments)?;
    delete_remote_tree(&session, &actual_path).await
}

#[tauri::command]
#[specta::specta]
pub async fn remote_transfer_items(
    app: AppHandle,
    state: State<'_, RemoteStorageState>,
    target_dir: String,
    sources: Vec<String>,
    operation: FileTransferOperation,
) -> Result<Vec<FileTransferResult>, String> {
    if sources.is_empty() {
        return Ok(Vec::new());
    }

    let target_remote = if target_dir.trim().starts_with("remote://") {
        Some(parse_remote_virtual_path(&target_dir)?)
    } else {
        None
    };
    if sources
        .iter()
        .any(|source| source.trim().starts_with("cloud://"))
        || target_dir.trim().starts_with("cloud://")
    {
        return Err(
            "Remote and cloud transfer mixing is not supported yet. Use a local staging folder."
                .to_string(),
        );
    }

    let mut results = Vec::new();
    for source in sources {
        let destination_path = transfer_single_source(
            &app,
            &state,
            target_remote.as_ref(),
            &target_dir,
            &source,
            operation,
        )
        .await?;
        let content_revision = build_content_revision(0, now_ms(), false, false);
        let identity = build_virtual_identity(
            "remote-transfer",
            &format!("{source}->{destination_path}::{operation:?}"),
            &content_revision,
        );
        results.push(FileTransferResult {
            source_path: source.clone(),
            destination_path,
            operation,
            collision_policy: FileTransferCollisionPolicy::KeepBoth,
            disposition: FileTransferDisposition::Transferred,
            entity_id: identity.entity_id,
            identity_kind: identity.identity_kind,
            content_revision: identity.content_revision,
        });
    }
    Ok(results)
}

async fn transfer_single_source(
    app: &AppHandle,
    state: &RemoteStorageState,
    target_remote: Option<&RemoteVirtualPath>,
    target_dir: &str,
    source: &str,
    operation: FileTransferOperation,
) -> Result<String, String> {
    let source_is_remote = source.trim().starts_with("remote://");
    match (source_is_remote, target_remote) {
        (true, Some(target_remote)) => {
            transfer_remote_to_remote(app, state, source, target_remote, operation).await
        }
        (true, None) => transfer_remote_to_local(app, state, source, target_dir, operation).await,
        (false, Some(target_remote)) => {
            transfer_local_to_remote(app, state, source, target_remote, operation).await
        }
        (false, None) => Err(
            "remote_transfer_items only handles transfers with at least one remote endpoint."
                .to_string(),
        ),
    }
}

async fn transfer_remote_to_local(
    app: &AppHandle,
    state: &RemoteStorageState,
    source: &str,
    target_dir: &str,
    operation: FileTransferOperation,
) -> Result<String, String> {
    let source_path = parse_remote_virtual_path(source)?;
    let connection = load_remote_connection(app, &source_path.connection_id)?;
    let session = get_or_connect_remote_session(app, state, &connection).await?;
    let source_actual_path =
        build_actual_remote_path(&connection.start_path, &source_path.relative_segments)?;
    let source_metadata = stat_remote_path(&session, &source_actual_path).await?;
    let source_name = remote_virtual_leaf_name(&connection, &source_path)?;
    let destination_path =
        resolve_local_keep_both_target_path(Path::new(target_dir), &source_name)?;
    if remote_attrs_is_dir(&source_metadata, true) {
        copy_remote_directory_to_local(&session, &source_actual_path, &destination_path).await?;
        if operation == FileTransferOperation::Move {
            delete_remote_tree(&session, &source_actual_path).await?;
        }
    } else {
        copy_remote_file_to_local(&session, &source_actual_path, &destination_path).await?;
        if operation == FileTransferOperation::Move {
            delete_remote_file(&session, &source_actual_path).await?;
        }
    }
    Ok(destination_path.to_string_lossy().into_owned())
}

async fn transfer_local_to_remote(
    app: &AppHandle,
    state: &RemoteStorageState,
    source: &str,
    target_remote: &RemoteVirtualPath,
    operation: FileTransferOperation,
) -> Result<String, String> {
    let connection = load_remote_connection(app, &target_remote.connection_id)?;
    let session = get_or_connect_remote_session(app, state, &connection).await?;
    let source_path = PathBuf::from(source);
    let metadata = fs::symlink_metadata(&source_path).map_err(|error| {
        format!(
            "Failed to inspect local transfer source {}: {error}",
            source_path.display()
        )
    })?;
    let source_name = source_path
        .file_name()
        .and_then(OsStr::to_str)
        .ok_or_else(|| {
            format!(
                "Unable to derive a transfer name for {}",
                source_path.display()
            )
        })?
        .to_string();
    let target_path = resolve_remote_keep_both_target_path(
        &session,
        &connection.start_path,
        &target_remote.relative_segments,
        &source_name,
    )
    .await?;
    if metadata.is_dir() {
        copy_local_directory_to_remote(&source_path, &session, &target_path).await?;
        if operation == FileTransferOperation::Move {
            fs::remove_dir_all(&source_path).map_err(|error| {
                format!(
                    "Failed to remove local directory {} after move: {error}",
                    source_path.display()
                )
            })?;
        }
    } else {
        copy_local_file_to_remote(&source_path, &session, &target_path).await?;
        if operation == FileTransferOperation::Move {
            fs::remove_file(&source_path).map_err(|error| {
                format!(
                    "Failed to remove local file {} after move: {error}",
                    source_path.display()
                )
            })?;
        }
    }
    Ok(build_remote_virtual_path_from_actual(
        &connection,
        &target_path,
    )?)
}

async fn transfer_remote_to_remote(
    app: &AppHandle,
    state: &RemoteStorageState,
    source: &str,
    target_remote: &RemoteVirtualPath,
    operation: FileTransferOperation,
) -> Result<String, String> {
    let source_path = parse_remote_virtual_path(source)?;
    let source_connection = load_remote_connection(app, &source_path.connection_id)?;
    let target_connection = load_remote_connection(app, &target_remote.connection_id)?;
    let source_session = get_or_connect_remote_session(app, state, &source_connection).await?;
    let target_session = get_or_connect_remote_session(app, state, &target_connection).await?;
    let source_actual_path = build_actual_remote_path(
        &source_connection.start_path,
        &source_path.relative_segments,
    )?;
    let source_metadata = stat_remote_path(&source_session, &source_actual_path).await?;
    let source_name = remote_virtual_leaf_name(&source_connection, &source_path)?;
    let target_actual_path = resolve_remote_keep_both_target_path(
        &target_session,
        &target_connection.start_path,
        &target_remote.relative_segments,
        &source_name,
    )
    .await?;
    let same_connection = source_connection.id == target_connection.id;

    if operation == FileTransferOperation::Move && same_connection {
        rename_remote_path(&source_session, &source_actual_path, &target_actual_path).await?;
        return Ok(build_remote_virtual_path_from_actual(
            &target_connection,
            &target_actual_path,
        )?);
    }

    if remote_attrs_is_dir(&source_metadata, source_path.relative_segments.is_empty()) {
        copy_remote_directory_to_remote(
            &source_session,
            &source_actual_path,
            &target_session,
            &target_actual_path,
        )
        .await?;
        if operation == FileTransferOperation::Move {
            delete_remote_tree(&source_session, &source_actual_path).await?;
        }
    } else {
        copy_remote_file_to_remote(
            &source_session,
            &source_actual_path,
            &target_session,
            &target_actual_path,
        )
        .await?;
        if operation == FileTransferOperation::Move {
            delete_remote_file(&source_session, &source_actual_path).await?;
        }
    }

    Ok(build_remote_virtual_path_from_actual(
        &target_connection,
        &target_actual_path,
    )?)
}

#[async_recursion::async_recursion]
async fn copy_remote_directory_to_local(
    session: &Arc<RemoteSftpSession>,
    source_actual_path: &str,
    destination_path: &Path,
) -> Result<(), String> {
    fs::create_dir_all(destination_path).map_err(|error| {
        format!(
            "Failed to create destination directory {}: {error}",
            destination_path.display()
        )
    })?;
    let mut reader = open_remote_directory(session, source_actual_path).await?;
    while let Some(entry) = reader
        .next()
        .await
        .map_err(|error| remote_operation_error(error, true).message)?
    {
        let entry_name = remote_dir_entry_name(&entry);
        let child_source_path = format!(
            "{}/{}",
            trim_trailing_slashes(source_actual_path),
            entry_name
        );
        let child_destination = destination_path.join(&entry_name);
        if remote_dir_entry_is_dir(&entry) {
            copy_remote_directory_to_local(session, &child_source_path, &child_destination).await?;
        } else {
            copy_remote_file_to_local(session, &child_source_path, &child_destination).await?;
        }
    }
    Ok(())
}

#[async_recursion::async_recursion]
async fn copy_remote_directory_to_remote(
    source_session: &Arc<RemoteSftpSession>,
    source_actual_path: &str,
    target_session: &Arc<RemoteSftpSession>,
    target_actual_path: &str,
) -> Result<(), String> {
    create_remote_directory(target_session, target_actual_path).await?;
    let mut reader = open_remote_directory(source_session, source_actual_path).await?;
    while let Some(entry) = reader
        .next()
        .await
        .map_err(|error| remote_operation_error(error, true).message)?
    {
        let entry_name = remote_dir_entry_name(&entry);
        let child_source_path = format!(
            "{}/{}",
            trim_trailing_slashes(source_actual_path),
            entry_name
        );
        let child_target_path = format!(
            "{}/{}",
            trim_trailing_slashes(target_actual_path),
            entry_name
        );
        if remote_dir_entry_is_dir(&entry) {
            copy_remote_directory_to_remote(
                source_session,
                &child_source_path,
                target_session,
                &child_target_path,
            )
            .await?;
        } else {
            copy_remote_file_to_remote(
                source_session,
                &child_source_path,
                target_session,
                &child_target_path,
            )
            .await?;
        }
    }
    Ok(())
}

#[async_recursion::async_recursion]
async fn copy_local_directory_to_remote(
    source_path: &Path,
    session: &Arc<RemoteSftpSession>,
    target_actual_path: &str,
) -> Result<(), String> {
    create_remote_directory(session, target_actual_path).await?;
    let entries = fs::read_dir(source_path).map_err(|error| {
        format!(
            "Failed to read local directory {} for upload: {error}",
            source_path.display()
        )
    })?;
    for entry in entries {
        let entry =
            entry.map_err(|error| format!("Failed to read local directory entry: {error}"))?;
        let metadata = entry.metadata().map_err(|error| {
            format!(
                "Failed to inspect local upload entry {}: {error}",
                entry.path().display()
            )
        })?;
        let child_name = entry.file_name().to_string_lossy().into_owned();
        let child_target_path = format!(
            "{}/{}",
            trim_trailing_slashes(target_actual_path),
            child_name
        );
        if metadata.is_dir() {
            copy_local_directory_to_remote(&entry.path(), session, &child_target_path).await?;
        } else {
            copy_local_file_to_remote(&entry.path(), session, &child_target_path).await?;
        }
    }
    Ok(())
}

async fn copy_local_file_to_remote(
    source_path: &Path,
    session: &Arc<RemoteSftpSession>,
    target_actual_path: &str,
) -> Result<(), String> {
    let mut source_file = tokio_fs::File::open(source_path).await.map_err(|error| {
        format!(
            "Failed to open local upload source {}: {error}",
            source_path.display()
        )
    })?;
    let mut target_file = open_remote_file_for_write(session, target_actual_path).await?;
    tokio::io::copy(&mut source_file, &mut target_file)
        .await
        .map_err(|error| format!("Failed to upload {}: {error}", source_path.display()))?;
    target_file.shutdown().await.map_err(|error| {
        format!("Failed to finalize remote upload to {target_actual_path}: {error}")
    })?;
    Ok(())
}

async fn copy_remote_file_to_local(
    session: &Arc<RemoteSftpSession>,
    source_actual_path: &str,
    destination_path: &Path,
) -> Result<(), String> {
    if let Some(parent) = destination_path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "Failed to create local destination directory {}: {error}",
                parent.display()
            )
        })?;
    }
    let mut source_file = open_remote_file_for_read(session, source_actual_path).await?;
    let mut destination_file = tokio_fs::File::create(destination_path)
        .await
        .map_err(|error| {
            format!(
                "Failed to create local destination {}: {error}",
                destination_path.display()
            )
        })?;
    tokio::io::copy(&mut source_file, &mut destination_file)
        .await
        .map_err(|error| format!("Failed to download remote file {source_actual_path}: {error}"))?;
    destination_file.flush().await.map_err(|error| {
        format!(
            "Failed to flush local destination {}: {error}",
            destination_path.display()
        )
    })?;
    Ok(())
}

async fn copy_remote_file_to_remote(
    source_session: &Arc<RemoteSftpSession>,
    source_actual_path: &str,
    target_session: &Arc<RemoteSftpSession>,
    target_actual_path: &str,
) -> Result<(), String> {
    let mut source_file = open_remote_file_for_read(source_session, source_actual_path).await?;
    let mut target_file = open_remote_file_for_write(target_session, target_actual_path).await?;
    tokio::io::copy(&mut source_file, &mut target_file)
        .await
        .map_err(|error| format!("Failed to copy remote file {source_actual_path}: {error}"))?;
    target_file.shutdown().await.map_err(|error| {
        format!("Failed to finalize remote copy to {target_actual_path}: {error}")
    })?;
    Ok(())
}

async fn stage_remote_file(
    app: &AppHandle,
    state: &RemoteStorageState,
    path: &str,
) -> Result<PathBuf, String> {
    let parsed = parse_remote_virtual_path(path)?;
    let connection = load_remote_connection(app, &parsed.connection_id)?;
    let session = get_or_connect_remote_session(app, state, &connection).await?;
    let actual_path = build_actual_remote_path(&connection.start_path, &parsed.relative_segments)?;
    let mut source_file = open_remote_file_for_read(&session, &actual_path).await?;
    let temp_root = remote_temp_root_path(app)?;
    let file_name = remote_virtual_leaf_name(&connection, &parsed)?;
    let staged_path = temp_root.join(format!("{}-{}", Uuid::new_v4(), file_name));
    let mut destination_file = tokio_fs::File::create(&staged_path)
        .await
        .map_err(|error| {
            format!(
                "Failed to create staged remote file {}: {error}",
                staged_path.display()
            )
        })?;
    tokio::io::copy(&mut source_file, &mut destination_file)
        .await
        .map_err(|error| format!("Failed to stage remote file {path}: {error}"))?;
    destination_file.flush().await.map_err(|error| {
        format!(
            "Failed to flush staged remote file {}: {error}",
            staged_path.display()
        )
    })?;
    Ok(staged_path)
}

async fn read_remote_file_bytes(
    app: &AppHandle,
    state: &RemoteStorageState,
    path: &str,
    max_bytes: u64,
) -> Result<Vec<u8>, String> {
    let parsed = parse_remote_virtual_path(path)?;
    let connection = load_remote_connection(app, &parsed.connection_id)?;
    let session = get_or_connect_remote_session(app, state, &connection).await?;
    let actual_path = build_actual_remote_path(&connection.start_path, &parsed.relative_segments)?;
    let attrs = stat_remote_path(&session, &actual_path).await?;
    if attrs.size.unwrap_or(0) > max_bytes {
        return Err(format!(
            "Remote file is too large for preview transport (> {}).",
            format_preview_byte_limit(max_bytes)
        ));
    }
    let mut file = open_remote_file_for_read(&session, &actual_path).await?;
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes)
        .await
        .map_err(|error| format!("Failed to read remote file {path}: {error}"))?;
    Ok(bytes)
}

async fn open_remote_directory(
    session: &Arc<RemoteSftpSession>,
    actual_path: &str,
) -> Result<SftpReadDir, String> {
    let operator = session.operator.lock().await;
    operator
        .read_dir(actual_path)
        .await
        .map_err(|error| remote_operation_error(error, true).message)
}

async fn open_remote_file_for_read(
    session: &Arc<RemoteSftpSession>,
    actual_path: &str,
) -> Result<yazi_sftp::fs::File, String> {
    let operator = session.operator.lock().await;
    operator
        .open(actual_path, Flags::READ, &Attrs::default())
        .await
        .map_err(|error| remote_operation_error(error, true).message)
}

async fn open_remote_file_for_write(
    session: &Arc<RemoteSftpSession>,
    actual_path: &str,
) -> Result<yazi_sftp::fs::File, String> {
    let operator = session.operator.lock().await;
    operator
        .open(
            actual_path,
            Flags::WRITE | Flags::CREATE | Flags::TRUNCATE,
            &Attrs::default(),
        )
        .await
        .map_err(|error| remote_operation_error(error, true).message)
}

async fn write_remote_file_content(
    session: &Arc<RemoteSftpSession>,
    actual_path: &str,
    content: FsWriteFileContent,
) -> Result<(), String> {
    let mut file = open_remote_file_for_write(session, actual_path).await?;
    let bytes = match content {
        FsWriteFileContent::Text(text) => text.into_bytes(),
        FsWriteFileContent::Bytes(bytes) => bytes,
    };
    file.write_all(&bytes)
        .await
        .map_err(|error| format!("Failed to write remote file {actual_path}: {error}"))?;
    file.shutdown()
        .await
        .map_err(|error| format!("Failed to finalize remote file write {actual_path}: {error}"))
}

async fn create_remote_directory(
    session: &Arc<RemoteSftpSession>,
    actual_path: &str,
) -> Result<(), String> {
    let operator = session.operator.lock().await;
    match operator.mkdir(actual_path, Attrs::default()).await {
        Ok(()) => Ok(()),
        Err(yazi_sftp::Error::Status(status))
            if matches!(
                status.code,
                yazi_sftp::responses::StatusCode::FileAlreadyExists
            ) =>
        {
            Ok(())
        }
        Err(error) => Err(remote_operation_error(error, true).message),
    }
}

async fn rename_remote_path(
    session: &Arc<RemoteSftpSession>,
    from_actual_path: &str,
    to_actual_path: &str,
) -> Result<(), String> {
    let operator = session.operator.lock().await;
    match operator
        .rename_posix(from_actual_path, to_actual_path)
        .await
    {
        Ok(()) => Ok(()),
        Err(yazi_sftp::Error::Unsupported) => operator
            .rename(from_actual_path, to_actual_path)
            .await
            .map_err(|error| remote_operation_error(error, true).message),
        Err(error) => Err(remote_operation_error(error, true).message),
    }
}

#[async_recursion::async_recursion]
async fn delete_remote_tree(
    session: &Arc<RemoteSftpSession>,
    actual_path: &str,
) -> Result<(), String> {
    let attrs = stat_remote_path(session, actual_path).await?;
    if remote_attrs_is_dir(&attrs, false) {
        let mut reader = open_remote_directory(session, actual_path).await?;
        while let Some(entry) = reader
            .next()
            .await
            .map_err(|error| remote_operation_error(error, true).message)?
        {
            let child_name = remote_dir_entry_name(&entry);
            let child_path = format!("{}/{}", trim_trailing_slashes(actual_path), child_name);
            if remote_dir_entry_is_dir(&entry) {
                delete_remote_tree(session, &child_path).await?;
            } else {
                delete_remote_file(session, &child_path).await?;
            }
        }
        let operator = session.operator.lock().await;
        operator
            .rmdir(actual_path)
            .await
            .map_err(|error| remote_operation_error(error, true).message)
    } else {
        delete_remote_file(session, actual_path).await
    }
}

async fn delete_remote_file(
    session: &Arc<RemoteSftpSession>,
    actual_path: &str,
) -> Result<(), String> {
    let operator = session.operator.lock().await;
    operator
        .remove(actual_path)
        .await
        .map_err(|error| remote_operation_error(error, true).message)
}

async fn stat_remote_path(
    session: &Arc<RemoteSftpSession>,
    actual_path: &str,
) -> Result<Attrs, String> {
    let operator = session.operator.lock().await;
    operator
        .stat(actual_path)
        .await
        .map_err(|error| remote_operation_error(error, true).message)
}

async fn resolve_remote_keep_both_target_path(
    session: &Arc<RemoteSftpSession>,
    root_start_path: &str,
    target_relative_segments: &[String],
    source_name: &str,
) -> Result<String, String> {
    let mut candidate_name = source_name.to_string();
    let mut counter = 2_u32;
    loop {
        let mut candidate_segments = target_relative_segments.to_vec();
        candidate_segments.push(candidate_name.clone());
        let candidate_path = build_actual_remote_path(root_start_path, &candidate_segments)?;
        if !remote_path_exists(session, &candidate_path).await? {
            return Ok(candidate_path);
        }
        candidate_name = make_keep_both_name(source_name, counter);
        counter = counter.saturating_add(1);
    }
}

async fn remote_path_exists(
    session: &Arc<RemoteSftpSession>,
    actual_path: &str,
) -> Result<bool, String> {
    let operator = session.operator.lock().await;
    match operator.stat(actual_path).await {
        Ok(_) => Ok(true),
        Err(yazi_sftp::Error::Status(status))
            if matches!(
                status.code,
                yazi_sftp::responses::StatusCode::NoSuchFile
                    | yazi_sftp::responses::StatusCode::NoSuchPath
            ) =>
        {
            Ok(false)
        }
        Err(error) => Err(remote_operation_error(error, true).message),
    }
}

fn resolve_local_keep_both_target_path(
    target_dir: &Path,
    source_name: &str,
) -> Result<PathBuf, String> {
    fs::create_dir_all(target_dir).map_err(|error| {
        format!(
            "Failed to prepare local transfer destination {}: {error}",
            target_dir.display()
        )
    })?;
    let mut candidate_name = source_name.to_string();
    let mut counter = 2_u32;
    loop {
        let candidate_path = target_dir.join(&candidate_name);
        if !candidate_path.exists() {
            return Ok(candidate_path);
        }
        candidate_name = make_keep_both_name(source_name, counter);
        counter = counter.saturating_add(1);
    }
}

fn make_keep_both_name(source_name: &str, counter: u32) -> String {
    let path = Path::new(source_name);
    let stem = path
        .file_stem()
        .and_then(OsStr::to_str)
        .unwrap_or(source_name);
    let extension = path.extension().and_then(OsStr::to_str).unwrap_or_default();
    if extension.is_empty() {
        format!("{stem} copy {counter}")
    } else {
        format!("{stem} copy {counter}.{extension}")
    }
}

async fn get_or_connect_remote_session(
    app: &AppHandle,
    state: &RemoteStorageState,
    connection: &PersistedRemoteConnection,
) -> Result<Arc<RemoteSftpSession>, String> {
    if let Some(existing) = state.sessions.lock().await.get(&connection.id).cloned() {
        let operator = existing.operator.lock().await;
        if !operator.is_closed() {
            drop(operator);
            return Ok(existing);
        }
        drop(operator);
        state.sessions.lock().await.remove(&connection.id);
    }

    update_remote_status(
        state,
        &connection.id,
        RemoteConnectionStatus::Connecting,
        None,
    )?;

    match connect_remote_session(app, state, connection).await {
        Ok(session) => {
            state
                .sessions
                .lock()
                .await
                .insert(connection.id.clone(), session.clone());
            update_remote_status(
                state,
                &connection.id,
                RemoteConnectionStatus::Connected,
                None,
            )?;
            clear_pending_host_verification(&state.pending_host_verifications, &connection.id)?;
            Ok(session)
        }
        Err(error) => {
            let status = if has_pending_host_verification(state, &connection.id)? {
                RemoteConnectionStatus::UntrustedHost
            } else {
                RemoteConnectionStatus::Error
            };
            update_remote_status(state, &connection.id, status, Some(error.clone()))?;
            Err(error)
        }
    }
}

async fn connect_remote_session(
    app: &AppHandle,
    state: &RemoteStorageState,
    connection: &PersistedRemoteConnection,
) -> Result<Arc<RemoteSftpSession>, String> {
    let trusted_host = read_trusted_hosts(app)?
        .hosts
        .into_iter()
        .find(|entry| entry.host == connection.host && entry.port == connection.port);
    let pending_host_verifications = state.pending_host_verifications.clone();
    let handler = RemoteClientHandler {
        connection_id: connection.id.clone(),
        host: connection.host.clone(),
        port: connection.port,
        trusted_host,
        pending_host_verifications,
    };
    let config = Arc::new(russh::client::Config {
        inactivity_timeout: Some(Duration::from_secs(60)),
        keepalive_interval: Some(Duration::from_secs(10)),
        ..Default::default()
    });
    let mut client =
        russh::client::connect(config, (connection.host.as_str(), connection.port), handler)
            .await
            .map_err(|error| {
                format!(
                    "Failed to connect to {}:{}: {error}",
                    connection.host, connection.port
                )
            })?;

    authenticate_remote_client(connection, &mut client).await?;

    let channel = client
        .channel_open_session()
        .await
        .map_err(|error| format!("Failed to open remote SSH session: {error}"))?;
    channel
        .request_subsystem(true, "sftp")
        .await
        .map_err(|error| format!("Failed to request the remote SFTP subsystem: {error}"))?;
    let mut operator = SftpOperator::make(channel.into_stream());
    operator
        .init()
        .await
        .map_err(|error| format!("Failed to initialize the remote SFTP operator: {error}"))?;
    Ok(Arc::new(RemoteSftpSession {
        operator: AsyncMutex::new(operator),
    }))
}

async fn authenticate_remote_client(
    connection: &PersistedRemoteConnection,
    client: &mut RusshHandle<RemoteClientHandler>,
) -> Result<(), String> {
    match connection.auth_mode {
        RemoteAuthMode::Password => {
            let password = read_remote_password(&connection.id)?;
            let result = client
                .authenticate_password(&connection.username, &password)
                .await
                .map_err(|error| format!("Password authentication failed: {error}"))?;
            if result.success() {
                Ok(())
            } else {
                Err("Password authentication failed.".to_string())
            }
        }
        RemoteAuthMode::PrivateKeyFile => {
            let private_key_path = connection.private_key_path.as_deref().ok_or_else(|| {
                "Private-key authentication requires a private key path.".to_string()
            })?;
            let key_contents = fs::read_to_string(private_key_path).map_err(|error| {
                format!("Failed to read private key file {private_key_path}: {error}")
            })?;
            let key = russh::keys::decode_secret_key(
                &key_contents,
                read_remote_key_passphrase(&connection.id).ok().as_deref(),
            )
            .map_err(|error| format!("Failed to decode the private key: {error}"))?;
            let result = client
                .authenticate_publickey(
                    &connection.username,
                    PrivateKeyWithHashAlg::new(
                        Arc::new(key),
                        client
                            .best_supported_rsa_hash()
                            .await
                            .map_err(|error| {
                                format!(
                                    "Failed to negotiate an SSH public-key hash algorithm: {error}"
                                )
                            })?
                            .flatten(),
                    ),
                )
                .await
                .map_err(|error| format!("Private-key authentication failed: {error}"))?;
            if result.success() {
                Ok(())
            } else {
                Err("Private-key authentication failed.".to_string())
            }
        }
    }
}

async fn remote_disconnect_inner(
    state: &RemoteStorageState,
    connection_id: &str,
) -> Result<(), String> {
    state.sessions.lock().await.remove(connection_id);
    update_remote_status(
        state,
        connection_id,
        RemoteConnectionStatus::Disconnected,
        None,
    )
}

async fn disconnect_sessions_for_host(
    app: &AppHandle,
    state: &RemoteStorageState,
    host: &str,
    port: u16,
) -> Result<(), String> {
    let connections = read_remote_connections(app)?;
    for connection in connections
        .connections
        .into_iter()
        .filter(|connection| connection.host == host && connection.port == port)
    {
        remote_disconnect_inner(state, &connection.id).await?;
    }
    Ok(())
}

fn summarize_remote_connection(
    state: &RemoteStorageState,
    connection: PersistedRemoteConnection,
) -> Result<RemoteConnectionSummary, String> {
    let statuses = clone_remote_statuses(state)?;
    let pending = clone_pending_host_verifications(state)?;
    let runtime = statuses.get(&connection.id);
    Ok(RemoteConnectionSummary {
        id: connection.id.clone(),
        label: connection.label,
        protocol: connection.protocol,
        host: connection.host,
        port: connection.port,
        username: connection.username,
        start_path: connection.start_path,
        auth_mode: connection.auth_mode,
        private_key_path: connection.private_key_path,
        status: runtime
            .map(|status| status.status)
            .unwrap_or(RemoteConnectionStatus::Disconnected),
        last_error: runtime.and_then(|status| status.last_error.clone()),
        pending_host_verification: pending.get(&connection.id).cloned(),
    })
}

fn update_remote_status(
    state: &RemoteStorageState,
    connection_id: &str,
    status: RemoteConnectionStatus,
    last_error: Option<String>,
) -> Result<(), String> {
    let mut statuses = state
        .statuses
        .lock()
        .map_err(|_| "remote connection status lock poisoned".to_string())?;
    statuses.insert(
        connection_id.to_string(),
        RemoteConnectionRuntimeStatus { status, last_error },
    );
    Ok(())
}

fn clear_remote_status(state: &RemoteStorageState, connection_id: &str) -> Result<(), String> {
    let mut statuses = state
        .statuses
        .lock()
        .map_err(|_| "remote connection status lock poisoned".to_string())?;
    statuses.remove(connection_id);
    Ok(())
}

fn clone_remote_statuses(
    state: &RemoteStorageState,
) -> Result<HashMap<String, RemoteConnectionRuntimeStatus>, String> {
    state
        .statuses
        .lock()
        .map_err(|_| "remote connection status lock poisoned".to_string())
        .map(|statuses| statuses.clone())
}

fn clone_pending_host_verifications(
    state: &RemoteStorageState,
) -> Result<HashMap<String, RemotePendingHostVerification>, String> {
    state
        .pending_host_verifications
        .lock()
        .map_err(|_| "remote pending host verification lock poisoned".to_string())
        .map(|pending| pending.clone())
}

fn has_pending_host_verification(
    state: &RemoteStorageState,
    connection_id: &str,
) -> Result<bool, String> {
    state
        .pending_host_verifications
        .lock()
        .map_err(|_| "remote pending host verification lock poisoned".to_string())
        .map(|pending| pending.contains_key(connection_id))
}

fn record_pending_host_verification(
    pending_host_verifications: &Arc<Mutex<HashMap<String, RemotePendingHostVerification>>>,
    verification: RemotePendingHostVerification,
) -> Result<(), russh::Error> {
    pending_host_verifications
        .lock()
        .map_err(|_| {
            russh::Error::InvalidConfig(
                "remote pending host verification lock poisoned".to_string(),
            )
        })?
        .insert(verification.connection_id.clone(), verification);
    Ok(())
}

fn clear_pending_host_verification(
    pending_host_verifications: &Arc<Mutex<HashMap<String, RemotePendingHostVerification>>>,
    connection_id: &str,
) -> Result<(), String> {
    pending_host_verifications
        .lock()
        .map_err(|_| "remote pending host verification lock poisoned".to_string())?
        .remove(connection_id);
    Ok(())
}

fn clear_pending_hosts_for_target(
    pending_host_verifications: &Arc<Mutex<HashMap<String, RemotePendingHostVerification>>>,
    host: &str,
    port: u16,
) -> Result<(), String> {
    let mut pending = pending_host_verifications
        .lock()
        .map_err(|_| "remote pending host verification lock poisoned".to_string())?;
    pending.retain(|_, verification| verification.host != host || verification.port != port);
    Ok(())
}

fn observe_remote_host_key(public_key: &PublicKey) -> RemoteHostKeyObservation {
    RemoteHostKeyObservation {
        algorithm: public_key.algorithm().to_string(),
        fingerprint_sha256: public_key.fingerprint(HashAlg::Sha256).to_string(),
        public_key: public_key.public_key_base64(),
    }
}

fn remote_storage_root(app: &AppHandle) -> Result<PathBuf, String> {
    let root = app
        .path()
        .app_local_data_dir()
        .map_err(|error| format!("Failed to resolve the app local data directory: {error}"))?
        .join(REMOTE_STORAGE_DIRECTORY);
    fs::create_dir_all(&root)
        .map_err(|error| format!("Failed to create the remote-storage data directory: {error}"))?;
    Ok(root)
}

fn remote_connections_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(remote_storage_root(app)?.join(REMOTE_CONNECTIONS_FILE))
}

fn remote_trusted_hosts_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(remote_storage_root(app)?.join(REMOTE_TRUSTED_HOSTS_FILE))
}

fn remote_temp_root_path(app: &AppHandle) -> Result<PathBuf, String> {
    let root = remote_storage_root(app)?.join(REMOTE_TEMP_DIRECTORY);
    fs::create_dir_all(&root)
        .map_err(|error| format!("Failed to create the remote temp directory: {error}"))?;
    Ok(root)
}

fn read_remote_connections(app: &AppHandle) -> Result<PersistedRemoteConnections, String> {
    let path = remote_connections_file_path(app)?;
    if !path.exists() {
        return Ok(PersistedRemoteConnections {
            connections: Vec::new(),
        });
    }
    let content = fs::read_to_string(&path)
        .map_err(|error| format!("Failed to read persisted remote connections: {error}"))?;
    serde_json::from_str(&content)
        .map_err(|error| format!("Failed to parse persisted remote connections: {error}"))
}

fn write_remote_connections(
    app: &AppHandle,
    connections: &PersistedRemoteConnections,
) -> Result<(), String> {
    let path = remote_connections_file_path(app)?;
    let content = serde_json::to_string_pretty(connections)
        .map_err(|error| format!("Failed to serialize persisted remote connections: {error}"))?;
    fs::write(&path, content)
        .map_err(|error| format!("Failed to persist remote connections: {error}"))
}

fn upsert_remote_connection(
    app: &AppHandle,
    next: PersistedRemoteConnection,
) -> Result<(), String> {
    let mut connections = read_remote_connections(app)?;
    if let Some(existing) = connections
        .connections
        .iter_mut()
        .find(|connection| connection.id == next.id)
    {
        *existing = next;
    } else {
        connections.connections.push(next);
    }
    connections.connections.sort_by(|left, right| {
        left.label
            .to_ascii_lowercase()
            .cmp(&right.label.to_ascii_lowercase())
            .then_with(|| left.host.cmp(&right.host))
            .then_with(|| left.start_path.cmp(&right.start_path))
    });
    write_remote_connections(app, &connections)
}

fn remove_remote_connection(app: &AppHandle, connection_id: &str) -> Result<(), String> {
    let mut connections = read_remote_connections(app)?;
    connections
        .connections
        .retain(|connection| connection.id != connection_id);
    write_remote_connections(app, &connections)
}

fn load_remote_connection(
    app: &AppHandle,
    connection_id: &str,
) -> Result<PersistedRemoteConnection, String> {
    read_remote_connections(app)?
        .connections
        .into_iter()
        .find(|connection| connection.id == connection_id)
        .ok_or_else(|| "Remote connection was not found.".to_string())
}

fn read_trusted_hosts(app: &AppHandle) -> Result<PersistedTrustedHosts, String> {
    let path = remote_trusted_hosts_file_path(app)?;
    if !path.exists() {
        return Ok(PersistedTrustedHosts::default());
    }
    let content = fs::read_to_string(&path)
        .map_err(|error| format!("Failed to read the remote trusted-hosts store: {error}"))?;
    serde_json::from_str(&content)
        .map_err(|error| format!("Failed to parse the remote trusted-hosts store: {error}"))
}

fn write_trusted_hosts(
    app: &AppHandle,
    trusted_hosts: &PersistedTrustedHosts,
) -> Result<(), String> {
    let path = remote_trusted_hosts_file_path(app)?;
    let content = serde_json::to_string_pretty(trusted_hosts)
        .map_err(|error| format!("Failed to serialize trusted remote hosts: {error}"))?;
    fs::write(&path, content)
        .map_err(|error| format!("Failed to persist trusted remote hosts: {error}"))
}

fn upsert_trusted_host(app: &AppHandle, next: RemoteTrustedHostRecord) -> Result<(), String> {
    let mut trusted_hosts = read_trusted_hosts(app)?;
    if let Some(existing) = trusted_hosts
        .hosts
        .iter_mut()
        .find(|host| host.host == next.host && host.port == next.port)
    {
        *existing = next;
    } else {
        trusted_hosts.hosts.push(next);
    }
    trusted_hosts.hosts.sort_by(|left, right| {
        left.host
            .cmp(&right.host)
            .then_with(|| left.port.cmp(&right.port))
    });
    write_trusted_hosts(app, &trusted_hosts)
}

fn remove_trusted_host(app: &AppHandle, host: &str, port: u16) -> Result<(), String> {
    let mut trusted_hosts = read_trusted_hosts(app)?;
    trusted_hosts
        .hosts
        .retain(|entry| entry.host != host || entry.port != port);
    write_trusted_hosts(app, &trusted_hosts)
}

fn keyring_entry(connection_id: &str, secret_kind: &str) -> Result<Entry, String> {
    Entry::new(
        REMOTE_KEYRING_SERVICE,
        &format!("{connection_id}:{secret_kind}"),
    )
    .map_err(|error| format!("Failed to open the remote-storage keychain entry: {error}"))
}

fn persist_remote_auth_secrets(
    connection: &PersistedRemoteConnection,
    request: &RemoteConnectionUpsertRequest,
    existing: Option<&PersistedRemoteConnection>,
) -> Result<(), String> {
    match connection.auth_mode {
        RemoteAuthMode::Password => {
            let password = request
                .password
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_string)
                .or_else(|| {
                    existing
                        .filter(|entry| entry.auth_mode == RemoteAuthMode::Password)
                        .and_then(|_| read_remote_password(&connection.id).ok())
                })
                .ok_or_else(|| "Password authentication requires a password.".to_string())?;
            keyring_entry(&connection.id, "password")?
                .set_password(&password)
                .map_err(|error| {
                    format!("Failed to store the remote password in the OS keychain: {error}")
                })?;
            delete_remote_key_passphrase(&connection.id)?;
        }
        RemoteAuthMode::PrivateKeyFile => {
            delete_remote_password(&connection.id)?;
            match request.key_passphrase.as_deref() {
                Some(value) if value.trim().is_empty() => {
                    delete_remote_key_passphrase(&connection.id)?
                }
                Some(value) => {
                    keyring_entry(&connection.id, "key-passphrase")?
                        .set_password(value)
                        .map_err(|error| {
                            format!(
                                "Failed to store the remote private-key passphrase in the OS keychain: {error}"
                            )
                        })?;
                }
                None => {}
            }
        }
    }
    Ok(())
}

fn delete_remote_auth_secrets(connection_id: &str) -> Result<(), String> {
    delete_remote_password(connection_id)?;
    delete_remote_key_passphrase(connection_id)?;
    Ok(())
}

fn delete_remote_password(connection_id: &str) -> Result<(), String> {
    delete_keyring_secret(connection_id, "password")
}

fn delete_remote_key_passphrase(connection_id: &str) -> Result<(), String> {
    delete_keyring_secret(connection_id, "key-passphrase")
}

fn delete_keyring_secret(connection_id: &str, secret_kind: &str) -> Result<(), String> {
    let entry = keyring_entry(connection_id, secret_kind)?;
    match entry.delete_credential() {
        Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
        Err(error) => Err(format!(
            "Failed to remove the remote {secret_kind} secret from the OS keychain: {error}"
        )),
    }
}

fn read_remote_password(connection_id: &str) -> Result<String, String> {
    keyring_entry(connection_id, "password")?
        .get_password()
        .map_err(|error| {
            format!("Failed to read the remote password from the OS keychain: {error}")
        })
}

fn read_remote_key_passphrase(connection_id: &str) -> Result<String, String> {
    keyring_entry(connection_id, "key-passphrase")?
        .get_password()
        .map_err(|error| {
            format!(
                "Failed to read the remote private-key passphrase from the OS keychain: {error}"
            )
        })
}

fn parse_remote_virtual_path(path: &str) -> Result<RemoteVirtualPath, String> {
    let url = Url::parse(path).map_err(|error| format!("Invalid remote path: {error}"))?;
    if url.scheme() != "remote" {
        return Err("Not a remote path.".to_string());
    }
    if url.host_str() != Some("sftp") {
        return Err("Unsupported remote protocol in path.".to_string());
    }
    let segments = url
        .path_segments()
        .map(|segments| segments.collect::<Vec<_>>())
        .ok_or_else(|| "Remote path is missing segments.".to_string())?;
    if segments.len() < 2 || segments[1] != "root" {
        return Err("Unsupported remote path shape.".to_string());
    }
    let connection_id = urlencoding::decode(segments[0])
        .map_err(|error| format!("Invalid remote connection identifier: {error}"))?
        .into_owned();
    let relative_segments = normalize_remote_relative_segments(&segments[2..])?;
    Ok(RemoteVirtualPath {
        connection_id,
        relative_segments,
    })
}

fn build_remote_virtual_path(connection_id: &str, relative_segments: &[String]) -> String {
    let mut path = format!("remote://sftp/{}/root", urlencoding::encode(connection_id));
    for segment in relative_segments {
        path.push('/');
        path.push_str(&urlencoding::encode(segment));
    }
    path
}

fn build_remote_virtual_path_from_actual(
    connection: &PersistedRemoteConnection,
    actual_path: &str,
) -> Result<String, String> {
    let normalized_root = normalize_remote_start_path(&connection.start_path)?;
    let normalized_actual = normalize_remote_join_path(actual_path);
    let relative_segments = if normalized_actual == normalized_root {
        Vec::new()
    } else {
        let root_prefix = if normalized_root.ends_with('/') {
            normalized_root.clone()
        } else {
            format!("{normalized_root}/")
        };
        let relative = normalized_actual
            .strip_prefix(&root_prefix)
            .ok_or_else(|| "Remote path escaped the configured connection root.".to_string())?;
        relative
            .split('/')
            .filter(|segment| !segment.is_empty())
            .map(str::to_string)
            .collect::<Vec<_>>()
    };
    Ok(build_remote_virtual_path(
        &connection.id,
        &relative_segments,
    ))
}

fn normalize_remote_relative_segments(raw_segments: &[&str]) -> Result<Vec<String>, String> {
    let mut normalized = Vec::new();
    for raw_segment in raw_segments {
        if raw_segment.is_empty() {
            continue;
        }
        let decoded = urlencoding::decode(raw_segment)
            .map_err(|error| format!("Invalid remote path segment: {error}"))?
            .into_owned();
        match decoded.as_str() {
            "" | "." => {}
            ".." => {
                if normalized.pop().is_none() {
                    return Err(
                        "Remote path cannot navigate above its configured root.".to_string()
                    );
                }
            }
            _ => normalized.push(decoded),
        }
    }
    Ok(normalized)
}

fn build_actual_remote_path(
    start_path: &str,
    relative_segments: &[String],
) -> Result<String, String> {
    let root = normalize_remote_start_path(start_path)?;
    if relative_segments.is_empty() {
        return Ok(root);
    }
    let joined_segments = relative_segments.join("/");
    if root == "/" {
        Ok(format!("/{joined_segments}"))
    } else if root.ends_with('/') {
        Ok(format!("{root}{joined_segments}"))
    } else {
        Ok(format!("{root}/{joined_segments}"))
    }
}

fn normalize_remote_start_path(start_path: &str) -> Result<String, String> {
    let trimmed = start_path.trim();
    if trimmed.is_empty() {
        return Err("Remote start path is required.".to_string());
    }
    let normalized = normalize_remote_join_path(trimmed);
    if normalized.is_empty() {
        return Err("Remote start path is invalid.".to_string());
    }
    Ok(normalized)
}

fn normalize_remote_join_path(path: &str) -> String {
    let mut normalized = path.replace('\\', "/");
    while normalized.contains("//") {
        normalized = normalized.replace("//", "/");
    }
    if normalized.len() > 1 {
        normalized = normalized.trim_end_matches('/').to_string();
    }
    normalized
}

fn trim_trailing_slashes(path: &str) -> &str {
    if path == "/" {
        path
    } else {
        path.trim_end_matches('/')
    }
}

fn build_remote_breadcrumbs(
    connection: &PersistedRemoteConnection,
    relative_segments: &[String],
) -> Vec<RemoteBreadcrumb> {
    let mut breadcrumbs = vec![RemoteBreadcrumb {
        label: connection.label.clone(),
        path: build_remote_virtual_path(&connection.id, &[]),
    }];
    let mut current_segments = Vec::new();
    for segment in relative_segments {
        current_segments.push(segment.clone());
        breadcrumbs.push(RemoteBreadcrumb {
            label: segment.clone(),
            path: build_remote_virtual_path(&connection.id, &current_segments),
        });
    }
    breadcrumbs
}

fn normalize_required_text(value: &str, label: &str) -> Result<String, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(format!("{label} is required."));
    }
    Ok(trimmed.to_string())
}

fn normalize_remote_leaf_name(name: &str) -> Result<String, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("Remote item name is required.".to_string());
    }
    if trimmed == "." || trimmed == ".." || trimmed.contains('/') || trimmed.contains('\\') {
        return Err(
            "Remote item names cannot contain path separators or reserved relative segments."
                .to_string(),
        );
    }
    Ok(trimmed.to_string())
}

fn remote_virtual_leaf_name(
    connection: &PersistedRemoteConnection,
    path: &RemoteVirtualPath,
) -> Result<String, String> {
    if let Some(leaf) = path.relative_segments.last() {
        return Ok(leaf.clone());
    }
    Path::new(&connection.start_path)
        .file_name()
        .and_then(OsStr::to_str)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .ok_or_else(|| {
            "Remote root cannot be transferred because it does not have a stable leaf name."
                .to_string()
        })
}

impl RemoteVirtualPath {
    fn parent_path(&self) -> Option<String> {
        if self.relative_segments.is_empty() {
            None
        } else {
            Some(build_remote_virtual_path(
                &self.connection_id,
                &self.relative_segments[..self.relative_segments.len() - 1]
                    .iter()
                    .cloned()
                    .collect::<Vec<_>>(),
            ))
        }
    }
}

fn remote_dir_entry_to_file_entry(
    connection: &PersistedRemoteConnection,
    parent: &RemoteVirtualPath,
    entry: SftpDirEntry,
) -> FileEntry {
    let name = remote_dir_entry_name(&entry);
    let mut relative_segments = parent.relative_segments.clone();
    relative_segments.push(name.clone());
    let path = build_remote_virtual_path(&connection.id, &relative_segments);
    let is_dir = remote_dir_entry_is_dir(&entry);
    let is_symlink = remote_dir_entry_is_symlink(&entry);
    let modified = entry.attrs().mtime.unwrap_or_default() as u64 * 1000;
    let size = entry.attrs().size.unwrap_or_default();
    let content_revision = build_content_revision(size, modified, is_dir, is_symlink);
    let identity = build_virtual_identity("remote-sftp", &path, &content_revision);
    FileEntry {
        name: name.clone(),
        path,
        is_dir,
        size,
        modified,
        extension: if is_dir {
            String::new()
        } else {
            Path::new(&name)
                .extension()
                .and_then(OsStr::to_str)
                .unwrap_or_default()
                .to_string()
        },
        is_hidden: name.starts_with('.'),
        is_symlink,
        entity_id: identity.entity_id,
        identity_kind: identity.identity_kind,
        content_revision: identity.content_revision,
    }
}

fn remote_dir_entry_name(entry: &SftpDirEntry) -> String {
    String::from_utf8_lossy(entry.name()).into_owned()
}

fn remote_dir_entry_is_dir(entry: &SftpDirEntry) -> bool {
    remote_attrs_is_dir(entry.attrs(), false) || entry.long_name().first() == Some(&b'd')
}

fn remote_dir_entry_is_symlink(entry: &SftpDirEntry) -> bool {
    remote_attrs_is_symlink(entry.attrs()) || entry.long_name().first() == Some(&b'l')
}

fn remote_attrs_is_dir(attrs: &Attrs, assume_root_directory: bool) -> bool {
    match attrs.perm.map(|perm| perm & UNIX_S_IFMT) {
        Some(mode) if mode == UNIX_S_IFDIR => true,
        Some(_) => false,
        None => assume_root_directory,
    }
}

fn remote_attrs_is_symlink(attrs: &Attrs) -> bool {
    matches!(
        attrs.perm.map(|perm| perm & UNIX_S_IFMT),
        Some(mode) if mode == UNIX_S_IFLNK
    )
}

fn sort_entries(entries: &mut [FileEntry]) {
    entries.sort_by(|left, right| {
        right
            .is_dir
            .cmp(&left.is_dir)
            .then_with(|| {
                left.name
                    .to_ascii_lowercase()
                    .cmp(&right.name.to_ascii_lowercase())
            })
            .then_with(|| left.path.cmp(&right.path))
    });
}

struct RemoteOperationError {
    message: String,
}

fn remote_operation_error(error: yazi_sftp::Error, include_hint: bool) -> RemoteOperationError {
    let message = match error {
        yazi_sftp::Error::Status(status) if include_hint => {
            format!(
                "Remote SFTP request failed: {:?} ({})",
                status.code, status.message
            )
        }
        other => format!("Remote SFTP operation failed: {other}"),
    };
    RemoteOperationError { message }
}

fn resolve_preview_byte_limit(requested_bytes: Option<u64>, hard_limit_bytes: u64) -> u64 {
    requested_bytes
        .unwrap_or(hard_limit_bytes)
        .max(1)
        .min(hard_limit_bytes)
}

fn format_preview_byte_limit(limit_bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;
    if limit_bytes >= GB {
        format!("{:.1} GB", limit_bytes as f64 / GB as f64)
    } else if limit_bytes >= MB {
        format!("{:.1} MB", limit_bytes as f64 / MB as f64)
    } else if limit_bytes >= KB {
        format!("{:.1} KB", limit_bytes as f64 / KB as f64)
    } else {
        format!("{limit_bytes} B")
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

#[cfg(test)]
mod tests {
    use super::{
        build_actual_remote_path, build_remote_virtual_path, make_keep_both_name,
        normalize_remote_relative_segments, normalize_remote_start_path, parse_remote_virtual_path,
        RemoteVirtualPath,
    };

    #[test]
    fn parses_remote_virtual_root_path() {
        let parsed = parse_remote_virtual_path("remote://sftp/demo-connection/root")
            .expect("root remote path should parse");
        assert_eq!(parsed.connection_id, "demo-connection".to_string());
        assert!(parsed.relative_segments.is_empty());
        assert_eq!(parsed.parent_path(), None);
    }

    #[test]
    fn parses_remote_virtual_nested_path() {
        let parsed = parse_remote_virtual_path(
            "remote://sftp/demo-connection/root/projects/My%20Folder/file.txt",
        )
        .expect("nested remote path should parse");
        assert_eq!(
            parsed.relative_segments,
            vec![
                "projects".to_string(),
                "My Folder".to_string(),
                "file.txt".to_string(),
            ]
        );
        assert_eq!(
            parsed.parent_path(),
            Some("remote://sftp/demo-connection/root/projects/My%20Folder".to_string())
        );
    }

    #[test]
    fn normalizes_remote_relative_segments() {
        let segments = normalize_remote_relative_segments(&["folder", ".", "child", "..", "leaf"])
            .expect("segments should normalize");
        assert_eq!(segments, vec!["folder".to_string(), "leaf".to_string()]);
    }

    #[test]
    fn rejects_remote_relative_escape() {
        let error =
            normalize_remote_relative_segments(&[".."]).expect_err("root escape should fail");
        assert!(error.contains("cannot navigate above"));
    }

    #[test]
    fn builds_remote_virtual_paths() {
        let path = build_remote_virtual_path(
            "demo-connection",
            &vec!["My Folder".to_string(), "file.txt".to_string()],
        );
        assert_eq!(
            path,
            "remote://sftp/demo-connection/root/My%20Folder/file.txt"
        );
    }

    #[test]
    fn builds_actual_remote_paths() {
        let path = build_actual_remote_path(
            "/mnt/storage",
            &vec!["projects".to_string(), "asset.blend".to_string()],
        )
        .expect("actual remote path should build");
        assert_eq!(path, "/mnt/storage/projects/asset.blend");
    }

    #[test]
    fn normalizes_remote_start_paths() {
        assert_eq!(
            normalize_remote_start_path(" /mnt/storage/ ").expect("start path should normalize"),
            "/mnt/storage".to_string()
        );
        assert_eq!(
            normalize_remote_start_path("C:/Users/remote/")
                .expect("windows-like start path should normalize"),
            "C:/Users/remote".to_string()
        );
    }

    #[test]
    fn keep_both_names_preserve_extensions() {
        assert_eq!(make_keep_both_name("asset.blend", 2), "asset copy 2.blend");
        assert_eq!(make_keep_both_name("folder", 3), "folder copy 3");
    }

    #[test]
    fn parent_path_builds_from_relative_segments() {
        let path = RemoteVirtualPath {
            connection_id: "demo".to_string(),
            relative_segments: vec!["projects".to_string(), "scene".to_string()],
        };
        assert_eq!(
            path.parent_path(),
            Some("remote://sftp/demo/root/projects".to_string())
        );
    }
}
