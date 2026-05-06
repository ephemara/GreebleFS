use crate::types::{RenderMeshHandle, ShadingMode};
use k_os_kain::{
    generated_spirv_by_id, generated_spirv_for_domain, GeneratedSpirvAsset, KainDomain,
};
use std::collections::BTreeMap;
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::sync::OnceLock;
use std::time::{Duration, Instant};
use wgpu::util::DeviceExt;

#[derive(Debug, Clone)]
pub struct DrawPacket {
    pub render_mesh: RenderMeshHandle,
    pub vertex_count: u32,
    pub index_count: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum RenderPassKind {
    CullFrustum,
    SurfacePass,
    NormalsRecon,
    NormalsNormalize,
    PickingRay,
    WireframeEdges,
    ScreenComposite,
    HyperResolve,
}

impl RenderPassKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::CullFrustum => "cull_frustum",
            Self::SurfacePass => "surface_pass",
            Self::NormalsRecon => "normals_recon",
            Self::NormalsNormalize => "normals_normalize",
            Self::PickingRay => "picking_ray",
            Self::WireframeEdges => "wireframe_edges",
            Self::ScreenComposite => "screen_composite",
            Self::HyperResolve => "hyper_resolve",
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub struct RendererShaderBinding {
    pub pass: RenderPassKind,
    pub shader_id: &'static str,
    pub asset: &'static GeneratedSpirvAsset,
}

#[derive(Debug, Clone, Copy)]
pub enum RenderMetric {
    ViewportWidth,
    ViewportHeight,
    VertexCount,
    IndexCount,
    FaceCount,
    InstanceCount,
}

#[derive(Debug, Clone, Copy)]
pub enum DispatchTopology {
    Fixed(u32, u32, u32),
    Linear(RenderMetric),
    Grid2D(RenderMetric, RenderMetric),
}

#[derive(Debug, Clone, Copy)]
pub enum ResourceExtent {
    Single,
    VertexCount,
    IndexCount,
    FaceCount,
    FaceCountTimesSix,
    ViewportPixels,
    InstanceCount,
}

#[derive(Debug, Clone, Copy)]
pub enum ResourceDataType {
    Vec4,
    U32,
    F32,
}

#[derive(Debug, Clone, Copy)]
pub enum RenderResourceUsage {
    Uniform,
    StorageRead,
    StorageReadWrite,
}

#[derive(Debug, Clone, Copy)]
pub enum ResourceInit {
    Zero,
    U32(RenderMetric),
    F32(f32),
    Vec4([f32; 4]),
}

#[derive(Debug, Clone, Copy)]
pub struct RenderResourceBinding {
    pub label: &'static str,
    pub binding: u32,
    pub usage: RenderResourceUsage,
    pub data_type: ResourceDataType,
    pub extent: ResourceExtent,
    pub init: ResourceInit,
}

#[derive(Debug, Clone)]
pub struct RenderPassNode {
    pub kind: RenderPassKind,
    pub shader_id: &'static str,
    pub entry_point: &'static str,
    pub dispatch: DispatchTopology,
    pub resources: &'static [RenderResourceBinding],
}

#[derive(Debug, Clone, Copy)]
pub struct RenderGraphExecutionContext {
    pub viewport_width: u32,
    pub viewport_height: u32,
    pub vertex_count: u32,
    pub index_count: u32,
    pub face_count: u32,
    pub instance_count: u32,
    pub shading_mode: ShadingMode,
    pub allow_gpu_dispatch: bool,
}

impl RenderGraphExecutionContext {
    fn metric(self, metric: RenderMetric) -> u32 {
        match metric {
            RenderMetric::ViewportWidth => self.viewport_width.min(64).max(1),
            RenderMetric::ViewportHeight => self.viewport_height.min(64).max(1),
            RenderMetric::VertexCount => self.vertex_count.min(256).max(1),
            RenderMetric::IndexCount => self.index_count.min(768).max(1),
            RenderMetric::FaceCount => self.face_count.min(256).max(1),
            RenderMetric::InstanceCount => self.instance_count.min(64).max(1),
        }
    }
}

#[derive(Debug, Clone)]
pub struct RenderGraphExecutionReport {
    pub duration: Duration,
    pub compiled_pipelines: u32,
    pub prepared_passes: Vec<RenderPassKind>,
    pub dispatched_passes: Vec<RenderPassKind>,
    pub allocated_bytes: u64,
}

pub struct RenderGraph {
    passes: Vec<RenderPassNode>,
    pipelines: BTreeMap<RenderPassKind, wgpu::ComputePipeline>,
}

const IDENTITY_C0: [f32; 4] = [1.0, 0.0, 0.0, 0.0];
const IDENTITY_C1: [f32; 4] = [0.0, 1.0, 0.0, 0.0];
const IDENTITY_C2: [f32; 4] = [0.0, 0.0, 1.0, 0.0];
const IDENTITY_C3: [f32; 4] = [0.0, 0.0, 0.0, 1.0];

const CULL_FRUSTUM_RESOURCES: &[RenderResourceBinding] = &[
    RenderResourceBinding {
        label: "aabb_min",
        binding: 0,
        usage: RenderResourceUsage::StorageRead,
        data_type: ResourceDataType::Vec4,
        extent: ResourceExtent::InstanceCount,
        init: ResourceInit::Zero,
    },
    RenderResourceBinding {
        label: "aabb_max",
        binding: 1,
        usage: RenderResourceUsage::StorageRead,
        data_type: ResourceDataType::Vec4,
        extent: ResourceExtent::InstanceCount,
        init: ResourceInit::Zero,
    },
    RenderResourceBinding {
        label: "visibility",
        binding: 2,
        usage: RenderResourceUsage::StorageReadWrite,
        data_type: ResourceDataType::U32,
        extent: ResourceExtent::InstanceCount,
        init: ResourceInit::Zero,
    },
    RenderResourceBinding {
        label: "plane0",
        binding: 3,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::Vec4,
        extent: ResourceExtent::Single,
        init: ResourceInit::Vec4([1.0, 0.0, 0.0, 1.0]),
    },
    RenderResourceBinding {
        label: "plane1",
        binding: 4,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::Vec4,
        extent: ResourceExtent::Single,
        init: ResourceInit::Vec4([-1.0, 0.0, 0.0, 1.0]),
    },
    RenderResourceBinding {
        label: "plane2",
        binding: 5,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::Vec4,
        extent: ResourceExtent::Single,
        init: ResourceInit::Vec4([0.0, 1.0, 0.0, 1.0]),
    },
    RenderResourceBinding {
        label: "plane3",
        binding: 6,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::Vec4,
        extent: ResourceExtent::Single,
        init: ResourceInit::Vec4([0.0, -1.0, 0.0, 1.0]),
    },
    RenderResourceBinding {
        label: "plane4",
        binding: 7,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::Vec4,
        extent: ResourceExtent::Single,
        init: ResourceInit::Vec4([0.0, 0.0, 1.0, 1.0]),
    },
    RenderResourceBinding {
        label: "plane5",
        binding: 8,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::Vec4,
        extent: ResourceExtent::Single,
        init: ResourceInit::Vec4([0.0, 0.0, -1.0, 1.0]),
    },
    RenderResourceBinding {
        label: "instance_count",
        binding: 9,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::U32,
        extent: ResourceExtent::Single,
        init: ResourceInit::U32(RenderMetric::InstanceCount),
    },
];

const SURFACE_PASS_RESOURCES: &[RenderResourceBinding] = &[
    RenderResourceBinding {
        label: "positions",
        binding: 0,
        usage: RenderResourceUsage::StorageRead,
        data_type: ResourceDataType::Vec4,
        extent: ResourceExtent::VertexCount,
        init: ResourceInit::Zero,
    },
    RenderResourceBinding {
        label: "depth_out",
        binding: 1,
        usage: RenderResourceUsage::StorageReadWrite,
        data_type: ResourceDataType::F32,
        extent: ResourceExtent::ViewportPixels,
        init: ResourceInit::Zero,
    },
    RenderResourceBinding {
        label: "mvp_c0",
        binding: 2,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::Vec4,
        extent: ResourceExtent::Single,
        init: ResourceInit::Vec4(IDENTITY_C0),
    },
    RenderResourceBinding {
        label: "mvp_c1",
        binding: 3,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::Vec4,
        extent: ResourceExtent::Single,
        init: ResourceInit::Vec4(IDENTITY_C1),
    },
    RenderResourceBinding {
        label: "mvp_c2",
        binding: 4,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::Vec4,
        extent: ResourceExtent::Single,
        init: ResourceInit::Vec4(IDENTITY_C2),
    },
    RenderResourceBinding {
        label: "mvp_c3",
        binding: 5,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::Vec4,
        extent: ResourceExtent::Single,
        init: ResourceInit::Vec4(IDENTITY_C3),
    },
    RenderResourceBinding {
        label: "viewport_width",
        binding: 6,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::U32,
        extent: ResourceExtent::Single,
        init: ResourceInit::U32(RenderMetric::ViewportWidth),
    },
    RenderResourceBinding {
        label: "viewport_height",
        binding: 7,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::U32,
        extent: ResourceExtent::Single,
        init: ResourceInit::U32(RenderMetric::ViewportHeight),
    },
    RenderResourceBinding {
        label: "vertex_count",
        binding: 8,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::U32,
        extent: ResourceExtent::Single,
        init: ResourceInit::U32(RenderMetric::VertexCount),
    },
];

const NORMALS_RECON_RESOURCES: &[RenderResourceBinding] = &[
    RenderResourceBinding {
        label: "positions",
        binding: 0,
        usage: RenderResourceUsage::StorageRead,
        data_type: ResourceDataType::Vec4,
        extent: ResourceExtent::VertexCount,
        init: ResourceInit::Zero,
    },
    RenderResourceBinding {
        label: "indices",
        binding: 1,
        usage: RenderResourceUsage::StorageRead,
        data_type: ResourceDataType::U32,
        extent: ResourceExtent::IndexCount,
        init: ResourceInit::Zero,
    },
    RenderResourceBinding {
        label: "normals_accum",
        binding: 2,
        usage: RenderResourceUsage::StorageReadWrite,
        data_type: ResourceDataType::Vec4,
        extent: ResourceExtent::VertexCount,
        init: ResourceInit::Zero,
    },
    RenderResourceBinding {
        label: "face_count",
        binding: 3,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::U32,
        extent: ResourceExtent::Single,
        init: ResourceInit::U32(RenderMetric::FaceCount),
    },
    RenderResourceBinding {
        label: "vertex_count",
        binding: 4,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::U32,
        extent: ResourceExtent::Single,
        init: ResourceInit::U32(RenderMetric::VertexCount),
    },
];

const NORMALS_NORMALIZE_RESOURCES: &[RenderResourceBinding] = &[
    RenderResourceBinding {
        label: "normals_accum",
        binding: 0,
        usage: RenderResourceUsage::StorageRead,
        data_type: ResourceDataType::Vec4,
        extent: ResourceExtent::VertexCount,
        init: ResourceInit::Zero,
    },
    RenderResourceBinding {
        label: "normals_out",
        binding: 1,
        usage: RenderResourceUsage::StorageReadWrite,
        data_type: ResourceDataType::Vec4,
        extent: ResourceExtent::VertexCount,
        init: ResourceInit::Zero,
    },
    RenderResourceBinding {
        label: "vertex_count",
        binding: 2,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::U32,
        extent: ResourceExtent::Single,
        init: ResourceInit::U32(RenderMetric::VertexCount),
    },
];

const PICKING_RAY_RESOURCES: &[RenderResourceBinding] = &[
    RenderResourceBinding {
        label: "positions",
        binding: 0,
        usage: RenderResourceUsage::StorageRead,
        data_type: ResourceDataType::Vec4,
        extent: ResourceExtent::VertexCount,
        init: ResourceInit::Zero,
    },
    RenderResourceBinding {
        label: "indices",
        binding: 1,
        usage: RenderResourceUsage::StorageRead,
        data_type: ResourceDataType::U32,
        extent: ResourceExtent::IndexCount,
        init: ResourceInit::Zero,
    },
    RenderResourceBinding {
        label: "result",
        binding: 2,
        usage: RenderResourceUsage::StorageReadWrite,
        data_type: ResourceDataType::Vec4,
        extent: ResourceExtent::Single,
        init: ResourceInit::Vec4([9_999_999.0, 0.0, 0.0, 0.0]),
    },
    RenderResourceBinding {
        label: "ray_origin",
        binding: 3,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::Vec4,
        extent: ResourceExtent::Single,
        init: ResourceInit::Vec4([0.0, 0.0, 2.0, 1.0]),
    },
    RenderResourceBinding {
        label: "ray_direction",
        binding: 4,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::Vec4,
        extent: ResourceExtent::Single,
        init: ResourceInit::Vec4([0.0, 0.0, -1.0, 0.0]),
    },
    RenderResourceBinding {
        label: "face_count",
        binding: 5,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::U32,
        extent: ResourceExtent::Single,
        init: ResourceInit::U32(RenderMetric::FaceCount),
    },
    RenderResourceBinding {
        label: "t_min",
        binding: 6,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::F32,
        extent: ResourceExtent::Single,
        init: ResourceInit::F32(0.0),
    },
    RenderResourceBinding {
        label: "t_max",
        binding: 7,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::F32,
        extent: ResourceExtent::Single,
        init: ResourceInit::F32(100.0),
    },
];

const WIREFRAME_RESOURCES: &[RenderResourceBinding] = &[
    RenderResourceBinding {
        label: "positions",
        binding: 0,
        usage: RenderResourceUsage::StorageRead,
        data_type: ResourceDataType::Vec4,
        extent: ResourceExtent::VertexCount,
        init: ResourceInit::Zero,
    },
    RenderResourceBinding {
        label: "indices",
        binding: 1,
        usage: RenderResourceUsage::StorageRead,
        data_type: ResourceDataType::U32,
        extent: ResourceExtent::IndexCount,
        init: ResourceInit::Zero,
    },
    RenderResourceBinding {
        label: "edge_segments",
        binding: 2,
        usage: RenderResourceUsage::StorageReadWrite,
        data_type: ResourceDataType::Vec4,
        extent: ResourceExtent::FaceCountTimesSix,
        init: ResourceInit::Zero,
    },
    RenderResourceBinding {
        label: "vp_c0",
        binding: 3,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::Vec4,
        extent: ResourceExtent::Single,
        init: ResourceInit::Vec4(IDENTITY_C0),
    },
    RenderResourceBinding {
        label: "vp_c1",
        binding: 4,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::Vec4,
        extent: ResourceExtent::Single,
        init: ResourceInit::Vec4(IDENTITY_C1),
    },
    RenderResourceBinding {
        label: "vp_c2",
        binding: 5,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::Vec4,
        extent: ResourceExtent::Single,
        init: ResourceInit::Vec4(IDENTITY_C2),
    },
    RenderResourceBinding {
        label: "vp_c3",
        binding: 6,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::Vec4,
        extent: ResourceExtent::Single,
        init: ResourceInit::Vec4(IDENTITY_C3),
    },
    RenderResourceBinding {
        label: "viewport_width",
        binding: 7,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::F32,
        extent: ResourceExtent::Single,
        init: ResourceInit::F32(64.0),
    },
    RenderResourceBinding {
        label: "viewport_height",
        binding: 8,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::F32,
        extent: ResourceExtent::Single,
        init: ResourceInit::F32(64.0),
    },
    RenderResourceBinding {
        label: "face_count",
        binding: 9,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::U32,
        extent: ResourceExtent::Single,
        init: ResourceInit::U32(RenderMetric::FaceCount),
    },
];

const SCREEN_COMPOSITE_RESOURCES: &[RenderResourceBinding] = &[
    RenderResourceBinding {
        label: "hdr_buffer",
        binding: 0,
        usage: RenderResourceUsage::StorageRead,
        data_type: ResourceDataType::Vec4,
        extent: ResourceExtent::ViewportPixels,
        init: ResourceInit::Zero,
    },
    RenderResourceBinding {
        label: "ldr_output",
        binding: 1,
        usage: RenderResourceUsage::StorageReadWrite,
        data_type: ResourceDataType::Vec4,
        extent: ResourceExtent::ViewportPixels,
        init: ResourceInit::Zero,
    },
    RenderResourceBinding {
        label: "exposure",
        binding: 2,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::F32,
        extent: ResourceExtent::Single,
        init: ResourceInit::F32(1.0),
    },
    RenderResourceBinding {
        label: "gamma",
        binding: 3,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::F32,
        extent: ResourceExtent::Single,
        init: ResourceInit::F32(2.2),
    },
    RenderResourceBinding {
        label: "vignette_radius",
        binding: 4,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::F32,
        extent: ResourceExtent::Single,
        init: ResourceInit::F32(0.5),
    },
    RenderResourceBinding {
        label: "vignette_smooth",
        binding: 5,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::F32,
        extent: ResourceExtent::Single,
        init: ResourceInit::F32(0.5),
    },
    RenderResourceBinding {
        label: "tonemap_mode",
        binding: 6,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::U32,
        extent: ResourceExtent::Single,
        init: ResourceInit::U32(RenderMetric::InstanceCount),
    },
    RenderResourceBinding {
        label: "wire_tint",
        binding: 7,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::Vec4,
        extent: ResourceExtent::Single,
        init: ResourceInit::Vec4([0.0, 0.0, 0.0, 1.0]),
    },
    RenderResourceBinding {
        label: "wire_tint_weight",
        binding: 8,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::F32,
        extent: ResourceExtent::Single,
        init: ResourceInit::F32(0.0),
    },
    RenderResourceBinding {
        label: "viewport_width",
        binding: 9,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::U32,
        extent: ResourceExtent::Single,
        init: ResourceInit::U32(RenderMetric::ViewportWidth),
    },
    RenderResourceBinding {
        label: "viewport_height",
        binding: 10,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::U32,
        extent: ResourceExtent::Single,
        init: ResourceInit::U32(RenderMetric::ViewportHeight),
    },
];

const HYPER_RESOLVE_RESOURCES: &[RenderResourceBinding] = &[
    RenderResourceBinding {
        label: "hdr_current",
        binding: 0,
        usage: RenderResourceUsage::StorageRead,
        data_type: ResourceDataType::Vec4,
        extent: ResourceExtent::ViewportPixels,
        init: ResourceInit::Zero,
    },
    RenderResourceBinding {
        label: "depth_current",
        binding: 1,
        usage: RenderResourceUsage::StorageRead,
        data_type: ResourceDataType::F32,
        extent: ResourceExtent::ViewportPixels,
        init: ResourceInit::Zero,
    },
    RenderResourceBinding {
        label: "normal_current",
        binding: 2,
        usage: RenderResourceUsage::StorageRead,
        data_type: ResourceDataType::Vec4,
        extent: ResourceExtent::ViewportPixels,
        init: ResourceInit::Zero,
    },
    RenderResourceBinding {
        label: "albedo_current",
        binding: 3,
        usage: RenderResourceUsage::StorageRead,
        data_type: ResourceDataType::Vec4,
        extent: ResourceExtent::ViewportPixels,
        init: ResourceInit::Zero,
    },
    RenderResourceBinding {
        label: "material_current",
        binding: 4,
        usage: RenderResourceUsage::StorageRead,
        data_type: ResourceDataType::Vec4,
        extent: ResourceExtent::ViewportPixels,
        init: ResourceInit::Zero,
    },
    RenderResourceBinding {
        label: "motion_vectors",
        binding: 5,
        usage: RenderResourceUsage::StorageRead,
        data_type: ResourceDataType::Vec4,
        extent: ResourceExtent::ViewportPixels,
        init: ResourceInit::Zero,
    },
    RenderResourceBinding {
        label: "history_color",
        binding: 6,
        usage: RenderResourceUsage::StorageRead,
        data_type: ResourceDataType::Vec4,
        extent: ResourceExtent::ViewportPixels,
        init: ResourceInit::Zero,
    },
    RenderResourceBinding {
        label: "history_aux",
        binding: 7,
        usage: RenderResourceUsage::StorageRead,
        data_type: ResourceDataType::Vec4,
        extent: ResourceExtent::ViewportPixels,
        init: ResourceInit::Zero,
    },
    RenderResourceBinding {
        label: "blue_noise",
        binding: 8,
        usage: RenderResourceUsage::StorageRead,
        data_type: ResourceDataType::F32,
        extent: ResourceExtent::ViewportPixels,
        init: ResourceInit::Zero,
    },
    RenderResourceBinding {
        label: "out_color",
        binding: 9,
        usage: RenderResourceUsage::StorageReadWrite,
        data_type: ResourceDataType::Vec4,
        extent: ResourceExtent::ViewportPixels,
        init: ResourceInit::Zero,
    },
    RenderResourceBinding {
        label: "out_debug",
        binding: 10,
        usage: RenderResourceUsage::StorageReadWrite,
        data_type: ResourceDataType::Vec4,
        extent: ResourceExtent::ViewportPixels,
        init: ResourceInit::Zero,
    },
    RenderResourceBinding {
        label: "viewport_width",
        binding: 11,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::U32,
        extent: ResourceExtent::Single,
        init: ResourceInit::U32(RenderMetric::ViewportWidth),
    },
    RenderResourceBinding {
        label: "viewport_height",
        binding: 12,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::U32,
        extent: ResourceExtent::Single,
        init: ResourceInit::U32(RenderMetric::ViewportHeight),
    },
    RenderResourceBinding {
        label: "frame_index",
        binding: 13,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::U32,
        extent: ResourceExtent::Single,
        init: ResourceInit::U32(RenderMetric::InstanceCount),
    },
    RenderResourceBinding {
        label: "history_blend",
        binding: 14,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::F32,
        extent: ResourceExtent::Single,
        init: ResourceInit::F32(0.85),
    },
    RenderResourceBinding {
        label: "history_boost",
        binding: 15,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::F32,
        extent: ResourceExtent::Single,
        init: ResourceInit::F32(1.0),
    },
    RenderResourceBinding {
        label: "temporal_stability",
        binding: 16,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::F32,
        extent: ResourceExtent::Single,
        init: ResourceInit::F32(0.75),
    },
    RenderResourceBinding {
        label: "gather_radius",
        binding: 17,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::F32,
        extent: ResourceExtent::Single,
        init: ResourceInit::F32(1.0),
    },
    RenderResourceBinding {
        label: "indirect_gain",
        binding: 18,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::F32,
        extent: ResourceExtent::Single,
        init: ResourceInit::F32(0.5),
    },
    RenderResourceBinding {
        label: "diffuse_gain",
        binding: 19,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::F32,
        extent: ResourceExtent::Single,
        init: ResourceInit::F32(1.0),
    },
    RenderResourceBinding {
        label: "spec_gain",
        binding: 20,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::F32,
        extent: ResourceExtent::Single,
        init: ResourceInit::F32(1.0),
    },
    RenderResourceBinding {
        label: "ao_strength",
        binding: 21,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::F32,
        extent: ResourceExtent::Single,
        init: ResourceInit::F32(1.0),
    },
    RenderResourceBinding {
        label: "emissive_gain",
        binding: 22,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::F32,
        extent: ResourceExtent::Single,
        init: ResourceInit::F32(1.0),
    },
    RenderResourceBinding {
        label: "roughness_bias",
        binding: 23,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::F32,
        extent: ResourceExtent::Single,
        init: ResourceInit::F32(0.0),
    },
    RenderResourceBinding {
        label: "metallic_bias",
        binding: 24,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::F32,
        extent: ResourceExtent::Single,
        init: ResourceInit::F32(0.0),
    },
    RenderResourceBinding {
        label: "normal_reject_power",
        binding: 25,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::F32,
        extent: ResourceExtent::Single,
        init: ResourceInit::F32(2.0),
    },
    RenderResourceBinding {
        label: "depth_reject_scale",
        binding: 26,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::F32,
        extent: ResourceExtent::Single,
        init: ResourceInit::F32(1.0),
    },
    RenderResourceBinding {
        label: "clamp_strength",
        binding: 27,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::F32,
        extent: ResourceExtent::Single,
        init: ResourceInit::F32(0.5),
    },
    RenderResourceBinding {
        label: "vignette_strength",
        binding: 28,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::F32,
        extent: ResourceExtent::Single,
        init: ResourceInit::F32(0.25),
    },
    RenderResourceBinding {
        label: "curvature_gain",
        binding: 29,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::F32,
        extent: ResourceExtent::Single,
        init: ResourceInit::F32(0.5),
    },
    RenderResourceBinding {
        label: "sparkle_gain",
        binding: 30,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::F32,
        extent: ResourceExtent::Single,
        init: ResourceInit::F32(0.1),
    },
    RenderResourceBinding {
        label: "env_top",
        binding: 31,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::Vec4,
        extent: ResourceExtent::Single,
        init: ResourceInit::Vec4([0.3, 0.4, 0.6, 1.0]),
    },
    RenderResourceBinding {
        label: "env_mid",
        binding: 32,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::Vec4,
        extent: ResourceExtent::Single,
        init: ResourceInit::Vec4([0.2, 0.25, 0.3, 1.0]),
    },
    RenderResourceBinding {
        label: "env_bottom",
        binding: 33,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::Vec4,
        extent: ResourceExtent::Single,
        init: ResourceInit::Vec4([0.04, 0.05, 0.08, 1.0]),
    },
    RenderResourceBinding {
        label: "sun_dir",
        binding: 34,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::Vec4,
        extent: ResourceExtent::Single,
        init: ResourceInit::Vec4([0.0, 1.0, 0.0, 0.0]),
    },
    RenderResourceBinding {
        label: "sun_color",
        binding: 35,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::Vec4,
        extent: ResourceExtent::Single,
        init: ResourceInit::Vec4([1.0, 0.95, 0.85, 1.0]),
    },
    RenderResourceBinding {
        label: "fog_color",
        binding: 36,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::Vec4,
        extent: ResourceExtent::Single,
        init: ResourceInit::Vec4([0.05, 0.07, 0.1, 1.0]),
    },
    RenderResourceBinding {
        label: "fog_density",
        binding: 37,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::F32,
        extent: ResourceExtent::Single,
        init: ResourceInit::F32(0.05),
    },
    RenderResourceBinding {
        label: "debug_mode",
        binding: 38,
        usage: RenderResourceUsage::Uniform,
        data_type: ResourceDataType::U32,
        extent: ResourceExtent::Single,
        init: ResourceInit::U32(RenderMetric::IndexCount),
    },
];

const PASS_SHADER_IDS: &[(RenderPassKind, &str)] = &[
    (RenderPassKind::CullFrustum, "renderer_cull_frustum"),
    (RenderPassKind::SurfacePass, "renderer_surface_pass"),
    (RenderPassKind::NormalsRecon, "renderer_normals_recon"),
    (
        RenderPassKind::NormalsNormalize,
        "renderer_normals_normalize",
    ),
    (RenderPassKind::PickingRay, "renderer_picking_ray"),
    (RenderPassKind::WireframeEdges, "renderer_wireframe_edges"),
    (RenderPassKind::ScreenComposite, "renderer_screen_composit"),
    (RenderPassKind::HyperResolve, "renderer_hyper_resolve"),
];

fn build_renderer_shader_catalog() -> BTreeMap<RenderPassKind, RendererShaderBinding> {
    let renderer_assets = generated_spirv_for_domain(KainDomain::Renderer);
    let asset_ids: BTreeMap<&'static str, &'static GeneratedSpirvAsset> = renderer_assets
        .into_iter()
        .map(|asset| (asset.id, asset))
        .collect();

    PASS_SHADER_IDS
        .iter()
        .filter_map(|(pass, shader_id)| {
            asset_ids.get(shader_id).copied().map(|asset| {
                (
                    *pass,
                    RendererShaderBinding {
                        pass: *pass,
                        shader_id,
                        asset,
                    },
                )
            })
        })
        .collect()
}

fn build_passes() -> Vec<RenderPassNode> {
    vec![
        RenderPassNode {
            kind: RenderPassKind::CullFrustum,
            shader_id: "renderer_cull_frustum",
            entry_point: "renderer_cull_frustum",
            dispatch: DispatchTopology::Linear(RenderMetric::InstanceCount),
            resources: CULL_FRUSTUM_RESOURCES,
        },
        RenderPassNode {
            kind: RenderPassKind::SurfacePass,
            shader_id: "renderer_surface_pass",
            entry_point: "renderer_surface_pass",
            dispatch: DispatchTopology::Linear(RenderMetric::VertexCount),
            resources: SURFACE_PASS_RESOURCES,
        },
        RenderPassNode {
            kind: RenderPassKind::NormalsRecon,
            shader_id: "renderer_normals_recon",
            entry_point: "renderer_normals_recon",
            dispatch: DispatchTopology::Linear(RenderMetric::FaceCount),
            resources: NORMALS_RECON_RESOURCES,
        },
        RenderPassNode {
            kind: RenderPassKind::NormalsNormalize,
            shader_id: "renderer_normals_normalize",
            entry_point: "renderer_normals_normalize",
            dispatch: DispatchTopology::Linear(RenderMetric::VertexCount),
            resources: NORMALS_NORMALIZE_RESOURCES,
        },
        RenderPassNode {
            kind: RenderPassKind::PickingRay,
            shader_id: "renderer_picking_ray",
            entry_point: "renderer_picking_ray",
            dispatch: DispatchTopology::Linear(RenderMetric::FaceCount),
            resources: PICKING_RAY_RESOURCES,
        },
        RenderPassNode {
            kind: RenderPassKind::WireframeEdges,
            shader_id: "renderer_wireframe_edges",
            entry_point: "renderer_wireframe_edges",
            dispatch: DispatchTopology::Linear(RenderMetric::FaceCount),
            resources: WIREFRAME_RESOURCES,
        },
        RenderPassNode {
            kind: RenderPassKind::ScreenComposite,
            shader_id: "renderer_screen_composit",
            entry_point: "renderer_screen_composit",
            dispatch: DispatchTopology::Grid2D(
                RenderMetric::ViewportWidth,
                RenderMetric::ViewportHeight,
            ),
            resources: SCREEN_COMPOSITE_RESOURCES,
        },
        RenderPassNode {
            kind: RenderPassKind::HyperResolve,
            shader_id: "renderer_hyper_resolve",
            entry_point: "renderer_hyper_resolve",
            dispatch: DispatchTopology::Grid2D(
                RenderMetric::ViewportWidth,
                RenderMetric::ViewportHeight,
            ),
            resources: HYPER_RESOLVE_RESOURCES,
        },
    ]
}

pub fn renderer_shader_catalog() -> &'static BTreeMap<RenderPassKind, RendererShaderBinding> {
    static CATALOG: OnceLock<BTreeMap<RenderPassKind, RendererShaderBinding>> = OnceLock::new();
    CATALOG.get_or_init(build_renderer_shader_catalog)
}

