use std::path::PathBuf;

use serde_json::Value;
use tauri::{AppHandle, Manager};

use crate::{
    gpu_runtime::GpuRuntimeManager, indexing::PathIndexManager,
    native_surface::NativeSurfaceManager, native_task_graph::NativeTaskGraphManager,
    preview_streaming::PreviewStreamingManager, runtime_pipeline::HostEventBusState,
    telemetry::TelemetryManager,
};

pub fn initialize_greeblefs_dev_observatory(app: &AppHandle) -> Result<(), String> {
    let mut config = tauri::dev_observatory::DevObservatoryConfig::dev_default("GreebleFS");
    if let Some(log_path) = resolve_dev_log_path() {
        config.log_file_paths.push(log_path);
    }
    tauri::dev_observatory::init(app, config)?;

    let app_for_runtime = app.clone();
    tauri::dev_observatory::register_json_provider(
        app,
        "greeblefs.runtime",
        "GreebleFS Runtime",
        move || build_greeblefs_runtime_snapshot(&app_for_runtime),
    )
}

pub fn build_greeblefs_runtime_snapshot(app: &AppHandle) -> Result<Value, String> {
    let telemetry_status = app
        .try_state::<TelemetryManager>()
        .map(|state| crate::telemetry::telemetry_get_status(app.clone(), state))
        .transpose()?;
    let telemetry_records = app
        .try_state::<TelemetryManager>()
        .map(|state| crate::telemetry::telemetry_get_recent_records(state, Some(60)))
        .transpose()?;
    let native_task_graph = app
        .try_state::<NativeTaskGraphManager>()
        .map(|state| {
            serde_json::to_value(serde_json::json!({
                "policy": state.policy(),
                "telemetry": state.telemetry_snapshot(),
            }))
        })
        .transpose()
        .map_err(|error| format!("Failed to serialize native task graph telemetry: {error}"))?;
    let preview_streaming = app
        .try_state::<PreviewStreamingManager>()
        .map(|state| {
            serde_json::to_value(serde_json::json!({
                "policy": state.policy(),
            }))
        })
        .transpose()
        .map_err(|error| format!("Failed to serialize preview streaming policy: {error}"))?;
    let path_index = app
        .try_state::<PathIndexManager>()
        .map(|state| {
            let status = state.status()?;
            serde_json::to_value(status)
                .map_err(|error| format!("Failed to serialize path index status: {error}"))
        })
        .transpose()?;
    let host_event_rings = app
        .try_state::<HostEventBusState>()
        .map(|state| serde_json::to_value(state.ring_telemetry_snapshot()))
        .transpose()
        .map_err(|error| format!("Failed to serialize host-event ring telemetry: {error}"))?;
    let native_buffer_pool = app
        .try_state::<tauri::native_buffer_pool::NativeBufferPoolState>()
        .map(|state| serde_json::to_value(state.telemetry()))
        .transpose()
        .map_err(|error| format!("Failed to serialize native buffer pool telemetry: {error}"))?;
    let native_byte_stream = app
        .try_state::<tauri::native_stream::NativeByteStreamState>()
        .map(|state| serde_json::to_value(state.telemetry_snapshot()))
        .transpose()
        .map_err(|error| format!("Failed to serialize native byte stream telemetry: {error}"))?;
    let gpu = app
        .try_state::<GpuRuntimeManager>()
        .map(|state| serde_json::to_value(state.status_snapshot()))
        .transpose()
        .map_err(|error| format!("Failed to serialize GPU runtime status: {error}"))?;
    let native_surface = app
        .try_state::<NativeSurfaceManager>()
        .map(|state| serde_json::to_value(state.telemetry()))
        .transpose()
        .map_err(|error| format!("Failed to serialize native surface telemetry: {error}"))?;
    let telemetry_recent_records_ring = telemetry_status
        .as_ref()
        .map(|status| serde_json::to_value(&status.recent_records_telemetry))
        .transpose()
        .map_err(|error| format!("Failed to serialize telemetry recent-record ring: {error}"))?;

    Ok(serde_json::json!({
        "generatedAtUnixMs": current_unix_ms(),
        "telemetryStatus": telemetry_status,
        "telemetryRecords": telemetry_records,
        "nativeTaskGraph": native_task_graph,
        "previewStreaming": preview_streaming,
        "pathIndex": path_index,
        "messageRings": {
            "hostEvents": host_event_rings,
            "telemetryRecentRecords": telemetry_recent_records_ring
        },
        "nativeBuffers": {
            "nativeBufferPool": native_buffer_pool.clone(),
            "nativeByteStream": native_byte_stream,
            "nativeRing": {
                "available": cfg!(target_os = "windows"),
                "globalTelemetry": null,
                "mode": "benchmark-probe-scoped",
                "benchmarkRpc": "diagnostics.native_ring_benchmark"
            }
        },
        "gpu": gpu,
        "nativeSurface": native_surface,
        "nativePool": {
            "explorer": native_buffer_pool,
            "note": "Renderer-side attempts/success/fallbacks are mirrored through native buffer pool, native byte-stream, and observatory event telemetry."
        }
    }))
}

fn current_unix_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

fn resolve_dev_log_path() -> Option<PathBuf> {
    std::env::var_os("GREEBLEFS_MCP_LOG_FILE")
        .map(PathBuf::from)
        .or_else(|| {
            std::env::current_dir()
                .ok()
                .map(|cwd| cwd.join("MCP").join(".state").join("tauri-dev.log"))
        })
}
