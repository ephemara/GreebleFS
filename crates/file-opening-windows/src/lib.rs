use file_opening::{FileOpener, OpenResult, OpenWithApp};
use std::path::Path;
use windows::core::*;
use windows::Win32::System::Com::*;
use windows::Win32::UI::Shell::*;
use windows::Win32::UI::WindowsAndMessaging::*;

// Thread-local COM initialization
thread_local! {
    static COM_INITIALIZED: std::cell::RefCell<bool> = std::cell::RefCell::new(false);
}

fn ensure_com_initialized() {
    COM_INITIALIZED.with(|initialized| {
        if !*initialized.borrow() {
            unsafe {
                let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
            }
            *initialized.borrow_mut() = true;
        }
    });
}

pub struct WindowsFileOpener;

impl FileOpener for WindowsFileOpener {
    fn get_apps_for_file(&self, path: &Path) -> std::result::Result<Vec<OpenWithApp>, String> {
        ensure_com_initialized();

        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| format!(".{}", e))
            .unwrap_or_default();

        if ext.is_empty() {
            return Ok(vec![]);
        }

        list_apps_for_extension(&ext)
    }

    fn open_with_default(&self, path: &Path) -> std::result::Result<OpenResult, String> {
        ensure_com_initialized();

        if !path.exists() {
            return Ok(OpenResult::FileNotFound {
                path: path.to_string_lossy().to_string(),
            });
        }

        let path_str = path.to_string_lossy();
        let h_path = HSTRING::from(&*path_str);

        unsafe {
            let result = ShellExecuteW(None, w!("open"), &h_path, None, None, SW_SHOWNORMAL);

            if result.0 as isize > 32 {
                Ok(OpenResult::Success)
            } else {
                Ok(OpenResult::PlatformError {
                    message: format!("ShellExecute failed with code {}", result.0 as isize),
                })
            }
        }
    }

    fn open_with_app(&self, path: &Path, app_id: &str) -> std::result::Result<OpenResult, String> {
        ensure_com_initialized();

        if !path.exists() {
            return Ok(OpenResult::FileNotFound {
                path: path.to_string_lossy().to_string(),
            });
        }

        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| format!(".{}", e))
            .unwrap_or_default();

        if ext.is_empty() {
            return Ok(OpenResult::PlatformError {
                message: "File has no extension".to_string(),
            });
        }

        // Find handler by app_id (which is the app name on Windows)
        unsafe {
            let handlers =
                SHAssocEnumHandlers(&HSTRING::from(ext.as_str()), ASSOC_FILTER_RECOMMENDED)
                    .map_err(|e| e.to_string())?;

            loop {
                let mut handler_array: [Option<IAssocHandler>; 1] = [None];
                let mut fetched = 0u32;

                if handlers
                    .Next(&mut handler_array, Some(&mut fetched))
                    .is_err()
                    || fetched == 0
                {
                    break;
                }

                if let Some(handler) = &handler_array[0] {
                    let name = handler
                        .GetName()
                        .map_err(|e| e.to_string())?
                        .to_string()
                        .map_err(|e| e.to_string())?;

                    if name == app_id {
                        // Create shell item from file path
                        let path_str = path.to_string_lossy();
                        let h_path = HSTRING::from(&*path_str);

                        let shell_item: IShellItem = SHCreateItemFromParsingName(&h_path, None)
                            .map_err(|e| e.to_string())?;

                        let data_object: IDataObject = shell_item
                            .BindToHandler(None, &BHID_DataObject)
                            .map_err(|e| e.to_string())?;

                        handler.Invoke(&data_object).map_err(|e| e.to_string())?;

                        return Ok(OpenResult::Success);
                    }
                }
            }

            Ok(OpenResult::AppNotFound {
                app_id: app_id.to_string(),
            })
        }
    }
}

fn list_apps_for_extension(ext: &str) -> std::result::Result<Vec<OpenWithApp>, String> {
    unsafe {
        let handlers = SHAssocEnumHandlers(&HSTRING::from(ext), ASSOC_FILTER_RECOMMENDED)
            .map_err(|e| e.to_string())?;

        let mut apps = Vec::new();

        loop {
            let mut handler_array: [Option<IAssocHandler>; 1] = [None];
            let mut fetched = 0u32;

            if handlers
                .Next(&mut handler_array, Some(&mut fetched))
                .is_err()
                || fetched == 0
            {
                break;
            }

            if let Some(handler) = &handler_array[0] {
                let name = handler
                    .GetName()
                    .map_err(|e| e.to_string())?
                    .to_string()
                    .map_err(|e| e.to_string())?;

                apps.push(OpenWithApp {
                    id: name.clone(),
                    name,
                    icon: None,
                });
            }
        }

        apps.sort_by(|a, b| a.name.cmp(&b.name));
        Ok(apps)
    }
}

#[cfg(test)]
mod tests {
    use super::{FileOpener, OpenResult, WindowsFileOpener};
    use std::fs;

    fn unique_temp_path(name: &str) -> std::path::PathBuf {
        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("clock should be monotonic")
            .as_nanos();
        std::env::temp_dir().join(format!("overlayterm-{name}-{stamp}"))
    }

    #[test]
    fn get_apps_for_file_returns_empty_for_files_without_extensions() {
        let opener = WindowsFileOpener;
        let path = unique_temp_path("no-ext");
        fs::write(&path, b"").expect("temp file should be written");

        let apps = opener
            .get_apps_for_file(&path)
            .expect("lookup should succeed");
        assert!(apps.is_empty());

        let _ = fs::remove_file(&path);
    }

    #[test]
    fn open_with_app_reports_missing_file_or_missing_extension() {
        let opener = WindowsFileOpener;

        let missing = unique_temp_path("missing-file");
        let missing_result = opener
            .open_with_app(&missing, "AnyApp")
            .expect("missing file should not hard fail");
        assert!(matches!(missing_result, OpenResult::FileNotFound { .. }));

        let no_ext = unique_temp_path("no-ext-app");
        fs::write(&no_ext, b"").expect("temp file should be written");
        let no_ext_result = opener
            .open_with_app(&no_ext, "AnyApp")
            .expect("missing extension path should not hard fail");
        assert!(
            matches!(no_ext_result, OpenResult::PlatformError { message } if message.contains("no extension"))
        );

        let _ = fs::remove_file(&no_ext);
    }
}
