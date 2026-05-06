//! Thumbnail generation processor

use crate::asset::{Asset, AssetData, AssetType};
use crate::error::{AssetError, Result};
use crate::pipeline::AssetProcessor;
use image::{ImageBuffer, Rgba, RgbaImage};
use std::path::PathBuf;

/// Processor that generates thumbnails for assets
#[derive(Clone)]
pub struct ThumbnailProcessor {
    thumbnail_dir: PathBuf,
    thumbnail_size: u32,
}

impl ThumbnailProcessor {
    pub fn new(thumbnail_dir: PathBuf, thumbnail_size: u32) -> Self {
        // Create thumbnail directory if it doesn't exist
        if !thumbnail_dir.exists() {
            let _ = std::fs::create_dir_all(&thumbnail_dir);
        }

        Self {
            thumbnail_dir,
            thumbnail_size,
        }
    }

    fn generate_texture_thumbnail(&self, asset: &mut Asset) -> Result<()> {
        if let AssetData::Texture(texture) = &asset.data {
            // Create image from texture data
            let img = ImageBuffer::<Rgba<u8>, _>::from_raw(
                texture.width,
                texture.height,
                texture.data.clone(),
            )
            .ok_or_else(|| {
                AssetError::ThumbnailFailed("Failed to create image from texture data".to_string())
            })?;

            // Resize to thumbnail size
            let thumbnail = image::imageops::resize(
                &img,
                self.thumbnail_size,
                self.thumbnail_size,
                image::imageops::FilterType::Lanczos3,
            );

            // Save thumbnail
            let thumbnail_path = self.thumbnail_dir.join(format!("{}.png", asset.id));
            thumbnail.save(&thumbnail_path)?;

            asset.thumbnail = Some(thumbnail_path);
            log::debug!(
                "Generated thumbnail for texture: {}",
                asset.source_path.display()
            );
        }

        Ok(())
    }

    fn generate_mesh_thumbnail(&self, asset: &mut Asset) -> Result<()> {
        // For meshes, we'd need to render them to generate a thumbnail
        // This would require a GPU context and is more complex
        // For now, generate a placeholder thumbnail

        let thumbnail = self.create_placeholder_thumbnail("MESH");
        let thumbnail_path = self.thumbnail_dir.join(format!("{}.png", asset.id));
        thumbnail.save(&thumbnail_path)?;

        asset.thumbnail = Some(thumbnail_path);
        log::debug!(
            "Generated placeholder thumbnail for mesh: {}",
            asset.source_path.display()
        );

        Ok(())
    }

    fn generate_scene_thumbnail(&self, asset: &mut Asset) -> Result<()> {
        // Similar to mesh, would need rendering
        let thumbnail = self.create_placeholder_thumbnail("SCENE");
        let thumbnail_path = self.thumbnail_dir.join(format!("{}.png", asset.id));
        thumbnail.save(&thumbnail_path)?;

        asset.thumbnail = Some(thumbnail_path);
        log::debug!(
            "Generated placeholder thumbnail for scene: {}",
            asset.source_path.display()
        );

        Ok(())
    }

    fn create_placeholder_thumbnail(&self, _text: &str) -> RgbaImage {
        let mut img = RgbaImage::new(self.thumbnail_size, self.thumbnail_size);

        // Fill with gradient
        for y in 0..self.thumbnail_size {
            for x in 0..self.thumbnail_size {
                let r = (x as f32 / self.thumbnail_size as f32 * 100.0) as u8;
                let g = (y as f32 / self.thumbnail_size as f32 * 100.0) as u8;
                let b = 150;
                img.put_pixel(x, y, Rgba([r, g, b, 255]));
            }
        }

        // TODO: Add text rendering using imageproc or similar
        // For now, just return the gradient

        img
    }
}

impl AssetProcessor for ThumbnailProcessor {
    fn process(&self, asset: &mut Asset) -> Result<()> {
        match asset.asset_type {
            AssetType::Texture => self.generate_texture_thumbnail(asset),
            AssetType::Mesh => self.generate_mesh_thumbnail(asset),
            AssetType::Scene => self.generate_scene_thumbnail(asset),
            _ => Ok(()),
        }
    }

    fn name(&self) -> &str {
        "ThumbnailProcessor"
    }

    fn should_process(&self, asset: &Asset) -> bool {
        // Only generate thumbnails for visual assets
        matches!(
            asset.asset_type,
            AssetType::Texture | AssetType::Mesh | AssetType::Scene
        )
    }
}
