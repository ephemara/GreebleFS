use crate::audio_engine::{
    analyze_audio_file_native, analyze_audio_file_with_runtime, decode_audio_preview_mono_samples,
};
use crate::fs_commands::{
    cancel_manual_explorer_task, complete_manual_explorer_task,
    create_manual_explorer_task_with_id, fail_manual_explorer_task,
    set_manual_explorer_task_cancel_context, update_manual_explorer_task,
    ExplorerTaskCancelContext, ExplorerTaskKind, ExplorerTaskRegistration,
    ExplorerTaskRetryContext,
};
use image::{DynamicImage, ImageFormat};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use tauri::AppHandle;

const DEFAULT_FFMPEG_BINARY: &str = "ffmpeg";

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct AudioWaveformBucket {
    pub index: u32,
    pub peak_level: f64,
    pub rms_level: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct AudioSilenceRegion {
    pub start_seconds: f64,
    pub end_seconds: f64,
    pub duration_seconds: f64,
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
    pub estimated_bpm: Option<f64>,
    pub silence_regions: Vec<AudioSilenceRegion>,
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
    pub pitch_shift_cents: Option<f64>,
    pub normalize: Option<bool>,
    pub gain_linear: Option<f64>,
    pub rate_multiplier: Option<f64>,
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
    pub sox_binary: String, // Keeping this field in TS contract for backwards compat for now
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
    pub sox_binary: String, // Kept for TS compat
}

#[derive(Debug)]
struct AudioTaskRuntime {
    cancelled: AtomicBool,
    child: Mutex<Option<Child>>,
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
    pitch_shift_cents: Option<f64>,
    gain_linear: Option<f64>,
    rate_multiplier: Option<f64>,
    normalize: bool,
    output_format: String,
    generate_spectrogram: bool,
    overwrite_original: bool,
}

static AUDIO_TASKS: OnceLock<Mutex<HashMap<String, Arc<AudioTaskRuntime>>>> = OnceLock::new();

fn audio_tasks() -> &'static Mutex<HashMap<String, Arc<AudioTaskRuntime>>> {
    AUDIO_TASKS.get_or_init(|| Mutex::new(HashMap::new()))
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

    let child = command.spawn().map_err(|error| {
        format!(
            "Failed to launch ffmpeg at '{}': {error}",
            resolve_ffmpeg_binary()
        )
    })?;

    if let Some(task_runtime) = task_runtime {
        let mut child_guard = task_runtime.child.lock().unwrap();
        *child_guard = None; // Can't easily store child if we need wait_with_output, but we can poll it
    }

    // Since wait_with_output consumes child, we will just wait here instead of complicated polling
    // For robust cancellation we would poll, but wait_with_output is simple for now.
    let output = child.wait_with_output().map_err(|error| {
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
    let pitch_shift_cents = request.pitch_shift_cents.and_then(|value| {
        if value.is_finite() && value.abs() <= 2400.0 {
            Some(value)
        } else {
            None
        }
    });
    let mode = request.mode.clone();
    let overwrite_original = matches!(mode, AudioTransformMode::OverwriteOriginal);
    let source_extension = input_audio_extension(&input_path);
    let mut output_format = normalize_optional_string(request.output_format.as_deref())
        .map(|value| normalize_audio_format(&value))
        .unwrap_or_else(|| match mode {
            AudioTransformMode::OverwriteOriginal => {
                input_audio_extension(&input_path).unwrap_or_else(|| "wav".to_string())
            }
            _ => "wav".to_string(),
        });
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
    });

    let output_path = if overwrite_original {
        build_audio_temp_path(&input_path, "overwrite-stage", output_format.as_str())
    } else {
        final_output_path.clone()
    };

    if !overwrite_original
        && fs::canonicalize(&input_path).ok() == fs::canonicalize(&output_path).ok()
    {
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
        pitch_shift_cents,
        gain_linear: request
            .gain_linear
            .filter(|value| value.is_finite() && *value > 0.0),
        rate_multiplier: request
            .rate_multiplier
            .filter(|value| value.is_finite() && *value > 0.0),
        normalize: request
            .normalize
            .unwrap_or(matches!(mode, AudioTransformMode::ExportNormalized)),
        output_format,
        generate_spectrogram: request.generate_spectrogram.unwrap_or(false),
        overwrite_original,
    })
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
                pitch_shift_cents: request.pitch_shift_cents,
                gain_linear: request.gain_linear,
                rate_multiplier: request.rate_multiplier,
                normalize: Some(request.normalize),
                output_format: Some(request.output_format.clone()),
                generate_spectrogram: Some(request.generate_spectrogram),
            },
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

