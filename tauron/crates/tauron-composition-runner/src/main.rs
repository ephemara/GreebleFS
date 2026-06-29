use serde::Serialize;

#[cfg(not(windows))]
fn main() {
  println!(
    "{}",
    serde_json::to_string_pretty(&CompositionRunSummary::unsupported()).unwrap()
  );
}

#[cfg(windows)]
fn main() {
  match windows_runner::run() {
    Ok(summary) => {
      println!("{}", serde_json::to_string_pretty(&summary).unwrap());
    }
    Err(error) => {
      eprintln!("tauron-composition-runner failed: {error}");
      std::process::exit(1);
    }
  }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CompositionRunSummary {
  platform: &'static str,
  supported: bool,
  composition_controller_ready: bool,
  wgpu_surface_ready: bool,
  adapter_name: Option<String>,
  backend: Option<String>,
  surface_format: Option<String>,
  width: u32,
  height: u32,
  frames_rendered: u64,
  duration_ms: u128,
  average_frame_ms: Option<f64>,
  data_lanes: CompositionDataLanes,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CompositionDataLanes {
  lifecycle: &'static str,
  hot_metadata_events: &'static str,
  finite_blobs_fallback: &'static str,
}

impl CompositionRunSummary {
  #[cfg(not(windows))]
  fn unsupported() -> Self {
    Self {
      platform: std::env::consts::OS,
      supported: false,
      composition_controller_ready: false,
      wgpu_surface_ready: false,
      adapter_name: None,
      backend: None,
      surface_format: None,
      width: 0,
      height: 0,
      frames_rendered: 0,
      duration_ms: 0,
      average_frame_ms: None,
      data_lanes: CompositionDataLanes::tauron_native_lanes(),
    }
  }
}

impl CompositionDataLanes {
  fn tauron_native_lanes() -> Self {
    Self {
      lifecycle: "native_control",
      hot_metadata_events: "native_ring",
      finite_blobs_fallback: "native_buffer_pool",
    }
  }
}

#[cfg(windows)]
mod windows_runner {
  use super::{CompositionDataLanes, CompositionRunSummary};
  use std::{
    cell::RefCell,
    ffi::c_void,
    fmt, ptr,
    sync::mpsc,
    time::{Duration, Instant},
  };

  use webview2_com::{Microsoft::Web::WebView2::Win32::*, *};
  use windows::{
    core::{w, Error as WindowsError, Interface, PCWSTR},
    Win32::{
      Foundation::{E_POINTER, HINSTANCE, HWND, LPARAM, LRESULT, POINT, RECT, WPARAM},
      Graphics::{
        DirectComposition::{DCompositionCreateDevice2, IDCompositionDevice, IDCompositionVisual},
        Gdi::ScreenToClient,
      },
      System::{
        Com::{CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED},
        LibraryLoader::GetModuleHandleW,
      },
      UI::{
        HiDpi::{SetProcessDpiAwarenessContext, DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2},
        Input::KeyboardAndMouse::{ReleaseCapture, SetCapture, SetFocus},
        WindowsAndMessaging::{
          CreateWindowExW, DefWindowProcW, DispatchMessageW, GetClientRect, PeekMessageW,
          PostQuitMessage, RegisterClassW, ShowWindow, TranslateMessage, CS_HREDRAW, CS_VREDRAW,
          CW_USEDEFAULT, MSG, PM_REMOVE, SW_SHOW, WM_DESTROY, WM_LBUTTONDBLCLK, WM_LBUTTONDOWN,
          WM_LBUTTONUP, WM_MOUSEHWHEEL, WM_MOUSEMOVE, WM_MOUSEWHEEL, WM_QUIT, WM_RBUTTONDBLCLK,
          WM_RBUTTONDOWN, WM_RBUTTONUP, WM_SIZE, WNDCLASSW, WS_EX_NOREDIRECTIONBITMAP,
          WS_OVERLAPPEDWINDOW, WS_VISIBLE,
        },
      },
    },
  };

  thread_local! {
      static WEBVIEW_INPUT_TARGET: RefCell<Option<ICoreWebView2CompositionController>> = const { RefCell::new(None) };
      static WEBVIEW_BOUNDS_TARGET: RefCell<Option<ICoreWebView2Controller>> = const { RefCell::new(None) };
  }

  type Result<T> = std::result::Result<T, CompositionRunnerError>;

  #[derive(Debug)]
  pub(super) enum CompositionRunnerError {
    Windows(WindowsError),
    WebView2(webview2_com::Error),
    Wgpu(String),
    Window(String),
  }

  impl fmt::Display for CompositionRunnerError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
      match self {
        Self::Windows(error) => write!(f, "Windows error: {error}"),
        Self::WebView2(error) => write!(f, "WebView2 error: {error}"),
        Self::Wgpu(error) => write!(f, "wgpu error: {error}"),
        Self::Window(error) => write!(f, "window error: {error}"),
      }
    }
  }

  impl std::error::Error for CompositionRunnerError {}

  impl From<WindowsError> for CompositionRunnerError {
    fn from(error: WindowsError) -> Self {
      Self::Windows(error)
    }
  }

  impl From<webview2_com::Error> for CompositionRunnerError {
    fn from(error: webview2_com::Error) -> Self {
      Self::WebView2(error)
    }
  }

  pub fn run() -> Result<CompositionRunSummary> {
    let config = RunnerConfig::from_args();
    unsafe {
      let _ = SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
      CoInitializeEx(None, COINIT_APARTMENTTHREADED).ok()?;
    }
    let _com = ComApartment;

    let hwnd = create_host_window(config.width, config.height)?;
    unsafe {
      ShowWindow(hwnd, SW_SHOW).ok()?;
    }

    let composition = CompositionTree::new(hwnd)?;
    let mut gpu = WgpuVisualRenderer::new(&composition.wgpu_visual, config.width, config.height)?;
    let webview = WebView2CompositionLayer::new(hwnd, &composition.webview_visual)?;
    webview.navigate_to_overlay()?;
    composition.commit()?;

    WEBVIEW_INPUT_TARGET.with(|target| {
      *target.borrow_mut() = Some(webview.composition.clone());
    });
    WEBVIEW_BOUNDS_TARGET.with(|target| {
      *target.borrow_mut() = Some(webview.controller.clone());
    });
    resize_webview_to_client(hwnd);

    let start = Instant::now();
    let mut frames_rendered = 0_u64;
    let mut msg = MSG::default();
    let mut done = false;

    while !done && start.elapsed() < config.duration {
      unsafe {
        while PeekMessageW(&mut msg, None, 0, 0, PM_REMOVE).as_bool() {
          if msg.message == WM_QUIT {
            done = true;
            break;
          }
          let _ = TranslateMessage(&msg);
          DispatchMessageW(&msg);
        }
      }

      if done {
        break;
      }

      if let Some(size) = client_size(hwnd) {
        gpu.resize(size.0, size.1);
        webview.set_bounds(size.0, size.1)?;
        if gpu.render_frame(start.elapsed().as_secs_f32())? {
          frames_rendered += 1;
        }
      }
    }

    WEBVIEW_INPUT_TARGET.with(|target| target.borrow_mut().take());
    WEBVIEW_BOUNDS_TARGET.with(|target| target.borrow_mut().take());
    unsafe {
      webview.controller.Close().ok();
    }

    let duration_ms = start.elapsed().as_millis();
    Ok(CompositionRunSummary {
      platform: "windows",
      supported: true,
      composition_controller_ready: true,
      wgpu_surface_ready: true,
      adapter_name: Some(gpu.adapter_name.clone()),
      backend: Some(gpu.backend.clone()),
      surface_format: Some(format!("{:?}", gpu.format)),
      width: gpu.width,
      height: gpu.height,
      frames_rendered,
      duration_ms,
      average_frame_ms: if frames_rendered == 0 {
        None
      } else {
        Some(duration_ms as f64 / frames_rendered as f64)
      },
      data_lanes: CompositionDataLanes::tauron_native_lanes(),
    })
  }

  struct RunnerConfig {
    width: u32,
    height: u32,
    duration: Duration,
  }

  impl RunnerConfig {
    fn from_args() -> Self {
      let mut width = 1280_u32;
      let mut height = 780_u32;
      let mut duration_ms = 2500_u64;
      let mut args = std::env::args().skip(1);
      while let Some(arg) = args.next() {
        match arg.as_str() {
          "--width" => {
            if let Some(value) = args.next().and_then(|value| value.parse().ok()) {
              width = value;
            }
          }
          "--height" => {
            if let Some(value) = args.next().and_then(|value| value.parse().ok()) {
              height = value;
            }
          }
          "--duration-ms" => {
            if let Some(value) = args.next().and_then(|value| value.parse().ok()) {
              duration_ms = value;
            }
          }
          _ => {}
        }
      }

      Self {
        width: width.max(320),
        height: height.max(240),
        duration: Duration::from_millis(duration_ms.max(250)),
      }
    }
  }

  struct ComApartment;

  impl Drop for ComApartment {
    fn drop(&mut self) {
      unsafe {
        CoUninitialize();
      }
    }
  }

  struct CompositionTree {
    device: IDCompositionDevice,
    wgpu_visual: IDCompositionVisual,
    webview_visual: IDCompositionVisual,
  }

  impl CompositionTree {
    fn new(hwnd: HWND) -> Result<Self> {
      unsafe {
        let device: IDCompositionDevice = DCompositionCreateDevice2(None)?;
        let target = device.CreateTargetForHwnd(hwnd, true)?;
        let root_visual = device.CreateVisual()?;
        let wgpu_visual = device.CreateVisual()?;
        let webview_visual = device.CreateVisual()?;

        root_visual.AddVisual(&wgpu_visual, false, None)?;
        root_visual.AddVisual(&webview_visual, true, &wgpu_visual)?;
        target.SetRoot(&root_visual)?;
        device.Commit()?;

        Ok(Self {
          device,
          wgpu_visual,
          webview_visual,
        })
      }
    }

    fn commit(&self) -> Result<()> {
      unsafe {
        self.device.Commit()?;
      }
      Ok(())
    }
  }

  struct WgpuVisualRenderer {
    surface: wgpu::Surface<'static>,
    adapter_name: String,
    backend: String,
    device: wgpu::Device,
    queue: wgpu::Queue,
    config: wgpu::SurfaceConfiguration,
    format: wgpu::TextureFormat,
    width: u32,
    height: u32,
  }

  impl WgpuVisualRenderer {
    fn new(visual: &IDCompositionVisual, width: u32, height: u32) -> Result<Self> {
      let instance = wgpu::Instance::new(&wgpu::InstanceDescriptor {
        backends: wgpu::Backends::DX12,
        ..Default::default()
      });
      let visual_ptr = Interface::as_raw(visual) as *mut c_void;
      let surface = unsafe {
        instance
          .create_surface_unsafe(wgpu::SurfaceTargetUnsafe::CompositionVisual(visual_ptr))
          .map_err(|error| CompositionRunnerError::Wgpu(error.to_string()))?
      };
      let adapter = pollster::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions {
        power_preference: wgpu::PowerPreference::HighPerformance,
        force_fallback_adapter: false,
        compatible_surface: Some(&surface),
      }))
      .map_err(|error| CompositionRunnerError::Wgpu(format!("request_adapter failed: {error}")))?;
      let info = adapter.get_info();
      let (device, queue) = pollster::block_on(adapter.request_device(&wgpu::DeviceDescriptor {
        label: Some("tauron-composition-runner-device"),
        required_features: wgpu::Features::empty(),
        required_limits: adapter.limits(),
        experimental_features: Default::default(),
        memory_hints: wgpu::MemoryHints::Performance,
        trace: wgpu::Trace::Off,
      }))
      .map_err(|error| CompositionRunnerError::Wgpu(format!("request_device failed: {error}")))?;

      let capabilities = surface.get_capabilities(&adapter);
      let format = capabilities
        .formats
        .iter()
        .copied()
        .find(wgpu::TextureFormat::is_srgb)
        .or_else(|| capabilities.formats.first().copied())
        .ok_or_else(|| CompositionRunnerError::Wgpu("surface returned no formats".into()))?;
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
      let mut renderer = Self {
        surface,
        adapter_name: info.name,
        backend: format!("{:?}", info.backend),
        device,
        queue,
        config: wgpu::SurfaceConfiguration {
          usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
          format,
          width: width.max(1),
          height: height.max(1),
          present_mode,
          desired_maximum_frame_latency: 2,
          alpha_mode,
          view_formats: vec![],
        },
        format,
        width: width.max(1),
        height: height.max(1),
      };
      renderer.configure();
      Ok(renderer)
    }

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

    fn render_frame(&mut self, seconds: f32) -> Result<bool> {
      let frame = match self.surface.get_current_texture() {
        Ok(frame) => frame,
        Err(wgpu::SurfaceError::Lost | wgpu::SurfaceError::Outdated) => {
          self.configure();
          return Ok(false);
        }
        Err(wgpu::SurfaceError::Timeout) => return Ok(false),
        Err(error) => {
          return Err(CompositionRunnerError::Wgpu(format!(
            "surface frame acquisition failed: {error}"
          )));
        }
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
          label: Some("tauron-composition-runner-clear"),
        });
      {
        let _pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
          label: Some("tauron-composition-runner-pass"),
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

  struct WebView2CompositionLayer {
    composition: ICoreWebView2CompositionController,
    controller: ICoreWebView2Controller,
    webview: ICoreWebView2,
  }

  impl WebView2CompositionLayer {
    fn new(hwnd: HWND, webview_visual: &IDCompositionVisual) -> Result<Self> {
      let environment = create_webview_environment()?;
      let environment3: ICoreWebView2Environment3 = environment.cast()?;
      let composition = create_composition_controller(&environment3, hwnd)?;
      unsafe {
        composition.SetRootVisualTarget(webview_visual)?;
      }
      let controller: ICoreWebView2Controller = composition.cast()?;
      let controller2: ICoreWebView2Controller2 = controller.cast()?;
      unsafe {
        controller2.SetDefaultBackgroundColor(COREWEBVIEW2_COLOR {
          A: 0,
          R: 0,
          G: 0,
          B: 0,
        })?;
        controller.SetIsVisible(true)?;
      }
      let webview = unsafe { controller.CoreWebView2()? };
      Ok(Self {
        composition,
        controller,
        webview,
      })
    }

    fn set_bounds(&self, width: u32, height: u32) -> Result<()> {
      unsafe {
        self.controller.SetBounds(RECT {
          left: 0,
          top: 0,
          right: width as i32,
          bottom: height as i32,
        })?;
      }
      Ok(())
    }

    fn navigate_to_overlay(&self) -> Result<()> {
      let html = wide_null(OVERLAY_HTML);
      unsafe {
        self.webview.NavigateToString(PCWSTR(html.as_ptr()))?;
      }
      Ok(())
    }
  }

  fn create_webview_environment() -> Result<ICoreWebView2Environment> {
    let (tx, rx) = mpsc::channel();
    CreateCoreWebView2EnvironmentCompletedHandler::wait_for_async_operation(
      Box::new(|handler| unsafe {
        CreateCoreWebView2Environment(&handler).map_err(webview2_com::Error::WindowsError)
      }),
      Box::new(move |error_code, environment| {
        error_code?;
        tx.send(environment.ok_or_else(|| WindowsError::from(E_POINTER)))
          .map_err(|_| WindowsError::from(E_POINTER))?;
        Ok(())
      }),
    )?;
    Ok(webview2_com::wait_with_pump(rx)??)
  }

  fn create_composition_controller(
    environment: &ICoreWebView2Environment3,
    hwnd: HWND,
  ) -> Result<ICoreWebView2CompositionController> {
    let (tx, rx) = mpsc::channel();
    CreateCoreWebView2CompositionControllerCompletedHandler::wait_for_async_operation(
      Box::new({
        let environment = environment.clone();
        move |handler| unsafe {
          environment
            .CreateCoreWebView2CompositionController(hwnd, &handler)
            .map_err(webview2_com::Error::WindowsError)
        }
      }),
      Box::new(move |error_code, controller| {
        error_code?;
        tx.send(controller.ok_or_else(|| WindowsError::from(E_POINTER)))
          .map_err(|_| WindowsError::from(E_POINTER))?;
        Ok(())
      }),
    )?;
    Ok(webview2_com::wait_with_pump(rx)??)
  }

  fn create_host_window(width: u32, height: u32) -> Result<HWND> {
    let hinstance = unsafe { GetModuleHandleW(None)? };
    let class_name = w!("TauronCompositionRunnerWindow");
    let cursor = Default::default();
    let window_class = WNDCLASSW {
      hCursor: cursor,
      hInstance: HINSTANCE(hinstance.0),
      lpszClassName: class_name,
      lpfnWndProc: Some(window_proc),
      style: CS_HREDRAW | CS_VREDRAW,
      ..Default::default()
    };
    unsafe {
      RegisterClassW(&window_class);
      let hwnd = CreateWindowExW(
        WS_EX_NOREDIRECTIONBITMAP,
        class_name,
        w!("Tauron wgpu + WebView2 Composition"),
        WS_OVERLAPPEDWINDOW | WS_VISIBLE,
        CW_USEDEFAULT,
        CW_USEDEFAULT,
        width as i32,
        height as i32,
        None,
        None,
        Some(HINSTANCE(hinstance.0)),
        None,
      )?;
      if hwnd.0 == ptr::null_mut() {
        return Err(CompositionRunnerError::Window(
          "CreateWindowExW returned a null HWND".into(),
        ));
      }
      Ok(hwnd)
    }
  }

  extern "system" fn window_proc(
    hwnd: HWND,
    message: u32,
    wparam: WPARAM,
    lparam: LPARAM,
  ) -> LRESULT {
    match message {
      WM_SIZE => {
        resize_webview_to_client(hwnd);
        LRESULT(0)
      }
      WM_LBUTTONDOWN | WM_RBUTTONDOWN | WM_LBUTTONDBLCLK | WM_RBUTTONDBLCLK => {
        unsafe {
          let _ = SetCapture(hwnd);
          let _ = SetFocus(Some(hwnd));
        }
        send_mouse_message(hwnd, message, wparam, lparam);
        LRESULT(0)
      }
      WM_LBUTTONUP | WM_RBUTTONUP => {
        send_mouse_message(hwnd, message, wparam, lparam);
        unsafe {
          let _ = ReleaseCapture();
        }
        LRESULT(0)
      }
      WM_MOUSEMOVE | WM_MOUSEWHEEL | WM_MOUSEHWHEEL => {
        send_mouse_message(hwnd, message, wparam, lparam);
        LRESULT(0)
      }
      WM_DESTROY => {
        unsafe {
          PostQuitMessage(0);
        }
        LRESULT(0)
      }
      _ => unsafe { DefWindowProcW(hwnd, message, wparam, lparam) },
    }
  }

  fn resize_webview_to_client(hwnd: HWND) {
    if let Some((width, height)) = client_size(hwnd) {
      WEBVIEW_BOUNDS_TARGET.with(|target| {
        if let Some(controller) = target.borrow().as_ref() {
          unsafe {
            let _ = controller.SetBounds(RECT {
              left: 0,
              top: 0,
              right: width as i32,
              bottom: height as i32,
            });
          }
        }
      });
    }
  }

  fn send_mouse_message(hwnd: HWND, message: u32, wparam: WPARAM, lparam: LPARAM) {
    WEBVIEW_INPUT_TARGET.with(|target| {
      let Some(controller) = target.borrow().as_ref().cloned() else {
        return;
      };
      let Some(event_kind) = webview_mouse_event_kind(message) else {
        return;
      };
      let mut point = POINT {
        x: low_word_signed(lparam.0),
        y: high_word_signed(lparam.0),
      };
      let mouse_data = if message == WM_MOUSEWHEEL || message == WM_MOUSEHWHEEL {
        unsafe {
          let _ = ScreenToClient(hwnd, &mut point);
        }
        high_word_signed(wparam.0 as isize) as u32
      } else {
        0
      };
      unsafe {
        let _ = controller.SendMouseInput(
          event_kind,
          COREWEBVIEW2_MOUSE_EVENT_VIRTUAL_KEYS((wparam.0 & 0x7f) as i32),
          mouse_data,
          point,
        );
      }
    });
  }

  fn webview_mouse_event_kind(message: u32) -> Option<COREWEBVIEW2_MOUSE_EVENT_KIND> {
    match message {
      WM_MOUSEMOVE => Some(COREWEBVIEW2_MOUSE_EVENT_KIND_MOVE),
      WM_MOUSEWHEEL => Some(COREWEBVIEW2_MOUSE_EVENT_KIND_WHEEL),
      WM_MOUSEHWHEEL => Some(COREWEBVIEW2_MOUSE_EVENT_KIND_HORIZONTAL_WHEEL),
      WM_LBUTTONDOWN => Some(COREWEBVIEW2_MOUSE_EVENT_KIND_LEFT_BUTTON_DOWN),
      WM_LBUTTONUP => Some(COREWEBVIEW2_MOUSE_EVENT_KIND_LEFT_BUTTON_UP),
      WM_LBUTTONDBLCLK => Some(COREWEBVIEW2_MOUSE_EVENT_KIND_LEFT_BUTTON_DOUBLE_CLICK),
      WM_RBUTTONDOWN => Some(COREWEBVIEW2_MOUSE_EVENT_KIND_RIGHT_BUTTON_DOWN),
      WM_RBUTTONUP => Some(COREWEBVIEW2_MOUSE_EVENT_KIND_RIGHT_BUTTON_UP),
      WM_RBUTTONDBLCLK => Some(COREWEBVIEW2_MOUSE_EVENT_KIND_RIGHT_BUTTON_DOUBLE_CLICK),
      _ => None,
    }
  }

  fn client_size(hwnd: HWND) -> Option<(u32, u32)> {
    let mut rect = RECT::default();
    unsafe {
      if GetClientRect(hwnd, &mut rect).is_err() {
        return None;
      }
    }
    let width = (rect.right - rect.left).max(1) as u32;
    let height = (rect.bottom - rect.top).max(1) as u32;
    Some((width, height))
  }

  fn low_word_signed(value: isize) -> i32 {
    (value as u32 & 0xffff) as i16 as i32
  }

  fn high_word_signed(value: isize) -> i32 {
    ((value as u32 >> 16) & 0xffff) as i16 as i32
  }

  fn wide_null(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
  }

  const OVERLAY_HTML: &str = r#"<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
html,body{margin:0;width:100%;height:100%;background:transparent;color:#f8fbff;font:12px/1.35 "Segoe UI",system-ui,sans-serif;overflow:hidden}
body{display:grid;grid-template-rows:auto 1fr;pointer-events:auto}
.bar{height:34px;display:flex;align-items:center;gap:8px;padding:0 10px;background:rgba(5,10,18,.48);backdrop-filter:blur(18px);border-bottom:1px solid rgba(255,255,255,.13)}
.mark{font-weight:650;letter-spacing:.08em;text-transform:uppercase;color:#cbe7ff}
.pill{height:20px;display:flex;align-items:center;padding:0 8px;border-radius:999px;background:rgba(49,189,255,.16);border:1px solid rgba(102,211,255,.26);color:#d8f6ff}
.dot{width:7px;height:7px;border-radius:99px;background:#6aff9e;box-shadow:0 0 14px #6aff9e}
.stage{position:relative}
.panel{position:absolute;right:14px;top:14px;width:230px;padding:10px 11px;background:rgba(5,10,18,.56);border:1px solid rgba(255,255,255,.14);border-radius:8px;backdrop-filter:blur(20px);box-shadow:0 18px 60px rgba(0,0,0,.28)}
.row{display:flex;justify-content:space-between;gap:12px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.08)}
.row:last-child{border-bottom:0}
.k{color:#8eb4cf}
.v{color:#fff}
button{height:26px;margin-top:8px;padding:0 10px;border:0;border-radius:6px;background:#e8f7ff;color:#071018;font-weight:650}
</style>
</head>
<body>
  <div class="bar"><span class="dot"></span><span class="mark">Tauron Native Composition</span><span class="pill">WebView2 UI over wgpu pixels</span></div>
  <div class="stage">
    <div class="panel">
      <div class="row"><span class="k">visual 0</span><span class="v">wgpu / DX12</span></div>
      <div class="row"><span class="k">visual 1</span><span class="v">WebView2 DOM</span></div>
      <div class="row"><span class="k">control</span><span class="v">native_control</span></div>
      <div class="row"><span class="k">events</span><span class="v">native_ring</span></div>
      <button onclick="document.querySelector('.mark').textContent='DOM input is live'">Ping</button>
    </div>
  </div>
</body>
</html>"#;
}
