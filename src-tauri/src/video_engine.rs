use crate::audio_engine::{
    audio_engine_get_state, audio_engine_load_deck, audio_engine_pause, audio_engine_play,
    audio_engine_seek, audio_engine_set_loop_region, audio_engine_stop, AudioDeckId,
    AudioEngineDeckRequest, AudioEngineLoadDeckRequest, AudioEngineLoopRegionRequest,
    AudioEngineSeekRequest, AudioEngineStateSnapshot,
};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager};
use tauri_specta::Event;

const DEFAULT_VIDEO_FFMPEG_BINARY: &str = "ffmpeg";
const DEFAULT_VIDEO_FFPROBE_BINARY: &str = "ffprobe";
const VIDEO_ENGINE_RUNTIME_DIR: &str = "video-workbench";
const VIDEO_ENGINE_TICK_INTERVAL_MS: u64 = 50;
const MINIMUM_VIDEO_LOOP_DURATION_SECONDS: f64 = 0.1;
const VIDEO_AUDIO_DECK_ID: AudioDeckId = AudioDeckId::B;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum VideoPlaybackBackend {
    WebviewMediaElement,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct VideoEngineLoopRegion {
    pub start_seconds: f64,
    pub end_seconds: f64,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct VideoEngineStateSnapshot {
    pub ready: bool,
    pub engine_error: Option<String>,
    pub loaded_path: Option<String>,
    pub loaded_name: Option<String>,
    pub duration_seconds: f64,
    pub width_px: Option<u32>,
    pub height_px: Option<u32>,
    pub frame_rate: Option<f64>,
    pub has_audio_track: bool,
    pub current_time_seconds: f64,
    pub is_playing: bool,
    pub is_loading: bool,
    pub playback_backend: VideoPlaybackBackend,
    pub loop_region: VideoEngineLoopRegion,
    pub audio_transport_ready: bool,
    pub audio_transport_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type, tauri_specta::Event)]
#[serde(rename_all = "camelCase")]
pub struct VideoEngineStateEvent {
    pub state: VideoEngineStateSnapshot,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct VideoEngineLoadSourceRequest {
    pub input_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct VideoEngineSeekRequest {
    pub position_seconds: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct VideoEngineLoopRegionRequest {
    pub start_seconds: f64,
    pub end_seconds: f64,
    pub enabled: bool,
}

#[derive(Default)]
pub struct VideoEngineManager {
    runtime: Mutex<Option<VideoEngineRuntimeHost>>,
}

struct VideoEngineRuntimeHost {
    shared: Arc<VideoEngineSharedState>,
}

struct VideoEngineSharedState {
    app_handle: AppHandle,
    state: Mutex<VideoEngineMutableState>,
    background_thread_started: AtomicBool,
}

#[derive(Debug, Clone)]
struct VideoEngineMutableState {
    ready: bool,
    engine_error: Option<String>,
    playback_backend: VideoPlaybackBackend,
    loaded_path: Option<String>,
    loaded_name: Option<String>,
    duration_seconds: f64,
    width_px: Option<u32>,
    height_px: Option<u32>,
    frame_rate: Option<f64>,
    has_audio_track: bool,
    current_time_seconds: f64,
    is_playing: bool,
    is_loading: bool,
    loop_region: VideoEngineLoopRegion,
    audio_transport_ready: bool,
    audio_transport_error: Option<String>,
    loaded_generation: u64,
    silent_playback_started_at: Option<Instant>,
    silent_playback_started_time_seconds: f64,
}

#[derive(Debug, Clone)]
struct PreparedVideoSource {
    input_path: PathBuf,
    loaded_name: String,
    duration_seconds: f64,
    width_px: u32,
    height_px: u32,
    frame_rate: Option<f64>,
    has_audio_track: bool,
}

#[derive(Debug, Clone)]
struct ProbedVideoMetadata {
    duration_seconds: f64,
    width_px: u32,
    height_px: u32,
    frame_rate: Option<f64>,
    has_audio_track: bool,
}

#[derive(Debug, Deserialize)]
struct FfprobeResponse {
    streams: Vec<FfprobeStream>,
    format: Option<FfprobeFormat>,
}

#[derive(Debug, Deserialize)]
struct FfprobeStream {
    codec_type: Option<String>,
    width: Option<u32>,
    height: Option<u32>,
    avg_frame_rate: Option<String>,
}

#[derive(Debug, Deserialize)]
struct FfprobeFormat {
    duration: Option<String>,
}

impl Default for VideoEngineMutableState {
    fn default() -> Self {
        Self {
            ready: false,
            engine_error: None,
            playback_backend: VideoPlaybackBackend::WebviewMediaElement,
            loaded_path: None,
            loaded_name: None,
            duration_seconds: 0.0,
            width_px: None,
            height_px: None,
            frame_rate: None,
            has_audio_track: false,
            current_time_seconds: 0.0,
            is_playing: false,
            is_loading: false,
            loop_region: VideoEngineLoopRegion {
                start_seconds: 0.0,
                end_seconds: 0.0,
                enabled: false,
            },
            audio_transport_ready: false,
            audio_transport_error: None,
            loaded_generation: 0,
            silent_playback_started_at: None,
            silent_playback_started_time_seconds: 0.0,
        }
    }
}

impl VideoEngineSharedState {
    fn new(app_handle: AppHandle) -> Self {
        Self {
            app_handle,
            state: Mutex::new(VideoEngineMutableState::default()),
            background_thread_started: AtomicBool::new(false),
        }
    }

    fn snapshot(&self) -> VideoEngineStateSnapshot {
        let state = self.state.lock().expect("video engine state poisoned");
        build_snapshot(&state)
    }

    fn emit_state(&self) {
        let _ = VideoEngineStateEvent {
            state: self.snapshot(),
        }
        .emit(&self.app_handle);
    }
}

fn build_snapshot(state: &VideoEngineMutableState) -> VideoEngineStateSnapshot {
    VideoEngineStateSnapshot {
        ready: state.ready,
        engine_error: state.engine_error.clone(),
        loaded_path: state.loaded_path.clone(),
        loaded_name: state.loaded_name.clone(),
        duration_seconds: state.duration_seconds,
        width_px: state.width_px,
        height_px: state.height_px,
        frame_rate: state.frame_rate,
        has_audio_track: state.has_audio_track,
        current_time_seconds: state.current_time_seconds,
        is_playing: state.is_playing,
        is_loading: state.is_loading,
        playback_backend: state.playback_backend,
        loop_region: state.loop_region.clone(),
        audio_transport_ready: state.audio_transport_ready,
        audio_transport_error: state.audio_transport_error.clone(),
    }
}

fn ensure_video_engine_shared(app: &AppHandle) -> Result<Arc<VideoEngineSharedState>, String> {
    let manager = app.state::<VideoEngineManager>();
    let mut runtime = manager
        .runtime
        .lock()
        .map_err(|_| "Video engine runtime lock was poisoned.".to_string())?;
    if let Some(runtime_host) = runtime.as_ref() {
        return Ok(runtime_host.shared.clone());
    }

    let runtime_host = build_video_engine_runtime(app)?;
    let shared = runtime_host.shared.clone();
    *runtime = Some(runtime_host);
    Ok(shared)
}

fn existing_video_engine_shared(app: &AppHandle) -> Option<Arc<VideoEngineSharedState>> {
    let manager = app.state::<VideoEngineManager>();
    let runtime = manager.runtime.lock().ok()?;
    runtime.as_ref().map(|value| value.shared.clone())
}

fn build_video_engine_runtime(app: &AppHandle) -> Result<VideoEngineRuntimeHost, String> {
    let shared = Arc::new(VideoEngineSharedState::new(app.clone()));
    start_video_engine_background_thread(shared.clone());
    Ok(VideoEngineRuntimeHost { shared })
}

fn start_video_engine_background_thread(shared: Arc<VideoEngineSharedState>) {
    if shared
        .background_thread_started
        .swap(true, Ordering::Relaxed)
    {
        return;
    }

    thread::spawn(move || loop {
        thread::sleep(Duration::from_millis(VIDEO_ENGINE_TICK_INTERVAL_MS));
        if advance_video_engine_transport(&shared).unwrap_or(false) {
            shared.emit_state();
        }
    });
}

fn advance_video_engine_transport(shared: &Arc<VideoEngineSharedState>) -> Result<bool, String> {
    let audio_snapshot = audio_engine_get_state(shared.app_handle.clone()).ok();
    let mut state = shared
        .state
        .lock()
        .map_err(|_| "Video engine state lock was poisoned.".to_string())?;

    if state.loaded_path.is_none() {
        state.silent_playback_started_at = None;
        return Ok(false);
    }

    let mut changed = false;
    let maybe_audio_deck = audio_snapshot.as_ref().and_then(|snapshot| {
        snapshot
            .decks
            .iter()
            .find(|deck| deck.deck_id == VIDEO_AUDIO_DECK_ID)
    });

    if let Some(audio_deck) = maybe_audio_deck {
        let audio_loaded_matches =
            audio_deck.loaded_path.as_deref() == state.loaded_path.as_deref();
        if audio_loaded_matches {
            let next_time_seconds =
                clamp_video_position(audio_deck.current_time_seconds, state.duration_seconds);
            if (state.current_time_seconds - next_time_seconds).abs() > 0.02 {
                state.current_time_seconds = next_time_seconds;
                changed = true;
            }
            if state.is_playing != audio_deck.is_playing {
                state.is_playing = audio_deck.is_playing;
                changed = true;
            }
            state.silent_playback_started_at = None;
        }
    }

    if state.is_playing && !state.audio_transport_ready {
        let now = Instant::now();
        let elapsed_seconds = match state.silent_playback_started_at {
            Some(started_at) => now.duration_since(started_at).as_secs_f64(),
            None => {
                state.silent_playback_started_at = Some(now);
                state.silent_playback_started_time_seconds = state.current_time_seconds;
                0.0
            }
        };
        let mut next_time_seconds = state.silent_playback_started_time_seconds + elapsed_seconds;
        if state.loop_region.enabled
            && state.loop_region.end_seconds > state.loop_region.start_seconds
        {
            let loop_duration = (state.loop_region.end_seconds - state.loop_region.start_seconds)
                .max(MINIMUM_VIDEO_LOOP_DURATION_SECONDS);
            if next_time_seconds >= state.loop_region.end_seconds {
                let overshoot =
                    (next_time_seconds - state.loop_region.start_seconds) % loop_duration;
                next_time_seconds = state.loop_region.start_seconds + overshoot;
            }
        } else if next_time_seconds >= state.duration_seconds {
            next_time_seconds = state.duration_seconds;
            state.is_playing = false;
            state.silent_playback_started_at = None;
        }
        let next_time_seconds = clamp_video_position(next_time_seconds, state.duration_seconds);
        if (state.current_time_seconds - next_time_seconds).abs() > 0.02 {
            state.current_time_seconds = next_time_seconds;
            changed = true;
        }
    } else {
        state.silent_playback_started_at = None;
    }

    Ok(changed)
}

fn clamp_video_position(position_seconds: f64, duration_seconds: f64) -> f64 {
    if !position_seconds.is_finite() {
        return 0.0;
    }
    position_seconds.clamp(0.0, duration_seconds.max(0.0))
}

pub(crate) fn validate_video_source_path(input_path: &str) -> Result<PathBuf, String> {
    let trimmed = input_path.trim();
    if trimmed.is_empty() {
        return Err("Input video path cannot be empty.".to_string());
    }
    let path = PathBuf::from(trimmed);
    if !path.exists() || !path.is_file() {
        return Err(format!("Input video does not exist: {}", path.display()));
    }
    Ok(path)
}

pub(crate) fn resolve_video_ffmpeg_binary() -> String {
    resolve_video_binary_from_env(
        &[
            "GREEBLEFS_VIDEO_FFMPEG_BINARY",
            "GREEBLEFS_FFMPEG_BINARY",
            "FFMPEG_BIN",
        ],
        DEFAULT_VIDEO_FFMPEG_BINARY,
    )
}

pub(crate) fn resolve_video_ffprobe_binary() -> String {
    resolve_video_binary_from_env(
        &[
            "GREEBLEFS_VIDEO_FFPROBE_BINARY",
            "GREEBLEFS_FFPROBE_BINARY",
            "FFPROBE_BIN",
        ],
        DEFAULT_VIDEO_FFPROBE_BINARY,
    )
}

fn resolve_video_binary_from_env(keys: &[&str], fallback: &str) -> String {
    keys.iter()
        .find_map(|key| std::env::var(key).ok())
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| fallback.to_string())
}

pub(crate) fn sanitize_video_runtime_stem(value: &str) -> String {
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
        "video".to_string()
    } else {
        collapsed.to_string()
    }
}

pub(crate) fn resolve_video_runtime_root(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_local_data_dir()
        .map(|path| path.join(VIDEO_ENGINE_RUNTIME_DIR))
        .map_err(|error| format!("Failed to resolve app local data directory: {error}"))
}

fn prepare_video_source(input_path: &Path) -> Result<PreparedVideoSource, String> {
    let metadata = probe_video_metadata(input_path)?;
    Ok(PreparedVideoSource {
        input_path: input_path.to_path_buf(),
        loaded_name: input_path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("video")
            .to_string(),
        duration_seconds: metadata.duration_seconds,
        width_px: metadata.width_px,
        height_px: metadata.height_px,
        frame_rate: metadata.frame_rate,
        has_audio_track: metadata.has_audio_track,
    })
}

fn probe_video_metadata(input_path: &Path) -> Result<ProbedVideoMetadata, String> {
    let ffprobe_binary = resolve_video_ffprobe_binary();
    let output = Command::new(&ffprobe_binary)
        .args([
            "-v",
            "error",
            "-show_streams",
            "-show_format",
            "-print_format",
            "json",
            &input_path.to_string_lossy(),
        ])
        .output()
        .map_err(|error| format!("Failed to launch ffprobe at '{ffprobe_binary}': {error}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let message = if !stderr.is_empty() {
            stderr
        } else if !stdout.is_empty() {
            stdout
        } else {
            format!("ffprobe exited with status {}", output.status)
        };
        return Err(format!("Video metadata probe failed: {message}"));
    }

    let response: FfprobeResponse = serde_json::from_slice(&output.stdout)
        .map_err(|error| format!("Failed to parse ffprobe JSON metadata: {error}"))?;
    let video_stream = response
        .streams
        .iter()
        .find(|stream| stream.codec_type.as_deref() == Some("video"))
        .ok_or_else(|| "No video stream was found in the selected file.".to_string())?;
    let width_px = video_stream
        .width
        .ok_or_else(|| "Video width was missing from ffprobe metadata.".to_string())?;
    let height_px = video_stream
        .height
        .ok_or_else(|| "Video height was missing from ffprobe metadata.".to_string())?;
    let duration_seconds = response
        .format
        .as_ref()
        .and_then(|format| format.duration.as_deref())
        .and_then(parse_ffprobe_duration_seconds)
        .filter(|value| *value > 0.0)
        .ok_or_else(|| "Video duration was missing from ffprobe metadata.".to_string())?;

    Ok(ProbedVideoMetadata {
        duration_seconds,
        width_px,
        height_px,
        frame_rate: video_stream
            .avg_frame_rate
            .as_deref()
            .and_then(parse_ffprobe_frame_rate),
        has_audio_track: response
            .streams
            .iter()
            .any(|stream| stream.codec_type.as_deref() == Some("audio")),
    })
}

fn resolve_video_audio_transport_status(
    audio_load_result: &Result<AudioEngineStateSnapshot, String>,
    input_path: &Path,
    has_audio_track: bool,
) -> (bool, Option<String>) {
    if !has_audio_track {
        return (false, None);
    }

    match audio_load_result {
        Ok(snapshot) => {
            let input_path_string = input_path.to_string_lossy();
            let maybe_video_deck = snapshot
                .decks
                .iter()
                .find(|deck| deck.deck_id == VIDEO_AUDIO_DECK_ID);
            let Some(video_deck) = maybe_video_deck else {
                return (
                    false,
                    Some(
                        "Native soundtrack preview is unavailable because the shared audio deck state was missing."
                            .to_string(),
                    ),
                );
            };

            let deck_loaded_matches =
                video_deck.loaded_path.as_deref() == Some(input_path_string.as_ref());
            if deck_loaded_matches && video_deck.error.is_none() {
                return (true, None);
            }

            let error_message = video_deck.error.clone().unwrap_or_else(|| {
                "Native soundtrack preview could not load this video's audio track. Silent timing fallback is active."
                    .to_string()
            });
            (false, Some(error_message))
        }
        Err(error) => (
            false,
            Some(format!(
                "Native soundtrack preview failed to start: {error}"
            )),
        ),
    }
}

fn parse_ffprobe_duration_seconds(value: &str) -> Option<f64> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return None;
    }
    trimmed
        .parse::<f64>()
        .ok()
        .filter(|seconds| seconds.is_finite())
}

