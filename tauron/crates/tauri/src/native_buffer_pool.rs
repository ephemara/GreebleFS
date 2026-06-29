//! WebView2 shared-buffer pool ownership for native byte lanes.
#![allow(missing_docs)]

use std::{
  collections::HashMap,
  sync::{
    atomic::{AtomicU64, Ordering},
    Condvar, Mutex,
  },
  time::{Duration, Instant},
};

use serde::{Deserialize, Serialize};

use crate::{
  native_control::{self, NativeControlRequest},
  AppHandle, Manager, Runtime, Webview,
};

#[cfg(all(windows, feature = "wry"))]
use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2SharedBuffer;

const MIN_SIZE_CLASS: usize = 4 * 1024;
const MAX_SIZE_CLASS: usize = 4 * 1024 * 1024;
const DEFAULT_MAX_BUFFERS_PER_SIZE_CLASS: usize = 16;
const BUFFER_LEASE_WAIT_TIMEOUT: Duration = Duration::from_secs(5);
const STALE_POSTED_BUFFER_RECLAIM_AFTER: Duration = Duration::from_secs(90);
static NEXT_BUFFER_ID: AtomicU64 = AtomicU64::new(1);

#[cfg(all(windows, feature = "wry"))]
struct PlatformSharedBuffer {
  shared_buffer: ICoreWebView2SharedBuffer,
  raw_buffer: usize,
}

#[cfg(all(windows, feature = "wry"))]
unsafe impl Send for PlatformSharedBuffer {}

#[cfg(all(windows, feature = "wry"))]
unsafe impl Sync for PlatformSharedBuffer {}

#[cfg(all(windows, feature = "wry"))]
impl Drop for PlatformSharedBuffer {
  fn drop(&mut self) {
    unsafe {
      let _ = self.shared_buffer.Close();
    }
  }
}

#[cfg(all(windows, feature = "wry"))]
struct PlatformSharedBufferView {
  shared_buffer: ICoreWebView2SharedBuffer,
  raw_buffer: usize,
}

#[cfg(all(windows, feature = "wry"))]
unsafe impl Send for PlatformSharedBufferView {}

#[cfg(all(windows, feature = "wry"))]
unsafe impl Sync for PlatformSharedBufferView {}