pub fn renderer_shader_for_pass(pass: RenderPassKind) -> Option<&'static RendererShaderBinding> {
    renderer_shader_catalog().get(&pass)
}

pub fn renderer_shader_by_id(shader_id: &str) -> Option<RendererShaderBinding> {
    let binding = PASS_SHADER_IDS
        .iter()
        .find_map(|(pass, mapped_id)| (*mapped_id == shader_id).then_some(*pass))?;
    renderer_shader_for_pass(binding).copied()
}

impl Default for RenderGraph {
    fn default() -> Self {
        Self {
            passes: build_passes(),
            pipelines: BTreeMap::new(),
        }
    }
}

impl RenderGraph {
    pub fn pass_count(&self) -> usize {
        self.passes.len()
    }

    pub fn shader_bindings(&self) -> Vec<&'static RendererShaderBinding> {
        self.passes
            .iter()
            .filter_map(|pass| renderer_shader_for_pass(pass.kind))
            .collect()
    }

    pub fn validate_catalog(&self) -> Vec<&'static str> {
        self.passes
            .iter()
            .filter(|pass| renderer_shader_for_pass(pass.kind).is_none())
            .map(|pass| pass.kind.as_str())
            .collect()
    }

    pub fn execute(
        &mut self,
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        ctx: &RenderGraphExecutionContext,
    ) -> Result<RenderGraphExecutionReport, String> {
        let start = Instant::now();
        let mut compiled_pipelines = 0;
        let mut prepared_passes = Vec::with_capacity(self.passes.len());
        let mut dispatched_passes = Vec::with_capacity(self.passes.len());
        let mut allocated_bytes = 0_u64;

        for pass in &self.passes {
            if !self.pipelines.contains_key(&pass.kind) {
                let pipeline = compile_pipeline(device, pass)?;
                self.pipelines.insert(pass.kind, pipeline);
                compiled_pipelines += 1;
            }

            let pipeline = self
                .pipelines
                .get(&pass.kind)
                .ok_or_else(|| format!("Missing compiled pipeline for {}", pass.kind.as_str()))?;
            let bind_group_layout = pipeline.get_bind_group_layout(0);
            let resources = build_resources_for_pass(device, &bind_group_layout, pass, ctx)?;
            allocated_bytes += resources.allocated_bytes;
            prepared_passes.push(pass.kind);

            if !ctx.allow_gpu_dispatch {
                continue;
            }

            let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
                label: Some(pass.kind.as_str()),
            });
            {
                let mut compute = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
                    label: Some(pass.kind.as_str()),
                    timestamp_writes: None,
                });
                compute.set_pipeline(pipeline);
                compute.set_bind_group(0, &resources.bind_group, &[]);
                let (x, y, z) = resolve_dispatch(pass.dispatch, ctx);
                compute.dispatch_workgroups(x, y, z);
            }

            queue.submit(std::iter::once(encoder.finish()));
            let _ = device.poll(wgpu::PollType::Wait);
            dispatched_passes.push(pass.kind);
        }

        Ok(RenderGraphExecutionReport {
            duration: start.elapsed(),
            compiled_pipelines,
            prepared_passes,
            dispatched_passes,
            allocated_bytes,
        })
    }
}

