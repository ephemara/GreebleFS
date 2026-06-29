use std::collections::VecDeque;

use serde::{Deserialize, Serialize};

use super::StreamPacketMetadata;

const DEFAULT_REPLAY_RESPONSE_LIMIT: usize = 512;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "kebab-case")]
pub enum StreamOverflowPolicy {
  DropOldest,
}

impl Default for StreamOverflowPolicy {
  fn default() -> Self {
    Self::DropOldest
  }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct StreamRetentionPolicy {
  pub enabled: bool,
  pub max_messages: usize,
  pub max_bytes: usize,
  pub replay_response_limit: usize,
  pub overflow_policy: StreamOverflowPolicy,
}

impl StreamRetentionPolicy {
  pub fn normalized(self) -> Self {
    let max_messages = self.max_messages.clamp(1, 65_536);
    let max_bytes = self.max_bytes.clamp(1, 256 * 1024 * 1024);
    let replay_response_limit = self.replay_response_limit.clamp(1, max_messages);
    Self {
      enabled: self.enabled,
      max_messages,
      max_bytes,
      replay_response_limit,
      overflow_policy: self.overflow_policy,
    }
  }
}

impl Default for StreamRetentionPolicy {
  fn default() -> Self {
    Self {
      enabled: true,
      max_messages: 256,
      max_bytes: 1024 * 1024,
      replay_response_limit: DEFAULT_REPLAY_RESPONSE_LIMIT,
      overflow_policy: StreamOverflowPolicy::DropOldest,
    }
    .normalized()
  }
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct StreamOverflowSnapshot {
  pub overflowed: bool,
  pub overflow_count: u64,
  pub dropped_messages: u64,
  pub dropped_bytes: u64,
  pub first_dropped_sequence: Option<u64>,
  pub latest_dropped_sequence: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct StreamTelemetry {
  pub retained_messages: usize,
  pub retained_bytes: usize,
  pub oldest_sequence: Option<u64>,
  pub next_sequence: u64,
  pub total_written_messages: u64,
  pub total_written_bytes: u64,
  pub overflow: StreamOverflowSnapshot,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct StreamReplayGap {
  pub requested_sequence: u64,
  pub oldest_retained_sequence: u64,
  pub skipped_messages: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct StreamWriteOutcome {
  pub metadata: StreamPacketMetadata,
  pub retained: bool,
  pub evicted_messages: u64,
  pub evicted_bytes: u64,
  pub overflow: StreamOverflowSnapshot,
}

#[derive(Debug, Clone)]
pub struct StreamReplayEntry<T> {
  pub metadata: StreamPacketMetadata,
  pub message: T,
}

#[derive(Debug, Clone)]
pub struct StreamReplay<T> {
  pub messages: Vec<StreamReplayEntry<T>>,
  pub replay_gap: Option<StreamReplayGap>,
  pub telemetry: StreamTelemetry,
}

#[derive(Debug, Clone)]
struct RetainedStreamMessage<T> {
  metadata: StreamPacketMetadata,
  message: T,
}

#[derive(Debug, Clone)]
pub struct StreamRing<T> {
  policy: StreamRetentionPolicy,
  messages: VecDeque<RetainedStreamMessage<T>>,
  retained_bytes: usize,
  next_sequence: u64,
  total_written_messages: u64,
  total_written_bytes: u64,
  overflow: StreamOverflowSnapshot,
}

impl<T: Clone> StreamRing<T> {
  pub fn new(policy: StreamRetentionPolicy) -> Self {
    Self {
      policy: policy.normalized(),
      messages: VecDeque::new(),
      retained_bytes: 0,
      next_sequence: 0,
      total_written_messages: 0,
      total_written_bytes: 0,
      overflow: StreamOverflowSnapshot::default(),
    }
  }

  pub fn replay_from(&self, from_sequence: u64, limit: Option<usize>) -> StreamReplay<T> {
    let effective_limit = limit
      .unwrap_or(self.policy.replay_response_limit)
      .clamp(1, self.policy.replay_response_limit);
    let replay_gap = self.messages.front().and_then(|oldest| {
      (from_sequence < oldest.metadata.sequence).then_some(StreamReplayGap {
        requested_sequence: from_sequence,
        oldest_retained_sequence: oldest.metadata.sequence,
        skipped_messages: oldest.metadata.sequence.saturating_sub(from_sequence),
      })
    });
    let messages = self
      .messages
      .iter()
      .filter(|message| message.metadata.sequence >= from_sequence)
      .take(effective_limit)
      .map(|message| StreamReplayEntry {
        metadata: message.metadata.clone(),
        message: message.message.clone(),
      })
      .collect();

    StreamReplay {
      messages,
      replay_gap,
      telemetry: self.telemetry_snapshot(),
    }
  }

  pub fn telemetry_snapshot(&self) -> StreamTelemetry {
    StreamTelemetry {
      retained_messages: self.messages.len(),
      retained_bytes: self.retained_bytes,
      oldest_sequence: self
        .messages
        .front()
        .map(|message| message.metadata.sequence),
      next_sequence: self.next_sequence,
      total_written_messages: self.total_written_messages,
      total_written_bytes: self.total_written_bytes,
      overflow: self.overflow.clone(),
    }
  }

  pub fn write_with_metadata(
    &mut self,
    message: T,
    metadata: StreamPacketMetadata,
    byte_length: usize,
  ) -> StreamWriteOutcome {
    let byte_length = byte_length.max(1);
    self.next_sequence = self.next_sequence.max(metadata.sequence.saturating_add(1));
    self.total_written_messages = self.total_written_messages.saturating_add(1);
    self.total_written_bytes = self.total_written_bytes.saturating_add(byte_length as u64);

    if !self.policy.enabled {
      return StreamWriteOutcome {
        metadata,
        retained: false,
        evicted_messages: 0,
        evicted_bytes: 0,
        overflow: self.overflow.clone(),
      };
    }

    self.retained_bytes = self.retained_bytes.saturating_add(byte_length);
    self.messages.push_back(RetainedStreamMessage {
      metadata: metadata.clone(),
      message,
    });
    let (evicted_messages, evicted_bytes) = self.enforce_capacity();

    StreamWriteOutcome {
      metadata,
      retained: true,
      evicted_messages,
      evicted_bytes,
      overflow: self.overflow.clone(),
    }
  }

  fn enforce_capacity(&mut self) -> (u64, u64) {
    let mut evicted_messages = 0_u64;
    let mut evicted_bytes = 0_u64;

    loop {
      let count_over_capacity = self.messages.len() > self.policy.max_messages;
      let bytes_over_capacity =
        self.retained_bytes > self.policy.max_bytes && self.messages.len() > 1;
      if !count_over_capacity && !bytes_over_capacity {
        break;
      }

      let Some(evicted) = self.messages.pop_front() else {
        break;
      };
      self.retained_bytes = self
        .retained_bytes
        .saturating_sub(evicted.metadata.byte_length as usize);
      evicted_messages = evicted_messages.saturating_add(1);
      evicted_bytes = evicted_bytes.saturating_add(evicted.metadata.byte_length);
      self.record_eviction(evicted.metadata.sequence, evicted.metadata.byte_length);
    }

    (evicted_messages, evicted_bytes)
  }

  fn record_eviction(&mut self, sequence: u64, byte_length: u64) {
    self.overflow.overflowed = true;
    self.overflow.overflow_count = self.overflow.overflow_count.saturating_add(1);
    self.overflow.dropped_messages = self.overflow.dropped_messages.saturating_add(1);
    self.overflow.dropped_bytes = self.overflow.dropped_bytes.saturating_add(byte_length);
    if self.overflow.first_dropped_sequence.is_none() {
      self.overflow.first_dropped_sequence = Some(sequence);
    }
    self.overflow.latest_dropped_sequence = Some(sequence);
  }
}

#[cfg(test)]
mod tests {
  use super::{StreamRetentionPolicy, StreamRing};
  use crate::transport::StreamPacketMetadata;

  #[test]
  fn replay_reports_gap_after_overflow() {
    let mut ring = StreamRing::new(StreamRetentionPolicy {
      max_messages: 2,
      max_bytes: 1024,
      ..StreamRetentionPolicy::default()
    });

    for sequence in 0..3_u64 {
      ring.write_with_metadata(
        format!("message-{sequence}"),
        StreamPacketMetadata {
          stream_id: "stream-a".into(),
          sequence,
          emitted_at_epoch_ms: sequence,
          byte_length: 16,
        },
        16,
      );
    }

    let replay = ring.replay_from(0, Some(8));
    assert_eq!(replay.messages.len(), 2);
    assert_eq!(replay.replay_gap.expect("gap").oldest_retained_sequence, 1);
    assert_eq!(replay.telemetry.overflow.dropped_messages, 1);
  }
}
