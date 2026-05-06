//! SVT Multi-Channel Engine - PBR Painting Support
//!
//! Extends SVT to support 5 PBR channels:
//! - Albedo (RGBA)
//! - Normal (RGB, tangent-space)
//! - Roughness (R channel)
//! - Metalness (R channel)
//! - Emission (RGB)
//!
//! Uses a texture array to store all channels efficiently.

use bytemuck::{Pod, Zeroable};
use serde::{Deserialize, Serialize};
use std::borrow::Cow;
use wgpu::util::DeviceExt;

// --- CONSTANTS ---
pub const TILE_SIZE: u32 = 128;
pub const VIRTUAL_SIZE: u32 = 16384; // 16K Texture (configurable)
pub const PHYSICAL_SIZE: u32 = 4096; // 4K VRAM Cache
pub const PAGE_TABLE_SIZE: u32 = VIRTUAL_SIZE / TILE_SIZE; // 128x128

/// Number of PBR channels
pub const NUM_CHANNELS: u32 = 5;

/// Channel indices
#[repr(u32)]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PbrChannel {
    Albedo = 0,
    Normal = 1,
    Roughness = 2,
    Metalness = 3,
    Emission = 4,
}

impl PbrChannel {
    pub fn from_u32(v: u32) -> Option<Self> {
        match v {
            0 => Some(Self::Albedo),
            1 => Some(Self::Normal),
            2 => Some(Self::Roughness),
            3 => Some(Self::Metalness),
            4 => Some(Self::Emission),
            _ => None,
        }
    }

    /// Get default color for this channel
    pub fn default_color(&self) -> [f32; 4] {
        match self {
            Self::Albedo => [0.5, 0.5, 0.5, 1.0],    // Gray
            Self::Normal => [0.5, 0.5, 1.0, 1.0],    // Flat normal (Z-up)
            Self::Roughness => [0.5, 0.5, 0.5, 1.0], // 50% roughness
            Self::Metalness => [0.0, 0.0, 0.0, 1.0], // Non-metallic
            Self::Emission => [0.0, 0.0, 0.0, 1.0],  // No emission
        }
    }
}

/// Blend modes for painting
#[repr(u32)]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BlendMode {
    #[default]
    Normal = 0,
    Multiply = 1,
    Add = 2,
    Overlay = 3,
    Screen = 4,
}

impl BlendMode {
    pub fn from_u32(v: u32) -> Self {
        match v {
            0 => Self::Normal,
            1 => Self::Multiply,
            2 => Self::Add,
            3 => Self::Overlay,
            4 => Self::Screen,
            _ => Self::Normal,
        }
    }
}

/// PBR Brush parameters for GPU
#[repr(C)]
#[derive(Copy, Clone, Debug, Pod, Zeroable)]
pub struct PbrBrushParams {
    // Position & Size
    pub center_uv: [f32; 2],
    pub radius: f32,
    pub hardness: f32,

    // Channel enable flags (as floats for GPU)
    pub albedo_enabled: f32,
    pub normal_enabled: f32,
    pub roughness_enabled: f32,
    pub metalness_enabled: f32,

    // More channel flags
    pub emission_enabled: f32,
    pub blend_mode: u32, // BlendMode as u32
    pub flow: f32,       // Opacity/flow
    pub _pad0: f32,

    // Colors for each channel
    pub albedo_color: [f32; 4],
    pub normal_color: [f32; 4], // For height-to-normal or direct
    pub roughness_value: f32,
    pub metalness_value: f32,
    pub emission_strength: f32,
    pub _pad1: f32,

    pub emission_color: [f32; 4],

    // Texture parameters
    pub virtual_size: f32,
    pub tile_size: f32,
    pub _pad2: [f32; 2],
}

impl Default for PbrBrushParams {
    fn default() -> Self {
        Self {
            center_uv: [0.5, 0.5],
            radius: 50.0,
            hardness: 0.5,

            albedo_enabled: 1.0,
            normal_enabled: 0.0,
            roughness_enabled: 0.0,
            metalness_enabled: 0.0,

            emission_enabled: 0.0,
            blend_mode: 0,
            flow: 1.0,
            _pad0: 0.0,

            albedo_color: [1.0, 1.0, 1.0, 1.0],
            normal_color: [0.5, 0.5, 1.0, 1.0],
            roughness_value: 0.5,
            metalness_value: 0.0,
            emission_strength: 0.0,
            _pad1: 0.0,

            emission_color: [1.0, 0.5, 0.0, 1.0],

            virtual_size: VIRTUAL_SIZE as f32,
            tile_size: TILE_SIZE as f32,
            _pad2: [0.0, 0.0],
        }
    }
}

