use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine as _;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri::Manager;
use tokio::sync::Mutex;
use url::Url;
use web_push::{
    ContentEncoding, IsahcWebPushClient, SubscriptionInfo, Urgency, VapidSignatureBuilder,
    WebPushMessageBuilder, WebPushClient,
};

use super::types::ACTIVE_SERVER;

const MOBILE_PUSH_STATE_VERSION: u32 = 1;
const MOBILE_PUSH_DIRECTORY_NAME: &str = "mobile-push";
const MOBILE_PUSH_REGISTRY_FILE_NAME: &str = "registry.json";
const MOBILE_PUSH_DEFAULT_CONTACT_CLAIM: &str = "mailto:mobile@greeblefs.local";

#[derive(Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct MobilePushSubscriptionKeysInput {
    pub p256dh: String,
    pub auth: String,
}

#[derive(Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct MobilePushSubscriptionInput {
    pub endpoint: String,
    pub keys: MobilePushSubscriptionKeysInput,
    pub expiration_time: Option<i64>,
    pub device_label: Option<String>,
    pub user_agent: Option<String>,
    pub standalone: bool,
}

#[derive(Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct MobilePushSubscriptionRemovalRequest {
    pub endpoint: String,
}

#[derive(Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct MobilePushPairedDeviceSummary {
    pub endpoint: String,
    pub device_label: String,
    pub user_agent: Option<String>,
    pub standalone: bool,
    pub updated_at_ms: u64,
}

#[derive(Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct MobilePushConfigResponse {
    pub supported: bool,
    pub vapid_public_key: String,
    pub subscription_count: usize,
    pub paired_devices: Vec<MobilePushPairedDeviceSummary>,
}

#[derive(Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct MobilePushDispatchResult {
    pub delivered_count: usize,
    pub failed_count: usize,
    pub subscription_count: usize,
}

#[derive(Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct MobilePushDownloadNotificationRequest {
    pub absolute_path: String,
    pub share_url: String,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredMobilePushSubscription {
    endpoint: String,
    p256dh: String,
    auth: String,
    expiration_time: Option<i64>,
    device_label: String,
    user_agent: Option<String>,
    standalone: bool,
    created_at_ms: u64,
    updated_at_ms: u64,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredMobilePushState {
    version: u32,
    private_key_base64url: String,
    subscriptions: Vec<StoredMobilePushSubscription>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MobilePushNotificationEnvelope {
    title: String,
    body: String,
    tag: String,
    require_interaction: bool,
    badge_count: Option<u32>,
    data: MobilePushNotificationData,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MobilePushNotificationData {
    url: String,
    relative_path: String,
    parent_path: String,
    display_name: String,
    kind: String,
}

static ACTIVE_MOBILE_PUSH_STATE: once_cell::sync::Lazy<Arc<Mutex<Option<StoredMobilePushState>>>> =
    once_cell::sync::Lazy::new(|| Arc::new(Mutex::new(None)));

fn now_epoch_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

fn normalize_mobile_push_endpoint(value: &str) -> Result<String, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err("Push subscription endpoint is missing.".to_string());
    }

    let parsed = Url::parse(trimmed)
        .map_err(|error| format!("Invalid push subscription endpoint: {error}"))?;
    match parsed.scheme() {
        "https" => Ok(parsed.to_string()),
        _ => Err("Push subscription endpoint must use HTTPS.".to_string()),
    }
}

fn normalize_mobile_push_key(value: &str, label: &str) -> Result<String, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(format!("Push subscription {label} key is missing."));
    }
    Ok(trimmed.to_string())
}

fn normalize_mobile_push_device_label(value: Option<&str>) -> String {
    let trimmed = value.unwrap_or_default().trim();
    if trimmed.is_empty() {
        "Paired iPhone".to_string()
    } else {
        trimmed.to_string()
    }
}

fn build_mobile_push_state_directory(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))?;
    Ok(app_data_dir.join(MOBILE_PUSH_DIRECTORY_NAME))
}

fn build_mobile_push_state_path(app_handle: &AppHandle) -> Result<PathBuf, String> {
    Ok(build_mobile_push_state_directory(app_handle)?.join(MOBILE_PUSH_REGISTRY_FILE_NAME))
}

