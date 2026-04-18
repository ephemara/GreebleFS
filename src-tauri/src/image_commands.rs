use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use image::imageops::{resize, FilterType};
use image::{DynamicImage, ImageFormat, ImageReader, Rgba, RgbaImage};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use tauri::State;

const IMAGE_EDITOR_PREVIEW_MAX_DIMENSION: u32 = 2048;

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ImageAdjustmentState {
    pub brightness: f32,
    pub contrast: f32,
    pub saturation: f32,
    pub temperature: f32,
    pub highlights: f32,
    pub shadows: f32,
    pub vignette: f32,
}

impl Default for ImageAdjustmentState {
    fn default() -> Self {
        Self {
            brightness: 0.0,
            contrast: 0.0,
            saturation: 0.0,
            temperature: 0.0,
            highlights: 0.0,
            shadows: 0.0,
            vignette: 0.0,
        }
    }
}

impl ImageAdjustmentState {
    fn normalized(self) -> Self {
        Self {
            brightness: self.brightness.clamp(-100.0, 100.0),
            contrast: self.contrast.clamp(-100.0, 100.0),
            saturation: self.saturation.clamp(-100.0, 100.0),
            temperature: self.temperature.clamp(-100.0, 100.0),
            highlights: self.highlights.clamp(-100.0, 100.0),
            shadows: self.shadows.clamp(-100.0, 100.0),
            vignette: self.vignette.clamp(0.0, 100.0),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum ImageFilterPresetId {
    Original,
    Mono,
    Noir,
    Fade,
    Chrome,
    Warm,
    Cool,
    Vivid,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ImageFilterPresetDefinition {
    pub id: ImageFilterPresetId,
    pub label: String,
    pub state: ImageAdjustmentState,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ImageEditorSessionCreateRequest {
    pub input_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ImageEditorSessionBootstrap {
    pub session_id: String,
    pub preview_data_url: String,
    pub output_content_type: String,
    pub source_width: u32,
    pub source_height: u32,
    pub saved_state: ImageAdjustmentState,
    pub presets: Vec<ImageFilterPresetDefinition>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ImageEditorPreviewRequest {
    pub session_id: String,
    pub preset_id: Option<ImageFilterPresetId>,
    pub adjustments: ImageAdjustmentState,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ImageEditorPreviewResult {
    pub session_id: String,
    pub preview_data_url: String,
    pub rendered_width: u32,
    pub rendered_height: u32,
    pub effective_state: ImageAdjustmentState,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ImageEditorExportRequest {
    pub session_id: String,
    pub preset_id: Option<ImageFilterPresetId>,
    pub adjustments: ImageAdjustmentState,
    pub output_content_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ImageEditorExportResult {
    pub session_id: String,
    pub image_bytes: Vec<u8>,
    pub baked_image_data_url: String,
    pub content_type: String,
    pub rendered_width: u32,
    pub rendered_height: u32,
    pub effective_state: ImageAdjustmentState,
}

#[derive(Clone, Default)]
pub struct ImageEditorManager {
    inner: Arc<ImageEditorManagerInner>,
}

#[derive(Default)]
struct ImageEditorManagerInner {
    next_session_id: AtomicU64,
    sessions: Mutex<HashMap<String, ImageEditorSession>>,
}

#[derive(Clone)]
struct ImageEditorSession {
    original_image: RgbaImage,
    output_content_type: String,
    saved_state: ImageAdjustmentState,
}

#[tauri::command]
#[specta::specta]
pub async fn image_editor_create_session(
    manager: State<'_, ImageEditorManager>,
    request: ImageEditorSessionCreateRequest,
) -> Result<ImageEditorSessionBootstrap, String> {
    let manager = manager.inner().clone();
    tauri::async_runtime::spawn_blocking(move || manager.create_session(request))
        .await
        .map_err(|error| format!("Image editor session bootstrap task failed to join: {error}"))?
}

#[tauri::command]
#[specta::specta]
pub async fn image_editor_render_preview(
    manager: State<'_, ImageEditorManager>,
    request: ImageEditorPreviewRequest,
) -> Result<ImageEditorPreviewResult, String> {
    let manager = manager.inner().clone();
    tauri::async_runtime::spawn_blocking(move || manager.render_preview(request))
        .await
        .map_err(|error| format!("Image editor preview task failed to join: {error}"))?
}

#[tauri::command]
#[specta::specta]
pub async fn image_editor_export(
    manager: State<'_, ImageEditorManager>,
    request: ImageEditorExportRequest,
) -> Result<ImageEditorExportResult, String> {
    let manager = manager.inner().clone();
    tauri::async_runtime::spawn_blocking(move || manager.export_baked_image(request))
        .await
        .map_err(|error| format!("Image editor export task failed to join: {error}"))?
}

#[tauri::command]
#[specta::specta]
pub fn image_editor_close_session(
    manager: State<'_, ImageEditorManager>,
    session_id: String,
) -> Result<(), String> {
    manager.close_session(session_id)
}

impl ImageEditorManager {
    fn create_session(
        &self,
        request: ImageEditorSessionCreateRequest,
    ) -> Result<ImageEditorSessionBootstrap, String> {
        let input_path = normalize_image_editor_source_path(&request.input_path)?;
        let output_content_type = resolve_supported_image_content_type(&input_path)?;
        let original_image = read_image_file_as_rgba(&input_path)?;
        let session_id = format!(
            "image-edit-{}",
            self.inner.next_session_id.fetch_add(1, Ordering::Relaxed) + 1
        );
        let session = ImageEditorSession {
            original_image: original_image.clone(),
            output_content_type: output_content_type.clone(),
            saved_state: ImageAdjustmentState::default(),
        };
        let preview_image = resize_image_to_fit(
            &original_image,
            IMAGE_EDITOR_PREVIEW_MAX_DIMENSION,
            IMAGE_EDITOR_PREVIEW_MAX_DIMENSION,
        );
        let preview_data_url = png_bytes_to_data_url(&encode_image_bytes(&preview_image, "image/png")?);
        let source_width = original_image.width();
        let source_height = original_image.height();

        self.inner
            .sessions
            .lock()
            .map_err(|_| "Image editor session map was poisoned.".to_string())?
            .insert(session_id.clone(), session);

        Ok(ImageEditorSessionBootstrap {
            session_id,
            preview_data_url,
            output_content_type,
            source_width,
            source_height,
            saved_state: ImageAdjustmentState::default(),
            presets: image_filter_preset_definitions(),
        })
    }

    fn render_preview(
        &self,
        request: ImageEditorPreviewRequest,
    ) -> Result<ImageEditorPreviewResult, String> {
        let session = self.get_session(&request.session_id)?;
        let effective_state =
            compose_effective_adjustment_state(request.preset_id, request.adjustments);
        let preview_source = resize_image_to_fit(
            &session.original_image,
            IMAGE_EDITOR_PREVIEW_MAX_DIMENSION,
            IMAGE_EDITOR_PREVIEW_MAX_DIMENSION,
        );
        let rendered_image = apply_image_adjustments(&preview_source, &effective_state);
        let preview_data_url = png_bytes_to_data_url(&encode_image_bytes(&rendered_image, "image/png")?);

        Ok(ImageEditorPreviewResult {
            session_id: request.session_id,
            preview_data_url,
            rendered_width: rendered_image.width(),
            rendered_height: rendered_image.height(),
            effective_state,
        })
    }

    fn export_baked_image(
        &self,
        request: ImageEditorExportRequest,
    ) -> Result<ImageEditorExportResult, String> {
        let session = self.get_session(&request.session_id)?;
        let effective_state =
            compose_effective_adjustment_state(request.preset_id, request.adjustments);
        let content_type = request
            .output_content_type
            .as_deref()
            .map(normalize_content_type)
            .transpose()?
            .unwrap_or_else(|| session.output_content_type.clone());
        let rendered_image = apply_image_adjustments(&session.original_image, &effective_state);
        let image_bytes = encode_image_bytes(&rendered_image, &content_type)?;
        let baked_image_data_url =
            png_bytes_to_data_url(&encode_image_bytes(&rendered_image, "image/png")?);

        self.update_saved_state(&request.session_id, effective_state)?;

        Ok(ImageEditorExportResult {
            session_id: request.session_id,
            image_bytes,
            baked_image_data_url,
            content_type,
            rendered_width: rendered_image.width(),
            rendered_height: rendered_image.height(),
            effective_state,
        })
    }

    fn close_session(&self, session_id: String) -> Result<(), String> {
        self.inner
            .sessions
            .lock()
            .map_err(|_| "Image editor session map was poisoned.".to_string())?
            .remove(session_id.as_str());
        Ok(())
    }

    fn get_session(&self, session_id: &str) -> Result<ImageEditorSession, String> {
        self.inner
            .sessions
            .lock()
            .map_err(|_| "Image editor session map was poisoned.".to_string())?
            .get(session_id)
            .cloned()
            .ok_or_else(|| format!("Image editor session was not found: {session_id}"))
    }

    fn update_saved_state(
        &self,
        session_id: &str,
        saved_state: ImageAdjustmentState,
    ) -> Result<(), String> {
        let mut sessions = self
            .inner
            .sessions
            .lock()
            .map_err(|_| "Image editor session map was poisoned.".to_string())?;
        let session = sessions
            .get_mut(session_id)
            .ok_or_else(|| format!("Image editor session was not found: {session_id}"))?;
        session.saved_state = saved_state;
        Ok(())
    }
}

fn image_filter_preset_definitions() -> Vec<ImageFilterPresetDefinition> {
    [
        (ImageFilterPresetId::Original, "Original", ImageAdjustmentState::default()),
        (
            ImageFilterPresetId::Mono,
            "Mono",
            ImageAdjustmentState {
                saturation: -100.0,
                contrast: 10.0,
                highlights: 8.0,
                ..ImageAdjustmentState::default()
            },
        ),
        (
            ImageFilterPresetId::Noir,
            "Noir",
            ImageAdjustmentState {
                saturation: -100.0,
                contrast: 28.0,
                highlights: -8.0,
                shadows: -12.0,
                vignette: 28.0,
                ..ImageAdjustmentState::default()
            },
        ),
        (
            ImageFilterPresetId::Fade,
            "Fade",
            ImageAdjustmentState {
                brightness: 6.0,
                contrast: -22.0,
                saturation: -16.0,
                highlights: 14.0,
                shadows: 18.0,
                ..ImageAdjustmentState::default()
            },
        ),
        (
            ImageFilterPresetId::Chrome,
            "Chrome",
            ImageAdjustmentState {
                contrast: 18.0,
                saturation: 26.0,
                highlights: 14.0,
                temperature: -4.0,
                ..ImageAdjustmentState::default()
            },
        ),
        (
            ImageFilterPresetId::Warm,
            "Warm",
            ImageAdjustmentState {
                saturation: 12.0,
                temperature: 18.0,
                highlights: 8.0,
                ..ImageAdjustmentState::default()
            },
        ),
        (
            ImageFilterPresetId::Cool,
            "Cool",
            ImageAdjustmentState {
                saturation: 6.0,
                temperature: -20.0,
                shadows: 8.0,
                ..ImageAdjustmentState::default()
            },
        ),
        (
            ImageFilterPresetId::Vivid,
            "Vivid",
            ImageAdjustmentState {
                brightness: 4.0,
                contrast: 18.0,
                saturation: 30.0,
                highlights: 10.0,
                shadows: 6.0,
                vignette: 12.0,
                ..ImageAdjustmentState::default()
            },
        ),
    ]
    .into_iter()
    .map(|(id, label, state)| ImageFilterPresetDefinition {
        id,
        label: label.to_string(),
        state,
    })
    .collect()
}

fn compose_effective_adjustment_state(
    preset_id: Option<ImageFilterPresetId>,
    adjustments: ImageAdjustmentState,
) -> ImageAdjustmentState {
    let preset_state = image_filter_preset_definitions()
        .into_iter()
        .find(|definition| Some(definition.id) == preset_id)
        .map(|definition| definition.state)
        .unwrap_or_default();

    ImageAdjustmentState {
        brightness: preset_state.brightness + adjustments.brightness,
        contrast: preset_state.contrast + adjustments.contrast,
        saturation: preset_state.saturation + adjustments.saturation,
        temperature: preset_state.temperature + adjustments.temperature,
        highlights: preset_state.highlights + adjustments.highlights,
        shadows: preset_state.shadows + adjustments.shadows,
        vignette: preset_state.vignette + adjustments.vignette,
    }
    .normalized()
}

fn normalize_image_editor_source_path(input_path: &str) -> Result<PathBuf, String> {
    let trimmed = input_path.trim();
    if trimmed.is_empty() {
        return Err("Image editor input path cannot be empty.".to_string());
    }
    let path = PathBuf::from(trimmed);
    if !path.exists() {
        return Err(format!("Image editor input does not exist: {}", path.display()));
    }
    if !path.is_file() {
        return Err(format!("Image editor input is not a file: {}", path.display()));
    }
    Ok(path)
}

fn normalize_content_type(content_type: &str) -> Result<String, String> {
    match content_type.trim().to_ascii_lowercase().as_str() {
        "image/png" => Ok("image/png".to_string()),
        "image/jpeg" | "image/jpg" => Ok("image/jpeg".to_string()),
        "image/webp" => Ok("image/webp".to_string()),
        other => Err(format!(
            "Unsupported image editor content type: {other}. Expected PNG, JPEG, or WebP."
        )),
    }
}

fn resolve_supported_image_content_type(path: &Path) -> Result<String, String> {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .trim()
        .trim_start_matches('.')
        .to_ascii_lowercase();

    let content_type = match extension.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        _ => {
            return Err(format!(
                "Image editor only supports PNG, JPG, JPEG, and WebP files right now: {}",
                path.display()
            ))
        }
    };

    Ok(content_type.to_string())
}

fn read_image_file_as_rgba(path: &Path) -> Result<RgbaImage, String> {
    ImageReader::open(path)
        .map_err(|error| format!("Failed to open image '{}': {error}", path.display()))?
        .with_guessed_format()
        .map_err(|error| {
            format!(
                "Failed to detect image format for '{}': {error}",
                path.display()
            )
        })?
        .decode()
        .map(|image| image.to_rgba8())
        .map_err(|error| format!("Failed to decode image '{}': {error}", path.display()))
}

fn resize_image_to_fit(image: &RgbaImage, max_width: u32, max_height: u32) -> RgbaImage {
    if image.width() <= max_width && image.height() <= max_height {
        return image.clone();
    }
    let scale = f32::min(
        max_width as f32 / image.width() as f32,
        max_height as f32 / image.height() as f32,
    );
    let width = ((image.width() as f32) * scale).round().max(1.0) as u32;
    let height = ((image.height() as f32) * scale).round().max(1.0) as u32;
    resize(image, width, height, FilterType::Lanczos3)
}

fn encode_image_bytes(image: &RgbaImage, content_type: &str) -> Result<Vec<u8>, String> {
    let format = match content_type {
        "image/png" => ImageFormat::Png,
        "image/jpeg" => ImageFormat::Jpeg,
        "image/webp" => ImageFormat::WebP,
        other => {
            return Err(format!(
                "Unsupported image export content type: {other}. Expected PNG, JPEG, or WebP."
            ))
        }
    };

    let mut cursor = Cursor::new(Vec::<u8>::new());
    DynamicImage::ImageRgba8(image.clone())
        .write_to(&mut cursor, format)
        .map_err(|error| format!("Failed to encode image as {content_type}: {error}"))?;
    Ok(cursor.into_inner())
}

fn png_bytes_to_data_url(bytes: &[u8]) -> String {
    format!("data:image/png;base64,{}", BASE64_STANDARD.encode(bytes))
}

fn apply_image_adjustments(image: &RgbaImage, state: &ImageAdjustmentState) -> RgbaImage {
    let mut output = image.clone();
    let width = output.width().max(1) as f32;
    let height = output.height().max(1) as f32;
    let brightness_offset = state.brightness / 100.0;
    let contrast_factor = 1.0 + (state.contrast / 100.0);
    let saturation_factor = 1.0 + (state.saturation / 100.0);
    let temperature_bias = state.temperature / 100.0;
    let highlight_amount = state.highlights / 100.0;
    let shadow_amount = state.shadows / 100.0;
    let vignette_amount = state.vignette / 100.0;
    let vignette_max_distance = ((width * width) + (height * height)).sqrt() / 2.0;

    for (x, y, pixel) in output.enumerate_pixels_mut() {
        let [r, g, b, a] = pixel.0;
        let mut red = r as f32 / 255.0;
        let mut green = g as f32 / 255.0;
        let mut blue = b as f32 / 255.0;

        red += brightness_offset;
        green += brightness_offset;
        blue += brightness_offset;

        red = ((red - 0.5) * contrast_factor) + 0.5;
        green = ((green - 0.5) * contrast_factor) + 0.5;
        blue = ((blue - 0.5) * contrast_factor) + 0.5;

        let luminance = rgb_luminance(red, green, blue);
        red = luminance + ((red - luminance) * saturation_factor);
        green = luminance + ((green - luminance) * saturation_factor);
        blue = luminance + ((blue - luminance) * saturation_factor);

        red += temperature_bias * 0.18;
        green += temperature_bias * 0.03;
        blue -= temperature_bias * 0.18;

        let adjusted_luminance = rgb_luminance(red, green, blue);
        let shadow_weight = (1.0 - adjusted_luminance).powf(1.6);
        let highlight_weight = adjusted_luminance.powf(1.8);
        let shadow_lift = shadow_amount * 0.35 * shadow_weight;
        let highlight_lift = highlight_amount * 0.28 * highlight_weight;

        red += shadow_lift + highlight_lift;
        green += shadow_lift + highlight_lift;
        blue += shadow_lift + highlight_lift;

        if vignette_amount > 0.0 {
            let dx = x as f32 + 0.5 - (width / 2.0);
            let dy = y as f32 + 0.5 - (height / 2.0);
            let radial_distance = ((dx * dx) + (dy * dy)).sqrt();
            let normalized_distance = (radial_distance / vignette_max_distance).clamp(0.0, 1.0);
            let vignette_curve = normalized_distance.powf(1.75);
            let vignette_factor = 1.0 - (vignette_amount * 0.75 * vignette_curve);
            red *= vignette_factor;
            green *= vignette_factor;
            blue *= vignette_factor;
        }

        *pixel = Rgba([
            normalize_channel(red),
            normalize_channel(green),
            normalize_channel(blue),
            a,
        ]);
    }

    output
}

fn rgb_luminance(red: f32, green: f32, blue: f32) -> f32 {
    (0.2126 * red) + (0.7152 * green) + (0.0722 * blue)
}

fn normalize_channel(value: f32) -> u8 {
    (value.clamp(0.0, 1.0) * 255.0).round() as u8
}

#[cfg(test)]
mod tests {
    use super::{
        apply_image_adjustments, compose_effective_adjustment_state, image_filter_preset_definitions,
        normalize_content_type, ImageAdjustmentState, ImageEditorExportRequest, ImageEditorManager,
        ImageEditorPreviewRequest, ImageEditorSessionCreateRequest, ImageFilterPresetId,
    };
    use image::{DynamicImage, Rgba, RgbaImage};
    use tempfile::tempdir;

    fn sample_image() -> RgbaImage {
        let mut image = RgbaImage::new(2, 2);
        image.put_pixel(0, 0, Rgba([20, 40, 60, 255]));
        image.put_pixel(1, 0, Rgba([90, 110, 130, 255]));
        image.put_pixel(0, 1, Rgba([160, 180, 200, 255]));
        image.put_pixel(1, 1, Rgba([220, 210, 190, 255]));
        image
    }

    #[test]
    fn compose_effective_adjustment_state_adds_preset_and_manual_values() {
        let state = compose_effective_adjustment_state(
            Some(ImageFilterPresetId::Warm),
            ImageAdjustmentState {
                brightness: 5.0,
                temperature: -10.0,
                ..ImageAdjustmentState::default()
            },
        );

        assert_eq!(state.brightness, 5.0);
        assert_eq!(state.temperature, 8.0);
    }

    #[test]
    fn identity_adjustments_preserve_pixels() {
        let source = sample_image();
        let rendered = apply_image_adjustments(&source, &ImageAdjustmentState::default());
        assert_eq!(rendered, source);
    }

    #[test]
    fn create_preview_and_export_roundtrip_updates_saved_state() {
        let tempdir = tempdir().expect("image editor tempdir");
        let input_path = tempdir.path().join("fixture.png");
        DynamicImage::ImageRgba8(sample_image())
            .save(&input_path)
            .expect("write png fixture");

        let manager = ImageEditorManager::default();
        let bootstrap = manager
            .create_session(ImageEditorSessionCreateRequest {
                input_path: input_path.to_string_lossy().to_string(),
            })
            .expect("create session");

        assert_eq!(bootstrap.output_content_type, "image/png");
        assert_eq!(bootstrap.presets.len(), image_filter_preset_definitions().len());

        let preview = manager
            .render_preview(ImageEditorPreviewRequest {
                session_id: bootstrap.session_id.clone(),
                preset_id: Some(ImageFilterPresetId::Vivid),
                adjustments: ImageAdjustmentState {
                    contrast: 5.0,
                    ..ImageAdjustmentState::default()
                },
            })
            .expect("render preview");

        assert!(preview.preview_data_url.starts_with("data:image/png;base64,"));

        let export = manager
            .export_baked_image(ImageEditorExportRequest {
                session_id: bootstrap.session_id.clone(),
                preset_id: Some(ImageFilterPresetId::Vivid),
                adjustments: ImageAdjustmentState {
                    contrast: 5.0,
                    ..ImageAdjustmentState::default()
                },
                output_content_type: Some("image/png".to_string()),
            })
            .expect("export baked image");

        assert_eq!(export.content_type, "image/png");
        assert!(!export.image_bytes.is_empty());

        let stored_session = manager
            .get_session(&bootstrap.session_id)
            .expect("stored session");
        assert_eq!(stored_session.saved_state, export.effective_state);
    }

    #[test]
    fn normalize_content_type_accepts_supported_aliases_only() {
        assert_eq!(normalize_content_type("image/jpg").unwrap(), "image/jpeg");
        assert!(normalize_content_type("image/gif").is_err());
    }
}
