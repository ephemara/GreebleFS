use std::borrow::Cow;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::UNIX_EPOCH;

use arboard::{Clipboard, ImageData};
use image::imageops::crop_imm;
use image::{ImageReader, RgbaImage};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

const SCREENSHOT_STAGE_DIR: &str = "screenshot-staging";

static SCREENSHOT_STAGE_SEQUENCE: AtomicU64 = AtomicU64::new(1);

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type)]
pub struct SavedScreenshot {
    pub path: String,
    pub file_name: String,
    pub created_at: u128,
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
pub struct ScreenshotStage {
    pub path: String,
    pub image_width: u32,
    pub image_height: u32,
}

#[tauri::command]
#[specta::specta]
pub async fn screenshot_prepare_image_stage(
    app: AppHandle,
    path: String,
    crop: Option<ScreenshotRegion>,
) -> Result<ScreenshotStage, String> {
    let source_path = PathBuf::from(&path);
    if !source_path.exists() {
        return Err(format!(
            "Screenshot source '{}' does not exist.",
            source_path.display()
        ));
    }

    let stage_root = resolve_screenshot_stage_root(&app)?;
    let stage_path = create_screenshot_stage_path(&stage_root, &source_path)?;

    if let Some(region) = crop {
        validate_capture_region(region.width, region.height)?;

        let source_image = read_image_from_disk(&source_path)?;
        validate_crop_region(
            &source_image,
            region.x,
            region.y,
            region.width,
            region.height,
        )?;

        let cropped = crop_imm(
            &source_image,
            region.x,
            region.y,
            region.width,
            region.height,
        )
        .to_image();
        cropped.save(&stage_path).map_err(|error| {
            format!(
                "Failed to write cropped screenshot stage '{}': {error}",
                stage_path.display()
            )
        })?;

        return Ok(ScreenshotStage {
            path: stage_path.to_string_lossy().into_owned(),
            image_width: cropped.width(),
            image_height: cropped.height(),
        });
    }

    fs::copy(&source_path, &stage_path).map_err(|error| {
        format!(
            "Failed to copy screenshot stage from '{}' to '{}': {error}",
            source_path.display(),
            stage_path.display()
        )
    })?;

    let (image_width, image_height) = image::image_dimensions(&source_path).map_err(|error| {
        format!(
            "Failed to measure screenshot stage source '{}': {error}",
            source_path.display()
        )
    })?;

    Ok(ScreenshotStage {
        path: stage_path.to_string_lossy().into_owned(),
        image_width,
        image_height,
    })
}

#[tauri::command]
#[specta::specta]
pub async fn screenshot_finalize_image(
    path: String,
    directory: String,
    file_prefix: Option<String>,
    copy_to_clipboard: Option<bool>,
) -> Result<SavedScreenshot, String> {
    let source_path = PathBuf::from(&path);
    if !source_path.exists() {
        return Err(format!(
            "Screenshot stage '{}' does not exist.",
            source_path.display()
        ));
    }

    let created_at = current_timestamp_millis()?;
    let prefix = sanitize_file_prefix(file_prefix.as_deref());
    let file_extension = sanitize_file_extension(
        source_path
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or("png"),
    );

    let output_directory = PathBuf::from(&directory);
    fs::create_dir_all(&output_directory).map_err(|error| {
        format!(
            "Failed to create screenshot output directory '{}': {error}",
            output_directory.display()
        )
    })?;

    let file_name = format!("{prefix}-{created_at}.{file_extension}");
    let output_path = output_directory.join(&file_name);
    fs::copy(&source_path, &output_path).map_err(|error| {
        format!(
            "Failed to finalize screenshot from '{}' to '{}': {error}",
            source_path.display(),
            output_path.display()
        )
    })?;

    if copy_to_clipboard.unwrap_or(false) {
        let image = read_image_from_disk(&source_path)?;
        copy_rgba_image_to_clipboard(image)?;
    }

    Ok(SavedScreenshot {
        path: output_path.to_string_lossy().into_owned(),
        file_name,
        created_at,
    })
}

#[tauri::command]
#[specta::specta]
pub async fn screenshot_copy_image_to_clipboard(path: String) -> Result<(), String> {
    let image = read_image_from_disk(Path::new(&path))?;
    copy_rgba_image_to_clipboard(image)
}

#[tauri::command]
#[specta::specta]
pub async fn screenshot_delete_image_stage(app: AppHandle, path: String) -> Result<(), String> {
    let stage_root = resolve_screenshot_stage_root(&app)?;
    let candidate_path = PathBuf::from(&path);
    if !candidate_path.exists() {
        return Ok(());
    }

    let canonical_stage_root = stage_root.canonicalize().map_err(|error| {
        format!(
            "Failed to resolve screenshot stage directory '{}': {error}",
            stage_root.display()
        )
    })?;
    let canonical_candidate = candidate_path.canonicalize().map_err(|error| {
        format!(
            "Failed to resolve screenshot stage path '{}': {error}",
            candidate_path.display()
        )
    })?;

    if !canonical_candidate.starts_with(&canonical_stage_root) {
        return Err(format!(
            "Refusing to delete screenshot stage outside '{}'.",
            canonical_stage_root.display()
        ));
    }

    fs::remove_file(&canonical_candidate).map_err(|error| {
        format!(
            "Failed to delete screenshot stage '{}': {error}",
            canonical_candidate.display()
        )
    })?;

    Ok(())
}

fn resolve_screenshot_stage_root(app: &AppHandle) -> Result<PathBuf, String> {
    let root = app
        .path()
        .app_local_data_dir()
        .map(|path| path.join(SCREENSHOT_STAGE_DIR))
        .map_err(|error| format!("Failed to resolve app local data directory: {error}"))?;

    fs::create_dir_all(&root).map_err(|error| {
        format!(
            "Failed to create screenshot stage directory '{}': {error}",
            root.display()
        )
    })?;

    Ok(root)
}

fn create_screenshot_stage_path(stage_root: &Path, source_path: &Path) -> Result<PathBuf, String> {
    let created_at = current_timestamp_millis()?;
    let sequence = SCREENSHOT_STAGE_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    let file_stem = sanitize_file_stem(
        source_path
            .file_stem()
            .and_then(|value| value.to_str())
            .unwrap_or("capture"),
    );
    let file_extension = sanitize_file_extension(
        source_path
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or("png"),
    );

    Ok(stage_root.join(format!(
        "{file_stem}-{created_at}-{sequence}.{file_extension}"
    )))
}

fn read_image_from_disk(path: &Path) -> Result<RgbaImage, String> {
    ImageReader::open(path)
        .map_err(|error| format!("Failed to open screenshot '{}': {error}", path.display()))?
        .decode()
        .map_err(|error| format!("Failed to decode screenshot '{}': {error}", path.display()))
        .map(|image| image.to_rgba8())
}

fn copy_rgba_image_to_clipboard(image: RgbaImage) -> Result<(), String> {
    let image_width = image.width() as usize;
    let image_height = image.height() as usize;
    let image_data = image.into_raw();
    let clipboard_image = ImageData {
        width: image_width,
        height: image_height,
        bytes: Cow::Owned(image_data),
    };

    let mut clipboard =
        Clipboard::new().map_err(|error| format!("Failed to access system clipboard: {error}"))?;
    clipboard
        .set_image(clipboard_image)
        .map_err(|error| format!("Failed to copy screenshot image to clipboard: {error}"))
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

fn validate_crop_region(
    image: &RgbaImage,
    x: u32,
    y: u32,
    width: u32,
    height: u32,
) -> Result<(), String> {
    let image_width = image.width();
    let image_height = image.height();
    if x >= image_width || y >= image_height {
        return Err(format!(
            "Selection origin falls outside the captured image bounds (image: {}x{}, requested origin: {}, {}).",
            image_width, image_height, x, y
        ));
    }

    let right = x.checked_add(width).ok_or_else(|| {
        "Selection overflowed the captured image bounds while computing crop width.".to_string()
    })?;
    let bottom = y.checked_add(height).ok_or_else(|| {
        "Selection overflowed the captured image bounds while computing crop height.".to_string()
    })?;

    if right > image_width || bottom > image_height {
        return Err(format!(
            "Selection falls outside the captured image bounds (image: {}x{}, requested crop: {}, {} size: {}x{}).",
            image_width, image_height, x, y, width, height
        ));
    }

    Ok(())
}

fn current_timestamp_millis() -> Result<u128, String> {
    Ok(std::time::SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("Failed to measure current time: {error}"))?
        .as_millis())
}

fn sanitize_file_prefix(prefix: Option<&str>) -> String {
    let sanitized = prefix
        .map(|value| sanitize_token(value, "overlayterm-shot"))
        .unwrap_or_else(|| "overlayterm-shot".to_string());
    if sanitized.is_empty() {
        "overlayterm-shot".to_string()
    } else {
        sanitized
    }
}

fn sanitize_file_stem(value: &str) -> String {
    let sanitized = sanitize_token(value, "capture");
    if sanitized.is_empty() {
        "capture".to_string()
    } else {
        sanitized
    }
}

fn sanitize_file_extension(value: &str) -> String {
    let filtered: String = value
        .chars()
        .filter(|character| character.is_ascii_alphanumeric())
        .collect::<String>()
        .to_ascii_lowercase();

    if filtered.is_empty() {
        "png".to_string()
    } else {
        filtered
    }
}

fn sanitize_token(value: &str, fallback: &str) -> String {
    let sanitized = value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() {
                character.to_ascii_lowercase()
            } else if character == '-' || character == '_' {
                character
            } else {
                '-'
            }
        })
        .collect::<String>()
        .split('-')
        .filter(|segment| !segment.is_empty())
        .collect::<Vec<_>>()
        .join("-");

    if sanitized.is_empty() {
        fallback.to_string()
    } else {
        sanitized
    }
}

