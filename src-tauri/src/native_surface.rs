use std::{
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    thread::JoinHandle,
    time::{Duration, Instant},
};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::window_commands::MAIN_WINDOW_LABEL;

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct NativeSurfaceTelemetry {
    pub available: bool,
    pub running: bool,
    pub visual_hosting_mode: String,
    pub composition_controller_ready: bool,
    pub wgpu_surface_ready: bool,
    pub adapter_name: Option<String>,
    pub backend: Option<String>,
    pub surface_format: Option<String>,
    pub window_label: String,
    pub width: u32,
    pub height: u32,
    pub frames_rendered: u64,
    pub average_frame_ms: Option<f64>,
    pub last_error: Option<String>,
    pub last_updated_at_unix_ms: u64,
}

impl NativeSurfaceTelemetry {
    fn unavailable(window_label: impl Into<String>, reason: impl Into<String>) -> Self {
        Self {
            available: false,
            running: false,
            visual_hosting_mode: "unavailable".to_string(),
            composition_controller_ready: false,
            wgpu_surface_ready: false,
            adapter_name: None,
            backend: None,
            surface_format: None,
            window_label: window_label.into(),
            width: 0,
            height: 0,
            frames_rendered: 0,
            average_frame_ms: None,
            last_error: Some(reason.into()),
            last_updated_at_unix_ms: current_unix_ms(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct NativeSurfaceResizeRequest {
    pub width: u32,
    pub height: u32,
}

pub struct NativeSurfaceManager {
    telemetry: Arc<Mutex<NativeSurfaceTelemetry>>,
    #[cfg(target_os = "windows")]
    session: Mutex<Option<NativeSurfaceSession>>,
}

struct NativeSurfaceSession {
    stop: Arc<AtomicBool>,
    resize_request: Arc<Mutex<(u32, u32)>>,
    join_handle: Option<JoinHandle<()>>,
}

impl NativeSurfaceManager {
    pub fn new() -> Self {
        Self {
            telemetry: Arc::new(Mutex::new(NativeSurfaceTelemetry::unavailable(
                MAIN_WINDOW_LABEL,
                "native surface not started",
            ))),
            #[cfg(target_os = "windows")]
            session: Mutex::new(None),
        }
    }

    pub fn telemetry(&self) -> NativeSurfaceTelemetry {
        self.telemetry
            .lock()
            .map(|telemetry| telemetry.clone())
            .unwrap_or_else(|_| {
                NativeSurfaceTelemetry::unavailable(
                    MAIN_WINDOW_LABEL,
                    "native surface telemetry lock poisoned",
                )
            })
    }

    pub fn start_main_surface(&self, app: &AppHandle) -> NativeSurfaceTelemetry {
        #[cfg(target_os = "windows")]
        {
            self.start_main_surface_windows(app);
        }

        #[cfg(not(target_os = "windows"))]
        {
            self.set_unavailable("native surface is Windows-only");
        }

        self.telemetry()
    }

    pub fn resize(&self, request: NativeSurfaceResizeRequest) -> NativeSurfaceTelemetry {
        #[cfg(target_os = "windows")]
        {
            if let Ok(session_guard) = self.session.lock() {
                if let Some(session) = session_guard.as_ref() {
                    if let Ok(mut pending) = session.resize_request.lock() {
                        *pending = (request.width.max(1), request.height.max(1));
                    }
                }
            }
        }

        self.update_telemetry(|telemetry| {
            telemetry.width = request.width.max(1);
            telemetry.height = request.height.max(1);
            telemetry.last_updated_at_unix_ms = current_unix_ms();
        });

        self.telemetry()
    }

    pub fn destroy(&self) -> NativeSurfaceTelemetry {
        #[cfg(target_os = "windows")]
        {
            self.stop_windows_session();
        }

        self.update_telemetry(|telemetry| {
            telemetry.running = false;
            telemetry.last_updated_at_unix_ms = current_unix_ms();
        });

        self.telemetry()
    }

    fn update_telemetry<F: FnOnce(&mut NativeSurfaceTelemetry)>(&self, f: F) {
        if let Ok(mut telemetry) = self.telemetry.lock() {
            f(&mut telemetry);
        }
    }

    fn set_unavailable(&self, reason: impl Into<String>) {
        self.update_telemetry(|telemetry| {
            *telemetry = NativeSurfaceTelemetry::unavailable(MAIN_WINDOW_LABEL, reason);
        });
    }

    #[cfg(target_os = "windows")]
    fn start_main_surface_windows(&self, app: &AppHandle) {
        let already_running = self
            .session
            .lock()
            .ok()
            .is_some_and(|session| session.is_some());
        if already_running {
            self.update_telemetry(|telemetry| {
                telemetry.running = true;
                telemetry.last_error = None;
                telemetry.last_updated_at_unix_ms = current_unix_ms();
            });
            return;
        }

        self.update_telemetry(|telemetry| {
            telemetry.available = false;
            telemetry.running = false;
            telemetry.visual_hosting_mode = "composition-controller".to_string();
            telemetry.last_error = None;
            telemetry.window_label = MAIN_WINDOW_LABEL.to_string();
            telemetry.last_updated_at_unix_ms = current_unix_ms();
        });

        let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
            self.set_unavailable("main window not available yet");
            return;
        };

        let telemetry = Arc::clone(&self.telemetry);
        let telemetry_for_startup = Arc::clone(&telemetry);
        let session_slot = &self.session;
        let startup_result = Arc::new(Mutex::new(None::<Result<NativeSurfaceSession, String>>));
        let startup_result_for_closure = Arc::clone(&startup_result);

        let with_webview_result = window.with_webview(move |webview| {
            let result = create_windows_native_surface_session(webview, telemetry_for_startup);
            let startup_result_value = match result {
                Ok(session) => Ok(session),
                Err(error) => Err(error),
            };
            if let Ok(mut telemetry) = startup_result_for_closure.lock() {
                *telemetry = Some(startup_result_value);
            }
        });

        if let Err(error) = with_webview_result {
            self.set_unavailable(format!("with_webview failed: {error}"));
            return;
        }

        let session = startup_result
            .lock()
            .ok()
            .and_then(|mut state| state.take());

        match session {
            Some(Ok(session)) => {
                if let Ok(mut slot) = session_slot.lock() {
                    *slot = Some(session);
                }
            }
            Some(Err(error)) => {
                self.set_unavailable(error);
            }
            None => {
                self.set_unavailable("native surface session did not initialize");
            }
        }
    }

    #[cfg(target_os = "windows")]
    fn stop_windows_session(&self) {
        let session = self.session.lock().ok().and_then(|mut slot| slot.take());
        if let Some(mut session) = session {
            session.stop.store(true, Ordering::SeqCst);
            if let Some(join_handle) = session.join_handle.take() {
                let _ = join_handle.join();
            }
        }
    }
}

#[cfg(target_os = "windows")]
fn create_windows_native_surface_session(
    webview: tauri::webview::PlatformWebview,
    telemetry: Arc<Mutex<NativeSurfaceTelemetry>>,
) -> Result<NativeSurfaceSession, String> {
    let _composition_controller = webview
        .composition_controller()
        .ok_or_else(|| "WebView2 composition controller unavailable".to_string())?;
    let _composition_device = webview
        .composition_device()
        .ok_or_else(|| "DirectComposition device unavailable".to_string())?;
    let _composition_target = webview
        .composition_target()
        .ok_or_else(|| "DirectComposition target unavailable".to_string())?;
    let composition_root_visual = webview
        .composition_root_visual()
        .ok_or_else(|| "DirectComposition root visual unavailable".to_string())?;
    let _composition_webview_visual = webview
        .composition_webview_visual()
        .ok_or_else(|| "DirectComposition WebView visual unavailable".to_string())?;

    let stop = Arc::new(AtomicBool::new(false));
    let resize_request = Arc::new(Mutex::new((1_u32, 1_u32)));
    let thread_stop = Arc::clone(&stop);
    let thread_resize_request = Arc::clone(&resize_request);
    let thread_telemetry = Arc::clone(&telemetry);
    let thread_telemetry_for_error = Arc::clone(&telemetry);
    let thread_backplane_visual = composition_root_visual as usize;

    let join_handle = std::thread::spawn(move || {
        let result = render_windows_native_surface(
            thread_backplane_visual as *mut std::ffi::c_void,
            thread_resize_request,
            thread_stop,
            thread_telemetry,
        );
        if let Err(error) = result {
            if let Ok(mut telemetry) = thread_telemetry_for_error.lock() {
                telemetry.running = false;
                telemetry.wgpu_surface_ready = false;
                telemetry.last_error = Some(error);
                telemetry.last_updated_at_unix_ms = current_unix_ms();
            }
        }
    });

    if let Ok(mut telemetry_state) = telemetry.lock() {
        telemetry_state.available = true;
        telemetry_state.running = true;
        telemetry_state.visual_hosting_mode = "composition-controller".to_string();
        telemetry_state.composition_controller_ready = true;
        telemetry_state.wgpu_surface_ready = false;
        telemetry_state.adapter_name = None;
        telemetry_state.backend = None;
        telemetry_state.surface_format = None;
        telemetry_state.window_label = MAIN_WINDOW_LABEL.to_string();
        telemetry_state.frames_rendered = 0;
        telemetry_state.average_frame_ms = None;
        telemetry_state.last_error = None;
        telemetry_state.last_updated_at_unix_ms = current_unix_ms();
    }

    Ok(NativeSurfaceSession {
        stop,
        resize_request,
        join_handle: Some(join_handle),
    })
}

#[cfg(target_os = "windows")]
fn render_windows_native_surface(
    backplane_visual: *mut std::ffi::c_void,
    resize_request: Arc<Mutex<(u32, u32)>>,
    stop: Arc<AtomicBool>,
    telemetry: Arc<Mutex<NativeSurfaceTelemetry>>,
) -> Result<(), String> {
    let instance = wgpu::Instance::new(&wgpu::InstanceDescriptor {
        backends: wgpu::Backends::DX12,
        ..Default::default()
    });
    let surface = unsafe {
        instance
            .create_surface_unsafe(wgpu::SurfaceTargetUnsafe::CompositionVisual(backplane_visual))
            .map_err(|error| error.to_string())?
    };
    let adapter = pollster::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions {
        power_preference: wgpu::PowerPreference::HighPerformance,
        force_fallback_adapter: false,
        compatible_surface: Some(&surface),
    }))
    .map_err(|error| format!("request_adapter failed: {error}"))?;
    let adapter_info = adapter.get_info();
    let (device, queue) = pollster::block_on(adapter.request_device(&wgpu::DeviceDescriptor {
        label: Some("greeblefs-native-surface-device"),
        required_features: wgpu::Features::empty(),
        required_limits: adapter.limits(),
        memory_hints: wgpu::MemoryHints::Performance,
        trace: wgpu::Trace::Off,
    }))
    .map_err(|error| format!("request_device failed: {error}"))?;
    let capabilities = surface.get_capabilities(&adapter);
    let format = capabilities
        .formats
        .iter()
        .copied()
        .find(wgpu::TextureFormat::is_srgb)
        .or_else(|| capabilities.formats.first().copied())
        .ok_or_else(|| "surface returned no formats".to_string())?;
    let present_mode = capabilities
        .present_modes
        .iter()
        .copied()
        .find(|mode| *mode == wgpu::PresentMode::Mailbox)
        .unwrap_or(wgpu::PresentMode::Fifo);
    let alpha_mode = capabilities
        .alpha_modes
        .iter()
        .copied()
        .find(|mode| *mode == wgpu::CompositeAlphaMode::PreMultiplied)
        .unwrap_or(wgpu::CompositeAlphaMode::Auto);

    let initial_size = resize_request
        .lock()
        .map(|size| *size)
        .unwrap_or((1_u32, 1_u32));
    let mut renderer = NativeSurfaceRenderer {
        surface,
        device,
        queue,
        config: wgpu::SurfaceConfiguration {
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            format,
            width: initial_size.0.max(1),
            height: initial_size.1.max(1),
            present_mode,
            desired_maximum_frame_latency: 2,
            alpha_mode,
            view_formats: vec![],
        },
        width: initial_size.0.max(1),
        height: initial_size.1.max(1),
        format,
        adapter_name: adapter_info.name,
        backend: format!("{:?}", adapter_info.backend),
    };
    renderer.configure();
    update_surface_telemetry(&telemetry, |state| {
        state.wgpu_surface_ready = true;
        state.adapter_name = Some(renderer.adapter_name.clone());
        state.backend = Some(renderer.backend.clone());
        state.surface_format = Some(format!("{:?}", renderer.format));
        state.width = renderer.width;
        state.height = renderer.height;
        state.frames_rendered = 0;
        state.average_frame_ms = None;
        state.last_error = None;
        state.last_updated_at_unix_ms = current_unix_ms();
    });

    let start = Instant::now();
    let mut frames_rendered = 0_u64;
    let mut total_frame_ms = 0.0_f64;
    while !stop.load(Ordering::Relaxed) {
        let maybe_size = resize_request
            .lock()
            .map(|size| *size)
            .unwrap_or((renderer.width, renderer.height));
        renderer.resize(maybe_size.0, maybe_size.1);
        let frame_start = Instant::now();
        if renderer.render_frame(start.elapsed().as_secs_f32())? {
            frames_rendered = frames_rendered.saturating_add(1);
            let frame_ms = frame_start.elapsed().as_secs_f64() * 1000.0;
            total_frame_ms += frame_ms;
            update_surface_telemetry(&telemetry, |state| {
                state.running = true;
                state.wgpu_surface_ready = true;
                state.width = renderer.width;
                state.height = renderer.height;
                state.frames_rendered = frames_rendered;
                state.average_frame_ms = Some(total_frame_ms / frames_rendered as f64);
                state.last_error = None;
                state.last_updated_at_unix_ms = current_unix_ms();
            });
        }
        std::thread::sleep(Duration::from_millis(16));
    }

    update_surface_telemetry(&telemetry, |state| {
        state.running = false;
        state.last_updated_at_unix_ms = current_unix_ms();
    });

    Ok(())
}

#[cfg(target_os = "windows")]
fn update_surface_telemetry(
    telemetry: &Arc<Mutex<NativeSurfaceTelemetry>>,
    update: impl FnOnce(&mut NativeSurfaceTelemetry),
) {
    if let Ok(mut state) = telemetry.lock() {
        update(&mut state);
    }
}

#[cfg(target_os = "windows")]
struct NativeSurfaceRenderer {
    surface: wgpu::Surface<'static>,
    device: wgpu::Device,
    queue: wgpu::Queue,
    config: wgpu::SurfaceConfiguration,
    width: u32,
    height: u32,
    format: wgpu::TextureFormat,
    adapter_name: String,
    backend: String,
}

#[cfg(target_os = "windows")]
impl NativeSurfaceRenderer {
    fn configure(&mut self) {
        self.surface.configure(&self.device, &self.config);
    }

