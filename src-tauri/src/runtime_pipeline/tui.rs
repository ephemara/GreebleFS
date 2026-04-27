//! `native-tui` runtimes route into the existing terminal infrastructure.
//!
//! v1 returns a launch descriptor the frontend can hand to `terminal_open_external`
//! so the TUI lands in an embedded terminal pane. We deliberately do not invent
//! a separate console host.

use serde::Serialize;

use crate::runtime_pipeline::manifest::{RuntimeKind, RuntimeManifest};

#[derive(Debug, Clone, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ExternalRuntimeTuiLaunch {
    pub runtime_id: String,
    pub command: String,
    pub args: Vec<String>,
    pub working_directory: String,
    pub label: String,
    pub treat_zero_exit_as_success: bool,
}

pub fn build_tui_launch(
    manifest: &RuntimeManifest,
    binary_path: String,
) -> Result<ExternalRuntimeTuiLaunch, String> {
    if !matches!(manifest.kind, RuntimeKind::NativeTui) {
        return Err(format!(
            "runtime {} is not a native-tui (kind = {})",
            manifest.id,
            manifest.kind.as_str()
        ));
    }
    let label = manifest
        .tui
        .as_ref()
        .and_then(|cfg| cfg.label.clone())
        .unwrap_or_else(|| manifest.display_name.clone());
    let treat_zero_exit_as_success = manifest
        .tui
        .as_ref()
        .map(|cfg| cfg.treat_zero_exit_as_success)
        .unwrap_or(true);
    let working_directory = manifest
        .working_directory
        .clone()
        .unwrap_or_else(|| manifest.module_dir.clone());
    Ok(ExternalRuntimeTuiLaunch {
        runtime_id: manifest.id.clone(),
        command: binary_path,
        args: manifest.args.clone(),
        working_directory,
        label,
        treat_zero_exit_as_success,
    })
}
