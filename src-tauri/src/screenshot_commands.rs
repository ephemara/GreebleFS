use std::borrow::Cow;
use std::collections::HashMap;
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{LazyLock, Mutex};

use arboard::{Clipboard, ImageData};
use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use image::codecs::png::PngEncoder;
use image::imageops::{crop_imm, resize, FilterType};
use image::{ColorType, ImageEncoder, ImageReader, RgbaImage};
use serde::{Deserialize, Serialize};
use xcap::Monitor;

#[cfg(target_os = "windows")]
use windows_sys::Win32::Foundation::HWND;
#[cfg(target_os = "windows")]
use windows_sys::Win32::UI::WindowsAndMessaging::{
    SetWindowDisplayAffinity, WDA_EXCLUDEFROMCAPTURE, WDA_NONE,
};

#[derive(Debug, Clone)]
struct CachedCapture {
    image: RgbaImage,
    created_at: u128,
}

static SCREENSHOT_CAPTURE_CACHE: LazyLock<Mutex<HashMap<String, CachedCapture>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));
static SCREENSHOT_CAPTURE_SEQUENCE: AtomicU64 = AtomicU64::new(1);

const MAX_CAPTURE_CACHE_ENTRIES: usize = 6;
const MAX_PREVIEW_WIDTH: u32 = 1_280;
const MAX_PREVIEW_HEIGHT: u32 = 800;

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type)]
pub struct SavedScreenshot {
    pub path: String,
    pub file_name: String,
    pub created_at: u128,
}

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ScreenshotPreview {
    pub capture_id: String,
    pub preview_url: String,
    pub image_width: u32,
    pub image_height: u32,
}

#[tauri::command]
#[specta::specta]
pub async fn screenshot_capture_preview(
    window: tauri::WebviewWindow,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
) -> Result<ScreenshotPreview, String> {
    validate_capture_region(width, height)?;

    // --- Seamless capture: exclude this window from the DXGI compositor so
    // xcap (which uses DXGI Desktop Duplication) captures a clean desktop
    // WITHOUT the overlay being visible in the image, while the user still
    // sees the overlay the entire time. Same technique Discord/Teams/Zoom use.
    let hwnd_opt = get_overlay_hwnd(&window);

    if let Some(hwnd) = hwnd_opt {
        unsafe {
            let _ = SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE);
        }
        // Give the DWM one compositor frame to flush the exclusion flag
        // before DXGI reads back the framebuffer.
        std::thread::sleep(std::time::Duration::from_millis(33));
    }

    let capture_result = capture_absolute_region(x, y, width, height);

    // Always restore visibility, even on error.
    if let Some(hwnd) = hwnd_opt {
        unsafe {
            let _ = SetWindowDisplayAffinity(hwnd, WDA_NONE);
        }
    }

    let image = capture_result?;
    let preview_image = build_preview_image(&image);
    let preview_png = encode_png(&preview_image)?;
    let capture_id = store_capture_image(image)?;

    Ok(ScreenshotPreview {
        capture_id,
        preview_url: format!(
            "data:image/png;base64,{}",
            BASE64_STANDARD.encode(preview_png)
        ),
        image_width: width,
        image_height: height,
    })
}

/// Returns the raw Win32 HWND for our overlay window.
/// Returns None on non-Windows or if the handle cannot be retrieved.
fn get_overlay_hwnd(_window: &tauri::WebviewWindow) -> Option<HWND> {
    #[cfg(target_os = "windows")]
    {
        use raw_window_handle::HasWindowHandle;
        use raw_window_handle::RawWindowHandle;

        if let Ok(handle) = _window.window_handle() {
            if let RawWindowHandle::Win32(h) = handle.as_raw() {
                return Some(h.hwnd.get() as HWND);
            }
        }
    }
    None
}

