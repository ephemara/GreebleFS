use crate::fs_commands::{
    cancel_manual_explorer_task, complete_manual_explorer_task, create_manual_explorer_task_with_id,
    fail_manual_explorer_task, set_manual_explorer_task_cancel_context, update_manual_explorer_task,
    ExplorerTaskCancelContext, ExplorerTaskKind, ExplorerTaskRegistration, ExplorerTaskRetryContext,
};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Manager};
use zip::ZipArchive;

const SOX_VERSION: &str = "14.4.2";
const DEFAULT_WAVEFORM_BUCKET_COUNT: usize = 160;
const PREVIEW_PROXY_EXTENSION: &str = "wav";

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct AudioWaveformBucket {
    pub index: u32,
    pub peak_level: f64,
    pub rms_level: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct AudioPreviewAnalysis {
    pub input_path: String,
    pub duration_seconds: f64,
    pub sample_rate_hz: Option<u32>,
    pub channels: Option<u32>,
    pub encoding: Option<String>,
    pub bits_per_sample: Option<u32>,
    pub container_type: Option<String>,
    pub peak_level: f64,
    pub rms_level: f64,
    pub loudness_db: Option<f64>,
    pub headroom_db: Option<f64>,
    pub waveform_buckets: Vec<AudioWaveformBucket>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum AudioPreviewSourceKind {
    Direct,
    Proxy,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedAudioPreviewSource {
    pub task_id: Option<String>,
    pub source_path: String,
    pub source_kind: AudioPreviewSourceKind,
    pub mime_type: Option<String>,
    pub generated_from_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum AudioTransformMode {
    ExportClip,
    ExportNormalized,
    ConvertFormat,
    OverwriteOriginal,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct AudioTransformRequest {
    pub input_path: String,
    pub output_path: Option<String>,
    pub overwrite_existing: bool,
    pub mode: AudioTransformMode,
    pub trim_start_seconds: Option<f64>,
    pub trim_end_seconds: Option<f64>,
    pub fade_in_seconds: Option<f64>,
    pub fade_out_seconds: Option<f64>,
    pub normalize: Option<bool>,
    pub output_format: Option<String>,
    pub generate_spectrogram: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct AudioTransformResult {
    pub task_id: String,
    pub output_path: String,
    pub spectrogram_path: Option<String>,
    pub duration_seconds: Option<f64>,
    pub output_format: String,
    pub overwritten_original: bool,
    pub sox_binary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum AudioBatchProcessMode {
    Convert,
    Normalize,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct AudioBatchProcessRequest {
    pub input_paths: Vec<String>,
    pub recurse_directories: Option<bool>,
    pub mode: AudioBatchProcessMode,
    pub output_format: Option<String>,
    pub overwrite_existing: Option<bool>,
    pub output_directory: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct AudioBatchProcessResult {
    pub task_id: String,
    pub processed_paths: Vec<String>,
    pub skipped_paths: Vec<String>,
    pub failed_paths: Vec<String>,
    pub output_directory: Option<String>,
    pub sox_binary: String,
}

#[derive(Debug)]
struct AudioTaskRuntime {
    cancelled: AtomicBool,
    child: Mutex<Option<Child>>,
}

#[derive(Debug, Clone)]
struct SoxRuntime {
    executable_path: PathBuf,
    runtime_root: PathBuf,
}

#[derive(Debug, Clone)]
struct NormalizedAudioTransformRequest {
    input_path: PathBuf,
    output_path: PathBuf,
    final_output_path: PathBuf,
    overwrite_existing: bool,
    mode: AudioTransformMode,
    trim_start_seconds: Option<f64>,
    trim_end_seconds: Option<f64>,
    fade_in_seconds: Option<f64>,
    fade_out_seconds: Option<f64>,
    normalize: bool,
    output_format: String,
    generate_spectrogram: bool,
    overwrite_original: bool,
}

static AUDIO_TASKS: OnceLock<Mutex<HashMap<String, Arc<AudioTaskRuntime>>>> = OnceLock::new();
static SOX_RUNTIME_CACHE: OnceLock<Mutex<Option<SoxRuntime>>> = OnceLock::new();

fn audio_tasks() -> &'static Mutex<HashMap<String, Arc<AudioTaskRuntime>>> {
    AUDIO_TASKS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn sox_runtime_cache() -> &'static Mutex<Option<SoxRuntime>> {
    SOX_RUNTIME_CACHE.get_or_init(|| Mutex::new(None))
}

fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().to_string()
}

fn normalize_optional_string(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|candidate| !candidate.is_empty())
        .map(ToOwned::to_owned)
}

fn current_platform_tag() -> &'static str {
    #[cfg(target_os = "windows")]
    {
        "win32"
    }
    #[cfg(target_os = "macos")]
    {
        "darwin"
    }
    #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
    {
        "linux"
    }
}

fn sox_bundle_file_name() -> String {
    format!("sox-{SOX_VERSION}-{}.zip", current_platform_tag())
}

fn sox_bundle_root_name() -> String {
    format!("sox-{SOX_VERSION}-{}", current_platform_tag())
}

fn sox_executable_name() -> &'static str {
    #[cfg(target_os = "windows")]
    {
        "sox.exe"
    }
    #[cfg(not(target_os = "windows"))]
    {
        "sox"
    }
}

fn resolve_audio_runtime_root(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_local_data_dir()
        .map(|path| path.join("audio-workbench"))
        .map_err(|error| format!("Failed to resolve app local data directory: {error}"))
}

fn resolve_audio_temp_root(app: &AppHandle) -> Result<PathBuf, String> {
    let root = resolve_audio_runtime_root(app)?.join("temp");
    fs::create_dir_all(&root)
        .map_err(|error| format!("Failed to create audio temp directory '{}': {error}", root.display()))?;
    Ok(root)
}

fn candidate_sox_bundle_paths(app: &AppHandle) -> Vec<PathBuf> {
    let bundle_name = sox_bundle_file_name();
    let mut candidates = Vec::new();
    if let Some(path) = normalize_optional_string(std::env::var("GREEBLEFS_SOX_ARCHIVE").ok().as_deref()) {
        candidates.push(PathBuf::from(path));
    }
    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(resource_dir.join("packages").join("sox").join("bin").join(&bundle_name));
    }
    candidates.push(
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("packages")
            .join("sox")
            .join("bin")
            .join(&bundle_name),
    );
    candidates
}

fn ensure_unpacked_sox_runtime(app: &AppHandle) -> Result<SoxRuntime, String> {
    let mut cache = sox_runtime_cache()
        .lock()
        .map_err(|_| "SoX runtime cache lock was poisoned.".to_string())?;
    if let Some(runtime) = cache.as_ref() {
        if runtime.executable_path.exists() {
            return Ok(runtime.clone());
        }
    }

    let runtime_root = resolve_audio_runtime_root(app)?.join("sox").join(format!("{}-{SOX_VERSION}", current_platform_tag()));
    fs::create_dir_all(&runtime_root)
        .map_err(|error| format!("Failed to create SoX runtime directory '{}': {error}", runtime_root.display()))?;

    let executable_path = runtime_root.join(sox_bundle_root_name()).join(sox_executable_name());
    if !executable_path.exists() {
        let bundle_path = candidate_sox_bundle_paths(app)
            .into_iter()
            .find(|candidate| candidate.exists())
            .ok_or_else(|| format!("Unable to locate vendored SoX bundle '{}'.", sox_bundle_file_name()))?;
        unpack_sox_bundle(&bundle_path, &runtime_root)?;
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if executable_path.exists() {
            let mut permissions = fs::metadata(&executable_path)
                .map_err(|error| format!("Failed to stat SoX binary '{}': {error}", executable_path.display()))?
                .permissions();
            permissions.set_mode(0o755);
            fs::set_permissions(&executable_path, permissions).map_err(|error| {
                format!(
                    "Failed to set execute permissions on SoX binary '{}': {error}",
                    executable_path.display()
                )
            })?;
        }
    }

    let runtime = SoxRuntime {
        executable_path,
        runtime_root,
    };
    *cache = Some(runtime.clone());
    Ok(runtime)
}

fn unpack_sox_bundle(bundle_path: &Path, destination_root: &Path) -> Result<(), String> {
    let file = fs::File::open(bundle_path)
        .map_err(|error| format!("Failed to open SoX bundle '{}': {error}", bundle_path.display()))?;
    let mut archive = ZipArchive::new(file)
        .map_err(|error| format!("Failed to read SoX zip archive '{}': {error}", bundle_path.display()))?;
    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_err(|error| format!("Failed to read SoX zip entry {index}: {error}"))?;
        let Some(relative_path) = entry.enclosed_name().map(|path| path.to_path_buf()) else {
            continue;
        };
        let output_path = destination_root.join(relative_path);
        if entry.is_dir() {
            fs::create_dir_all(&output_path).map_err(|error| {
                format!("Failed to create extracted SoX directory '{}': {error}", output_path.display())
            })?;
            continue;
        }
        if let Some(parent) = output_path.parent() {
            fs::create_dir_all(parent).map_err(|error| {
                format!("Failed to create extracted SoX parent '{}': {error}", parent.display())
            })?;
        }
        let mut output = fs::File::create(&output_path)
            .map_err(|error| format!("Failed to create extracted SoX file '{}': {error}", output_path.display()))?;
        std::io::copy(&mut entry, &mut output)
            .map_err(|error| format!("Failed to extract SoX file '{}': {error}", output_path.display()))?;
        output
            .flush()
            .map_err(|error| format!("Failed to flush extracted SoX file '{}': {error}", output_path.display()))?;
    }
    Ok(())
}

fn apply_sox_runtime_environment(command: &mut Command, runtime: &SoxRuntime) {
    let binary_parent = runtime
        .executable_path
        .parent()
        .unwrap_or(runtime.runtime_root.as_path());
    #[cfg(target_os = "linux")]
    {
        let existing = std::env::var("LD_LIBRARY_PATH").ok();
        let mut value = path_to_string(binary_parent);
        if let Some(existing) = existing.filter(|candidate| !candidate.trim().is_empty()) {
            value.push(':');
            value.push_str(existing.trim());
        }
        command.env("LD_LIBRARY_PATH", value);
    }
    #[cfg(target_os = "macos")]
    {
        let existing = std::env::var("DYLD_LIBRARY_PATH").ok();
        let mut value = path_to_string(binary_parent);
        if let Some(existing) = existing.filter(|candidate| !candidate.trim().is_empty()) {
            value.push(':');
            value.push_str(existing.trim());
        }
        command.env("DYLD_LIBRARY_PATH", value);
    }
    #[cfg(target_os = "windows")]
    {
        let existing = std::env::var("PATH").ok().unwrap_or_default();
        let mut value = path_to_string(binary_parent);
        if !existing.trim().is_empty() {
            value.push(';');
            value.push_str(existing.trim());
        }
        command.env("PATH", value);
    }
}

fn sox_command(runtime: &SoxRuntime) -> Command {
    let mut command = Command::new(&runtime.executable_path);
    apply_sox_runtime_environment(&mut command, runtime);
    command
}

fn sox_info_scalar(runtime: &SoxRuntime, flag: &str, input_path: &Path) -> Result<Option<String>, String> {
    let output = sox_command(runtime)
        .args(["--i", flag])
        .arg(input_path)
        .output()
        .map_err(|error| format!("Failed to launch SoX info command: {error}"))?;
    if !output.status.success() {
        return Ok(None);
    }
    let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if value.is_empty() {
        Ok(None)
    } else {
        Ok(Some(value))
    }
}

fn parse_optional_u32(value: Option<String>) -> Option<u32> {
    value.and_then(|candidate| candidate.trim().parse::<u32>().ok())
}

fn parse_optional_f64(value: Option<String>) -> Option<f64> {
    value.and_then(|candidate| candidate.trim().parse::<f64>().ok())
}

fn analyze_waveform(runtime: &SoxRuntime, input_path: &Path) -> Result<(f64, f64, Vec<AudioWaveformBucket>), String> {
    let output = sox_command(runtime)
        .arg(input_path)
        .args(["-r", "8000", "-c", "1", "-b", "16", "-e", "signed-integer", "-t", "raw", "-"])
        .output()
        .map_err(|error| format!("Failed to launch SoX waveform analysis: {error}"))?;
    if !output.status.success() {
        let message = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(format!("SoX waveform analysis failed: {message}"));
    }
    let samples = pcm_samples_from_le_i16(&output.stdout);
    Ok(compute_waveform_buckets(&samples, DEFAULT_WAVEFORM_BUCKET_COUNT))
}

fn pcm_samples_from_le_i16(raw: &[u8]) -> Vec<f64> {
    raw.chunks_exact(2)
        .map(|chunk| i16::from_le_bytes([chunk[0], chunk[1]]) as f64 / i16::MAX as f64)
        .collect()
}

fn compute_waveform_buckets(samples: &[f64], bucket_count: usize) -> (f64, f64, Vec<AudioWaveformBucket>) {
    if samples.is_empty() || bucket_count == 0 {
        return (0.0, 0.0, Vec::new());
    }
    let mut peak = 0.0_f64;
    let mut square_sum = 0.0_f64;
    for sample in samples {
        let amplitude = sample.abs();
        peak = peak.max(amplitude);
        square_sum += sample * sample;
    }
    let rms = (square_sum / samples.len() as f64).sqrt();
    let bucket_size = (samples.len() as f64 / bucket_count as f64).ceil().max(1.0) as usize;
    let mut buckets = Vec::new();
    for (index, chunk) in samples.chunks(bucket_size).enumerate() {
        let mut bucket_peak = 0.0_f64;
        let mut bucket_square_sum = 0.0_f64;
        for sample in chunk {
            let amplitude = sample.abs();
            bucket_peak = bucket_peak.max(amplitude);
            bucket_square_sum += sample * sample;
        }
        let bucket_rms = if chunk.is_empty() {
            0.0
        } else {
            (bucket_square_sum / chunk.len() as f64).sqrt()
        };
        buckets.push(AudioWaveformBucket {
            index: index as u32,
            peak_level: bucket_peak,
            rms_level: bucket_rms,
        });
    }
    (peak, rms, buckets)
}

fn decibels_from_linear(value: f64) -> Option<f64> {
    if value > 0.0 {
        Some(20.0 * value.log10())
    } else {
        None
    }
}

fn headroom_from_peak(peak: f64) -> Option<f64> {
    if peak <= 0.0 {
        None
    } else {
        Some(20.0 * (1.0 / peak).log10())
    }
}

fn direct_audio_preview_mime_type(input_path: &Path) -> Option<String> {
    let extension = input_path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())?;
    let mime = match extension.as_str() {
        "aac" => "audio/aac",
        "aif" | "aiff" => "audio/aiff",
        "alac" | "m4a" | "m4b" => "audio/mp4",
        "flac" => "audio/flac",
        "mid" | "midi" => "audio/midi",
        "mp3" => "audio/mpeg",
        "oga" | "ogg" => "audio/ogg",
        "opus" => "audio/ogg; codecs=opus",
        "wav" | "wave" => "audio/wav",
        "weba" => "audio/webm",
        _ => return None,
    };
    Some(mime.to_string())
}

fn normalize_audio_transform_request(request: AudioTransformRequest) -> Result<NormalizedAudioTransformRequest, String> {
    let input_path = PathBuf::from(request.input_path.trim());
    if request.input_path.trim().is_empty() {
        return Err("Input audio path cannot be empty.".to_string());
    }
    if !input_path.exists() {
        return Err(format!("Input audio does not exist: {}", input_path.display()));
    }
    if !input_path.is_file() {
        return Err(format!("Input audio path is not a file: {}", input_path.display()));
    }
    let trim_start_seconds = request.trim_start_seconds.filter(|value| value.is_finite() && *value >= 0.0);
    let trim_end_seconds = request.trim_end_seconds.filter(|value| value.is_finite() && *value > 0.0);
    if let (Some(start), Some(end)) = (trim_start_seconds, trim_end_seconds) {
        if end <= start {
            return Err("Trim end must be greater than trim start.".to_string());
        }
    }
    let fade_in_seconds = request.fade_in_seconds.filter(|value| value.is_finite() && *value >= 0.0);
    let fade_out_seconds = request.fade_out_seconds.filter(|value| value.is_finite() && *value >= 0.0);
    let mode = request.mode.clone();
    let overwrite_original = matches!(mode, AudioTransformMode::OverwriteOriginal);
    let output_format = normalize_optional_string(request.output_format.as_deref())
        .unwrap_or_else(|| default_audio_output_format(&input_path, &mode));
    let requested_output_path = request
        .output_path
        .as_deref()
        .map(str::trim)
        .filter(|candidate| !candidate.is_empty())
        .map(PathBuf::from);
    let final_output_path = requested_output_path.unwrap_or_else(|| {
        build_default_audio_output_path(&input_path, &mode, output_format.as_str())
    });
    let output_path = if overwrite_original {
        build_overwrite_temp_path(&input_path, output_format.as_str())
    } else {
        final_output_path.clone()
    };
    if !overwrite_original && paths_match(&input_path, &output_path) {
        return Err("Audio export must write to a different output path unless overwrite-original is selected.".to_string());
    }
    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "Failed to create output directory '{}': {error}",
                parent.display()
            )
        })?;
    }
    if !overwrite_original && output_path.exists() && !request.overwrite_existing {
        return Err(format!(
            "Output path already exists and overwrite is disabled: {}",
            output_path.display()
        ));
    }
    Ok(NormalizedAudioTransformRequest {
        input_path,
        output_path,
        final_output_path,
        overwrite_existing: request.overwrite_existing,
        mode: mode.clone(),
        trim_start_seconds,
        trim_end_seconds,
        fade_in_seconds,
        fade_out_seconds,
        normalize: request.normalize.unwrap_or(matches!(mode, AudioTransformMode::ExportNormalized)),
        output_format,
        generate_spectrogram: request.generate_spectrogram.unwrap_or(false),
        overwrite_original,
    })
}

