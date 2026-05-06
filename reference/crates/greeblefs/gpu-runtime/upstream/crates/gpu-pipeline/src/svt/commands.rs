//! SVT Tauri Commands - Handle-based painting API
//!
//! Pattern: init → apply → read → dispose
//! Eliminates JSON overhead by keeping SVT state in Rust.

use bytemuck::{Pod, Zeroable};
use lazy_static::lazy_static;
use std::collections::HashMap;
use std::sync::Mutex;

use super::{PageTableManager, SvtEngine};
use crate::gpu::device::GpuComputeDevice;

// ============================================================================
// BRUSH PARAMS (GPU uniform struct)
// ============================================================================

#[repr(C)]
#[derive(Copy, Clone, Debug, Pod, Zeroable)]
pub struct BrushParams {
    pub center_uv: [f32; 2],
    pub radius: f32,
    pub _pad0: f32,
    pub color: [f32; 4],
    pub virtual_size: f32,
    pub tile_size: f32,
    pub _pad1: [f32; 2],
}

// ============================================================================
// SVT INSTANCE
// ============================================================================

/// A registered SVT instance with its engine and page manager
pub struct SvtInstance {
    pub engine: SvtEngine,
    pub manager: PageTableManager,
    pub virtual_width: u32,
    pub virtual_height: u32,
    pub tile_size: u32,
}

// ============================================================================
// GLOBAL REGISTRY
// ============================================================================

lazy_static! {
    static ref SVT_REGISTRY: Mutex<HashMap<u64, SvtInstance>> = Mutex::new(HashMap::new());
    static ref NEXT_SVT_HANDLE: Mutex<u64> = Mutex::new(1);
}

fn next_handle() -> u64 {
    let mut h = NEXT_SVT_HANDLE.lock().unwrap();
    let handle = *h;
    *h += 1;
    handle
}

// ============================================================================
// TAURI COMMANDS
// ============================================================================

/// Initialize an SVT instance for texture painting
///
/// Returns a handle to use for subsequent operations.
/// Default: 16K virtual, 4K physical, 128px tiles
#[cfg_attr(
    all(not(target_arch = "wasm32"), feature = "tauri-commands"),
    tauri::command
)]
pub fn svt_init(
    width: Option<u32>,
    height: Option<u32>,
    tile_size: Option<u32>,
) -> Result<u64, String> {
    let gpu = GpuComputeDevice::get_or_init_blocking()?;
    let gpu_guard = gpu.lock();
    let device = &gpu_guard.device;

    let width = width.unwrap_or(16384);
    let height = height.unwrap_or(16384);
    let tile_size = tile_size.unwrap_or(128);

    // Create engine with default dimensions (engine uses hardcoded 16K/4K for now)
    let engine = SvtEngine::new(device);
    let manager = PageTableManager::new(width, super::engine::PHYSICAL_SIZE, tile_size);

    let instance = SvtInstance {
        engine,
        manager,
        virtual_width: width,
        virtual_height: height,
        tile_size,
    };

    let handle = next_handle();
    SVT_REGISTRY.lock().unwrap().insert(handle, instance);

    log::info!(
        "[SVT] Initialized handle {} ({}x{}, tile={})",
        handle,
        width,
        height,
        tile_size
    );

    Ok(handle)
}