#[tauri::command]
#[specta::specta]
pub async fn screenshot_save_region(
    capture_id: String,
    x: u32,
    y: u32,
    width: u32,
    height: u32,
    directory: String,
    file_prefix: Option<String>,
    copy_to_clipboard: Option<bool>,
) -> Result<SavedScreenshot, String> {
    validate_capture_region(width, height)?;

    let image = load_capture_image(&capture_id)?;
    let cropped = crop_capture_image(&image, x, y, width, height)?;
    let saved = save_rgba_image(&cropped, Path::new(&directory), file_prefix.as_deref())?;

    if copy_to_clipboard.unwrap_or(false) {
        copy_rgba_image_to_clipboard(cropped)?;
    }

    Ok(saved)
}

#[tauri::command]
#[specta::specta]
pub async fn screenshot_copy_region_to_clipboard(
    capture_id: String,
    x: u32,
    y: u32,
    width: u32,
    height: u32,
) -> Result<(), String> {
    validate_capture_region(width, height)?;

    let image = load_capture_image(&capture_id)?;
    let cropped = crop_capture_image(&image, x, y, width, height)?;
    copy_rgba_image_to_clipboard(cropped)
}

#[tauri::command]
#[specta::specta]
pub async fn screenshot_copy_image_to_clipboard(path: String) -> Result<(), String> {
    let image = read_image_from_disk(&path)?;
    copy_rgba_image_to_clipboard(image)
}

#[tauri::command]
#[specta::specta]
pub async fn screenshot_read_gallery_thumbnail(
    path: String,
    max_width: u32,
    max_height: u32,
) -> Result<String, String> {
    validate_thumbnail_bounds(max_width, max_height)?;

    let image = read_image_from_disk(&path)?;
    let preview = resize_image_to_fit(&image, max_width, max_height);
    let preview_png = encode_png(&preview)?;
    Ok(format!(
        "data:image/png;base64,{}",
        BASE64_STANDARD.encode(preview_png)
    ))
}

fn validate_capture_region(width: u32, height: u32) -> Result<(), String> {
    if width == 0 || height == 0 {
        return Err("Capture region must be at least 1 pixel wide and tall.".to_string());
    }
    if width > 16_384 || height > 16_384 {
        return Err("Capture region is too large.".to_string());
    }
    Ok(())
}

fn validate_thumbnail_bounds(max_width: u32, max_height: u32) -> Result<(), String> {
    if max_width == 0 || max_height == 0 {
        return Err("Thumbnail bounds must be at least 1 pixel wide and tall.".to_string());
    }
    if max_width > 4_096 || max_height > 4_096 {
        return Err("Thumbnail bounds are too large.".to_string());
    }
    Ok(())
}

fn capture_absolute_region(x: i32, y: i32, width: u32, height: u32) -> Result<RgbaImage, String> {
    let (monitor, relative_x, relative_y) = resolve_monitor_region(x, y, width, height)?;
    monitor
        .capture_region(relative_x, relative_y, width, height)
        .map_err(|e| format!("Failed to capture screenshot region: {}", e))
}

fn resolve_monitor_region(
    x: i32,
    y: i32,
    width: u32,
    height: u32,
) -> Result<(Monitor, u32, u32), String> {
    let monitor = Monitor::from_point(x, y).map_err(|e| {
        format!(
            "Failed to locate monitor for capture point ({}, {}): {}",
            x, y, e
        )
    })?;

    let monitor_x = monitor
        .x()
        .map_err(|e| format!("Failed to read monitor origin: {}", e))?;
    let monitor_y = monitor
        .y()
        .map_err(|e| format!("Failed to read monitor origin: {}", e))?;
    let monitor_width = monitor
        .width()
        .map_err(|e| format!("Failed to read monitor width: {}", e))?;
    let monitor_height = monitor
        .height()
        .map_err(|e| format!("Failed to read monitor height: {}", e))?;

    let relative_x = x
        .checked_sub(monitor_x)
        .ok_or_else(|| "Capture origin falls outside the selected monitor.".to_string())?;
    let relative_y = y
        .checked_sub(monitor_y)
        .ok_or_else(|| "Capture origin falls outside the selected monitor.".to_string())?;

    if relative_x < 0 || relative_y < 0 {
        return Err("Capture origin falls outside the selected monitor.".to_string());
    }

    let relative_x = relative_x as u32;
    let relative_y = relative_y as u32;

    let within_width = relative_x
        .checked_add(width)
        .is_some_and(|end_x| end_x <= monitor_width);
    let within_height = relative_y
        .checked_add(height)
        .is_some_and(|end_y| end_y <= monitor_height);

    if !within_width || !within_height {
        return Err(format!(
            "Capture region extends beyond monitor bounds (monitor: {}x{}, requested offset: {}, {} size: {}x{}).",
            monitor_width, monitor_height, relative_x, relative_y, width, height
        ));
    }

    Ok((monitor, relative_x, relative_y))
}