fn compile_pipeline(
    device: &wgpu::Device,
    pass: &RenderPassNode,
) -> Result<wgpu::ComputePipeline, String> {
    let binding = renderer_shader_for_pass(pass.kind)
        .ok_or_else(|| format!("Missing shader binding for pass {}", pass.kind.as_str()))?;
    debug_assert_eq!(pass.shader_id, binding.shader_id);
    let wgsl = spirv_to_wgsl(binding.asset.bytes)?;

    let module = catch_unwind(AssertUnwindSafe(|| {
        device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some(binding.shader_id),
            source: wgpu::ShaderSource::Wgsl(wgsl.into()),
        })
    }))
    .map_err(|_| format!("Shader module creation panicked for {}", binding.shader_id))?;

    catch_unwind(AssertUnwindSafe(|| {
        device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
            label: Some(binding.shader_id),
            layout: None,
            module: &module,
            entry_point: Some(pass.entry_point),
            compilation_options: Default::default(),
            cache: None,
        })
    }))
    .map_err(|_| {
        format!(
            "Compute pipeline creation panicked for {}",
            binding.shader_id
        )
    })
}

struct PreparedPassResources {
    bind_group: wgpu::BindGroup,
    _buffers: Vec<wgpu::Buffer>,
    allocated_bytes: u64,
}

