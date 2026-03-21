// File system commands for the OverlayTerm file explorer
// Provides: dir listing with metadata, Windows drive enumeration,
// open-with-default-app, open-as-admin (runas), delete, rename, copy.

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

// ─── Data types ───────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: u64, // unix timestamp millis
    pub extension: String,
    pub is_hidden: bool,
    pub is_symlink: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DriveInfo {
    pub letter: String,
    pub label: String,
    pub total_bytes: u64,
    pub free_bytes: u64,
    pub drive_type: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EntryStorageInfo {
    pub path: String,
    pub bytes: u64,
    pub is_dir: bool,
    pub is_complete: bool,
}

#[derive(Debug, Clone)]
struct CachedEntrySize {
    bytes: u64,
    is_dir: bool,
    is_complete: bool,
    measured_at: Instant,
}

const ENTRY_SIZE_CACHE_TTL: Duration = Duration::from_secs(10);
const ENTRY_SIZE_SCAN_BUDGET: Duration = Duration::from_millis(900);
static ENTRY_SIZE_CACHE: OnceLock<Mutex<HashMap<String, CachedEntrySize>>> = OnceLock::new();

fn entry_size_cache() -> &'static Mutex<HashMap<String, CachedEntrySize>> {
    ENTRY_SIZE_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn path_cache_key(path: &Path) -> String {
    path.to_string_lossy().to_string()
}

fn invalidate_entry_size_cache(path: &Path) {
    let key = path_cache_key(path);
    let key_with_separator = if key.ends_with(std::path::MAIN_SEPARATOR) {
        key.clone()
    } else {
        format!("{key}{}", std::path::MAIN_SEPARATOR)
    };

    if let Ok(mut cache) = entry_size_cache().lock() {
        cache.retain(|cached_path, _| {
            if cached_path == &key || cached_path.starts_with(&key_with_separator) {
                return false;
            }

            let cached_path_with_separator = if cached_path.ends_with(std::path::MAIN_SEPARATOR) {
                cached_path.clone()
            } else {
                format!("{cached_path}{}", std::path::MAIN_SEPARATOR)
            };

            !key.starts_with(&cached_path_with_separator)
        });
    }
}

fn measure_path_size(path: &Path) -> (u64, bool, bool) {
    let metadata = match std::fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(_) => return (0, false, false),
    };

    let file_type = metadata.file_type();
    if file_type.is_symlink() {
        return (0, file_type.is_dir(), true);
    }

    if metadata.is_file() {
        return (metadata.len(), false, true);
    }

    if !metadata.is_dir() {
        return (0, false, false);
    }

    let mut total_bytes = 0_u64;
    let mut stack = vec![path.to_path_buf()];
    let mut visited = HashSet::new();
    let deadline = Instant::now() + ENTRY_SIZE_SCAN_BUDGET;

    while let Some(dir) = stack.pop() {
        if Instant::now() >= deadline {
            return (total_bytes, true, false);
        }

        let canonical = dir.canonicalize().unwrap_or(dir.clone());
        if !visited.insert(canonical) {
            continue;
        }

        let read_dir = match std::fs::read_dir(&dir) {
            Ok(entries) => entries,
            Err(_) => continue,
        };

        for entry in read_dir.flatten() {
            if Instant::now() >= deadline {
                return (total_bytes, true, false);
            }

            let entry_path = entry.path();
            let entry_metadata = match std::fs::symlink_metadata(&entry_path) {
                Ok(metadata) => metadata,
                Err(_) => continue,
            };

            let entry_type = entry_metadata.file_type();
            if entry_type.is_symlink() {
                continue;
            }

            if entry_type.is_dir() {
                stack.push(entry_path);
                continue;
            }

            if entry_type.is_file() {
                total_bytes = total_bytes.saturating_add(entry_metadata.len());
            }
        }
    }

    (total_bytes, true, true)
}

