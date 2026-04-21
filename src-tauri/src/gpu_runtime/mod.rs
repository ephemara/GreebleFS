mod capabilities;
mod registry;
mod resources;
mod scheduler;
pub mod workloads;

pub mod types;

use std::collections::HashMap;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::OnceLock;
use std::sync::{Arc, Mutex, RwLock};

use image::RgbaImage;
use tauri::State;
use tauri_specta::Event;

use crate::audio_commands::AudioWaveformBucket;
use crate::image_commands::ImageAdjustmentState;

use self::capabilities::{
    power_preference_for_mode, request_adapter_probe, resolve_effective_tier, GpuCapabilityProfile,
};
use self::registry::workload_spec;
use self::resources::GpuRuntimeResources;
use self::scheduler::{
    apply_snapshot_workloads, default_workload_state_map, resolve_workload_execution_tier,
    GpuWorkloadTelemetryState,
};
pub use self::types::{
    GpuEffectiveTier, GpuFallbackReason, GpuRuntimeConfiguration, GpuRuntimeStatusEvent,
    GpuRuntimeStatusSnapshot, GpuRuntimeWorkloadId, GpuRuntimeWorkloadStatus, GpuTierMode,
};

static GLOBAL_GPU_RUNTIME: OnceLock<GpuRuntimeManager> = OnceLock::new();

#[derive(Clone)]
pub struct GpuRuntimeManager {
    inner: Arc<GpuRuntimeManagerInner>,
}

struct GpuRuntimeManagerInner {
    app_handle: Mutex<Option<tauri::AppHandle>>,
    configuration: RwLock<GpuRuntimeConfiguration>,
    effective_tier: RwLock<GpuEffectiveTier>,
    capabilities: RwLock<Option<GpuCapabilityProfile>>,
    resources: Mutex<Option<Arc<GpuRuntimeResources>>>,
    workload_telemetry: Mutex<HashMap<GpuRuntimeWorkloadId, GpuWorkloadTelemetryState>>,
    queue_depth: AtomicU32,
    runtime_error: RwLock<Option<String>>,
}

impl Default for GpuRuntimeManager {
    fn default() -> Self {
        Self {
            inner: Arc::new(GpuRuntimeManagerInner {
                app_handle: Mutex::new(None),
                configuration: RwLock::new(GpuRuntimeConfiguration::default()),
                effective_tier: RwLock::new(GpuEffectiveTier::Safe),
                capabilities: RwLock::new(None),
                resources: Mutex::new(None),
                workload_telemetry: Mutex::new(default_workload_state_map()),
                queue_depth: AtomicU32::new(0),
                runtime_error: RwLock::new(None),
            }),
        }
    }
}

impl GpuRuntimeManager {
    pub fn new(app_handle: tauri::AppHandle) -> Self {
        let runtime = Self::default();
        runtime.attach_app_handle(app_handle);
        runtime
    }

    pub fn attach_app_handle(&self, app_handle: tauri::AppHandle) {
        *self
            .inner
            .app_handle
            .lock()
            .expect("gpu runtime app handle poisoned") = Some(app_handle);
    }

    pub fn status_snapshot(&self) -> GpuRuntimeStatusSnapshot {
        let configured_mode = self
            .inner
            .configuration
            .read()
            .expect("gpu runtime configuration poisoned")
            .tier_override;
        let effective_tier = *self
            .inner
            .effective_tier
            .read()
            .expect("gpu runtime effective tier poisoned");
        let capabilities = self
            .inner
            .capabilities
            .read()
            .expect("gpu runtime capabilities poisoned")
            .clone();
        let runtime_error = self
            .inner
            .runtime_error
            .read()
            .expect("gpu runtime error state poisoned")
            .clone();
        let workload_telemetry = self
            .inner
            .workload_telemetry
            .lock()
            .expect("gpu runtime workload telemetry poisoned")
            .clone();
        let resources_ready = self
            .inner
            .resources
            .lock()
            .expect("gpu runtime resources poisoned")
            .is_some();
        let mut snapshot = GpuRuntimeStatusSnapshot {
            configured_mode,
            effective_tier,
            adapter_name: capabilities
                .as_ref()
                .map(|value| value.adapter_name.clone()),
            adapter_type: capabilities
                .as_ref()
                .map(|value| value.adapter_type.clone()),
            backend_name: capabilities
                .as_ref()
                .map(|value| value.backend_name.clone()),
            software_renderer: capabilities
                .as_ref()
                .map(|value| value.software_renderer)
                .unwrap_or(false),
            compute_available: capabilities
                .as_ref()
                .map(|value| value.compute_available)
                .unwrap_or(false),
            queue_depth: self.inner.queue_depth.load(Ordering::Relaxed),
            runtime_error,
            workloads: Vec::new(),
        };
        apply_snapshot_workloads(
            &mut snapshot,
            effective_tier,
            resources_ready,
            &workload_telemetry,
        );
        snapshot
    }

