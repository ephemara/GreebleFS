use serde::de::DeserializeOwned;

use overlay_contracts::{
    built_in_shell_blueprints, built_in_theme_manifests, built_in_workbench_presets,
    ShellBlueprint, ThemeManifest, WorkbenchPreset,
};

fn load_runtime_usr_domain_catalog<T, F>(
    app: &tauri::AppHandle,
    relative_path: &str,
    catalog_name: &str,
    fallback_loader: F,
) -> Vec<T>
where
    T: DeserializeOwned,
    F: FnOnce() -> Vec<T>,
{
    match crate::usr::read_usr_text_file(app, relative_path) {
        Ok(text) => match serde_json::from_str::<Vec<T>>(&text) {
            Ok(entries) => entries,
            Err(error) => {
                eprintln!(
                    "failed to parse runtime usr domain catalog {} at {}: {}",
                    catalog_name, relative_path, error
                );
                fallback_loader()
            }
        },
        Err(error) => {
            eprintln!(
                "failed to read runtime usr domain catalog {} at {}: {}",
                catalog_name, relative_path, error
            );
            fallback_loader()
        }
    }
}

#[tauri::command]
#[specta::specta]
pub fn domain_list_shell_blueprints(app: tauri::AppHandle) -> Vec<ShellBlueprint> {
    load_runtime_usr_domain_catalog(
        &app,
        "domain/shell-blueprints.json",
        "shell-blueprints",
        built_in_shell_blueprints,
    )
}

#[tauri::command]
#[specta::specta]
pub fn domain_list_theme_manifests(app: tauri::AppHandle) -> Vec<ThemeManifest> {
    load_runtime_usr_domain_catalog(
        &app,
        "domain/theme-manifests.json",
        "theme-manifests",
        built_in_theme_manifests,
    )
}

#[tauri::command]
#[specta::specta]
pub fn domain_list_workbench_presets(app: tauri::AppHandle) -> Vec<WorkbenchPreset> {
    load_runtime_usr_domain_catalog(
        &app,
        "domain/workbench-presets.json",
        "workbench-presets",
        built_in_workbench_presets,
    )
}
