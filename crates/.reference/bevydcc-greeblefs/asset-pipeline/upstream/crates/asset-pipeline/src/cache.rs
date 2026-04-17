//! Asset caching system with file hash validation

use crate::asset::Asset;
use crate::error::Result;
use crate::hash::hash_file;
use parking_lot::RwLock;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

/// Asset cache with file hash validation
pub struct AssetCache {
    cache_dir: PathBuf,
    /// In-memory cache: file_hash -> Asset
    memory_cache: RwLock<HashMap<String, Asset>>,
}

impl AssetCache {
    /// Create a new asset cache
    pub fn new(cache_dir: PathBuf) -> Result<Self> {
        // Create cache directory if it doesn't exist
        if !cache_dir.exists() {
            fs::create_dir_all(&cache_dir)?;
        }

        Ok(Self {
            cache_dir,
            memory_cache: RwLock::new(HashMap::new()),
        })
    }

    /// Get cached asset if file hasn't been modified
    pub fn get(&self, path: &Path) -> Result<Option<Asset>> {
        // Compute current file hash
        let current_hash = hash_file(path)?;

        // Check memory cache first
        {
            let cache = self.memory_cache.read();
            if let Some(asset) = cache.get(&current_hash) {
                log::debug!("Cache hit (memory): {}", path.display());
                return Ok(Some(asset.clone()));
            }
        }

        // Check disk cache
        let cache_path = self.get_cache_path(&current_hash);
        if cache_path.exists() {
            match self.load_from_disk(&cache_path) {
                Ok(asset) => {
                    log::debug!("Cache hit (disk): {}", path.display());
                    // Store in memory cache
                    self.memory_cache
                        .write()
                        .insert(current_hash, asset.clone());
                    Ok(Some(asset))
                }
                Err(e) => {
                    log::warn!("Failed to load cached asset: {}", e);
                    Ok(None)
                }
            }
        } else {
            log::debug!("Cache miss: {}", path.display());
            Ok(None)
        }
    }

    /// Store asset in cache
    pub fn put(&self, asset: &Asset) -> Result<()> {
        let hash = &asset.id;

        // Store in memory cache
        self.memory_cache
            .write()
            .insert(hash.clone(), asset.clone());

        // Store on disk
        let cache_path = self.get_cache_path(hash);
        self.save_to_disk(asset, &cache_path)?;

        log::debug!(
            "Cached asset: {} (hash: {})",
            asset.source_path.display(),
            hash
        );
        Ok(())
    }

    /// Clear all cached assets
    pub fn clear(&self) -> Result<()> {
        self.memory_cache.write().clear();

        if self.cache_dir.exists() {
            fs::remove_dir_all(&self.cache_dir)?;
            fs::create_dir_all(&self.cache_dir)?;
        }

        log::info!("Cache cleared");
        Ok(())
    }

    /// Get cache statistics
    pub fn stats(&self) -> CacheStats {
        let memory_count = self.memory_cache.read().len();
        let disk_count = fs::read_dir(&self.cache_dir)
            .map(|entries| entries.filter_map(|e| e.ok()).count())
            .unwrap_or(0);

        CacheStats {
            memory_entries: memory_count,
            disk_entries: disk_count,
        }
    }

    fn get_cache_path(&self, hash: &str) -> PathBuf {
        self.cache_dir.join(format!("{}.json", hash))
    }

    fn save_to_disk(&self, asset: &Asset, path: &Path) -> Result<()> {
        let json = serde_json::to_string_pretty(asset)?;
        fs::write(path, json)?;
        Ok(())
    }

    fn load_from_disk(&self, path: &Path) -> Result<Asset> {
        let json = fs::read_to_string(path)?;
        let asset = serde_json::from_str(&json)?;
        Ok(asset)
    }
}

/// Cache statistics
#[derive(Debug, Clone)]
pub struct CacheStats {
    pub memory_entries: usize,
    pub disk_entries: usize,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::asset::{AssetData, AssetType};
    use tempfile::TempDir;

    #[test]
    fn test_cache_put_get() {
        let temp_dir = TempDir::new().unwrap();
        let cache = AssetCache::new(temp_dir.path().to_path_buf()).unwrap();

        let asset = Asset::new(
            "test_hash".to_string(),
            AssetType::Mesh,
            PathBuf::from("test.obj"),
            AssetData::Raw(vec![1, 2, 3]),
        );

        cache.put(&asset).unwrap();

        // Memory cache should have it
        let cached = cache.memory_cache.read().get("test_hash").cloned();
        assert!(cached.is_some());
    }

    #[test]
    fn test_cache_clear() {
        let temp_dir = TempDir::new().unwrap();
        let cache = AssetCache::new(temp_dir.path().to_path_buf()).unwrap();

        let asset = Asset::new(
            "test_hash".to_string(),
            AssetType::Mesh,
            PathBuf::from("test.obj"),
            AssetData::Raw(vec![1, 2, 3]),
        );

        cache.put(&asset).unwrap();
        assert_eq!(cache.stats().memory_entries, 1);

        cache.clear().unwrap();
        assert_eq!(cache.stats().memory_entries, 0);
    }
}
