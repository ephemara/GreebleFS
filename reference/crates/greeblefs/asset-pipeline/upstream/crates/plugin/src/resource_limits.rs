//! Resource limits and monitoring for plugins

use crate::{PluginError, Result};
use parking_lot::RwLock;
use std::sync::Arc;
use std::time::{Duration, Instant};
use sysinfo::{ProcessRefreshKind, RefreshKind, System};

/// Resource limits for plugin execution
///
/// Limits prevent plugins from consuming excessive resources
/// and affecting the main application's performance.
#[derive(Debug, Clone)]
pub struct ResourceLimits {
    /// Maximum memory usage in bytes (0 = unlimited)
    pub max_memory_bytes: u64,

    /// Maximum CPU time per update in milliseconds (0 = unlimited)
    pub max_cpu_time_ms: u64,

    /// Maximum number of file handles (0 = unlimited)
    pub max_file_handles: u32,

    /// Maximum execution time for initialization in seconds
    pub max_init_time_secs: u64,
}

impl Default for ResourceLimits {
    fn default() -> Self {
        Self {
            max_memory_bytes: 100 * 1024 * 1024, // 100MB
            max_cpu_time_ms: 16,                 // 16ms (one frame at 60fps)
            max_file_handles: 100,
            max_init_time_secs: 10,
        }
    }
}

impl ResourceLimits {
    /// Create unlimited resource limits (use with caution!)
    pub fn unlimited() -> Self {
        Self {
            max_memory_bytes: 0,
            max_cpu_time_ms: 0,
            max_file_handles: 0,
            max_init_time_secs: 0,
        }
    }

    /// Create strict resource limits for untrusted plugins
    pub fn strict() -> Self {
        Self {
            max_memory_bytes: 50 * 1024 * 1024, // 50MB
            max_cpu_time_ms: 8,                 // 8ms
            max_file_handles: 50,
            max_init_time_secs: 5,
        }
    }

    /// Create relaxed resource limits for trusted plugins
    pub fn relaxed() -> Self {
        Self {
            max_memory_bytes: 500 * 1024 * 1024, // 500MB
            max_cpu_time_ms: 33,                 // 33ms (30fps)
            max_file_handles: 200,
            max_init_time_secs: 30,
        }
    }
}

/// Resource monitor tracks plugin resource usage
pub struct ResourceMonitor {
    /// Resource limits
    limits: ResourceLimits,

    /// Current memory usage estimate in bytes
    memory_usage: Arc<RwLock<u64>>,

    /// Number of open file handles
    file_handles: Arc<RwLock<u32>>,

    /// Start time for current operation
    operation_start: Arc<RwLock<Option<Instant>>>,

    /// System info for monitoring (currently unused but reserved for future use)
    _system: Arc<RwLock<System>>,

    /// Plugin name for error messages (currently unused but reserved for future use)
    _plugin_name: String,
}

impl ResourceMonitor {
    /// Create a new resource monitor
    pub fn new(plugin_name: impl Into<String>, limits: ResourceLimits) -> Self {
        Self {
            limits,
            memory_usage: Arc::new(RwLock::new(0)),
            file_handles: Arc::new(RwLock::new(0)),
            operation_start: Arc::new(RwLock::new(None)),
            _system: Arc::new(RwLock::new(System::new_with_specifics(
                RefreshKind::new().with_processes(ProcessRefreshKind::new()),
            ))),
            _plugin_name: plugin_name.into(),
        }
    }

    /// Start tracking an operation
    pub fn start_operation(&self) {
        let mut start = self.operation_start.write();
        *start = Some(Instant::now());
    }

    /// Check if operation time limit is exceeded
    pub fn check_operation_time(&self) -> Result<()> {
        if self.limits.max_cpu_time_ms == 0 {
            return Ok(());
        }

        let start = self.operation_start.read();
        if let Some(start_time) = *start {
            let elapsed = start_time.elapsed();
            let limit = Duration::from_millis(self.limits.max_cpu_time_ms);

            if elapsed > limit {
                return Err(PluginError::ResourceLimitExceeded {
                    resource: "CPU time".to_string(),
                    limit: self.limits.max_cpu_time_ms,
                    current: elapsed.as_millis() as u64,
                });
            }
        }

        Ok(())
    }

    /// End tracking an operation
    pub fn end_operation(&self) {
        let mut start = self.operation_start.write();
        *start = None;
    }

    /// Track memory allocation
    pub fn allocate_memory(&self, bytes: u64) -> Result<()> {
        let mut usage = self.memory_usage.write();
        let new_usage = *usage + bytes;

        if self.limits.max_memory_bytes > 0 && new_usage > self.limits.max_memory_bytes {
            return Err(PluginError::ResourceLimitExceeded {
                resource: "memory".to_string(),
                limit: self.limits.max_memory_bytes,
                current: new_usage,
            });
        }

        *usage = new_usage;
        Ok(())
    }