fn parse_ffprobe_frame_rate(value: &str) -> Option<f64> {
    let trimmed = value.trim();
    if trimmed.is_empty() || trimmed == "0/0" {
        return None;
    }
    if let Some((numerator, denominator)) = trimmed.split_once('/') {
        let numerator = numerator.trim().parse::<f64>().ok()?;
        let denominator = denominator.trim().parse::<f64>().ok()?;
        if !numerator.is_finite() || !denominator.is_finite() || denominator.abs() < f64::EPSILON {
            return None;
        }
        let rate = numerator / denominator;
        return rate.is_finite().then_some(rate);
    }
    trimmed.parse::<f64>().ok().filter(|rate| rate.is_finite())
}

fn clamp_loop_region(
    duration_seconds: f64,
    start_seconds: f64,
    end_seconds: f64,
) -> Result<(f64, f64), String> {
    if !start_seconds.is_finite() || !end_seconds.is_finite() {
        return Err("Loop points must be finite numbers.".to_string());
    }
    if start_seconds < 0.0 {
        return Err("Loop start cannot be negative.".to_string());
    }
    if end_seconds <= start_seconds {
        return Err("Loop end must be greater than loop start.".to_string());
    }
    let bounded_start = start_seconds.clamp(0.0, duration_seconds.max(0.0));
    let bounded_end = end_seconds.clamp(
        bounded_start + MINIMUM_VIDEO_LOOP_DURATION_SECONDS,
        duration_seconds.max(bounded_start + MINIMUM_VIDEO_LOOP_DURATION_SECONDS),
    );
    Ok((bounded_start, bounded_end))
}

