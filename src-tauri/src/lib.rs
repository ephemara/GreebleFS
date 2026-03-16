pub mod fs_commands;
pub mod plugin_commands;
pub mod screenshot_commands;
pub mod startup_commands;
pub mod terminal;

use fs_commands::{
    fs_copy, fs_create_dir, fs_delete, fs_get_drives, fs_get_home_dir, fs_list_dir, fs_move,
    fs_open_as_admin, fs_open_file, fs_read_file_base64, fs_read_text_file, fs_rename,
    fs_reveal_in_explorer, fs_transfer_items, fs_write_file, git_exec,
};
use plugin_commands::plugin_run_backend;
use screenshot_commands::{
    screenshot_capture_preview, screenshot_copy_image_to_clipboard, screenshot_save_region,
};
use startup_commands::{startup_get_launch_at_startup, startup_set_launch_at_startup};
use tauri::{
    menu::{MenuBuilder, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
use terminal::{
    terminal_kill, terminal_open_external, terminal_resize, terminal_spawn, terminal_write,
    TerminalManager,
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
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            app.manage(TerminalManager::new());

            // ── Global shortcut: Ctrl+Space (works even when window is hidden) ──
            if let Err(err) =
                app.global_shortcut()
                    .on_shortcut("Ctrl+Space", |app, _shortcut, event| {
                        if event.state == ShortcutState::Pressed {
                            toggle_overlay(app);
                        }
                    })
            {
                eprintln!("failed to register Ctrl+Space global shortcut: {err}");
            }

            // ── System Tray ──
            let tray_icon = app.default_window_icon().cloned();

            let toggle_item = MenuItem::with_id(
                app,
                "toggle",
                "Toggle Terminal  (Ctrl+Space)",
                true,
                None::<&str>,
            )?;
            let separator = tauri::menu::PredefinedMenuItem::separator(app)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit OverlayTerm", true, None::<&str>)?;

            let menu = MenuBuilder::new(app)
                .items(&[&toggle_item, &separator, &quit_item])
                .build()?;

            let mut tray_builder = TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("OverlayTerm  —  Ctrl+Space to toggle")
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
            git_exec,
            fs_get_home_dir,
            screenshot_capture_preview,
            screenshot_save_region,
            screenshot_copy_image_to_clipboard,
            plugin_run_backend,
            startup_get_launch_at_startup,
            startup_set_launch_at_startup,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
