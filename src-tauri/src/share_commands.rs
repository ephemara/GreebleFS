use crate::lan_share::{
    push::{
        get_mobile_push_config, register_mobile_push_subscription,
        send_mobile_download_notification, unregister_mobile_push_subscription,
        MobilePushConfigResponse, MobilePushDispatchResult,
        MobilePushDownloadNotificationRequest, MobilePushSubscriptionInput,
        MobilePushSubscriptionRemovalRequest,
    },
    server::{get_local_ip, start_lan_share, stop_lan_share_inner},
    types::{LanShareResult, MobileThemeSnapshot, ACTIVE_MOBILE_THEME_SNAPSHOT},
};
use tauri::command;
use tauri::AppHandle;

#[command]
#[specta::specta]
pub async fn lan_share_start(
    app: AppHandle,
    path: String,
    share_mode: String,
    hub_paths: Option<Vec<String>>,
    remote_access_mode: Option<String>,
) -> Result<LanShareResult, String> {
    start_lan_share(app, path, share_mode, hub_paths, remote_access_mode).await
}

#[command]
#[specta::specta]
pub async fn lan_share_stop() -> Result<(), String> {
    stop_lan_share_inner().await
}

#[command]
#[specta::specta]
pub fn lan_share_get_local_ip() -> Result<String, String> {
    get_local_ip()
}

#[command]
#[specta::specta]
pub async fn mobile_share_set_theme_snapshot(snapshot: MobileThemeSnapshot) -> Result<(), String> {
    let mut active_snapshot = ACTIVE_MOBILE_THEME_SNAPSHOT.write().await;
    *active_snapshot = snapshot;
    Ok(())
}

#[command]
#[specta::specta]
pub async fn mobile_push_get_config(app: AppHandle) -> Result<MobilePushConfigResponse, String> {
    get_mobile_push_config(&app).await
}

#[command]
#[specta::specta]
pub async fn mobile_push_register_subscription(
    app: AppHandle,
    input: MobilePushSubscriptionInput,
) -> Result<MobilePushConfigResponse, String> {
    register_mobile_push_subscription(&app, input).await
}

#[command]
#[specta::specta]
pub async fn mobile_push_unregister_subscription(
    app: AppHandle,
    request: MobilePushSubscriptionRemovalRequest,
) -> Result<MobilePushConfigResponse, String> {
    unregister_mobile_push_subscription(&app, &request.endpoint).await
}

#[command]
#[specta::specta]
pub async fn mobile_push_send_download_notification(
    app: AppHandle,
    request: MobilePushDownloadNotificationRequest,
) -> Result<MobilePushDispatchResult, String> {
    send_mobile_download_notification(&app, request).await
}
