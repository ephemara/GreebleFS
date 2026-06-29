use std::{
  borrow::Cow,
  collections::HashMap,
  fs,
  path::PathBuf,
  sync::{Arc, Mutex},
  time::{SystemTime, UNIX_EPOCH},
};

use http::{
  header::{ACCESS_CONTROL_ALLOW_ORIGIN, CONTENT_LENGTH, CONTENT_TYPE},
  Request, Response, StatusCode,
};
use serde::{Deserialize, Serialize};
use tauri_utils::mime_type::MimeType;

use crate::{
  ipc::{Channel, InvokeResponseBody, IpcResponse},
  plugin::{Builder as PluginBuilder, TauriPlugin},
  resources::{Resource as TauriResource, ResourceId},
  webview::UriSchemeProtocolHandler,
  Manager, Runtime, State, Webview,
};

mod ring;

pub use ring::{
  StreamOverflowPolicy, StreamOverflowSnapshot, StreamReplay, StreamReplayGap,
  StreamRetentionPolicy, StreamRing, StreamTelemetry, StreamWriteOutcome,
};

pub const TRANSPORT_PLUGIN_NAME: &str = "transport";
pub const TRANSPORT_RESOURCE_PROTOCOL: &str = "transport";

#[derive(Debug, Clone)]
pub struct BinaryResponse(pub Vec<u8>);

impl BinaryResponse {
  pub fn new(bytes: impl Into<Vec<u8>>) -> Self {
    Self(bytes.into())
  }
}

impl From<Vec<u8>> for BinaryResponse {
  fn from(value: Vec<u8>) -> Self {
    Self(value)
  }
}

impl From<BinaryResponse> for Vec<u8> {
  fn from(value: BinaryResponse) -> Self {
    value.0
  }
}

