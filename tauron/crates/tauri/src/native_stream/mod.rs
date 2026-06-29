use std::{
  collections::HashMap,
  sync::{
    atomic::{AtomicU64, Ordering},
    Mutex,
  },
  time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};

use crate::{
  native_control::{self, NativeControlRequest},
  plugin::{Builder as PluginBuilder, TauriPlugin},
  AppHandle, Manager, Runtime, State, Webview,
};

pub const NATIVE_STREAM_PLUGIN_NAME: &str = "native-stream";

const DEFAULT_FLUSH_BYTES: usize = 16 * 1024;
static NEXT_NATIVE_STREAM_ID: AtomicU64 = AtomicU64::new(1);

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase", default)]
pub struct NativeByteStreamHandle {
  pub id: String,
  pub kind: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct NativeByteStreamPacketMetadata {
  pub stream_id: String,
  pub sequence: u64,
  pub emitted_at_epoch_ms: u64,
  pub byte_length: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct NativeByteStreamSubscriptionHandle {
  pub id: String,
  pub stream_id: String,
  pub webview_label: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct NativeByteStreamDroppedRange {
  pub stream_id: String,
  pub start_sequence: u64,
  pub end_sequence: u64,
  pub bytes: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase", default)]
pub struct NativeByteStreamTelemetry {
  pub streams: usize,
  pub subscriptions: usize,
  pub packets: u64,
  pub bytes: u64,
  pub average_batch_size: u64,
  pub post_failures: u64,
  pub unavailable_subscriptions: u64,
  pub dropped_bytes: u64,
  pub dropped_ranges: Vec<NativeByteStreamDroppedRange>,
  pub max_queue_depth: usize,
  pub allocation_count: u64,
  pub copy_count: u64,
  pub copied_bytes: u64,
  pub native_enqueue_time_total_us: u64,
  pub native_enqueue_time_max_us: u64,
  pub webview_post_time_total_us: u64,
  pub webview_post_time_max_us: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NativeByteStreamPublishOutcome {
  pub flushed: bool,
  pub pending_bytes: usize,
}

#[derive(Debug, Clone)]
struct NativeByteStreamSubscriber {
  webview_label: String,
}

#[derive(Debug, Clone)]
struct NativeByteStreamRecord {
  handle: NativeByteStreamHandle,
  next_sequence: u64,
  pending: Vec<u8>,
  flush_scheduled: bool,
  subscribers: HashMap<String, NativeByteStreamSubscriber>,
}

#[derive(Debug, Clone)]
struct NativeByteStreamDelivery {
  metadata: NativeByteStreamPacketMetadata,
  bytes: Vec<u8>,
  subscribers: Vec<NativeByteStreamSubscriber>,
}

#[derive(Default)]
struct NativeByteStreamCounters {
  packets: u64,
  bytes: u64,
  post_failures: u64,
  unavailable_subscriptions: u64,
  dropped_bytes: u64,
  dropped_ranges: Vec<NativeByteStreamDroppedRange>,
  max_queue_depth: usize,
  allocation_count: u64,
  copy_count: u64,
  copied_bytes: u64,
  native_enqueue_time_total_us: u64,
  native_enqueue_time_max_us: u64,
  webview_post_time_total_us: u64,
  webview_post_time_max_us: u64,
}

#[derive(Debug, Clone)]
enum NativeByteStreamTakeOutcome {
  Delivery(NativeByteStreamDelivery),
  Dropped(NativeByteStreamDroppedRange),
}

#[derive(Debug, Clone, Copy, Default)]
struct NativeByteStreamPostMetrics {
  allocation_count: u64,
  copy_count: u64,
  copied_bytes: u64,
  post_time_us: u64,
}

pub struct NativeByteStreamState {
  streams: Mutex<HashMap<String, NativeByteStreamRecord>>,
  counters: Mutex<NativeByteStreamCounters>,
}

impl Default for NativeByteStreamState {
  fn default() -> Self {
    Self {
      streams: Mutex::new(HashMap::new()),
      counters: Mutex::new(NativeByteStreamCounters::default()),
    }
  }
}

impl NativeByteStreamState {
  fn ensure_stream_locked<'a>(
    streams: &'a mut HashMap<String, NativeByteStreamRecord>,
    stream_id: &str,
    kind: &str,
  ) -> &'a mut NativeByteStreamRecord {
    streams
      .entry(stream_id.to_string())
      .or_insert_with(|| NativeByteStreamRecord {
        handle: NativeByteStreamHandle {
          id: stream_id.to_string(),
          kind: kind.to_string(),
        },
        next_sequence: 0,
        pending: Vec::new(),
        flush_scheduled: false,
        subscribers: HashMap::new(),
      })
  }

  fn subscribe_stream(
    &self,
    stream_id: String,
    kind: String,
    webview_label: String,
  ) -> Result<NativeByteStreamSubscriptionHandle, String> {
    let subscription_id = random_identifier("native-stream-subscription");
    let mut streams = self
      .streams
      .lock()
      .map_err(|_| "native byte stream registry lock poisoned".to_string())?;
    let stream = Self::ensure_stream_locked(&mut streams, &stream_id, &kind);
    stream.subscribers.insert(
      subscription_id.clone(),
      NativeByteStreamSubscriber {
        webview_label: webview_label.clone(),
      },
    );
    Ok(NativeByteStreamSubscriptionHandle {
      id: subscription_id,
      stream_id,
      webview_label,
    })
  }

  fn unsubscribe_stream(&self, subscription_id: &str) -> Result<(), String> {
    let mut streams = self
      .streams
      .lock()
      .map_err(|_| "native byte stream registry lock poisoned".to_string())?;
    for stream in streams.values_mut() {
      if stream.subscribers.remove(subscription_id).is_some() {
        break;
      }
    }
    Ok(())
  }

  fn push_bytes(
    &self,
    stream_id: &str,
    kind: &str,
    bytes: &[u8],
  ) -> Result<(Option<NativeByteStreamTakeOutcome>, bool, usize), String> {
    if bytes.is_empty() {
      return Ok((None, false, 0));
    }

    let mut streams = self
      .streams
      .lock()
      .map_err(|_| "native byte stream registry lock poisoned".to_string())?;
    let stream = Self::ensure_stream_locked(&mut streams, stream_id, kind);
    stream.pending.extend_from_slice(bytes);
    self.record_queue_depth(stream.pending.len());

    if stream.pending.len() >= DEFAULT_FLUSH_BYTES {
      let delivery = take_delivery(stream);
      return Ok((delivery, false, 0));
    }

    let should_schedule = !stream.flush_scheduled;
    stream.flush_scheduled = true;
    Ok((None, should_schedule, stream.pending.len()))
  }

  fn flush_stream(&self, stream_id: &str) -> Result<Option<NativeByteStreamTakeOutcome>, String> {
    let mut streams = self
      .streams
      .lock()
      .map_err(|_| "native byte stream registry lock poisoned".to_string())?;
    let Some(stream) = streams.get_mut(stream_id) else {
      return Ok(None);
    };
    stream.flush_scheduled = false;
    Ok(take_delivery(stream))
  }

  fn record_queue_depth(&self, queue_depth: usize) {
    if let Ok(mut counters) = self.counters.lock() {
      counters.max_queue_depth = counters.max_queue_depth.max(queue_depth);
    }
  }

  fn record_delivery(&self, delivery: &NativeByteStreamDelivery) {
    if let Ok(mut counters) = self.counters.lock() {
      counters.packets = counters.packets.saturating_add(1);
      counters.bytes = counters.bytes.saturating_add(delivery.bytes.len() as u64);
    }
  }

  fn record_post_failures(&self, count: u64) {
    if count == 0 {
      return;
    }
    if let Ok(mut counters) = self.counters.lock() {
      counters.post_failures = counters.post_failures.saturating_add(count);
    }
  }

  fn record_dropped_range(&self, dropped_range: NativeByteStreamDroppedRange) {
    if let Ok(mut counters) = self.counters.lock() {
      counters.dropped_bytes = counters.dropped_bytes.saturating_add(dropped_range.bytes);
      counters.dropped_ranges.push(dropped_range);
      const MAX_RETAINED_DROPPED_RANGES: usize = 512;
      if counters.dropped_ranges.len() > MAX_RETAINED_DROPPED_RANGES {
        let overflow = counters.dropped_ranges.len() - MAX_RETAINED_DROPPED_RANGES;
        counters.dropped_ranges.drain(0..overflow);
      }
    }
  }

  fn record_native_enqueue_time(&self, duration: Duration) {
    if let Ok(mut counters) = self.counters.lock() {
      let elapsed_us = duration.as_micros() as u64;
      counters.native_enqueue_time_total_us = counters
        .native_enqueue_time_total_us
        .saturating_add(elapsed_us);
      counters.native_enqueue_time_max_us = counters.native_enqueue_time_max_us.max(elapsed_us);
    }
  }

  fn record_post_metrics(&self, metrics: NativeByteStreamPostMetrics) {
    if let Ok(mut counters) = self.counters.lock() {
      counters.allocation_count = counters
        .allocation_count
        .saturating_add(metrics.allocation_count);
      counters.copy_count = counters.copy_count.saturating_add(metrics.copy_count);
      counters.copied_bytes = counters.copied_bytes.saturating_add(metrics.copied_bytes);
      counters.webview_post_time_total_us = counters
        .webview_post_time_total_us
        .saturating_add(metrics.post_time_us);
      counters.webview_post_time_max_us =
        counters.webview_post_time_max_us.max(metrics.post_time_us);
    }
  }

  fn record_unavailable_subscription(&self) {
    if let Ok(mut counters) = self.counters.lock() {
      counters.unavailable_subscriptions = counters.unavailable_subscriptions.saturating_add(1);
    }
  }

  pub fn telemetry_snapshot(&self) -> NativeByteStreamTelemetry {
    let (streams_count, subscriptions) = self
      .streams
      .lock()
      .map(|streams| {
        let subscriptions = streams
          .values()
          .map(|stream| stream.subscribers.len())
          .sum::<usize>();
        (streams.len(), subscriptions)
      })
      .unwrap_or((0, 0));
    let counters = self.counters.lock().ok();
    let packets = counters.as_ref().map(|c| c.packets).unwrap_or(0);
    let bytes = counters.as_ref().map(|c| c.bytes).unwrap_or(0);
    NativeByteStreamTelemetry {
      streams: streams_count,
      subscriptions,
      packets,
      bytes,
      average_batch_size: if packets == 0 { 0 } else { bytes / packets },
      post_failures: counters.as_ref().map(|c| c.post_failures).unwrap_or(0),
      unavailable_subscriptions: counters
        .as_ref()
        .map(|c| c.unavailable_subscriptions)
        .unwrap_or(0),
      dropped_bytes: counters.as_ref().map(|c| c.dropped_bytes).unwrap_or(0),
      dropped_ranges: counters
        .as_ref()
        .map(|c| c.dropped_ranges.clone())
        .unwrap_or_default(),
      max_queue_depth: counters.as_ref().map(|c| c.max_queue_depth).unwrap_or(0),
      allocation_count: counters.as_ref().map(|c| c.allocation_count).unwrap_or(0),
      copy_count: counters.as_ref().map(|c| c.copy_count).unwrap_or(0),
      copied_bytes: counters.as_ref().map(|c| c.copied_bytes).unwrap_or(0),
      native_enqueue_time_total_us: counters
        .as_ref()
        .map(|c| c.native_enqueue_time_total_us)
        .unwrap_or(0),
      native_enqueue_time_max_us: counters
        .as_ref()
        .map(|c| c.native_enqueue_time_max_us)
        .unwrap_or(0),
      webview_post_time_total_us: counters
        .as_ref()
        .map(|c| c.webview_post_time_total_us)
        .unwrap_or(0),
      webview_post_time_max_us: counters
        .as_ref()
        .map(|c| c.webview_post_time_max_us)
        .unwrap_or(0),
    }
  }
}

fn take_delivery(stream: &mut NativeByteStreamRecord) -> Option<NativeByteStreamTakeOutcome> {
  if stream.pending.is_empty() {
    return None;
  }
  if stream.subscribers.is_empty() {
    let bytes = stream.pending.len() as u64;
    stream.pending.clear();
    return Some(NativeByteStreamTakeOutcome::Dropped(
      NativeByteStreamDroppedRange {
        stream_id: stream.handle.id.clone(),
        start_sequence: stream.next_sequence,
        end_sequence: stream.next_sequence,
        bytes,
      },
    ));
  }
  let bytes = std::mem::take(&mut stream.pending);
  let metadata = NativeByteStreamPacketMetadata {
    stream_id: stream.handle.id.clone(),
    sequence: stream.next_sequence,
    emitted_at_epoch_ms: current_epoch_ms(),
    byte_length: bytes.len() as u64,
  };
  stream.next_sequence = stream.next_sequence.saturating_add(1);
  Some(NativeByteStreamTakeOutcome::Delivery(
    NativeByteStreamDelivery {
      metadata,
      bytes,
      subscribers: stream.subscribers.values().cloned().collect(),
    },
  ))
}

pub fn publish_byte_stream<R: Runtime, M: Manager<R>>(
  manager: &M,
  stream_id: &str,
  kind: &str,
  bytes: &[u8],
) -> Result<NativeByteStreamPublishOutcome, String> {
  let state = manager.state::<NativeByteStreamState>();
  let enqueue_started_at = Instant::now();
  let (outcome, should_schedule, pending_bytes) = state.push_bytes(stream_id, kind, bytes)?;
  state.record_native_enqueue_time(enqueue_started_at.elapsed());
  if let Some(outcome) = outcome {
    dispatch_take_outcome(manager, state.inner(), outcome)?;
    return Ok(NativeByteStreamPublishOutcome {
      flushed: true,
      pending_bytes: 0,
    });
  }
  if should_schedule {
    if let Some(outcome) = state.flush_stream(stream_id)? {
      dispatch_take_outcome(manager, state.inner(), outcome)?;
      return Ok(NativeByteStreamPublishOutcome {
        flushed: true,
        pending_bytes: 0,
      });
    }
  }
  Ok(NativeByteStreamPublishOutcome {
    flushed: false,
    pending_bytes,
  })
}

pub fn flush_byte_stream<R: Runtime, M: Manager<R>>(
  manager: &M,
  stream_id: &str,
) -> Result<(), String> {
  let state = manager.state::<NativeByteStreamState>();
  if let Some(outcome) = state.flush_stream(stream_id)? {
    dispatch_take_outcome(manager, state.inner(), outcome)?;
  }
  Ok(())
}

fn dispatch_take_outcome<R: Runtime, M: Manager<R>>(
  manager: &M,
  state: &NativeByteStreamState,
  outcome: NativeByteStreamTakeOutcome,
) -> Result<(), String> {
  match outcome {
    NativeByteStreamTakeOutcome::Delivery(delivery) => dispatch_delivery(manager, state, delivery),
    NativeByteStreamTakeOutcome::Dropped(dropped_range) => {
      state.record_dropped_range(dropped_range);
      Ok(())
    }
  }
}

fn dispatch_delivery<R: Runtime, M: Manager<R>>(
  manager: &M,
  state: &NativeByteStreamState,
  delivery: NativeByteStreamDelivery,
) -> Result<(), String> {
  state.record_delivery(&delivery);
  let mut failed_posts = 0_u64;
  for subscriber in &delivery.subscribers {
    let Some(webview) = manager.manager().get_webview(&subscriber.webview_label) else {
      failed_posts = failed_posts.saturating_add(1);
      continue;
    };
    match post_delivery_to_webview(&webview, &delivery) {
      Ok(metrics) => state.record_post_metrics(metrics),
      Err(_) => {
        failed_posts = failed_posts.saturating_add(1);
      }
    }
  }
  state.record_post_failures(failed_posts);
  Ok(())
}

#[cfg(all(windows, feature = "wry"))]
fn ensure_webview_supports_native_stream<R: Runtime>(webview: &Webview<R>) -> Result<(), String> {
  use std::sync::mpsc;

  use webview2_com::Microsoft::Web::WebView2::Win32::{
    ICoreWebView2Environment12, ICoreWebView2_17,
  };
  use windows::core::Interface;

  let (tx, rx) = mpsc::channel();
  webview
    .with_webview(move |platform_webview| {
      let result = (|| unsafe {
        platform_webview
          .environment()
          .cast::<ICoreWebView2Environment12>()
          .map_err(|error| format!("WebView2 shared buffers are unavailable: {error}"))?;
        platform_webview
          .controller()
          .CoreWebView2()
          .map_err(|error| format!("failed to resolve CoreWebView2: {error}"))?
          .cast::<ICoreWebView2_17>()
          .map_err(|error| format!("WebView2 shared-buffer posting is unavailable: {error}"))?;
        Ok::<(), String>(())
      })();
      let _ = tx.send(result);
    })
    .map_err(|error| format!("failed to schedule WebView2 native stream probe: {error}"))?;

  rx.recv_timeout(Duration::from_secs(1))
    .map_err(|_| "timed out probing WebView2 native stream support".to_string())?
}

#[cfg(not(all(windows, feature = "wry")))]
fn ensure_webview_supports_native_stream<R: Runtime>(_webview: &Webview<R>) -> Result<(), String> {
  Err("native byte streams require Windows WebView2".to_string())
}

#[cfg(all(windows, feature = "wry"))]
fn post_delivery_to_webview<R: Runtime>(
  webview: &Webview<R>,
  delivery: &NativeByteStreamDelivery,
) -> Result<NativeByteStreamPostMetrics, String> {
  use std::sync::mpsc;

  use webview2_com::Microsoft::Web::WebView2::Win32::{
    ICoreWebView2Environment12, ICoreWebView2_17, COREWEBVIEW2_SHARED_BUFFER_ACCESS_READ_ONLY,
  };
  use windows::core::{Interface, PCWSTR};

  let post_started_at = Instant::now();
  let bytes = delivery.bytes.clone();
  let byte_length = bytes.len() as u64;
  let additional_data = serde_json::to_string(&serde_json::json!({
    "tauronNativeStream": true,
    "streamId": delivery.metadata.stream_id,
    "sequence": delivery.metadata.sequence,
    "emittedAtEpochMs": delivery.metadata.emitted_at_epoch_ms,
    "byteLength": delivery.metadata.byte_length,
  }))
  .map_err(|error| format!("failed to serialize native stream metadata: {error}"))?;
  let additional_data_wide = additional_data
    .encode_utf16()
    .chain(std::iter::once(0))
    .collect::<Vec<_>>();
  let (tx, rx) = mpsc::channel();
  webview
    .with_webview(move |platform_webview| {
      let result = unsafe {
        let environment = platform_webview.environment();
        let environment12 = match environment.cast::<ICoreWebView2Environment12>() {
          Ok(environment12) => environment12,
          Err(error) => {
            let _ = tx.send(Err(format!(
              "WebView2 shared buffers are unavailable: {error}"
            )));
            return;
          }
        };
        let controller = platform_webview.controller();
        let webview2 = match controller.CoreWebView2() {
          Ok(webview2) => webview2,
          Err(error) => {
            let _ = tx.send(Err(format!("failed to resolve CoreWebView2: {error}")));
            return;
          }
        };
        let webview17 = match webview2.cast::<ICoreWebView2_17>() {
          Ok(webview17) => webview17,
          Err(error) => {
            let _ = tx.send(Err(format!(
              "WebView2 shared-buffer posting is unavailable: {error}"
            )));
            return;
          }
        };
        let shared_buffer = match environment12.CreateSharedBuffer(bytes.len() as u64) {
          Ok(shared_buffer) => shared_buffer,
          Err(error) => {
            let _ = tx.send(Err(format!(
              "failed to allocate WebView2 shared buffer: {error}"
            )));
            return;
          }
        };
        let mut raw_buffer = std::ptr::null_mut();
        if let Err(error) = shared_buffer.Buffer(&mut raw_buffer) {
          let _ = shared_buffer.Close();
          let _ = tx.send(Err(format!(
            "failed to access WebView2 shared buffer: {error}"
          )));
          return;
        }
        std::ptr::copy_nonoverlapping(bytes.as_ptr(), raw_buffer, bytes.len());
        let post_result = webview17.PostSharedBufferToScript(
          &shared_buffer,
          COREWEBVIEW2_SHARED_BUFFER_ACCESS_READ_ONLY,
          PCWSTR(additional_data_wide.as_ptr()),
        );
        let _ = shared_buffer.Close();
        post_result.map_err(|error| format!("failed to post WebView2 shared buffer: {error}"))
      };
      let _ = tx.send(result);
    })
    .map_err(|error| format!("failed to schedule WebView2 shared-buffer post: {error}"))?;

  rx.recv_timeout(Duration::from_secs(1))
    .map_err(|_| "timed out posting WebView2 shared buffer".to_string())??;

  Ok(NativeByteStreamPostMetrics {
    allocation_count: 2,
    copy_count: 2,
    copied_bytes: byte_length.saturating_mul(2),
    post_time_us: post_started_at.elapsed().as_micros() as u64,
  })
}

#[cfg(not(all(windows, feature = "wry")))]
fn post_delivery_to_webview<R: Runtime>(
  _webview: &Webview<R>,
  _delivery: &NativeByteStreamDelivery,
) -> Result<NativeByteStreamPostMetrics, String> {
  Err("native byte streams require Windows WebView2".to_string())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NativeStreamSubscribeArgs {
  id: String,
  kind: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NativeStreamUnsubscribeArgs {
  id: String,
}

fn subscribe_for_webview_label<R: Runtime, M: Manager<R>>(
  manager: &M,
  state: &NativeByteStreamState,
  stream_id: String,
  kind: Option<String>,
  webview_label: String,
) -> Result<NativeByteStreamSubscriptionHandle, String> {
  let Some(webview) = manager.manager().get_webview(&webview_label) else {
    state.record_unavailable_subscription();
    return Err(format!(
      "native byte stream WebView not found for label '{webview_label}'"
    ));
  };
  if let Err(error) = ensure_webview_supports_native_stream(&webview) {
    state.record_unavailable_subscription();
    return Err(error);
  }
  state.subscribe_stream(
    stream_id,
    kind.unwrap_or_else(|| "native-byte-stream".to_string()),
    webview_label,
  )
}

fn serialize_native_control_result<T: Serialize>(value: T) -> Result<serde_json::Value, String> {
  serde_json::to_value(value)
    .map_err(|error| format!("failed to serialize native stream native-control response: {error}"))
}

fn parse_native_control_args<T: for<'de> Deserialize<'de>>(
  request: NativeControlRequest,
) -> Result<T, String> {
  serde_json::from_value(request.args)
    .map_err(|error| format!("failed to parse native stream native-control args: {error}"))
}

fn register_native_control_handlers<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
  let app_for_subscribe = app.clone();
  native_control::register_handler(
    app,
    "nativeStream",
    "subscribe",
    move |request: NativeControlRequest| {
      let args: NativeStreamSubscribeArgs = parse_native_control_args(request.clone())?;
      let webview_label = request
        .webview_label
        .ok_or_else(|| "native stream subscribe requires a WebView label".to_string())?;
      let state = app_for_subscribe.state::<NativeByteStreamState>();
      serialize_native_control_result(subscribe_for_webview_label(
        &app_for_subscribe,
        state.inner(),
        args.id,
        args.kind,
        webview_label,
      )?)
    },
  )?;

  let app_for_unsubscribe = app.clone();
  native_control::register_handler(
    app,
    "nativeStream",
    "unsubscribe",
    move |request: NativeControlRequest| {
      let args: NativeStreamUnsubscribeArgs = parse_native_control_args(request)?;
      let state = app_for_unsubscribe.state::<NativeByteStreamState>();
      state.unsubscribe_stream(&args.id)?;
      serialize_native_control_result(serde_json::json!({ "ok": true }))
    },
  )?;

  let app_for_telemetry = app.clone();
  native_control::register_handler(
    app,
    "nativeStream",
    "telemetry",
    move |_request: NativeControlRequest| {
      let state = app_for_telemetry.state::<NativeByteStreamState>();
      serialize_native_control_result(state.telemetry_snapshot())
    },
  )
}

#[crate::command(root = "crate")]
fn subscribe<R: Runtime>(
  webview: Webview<R>,
  state: State<'_, NativeByteStreamState>,
  id: String,
  kind: Option<String>,
) -> Result<NativeByteStreamSubscriptionHandle, String> {
  subscribe_for_webview_label(
    &webview,
    state.inner(),
    id,
    kind,
    webview.label().to_string(),
  )
}

#[crate::command(root = "crate")]
fn unsubscribe(state: State<'_, NativeByteStreamState>, id: String) -> Result<(), String> {
  state.unsubscribe_stream(&id)
}

#[crate::command(root = "crate")]
fn telemetry(state: State<'_, NativeByteStreamState>) -> NativeByteStreamTelemetry {
  state.telemetry_snapshot()
}

pub(crate) fn plugin<R: Runtime>() -> TauriPlugin<R> {
  PluginBuilder::new(NATIVE_STREAM_PLUGIN_NAME)
    .setup(|app, _api| {
      if app.try_state::<NativeByteStreamState>().is_none() {
        let _ = app.manage(NativeByteStreamState::default());
      }
      register_native_control_handlers(app)
        .map_err(|error| std::io::Error::new(std::io::ErrorKind::Other, error).into())
    })
    .js_init_script(native_stream_init_script())
    .invoke_handler(crate::generate_handler![
      #![plugin(native_stream)]
      subscribe,
      unsubscribe,
      telemetry
    ])
    .build()
}

fn native_stream_init_script() -> String {
  r#"
    (function () {
      if (window.__TAURI_NATIVE_STREAM__) {
        return;
      }

      const listeners = new Map();
      const consumeTelemetry = {
        packetCount: 0,
        bytes: 0,
        totalListenerTimeMs: 0,
        maxListenerTimeMs: 0
      };
      const webview = window.chrome && window.chrome.webview;
      const bridge = {
        available: !!(webview && typeof webview.addEventListener === 'function'),
        addListener(streamId, listener) {
          let streamListeners = listeners.get(streamId);
          if (!streamListeners) {
            streamListeners = new Set();
            listeners.set(streamId, streamListeners);
          }
          streamListeners.add(listener);
          return () => {
            streamListeners.delete(listener);
            if (streamListeners.size === 0) {
              listeners.delete(streamId);
            }
          };
        },
        telemetrySnapshot() {
          return {
            packetCount: consumeTelemetry.packetCount,
            bytes: consumeTelemetry.bytes,
            totalListenerTimeMs: consumeTelemetry.totalListenerTimeMs,
            maxListenerTimeMs: consumeTelemetry.maxListenerTimeMs
          };
        },
        resetTelemetry() {
          consumeTelemetry.packetCount = 0;
          consumeTelemetry.bytes = 0;
          consumeTelemetry.totalListenerTimeMs = 0;
          consumeTelemetry.maxListenerTimeMs = 0;
        }
      };

      Object.defineProperty(window, '__TAURI_NATIVE_STREAM__', {
        value: bridge,
        configurable: false,
        enumerable: false,
        writable: false
      });

      if (!bridge.available) {
        return;
      }

      webview.addEventListener('sharedbufferreceived', event => {
        const metadata = event.additionalData || {};
        if (!metadata.tauronNativeStream || typeof metadata.streamId !== 'string') {
          return;
        }
        const streamListeners = listeners.get(metadata.streamId);
        if (!streamListeners || streamListeners.size === 0) {
          const ignoredBuffer = event.getBuffer();
          if (webview.releaseBuffer) {
            webview.releaseBuffer(ignoredBuffer);
          }
          return;
        }
        const buffer = event.getBuffer();
        const bytes = new Uint8Array(buffer);
        const packet = {
          streamId: metadata.streamId,
          sequence: Number(metadata.sequence || 0),
          emittedAtEpochMs: Number(metadata.emittedAtEpochMs || 0),
          bytes
        };
        const listenerStartedAt = performance.now();
        for (const listener of Array.from(streamListeners)) {
          listener(packet);
        }
        const listenerTimeMs = performance.now() - listenerStartedAt;
        consumeTelemetry.packetCount += 1;
        consumeTelemetry.bytes += bytes.byteLength;
        consumeTelemetry.totalListenerTimeMs += listenerTimeMs;
        consumeTelemetry.maxListenerTimeMs = Math.max(
          consumeTelemetry.maxListenerTimeMs,
          listenerTimeMs
        );
        if (webview.releaseBuffer) {
          webview.releaseBuffer(buffer);
        }
      });
    })();
  "#
  .to_string()
}

fn current_epoch_ms() -> u64 {
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|duration| duration.as_millis() as u64)
    .unwrap_or(0)
}

fn random_identifier(prefix: &str) -> String {
  format!(
    "{prefix}-{}-{}",
    current_epoch_ms(),
    NEXT_NATIVE_STREAM_ID.fetch_add(1, Ordering::Relaxed)
  )
}

#[cfg(test)]
mod tests {
  use super::{NativeByteStreamState, NativeByteStreamTakeOutcome, DEFAULT_FLUSH_BYTES};

  #[test]
  fn registry_lifecycle_tracks_subscriptions() {
    let state = NativeByteStreamState::default();
    let subscription = state
      .subscribe_stream("stream-a".into(), "terminal-output".into(), "main".into())
      .expect("subscribe");
    let telemetry = state.telemetry_snapshot();
    assert_eq!(telemetry.streams, 1);
    assert_eq!(telemetry.subscriptions, 1);

    state
      .unsubscribe_stream(&subscription.id)
      .expect("unsubscribe");
    let telemetry = state.telemetry_snapshot();
    assert_eq!(telemetry.streams, 1);
    assert_eq!(telemetry.subscriptions, 0);
  }

  #[test]
  fn byte_batches_flush_immediately_at_threshold() {
    let state = NativeByteStreamState::default();
    state
      .subscribe_stream("stream-a".into(), "terminal-output".into(), "main".into())
      .expect("subscribe");
    let payload = vec![7_u8; DEFAULT_FLUSH_BYTES];
    let (delivery, scheduled, pending_bytes) = state
      .push_bytes("stream-a", "terminal-output", &payload)
      .expect("push");

    let delivery = match delivery.expect("delivery") {
      NativeByteStreamTakeOutcome::Delivery(delivery) => delivery,
      NativeByteStreamTakeOutcome::Dropped(_) => panic!("expected delivery"),
    };
    assert!(!scheduled);
    assert_eq!(pending_bytes, 0);
    assert_eq!(delivery.metadata.sequence, 0);
    assert_eq!(delivery.metadata.byte_length, DEFAULT_FLUSH_BYTES as u64);
    assert_eq!(delivery.bytes.len(), DEFAULT_FLUSH_BYTES);
  }

  #[test]
  fn delayed_flush_preserves_sequence_order() {
    let state = NativeByteStreamState::default();
    state
      .subscribe_stream("stream-a".into(), "terminal-output".into(), "main".into())
      .expect("subscribe");
    let (delivery, scheduled, pending_bytes) = state
      .push_bytes("stream-a", "terminal-output", b"abc")
      .expect("push");
    assert!(delivery.is_none());
    assert!(scheduled);
    assert_eq!(pending_bytes, 3);

    let first = match state
      .flush_stream("stream-a")
      .expect("flush")
      .expect("first delivery")
    {
      NativeByteStreamTakeOutcome::Delivery(delivery) => delivery,
      NativeByteStreamTakeOutcome::Dropped(_) => panic!("expected first delivery"),
    };
    state
      .push_bytes("stream-a", "terminal-output", b"def")
      .expect("push");
    let second = match state
      .flush_stream("stream-a")
      .expect("flush")
      .expect("second delivery")
    {
      NativeByteStreamTakeOutcome::Delivery(delivery) => delivery,
      NativeByteStreamTakeOutcome::Dropped(_) => panic!("expected second delivery"),
    };

    assert_eq!(first.metadata.sequence, 0);
    assert_eq!(first.bytes, b"abc");
    assert_eq!(second.metadata.sequence, 1);
    assert_eq!(second.bytes, b"def");
  }

  #[test]
  fn telemetry_records_dropped_pending_bytes_without_subscribers() {
    let state = NativeByteStreamState::default();
    state
      .push_bytes("stream-a", "terminal-output", b"lost")
      .expect("push");
    let dropped = state
      .flush_stream("stream-a")
      .expect("flush")
      .expect("dropped range");
    match dropped {
      NativeByteStreamTakeOutcome::Dropped(range) => {
        state.record_dropped_range(range);
      }
      NativeByteStreamTakeOutcome::Delivery(_) => panic!("expected dropped range"),
    }

    let telemetry = state.telemetry_snapshot();
    assert_eq!(telemetry.dropped_bytes, 4);
    assert_eq!(telemetry.dropped_ranges.len(), 1);
    assert_eq!(telemetry.dropped_ranges[0].stream_id, "stream-a");
  }

  #[test]
  fn telemetry_tracks_max_queue_depth() {
    let state = NativeByteStreamState::default();
    state
      .subscribe_stream("stream-a".into(), "terminal-output".into(), "main".into())
      .expect("subscribe");
    state
      .push_bytes("stream-a", "terminal-output", b"abc")
      .expect("push");
    state
      .push_bytes("stream-a", "terminal-output", b"defgh")
      .expect("push");

    let telemetry = state.telemetry_snapshot();
    assert_eq!(telemetry.max_queue_depth, 8);
  }
}
