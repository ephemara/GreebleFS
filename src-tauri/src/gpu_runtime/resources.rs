use std::collections::HashMap;
use std::sync::{mpsc, Arc, Mutex};

use image::RgbaImage;
use wgpu::util::DeviceExt;

use super::capabilities::{GpuAdapterProbe, GpuCapabilityProfile};
use super::types::{GpuEffectiveTier, KernelSource};

pub(crate) struct GpuRuntimeResources {
    #[allow(dead_code)]
    instance: wgpu::Instance,
    #[allow(dead_code)]
    adapter: wgpu::Adapter,
    device: wgpu::Device,
    queue: wgpu::Queue,
    profile: GpuCapabilityProfile,
    shader_modules: Mutex<HashMap<&'static str, Arc<wgpu::ShaderModule>>>,
}

impl GpuRuntimeResources {
    pub(crate) fn from_probe(
        probe: GpuAdapterProbe,
        effective_tier: GpuEffectiveTier,
    ) -> Result<Self, String> {
        let memory_hints = match effective_tier {
            GpuEffectiveTier::Discrete => wgpu::MemoryHints::Performance,
            GpuEffectiveTier::Integrated | GpuEffectiveTier::Safe => wgpu::MemoryHints::MemoryUsage,
        };

        let (device, queue) =
            pollster::block_on(probe.adapter.request_device(&wgpu::DeviceDescriptor {
                label: Some("greeblefs-native-gpu-runtime"),
                required_features: wgpu::Features::empty(),
                required_limits: probe.adapter.limits(),
                memory_hints,
                trace: wgpu::Trace::Off,
            }))
            .map_err(|error| format!("Failed to create GPU device: {error}"))?;

        device.on_uncaptured_error(Box::new(|error| {
            log::error!("GreebleFS GPU runtime uncaptured wgpu error: {error}");
        }));

        Ok(Self {
            instance: probe.instance,
            adapter: probe.adapter,
            device,
            queue,
            profile: probe.profile,
            shader_modules: Mutex::new(HashMap::new()),
        })
    }

    pub(crate) fn device(&self) -> &wgpu::Device {
        &self.device
    }

    pub(crate) fn queue(&self) -> &wgpu::Queue {
        &self.queue
    }

    pub(crate) fn shader_module(
        &self,
        label: &'static str,
        source: KernelSource,
    ) -> Result<Arc<wgpu::ShaderModule>, String> {
        if let Some(existing) = self
            .shader_modules
            .lock()
            .expect("gpu shader module cache poisoned")
            .get(label)
            .cloned()
        {
            return Ok(existing);
        }

        let descriptor = match source {
            KernelSource::Wgsl(source) => wgpu::ShaderModuleDescriptor {
                label: Some(label),
                source: wgpu::ShaderSource::Wgsl(source.into()),
            },
            KernelSource::Spirv(_words) => {
                return Err(
                    "SPIR-V kernel ingestion is reserved for a later runtime revision.".to_string(),
                )
            }
        };

        let module = Arc::new(self.device.create_shader_module(descriptor));
        self.shader_modules
            .lock()
            .expect("gpu shader module cache poisoned")
            .insert(label, module.clone());
        Ok(module)
    }