/// Multi-channel PBR compute shader
pub const PBR_SVT_WGSL: &str = r#"
// BINDINGS
@group(0) @binding(0) var page_table: texture_storage_2d<rg32uint, read>;
@group(0) @binding(1) var physical_albedo: texture_storage_2d<rgba8unorm, read_write>;
@group(0) @binding(2) var physical_normal: texture_storage_2d<rgba8unorm, read_write>;
@group(0) @binding(3) var physical_roughness: texture_storage_2d<rgba8unorm, read_write>;
@group(0) @binding(4) var physical_metalness: texture_storage_2d<rgba8unorm, read_write>;
@group(0) @binding(5) var physical_emission: texture_storage_2d<rgba8unorm, read_write>;

struct PbrBrushParams {
    center_uv: vec2<f32>,
    radius: f32,
    hardness: f32,
    
    albedo_enabled: f32,
    normal_enabled: f32,
    roughness_enabled: f32,
    metalness_enabled: f32,
    
    emission_enabled: f32,
    blend_mode: u32,
    flow: f32,
    _pad0: f32,
    
    albedo_color: vec4<f32>,
    normal_color: vec4<f32>,
    roughness_value: f32,
    metalness_value: f32,
    emission_strength: f32,
    _pad1: f32,
    
    emission_color: vec4<f32>,
    
    virtual_size: f32,
    tile_size: f32,
    _pad2: vec2<f32>,
}
@group(0) @binding(6) var<uniform> brush: PbrBrushParams;

// Blend mode implementations
fn blend_normal(base: vec4<f32>, paint: vec4<f32>, alpha: f32) -> vec4<f32> {
    return mix(base, paint, alpha);
}

fn blend_multiply(base: vec4<f32>, paint: vec4<f32>, alpha: f32) -> vec4<f32> {
    let multiplied = base * paint;
    return mix(base, multiplied, alpha);
}

fn blend_add(base: vec4<f32>, paint: vec4<f32>, alpha: f32) -> vec4<f32> {
    let added = min(base + paint, vec4<f32>(1.0));
    return mix(base, added, alpha);
}

fn blend_overlay(base: vec4<f32>, paint: vec4<f32>, alpha: f32) -> vec4<f32> {
    let overlayed = select(
        2.0 * base * paint,
        1.0 - 2.0 * (1.0 - base) * (1.0 - paint),
        base > vec4<f32>(0.5)
    );
    return mix(base, overlayed, alpha);
}

fn blend_screen(base: vec4<f32>, paint: vec4<f32>, alpha: f32) -> vec4<f32> {
    let screened = 1.0 - (1.0 - base) * (1.0 - paint);
    return mix(base, screened, alpha);
}

