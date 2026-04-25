# GreebleFS GPU & CUDA Acceleration

GreebleFS leverages GPU acceleration and CUDA support for high-performance computing tasks including video processing, image analysis, and 3D rendering. This document details the GPU architecture, acceleration capabilities, and performance optimization strategies.

## Overview

GreebleFS provides a multi-layered GPU acceleration system:

- **Native wgpu Integration**: WebGPU compute pipeline for shader-based operations
- **CUDA Support**: ffmpeg CUDA acceleration for video processing
- **GPU Tier Policy**: Adaptive effects based on hardware capabilities
- **Performance Monitoring**: Real-time GPU metrics and resource tracking

---

## Architecture

### Layered Acceleration Stack

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Image Editor│  │ Video Editor│  │   3D Preview        │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │              │
│         └────────────────┼─────────────────────┘              │
│                          │                                    │
│                   ┌──────▼──────┐                            │
│                   │  GPU Runtime │                            │
│                   │  (wgpu)     │                            │
│                   └──────┬──────┘                            │
│                          │                                    │
│                   ┌──────▼──────┐                            │
│                   │  Compute    │                            │
│                   │  Pipeline   │                            │
│                   └──────┬──────┘                            │
│                          │                                    │
│         ┌────────────────┼────────────────┐                  │
│         │                │                │                  │
│  ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐          │
│  │   CUDA      │  │   OpenCL    │  │   CPU       │          │
│  │   (ffmpeg)  │  │   (fallback)│  │   (fallback)│          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Layer | Responsibility | Technologies |
|-------|---------------|--------------|
| **Application** | UI rendering, preview display | React, Canvas, WebGL |
| **GPU Runtime** | Compute pipeline management | wgpu, WebGPU API |
| **Compute Pipeline** | Shader compilation, buffer management | WGSL, SPIR-V |
| **Acceleration** | Hardware-specific optimization | CUDA, OpenCL, CPU |

---

## wgpu Integration

### Native WebGPU Compute

GreebleFS integrates wgpu for GPU-accelerated compute operations.

### Device Initialization

```rust
// gpu-pipeline/src/device.rs
pub struct GpuComputeDevice {
    device: Arc<wgpu::Device>,
    queue: Arc<wgpu::Queue>,
    pipeline_cache: PipelineCache,
    buffer_pool: BufferPool,
    staging_pool: StagingBufferPool,
}

impl GpuComputeDevice {
    pub async fn init() -> Result<Arc<Mutex<Self>>, GpuError> {
        let instance = wgpu::Instance::new(wgpu::InstanceDescriptor {
            backends: wgpu::Backends::all(),
            dx12_shader_compiler: Default::default(),
        });
        
        let adapter = instance
            .request_adapter(&wgpu::RequestAdapterOptions {
                power_preference: wgpu::PowerPreference::HighPerformance,
                compatible_surface: None,
            })
            .await
            .ok_or(GpuError::NoAdapter)?;
        
        let (device, queue) = adapter
            .request_device(&wgpu::DeviceDescriptor {
                label: Some("GreebleFS GPU Device"),
                features: wgpu::Features::COMPUTE_SHADERS,
                limits: wgpu::Limits::default(),
            })
            .await?;
        
        Ok(Arc::new(Mutex::new(Self {
            device: Arc::new(device),
            queue: Arc::new(queue),
            pipeline_cache: PipelineCache::new(Arc::clone(&device)),
            buffer_pool: BufferPool::new(),
            staging_pool: StagingBufferPool::new(),
        })))
    }
}
```

### Compute Pipeline

