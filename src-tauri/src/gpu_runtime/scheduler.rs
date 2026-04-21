use std::collections::HashMap;

use super::registry::GpuBuiltInWorkloadSpec;
use super::types::{
    GpuEffectiveTier, GpuFallbackReason, GpuRuntimeStatusSnapshot, GpuRuntimeWorkloadId,
    GpuRuntimeWorkloadStatus,
};

#[derive(Debug, Clone, Default)]
pub(crate) struct GpuWorkloadTelemetryState {
    pub executions: u64,
    pub fallback_count: u64,
    pub last_execution_path: Option<String>,
    pub last_fallback_reason: Option<GpuFallbackReason>,
    pub last_error: Option<String>,
}

pub(crate) fn default_workload_state_map(
) -> HashMap<GpuRuntimeWorkloadId, GpuWorkloadTelemetryState> {
    super::registry::built_in_workload_specs()
        .iter()
        .map(|spec| (spec.id, GpuWorkloadTelemetryState::default()))
        .collect()
}

pub(crate) fn resolve_workload_execution_tier(
    spec: &GpuBuiltInWorkloadSpec,
    effective_tier: GpuEffectiveTier,
) -> Option<GpuEffectiveTier> {
    if effective_tier == GpuEffectiveTier::Safe || !spec.supported_tiers.contains(&effective_tier) {
        return None;
    }

    (tier_rank(spec.execution_budget_tier) <= tier_rank(effective_tier))
        .then_some(spec.execution_budget_tier)
}

fn tier_rank(tier: GpuEffectiveTier) -> u8 {
    match tier {
        GpuEffectiveTier::Safe => 0,
        GpuEffectiveTier::Integrated => 1,
        GpuEffectiveTier::Discrete => 2,
    }
}

pub(crate) fn build_status_workloads(
    effective_tier: GpuEffectiveTier,
    resources_ready: bool,
    telemetry: &HashMap<GpuRuntimeWorkloadId, GpuWorkloadTelemetryState>,
) -> Vec<GpuRuntimeWorkloadStatus> {
    super::registry::built_in_workload_specs()
        .iter()
        .map(|spec| {
            let counters = telemetry.get(&spec.id).cloned().unwrap_or_default();
            GpuRuntimeWorkloadStatus {
                workload_id: spec.id,
                label: spec.label.to_string(),
                ready: resources_ready
                    && resolve_workload_execution_tier(spec, effective_tier).is_some(),
                supported_tiers: spec.supported_tiers.to_vec(),
                executions: counters.executions,
                fallback_count: counters.fallback_count,
                cache_policy: spec.cache_policy.to_string(),
                kernel_labels: spec
                    .kernel_labels
                    .iter()
                    .map(|value| (*value).to_string())
                    .collect(),
                last_execution_path: counters.last_execution_path,
                last_fallback_reason: counters.last_fallback_reason,
                last_error: counters.last_error,
            }
        })
        .collect()
}

pub(crate) fn apply_snapshot_workloads(
    snapshot: &mut GpuRuntimeStatusSnapshot,
    effective_tier: GpuEffectiveTier,
    resources_ready: bool,
    telemetry: &HashMap<GpuRuntimeWorkloadId, GpuWorkloadTelemetryState>,
) {
    snapshot.workloads = build_status_workloads(effective_tier, resources_ready, telemetry);
}

#[cfg(test)]
mod tests {
    use super::resolve_workload_execution_tier;
    use crate::gpu_runtime::registry::workload_spec;
    use crate::gpu_runtime::types::{GpuEffectiveTier, GpuRuntimeWorkloadId};

    #[test]
    fn discrete_effective_tier_can_trickle_into_integrated_workload_budget() {
        let spec = workload_spec(GpuRuntimeWorkloadId::ImageThumbnail);
        let resolved = resolve_workload_execution_tier(spec, GpuEffectiveTier::Discrete);
        assert_eq!(resolved, Some(GpuEffectiveTier::Integrated));
    }

    #[test]
    fn safe_tier_never_returns_gpu_execution_tier() {
        let spec = workload_spec(GpuRuntimeWorkloadId::ImageThumbnail);
        let resolved = resolve_workload_execution_tier(spec, GpuEffectiveTier::Safe);
        assert_eq!(resolved, None);
    }

    #[test]
    fn discrete_only_workload_stays_on_discrete_budget() {
        let spec = crate::gpu_runtime::registry::GpuBuiltInWorkloadSpec {
            id: GpuRuntimeWorkloadId::AudioSpectrogram,
            label: "Discrete Only",
            supported_tiers: &[GpuEffectiveTier::Discrete],
            execution_budget_tier: GpuEffectiveTier::Discrete,
            cache_policy: "ephemeral",
            kernel_labels: &["test"],
        };
        let resolved = resolve_workload_execution_tier(&spec, GpuEffectiveTier::Discrete);
        assert_eq!(resolved, Some(GpuEffectiveTier::Discrete));
    }
}
