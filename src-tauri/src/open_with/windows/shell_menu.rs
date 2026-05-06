//

use crate::open_with::types::{
    GetShellContextMenuResult, OpenWithResult, ShellContextMenuItem, ShellContextMenuRequest,
    ShellContextMenuTargetKind,
};
use crate::open_with::utils::canonicalize_path;
use image::codecs::png::PngEncoder;
use image::ImageEncoder;
use std::ffi::{CString, OsStr};
use std::os::windows::ffi::OsStrExt;
use std::path::{Path, PathBuf};
use windows::core::{HSTRING, PCSTR, PCWSTR, PSTR};
use windows::Win32::Foundation::{HWND, TRUE};
use windows::Win32::System::Com::{
    CoInitializeEx, CoTaskMemFree, CoUninitialize, COINIT_APARTMENTTHREADED,
};
use windows::Win32::UI::Shell::{
    Common::ITEMIDLIST, IContextMenu, IShellFolder, IShellItem, IShellItemArray, SHBindToParent,
    SHCreateItemFromParsingName, SHCreateShellItemArrayFromIDLists, SHParseDisplayName,
    ShellExecuteExW, BHID_SFObject, BHID_SFUIObject, CMINVOKECOMMANDINFOEX, CMF_EXPLORE,
    CMF_EXTENDEDVERBS, CMF_NORMAL, GCS_VERBA, SEE_MASK_ASYNCOK, SEE_MASK_UNICODE,
    SHELLEXECUTEINFOW,
};
use windows::Win32::UI::WindowsAndMessaging::{
    CreatePopupMenu, DestroyMenu, GetForegroundWindow, GetMenuItemCount, GetMenuItemInfoW, HMENU,
    MENUITEMINFOW, MIIM_BITMAP, MIIM_ID, MIIM_STRING, MIIM_SUBMENU, SW_SHOWNORMAL,
};

const SHELL_CONTEXT_MENU_QUERY_FLAGS: u32 = CMF_NORMAL | CMF_EXPLORE | CMF_EXTENDEDVERBS;
const UNSUPPORTED_VERBS: &[&str] = &["pintostartscreen"];

#[derive(Debug, Clone)]
struct NormalizedShellContextMenuRequest {
    target_kind: ShellContextMenuTargetKind,
    current_directory_path: String,
    target_paths: Vec<String>,
}

struct PidlGuard(*mut ITEMIDLIST);

impl PidlGuard {
    fn as_const_ptr(&self) -> *const ITEMIDLIST {
        self.0 as *const ITEMIDLIST
    }
}

impl Drop for PidlGuard {
    fn drop(&mut self) {
        unsafe {
            if !self.0.is_null() {
                CoTaskMemFree(Some(self.0 as *const std::ffi::c_void));
            }
        }
    }
}

fn success_open_with_result() -> OpenWithResult {
    OpenWithResult {
        success: true,
        error: None,
    }
}

fn error_open_with_result(message: impl Into<String>) -> OpenWithResult {
    OpenWithResult {
        success: false,
        error: Some(message.into()),
    }
}

fn error_shell_context_menu_result(message: impl Into<String>) -> GetShellContextMenuResult {
    GetShellContextMenuResult {
        success: false,
        items: vec![],
        error: Some(message.into()),
    }
}

fn normalize_existing_path(raw_path: &str, label: &str) -> Result<String, String> {
    let trimmed_path = raw_path.trim();
    if trimmed_path.is_empty() {
        return Err(format!("{label} cannot be empty."));
    }

    let path = Path::new(trimmed_path);
    if !path.exists() {
        return Err(format!("{label} not found: {trimmed_path}"));
    }

    Ok(canonicalize_path(path))
}

