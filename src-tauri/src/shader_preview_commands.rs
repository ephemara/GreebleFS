use naga::valid::{Capabilities, ValidationFlags, Validator};
use regex::Regex;
use serde::{Deserialize, Serialize};
use shaderc::{CompileOptions, Compiler, IncludeType, ResolvedInclude, ShaderKind, SourceLanguage};
use std::fs;
use std::path::{Path, PathBuf};

const GREEBLEFS_SHADER_PREVIEW_ABI_V1: &str = concat!(
    "GreebleFS Shader Preview ABI v1\n",
    "- Vertex preview expects vertex inputs at locations 0(position vec3), 1(normal vec3), and 2(uv vec2).\n",
    "- Fragment preview receives host-provided fullscreen or sphere varyings and must compile as a fragment entry point.\n",
    "- Compute preview may write to @group(0) @binding(0) storage texture output and may read a host uniform buffer at @group(0) @binding(1).\n",
    "- Shaders that compile but do not fit the live host pipeline remain inspectable in the shader workbench.",
);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "lowercase")]
pub enum ExplorerShaderFormat {
    Wgsl,
    Hlsl,
    Spv,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "lowercase")]
pub enum ExplorerShaderStage {
    Vertex,
    Fragment,
    Compute,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "lowercase")]
pub enum ExplorerShaderDiagnosticSeverity {
    Error,
    Warning,
    Info,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ExplorerShaderDiagnostic {
    pub severity: ExplorerShaderDiagnosticSeverity,
    pub message: String,
    pub line_number: Option<u32>,
    pub column_number: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ExplorerShaderEntryPoint {
    pub name: String,
    pub stage: ExplorerShaderStage,
    pub supports_live_preview: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ExplorerShaderPreviewDocument {
    pub path: String,
    pub name: String,
    pub format: ExplorerShaderFormat,
    pub editable_source: Option<String>,
    pub inspection_source: String,
    pub is_read_only: bool,
    pub selected_stage: Option<ExplorerShaderStage>,
    pub selected_entry_point: Option<String>,
    pub entry_points: Vec<ExplorerShaderEntryPoint>,
    pub diagnostics: Vec<ExplorerShaderDiagnostic>,
    pub normalized_wgsl: Option<String>,
    pub supports_live_preview: bool,
    pub preview_abi: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ExplorerShaderCompileRequest {
    pub path: String,
    pub format: ExplorerShaderFormat,
    pub source_text: Option<String>,
    pub selected_stage: Option<ExplorerShaderStage>,
    pub selected_entry_point: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ExplorerShaderCompileResult {
    pub format: ExplorerShaderFormat,
    pub inspection_source: String,
    pub entry_points: Vec<ExplorerShaderEntryPoint>,
    pub selected_stage: Option<ExplorerShaderStage>,
    pub selected_entry_point: Option<String>,
    pub diagnostics: Vec<ExplorerShaderDiagnostic>,
    pub normalized_wgsl: Option<String>,
    pub supports_live_preview: bool,
    pub preview_abi: String,
}

struct ShaderInspectionPayload {
    format: ExplorerShaderFormat,
    editable_source: Option<String>,
    inspection_source: String,
    entry_points: Vec<ExplorerShaderEntryPoint>,
    selected_stage: Option<ExplorerShaderStage>,
    selected_entry_point: Option<String>,
    diagnostics: Vec<ExplorerShaderDiagnostic>,
    normalized_wgsl: Option<String>,
    supports_live_preview: bool,
}

#[tauri::command]
#[specta::specta]
pub async fn shader_preview_inspect(path: String) -> Result<ExplorerShaderPreviewDocument, String> {
    tauri::async_runtime::spawn_blocking(move || inspect_shader_preview_document(&path))
        .await
        .map_err(|error| format!("Shader preview inspect task failed: {error}"))?
}

#[tauri::command]
#[specta::specta]
pub async fn shader_preview_compile(
    request: ExplorerShaderCompileRequest,
) -> Result<ExplorerShaderCompileResult, String> {
    tauri::async_runtime::spawn_blocking(move || compile_shader_preview_document(&request))
        .await
        .map_err(|error| format!("Shader preview compile task failed: {error}"))?
}

fn inspect_shader_preview_document(path: &str) -> Result<ExplorerShaderPreviewDocument, String> {
    let format = detect_shader_format(path)?;
    let input_path = PathBuf::from(path);
    let name = input_path
        .file_name()
        .map(|value| value.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.to_string());

    let payload = match format {
        ExplorerShaderFormat::Wgsl => {
            let source = fs::read_to_string(&input_path).map_err(|error| {
                format!("Failed to read WGSL source '{}': {error}", input_path.display())
            })?;
            inspect_text_shader_source(
                &input_path,
                format,
                &source,
                None,
                None,
                true,
            )
        }
        ExplorerShaderFormat::Hlsl => {
            let source = fs::read_to_string(&input_path).map_err(|error| {
                format!("Failed to read HLSL source '{}': {error}", input_path.display())
            })?;
            inspect_text_shader_source(
                &input_path,
                format,
                &source,
                None,
                None,
                true,
            )
        }
        ExplorerShaderFormat::Spv => {
            let bytes = fs::read(&input_path).map_err(|error| {
                format!("Failed to read SPIR-V source '{}': {error}", input_path.display())
            })?;
            inspect_spirv_shader_source(&input_path, &bytes, None, None)
        }
    };

    Ok(ExplorerShaderPreviewDocument {
        path: path.to_string(),
        name,
        format,
        editable_source: payload.editable_source,
        inspection_source: payload.inspection_source,
        is_read_only: format == ExplorerShaderFormat::Spv,
        selected_stage: payload.selected_stage,
        selected_entry_point: payload.selected_entry_point,
        entry_points: payload.entry_points,
        diagnostics: payload.diagnostics,
        normalized_wgsl: payload.normalized_wgsl,
        supports_live_preview: payload.supports_live_preview,
        preview_abi: GREEBLEFS_SHADER_PREVIEW_ABI_V1.to_string(),
    })
}

fn compile_shader_preview_document(
    request: &ExplorerShaderCompileRequest,
) -> Result<ExplorerShaderCompileResult, String> {
    let input_path = PathBuf::from(&request.path);
    let payload = match request.format {
        ExplorerShaderFormat::Wgsl => {
            let source = request
                .source_text
                .clone()
                .ok_or_else(|| "WGSL compile requests require sourceText.".to_string())?;
            inspect_text_shader_source(
                &input_path,
                ExplorerShaderFormat::Wgsl,
                &source,
                request.selected_stage,
                request.selected_entry_point.as_deref(),
                false,
            )
        }
        ExplorerShaderFormat::Hlsl => {
            let source = request
                .source_text
                .clone()
                .ok_or_else(|| "HLSL compile requests require sourceText.".to_string())?;
            inspect_text_shader_source(
                &input_path,
                ExplorerShaderFormat::Hlsl,
                &source,
                request.selected_stage,
                request.selected_entry_point.as_deref(),
                false,
            )
        }
        ExplorerShaderFormat::Spv => {
            let bytes = fs::read(&input_path).map_err(|error| {
                format!("Failed to read SPIR-V source '{}': {error}", input_path.display())
            })?;
            inspect_spirv_shader_source(
                &input_path,
                &bytes,
                request.selected_stage,
                request.selected_entry_point.as_deref(),
            )
        }
    }?;

    Ok(ExplorerShaderCompileResult {
        format: request.format,
        inspection_source: payload.inspection_source,
        entry_points: payload.entry_points,
        selected_stage: payload.selected_stage,
        selected_entry_point: payload.selected_entry_point,
        diagnostics: payload.diagnostics,
        normalized_wgsl: payload.normalized_wgsl,
        supports_live_preview: payload.supports_live_preview,
        preview_abi: GREEBLEFS_SHADER_PREVIEW_ABI_V1.to_string(),
    })
}

fn inspect_text_shader_source(
    input_path: &Path,
    format: ExplorerShaderFormat,
    source: &str,
    requested_stage: Option<ExplorerShaderStage>,
    requested_entry_point: Option<&str>,
    include_editable_source: bool,
) -> Result<ShaderInspectionPayload, String> {
    match format {
        ExplorerShaderFormat::Wgsl => inspect_wgsl_shader_source(
            source,
            requested_stage,
            requested_entry_point,
            include_editable_source,
        ),
        ExplorerShaderFormat::Hlsl => inspect_hlsl_shader_source(
            input_path,
            source,
            requested_stage,
            requested_entry_point,
            include_editable_source,
        ),
        ExplorerShaderFormat::Spv => Err("SPIR-V must be inspected from bytes.".to_string()),
    }
}

fn inspect_wgsl_shader_source(
    source: &str,
    requested_stage: Option<ExplorerShaderStage>,
    requested_entry_point: Option<&str>,
    include_editable_source: bool,
) -> Result<ShaderInspectionPayload, String> {
    let mut diagnostics = Vec::new();
    match naga::front::wgsl::parse_str(source) {
        Ok(module) => {
            let entry_points = reflect_module_entry_points(&module);
            let selection = resolve_entry_point_selection(
                &entry_points,
                requested_stage,
                requested_entry_point,
            );
            let normalized = validate_and_write_wgsl(&module).map_err(|error| {
                format!("WGSL validation failed: {error}")
            });

            match normalized {
                Ok(normalized_wgsl) => Ok(build_shader_payload(
                    include_editable_source.then(|| source.to_string()),
                    source.to_string(),
                    entry_points,
                    selection,
                    diagnostics,
                    Some(normalized_wgsl),
                )),
                Err(error) => {
                    diagnostics.push(ExplorerShaderDiagnostic {
                        severity: ExplorerShaderDiagnosticSeverity::Error,
                        message: error,
                        line_number: None,
                        column_number: None,
                    });
                    Ok(build_shader_payload(
                        include_editable_source.then(|| source.to_string()),
                        source.to_string(),
                        entry_points,
                        selection,
                        diagnostics,
                        None,
                    ))
                }
            }
        }
        Err(error) => {
            diagnostics.push(diagnostic_from_message(
                ExplorerShaderDiagnosticSeverity::Error,
                error.to_string(),
            ));
            Ok(build_shader_payload(
                include_editable_source.then(|| source.to_string()),
                source.to_string(),
                Vec::new(),
                (requested_stage, requested_entry_point.map(str::to_string)),
                diagnostics,
                None,
            ))
        }
    }
}

fn inspect_hlsl_shader_source(
    input_path: &Path,
    source: &str,
    requested_stage: Option<ExplorerShaderStage>,
    requested_entry_point: Option<&str>,
    include_editable_source: bool,
) -> Result<ShaderInspectionPayload, String> {
    let mut diagnostics = Vec::new();
    let inferred_entry_points = reflect_hlsl_entry_points(source);
    let selection = resolve_entry_point_selection(
        &inferred_entry_points,
        requested_stage,
        requested_entry_point,
    );

    let Some(selected_stage) = selection.0 else {
        if inferred_entry_points.is_empty() {
            diagnostics.push(ExplorerShaderDiagnostic {
                severity: ExplorerShaderDiagnosticSeverity::Info,
                message:
                    "Select a stage and entry point to compile this HLSL shader into previewable WGSL."
                        .to_string(),
                line_number: None,
                column_number: None,
            });
        }
        return Ok(build_shader_payload(
            include_editable_source.then(|| source.to_string()),
            source.to_string(),
            inferred_entry_points,
            selection,
            diagnostics,
            None,
        ));
    };

    let selected_entry_point = selection
        .1
        .clone()
        .unwrap_or_else(|| "main".to_string());
    match compile_hlsl_to_spirv(input_path, source, selected_stage, &selected_entry_point) {
        Ok(words) => {
            let spirv_payload = inspect_spirv_words(
                &words,
                Some(selected_stage),
                Some(selected_entry_point.as_str()),
            )?;
            Ok(build_shader_payload(
                include_editable_source.then(|| source.to_string()),
                source.to_string(),
                if spirv_payload.entry_points.is_empty() {
                    inferred_entry_points
                } else {
                    spirv_payload.entry_points
                },
                (
                    spirv_payload.selected_stage.or(Some(selected_stage)),
                    spirv_payload
                        .selected_entry_point
                        .or(Some(selected_entry_point)),
                ),
                spirv_payload.diagnostics,
                spirv_payload.normalized_wgsl,
            ))
        }
        Err(error) => {
            diagnostics.push(diagnostic_from_message(
                ExplorerShaderDiagnosticSeverity::Error,
                error,
            ));
            Ok(build_shader_payload(
                include_editable_source.then(|| source.to_string()),
                source.to_string(),
                inferred_entry_points,
                selection,
                diagnostics,
                None,
            ))
        }
    }
}

fn inspect_spirv_shader_source(
    input_path: &Path,
    bytes: &[u8],
    requested_stage: Option<ExplorerShaderStage>,
    requested_entry_point: Option<&str>,
) -> Result<ShaderInspectionPayload, String> {
    let words = decode_spirv_words(bytes)?;
    let mut payload = inspect_spirv_words(&words, requested_stage, requested_entry_point)?;
    payload.editable_source = None;
    payload.inspection_source = format_spirv_inspection_source(
        payload.normalized_wgsl.as_deref(),
        &words,
        input_path,
    );
    Ok(payload)
}

fn inspect_spirv_words(
    words: &[u32],
    requested_stage: Option<ExplorerShaderStage>,
    requested_entry_point: Option<&str>,
) -> Result<ShaderInspectionPayload, String> {
    let mut diagnostics = Vec::new();
    match naga::front::spv::parse_u8_slice(
        &encode_spirv_words(words),
        &naga::front::spv::Options::default(),
    ) {
        Ok(module) => {
            let entry_points = reflect_module_entry_points(&module);
            let selection = resolve_entry_point_selection(
                &entry_points,
                requested_stage,
                requested_entry_point,
            );
            match validate_and_write_wgsl(&module) {
                Ok(normalized_wgsl) => Ok(build_shader_payload(
                    None,
                    String::new(),
                    entry_points,
                    selection,
                    diagnostics,
                    Some(normalized_wgsl),
                )),
                Err(error) => {
                    diagnostics.push(diagnostic_from_message(
                        ExplorerShaderDiagnosticSeverity::Error,
                        format!("SPIR-V validation failed: {error}"),
                    ));
                    Ok(build_shader_payload(
                        None,
                        String::new(),
                        entry_points,
                        selection,
                        diagnostics,
                        None,
                    ))
                }
            }
        }
        Err(error) => {
            diagnostics.push(diagnostic_from_message(
                ExplorerShaderDiagnosticSeverity::Error,
                error.to_string(),
            ));
            Ok(build_shader_payload(
                None,
                String::new(),
                Vec::new(),
                (requested_stage, requested_entry_point.map(str::to_string)),
                diagnostics,
                None,
            ))
        }
    }
}

fn build_shader_payload(
    editable_source: Option<String>,
    inspection_source: String,
    entry_points: Vec<ExplorerShaderEntryPoint>,
    selection: (Option<ExplorerShaderStage>, Option<String>),
    diagnostics: Vec<ExplorerShaderDiagnostic>,
    normalized_wgsl: Option<String>,
) -> ShaderInspectionPayload {
    let supports_live_preview = normalized_wgsl.is_some()
        && selection.0.is_some()
        && selection.1.is_some();
    ShaderInspectionPayload {
        format: ExplorerShaderFormat::Wgsl,
        editable_source,
        inspection_source,
        entry_points,
        selected_stage: selection.0,
        selected_entry_point: selection.1,
        diagnostics,
        normalized_wgsl,
        supports_live_preview,
    }
}

fn validate_and_write_wgsl(module: &naga::Module) -> Result<String, String> {
    let info = Validator::new(ValidationFlags::all(), Capabilities::all())
        .subgroup_stages(naga::valid::ShaderStages::all())
        .subgroup_operations(naga::valid::SubgroupOperationSet::all())
        .validate(module)
        .map_err(|error| error.to_string())?;
    naga::back::wgsl::write_string(module, &info, naga::back::wgsl::WriterFlags::empty())
        .map_err(|error| error.to_string())
}

fn reflect_module_entry_points(module: &naga::Module) -> Vec<ExplorerShaderEntryPoint> {
    module
        .entry_points
        .iter()
        .map(|entry_point| ExplorerShaderEntryPoint {
            name: entry_point.name.clone(),
            stage: map_naga_stage(entry_point.stage),
            supports_live_preview: true,
        })
        .collect()
}

fn reflect_hlsl_entry_points(source: &str) -> Vec<ExplorerShaderEntryPoint> {
    let Ok(entry_point_regex) = Regex::new(
        r#"(?is)\[\s*shader\s*\(\s*"(?P<stage>vertex|pixel|fragment|compute)"\s*\)\s*\]\s*[A-Za-z0-9_<>,:\s\[\]]+\b(?P<name>[A-Za-z_][A-Za-z0-9_]*)\s*\("#,
    ) else {
        return Vec::new();
    };

    entry_point_regex
        .captures_iter(source)
        .filter_map(|captures| {
            let name = captures.name("name")?.as_str().to_string();
            let stage = match captures.name("stage")?.as_str().to_ascii_lowercase().as_str() {
                "vertex" => ExplorerShaderStage::Vertex,
                "pixel" | "fragment" => ExplorerShaderStage::Fragment,
                "compute" => ExplorerShaderStage::Compute,
                _ => return None,
            };
            Some(ExplorerShaderEntryPoint {
                name,
                stage,
                supports_live_preview: true,
            })
        })
        .collect()
}

fn resolve_entry_point_selection(
    entry_points: &[ExplorerShaderEntryPoint],
    requested_stage: Option<ExplorerShaderStage>,
    requested_entry_point: Option<&str>,
) -> (Option<ExplorerShaderStage>, Option<String>) {
    if let Some(entry_point_name) = requested_entry_point {
        let normalized_name = entry_point_name.trim();
        if let Some(entry_point) = entry_points.iter().find(|entry| {
            entry.name == normalized_name
                && requested_stage.map(|stage| stage == entry.stage).unwrap_or(true)
        }) {
            return (Some(entry_point.stage), Some(entry_point.name.clone()));
        }
    }

    if let Some(stage) = requested_stage {
        let stage_matches: Vec<&ExplorerShaderEntryPoint> = entry_points
            .iter()
            .filter(|entry| entry.stage == stage)
            .collect();
        if stage_matches.len() == 1 {
            return (Some(stage), Some(stage_matches[0].name.clone()));
        }
        if stage_matches.is_empty() {
            return (Some(stage), requested_entry_point.map(str::to_string));
        }
    }

    if entry_points.len() == 1 {
        return (
            Some(entry_points[0].stage),
            Some(entry_points[0].name.clone()),
        );
    }

    (
        requested_stage,
        requested_entry_point.map(str::to_string),
    )
}

fn compile_hlsl_to_spirv(
    input_path: &Path,
    source: &str,
    stage: ExplorerShaderStage,
    entry_point: &str,
) -> Result<Vec<u32>, String> {
    let compiler = Compiler::new().map_err(|error| format!("Failed to initialize shaderc: {error}"))?;
    let mut options = CompileOptions::new()
        .map_err(|error| format!("Failed to create shaderc compile options: {error}"))?;
    options.set_source_language(SourceLanguage::HLSL);
    options.set_hlsl_io_mapping(true);
    options.set_auto_map_locations(true);
    let include_root = input_path
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from("."));
    options.set_include_callback(move |requested_source, include_type, requesting_source, _depth| {
        resolve_shader_include(
            &include_root,
            requested_source,
            include_type,
            requesting_source,
        )
    });

    let artifact = compiler
        .compile_into_spirv(
            source,
            map_shaderc_stage(stage),
            &input_path.to_string_lossy(),
            entry_point,
            Some(&options),
        )
        .map_err(|error| error.to_string())?;
    Ok(artifact.as_binary().to_vec())
}

fn resolve_shader_include(
    include_root: &Path,
    requested_source: &str,
    include_type: IncludeType,
    requesting_source: &str,
) -> shaderc::IncludeCallbackResult {
    let requested_path = PathBuf::from(requested_source);
    let base_dir = match include_type {
        IncludeType::Relative => Path::new(requesting_source)
            .parent()
            .map(Path::to_path_buf)
            .unwrap_or_else(|| include_root.to_path_buf()),
        IncludeType::Standard => include_root.to_path_buf(),
    };
    let resolved_path = if requested_path.is_absolute() {
        requested_path
    } else {
        base_dir.join(requested_path)
    };
    let content = fs::read_to_string(&resolved_path).map_err(|error| {
        format!(
            "Failed to resolve shader include '{}' from '{}': {error}",
            requested_source, requesting_source
        )
    })?;
    Ok(ResolvedInclude {
        resolved_name: resolved_path.to_string_lossy().into_owned(),
        content,
    })
}

fn detect_shader_format(path: &str) -> Result<ExplorerShaderFormat, String> {
    let extension = Path::new(path)
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.trim().to_ascii_lowercase())
        .unwrap_or_default();
    match extension.as_str() {
        "wgsl" => Ok(ExplorerShaderFormat::Wgsl),
        "hlsl" => Ok(ExplorerShaderFormat::Hlsl),
        "spv" => Ok(ExplorerShaderFormat::Spv),
        _ => Err(format!(
            "Unsupported shader preview format for '{}'. Expected .wgsl, .hlsl, or .spv.",
            path
        )),
    }
}

fn decode_spirv_words(bytes: &[u8]) -> Result<Vec<u32>, String> {
    if bytes.is_empty() {
        return Err("SPIR-V preview source is empty.".to_string());
    }
    if bytes.len() % 4 != 0 {
        return Err("SPIR-V preview source length must be divisible by 4.".to_string());
    }
    Ok(bytes
        .chunks_exact(4)
        .map(|chunk| u32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]))
        .collect())
}

fn encode_spirv_words(words: &[u32]) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(words.len() * 4);
    for word in words {
        bytes.extend_from_slice(&word.to_le_bytes());
    }
    bytes
}

