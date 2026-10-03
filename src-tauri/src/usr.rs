use std::{
    env, fs,
    path::{Path, PathBuf},
};

use serde::{Deserialize, Serialize};
use tauri::Manager;

const REPO_USR_MANIFEST_TEXT: &str = include_str!("../../usr/manifest.json");
pub const DEFAULT_USR_PROFILE_ID: &str = "default";
const USR_PROFILES_DIRECTORY_NAME: &str = "profiles";
const INSTALL_PROFILE_FILE_NAME: &str = "greeblefs-install-profile.toml";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "kebab-case")]
pub enum UsrProfileLaneMode {
    SharedRoot,
    ProfileOverlay,
}

impl Default for UsrProfileLaneMode {
    fn default() -> Self {
        Self::SharedRoot
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsrManifestEntry {
    pub id: String,
    pub relative_directory: String,
    pub env_var_suffix: Option<String>,
    pub bundled: bool,
    pub bootstrap_to_managed_root: bool,
    #[serde(default)]
    pub profile_mode: UsrProfileLaneMode,
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

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct InstallerManagedContentProfile {
    pub managed_content_root: Option<String>,
    pub plugins_directory: Option<String>,
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

fn resolve_install_root_from_current_executable() -> Option<PathBuf> {
    env::current_exe()
        .ok()
        .and_then(|path| path.parent().map(Path::to_path_buf))
}

fn resolve_install_profile_path(install_root: &Path) -> PathBuf {
    install_root.join(INSTALL_PROFILE_FILE_NAME)
}

fn resolve_profile_path_value(raw_value: Option<&str>, install_root: &Path) -> Option<PathBuf> {
    let normalized_value = raw_value.map(str::trim).filter(|value| !value.is_empty())?;
    let candidate_path = PathBuf::from(normalized_value);
    if candidate_path.is_absolute() {
        Some(candidate_path)
    } else {
        Some(install_root.join(candidate_path))
    }
}

fn resolve_managed_content_root_from_profile_text(
    profile_text: &str,
    install_root: &Path,
) -> Option<PathBuf> {
    let profile = toml::from_str::<InstallerManagedContentProfile>(profile_text).ok()?;
    if let Some(explicit_root) =
        resolve_profile_path_value(profile.managed_content_root.as_deref(), install_root)
    {
        return Some(explicit_root);
    }

    let plugins_directory =
        resolve_profile_path_value(profile.plugins_directory.as_deref(), install_root)?;
    plugins_directory.parent().map(Path::to_path_buf)
}

fn resolve_managed_content_root_from_install_profile() -> Option<PathBuf> {
    let install_root = resolve_install_root_from_current_executable()?;
    let install_profile_path = resolve_install_profile_path(&install_root);
    if let Ok(install_profile_text) = fs::read_to_string(&install_profile_path) {
        if let Some(root) = resolve_managed_content_root_from_profile_text(&install_profile_text, &install_root) {
            return Some(root);
        }
    }

    if let Some(parent) = install_root.parent() {
        let parent_profile_path = resolve_install_profile_path(parent);
        if let Ok(install_profile_text) = fs::read_to_string(&parent_profile_path) {
            if let Some(root) = resolve_managed_content_root_from_profile_text(&install_profile_text, parent) {
                return Some(root);
            }
        }
    }

    None
}

/// If a candidate path points to a directory that contains a `usr` folder
/// (e.g. `T:\toolchain`), normalize it to the `usr` folder itself.
pub fn normalize_usr_root_candidate(candidate: PathBuf) -> PathBuf {
    if candidate.join("usr").join("manifest.json").exists() {
        return candidate.join("usr");
    }
    if candidate.join("manifest.json").exists() {
        return candidate;
    }
    if candidate.join("usr").is_dir() {
        return candidate.join("usr");
    }
    candidate
}

#[cfg(target_os = "windows")]
fn read_windows_registry_string(
    hkey: windows_sys::Win32::System::Registry::HKEY,
    subkey: &str,
    value_name: &str,
) -> Option<PathBuf> {
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;
    use windows_sys::Win32::System::Registry::{
        RegCloseKey, RegOpenKeyExW, RegQueryValueExW, HKEY, KEY_READ, REG_EXPAND_SZ, REG_SZ,
    };

    let wide_subkey: Vec<u16> = subkey.encode_utf16().chain(std::iter::once(0)).collect();
    let wide_val: Vec<u16> = value_name.encode_utf16().chain(std::iter::once(0)).collect();

    let mut key: HKEY = std::ptr::null_mut();
    let status = unsafe { RegOpenKeyExW(hkey, wide_subkey.as_ptr(), 0, KEY_READ, &mut key) };
    if status != 0 {
        return None;
    }

    let mut val_type: u32 = 0;
    let mut byte_len: u32 = 0;
    let query_status = unsafe {
        RegQueryValueExW(
            key,
            wide_val.as_ptr(),
            std::ptr::null_mut(),
            &mut val_type,
            std::ptr::null_mut(),
            &mut byte_len,
        )
    };
    if query_status != 0 || byte_len == 0 || (val_type != REG_SZ && val_type != REG_EXPAND_SZ) {
        unsafe { RegCloseKey(key) };
        return None;
    }

    let mut buffer: Vec<u16> = vec![0u16; (byte_len as usize / 2) + 1];
    let query_status = unsafe {
        RegQueryValueExW(
            key,
            wide_val.as_ptr(),
            std::ptr::null_mut(),
            &mut val_type,
            buffer.as_mut_ptr() as *mut u8,
            &mut byte_len,
        )
    };
    unsafe { RegCloseKey(key) };

    if query_status != 0 {
        return None;
    }

    let actual_len = buffer.iter().position(|&c| c == 0).unwrap_or(buffer.len());
    let val_str = OsString::from_wide(&buffer[..actual_len])
        .to_string_lossy()
        .trim()
        .to_string();
    if val_str.is_empty() {
        None
    } else {
        Some(PathBuf::from(val_str))
    }
}

#[cfg(target_os = "windows")]
fn resolve_usr_root_from_windows_registry() -> Option<PathBuf> {
    use windows_sys::Win32::System::Registry::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE};

    const SUBKEYS: &[&str] = &[
        "Software\\GreebleFS",
        "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\GreebleFS",
        "Software\\OverlayTerm",
        "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\OverlayTerm",
    ];

    for &hkey in &[HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE] {
        for &subkey in SUBKEYS {
            if let Some(path) = read_windows_registry_string(hkey, subkey, "UsrRootDirectory") {
                let normalized = normalize_usr_root_candidate(path);
                if normalized.exists() {
                    return Some(normalized);
                }
            }
            if let Some(install_loc) = read_windows_registry_string(hkey, subkey, "InstallLocation") {
                let candidate = install_loc.join("usr");
                if candidate.exists() {
                    return Some(candidate);
                }
            }
        }
    }
    None
}

#[cfg(not(target_os = "windows"))]
fn resolve_usr_root_from_windows_registry() -> Option<PathBuf> {
    None
}

fn resolve_well_known_toolchain_root() -> Option<PathBuf> {
    const CANDIDATES: &[&str] = &[
        "T:\\toolchain\\usr",
        "T:\\toolchain",
        "T:/toolchain/usr",
        "T:/toolchain",
        "C:\\toolchain\\usr",
        "C:\\toolchain",
    ];

    for &candidate in CANDIDATES {
        let path = PathBuf::from(candidate);
        if path.exists() {
            let normalized = normalize_usr_root_candidate(path);
            if normalized.exists() {
                return Some(normalized);
            }
        }
    }
    None
}

pub fn load_usr_manifest() -> Result<UsrManifest, String> {
    serde_json::from_str(REPO_USR_MANIFEST_TEXT)
        .map_err(|error| format!("Failed to parse usr manifest: {error}"))
}

pub fn build_usr_profile_relative_directory(profile_id: &str, relative_directory: &str) -> PathBuf {
    PathBuf::from(USR_PROFILES_DIRECTORY_NAME)
        .join(profile_id)
        .join(relative_directory)
}

pub fn resolve_shipped_usr_entry_relative_directory(entry: &UsrManifestEntry) -> PathBuf {
    match entry.profile_mode {
        UsrProfileLaneMode::SharedRoot => PathBuf::from(&entry.relative_directory),
        UsrProfileLaneMode::ProfileOverlay => {
            build_usr_profile_relative_directory(DEFAULT_USR_PROFILE_ID, &entry.relative_directory)
        }
    }
}

pub fn resolve_bundled_usr_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    if let Some(explicit_root) = read_first_env_path(&[
        "GREEBLEFS_USR_DIR",
        "OVERLAYTERM_USR_DIR",
        "VITE_GREEBLEFS_USR_DIR",
        "VITE_OVERLAYTERM_USR_DIR",
        "GREEBLEFS_MANAGED_CONTENT_ROOT",
        "TOOLCHAIN_USR_DIR",
        "TOOLCHAIN_DIR",
    ]) {
        let normalized = normalize_usr_root_candidate(explicit_root);
        if normalized.exists() {
            return Ok(normalized);
        }
    }

    if let Ok(resource_root) = app.path().resource_dir() {
        let bundled_root = resource_root.join("usr");
        if bundled_root.exists() {
            return Ok(bundled_root);
        }
    }

    if let Some(custom_root) = custom_managed_content_root() {
        if custom_root.exists() && custom_root.join("manifest.json").exists() {
            return Ok(custom_root);
        }
    }

    let repo_root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../usr");
    if repo_root.exists() {
        return Ok(repo_root);
    }

    if let Some(toolchain_root) = resolve_well_known_toolchain_root() {
        return Ok(toolchain_root);
    }

    Ok(repo_root)
}

/// Explicitly chosen managed root: env override first, then the installer
/// profile (`greeblefs-install-profile.toml` beside the executable), then
/// Windows registry, then well-known toolchain paths.
/// `None` means stock behavior (OS app-local data dir).
pub fn custom_managed_content_root() -> Option<PathBuf> {
    if let Some(explicit_root) = read_first_env_path(&[
        "GREEBLEFS_MANAGED_CONTENT_ROOT",
        "GREEBLEFS_USR_DIR",
        "OVERLAYTERM_MANAGED_CONTENT_ROOT",
        "OVERLAYTERM_USR_DIR",
        "VITE_GREEBLEFS_USR_DIR",
        "VITE_OVERLAYTERM_USR_DIR",
        "TOOLCHAIN_USR_DIR",
        "TOOLCHAIN_DIR",
        "GREEBLEFS_TOOLCHAIN_DIR",
    ]) {
        return Some(normalize_usr_root_candidate(explicit_root));
    }

    if let Some(profile_root) = resolve_managed_content_root_from_install_profile() {
        return Some(normalize_usr_root_candidate(profile_root));
    }

    if let Some(reg_root) = resolve_usr_root_from_windows_registry() {
        return Some(reg_root);
    }

    if let Some(toolchain_root) = resolve_well_known_toolchain_root() {
        return Some(toolchain_root);
    }

    None
}

/// Writable root for ALL app data lanes (caches, DBs, cloud tokens,
/// thumbnails, models, screenshots, ...). Honors the installer's usr-root
/// choice; falls back to the OS app-local data dir only when no custom
/// root is configured.
pub fn resolve_writable_data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    if let Some(custom_root) = custom_managed_content_root() {
        return Ok(custom_root);
    }

    if let Some(installed_root) = installed_layout_fallback_root() {
        return Ok(installed_root);
    }

    app.path()
        .app_local_data_dir()
        .map_err(|error| format!("Failed to resolve app local data directory: {error}"))
}

/// Install roots that carry an install profile or have a `usr` directory
/// beside the executable. The workspace belongs beside the executable —
/// never AppData. Callers bootstrap bundled content into it on startup.
fn installed_layout_fallback_root() -> Option<PathBuf> {
    let install_root = resolve_install_root_from_current_executable()?;

    let usr_beside = install_root.join("usr");
    if usr_beside.exists() {
        return Some(usr_beside);
    }

    if let Some(parent) = install_root.parent() {
        let parent_usr = parent.join("usr");
        if parent_usr.exists() {
            return Some(parent_usr);
        }
    }

    if resolve_install_profile_path(&install_root).exists() {
        return Some(install_root.join("usr"));
    }

    None
}

pub fn resolve_managed_content_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    if let Some(custom_root) = custom_managed_content_root() {
        return Ok(custom_root);
    }