fn normalize_shell_context_menu_request(
    request: &ShellContextMenuRequest,
) -> Result<NormalizedShellContextMenuRequest, String> {
    let current_directory_path =
        normalize_existing_path(&request.current_directory_path, "Current directory path")?;
    if !Path::new(&current_directory_path).is_dir() {
        return Err(format!(
            "Current directory path must be a directory: {}",
            current_directory_path
        ));
    }

    let target_paths = request
        .target_paths
        .iter()
        .map(|path| normalize_existing_path(path, "Target path"))
        .collect::<Result<Vec<_>, _>>()?;

    match request.target_kind {
        ShellContextMenuTargetKind::Entry => {
            if target_paths.len() != 1 {
                return Err(
                    "Windows shell item menus require exactly one target path.".to_string(),
                );
            }
        }
        ShellContextMenuTargetKind::MultiSelect => {
            if target_paths.is_empty() {
                return Err(
                    "Windows shell multi-select menus require at least one target path."
                        .to_string(),
                );
            }
        }
        ShellContextMenuTargetKind::Background => {
            if !target_paths.is_empty() {
                return Err(
                    "Windows shell background menus cannot include target paths.".to_string(),
                );
            }
        }
    }

    Ok(NormalizedShellContextMenuRequest {
        target_kind: request.target_kind.clone(),
        current_directory_path,
        target_paths,
    })
}

unsafe fn create_entry_context_menu(target_path: &str) -> Result<IContextMenu, String> {
    let shell_item: IShellItem =
        SHCreateItemFromParsingName(&HSTRING::from(target_path), None).map_err(|error| {
            format!("Failed to create a shell item for '{}': {}", target_path, error)
        })?;

    shell_item
        .BindToHandler(None, &BHID_SFUIObject)
        .map_err(|error| {
            format!(
                "Failed to resolve a Windows shell context menu for '{}': {}",
                target_path, error
            )
        })
}

unsafe fn create_background_context_menu(
    current_directory_path: &str,
) -> Result<IContextMenu, String> {
    let shell_item: IShellItem = SHCreateItemFromParsingName(
        &HSTRING::from(current_directory_path),
        None,
    )
    .map_err(|error| {
        format!(
            "Failed to create a shell folder item for '{}': {}",
            current_directory_path, error
        )
    })?;

    let shell_folder: IShellFolder = shell_item
        .BindToHandler(None, &BHID_SFObject)
        .map_err(|error| {
            format!(
                "Failed to bind the shell folder for '{}': {}",
                current_directory_path, error
            )
        })?;

    shell_folder
        .CreateViewObject(HWND(std::ptr::null_mut()))
        .map_err(|error| {
        format!(
            "Failed to resolve a Windows folder background menu for '{}': {}",
            current_directory_path, error
        )
    })
}

unsafe fn parse_shell_pidl(path: &str) -> Result<PidlGuard, String> {
    let mut pidl = std::ptr::null_mut();
    SHParseDisplayName(
        &HSTRING::from(path),
        None,
        &mut pidl,
        0,
        None,
    )
    .map_err(|error| format!("Failed to parse the Windows shell path '{}': {}", path, error))?;

    if pidl.is_null() {
        return Err(format!(
            "Failed to parse the Windows shell path '{}': shell returned an empty PIDL.",
            path
        ));
    }

    Ok(PidlGuard(pidl))
}

unsafe fn parse_shell_pidls(paths: &[String]) -> Result<Vec<PidlGuard>, String> {
    paths
        .iter()
        .map(|path| parse_shell_pidl(path))
        .collect::<Result<Vec<_>, _>>()
}

fn resolve_common_parent_path(target_paths: &[String]) -> Option<PathBuf> {
    let first_parent = Path::new(target_paths.first()?).parent()?.to_path_buf();
    if target_paths
        .iter()
        .all(|path| Path::new(path).parent() == Some(first_parent.as_path()))
    {
        Some(first_parent)
    } else {
        None
    }
}

unsafe fn create_multi_select_context_menu_from_item_array(
    pidl_guards: &[PidlGuard],
) -> Result<IContextMenu, String> {
    let pidl_ptrs = pidl_guards
        .iter()
        .map(|pidl| pidl.as_const_ptr())
        .collect::<Vec<_>>();

    let shell_item_array: IShellItemArray =
        SHCreateShellItemArrayFromIDLists(&pidl_ptrs).map_err(|error| {
            format!(
                "Failed to create the Windows shell selection array for {} selected items: {}",
                pidl_ptrs.len(),
                error
            )
        })?;

    shell_item_array
        .BindToHandler(None, &BHID_SFUIObject)
        .map_err(|error| {
            format!(
                "Failed to resolve a Windows multi-select context menu from the shell item array: {}",
                error
            )
        })
}

