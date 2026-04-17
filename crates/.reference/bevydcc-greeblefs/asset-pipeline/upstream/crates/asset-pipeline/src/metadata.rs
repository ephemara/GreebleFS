//! Metadata utilities and types

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Asset metadata container
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetMetadata {
    /// Key-value metadata
    pub data: HashMap<String, String>,
}

impl AssetMetadata {
    pub fn new() -> Self {
        Self {
            data: HashMap::new(),
        }
    }

    pub fn insert(&mut self, key: String, value: String) {
        self.data.insert(key, value);
    }

    pub fn get(&self, key: &str) -> Option<&String> {
        self.data.get(key)
    }
}

impl Default for AssetMetadata {
    fn default() -> Self {
        Self::new()
    }
}
