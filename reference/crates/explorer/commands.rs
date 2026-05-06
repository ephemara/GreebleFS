// Copyright 2026 K-Studio. All Rights Reserved.

use crate::crates::explorer::search::{fuzzy_search_files, search_file_contents, FuzzySearchOptions, SearchResult};
use chrono::{DateTime, Utc};
use humansize::{format_size, BINARY};
use mime_guess::from_path;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use walkdir::WalkDir;

#[derive(Debug, Serialize, Deserialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub size_formatted: String,
    pub modified: Option<String>,
    pub extension: Option<String>,
    pub mime_type: Option<String>,
}

#[tauri::command]
pub fn read_directory(path: String) -> Result<Vec<FileEntry>, String> {
    let dir_path = PathBuf::from(&path);
    
    if !dir_path.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    let entries: Result<Vec<_>, _> = fs::read_dir(&dir_path)
        .map_err(|e| format!("Failed to read directory: {}", e))?
        .collect();

    let mut file_entries: Vec<FileEntry> = entries
        .map_err(|e| format!("Failed to read directory entries: {}", e))?
        .par_iter()
        .filter_map(|entry| {
            let metadata = entry.metadata().ok()?;
            let file_name = entry.file_name().to_string_lossy().to_string();
            let file_path = entry.path().to_string_lossy().to_string();
            
            let modified = metadata.modified()
                .ok()
                .and_then(|time| {
                    let datetime: DateTime<Utc> = time.into();
                    Some(datetime.to_rfc3339())
                });

            let extension = entry.path()
                .extension()
                .and_then(|ext| ext.to_str())
                .map(|s| s.to_string());

            let mime_type = from_path(&entry.path())
                .first()
                .map(|m| m.to_string());

            let size = metadata.len();
            let size_formatted = format_size(size, BINARY);

            Some(FileEntry {
                name: file_name,
                path: file_path,
                is_dir: metadata.is_dir(),
                size,
                size_formatted,
                modified,
                extension,
                mime_type,
            })
        })
        .collect();

    file_entries.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(file_entries)
}

#[tauri::command]
pub fn read_file_content(path: String) -> Result<String, String> {
    fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
pub fn write_file_content(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content)
        .map_err(|e| format!("Failed to write file: {}", e))
}

#[tauri::command]
pub fn fuzzy_search(
    root_path: String,
    query: String,
    max_results: Option<usize>,
    case_sensitive: Option<bool>,
) -> Result<Vec<SearchResult>, String> {
    let options = FuzzySearchOptions {
        max_results: max_results.unwrap_or(100),
        case_sensitive: case_sensitive.unwrap_or(false),
        max_depth: Some(10),
    };

    fuzzy_search_files(&root_path, &query, options)
        .map_err(|e| format!("Search failed: {}", e))
}

#[tauri::command]
pub fn content_search(
    root_path: String,
    pattern: String,
    max_results: Option<usize>,
) -> Result<Vec<SearchResult>, String> {
    search_file_contents(&root_path, &pattern, max_results.unwrap_or(100))
        .map_err(|e| format!("Content search failed: {}", e))
}

#[tauri::command]
pub fn get_file_stats(path: String) -> Result<FileEntry, String> {
    let file_path = PathBuf::from(&path);
    
    if !file_path.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    let metadata = fs::metadata(&file_path)
        .map_err(|e| format!("Failed to get file stats: {}", e))?;

    let modified = metadata.modified()
        .ok()
        .and_then(|time| {
            let datetime: DateTime<Utc> = time.into();
            Some(datetime.to_rfc3339())
        });

    let extension = file_path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|s| s.to_string());

    let mime_type = from_path(&file_path)
        .first()
        .map(|m| m.to_string());

    let name = file_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_string();

    let size = metadata.len();
    let size_formatted = format_size(size, BINARY);

    Ok(FileEntry {
        name,
        path: path.clone(),
        is_dir: metadata.is_dir(),
        size,
        size_formatted,
        modified,
        extension,
        mime_type,
    })
}

#[tauri::command]
pub fn create_directory(path: String) -> Result<(), String> {
    fs::create_dir_all(&path)
        .map_err(|e| format!("Failed to create directory: {}", e))
}

#[tauri::command]
pub fn delete_path(path: String, use_trash: Option<bool>) -> Result<(), String> {
    let file_path = PathBuf::from(&path);
    
    if use_trash.unwrap_or(true) {
        trash::delete(&file_path)
            .map_err(|e| format!("Failed to move to trash: {}", e))
    } else {
        if file_path.is_dir() {
            fs::remove_dir_all(&path)
                .map_err(|e| format!("Failed to delete directory: {}", e))
        } else {
            fs::remove_file(&path)
                .map_err(|e| format!("Failed to delete file: {}", e))
        }
    }
}

#[tauri::command]
pub fn rename_path(old_path: String, new_path: String) -> Result<(), String> {
    fs::rename(&old_path, &new_path)
        .map_err(|e| format!("Failed to rename: {}", e))
}

#[tauri::command]
pub fn copy_path(source: String, destination: String) -> Result<(), String> {
    let src = PathBuf::from(&source);
    let dst = PathBuf::from(&destination);

    if src.is_dir() {
        copy_dir_recursive(&src, &dst)
            .map_err(|e| format!("Failed to copy directory: {}", e))
    } else {
        fs::copy(&src, &dst)
            .map(|_| ())
            .map_err(|e| format!("Failed to copy file: {}", e))
    }
}

fn copy_dir_recursive(src: &PathBuf, dst: &PathBuf) -> std::io::Result<()> {
    fs::create_dir_all(dst)?;
    
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        if file_type.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path)?;
        }
    }
    
    Ok(())
}

#[tauri::command]
pub fn get_drives() -> Result<Vec<String>, String> {
    let mut drives = Vec::new();
    
    for letter in b'A'..=b'Z' {
        let drive = format!("{}:\\", letter as char);
        let path = PathBuf::from(&drive);
        if path.exists() {
            drives.push(drive);
        }
    }
    
    Ok(drives)
}

#[tauri::command]
pub fn get_directory_size(path: String) -> Result<u64, String> {
    let dir_path = PathBuf::from(&path);
    
    if !dir_path.exists() || !dir_path.is_dir() {
        return Err(format!("Invalid directory: {}", path));
    }

    let total_size: u64 = WalkDir::new(&dir_path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter_map(|e| e.metadata().ok())
        .filter(|m| m.is_file())
        .map(|m| m.len())
        .sum();

    Ok(total_size)
}
