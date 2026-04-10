use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, WebviewWindow};

pub const MAIN_TRAY_ICON_ID: &str = "main-tray";

/// Atomically apply all window presentation properties in one IPC call.
/// This prevents the race condition where decorations/alwaysOnTop are set
/// separately from geometry, causing the WM to see intermediate invalid states.
#[tauri::command]
#[specta::specta]
#[allow(clippy::too_many_arguments)]
pub fn window_apply_mode(
    app: AppHandle,
    decorations: bool,
    always_on_top: bool,
    shadow: bool,
    skip_taskbar: bool,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Main window not found".to_string())?;

    // Some Linux WMs reject presentation-only flags during startup or for
    // transparent undecorated windows. Geometry must still apply so the dock
    // cannot get stranded in the center of the screen.
    log_optional_window_error(window.set_decorations(decorations), "set_decorations");
    log_optional_window_error(window.set_always_on_top(always_on_top), "set_always_on_top");
    log_optional_window_error(window.set_shadow(shadow), "set_shadow");
    log_optional_window_error(window.set_skip_taskbar(skip_taskbar), "set_skip_taskbar");

    // Then geometry atomically — size before position
    if width > 0 && height > 0 {
        window
            .set_size(PhysicalSize::new(width, height))
            .map_err(|error| format!("window_apply_mode set_size failed: {error}"))?;
    }
    window
        .set_position(PhysicalPosition::new(x, y))
        .map_err(|error| format!("window_apply_mode set_position failed: {error}"))?;

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn window_set_blur(app: AppHandle, enabled: bool, strength: Option<f64>) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Main window not found".to_string())?;

    set_native_blur(&window, enabled, strength)
}

#[tauri::command]
#[specta::specta]
pub fn window_set_taskbar_visibility(app: AppHandle, visible: bool) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Main window not found".to_string())?;

    set_native_taskbar_visibility(&app, &window, visible)
}

#[tauri::command]
#[specta::specta]
pub fn tray_set_visible(app: AppHandle, visible: bool) -> Result<(), String> {
    let tray = app
        .tray_by_id(MAIN_TRAY_ICON_ID)
        .ok_or_else(|| "Main tray icon not found".to_string())?;

    tray.set_visible(visible).map_err(|error| error.to_string())
}


#[cfg(target_os = "windows")]
fn set_native_blur(
    window: &WebviewWindow,
    enabled: bool,
    strength: Option<f64>,
) -> Result<(), String> {
    use window_vibrancy::{apply_acrylic, apply_blur, apply_mica};

    clear_windows_effects(window);

    if !enabled {
        return Ok(());
    }

    let normalized_strength = normalize_blur_strength(strength);
    let acrylic_alpha = lerp_u8(144, 44, normalized_strength);
    let blur_alpha = lerp_u8(108, 28, normalized_strength);

    apply_acrylic(window, Some((18, 18, 18, acrylic_alpha)))
        .or_else(|acrylic_error| {
            apply_blur(window, Some((18, 18, 18, blur_alpha))).map_err(|blur_error| {
                format!(
                    "Windows acrylic blur failed: {acrylic_error}; Windows blur fallback failed: {blur_error}"
                )
            })
        })
        .or_else(|effect_error| {
            apply_mica(window, Some(true)).map_err(|mica_error| {
                format!(
                    "{effect_error}; Windows mica fallback failed: {mica_error}"
                )
            })
        })?;

    Ok(())
}

#[cfg(target_os = "windows")]
fn clear_windows_effects(window: &WebviewWindow) {
    use window_vibrancy::{clear_acrylic, clear_blur, clear_mica};

    let _ = clear_acrylic(window);
    let _ = clear_blur(window);
    let _ = clear_mica(window);
}

#[cfg(target_os = "macos")]
fn set_native_blur(
    window: &WebviewWindow,
    enabled: bool,
    _strength: Option<f64>,
) -> Result<(), String> {
    use window_vibrancy::{apply_vibrancy, clear_vibrancy, NSVisualEffectMaterial};

    if enabled {
        apply_vibrancy(window, NSVisualEffectMaterial::HudWindow, None, Some(18.0))
            .map_err(|error| error.to_string())?;
    } else {
        clear_vibrancy(window).map_err(|error| error.to_string())?;
    }

    Ok(())
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn set_native_blur(
    _window: &WebviewWindow,
    _enabled: bool,
    _strength: Option<f64>,
) -> Result<(), String> {
    Ok(())
}

#[cfg(target_os = "macos")]
fn set_native_taskbar_visibility(
    app: &AppHandle,
    _window: &WebviewWindow,
    visible: bool,
) -> Result<(), String> {
    app.set_dock_visibility(visible)
        .map_err(|error| error.to_string())
}

#[cfg(not(target_os = "macos"))]
fn set_native_taskbar_visibility(
    _app: &AppHandle,
    window: &WebviewWindow,
    visible: bool,
) -> Result<(), String> {
    window
        .set_skip_taskbar(!visible)
        .map_err(|error| error.to_string())
}

fn log_optional_window_error<T, E: std::fmt::Display>(result: Result<T, E>, operation: &str) {
    if let Err(error) = result {
        eprintln!("OverlayTerm: window_apply_mode {operation} failed: {error}");
    }
}

#[cfg(any(target_os = "windows", target_os = "macos"))]
fn normalize_blur_strength(strength: Option<f64>) -> f64 {
    strength.unwrap_or(18.0).clamp(0.0, 32.0) / 32.0
}

#[cfg(target_os = "windows")]
fn lerp_u8(start: u8, end: u8, amount: f64) -> u8 {
    (start as f64 + (end as f64 - start as f64) * amount)
        .round()
        .clamp(0.0, 255.0) as u8
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn main_tray_icon_id_is_stable() {
        assert_eq!(MAIN_TRAY_ICON_ID, "main-tray");
    }

    #[cfg(any(target_os = "windows", target_os = "macos"))]
    #[test]
    fn normalize_blur_strength_defaults_and_clamps() {
        assert_eq!(normalize_blur_strength(None), 18.0 / 32.0);
        assert_eq!(normalize_blur_strength(Some(-10.0)), 0.0);
        assert_eq!(normalize_blur_strength(Some(16.0)), 0.5);
        assert_eq!(normalize_blur_strength(Some(99.0)), 1.0);
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn lerp_u8_interpolates_and_rounds() {
        assert_eq!(lerp_u8(144, 44, 0.0), 144);
        assert_eq!(lerp_u8(144, 44, 0.5), 94);
        assert_eq!(lerp_u8(144, 44, 1.0), 44);
    }
}
