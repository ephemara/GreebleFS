use overlay_contracts::{built_in_shell_blueprints, ShellBlueprint};

#[tauri::command]
#[specta::specta]
pub fn domain_list_shell_blueprints() -> Vec<ShellBlueprint> {
    built_in_shell_blueprints()
}
