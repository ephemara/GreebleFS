use axum::extract::State;
use axum::routing::{get, post};
use axum::{Json, Router};
use greeblefs_index_core::{
    ensure_path_index_schema, load_volume_states, mark_volume_error, normalize_drive_root,
    open_index_connection, PathIndexCancellation, PathIndexRootSummary, PathIndexVolumeState,
    UsnJournalOptions, WINDOWS_USN_SERVICE_SOURCE,
};
use std::collections::HashMap;
#[cfg(target_os = "windows")]
use std::ffi::OsString;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::time::Duration;
use tokio::sync::oneshot;
use uuid::Uuid;

const SERVICE_NAME: &str = "GreebleFSUsnIndexer";
const SERVICE_URL: &str = "127.0.0.1:12462";

#[derive(Clone)]
struct DaemonState {
    inner: Arc<DaemonStateInner>,
}

struct DaemonStateInner {
    profile_db_path: Mutex<Option<PathBuf>>,
    active_jobs: Mutex<Vec<DaemonIndexJobStatus>>,
    monitored_drives: Mutex<HashMap<String, Arc<AtomicBool>>>,
    cancellation: Arc<AtomicBool>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct DaemonIndexJobStatus {
    task_id: String,
    drive_root: String,
    state: String,
    last_error: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct HealthResponse {
    ok: bool,
    service_name: String,
    service_url: String,
    profile_registered: bool,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct RegisterProfileRequest {
    database_path: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct RegisterProfileResponse {
    database_path: String,
    registered: bool,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct DaemonStatusResponse {
    service_name: String,
    service_url: String,
    profile_db_path: Option<String>,
    active_jobs: Vec<DaemonIndexJobStatus>,
    volumes: Vec<PathIndexVolumeState>,
    last_error: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct JournalRequest {
    drive_root: String,
    maximum_size_bytes: Option<u64>,
    allocation_delta_bytes: Option<u64>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct IndexRequest {
    drive_root: String,
    force_rebuild: Option<bool>,
    maximum_size_bytes: Option<u64>,
    allocation_delta_bytes: Option<u64>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct IndexResponse {
    task_id: String,
    drive_root: String,
    state: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct RebuildResponse {
    task_id: String,
    drive_root: String,
    state: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct CancelResponse {
    cancelled: bool,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct ErrorResponse {
    error: String,
}

type DaemonResult<T> = Result<Json<T>, (axum::http::StatusCode, Json<ErrorResponse>)>;

#[tokio::main]
async fn main() {
    if let Err(error) = entrypoint().await {
        eprintln!("GreebleFS USN daemon failed: {error}");
        std::process::exit(1);
    }
}

async fn entrypoint() -> Result<(), String> {
    let args = std::env::args().collect::<Vec<_>>();
    if args.iter().any(|arg| arg == "--service") {
        #[cfg(target_os = "windows")]
        {
            return run_windows_service();
        }
        #[cfg(not(target_os = "windows"))]
        {
            return Err("The GreebleFS USN daemon service mode is Windows-only".to_string());
        }
    }

    run_http_server(async move {
        let _ = tokio::signal::ctrl_c().await;
    })
    .await
}

#[cfg(target_os = "windows")]
windows_service::define_windows_service!(ffi_service_main, service_main);

#[cfg(target_os = "windows")]
fn run_windows_service() -> Result<(), String> {
    windows_service::service_dispatcher::start(SERVICE_NAME, ffi_service_main)
        .map_err(|error| format!("Failed to start Windows service dispatcher: {error}"))
}

#[cfg(target_os = "windows")]
fn service_main(_arguments: Vec<OsString>) {
    if let Err(error) = run_windows_service_inner() {
        eprintln!("GreebleFS USN Windows service exited with error: {error}");
    }
}

#[cfg(target_os = "windows")]
fn run_windows_service_inner() -> Result<(), String> {
    use windows_service::service::{
        ServiceControl, ServiceControlAccept, ServiceExitCode, ServiceState, ServiceStatus,
        ServiceType,
    };
    use windows_service::service_control_handler::{self, ServiceControlHandlerResult};

    let (stop_tx, stop_rx) = mpsc::channel::<()>();
    let status_handle = service_control_handler::register(SERVICE_NAME, move |event| match event {
        ServiceControl::Stop | ServiceControl::Shutdown => {
            let _ = stop_tx.send(());
            ServiceControlHandlerResult::NoError
        }
        _ => ServiceControlHandlerResult::NotImplemented,
    })
    .map_err(|error| format!("Failed to register service control handler: {error}"))?;

    status_handle
        .set_service_status(ServiceStatus {
            service_type: ServiceType::OWN_PROCESS,
            current_state: ServiceState::Running,
            controls_accepted: ServiceControlAccept::STOP | ServiceControlAccept::SHUTDOWN,
            exit_code: ServiceExitCode::Win32(0),
            checkpoint: 0,
            wait_hint: Duration::from_secs(10),
            process_id: None,
        })
        .map_err(|error| format!("Failed to set service running status: {error}"))?;

    let runtime = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .map_err(|error| format!("Failed to create daemon runtime: {error}"))?;
    runtime.block_on(async move {
        let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();
        std::thread::spawn(move || {
            let _ = stop_rx.recv();
            let _ = shutdown_tx.send(());
        });
        run_http_server(async move {
            let _ = shutdown_rx.await;
        })
        .await
    })?;

    status_handle
        .set_service_status(ServiceStatus {
            service_type: ServiceType::OWN_PROCESS,
            current_state: ServiceState::Stopped,
            controls_accepted: ServiceControlAccept::empty(),
            exit_code: ServiceExitCode::Win32(0),
            checkpoint: 0,
            wait_hint: Duration::from_secs(0),
            process_id: None,
        })
        .map_err(|error| format!("Failed to set service stopped status: {error}"))?;
    Ok(())
}

async fn run_http_server<F>(shutdown: F) -> Result<(), String>
where
    F: std::future::Future<Output = ()> + Send + 'static,
{
    let state = DaemonState {
        inner: Arc::new(DaemonStateInner {
            profile_db_path: Mutex::new(None),
            active_jobs: Mutex::new(Vec::new()),
            monitored_drives: Mutex::new(HashMap::new()),
            cancellation: Arc::new(AtomicBool::new(false)),
        }),
    };
    let app = Router::new()
        .route("/health", get(health))
        .route("/profile/register", post(register_profile))
        .route("/status", get(status))
        .route("/journal/ensure", post(journal_ensure))
        .route("/index/start", post(index_start))
        .route("/index/rebuild", post(index_rebuild))
        .route("/index/cancel", post(index_cancel))
        .with_state(state);
    let address: SocketAddr = SERVICE_URL
        .parse()
        .map_err(|error| format!("Invalid daemon bind address: {error}"))?;
    let listener = tokio::net::TcpListener::bind(address)
        .await
        .map_err(|error| format!("Failed to bind GreebleFS USN daemon at {address}: {error}"))?;
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown)
        .await
        .map_err(|error| format!("GreebleFS USN daemon HTTP server failed: {error}"))
}

async fn health(State(state): State<DaemonState>) -> Json<HealthResponse> {
    Json(HealthResponse {
        ok: true,
        service_name: SERVICE_NAME.to_string(),
        service_url: format!("http://{SERVICE_URL}"),
        profile_registered: state.profile_db_path().is_some(),
    })
}

async fn register_profile(
    State(state): State<DaemonState>,
    Json(request): Json<RegisterProfileRequest>,
) -> DaemonResult<RegisterProfileResponse> {
    let db_path = PathBuf::from(request.database_path.trim());
    ensure_path_index_schema(&db_path).map_err(http_error)?;
    state
        .set_profile_db_path(db_path.clone())
        .map_err(http_error)?;
    Ok(Json(RegisterProfileResponse {
        database_path: db_path.to_string_lossy().to_string(),
        registered: true,
    }))
}

async fn status(State(state): State<DaemonState>) -> Json<DaemonStatusResponse> {
    let profile_db_path = state.profile_db_path();
    let (volumes, last_error) = if let Some(db_path) = profile_db_path.as_ref() {
        match load_volume_states(db_path) {
            Ok(volumes) => (volumes, None),
            Err(error) => (Vec::new(), Some(error)),
        }
    } else {
        (Vec::new(), None)
    };
    Json(DaemonStatusResponse {
        service_name: SERVICE_NAME.to_string(),
        service_url: format!("http://{SERVICE_URL}"),
        profile_db_path: profile_db_path.map(|path| path.to_string_lossy().to_string()),
        active_jobs: state.active_jobs(),
        volumes,
        last_error,
    })
}

async fn journal_ensure(
    Json(request): Json<JournalRequest>,
) -> DaemonResult<greeblefs_index_core::windows_usn::WindowsUsnJournalState> {
    let drive_root =
        normalize_drive_root(&PathBuf::from(request.drive_root.trim())).map_err(http_error)?;
    let options =
        journal_options_from_request(request.maximum_size_bytes, request.allocation_delta_bytes);
    let journal = greeblefs_index_core::windows_usn::ensure_usn_journal(&drive_root, &options)
        .map_err(http_error)?;
    Ok(Json(journal))
}

async fn index_start(
    State(state): State<DaemonState>,
    Json(request): Json<IndexRequest>,
) -> DaemonResult<IndexResponse> {
    spawn_index_job(state, request, false).await.map(Json)
}

async fn index_rebuild(
    State(state): State<DaemonState>,
    Json(request): Json<IndexRequest>,
) -> DaemonResult<RebuildResponse> {
    let response = spawn_index_job(state, request, true).await?;
    Ok(Json(RebuildResponse {
        task_id: response.task_id,
        drive_root: response.drive_root,
        state: response.state,
    }))
}

async fn index_cancel(State(state): State<DaemonState>) -> Json<CancelResponse> {
    state.inner.cancellation.store(true, Ordering::SeqCst);
    Json(CancelResponse { cancelled: true })
}

async fn spawn_index_job(
    state: DaemonState,
    request: IndexRequest,
    force_rebuild: bool,
) -> Result<IndexResponse, (axum::http::StatusCode, Json<ErrorResponse>)> {
    let db_path = state.profile_db_path().ok_or_else(|| {
        http_error("No GreebleFS profile database is registered with the daemon.")
    })?;
    let drive_root =
        normalize_drive_root(&PathBuf::from(request.drive_root.trim())).map_err(http_error)?;
    let drive_root_label = drive_root.to_string_lossy().to_string();
    if let Some(existing) = state.active_job_for_drive_root(&drive_root_label) {
        return Ok(IndexResponse {
            task_id: existing.task_id,
            drive_root: existing.drive_root,
            state: existing.state,
        });
    }
    let task_id = Uuid::new_v4().to_string();
    let task_state = if force_rebuild {
        "rebuilding"
    } else {
        "building"
    }
    .to_string();
    state.inner.cancellation.store(false, Ordering::SeqCst);
    state
        .upsert_job(DaemonIndexJobStatus {
            task_id: task_id.clone(),
            drive_root: drive_root_label.clone(),
            state: task_state.clone(),
            last_error: None,
        })
        .map_err(http_error)?;
    let cancellation = Arc::clone(&state.inner.cancellation);
    let state_for_task = state.clone();
    let task_id_for_task = task_id.clone();
    let drive_root_for_task = drive_root.clone();
    let options =
        journal_options_from_request(request.maximum_size_bytes, request.allocation_delta_bytes);

    tokio::task::spawn_blocking(move || {
        let result = greeblefs_index_core::windows_usn::build_windows_usn_service_index(
            &db_path,
            &drive_root_for_task,
            &options,
            || {
                if cancellation.load(Ordering::SeqCst) {
                    PathIndexCancellation::Cancelled
                } else {
                    PathIndexCancellation::Continue
                }
            },
        );
        state_for_task.finish_job(&task_id_for_task, result);
    });

    Ok(IndexResponse {
        task_id,
        drive_root: drive_root_label,
        state: task_state,
    })
}

impl DaemonState {
    fn profile_db_path(&self) -> Option<PathBuf> {
        self.inner
            .profile_db_path
            .lock()
            .ok()
            .and_then(|value| value.clone())
    }

    fn set_profile_db_path(&self, path: PathBuf) -> Result<(), String> {
        let mut profile = self
            .inner
            .profile_db_path
            .lock()
            .map_err(|_| "USN daemon profile path state is poisoned".to_string())?;
        if profile.as_ref() != Some(&path) {
            self.stop_tail_monitors();
        }
        *profile = Some(path);
        Ok(())
    }

    fn active_jobs(&self) -> Vec<DaemonIndexJobStatus> {
        self.inner
            .active_jobs
            .lock()
            .map(|jobs| jobs.clone())
            .unwrap_or_default()
    }

    fn active_job_for_drive_root(&self, drive_root: &str) -> Option<DaemonIndexJobStatus> {
        self.inner.active_jobs.lock().ok().and_then(|jobs| {
            jobs.iter()
                .find(|job| {
                    job.drive_root.eq_ignore_ascii_case(drive_root)
                        && matches!(job.state.as_str(), "building" | "rebuilding")
                })
                .cloned()
        })
    }

    fn upsert_job(&self, next: DaemonIndexJobStatus) -> Result<(), String> {
        let mut jobs = self
            .inner
            .active_jobs
            .lock()
            .map_err(|_| "USN daemon job state is poisoned".to_string())?;
        if let Some(job) = jobs.iter_mut().find(|job| job.task_id == next.task_id) {
            *job = next;
        } else {
            jobs.push(next);
        }
        Ok(())
    }

    fn finish_job(&self, task_id: &str, result: Result<PathIndexRootSummary, String>) {
        let mut ready_summary = None;
        let mut error_result = None;
        if let Ok(mut jobs) = self.inner.active_jobs.lock() {
            if let Some(job_index) = jobs.iter().position(|job| job.task_id == task_id) {
                let job = jobs.remove(job_index);
                match result {
                    Ok(summary) => {
                        ready_summary = Some(summary);
                    }
                    Err(error) => {
                        error_result = Some((job.drive_root, error));
                    }
                }
            }
        }
        if let Some((drive_root, error)) = error_result {
            if let Some(db_path) = self.profile_db_path() {
                if let Ok(connection) = open_index_connection(&db_path) {
                    let _ = mark_volume_error(
                        &connection,
                        PathBuf::from(&drive_root).as_path(),
                        WINDOWS_USN_SERVICE_SOURCE,
                        &error,
                    );
                }
            }
        }
        if let Some(summary) = ready_summary {
            self.start_tail_monitor(summary);
        }
    }

    fn stop_tail_monitors(&self) {
        if let Ok(mut monitors) = self.inner.monitored_drives.lock() {
            for (_, stop) in monitors.drain() {
                stop.store(true, Ordering::SeqCst);
            }
        }
    }

    fn start_tail_monitor(&self, summary: PathIndexRootSummary) {
        let Some(db_path) = self.profile_db_path() else {
            return;
        };
        let Some(journal_id) = summary.journal_id else {
            return;
        };
        let Some(mut cursor) = summary.last_usn else {
            return;
        };
        let drive_root = summary.root_path;
        let drive_key = drive_root.to_ascii_lowercase();
        let stop = Arc::new(AtomicBool::new(false));
        if let Ok(mut monitors) = self.inner.monitored_drives.lock() {
            if let Some(previous) = monitors.insert(drive_key, Arc::clone(&stop)) {
                previous.store(true, Ordering::SeqCst);
            }
        }

        let state = self.clone();
        thread::spawn(move || {
            let drive_root_path = PathBuf::from(&drive_root);
            let options = UsnJournalOptions::default();
            loop {
                if stop.load(Ordering::SeqCst) {
                    break;
                }
                match greeblefs_index_core::windows_usn::read_windows_usn_tail_marker(
                    &drive_root_path,
                    journal_id,
                    cursor,
                ) {
                    Ok(marker) if marker.requires_rebuild => {
                        let task_id = Uuid::new_v4().to_string();
                        let reason = marker
                            .rebuild_reason
                            .clone()
                            .unwrap_or_else(|| "USN journal requires a rebuild".to_string());
                        let _ = state.upsert_job(DaemonIndexJobStatus {
                            task_id: task_id.clone(),
                            drive_root: drive_root.clone(),
                            state: "rebuilding".to_string(),
                            last_error: Some(reason),
                        });
                        let result =
                            greeblefs_index_core::windows_usn::build_windows_usn_service_index(
                                &db_path,
                                &drive_root_path,
                                &options,
                                || {
                                    if stop.load(Ordering::SeqCst) {
                                        PathIndexCancellation::Cancelled
                                    } else {
                                        PathIndexCancellation::Continue
                                    }
                                },
                            );
                        state.finish_job(&task_id, result);
                        break;
                    }
                    Ok(marker) => {
                        cursor = marker.next_usn;
                        let _ = greeblefs_index_core::windows_usn::update_windows_usn_tail_marker(
                            &db_path, &marker,
                        );
                    }
                    Err(error) => {
                        if let Ok(connection) = open_index_connection(&db_path) {
                            let _ = mark_volume_error(
                                &connection,
                                &drive_root_path,
                                WINDOWS_USN_SERVICE_SOURCE,
                                &error,
                            );
                        }
                    }
                }
                thread::sleep(Duration::from_millis(1200));
            }
        });
    }
}

fn journal_options_from_request(
    maximum_size_bytes: Option<u64>,
    allocation_delta_bytes: Option<u64>,
) -> UsnJournalOptions {
    let defaults = UsnJournalOptions::default();
    UsnJournalOptions {
        maximum_size_bytes: maximum_size_bytes.unwrap_or(defaults.maximum_size_bytes),
        allocation_delta_bytes: allocation_delta_bytes.unwrap_or(defaults.allocation_delta_bytes),
    }
}

fn http_error<T: ToString>(error: T) -> (axum::http::StatusCode, Json<ErrorResponse>) {
    (
        axum::http::StatusCode::BAD_REQUEST,
        Json(ErrorResponse {
            error: error.to_string(),
        }),
    )
}
