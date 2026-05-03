use greeble_ipc_contracts::{IpcStreamHandle, IpcStreamPacketMetadata};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::message_ring::{
    MessageFramedRing, MessageRingFrameMetadata, MessageRingReplayGap, MessageRingTelemetry,
    MessageRingWriteOutcome, MessageStreamsPolicy,
};

#[derive(Debug, Clone)]
struct RegisteredStream {
    handle: IpcStreamHandle,
    next_sequence: u64,
    ring: MessageFramedRing<String>,
}

pub struct StreamRegistry {
    records: Mutex<HashMap<String, RegisteredStream>>,
    policy: MessageStreamsPolicy,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct IpcStreamReplayPacket {
    pub metadata: IpcStreamPacketMetadata,
    pub frame_metadata: MessageRingFrameMetadata,
    pub payload_json: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct IpcStreamReplayResponse {
    pub stream_id: String,
    pub packets: Vec<IpcStreamReplayPacket>,
    pub replay_gap: Option<MessageRingReplayGap>,
    pub telemetry: MessageRingTelemetry,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct IpcStreamStatus {
    pub handle: IpcStreamHandle,
    pub telemetry: MessageRingTelemetry,
}

impl StreamRegistry {
    pub fn new(policy: MessageStreamsPolicy) -> Self {
        Self {
            records: Mutex::new(HashMap::new()),
            policy,
        }
    }

    pub fn register(
        &self,
        kind: &str,
        stable_key: Option<&str>,
    ) -> Result<IpcStreamHandle, String> {
        let handle = IpcStreamHandle {
            id: stable_stream_id(kind, stable_key),
            kind: kind.to_string(),
            event_name: build_stream_event_name(kind, stable_key),
        };

        let mut records = self
            .records
            .lock()
            .map_err(|_| "IPC stream registry lock poisoned".to_string())?;
        let record = records
            .entry(handle.id.clone())
            .or_insert_with(|| RegisteredStream {
                handle: handle.clone(),
                next_sequence: 0,
                ring: MessageFramedRing::new(self.policy.stream_policy_for_kind(kind)),
            });
        Ok(record.handle.clone())
    }

    pub fn next_packet_metadata(&self, id: &str) -> Result<IpcStreamPacketMetadata, String> {
        let mut records = self
            .records
            .lock()
            .map_err(|_| "IPC stream registry lock poisoned".to_string())?;
        let record = records
            .get_mut(id)
            .ok_or_else(|| format!("Unknown IPC stream id: {id}"))?;
        let sequence = record.next_sequence;
        record.next_sequence += 1;
        Ok(IpcStreamPacketMetadata {
            stream_id: record.handle.id.clone(),
            sequence,
            emitted_at_epoch_ms: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|duration| duration.as_millis() as u64)
                .unwrap_or(0),
        })
    }

    pub fn publish_packet<TPayload, TBuild>(
        &self,
        id: &str,
        build: TBuild,
    ) -> Result<(TPayload, MessageRingWriteOutcome), String>
    where
        TPayload: serde::Serialize,
        TBuild: FnOnce(IpcStreamPacketMetadata) -> Result<TPayload, String>,
    {
        let mut records = self
            .records
            .lock()
            .map_err(|_| "IPC stream registry lock poisoned".to_string())?;
        let record = records
            .get_mut(id)
            .ok_or_else(|| format!("Unknown IPC stream id: {id}"))?;
        let sequence = record.next_sequence;
        record.next_sequence += 1;
        let metadata = IpcStreamPacketMetadata {
            stream_id: record.handle.id.clone(),
            sequence,
            emitted_at_epoch_ms: current_epoch_ms(),
        };
        let packet = build(metadata.clone())?;
        let payload_json = serde_json::to_string(&packet)
            .map_err(|error| format!("Failed to serialize IPC stream packet: {error}"))?;
        let outcome = record.ring.write_with_sequence(
            payload_json.clone(),
            metadata.sequence,
            metadata.emitted_at_epoch_ms,
            payload_json.len(),
        );
        Ok((packet, outcome))
    }

    pub fn replay(
        &self,
        id: &str,
        from_sequence: Option<u64>,
        limit: Option<usize>,
    ) -> Result<IpcStreamReplayResponse, String> {
        let records = self
            .records
            .lock()
            .map_err(|_| "IPC stream registry lock poisoned".to_string())?;
        let record = records
            .get(id)
            .ok_or_else(|| format!("Unknown IPC stream id: {id}"))?;
        let replay = record.ring.replay_from(from_sequence.unwrap_or(0), limit);
        let packets = replay
            .messages
            .into_iter()
            .map(|entry| IpcStreamReplayPacket {
                metadata: IpcStreamPacketMetadata {
                    stream_id: record.handle.id.clone(),
                    sequence: entry.metadata.sequence,
                    emitted_at_epoch_ms: entry.metadata.emitted_at_epoch_ms,
                },
                frame_metadata: entry.metadata,
                payload_json: entry.message,
            })
            .collect();

        Ok(IpcStreamReplayResponse {
            stream_id: record.handle.id.clone(),
            packets,
            replay_gap: replay.replay_gap,
            telemetry: replay.telemetry,
        })
    }

    pub fn status(&self, id: &str) -> Result<IpcStreamStatus, String> {
        let records = self
            .records
            .lock()
            .map_err(|_| "IPC stream registry lock poisoned".to_string())?;
        let record = records
            .get(id)
            .ok_or_else(|| format!("Unknown IPC stream id: {id}"))?;
        Ok(IpcStreamStatus {
            handle: record.handle.clone(),
            telemetry: record.ring.telemetry_snapshot(),
        })
    }

    pub fn release(&self, id: &str) -> Result<(), String> {
        let mut records = self
            .records
            .lock()
            .map_err(|_| "IPC stream registry lock poisoned".to_string())?;
        records.remove(id);
        Ok(())
    }
}

impl Default for StreamRegistry {
    fn default() -> Self {
        Self::new(MessageStreamsPolicy::default())
    }
}

fn stable_stream_id(kind: &str, stable_key: Option<&str>) -> String {
    let mut hasher = Sha256::new();
    hasher.update(kind.as_bytes());
    hasher.update(stable_key.unwrap_or_default().as_bytes());
    format!("stream-{:x}", hasher.finalize())
}

fn build_stream_event_name(kind: &str, stable_key: Option<&str>) -> String {
    let suffix = stable_key
        .unwrap_or("anonymous")
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || character == '-' || character == '_' {
                character
            } else {
                '-'
            }
        })
        .collect::<String>();
    format!("ipc-stream-{kind}-{suffix}")
}

