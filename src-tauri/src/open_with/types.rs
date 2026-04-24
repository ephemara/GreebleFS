//

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct AssociatedProgram {
    pub name: String,
    pub path: String,
    pub icon: Option<String>,
    pub is_default: bool,
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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ShellContextMenuItem {
    pub id: u32,
    pub name: String,
    pub verb: Option<String>,
    pub icon: Option<String>,
    pub children: Option<Vec<ShellContextMenuItem>>,
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
