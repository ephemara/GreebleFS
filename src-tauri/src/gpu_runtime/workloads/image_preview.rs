use image::RgbaImage;

use crate::gpu_runtime::resources::GpuRuntimeResources;
use crate::gpu_runtime::types::{GpuEffectiveTier, KernelSource};
use crate::image_commands::ImageAdjustmentState;

#[repr(C)]
#[derive(Debug, Clone, Copy, bytemuck::Pod, bytemuck::Zeroable)]
struct ImagePreviewParams {
    src_width: u32,
    src_height: u32,
    dst_width: u32,
    dst_height: u32,
    brightness: f32,
    contrast: f32,
    saturation: f32,
    temperature: f32,
    highlights: f32,
    shadows: f32,
    vignette: f32,
    _padding0: f32,
}

const IMAGE_PREVIEW_SHADER: &str = include_str!("../kernels/image_preview_filter.wgsl");

pub(crate) fn render_image_preview(
    resources: &GpuRuntimeResources,
    source: &RgbaImage,
    target_width: u32,
    target_height: u32,
    effective_state: ImageAdjustmentState,
    tier: GpuEffectiveTier,
) -> Result<RgbaImage, String> {
    if target_width == 0 || target_height == 0 {
        return Err("GPU image preview target bounds must be greater than zero.".to_string());
    }

    let max_pixels = match tier {
        GpuEffectiveTier::Integrated => 4_194_304u64,
        GpuEffectiveTier::Discrete => 16_777_216u64,
        GpuEffectiveTier::Safe => 0,
    };
    if (target_width as u64 * target_height as u64) > max_pixels {
        return Err("GPU image preview workload exceeded the current tier budget.".to_string());
    }

    let shader = resources.shader_module(
        "image_preview_filter",
        KernelSource::Wgsl(IMAGE_PREVIEW_SHADER),
    )?;
    let bind_group_layout =
        resources
            .device()
            .create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
                label: Some("greeblefs-image-preview-layout"),
                entries: &[
                    wgpu::BindGroupLayoutEntry {
                        binding: 0,
                        visibility: wgpu::ShaderStages::COMPUTE,
                        ty: wgpu::BindingType::Texture {
                            sample_type: wgpu::TextureSampleType::Float { filterable: true },
                            view_dimension: wgpu::TextureViewDimension::D2,
                            multisampled: false,
                        },
                        count: None,
                    },
                    wgpu::BindGroupLayoutEntry {
                        binding: 1,
                        visibility: wgpu::ShaderStages::COMPUTE,
                        ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering),
                        count: None,
                    },
                    wgpu::BindGroupLayoutEntry {
                        binding: 2,
                        visibility: wgpu::ShaderStages::COMPUTE,
                        ty: wgpu::BindingType::StorageTexture {
                            access: wgpu::StorageTextureAccess::WriteOnly,
                            format: wgpu::TextureFormat::Rgba8Unorm,
                            view_dimension: wgpu::TextureViewDimension::D2,
                        },
                        count: None,
                    },
                    wgpu::BindGroupLayoutEntry {
                        binding: 3,
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

    let pipeline_layout =
        resources
            .device()
            .create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                label: Some("greeblefs-image-preview-pipeline-layout"),
                bind_group_layouts: &[&bind_group_layout],
                push_constant_ranges: &[],
            });
    let pipeline = resources
        .device()
        .create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
            label: Some("greeblefs-image-preview-pipeline"),
            layout: Some(&pipeline_layout),
            module: &shader,
            entry_point: Some("main"),
            compilation_options: Default::default(),
            cache: None,
        });

    let input_texture =
        resources.create_sampled_rgba_texture("greeblefs-image-preview-input", source)?;
    let output_texture = resources.create_storage_rgba_texture(
        "greeblefs-image-preview-output",
        target_width,
        target_height,
    )?;
    let input_view = input_texture.create_view(&Default::default());
    let output_view = output_texture.create_view(&Default::default());
    let sampler = resources.create_linear_sampler("greeblefs-image-preview-sampler");
    let params = ImagePreviewParams {
        src_width: source.width(),
        src_height: source.height(),
        dst_width: target_width,
        dst_height: target_height,
        brightness: effective_state.brightness,
        contrast: effective_state.contrast,
        saturation: effective_state.saturation,
        temperature: effective_state.temperature,
        highlights: effective_state.highlights,
        shadows: effective_state.shadows,
        vignette: effective_state.vignette,
        _padding0: 0.0,
    };
    let params_buffer = resources.create_uniform_buffer("greeblefs-image-preview-params", &params);

    let bind_group = resources
        .device()
        .create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("greeblefs-image-preview-bind-group"),
            layout: &bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: wgpu::BindingResource::TextureView(&input_view),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: wgpu::BindingResource::Sampler(&sampler),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: wgpu::BindingResource::TextureView(&output_view),
                },
                wgpu::BindGroupEntry {
                    binding: 3,
                    resource: params_buffer.as_entire_binding(),
                },
            ],
        });

    let mut encoder = resources
        .device()
        .create_command_encoder(&wgpu::CommandEncoderDescriptor {
            label: Some("greeblefs-image-preview-encoder"),
        });
    {
        let mut pass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
            label: Some("greeblefs-image-preview-pass"),
            timestamp_writes: None,
        });
        pass.set_pipeline(&pipeline);
        pass.set_bind_group(0, &bind_group, &[]);
        pass.dispatch_workgroups(target_width.div_ceil(8), target_height.div_ceil(8), 1);
    }
    resources.queue().submit(std::iter::once(encoder.finish()));

    resources.read_rgba_texture(&output_texture, target_width, target_height)
}
