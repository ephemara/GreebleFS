//! Staging Buffer Pool
//!
//! Reusable staging buffers for GPU→CPU readback without per-call allocation.

use std::collections::HashMap;

/// Pool of staging buffers for efficient GPU→CPU readback
pub struct StagingBufferPool {
    /// Buffers indexed by size bucket (powers of 2)
    buffers: HashMap<u64, Vec<wgpu::Buffer>>,
    /// Minimum buffer size (64KB)
    min_size: u64,
}

impl StagingBufferPool {
    pub fn new() -> Self {
        Self {
            buffers: HashMap::new(),
            min_size: 64 * 1024, // 64KB minimum
        }
    }

    /// Get or create a staging buffer of at least `size` bytes
    pub fn get_or_create(&mut self, device: &wgpu::Device, size: u64) -> wgpu::Buffer {
        // Round up to power of 2 for bucket
        let bucket_size = self.bucket_size(size);

        // Try to reuse existing buffer
        if let Some(buffers) = self.buffers.get_mut(&bucket_size) {
            if let Some(buffer) = buffers.pop() {
                return buffer;
            }
        }

        // Create new buffer
        device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("staging_buffer"),
            size: bucket_size,
            usage: wgpu::BufferUsages::MAP_READ | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        })
    }

    /// Return a buffer to the pool for reuse
    pub fn return_buffer(&mut self, buffer: wgpu::Buffer, size: u64) {
        let bucket_size = self.bucket_size(size);
        self.buffers.entry(bucket_size).or_default().push(buffer);
    }

    /// Round size up to nearest power of 2, minimum min_size
    fn bucket_size(&self, size: u64) -> u64 {
        let size = size.max(self.min_size);
        size.next_power_of_two()
    }

    /// Clear all cached buffers (call when memory pressure)
    pub fn clear(&mut self) {
        self.buffers.clear();
    }
}

impl Default for StagingBufferPool {
    fn default() -> Self {
        Self::new()
    }
}
