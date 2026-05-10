//! Host-owned extension event bus and ambient explorer execution-context cache.
//!
//! This module centralizes the explorer-native event substrate used by
//! sidecars, panels, preview lanes, and future workbenches. Rust owns the
//! durable event contract and subscription lifecycle; transports such as
//! browser IPC streams and stdio sidecars simply plug into the same bus.

use std::collections::HashMap;
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::{SystemTime, UNIX_EPOCH};

use greeble_ipc_contracts::IpcStreamHandle;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use uuid::Uuid;

use crate::message_ring::{MessageFramedRing, MessageRingTelemetry, MessageStreamsPolicy};
use crate::runtime_pipeline::extension_host::{ExecutionContextSnapshot, FileTypeDescriptor};

pub const HOST_EVENT_TOPIC_SELECTION_CHANGED: &str = "selection.changed";
pub const HOST_EVENT_TOPIC_PREVIEW_SESSION_CHANGED: &str = "preview.session.changed";
pub const HOST_EVENT_TOPIC_CWD_CHANGED: &str = "cwd.changed";
pub const HOST_EVENT_TOPIC_EXPLORER_LOCATION_CHANGED: &str = "explorer.location.changed";
pub const HOST_EVENT_TOPIC_EXPLORER_PANE_FOCUSED: &str = "explorer.pane.focused";
pub const HOST_EVENT_TOPIC_EXPLORER_WORKSPACE_CHANGED: &str = "explorer.workspace.changed";
pub const HOST_EVENT_TOPIC_TASKS_OUTPUT: &str = "tasks.output";
pub const HOST_EVENT_TOPIC_TASKS_PROGRESS: &str = "tasks.progress";
pub const HOST_EVENT_TOPIC_FILES_WATCH: &str = "files.watch";
pub const HOST_EVENT_TOPIC_TERMINAL_OUTPUT: &str = "terminal.output";
pub const HOST_EVENT_TOPIC_TERMINAL_SHELL_INTEGRATION_CHANGED: &str =
    "terminal.shell_integration.changed";
pub const HOST_EVENT_TOPIC_REPO_STATUS_CHANGED: &str = "repo.status.changed";