unsafe fn create_multi_select_context_menu_from_common_parent(
    target_paths: &[String],
    pidl_guards: &[PidlGuard],
) -> Result<IContextMenu, String> {
    let common_parent = resolve_common_parent_path(target_paths).ok_or_else(|| {
        "The selected items do not share a common parent directory, so the Windows shell folder fallback could not be used.".to_string()
    })?;

    let mut first_child_pidl = std::ptr::null_mut();
    let parent_shell_folder: IShellFolder =
        SHBindToParent(pidl_guards[0].as_const_ptr(), Some(&mut first_child_pidl)).map_err(
            |error| {
                format!(
                    "Failed to bind the Windows shell parent folder for '{}': {}",
                    target_paths[0], error
                )
            },
        )?;

    let mut child_pidls = vec![first_child_pidl as *const ITEMIDLIST];
    for (target_path, pidl_guard) in target_paths.iter().zip(pidl_guards.iter()).skip(1) {
        let mut child_pidl = std::ptr::null_mut();
        let _: IShellFolder =
            SHBindToParent(pidl_guard.as_const_ptr(), Some(&mut child_pidl)).map_err(|error| {
                format!(
                    "Failed to bind the Windows shell child item for '{}': {}",
                    target_path, error
                )
            })?;
        child_pidls.push(child_pidl as *const ITEMIDLIST);
    }

    parent_shell_folder
        .GetUIObjectOf(HWND(std::ptr::null_mut()), &child_pidls, None)
        .map_err(|error| {
            format!(
                "Failed to resolve a Windows multi-select context menu from the common parent directory '{}': {}",
                common_parent.display(),
                error
            )
        })
}

unsafe fn create_multi_select_context_menu(target_paths: &[String]) -> Result<IContextMenu, String> {
    let pidl_guards = parse_shell_pidls(target_paths)?;

    match create_multi_select_context_menu_from_item_array(&pidl_guards) {
        Ok(context_menu) => Ok(context_menu),
        Err(item_array_error) => {
            match create_multi_select_context_menu_from_common_parent(target_paths, &pidl_guards) {
                Ok(context_menu) => Ok(context_menu),
                Err(common_parent_error) => Err(format!(
                    "{} {}",
                    item_array_error, common_parent_error
                )),
            }
        }
    }
}

unsafe fn create_context_menu_for_request(
    request: &NormalizedShellContextMenuRequest,
) -> Result<IContextMenu, String> {
    match request.target_kind {
        ShellContextMenuTargetKind::Entry => create_entry_context_menu(&request.target_paths[0]),
        ShellContextMenuTargetKind::MultiSelect => {
            create_multi_select_context_menu(&request.target_paths)
        }
        ShellContextMenuTargetKind::Background => {
            create_background_context_menu(&request.current_directory_path)
        }
    }
}

unsafe fn query_shell_context_menu(context_menu: &IContextMenu) -> Result<HMENU, String> {
    let popup_menu = CreatePopupMenu()
        .map_err(|error| format!("Failed to create a Windows popup menu: {}", error))?;

    if let Err(error) =
        context_menu.QueryContextMenu(popup_menu, 0, 1, 0x7FFF, SHELL_CONTEXT_MENU_QUERY_FLAGS)
    {
        let _ = DestroyMenu(popup_menu);
        return Err(format!(
            "Failed to query the Windows shell context menu: {}",
            error
        ));
    }

    Ok(popup_menu)
}

