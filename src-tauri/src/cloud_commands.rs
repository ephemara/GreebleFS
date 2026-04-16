use crate::fs_commands::{
    fs_open_file, FileEntry, FileTransferCollisionPolicy, FileTransferDisposition,
    FileTransferOperation, FileTransferResult, FsWriteFileContent,
};
use async_recursion::async_recursion;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine as _;
use chrono::{DateTime, Utc};
use keyring::{Entry, Error as KeyringError};
use rand::{distributions::Alphanumeric, Rng};
use reqwest::multipart::{Form, Part};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager, State};
use url::Url;
use uuid::Uuid;

const CLOUD_ACCOUNTS_FILE: &str = "accounts.json";
const CLOUD_PROVIDER_CONFIG_FILE: &str = "providers.json";
const CLOUD_ROOT_DIRECTORY: &str = "cloud";
const CLOUD_TEMP_DIRECTORY: &str = "temp";
const CLOUD_KEYRING_SERVICE: &str = "co.overlayterm.app.cloud";
const CLOUD_PROVIDER_KEYRING_SERVICE: &str = "co.overlayterm.app.cloud.providers";
const CLOUD_TEXT_PREVIEW_MAX_BYTES: usize = 10 * 1024 * 1024;
const CLOUD_BASE64_PREVIEW_MAX_BYTES: usize = 12 * 1024 * 1024;
const DROPBOX_OAUTH_CALLBACK_PORT: u16 = 53_682;
const DROPBOX_OAUTH_CALLBACK_URI: &str = "http://localhost:53682/callback";

