use crate::explorer_path_key::ExplorerPathKey;
use crate::indexing::{PathIndexManager, PathIndexStartResponse};
use greeblefs_index_core::{
    normalize_drive_root, PathIndexVolumeState, DEFAULT_USN_JOURNAL_ALLOCATION_DELTA_BYTES,
    DEFAULT_USN_JOURNAL_MAXIMUM_SIZE_BYTES,
};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use std::io::{Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::path::Path;
use std::process::Command;
use std::time::Duration;
use tauri::{AppHandle, Manager, State};

const SERVICE_NAME: &str = "GreebleFSUsnIndexer";
const DEFAULT_SERVICE_URL: &str = "http://127.0.0.1:12462";
const LOOPBACK_ADDRESS: &str = "127.0.0.1:12462";
const REQUEST_TIMEOUT: Duration = Duration::from_millis(900);

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PathIndexAccelerationVolumeStatus {
    pub volume_key: String,
    pub drive_root: String,
    pub journal_id: Option<u64>,
    pub last_usn: Option<i64>,
    pub lowest_valid_usn: Option<i64>,
    pub source: String,
    pub state: String,
    pub entry_count: u64,
    pub directory_count: u64,
    pub file_count: u64,
    pub last_indexed_at_ms: Option<u64>,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PathIndexAccelerationStatus {
    pub enabled: bool,
    pub platform_supported: bool,
    pub service_name: String,
    pub service_url: String,
    pub installed: bool,
    pub running: bool,
    pub process_elevated: bool,
    pub profile_registered: bool,
    pub database_path: String,
    pub volumes: Vec<PathIndexAccelerationVolumeStatus>,
    pub active_jobs: Vec<PathIndexAccelerationJobStatus>,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PathIndexAccelerationJobStatus {
    pub task_id: String,
    pub drive_root: String,
    pub state: String,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PathIndexAccelerationEnableRequest {
    pub drive_root: Option<String>,
    pub auto_index: Option<bool>,
    pub journal_maximum_size_bytes: Option<u64>,
    pub journal_allocation_delta_bytes: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PathIndexAccelerationEnableResponse {
    pub service_url: String,
    pub database_path: String,
    pub profile_registered: bool,
    pub journal_ensured: bool,
    pub task_id: Option<String>,
    pub drive_root: Option<String>,
    pub state: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PathIndexAccelerationRebuildRequest {
    pub drive_root: String,
    pub journal_maximum_size_bytes: Option<u64>,
    pub journal_allocation_delta_bytes: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RegisterProfileRequest {
    database_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RegisterProfileResponse {
    database_path: String,
    registered: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HealthResponse {
    ok: bool,
    service_name: String,
    service_url: String,
    profile_registered: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DaemonStatusResponse {
    service_name: String,
    service_url: String,
    profile_db_path: Option<String>,
    active_jobs: Vec<PathIndexAccelerationJobStatus>,
    volumes: Vec<PathIndexVolumeState>,
    last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct JournalRequest {
    drive_root: String,
    maximum_size_bytes: Option<u64>,
    allocation_delta_bytes: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct IndexRequest {
    drive_root: String,
    force_rebuild: Option<bool>,
    maximum_size_bytes: Option<u64>,
    allocation_delta_bytes: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct IndexResponse {
    task_id: String,
    drive_root: String,
    state: String,
}

#[tauri::command]
#[specta::specta]
pub fn path_index_acceleration_status(
    manager: State<'_, PathIndexManager>,
) -> Result<PathIndexAccelerationStatus, String> {
    acceleration_status_for_database(&manager.database_path())
}

#[tauri::command]
#[specta::specta]
pub fn path_index_acceleration_enable(
    manager: State<'_, PathIndexManager>,
    request: PathIndexAccelerationEnableRequest,
) -> Result<PathIndexAccelerationEnableResponse, String> {
    let database_path = manager.database_path();
    register_profile(&database_path)?;
    let drive_root = request
        .drive_root
        .as_deref()
        .map(|value| normalize_drive_root(Path::new(value)))
        .transpose()?;
    let journal_options = journal_request_options(
        request.journal_maximum_size_bytes,
        request.journal_allocation_delta_bytes,
    );
    let mut journal_ensured = false;
    let mut task_id = None;
    let mut state = "profileRegistered".to_string();

    if let Some(drive_root) = drive_root.as_ref() {
        let journal = daemon_post::<_, serde_json::Value>(
            "/journal/ensure",
            &JournalRequest {
                drive_root: drive_root.to_string_lossy().to_string(),
                maximum_size_bytes: Some(journal_options.0),
                allocation_delta_bytes: Some(journal_options.1),
            },
        )?;
        journal_ensured = journal.is_object();
        if request.auto_index.unwrap_or(true) {
            let response = daemon_post::<_, IndexResponse>(
                "/index/start",
                &IndexRequest {
                    drive_root: drive_root.to_string_lossy().to_string(),
                    force_rebuild: Some(false),
                    maximum_size_bytes: Some(journal_options.0),
                    allocation_delta_bytes: Some(journal_options.1),
                },
            )?;
            task_id = Some(response.task_id);
            state = response.state;
        }
    }

    Ok(PathIndexAccelerationEnableResponse {
        service_url: DEFAULT_SERVICE_URL.to_string(),
        database_path: database_path.to_string_lossy().to_string(),
        profile_registered: true,
        journal_ensured,
        task_id,
        drive_root: drive_root.map(|path| path.to_string_lossy().to_string()),
        state,
    })
}

#[tauri::command]
#[specta::specta]
pub fn path_index_acceleration_rebuild(
    manager: State<'_, PathIndexManager>,
    request: PathIndexAccelerationRebuildRequest,
) -> Result<PathIndexAccelerationEnableResponse, String> {
    let database_path = manager.database_path();
    register_profile(&database_path)?;
    let drive_root = normalize_drive_root(Path::new(&request.drive_root))?;
    let journal_options = journal_request_options(
        request.journal_maximum_size_bytes,
        request.journal_allocation_delta_bytes,
    );
    let response = daemon_post::<_, IndexResponse>(
        "/index/rebuild",
        &IndexRequest {
            drive_root: drive_root.to_string_lossy().to_string(),
            force_rebuild: Some(true),
            maximum_size_bytes: Some(journal_options.0),
            allocation_delta_bytes: Some(journal_options.1),
        },
    )?;
    Ok(PathIndexAccelerationEnableResponse {
        service_url: DEFAULT_SERVICE_URL.to_string(),
        database_path: database_path.to_string_lossy().to_string(),
        profile_registered: true,
        journal_ensured: true,
        task_id: Some(response.task_id),
        drive_root: Some(drive_root.to_string_lossy().to_string()),
        state: response.state,
    })
}

pub fn try_start_accelerated_index(
    db_path: &Path,
    requested_path: &Path,
    force_rebuild: bool,
) -> Result<PathIndexStartResponse, String> {
    if !windows_usn_acceleration_enabled() {
        return Err("Windows USN acceleration is disabled".to_string());
    }
    let drive_root = normalize_drive_root(requested_path)?;
    register_profile(db_path)?;
    let response = daemon_post::<_, IndexResponse>(
        "/index/start",
        &IndexRequest {
            drive_root: drive_root.to_string_lossy().to_string(),
            force_rebuild: Some(force_rebuild),
            maximum_size_bytes: Some(DEFAULT_USN_JOURNAL_MAXIMUM_SIZE_BYTES),
            allocation_delta_bytes: Some(DEFAULT_USN_JOURNAL_ALLOCATION_DELTA_BYTES),
        },
    )?;
    let root_key = ExplorerPathKey::from_path(&drive_root).into_string();
    Ok(PathIndexStartResponse {
        task_id: Some(response.task_id),
        root_path: drive_root.to_string_lossy().to_string(),
        root_key,
        state: response.state,
        source: "windowsUsnService".to_string(),
    })
}

pub fn windows_usn_acceleration_enabled() -> bool {
    std::env::var("GREEBLEFS_WINDOWS_USN_ACCELERATION_DISABLED")
        .map(|value| {
            !matches!(
                value.trim().to_ascii_lowercase().as_str(),
                "1" | "true" | "yes"
            )
        })
        .unwrap_or(true)
}

pub fn register_native_handlers(app: &AppHandle) -> Result<(), String> {
    let app_for_status = app.clone();
    tauri::native_control::register_handler(
        app,
        "explorer",
        "pathIndexAccelerationStatus",
        move |_request| {
            let manager = app_for_status.state::<PathIndexManager>();
            serialize_native_control_response(acceleration_status_for_database(
                &manager.database_path(),
            )?)
        },
    )?;

    let app_for_enable = app.clone();
    tauri::native_control::register_handler(
        app,
        "explorer",
        "pathIndexAccelerationEnable",
        move |request| {
            let args: PathIndexAccelerationEnableRequest = parse_native_args(request)?;
            let manager = app_for_enable.state::<PathIndexManager>();
            serialize_native_control_response(path_index_acceleration_enable(manager, args)?)
        },
    )?;

    let app_for_rebuild = app.clone();
    tauri::native_control::register_handler(
        app,
        "explorer",
        "pathIndexAccelerationRebuild",
        move |request| {
            let args: PathIndexAccelerationRebuildRequest = parse_native_args(request)?;
            let manager = app_for_rebuild.state::<PathIndexManager>();
            serialize_native_control_response(path_index_acceleration_rebuild(manager, args)?)
        },
    )?;

    Ok(())
}

fn acceleration_status_for_database(db_path: &Path) -> Result<PathIndexAccelerationStatus, String> {
    let service_state = query_service_state();
    let health = daemon_get::<HealthResponse>("/health").ok();
    let daemon_status = daemon_get::<DaemonStatusResponse>("/status").ok();
    let running = health
        .as_ref()
        .map(|value| value.ok)
        .unwrap_or(service_state.running);
    let last_error = if running {
        daemon_status
            .as_ref()
            .and_then(|status| status.last_error.clone())
    } else {
        Some(service_state.last_error.unwrap_or_else(|| {
            "GreebleFS USN daemon is not reachable at http://127.0.0.1:12462".to_string()
        }))
    };

    Ok(PathIndexAccelerationStatus {
        enabled: windows_usn_acceleration_enabled(),
        platform_supported: cfg!(target_os = "windows"),
        service_name: SERVICE_NAME.to_string(),
        service_url: DEFAULT_SERVICE_URL.to_string(),
        installed: service_state.installed,
        running,
        process_elevated: is_process_elevated_best_effort(),
        profile_registered: health
            .map(|value| value.profile_registered)
            .or_else(|| {
                daemon_status
                    .as_ref()
                    .map(|value| value.profile_db_path.is_some())
            })
            .unwrap_or(false),
        database_path: db_path.to_string_lossy().to_string(),
        volumes: daemon_status
            .as_ref()
            .map(|status| status.volumes.iter().map(volume_status_from_core).collect())
            .unwrap_or_default(),
        active_jobs: daemon_status
            .map(|status| status.active_jobs)
            .unwrap_or_default(),
        last_error,
    })
}

fn register_profile(db_path: &Path) -> Result<RegisterProfileResponse, String> {
    daemon_post(
        "/profile/register",
        &RegisterProfileRequest {
            database_path: db_path.to_string_lossy().to_string(),
        },
    )
}

fn journal_request_options(maximum: Option<u64>, allocation_delta: Option<u64>) -> (u64, u64) {
    (
        maximum.unwrap_or(DEFAULT_USN_JOURNAL_MAXIMUM_SIZE_BYTES),
        allocation_delta.unwrap_or(DEFAULT_USN_JOURNAL_ALLOCATION_DELTA_BYTES),
    )
}

fn volume_status_from_core(volume: &PathIndexVolumeState) -> PathIndexAccelerationVolumeStatus {
    PathIndexAccelerationVolumeStatus {
        volume_key: volume.volume_key.clone(),
        drive_root: volume.drive_root.clone(),
        journal_id: volume.journal_id,
        last_usn: volume.last_usn,
        lowest_valid_usn: volume.lowest_valid_usn,
        source: volume.source.clone(),
        state: volume.state.clone(),
        entry_count: volume.entry_count,
        directory_count: volume.directory_count,
        file_count: volume.file_count,
        last_indexed_at_ms: volume.last_indexed_at_ms,
        last_error: volume.last_error.clone(),
    }
}

fn daemon_get<T: DeserializeOwned>(path: &str) -> Result<T, String> {
    daemon_request("GET", path, None)
}

fn daemon_post<TRequest: Serialize, TResponse: DeserializeOwned>(
    path: &str,
    body: &TRequest,
) -> Result<TResponse, String> {
    let body = serde_json::to_vec(body)
        .map_err(|error| format!("Failed to serialize daemon request: {error}"))?;
    daemon_request("POST", path, Some(body))
}

fn daemon_request<T: DeserializeOwned>(
    method: &str,
    path: &str,
    body: Option<Vec<u8>>,
) -> Result<T, String> {
    let address: SocketAddr = LOOPBACK_ADDRESS
        .parse()
        .map_err(|error| format!("Invalid USN daemon address: {error}"))?;
    let mut stream = TcpStream::connect_timeout(&address, REQUEST_TIMEOUT)
        .map_err(|error| format!("GreebleFS USN daemon is not reachable: {error}"))?;
    stream
        .set_read_timeout(Some(REQUEST_TIMEOUT))
        .map_err(|error| format!("Failed to set daemon read timeout: {error}"))?;
    stream
        .set_write_timeout(Some(REQUEST_TIMEOUT))
        .map_err(|error| format!("Failed to set daemon write timeout: {error}"))?;
    let body = body.unwrap_or_default();
    let request = format!(
        "{method} {path} HTTP/1.1\r\nHost: {LOOPBACK_ADDRESS}\r\nConnection: close\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n",
        body.len()
    );
    stream
        .write_all(request.as_bytes())
        .and_then(|_| stream.write_all(&body))
        .map_err(|error| format!("Failed to write daemon request: {error}"))?;
    let mut response = Vec::new();
    stream
        .read_to_end(&mut response)
        .map_err(|error| format!("Failed to read daemon response: {error}"))?;
    parse_http_json_response(&response)
}

fn parse_http_json_response<T: DeserializeOwned>(response: &[u8]) -> Result<T, String> {
    let response = String::from_utf8_lossy(response);
    let (headers, body) = response
        .split_once("\r\n\r\n")
        .ok_or_else(|| "Daemon returned a malformed HTTP response".to_string())?;
    let status_line = headers.lines().next().unwrap_or_default();
    let status_code = status_line
        .split_whitespace()
        .nth(1)
        .and_then(|value| value.parse::<u16>().ok())
        .unwrap_or(0);
    if !(200..300).contains(&status_code) {
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(body) {
            if let Some(error) = value.get("error").and_then(|value| value.as_str()) {
                return Err(error.to_string());
            }
        }
        return Err(format!("Daemon returned HTTP {status_code}: {body}"));
    }
    serde_json::from_str(body)
        .map_err(|error| format!("Failed to parse daemon JSON response: {error}; body={body}"))
}

#[derive(Debug, Clone)]
struct ServiceState {
    installed: bool,
    running: bool,
    last_error: Option<String>,
}

fn query_service_state() -> ServiceState {
    #[cfg(target_os = "windows")]
    {
        let output = Command::new("sc.exe")
            .args(["query", SERVICE_NAME])
            .output();
        match output {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let stderr = String::from_utf8_lossy(&output.stderr);
                let text = format!("{stdout}{stderr}");
                ServiceState {
                    installed: output.status.success() || text.contains(SERVICE_NAME),
                    running: text.contains("RUNNING"),
                    last_error: if output.status.success() {
                        None
                    } else {
                        Some(text.trim().to_string())
                    },
                }
            }
            Err(error) => ServiceState {
                installed: false,
                running: false,
                last_error: Some(format!("Failed to query Windows service: {error}")),
            },
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        ServiceState {
            installed: false,
            running: false,
            last_error: Some("Windows USN acceleration is Windows-only".to_string()),
        }
    }
}

fn is_process_elevated_best_effort() -> bool {
    #[cfg(target_os = "windows")]
    {
        use windows_sys::Win32::Foundation::CloseHandle;
        use windows_sys::Win32::Security::{
            GetTokenInformation, TokenElevation, TOKEN_ELEVATION, TOKEN_QUERY,
        };
        use windows_sys::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};

        unsafe {
            let mut token = std::ptr::null_mut();
            if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) == 0 {
                return false;
            }
            let mut elevation = std::mem::zeroed::<TOKEN_ELEVATION>();
            let mut returned_bytes = 0u32;
            let ok = GetTokenInformation(
                token,
                TokenElevation,
                &mut elevation as *mut TOKEN_ELEVATION as *mut _,
                std::mem::size_of::<TOKEN_ELEVATION>() as u32,
                &mut returned_bytes,
            ) != 0;
            let _ = CloseHandle(token);
            ok && elevation.TokenIsElevated != 0
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        false
    }
}

fn parse_native_args<T: for<'de> Deserialize<'de>>(
    request: tauri::native_control::NativeControlRequest,
) -> Result<T, String> {
    serde_json::from_value(request.args)
        .map_err(|error| format!("Invalid path index acceleration native args: {error}"))
}

fn serialize_native_control_response<T: Serialize>(
    response: T,
) -> Result<serde_json::Value, String> {
    serde_json::to_value(response).map_err(|error| {
        format!("Failed to serialize path index acceleration native response: {error}")
    })
}
