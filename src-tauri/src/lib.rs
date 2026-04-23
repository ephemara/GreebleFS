pub mod acceleration_runtime;
pub mod archive_ops;
pub mod audio_commands;
pub mod audio_engine;
pub mod cloud_commands;
pub mod desktop_integration;
pub mod domain_commands;
pub mod entry_size_cache;
pub mod explorer_pro_commands;
pub mod fs_commands;
pub mod gpu_runtime;
pub mod global_search;
pub mod image_commands;
pub mod lan_share;
mod linux_graphics;
pub mod pdf_commands;
pub mod plugin_commands;
pub mod python_commands;
pub mod python_pyo3;
pub mod python_sidecar;
pub mod screenshot_commands;
pub mod semantic_search;
pub mod shader_preview_commands;
pub mod share_commands;
pub mod specta_bindings;
pub mod sqlite_commands;
pub mod startup_commands;
pub mod storage_commands;
pub mod telemetry;
pub mod terminal;
pub mod thumbnail_commands;
#[cfg(target_os = "windows")]
pub mod url_drop;
pub mod video_commands;
pub mod video_engine;
pub mod vst_commands;
pub mod vst_host_runtime;
pub mod wayland_dock;
pub mod window_commands;

use audio_engine::AudioEngineManager;
use cloud_commands::CloudRuntimeState;
use entry_size_cache::{initialize_entry_size_cache, EntrySizeWatcherState};
use fs_commands::initialize_fs_command_events;
use plugin_commands::PluginWatcherState;
use tauri::{
    menu::{MenuBuilder, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use telemetry::{finish_native_span, start_native_span, TelemetryManager};
use terminal::TerminalManager;
use window_commands::{MAIN_TRAY_ICON_ID, MAIN_WINDOW_LABEL};

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct PreviewBytesInvokeArgs {
    path: String,
    max_bytes: Option<u64>,
}

fn parse_preview_bytes_invoke_args(
    message: &tauri::ipc::InvokeMessage<tauri::Wry>,
) -> Result<PreviewBytesInvokeArgs, String> {
    match message.payload() {
        tauri::ipc::InvokeBody::Json(payload) => serde_json::from_value(payload.clone())
            .map_err(|error| format!("Invalid preview transport payload: {error}")),
        tauri::ipc::InvokeBody::Raw(_) => {
            Err("Preview transport expects JSON arguments.".to_string())
        }
    }
}

fn raw_preview_invoke_handler(invoke: tauri::ipc::Invoke<tauri::Wry>) -> bool {
    let command = invoke.message.command().to_string();
    let args = match parse_preview_bytes_invoke_args(&invoke.message) {
        Ok(args) => args,
        Err(error) => {
            invoke.resolver.reject(error);
            return true;
        }
    };

    match command.as_str() {
        "fs_read_preview_bytes" => {
            let resolver = invoke.resolver;
            tauri::async_runtime::spawn(async move {
                resolver.respond(
                    fs_commands::fs_read_preview_bytes(args.path, args.max_bytes)
                        .await
                        .map_err(Into::into),
                );
            });
            true
        }
        "cloud_read_preview_bytes" => {
            let resolver = invoke.resolver;
            let app = invoke.message.webview().app_handle().clone();
            tauri::async_runtime::spawn(async move {
                resolver.respond(
                    cloud_commands::cloud_read_preview_bytes(app, args.path, args.max_bytes)
                        .await
                        .map_err(Into::into),
                );
            });
            true
        }
        _ => false,
    }
}

fn toggle_overlay(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        let _ = win.emit("overlay://toggle-request", ());
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    linux_graphics::apply_linux_graphics_startup_configuration();

    let builder = specta_bindings::app_specta_builder();
    let specta_invoke_handler = builder.invoke_handler();
    let invoke_handler = move |invoke: tauri::ipc::Invoke<tauri::Wry>| match invoke
        .message
        .command()
    {
        "fs_read_preview_bytes" | "cloud_read_preview_bytes" => raw_preview_invoke_handler(invoke),
        _ => specta_invoke_handler(invoke),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_screenshots::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(move |app| {
            builder.mount_events(app);
            initialize_fs_command_events(app.handle().clone());
            let gpu_runtime = gpu_runtime::GpuRuntimeManager::new(app.handle().clone());
            gpu_runtime::set_global_gpu_runtime(gpu_runtime.clone());
            app.manage(TerminalManager::new());
            app.manage(CloudRuntimeState::default());
            app.manage(AudioEngineManager::default());
            app.manage(gpu_runtime);
            app.manage(image_commands::ImageEditorManager::default());
            app.manage(pdf_commands::PdfPreviewManager::default());
            app.manage(python_sidecar::PythonSidecarManager::default());
            app.manage(video_engine::VideoEngineManager::default());
            app.manage(vst_host_runtime::VstHostRuntimeManager::default());
            app.manage(TelemetryManager::default());
            let startup_span = start_native_span(
                &app.handle(),
                "startup",
                "tauri.setup",
                std::collections::BTreeMap::new(),
            );
            initialize_entry_size_cache(app.handle())?;
            app.manage(EntrySizeWatcherState::default());
            app.manage(PluginWatcherState::default());
            if let Err(error) = wayland_dock::initialize_wayland_dock_host(&app.handle()) {
                eprintln!("GreebleFS: failed to initialize Wayland dock host: {error}");
            }

            #[cfg(target_os = "windows")]
            url_drop::setup(&app.handle());

            if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
                if cfg!(debug_assertions) {
                    // Dev mode: show the window immediately so you don't need
                    // to press the hotkey every time you restart. This block is
                    // compiled out entirely in release builds — zero user impact.
                    let _ = window.set_skip_taskbar(false);
                    let _ = window.show();
                    let _ = window.set_focus();
                    // Tell the React side to run positionAndShow() so overlay
                    // phase state is initialised correctly.
                    let _ = window.emit("overlay://toggle-request", ());
                    #[cfg(target_os = "macos")]
                    let _ = app.set_dock_visibility(true);
                }
            }

            // ── System Tray ──
            let tray_icon = app.default_window_icon().cloned();

            let toggle_item =
                MenuItem::with_id(app, "toggle", "Toggle GreebleFS", true, None::<&str>)?;
            let separator = tauri::menu::PredefinedMenuItem::separator(app)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit GreebleFS", true, None::<&str>)?;

            let menu = MenuBuilder::new(app)
                .items(&[&toggle_item, &separator, &quit_item])
                .build()?;

            let mut tray_builder = TrayIconBuilder::with_id(MAIN_TRAY_ICON_ID)
                .menu(&menu)
                .tooltip("GreebleFS")
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "toggle" => toggle_overlay(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_overlay(tray.app_handle());
                    }
                });

            if let Some(icon) = tray_icon {
                tray_builder = tray_builder.icon(icon);
            }

            tray_builder.build(app)?;

            finish_native_span(
                &app.handle(),
                startup_span,
                "ok",
                std::collections::BTreeMap::new(),
                None,
            );

            Ok(())
        })
        .invoke_handler(invoke_handler)
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