#[tauri::command]
#[specta::specta]
pub fn video_engine_prepare(app: AppHandle) -> Result<VideoEngineStateSnapshot, String> {
    let shared = ensure_video_engine_shared(&app)?;
    {
        let mut state = shared
            .state
            .lock()
            .map_err(|_| "Video engine state lock was poisoned.".to_string())?;
        state.ready = true;
    }
    let snapshot = shared.snapshot();
    shared.emit_state();
    Ok(snapshot)
}

#[tauri::command]
#[specta::specta]
pub fn video_engine_get_state(app: AppHandle) -> Result<VideoEngineStateSnapshot, String> {
    Ok(existing_video_engine_shared(&app)
        .map(|shared| shared.snapshot())
        .unwrap_or_else(|| build_snapshot(&VideoEngineMutableState::default())))
}

#[tauri::command]
#[specta::specta]
pub async fn video_engine_load_source(
    app: AppHandle,
    request: VideoEngineLoadSourceRequest,
) -> Result<VideoEngineStateSnapshot, String> {
    let shared = ensure_video_engine_shared(&app)?;
    let input_path = validate_video_source_path(&request.input_path)?;
    let generation = {
        let mut state = shared
            .state
            .lock()
            .map_err(|_| "Video engine state lock was poisoned.".to_string())?;
        state.loaded_generation = state.loaded_generation.saturating_add(1);
        state.ready = true;
        state.engine_error = None;
        state.loaded_path = Some(input_path.to_string_lossy().to_string());
        state.loaded_name = input_path
            .file_name()
            .and_then(|value| value.to_str())
            .map(ToOwned::to_owned);
        state.duration_seconds = 0.0;
        state.width_px = None;
        state.height_px = None;
        state.frame_rate = None;
        state.has_audio_track = false;
        state.current_time_seconds = 0.0;
        state.is_playing = false;
        state.is_loading = true;
        state.loop_region = VideoEngineLoopRegion {
            start_seconds: 0.0,
            end_seconds: 0.0,
            enabled: false,
        };
        state.audio_transport_ready = false;
        state.audio_transport_error = None;
        state.silent_playback_started_at = None;
        state.silent_playback_started_time_seconds = 0.0;
        state.loaded_generation
    };
    shared.emit_state();

    let input_path_for_prepare = input_path.clone();
    let prepared_source =
        tauri::async_runtime::spawn_blocking(move || prepare_video_source(&input_path_for_prepare))
            .await
            .map_err(|error| format!("Video source preparation task failed to join: {error}"))??;

    let audio_transport_result = if prepared_source.has_audio_track {
        Some(
            audio_engine_load_deck(
                app.clone(),
                AudioEngineLoadDeckRequest {
                    deck_id: VIDEO_AUDIO_DECK_ID,
                    input_path: prepared_source.input_path.to_string_lossy().to_string(),
                },
            )
            .await,
        )
    } else {
        None
    };
    let (audio_transport_ready, audio_transport_error) = audio_transport_result
        .as_ref()
        .map(|result| {
            resolve_video_audio_transport_status(
                result,
                prepared_source.input_path.as_path(),
                prepared_source.has_audio_track,
            )
        })
        .unwrap_or((false, None));

    let snapshot = {
        let mut state = shared
            .state
            .lock()
            .map_err(|_| "Video engine state lock was poisoned.".to_string())?;
        if state.loaded_generation != generation {
            return Ok(build_snapshot(&state));
        }
        state.ready = true;
        state.engine_error = None;
        state.loaded_path = Some(prepared_source.input_path.to_string_lossy().to_string());
        state.loaded_name = Some(prepared_source.loaded_name);
        state.duration_seconds = prepared_source.duration_seconds;
        state.width_px = Some(prepared_source.width_px);
        state.height_px = Some(prepared_source.height_px);
        state.frame_rate = prepared_source.frame_rate;
        state.has_audio_track = prepared_source.has_audio_track;
        state.current_time_seconds = 0.0;
        state.is_playing = false;
        state.is_loading = false;
        state.loop_region = VideoEngineLoopRegion {
            start_seconds: 0.0,
            end_seconds: prepared_source.duration_seconds,
            enabled: false,
        };
        state.audio_transport_ready = audio_transport_ready;
        state.audio_transport_error = audio_transport_error;
        build_snapshot(&state)
    };

    shared.emit_state();
    Ok(snapshot)
}

