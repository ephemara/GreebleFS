use std::fs::Metadata;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

pub(super) fn path_extension_lowercase(path: &Path) -> Option<String> {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.to_lowercase())
}

pub(super) fn is_hidden_path(path: &Path) -> bool {
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;

        if let Ok(metadata) = std::fs::metadata(path) {
            const FILE_ATTRIBUTE_HIDDEN: u32 = 0x2;
            return (metadata.file_attributes() & FILE_ATTRIBUTE_HIDDEN) != 0;
        }

        false
    }

    #[cfg(not(windows))]
    {
        path.file_name()
            .and_then(|name| name.to_str())
            .map(|name| name.starts_with('.'))
            .unwrap_or(false)
    }
}

fn system_time_unix_ms(value: Result<SystemTime, std::io::Error>) -> u64 {
    value
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

pub(super) fn metadata_modified_time_unix_ms(metadata: &Metadata) -> u64 {
    system_time_unix_ms(metadata.modified())
}

pub(super) fn metadata_times_unix_ms(metadata: &Metadata) -> (u64, u64, u64) {
    (
        metadata_modified_time_unix_ms(metadata),
        system_time_unix_ms(metadata.accessed()),
        system_time_unix_ms(metadata.created()),
    )
}
