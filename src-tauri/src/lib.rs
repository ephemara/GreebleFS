#[cfg(not(test))]
pub mod acceleration_runtime;
#[cfg(test)]
#[path = "acceleration_runtime_test_stub.rs"]
pub mod acceleration_runtime;
#[cfg(not(test))]
pub mod action_commands;
#[cfg(not(test))]
pub mod archive_ops;
#[cfg(not(test))]
pub mod audio_commands;
#[cfg(not(test))]
pub mod audio_engine;
#[cfg(not(test))]
pub mod cloud_commands;
#[cfg(not(test))]
pub mod desktop_integration;
#[cfg(not(test))]
pub mod domain_commands;
#[cfg(not(test))]
pub mod entry_size_cache;
#[cfg(not(test))]
pub mod explorer_identity;
#[cfg(not(test))]
pub mod explorer_pro_commands;
#[cfg(not(test))]
pub mod fs_commands;
#[cfg(test)]
#[path = "fs_commands_test_stub.rs"]
pub mod fs_commands;
#[cfg(not(test))]
pub mod global_search;
#[cfg(not(test))]
pub mod gpu_runtime;
#[cfg(not(test))]
pub mod image_commands;
#[cfg(not(test))]
pub mod image_cutout_commands;
#[cfg(not(test))]
pub mod ipc_runtime;
#[cfg(not(test))]
pub mod lan_share;
#[cfg(not(test))]
mod linux_graphics;
#[cfg(not(test))]
pub mod native_terminal;
#[cfg(not(test))]
pub mod open_with;
#[cfg(not(test))]
pub mod pdf_commands;
#[cfg(not(test))]
pub mod plugin_commands;
#[cfg(not(test))]
pub mod python_commands;
#[cfg(not(test))]
pub mod python_pyo3;
#[cfg(test)]
#[path = "python_pyo3_stub.rs"]
pub mod python_pyo3;
#[cfg(not(test))]
pub mod python_sidecar;
#[cfg(not(test))]
pub mod remote_storage_commands;
#[cfg(not(test))]
pub mod runtime_pipeline;
#[cfg(not(test))]
pub mod screenshot_commands;
pub mod secondary_windows;
pub mod semantic_search;
#[cfg(not(test))]
pub mod shader_preview_commands;
#[cfg(not(test))]
pub mod share_commands;
#[cfg(not(test))]
pub mod specta_bindings;
#[cfg(not(test))]
pub mod sqlite_commands;
#[cfg(not(test))]
pub mod startup_commands;
#[cfg(not(test))]
pub mod storage_commands;
#[cfg(not(test))]
pub mod tailscale_commands;
#[cfg(not(test))]
pub mod telemetry;
#[cfg(not(test))]
pub mod terminal;
#[cfg(not(test))]
pub mod thumbnail_commands;
#[cfg(all(target_os = "windows", not(test)))]
pub mod url_drop;
#[cfg(not(test))]
pub mod usr;
#[cfg(not(test))]
pub mod video_commands;
#[cfg(not(test))]
pub mod video_engine;
#[cfg(not(test))]
pub mod volume_inventory;
#[cfg(not(test))]
pub mod vst_commands;
#[cfg(not(test))]
pub mod vst_host_runtime;
#[cfg(not(test))]
pub mod wayland_dock;
#[cfg(not(test))]
pub mod window_commands;

