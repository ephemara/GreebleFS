use tauri::AppHandle;
use tauri_plugin_autostart::ManagerExt;

use crate::linux_graphics::{
    current_linux_display_backend_status, set_linux_display_backend_preference,
    set_linux_nvidia_webkit_workaround_mode, LinuxDisplayBackendPreference,
    LinuxDisplayBackendStatus, LinuxNvidiaWebkitWorkaroundMode,
};

#[tauri::command]
#[specta::specta]
pub async fn startup_get_launch_at_startup(app: AppHandle) -> Result<bool, String> {
    app.autolaunch()
        .is_enabled()
        .map_err(|error| error.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn startup_set_launch_at_startup(app: AppHandle, enabled: bool) -> Result<bool, String> {
    let manager = app.autolaunch();
    if enabled {
        manager.enable().map_err(|error| error.to_string())?;
    } else {
        manager.disable().map_err(|error| error.to_string())?;
    }

    manager.is_enabled().map_err(|error| error.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn startup_get_linux_display_backend_status() -> Result<LinuxDisplayBackendStatus, String>
{
    Ok(current_linux_display_backend_status())
}

#[tauri::command]
#[specta::specta]
pub async fn startup_set_linux_display_backend_preference(
    preferred_backend: LinuxDisplayBackendPreference,
) -> Result<LinuxDisplayBackendStatus, String> {
    set_linux_display_backend_preference(preferred_backend)?;
    Ok(current_linux_display_backend_status())
}

#[tauri::command]
#[specta::specta]
pub async fn startup_set_linux_nvidia_webkit_workaround_mode(
    workaround_mode: LinuxNvidiaWebkitWorkaroundMode,
) -> Result<LinuxDisplayBackendStatus, String> {
    set_linux_nvidia_webkit_workaround_mode(workaround_mode)?;
    Ok(current_linux_display_backend_status())
}