fn format_spirv_inspection_source(
    normalized_wgsl: Option<&str>,
    words: &[u32],
    input_path: &Path,
) -> String {
    let mut sections = Vec::new();
    if let Some(wgsl) = normalized_wgsl {
        sections.push(format!("// Generated WGSL for {}\n\n{}", input_path.display(), wgsl));
    }
    sections.push(format!(
        "// SPIR-V word dump for {}\n{}",
        input_path.display(),
        words.iter()
            .enumerate()
            .map(|(index, word)| format!("{index:04}: 0x{word:08x}"))
            .collect::<Vec<_>>()
            .join("\n")
    ));
    sections.join("\n\n")
}

fn diagnostic_from_message(
    severity: ExplorerShaderDiagnosticSeverity,
    message: String,
) -> ExplorerShaderDiagnostic {
    let location_regex = Regex::new(r"(?P<line>\d+):(?P<column>\d+)").ok();
    let location = location_regex.as_ref().and_then(|regex| regex.captures(&message));
    ExplorerShaderDiagnostic {
        severity,
        message,
        line_number: location
            .as_ref()
            .and_then(|captures| captures.name("line"))
            .and_then(|value| value.as_str().parse::<u32>().ok()),
        column_number: location
            .as_ref()
            .and_then(|captures| captures.name("column"))
            .and_then(|value| value.as_str().parse::<u32>().ok()),
    }
}