#[tauri::command]
#[specta::specta]
pub fn video_engine_play(app: AppHandle) -> Result<VideoEngineStateSnapshot, String> {
    let shared = ensure_video_engine_shared(&app)?;
    {
        let mut state = shared
            .state
            .lock()
            .map_err(|_| "Video engine state lock was poisoned.".to_string())?;
        if state.loaded_path.is_none() {
            return Err("Load a video before starting playback.".to_string());
        }
        state.is_playing = true;
        state.ready = true;
        state.silent_playback_started_at = Some(Instant::now());
        state.silent_playback_started_time_seconds = state.current_time_seconds;

        if state.audio_transport_ready {
            audio_engine_seek(
                app.clone(),
                AudioEngineSeekRequest {
                    deck_id: VIDEO_AUDIO_DECK_ID,
                    position_seconds: state.current_time_seconds,
                },
            )?;
            audio_engine_set_loop_region(
                app.clone(),
                AudioEngineLoopRegionRequest {
                    deck_id: VIDEO_AUDIO_DECK_ID,
                    start_seconds: state.loop_region.start_seconds,
                    end_seconds: state.loop_region.end_seconds,
                    enabled: state.loop_region.enabled,
                },
            )?;
            audio_engine_play(
                app.clone(),
                AudioEngineDeckRequest {
                    deck_id: VIDEO_AUDIO_DECK_ID,
                },
            )?;
        }
    }
    let snapshot = shared.snapshot();
    shared.emit_state();
    Ok(snapshot)
}