fn build_resources_for_pass(
    device: &wgpu::Device,
    layout: &wgpu::BindGroupLayout,
    pass: &RenderPassNode,
    ctx: &RenderGraphExecutionContext,
) -> Result<PreparedPassResources, String> {
    let mut buffers = Vec::with_capacity(pass.resources.len());
    let mut allocated_bytes = 0_u64;

    for resource in pass.resources {
        let contents = initial_buffer_bytes(*resource, ctx);
        allocated_bytes += contents.len() as u64;
        let usage = match resource.usage {
            RenderResourceUsage::Uniform => {
                wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST
            }
            RenderResourceUsage::StorageRead | RenderResourceUsage::StorageReadWrite => {
                wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_DST
            }
        };
        let buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some(resource.label),
            contents: &contents,
            usage,
        });
        buffers.push(buffer);
    }

    let entries: Vec<wgpu::BindGroupEntry<'_>> = pass
        .resources
        .iter()
        .enumerate()
        .map(|(index, resource)| wgpu::BindGroupEntry {
            binding: resource.binding,
            resource: buffers[index].as_entire_binding(),
        })
        .collect();

    let bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
        label: Some(pass.kind.as_str()),
        layout,
        entries: &entries,
    });

    Ok(PreparedPassResources {
        bind_group,
        _buffers: buffers,
        allocated_bytes,
    })
}