    fn resize(&mut self, width: u32, height: u32) {
        let width = width.max(1);
        let height = height.max(1);
        if self.width == width && self.height == height {
            return;
        }
        self.width = width;
        self.height = height;
        self.config.width = width;
        self.config.height = height;
        self.configure();
    }

    fn render_frame(&mut self, seconds: f32) -> Result<bool, String> {
        let frame = match self.surface.get_current_texture() {
            Ok(frame) => frame,
            Err(wgpu::SurfaceError::Lost | wgpu::SurfaceError::Outdated) => {
                self.configure();
                return Ok(false);
            }
            Err(wgpu::SurfaceError::Timeout) => return Ok(false),
            Err(error) => return Err(format!("surface frame acquisition failed: {error}")),
        };

        let phase = seconds * 0.9;
        let color = wgpu::Color {
            r: 0.04 + 0.11 * phase.sin().abs() as f64,
            g: 0.08 + 0.28 * (phase * 0.67).cos().abs() as f64,
            b: 0.18 + 0.48 * (phase * 1.37).sin().abs() as f64,
            a: 1.0,
        };
        let view = frame
            .texture
            .create_view(&wgpu::TextureViewDescriptor::default());
        let mut encoder = self
            .device
            .create_command_encoder(&wgpu::CommandEncoderDescriptor {
                label: Some("greeblefs-native-surface-clear"),
            });
        {
            let _pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("greeblefs-native-surface-pass"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: &view,
                    depth_slice: None,
                    resolve_target: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Clear(color),
                        store: wgpu::StoreOp::Store,
                    },
                })],
                depth_stencil_attachment: None,
                timestamp_writes: None,
                occlusion_query_set: None,
            });
        }
        self.queue.submit(Some(encoder.finish()));
        frame.present();
        Ok(true)
    }
}

