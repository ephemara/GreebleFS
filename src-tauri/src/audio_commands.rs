use crate::audio_engine::analyze_audio_file_native;
use crate::fs_commands::{
    cancel_manual_explorer_task, complete_manual_explorer_task,
    create_manual_explorer_task_with_id, fail_manual_explorer_task,
    set_manual_explorer_task_cancel_context, update_manual_explorer_task,
    ExplorerTaskCancelContext, ExplorerTaskKind, ExplorerTaskRegistration,
    ExplorerTaskRetryContext,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use std::time::{Duration, UNIX_EPOCH};
use tauri::{AppHandle, Manager};
use zip::ZipArchive;

const DEFAULT_FFMPEG_BINARY: &str = "ffmpeg";
const SOX_VERSION: &str = "14.4.2";
const SOX_INTERMEDIATE_OUTPUT_FORMAT: &str = "wav";
const FFMPEG_FALLBACK_OUTPUT_FORMATS: &[&str] = &["mp3"];

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
    pub spectral_bands: Vec<f64>,
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

#[derive(Debug, Clone)]
struct PreparedAudioInput {
    source_path: PathBuf,
    cleanup_paths: Vec<PathBuf>,
}

#[derive(Debug, Clone)]
struct PlannedAudioOutput {
    sox_output_path: PathBuf,
    sox_output_format: String,
    final_output_path: PathBuf,
    final_output_format: String,
    ffmpeg_output_path: Option<PathBuf>,
}

static AUDIO_TASKS: OnceLock<Mutex<HashMap<String, Arc<AudioTaskRuntime>>>> = OnceLock::new();
static SOX_RUNTIME_CACHE: OnceLock<Mutex<Option<SoxRuntime>>> = OnceLock::new();
static SOX_FORMAT_SUPPORT_CACHE: OnceLock<Mutex<HashMap<String, bool>>> = OnceLock::new();

fn audio_tasks() -> &'static Mutex<HashMap<String, Arc<AudioTaskRuntime>>> {
    AUDIO_TASKS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn sox_runtime_cache() -> &'static Mutex<Option<SoxRuntime>> {
    SOX_RUNTIME_CACHE.get_or_init(|| Mutex::new(None))
}

fn sox_format_support_cache() -> &'static Mutex<HashMap<String, bool>> {
    SOX_FORMAT_SUPPORT_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
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

fn normalize_audio_format(value: &str) -> String {
    match value
        .trim()
        .trim_start_matches('.')
        .to_ascii_lowercase()
        .as_str()
    {
        "wave" => "wav".to_string(),
        "vorbis" => "ogg".to_string(),
        other => other.to_string(),
    }
}

fn input_audio_extension(input_path: &Path) -> Option<String> {
    input_path
        .extension()
        .and_then(|value| value.to_str())
        .map(normalize_audio_format)
        .filter(|value| !value.is_empty())
}

fn resolve_ffmpeg_binary() -> String {
    std::env::var("FFMPEG_BIN")
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| DEFAULT_FFMPEG_BINARY.to_string())
}

fn ffmpeg_supports_output_format(output_format: &str) -> bool {
    FFMPEG_FALLBACK_OUTPUT_FORMATS.contains(&normalize_audio_format(output_format).as_str())
}

fn ffmpeg_codec_arguments(output_format: &str) -> Result<Vec<&'static str>, String> {
    match normalize_audio_format(output_format).as_str() {
        "mp3" => Ok(vec!["-codec:a", "libmp3lame", "-q:a", "2"]),
        unsupported => Err(format!(
            "Audio format '{unsupported}' is not available through ffmpeg fallback."
        )),
    }
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
    fs::create_dir_all(&root).map_err(|error| {
        format!(
            "Failed to create audio temp directory '{}': {error}",
            root.display()
        )
    })?;
    Ok(root)
}