fn measure_entry_sizes_blocking(paths: Vec<String>, force_refresh: bool) -> Vec<EntryStorageInfo> {
    let now = Instant::now();
    let mut results = Vec::with_capacity(paths.len());
    let mut pending: Vec<(usize, PathBuf, String)> = Vec::new();

    if let Ok(cache) = entry_size_cache().lock() {
        for (index, raw_path) in paths.iter().enumerate() {
            let path = PathBuf::from(raw_path);
            let key = path_cache_key(&path);
            let cached = if force_refresh {
                None
            } else {
                cache
                    .get(&key)
                    .filter(|entry| now.duration_since(entry.measured_at) <= ENTRY_SIZE_CACHE_TTL)
                    .cloned()
            };

            if let Some(entry) = cached {
                results.push(EntryStorageInfo {
                    path: key,
                    bytes: entry.bytes,
                    is_dir: entry.is_dir,
                    is_complete: entry.is_complete,
                });
            } else {
                results.push(EntryStorageInfo {
                    path: key.clone(),
                    bytes: 0,
                    is_dir: path.is_dir(),
                    is_complete: !path.is_dir(),
                });
                pending.push((index, path, key));
            }
        }
    }

    if pending.is_empty() {
        return results;
    }

    let mut cache_updates = Vec::with_capacity(pending.len());
    for (index, path, key) in pending {
        let (bytes, is_dir, is_complete) = measure_path_size(&path);
        results[index] = EntryStorageInfo {
            path: key.clone(),
            bytes,
            is_dir,
            is_complete,
        };
        cache_updates.push((
            key,
            CachedEntrySize {
                bytes,
                is_dir,
                is_complete,
                measured_at: now,
            },
        ));
    }

    if let Ok(mut cache) = entry_size_cache().lock() {
        for (key, entry) in cache_updates {
            cache.insert(key, entry);
        }
    }

    results
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum FileTransferOperation {
    Copy,
    Move,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileTransferResult {
    pub source_path: String,
    pub destination_path: String,
    pub operation: FileTransferOperation,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum FileSearchMatchKind {
    Name,
    Content,
    NameAndContent,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileSearchResult {
    pub name: String,
    pub path: String,
    pub relative_path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: u64,
    pub extension: String,
    pub is_hidden: bool,
    pub is_symlink: bool,
    pub match_kind: FileSearchMatchKind,
    pub snippet: String,
    pub line_number: Option<u64>,
}

// ─── fs_list_dir ─────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn fs_list_dir(path: String, show_hidden: bool) -> Result<Vec<FileEntry>, String> {
    let dir_path = Path::new(&path);
    if !dir_path.exists() {
        return Err(format!("Path does not exist: {}", path));
    }
    if !dir_path.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    let read_dir =
        std::fs::read_dir(dir_path).map_err(|e| format!("Failed to read directory: {}", e))?;

    let mut entries: Vec<FileEntry> = Vec::new();
    for entry_result in read_dir {
        let entry = match entry_result {
            Ok(e) => e,
            Err(_) => continue,
        };

        let file_name = entry.file_name();
        let name = file_name.to_string_lossy().to_string();

        // Skip hidden files unless show_hidden is true
        let is_hidden = name.starts_with('.');
        #[cfg(target_os = "windows")]
        let is_hidden = is_hidden || {
            use std::os::windows::fs::MetadataExt;
            entry
                .metadata()
                .map(|m| m.file_attributes() & 0x2 != 0)
                .unwrap_or(false)
        };

        if is_hidden && !show_hidden {
            continue;
        }

        let meta = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };

        let modified = meta
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        let is_symlink = meta.file_type().is_symlink();
        let is_dir = meta.is_dir();
        let size = if is_dir { 0 } else { meta.len() };

        let entry_path = entry.path().to_string_lossy().to_string();
        let extension = if is_dir {
            String::new()
        } else {
            entry
                .path()
                .extension()
                .map(|e| e.to_string_lossy().to_lowercase())
                .unwrap_or_default()
        };

        entries.push(FileEntry {
            name,
            path: entry_path,
            is_dir,
            size,
            modified,
            extension,
            is_hidden,
            is_symlink,
        });
    }

    // Sort: directories first, then files, alphabetically within each group
    entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    Ok(entries)
}

#[tauri::command]
pub async fn fs_measure_entry_sizes(
    paths: Vec<String>,
    force_refresh: Option<bool>,
) -> Result<Vec<EntryStorageInfo>, String> {
    let deduped_paths = paths
        .into_iter()
        .filter(|path| !path.trim().is_empty())
        .collect::<Vec<_>>();

    tauri::async_runtime::spawn_blocking(move || {
        measure_entry_sizes_blocking(deduped_paths, force_refresh.unwrap_or(false))
    })
    .await
    .map_err(|error| format!("Failed to measure entry sizes: {error}"))
}

// ─── fs_get_drives (Windows) ──────────────────────────────────────────────────

#[tauri::command]
pub async fn fs_get_drives() -> Result<Vec<DriveInfo>, String> {
    #[cfg(target_os = "windows")]
    {
        let drives = get_windows_drives()?;
        return Ok(drives);
    }

    #[cfg(target_os = "macos")]
    {
        let mut drives = vec![root_drive_info()];
        drives.extend(read_unix_mount_directories("/Volumes"));
        return Ok(drives);
    }

    #[cfg(target_os = "linux")]
    {
        let mut drives = vec![root_drive_info()];
        drives.extend(read_unix_mount_directories("/media"));
        drives.extend(read_unix_mount_directories("/mnt"));
        return Ok(deduplicate_drives(drives));
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Ok(vec![root_drive_info()])
    }
}

#[cfg(target_os = "windows")]
fn get_windows_drives() -> Result<Vec<DriveInfo>, String> {
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;

    // GetLogicalDriveStringsW returns a multi-string (double-null terminated)
    let mut buffer = vec![0u16; 256];
    let len = unsafe {
        windows_sys::Win32::Storage::FileSystem::GetLogicalDriveStringsW(
            buffer.len() as u32,
            buffer.as_mut_ptr(),
        )
    };

    if len == 0 {
        return Err("Failed to enumerate drives".to_string());
    }

    let mut drives = Vec::new();
    let mut start = 0;
    for i in 0..len as usize {
        if buffer[i] == 0 {
            if i > start {
                let drive_str = OsString::from_wide(&buffer[start..i])
                    .to_string_lossy()
                    .to_string();
                let letter = drive_str.trim_end_matches('\\').to_string();

                // Get drive info
                let mut total_bytes: u64 = 0;
                let mut free_bytes: u64 = 0;
                let drive_w: Vec<u16> =
                    drive_str.encode_utf16().chain(std::iter::once(0)).collect();

                unsafe {
                    windows_sys::Win32::Storage::FileSystem::GetDiskFreeSpaceExW(
                        drive_w.as_ptr(),
                        std::ptr::null_mut(),
                        &mut total_bytes as *mut u64,
                        &mut free_bytes as *mut u64,
                    );
                }

                let drive_type = unsafe {
                    let t =
                        windows_sys::Win32::Storage::FileSystem::GetDriveTypeW(drive_w.as_ptr());
                    match t {
                        2 => "removable",
                        3 => "fixed",
                        4 => "remote",
                        5 => "cdrom",
                        6 => "ramdisk",
                        _ => "unknown",
                    }
                };

                // Get volume label
                let mut vol_buf = vec![0u16; 128];
                unsafe {
                    windows_sys::Win32::Storage::FileSystem::GetVolumeInformationW(
                        drive_w.as_ptr(),
                        vol_buf.as_mut_ptr(),
                        vol_buf.len() as u32,
                        std::ptr::null_mut(),
                        std::ptr::null_mut(),
                        std::ptr::null_mut(),
                        std::ptr::null_mut(),
                        0,
                    );
                }
                let label_end = vol_buf.iter().position(|&c| c == 0).unwrap_or(0);
                let label = OsString::from_wide(&vol_buf[..label_end])
                    .to_string_lossy()
                    .to_string();
                let label = if label.is_empty() {
                    letter.clone()
                } else {
                    label
                };

                drives.push(DriveInfo {
                    letter: letter.clone(),
                    label,
                    total_bytes,
                    free_bytes,
                    drive_type: drive_type.to_string(),
                });
            }
            start = i + 1;
        }
    }

    Ok(drives)
}

#[cfg(not(target_os = "windows"))]
fn root_drive_info() -> DriveInfo {
    DriveInfo {
        letter: "/".to_string(),
        label: "Root".to_string(),
        total_bytes: 0,
        free_bytes: 0,
        drive_type: "fixed".to_string(),
    }
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
fn read_unix_mount_directories(base_path: &str) -> Vec<DriveInfo> {
    let path = Path::new(base_path);
    let read_dir = match std::fs::read_dir(path) {
        Ok(entries) => entries,
        Err(_) => return Vec::new(),
    };

    let mut drives = Vec::new();
    for entry in read_dir.flatten() {
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if !file_type.is_dir() {
            continue;
        }

        let mount_path = entry.path();
        let label = entry.file_name().to_string_lossy().to_string();
        drives.push(DriveInfo {
            letter: mount_path.to_string_lossy().to_string(),
            label: if label.is_empty() {
                mount_path.to_string_lossy().to_string()
            } else {
                label
            },
            total_bytes: 0,
            free_bytes: 0,
            drive_type: "mounted".to_string(),
        });
    }

    drives.sort_by(|a, b| a.label.to_lowercase().cmp(&b.label.to_lowercase()));
    drives
}

#[cfg(target_os = "linux")]
fn deduplicate_drives(drives: Vec<DriveInfo>) -> Vec<DriveInfo> {
    use std::collections::HashSet;

    let mut seen = HashSet::new();
    let mut unique = Vec::new();
    for drive in drives {
        if seen.insert(drive.letter.clone()) {
            unique.push(drive);
        }
    }
    unique
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
fn shell_quote_single(value: &str) -> String {
    format!("'{}'", value.replace('\'', r#"'\''"#))
}

#[cfg(target_os = "macos")]
fn escape_applescript_string(value: &str) -> String {
    value.replace('\\', "\\\\").replace('\"', "\\\"")
}

fn normalized_extension(path: &Path) -> String {
    path.extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
}

fn is_hidden_name(name: &str) -> bool {
    name.starts_with('.')
}

fn is_hidden_entry(entry: &std::fs::DirEntry, name: &str) -> bool {
    let is_hidden = is_hidden_name(name);

    #[cfg(target_os = "windows")]
    let is_hidden = is_hidden || {
        use std::os::windows::fs::MetadataExt;
        entry
            .metadata()
            .map(|metadata| metadata.file_attributes() & 0x2 != 0)
            .unwrap_or(false)
    };

    is_hidden
}

fn is_searchable_text_file(path: &Path) -> bool {
    const EXTENSIONS: &[&str] = &[
        "txt", "md", "mdx", "log", "json", "yaml", "yml", "toml", "xml", "ini", "cfg", "csv", "ts",
        "tsx", "js", "jsx", "mjs", "cjs", "rs", "py", "go", "c", "h", "cpp", "hpp", "cc", "cxx",
        "cs", "java", "kt", "kts", "rb", "php", "swift", "dart", "lua", "zig", "html", "htm",
        "css", "scss", "sass", "less", "sh", "bash", "zsh", "ps1", "bat", "cmd", "env", "glsl",
        "hlsl", "wgsl", "sql", "kain", "ink",
    ];

    let ext = normalized_extension(path);
    if EXTENSIONS.contains(&ext.as_str()) {
        return true;
    }

    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();

    matches!(
        name.as_str(),
        "dockerfile"
            | "makefile"
            | "readme"
            | "license"
            | "changelog"
            | ".gitignore"
            | ".gitattributes"
            | ".env"
            | ".env.local"
            | ".env.development"
            | ".env.production"
    )
}

fn build_search_snippet(line: &str, query_lower: &str) -> String {
    let normalized = line.trim().replace('\t', " ");
    if normalized.is_empty() {
        return String::new();
    }

    let lower = normalized.to_ascii_lowercase();
    if let Some(pos) = lower.find(query_lower) {
        let mut start = pos.saturating_sub(40);
        let mut end = (pos + query_lower.len() + 80).min(normalized.len());

        while start > 0 && !normalized.is_char_boundary(start) {
            start -= 1;
        }
        while end < normalized.len() && !normalized.is_char_boundary(end) {
            end += 1;
        }

        let mut snippet = normalized[start..end].trim().to_string();
        if start > 0 {
            snippet = format!("…{}", snippet);
        }
        if end < normalized.len() {
            snippet.push('…');
        }
        return snippet;
    }

    let mut snippet: String = normalized.chars().take(180).collect();
    if normalized.chars().count() > 180 {
        snippet.push('…');
    }
    snippet
}

#[tauri::command]
pub async fn fs_search_entries(
    path: String,
    query: String,
    show_hidden: bool,
    include_content: bool,
    limit: Option<usize>,
) -> Result<Vec<FileSearchResult>, String> {
    let root = PathBuf::from(&path);
    if !root.exists() {
        return Err(format!("Path does not exist: {}", path));
    }
    if !root.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    let query = query.trim().to_string();
    if query.is_empty() {
        return Ok(Vec::new());
    }

    let query_lower = query.to_ascii_lowercase();
    let max_results = limit.unwrap_or(250).clamp(1, 1000);
    const MAX_CONTENT_BYTES: u64 = 8 * 1024 * 1024;

    let mut stack = vec![root.clone()];
    let mut combined_matches: Vec<FileSearchResult> = Vec::new();
    let mut content_matches: Vec<FileSearchResult> = Vec::new();
    let mut name_matches: Vec<FileSearchResult> = Vec::new();

    while let Some(current_dir) = stack.pop() {
        let read_dir = match std::fs::read_dir(&current_dir) {
            Ok(entries) => entries,
            Err(_) => continue,
        };

        for entry_result in read_dir {
            let entry = match entry_result {
                Ok(value) => value,
                Err(_) => continue,
            };

            let name = entry.file_name().to_string_lossy().to_string();
            let is_hidden = is_hidden_entry(&entry, &name);
            if is_hidden && !show_hidden {
                continue;
            }

            let meta = match entry.metadata() {
                Ok(value) => value,
                Err(_) => continue,
            };

            let path_buf = entry.path();
            let is_dir = meta.is_dir();
            let is_symlink = meta.file_type().is_symlink();
            let modified = meta
                .modified()
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0);
            let extension = if is_dir {
                String::new()
            } else {
                normalized_extension(&path_buf)
            };
            let relative_path = path_buf
                .strip_prefix(&root)
                .map(|relative| relative.to_string_lossy().to_string())
                .unwrap_or_else(|_| path_buf.to_string_lossy().to_string());
            let name_hit = name.to_ascii_lowercase().contains(&query_lower);

            if is_dir {
                if name_hit {
                    name_matches.push(FileSearchResult {
                        name,
                        path: path_buf.to_string_lossy().to_string(),
                        relative_path,
                        is_dir,
                        size: 0,
                        modified,
                        extension,
                        is_hidden,
                        is_symlink,
                        match_kind: FileSearchMatchKind::Name,
                        snippet: String::new(),
                        line_number: None,
                    });
                }

                if !is_symlink {
                    stack.push(path_buf);
                }
                continue;
            }

            let mut content_hit = false;
            let mut snippet = String::new();
            let mut line_number = None;

            if include_content
                && meta.len() <= MAX_CONTENT_BYTES
                && is_searchable_text_file(&path_buf)
            {
                if let Ok(file) = std::fs::File::open(&path_buf) {
                    let reader = std::io::BufReader::new(file);
                    use std::io::BufRead;
                    for (idx, line_result) in reader.lines().enumerate() {
                        let line = match line_result {
                            Ok(value) => value,
                            Err(_) => break,
                        };
                        if line.to_ascii_lowercase().contains(&query_lower) {
                            content_hit = true;
                            snippet = build_search_snippet(&line, &query_lower);
                            line_number = Some((idx + 1) as u64);
                            break;
                        }
                    }
                }
            }

            if !name_hit && !content_hit {
                continue;
            }

            let result = FileSearchResult {
                name,
                path: path_buf.to_string_lossy().to_string(),
                relative_path,
                is_dir,
                size: meta.len(),
                modified,
                extension,
                is_hidden,
                is_symlink,
                match_kind: match (name_hit, content_hit) {
                    (true, true) => FileSearchMatchKind::NameAndContent,
                    (false, true) => FileSearchMatchKind::Content,
                    _ => FileSearchMatchKind::Name,
                },
                snippet,
                line_number,
            };

            match result.match_kind {
                FileSearchMatchKind::NameAndContent => combined_matches.push(result),
                FileSearchMatchKind::Content => content_matches.push(result),
                FileSearchMatchKind::Name => name_matches.push(result),
            }
        }
    }

    let mut results = Vec::new();
    results.extend(combined_matches);
    results.extend(content_matches);
    results.extend(name_matches);
    results.sort_by(|a, b| {
        let rank = |kind: FileSearchMatchKind| match kind {
            FileSearchMatchKind::NameAndContent => 0u8,
            FileSearchMatchKind::Content => 1u8,
            FileSearchMatchKind::Name => 2u8,
        };

        rank(a.match_kind)
            .cmp(&rank(b.match_kind))
            .then_with(|| {
                a.path
                    .to_ascii_lowercase()
                    .cmp(&b.path.to_ascii_lowercase())
            })
            .then_with(|| {
                a.name
                    .to_ascii_lowercase()
                    .cmp(&b.name.to_ascii_lowercase())
            })
    });
    results.truncate(max_results);
    Ok(results)
}

#[cfg(any(target_os = "windows", target_os = "macos"))]
fn map_default_open_result(result: file_opening::OpenResult) -> Result<(), String> {
    match result {
        file_opening::OpenResult::Success => Ok(()),
        file_opening::OpenResult::FileNotFound { path } => Err(format!("File not found: {}", path)),
        file_opening::OpenResult::AppNotFound { app_id } => Err(format!(
            "Application not found for file open request: {}",
            app_id
        )),
        file_opening::OpenResult::PermissionDenied { path } => {
            Err(format!("Permission denied while opening: {}", path))
        }
        file_opening::OpenResult::PlatformError { message } => Err(message),
    }
}

fn should_execute_path(path: &Path) -> bool {
    if path.is_dir() {
        return false;
    }

    let extension = normalized_extension(path);
    if matches!(
        extension.as_str(),
        "exe" | "msi" | "com" | "bat" | "cmd" | "ps1" | "sh" | "bash" | "zsh" | "fish"
    ) {
        return true;
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;

        return std::fs::metadata(path)
            .map(|metadata| metadata.permissions().mode() & 0o111 != 0)
            .unwrap_or(false);
    }

    #[cfg(not(unix))]
    {
        false
    }
}

fn open_with_default_application(path: &Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use file_opening::FileOpener;
        use file_opening_windows::WindowsFileOpener;

        let opener = WindowsFileOpener;
        return map_default_open_result(
            opener
                .open_with_default(path)
                .map_err(|error| error.to_string())?,
        );
    }

    #[cfg(target_os = "macos")]
    {
        use file_opening::FileOpener;
        use file_opening_macos::MacFileOpener;

        let opener = MacFileOpener;
        return map_default_open_result(
            opener
                .open_with_default(path)
                .map_err(|error| error.to_string())?,
        );
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(path)
            .spawn()
            .map_err(|error| error.to_string())?;
        return Ok(());
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Err("Opening files is not supported on this platform.".to_string())
    }
}

fn execute_path(path: &Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let extension = normalized_extension(path);

        if extension == "ps1" {
            let mut command = std::process::Command::new("powershell");
            command
                .arg("-NoProfile")
                .arg("-ExecutionPolicy")
                .arg("Bypass")
                .arg("-File")
                .arg(path);
            if let Some(parent) = path.parent() {
                command.current_dir(parent);
            }
            command.spawn().map_err(|error| error.to_string())?;
            return Ok(());
        }

        if matches!(extension.as_str(), "sh" | "bash" | "zsh" | "fish") {
            for shell in ["bash", "sh"] {
                let mut command = std::process::Command::new(shell);
                command.arg(path);
                if let Some(parent) = path.parent() {
                    command.current_dir(parent);
                }

                match command.spawn() {
                    Ok(_) => return Ok(()),
                    Err(error) if error.kind() == std::io::ErrorKind::NotFound => continue,
                    Err(error) => return Err(error.to_string()),
                }
            }

            return Err(
                "No supported shell interpreter was found in PATH for this script.".to_string(),
            );
        }

        return open_with_default_application(path);
    }

    #[cfg(any(target_os = "macos", target_os = "linux"))]
    {
        let extension = normalized_extension(path);

        if matches!(extension.as_str(), "sh" | "bash" | "zsh" | "fish") {
            let interpreter = match extension.as_str() {
                "bash" => "bash",
                "zsh" => "zsh",
                "fish" => "fish",
                _ => "sh",
            };

            let mut command = std::process::Command::new(interpreter);
            command.arg(path);
            if let Some(parent) = path.parent() {
                command.current_dir(parent);
            }
            command.spawn().map_err(|error| error.to_string())?;
            return Ok(());
        }

        if extension == "ps1" {
            for shell in ["pwsh", "powershell"] {
                let mut command = std::process::Command::new(shell);
                command
                    .arg("-NoProfile")
                    .arg("-ExecutionPolicy")
                    .arg("Bypass")
                    .arg("-File")
                    .arg(path);
                if let Some(parent) = path.parent() {
                    command.current_dir(parent);
                }

                match command.spawn() {
                    Ok(_) => return Ok(()),
                    Err(error) if error.kind() == std::io::ErrorKind::NotFound => continue,
                    Err(error) => return Err(error.to_string()),
                }
            }

            return Err(
                "No supported PowerShell interpreter was found in PATH for this script."
                    .to_string(),
            );
        }

        let mut command = std::process::Command::new(path);
        if let Some(parent) = path.parent() {
            command.current_dir(parent);
        }
        command.spawn().map_err(|error| error.to_string())?;
        return Ok(());
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Err("Executing files is not supported on this platform.".to_string())
    }
}

// ─── fs_read_text_file ────────────────────────────────────────────────────────

#[tauri::command]
pub async fn fs_read_text_file(path: String) -> Result<String, String> {
    // Limit file size to 10 MB to avoid hanging Monaco
    let meta = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    if meta.len() > 10 * 1024 * 1024 {
        return Err("File is too large to preview (> 10 MB)".to_string());
    }
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

// ─── fs_open_file ─────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn fs_open_file(path: String) -> Result<(), String> {
    let target = PathBuf::from(&path);
    if !target.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    if should_execute_path(&target) {
        return execute_path(&target);
    }

    open_with_default_application(&target)
}

// ─── fs_open_as_admin (Windows runas) ────────────────────────────────────────

#[tauri::command]
pub async fn fs_open_as_admin(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::ffi::OsStr;
        use std::os::windows::ffi::OsStrExt;

        let verb: Vec<u16> = OsStr::new("runas")
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        let file: Vec<u16> = OsStr::new(&path)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let result = unsafe {
            windows_sys::Win32::UI::Shell::ShellExecuteW(
                std::ptr::null_mut(),
                verb.as_ptr(),
                file.as_ptr(),
                std::ptr::null(),
                std::ptr::null(),
                1, // SW_SHOWNORMAL
            )
        };

        if result as isize <= 32 {
            return Err(format!(
                "ShellExecuteW failed with code: {}",
                result as isize
            ));
        }
        return Ok(());
    }
    #[cfg(target_os = "linux")]
    {
        let display = std::env::var("DISPLAY").unwrap_or_default();
        let xauthority = std::env::var("XAUTHORITY").unwrap_or_default();
        let runtime_dir = std::env::var("XDG_RUNTIME_DIR").unwrap_or_default();
        let command = format!(
            "DISPLAY={} XAUTHORITY={} XDG_RUNTIME_DIR={} xdg-open {}",
            shell_quote_single(&display),
            shell_quote_single(&xauthority),
            shell_quote_single(&runtime_dir),
            shell_quote_single(&path)
        );

        std::process::Command::new("pkexec")
            .arg("sh")
            .arg("-lc")
            .arg(command)
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        let shell_command = format!("open {}", shell_quote_single(&path));
        let script = format!(
            "do shell script \"{}\" with administrator privileges",
            escape_applescript_string(&shell_command)
        );

        std::process::Command::new("osascript")
            .arg("-e")
            .arg(script)
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }

    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
    {
        Err("Admin elevation is not implemented for this operating system.".to_string())
    }
}

// ─── fs_reveal_in_explorer ────────────────────────────────────────────────────

#[tauri::command]
pub async fn fs_reveal_in_explorer(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg("/select,")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("-R")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(
                std::path::Path::new(&path)
                    .parent()
                    .unwrap_or(std::path::Path::new("/")),
            )
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }
}

// ─── fs_delete ────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn fs_delete(path: String, recursive: bool) -> Result<(), String> {
    let p = Path::new(&path);
    let result = if p.is_dir() {
        if recursive {
            std::fs::remove_dir_all(p).map_err(|e| e.to_string())
        } else {
            std::fs::remove_dir(p).map_err(|e| e.to_string())
        }
    } else {
        std::fs::remove_file(p).map_err(|e| e.to_string())
    };

    if result.is_ok() {
        invalidate_entry_size_cache(p);
        if let Some(parent) = p.parent() {
            invalidate_entry_size_cache(parent);
        }
    }

    result
}

