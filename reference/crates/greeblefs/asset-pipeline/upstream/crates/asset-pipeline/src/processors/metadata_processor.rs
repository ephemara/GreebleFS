//! Metadata extraction processor

use crate::asset::{Asset, AssetData, AssetType};
use crate::error::Result;
use crate::pipeline::AssetProcessor;

/// Processor that extracts and adds metadata to assets
#[derive(Clone)]
pub struct MetadataProcessor;

impl MetadataProcessor {
    pub fn new() -> Self {
        Self
    }

    fn extract_mesh_metadata(&self, asset: &mut Asset) {
        if let AssetData::Mesh(mesh) = &asset.data {
            let vertex_count = mesh.positions.len() / 3;
            let triangle_count = mesh.indices.as_ref().map(|i| i.len() / 3).unwrap_or(0);
            let has_normals = mesh.normals.is_some();
            let has_uvs = mesh.uvs.is_some();
            let has_tangents = mesh.tangents.is_some();
            let has_colors = mesh.colors.is_some();

            // Calculate bounding box
            let (bounds_min, bounds_max, bounds_size) = if !mesh.positions.is_empty() {
                let mut min = [f32::MAX, f32::MAX, f32::MAX];
                let mut max = [f32::MIN, f32::MIN, f32::MIN];

                for i in (0..mesh.positions.len()).step_by(3) {
                    for j in 0..3 {
                        min[j] = min[j].min(mesh.positions[i + j]);
                        max[j] = max[j].max(mesh.positions[i + j]);
                    }
                }

                let size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
                (Some(min), Some(max), Some(size))
            } else {
                (None, None, None)
            };

            // Now add all metadata (no more borrows of mesh)
            asset.add_metadata("vertex_count".to_string(), vertex_count.to_string());
            asset.add_metadata("triangle_count".to_string(), triangle_count.to_string());
            asset.add_metadata("has_normals".to_string(), has_normals.to_string());
            asset.add_metadata("has_uvs".to_string(), has_uvs.to_string());
            asset.add_metadata("has_tangents".to_string(), has_tangents.to_string());
            asset.add_metadata("has_colors".to_string(), has_colors.to_string());

            if let Some(min) = bounds_min {
                asset.add_metadata(
                    "bounds_min".to_string(),
                    format!("{},{},{}", min[0], min[1], min[2]),
                );
            }
            if let Some(max) = bounds_max {
                asset.add_metadata(
                    "bounds_max".to_string(),
                    format!("{},{},{}", max[0], max[1], max[2]),
                );
            }
            if let Some(size) = bounds_size {
                asset.add_metadata(
                    "bounds_size".to_string(),
                    format!("{},{},{}", size[0], size[1], size[2]),
                );
            }
        }
    }

    fn extract_texture_metadata(&self, asset: &mut Asset) {
        if let AssetData::Texture(texture) = &asset.data {
            let width = texture.width;
            let height = texture.height;
            let format = format!("{:?}", texture.format);
            let mip_levels = texture.mip_levels;
            let aspect_ratio = width as f32 / height as f32;
            let memory_size = texture.data.len();
            let memory_size_mb = memory_size as f32 / (1024.0 * 1024.0);

            // Now add all metadata
            asset.add_metadata("width".to_string(), width.to_string());
            asset.add_metadata("height".to_string(), height.to_string());
            asset.add_metadata("format".to_string(), format);
            asset.add_metadata("mip_levels".to_string(), mip_levels.to_string());
            asset.add_metadata("aspect_ratio".to_string(), format!("{:.3}", aspect_ratio));
            asset.add_metadata("memory_size_bytes".to_string(), memory_size.to_string());
            asset.add_metadata(
                "memory_size_mb".to_string(),
                format!("{:.2}", memory_size_mb),
            );
        }
    }

    fn extract_scene_metadata(&self, asset: &mut Asset) {
        if let AssetData::Scene(scene) = &asset.data {
            let scene_name = scene.name.clone();
            let mesh_count = scene.meshes.len();
            let material_count = scene.materials.len();
            let node_count = scene.nodes.len();

            // Count total vertices across all meshes
            let total_vertices: usize = scene.meshes.iter().map(|m| m.positions.len() / 3).sum();

            // Now add all metadata
            asset.add_metadata("scene_name".to_string(), scene_name);
            asset.add_metadata("mesh_count".to_string(), mesh_count.to_string());
            asset.add_metadata("material_count".to_string(), material_count.to_string());
            asset.add_metadata("node_count".to_string(), node_count.to_string());
            asset.add_metadata("total_vertices".to_string(), total_vertices.to_string());
        }
    }
}

impl AssetProcessor for MetadataProcessor {
    fn process(&self, asset: &mut Asset) -> Result<()> {
        match asset.asset_type {
            AssetType::Mesh => self.extract_mesh_metadata(asset),
            AssetType::Texture => self.extract_texture_metadata(asset),
            AssetType::Scene => self.extract_scene_metadata(asset),
            _ => {}
        }

        Ok(())
    }

    fn name(&self) -> &str {
        "MetadataProcessor"
    }

    fn should_process(&self, _asset: &Asset) -> bool {
        true // Always extract metadata
    }
}

impl Default for MetadataProcessor {
    fn default() -> Self {
        Self::new()
    }
}
