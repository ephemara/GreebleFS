use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DragItem {
  pub kind: DragItemKind,
  pub id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum DragItemKind {
  File { path: String },
  Folder { path: String },
  Text { content: String },
  Node { node_id: String, node_type: String },
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum DragOperation {
  Copy,
  Move,
  Link,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DragSession {
  pub id: String,
  pub items: Vec<DragItem>,
  pub source: String,
  pub allowed_operations: Vec<DragOperation>,
  pub started_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum DragResult {
  Dropped {
    operation: DragOperation,
    target: String,
    position: Option<(f64, f64)>,
  },
  Cancelled,
  Failed {
    error: String,
  },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DropEvent {
  pub session_id: String,
  pub items: Vec<DragItem>,
  pub target: String,
  pub position: (f64, f64),
  pub operation: DragOperation,
}

pub struct DragManager {
  sessions: parking_lot::Mutex<HashMap<String, DragSession>>,
}

impl DragManager {
  pub fn new() -> Self {
    Self {
      sessions: parking_lot::Mutex::new(HashMap::new()),
    }
  }

  pub fn begin_drag(
    &self,
    items: Vec<DragItem>,
    source: String,
    operations: Vec<DragOperation>,
  ) -> DragSession {
    let session = DragSession {
      id: Uuid::new_v4().to_string(),
      items,
      source,
      allowed_operations: operations,
      started_at: std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64,
    };

    self
      .sessions
      .lock()
      .insert(session.id.clone(), session.clone());
    session
  }

  pub fn get_session(&self, session_id: &str) -> Option<DragSession> {
    self.sessions.lock().get(session_id).cloned()
  }

  pub fn end_drag(&self, session_id: &str) -> Option<DragSession> {
    self.sessions.lock().remove(session_id)
  }
}

impl Default for DragManager {
  fn default() -> Self {
    Self::new()
  }
}

#[tauri::command]
pub async fn windowmgr_drag_begin<R: tauri::Runtime>(
  drag_manager: tauri::State<'_, DragManager>,
  app: AppHandle<R>,
  items: Vec<DragItem>,
  source: String,
  operations: Option<Vec<DragOperation>>,
) -> Result<DragSession, String> {
  let session = drag_manager.begin_drag(
    items,
    source,
    operations.unwrap_or_else(|| vec![DragOperation::Copy, DragOperation::Move]),
  );
  let _ = app.emit("windowmgr://drag-began", &session);
  Ok(session)
}

#[tauri::command]
pub async fn windowmgr_drag_get_session(
  drag_manager: tauri::State<'_, DragManager>,
  session_id: String,
) -> Result<Option<DragSession>, String> {
  Ok(drag_manager.get_session(&session_id))
}

#[tauri::command]
pub async fn windowmgr_drag_end<R: tauri::Runtime>(
  drag_manager: tauri::State<'_, DragManager>,
  app: AppHandle<R>,
  session_id: String,
  result: DragResult,
) -> Result<(), String> {
  if let Some(session) = drag_manager.end_drag(&session_id) {
    let _ = app.emit(
      "windowmgr://drag-ended",
      serde_json::json!({
          "sessionId": session_id,
          "result": result,
          "items": session.items,
      }),
    );
  }
  Ok(())
}

#[tauri::command]
pub async fn windowmgr_drag_drop<R: tauri::Runtime>(
  drag_manager: tauri::State<'_, DragManager>,
  app: AppHandle<R>,
  session_id: String,
  target: String,
  position: (f64, f64),
  operation: DragOperation,
) -> Result<DropEvent, String> {
  let session = drag_manager
    .get_session(&session_id)
    .ok_or_else(|| format!("Drag session '{}' was not found", session_id))?;

  let event = DropEvent {
    session_id: session_id.clone(),
    items: session.items.clone(),
    target,
    position,
    operation,
  };

  drag_manager.end_drag(&session_id);
  let _ = app.emit("windowmgr://drag-dropped", &event);
  Ok(event)
}
