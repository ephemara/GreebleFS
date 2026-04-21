use image::{Rgba, RgbaImage};

use crate::audio_commands::AudioWaveformBucket;
use crate::gpu_runtime::resources::GpuRuntimeResources;
use crate::gpu_runtime::types::{GpuEffectiveTier, KernelSource};

#[repr(C)]
#[derive(Debug, Clone, Copy, bytemuck::Pod, bytemuck::Zeroable)]
struct AudioWaveformParams {
    sample_count: u32,
    bucket_count: u32,
    _padding0: u32,
    _padding1: u32,
}

#[repr(C)]
#[derive(Debug, Clone, Copy, bytemuck::Pod, bytemuck::Zeroable)]
struct AudioWaveformResult {
    peak: f32,
    rms: f32,
}

#[repr(C)]
#[derive(Debug, Clone, Copy, bytemuck::Pod, bytemuck::Zeroable)]
struct AudioSpectralParams {
    sample_count: u32,
    band_count: u32,
    _padding0: u32,
    _padding1: u32,
}

#[repr(C)]
#[derive(Debug, Clone, Copy, bytemuck::Pod, bytemuck::Zeroable)]
struct AudioSpectrogramParams {
    sample_count: u32,
    image_width: u32,
    image_height: u32,
    window_size: u32,
}

const WAVEFORM_SHADER: &str = include_str!("../kernels/audio_waveform_reduce.wgsl");
const SPECTRAL_SHADER: &str = include_str!("../kernels/audio_spectral_bands.wgsl");
const SPECTROGRAM_SHADER: &str = include_str!("../kernels/audio_spectrogram_render.wgsl");

pub(crate) fn reduce_waveform_buckets(
    resources: &GpuRuntimeResources,
    mono_samples: &[f32],
    bucket_count: usize,
    tier: GpuEffectiveTier,
) -> Result<Vec<AudioWaveformBucket>, String> {
    if mono_samples.is_empty() || bucket_count == 0 {
        return Ok(Vec::new());
    }

    let max_samples = match tier {
        GpuEffectiveTier::Integrated => 2_000_000usize,
        GpuEffectiveTier::Discrete => 8_000_000usize,
        GpuEffectiveTier::Safe => 0,
    };
    if mono_samples.len() > max_samples {
        return Err("GPU waveform workload exceeded the current tier budget.".to_string());
    }

    let shader =
        resources.shader_module("audio_waveform_reduce", KernelSource::Wgsl(WAVEFORM_SHADER))?;
    let bind_group_layout =
        resources
            .device()
            .create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
                label: Some("greeblefs-audio-waveform-layout"),
                entries: &[
                    wgpu::BindGroupLayoutEntry {
                        binding: 0,
                        visibility: wgpu::ShaderStages::COMPUTE,
                        ty: wgpu::BindingType::Buffer {
                            ty: wgpu::BufferBindingType::Storage { read_only: true },
                            has_dynamic_offset: false,
                            min_binding_size: None,
                        },
                        count: None,
                    },
                    wgpu::BindGroupLayoutEntry {
                        binding: 1,
                        visibility: wgpu::ShaderStages::COMPUTE,
                        ty: wgpu::BindingType::Buffer {
                            ty: wgpu::BufferBindingType::Storage { read_only: false },
                            has_dynamic_offset: false,
                            min_binding_size: None,
                        },
                        count: None,
                    },
                    wgpu::BindGroupLayoutEntry {
                        binding: 2,
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
                label: Some("greeblefs-audio-waveform-pipeline-layout"),
                bind_group_layouts: &[&bind_group_layout],
                push_constant_ranges: &[],
            });
    let pipeline = resources
        .device()
        .create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
            label: Some("greeblefs-audio-waveform-pipeline"),
            layout: Some(&pipeline_layout),
            module: &shader,
            entry_point: Some("main"),
            compilation_options: Default::default(),
            cache: None,
        });

    let input_buffer = resources.create_storage_buffer_from_bytes(
        "greeblefs-audio-waveform-input",
        bytemuck::cast_slice(mono_samples),
    )?;
    let output_size = (bucket_count * std::mem::size_of::<AudioWaveformResult>()) as u64;
    let output_buffer =
        resources.create_zeroed_storage_buffer("greeblefs-audio-waveform-output", output_size)?;
    let params = AudioWaveformParams {
        sample_count: mono_samples.len() as u32,
        bucket_count: bucket_count as u32,
        _padding0: 0,
        _padding1: 0,
    };
    let params_buffer = resources.create_uniform_buffer("greeblefs-audio-waveform-params", &params);

    let bind_group = resources
        .device()
        .create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("greeblefs-audio-waveform-bind-group"),
            layout: &bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: input_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: output_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: params_buffer.as_entire_binding(),
                },
            ],
        });

    let mut encoder = resources
        .device()
        .create_command_encoder(&wgpu::CommandEncoderDescriptor {
            label: Some("greeblefs-audio-waveform-encoder"),
        });
    {
        let mut pass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
            label: Some("greeblefs-audio-waveform-pass"),
            timestamp_writes: None,
        });
        pass.set_pipeline(&pipeline);
        pass.set_bind_group(0, &bind_group, &[]);
        pass.dispatch_workgroups((bucket_count as u32).div_ceil(64), 1, 1);
    }
    resources.queue().submit(std::iter::once(encoder.finish()));

    let bytes = resources.read_buffer(&output_buffer, output_size)?;
    let results: &[AudioWaveformResult] = bytemuck::cast_slice(&bytes);
    Ok(results
        .iter()
        .enumerate()
        .map(|(index, result)| AudioWaveformBucket {
            index: index as u32,
            peak_level: result.peak as f64,
            rms_level: result.rms as f64,
        })
        .collect())
}

