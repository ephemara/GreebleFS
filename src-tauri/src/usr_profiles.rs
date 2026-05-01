use std::{
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use serde::{de::DeserializeOwned, Deserialize, Serialize};
use tauri::AppHandle;
use tauri_specta::Event;

use crate::usr::{load_usr_manifest, resolve_bundled_usr_root, resolve_shared_usr_root, UsrProfileLaneMode};

const PROFILE_CATALOG_VERSION: u32 = 1;
const DEFAULT_PROFILE_ID: &str = "default";
const DEFAULT_PROFILE_NAME: &str = "Default";
const PROFILES_DIRECTORY_NAME: &str = "profiles";
const SHARED_DIRECTORY_NAME: &str = "shared";
const PROFILE_CATALOG_FILE_NAME: &str = "catalog.json";
const PROFILE_METADATA_FILE_NAME: &str = "profile.json";
const PROFILE_SETTINGS_FILE_NAME: &str = "settings.json";
const LEGACY_SETTINGS_BACKUP_FILE_NAME: &str = "legacy-ultacode-settings-backup.json";

const PROFILE_SETTING_SLICE_KEYS: &[&str] = &[
    "editor",
    "presentation",
    "dock",
    "terminal",
    "explorer",
    "home",
    "appearance",
    "keybindings",
    "layout",
    "audio",
    "plugins",
];

const SHARED_SETTING_SLICE_KEYS: &[&str] = &[
    "python",
    "models",
    "system",
    "mobile",
    "screenshots",
    "polygemini",
];

type JsonObject = serde_json::Map<String, serde_json::Value>;

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct UsrProfileSummary {
    pub id: String,
    pub name: String,
    pub override_slices: Vec<String>,
    pub created_at_ms: u64,
    pub updated_at_ms: u64,
    pub directory_path: String,
    pub settings_path: String,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct UsrManagedContentDirectoryStack {
    pub lane_id: String,
    pub profile_mode: UsrProfileLaneMode,
    pub directories: Vec<String>,
    pub shared_root_directory: String,
    pub bundled_directory: Option<String>,
    pub profile_directory: Option<String>,
    pub writable_directory: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct UsrProfileRuntimeSnapshot {
    pub active_profile_id: String,
    pub profiles_root: String,
    pub shared_settings_path: String,
    pub shared_settings_json: String,
    pub active_profile_settings_path: String,
    pub active_profile_settings_json: String,
    pub effective_settings_json: String,
    pub profiles: Vec<UsrProfileSummary>,
    pub managed_content_directory_stacks: Vec<UsrManagedContentDirectoryStack>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type, tauri_specta::Event)]
#[serde(rename_all = "camelCase")]
pub struct UsrProfileChangedEvent {
    pub snapshot: UsrProfileRuntimeSnapshot,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct UsrProfileCreateRequest {
    pub name: String,
    pub profile_id: Option<String>,
    pub activate: bool,
    pub seed_settings_json: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct UsrProfileDuplicateRequest {
    pub source_profile_id: String,
    pub name: String,
    pub profile_id: Option<String>,
    pub activate: bool,
    pub current_settings_json: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct UsrProfileRenameRequest {
    pub profile_id: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct UsrProfileDeleteRequest {
    pub profile_id: String,
    pub fallback_profile_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UsrProfileCatalogFile {
    version: u32,
    active_profile_id: String,
    profile_order: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UsrProfileManifestFile {
    id: String,
    name: String,
    override_slices: Vec<String>,
    created_at_ms: u64,
    updated_at_ms: u64,
}

fn current_timestamp_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

fn profile_setting_slice_keys() -> Vec<String> {
    PROFILE_SETTING_SLICE_KEYS
        .iter()
        .map(|slice| (*slice).to_string())
        .collect()
}

fn profiles_root(shared_usr_root: &Path) -> PathBuf {
    shared_usr_root.join(PROFILES_DIRECTORY_NAME)
}

fn shared_profiles_directory(shared_usr_root: &Path) -> PathBuf {
    profiles_root(shared_usr_root).join(SHARED_DIRECTORY_NAME)
}

fn profile_catalog_path(shared_usr_root: &Path) -> PathBuf {
    profiles_root(shared_usr_root).join(PROFILE_CATALOG_FILE_NAME)
}

fn shared_settings_path(shared_usr_root: &Path) -> PathBuf {
    shared_profiles_directory(shared_usr_root).join(PROFILE_SETTINGS_FILE_NAME)
}

fn legacy_settings_backup_path(shared_usr_root: &Path) -> PathBuf {
    profiles_root(shared_usr_root).join(LEGACY_SETTINGS_BACKUP_FILE_NAME)
}

fn profile_directory(shared_usr_root: &Path, profile_id: &str) -> PathBuf {
    profiles_root(shared_usr_root).join(profile_id)
}

fn profile_metadata_path(shared_usr_root: &Path, profile_id: &str) -> PathBuf {
    profile_directory(shared_usr_root, profile_id).join(PROFILE_METADATA_FILE_NAME)
}

fn profile_settings_path(shared_usr_root: &Path, profile_id: &str) -> PathBuf {
    profile_directory(shared_usr_root, profile_id).join(PROFILE_SETTINGS_FILE_NAME)
}

fn normalize_profile_id_fragment(value: &str) -> String {
    let mut normalized = String::with_capacity(value.len());
    let mut last_was_dash = false;
    for character in value.trim().chars() {
        if character.is_ascii_alphanumeric() {
            normalized.push(character.to_ascii_lowercase());
            last_was_dash = false;
        } else if !last_was_dash {
            normalized.push('-');
            last_was_dash = true;
        }
    }

    normalized.trim_matches('-').to_string()
}

fn sanitize_profile_name(name: &str) -> String {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        DEFAULT_PROFILE_NAME.to_string()
    } else {
        trimmed.to_string()
    }
}

fn ensure_parent_directory(path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to create {}: {error}", parent.display()))?;
    }
    Ok(())
}

fn write_json_file<T: Serialize>(path: &Path, value: &T) -> Result<(), String> {
    ensure_parent_directory(path)?;
    let json = serde_json::to_string_pretty(value)
        .map_err(|error| format!("Failed to serialize {}: {error}", path.display()))?;
    fs::write(path, json).map_err(|error| format!("Failed to write {}: {error}", path.display()))
}

fn read_json_file<T: DeserializeOwned>(path: &Path) -> Result<T, String> {
    let text = fs::read_to_string(path)
        .map_err(|error| format!("Failed to read {}: {error}", path.display()))?;
    serde_json::from_str(&text)
        .map_err(|error| format!("Failed to parse {}: {error}", path.display()))
}

fn read_json_object_file(path: &Path) -> Result<JsonObject, String> {
    if !path.exists() {
        return Ok(JsonObject::new());
    }

    let value: serde_json::Value = read_json_file(path)?;
    match value {
        serde_json::Value::Object(object) => Ok(object),
        other => Err(format!(
            "Expected {} to contain a JSON object, found {}",
            path.display(),
            other
        )),
    }
}

fn parse_settings_json_object(json: &str, label: &str) -> Result<JsonObject, String> {
    let value: serde_json::Value = serde_json::from_str(json)
        .map_err(|error| format!("Failed to parse {label} as JSON: {error}"))?;
    match value {
        serde_json::Value::Object(object) => Ok(object),
        other => Err(format!(
            "Expected {label} to be a JSON object, found {other}"
        )),
    }
}

fn parse_settings_from_legacy_storage_json(legacy_storage_json: &str) -> Result<JsonObject, String> {
    let storage_value: serde_json::Value = serde_json::from_str(legacy_storage_json)
        .map_err(|error| format!("Failed to parse legacy ultacode-settings JSON: {error}"))?;
    let storage_object = storage_value.as_object().ok_or_else(|| {
        "Expected legacy ultacode-settings to be a JSON object with state.settings".to_string()
    })?;
    let state_object = storage_object
        .get("state")
        .and_then(serde_json::Value::as_object)
        .ok_or_else(|| {
            "Expected legacy ultacode-settings JSON to include a state object".to_string()
        })?;
    let settings_object = state_object
        .get("settings")
        .and_then(serde_json::Value::as_object)
        .ok_or_else(|| {
            "Expected legacy ultacode-settings JSON to include state.settings".to_string()
        })?;
    Ok(settings_object.clone())
}

fn resolve_seed_settings_object(
    current_settings_json: Option<&str>,
    legacy_settings_storage_json: Option<&str>,
) -> Result<JsonObject, String> {
    if let Some(current_settings_json) = current_settings_json {
        return parse_settings_json_object(current_settings_json, "current settings snapshot");
    }

    if let Some(legacy_settings_storage_json) = legacy_settings_storage_json {
        return parse_settings_from_legacy_storage_json(legacy_settings_storage_json);
    }

    Ok(JsonObject::new())
}

fn partition_settings_object(settings: &JsonObject) -> (JsonObject, JsonObject) {
    let mut shared_settings = JsonObject::new();
    let mut profile_settings = JsonObject::new();

    for key in SHARED_SETTING_SLICE_KEYS {
        if let Some(value) = settings.get(*key) {
            shared_settings.insert((*key).to_string(), value.clone());
        }
    }

    for key in PROFILE_SETTING_SLICE_KEYS {
        if let Some(value) = settings.get(*key) {
            profile_settings.insert((*key).to_string(), value.clone());
        }
    }

    (shared_settings, profile_settings)
}

fn merge_settings_objects(shared_settings: &JsonObject, profile_settings: &JsonObject) -> JsonObject {
    let mut merged_settings = shared_settings.clone();
    for (key, value) in profile_settings {
        merged_settings.insert(key.clone(), value.clone());
    }
    merged_settings
}

fn serialize_json_object(object: &JsonObject, label: &str) -> Result<String, String> {
    serde_json::to_string(object).map_err(|error| format!("Failed to serialize {label}: {error}"))
}

fn create_profile_manifest_file(profile_id: &str, name: &str, timestamp_ms: u64) -> UsrProfileManifestFile {
    UsrProfileManifestFile {
        id: profile_id.to_string(),
        name: sanitize_profile_name(name),
        override_slices: profile_setting_slice_keys(),
        created_at_ms: timestamp_ms,
        updated_at_ms: timestamp_ms,
    }
}

fn read_profile_manifest_file(shared_usr_root: &Path, profile_id: &str) -> Result<UsrProfileManifestFile, String> {
    read_json_file(&profile_metadata_path(shared_usr_root, profile_id))
}

fn write_profile_manifest_file(
    shared_usr_root: &Path,
    manifest: &UsrProfileManifestFile,
) -> Result<(), String> {
    write_json_file(&profile_metadata_path(shared_usr_root, &manifest.id), manifest)
}

fn load_profile_catalog(shared_usr_root: &Path) -> Result<UsrProfileCatalogFile, String> {
    read_json_file(&profile_catalog_path(shared_usr_root))
}

fn write_profile_catalog(shared_usr_root: &Path, catalog: &UsrProfileCatalogFile) -> Result<(), String> {
    write_json_file(&profile_catalog_path(shared_usr_root), catalog)
}

fn profile_exists(shared_usr_root: &Path, profile_id: &str) -> bool {
    profile_directory(shared_usr_root, profile_id).exists()
}

fn unique_profile_id(
    shared_usr_root: &Path,
    requested_profile_id: Option<&str>,
    profile_name: &str,
    reserved_profile_ids: &[String],
) -> String {
    let requested_candidate = requested_profile_id
        .map(normalize_profile_id_fragment)
        .filter(|value| !value.is_empty());
    let base_profile_id = requested_candidate
        .unwrap_or_else(|| normalize_profile_id_fragment(profile_name));
    let base_profile_id = if base_profile_id.is_empty() {
        "profile".to_string()
    } else {
        base_profile_id
    };

    let mut suffix = 1_u32;
    let mut candidate = base_profile_id.clone();
    while reserved_profile_ids.iter().any(|entry| entry == &candidate)
        || profile_exists(shared_usr_root, &candidate)
    {
        suffix += 1;
        candidate = format!("{base_profile_id}-{suffix}");
    }

    candidate
}

fn ensure_catalog_profile_exists(catalog: &UsrProfileCatalogFile, profile_id: &str) -> Result<(), String> {
    if catalog.profile_order.iter().any(|entry| entry == profile_id) {
        Ok(())
    } else {
        Err(format!("Usr profile '{profile_id}' does not exist"))
    }
}

fn seed_default_profile(
    shared_usr_root: &Path,
    current_settings_json: Option<&str>,
    legacy_settings_storage_json: Option<&str>,
) -> Result<UsrProfileCatalogFile, String> {
    fs::create_dir_all(shared_profiles_directory(shared_usr_root)).map_err(|error| {
        format!(
            "Failed to create {}: {error}",
            shared_profiles_directory(shared_usr_root).display()
        )
    })?;

    if let Some(legacy_settings_storage_json) = legacy_settings_storage_json {
        let backup_path = legacy_settings_backup_path(shared_usr_root);
        if !backup_path.exists() {
            ensure_parent_directory(&backup_path)?;
            fs::write(&backup_path, legacy_settings_storage_json).map_err(|error| {
                format!(
                    "Failed to write {}: {error}",
                    backup_path.display()
                )
            })?;
        }
    }

    let seed_settings_object =
        resolve_seed_settings_object(current_settings_json, legacy_settings_storage_json)?;
    let (shared_settings, default_profile_settings) = partition_settings_object(&seed_settings_object);
    let timestamp_ms = current_timestamp_ms();
    let default_profile_manifest =
        create_profile_manifest_file(DEFAULT_PROFILE_ID, DEFAULT_PROFILE_NAME, timestamp_ms);

    write_json_file(&shared_settings_path(shared_usr_root), &shared_settings)?;
    write_profile_manifest_file(shared_usr_root, &default_profile_manifest)?;
    write_json_file(
        &profile_settings_path(shared_usr_root, DEFAULT_PROFILE_ID),
        &default_profile_settings,
    )?;

    let catalog = UsrProfileCatalogFile {
        version: PROFILE_CATALOG_VERSION,
        active_profile_id: DEFAULT_PROFILE_ID.to_string(),
        profile_order: vec![DEFAULT_PROFILE_ID.to_string()],
    };
    write_profile_catalog(shared_usr_root, &catalog)?;
    Ok(catalog)
}

fn load_or_initialize_catalog(
    shared_usr_root: &Path,
    current_settings_json: Option<&str>,
    legacy_settings_storage_json: Option<&str>,
) -> Result<UsrProfileCatalogFile, String> {
    fs::create_dir_all(profiles_root(shared_usr_root))
        .map_err(|error| format!("Failed to create {}: {error}", profiles_root(shared_usr_root).display()))?;
    fs::create_dir_all(shared_profiles_directory(shared_usr_root)).map_err(|error| {
        format!(
            "Failed to create {}: {error}",
            shared_profiles_directory(shared_usr_root).display()
        )
    })?;

    let catalog_path = profile_catalog_path(shared_usr_root);
    if !catalog_path.exists() {
        return seed_default_profile(
            shared_usr_root,
            current_settings_json,
            legacy_settings_storage_json,
        );
    }

    let mut catalog = load_profile_catalog(shared_usr_root)?;
    if catalog.profile_order.is_empty() {
        catalog = seed_default_profile(shared_usr_root, current_settings_json, legacy_settings_storage_json)?;
    }

    if !catalog
        .profile_order
        .iter()
        .any(|profile_id| profile_id == &catalog.active_profile_id)
    {
        if let Some(first_profile_id) = catalog.profile_order.first() {
            catalog.active_profile_id = first_profile_id.clone();
            write_profile_catalog(shared_usr_root, &catalog)?;
        }
    }

    Ok(catalog)
}

fn persist_partitioned_settings(
    shared_usr_root: &Path,
    active_profile_id: &str,
    settings: &JsonObject,
) -> Result<(), String> {
    let (shared_settings, profile_settings) = partition_settings_object(settings);
    write_json_file(&shared_settings_path(shared_usr_root), &shared_settings)?;
    write_json_file(
        &profile_settings_path(shared_usr_root, active_profile_id),
        &profile_settings,
    )?;
    Ok(())
}

fn read_active_settings(
    shared_usr_root: &Path,
    active_profile_id: &str,
) -> Result<(JsonObject, JsonObject, JsonObject), String> {
    let shared_settings = read_json_object_file(&shared_settings_path(shared_usr_root))?;
    let active_profile_settings =
        read_json_object_file(&profile_settings_path(shared_usr_root, active_profile_id))?;
    let effective_settings = merge_settings_objects(&shared_settings, &active_profile_settings);
    Ok((shared_settings, active_profile_settings, effective_settings))
}

fn to_profile_summary(
    shared_usr_root: &Path,
    manifest: UsrProfileManifestFile,
    is_active: bool,
) -> UsrProfileSummary {
    let settings_path = profile_settings_path(shared_usr_root, &manifest.id);
    let directory_path = profile_directory(shared_usr_root, &manifest.id);
    UsrProfileSummary {
        id: manifest.id,
        name: manifest.name,
        override_slices: manifest.override_slices,
        created_at_ms: manifest.created_at_ms,
        updated_at_ms: manifest.updated_at_ms,
        directory_path: directory_path.to_string_lossy().into_owned(),
        settings_path: settings_path.to_string_lossy().into_owned(),
        is_active,
    }
}

fn append_stack_directory(directories: &mut Vec<String>, next_directory: PathBuf) {
    let next_value = next_directory.to_string_lossy().into_owned();
    if directories.iter().all(|existing| existing != &next_value) {
        directories.push(next_value);
    }
}

fn build_directory_stacks(
    app: &AppHandle,
    shared_usr_root: &Path,
    active_profile_id: &str,
) -> Result<Vec<UsrManagedContentDirectoryStack>, String> {
    let manifest = load_usr_manifest()?;
    let bundled_usr_root = resolve_bundled_usr_root(app)?;

    let mut directory_stacks = Vec::new();
    for entry in manifest.entries {
        if entry.env_var_suffix.is_none() {
            continue;
        }

        let shared_root_directory = shared_usr_root.join(&entry.relative_directory);
        let bundled_directory_path = bundled_usr_root.join(&entry.relative_directory);
        let profile_directory_path = match entry.profile_mode {
            UsrProfileLaneMode::SharedRoot => None,
            UsrProfileLaneMode::ProfileOverlay => {
                Some(profile_directory(shared_usr_root, active_profile_id).join(&entry.relative_directory))
            }
        };

        let writable_directory = profile_directory_path
            .clone()
            .unwrap_or_else(|| shared_root_directory.clone());
        let mut directories = Vec::new();
        if let Some(profile_directory_path) = profile_directory_path.clone() {
            append_stack_directory(&mut directories, profile_directory_path);
        }
        append_stack_directory(&mut directories, shared_root_directory.clone());
        if entry.bundled {
            append_stack_directory(&mut directories, bundled_directory_path.clone());
        }

        directory_stacks.push(UsrManagedContentDirectoryStack {
            lane_id: entry.id,
            profile_mode: entry.profile_mode,
            directories,
            shared_root_directory: shared_root_directory.to_string_lossy().into_owned(),
            bundled_directory: entry
                .bundled
                .then(|| bundled_directory_path.to_string_lossy().into_owned()),
            profile_directory: profile_directory_path
                .map(|path| path.to_string_lossy().into_owned()),
            writable_directory: writable_directory.to_string_lossy().into_owned(),
        });
    }

    Ok(directory_stacks)
}

fn build_runtime_snapshot_from_catalog(
    app: &AppHandle,
    shared_usr_root: &Path,
    catalog: &UsrProfileCatalogFile,
) -> Result<UsrProfileRuntimeSnapshot, String> {
    ensure_catalog_profile_exists(catalog, &catalog.active_profile_id)?;
    let (shared_settings, active_profile_settings, effective_settings) =
        read_active_settings(shared_usr_root, &catalog.active_profile_id)?;

    let profiles = catalog
        .profile_order
        .iter()
        .map(|profile_id| {
            read_profile_manifest_file(shared_usr_root, profile_id)
                .map(|manifest| to_profile_summary(shared_usr_root, manifest, profile_id == &catalog.active_profile_id))
        })
        .collect::<Result<Vec<_>, _>>()?;

    let active_profile_settings_path =
        profile_settings_path(shared_usr_root, &catalog.active_profile_id)
            .to_string_lossy()
            .into_owned();

    Ok(UsrProfileRuntimeSnapshot {
        active_profile_id: catalog.active_profile_id.clone(),
        profiles_root: profiles_root(shared_usr_root).to_string_lossy().into_owned(),
        shared_settings_path: shared_settings_path(shared_usr_root)
            .to_string_lossy()
            .into_owned(),
        shared_settings_json: serialize_json_object(&shared_settings, "shared profile settings")?,
        active_profile_settings_path,
        active_profile_settings_json: serialize_json_object(
            &active_profile_settings,
            "active profile settings",
        )?,
        effective_settings_json: serialize_json_object(
            &effective_settings,
            "effective profile settings",
        )?,
        profiles,
        managed_content_directory_stacks: build_directory_stacks(
            app,
            shared_usr_root,
            &catalog.active_profile_id,
        )?,
    })
}

fn emit_profile_changed(app: &AppHandle, snapshot: UsrProfileRuntimeSnapshot) {
    let _ = UsrProfileChangedEvent { snapshot }.emit(app);
}

fn resolve_shared_usr_root_for_profiles(app: &AppHandle) -> Result<PathBuf, String> {
    let root = resolve_shared_usr_root(app)?;
    fs::create_dir_all(&root)
        .map_err(|error| format!("Failed to create {}: {error}", root.display()))?;
    Ok(root)
}

#[tauri::command]
#[specta::specta]
pub async fn usr_profiles_initialize(
    app: AppHandle,
    current_settings_json: Option<String>,
    legacy_settings_storage_json: Option<String>,
) -> Result<UsrProfileRuntimeSnapshot, String> {
    let shared_usr_root = resolve_shared_usr_root_for_profiles(&app)?;
    let catalog = load_or_initialize_catalog(
        &shared_usr_root,
        current_settings_json.as_deref(),
        legacy_settings_storage_json.as_deref(),
    )?;
    build_runtime_snapshot_from_catalog(&app, &shared_usr_root, &catalog)
}

#[tauri::command]
#[specta::specta]
pub async fn usr_profiles_get_runtime_snapshot(
    app: AppHandle,
) -> Result<UsrProfileRuntimeSnapshot, String> {
    let shared_usr_root = resolve_shared_usr_root_for_profiles(&app)?;
    let catalog = load_or_initialize_catalog(&shared_usr_root, None, None)?;
    build_runtime_snapshot_from_catalog(&app, &shared_usr_root, &catalog)
}

#[tauri::command]
#[specta::specta]
pub async fn usr_profiles_persist_active_settings_snapshot(
    app: AppHandle,
    settings_json: String,
) -> Result<UsrProfileRuntimeSnapshot, String> {
    let shared_usr_root = resolve_shared_usr_root_for_profiles(&app)?;
    let catalog = load_or_initialize_catalog(&shared_usr_root, None, None)?;
    let settings = parse_settings_json_object(&settings_json, "active settings snapshot")?;
    persist_partitioned_settings(&shared_usr_root, &catalog.active_profile_id, &settings)?;
    let snapshot = build_runtime_snapshot_from_catalog(&app, &shared_usr_root, &catalog)?;
    emit_profile_changed(&app, snapshot.clone());
    Ok(snapshot)
}

#[tauri::command]
#[specta::specta]
pub async fn usr_profiles_switch(
    app: AppHandle,
    profile_id: String,
    current_settings_json: Option<String>,
) -> Result<UsrProfileRuntimeSnapshot, String> {
    let shared_usr_root = resolve_shared_usr_root_for_profiles(&app)?;
    let mut catalog = load_or_initialize_catalog(&shared_usr_root, None, None)?;
    ensure_catalog_profile_exists(&catalog, &profile_id)?;

    if let Some(current_settings_json) = current_settings_json.as_deref() {
        let settings = parse_settings_json_object(current_settings_json, "active settings snapshot")?;
        persist_partitioned_settings(&shared_usr_root, &catalog.active_profile_id, &settings)?;
    }

    catalog.active_profile_id = profile_id;
    write_profile_catalog(&shared_usr_root, &catalog)?;
    let snapshot = build_runtime_snapshot_from_catalog(&app, &shared_usr_root, &catalog)?;
    emit_profile_changed(&app, snapshot.clone());
    Ok(snapshot)
}

#[tauri::command]
#[specta::specta]
pub async fn usr_profiles_create(
    app: AppHandle,
    request: UsrProfileCreateRequest,
) -> Result<UsrProfileRuntimeSnapshot, String> {
    let shared_usr_root = resolve_shared_usr_root_for_profiles(&app)?;
    let mut catalog = load_or_initialize_catalog(&shared_usr_root, None, None)?;
    let profile_name = sanitize_profile_name(&request.name);
    let new_profile_id = unique_profile_id(
        &shared_usr_root,
        request.profile_id.as_deref(),
        &profile_name,
        &catalog.profile_order,
    );
    let timestamp_ms = current_timestamp_ms();
    let manifest = create_profile_manifest_file(&new_profile_id, &profile_name, timestamp_ms);
    let seed_profile_settings = if let Some(seed_settings_json) = request.seed_settings_json.as_deref() {
        let seed_settings = parse_settings_json_object(seed_settings_json, "new profile seed settings")?;
        let (_, profile_settings) = partition_settings_object(&seed_settings);
        profile_settings
    } else {
        read_json_object_file(&profile_settings_path(
            &shared_usr_root,
            &catalog.active_profile_id,
        ))?
    };

    write_profile_manifest_file(&shared_usr_root, &manifest)?;
    write_json_file(
        &profile_settings_path(&shared_usr_root, &new_profile_id),
        &seed_profile_settings,
    )?;

    catalog.profile_order.push(new_profile_id.clone());
    if request.activate {
        catalog.active_profile_id = new_profile_id;
    }
    write_profile_catalog(&shared_usr_root, &catalog)?;

    let snapshot = build_runtime_snapshot_from_catalog(&app, &shared_usr_root, &catalog)?;
    emit_profile_changed(&app, snapshot.clone());
    Ok(snapshot)
}

#[tauri::command]
#[specta::specta]
pub async fn usr_profiles_duplicate(
    app: AppHandle,
    request: UsrProfileDuplicateRequest,
) -> Result<UsrProfileRuntimeSnapshot, String> {
    let shared_usr_root = resolve_shared_usr_root_for_profiles(&app)?;
    let mut catalog = load_or_initialize_catalog(&shared_usr_root, None, None)?;
    ensure_catalog_profile_exists(&catalog, &request.source_profile_id)?;

    if request.source_profile_id == catalog.active_profile_id {
        if let Some(current_settings_json) = request.current_settings_json.as_deref() {
            let settings = parse_settings_json_object(current_settings_json, "active settings snapshot")?;
            persist_partitioned_settings(&shared_usr_root, &catalog.active_profile_id, &settings)?;
        }
    }

    let source_manifest = read_profile_manifest_file(&shared_usr_root, &request.source_profile_id)?;
    let duplicate_name = sanitize_profile_name(&request.name);
    let new_profile_id = unique_profile_id(
        &shared_usr_root,
        request.profile_id.as_deref(),
        &duplicate_name,
        &catalog.profile_order,
    );
    let timestamp_ms = current_timestamp_ms();
    let duplicate_manifest = UsrProfileManifestFile {
        id: new_profile_id.clone(),
        name: duplicate_name,
        override_slices: source_manifest.override_slices.clone(),
        created_at_ms: timestamp_ms,
        updated_at_ms: timestamp_ms,
    };
    let source_settings =
        read_json_object_file(&profile_settings_path(&shared_usr_root, &request.source_profile_id))?;

    write_profile_manifest_file(&shared_usr_root, &duplicate_manifest)?;
    write_json_file(
        &profile_settings_path(&shared_usr_root, &new_profile_id),
        &source_settings,
    )?;

    catalog.profile_order.push(new_profile_id.clone());
    if request.activate {
        catalog.active_profile_id = new_profile_id;
    }
    write_profile_catalog(&shared_usr_root, &catalog)?;

    let snapshot = build_runtime_snapshot_from_catalog(&app, &shared_usr_root, &catalog)?;
    emit_profile_changed(&app, snapshot.clone());
    Ok(snapshot)
}

#[tauri::command]
#[specta::specta]
pub async fn usr_profiles_rename(
    app: AppHandle,
    request: UsrProfileRenameRequest,
) -> Result<UsrProfileRuntimeSnapshot, String> {
    let shared_usr_root = resolve_shared_usr_root_for_profiles(&app)?;
    let catalog = load_or_initialize_catalog(&shared_usr_root, None, None)?;
    ensure_catalog_profile_exists(&catalog, &request.profile_id)?;

    let mut manifest = read_profile_manifest_file(&shared_usr_root, &request.profile_id)?;
    manifest.name = sanitize_profile_name(&request.name);
    manifest.updated_at_ms = current_timestamp_ms();
    write_profile_manifest_file(&shared_usr_root, &manifest)?;

    let snapshot = build_runtime_snapshot_from_catalog(&app, &shared_usr_root, &catalog)?;
    emit_profile_changed(&app, snapshot.clone());
    Ok(snapshot)
}

#[tauri::command]
#[specta::specta]
pub async fn usr_profiles_delete(
    app: AppHandle,
    request: UsrProfileDeleteRequest,
) -> Result<UsrProfileRuntimeSnapshot, String> {
    let shared_usr_root = resolve_shared_usr_root_for_profiles(&app)?;
    let mut catalog = load_or_initialize_catalog(&shared_usr_root, None, None)?;
    ensure_catalog_profile_exists(&catalog, &request.profile_id)?;

    if catalog.profile_order.len() <= 1 {
        return Err("Cannot delete the last remaining usr profile".to_string());
    }

    let fallback_profile_id = if let Some(fallback_profile_id) = request.fallback_profile_id {
        ensure_catalog_profile_exists(&catalog, &fallback_profile_id)?;
        fallback_profile_id
    } else {
        catalog
            .profile_order
            .iter()
            .find(|profile_id| *profile_id != &request.profile_id)
            .cloned()
            .ok_or_else(|| "Unable to resolve a fallback usr profile".to_string())?
    };

    let profile_directory_path = profile_directory(&shared_usr_root, &request.profile_id);
    if profile_directory_path.exists() {
        fs::remove_dir_all(&profile_directory_path).map_err(|error| {
            format!(
                "Failed to delete {}: {error}",
                profile_directory_path.display()
            )
        })?;
    }

    catalog.profile_order.retain(|profile_id| profile_id != &request.profile_id);
    if catalog.active_profile_id == request.profile_id {
        catalog.active_profile_id = fallback_profile_id;
    }
    write_profile_catalog(&shared_usr_root, &catalog)?;

    let snapshot = build_runtime_snapshot_from_catalog(&app, &shared_usr_root, &catalog)?;
    emit_profile_changed(&app, snapshot.clone());
    Ok(snapshot)
}