fn candidate_sox_bundle_paths(app: &AppHandle) -> Vec<PathBuf> {
    let bundle_name = sox_bundle_file_name();
    let mut candidates = Vec::new();
    if let Some(path) =
        normalize_optional_string(std::env::var("GREEBLEFS_SOX_ARCHIVE").ok().as_deref())
    {
        candidates.push(PathBuf::from(path));
    }
    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(
            resource_dir
                .join("packages")
                .join("sox")
                .join("bin")
                .join(&bundle_name),
        );
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

    let runtime_root = resolve_audio_runtime_root(app)?
        .join("sox")
        .join(format!("{}-{SOX_VERSION}", current_platform_tag()));
    fs::create_dir_all(&runtime_root).map_err(|error| {
        format!(
            "Failed to create SoX runtime directory '{}': {error}",
            runtime_root.display()
        )
    })?;

    let executable_path = runtime_root
        .join(sox_bundle_root_name())
        .join(sox_executable_name());
    if !executable_path.exists() {
        let bundle_path = candidate_sox_bundle_paths(app)
            .into_iter()
            .find(|candidate| candidate.exists())
            .ok_or_else(|| {
                format!(
                    "Unable to locate vendored SoX bundle '{}'.",
                    sox_bundle_file_name()
                )
            })?;
        unpack_sox_bundle(&bundle_path, &runtime_root)?;
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if executable_path.exists() {
            let mut permissions = fs::metadata(&executable_path)
                .map_err(|error| {
                    format!(
                        "Failed to stat SoX binary '{}': {error}",
                        executable_path.display()
                    )
                })?
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
    let file = fs::File::open(bundle_path).map_err(|error| {
        format!(
            "Failed to open SoX bundle '{}': {error}",
            bundle_path.display()
        )
    })?;
    let mut archive = ZipArchive::new(file).map_err(|error| {
        format!(
            "Failed to read SoX zip archive '{}': {error}",
            bundle_path.display()
        )
    })?;
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
                format!(
                    "Failed to create extracted SoX directory '{}': {error}",
                    output_path.display()
                )
            })?;
            continue;
        }
        if let Some(parent) = output_path.parent() {
            fs::create_dir_all(parent).map_err(|error| {
                format!(
                    "Failed to create extracted SoX parent '{}': {error}",
                    parent.display()
                )
            })?;
        }
        let mut output = fs::File::create(&output_path).map_err(|error| {
            format!(
                "Failed to create extracted SoX file '{}': {error}",
                output_path.display()
            )
        })?;
        std::io::copy(&mut entry, &mut output).map_err(|error| {
            format!(
                "Failed to extract SoX file '{}': {error}",
                output_path.display()
            )
        })?;
        output.flush().map_err(|error| {
            format!(
                "Failed to flush extracted SoX file '{}': {error}",
                output_path.display()
            )
        })?;
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

fn sox_has_format_support(runtime: &SoxRuntime, format: &str) -> Result<bool, String> {
    let normalized_format = normalize_audio_format(format);
    if normalized_format.is_empty() {
        return Ok(false);
    }
    let cache_key = format!(
        "{}::{}",
        runtime.executable_path.display(),
        normalized_format
    );
    if let Some(cached) = sox_format_support_cache()
        .lock()
        .map_err(|_| "SoX format support cache lock was poisoned.".to_string())?
        .get(&cache_key)
        .copied()
    {
        return Ok(cached);
    }
    let output = sox_command(runtime)
        .arg("--help-format")
        .arg(&normalized_format)
        .output()
        .map_err(|error| format!("Failed to launch SoX format help command: {error}"))?;
    let supported = output.status.success();
    sox_format_support_cache()
        .lock()
        .map_err(|_| "SoX format support cache lock was poisoned.".to_string())?
        .insert(cache_key, supported);
    Ok(supported)
}

fn sox_can_read_audio_input(runtime: &SoxRuntime, input_path: &Path) -> Result<bool, String> {
    Ok(input_audio_extension(input_path)
        .map(|extension| sox_has_format_support(runtime, &extension))
        .transpose()?
        .unwrap_or(false))
}

fn sox_can_write_audio_output(runtime: &SoxRuntime, output_format: &str) -> Result<bool, String> {
    sox_has_format_support(runtime, output_format)
}

fn ffmpeg_command() -> Command {
    Command::new(resolve_ffmpeg_binary())
}