    pub(crate) fn create_sampled_rgba_texture(
        &self,
        label: &str,
        image: &RgbaImage,
    ) -> Result<wgpu::Texture, String> {
        self.ensure_texture_extent(label, image.width(), image.height())?;
        let texture = self.device.create_texture(&wgpu::TextureDescriptor {
            label: Some(label),
            size: wgpu::Extent3d {
                width: image.width(),
                height: image.height(),
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::Rgba8Unorm,
            usage: wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST,
            view_formats: &[],
        });

        self.queue.write_texture(
            wgpu::TexelCopyTextureInfo {
                texture: &texture,
                mip_level: 0,
                origin: wgpu::Origin3d::ZERO,
                aspect: wgpu::TextureAspect::All,
            },
            image.as_raw(),
            wgpu::TexelCopyBufferLayout {
                offset: 0,
                bytes_per_row: Some(image.width() * 4),
                rows_per_image: Some(image.height()),
            },
            wgpu::Extent3d {
                width: image.width(),
                height: image.height(),
                depth_or_array_layers: 1,
            },
        );

        Ok(texture)
    }

    pub(crate) fn create_storage_rgba_texture(
        &self,
        label: &str,
        width: u32,
        height: u32,
    ) -> Result<wgpu::Texture, String> {
        self.ensure_texture_extent(label, width, height)?;
        Ok(self.device.create_texture(&wgpu::TextureDescriptor {
            label: Some(label),
            size: wgpu::Extent3d {
                width,
                height,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::Rgba8Unorm,
            usage: wgpu::TextureUsages::STORAGE_BINDING | wgpu::TextureUsages::COPY_SRC,
            view_formats: &[],
        }))
    }

    pub(crate) fn create_linear_sampler(&self, label: &str) -> wgpu::Sampler {
        self.device.create_sampler(&wgpu::SamplerDescriptor {
            label: Some(label),
            mag_filter: wgpu::FilterMode::Linear,
            min_filter: wgpu::FilterMode::Linear,
            mipmap_filter: wgpu::FilterMode::Nearest,
            address_mode_u: wgpu::AddressMode::ClampToEdge,
            address_mode_v: wgpu::AddressMode::ClampToEdge,
            address_mode_w: wgpu::AddressMode::ClampToEdge,
            ..Default::default()
        })
    }

    pub(crate) fn create_uniform_buffer<T: bytemuck::Pod>(
        &self,
        label: &str,
        data: &T,
    ) -> wgpu::Buffer {
        self.device
            .create_buffer_init(&wgpu::util::BufferInitDescriptor {
                label: Some(label),
                contents: bytemuck::bytes_of(data),
                usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
            })
    }

    pub(crate) fn create_storage_buffer_from_bytes(
        &self,
        label: &str,
        bytes: &[u8],
    ) -> Result<wgpu::Buffer, String> {
        self.ensure_storage_buffer_size(label, bytes.len() as u64)?;
        Ok(self
            .device
            .create_buffer_init(&wgpu::util::BufferInitDescriptor {
                label: Some(label),
                contents: bytes,
                usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_DST,
            }))
    }

    pub(crate) fn create_zeroed_storage_buffer(
        &self,
        label: &str,
        size: u64,
    ) -> Result<wgpu::Buffer, String> {
        self.ensure_storage_buffer_size(label, size)?;
        Ok(self.device.create_buffer(&wgpu::BufferDescriptor {
            label: Some(label),
            size,
            usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_SRC,
            mapped_at_creation: false,
        }))
    }

    pub(crate) fn read_buffer(&self, source: &wgpu::Buffer, size: u64) -> Result<Vec<u8>, String> {
        self.ensure_buffer_size("greeblefs-gpu-readback", size)?;
        let staging_buffer = self.device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("greeblefs-gpu-readback"),
            size,
            usage: wgpu::BufferUsages::COPY_DST | wgpu::BufferUsages::MAP_READ,
            mapped_at_creation: false,
        });

        let mut encoder = self
            .device
            .create_command_encoder(&wgpu::CommandEncoderDescriptor {
                label: Some("greeblefs-gpu-readback-encoder"),
            });
        encoder.copy_buffer_to_buffer(source, 0, &staging_buffer, 0, size);
        self.queue.submit(std::iter::once(encoder.finish()));

        let slice = staging_buffer.slice(..);
        let (tx, rx) = mpsc::channel();
        slice.map_async(wgpu::MapMode::Read, move |result| {
            let _ = tx.send(result);
        });
        let _ = self.device.poll(wgpu::PollType::Wait);
        rx.recv()
            .map_err(|error| format!("Failed to receive GPU buffer readback callback: {error}"))?
            .map_err(|error| format!("Failed to map GPU readback buffer: {error:?}"))?;

        let data = slice.get_mapped_range().to_vec();
        let _ = slice;
        staging_buffer.unmap();
        Ok(data)
    }