#[cfg(not(test))]
use audio_engine::AudioEngineManager;
#[cfg(not(test))]
use cloud_commands::CloudRuntimeState;
#[cfg(not(test))]
use entry_size_cache::{initialize_entry_size_cache, EntrySizeWatcherState};
#[cfg(not(test))]
use explorer_identity::{initialize_explorer_identity_store, ExplorerIdentityManager};
#[cfg(not(test))]
use fs_commands::initialize_fs_command_events;
#[cfg(not(test))]
use plugin_commands::PluginWatcherState;
#[cfg(not(test))]
use remote_storage_commands::RemoteStorageState;
#[cfg(not(test))]
use tauri::{
    menu::{MenuBuilder, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
#[cfg(not(test))]
use telemetry::{finish_native_span, start_native_span, TelemetryManager};
#[cfg(not(test))]
use terminal::TerminalManager;
#[cfg(not(test))]
use window_commands::{MAIN_TRAY_ICON_ID, MAIN_WINDOW_LABEL};

#[cfg(not(test))]
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct PreviewBytesInvokeArgs {
    path: String,
    max_bytes: Option<u64>,
}

#[cfg(not(test))]
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct GlobalSearchQueryUnderPathInvokeArgs {
    root_path: String,
    query: String,
    options: crate::global_search::GlobalSearchQueryOptions,
}

#[cfg(not(test))]
fn parse_json_invoke_args<T: for<'de> serde::Deserialize<'de>>(
    message: &tauri::ipc::InvokeMessage<tauri::Wry>,
) -> Result<T, String> {
    ipc_runtime::binary::parse_json_invoke_args(message)
}

#[cfg(not(test))]
fn raw_preview_invoke_handler(invoke: tauri::ipc::Invoke<tauri::Wry>) -> bool {
    let command = invoke.message.command().to_string();

    match command.as_str() {
        "fs_read_preview_bytes" => {
            let args = match parse_json_invoke_args::<PreviewBytesInvokeArgs>(&invoke.message) {
                Ok(args) => args,
                Err(error) => {
                    invoke.resolver.reject(error);
                    return true;
                }
            };
            let resolver = invoke.resolver;
            ipc_runtime::binary::spawn_raw_invoke_response(
                resolver,
                fs_commands::fs_read_preview_bytes(args.path, args.max_bytes),
            );
            true
        }
        "cloud_read_preview_bytes" => {
            let args = match parse_json_invoke_args::<PreviewBytesInvokeArgs>(&invoke.message) {
                Ok(args) => args,
                Err(error) => {
                    invoke.resolver.reject(error);
                    return true;
                }
            };
            let resolver = invoke.resolver;
            let app = invoke.message.webview().app_handle().clone();
            ipc_runtime::binary::spawn_raw_invoke_response(
                resolver,
                cloud_commands::cloud_read_preview_bytes(app, args.path, args.max_bytes),
            );
            true
        }
        "remote_read_preview_bytes" => {
            let args = match parse_json_invoke_args::<PreviewBytesInvokeArgs>(&invoke.message) {
                Ok(args) => args,
                Err(error) => {
                    invoke.resolver.reject(error);
                    return true;
                }
            };
            let resolver = invoke.resolver;
            let command_app = invoke.message.webview().app_handle().clone();
            let state_app = command_app.clone();
            ipc_runtime::binary::spawn_raw_invoke_response(resolver, async move {
                let state = state_app.state::<RemoteStorageState>();
                remote_storage_commands::remote_read_preview_bytes(
                    command_app,
                    state,
                    args.path,
                    args.max_bytes,
                )
                .await
            });
            true
        }
        "global_search_query_under_path" => {
            let args = match parse_json_invoke_args::<GlobalSearchQueryUnderPathInvokeArgs>(
                &invoke.message,
            ) {
                Ok(args) => args,
                Err(error) => {
                    invoke.resolver.reject(error);
                    return true;
                }
            };
            let resolver = invoke.resolver;
            let app = invoke.message.webview().app_handle().clone();
            ipc_runtime::binary::spawn_raw_invoke_response(
                resolver,
                global_search::query::global_search_query_under_path(
                    app,
                    args.root_path,
                    args.query,
                    args.options,
                ),
            );
            true
        }
        _ => false,
    }
}

#[cfg(not(test))]
fn toggle_overlay(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        let _ = win.emit("overlay://toggle-request", ());
    }
}

#[cfg(not(test))]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    linux_graphics::apply_linux_graphics_startup_configuration();

    let builder = specta_bindings::app_specta_builder();
    let specta_invoke_handler = builder.invoke_handler();
    let invoke_handler =
        move |invoke: tauri::ipc::Invoke<tauri::Wry>| match invoke.message.command() {
            "fs_read_preview_bytes"
            | "cloud_read_preview_bytes"
            | "remote_read_preview_bytes"
            | "global_search_query_under_path" => raw_preview_invoke_handler(invoke),
            _ => specta_invoke_handler(invoke),
        };

    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_filter(|label| secondary_windows::should_window_label_remember_bounds(label))
                .build(),
        )
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_screenshots::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(move |app| {
            builder.mount_events(app);
            if let Err(error) = usr::bootstrap_usr_content(&app.handle()) {
                eprintln!("GreebleFS: failed to bootstrap bundled usr content: {error}");
            }
            initialize_fs_command_events(app.handle().clone());
            initialize_explorer_identity_store(app.handle())?;
            let gpu_runtime = gpu_runtime::GpuRuntimeManager::new(app.handle().clone());
            gpu_runtime::set_global_gpu_runtime(gpu_runtime.clone());
            app.manage(ipc_runtime::IpcRuntimeState::new());
            app.manage(TerminalManager::new());
            app.manage(CloudRuntimeState::default());
            app.manage(RemoteStorageState::default());
            app.manage(secondary_windows::SecondaryWindowManagerState::default());
            app.manage(AudioEngineManager::default());
            app.manage(ExplorerIdentityManager::default());
            app.manage(gpu_runtime);
            app.manage(image_cutout_commands::ImageCutoutManager::default());
            app.manage(image_commands::ImageEditorManager::default());
            app.manage(pdf_commands::PdfPreviewManager::default());
            app.manage(python_sidecar::PythonSidecarManager::default());
            app.manage(runtime_pipeline::HostEventBusState::default());
            app.manage(runtime_pipeline::commands::RuntimeFileWatchManager::default());
            app.manage(runtime_pipeline::commands::RuntimeTaskProcessManager::default());
            app.manage(runtime_pipeline::RuntimeRegistryState::default());
            app.manage(runtime_pipeline::sidecar::ExternalSidecarManager::default());
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