fn spawn_ffmpeg_and_wait(
    task_runtime: Option<&Arc<AudioTaskRuntime>>,
    mut command: Command,
) -> Result<std::process::Output, String> {
    command.stdout(Stdio::piped()).stderr(Stdio::piped());
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    let output = command.output().map_err(|error| {
        format!(
            "Failed to launch ffmpeg at '{}': {error}",
            resolve_ffmpeg_binary()
        )
    })?;
    if let Some(task_runtime) = task_runtime {
        if task_runtime.cancelled.load(Ordering::SeqCst) {
            return Err("Cancelled".to_string());
        }
    }
    Ok(output)
}

fn sox_info_scalar(
    runtime: &SoxRuntime,
    flag: &str,
    input_path: &Path,
) -> Result<Option<String>, String> {
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

fn parse_optional_f64(value: Option<String>) -> Option<f64> {
    value.and_then(|candidate| candidate.trim().parse::<f64>().ok())
}

#[cfg(test)]
fn compute_waveform_buckets(
    samples: &[f64],
    bucket_count: usize,
) -> (f64, f64, Vec<AudioWaveformBucket>) {
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


fn sanitize_audio_temp_stem(value: &str) -> String {
    let sanitized: String = value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || character == '-' || character == '_' {
                character
            } else {
                '-'
            }
        })
        .collect();
    let collapsed = sanitized.trim_matches('-');
    if collapsed.is_empty() {
        "audio".to_string()
    } else {
        collapsed.to_string()
    }
}

fn audio_cache_digest(input_path: &Path) -> Result<String, String> {
    let metadata = fs::metadata(input_path).map_err(|error| {
        format!(
            "Failed to read audio metadata '{}': {error}",
            input_path.display()
        )
    })?;
    let modified_nanos = metadata
        .modified()
        .ok()
        .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
        .map(|value| value.as_nanos())
        .unwrap_or_default();
    let mut hasher = Sha256::new();
    hasher.update(input_path.to_string_lossy().as_bytes());
    hasher.update(metadata.len().to_le_bytes());
    hasher.update(modified_nanos.to_le_bytes());
    Ok(format!("{:x}", hasher.finalize()))
}

fn audio_cached_temp_path(
    app: &AppHandle,
    input_path: &Path,
    subdirectory: &str,
    suffix: &str,
    extension: &str,
) -> Result<PathBuf, String> {
    let temp_root = resolve_audio_temp_root(app)?.join(subdirectory);
    fs::create_dir_all(&temp_root).map_err(|error| {
        format!(
            "Failed to create audio temp directory '{}': {error}",
            temp_root.display()
        )
    })?;
    let digest = audio_cache_digest(input_path)?;
    let digest_prefix = &digest[..16];
    let stem = sanitize_audio_temp_stem(
        input_path
            .file_stem()
            .and_then(|value| value.to_str())
            .unwrap_or("audio"),
    );
    Ok(temp_root.join(format!(
        "{stem}.{digest_prefix}.{suffix}.{}",
        normalize_audio_format(extension)
    )))
}

fn can_reuse_audio_temp_path(input_path: &Path, cached_path: &Path) -> bool {
    let Ok(cached_metadata) = fs::metadata(cached_path) else {
        return false;
    };
    if !cached_metadata.is_file() || cached_metadata.len() == 0 {
        return false;
    }
    let Ok(input_metadata) = fs::metadata(input_path) else {
        return false;
    };
    let input_modified = input_metadata.modified().ok();
    let cached_modified = cached_metadata.modified().ok();
    match (input_modified, cached_modified) {
        (Some(input_time), Some(cached_time)) => cached_time >= input_time,
        _ => false,
    }
}

fn build_audio_temp_path(input_path: &Path, suffix: &str, output_format: &str) -> PathBuf {
    let parent = input_path.parent().unwrap_or_else(|| Path::new(""));
    let stem = input_path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("audio");
    parent.join(format!(
        "{stem}.greeblefs-{suffix}.{}",
        normalize_audio_format(output_format)
    ))
}