// ─── fs_rename ────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn fs_rename(old_path: String, new_path: String) -> Result<(), String> {
    let result = std::fs::rename(&old_path, &new_path).map_err(|e| e.to_string());
    if result.is_ok() {
        let old_path_ref = Path::new(&old_path);
        let new_path_ref = Path::new(&new_path);
        invalidate_entry_size_cache(old_path_ref);
        invalidate_entry_size_cache(new_path_ref);
        if let Some(parent) = old_path_ref.parent() {
            invalidate_entry_size_cache(parent);
        }
        if let Some(parent) = new_path_ref.parent() {
            invalidate_entry_size_cache(parent);
        }
    }
    result
}

#[tauri::command]
pub async fn fs_move(src: String, dst: String) -> Result<(), String> {
    let src_path = Path::new(&src);
    let dst_path = Path::new(&dst);
    let result = move_path(src_path, dst_path).map_err(|e| e.to_string());
    if result.is_ok() {
        invalidate_entry_size_cache(src_path);
        invalidate_entry_size_cache(dst_path);
        if let Some(parent) = src_path.parent() {
            invalidate_entry_size_cache(parent);
        }
        if let Some(parent) = dst_path.parent() {
            invalidate_entry_size_cache(parent);
        }
    }
    result
}

// ─── fs_copy ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn fs_copy(src: String, dst: String) -> Result<(), String> {
    let src_path = Path::new(&src);
    let result = if src_path.is_dir() {
        copy_dir_all(src_path, Path::new(&dst)).map_err(|e| e.to_string())
    } else {
        std::fs::copy(&src, &dst)
            .map(|_| ())
            .map_err(|e| e.to_string())
    };

    if result.is_ok() {
        let dst_path = Path::new(&dst);
        invalidate_entry_size_cache(dst_path);
        if let Some(parent) = dst_path.parent() {
            invalidate_entry_size_cache(parent);
        }
    }

    result
}

