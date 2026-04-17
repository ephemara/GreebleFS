//! WGPU Device Management
//!
//! Singleton for shared GPU device access across all compute pipelines.

#[cfg(not(target_arch = "wasm32"))]
use once_cell::sync::OnceCell;
use parking_lot::Mutex;
#[cfg(target_arch = "wasm32")]
use std::cell::RefCell;
use std::sync::Arc;

#[cfg(not(target_arch = "wasm32"))]
static GPU_DEVICE: OnceCell<Arc<Mutex<GpuComputeDevice>>> = OnceCell::new();
#[cfg(target_arch = "wasm32")]
thread_local! {
    static GPU_DEVICE: RefCell<Option<Arc<Mutex<GpuComputeDevice>>>> = RefCell::new(None);
}

static INIT_LOCK: Mutex<()> = Mutex::new(());

type GpuErrorCallback = Box<dyn Fn(String, String) + Send + Sync>;

static GPU_ERROR_HANDLER: OnceCell<GpuErrorCallback> = OnceCell::new();

pub fn register_gpu_error_handler(handler: impl Fn(String, String) + Send + Sync + 'static) {
    let _ = GPU_ERROR_HANDLER.set(Box::new(handler));
}

fn dispatch_gpu_error(message: String, context: String) {
    if let Some(handler) = GPU_ERROR_HANDLER.get() {
        handler(message, context);
    } else {
        log::error!("[GPU] Uncaptured wgpu error ({}): {}", context, message);
    }
}

fn required_limits() -> wgpu::Limits {
    wgpu::Limits {
        max_storage_textures_per_shader_stage: 8,
        ..wgpu::Limits::default()
    }
}

pub struct GpuComputeDevice {
    pub device: wgpu::Device,
    pub queue: wgpu::Queue,
    pub adapter_info: wgpu::AdapterInfo,
    pub force_sync: bool,
}

impl GpuComputeDevice {
    #[cfg(not(target_arch = "wasm32"))]
    pub async fn init() -> Result<Arc<Mutex<Self>>, String> {
        if let Some(existing) = GPU_DEVICE.get() {
            return Ok(existing.clone());
        }

        let _guard = INIT_LOCK.lock();

        if let Some(existing) = GPU_DEVICE.get() {
            return Ok(existing.clone());
        }

        let instance = wgpu::Instance::new(&wgpu::InstanceDescriptor {
            backends: wgpu::Backends::all(),
            ..Default::default()
        });

        let adapter = instance
            .request_adapter(&wgpu::RequestAdapterOptions {
                power_preference: wgpu::PowerPreference::HighPerformance,
                compatible_surface: None,
                force_fallback_adapter: false,
            })
            .await
            .map_err(|e| format!("Failed to find GPU adapter: {:?}", e))?;

        let adapter_info = adapter.get_info();
        log::info!(
            "[GpuComputeDevice] Using GPU: {} ({:?})",
            adapter_info.name,
            adapter_info.backend
        );

        let (device, queue) = adapter
            .request_device(&wgpu::DeviceDescriptor {
                label: Some("kos_gpu_compute"),
                required_features: wgpu::Features::empty(),
                required_limits: required_limits(),
                memory_hints: wgpu::MemoryHints::default(),
                trace: wgpu::Trace::default(),
            })
            .await
            .map_err(|e| format!("Failed to create device: {}", e))?;

        device.on_uncaptured_error(Box::new(|error| {
            let (category, message) = match &error {
                wgpu::Error::Validation { description, .. } => {
                    ("Validation".to_string(), description.clone())
                }
                wgpu::Error::OutOfMemory { .. } => {
                    ("OutOfMemory".to_string(), format!("{}", error))
                }
                wgpu::Error::Internal { description, .. } => {
                    ("Other".to_string(), description.clone())
                }
            };
            log::error!("[GPU Doctor] wgpu {} error: {}", category, message);
            dispatch_gpu_error(message, category);
        }));

        let force_sync = std::env::var("K_OS_GPU_SYNC").is_ok();
        let gpu = Arc::new(Mutex::new(Self {
            device,
            queue,
            adapter_info,
            force_sync,
        }));

        GPU_DEVICE
            .set(gpu.clone())
            .map_err(|_| "GPU already initialized (unexpected)")?;

        log::info!("[GpuComputeDevice] Initialization complete");
        if force_sync {
            log::warn!("[GpuComputeDevice] K_OS_GPU_SYNC=1 - Force sync mode enabled");
        }
        Ok(gpu)
    }