fn spirv_to_wgsl(bytes: &[u8]) -> Result<String, String> {
    let module = naga::front::spv::parse_u8_slice(bytes, &naga::front::spv::Options::default())
        .map_err(|err| format!("Failed to parse SPIR-V: {err:?}"))?;
    let info = naga::valid::Validator::new(
        naga::valid::ValidationFlags::all(),
        naga::valid::Capabilities::all(),
    )
    .validate(&module)
    .map_err(|err| format!("Failed to validate SPIR-V module: {err:?}"))?;
    naga::back::wgsl::write_string(
        &module,
        &info,
        naga::back::wgsl::WriterFlags::EXPLICIT_TYPES,
    )
    .map_err(|err| format!("Failed to translate SPIR-V to WGSL: {err}"))
}

fn initial_buffer_bytes(
    resource: RenderResourceBinding,
    ctx: &RenderGraphExecutionContext,
) -> Vec<u8> {
    match resource.usage {
        RenderResourceUsage::Uniform => uniform_bytes(resource.init, ctx).to_vec(),
        RenderResourceUsage::StorageRead | RenderResourceUsage::StorageReadWrite => {
            vec![0_u8; storage_size_bytes(resource, ctx) as usize]
        }
    }
}

fn uniform_bytes(init: ResourceInit, ctx: &RenderGraphExecutionContext) -> [u8; 16] {
    let mut bytes = [0_u8; 16];
    match init {
        ResourceInit::Zero => {}
        ResourceInit::U32(metric) => bytes[..4].copy_from_slice(&ctx.metric(metric).to_le_bytes()),
        ResourceInit::F32(value) => bytes[..4].copy_from_slice(&value.to_le_bytes()),
        ResourceInit::Vec4(value) => {
            for (index, component) in value.iter().enumerate() {
                let offset = index * 4;
                bytes[offset..offset + 4].copy_from_slice(&component.to_le_bytes());
            }
        }
    }
    bytes
}

