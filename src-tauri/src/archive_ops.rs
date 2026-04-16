use bzip2::read::BzDecoder;
use flate2::read::GzDecoder;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::{self, BufReader, Read};
use std::path::{Component, Path, PathBuf};
use tar::Archive;
use xz2::read::XzDecoder;
use zip::read::ZipArchive;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum FsArchiveExtractionMode {
    OpenCached,
    ExtractHere,
    ExtractToNewFolder,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct FsArchiveExtractionRequest {
    pub archive_path: String,
    pub mode: FsArchiveExtractionMode,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct FsArchiveExtractionResult {
    pub output_path: String,
    pub extracted_entry_count: u64,
    pub reused_cached_output: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ArchiveFormat {
    Zip,
    SevenZip,
    Tar,
    TarGz,
    TarBz2,
    TarXz,
    Gzip,
    Bzip2,
    Xz,
}

const ARCHIVE_SUFFIXES: &[(ArchiveFormat, &[&str])] = &[
    (ArchiveFormat::TarGz, &[".tar.gz", ".tgz"]),
    (ArchiveFormat::TarBz2, &[".tar.bz2", ".tbz2"]),
    (ArchiveFormat::TarXz, &[".tar.xz", ".txz"]),
    (ArchiveFormat::SevenZip, &[".7z"]),
    (ArchiveFormat::Zip, &[".zip", ".cbz", ".jar", ".apk"]),
    (ArchiveFormat::Tar, &[".tar"]),
    (ArchiveFormat::Gzip, &[".gz"]),
    (ArchiveFormat::Bzip2, &[".bz2"]),
    (ArchiveFormat::Xz, &[".xz"]),
];

pub fn is_supported_archive_path(path: &Path) -> bool {
    detect_archive_format(path).is_some()
}

pub fn open_archive_cached(path: &Path) -> Result<FsArchiveExtractionResult, String> {
    validate_archive_path(path)?;
    let format = detect_archive_format(path).ok_or_else(|| unsupported_archive_error(path))?;

    let cache_root = archive_cache_root()?;
    let cache_base = cache_root.join(cache_key_for_archive(path)?);
    let cached_output_dir = cache_base.join("contents");
    if cached_output_dir.exists() {
        return Ok(FsArchiveExtractionResult {
            output_path: cached_output_dir.to_string_lossy().into_owned(),
            extracted_entry_count: 0,
            reused_cached_output: true,
        });
    }

    let staging_base = cache_root.join(format!(
        "{}-tmp-{}",
        cache_base_name(&cache_base),
        uuid::Uuid::new_v4()
    ));
    let staging_output_dir = staging_base.join("contents");
    let extraction_result = extract_archive_to_directory(path, format, &staging_output_dir);

    match extraction_result {
        Ok(extracted_entry_count) => {
            fs::rename(&staging_base, &cache_base).map_err(|error| {
                format!(
                    "Failed to finalize extracted archive cache {}: {error}",
                    cache_base.display()
                )
            })?;
            Ok(FsArchiveExtractionResult {
                output_path: cached_output_dir.to_string_lossy().into_owned(),
                extracted_entry_count,
                reused_cached_output: false,
            })
        }
        Err(error) => {
            let _ = fs::remove_dir_all(&staging_base);
            Err(error)
        }
    }
}

pub fn extract_archive(
    request: &FsArchiveExtractionRequest,
) -> Result<FsArchiveExtractionResult, String> {
    let archive_path = PathBuf::from(&request.archive_path);
    validate_archive_path(&archive_path)?;
    let format = detect_archive_format(&archive_path)
        .ok_or_else(|| unsupported_archive_error(&archive_path))?;

    match request.mode {
        FsArchiveExtractionMode::OpenCached => open_archive_cached(&archive_path),
        FsArchiveExtractionMode::ExtractToNewFolder => {
            let parent_dir = archive_path.parent().ok_or_else(|| {
                format!(
                    "Archive path does not have a parent directory: {}",
                    archive_path.display()
                )
            })?;
            let folder_name = archive_default_folder_name(&archive_path, format);
            let target_dir = collision_free_destination(parent_dir.join(folder_name));
            let extracted_entry_count =
                extract_archive_to_directory(&archive_path, format, &target_dir)?;
            Ok(FsArchiveExtractionResult {
                output_path: target_dir.to_string_lossy().into_owned(),
                extracted_entry_count,
                reused_cached_output: false,
            })
        }
        FsArchiveExtractionMode::ExtractHere => {
            let target_dir = archive_path.parent().ok_or_else(|| {
                format!(
                    "Archive path does not have a parent directory: {}",
                    archive_path.display()
                )
            })?;
            let staging_root =
                archive_temp_root()?.join(format!("extract-here-{}", uuid::Uuid::new_v4()));
            let extraction_result =
                extract_archive_to_directory(&archive_path, format, &staging_root);
            match extraction_result {
                Ok(extracted_entry_count) => {
                    merge_extracted_tree_into_directory(&staging_root, target_dir)?;
                    let _ = fs::remove_dir_all(&staging_root);
                    Ok(FsArchiveExtractionResult {
                        output_path: target_dir.to_string_lossy().into_owned(),
                        extracted_entry_count,
                        reused_cached_output: false,
                    })
                }
                Err(error) => {
                    let _ = fs::remove_dir_all(&staging_root);
                    Err(error)
                }
            }
        }
    }
}

fn extract_archive_to_directory(
    archive_path: &Path,
    format: ArchiveFormat,
    destination_root: &Path,
) -> Result<u64, String> {
    if destination_root.exists() {
        if !destination_root.is_dir() {
            return Err(format!(
                "Archive extraction target is not a directory: {}",
                destination_root.display()
            ));
        }
        if fs::read_dir(destination_root)
            .map_err(|error| {
                format!(
                    "Failed to inspect archive extraction target {}: {error}",
                    destination_root.display()
                )
            })?
            .next()
            .is_some()
        {
            return Err(format!(
                "Archive extraction target must be empty: {}",
                destination_root.display()
            ));
        }
    } else {
        fs::create_dir_all(destination_root).map_err(|error| {
            format!(
                "Failed to create archive extraction target {}: {error}",
                destination_root.display()
            )
        })?;
    }

    match format {
        ArchiveFormat::Zip => extract_zip_archive(archive_path, destination_root),
        ArchiveFormat::SevenZip => extract_seven_zip_archive(archive_path, destination_root),
        ArchiveFormat::Tar => extract_tar_archive(
            File::open(archive_path)
                .map(BufReader::new)
                .map_err(|error| {
                    format!("Failed to open archive {}: {error}", archive_path.display())
                })?,
            destination_root,
        ),
        ArchiveFormat::TarGz => extract_tar_archive(
            GzDecoder::new(
                File::open(archive_path)
                    .map(BufReader::new)
                    .map_err(|error| {
                        format!("Failed to open archive {}: {error}", archive_path.display())
                    })?,
            ),
            destination_root,
        ),
        ArchiveFormat::TarBz2 => extract_tar_archive(
            BzDecoder::new(
                File::open(archive_path)
                    .map(BufReader::new)
                    .map_err(|error| {
                        format!("Failed to open archive {}: {error}", archive_path.display())
                    })?,
            ),
            destination_root,
        ),
        ArchiveFormat::TarXz => extract_tar_archive(
            XzDecoder::new(
                File::open(archive_path)
                    .map(BufReader::new)
                    .map_err(|error| {
                        format!("Failed to open archive {}: {error}", archive_path.display())
                    })?,
            ),
            destination_root,
        ),
        ArchiveFormat::Gzip => extract_single_stream_archive(
            GzDecoder::new(
                File::open(archive_path)
                    .map(BufReader::new)
                    .map_err(|error| {
                        format!("Failed to open archive {}: {error}", archive_path.display())
                    })?,
            ),
            destination_root,
            single_stream_output_name(archive_path, ".gz"),
        ),
        ArchiveFormat::Bzip2 => extract_single_stream_archive(
            BzDecoder::new(
                File::open(archive_path)
                    .map(BufReader::new)
                    .map_err(|error| {
                        format!("Failed to open archive {}: {error}", archive_path.display())
                    })?,
            ),
            destination_root,
            single_stream_output_name(archive_path, ".bz2"),
        ),
        ArchiveFormat::Xz => extract_single_stream_archive(
            XzDecoder::new(
                File::open(archive_path)
                    .map(BufReader::new)
                    .map_err(|error| {
                        format!("Failed to open archive {}: {error}", archive_path.display())
                    })?,
            ),
            destination_root,
            single_stream_output_name(archive_path, ".xz"),
        ),
    }
}

fn extract_zip_archive(archive_path: &Path, destination_root: &Path) -> Result<u64, String> {
    let archive_file = File::open(archive_path)
        .map(BufReader::new)
        .map_err(|error| format!("Failed to open archive {}: {error}", archive_path.display()))?;
    let mut archive = ZipArchive::new(archive_file).map_err(|error| {
        format!(
            "Failed to read zip archive {}: {error}",
            archive_path.display()
        )
    })?;
    let mut extracted_entry_count = 0_u64;

    for index in 0..archive.len() {
        let mut entry = archive.by_index(index).map_err(|error| {
            format!(
                "Failed to read zip entry #{index} from {}: {error}",
                archive_path.display()
            )
        })?;
        let relative_path = entry.enclosed_name().ok_or_else(|| {
            format!(
                "Zip archive contains an unsafe path and cannot be extracted: {}",
                entry.name()
            )
        })?;
        let destination_path = destination_root.join(relative_path);
        if entry.is_dir() {
            fs::create_dir_all(&destination_path).map_err(|error| {
                format!(
                    "Failed to create extracted directory {}: {error}",
                    destination_path.display()
                )
            })?;
            continue;
        }

        if let Some(parent) = destination_path.parent() {
            fs::create_dir_all(parent).map_err(|error| {
                format!(
                    "Failed to create extracted file parent {}: {error}",
                    parent.display()
                )
            })?;
        }

        let mut output_file = File::create(&destination_path).map_err(|error| {
            format!(
                "Failed to create extracted file {}: {error}",
                destination_path.display()
            )
        })?;
        io::copy(&mut entry, &mut output_file).map_err(|error| {
            format!(
                "Failed to write extracted zip file {}: {error}",
                destination_path.display()
            )
        })?;
        extracted_entry_count += 1;
    }

    Ok(extracted_entry_count)
}

fn extract_tar_archive<R: Read>(reader: R, destination_root: &Path) -> Result<u64, String> {
    let mut archive = Archive::new(reader);
    let mut extracted_entry_count = 0_u64;
    let entries = archive
        .entries()
        .map_err(|error| format!("Failed to read tar archive: {error}"))?;

    for entry_result in entries {
        let mut entry =
            entry_result.map_err(|error| format!("Failed to read tar entry: {error}"))?;
        let entry_type = entry.header().entry_type();
        if !(entry_type.is_dir() || entry_type.is_file()) {
            continue;
        }

        let relative_path = {
            let raw_path = entry
                .path()
                .map_err(|error| format!("Failed to read tar path: {error}"))?;
            sanitize_relative_path(raw_path.as_ref()).ok_or_else(|| {
                format!(
                    "Tar archive contains an unsafe path and cannot be extracted: {}",
                    raw_path.display()
                )
            })?
        };
        let destination_path = destination_root.join(&relative_path);

        if entry_type.is_dir() {
            fs::create_dir_all(&destination_path).map_err(|error| {
                format!(
                    "Failed to create extracted directory {}: {error}",
                    destination_path.display()
                )
            })?;
            continue;
        }

        if let Some(parent) = destination_path.parent() {
            fs::create_dir_all(parent).map_err(|error| {
                format!(
                    "Failed to create extracted file parent {}: {error}",
                    parent.display()
                )
            })?;
        }

        entry.unpack(&destination_path).map_err(|error| {
            format!(
                "Failed to unpack tar entry into {}: {error}",
                destination_path.display()
            )
        })?;
        extracted_entry_count += 1;
    }

    Ok(extracted_entry_count)
}

fn extract_single_stream_archive<R: Read>(
    mut reader: R,
    destination_root: &Path,
    output_name: String,
) -> Result<u64, String> {
    let relative_path = sanitize_relative_path(Path::new(&output_name))
        .ok_or_else(|| format!("Archive would extract to an unsafe output path: {output_name}"))?;
    let destination_path = destination_root.join(relative_path);
    if let Some(parent) = destination_path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "Failed to create extracted file parent {}: {error}",
                parent.display()
            )
        })?;
    }

    let mut output_file = File::create(&destination_path).map_err(|error| {
        format!(
            "Failed to create extracted file {}: {error}",
            destination_path.display()
        )
    })?;
    io::copy(&mut reader, &mut output_file).map_err(|error| {
        format!(
            "Failed to write extracted file {}: {error}",
            destination_path.display()
        )
    })?;
    Ok(1)
}

