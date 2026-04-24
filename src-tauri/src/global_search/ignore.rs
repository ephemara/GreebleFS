pub(super) fn normalize_case(value: &str) -> String {
    value.trim().to_lowercase()
}

fn normalize_path_for_match(value: &str) -> String {
    value.replace('\\', "/")
}

pub(super) fn builtin_ignored_paths() -> &'static [&'static str] {
    &[
        "/$Recycle.Bin",
        "/System Volume Information",
        "/proc",
        "/sys",
        "/dev",
        "/run",
        "/tmp",
        "/var/tmp",
        "/lost+found",
        "/.Trash",
        "/.Trashes",
        "/.Spotlight-V100",
        "/.fseventsd",
        "/Volumes/.Trashes",
        "/node_modules",
        "/.git",
        "/target",
        "/.cache",
        "/Library/Caches",
        "/AppData/Local/Temp",
    ]
}

pub(super) fn build_ignored_path_list(custom_paths: &[String]) -> Vec<String> {
    custom_paths
        .iter()
        .map(|path| {
            normalize_path_for_match(path)
                .trim()
                .trim_end_matches('/')
                .to_string()
        })
        .chain(builtin_ignored_paths().iter().map(|path| {
            normalize_path_for_match(path)
                .trim()
                .trim_end_matches('/')
                .to_string()
        }))
        .filter(|path| !path.is_empty())
        .collect()
}

pub(super) fn is_ignored_path(path: &str, ignored_paths: &[String]) -> bool {
    let normalized_path = normalize_path_for_match(path);
    ignored_paths.iter().any(|ignored| {
        let normalized = ignored.trim().trim_end_matches('/');
        if normalized.is_empty() {
            return false;
        }

        if normalized.starts_with('/') {
            return normalized_path == normalized
                || normalized_path.ends_with(normalized)
                || normalized_path.contains(&format!("{normalized}/"));
        }

        normalized_path == normalized
            || normalized_path.starts_with(normalized)
            || normalized_path.contains(&format!("/{normalized}/"))
            || normalized_path.ends_with(&format!("/{normalized}"))
    })
}