#[derive(Debug, Clone, Default, Serialize, Deserialize, specta::Type, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct HostTopicDescriptor {
    pub topic: String,
    pub delivery: String,
    pub default_scope: String,
    pub supports_snapshot: bool,
    pub replay_depth: u32,
    pub activation_triggers: Vec<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, specta::Type, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct HostEventFilter {
    pub pane_id: Option<String>,
    pub workspace_tab_id: Option<String>,
    pub path_prefix: Option<String>,
    pub task_id: Option<String>,
    pub runtime_id: Option<String>,
    pub topic_prefix: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, specta::Type, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct HostSubscriptionRequest {
    pub topics: Vec<String>,
    pub filters: Option<HostEventFilter>,
    pub include_snapshot: bool,
    pub replay_from: Option<u64>,
    pub delivery_override: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, specta::Type, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct HostEventScope {
    pub pane_id: Option<String>,
    pub workspace_tab_id: Option<String>,
    pub path: Option<String>,
    pub task_id: Option<String>,
    pub runtime_id: Option<String>,
    pub extension_id: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, specta::Type, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct HostEventEnvelope {
    pub event_id: String,
    pub subscription_id: Option<String>,
    pub topic: String,
    pub sequence: u64,
    pub emitted_at_ms: u64,
    pub delivery: String,
    pub scope: HostEventScope,
    pub payload_json: Option<String>,
    pub execution_context: Option<ExecutionContextSnapshot>,
    pub snapshot: bool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, specta::Type, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct HostContextSyncRequest {
    pub snapshot: ExecutionContextSnapshot,
    pub is_active: bool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, specta::Type, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct HostPublishEventRequest {
    pub topic: String,
    pub payload_json: Option<String>,
}

type HostEventSink = Arc<dyn Fn(HostEventEnvelope) + Send + Sync>;

struct HostEventSubscriptionRecord {
    subscription_id: String,
    request: HostSubscriptionRequest,
    transport: String,
    stream_handle: Option<IpcStreamHandle>,
    sink: HostEventSink,
}

#[derive(Default)]
struct HostEventBusRecords {
    active_execution_context: Option<ExecutionContextSnapshot>,
    contexts_by_location: HashMap<String, ExecutionContextSnapshot>,
    subscriptions: HashMap<String, HostEventSubscriptionRecord>,
    latest_by_topic: HashMap<String, HostEventEnvelope>,
    history_by_topic: HashMap<String, MessageFramedRing<HostEventEnvelope>>,
    next_sequence: u64,
}

pub struct HostEventBusState {
    records: Mutex<HostEventBusRecords>,
    message_stream_policy: MessageStreamsPolicy,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HostEventTopicRingTelemetry {
    pub topic: String,
    pub latest_sequence: Option<u64>,
    pub telemetry: MessageRingTelemetry,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HostEventRingTelemetrySnapshot {
    pub subscription_count: usize,
    pub latest_topic_count: usize,
    pub history_topic_count: usize,
    pub next_sequence: u64,
    pub topics: Vec<HostEventTopicRingTelemetry>,
}

impl HostEventBusState {
    pub fn new(message_stream_policy: MessageStreamsPolicy) -> Self {
        Self {
            records: Mutex::new(HostEventBusRecords::default()),
            message_stream_policy,
        }
    }

    #[cfg(not(test))]
    pub fn from_app(app: &AppHandle) -> Self {
        Self::new(MessageStreamsPolicy::from_app(app))
    }

    fn records_guard(&self) -> MutexGuard<'_, HostEventBusRecords> {
        self.records
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    pub fn topic_catalog(&self) -> Vec<HostTopicDescriptor> {
        builtin_host_topic_catalog()
    }

    pub fn ring_telemetry_snapshot(&self) -> HostEventRingTelemetrySnapshot {
        let records = self.records_guard();
        let mut topics = records
            .history_by_topic
            .iter()
            .map(|(topic, ring)| HostEventTopicRingTelemetry {
                topic: topic.clone(),
                latest_sequence: records
                    .latest_by_topic
                    .get(topic)
                    .map(|event| event.sequence),
                telemetry: ring.telemetry_snapshot(),
            })
            .collect::<Vec<_>>();
        topics.sort_by(|left, right| left.topic.cmp(&right.topic));

        HostEventRingTelemetrySnapshot {
            subscription_count: records.subscriptions.len(),
            latest_topic_count: records.latest_by_topic.len(),
            history_topic_count: records.history_by_topic.len(),
            next_sequence: records.next_sequence,
            topics,
        }
    }

    pub fn active_execution_context_snapshot(&self) -> Option<ExecutionContextSnapshot> {
        self.records_guard().active_execution_context.clone()
    }

    pub fn sync_execution_context(&self, request: HostContextSyncRequest) -> Result<(), String> {
        let mut next_snapshot = request.snapshot;
        if next_snapshot.active_file_type.is_none() {
            next_snapshot.active_file_type = infer_active_file_type_descriptor(&next_snapshot);
        }
        if next_snapshot.revision.trim().is_empty() {
            next_snapshot.revision = build_execution_context_revision(&next_snapshot);
        }

        let mut records = self.records_guard();
        if let Some(location_key) = build_context_location_key(&next_snapshot) {
            records
                .contexts_by_location
                .insert(location_key, next_snapshot.clone());
        }

        if !request.is_active {
            return Ok(());
        }

        let previous_snapshot = records.active_execution_context.clone();
        let active_changed = previous_snapshot.as_ref() != Some(&next_snapshot);
        records.active_execution_context = Some(next_snapshot.clone());
        drop(records);

        if !active_changed {
            return Ok(());
        }

        self.emit_context_diff_events(previous_snapshot.as_ref(), &next_snapshot)?;
        Ok(())
    }

    pub fn subscribe_browser(
        &self,
        app: AppHandle,
        request: HostSubscriptionRequest,
    ) -> Result<crate::runtime_pipeline::extension_host::HostSubscription, String> {
        let subscription_id = Uuid::new_v4().to_string();
        let stream_handle =
            tauri::transport::register_stream(&app, "host-events", Some(subscription_id.as_str()))?;
        let stream_handle = IpcStreamHandle {
            id: stream_handle.id,
            kind: stream_handle.kind,
        };
        let app_handle = app.clone();
        let stream_id = stream_handle.id.clone();
        let sink: HostEventSink = Arc::new(move |event| {
            let _ =
                tauri::transport::publish_stream_payload(&app_handle, stream_id.as_str(), event);
        });
        self.register_subscription(
            subscription_id,
            request,
            "ipc-stream".to_string(),
            Some(stream_handle.clone()),
            sink,
        )
    }

    pub fn subscribe_callback(
        &self,
        request: HostSubscriptionRequest,
        transport: String,
        sink: HostEventSink,
    ) -> Result<crate::runtime_pipeline::extension_host::HostSubscription, String> {
        let subscription_id = Uuid::new_v4().to_string();
        self.register_subscription(subscription_id, request, transport, None, sink)
    }

    fn register_subscription(
        &self,
        subscription_id: String,
        request: HostSubscriptionRequest,
        transport: String,
        stream_handle: Option<IpcStreamHandle>,
        sink: HostEventSink,
    ) -> Result<crate::runtime_pipeline::extension_host::HostSubscription, String> {
        let mut records = self.records_guard();
        let record = HostEventSubscriptionRecord {
            subscription_id: subscription_id.clone(),
            request: request.clone(),
            transport: transport.clone(),
            stream_handle: stream_handle.clone(),
            sink,
        };
        records
            .subscriptions
            .insert(subscription_id.clone(), record);
        Ok(crate::runtime_pipeline::extension_host::HostSubscription {
            subscription_id,
            topics: request.topics,
            transport,
            supported: true,
            stream_handle,
        })
    }

    pub fn unsubscribe(
        &self,
        app: &AppHandle,
        subscription_id: &str,
    ) -> Option<crate::runtime_pipeline::extension_host::HostSubscription> {
        let mut records = self.records_guard();
        let record = records.subscriptions.remove(subscription_id)?;
        if let Some(stream_handle) = &record.stream_handle {
            let _ = tauri::transport::close_stream(app, &stream_handle.id);
        }
        Some(crate::runtime_pipeline::extension_host::HostSubscription {
            subscription_id: record.subscription_id,
            topics: record.request.topics,
            transport: record.transport,
            supported: true,
            stream_handle: record.stream_handle,
        })
    }

    pub fn snapshots_for_request(
        &self,
        request: &HostSubscriptionRequest,
    ) -> Vec<HostEventEnvelope> {
        let records = self.records_guard();
        let mut events = if request.include_snapshot {
            build_context_snapshot_events(records.active_execution_context.as_ref())
        } else {
            Vec::new()
        };

        if let Some(replay_from) = request.replay_from {
            for ring in records.history_by_topic.values() {
                events.extend(
                    ring.replay_from(replay_from, None)
                        .messages
                        .into_iter()
                        .map(|entry| entry.message),
                );
            }
            events.sort_by(|left, right| {
                left.sequence
                    .cmp(&right.sequence)
                    .then_with(|| left.event_id.cmp(&right.event_id))
            });
        } else {
            events.extend(
                records
                    .latest_by_topic
                    .values()
                    .filter(|event| !is_context_snapshot_topic(event.topic.as_str()))
                    .cloned(),
            );
        }

        filter_host_events(events, request, None)
    }

    pub fn publish_extension_event(
        &self,
        topic: &str,
        payload_json: Option<String>,
        execution_context: Option<ExecutionContextSnapshot>,
        extension_id_hint: Option<&str>,
    ) -> Result<HostEventEnvelope, String> {
        let trimmed_topic = topic.trim();
        if trimmed_topic.is_empty() {
            return Err("events.publish requires a non-empty topic.".to_string());
        }
        if trimmed_topic.starts_with("host.") {
            return Err("events.publish may not target reserved `host.*` namespaces.".to_string());
        }
        if !trimmed_topic.starts_with("ext.") {
            return Err(
                "events.publish requires namespaced topics under `ext.<extensionId>.*`."
                    .to_string(),
            );
        }
        if let Some(extension_id_hint) = extension_id_hint {
            let expected_prefix = format!("ext.{}.", extension_id_hint.trim());
            if !extension_id_hint.trim().is_empty()
                && !trimmed_topic.starts_with(expected_prefix.as_str())
            {
                return Err(format!(
                    "events.publish topic `{trimmed_topic}` must stay within `{expected_prefix}*`."
                ));
            }
        }
        self.publish_event(
            trimmed_topic,
            payload_json,
            execution_context,
            build_scope_from_context(None),
            "push".to_string(),
            false,
        )
    }

    pub fn publish_host_topic(
        &self,
        topic: &str,
        payload_json: Option<String>,
        execution_context: Option<ExecutionContextSnapshot>,
        scope: HostEventScope,
        snapshot: bool,
    ) -> Result<HostEventEnvelope, String> {
        self.publish_event(
            topic,
            payload_json,
            execution_context,
            scope,
            "push".to_string(),
            snapshot,
        )
    }

    fn emit_context_diff_events(
        &self,
        previous_snapshot: Option<&ExecutionContextSnapshot>,
        next_snapshot: &ExecutionContextSnapshot,
    ) -> Result<(), String> {
        let next_scope = build_scope_from_context(Some(next_snapshot));

        if previous_snapshot.and_then(|snapshot| snapshot.workspace_tab_id.clone())
            != next_snapshot.workspace_tab_id
        {
            self.publish_event(
                HOST_EVENT_TOPIC_EXPLORER_WORKSPACE_CHANGED,
                encode_optional_payload(&serde_json::json!({
                    "workspaceTabId": next_snapshot.workspace_tab_id,
                    "revision": next_snapshot.revision,
                }))?,
                Some(next_snapshot.clone()),
                next_scope.clone(),
                "push".to_string(),
                false,
            )?;
        }

        if previous_snapshot.and_then(|snapshot| snapshot.pane_id.clone()) != next_snapshot.pane_id
        {
            self.publish_event(
                HOST_EVENT_TOPIC_EXPLORER_PANE_FOCUSED,
                encode_optional_payload(&serde_json::json!({
                    "paneId": next_snapshot.pane_id,
                    "workspaceTabId": next_snapshot.workspace_tab_id,
                    "revision": next_snapshot.revision,
                }))?,
                Some(next_snapshot.clone()),
                next_scope.clone(),
                "push".to_string(),
                false,
            )?;
        }

        if previous_snapshot.and_then(|snapshot| snapshot.active_directory.clone())
            != next_snapshot.active_directory
        {
            self.publish_event(
                HOST_EVENT_TOPIC_EXPLORER_LOCATION_CHANGED,
                encode_optional_payload(&serde_json::json!({
                    "activeDirectory": next_snapshot.active_directory,
                    "revision": next_snapshot.revision,
                }))?,
                Some(next_snapshot.clone()),
                next_scope.clone(),
                "push".to_string(),
                false,
            )?;
        }

        if previous_snapshot.and_then(|snapshot| snapshot.cwd.clone()) != next_snapshot.cwd {
            self.publish_event(
                HOST_EVENT_TOPIC_CWD_CHANGED,
                encode_optional_payload(&serde_json::json!({
                    "cwd": next_snapshot.cwd,
                    "revision": next_snapshot.revision,
                }))?,
                Some(next_snapshot.clone()),
                next_scope.clone(),
                "push".to_string(),
                false,
            )?;
        }

        if previous_snapshot.and_then(|snapshot| snapshot.preview_session.clone())
            != next_snapshot.preview_session
        {
            self.publish_event(
                HOST_EVENT_TOPIC_PREVIEW_SESSION_CHANGED,
                encode_optional_payload(&next_snapshot.preview_session)?,
                Some(next_snapshot.clone()),
                next_scope.clone(),
                "push".to_string(),
                false,
            )?;
        }

        if previous_snapshot.map(selection_identity) != Some(selection_identity(next_snapshot)) {
            self.publish_event(
                HOST_EVENT_TOPIC_SELECTION_CHANGED,
                encode_optional_payload(&serde_json::json!({
                    "focusedEntry": next_snapshot.focused_entry,
                    "selectedEntries": next_snapshot.selected_entries,
                    "revision": next_snapshot.revision,
                }))?,
                Some(next_snapshot.clone()),
                next_scope,
                "push".to_string(),
                false,
            )?;
        }

        Ok(())
    }

    fn publish_event(
        &self,
        topic: &str,
        payload_json: Option<String>,
        execution_context: Option<ExecutionContextSnapshot>,
        scope: HostEventScope,
        delivery: String,
        snapshot: bool,
    ) -> Result<HostEventEnvelope, String> {
        let topic_descriptor = builtin_host_topic_catalog()
            .into_iter()
            .find(|descriptor| descriptor.topic == topic)
            .unwrap_or_else(|| HostTopicDescriptor {
                topic: topic.to_string(),
                delivery: delivery.clone(),
                default_scope: "ambient".to_string(),
                supports_snapshot: true,
                replay_depth: 64,
                activation_triggers: Vec::new(),
            });

        let history_policy = self.message_stream_policy.host_topic_policy(topic);
        let mut records = self.records_guard();
        let next_sequence = records.next_sequence;
        records.next_sequence += 1;
        let envelope = HostEventEnvelope {
            event_id: Uuid::new_v4().to_string(),
            subscription_id: None,
            topic: topic.to_string(),
            sequence: next_sequence,
            emitted_at_ms: current_epoch_ms(),
            delivery: if delivery.trim().is_empty() {
                topic_descriptor.delivery.clone()
            } else {
                delivery
            },
            scope,
            payload_json,
            execution_context,
            snapshot,
        };

        records
            .latest_by_topic
            .insert(envelope.topic.clone(), envelope.clone());
        let history_byte_length = serde_json::to_vec(&envelope)
            .map(|bytes| bytes.len())
            .unwrap_or_else(|_| {
                envelope
                    .payload_json
                    .as_ref()
                    .map_or(1, |payload| payload.len())
            });
        records
            .history_by_topic
            .entry(envelope.topic.clone())
            .or_insert_with(|| MessageFramedRing::new(history_policy))
            .write_with_sequence(
                envelope.clone(),
                envelope.sequence,
                envelope.emitted_at_ms,
                history_byte_length,
            );

        let subscribers: Vec<(String, HostSubscriptionRequest, HostEventSink)> = records
            .subscriptions
            .values()
            .map(|record| {
                (
                    record.subscription_id.clone(),
                    record.request.clone(),
                    Arc::clone(&record.sink),
                )
            })
            .collect();
        drop(records);

        for (subscription_id, request, sink) in subscribers {
            let delivered = filter_host_events(
                vec![envelope.clone()],
                &request,
                Some(subscription_id.as_str()),
            );
            for event in delivered {
                sink(event);
            }
        }

        Ok(envelope)
    }
}

impl Default for HostEventBusState {
    fn default() -> Self {
        Self::new(MessageStreamsPolicy::default())
    }
}

pub fn builtin_host_topic_catalog() -> Vec<HostTopicDescriptor> {
    vec![
        host_topic_descriptor(
            HOST_EVENT_TOPIC_SELECTION_CHANGED,
            "stream",
            "active-pane",
            true,
            24,
            &["selection"],
        ),
        host_topic_descriptor(
            HOST_EVENT_TOPIC_PREVIEW_SESSION_CHANGED,
            "stream",
            "active-pane",
            true,
            24,
            &["preview"],
        ),
        host_topic_descriptor(
            HOST_EVENT_TOPIC_CWD_CHANGED,
            "stream",
            "active-pane",
            true,
            24,
            &["cwd"],
        ),
        host_topic_descriptor(
            HOST_EVENT_TOPIC_EXPLORER_LOCATION_CHANGED,
            "stream",
            "active-pane",
            true,
            24,
            &["explorer-location"],
        ),
        host_topic_descriptor(
            HOST_EVENT_TOPIC_EXPLORER_PANE_FOCUSED,
            "stream",
            "active-pane",
            true,
            24,
            &["pane-focus"],
        ),
        host_topic_descriptor(
            HOST_EVENT_TOPIC_EXPLORER_WORKSPACE_CHANGED,
            "stream",
            "active-workspace-tab",
            true,
            24,
            &["workspace-focus"],
        ),
        host_topic_descriptor(
            HOST_EVENT_TOPIC_TASKS_OUTPUT,
            "stream",
            "task",
            true,
            128,
            &["task-start"],
        ),
        host_topic_descriptor(
            HOST_EVENT_TOPIC_TASKS_PROGRESS,
            "stream",
            "task",
            true,
            64,
            &["task-start"],
        ),
        host_topic_descriptor(
            HOST_EVENT_TOPIC_FILES_WATCH,
            "stream",
            "path",
            true,
            128,
            &["file-watch"],
        ),
        host_topic_descriptor(
            HOST_EVENT_TOPIC_TERMINAL_OUTPUT,
            "stream",
            "terminal",
            true,
            128,
            &["terminal"],
        ),
        host_topic_descriptor(
            HOST_EVENT_TOPIC_TERMINAL_SHELL_INTEGRATION_CHANGED,
            "stream",
            "terminal",
            true,
            64,
            &["terminal"],
        ),
        host_topic_descriptor(
            HOST_EVENT_TOPIC_REPO_STATUS_CHANGED,
            "stream",
            "repo",
            true,
            64,
            &["repo"],
        ),
    ]
}

fn host_topic_descriptor(
    topic: &str,
    delivery: &str,
    default_scope: &str,
    supports_snapshot: bool,
    replay_depth: u32,
    activation_triggers: &[&str],
) -> HostTopicDescriptor {
    HostTopicDescriptor {
        topic: topic.to_string(),
        delivery: delivery.to_string(),
        default_scope: default_scope.to_string(),
        supports_snapshot,
        replay_depth,
        activation_triggers: activation_triggers
            .iter()
            .map(|entry| (*entry).to_string())
            .collect(),
    }
}

fn encode_optional_payload<T: Serialize>(value: &T) -> Result<Option<String>, String> {
    serde_json::to_string(value)
        .map(Some)
        .map_err(|error| format!("Failed to encode host event payload: {error}"))
}

fn current_epoch_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

fn filter_host_events(
    events: Vec<HostEventEnvelope>,
    request: &HostSubscriptionRequest,
    subscription_id: Option<&str>,
) -> Vec<HostEventEnvelope> {
    events
        .into_iter()
        .filter(|event| topic_matches_request(event.topic.as_str(), &request.topics))
        .filter(|event| filters_match_event(event, request.filters.as_ref()))
        .map(|mut event| {
            if let Some(subscription_id) = subscription_id {
                event.subscription_id = Some(subscription_id.to_string());
            }
            event
        })
        .collect()
}

fn topic_matches_request(topic: &str, requested_topics: &[String]) -> bool {
    if requested_topics.is_empty() {
        return true;
    }
    requested_topics.iter().any(|requested| {
        let trimmed = requested.trim();
        if trimmed.is_empty() {
            return false;
        }
        if let Some(prefix) = trimmed.strip_suffix('*') {
            return topic.starts_with(prefix);
        }
        topic == trimmed
    })
}

fn filters_match_event(event: &HostEventEnvelope, filters: Option<&HostEventFilter>) -> bool {
    let Some(filters) = filters else {
        return true;
    };

    if let Some(topic_prefix) = filters.topic_prefix.as_deref() {
        let trimmed = topic_prefix.trim();
        if !trimmed.is_empty() && !event.topic.starts_with(trimmed) {
            return false;
        }
    }
    if let Some(pane_id) = filters.pane_id.as_deref() {
        if event.scope.pane_id.as_deref() != Some(pane_id) {
            return false;
        }
    }
    if let Some(workspace_tab_id) = filters.workspace_tab_id.as_deref() {
        if event.scope.workspace_tab_id.as_deref() != Some(workspace_tab_id) {
            return false;
        }
    }
    if let Some(path_prefix) = filters.path_prefix.as_deref() {
        let trimmed = path_prefix.trim();
        if !trimmed.is_empty()
            && !event
                .scope
                .path
                .as_deref()
                .is_some_and(|path| path.starts_with(trimmed))
        {
            return false;
        }
    }
    if let Some(task_id) = filters.task_id.as_deref() {
        if event.scope.task_id.as_deref() != Some(task_id) {
            return false;
        }
    }
    if let Some(runtime_id) = filters.runtime_id.as_deref() {
        if event.scope.runtime_id.as_deref() != Some(runtime_id) {
            return false;
        }
    }
    true
}

fn build_context_snapshot_events(
    active_execution_context: Option<&ExecutionContextSnapshot>,
) -> Vec<HostEventEnvelope> {
    let Some(active_execution_context) = active_execution_context.cloned() else {
        return Vec::new();
    };
    let mut events = Vec::new();
    let scope = build_scope_from_context(Some(&active_execution_context));
    let revision = active_execution_context.revision.clone();
    events.push(HostEventEnvelope {
        event_id: Uuid::new_v4().to_string(),
        subscription_id: None,
        topic: HOST_EVENT_TOPIC_SELECTION_CHANGED.to_string(),
        sequence: 0,
        emitted_at_ms: current_epoch_ms(),
        delivery: "snapshot".to_string(),
        scope: scope.clone(),
        payload_json: encode_optional_payload(&serde_json::json!({
            "focusedEntry": active_execution_context.focused_entry,
            "selectedEntries": active_execution_context.selected_entries,
            "revision": revision,
        }))
        .ok()
        .flatten(),
        execution_context: Some(active_execution_context.clone()),
        snapshot: true,
    });
    events.push(HostEventEnvelope {
        event_id: Uuid::new_v4().to_string(),
        subscription_id: None,
        topic: HOST_EVENT_TOPIC_PREVIEW_SESSION_CHANGED.to_string(),
        sequence: 0,
        emitted_at_ms: current_epoch_ms(),
        delivery: "snapshot".to_string(),
        scope: scope.clone(),
        payload_json: encode_optional_payload(&active_execution_context.preview_session)
            .ok()
            .flatten(),
        execution_context: Some(active_execution_context.clone()),
        snapshot: true,
    });
    events.push(HostEventEnvelope {
        event_id: Uuid::new_v4().to_string(),
        subscription_id: None,
        topic: HOST_EVENT_TOPIC_CWD_CHANGED.to_string(),
        sequence: 0,
        emitted_at_ms: current_epoch_ms(),
        delivery: "snapshot".to_string(),
        scope: scope.clone(),
        payload_json: encode_optional_payload(&serde_json::json!({
            "cwd": active_execution_context.cwd,
            "revision": active_execution_context.revision,
        }))
        .ok()
        .flatten(),
        execution_context: Some(active_execution_context.clone()),
        snapshot: true,
    });
    events.push(HostEventEnvelope {
        event_id: Uuid::new_v4().to_string(),
        subscription_id: None,
        topic: HOST_EVENT_TOPIC_EXPLORER_LOCATION_CHANGED.to_string(),
        sequence: 0,
        emitted_at_ms: current_epoch_ms(),
        delivery: "snapshot".to_string(),
        scope: scope.clone(),
        payload_json: encode_optional_payload(&serde_json::json!({
            "activeDirectory": active_execution_context.active_directory,
            "revision": active_execution_context.revision,
        }))
        .ok()
        .flatten(),
        execution_context: Some(active_execution_context.clone()),
        snapshot: true,
    });
    events.push(HostEventEnvelope {
        event_id: Uuid::new_v4().to_string(),
        subscription_id: None,
        topic: HOST_EVENT_TOPIC_EXPLORER_PANE_FOCUSED.to_string(),
        sequence: 0,
        emitted_at_ms: current_epoch_ms(),
        delivery: "snapshot".to_string(),
        scope: scope.clone(),
        payload_json: encode_optional_payload(&serde_json::json!({
            "paneId": active_execution_context.pane_id,
            "workspaceTabId": active_execution_context.workspace_tab_id,
            "revision": active_execution_context.revision,
        }))
        .ok()
        .flatten(),
        execution_context: Some(active_execution_context.clone()),
        snapshot: true,
    });
    events.push(HostEventEnvelope {
        event_id: Uuid::new_v4().to_string(),
        subscription_id: None,
        topic: HOST_EVENT_TOPIC_EXPLORER_WORKSPACE_CHANGED.to_string(),
        sequence: 0,
        emitted_at_ms: current_epoch_ms(),
        delivery: "snapshot".to_string(),
        scope,
        payload_json: encode_optional_payload(&serde_json::json!({
            "workspaceTabId": active_execution_context.workspace_tab_id,
            "revision": active_execution_context.revision,
        }))
        .ok()
        .flatten(),
        execution_context: Some(active_execution_context),
        snapshot: true,
    });
    events
}

fn is_context_snapshot_topic(topic: &str) -> bool {
    matches!(
        topic,
        HOST_EVENT_TOPIC_SELECTION_CHANGED
            | HOST_EVENT_TOPIC_PREVIEW_SESSION_CHANGED
            | HOST_EVENT_TOPIC_CWD_CHANGED
            | HOST_EVENT_TOPIC_EXPLORER_LOCATION_CHANGED
            | HOST_EVENT_TOPIC_EXPLORER_PANE_FOCUSED
            | HOST_EVENT_TOPIC_EXPLORER_WORKSPACE_CHANGED
    )
}

fn selection_identity(snapshot: &ExecutionContextSnapshot) -> String {
    let selected_paths = snapshot
        .selected_entries
        .iter()
        .map(|entry| entry.path.clone())
        .collect::<Vec<_>>()
        .join("|");
    let focused_path = snapshot
        .focused_entry
        .as_ref()
        .map(|entry| entry.path.clone())
        .unwrap_or_default();
    format!("{focused_path}::{selected_paths}")
}

fn build_scope_from_context(
    execution_context: Option<&ExecutionContextSnapshot>,
) -> HostEventScope {
    let Some(execution_context) = execution_context else {
        return HostEventScope::default();
    };
    HostEventScope {
        pane_id: execution_context.pane_id.clone(),
        workspace_tab_id: execution_context.workspace_tab_id.clone(),
        path: execution_context
            .preview_session
            .as_ref()
            .and_then(|session| session.resolved_path.clone().or(session.file_path.clone()))
            .or_else(|| execution_context.active_directory.clone()),
        task_id: None,
        runtime_id: None,
        extension_id: None,
    }
}

fn build_context_location_key(snapshot: &ExecutionContextSnapshot) -> Option<String> {
    let pane_id = snapshot.pane_id.as_deref()?.trim();
    if pane_id.is_empty() {
        return None;
    }
    let workspace_tab_id = snapshot
        .workspace_tab_id
        .as_deref()
        .unwrap_or("default")
        .trim();
    Some(format!("{workspace_tab_id}::{pane_id}"))
}

fn build_execution_context_revision(snapshot: &ExecutionContextSnapshot) -> String {
    let selected = snapshot
        .selected_entries
        .iter()
        .map(|entry| entry.path.as_str())
        .collect::<Vec<_>>()
        .join("|");
    let preview = snapshot
        .preview_session
        .as_ref()
        .and_then(|session| session.resolved_path.clone().or(session.file_path.clone()))
        .unwrap_or_default();
    let workspace_tab_id = snapshot.workspace_tab_id.clone().unwrap_or_default();
    let pane_id = snapshot.pane_id.clone().unwrap_or_default();
    let cwd = snapshot.cwd.clone().unwrap_or_default();
    format!("{workspace_tab_id}::{pane_id}::{cwd}::{preview}::{selected}")
}

fn infer_active_file_type_descriptor(
    snapshot: &ExecutionContextSnapshot,
) -> Option<FileTypeDescriptor> {
    if let Some(active_file_type) = snapshot.active_file_type.clone() {
        return Some(active_file_type);
    }

    let focused_entry = snapshot
        .preview_session
        .as_ref()
        .and_then(|session| session.file_path.clone())
        .or_else(|| {
            snapshot
                .focused_entry
                .as_ref()
                .map(|entry| entry.path.clone())
        })?;
    let extension = focused_entry
        .rsplit_once('.')
        .map(|(_, extension)| extension.trim().to_ascii_lowercase())
        .filter(|extension| !extension.is_empty());
    let is_directory = snapshot
        .focused_entry
        .as_ref()
        .map(|entry| entry.is_directory)
        .unwrap_or(false);
    let descriptor_id = if is_directory {
        "directory".to_string()
    } else if let Some(extension) = extension.clone() {
        format!("extension:{extension}")
    } else {
        "file:unknown".to_string()
    };
    Some(FileTypeDescriptor {
        id: descriptor_id,
        extensions: extension.clone().into_iter().collect(),
        file_names: Vec::new(),
        language_id: extension.clone(),
        icon_key: extension.clone(),
        open_behavior: if is_directory {
            "directory".to_string()
        } else {
            "preview".to_string()
        },
        preview_owner: snapshot
            .preview_session
            .as_ref()
            .map(|session| session.lane_type.clone()),
        runtime_affinity: snapshot
            .preview_session
            .as_ref()
            .and_then(|session| session.lane_id.clone()),
        editable: false,
    })
}

#[cfg(test)]
mod tests {
    use super::{
        HostContextSyncRequest, HostEventBusState, HostEventScope, HostSubscriptionRequest,
        HOST_EVENT_TOPIC_CWD_CHANGED, HOST_EVENT_TOPIC_EXPLORER_LOCATION_CHANGED,
        HOST_EVENT_TOPIC_PREVIEW_SESSION_CHANGED, HOST_EVENT_TOPIC_SELECTION_CHANGED,
        HOST_EVENT_TOPIC_TASKS_OUTPUT,
    };
    use crate::message_ring::{MessageRingPolicy, MessageStreamsPolicy};
    use crate::runtime_pipeline::extension_host::{
        ExecutionContextEntry, ExecutionContextPreviewSession, ExecutionContextSnapshot,
    };

    fn build_snapshot(
        cwd: &str,
        selected_paths: &[&str],
        preview_path: Option<&str>,
    ) -> ExecutionContextSnapshot {
        ExecutionContextSnapshot {
            active_directory: Some(cwd.to_string()),
            cwd: Some(cwd.to_string()),
            pane_id: Some("pane-a".to_string()),
            workspace_tab_id: Some("workspace-a".to_string()),
            focused_entry: selected_paths.first().map(|path| ExecutionContextEntry {
                path: (*path).to_string(),
                name: (*path).rsplit('/').next().unwrap_or(*path).to_string(),
                kind: "file".to_string(),
                extension: Some("txt".to_string()),
                is_directory: false,
            }),
            selected_entries: selected_paths
                .iter()
                .map(|path| ExecutionContextEntry {
                    path: (*path).to_string(),
                    name: (*path).rsplit('/').next().unwrap_or(*path).to_string(),
                    kind: "file".to_string(),
                    extension: Some("txt".to_string()),
                    is_directory: false,
                })
                .collect(),
            preview_session: preview_path.map(|path| ExecutionContextPreviewSession {
                lane_id: Some("plugin.test".to_string()),
                lane_type: "plugin:test".to_string(),
                view_mode: Some("preview".to_string()),
                workflow_tab_id: None,
                file_path: Some(path.to_string()),
                resolved_path: Some(path.to_string()),
            }),
            ..ExecutionContextSnapshot::default()
        }
    }

    #[test]
    fn sync_execution_context_emits_selection_preview_and_cwd_events() {
        let bus = HostEventBusState::default();
        let first = build_snapshot("/tmp/one", &["/tmp/one/a.txt"], Some("/tmp/one/a.txt"));
        let second = build_snapshot("/tmp/two", &["/tmp/two/b.txt"], Some("/tmp/two/b.txt"));

        bus.sync_execution_context(HostContextSyncRequest {
            snapshot: first,
            is_active: true,
        })
        .expect("first sync should succeed");
        bus.sync_execution_context(HostContextSyncRequest {
            snapshot: second,
            is_active: true,
        })
        .expect("second sync should succeed");

        let snapshots = bus.snapshots_for_request(&HostSubscriptionRequest {
            topics: vec![
                HOST_EVENT_TOPIC_SELECTION_CHANGED.to_string(),
                HOST_EVENT_TOPIC_PREVIEW_SESSION_CHANGED.to_string(),
                HOST_EVENT_TOPIC_CWD_CHANGED.to_string(),
                HOST_EVENT_TOPIC_EXPLORER_LOCATION_CHANGED.to_string(),
            ],
            include_snapshot: true,
            ..HostSubscriptionRequest::default()
        });

        assert!(snapshots
            .iter()
            .any(|event| event.topic == HOST_EVENT_TOPIC_SELECTION_CHANGED));
        assert!(snapshots
            .iter()
            .any(|event| event.topic == HOST_EVENT_TOPIC_PREVIEW_SESSION_CHANGED));
        assert!(snapshots
            .iter()
            .any(|event| event.topic == HOST_EVENT_TOPIC_CWD_CHANGED));
        assert!(snapshots
            .iter()
            .any(|event| event.topic == HOST_EVENT_TOPIC_EXPLORER_LOCATION_CHANGED));
    }

    #[test]
    fn topic_filters_support_prefix_topics() {
        let bus = HostEventBusState::default();
        let snapshot = build_snapshot("/tmp/one", &["/tmp/one/a.txt"], Some("/tmp/one/a.txt"));
        bus.sync_execution_context(HostContextSyncRequest {
            snapshot,
            is_active: true,
        })
        .expect("sync should succeed");

        let snapshots = bus.snapshots_for_request(&HostSubscriptionRequest {
            topics: vec!["selection.*".to_string(), "preview.*".to_string()],
            include_snapshot: true,
            ..HostSubscriptionRequest::default()
        });

        assert!(snapshots
            .iter()
            .any(|event| event.topic.starts_with("selection.")));
        assert!(snapshots
            .iter()
            .any(|event| event.topic.starts_with("preview.")));
    }

    #[test]
    fn replay_from_returns_retained_events_after_cursor() {
        let bus = HostEventBusState::default();
        let first = bus
            .publish_host_topic(
                HOST_EVENT_TOPIC_TASKS_OUTPUT,
                Some(r#"{"chunk":"one"}"#.to_string()),
                None,
                HostEventScope {
                    task_id: Some("task-a".to_string()),
                    ..HostEventScope::default()
                },
                false,
            )
            .expect("first task output should publish");
        let second = bus
            .publish_host_topic(
                HOST_EVENT_TOPIC_TASKS_OUTPUT,
                Some(r#"{"chunk":"two"}"#.to_string()),
                None,
                HostEventScope {
                    task_id: Some("task-a".to_string()),
                    ..HostEventScope::default()
                },
                false,
            )
            .expect("second task output should publish");

        let replay = bus.snapshots_for_request(&HostSubscriptionRequest {
            topics: vec![HOST_EVENT_TOPIC_TASKS_OUTPUT.to_string()],
            replay_from: Some(first.sequence + 1),
            ..HostSubscriptionRequest::default()
        });

        assert_eq!(replay.len(), 1);
        assert_eq!(replay[0].sequence, second.sequence);
        assert_eq!(
            replay[0].payload_json.as_deref(),
            Some(r#"{"chunk":"two"}"#)
        );
    }

    #[test]
    fn replay_from_respects_task_filters() {
        let bus = HostEventBusState::default();
        for task_id in ["task-a", "task-b"] {
            bus.publish_host_topic(
                HOST_EVENT_TOPIC_TASKS_OUTPUT,
                Some(format!(r#"{{"task":"{task_id}"}}"#)),
                None,
                HostEventScope {
                    task_id: Some(task_id.to_string()),
                    ..HostEventScope::default()
                },
                false,
            )
            .expect("task output should publish");
        }

        let replay = bus.snapshots_for_request(&HostSubscriptionRequest {
            topics: vec![HOST_EVENT_TOPIC_TASKS_OUTPUT.to_string()],
            filters: Some(super::HostEventFilter {
                task_id: Some("task-b".to_string()),
                ..super::HostEventFilter::default()
            }),
            replay_from: Some(0),
            ..HostSubscriptionRequest::default()
        });

        assert_eq!(replay.len(), 1);
        assert_eq!(replay[0].scope.task_id.as_deref(), Some("task-b"));
    }

    #[test]
    fn replay_history_is_bounded_by_message_stream_policy() {
        let mut policy = MessageStreamsPolicy::default();
        policy.task_output = MessageRingPolicy {
            max_messages: 2,
            max_bytes: 1024,
            ..policy.task_output.clone()
        }
        .normalized();
        let bus = HostEventBusState::new(policy);

        for value in ["one", "two", "three"] {
            bus.publish_host_topic(
                HOST_EVENT_TOPIC_TASKS_OUTPUT,
                Some(format!(r#"{{"chunk":"{value}"}}"#)),
                None,
                HostEventScope {
                    task_id: Some("task-a".to_string()),
                    ..HostEventScope::default()
                },
                false,
            )
            .expect("task output should publish");
        }

        let replay = bus.snapshots_for_request(&HostSubscriptionRequest {
            topics: vec![HOST_EVENT_TOPIC_TASKS_OUTPUT.to_string()],
            replay_from: Some(0),
            ..HostSubscriptionRequest::default()
        });

        assert_eq!(replay.len(), 2);
        assert_eq!(replay[0].sequence, 1);
        assert!(replay[0]
            .payload_json
            .as_deref()
            .unwrap_or_default()
            .contains("two"));
    }
}