impl IpcResponse for BinaryResponse {
  fn body(self) -> crate::Result<InvokeResponseBody> {
    Ok(InvokeResponseBody::Raw(self.0))
  }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct ResourceHandle {
  pub rid: ResourceId,
  pub kind: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase", default)]
pub struct StreamHandle {
  pub id: String,
  pub kind: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct StreamPacketMetadata {
  pub stream_id: String,
  pub sequence: u64,
  pub emitted_at_epoch_ms: u64,
  pub byte_length: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct StreamReplayPacket {
  pub metadata: StreamPacketMetadata,
  pub payload_json: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct StreamReplayResponse {
  pub stream_id: String,
  pub packets: Vec<StreamReplayPacket>,
  pub replay_gap: Option<StreamReplayGap>,
  pub telemetry: StreamTelemetry,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct StreamSubscriptionHandle {
  pub id: String,
  pub stream_id: String,
}

#[derive(Debug, Clone)]
struct SubscribeStreamOptions {
  include_replay: bool,
  replay_from_sequence: Option<u64>,
  replay_limit: Option<usize>,
}

#[derive(Debug, Clone)]
struct BytesResource {
  kind: String,
  bytes: Vec<u8>,
  media_type: Option<String>,
}

impl TauriResource for BytesResource {
  fn name(&self) -> Cow<'_, str> {
    Cow::Owned(format!("transport-bytes:{}", self.kind))
  }
}

#[derive(Debug, Clone)]
struct FileResource {
  kind: String,
  file_path: PathBuf,
  media_type: Option<String>,
}

impl TauriResource for FileResource {
  fn name(&self) -> Cow<'_, str> {
    Cow::Owned(format!("transport-file:{}", self.kind))
  }
}

#[derive(Clone)]
struct RegisteredStream {
  handle: StreamHandle,
  next_sequence: u64,
  ring: StreamRing<String>,
  subscribers: HashMap<String, Channel<InvokeResponseBody>>,
}

pub struct TransportState {
  streams: Mutex<HashMap<String, RegisteredStream>>,
  default_policy: StreamRetentionPolicy,
  policies_by_kind: HashMap<String, StreamRetentionPolicy>,
}

impl Default for TransportState {
  fn default() -> Self {
    let default_policy = StreamRetentionPolicy::default();
    let mut policies_by_kind = HashMap::new();
    policies_by_kind.insert(
      "terminal-output".into(),
      StreamRetentionPolicy {
        max_messages: 2048,
        max_bytes: 4 * 1024 * 1024,
        ..default_policy.clone()
      }
      .normalized(),
    );
    policies_by_kind.insert(
      "task-output".into(),
      StreamRetentionPolicy {
        max_messages: 1024,
        max_bytes: 2 * 1024 * 1024,
        ..default_policy.clone()
      }
      .normalized(),
    );
    Self {
      streams: Mutex::new(HashMap::new()),
      default_policy,
      policies_by_kind,
    }
  }
}

impl TransportState {
  fn register_stream(&self, kind: &str, stable_key: Option<&str>) -> Result<StreamHandle, String> {
    let handle = StreamHandle {
      id: stable_stream_id(kind, stable_key),
      kind: kind.to_string(),
    };
    let policy = self
      .policies_by_kind
      .get(kind)
      .cloned()
      .unwrap_or_else(|| self.default_policy.clone());
    let mut streams = self
      .streams
      .lock()
      .map_err(|_| "transport stream registry lock poisoned".to_string())?;
    streams
      .entry(handle.id.clone())
      .or_insert_with(|| RegisteredStream {
        handle: handle.clone(),
        next_sequence: 0,
        ring: StreamRing::new(policy),
        subscribers: HashMap::new(),
      });
    Ok(handle)
  }

  fn publish_stream_packet<TPayload, TBuild>(
    &self,
    stream_id: &str,
    mut build: TBuild,
  ) -> Result<(TPayload, StreamWriteOutcome), String>
  where
    TPayload: Serialize,
    TBuild: FnMut(StreamPacketMetadata) -> Result<TPayload, String>,
  {
    let (packet, payload_json, metadata, subscribers, outcome) = {
      let mut streams = self
        .streams
        .lock()
        .map_err(|_| "transport stream registry lock poisoned".to_string())?;
      let stream = streams
        .get_mut(stream_id)
        .ok_or_else(|| format!("Unknown transport stream id: {stream_id}"))?;
      let metadata = StreamPacketMetadata {
        stream_id: stream.handle.id.clone(),
        sequence: stream.next_sequence,
        emitted_at_epoch_ms: current_epoch_ms(),
        byte_length: 0,
      };
      let (packet, payload_json, metadata) =
        serialize_stream_payload_with_metadata(metadata, &mut build)?;
      let outcome = stream.ring.write_with_metadata(
        payload_json.clone(),
        metadata.clone(),
        metadata.byte_length as usize,
      );
      stream.next_sequence = metadata.sequence.saturating_add(1);
      let subscribers = stream
        .subscribers
        .iter()
        .map(|(subscription_id, channel)| (subscription_id.clone(), channel.clone()))
        .collect::<Vec<_>>();
      (packet, payload_json, metadata, subscribers, outcome)
    };

    if !subscribers.is_empty() {
      let delivery_json = serialize_transport_live_packet_json(&metadata, &payload_json)?;
      let mut failed_subscriptions = Vec::new();
      for (subscription_id, channel) in subscribers {
        if channel
          .send(InvokeResponseBody::Json(delivery_json.clone()))
          .is_err()
        {
          failed_subscriptions.push(subscription_id);
        }
      }
      if !failed_subscriptions.is_empty() {
        let mut streams = self
          .streams
          .lock()
          .map_err(|_| "transport stream registry lock poisoned".to_string())?;
        if let Some(stream) = streams.get_mut(stream_id) {
          for subscription_id in failed_subscriptions {
            stream.subscribers.remove(&subscription_id);
          }
        }
      }
    }

    Ok((packet, outcome))
  }

  fn publish_stream_payload<TPayload>(
    &self,
    stream_id: &str,
    packet: TPayload,
  ) -> Result<(TPayload, StreamWriteOutcome), String>
  where
    TPayload: Serialize,
  {
    let payload_json = serde_json::to_string(&packet)
      .map_err(|error| format!("Failed to serialize transport stream payload: {error}"))?;
    let (metadata, subscribers, outcome) = {
      let mut streams = self
        .streams
        .lock()
        .map_err(|_| "transport stream registry lock poisoned".to_string())?;
      let stream = streams
        .get_mut(stream_id)
        .ok_or_else(|| format!("Unknown transport stream id: {stream_id}"))?;
      let metadata = StreamPacketMetadata {
        stream_id: stream.handle.id.clone(),
        sequence: stream.next_sequence,
        emitted_at_epoch_ms: current_epoch_ms(),
        byte_length: payload_json.len() as u64,
      };
      let outcome = stream.ring.write_with_metadata(
        payload_json.clone(),
        metadata.clone(),
        metadata.byte_length as usize,
      );
      stream.next_sequence = metadata.sequence.saturating_add(1);
      let subscribers = stream
        .subscribers
        .iter()
        .map(|(subscription_id, channel)| (subscription_id.clone(), channel.clone()))
        .collect::<Vec<_>>();
      (metadata, subscribers, outcome)
    };

    if !subscribers.is_empty() {
      let delivery_json = serialize_transport_live_packet_json(&metadata, &payload_json)?;
      let mut failed_subscriptions = Vec::new();
      for (subscription_id, channel) in subscribers {
        if channel
          .send(InvokeResponseBody::Json(delivery_json.clone()))
          .is_err()
        {
          failed_subscriptions.push(subscription_id);
        }
      }
      if !failed_subscriptions.is_empty() {
        let mut streams = self
          .streams
          .lock()
          .map_err(|_| "transport stream registry lock poisoned".to_string())?;
        if let Some(stream) = streams.get_mut(stream_id) {
          for subscription_id in failed_subscriptions {
            stream.subscribers.remove(&subscription_id);
          }
        }
      }
    }

    Ok((packet, outcome))
  }

  fn replay_stream(
    &self,
    stream_id: &str,
    from_sequence: Option<u64>,
    limit: Option<usize>,
  ) -> Result<StreamReplayResponse, String> {
    let streams = self
      .streams
      .lock()
      .map_err(|_| "transport stream registry lock poisoned".to_string())?;
    let stream = streams
      .get(stream_id)
      .ok_or_else(|| format!("Unknown transport stream id: {stream_id}"))?;
    let replay = stream.ring.replay_from(from_sequence.unwrap_or(0), limit);
    Ok(StreamReplayResponse {
      stream_id: stream.handle.id.clone(),
      packets: replay
        .messages
        .into_iter()
        .map(|message| StreamReplayPacket {
          metadata: message.metadata,
          payload_json: message.message,
        })
        .collect(),
      replay_gap: replay.replay_gap,
      telemetry: replay.telemetry,
    })
  }

  fn subscribe_stream(
    &self,
    stream_id: String,
    channel: Channel<InvokeResponseBody>,
    options: SubscribeStreamOptions,
  ) -> Result<StreamSubscriptionHandle, String> {
    let subscription_id = random_identifier("transport-subscription");
    let replay_packets = {
      let mut streams = self
        .streams
        .lock()
        .map_err(|_| "transport stream registry lock poisoned".to_string())?;
      let stream = streams
        .get_mut(&stream_id)
        .ok_or_else(|| format!("Unknown transport stream id: {stream_id}"))?;
      let replay_packets = if options.include_replay || options.replay_from_sequence.is_some() {
        stream
          .ring
          .replay_from(
            options.replay_from_sequence.unwrap_or(0),
            options.replay_limit,
          )
          .messages
          .into_iter()
          .map(|message| (message.metadata, message.message))
          .collect::<Vec<_>>()
      } else {
        Vec::new()
      };
      stream
        .subscribers
        .insert(subscription_id.clone(), channel.clone());
      replay_packets
    };

    for (metadata, payload_json) in replay_packets {
      let delivery_json = serialize_transport_live_packet_json(&metadata, &payload_json)?;
      if let Err(error) = channel.send(InvokeResponseBody::Json(delivery_json)) {
        let _ = self.unsubscribe_stream(&subscription_id);
        return Err(format!(
          "Failed to deliver transport replay payload for stream '{}': {error}",
          stream_id
        ));
      }
    }

    Ok(StreamSubscriptionHandle {
      id: subscription_id,
      stream_id,
    })
  }

  fn unsubscribe_stream(&self, subscription_id: &str) -> Result<(), String> {
    let mut streams = self
      .streams
      .lock()
      .map_err(|_| "transport stream registry lock poisoned".to_string())?;
    for stream in streams.values_mut() {
      if stream.subscribers.remove(subscription_id).is_some() {
        break;
      }
    }
    Ok(())
  }

  fn close_stream(&self, stream_id: &str) -> Result<(), String> {
    let mut streams = self
      .streams
      .lock()
      .map_err(|_| "transport stream registry lock poisoned".to_string())?;
    streams.remove(stream_id);
    Ok(())
  }
}

pub fn register_bytes_resource<R: Runtime, M: Manager<R>>(
  manager: &M,
  kind: impl Into<String>,
  bytes: Vec<u8>,
  media_type: Option<String>,
) -> ResourceHandle {
  let kind = kind.into();
  let rid = manager.resources_table().add(BytesResource {
    kind: kind.clone(),
    bytes,
    media_type,
  });
  ResourceHandle { rid, kind }
}

pub fn register_file_resource<R: Runtime, M: Manager<R>>(
  manager: &M,
  kind: impl Into<String>,
  file_path: impl Into<PathBuf>,
  media_type: Option<String>,
) -> crate::Result<ResourceHandle> {
  let kind = kind.into();
  let file_path = file_path.into();
  if !file_path.is_file() {
    return Err(crate::Error::Anyhow(anyhow::anyhow!(
      "transport file resource path is not a file: {}",
      file_path.display()
    )));
  }
  let rid = manager.resources_table().add(FileResource {
    kind: kind.clone(),
    file_path,
    media_type,
  });
  Ok(ResourceHandle { rid, kind })
}

pub fn register_stream<R: Runtime, M: Manager<R>>(
  manager: &M,
  kind: &str,
  stable_key: Option<&str>,
) -> Result<StreamHandle, String> {
  manager
    .state::<TransportState>()
    .register_stream(kind, stable_key)
}

pub fn publish_stream_packet<R: Runtime, M: Manager<R>, TPayload, TBuild>(
  manager: &M,
  stream_id: &str,
  build: TBuild,
) -> Result<(TPayload, StreamWriteOutcome), String>
where
  TPayload: Serialize,
  TBuild: FnMut(StreamPacketMetadata) -> Result<TPayload, String>,
{
  manager
    .state::<TransportState>()
    .publish_stream_packet(stream_id, build)
}

pub fn publish_stream_payload<R: Runtime, M: Manager<R>, TPayload>(
  manager: &M,
  stream_id: &str,
  payload: TPayload,
) -> Result<(TPayload, StreamWriteOutcome), String>
where
  TPayload: Serialize,
{
  manager
    .state::<TransportState>()
    .publish_stream_payload(stream_id, payload)
}

pub fn replay_stream<R: Runtime, M: Manager<R>>(
  manager: &M,
  stream_id: &str,
  from_sequence: Option<u64>,
  limit: Option<usize>,
) -> Result<StreamReplayResponse, String> {
  manager
    .state::<TransportState>()
    .replay_stream(stream_id, from_sequence, limit)
}

pub fn close_stream<R: Runtime, M: Manager<R>>(manager: &M, stream_id: &str) -> Result<(), String> {
  manager.state::<TransportState>().close_stream(stream_id)
}

#[crate::command(root = "crate")]
fn subscribe<R: Runtime>(
  _webview: Webview<R>,
  state: State<'_, TransportState>,
  id: String,
  channel: Channel<InvokeResponseBody>,
  include_replay: Option<bool>,
  replay_from_sequence: Option<u64>,
  replay_limit: Option<usize>,
) -> Result<StreamSubscriptionHandle, String> {
  state.subscribe_stream(
    id,
    channel,
    SubscribeStreamOptions {
      include_replay: include_replay.unwrap_or(false),
      replay_from_sequence,
      replay_limit,
    },
  )
}

#[crate::command(root = "crate")]
fn unsubscribe(state: State<'_, TransportState>, id: String) -> Result<(), String> {
  state.unsubscribe_stream(&id)
}

#[crate::command(root = "crate")]
fn replay(
  state: State<'_, TransportState>,
  id: String,
  from_sequence: Option<u64>,
  limit: Option<usize>,
) -> Result<StreamReplayResponse, String> {
  state.replay_stream(&id, from_sequence, limit)
}

#[crate::command(root = "crate")]
fn close_stream_command(state: State<'_, TransportState>, id: String) -> Result<(), String> {
  state.close_stream(&id)
}

pub(crate) fn plugin<R: Runtime>() -> TauriPlugin<R> {
  PluginBuilder::new(TRANSPORT_PLUGIN_NAME)
    .setup(|app, _api| {
      if app.try_state::<TransportState>().is_none() {
        let _ = app.manage(TransportState::default());
      }
      Ok(())
    })
    .invoke_handler(crate::generate_handler![
      #![plugin(transport)]
      subscribe,
      unsubscribe,
      replay,
      close_stream_command
    ])
    .build()
}

pub(crate) fn protocol<R: Runtime>(
  manager: Arc<crate::manager::AppManager<R>>,
  window_origin: String,
) -> UriSchemeProtocolHandler {
  Box::new(move |webview_id, request, responder| {
    let response = match get_protocol_response(&manager, webview_id, request, &window_origin) {
      Ok(response) => response,
      Err(error) => Response::builder()
        .status(StatusCode::INTERNAL_SERVER_ERROR)
        .header(CONTENT_TYPE, mime::TEXT_PLAIN.essence_str())
        .header(ACCESS_CONTROL_ALLOW_ORIGIN, window_origin.as_str())
        .body(error.to_string().into_bytes().into())
        .unwrap(),
    };
    responder.respond(response);
  })
}

fn get_protocol_response<R: Runtime>(
  manager: &crate::manager::AppManager<R>,
  webview_id: &str,
  request: Request<Vec<u8>>,
  window_origin: &str,
) -> Result<Response<Cow<'static, [u8]>>, Box<dyn std::error::Error>> {
  let path = request.uri().path().trim_start_matches('/');
  let rid: ResourceId = percent_encoding::percent_decode_str(path)
    .decode_utf8_lossy()
    .parse()
    .map_err(|_| format!("Invalid transport resource id '{path}'"))?;
  let resource = resolve_transport_resource(manager, webview_id, rid)?;
  let (body, media_type) = read_transport_resource(&resource)?;
  let mut response = Response::builder()
    .header(ACCESS_CONTROL_ALLOW_ORIGIN, window_origin)
    .header(CONTENT_TYPE, media_type)
    .header(CONTENT_LENGTH, body.len());

  if request.method() == http::Method::HEAD {
    response = response.header(CONTENT_LENGTH, body.len());
    return response.body(Vec::new().into()).map_err(Into::into);
  }

  response.body(body.into()).map_err(Into::into)
}

fn resolve_transport_resource<R: Runtime>(
  manager: &crate::manager::AppManager<R>,
  webview_id: &str,
  rid: ResourceId,
) -> crate::Result<TransportResource> {
  let webview = manager
    .get_webview(webview_id)
    .ok_or(crate::Error::BadResourceId(rid))?;

  find_transport_resource_in_tables(&webview, rid)
}

fn find_transport_resource_in_tables<R: Runtime>(
  webview: &Webview<R>,
  rid: ResourceId,
) -> crate::Result<TransportResource> {
  if let Ok(resource) = webview.resources_table().get::<BytesResource>(rid) {
    return Ok(TransportResource::Bytes(resource));
  }
  if let Ok(resource) = webview.resources_table().get::<FileResource>(rid) {
    return Ok(TransportResource::File(resource));
  }
  if let Ok(resource) = webview.window().resources_table().get::<BytesResource>(rid) {
    return Ok(TransportResource::Bytes(resource));
  }
  if let Ok(resource) = webview.window().resources_table().get::<FileResource>(rid) {
    return Ok(TransportResource::File(resource));
  }
  if let Ok(resource) = webview
    .app_handle()
    .resources_table()
    .get::<BytesResource>(rid)
  {
    return Ok(TransportResource::Bytes(resource));
  }
  if let Ok(resource) = webview
    .app_handle()
    .resources_table()
    .get::<FileResource>(rid)
  {
    return Ok(TransportResource::File(resource));
  }

  Err(crate::Error::BadResourceId(rid))
}

enum TransportResource {
  Bytes(Arc<BytesResource>),
  File(Arc<FileResource>),
}

fn read_transport_resource(
  resource: &TransportResource,
) -> Result<(Vec<u8>, String), Box<dyn std::error::Error>> {
  match resource {
    TransportResource::Bytes(resource) => Ok((
      resource.bytes.clone(),
      resource
        .media_type
        .clone()
        .unwrap_or_else(|| mime::APPLICATION_OCTET_STREAM.essence_str().to_string()),
    )),
    TransportResource::File(resource) => {
      let body = fs::read(&resource.file_path)?;
      let media_type = resource.media_type.clone().unwrap_or_else(|| {
        MimeType::parse(&body, &resource.file_path.to_string_lossy()).to_string()
      });
      Ok((body, media_type))
    }
  }
}

fn current_epoch_ms() -> u64 {
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|duration| duration.as_millis() as u64)
    .unwrap_or(0)
}

fn serialize_stream_payload_with_metadata<TPayload, TBuild>(
  initial_metadata: StreamPacketMetadata,
  build: &mut TBuild,
) -> Result<(TPayload, String, StreamPacketMetadata), String>
where
  TPayload: Serialize,
  TBuild: FnMut(StreamPacketMetadata) -> Result<TPayload, String>,
{
  const MAX_METADATA_CONVERGENCE_ATTEMPTS: usize = 8;

  let mut metadata = initial_metadata;
  for _ in 0..MAX_METADATA_CONVERGENCE_ATTEMPTS {
    let packet = build(metadata.clone())?;
    let payload_json = serde_json::to_string(&packet)
      .map_err(|error| format!("Failed to serialize transport stream packet: {error}"))?;
    let byte_length = payload_json.len() as u64;
    if byte_length == metadata.byte_length {
      return Ok((packet, payload_json, metadata));
    }
    metadata.byte_length = byte_length;
  }

  Err(format!(
    "Transport stream metadata byteLength did not converge for stream '{}'",
    metadata.stream_id
  ))
}

fn serialize_transport_live_packet_json(
  metadata: &StreamPacketMetadata,
  payload_json: &str,
) -> Result<String, String> {
  let metadata_json = serde_json::to_string(metadata)
    .map_err(|error| format!("Failed to serialize transport stream metadata: {error}"))?;
  let mut packet_json = String::with_capacity(metadata_json.len() + payload_json.len() + 24);
  packet_json.push_str("{\"metadata\":");
  packet_json.push_str(&metadata_json);
  packet_json.push_str(",\"payload\":");
  packet_json.push_str(payload_json);
  packet_json.push('}');
  Ok(packet_json)
}

fn stable_stream_id(kind: &str, stable_key: Option<&str>) -> String {
  if let Some(stable_key) = stable_key {
    return format!(
      "stream-{}-{}",
      sanitize_identifier_segment(kind),
      sanitize_identifier_segment(stable_key)
    );
  }

  format!(
    "stream-{}-{}",
    sanitize_identifier_segment(kind),
    random_identifier("anonymous")
  )
}

fn sanitize_identifier_segment(value: &str) -> String {
  let sanitized = value
    .chars()
    .map(|character| {
      if character.is_ascii_alphanumeric() || character == '-' || character == '_' {
        character
      } else {
        '-'
      }
    })
    .collect::<String>()
    .trim_matches('-')
    .to_string();
  if sanitized.is_empty() {
    "value".into()
  } else {
    sanitized
  }
}

fn random_identifier(prefix: &str) -> String {
  let mut bytes = [0_u8; 8];
  getrandom::fill(&mut bytes).expect("failed to get random bytes");
  format!(
    "{prefix}-{}",
    bytes
      .iter()
      .map(|byte| format!("{byte:02x}"))
      .collect::<String>()
  )
}

#[cfg(test)]
mod tests {
  use super::{BinaryResponse, StreamPacketMetadata, TransportState};
  use crate::ipc::{InvokeResponseBody, IpcResponse};

  #[test]
  fn binary_response_uses_raw_ipc_body() {
    let response = BinaryResponse::new(vec![1_u8, 2, 3, 4])
      .body()
      .expect("binary response should resolve");
    match response {
      InvokeResponseBody::Raw(bytes) => assert_eq!(bytes, vec![1_u8, 2, 3, 4]),
      other => panic!("expected raw body, got {other:?}"),
    }
  }

  #[test]
  fn stream_replay_reports_overflow() {
    let state = TransportState::default();
    let handle = state
      .register_stream("transport-test", Some("overflow"))
      .expect("stream should register");

    {
      let mut streams = state.streams.lock().expect("lock");
      let stream = streams.get_mut(&handle.id).expect("stream");
      stream.ring = super::StreamRing::new(super::StreamRetentionPolicy {
        max_messages: 2,
        max_bytes: 1024,
        ..super::StreamRetentionPolicy::default()
      });
    }

    for index in 0..3_u64 {
      state
        .publish_stream_packet(&handle.id, |metadata| {
          Ok(serde_json::json!({
            "metadata": StreamPacketMetadata {
              byte_length: metadata.byte_length,
              ..metadata
            },
            "data": format!("message-{index}"),
          }))
        })
        .expect("packet should publish");
    }

    let replay = state
      .replay_stream(&handle.id, Some(0), Some(8))
      .expect("replay should succeed");
    assert_eq!(replay.packets.len(), 2);
    assert_eq!(replay.replay_gap.expect("gap").oldest_retained_sequence, 1);
  }

  #[test]
  fn stream_metadata_byte_length_converges_to_serialized_payload_size() {
    let state = TransportState::default();
    let handle = state
      .register_stream("transport-test", Some("byte-length"))
      .expect("stream should register");

    let (packet, outcome) = state
      .publish_stream_packet(&handle.id, |metadata| {
        Ok(serde_json::json!({
          "metadata": {
            "streamId": metadata.stream_id,
            "sequence": metadata.sequence,
            "emittedAtEpochMs": metadata.emitted_at_epoch_ms,
            "byteLength": metadata.byte_length,
          },
          "data": "hello transport",
        }))
      })
      .expect("packet should publish");

    let serialized_packet = serde_json::to_string(&packet).expect("packet should serialize");
    assert_eq!(outcome.metadata.byte_length, serialized_packet.len() as u64);
    let embedded_byte_length = packet
      .get("metadata")
      .and_then(|value| value.get("byteLength"))
      .and_then(|value| value.as_u64())
      .expect("embedded metadata.byteLength should be present");
    assert_eq!(embedded_byte_length, outcome.metadata.byte_length);
  }
}