    pub fn configure(
        &self,
        configuration: GpuRuntimeConfiguration,
    ) -> Result<GpuRuntimeStatusSnapshot, String> {
        *self
            .inner
            .configuration
            .write()
            .expect("gpu runtime configuration poisoned") = configuration.clone();

        let adapter_probe =
            request_adapter_probe(power_preference_for_mode(configuration.tier_override))?;
        let capability_profile = adapter_probe.as_ref().map(|probe| probe.profile.clone());
        let effective_tier =
            resolve_effective_tier(configuration.tier_override, capability_profile.as_ref());
        *self
            .inner
            .capabilities
            .write()
            .expect("gpu runtime capabilities poisoned") = capability_profile.clone();
        *self
            .inner
            .effective_tier
            .write()
            .expect("gpu runtime effective tier poisoned") = effective_tier;

        let runtime_error = if effective_tier == GpuEffectiveTier::Safe {
            None
        } else {
            if capability_profile
                .as_ref()
                .is_some_and(|profile| profile.software_renderer)
            {
                Some("Software GPU adapters are blocked for the native GPU runtime.".to_string())
            } else if capability_profile
                .as_ref()
                .is_some_and(|profile| !profile.compute_available)
            {
                Some("The detected GPU adapter does not expose compute-capable limits.".to_string())
            } else if let Some(adapter_probe) = adapter_probe {
                match GpuRuntimeResources::from_probe(adapter_probe, effective_tier) {
                    Ok(resources) => {
                        *self
                            .inner
                            .resources
                            .lock()
                            .expect("gpu runtime resources poisoned") = Some(Arc::new(resources));
                        None
                    }
                    Err(error) => Some(error),
                }
            } else {
                Some("No hardware GPU adapter was available.".to_string())
            }
        };

        if effective_tier == GpuEffectiveTier::Safe {
            *self
                .inner
                .resources
                .lock()
                .expect("gpu runtime resources poisoned") = None;
        }

        if runtime_error.is_some() {
            *self
                .inner
                .resources
                .lock()
                .expect("gpu runtime resources poisoned") = None;
        }
        *self
            .inner
            .runtime_error
            .write()
            .expect("gpu runtime error state poisoned") = runtime_error;

        self.emit_status();
        Ok(self.status_snapshot())
    }

    pub fn render_image_thumbnail(
        &self,
        source: &RgbaImage,
        target_width: u32,
        target_height: u32,
    ) -> Result<RgbaImage, String> {
        self.execute_workload(GpuRuntimeWorkloadId::ImageThumbnail, |resources, tier| {
            workloads::thumbnail::render_image_thumbnail(
                resources,
                source,
                target_width,
                target_height,
                tier,
            )
        })
    }

    pub fn render_image_preview(
        &self,
        source: &RgbaImage,
        target_width: u32,
        target_height: u32,
        effective_state: ImageAdjustmentState,
    ) -> Result<RgbaImage, String> {
        self.execute_workload(GpuRuntimeWorkloadId::ImagePreview, |resources, tier| {
            workloads::image_preview::render_image_preview(
                resources,
                source,
                target_width,
                target_height,
                effective_state,
                tier,
            )
        })
    }

    pub fn reduce_audio_waveform(
        &self,
        mono_samples: &[f32],
        bucket_count: usize,
    ) -> Result<Vec<AudioWaveformBucket>, String> {
        self.execute_workload(GpuRuntimeWorkloadId::AudioWaveform, |resources, tier| {
            workloads::audio_visuals::reduce_waveform_buckets(
                resources,
                mono_samples,
                bucket_count,
                tier,
            )
        })
    }

    pub fn reduce_audio_spectral_bands(
        &self,
        fft_samples: &[f32],
        band_count: usize,
    ) -> Result<Vec<f64>, String> {
        self.execute_workload(
            GpuRuntimeWorkloadId::AudioSpectralBands,
            |resources, tier| {
                workloads::audio_visuals::reduce_spectral_bands(
                    resources,
                    fft_samples,
                    band_count,
                    tier,
                )
            },
        )
    }

    pub fn render_audio_spectrogram(
        &self,
        mono_samples: &[f32],
        width: u32,
        height: u32,
    ) -> Result<RgbaImage, String> {
        self.execute_workload(GpuRuntimeWorkloadId::AudioSpectrogram, |resources, tier| {
            workloads::audio_visuals::render_spectrogram(
                resources,
                mono_samples,
                width,
                height,
                tier,
            )
        })
    }

    pub fn render_audio_thumbnail(
        &self,
        mono_samples: &[f32],
        width: u32,
        height: u32,
    ) -> Result<RgbaImage, String> {
        self.execute_workload(GpuRuntimeWorkloadId::AudioThumbnail, |resources, tier| {
            workloads::audio_visuals::render_spectrogram(
                resources,
                mono_samples,
                width,
                height,
                tier,
            )
        })
    }