fn map_naga_stage(stage: naga::ShaderStage) -> ExplorerShaderStage {
    match stage {
        naga::ShaderStage::Vertex => ExplorerShaderStage::Vertex,
        naga::ShaderStage::Fragment => ExplorerShaderStage::Fragment,
        naga::ShaderStage::Compute => ExplorerShaderStage::Compute,
        _ => ExplorerShaderStage::Fragment,
    }
}

fn map_shaderc_stage(stage: ExplorerShaderStage) -> ShaderKind {
    match stage {
        ExplorerShaderStage::Vertex => ShaderKind::Vertex,
        ExplorerShaderStage::Fragment => ShaderKind::Fragment,
        ExplorerShaderStage::Compute => ShaderKind::Compute,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    const SIMPLE_WGSL: &str = r#"
@vertex
fn vertex_main(@location(0) position: vec3<f32>) -> @builtin(position) vec4<f32> {
    return vec4<f32>(position, 1.0);
}

@fragment
fn fragment_main() -> @location(0) vec4<f32> {
    return vec4<f32>(0.25, 0.5, 0.75, 1.0);
}
"#;

    const SIMPLE_HLSL: &str = r#"
struct VsOutput {
  float4 position : SV_Position;
};

[shader("vertex")]
VsOutput vertex_main(float3 position : POSITION) {
  VsOutput output;
  output.position = float4(position, 1.0);
  return output;
}

[shader("pixel")]
float4 fragment_main() : SV_Target0 {
  return float4(0.8, 0.3, 0.2, 1.0);
}
"#;

    #[test]
    fn inspect_wgsl_validates_and_reflects_entry_points() {
        let payload =
            inspect_wgsl_shader_source(SIMPLE_WGSL, None, None, true).expect("wgsl inspect");
        assert!(payload.normalized_wgsl.is_some());
        assert_eq!(payload.entry_points.len(), 2);
        assert!(payload
            .entry_points
            .iter()
            .any(|entry| entry.stage == ExplorerShaderStage::Vertex));
        assert!(payload.supports_live_preview);
    }

    #[test]
    fn reflect_hlsl_entry_points_reads_shader_attributes() {
        let entry_points = reflect_hlsl_entry_points(SIMPLE_HLSL);
        assert_eq!(entry_points.len(), 2);
        assert!(entry_points.iter().any(|entry| entry.name == "vertex_main"));
        assert!(entry_points.iter().any(|entry| entry.name == "fragment_main"));
    }

    #[test]
    fn compile_hlsl_normalizes_to_wgsl() {
        let workspace = tempdir().expect("tempdir");
        let source_path = workspace.path().join("preview.hlsl");
        fs::write(&source_path, SIMPLE_HLSL).expect("write hlsl");
        let payload = inspect_hlsl_shader_source(
            &source_path,
            SIMPLE_HLSL,
            Some(ExplorerShaderStage::Vertex),
            Some("vertex_main"),
            true,
        )
        .expect("hlsl inspect");
        assert!(payload.normalized_wgsl.is_some());
        assert!(payload.diagnostics.is_empty(), "{:?}", payload.diagnostics);
    }

    #[test]
    fn inspect_spirv_translates_to_wgsl() {
        let workspace = tempdir().expect("tempdir");
        let source_path = workspace.path().join("preview.hlsl");
        fs::write(&source_path, SIMPLE_HLSL).expect("write hlsl");
        let spirv_words = compile_hlsl_to_spirv(
            &source_path,
            SIMPLE_HLSL,
            ExplorerShaderStage::Vertex,
            "vertex_main",
        )
        .expect("compile hlsl");
        let spirv_bytes = encode_spirv_words(&spirv_words);
        let payload = inspect_spirv_shader_source(
            &workspace.path().join("preview.spv"),
            &spirv_bytes,
            Some(ExplorerShaderStage::Vertex),
            Some("vertex_main"),
        )
        .expect("inspect spv");
        assert!(payload.normalized_wgsl.is_some());
        assert!(payload.inspection_source.contains("SPIR-V word dump"));
    }

    #[test]
    fn supports_live_preview_for_supported_stages() {
        let payload =
            inspect_wgsl_shader_source(SIMPLE_WGSL, Some(ExplorerShaderStage::Fragment), Some("fragment_main"), true)
                .expect("wgsl inspect");
        assert!(payload.supports_live_preview);
    }

    #[test]
    fn hlsl_include_resolution_uses_source_directory() {
        let workspace = tempdir().expect("tempdir");
        let include_path = workspace.path().join("shared.hlsl");
        fs::write(
            &include_path,
            "float4 preview_color() { return float4(0.2, 0.4, 0.6, 1.0); }\n",
        )
        .expect("write include");
        let source_path = workspace.path().join("with_include.hlsl");
        fs::write(
            &source_path,
            r#"#include "shared.hlsl"
[shader("pixel")]
float4 fragment_main() : SV_Target0 {
  return preview_color();
}
"#,
        )
        .expect("write hlsl");
        let payload = inspect_hlsl_shader_source(
            &source_path,
            &fs::read_to_string(&source_path).expect("read hlsl"),
            Some(ExplorerShaderStage::Fragment),
            Some("fragment_main"),
            true,
        )
        .expect("inspect hlsl");
        assert!(payload.normalized_wgsl.is_some());
    }
}