fn default_audio_output_format(input_path: &Path, mode: &AudioTransformMode) -> String {
    match mode {
        AudioTransformMode::ConvertFormat => "wav".to_string(),
        _ => input_path
            .extension()
            .and_then(|value| value.to_str())
            .map(|value| value.to_ascii_lowercase())
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| "wav".to_string()),
    }
}

fn build_default_audio_output_path(input_path: &Path, mode: &AudioTransformMode, output_format: &str) -> PathBuf {
    let parent = input_path.parent().unwrap_or_else(|| Path::new(""));
    let stem = input_path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("audio");
    let suffix = match mode {
        AudioTransformMode::ExportClip => "clip",
        AudioTransformMode::ExportNormalized => "normalized",
        AudioTransformMode::ConvertFormat => "converted",
        AudioTransformMode::OverwriteOriginal => "edited",
    };
    parent.join(format!("{stem}.{suffix}.{output_format}"))
}

fn build_overwrite_temp_path(input_path: &Path, output_format: &str) -> PathBuf {
    let parent = input_path.parent().unwrap_or_else(|| Path::new(""));
    let stem = input_path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("audio");
    parent.join(format!("{stem}.greeblefs-overwrite.{output_format}"))
}

fn build_audio_transform_registration(request: &NormalizedAudioTransformRequest) -> ExplorerTaskRegistration {
    let title = match request.mode {
        AudioTransformMode::ExportClip => "Export Audio Clip",
        AudioTransformMode::ExportNormalized => "Export Normalized Audio",
        AudioTransformMode::ConvertFormat => "Convert Audio Format",
        AudioTransformMode::OverwriteOriginal => "Overwrite Audio Original",
    };
    let fallback_name = path_to_string(&request.input_path);
    let file_name = request
        .input_path
        .file_name()
        .and_then(|value| value.to_str())
        .map(ToOwned::to_owned)
        .unwrap_or(fallback_name);
    ExplorerTaskRegistration {
        kind: ExplorerTaskKind::AudioTransform,
        title: title.to_string(),
        detail: format!("Processing {file_name}"),
        source_paths: vec![path_to_string(&request.input_path)],
        destination_path: Some(path_to_string(&request.final_output_path)),
        retry_context: Some(ExplorerTaskRetryContext::AudioTransform {
            request: AudioTransformRequest {
                input_path: path_to_string(&request.input_path),
                output_path: Some(path_to_string(&request.final_output_path)),
                overwrite_existing: request.overwrite_existing,
                mode: request.mode.clone(),
                trim_start_seconds: request.trim_start_seconds,
                trim_end_seconds: request.trim_end_seconds,
                fade_in_seconds: request.fade_in_seconds,
                fade_out_seconds: request.fade_out_seconds,
                normalize: Some(request.normalize),
                output_format: Some(request.output_format.clone()),
                generate_spectrogram: Some(request.generate_spectrogram),
            },
        }),
        can_undo: false,
    }
}