/// Apply a paint stroke to an SVT instance
///
/// Only sends small params - no texture data over IPC!
#[cfg_attr(
    all(not(target_arch = "wasm32"), feature = "tauri-commands"),
    tauri::command
)]
pub fn svt_stroke(
    handle: u64,
    center_uv: [f32; 2],
    radius: f32,
    color: [f32; 4],
) -> Result<(), String> {
    let gpu = GpuComputeDevice::get_or_init_blocking()?;
    let gpu_guard = gpu.lock();
    let device = &gpu_guard.device;
    let queue = &gpu_guard.queue;

    let mut registry = SVT_REGISTRY.lock().unwrap();
    let instance = registry
        .get_mut(&handle)
        .ok_or_else(|| format!("SVT handle {} not found", handle))?;

    // Request tiles in the brush region
    let tiles_to_load: Vec<(f32, f32)> = vec![
        (center_uv[0], center_uv[1]),
        // Add neighboring tiles for large brushes
        (center_uv[0] - 0.01, center_uv[1]),
        (center_uv[0] + 0.01, center_uv[1]),
        (center_uv[0], center_uv[1] - 0.01),
        (center_uv[0], center_uv[1] + 0.01),
    ];

    let _page_updates = instance.manager.request_tiles(tiles_to_load);
    // TODO: Apply page updates to GPU page table texture

    // Create brush params
    let brush_params = BrushParams {
        center_uv,
        radius,
        _pad0: 0.0,
        color,
        virtual_size: instance.virtual_width as f32,
        tile_size: instance.tile_size as f32,
        _pad1: [0.0, 0.0],
    };

    let params_bytes = bytemuck::bytes_of(&brush_params);

    // Dispatch stroke
    let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
        label: Some("SVT Stroke Encoder"),
    });

    instance
        .engine
        .dispatch_stroke(device, queue, &mut encoder, params_bytes);

    queue.submit(std::iter::once(encoder.finish()));

    Ok(())
}

/// Read a tile from the SVT physical cache
///
/// Returns raw RGBA bytes (128x128x4 = 65536 bytes per tile)
#[cfg_attr(
    all(not(target_arch = "wasm32"), feature = "tauri-commands"),
    tauri::command
)]
pub fn svt_read_tile(handle: u64, tile_x: u32, tile_y: u32) -> Result<Vec<u8>, String> {
    let gpu = GpuComputeDevice::get_or_init_blocking()?;
    let gpu_guard = gpu.lock();
    let device = &gpu_guard.device;
    let queue = &gpu_guard.queue;

    let registry = SVT_REGISTRY.lock().unwrap();
    let instance = registry
        .get(&handle)
        .ok_or_else(|| format!("SVT handle {} not found", handle))?;

    let tile_size = instance.tile_size;
    let bytes_per_row = tile_size * 4;
    let padded_bytes_per_row = (bytes_per_row + 255) & !255; // Align to 256

    // Create staging buffer
    let staging_buffer = device.create_buffer(&wgpu::BufferDescriptor {
        label: Some("SVT Tile Staging"),
        size: (padded_bytes_per_row * tile_size) as u64,
        usage: wgpu::BufferUsages::MAP_READ | wgpu::BufferUsages::COPY_DST,
        mapped_at_creation: false,
    });

    // Copy tile from physical texture
    let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
        label: Some("SVT Tile Read"),
    });

    encoder.copy_texture_to_buffer(
        wgpu::TexelCopyTextureInfo {
            texture: &instance.engine.physical_texture,
            mip_level: 0,
            origin: wgpu::Origin3d {
                x: tile_x * tile_size,
                y: tile_y * tile_size,
                z: 0,
            },
            aspect: wgpu::TextureAspect::All,
        },
        wgpu::TexelCopyBufferInfo {
            buffer: &staging_buffer,
            layout: wgpu::TexelCopyBufferLayout {
                offset: 0,
                bytes_per_row: Some(padded_bytes_per_row),
                rows_per_image: Some(tile_size),
            },
        },
        wgpu::Extent3d {
            width: tile_size,
            height: tile_size,
            depth_or_array_layers: 1,
        },
    );

    queue.submit(std::iter::once(encoder.finish()));

    // Read back
    let buffer_slice = staging_buffer.slice(..);
    let (tx, rx) = std::sync::mpsc::channel();
    buffer_slice.map_async(wgpu::MapMode::Read, move |result| {
        tx.send(result).unwrap();
    });

    let _ = device.poll(wgpu::PollType::Wait);
    rx.recv()
        .unwrap()
        .map_err(|e| format!("Map failed: {:?}", e))?;

    let data = buffer_slice.get_mapped_range();

    // Remove padding
    let mut result = Vec::with_capacity((tile_size * tile_size * 4) as usize);
    for y in 0..tile_size {
        let start = (y * padded_bytes_per_row) as usize;
        let end = start + (tile_size * 4) as usize;
        result.extend_from_slice(&data[start..end]);
    }

    drop(data);
    staging_buffer.unmap();

    Ok(result)
}

