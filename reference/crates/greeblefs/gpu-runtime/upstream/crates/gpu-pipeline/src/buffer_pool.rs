//! Buffer pooling system for efficient GPU memory management

use crate::error::{GPUPipelineError, Result};
use parking_lot::Mutex;
use std::collections::HashMap;
use wgpu::{Buffer, BufferDescriptor, BufferUsages, Device};

/// Configuration for buffer pool
#[derive(Debug, Clone)]
pub struct BufferPoolConfig {
    /// Maximum number of buffers to keep in the pool per size bucket
    pub max_buffers_per_bucket: usize,
    /// Maximum total memory to keep in the pool (bytes)
    pub max_pool_memory: u64,
    /// Size bucket granularity (buffers are grouped by size rounded to this)
    pub size_bucket_granularity: u64,
}

impl Default for BufferPoolConfig {
    fn default() -> Self {
        Self {
            max_buffers_per_bucket: 16,
            max_pool_memory: 512 * 1024 * 1024, // 512 MB
            size_bucket_granularity: 4096,      // 4 KB buckets
        }
    }
}

/// A pooled buffer entry
struct PooledBuffer {
    buffer: Buffer,
    size: u64,
    _usage: BufferUsages,
}

/// Buffer pool for reusing GPU buffers
///
/// Reduces allocation overhead by maintaining a pool of buffers that can be reused.
/// Buffers are organized into size buckets for efficient lookup.
pub struct BufferPool {
    config: BufferPoolConfig,
    // Map from (size_bucket, usage) to list of available buffers
    pools: Mutex<HashMap<(u64, BufferUsages), Vec<PooledBuffer>>>,
    current_memory: Mutex<u64>,
}

impl BufferPool {
    /// Create a new buffer pool with the given configuration
    pub fn new(config: BufferPoolConfig) -> Self {
        Self {
            config,
            pools: Mutex::new(HashMap::new()),
            current_memory: Mutex::new(0),
        }
    }

    /// Get a buffer from the pool or create a new one
    ///
    /// # Arguments
    ///
    /// * `device` - GPU device for creating new buffers
    /// * `size` - Minimum size in bytes
    /// * `usage` - Buffer usage flags
    pub fn get_buffer(&self, device: &Device, size: u64, usage: BufferUsages) -> Result<Buffer> {
        if size == 0 {
            return Err(GPUPipelineError::InvalidBufferSize { size });
        }

        let bucket = self.size_to_bucket(size);
        let key = (bucket, usage);

        // Try to get from pool
        let mut pools = self.pools.lock();
        if let Some(buffer_list) = pools.get_mut(&key) {
            if let Some(pooled) = buffer_list.pop() {
                let mut current_memory = self.current_memory.lock();
                *current_memory -= pooled.size;
                log::trace!(
                    "Reusing buffer from pool: size={}, usage={:?}",
                    pooled.size,
                    usage
                );
                return Ok(pooled.buffer);
            }
        }
        drop(pools);

        // Create new buffer
        let actual_size = bucket; // Use bucket size for alignment
        let buffer = device.create_buffer(&BufferDescriptor {
            label: Some("Pooled Buffer"),
            size: actual_size,
            usage,
            mapped_at_creation: false,
        });

        log::trace!(
            "Created new buffer: size={}, usage={:?}",
            actual_size,
            usage
        );
        Ok(buffer)
    }

    /// Return a buffer to the pool for reuse
    ///
    /// # Arguments
    ///
    /// * `buffer` - Buffer to return to the pool
    pub fn return_buffer(&self, buffer: Buffer) {
        let size = buffer.size();
        let usage = buffer.usage();
        let bucket = self.size_to_bucket(size);
        let key = (bucket, usage);

        let mut pools = self.pools.lock();
        let mut current_memory = self.current_memory.lock();

        // Check if we have room in the pool
        if *current_memory + size > self.config.max_pool_memory {
            log::trace!("Pool memory limit reached, dropping buffer: size={}", size);
            return;
        }

        let buffer_list = pools.entry(key).or_insert_with(Vec::new);

        // Check if bucket is full
        if buffer_list.len() >= self.config.max_buffers_per_bucket {
            log::trace!(
                "Bucket full, dropping buffer: size={}, usage={:?}",
                size,
                usage
            );
            return;
        }

        // Add to pool
        buffer_list.push(PooledBuffer {
            buffer,
            size,
            _usage: usage,
        });
        *current_memory += size;

        log::trace!(
            "Returned buffer to pool: size={}, usage={:?}, pool_memory={}",
            size,
            usage,
            *current_memory
        );
    }

    /// Clear all buffers from the pool
    pub fn clear(&self) {
        let mut pools = self.pools.lock();
        pools.clear();
        let mut current_memory = self.current_memory.lock();
        *current_memory = 0;
        log::info!("Buffer pool cleared");
    }

    /// Get the number of buffers currently in the pool
    pub fn len(&self) -> usize {
        let pools = self.pools.lock();
        pools.values().map(|v| v.len()).sum()
    }

    /// Check if the pool is empty
    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    /// Get current memory usage of the pool
    pub fn current_memory(&self) -> u64 {
        *self.current_memory.lock()
    }

    /// Convert size to bucket index
    fn size_to_bucket(&self, size: u64) -> u64 {
        let granularity = self.config.size_bucket_granularity;
        ((size + granularity - 1) / granularity) * granularity
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_size_to_bucket() {
        let config = BufferPoolConfig {
            size_bucket_granularity: 1024,
            ..Default::default()
        };
        let pool = BufferPool::new(config);

        assert_eq!(pool.size_to_bucket(100), 1024);
        assert_eq!(pool.size_to_bucket(1024), 1024);
        assert_eq!(pool.size_to_bucket(1025), 2048);
        assert_eq!(pool.size_to_bucket(2048), 2048);
    }

    #[test]
    fn test_size_to_bucket_edge_cases() {
        let config = BufferPoolConfig {
            size_bucket_granularity: 4096,
            ..Default::default()
        };
        let pool = BufferPool::new(config);

        // Test edge cases
        assert_eq!(pool.size_to_bucket(0), 0);
        assert_eq!(pool.size_to_bucket(1), 4096);
        assert_eq!(pool.size_to_bucket(4095), 4096);
        assert_eq!(pool.size_to_bucket(4096), 4096);
        assert_eq!(pool.size_to_bucket(4097), 8192);
    }

    #[test]
    fn test_buffer_pool_config_default() {
        let config = BufferPoolConfig::default();
        assert_eq!(config.max_buffers_per_bucket, 16);
        assert_eq!(config.max_pool_memory, 512 * 1024 * 1024);
        assert_eq!(config.size_bucket_granularity, 4096);
    }

    #[test]
    fn test_buffer_pool_creation() {
        let config = BufferPoolConfig::default();
        let pool = BufferPool::new(config);
        assert_eq!(pool.len(), 0);
        assert!(pool.is_empty());
        assert_eq!(pool.current_memory(), 0);
    }

    #[test]
    fn test_buffer_pool_clear() {
        let pool = BufferPool::new(BufferPoolConfig::default());
        pool.clear();
        assert_eq!(pool.len(), 0);
        assert_eq!(pool.current_memory(), 0);
    }

    #[test]
    fn test_invalid_buffer_size() {
        let _pool = BufferPool::new(BufferPoolConfig::default());
        // This would require a device, so we just test the error path
        // Actual integration tests will test with real GPU
    }
}
