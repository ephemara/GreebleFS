use greeble_ipc_contracts::{IpcStreamHandle, IpcStreamPacketMetadata};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone)]
struct RegisteredStream {
    handle: IpcStreamHandle,
    next_sequence: u64,
}

#[derive(Default)]
pub struct StreamRegistry {
    records: Mutex<HashMap<String, RegisteredStream>>,
}

impl StreamRegistry {
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

    pub fn release(&self, id: &str) -> Result<(), String> {
        let mut records = self
            .records
            .lock()
            .map_err(|_| "IPC stream registry lock poisoned".to_string())?;
        records.remove(id);
        Ok(())
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

#[cfg(test)]
mod tests {
    use super::StreamRegistry;

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
}
