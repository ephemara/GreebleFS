use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use image::{DynamicImage, ImageFormat, Rgba, RgbaImage};
use log::warn;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::sync::{mpsc, Mutex, OnceLock};
use tauri::WebviewWindow;

#[cfg(target_os = "windows")]
use std::iter::once;
#[cfg(target_os = "windows")]
use std::os::windows::ffi::OsStrExt;
#[cfg(target_os = "windows")]
use std::ptr::null_mut;
#[cfg(target_os = "windows")]
use windows_sys::Win32::{
    Graphics::Gdi::{
        CreateCompatibleDC, CreateDIBSection, DeleteDC, DeleteObject, SelectObject, BITMAPINFO,
        BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS,
    },
    Storage::FileSystem::{FILE_ATTRIBUTE_DIRECTORY, FILE_ATTRIBUTE_NORMAL},
    UI::{
        Shell::{SHGetFileInfoW, SHFILEINFOW, SHGFI_ICON, SHGFI_LARGEICON, SHGFI_SMALLICON},
        WindowsAndMessaging::{DestroyIcon, DrawIconEx, DI_NORMAL},
    },
};

const DEFAULT_NATIVE_ICON_SIZE: u32 = 32;
const DRAG_PREVIEW_ICON_SIZE: u32 = 64;
const MAX_NATIVE_ICON_SIZE: u32 = 128;
const FALLBACK_APP_ICON_PNG: &[u8] = include_bytes!("../icons/icon.png");

#[derive(Debug, Deserialize, Clone, specta::Type)]
pub struct NativeIconRequest {
    pub path: String,
    pub size: Option<u32>,
}

#[derive(Debug, Serialize, Clone, specta::Type)]
pub struct NativeIconResponse {
    pub path: String,
    pub src: Option<String>,
}

#[derive(Debug, Clone)]
struct CachedNativeIcon {
    src: Option<String>,
}

static NATIVE_ICON_CACHE: OnceLock<Mutex<HashMap<String, CachedNativeIcon>>> = OnceLock::new();
static DEFAULT_DRAG_PREVIEW_PNG: OnceLock<Vec<u8>> = OnceLock::new();

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

fn icon_pixels_to_png_bytes(width: u32, height: u32, pixels: Vec<u8>) -> Result<Vec<u8>, String> {
    let image = RgbaImage::from_raw(width, height, pixels)
        .map(DynamicImage::ImageRgba8)
        .ok_or_else(|| "native icon provider returned invalid RGBA pixel data".to_string())?;
    let mut cursor = Cursor::new(Vec::new());
    image
        .write_to(&mut cursor, ImageFormat::Png)
        .map_err(|error| format!("failed to encode native icon as PNG: {error}"))?;
    Ok(cursor.into_inner())
}

fn icon_pixels_to_png_data_url(width: u32, height: u32, pixels: Vec<u8>) -> Result<String, String> {
    Ok(encode_png_data_url(icon_pixels_to_png_bytes(
        width, height, pixels,
    )?))
}

type NativeIconPixelBuffer = (u32, u32, Vec<u8>);

fn resolve_native_icon_pixels_with_provider(
    path: &Path,
    size: u32,
) -> Result<Option<NativeIconPixelBuffer>, String> {
    if !path.exists() {
        return Ok(None);
    }

    let icon = file_icon_provider::get_file_icon(path.to_path_buf(), size as u16)
        .map_err(|error| error.to_string())?;
    Ok(Some((icon.width, icon.height, icon.pixels)))
}

#[cfg(target_os = "windows")]
fn path_to_wide_null(path: &Path) -> Vec<u16> {
    path.as_os_str().encode_wide().chain(once(0)).collect()
}

