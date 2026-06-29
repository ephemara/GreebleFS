use crate::embedding::{
  dcomp::DCompWindowEmbedding, legacy::LegacyWindowEmbedding, EmbeddingController,
};
use crate::types::{ExecutableSpec, WindowMgrError};
use std::collections::HashSet;
use std::process::{Child, Command};
use std::thread::sleep;
use std::time::Duration;
use windows::core::BOOL;
use windows::Win32::Foundation::{HWND, LPARAM, MAX_PATH};
use windows::Win32::Graphics::Dwm::{DwmSetWindowAttribute, DWMWINDOWATTRIBUTE};
use windows::Win32::Graphics::Gdi::{CreateRectRgn, DeleteObject, SetWindowRgn, HRGN};
use windows::Win32::System::Com::CoCreateInstance;
use windows::Win32::System::Threading::{
  OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_FORMAT, PROCESS_QUERY_LIMITED_INFORMATION,
};
use windows::Win32::UI::Shell::{
  ITaskbarList3, SHChangeNotify, TaskbarList, SHCNE_ASSOCCHANGED, SHCNF_IDLIST,
};
use windows::Win32::UI::WindowsAndMessaging::{
  EnumWindows, GetWindowLongPtrW, GetWindowThreadProcessId, IsWindowVisible, SetWindowLongPtrW,
  SetWindowPos, GWL_EXSTYLE, HWND_NOTOPMOST, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE,
  WS_EX_APPWINDOW, WS_EX_TOOLWINDOW,
};

pub struct AttachedWindowProcess {
  pub child: Child,
  pub pid: u32,
  pub embedding: EmbeddingController,
}

struct VisibleWindowsSnapshot {
  hwnds: Vec<HWND>,
}

unsafe extern "system" fn collect_visible_windows(hwnd: HWND, lparam: LPARAM) -> BOOL {
  let snapshot = &mut *(lparam.0 as *mut VisibleWindowsSnapshot);
  if IsWindowVisible(hwnd).as_bool() {
    snapshot.hwnds.push(hwnd);
  }
  true.into()
}

fn visible_windows() -> Vec<HWND> {
  let mut snapshot = VisibleWindowsSnapshot { hwnds: Vec::new() };
  unsafe {
    let lparam = LPARAM(&mut snapshot as *mut _ as isize);
    let _ = EnumWindows(Some(collect_visible_windows), lparam);
  }
  snapshot.hwnds
}

fn executable_name_for_hwnd(hwnd: HWND) -> Option<String> {
  unsafe {
    let mut pid = 0;
    GetWindowThreadProcessId(hwnd, Some(&mut pid));
    if pid == 0 {
      return None;
    }

    let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
    let mut path = [0u16; MAX_PATH as usize * 2];
    let mut size = path.len() as u32;
    let success = QueryFullProcessImageNameW(
      handle,
      PROCESS_NAME_FORMAT(0),
      windows::core::PWSTR(path.as_mut_ptr()),
      &mut size,
    );
    let _ = windows::Win32::Foundation::CloseHandle(handle);

    if success.is_ok() && size > 0 {
      let path = String::from_utf16_lossy(&path[..size as usize]);
      let path = std::path::PathBuf::from(path);
      return path
        .file_name()
        .map(|name| name.to_string_lossy().to_string().to_lowercase());
    }

    None
  }
}

pub(crate) unsafe fn suppress_taskbar_icon(hwnd: HWND) {
  let mut ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
  ex_style &= !(WS_EX_APPWINDOW.0 as isize);
  ex_style |= WS_EX_TOOLWINDOW.0 as isize;
  SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex_style);

  let cloaked: u32 = 1;
  let _ = DwmSetWindowAttribute(
    hwnd,
    DWMWINDOWATTRIBUTE(14),
    &cloaked as *const _ as *const _,
    std::mem::size_of::<u32>() as u32,
  );

  if let Ok(taskbar_list) = CoCreateInstance::<_, ITaskbarList3>(
    &TaskbarList,
    None,
    windows::Win32::System::Com::CLSCTX_INPROC_SERVER,
  ) {
    let _ = taskbar_list.HrInit();
    let _ = taskbar_list.DeleteTab(hwnd);
  }

  SHChangeNotify(SHCNE_ASSOCCHANGED, SHCNF_IDLIST, None, None);
}

