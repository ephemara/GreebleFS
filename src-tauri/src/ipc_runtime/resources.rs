use greeble_ipc_contracts::IpcResourceHandle;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::sync::Mutex;

#[derive(Debug, Clone)]
struct RegisteredResource {
    handle: IpcResourceHandle,
}

#[derive(Default)]
pub struct ResourceRegistry {
    records: Mutex<HashMap<String, RegisteredResource>>,
}

impl ResourceRegistry {
    pub fn register(&self, kind: &str, stable_key: Option<&str>) -> Result<IpcResourceHandle, String> {
        let handle = IpcResourceHandle {
            id: stable_resource_id(kind, stable_key),
            kind: kind.to_string(),
        };

        let mut records = self
            .records
            .lock()
            .map_err(|_| "IPC resource registry lock poisoned".to_string())?;
        records.insert(
            handle.id.clone(),
            RegisteredResource {
                handle: handle.clone(),
            },
        );

        Ok(handle)
    }

    pub fn release(&self, id: &str) -> Result<(), String> {
        let mut records = self
            .records
            .lock()
            .map_err(|_| "IPC resource registry lock poisoned".to_string())?;
        records.remove(id);
        Ok(())
    }

    pub fn get(&self, id: &str) -> Result<Option<IpcResourceHandle>, String> {
        let records = self
            .records
            .lock()
            .map_err(|_| "IPC resource registry lock poisoned".to_string())?;
        Ok(records.get(id).map(|entry| entry.handle.clone()))
    }
}

fn stable_resource_id(kind: &str, stable_key: Option<&str>) -> String {
    let mut hasher = Sha256::new();
    hasher.update(kind.as_bytes());
    hasher.update(stable_key.unwrap_or_default().as_bytes());
    format!("resource-{:x}", hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::ResourceRegistry;

    #[test]
    fn resource_release_is_safe_to_repeat() {
        let registry = ResourceRegistry::default();
        let handle = registry
            .register("python-sidecar-session", Some("/tmp/runtime"))
            .expect("handle should register");

        registry.release(&handle.id).expect("first release should succeed");
        registry
            .release(&handle.id)
            .expect("second release should also succeed");
        assert!(
            registry
                .get(&handle.id)
                .expect("lookup should succeed")
                .is_none()
        );
    }
}