/// Export the entire physical cache as PNG (base64 encoded)
#[cfg_attr(
    all(not(target_arch = "wasm32"), feature = "tauri-commands"),
    tauri::command
)]
pub fn svt_export(handle: u64) -> Result<String, String> {
    let gpu = GpuComputeDevice::get_or_init_blocking()?;
    let gpu_guard = gpu.lock();
    let device = &gpu_guard.device;
    let queue = &gpu_guard.queue;

    let registry = SVT_REGISTRY.lock().unwrap();
    let instance = registry
        .get(&handle)
        .ok_or_else(|| format!("SVT handle {} not found", handle))?;

    // Physical texture is 4K x 4K RGBA
    let width = super::engine::PHYSICAL_SIZE;
    let height = super::engine::PHYSICAL_SIZE;
    let bytes_per_row = width * 4;
    let padded_bytes_per_row = (bytes_per_row + 255) & !255;

    // Create staging buffer
    let staging_buffer = device.create_buffer(&wgpu::BufferDescriptor {
        label: Some("SVT Export Staging"),
        size: (padded_bytes_per_row * height) as u64,
        usage: wgpu::BufferUsages::MAP_READ | wgpu::BufferUsages::COPY_DST,
        mapped_at_creation: false,
    });

    // Copy entire physical texture
    let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
        label: Some("SVT Export"),
    });

    encoder.copy_texture_to_buffer(
        wgpu::TexelCopyTextureInfo {
            texture: &instance.engine.physical_texture,
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

    queue.submit(std::iter::once(encoder.finish()));

    // Read back
    let buffer_slice = staging_buffer.slice(..);
    let (tx, rx) = std::sync::mpsc::channel();
    buffer_slice.map_async(wgpu::MapMode::Read, move |result| {
        tx.send(result).unwrap();
    });

    let _ = device.poll(wgpu::PollType::Wait);
    rx.recv()
        .unwrap()
        .map_err(|e| format!("Map failed: {:?}", e))?;

    let data = buffer_slice.get_mapped_range();

    // Remove padding and create image
    let mut pixels = Vec::with_capacity((width * height * 4) as usize);
    for y in 0..height {
        let start = (y * padded_bytes_per_row) as usize;
        let end = start + (width * 4) as usize;
        pixels.extend_from_slice(&data[start..end]);
    }

    drop(data);
    staging_buffer.unmap();

    // Encode as PNG and base64
    use image::{ImageBuffer, Rgba};
    let img: ImageBuffer<Rgba<u8>, Vec<u8>> =
        ImageBuffer::from_raw(width, height, pixels).ok_or("Failed to create image buffer")?;

    let mut png_bytes = Vec::new();
    let mut cursor = std::io::Cursor::new(&mut png_bytes);
    img.write_to(&mut cursor, image::ImageFormat::Png)
        .map_err(|e| format!("PNG encode failed: {}", e))?;

    use base64::Engine;
    Ok(base64::engine::general_purpose::STANDARD.encode(&png_bytes))
}

/// Export the entire physical cache as raw RGBA bytes (FAST - no PNG encoding!)
///
/// Returns raw RGBA pixel data as Vec<u8>.
/// Frontend should use ImageData + canvas to create texture.
/// ~5-10x faster than PNG export!
#[cfg_attr(
    all(not(target_arch = "wasm32"), feature = "tauri-commands"),
    tauri::command
)]
pub fn svt_export_raw(handle: u64) -> Result<Vec<u8>, String> {
    let gpu = GpuComputeDevice::get_or_init_blocking()?;
    let gpu_guard = gpu.lock();
    let device = &gpu_guard.device;
    let queue = &gpu_guard.queue;

    let registry = SVT_REGISTRY.lock().unwrap();
    let instance = registry
        .get(&handle)
        .ok_or_else(|| format!("SVT handle {} not found", handle))?;

    // Physical texture is 4K x 4K RGBA
    let width = super::engine::PHYSICAL_SIZE;
    let height = super::engine::PHYSICAL_SIZE;
    let bytes_per_row = width * 4;
    let padded_bytes_per_row = (bytes_per_row + 255) & !255;

    // Create staging buffer
    let staging_buffer = device.create_buffer(&wgpu::BufferDescriptor {
        label: Some("SVT Export Raw Staging"),
        size: (padded_bytes_per_row * height) as u64,
        usage: wgpu::BufferUsages::MAP_READ | wgpu::BufferUsages::COPY_DST,
        mapped_at_creation: false,
    });

    // Copy entire physical texture
    let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
        label: Some("SVT Export Raw"),
    });

    encoder.copy_texture_to_buffer(
        wgpu::TexelCopyTextureInfo {
            texture: &instance.engine.physical_texture,
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

    queue.submit(std::iter::once(encoder.finish()));

    // Read back
    let buffer_slice = staging_buffer.slice(..);
    let (tx, rx) = std::sync::mpsc::channel();
    buffer_slice.map_async(wgpu::MapMode::Read, move |result| {
        tx.send(result).unwrap();
    });

    let _ = device.poll(wgpu::PollType::Wait);
    rx.recv()
        .unwrap()
        .map_err(|e| format!("Map failed: {:?}", e))?;

    let data = buffer_slice.get_mapped_range();

    // Remove padding - return clean RGBA bytes
    let mut pixels = Vec::with_capacity((width * height * 4) as usize);
    for y in 0..height {
        let start = (y * padded_bytes_per_row) as usize;
        let end = start + (width * 4) as usize;
        pixels.extend_from_slice(&data[start..end]);
    }

    drop(data);
    staging_buffer.unmap();

    // Return raw bytes - NO PNG encoding, NO base64!
    // This is ~5-10x faster than svt_export
    Ok(pixels)
}

/// Dispose an SVT instance and free GPU resources
#[cfg_attr(
    all(not(target_arch = "wasm32"), feature = "tauri-commands"),
    tauri::command
)]
pub fn svt_dispose(handle: u64) -> Result<(), String> {
    let mut registry = SVT_REGISTRY.lock().unwrap();

    if registry.remove(&handle).is_some() {
        log::info!("[SVT] Disposed handle {}", handle);
        Ok(())
    } else {
        Err(format!("SVT handle {} not found", handle))
    }
}

/// Get stats about an SVT instance
#[cfg_attr(
    all(not(target_arch = "wasm32"), feature = "tauri-commands"),
    tauri::command
)]
pub fn svt_stats(handle: u64) -> Result<SvtStats, String> {
    let registry = SVT_REGISTRY.lock().unwrap();
    let instance = registry
        .get(&handle)
        .ok_or_else(|| format!("SVT handle {} not found", handle))?;

    Ok(SvtStats {
        virtual_width: instance.virtual_width,
        virtual_height: instance.virtual_height,
        tile_size: instance.tile_size,
        loaded_tiles: instance.manager.loaded_count() as u32,
        max_tiles: instance.manager.capacity(),
    })
}

#[derive(serde::Serialize)]
pub struct SvtStats {
    pub virtual_width: u32,
    pub virtual_height: u32,
    pub tile_size: u32,
    pub loaded_tiles: u32,
    pub max_tiles: u32,
}