#[cfg(target_os = "windows")]
fn resolve_native_icon_pixels_with_windows_shell(
    path: &Path,
    size: u32,
) -> Result<Option<NativeIconPixelBuffer>, String> {
    if !path.exists() {
        return Ok(None);
    }

    let path_wide = path_to_wide_null(path);
    let mut file_info: SHFILEINFOW = unsafe { std::mem::zeroed() };
    let icon_size = if size <= 16 {
        SHGFI_SMALLICON
    } else {
        SHGFI_LARGEICON
    };
    let file_attributes = if path.is_dir() {
        FILE_ATTRIBUTE_DIRECTORY
    } else {
        FILE_ATTRIBUTE_NORMAL
    };
    let result = unsafe {
        SHGetFileInfoW(
            path_wide.as_ptr(),
            file_attributes,
            &mut file_info,
            std::mem::size_of::<SHFILEINFOW>() as u32,
            SHGFI_ICON | icon_size,
        )
    };
    if result == 0 || file_info.hIcon == 0 {
        return Ok(None);
    }

    let hicon = file_info.hIcon;
    let hdc = unsafe { CreateCompatibleDC(0) };
    if hdc == 0 {
        unsafe {
            DestroyIcon(hicon);
        }
        return Err(
            "failed to create a compatible device context for native icon rendering".to_string(),
        );
    }

    let mut bitmap_info: BITMAPINFO = unsafe { std::mem::zeroed() };
    bitmap_info.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
    bitmap_info.bmiHeader.biWidth = size as i32;
    bitmap_info.bmiHeader.biHeight = -(size as i32);
    bitmap_info.bmiHeader.biPlanes = 1;
    bitmap_info.bmiHeader.biBitCount = 32;
    bitmap_info.bmiHeader.biCompression = BI_RGB;

    let mut pixels_ptr = null_mut();
    let hbitmap =
        unsafe { CreateDIBSection(hdc, &bitmap_info, DIB_RGB_COLORS, &mut pixels_ptr, 0, 0) };
    if hbitmap == 0 || pixels_ptr.is_null() {
        unsafe {
            DeleteDC(hdc);
            DestroyIcon(hicon);
        }
        return Err("failed to create a bitmap surface for native icon rendering".to_string());
    }

    let previous_bitmap = unsafe { SelectObject(hdc, hbitmap as _) };
    if previous_bitmap == 0 {
        unsafe {
            DeleteObject(hbitmap as _);
            DeleteDC(hdc);
            DestroyIcon(hicon);
        }
        return Err("failed to select the native icon bitmap surface".to_string());
    }

    let byte_len = (size as usize) * (size as usize) * 4;
    unsafe {
        std::ptr::write_bytes(pixels_ptr as *mut u8, 0, byte_len);
    }
    let draw_result =
        unsafe { DrawIconEx(hdc, 0, 0, hicon, size as i32, size as i32, 0, 0, DI_NORMAL) };
    let mut pixels = if draw_result == 0 {
        Vec::new()
    } else {
        unsafe { std::slice::from_raw_parts(pixels_ptr as *const u8, byte_len).to_vec() }
    };

    unsafe {
        SelectObject(hdc, previous_bitmap);
        DeleteObject(hbitmap as _);
        DeleteDC(hdc);
        DestroyIcon(hicon);
    }

    if draw_result == 0 {
        return Err("failed to rasterize native Windows icon".to_string());
    }

    for chunk in pixels.chunks_exact_mut(4) {
        chunk.swap(0, 2);
    }

    Ok(Some((size, size, pixels)))
}

fn resolve_native_icon_pixels(
    path: &Path,
    size: u32,
) -> Result<Option<NativeIconPixelBuffer>, String> {
    #[cfg(target_os = "windows")]
    {
        match resolve_native_icon_pixels_with_windows_shell(path, size) {
            Ok(Some(icon)) => return Ok(Some(icon)),
            Ok(None) => {}
            Err(error) => {
                warn!(
                    "GreebleFS: Windows shell icon extraction failed for {}: {}",
                    path.display(),
                    error
                );
            }
        }
    }

    match resolve_native_icon_pixels_with_provider(path, size) {
        Ok(icon) => Ok(icon),
        Err(error) => {
            warn!(
                "GreebleFS: file_icon_provider failed for {}: {}",
                path.display(),
                error
            );
            Ok(None)
        }
    }
}

fn resolve_native_icon_png_bytes(path: &Path, size: u32) -> Result<Option<Vec<u8>>, String> {
    let Some((width, height, pixels)) = resolve_native_icon_pixels(path, size)? else {
        return Ok(None);
    };
    let png = icon_pixels_to_png_bytes(width, height, pixels)?;
    Ok(Some(png))
}

