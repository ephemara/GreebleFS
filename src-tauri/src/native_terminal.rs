use serde::Deserialize;
use tauri::WebviewWindow;

#[derive(Debug, Clone, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum NativeTerminalCursorStyle {
    Bar,
    Block,
    Underline,
}

#[derive(Debug, Clone, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct NativeTerminalOpenRequest {
    pub working_dir: String,
    pub shell: Option<String>,
    pub font_family: Option<String>,
    pub font_size: Option<u32>,
    pub scrollback: Option<u64>,
    pub cursor_blink: Option<bool>,
    pub cursor_style: Option<NativeTerminalCursorStyle>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub title: Option<String>,
}

#[tauri::command]
#[specta::specta]
pub fn terminal_open_native(
    window: WebviewWindow,
    request: NativeTerminalOpenRequest,
) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        terminal_open_native_linux(&window, request)
    }

    #[cfg(not(target_os = "linux"))]
    {
        let _ = window;
        let _ = request;
        Err("Native terminal windows are only supported on Linux.".to_string())
    }
}

#[cfg(target_os = "linux")]
mod linux {
    use super::{NativeTerminalCursorStyle, NativeTerminalOpenRequest};
    use gtk::glib;
    use gtk::glib::translate::{from_glib_full, from_glib_none, ToGlibPtr};
    use gtk::prelude::*;
    use gtk::{Box as GtkBox, Orientation, ScrolledWindow, Window, WindowType};
    use libloading::Library;
    use once_cell::sync::OnceCell;
    use std::ffi::CString;
    use std::os::raw::c_char;
    use std::os::unix::ffi::OsStrExt;
    use std::path::{Path, PathBuf};
    use std::sync::mpsc;
    use tauri::WebviewWindow;

    type GtkWidgetPtr = *mut gtk::ffi::GtkWidget;
    type SpawnSyncFn = unsafe extern "C" fn(
        terminal: GtkWidgetPtr,
        pty_flags: i32,
        working_directory: *const c_char,
        argv: *mut *mut c_char,
        envv: *mut *mut c_char,
        spawn_flags: i32,
        child_setup: Option<unsafe extern "C" fn(glib::ffi::gpointer)>,
        child_setup_data: glib::ffi::gpointer,
        child_pid: *mut glib::ffi::GPid,
        cancellable: *mut gtk::gio::ffi::GCancellable,
        error: *mut *mut glib::ffi::GError,
    ) -> glib::ffi::gboolean;
    type SetFontFn = unsafe extern "C" fn(
        terminal: GtkWidgetPtr,
        font_desc: *const gtk::pango::ffi::PangoFontDescription,
    );
    type WatchChildFn = unsafe extern "C" fn(terminal: GtkWidgetPtr, child_pid: glib::ffi::GPid);

    struct VteApi {
        terminal_new: unsafe extern "C" fn() -> GtkWidgetPtr,
        terminal_set_scrollback_lines: unsafe extern "C" fn(GtkWidgetPtr, i64),
        terminal_set_cursor_blink_mode: unsafe extern "C" fn(GtkWidgetPtr, i32),
        terminal_set_cursor_shape: unsafe extern "C" fn(GtkWidgetPtr, i32),
        terminal_set_font: SetFontFn,
        terminal_spawn_sync: SpawnSyncFn,
        terminal_watch_child: WatchChildFn,
    }

    static VTE_API: OnceCell<VteApi> = OnceCell::new();

    const VTE_LIBRARY_CANDIDATES: &[&str] = &["libvte-2.91.so.0", "libvte-2.91.so"];
    const DEFAULT_NATIVE_TERMINAL_TITLE: &str = "GreebleFS Native Terminal";
    const DEFAULT_NATIVE_TERMINAL_WIDTH: u32 = 1280;
    const DEFAULT_NATIVE_TERMINAL_HEIGHT: u32 = 860;
    const MIN_NATIVE_TERMINAL_WIDTH: u32 = 640;
    const MIN_NATIVE_TERMINAL_HEIGHT: u32 = 420;

    pub(super) fn terminal_open_native_linux(
        window: &WebviewWindow,
        request: NativeTerminalOpenRequest,
    ) -> Result<(), String> {
        let request = normalize_request(request);
        run_on_window_main_thread(window, {
            let window = window.clone();
            move || open_native_terminal_on_main_thread(&window, &request)
        })?
    }