```rust
pub struct ComputePipeline {
    device: Arc<wgpu::Device>,
    pipeline: wgpu::ComputePipeline,
    bind_group_layout: wgpu::BindGroupLayout,
}

impl ComputePipeline {
    pub fn from_wgsl(
        device: Arc<wgpu::Device>,
        shader_name: &str,
        source: &str,
        entry_point: &str,
    ) -> Result<Self, GpuError> {
        let module = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some(shader_name),
            source: wgpu::ShaderSource::Wgsl(source.into()),
        });
        
        let pipeline_layout = device.create_pipeline_layout(
            &wgpu::PipelineLayoutDescriptor {
                label: Some(&format!("{}_layout", shader_name)),
                bind_group_layouts: &[],
                push_constant_ranges: &[],
            }
        );
        
        let pipeline = device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
            label: Some(shader_name),
            layout: Some(&pipeline_layout),
            module: &module,
            entry_point,
        });
        
        Ok(Self {
            device,
            pipeline,
            bind_group_layout: pipeline_layout.bind_group_layouts()[0].clone(),
        })
    }
    
    pub fn dispatch(
        &self,
        command_encoder: &mut wgpu::CommandEncoder,
        bind_group: &wgpu::BindGroup,
        workgroup_count: (u32, u32, u32),
    ) {
        let mut compute_pass = command_encoder.begin_compute_pass(
            &wgpu::ComputePassDescriptor {
                label: Some("compute_pass"),
            }
        );
        
        compute_pass.set_pipeline(&self.pipeline);
        compute_pass.set_bind_group(0, bind_group, &[]);
        compute_pass.dispatch_workgroups(
            workgroup_count.0,
            workgroup_count.1,
            workgroup_count.2,
        );
    }
}
```

### Buffer Management

```rust
pub struct BufferPool {
    device: Arc<wgpu::Device>,
    free_buffers: Vec<(wgpu::Buffer, u64)>,
    config: BufferPoolConfig,
}

impl BufferPool {
    pub fn get_buffer(
        &self,
        size: u64,
        usage: wgpu::BufferUsages,
    ) -> Result<wgpu::Buffer, GpuError> {
        // Try to reuse a buffer
        if let Some(index) = self.free_buffers
            .iter()
            .position(|(buffer, buffer_size)| {
                *buffer_size >= size && buffer.usage().contains(usage)
            })
        {
            let (buffer, _) = self.free_buffers.remove(index);
            return Ok(buffer);
        }
        
        // Create new buffer
        let buffer = self.device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("pooled_buffer"),
            size,
            usage,
            mapped_at_creation: false,
        });
        
        Ok(buffer)
    }
    
    pub fn return_buffer(&self, buffer: wgpu::Buffer, size: u64) {
        self.free_buffers.push((buffer, size));
    }
}
```

---

## CUDA Support

### ffmpeg CUDA Acceleration

GreebleFS uses CUDA-accelerated ffmpeg for video processing tasks.

### Video Processing Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                    Video Processing                          │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Input     │  │   Decode    │  │   Process           │  │
│  │   File      │──▶│   (CUDA)   │──▶│   (CUDA)           │  │
│  └─────────────┘  └─────────────┘  └──────────┬──────────┘  │
│                                                │              │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────▼──────────┐  │
│  │   Output    │  │   Encode    │  │   Filter            │  │
│  │   File      │◀──│   (CUDA)   │◀──│   (CUDA)           │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### CUDA-Accelerated Operations

| Operation | CUDA Benefit | Use Case |
|-----------|-------------|----------|
| **Decode** | Hardware-accelerated decoding | 4K/8K video playback |
| **Encode** | Hardware-accelerated encoding | Video export, trim |
| **Filter** | GPU-based image processing | Color correction, effects |
| **Transcode** | Full pipeline acceleration | Format conversion |

### FFmpeg Configuration

```bash
# Check CUDA support
ffmpeg -hide_banner -encoders | grep nvenc
ffmpeg -hide_banner -decoders | grep h264_cuvid

# Example: CUDA-accelerated transcoding
ffmpeg -hwaccel cuda -i input.mp4 \
    -c:v h264_nvenc -preset p7 -cq 23 \
    -c:a copy output.mp4

# Example: GPU-based filtering
ffmpeg -hwaccel cuda -i input.mp4 \
    -vf "eq=brightness=0.1:saturation=1.5,scale_npp=1920:1080" \
    -c:v h264_nvenc output.mp4
```

### Rust Integration

```rust
// video_commands.rs
pub async fn video_export_trim(
    request: VideoTrimExportRequest,
) -> Result<VideoTrimExportResult, String> {
    let input_path = &request.input_path;
    let output_path = &request.output_path;
    let start_time = request.start_time;
    let end_time = request.end_time;
    
    // Build ffmpeg command with CUDA
    let mut cmd = Command::new("ffmpeg");
    cmd.arg("-y")
       .arg("-hwaccel")
       .arg("cuda")
       .arg("-i")
       .arg(input_path)
       .arg("-ss")
       .arg(start_time.to_string())
       .arg("-to")
       .arg(end_time.to_string())
       .arg("-c:v")
       .arg("h264_nvenc")
       .arg("-preset")
       .arg("p4")
       .arg("-cq")
       .arg("23")
       .arg("-c:a")
       .arg("copy")
       .arg(output_path);
    
    // Execute and capture output
    let output = cmd.output().await?;
    
    if output.status.success() {
        Ok(VideoTrimExportResult {
            success: true,
            output_path: output_path.to_string(),
            duration: end_time - start_time,
        })
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}
```