unsafe fn extract_menu_items(
    context_menu: &IContextMenu,
    popup_menu: HMENU,
) -> Vec<ShellContextMenuItem> {
    let mut items = Vec::new();
    let menu_count = GetMenuItemCount(popup_menu);

    for menu_index in 0..menu_count {
        let mut text_buffer: [u16; 256] = [0; 256];
        let mut menu_item_info: MENUITEMINFOW = std::mem::zeroed();
        menu_item_info.cbSize = std::mem::size_of::<MENUITEMINFOW>() as u32;
        menu_item_info.fMask = MIIM_ID | MIIM_STRING | MIIM_SUBMENU | MIIM_BITMAP;
        menu_item_info.dwTypeData = windows::core::PWSTR(text_buffer.as_mut_ptr());
        menu_item_info.cch = text_buffer.len() as u32;

        if GetMenuItemInfoW(popup_menu, menu_index as u32, TRUE, &mut menu_item_info).is_err() {
            continue;
        }

        let text_length = text_buffer.iter().position(|&value| value == 0).unwrap_or(0);
        if text_length == 0 {
            continue;
        }

        let menu_text = String::from_utf16_lossy(&text_buffer[..text_length]).replace('&', "");
        if menu_text.trim().is_empty() {
            continue;
        }

        let icon = if !menu_item_info.hbmpItem.is_invalid() {
            extract_bitmap_to_base64(menu_item_info.hbmpItem)
        } else {
            None
        };

        if !menu_item_info.hSubMenu.is_invalid() {
            let children = extract_menu_items(context_menu, menu_item_info.hSubMenu);
            if !children.is_empty() {
                items.push(ShellContextMenuItem {
                    id: 0,
                    name: menu_text,
                    verb: None,
                    icon,
                    children: Some(children),
                });
            }
            continue;
        }

        let mut verb_buffer: [u8; 256] = [0; 256];
        let verb = if context_menu
            .GetCommandString(
                (menu_item_info.wID - 1) as usize,
                GCS_VERBA,
                None,
                PSTR::from_raw(verb_buffer.as_mut_ptr()),
                verb_buffer.len() as u32,
            )
            .is_ok()
        {
            let verb_length = verb_buffer.iter().position(|&value| value == 0).unwrap_or(0);
            if verb_length > 0 {
                Some(String::from_utf8_lossy(&verb_buffer[..verb_length]).to_string())
            } else {
                None
            }
        } else {
            None
        };

        if let Some(verb_value) = &verb {
            let lower_verb = verb_value.to_lowercase();
            if UNSUPPORTED_VERBS
                .iter()
                .any(|unsupported_verb| lower_verb == *unsupported_verb)
            {
                continue;
            }
        }

        items.push(ShellContextMenuItem {
            id: menu_item_info.wID,
            name: menu_text,
            verb,
            icon,
            children: None,
        });
    }

    items
}

unsafe fn extract_bitmap_to_base64(
    hbitmap: windows::Win32::Graphics::Gdi::HBITMAP,
) -> Option<String> {
    use base64::{engine::general_purpose, Engine as _};
    use windows::Win32::Graphics::Gdi::{
        CreateCompatibleDC, DeleteDC, GetDIBits, GetObjectW, SelectObject, BITMAP, BITMAPINFO,
        BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS,
    };

    let hdc = CreateCompatibleDC(None);
    if hdc.is_invalid() {
        return None;
    }

    let mut bmp: BITMAP = std::mem::zeroed();
    if GetObjectW(
        hbitmap,
        std::mem::size_of::<BITMAP>() as i32,
        Some(&mut bmp as *mut _ as *mut _),
    ) == 0
    {
        let _ = DeleteDC(hdc);
        return None;
    }

    let width = bmp.bmWidth;
    let height = bmp.bmHeight.abs();

    if width <= 0 || height <= 0 || width > 256 || height > 256 {
        let _ = DeleteDC(hdc);
        return None;
    }

    let mut bitmap_info: BITMAPINFO = std::mem::zeroed();
    bitmap_info.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
    bitmap_info.bmiHeader.biWidth = width;
    bitmap_info.bmiHeader.biHeight = -height;
    bitmap_info.bmiHeader.biPlanes = 1;
    bitmap_info.bmiHeader.biBitCount = 32;
    bitmap_info.bmiHeader.biCompression = BI_RGB.0;

    let pixel_count = (width * height) as usize;
    let mut pixels = vec![0; pixel_count * 4];

    let old_bitmap = SelectObject(hdc, hbitmap);
    let result = GetDIBits(
        hdc,
        hbitmap,
        0,
        height as u32,
        Some(pixels.as_mut_ptr() as *mut _),
        &mut bitmap_info,
        DIB_RGB_COLORS,
    );
    SelectObject(hdc, old_bitmap);
    let _ = DeleteDC(hdc);

    if result == 0 {
        return None;
    }

    let mut rgba_pixels = Vec::with_capacity(pixel_count * 4);
    for pixel_index in 0..pixel_count {
        let byte_index = pixel_index * 4;
        let blue = pixels[byte_index];
        let green = pixels[byte_index + 1];
        let red = pixels[byte_index + 2];
        let alpha = pixels[byte_index + 3];
        rgba_pixels.push(red);
        rgba_pixels.push(green);
        rgba_pixels.push(blue);
        rgba_pixels.push(alpha);
    }

    let mut png_data = Vec::new();
    let encoder = PngEncoder::new(&mut png_data);
    if encoder
        .write_image(
            &rgba_pixels,
            width as u32,
            height as u32,
            image::ExtendedColorType::Rgba8,
        )
        .is_err()
    {
        return None;
    }

    let base64_str = general_purpose::STANDARD.encode(&png_data);
    Some(format!("data:image/png;base64,{}", base64_str))
}