fn execute_audio_transform(
    _app: &AppHandle,
    task_id: &str,
    request: NormalizedAudioTransformRequest,
) -> Result<AudioTransformResult, String> {
    let task_runtime = register_audio_runtime(task_id)?;
    let run_result = (|| {
        update_manual_explorer_task(
            task_id,
            Some("Preparing FFmpeg transform…".to_string()),
            Some(0),
            Some(3),
        )?;

        let mut command = ffmpeg_command();
        command.args(["-hide_banner", "-loglevel", "error"]);
        command.arg(
            if request.overwrite_existing || request.overwrite_original {
                "-y"
            } else {
                "-n"
            },
        );

        // Add input trimming
        if let Some(start) = request.trim_start_seconds {
            command.args(["-ss", &format!("{start:.6}")]);
        }
        if let Some(end) = request.trim_end_seconds {
            command.args(["-to", &format!("{end:.6}")]);
        }

        command.args(["-i", &path_to_string(&request.input_path)]);

        // Build Audio Filter Map
        let mut filters = Vec::new();

        // High priority normalizations and gains
        if request.normalize {
            if let Ok(analysis) = analyze_audio_file_native(&request.input_path) {
                if analysis.peak_level > 0.0 {
                    let mut gain = 1.0 / analysis.peak_level;
                    if let Some(linear) = request.gain_linear {
                        gain *= linear;
                    }
                    filters.push(format!("volume={gain:.6}"));
                }
            }
        } else if let Some(gain_linear) = request.gain_linear {
            if (gain_linear - 1.0).abs() > 0.001 {
                filters.push(format!("volume={gain_linear:.6}"));
            }
        }

        // Speed/Rate
        if let Some(rate) = request.rate_multiplier {
            if (rate - 1.0).abs() > 0.001 {
                filters.push(format!("atempo={rate:.6}"));
            }
        }

        // Pitch
        if let Some(pitch_shift_cents) = request
            .pitch_shift_cents
            .filter(|value| value.abs() > f64::EPSILON)
        {
            let ratio = 2.0_f64.powf(pitch_shift_cents / 1200.0);
            if let Ok(analysis) = analyze_audio_file_native(&request.input_path) {
                if let Some(sr) = analysis.sample_rate_hz {
                    // Quick pitch shift via asetrate + resample + atempo logic
                    filters.push(format!("asetrate={}*{}", sr, ratio));
                    filters.push(format!("aresample={}", sr));
                    filters.push(format!("atempo={}", 1.0 / ratio));
                }
            }
        }

        // Fades
        if request.fade_in_seconds.is_some() || request.fade_out_seconds.is_some() {
            let fade_in = request.fade_in_seconds.unwrap_or(0.0);
            let fade_out = request.fade_out_seconds.unwrap_or(0.0);
            if fade_in > 0.0 {
                filters.push(format!("afade=t=in:ss=0:d={fade_in:.6}"));
            }
            if fade_out > 0.0 {
                // If we know duration we apply it at end, else FFmpeg might need specific times.
                // Assuming we use duration or trim end
                if let Some(end) = request.trim_end_seconds {
                    let trim_start = request.trim_start_seconds.unwrap_or(0.0);
                    let clip_dur = end - trim_start;
                    filters.push(format!(
                        "afade=t=out:st={}:d={}",
                        clip_dur - fade_out,
                        fade_out
                    ));
                } else if let Ok(analysis) = analyze_audio_file_native(&request.input_path) {
                    filters.push(format!(
                        "afade=t=out:st={}:d={}",
                        analysis.duration_seconds - fade_out,
                        fade_out
                    ));
                }
            }
        }

        if !filters.is_empty() {
            command.arg("-af").arg(filters.join(","));
        }

        // Set high quality encodes for standard formats
        if request.output_format == "mp3" {
            command.args(["-codec:a", "libmp3lame", "-q:a", "2"]);
        } else if request.output_format == "ogg" || request.output_format == "vorbis" {
            command.args(["-codec:a", "libvorbis", "-q:a", "4"]);
        } else if request.output_format == "wav" {
            command.args(["-codec:a", "pcm_s16le"]);
        }

        let working_output_path = if request.overwrite_original {
            build_audio_temp_path(
                &request.input_path,
                "overwrite-working",
                &request.output_format,
            )
        } else {
            request.final_output_path.clone()
        };

        command.arg(&working_output_path);

        let output = spawn_ffmpeg_and_wait(Some(&task_runtime), command)?;
        if !output.status.success() {
            let message = String::from_utf8_lossy(&output.stderr).trim().to_string();
            return Err(if message.is_empty() {
                format!("FFmpeg exited with status {}", output.status)
            } else {
                format!("Audio transform failed: {message}")
            });
        }

        update_manual_explorer_task(
            task_id,
            Some("Writing transform output…".to_string()),
            Some(2),
            Some(3),
        )?;

        if request.overwrite_original {
            if request.final_output_path.exists() {
                let _ = fs::remove_file(&request.final_output_path);
            }
            fs::rename(&working_output_path, &request.final_output_path)
                .or_else(|_| {
                    fs::copy(&working_output_path, &request.final_output_path)
                        .map(|_| ())
                        .and_then(|_| fs::remove_file(&working_output_path))
                })
                .map_err(|e| format!("Failed to overwrite original file: {e}"))?;
        }

        let spectrogram_path = if request.generate_spectrogram {
            let path = request
                .final_output_path
                .with_extension(format!("{}.spectrogram.png", request.output_format));
            let gpu_spectrogram =
                crate::gpu_runtime::global_gpu_runtime().and_then(|gpu_runtime| {
                    decode_audio_preview_mono_samples(&request.final_output_path)
                        .ok()
                        .and_then(|(mono_samples, _sample_rate_hz)| {
                            gpu_runtime
                                .render_audio_spectrogram(&mono_samples, 1024, 256)
                                .ok()
                        })
                });

            if let Some(spectrogram_image) = gpu_spectrogram {
                DynamicImage::ImageRgba8(spectrogram_image)
                    .save_with_format(&path, ImageFormat::Png)
                    .map_err(|error| format!("Spectrogram export failed: {error}"))?;
            } else {
                let mut spectrogram = ffmpeg_command();
                spectrogram.args(["-hide_banner", "-loglevel", "error", "-y"]);
                spectrogram.args(["-i", &path_to_string(&request.final_output_path)]);
                spectrogram.args(["-lavfi", "showspectrumpic=s=1024x256"]);
                spectrogram.arg(&path);
                let spectrogram_output = spawn_ffmpeg_and_wait(Some(&task_runtime), spectrogram)?;
                if !spectrogram_output.status.success() {
                    let message = String::from_utf8_lossy(&spectrogram_output.stderr)
                        .trim()
                        .to_string();
                    return Err(format!("Spectrogram export failed: {message}"));
                }
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

        let mut out_duration = None;
        if let Ok(analysis) = analyze_audio_file_native(&request.final_output_path) {
            out_duration = Some(analysis.duration_seconds);
        }

        let result = AudioTransformResult {
            task_id: task_id.to_string(),
            output_path: path_to_string(&request.final_output_path),
            spectrogram_path,
            duration_seconds: out_duration,
            output_format: request.output_format.clone(),
            overwritten_original: request.overwrite_original,
            sox_binary: resolve_ffmpeg_binary(),
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

fn execute_audio_batch_process(
    _app: &AppHandle,
    _task_id: &str,
    _request: AudioBatchProcessRequest,
) -> Result<AudioBatchProcessResult, String> {
    // Currently throwing err instead of re-implementing batch logic
    // Just minimal support to not break rust signatures while shifting to ffmpeg
    Err("Batch Process over FFmpeg is not yet fully implemented in this phase.".to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn audio_analyze_preview(input_path: String) -> Result<AudioPreviewAnalysis, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let trimmed = input_path.trim();
        if trimmed.is_empty() {
            return Err("Input audio path cannot be empty.".to_string());
        }
        let input = PathBuf::from(trimmed);
        if !input.exists() || !input.is_file() {
            return Err(format!("Input audio does not exist: {}", input.display()));
        }
        analyze_audio_file_with_runtime(&input, crate::gpu_runtime::global_gpu_runtime())
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
    let normalized_request = normalize_audio_transform_request(request)?;
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

#[tauri::command]
#[specta::specta]
pub async fn audio_batch_process(
    app: AppHandle,
    request: AudioBatchProcessRequest,
) -> Result<AudioBatchProcessResult, String> {
    let task_id = format!("audio-batch-{}", uuid::Uuid::new_v4());
    tauri::async_runtime::spawn_blocking(move || {
        execute_audio_batch_process(&app, &task_id, request)
    })
    .await
    .map_err(|error| format!("Audio batch task failed to join: {error}"))?
}