---

## GPU Tier Policy

### Adaptive Effects System

GreebleFS adapts visual effects based on GPU capabilities.

### Tier Definitions

```typescript
interface GPUTierPolicy {
  mode: 'auto' | 'safe' | 'integrated' | 'discrete';
  effects: {
    full: string[];      // Effects enabled for discrete GPUs
    reduced: string[];   // Effects enabled for integrated GPUs
    minimal: string[];   // Effects enabled for weak GPUs
  };
}

const defaultGPUTierPolicy: GPUTierPolicy = {
  mode: 'auto',
  effects: {
    full: [
      'shaders',
      'animations',
      'blur-effects',
      'reflections',
      'particles',
      'transitions'
    ],
    reduced: [
      'shaders',
      'animations',
      'blur-effects:low',
      'transitions'
    ],
    minimal: [
      'animations:basic',
      'transitions:simple'
    ]
  }
};
```

### Tier Detection

```typescript
async function detectGPUTier(): Promise<GPUTier> {
  const adapter = await navigator.gpu?.requestAdapter();
  
  if (!adapter) {
    return 'cpu';
  }
  
  const info = adapter.info;
  const tier = detectTierFromInfo(info);
  
  // Check for discrete GPU
  if (info.type === 'discrete GPU') {
    return 'discrete';
  }
  
  // Check for integrated GPU with good performance
  if (info.type === 'integrated GPU') {
    const performance = await adapter.requestDevice?.()
      .then(() => 'high')
      .catch(() => 'low');
    
    return performance === 'high' ? 'integrated' : 'low';
  }
  
  return 'cpu';
}

function detectTierFromInfo(info: GPUAdapterInfo): GPUTier {
  // Heuristic-based tier detection
  const vendor = info.vendor.toLowerCase();
  const device = info.device.toLowerCase();
  
  // Check for known high-performance GPUs
  const highPerformancePatterns = [
    'rtx', 'gtx 10', 'gtx 16', 'rx 6', 'rx 7', 'rx 8'
  ];
  
  if (highPerformancePatterns.some(p => 
    vendor.includes(p) || device.includes(p)
  )) {
    return 'discrete';
  }
  
  // Check for known integrated GPUs
  const integratedPatterns = [
    'intel hd', 'intel uhd', 'intel iris',
    'amd Radeon Vega', 'amd Radeon Graphics'
  ];
  
  if (integratedPatterns.some(p => 
    vendor.includes(p) || device.includes(p)
  )) {
    return 'integrated';
  }
  
  return 'cpu';
}
```

### Applying Tier Effects

```typescript
function applyGPUTier(tier: GPUTier): void {
  const policy = settingsStore.get('gpuTierPolicy');
  const effects = policy.effects[tier];
  
  // Update CSS variables
  const root = document.documentElement;
  effects.forEach(effect => {
    const [name, level] = effect.split(':');
    const value = level || 'enabled';
    root.style.setProperty(`--effect-${name}`, value);
  });
  
  // Update shader runtime
  shaderRuntime.setEffectsTier(tier);
  
  // Update animation system
  animationSystem.setEffectsTier(tier);
}
```

---

## Acceleration Routing

### Cross-Provider Compute

GreebleFS routes compute tasks to the optimal provider.

### Provider Selection

