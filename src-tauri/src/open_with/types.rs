//

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct AssociatedProgram {
    pub name: String,
    pub path: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub launch_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub launch_kind: Option<AssociatedProgramLaunchKind>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub executable_path: Option<String>,
    pub icon: Option<String>,
    pub is_default: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum AssociatedProgramLaunchKind {
    ShellHandler,
    ExecutablePath,
    BundleId,
    DesktopId,
}

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct AssociatedProgramsCatalog {
    pub recommended_programs: Vec<AssociatedProgram>,
    pub other_programs: Vec<AssociatedProgram>,
    pub default_program: Option<AssociatedProgram>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OpenWithResult {
    pub success: bool,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GetAssociatedProgramsResult {
    pub success: bool,
    pub recommended_programs: Vec<AssociatedProgram>,
    pub other_programs: Vec<AssociatedProgram>,
    pub default_program: Option<AssociatedProgram>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ShellContextMenuItem {
    pub id: u32,
    pub name: String,
    pub verb: Option<String>,
    pub icon: Option<String>,
    pub children: Option<Vec<ShellContextMenuItem>>,
}

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ShellContextMenuTargetKind {
    Entry,
    MultiSelect,
    Background,
}

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ShellContextMenuRequest {
    pub target_kind: ShellContextMenuTargetKind,
    pub current_directory_path: String,
    pub target_paths: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ShellContextMenuInvokeRequest {
    pub menu_request: ShellContextMenuRequest,
    pub command_id: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub command_verb: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GetShellContextMenuResult {
    pub success: bool,
    pub items: Vec<ShellContextMenuItem>,
    pub error: Option<String>,
}

impl OpenWithResult {
    pub fn into_result(self) -> Result<(), String> {
        if self.success {
            Ok(())
        } else {
            Err(self
                .error
                .unwrap_or_else(|| "Open With operation failed.".to_string()))
        }
    }
}

impl GetAssociatedProgramsResult {
    pub fn into_result(self) -> Result<AssociatedProgramsCatalog, String> {
        if self.success {
            Ok(AssociatedProgramsCatalog {
                recommended_programs: self.recommended_programs,
                other_programs: self.other_programs,
                default_program: self.default_program,
            })
        } else {
            Err(self
                .error
                .unwrap_or_else(|| "Failed to resolve associated programs.".to_string()))
        }
    }
}

impl GetShellContextMenuResult {
    pub fn into_result(self) -> Result<Vec<ShellContextMenuItem>, String> {
        if self.success {
            Ok(self.items)
        } else {
            Err(self
                .error
                .unwrap_or_else(|| "Failed to resolve shell context menu.".to_string()))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{AssociatedProgram, AssociatedProgramLaunchKind};

    #[test]
    fn associated_program_launch_metadata_serializes_as_camel_case() {
        let program = AssociatedProgram {
            name: "TextEdit".to_string(),
            path: "/Applications/TextEdit.app".to_string(),
            launch_id: Some("assoc-handler:textedit".to_string()),
            launch_kind: Some(AssociatedProgramLaunchKind::ShellHandler),
            executable_path: Some("/Applications/TextEdit.app".to_string()),
            icon: None,
            is_default: false,
        };

        let serialized = serde_json::to_value(program).expect("program serializes");

        assert_eq!(serialized["launchId"], "assoc-handler:textedit");
        assert_eq!(serialized["launchKind"], "shellHandler");
        assert_eq!(serialized["executablePath"], "/Applications/TextEdit.app");
    }

    #[test]
    fn associated_program_launch_metadata_stays_optional_for_legacy_payloads() {
        let program: AssociatedProgram = serde_json::from_value(serde_json::json!({
            "name": "Legacy App",
            "path": "/usr/bin/legacy",
            "icon": null,
            "isDefault": false
        }))
        .expect("legacy associated program deserializes");

        assert_eq!(program.launch_id, None);
        assert_eq!(program.launch_kind, None);
        assert_eq!(program.executable_path, None);
    }
}
