use greeble_ipc_contracts::{IpcArtifactDescriptor, IpcArtifactRef, IpcArtifactRetention};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{Manager, Runtime};

#[derive(Debug, Clone)]
pub struct RegisterArtifactPathRequest {
    pub kind: String,
    pub file_path: PathBuf,
    pub media_type: Option<String>,
    pub retention: IpcArtifactRetention,
    pub identity_key: Option<String>,
    pub content_revision: Option<String>,
    pub delete_on_release: bool,
}

#[derive(Debug, Clone)]
struct RegisteredArtifact {
    descriptor: IpcArtifactDescriptor,
    file_path: PathBuf,
    delete_on_release: bool,
}

#[derive(Default)]
pub struct ArtifactRegistry {
    records: Mutex<HashMap<String, RegisteredArtifact>>,
}

impl ArtifactRegistry {
    pub fn register_path<R: Runtime, M: Manager<R>>(
        &self,
        app: &M,
        request: RegisterArtifactPathRequest,
    ) -> Result<IpcArtifactDescriptor, String> {
        let metadata = fs::metadata(&request.file_path).map_err(|error| {
            format!(
                "Failed to inspect IPC artifact '{}': {error}",
                request.file_path.display()
            )
        })?;
        if !metadata.is_file() {
            return Err(format!(
                "IPC artifact path is not a file: {}",
                request.file_path.display()
            ));
        }

        let resource_handle = tauri::transport::register_file_resource(
            app,
            request.kind.clone(),
            request.file_path.clone(),
            request.media_type.clone(),
        )
        .map_err(|error| {
            format!(
                "Failed to register IPC artifact transport resource '{}': {error}",
                request.file_path.display()
            )
        })?;

        let descriptor = IpcArtifactDescriptor {
            id: stable_artifact_id(
                &request.kind,
                &request.file_path,
                request.identity_key.as_deref(),
                request.content_revision.as_deref(),
                request.retention,
            ),
            kind: request.kind,
            resource_rid: resource_handle.rid,
            media_type: request.media_type,
            byte_length: Some(metadata.len()),
            retention: request.retention,
            identity_key: request.identity_key,
            content_revision: request.content_revision,
        };

        let mut records = self
            .records
            .lock()
            .map_err(|_| "IPC artifact registry lock poisoned".to_string())?;
        records.insert(
            descriptor.id.clone(),
            RegisteredArtifact {
                descriptor: descriptor.clone(),
                file_path: request.file_path,
                delete_on_release: request.delete_on_release,
            },
        );

        Ok(descriptor)
    }

    pub fn release<R: Runtime, M: Manager<R>>(&self, app: &M, id: &str) -> Result<(), String> {
        let record = {
            let mut records = self
                .records
                .lock()
                .map_err(|_| "IPC artifact registry lock poisoned".to_string())?;
            records.remove(id)
        }
        .ok_or_else(|| format!("Unknown IPC artifact id: {id}"))?;

        app.resources_table()
            .close(record.descriptor.resource_rid)
            .map_err(|error| {
                format!(
                    "Failed to close IPC artifact transport resource '{}' (rid {}): {error}",
                    id, record.descriptor.resource_rid
                )
            })?;

        if record.delete_on_release {
            let artifact_path = record.file_path;
            if artifact_path.exists() {
                fs::remove_file(&artifact_path).map_err(|error| {
                    format!(
                        "Failed to delete IPC artifact '{}': {error}",
                        artifact_path.display()
                    )
                })?;
            }
        }

        Ok(())
    }

    pub fn artifact_path(&self, id: &str) -> Result<Option<PathBuf>, String> {
        let records = self
            .records
            .lock()
            .map_err(|_| "IPC artifact registry lock poisoned".to_string())?;
        Ok(records.get(id).map(|record| record.file_path.clone()))
    }

    pub fn descriptor_to_ref(descriptor: &IpcArtifactDescriptor) -> IpcArtifactRef {
        IpcArtifactRef {
            id: descriptor.id.clone(),
            kind: descriptor.kind.clone(),
            resource_rid: descriptor.resource_rid,
            media_type: descriptor.media_type.clone(),
            identity_key: descriptor.identity_key.clone(),
            content_revision: descriptor.content_revision.clone(),
        }
    }
}

fn stable_artifact_id(
    kind: &str,
    file_path: &PathBuf,
    identity_key: Option<&str>,
    content_revision: Option<&str>,
    retention: IpcArtifactRetention,
) -> String {
    let mut hasher = Sha256::new();
    hasher.update(kind.as_bytes());
    hasher.update(file_path.to_string_lossy().as_bytes());
    hasher.update(identity_key.unwrap_or_default().as_bytes());
    hasher.update(content_revision.unwrap_or_default().as_bytes());
    hasher.update(match retention {
        IpcArtifactRetention::Ephemeral => b"ephemeral".as_slice(),
        IpcArtifactRetention::Persistent => b"persistent".as_slice(),
    });
    format!("artifact-{:x}", hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::{ArtifactRegistry, RegisterArtifactPathRequest};
    use greeble_ipc_contracts::IpcArtifactRetention;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn persistent_artifact_registration_reuses_the_same_descriptor_id() {
        let tempdir = tempdir().expect("tempdir");
        let artifact_path = tempdir.path().join("thumb.png");
        fs::write(&artifact_path, b"thumb-bytes").expect("artifact should be written");
        let app = tauri::test::mock_app();

        let registry = ArtifactRegistry::default();
        let first = registry
            .register_path(app.handle(), RegisterArtifactPathRequest {
                kind: "thumbnail.poster".to_string(),
                file_path: artifact_path.clone(),
                media_type: Some("image/png".to_string()),
                retention: IpcArtifactRetention::Persistent,
                identity_key: Some("entity-1".to_string()),
                content_revision: Some("rev-1".to_string()),
                delete_on_release: false,
            })
            .expect("first descriptor should register");
        let second = registry
            .register_path(app.handle(), RegisterArtifactPathRequest {
                kind: "thumbnail.poster".to_string(),
                file_path: artifact_path,
                media_type: Some("image/png".to_string()),
                retention: IpcArtifactRetention::Persistent,
                identity_key: Some("entity-1".to_string()),
                content_revision: Some("rev-1".to_string()),
                delete_on_release: false,
            })
            .expect("second descriptor should register");

        assert_eq!(first.id, second.id);
        assert_eq!(first.byte_length, Some(11));
    }

    #[test]
    fn ephemeral_artifact_release_deletes_the_backing_file() {
        let tempdir = tempdir().expect("tempdir");
        let artifact_path = tempdir.path().join("preview.bin");
        fs::write(&artifact_path, b"preview").expect("artifact should be written");
        let app = tauri::test::mock_app();

        let registry = ArtifactRegistry::default();
        let descriptor = registry
            .register_path(app.handle(), RegisterArtifactPathRequest {
                kind: "preview.bytes".to_string(),
                file_path: artifact_path.clone(),
                media_type: None,
                retention: IpcArtifactRetention::Ephemeral,
                identity_key: None,
                content_revision: None,
                delete_on_release: true,
            })
            .expect("descriptor should register");

        registry
            .release(app.handle(), &descriptor.id)
            .expect("descriptor should release");

        assert!(!artifact_path.exists());
    }
}