unsafe fn get_context_menu_items(
    request: &ShellContextMenuRequest,
) -> GetShellContextMenuResult {
    let normalized_request = match normalize_shell_context_menu_request(request) {
        Ok(normalized_request) => normalized_request,
        Err(message) => return error_shell_context_menu_result(message),
    };

    let context_menu = match create_context_menu_for_request(&normalized_request) {
        Ok(context_menu) => context_menu,
        Err(message) => return error_shell_context_menu_result(message),
    };

    let popup_menu = match query_shell_context_menu(&context_menu) {
        Ok(popup_menu) => popup_menu,
        Err(message) => return error_shell_context_menu_result(message),
    };

    let items = extract_menu_items(&context_menu, popup_menu);
    let _ = DestroyMenu(popup_menu);

    GetShellContextMenuResult {
        success: true,
        items,
        error: None,
    }
}

pub fn get_shell_context_menu_impl(
    request: &ShellContextMenuRequest,
) -> GetShellContextMenuResult {
    unsafe {
        let coinit_result = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
        let needs_uninit = coinit_result.is_ok();

        let result = get_context_menu_items(request);

        if needs_uninit {
            CoUninitialize();
        }

        result
    }
}

fn invoke_shell_verb(target_path: &str, command_verb: &str) -> OpenWithResult {
    let absolute_path = canonicalize_path(Path::new(target_path));
    let verb_wide: Vec<u16> = OsStr::new(command_verb)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let file_wide: Vec<u16> = OsStr::new(&absolute_path)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    unsafe {
        let mut shell_execute_info: SHELLEXECUTEINFOW = std::mem::zeroed();
        shell_execute_info.cbSize = std::mem::size_of::<SHELLEXECUTEINFOW>() as u32;
        shell_execute_info.lpVerb = PCWSTR(verb_wide.as_ptr());
        shell_execute_info.lpFile = PCWSTR(file_wide.as_ptr());
        shell_execute_info.nShow = SW_SHOWNORMAL.0;

        match ShellExecuteExW(&mut shell_execute_info) {
            Ok(_) => success_open_with_result(),
            Err(execute_error) => error_open_with_result(format!(
                "Failed to invoke the Windows shell verb '{}' for '{}': {}",
                command_verb, absolute_path, execute_error
            )),
        }
    }
}

unsafe fn invoke_context_menu_command_by_id(
    context_menu: &IContextMenu,
    command_id: u32,
) -> windows::core::Result<()> {
    let mut invoke_info: CMINVOKECOMMANDINFOEX = std::mem::zeroed();
    invoke_info.cbSize = std::mem::size_of::<CMINVOKECOMMANDINFOEX>() as u32;
    invoke_info.fMask = SEE_MASK_ASYNCOK;
    invoke_info.hwnd = GetForegroundWindow();
    invoke_info.lpVerb = PCSTR((command_id - 1) as usize as *const u8);
    invoke_info.nShow = SW_SHOWNORMAL.0;

    context_menu.InvokeCommand(&invoke_info as *const _ as *const _)
}