fn build_audio_batch_registration(request: &AudioBatchProcessRequest, inputs: &[PathBuf]) -> ExplorerTaskRegistration {
    let title = match request.mode {
        AudioBatchProcessMode::Convert => "Batch Convert Audio",
        AudioBatchProcessMode::Normalize => "Batch Normalize Audio",
    };
    ExplorerTaskRegistration {
        kind: ExplorerTaskKind::AudioBatchProcess,
        title: title.to_string(),
        detail: format!("Processing {} audio item(s)", inputs.len()),
        source_paths: inputs.iter().map(|path| path_to_string(path)).collect(),
        destination_path: request.output_directory.clone(),
        retry_context: Some(ExplorerTaskRetryContext::AudioBatchProcess {
            request: request.clone(),
        }),
        can_undo: false,
    }
}

fn register_audio_runtime(task_id: &str) -> Result<Arc<AudioTaskRuntime>, String> {
    let runtime = Arc::new(AudioTaskRuntime {
        cancelled: AtomicBool::new(false),
        child: Mutex::new(None),
    });
    let mut tasks = audio_tasks()
        .lock()
        .map_err(|_| "Audio task registry lock was poisoned.".to_string())?;
    tasks.insert(task_id.to_string(), runtime.clone());
    Ok(runtime)
}