fn apply_blend(base: vec4<f32>, paint: vec4<f32>, alpha: f32, mode: u32) -> vec4<f32> {
    switch (mode) {
        case 0u: { return blend_normal(base, paint, alpha); }
        case 1u: { return blend_multiply(base, paint, alpha); }
        case 2u: { return blend_add(base, paint, alpha); }
        case 3u: { return blend_overlay(base, paint, alpha); }
        case 4u: { return blend_screen(base, paint, alpha); }
        default: { return blend_normal(base, paint, alpha); }
    }
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let center_px = brush.center_uv * brush.virtual_size;
    
    // Calculate bounding box start (top-left of the brush area)
    let bounds_min_x = max(0.0, center_px.x - brush.radius);
    let bounds_min_y = max(0.0, center_px.y - brush.radius);
    
    // 1. Calculate Virtual Pixel Coordinate by offsetting the invocation ID
    let virtual_px = vec2<f32>(
        f32(id.x) + floor(bounds_min_x),
        f32(id.y) + floor(bounds_min_y)
    );
    
    // Bounds check against virtual size
    if (virtual_px.x >= brush.virtual_size || virtual_px.y >= brush.virtual_size) {
        return;
    }
    
    // Check distance to brush center (radial falloff)
    let dist = distance(virtual_px, center_px);
    
    if (dist > brush.radius) {
        return;
    }
    
    // Calculate alpha based on hardness
    let falloff_start = brush.radius * brush.hardness;
    let alpha = brush.flow * (1.0 - smoothstep(falloff_start, brush.radius, dist));
    
    if (alpha < 0.001) {
        return;
    }

    // 2. SVT LOOKUP
    let page_x = u32(virtual_px.x / brush.tile_size);
    let page_y = u32(virtual_px.y / brush.tile_size);
    let phys_page = textureLoad(page_table, vec2<u32>(page_x, page_y));
    
    // 3. Physical Coordinate Calculation
    let tile_offset_x = u32(virtual_px.x) % u32(brush.tile_size);
    let tile_offset_y = u32(virtual_px.y) % u32(brush.tile_size);
    let phys_coord = vec2<u32>(
        phys_page.x * u32(brush.tile_size) + tile_offset_x,
        phys_page.y * u32(brush.tile_size) + tile_offset_y
    );
    
    // 4. PAINT EACH ENABLED CHANNEL
    
    // Albedo
    if (brush.albedo_enabled > 0.5) {
        let current = textureLoad(physical_albedo, phys_coord);
        let result = apply_blend(current, brush.albedo_color, alpha, brush.blend_mode);
        textureStore(physical_albedo, phys_coord, result);
    }
    
    // Normal
    if (brush.normal_enabled > 0.5) {
        let current = textureLoad(physical_normal, phys_coord);
        let result = apply_blend(current, brush.normal_color, alpha, brush.blend_mode);
        textureStore(physical_normal, phys_coord, result);
    }
    
    // Roughness (stored as grayscale in R channel)
    if (brush.roughness_enabled > 0.5) {
        let current = textureLoad(physical_roughness, phys_coord);
        let paint = vec4<f32>(brush.roughness_value, brush.roughness_value, brush.roughness_value, 1.0);
        let result = apply_blend(current, paint, alpha, brush.blend_mode);
        textureStore(physical_roughness, phys_coord, result);
    }
    
    // Metalness (stored as grayscale in R channel)
    if (brush.metalness_enabled > 0.5) {
        let current = textureLoad(physical_metalness, phys_coord);
        let paint = vec4<f32>(brush.metalness_value, brush.metalness_value, brush.metalness_value, 1.0);
        let result = apply_blend(current, paint, alpha, brush.blend_mode);
        textureStore(physical_metalness, phys_coord, result);
    }
    
    // Emission
    if (brush.emission_enabled > 0.5) {
        let current = textureLoad(physical_emission, phys_coord);
        let paint = brush.emission_color * brush.emission_strength;
        let result = apply_blend(current, paint, alpha, brush.blend_mode);
        textureStore(physical_emission, phys_coord, result);
    }
}
"#;

/// Multi-channel SVT Engine for PBR painting
pub struct SvtPbrEngine {
    pub page_table_texture: wgpu::Texture,
    pub page_table_view: wgpu::TextureView,

    // Separate textures for each PBR channel
    pub albedo_texture: wgpu::Texture,
    pub albedo_view: wgpu::TextureView,

    pub normal_texture: wgpu::Texture,
    pub normal_view: wgpu::TextureView,

    pub roughness_texture: wgpu::Texture,
    pub roughness_view: wgpu::TextureView,

    pub metalness_texture: wgpu::Texture,
    pub metalness_view: wgpu::TextureView,

    pub emission_texture: wgpu::Texture,
    pub emission_view: wgpu::TextureView,

    pub bind_group_layout: wgpu::BindGroupLayout,
    pub compute_pipeline: wgpu::ComputePipeline,

    // Configuration
    pub virtual_width: u32,
    pub virtual_height: u32,
    pub physical_size: u32,
    pub tile_size: u32,
}

impl SvtPbrEngine {
    pub fn new(
        device: &wgpu::Device,
        virtual_width: u32,
        virtual_height: u32,
        physical_size: u32,
        tile_size: u32,
    ) -> Self {
        let page_table_size = virtual_width / tile_size;

        // 1. Create Page Table (Indirection)
        let page_table_texture = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("SVT PBR Page Table"),
            size: wgpu::Extent3d {
                width: page_table_size,
                height: page_table_size,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::Rg32Uint,
            usage: wgpu::TextureUsages::STORAGE_BINDING
                | wgpu::TextureUsages::TEXTURE_BINDING
                | wgpu::TextureUsages::COPY_DST,
            view_formats: &[],
        });
        let page_table_view =
            page_table_texture.create_view(&wgpu::TextureViewDescriptor::default());