#[tauri::command]
#[specta::specta]
pub fn video_engine_pause(app: AppHandle) -> Result<VideoEngineStateSnapshot, String> {
    let shared = ensure_video_engine_shared(&app)?;
    {
        let mut state = shared
            .state
            .lock()
            .map_err(|_| "Video engine state lock was poisoned.".to_string())?;
        state.is_playing = false;
        state.silent_playback_started_at = None;
        if state.audio_transport_ready {
            audio_engine_pause(
                app.clone(),
                AudioEngineDeckRequest {
                    deck_id: VIDEO_AUDIO_DECK_ID,
                },
            )?;
        }
    }
    let snapshot = shared.snapshot();
    shared.emit_state();
    Ok(snapshot)
}

#[tauri::command]
#[specta::specta]
pub fn video_engine_stop(app: AppHandle) -> Result<VideoEngineStateSnapshot, String> {
    let shared = ensure_video_engine_shared(&app)?;
    {
        let mut state = shared
            .state
            .lock()
            .map_err(|_| "Video engine state lock was poisoned.".to_string())?;
        state.is_playing = false;
        state.silent_playback_started_at = None;
        state.current_time_seconds = if state.loop_region.enabled {
            state.loop_region.start_seconds
        } else {
            0.0
        };
        if state.audio_transport_ready {
            audio_engine_stop(
                app.clone(),
                AudioEngineDeckRequest {
                    deck_id: VIDEO_AUDIO_DECK_ID,
                },
            )?;
        }
    }
    let snapshot = shared.snapshot();
    shared.emit_state();
    Ok(snapshot)
}