fn resolve_native_icon_for_path(path: &Path, size: u32) -> Result<Option<String>, String> {
    let Some((width, height, pixels)) = resolve_native_icon_pixels(path, size)? else {
        return Ok(None);
    };
    let src = icon_pixels_to_png_data_url(width, height, pixels)?;
    Ok(Some(src))
}

fn put_pixel_if_in_bounds(image: &mut RgbaImage, x: i32, y: i32, color: Rgba<u8>) {
    if x < 0 || y < 0 {
        return;
    }

    let x = x as u32;
    let y = y as u32;
    if x < image.width() && y < image.height() {
        image.put_pixel(x, y, color);
    }
}

fn fill_rect(image: &mut RgbaImage, left: u32, top: u32, right: u32, bottom: u32, color: Rgba<u8>) {
    let clamped_right = right.min(image.width());
    let clamped_bottom = bottom.min(image.height());
    for y in top.min(clamped_bottom)..clamped_bottom {
        for x in left.min(clamped_right)..clamped_right {
            image.put_pixel(x, y, color);
        }
    }
}

fn build_default_drag_preview_png() -> Result<Vec<u8>, String> {
    // Render a neutral file glyph so fallback drag ghosts do not reuse the app icon.
    let mut image = RgbaImage::from_pixel(64, 64, Rgba([0, 0, 0, 0]));
    let shadow = Rgba([0, 0, 0, 48]);
    let body = Rgba([243, 246, 252, 255]);
    let body_outline = Rgba([104, 114, 132, 255]);
    let fold = Rgba([221, 228, 240, 255]);
    let accent = Rgba([73, 151, 255, 255]);
    let text = Rgba([141, 152, 171, 255]);

    fill_rect(&mut image, 17, 15, 51, 55, shadow);
    fill_rect(&mut image, 15, 11, 49, 51, body);

    for x in 15..49 {
        put_pixel_if_in_bounds(&mut image, x as i32, 11, body_outline);
        put_pixel_if_in_bounds(&mut image, x as i32, 50, body_outline);
    }
    for y in 11..51 {
        put_pixel_if_in_bounds(&mut image, 15, y as i32, body_outline);
        put_pixel_if_in_bounds(&mut image, 48, y as i32, body_outline);
    }

    for y in 11..24 {
        for x in 35..49 {
            if (x - 35) + (y - 11) >= 13 {
                put_pixel_if_in_bounds(&mut image, x as i32, y as i32, fold);
            }
        }
    }

    for x in 36..49 {
        put_pixel_if_in_bounds(&mut image, x as i32, 11, body_outline);
    }
    for y in 11..24 {
        put_pixel_if_in_bounds(&mut image, 48, y as i32, body_outline);
    }
    for offset in 0..13 {
        put_pixel_if_in_bounds(
            &mut image,
            (35 + offset) as i32,
            (11 + offset) as i32,
            body_outline,
        );
    }

    fill_rect(&mut image, 19, 18, 41, 23, accent);
    fill_rect(&mut image, 19, 29, 40, 31, text);
    fill_rect(&mut image, 19, 36, 35, 38, text);
    fill_rect(&mut image, 19, 43, 31, 45, text);

    let mut cursor = Cursor::new(Vec::new());
    DynamicImage::ImageRgba8(image)
        .write_to(&mut cursor, ImageFormat::Png)
        .map_err(|error| format!("failed to encode default drag preview PNG: {error}"))?;
    Ok(cursor.into_inner())
}

fn default_drag_preview_png() -> &'static [u8] {
    DEFAULT_DRAG_PREVIEW_PNG
        .get_or_init(|| {
            build_default_drag_preview_png().unwrap_or_else(|_| FALLBACK_APP_ICON_PNG.to_vec())
        })
        .as_slice()
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

    let preview_icon = drag_paths
        .first()
        .and_then(|path| {
            resolve_native_icon_png_bytes(path, DRAG_PREVIEW_ICON_SIZE)
                .ok()
                .flatten()
        })
        .map(drag::Image::Raw)
        .unwrap_or_else(|| drag::Image::Raw(default_drag_preview_png().to_vec()));
    let drag_item = drag::DragItem::Files(drag_paths);

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
#[specta::specta]
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
#[specta::specta]
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
    fn build_default_drag_preview_png_returns_png_bytes() {
        let png = build_default_drag_preview_png().unwrap();
        assert!(png.starts_with(&[0x89, b'P', b'N', b'G']));
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