fn unregister_audio_runtime(task_id: &str) {
    if let Ok(mut tasks) = audio_tasks().lock() {
        tasks.remove(task_id);
    }
}

pub fn cancel_audio_task(task_id: &str) -> Result<(), String> {
    let runtime = audio_tasks()
        .lock()
        .map_err(|_| "Audio task registry lock was poisoned.".to_string())?
        .get(task_id)
        .cloned()
        .ok_or_else(|| format!("Audio task runtime not found: {task_id}"))?;
    runtime.cancelled.store(true, Ordering::SeqCst);
    if let Ok(mut child_guard) = runtime.child.lock() {
        if let Some(child) = child_guard.as_mut() {
            let _ = child.kill();
        }
    }
    Ok(())
}

fn spawn_sox_and_wait(
    task_runtime: &Arc<AudioTaskRuntime>,
    mut command: Command,
) -> Result<std::process::Output, String> {
    command.stdout(Stdio::piped()).stderr(Stdio::piped());
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    let child = command
        .spawn()
        .map_err(|error| format!("Failed to launch SoX command: {error}"))?;
    {
        let mut child_guard = task_runtime
            .child
            .lock()
            .map_err(|_| "Audio task child lock was poisoned.".to_string())?;
        *child_guard = Some(child);
    }
    loop {
        if task_runtime.cancelled.load(Ordering::SeqCst) {
            if let Ok(mut child_guard) = task_runtime.child.lock() {
                if let Some(child) = child_guard.as_mut() {
                    let _ = child.kill();
                }
            }
            return Err("Cancelled".to_string());
        }
        let exited = {
            let mut child_guard = task_runtime
                .child
                .lock()
                .map_err(|_| "Audio task child lock was poisoned.".to_string())?;
            if let Some(child) = child_guard.as_mut() {
                child
                    .try_wait()
                    .map_err(|error| format!("Failed while waiting for SoX command: {error}"))?
                    .is_some()
            } else {
                true
            }
        };
        if exited {
            break;
        }
        thread::sleep(Duration::from_millis(80));
    }
    let child = task_runtime
        .child
        .lock()
        .map_err(|_| "Audio task child lock was poisoned.".to_string())?
        .take()
        .ok_or_else(|| "Audio task child process was missing.".to_string())?;
    child
        .wait_with_output()
        .map_err(|error| format!("Failed to collect SoX command output: {error}"))
}

