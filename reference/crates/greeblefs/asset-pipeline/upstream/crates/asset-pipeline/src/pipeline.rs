//! Core asset pipeline with extensible importers/exporters/processors

use crate::asset::Asset;
use crate::cache::AssetCache;
use crate::error::{AssetError, Result};
use crate::hash::hash_file;
use parking_lot::RwLock;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;

/// Asset importer trait
pub trait AssetImporter: Send + Sync {
    /// Get supported file extensions (e.g., ["gltf", "glb"])
    fn supported_extensions(&self) -> Vec<&str>;

    /// Import asset from file
    fn import(&self, path: &Path) -> Result<Asset>;

    /// Get importer name for logging
    fn name(&self) -> &str;
}

/// Asset exporter trait
pub trait AssetExporter: Send + Sync {
    /// Get supported export formats (e.g., ["gltf", "obj"])
    fn supported_formats(&self) -> Vec<&str>;

    /// Export asset to file
    fn export(&self, asset: &Asset, path: &Path) -> Result<()>;

    /// Get exporter name for logging
    fn name(&self) -> &str;
}

/// Asset processor trait for processing pipeline
pub trait AssetProcessor: Send + Sync {
    /// Process asset (modify in-place)
    fn process(&self, asset: &mut Asset) -> Result<()>;

    /// Get processor name for logging
    fn name(&self) -> &str;

    /// Check if this processor should run for the given asset
    fn should_process(&self, asset: &Asset) -> bool;
}

/// Main asset pipeline
pub struct AssetPipeline {
    cache: Arc<AssetCache>,
    importers: RwLock<HashMap<String, Arc<dyn AssetImporter>>>,
    exporters: RwLock<HashMap<String, Arc<dyn AssetExporter>>>,
    processors: RwLock<Vec<Arc<dyn AssetProcessor>>>,
}

impl AssetPipeline {
    /// Create a new asset pipeline
    pub fn new(cache_dir: PathBuf) -> Result<Self> {
        let cache = Arc::new(AssetCache::new(cache_dir)?);

        Ok(Self {
            cache,
            importers: RwLock::new(HashMap::new()),
            exporters: RwLock::new(HashMap::new()),
            processors: RwLock::new(Vec::new()),
        })
    }

    /// Register an asset importer
    pub fn register_importer(&self, importer: Arc<dyn AssetImporter>) {
        let mut importers = self.importers.write();
        for ext in importer.supported_extensions() {
            log::info!("Registered importer '{}' for .{}", importer.name(), ext);
            importers.insert(ext.to_lowercase(), Arc::clone(&importer));
        }
    }

    /// Register an asset exporter
    pub fn register_exporter(&self, exporter: Arc<dyn AssetExporter>) {
        let mut exporters = self.exporters.write();
        for format in exporter.supported_formats() {
            log::info!("Registered exporter '{}' for .{}", exporter.name(), format);
            exporters.insert(format.to_lowercase(), Arc::clone(&exporter));
        }
    }

    /// Register an asset processor
    pub fn register_processor(&self, processor: Arc<dyn AssetProcessor>) {
        log::info!("Registered processor '{}'", processor.name());
        self.processors.write().push(processor);
    }

