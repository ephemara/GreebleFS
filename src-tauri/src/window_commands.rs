use tauri::{AppHandle, Manager, WebviewWindow};

#[tauri::command]
pub fn window_set_blur(app: AppHandle, enabled: bool) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Main window not found".to_string())?;

    set_native_blur(&window, enabled)
}

#[cfg(target_os = "windows")]
fn set_native_blur(window: &WebviewWindow, enabled: bool) -> Result<(), String> {
    if enabled {
        window_vibrancy::apply_blur(window, Some((18, 18, 18, 160)))
            .map_err(|error| error.to_string())?;
    } else {
        window_vibrancy::clear_blur(window).map_err(|error| error.to_string())?;
    }

    Ok(())
}

#[cfg(target_os = "macos")]
fn set_native_blur(window: &WebviewWindow, enabled: bool) -> Result<(), String> {
    use window_vibrancy::{apply_vibrancy, clear_vibrancy, NSVisualEffectMaterial};

    if enabled {
        apply_vibrancy(window, NSVisualEffectMaterial::HudWindow, None, None)
            .map_err(|error| error.to_string())?;
    } else {
        clear_vibrancy(window).map_err(|error| error.to_string())?;
    }

    Ok(())
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn set_native_blur(_window: &WebviewWindow, _enabled: bool) -> Result<(), String> {
    Ok(())
}
