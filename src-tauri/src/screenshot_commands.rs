use std::borrow::Cow;
use std::collections::HashMap;
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{LazyLock, Mutex};
use std::time::Duration;

use ab_glyph::{FontArc, PxScale};
use arboard::{Clipboard, ImageData};
use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use fontdb::{Database, Family, Query, Source};
use image::codecs::png::PngEncoder;
use image::imageops::{crop_imm, resize, FilterType};
use image::{ColorType, ImageEncoder, ImageReader, Rgba, RgbaImage};
use imageproc::drawing::{draw_filled_circle_mut, draw_line_segment_mut, draw_text_mut};
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

struct OverlayCaptureGuard {
    window: tauri::WebviewWindow,
    restore_visibility: bool,
}

impl Drop for OverlayCaptureGuard {
    fn drop(&mut self) {
        restore_overlay_capture(&self.window, self.restore_visibility);
    }
}

static SCREENSHOT_CAPTURE_CACHE: LazyLock<Mutex<HashMap<String, CachedCapture>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));
static SCREENSHOT_CAPTURE_SEQUENCE: AtomicU64 = AtomicU64::new(1);
static SCREENSHOT_FONT_CACHE: LazyLock<Mutex<Option<FontArc>>> = LazyLock::new(|| Mutex::new(None));

const MAX_CAPTURE_CACHE_ENTRIES: usize = 6;
const MAX_PREVIEW_WIDTH: u32 = 1_280;
const MAX_PREVIEW_HEIGHT: u32 = 800;
const NON_WINDOWS_CAPTURE_HIDE_DELAY_MS: u64 = 120;
const MIN_ANNOTATION_LINE_WIDTH: f32 = 1.0;
const MIN_TEXT_SIZE: f32 = 8.0;
const DEFAULT_TEXT_COLOR: Rgba<u8> = Rgba([241, 245, 249, 255]);
const SHADOW_TEXT_COLOR: Rgba<u8> = Rgba([0, 0, 0, 180]);

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

