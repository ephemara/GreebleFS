use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, VecDeque};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Instant;
use tauri::{AppHandle, Manager, State};
use tauri_specta::Event;
use uuid::Uuid;

const TELEMETRY_DIRECTORY_NAME: &str = ".telemetry";
const TELEMETRY_EXPORTS_DIRECTORY_NAME: &str = "exports";
const MAX_RECENT_RECORDS: usize = 400;
const MAX_SESSIONS: usize = 12;

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub enum TelemetryCaptureMode {
    #[serde(rename = "raw")]
    Raw,
    #[serde(rename = "sampled")]
    Sampled,
    #[serde(rename = "perf-only")]
    PerfOnly,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub enum TelemetryPayloadMode {
    #[serde(rename = "metadata-only")]
    MetadataOnly,
    #[serde(rename = "metadata+small-payloads")]
    MetadataAndSmallPayloads,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct TelemetryConfig {
    pub developer_telemetry_enabled: bool,
    pub developer_telemetry_capture_mode: TelemetryCaptureMode,
    pub developer_telemetry_write_to_file: bool,
    pub developer_telemetry_show_inspector: bool,
    pub developer_telemetry_payload_mode: TelemetryPayloadMode,
    pub developer_telemetry_max_file_size_mb: u32,
    pub consumer_diagnostics_enabled: bool,
    pub consumer_diagnostics_include_plugin_runtime: bool,
    pub consumer_diagnostics_include_renderer_runtime: bool,
    pub consumer_diagnostics_include_perf_samples: bool,
}

impl Default for TelemetryConfig {
    fn default() -> Self {
        Self {
            developer_telemetry_enabled: false,
            developer_telemetry_capture_mode: TelemetryCaptureMode::Raw,
            developer_telemetry_write_to_file: true,
            developer_telemetry_show_inspector: true,
            developer_telemetry_payload_mode: TelemetryPayloadMode::MetadataAndSmallPayloads,
            developer_telemetry_max_file_size_mb: 64,
            consumer_diagnostics_enabled: false,
            consumer_diagnostics_include_plugin_runtime: true,
            consumer_diagnostics_include_renderer_runtime: true,
            consumer_diagnostics_include_perf_samples: true,
        }
    }
}

impl TelemetryConfig {
    fn is_enabled(&self) -> bool {
        self.developer_telemetry_enabled || self.consumer_diagnostics_enabled
    }

    fn max_file_size_bytes(&self) -> u64 {
        (self.developer_telemetry_max_file_size_mb.max(1) as u64) * 1024 * 1024
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct TelemetryErrorRecord {
    pub message: String,
    pub code: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct TelemetryRecord {
    pub trace_id: String,
    pub span_id: Option<String>,
    pub parent_span_id: Option<String>,
    pub recorded_at: u64,
    pub started_at: Option<u64>,
    pub ended_at: Option<u64>,
    pub duration_ms: Option<f64>,
    pub layer: String,
    pub kind: String,
    pub name: String,
    pub status: String,
    pub metadata: BTreeMap<String, String>,
    pub error: Option<TelemetryErrorRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type, tauri_specta::Event)]
pub struct TelemetryRecordEvent {
    pub record: TelemetryRecord,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct TelemetrySessionStatus {
    pub config: TelemetryConfig,
    pub session_id: String,
    pub trace_directory: String,
    pub current_file_path: Option<String>,
    pub session_file_paths: Vec<String>,
    pub recent_record_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct TelemetrySupportBundleResult {
    pub export_path: String,
    pub session_id: String,
    pub exported_files: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct TelemetrySpan {
    trace_id: String,
    span_id: String,
    parent_span_id: Option<String>,
    layer: String,
    name: String,
    started_at_ms: u64,
    started_at_instant: Instant,
    metadata: BTreeMap<String, String>,
}

struct TelemetryManagerInner {
    config: TelemetryConfig,
    session_id: String,
    trace_directory: PathBuf,
    current_file_index: usize,
    current_file_path: PathBuf,
    session_file_paths: Vec<PathBuf>,
    recent_records: VecDeque<TelemetryRecord>,
}

pub struct TelemetryManager {
    inner: Mutex<TelemetryManagerInner>,
}

impl Default for TelemetryManager {
    fn default() -> Self {
        Self {
            inner: Mutex::new(TelemetryManagerInner {
                config: TelemetryConfig::default(),
                session_id: Uuid::new_v4().to_string(),
                trace_directory: PathBuf::new(),
                current_file_index: 1,
                current_file_path: PathBuf::new(),
                session_file_paths: Vec::new(),
                recent_records: VecDeque::new(),
            }),
        }
    }
}

impl TelemetryManager {
    fn ensure_session(inner: &mut TelemetryManagerInner, app: &AppHandle) -> Result<(), String> {
        if !inner.trace_directory.as_os_str().is_empty()
            && !inner.current_file_path.as_os_str().is_empty()
        {
            return Ok(());
        }

        let trace_directory = telemetry_directory(app)?;
        fs::create_dir_all(&trace_directory)
            .map_err(|error| format!("Failed to create telemetry directory: {error}"))?;
        prune_old_sessions(&trace_directory);

        let session_id = Uuid::new_v4().to_string();
        let current_file_index = 1usize;
        let current_file_path = trace_directory.join(format!(
            "session-{}-{:02}.jsonl",
            session_id, current_file_index
        ));

        inner.session_id = session_id;
        inner.trace_directory = trace_directory;
        inner.current_file_index = current_file_index;
        inner.current_file_path = current_file_path.clone();
        inner.session_file_paths = vec![current_file_path];
        Ok(())
    }

    fn rotate_file_if_needed(inner: &mut TelemetryManagerInner) -> Result<(), String> {
        if !inner.current_file_path.exists() {
            return Ok(());
        }

        let size = fs::metadata(&inner.current_file_path)
            .map(|metadata| metadata.len())
            .unwrap_or(0);
        if size < inner.config.max_file_size_bytes() {
            return Ok(());
        }

        inner.current_file_index += 1;
        inner.current_file_path = inner.trace_directory.join(format!(
            "session-{}-{:02}.jsonl",
            inner.session_id, inner.current_file_index
        ));
        inner
            .session_file_paths
            .push(inner.current_file_path.clone());
        Ok(())
    }

    fn record(&self, app: &AppHandle, record: TelemetryRecord) -> Result<(), String> {
        let mut inner = self
            .inner
            .lock()
            .map_err(|_| "telemetry manager lock poisoned".to_string())?;

        if !inner.config.is_enabled() {
            return Ok(());
        }

        Self::ensure_session(&mut inner, app)?;
        if inner.recent_records.len() >= MAX_RECENT_RECORDS {
            inner.recent_records.pop_front();
        }
        inner.recent_records.push_back(record.clone());

        if inner.config.developer_telemetry_write_to_file {
            Self::rotate_file_if_needed(&mut inner)?;
            let mut file = OpenOptions::new()
                .create(true)
                .append(true)
                .open(&inner.current_file_path)
                .map_err(|error| format!("Failed to open telemetry file: {error}"))?;
            let serialized = serde_json::to_string(&record)
                .map_err(|error| format!("Failed to serialize telemetry record: {error}"))?;
            writeln!(file, "{serialized}")
                .map_err(|error| format!("Failed to write telemetry record: {error}"))?;
        }

        let _ = TelemetryRecordEvent { record }.emit(app);
        Ok(())
    }

    fn configure(&self, config: TelemetryConfig) -> Result<(), String> {
        let mut inner = self
            .inner
            .lock()
            .map_err(|_| "telemetry manager lock poisoned".to_string())?;
        inner.config = config;
        Ok(())
    }

    fn status(&self, app: &AppHandle) -> Result<TelemetrySessionStatus, String> {
        let mut inner = self
            .inner
            .lock()
            .map_err(|_| "telemetry manager lock poisoned".to_string())?;
        if inner.config.is_enabled() {
            Self::ensure_session(&mut inner, app)?;
        }
        Ok(TelemetrySessionStatus {
            config: inner.config.clone(),
            session_id: inner.session_id.clone(),
            trace_directory: if inner.trace_directory.as_os_str().is_empty() {
                telemetry_directory(app)?.to_string_lossy().to_string()
            } else {
                inner.trace_directory.to_string_lossy().to_string()
            },
            current_file_path: (!inner.current_file_path.as_os_str().is_empty())
                .then(|| inner.current_file_path.to_string_lossy().to_string()),
            session_file_paths: inner
                .session_file_paths
                .iter()
                .map(|path| path.to_string_lossy().to_string())
                .collect(),
            recent_record_count: inner.recent_records.len(),
        })
    }

    fn recent_records(&self, limit: Option<usize>) -> Result<Vec<TelemetryRecord>, String> {
        let inner = self
            .inner
            .lock()
            .map_err(|_| "telemetry manager lock poisoned".to_string())?;
        let limit = limit.unwrap_or(60).max(1);
        let records = inner
            .recent_records
            .iter()
            .rev()
            .take(limit)
            .cloned()
            .collect::<Vec<_>>();
        Ok(records.into_iter().rev().collect())
    }

    fn clear_sessions(&self, app: &AppHandle) -> Result<(), String> {
        let mut inner = self
            .inner
            .lock()
            .map_err(|_| "telemetry manager lock poisoned".to_string())?;
        let trace_directory = telemetry_directory(app)?;
        if trace_directory.exists() {
            fs::remove_dir_all(&trace_directory)
                .map_err(|error| format!("Failed to clear telemetry sessions: {error}"))?;
        }
        inner.trace_directory = PathBuf::new();
        inner.current_file_path = PathBuf::new();
        inner.current_file_index = 1;
        inner.session_id = Uuid::new_v4().to_string();
        inner.session_file_paths.clear();
        inner.recent_records.clear();
        Ok(())
    }

    fn export_support_bundle(
        &self,
        app: &AppHandle,
    ) -> Result<TelemetrySupportBundleResult, String> {
        let mut inner = self
            .inner
            .lock()
            .map_err(|_| "telemetry manager lock poisoned".to_string())?;
        Self::ensure_session(&mut inner, app)?;

        let export_root = inner
            .trace_directory
            .join(TELEMETRY_EXPORTS_DIRECTORY_NAME)
            .join(format!("support-bundle-{}", now_ms()));
        fs::create_dir_all(&export_root)
            .map_err(|error| format!("Failed to create telemetry export directory: {error}"))?;

        let mut exported_files = Vec::new();
        for source in &inner.session_file_paths {
            if !source.exists() {
                continue;
            }
            let file_name = source
                .file_name()
                .ok_or_else(|| "Telemetry session file is missing a file name".to_string())?;
            let destination = export_root.join(file_name);
            fs::copy(source, &destination)
                .map_err(|error| format!("Failed to copy telemetry session file: {error}"))?;
            exported_files.push(destination.to_string_lossy().to_string());
        }

        let manifest_path = export_root.join("manifest.json");
        let manifest = serde_json::json!({
            "sessionId": inner.session_id,
            "generatedAt": now_ms(),
            "appVersion": env!("CARGO_PKG_VERSION"),
            "platform": std::env::consts::OS,
            "sessionFiles": exported_files,
            "recentRecords": inner.recent_records,
        });
        fs::write(
            &manifest_path,
            serde_json::to_vec_pretty(&manifest)
                .map_err(|error| format!("Failed to serialize telemetry manifest: {error}"))?,
        )
        .map_err(|error| format!("Failed to write telemetry manifest: {error}"))?;

        Ok(TelemetrySupportBundleResult {
            export_path: export_root.to_string_lossy().to_string(),
            session_id: inner.session_id.clone(),
            exported_files: {
                let mut files = exported_files;
                files.push(manifest_path.to_string_lossy().to_string());
                files
            },
        })
    }
}

fn telemetry_directory(app: &AppHandle) -> Result<PathBuf, String> {
    if cfg!(debug_assertions) {
        return repo_root_directory().map(|repo_root| repo_root.join(TELEMETRY_DIRECTORY_NAME));
    }

    let logs_root = app
        .path()
        .app_log_dir()
        .or_else(|_| app.path().app_data_dir().map(|path| path.join("logs")))
        .map_err(|error| format!("Failed to resolve telemetry directory: {error}"))?;
    Ok(logs_root.join(TELEMETRY_DIRECTORY_NAME))
}

fn repo_root_directory() -> Result<PathBuf, String> {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(PathBuf::from)
        .ok_or_else(|| "Failed to resolve repository root for telemetry storage".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn repo_root_directory_resolves_to_the_repository_root() {
        let expected_repo_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .expect("Cargo manifest directory should have a parent")
            .to_path_buf();

        assert_eq!(
            repo_root_directory().expect("repo root should resolve"),
            expected_repo_root
        );
        assert_eq!(
            repo_root_directory()
                .expect("repo root should resolve")
                .join(TELEMETRY_DIRECTORY_NAME),
            expected_repo_root.join(TELEMETRY_DIRECTORY_NAME),
        );
    }
}

fn prune_old_sessions(trace_directory: &PathBuf) {
    let Ok(read_dir) = fs::read_dir(trace_directory) else {
        return;
    };

    let mut sessions = read_dir
        .filter_map(|entry| entry.ok())
        .filter_map(|entry| {
            let path = entry.path();
            let metadata = entry.metadata().ok()?;
            Some((path, metadata.modified().ok()))
        })
        .collect::<Vec<_>>();
    sessions.sort_by(|left, right| left.1.cmp(&right.1));

    if sessions.len() <= MAX_SESSIONS {
        return;
    }

    let remove_count = sessions.len().saturating_sub(MAX_SESSIONS);
    for (path, _) in sessions.into_iter().take(remove_count) {
        let _ = if path.is_dir() {
            fs::remove_dir_all(path)
        } else {
            fs::remove_file(path)
        };
    }
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

fn summarize_error(error: &str) -> TelemetryErrorRecord {
    TelemetryErrorRecord {
        message: error.to_string(),
        code: None,
    }
}

pub fn start_native_span(
    app: &AppHandle,
    layer: &str,
    name: &str,
    metadata: BTreeMap<String, String>,
) -> TelemetrySpan {
    let span = TelemetrySpan {
        trace_id: Uuid::new_v4().to_string(),
        span_id: Uuid::new_v4().to_string(),
        parent_span_id: None,
        layer: layer.to_string(),
        name: name.to_string(),
        started_at_ms: now_ms(),
        started_at_instant: Instant::now(),
        metadata: metadata.clone(),
    };

    let manager = app.state::<TelemetryManager>();
    let _ = manager.record(
        app,
        TelemetryRecord {
            trace_id: span.trace_id.clone(),
            span_id: Some(span.span_id.clone()),
            parent_span_id: None,
            recorded_at: now_ms(),
            started_at: Some(span.started_at_ms),
            ended_at: None,
            duration_ms: None,
            layer: span.layer.clone(),
            kind: "span-start".to_string(),
            name: span.name.clone(),
            status: "started".to_string(),
            metadata,
            error: None,
        },
    );

    span
}

pub fn finish_native_span(
    app: &AppHandle,
    span: TelemetrySpan,
    status: &str,
    metadata: BTreeMap<String, String>,
    error: Option<String>,
) {
    let mut merged_metadata = span.metadata.clone();
    for (key, value) in metadata {
        merged_metadata.insert(key, value);
    }

    let manager = app.state::<TelemetryManager>();
    let _ = manager.record(
        app,
        TelemetryRecord {
            trace_id: span.trace_id,
            span_id: Some(span.span_id),
            parent_span_id: span.parent_span_id,
            recorded_at: now_ms(),
            started_at: Some(span.started_at_ms),
            ended_at: Some(now_ms()),
            duration_ms: Some(span.started_at_instant.elapsed().as_secs_f64() * 1000.0),
            layer: span.layer,
            kind: "span-end".to_string(),
            name: span.name,
            status: status.to_string(),
            metadata: merged_metadata,
            error: error.as_deref().map(summarize_error),
        },
    );
}

#[tauri::command]
#[specta::specta]
pub fn telemetry_configure(
    state: State<'_, TelemetryManager>,
    config: TelemetryConfig,
) -> Result<(), String> {
    state.configure(config)
}

#[tauri::command]
#[specta::specta]
pub fn telemetry_get_status(
    app: AppHandle,
    state: State<'_, TelemetryManager>,
) -> Result<TelemetrySessionStatus, String> {
    state.status(&app)
}

#[tauri::command]
#[specta::specta]
pub fn telemetry_get_recent_records(
    state: State<'_, TelemetryManager>,
    limit: Option<usize>,
) -> Result<Vec<TelemetryRecord>, String> {
    state.recent_records(limit)
}

#[tauri::command]
#[specta::specta]
pub fn telemetry_record_frontend_batch(
    app: AppHandle,
    state: State<'_, TelemetryManager>,
    records: Vec<TelemetryRecord>,
) -> Result<(), String> {
    for record in records {
        state.record(&app, record)?;
    }
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn telemetry_export_support_bundle(
    app: AppHandle,
    state: State<'_, TelemetryManager>,
) -> Result<TelemetrySupportBundleResult, String> {
    state.export_support_bundle(&app)
}

#[tauri::command]
#[specta::specta]
pub fn telemetry_clear_sessions(
    app: AppHandle,
    state: State<'_, TelemetryManager>,
) -> Result<(), String> {
    state.clear_sessions(&app)
}