    /// Import asset from file
    pub fn import(&self, path: &Path) -> Result<Asset> {
        // Check if file exists
        if !path.exists() {
            return Err(AssetError::FileNotFound(path.to_path_buf()));
        }

        // Check cache first
        if let Some(cached_asset) = self.cache.get(path)? {
            log::info!("Using cached asset: {}", path.display());
            return Ok(cached_asset);
        }

        // Detect format by extension
        let extension = path
            .extension()
            .and_then(|e| e.to_str())
            .ok_or_else(|| AssetError::UnsupportedFormat {
                extension: "none".to_string(),
                supported: self.list_supported_import_formats(),
            })?
            .to_lowercase();

        // Find importer
        let importer = {
            let importers = self.importers.read();
            importers.get(&extension).map(Arc::clone)
        };

        let importer = importer.ok_or_else(|| AssetError::UnsupportedFormat {
            extension: extension.clone(),
            supported: self.list_supported_import_formats(),
        })?;

        // Import asset
        log::info!("Importing {} using '{}'", path.display(), importer.name());
        let mut asset = importer
            .import(path)
            .map_err(|e| AssetError::ImportFailed {
                path: path.to_path_buf(),
                source: anyhow::anyhow!("{}", e),
            })?;

        // Set file hash as ID
        asset.id = hash_file(path)?;

        // Apply processors
        self.process(&mut asset)?;

        // Cache the asset
        self.cache.put(&asset)?;

        log::info!("Successfully imported: {}", path.display());
        Ok(asset)
    }

    /// Export asset to file
    pub fn export(&self, asset: &Asset, path: &Path, format: &str) -> Result<()> {
        let format = format.to_lowercase();

        // Find exporter
        let exporter = {
            let exporters = self.exporters.read();
            exporters.get(&format).map(Arc::clone)
        };

        let exporter = exporter.ok_or_else(|| AssetError::UnsupportedFormat {
            extension: format.clone(),
            supported: self.list_supported_export_formats(),
        })?;

        // Export asset
        log::info!(
            "Exporting to {} using '{}'",
            path.display(),
            exporter.name()
        );
        exporter
            .export(asset, path)
            .map_err(|e| AssetError::ExportFailed {
                path: path.to_path_buf(),
                source: anyhow::anyhow!("{}", e),
            })?;

        log::info!("Successfully exported: {}", path.display());
        Ok(())
    }

    /// Apply all registered processors to an asset
    pub fn process(&self, asset: &mut Asset) -> Result<()> {
        let processors = self.processors.read();

        for processor in processors.iter() {
            if processor.should_process(asset) {
                log::debug!("Applying processor '{}' to asset", processor.name());
                processor.process(asset).map_err(|e| {
                    AssetError::ProcessingFailed(format!("{}: {}", processor.name(), e))
                })?;
            }
        }

        Ok(())
    }

    /// Clear asset cache
    pub fn clear_cache(&self) -> Result<()> {
        self.cache.clear()
    }

    /// Get cache statistics
    pub fn cache_stats(&self) -> crate::cache::CacheStats {
        self.cache.stats()
    }

    fn list_supported_import_formats(&self) -> String {
        let importers = self.importers.read();
        let mut formats: Vec<_> = importers.keys().collect();
        formats.sort();
        formats
            .iter()
            .map(|s| s.as_str())
            .collect::<Vec<_>>()
            .join(", ")
    }

    fn list_supported_export_formats(&self) -> String {
        let exporters = self.exporters.read();
        let mut formats: Vec<_> = exporters.keys().collect();
        formats.sort();
        formats
            .iter()
            .map(|s| s.as_str())
            .collect::<Vec<_>>()
            .join(", ")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::asset::{AssetData, AssetType};
    use tempfile::TempDir;

    #[derive(Clone)]
    struct TestImporter;

    impl AssetImporter for TestImporter {
        fn supported_extensions(&self) -> Vec<&str> {
            vec!["test"]
        }

        fn import(&self, path: &Path) -> Result<Asset> {
            Ok(Asset::new(
                "test_id".to_string(),
                AssetType::Mesh,
                path.to_path_buf(),
                AssetData::Raw(vec![1, 2, 3]),
            ))
        }

        fn name(&self) -> &str {
            "TestImporter"
        }
    }

    #[test]
    fn test_register_importer() {
        let temp_dir = TempDir::new().unwrap();
        let pipeline = AssetPipeline::new(temp_dir.path().to_path_buf()).unwrap();

        pipeline.register_importer(Arc::new(TestImporter));

        let importers = pipeline.importers.read();
        assert!(importers.contains_key("test"));
    }
}