```typescript
type ComputeProvider = 'cpu' | 'wgpu' | 'cuda' | 'python';

interface ComputeTask {
  id: string;
  kind: 'image-processing' | 'video-processing' | 'audio-processing' | 'model-rendering';
  input: unknown;
  options: ComputeOptions;
}

interface ComputeOptions {
  preferredProvider?: ComputeProvider;
  fallbackProviders?: ComputeProvider[];
  timeout?: number;
  memoryLimit?: number;
}

async function routeComputeTask(
  task: ComputeTask
): Promise<ComputeResult> {
  const providers = getOptimalProviders(task.kind);
  
  for (const provider of providers) {
    try {
      const result = await executeOnProvider(provider, task);
      return result;
    } catch (error) {
      console.warn(`Provider ${provider} failed:`, error);
      continue;
    }
  }
  
  throw new Error('All providers failed');
}

function getOptimalProviders(
  taskKind: ComputeTask['kind']
): ComputeProvider[] {
  const providerOrder: Record<ComputeProvider[], ComputeProvider[]> = {
    'image-processing': ['cuda', 'wgpu', 'python', 'cpu'],
    'video-processing': ['cuda', 'wgpu', 'python', 'cpu'],
    'audio-processing': ['wgpu', 'python', 'cpu'],
    'model-rendering': ['cuda', 'wgpu', 'python', 'cpu'],
  };
  
  return providerOrder[taskKind] || ['cpu'];
}
```

### Python-Sidecar CUDA

```python
# python-sidecar/cuda_processing.py
import torch
import cv2
import numpy as np
from PIL import Image

class CUDAProcessor:
    def __init__(self):
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.cuda_available = torch.cuda.is_available()
        
    def process_image(self, image_data: bytes) -> bytes:
        """CUDA-accelerated image processing"""
        if self.cuda_available:
            return self._process_image_cuda(image_data)
        return self._process_image_cpu(image_data)
    
    def _process_image_cuda(self, image_data: bytes) -> bytes:
        """GPU-accelerated image processing"""
        # Load image to GPU
        image = Image.open(io.BytesIO(image_data)).convert('RGB')
        tensor = torch.from_numpy(np.array(image)).float()
        tensor = tensor.permute(2, 0, 1).unsqueeze(0)
        tensor = tensor.to(self.device)
        
        # Apply GPU-accelerated processing
        # ... processing logic ...
        
        # Return result
        output = tensor.squeeze(0).cpu().numpy()
        output = Image.fromarray(output.astype('uint8'))
        
        buffer = io.BytesIO()
        output.save(buffer, format='PNG')
        return buffer.getvalue()
    
    def get_memory_info(self) -> dict:
        """Get GPU memory information"""
        if self.cuda_available:
            return {
                'allocated': torch.cuda.memory_allocated(),
                'cached': torch.cuda.memory_cached(),
                'total': torch.cuda.get_device_properties(0).total_memory,
            }
        return {'cuda_available': False}
```

---

## Performance Monitoring

### GPU Metrics

```typescript
interface GPUMetrics {
  memory: {
    used: number;
    allocated: number;
    cached: number;
    total: number;
  };
  utilization: {
    compute: number;
    memory: number;
    encoder: number;
    decoder: number;
  };
  temperature?: number;
  power?: number;
}

async function getGPUMetrics(): Promise<GPUMetrics> {
  // Query WebGPU metrics
  const adapter = await navigator.gpu?.requestAdapter();
  if (!adapter) {
    return null;
  }
  
  // Get device properties
  const device = await adapter.requestDevice();
  
  // Query performance metrics
  const metrics: GPUMetrics = {
    memory: {
      used: 0, // WebGPU doesn't expose this directly
      allocated: 0,
      cached: 0,
      total: adapter.limits.maxBufferSize,
    },
    utilization: {
      compute: 0,
      memory: 0,
      encoder: 0,
      decoder: 0,
    }
  };
  
  return metrics;
}
```

### Rust Performance Monitoring

```rust
// gpu-pipeline/src/performance.rs
pub struct PerformanceStats {
    buffer_allocations: u64,
    buffer_deallocations: u64,
    buffer_memory_allocated: u64,
    pipeline_compilations: u64,
    compute_dispatches: u64,
    frame_count: u64,
}

pub struct PerformanceMonitor {
    stats: Mutex<PerformanceStats>,
    start_time: Instant,
}

impl PerformanceMonitor {
    pub fn new() -> Self {
        Self {
            stats: Mutex::new(PerformanceStats {
                buffer_allocations: 0,
                buffer_deallocations: 0,
                buffer_memory_allocated: 0,
                pipeline_compilations: 0,
                compute_dispatches: 0,
                frame_count: 0,
            }),
            start_time: Instant::now(),
        }
    }
    
    pub fn record_buffer_allocation(&self, size: u64) {
        let mut stats = self.stats.lock().unwrap();
        stats.buffer_allocations += 1;
        stats.buffer_memory_allocated += size;
    }
    
    pub fn record_pipeline_compilation(&self, duration: Duration) {
        let mut stats = self.stats.lock().unwrap();
        stats.pipeline_compilations += 1;
        // Log duration for telemetry
    }
    
    pub fn get_stats(&self) -> PerformanceStats {
        *self.stats.lock().unwrap()
    }
    
    pub fn reset(&self) {
        let mut stats = self.stats.lock().unwrap();
        *stats = PerformanceStats {
            buffer_allocations: 0,
            buffer_deallocations: 0,
            buffer_memory_allocated: 0,
            pipeline_compilations: 0,
            compute_dispatches: 0,
            frame_count: 0,
        };
    }
}
```