fn generate_mobile_push_private_key_base64url() -> String {
    let secret_key = p256::SecretKey::random(&mut rand::rngs::OsRng);
    URL_SAFE_NO_PAD.encode(secret_key.to_bytes())
}

fn create_mobile_push_partial_signature_builder(
    private_key_base64url: &str,
) -> Result<web_push::PartialVapidSignatureBuilder, String> {
    VapidSignatureBuilder::from_base64_no_sub(private_key_base64url)
        .map_err(|error| format!("Failed to initialize the mobile push VAPID signer: {error}"))
}

fn create_mobile_push_public_key(private_key_base64url: &str) -> Result<String, String> {
    let builder = create_mobile_push_partial_signature_builder(private_key_base64url)?;
    Ok(URL_SAFE_NO_PAD.encode(builder.get_public_key()))
}

fn persist_mobile_push_state(
    app_handle: &AppHandle,
    state: &StoredMobilePushState,
) -> Result<(), String> {
    let state_directory = build_mobile_push_state_directory(app_handle)?;
    fs::create_dir_all(&state_directory)
        .map_err(|error| format!("Failed to create the mobile push data directory: {error}"))?;
    let state_path = state_directory.join(MOBILE_PUSH_REGISTRY_FILE_NAME);
    let serialized = serde_json::to_vec_pretty(state)
        .map_err(|error| format!("Failed to encode the mobile push registry: {error}"))?;
    fs::write(&state_path, serialized)
        .map_err(|error| format!("Failed to write the mobile push registry: {error}"))
}

fn load_mobile_push_state_from_disk(app_handle: &AppHandle) -> Result<StoredMobilePushState, String> {
    let state_path = build_mobile_push_state_path(app_handle)?;
    if !state_path.exists() {
        let state = StoredMobilePushState {
            version: MOBILE_PUSH_STATE_VERSION,
            private_key_base64url: generate_mobile_push_private_key_base64url(),
            subscriptions: Vec::new(),
        };
        persist_mobile_push_state(app_handle, &state)?;
        return Ok(state);
    }

    let bytes = fs::read(&state_path)
        .map_err(|error| format!("Failed to read the mobile push registry: {error}"))?;
    let mut state: StoredMobilePushState = serde_json::from_slice(&bytes)
        .map_err(|error| format!("Failed to decode the mobile push registry: {error}"))?;

    if state.private_key_base64url.trim().is_empty() {
        state.private_key_base64url = generate_mobile_push_private_key_base64url();
    }
    if state.version != MOBILE_PUSH_STATE_VERSION {
        state.version = MOBILE_PUSH_STATE_VERSION;
    }
    state
        .subscriptions
        .retain(|subscription| !subscription.endpoint.trim().is_empty());
    persist_mobile_push_state(app_handle, &state)?;
    Ok(state)
}

async fn load_mobile_push_state_cached(
    app_handle: &AppHandle,
) -> Result<StoredMobilePushState, String> {
    let mut state_guard = ACTIVE_MOBILE_PUSH_STATE.lock().await;
    if let Some(state) = state_guard.as_ref() {
        return Ok(state.clone());
    }

    let state = load_mobile_push_state_from_disk(app_handle)?;
    *state_guard = Some(state.clone());
    Ok(state)
}

async fn write_mobile_push_state_cached(
    app_handle: &AppHandle,
    next_state: StoredMobilePushState,
) -> Result<(), String> {
    persist_mobile_push_state(app_handle, &next_state)?;
    let mut state_guard = ACTIVE_MOBILE_PUSH_STATE.lock().await;
    *state_guard = Some(next_state);
    Ok(())
}

fn summarize_mobile_push_devices(
    subscriptions: &[StoredMobilePushSubscription],
) -> Vec<MobilePushPairedDeviceSummary> {
    let mut paired_devices = subscriptions
        .iter()
        .map(|subscription| MobilePushPairedDeviceSummary {
            endpoint: subscription.endpoint.clone(),
            device_label: subscription.device_label.clone(),
            user_agent: subscription.user_agent.clone(),
            standalone: subscription.standalone,
            updated_at_ms: subscription.updated_at_ms,
        })
        .collect::<Vec<_>>();
    paired_devices.sort_by(|left, right| right.updated_at_ms.cmp(&left.updated_at_ms));
    paired_devices
}

