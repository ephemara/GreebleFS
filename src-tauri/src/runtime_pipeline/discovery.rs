//! Runtime package discovery.
//!
//! Two source classes:
//!  - **Builtin**: shipped with the host. Trusted, can be prebuilt.
//!  - **Managed-content**: dropped into the user's `runtimes/` root. Lazy
//!    compile, must stay inside the declared root for path-traversal safety.

use std::path::{Path, PathBuf};

use crate::runtime_pipeline::manifest::RuntimeManifest;

#[derive(
    Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize, specta::Type,
)]
#[serde(rename_all = "kebab-case")]
pub enum RuntimePackageOrigin {
    Builtin,
    ManagedContent,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredRuntimePackage {
    pub manifest: RuntimeManifest,
    pub origin: RuntimePackageOrigin,
    pub root_id: String,
}

#[derive(Debug, Clone)]
pub struct RuntimeDiscoveryRoot {
    pub root_id: String,
    pub origin: RuntimePackageOrigin,
    pub directory: PathBuf,
}

impl RuntimeDiscoveryRoot {
    pub fn new(
        root_id: impl Into<String>,
        origin: RuntimePackageOrigin,
        directory: impl Into<PathBuf>,
    ) -> Self {
        Self {
            root_id: root_id.into(),
            origin,
            directory: directory.into(),
        }
    }
}

/// Walk every discovery root and resolve a flat list of packages. Walk is
/// non-recursive past the first nested directory level on purpose: a runtime
/// package owns its full subtree, so we never sniff into module sources for
/// nested manifests.
pub fn discover_runtime_packages(
    roots: &[RuntimeDiscoveryRoot],
) -> Vec<DiscoveredRuntimePackage> {
    let mut out = Vec::new();
    for root in roots {
        if !root.directory.exists() {
            continue;
        }
        let entries = match std::fs::read_dir(&root.directory) {
            Ok(entries) => entries,
            Err(_) => continue,
        };
        for entry in entries.flatten() {
            let metadata = match entry.metadata() {
                Ok(metadata) => metadata,
                Err(_) => continue,
            };
            if !metadata.is_dir() {
                continue;
            }
            let path = entry.path();
            if !is_potential_runtime_package(&path) {
                continue;
            }
            match RuntimeManifest::from_dir(&path) {
                Ok(manifest) => {
                    out.push(DiscoveredRuntimePackage {
                        manifest,
                        origin: root.origin,
                        root_id: root.root_id.clone(),
                    });
                }
                Err(error) => {
                    log::warn!(
                        "GreebleFS: skipping runtime package at {}: {error}",
                        path.to_string_lossy()
                    );
                }
            }
        }
    }
    out
}

fn is_potential_runtime_package(dir: &Path) -> bool {
    dir.join(RuntimeManifest::FILE_NAME).exists()
}

/// Path-traversal guard for managed-content packages. Returns `Ok(canonical)`
/// only if `candidate` resolves inside `containing_root`. The check uses
/// canonical paths so symlinks cannot escape the root.
pub fn ensure_path_inside_root(
    candidate: &Path,
    containing_root: &Path,
) -> Result<PathBuf, String> {
    let canonical_candidate = candidate
        .canonicalize()
        .map_err(|error| format!("failed to canonicalize {}: {error}", candidate.to_string_lossy()))?;
    let canonical_root = containing_root
        .canonicalize()
        .map_err(|error| format!("failed to canonicalize root {}: {error}", containing_root.to_string_lossy()))?;
    if !canonical_candidate.starts_with(&canonical_root) {
        return Err(format!(
            "path {} is outside the allowed root {}",
            canonical_candidate.to_string_lossy(),
            canonical_root.to_string_lossy()
        ));
    }
    Ok(canonical_candidate)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn write_minimal_manifest(dir: &Path) {
        std::fs::create_dir_all(dir).expect("mkdir");
        std::fs::write(
            dir.join(RuntimeManifest::FILE_NAME),
            r#"
id = "demo"
kind = "native-command"
compiler = "go-native"
entry = "main.go"
            "#,
        )
        .expect("write");
    }

    #[test]
    fn discovers_runtime_packages_under_a_root() {
        let temp = tempdir().expect("tempdir");
        let root = temp.path().join("runtimes");
        std::fs::create_dir_all(&root).expect("mkdir");
        write_minimal_manifest(&root.join("alpha"));
        write_minimal_manifest(&root.join("beta"));

        let packages = discover_runtime_packages(&[RuntimeDiscoveryRoot::new(
            "managed",
            RuntimePackageOrigin::ManagedContent,
            root,
        )]);
        let mut ids: Vec<_> = packages.iter().map(|p| p.manifest.id.clone()).collect();
        ids.sort();
        assert_eq!(ids, vec!["demo".to_string(), "demo".to_string()]);
        assert!(packages
            .iter()
            .all(|p| p.origin == RuntimePackageOrigin::ManagedContent));
    }

    #[test]
    fn ensure_path_inside_root_rejects_traversal() {
        let temp = tempdir().expect("tempdir");
        let inside = temp.path().join("inside");
        std::fs::create_dir_all(&inside).expect("mkdir");
        let outside = temp.path().join("outside");
        std::fs::create_dir_all(&outside).expect("mkdir");

        let result = ensure_path_inside_root(&outside, &inside);
        assert!(result.is_err(), "outside path must be rejected");
        let allowed = ensure_path_inside_root(&inside, &inside);
        assert!(allowed.is_ok(), "matching root must be allowed");
    }
}