fn extract_seven_zip_archive(archive_path: &Path, destination_root: &Path) -> Result<u64, String> {
    let archive = sevenz_rust::Archive::open(archive_path).map_err(|error| {
        format!(
            "Failed to read 7z archive {}: {error}",
            archive_path.display()
        )
    })?;
    let extracted_entry_count = archive
        .files
        .iter()
        .filter(|entry| !entry.is_directory())
        .count() as u64;

    for entry in &archive.files {
        sanitize_relative_path(Path::new(entry.name())).ok_or_else(|| {
            format!(
                "7z archive contains an unsafe path and cannot be extracted: {}",
                entry.name()
            )
        })?;
    }

    sevenz_rust::decompress_file_with_extract_fn(
        archive_path,
        destination_root,
        |entry, reader, _| {
            let relative_path =
                sanitize_relative_path(Path::new(entry.name())).ok_or_else(|| {
                    sevenz_rust::Error::other(format!(
                        "7z archive contains an unsafe path and cannot be extracted: {}",
                        entry.name()
                    ))
                })?;
            let destination_path = destination_root.join(relative_path);
            sevenz_rust::default_entry_extract_fn(entry, reader, &destination_path)
        },
    )
    .map_err(|error| {
        format!(
            "Failed to extract 7z archive {}: {error}",
            archive_path.display()
        )
    })?;

    Ok(extracted_entry_count)
}

