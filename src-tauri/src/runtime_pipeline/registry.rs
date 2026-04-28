//! Process-wide runtime registry.
//!
//! Owned as Tauri-managed state. Caches the latest discovery snapshot,
//! exposes lookup-by-id, and is the only place the host should ask "where
//! does runtime X live and what does its manifest say".

use std::collections::HashMap;
use std::sync::RwLock;

use crate::runtime_pipeline::discovery::{
    discover_runtime_packages, DiscoveredRuntimePackage, RuntimeDiscoveryRoot,
};

#[derive(Default)]
pub struct RuntimeRegistry {
    inner: RwLock<RegistryState>,
}

#[derive(Default)]
struct RegistryState {
    by_id: HashMap<String, DiscoveredRuntimePackage>,
    last_roots: Vec<RuntimeDiscoveryRoot>,
}

impl RuntimeRegistry {
    pub fn refresh_from_roots(
        &self,
        roots: Vec<RuntimeDiscoveryRoot>,
    ) -> Vec<DiscoveredRuntimePackage> {
        let packages = discover_runtime_packages(&roots);
        let mut by_id = HashMap::with_capacity(packages.len());
        for package in &packages {
            by_id.insert(package.manifest.id.clone(), package.clone());
        }
        if let Ok(mut state) = self.inner.write() {
            state.by_id = by_id;
            state.last_roots = roots;
        }
        packages
    }

    pub fn snapshot(&self) -> Vec<DiscoveredRuntimePackage> {
        self.inner
            .read()
            .map(|state| state.by_id.values().cloned().collect())
            .unwrap_or_default()
    }

    pub fn get_by_id(&self, id: &str) -> Option<DiscoveredRuntimePackage> {
        self.inner
            .read()
            .ok()
            .and_then(|state| state.by_id.get(id).cloned())
    }

    pub fn last_roots(&self) -> Vec<RuntimeDiscoveryRoot> {
        self.inner
            .read()
            .map(|state| state.last_roots.clone())
            .unwrap_or_default()
    }
}

/// Tauri-managed wrapper.
pub type RuntimeRegistryState = RuntimeRegistry;
