use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};

use crate::gpu_runtime::{GpuEffectiveTier, GpuRuntimeManager, GpuRuntimeStatusSnapshot};
use crate::python_commands::PythonRuntimeConfig;
use crate::python_sidecar::{self, PythonSidecarStatus};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum AccelerationRoutingMode {
    Auto,
    PreferNative,
    PreferCuda,
    CpuOnly,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum AccelerationProviderKind {
    Cpu,
    Wgpu,
    CudaPython,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum AccelerationWorkloadId {
    Thumbnails,
    MediaPipelines,
    HighVolumePreviews,
    AiIndexing,
    LocalInference,
    SimilaritySearch,
    DirectStorage,
    FileHashing,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct AccelerationRuntimeRequest {
    pub config: Option<PythonRuntimeConfig>,
    pub routing_mode: AccelerationRoutingMode,
    pub start_sidecar_if_needed: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct AccelerationProviderStatus {
    pub provider_kind: AccelerationProviderKind,
    pub label: String,
    pub origin: String,
    pub available: bool,
    pub ready: bool,
    pub detail: String,
    pub supported_workload_ids: Vec<AccelerationWorkloadId>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PythonCudaDeviceInfo {
    pub index: u32,
    pub name: String,
    pub capability: Option<String>,
    pub total_memory_bytes: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PythonAccelerationTorchProbe {
    pub installed: bool,
    pub imported: Option<bool>,
    pub import_error: Option<String>,
    pub version: Option<String>,
    pub cuda_available: Option<bool>,
    pub cuda_version: Option<String>,
    pub cudnn_available: Option<bool>,
    pub device_count: Option<u32>,
    pub devices: Vec<PythonCudaDeviceInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PythonAccelerationOnnxRuntimeProbe {
    pub installed: bool,
    pub imported: Option<bool>,
    pub import_error: Option<String>,
    pub available_providers: Option<Vec<String>>,
    pub provider_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PythonAccelerationOptionalModuleProbe {
    pub id: String,
    pub installed: bool,
    pub imported: Option<bool>,
    pub import_error: Option<String>,
    pub version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PythonAccelerationProbe {
    pub python_version: String,
    pub platform: String,
    pub cuda_visible_devices: Option<String>,
    pub cuda_home: Option<String>,
    pub cuda_path: Option<String>,
    pub torch: PythonAccelerationTorchProbe,
    pub onnxruntime: PythonAccelerationOnnxRuntimeProbe,
    pub optional_modules: Vec<PythonAccelerationOptionalModuleProbe>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct AccelerationRuntimeStatusSnapshot {
    pub routing_mode: AccelerationRoutingMode,
    pub last_refreshed_at_epoch_ms: u64,
    pub native_gpu: GpuRuntimeStatusSnapshot,
    pub python_sidecar_running: bool,
    pub python_sidecar_action_available: bool,
    pub python_probe_attempted: bool,
    pub python_probe_error: Option<String>,
    pub python_probe: Option<PythonAccelerationProbe>,
    pub providers: Vec<AccelerationProviderStatus>,
}

#[tauri::command]
#[specta::specta]
pub async fn acceleration_runtime_get_status(
    app: AppHandle,
    gpu_runtime: State<'_, GpuRuntimeManager>,
    request: AccelerationRuntimeRequest,
) -> Result<AccelerationRuntimeStatusSnapshot, String> {
    let app_handle = app.clone();
    let runtime = gpu_runtime.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        build_runtime_status(&app_handle, &runtime, request)
    })
    .await
    .map_err(|error| format!("Acceleration runtime task failed to join: {error}"))?
}

fn build_runtime_status(
    app: &AppHandle,
    gpu_runtime: &GpuRuntimeManager,
    request: AccelerationRuntimeRequest,
) -> Result<AccelerationRuntimeStatusSnapshot, String> {
    let native_gpu = gpu_runtime.status_snapshot();
    let sidecar_status = python_sidecar::get_sidecar_status(app, request.config.clone()).ok();
    let python_sidecar_running = sidecar_status
        .as_ref()
        .map(|status| status.running)
        .unwrap_or(false);
    let python_sidecar_action_available = sidecar_status
        .as_ref()
        .map(has_acceleration_probe_action)
        .unwrap_or(false);
    let should_attempt_python_probe = python_sidecar_action_available
        && (python_sidecar_running || request.start_sidecar_if_needed.unwrap_or(false));

    let (python_probe, python_probe_error) = if should_attempt_python_probe {
        match python_sidecar::call_sidecar_action_json::<serde_json::Value, PythonAccelerationProbe>(
            app,
            request.config.clone(),
            python_sidecar::action_ids::ACCELERATION_CUDA_PROBE,
            None,
            None,
            None,
            request.start_sidecar_if_needed,
        ) {
            Ok(response) => (Some(response.result), None),
            Err(error) => (None, Some(error)),
        }
    } else {
        (None, None)
    };

    Ok(AccelerationRuntimeStatusSnapshot {
        routing_mode: request.routing_mode,
        last_refreshed_at_epoch_ms: now_epoch_ms(),
        native_gpu: native_gpu.clone(),
        python_sidecar_running,
        python_sidecar_action_available,
        python_probe_attempted: should_attempt_python_probe,
        python_probe_error: python_probe_error.clone(),
        python_probe: python_probe.clone(),
        providers: build_provider_statuses(
            &native_gpu,
            python_sidecar_action_available,
            python_sidecar_running,
            python_probe.as_ref(),
            python_probe_error.as_deref(),
        ),
    })
}

fn has_acceleration_probe_action(status: &PythonSidecarStatus) -> bool {
    status
        .action_ids
        .iter()
        .any(|action_id| action_id == python_sidecar::action_ids::ACCELERATION_CUDA_PROBE)
}

fn build_provider_statuses(
    native_gpu: &GpuRuntimeStatusSnapshot,
    python_sidecar_action_available: bool,
    python_sidecar_running: bool,
    python_probe: Option<&PythonAccelerationProbe>,
    python_probe_error: Option<&str>,
) -> Vec<AccelerationProviderStatus> {
    let native_available = native_gpu.compute_available && !native_gpu.software_renderer;
    let native_ready = native_available
        && native_gpu.effective_tier != GpuEffectiveTier::Safe
        && native_gpu.runtime_error.is_none();
    let native_adapter_label = native_gpu
        .adapter_name
        .clone()
        .unwrap_or_else(|| "adapter unavailable".to_string());
    let native_detail = if native_ready {
        format!(
            "{native_adapter_label} is ready for thumbnail, preview, and media-adjacent native compute work."
        )
    } else if let Some(error) = native_gpu.runtime_error.as_deref() {
        format!("Native wgpu runtime is present but not ready: {error}")
    } else if native_gpu.effective_tier == GpuEffectiveTier::Safe {
        "Native wgpu runtime is in safe mode and will stay on CPU fallback.".to_string()
    } else {
        "No hardware compute-capable native GPU adapter was detected for the wgpu lane.".to_string()
    };

    let python_cuda_ready = python_probe.is_some_and(is_python_cuda_ready);
    let python_support_ids = if python_sidecar_action_available {
        vec![
            AccelerationWorkloadId::MediaPipelines,
            AccelerationWorkloadId::AiIndexing,
            AccelerationWorkloadId::LocalInference,
            AccelerationWorkloadId::SimilaritySearch,
            AccelerationWorkloadId::FileHashing,
        ]
    } else {
        Vec::new()
    };
    let python_detail = if python_cuda_ready {
        describe_python_cuda_ready(python_probe)
    } else if let Some(error) = python_probe_error {
        format!("Python CUDA probe failed: {error}")
    } else if !python_sidecar_action_available {
        "The Python sidecar manifest does not expose the CUDA/AI acceleration probe action."
            .to_string()
    } else if !python_sidecar_running {
        "Python sidecar is configured but currently not running; start or probe it to populate CUDA/AI readiness."
            .to_string()
    } else {
        describe_python_cuda_not_ready(python_probe)
    };

    vec![
        AccelerationProviderStatus {
            provider_kind: AccelerationProviderKind::Cpu,
            label: "CPU Fallback".to_string(),
            origin: "native".to_string(),
            available: true,
            ready: true,
            detail:
                "Always-available fallback for file operations, indexing, inference, and media jobs when no accelerator is ready."
                    .to_string(),
            supported_workload_ids: all_workload_ids(),
        },
        AccelerationProviderStatus {
            provider_kind: AccelerationProviderKind::Wgpu,
            label: "Native WGPU".to_string(),
            origin: "native".to_string(),
            available: native_available,
            ready: native_ready,
            detail: native_detail,
            supported_workload_ids: if native_available {
                vec![
                    AccelerationWorkloadId::Thumbnails,
                    AccelerationWorkloadId::HighVolumePreviews,
                    AccelerationWorkloadId::MediaPipelines,
                ]
            } else {
                Vec::new()
            },
        },
        AccelerationProviderStatus {
            provider_kind: AccelerationProviderKind::CudaPython,
            label: "CUDA Python Sidecar".to_string(),
            origin: "python-sidecar".to_string(),
            available: python_sidecar_action_available,
            ready: python_cuda_ready,
            detail: python_detail,
            supported_workload_ids: python_support_ids,
        },
    ]
}

fn is_python_cuda_ready(probe: &PythonAccelerationProbe) -> bool {
    let torch_ready =
        probe.torch.cuda_available.unwrap_or(false) && !probe.torch.devices.is_empty();
    let onnx_ready = probe
        .onnxruntime
        .available_providers
        .as_ref()
        .is_some_and(|providers| {
            providers.iter().any(|provider| {
                provider.eq_ignore_ascii_case("CUDAExecutionProvider")
                    || provider.eq_ignore_ascii_case("TensorrtExecutionProvider")
            })
        });
    torch_ready || onnx_ready
}

fn describe_python_cuda_ready(probe: Option<&PythonAccelerationProbe>) -> String {
    let Some(probe) = probe else {
        return "Python sidecar CUDA lane is ready.".to_string();
    };

    let device_label = if probe.torch.devices.is_empty() {
        "device list unavailable".to_string()
    } else {
        probe
            .torch
            .devices
            .iter()
            .map(|device| device.name.clone())
            .collect::<Vec<_>>()
            .join(", ")
    };
    let onnx_label = probe
        .onnxruntime
        .available_providers
        .as_ref()
        .map(|providers| providers.join(", "))
        .filter(|providers| !providers.is_empty())
        .unwrap_or_else(|| "no GPU execution providers".to_string());

    format!(
        "Python CUDA lane is ready. Torch devices: {device_label}. ONNX Runtime providers: {onnx_label}."
    )
}

fn describe_python_cuda_not_ready(probe: Option<&PythonAccelerationProbe>) -> String {
    let Some(probe) = probe else {
        return "Python CUDA lane has not been probed yet.".to_string();
    };

    if !probe.torch.installed && !probe.onnxruntime.installed {
        return "Neither Torch nor ONNX Runtime is installed in the managed Python runtime."
            .to_string();
    }

    if probe.torch.installed && !probe.torch.imported.unwrap_or(false) {
        return format!(
            "Torch is installed but failed to import{}.",
            probe
                .torch
                .import_error
                .as_deref()
                .map(|error| format!(": {error}"))
                .unwrap_or_default()
        );
    }

    if probe.onnxruntime.installed && !probe.onnxruntime.imported.unwrap_or(false) {
        return format!(
            "ONNX Runtime is installed but failed to import{}.",
            probe
                .onnxruntime
                .import_error
                .as_deref()
                .map(|error| format!(": {error}"))
                .unwrap_or_default()
        );
    }

    "Managed Python is available, but no CUDA-capable Torch device or GPU ONNX execution provider was detected."
        .to_string()
}

fn all_workload_ids() -> Vec<AccelerationWorkloadId> {
    vec![
        AccelerationWorkloadId::Thumbnails,
        AccelerationWorkloadId::MediaPipelines,
        AccelerationWorkloadId::HighVolumePreviews,
        AccelerationWorkloadId::AiIndexing,
        AccelerationWorkloadId::LocalInference,
        AccelerationWorkloadId::SimilaritySearch,
        AccelerationWorkloadId::DirectStorage,
        AccelerationWorkloadId::FileHashing,
    ]
}

fn now_epoch_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::{
        build_provider_statuses, AccelerationProviderKind, AccelerationWorkloadId,
        PythonAccelerationOnnxRuntimeProbe, PythonAccelerationOptionalModuleProbe,
        PythonAccelerationProbe, PythonAccelerationTorchProbe, PythonCudaDeviceInfo,
    };
    use crate::gpu_runtime::GpuRuntimeStatusSnapshot;

    fn native_snapshot() -> GpuRuntimeStatusSnapshot {
        GpuRuntimeStatusSnapshot {
            configured_mode: crate::gpu_runtime::GpuTierMode::Auto,
            effective_tier: crate::gpu_runtime::GpuEffectiveTier::Discrete,
            adapter_name: Some("RTX".to_string()),
            adapter_type: Some("discrete-gpu".to_string()),
            backend_name: Some("Vulkan".to_string()),
            software_renderer: false,
            compute_available: true,
            queue_depth: 0,
            runtime_error: None,
            workloads: Vec::new(),
        }
    }

    fn python_probe() -> PythonAccelerationProbe {
        PythonAccelerationProbe {
            python_version: "3.11.9".to_string(),
            platform: "Linux".to_string(),
            cuda_visible_devices: Some("0".to_string()),
            cuda_home: None,
            cuda_path: None,
            torch: PythonAccelerationTorchProbe {
                installed: true,
                imported: Some(true),
                import_error: None,
                version: Some("2.8.0".to_string()),
                cuda_available: Some(true),
                cuda_version: Some("12.8".to_string()),
                cudnn_available: Some(true),
                device_count: Some(1),
                devices: vec![PythonCudaDeviceInfo {
                    index: 0,
                    name: "NVIDIA RTX".to_string(),
                    capability: Some("8.9".to_string()),
                    total_memory_bytes: Some(8 * 1024 * 1024 * 1024),
                }],
            },
            onnxruntime: PythonAccelerationOnnxRuntimeProbe {
                installed: true,
                imported: Some(true),
                import_error: None,
                available_providers: Some(vec!["CUDAExecutionProvider".to_string()]),
                provider_error: None,
            },
            optional_modules: vec![PythonAccelerationOptionalModuleProbe {
                id: "sentence_transformers".to_string(),
                installed: true,
                imported: Some(true),
                import_error: None,
                version: Some("3.0.0".to_string()),
            }],
        }
    }

    #[test]
    fn provider_statuses_mark_python_cuda_ready_when_probe_reports_cuda() {
        let providers =
            build_provider_statuses(&native_snapshot(), true, true, Some(&python_probe()), None);

        let cuda_provider = providers
            .into_iter()
            .find(|provider| provider.provider_kind == AccelerationProviderKind::CudaPython)
            .expect("cuda provider");
        assert!(cuda_provider.ready);
        assert!(cuda_provider
            .supported_workload_ids
            .contains(&AccelerationWorkloadId::AiIndexing));
    }
}