fn storage_size_bytes(resource: RenderResourceBinding, ctx: &RenderGraphExecutionContext) -> u64 {
    let count = match resource.extent {
        ResourceExtent::Single => 1,
        ResourceExtent::VertexCount => ctx.metric(RenderMetric::VertexCount),
        ResourceExtent::IndexCount => ctx.metric(RenderMetric::IndexCount),
        ResourceExtent::FaceCount => ctx.metric(RenderMetric::FaceCount),
        ResourceExtent::FaceCountTimesSix => ctx.metric(RenderMetric::FaceCount).saturating_mul(6),
        ResourceExtent::ViewportPixels => ctx
            .metric(RenderMetric::ViewportWidth)
            .saturating_mul(ctx.metric(RenderMetric::ViewportHeight)),
        ResourceExtent::InstanceCount => ctx.metric(RenderMetric::InstanceCount),
    }
    .max(1) as u64;

    let stride = match resource.data_type {
        ResourceDataType::Vec4 => 16,
        ResourceDataType::U32 | ResourceDataType::F32 => 4,
    };

    count * stride
}

fn resolve_dispatch(
    dispatch: DispatchTopology,
    ctx: &RenderGraphExecutionContext,
) -> (u32, u32, u32) {
    match dispatch {
        DispatchTopology::Fixed(x, y, z) => (x.max(1), y.max(1), z.max(1)),
        DispatchTopology::Linear(metric) => (ctx.metric(metric), 1, 1),
        DispatchTopology::Grid2D(x, y) => (ctx.metric(x), ctx.metric(y), 1),
    }
}

