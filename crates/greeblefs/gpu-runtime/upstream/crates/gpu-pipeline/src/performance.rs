//! Performance monitoring for GPU operations

use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant};

/// Performance statistics for GPU operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceStats {
    /// Total GPU memory allocated (bytes)
    pub total_memory_bytes: u64,
    /// Peak GPU memory usage (bytes)
    pub peak_memory_bytes: u64,
    /// Number of buffer allocations
    pub buffer_allocations: u64,
    /// Number of buffer deallocations
    pub buffer_deallocations: u64,
    /// Number of pipeline compilations
    pub pipeline_compilations: u64,
    /// Total time spent compiling pipelines
    pub total_compilation_time: Duration,
    /// Number of compute dispatches
    pub compute_dispatches: u64,
    /// Average frame time (milliseconds)
    pub avg_frame_time_ms: f32,
    /// Frames per second
    pub fps: f32,
}

impl Default for PerformanceStats {
    fn default() -> Self {
        Self {
            total_memory_bytes: 0,
            peak_memory_bytes: 0,
            buffer_allocations: 0,
            buffer_deallocations: 0,
            pipeline_compilations: 0,
            total_compilation_time: Duration::ZERO,
            compute_dispatches: 0,
            avg_frame_time_ms: 0.0,
            fps: 0.0,
        }
    }
}

/// Performance monitor for tracking GPU operations
pub struct PerformanceMonitor {
    stats: Mutex<PerformanceStats>,
    frame_times: Mutex<Vec<Duration>>,
    last_frame_time: Mutex<Instant>,
}

impl PerformanceMonitor {
    /// Create a new performance monitor
    pub fn new() -> Self {
        Self {
            stats: Mutex::new(PerformanceStats::default()),
            frame_times: Mutex::new(Vec::with_capacity(60)),
            last_frame_time: Mutex::new(Instant::now()),
        }
    }

    /// Record a buffer allocation
    pub fn record_buffer_allocation(&self, size: u64) {
        let mut stats = self.stats.lock();
        stats.buffer_allocations += 1;
        stats.total_memory_bytes += size;
        if stats.total_memory_bytes > stats.peak_memory_bytes {
            stats.peak_memory_bytes = stats.total_memory_bytes;
        }
    }

    /// Record a buffer deallocation
    pub fn record_buffer_deallocation(&self, size: u64) {
        let mut stats = self.stats.lock();
        stats.buffer_deallocations += 1;
        stats.total_memory_bytes = stats.total_memory_bytes.saturating_sub(size);
    }

    /// Record a pipeline compilation
    pub fn record_pipeline_compilation(&self, duration: Duration) {
        let mut stats = self.stats.lock();
        stats.pipeline_compilations += 1;
        stats.total_compilation_time += duration;
    }

    /// Record a compute dispatch
    pub fn record_compute_dispatch(&self) {
        let mut stats = self.stats.lock();
        stats.compute_dispatches += 1;
    }

    /// Record a frame (for FPS tracking)
    pub fn record_frame(&self) {
        let now = Instant::now();
        let mut last_frame = self.last_frame_time.lock();
        let frame_time = now.duration_since(*last_frame);
        *last_frame = now;

        let mut frame_times = self.frame_times.lock();
        frame_times.push(frame_time);

        // Keep only last 60 frames
        if frame_times.len() > 60 {
            frame_times.remove(0);
        }

        // Update stats
        let avg_frame_time = frame_times.iter().sum::<Duration>() / frame_times.len() as u32;
        let mut stats = self.stats.lock();
        stats.avg_frame_time_ms = avg_frame_time.as_secs_f32() * 1000.0;
        stats.fps = if avg_frame_time.as_secs_f32() > 0.0 {
            1.0 / avg_frame_time.as_secs_f32()
        } else {
            0.0
        };
    }

    /// Get current performance statistics
    pub fn get_stats(&self) -> PerformanceStats {
        self.stats.lock().clone()
    }

    /// Reset all statistics
    pub fn reset(&self) {
        let mut stats = self.stats.lock();
        *stats = PerformanceStats::default();
        let mut frame_times = self.frame_times.lock();
        frame_times.clear();
    }

    /// Get current memory usage
    pub fn current_memory(&self) -> u64 {
        self.stats.lock().total_memory_bytes
    }

    /// Get peak memory usage
    pub fn peak_memory(&self) -> u64 {
        self.stats.lock().peak_memory_bytes
    }

    /// Get current FPS
    pub fn fps(&self) -> f32 {
        self.stats.lock().fps
    }

    /// Check if performance is degraded
    pub fn is_performance_degraded(&self) -> bool {
        let stats = self.stats.lock();
        stats.avg_frame_time_ms > 0.0 && (stats.fps < 30.0 || stats.avg_frame_time_ms > 33.0)
    }

    /// Check if memory usage is high
    pub fn is_memory_high(&self, threshold_bytes: u64) -> bool {
        self.current_memory() > threshold_bytes
    }
}

impl Default for PerformanceMonitor {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread;