    fn open_native_terminal_on_main_thread(
        parent_window: &WebviewWindow,
        request: &NativeTerminalOpenRequest,
    ) -> Result<(), String> {
        let vte = load_vte_api()?;
        let working_dir = resolve_native_working_dir(&request.working_dir)?;
        let shell = resolve_native_shell(request.shell.as_deref())?;

        let parent_gtk_window = parent_window
            .gtk_window()
            .map_err(|error| format!("Failed to access GTK host window: {error}"))?;
        let native_window = Window::new(WindowType::Toplevel);
        native_window.set_title(&resolve_window_title(request));
        native_window.set_default_size(
            clamp_window_dimension(
                request.width,
                DEFAULT_NATIVE_TERMINAL_WIDTH,
                MIN_NATIVE_TERMINAL_WIDTH,
            ),
            clamp_window_dimension(
                request.height,
                DEFAULT_NATIVE_TERMINAL_HEIGHT,
                MIN_NATIVE_TERMINAL_HEIGHT,
            ),
        );
        native_window.set_transient_for(Some(parent_gtk_window.upcast_ref::<Window>()));
        native_window.set_destroy_with_parent(false);

        let terminal_ptr = unsafe { (vte.terminal_new)() };
        if terminal_ptr.is_null() {
            return Err("VTE returned a null terminal widget.".to_string());
        }

        let terminal_widget: gtk::Widget = unsafe { from_glib_none(terminal_ptr) };
        let scrolled_window =
            ScrolledWindow::new(None::<&gtk::Adjustment>, None::<&gtk::Adjustment>);
        scrolled_window.set_hexpand(true);
        scrolled_window.set_vexpand(true);
        scrolled_window.add(&terminal_widget);

        let container = GtkBox::new(Orientation::Vertical, 0);
        container.set_hexpand(true);
        container.set_vexpand(true);
        container.pack_start(&scrolled_window, true, true, 0);
        native_window.add(&container);

        if let Some(scrollback) = request.scrollback {
            let scrollback = scrollback.min(i64::MAX as u64) as i64;
            unsafe {
                (vte.terminal_set_scrollback_lines)(terminal_ptr, scrollback);
            }
        }

        if let Some(cursor_blink_mode) = resolve_cursor_blink_mode(request.cursor_blink) {
            unsafe {
                (vte.terminal_set_cursor_blink_mode)(terminal_ptr, cursor_blink_mode);
            }
        }

        if let Some(cursor_style) = request.cursor_style.as_ref() {
            let cursor_shape = resolve_cursor_shape(cursor_style)?;
            unsafe {
                (vte.terminal_set_cursor_shape)(terminal_ptr, cursor_shape);
            }
        }

        if let Some(font_description) = build_native_font_description(request) {
            unsafe {
                (vte.terminal_set_font)(terminal_ptr, font_description.to_glib_none().0);
            }
        }

        spawn_terminal_process(vte, terminal_ptr, &working_dir, &shell)?;

        native_window.set_icon_name(Some("utilities-terminal"));

        let native_window_for_exit = native_window.clone();
        terminal_widget.connect_closure(
            "child-exited",
            false,
            glib::closure_local!(move |_terminal: gtk::Widget, _status: i32| {
                native_window_for_exit.close();
            }),
        );

        native_window.show_all();
        native_window.present();
        terminal_widget.grab_focus();
        Ok(())
    }

    fn build_native_font_description(
        request: &NativeTerminalOpenRequest,
    ) -> Option<gtk::pango::FontDescription> {
        let family = request
            .font_family
            .as_deref()
            .and_then(resolve_native_font_family)
            .or_else(|| Some("monospace".to_string()))?;
        let mut font_description = gtk::pango::FontDescription::new();
        font_description.set_family(&family);
        if let Some(font_size) = request.font_size {
            font_description.set_size(font_size.max(1) as i32 * gtk::pango::SCALE);
        }
        Some(font_description)
    }