    #[cfg(target_arch = "wasm32")]
    pub async fn init() -> Result<Arc<Mutex<Self>>, String> {
        let instance = wgpu::Instance::new(&wgpu::InstanceDescriptor {
            backends: wgpu::Backends::all(),
            ..Default::default()
        });
        let adapter = instance
            .request_adapter(&wgpu::RequestAdapterOptions {
                power_preference: wgpu::PowerPreference::HighPerformance,
                compatible_surface: None,
                force_fallback_adapter: false,
            })
            .await
            .map_err(|e| format!("Failed to find GPU adapter: {:?}", e))?;
        let adapter_info = adapter.get_info();
        let (device, queue) = adapter
            .request_device(&wgpu::DeviceDescriptor {
                label: Some("kos_gpu_compute"),
                required_features: wgpu::Features::empty(),
                required_limits: required_limits(),
                memory_hints: wgpu::MemoryHints::default(),
                trace: wgpu::Trace::default(),
            })
            .await
            .map_err(|e| format!("Failed to create device: {}", e))?;
        let gpu = Arc::new(Mutex::new(Self {
            device,
            queue,
            adapter_info,
            force_sync: false,
        }));
        GPU_DEVICE.with(|cell| {
            *cell.borrow_mut() = Some(gpu.clone());
        });
        Ok(gpu)
    }

    #[cfg(not(target_arch = "wasm32"))]
    pub fn get() -> Arc<Mutex<Self>> {
        GPU_DEVICE
            .get()
            .expect("GPU not initialized - call init() first")
            .clone()
    }

    #[cfg(target_arch = "wasm32")]
    pub fn get() -> Arc<Mutex<Self>> {
        GPU_DEVICE
            .with(|cell| cell.borrow().clone())
            .expect("GPU not initialized - call init().await first")
    }

    #[cfg(not(target_arch = "wasm32"))]
    pub fn try_get() -> Option<Arc<Mutex<Self>>> {
        GPU_DEVICE.get().cloned()
    }

    #[cfg(target_arch = "wasm32")]
    pub fn try_get() -> Option<Arc<Mutex<Self>>> {
        GPU_DEVICE.with(|cell| cell.borrow().clone())
    }

    #[cfg(not(target_arch = "wasm32"))]
    pub fn get_or_init_blocking() -> Result<Arc<Mutex<Self>>, String> {
        if let Some(existing) = GPU_DEVICE.get() {
            return Ok(existing.clone());
        }
        pollster::block_on(Self::init())
    }

    #[cfg(target_arch = "wasm32")]
    pub fn get_or_init_blocking() -> Result<Arc<Mutex<Self>>, String> {
        GPU_DEVICE
            .with(|cell| cell.borrow().clone())
            .ok_or("GPU not initialized - call init().await first".to_string())
    }

    #[cfg(not(target_arch = "wasm32"))]
    pub fn init_from_bevy(
        device: &wgpu::Device,
        queue: &wgpu::Queue,
    ) -> Result<Arc<Mutex<Self>>, String> {
        if let Some(existing) = GPU_DEVICE.get() {
            return Ok(existing.clone());
        }

        let _guard = INIT_LOCK.lock();

        if let Some(existing) = GPU_DEVICE.get() {
            return Ok(existing.clone());
        }

        let force_sync = std::env::var("K_OS_GPU_SYNC").is_ok();
        let gpu = Arc::new(Mutex::new(Self {
            device: device.clone(),
            queue: queue.clone(),
            adapter_info: wgpu::AdapterInfo {
                name: "Bevy RenderDevice".to_string(),
                vendor: 0,
                device: 0,
                device_type: wgpu::DeviceType::Other,
                driver: String::new(),
                driver_info: String::new(),
                backend: wgpu::Backend::Vulkan,
            },
            force_sync,
        }));

        GPU_DEVICE
            .set(gpu.clone())
            .map_err(|_| "GPU already initialized (unexpected)")?;

        log::info!("[GpuComputeDevice] Initialized from Bevy RenderDevice");
        if force_sync {
            log::warn!("[GpuComputeDevice] K_OS_GPU_SYNC=1 - Force sync mode enabled");
        }
        Ok(gpu)
    }

    pub fn submit_and_sync(&self, command_buffer: wgpu::CommandBuffer) {
        self.queue.submit(std::iter::once(command_buffer));
        if self.force_sync {
            self.device.poll(wgpu::PollType::Wait).ok();
        }
    }

    pub fn submit_many_and_sync(
        &self,
        command_buffers: impl IntoIterator<Item = wgpu::CommandBuffer>,
    ) {
        self.queue.submit(command_buffers);
        if self.force_sync {
            self.device.poll(wgpu::PollType::Wait).ok();
        }
    }

    pub fn new_mock() -> Self {
        pollster::block_on(async {
            let instance = wgpu::Instance::new(&wgpu::InstanceDescriptor {
                backends: wgpu::Backends::all(),
                ..Default::default()
            });

            let adapter = instance
                .request_adapter(&wgpu::RequestAdapterOptions {
                    power_preference: wgpu::PowerPreference::default(),
                    compatible_surface: None,
                    force_fallback_adapter: false,
                })
                .await
                .expect("Failed to find GPU adapter for testing");

            let adapter_info = adapter.get_info();

            let (device, queue) = adapter
                .request_device(&wgpu::DeviceDescriptor {
                    label: Some("Test GPU Device"),
                    required_features: wgpu::Features::empty(),
                    required_limits: wgpu::Limits::default(),
                    memory_hints: wgpu::MemoryHints::default(),
                    trace: wgpu::Trace::default(),
                })
                .await
                .expect("Failed to create GPU device for testing");

            Self {
                device,
                queue,
                adapter_info,
                force_sync: false,
            }
        })
    }
}