fn append_transform_effects(command: &mut Command, request: &NormalizedAudioTransformRequest) {
    if let Some(start) = request.trim_start_seconds {
        let length = request
            .trim_end_seconds
            .map(|end| end - start)
            .filter(|value| *value > 0.0);
        command.arg("trim").arg(format!("{start:.3}"));
        if let Some(length) = length {
            command.arg(format!("{length:.3}"));
        }
    }
    if request.normalize {
        command.arg("gain").arg("-n");
    }
    if request.fade_in_seconds.is_some() || request.fade_out_seconds.is_some() {
        let fade_in = request.fade_in_seconds.unwrap_or(0.0);
        let fade_out = request.fade_out_seconds.unwrap_or(0.0);
        let trim_end = request.trim_end_seconds.unwrap_or(0.0);
        let trim_start = request.trim_start_seconds.unwrap_or(0.0);
        let duration = (trim_end - trim_start).max(0.0);
        let stop = if duration > 0.0 { duration } else { 0.0 };
        command
            .arg("fade")
            .arg(format!("{fade_in:.3}"))
            .arg(if stop > 0.0 {
                format!("{stop:.3}")
            } else {
                "0".to_string()
            })
            .arg(format!("{fade_out:.3}"));
    }
}

fn move_or_copy_overwrite_result(temp_output: &Path, final_output: &Path) -> Result<(), String> {
    if final_output.exists() {
        fs::remove_file(final_output).map_err(|error| {
            format!(
                "Failed to remove original audio before overwrite '{}': {error}",
                final_output.display()
            )
        })?;
    }
    fs::rename(temp_output, final_output).or_else(|_| {
        fs::copy(temp_output, final_output)
            .map(|_| ())
            .and_then(|_| fs::remove_file(temp_output))
    }).map_err(|error| {
        format!(
            "Failed to replace original audio '{}' with transformed output: {error}",
            final_output.display()
        )
    })
}

fn execute_audio_transform(
    app: &AppHandle,
    task_id: &str,
    request: NormalizedAudioTransformRequest,
) -> Result<AudioTransformResult, String> {
    let runtime = ensure_unpacked_sox_runtime(app)?;
    let task_runtime = register_audio_runtime(task_id)?;
    let run_result = (|| {
        update_manual_explorer_task(task_id, Some("Preparing SoX transform…".to_string()), Some(0), Some(3))?;
        let mut command = sox_command(&runtime);
        command.arg(if request.overwrite_existing || request.overwrite_original {
            "--clobber"
        } else {
            "--no-clobber"
        });
        command.arg(&request.input_path);
        command.arg(&request.output_path);
        append_transform_effects(&mut command, &request);

        let output = spawn_sox_and_wait(&task_runtime, command)?;
        if !output.status.success() {
            let message = String::from_utf8_lossy(&output.stderr).trim().to_string();
            return Err(if message.is_empty() {
                format!("SoX exited with status {}", output.status)
            } else {
                format!("SoX audio transform failed: {message}")
            });
        }
        update_manual_explorer_task(task_id, Some("Writing transform output…".to_string()), Some(2), Some(3))?;

        if request.overwrite_original {
            move_or_copy_overwrite_result(&request.output_path, &request.final_output_path)?;
        }
        let spectrogram_path = if request.generate_spectrogram {
            let path = request
                .final_output_path
                .with_extension(format!("{}.spectrogram.png", request.output_format));
            let mut spectrogram = sox_command(&runtime);
            spectrogram
                .arg(&request.final_output_path)
                .arg("-n")
                .arg("spectrogram")
                .arg("-o")
                .arg(&path);
            let spectrogram_output = spawn_sox_and_wait(&task_runtime, spectrogram)?;
            if !spectrogram_output.status.success() {
                let message = String::from_utf8_lossy(&spectrogram_output.stderr).trim().to_string();
                return Err(format!("SoX spectrogram export failed: {message}"));
            }
            Some(path_to_string(&path))
        } else {
            None
        };

        update_manual_explorer_task(task_id, Some("Finalizing audio transform…".to_string()), Some(3), Some(3))?;
        let duration_seconds = parse_optional_f64(sox_info_scalar(&runtime, "-D", &request.final_output_path)?);
        let result = AudioTransformResult {
            task_id: task_id.to_string(),
            output_path: path_to_string(&request.final_output_path),
            spectrogram_path,
            duration_seconds,
            output_format: request.output_format.clone(),
            overwritten_original: request.overwrite_original,
            sox_binary: path_to_string(&runtime.executable_path),
        };
        complete_manual_explorer_task(
            task_id,
            Some(format!(
                "Saved audio output to {}",
                request.final_output_path.display()
            )),
            None,
        )?;
        Ok(result)
    })();
    unregister_audio_runtime(task_id);
    if let Err(error) = &run_result {
        if error == "Cancelled" {
            let _ = cancel_manual_explorer_task(task_id, Some("Cancelled audio transform.".to_string()));
        } else {
            let _ = fail_manual_explorer_task(task_id, error.clone());
        }
    }
    run_result
}