fn ensure_processing_input(
    app: &AppHandle,
    runtime: &SoxRuntime,
    input_path: &Path,
    task_runtime: Option<&Arc<AudioTaskRuntime>>,
) -> Result<PreparedAudioInput, String> {
    if sox_can_read_audio_input(runtime, input_path)? {
        return Ok(PreparedAudioInput {
            source_path: input_path.to_path_buf(),
            cleanup_paths: Vec::new(),
        });
    }
    let decoded_path = audio_cached_temp_path(app, input_path, "decoded-inputs", "decoded", "wav")?;
    if !can_reuse_audio_temp_path(input_path, &decoded_path) {
        let ffmpeg_binary = resolve_ffmpeg_binary();
        let mut command = ffmpeg_command();
        command.args(["-hide_banner", "-loglevel", "error", "-y"]);
        command.args(["-i", &path_to_string(input_path)]);
        command.args([
            "-vn",
            "-codec:a",
            "pcm_s16le",
            &path_to_string(&decoded_path),
        ]);
        let output = spawn_ffmpeg_and_wait(task_runtime, command)?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let message = if !stderr.is_empty() {
                stderr
            } else if !stdout.is_empty() {
                stdout
            } else {
                format!(
                    "ffmpeg exited with status {} while decoding input audio",
                    output.status
                )
            };
            return Err(format!(
                "Input audio codec is not readable by vendored SoX. ffmpeg decode fallback at '{ffmpeg_binary}' failed: {message}"
            ));
        }
    }
    Ok(PreparedAudioInput {
        source_path: decoded_path,
        cleanup_paths: Vec::new(),
    })
}

fn plan_audio_output(
    runtime: &SoxRuntime,
    request: &NormalizedAudioTransformRequest,
) -> Result<PlannedAudioOutput, String> {
    let final_output_format = normalize_audio_format(&request.output_format);
    let sox_can_write_final = sox_can_write_audio_output(runtime, &final_output_format)?;
    if sox_can_write_final {
        let sox_output_path = if request.overwrite_original {
            build_audio_temp_path(&request.input_path, "overwrite-stage", &final_output_format)
        } else {
            request.final_output_path.clone()
        };
        return Ok(PlannedAudioOutput {
            sox_output_path,
            sox_output_format: final_output_format.clone(),
            final_output_path: request.final_output_path.clone(),
            final_output_format,
            ffmpeg_output_path: None,
        });
    }
    if !ffmpeg_supports_output_format(&final_output_format) {
        return Err(format!(
            "Audio format '{}' is not writable by vendored SoX on this platform, and no fallback encoder is configured.",
            final_output_format
        ));
    }
    let sox_output_path = build_audio_temp_path(
        &request.input_path,
        "transform-stage",
        SOX_INTERMEDIATE_OUTPUT_FORMAT,
    );
    let ffmpeg_output_path = if request.overwrite_original {
        build_audio_temp_path(
            &request.input_path,
            "overwrite-encoded",
            &final_output_format,
        )
    } else {
        request.final_output_path.clone()
    };
    Ok(PlannedAudioOutput {
        sox_output_path,
        sox_output_format: SOX_INTERMEDIATE_OUTPUT_FORMAT.to_string(),
        final_output_path: request.final_output_path.clone(),
        final_output_format,
        ffmpeg_output_path: Some(ffmpeg_output_path),
    })
}

fn encode_audio_with_ffmpeg(
    task_runtime: Option<&Arc<AudioTaskRuntime>>,
    input_path: &Path,
    output_path: &Path,
    output_format: &str,
    overwrite_existing: bool,
) -> Result<(), String> {
    let ffmpeg_binary = resolve_ffmpeg_binary();
    let codec_arguments = ffmpeg_codec_arguments(output_format)?;
    let mut command = ffmpeg_command();
    command.args(["-hide_banner", "-loglevel", "error"]);
    command.arg(if overwrite_existing { "-y" } else { "-n" });
    command.args(["-i", &path_to_string(input_path)]);
    command.arg("-vn");
    command.args(codec_arguments);
    command.arg(output_path);
    let output = spawn_ffmpeg_and_wait(task_runtime, command)?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let message = if !stderr.is_empty() {
            stderr
        } else if !stdout.is_empty() {
            stdout
        } else {
            format!("ffmpeg exited with status {}", output.status)
        };
        return Err(format!(
            "Audio encode fallback failed through ffmpeg at '{ffmpeg_binary}': {message}"
        ));
    }
    Ok(())
}