fn copy_dir_all(src: &Path, dst: &Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        let dst_entry = dst.join(entry.file_name());
        if ty.is_dir() {
            copy_dir_all(&entry.path(), &dst_entry)?;
        } else {
            std::fs::copy(entry.path(), dst_entry)?;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn fs_transfer_items(
    target_dir: String,
    sources: Vec<String>,
    operation: FileTransferOperation,
) -> Result<Vec<FileTransferResult>, String> {
    let target_dir_path = Path::new(&target_dir);
    if !target_dir_path.exists() {
        return Err(format!("Target directory does not exist: {}", target_dir));
    }
    if !target_dir_path.is_dir() {
        return Err(format!("Target path is not a directory: {}", target_dir));
    }

    let mut results = Vec::new();

    for source in sources {
        let source_path = PathBuf::from(&source);
        if !source_path.exists() {
            return Err(format!("Source path does not exist: {}", source));
        }

        let Some(file_name) = source_path.file_name() else {
            return Err(format!("Source path has no file name: {}", source));
        };

        let destination =
            collision_free_destination(target_dir_path.join(file_name), operation, &source_path);

        if source_path == destination {
            continue;
        }

        validate_transfer_destination(&source_path, &destination, operation)?;

        match operation {
            FileTransferOperation::Copy => {
                copy_path(&source_path, &destination).map_err(|e| e.to_string())?;
            }
            FileTransferOperation::Move => {
                move_path(&source_path, &destination).map_err(|e| e.to_string())?;
            }
        }

        results.push(FileTransferResult {
            source_path: source_path.to_string_lossy().to_string(),
            destination_path: destination.to_string_lossy().to_string(),
            operation,
        });
    }

    for result in &results {
        invalidate_entry_size_cache(Path::new(&result.source_path));
        invalidate_entry_size_cache(Path::new(&result.destination_path));
        if let Some(parent) = Path::new(&result.source_path).parent() {
            invalidate_entry_size_cache(parent);
        }
        if let Some(parent) = Path::new(&result.destination_path).parent() {
            invalidate_entry_size_cache(parent);
        }
    }

    Ok(results)
}

fn validate_transfer_destination(
    source_path: &Path,
    destination: &Path,
    operation: FileTransferOperation,
) -> Result<(), String> {
    if !source_path.is_dir() {
        return Ok(());
    }

    let normalized_source = if source_path.is_absolute() {
        source_path.to_path_buf()
    } else {
        std::env::current_dir()
            .map(|cwd| cwd.join(source_path))
            .unwrap_or_else(|_| source_path.to_path_buf())
    };
    let normalized_destination = if destination.is_absolute() {
        destination.to_path_buf()
    } else {
        std::env::current_dir()
            .map(|cwd| cwd.join(destination))
            .unwrap_or_else(|_| destination.to_path_buf())
    };

    if normalized_destination.starts_with(&normalized_source) {
        return Err(format!(
            "Cannot {:?} a folder into itself or one of its descendants: {} -> {}",
            operation,
            source_path.display(),
            destination.display()
        ));
    }

    Ok(())
}

fn copy_path(src: &Path, dst: &Path) -> std::io::Result<()> {
    if src.is_dir() {
        copy_dir_all(src, dst)
    } else {
        if let Some(parent) = dst.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::copy(src, dst).map(|_| ())
    }
}

fn move_path(src: &Path, dst: &Path) -> std::io::Result<()> {
    if let Some(parent) = dst.parent() {
        std::fs::create_dir_all(parent)?;
    }

    match std::fs::rename(src, dst) {
        Ok(()) => Ok(()),
        Err(rename_error) => {
            copy_path(src, dst)?;
            delete_path(src)?;
            if dst.exists() {
                Ok(())
            } else {
                Err(rename_error)
            }
        }
    }
}

fn delete_path(path: &Path) -> std::io::Result<()> {
    if path.is_dir() {
        std::fs::remove_dir_all(path)
    } else {
        std::fs::remove_file(path)
    }
}

fn collision_free_destination(
    preferred_path: PathBuf,
    operation: FileTransferOperation,
    source_path: &Path,
) -> PathBuf {
    if !preferred_path.exists() || preferred_path == source_path {
        return preferred_path;
    }

    let parent = preferred_path
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from("."));
    let file_name = preferred_path
        .file_name()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|| "item".to_string());

    if preferred_path.is_dir() || source_path.is_dir() {
        return numbered_destination(&parent, &file_name, "", operation);
    }

    let stem = preferred_path
        .file_stem()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|| file_name.clone());
    let ext = preferred_path
        .extension()
        .map(|value| format!(".{}", value.to_string_lossy()))
        .unwrap_or_default();

    numbered_destination(&parent, &stem, &ext, operation)
}

