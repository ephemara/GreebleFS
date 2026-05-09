use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::time::{SystemTime, UNIX_EPOCH};

const DEFAULT_MAX_FRAME_BYTES: usize = 32 * 1024;
const DEFAULT_REPLAY_RESPONSE_LIMIT: usize = 512;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "kebab-case")]
pub enum MessageRingOverflowPolicy {
    DropOldest,
}

impl Default for MessageRingOverflowPolicy {
    fn default() -> Self {
        Self::DropOldest
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct MessageRingPolicy {
    pub enabled: bool,
    pub max_messages: usize,
    pub max_bytes: usize,
    pub max_frame_bytes: usize,
    pub replay_response_limit: usize,
    pub overflow_policy: MessageRingOverflowPolicy,
}

impl MessageRingPolicy {
    pub fn normalized(self) -> Self {
        let max_frame_bytes = self.max_frame_bytes.clamp(1, 1024 * 1024);
        let max_messages = self.max_messages.clamp(1, 65_536);
        let max_bytes = self.max_bytes.clamp(max_frame_bytes, 256 * 1024 * 1024);
        let replay_response_limit = self.replay_response_limit.clamp(1, max_messages);
        Self {
            enabled: self.enabled,
            max_messages,
            max_bytes,
            max_frame_bytes,
            replay_response_limit,
            overflow_policy: self.overflow_policy,
        }
    }
}

impl Default for MessageRingPolicy {
    fn default() -> Self {
        Self {
            enabled: true,
            max_messages: 256,
            max_bytes: 1024 * 1024,
            max_frame_bytes: DEFAULT_MAX_FRAME_BYTES,
            replay_response_limit: DEFAULT_REPLAY_RESPONSE_LIMIT,
            overflow_policy: MessageRingOverflowPolicy::DropOldest,
        }
        .normalized()
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct MessageRingFrameMetadata {
    pub sequence: u64,
    pub emitted_at_epoch_ms: u64,
    pub byte_length: usize,
    pub frame_index: u32,
    pub frame_count: u32,
    pub chunked: bool,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct MessageRingOverflowSnapshot {
    pub overflowed: bool,
    pub overflow_count: u64,
    pub dropped_messages: u64,
    pub dropped_bytes: u64,
    pub first_dropped_sequence: Option<u64>,
    pub latest_dropped_sequence: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct MessageRingTelemetry {
    pub retained_messages: usize,
    pub retained_bytes: usize,
    pub oldest_sequence: Option<u64>,
    pub next_sequence: u64,
    pub total_written_messages: u64,
    pub total_written_bytes: u64,
    pub chunked_messages: u64,
    pub overflow: MessageRingOverflowSnapshot,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct MessageRingReplayGap {
    pub requested_sequence: u64,
    pub oldest_retained_sequence: u64,
    pub skipped_messages: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct MessageRingWriteOutcome {
    pub metadata: MessageRingFrameMetadata,
    pub retained: bool,
    pub evicted_messages: u64,
    pub evicted_bytes: u64,
    pub overflow: MessageRingOverflowSnapshot,
}

#[derive(Debug, Clone)]
pub struct MessageRingEntry<T> {
    pub metadata: MessageRingFrameMetadata,
    pub message: T,
}

#[derive(Debug, Clone)]
pub struct MessageRingReplay<T> {
    pub messages: Vec<MessageRingEntry<T>>,
    pub replay_gap: Option<MessageRingReplayGap>,
    pub telemetry: MessageRingTelemetry,
}

#[derive(Debug, Clone)]
struct RetainedMessage<T> {
    metadata: MessageRingFrameMetadata,
    message: T,
}

#[derive(Debug, Clone)]
pub struct MessageFramedRing<T> {
    policy: MessageRingPolicy,
    messages: VecDeque<RetainedMessage<T>>,
    retained_bytes: usize,
    next_sequence: u64,
    total_written_messages: u64,
    total_written_bytes: u64,
    chunked_messages: u64,
    overflow: MessageRingOverflowSnapshot,
}

impl<T: Clone> MessageFramedRing<T> {
    pub fn new(policy: MessageRingPolicy) -> Self {
        Self {
            policy: policy.normalized(),
            messages: VecDeque::new(),
            retained_bytes: 0,
            next_sequence: 0,
            total_written_messages: 0,
            total_written_bytes: 0,
            chunked_messages: 0,
            overflow: MessageRingOverflowSnapshot::default(),
        }
    }

    pub fn policy(&self) -> &MessageRingPolicy {
        &self.policy
    }

    pub fn write(&mut self, message: T, byte_length: usize) -> MessageRingWriteOutcome {
        let sequence = self.next_sequence;
        let emitted_at_epoch_ms = current_epoch_ms();
        self.write_with_sequence(message, sequence, emitted_at_epoch_ms, byte_length)
    }

    pub fn write_with_sequence(
        &mut self,
        message: T,
        sequence: u64,
        emitted_at_epoch_ms: u64,
        byte_length: usize,
    ) -> MessageRingWriteOutcome {
        let byte_length = byte_length.max(1);
        let frame_count = frame_count_for_bytes(byte_length, self.policy.max_frame_bytes);
        let metadata = MessageRingFrameMetadata {
            sequence,
            emitted_at_epoch_ms,
            byte_length,
            frame_index: 0,
            frame_count,
            chunked: frame_count > 1,
        };

        self.next_sequence = self.next_sequence.max(sequence.saturating_add(1));
        self.total_written_messages = self.total_written_messages.saturating_add(1);
        self.total_written_bytes = self.total_written_bytes.saturating_add(byte_length as u64);
        if metadata.chunked {
            self.chunked_messages = self.chunked_messages.saturating_add(1);
        }

        if !self.policy.enabled {
            return MessageRingWriteOutcome {
                metadata,
                retained: false,
                evicted_messages: 0,
                evicted_bytes: 0,
                overflow: self.overflow.clone(),
            };
        }

        self.retained_bytes = self.retained_bytes.saturating_add(byte_length);
        self.messages.push_back(RetainedMessage {
            metadata: metadata.clone(),
            message,
        });
        let (evicted_messages, evicted_bytes) = self.enforce_capacity();

        MessageRingWriteOutcome {
            metadata,
            retained: true,
            evicted_messages,
            evicted_bytes,
            overflow: self.overflow.clone(),
        }
    }

    pub fn replay_from(&self, from_sequence: u64, limit: Option<usize>) -> MessageRingReplay<T> {
        let effective_limit = limit
            .unwrap_or(self.policy.replay_response_limit)
            .clamp(1, self.policy.replay_response_limit);
        let replay_gap = self.messages.front().and_then(|oldest| {
            (from_sequence < oldest.metadata.sequence).then(|| MessageRingReplayGap {
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
            .map(|message| MessageRingEntry {
                metadata: message.metadata.clone(),
                message: message.message.clone(),
            })
            .collect();

        MessageRingReplay {
            messages,
            replay_gap,
            telemetry: self.telemetry_snapshot(),
        }
    }

    pub fn latest(&self, limit: Option<usize>) -> Vec<MessageRingEntry<T>> {
        let effective_limit = limit
            .unwrap_or(self.policy.replay_response_limit)
            .clamp(1, self.policy.replay_response_limit);
        let mut messages = self
            .messages
            .iter()
            .rev()
            .take(effective_limit)
            .map(|message| MessageRingEntry {
                metadata: message.metadata.clone(),
                message: message.message.clone(),
            })
            .collect::<Vec<_>>();
        messages.reverse();
        messages
    }

    pub fn telemetry_snapshot(&self) -> MessageRingTelemetry {
        MessageRingTelemetry {
            retained_messages: self.messages.len(),
            retained_bytes: self.retained_bytes,
            oldest_sequence: self
                .messages
                .front()
                .map(|message| message.metadata.sequence),
            next_sequence: self.next_sequence,
            total_written_messages: self.total_written_messages,
            total_written_bytes: self.total_written_bytes,
            chunked_messages: self.chunked_messages,
            overflow: self.overflow.clone(),
        }
    }

    pub fn clear_retained(&mut self) {
        self.messages.clear();
        self.retained_bytes = 0;
    }

    pub fn reset(&mut self) {
        self.clear_retained();
        self.next_sequence = 0;
        self.total_written_messages = 0;
        self.total_written_bytes = 0;
        self.chunked_messages = 0;
        self.overflow = MessageRingOverflowSnapshot::default();
    }

    fn enforce_capacity(&mut self) -> (u64, u64) {
        let mut evicted_messages = 0u64;
        let mut evicted_bytes = 0u64;

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
                .saturating_sub(evicted.metadata.byte_length);
            evicted_messages = evicted_messages.saturating_add(1);
            evicted_bytes = evicted_bytes.saturating_add(evicted.metadata.byte_length as u64);
            self.record_eviction(&evicted.metadata);
        }

        (evicted_messages, evicted_bytes)
    }

    fn record_eviction(&mut self, metadata: &MessageRingFrameMetadata) {
        self.overflow.overflowed = true;
        self.overflow.overflow_count = self.overflow.overflow_count.saturating_add(1);
        self.overflow.dropped_messages = self.overflow.dropped_messages.saturating_add(1);
        self.overflow.dropped_bytes = self
            .overflow
            .dropped_bytes
            .saturating_add(metadata.byte_length as u64);
        if self.overflow.first_dropped_sequence.is_none() {
            self.overflow.first_dropped_sequence = Some(metadata.sequence);
        }
        self.overflow.latest_dropped_sequence = Some(metadata.sequence);
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct MessageStreamsPolicy {
    pub enabled: bool,
    pub telemetry_enabled: bool,
    pub default_topic: MessageRingPolicy,
    pub terminal: MessageRingPolicy,
    pub task_output: MessageRingPolicy,
    pub telemetry: MessageRingPolicy,
}

impl Default for MessageStreamsPolicy {
    fn default() -> Self {
        let base = MessageRingPolicy::default();
        Self {
            enabled: true,
            telemetry_enabled: true,
            default_topic: MessageRingPolicy {
                max_messages: 256,
                max_bytes: 1024 * 1024,
                ..base.clone()
            }
            .normalized(),
            terminal: MessageRingPolicy {
                max_messages: 2048,
                max_bytes: 4 * 1024 * 1024,
                ..base.clone()
            }
            .normalized(),
            task_output: MessageRingPolicy {
                max_messages: 1024,
                max_bytes: 2 * 1024 * 1024,
                ..base.clone()
            }
            .normalized(),
            telemetry: MessageRingPolicy {
                max_messages: 400,
                max_bytes: 2 * 1024 * 1024,
                ..base
            }
            .normalized(),
        }
    }
}

impl MessageStreamsPolicy {
    #[cfg(not(test))]
    pub fn from_app(app: &tauri::AppHandle) -> Self {
        crate::usr::read_usr_text_file(
            app,
            "profiles/default/explorer-performance/greeblefs-core/explorer-performance.json",
        )
        .ok()
        .as_deref()
        .map(Self::from_explorer_performance_json)
        .unwrap_or_default()
    }

    pub fn from_explorer_performance_json(source: &str) -> Self {
        let Ok(document) = serde_json::from_str::<AuthoredExplorerPerformanceManifest>(source)
        else {
            return Self::default();
        };
        Self::from_authored(document.message_streams)
    }

    pub fn stream_policy_for_kind(&self, kind: &str) -> MessageRingPolicy {
        if !self.enabled {
            return MessageRingPolicy {
                enabled: false,
                ..self.default_topic.clone()
            }
            .normalized();
        }

        match kind {
            "terminal-output" => self.terminal.clone(),
            "task-output" => self.task_output.clone(),
            _ => self.default_topic.clone(),
        }
    }

    pub fn host_topic_policy(&self, topic: &str) -> MessageRingPolicy {
        if !self.enabled {
            return MessageRingPolicy {
                enabled: false,
                ..self.default_topic.clone()
            }
            .normalized();
        }

        match topic {
            "terminal.output" => self.terminal.clone(),
            "tasks.output" | "tasks.progress" => self.task_output.clone(),
            _ => self.default_topic.clone(),
        }
    }

    fn from_authored(authored: Option<AuthoredMessageStreamsPolicy>) -> Self {
        let defaults = Self::default();
        let Some(authored) = authored else {
            return defaults;
        };

        let enabled = authored.enabled.unwrap_or(defaults.enabled);
        let telemetry_enabled = authored
            .telemetry_enabled
            .unwrap_or(defaults.telemetry_enabled);
        let max_frame_bytes = clamp_usize(
            authored.max_frame_bytes,
            DEFAULT_MAX_FRAME_BYTES,
            1024,
            1024 * 1024,
        );
        let replay_response_limit = clamp_usize(
            authored.replay_response_limit,
            DEFAULT_REPLAY_RESPONSE_LIMIT,
            1,
            4096,
        );
        let overflow_policy = authored.overflow_policy.unwrap_or_default();

        Self {
            enabled,
            telemetry_enabled,
            default_topic: normalize_authored_ring_policy(
                authored.default_topic,
                defaults.default_topic,
                enabled,
                max_frame_bytes,
                replay_response_limit,
                overflow_policy,
            ),
            terminal: normalize_authored_ring_policy(
                authored.terminal,
                defaults.terminal,
                enabled,
                max_frame_bytes,
                replay_response_limit,
                overflow_policy,
            ),
            task_output: normalize_authored_ring_policy(
                authored.task_output,
                defaults.task_output,
                enabled,
                max_frame_bytes,
                replay_response_limit,
                overflow_policy,
            ),
            telemetry: normalize_authored_ring_policy(
                authored.telemetry,
                defaults.telemetry,
                enabled,
                max_frame_bytes,
                replay_response_limit,
                overflow_policy,
            ),
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuthoredExplorerPerformanceManifest {
    message_streams: Option<AuthoredMessageStreamsPolicy>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuthoredMessageStreamsPolicy {
    enabled: Option<bool>,
    telemetry_enabled: Option<bool>,
    max_frame_bytes: Option<usize>,
    replay_response_limit: Option<usize>,
    overflow_policy: Option<MessageRingOverflowPolicy>,
    default_topic: Option<AuthoredMessageRingPolicy>,
    terminal: Option<AuthoredMessageRingPolicy>,
    task_output: Option<AuthoredMessageRingPolicy>,
    telemetry: Option<AuthoredMessageRingPolicy>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuthoredMessageRingPolicy {
    max_messages: Option<usize>,
    max_bytes: Option<usize>,
}

fn normalize_authored_ring_policy(
    authored: Option<AuthoredMessageRingPolicy>,
    fallback: MessageRingPolicy,
    enabled: bool,
    max_frame_bytes: usize,
    replay_response_limit: usize,
    overflow_policy: MessageRingOverflowPolicy,
) -> MessageRingPolicy {
    let authored = authored.unwrap_or(AuthoredMessageRingPolicy {
        max_messages: None,
        max_bytes: None,
    });
    MessageRingPolicy {
        enabled,
        max_messages: clamp_usize(authored.max_messages, fallback.max_messages, 1, 65_536),
        max_bytes: clamp_usize(
            authored.max_bytes,
            fallback.max_bytes,
            max_frame_bytes,
            256 * 1024 * 1024,
        ),
        max_frame_bytes,
        replay_response_limit,
        overflow_policy,
    }
    .normalized()
}

fn clamp_usize(value: Option<usize>, fallback: usize, min: usize, max: usize) -> usize {
    value.unwrap_or(fallback).clamp(min, max)
}

fn frame_count_for_bytes(byte_length: usize, max_frame_bytes: usize) -> u32 {
    byte_length
        .div_ceil(max_frame_bytes.max(1))
        .clamp(1, u32::MAX as usize) as u32
}

fn current_epoch_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn small_policy(max_messages: usize, max_bytes: usize) -> MessageRingPolicy {
        MessageRingPolicy {
            enabled: true,
            max_messages,
            max_bytes,
            max_frame_bytes: 8,
            replay_response_limit: 32,
            overflow_policy: MessageRingOverflowPolicy::DropOldest,
        }
        .normalized()
    }

    #[test]
    fn preserves_fifo_sequence_order() {
        let mut ring = MessageFramedRing::new(small_policy(8, 1024));
        ring.write("a", 1);
        ring.write("b", 1);
        ring.write("c", 1);

        let replay = ring.replay_from(0, None);
        assert_eq!(
            replay
                .messages
                .iter()
                .map(|entry| entry.message)
                .collect::<Vec<_>>(),
            vec!["a", "b", "c"]
        );
        assert_eq!(
            replay
                .messages
                .iter()
                .map(|entry| entry.metadata.sequence)
                .collect::<Vec<_>>(),
            vec![0, 1, 2]
        );
    }

    #[test]
    fn evicts_by_count_capacity() {
        let mut ring = MessageFramedRing::new(small_policy(2, 1024));
        ring.write("a", 1);
        ring.write("b", 1);
        ring.write("c", 1);

        let replay = ring.replay_from(0, None);
        assert_eq!(replay.messages.len(), 2);
        assert_eq!(replay.messages[0].metadata.sequence, 1);
        assert!(replay.replay_gap.is_some());
        assert_eq!(ring.telemetry_snapshot().overflow.dropped_messages, 1);
    }

    #[test]
    fn evicts_by_byte_capacity() {
        let mut ring = MessageFramedRing::new(small_policy(8, 12));
        ring.write("a", 5);
        ring.write("b", 5);
        ring.write("c", 5);

        let replay = ring.replay_from(0, None);
        assert_eq!(
            replay
                .messages
                .iter()
                .map(|entry| entry.message)
                .collect::<Vec<_>>(),
            vec!["b", "c"]
        );
        assert_eq!(ring.telemetry_snapshot().retained_bytes, 10);
    }

    #[test]
    fn marks_large_messages_as_chunked_without_losing_boundaries() {
        let mut ring = MessageFramedRing::new(small_policy(8, 1024));
        let outcome = ring.write("payload", 19);

        assert!(outcome.metadata.chunked);
        assert_eq!(outcome.metadata.frame_count, 3);
        assert_eq!(ring.replay_from(0, None).messages[0].message, "payload");
    }

    #[test]
    fn replays_from_cursor_with_limit() {
        let mut ring = MessageFramedRing::new(small_policy(8, 1024));
        for value in ["a", "b", "c", "d"] {
            ring.write(value, 1);
        }

        let replay = ring.replay_from(1, Some(2));
        assert_eq!(
            replay
                .messages
                .iter()
                .map(|entry| entry.message)
                .collect::<Vec<_>>(),
            vec!["b", "c"]
        );
        assert!(replay.replay_gap.is_none());
    }

    #[test]
    fn reports_stale_cursor_gap() {
        let mut ring = MessageFramedRing::new(small_policy(2, 1024));
        for value in ["a", "b", "c", "d"] {
            ring.write(value, 1);
        }

        let replay = ring.replay_from(0, None);
        let gap = replay.replay_gap.expect("old cursor should report a gap");
        assert_eq!(gap.requested_sequence, 0);
        assert_eq!(gap.oldest_retained_sequence, 2);
        assert_eq!(gap.skipped_messages, 2);
    }

    #[test]
    fn telemetry_tracks_overflow_and_chunking() {
        let mut ring = MessageFramedRing::new(small_policy(1, 16));
        ring.write("a", 20);
        ring.write("b", 20);

        let telemetry = ring.telemetry_snapshot();
        assert_eq!(telemetry.total_written_messages, 2);
        assert_eq!(telemetry.chunked_messages, 2);
        assert_eq!(telemetry.overflow.dropped_messages, 1);
        assert_eq!(telemetry.overflow.first_dropped_sequence, Some(0));
        assert_eq!(telemetry.overflow.latest_dropped_sequence, Some(0));
    }

    #[test]
    fn clear_and_reset_are_explicit() {
        let mut ring = MessageFramedRing::new(small_policy(2, 1024));
        ring.write("a", 1);
        ring.clear_retained();
        assert_eq!(ring.telemetry_snapshot().retained_messages, 0);
        assert_eq!(ring.telemetry_snapshot().next_sequence, 1);

        ring.reset();
        assert_eq!(ring.telemetry_snapshot().next_sequence, 0);
        assert_eq!(ring.telemetry_snapshot().total_written_messages, 0);
    }

    #[test]
    fn policy_loads_from_explorer_performance_manifest() {
        let policy = MessageStreamsPolicy::from_explorer_performance_json(
            r#"{
                "messageStreams": {
                    "enabled": false,
                    "telemetryEnabled": false,
                    "maxFrameBytes": 65536,
                    "replayResponseLimit": 64,
                    "defaultTopic": { "maxMessages": 12, "maxBytes": 2048 },
                    "terminal": { "maxMessages": 99, "maxBytes": 4096 },
                    "taskOutput": { "maxMessages": 77, "maxBytes": 4096 },
                    "telemetry": { "maxMessages": 55, "maxBytes": 4096 }
                }
            }"#,
        );

        assert!(!policy.enabled);
        assert!(!policy.telemetry_enabled);
        assert_eq!(policy.default_topic.max_messages, 12);
        assert_eq!(policy.terminal.max_messages, 99);
        assert_eq!(policy.task_output.max_messages, 77);
        assert_eq!(policy.telemetry.max_messages, 55);
        assert_eq!(policy.terminal.max_frame_bytes, 65536);
        assert_eq!(policy.terminal.replay_response_limit, 64);
        assert!(!policy.terminal.enabled);
    }

    #[test]
    fn task_progress_host_topic_uses_task_output_policy() {
        let policy = MessageStreamsPolicy::default();

        assert_eq!(
            policy.host_topic_policy("tasks.progress"),
            policy.task_output
        );
        assert_eq!(policy.host_topic_policy("tasks.output"), policy.task_output);
    }
}