pub(crate) unsafe fn establish_z_order_sandwich(embedded_hwnd: HWND, host_hwnd: HWND) {
  let _ = SetWindowPos(
    host_hwnd,
    Some(HWND_NOTOPMOST),
    0,
    0,
    0,
    0,
    SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
  );

  let _ = SetWindowPos(
    embedded_hwnd,
    Some(host_hwnd),
    0,
    0,
    0,
    0,
    SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
  );
}

pub(crate) unsafe fn apply_clipping_region(
  hwnd: HWND,
  clip_x: i32,
  clip_y: i32,
  clip_width: i32,
  clip_height: i32,
) -> Result<(), String> {
  let region = CreateRectRgn(clip_x, clip_y, clip_x + clip_width, clip_y + clip_height);
  if region.is_invalid() {
    return Err("Failed to create clipping region".to_string());
  }

  let result = SetWindowRgn(hwnd, Some(region), true);
  if result != 0 {
    Ok(())
  } else {
    let _ = DeleteObject(region.into());
    Err("Failed to apply clipping region".to_string())
  }
}

pub(crate) unsafe fn clear_clipping_region(hwnd: HWND) -> Result<(), String> {
  let result = SetWindowRgn(hwnd, None::<HRGN>, true);
  if result != 0 {
    Ok(())
  } else {
    Err("Failed to clear clipping region".to_string())
  }
}

pub fn launch_and_attach(
  executable_spec: &ExecutableSpec,
  host_hwnd_isize: isize,
) -> Result<AttachedWindowProcess, WindowMgrError> {
  let before_hwnds = visible_windows()
    .into_iter()
    .map(|hwnd| hwnd.0 as isize)
    .collect::<HashSet<_>>();

  let mut command = Command::new(&executable_spec.executable_path);
  if let Some(working_directory) = &executable_spec.working_directory {
    command.current_dir(working_directory);
  }
  command.args(&executable_spec.args);

  let child = command
    .spawn()
    .map_err(|error| WindowMgrError::ExecutableLaunchFailed {
      message: format!(
        "Failed to launch '{}': {error}",
        executable_spec.executable_path
      ),
    })?;

  let pid = child.id();
  let target_executable_name = std::path::PathBuf::from(&executable_spec.executable_path)
    .file_name()
    .map(|name| name.to_string_lossy().to_string().to_lowercase())
    .unwrap_or_else(|| executable_spec.id.to_lowercase());

  let mut attached_hwnd = None;
  for _ in 0..50 {
    sleep(Duration::from_millis(100));

    for hwnd in visible_windows() {
      if before_hwnds.contains(&(hwnd.0 as isize)) {
        continue;
      }

      if let Some(executable_name) = executable_name_for_hwnd(hwnd) {
        if executable_name == target_executable_name {
          attached_hwnd = Some(hwnd);
          break;
        }
      }
    }

    if attached_hwnd.is_some() {
      break;
    }
  }

  let attached_hwnd = attached_hwnd.ok_or_else(|| WindowMgrError::HwndNotFound {
    message: format!(
      "No visible HWND was found for executable '{}' after launch",
      executable_spec.display_name()
    ),
  })?;

  let host_hwnd = HWND(host_hwnd_isize as *mut _);
  let embedding = match DCompWindowEmbedding::new(attached_hwnd, host_hwnd) {
    Ok(embedding) => EmbeddingController::DirectComposition(embedding),
    Err(_) => EmbeddingController::Legacy(
      LegacyWindowEmbedding::new(attached_hwnd, host_hwnd).map_err(|message| {
        WindowMgrError::BackendInitFailed {
          message: format!(
            "Failed to initialize any embedding backend for '{}': {message}",
            executable_spec.display_name()
          ),
        }
      })?,
    ),
  };

  Ok(AttachedWindowProcess {
    child,
    pid,
    embedding,
  })
}