    if let Some(installed_root) = installed_layout_fallback_root() {
        return Ok(installed_root);
    }

    if let Ok(resource_root) = app.path().resource_dir() {
        let bundled = resource_root.join("usr");
        if bundled.exists() && bundled.join("manifest.json").exists() {
            return Ok(bundled);
        }
    }

    let app_local_data_root = app
        .path()
        .app_local_data_dir()
        .map_err(|error| format!("Failed to resolve app local data directory: {error}"))?;
    Ok(app_local_data_root.join("usr"))
}

pub fn resolve_shared_usr_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    if read_first_env_path(&[
        "GREEBLEFS_MANAGED_CONTENT_ROOT",
        "OVERLAYTERM_MANAGED_CONTENT_ROOT",
    ])
    .is_some()
    {
        return resolve_managed_content_root(app);
    }

    if cfg!(debug_assertions) {
        return resolve_bundled_usr_root(app);
    }

    resolve_managed_content_root(app)
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
            let child =
                child.map_err(|error| format!("Failed to read directory entry: {error}"))?;
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

    if source_root == target_root {
        return Ok(());
    }

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
        let relative_path = resolve_shipped_usr_entry_relative_directory(entry);
        let source_path = source_root.join(&relative_path);
        if !source_path.exists() {
            continue;
        }

        let target_path = target_root.join(&relative_path);
        copy_missing_entries(&source_path, &target_path)?;
    }

    Ok(())
}