fn build_preview_image(image: &RgbaImage) -> RgbaImage {
    resize_image_to_fit(image, MAX_PREVIEW_WIDTH, MAX_PREVIEW_HEIGHT)
}

fn resize_image_to_fit(image: &RgbaImage, max_width: u32, max_height: u32) -> RgbaImage {
    if image.width() <= max_width && image.height() <= max_height {
        return image.clone();
    }

    let scale = f32::min(
        max_width as f32 / image.width() as f32,
        max_height as f32 / image.height() as f32,
    );

    let preview_width = ((image.width() as f32) * scale).round().max(1.0) as u32;
    let preview_height = ((image.height() as f32) * scale).round().max(1.0) as u32;

    resize(image, preview_width, preview_height, FilterType::Lanczos3)
}

fn store_capture_image(image: RgbaImage) -> Result<String, String> {
    let capture_id = create_capture_id();
    let created_at = current_timestamp_millis()?;
    let mut cache = SCREENSHOT_CAPTURE_CACHE
        .lock()
        .map_err(|_| "Failed to lock screenshot capture cache.".to_string())?;
    cache.insert(capture_id.clone(), CachedCapture { image, created_at });
    prune_capture_cache(&mut cache);
    Ok(capture_id)
}

fn prune_capture_cache(cache: &mut HashMap<String, CachedCapture>) {
    if cache.len() <= MAX_CAPTURE_CACHE_ENTRIES {
        return;
    }

    let mut captures = cache
        .iter()
        .map(|(capture_id, entry)| (capture_id.clone(), entry.created_at))
        .collect::<Vec<_>>();
    captures.sort_by_key(|(_, created_at)| *created_at);

    let remove_count = cache.len().saturating_sub(MAX_CAPTURE_CACHE_ENTRIES);
    for (capture_id, _) in captures.into_iter().take(remove_count) {
        cache.remove(&capture_id);
    }
}

fn load_capture_image(capture_id: &str) -> Result<RgbaImage, String> {
    let cache = SCREENSHOT_CAPTURE_CACHE
        .lock()
        .map_err(|_| "Failed to lock screenshot capture cache.".to_string())?;
    cache
        .get(capture_id)
        .map(|entry| entry.image.clone())
        .ok_or_else(|| {
            "The screenshot capture preview expired. Take a new screenshot preview.".to_string()
        })
}

fn crop_capture_image(
    image: &RgbaImage,
    x: u32,
    y: u32,
    width: u32,
    height: u32,
) -> Result<RgbaImage, String> {
    validate_crop_region(image, x, y, width, height)?;
    Ok(crop_imm(image, x, y, width, height).to_image())
}

fn validate_crop_region(
    image: &RgbaImage,
    x: u32,
    y: u32,
    width: u32,
    height: u32,
) -> Result<(), String> {
    let within_width = x
        .checked_add(width)
        .is_some_and(|end_x| end_x <= image.width());
    let within_height = y
        .checked_add(height)
        .is_some_and(|end_y| end_y <= image.height());

    if !within_width || !within_height {
        return Err(format!(
            "Selection falls outside the captured preview bounds (image: {}x{}, requested crop: {}, {} size: {}x{}).",
            image.width(),
            image.height(),
            x,
            y,
            width,
            height
        ));
    }

    Ok(())
}

