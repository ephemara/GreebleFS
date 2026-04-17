#![cfg(not(target_arch = "wasm32"))]

use image::{imageops::FilterType, DynamicImage, ImageEncoder};
use once_cell::sync::Lazy;
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::device::GpuComputeDevice;

pub static ALPHA_POOL: Lazy<RwLock<AlphaTexturePool>> =
    Lazy::new(|| RwLock::new(AlphaTexturePool::new()));

pub type AlphaHandle = u64;

pub struct AlphaTexture {
    pub texture: wgpu::Texture,
    pub view: wgpu::TextureView,
    pub sampler: wgpu::Sampler,
    pub width: u32,
    pub height: u32,
    pub name: String,
    pub bind_group_layout: wgpu::BindGroupLayout,
    pub bind_group: wgpu::BindGroup,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlphaInfo {
    pub handle: AlphaHandle,
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub source: AlphaSource,
    #[serde(default)]
    pub preview: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AlphaSource {
    File {
        path: String,
    },
    Embedded {
        id: String,
    },
    Procedural {
        generator: String,
        params: HashMap<String, f32>,
    },
}

pub struct AlphaTexturePool {
    textures: HashMap<AlphaHandle, AlphaTexture>,
    metadata: HashMap<AlphaHandle, AlphaInfo>,
    next_handle: AlphaHandle,
    initialized: bool,
}

impl AlphaTexturePool {
    pub fn new() -> Self {
        Self {
            textures: HashMap::new(),
            metadata: HashMap::new(),
            next_handle: 1,
            initialized: false,
        }
    }

    fn ensure_initialized(&mut self) -> Result<(), String> {
        if self.initialized {
            return Ok(());
        }

        let _gpu = GpuComputeDevice::try_get().ok_or("GPU not initialized")?;
        self.initialized = true;
        Ok(())
    }

    pub fn load_from_bytes(
        &mut self,
        bytes: &[u8],
        name: &str,
        source: AlphaSource,
    ) -> Result<AlphaHandle, String> {
        self.ensure_initialized()?;
        let img =
            image::load_from_memory(bytes).map_err(|e| format!("Failed to decode image: {e}"))?;
        self.load_from_image(img, name, source)
    }

    pub fn load_from_image(
        &mut self,
        img: DynamicImage,
        name: &str,
        source: AlphaSource,
    ) -> Result<AlphaHandle, String> {
        self.ensure_initialized()?;

        let gpu = GpuComputeDevice::get();
        let gpu_lock = gpu.lock();
        let device = &gpu_lock.device;
        let queue = &gpu_lock.queue;

        let gray = img.to_luma8();
        let (width, height) = gray.dimensions();
        let preview = generate_preview_base64(&gray);

        let texture = device.create_texture(&wgpu::TextureDescriptor {
            label: Some(&format!("alpha_{name}")),
            size: wgpu::Extent3d {
                width,
                height,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::R8Unorm,
            usage: wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST,
            view_formats: &[],
        });

        queue.write_texture(
            wgpu::TexelCopyTextureInfo {
                texture: &texture,
                mip_level: 0,
                origin: wgpu::Origin3d::ZERO,
                aspect: wgpu::TextureAspect::All,
            },
            &gray.clone().into_raw(),
            wgpu::TexelCopyBufferLayout {
                offset: 0,
                bytes_per_row: Some(width),
                rows_per_image: Some(height),
            },
            wgpu::Extent3d {
                width,
                height,
                depth_or_array_layers: 1,
            },
        );

        let view = texture.create_view(&wgpu::TextureViewDescriptor::default());
        let sampler = device.create_sampler(&wgpu::SamplerDescriptor {
            label: Some(&format!("alpha_sampler_{name}")),
            address_mode_u: wgpu::AddressMode::ClampToEdge,
            address_mode_v: wgpu::AddressMode::ClampToEdge,
            address_mode_w: wgpu::AddressMode::ClampToEdge,
            mag_filter: wgpu::FilterMode::Linear,
            min_filter: wgpu::FilterMode::Linear,
            mipmap_filter: wgpu::FilterMode::Linear,
            ..Default::default()
        });

        let bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("alpha_bind_group_layout"),
            entries: &[
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::COMPUTE | wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Texture {
                        sample_type: wgpu::TextureSampleType::Float { filterable: true },
                        view_dimension: wgpu::TextureViewDimension::D2,
                        multisampled: false,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 1,
                    visibility: wgpu::ShaderStages::COMPUTE | wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering),
                    count: None,
                },
            ],
        });

        let bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some(&format!("alpha_bind_group_{name}")),
            layout: &bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: wgpu::BindingResource::TextureView(&view),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: wgpu::BindingResource::Sampler(&sampler),
                },
            ],
        });

        let handle = self.next_handle;
        self.next_handle += 1;

        self.textures.insert(
            handle,
            AlphaTexture {
                texture,
                view,
                sampler,
                width,
                height,
                name: name.to_string(),
                bind_group_layout,
                bind_group,
            },
        );
        self.metadata.insert(
            handle,
            AlphaInfo {
                handle,
                name: name.to_string(),
                width,
                height,
                source,
                preview,
            },
        );

        Ok(handle)
    }

    pub fn get(&self, handle: AlphaHandle) -> Option<&AlphaTexture> {
        self.textures.get(&handle)
    }

    pub fn get_info(&self, handle: AlphaHandle) -> Option<&AlphaInfo> {
        self.metadata.get(&handle)
    }

    pub fn list(&self) -> Vec<AlphaInfo> {
        self.metadata.values().cloned().collect()
    }

    pub fn dispose(&mut self, handle: AlphaHandle) -> bool {
        let removed_tex = self.textures.remove(&handle).is_some();
        let removed_meta = self.metadata.remove(&handle).is_some();
        removed_tex || removed_meta
    }

    pub fn get_bind_group(&self, handle: AlphaHandle) -> Option<&wgpu::BindGroup> {
        self.textures.get(&handle).map(|t| &t.bind_group)
    }

    pub fn get_bind_group_layout(&self, handle: AlphaHandle) -> Option<&wgpu::BindGroupLayout> {
        self.textures.get(&handle).map(|t| &t.bind_group_layout)
    }

    pub fn get_texture_view_and_sampler(
        &self,
        handle: AlphaHandle,
    ) -> Option<(&wgpu::TextureView, &wgpu::Sampler)> {
        self.textures.get(&handle).map(|t| (&t.view, &t.sampler))
    }
}