    fn execute_workload<T, F>(
        &self,
        workload_id: GpuRuntimeWorkloadId,
        workload: F,
    ) -> Result<T, String>
    where
        F: FnOnce(&GpuRuntimeResources, GpuEffectiveTier) -> Result<T, String>,
    {
        let effective_tier = *self
            .inner
            .effective_tier
            .read()
            .expect("gpu runtime effective tier poisoned");
        if effective_tier == GpuEffectiveTier::Safe {
            self.record_fallback(
                workload_id,
                GpuFallbackReason::SafeTierForcedCpu,
                None,
                Some("safe mode".to_string()),
            );
            return Err("The native GPU runtime is currently running in safe mode.".to_string());
        }

        let Some(resources) = self
            .inner
            .resources
            .lock()
            .expect("gpu runtime resources poisoned")
            .clone()
        else {
            self.record_fallback(
                workload_id,
                GpuFallbackReason::RuntimeUnavailable,
                None,
                Some("resources unavailable".to_string()),
            );
            return Err("The native GPU runtime is not initialized.".to_string());
        };

        let spec = workload_spec(workload_id);
        let Some(execution_tier) = resolve_workload_execution_tier(spec, effective_tier) else {
            self.record_fallback(
                workload_id,
                GpuFallbackReason::UnsupportedTier,
                None,
                Some("tier unsupported".to_string()),
            );
            return Err("The current GPU tier does not support this workload.".to_string());
        };

        self.inner.queue_depth.fetch_add(1, Ordering::SeqCst);
        self.emit_status();
        let result = workload(&resources, execution_tier);
        self.inner.queue_depth.fetch_sub(1, Ordering::SeqCst);
        match result {
            Ok(value) => {
                self.record_execution(workload_id, execution_tier);
                self.emit_status();
                Ok(value)
            }
            Err(error) => {
                let fallback_reason = if error.contains("tier budget") {
                    GpuFallbackReason::WorkloadBudgetExceeded
                } else {
                    GpuFallbackReason::ExecutionFailed
                };
                self.record_fallback(
                    workload_id,
                    fallback_reason,
                    Some(error.clone()),
                    Some(format!("cpu-fallback({error})")),
                );
                self.emit_status();
                Err(error)
            }
        }
    }

    fn record_execution(
        &self,
        workload_id: GpuRuntimeWorkloadId,
        execution_tier: GpuEffectiveTier,
    ) {
        let mut telemetry = self
            .inner
            .workload_telemetry
            .lock()
            .expect("gpu runtime workload telemetry poisoned");
        let state = telemetry.entry(workload_id).or_default();
        state.executions += 1;
        state.last_execution_path = Some(match execution_tier {
            GpuEffectiveTier::Integrated => "gpu-integrated".to_string(),
            GpuEffectiveTier::Discrete => "gpu-discrete".to_string(),
            GpuEffectiveTier::Safe => "cpu-fallback".to_string(),
        });
        state.last_error = None;
        state.last_fallback_reason = None;
    }

    fn record_fallback(
        &self,
        workload_id: GpuRuntimeWorkloadId,
        reason: GpuFallbackReason,
        error: Option<String>,
        execution_path: Option<String>,
    ) {
        let mut telemetry = self
            .inner
            .workload_telemetry
            .lock()
            .expect("gpu runtime workload telemetry poisoned");
        let state = telemetry.entry(workload_id).or_default();
        state.fallback_count += 1;
        state.last_execution_path = execution_path.or_else(|| Some("cpu-fallback".to_string()));
        state.last_fallback_reason = Some(reason);
        state.last_error = error;
    }

    fn emit_status(&self) {
        if let Some(app_handle) = self
            .inner
            .app_handle
            .lock()
            .expect("gpu runtime app handle poisoned")
            .clone()
        {
            let _ = GpuRuntimeStatusEvent {
                state: self.status_snapshot(),
            }
            .emit(&app_handle);
        }
    }
}

pub fn set_global_gpu_runtime(manager: GpuRuntimeManager) {
    let _ = GLOBAL_GPU_RUNTIME.set(manager);
}

pub fn global_gpu_runtime() -> Option<&'static GpuRuntimeManager> {
    GLOBAL_GPU_RUNTIME.get()
}

#[tauri::command]
#[specta::specta]
pub fn gpu_runtime_configure(
    manager: State<'_, GpuRuntimeManager>,
    configuration: GpuRuntimeConfiguration,
) -> Result<GpuRuntimeStatusSnapshot, String> {
    manager.configure(configuration)
}

#[tauri::command]
#[specta::specta]
pub fn gpu_runtime_get_status(
    manager: State<'_, GpuRuntimeManager>,
) -> Result<GpuRuntimeStatusSnapshot, String> {
    Ok(manager.status_snapshot())
}
