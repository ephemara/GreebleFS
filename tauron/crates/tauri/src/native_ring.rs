//! Benchmark-first persistent WebView2 shared-memory ring lane.
#![allow(missing_docs)]

use std::{
  collections::VecDeque,
  time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};

use crate::{Manager, Runtime, Webview};

pub const DEFAULT_NATIVE_RING_CAPACITY: usize = 4 * 1024 * 1024;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeRingDroppedRange {
  pub start_sequence: u64,
  pub end_sequence: u64,
  pub bytes: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeRingDoorbell {
  pub ring_id: String,
  pub sequence: u64,
  pub offset: usize,
  pub byte_length: usize,
  pub emitted_at_epoch_ms: u64,
  pub dropped_ranges: Vec<NativeRingDroppedRange>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeRingTelemetry {
  pub packets: u64,
  pub bytes: u64,
  pub capacity: usize,
  pub queue_depth: usize,
  pub max_queue_depth: usize,
  pub dropped_bytes: u64,
  pub dropped_ranges: Vec<NativeRingDroppedRange>,
}

#[derive(Debug, Clone)]
struct NativeRingEntry {
  sequence: u64,
  offset: usize,
  byte_length: usize,
}

#[derive(Debug, Clone)]
pub struct NativeRing {
  ring_id: String,
  capacity: usize,
  write_offset: usize,
  next_sequence: u64,
  entries: VecDeque<NativeRingEntry>,
  telemetry: NativeRingTelemetry,
}

impl NativeRing {
  pub fn new(ring_id: impl Into<String>, capacity: usize) -> Result<Self, String> {
    if capacity == 0 {
      return Err("native ring capacity must be greater than zero".to_string());
    }
    Ok(Self {
      ring_id: ring_id.into(),
      capacity,
      write_offset: 0,
      next_sequence: 0,
      entries: VecDeque::new(),
      telemetry: NativeRingTelemetry {
        capacity,
        ..NativeRingTelemetry::default()
      },
    })
  }

  pub fn append(&mut self, byte_length: usize, emitted_at_epoch_ms: u64) -> NativeRingDoorbell {
    let effective_length = byte_length.min(self.capacity);
    if self.write_offset + effective_length > self.capacity {
      self.write_offset = 0;
    }
    let offset = self.write_offset;
    let end_offset = offset.saturating_add(effective_length);
    let dropped_ranges = self.drop_overlapping(offset, end_offset, effective_length);

    let sequence = self.next_sequence;
    self.next_sequence = self.next_sequence.saturating_add(1);
    self.write_offset = end_offset % self.capacity;
    self.entries.push_back(NativeRingEntry {
      sequence,
      offset,
      byte_length: effective_length,
    });
    self.telemetry.packets = self.telemetry.packets.saturating_add(1);
    self.telemetry.bytes = self.telemetry.bytes.saturating_add(effective_length as u64);
    self.telemetry.queue_depth = self.queued_bytes();
    self.telemetry.max_queue_depth = self
      .telemetry
      .max_queue_depth
      .max(self.telemetry.queue_depth);

    NativeRingDoorbell {
      ring_id: self.ring_id.clone(),
      sequence,
      offset,
      byte_length: effective_length,
      emitted_at_epoch_ms,
      dropped_ranges,
    }
  }

  pub fn telemetry(&self) -> NativeRingTelemetry {
    self.telemetry.clone()
  }

  fn queued_bytes(&self) -> usize {
    self
      .entries
      .iter()
      .map(|entry| entry.byte_length)
      .sum::<usize>()
  }

  fn drop_overlapping(
    &mut self,
    offset: usize,
    end_offset: usize,
    byte_length: usize,
  ) -> Vec<NativeRingDroppedRange> {
    let mut dropped = Vec::new();
    while self.queued_bytes().saturating_add(byte_length) > self.capacity {
      if let Some(entry) = self.entries.pop_front() {
        dropped.push(self.record_drop(entry));
      } else {
        break;
      }
    }

    while let Some(entry) = self.entries.front() {
      let entry_end = entry.offset.saturating_add(entry.byte_length);
      let overlaps = offset < entry_end && end_offset > entry.offset;
      if !overlaps {
        break;
      }
      let entry = self.entries.pop_front().expect("front existed");
      dropped.push(self.record_drop(entry));
    }
    dropped
  }

  fn record_drop(&mut self, entry: NativeRingEntry) -> NativeRingDroppedRange {
    let range = NativeRingDroppedRange {
      start_sequence: entry.sequence,
      end_sequence: entry.sequence,
      bytes: entry.byte_length as u64,
    };
    self.telemetry.dropped_bytes = self.telemetry.dropped_bytes.saturating_add(range.bytes);
    self.telemetry.dropped_ranges.push(range.clone());
    range
  }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeRingPostMetrics {
  pub packets: u64,
  pub bytes: u64,
  pub copy_count: u64,
  pub copied_bytes: u64,
  pub webview_post_time_us: u64,
  pub telemetry: NativeRingTelemetry,
}

#[cfg(all(windows, feature = "wry"))]
pub fn post_ring_benchmark<R: Runtime, M: Manager<R>>(
  manager: &M,
  webview_label: &str,
  ring_id: &str,
  packets: u64,
  packet_bytes: usize,
  capacity: usize,
) -> Result<NativeRingPostMetrics, String> {
  let Some(webview) = manager.manager().get_webview(webview_label) else {
    return Err(format!(
      "native ring benchmark WebView not found for label '{webview_label}'"
    ));
  };
  post_ring_benchmark_to_webview(&webview, ring_id, packets, packet_bytes, capacity)
}

#[cfg(all(windows, feature = "wry"))]
fn post_ring_benchmark_to_webview<R: Runtime>(
  webview: &Webview<R>,
  ring_id: &str,
  packets: u64,
  packet_bytes: usize,
  capacity: usize,
) -> Result<NativeRingPostMetrics, String> {
  use std::sync::mpsc;

  use webview2_com::Microsoft::Web::WebView2::Win32::{
    ICoreWebView2Environment12, ICoreWebView2_17, COREWEBVIEW2_SHARED_BUFFER_ACCESS_READ_WRITE,
  };
  use windows::core::{Interface, PCWSTR};

  let capacity = capacity.max(packet_bytes).max(1);
  let ring_id_string = ring_id.to_string();
  let additional_data = serde_json::to_string(&serde_json::json!({
    "tauronNativeRing": true,
    "ringId": ring_id,
    "capacity": capacity,
  }))
  .map_err(|error| format!("failed to serialize native ring metadata: {error}"))?;
  let additional_data_wide = additional_data
    .encode_utf16()
    .chain(std::iter::once(0))
    .collect::<Vec<_>>();
  let started_at = Instant::now();
  let (tx, rx) = mpsc::channel();
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
        let webview2 = match platform_webview.controller().CoreWebView2() {
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
        let shared_buffer = match environment12.CreateSharedBuffer(capacity as u64) {
          Ok(shared_buffer) => shared_buffer,
          Err(error) => {
            let _ = tx.send(Err(format!(
              "failed to allocate native ring shared buffer: {error}"
            )));
            return;
          }
        };
        let mut raw_buffer = std::ptr::null_mut();
        if let Err(error) = shared_buffer.Buffer(&mut raw_buffer) {
          let _ = shared_buffer.Close();
          let _ = tx.send(Err(format!(
            "failed to access native ring shared buffer: {error}"
          )));
          return;
        }
        if let Err(error) = webview17.PostSharedBufferToScript(
          &shared_buffer,
          COREWEBVIEW2_SHARED_BUFFER_ACCESS_READ_WRITE,
          PCWSTR(additional_data_wide.as_ptr()),
        ) {
          let _ = shared_buffer.Close();
          let _ = tx.send(Err(format!(
            "failed to post native ring shared buffer: {error}"
          )));
          return;
        }

        let mut ring = match NativeRing::new(ring_id_string, capacity) {
          Ok(ring) => ring,
          Err(error) => {
            let _ = shared_buffer.Close();
            let _ = tx.send(Err(error));
            return;
          }
        };
        let payload = vec![0xA7_u8; packet_bytes];
        for _ in 0..packets {
          let doorbell = ring.append(packet_bytes, current_epoch_ms());
          std::ptr::copy_nonoverlapping(
            payload.as_ptr(),
            raw_buffer.add(doorbell.offset),
            doorbell.byte_length,
          );
          let doorbell_json = match serde_json::to_string(&serde_json::json!({
            "tauronNativeRingDoorbell": true,
            "ringId": doorbell.ring_id,
            "sequence": doorbell.sequence,
            "offset": doorbell.offset,
            "byteLength": doorbell.byte_length,
            "emittedAtEpochMs": doorbell.emitted_at_epoch_ms,
            "droppedRanges": doorbell.dropped_ranges,
          })) {
            Ok(doorbell_json) => doorbell_json,
            Err(error) => {
              let _ = shared_buffer.Close();
              let _ = tx.send(Err(format!(
                "failed to serialize native ring doorbell: {error}"
              )));
              return;
            }
          };
          let doorbell_wide = doorbell_json
            .encode_utf16()
            .chain(std::iter::once(0))
            .collect::<Vec<_>>();
          if let Err(error) = webview2.PostWebMessageAsJson(PCWSTR(doorbell_wide.as_ptr())) {
            let _ = shared_buffer.Close();
            let _ = tx.send(Err(format!("failed to post native ring doorbell: {error}")));
            return;
          }
        }
        let telemetry = ring.telemetry();
        let _ = tx.send(Ok(telemetry));
      };
      let _ = result;
    })
    .map_err(|error| format!("failed to schedule native ring benchmark: {error}"))?;

  let telemetry = rx
    .recv_timeout(Duration::from_secs(5))
    .map_err(|_| "timed out posting native ring benchmark".to_string())??;

  Ok(NativeRingPostMetrics {
    packets: telemetry.packets,
    bytes: telemetry.bytes,
    copy_count: telemetry.packets,
    copied_bytes: telemetry.bytes,
    webview_post_time_us: started_at.elapsed().as_micros() as u64,
    telemetry,
  })
}

fn current_epoch_ms() -> u64 {
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|duration| duration.as_millis() as u64)
    .unwrap_or(0)
}