#[tauri::command]
#[specta::specta]
pub fn video_engine_seek(
    app: AppHandle,
    request: VideoEngineSeekRequest,
) -> Result<VideoEngineStateSnapshot, String> {
    let shared = ensure_video_engine_shared(&app)?;
    {
        let mut state = shared
            .state
            .lock()
            .map_err(|_| "Video engine state lock was poisoned.".to_string())?;
        if state.loaded_path.is_none() {
            return Err("Load a video before seeking.".to_string());
        }
        state.current_time_seconds =
            clamp_video_position(request.position_seconds, state.duration_seconds);
        state.silent_playback_started_at = if state.is_playing {
            Some(Instant::now())
        } else {
            None
        };
        state.silent_playback_started_time_seconds = state.current_time_seconds;
        if state.audio_transport_ready {
            audio_engine_seek(
                app.clone(),
                AudioEngineSeekRequest {
                    deck_id: VIDEO_AUDIO_DECK_ID,
                    position_seconds: state.current_time_seconds,
                },
            )?;
        }
    }
    let snapshot = shared.snapshot();
    shared.emit_state();
    Ok(snapshot)
}

#[tauri::command]
#[specta::specta]
pub fn video_engine_set_loop_region(
    app: AppHandle,
    request: VideoEngineLoopRegionRequest,
) -> Result<VideoEngineStateSnapshot, String> {
    let shared = ensure_video_engine_shared(&app)?;
    {
        let mut state = shared
            .state
            .lock()
            .map_err(|_| "Video engine state lock was poisoned.".to_string())?;
        if state.loaded_path.is_none() {
            return Err("Load a video before setting a loop region.".to_string());
        }
        let (start_seconds, end_seconds) = clamp_loop_region(
            state.duration_seconds,
            request.start_seconds,
            request.end_seconds,
        )?;
        state.loop_region = VideoEngineLoopRegion {
            start_seconds,
            end_seconds,
            enabled: request.enabled,
        };
        if request.enabled && state.current_time_seconds >= end_seconds {
            state.current_time_seconds = start_seconds;
        }
        state.silent_playback_started_at = if state.is_playing {
            Some(Instant::now())
        } else {
            None
        };
        state.silent_playback_started_time_seconds = state.current_time_seconds;
        if state.audio_transport_ready {
            audio_engine_set_loop_region(
                app.clone(),
                AudioEngineLoopRegionRequest {
                    deck_id: VIDEO_AUDIO_DECK_ID,
                    start_seconds,
                    end_seconds,
                    enabled: request.enabled,
                },
            )?;
        }
    }
    let snapshot = shared.snapshot();
    shared.emit_state();
    Ok(snapshot)
}