#[derive(Debug, Clone, Copy, Serialize, Deserialize, specta::Type, PartialEq, Eq, Hash)]
#[serde(rename_all = "kebab-case")]
pub enum CloudProviderId {
    GoogleDrive,
    Dropbox,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, specta::Type, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum CloudProviderConfigurationSource {
    None,
    Settings,
    Environment,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CloudAccountStatus {
    Connected,
    Expired,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct CloudProviderConfigurationStatus {
    pub provider: CloudProviderId,
    pub configured: bool,
    pub missing_configuration: Vec<String>,
    pub configuration_source: CloudProviderConfigurationSource,
    pub client_id: Option<String>,
    pub client_secret_present: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct CloudAccountSummary {
    pub id: String,
    pub provider: CloudProviderId,
    pub display_name: String,
    pub email: String,
    pub avatar_url: Option<String>,
    pub connected_at: u64,
    pub status: CloudAccountStatus,
    pub drive_label: String,
    pub root_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct CloudAccountsSnapshot {
    pub accounts: Vec<CloudAccountSummary>,
    pub providers: Vec<CloudProviderConfigurationStatus>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct CloudAuthSession {
    pub request_id: String,
    pub provider: CloudProviderId,
    pub authorization_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct CloudAuthStatus {
    pub status: String,
    pub account: Option<CloudAccountSummary>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct CloudBreadcrumb {
    pub label: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct CloudDirectoryListing {
    pub path: String,
    pub parent_path: Option<String>,
    pub breadcrumbs: Vec<CloudBreadcrumb>,
    pub entries: Vec<FileEntry>,
}

#[derive(Debug, Clone)]
struct ProviderConfig {
    provider: CloudProviderId,
    client_id: String,
    client_secret: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PersistedCloudAccounts {
    accounts: Vec<PersistedCloudAccount>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct PersistedCloudProviderConfigurations {
    providers: Vec<PersistedCloudProviderConfiguration>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PersistedCloudProviderConfiguration {
    provider: CloudProviderId,
    client_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PersistedCloudAccount {
    id: String,
    provider: CloudProviderId,
    display_name: String,
    email: String,
    avatar_url: Option<String>,
    connected_at: u64,
    status: CloudAccountStatus,
    drive_label: String,
}

impl PersistedCloudAccount {
    fn summary(&self) -> CloudAccountSummary {
        CloudAccountSummary {
            id: self.id.clone(),
            provider: self.provider,
            display_name: self.display_name.clone(),
            email: self.email.clone(),
            avatar_url: self.avatar_url.clone(),
            connected_at: self.connected_at,
            status: self.status.clone(),
            drive_label: self.drive_label.clone(),
            root_path: build_cloud_root_path(self.provider, &self.id),
        }
    }
}

#[derive(Debug, Clone)]
struct AccessTokenCacheEntry {
    access_token: String,
    expires_at_ms: u64,
}

#[derive(Debug, Clone)]
struct PendingAuthSession {
    provider: CloudProviderId,
    redirect_uri: String,
    code_verifier: String,
    callback: Option<AuthCallbackPayload>,
    completed: Option<CloudAccountSummary>,
    error: Option<String>,
}

#[derive(Debug, Clone)]
struct AuthCallbackPayload {
    code: Option<String>,
    error: Option<String>,
}

#[derive(Debug)]
struct AuthCallbackListener {
    redirect_uri: String,
    listeners: Vec<TcpListener>,
}

#[derive(Debug, Clone)]
struct ResolvedProviderConfiguration {
    source: CloudProviderConfigurationSource,
    client_id: Option<String>,
    client_secret: Option<String>,
}

#[derive(Clone)]
pub struct CloudRuntimeState {
    auth_sessions: Arc<Mutex<HashMap<String, PendingAuthSession>>>,
    access_tokens: Arc<Mutex<HashMap<String, AccessTokenCacheEntry>>>,
}

impl Default for CloudRuntimeState {
    fn default() -> Self {
        Self {
            auth_sessions: Arc::new(Mutex::new(HashMap::new())),
            access_tokens: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

#[derive(Debug)]
enum CloudPathRef {
    Root {
        provider: CloudProviderId,
        account_id: String,
    },
    Item {
        provider: CloudProviderId,
        account_id: String,
        item_id: String,
    },
}

#[derive(Debug, Deserialize)]
struct GoogleTokenResponse {
    access_token: String,
    expires_in: u64,
    #[serde(default)]
    refresh_token: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GoogleUserInfoResponse {
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    email: Option<String>,
    #[serde(default)]
    picture: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GoogleFileListResponse {
    #[serde(default)]
    files: Vec<GoogleDriveFile>,
    #[serde(default)]
    next_page_token: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct GoogleDriveFile {
    id: String,
    name: String,
    #[serde(default)]
    #[serde(rename = "mimeType")]
    mime_type: String,
    #[serde(default)]
    size: Option<String>,
    #[serde(default)]
    #[serde(rename = "modifiedTime")]
    modified_time: Option<String>,
    #[serde(default)]
    parents: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
struct DropboxTokenResponse {
    access_token: String,
    expires_in: u64,
    #[serde(default)]
    refresh_token: Option<String>,
}

#[derive(Debug, Deserialize)]
struct DropboxAccountResponse {
    #[serde(default)]
    name: DropboxDisplayName,
    #[serde(default)]
    email: Option<String>,
    #[serde(default)]
    profile_photo_url: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
struct DropboxDisplayName {
    #[serde(default)]
    display_name: String,
}

#[derive(Debug, Deserialize)]
struct DropboxListFolderResponse {
    #[serde(default)]
    entries: Vec<DropboxMetadataEntry>,
}

#[derive(Debug, Clone, Deserialize)]
struct DropboxMetadataEntry {
    #[serde(rename = ".tag")]
    tag: String,
    name: String,
    #[serde(default)]
    path_display: Option<String>,
    #[serde(default)]
    path_lower: Option<String>,
    #[serde(default)]
    server_modified: Option<String>,
    #[serde(default)]
    size: Option<u64>,
}

#[derive(Debug, Clone)]
struct CloudFilePayload {
    bytes: Vec<u8>,
    name: String,
}

#[tauri::command]
#[specta::specta]
pub async fn cloud_list_accounts(app: AppHandle) -> Result<CloudAccountsSnapshot, String> {
    let accounts = read_accounts(&app)?
        .accounts
        .into_iter()
        .map(|account| account.summary())
        .collect::<Vec<_>>();
    Ok(CloudAccountsSnapshot {
        accounts,
        providers: provider_configuration_statuses(&app)?,
    })
}

#[tauri::command]
#[specta::specta]
pub async fn cloud_set_provider_configuration(
    app: AppHandle,
    provider: CloudProviderId,
    client_id: String,
    client_secret: Option<String>,
) -> Result<CloudProviderConfigurationStatus, String> {
    let trimmed_client_id = client_id.trim().to_string();
    if trimmed_client_id.is_empty() {
        return Err(format!(
            "{} client ID is required.",
            provider_label(provider)
        ));
    }

    upsert_provider_configuration(&app, provider, &trimmed_client_id)?;
    let trimmed_client_secret = client_secret
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    if let Some(secret) = trimmed_client_secret {
        write_provider_client_secret(provider, secret)?;
    } else {
        delete_provider_client_secret(provider)?;
    }

    provider_configuration_status(&app, provider)
}

#[tauri::command]
#[specta::specta]
pub async fn cloud_clear_provider_configuration(
    app: AppHandle,
    provider: CloudProviderId,
) -> Result<CloudProviderConfigurationStatus, String> {
    remove_provider_configuration(&app, provider)?;
    delete_provider_client_secret(provider)?;
    provider_configuration_status(&app, provider)
}

#[tauri::command]
#[specta::specta]
pub async fn cloud_begin_auth(
    app: AppHandle,
    state: State<'_, CloudRuntimeState>,
    provider: CloudProviderId,
) -> Result<CloudAuthSession, String> {
    let config = provider_config(&app, provider)?;
    let request_id = Uuid::new_v4().to_string();
    let state_token = random_token(48);
    let code_verifier = random_token(96);
    let code_challenge = pkce_challenge(&code_verifier);
    let callback_listener = create_auth_callback_listener(provider)?;
    let redirect_uri = callback_listener.redirect_uri.clone();
    let authorization_url =
        build_authorization_url(&config, &redirect_uri, &state_token, &code_challenge)?;

    {
        let mut sessions = state
            .auth_sessions
            .lock()
            .map_err(|_| "cloud auth session state lock poisoned".to_string())?;
        sessions.insert(
            request_id.clone(),
            PendingAuthSession {
                provider,
                redirect_uri: redirect_uri.clone(),
                code_verifier: code_verifier.clone(),
                callback: None,
                completed: None,
                error: None,
            },
        );
    }

    let sessions = state.auth_sessions.clone();
    let request_id_for_thread = request_id.clone();
    let listeners = callback_listener.listeners;
    thread::spawn(move || {
        let deadline = std::time::Instant::now() + Duration::from_secs(300);
        loop {
            if std::time::Instant::now() >= deadline {
                update_auth_callback(
                    &sessions,
                    &request_id_for_thread,
                    AuthCallbackPayload {
                        code: None,
                        error: Some("Timed out waiting for browser sign-in.".to_string()),
                    },
                );
                break;
            }

            let mut received_callback = false;
            for listener in &listeners {
                match listener.accept() {
                    Ok((mut stream, _)) => {
                        let result = read_callback_payload(&mut stream, &state_token);
                        let _ = write_callback_response(&mut stream, result.is_ok());
                        match result {
                            Ok(payload) => {
                                update_auth_callback(&sessions, &request_id_for_thread, payload)
                            }
                            Err(error) => update_auth_callback(
                                &sessions,
                                &request_id_for_thread,
                                AuthCallbackPayload {
                                    code: None,
                                    error: Some(error),
                                },
                            ),
                        }
                        received_callback = true;
                        break;
                    }
                    Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {}
                    Err(error) => {
                        update_auth_callback(
                            &sessions,
                            &request_id_for_thread,
                            AuthCallbackPayload {
                                code: None,
                                error: Some(format!("OAuth callback listener failed: {error}")),
                            },
                        );
                        received_callback = true;
                        break;
                    }
                }
            }

            if received_callback {
                break;
            }

            thread::sleep(Duration::from_millis(120));
        }
    });

    Ok(CloudAuthSession {
        request_id,
        provider,
        authorization_url,
    })
}

#[tauri::command]
#[specta::specta]
pub async fn cloud_poll_auth(
    app: AppHandle,
    state: State<'_, CloudRuntimeState>,
    request_id: String,
) -> Result<CloudAuthStatus, String> {
    let pending = {
        let sessions = state
            .auth_sessions
            .lock()
            .map_err(|_| "cloud auth session state lock poisoned".to_string())?;
        sessions
            .get(&request_id)
            .cloned()
            .ok_or_else(|| "Unknown cloud auth request.".to_string())?
    };

    if let Some(account) = pending.completed {
        return Ok(CloudAuthStatus {
            status: "completed".to_string(),
            account: Some(account),
            error: None,
        });
    }

    if let Some(error) = pending.error {
        return Ok(CloudAuthStatus {
            status: "failed".to_string(),
            account: None,
            error: Some(error),
        });
    }

    let Some(callback) = pending.callback else {
        return Ok(CloudAuthStatus {
            status: "pending".to_string(),
            account: None,
            error: None,
        });
    };

    if let Some(error) = callback.error {
        let mut sessions = state
            .auth_sessions
            .lock()
            .map_err(|_| "cloud auth session state lock poisoned".to_string())?;
        if let Some(session) = sessions.get_mut(&request_id) {
            session.error = Some(error.clone());
        }
        return Ok(CloudAuthStatus {
            status: "failed".to_string(),
            account: None,
            error: Some(error),
        });
    }

    let code = callback
        .code
        .ok_or_else(|| "Missing authorization code from browser callback.".to_string())?;
    let config = provider_config(&app, pending.provider)?;
    let client = cloud_http_client()?;
    let token = exchange_authorization_code(
        &client,
        &config,
        &pending.redirect_uri,
        &pending.code_verifier,
        &code,
    )
    .await?;
    let refresh_token = token
        .refresh_token
        .clone()
        .ok_or_else(|| "Provider did not return a refresh token. Reconnect and ensure offline access is enabled.".to_string())?;
    let account = fetch_account_profile(&client, pending.provider, &token.access_token).await?;
    write_refresh_token(account.provider, &account.id, &refresh_token)?;
    upsert_account(
        &app,
        PersistedCloudAccount {
            id: account.id.clone(),
            provider: account.provider,
            display_name: account.display_name.clone(),
            email: account.email.clone(),
            avatar_url: account.avatar_url.clone(),
            connected_at: account.connected_at,
            status: CloudAccountStatus::Connected,
            drive_label: account.drive_label.clone(),
        },
    )?;
    store_access_token(
        &state,
        account.provider,
        &account.id,
        &token.access_token,
        token.expires_in,
    )?;
    let account_id = account.id.clone();
    let summary = CloudAccountSummary {
        id: account_id.clone(),
        provider: account.provider,
        display_name: account.display_name,
        email: account.email,
        avatar_url: account.avatar_url,
        connected_at: account.connected_at,
        status: CloudAccountStatus::Connected,
        drive_label: account.drive_label,
        root_path: build_cloud_root_path(account.provider, &account_id),
    };
    let mut sessions = state
        .auth_sessions
        .lock()
        .map_err(|_| "cloud auth session state lock poisoned".to_string())?;
    if let Some(session) = sessions.get_mut(&request_id) {
        session.completed = Some(summary.clone());
        session.error = None;
    }
    Ok(CloudAuthStatus {
        status: "completed".to_string(),
        account: Some(summary),
        error: None,
    })
}

#[tauri::command]
#[specta::specta]
pub async fn cloud_disconnect_account(
    app: AppHandle,
    state: State<'_, CloudRuntimeState>,
    account_id: String,
) -> Result<(), String> {
    let accounts = read_accounts(&app)?;
    let account = accounts
        .accounts
        .iter()
        .find(|entry| entry.id == account_id)
        .cloned()
        .ok_or_else(|| "Cloud account was not found.".to_string())?;
    let next_accounts = accounts
        .accounts
        .into_iter()
        .filter(|entry| entry.id != account_id)
        .collect::<Vec<_>>();
    write_accounts(
        &app,
        &PersistedCloudAccounts {
            accounts: next_accounts,
        },
    )?;
    clear_access_token(&state, account.provider, &account.id)?;
    delete_refresh_token(account.provider, &account.id)?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn cloud_list_dir(
    app: AppHandle,
    state: State<'_, CloudRuntimeState>,
    path: String,
) -> Result<CloudDirectoryListing, String> {
    let parsed = parse_cloud_path(&path)?;
    let account = load_account(&app, parsed.account_id())?;
    let client = cloud_http_client()?;
    match parsed {
        CloudPathRef::Root {
            provider,
            account_id,
        } => {
            list_cloud_root_directory(&app, &state, &client, provider, &account_id, &account).await
        }
        CloudPathRef::Item {
            provider,
            account_id,
            item_id,
        } => {
            list_cloud_item_directory(
                &app,
                &state,
                &client,
                provider,
                &account_id,
                &item_id,
                &account,
            )
            .await
        }
    }
}

#[tauri::command]
#[specta::specta]
pub async fn cloud_open_file(
    app: AppHandle,
    state: State<'_, CloudRuntimeState>,
    path: String,
) -> Result<(), String> {
    let local_path = cloud_download_to_temp(&app, &state, &path).await?;
    fs_open_file(local_path).await
}

#[tauri::command]
#[specta::specta]
pub async fn cloud_read_text_file(
    app: AppHandle,
    state: State<'_, CloudRuntimeState>,
    path: String,
) -> Result<String, String> {
    let payload = download_cloud_file(&app, &state, &path).await?;
    if payload.bytes.len() > CLOUD_TEXT_PREVIEW_MAX_BYTES {
        return Err("Cloud file is too large to preview as text (> 10 MB).".to_string());
    }
    String::from_utf8(payload.bytes)
        .map_err(|error| format!("Cloud file is not valid UTF-8: {error}"))
}

#[tauri::command]
#[specta::specta]
pub async fn cloud_read_file_base64(
    app: AppHandle,
    state: State<'_, CloudRuntimeState>,
    path: String,
) -> Result<String, String> {
    let payload = download_cloud_file(&app, &state, &path).await?;
    if payload.bytes.len() > CLOUD_BASE64_PREVIEW_MAX_BYTES {
        return Err("Cloud file is too large to preview (> 12 MB).".to_string());
    }
    let extension = Path::new(&payload.name)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default();
    let mime = mime_from_extension(extension);
    Ok(format!(
        "data:{};base64,{}",
        mime,
        URL_SAFE_NO_PAD.encode(payload.bytes)
    ))
}

#[tauri::command]
#[specta::specta]
pub async fn cloud_write_file(
    app: AppHandle,
    state: State<'_, CloudRuntimeState>,
    path: String,
    content: FsWriteFileContent,
) -> Result<(), String> {
    let parsed = parse_cloud_path(&path)?;
    let account = load_account(&app, parsed.account_id())?;
    let client = cloud_http_client()?;
    let access_token = access_token_for_account(&app, &state, &client, &account).await?;
    let bytes = match content {
        FsWriteFileContent::Text(value) => value.into_bytes(),
        FsWriteFileContent::Bytes(value) => value,
    };
    match parsed {
        CloudPathRef::Root { .. } => Err("Cannot write to a cloud drive root.".to_string()),
        CloudPathRef::Item {
            provider, item_id, ..
        } => overwrite_cloud_file(&client, provider, &access_token, &item_id, bytes).await,
    }
}

#[tauri::command]
#[specta::specta]
pub async fn cloud_create_file(
    app: AppHandle,
    state: State<'_, CloudRuntimeState>,
    parent_path: String,
    name: String,
    content: FsWriteFileContent,
) -> Result<(), String> {
    let parent = parse_cloud_path(&parent_path)?;
    let account = load_account(&app, parent.account_id())?;
    let client = cloud_http_client()?;
    let access_token = access_token_for_account(&app, &state, &client, &account).await?;
    let bytes = match content {
        FsWriteFileContent::Text(value) => value.into_bytes(),
        FsWriteFileContent::Bytes(value) => value,
    };
    create_cloud_file(&client, &parent, &access_token, &name, bytes).await
}

#[tauri::command]
#[specta::specta]
pub async fn cloud_create_directory(
    app: AppHandle,
    state: State<'_, CloudRuntimeState>,
    parent_path: String,
    name: String,
) -> Result<(), String> {
    let parent = parse_cloud_path(&parent_path)?;
    let account = load_account(&app, parent.account_id())?;
    let client = cloud_http_client()?;
    let access_token = access_token_for_account(&app, &state, &client, &account).await?;
    create_cloud_directory_impl(&client, &parent, &access_token, &name).await
}

#[tauri::command]
#[specta::specta]
pub async fn cloud_rename_path(
    app: AppHandle,
    state: State<'_, CloudRuntimeState>,
    path: String,
    new_name: String,
) -> Result<(), String> {
    let parsed = parse_cloud_path(&path)?;
    let account = load_account(&app, parsed.account_id())?;
    let client = cloud_http_client()?;
    let access_token = access_token_for_account(&app, &state, &client, &account).await?;
    rename_cloud_path_impl(&client, &parsed, &access_token, &new_name).await
}

#[tauri::command]
#[specta::specta]
pub async fn cloud_delete_path(
    app: AppHandle,
    state: State<'_, CloudRuntimeState>,
    path: String,
) -> Result<(), String> {
    let parsed = parse_cloud_path(&path)?;
    let account = load_account(&app, parsed.account_id())?;
    let client = cloud_http_client()?;
    let access_token = access_token_for_account(&app, &state, &client, &account).await?;
    delete_cloud_path_impl(&client, &parsed, &access_token).await
}

#[tauri::command]
#[specta::specta]
pub async fn cloud_transfer_items(
    app: AppHandle,
    state: State<'_, CloudRuntimeState>,
    target_dir: String,
    sources: Vec<String>,
    operation: FileTransferOperation,
) -> Result<Vec<FileTransferResult>, String> {
    if sources.is_empty() {
        return Ok(Vec::new());
    }
    let client = cloud_http_client()?;
    let mut results = Vec::new();
    for source in sources {
        if source.starts_with("cloud://") || target_dir.starts_with("cloud://") {
            transfer_between_local_and_cloud(
                &app,
                &state,
                &client,
                &target_dir,
                &source,
                operation,
            )
            .await?;
            results.push(FileTransferResult {
                source_path: source.clone(),
                destination_path: target_dir.clone(),
                operation,
                collision_policy: FileTransferCollisionPolicy::KeepBoth,
                disposition: FileTransferDisposition::Transferred,
            });
        }
    }
    Ok(results)
}

impl CloudPathRef {
    fn provider(&self) -> CloudProviderId {
        match self {
            CloudPathRef::Root { provider, .. } | CloudPathRef::Item { provider, .. } => *provider,
        }
    }

    fn account_id(&self) -> &str {
        match self {
            CloudPathRef::Root { account_id, .. } | CloudPathRef::Item { account_id, .. } => {
                account_id.as_str()
            }
        }
    }

    fn item_id(&self) -> Option<&str> {
        match self {
            CloudPathRef::Root { .. } => None,
            CloudPathRef::Item { item_id, .. } => Some(item_id.as_str()),
        }
    }
}

fn cloud_http_client() -> Result<Client, String> {
    Client::builder()
        .user_agent("GreebleFS Cloud Explorer/1.0")
        .build()
        .map_err(|error| format!("Failed to create cloud HTTP client: {error}"))
}

fn provider_configuration_statuses(
    app: &AppHandle,
) -> Result<Vec<CloudProviderConfigurationStatus>, String> {
    [CloudProviderId::GoogleDrive, CloudProviderId::Dropbox]
        .into_iter()
        .map(|provider| provider_configuration_status(app, provider))
        .collect()
}

fn provider_configuration_status(
    app: &AppHandle,
    provider: CloudProviderId,
) -> Result<CloudProviderConfigurationStatus, String> {
    let resolved = resolved_provider_configuration(app, provider)?;
    let mut missing_configuration = Vec::new();
    if resolved.client_id.is_none() {
        missing_configuration.push("client ID".to_string());
    }
    Ok(CloudProviderConfigurationStatus {
        provider,
        configured: missing_configuration.is_empty(),
        missing_configuration,
        configuration_source: resolved.source,
        client_id: resolved.client_id,
        client_secret_present: resolved.client_secret.is_some(),
    })
}

fn provider_config(app: &AppHandle, provider: CloudProviderId) -> Result<ProviderConfig, String> {
    let resolved = resolved_provider_configuration(app, provider)?;
    let Some(client_id) = resolved.client_id else {
        return Err(format!(
            "{} is not configured. Add a client ID in Settings > Cloud Accounts or provide {}.",
            provider_label(provider),
            provider_client_id_env_key(provider),
        ));
    };
    Ok(ProviderConfig {
        provider,
        client_id,
        client_secret: resolved.client_secret,
    })
}

fn env_trimmed(key: &str) -> Option<String> {
    std::env::var(key)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn random_token(length: usize) -> String {
    rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(length)
        .map(char::from)
        .collect::<String>()
}

fn pkce_challenge(code_verifier: &str) -> String {
    let mut hash = Sha256::new();
    hash.update(code_verifier.as_bytes());
    URL_SAFE_NO_PAD.encode(hash.finalize())
}

fn provider_label(provider: CloudProviderId) -> &'static str {
    match provider {
        CloudProviderId::GoogleDrive => "Google Drive",
        CloudProviderId::Dropbox => "Dropbox",
    }
}

fn provider_client_id_env_key(provider: CloudProviderId) -> &'static str {
    match provider {
        CloudProviderId::GoogleDrive => "GREEBLE_GOOGLE_DRIVE_CLIENT_ID",
        CloudProviderId::Dropbox => "GREEBLE_DROPBOX_CLIENT_ID",
    }
}

fn provider_client_secret_env_key(provider: CloudProviderId) -> &'static str {
    match provider {
        CloudProviderId::GoogleDrive => "GREEBLE_GOOGLE_DRIVE_CLIENT_SECRET",
        CloudProviderId::Dropbox => "GREEBLE_DROPBOX_CLIENT_SECRET",
    }
}

fn build_cloud_root_path(provider: CloudProviderId, account_id: &str) -> String {
    format!("cloud://{}/{}/root", provider_host(provider), account_id)
}

fn build_cloud_item_path(provider: CloudProviderId, account_id: &str, item_id: &str) -> String {
    format!(
        "cloud://{}/{}/item/{}",
        provider_host(provider),
        account_id,
        URL_SAFE_NO_PAD.encode(item_id.as_bytes())
    )
}

fn provider_host(provider: CloudProviderId) -> &'static str {
    match provider {
        CloudProviderId::GoogleDrive => "google-drive",
        CloudProviderId::Dropbox => "dropbox",
    }
}

fn parse_provider_host(value: &str) -> Result<CloudProviderId, String> {
    match value {
        "google-drive" => Ok(CloudProviderId::GoogleDrive),
        "dropbox" => Ok(CloudProviderId::Dropbox),
        _ => Err(format!("Unsupported cloud provider in path: {value}")),
    }
}

fn parse_cloud_path(path: &str) -> Result<CloudPathRef, String> {
    let url = Url::parse(path).map_err(|error| format!("Invalid cloud path: {error}"))?;
    if url.scheme() != "cloud" {
        return Err("Not a cloud path.".to_string());
    }
    let provider = parse_provider_host(
        url.host_str()
            .ok_or_else(|| "Missing cloud provider in path.".to_string())?,
    )?;
    let segments = url.path_segments().map(|value| value.collect::<Vec<_>>());
    let segments = segments.ok_or_else(|| "Cloud path is missing segments.".to_string())?;
    if segments.len() == 2 && segments[1] == "root" {
        return Ok(CloudPathRef::Root {
            provider,
            account_id: segments[0].to_string(),
        });
    }
    if segments.len() == 3 && segments[1] == "item" {
        let item_id_bytes = URL_SAFE_NO_PAD
            .decode(segments[2])
            .map_err(|error| format!("Invalid cloud item identifier: {error}"))?;
        let item_id = String::from_utf8(item_id_bytes)
            .map_err(|error| format!("Invalid UTF-8 cloud item identifier: {error}"))?;
        return Ok(CloudPathRef::Item {
            provider,
            account_id: segments[0].to_string(),
            item_id,
        });
    }
    Err("Unsupported cloud path shape.".to_string())
}

fn accounts_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_local_data_dir()
        .map_err(|error| format!("Failed to resolve app local data directory: {error}"))?
        .join(CLOUD_ROOT_DIRECTORY);
    fs::create_dir_all(&base)
        .map_err(|error| format!("Failed to create cloud account directory: {error}"))?;
    Ok(base.join(CLOUD_ACCOUNTS_FILE))
}

fn provider_config_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_local_data_dir()
        .map_err(|error| format!("Failed to resolve app local data directory: {error}"))?
        .join(CLOUD_ROOT_DIRECTORY);
    fs::create_dir_all(&base)
        .map_err(|error| format!("Failed to create cloud configuration directory: {error}"))?;
    Ok(base.join(CLOUD_PROVIDER_CONFIG_FILE))
}

fn temp_root_path(app: &AppHandle) -> Result<PathBuf, String> {
    let root = app
        .path()
        .app_local_data_dir()
        .map_err(|error| format!("Failed to resolve app local data directory: {error}"))?
        .join(CLOUD_ROOT_DIRECTORY)
        .join(CLOUD_TEMP_DIRECTORY);
    fs::create_dir_all(&root)
        .map_err(|error| format!("Failed to create cloud temp directory: {error}"))?;
    Ok(root)
}

fn read_accounts(app: &AppHandle) -> Result<PersistedCloudAccounts, String> {
    let path = accounts_file_path(app)?;
    if !path.exists() {
        return Ok(PersistedCloudAccounts {
            accounts: Vec::new(),
        });
    }
    let content = fs::read_to_string(&path)
        .map_err(|error| format!("Failed to read persisted cloud accounts: {error}"))?;
    serde_json::from_str::<PersistedCloudAccounts>(&content)
        .map_err(|error| format!("Failed to parse persisted cloud accounts: {error}"))
}

fn read_provider_configurations(
    app: &AppHandle,
) -> Result<PersistedCloudProviderConfigurations, String> {
    let path = provider_config_file_path(app)?;
    if !path.exists() {
        return Ok(PersistedCloudProviderConfigurations::default());
    }
    let content = fs::read_to_string(&path)
        .map_err(|error| format!("Failed to read persisted cloud provider settings: {error}"))?;
    serde_json::from_str::<PersistedCloudProviderConfigurations>(&content)
        .map_err(|error| format!("Failed to parse persisted cloud provider settings: {error}"))
}

fn write_accounts(app: &AppHandle, accounts: &PersistedCloudAccounts) -> Result<(), String> {
    let path = accounts_file_path(app)?;
    let content = serde_json::to_string_pretty(accounts)
        .map_err(|error| format!("Failed to serialize persisted cloud accounts: {error}"))?;
    fs::write(&path, content).map_err(|error| format!("Failed to persist cloud accounts: {error}"))
}

fn write_provider_configurations(
    app: &AppHandle,
    configurations: &PersistedCloudProviderConfigurations,
) -> Result<(), String> {
    let path = provider_config_file_path(app)?;
    let content = serde_json::to_string_pretty(configurations).map_err(|error| {
        format!("Failed to serialize persisted cloud provider settings: {error}")
    })?;
    fs::write(&path, content)
        .map_err(|error| format!("Failed to persist cloud provider settings: {error}"))
}

fn upsert_account(app: &AppHandle, next: PersistedCloudAccount) -> Result<(), String> {
    let mut accounts = read_accounts(app)?;
    if let Some(existing) = accounts.accounts.iter_mut().find(|entry| {
        entry.provider == next.provider && entry.email.eq_ignore_ascii_case(&next.email)
    }) {
        *existing = next;
    } else {
        accounts.accounts.push(next);
    }
    accounts.accounts.sort_by(|left, right| {
        left.drive_label
            .to_lowercase()
            .cmp(&right.drive_label.to_lowercase())
    });
    write_accounts(app, &accounts)
}

fn upsert_provider_configuration(
    app: &AppHandle,
    provider: CloudProviderId,
    client_id: &str,
) -> Result<(), String> {
    let mut configurations = read_provider_configurations(app)?;
    if let Some(existing) = configurations
        .providers
        .iter_mut()
        .find(|entry| entry.provider == provider)
    {
        existing.client_id = client_id.to_string();
    } else {
        configurations
            .providers
            .push(PersistedCloudProviderConfiguration {
                provider,
                client_id: client_id.to_string(),
            });
    }
    configurations
        .providers
        .sort_by_key(|entry| provider_host(entry.provider));
    write_provider_configurations(app, &configurations)
}

fn remove_provider_configuration(app: &AppHandle, provider: CloudProviderId) -> Result<(), String> {
    let mut configurations = read_provider_configurations(app)?;
    configurations
        .providers
        .retain(|entry| entry.provider != provider);
    write_provider_configurations(app, &configurations)
}

fn load_account(app: &AppHandle, account_id: &str) -> Result<PersistedCloudAccount, String> {
    read_accounts(app)?
        .accounts
        .into_iter()
        .find(|entry| entry.id == account_id)
        .ok_or_else(|| "Cloud account was not found.".to_string())
}

fn provider_secret_keyring_entry(provider: CloudProviderId) -> Result<Entry, String> {
    Entry::new(
        CLOUD_PROVIDER_KEYRING_SERVICE,
        &format!("{}:client_secret", provider_host(provider)),
    )
    .map_err(|error| format!("Failed to open provider credential keychain entry: {error}"))
}

fn keyring_entry(provider: CloudProviderId, account_id: &str) -> Result<Entry, String> {
    Entry::new(
        CLOUD_KEYRING_SERVICE,
        &format!("{}:{account_id}:refresh_token", provider_host(provider)),
    )
    .map_err(|error| format!("Failed to open keychain entry: {error}"))
}

fn write_provider_client_secret(
    provider: CloudProviderId,
    client_secret: &str,
) -> Result<(), String> {
    provider_secret_keyring_entry(provider)?
        .set_password(client_secret)
        .map_err(|error| {
            format!("Failed to store provider client secret in the OS keychain: {error}")
        })
}

fn read_provider_client_secret(provider: CloudProviderId) -> Option<String> {
    let entry = match provider_secret_keyring_entry(provider) {
        Ok(entry) => entry,
        Err(error) => {
            eprintln!("GreebleFS: {error}");
            return None;
        }
    };
    match entry.get_password() {
        Ok(secret) => Some(secret),
        Err(KeyringError::NoEntry) => None,
        Err(error) => {
            eprintln!(
                "GreebleFS: failed to read provider client secret from the OS keychain: {error}"
            );
            None
        }
    }
}

fn delete_provider_client_secret(provider: CloudProviderId) -> Result<(), String> {
    let entry = provider_secret_keyring_entry(provider)?;
    match entry.delete_credential() {
        Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
        Err(error) => Err(format!(
            "Failed to remove provider client secret from the OS keychain: {error}"
        )),
    }
}

fn write_refresh_token(
    provider: CloudProviderId,
    account_id: &str,
    refresh_token: &str,
) -> Result<(), String> {
    keyring_entry(provider, account_id)?
        .set_password(refresh_token)
        .map_err(|error| format!("Failed to store refresh token in the OS keychain: {error}"))
}

fn read_refresh_token(provider: CloudProviderId, account_id: &str) -> Result<String, String> {
    keyring_entry(provider, account_id)?
        .get_password()
        .map_err(|error| format!("Failed to read refresh token from the OS keychain: {error}"))
}

fn resolved_provider_configuration(
    app: &AppHandle,
    provider: CloudProviderId,
) -> Result<ResolvedProviderConfiguration, String> {
    let saved_configuration = read_provider_configurations(app)?
        .providers
        .into_iter()
        .find(|entry| entry.provider == provider);
    if let Some(saved_configuration) = saved_configuration {
        return Ok(ResolvedProviderConfiguration {
            source: CloudProviderConfigurationSource::Settings,
            client_id: Some(saved_configuration.client_id),
            client_secret: read_provider_client_secret(provider),
        });
    }

    let client_id = env_trimmed(provider_client_id_env_key(provider));
    let client_secret = env_trimmed(provider_client_secret_env_key(provider));
    let source = if client_id.is_some() || client_secret.is_some() {
        CloudProviderConfigurationSource::Environment
    } else {
        CloudProviderConfigurationSource::None
    };
    Ok(ResolvedProviderConfiguration {
        source,
        client_id,
        client_secret,
    })
}

fn delete_refresh_token(provider: CloudProviderId, account_id: &str) -> Result<(), String> {
    let entry = keyring_entry(provider, account_id)?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(error) => Err(format!(
            "Failed to remove refresh token from the OS keychain: {error}"
        )),
    }
}

fn clear_access_token(
    state: &CloudRuntimeState,
    provider: CloudProviderId,
    account_id: &str,
) -> Result<(), String> {
    let mut cache = state
        .access_tokens
        .lock()
        .map_err(|_| "cloud access token cache lock poisoned".to_string())?;
    cache.remove(&format!("{}:{account_id}", provider_host(provider)));
    Ok(())
}

fn store_access_token(
    state: &CloudRuntimeState,
    provider: CloudProviderId,
    account_id: &str,
    access_token: &str,
    expires_in: u64,
) -> Result<(), String> {
    let mut cache = state
        .access_tokens
        .lock()
        .map_err(|_| "cloud access token cache lock poisoned".to_string())?;
    cache.insert(
        format!("{}:{account_id}", provider_host(provider)),
        AccessTokenCacheEntry {
            access_token: access_token.to_string(),
            expires_at_ms: now_ms().saturating_add(expires_in.saturating_mul(1000)),
        },
    );
    Ok(())
}

async fn access_token_for_account(
    app: &AppHandle,
    state: &CloudRuntimeState,
    client: &Client,
    account: &PersistedCloudAccount,
) -> Result<String, String> {
    let cache_key = format!("{}:{}", provider_host(account.provider), account.id);
    {
        let cache = state
            .access_tokens
            .lock()
            .map_err(|_| "cloud access token cache lock poisoned".to_string())?;
        if let Some(entry) = cache.get(&cache_key) {
            if entry.expires_at_ms > now_ms().saturating_add(60_000) {
                return Ok(entry.access_token.clone());
            }
        }
    }
    let refresh_token = read_refresh_token(account.provider, &account.id)?;
    let config = provider_config(app, account.provider)?;
    let token = refresh_access_token(client, &config, &refresh_token).await?;
    store_access_token(
        state,
        account.provider,
        &account.id,
        &token.access_token,
        token.expires_in,
    )?;
    if token.refresh_token.is_some() {
        let _ = write_refresh_token(
            account.provider,
            &account.id,
            token.refresh_token.as_deref().unwrap_or_default(),
        );
    }
    Ok(token.access_token)
}

fn update_auth_callback(
    sessions: &Arc<Mutex<HashMap<String, PendingAuthSession>>>,
    request_id: &str,
    callback: AuthCallbackPayload,
) {
    if let Ok(mut lock) = sessions.lock() {
        if let Some(session) = lock.get_mut(request_id) {
            session.callback = Some(callback);
        }
    }
}

fn create_auth_callback_listener(
    provider: CloudProviderId,
) -> Result<AuthCallbackListener, String> {
    match provider {
        CloudProviderId::GoogleDrive => {
            let listener = TcpListener::bind("127.0.0.1:0")
                .map_err(|error| format!("Failed to create OAuth callback listener: {error}"))?;
            listener
                .set_nonblocking(true)
                .map_err(|error| format!("Failed to configure OAuth callback listener: {error}"))?;
            let port = listener
                .local_addr()
                .map_err(|error| format!("Failed to resolve OAuth callback port: {error}"))?
                .port();
            Ok(AuthCallbackListener {
                redirect_uri: format!("http://127.0.0.1:{port}/callback"),
                listeners: vec![listener],
            })
        }
        CloudProviderId::Dropbox => {
            let mut listeners = Vec::new();
            let mut binding_errors = Vec::new();
            for bind_address in [
                format!("127.0.0.1:{DROPBOX_OAUTH_CALLBACK_PORT}"),
                format!("[::1]:{DROPBOX_OAUTH_CALLBACK_PORT}"),
            ] {
                match TcpListener::bind(bind_address.as_str()) {
                    Ok(listener) => {
                        listener.set_nonblocking(true).map_err(|error| {
                            format!("Failed to configure Dropbox OAuth callback listener: {error}")
                        })?;
                        listeners.push(listener);
                    }
                    Err(error) => binding_errors.push(format!("{bind_address}: {error}")),
                }
            }
            if listeners.is_empty() {
                return Err(format!(
                    "Failed to create the Dropbox OAuth callback listener for {}. {}",
                    DROPBOX_OAUTH_CALLBACK_URI,
                    binding_errors.join(" | ")
                ));
            }
            Ok(AuthCallbackListener {
                redirect_uri: DROPBOX_OAUTH_CALLBACK_URI.to_string(),
                listeners,
            })
        }
    }
}

fn read_callback_payload(
    stream: &mut std::net::TcpStream,
    expected_state: &str,
) -> Result<AuthCallbackPayload, String> {
    let mut buffer = [0_u8; 8192];
    let count = stream
        .read(&mut buffer)
        .map_err(|error| format!("Failed to read OAuth callback request: {error}"))?;
    let request = String::from_utf8_lossy(&buffer[..count]);
    let request_line = request
        .lines()
        .next()
        .ok_or_else(|| "OAuth callback request was empty.".to_string())?;
    let path = request_line
        .split_whitespace()
        .nth(1)
        .ok_or_else(|| "OAuth callback request was malformed.".to_string())?;
    let url = Url::parse(&format!("http://127.0.0.1{path}"))
        .map_err(|error| format!("OAuth callback URL was malformed: {error}"))?;
    let query = url.query_pairs().collect::<HashMap<_, _>>();
    let callback_state = query
        .get("state")
        .map(|value| value.to_string())
        .ok_or_else(|| "OAuth callback did not include state.".to_string())?;
    if callback_state != expected_state {
        return Err("OAuth callback state did not match the pending login request.".to_string());
    }
    Ok(AuthCallbackPayload {
        code: query.get("code").map(|value| value.to_string()),
        error: query.get("error").map(|value| value.to_string()),
    })
}

fn write_callback_response(stream: &mut std::net::TcpStream, success: bool) -> Result<(), String> {
    let body = if success {
        "<html><body style=\"font-family: sans-serif; background: #0d1016; color: #e8eef8;\"><h3>Cloud account connected</h3><p>You can close this browser tab and return to GreebleFS.</p></body></html>"
    } else {
        "<html><body style=\"font-family: sans-serif; background: #0d1016; color: #fca5a5;\"><h3>Cloud sign-in failed</h3><p>Return to GreebleFS for details.</p></body></html>"
    };
    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        body.len(),
        body
    );
    stream
        .write_all(response.as_bytes())
        .map_err(|error| format!("Failed to write OAuth callback response: {error}"))
}

fn build_authorization_url(
    config: &ProviderConfig,
    redirect_uri: &str,
    state: &str,
    code_challenge: &str,
) -> Result<String, String> {
    let url = match config.provider {
        CloudProviderId::GoogleDrive => Url::parse_with_params(
            "https://accounts.google.com/o/oauth2/v2/auth",
            &[
                ("client_id", config.client_id.as_str()),
                ("redirect_uri", redirect_uri),
                ("response_type", "code"),
                (
                    "scope",
                    "openid email profile https://www.googleapis.com/auth/drive",
                ),
                ("access_type", "offline"),
                ("prompt", "consent"),
                ("code_challenge", code_challenge),
                ("code_challenge_method", "S256"),
                ("state", state),
            ],
        ),
        CloudProviderId::Dropbox => Url::parse_with_params(
            "https://www.dropbox.com/oauth2/authorize",
            &[
                ("client_id", config.client_id.as_str()),
                ("redirect_uri", redirect_uri),
                ("response_type", "code"),
                ("token_access_type", "offline"),
                (
                    "scope",
                    "account_info.read files.metadata.read files.content.read files.content.write",
                ),
                ("code_challenge", code_challenge),
                ("code_challenge_method", "S256"),
                ("state", state),
            ],
        ),
    }
    .map_err(|error| format!("Failed to build cloud authorization URL: {error}"))?;
    Ok(url.to_string())
}

async fn exchange_authorization_code(
    client: &Client,
    config: &ProviderConfig,
    redirect_uri: &str,
    code_verifier: &str,
    code: &str,
) -> Result<GoogleTokenResponse, String> {
    match config.provider {
        CloudProviderId::GoogleDrive => {
            let mut form = vec![
                ("client_id", config.client_id.as_str()),
                ("code", code),
                ("code_verifier", code_verifier),
                ("grant_type", "authorization_code"),
                ("redirect_uri", redirect_uri),
            ];
            if let Some(client_secret) = config.client_secret.as_deref() {
                form.push(("client_secret", client_secret));
            }
            client
                .post("https://oauth2.googleapis.com/token")
                .form(&form)
                .send()
                .await
                .map_err(|error| format!("Google Drive token exchange failed: {error}"))?
                .error_for_status()
                .map_err(|error| format!("Google Drive token exchange failed: {error}"))?
                .json::<GoogleTokenResponse>()
                .await
                .map_err(|error| format!("Failed to parse Google Drive token response: {error}"))
        }
        CloudProviderId::Dropbox => {
            let mut form = vec![
                ("client_id", config.client_id.as_str()),
                ("code", code),
                ("code_verifier", code_verifier),
                ("grant_type", "authorization_code"),
                ("redirect_uri", redirect_uri),
            ];
            if let Some(client_secret) = config.client_secret.as_deref() {
                form.push(("client_secret", client_secret));
            }
            let response = client
                .post("https://api.dropboxapi.com/oauth2/token")
                .form(&form)
                .send()
                .await
                .map_err(|error| format!("Dropbox token exchange failed: {error}"))?
                .error_for_status()
                .map_err(|error| format!("Dropbox token exchange failed: {error}"))?
                .json::<DropboxTokenResponse>()
                .await
                .map_err(|error| format!("Failed to parse Dropbox token response: {error}"))?;
            Ok(GoogleTokenResponse {
                access_token: response.access_token,
                expires_in: response.expires_in,
                refresh_token: response.refresh_token,
            })
        }
    }
}

async fn refresh_access_token(
    client: &Client,
    config: &ProviderConfig,
    refresh_token: &str,
) -> Result<GoogleTokenResponse, String> {
    match config.provider {
        CloudProviderId::GoogleDrive => {
            let mut form = vec![
                ("client_id", config.client_id.as_str()),
                ("refresh_token", refresh_token),
                ("grant_type", "refresh_token"),
            ];
            if let Some(client_secret) = config.client_secret.as_deref() {
                form.push(("client_secret", client_secret));
            }
            client
                .post("https://oauth2.googleapis.com/token")
                .form(&form)
                .send()
                .await
                .map_err(|error| format!("Google Drive access token refresh failed: {error}"))?
                .error_for_status()
                .map_err(|error| format!("Google Drive access token refresh failed: {error}"))?
                .json::<GoogleTokenResponse>()
                .await
                .map_err(|error| format!("Failed to parse Google Drive refresh response: {error}"))
        }
        CloudProviderId::Dropbox => {
            let mut form = vec![
                ("client_id", config.client_id.as_str()),
                ("refresh_token", refresh_token),
                ("grant_type", "refresh_token"),
            ];
            if let Some(client_secret) = config.client_secret.as_deref() {
                form.push(("client_secret", client_secret));
            }
            let response = client
                .post("https://api.dropboxapi.com/oauth2/token")
                .form(&form)
                .send()
                .await
                .map_err(|error| format!("Dropbox access token refresh failed: {error}"))?
                .error_for_status()
                .map_err(|error| format!("Dropbox access token refresh failed: {error}"))?
                .json::<DropboxTokenResponse>()
                .await
                .map_err(|error| format!("Failed to parse Dropbox refresh response: {error}"))?;
            Ok(GoogleTokenResponse {
                access_token: response.access_token,
                expires_in: response.expires_in,
                refresh_token: response.refresh_token,
            })
        }
    }
}

struct CloudProfile {
    provider: CloudProviderId,
    id: String,
    display_name: String,
    email: String,
    avatar_url: Option<String>,
    connected_at: u64,
    drive_label: String,
}

async fn fetch_account_profile(
    client: &Client,
    provider: CloudProviderId,
    access_token: &str,
) -> Result<CloudProfile, String> {
    match provider {
        CloudProviderId::GoogleDrive => {
            let user = client
                .get("https://openidconnect.googleapis.com/v1/userinfo")
                .bearer_auth(access_token)
                .send()
                .await
                .map_err(|error| format!("Google Drive account lookup failed: {error}"))?
                .error_for_status()
                .map_err(|error| format!("Google Drive account lookup failed: {error}"))?
                .json::<GoogleUserInfoResponse>()
                .await
                .map_err(|error| {
                    format!("Failed to parse Google Drive account response: {error}")
                })?;
            let email = user
                .email
                .clone()
                .filter(|value| !value.trim().is_empty())
                .ok_or_else(|| {
                    "Google Drive account response did not include an email.".to_string()
                })?;
            Ok(CloudProfile {
                provider,
                id: format!("google-drive:{}", slugify(&email)),
                display_name: user
                    .name
                    .clone()
                    .filter(|value| !value.trim().is_empty())
                    .unwrap_or_else(|| email.clone()),
                email: email.clone(),
                avatar_url: user.picture,
                connected_at: now_ms(),
                drive_label: format!("Google Drive · {email}"),
            })
        }
        CloudProviderId::Dropbox => {
            let user = client
                .post("https://api.dropboxapi.com/2/users/get_current_account")
                .bearer_auth(access_token)
                .json(&serde_json::json!({}))
                .send()
                .await
                .map_err(|error| format!("Dropbox account lookup failed: {error}"))?
                .error_for_status()
                .map_err(|error| format!("Dropbox account lookup failed: {error}"))?
                .json::<DropboxAccountResponse>()
                .await
                .map_err(|error| format!("Failed to parse Dropbox account response: {error}"))?;
            let email = user
                .email
                .clone()
                .filter(|value| !value.trim().is_empty())
                .ok_or_else(|| "Dropbox account response did not include an email.".to_string())?;
            Ok(CloudProfile {
                provider,
                id: format!("dropbox:{}", slugify(&email)),
                display_name: if user.name.display_name.trim().is_empty() {
                    email.clone()
                } else {
                    user.name.display_name
                },
                email: email.clone(),
                avatar_url: user.profile_photo_url,
                connected_at: now_ms(),
                drive_label: format!("Dropbox · {email}"),
            })
        }
    }
}

fn slugify(value: &str) -> String {
    value
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() {
                ch.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect::<String>()
        .trim_matches('-')
        .to_string()
}

async fn list_cloud_root_directory(
    app: &AppHandle,
    state: &CloudRuntimeState,
    client: &Client,
    provider: CloudProviderId,
    account_id: &str,
    account: &PersistedCloudAccount,
) -> Result<CloudDirectoryListing, String> {
    let access_token = access_token_for_account(app, state, client, account).await?;
    match provider {
        CloudProviderId::GoogleDrive => {
            let entries = google_list_children(client, &access_token, "root", account_id).await?;
            Ok(CloudDirectoryListing {
                path: build_cloud_root_path(provider, account_id),
                parent_path: None,
                breadcrumbs: vec![CloudBreadcrumb {
                    label: account.drive_label.clone(),
                    path: build_cloud_root_path(provider, account_id),
                }],
                entries,
            })
        }
        CloudProviderId::Dropbox => {
            let entries = dropbox_list_children(client, &access_token, "", account_id).await?;
            Ok(CloudDirectoryListing {
                path: build_cloud_root_path(provider, account_id),
                parent_path: None,
                breadcrumbs: vec![CloudBreadcrumb {
                    label: account.drive_label.clone(),
                    path: build_cloud_root_path(provider, account_id),
                }],
                entries,
            })
        }
    }
}

async fn list_cloud_item_directory(
    app: &AppHandle,
    state: &CloudRuntimeState,
    client: &Client,
    provider: CloudProviderId,
    account_id: &str,
    item_id: &str,
    account: &PersistedCloudAccount,
) -> Result<CloudDirectoryListing, String> {
    let access_token = access_token_for_account(app, state, client, account).await?;
    match provider {
        CloudProviderId::GoogleDrive => {
            let current = google_get_file_metadata(client, &access_token, item_id).await?;
            let parent_path = current
                .parents
                .as_ref()
                .and_then(|parents| parents.first())
                .map(|parent_id| {
                    if parent_id == "root" {
                        build_cloud_root_path(provider, account_id)
                    } else {
                        build_cloud_item_path(provider, account_id, parent_id)
                    }
                });
            let breadcrumbs =
                google_breadcrumbs(client, &access_token, account, account_id, item_id).await?;
            let entries = google_list_children(client, &access_token, item_id, account_id).await?;
            Ok(CloudDirectoryListing {
                path: build_cloud_item_path(provider, account_id, item_id),
                parent_path,
                breadcrumbs,
                entries,
            })
        }
        CloudProviderId::Dropbox => {
            let current_path = item_id;
            let parent_path = dropbox_parent_path(current_path).map(|parent| {
                if parent.is_empty() {
                    build_cloud_root_path(provider, account_id)
                } else {
                    build_cloud_item_path(provider, account_id, &parent)
                }
            });
            let breadcrumbs = dropbox_breadcrumbs(account, account_id, current_path);
            let entries =
                dropbox_list_children(client, &access_token, current_path, account_id).await?;
            Ok(CloudDirectoryListing {
                path: build_cloud_item_path(provider, account_id, item_id),
                parent_path,
                breadcrumbs,
                entries,
            })
        }
    }
}

async fn google_list_children(
    client: &Client,
    access_token: &str,
    parent_id: &str,
    account_id: &str,
) -> Result<Vec<FileEntry>, String> {
    let mut page_token: Option<String> = None;
    let mut files = Vec::new();
    loop {
        let mut url = Url::parse("https://www.googleapis.com/drive/v3/files")
            .map_err(|error| format!("Failed to build Google Drive list URL: {error}"))?;
        url.query_pairs_mut()
            .append_pair(
                "q",
                &format!("trashed = false and '{parent_id}' in parents"),
            )
            .append_pair(
                "fields",
                "nextPageToken,files(id,name,mimeType,size,modifiedTime,parents)",
            )
            .append_pair("pageSize", "500");
        if let Some(token) = page_token.as_deref() {
            url.query_pairs_mut().append_pair("pageToken", token);
        }
        let response = client
            .get(url)
            .bearer_auth(access_token)
            .send()
            .await
            .map_err(|error| format!("Google Drive folder listing failed: {error}"))?
            .error_for_status()
            .map_err(|error| format!("Google Drive folder listing failed: {error}"))?
            .json::<GoogleFileListResponse>()
            .await
            .map_err(|error| format!("Failed to parse Google Drive folder listing: {error}"))?;
        files.extend(response.files);
        if response.next_page_token.is_none() {
            break;
        }
        page_token = response.next_page_token;
    }
    let mut entries = files
        .into_iter()
        .map(|file| google_file_to_entry(account_id, file))
        .collect::<Vec<_>>();
    sort_entries(&mut entries);
    Ok(entries)
}

async fn google_get_file_metadata(
    client: &Client,
    access_token: &str,
    item_id: &str,
) -> Result<GoogleDriveFile, String> {
    client
        .get(format!(
            "https://www.googleapis.com/drive/v3/files/{item_id}"
        ))
        .bearer_auth(access_token)
        .query(&[("fields", "id,name,mimeType,size,modifiedTime,parents")])
        .send()
        .await
        .map_err(|error| format!("Google Drive metadata lookup failed: {error}"))?
        .error_for_status()
        .map_err(|error| format!("Google Drive metadata lookup failed: {error}"))?
        .json::<GoogleDriveFile>()
        .await
        .map_err(|error| format!("Failed to parse Google Drive metadata: {error}"))
}

fn google_file_to_entry(account_id: &str, file: GoogleDriveFile) -> FileEntry {
    let is_dir = file.mime_type == "application/vnd.google-apps.folder";
    let extension = if is_dir {
        String::new()
    } else {
        Path::new(&file.name)
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_string()
    };
    FileEntry {
        name: file.name.clone(),
        path: build_cloud_item_path(CloudProviderId::GoogleDrive, account_id, &file.id),
        is_dir,
        size: file
            .size
            .as_deref()
            .and_then(|value| value.parse::<u64>().ok())
            .unwrap_or(0),
        modified: parse_timestamp_ms(file.modified_time.as_deref()),
        extension,
        is_hidden: false,
        is_symlink: false,
    }
}

async fn google_breadcrumbs(
    client: &Client,
    access_token: &str,
    account: &PersistedCloudAccount,
    account_id: &str,
    current_item_id: &str,
) -> Result<Vec<CloudBreadcrumb>, String> {
    let mut crumbs = vec![CloudBreadcrumb {
        label: account.drive_label.clone(),
        path: build_cloud_root_path(CloudProviderId::GoogleDrive, account_id),
    }];
    let mut cursor = current_item_id.to_string();
    let mut stack = Vec::new();
    while cursor != "root" {
        let metadata = google_get_file_metadata(client, access_token, &cursor).await?;
        let path = build_cloud_item_path(CloudProviderId::GoogleDrive, account_id, &metadata.id);
        stack.push(CloudBreadcrumb {
            label: metadata.name.clone(),
            path,
        });
        let Some(parent) = metadata
            .parents
            .as_ref()
            .and_then(|parents| parents.first())
        else {
            break;
        };
        cursor = parent.clone();
    }
    stack.reverse();
    crumbs.extend(stack);
    Ok(crumbs)
}

async fn dropbox_list_children(
    client: &Client,
    access_token: &str,
    current_path: &str,
    account_id: &str,
) -> Result<Vec<FileEntry>, String> {
    let response = client
        .post("https://api.dropboxapi.com/2/files/list_folder")
        .bearer_auth(access_token)
        .json(&serde_json::json!({
            "path": current_path,
            "recursive": false,
            "include_deleted": false,
            "include_mounted_folders": true,
        }))
        .send()
        .await
        .map_err(|error| format!("Dropbox folder listing failed: {error}"))?
        .error_for_status()
        .map_err(|error| format!("Dropbox folder listing failed: {error}"))?
        .json::<DropboxListFolderResponse>()
        .await
        .map_err(|error| format!("Failed to parse Dropbox folder listing: {error}"))?;
    let mut entries = response
        .entries
        .into_iter()
        .filter_map(|entry| dropbox_entry_to_file_entry(account_id, entry))
        .collect::<Vec<_>>();
    sort_entries(&mut entries);
    Ok(entries)
}

fn dropbox_entry_to_file_entry(account_id: &str, entry: DropboxMetadataEntry) -> Option<FileEntry> {
    let item_path = entry.path_display.or(entry.path_lower)?;
    let is_dir = entry.tag == "folder";
    let extension = if is_dir {
        String::new()
    } else {
        Path::new(&entry.name)
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_string()
    };
    Some(FileEntry {
        name: entry.name.clone(),
        path: build_cloud_item_path(CloudProviderId::Dropbox, account_id, &item_path),
        is_dir,
        size: entry.size.unwrap_or(0),
        modified: parse_timestamp_ms(entry.server_modified.as_deref()),
        extension,
        is_hidden: entry.name.starts_with('.'),
        is_symlink: false,
    })
}

fn dropbox_breadcrumbs(
    account: &PersistedCloudAccount,
    account_id: &str,
    current_path: &str,
) -> Vec<CloudBreadcrumb> {
    let mut crumbs = vec![CloudBreadcrumb {
        label: account.drive_label.clone(),
        path: build_cloud_root_path(CloudProviderId::Dropbox, account_id),
    }];
    let mut prefix = String::new();
    for segment in current_path.split('/').filter(|value| !value.is_empty()) {
        prefix.push('/');
        prefix.push_str(segment);
        crumbs.push(CloudBreadcrumb {
            label: segment.to_string(),
            path: build_cloud_item_path(CloudProviderId::Dropbox, account_id, &prefix),
        });
    }
    crumbs
}

fn dropbox_parent_path(path: &str) -> Option<String> {
    let normalized = path.trim_end_matches('/');
    if normalized.is_empty() {
        return None;
    }
    let mut parts = normalized.rsplitn(2, '/');
    let _ = parts.next();
    let parent = parts.next().unwrap_or_default();
    if parent.is_empty() {
        Some(String::new())
    } else {
        Some(parent.to_string())
    }
}

async fn download_cloud_file(
    app: &AppHandle,
    state: &CloudRuntimeState,
    path: &str,
) -> Result<CloudFilePayload, String> {
    let parsed = parse_cloud_path(path)?;
    let item_id = parsed
        .item_id()
        .ok_or_else(|| "Cloud drive roots cannot be downloaded.".to_string())?;
    let account = load_account(app, parsed.account_id())?;
    let client = cloud_http_client()?;
    let access_token = access_token_for_account(app, state, &client, &account).await?;
    match parsed.provider() {
        CloudProviderId::GoogleDrive => {
            let metadata = google_get_file_metadata(&client, &access_token, item_id).await?;
            if metadata.mime_type == "application/vnd.google-apps.folder" {
                return Err("Folders cannot be downloaded as files.".to_string());
            }
            if metadata
                .mime_type
                .starts_with("application/vnd.google-apps.")
            {
                return Err(
                    "Google-native Docs/Sheets/Slides export is not implemented yet.".to_string(),
                );
            }
            let bytes = client
                .get(format!(
                    "https://www.googleapis.com/drive/v3/files/{item_id}?alt=media"
                ))
                .bearer_auth(access_token)
                .send()
                .await
                .map_err(|error| format!("Google Drive download failed: {error}"))?
                .error_for_status()
                .map_err(|error| format!("Google Drive download failed: {error}"))?
                .bytes()
                .await
                .map_err(|error| format!("Failed to read Google Drive download payload: {error}"))?
                .to_vec();
            Ok(CloudFilePayload {
                bytes,
                name: metadata.name,
            })
        }
        CloudProviderId::Dropbox => {
            let response = client
                .post("https://content.dropboxapi.com/2/files/download")
                .bearer_auth(access_token)
                .header(
                    "Dropbox-API-Arg",
                    serde_json::json!({ "path": item_id }).to_string(),
                )
                .send()
                .await
                .map_err(|error| format!("Dropbox download failed: {error}"))?
                .error_for_status()
                .map_err(|error| format!("Dropbox download failed: {error}"))?;
            let bytes = response
                .bytes()
                .await
                .map_err(|error| format!("Failed to read Dropbox download payload: {error}"))?
                .to_vec();
            let name = Path::new(item_id)
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("download")
                .to_string();
            Ok(CloudFilePayload { bytes, name })
        }
    }
}

async fn cloud_download_to_temp(
    app: &AppHandle,
    state: &CloudRuntimeState,
    path: &str,
) -> Result<String, String> {
    let payload = download_cloud_file(app, state, path).await?;
    let temp_root = temp_root_path(app)?;
    let file_name = format!("{}-{}", Uuid::new_v4(), payload.name);
    let destination = temp_root.join(file_name);
    fs::write(&destination, &payload.bytes)
        .map_err(|error| format!("Failed to write cloud temp file: {error}"))?;
    Ok(destination.to_string_lossy().to_string())
}

async fn overwrite_cloud_file(
    client: &Client,
    provider: CloudProviderId,
    access_token: &str,
    item_id: &str,
    bytes: Vec<u8>,
) -> Result<(), String> {
    match provider {
        CloudProviderId::GoogleDrive => {
            client
                .patch(format!(
                    "https://www.googleapis.com/upload/drive/v3/files/{item_id}?uploadType=media"
                ))
                .bearer_auth(access_token)
                .header("Content-Type", "application/octet-stream")
                .body(bytes)
                .send()
                .await
                .map_err(|error| format!("Google Drive file overwrite failed: {error}"))?
                .error_for_status()
                .map_err(|error| format!("Google Drive file overwrite failed: {error}"))?;
            Ok(())
        }
        CloudProviderId::Dropbox => {
            client
                .post("https://content.dropboxapi.com/2/files/upload")
                .bearer_auth(access_token)
                .header(
                    "Dropbox-API-Arg",
                    serde_json::json!({
                        "path": item_id,
                        "mode": "overwrite",
                        "autorename": false,
                    })
                    .to_string(),
                )
                .header("Content-Type", "application/octet-stream")
                .body(bytes)
                .send()
                .await
                .map_err(|error| format!("Dropbox file overwrite failed: {error}"))?
                .error_for_status()
                .map_err(|error| format!("Dropbox file overwrite failed: {error}"))?;
            Ok(())
        }
    }
}

async fn create_cloud_file(
    client: &Client,
    parent: &CloudPathRef,
    access_token: &str,
    name: &str,
    bytes: Vec<u8>,
) -> Result<(), String> {
    match parent.provider() {
        CloudProviderId::GoogleDrive => {
            let parent_id = parent.item_id().unwrap_or("root");
            let metadata = serde_json::json!({
                "name": name,
                "parents": [parent_id],
            });
            let metadata_part = Part::text(metadata.to_string())
                .mime_str("application/json")
                .map_err(|error| {
                    format!("Failed to build Google Drive upload metadata: {error}")
                })?;
            let media_part = Part::bytes(bytes).file_name(name.to_string());
            client
                .post("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart")
                .bearer_auth(access_token)
                .multipart(
                    Form::new()
                        .part("metadata", metadata_part)
                        .part("file", media_part),
                )
                .send()
                .await
                .map_err(|error| format!("Google Drive file creation failed: {error}"))?
                .error_for_status()
                .map_err(|error| format!("Google Drive file creation failed: {error}"))?;
            Ok(())
        }
        CloudProviderId::Dropbox => {
            let parent_path = parent.item_id().unwrap_or("");
            let remote_path = if parent_path.is_empty() {
                format!("/{name}")
            } else {
                format!("{}/{}", parent_path.trim_end_matches('/'), name)
            };
            client
                .post("https://content.dropboxapi.com/2/files/upload")
                .bearer_auth(access_token)
                .header(
                    "Dropbox-API-Arg",
                    serde_json::json!({
                        "path": remote_path,
                        "mode": "add",
                        "autorename": true,
                    })
                    .to_string(),
                )
                .header("Content-Type", "application/octet-stream")
                .body(bytes)
                .send()
                .await
                .map_err(|error| format!("Dropbox file creation failed: {error}"))?
                .error_for_status()
                .map_err(|error| format!("Dropbox file creation failed: {error}"))?;
            Ok(())
        }
    }
}

async fn create_cloud_directory_impl(
    client: &Client,
    parent: &CloudPathRef,
    access_token: &str,
    name: &str,
) -> Result<(), String> {
    match parent.provider() {
        CloudProviderId::GoogleDrive => {
            let parent_id = parent.item_id().unwrap_or("root");
            client
                .post("https://www.googleapis.com/drive/v3/files")
                .bearer_auth(access_token)
                .json(&serde_json::json!({
                    "name": name,
                    "mimeType": "application/vnd.google-apps.folder",
                    "parents": [parent_id],
                }))
                .send()
                .await
                .map_err(|error| format!("Google Drive folder creation failed: {error}"))?
                .error_for_status()
                .map_err(|error| format!("Google Drive folder creation failed: {error}"))?;
            Ok(())
        }
        CloudProviderId::Dropbox => {
            let parent_path = parent.item_id().unwrap_or("");
            let remote_path = if parent_path.is_empty() {
                format!("/{name}")
            } else {
                format!("{}/{}", parent_path.trim_end_matches('/'), name)
            };
            client
                .post("https://api.dropboxapi.com/2/files/create_folder_v2")
                .bearer_auth(access_token)
                .json(&serde_json::json!({
                    "path": remote_path,
                    "autorename": false,
                }))
                .send()
                .await
                .map_err(|error| format!("Dropbox folder creation failed: {error}"))?
                .error_for_status()
                .map_err(|error| format!("Dropbox folder creation failed: {error}"))?;
            Ok(())
        }
    }
}

async fn rename_cloud_path_impl(
    client: &Client,
    path: &CloudPathRef,
    access_token: &str,
    new_name: &str,
) -> Result<(), String> {
    match path.provider() {
        CloudProviderId::GoogleDrive => {
            let item_id = path
                .item_id()
                .ok_or_else(|| "Cloud drive roots cannot be renamed.".to_string())?;
            client
                .patch(format!(
                    "https://www.googleapis.com/drive/v3/files/{item_id}"
                ))
                .bearer_auth(access_token)
                .json(&serde_json::json!({ "name": new_name }))
                .send()
                .await
                .map_err(|error| format!("Google Drive rename failed: {error}"))?
                .error_for_status()
                .map_err(|error| format!("Google Drive rename failed: {error}"))?;
            Ok(())
        }
        CloudProviderId::Dropbox => {
            let item_id = path
                .item_id()
                .ok_or_else(|| "Cloud drive roots cannot be renamed.".to_string())?;
            let parent = dropbox_parent_path(item_id).unwrap_or_default();
            let new_path = if parent.is_empty() {
                format!("/{new_name}")
            } else {
                format!("{}/{}", parent.trim_end_matches('/'), new_name)
            };
            client
                .post("https://api.dropboxapi.com/2/files/move_v2")
                .bearer_auth(access_token)
                .json(&serde_json::json!({
                    "from_path": item_id,
                    "to_path": new_path,
                    "autorename": false,
                    "allow_ownership_transfer": false,
                }))
                .send()
                .await
                .map_err(|error| format!("Dropbox rename failed: {error}"))?
                .error_for_status()
                .map_err(|error| format!("Dropbox rename failed: {error}"))?;
            Ok(())
        }
    }
}

async fn delete_cloud_path_impl(
    client: &Client,
    path: &CloudPathRef,
    access_token: &str,
) -> Result<(), String> {
    match path.provider() {
        CloudProviderId::GoogleDrive => {
            let item_id = path
                .item_id()
                .ok_or_else(|| "Cloud drive roots cannot be deleted.".to_string())?;
            client
                .delete(format!(
                    "https://www.googleapis.com/drive/v3/files/{item_id}"
                ))
                .bearer_auth(access_token)
                .send()
                .await
                .map_err(|error| format!("Google Drive delete failed: {error}"))?
                .error_for_status()
                .map_err(|error| format!("Google Drive delete failed: {error}"))?;
            Ok(())
        }
        CloudProviderId::Dropbox => {
            let item_id = path
                .item_id()
                .ok_or_else(|| "Cloud drive roots cannot be deleted.".to_string())?;
            client
                .post("https://api.dropboxapi.com/2/files/delete_v2")
                .bearer_auth(access_token)
                .json(&serde_json::json!({ "path": item_id }))
                .send()
                .await
                .map_err(|error| format!("Dropbox delete failed: {error}"))?
                .error_for_status()
                .map_err(|error| format!("Dropbox delete failed: {error}"))?;
            Ok(())
        }
    }
}

async fn transfer_between_local_and_cloud(
    app: &AppHandle,
    state: &CloudRuntimeState,
    client: &Client,
    target_dir: &str,
    source: &str,
    operation: FileTransferOperation,
) -> Result<(), String> {
    let source_is_cloud = source.starts_with("cloud://");
    let target_is_cloud = target_dir.starts_with("cloud://");
    match (source_is_cloud, target_is_cloud) {
        (true, true) => {
            transfer_cloud_to_cloud(app, state, client, source, target_dir, operation).await
        }
        (true, false) => {
            transfer_cloud_to_local(app, state, client, source, target_dir, operation).await
        }
        (false, true) => {
            transfer_local_to_cloud(app, state, client, source, target_dir, operation).await
        }
        (false, false) => Ok(()),
    }
}

async fn transfer_local_to_cloud(
    app: &AppHandle,
    state: &CloudRuntimeState,
    client: &Client,
    source: &str,
    target_dir: &str,
    operation: FileTransferOperation,
) -> Result<(), String> {
    let target = parse_cloud_path(target_dir)?;
    let account = load_account(app, target.account_id())?;
    let access_token = access_token_for_account(app, state, client, &account).await?;
    let source_path = PathBuf::from(source);
    upload_local_path(client, &target, &access_token, &source_path).await?;
    if operation == FileTransferOperation::Move {
        remove_local_path(&source_path)?;
    }
    Ok(())
}

async fn transfer_cloud_to_local(
    app: &AppHandle,
    state: &CloudRuntimeState,
    client: &Client,
    source: &str,
    target_dir: &str,
    operation: FileTransferOperation,
) -> Result<(), String> {
    let source_ref = parse_cloud_path(source)?;
    let item_id = source_ref
        .item_id()
        .ok_or_else(|| "Cloud drive roots cannot be downloaded.".to_string())?;
    let account = load_account(app, source_ref.account_id())?;
    let access_token = access_token_for_account(app, state, client, &account).await?;
    let target_root = PathBuf::from(target_dir);
    if source_ref.provider() == CloudProviderId::GoogleDrive {
        let metadata = google_get_file_metadata(client, &access_token, item_id).await?;
        download_google_item_to_local(
            client,
            &access_token,
            &metadata,
            source_ref.account_id(),
            &target_root,
        )
        .await?;
    } else {
        download_dropbox_item_to_local(client, &access_token, item_id, &target_root).await?;
    }
    if operation == FileTransferOperation::Move {
        delete_cloud_path_impl(client, &source_ref, &access_token).await?;
    }
    Ok(())
}

async fn transfer_cloud_to_cloud(
    app: &AppHandle,
    state: &CloudRuntimeState,
    client: &Client,
    source: &str,
    target_dir: &str,
    operation: FileTransferOperation,
) -> Result<(), String> {
    let source_ref = parse_cloud_path(source)?;
    let target_ref = parse_cloud_path(target_dir)?;
    if source_ref.provider() != target_ref.provider()
        || source_ref.account_id() != target_ref.account_id()
    {
        let temp_dir = temp_root_path(app)?.join(Uuid::new_v4().to_string());
        fs::create_dir_all(&temp_dir)
            .map_err(|error| format!("Failed to create temp cloud transfer directory: {error}"))?;
        transfer_cloud_to_local(
            app,
            state,
            client,
            source,
            temp_dir.to_string_lossy().as_ref(),
            FileTransferOperation::Copy,
        )
        .await?;
        let source_name = Path::new(source)
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("transfer");
        transfer_local_to_cloud(
            app,
            state,
            client,
            temp_dir.join(source_name).to_string_lossy().as_ref(),
            target_dir,
            FileTransferOperation::Copy,
        )
        .await?;
        if operation == FileTransferOperation::Move {
            let account = load_account(app, source_ref.account_id())?;
            let access_token = access_token_for_account(app, state, client, &account).await?;
            delete_cloud_path_impl(client, &source_ref, &access_token).await?;
        }
        return Ok(());
    }
    let account = load_account(app, source_ref.account_id())?;
    let access_token = access_token_for_account(app, state, client, &account).await?;
    match source_ref.provider() {
        CloudProviderId::Dropbox => {
            let from_path = source_ref
                .item_id()
                .ok_or_else(|| "Cloud drive roots cannot be transferred.".to_string())?;
            let target_path = target_ref.item_id().unwrap_or("");
            let name = Path::new(from_path)
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("item");
            let destination = if target_path.is_empty() {
                format!("/{name}")
            } else {
                format!("{}/{}", target_path.trim_end_matches('/'), name)
            };
            let endpoint = if operation == FileTransferOperation::Move {
                "https://api.dropboxapi.com/2/files/move_v2"
            } else {
                "https://api.dropboxapi.com/2/files/copy_v2"
            };
            client
                .post(endpoint)
                .bearer_auth(access_token)
                .json(&serde_json::json!({
                    "from_path": from_path,
                    "to_path": destination,
                    "autorename": operation == FileTransferOperation::Copy,
                    "allow_shared_folder": true,
                    "allow_ownership_transfer": false,
                }))
                .send()
                .await
                .map_err(|error| format!("Dropbox cloud transfer failed: {error}"))?
                .error_for_status()
                .map_err(|error| format!("Dropbox cloud transfer failed: {error}"))?;
            Ok(())
        }
        CloudProviderId::GoogleDrive => {
            let source_item_id = source_ref
                .item_id()
                .ok_or_else(|| "Cloud drive roots cannot be transferred.".to_string())?;
            let target_parent_id = target_ref.item_id().unwrap_or("root");
            let metadata = google_get_file_metadata(client, &access_token, source_item_id).await?;
            if operation == FileTransferOperation::Copy {
                if metadata.mime_type == "application/vnd.google-apps.folder" {
                    return Err(
                        "Google Drive folder duplication is not implemented yet.".to_string()
                    );
                }
                client
                    .post(format!(
                        "https://www.googleapis.com/drive/v3/files/{source_item_id}/copy"
                    ))
                    .bearer_auth(access_token)
                    .json(&serde_json::json!({
                        "name": metadata.name,
                        "parents": [target_parent_id],
                    }))
                    .send()
                    .await
                    .map_err(|error| format!("Google Drive cloud copy failed: {error}"))?
                    .error_for_status()
                    .map_err(|error| format!("Google Drive cloud copy failed: {error}"))?;
            } else {
                let remove_parents = metadata.parents.unwrap_or_default().join(",");
                client
                    .patch(format!(
                        "https://www.googleapis.com/drive/v3/files/{source_item_id}"
                    ))
                    .bearer_auth(access_token)
                    .query(&[
                        ("addParents", target_parent_id),
                        ("removeParents", remove_parents.as_str()),
                    ])
                    .send()
                    .await
                    .map_err(|error| format!("Google Drive cloud move failed: {error}"))?
                    .error_for_status()
                    .map_err(|error| format!("Google Drive cloud move failed: {error}"))?;
            }
            Ok(())
        }
    }
}

#[async_recursion]
async fn upload_local_path(
    client: &Client,
    target: &CloudPathRef,
    access_token: &str,
    source_path: &Path,
) -> Result<(), String> {
    let metadata = fs::metadata(source_path)
        .map_err(|error| format!("Failed to inspect local source path: {error}"))?;
    if metadata.is_dir() {
        let folder_name = source_path
            .file_name()
            .and_then(|value| value.to_str())
            .ok_or_else(|| "Local folder is missing a valid name.".to_string())?;
        create_cloud_directory_impl(client, target, access_token, folder_name).await?;
        let next_target = match target.provider() {
            CloudProviderId::GoogleDrive => {
                let created = find_child_by_name(client, target, access_token, folder_name).await?;
                CloudPathRef::Item {
                    provider: target.provider(),
                    account_id: target.account_id().to_string(),
                    item_id: created,
                }
            }
            CloudProviderId::Dropbox => {
                let parent_path = target.item_id().unwrap_or("");
                CloudPathRef::Item {
                    provider: target.provider(),
                    account_id: target.account_id().to_string(),
                    item_id: if parent_path.is_empty() {
                        format!("/{folder_name}")
                    } else {
                        format!("{}/{}", parent_path.trim_end_matches('/'), folder_name)
                    },
                }
            }
        };
        for child in fs::read_dir(source_path)
            .map_err(|error| format!("Failed to enumerate local folder for upload: {error}"))?
        {
            let child =
                child.map_err(|error| format!("Failed to read local folder entry: {error}"))?;
            upload_local_path(client, &next_target, access_token, &child.path()).await?;
        }
        Ok(())
    } else {
        let name = source_path
            .file_name()
            .and_then(|value| value.to_str())
            .ok_or_else(|| "Local file is missing a valid name.".to_string())?;
        let bytes = fs::read(source_path)
            .map_err(|error| format!("Failed to read local file for upload: {error}"))?;
        create_cloud_file(client, target, access_token, name, bytes).await
    }
}

async fn find_child_by_name(
    client: &Client,
    parent: &CloudPathRef,
    access_token: &str,
    child_name: &str,
) -> Result<String, String> {
    match parent.provider() {
        CloudProviderId::GoogleDrive => {
            let parent_id = parent.item_id().unwrap_or("root");
            let query = vec![
                (
                    "q",
                    format!(
                        "trashed = false and '{parent_id}' in parents and name = '{child_name}'"
                    ),
                ),
                ("fields", "files(id,name)".to_string()),
                ("pageSize", "100".to_string()),
            ];
            let url = Url::parse_with_params("https://www.googleapis.com/drive/v3/files", &query)
                .map_err(|error| {
                format!("Failed to build Google Drive child lookup URL: {error}")
            })?;
            let response = client
                .get(url)
                .bearer_auth(access_token)
                .send()
                .await
                .map_err(|error| format!("Google Drive child lookup failed: {error}"))?
                .error_for_status()
                .map_err(|error| format!("Google Drive child lookup failed: {error}"))?
                .json::<GoogleFileListResponse>()
                .await
                .map_err(|error| format!("Failed to parse Google Drive child lookup: {error}"))?;
            response
                .files
                .into_iter()
                .find(|file| file.name == child_name)
                .map(|file| file.id)
                .ok_or_else(|| {
                    "Created Google Drive child folder could not be reloaded.".to_string()
                })
        }
        CloudProviderId::Dropbox => Err("Dropbox child lookup is not required.".to_string()),
    }
}

#[async_recursion]
async fn download_google_item_to_local(
    client: &Client,
    access_token: &str,
    metadata: &GoogleDriveFile,
    account_id: &str,
    destination_root: &Path,
) -> Result<(), String> {
    let destination = destination_root.join(&metadata.name);
    if metadata.mime_type == "application/vnd.google-apps.folder" {
        fs::create_dir_all(&destination).map_err(|error| {
            format!("Failed to create local folder from Google Drive item: {error}")
        })?;
        let children = google_list_children(client, access_token, &metadata.id, account_id).await?;
        for child in children {
            let child_ref = parse_cloud_path(&child.path)?;
            let child_item_id = child_ref
                .item_id()
                .ok_or_else(|| "Google Drive child item is missing an identifier.".to_string())?;
            let child_metadata =
                google_get_file_metadata(client, access_token, child_item_id).await;
            if let Ok(child_metadata) = child_metadata {
                download_google_item_to_local(
                    client,
                    access_token,
                    &child_metadata,
                    account_id,
                    &destination,
                )
                .await?;
            }
        }
        Ok(())
    } else {
        let bytes = client
            .get(format!(
                "https://www.googleapis.com/drive/v3/files/{}?alt=media",
                metadata.id
            ))
            .bearer_auth(access_token)
            .send()
            .await
            .map_err(|error| format!("Google Drive download failed: {error}"))?
            .error_for_status()
            .map_err(|error| format!("Google Drive download failed: {error}"))?
            .bytes()
            .await
            .map_err(|error| format!("Failed to read Google Drive download payload: {error}"))?;
        fs::write(destination, bytes)
            .map_err(|error| format!("Failed to write local Google Drive download: {error}"))
    }
}

#[async_recursion]
async fn download_dropbox_item_to_local(
    client: &Client,
    access_token: &str,
    item_path: &str,
    destination_root: &Path,
) -> Result<(), String> {
    let metadata = client
        .post("https://api.dropboxapi.com/2/files/get_metadata")
        .bearer_auth(access_token)
        .json(&serde_json::json!({ "path": item_path }))
        .send()
        .await
        .map_err(|error| format!("Dropbox metadata lookup failed: {error}"))?
        .error_for_status()
        .map_err(|error| format!("Dropbox metadata lookup failed: {error}"))?
        .json::<DropboxMetadataEntry>()
        .await
        .map_err(|error| format!("Failed to parse Dropbox metadata response: {error}"))?;
    let destination = destination_root.join(&metadata.name);
    if metadata.tag == "folder" {
        fs::create_dir_all(&destination)
            .map_err(|error| format!("Failed to create local Dropbox folder: {error}"))?;
        let children = dropbox_list_children(client, access_token, item_path, "local-copy").await?;
        for child in children {
            let parsed = parse_cloud_path(&child.path)?;
            if let Some(child_item_id) = parsed.item_id() {
                download_dropbox_item_to_local(client, access_token, child_item_id, &destination)
                    .await?;
            }
        }
        Ok(())
    } else {
        let bytes = client
            .post("https://content.dropboxapi.com/2/files/download")
            .bearer_auth(access_token)
            .header(
                "Dropbox-API-Arg",
                serde_json::json!({ "path": item_path }).to_string(),
            )
            .send()
            .await
            .map_err(|error| format!("Dropbox download failed: {error}"))?
            .error_for_status()
            .map_err(|error| format!("Dropbox download failed: {error}"))?
            .bytes()
            .await
            .map_err(|error| format!("Failed to read Dropbox download payload: {error}"))?;
        fs::write(destination, bytes)
            .map_err(|error| format!("Failed to write local Dropbox download: {error}"))
    }
}

fn remove_local_path(path: &Path) -> Result<(), String> {
    let metadata = fs::metadata(path)
        .map_err(|error| format!("Failed to inspect local path for removal: {error}"))?;
    if metadata.is_dir() {
        fs::remove_dir_all(path)
            .map_err(|error| format!("Failed to remove local directory after transfer: {error}"))
    } else {
        fs::remove_file(path)
            .map_err(|error| format!("Failed to remove local file after transfer: {error}"))
    }
}

fn sort_entries(entries: &mut [FileEntry]) {
    entries.sort_by(|left, right| match (left.is_dir, right.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => left.name.to_lowercase().cmp(&right.name.to_lowercase()),
    });
}

fn parse_timestamp_ms(value: Option<&str>) -> u64 {
    value
        .and_then(|raw| DateTime::parse_from_rfc3339(raw).ok())
        .map(|date| date.with_timezone(&Utc).timestamp_millis())
        .unwrap_or_default()
        .max(0) as u64
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_millis() as u64)
        .unwrap_or_default()
}

fn mime_from_extension(extension: &str) -> &'static str {
    match extension.to_ascii_lowercase().as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        "ico" => "image/x-icon",
        "svg" => "image/svg+xml",
        "tiff" | "tif" => "image/tiff",
        "avif" => "image/avif",
        "glb" => "model/gltf-binary",
        "gltf" => "model/gltf+json",
        "obj" => "text/plain",
        "stl" => "model/stl",
        _ => "application/octet-stream",
    }
}
