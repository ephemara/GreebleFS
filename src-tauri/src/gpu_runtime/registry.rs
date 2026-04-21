use super::types::{GpuEffectiveTier, GpuRuntimeWorkloadId};

#[derive(Debug, Clone)]
pub(crate) struct GpuBuiltInWorkloadSpec {
    pub id: GpuRuntimeWorkloadId,
    pub label: &'static str,
    pub supported_tiers: &'static [GpuEffectiveTier],
    pub execution_budget_tier: GpuEffectiveTier,
    pub cache_policy: &'static str,
    pub kernel_labels: &'static [&'static str],
}

const GPU_ENABLED_TIERS: &[GpuEffectiveTier] =
    &[GpuEffectiveTier::Integrated, GpuEffectiveTier::Discrete];

const BUILT_IN_WORKLOADS: &[GpuBuiltInWorkloadSpec] = &[
    GpuBuiltInWorkloadSpec {
        id: GpuRuntimeWorkloadId::ImageThumbnail,
        label: "Image Thumbnail",
        supported_tiers: GPU_ENABLED_TIERS,
        execution_budget_tier: GpuEffectiveTier::Integrated,
        cache_policy: "ephemeral-readback",
        kernel_labels: &["thumbnail_resize"],
    },
    GpuBuiltInWorkloadSpec {
        id: GpuRuntimeWorkloadId::ImagePreview,
        label: "Image Preview",
        supported_tiers: GPU_ENABLED_TIERS,
        execution_budget_tier: GpuEffectiveTier::Integrated,
        cache_policy: "ephemeral-readback",
        kernel_labels: &["image_preview_filter"],
    },
    GpuBuiltInWorkloadSpec {
        id: GpuRuntimeWorkloadId::AudioThumbnail,
        label: "Audio Thumbnail",
        supported_tiers: GPU_ENABLED_TIERS,
        execution_budget_tier: GpuEffectiveTier::Integrated,
        cache_policy: "static-thumbnail-cache",
        kernel_labels: &["audio_spectrogram_render"],
    },
    GpuBuiltInWorkloadSpec {
        id: GpuRuntimeWorkloadId::AudioWaveform,
        label: "Audio Waveform",
        supported_tiers: GPU_ENABLED_TIERS,
        execution_budget_tier: GpuEffectiveTier::Integrated,
        cache_policy: "ephemeral-analysis",
        kernel_labels: &["audio_waveform_reduce"],
    },
    GpuBuiltInWorkloadSpec {
        id: GpuRuntimeWorkloadId::AudioSpectralBands,
        label: "Audio Spectral Bands",
        supported_tiers: GPU_ENABLED_TIERS,
        execution_budget_tier: GpuEffectiveTier::Integrated,
        cache_policy: "ephemeral-analysis",
        kernel_labels: &["audio_spectral_bands"],
    },
    GpuBuiltInWorkloadSpec {
        id: GpuRuntimeWorkloadId::AudioSpectrogram,
        label: "Audio Spectrogram",
        supported_tiers: GPU_ENABLED_TIERS,
        execution_budget_tier: GpuEffectiveTier::Integrated,
        cache_policy: "ephemeral-raster",
        kernel_labels: &["audio_spectrogram_render"],
    },
];

pub(crate) fn built_in_workload_specs() -> &'static [GpuBuiltInWorkloadSpec] {
    BUILT_IN_WORKLOADS
}

pub(crate) fn workload_spec(id: GpuRuntimeWorkloadId) -> &'static GpuBuiltInWorkloadSpec {
    BUILT_IN_WORKLOADS
        .iter()
        .find(|spec| spec.id == id)
        .expect("gpu runtime workload spec missing")
}
