use crate::Result;
use bytemuck::cast_slice;
use k_os_eval::mesh_pipeline::ViewportBufferPayload;
use wgpu::{Buffer, BufferUsages};

/// CPU-side upload packet produced by the evaluator -> GPU bridge boundary.
#[derive(Debug, Clone)]
pub struct GpuMeshUploadPlan {
    pub positions_bytes: Vec<u8>,
    pub normals_bytes: Vec<u8>,
    pub indices_bytes: Vec<u8>,
    pub vertex_count: usize,
    pub index_count: usize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct GpuMeshUploadSummary {
    pub position_bytes: usize,
    pub normal_bytes: usize,
    pub index_bytes: usize,
    pub vertex_count: usize,
    pub index_count: usize,
}

pub struct GpuMeshBufferHandles {
    pub positions: Buffer,
    pub normals: Buffer,
    pub indices: Buffer,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct GpuMeshBufferSizing {
    pub position_bytes: u64,
    pub normal_bytes: u64,
    pub index_bytes: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct GpuMeshBufferGrowthPolicy {
    pub growth_factor_numerator: u64,
    pub growth_factor_denominator: u64,
    pub min_headroom_bytes: u64,
}

impl Default for GpuMeshBufferGrowthPolicy {
    fn default() -> Self {
        Self {
            growth_factor_numerator: 2,
            growth_factor_denominator: 1,
            min_headroom_bytes: 64 * 1024,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GpuUploadRange {
    pub offset: u64,
    pub bytes: Vec<u8>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GpuMeshPartialUploadPlan {
    pub position_update: Option<GpuUploadRange>,
    pub normal_update: Option<GpuUploadRange>,
    pub index_update: Option<GpuUploadRange>,
}

pub struct GpuMeshBridge;

impl GpuMeshBridge {
    /// Convert an evaluated viewport payload into a GPU upload plan.
    pub fn plan_from_viewport_payload(payload: &ViewportBufferPayload) -> GpuMeshUploadPlan {
        GpuMeshUploadPlan {
            positions_bytes: cast_slice(payload.positions.as_slice()).to_vec(),
            normals_bytes: cast_slice(payload.normals.as_slice()).to_vec(),
            indices_bytes: cast_slice(payload.indices.as_slice()).to_vec(),
            vertex_count: payload.vertex_count,
            index_count: payload.index_count,
        }
    }

    pub fn summarize(plan: &GpuMeshUploadPlan) -> GpuMeshUploadSummary {
        GpuMeshUploadSummary {
            position_bytes: plan.positions_bytes.len(),
            normal_bytes: plan.normals_bytes.len(),
            index_bytes: plan.indices_bytes.len(),
            vertex_count: plan.vertex_count,
            index_count: plan.index_count,
        }
    }

    pub fn allocate_buffers(
        manager: &mut crate::GPUPipelineManager,
        plan: &GpuMeshUploadPlan,
    ) -> Result<GpuMeshBufferHandles> {
        Self::allocate_buffers_with_sizing(
            manager,
            GpuMeshBufferSizing {
                position_bytes: plan.positions_bytes.len() as u64,
                normal_bytes: plan.normals_bytes.len() as u64,
                index_bytes: plan.indices_bytes.len() as u64,
            },
        )
    }

    pub fn allocate_buffers_with_sizing(
        manager: &mut crate::GPUPipelineManager,
        sizing: GpuMeshBufferSizing,
    ) -> Result<GpuMeshBufferHandles> {
        let positions = manager.get_buffer(
            sizing.position_bytes,
            BufferUsages::VERTEX | BufferUsages::COPY_DST | BufferUsages::STORAGE,
        )?;
        let normals = manager.get_buffer(
            sizing.normal_bytes,
            BufferUsages::VERTEX | BufferUsages::COPY_DST | BufferUsages::STORAGE,
        )?;
        let indices = manager.get_buffer(
            sizing.index_bytes,
            BufferUsages::INDEX | BufferUsages::COPY_DST | BufferUsages::STORAGE,
        )?;

        Ok(GpuMeshBufferHandles {
            positions,
            normals,
            indices,
        })
    }

    pub fn upload_plan(
        manager: &crate::GPUPipelineManager,
        buffers: &GpuMeshBufferHandles,
        plan: &GpuMeshUploadPlan,
    ) -> Result<()> {
        manager.upload_bytes(&buffers.positions, 0, &plan.positions_bytes)?;
        manager.upload_bytes(&buffers.normals, 0, &plan.normals_bytes)?;
        manager.upload_bytes(&buffers.indices, 0, &plan.indices_bytes)?;
        Ok(())
    }

    pub fn build_partial_upload_plan(
        previous: Option<&GpuMeshUploadPlan>,
        current: &GpuMeshUploadPlan,
    ) -> GpuMeshPartialUploadPlan {
        let previous_positions = previous.map(|plan| plan.positions_bytes.as_slice());
        let previous_normals = previous.map(|plan| plan.normals_bytes.as_slice());
        let previous_indices = previous.map(|plan| plan.indices_bytes.as_slice());

        GpuMeshPartialUploadPlan {
            position_update: changed_range(previous_positions, current.positions_bytes.as_slice()),
            normal_update: changed_range(previous_normals, current.normals_bytes.as_slice()),
            index_update: changed_range(previous_indices, current.indices_bytes.as_slice()),
        }
    }

    pub fn upload_partial_plan(
        manager: &crate::GPUPipelineManager,
        buffers: &GpuMeshBufferHandles,
        partial: &GpuMeshPartialUploadPlan,
    ) -> Result<usize> {
        let mut uploaded_bytes = 0usize;

        if let Some(update) = partial.position_update.as_ref() {
            manager.upload_bytes_with_staging(&buffers.positions, update.offset, &update.bytes)?;
            uploaded_bytes = uploaded_bytes.saturating_add(update.bytes.len());
        }
        if let Some(update) = partial.normal_update.as_ref() {
            manager.upload_bytes_with_staging(&buffers.normals, update.offset, &update.bytes)?;
            uploaded_bytes = uploaded_bytes.saturating_add(update.bytes.len());
        }
        if let Some(update) = partial.index_update.as_ref() {
            manager.upload_bytes_with_staging(&buffers.indices, update.offset, &update.bytes)?;
            uploaded_bytes = uploaded_bytes.saturating_add(update.bytes.len());
        }

        Ok(uploaded_bytes)
    }
}

pub fn next_buffer_capacity_with_policy(
    required: u64,
    current: Option<u64>,
    policy: GpuMeshBufferGrowthPolicy,
) -> u64 {
    let required = required.max(1);
    match current {
        Some(current_bytes) if current_bytes >= required => current_bytes,
        Some(current_bytes) => {
            let scaled_growth = current_bytes
                .saturating_mul(policy.growth_factor_numerator)
                .saturating_div(policy.growth_factor_denominator.max(1));
            let headroom_growth = required.saturating_add(policy.min_headroom_bytes);
            required.max(scaled_growth).max(headroom_growth)
        }
        None => required.saturating_add(policy.min_headroom_bytes),
    }
}

pub fn next_buffer_capacity(required: u64, current: Option<u64>) -> u64 {
    next_buffer_capacity_with_policy(required, current, GpuMeshBufferGrowthPolicy::default())
}

fn changed_range(previous: Option<&[u8]>, current: &[u8]) -> Option<GpuUploadRange> {
    let previous = match previous {
        Some(previous) => previous,
        None => {
            if current.is_empty() {
                return None;
            }
            return Some(GpuUploadRange {
                offset: 0,
                bytes: current.to_vec(),
            });
        }
    };

    if previous == current {
        return None;
    }

    let min_len = previous.len().min(current.len());
    let mut prefix = 0usize;
    while prefix < min_len && previous[prefix] == current[prefix] {
        prefix += 1;
    }

    let mut suffix = 0usize;
    while suffix < (min_len.saturating_sub(prefix))
        && previous[previous.len() - 1 - suffix] == current[current.len() - 1 - suffix]
    {
        suffix += 1;
    }

    let end = current.len().saturating_sub(suffix);
    if prefix >= end {
        return None;
    }

    Some(GpuUploadRange {
        offset: prefix as u64,
        bytes: current[prefix..end].to_vec(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use k_os_eval::mesh_pipeline::ViewportBufferPayload;
    use k_os_scene::{MeshHandle, ShadingMode};

    #[test]
    fn creates_upload_plan_from_viewport_payload() {
        let payload = ViewportBufferPayload {
            mesh_handle: MeshHandle(1),
            positions: vec![0.0, 1.0, 2.0, 3.0, 4.0, 5.0],
            normals: vec![0.0, 0.0, 1.0, 0.0, 0.0, 1.0],
            indices: vec![0, 1, 2],
            shading_mode: ShadingMode::Solid,
            vertex_count: 2,
            index_count: 3,
        };

        let plan = GpuMeshBridge::plan_from_viewport_payload(&payload);
        let summary = GpuMeshBridge::summarize(&plan);

        assert_eq!(summary.position_bytes, 24);
        assert_eq!(summary.normal_bytes, 24);
        assert_eq!(summary.index_bytes, 12);
        assert_eq!(summary.vertex_count, 2);
        assert_eq!(summary.index_count, 3);
    }

    #[test]
    fn partial_upload_plan_is_none_when_payload_is_identical() {
        let previous = GpuMeshUploadPlan {
            positions_bytes: vec![1, 2, 3, 4],
            normals_bytes: vec![5, 6, 7, 8],
            indices_bytes: vec![9, 10, 11, 12],
            vertex_count: 1,
            index_count: 1,
        };
        let current = previous.clone();

        let partial = GpuMeshBridge::build_partial_upload_plan(Some(&previous), &current);
        assert!(partial.position_update.is_none());
        assert!(partial.normal_update.is_none());
        assert!(partial.index_update.is_none());
    }

    #[test]
    fn partial_upload_plan_is_full_when_no_previous_payload_exists() {
        let current = GpuMeshUploadPlan {
            positions_bytes: vec![1, 2, 3, 4],
            normals_bytes: vec![5, 6, 7, 8],
            indices_bytes: vec![9, 10, 11, 12],
            vertex_count: 1,
            index_count: 1,
        };

        let partial = GpuMeshBridge::build_partial_upload_plan(None, &current);
        assert_eq!(
            partial.position_update,
            Some(GpuUploadRange {
                offset: 0,
                bytes: vec![1, 2, 3, 4],
            })
        );
        assert_eq!(
            partial.normal_update,
            Some(GpuUploadRange {
                offset: 0,
                bytes: vec![5, 6, 7, 8],
            })
        );
        assert_eq!(
            partial.index_update,
            Some(GpuUploadRange {
                offset: 0,
                bytes: vec![9, 10, 11, 12],
            })
        );
    }

    #[test]
    fn partial_upload_plan_uploads_only_changed_middle_range() {
        let previous = GpuMeshUploadPlan {
            positions_bytes: vec![1, 2, 3, 4, 5, 6, 7, 8],
            normals_bytes: vec![0],
            indices_bytes: vec![0],
            vertex_count: 1,
            index_count: 1,
        };
        let current = GpuMeshUploadPlan {
            positions_bytes: vec![1, 2, 99, 100, 101, 6, 7, 8],
            normals_bytes: vec![0],
            indices_bytes: vec![0],
            vertex_count: 1,
            index_count: 1,
        };

        let partial = GpuMeshBridge::build_partial_upload_plan(Some(&previous), &current);
        assert_eq!(
            partial.position_update,
            Some(GpuUploadRange {
                offset: 2,
                bytes: vec![99, 100, 101],
            })
        );
    }

    #[test]
    fn next_capacity_keeps_existing_when_large_enough() {
        assert_eq!(next_buffer_capacity(1024, Some(4096)), 4096);
    }

    #[test]
    fn next_capacity_adds_headroom_for_new_allocations() {
        assert_eq!(next_buffer_capacity(4096, None), 4096 + (64 * 1024));
    }

    #[test]
    fn next_capacity_grows_past_required_when_existing_is_too_small() {
        let next = next_buffer_capacity(100_000, Some(80_000));
        assert!(next > 100_000);
    }

    #[test]
    fn next_capacity_with_policy_uses_typed_contract() {
        let policy = GpuMeshBufferGrowthPolicy {
            growth_factor_numerator: 3,
            growth_factor_denominator: 2,
            min_headroom_bytes: 512,
        };
        assert_eq!(
            next_buffer_capacity_with_policy(1024, Some(800), policy),
            1536
        );
    }
}
