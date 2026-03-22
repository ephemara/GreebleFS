pub mod desktop_integration;
pub mod entry_size_cache;
pub mod fs_commands;
pub mod plugin_commands;
pub mod python_commands;
pub mod screenshot_commands;
pub mod startup_commands;
pub mod terminal;
pub mod window_commands;

use desktop_integration::{fs_resolve_native_icons, fs_start_native_file_drag};
use entry_size_cache::{
    fs_unwatch_entry_size_root, fs_watch_entry_size_root, initialize_entry_size_cache,
    EntrySizeWatcherState,
};
use fs_commands::{
    fs_cancel_search_entries, fs_copy, fs_create_dir, fs_delete, fs_get_drives, fs_get_home_dir,
    fs_get_runtime_cache_policy, fs_list_dir, fs_list_dir_uncached, fs_measure_entry_sizes,
    fs_move, fs_open_as_admin, fs_open_file, fs_read_file_base64, fs_read_text_file, fs_rename,
    fs_reveal_in_explorer, fs_search_entries, fs_search_entries_with_diagnostics,
    fs_transfer_items, fs_write_file, git_exec,
};
use plugin_commands::{
    plugin_run_backend, plugin_unwatch_directory, plugin_watch_directory, PluginWatcherState,
};
use python_commands::{
    python_bootstrap_runtime, python_execute, python_get_runtime_status, python_install_packages,
};
use screenshot_commands::{
    screenshot_capture_preview, screenshot_copy_image_to_clipboard,
    screenshot_copy_region_to_clipboard, screenshot_read_gallery_thumbnail, screenshot_save_region,
};
use startup_commands::{startup_get_launch_at_startup, startup_set_launch_at_startup};
use tauri::{
    menu::{MenuBuilder, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use terminal::{
    terminal_kill, terminal_open_external, terminal_resize, terminal_spawn, terminal_write,
    TerminalManager,
};
use window_commands::{
    tray_set_visible, window_set_blur, window_set_taskbar_visibility, MAIN_TRAY_ICON_ID,
};

fn toggle_overlay(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let is_visible = win.is_visible().unwrap_or(false);
        if is_visible {
            let _ = win.emit("overlay://toggle-request", ());
        } else {
            let _ = win.emit("overlay://toggle-request", ());
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            app.manage(TerminalManager::new());
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
        .invoke_handler(tauri::generate_handler![
            // Terminal
            terminal_spawn,
            terminal_write,
            terminal_resize,
            terminal_kill,
            terminal_open_external,
            // File System
            fs_list_dir,
            fs_get_drives,
            fs_measure_entry_sizes,
            fs_watch_entry_size_root,
            fs_unwatch_entry_size_root,
            fs_read_text_file,
            fs_open_file,
            fs_open_as_admin,
            fs_reveal_in_explorer,
            fs_delete,
            fs_rename,
            fs_move,
            fs_copy,
            fs_transfer_items,
            fs_create_dir,
            fs_read_file_base64,
            fs_write_file,
            fs_get_runtime_cache_policy,
            fs_list_dir_uncached,
            fs_cancel_search_entries,
            fs_search_entries,
            fs_search_entries_with_diagnostics,
            git_exec,
            fs_get_home_dir,
            fs_resolve_native_icons,
            fs_start_native_file_drag,
            screenshot_capture_preview,
            screenshot_save_region,
            screenshot_copy_region_to_clipboard,
            screenshot_copy_image_to_clipboard,
            screenshot_read_gallery_thumbnail,
            python_get_runtime_status,
            python_bootstrap_runtime,
            python_install_packages,
            python_execute,
            plugin_run_backend,
            plugin_watch_directory,
            plugin_unwatch_directory,
            startup_get_launch_at_startup,
            startup_set_launch_at_startup,
            tray_set_visible,
            window_set_blur,
            window_set_taskbar_visibility,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