pub(crate) fn reduce_spectral_bands(
    resources: &GpuRuntimeResources,
    fft_samples: &[f32],
    band_count: usize,
    tier: GpuEffectiveTier,
) -> Result<Vec<f64>, String> {
    if fft_samples.is_empty() || band_count == 0 {
        return Ok(Vec::new());
    }

    let max_fft = match tier {
        GpuEffectiveTier::Integrated => 4096usize,
        GpuEffectiveTier::Discrete => 8192usize,
        GpuEffectiveTier::Safe => 0,
    };
    if fft_samples.len() > max_fft {
        return Err("GPU spectral workload exceeded the current tier budget.".to_string());
    }

    let shader =
        resources.shader_module("audio_spectral_bands", KernelSource::Wgsl(SPECTRAL_SHADER))?;
    let bind_group_layout =
        resources
            .device()
            .create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
                label: Some("greeblefs-audio-spectral-layout"),
                entries: &[
                    wgpu::BindGroupLayoutEntry {
                        binding: 0,
                        visibility: wgpu::ShaderStages::COMPUTE,
                        ty: wgpu::BindingType::Buffer {
                            ty: wgpu::BufferBindingType::Storage { read_only: true },
                            has_dynamic_offset: false,
                            min_binding_size: None,
                        },
                        count: None,
                    },
                    wgpu::BindGroupLayoutEntry {
                        binding: 1,
                        visibility: wgpu::ShaderStages::COMPUTE,
                        ty: wgpu::BindingType::Buffer {
                            ty: wgpu::BufferBindingType::Storage { read_only: false },
                            has_dynamic_offset: false,
                            min_binding_size: None,
                        },
                        count: None,
                    },
                    wgpu::BindGroupLayoutEntry {
                        binding: 2,
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
                label: Some("greeblefs-audio-spectral-pipeline-layout"),
                bind_group_layouts: &[&bind_group_layout],
                push_constant_ranges: &[],
            });
    let pipeline = resources
        .device()
        .create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
            label: Some("greeblefs-audio-spectral-pipeline"),
            layout: Some(&pipeline_layout),
            module: &shader,
            entry_point: Some("main"),
            compilation_options: Default::default(),
            cache: None,
        });

    let input_buffer = resources.create_storage_buffer_from_bytes(
        "greeblefs-audio-spectral-input",
        bytemuck::cast_slice(fft_samples),
    )?;
    let output_size = (band_count * std::mem::size_of::<f32>()) as u64;
    let output_buffer =
        resources.create_zeroed_storage_buffer("greeblefs-audio-spectral-output", output_size)?;
    let params = AudioSpectralParams {
        sample_count: fft_samples.len() as u32,
        band_count: band_count as u32,
        _padding0: 0,
        _padding1: 0,
    };
    let params_buffer = resources.create_uniform_buffer("greeblefs-audio-spectral-params", &params);
    let bind_group = resources
        .device()
        .create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("greeblefs-audio-spectral-bind-group"),
            layout: &bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: input_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: output_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: params_buffer.as_entire_binding(),
                },
            ],
        });

    let mut encoder = resources
        .device()
        .create_command_encoder(&wgpu::CommandEncoderDescriptor {
            label: Some("greeblefs-audio-spectral-encoder"),
        });
    {
        let mut pass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
            label: Some("greeblefs-audio-spectral-pass"),
            timestamp_writes: None,
        });
        pass.set_pipeline(&pipeline);
        pass.set_bind_group(0, &bind_group, &[]);
        pass.dispatch_workgroups((band_count as u32).div_ceil(64), 1, 1);
    }
    resources.queue().submit(std::iter::once(encoder.finish()));

    let bytes = resources.read_buffer(&output_buffer, output_size)?;
    let raw_values: &[f32] = bytemuck::cast_slice(&bytes);
    let mut values = raw_values
        .iter()
        .map(|value| *value as f64)
        .collect::<Vec<_>>();
    let max_value = values.iter().copied().fold(0.0f64, f64::max);
    if max_value > 0.0 {
        values.iter_mut().for_each(|value| *value /= max_value);
    }
    Ok(values)
}