fn remove_file_if_exists(path: &Path) {
    if path.exists() {
        let _ = fs::remove_file(path);
    }
}

fn normalize_audio_transform_request(
    request: AudioTransformRequest,
) -> Result<NormalizedAudioTransformRequest, String> {
    let input_path = PathBuf::from(request.input_path.trim());
    if request.input_path.trim().is_empty() {
        return Err("Input audio path cannot be empty.".to_string());
    }
    if !input_path.exists() {
        return Err(format!(
            "Input audio does not exist: {}",
            input_path.display()
        ));
    }
    if !input_path.is_file() {
        return Err(format!(
            "Input audio path is not a file: {}",
            input_path.display()
        ));
    }
    let trim_start_seconds = request
        .trim_start_seconds
        .filter(|value| value.is_finite() && *value >= 0.0);
    let trim_end_seconds = request
        .trim_end_seconds
        .filter(|value| value.is_finite() && *value > 0.0);
    if let (Some(start), Some(end)) = (trim_start_seconds, trim_end_seconds) {
        if end <= start {
            return Err("Trim end must be greater than trim start.".to_string());
        }
    }
    let fade_in_seconds = request
        .fade_in_seconds
        .filter(|value| value.is_finite() && *value >= 0.0);
    let fade_out_seconds = request
        .fade_out_seconds
        .filter(|value| value.is_finite() && *value >= 0.0);
    let mode = request.mode.clone();
    let overwrite_original = matches!(mode, AudioTransformMode::OverwriteOriginal);
    let source_extension = input_audio_extension(&input_path);
    let mut output_format = normalize_optional_string(request.output_format.as_deref())
        .map(|value| normalize_audio_format(&value))
        .unwrap_or_else(|| default_audio_output_format(&input_path, &mode));
    if overwrite_original {
        if let Some(source_extension) = source_extension.as_deref() {
            output_format = source_extension.to_string();
        }
    }
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
        build_audio_temp_path(&input_path, "overwrite-stage", output_format.as_str())
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
        final_output_path,
        overwrite_existing: request.overwrite_existing,
        mode: mode.clone(),
        trim_start_seconds,
        trim_end_seconds,
        fade_in_seconds,
        fade_out_seconds,
        normalize: request
            .normalize
            .unwrap_or(matches!(mode, AudioTransformMode::ExportNormalized)),
        output_format,
        generate_spectrogram: request.generate_spectrogram.unwrap_or(false),
        overwrite_original,
    })
}

fn default_audio_output_format(input_path: &Path, mode: &AudioTransformMode) -> String {
    match mode {
        AudioTransformMode::OverwriteOriginal => {
            input_audio_extension(input_path).unwrap_or_else(|| "wav".to_string())
        }
        AudioTransformMode::ConvertFormat
        | AudioTransformMode::ExportClip
        | AudioTransformMode::ExportNormalized => "wav".to_string(),
    }
}

