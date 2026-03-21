use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use image::{DynamicImage, ImageFormat, RgbaImage};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::sync::{mpsc, Mutex, OnceLock};
use tauri::WebviewWindow;

const DEFAULT_NATIVE_ICON_SIZE: u32 = 32;
const MAX_NATIVE_ICON_SIZE: u32 = 128;
const DRAG_PREVIEW_PNG: &[u8] = include_bytes!("../icons/icon.png");

#[derive(Debug, Deserialize, Clone)]
pub struct NativeIconRequest {
    pub path: String,
    pub size: Option<u32>,
}

#[derive(Debug, Serialize, Clone)]
pub struct NativeIconResponse {
    pub path: String,
    pub src: Option<String>,
}

#[derive(Debug, Clone)]
struct CachedNativeIcon {
    src: Option<String>,
}

static NATIVE_ICON_CACHE: OnceLock<Mutex<HashMap<String, CachedNativeIcon>>> = OnceLock::new();

fn native_icon_cache() -> &'static Mutex<HashMap<String, CachedNativeIcon>> {
    NATIVE_ICON_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn normalize_icon_size(size: Option<u32>) -> u32 {
    size.unwrap_or(DEFAULT_NATIVE_ICON_SIZE)
        .clamp(16, MAX_NATIVE_ICON_SIZE)
}

fn build_icon_cache_key(path: &Path, size: u32) -> String {
    format!("{}::{size}", path.to_string_lossy().to_lowercase())
}

fn encode_png_data_url(bytes: Vec<u8>) -> String {
    format!("data:image/png;base64,{}", BASE64_STANDARD.encode(bytes))
}

fn icon_pixels_to_png_data_url(width: u32, height: u32, pixels: Vec<u8>) -> Result<String, String> {
    let image = RgbaImage::from_raw(width, height, pixels)
        .map(DynamicImage::ImageRgba8)
        .ok_or_else(|| "native icon provider returned invalid RGBA pixel data".to_string())?;
    let mut cursor = Cursor::new(Vec::new());
    image
        .write_to(&mut cursor, ImageFormat::Png)
        .map_err(|error| format!("failed to encode native icon as PNG: {error}"))?;
    Ok(encode_png_data_url(cursor.into_inner()))
}

fn resolve_native_icon_for_path(path: &Path, size: u32) -> Result<Option<String>, String> {
    if !path.exists() {
        return Ok(None);
    }

    let icon = file_icon_provider::get_file_icon(path.to_path_buf(), size as u16)
        .map_err(|error| error.to_string())?;
    let src = icon_pixels_to_png_data_url(icon.width, icon.height, icon.pixels)?;
    Ok(Some(src))
}

fn resolve_native_icons_batch(requests: Vec<NativeIconRequest>) -> Vec<NativeIconResponse> {
    let mut responses = Vec::with_capacity(requests.len());

    for request in requests {
        let path = PathBuf::from(&request.path);
        let size = normalize_icon_size(request.size);
        let cache_key = build_icon_cache_key(&path, size);

        let cached = native_icon_cache()
            .lock()
            .ok()
            .and_then(|cache| cache.get(&cache_key).cloned());
        if let Some(entry) = cached {
            responses.push(NativeIconResponse {
                path: request.path,
                src: entry.src,
            });
            continue;
        }

        let src = resolve_native_icon_for_path(&path, size).unwrap_or(None);
        if let Ok(mut cache) = native_icon_cache().lock() {
            cache.insert(cache_key, CachedNativeIcon { src: src.clone() });
        }

        responses.push(NativeIconResponse {
            path: request.path,
            src,
        });
    }

    responses
}