#[cfg(not(all(windows, feature = "wry")))]
pub fn post_ring_benchmark<R: Runtime, M: Manager<R>>(
  _manager: &M,
  _webview_label: &str,
  _ring_id: &str,
  _packets: u64,
  _packet_bytes: usize,
  _capacity: usize,
) -> Result<NativeRingPostMetrics, String> {
  Err("native ring requires Windows WebView2".to_string())
}

#[cfg(test)]
mod tests {
  use super::NativeRing;

  #[test]
  fn ring_preserves_sequence_order_without_overflow() {
    let mut ring = NativeRing::new("ring-a", 16).expect("ring");
    let first = ring.append(4, 1);
    let second = ring.append(4, 2);
    assert_eq!(first.sequence, 0);
    assert_eq!(second.sequence, 1);
    assert!(second.dropped_ranges.is_empty());
  }

  #[test]
  fn ring_drops_oldest_range_on_overflow() {
    let mut ring = NativeRing::new("ring-a", 8).expect("ring");
    ring.append(4, 1);
    ring.append(4, 2);
    let third = ring.append(4, 3);
    assert_eq!(third.sequence, 2);
    assert_eq!(third.dropped_ranges.len(), 1);
    assert_eq!(third.dropped_ranges[0].start_sequence, 0);
    let telemetry = ring.telemetry();
    assert_eq!(telemetry.dropped_ranges.len(), 1);
    assert_eq!(telemetry.dropped_bytes, 4);
  }
}
