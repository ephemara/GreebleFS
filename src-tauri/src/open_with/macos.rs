use crate::open_with::types::{
    AssociatedProgram, AssociatedProgramLaunchKind, GetAssociatedProgramsResult, OpenWithResult,
};
use file_opening::{FileOpener, OpenResult};
use file_opening_macos::MacFileOpener;
use std::path::Path;
use std::process::Command;

pub fn get_associated_programs_impl(file_path: &str) -> GetAssociatedProgramsResult {
    let path = Path::new(file_path);
    if !path.exists() {
        return GetAssociatedProgramsResult {
            success: false,
            recommended_programs: vec![],
            other_programs: vec![],
            default_program: None,
            error: Some(format!("Path not found: {}", file_path)),
        };
    }

    let opener = MacFileOpener;
    match opener.get_apps_for_file(path) {
        Ok(apps) => GetAssociatedProgramsResult {
            success: true,
            recommended_programs: apps
                .into_iter()
                .map(|app| {
                    let launch_id = app.id;
                    AssociatedProgram {
                        name: app.name,
                        path: launch_id.clone(),
                        launch_id: Some(launch_id),
                        launch_kind: Some(AssociatedProgramLaunchKind::BundleId),
                        executable_path: None,
                        icon: app.icon,
                        is_default: false,
                    }
                })
                .collect(),
            other_programs: vec![],
            default_program: None,
            error: None,
        },
        Err(error) => GetAssociatedProgramsResult {
            success: false,
            recommended_programs: vec![],
            other_programs: vec![],
            default_program: None,
            error: Some(error),
        },
    }
}

pub fn open_with_application(program_id: &str, file_path: &str) -> OpenWithResult {
    let path = Path::new(file_path);
    if !path.exists() {
        return OpenWithResult {
            success: false,
            error: Some(format!("File not found: {}", file_path)),
        };
    }

    let opener = MacFileOpener;
    match opener.open_with_app(path, program_id) {
        Ok(result) => map_open_result(result),
        Err(error) => OpenWithResult {
            success: false,
            error: Some(error),
        },
    }
}

pub fn open_native_open_with_dialog_impl(file_path: &str) -> OpenWithResult {
    let path = Path::new(file_path);
    if !path.exists() {
        return OpenWithResult {
            success: false,
            error: Some(format!("File not found: {}", file_path)),
        };
    }

    let script = format!(
        "set targetFile to POSIX file \"{}\"\nset chosenApp to choose application with prompt \"Open With\"\ntell application chosenApp\n  activate\n  open targetFile\nend tell",
        escape_applescript_string(file_path)
    );

    match Command::new("osascript").arg("-e").arg(script).spawn() {
        Ok(_) => OpenWithResult {
            success: true,
            error: None,
        },
        Err(spawn_error) => OpenWithResult {
            success: false,
            error: Some(format!("Failed to open dialog: {}", spawn_error)),
        },
    }
}

fn map_open_result(result: OpenResult) -> OpenWithResult {
    match result {
        OpenResult::Success => OpenWithResult {
            success: true,
            error: None,
        },
        OpenResult::FileNotFound { path } => OpenWithResult {
            success: false,
            error: Some(format!("File not found: {}", path)),
        },
        OpenResult::AppNotFound { app_id } => OpenWithResult {
            success: false,
            error: Some(format!("Application not found: {}", app_id)),
        },
        OpenResult::PermissionDenied { path } => OpenWithResult {
            success: false,
            error: Some(format!("Permission denied while opening: {}", path)),
        },
        OpenResult::PlatformError { message } => OpenWithResult {
            success: false,
            error: Some(message),
        },
    }
}

fn escape_applescript_string(value: &str) -> String {
    value.replace('\\', "\\\\").replace('\"', "\\\"")
}
