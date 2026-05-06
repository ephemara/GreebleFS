# k-os-asset-pipeline

Unified asset import/export/processing pipeline for K_OS DCC Suite.

## Features

- **Format Detection**: Automatic format detection by file extension
- **Extensible Architecture**: Trait-based importers, exporters, and processors
- **File Hash Caching**: BLAKE3-based caching with automatic invalidation
- **Thumbnail Generation**: Automatic thumbnail generation for visual assets
- **Metadata Extraction**: Comprehensive metadata extraction (vertex counts, bounds, etc.)
- **Validation**: Asset data integrity validation
- **Thread-Safe**: Designed for concurrent access with `parking_lot` locks
- **Data-Driven**: Registry-based format support

## Supported Formats

### Import
- **Meshes**: GLTF, GLB, OBJ
- **Textures**: PNG, JPEG, TGA, TIFF, BMP, WebP

### Export
- **Meshes**: OBJ
- **Textures**: PNG, JPEG, TGA, TIFF, BMP

### Future Support (via assimp-rs)
- FBX, USD, Alembic, Collada, 3DS, and 40+ more formats

## Usage

```rust
use k_os_asset_pipeline::{
    AssetPipeline,
    importers::{GltfImporter, ObjImporter, ImageImporter},
    exporters::{ObjExporter, ImageExporter},
    processors::{MetadataProcessor, ThumbnailProcessor, ValidationProcessor},
};
use std::path::PathBuf;

// Create pipeline
let cache_dir = PathBuf::from("./cache/assets");
let pipeline = AssetPipeline::new(cache_dir)?;

// Register importers
pipeline.register_importer(Box::new(GltfImporter::new()));
pipeline.register_importer(Box::new(ObjImporter::new()));
pipeline.register_importer(Box::new(ImageImporter::new()));

// Register exporters
pipeline.register_exporter(Box::new(ObjExporter::new()));
pipeline.register_exporter(Box::new(ImageExporter::new()));

// Register processors
pipeline.register_processor(Box::new(ValidationProcessor::new()));
pipeline.register_processor(Box::new(MetadataProcessor::new()));
pipeline.register_processor(Box::new(ThumbnailProcessor::new(
    PathBuf::from("./cache/thumbnails"),
    256, // thumbnail size
)));

// Import asset
let asset = pipeline.import(&PathBuf::from("model.gltf"))?;

// Access metadata
println!("Vertex count: {}", asset.get_metadata("vertex_count").unwrap());
println!("Triangle count: {}", asset.get_metadata("triangle_count").unwrap());

// Export to different format
pipeline.export(&asset, &PathBuf::from("model.obj"), "obj")?;
```

## Architecture

### Core Traits

#### AssetImporter
```rust
pub trait AssetImporter: Send + Sync {
    fn supported_extensions(&self) -> Vec<&str>;
    fn import(&self, path: &Path) -> Result<Asset>;
    fn name(&self) -> &str;
}
```

#### AssetExporter
```rust
pub trait AssetExporter: Send + Sync {
    fn supported_formats(&self) -> Vec<&str>;
    fn export(&self, asset: &Asset, path: &Path) -> Result<()>;
    fn name(&self) -> &str;
}
```

#### AssetProcessor
```rust
pub trait AssetProcessor: Send + Sync {
    fn process(&self, asset: &mut Asset) -> Result<()>;
    fn name(&self) -> &str;
    fn should_process(&self, asset: &Asset) -> bool;
}
```

### Asset Types

- **Mesh**: 3D geometry with positions, normals, UVs, tangents, colors, indices
- **Texture**: Image data with width, height, format, mip levels
- **Material**: PBR material with base color, metallic, roughness, textures
- **Animation**: Keyframe animation with channels (translation, rotation, scale)
- **Scene**: Hierarchical scene with nodes, meshes, materials

## Caching

The pipeline uses BLAKE3 file hashing for cache validation:

1. When importing, compute file hash
2. Check if cached asset exists with same hash
3. If yes, return cached asset (instant)
4. If no, import, process, and cache

Cache is automatically invalidated when source files change.

## Processing Pipeline

Assets go through registered processors in order:

1. **ValidationProcessor**: Validates data integrity
2. **MetadataProcessor**: Extracts metadata (vertex counts, bounds, etc.)
3. **ThumbnailProcessor**: Generates thumbnails for visual assets

Custom processors can be added via `register_processor()`.

## Performance

- **Parallel Import**: Use Rayon for batch imports
- **Memory Efficient**: Streaming file I/O with 8KB buffers
- **Fast Hashing**: BLAKE3 is faster than MD5/SHA256
- **Smart Caching**: Two-tier cache (memory + disk)

## Extending

### Custom Importer

```rust
#[derive(Clone)]
struct MyImporter;

impl AssetImporter for MyImporter {
    fn supported_extensions(&self) -> Vec<&str> {
        vec!["myformat"]
    }

    fn import(&self, path: &Path) -> Result<Asset> {
        // Your import logic
        Ok(asset)
    }

    fn name(&self) -> &str {
        "MyImporter"
    }
}

pipeline.register_importer(Box::new(MyImporter));
```

### Custom Processor

```rust
#[derive(Clone)]
struct MyProcessor;

impl AssetProcessor for MyProcessor {
    fn process(&self, asset: &mut Asset) -> Result<()> {
        // Your processing logic
        Ok(())
    }

    fn name(&self) -> &str {
        "MyProcessor"
    }

    fn should_process(&self, asset: &Asset) -> bool {
        asset.asset_type == AssetType::Mesh
    }
}

pipeline.register_processor(Box::new(MyProcessor));
```

## Future Enhancements

- [ ] Multi-format support via assimp-rs (FBX, USD, Alembic)
- [ ] GPU-accelerated thumbnail rendering for 3D assets
- [ ] LOD generation processor
- [ ] Texture compression processor (BC7, ASTC, ETC2)
- [ ] Mesh optimization processor (vertex cache, overdraw)
- [ ] Animation retargeting
- [ ] Material baking
- [ ] Batch processing with progress reporting
- [ ] Asset dependency tracking
- [ ] Hot-reload support

## Dependencies

- `gltf` - GLTF/GLB import
- `tobj` - OBJ import
- `image` - Image processing
- `blake3` - Fast file hashing
- `parking_lot` - Efficient locks
- `rayon` - Parallel processing
- `serde` - Serialization

## License

Part of K_OS DCC Suite