    fn spawn_terminal_process(
        vte: &VteApi,
        terminal_ptr: GtkWidgetPtr,
        working_dir: &Path,
        shell: &str,
    ) -> Result<(), String> {
        let working_dir = path_to_cstring(working_dir)?;
        let shell_display = shell.to_string();
        let shell = CString::new(shell).map_err(|error| {
            format!("Native shell path contains an interior null byte: {error}")
        })?;
        let mut argv_strings = vec![shell];
        let mut argv = argv_strings
            .iter_mut()
            .map(|value| value.as_ptr() as *mut c_char)
            .collect::<Vec<_>>();
        argv.push(std::ptr::null_mut());

        let mut child_pid = 0 as glib::ffi::GPid;
        let mut spawn_error = std::ptr::null_mut();
        let spawn_result = unsafe {
            (vte.terminal_spawn_sync)(
                terminal_ptr,
                0,
                working_dir.as_ptr(),
                argv.as_mut_ptr(),
                std::ptr::null_mut(),
                0,
                None,
                std::ptr::null_mut(),
                &mut child_pid,
                std::ptr::null_mut(),
                &mut spawn_error,
            )
        };

        if spawn_result == glib::ffi::GFALSE {
            let error_message = if spawn_error.is_null() {
                format!("Failed to spawn native terminal shell: {shell_display}")
            } else {
                let error: glib::Error = unsafe { from_glib_full(spawn_error) };
                error.to_string()
            };
            return Err(error_message);
        }

        unsafe {
            (vte.terminal_watch_child)(terminal_ptr, child_pid);
        }
        Ok(())
    }

    fn resolve_window_title(request: &NativeTerminalOpenRequest) -> String {
        request
            .title
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or(DEFAULT_NATIVE_TERMINAL_TITLE)
            .to_string()
    }

    fn normalize_request(mut request: NativeTerminalOpenRequest) -> NativeTerminalOpenRequest {
        request.working_dir = request.working_dir.trim().to_string();
        request.shell = normalize_optional_text(request.shell);
        request.font_family = normalize_optional_text(request.font_family);
        request.title = normalize_optional_text(request.title);
        request
    }

    fn normalize_optional_text(value: Option<String>) -> Option<String> {
        value
            .map(|entry| entry.trim().to_string())
            .filter(|entry| !entry.is_empty())
    }

    fn resolve_native_font_family(font_family: &str) -> Option<String> {
        font_family
            .split(',')
            .map(str::trim)
            .find(|entry| !entry.is_empty())
            .map(ToOwned::to_owned)
    }

    fn resolve_native_working_dir(path: &str) -> Result<PathBuf, String> {
        if path.trim().is_empty() {
            return std::env::current_dir()
                .or_else(|_| {
                    dirs::home_dir()
                        .ok_or_else(|| std::io::Error::from(std::io::ErrorKind::NotFound))
                })
                .map_err(|error| {
                    format!(
                        "Unable to resolve a working directory for the native terminal: {error}"
                    )
                });
        }

        let requested = PathBuf::from(path);
        if requested.is_dir() {
            return Ok(requested);
        }
        if requested.is_file() {
            return requested.parent().map(Path::to_path_buf).ok_or_else(|| {
                format!("Working directory does not have a parent directory: {path}")
            });
        }

        Err(format!("Working directory does not exist: {path}"))
    }