fn validate_archive_path(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Err(format!("Archive path does not exist: {}", path.display()));
    }
    if !path.is_file() {
        return Err(format!("Archive path is not a file: {}", path.display()));
    }
    Ok(())
}

fn merge_extracted_tree_into_directory(
    source_root: &Path,
    destination_root: &Path,
) -> Result<(), String> {
    fs::create_dir_all(destination_root).map_err(|error| {
        format!(
            "Failed to create extraction target directory {}: {error}",
            destination_root.display()
        )
    })?;

    let entries = fs::read_dir(source_root).map_err(|error| {
        format!(
            "Failed to read staged archive extraction {}: {error}",
            source_root.display()
        )
    })?;

    for entry_result in entries {
        let entry = entry_result.map_err(|error| {
            format!(
                "Failed to read staged archive entry in {}: {error}",
                source_root.display()
            )
        })?;
        let source_path = entry.path();
        let target_path = collision_free_destination(destination_root.join(entry.file_name()));
        move_path_with_fallback(&source_path, &target_path)?;
    }

    Ok(())
}

fn move_path_with_fallback(source: &Path, destination: &Path) -> Result<(), String> {
    match fs::rename(source, destination) {
        Ok(()) => return Ok(()),
        Err(error) if error.kind() != io::ErrorKind::CrossesDevices => {
            return Err(format!(
                "Failed to move extracted path {} -> {}: {error}",
                source.display(),
                destination.display()
            ))
        }
        Err(_) => {}
    }

    if source.is_dir() {
        fs::create_dir_all(destination).map_err(|error| {
            format!(
                "Failed to create extracted directory {}: {error}",
                destination.display()
            )
        })?;
        let entries = fs::read_dir(source).map_err(|error| {
            format!(
                "Failed to read extracted directory {}: {error}",
                source.display()
            )
        })?;
        for entry_result in entries {
            let entry = entry_result.map_err(|error| {
                format!(
                    "Failed to read extracted directory entry in {}: {error}",
                    source.display()
                )
            })?;
            move_path_with_fallback(&entry.path(), &destination.join(entry.file_name()))?;
        }
        fs::remove_dir(source).map_err(|error| {
            format!(
                "Failed to remove staged extracted directory {}: {error}",
                source.display()
            )
        })?;
        return Ok(());
    }

    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "Failed to create extracted file parent {}: {error}",
                parent.display()
            )
        })?;
    }
    fs::copy(source, destination).map_err(|error| {
        format!(
            "Failed to copy extracted file {} -> {}: {error}",
            source.display(),
            destination.display()
        )
    })?;
    fs::remove_file(source).map_err(|error| {
        format!(
            "Failed to remove staged extracted file {}: {error}",
            source.display()
        )
    })?;
    Ok(())
}

