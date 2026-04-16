#[cfg(target_os = "linux")]
use std::sync::mpsc;

use specta::Type;
use tauri::{AppHandle, Manager, WebviewWindow};

use crate::linux_graphics::{current_linux_display_backend, LinuxDisplayBackend};

#[cfg(target_os = "linux")]
use tauri::{WebviewUrl, WebviewWindowBuilder};

#[cfg(target_os = "linux")]
use gdk::prelude::*;
#[cfg(target_os = "linux")]
use gtk::prelude::GtkWindowExt;
#[cfg(target_os = "linux")]
use gtk_layer_shell::{Edge, KeyboardMode, Layer, LayerShell};

pub const WAYLAND_DOCK_WINDOW_LABEL: &str = "dock";
const WAYLAND_DOCK_WINDOW_NAMESPACE: &str = "greeblefs-dock";
const WAYLAND_DOCK_DEFAULT_WIDTH: i32 = 1280;
const WAYLAND_DOCK_DEFAULT_HEIGHT: i32 = 760;

#[derive(Debug, Clone, serde::Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct WaylandDockHostStatus {
    pub enabled: bool,
    pub window_label: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Deserialize, serde::Serialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum WaylandDockAnchor {
    Top,
    Bottom,
}

pub fn wayland_dock_host_status(app: &AppHandle) -> WaylandDockHostStatus {
    WaylandDockHostStatus {
        enabled: is_wayland_session()
            && app.get_webview_window(WAYLAND_DOCK_WINDOW_LABEL).is_some(),
        window_label: app
            .get_webview_window(WAYLAND_DOCK_WINDOW_LABEL)
            .map(|_| WAYLAND_DOCK_WINDOW_LABEL.to_string()),
    }
}

#[cfg(target_os = "linux")]
pub fn initialize_wayland_dock_host(app: &AppHandle) -> Result<(), String> {
    if !is_wayland_session() || app.get_webview_window(WAYLAND_DOCK_WINDOW_LABEL).is_some() {
        return Ok(());
    }

    let dock_window = WebviewWindowBuilder::new(
        app,
        WAYLAND_DOCK_WINDOW_LABEL,
        WebviewUrl::App("index.html".into()),
    )
    .title("GreebleFS Dock")
    .inner_size(
        WAYLAND_DOCK_DEFAULT_WIDTH as f64,
        WAYLAND_DOCK_DEFAULT_HEIGHT as f64,
    )
    .visible(false)
    .focused(false)
    .focusable(true)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .shadow(false)
    .resizable(true)
    .build()
    .map_err(|error| format!("failed to build dock window: {error}"))?;

    configure_wayland_dock_window(&dock_window)?;
    dock_window.hide().map_err(|error| error.to_string())?;

    Ok(())
}

#[cfg(not(target_os = "linux"))]
pub fn initialize_wayland_dock_host(_app: &AppHandle) -> Result<(), String> {
    Ok(())
}

pub fn apply_wayland_dock_layout(
    window: &WebviewWindow,
    anchor: WaylandDockAnchor,
    monitor_name: Option<String>,
    width: u32,
    height: u32,
) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        if !is_wayland_session() {
            return Err("Wayland dock layout is only available on Linux Wayland".to_string());
        }

        let dock_window = window.clone();
        return run_on_window_main_thread(window, move || {
            apply_wayland_dock_layout_on_main_thread(
                &dock_window,
                anchor,
                monitor_name,
                width,
                height,
            )
        })?;
    }

    #[cfg(not(target_os = "linux"))]
    {
        let _ = (window, anchor, monitor_name, width, height);
        Err("Wayland dock layout is only available on Linux Wayland".to_string())
    }
}

#[cfg(target_os = "linux")]
fn configure_wayland_dock_window(window: &WebviewWindow) -> Result<(), String> {
    let dock_window = window.clone();
    run_on_window_main_thread(window, move || {
        configure_wayland_dock_window_on_main_thread(&dock_window)
    })?
}