fn audio_preview_proxy_path(app: &AppHandle, input_path: &Path) -> Result<PathBuf, String> {
    let temp_root = resolve_audio_temp_root(app)?.join("preview-proxies");
    fs::create_dir_all(&temp_root)
        .map_err(|error| format!("Failed to create audio proxy directory '{}': {error}", temp_root.display()))?;
    let stem = input_path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("audio");
    Ok(temp_root.join(format!("{stem}.preview.{PREVIEW_PROXY_EXTENSION}")))
}

fn collect_audio_input_files(paths: &[String], recurse_directories: bool) -> Result<Vec<PathBuf>, String> {
    let mut results = Vec::new();
    let mut seen = HashSet::new();
    for raw_path in paths {
        let trimmed = raw_path.trim();
        if trimmed.is_empty() {
            continue;
        }
        let path = PathBuf::from(trimmed);
        if !path.exists() {
            continue;
        }
        if path.is_file() {
            push_audio_input_file(&path, &mut results, &mut seen);
            continue;
        }
        if path.is_dir() {
            collect_audio_input_files_from_dir(&path, recurse_directories, &mut results, &mut seen)?;
        }
    }
    Ok(results)
}

fn collect_audio_input_files_from_dir(
    directory: &Path,
    recurse_directories: bool,
    results: &mut Vec<PathBuf>,
    seen: &mut HashSet<String>,
) -> Result<(), String> {
    let entries = fs::read_dir(directory)
        .map_err(|error| format!("Failed to read audio batch directory '{}': {error}", directory.display()))?;
    for entry in entries {
        let entry = entry.map_err(|error| {
            format!(
                "Failed to read audio batch directory entry in '{}': {error}",
                directory.display()
            )
        })?;
        let path = entry.path();
        if path.is_file() {
            push_audio_input_file(&path, results, seen);
        } else if recurse_directories && path.is_dir() {
            collect_audio_input_files_from_dir(&path, recurse_directories, results, seen)?;
        }
    }
    Ok(())
}

fn push_audio_input_file(path: &Path, results: &mut Vec<PathBuf>, seen: &mut HashSet<String>) {
    if !is_supported_audio_extension(path) {
        return;
    }
    let key = path_to_string(path);
    if seen.insert(key) {
        results.push(path.to_path_buf());
    }
}

fn is_supported_audio_extension(path: &Path) -> bool {
    const SUPPORTED: &[&str] = &[
        "aac", "aif", "aiff", "alac", "amr", "caf", "flac", "m4a", "m4b", "mid", "midi", "mka",
        "mp3", "oga", "ogg", "opus", "wav", "wave", "weba", "wma",
    ];
    path.extension()
        .and_then(|value| value.to_str())
        .map(|value| SUPPORTED.contains(&value.to_ascii_lowercase().as_str()))
        .unwrap_or(false)
}

fn batch_output_path_for_input(
    input_path: &Path,
    request: &AudioBatchProcessRequest,
    output_format: &str,
) -> PathBuf {
    if request.overwrite_existing.unwrap_or(false) {
        return input_path.to_path_buf();
    }
    let stem = input_path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("audio");
    let suffix = match request.mode {
        AudioBatchProcessMode::Convert => "converted",
        AudioBatchProcessMode::Normalize => "normalized",
    };
    let file_name = format!("{stem}.{suffix}.{output_format}");
    if let Some(output_directory) = request.output_directory.as_deref().map(PathBuf::from) {
        output_directory.join(file_name)
    } else {
        input_path
            .parent()
            .unwrap_or_else(|| Path::new(""))
            .join(file_name)
    }
}

