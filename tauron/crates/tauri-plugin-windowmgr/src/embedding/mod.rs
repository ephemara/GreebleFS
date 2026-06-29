#[cfg(windows)]
pub mod dcomp;
#[cfg(windows)]
pub mod legacy;

#[cfg(windows)]
use crate::types::{EmbeddingBackendKind, ReservedInsets, WindowSurfaceBounds};

#[cfg(windows)]
pub trait WindowEmbeddingBackend {
  fn kind(&self) -> EmbeddingBackendKind;
  fn hwnd(&self) -> isize;
  fn show(&mut self, bounds: WindowSurfaceBounds) -> Result<(), String>;
  fn hide(&mut self) -> Result<(), String>;
  fn update_bounds(&mut self, bounds: WindowSurfaceBounds) -> Result<(), String>;
  fn set_clip(
    &mut self,
    bounds: WindowSurfaceBounds,
    reserved_insets: ReservedInsets,
  ) -> Result<(), String>;
  fn clear_clip(&mut self) -> Result<(), String>;
}

#[cfg(windows)]
pub enum EmbeddingController {
  DirectComposition(dcomp::DCompWindowEmbedding),
  Legacy(legacy::LegacyWindowEmbedding),
}

unsafe impl Send for EmbeddingController {}
unsafe impl Sync for EmbeddingController {}

#[cfg(windows)]
impl WindowEmbeddingBackend for EmbeddingController {
  fn kind(&self) -> EmbeddingBackendKind {
    match self {
      Self::DirectComposition(_) => EmbeddingBackendKind::DirectComposition,
      Self::Legacy(_) => EmbeddingBackendKind::LegacyOwnedWindow,
    }
  }

  fn hwnd(&self) -> isize {
    match self {
      Self::DirectComposition(embedding) => embedding.hwnd(),
      Self::Legacy(embedding) => embedding.hwnd(),
    }
  }

  fn show(&mut self, bounds: WindowSurfaceBounds) -> Result<(), String> {
    match self {
      Self::DirectComposition(embedding) => embedding.show(bounds),
      Self::Legacy(embedding) => embedding.show(bounds),
    }
  }

  fn hide(&mut self) -> Result<(), String> {
    match self {
      Self::DirectComposition(embedding) => embedding.hide(),
      Self::Legacy(embedding) => embedding.hide(),
    }
  }

  fn update_bounds(&mut self, bounds: WindowSurfaceBounds) -> Result<(), String> {
    match self {
      Self::DirectComposition(embedding) => embedding.update_bounds(bounds),
      Self::Legacy(embedding) => embedding.update_bounds(bounds),
    }
  }

  fn set_clip(
    &mut self,
    bounds: WindowSurfaceBounds,
    reserved_insets: ReservedInsets,
  ) -> Result<(), String> {
    match self {
      Self::DirectComposition(embedding) => embedding.set_clip(bounds, reserved_insets),
      Self::Legacy(embedding) => embedding.set_clip(bounds, reserved_insets),
    }
  }

  fn clear_clip(&mut self) -> Result<(), String> {
    match self {
      Self::DirectComposition(embedding) => embedding.clear_clip(),
      Self::Legacy(embedding) => embedding.clear_clip(),
    }
  }
}

#[cfg(windows)]
pub fn clip_rect(
  bounds: WindowSurfaceBounds,
  reserved_insets: ReservedInsets,
) -> Option<(i32, i32, i32, i32)> {
  let clip_x = reserved_insets.left.max(0);
  let clip_y = reserved_insets.top.max(0);
  let clip_width = (bounds.width - reserved_insets.left - reserved_insets.right).max(0);
  let clip_height = (bounds.height - reserved_insets.top - reserved_insets.bottom).max(0);

  if clip_width == 0 || clip_height == 0 {
    None
  } else {
    Some((clip_x, clip_y, clip_width, clip_height))
  }
}