#[derive(Debug, Serialize, Deserialize, Clone, Copy, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ScreenshotRegion {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ScreenshotAnnotatedExportResult {
    pub saved: Option<SavedScreenshot>,
    pub copied_to_clipboard: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ScreenshotAnnotation {
    Rect {
        x1: f32,
        y1: f32,
        x2: f32,
        y2: f32,
        color: String,
        lw: f32,
    },
    Arrow {
        x1: f32,
        y1: f32,
        x2: f32,
        y2: f32,
        color: String,
        lw: f32,
    },
    Text {
        x: f32,
        y: f32,
        text: String,
        color: String,
        size: f32,
    },
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

    let _guard = prepare_overlay_capture(&window);
    let image = capture_monitor_image(x, y)?;
    let image_width = image.width();
    let image_height = image.height();
    let preview_image = build_preview_image(&image);
    let preview_png = encode_png(&preview_image)?;
    let capture_id = store_capture_image(image)?;

    Ok(ScreenshotPreview {
        capture_id,
        preview_url: format!(
            "data:image/png;base64,{}",
            BASE64_STANDARD.encode(preview_png)
        ),
        image_width,
        image_height,
    })
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
pub async fn screenshot_export_annotated(
    capture_id: String,
    selection: Option<ScreenshotRegion>,
    annotations: Vec<ScreenshotAnnotation>,
    directory: Option<String>,
    file_prefix: Option<String>,
    copy_to_clipboard: Option<bool>,
) -> Result<ScreenshotAnnotatedExportResult, String> {
    if annotations.is_empty() {
        return Err("Annotated export requires at least one annotation.".to_string());
    }

    let should_copy = copy_to_clipboard.unwrap_or(false);
    let should_save = directory
        .as_deref()
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false);

    if !should_copy && !should_save {
        return Err("Annotated export requires a save destination or clipboard copy.".to_string());
    }

    let mut image = load_capture_image(&capture_id)?;
    render_annotations(&mut image, &annotations)?;

    let final_image = if let Some(region) = selection {
        validate_capture_region(region.width, region.height)?;
        crop_capture_image(&image, region.x, region.y, region.width, region.height)?
    } else {
        image
    };

    let saved = if let Some(directory) = directory.as_deref().filter(|value| !value.trim().is_empty())
    {
        Some(save_rgba_image(
            &final_image,
            Path::new(directory),
            file_prefix.as_deref(),
        )?)
    } else {
        None
    };

    if should_copy {
        copy_rgba_image_to_clipboard(final_image)?;
    }

    Ok(ScreenshotAnnotatedExportResult {
        saved,
        copied_to_clipboard: should_copy,
    })
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

fn prepare_overlay_capture(window: &tauri::WebviewWindow) -> OverlayCaptureGuard {
    let restore_visibility = exclude_overlay_from_capture(window);
    OverlayCaptureGuard {
        window: window.clone(),
        restore_visibility,
    }
}

fn capture_monitor_image(x: i32, y: i32) -> Result<RgbaImage, String> {
    let monitor = Monitor::from_point(x, y).map_err(|e| {
        format!(
            "Failed to locate monitor for capture point ({}, {}): {}",
            x, y, e
        )
    })?;

    monitor
        .capture_image()
        .map_err(|e| format!("Failed to capture screenshot preview: {}", e))
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

fn render_annotations(image: &mut RgbaImage, annotations: &[ScreenshotAnnotation]) -> Result<(), String> {
    if annotations.is_empty() {
        return Ok(());
    }

    let font = if annotations
        .iter()
        .any(|annotation| matches!(annotation, ScreenshotAnnotation::Text { .. }))
    {
        Some(load_annotation_font()?)
    } else {
        None
    };

    for annotation in annotations {
        match annotation {
            ScreenshotAnnotation::Rect {
                x1,
                y1,
                x2,
                y2,
                color,
                lw,
            } => {
                let color = parse_annotation_color(color).unwrap_or(DEFAULT_TEXT_COLOR);
                draw_rectangle_outline(
                    image,
                    clamp_point(*x1, *y1, image.width(), image.height()),
                    clamp_point(*x2, *y2, image.width(), image.height()),
                    (*lw).max(MIN_ANNOTATION_LINE_WIDTH),
                    color,
                );
            }
            ScreenshotAnnotation::Arrow {
                x1,
                y1,
                x2,
                y2,
                color,
                lw,
            } => {
                let color = parse_annotation_color(color).unwrap_or(DEFAULT_TEXT_COLOR);
                draw_arrow(
                    image,
                    clamp_point(*x1, *y1, image.width(), image.height()),
                    clamp_point(*x2, *y2, image.width(), image.height()),
                    (*lw).max(MIN_ANNOTATION_LINE_WIDTH),
                    color,
                );
            }
            ScreenshotAnnotation::Text {
                x,
                y,
                text,
                color,
                size,
            } => {
                if text.trim().is_empty() {
                    continue;
                }

                let font = font
                    .as_ref()
                    .ok_or_else(|| "Failed to load an annotation font.".to_string())?;
                let text_color = parse_annotation_color(color).unwrap_or(DEFAULT_TEXT_COLOR);
                let scale = PxScale::from((*size).max(MIN_TEXT_SIZE));
                let origin = clamp_point(*x, *y, image.width(), image.height());
                draw_text_with_shadow(image, font, scale, origin, text.trim(), text_color);
            }
        }
    }

    Ok(())
}

fn load_annotation_font() -> Result<FontArc, String> {
    let mut cache = SCREENSHOT_FONT_CACHE
        .lock()
        .map_err(|_| "Failed to lock screenshot font cache.".to_string())?;
    if let Some(font) = cache.as_ref() {
        return Ok(font.clone());
    }

    let mut database = Database::new();
    database.load_system_fonts();
    let query = Query {
        families: &[Family::SansSerif],
        ..Query::default()
    };
    let face_id = database
        .query(&query)
        .ok_or_else(|| "Failed to locate a system sans-serif font for screenshot annotations.".to_string())?;
    let face = database
        .face(face_id)
        .ok_or_else(|| "Resolved screenshot annotation font face is unavailable.".to_string())?;

    let bytes = match &face.source {
        Source::Binary(data) => data.as_ref().as_ref().to_vec(),
        Source::File(path) => std::fs::read(path)
            .map_err(|error| format!("Failed to read screenshot annotation font '{}': {error}", path.display()))?,
        Source::SharedFile(path, _) => std::fs::read(path)
            .map_err(|error| format!("Failed to read screenshot annotation font '{}': {error}", path.display()))?,
    };

    let font = FontArc::try_from_vec(bytes)
        .map_err(|_| "Failed to decode the system font used for screenshot annotations.".to_string())?;
    *cache = Some(font.clone());
    Ok(font)
}

fn draw_text_with_shadow(
    image: &mut RgbaImage,
    font: &FontArc,
    scale: PxScale,
    origin: (f32, f32),
    text: &str,
    color: Rgba<u8>,
) {
    let x = origin.0.round() as i32;
    let y = origin.1.round() as i32;
    for (offset_x, offset_y) in [(1, 1), (1, 2), (2, 1), (2, 2)] {
        draw_text_mut(image, SHADOW_TEXT_COLOR, x + offset_x, y + offset_y, scale, font, text);
    }
    draw_text_mut(image, color, x, y, scale, font, text);
}

fn parse_annotation_color(value: &str) -> Option<Rgba<u8>> {
    let trimmed = value.trim().trim_start_matches('#');
    match trimmed.len() {
        6 => {
            let rgb = u32::from_str_radix(trimmed, 16).ok()?;
            Some(Rgba([
                ((rgb >> 16) & 0xFF) as u8,
                ((rgb >> 8) & 0xFF) as u8,
                (rgb & 0xFF) as u8,
                255,
            ]))
        }
        8 => {
            let rgba = u32::from_str_radix(trimmed, 16).ok()?;
            Some(Rgba([
                ((rgba >> 24) & 0xFF) as u8,
                ((rgba >> 16) & 0xFF) as u8,
                ((rgba >> 8) & 0xFF) as u8,
                (rgba & 0xFF) as u8,
            ]))
        }
        _ => None,
    }
}

fn draw_rectangle_outline(
    image: &mut RgbaImage,
    start: (f32, f32),
    end: (f32, f32),
    thickness: f32,
    color: Rgba<u8>,
) {
    let left = start.0.min(end.0);
    let top = start.1.min(end.1);
    let right = start.0.max(end.0);
    let bottom = start.1.max(end.1);

    draw_thick_line(image, (left, top), (right, top), thickness, color);
    draw_thick_line(image, (right, top), (right, bottom), thickness, color);
    draw_thick_line(image, (right, bottom), (left, bottom), thickness, color);
    draw_thick_line(image, (left, bottom), (left, top), thickness, color);
}

fn draw_arrow(
    image: &mut RgbaImage,
    start: (f32, f32),
    end: (f32, f32),
    thickness: f32,
    color: Rgba<u8>,
) {
    let dx = end.0 - start.0;
    let dy = end.1 - start.1;
    let length = (dx * dx + dy * dy).sqrt();
    if length < 2.0 {
        return;
    }

    draw_thick_line(image, start, end, thickness, color);

    let angle = dy.atan2(dx);
    let head_length = thickness.max(3.0) * 4.0;
    let left = (
        end.0 - head_length * (angle - std::f32::consts::FRAC_PI_6).cos(),
        end.1 - head_length * (angle - std::f32::consts::FRAC_PI_6).sin(),
    );
    let right = (
        end.0 - head_length * (angle + std::f32::consts::FRAC_PI_6).cos(),
        end.1 - head_length * (angle + std::f32::consts::FRAC_PI_6).sin(),
    );

    draw_thick_line(image, end, left, thickness, color);
    draw_thick_line(image, end, right, thickness, color);
}

fn draw_thick_line(
    image: &mut RgbaImage,
    start: (f32, f32),
    end: (f32, f32),
    thickness: f32,
    color: Rgba<u8>,
) {
    let radius = ((thickness.max(MIN_ANNOTATION_LINE_WIDTH)) / 2.0).ceil() as i32;
    let dx = end.0 - start.0;
    let dy = end.1 - start.1;
    let length = dx.abs().max(dy.abs()).ceil() as i32;
    if length <= 0 {
        draw_filled_circle_mut(image, (start.0.round() as i32, start.1.round() as i32), radius, color);
        return;
    }

    draw_line_segment_mut(image, start, end, color);
    for step in 0..=length {
        let factor = step as f32 / length as f32;
        let x = start.0 + dx * factor;
        let y = start.1 + dy * factor;
        draw_filled_circle_mut(image, (x.round() as i32, y.round() as i32), radius, color);
    }
}

fn clamp_point(x: f32, y: f32, width: u32, height: u32) -> (f32, f32) {
    let max_x = width.saturating_sub(1) as f32;
    let max_y = height.saturating_sub(1) as f32;
    (x.clamp(0.0, max_x), y.clamp(0.0, max_y))
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

/// Returns the raw Win32 HWND for our overlay window.
/// Returns None on non-Windows or if the handle cannot be retrieved.
#[cfg(target_os = "windows")]
fn get_overlay_hwnd(window: &tauri::WebviewWindow) -> Option<HWND> {
    use raw_window_handle::HasWindowHandle;
    use raw_window_handle::RawWindowHandle;

    if let Ok(handle) = window.window_handle() {
        if let RawWindowHandle::Win32(handle) = handle.as_raw() {
            return Some(handle.hwnd.get() as HWND);
        }
    }

    None
}

#[cfg(target_os = "windows")]
fn exclude_overlay_from_capture(window: &tauri::WebviewWindow) -> bool {
    if let Some(hwnd) = get_overlay_hwnd(window) {
        unsafe {
            let _ = SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE);
        }
        std::thread::sleep(Duration::from_millis(33));
    }

    false
}

#[cfg(target_os = "windows")]
fn restore_overlay_capture(window: &tauri::WebviewWindow, _restore_visibility: bool) {
    if let Some(hwnd) = get_overlay_hwnd(window) {
        unsafe {
            let _ = SetWindowDisplayAffinity(hwnd, WDA_NONE);
        }
    }
}

#[cfg(not(target_os = "windows"))]
fn exclude_overlay_from_capture(window: &tauri::WebviewWindow) -> bool {
    let should_restore = window.is_visible().unwrap_or(false);
    if should_restore {
        let _ = window.hide();
        std::thread::sleep(Duration::from_millis(NON_WINDOWS_CAPTURE_HIDE_DELAY_MS));
    }
    should_restore
}

#[cfg(not(target_os = "windows"))]
fn restore_overlay_capture(window: &tauri::WebviewWindow, restore_visibility: bool) {
    if restore_visibility {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[cfg(test)]
mod tests {
    use super::{
        build_preview_image, create_capture_id, crop_capture_image, encode_png, load_capture_image,
        resize_image_to_fit, sanitize_file_prefix, save_rgba_image, store_capture_image,
        validate_capture_region, validate_crop_region, validate_thumbnail_bounds, ScreenshotAnnotation,
        ScreenshotRegion, MAX_CAPTURE_CACHE_ENTRIES, MAX_PREVIEW_HEIGHT, MAX_PREVIEW_WIDTH,
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

    #[test]
    fn crop_capture_image_uses_selection_region() {
        let mut image = RgbaImage::from_pixel(20, 20, Rgba([0, 0, 0, 255]));
        image.put_pixel(10, 10, Rgba([255, 0, 0, 255]));

        let region = ScreenshotRegion {
            x: 8,
            y: 8,
            width: 4,
            height: 4,
        };
        let cropped = crop_capture_image(&image, region.x, region.y, region.width, region.height)
            .expect("crop selection");

        assert_eq!(cropped.width(), 4);
        assert_eq!(cropped.height(), 4);
        assert_eq!(cropped.get_pixel(2, 2), &Rgba([255, 0, 0, 255]));
    }

    #[test]
    fn rectangle_annotations_mark_the_expected_pixels() {
        let mut image = RgbaImage::from_pixel(40, 40, Rgba([0, 0, 0, 255]));
        let annotations = vec![ScreenshotAnnotation::Rect {
            x1: 10.0,
            y1: 12.0,
            x2: 30.0,
            y2: 24.0,
            color: "#ff0000".to_string(),
            lw: 3.0,
        }];

        super::render_annotations(&mut image, &annotations).expect("render annotations");

        assert_eq!(image.get_pixel(10, 12), &Rgba([255, 0, 0, 255]));
        assert_eq!(image.get_pixel(20, 12), &Rgba([255, 0, 0, 255]));
    }
}