        // Helper to create a physical texture
        let create_physical_texture = |label: &str| -> (wgpu::Texture, wgpu::TextureView) {
            let tex = device.create_texture(&wgpu::TextureDescriptor {
                label: Some(label),
                size: wgpu::Extent3d {
                    width: physical_size,
                    height: physical_size,
                    depth_or_array_layers: 1,
                },
                mip_level_count: 1,
                sample_count: 1,
                dimension: wgpu::TextureDimension::D2,
                format: wgpu::TextureFormat::Rgba8Unorm,
                usage: wgpu::TextureUsages::STORAGE_BINDING
                    | wgpu::TextureUsages::TEXTURE_BINDING
                    | wgpu::TextureUsages::COPY_SRC
                    | wgpu::TextureUsages::COPY_DST,
                view_formats: &[],
            });
            let view = tex.create_view(&wgpu::TextureViewDescriptor::default());
            (tex, view)
        };

        // 2. Create Physical Textures for each channel
        let (albedo_texture, albedo_view) = create_physical_texture("SVT PBR Albedo");
        let (normal_texture, normal_view) = create_physical_texture("SVT PBR Normal");
        let (roughness_texture, roughness_view) = create_physical_texture("SVT PBR Roughness");
        let (metalness_texture, metalness_view) = create_physical_texture("SVT PBR Metalness");
        let (emission_texture, emission_view) = create_physical_texture("SVT PBR Emission");

