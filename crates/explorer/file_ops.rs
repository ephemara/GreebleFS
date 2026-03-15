// Copyright 2026 K-Studio. All Rights Reserved.
// File operations module - reveal, open, drag & drop
// Adapted from Spacedrive file operations

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

// ============================================================================
// File Reveal Operations
// ============================================================================

#[tauri::command]
pub async fn reveal_in_explorer(path: String) -> Result<(), String> {
    let path = PathBuf::from(&path);
    
    if !path.exists() {
        return Err(format!("Path does not exist: {}", path.display()));
    }
    
    reveal_path(&path).map_err(|e| format!("Failed to reveal file: {}", e))
}

#[cfg(target_os = "windows")]
fn reveal_path(path: &Path) -> Result<(), std::io::Error> {
    std::process::Command::new("explorer")
        .arg("/select,")
        .arg(path)
        .spawn()?
        .wait()?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn reveal_path(path: &Path) -> Result<(), std::io::Error> {
    std::process::Command::new("open")
        .arg("-R")
        .arg(path)
        .spawn()?
        .wait()?;
    Ok(())
}

#[cfg(target_os = "linux")]
fn reveal_path(path: &Path) -> Result<(), std::io::Error> {
    if let Some(parent) = path.parent() {
        std::process::Command::new("xdg-open")
            .arg(parent)
            .spawn()?
            .wait()?;
    }
    Ok(())
}

#[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
fn reveal_path(_path: &Path) -> Result<(), std::io::Error> {
    Err(std::io::Error::new(
        std::io::ErrorKind::Unsupported,
        "Reveal is not supported on this platform",
    ))
}

// ============================================================================
// File Opening Operations
// ============================================================================

#[tauri::command]
pub async fn open_path_default(path: String) -> Result<(), String> {
    let path = PathBuf::from(&path);
    
    if !path.exists() {
        return Err(format!("Path does not exist: {}", path.display()));
    }
    
    open_path(&path).map_err(|e| format!("Failed to open file: {}", e))
}

#[cfg(target_os = "windows")]
fn open_path(path: &Path) -> Result<(), std::io::Error> {
    std::process::Command::new("cmd")
        .args(["/C", "start", "", &path.to_string_lossy()])
        .spawn()?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn open_path(path: &Path) -> Result<(), std::io::Error> {
    std::process::Command::new("open")
        .arg(path)
        .spawn()?;
    Ok(())
}

#[cfg(target_os = "linux")]
fn open_path(path: &Path) -> Result<(), std::io::Error> {
    std::process::Command::new("xdg-open")
        .arg(path)
        .spawn()?;
    Ok(())
}

#[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
fn open_path(_path: &Path) -> Result<(), std::io::Error> {
    Err(std::io::Error::new(
        std::io::ErrorKind::Unsupported,
        "Open is not supported on this platform",
    ))
}

// ============================================================================
// Drag & Drop System
// ============================================================================

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

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
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
    Dropped { operation: DragOperation, target: String, position: Option<(f64, f64)> },
    Cancelled,
    Failed { error: String },
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
    sessions: Mutex<HashMap<String, DragSession>>,
}

impl DragManager {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }
    
    pub fn begin_drag(&self, items: Vec<DragItem>, source: String, operations: Vec<DragOperation>) -> DragSession {
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
        
        let mut sessions = self.sessions.lock().unwrap();
        sessions.insert(session.id.clone(), session.clone());
        session
    }
    
    pub fn get_session(&self, id: &str) -> Option<DragSession> {
        let sessions = self.sessions.lock().unwrap();
        sessions.get(id).cloned()
    }
    
    pub fn end_drag(&self, id: &str) -> Option<DragSession> {
        let mut sessions = self.sessions.lock().unwrap();
        sessions.remove(id)
    }
    
    pub fn clear_stale(&self, max_age_ms: u64) {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;
        
        let mut sessions = self.sessions.lock().unwrap();
        sessions.retain(|_, session| now - session.started_at < max_age_ms);
    }
}

impl Default for DragManager {
    fn default() -> Self {
        Self::new()
    }
}

// Tauri Commands

#[tauri::command]
pub async fn drag_begin(
    drag_manager: tauri::State<'_, DragManager>,
    app: AppHandle,
    items: Vec<DragItem>,
    source: String,
    operations: Option<Vec<DragOperation>>,
) -> Result<DragSession, String> {
    let ops = operations.unwrap_or_else(|| vec![DragOperation::Copy, DragOperation::Move]);
    let session = drag_manager.begin_drag(items, source, ops);
    
    let _ = app.emit("drag:began", &session);
    Ok(session)
}

#[tauri::command]
pub async fn drag_get_session(
    drag_manager: tauri::State<'_, DragManager>,
    session_id: String,
) -> Result<Option<DragSession>, String> {
    Ok(drag_manager.get_session(&session_id))
}

#[tauri::command]
pub async fn drag_end(
    drag_manager: tauri::State<'_, DragManager>,
    app: AppHandle,
    session_id: String,
    result: DragResult,
) -> Result<(), String> {
    if let Some(session) = drag_manager.end_drag(&session_id) {
        let _ = app.emit("drag:ended", serde_json::json!({
            "sessionId": session_id,
            "result": result,
            "items": session.items,
        }));
    }
    Ok(())
}

