//! Plugin context for safe API access

use crate::{PluginError, Result};
use parking_lot::RwLock;
use std::collections::HashMap;
use std::sync::Arc;

/// Plugin context provides safe access to K_OS APIs
///
/// The context acts as a sandbox, controlling what resources and APIs
/// plugins can access. It also tracks resource usage and enforces limits.
///
/// # Example
///
/// ```no_run
/// use k_os_plugin::PluginContext;
///
/// let mut context = PluginContext::new();
///
/// // Register a capability
/// context.register_capability("mesh_processing");
///
/// // Check if plugin has access
/// assert!(context.has_capability("mesh_processing"));
/// ```
pub struct PluginContext {
    /// Capabilities granted to the plugin
    capabilities: Arc<RwLock<HashMap<String, bool>>>,

    /// Restricted resources that plugins cannot access
    restricted_resources: Arc<RwLock<Vec<String>>>,

    /// Custom data storage for plugin-specific data
    data: Arc<RwLock<HashMap<String, serde_json::Value>>>,

    /// Plugin name (for logging and tracking)
    plugin_name: String,
}

impl PluginContext {
    /// Create a new plugin context
    pub fn new() -> Self {
        Self {
            capabilities: Arc::new(RwLock::new(HashMap::new())),
            restricted_resources: Arc::new(RwLock::new(Vec::new())),
            data: Arc::new(RwLock::new(HashMap::new())),
            plugin_name: String::new(),
        }
    }

    /// Create a new plugin context with a name
    pub fn with_name(plugin_name: impl Into<String>) -> Self {
        Self {
            capabilities: Arc::new(RwLock::new(HashMap::new())),
            restricted_resources: Arc::new(RwLock::new(Vec::new())),
            data: Arc::new(RwLock::new(HashMap::new())),
            plugin_name: plugin_name.into(),
        }
    }

    /// Get the plugin name
    pub fn plugin_name(&self) -> &str {
        &self.plugin_name
    }

    /// Register a capability for the plugin
    ///
    /// Capabilities control what APIs the plugin can access.
    /// Common capabilities:
    /// - "mesh_processing" - Access to mesh processing APIs
    /// - "gpu_compute" - Access to GPU compute pipelines
    /// - "file_io" - Access to file system operations
    /// - "network" - Access to network operations
    pub fn register_capability(&mut self, capability: impl Into<String>) {
        let mut caps = self.capabilities.write();
        caps.insert(capability.into(), true);
    }

    /// Check if the plugin has a specific capability
    pub fn has_capability(&self, capability: &str) -> bool {
        let caps = self.capabilities.read();
        caps.get(capability).copied().unwrap_or(false)
    }

    /// Require a capability, returning an error if not granted
    pub fn require_capability(&self, capability: &str) -> Result<()> {
        if self.has_capability(capability) {
            Ok(())
        } else {
            Err(PluginError::AccessDenied(format!(
                "Plugin '{}' does not have capability: {}",
                self.plugin_name, capability
            )))
        }
    }

    /// Add a restricted resource that the plugin cannot access
    pub fn add_restricted_resource(&mut self, resource: impl Into<String>) {
        let mut restricted = self.restricted_resources.write();
        restricted.push(resource.into());
    }

    /// Check if a resource is restricted
    pub fn is_resource_restricted(&self, resource: &str) -> bool {
        let restricted = self.restricted_resources.read();
        restricted.iter().any(|r| r == resource)
    }

    /// Check access to a resource, returning an error if restricted
    pub fn check_resource_access(&self, resource: &str) -> Result<()> {
        if self.is_resource_restricted(resource) {
            Err(PluginError::AccessDenied(format!(
                "Plugin '{}' cannot access restricted resource: {}",
                self.plugin_name, resource
            )))
        } else {
            Ok(())
        }
    }

    /// Store custom data in the context
    pub fn set_data(&mut self, key: impl Into<String>, value: serde_json::Value) {
        let mut data = self.data.write();
        data.insert(key.into(), value);
    }

    /// Retrieve custom data from the context
    pub fn get_data(&self, key: &str) -> Option<serde_json::Value> {
        let data = self.data.read();
        data.get(key).cloned()
    }

    /// Remove custom data from the context
    pub fn remove_data(&mut self, key: &str) -> Option<serde_json::Value> {
        let mut data = self.data.write();
        data.remove(key)
    }

    /// Clear all custom data
    pub fn clear_data(&mut self) {
        let mut data = self.data.write();
        data.clear();
    }

    /// Log a message from the plugin
    pub fn log(&self, level: LogLevel, message: &str) {
        match level {
            LogLevel::Trace => log::trace!("[Plugin:{}] {}", self.plugin_name, message),
            LogLevel::Debug => log::debug!("[Plugin:{}] {}", self.plugin_name, message),
            LogLevel::Info => log::info!("[Plugin:{}] {}", self.plugin_name, message),
            LogLevel::Warn => log::warn!("[Plugin:{}] {}", self.plugin_name, message),
            LogLevel::Error => log::error!("[Plugin:{}] {}", self.plugin_name, message),
        }
    }
}

impl Default for PluginContext {
    fn default() -> Self {
        Self::new()
    }
}

/// Log levels for plugin logging
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LogLevel {
    Trace,
    Debug,
    Info,
    Warn,
    Error,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_capabilities() {
        let mut context = PluginContext::new();

        assert!(!context.has_capability("mesh_processing"));

        context.register_capability("mesh_processing");
        assert!(context.has_capability("mesh_processing"));

        assert!(context.require_capability("mesh_processing").is_ok());
        assert!(context.require_capability("gpu_compute").is_err());
    }

    #[test]
    fn test_restricted_resources() {
        let mut context = PluginContext::new();

        assert!(!context.is_resource_restricted("/system/config"));

        context.add_restricted_resource("/system/config");
        assert!(context.is_resource_restricted("/system/config"));

        assert!(context.check_resource_access("/user/data").is_ok());
        assert!(context.check_resource_access("/system/config").is_err());
    }

    #[test]
    fn test_custom_data() {
        let mut context = PluginContext::new();

        context.set_data("key1", serde_json::json!("value1"));
        assert_eq!(context.get_data("key1"), Some(serde_json::json!("value1")));

        context.remove_data("key1");
        assert_eq!(context.get_data("key1"), None);
    }
}