    fn resolve_native_shell(shell: Option<&str>) -> Result<String, String> {
        let requested_shell = shell
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned);
        let env_shell = std::env::var("SHELL")
            .ok()
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty());

        for candidate in requested_shell
            .into_iter()
            .chain(env_shell.into_iter())
            .chain(["/bin/bash".to_string(), "/bin/sh".to_string()])
        {
            if is_shell_candidate_usable(&candidate) {
                return Ok(candidate);
            }
        }

        Err("Unable to resolve a Linux shell for the native terminal window.".to_string())
    }

    fn is_shell_candidate_usable(candidate: &str) -> bool {
        if candidate.contains(std::path::MAIN_SEPARATOR) {
            Path::new(candidate).exists()
        } else {
            !candidate.trim().is_empty()
        }
    }

    fn resolve_cursor_blink_mode(cursor_blink: Option<bool>) -> Option<i32> {
        let blink_mode_nick = if cursor_blink.unwrap_or(true) {
            "on"
        } else {
            "off"
        };
        resolve_gobject_enum_value("VteCursorBlinkMode", blink_mode_nick).ok()
    }

    fn resolve_cursor_shape(cursor_style: &NativeTerminalCursorStyle) -> Result<i32, String> {
        let shape_nick = match cursor_style {
            NativeTerminalCursorStyle::Bar => "ibeam",
            NativeTerminalCursorStyle::Block => "block",
            NativeTerminalCursorStyle::Underline => "underline",
        };
        resolve_gobject_enum_value("VteCursorShape", shape_nick)
    }

    fn resolve_gobject_enum_value(type_name: &str, value_nick: &str) -> Result<i32, String> {
        let type_name = CString::new(type_name)
            .map_err(|error| format!("Invalid GObject enum type name: {error}"))?;
        let value_nick = CString::new(value_nick)
            .map_err(|error| format!("Invalid GObject enum value nick: {error}"))?;
        let enum_type = unsafe { glib::gobject_ffi::g_type_from_name(type_name.as_ptr()) };
        if enum_type == 0 {
            return Err(format!(
                "GObject enum type is unavailable: {}",
                type_name.to_string_lossy()
            ));
        }

        let enum_class_ptr = unsafe { glib::gobject_ffi::g_type_class_ref(enum_type) };
        if enum_class_ptr.is_null() {
            return Err(format!(
                "Failed to access GObject enum class for {}.",
                type_name.to_string_lossy()
            ));
        }

        let value = unsafe {
            let enum_class = enum_class_ptr as *mut glib::gobject_ffi::GEnumClass;
            let enum_value =
                glib::gobject_ffi::g_enum_get_value_by_nick(enum_class, value_nick.as_ptr());
            let resolved_value = if enum_value.is_null() {
                None
            } else {
                Some((*enum_value).value)
            };
            glib::gobject_ffi::g_type_class_unref(enum_class_ptr);
            resolved_value
        };

        value.ok_or_else(|| {
            format!(
                "GObject enum value {value_nick:?} is unavailable on {}.",
                type_name.to_string_lossy()
            )
        })
    }

    fn clamp_window_dimension(value: Option<u32>, fallback: u32, min: u32) -> i32 {
        value.unwrap_or(fallback).max(min).min(i32::MAX as u32) as i32
    }

    fn path_to_cstring(path: &Path) -> Result<CString, String> {
        CString::new(path.as_os_str().as_bytes().to_vec())
            .map_err(|error| format!("Path contains an interior null byte: {error}"))
    }

    fn load_vte_api() -> Result<&'static VteApi, String> {
        VTE_API.get_or_try_init(|| {
            let library = load_vte_library()?;
            Ok(VteApi {
                terminal_new: load_symbol(library, b"vte_terminal_new\0")?,
                terminal_set_scrollback_lines: load_symbol(
                    library,
                    b"vte_terminal_set_scrollback_lines\0",
                )?,
                terminal_set_cursor_blink_mode: load_symbol(
                    library,
                    b"vte_terminal_set_cursor_blink_mode\0",
                )?,
                terminal_set_cursor_shape: load_symbol(
                    library,
                    b"vte_terminal_set_cursor_shape\0",
                )?,
                terminal_set_font: load_symbol(library, b"vte_terminal_set_font\0")?,
                terminal_spawn_sync: load_symbol(library, b"vte_terminal_spawn_sync\0")?,
                terminal_watch_child: load_symbol(library, b"vte_terminal_watch_child\0")?,
            })
        })
    }

    fn load_vte_library() -> Result<&'static Library, String> {
        for candidate in VTE_LIBRARY_CANDIDATES {
            let library = unsafe { Library::new(*candidate) };
            if let Ok(library) = library {
                return Ok(Box::leak(Box::new(library)));
            }
        }

        Err(
            "Unable to load libvte-2.91 at runtime. Install the VTE GTK3 runtime package to use native terminal windows."
                .to_string(),
        )
    }

    fn load_symbol<T: Copy>(
        library: &'static Library,
        symbol_name: &'static [u8],
    ) -> Result<T, String> {
        let symbol = unsafe { library.get::<T>(symbol_name) }
            .map_err(|error| format!("Failed to load {:?} from libvte: {error}", symbol_name))?;
        Ok(*symbol)
    }

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
            .map_err(|error| format!("Failed to receive GTK main-thread result: {error}"))
    }
}

#[cfg(target_os = "linux")]
use linux::terminal_open_native_linux;
