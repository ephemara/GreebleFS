/// vst_commands.rs — VST3 plugin discovery
/// Implements the Steinberg-standard host scan path spec for Linux, macOS, and Windows.
/// Reference: https://steinbergmedia.github.io/vst3_dev_portal/pages/Technical+Documentation/Locations+Format/Plugin+Locations.html

use serde::{Deserialize, Serialize};
use specta::Type;
use std::path::PathBuf;

// ── Types ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct VstScanPath {
    /// Absolute filesystem path to scan.
    pub path: String,
    /// True if the path exists on the current machine.
    pub exists: bool,
    /// "system" = OS-level standard path, "user" = per-user standard path, "custom" = user added.
    pub kind: VstScanPathKind,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum VstScanPathKind {
    System,
    User,
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct VstPluginEntry {
    /// Human-readable plugin name (derived from filename).
    pub name: String,
    /// Absolute path to the .vst3 bundle / folder.
    pub path: String,
    /// Filename of the .vst3 entry without extension.
    pub file_stem: String,
}

// ── Platform path resolution ──────────────────────────────────────────────────

/// Returns the Steinberg-standard VST3 scan paths for the current OS runtime.
/// Rust owns this knowledge — the frontend never needs to check platform.
pub fn platform_default_vst3_paths() -> Vec<VstScanPath> {
    let mut paths: Vec<VstScanPath> = Vec::new();

    #[cfg(target_os = "linux")]
    {
        // Steinberg Linux spec: user home first, then system-wide.
        if let Some(home) = dirs::home_dir() {
            push_path(&mut paths, home.join(".vst3"), VstScanPathKind::User);
        }
        push_path(&mut paths, PathBuf::from("/usr/lib/vst3"), VstScanPathKind::System);
        push_path(&mut paths, PathBuf::from("/usr/local/lib/vst3"), VstScanPathKind::System);
        // Some distros / plugin installers also use:
        push_path(&mut paths, PathBuf::from("/usr/lib/x86_64-linux-gnu/vst3"), VstScanPathKind::System);
    }

    #[cfg(target_os = "macos")]
    {
        if let Some(home) = dirs::home_dir() {
            push_path(&mut paths, home.join("Library/Audio/Plug-Ins/VST3"), VstScanPathKind::User);
        }
        push_path(&mut paths, PathBuf::from("/Library/Audio/Plug-Ins/VST3"), VstScanPathKind::System);
    }

    #[cfg(target_os = "windows")]
    {
        // %COMMONPROGRAMFILES%\VST3 — the primary Steinberg Windows location.
        if let Ok(common) = std::env::var("COMMONPROGRAMFILES") {
            push_path(&mut paths, PathBuf::from(&common).join("VST3"), VstScanPathKind::System);
        } else {
            push_path(&mut paths, PathBuf::from("C:\\Program Files\\Common Files\\VST3"), VstScanPathKind::System);
        }
        // %LOCALAPPDATA%\Programs\Common\VST3
        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            push_path(&mut paths, PathBuf::from(&local).join("Programs\\Common\\VST3"), VstScanPathKind::User);
        }
    }

    paths
}

fn push_path(out: &mut Vec<VstScanPath>, path: PathBuf, kind: VstScanPathKind) {
    let exists = path.exists();
    out.push(VstScanPath {
        path: path.to_string_lossy().to_string(),
        exists,
        kind,
    });
}

// ── Plugin scanning ───────────────────────────────────────────────────────────

/// Recursively scan a list of directories for .vst3 plugin bundles.
///
/// On Linux, valid entries are either:
///   - `<Name>.vst3/` directory (bundle)
///   - `<Name>.vst3` shared-object file (flat format, less common)
///
/// On macOS: `<Name>.vst3` bundle (directory)
/// On Windows: `<Name>.vst3` folder (or occasionally .dll, but .vst3 folders are standard)
fn scan_dir_for_plugins(dir: &PathBuf, out: &mut Vec<VstPluginEntry>) {
    let read = match std::fs::read_dir(dir) {
        Ok(r) => r,
        Err(_) => return,
    };

    for entry in read.flatten() {
        let path = entry.path();
        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();

        if ext == "vst3" {
            let file_stem = path
                .file_stem()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_else(|| "Unknown".to_string());

            // Human-readable name: file stem with spaces instead of camel-case separators.
            // FabFilterProQ3.vst3 → "FabFilterProQ3" (leave as-is; DAWs don't mangle names).
            out.push(VstPluginEntry {
                name: file_stem.clone(),
                path: path.to_string_lossy().to_string(),
                file_stem,
            });
        } else if path.is_dir() {
            // Recurse one level only (bundles don't nest, but folders like ~/.vst3/<vendor>/ do).
            scan_dir_for_plugins(&path, out);
        }
    }
}

// ── Tauri Commands ────────────────────────────────────────────────────────────

/// Return the platform-default VST3 scan paths with existence metadata.
/// The frontend uses this to display which paths are active and valid.
#[tauri::command]
#[specta::specta]
pub fn vst_get_default_scan_paths() -> Vec<VstScanPath> {
    platform_default_vst3_paths()
}

/// Scan a list of folders (default + user-custom) for .vst3 bundles.
/// Returns a deduplicated, sorted list ready to populate a dropdown.
#[tauri::command]
#[specta::specta]
pub fn vst_scan_plugins(paths: Vec<String>) -> Vec<VstPluginEntry> {
    let mut out: Vec<VstPluginEntry> = Vec::new();

    for raw_path in &paths {
        let dir = PathBuf::from(raw_path);
        if dir.exists() {
            scan_dir_for_plugins(&dir, &mut out);
        }
    }

    // Deduplicate by path, sort by name so the dropdown is alphabetical.
    out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    out.dedup_by(|a, b| a.path == b.path);
    out
}