    #[test]
    fn test_buffer_tracking() {
        let monitor = PerformanceMonitor::new();

        monitor.record_buffer_allocation(1024);
        monitor.record_buffer_allocation(2048);

        let stats = monitor.get_stats();
        assert_eq!(stats.buffer_allocations, 2);
        assert_eq!(stats.total_memory_bytes, 3072);
        assert_eq!(stats.peak_memory_bytes, 3072);

        monitor.record_buffer_deallocation(1024);
        let stats = monitor.get_stats();
        assert_eq!(stats.buffer_deallocations, 1);
        assert_eq!(stats.total_memory_bytes, 2048);
        assert_eq!(stats.peak_memory_bytes, 3072); // Peak doesn't decrease
    }

    #[test]
    fn test_buffer_tracking_underflow() {
        let monitor = PerformanceMonitor::new();

        // Deallocate without allocation - should saturate at 0
        monitor.record_buffer_deallocation(1024);
        let stats = monitor.get_stats();
        assert_eq!(stats.total_memory_bytes, 0);
        assert_eq!(stats.buffer_deallocations, 1);
    }

    #[test]
    fn test_peak_memory_tracking() {
        let monitor = PerformanceMonitor::new();

        monitor.record_buffer_allocation(1000);
        assert_eq!(monitor.peak_memory(), 1000);

        monitor.record_buffer_allocation(2000);
        assert_eq!(monitor.peak_memory(), 3000);

        monitor.record_buffer_deallocation(2000);
        assert_eq!(monitor.current_memory(), 1000);
        assert_eq!(monitor.peak_memory(), 3000); // Peak stays at max

        monitor.record_buffer_allocation(500);
        assert_eq!(monitor.peak_memory(), 3000); // Still at previous peak
    }

    #[test]
    fn test_frame_tracking() {
        let monitor = PerformanceMonitor::new();

        // Simulate 60 FPS
        for _ in 0..10 {
            thread::sleep(Duration::from_millis(16));
            monitor.record_frame();
        }

        let stats = monitor.get_stats();
        assert!(stats.fps > 50.0 && stats.fps < 70.0); // Roughly 60 FPS
        assert!(stats.avg_frame_time_ms > 15.0 && stats.avg_frame_time_ms < 20.0);
    }

    #[test]
    fn test_frame_tracking_window() {
        let monitor = PerformanceMonitor::new();

        // Record more than 60 frames to test window limit
        for _ in 0..100 {
            thread::sleep(Duration::from_millis(1));
            monitor.record_frame();
        }

        let stats = monitor.get_stats();
        // Should only track last 60 frames
        assert!(stats.fps > 0.0);
    }

    #[test]
    fn test_pipeline_compilation_tracking() {
        let monitor = PerformanceMonitor::new();

        monitor.record_pipeline_compilation(Duration::from_millis(50));
        monitor.record_pipeline_compilation(Duration::from_millis(100));

        let stats = monitor.get_stats();
        assert_eq!(stats.pipeline_compilations, 2);
        assert_eq!(stats.total_compilation_time, Duration::from_millis(150));
    }

    #[test]
    fn test_compute_dispatch_tracking() {
        let monitor = PerformanceMonitor::new();

        monitor.record_compute_dispatch();
        monitor.record_compute_dispatch();
        monitor.record_compute_dispatch();

        let stats = monitor.get_stats();
        assert_eq!(stats.compute_dispatches, 3);
    }

    #[test]
    fn test_reset() {
        let monitor = PerformanceMonitor::new();

        monitor.record_buffer_allocation(1024);
        monitor.record_pipeline_compilation(Duration::from_millis(100));
        monitor.record_compute_dispatch();

        monitor.reset();

        let stats = monitor.get_stats();
        assert_eq!(stats.buffer_allocations, 0);
        assert_eq!(stats.total_memory_bytes, 0);
        assert_eq!(stats.pipeline_compilations, 0);
        assert_eq!(stats.compute_dispatches, 0);
        assert_eq!(stats.peak_memory_bytes, 0);
    }

    #[test]
    fn test_performance_degraded() {
        let monitor = PerformanceMonitor::new();

        // Initially not degraded
        assert!(!monitor.is_performance_degraded());

        // Simulate slow frames
        for _ in 0..10 {
            thread::sleep(Duration::from_millis(40)); // 25 FPS
            monitor.record_frame();
        }

        // Should be degraded now
        assert!(monitor.is_performance_degraded());
    }

    #[test]
    fn test_memory_high_threshold() {
        let monitor = PerformanceMonitor::new();

        monitor.record_buffer_allocation(1000);
        assert!(!monitor.is_memory_high(2000));
        assert!(monitor.is_memory_high(500));
    }

    #[test]
    fn test_default_stats() {
        let stats = PerformanceStats::default();
        assert_eq!(stats.total_memory_bytes, 0);
        assert_eq!(stats.peak_memory_bytes, 0);
        assert_eq!(stats.buffer_allocations, 0);
        assert_eq!(stats.buffer_deallocations, 0);
        assert_eq!(stats.pipeline_compilations, 0);
        assert_eq!(stats.compute_dispatches, 0);
        assert_eq!(stats.avg_frame_time_ms, 0.0);
        assert_eq!(stats.fps, 0.0);
    }

    #[test]
    fn test_default_monitor() {
        let monitor = PerformanceMonitor::default();
        let stats = monitor.get_stats();
        assert_eq!(stats.total_memory_bytes, 0);
    }
}