pub(crate) fn render_spectrogram(
    resources: &GpuRuntimeResources,
    mono_samples: &[f32],
    width: u32,
    height: u32,
    tier: GpuEffectiveTier,
) -> Result<RgbaImage, String> {
    if mono_samples.is_empty() || width == 0 || height == 0 {
        return Ok(RgbaImage::from_pixel(
            width.max(1),
            height.max(1),
            Rgba([0, 0, 0, 255]),
        ));
    }

    let window_size = match tier {
        GpuEffectiveTier::Integrated => 512u32,
        GpuEffectiveTier::Discrete => 1024u32,
        GpuEffectiveTier::Safe => 0,
    };
    let max_samples = match tier {
        GpuEffectiveTier::Integrated => 2_000_000usize,
        GpuEffectiveTier::Discrete => 8_000_000usize,
        GpuEffectiveTier::Safe => 0,
    };
    if mono_samples.len() > max_samples {
        return Err("GPU spectrogram workload exceeded the current tier budget.".to_string());
    }

    let shader = resources.shader_module(
        "audio_spectrogram_render",
        KernelSource::Wgsl(SPECTROGRAM_SHADER),
    )?;
    let bind_group_layout =
        resources
            .device()
            .create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
                label: Some("greeblefs-audio-spectrogram-layout"),
                entries: &[
                    wgpu::BindGroupLayoutEntry {
                        binding: 0,
                        visibility: wgpu::ShaderStages::COMPUTE,
                        ty: wgpu::BindingType::Buffer {
                            ty: wgpu::BufferBindingType::Storage { read_only: true },
                            has_dynamic_offset: false,
                            min_binding_size: None,
                        },
                        count: None,
                    },
                    wgpu::BindGroupLayoutEntry {
                        binding: 1,
                        visibility: wgpu::ShaderStages::COMPUTE,
                        ty: wgpu::BindingType::StorageTexture {
                            access: wgpu::StorageTextureAccess::WriteOnly,
                            format: wgpu::TextureFormat::Rgba8Unorm,
                            view_dimension: wgpu::TextureViewDimension::D2,
                        },
                        count: None,
                    },
                    wgpu::BindGroupLayoutEntry {
                        binding: 2,
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
                label: Some("greeblefs-audio-spectrogram-pipeline-layout"),
                bind_group_layouts: &[&bind_group_layout],
                push_constant_ranges: &[],
            });
    let pipeline = resources
        .device()
        .create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
            label: Some("greeblefs-audio-spectrogram-pipeline"),
            layout: Some(&pipeline_layout),
            module: &shader,
            entry_point: Some("main"),
            compilation_options: Default::default(),
            cache: None,
        });

    let input_buffer = resources.create_storage_buffer_from_bytes(
        "greeblefs-audio-spectrogram-input",
        bytemuck::cast_slice(mono_samples),
    )?;
    let output_texture = resources.create_storage_rgba_texture(
        "greeblefs-audio-spectrogram-output",
        width,
        height,
    )?;
    let output_view = output_texture.create_view(&Default::default());
    let params = AudioSpectrogramParams {
        sample_count: mono_samples.len() as u32,
        image_width: width,
        image_height: height,
        window_size,
    };
    let params_buffer =
        resources.create_uniform_buffer("greeblefs-audio-spectrogram-params", &params);
    let bind_group = resources
        .device()
        .create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("greeblefs-audio-spectrogram-bind-group"),
            layout: &bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: input_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: wgpu::BindingResource::TextureView(&output_view),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: params_buffer.as_entire_binding(),
                },
            ],
        });

    let mut encoder = resources
        .device()
        .create_command_encoder(&wgpu::CommandEncoderDescriptor {
            label: Some("greeblefs-audio-spectrogram-encoder"),
        });
    {
        let mut pass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
            label: Some("greeblefs-audio-spectrogram-pass"),
            timestamp_writes: None,
        });
        pass.set_pipeline(&pipeline);
        pass.set_bind_group(0, &bind_group, &[]);
        pass.dispatch_workgroups(width.div_ceil(8), height.div_ceil(8), 1);
    }
    resources.queue().submit(std::iter::once(encoder.finish()));

    resources.read_rgba_texture(&output_texture, width, height)
}