#[cfg(test)]
mod tests {
    use image::{Rgba, RgbaImage};

    use super::{
        sanitize_file_extension, sanitize_file_prefix, sanitize_file_stem, validate_capture_region,
        validate_crop_region,
    };

    #[test]
    fn sanitize_helpers_keep_ascii_safe_tokens() {
        assert_eq!(sanitize_file_prefix(Some("Bad Prefix!*")), "bad-prefix");
        assert_eq!(sanitize_file_stem("Stage Capture 01"), "stage-capture-01");
        assert_eq!(sanitize_file_extension("PNG?!"), "png");
    }

    #[test]
    fn validate_capture_region_rejects_zero_or_huge_values() {
        assert!(validate_capture_region(0, 10).is_err());
        assert!(validate_capture_region(10, 0).is_err());
        assert!(validate_capture_region(16_385, 10).is_err());
        assert!(validate_capture_region(10, 16_385).is_err());
        assert!(validate_capture_region(1920, 1080).is_ok());
    }

    #[test]
    fn validate_crop_region_checks_image_bounds() {
        let image = RgbaImage::from_pixel(640, 480, Rgba([0, 0, 0, 255]));
        assert!(validate_crop_region(&image, 0, 0, 640, 480).is_ok());
        assert!(validate_crop_region(&image, 639, 0, 2, 1).is_err());
        assert!(validate_crop_region(&image, 0, 479, 1, 2).is_err());
    }
}