pub async fn get_mobile_push_config(
    app_handle: &AppHandle,
) -> Result<MobilePushConfigResponse, String> {
    let state = load_mobile_push_state_cached(app_handle).await?;
    Ok(MobilePushConfigResponse {
        supported: true,
        vapid_public_key: create_mobile_push_public_key(&state.private_key_base64url)?,
        subscription_count: state.subscriptions.len(),
        paired_devices: summarize_mobile_push_devices(&state.subscriptions),
    })
}

pub async fn register_mobile_push_subscription(
    app_handle: &AppHandle,
    input: MobilePushSubscriptionInput,
) -> Result<MobilePushConfigResponse, String> {
    let mut state = load_mobile_push_state_cached(app_handle).await?;
    let endpoint = normalize_mobile_push_endpoint(&input.endpoint)?;
    let p256dh = normalize_mobile_push_key(&input.keys.p256dh, "p256dh")?;
    let auth = normalize_mobile_push_key(&input.keys.auth, "auth")?;
    let now_ms = now_epoch_ms();

    if let Some(existing_subscription) = state
        .subscriptions
        .iter_mut()
        .find(|subscription| subscription.endpoint == endpoint)
    {
        existing_subscription.p256dh = p256dh;
        existing_subscription.auth = auth;
        existing_subscription.expiration_time = input.expiration_time;
        existing_subscription.device_label =
            normalize_mobile_push_device_label(input.device_label.as_deref());
        existing_subscription.user_agent = input
            .user_agent
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string);
        existing_subscription.standalone = input.standalone;
        existing_subscription.updated_at_ms = now_ms;
    } else {
        state.subscriptions.push(StoredMobilePushSubscription {
            endpoint,
            p256dh,
            auth,
            expiration_time: input.expiration_time,
            device_label: normalize_mobile_push_device_label(input.device_label.as_deref()),
            user_agent: input
                .user_agent
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_string),
            standalone: input.standalone,
            created_at_ms: now_ms,
            updated_at_ms: now_ms,
        });
    }

    write_mobile_push_state_cached(app_handle, state).await?;
    get_mobile_push_config(app_handle).await
}

pub async fn unregister_mobile_push_subscription(
    app_handle: &AppHandle,
    endpoint: &str,
) -> Result<MobilePushConfigResponse, String> {
    let mut state = load_mobile_push_state_cached(app_handle).await?;
    let normalized_endpoint = normalize_mobile_push_endpoint(endpoint)?;
    state
        .subscriptions
        .retain(|subscription| subscription.endpoint != normalized_endpoint);
    write_mobile_push_state_cached(app_handle, state).await?;
    get_mobile_push_config(app_handle).await
}

fn build_mobile_download_relative_path(
    share_root: &Path,
    absolute_path: &Path,
) -> Result<String, String> {
    let relative_path = absolute_path
        .strip_prefix(share_root)
        .map_err(|_| "The requested file is outside the active mobile share root.".to_string())?;

    let segments = relative_path
        .components()
        .filter_map(|component| match component {
            std::path::Component::Normal(value) => Some(value.to_string_lossy().to_string()),
            _ => None,
        })
        .collect::<Vec<_>>();

    if segments.is_empty() {
        return Err("The selected path is not a downloadable file inside the current mobile share.".to_string());
    }

    Ok(segments.join("/"))
}

fn build_mobile_download_open_url(
    share_url: &str,
    relative_path: &str,
) -> Result<String, String> {
    let mut url = Url::parse(share_url)
        .map_err(|error| format!("Invalid active mobile share URL: {error}"))?;
    let display_name = Path::new(relative_path)
        .file_name()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|| "file".to_string());
    let parent_path = Path::new(relative_path)
        .parent()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .replace('\\', "/");

    {
        let mut query = url.query_pairs_mut();
        query.clear();
        query.append_pair("tab", "transfers");
        if !parent_path.is_empty() {
            query.append_pair("path", &parent_path);
        }
        query.append_pair("intent", "push-download");
        query.append_pair("download", relative_path);
        query.append_pair("downloadName", &display_name);
    }

    Ok(url.to_string())
}