unsafe fn invoke_context_menu_command_by_verb(
    context_menu: &IContextMenu,
    command_verb: &str,
) -> windows::core::Result<()> {
    let verb_ansi = CString::new(command_verb).map_err(|_| {
        windows::core::Error::new(
            windows::core::HRESULT(0x80070057u32 as i32),
            "Invalid Windows shell command verb",
        )
    })?;
    let verb_wide: Vec<u16> = OsStr::new(command_verb)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    let mut invoke_info: CMINVOKECOMMANDINFOEX = std::mem::zeroed();
    invoke_info.cbSize = std::mem::size_of::<CMINVOKECOMMANDINFOEX>() as u32;
    invoke_info.fMask = SEE_MASK_ASYNCOK | SEE_MASK_UNICODE;
    invoke_info.hwnd = GetForegroundWindow();
    invoke_info.lpVerb = PCSTR(verb_ansi.as_ptr() as *const u8);
    invoke_info.lpVerbW = PCWSTR(verb_wide.as_ptr());
    invoke_info.nShow = SW_SHOWNORMAL.0;

    context_menu.InvokeCommand(&invoke_info as *const _ as *const _)
}

fn can_fallback_to_shell_execute(request: &NormalizedShellContextMenuRequest) -> bool {
    request.target_kind == ShellContextMenuTargetKind::Entry && request.target_paths.len() == 1
}

pub fn invoke_shell_command(
    request: &ShellContextMenuRequest,
    command_id: u32,
    command_verb: Option<&str>,
) -> OpenWithResult {
    if command_id == 0 {
        return error_open_with_result(
            "Windows shell action invocations require a concrete command id.",
        );
    }

    unsafe {
        let coinit_result = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
        let needs_uninit = coinit_result.is_ok();

        let result = match normalize_shell_context_menu_request(request) {
            Ok(normalized_request) => match create_context_menu_for_request(&normalized_request) {
                Ok(context_menu) => match query_shell_context_menu(&context_menu) {
                    Ok(popup_menu) => {
                        let invoke_result =
                            invoke_context_menu_command_by_id(&context_menu, command_id);
                        let _ = DestroyMenu(popup_menu);

                        match invoke_result {
                            Ok(_) => success_open_with_result(),
                            Err(invoke_error) => {
                                if let Some(command_verb) = command_verb {
                                    match invoke_context_menu_command_by_verb(
                                        &context_menu,
                                        command_verb,
                                    ) {
                                        Ok(_) => success_open_with_result(),
                                        Err(verb_invoke_error) => {
                                            if can_fallback_to_shell_execute(&normalized_request) {
                                                let fallback_result = invoke_shell_verb(
                                                    &normalized_request.target_paths[0],
                                                    command_verb,
                                                );
                                                if fallback_result.success {
                                                    fallback_result
                                                } else {
                                                    error_open_with_result(format!(
                                                        "Failed to invoke the Windows shell action by id ({}), by verb ({}), and via ShellExecute fallback ({}).",
                                                        invoke_error,
                                                        verb_invoke_error,
                                                        fallback_result
                                                            .error
                                                            .unwrap_or_else(|| "unknown fallback error".to_string())
                                                    ))
                                                }
                                            } else {
                                                error_open_with_result(format!(
                                                    "Failed to invoke the Windows shell action by id ({}) and by verb ({}).",
                                                    invoke_error, verb_invoke_error
                                                ))
                                            }
                                        }
                                    }
                                } else {
                                    error_open_with_result(format!(
                                        "Failed to invoke the Windows shell action: {}",
                                        invoke_error
                                    ))
                                }
                            }
                        }
                    }
                    Err(message) => error_open_with_result(message),
                },
                Err(message) => error_open_with_result(message),
            },
            Err(message) => error_open_with_result(message),
        };

        if needs_uninit {
            CoUninitialize();
        }

        result
    }
}
