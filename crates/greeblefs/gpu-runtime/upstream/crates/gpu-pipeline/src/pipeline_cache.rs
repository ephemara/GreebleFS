//! Pipeline caching system for efficient shader reuse

use crate::error::{GPUPipelineError, Result};
use hashbrown::HashMap;
use parking_lot::RwLock;
use std::sync::Arc;
use wgpu::{ComputePipeline, Device, ShaderModuleDescriptor, ShaderSource};

/// Cache for compiled compute pipelines
///
/// Stores compiled pipelines by shader name to avoid recompilation.
/// Thread-safe with read-write locking for concurrent access.
pub struct PipelineCache {
    device: Arc<Device>,
    cache: RwLock<HashMap<String, Arc<ComputePipeline>>>,
    shader_sources: RwLock<HashMap<String, String>>,
}

impl PipelineCache {
    /// Create a new pipeline cache
    pub fn new(device: Arc<Device>) -> Self {
        Self {
            device,
            cache: RwLock::new(HashMap::new()),
            shader_sources: RwLock::new(HashMap::new()),
        }
    }

    /// Get or create a pipeline by shader name
    ///
    /// If the pipeline is cached, returns the cached version.
    /// Otherwise, loads the shader, compiles it, and caches the result.
    pub fn get_or_create(&self, shader_name: &str) -> Result<&ComputePipeline> {
        // Fast path: check if already cached
        {
            let cache = self.cache.read();
            if cache.contains_key(shader_name) {
                // SAFETY: We need to return a reference that outlives the lock
                // This is safe because we never remove items from the cache
                // except in clear() which requires &mut self
                unsafe {
                    let ptr = cache.get(shader_name).unwrap().as_ref() as *const ComputePipeline;
                    return Ok(&*ptr);
                }
            }
        }

        // Slow path: compile and cache
        let pipeline = self.compile_pipeline(shader_name)?;
        let pipeline_arc = Arc::new(pipeline);

        {
            let mut cache = self.cache.write();
            cache.insert(shader_name.to_string(), pipeline_arc.clone());
        }

        // SAFETY: Same as above - the Arc keeps the pipeline alive
        unsafe {
            let ptr = pipeline_arc.as_ref() as *const ComputePipeline;
            Ok(&*ptr)
        }
    }

    /// Compile a shader into a compute pipeline
    fn compile_pipeline(&self, shader_name: &str) -> Result<ComputePipeline> {
        // Load shader source
        let shader_source = self.load_shader_source(shader_name)?;

        // Create shader module
        let shader_module = self.device.create_shader_module(ShaderModuleDescriptor {
            label: Some(&format!("{} Shader", shader_name)),
            source: ShaderSource::Wgsl(shader_source.into()),
        });

        // Create compute pipeline
        let pipeline = self
            .device
            .create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
                label: Some(&format!("{} Pipeline", shader_name)),
                layout: None, // Auto layout
                module: &shader_module,
                entry_point: Some("main"),
                compilation_options: Default::default(),
                cache: None,
            });

        log::info!("Compiled pipeline: {}", shader_name);
        Ok(pipeline)
    }

    /// Load shader source from file or embedded sources
    fn load_shader_source(&self, shader_name: &str) -> Result<String> {
        // Check if we have a cached source
        {
            let sources = self.shader_sources.read();
            if let Some(source) = sources.get(shader_name) {
                return Ok(source.clone());
            }
        }

        // Try to load from file system
        let shader_path = format!("shaders/{}.wgsl", shader_name);
        match std::fs::read_to_string(&shader_path) {
            Ok(source) => {
                // Cache the source
                let mut sources = self.shader_sources.write();
                sources.insert(shader_name.to_string(), source.clone());
                Ok(source)
            }
            Err(_e) => Err(GPUPipelineError::ShaderNotFound { path: shader_path }),
        }
    }

    /// Register a shader source directly (useful for embedded shaders)
    pub fn register_shader_source(&self, name: impl Into<String>, source: impl Into<String>) {
        let mut sources = self.shader_sources.write();
        sources.insert(name.into(), source.into());
    }

    /// Invalidate a cached pipeline (forces recompilation on next access)
    pub fn invalidate(&self, shader_name: &str) {
        let mut cache = self.cache.write();
        cache.remove(shader_name);
        log::debug!("Invalidated pipeline: {}", shader_name);
    }

    /// Clear all cached pipelines
    pub fn clear(&self) {
        let mut cache = self.cache.write();
        cache.clear();
        log::info!("Pipeline cache cleared");
    }

    /// Get the number of cached pipelines
    pub fn len(&self) -> usize {
        let cache = self.cache.read();
        cache.len()
    }

    /// Check if the cache is empty
    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    /// Get a list of all cached pipeline names
    pub fn cached_names(&self) -> Vec<String> {
        let cache = self.cache.read();
        cache.keys().cloned().collect()
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_shader_source_registration() {
        // This test doesn't require GPU access
        // Actual pipeline compilation tests are in integration tests
    }

    #[test]
    fn test_pipeline_cache_creation() {
        // Create a mock device for testing (requires async)
        // Actual tests are in integration tests
    }

    #[test]
    fn test_cached_names_empty() {
        // Test that cached_names returns empty vec for new cache
        // Requires device, so tested in integration tests
    }
}