fn current_epoch_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::StreamRegistry;
    use crate::message_ring::{MessageRingPolicy, MessageStreamsPolicy};

    #[test]
    fn stream_packet_metadata_is_ordered_per_stream() {
        let registry = StreamRegistry::default();
        let handle = registry
            .register("terminal-output", Some("preview-pane-0"))
            .expect("stream should register");
        let first = registry
            .next_packet_metadata(&handle.id)
            .expect("first packet should register");
        let second = registry
            .next_packet_metadata(&handle.id)
            .expect("second packet should register");

        assert_eq!(first.sequence, 0);
        assert_eq!(second.sequence, 1);
        assert_eq!(first.stream_id, second.stream_id);
    }

    #[test]
    fn stream_packets_are_retained_for_cursor_replay() {
        let registry = StreamRegistry::default();
        let handle = registry
            .register("terminal-output", Some("preview-pane-0"))
            .expect("stream should register");

        for value in ["one", "two", "three"] {
            registry
                .publish_packet(&handle.id, |metadata| {
                    Ok(serde_json::json!({
                        "metadata": metadata,
                        "data": value,
                    }))
                })
                .expect("packet should publish");
        }

        let replay = registry
            .replay(&handle.id, Some(1), Some(8))
            .expect("replay should succeed");
        assert_eq!(replay.packets.len(), 2);
        assert_eq!(replay.packets[0].metadata.sequence, 1);
        assert!(replay.packets[0].payload_json.contains("two"));
    }

    #[test]
    fn stream_replay_reports_overflow_gap() {
        let mut policy = MessageStreamsPolicy::default();
        policy.terminal = MessageRingPolicy {
            max_messages: 2,
            max_bytes: 1024,
            ..policy.terminal.clone()
        }
        .normalized();
        let registry = StreamRegistry::new(policy);
        let handle = registry
            .register("terminal-output", Some("preview-pane-0"))
            .expect("stream should register");

        for value in ["one", "two", "three"] {
            registry
                .publish_packet(&handle.id, |metadata| {
                    Ok(serde_json::json!({
                        "metadata": metadata,
                        "data": value,
                    }))
                })
                .expect("packet should publish");
        }

        let replay = registry
            .replay(&handle.id, Some(0), Some(8))
            .expect("replay should succeed");
        assert_eq!(replay.packets.len(), 2);
        assert_eq!(replay.replay_gap.expect("gap").oldest_retained_sequence, 1);
        assert_eq!(replay.telemetry.overflow.dropped_messages, 1);
    }

    #[test]
    fn stream_release_removes_status_and_replay_state() {
        let registry = StreamRegistry::default();
        let handle = registry
            .register("terminal-output", Some("preview-pane-0"))
            .expect("stream should register");
        registry
            .publish_packet(&handle.id, |metadata| {
                Ok(serde_json::json!({
                    "metadata": metadata,
                    "data": "hello",
                }))
            })
            .expect("packet should publish");

        registry
            .release(&handle.id)
            .expect("release should succeed");
        assert!(registry.status(&handle.id).is_err());
        assert!(registry.replay(&handle.id, Some(0), Some(1)).is_err());
    }
}