### Frame Telemetry

```typescript
// frameTelemetry.ts
interface FrameTelemetryStats {
  avgFrameMs: number;
  avgFps: number;
  p95FrameMs: number;
  worstFrameMs: number;
  frameCount: number;
  overBudgetCount: number;
  withinTarget: boolean;
  windowDurationMs: number;
}

function recordFrameTelemetry(
  frameDuration: number,
  metadata: Record<string, number | string | boolean> = {}
): void {
  const frameDurations = getFrameDurationHistory();
  frameDurations.push(frameDuration);
  
  // Keep last 300 frames (~5 seconds at 60fps)
  if (frameDurations.length > 300) {
    frameDurations.shift();
  }
  
  const stats = summarizeFrameWindow(
    frameDurations,
    5000 // 5 second window
  );
  
  // Record performance sample
  recordPerformanceSample({
    metricId: 'frame-rate',
    durationMs: frameDuration,
    recordedAt: Date.now(),
    metadata
  });
  
  // Update HUD if visible
  updatePerformanceHud(stats);
}

function summarizeFrameWindow(
  frameDurations: number[],
  windowDurationMs: number
): FrameTelemetryStats {
  const sorted = [...frameDurations].sort((a, b) => a - b);
  const frameCount = sorted.length;
  
  const avgFrameMs = sorted.reduce((a, b) => a + b, 0) / frameCount;
  const avgFps = 1000 / avgFrameMs;
  const p95FrameMs = sorted[Math.floor(frameCount * 0.95)];
  const worstFrameMs = sorted[frameCount - 1];
  
  const overBudgetCount = sorted.filter(d => d > 16.67).length; // > 60fps budget
  const withinTarget = overBudgetCount / frameCount < 0.05; // < 5% over budget
  
  return {
    avgFrameMs,
    avgFps,
    p95FrameMs,
    worstFrameMs,
    frameCount,
    overBudgetCount,
    withinTarget,
    windowDurationMs
  };
}
```

---

## 3D Model Thumbnail Generation

### GPU-Backed Rendering

GreebleFS uses GPU acceleration for 3D model thumbnail generation.

### Pipeline

```typescript
interface ModelThumbnailRequest {
  modelPath: string;
  width: number;
  height: number;
  format: 'png' | 'jpg' | 'webp';
  backgroundColor?: string;
  cameraPosition?: [number, number, number];
  lighting?: LightingConfig;
}

interface LightingConfig {
  ambient: number;
  directional: {
    position: [number, number, number];
    intensity: number;
    color: string;
  }[];
}

async function generateModelThumbnail(
  request: ModelThumbnailRequest
): Promise<string> {
  // Check cache first
  const cacheKey = generateCacheKey(request);
  const cached = await getThumbnailCache().get(cacheKey);
  if (cached) {
    return cached;
  }
  
  // Load model
  const model = await loadModel(request.modelPath);
  
  // Create GPU renderer
  const renderer = await createGPURenderer({
    width: request.width,
    height: request.height,
    backgroundColor: request.backgroundColor,
  });
  
  // Set up scene
  await renderer.setScene(model.scene);
  await renderer.setCamera(request.cameraPosition);
  await renderer.setLighting(request.lighting);
  
  // Render thumbnail
  const imageData = await renderer.render();
  
  // Encode to requested format
  const encoded = await encodeImage(imageData, request.format);
  
  // Cache result
  await getThumbnailCache().set(cacheKey, encoded);
  
  return encoded;
}
```

### Rust Implementation

