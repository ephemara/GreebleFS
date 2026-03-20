use tauri::{AppHandle, Manager, WebviewWindow};

#[tauri::command]
pub fn window_set_blur(app: AppHandle, enabled: bool, strength: Option<f64>) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Main window not found".to_string())?;

    set_native_blur(&window, enabled, strength)
}

#[cfg(target_os = "windows")]
fn set_native_blur(window: &WebviewWindow, enabled: bool, strength: Option<f64>) -> Result<(), String> {
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
fn set_native_blur(window: &WebviewWindow, enabled: bool, _strength: Option<f64>) -> Result<(), String> {
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
fn set_native_blur(_window: &WebviewWindow, _enabled: bool, _strength: Option<f64>) -> Result<(), String> {
    Ok(())
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
