use super::{clip_rect, WindowEmbeddingBackend};
use crate::platform::windows::{
  apply_clipping_region, clear_clipping_region, establish_z_order_sandwich, suppress_taskbar_icon,
};
use crate::types::{EmbeddingBackendKind, ReservedInsets, WindowSurfaceBounds};
use windows::Win32::Foundation::HWND;
use windows::Win32::UI::WindowsAndMessaging::{
  GetWindowLongPtrW, SetWindowLongPtrW, SetWindowPos, ShowWindow, GWLP_HWNDPARENT, GWL_STYLE,
  SWP_FRAMECHANGED, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_SHOWWINDOW, SW_HIDE, SW_SHOW,
  WS_CAPTION, WS_POPUP, WS_THICKFRAME,
};

pub struct LegacyWindowEmbedding {
  hwnd: HWND,
  host_hwnd: HWND,
}

unsafe impl Send for LegacyWindowEmbedding {}
unsafe impl Sync for LegacyWindowEmbedding {}

impl LegacyWindowEmbedding {
  pub fn new(hwnd: HWND, host_hwnd: HWND) -> Result<Self, String> {
    unsafe {
      let mut style = GetWindowLongPtrW(hwnd, GWL_STYLE);
      style &= !(WS_CAPTION.0 as isize | WS_THICKFRAME.0 as isize);
      style |= WS_POPUP.0 as isize;
      SetWindowLongPtrW(hwnd, GWL_STYLE, style);

      suppress_taskbar_icon(hwnd);
      SetWindowLongPtrW(hwnd, GWLP_HWNDPARENT, host_hwnd.0 as isize);
      establish_z_order_sandwich(hwnd, host_hwnd);

      let _ = SetWindowPos(
        hwnd,
        Some(host_hwnd),
        0,
        0,
        0,
        0,
        SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_FRAMECHANGED | SWP_SHOWWINDOW,
      );
      let _ = ShowWindow(hwnd, SW_HIDE);
    }

    Ok(Self { hwnd, host_hwnd })
  }

  pub fn hwnd(&self) -> isize {
    self.hwnd.0 as isize
  }
}

impl WindowEmbeddingBackend for LegacyWindowEmbedding {
  fn kind(&self) -> EmbeddingBackendKind {
    EmbeddingBackendKind::LegacyOwnedWindow
  }

  fn hwnd(&self) -> isize {
    self.hwnd()
  }

  fn show(&mut self, bounds: WindowSurfaceBounds) -> Result<(), String> {
    self.update_bounds(bounds)?;
    unsafe {
      establish_z_order_sandwich(self.hwnd, self.host_hwnd);
      let _ = ShowWindow(self.hwnd, SW_SHOW);
    }
    Ok(())
  }

  fn hide(&mut self) -> Result<(), String> {
    unsafe {
      let _ = ShowWindow(self.hwnd, SW_HIDE);
    }
    Ok(())
  }

  fn update_bounds(&mut self, bounds: WindowSurfaceBounds) -> Result<(), String> {
    unsafe {
      establish_z_order_sandwich(self.hwnd, self.host_hwnd);
      let _ = SetWindowPos(
        self.hwnd,
        Some(self.host_hwnd),
        bounds.x,
        bounds.y,
        bounds.width,
        bounds.height,
        SWP_NOACTIVATE | SWP_SHOWWINDOW,
      );
    }
    Ok(())
  }

  fn set_clip(
    &mut self,
    bounds: WindowSurfaceBounds,
    reserved_insets: ReservedInsets,
  ) -> Result<(), String> {
    if let Some((x, y, width, height)) = clip_rect(bounds, reserved_insets) {
      unsafe {
        apply_clipping_region(self.hwnd, x, y, width, height)?;
      }
    }
    Ok(())
  }

  fn clear_clip(&mut self) -> Result<(), String> {
    unsafe {
      clear_clipping_region(self.hwnd)?;
    }
    Ok(())
  }
}