    /// Track memory deallocation
    pub fn deallocate_memory(&self, bytes: u64) {
        let mut usage = self.memory_usage.write();
        *usage = usage.saturating_sub(bytes);
    }

    /// Get current memory usage
    pub fn memory_usage(&self) -> u64 {
        *self.memory_usage.read()
    }

    /// Track file handle opening
    pub fn open_file_handle(&self) -> Result<()> {
        let mut handles = self.file_handles.write();
        let new_count = *handles + 1;

        if self.limits.max_file_handles > 0 && new_count > self.limits.max_file_handles {
            return Err(PluginError::ResourceLimitExceeded {
                resource: "file handles".to_string(),
                limit: self.limits.max_file_handles as u64,
                current: new_count as u64,
            });
        }

        *handles = new_count;
        Ok(())
    }

    /// Track file handle closing
    pub fn close_file_handle(&self) {
        let mut handles = self.file_handles.write();
        *handles = handles.saturating_sub(1);
    }

    /// Get current file handle count
    pub fn file_handle_count(&self) -> u32 {
        *self.file_handles.read()
    }

    /// Get resource limits
    pub fn limits(&self) -> &ResourceLimits {
        &self.limits
    }

    /// Get resource usage summary
    pub fn usage_summary(&self) -> ResourceUsage {
        ResourceUsage {
            memory_bytes: self.memory_usage(),
            file_handles: self.file_handle_count(),
            memory_limit: self.limits.max_memory_bytes,
            file_handle_limit: self.limits.max_file_handles,
        }
    }

    /// Check if any resource limit is close to being exceeded (>80%)
    pub fn is_near_limit(&self) -> bool {
        let usage = self.usage_summary();

        if self.limits.max_memory_bytes > 0 {
            let memory_percent = (usage.memory_bytes as f64 / usage.memory_limit as f64) * 100.0;
            if memory_percent > 80.0 {
                return true;
            }
        }

        if self.limits.max_file_handles > 0 {
            let handle_percent =
                (usage.file_handles as f64 / usage.file_handle_limit as f64) * 100.0;
            if handle_percent > 80.0 {
                return true;
            }
        }

        false
    }
}

/// Resource usage snapshot
#[derive(Debug, Clone)]
pub struct ResourceUsage {
    pub memory_bytes: u64,
    pub file_handles: u32,
    pub memory_limit: u64,
    pub file_handle_limit: u32,
}

impl ResourceUsage {
    /// Get memory usage percentage
    pub fn memory_percent(&self) -> f64 {
        if self.memory_limit == 0 {
            0.0
        } else {
            (self.memory_bytes as f64 / self.memory_limit as f64) * 100.0
        }
    }

    /// Get file handle usage percentage
    pub fn file_handle_percent(&self) -> f64 {
        if self.file_handle_limit == 0 {
            0.0
        } else {
            (self.file_handles as f64 / self.file_handle_limit as f64) * 100.0
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resource_limits_presets() {
        let default = ResourceLimits::default();
        assert_eq!(default.max_memory_bytes, 100 * 1024 * 1024);

        let unlimited = ResourceLimits::unlimited();
        assert_eq!(unlimited.max_memory_bytes, 0);

        let strict = ResourceLimits::strict();
        assert_eq!(strict.max_memory_bytes, 50 * 1024 * 1024);

        let relaxed = ResourceLimits::relaxed();
        assert_eq!(relaxed.max_memory_bytes, 500 * 1024 * 1024);
    }

    #[test]
    fn test_memory_tracking() {
        let monitor = ResourceMonitor::new("test", ResourceLimits::default());

        assert_eq!(monitor.memory_usage(), 0);

        monitor.allocate_memory(1024).unwrap();
        assert_eq!(monitor.memory_usage(), 1024);

        monitor.deallocate_memory(512);
        assert_eq!(monitor.memory_usage(), 512);
    }

    #[test]
    fn test_memory_limit() {
        let limits = ResourceLimits {
            max_memory_bytes: 1024,
            ..Default::default()
        };
        let monitor = ResourceMonitor::new("test", limits);

        assert!(monitor.allocate_memory(512).is_ok());
        assert!(monitor.allocate_memory(512).is_ok());
        assert!(monitor.allocate_memory(1).is_err()); // Exceeds limit
    }

    #[test]
    fn test_file_handle_tracking() {
        let monitor = ResourceMonitor::new("test", ResourceLimits::default());

        assert_eq!(monitor.file_handle_count(), 0);

        monitor.open_file_handle().unwrap();
        assert_eq!(monitor.file_handle_count(), 1);

        monitor.close_file_handle();
        assert_eq!(monitor.file_handle_count(), 0);
    }

    #[test]
    fn test_usage_summary() {
        let monitor = ResourceMonitor::new("test", ResourceLimits::default());

        monitor.allocate_memory(1024).unwrap();
        monitor.open_file_handle().unwrap();

        let usage = monitor.usage_summary();
        assert_eq!(usage.memory_bytes, 1024);
        assert_eq!(usage.file_handles, 1);
    }
}