#[cfg(test)]
mod tests {
    use super::{
        parse_ffprobe_duration_seconds, parse_ffprobe_frame_rate, probe_video_metadata,
        resolve_video_audio_transport_status, resolve_video_ffmpeg_binary,
        resolve_video_ffprobe_binary, VIDEO_AUDIO_DECK_ID,
    };
    use crate::audio_engine::{
        AudioDeckId, AudioDeckState, AudioEngineLoopRegion, AudioEngineStateSnapshot,
    };
    use std::path::{Path, PathBuf};
    use std::process::Command;
    use tempfile::tempdir;

    fn build_test_audio_deck_state(
        deck_id: AudioDeckId,
        loaded_path: Option<&str>,
        error: Option<&str>,
    ) -> AudioDeckState {
        AudioDeckState {
            deck_id,
            loaded_path: loaded_path.map(ToOwned::to_owned),
            loaded_name: loaded_path.and_then(|path| {
                Path::new(path)
                    .file_name()
                    .and_then(|value| value.to_str())
                    .map(ToOwned::to_owned)
            }),
            duration_seconds: 12.0,
            current_time_seconds: 0.0,
            gain_linear: 1.0,
            rate: 1.0,
            is_playing: false,
            is_loading: false,
            is_buffering: false,
            peak_meter_linear: 0.0,
            rms_meter_linear: 0.0,
            loop_region: AudioEngineLoopRegion {
                start_seconds: 0.0,
                end_seconds: 0.0,
                enabled: false,
            },
            error: error.map(ToOwned::to_owned),
            active_plugin_path: None,
            vst_parameters: Vec::new(),
        }
    }

    fn build_test_audio_snapshot(deck_b: AudioDeckState) -> AudioEngineStateSnapshot {
        AudioEngineStateSnapshot {
            ready: true,
            engine_error: None,
            armed_deck: AudioDeckId::A,
            output_sample_rate_hz: Some(48_000),
            output_channels: Some(2),
            decks: vec![
                build_test_audio_deck_state(AudioDeckId::A, None, None),
                deck_b,
            ],
        }
    }

    fn ensure_video_toolchain_available() -> Option<(String, String)> {
        let ffmpeg_binary = resolve_video_ffmpeg_binary();
        let ffprobe_binary = resolve_video_ffprobe_binary();

        let ffmpeg_ready = Command::new(&ffmpeg_binary)
            .arg("-version")
            .output()
            .map(|output| output.status.success())
            .unwrap_or(false);
        let ffprobe_ready = Command::new(&ffprobe_binary)
            .arg("-version")
            .output()
            .map(|output| output.status.success())
            .unwrap_or(false);

        if ffmpeg_ready && ffprobe_ready {
            Some((ffmpeg_binary, ffprobe_binary))
        } else {
            eprintln!(
                "Skipping real video toolchain test because ffmpeg ({ffmpeg_binary}) or ffprobe ({ffprobe_binary}) was unavailable."
            );
            None
        }
    }

    fn generate_test_video_fixture(
        ffmpeg_binary: &str,
        output_path: &Path,
        with_audio_track: bool,
    ) {
        let extension = output_path
            .extension()
            .and_then(|value| value.to_str())
            .expect("fixture extension")
            .to_ascii_lowercase();

        let mut command = Command::new(ffmpeg_binary);
        command.args(["-hide_banner", "-loglevel", "error", "-y"]);
        command.args(["-f", "lavfi", "-i", "testsrc=size=320x180:rate=24"]);
        if with_audio_track {
            command.args(["-f", "lavfi", "-i", "sine=frequency=880:sample_rate=48000"]);
        }
        command.args(["-t", "1.5", "-shortest"]);

        match extension.as_str() {
            "mp4" | "mov" | "mkv" => {
                command.args(["-c:v", "libx264", "-pix_fmt", "yuv420p"]);
                if with_audio_track {
                    command.args(["-c:a", "aac", "-b:a", "128k"]);
                } else {
                    command.arg("-an");
                }
            }
            "webm" => {
                command.args(["-c:v", "libvpx", "-pix_fmt", "yuv420p"]);
                if with_audio_track {
                    command.args(["-c:a", "libvorbis", "-b:a", "96k"]);
                } else {
                    command.arg("-an");
                }
            }
            "avi" => {
                command.args(["-c:v", "mpeg4", "-qscale:v", "4"]);
                if with_audio_track {
                    command.args(["-c:a", "pcm_s16le"]);
                } else {
                    command.arg("-an");
                }
            }
            other => panic!("unsupported fixture extension: {other}"),
        }

        command.arg(output_path);

        let output = command.output().expect("launch ffmpeg for fixture");
        if !output.status.success() {
            panic!(
                "failed to generate video fixture '{}': {}",
                output_path.display(),
                String::from_utf8_lossy(&output.stderr)
            );
        }
    }