fn run_on_window_main_thread<T, F>(window: &WebviewWindow, task: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce() -> T + Send + 'static,
{
    let (sender, receiver) = mpsc::sync_channel(1);
    window
        .run_on_main_thread(move || {
            let _ = sender.send(task());
        })
        .map_err(|error| error.to_string())?;
    receiver
        .recv()
        .map_err(|error| format!("failed to receive main-thread task result: {error}"))
}

fn collect_drag_paths(paths: Vec<String>) -> Vec<PathBuf> {
    paths
        .into_iter()
        .filter_map(|path| {
            let trimmed = path.trim();
            if trimmed.is_empty() {
                return None;
            }

            let candidate = PathBuf::from(trimmed);
            if !candidate.exists() {
                return None;
            }

            std::fs::canonicalize(&candidate).ok().or(Some(candidate))
        })
        .collect()
}

fn start_native_drag_impl(window: WebviewWindow, drag_paths: Vec<PathBuf>) -> Result<(), String> {
    if drag_paths.is_empty() {
        return Ok(());
    }

    let drag_item = drag::DragItem::Files(drag_paths);
    let preview_icon = drag::Image::Raw(DRAG_PREVIEW_PNG.to_vec());

    #[cfg(target_os = "linux")]
    {
        let gtk_window = window.gtk_window().map_err(|error| error.to_string())?;
        drag::start_drag(
            &gtk_window,
            drag_item,
            preview_icon,
            |_result, _cursor_position| {},
            drag::Options::default(),
        )
        .map_err(|error| error.to_string())
    }

    #[cfg(not(target_os = "linux"))]
    {
        drag::start_drag(
            &window,
            drag_item,
            preview_icon,
            |_result, _cursor_position| {},
            drag::Options::default(),
        )
        .map_err(|error| error.to_string())
    }
}

#[tauri::command]
pub fn fs_resolve_native_icons(
    window: WebviewWindow,
    requests: Vec<NativeIconRequest>,
) -> Result<Vec<NativeIconResponse>, String> {
    if requests.is_empty() {
        return Ok(Vec::new());
    }

    run_on_window_main_thread(&window, move || resolve_native_icons_batch(requests))
}

#[tauri::command]
pub fn fs_start_native_file_drag(window: WebviewWindow, paths: Vec<String>) -> Result<(), String> {
    let drag_paths = collect_drag_paths(paths);
    if drag_paths.is_empty() {
        return Ok(());
    }

    let drag_window = window.clone();
    run_on_window_main_thread(&window, move || {
        start_native_drag_impl(drag_window, drag_paths)
    })?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn normalize_icon_size_uses_default_and_clamps_to_supported_range() {
        assert_eq!(normalize_icon_size(None), DEFAULT_NATIVE_ICON_SIZE);
        assert_eq!(normalize_icon_size(Some(8)), 16);
        assert_eq!(normalize_icon_size(Some(48)), 48);
        assert_eq!(normalize_icon_size(Some(512)), MAX_NATIVE_ICON_SIZE);
    }

    #[test]
    fn build_icon_cache_key_is_case_insensitive_but_size_specific() {
        let lower = build_icon_cache_key(Path::new("C:\\Temp\\demo.txt"), 32);
        let upper = build_icon_cache_key(Path::new("c:\\temp\\DEMO.TXT"), 32);
        let larger = build_icon_cache_key(Path::new("c:\\temp\\demo.txt"), 64);

        assert_eq!(lower, upper);
        assert_ne!(lower, larger);
    }

    #[test]
    fn icon_pixels_to_png_data_url_rejects_invalid_rgba_buffers() {
        let error = icon_pixels_to_png_data_url(2, 2, vec![255, 0, 0]).unwrap_err();
        assert!(error.contains("invalid RGBA"));
    }

    #[test]
    fn icon_pixels_to_png_data_url_encodes_valid_png_data_urls() {
        let data_url = icon_pixels_to_png_data_url(1, 1, vec![255, 0, 0, 255]).unwrap();
        assert!(data_url.starts_with("data:image/png;base64,"));
    }

    #[test]
    fn resolve_native_icon_for_missing_paths_returns_none() {
        let temp = tempdir().unwrap();
        let missing = temp.path().join("missing.txt");

        let result = resolve_native_icon_for_path(&missing, 32).unwrap();
        assert_eq!(result, None);
    }

    #[test]
    fn collect_drag_paths_filters_blank_and_missing_entries() {
        let temp = tempdir().unwrap();
        let nested = temp.path().join("nested");
        fs::create_dir_all(&nested).unwrap();
        let file_path = nested.join("demo.txt");
        fs::write(&file_path, "demo").unwrap();

        let drag_paths = collect_drag_paths(vec![
            String::new(),
            "   ".to_string(),
            "C:\\definitely-missing-overlayterm-path".to_string(),
            format!("  {}  ", file_path.display()),
        ]);

        assert_eq!(drag_paths.len(), 1);
        assert!(drag_paths[0].is_absolute());
        assert!(drag_paths[0].ends_with("demo.txt"));
    }
}