impl Default for NativeSurfaceManager {
    fn default() -> Self {
        Self::new()
    }
}

pub fn register_native_surface_handlers(app: &AppHandle) -> Result<(), String> {
    let app_for_create = app.clone();
    tauri::native_control::register_handler(app, "nativeSurface", "create", move |_request| {
        let manager = app_for_create.state::<NativeSurfaceManager>();
        serde_json::to_value(manager.start_main_surface(&app_for_create))
            .map_err(|error| error.to_string())
    })?;

    let app_for_resize = app.clone();
    tauri::native_control::register_handler(app, "nativeSurface", "resize", move |request| {
        let manager = app_for_resize.state::<NativeSurfaceManager>();
        let args: NativeSurfaceResizeRequest =
            serde_json::from_value(request.args).map_err(|error| error.to_string())?;
        serde_json::to_value(manager.resize(args)).map_err(|error| error.to_string())
    })?;

    let app_for_destroy = app.clone();
    tauri::native_control::register_handler(app, "nativeSurface", "destroy", move |_request| {
        let manager = app_for_destroy.state::<NativeSurfaceManager>();
        serde_json::to_value(manager.destroy()).map_err(|error| error.to_string())
    })?;

    let app_for_telemetry = app.clone();
    tauri::native_control::register_handler(app, "nativeSurface", "telemetry", move |_request| {
        let manager = app_for_telemetry.state::<NativeSurfaceManager>();
        serde_json::to_value(manager.telemetry()).map_err(|error| error.to_string())
    })?;

    Ok(())
}

pub fn start_main_native_surface(app: &AppHandle) {
    let manager = app.state::<NativeSurfaceManager>();
    let _ = manager.start_main_surface(app);
}

fn current_unix_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}
