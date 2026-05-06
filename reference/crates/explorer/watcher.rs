// Copyright 2026 K-Studio. All Rights Reserved.

use notify::{Watcher, RecursiveMode, Event, EventKind};
use std::collections::HashSet;
use std::path::Path;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use serde::Serialize;

#[derive(Clone, Serialize)]
struct FsEventPayload {
    kind: String, // "create", "modify", "remove", "rename"
    paths: Vec<String>,
}

pub struct FileWatcher {
    watcher: Arc<Mutex<notify::RecommendedWatcher>>,
    watched_paths: Arc<Mutex<HashSet<String>>>,
}

impl FileWatcher {
    pub fn new(app: AppHandle) -> anyhow::Result<Self> {
        let app_handle = app.clone();
        
        let watcher = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
            if let Ok(event) = res {
                let kind_str = match event.kind {
                    EventKind::Create(_) => "create",
                    EventKind::Modify(_) => "modify",
                    EventKind::Remove(_) => "remove",
                    EventKind::Any => "any",
                    _ => "other",
                };

                // Filter out boring events if needed
                if kind_str != "other" {
                   let paths: Vec<String> = event.paths.iter()
                       .map(|p| p.to_string_lossy().to_string())
                       .collect();

                   let payload = FsEventPayload {
                       kind: kind_str.to_string(),
                       paths,
                   };
                   
                   // Emit event to frontend
                   let _ = app_handle.emit("fs:changed", payload);
                }
            }
        })?;

        Ok(Self {
            watcher: Arc::new(Mutex::new(watcher)),
            watched_paths: Arc::new(Mutex::new(HashSet::new())),
        })
    }

    pub fn watch(&self, path: &str) -> anyhow::Result<()> {
        let path_obj = Path::new(path);
        if path_obj.exists() {
            self.watcher.lock().unwrap().watch(path_obj, RecursiveMode::Recursive)?;
            self.watched_paths.lock().unwrap().insert(path.to_string());
        }
        Ok(())
    }

    pub fn unwatch(&self, path: &str) -> anyhow::Result<()> {
        let path_obj = Path::new(path);
        let _ = self.watcher.lock().unwrap().unwatch(path_obj);
        self.watched_paths.lock().unwrap().remove(path);
        Ok(())
    }

    pub fn unwatch_all(&self) -> anyhow::Result<()> {
        let mut paths = self.watched_paths.lock().unwrap();
        let mut watcher = self.watcher.lock().unwrap();
        
        for path in paths.iter() {
            let path_obj = Path::new(path);
            let _ = watcher.unwatch(path_obj);
        }
        paths.clear();
        Ok(())
    }
}