#[tauri::command]
pub async fn drag_drop(
    drag_manager: tauri::State<'_, DragManager>,
    app: AppHandle,
    session_id: String,
    target: String,
    position: (f64, f64),
    operation: DragOperation,
) -> Result<DropEvent, String> {
    let session = drag_manager.get_session(&session_id)
        .ok_or_else(|| format!("Drag session not found: {}", session_id))?;
    
    let event = DropEvent {
        session_id: session_id.clone(),
        items: session.items.clone(),
        target: target.clone(),
        position,
        operation,
    };
    
    // End the session
    drag_manager.end_drag(&session_id);
    
    // Emit drop event
    let _ = app.emit("drag:dropped", &event);
    
    Ok(event)
}

// ============================================================================
// Context Menu Types (for frontend integration)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContextMenuItem {
    pub id: String,
    pub label: Option<String>,
    #[serde(rename = "type")]
    pub item_type: ContextMenuItemType,
    pub icon: Option<String>,
    pub keybind: Option<String>,
    pub disabled: Option<bool>,
    pub submenu: Option<Vec<ContextMenuItem>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ContextMenuItemType {
    Item,
    Separator,
    Submenu,
}

impl ContextMenuItem {
    pub fn item(id: &str, label: &str) -> Self {
        Self {
            id: id.to_string(),
            label: Some(label.to_string()),
            item_type: ContextMenuItemType::Item,
            icon: None,
            keybind: None,
            disabled: None,
            submenu: None,
        }
    }
    
    pub fn separator() -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            label: None,
            item_type: ContextMenuItemType::Separator,
            icon: None,
            keybind: None,
            disabled: None,
            submenu: None,
        }
    }
    
    pub fn submenu(id: &str, label: &str, items: Vec<ContextMenuItem>) -> Self {
        Self {
            id: id.to_string(),
            label: Some(label.to_string()),
            item_type: ContextMenuItemType::Submenu,
            icon: None,
            keybind: None,
            disabled: None,
            submenu: Some(items),
        }
    }
    
    pub fn with_icon(mut self, icon: &str) -> Self {
        self.icon = Some(icon.to_string());
        self
    }
    
    pub fn with_keybind(mut self, keybind: &str) -> Self {
        self.keybind = Some(keybind.to_string());
        self
    }
    
    pub fn disabled(mut self) -> Self {
        self.disabled = Some(true);
        self
    }
}

#[tauri::command]
pub async fn get_file_context_menu(path: String) -> Result<Vec<ContextMenuItem>, String> {
    let path = PathBuf::from(&path);
    let is_dir = path.is_dir();
    let exists = path.exists();
    
    let mut items = vec![];
    
    if exists {
        items.push(ContextMenuItem::item("open", "Open").with_keybind("Enter"));
        items.push(ContextMenuItem::item("open_with", "Open With..."));
        items.push(ContextMenuItem::separator());
        
        if is_dir {
            items.push(ContextMenuItem::item("open_terminal", "Open in Terminal"));
            items.push(ContextMenuItem::item("new_file", "New File").with_keybind("Ctrl+N"));
            items.push(ContextMenuItem::item("new_folder", "New Folder").with_keybind("Ctrl+Shift+N"));
        }
        
        items.push(ContextMenuItem::separator());
        items.push(ContextMenuItem::item("cut", "Cut").with_keybind("Ctrl+X"));
        items.push(ContextMenuItem::item("copy", "Copy").with_keybind("Ctrl+C"));
        items.push(ContextMenuItem::item("copy_path", "Copy Path").with_keybind("Ctrl+Shift+C"));
        
        if is_dir {
            items.push(ContextMenuItem::item("paste", "Paste").with_keybind("Ctrl+V"));
        }
        
        items.push(ContextMenuItem::separator());
        items.push(ContextMenuItem::item("rename", "Rename").with_keybind("F2"));
        items.push(ContextMenuItem::item("delete", "Delete").with_keybind("Delete"));
        items.push(ContextMenuItem::separator());
        items.push(ContextMenuItem::item("reveal", "Reveal in Explorer"));
        items.push(ContextMenuItem::item("properties", "Properties"));
    } else {
        items.push(ContextMenuItem::item("new_file", "New File").with_keybind("Ctrl+N"));
        items.push(ContextMenuItem::item("new_folder", "New Folder").with_keybind("Ctrl+Shift+N"));
        items.push(ContextMenuItem::separator());
        items.push(ContextMenuItem::item("paste", "Paste").with_keybind("Ctrl+V"));
    }
    
    Ok(items)
}

#[tauri::command]
pub async fn get_node_context_menu(node_type: String, node_id: String) -> Result<Vec<ContextMenuItem>, String> {
    let mut items = vec![
        ContextMenuItem::item("edit", "Edit Node"),
        ContextMenuItem::item("duplicate", "Duplicate").with_keybind("Ctrl+D"),
        ContextMenuItem::separator(),
    ];
    
    // Node-type specific items
    match node_type.as_str() {
        "agent" => {
            items.push(ContextMenuItem::item("run", "Run Agent").with_keybind("F5"));
            items.push(ContextMenuItem::item("configure", "Configure Model"));
            items.push(ContextMenuItem::item("view_logs", "View Logs"));
        }
        "input" | "output" => {
            items.push(ContextMenuItem::item("set_value", "Set Value"));
        }
        "router" => {
            items.push(ContextMenuItem::item("add_condition", "Add Condition"));
            items.push(ContextMenuItem::item("edit_conditions", "Edit Conditions"));
        }
        _ => {}
    }
    
    items.push(ContextMenuItem::separator());
    items.push(ContextMenuItem::item("delete", "Delete").with_keybind("Delete"));
    
    Ok(items)
}