fn collision_free_destination(preferred_path: PathBuf) -> PathBuf {
    if !preferred_path.exists() {
        return preferred_path;
    }

    let parent = preferred_path
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from("."));
    let is_directory = preferred_path.is_dir();
    let file_name = preferred_path
        .file_name()
        .map(|value| value.to_string_lossy().into_owned())
        .unwrap_or_else(|| "item".to_string());

    if is_directory {
        return numbered_destination(&parent, &file_name, "");
    }

    let stem = preferred_path
        .file_stem()
        .map(|value| value.to_string_lossy().into_owned())
        .unwrap_or(file_name);
    let extension = preferred_path
        .extension()
        .map(|value| format!(".{}", value.to_string_lossy()))
        .unwrap_or_default();
    numbered_destination(&parent, &stem, &extension)
}

fn numbered_destination(parent: &Path, base_name: &str, extension: &str) -> PathBuf {
    let first_path = parent.join(format!("{base_name} (copy){extension}"));
    if !first_path.exists() {
        return first_path;
    }

    for index in 2..10_000 {
        let candidate = parent.join(format!("{base_name} (copy {index}){extension}"));
        if !candidate.exists() {
            return candidate;
        }
    }

    parent.join(format!(
        "{base_name} (copy {}){extension}",
        uuid::Uuid::new_v4()
    ))
}