```rust
// thumbnail_commands.rs
pub async fn fs_read_entry_thumbnail(
    app: AppHandle,
    request: ExplorerEntryThumbnailRequest,
) -> Result<ExplorerEntryThumbnail, String> {
    let path = Path::new(&request.path);
    
    // Check cache
    if let Some(cached) = thumbnail_cache.get(path) {
        return Ok(cached);
    }
    
    // Generate based on file type
    let thumbnail = match detect_file_type(path) {
        FileType::Image => generate_image_thumbnail(path, request.size).await?,
        FileType::Video => generate_video_thumbnail(path, request.size).await?,
        FileType::Model3D => generate_model_thumbnail(path, request.size).await?,
        FileType::Pdf => generate_pdf_thumbnail(path, request.size).await?,
        _ => generate_default_thumbnail(request.size),
    };
    
    // Cache result
    thumbnail_cache.insert(path, &thumbnail);
    
    Ok(thumbnail)
}

async fn generate_model_thumbnail(
    path: &Path,
    size: u32,
) -> Result<ExplorerEntryThumbnail, String> {
    // Load 3D model
    let model = load_model(path)?;
    
    // Create GPU renderer
    let mut renderer = GpuModelRenderer::new(size, size)?;
    
    // Configure rendering
    renderer.set_background_color([0.1, 0.1, 0.1, 1.0]);
    renderer.set_camera_position([0.0, 0.0, 5.0]);
    renderer.add_directional_light([1.0, 1.0, 1.0], 1.0);
    
    // Render
    let image = renderer.render(&model)?;
    
    // Encode as PNG
    let mut buffer = Vec::new();
    let mut encoder = png::Encoder::new(&mut buffer, size, size);
    encoder.set_color(png::ColorType::Rgba);
    encoder.set_depth(png::BitDepth::Eight);
    encoder.write_header()?;
    encoder.write_image_data(&image)?;
    
    Ok(ExplorerEntryThumbnail {
        data: buffer,
        format: "png",
        width: size,
        height: size,
    })
}
```

---

## Shader Runtime

### WebGPU Shaders

GreebleFS supports WGSL shaders for custom GPU computations.

### Shader Compilation

```typescript
interface ShaderModule {
  id: string;
  name: string;
  source: string;
  entryPoint: string;
  bindGroupLayouts: BindGroupLayoutDescriptor[];
}

async function compileShader(
  source: string,
  entryPoint: string
): Promise<GPUShaderModule> {
  const device = await getGPUDevice();
  
  const module = device.createShaderModule({
    label: 'custom_shader',
    code: source,
  });
  
  // Wait for compilation
  const compilationInfo = await module.getCompilationInfo();
  
  if (compilationInfo.messages.length > 0) {
    const errors = compilationInfo.messages
      .filter(m => m.type === 'error')
      .map(m => m.message);
    
    if (errors.length > 0) {
      throw new Error(`Shader compilation failed:\n${errors.join('\n')}`);
    }
  }
  
  return module;
}
```

### Compute Shader Example

```wgsl
// Image processing compute shader
struct ImageData {
    width: u32,
    height: u32,
    data: array<vec4<f32>>,
}

@group(0) @binding(0) var<storage, read> input: ImageData;
@group(0) @binding(1) var<storage, read_write> output: ImageData;

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let x = global_id.x;
    let y = global_id.y;
    
    if (x >= input.width || y >= input.height) {
        return;
    }
    
    let index = y * input.width + x;
    
    // Get pixel
    let pixel = input.data[index];
    
    // Apply brightness adjustment
    let adjusted = vec4<f32>(
        pixel.r * 1.1,
        pixel.g * 1.1,
        pixel.b * 1.1,
        pixel.a
    );
    
    // Clamp values
    output.data[index] = min(max(adjusted, vec4<f32>(0.0)), vec4<f32>(1.0));
}
```

---

## Summary

GreebleFS GPU and CUDA capabilities provide:

- **wgpu Integration**: Native WebGPU compute pipeline for shader operations
- **CUDA Support**: ffmpeg CUDA acceleration for video processing
- **GPU Tier Policy**: Adaptive effects based on hardware capabilities
- **Acceleration Routing**: Cross-provider compute task routing
- **Performance Monitoring**: Real-time GPU metrics and frame telemetry
- **3D Thumbnail Generation**: GPU-accelerated model rendering
- **Shader Runtime**: WGSL shader compilation and execution
- **Buffer Pooling**: Efficient GPU memory management
- **Staging Buffers**: Optimized data transfer between CPU/GPU

The acceleration system enables GreebleFS to handle demanding tasks like 4K video processing, 3D model preview, and real-time image effects while maintaining responsiveness on the main thread.