#[cfg(target_os = "linux")]
fn configure_wayland_dock_window_on_main_thread(window: &WebviewWindow) -> Result<(), String> {
    let gtk_window = window.gtk_window().map_err(|error| error.to_string())?;
    gtk_window.init_layer_shell();
    gtk_window.set_namespace(WAYLAND_DOCK_WINDOW_NAMESPACE);
    gtk_window.set_layer(Layer::Top);
    gtk_window.set_anchor(Edge::Left, true);
    gtk_window.set_anchor(Edge::Right, false);
    gtk_window.set_anchor(Edge::Top, false);
    gtk_window.set_anchor(Edge::Bottom, true);
    gtk_window.set_keyboard_mode(KeyboardMode::OnDemand);
    gtk_window.set_accept_focus(true);
    gtk_window.set_decorated(false);
    gtk_window.set_keep_above(true);
    gtk_window.set_default_size(WAYLAND_DOCK_DEFAULT_WIDTH, WAYLAND_DOCK_DEFAULT_HEIGHT);
    gtk_window.resize(WAYLAND_DOCK_DEFAULT_WIDTH, WAYLAND_DOCK_DEFAULT_HEIGHT);
    gtk_window.set_exclusive_zone(0);
    gtk_window.set_layer_shell_margin(Edge::Left, 0);
    gtk_window.set_layer_shell_margin(Edge::Right, 0);
    gtk_window.set_layer_shell_margin(Edge::Top, 0);
    gtk_window.set_layer_shell_margin(Edge::Bottom, 0);
    Ok(())
}

#[cfg(target_os = "linux")]
fn apply_wayland_dock_layout_on_main_thread(
    window: &WebviewWindow,
    anchor: WaylandDockAnchor,
    monitor_name: Option<String>,
    width: u32,
    height: u32,
) -> Result<(), String> {
    let gtk_window = window.gtk_window().map_err(|error| error.to_string())?;
    let width = clamp_dimension(width);
    let height = clamp_dimension(height);

    gtk_window.set_anchor(Edge::Left, true);
    gtk_window.set_anchor(Edge::Right, false);
    gtk_window.set_anchor(Edge::Top, matches!(anchor, WaylandDockAnchor::Top));
    gtk_window.set_anchor(Edge::Bottom, matches!(anchor, WaylandDockAnchor::Bottom));
    gtk_window.set_keyboard_mode(KeyboardMode::OnDemand);
    gtk_window.set_accept_focus(true);
    gtk_window.set_exclusive_zone(0);
    gtk_window.set_layer_shell_margin(Edge::Left, 0);
    gtk_window.set_layer_shell_margin(Edge::Right, 0);
    gtk_window.set_layer_shell_margin(Edge::Top, 0);
    gtk_window.set_layer_shell_margin(Edge::Bottom, 0);
    gtk_window.set_default_size(width, height);
    gtk_window.resize(width, height);

    if let Some(monitor) = resolve_gtk_monitor_by_name(monitor_name.as_deref()) {
        gtk_window.set_monitor(&monitor);
    }

    Ok(())
}

#[cfg(target_os = "linux")]
fn resolve_gtk_monitor_by_name(monitor_name: Option<&str>) -> Option<gdk::Monitor> {
    let trimmed_name = monitor_name
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let display = gdk::Display::default()?;
    let monitor_count = display.n_monitors();
    let mut first_monitor: Option<gdk::Monitor> = None;

    for index in 0..monitor_count {
        let monitor = display.monitor(index)?;
        if first_monitor.is_none() {
            first_monitor = Some(monitor.clone());
        }

        let Some(target_name) = trimmed_name else {
            continue;
        };

        let model = monitor.model().map(|value| value.to_string());
        let manufacturer = monitor.manufacturer().map(|value| value.to_string());
        let combined = match (manufacturer.as_deref(), model.as_deref()) {
            (Some(maker), Some(model_name)) => Some(format!("{maker} {model_name}")),
            _ => None,
        };

        let matches_target = [
            model.as_deref(),
            manufacturer.as_deref(),
            combined.as_deref(),
        ]
        .into_iter()
        .flatten()
        .any(|candidate| candidate.eq_ignore_ascii_case(target_name));

        if matches_target {
            return Some(monitor);
        }
    }

    first_monitor
}

#[cfg(target_os = "linux")]
fn clamp_dimension(value: u32) -> i32 {
    value.clamp(320, i32::MAX as u32) as i32
}

#[cfg(target_os = "linux")]
fn run_on_window_main_thread<T, F>(window: &WebviewWindow, task: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce() -> T + Send + 'static,
{
    let (sender, receiver) = mpsc::sync_channel(1);
    window
        .run_on_main_thread(move || {
            let _ = sender.send(task());
        })
        .map_err(|error| error.to_string())?;
    receiver
        .recv()
        .map_err(|error| format!("failed to receive main-thread task result: {error}"))
}

#[cfg(target_os = "linux")]
fn is_wayland_session() -> bool {
    current_linux_display_backend() == Some(LinuxDisplayBackend::Wayland)
}

#[cfg(not(target_os = "linux"))]
fn is_wayland_session() -> bool {
    false
}