fn archive_cache_root() -> Result<PathBuf, String> {
    let root = dirs::cache_dir()
        .unwrap_or_else(std::env::temp_dir)
        .join("GreebleFS")
        .join("archive-open");
    fs::create_dir_all(&root).map_err(|error| {
        format!(
            "Failed to create archive cache root {}: {error}",
            root.display()
        )
    })?;
    Ok(root)
}

fn archive_temp_root() -> Result<PathBuf, String> {
    let root = std::env::temp_dir().join("greeblefs-archive-extract");
    fs::create_dir_all(&root).map_err(|error| {
        format!(
            "Failed to create archive staging root {}: {error}",
            root.display()
        )
    })?;
    Ok(root)
}

fn cache_key_for_archive(path: &Path) -> Result<String, String> {
    let metadata = fs::metadata(path)
        .map_err(|error| format!("Failed to inspect archive {}: {error}", path.display()))?;
    let canonical_path = path
        .canonicalize()
        .unwrap_or_else(|_| path.to_path_buf())
        .to_string_lossy()
        .into_owned();
    let modified_ms = metadata
        .modified()
        .ok()
        .and_then(|timestamp| timestamp.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0);

    let mut hasher = Sha256::new();
    hasher.update(canonical_path.as_bytes());
    hasher.update(metadata.len().to_le_bytes());
    hasher.update(modified_ms.to_le_bytes());
    let digest = hasher.finalize();
    Ok(digest.iter().map(|value| format!("{value:02x}")).collect())
}

fn cache_base_name(path: &Path) -> String {
    path.file_name()
        .map(|value| value.to_string_lossy().into_owned())
        .unwrap_or_else(|| "archive-cache".to_string())
}

fn detect_archive_format(path: &Path) -> Option<ArchiveFormat> {
    let file_name = path.file_name()?.to_string_lossy().to_lowercase();
    ARCHIVE_SUFFIXES.iter().find_map(|(format, suffixes)| {
        suffixes
            .iter()
            .any(|suffix| file_name.ends_with(suffix))
            .then_some(*format)
    })
}

fn archive_default_folder_name(path: &Path, format: ArchiveFormat) -> String {
    let file_name = path
        .file_name()
        .map(|value| value.to_string_lossy().into_owned())
        .unwrap_or_else(|| "archive".to_string());
    let lower_name = file_name.to_lowercase();
    let suffix = ARCHIVE_SUFFIXES
        .iter()
        .find(|(candidate_format, suffixes)| {
            *candidate_format == format
                && suffixes
                    .iter()
                    .any(|candidate| lower_name.ends_with(candidate))
        })
        .and_then(|(_, suffixes)| {
            suffixes
                .iter()
                .find(|candidate| lower_name.ends_with(**candidate))
        })
        .copied()
        .unwrap_or("");
    let trimmed = if suffix.is_empty() {
        file_name.clone()
    } else {
        file_name[..file_name.len().saturating_sub(suffix.len())].to_string()
    };
    let normalized = trimmed.trim().trim_end_matches('.').trim();
    if normalized.is_empty() {
        "archive".to_string()
    } else {
        normalized.to_string()
    }
}

fn single_stream_output_name(path: &Path, suffix: &str) -> String {
    let file_name = path
        .file_name()
        .map(|value| value.to_string_lossy().into_owned())
        .unwrap_or_else(|| "archive.bin".to_string());
    let lower_name = file_name.to_lowercase();
    if lower_name.ends_with(suffix) && file_name.len() > suffix.len() {
        return file_name[..file_name.len() - suffix.len()].to_string();
    }
    format!("{file_name}.out")
}

