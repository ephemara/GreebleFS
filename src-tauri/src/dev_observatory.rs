use std::path::PathBuf;

use serde_json::Value;
use tauri::{AppHandle, Manager};

use crate::{
    gpu_runtime::GpuRuntimeManager, native_task_graph::NativeTaskGraphManager,
    preview_streaming::PreviewStreamingManager, telemetry::TelemetryManager,
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

fn build_greeblefs_runtime_snapshot(app: &AppHandle) -> Result<Value, String> {
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
        .map(|state| serde_json::to_value(state.telemetry_snapshot()))
        .transpose()
        .map_err(|error| format!("Failed to serialize native task graph telemetry: {error}"))?;
    let preview_streaming = app
        .try_state::<PreviewStreamingManager>()
        .map(|state| serde_json::to_value(state.policy()))
        .transpose()
        .map_err(|error| format!("Failed to serialize preview streaming policy: {error}"))?;
    let gpu = app
        .try_state::<GpuRuntimeManager>()
        .map(|state| serde_json::to_value(state.status_snapshot()))
        .transpose()
        .map_err(|error| format!("Failed to serialize GPU runtime status: {error}"))?;

    Ok(serde_json::json!({
        "telemetryStatus": telemetry_status,
        "telemetryRecords": telemetry_records,
        "nativeTaskGraph": native_task_graph,
        "previewStreaming": preview_streaming,
        "gpu": gpu,
        "nativePool": {
            "explorer": null,
            "note": "Renderer-side native pool attempts/success/fallbacks are published as dev observatory events."
        }
    }))
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