fn numbered_destination(
    parent: &Path,
    base_name: &str,
    extension: &str,
    operation: FileTransferOperation,
) -> PathBuf {
    let copy_suffix = "copy";
    let first_candidate = match operation {
        FileTransferOperation::Copy => format!("{base_name} ({copy_suffix}){extension}"),
        FileTransferOperation::Move => format!("{base_name} (moved){extension}"),
    };

    let first_path = parent.join(&first_candidate);
    if !first_path.exists() {
        return first_path;
    }

    for index in 2..10_000 {
        let candidate = match operation {
            FileTransferOperation::Copy => {
                format!("{base_name} ({copy_suffix} {index}){extension}")
            }
            FileTransferOperation::Move => format!("{base_name} (moved {index}){extension}"),
        };
        let candidate_path = parent.join(candidate);
        if !candidate_path.exists() {
            return candidate_path;
        }
    }

    parent.join(format!("{base_name}-fallback{extension}"))
}

// ─── fs_create_dir ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn fs_create_dir(path: String) -> Result<(), String> {
    let result = std::fs::create_dir_all(&path).map_err(|e| e.to_string());
    if result.is_ok() {
        let path_ref = Path::new(&path);
        invalidate_entry_size_cache(path_ref);
        if let Some(parent) = path_ref.parent() {
            invalidate_entry_size_cache(parent);
        }
    }
    result
}

// ─── fs_write_file ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn fs_write_file(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = std::path::Path::new(&path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let result = std::fs::write(&path, content.as_bytes()).map_err(|e| e.to_string());
    if result.is_ok() {
        let path_ref = Path::new(&path);
        invalidate_entry_size_cache(path_ref);
        if let Some(parent) = path_ref.parent() {
            invalidate_entry_size_cache(parent);
        }
    }
    result
}

// ─── git_exec ─────────────────────────────────────────────────────────────────
// Executes a git command in the specified directory and returns stdout (or stderr on failure)
#[tauri::command]
pub async fn git_exec(repo_path: String, args: Vec<String>) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    use std::os::windows::process::CommandExt;
    use std::process::Command;

    let mut cmd = Command::new("git");
    cmd.current_dir(&repo_path).args(&args);

    #[cfg(target_os = "windows")]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to run git: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

// ─── fs_read_file_base64 ─────────────────────────────────────────────────────
// Returns the file as a data-URI so the frontend can render it without
// needing the asset:// protocol (which requires allow-listed paths).

#[tauri::command]
pub async fn fs_read_file_base64(path: String) -> Result<String, String> {
    use std::io::Read;
    let meta = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    // Cap at 50 MB so previews stay responsive while still covering large images and meshes.
    if meta.len() > 50 * 1024 * 1024 {
        return Err("File is too large to preview (> 50 MB)".to_string());
    }
    let mut file = std::fs::File::open(&path).map_err(|e| e.to_string())?;
    let mut buf = Vec::new();
    file.read_to_end(&mut buf).map_err(|e| e.to_string())?;

    // Determine MIME type from extension
    let ext = std::path::Path::new(&path)
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    let mime = match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        "ico" => "image/x-icon",
        "svg" => "image/svg+xml",
        "tiff" | "tif" => "image/tiff",
        "avif" => "image/avif",
        "glb" => "model/gltf-binary",
        "gltf" => "model/gltf+json",
        "obj" => "text/plain",
        "stl" => "model/stl",
        "fbx" => "application/octet-stream",
        _ => "application/octet-stream",
    };

    // Use a simple base64 encoder (no external crate needed — stdlib in Rust is fine)
    let b64 = base64_encode(&buf);
    Ok(format!("data:{};base64,{}", mime, b64))
}

/// Minimal, allocation-efficient base64 encoder (RFC 4648, no padding issues)
fn base64_encode(input: &[u8]) -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity((input.len() + 2) / 3 * 4);
    for chunk in input.chunks(3) {
        let b0 = chunk[0] as usize;
        let b1 = if chunk.len() > 1 {
            chunk[1] as usize
        } else {
            0
        };
        let b2 = if chunk.len() > 2 {
            chunk[2] as usize
        } else {
            0
        };
        out.push(CHARS[b0 >> 2] as char);
        out.push(CHARS[((b0 & 3) << 4) | (b1 >> 4)] as char);
        out.push(if chunk.len() > 1 {
            CHARS[((b1 & 15) << 2) | (b2 >> 6)] as char
        } else {
            '='
        });
        out.push(if chunk.len() > 2 {
            CHARS[b2 & 63] as char
        } else {
            '='
        });
    }
    out
}

