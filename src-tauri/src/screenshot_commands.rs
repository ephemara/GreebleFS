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

static SCREENSHOT_CAPTURE_CACHE: LazyLock<Mutex<HashMap<String, RgbaImage>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));
static SCREENSHOT_CAPTURE_SEQUENCE: AtomicU64 = AtomicU64::new(1);

const MAX_PREVIEW_WIDTH: u32 = 1_920;
const MAX_PREVIEW_HEIGHT: u32 = 1_200;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SavedScreenshot {
    pub path: String,
    pub file_name: String,
    pub created_at: u128,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ScreenshotPreview {
    pub capture_id: String,
    pub preview_url: String,
    pub image_width: u32,
    pub image_height: u32,
}

#[tauri::command]
pub async fn screenshot_capture_preview(
    x: i32,
    y: i32,
    width: u32,
    height: u32,
) -> Result<ScreenshotPreview, String> {
    validate_capture_region(width, height)?;

    let image = capture_absolute_region(x, y, width, height)?;
    let preview_image = build_preview_image(&image);
    let preview_png = encode_png(&preview_image)?;
    let capture_id = store_capture_image(image)?;

    Ok(ScreenshotPreview {
        capture_id,
        preview_url: format!("data:image/png;base64,{}", BASE64_STANDARD.encode(preview_png)),
        image_width: width,
        image_height: height,
    })
}

#[tauri::command]
pub async fn screenshot_save_region(
    capture_id: String,
    x: u32,
    y: u32,
    width: u32,
    height: u32,
    directory: String,
) -> Result<SavedScreenshot, String> {
    validate_capture_region(width, height)?;

    let image = load_capture_image(&capture_id)?;
    validate_crop_region(&image, x, y, width, height)?;

    let cropped = crop_imm(&image, x, y, width, height).to_image();
    let dir_path = Path::new(&directory);
    std::fs::create_dir_all(dir_path).map_err(|e| e.to_string())?;

    let created_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis();
    let file_name = format!("overlayterm-shot-{}.png", created_at);
    let full_path = dir_path.join(&file_name);

    cropped.save(&full_path).map_err(|e| {
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

#[tauri::command]
pub async fn screenshot_copy_image_to_clipboard(path: String) -> Result<(), String> {
    let image = ImageReader::open(&path)
        .map_err(|e| format!("Failed to open screenshot '{}': {}", path, e))?
        .with_guessed_format()
        .map_err(|e| format!("Failed to detect image format for '{}': {}", path, e))?
        .decode()
        .map_err(|e| format!("Failed to decode screenshot '{}': {}", path, e))?
        .to_rgba8();

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

fn validate_capture_region(width: u32, height: u32) -> Result<(), String> {
    if width == 0 || height == 0 {
        return Err("Capture region must be at least 1 pixel wide and tall.".to_string());
    }
    if width > 16_384 || height > 16_384 {
        return Err("Capture region is too large.".to_string());
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
    if image.width() <= MAX_PREVIEW_WIDTH && image.height() <= MAX_PREVIEW_HEIGHT {
        return image.clone();
    }

    let scale = f32::min(
        MAX_PREVIEW_WIDTH as f32 / image.width() as f32,
        MAX_PREVIEW_HEIGHT as f32 / image.height() as f32,
    );

    let preview_width = ((image.width() as f32) * scale).round().max(1.0) as u32;
    let preview_height = ((image.height() as f32) * scale).round().max(1.0) as u32;

    resize(image, preview_width, preview_height, FilterType::Triangle)
}

fn store_capture_image(image: RgbaImage) -> Result<String, String> {
    let capture_id = create_capture_id();
    let mut cache = SCREENSHOT_CAPTURE_CACHE
        .lock()
        .map_err(|_| "Failed to lock screenshot capture cache.".to_string())?;
    cache.clear();
    cache.insert(capture_id.clone(), image);
    Ok(capture_id)
}

fn load_capture_image(capture_id: &str) -> Result<RgbaImage, String> {
    let cache = SCREENSHOT_CAPTURE_CACHE
        .lock()
        .map_err(|_| "Failed to lock screenshot capture cache.".to_string())?;
    cache
        .get(capture_id)
        .cloned()
        .ok_or_else(|| "The screenshot capture preview expired. Take a new screenshot preview.".to_string())
}

fn validate_crop_region(
    image: &RgbaImage,
    x: u32,
    y: u32,
    width: u32,
    height: u32,
) -> Result<(), String> {
    let within_width = x.checked_add(width).is_some_and(|end_x| end_x <= image.width());
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

fn create_capture_id() -> String {
    let created_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default();
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
