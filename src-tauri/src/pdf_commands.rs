use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use image::{DynamicImage, ImageFormat};
use lopdf::{dictionary, Dictionary, Document, Object, ObjectId};
use pdfium_auto::bind_pdfium_silent;
use pdfium_render::prelude::{PdfRenderConfig, PdfiumError, PdfiumInternalError};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

const PDF_PREVIEW_OVERLAY_NAME_PREFIX: &str = "greeblefs-overlay:";
const PDF_WIDGET_FLAG_READ_ONLY: u32 = 1 << 0;
const PDF_WIDGET_FLAG_REQUIRED: u32 = 1 << 1;
const PDF_TEXT_FLAG_MULTILINE: u32 = 1 << 12;
const PDF_BUTTON_FLAG_RADIO: u32 = 1 << 15;
const PDF_BUTTON_FLAG_PUSHBUTTON: u32 = 1 << 16;
const PDF_CHOICE_FLAG_COMBO: u32 = 1 << 17;

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PdfPreviewDocument {
    pub session_id: String,
    pub path: String,
    pub name: String,
    pub page_count: u32,
    pub pages: Vec<PdfPreviewPageDescriptor>,
    pub form_fields: Vec<PdfFormFieldDescriptor>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PdfPreviewPageDescriptor {
    pub page_index: u32,
    pub width_points: f32,
    pub height_points: f32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum PdfPageRenderFitMode {
    None,
    FitWidth,
    FitPage,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PdfPageRenderRequest {
    pub session_id: String,
    pub page_index: u32,
    pub zoom_scale: f32,
    pub fit_mode: PdfPageRenderFitMode,
    pub viewport_width_px: u32,
    pub viewport_height_px: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PdfPageRenderResult {
    pub session_id: String,
    pub page_index: u32,
    pub image_data_url: String,
    pub rendered_width_px: u32,
    pub rendered_height_px: u32,
    pub applied_zoom_scale: f32,
    pub fit_mode: PdfPageRenderFitMode,
    pub cache_key: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum PdfFormFieldKind {
    Text,
    Multiline,
    Checkbox,
    Radio,
    Dropdown,
    Listbox,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PdfFormFieldOptionDescriptor {
    pub value: String,
    pub label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PdfPageRect {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PdfPoint {
    pub x: f32,
    pub y: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PdfColorValue {
    pub red: u8,
    pub green: u8,
    pub blue: u8,
    pub alpha: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PdfFormFieldDescriptor {
    pub field_id: String,
    pub field_name: String,
    pub group_name: Option<String>,
    pub page_index: u32,
    pub rect: PdfPageRect,
    pub kind: PdfFormFieldKind,
    pub string_value: Option<String>,
    pub bool_value: Option<bool>,
    pub selected_values: Vec<String>,
    pub options: Vec<PdfFormFieldOptionDescriptor>,
    pub read_only: bool,
    pub required: bool,
    pub widget_export_value: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum PdfOverlayAnnotationKind {
    Text,
    Rect,
    Highlight,
    Arrow,
    Signature,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PdfOverlayAnnotation {
    pub id: String,
    pub kind: PdfOverlayAnnotationKind,
    pub bounds: PdfPageRect,
    pub points: Vec<PdfPoint>,
    pub text: Option<String>,
    pub color: PdfColorValue,
    pub stroke_width: Option<f32>,
    pub opacity: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PdfPageOverlayEdits {
    pub page_index: u32,
    pub annotations: Vec<PdfOverlayAnnotation>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PdfFormValueUpdate {
    pub field_id: String,
    pub string_value: Option<String>,
    pub bool_value: Option<bool>,
    pub selected_values: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PdfSaveEditsRequest {
    pub session_id: String,
    pub form_updates: Vec<PdfFormValueUpdate>,
    pub page_overlays: Vec<PdfPageOverlayEdits>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PdfSaveEditsResult {
    pub session_id: String,
    pub saved_at_epoch_ms: u64,
    pub document: PdfPreviewDocument,
}

#[derive(Clone, Default)]
pub struct PdfPreviewManager {
    inner: Arc<PdfPreviewManagerInner>,
}

#[derive(Default)]
struct PdfPreviewManagerInner {
    next_session_id: AtomicU64,
    sessions: Mutex<HashMap<String, PdfPreviewSession>>,
}

#[derive(Clone)]
struct PdfPreviewSession {
    source_path: PathBuf,
    document: PdfPreviewDocument,
    render_cache: HashMap<String, PdfPageRenderResult>,
}

#[derive(Clone)]
struct PdfPageContext {
    page_object_ids: Vec<ObjectId>,
    page_index_by_object_id: HashMap<ObjectId, u32>,
    page_height_by_index: HashMap<u32, f32>,
    page_index_by_annotation_id: HashMap<ObjectId, u32>,
}

#[derive(Clone, Default)]
struct PdfFieldContext {
    field_type: Option<String>,
    flags: u32,
    field_name: Option<String>,
    value: Option<String>,
}

#[tauri::command]
#[specta::specta]
pub async fn pdf_open_preview_document(
    manager: State<'_, PdfPreviewManager>,
    input_path: String,
) -> Result<PdfPreviewDocument, String> {
    let manager = manager.inner().clone();
    tauri::async_runtime::spawn_blocking(move || manager.open_preview_document(input_path))
        .await
        .map_err(|error| format!("PDF preview open task failed to join: {error}"))?
}

#[tauri::command]
#[specta::specta]
pub async fn pdf_render_preview_page(
    manager: State<'_, PdfPreviewManager>,
    request: PdfPageRenderRequest,
) -> Result<PdfPageRenderResult, String> {
    let manager = manager.inner().clone();
    tauri::async_runtime::spawn_blocking(move || manager.render_preview_page(request))
        .await
        .map_err(|error| format!("PDF preview render task failed to join: {error}"))?
}

#[tauri::command]
#[specta::specta]
pub async fn pdf_save_preview_edits(
    manager: State<'_, PdfPreviewManager>,
    request: PdfSaveEditsRequest,
) -> Result<PdfSaveEditsResult, String> {
    let manager = manager.inner().clone();
    tauri::async_runtime::spawn_blocking(move || manager.save_preview_edits(request))
        .await
        .map_err(|error| format!("PDF preview save task failed to join: {error}"))?
}

#[tauri::command]
#[specta::specta]
pub fn pdf_close_preview_document(
    manager: State<'_, PdfPreviewManager>,
    session_id: String,
) -> Result<(), String> {
    manager.close_preview_document(session_id)
}

impl PdfPreviewManager {
    fn open_preview_document(&self, input_path: String) -> Result<PdfPreviewDocument, String> {
        let source_path = normalize_pdf_source_path(&input_path)?;
        let session_id = format!(
            "pdf-preview-{}",
            self.inner.next_session_id.fetch_add(1, Ordering::Relaxed) + 1
        );
        let document = build_pdf_preview_document(&source_path, session_id.clone())?;
        let session = PdfPreviewSession {
            source_path,
            document: document.clone(),
            render_cache: HashMap::new(),
        };

        self.inner
            .sessions
            .lock()
            .map_err(|_| "PDF preview session map was poisoned.".to_string())?
            .insert(session_id, session);

        Ok(document)
    }

    fn render_preview_page(
        &self,
        request: PdfPageRenderRequest,
    ) -> Result<PdfPageRenderResult, String> {
        validate_pdf_render_request(&request)?;

        let (source_path, page_count) = {
            let sessions = self
                .inner
                .sessions
                .lock()
                .map_err(|_| "PDF preview session map was poisoned.".to_string())?;
            let session = sessions.get(&request.session_id).ok_or_else(|| {
                format!("PDF preview session was not found: {}", request.session_id)
            })?;
            (session.source_path.clone(), session.document.page_count)
        };

        if request.page_index >= page_count {
            return Err(format!(
                "PDF preview page index {} is outside document page count {}.",
                request.page_index, page_count
            ));
        }

        let cache_key = build_pdf_render_cache_key(&request);
        if let Some(cached) = self.get_cached_render(&request.session_id, &cache_key)? {
            return Ok(cached);
        }

        let render_result =
            render_pdf_preview_page(&source_path, request.clone(), cache_key.clone())?;
        self.store_cached_render(&request.session_id, cache_key, render_result.clone())?;

        Ok(render_result)
    }

    fn save_preview_edits(
        &self,
        request: PdfSaveEditsRequest,
    ) -> Result<PdfSaveEditsResult, String> {
        let (source_path, session_id) = {
            let sessions = self
                .inner
                .sessions
                .lock()
                .map_err(|_| "PDF preview session map was poisoned.".to_string())?;
            let session = sessions.get(&request.session_id).ok_or_else(|| {
                format!("PDF preview session was not found: {}", request.session_id)
            })?;
            (
                session.source_path.clone(),
                session.document.session_id.clone(),
            )
        };

        save_pdf_preview_edits_to_file(&source_path, &request)?;

        let refreshed_document = build_pdf_preview_document(&source_path, session_id.clone())?;
        let saved_at_epoch_ms = current_epoch_millis();

        let mut sessions = self
            .inner
            .sessions
            .lock()
            .map_err(|_| "PDF preview session map was poisoned.".to_string())?;
        let session = sessions
            .get_mut(&request.session_id)
            .ok_or_else(|| format!("PDF preview session was not found: {}", request.session_id))?;
        session.document = refreshed_document.clone();
        session.render_cache.clear();

        Ok(PdfSaveEditsResult {
            session_id,
            saved_at_epoch_ms,
            document: refreshed_document,
        })
    }

    fn close_preview_document(&self, session_id: String) -> Result<(), String> {
        self.inner
            .sessions
            .lock()
            .map_err(|_| "PDF preview session map was poisoned.".to_string())?
            .remove(session_id.as_str());
        Ok(())
    }

    fn get_cached_render(
        &self,
        session_id: &str,
        cache_key: &str,
    ) -> Result<Option<PdfPageRenderResult>, String> {
        Ok(self
            .inner
            .sessions
            .lock()
            .map_err(|_| "PDF preview session map was poisoned.".to_string())?
            .get(session_id)
            .and_then(|session| session.render_cache.get(cache_key).cloned()))
    }

    fn store_cached_render(
        &self,
        session_id: &str,
        cache_key: String,
        render_result: PdfPageRenderResult,
    ) -> Result<(), String> {
        let mut sessions = self
            .inner
            .sessions
            .lock()
            .map_err(|_| "PDF preview session map was poisoned.".to_string())?;
        if let Some(session) = sessions.get_mut(session_id) {
            session.render_cache.insert(cache_key, render_result);
        }
        Ok(())
    }
}

fn build_pdf_preview_document(
    source_path: &Path,
    session_id: String,
) -> Result<PdfPreviewDocument, String> {
    let pdfium = bind_pdfium_silent()
        .map_err(|error| format!("Failed to initialize PDFium runtime: {error}"))?;
    let pdfium_document = pdfium
        .load_pdf_from_file(source_path, None)
        .map_err(|error| map_pdfium_open_error(source_path, error))?;

    let mut pages = Vec::new();
    for page_index in 0..pdfium_document.pages().len() {
        let page = pdfium_document
            .pages()
            .get(page_index)
            .map_err(|error| format!("Failed to inspect PDF page {}: {error}", page_index + 1))?;
        pages.push(PdfPreviewPageDescriptor {
            page_index: page_index as u32,
            width_points: page.width().value,
            height_points: page.height().value,
        });
    }

    let lopdf_document = Document::load(source_path).map_err(|error| {
        format!(
            "Failed to load PDF document '{}': {error}",
            source_path.display()
        )
    })?;
    ensure_pdf_edit_supported(&lopdf_document, source_path)?;
    let page_context = build_pdf_page_context(&lopdf_document, &pages)?;
    let form_fields = extract_pdf_form_fields(&lopdf_document, &page_context)?;

    Ok(PdfPreviewDocument {
        session_id,
        path: source_path.to_string_lossy().into_owned(),
        name: source_path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("PDF")
            .to_string(),
        page_count: pages.len() as u32,
        pages,
        form_fields,
    })
}

fn save_pdf_preview_edits_to_file(
    source_path: &Path,
    request: &PdfSaveEditsRequest,
) -> Result<(), String> {
    let mut document = Document::load(source_path).map_err(|error| {
        format!(
            "Failed to load PDF document '{}': {error}",
            source_path.display()
        )
    })?;
    ensure_pdf_edit_supported(&document, source_path)?;
    let page_descriptors =
        collect_lopdf_page_descriptors(&source_path.to_string_lossy(), &document)?;
    let page_context = build_pdf_page_context(&document, &page_descriptors)?;

    set_need_appearances(&mut document)?;
    apply_pdf_form_updates(&mut document, &request.form_updates)?;
    replace_pdf_overlay_annotations(&mut document, &page_context, &request.page_overlays)?;

    document.save(source_path).map_err(|error| {
        format!(
            "Failed to save PDF document '{}': {error}",
            source_path.display()
        )
    })?;
    Ok(())
}

fn render_pdf_preview_page(
    source_path: &Path,
    request: PdfPageRenderRequest,
    cache_key: String,
) -> Result<PdfPageRenderResult, String> {
    let pdfium = bind_pdfium_silent()
        .map_err(|error| format!("Failed to initialize PDFium runtime: {error}"))?;
    let pdfium_document = pdfium
        .load_pdf_from_file(source_path, None)
        .map_err(|error| map_pdfium_open_error(source_path, error))?;
    let page_index = u16::try_from(request.page_index).map_err(|_| {
        format!(
            "PDF preview page index {} exceeds PDFium page index limits.",
            request.page_index
        )
    })?;
    let page = pdfium_document.pages().get(page_index).map_err(|error| {
        format!(
            "Failed to load PDF page {}: {error}",
            request.page_index + 1
        )
    })?;

    let render_config = build_pdf_render_config(&request);
    let rendered_page = page.render_with_config(&render_config).map_err(|error| {
        format!(
            "Failed to render PDF page {}: {error}",
            request.page_index + 1
        )
    })?;
    let rendered_image = rendered_page.as_image();
    let image_data_url = png_data_url_from_dynamic_image(&rendered_image)?;

    Ok(PdfPageRenderResult {
        session_id: request.session_id,
        page_index: request.page_index,
        image_data_url,
        rendered_width_px: rendered_image.width(),
        rendered_height_px: rendered_image.height(),
        applied_zoom_scale: request.zoom_scale,
        fit_mode: request.fit_mode,
        cache_key,
    })
}

fn validate_pdf_render_request(request: &PdfPageRenderRequest) -> Result<(), String> {
    if request.session_id.trim().is_empty() {
        return Err("PDF preview render request session id cannot be empty.".to_string());
    }
    if !request.zoom_scale.is_finite() || request.zoom_scale <= 0.0 {
        return Err(format!(
            "PDF preview render request zoom scale must be greater than zero. Received {}.",
            request.zoom_scale
        ));
    }
    if request.viewport_width_px == 0 || request.viewport_height_px == 0 {
        return Err("PDF preview render viewport must be greater than zero.".to_string());
    }
    Ok(())
}

fn build_pdf_render_cache_key(request: &PdfPageRenderRequest) -> String {
    format!(
        "{}:{}:{}:{}:{}",
        request.page_index,
        request.fit_mode as u8,
        request.viewport_width_px,
        request.viewport_height_px,
        (request.zoom_scale * 1000.0).round() as i32
    )
}

fn build_pdf_render_config(request: &PdfPageRenderRequest) -> PdfRenderConfig {
    let base = PdfRenderConfig::new()
        .render_form_data(true)
        .render_annotations(true);

    match request.fit_mode {
        PdfPageRenderFitMode::FitWidth => base.set_target_width(request.viewport_width_px as i32),
        PdfPageRenderFitMode::FitPage => base.scale_page_to_display_size(
            request.viewport_width_px as i32,
            request.viewport_height_px as i32,
        ),
        PdfPageRenderFitMode::None => base.scale_page_by_factor(request.zoom_scale),
    }
}

fn normalize_pdf_source_path(input_path: &str) -> Result<PathBuf, String> {
    let trimmed = input_path.trim();
    if trimmed.is_empty() {
        return Err("PDF preview input path cannot be empty.".to_string());
    }
    let path = PathBuf::from(trimmed);
    if !path.exists() {
        return Err(format!(
            "PDF preview input does not exist: {}",
            path.display()
        ));
    }
    if !path.is_file() {
        return Err(format!(
            "PDF preview input is not a file: {}",
            path.display()
        ));
    }
    Ok(path)
}

fn map_pdfium_open_error(path: &Path, error: PdfiumError) -> String {
    match error {
        PdfiumError::PdfiumLibraryInternalError(PdfiumInternalError::PasswordError) => format!(
            "PDF preview does not support password-locked files right now: {}",
            path.display()
        ),
        other => format!("Failed to open PDF document '{}': {other}", path.display()),
    }
}

fn png_data_url_from_dynamic_image(image: &DynamicImage) -> Result<String, String> {
    let mut bytes = Vec::new();
    image
        .write_to(&mut Cursor::new(&mut bytes), ImageFormat::Png)
        .map_err(|error| format!("Failed to encode rendered PDF page to PNG: {error}"))?;
    Ok(format!(
        "data:image/png;base64,{}",
        BASE64_STANDARD.encode(bytes)
    ))
}

fn current_epoch_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or_default()
}

fn ensure_pdf_edit_supported(document: &Document, source_path: &Path) -> Result<(), String> {
    if document.is_encrypted() {
        return Err(format!(
            "PDF preview edit mode does not support encrypted or password-locked files right now: {}",
            source_path.display()
        ));
    }

    if pdf_document_has_xfa(document)? {
        return Err(format!(
            "PDF preview edit mode does not support XFA forms right now: {}",
            source_path.display()
        ));
    }

    Ok(())
}

fn collect_lopdf_page_descriptors(
    source_path_label: &str,
    document: &Document,
) -> Result<Vec<PdfPreviewPageDescriptor>, String> {
    let mut page_descriptors = Vec::new();
    for (page_index, (_, page_object_id)) in document.get_pages().into_iter().enumerate() {
        let page_dictionary = document
            .get_dictionary(page_object_id)
            .map_err(|error| format!("Failed to inspect PDF page {}: {error}", page_index + 1))?;
        let media_box = page_dictionary
            .get(b"MediaBox")
            .map_err(|error| format!("PDF page {} is missing MediaBox: {error}", page_index + 1))?;
        let rect = parse_pdf_rect_array(document, media_box).map_err(|error| {
            format!(
                "Failed to parse PDF page MediaBox for '{}', page {}: {error}",
                source_path_label,
                page_index + 1
            )
        })?;
        page_descriptors.push(PdfPreviewPageDescriptor {
            page_index: page_index as u32,
            width_points: rect.width,
            height_points: rect.height,
        });
    }
    Ok(page_descriptors)
}

fn build_pdf_page_context(
    document: &Document,
    page_descriptors: &[PdfPreviewPageDescriptor],
) -> Result<PdfPageContext, String> {
    let mut page_object_ids = Vec::new();
    let mut page_index_by_object_id = HashMap::new();
    let mut page_height_by_index = HashMap::new();
    let mut page_index_by_annotation_id = HashMap::new();

    for (page_index, (_, page_object_id)) in document.get_pages().into_iter().enumerate() {
        let page_index_u32 = page_index as u32;
        page_object_ids.push(page_object_id);
        page_index_by_object_id.insert(page_object_id, page_index_u32);
        if let Some(page_descriptor) = page_descriptors.get(page_index) {
            page_height_by_index.insert(page_index_u32, page_descriptor.height_points);
        }

        let page_dictionary = document
            .get_dictionary(page_object_id)
            .map_err(|error| format!("Failed to inspect PDF page {}: {error}", page_index + 1))?;
        if let Ok(annotation_list) = page_dictionary.get(b"Annots").and_then(Object::as_array) {
            for annotation_object in annotation_list {
                if let Ok(annotation_id) = annotation_object.as_reference() {
                    page_index_by_annotation_id.insert(annotation_id, page_index_u32);
                }
            }
        }
    }

    Ok(PdfPageContext {
        page_object_ids,
        page_index_by_object_id,
        page_height_by_index,
        page_index_by_annotation_id,
    })
}

fn extract_pdf_form_fields(
    document: &Document,
    page_context: &PdfPageContext,
) -> Result<Vec<PdfFormFieldDescriptor>, String> {
    let Some(acro_form_dictionary) = get_pdf_acro_form_dictionary(document)? else {
        return Ok(Vec::new());
    };

    let Some(field_objects) = acro_form_dictionary
        .get(b"Fields")
        .ok()
        .and_then(|object| resolve_object_array(document, object).ok())
    else {
        return Ok(Vec::new());
    };

    let mut descriptors = Vec::new();
    for field_object in field_objects {
        let field_id = field_object
            .as_reference()
            .map_err(|error| format!("PDF form field reference was invalid: {error}"))?;
        collect_pdf_form_field_descriptors(
            document,
            page_context,
            field_id,
            &PdfFieldContext::default(),
            &mut descriptors,
        )?;
    }

    descriptors.sort_by(|left, right| {
        left.page_index
            .cmp(&right.page_index)
            .then_with(|| left.field_name.cmp(&right.field_name))
            .then_with(|| left.field_id.cmp(&right.field_id))
    });

    Ok(descriptors)
}

fn collect_pdf_form_field_descriptors(
    document: &Document,
    page_context: &PdfPageContext,
    field_object_id: ObjectId,
    inherited_context: &PdfFieldContext,
    descriptors: &mut Vec<PdfFormFieldDescriptor>,
) -> Result<(), String> {
    let field_dictionary = document.get_dictionary(field_object_id).map_err(|error| {
        format!(
            "Failed to inspect PDF form field {:?}: {error}",
            field_object_id
        )
    })?;

    let field_type = field_dictionary
        .get(b"FT")
        .ok()
        .and_then(object_name_string)
        .or_else(|| inherited_context.field_type.clone());
    let flags = field_dictionary
        .get(b"Ff")
        .ok()
        .and_then(|object| object.as_i64().ok())
        .map(|value| value.max(0) as u32)
        .unwrap_or(inherited_context.flags);
    let field_name = combine_pdf_field_name(
        inherited_context.field_name.clone(),
        field_dictionary.get(b"T").ok().and_then(object_text_string),
    );
    let field_value = field_dictionary
        .get(b"V")
        .ok()
        .and_then(object_text_or_name_string)
        .or_else(|| inherited_context.value.clone());

    let field_context = PdfFieldContext {
        field_type: field_type.clone(),
        flags,
        field_name: field_name.clone(),
        value: field_value.clone(),
    };

    let is_widget = field_dictionary
        .get(b"Subtype")
        .ok()
        .and_then(object_name_string)
        .as_deref()
        == Some("Widget");
    if is_widget {
        if let Some(descriptor) = build_pdf_form_field_descriptor(
            document,
            page_context,
            field_object_id,
            field_dictionary,
            &field_context,
        )? {
            descriptors.push(descriptor);
        }
    }

    if let Ok(kid_objects) = field_dictionary.get(b"Kids").and_then(Object::as_array) {
        for kid_object in kid_objects {
            let kid_id = kid_object
                .as_reference()
                .map_err(|error| format!("PDF form kid reference was invalid: {error}"))?;
            let kid_dictionary = document
                .get_dictionary(kid_id)
                .map_err(|error| format!("Failed to inspect PDF form kid {:?}: {error}", kid_id))?;
            let kid_is_widget = kid_dictionary
                .get(b"Subtype")
                .ok()
                .and_then(object_name_string)
                .as_deref()
                == Some("Widget");
            if kid_is_widget {
                if let Some(descriptor) = build_pdf_form_field_descriptor(
                    document,
                    page_context,
                    kid_id,
                    kid_dictionary,
                    &field_context,
                )? {
                    descriptors.push(descriptor);
                }
            } else {
                collect_pdf_form_field_descriptors(
                    document,
                    page_context,
                    kid_id,
                    &field_context,
                    descriptors,
                )?;
            }
        }
    } else if !is_widget {
        if let Some(descriptor) = build_pdf_form_field_descriptor(
            document,
            page_context,
            field_object_id,
            field_dictionary,
            &field_context,
        )? {
            descriptors.push(descriptor);
        }
    }

    Ok(())
}

fn build_pdf_form_field_descriptor(
    document: &Document,
    page_context: &PdfPageContext,
    widget_object_id: ObjectId,
    widget_dictionary: &Dictionary,
    field_context: &PdfFieldContext,
) -> Result<Option<PdfFormFieldDescriptor>, String> {
    let Some(field_type) = field_context.field_type.as_deref() else {
        return Ok(None);
    };

    let Some(page_index) =
        resolve_pdf_widget_page_index(document, page_context, widget_object_id, widget_dictionary)
    else {
        return Ok(None);
    };
    let page_height = page_context
        .page_height_by_index
        .get(&page_index)
        .copied()
        .ok_or_else(|| format!("Missing page height for PDF page index {}.", page_index))?;
    let rect_object = widget_dictionary
        .get(b"Rect")
        .map_err(|error| format!("PDF form field is missing Rect: {error}"))?;
    let rect = parse_pdf_widget_rect(document, rect_object, page_height)?;
    let field_name = field_context
        .field_name
        .clone()
        .unwrap_or_else(|| format!("Field {}", object_id_to_string(widget_object_id)));
    let group_name = if field_name.contains('.') {
        field_name
            .split('.')
            .rev()
            .skip(1)
            .last()
            .map(str::to_string)
    } else {
        None
    };
    let required = field_context.flags & PDF_WIDGET_FLAG_REQUIRED != 0;
    let read_only = field_context.flags & PDF_WIDGET_FLAG_READ_ONLY != 0;

    let descriptor = match field_type {
        "Tx" => PdfFormFieldDescriptor {
            field_id: object_id_to_string(widget_object_id),
            field_name,
            group_name,
            page_index,
            rect,
            kind: if field_context.flags & PDF_TEXT_FLAG_MULTILINE != 0 {
                PdfFormFieldKind::Multiline
            } else {
                PdfFormFieldKind::Text
            },
            string_value: field_context.value.clone(),
            bool_value: None,
            selected_values: Vec::new(),
            options: Vec::new(),
            read_only,
            required,
            widget_export_value: None,
        },
        "Btn" => {
            if field_context.flags & PDF_BUTTON_FLAG_PUSHBUTTON != 0 {
                return Ok(None);
            }

            let widget_export_value = resolve_pdf_widget_export_value(widget_dictionary);
            let current_state = widget_dictionary
                .get(b"AS")
                .ok()
                .and_then(object_name_string)
                .or_else(|| field_context.value.clone());
            let bool_value = current_state
                .as_deref()
                .map(|value| value != "Off")
                .or(Some(false));

            PdfFormFieldDescriptor {
                field_id: object_id_to_string(widget_object_id),
                field_name,
                group_name,
                page_index,
                rect,
                kind: if field_context.flags & PDF_BUTTON_FLAG_RADIO != 0 {
                    PdfFormFieldKind::Radio
                } else {
                    PdfFormFieldKind::Checkbox
                },
                string_value: current_state,
                bool_value,
                selected_values: Vec::new(),
                options: Vec::new(),
                read_only,
                required,
                widget_export_value,
            }
        }
        "Ch" => {
            let options = widget_dictionary
                .get(b"Opt")
                .ok()
                .or_else(|| {
                    document
                        .get_dictionary(widget_object_id)
                        .ok()
                        .and_then(|dict| dict.get(b"Opt").ok())
                })
                .map(|object| parse_pdf_choice_options(document, object))
                .transpose()?
                .unwrap_or_default();
            let selected_value = field_context.value.clone();

            PdfFormFieldDescriptor {
                field_id: object_id_to_string(widget_object_id),
                field_name,
                group_name,
                page_index,
                rect,
                kind: if field_context.flags & PDF_CHOICE_FLAG_COMBO != 0 {
                    PdfFormFieldKind::Dropdown
                } else {
                    PdfFormFieldKind::Listbox
                },
                string_value: selected_value.clone(),
                bool_value: None,
                selected_values: selected_value.into_iter().collect(),
                options,
                read_only,
                required,
                widget_export_value: None,
            }
        }
        _ => return Ok(None),
    };

    Ok(Some(descriptor))
}

fn resolve_pdf_widget_page_index(
    document: &Document,
    page_context: &PdfPageContext,
    widget_object_id: ObjectId,
    widget_dictionary: &Dictionary,
) -> Option<u32> {
    if let Some(page_object_id) = widget_dictionary
        .get(b"P")
        .ok()
        .and_then(|object| object.as_reference().ok())
    {
        if let Some(page_index) = page_context
            .page_index_by_object_id
            .get(&page_object_id)
            .copied()
        {
            return Some(page_index);
        }
    }

    if let Some(page_index) = page_context
        .page_index_by_annotation_id
        .get(&widget_object_id)
        .copied()
    {
        return Some(page_index);
    }

    if let Some(parent_id) = widget_dictionary
        .get(b"Parent")
        .ok()
        .and_then(|object| object.as_reference().ok())
    {
        if let Some(page_index) = page_context
            .page_index_by_annotation_id
            .get(&parent_id)
            .copied()
        {
            return Some(page_index);
        }
    }

    document
        .get_object_page(widget_object_id)
        .ok()
        .and_then(|page_object_id| {
            page_context
                .page_index_by_object_id
                .get(&page_object_id)
                .copied()
        })
}

fn parse_pdf_widget_rect(
    document: &Document,
    rect_object: &Object,
    page_height: f32,
) -> Result<PdfPageRect, String> {
    let rect = parse_pdf_rect_array(document, rect_object)?;
    Ok(PdfPageRect {
        x: rect.x,
        y: page_height - (rect.y + rect.height),
        width: rect.width,
        height: rect.height,
    })
}

fn parse_pdf_rect_array(document: &Document, rect_object: &Object) -> Result<PdfPageRect, String> {
    let coordinates = resolve_object_array(document, rect_object)?;
    if coordinates.len() < 4 {
        return Err(format!(
            "PDF rectangle expected 4 coordinates but found {}.",
            coordinates.len()
        ));
    }
    let left = coordinates[0]
        .as_float()
        .map_err(|error| format!("Failed to parse PDF rectangle left coordinate: {error}"))?;
    let bottom = coordinates[1]
        .as_float()
        .map_err(|error| format!("Failed to parse PDF rectangle bottom coordinate: {error}"))?;
    let right = coordinates[2]
        .as_float()
        .map_err(|error| format!("Failed to parse PDF rectangle right coordinate: {error}"))?;
    let top = coordinates[3]
        .as_float()
        .map_err(|error| format!("Failed to parse PDF rectangle top coordinate: {error}"))?;

    Ok(PdfPageRect {
        x: left.min(right),
        y: bottom.min(top),
        width: (right - left).abs(),
        height: (top - bottom).abs(),
    })
}

fn parse_pdf_choice_options(
    document: &Document,
    option_object: &Object,
) -> Result<Vec<PdfFormFieldOptionDescriptor>, String> {
    let option_entries = resolve_object_array(document, option_object)?;
    let mut options = Vec::new();
    for option_entry in option_entries {
        if let Ok(option_pair) = option_entry.as_array() {
            let value = option_pair
                .first()
                .and_then(object_text_or_name_string)
                .unwrap_or_default();
            let label = option_pair
                .get(1)
                .and_then(object_text_or_name_string)
                .unwrap_or_else(|| value.clone());
            options.push(PdfFormFieldOptionDescriptor { value, label });
            continue;
        }

        if let Some(value) = object_text_or_name_string(option_entry) {
            options.push(PdfFormFieldOptionDescriptor {
                value: value.clone(),
                label: value,
            });
        }
    }
    Ok(options)
}

fn pdf_document_has_xfa(document: &Document) -> Result<bool, String> {
    Ok(get_pdf_acro_form_dictionary(document)?
        .and_then(|dictionary| dictionary.get(b"XFA").ok())
        .is_some())
}

fn get_pdf_acro_form_dictionary(document: &Document) -> Result<Option<&Dictionary>, String> {
    let root_object = document
        .trailer
        .get(b"Root")
        .map_err(|error| format!("PDF document is missing catalog root: {error}"))?;
    let root_dictionary = resolve_object_dictionary(document, root_object)?;
    let Some(acro_form_object) = root_dictionary.get(b"AcroForm").ok() else {
        return Ok(None);
    };
    let acro_form_dictionary = resolve_object_dictionary(document, acro_form_object)?;
    Ok(Some(acro_form_dictionary))
}

fn resolve_object_dictionary<'a>(
    document: &'a Document,
    object: &'a Object,
) -> Result<&'a Dictionary, String> {
    match object {
        Object::Dictionary(dictionary) => Ok(dictionary),
        Object::Reference(object_id) => document.get_dictionary(*object_id).map_err(|error| {
            format!(
                "Failed to resolve PDF dictionary reference {:?}: {error}",
                object_id
            )
        }),
        _ => Err("Expected PDF dictionary object.".to_string()),
    }
}

fn resolve_object_array<'a>(
    document: &'a Document,
    object: &'a Object,
) -> Result<&'a Vec<Object>, String> {
    match object {
        Object::Array(array) => Ok(array),
        Object::Reference(object_id) => document
            .get_object(*object_id)
            .map_err(|error| {
                format!(
                    "Failed to resolve PDF array reference {:?}: {error}",
                    object_id
                )
            })?
            .as_array()
            .map_err(|error| format!("Resolved PDF object was not an array: {error}")),
        _ => Err("Expected PDF array object.".to_string()),
    }
}

fn object_name_string(object: &Object) -> Option<String> {
    object.as_name_str().ok().map(str::to_string)
}

fn object_text_string(object: &Object) -> Option<String> {
    object.as_string().ok().map(|value| value.into_owned())
}

fn object_text_or_name_string(object: &Object) -> Option<String> {
    object_text_string(object).or_else(|| object_name_string(object))
}

fn combine_pdf_field_name(
    parent_name: Option<String>,
    partial_name: Option<String>,
) -> Option<String> {
    match (parent_name, partial_name) {
        (Some(parent), Some(child)) if !parent.is_empty() && !child.is_empty() => {
            Some(format!("{parent}.{child}"))
        }
        (Some(parent), None) => Some(parent),
        (None, Some(child)) => Some(child),
        (Some(parent), Some(_)) => Some(parent),
        (None, None) => None,
    }
}

fn object_id_to_string(object_id: ObjectId) -> String {
    format!("{}:{}", object_id.0, object_id.1)
}

fn parse_object_id(value: &str) -> Result<ObjectId, String> {
    let mut segments = value.split(':');
    let object_number = segments
        .next()
        .ok_or_else(|| format!("PDF object id was empty: {value}"))?
        .parse::<u32>()
        .map_err(|error| format!("Failed to parse PDF object number from '{value}': {error}"))?;
    let generation_number = segments
        .next()
        .ok_or_else(|| format!("PDF object generation was missing: {value}"))?
        .parse::<u16>()
        .map_err(|error| {
            format!("Failed to parse PDF object generation from '{value}': {error}")
        })?;
    if segments.next().is_some() {
        return Err(format!("PDF object id had too many segments: {value}"));
    }
    Ok((object_number, generation_number))
}

fn set_need_appearances(document: &mut Document) -> Result<(), String> {
    let root_id = document
        .trailer
        .get(b"Root")
        .map_err(|error| format!("PDF document is missing catalog root: {error}"))?
        .as_reference()
        .map_err(|error| format!("PDF catalog root reference was invalid: {error}"))?;
    let acro_form_id = {
        let root_dictionary = document
            .get_dictionary(root_id)
            .map_err(|error| format!("Failed to inspect PDF catalog: {error}"))?;
        root_dictionary
            .get(b"AcroForm")
            .ok()
            .and_then(|object| object.as_reference().ok())
    };
    if let Some(acro_form_id) = acro_form_id {
        let acro_form_dictionary = document
            .get_dictionary_mut(acro_form_id)
            .map_err(|error| format!("Failed to inspect PDF AcroForm dictionary: {error}"))?;
        acro_form_dictionary.set("NeedAppearances", true);
    }
    Ok(())
}

fn apply_pdf_form_updates(
    document: &mut Document,
    updates: &[PdfFormValueUpdate],
) -> Result<(), String> {
    for update in updates {
        let widget_object_id = parse_object_id(&update.field_id)?;
        let owner_object_id = resolve_pdf_field_owner_id(document, widget_object_id)?;
        let field_type = resolve_pdf_field_type(document, owner_object_id)?
            .ok_or_else(|| format!("PDF field {:?} is missing field type.", owner_object_id))?;
        let flags = resolve_pdf_field_flags(document, owner_object_id)?;

        match field_type.as_str() {
            "Tx" => {
                set_pdf_field_string_value(
                    document,
                    owner_object_id,
                    update.string_value.clone().unwrap_or_default(),
                )?;
            }
            "Ch" => {
                let selected_value = update
                    .selected_values
                    .first()
                    .cloned()
                    .or_else(|| update.string_value.clone())
                    .unwrap_or_default();
                set_pdf_field_string_value(document, owner_object_id, selected_value)?;
            }
            "Btn" => {
                if flags & PDF_BUTTON_FLAG_PUSHBUTTON != 0 {
                    continue;
                }
                if flags & PDF_BUTTON_FLAG_RADIO != 0 {
                    if update.bool_value.unwrap_or(true) {
                        apply_pdf_radio_update(document, owner_object_id, widget_object_id)?;
                    }
                } else {
                    apply_pdf_checkbox_update(
                        document,
                        owner_object_id,
                        widget_object_id,
                        update.bool_value.unwrap_or(false),
                    )?;
                }
            }
            _ => {}
        }
    }

    Ok(())
}

fn resolve_pdf_field_owner_id(
    document: &Document,
    widget_object_id: ObjectId,
) -> Result<ObjectId, String> {
    let widget_dictionary = document.get_dictionary(widget_object_id).map_err(|error| {
        format!(
            "Failed to inspect PDF widget {:?}: {error}",
            widget_object_id
        )
    })?;

    if widget_dictionary.get(b"FT").is_ok() {
        return Ok(widget_object_id);
    }

    widget_dictionary
        .get(b"Parent")
        .map_err(|error| {
            format!(
                "PDF widget {:?} is missing Parent: {error}",
                widget_object_id
            )
        })?
        .as_reference()
        .map_err(|error| {
            format!(
                "PDF widget {:?} parent reference was invalid: {error}",
                widget_object_id
            )
        })
}

fn resolve_pdf_field_type(
    document: &Document,
    object_id: ObjectId,
) -> Result<Option<String>, String> {
    let dictionary = document
        .get_dictionary(object_id)
        .map_err(|error| format!("Failed to inspect PDF field {:?}: {error}", object_id))?;
    if let Some(field_type) = dictionary.get(b"FT").ok().and_then(object_name_string) {
        return Ok(Some(field_type));
    }

    if let Some(parent_id) = dictionary
        .get(b"Parent")
        .ok()
        .and_then(|object| object.as_reference().ok())
    {
        return resolve_pdf_field_type(document, parent_id);
    }

    Ok(None)
}

fn resolve_pdf_field_flags(document: &Document, object_id: ObjectId) -> Result<u32, String> {
    let dictionary = document
        .get_dictionary(object_id)
        .map_err(|error| format!("Failed to inspect PDF field {:?}: {error}", object_id))?;
    if let Some(flags) = dictionary
        .get(b"Ff")
        .ok()
        .and_then(|object| object.as_i64().ok())
        .map(|value| value.max(0) as u32)
    {
        return Ok(flags);
    }

    if let Some(parent_id) = dictionary
        .get(b"Parent")
        .ok()
        .and_then(|object| object.as_reference().ok())
    {
        return resolve_pdf_field_flags(document, parent_id);
    }

    Ok(0)
}

fn set_pdf_field_string_value(
    document: &mut Document,
    field_object_id: ObjectId,
    value: String,
) -> Result<(), String> {
    let field_dictionary = document
        .get_dictionary_mut(field_object_id)
        .map_err(|error| format!("Failed to inspect PDF field {:?}: {error}", field_object_id))?;
    field_dictionary.set("V", Object::string_literal(value));
    Ok(())
}

fn apply_pdf_checkbox_update(
    document: &mut Document,
    owner_object_id: ObjectId,
    widget_object_id: ObjectId,
    is_checked: bool,
) -> Result<(), String> {
    let export_value = {
        let widget_dictionary = document.get_dictionary(widget_object_id).map_err(|error| {
            format!(
                "Failed to inspect PDF checkbox widget {:?}: {error}",
                widget_object_id
            )
        })?;
        resolve_pdf_widget_export_value(widget_dictionary).unwrap_or_else(|| "Yes".to_string())
    };
    let state_name = if is_checked {
        export_value
    } else {
        "Off".to_string()
    };

    let owner_dictionary = document
        .get_dictionary_mut(owner_object_id)
        .map_err(|error| {
            format!(
                "Failed to inspect PDF checkbox field {:?}: {error}",
                owner_object_id
            )
        })?;
    owner_dictionary.set("V", Object::Name(state_name.as_bytes().to_vec()));

    let widget_dictionary = document
        .get_dictionary_mut(widget_object_id)
        .map_err(|error| {
            format!(
                "Failed to inspect PDF checkbox widget {:?}: {error}",
                widget_object_id
            )
        })?;
    widget_dictionary.set("AS", Object::Name(state_name.into_bytes()));
    Ok(())
}

fn apply_pdf_radio_update(
    document: &mut Document,
    owner_object_id: ObjectId,
    selected_widget_object_id: ObjectId,
) -> Result<(), String> {
    let selected_name = {
        let widget_dictionary =
            document
                .get_dictionary(selected_widget_object_id)
                .map_err(|error| {
                    format!(
                        "Failed to inspect PDF radio widget {:?}: {error}",
                        selected_widget_object_id
                    )
                })?;
        resolve_pdf_widget_export_value(widget_dictionary).unwrap_or_else(|| "Yes".to_string())
    };

    let sibling_widget_ids = {
        let owner_dictionary = document.get_dictionary(owner_object_id).map_err(|error| {
            format!(
                "Failed to inspect PDF radio field {:?}: {error}",
                owner_object_id
            )
        })?;
        owner_dictionary
            .get(b"Kids")
            .ok()
            .and_then(|object| object.as_array().ok())
            .map(|widgets| {
                widgets
                    .iter()
                    .filter_map(|widget| widget.as_reference().ok())
                    .collect::<Vec<_>>()
            })
            .unwrap_or_else(|| vec![selected_widget_object_id])
    };

    for sibling_widget_id in sibling_widget_ids {
        let sibling_export_value = {
            let sibling_dictionary =
                document
                    .get_dictionary(sibling_widget_id)
                    .map_err(|error| {
                        format!(
                            "Failed to inspect PDF radio widget {:?}: {error}",
                            sibling_widget_id
                        )
                    })?;
            resolve_pdf_widget_export_value(sibling_dictionary).unwrap_or_else(|| "Off".to_string())
        };
        let state_name = if sibling_widget_id == selected_widget_object_id {
            selected_name.clone()
        } else if sibling_export_value == selected_name {
            "Off".to_string()
        } else {
            "Off".to_string()
        };
        let sibling_dictionary =
            document
                .get_dictionary_mut(sibling_widget_id)
                .map_err(|error| {
                    format!(
                        "Failed to inspect PDF radio widget {:?}: {error}",
                        sibling_widget_id
                    )
                })?;
        sibling_dictionary.set("AS", Object::Name(state_name.into_bytes()));
    }

    let owner_dictionary = document
        .get_dictionary_mut(owner_object_id)
        .map_err(|error| {
            format!(
                "Failed to inspect PDF radio field {:?}: {error}",
                owner_object_id
            )
        })?;
    owner_dictionary.set("V", Object::Name(selected_name.into_bytes()));
    Ok(())
}

fn resolve_pdf_widget_export_value(widget_dictionary: &Dictionary) -> Option<String> {
    if let Some(state_name) = widget_dictionary
        .get(b"AS")
        .ok()
        .and_then(object_name_string)
    {
        if state_name != "Off" {
            return Some(state_name);
        }
    }

    widget_dictionary
        .get(b"AP")
        .ok()
        .and_then(|object| object.as_dict().ok())
        .and_then(|appearance_dictionary| appearance_dictionary.get(b"N").ok())
        .and_then(|object| object.as_dict().ok())
        .and_then(|normal_appearance_dictionary| {
            normal_appearance_dictionary
                .iter()
                .filter_map(|(key, _)| std::str::from_utf8(key).ok())
                .find(|name| *name != "Off")
                .map(str::to_string)
        })
}

fn replace_pdf_overlay_annotations(
    document: &mut Document,
    page_context: &PdfPageContext,
    page_overlays: &[PdfPageOverlayEdits],
) -> Result<(), String> {
    remove_existing_pdf_overlay_annotations(document, page_context)?;

    for page_overlay in page_overlays {
        let page_object_id = page_context
            .page_object_ids
            .get(page_overlay.page_index as usize)
            .copied()
            .ok_or_else(|| {
                format!(
                    "PDF overlay page index {} is invalid.",
                    page_overlay.page_index
                )
            })?;
        let page_height = page_context
            .page_height_by_index
            .get(&page_overlay.page_index)
            .copied()
            .ok_or_else(|| {
                format!(
                    "Missing PDF page height for page index {}.",
                    page_overlay.page_index
                )
            })?;

        let mut new_annotation_refs = Vec::new();
        for annotation in &page_overlay.annotations {
            let annotation_dictionary =
                build_pdf_overlay_annotation_dictionary(annotation, page_object_id, page_height)?;
            let annotation_object_id = document.add_object(annotation_dictionary);
            new_annotation_refs.push(Object::Reference(annotation_object_id));
        }

        if new_annotation_refs.is_empty() {
            continue;
        }

        let mut combined_annotations = {
            let page_dictionary = document.get_dictionary(page_object_id).map_err(|error| {
                format!("Failed to inspect PDF page {:?}: {error}", page_object_id)
            })?;
            page_dictionary
                .get(b"Annots")
                .ok()
                .and_then(|object| object.as_array().ok())
                .cloned()
                .unwrap_or_default()
        };
        combined_annotations.extend(new_annotation_refs);

        let page_dictionary = document
            .get_dictionary_mut(page_object_id)
            .map_err(|error| format!("Failed to inspect PDF page {:?}: {error}", page_object_id))?;
        page_dictionary.set("Annots", Object::Array(combined_annotations));
    }

    Ok(())
}

fn remove_existing_pdf_overlay_annotations(
    document: &mut Document,
    page_context: &PdfPageContext,
) -> Result<(), String> {
    for page_object_id in &page_context.page_object_ids {
        let annotation_objects = {
            let page_dictionary = document.get_dictionary(*page_object_id).map_err(|error| {
                format!("Failed to inspect PDF page {:?}: {error}", page_object_id)
            })?;
            page_dictionary
                .get(b"Annots")
                .ok()
                .and_then(|object| object.as_array().ok())
                .cloned()
                .unwrap_or_default()
        };

        let filtered_annotations = annotation_objects
            .into_iter()
            .filter(|annotation_object| match annotation_object.as_reference() {
                Ok(annotation_object_id) => {
                    !pdf_annotation_is_greeble_overlay(document, annotation_object_id)
                }
                Err(_) => true,
            })
            .collect::<Vec<_>>();

        let page_dictionary = document
            .get_dictionary_mut(*page_object_id)
            .map_err(|error| format!("Failed to inspect PDF page {:?}: {error}", page_object_id))?;
        if filtered_annotations.is_empty() {
            page_dictionary.remove(b"Annots");
        } else {
            page_dictionary.set("Annots", Object::Array(filtered_annotations));
        }
    }

    Ok(())
}

fn pdf_annotation_is_greeble_overlay(document: &Document, annotation_object_id: ObjectId) -> bool {
    document
        .get_dictionary(annotation_object_id)
        .ok()
        .and_then(|dictionary| dictionary.get(b"NM").ok())
        .and_then(object_text_string)
        .map(|value| value.starts_with(PDF_PREVIEW_OVERLAY_NAME_PREFIX))
        .unwrap_or(false)
}

fn build_pdf_overlay_annotation_dictionary(
    annotation: &PdfOverlayAnnotation,
    page_object_id: ObjectId,
    page_height: f32,
) -> Result<Dictionary, String> {
    let pdf_rect = preview_rect_to_pdf_rect(&annotation.bounds, page_height);
    let pdf_color = pdf_color_array(&annotation.color);
    let opacity = annotation.opacity.unwrap_or(1.0).clamp(0.0, 1.0);
    let stroke_width = annotation.stroke_width.unwrap_or(2.0).max(0.5);
    let annotation_name = format!("{PDF_PREVIEW_OVERLAY_NAME_PREFIX}{}", annotation.id);

    let mut dictionary = match annotation.kind {
        PdfOverlayAnnotationKind::Text => {
            let text = annotation.text.clone().unwrap_or_default();
            let (red, green, blue) = pdf_text_rgb_components(&annotation.color);
            dictionary! {
                "Type" => "Annot",
                "Subtype" => "FreeText",
                "Rect" => pdf_rect_to_object_array(&pdf_rect),
                "Contents" => Object::string_literal(text),
                "DA" => Object::string_literal(format!("/Helv 12 Tf {red:.4} {green:.4} {blue:.4} rg")),
                "C" => Object::Array(pdf_color),
                "CA" => opacity,
                "NM" => Object::string_literal(annotation_name),
                "P" => page_object_id,
                "F" => 4,
                "Q" => 0,
                "Border" => Object::Array(vec![0.into(), 0.into(), 0.into()]),
            }
        }
        PdfOverlayAnnotationKind::Rect => dictionary! {
            "Type" => "Annot",
            "Subtype" => "Square",
            "Rect" => pdf_rect_to_object_array(&pdf_rect),
            "C" => Object::Array(pdf_color),
            "CA" => opacity,
            "NM" => Object::string_literal(annotation_name),
            "P" => page_object_id,
            "F" => 4,
            "Border" => Object::Array(vec![0.into(), 0.into(), stroke_width.into()]),
        },
        PdfOverlayAnnotationKind::Highlight => dictionary! {
            "Type" => "Annot",
            "Subtype" => "Highlight",
            "Rect" => pdf_rect_to_object_array(&pdf_rect),
            "QuadPoints" => Object::Array(pdf_highlight_quad_points(&annotation.bounds, page_height)),
            "C" => Object::Array(pdf_color),
            "CA" => opacity,
            "NM" => Object::string_literal(annotation_name),
            "P" => page_object_id,
            "F" => 4,
        },
        PdfOverlayAnnotationKind::Arrow => dictionary! {
            "Type" => "Annot",
            "Subtype" => "Ink",
            "Rect" => pdf_rect_to_object_array(&pdf_rect),
            "InkList" => Object::Array(pdf_arrow_ink_paths(annotation, page_height)),
            "C" => Object::Array(pdf_color),
            "CA" => opacity,
            "NM" => Object::string_literal(annotation_name),
            "P" => page_object_id,
            "F" => 4,
            "Border" => Object::Array(vec![0.into(), 0.into(), stroke_width.into()]),
        },
        PdfOverlayAnnotationKind::Signature => dictionary! {
            "Type" => "Annot",
            "Subtype" => "Ink",
            "Rect" => pdf_rect_to_object_array(&pdf_rect),
            "InkList" => Object::Array(vec![Object::Array(pdf_signature_ink_points(annotation, page_height))]),
            "C" => Object::Array(pdf_color),
            "CA" => opacity,
            "NM" => Object::string_literal(annotation_name),
            "P" => page_object_id,
            "F" => 4,
            "Border" => Object::Array(vec![0.into(), 0.into(), stroke_width.into()]),
        },
    };

    dictionary.set("M", Object::string_literal(pdf_modification_timestamp()));
    Ok(dictionary)
}

fn preview_rect_to_pdf_rect(rect: &PdfPageRect, page_height: f32) -> PdfPageRect {
    PdfPageRect {
        x: rect.x,
        y: page_height - (rect.y + rect.height),
        width: rect.width,
        height: rect.height,
    }
}

fn pdf_rect_to_object_array(rect: &PdfPageRect) -> Object {
    Object::Array(vec![
        rect.x.into(),
        rect.y.into(),
        (rect.x + rect.width).into(),
        (rect.y + rect.height).into(),
    ])
}

fn pdf_color_array(color: &PdfColorValue) -> Vec<Object> {
    vec![
        (f32::from(color.red) / 255.0).into(),
        (f32::from(color.green) / 255.0).into(),
        (f32::from(color.blue) / 255.0).into(),
    ]
}

fn pdf_text_rgb_components(color: &PdfColorValue) -> (f32, f32, f32) {
    (
        f32::from(color.red) / 255.0,
        f32::from(color.green) / 255.0,
        f32::from(color.blue) / 255.0,
    )
}

fn pdf_highlight_quad_points(rect: &PdfPageRect, page_height: f32) -> Vec<Object> {
    let pdf_rect = preview_rect_to_pdf_rect(rect, page_height);
    let left = pdf_rect.x;
    let right = pdf_rect.x + pdf_rect.width;
    let bottom = pdf_rect.y;
    let top = pdf_rect.y + pdf_rect.height;
    vec![
        left.into(),
        top.into(),
        right.into(),
        top.into(),
        left.into(),
        bottom.into(),
        right.into(),
        bottom.into(),
    ]
}

fn pdf_signature_ink_points(annotation: &PdfOverlayAnnotation, page_height: f32) -> Vec<Object> {
    let points = if annotation.points.is_empty() {
        vec![
            PdfPoint {
                x: annotation.bounds.x,
                y: annotation.bounds.y,
            },
            PdfPoint {
                x: annotation.bounds.x + annotation.bounds.width,
                y: annotation.bounds.y + annotation.bounds.height,
            },
        ]
    } else {
        annotation.points.clone()
    };

    points
        .into_iter()
        .flat_map(|point| {
            let pdf_y = page_height - point.y;
            [Object::from(point.x), Object::from(pdf_y)]
        })
        .collect()
}

fn pdf_arrow_ink_paths(annotation: &PdfOverlayAnnotation, page_height: f32) -> Vec<Object> {
    let points = if annotation.points.len() >= 2 {
        annotation.points.clone()
    } else {
        vec![
            PdfPoint {
                x: annotation.bounds.x,
                y: annotation.bounds.y + annotation.bounds.height,
            },
            PdfPoint {
                x: annotation.bounds.x + annotation.bounds.width,
                y: annotation.bounds.y,
            },
        ]
    };

    let start = points
        .first()
        .cloned()
        .unwrap_or(PdfPoint { x: 0.0, y: 0.0 });
    let end = points
        .last()
        .cloned()
        .unwrap_or(PdfPoint { x: 0.0, y: 0.0 });
    let dx = end.x - start.x;
    let dy = end.y - start.y;
    let length = (dx * dx + dy * dy).sqrt().max(1.0);
    let unit_x = dx / length;
    let unit_y = dy / length;
    let head_length = (annotation.stroke_width.unwrap_or(2.0).max(2.0) * 4.0).max(10.0);
    let left_head = PdfPoint {
        x: end.x - head_length * (unit_x * 0.866 - unit_y * 0.5),
        y: end.y - head_length * (unit_y * 0.866 + unit_x * 0.5),
    };
    let right_head = PdfPoint {
        x: end.x - head_length * (unit_x * 0.866 + unit_y * 0.5),
        y: end.y - head_length * (unit_y * 0.866 - unit_x * 0.5),
    };

    vec![
        Object::Array(pdf_point_path_to_object_array(&points, page_height)),
        Object::Array(pdf_point_path_to_object_array(
            &[end.clone(), left_head],
            page_height,
        )),
        Object::Array(pdf_point_path_to_object_array(
            &[end, right_head],
            page_height,
        )),
    ]
}

fn pdf_point_path_to_object_array(points: &[PdfPoint], page_height: f32) -> Vec<Object> {
    points
        .iter()
        .flat_map(|point| [Object::from(point.x), Object::from(page_height - point.y)])
        .collect()
}

fn pdf_modification_timestamp() -> String {
    let epoch_seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or_default();
    format!("D:{epoch_seconds}")
}

#[cfg(test)]
mod tests {
    use super::*;
    use lopdf::Stream;
    use tempfile::tempdir;

    #[derive(Clone, Copy)]
    struct TestPdfOptions {
        with_xfa: bool,
        with_fake_encrypt: bool,
    }

    impl TestPdfOptions {
        const fn plain() -> Self {
            Self {
                with_xfa: false,
                with_fake_encrypt: false,
            }
        }

        const fn with_xfa() -> Self {
            Self {
                with_xfa: true,
                with_fake_encrypt: false,
            }
        }

        const fn with_fake_encrypt() -> Self {
            Self {
                with_xfa: false,
                with_fake_encrypt: true,
            }
        }
    }

    #[test]
    fn pdf_preview_open_render_and_save_roundtrip() {
        let temp_dir = tempdir().expect("temp dir");
        let pdf_path = temp_dir.path().join("roundtrip.pdf");
        let widget_id = write_test_pdf(&pdf_path, TestPdfOptions::plain()).expect("write test pdf");

        let manager = PdfPreviewManager::default();
        let preview_document = manager
            .open_preview_document(pdf_path.to_string_lossy().into_owned())
            .expect("open preview document");
        assert_eq!(preview_document.page_count, 1);
        assert_eq!(preview_document.form_fields.len(), 1);

        let field_descriptor = &preview_document.form_fields[0];
        assert_eq!(field_descriptor.kind, PdfFormFieldKind::Text);
        assert_eq!(field_descriptor.string_value.as_deref(), Some("Before"));

        let render_request = PdfPageRenderRequest {
            session_id: preview_document.session_id.clone(),
            page_index: 0,
            zoom_scale: 1.0,
            fit_mode: PdfPageRenderFitMode::None,
            viewport_width_px: 800,
            viewport_height_px: 1000,
        };
        let render_result = manager
            .render_preview_page(render_request.clone())
            .expect("render preview page");
        assert!(render_result
            .image_data_url
            .starts_with("data:image/png;base64,"));
        assert!(render_result.rendered_width_px > 0);
        assert!(render_result.rendered_height_px > 0);

        let save_result = manager
            .save_preview_edits(PdfSaveEditsRequest {
                session_id: preview_document.session_id.clone(),
                form_updates: vec![PdfFormValueUpdate {
                    field_id: field_descriptor.field_id.clone(),
                    string_value: Some("After".to_string()),
                    bool_value: None,
                    selected_values: Vec::new(),
                }],
                page_overlays: vec![PdfPageOverlayEdits {
                    page_index: 0,
                    annotations: vec![PdfOverlayAnnotation {
                        id: "rect-1".to_string(),
                        kind: PdfOverlayAnnotationKind::Rect,
                        bounds: PdfPageRect {
                            x: 64.0,
                            y: 64.0,
                            width: 96.0,
                            height: 42.0,
                        },
                        points: Vec::new(),
                        text: None,
                        color: PdfColorValue {
                            red: 245,
                            green: 158,
                            blue: 11,
                            alpha: 255,
                        },
                        stroke_width: Some(3.0),
                        opacity: Some(0.85),
                    }],
                }],
            })
            .expect("save preview edits");

        assert_eq!(save_result.document.page_count, 1);
        assert_eq!(save_result.document.form_fields.len(), 1);
        assert_eq!(
            save_result.document.form_fields[0].string_value.as_deref(),
            Some("After")
        );

        let rerender_result = manager
            .render_preview_page(render_request)
            .expect("rerender preview page after save");
        assert!(rerender_result
            .image_data_url
            .starts_with("data:image/png;base64,"));

        let reopened = Document::load(&pdf_path).expect("reload saved pdf");
        let field_dictionary = reopened
            .get_dictionary(widget_id)
            .expect("field dictionary should exist");
        let field_value = field_dictionary
            .get(b"V")
            .expect("field value should exist")
            .as_string()
            .expect("field value should be string")
            .into_owned();
        assert_eq!(field_value, "After");

        let (_, page_object_id) = reopened
            .get_pages()
            .into_iter()
            .next()
            .expect("page should exist");
        let page_dictionary = reopened
            .get_dictionary(page_object_id)
            .expect("page dictionary should exist");
        let page_annotations = page_dictionary
            .get(b"Annots")
            .expect("page annotations should exist")
            .as_array()
            .expect("annotations should be an array");
        assert!(
            page_annotations.iter().any(|annotation_object| {
                annotation_object
                    .as_reference()
                    .ok()
                    .and_then(|annotation_id| reopened.get_dictionary(annotation_id).ok())
                    .and_then(|annotation_dictionary| annotation_dictionary.get(b"NM").ok())
                    .and_then(object_text_string)
                    .map(|name| name.starts_with(PDF_PREVIEW_OVERLAY_NAME_PREFIX))
                    .unwrap_or(false)
            }),
            "saved PDF should contain a GreebleFS overlay annotation",
        );
    }

    #[test]
    fn pdf_preview_save_rejects_xfa_documents() {
        let temp_dir = tempdir().expect("temp dir");
        let pdf_path = temp_dir.path().join("xfa.pdf");
        write_test_pdf(&pdf_path, TestPdfOptions::with_xfa()).expect("write xfa pdf");

        let error = save_pdf_preview_edits_to_file(
            &pdf_path,
            &PdfSaveEditsRequest {
                session_id: "test-session".to_string(),
                form_updates: Vec::new(),
                page_overlays: Vec::new(),
            },
        )
        .expect_err("xfa document should be rejected");

        assert!(error.contains("does not support XFA forms"));
    }

    #[test]
    fn pdf_preview_save_rejects_password_locked_documents() {
        let temp_dir = tempdir().expect("temp dir");
        let pdf_path = temp_dir.path().join("encrypted.pdf");
        write_test_pdf(&pdf_path, TestPdfOptions::with_fake_encrypt())
            .expect("write encrypted pdf");

        let error = save_pdf_preview_edits_to_file(
            &pdf_path,
            &PdfSaveEditsRequest {
                session_id: "test-session".to_string(),
                form_updates: Vec::new(),
                page_overlays: Vec::new(),
            },
        )
        .expect_err("encrypted document should be rejected");

        assert!(error.contains("password-locked files"));
    }

    fn write_test_pdf(path: &Path, options: TestPdfOptions) -> Result<ObjectId, String> {
        let mut document = Document::with_version("1.7");
        let pages_id = document.new_object_id();
        let page_id = document.new_object_id();
        let widget_id = document.new_object_id();
        let acro_form_id = document.new_object_id();
        let catalog_id = document.new_object_id();
        let font_id = document.add_object(dictionary! {
            "Type" => "Font",
            "Subtype" => "Type1",
            "BaseFont" => "Helvetica",
        });
        let content_id = document.add_object(Stream::new(
            dictionary! {},
            b"BT /Helv 18 Tf 72 180 Td (Hello PDF) Tj ET".to_vec(),
        ));

        let mut widget_dictionary = dictionary! {
            "Type" => "Annot",
            "Subtype" => "Widget",
            "FT" => "Tx",
            "T" => Object::string_literal("customer_name"),
            "V" => Object::string_literal("Before"),
            "Rect" => Object::Array(vec![50.into(), 200.into(), 250.into(), 230.into()]),
            "P" => page_id,
            "DA" => Object::string_literal("/Helv 12 Tf 0 g"),
            "F" => 4,
        };
        widget_dictionary.set("MK", Object::Dictionary(dictionary! {}));

        let resources_dictionary = dictionary! {
            "Font" => Object::Dictionary(dictionary! {
                "Helv" => font_id,
            }),
        };
        let page_dictionary = dictionary! {
            "Type" => "Page",
            "Parent" => pages_id,
            "MediaBox" => Object::Array(vec![0.into(), 0.into(), 300.into(), 300.into()]),
            "Resources" => Object::Dictionary(resources_dictionary),
            "Contents" => content_id,
            "Annots" => Object::Array(vec![Object::Reference(widget_id)]),
        };
        let pages_dictionary = dictionary! {
            "Type" => "Pages",
            "Kids" => Object::Array(vec![Object::Reference(page_id)]),
            "Count" => 1,
        };

        let mut acro_form_dictionary = dictionary! {
            "Fields" => Object::Array(vec![Object::Reference(widget_id)]),
            "DA" => Object::string_literal("/Helv 12 Tf 0 g"),
            "DR" => Object::Dictionary(dictionary! {
                "Font" => Object::Dictionary(dictionary! {
                    "Helv" => font_id,
                }),
            }),
        };
        if options.with_xfa {
            acro_form_dictionary.set("XFA", Object::string_literal("<xfa/>"));
        }

        let catalog_dictionary = dictionary! {
            "Type" => "Catalog",
            "Pages" => pages_id,
            "AcroForm" => acro_form_id,
        };

        document
            .objects
            .insert(page_id, Object::Dictionary(page_dictionary));
        document
            .objects
            .insert(pages_id, Object::Dictionary(pages_dictionary));
        document
            .objects
            .insert(widget_id, Object::Dictionary(widget_dictionary));
        document
            .objects
            .insert(acro_form_id, Object::Dictionary(acro_form_dictionary));
        document
            .objects
            .insert(catalog_id, Object::Dictionary(catalog_dictionary));
        document.trailer.set("Root", catalog_id);

        if options.with_fake_encrypt {
            let encrypt_id = document.add_object(dictionary! {
                "Filter" => "Standard",
                "V" => 1,
                "R" => 2,
                "O" => Object::string_literal("owner"),
                "U" => Object::string_literal("user"),
                "P" => -4,
            });
            document.trailer.set("Encrypt", encrypt_id);
        }

        document.compress();
        document
            .save(path)
            .map_err(|error| format!("Failed to write test PDF '{}': {error}", path.display()))?;

        Ok(widget_id)
    }
}
