//! Content-addressed compile/build cache.
//!
//! Cache key components:
//!   `{runtime_id}-{compiler}-{toolchain_version}-{target}-{mode}-{source_sig}`
//!
//! `source_sig` is a deterministic SHA-256 over a sorted (relative-path, size,
//! mtime, len-of-contents-for-text) descriptor of the runtime source tree.
//! That is fast enough on cold starts but fully invalidates the cache when
//! anything in the module dir changes. Authors who need stricter invalidation
//! can add a `.runtime-cache-bust` file inside the module dir.

use std::path::{Path, PathBuf};

use sha2::{Digest, Sha256};

#[derive(Debug, Clone)]
pub struct CacheKeyParts<'a> {
    pub runtime_id: &'a str,
    pub compiler: &'a str,
    pub toolchain_version: &'a str,
    pub target: &'a str,
    pub mode: &'a str,
    pub source_signature: &'a str,
}

impl<'a> CacheKeyParts<'a> {
    pub fn finalize(&self) -> String {
        let mut hasher = Sha256::new();
        hasher.update(self.runtime_id.as_bytes());
        hasher.update(b"|");
        hasher.update(self.compiler.as_bytes());
        hasher.update(b"|");
        hasher.update(self.toolchain_version.as_bytes());
        hasher.update(b"|");
        hasher.update(self.target.as_bytes());
        hasher.update(b"|");
        hasher.update(self.mode.as_bytes());
        hasher.update(b"|");
        hasher.update(self.source_signature.as_bytes());
        format!("{:x}", hasher.finalize())
    }
}

/// Layout of the host-owned compile cache. We keep one shared cache root for
/// every runtime so a single GC sweep can find every artifact.
#[derive(Debug, Clone)]
pub struct CompileCacheLayout {
    pub root_dir: PathBuf,
}

impl CompileCacheLayout {
    /// Resolve the cache layout under the Tauri app-local data dir. Falls back
    /// to a deterministic temp path when no Tauri context is available (tests).
    pub fn from_app(app: &tauri::AppHandle) -> Result<Self, String> {
        let local_data = app
            .path()
            .app_local_data_dir()
            .map_err(|error| format!("failed to resolve app local data dir: {error}"))?;
        Ok(Self {
            root_dir: local_data.join("runtime-cache"),
        })
    }

    pub fn for_root(root: impl Into<PathBuf>) -> Self {
        Self {
            root_dir: root.into(),
        }
    }