fn execute_audio_batch_process(
    app: &AppHandle,
    task_id: &str,
    request: AudioBatchProcessRequest,
) -> Result<AudioBatchProcessResult, String> {
    let runtime = ensure_unpacked_sox_runtime(app)?;
    let inputs = collect_audio_input_files(&request.input_paths, request.recurse_directories.unwrap_or(false))?;
    if inputs.is_empty() {
        return Err("No supported audio files were found for batch processing.".to_string());
    }
    let task_runtime = register_audio_runtime(task_id)?;
    let run_result = (|| {
        let output_format = normalize_optional_string(request.output_format.as_deref())
            .unwrap_or_else(|| "wav".to_string());
        let total = inputs.len() as u64;
        let mut processed_paths = Vec::new();
        let mut skipped_paths = Vec::new();
        let mut failed_paths = Vec::new();

        for (index, input_path) in inputs.iter().enumerate() {
            if task_runtime.cancelled.load(Ordering::SeqCst) {
                return Err("Cancelled".to_string());
            }
            let step = index as u64 + 1;
            update_manual_explorer_task(
                task_id,
                Some(format!("Processing {} ({step}/{total})", input_path.display())),
                Some(index as u64),
                Some(total),
            )?;

            let destination_path = batch_output_path_for_input(input_path, &request, output_format.as_str());
            if let Some(parent) = destination_path.parent() {
                fs::create_dir_all(parent).map_err(|error| {
                    format!(
                        "Failed to create batch output directory '{}': {error}",
                        parent.display()
                    )
                })?;
            }
            if destination_path.exists() && !request.overwrite_existing.unwrap_or(false) {
                skipped_paths.push(path_to_string(&destination_path));
                continue;
            }

            let working_output_path = if request.overwrite_existing.unwrap_or(false) {
                build_overwrite_temp_path(input_path, output_format.as_str())
            } else {
                destination_path.clone()
            };

            let mut command = sox_command(&runtime);
            command
                .arg(if request.overwrite_existing.unwrap_or(false) {
                    "--clobber"
                } else {
                    "--no-clobber"
                })
                .arg(input_path)
                .arg(&working_output_path);
            if matches!(request.mode, AudioBatchProcessMode::Normalize) {
                command.arg("gain").arg("-n");
            }

            let output = spawn_sox_and_wait(&task_runtime, command)?;
            if !output.status.success() {
                failed_paths.push(path_to_string(input_path));
                continue;
            }

            if request.overwrite_existing.unwrap_or(false) {
                move_or_copy_overwrite_result(&working_output_path, input_path)?;
                processed_paths.push(path_to_string(input_path));
            } else {
                processed_paths.push(path_to_string(&destination_path));
            }
        }

        update_manual_explorer_task(task_id, Some("Finalizing audio batch…".to_string()), Some(total), Some(total))?;
        let detail = format!(
            "Processed {}, skipped {}, failed {} audio item(s)",
            processed_paths.len(),
            skipped_paths.len(),
            failed_paths.len()
        );
        complete_manual_explorer_task(task_id, Some(detail), None)?;
        Ok(AudioBatchProcessResult {
            task_id: task_id.to_string(),
            processed_paths,
            skipped_paths,
            failed_paths,
            output_directory: request.output_directory.clone(),
            sox_binary: path_to_string(&runtime.executable_path),
        })
    })();
    unregister_audio_runtime(task_id);
    if let Err(error) = &run_result {
        if error == "Cancelled" {
            let _ = cancel_manual_explorer_task(task_id, Some("Cancelled audio batch process.".to_string()));
        } else {
            let _ = fail_manual_explorer_task(task_id, error.clone());
        }
    }
    run_result
}

#[tauri::command]
#[specta::specta]
pub async fn audio_analyze_preview(
    app: AppHandle,
    input_path: String,
) -> Result<AudioPreviewAnalysis, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let trimmed = input_path.trim();
        if trimmed.is_empty() {
            return Err("Input audio path cannot be empty.".to_string());
        }
        let input = PathBuf::from(trimmed);
        if !input.exists() || !input.is_file() {
            return Err(format!("Input audio does not exist: {}", input.display()));
        }
        let runtime = ensure_unpacked_sox_runtime(&app)?;
        let duration_seconds = parse_optional_f64(sox_info_scalar(&runtime, "-D", &input)?).unwrap_or(0.0);
        let sample_rate_hz = parse_optional_u32(sox_info_scalar(&runtime, "-r", &input)?);
        let channels = parse_optional_u32(sox_info_scalar(&runtime, "-c", &input)?);
        let bits_per_sample = parse_optional_u32(sox_info_scalar(&runtime, "-b", &input)?);
        let encoding = sox_info_scalar(&runtime, "-e", &input)?;
        let container_type = sox_info_scalar(&runtime, "-t", &input)?;
        let (peak_level, rms_level, waveform_buckets) = analyze_waveform(&runtime, &input)?;
        Ok(AudioPreviewAnalysis {
            input_path: path_to_string(&input),
            duration_seconds,
            sample_rate_hz,
            channels,
            encoding,
            bits_per_sample,
            container_type,
            peak_level,
            rms_level,
            loudness_db: decibels_from_linear(rms_level),
            headroom_db: headroom_from_peak(peak_level),
            waveform_buckets,
        })
    })
    .await
    .map_err(|error| format!("Audio preview analysis task failed to join: {error}"))?
}

#[tauri::command]
#[specta::specta]
pub async fn audio_create_preview_proxy(
    app: AppHandle,
    input_path: String,
) -> Result<ResolvedAudioPreviewSource, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let trimmed = input_path.trim();
        if trimmed.is_empty() {
            return Err("Input audio path cannot be empty.".to_string());
        }
        let input = PathBuf::from(trimmed);
        if !input.exists() || !input.is_file() {
            return Err(format!("Input audio does not exist: {}", input.display()));
        }
        let runtime = ensure_unpacked_sox_runtime(&app)?;
        let proxy_path = audio_preview_proxy_path(&app, &input)?;
        let mut command = sox_command(&runtime);
        command
            .arg("--clobber")
            .arg(&input)
            .arg("-r")
            .arg("44100")
            .arg("-c")
            .arg("2")
            .arg(&proxy_path);
        let output = command
            .output()
            .map_err(|error| format!("Failed to launch SoX preview proxy command: {error}"))?;
        if !output.status.success() {
            let message = String::from_utf8_lossy(&output.stderr).trim().to_string();
            return Err(format!("SoX preview proxy generation failed: {message}"));
        }
        Ok(ResolvedAudioPreviewSource {
            task_id: None,
            source_path: path_to_string(&proxy_path),
            source_kind: AudioPreviewSourceKind::Proxy,
            mime_type: Some("audio/wav".to_string()),
            generated_from_path: Some(path_to_string(&input)),
        })
    })
    .await
    .map_err(|error| format!("Audio preview proxy task failed to join: {error}"))?
}