fn sanitize_relative_path(path: &Path) -> Option<PathBuf> {
    let mut sanitized = PathBuf::new();
    for component in path.components() {
        match component {
            Component::Normal(value) => sanitized.push(value),
            Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => return None,
        }
    }
    if sanitized.as_os_str().is_empty() {
        None
    } else {
        Some(sanitized)
    }
}

fn unsupported_archive_error(path: &Path) -> String {
    let supported_suffixes = ARCHIVE_SUFFIXES
        .iter()
        .flat_map(|(_, suffixes)| suffixes.iter().copied())
        .collect::<Vec<_>>()
        .join(", ");
    format!(
        "Unsupported archive format for {}. Supported suffixes: {}",
        path.display(),
        supported_suffixes
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::tempdir;
    use zip::write::SimpleFileOptions;

    #[test]
    fn detects_compound_archive_suffixes_before_single_suffixes() {
        assert_eq!(
            detect_archive_format(Path::new("/tmp/demo.tar.gz")),
            Some(ArchiveFormat::TarGz)
        );
        assert_eq!(
            detect_archive_format(Path::new("/tmp/demo.tgz")),
            Some(ArchiveFormat::TarGz)
        );
        assert_eq!(
            detect_archive_format(Path::new("/tmp/demo.gz")),
            Some(ArchiveFormat::Gzip)
        );
    }

    #[test]
    fn derives_archive_folder_names_without_leaving_tar_suffixes() {
        assert_eq!(
            archive_default_folder_name(Path::new("/tmp/demo.tar.gz"), ArchiveFormat::TarGz),
            "demo"
        );
        assert_eq!(
            archive_default_folder_name(Path::new("/tmp/demo.zip"), ArchiveFormat::Zip),
            "demo"
        );
        assert_eq!(
            archive_default_folder_name(Path::new("/tmp/.zip"), ArchiveFormat::Zip),
            "archive"
        );
    }

    #[test]
    fn rejects_unsafe_relative_paths() {
        assert!(sanitize_relative_path(Path::new("../escape.txt")).is_none());
        assert!(sanitize_relative_path(Path::new("/absolute/path")).is_none());
        assert_eq!(
            sanitize_relative_path(Path::new("folder/nested.txt")),
            Some(PathBuf::from("folder/nested.txt"))
        );
    }

    fn create_zip_archive(path: &Path, entries: &[(&str, &str)]) {
        let file = File::create(path).expect("create zip archive");
        let mut writer = zip::ZipWriter::new(file);
        let options = SimpleFileOptions::default();
        for (name, contents) in entries {
            writer.start_file(name, options).expect("start zip file");
            writer
                .write_all(contents.as_bytes())
                .expect("write zip contents");
        }
        writer.finish().expect("finish zip archive");
    }

    #[test]
    fn extracts_zip_into_a_new_folder() {
        let workspace = tempdir().expect("tempdir");
        let archive_path = workspace.path().join("sample.zip");
        create_zip_archive(
            &archive_path,
            &[("nested/alpha.txt", "hello"), ("nested/beta.txt", "world")],
        );

        let result = extract_archive(&FsArchiveExtractionRequest {
            archive_path: archive_path.to_string_lossy().into_owned(),
            mode: FsArchiveExtractionMode::ExtractToNewFolder,
        })
        .expect("extract zip to new folder");

        let output_dir = PathBuf::from(result.output_path);
        assert!(output_dir.exists(), "output directory should exist");
        assert_eq!(
            fs::read_to_string(output_dir.join("nested/alpha.txt")).expect("read alpha"),
            "hello"
        );
        assert_eq!(
            fs::read_to_string(output_dir.join("nested/beta.txt")).expect("read beta"),
            "world"
        );
    }

    #[test]
    fn extract_here_uses_collision_safe_names() {
        let workspace = tempdir().expect("tempdir");
        let archive_path = workspace.path().join("sample.zip");
        create_zip_archive(&archive_path, &[("alpha.txt", "from archive")]);
        fs::write(workspace.path().join("alpha.txt"), "existing").expect("write existing file");

        let result = extract_archive(&FsArchiveExtractionRequest {
            archive_path: archive_path.to_string_lossy().into_owned(),
            mode: FsArchiveExtractionMode::ExtractHere,
        })
        .expect("extract zip here");

        let output_dir = PathBuf::from(result.output_path);
        assert_eq!(
            fs::read_to_string(output_dir.join("alpha.txt")).expect("read original file"),
            "existing"
        );
        assert_eq!(
            fs::read_to_string(output_dir.join("alpha (copy).txt"))
                .expect("read collision-safe extracted file"),
            "from archive"
        );
    }
}