pub fn has_renderer_shader(shader_id: &str) -> bool {
    generated_spirv_by_id(shader_id)
        .map(|asset| asset.domain == KainDomain::Renderer)
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[allow(dead_code)]
    async fn request_test_device() -> Option<(wgpu::Device, wgpu::Queue)> {
        let instance = wgpu::Instance::new(&wgpu::InstanceDescriptor {
            backends: wgpu::Backends::all(),
            ..Default::default()
        });
        let adapter = instance
            .request_adapter(&wgpu::RequestAdapterOptions {
                power_preference: wgpu::PowerPreference::HighPerformance,
                force_fallback_adapter: false,
                compatible_surface: None,
            })
            .await
            .ok()?;
        let limits = adapter.limits();
        adapter
            .request_device(&wgpu::DeviceDescriptor {
                required_features: wgpu::Features::empty(),
                required_limits: limits,
                memory_hints: wgpu::MemoryHints::Performance,
                label: Some("k-os-renderer-test-device"),
                trace: wgpu::Trace::Off,
            })
            .await
            .ok()
    }

    #[test]
    fn renderer_catalog_maps_all_expected_passes() {
        let graph = RenderGraph::default();
        assert!(graph.validate_catalog().is_empty());
        assert_eq!(graph.shader_bindings().len(), PASS_SHADER_IDS.len());
        assert_eq!(graph.pass_count(), PASS_SHADER_IDS.len());
    }

    #[test]
    fn renderer_shader_lookup_is_domain_scoped() {
        let binding = renderer_shader_for_pass(RenderPassKind::SurfacePass).unwrap();
        assert_eq!(binding.asset.domain, KainDomain::Renderer);
        assert_eq!(binding.shader_id, "renderer_surface_pass");
        assert!(has_renderer_shader("renderer_surface_pass"));
    }

    #[test]
    fn renderer_spirv_assets_translate_to_wgsl() {
        for binding in RenderGraph::default().shader_bindings() {
            let wgsl = spirv_to_wgsl(binding.asset.bytes)
                .unwrap_or_else(|err| panic!("failed to translate {}: {err}", binding.shader_id));
            assert!(
                !wgsl.is_empty(),
                "WGSL output should not be empty for {}",
                binding.shader_id
            );
        }
    }

    #[test]
    #[ignore = "Experimental WGPU execution path is gated until resource-backed dispatch is ready"]
    fn render_graph_executes_on_wgpu_if_available() {
        pollster::block_on(async {
            let Some((device, queue)) = request_test_device().await else {
                eprintln!(
                    "Skipping render_graph_executes_on_wgpu_if_available: no adapter available"
                );
                return;
            };

            let mut graph = RenderGraph::default();
            let report = graph
                .execute(
                    &device,
                    &queue,
                    &RenderGraphExecutionContext {
                        viewport_width: 32,
                        viewport_height: 32,
                        vertex_count: 3,
                        index_count: 3,
                        face_count: 1,
                        instance_count: 1,
                        shading_mode: ShadingMode::Solid,
                        allow_gpu_dispatch: false,
                    },
                )
                .expect("render graph execution should succeed");

            assert_eq!(report.prepared_passes.len(), graph.pass_count());
            assert_eq!(report.dispatched_passes.len(), 0);
        });
    }
}