fn save_rgba_image(
    image: &RgbaImage,
    dir_path: &Path,
    file_prefix: Option<&str>,
) -> Result<SavedScreenshot, String> {
    std::fs::create_dir_all(dir_path).map_err(|e| e.to_string())?;

    let created_at = current_timestamp_millis()?;
    let prefix = sanitize_file_prefix(file_prefix);
    let file_name = format!("{}-{}.png", prefix, created_at);
    let full_path = dir_path.join(&file_name);

    image.save(&full_path).map_err(|e| {
        format!(
            "Failed to save screenshot to '{}': {}",
            full_path.display(),
            e
        )
    })?;

    Ok(SavedScreenshot {
        path: full_path.to_string_lossy().to_string(),
        file_name,
        created_at,
    })
}

fn sanitize_file_prefix(value: Option<&str>) -> String {
    let sanitized = value
        .unwrap_or("overlayterm-shot")
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() {
                ch
            } else if ch == '-' || ch == '_' {
                ch
            } else {
                '-'
            }
        })
        .collect::<String>()
        .trim_matches('-')
        .trim_matches('_')
        .to_string();

    if sanitized.is_empty() {
        "overlayterm-shot".to_string()
    } else {
        sanitized
    }
}

fn current_timestamp_millis() -> Result<u128, String> {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())
        .map(|duration| duration.as_millis())
}

fn read_image_from_disk(path: &str) -> Result<RgbaImage, String> {
    ImageReader::open(path)
        .map_err(|e| format!("Failed to open screenshot '{}': {}", path, e))?
        .with_guessed_format()
        .map_err(|e| format!("Failed to detect image format for '{}': {}", path, e))?
        .decode()
        .map_err(|e| format!("Failed to decode screenshot '{}': {}", path, e))
        .map(|image| image.to_rgba8())
}

fn copy_rgba_image_to_clipboard(image: RgbaImage) -> Result<(), String> {
    let mut clipboard =
        Clipboard::new().map_err(|e| format!("Failed to access system clipboard: {}", e))?;
    clipboard
        .set_image(ImageData {
            width: image.width() as usize,
            height: image.height() as usize,
            bytes: Cow::Owned(image.into_raw()),
        })
        .map_err(|e| format!("Failed to copy image to clipboard: {}", e))?;

    Ok(())
}

fn create_capture_id() -> String {
    let created_at = current_timestamp_millis().unwrap_or_default();
    let sequence = SCREENSHOT_CAPTURE_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    format!("capture-{}-{}", created_at, sequence)
}

fn encode_png(image: &RgbaImage) -> Result<Vec<u8>, String> {
    let mut png_bytes = Vec::new();
    let encoder = PngEncoder::new(&mut png_bytes);
    encoder
        .write_image(
            image.as_raw(),
            image.width(),
            image.height(),
            ColorType::Rgba8.into(),
        )
        .map_err(|e| format!("Failed to encode screenshot preview as PNG: {}", e))?;
    Ok(png_bytes)
}

#[cfg(test)]
mod tests {
    use super::{
        build_preview_image, create_capture_id, encode_png, load_capture_image,
        resize_image_to_fit, sanitize_file_prefix, save_rgba_image, store_capture_image,
        validate_capture_region, validate_crop_region, validate_thumbnail_bounds,
        MAX_CAPTURE_CACHE_ENTRIES, MAX_PREVIEW_HEIGHT, MAX_PREVIEW_WIDTH,
    };
    use image::{load_from_memory, Rgba, RgbaImage};
    use std::sync::{LazyLock, Mutex};
    use tempfile::tempdir;

    static CACHE_TEST_LOCK: LazyLock<Mutex<()>> = LazyLock::new(|| Mutex::new(()));

    #[test]
    fn validate_capture_region_rejects_zero_and_oversized_values() {
        assert!(validate_capture_region(0, 100).is_err());
        assert!(validate_capture_region(100, 0).is_err());
        assert!(validate_capture_region(16_385, 100).is_err());
        assert!(validate_capture_region(100, 16_385).is_err());
    }

    #[test]
    fn validate_capture_region_accepts_supported_bounds() {
        assert!(validate_capture_region(1, 1).is_ok());
        assert!(validate_capture_region(16_384, 16_384).is_ok());
    }