    fn build_fixture_path(root: &Path, file_name: &str) -> PathBuf {
        root.join(file_name)
    }

    #[test]
    fn parse_ffprobe_frame_rate_supports_rational_values() {
        let parsed = parse_ffprobe_frame_rate("30000/1001").expect("frame rate");
        assert!((parsed - 29.97).abs() < 0.05);
        assert_eq!(parse_ffprobe_frame_rate("0/0"), None);
    }

    #[test]
    fn parse_ffprobe_duration_seconds_rejects_empty_values() {
        assert_eq!(parse_ffprobe_duration_seconds(""), None);
        let parsed = parse_ffprobe_duration_seconds("12.345").expect("duration");
        assert!((parsed - 12.345).abs() < f64::EPSILON);
    }

    #[test]
    fn audio_transport_status_requires_the_video_audio_deck_to_load_the_selected_path() {
        let input_path = Path::new("/tmp/demo.mov");
        let snapshot = build_test_audio_snapshot(build_test_audio_deck_state(
            VIDEO_AUDIO_DECK_ID,
            Some("/tmp/demo.mov"),
            None,
        ));

        let (ready, error) = resolve_video_audio_transport_status(&Ok(snapshot), input_path, true);

        assert!(ready);
        assert_eq!(error, None);
    }

    #[test]
    fn audio_transport_status_surfaces_audio_decode_failures_without_marking_transport_ready() {
        let input_path = Path::new("/tmp/demo.mov");
        let snapshot = build_test_audio_snapshot(build_test_audio_deck_state(
            VIDEO_AUDIO_DECK_ID,
            None,
            Some("No supported audio tracks were found in the selected file."),
        ));

        let (ready, error) = resolve_video_audio_transport_status(&Ok(snapshot), input_path, true);

        assert!(!ready);
        assert_eq!(
            error.as_deref(),
            Some("No supported audio tracks were found in the selected file.")
        );
    }

    #[test]
    fn audio_transport_status_stays_silent_when_the_video_has_no_audio_track() {
        let input_path = Path::new("/tmp/demo.mov");
        let snapshot = build_test_audio_snapshot(build_test_audio_deck_state(
            VIDEO_AUDIO_DECK_ID,
            None,
            Some("this error should be ignored when no track exists"),
        ));

        let (ready, error) = resolve_video_audio_transport_status(&Ok(snapshot), input_path, false);

        assert!(!ready);
        assert_eq!(error, None);
    }

    #[test]
    fn probe_video_metadata_reads_common_container_formats_and_audio_presence() {
        let Some((ffmpeg_binary, _ffprobe_binary)) = ensure_video_toolchain_available() else {
            return;
        };

        let temp_directory = tempdir().expect("video fixture tempdir");
        for extension in ["mp4", "mov", "webm", "mkv", "avi"] {
            let fixture_path = build_fixture_path(
                temp_directory.path(),
                &format!("metadata-fixture.{extension}"),
            );
            generate_test_video_fixture(&ffmpeg_binary, &fixture_path, true);

            let metadata = probe_video_metadata(&fixture_path).unwrap_or_else(|error| {
                panic!("expected metadata for {}: {error}", fixture_path.display())
            });

            assert!(
                metadata.duration_seconds > 1.0,
                "{}",
                fixture_path.display()
            );
            assert_eq!(metadata.width_px, 320, "{}", fixture_path.display());
            assert_eq!(metadata.height_px, 180, "{}", fixture_path.display());
            assert!(
                metadata.frame_rate.unwrap_or_default() >= 20.0,
                "{}",
                fixture_path.display()
            );
            assert!(metadata.has_audio_track, "{}", fixture_path.display());
        }

        let silent_fixture_path = build_fixture_path(temp_directory.path(), "metadata-silent.mp4");
        generate_test_video_fixture(&ffmpeg_binary, &silent_fixture_path, false);

        let silent_metadata = probe_video_metadata(&silent_fixture_path).unwrap_or_else(|error| {
            panic!(
                "expected metadata for {}: {error}",
                silent_fixture_path.display()
            )
        });

        assert!(!silent_metadata.has_audio_track);
    }
}
