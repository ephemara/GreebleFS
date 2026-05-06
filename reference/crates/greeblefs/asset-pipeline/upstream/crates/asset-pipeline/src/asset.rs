//! Core asset types and data structures

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

/// Asset type classification
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum AssetType {
    /// 3D mesh asset
    Mesh,
    /// Texture/image asset
    Texture,
    /// Material asset
    Material,
    /// Animation asset
    Animation,
    /// Scene/hierarchy asset
    Scene,
    /// Unknown/custom asset type
    Unknown,
}

/// Core asset data structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Asset {
    /// Unique identifier (file hash)
    pub id: String,
    /// Asset type
    pub asset_type: AssetType,
    /// Original file path
    pub source_path: PathBuf,
    /// Asset data
    pub data: AssetData,
    /// Metadata
    pub metadata: HashMap<String, String>,
    /// Thumbnail path (if generated)
    pub thumbnail: Option<PathBuf>,
}

/// Asset data variants
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AssetData {
    /// Mesh data
    Mesh(MeshData),
    /// Texture data
    Texture(TextureData),
    /// Material data
    Material(MaterialData),
    /// Animation data
    Animation(AnimationData),
    /// Scene data
    Scene(SceneData),
    /// Raw binary data for unknown types
    Raw(Vec<u8>),
}

/// Mesh asset data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeshData {
    /// Vertex positions (x, y, z)
    pub positions: Vec<f32>,
    /// Vertex normals (x, y, z)
    pub normals: Option<Vec<f32>>,
    /// Vertex tangents (x, y, z, w)
    pub tangents: Option<Vec<f32>>,
    /// UV coordinates (u, v)
    pub uvs: Option<Vec<f32>>,
    /// Vertex colors (r, g, b, a)
    pub colors: Option<Vec<f32>>,
    /// Triangle indices
    pub indices: Option<Vec<u32>>,
    /// Submesh ranges (start_index, count, material_index)
    pub submeshes: Vec<(u32, u32, Option<usize>)>,
}

/// Texture asset data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextureData {
    /// Image width
    pub width: u32,
    /// Image height
    pub height: u32,
    /// Pixel format
    pub format: TextureFormat,
    /// Raw pixel data
    #[serde(skip)]
    pub data: Vec<u8>,
    /// Mipmap levels
    pub mip_levels: u32,
}

/// Texture format
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TextureFormat {
    R8,
    Rg8,
    Rgb8,
    Rgba8,
    R16,
    Rg16,
    Rgb16,
    Rgba16,
    R32F,
    Rg32F,
    Rgb32F,
    Rgba32F,
}

/// Material asset data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaterialData {
    /// Material name
    pub name: String,
    /// Base color
    pub base_color: [f32; 4],
    /// Metallic factor
    pub metallic: f32,
    /// Roughness factor
    pub roughness: f32,
    /// Emissive color
    pub emissive: [f32; 3],
    /// Texture references
    pub textures: HashMap<String, PathBuf>,
}

/// Animation asset data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnimationData {
    /// Animation name
    pub name: String,
    /// Duration in seconds
    pub duration: f32,
    /// Animation channels
    pub channels: Vec<AnimationChannel>,
}

/// Animation channel
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnimationChannel {
    /// Target node/bone name
    pub target: String,
    /// Channel type
    pub channel_type: AnimationChannelType,
    /// Keyframe times
    pub times: Vec<f32>,
    /// Keyframe values
    pub values: Vec<f32>,
}

/// Animation channel type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AnimationChannelType {
    Translation,
    Rotation,
    Scale,
}

/// Scene asset data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SceneData {
    /// Scene name
    pub name: String,
    /// Root nodes
    pub nodes: Vec<SceneNode>,
    /// Meshes referenced by nodes
    pub meshes: Vec<MeshData>,
    /// Materials referenced by meshes
    pub materials: Vec<MaterialData>,
}

/// Scene node
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SceneNode {
    /// Node name
    pub name: String,
    /// Local transform (4x4 matrix in column-major order)
    pub transform: [f32; 16],
    /// Mesh index (if this node has a mesh)
    pub mesh_index: Option<usize>,
    /// Child nodes
    pub children: Vec<SceneNode>,
}

impl Asset {
    /// Create a new asset
    pub fn new(id: String, asset_type: AssetType, source_path: PathBuf, data: AssetData) -> Self {
        Self {
            id,
            asset_type,
            source_path,
            data,
            metadata: HashMap::new(),
            thumbnail: None,
        }
    }

    /// Add metadata entry
    pub fn add_metadata(&mut self, key: String, value: String) {
        self.metadata.insert(key, value);
    }

    /// Get metadata entry
    pub fn get_metadata(&self, key: &str) -> Option<&String> {
        self.metadata.get(key)
    }
}