    #[test]
    fn validate_thumbnail_bounds_rejects_invalid_sizes() {
        assert!(validate_thumbnail_bounds(0, 240).is_err());
        assert!(validate_thumbnail_bounds(320, 0).is_err());
        assert!(validate_thumbnail_bounds(4_097, 240).is_err());
        assert!(validate_thumbnail_bounds(320, 4_097).is_err());
    }

    #[test]
    fn build_preview_image_does_not_upscale_small_images() {
        let image = RgbaImage::from_pixel(800, 600, Rgba([12, 34, 56, 255]));
        let preview = build_preview_image(&image);
        assert_eq!(preview.width(), 800);
        assert_eq!(preview.height(), 600);
    }

    #[test]
    fn build_preview_image_scales_large_images_into_bounds() {
        let image = RgbaImage::from_pixel(4_000, 2_000, Rgba([255, 0, 0, 255]));
        let preview = build_preview_image(&image);

        assert!(preview.width() <= MAX_PREVIEW_WIDTH);
        assert!(preview.height() <= MAX_PREVIEW_HEIGHT);
        assert_eq!(preview.width(), 1_280);
        assert_eq!(preview.height(), 640);
    }

    #[test]
    fn resize_image_to_fit_uses_requested_thumbnail_bounds() {
        let image = RgbaImage::from_pixel(3_000, 2_000, Rgba([255, 255, 255, 255]));
        let preview = resize_image_to_fit(&image, 300, 200);
        assert_eq!(preview.width(), 300);
        assert_eq!(preview.height(), 200);
    }

    #[test]
    fn validate_crop_region_checks_image_bounds() {
        let image = RgbaImage::from_pixel(640, 480, Rgba([0, 0, 0, 255]));
        assert!(validate_crop_region(&image, 0, 0, 640, 480).is_ok());
        assert!(validate_crop_region(&image, 639, 0, 2, 1).is_err());
        assert!(validate_crop_region(&image, 0, 479, 1, 2).is_err());
    }

    #[test]
    fn create_capture_id_is_unique_and_prefixed() {
        let first = create_capture_id();
        let second = create_capture_id();
        assert!(first.starts_with("capture-"));
        assert!(second.starts_with("capture-"));
        assert_ne!(first, second);
    }

    #[test]
    fn encode_png_round_trip_preserves_dimensions() {
        let image = RgbaImage::from_pixel(12, 8, Rgba([1, 2, 3, 255]));
        let bytes = encode_png(&image).expect("PNG encoding should work");
        let decoded = load_from_memory(&bytes)
            .expect("encoded PNG should decode")
            .to_rgba8();
        assert_eq!(decoded.width(), 12);
        assert_eq!(decoded.height(), 8);
    }

    #[test]
    fn store_capture_image_keeps_recent_entries_available() {
        let _guard = CACHE_TEST_LOCK.lock().expect("cache test lock");
        let capture_ids = (0..MAX_CAPTURE_CACHE_ENTRIES)
            .map(|index| {
                store_capture_image(RgbaImage::from_pixel(
                    16 + index as u32,
                    16,
                    Rgba([index as u8, 20, 20, 255]),
                ))
                .expect("store image")
            })
            .collect::<Vec<_>>();

        for capture_id in capture_ids {
            assert!(load_capture_image(&capture_id).is_ok());
        }
    }

    #[test]
    fn sanitize_file_prefix_falls_back_when_invalid() {
        assert_eq!(
            sanitize_file_prefix(Some("overlayterm-shot")),
            "overlayterm-shot"
        );
        assert_eq!(sanitize_file_prefix(Some("bad prefix!*")), "bad-prefix");
        assert_eq!(sanitize_file_prefix(Some("___")), "overlayterm-shot");
    }

    #[test]
    fn save_rgba_image_uses_sanitized_prefix() {
        let directory = tempdir().expect("tempdir");
        let image = RgbaImage::from_pixel(12, 12, Rgba([1, 1, 1, 255]));
        let saved =
            save_rgba_image(&image, directory.path(), Some("bad prefix!*")).expect("save image");

        assert!(saved.file_name.starts_with("bad-prefix-"));
        assert!(saved.path.ends_with(".png"));
    }
}