fn build_default_audio_output_path(
    input_path: &Path,
    mode: &AudioTransformMode,
    output_format: &str,
) -> PathBuf {
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

fn build_audio_transform_registration(
    request: &NormalizedAudioTransformRequest,
) -> ExplorerTaskRegistration {
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

fn build_audio_batch_registration(
    request: &AudioBatchProcessRequest,
    inputs: &[PathBuf],
) -> ExplorerTaskRegistration {
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
    fs::rename(temp_output, final_output)
        .or_else(|_| {
            fs::copy(temp_output, final_output)
                .map(|_| ())
                .and_then(|_| fs::remove_file(temp_output))
        })
        .map_err(|error| {
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
        update_manual_explorer_task(
            task_id,
            Some("Preparing SoX transform…".to_string()),
            Some(0),
            Some(3),
        )?;
        let prepared_input =
            ensure_processing_input(app, &runtime, &request.input_path, Some(&task_runtime))?;
        let planned_output = plan_audio_output(&runtime, &request)?;
        let mut command = sox_command(&runtime);
        command.arg(
            if request.overwrite_existing || request.overwrite_original {
                "--clobber"
            } else {
                "--no-clobber"
            },
        );
        command.arg(&prepared_input.source_path);
        command.arg("-t");
        command.arg(&planned_output.sox_output_format);
        command.arg(&planned_output.sox_output_path);
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
        update_manual_explorer_task(
            task_id,
            Some("Writing transform output…".to_string()),
            Some(2),
            Some(3),
        )?;

        let spectrogram_source_path = planned_output.sox_output_path.clone();
        if let Some(ffmpeg_output_path) = planned_output.ffmpeg_output_path.as_ref() {
            encode_audio_with_ffmpeg(
                Some(&task_runtime),
                &planned_output.sox_output_path,
                ffmpeg_output_path,
                &planned_output.final_output_format,
                true,
            )?;
        }

        let completed_output_path = planned_output
            .ffmpeg_output_path
            .as_ref()
            .unwrap_or(&planned_output.sox_output_path)
            .clone();

        if request.overwrite_original {
            move_or_copy_overwrite_result(
                &completed_output_path,
                &planned_output.final_output_path,
            )?;
        }
        let spectrogram_path = if request.generate_spectrogram {
            let path = planned_output.final_output_path.with_extension(format!(
                "{}.spectrogram.png",
                planned_output.final_output_format
            ));
            let mut spectrogram = sox_command(&runtime);
            spectrogram
                .arg(&spectrogram_source_path)
                .arg("-n")
                .arg("spectrogram")
                .arg("-o")
                .arg(&path);
            let spectrogram_output = spawn_sox_and_wait(&task_runtime, spectrogram)?;
            if !spectrogram_output.status.success() {
                let message = String::from_utf8_lossy(&spectrogram_output.stderr)
                    .trim()
                    .to_string();
                return Err(format!("SoX spectrogram export failed: {message}"));
            }
            Some(path_to_string(&path))
        } else {
            None
        };

        update_manual_explorer_task(
            task_id,
            Some("Finalizing audio transform…".to_string()),
            Some(3),
            Some(3),
        )?;
        let duration_seconds =
            if sox_can_read_audio_input(&runtime, &planned_output.final_output_path)? {
                parse_optional_f64(sox_info_scalar(
                    &runtime,
                    "-D",
                    &planned_output.final_output_path,
                )?)
            } else {
                parse_optional_f64(sox_info_scalar(&runtime, "-D", &spectrogram_source_path)?)
            };
        let result = AudioTransformResult {
            task_id: task_id.to_string(),
            output_path: path_to_string(&planned_output.final_output_path),
            spectrogram_path,
            duration_seconds,
            output_format: planned_output.final_output_format.clone(),
            overwritten_original: request.overwrite_original,
            sox_binary: path_to_string(&runtime.executable_path),
        };
        if planned_output.ffmpeg_output_path.is_some() {
            remove_file_if_exists(&planned_output.sox_output_path);
        }
        for cleanup_path in &prepared_input.cleanup_paths {
            remove_file_if_exists(cleanup_path);
        }
        complete_manual_explorer_task(
            task_id,
            Some(format!(
                "Saved audio output to {}",
                planned_output.final_output_path.display()
            )),
            None,
        )?;
        Ok(result)
    })();
    unregister_audio_runtime(task_id);
    if let Err(error) = &run_result {
        if error == "Cancelled" {
            let _ = cancel_manual_explorer_task(
                task_id,
                Some("Cancelled audio transform.".to_string()),
            );
        } else {
            let _ = fail_manual_explorer_task(task_id, error.clone());
        }
    }
    run_result
}

fn collect_audio_input_files(
    paths: &[String],
    recurse_directories: bool,
) -> Result<Vec<PathBuf>, String> {
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
            collect_audio_input_files_from_dir(
                &path,
                recurse_directories,
                &mut results,
                &mut seen,
            )?;
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
    let entries = fs::read_dir(directory).map_err(|error| {
        format!(
            "Failed to read audio batch directory '{}': {error}",
            directory.display()
        )
    })?;
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

fn default_batch_output_format(
    runtime: &SoxRuntime,
    input_path: &Path,
    mode: &AudioBatchProcessMode,
) -> Result<String, String> {
    match mode {
        AudioBatchProcessMode::Convert => Ok("wav".to_string()),
        AudioBatchProcessMode::Normalize => {
            let source_extension =
                input_audio_extension(input_path).unwrap_or_else(|| "wav".to_string());
            if sox_can_write_audio_output(runtime, &source_extension)?
                || ffmpeg_supports_output_format(&source_extension)
            {
                Ok(source_extension)
            } else {
                Ok("wav".to_string())
            }
        }
    }
}

fn execute_audio_batch_process(
    app: &AppHandle,
    task_id: &str,
    request: AudioBatchProcessRequest,
) -> Result<AudioBatchProcessResult, String> {
    let runtime = ensure_unpacked_sox_runtime(app)?;
    let inputs = collect_audio_input_files(
        &request.input_paths,
        request.recurse_directories.unwrap_or(false),
    )?;
    if inputs.is_empty() {
        return Err("No supported audio files were found for batch processing.".to_string());
    }
    let task_runtime = register_audio_runtime(task_id)?;
    let run_result = (|| {
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
                Some(format!(
                    "Processing {} ({step}/{total})",
                    input_path.display()
                )),
                Some(index as u64),
                Some(total),
            )?;

            let output_format = normalize_optional_string(request.output_format.as_deref())
                .map(|value| normalize_audio_format(&value))
                .map(Ok)
                .unwrap_or_else(|| {
                    default_batch_output_format(&runtime, input_path, &request.mode)
                })?;
            let destination_path =
                batch_output_path_for_input(input_path, &request, output_format.as_str());
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

            let prepared_input =
                ensure_processing_input(app, &runtime, input_path, Some(&task_runtime))?;
            let sox_can_write_final = sox_can_write_audio_output(&runtime, &output_format)?;
            let working_output_path = if sox_can_write_final {
                if request.overwrite_existing.unwrap_or(false) {
                    build_audio_temp_path(
                        input_path,
                        "batch-overwrite-stage",
                        output_format.as_str(),
                    )
                } else {
                    destination_path.clone()
                }
            } else {
                build_audio_temp_path(
                    input_path,
                    "batch-transform-stage",
                    SOX_INTERMEDIATE_OUTPUT_FORMAT,
                )
            };
            let encoded_output_path = if sox_can_write_final {
                None
            } else if ffmpeg_supports_output_format(&output_format) {
                Some(if request.overwrite_existing.unwrap_or(false) {
                    build_audio_temp_path(
                        input_path,
                        "batch-overwrite-encoded",
                        output_format.as_str(),
                    )
                } else {
                    destination_path.clone()
                })
            } else {
                failed_paths.push(path_to_string(input_path));
                continue;
            };

            let mut command = sox_command(&runtime);
            command
                .arg(if request.overwrite_existing.unwrap_or(false) {
                    "--clobber"
                } else {
                    "--no-clobber"
                })
                .arg(&prepared_input.source_path)
                .arg("-t")
                .arg(if sox_can_write_final {
                    output_format.as_str()
                } else {
                    SOX_INTERMEDIATE_OUTPUT_FORMAT
                })
                .arg(&working_output_path);
            if matches!(request.mode, AudioBatchProcessMode::Normalize) {
                command.arg("gain").arg("-n");
            }

            let output = spawn_sox_and_wait(&task_runtime, command)?;
            if !output.status.success() {
                failed_paths.push(path_to_string(input_path));
                continue;
            }

            let completed_output_path =
                if let Some(encoded_output_path) = encoded_output_path.as_ref() {
                    if encode_audio_with_ffmpeg(
                        Some(&task_runtime),
                        &working_output_path,
                        encoded_output_path,
                        &output_format,
                        true,
                    )
                    .is_err()
                    {
                        remove_file_if_exists(&working_output_path);
                        failed_paths.push(path_to_string(input_path));
                        continue;
                    }
                    remove_file_if_exists(&working_output_path);
                    encoded_output_path.clone()
                } else {
                    working_output_path.clone()
                };

            if request.overwrite_existing.unwrap_or(false) {
                move_or_copy_overwrite_result(&completed_output_path, input_path)?;
                processed_paths.push(path_to_string(input_path));
            } else {
                processed_paths.push(path_to_string(&destination_path));
            }
        }

        update_manual_explorer_task(
            task_id,
            Some("Finalizing audio batch…".to_string()),
            Some(total),
            Some(total),
        )?;
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
            let _ = cancel_manual_explorer_task(
                task_id,
                Some("Cancelled audio batch process.".to_string()),
            );
        } else {
            let _ = fail_manual_explorer_task(task_id, error.clone());
        }
    }
    run_result
}

#[tauri::command]
#[specta::specta]
pub async fn audio_analyze_preview(
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
        analyze_audio_file_native(&input)
    })
    .await
    .map_err(|error| format!("Audio preview analysis task failed to join: {error}"))?
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
    tauri::async_runtime::spawn_blocking(move || {
        execute_audio_transform(&app, &task_id, normalized_request)
    })
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
    let inputs = collect_audio_input_files(
        &request.input_paths,
        request.recurse_directories.unwrap_or(false),
    )?;
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
    tauri::async_runtime::spawn_blocking(move || {
        execute_audio_batch_process(&app, &task_id, request)
    })
    .await
    .map_err(|error| format!("Audio batch task failed to join: {error}"))?
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

    #[cfg(unix)]
    fn write_fake_sox_binary(script_path: &Path) {
        use std::os::unix::fs::PermissionsExt;

        fs::write(
            script_path,
            r#"#!/usr/bin/env bash
set -euo pipefail
if [[ "${1:-}" == "--help-format" ]]; then
  case "${2:-}" in
    wav) exit 0 ;;
    mp3) exit 1 ;;
    *) exit 1 ;;
  esac