#[tauri::command]
#[specta::specta]
pub async fn audio_export_transform(
    app: AppHandle,
    request: AudioTransformRequest,
) -> Result<AudioTransformResult, String> {
    let normalized_request = normalize_trimmed_request_for_async(request)?;
    let task_id = format!("audio-transform-{}", uuid::Uuid::new_v4());
    create_manual_explorer_task_with_id(
        task_id.clone(),
        build_audio_transform_registration(&normalized_request),
    );
    set_manual_explorer_task_cancel_context(
        &task_id,
        ExplorerTaskCancelContext::AudioOperation {
            operation_id: task_id.clone(),
        },
    )?;
    tauri::async_runtime::spawn_blocking(move || execute_audio_transform(&app, &task_id, normalized_request))
        .await
        .map_err(|error| format!("Audio transform task failed to join: {error}"))?
}

fn normalize_trimmed_request_for_async(
    request: AudioTransformRequest,
) -> Result<NormalizedAudioTransformRequest, String> {
    normalize_audio_transform_request(request)
}

#[tauri::command]
#[specta::specta]
pub async fn audio_batch_process(
    app: AppHandle,
    request: AudioBatchProcessRequest,
) -> Result<AudioBatchProcessResult, String> {
    let inputs = collect_audio_input_files(&request.input_paths, request.recurse_directories.unwrap_or(false))?;
    let task_id = format!("audio-batch-{}", uuid::Uuid::new_v4());
    create_manual_explorer_task_with_id(
        task_id.clone(),
        build_audio_batch_registration(&request, &inputs),
    );
    set_manual_explorer_task_cancel_context(
        &task_id,
        ExplorerTaskCancelContext::AudioOperation {
            operation_id: task_id.clone(),
        },
    )?;
    tauri::async_runtime::spawn_blocking(move || execute_audio_batch_process(&app, &task_id, request))
        .await
        .map_err(|error| format!("Audio batch task failed to join: {error}"))?
}

#[tauri::command]
#[specta::specta]
pub async fn audio_resolve_preview_source(
    input_path: String,
) -> Result<ResolvedAudioPreviewSource, String> {
    let trimmed = input_path.trim();
    if trimmed.is_empty() {
        return Err("Input audio path cannot be empty.".to_string());
    }
    let input = PathBuf::from(trimmed);
    if !input.exists() || !input.is_file() {
        return Err(format!("Input audio does not exist: {}", input.display()));
    }
    Ok(ResolvedAudioPreviewSource {
        task_id: None,
        source_path: path_to_string(&input),
        source_kind: AudioPreviewSourceKind::Direct,
        mime_type: direct_audio_preview_mime_type(&input),
        generated_from_path: None,
    })
}

fn paths_match(left: &Path, right: &Path) -> bool {
    let canonical_left = fs::canonicalize(left).ok();
    let canonical_right = fs::canonicalize(right).ok();
    match (canonical_left, canonical_right) {
        (Some(normalized_left), Some(normalized_right)) => normalized_left == normalized_right,
        _ => left == right,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn sox_bundle_name_tracks_platform() {
        let file_name = sox_bundle_file_name();
        assert!(file_name.starts_with("sox-14.4.2-"));
        assert!(file_name.ends_with(".zip"));
    }

    #[test]
    fn normalize_transform_request_rejects_same_path_without_overwrite_mode() {
        let workspace = tempdir().expect("tempdir");
        let input_path = workspace.path().join("anthem.wav");
        fs::write(&input_path, b"demo").expect("write");
        let error = normalize_audio_transform_request(AudioTransformRequest {
            input_path: path_to_string(&input_path),
            output_path: Some(path_to_string(&input_path)),
            overwrite_existing: true,
            mode: AudioTransformMode::ExportClip,
            trim_start_seconds: Some(0.0),
            trim_end_seconds: Some(1.0),
            fade_in_seconds: None,
            fade_out_seconds: None,
            normalize: None,
            output_format: Some("wav".to_string()),
            generate_spectrogram: None,
        })
        .expect_err("same path should fail");
        assert!(error.contains("different output path"));
    }

    #[test]
    fn compute_waveform_buckets_reports_peak_and_rms() {
        let samples = vec![0.0, 0.5, -0.5, 1.0, -1.0];
        let (peak, rms, buckets) = compute_waveform_buckets(&samples, 2);
        assert_eq!(peak, 1.0);
        assert!(rms > 0.0);
        assert!(!buckets.is_empty());
    }

    #[test]
    fn collect_audio_inputs_filters_non_audio_entries() {
        let workspace = tempdir().expect("tempdir");
        let audio = workspace.path().join("anthem.mp3");
        let text = workspace.path().join("notes.txt");
        let nested = workspace.path().join("nested");
        fs::create_dir_all(&nested).expect("nested");
        let nested_audio = nested.join("theme.wav");
        fs::write(&audio, b"demo").expect("audio");
        fs::write(&text, b"text").expect("text");
        fs::write(&nested_audio, b"demo").expect("nested audio");

        let collected = collect_audio_input_files(
            &[path_to_string(workspace.path())],
            true,
        )
        .expect("collect");
        let collected_paths: HashSet<String> = collected.iter().map(|path| path_to_string(path)).collect();
        assert!(collected_paths.contains(&path_to_string(&audio)));
        assert!(collected_paths.contains(&path_to_string(&nested_audio)));
        assert!(!collected_paths.contains(&path_to_string(&text)));
    }
}