        // 3. Shader Bindings
        let bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("SVT PBR Bind Group Layout"),
            entries: &[
                // Page table (binding 0)
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::StorageTexture {
                        access: wgpu::StorageTextureAccess::ReadOnly,
                        format: wgpu::TextureFormat::Rg32Uint,
                        view_dimension: wgpu::TextureViewDimension::D2,
                    },
                    count: None,
                },
                // Albedo (binding 1)
                wgpu::BindGroupLayoutEntry {
                    binding: 1,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::StorageTexture {
                        access: wgpu::StorageTextureAccess::ReadWrite,
                        format: wgpu::TextureFormat::Rgba8Unorm,
                        view_dimension: wgpu::TextureViewDimension::D2,
                    },
                    count: None,
                },
                // Normal (binding 2)
                wgpu::BindGroupLayoutEntry {
                    binding: 2,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::StorageTexture {
                        access: wgpu::StorageTextureAccess::ReadWrite,
                        format: wgpu::TextureFormat::Rgba8Unorm,
                        view_dimension: wgpu::TextureViewDimension::D2,
                    },
                    count: None,
                },
                // Roughness (binding 3)
                wgpu::BindGroupLayoutEntry {
                    binding: 3,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::StorageTexture {
                        access: wgpu::StorageTextureAccess::ReadWrite,
                        format: wgpu::TextureFormat::Rgba8Unorm,
                        view_dimension: wgpu::TextureViewDimension::D2,
                    },
                    count: None,
                },
                // Metalness (binding 4)
                wgpu::BindGroupLayoutEntry {
                    binding: 4,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::StorageTexture {
                        access: wgpu::StorageTextureAccess::ReadWrite,
                        format: wgpu::TextureFormat::Rgba8Unorm,
                        view_dimension: wgpu::TextureViewDimension::D2,
                    },
                    count: None,
                },
                // Emission (binding 5)
                wgpu::BindGroupLayoutEntry {
                    binding: 5,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::StorageTexture {
                        access: wgpu::StorageTextureAccess::ReadWrite,
                        format: wgpu::TextureFormat::Rgba8Unorm,
                        view_dimension: wgpu::TextureViewDimension::D2,
                    },
                    count: None,
                },
                // Brush params uniform (binding 6)
                wgpu::BindGroupLayoutEntry {
                    binding: 6,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
            ],
        });

        // 4. Create Pipeline
        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("SVT PBR Compute Shader"),
            source: wgpu::ShaderSource::Wgsl(Cow::Borrowed(PBR_SVT_WGSL)),
        });

        let compute_pipeline = device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
            label: Some("SVT PBR Pipeline"),
            layout: Some(
                &device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                    label: Some("SVT PBR Layout"),
                    bind_group_layouts: &[&bind_group_layout],
                    push_constant_ranges: &[],
                }),
            ),
            module: &shader,
            entry_point: Some("main"),
            compilation_options: Default::default(),
            cache: None,
        });

        Self {
            page_table_texture,
            page_table_view,
            albedo_texture,
            albedo_view,
            normal_texture,
            normal_view,
            roughness_texture,
            roughness_view,
            metalness_texture,
            metalness_view,
            emission_texture,
            emission_view,
            bind_group_layout,
            compute_pipeline,
            virtual_width,
            virtual_height,
            physical_size,
            tile_size,
        }
    }

    /// Get texture and view for a specific channel
    pub fn get_channel_texture(&self, channel: PbrChannel) -> (&wgpu::Texture, &wgpu::TextureView) {
        match channel {
            PbrChannel::Albedo => (&self.albedo_texture, &self.albedo_view),
            PbrChannel::Normal => (&self.normal_texture, &self.normal_view),
            PbrChannel::Roughness => (&self.roughness_texture, &self.roughness_view),
            PbrChannel::Metalness => (&self.metalness_texture, &self.metalness_view),
            PbrChannel::Emission => (&self.emission_texture, &self.emission_view),
        }
    }

    /// Dispatch a PBR paint stroke
    pub fn dispatch_stroke(
        &self,
        device: &wgpu::Device,
        _queue: &wgpu::Queue,
        encoder: &mut wgpu::CommandEncoder,
        brush_params: &PbrBrushParams,
    ) {
        // 1. Upload Brush Params
        let params_bytes = bytemuck::bytes_of(brush_params);
        let brush_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("SVT PBR Brush Params"),
            contents: params_bytes,
            usage: wgpu::BufferUsages::UNIFORM,
        });

        // 2. Create BindGroup for this dispatch
        let bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("SVT PBR Stroke Bind Group"),
            layout: &self.bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: wgpu::BindingResource::TextureView(&self.page_table_view),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: wgpu::BindingResource::TextureView(&self.albedo_view),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: wgpu::BindingResource::TextureView(&self.normal_view),
                },
                wgpu::BindGroupEntry {
                    binding: 3,
                    resource: wgpu::BindingResource::TextureView(&self.roughness_view),
                },
                wgpu::BindGroupEntry {
                    binding: 4,
                    resource: wgpu::BindingResource::TextureView(&self.metalness_view),
                },
                wgpu::BindGroupEntry {
                    binding: 5,
                    resource: wgpu::BindingResource::TextureView(&self.emission_view),
                },
                wgpu::BindGroupEntry {
                    binding: 6,
                    resource: brush_buffer.as_entire_binding(),
                },
            ],
        });

        // 3. Dispatch
        let mut cpass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
            label: Some("SVT PBR Paint Pass"),
            timestamp_writes: None,
        });
        cpass.set_pipeline(&self.compute_pipeline);
        cpass.set_bind_group(0, &bind_group, &[]);

        // Dispatch enough workgroups to cover the brush's bounding box
        let brush_pixels = (brush_params.radius * 2.0).ceil() as u32;
        // Add 1 to ensure we cover any fractional edges, then divide by workgroup size (8)
        let workgroups = ((brush_pixels + 8) / 8).max(1).min(65535);

        cpass.dispatch_workgroups(workgroups, workgroups, 1);
    }

    /// Clear a specific channel to its default value
    pub fn clear_channel(&self, _device: &wgpu::Device, queue: &wgpu::Queue, channel: PbrChannel) {
        let (texture, _) = self.get_channel_texture(channel);
        let default_color = channel.default_color();

        // Create a buffer with the default color
        let pixel_count = (self.physical_size * self.physical_size) as usize;
        let mut data = Vec::with_capacity(pixel_count * 4);
        for _ in 0..pixel_count {
            data.push((default_color[0] * 255.0) as u8);
            data.push((default_color[1] * 255.0) as u8);
            data.push((default_color[2] * 255.0) as u8);
            data.push((default_color[3] * 255.0) as u8);
        }

        queue.write_texture(
            wgpu::TexelCopyTextureInfo {
                texture,
                mip_level: 0,
                origin: wgpu::Origin3d::ZERO,
                aspect: wgpu::TextureAspect::All,
            },
            &data,
            wgpu::TexelCopyBufferLayout {
                offset: 0,
                bytes_per_row: Some(self.physical_size * 4),
                rows_per_image: Some(self.physical_size),
            },
            wgpu::Extent3d {
                width: self.physical_size,
                height: self.physical_size,
                depth_or_array_layers: 1,
            },
        );
    }

    /// Clear all channels to their default values
    pub fn clear_all(&self, device: &wgpu::Device, queue: &wgpu::Queue) {
        self.clear_channel(device, queue, PbrChannel::Albedo);
        self.clear_channel(device, queue, PbrChannel::Normal);
        self.clear_channel(device, queue, PbrChannel::Roughness);
        self.clear_channel(device, queue, PbrChannel::Metalness);
        self.clear_channel(device, queue, PbrChannel::Emission);
    }
}