fi
exit 0
"#,
        )
        .expect("write fake sox script");
        let mut permissions = fs::metadata(script_path)
            .expect("stat fake sox script")
            .permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(script_path, permissions).expect("chmod fake sox script");
    }

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

        let collected =
            collect_audio_input_files(&[path_to_string(workspace.path())], true).expect("collect");
        let collected_paths: HashSet<String> =
            collected.iter().map(|path| path_to_string(path)).collect();
        assert!(collected_paths.contains(&path_to_string(&audio)));
        assert!(collected_paths.contains(&path_to_string(&nested_audio)));
        assert!(!collected_paths.contains(&path_to_string(&text)));
    }

    #[cfg(unix)]
    #[test]
    fn plan_audio_output_routes_mp3_through_ffmpeg_when_sox_cannot_write_it() {
        let workspace = tempdir().expect("tempdir");
        let input_path = workspace.path().join("anthem.wav");
        let output_path = workspace.path().join("anthem.converted.mp3");
        let fake_sox_path = workspace.path().join("fake-sox.sh");
        fs::write(&input_path, b"demo").expect("write input");
        write_fake_sox_binary(&fake_sox_path);

        let runtime = SoxRuntime {
            executable_path: fake_sox_path,
            runtime_root: workspace.path().to_path_buf(),
        };
        let request = NormalizedAudioTransformRequest {
            input_path: input_path.clone(),
            final_output_path: output_path.clone(),
            overwrite_existing: true,
            mode: AudioTransformMode::ConvertFormat,
            trim_start_seconds: None,
            trim_end_seconds: None,
            fade_in_seconds: None,
            fade_out_seconds: None,
            normalize: false,
            output_format: "mp3".to_string(),
            generate_spectrogram: false,
            overwrite_original: false,
        };

        let plan = plan_audio_output(&runtime, &request).expect("plan output");

        assert_eq!(plan.sox_output_format, SOX_INTERMEDIATE_OUTPUT_FORMAT);
        assert_eq!(plan.final_output_format, "mp3");
        assert_eq!(plan.final_output_path, output_path);
        assert!(plan.ffmpeg_output_path.is_some());
        assert_ne!(plan.sox_output_path.extension().and_then(|value| value.to_str()), Some("mp3"));
    }
}
