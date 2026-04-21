use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum GpuTierMode {
    Auto,
    Safe,
    Integrated,
    Discrete,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum GpuEffectiveTier {
    Safe,
    Integrated,
    Discrete,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum GpuFallbackReason {
    SafeTierForcedCpu,
    AdapterUnavailable,
    SoftwareRendererBlocked,
    ComputeUnsupported,
    RuntimeUnavailable,
    UnsupportedTier,
    WorkloadBudgetExceeded,
    ExecutionFailed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum GpuRuntimeWorkloadId {
    ImageThumbnail,
    ImagePreview,
    AudioThumbnail,
    AudioWaveform,
    AudioSpectralBands,
    AudioSpectrogram,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct GpuRuntimeConfiguration {
    pub tier_override: GpuTierMode,
}

impl Default for GpuRuntimeConfiguration {
    fn default() -> Self {
        Self {
            tier_override: GpuTierMode::Auto,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct GpuRuntimeWorkloadStatus {
    pub workload_id: GpuRuntimeWorkloadId,
    pub label: String,
    pub ready: bool,
    pub supported_tiers: Vec<GpuEffectiveTier>,
    pub executions: u64,
    pub fallback_count: u64,
    pub cache_policy: String,
    pub kernel_labels: Vec<String>,
    pub last_execution_path: Option<String>,
    pub last_fallback_reason: Option<GpuFallbackReason>,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct GpuRuntimeStatusSnapshot {
    pub configured_mode: GpuTierMode,
    pub effective_tier: GpuEffectiveTier,
    pub adapter_name: Option<String>,
    pub adapter_type: Option<String>,
    pub backend_name: Option<String>,
    pub software_renderer: bool,
    pub compute_available: bool,
    pub queue_depth: u32,
    pub runtime_error: Option<String>,
    pub workloads: Vec<GpuRuntimeWorkloadStatus>,
}

impl Default for GpuRuntimeStatusSnapshot {
    fn default() -> Self {
        Self {
            configured_mode: GpuTierMode::Auto,
            effective_tier: GpuEffectiveTier::Safe,
            adapter_name: None,
            adapter_type: None,
            backend_name: None,
            software_renderer: false,
            compute_available: false,
            queue_depth: 0,
            runtime_error: None,
            workloads: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type, tauri_specta::Event)]
#[serde(rename_all = "camelCase")]
pub struct GpuRuntimeStatusEvent {
    pub state: GpuRuntimeStatusSnapshot,
}

#[derive(Debug, Clone)]
pub(crate) enum KernelSource {
    Wgsl(&'static str),
    #[allow(dead_code)]
    Spirv(&'static [u32]),
}
