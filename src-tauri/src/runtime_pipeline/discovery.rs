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
                    // Path sandboxing: managed-content runtimes must keep
                    // every resolved path (module dir, entry, working dir)
                    // inside the package directory the manifest lives in.
                    // Builtins are trusted source so we skip the check there.
                    if root.origin == RuntimePackageOrigin::ManagedContent {
                        if let Err(error) = enforce_managed_path_sandbox(&path, &manifest) {
                            log::warn!(
                                "GreebleFS: rejecting managed runtime package at {}: {error}",
                                path.to_string_lossy()
                            );
                            continue;
                        }
                    }
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

/// Ensure every host-resolvable path inside the manifest stays inside the
/// declared package directory. We reject the package outright on the first
/// escape so authored content cannot point lazy compile or sidecar exec at
/// arbitrary filesystem locations.
fn enforce_managed_path_sandbox(
    package_dir: &Path,
    manifest: &RuntimeManifest,
) -> Result<(), String> {
    ensure_path_inside_root(Path::new(&manifest.module_dir), package_dir)?;
    if let Some(entry) = manifest.entry.as_deref() {
        let entry_path = Path::new(entry);
        // Bare module entries like "." or "main.go" without a directory
        // separator must resolve through `module_dir`, which is already
        // sandbox-checked above. We only canonicalize when the manifest
        // surfaced an actual filesystem entry path.
        if entry_path.exists() {
            ensure_path_inside_root(entry_path, package_dir)?;
        }
    }
    if let Some(working_directory) = manifest.working_directory.as_deref() {
        ensure_path_inside_root(Path::new(working_directory), package_dir)?;
    }
    Ok(())
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

    #[test]
    fn managed_content_runtime_with_external_module_dir_is_rejected() {
        let temp = tempdir().expect("tempdir");
        let runtimes_root = temp.path().join("runtimes");
        let attacker_pkg = runtimes_root.join("attacker");
        std::fs::create_dir_all(&attacker_pkg).expect("mkdir");

        // A second sibling directory that the attacker package tries to
        // point at via an absolute moduleDir. Must be rejected.
        let outside = temp.path().join("victim");
        std::fs::create_dir_all(&outside).expect("mkdir");

        let manifest_text = format!(
            r#"id = "attacker"
kind = "native-command"
compiler = "go-native"
moduleDir = "{}"
entry = "."
"#,
            outside.to_string_lossy()
        );
        std::fs::write(
            attacker_pkg.join(RuntimeManifest::FILE_NAME),
            manifest_text,
        )
        .expect("write");

        let packages = discover_runtime_packages(&[RuntimeDiscoveryRoot::new(
            "managed",
            RuntimePackageOrigin::ManagedContent,
            runtimes_root,
        )]);
        assert!(
            packages.is_empty(),
            "managed-content packages with externally-rooted moduleDir must be dropped"
        );
    }

    #[test]
    fn managed_content_runtime_with_inside_module_dir_is_kept() {
        let temp = tempdir().expect("tempdir");
        let runtimes_root = temp.path().join("runtimes");
        let pkg = runtimes_root.join("clean");
        let inside_module = pkg.join("nested");
        std::fs::create_dir_all(&inside_module).expect("mkdir");

        std::fs::write(
            pkg.join(RuntimeManifest::FILE_NAME),
            r#"id = "clean"
kind = "native-command"
compiler = "go-native"
moduleDir = "nested"
entry = "."
"#,
        )
        .expect("write");

        let packages = discover_runtime_packages(&[RuntimeDiscoveryRoot::new(
            "managed",
            RuntimePackageOrigin::ManagedContent,
            runtimes_root,
        )]);
        assert_eq!(packages.len(), 1);
        assert_eq!(packages[0].manifest.id, "clean");
    }
}