    pub(crate) fn read_rgba_texture(
        &self,
        texture: &wgpu::Texture,
        width: u32,
        height: u32,
    ) -> Result<RgbaImage, String> {
        self.ensure_texture_extent("greeblefs-gpu-texture-readback", width, height)?;
        let bytes_per_row = width.saturating_mul(4);
        let padded_bytes_per_row = bytes_per_row.div_ceil(wgpu::COPY_BYTES_PER_ROW_ALIGNMENT)
            * wgpu::COPY_BYTES_PER_ROW_ALIGNMENT;
        let readback_size = padded_bytes_per_row as u64 * height as u64;
        self.ensure_buffer_size("greeblefs-gpu-texture-readback", readback_size)?;

        let staging_buffer = self.device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("greeblefs-gpu-texture-readback"),
            size: readback_size,
            usage: wgpu::BufferUsages::COPY_DST | wgpu::BufferUsages::MAP_READ,
            mapped_at_creation: false,
        });

        let mut encoder = self
            .device
            .create_command_encoder(&wgpu::CommandEncoderDescriptor {
                label: Some("greeblefs-gpu-texture-readback-encoder"),
            });
        encoder.copy_texture_to_buffer(
            wgpu::TexelCopyTextureInfo {
                texture,
                mip_level: 0,
                origin: wgpu::Origin3d::ZERO,
                aspect: wgpu::TextureAspect::All,
            },
            wgpu::TexelCopyBufferInfo {
                buffer: &staging_buffer,
                layout: wgpu::TexelCopyBufferLayout {
                    offset: 0,
                    bytes_per_row: Some(padded_bytes_per_row),
                    rows_per_image: Some(height),
                },
            },
            wgpu::Extent3d {
                width,
                height,
                depth_or_array_layers: 1,
            },
        );
        self.queue.submit(std::iter::once(encoder.finish()));

        let slice = staging_buffer.slice(..);
        let (tx, rx) = mpsc::channel();
        slice.map_async(wgpu::MapMode::Read, move |result| {
            let _ = tx.send(result);
        });
        let _ = self.device.poll(wgpu::PollType::Wait);
        rx.recv()
            .map_err(|error| format!("Failed to receive GPU texture readback callback: {error}"))?
            .map_err(|error| format!("Failed to map GPU texture readback buffer: {error:?}"))?;

        let mapped = slice.get_mapped_range();
        let mut output = Vec::with_capacity((width * height * 4) as usize);
        for row in 0..height {
            let row_offset = row as usize * padded_bytes_per_row as usize;
            output.extend_from_slice(&mapped[row_offset..row_offset + bytes_per_row as usize]);
        }
        drop(mapped);
        staging_buffer.unmap();

        RgbaImage::from_raw(width, height, output)
            .ok_or_else(|| "Failed to reconstruct readback RGBA image.".to_string())
    }

    fn ensure_texture_extent(&self, label: &str, width: u32, height: u32) -> Result<(), String> {
        let max_dimension = self.profile.max_texture_dimension_2d;
        if width > max_dimension || height > max_dimension {
            return Err(format!(
                "GPU resource '{label}' exceeds adapter texture limit ({width}x{height} > {max_dimension})."
            ));
        }
        Ok(())
    }

    fn ensure_storage_buffer_size(&self, label: &str, size: u64) -> Result<(), String> {
        self.ensure_buffer_size(label, size)?;
        let max_storage_binding = self.profile.max_storage_buffer_binding_size as u64;
        if size > max_storage_binding {
            return Err(format!(
                "GPU resource '{label}' exceeds adapter storage binding limit ({size} > {max_storage_binding})."
            ));
        }
        Ok(())
    }

    fn ensure_buffer_size(&self, label: &str, size: u64) -> Result<(), String> {
        if size > self.profile.max_buffer_size {
            return Err(format!(
                "GPU resource '{label}' exceeds adapter buffer limit ({size} > {}).",
                self.profile.max_buffer_size
            ));
        }
        Ok(())
    }
}