pub fn resolve_usr_relative_path(
    app: &tauri::AppHandle,
    relative_path: &str,
) -> Result<PathBuf, String> {
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
    fs::read_to_string(&path).map_err(|error| format!("Failed to read {}: {error}", path.display()))
}

#[cfg(test)]
mod tests {
    use super::resolve_managed_content_root_from_profile_text;
    use std::path::Path;

    #[test]
    fn installer_profile_prefers_explicit_managed_content_root() {
        let install_root = Path::new("C:/Portable/GreebleFS");
        let resolved_root = resolve_managed_content_root_from_profile_text(
            r#"
managedContentRoot = 'PortableUsr'
pluginsDirectory = 'PortableUsr/plugins'
"#,
            install_root,
        )
        .expect("managed content root should resolve");
        assert_eq!(resolved_root, install_root.join("PortableUsr"));
    }

    #[test]
    fn installer_profile_derives_managed_content_root_from_plugins_directory() {
        let install_root = Path::new("C:/Portable/GreebleFS");
        let resolved_root = resolve_managed_content_root_from_profile_text(
            r#"
pluginsDirectory = 'D:\Shared\GreebleUsr\plugins'
"#,
            install_root,
        )
        .expect("plugins directory parent should resolve");
        assert_eq!(resolved_root, Path::new("D:/Shared/GreebleUsr"));
    }

    #[test]
    fn installer_profile_resolves_relative_plugins_directory_against_install_root() {
        let install_root = Path::new("C:/Portable/GreebleFS");
        let resolved_root = resolve_managed_content_root_from_profile_text(
            "pluginsDirectory = 'usr/plugins'",
            install_root,
        )
        .expect("relative plugins directory should resolve");
        assert_eq!(resolved_root, install_root.join("usr"));
    }

    #[test]
    fn normalizes_toolchain_dir_to_usr_child_if_usr_has_manifest() {
        use super::normalize_usr_root_candidate;
        use std::path::PathBuf;

        // Path where manifest exists inside usr (e.g. repo root)
        let repo_root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..");
        let normalized = normalize_usr_root_candidate(repo_root.clone());
        assert_eq!(normalized, repo_root.join("usr"));
    }
}
