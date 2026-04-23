use tauri::command;
use tauri::AppHandle;
use crate::lan_share::{
    server::{start_lan_share, stop_lan_share_inner, get_local_ip},
    types::{LanShareResult, MobileThemeSnapshot, ACTIVE_MOBILE_THEME_SNAPSHOT},
};

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
pub async fn mobile_share_set_theme_snapshot(
    snapshot: MobileThemeSnapshot,
) -> Result<(), String> {
    let mut active_snapshot = ACTIVE_MOBILE_THEME_SNAPSHOT.write().await;
    *active_snapshot = snapshot;
    Ok(())
}