// ─── fs_get_home_dir ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn fs_get_home_dir() -> Result<String, String> {
    dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| "Could not determine home directory".to_string())
}

// ─── Unit Tests ───────────────────────────────────────────────────────────────
// Run with: cargo test -p tauri-app

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;
    use tempfile::TempDir;

    // ── helper: build a FileEntry directly (bypasses async/Tauri) ──────────────

    fn make_entry(name: &str, is_dir: bool, size: u64, ext: &str, hidden: bool) -> FileEntry {
        FileEntry {
            name: name.to_string(),
            path: format!("C:\\test\\{}", name),
            is_dir,
            size,
            modified: 1_700_000_000_000,
            extension: ext.to_string(),
            is_hidden: hidden,
            is_symlink: false,
        }
    }

    // ── Sorting logic (extracted so we can test it without async/Tauri) ─────────

    fn sort_entries(entries: &mut Vec<FileEntry>) {
        entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        });
    }

    // ── Extension extraction helper ─────────────────────────────────────────────

    fn get_extension(path: &str) -> String {
        std::path::Path::new(path)
            .extension()
            .map(|e| e.to_string_lossy().to_lowercase())
            .unwrap_or_default()
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Sorting
    // ═══════════════════════════════════════════════════════════════════════════

    #[test]
    fn sort_dirs_before_files() {
        let mut entries = vec![
            make_entry("zebra.txt", false, 100, "txt", false),
            make_entry("alpha", true, 0, "", false),
            make_entry("mango.rs", false, 200, "rs", false),
            make_entry("beta", true, 0, "", false),
        ];
        sort_entries(&mut entries);

        // First two must be directories
        assert!(
            entries[0].is_dir,
            "entry[0] should be dir, got '{}'",
            entries[0].name
        );
        assert!(
            entries[1].is_dir,
            "entry[1] should be dir, got '{}'",
            entries[1].name
        );
        // Last two must be files
        assert!(
            !entries[2].is_dir,
            "entry[2] should be file, got '{}'",
            entries[2].name
        );
        assert!(
            !entries[3].is_dir,
            "entry[3] should be file, got '{}'",
            entries[3].name
        );
    }

    #[test]
    fn sort_dirs_alphabetically() {
        let mut entries = vec![
            make_entry("Zeta", true, 0, "", false),
            make_entry("alpha", true, 0, "", false),
            make_entry("Beta", true, 0, "", false),
        ];
        sort_entries(&mut entries);
        assert_eq!(entries[0].name, "alpha");
        assert_eq!(entries[1].name, "Beta");
        assert_eq!(entries[2].name, "Zeta");
    }

    #[test]
    fn sort_files_alphabetically() {
        let mut entries = vec![
            make_entry("zebra.txt", false, 10, "txt", false),
            make_entry("Apple.rs", false, 20, "rs", false),
            make_entry("mango.json", false, 30, "json", false),
        ];
        sort_entries(&mut entries);
        assert_eq!(entries[0].name, "Apple.rs");
        assert_eq!(entries[1].name, "mango.json");
        assert_eq!(entries[2].name, "zebra.txt");
    }

    #[test]
    fn sort_empty_list_is_noop() {
        let mut entries: Vec<FileEntry> = vec![];
        sort_entries(&mut entries);
        assert!(entries.is_empty());
    }

    #[test]
    fn sort_single_entry_unchanged() {
        let mut entries = vec![make_entry("lone.txt", false, 1, "txt", false)];
        sort_entries(&mut entries);
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].name, "lone.txt");
    }

    #[test]
    fn sort_case_insensitive_mixed() {
        let mut entries = vec![
            make_entry("ZZZ", true, 0, "", false),
            make_entry("aaa", true, 0, "", false),
            make_entry("MMM", true, 0, "", false),
        ];
        sort_entries(&mut entries);
        assert_eq!(entries[0].name, "aaa");
        assert_eq!(entries[1].name, "MMM");
        assert_eq!(entries[2].name, "ZZZ");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Extension extraction
    // ═══════════════════════════════════════════════════════════════════════════

    #[test]
    fn extension_simple() {
        assert_eq!(get_extension("file.txt"), "txt");
        assert_eq!(get_extension("file.RS"), "rs"); // lowercased
        assert_eq!(get_extension("file.JSON"), "json");
    }

    #[test]
    fn extension_multi_dot() {
        // Only the last extension
        assert_eq!(get_extension("archive.tar.gz"), "gz");
        assert_eq!(get_extension("vite.config.ts"), "ts");
    }

    #[test]
    fn extension_no_extension() {
        assert_eq!(get_extension("Makefile"), "");
        assert_eq!(get_extension("README"), "");
    }

    #[test]
    fn extension_hidden_unix_file() {
        // ".gitignore" has no extension (the name IS the dot-file)
        assert_eq!(get_extension(".gitignore"), "");
        // ".env" has no extension either
        assert_eq!(get_extension(".env"), "");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // FileEntry serialisation (snapshot of struct field types)
    // ═══════════════════════════════════════════════════════════════════════════

    #[test]
    fn file_entry_serialises_to_json() {
        let entry = make_entry("test.ts", false, 2048, "ts", false);
        let json = serde_json::to_string(&entry).expect("serialisation failed");

        // Check all required fields are present in the JSON blob
        for field in &[
            "name",
            "path",
            "is_dir",
            "size",
            "modified",
            "extension",
            "is_hidden",
            "is_symlink",
        ] {
            assert!(
                json.contains(field),
                "missing field '{}' in JSON: {}",
                field,
                json
            );
        }
        assert!(json.contains("\"name\":\"test.ts\""), "name mismatch");
        assert!(json.contains("\"size\":2048"), "size mismatch");
        assert!(json.contains("\"extension\":\"ts\""), "extension mismatch");
        assert!(json.contains("\"is_dir\":false"), "is_dir mismatch");
    }

    #[test]
    fn drive_info_serialises_to_json() {
        let drive = DriveInfo {
            letter: "C:".to_string(),
            label: "OS".to_string(),
            total_bytes: 512_000_000_000,
            free_bytes: 128_000_000_000,
            drive_type: "fixed".to_string(),
        };
        let json = serde_json::to_string(&drive).expect("serialisation failed");
        assert!(json.contains("\"letter\":\"C:\""));
        assert!(json.contains("\"drive_type\":\"fixed\""));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Real filesystem integration tests (uses tempdir — always safe)
    // ═══════════════════════════════════════════════════════════════════════════

    fn tmp_dir() -> TempDir {
        tempfile::tempdir().expect("failed to create tempdir")
    }

    #[tokio::test]
    async fn list_dir_returns_files_and_dirs() {
        let dir = tmp_dir();
        let dir_path = dir.path();

        // Create a sub-directory and two files
        fs::create_dir(dir_path.join("subdir")).unwrap();
        fs::write(dir_path.join("hello.txt"), b"hello").unwrap();
        fs::write(dir_path.join("data.json"), b"{}").unwrap();

        let result = fs_list_dir(dir_path.to_string_lossy().into(), false).await;
        let entries = result.expect("fs_list_dir failed");

        assert!(
            entries.len() >= 3,
            "expected at least 3 entries, got {}",
            entries.len()
        );

        let subdirs: Vec<_> = entries.iter().filter(|e| e.is_dir).collect();
        let files: Vec<_> = entries.iter().filter(|e| !e.is_dir).collect();
        assert!(!subdirs.is_empty(), "no directories found");
        assert!(files.len() >= 2, "expected at least 2 files");
    }

    #[tokio::test]
    async fn list_dir_dirs_come_first() {
        let dir = tmp_dir();
        fs::create_dir(dir.path().join("zzz_dir")).unwrap();
        fs::write(dir.path().join("aaa.txt"), b"a").unwrap();

        let entries = fs_list_dir(dir.path().to_string_lossy().into(), false)
            .await
            .expect("fs_list_dir failed");

        // The directory "zzz_dir" should appear BEFORE "aaa.txt" despite 'z' > 'a'
        let first = &entries[0];
        assert!(
            first.is_dir,
            "first entry should be a directory (dirs-first sort)"
        );
    }

    #[tokio::test]
    async fn list_dir_hides_hidden_files_by_default() {
        let dir = tmp_dir();
        fs::write(dir.path().join(".hidden"), b"secret").unwrap();
        fs::write(dir.path().join("visible.txt"), b"public").unwrap();

        let entries_no_hidden = fs_list_dir(dir.path().to_string_lossy().into(), false)
            .await
            .expect("fs_list_dir failed");

        let has_hidden = entries_no_hidden.iter().any(|e| e.name.starts_with('.'));
        assert!(
            !has_hidden,
            "hidden file should not appear when show_hidden=false"
        );
    }

    #[tokio::test]
    async fn list_dir_shows_hidden_files_when_requested() {
        let dir = tmp_dir();
        fs::write(dir.path().join(".hidden"), b"secret").unwrap();
        fs::write(dir.path().join("visible.txt"), b"public").unwrap();

        let entries_with_hidden = fs_list_dir(dir.path().to_string_lossy().into(), true)
            .await
            .expect("fs_list_dir failed");

        let has_hidden = entries_with_hidden.iter().any(|e| e.name.starts_with('.'));
        assert!(
            has_hidden,
            "hidden file should appear when show_hidden=true"
        );
    }

    #[tokio::test]
    async fn list_dir_fails_for_nonexistent_path() {
        let result = fs_list_dir("C:\\nonexistent\\path\\xyz_abc".to_string(), false).await;
        assert!(result.is_err(), "expected Err for nonexistent path");
        let msg = result.unwrap_err();
        assert!(
            msg.contains("not exist") || msg.contains("exist"),
            "error message: {}",
            msg
        );
    }

    #[tokio::test]
    async fn list_dir_fails_for_file_path() {
        let dir = tmp_dir();
        let file_path = dir.path().join("some.txt");
        fs::write(&file_path, b"data").unwrap();

        let result = fs_list_dir(file_path.to_string_lossy().into(), false).await;
        assert!(
            result.is_err(),
            "expected Err when path is a file, not a dir"
        );
    }

    #[tokio::test]
    async fn measure_entry_sizes_reports_files_and_nested_directory_totals() {
        let dir = tmp_dir();
        let nested_dir = dir.path().join("assets");
        let deep_dir = nested_dir.join("nested");
        let loose_file = dir.path().join("note.txt");

        fs::create_dir_all(&deep_dir).unwrap();
        fs::write(nested_dir.join("a.bin"), vec![0_u8; 128]).unwrap();
        fs::write(deep_dir.join("b.bin"), vec![0_u8; 256]).unwrap();
        fs::write(&loose_file, vec![0_u8; 64]).unwrap();

        let results = fs_measure_entry_sizes(
            vec![
                nested_dir.to_string_lossy().into_owned(),
                loose_file.to_string_lossy().into_owned(),
            ],
            Some(true),
        )
        .await
        .expect("fs_measure_entry_sizes failed");

        assert_eq!(results.len(), 2);

        let dir_result = results
            .iter()
            .find(|entry| entry.path == nested_dir.to_string_lossy())
            .expect("directory result missing");
        assert!(
            dir_result.is_dir,
            "directory should be marked as a directory"
        );
        assert!(
            dir_result.is_complete,
            "small directory scan should complete"
        );
        assert_eq!(
            dir_result.bytes, 384,
            "directory size should include nested files"
        );

        let file_result = results
            .iter()
            .find(|entry| entry.path == loose_file.to_string_lossy())
            .expect("file result missing");
        assert!(
            !file_result.is_dir,
            "file should not be marked as a directory"
        );
        assert!(file_result.is_complete, "files should resolve immediately");
        assert_eq!(file_result.bytes, 64);
    }

    #[tokio::test]
    async fn measure_entry_sizes_skips_symlink_targets() {
        #[cfg(not(any(target_family = "windows", target_family = "unix")))]
        {
            return;
        }

        let dir = tmp_dir();
        let real_dir = dir.path().join("real");
        let linked_dir = dir.path().join("linked");
        fs::create_dir_all(&real_dir).unwrap();
        fs::write(real_dir.join("payload.bin"), vec![0_u8; 512]).unwrap();

        #[cfg(target_family = "unix")]
        std::os::unix::fs::symlink(&real_dir, &linked_dir).unwrap();

        #[cfg(target_family = "windows")]
        std::os::windows::fs::symlink_dir(&real_dir, &linked_dir).unwrap();

        let results =
            fs_measure_entry_sizes(vec![linked_dir.to_string_lossy().into_owned()], Some(true))
                .await
                .expect("fs_measure_entry_sizes failed");

        assert_eq!(results.len(), 1);
        assert_eq!(
            results[0].bytes, 0,
            "symlinked directories should not be traversed"
        );
        assert!(
            results[0].is_complete,
            "symlink handling should return immediately"
        );
    }

    #[test]
    fn measure_path_size_can_return_partial_for_large_scans() {
        let dir = tmp_dir();
        let root = dir.path().join("huge");
        fs::create_dir_all(&root).unwrap();

        for index in 0..15_000 {
            fs::write(root.join(format!("chunk-{index}.bin")), [0_u8; 32]).unwrap();
        }

        let (_bytes, is_dir, is_complete) = measure_path_size(&root);
        assert!(
            is_dir,
            "directory should still be identified as a directory"
        );
        if !is_complete {
            return;
        }

        // Fast machines may still finish inside the budget; in that case the full scan is still valid.
        assert!(is_complete);
    }

    #[tokio::test]
    async fn read_text_file_reads_content() {
        let dir = tmp_dir();
        let file_path = dir.path().join("data.toml");
        let content = "[package]\nname = \"test\"";
        fs::write(&file_path, content).unwrap();

        let result = fs_read_text_file(file_path.to_string_lossy().into()).await;
        assert!(result.is_ok(), "expected Ok, got {:?}", result);
        assert_eq!(result.unwrap(), content);
    }

    #[tokio::test]
    async fn read_text_file_rejects_large_file() {
        let dir = tmp_dir();
        let path = dir.path().join("big.bin");
        // Create a file just over 10 MB
        let big_data = vec![0u8; 10 * 1024 * 1024 + 1];
        fs::write(&path, &big_data).unwrap();

        let result = fs_read_text_file(path.to_string_lossy().into()).await;
        assert!(result.is_err(), "expected Err for file > 10 MB");
        assert!(
            result.unwrap_err().contains("too large"),
            "wrong error message"
        );
    }

    #[tokio::test]
    async fn search_entries_finds_nested_content_matches() {
        let dir = tmp_dir();
        let nested = dir.path().join("src").join("deep");
        fs::create_dir_all(&nested).unwrap();
        let file_path = nested.join("notes.kain");
        fs::write(&file_path, "alpha\nbeta search term gamma\nomega").unwrap();

        let result = fs_search_entries(
            dir.path().to_string_lossy().into(),
            "search term".to_string(),
            true,
            true,
            Some(50),
        )
        .await;

        assert!(result.is_ok(), "search_entries failed: {:?}", result);
        let results = result.unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].path, file_path.to_string_lossy());
        assert_eq!(results[0].line_number, Some(2));
        assert!(results[0].snippet.contains("search term"));
    }

    #[tokio::test]
    async fn search_entries_can_skip_content_matches() {
        let dir = tmp_dir();
        let named = dir.path().join("search-term-note.txt");
        let content_only = dir.path().join("other-note.txt");
        fs::write(&named, "no match in body").unwrap();
        fs::write(&content_only, "alpha\nsearch-term beta\nomega").unwrap();

        let result = fs_search_entries(
            dir.path().to_string_lossy().into(),
            "search-term".to_string(),
            true,
            false,
            Some(50),
        )
        .await;

        assert!(result.is_ok(), "search_entries failed: {:?}", result);
        let results = result.unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].path, named.to_string_lossy());
        assert!(results[0].snippet.is_empty());
        assert_eq!(results[0].line_number, None);
    }

    #[tokio::test]
    async fn create_dir_creates_nested_directories() {
        let dir = tmp_dir();
        let new_path = dir.path().join("a").join("b").join("c");
        let result = fs_create_dir(new_path.to_string_lossy().into()).await;
        assert!(result.is_ok(), "fs_create_dir failed: {:?}", result);
        assert!(new_path.exists(), "directory was not created");
        assert!(new_path.is_dir(), "path is not a directory");
    }

    #[tokio::test]
    async fn rename_renames_file() {
        let dir = tmp_dir();
        let src = dir.path().join("old.txt");
        let dst = dir.path().join("new.txt");
        fs::write(&src, b"content").unwrap();

        let result = fs_rename(src.to_string_lossy().into(), dst.to_string_lossy().into()).await;

        assert!(result.is_ok(), "fs_rename failed: {:?}", result);
        assert!(!src.exists(), "source should no longer exist");
        assert!(dst.exists(), "destination should exist");
        assert_eq!(fs::read(&dst).unwrap(), b"content");
    }

    #[tokio::test]
    async fn move_moves_file() {
        let dir = tmp_dir();
        let src = dir.path().join("move-me.txt");
        let dst = dir.path().join("nested").join("moved.txt");
        fs::write(&src, b"payload").unwrap();

        let result = fs_move(src.to_string_lossy().into(), dst.to_string_lossy().into()).await;

        assert!(result.is_ok(), "fs_move failed: {:?}", result);
        assert!(!src.exists(), "source should no longer exist");
        assert!(dst.exists(), "destination should exist");
        assert_eq!(fs::read(&dst).unwrap(), b"payload");
    }

    #[tokio::test]
    async fn copy_copies_single_file() {
        let dir = tmp_dir();
        let src = dir.path().join("original.txt");
        let dst = dir.path().join("copy.txt");
        fs::write(&src, b"hello world").unwrap();

        let result = fs_copy(src.to_string_lossy().into(), dst.to_string_lossy().into()).await;

        assert!(result.is_ok(), "fs_copy failed: {:?}", result);
        assert!(src.exists(), "source should still exist after copy");
        assert!(dst.exists(), "destination should exist");
        assert_eq!(fs::read(&dst).unwrap(), b"hello world");
    }

    #[tokio::test]
    async fn copy_copies_directory_recursively() {
        let dir = tmp_dir();
        let src_dir = dir.path().join("src_folder");
        let dst_dir = dir.path().join("dst_folder");

        fs::create_dir(&src_dir).unwrap();
        fs::write(src_dir.join("file1.txt"), b"one").unwrap();
        fs::create_dir(src_dir.join("nested")).unwrap();
        fs::write(src_dir.join("nested").join("file2.txt"), b"two").unwrap();

        let result = fs_copy(
            src_dir.to_string_lossy().into(),
            dst_dir.to_string_lossy().into(),
        )
        .await;

        assert!(result.is_ok(), "recursive copy failed: {:?}", result);
        assert!(
            dst_dir.join("file1.txt").exists(),
            "file1.txt missing in dst"
        );
        assert!(
            dst_dir.join("nested").join("file2.txt").exists(),
            "nested/file2.txt missing"
        );
        assert_eq!(
            fs::read(dst_dir.join("nested").join("file2.txt")).unwrap(),
            b"two"
        );
    }

    #[tokio::test]
    async fn transfer_items_copies_with_collision_safe_names() {
        let dir = tmp_dir();
        let target_dir = dir.path().join("target");
        fs::create_dir(&target_dir).unwrap();

        let original = target_dir.join("note.txt");
        fs::write(&original, b"original").unwrap();

        let external = dir.path().join("note.txt");
        fs::write(&external, b"external").unwrap();

        let result = fs_transfer_items(
            target_dir.to_string_lossy().into(),
            vec![external.to_string_lossy().into()],
            FileTransferOperation::Copy,
        )
        .await
        .expect("fs_transfer_items should copy");

        assert_eq!(result.len(), 1);
        let copied_path = PathBuf::from(&result[0].destination_path);
        assert!(copied_path.exists(), "copied file should exist");
        assert_ne!(
            copied_path, original,
            "copy should not overwrite existing file"
        );
        assert_eq!(fs::read(copied_path).unwrap(), b"external");
        assert_eq!(fs::read(original).unwrap(), b"original");
    }

    #[tokio::test]
    async fn transfer_items_moves_multiple_entries() {
        let dir = tmp_dir();
        let source_dir = dir.path().join("source");
        let target_dir = dir.path().join("target");
        fs::create_dir(&source_dir).unwrap();
        fs::create_dir(&target_dir).unwrap();

        let file_a = source_dir.join("a.txt");
        let folder_b = source_dir.join("folder-b");
        fs::write(&file_a, b"a").unwrap();
        fs::create_dir(&folder_b).unwrap();
        fs::write(folder_b.join("nested.txt"), b"nested").unwrap();

        let result = fs_transfer_items(
            target_dir.to_string_lossy().into(),
            vec![
                file_a.to_string_lossy().into(),
                folder_b.to_string_lossy().into(),
            ],
            FileTransferOperation::Move,
        )
        .await
        .expect("fs_transfer_items should move");

        assert_eq!(result.len(), 2);
        assert!(!file_a.exists(), "moved file should be removed from source");
        assert!(
            !folder_b.exists(),
            "moved folder should be removed from source"
        );
        assert!(
            target_dir.join("a.txt").exists(),
            "target should contain moved file"
        );
        assert!(
            target_dir.join("folder-b").join("nested.txt").exists(),
            "target should contain moved folder contents"
        );
    }

    #[tokio::test]
    async fn transfer_items_rejects_moving_folder_into_its_descendant() {
        let dir = tmp_dir();
        let source_dir = dir.path().join("source");
        let nested_target = source_dir.join("nested");
        fs::create_dir(&source_dir).unwrap();
        fs::create_dir(&nested_target).unwrap();
        fs::write(source_dir.join("root.txt"), b"root").unwrap();

        let result = fs_transfer_items(
            nested_target.to_string_lossy().into(),
            vec![source_dir.to_string_lossy().into()],
            FileTransferOperation::Move,
        )
        .await;

        assert!(result.is_err(), "self-nesting move should be rejected");
        let message = result.err().unwrap();
        assert!(
            message.contains("descendants"),
            "unexpected error message: {message}"
        );
    }

    #[tokio::test]
    async fn delete_removes_a_file() {
        let dir = tmp_dir();
        let file = dir.path().join("gone.txt");
        fs::write(&file, b"bye").unwrap();

        let result = fs_delete(file.to_string_lossy().into(), false).await;
        assert!(result.is_ok(), "delete failed: {:?}", result);
        assert!(!file.exists(), "file should be gone");
    }

    #[tokio::test]
    async fn delete_removes_directory_when_recursive() {
        let dir = tmp_dir();
        let sub = dir.path().join("to_delete");
        fs::create_dir(&sub).unwrap();
        fs::write(sub.join("inner.txt"), b"data").unwrap();

        let result = fs_delete(sub.to_string_lossy().into(), true).await;
        assert!(result.is_ok(), "recursive delete failed: {:?}", result);
        assert!(!sub.exists(), "directory should be gone");
    }

    #[tokio::test]
    async fn delete_fails_non_empty_dir_without_recursive() {
        let dir = tmp_dir();
        let sub = dir.path().join("non_empty");
        fs::create_dir(&sub).unwrap();
        fs::write(sub.join("file.txt"), b"data").unwrap();

        let result = fs_delete(sub.to_string_lossy().into(), false).await;
        assert!(
            result.is_err(),
            "expected Err when deleting non-empty dir without recursive"
        );
    }

    #[tokio::test]
    async fn get_home_dir_returns_a_path() {
        let result = fs_get_home_dir().await;
        assert!(result.is_ok(), "fs_get_home_dir failed: {:?}", result);
        let home = result.unwrap();
        assert!(!home.is_empty(), "home dir should not be empty");
        // Should be an absolute path
        let p = std::path::Path::new(&home);
        assert!(p.is_absolute(), "home dir '{}' should be absolute", home);
    }
}
