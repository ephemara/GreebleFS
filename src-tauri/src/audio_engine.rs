use std::fs::File;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicBool, AtomicU64, AtomicU8, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use arc_swap::ArcSwapOption;
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{FromSample, Sample, SizedSample, StreamConfig};
use rubato::audioadapter_buffers::direct::InterleavedSlice;
use rubato::{Fft, FixedSync, Resampler};
use rustfft::num_complex::Complex;
use rustfft::FftPlanner;
use serde::{Deserialize, Serialize};
use symphonia::core::audio::SampleBuffer;
use symphonia::core::codecs::DecoderOptions;
use symphonia::core::formats::{FormatOptions, Track};
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;
use symphonia::default::{get_codecs, get_probe};
use tauri::{AppHandle, Manager};
use tauri_specta::Event;
use vst_host::HeadlessVstHost;

use crate::audio_commands::{AudioPreviewAnalysis, AudioSilenceRegion, AudioWaveformBucket};
use crate::gpu_runtime::GpuRuntimeManager;

const AUDIO_ENGINE_EVENT_INTERVAL_MS: u64 = 50;
const LOOP_CROSSFADE_FRAMES: usize = 128;
const MIN_LOOP_DURATION_SECONDS: f64 = 0.05;
const DEFAULT_GAIN_LINEAR: f64 = 1.0;
const DEFAULT_RATE: f64 = 1.0;
const DEFAULT_ANALYSIS_WAVEFORM_BUCKET_COUNT: usize = 160;
const DEFAULT_SILENCE_WINDOW_SECONDS: f64 = 0.05;
const DEFAULT_MIN_SILENCE_SECONDS: f64 = 0.18;
const DEFAULT_SILENCE_FLOOR_LINEAR: f64 = 0.0015;
const DEFAULT_BPM_MIN: f64 = 60.0;
const DEFAULT_BPM_MAX: f64 = 200.0;
const DEFAULT_AUDIO_FFMPEG_BINARY: &str = "ffmpeg";

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum AudioDeckId {
    A,
    B,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct AudioEngineLoopRegion {
    pub start_seconds: f64,
    pub end_seconds: f64,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct AudioDeckState {
    pub deck_id: AudioDeckId,
    pub loaded_path: Option<String>,
    pub loaded_name: Option<String>,
    pub duration_seconds: f64,
    pub current_time_seconds: f64,
    pub gain_linear: f64,
    pub rate: f64,
    pub is_playing: bool,
    pub is_loading: bool,
    pub is_buffering: bool,
    pub peak_meter_linear: f64,
    pub rms_meter_linear: f64,
    pub loop_region: AudioEngineLoopRegion,
    pub error: Option<String>,
    pub active_plugin_path: Option<String>,
    pub vst_parameters: Vec<VstParameterState>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct VstParameterState {
    pub id: u32,
    pub title: String,
    pub short_title: String,
    pub units: String,
    pub default_normalized: f64,
    pub min: f64,
    pub max: f64,
    pub value_normalized: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct AudioEngineStateSnapshot {
    pub ready: bool,
    pub engine_error: Option<String>,
    pub armed_deck: AudioDeckId,
    pub output_sample_rate_hz: Option<u32>,
    pub output_channels: Option<u16>,
    pub decks: Vec<AudioDeckState>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type, tauri_specta::Event)]
#[serde(rename_all = "camelCase")]
pub struct AudioEngineStateEvent {
    pub state: AudioEngineStateSnapshot,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct AudioEngineLoadDeckRequest {
    pub deck_id: AudioDeckId,
    pub input_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct AudioEngineLoadPluginRequest {
    pub deck_id: AudioDeckId,
    pub plugin_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct AudioEngineSetPluginParameterRequest {
    pub deck_id: AudioDeckId,
    pub parameter_id: u32,
    pub value_normalized: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct AudioEngineDeckRequest {
    pub deck_id: AudioDeckId,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct AudioEngineSeekRequest {
    pub deck_id: AudioDeckId,
    pub position_seconds: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct AudioEngineLoopRegionRequest {
    pub deck_id: AudioDeckId,
    pub start_seconds: f64,
    pub end_seconds: f64,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct AudioEngineGainRequest {
    pub deck_id: AudioDeckId,
    pub gain_linear: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct AudioEngineRateRequest {
    pub deck_id: AudioDeckId,
    pub rate: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct AudioEngineSetArmedDeckRequest {
    pub deck_id: AudioDeckId,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct AudioEngineSyncSelectionRequest {
    pub input_path: String,
}

#[derive(Default)]
pub struct AudioEngineManager {
    runtime: Mutex<Option<AudioEngineRuntimeHost>>,
}

struct AudioEngineRuntimeHost {
    shared: Arc<AudioEngineSharedState>,
    _stream: cpal::Stream,
}

struct AudioEngineSharedState {
    app_handle: AppHandle,
    device_sample_rate_hz: u32,
    output_channels: u16,
    ready: AtomicBool,
    armed_deck: AtomicU8,
    engine_error: Mutex<Option<String>>,
    decks: [AudioDeckRuntime; 2],
}

struct AudioDeckRuntime {
    deck_id: AudioDeckId,
    clip: ArcSwapOption<AudioClip>,
    metadata: Mutex<AudioDeckMetadata>,
    is_playing: AtomicBool,
    is_loading: AtomicBool,
    position_frames: AtomicU64,
    gain_linear: AtomicU64,
    playback_rate: AtomicU64,
    loop_enabled: AtomicBool,
    loop_start_frames: AtomicU64,
    loop_end_frames: AtomicU64,
    peak_meter_linear: AtomicU64,
    rms_meter_linear: AtomicU64,
    load_generation: AtomicU64,
}

#[derive(Debug, Clone, Default)]
struct AudioDeckMetadata {
    loaded_path: Option<String>,
    loaded_name: Option<String>,
    duration_seconds: f64,
    is_buffering: bool,
    error: Option<String>,
    active_plugin_path: Option<String>,
    vst_parameters: Vec<VstParameterState>,
}

struct AudioClip {
    path: String,
    name: String,
    sample_rate_hz: u32,
    channels: usize,
    frames: usize,
    samples: Vec<f32>,
}

struct DecodedAudioData {
    sample_rate_hz: u32,
    channels: usize,
    frames: usize,
    samples: Vec<f32>,
}

struct TemporaryAudioFile {
    path: PathBuf,
}

impl TemporaryAudioFile {
    fn new(path: PathBuf) -> Self {
        Self { path }
    }
}

impl Drop for TemporaryAudioFile {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.path);
    }
}

fn resolve_audio_ffmpeg_binary() -> String {
    std::env::var("FFMPEG_BIN")
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| DEFAULT_AUDIO_FFMPEG_BINARY.to_string())
}

fn build_vst_parameter_state_snapshot(
    plugin_path: &str,
) -> Result<Vec<VstParameterState>, String> {
    let host = HeadlessVstHost::load_plugin(plugin_path)?;
    Ok(host
        .parameters
        .into_iter()
        .map(|parameter| VstParameterState {
            id: parameter.id,
            title: parameter.title,
            short_title: parameter.short_title,
            units: parameter.units,
            default_normalized: parameter.default_normalized,
            min: parameter.min,
            max: parameter.max,
            value_normalized: parameter.default_normalized,
        })
        .collect())
}

impl AudioDeckRuntime {
    fn new(deck_id: AudioDeckId) -> Self {
        Self {
            deck_id,
            clip: ArcSwapOption::default(),
            metadata: Mutex::new(AudioDeckMetadata::default()),
            is_playing: AtomicBool::new(false),
            is_loading: AtomicBool::new(false),
            position_frames: AtomicU64::new(0.0f64.to_bits()),
            gain_linear: AtomicU64::new(DEFAULT_GAIN_LINEAR.to_bits()),
            playback_rate: AtomicU64::new(DEFAULT_RATE.to_bits()),
            loop_enabled: AtomicBool::new(false),
            loop_start_frames: AtomicU64::new(0.0f64.to_bits()),
            loop_end_frames: AtomicU64::new(0.0f64.to_bits()),
            peak_meter_linear: AtomicU64::new(0.0f64.to_bits()),
            rms_meter_linear: AtomicU64::new(0.0f64.to_bits()),
            load_generation: AtomicU64::new(0),
        }
    }

    fn clear_loaded_clip(&self) {
        self.clip.store(None);
        self.is_playing.store(false, Ordering::Relaxed);
        set_atomic_f64(&self.position_frames, 0.0);
        self.loop_enabled.store(false, Ordering::Relaxed);
        set_atomic_f64(&self.loop_start_frames, 0.0);
        set_atomic_f64(&self.loop_end_frames, 0.0);
        set_atomic_f64(&self.peak_meter_linear, 0.0);
        set_atomic_f64(&self.rms_meter_linear, 0.0);
    }
}

impl AudioEngineSharedState {
    fn new(app_handle: AppHandle, device_sample_rate_hz: u32, output_channels: u16) -> Self {
        Self {
            app_handle,
            device_sample_rate_hz,
            output_channels,
            ready: AtomicBool::new(false),
            armed_deck: AtomicU8::new(AudioDeckId::A.as_index() as u8),
            engine_error: Mutex::new(None),
            decks: [
                AudioDeckRuntime::new(AudioDeckId::A),
                AudioDeckRuntime::new(AudioDeckId::B),
            ],
        }
    }

    fn deck(&self, deck_id: AudioDeckId) -> &AudioDeckRuntime {
        &self.decks[deck_id.as_index()]
    }

    fn armed_deck(&self) -> AudioDeckId {
        AudioDeckId::from_index(self.armed_deck.load(Ordering::Relaxed) as usize)
    }

    fn emit_state(&self) {
        let _ = AudioEngineStateEvent {
            state: self.snapshot(),
        }
        .emit(&self.app_handle);
    }

    fn snapshot(&self) -> AudioEngineStateSnapshot {
        AudioEngineStateSnapshot {
            ready: self.ready.load(Ordering::Relaxed),
            engine_error: self
                .engine_error
                .lock()
                .ok()
                .and_then(|message| message.clone()),
            armed_deck: self.armed_deck(),
            output_sample_rate_hz: Some(self.device_sample_rate_hz),
            output_channels: Some(self.output_channels),
            decks: self
                .decks
                .iter()
                .map(|deck| self.deck_snapshot(deck))
                .collect(),
        }
    }

    fn deck_snapshot(&self, deck: &AudioDeckRuntime) -> AudioDeckState {
        let metadata = deck
            .metadata
            .lock()
            .map(|guard| guard.clone())
            .unwrap_or_default();
        let current_time_seconds =
            atomic_f64(&deck.position_frames) / self.device_sample_rate_hz as f64;
        let loop_region = AudioEngineLoopRegion {
            start_seconds: atomic_f64(&deck.loop_start_frames) / self.device_sample_rate_hz as f64,
            end_seconds: atomic_f64(&deck.loop_end_frames) / self.device_sample_rate_hz as f64,
            enabled: deck.loop_enabled.load(Ordering::Relaxed),
        };
        AudioDeckState {
            deck_id: deck.deck_id,
            loaded_path: metadata.loaded_path,
            loaded_name: metadata.loaded_name,
            duration_seconds: metadata.duration_seconds,
            current_time_seconds,
            gain_linear: atomic_f64(&deck.gain_linear),
            rate: atomic_f64(&deck.playback_rate),
            is_playing: deck.is_playing.load(Ordering::Relaxed),
            is_loading: deck.is_loading.load(Ordering::Relaxed),
            is_buffering: metadata.is_buffering,
            peak_meter_linear: atomic_f64(&deck.peak_meter_linear),
            rms_meter_linear: atomic_f64(&deck.rms_meter_linear),
            loop_region,
            error: metadata.error,
            active_plugin_path: metadata.active_plugin_path,
            vst_parameters: metadata.vst_parameters,
        }
    }
}

impl AudioDeckId {
    fn as_index(self) -> usize {
        match self {
            Self::A => 0,
            Self::B => 1,
        }
    }

    fn from_index(value: usize) -> Self {
        match value {
            1 => Self::B,
            _ => Self::A,
        }
    }
}

fn atomic_f64(value: &AtomicU64) -> f64 {
    f64::from_bits(value.load(Ordering::Relaxed))
}

fn set_atomic_f64(target: &AtomicU64, value: f64) {
    target.store(value.to_bits(), Ordering::Relaxed);
}

fn default_audio_engine_state_snapshot() -> AudioEngineStateSnapshot {
    AudioEngineStateSnapshot {
        ready: false,
        engine_error: None,
        armed_deck: AudioDeckId::A,
        output_sample_rate_hz: None,
        output_channels: None,
        decks: vec![
            AudioDeckState {
                deck_id: AudioDeckId::A,
                loaded_path: None,
                loaded_name: None,
                duration_seconds: 0.0,
                current_time_seconds: 0.0,
                gain_linear: DEFAULT_GAIN_LINEAR,
                rate: DEFAULT_RATE,
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
                error: None,
                active_plugin_path: None,
                vst_parameters: Vec::new(),
            },
            AudioDeckState {
                deck_id: AudioDeckId::B,
                loaded_path: None,
                loaded_name: None,
                duration_seconds: 0.0,
                current_time_seconds: 0.0,
                gain_linear: DEFAULT_GAIN_LINEAR,
                rate: DEFAULT_RATE,
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
                error: None,
                active_plugin_path: None,
                vst_parameters: Vec::new(),
            },
        ],
    }
}

fn ensure_audio_engine_shared(app: &AppHandle) -> Result<Arc<AudioEngineSharedState>, String> {
    let manager = app.state::<AudioEngineManager>();
    let mut runtime = manager
        .runtime
        .lock()
        .map_err(|_| "Audio engine runtime lock was poisoned.".to_string())?;
    if let Some(runtime_host) = runtime.as_ref() {
        return Ok(runtime_host.shared.clone());
    }
    let runtime_host = build_audio_engine_runtime(app)?;
    let shared = runtime_host.shared.clone();
    *runtime = Some(runtime_host);
    Ok(shared)
}

fn existing_audio_engine_shared(app: &AppHandle) -> Option<Arc<AudioEngineSharedState>> {
    let manager = app.state::<AudioEngineManager>();
    let runtime = manager.runtime.lock().ok()?;
    runtime.as_ref().map(|value| value.shared.clone())
}

fn build_audio_engine_runtime(app: &AppHandle) -> Result<AudioEngineRuntimeHost, String> {
    let host = cpal::default_host();
    let device = host
        .default_output_device()
        .ok_or_else(|| "No default output audio device is available.".to_string())?;
    let supported_config = device
        .default_output_config()
        .map_err(|error| format!("Failed to query default audio output config: {error}"))?;
    let sample_format = supported_config.sample_format();
    let output_sample_rate_hz = supported_config.sample_rate();
    let stream_config: StreamConfig = supported_config.config();
    let shared = Arc::new(AudioEngineSharedState::new(
        app.clone(),
        output_sample_rate_hz,
        stream_config.channels,
    ));
    let error_shared = shared.clone();
    let err_fn = move |error| {
        if let Ok(mut engine_error) = error_shared.engine_error.lock() {
            *engine_error = Some(format!("Audio output stream error: {error}"));
        }
    };
    let stream = match sample_format {
        cpal::SampleFormat::F32 => {
            build_output_stream::<f32>(&device, &stream_config, shared.clone(), err_fn)?
        }
        cpal::SampleFormat::I16 => {
            build_output_stream::<i16>(&device, &stream_config, shared.clone(), err_fn)?
        }
        cpal::SampleFormat::U16 => {
            build_output_stream::<u16>(&device, &stream_config, shared.clone(), err_fn)?
        }
        unsupported => {
            return Err(format!("Unsupported output sample format: {unsupported:?}"));
        }
    };
    stream
        .play()
        .map_err(|error| format!("Failed to start audio output stream: {error}"))?;
    shared.ready.store(true, Ordering::Relaxed);
    start_audio_engine_event_emitter(shared.clone());
    shared.emit_state();
    Ok(AudioEngineRuntimeHost {
        shared,
        _stream: stream,
    })
}

fn build_output_stream<T>(
    device: &cpal::Device,
    config: &StreamConfig,
    shared: Arc<AudioEngineSharedState>,
    err_fn: impl FnMut(cpal::StreamError) + Send + 'static,
) -> Result<cpal::Stream, String>
where
    T: Sample + SizedSample + FromSample<f32>,
{
    let channels = config.channels as usize;
    device
        .build_output_stream(
            config,
            move |data: &mut [T], _| write_output_data(data, channels, &shared),
            err_fn,
            None,
        )
        .map_err(|error| format!("Failed to build audio output stream: {error}"))
}

fn write_output_data<T>(
    output: &mut [T],
    output_channels: usize,
    shared: &Arc<AudioEngineSharedState>,
) where
    T: Sample + FromSample<f32>,
{
    let mut contexts = [
        DeckRenderContext::from_runtime(&shared.decks[0]),
        DeckRenderContext::from_runtime(&shared.decks[1]),
    ];
    for frame in output.chunks_mut(output_channels) {
        for sample in frame.iter_mut() {
            *sample = T::from_sample(0.0f32);
        }
        for channel_index in 0..output_channels {
            let mut mixed_sample = 0.0f32;
            for context in &mut contexts {
                mixed_sample += context.sample_channel(channel_index);
            }
            frame[channel_index] = T::from_sample(mixed_sample.clamp(-1.0, 1.0));
        }
        for context in &mut contexts {
            context.advance_frame();
        }
    }
    for context in &contexts {
        context.commit();
    }
}

struct DeckRenderContext<'a> {
    runtime: &'a AudioDeckRuntime,
    clip: Option<Arc<AudioClip>>,
    position_frames: f64,
    gain_linear: f32,
    playback_rate: f64,
    loop_enabled: bool,
    loop_start_frames: f64,
    loop_end_frames: f64,
    is_playing: bool,
    peak_meter_linear: f64,
    rms_sum_squares: f64,
    rms_count: u64,
}

impl<'a> DeckRenderContext<'a> {
    fn from_runtime(runtime: &'a AudioDeckRuntime) -> Self {
        Self {
            runtime,
            clip: runtime.clip.load_full(),
            position_frames: atomic_f64(&runtime.position_frames),
            gain_linear: atomic_f64(&runtime.gain_linear) as f32,
            playback_rate: atomic_f64(&runtime.playback_rate).clamp(0.25, 4.0),
            loop_enabled: runtime.loop_enabled.load(Ordering::Relaxed),
            loop_start_frames: atomic_f64(&runtime.loop_start_frames),
            loop_end_frames: atomic_f64(&runtime.loop_end_frames),
            is_playing: runtime.is_playing.load(Ordering::Relaxed),
            peak_meter_linear: 0.0,
            rms_sum_squares: 0.0,
            rms_count: 0,
        }
    }

    fn sample_channel(&mut self, output_channel: usize) -> f32 {
        if !self.is_playing {
            return 0.0;
        }
        let Some(clip) = self.clip.as_ref() else {
            self.is_playing = false;
            return 0.0;
        };
        if clip.frames == 0 {
            self.is_playing = false;
            return 0.0;
        }
        let loop_end = if self.loop_enabled {
            self.loop_end_frames
                .clamp(self.loop_start_frames + 1.0, clip.frames as f64)
        } else {
            clip.frames as f64
        };
        if !self.loop_enabled && self.position_frames >= clip.frames as f64 {
            self.is_playing = false;
            self.position_frames = clip.frames as f64;
            return 0.0;
        }
        let fade_frames = if self.loop_enabled {
            let region_frames = (loop_end - self.loop_start_frames).max(0.0);
            LOOP_CROSSFADE_FRAMES
                .min((region_frames / 2.0).floor() as usize)
                .max(0)
        } else {
            0
        };
        let channel_sample = if self.loop_enabled
            && fade_frames > 0
            && self.position_frames >= loop_end - fade_frames as f64
        {
            let alpha = ((self.position_frames - (loop_end - fade_frames as f64))
                / fade_frames as f64)
                .clamp(0.0, 1.0) as f32;
            let tail_sample = interpolated_clip_sample(clip, output_channel, self.position_frames);
            let head_position =
                self.loop_start_frames + (self.position_frames - (loop_end - fade_frames as f64));
            let head_sample = interpolated_clip_sample(clip, output_channel, head_position);
            (tail_sample * (1.0 - alpha)) + (head_sample * alpha)
        } else {
            interpolated_clip_sample(clip, output_channel, self.position_frames)
        };
        let scaled_sample = channel_sample * self.gain_linear;
        let absolute = scaled_sample.abs() as f64;
        if absolute > self.peak_meter_linear {
            self.peak_meter_linear = absolute;
        }
        self.rms_sum_squares += (scaled_sample as f64) * (scaled_sample as f64);
        self.rms_count += 1;
        scaled_sample
    }

    fn advance_frame(&mut self) {
        if !self.is_playing {
            return;
        }
        let Some(clip) = self.clip.as_ref() else {
            self.is_playing = false;
            return;
        };
        self.position_frames += self.playback_rate;
        let total_frames = clip.frames as f64;
        if self.loop_enabled {
            let loop_start = self.loop_start_frames.clamp(0.0, total_frames);
            let loop_end = self.loop_end_frames.clamp(loop_start + 1.0, total_frames);
            while self.position_frames >= loop_end {
                self.position_frames = loop_start + (self.position_frames - loop_end);
            }
        } else if self.position_frames >= total_frames {
            self.position_frames = total_frames;
            self.is_playing = false;
        }
    }

    fn commit(&self) {
        self.runtime
            .is_playing
            .store(self.is_playing, Ordering::Relaxed);
        set_atomic_f64(&self.runtime.position_frames, self.position_frames);
        set_atomic_f64(&self.runtime.peak_meter_linear, self.peak_meter_linear);
        let rms_value = if self.rms_count > 0 {
            (self.rms_sum_squares / self.rms_count as f64).sqrt()
        } else {
            0.0
        };
        set_atomic_f64(&self.runtime.rms_meter_linear, rms_value);
    }
}

fn interpolated_clip_sample(clip: &AudioClip, output_channel: usize, frame_position: f64) -> f32 {
    if clip.frames == 0 {
        return 0.0;
    }
    let clamped_position = frame_position.clamp(0.0, (clip.frames.saturating_sub(1)) as f64);
    let base_frame = clamped_position.floor() as usize;
    let next_frame = (base_frame + 1).min(clip.frames.saturating_sub(1));
    let alpha = (clamped_position - base_frame as f64) as f32;
    let base_sample = clip_sample_at_frame(clip, base_frame, output_channel);
    let next_sample = clip_sample_at_frame(clip, next_frame, output_channel);
    (base_sample * (1.0 - alpha)) + (next_sample * alpha)
}

fn clip_sample_at_frame(clip: &AudioClip, frame_index: usize, output_channel: usize) -> f32 {
    if clip.channels == 0 {
        return 0.0;
    }
    if output_channel == 0 && clip.channels > 1 {
        let mut total = 0.0f32;
        let count = clip.channels.min(2);
        for channel_index in 0..count {
            total += clip.samples[(frame_index * clip.channels) + channel_index];
        }
        return total / count as f32;
    }
    let source_channel = if clip.channels == 1 {
        0
    } else {
        output_channel.min(clip.channels - 1)
    };
    clip.samples[(frame_index * clip.channels) + source_channel]
}

fn start_audio_engine_event_emitter(shared: Arc<AudioEngineSharedState>) {
    thread::spawn(move || loop {
        shared.emit_state();
        thread::sleep(Duration::from_millis(AUDIO_ENGINE_EVENT_INTERVAL_MS));
    });
}

pub fn analyze_audio_file_native(input_path: &Path) -> Result<AudioPreviewAnalysis, String> {
    analyze_audio_file_with_runtime(input_path, None)
}

fn analyze_audio_preview_with_runtime(
    input_path: &Path,
    gpu_runtime: Option<&GpuRuntimeManager>,
    shared: Option<&AudioEngineSharedState>,
) -> Result<AudioPreviewAnalysis, String> {
    if let Some(shared) = shared {
        if let Some(clip) = find_loaded_clip_for_path(shared, input_path) {
            return analyze_audio_samples_with_runtime(
                input_path,
                clip.sample_rate_hz,
                clip.channels,
                &clip.samples,
                "Native deck cache",
                gpu_runtime,
            );
        }
    }

    analyze_audio_file_with_runtime(input_path, gpu_runtime)
}

pub(crate) fn analyze_audio_preview_for_app(
    app: &AppHandle,
    input_path: &Path,
    gpu_runtime: Option<&GpuRuntimeManager>,
) -> Result<AudioPreviewAnalysis, String> {
    let shared = existing_audio_engine_shared(app);
    analyze_audio_preview_with_runtime(input_path, gpu_runtime, shared.as_deref())
}

pub fn analyze_audio_file_with_runtime(
    input_path: &Path,
    gpu_runtime: Option<&GpuRuntimeManager>,
) -> Result<AudioPreviewAnalysis, String> {
    let decoded = decode_audio_file(input_path)?;
    analyze_audio_samples_with_runtime(
        input_path,
        decoded.sample_rate_hz,
        decoded.channels,
        &decoded.samples,
        "Decoded via Symphonia",
        gpu_runtime,
    )
}

pub fn decode_audio_preview_mono_samples(input_path: &Path) -> Result<(Vec<f32>, u32), String> {
    let decoded = decode_audio_file(input_path)?;
    Ok((
        mix_to_mono(&decoded.samples, decoded.channels),
        decoded.sample_rate_hz,
    ))
}

fn decode_audio_clip_for_device(
    input_path: &Path,
    output_sample_rate_hz: u32,
) -> Result<AudioClip, String> {
    let decoded = decode_audio_file(input_path)?;
    let resampled = if decoded.sample_rate_hz == output_sample_rate_hz {
        decoded
    } else {
        resample_audio_data(decoded, output_sample_rate_hz)?
    };
    let name = input_path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("Audio Clip")
        .to_string();
    Ok(AudioClip {
        path: input_path.to_string_lossy().to_string(),
        name,
        sample_rate_hz: resampled.sample_rate_hz,
        channels: resampled.channels,
        frames: resampled.frames,
        samples: resampled.samples,
    })
}

fn decode_audio_file(input_path: &Path) -> Result<DecodedAudioData, String> {
    match decode_audio_file_with_symphonia(input_path) {
        Ok(decoded) => Ok(decoded),
        Err(primary_error) => decode_audio_file_via_ffmpeg(input_path).map_err(|fallback_error| {
            format!("{primary_error}; ffmpeg fallback failed: {fallback_error}")
        }),
    }
}

fn decode_audio_file_with_symphonia(input_path: &Path) -> Result<DecodedAudioData, String> {
    let file = File::open(input_path).map_err(|error| {
        format!(
            "Failed to open audio file '{}': {error}",
            input_path.display()
        )
    })?;
    let media_source_stream = MediaSourceStream::new(Box::new(file), Default::default());
    let mut hint = Hint::new();
    if let Some(extension) = input_path.extension().and_then(|value| value.to_str()) {
        hint.with_extension(extension);
    }
    let probed = get_probe()
        .format(
            &hint,
            media_source_stream,
            &FormatOptions::default(),
            &MetadataOptions::default(),
        )
        .map_err(|error| {
            format!(
                "Failed to probe audio file '{}': {error}",
                input_path.display()
            )
        })?;
    let mut format = probed.format;
    let track = select_audio_track(format.as_ref())?;
    let track_id = track.id;
    let codec_params = track.codec_params.clone();
    let mut decoder = get_codecs()
        .make(&codec_params, &DecoderOptions::default())
        .map_err(|error| {
            format!(
                "Failed to create audio decoder for '{}': {error}",
                input_path.display()
            )
        })?;
    let mut interleaved_samples = Vec::<f32>::new();
    let mut sample_rate_hz = codec_params.sample_rate;
    let mut channels = codec_params.channels.map(|channels| channels.count());
    loop {
        let packet = match format.next_packet() {
            Ok(packet) => packet,
            Err(_) => break, // EOF or IO error, stop reading packets but keep what we have
        };
        if packet.track_id() != track_id {
            continue;
        }
        match decoder.decode(&packet) {
            Ok(decoded) => {
                let decoded_spec = decoded.spec();
                sample_rate_hz.get_or_insert(decoded_spec.rate);
                channels.get_or_insert(decoded_spec.channels.count());
                let mut sample_buffer =
                    SampleBuffer::<f32>::new(decoded.capacity() as u64, *decoded_spec);
                sample_buffer.copy_interleaved_ref(decoded);
                interleaved_samples.extend_from_slice(sample_buffer.samples());
            }
            Err(symphonia::core::errors::Error::DecodeError(_)) => {
                // A recoverable decode error (e.g., bad frame in MP3). Ignore and continue.
                continue;
            }
            Err(_) => {
                // A fatal error, stop decoding.
                break;
            }
        }
    }
    let sample_rate_hz = sample_rate_hz.ok_or_else(|| {
        format!(
            "Audio file '{}' is missing a sample rate.",
            input_path.display()
        )
    })?;
    let channels = channels.ok_or_else(|| {
        format!(
            "Audio file '{}' is missing channel metadata.",
            input_path.display()
        )
    })?;
    let frames = interleaved_samples.len() / channels.max(1);
    Ok(DecodedAudioData {
        sample_rate_hz,
        channels,
        frames,
        samples: interleaved_samples,
    })
}

fn decode_audio_file_via_ffmpeg(input_path: &Path) -> Result<DecodedAudioData, String> {
    let temp_path = std::env::temp_dir().join(format!(
        "greeblefs-audio-decode-{}.wav",
        uuid::Uuid::new_v4()
    ));
    let cleanup_guard = TemporaryAudioFile::new(temp_path.clone());

    let output = Command::new(resolve_audio_ffmpeg_binary())
        .args(["-hide_banner", "-loglevel", "error", "-y", "-i"])
        .arg(input_path)
        .args(["-vn", "-sn", "-dn", "-acodec", "pcm_s16le"])
        .arg(&temp_path)
        .output()
        .map_err(|error| {
            format!(
                "Failed to launch ffmpeg at '{}': {error}",
                resolve_audio_ffmpeg_binary()
            )
        })?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    let decoded = decode_audio_file_with_symphonia(&temp_path);
    drop(cleanup_guard);
    decoded
}

fn select_audio_track<'a>(
    format: &'a dyn symphonia::core::formats::FormatReader,
) -> Result<Track, String> {
    format
        .default_track()
        .cloned()
        .or_else(|| {
            format
                .tracks()
                .iter()
                .find(|track| track.codec_params.sample_rate.is_some())
                .cloned()
        })
        .ok_or_else(|| "No decodable audio track was found in the selected file.".to_string())
}

fn resample_audio_data(
    decoded: DecodedAudioData,
    output_sample_rate_hz: u32,
) -> Result<DecodedAudioData, String> {
    if decoded.frames == 0 || decoded.channels == 0 {
        return Ok(DecodedAudioData {
            sample_rate_hz: output_sample_rate_hz,
            ..decoded
        });
    }
    let input = InterleavedSlice::new(decoded.samples.as_slice(), decoded.channels, decoded.frames)
        .map_err(|error| format!("Failed to wrap decoded audio for resampling: {error}"))?;
    let mut resampler = Fft::<f32>::new(
        decoded.sample_rate_hz as usize,
        output_sample_rate_hz as usize,
        decoded.frames.max(1024),
        1,
        decoded.channels,
        FixedSync::Input,
    )
    .map_err(|error| format!("Failed to construct audio resampler: {error}"))?;
    let output_frames = resampler.process_all_needed_output_len(decoded.frames);
    let mut output_samples = vec![0.0f32; output_frames * decoded.channels];
    let resampled_frames = {
        let mut output = InterleavedSlice::new_mut(
            output_samples.as_mut_slice(),
            decoded.channels,
            output_frames,
        )
        .map_err(|error| format!("Failed to allocate resampled audio buffer: {error}"))?;
        let (_, written_frames) = resampler
            .process_all_into_buffer(&input, &mut output, decoded.frames, None)
            .map_err(|error| format!("Failed to resample audio: {error}"))?;
        written_frames
    };
    output_samples.truncate(resampled_frames * decoded.channels);
    Ok(DecodedAudioData {
        sample_rate_hz: output_sample_rate_hz,
        channels: decoded.channels,
        frames: resampled_frames,
        samples: output_samples,
    })
}

fn analyze_decoded_waveform(
    samples: &[f32],
    bucket_count: usize,
) -> (f64, f64, Vec<AudioWaveformBucket>) {
    if samples.is_empty() {
        return (0.0, 0.0, Vec::new());
    }
    let peak_level = samples
        .iter()
        .fold(0.0f64, |peak, sample| peak.max(sample.abs() as f64));
    let rms_level = ((samples
        .iter()
        .map(|sample| {
            let value = *sample as f64;
            value * value
        })
        .sum::<f64>())
        / samples.len() as f64)
        .sqrt();
    let chunk_size = (samples.len() / bucket_count.max(1)).max(1);
    let mut buckets = Vec::new();
    for (index, chunk) in samples.chunks(chunk_size).enumerate() {
        let chunk_peak = chunk
            .iter()
            .fold(0.0f64, |peak, sample| peak.max(sample.abs() as f64));
        let chunk_rms = ((chunk
            .iter()
            .map(|sample| {
                let value = *sample as f64;
                value * value
            })
            .sum::<f64>())
            / chunk.len().max(1) as f64)
            .sqrt();
        buckets.push(AudioWaveformBucket {
            index: index as u32,
            peak_level: chunk_peak,
            rms_level: chunk_rms,
        });
    }
    (peak_level, rms_level, buckets)
}

fn compute_peak_and_rms(samples: &[f32]) -> (f64, f64) {
    if samples.is_empty() {
        return (0.0, 0.0);
    }

    let peak_level = samples
        .iter()
        .fold(0.0f64, |peak, sample| peak.max(sample.abs() as f64));
    let rms_level = ((samples
        .iter()
        .map(|sample| {
            let value = *sample as f64;
            value * value
        })
        .sum::<f64>())
        / samples.len() as f64)
        .sqrt();
    (peak_level, rms_level)
}

fn prepare_fft_analysis_samples(mono: &[f32]) -> Vec<f32> {
    let fft_size = mono.len().min(4096).next_power_of_two().max(256);
    let mut output = vec![0.0f32; fft_size];
    let copy_len = mono.len().min(fft_size);
    output[..copy_len].copy_from_slice(&mono[..copy_len]);
    output
}

fn compute_spectral_bands_from_mono(mono: &[f32], band_count: usize) -> Vec<f64> {
    if mono.is_empty() || band_count == 0 {
        return Vec::new();
    }

    let fft_size = mono.len().min(4096).next_power_of_two().max(256);
    let mut planner = FftPlanner::<f32>::new();
    let fft = planner.plan_fft_forward(fft_size);
    let mut buffer = vec![Complex::new(0.0f32, 0.0f32); fft_size];
    for (index, sample) in mono.iter().take(fft_size).enumerate() {
        buffer[index].re = *sample;
    }
    fft.process(&mut buffer);
    let half = fft_size / 2;
    let band_width = (half / band_count.max(1)).max(1);
    let mut bands = Vec::with_capacity(band_count);
    for band_index in 0..band_count {
        let start = band_index * band_width;
        let end = ((band_index + 1) * band_width).min(half);
        if start >= end {
            bands.push(0.0);
            continue;
        }
        let mut magnitude_sum = 0.0f64;
        for bin in &buffer[start..end] {
            magnitude_sum += bin.norm() as f64;
        }
        bands.push(magnitude_sum / (end - start) as f64);
    }
    let max_value = bands.iter().copied().fold(0.0f64, f64::max);
    if max_value > 0.0 {
        bands.iter_mut().for_each(|value| *value /= max_value);
    }
    bands
}

fn analyze_audio_samples_with_runtime(
    input_path: &Path,
    sample_rate_hz: u32,
    channels: usize,
    samples: &[f32],
    encoding_label: &str,
    gpu_runtime: Option<&GpuRuntimeManager>,
) -> Result<AudioPreviewAnalysis, String> {
    let normalized_channels = channels.max(1);
    let mono = mix_to_mono(samples, normalized_channels);
    let (peak_level, rms_level) = compute_peak_and_rms(samples);
    let waveform_buckets = gpu_runtime
        .and_then(|runtime| {
            runtime
                .reduce_audio_waveform(&mono, DEFAULT_ANALYSIS_WAVEFORM_BUCKET_COUNT)
                .ok()
        })
        .unwrap_or_else(|| {
            analyze_decoded_waveform(samples, DEFAULT_ANALYSIS_WAVEFORM_BUCKET_COUNT).2
        });
    let spectral_fft_samples = prepare_fft_analysis_samples(&mono);
    let spectral_bands = gpu_runtime
        .and_then(|runtime| {
            runtime
                .reduce_audio_spectral_bands(&spectral_fft_samples, 24)
                .ok()
        })
        .unwrap_or_else(|| compute_spectral_bands_from_mono(&mono, 24));
    let silence_regions = detect_silence_regions(&mono, sample_rate_hz, peak_level);
    let estimated_bpm = estimate_bpm(&mono, sample_rate_hz);
    let duration_seconds = if sample_rate_hz == 0 || channels == 0 {
        0.0
    } else {
        (samples.len() / channels) as f64 / sample_rate_hz as f64
    };

    Ok(AudioPreviewAnalysis {
        input_path: input_path.to_string_lossy().to_string(),
        duration_seconds,
        sample_rate_hz: Some(sample_rate_hz),
        channels: Some(channels as u32),
        encoding: Some(encoding_label.to_string()),
        bits_per_sample: Some(32),
        container_type: input_path
            .extension()
            .and_then(|value| value.to_str())
            .map(|value| value.to_ascii_lowercase()),
        peak_level,
        rms_level,
        loudness_db: decibels_from_linear(rms_level),
        headroom_db: headroom_from_peak(peak_level),
        waveform_buckets,
        spectral_bands,
        estimated_bpm,
        silence_regions,
    })
}

fn find_loaded_clip_for_path(
    shared: &AudioEngineSharedState,
    input_path: &Path,
) -> Option<Arc<AudioClip>> {
    let target_path = input_path.to_string_lossy();
    shared.decks.iter().find_map(|deck| {
        let clip = deck.clip.load_full()?;
        (clip.path == target_path.as_ref()).then_some(clip)
    })
}

fn detect_silence_regions(
    mono: &[f32],
    sample_rate_hz: u32,
    peak_level: f64,
) -> Vec<AudioSilenceRegion> {
    if mono.is_empty() || sample_rate_hz == 0 {
        return Vec::new();
    }

    let window_size =
        ((sample_rate_hz as f64 * DEFAULT_SILENCE_WINDOW_SECONDS).round() as usize).max(1);
    let min_region_windows =
        ((DEFAULT_MIN_SILENCE_SECONDS / DEFAULT_SILENCE_WINDOW_SECONDS).ceil() as usize).max(1);
    let threshold = DEFAULT_SILENCE_FLOOR_LINEAR.max(peak_level * 0.01);

    let mut regions = Vec::new();
    let mut current_start_window: Option<usize> = None;

    for (window_index, chunk) in mono.chunks(window_size).enumerate() {
        let rms = ((chunk
            .iter()
            .map(|sample| {
                let value = *sample as f64;
                value * value
            })
            .sum::<f64>())
            / chunk.len().max(1) as f64)
            .sqrt();

        if rms <= threshold {
            current_start_window.get_or_insert(window_index);
            continue;
        }

        if let Some(start_window) = current_start_window.take() {
            let end_window = window_index;
            if end_window.saturating_sub(start_window) >= min_region_windows {
                let start_seconds = start_window as f64 * DEFAULT_SILENCE_WINDOW_SECONDS;
                let end_seconds = (end_window as f64 * DEFAULT_SILENCE_WINDOW_SECONDS)
                    .min(mono.len() as f64 / sample_rate_hz as f64);
                if end_seconds > start_seconds {
                    regions.push(AudioSilenceRegion {
                        start_seconds,
                        end_seconds,
                        duration_seconds: end_seconds - start_seconds,
                    });
                }
            }
        }
    }

    if let Some(start_window) = current_start_window {
        let total_windows = mono.len().div_ceil(window_size);
        if total_windows.saturating_sub(start_window) >= min_region_windows {
            let start_seconds = start_window as f64 * DEFAULT_SILENCE_WINDOW_SECONDS;
            let end_seconds = mono.len() as f64 / sample_rate_hz as f64;
            if end_seconds > start_seconds {
                regions.push(AudioSilenceRegion {
                    start_seconds,
                    end_seconds,
                    duration_seconds: end_seconds - start_seconds,
                });
            }
        }
    }

    regions
}

fn estimate_bpm(mono: &[f32], sample_rate_hz: u32) -> Option<f64> {
    if mono.is_empty() || sample_rate_hz == 0 {
        return None;
    }

    let frame_size = 1024usize.min(mono.len()).max(256);
    let hop_size = (frame_size / 2).max(128);
    let frames = mono.len().saturating_sub(frame_size) / hop_size + 1;
    if frames < 8 {
        return None;
    }

    let mut onset_envelope = Vec::with_capacity(frames);
    let mut previous_energy = 0.0f64;

    for frame_index in 0..frames {
        let start = frame_index * hop_size;
        let end = (start + frame_size).min(mono.len());
        let frame = &mono[start..end];
        let energy =
            frame.iter().map(|sample| sample.abs() as f64).sum::<f64>() / frame.len() as f64;
        let onset = (energy - previous_energy).max(0.0);
        onset_envelope.push(onset);
        previous_energy = energy;
    }

    let max_onset = onset_envelope.iter().copied().fold(0.0f64, f64::max);
    if max_onset <= f64::EPSILON {
        return None;
    }
    onset_envelope
        .iter_mut()
        .for_each(|value| *value /= max_onset);

    let envelope_rate_hz = sample_rate_hz as f64 / hop_size as f64;
    let min_lag = (envelope_rate_hz * 60.0 / DEFAULT_BPM_MAX).floor() as usize;
    let max_lag = (envelope_rate_hz * 60.0 / DEFAULT_BPM_MIN).ceil() as usize;
    if min_lag == 0 || max_lag <= min_lag || onset_envelope.len() <= max_lag {
        return None;
    }

    let mut best_lag = 0usize;
    let mut best_score = 0.0f64;

    for lag in min_lag..=max_lag {
        let mut score = 0.0f64;
        for index in lag..onset_envelope.len() {
            score += onset_envelope[index] * onset_envelope[index - lag];
        }
        if score > best_score {
            best_score = score;
            best_lag = lag;
        }
    }

    if best_lag == 0 || best_score <= 0.0 {
        return None;
    }

    let bpm = 60.0 * envelope_rate_hz / best_lag as f64;
    if bpm.is_finite() && (DEFAULT_BPM_MIN..=DEFAULT_BPM_MAX * 2.0).contains(&bpm) {
        Some((bpm * 10.0).round() / 10.0)
    } else {
        None
    }
}

fn mix_to_mono(interleaved: &[f32], channels: usize) -> Vec<f32> {
    if channels <= 1 {
        return interleaved.to_vec();
    }
    interleaved
        .chunks(channels)
        .map(|frame| frame.iter().copied().sum::<f32>() / channels as f32)
        .collect()
}

fn decibels_from_linear(value: f64) -> Option<f64> {
    if !value.is_finite() || value <= 0.0 {
        return None;
    }
    Some(20.0 * value.log10())
}

fn headroom_from_peak(peak_level: f64) -> Option<f64> {
    if !peak_level.is_finite() || peak_level <= 0.0 {
        return None;
    }
    Some(-20.0 * peak_level.log10())
}

fn validate_audio_file_path(input_path: &str) -> Result<PathBuf, String> {
    let trimmed = input_path.trim();
    if trimmed.is_empty() {
        return Err("Input audio path cannot be empty.".to_string());
    }
    let path = PathBuf::from(trimmed);
    if !path.exists() || !path.is_file() {
        return Err(format!("Input audio does not exist: {}", path.display()));
    }
    Ok(path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Command;
    use tempfile::tempdir;

    #[test]
    fn detect_silence_regions_finds_head_and_tail_silence() {
        let sample_rate_hz = 1000u32;
        let mut mono = vec![0.0f32; 250];
        mono.extend(std::iter::repeat_n(0.8f32, 500));
        mono.extend(std::iter::repeat_n(0.0f32, 300));

        let regions = detect_silence_regions(&mono, sample_rate_hz, 0.8);

        assert_eq!(regions.len(), 2);
        assert!(regions[0].start_seconds <= 0.01);
        assert!(regions[0].duration_seconds >= 0.2);
        assert!(regions[1].start_seconds >= 0.7);
    }

    #[test]
    fn estimate_bpm_detects_regular_pulse_train() {
        let sample_rate_hz = 48_000u32;
        let duration_seconds = 8usize;
        let mut mono = vec![0.0f32; sample_rate_hz as usize * duration_seconds];
        let pulse_spacing_samples = (sample_rate_hz as f64 * 0.5) as usize;
        let pulse_width = (sample_rate_hz as f64 * 0.02) as usize;

        for pulse_start in (0..mono.len()).step_by(pulse_spacing_samples) {
            for sample_index in pulse_start..(pulse_start + pulse_width).min(mono.len()) {
                mono[sample_index] = 1.0;
            }
        }

        let bpm = estimate_bpm(&mono, sample_rate_hz).expect("detect bpm");
        assert!((bpm - 120.0).abs() <= 3.0);
    }

    #[test]
    fn analyze_audio_samples_with_runtime_supports_cached_clip_samples() {
        let sample_rate_hz = 48_000u32;
        let duration_seconds = 2usize;
        let mono = vec![0.25f32; sample_rate_hz as usize * duration_seconds];

        let analysis = analyze_audio_samples_with_runtime(
            Path::new("/tmp/cached-preview.wav"),
            sample_rate_hz,
            1,
            &mono,
            "Native deck cache",
            None,
        )
        .expect("analysis from cached clip");

        assert!(analysis.duration_seconds >= 1.9);
        assert_eq!(analysis.sample_rate_hz, Some(sample_rate_hz));
        assert!(!analysis.waveform_buckets.is_empty());
        assert_eq!(analysis.encoding.as_deref(), Some("Native deck cache"));
    }

    fn ensure_audio_toolchain_available() -> Option<String> {
        let ffmpeg_binary = resolve_audio_ffmpeg_binary();
        let ffmpeg_ready = Command::new(&ffmpeg_binary)
            .arg("-version")
            .output()
            .map(|output| output.status.success())
            .unwrap_or(false);

        if ffmpeg_ready {
            Some(ffmpeg_binary)
        } else {
            eprintln!(
                "Skipping real audio toolchain test because ffmpeg ({ffmpeg_binary}) was unavailable."
            );
            None
        }
    }

    fn generate_test_audio_fixture(ffmpeg_binary: &str, output_path: &Path) {
        let extension = output_path
            .extension()
            .and_then(|value| value.to_str())
            .expect("fixture extension")
            .to_ascii_lowercase();

        let mut command = Command::new(ffmpeg_binary);
        command.args(["-hide_banner", "-loglevel", "error", "-y"]);
        command.args([
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=880:sample_rate=48000:duration=1.0",
            "-ac",
            "2",
        ]);

        match extension.as_str() {
            "wav" | "wave" => {
                command.args(["-c:a", "pcm_s16le"]);
            }
            "aif" | "aiff" | "aifc" => {
                command.args(["-c:a", "pcm_s16be", "-f", "aiff"]);
            }
            "aac" => {
                command.args(["-c:a", "aac", "-b:a", "128k", "-f", "adts"]);
            }
            "alac" => {
                command.args(["-c:a", "alac", "-f", "caf"]);
            }
            "caf" => {
                command.args(["-c:a", "pcm_s16be", "-f", "caf"]);
            }
            "flac" => {
                command.args(["-c:a", "flac"]);
            }
            "m4a" | "m4b" => {
                command.args(["-c:a", "aac", "-b:a", "128k", "-f", "mp4"]);
            }
            "mka" => {
                command.args(["-c:a", "libopus", "-f", "matroska"]);
            }
            "mp3" => {
                command.args(["-c:a", "libmp3lame", "-q:a", "2"]);
            }
            "oga" | "ogg" => {
                command.args(["-c:a", "libvorbis"]);
            }
            "opus" => {
                command.args(["-c:a", "libopus", "-f", "ogg"]);
            }
            "weba" => {
                command.args(["-c:a", "libopus", "-f", "webm"]);
            }
            "wma" => {
                command.args(["-c:a", "wmav2", "-f", "asf"]);
            }
            other => panic!("unsupported audio fixture extension: {other}"),
        }

        command.arg(output_path);
        let output = command.output().expect("launch ffmpeg for fixture");
        if !output.status.success() {
            panic!(
                "failed to generate audio fixture '{}': {}",
                output_path.display(),
                String::from_utf8_lossy(&output.stderr)
            );
        }
    }

    #[test]
    fn analyze_audio_file_native_supports_common_modern_formats() {
        let Some(ffmpeg_binary) = ensure_audio_toolchain_available() else {
            return;
        };

        let workspace = tempdir().expect("audio fixture tempdir");
        let fixture_names = [
            "modern.wav",
            "modern.AIF",
            "modern.AIFF",
            "modern.aifc",
            "modern.aac",
            "modern.alac",
            "modern.caf",
            "modern.flac",
            "modern.m4a",
            "modern.m4b",
            "modern.mka",
            "modern.mp3",
            "modern.oga",
            "modern.ogg",
            "modern.opus",
            "modern.weba",
            "modern.wma",
        ];

        for file_name in fixture_names {
            let fixture_path = workspace.path().join(file_name);
            generate_test_audio_fixture(&ffmpeg_binary, &fixture_path);

            let analysis = analyze_audio_file_native(&fixture_path).unwrap_or_else(|error| {
                panic!("expected analysis for {}: {error}", fixture_path.display())
            });

            assert!(
                analysis.duration_seconds > 0.5,
                "{}",
                fixture_path.display()
            );
            assert!(
                analysis.sample_rate_hz.is_some(),
                "{}",
                fixture_path.display()
            );
            assert!(analysis.channels.is_some(), "{}", fixture_path.display());
            assert!(
                !analysis.waveform_buckets.is_empty(),
                "{}",
                fixture_path.display()
            );
        }
    }
}

fn normalize_seek_seconds(value: f64) -> f64 {
    if value.is_finite() {
        value.max(0.0)
    } else {
        0.0
    }
}

fn clamp_loop_duration(start_seconds: f64, end_seconds: f64) -> Result<(f64, f64), String> {
    if !start_seconds.is_finite() || !end_seconds.is_finite() {
        return Err("Loop region values must be finite numbers.".to_string());
    }
    let start = start_seconds.max(0.0);
    let end = end_seconds.max(0.0);
    if end - start < MIN_LOOP_DURATION_SECONDS {
        return Err(format!(
            "Loop region must be at least {:.2} seconds long.",
            MIN_LOOP_DURATION_SECONDS
        ));
    }
    Ok((start, end))
}

fn update_deck_metadata<F>(deck: &AudioDeckRuntime, update: F) -> Result<(), String>
where
    F: FnOnce(&mut AudioDeckMetadata),
{
    let mut metadata = deck
        .metadata
        .lock()
        .map_err(|_| "Audio deck metadata lock was poisoned.".to_string())?;
    update(&mut metadata);
    Ok(())
}

fn apply_loaded_clip(
    shared: &Arc<AudioEngineSharedState>,
    deck_id: AudioDeckId,
    clip: AudioClip,
    generation: u64,
) -> Result<AudioEngineStateSnapshot, String> {
    let deck = shared.deck(deck_id);
    if deck.load_generation.load(Ordering::Relaxed) != generation {
        return Ok(shared.snapshot());
    }
    let clip_duration_seconds = if clip.sample_rate_hz == 0 {
        0.0
    } else {
        clip.frames as f64 / clip.sample_rate_hz as f64
    };
    let clip_frames = clip.frames as f64;
    deck.clip.store(Some(Arc::new(clip)));
    deck.is_loading.store(false, Ordering::Relaxed);
    deck.is_playing.store(false, Ordering::Relaxed);
    set_atomic_f64(&deck.position_frames, 0.0);
    deck.loop_enabled.store(false, Ordering::Relaxed);
    set_atomic_f64(&deck.loop_start_frames, 0.0);
    set_atomic_f64(&deck.loop_end_frames, clip_frames);
    set_atomic_f64(&deck.peak_meter_linear, 0.0);
    set_atomic_f64(&deck.rms_meter_linear, 0.0);
    update_deck_metadata(deck, |metadata| {
        metadata.loaded_path = deck
            .clip
            .load_full()
            .as_ref()
            .map(|loaded| loaded.path.clone());
        metadata.loaded_name = deck
            .clip
            .load_full()
            .as_ref()
            .map(|loaded| loaded.name.clone());
        metadata.duration_seconds = clip_duration_seconds;
        metadata.is_buffering = false;
        metadata.error = None;
    })?;
    Ok(shared.snapshot())
}

fn begin_deck_load(
    shared: &Arc<AudioEngineSharedState>,
    deck_id: AudioDeckId,
) -> Result<u64, String> {
    let deck = shared.deck(deck_id);
    let generation = deck.load_generation.fetch_add(1, Ordering::Relaxed) + 1;
    deck.is_loading.store(true, Ordering::Relaxed);
    deck.is_playing.store(false, Ordering::Relaxed);
    set_atomic_f64(&deck.position_frames, 0.0);
    set_atomic_f64(&deck.peak_meter_linear, 0.0);
    set_atomic_f64(&deck.rms_meter_linear, 0.0);
    update_deck_metadata(deck, |metadata| {
        metadata.is_buffering = true;
        metadata.error = None;
    })?;
    shared.emit_state();
    Ok(generation)
}

fn fail_deck_load(
    shared: &Arc<AudioEngineSharedState>,
    deck_id: AudioDeckId,
    generation: u64,
    error_message: String,
) -> Result<AudioEngineStateSnapshot, String> {
    let deck = shared.deck(deck_id);
    if deck.load_generation.load(Ordering::Relaxed) != generation {
        return Ok(shared.snapshot());
    }
    deck.clear_loaded_clip();
    deck.is_loading.store(false, Ordering::Relaxed);
    update_deck_metadata(deck, |metadata| {
        metadata.loaded_path = None;
        metadata.loaded_name = None;
        metadata.duration_seconds = 0.0;
        metadata.is_buffering = false;
        metadata.error = Some(error_message);
    })?;
    Ok(shared.snapshot())
}

fn unload_deck_internal(
    shared: &Arc<AudioEngineSharedState>,
    deck_id: AudioDeckId,
) -> Result<AudioEngineStateSnapshot, String> {
    let deck = shared.deck(deck_id);
    deck.load_generation.fetch_add(1, Ordering::Relaxed);
    deck.clear_loaded_clip();
    deck.is_loading.store(false, Ordering::Relaxed);
    update_deck_metadata(deck, |metadata| {
        *metadata = AudioDeckMetadata::default();
    })?;
    Ok(shared.snapshot())
}

#[tauri::command]
#[specta::specta]
pub fn audio_engine_prepare(app: AppHandle) -> Result<AudioEngineStateSnapshot, String> {
    let shared = ensure_audio_engine_shared(&app)?;
    let snapshot = shared.snapshot();
    shared.emit_state();
    Ok(snapshot)
}

#[tauri::command]
#[specta::specta]
pub fn audio_engine_get_state(app: AppHandle) -> Result<AudioEngineStateSnapshot, String> {
    Ok(existing_audio_engine_shared(&app)
        .map(|shared| shared.snapshot())
        .unwrap_or_else(default_audio_engine_state_snapshot))
}

#[tauri::command]
#[specta::specta]
pub async fn audio_engine_load_deck(
    app: AppHandle,
    request: AudioEngineLoadDeckRequest,
) -> Result<AudioEngineStateSnapshot, String> {
    let shared = ensure_audio_engine_shared(&app)?;
    let input_path = validate_audio_file_path(&request.input_path)?;
    let generation = begin_deck_load(&shared, request.deck_id)?;
    let shared_for_task = shared.clone();
    let sample_rate_hz = shared.device_sample_rate_hz;
    let deck_id = request.deck_id;
    let input_path_for_task = input_path.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        decode_audio_clip_for_device(&input_path_for_task, sample_rate_hz)
    })
    .await
    .map_err(|error| format!("Audio deck load task failed to join: {error}"))?;
    let snapshot = match result {
        Ok(clip) => apply_loaded_clip(&shared_for_task, deck_id, clip, generation)?,
        Err(error) => fail_deck_load(&shared_for_task, deck_id, generation, error)?,
    };
    shared_for_task.emit_state();
    Ok(snapshot)
}

#[tauri::command]
#[specta::specta]
pub async fn audio_engine_sync_selection_to_armed_deck(
    app: AppHandle,
    request: AudioEngineSyncSelectionRequest,
) -> Result<AudioEngineStateSnapshot, String> {
    let shared = ensure_audio_engine_shared(&app)?;
    audio_engine_load_deck(
        app,
        AudioEngineLoadDeckRequest {
            deck_id: shared.armed_deck(),
            input_path: request.input_path,
        },
    )
    .await
}

#[tauri::command]
#[specta::specta]
pub fn audio_engine_unload_deck(
    app: AppHandle,
    request: AudioEngineDeckRequest,
) -> Result<AudioEngineStateSnapshot, String> {
    let shared = ensure_audio_engine_shared(&app)?;
    let snapshot = unload_deck_internal(&shared, request.deck_id)?;
    shared.emit_state();
    Ok(snapshot)
}

#[tauri::command]
#[specta::specta]
pub fn audio_engine_set_armed_deck(
    app: AppHandle,
    request: AudioEngineSetArmedDeckRequest,
) -> Result<AudioEngineStateSnapshot, String> {
    let shared = ensure_audio_engine_shared(&app)?;
    shared
        .armed_deck
        .store(request.deck_id.as_index() as u8, Ordering::Relaxed);
    let snapshot = shared.snapshot();
    shared.emit_state();
    Ok(snapshot)
}

#[tauri::command]
#[specta::specta]
pub fn audio_engine_play(
    app: AppHandle,
    request: AudioEngineDeckRequest,
) -> Result<AudioEngineStateSnapshot, String> {
    let shared = ensure_audio_engine_shared(&app)?;
    let deck = shared.deck(request.deck_id);
    if deck.clip.load_full().is_none() {
        return Err("Load an audio file into this deck before starting playback.".to_string());
    }
    deck.is_playing.store(true, Ordering::Relaxed);
    let snapshot = shared.snapshot();
    shared.emit_state();
    Ok(snapshot)
}

#[tauri::command]
#[specta::specta]
pub fn audio_engine_pause(
    app: AppHandle,
    request: AudioEngineDeckRequest,
) -> Result<AudioEngineStateSnapshot, String> {
    let shared = ensure_audio_engine_shared(&app)?;
    shared
        .deck(request.deck_id)
        .is_playing
        .store(false, Ordering::Relaxed);
    let snapshot = shared.snapshot();
    shared.emit_state();
    Ok(snapshot)
}

#[tauri::command]
#[specta::specta]
pub fn audio_engine_stop(
    app: AppHandle,
    request: AudioEngineDeckRequest,
) -> Result<AudioEngineStateSnapshot, String> {
    let shared = ensure_audio_engine_shared(&app)?;
    let deck = shared.deck(request.deck_id);
    deck.is_playing.store(false, Ordering::Relaxed);
    let stop_position = if deck.loop_enabled.load(Ordering::Relaxed) {
        atomic_f64(&deck.loop_start_frames)
    } else {
        0.0
    };
    set_atomic_f64(&deck.position_frames, stop_position);
    let snapshot = shared.snapshot();
    shared.emit_state();
    Ok(snapshot)
}

#[tauri::command]
#[specta::specta]
pub fn audio_engine_seek(
    app: AppHandle,
    request: AudioEngineSeekRequest,
) -> Result<AudioEngineStateSnapshot, String> {
    let shared = ensure_audio_engine_shared(&app)?;
    let deck = shared.deck(request.deck_id);
    let clip = deck
        .clip
        .load_full()
        .ok_or_else(|| "Load an audio file before seeking.".to_string())?;
    let target_frames =
        normalize_seek_seconds(request.position_seconds) * shared.device_sample_rate_hz as f64;
    let bounded_frames = target_frames.clamp(0.0, clip.frames as f64);
    set_atomic_f64(&deck.position_frames, bounded_frames);
    let snapshot = shared.snapshot();
    shared.emit_state();
    Ok(snapshot)
}

#[tauri::command]
#[specta::specta]
pub fn audio_engine_set_loop_region(
    app: AppHandle,
    request: AudioEngineLoopRegionRequest,
) -> Result<AudioEngineStateSnapshot, String> {
    let shared = ensure_audio_engine_shared(&app)?;
    let deck = shared.deck(request.deck_id);
    let clip = deck
        .clip
        .load_full()
        .ok_or_else(|| "Load an audio file before setting a loop region.".to_string())?;
    let (start_seconds, end_seconds) =
        clamp_loop_duration(request.start_seconds, request.end_seconds)?;
    let start_frames =
        (start_seconds * shared.device_sample_rate_hz as f64).clamp(0.0, clip.frames as f64);
    let end_frames = (end_seconds * shared.device_sample_rate_hz as f64)
        .clamp(start_frames + 1.0, clip.frames as f64);
    set_atomic_f64(&deck.loop_start_frames, start_frames);
    set_atomic_f64(&deck.loop_end_frames, end_frames);
    deck.loop_enabled.store(request.enabled, Ordering::Relaxed);
    let current_position = atomic_f64(&deck.position_frames);
    if request.enabled && current_position >= end_frames {
        set_atomic_f64(&deck.position_frames, start_frames);
    }
    let snapshot = shared.snapshot();
    shared.emit_state();
    Ok(snapshot)
}

#[tauri::command]
#[specta::specta]
pub fn audio_engine_set_gain(
    app: AppHandle,
    request: AudioEngineGainRequest,
) -> Result<AudioEngineStateSnapshot, String> {
    let shared = ensure_audio_engine_shared(&app)?;
    set_atomic_f64(
        &shared.deck(request.deck_id).gain_linear,
        request.gain_linear.clamp(0.0, 4.0),
    );
    let snapshot = shared.snapshot();
    shared.emit_state();
    Ok(snapshot)
}

#[tauri::command]
#[specta::specta]
pub fn audio_engine_set_rate(
    app: AppHandle,
    request: AudioEngineRateRequest,
) -> Result<AudioEngineStateSnapshot, String> {
    let shared = ensure_audio_engine_shared(&app)?;
    set_atomic_f64(
        &shared.deck(request.deck_id).playback_rate,
        request.rate.clamp(0.25, 4.0),
    );
    let snapshot = shared.snapshot();
    shared.emit_state();
    Ok(snapshot)
}

// ── VST Plugin Loading ────────────────────────────────────────────────────────

#[tauri::command]
#[specta::specta]
pub fn audio_engine_load_plugin(
    app: AppHandle,
    request: AudioEngineLoadPluginRequest,
) -> Result<AudioEngineStateSnapshot, String> {
    let shared = ensure_audio_engine_shared(&app)?;
    let deck = shared.deck(request.deck_id);
    let plugin_load_result = build_vst_parameter_state_snapshot(&request.plugin_path);
    {
        let mut meta = deck
            .metadata
            .lock()
            .map_err(|e| format!("lock error: {e}"))?;
        match plugin_load_result {
            Ok(parameter_state) => {
                meta.active_plugin_path = Some(request.plugin_path.clone());
                meta.vst_parameters = parameter_state;
                meta.error = None;
            }
            Err(error) => {
                meta.active_plugin_path = None;
                meta.vst_parameters.clear();
                meta.error = Some(format!("VST load failed: {error}"));
            }
        }
    }
    let snapshot = shared.snapshot();
    shared.emit_state();
    Ok(snapshot)
}

#[tauri::command]
#[specta::specta]
pub fn audio_engine_clear_deck_plugin(
    app: AppHandle,
    request: AudioEngineDeckRequest,
) -> Result<AudioEngineStateSnapshot, String> {
    let shared = ensure_audio_engine_shared(&app)?;
    {
        let mut meta = shared
            .deck(request.deck_id)
            .metadata
            .lock()
            .map_err(|e| format!("lock error: {e}"))?;
        meta.active_plugin_path = None;
        meta.vst_parameters.clear();
        meta.error = None;
    }
    let snapshot = shared.snapshot();
    shared.emit_state();
    Ok(snapshot)
}

#[tauri::command]
#[specta::specta]
pub fn audio_engine_set_plugin_parameter(
    app: AppHandle,
    request: AudioEngineSetPluginParameterRequest,
) -> Result<AudioEngineStateSnapshot, String> {
    let shared = ensure_audio_engine_shared(&app)?;
    {
        let mut meta = shared
            .deck(request.deck_id)
            .metadata
            .lock()
            .map_err(|e| format!("lock error: {e}"))?;
        let parameter = meta
            .vst_parameters
            .iter_mut()
            .find(|parameter| parameter.id == request.parameter_id)
            .ok_or_else(|| "Unknown VST parameter.".to_string())?;
        parameter.value_normalized = request
            .value_normalized
            .clamp(parameter.min, parameter.max);
    }
    let snapshot = shared.snapshot();
    shared.emit_state();
    Ok(snapshot)
}
