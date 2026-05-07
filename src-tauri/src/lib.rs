#[cfg(not(test))]
pub mod acceleration_runtime;
#[cfg(test)]
#[path = "acceleration_runtime_test_stub.rs"]
pub mod acceleration_runtime;
#[cfg(not(test))]
pub mod action_commands;
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
pub mod dev_mcp_native_automation;
#[cfg(not(test))]
pub mod domain_commands;
#[cfg(not(test))]
pub mod entry_size_cache;
#[cfg(not(test))]
pub mod explorer_identity;
pub mod explorer_path_key;
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
pub mod ipc_runtime;
#[cfg(not(test))]
pub mod lan_share;
#[cfg(not(test))]
mod linux_graphics;
pub mod message_ring;
pub mod native_task_graph;
#[cfg(not(test))]
pub mod native_terminal;
#[cfg(not(test))]
pub mod open_with;
#[cfg(not(test))]
pub mod pdf_commands;
#[cfg(not(test))]
pub mod plugin_commands;
pub mod preview_streaming;
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
#[cfg(test)]
#[path = "runtime_pipeline_test_stub.rs"]
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
pub mod system_tray;
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
pub mod usr;
#[cfg(not(test))]
pub mod usr_profiles;
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
use native_task_graph::NativeTaskGraphManager;
#[cfg(not(test))]
use plugin_commands::PluginWatcherState;
#[cfg(not(test))]
use preview_streaming::PreviewStreamingManager;
#[cfg(not(test))]
use remote_storage_commands::RemoteStorageState;
#[cfg(not(test))]
use tauri::{Emitter, Manager};
#[cfg(not(test))]
use telemetry::{finish_native_span, start_native_span, TelemetryManager};
#[cfg(not(test))]
use terminal::TerminalManager;
#[cfg(not(test))]
use window_commands::{TrayVisibilityState, MAIN_WINDOW_LABEL};

#[cfg(not(test))]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    linux_graphics::apply_linux_graphics_startup_configuration();

    let builder = specta_bindings::app_specta_builder();
    let specta_invoke_handler = builder.invoke_handler();
    let transport_invoke_handler: fn(tauri::ipc::Invoke<tauri::Wry>) -> bool = tauri::generate_handler![
        crate::fs_commands::fs_read_preview_bytes,
        crate::fs_commands::fs_read_archive_entry_preview_bytes,
        crate::cloud_commands::cloud_read_preview_bytes,
        crate::remote_storage_commands::remote_read_preview_bytes,
        crate::runtime_pipeline::commands::runtime_read_artifact_bytes,
        crate::global_search::query::global_search_query_under_path,
    ];
    let invoke_handler =
        move |invoke: tauri::ipc::Invoke<tauri::Wry>| match invoke.message.command() {
            "fs_read_preview_bytes"
            | "fs_read_archive_entry_preview_bytes"
            | "cloud_read_preview_bytes"
            | "remote_read_preview_bytes"
            | "runtime_read_artifact_bytes"
            | "global_search_query_under_path" => transport_invoke_handler(invoke),
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
        .plugin(tauri_plugin_kain::init())
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
            app.manage(ipc_runtime::IpcRuntimeState::from_app(&app.handle()));
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
            app.manage(runtime_pipeline::HostEventBusState::from_app(&app.handle()));
            app.manage(runtime_pipeline::commands::RuntimeFileWatchManager::default());
            app.manage(runtime_pipeline::commands::RuntimeTaskProcessManager::default());
            app.manage(runtime_pipeline::RuntimeRegistryState::default());
            app.manage(runtime_pipeline::sidecar::ExternalSidecarManager::default());
            app.manage(video_engine::VideoEngineManager::default());
            app.manage(vst_host_runtime::VstHostRuntimeManager::default());
            app.manage(TelemetryManager::from_app(&app.handle()));
            app.manage(NativeTaskGraphManager::from_app(&app.handle()));
            app.manage(PreviewStreamingManager::from_app(&app.handle()));
            if let Some(native_automation_server) =
                dev_mcp_native_automation::start_dev_mcp_native_automation_server(&app.handle())?
            {
                app.manage(native_automation_server);
            }
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
            app.manage(TrayVisibilityState::new(true));

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

            system_tray::build_main_system_tray(&app.handle())?;

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