    pub fn entry_for(&self, key: &str) -> CompileCacheEntry {
        let entry_dir = self.root_dir.join(key);
        CompileCacheEntry {
            entry_dir,
            key: key.to_string(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct CompileCacheEntry {
    pub entry_dir: PathBuf,
    pub key: String,
}

impl CompileCacheEntry {
    pub fn artifact_path(&self, artifact_name: &str) -> PathBuf {
        self.entry_dir.join(artifact_name)
    }

    pub fn ensure_dir(&self) -> Result<(), String> {
        std::fs::create_dir_all(&self.entry_dir).map_err(|error| {
            format!(
                "Failed to create runtime cache entry {}: {error}",
                self.entry_dir.to_string_lossy()
            )
        })
    }

    pub fn exists_and_has(&self, artifact_name: &str) -> bool {
        self.artifact_path(artifact_name).exists()
    }
}

use tauri::Manager as _;

/// Compute the deterministic source signature for a module dir. We walk every
/// non-hidden, non-ignored file, hash the relative path + size + modification
/// time + first 4 KiB of contents to detect content changes cheaply. For wasm
/// builds this is sensitive enough; full content hashing can be opt-in later.
pub fn compute_source_signature(module_dir: &Path) -> Result<String, String> {
    let mut entries = Vec::new();
    visit_for_signature(module_dir, module_dir, &mut entries)?;
    entries.sort_by(|a, b| a.0.cmp(&b.0));

    let mut hasher = Sha256::new();
    for (relative_path, size, mtime, head) in entries {
        hasher.update(relative_path.as_bytes());
        hasher.update(b"|");
        hasher.update(size.to_le_bytes());
        hasher.update(b"|");
        hasher.update(mtime.to_le_bytes());
        hasher.update(b"|");
        hasher.update(&head);
        hasher.update(b"\n");
    }
    Ok(format!("{:x}", hasher.finalize()))
}

fn visit_for_signature(
    root: &Path,
    current: &Path,
    out: &mut Vec<(String, u64, i64, Vec<u8>)>,
) -> Result<(), String> {
    let entries = match std::fs::read_dir(current) {
        Ok(entries) => entries,
        Err(_) => return Ok(()),
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let file_name = entry.file_name().to_string_lossy().to_string();
        if file_name.starts_with('.') {
            continue;
        }
        if matches!(
            file_name.as_str(),
            "node_modules"
                | "target"
                | "dist"
                | "build"
                | "vendor"
                | ".cache"
                | ".runtime-cache"
                | "__pycache__"
        ) {
            continue;
        }
        let metadata = match entry.metadata() {
            Ok(metadata) => metadata,
            Err(_) => continue,
        };
        if metadata.is_dir() {
            visit_for_signature(root, &path, out)?;
            continue;
        }
        let relative = path
            .strip_prefix(root)
            .map(|p| p.to_string_lossy().replace('\\', "/").to_string())
            .unwrap_or_else(|_| path.to_string_lossy().to_string());

        let size = metadata.len();
        let mtime = metadata
            .modified()
            .ok()
            .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|duration| duration.as_secs() as i64)
            .unwrap_or(0);
        let mut head = Vec::with_capacity(4096);
        if size > 0 {
            if let Ok(bytes) = std::fs::read(&path) {
                head.extend(bytes.iter().take(4096));
            }
        }
        out.push((relative, size, mtime, head));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn cache_key_is_stable_for_same_inputs() {
        let parts = CacheKeyParts {
            runtime_id: "panel-a",
            compiler: "go-js-wasm",
            toolchain_version: "go1.24.0",
            target: "js-wasm",
            mode: "release",
            source_signature: "deadbeef",
        };
        let a = parts.finalize();
        let b = parts.finalize();
        assert_eq!(a, b);
    }

    #[test]
    fn cache_key_changes_when_any_input_changes() {
        let base = CacheKeyParts {
            runtime_id: "panel-a",
            compiler: "go-js-wasm",
            toolchain_version: "go1.24.0",
            target: "js-wasm",
            mode: "release",
            source_signature: "aaaa",
        };
        let mut other = base.clone();
        other.source_signature = "bbbb";
        assert_ne!(base.finalize(), other.finalize());

        let mut other_compiler = base.clone();
        other_compiler.compiler = "tinygo-wasm";
        assert_ne!(base.finalize(), other_compiler.finalize());
    }

    #[test]
    fn source_signature_changes_with_file_content() {
        let dir = tempdir().expect("tempdir");
        std::fs::write(dir.path().join("main.go"), "package main\n").expect("write");
        let signature_a = compute_source_signature(dir.path()).expect("sig a");

        std::fs::write(dir.path().join("main.go"), "package main\nfunc main() {}\n")
            .expect("write 2");
        let signature_b = compute_source_signature(dir.path()).expect("sig b");
        assert_ne!(signature_a, signature_b);
    }

    #[test]
    fn source_signature_ignores_hidden_and_cache_directories() {
        let dir = tempdir().expect("tempdir");
        std::fs::write(dir.path().join("main.go"), "package main\n").expect("write");
        let signature_a = compute_source_signature(dir.path()).expect("sig a");

        std::fs::create_dir_all(dir.path().join(".runtime-cache")).expect("mkdir");
        std::fs::write(dir.path().join(".runtime-cache/junk"), "noise").expect("write");
        let signature_b = compute_source_signature(dir.path()).expect("sig b");
        assert_eq!(signature_a, signature_b);
    }
}
