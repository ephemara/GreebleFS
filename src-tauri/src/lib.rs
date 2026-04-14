pub mod cloud_commands;
pub mod desktop_integration;
pub mod domain_commands;
pub mod entry_size_cache;
pub mod explorer_pro_commands;
pub mod fs_commands;
pub mod plugin_commands;
pub mod python_commands;
pub mod screenshot_commands;
pub mod specta_bindings;
pub mod startup_commands;
pub mod terminal;
pub mod window_commands;

use cloud_commands::CloudRuntimeState;
use entry_size_cache::{initialize_entry_size_cache, EntrySizeWatcherState};
use fs_commands::initialize_fs_command_events;
use plugin_commands::PluginWatcherState;
use tauri::{
    menu::{MenuBuilder, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use terminal::TerminalManager;
use window_commands::MAIN_TRAY_ICON_ID;

fn toggle_overlay(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.emit("overlay://toggle-request", ());
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = specta_bindings::app_specta_builder();
    let invoke_handler = builder.invoke_handler();

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
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(move |app| {
            builder.mount_events(app);
            initialize_fs_command_events(app.handle().clone());
            app.manage(TerminalManager::new());
            app.manage(CloudRuntimeState::default());
            initialize_entry_size_cache(app.handle())?;
            app.manage(EntrySizeWatcherState::default());
            app.manage(PluginWatcherState::default());

            if let Some(window) = app.get_webview_window("main") {
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
                } else {
                    // Release builds start hidden in the tray by config, but we
                    // still reveal the window here so desktop launches always have
                    // a visible entry point even if the React-side auto-show is
                    // delayed by a slow desktop/session startup.
                    let _ = window.set_skip_taskbar(false);
                    let _ = window.show();
                    let _ = window.set_focus();
                    #[cfg(target_os = "macos")]
                    let _ = app.set_dock_visibility(true);
                }
            }

            // ── System Tray ──
            let tray_icon = app.default_window_icon().cloned();

            let toggle_item =
                MenuItem::with_id(app, "toggle", "Toggle Terminal", true, None::<&str>)?;
            let separator = tauri::menu::PredefinedMenuItem::separator(app)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit OverlayTerm", true, None::<&str>)?;

            let menu = MenuBuilder::new(app)
                .items(&[&toggle_item, &separator, &quit_item])
                .build()?;

            let mut tray_builder = TrayIconBuilder::with_id(MAIN_TRAY_ICON_ID)
                .menu(&menu)
                .tooltip("OverlayTerm")
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

            Ok(())
        })
        .invoke_handler(invoke_handler)
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