impl Default for AlphaTexturePool {
    fn default() -> Self {
        Self::new()
    }
}

pub fn load_alpha_from_file(path: String, name: Option<String>) -> Result<AlphaInfo, String> {
    let bytes = std::fs::read(&path).map_err(|e| format!("Failed to read file: {e}"))?;
    let alpha_name = name.unwrap_or_else(|| {
        std::path::Path::new(&path)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("unnamed")
            .to_string()
    });
    let mut pool = ALPHA_POOL.write();
    let handle = pool.load_from_bytes(&bytes, &alpha_name, AlphaSource::File { path })?;
    pool.get_info(handle)
        .cloned()
        .ok_or("Failed to get alpha info".to_string())
}

pub fn load_alpha_from_base64(data: String, name: String) -> Result<AlphaInfo, String> {
    use base64::Engine;

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&data)
        .map_err(|e| format!("Failed to decode base64: {e}"))?;
    let mut pool = ALPHA_POOL.write();
    let handle = pool.load_from_bytes(&bytes, &name, AlphaSource::Embedded { id: name.clone() })?;
    pool.get_info(handle)
        .cloned()
        .ok_or("Failed to get alpha info".to_string())
}

pub fn list_alphas() -> Vec<AlphaInfo> {
    ALPHA_POOL.read().list()
}

pub fn dispose_alpha(handle: AlphaHandle) -> bool {
    ALPHA_POOL.write().dispose(handle)
}

pub fn get_alpha_info(handle: AlphaHandle) -> Option<AlphaInfo> {
    ALPHA_POOL.read().get_info(handle).cloned()
}

fn generate_preview_base64(gray: &image::GrayImage) -> Option<String> {
    use base64::Engine;
    use std::io::Cursor;

    let thumbnail = image::imageops::resize(gray, 64, 64, FilterType::Lanczos3);
    let mut png_bytes = Vec::new();
    {
        let mut cursor = Cursor::new(&mut png_bytes);
        if image::codecs::png::PngEncoder::new(&mut cursor)
            .write_image(&thumbnail, 64, 64, image::ExtendedColorType::L8)
            .is_err()
        {
            return None;
        }
    }

    let b64 = base64::engine::general_purpose::STANDARD.encode(&png_bytes);
    Some(format!("data:image/png;base64,{b64}"))
}
