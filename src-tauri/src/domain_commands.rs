use overlay_contracts::{
    built_in_shell_blueprints, built_in_theme_manifests, built_in_workbench_presets,
    ShellBlueprint, ThemeManifest, WorkbenchPreset,
};

#[tauri::command]
#[specta::specta]
pub fn domain_list_shell_blueprints() -> Vec<ShellBlueprint> {
    built_in_shell_blueprints()
}

#[tauri::command]
#[specta::specta]
pub fn domain_list_theme_manifests() -> Vec<ThemeManifest> {
    built_in_theme_manifests()
}

#[tauri::command]
#[specta::specta]
pub fn domain_list_workbench_presets() -> Vec<WorkbenchPreset> {
    built_in_workbench_presets()
}
