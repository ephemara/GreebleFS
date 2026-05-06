// Copyright 2026 K-Studio. All Rights Reserved.
// Job management system for ULTACODE terminal UI
// Ported from CLI crate job monitoring concepts

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum JobStatus {
    Queued,
    Running,
    Paused,
    Completed,
    Failed,
    Cancelled,
}

impl JobStatus {
    pub fn is_terminal(&self) -> bool {
        matches!(self, JobStatus::Completed | JobStatus::Failed | JobStatus::Cancelled)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobItem {
    pub id: String,
    pub name: String,
    pub status: JobStatus,
    pub progress: f32,
    pub created_at: u64,
    pub message: Option<String>,
}

impl JobItem {
    pub fn new(name: String) -> Self {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        
        Self {
            id: Uuid::new_v4().to_string(),
            name,
            status: JobStatus::Queued,
            progress: 0.0,
            created_at: now,
            message: None,
        }
    }
}

pub struct JobManager {
    jobs: Mutex<HashMap<String, JobItem>>,
}

impl JobManager {
    pub fn new() -> Self {
        Self {
            jobs: Mutex::new(HashMap::new()),
        }
    }

    pub fn create_job(&self, name: String) -> JobItem {
        let job = JobItem::new(name);
        let mut jobs = self.jobs.lock().unwrap();
        jobs.insert(job.id.clone(), job.clone());
        job
    }

    pub fn get_job(&self, id: &str) -> Option<JobItem> {
        let jobs = self.jobs.lock().unwrap();
        jobs.get(id).cloned()
    }

    pub fn list_jobs(&self) -> Vec<JobItem> {
        let jobs = self.jobs.lock().unwrap();
        let mut list: Vec<_> = jobs.values().cloned().collect();
        list.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        list
    }

    pub fn update_job_status(&self, id: &str, status: JobStatus) -> Option<JobItem> {
        let mut jobs = self.jobs.lock().unwrap();
        if let Some(job) = jobs.get_mut(id) {
            job.status = status;
            return Some(job.clone());
        }
        None
    }

    pub fn update_job_progress(&self, id: &str, progress: f32) -> Option<JobItem> {
        let mut jobs = self.jobs.lock().unwrap();
        if let Some(job) = jobs.get_mut(id) {
            job.progress = progress.clamp(0.0, 1.0);
            return Some(job.clone());
        }
        None
    }

    pub fn update_job_message(&self, id: &str, message: String) -> Option<JobItem> {
        let mut jobs = self.jobs.lock().unwrap();
        if let Some(job) = jobs.get_mut(id) {
            job.message = Some(message);
            return Some(job.clone());
        }
        None
    }

    pub fn remove_job(&self, id: &str) -> Option<JobItem> {
        let mut jobs = self.jobs.lock().unwrap();
        jobs.remove(id)
    }

    pub fn clear_completed(&self) -> usize {
        let mut jobs = self.jobs.lock().unwrap();
        let to_remove: Vec<String> = jobs
            .iter()
            .filter(|(_, job)| job.status.is_terminal())
            .map(|(id, _)| id.clone())
            .collect();
        
        let count = to_remove.len();
        for id in to_remove {
            jobs.remove(&id);
        }
        count
    }

    pub fn count_by_status(&self, status: JobStatus) -> usize {
        let jobs = self.jobs.lock().unwrap();
        jobs.values().filter(|job| job.status == status).count()
    }
}

// Tauri commands

#[tauri::command]
pub async fn job_create(
    job_manager: tauri::State<'_, JobManager>,
    name: String,
) -> Result<JobItem, String> {
    Ok(job_manager.create_job(name))
}

#[tauri::command]
pub async fn job_list(
    job_manager: tauri::State<'_, JobManager>,
) -> Result<Vec<JobItem>, String> {
    Ok(job_manager.list_jobs())
}

#[tauri::command]
pub async fn job_get(
    job_manager: tauri::State<'_, JobManager>,
    id: String,
) -> Result<Option<JobItem>, String> {
    Ok(job_manager.get_job(&id))
}

#[tauri::command]
pub async fn job_update_status(
    job_manager: tauri::State<'_, JobManager>,
    app: AppHandle,
    id: String,
    status: JobStatus,
) -> Result<Option<JobItem>, String> {
    let result = job_manager.update_job_status(&id, status);
    if let Some(ref job) = result {
        let _ = app.emit("job-updated", job.clone());
    }
    Ok(result)
}

#[tauri::command]
pub async fn job_update_progress(
    job_manager: tauri::State<'_, JobManager>,
    app: AppHandle,
    id: String,
    progress: f32,
) -> Result<Option<JobItem>, String> {
    let result = job_manager.update_job_progress(&id, progress);
    if let Some(ref job) = result {
        let _ = app.emit("job-updated", job.clone());
    }
    Ok(result)
}

#[tauri::command]
pub async fn job_remove(
    job_manager: tauri::State<'_, JobManager>,
    app: AppHandle,
    id: String,
) -> Result<Option<JobItem>, String> {
    let result = job_manager.remove_job(&id);
    if result.is_some() {
        let _ = app.emit("job-removed", id);
    }
    Ok(result)
}

#[tauri::command]
pub async fn job_clear_completed(
    job_manager: tauri::State<'_, JobManager>,
    app: AppHandle,
) -> Result<usize, String> {
    let count = job_manager.clear_completed();
    if count > 0 {
        let _ = app.emit("jobs-cleared", count);
    }
    Ok(count)
}