#[cfg(all(windows, feature = "wry"))]
impl PlatformSharedBuffer {
  fn view(&self) -> PlatformSharedBufferView {
    PlatformSharedBufferView {
      shared_buffer: self.shared_buffer.clone(),
      raw_buffer: self.raw_buffer,
    }
  }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum NativeBufferPoolBufferState {
  Free,
  LeasedNative,
  PostedToJs,
  JsReleased,
  Reclaimed,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeBufferPoolIdentity {
  pub id: u64,
  pub generation: u64,
  pub size_class: usize,
  pub byte_length: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeBufferPoolReleaseArgs {
  pub id: u64,
  pub generation: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeBufferPoolReleaseBatchArgs {
  pub buffers: Vec<NativeBufferPoolReleaseArgs>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeBufferPoolReleaseBatchResult {
  pub released: u64,
  pub errors: Vec<String>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeBufferPoolTelemetry {
  pub buffers: usize,
  pub free: usize,
  pub leased_native: usize,
  pub posted_to_js: usize,
  pub js_released: usize,
  pub reclaimed: usize,
  pub in_flight: usize,
  pub max_in_flight: usize,
  pub allocation_count: u64,
  pub reuse_count: u64,
  pub wait_count: u64,
  pub release_count: u64,
  pub release_batch_count: u64,
  pub generation_mismatch_count: u64,
}

struct NativeBufferPoolRecord {
  identity: NativeBufferPoolIdentity,
  webview_label: String,
  state: NativeBufferPoolBufferState,
  state_changed_at: Instant,
  #[cfg(all(windows, feature = "wry"))]
  platform: Option<PlatformSharedBuffer>,
}

#[derive(Default)]
struct NativeBufferPoolCounters {
  allocation_count: u64,
  reuse_count: u64,
  wait_count: u64,
  release_count: u64,
  release_batch_count: u64,
  generation_mismatch_count: u64,
  max_in_flight: usize,
}

#[derive(Default)]
struct NativeBufferPoolInner {
  buffers: HashMap<u64, NativeBufferPoolRecord>,
  counters: NativeBufferPoolCounters,
}

#[derive(Default)]
pub struct NativeBufferPoolState {
  inner: Mutex<NativeBufferPoolInner>,
  available: Condvar,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NativeBufferPoolLease {
  pub identity: NativeBufferPoolIdentity,
  pub reused: bool,
}

impl NativeBufferPoolState {
  pub fn lease(
    &self,
    webview_label: &str,
    byte_length: usize,
  ) -> Result<NativeBufferPoolLease, String> {
    self.lease_with_limit(
      webview_label,
      byte_length,
      DEFAULT_MAX_BUFFERS_PER_SIZE_CLASS,
    )
  }

  pub fn lease_with_limit(
    &self,
    webview_label: &str,
    byte_length: usize,
    max_buffers_per_size_class: usize,
  ) -> Result<NativeBufferPoolLease, String> {
    let size_class = size_class_for(byte_length)?;
    let max_buffers_per_size_class = max_buffers_per_size_class.max(1);
    let wait_started_at = Instant::now();
    let mut inner = self
      .inner
      .lock()
      .map_err(|_| "native buffer pool lock poisoned".to_string())?;

    loop {
      reclaim_stale_posted_locked(
        &mut inner,
        webview_label,
        size_class,
        STALE_POSTED_BUFFER_RECLAIM_AFTER,
      );

      if let Some(record) = inner.buffers.values_mut().find(|record| {
        record.webview_label == webview_label
          && record.identity.size_class == size_class
          && matches!(
            record.state,
            NativeBufferPoolBufferState::Free | NativeBufferPoolBufferState::Reclaimed
          )
      }) {
        record.identity.generation = record.identity.generation.saturating_add(1);
        record.identity.byte_length = byte_length;
        record.state = NativeBufferPoolBufferState::LeasedNative;
        record.state_changed_at = Instant::now();
        let identity = record.identity.clone();
        inner.counters.reuse_count = inner.counters.reuse_count.saturating_add(1);
        update_max_in_flight(&mut inner);
        return Ok(NativeBufferPoolLease {
          identity,
          reused: true,
        });
      }

      let class_count = inner
        .buffers
        .values()
        .filter(|record| {
          record.webview_label == webview_label && record.identity.size_class == size_class
        })
        .count();
      if class_count < max_buffers_per_size_class {
        let identity = NativeBufferPoolIdentity {
          id: NEXT_BUFFER_ID.fetch_add(1, Ordering::Relaxed),
          generation: 0,
          size_class,
          byte_length,
        };
        inner.buffers.insert(
          identity.id,
          NativeBufferPoolRecord {
            identity: identity.clone(),
            webview_label: webview_label.to_string(),
            state: NativeBufferPoolBufferState::LeasedNative,
            state_changed_at: Instant::now(),
            #[cfg(all(windows, feature = "wry"))]
            platform: None,
          },
        );
        update_max_in_flight(&mut inner);
        return Ok(NativeBufferPoolLease {
          identity,
          reused: false,
        });
      }

      inner.counters.wait_count = inner.counters.wait_count.saturating_add(1);
      if wait_started_at.elapsed() >= BUFFER_LEASE_WAIT_TIMEOUT {
        return Err(format!(
          "timed out waiting for native buffer pool slot for webview '{webview_label}' size class {size_class}"
        ));
      }
      let (next_inner, wait_result) = self
        .available
        .wait_timeout(inner, Duration::from_millis(2))
        .map_err(|_| "native buffer pool lock poisoned while waiting".to_string())?;
      inner = next_inner;
      if wait_result.timed_out() && wait_started_at.elapsed() >= BUFFER_LEASE_WAIT_TIMEOUT {
        return Err(format!(
          "timed out waiting for native buffer pool slot for webview '{webview_label}' size class {size_class}"
        ));
      }
    }
  }

  pub fn mark_posted_to_js(&self, identity: &NativeBufferPoolIdentity) -> Result<(), String> {
    self.transition(
      identity.id,
      identity.generation,
      NativeBufferPoolBufferState::LeasedNative,
      NativeBufferPoolBufferState::PostedToJs,
    )
  }

  pub fn reclaim_after_post_failure(
    &self,
    identity: &NativeBufferPoolIdentity,
  ) -> Result<(), String> {
    let result = self.transition(
      identity.id,
      identity.generation,
      NativeBufferPoolBufferState::PostedToJs,
      NativeBufferPoolBufferState::Free,
    );
    self.available.notify_all();
    result
  }

  pub fn release_from_js(&self, id: u64, generation: u64) -> Result<(), String> {
    let result = self.release_many_from_js(&[NativeBufferPoolReleaseArgs { id, generation }])?;
    if result.errors.is_empty() {
      Ok(())
    } else {
      Err(result.errors.join("; "))
    }
  }

  pub fn release_many_from_js(
    &self,
    releases: &[NativeBufferPoolReleaseArgs],
  ) -> Result<NativeBufferPoolReleaseBatchResult, String> {
    let mut result = NativeBufferPoolReleaseBatchResult::default();
    let mut inner = self
      .inner
      .lock()
      .map_err(|_| "native buffer pool lock poisoned".to_string())?;

    if releases.len() > 1 {
      inner.counters.release_batch_count = inner.counters.release_batch_count.saturating_add(1);
    }

    for release in releases {
      match release_one_locked(&mut inner, release.id, release.generation) {
        Ok(()) => {
          result.released = result.released.saturating_add(1);
        }
        Err(error) => result.errors.push(error),
      }
    }
    update_max_in_flight(&mut inner);
    drop(inner);
    if result.released > 0 {
      self.available.notify_all();
    }
    Ok(result)
  }

  pub fn telemetry(&self) -> NativeBufferPoolTelemetry {
    let mut telemetry = NativeBufferPoolTelemetry::default();
    if let Ok(inner) = self.inner.lock() {
      telemetry.buffers = inner.buffers.len();
      for record in inner.buffers.values() {
        match record.state {
          NativeBufferPoolBufferState::Free => telemetry.free += 1,
          NativeBufferPoolBufferState::LeasedNative => telemetry.leased_native += 1,
          NativeBufferPoolBufferState::PostedToJs => telemetry.posted_to_js += 1,
          NativeBufferPoolBufferState::JsReleased => telemetry.js_released += 1,
          NativeBufferPoolBufferState::Reclaimed => telemetry.reclaimed += 1,
        }
      }
      telemetry.in_flight = telemetry.leased_native + telemetry.posted_to_js;
      telemetry.max_in_flight = inner.counters.max_in_flight;
      telemetry.allocation_count = inner.counters.allocation_count;
      telemetry.reuse_count = inner.counters.reuse_count;
      telemetry.wait_count = inner.counters.wait_count;
      telemetry.release_count = inner.counters.release_count;
      telemetry.release_batch_count = inner.counters.release_batch_count;
      telemetry.generation_mismatch_count = inner.counters.generation_mismatch_count;
    }
    telemetry
  }

  fn transition(
    &self,
    id: u64,
    generation: u64,
    expected: NativeBufferPoolBufferState,
    next: NativeBufferPoolBufferState,
  ) -> Result<(), String> {
    let mut inner = self
      .inner
      .lock()
      .map_err(|_| "native buffer pool lock poisoned".to_string())?;
    let record = inner
      .buffers
      .get_mut(&id)
      .ok_or_else(|| format!("native buffer pool id not found: {id}"))?;
    if record.identity.generation != generation {
      return Err(format!(
        "native buffer pool generation mismatch for id {id}: expected {}, got {generation}",
        record.identity.generation
      ));
    }
    if record.state != expected {
      return Err(format!(
        "native buffer pool buffer {id} expected state {:?}, found {:?}",
        expected, record.state
      ));
    }
    record.state = next;
    record.state_changed_at = Instant::now();
    update_max_in_flight(&mut inner);
    Ok(())
  }

  #[cfg(all(windows, feature = "wry"))]
  fn platform_view(
    &self,
    identity: &NativeBufferPoolIdentity,
  ) -> Result<Option<PlatformSharedBufferView>, String> {
    let mut inner = self
      .inner
      .lock()
      .map_err(|_| "native buffer pool lock poisoned".to_string())?;
    let record = inner
      .buffers
      .get_mut(&identity.id)
      .ok_or_else(|| format!("native buffer pool id not found: {}", identity.id))?;
    if record.identity.generation != identity.generation {
      return Err(format!(
        "native buffer pool generation mismatch for id {}: expected {}, got {}",
        identity.id, record.identity.generation, identity.generation
      ));
    }
    Ok(record.platform.as_ref().map(PlatformSharedBuffer::view))
  }

  #[cfg(all(windows, feature = "wry"))]
  fn install_platform_allocation(
    &self,
    identity: &NativeBufferPoolIdentity,
    allocation: PlatformSharedBuffer,
  ) -> Result<(), String> {
    let mut inner = self
      .inner
      .lock()
      .map_err(|_| "native buffer pool lock poisoned".to_string())?;
    let record = inner
      .buffers
      .get_mut(&identity.id)
      .ok_or_else(|| format!("native buffer pool id not found: {}", identity.id))?;
    if record.identity.generation != identity.generation {
      return Err(format!(
        "native buffer pool generation mismatch for id {}: expected {}, got {}",
        identity.id, record.identity.generation, identity.generation
      ));
    }
    if record.platform.is_none() {
      record.platform = Some(allocation);
      inner.counters.allocation_count = inner.counters.allocation_count.saturating_add(1);
    }
    Ok(())
  }
}

fn release_one_locked(
  inner: &mut NativeBufferPoolInner,
  id: u64,
  generation: u64,
) -> Result<(), String> {
  let record = inner
    .buffers
    .get_mut(&id)
    .ok_or_else(|| format!("native buffer pool id not found: {id}"))?;
  if record.identity.generation != generation {
    inner.counters.generation_mismatch_count =
      inner.counters.generation_mismatch_count.saturating_add(1);
    return Err(format!(
      "native buffer pool generation mismatch for id {id}: expected {}, got {generation}",
      record.identity.generation
    ));
  }
  if record.state != NativeBufferPoolBufferState::PostedToJs {
    return Err(format!(
      "native buffer pool buffer {id} cannot be released from state {:?}",
      record.state
    ));
  }
  record.state = NativeBufferPoolBufferState::JsReleased;
  record.state = NativeBufferPoolBufferState::Reclaimed;
  record.state = NativeBufferPoolBufferState::Free;
  record.state_changed_at = Instant::now();
  inner.counters.release_count = inner.counters.release_count.saturating_add(1);
  Ok(())
}

fn reclaim_stale_posted_locked(
  inner: &mut NativeBufferPoolInner,
  webview_label: &str,
  size_class: usize,
  stale_after: Duration,
) -> usize {
  if stale_after.is_zero() {
    return 0;
  }

  let now = Instant::now();
  let mut reclaimed = 0;
  for record in inner.buffers.values_mut() {
    if record.webview_label == webview_label
      && record.identity.size_class == size_class
      && record.state == NativeBufferPoolBufferState::PostedToJs
      && now.saturating_duration_since(record.state_changed_at) >= stale_after
    {
      record.state = NativeBufferPoolBufferState::Free;
      record.state_changed_at = now;
      reclaimed += 1;
    }
  }
  if reclaimed > 0 {
    update_max_in_flight(inner);
  }
  reclaimed
}

fn update_max_in_flight(inner: &mut NativeBufferPoolInner) {
  let in_flight = inner
    .buffers
    .values()
    .filter(|record| {
      matches!(
        record.state,
        NativeBufferPoolBufferState::LeasedNative | NativeBufferPoolBufferState::PostedToJs
      )
    })
    .count();
  inner.counters.max_in_flight = inner.counters.max_in_flight.max(in_flight);
}

pub fn size_class_for(byte_length: usize) -> Result<usize, String> {
  if byte_length > MAX_SIZE_CLASS {
    return Err(format!(
      "native buffer pool payload {byte_length} exceeds max size class {MAX_SIZE_CLASS}"
    ));
  }
  let requested = byte_length.max(MIN_SIZE_CLASS);
  Ok(requested.next_power_of_two().min(MAX_SIZE_CLASS))
}

pub fn register_native_control_handlers<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
  if app.try_state::<NativeBufferPoolState>().is_none() {
    let _ = app.manage(NativeBufferPoolState::default());
  }

  let app_for_release = app.clone();
  native_control::register_handler(
    app,
    "nativeBufferPool",
    "release",
    move |request: NativeControlRequest| {
      let args = serde_json::from_value::<NativeBufferPoolReleaseArgs>(request.args)
        .map_err(|error| format!("failed to parse native buffer pool release args: {error}"))?;
      let state = app_for_release.state::<NativeBufferPoolState>();
      state.release_from_js(args.id, args.generation)?;
      serde_json::to_value(serde_json::json!({ "ok": true }))
        .map_err(|error| format!("failed to serialize native buffer pool release: {error}"))
    },
  )?;

  let app_for_release_batch = app.clone();
  native_control::register_handler(
    app,
    "nativeBufferPool",
    "releaseBatch",
    move |request: NativeControlRequest| {
      let args = serde_json::from_value::<NativeBufferPoolReleaseBatchArgs>(request.args).map_err(
        |error| format!("failed to parse native buffer pool release batch args: {error}"),
      )?;
      let state = app_for_release_batch.state::<NativeBufferPoolState>();
      serde_json::to_value(state.release_many_from_js(&args.buffers)?)
        .map_err(|error| format!("failed to serialize native buffer pool release batch: {error}"))
    },
  )?;

  let app_for_telemetry = app.clone();
  native_control::register_handler(
    app,
    "nativeBufferPool",
    "telemetry",
    move |_request: NativeControlRequest| {
      let state = app_for_telemetry.state::<NativeBufferPoolState>();
      serde_json::to_value(state.telemetry())
        .map_err(|error| format!("failed to serialize native buffer pool telemetry: {error}"))
    },
  )
}

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeBufferPoolPostMetrics {
  pub allocation_count: u64,
  pub reuse_count: u64,
  pub copy_count: u64,
  pub copied_bytes: u64,
  pub webview_post_time_us: u64,
}

#[cfg(all(windows, feature = "wry"))]
pub fn post_pooled_packet_to_webview<R: Runtime>(
  webview: &Webview<R>,
  state: &NativeBufferPoolState,
  webview_label: &str,
  stream_id: &str,
  sequence: u64,
  bytes: &[u8],
) -> Result<NativeBufferPoolPostMetrics, String> {
  use std::sync::mpsc;

  use webview2_com::Microsoft::Web::WebView2::Win32::{
    ICoreWebView2Environment12, ICoreWebView2_17, COREWEBVIEW2_SHARED_BUFFER_ACCESS_READ_ONLY,
  };
  use windows::core::{Interface, PCWSTR};

  let lease = state.lease(webview_label, bytes.len())?;
  let identity = lease.identity;
  let existing_platform_buffer = state.platform_view(&identity)?;
  let post_started_at = Instant::now();
  let bytes = bytes.to_vec();
  let byte_length = bytes.len() as u64;
  let additional_data = serde_json::to_string(&serde_json::json!({
    "tauronNativePooledBuffer": true,
    "streamId": stream_id,
    "sequence": sequence,
    "byteLength": identity.byte_length,
    "buffer": identity,
  }))
  .map_err(|error| format!("failed to serialize native pooled buffer metadata: {error}"))?;
  let additional_data_wide = additional_data
    .encode_utf16()
    .chain(std::iter::once(0))
    .collect::<Vec<_>>();
  let (tx, rx) = mpsc::channel();
  if let Err(error) = state.mark_posted_to_js(&identity) {
    let _ = state.reclaim_after_post_failure(&identity);
    return Err(error);
  }
  webview
    .with_webview(move |platform_webview| {
      let result = unsafe {
        let environment12 = match platform_webview
          .environment()
          .cast::<ICoreWebView2Environment12>()
        {
          Ok(environment12) => environment12,
          Err(error) => {
            let _ = tx.send(Err(format!(
              "WebView2 shared buffers are unavailable: {error}"
            )));
            return;
          }
        };
        let webview17 = match platform_webview
          .controller()
          .CoreWebView2()
          .and_then(|webview2| webview2.cast::<ICoreWebView2_17>())
        {
          Ok(webview17) => webview17,
          Err(error) => {
            let _ = tx.send(Err(format!(
              "WebView2 shared-buffer posting is unavailable: {error}"
            )));
            return;
          }
        };
        let mut new_allocation = None;
        let platform_buffer = if let Some(platform_buffer) = existing_platform_buffer {
          platform_buffer
        } else {
          let shared_buffer = match environment12.CreateSharedBuffer(identity.size_class as u64) {
            Ok(shared_buffer) => shared_buffer,
            Err(error) => {
              let _ = tx.send(Err(format!(
                "failed to allocate pooled WebView2 shared buffer: {error}"
              )));
              return;
            }
          };
          let mut raw_buffer = std::ptr::null_mut();
          if let Err(error) = shared_buffer.Buffer(&mut raw_buffer) {
            let _ = shared_buffer.Close();
            let _ = tx.send(Err(format!(
              "failed to access pooled WebView2 shared buffer: {error}"
            )));
            return;
          }
          let allocation = PlatformSharedBuffer {
            shared_buffer,
            raw_buffer: raw_buffer as usize,
          };
          let view = allocation.view();
          new_allocation = Some(allocation);
          view
        };
        std::ptr::copy_nonoverlapping(
          bytes.as_ptr(),
          platform_buffer.raw_buffer as *mut u8,
          bytes.len(),
        );
        match webview17.PostSharedBufferToScript(
          &platform_buffer.shared_buffer,
          COREWEBVIEW2_SHARED_BUFFER_ACCESS_READ_ONLY,
          PCWSTR(additional_data_wide.as_ptr()),
        ) {
          Ok(()) => Ok(new_allocation),
          Err(error) => Err(format!(
            "failed to post pooled WebView2 shared buffer: {error}"
          )),
        }
      };
      let _ = tx.send(result);
    })
    .map_err(|error| {
      let _ = state.reclaim_after_post_failure(&identity);
      format!("failed to schedule pooled WebView2 shared-buffer post: {error}")
    })?;

  let new_allocation = rx
    .recv_timeout(Duration::from_secs(1))
    .map_err(|_| "timed out posting pooled WebView2 shared buffer".to_string())?;
  let allocated = match new_allocation {
    Ok(Some(allocation)) => {
      if let Err(error) = state.install_platform_allocation(&identity, allocation) {
        let _ = state.reclaim_after_post_failure(&identity);
        return Err(error);
      }
      true
    }
    Ok(None) => false,
    Err(error) => {
      let _ = state.reclaim_after_post_failure(&identity);
      return Err(error);
    }
  };

  Ok(NativeBufferPoolPostMetrics {
    allocation_count: u64::from(allocated),
    reuse_count: u64::from(lease.reused),
    copy_count: 2,
    copied_bytes: byte_length.saturating_mul(2),
    webview_post_time_us: post_started_at.elapsed().as_micros() as u64,
  })
}

#[cfg(not(all(windows, feature = "wry")))]
pub fn post_pooled_packet_to_webview<R: Runtime>(
  _webview: &Webview<R>,
  _state: &NativeBufferPoolState,
  _webview_label: &str,
  _stream_id: &str,
  _sequence: u64,
  _bytes: &[u8],
) -> Result<NativeBufferPoolPostMetrics, String> {
  Err("native buffer pool requires Windows WebView2".to_string())
}

#[cfg(test)]
mod tests {
  use super::{size_class_for, NativeBufferPoolReleaseArgs, NativeBufferPoolState};
  use std::time::{Duration, Instant};

  #[test]
  fn size_class_uses_next_power_of_two_with_floor() {
    assert_eq!(size_class_for(1).expect("size class"), 4 * 1024);
    assert_eq!(size_class_for(4097).expect("size class"), 8 * 1024);
  }

  #[test]
  fn pool_state_transitions_release_to_free() {
    let state = NativeBufferPoolState::default();
    let lease = state.lease("main", 1024).expect("lease");
    state.mark_posted_to_js(&lease.identity).expect("posted");
    state
      .release_from_js(lease.identity.id, lease.identity.generation)
      .expect("release");
    let telemetry = state.telemetry();
    assert_eq!(telemetry.buffers, 1);
    assert_eq!(telemetry.free, 1);
    assert_eq!(telemetry.release_count, 1);
  }

  #[test]
  fn pool_rejects_generation_mismatch() {
    let state = NativeBufferPoolState::default();
    let lease = state.lease("main", 1024).expect("lease");
    state.mark_posted_to_js(&lease.identity).expect("posted");
    let error = state
      .release_from_js(lease.identity.id, lease.identity.generation + 1)
      .expect_err("generation mismatch");
    assert!(error.contains("generation mismatch"));
    assert_eq!(state.telemetry().generation_mismatch_count, 1);
  }

  #[test]
  fn pool_reuses_released_buffer_identity_with_new_generation() {
    let state = NativeBufferPoolState::default();
    let first = state.lease("main", 1024).expect("lease");
    state.mark_posted_to_js(&first.identity).expect("posted");
    state
      .release_from_js(first.identity.id, first.identity.generation)
      .expect("release");

    let second = state.lease("main", 1024).expect("reuse");
    assert!(second.reused);
    assert_eq!(second.identity.id, first.identity.id);
    assert_eq!(
      second.identity.generation,
      first.identity.generation.saturating_add(1)
    );
    assert_eq!(state.telemetry().reuse_count, 1);
  }

  #[test]
  fn pool_reclaims_stale_posted_buffer_before_waiting_for_a_slot() {
    let state = NativeBufferPoolState::default();
    let first = state
      .lease_with_limit("main", 1024, 1)
      .expect("initial lease");
    state.mark_posted_to_js(&first.identity).expect("posted");

    {
      let mut inner = state.inner.lock().expect("pool lock");
      let record = inner
        .buffers
        .get_mut(&first.identity.id)
        .expect("buffer record");
      record.state_changed_at = Instant::now() - Duration::from_secs(30);
    }

    let second = state
      .lease_with_limit("main", 1024, 1)
      .expect("stale posted buffer should be reclaimed for reuse");
    assert!(second.reused);
    assert_eq!(second.identity.id, first.identity.id);
    assert_eq!(
      second.identity.generation,
      first.identity.generation.saturating_add(1)
    );
  }

  #[test]
  fn pool_batch_release_collects_errors_without_losing_good_releases() {
    let state = NativeBufferPoolState::default();
    let first = state.lease("main", 1024).expect("first");
    let second = state.lease("main", 2048).expect("second");
    state
      .mark_posted_to_js(&first.identity)
      .expect("first posted");
    state
      .mark_posted_to_js(&second.identity)
      .expect("second posted");

    let result = state
      .release_many_from_js(&[
        NativeBufferPoolReleaseArgs {
          id: first.identity.id,
          generation: first.identity.generation,
        },
        NativeBufferPoolReleaseArgs {
          id: second.identity.id,
          generation: second.identity.generation + 1,
        },
      ])
      .expect("batch release");

    assert_eq!(result.released, 1);
    assert_eq!(result.errors.len(), 1);
    let telemetry = state.telemetry();
    assert_eq!(telemetry.release_batch_count, 1);
    assert_eq!(telemetry.generation_mismatch_count, 1);
  }
}
