use std::fmt;
use std::hash::{Hash, Hasher};
use std::path::Path;

const FNV1A64_OFFSET: u64 = 0xcbf29ce484222325;
const FNV1A64_PRIME: u64 = 0x100000001b3;

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct ExplorerPathHash64(u64);

impl ExplorerPathHash64 {
    pub fn value(self) -> u64 {
        self.0
    }
}

#[derive(Clone, Eq)]
pub struct ExplorerPathKey {
    normalized: String,
    hash64: ExplorerPathHash64,
}

impl ExplorerPathKey {
    pub fn from_path(path: &Path) -> Self {
        Self::from_raw(path.to_string_lossy().as_ref())
    }

    pub fn from_raw(raw: &str) -> Self {
        let normalized = normalize_explorer_path_key(raw);
        let hash64 = ExplorerPathHash64(stable_hash64(normalized.as_bytes()));
        Self { normalized, hash64 }
    }

    pub fn as_str(&self) -> &str {
        &self.normalized
    }

    pub fn hash64(&self) -> ExplorerPathHash64 {
        self.hash64
    }

    pub fn into_string(self) -> String {
        self.normalized
    }

    pub fn descendant_prefix(&self) -> String {
        let separator = platform_separator();
        if self.normalized.ends_with(separator) {
            self.normalized.clone()
        } else {
            format!("{}{separator}", self.normalized)
        }
    }

    pub fn is_same_or_descendant_of(&self, ancestor: &ExplorerPathKey) -> bool {
        self.normalized == ancestor.normalized
            || self.normalized.starts_with(&ancestor.descendant_prefix())
    }
}

impl PartialEq for ExplorerPathKey {
    fn eq(&self, other: &Self) -> bool {
        self.normalized == other.normalized
    }
}

impl Hash for ExplorerPathKey {
    fn hash<H: Hasher>(&self, state: &mut H) {
        state.write_u64(self.hash64.value());
    }
}

impl fmt::Debug for ExplorerPathKey {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("ExplorerPathKey")
            .field("normalized", &self.normalized)
            .field("hash64", &self.hash64)
            .finish()
    }
}

impl fmt::Display for ExplorerPathKey {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.normalized)
    }
}

fn stable_hash64(bytes: &[u8]) -> u64 {
    let mut hash = FNV1A64_OFFSET;
    for byte in bytes {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(FNV1A64_PRIME);
    }
    hash
}

#[cfg(target_os = "windows")]
fn platform_separator() -> char {
    '\\'
}

#[cfg(not(target_os = "windows"))]
fn platform_separator() -> char {
    '/'
}

#[cfg(target_os = "windows")]
fn normalize_explorer_path_key(raw: &str) -> String {
    let mut value = raw.trim().replace('/', "\\");
    if let Some(stripped) = value.strip_prefix(r"\\?\UNC\") {
        value = format!(r"\\{stripped}");
    } else if let Some(stripped) = value.strip_prefix(r"\\?\") {
        value = stripped.to_string();
    }

    let minimum_len = windows_minimum_trailing_separator_len(&value);
    while value.len() > minimum_len && value.ends_with('\\') {
        value.pop();
    }

    value.to_ascii_lowercase()
}

#[cfg(not(target_os = "windows"))]
fn normalize_explorer_path_key(raw: &str) -> String {
    let mut value = raw.trim().to_string();
    while value.len() > 1 && value.ends_with('/') {
        value.pop();
    }
    value
}

#[cfg(target_os = "windows")]
fn windows_minimum_trailing_separator_len(value: &str) -> usize {
    let bytes = value.as_bytes();
    if bytes.len() >= 3 && bytes[1] == b':' && bytes[2] == b'\\' {
        return 3;
    }
    if value == r"\" {
        return 1;
    }
    0
}

#[cfg(test)]
impl ExplorerPathKey {
    fn from_normalized_for_tests(normalized: &str, hash64: u64) -> Self {
        Self {
            normalized: normalized.to_string(),
            hash64: ExplorerPathHash64(hash64),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hash_is_stable_for_same_normalized_key() {
        let left = ExplorerPathKey::from_raw("/workspace/assets");
        let right = ExplorerPathKey::from_raw("/workspace/assets/");

        assert_eq!(left, right);
        assert_eq!(left.hash64(), right.hash64());
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn windows_keys_normalize_case_separators_and_extended_prefixes() {
        let left = ExplorerPathKey::from_raw(r"\\?\C:\Users\Admin\Project\File.TXT");
        let right = ExplorerPathKey::from_raw(r"c:/users/admin/project/file.txt/");

        assert_eq!(left.as_str(), r"c:\users\admin\project\file.txt");
        assert_eq!(left, right);
    }

    #[cfg(not(target_os = "windows"))]
    #[test]
    fn unix_keys_preserve_case_and_slashes() {
        let left = ExplorerPathKey::from_raw("/Workspace/Assets");
        let right = ExplorerPathKey::from_raw("/workspace/assets");

        assert_ne!(left, right);
        assert_eq!(left.as_str(), "/Workspace/Assets");
    }

    #[test]
    fn descendant_checks_do_not_match_sibling_prefixes() {
        let ancestor = ExplorerPathKey::from_raw("/workspace/foo");
        let child = ExplorerPathKey::from_raw("/workspace/foo/bar.txt");
        let sibling_prefix = ExplorerPathKey::from_raw("/workspace/foobar/bar.txt");

        assert!(child.is_same_or_descendant_of(&ancestor));
        assert!(!sibling_prefix.is_same_or_descendant_of(&ancestor));
    }

    #[test]
    fn cache_invalidation_prefix_checks_remove_only_real_descendants() {
        let changed_directory = ExplorerPathKey::from_raw("/workspace/assets");
        let same_directory = ExplorerPathKey::from_raw("/workspace/assets/");
        let nested_child = ExplorerPathKey::from_raw("/workspace/assets/textures/wall.png");
        let sibling_prefix = ExplorerPathKey::from_raw("/workspace/assets-old/wall.png");

        assert!(same_directory.is_same_or_descendant_of(&changed_directory));
        assert!(nested_child.is_same_or_descendant_of(&changed_directory));
        assert!(!sibling_prefix.is_same_or_descendant_of(&changed_directory));
    }

    #[test]
    fn equality_is_safe_when_hashes_collide() {
        let left = ExplorerPathKey::from_normalized_for_tests("/workspace/a", 42);
        let right = ExplorerPathKey::from_normalized_for_tests("/workspace/b", 42);

        assert_eq!(left.hash64(), right.hash64());
        assert_ne!(left, right);
    }
}