async fn send_mobile_push_notification_payload(
    app_handle: &AppHandle,
    payload: &MobilePushNotificationEnvelope,
) -> Result<MobilePushDispatchResult, String> {
    let state = load_mobile_push_state_cached(app_handle).await?;
    if state.subscriptions.is_empty() {
        return Err(
            "No paired iPhone notifications are registered yet. Open the mobile app and enable notifications first."
                .to_string(),
        );
    }

    let client = IsahcWebPushClient::new()
        .map_err(|error| format!("Failed to initialize the mobile push client: {error}"))?;
    let payload_bytes = serde_json::to_vec(payload)
        .map_err(|error| format!("Failed to encode the mobile push payload: {error}"))?;

    let mut delivered_count = 0usize;
    let mut failed_count = 0usize;

    for subscription in &state.subscriptions {
        let subscription_info = SubscriptionInfo::new(
            &subscription.endpoint,
            &subscription.p256dh,
            &subscription.auth,
        );
        let mut signature_builder =
            VapidSignatureBuilder::from_base64(&state.private_key_base64url, &subscription_info)
                .map_err(|error| format!("Failed to prepare the mobile push signature: {error}"))?;
        signature_builder.add_claim("sub", MOBILE_PUSH_DEFAULT_CONTACT_CLAIM);
        let signature = signature_builder
            .build()
            .map_err(|error| format!("Failed to build the mobile push signature: {error}"))?;

        let mut message_builder = WebPushMessageBuilder::new(&subscription_info);
        message_builder.set_ttl(120);
        message_builder.set_urgency(Urgency::High);
        message_builder.set_payload(ContentEncoding::Aes128Gcm, &payload_bytes);
        message_builder.set_vapid_signature(signature);

        let message = message_builder
            .build()
            .map_err(|error| format!("Failed to build the mobile push message: {error}"))?;

        match client.send(message).await {
            Ok(()) => {
                delivered_count += 1;
            }
            Err(error) => {
                failed_count += 1;
                log::warn!(
                    "GreebleFS mobile push: failed to deliver to {}: {}",
                    subscription.device_label,
                    error
                );
            }
        }
    }

    Ok(MobilePushDispatchResult {
        delivered_count,
        failed_count,
        subscription_count: state.subscriptions.len(),
    })
}

pub async fn send_mobile_download_notification(
    app_handle: &AppHandle,
    request: MobilePushDownloadNotificationRequest,
) -> Result<MobilePushDispatchResult, String> {
    let active_server = ACTIVE_SERVER.lock().await;
    let Some(active_server) = active_server.as_ref() else {
        return Err(
            "The mobile share is offline. Start the mobile link first, then try sending the file again."
                .to_string(),
        );
    };
    if active_server.file_hub.is_some() {
        return Err(
            "Send to iPhone currently needs a directory-based mobile share, not a multi-file hub."
                .to_string(),
        );
    }

    let absolute_path = PathBuf::from(request.absolute_path.trim());
    if !absolute_path.is_file() {
        return Err("The selected path is not a regular file.".to_string());
    }

    let relative_path = build_mobile_download_relative_path(&active_server.share_path, &absolute_path)?;
    let open_url = build_mobile_download_open_url(&request.share_url, &relative_path)?;
    let display_name = absolute_path
        .file_name()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|| "file".to_string());
    let parent_path = Path::new(&relative_path)
        .parent()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .replace('\\', "/");

    let payload = MobilePushNotificationEnvelope {
        title: format!("Download {display_name}"),
        body: "Tap to pull it from your paired GreebleFS desktop now.".to_string(),
        tag: format!("download:{}", relative_path.replace('/', ":")),
        require_interaction: true,
        badge_count: Some(1),
        data: MobilePushNotificationData {
            url: open_url,
            relative_path,
            parent_path,
            display_name,
            kind: "download".to_string(),
        },
    };

    send_mobile_push_notification_payload(app_handle, &payload).await
}
