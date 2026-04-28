use std::{
    env, fs,
    path::{Path, PathBuf},
};

use serde::{Deserialize, Serialize};

const REPO_USR_MANIFEST_TEXT: &str = include_str!("../../usr/manifest.json");

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsrManifestEntry {
    pub id: String,
    pub relative_directory: String,
    pub env_var_suffix: Option<String>,
    pub bundled: bool,
    pub bootstrap_to_managed_root: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsrManifest {
    pub version: u32,
    pub entries: Vec<UsrManifestEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ManagedContentRoots {
    pub bundled_usr_root: String,
    pub writable_root: String,
}

fn normalize_env_path(value: Option<String>) -> Option<PathBuf> {
    value
        .map(|entry| entry.trim().to_string())
        .filter(|entry| !entry.is_empty())
        .map(PathBuf::from)
}

fn read_first_env_path(var_names: &[&str]) -> Option<PathBuf> {
    for var_name in var_names {
        if let Some(path) = normalize_env_path(env::var(var_name).ok()) {
            return Some(path);
        }
    }
    None
}

pub fn load_usr_manifest() -> Result<UsrManifest, String> {
    serde_json::from_str(REPO_USR_MANIFEST_TEXT)
        .map_err(|error| format!("Failed to parse usr manifest: {error}"))
}

pub fn resolve_bundled_usr_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    if let Some(explicit_root) = read_first_env_path(&[
        "GREEBLEFS_USR_DIR",
        "OVERLAYTERM_USR_DIR",
        "VITE_GREEBLEFS_USR_DIR",
        "VITE_OVERLAYTERM_USR_DIR",
    ]) {
        return Ok(explicit_root);
    }

    if let Ok(resource_root) = app.path().resource_dir() {
        let bundled_root = resource_root.join("usr");
        if bundled_root.exists() {
            return Ok(bundled_root);
        }
    }

    let repo_root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../usr");
    Ok(repo_root)
}

pub fn resolve_managed_content_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    if let Some(explicit_root) =
        read_first_env_path(&["GREEBLEFS_MANAGED_CONTENT_ROOT", "OVERLAYTERM_MANAGED_CONTENT_ROOT"])
    {
        return Ok(explicit_root);
    }

    let app_local_data_root = app
        .path()
        .app_local_data_dir()
        .map_err(|error| format!("Failed to resolve app local data directory: {error}"))?;
    Ok(app_local_data_root.join("usr"))
}

fn copy_missing_entries(source: &Path, target: &Path) -> Result<(), String> {
    let metadata = fs::metadata(source)
        .map_err(|error| format!("Failed to inspect {}: {error}", source.display()))?;

    if metadata.is_dir() {
        fs::create_dir_all(target)
            .map_err(|error| format!("Failed to create {}: {error}", target.display()))?;
        for child in fs::read_dir(source)
            .map_err(|error| format!("Failed to read {}: {error}", source.display()))?
        {
            let child = child.map_err(|error| format!("Failed to read directory entry: {error}"))?;
            let child_source = child.path();
            let child_target = target.join(child.file_name());
            copy_missing_entries(&child_source, &child_target)?;
        }
        return Ok(());
    }

    if target.exists() {
        return Ok(());
    }

    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to create {}: {error}", parent.display()))?;
    }

    fs::copy(source, target).map_err(|error| {
        format!(
            "Failed to copy shipped usr file {} -> {}: {error}",
            source.display(),
            target.display()
        )
    })?;
    Ok(())
}

pub fn bootstrap_usr_content(app: &tauri::AppHandle) -> Result<(), String> {
    let manifest = load_usr_manifest()?;
    let source_root = resolve_bundled_usr_root(app)?;
    let target_root = resolve_managed_content_root(app)?;

    fs::create_dir_all(&target_root)
        .map_err(|error| format!("Failed to create {}: {error}", target_root.display()))?;

    let source_manifest_path = source_root.join("manifest.json");
    let target_manifest_path = target_root.join("manifest.json");
    if source_manifest_path.exists() {
        copy_missing_entries(&source_manifest_path, &target_manifest_path)?;
    }

    for entry in manifest
        .entries
        .iter()
        .filter(|entry| entry.bundled && entry.bootstrap_to_managed_root)
    {
        let source_path = source_root.join(&entry.relative_directory);
        if !source_path.exists() {
            continue;
        }

        let target_path = target_root.join(&entry.relative_directory);
        copy_missing_entries(&source_path, &target_path)?;
    }

    Ok(())
}

pub fn resolve_usr_relative_path(app: &tauri::AppHandle, relative_path: &str) -> Result<PathBuf, String> {
    let writable_path = resolve_managed_content_root(app)?.join(relative_path);
    if writable_path.exists() {
        return Ok(writable_path);
    }

    let bundled_path = resolve_bundled_usr_root(app)?.join(relative_path);
    if bundled_path.exists() {
        return Ok(bundled_path);
    }

    Err(format!(
        "Managed usr path was not found in either the writable root or bundled usr payload: {relative_path}"
    ))
}

pub fn read_usr_text_file(app: &tauri::AppHandle, relative_path: &str) -> Result<String, String> {
    let path = resolve_usr_relative_path(app, relative_path)?;
    fs::read_to_string(&path)
        .map_err(|error| format!("Failed to read {}: {error}", path.display()))
}
