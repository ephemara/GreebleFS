use super::{clip_rect, WindowEmbeddingBackend};
use crate::types::{EmbeddingBackendKind, ReservedInsets, WindowSurfaceBounds};
use windows::core::IUnknown;
use windows::Win32::Foundation::HWND;
use windows::Win32::Graphics::DirectComposition::{
  DCompositionCreateDevice2, IDCompositionDevice, IDCompositionTarget, IDCompositionVisual,
};
use windows::Win32::UI::WindowsAndMessaging::{
  GetWindowLongPtrW, SetWindowLongPtrW, SetWindowPos, ShowWindow, GWL_EXSTYLE, GWL_STYLE, HWND_TOP,
  SWP_FRAMECHANGED, SWP_NOACTIVATE, SWP_NOSIZE, SWP_NOZORDER, SW_HIDE, SW_SHOW, WS_CAPTION,
  WS_EX_LAYERED, WS_POPUP, WS_THICKFRAME,
};

pub struct DCompWindowEmbedding {
  external_hwnd: HWND,
  _host_hwnd: HWND,
  dcomp_device: IDCompositionDevice,
  _dcomp_target: IDCompositionTarget,
  dcomp_visual: IDCompositionVisual,
  _external_surface: IUnknown,
}

// Tauri managed state requires Send + Sync. Access to embedding controllers is
// serialized through WindowMgrState, and the controller owns only HWND handles
// plus DirectComposition COM interfaces used by that serialized command path.
unsafe impl Send for DCompWindowEmbedding {}
unsafe impl Sync for DCompWindowEmbedding {}

impl DCompWindowEmbedding {
  pub fn new(external_hwnd: HWND, host_hwnd: HWND) -> Result<Self, String> {
    unsafe {
      let dcomp_device: IDCompositionDevice = DCompositionCreateDevice2(None)
        .map_err(|error| format!("Failed to create DirectComposition device: {error}"))?;
      let dcomp_target = dcomp_device
        .CreateTargetForHwnd(host_hwnd, true)
        .map_err(|error| format!("Failed to create DirectComposition target: {error}"))?;
      let dcomp_visual = dcomp_device
        .CreateVisual()
        .map_err(|error| format!("Failed to create DirectComposition visual: {error}"))?;
      let external_surface = dcomp_device
        .CreateSurfaceFromHwnd(external_hwnd)
        .map_err(|error| format!("Failed to create DirectComposition HWND surface: {error}"))?;

      Self::configure_external_window(external_hwnd)?;

      dcomp_visual
        .SetContent(&external_surface)
        .map_err(|error| format!("Failed to set DirectComposition content: {error}"))?;
      dcomp_target
        .SetRoot(&dcomp_visual)
        .map_err(|error| format!("Failed to set DirectComposition root visual: {error}"))?;
      dcomp_device
        .Commit()
        .map_err(|error| format!("Failed to commit DirectComposition device: {error}"))?;

      Ok(Self {
        external_hwnd,
        _host_hwnd: host_hwnd,
        dcomp_device,
        _dcomp_target: dcomp_target,
        dcomp_visual,
        _external_surface: external_surface,
      })
    }
  }

  unsafe fn configure_external_window(hwnd: HWND) -> Result<(), String> {
    let mut style = GetWindowLongPtrW(hwnd, GWL_STYLE);
    style &= !(WS_CAPTION.0 as isize | WS_THICKFRAME.0 as isize);
    style |= WS_POPUP.0 as isize;
    SetWindowLongPtrW(hwnd, GWL_STYLE, style);

    let mut ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
    ex_style |= WS_EX_LAYERED.0 as isize;
    SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex_style);

    let _ = SetWindowPos(
      hwnd,
      Some(HWND_TOP),
      0,
      0,
      0,
      0,
      SWP_NOSIZE | SWP_NOZORDER | SWP_FRAMECHANGED,
    );

    Ok(())
  }

  pub fn hwnd(&self) -> isize {
    self.external_hwnd.0 as isize
  }
}

impl WindowEmbeddingBackend for DCompWindowEmbedding {
  fn kind(&self) -> EmbeddingBackendKind {
    EmbeddingBackendKind::DirectComposition
  }

  fn hwnd(&self) -> isize {
    self.hwnd()
  }

  fn show(&mut self, bounds: WindowSurfaceBounds) -> Result<(), String> {
    self.update_bounds(bounds)?;
    unsafe {
      let _ = ShowWindow(self.external_hwnd, SW_SHOW);
      self
        .dcomp_device
        .Commit()
        .map_err(|error| format!("Failed to commit DirectComposition show: {error}"))?;
    }
    Ok(())
  }

  fn hide(&mut self) -> Result<(), String> {
    unsafe {
      let _ = ShowWindow(self.external_hwnd, SW_HIDE);
      self
        .dcomp_device
        .Commit()
        .map_err(|error| format!("Failed to commit DirectComposition hide: {error}"))?;
    }
    Ok(())
  }

  fn update_bounds(&mut self, bounds: WindowSurfaceBounds) -> Result<(), String> {
    unsafe {
      self
        .dcomp_visual
        .SetOffsetX2(bounds.x as f32)
        .map_err(|error| format!("Failed to set DComp offset X: {error}"))?;
      self
        .dcomp_visual
        .SetOffsetY2(bounds.y as f32)
        .map_err(|error| format!("Failed to set DComp offset Y: {error}"))?;

      let _ = SetWindowPos(
        self.external_hwnd,
        Some(HWND_TOP),
        0,
        0,
        bounds.width,
        bounds.height,
        SWP_NOACTIVATE | SWP_NOZORDER,
      );

      self
        .dcomp_device
        .Commit()
        .map_err(|error| format!("Failed to commit DirectComposition bounds update: {error}"))?;
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
        let clip = self
          .dcomp_device
          .CreateRectangleClip()
          .map_err(|error| format!("Failed to create DComp clip rectangle: {error}"))?;
        clip
          .SetLeft2(x as f32)
          .map_err(|error| format!("Failed to set DComp clip left: {error}"))?;
        clip
          .SetTop2(y as f32)
          .map_err(|error| format!("Failed to set DComp clip top: {error}"))?;
        clip
          .SetRight2((x + width) as f32)
          .map_err(|error| format!("Failed to set DComp clip right: {error}"))?;
        clip
          .SetBottom2((y + height) as f32)
          .map_err(|error| format!("Failed to set DComp clip bottom: {error}"))?;

        self
          .dcomp_visual
          .SetClip(&clip)
          .map_err(|error| format!("Failed to apply DComp clip: {error}"))?;
        self
          .dcomp_device
          .Commit()
          .map_err(|error| format!("Failed to commit DComp clip: {error}"))?;
      }
    }
    Ok(())
  }

  fn clear_clip(&mut self) -> Result<(), String> {
    unsafe {
      self
        .dcomp_visual
        .SetClip(None)
        .map_err(|error| format!("Failed to clear DComp clip: {error}"))?;
      self
        .dcomp_device
        .Commit()
        .map_err(|error| format!("Failed to commit DComp clip clear: {error}"))?;
    }
    Ok(())
  }
}
