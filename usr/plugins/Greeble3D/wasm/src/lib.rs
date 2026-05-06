use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use noise::{NoiseFn, Simplex};
use std::collections::{HashMap, HashSet};

#[wasm_bindgen]
pub struct NoiseGenerator {
    simplex: Simplex,
}

#[wasm_bindgen]
impl NoiseGenerator {
    pub fn new() -> NoiseGenerator {
        NoiseGenerator {
            simplex: Simplex::new(0), // Seed 0
        }
    }

    pub fn fill_noise_buffer(&self, positions: &[f32], output: &mut [f32], scale: f32, time: f32) {
        let count = positions.len() / 3;
        for i in 0..count {
            let x = positions[i * 3] * scale;
            let y = positions[i * 3 + 1] * scale;
            let z = positions[i * 3 + 2] * scale + time;
            
            // 3D Noise
            let value = self.simplex.get([x as f64, y as f64, z as f64]);
            output[i] = value as f32;
        }
    }
}

#[wasm_bindgen]
pub fn deform_mesh_wasm(
    positions: &mut [f32],
    cx: f32, cy: f32, cz: f32,
    size_y: f32,
    taper: f32,
    twist: f32,
    bend: f32,
    noise: f32
) {
    let count = positions.len() / 3;
    let simplex = Simplex::new(0);
    
    // Pre-calculate min_y for normalization
    let min_y = cy - size_y * 0.5;

    for i in 0..count {
        let idx = i * 3;
        let mut x = positions[idx];
        let mut y = positions[idx + 1];
        let mut z = positions[idx + 2];

        // --- NOISE (Applied FIRST or LAST? JS did it last, but let's do it first to mimic "base" displacement) ---
        // Actually JS loop order was: Inflate, Taper, Twist, Bend, Spherize, Noise.
        // But in JS loop, if WASM ran, T/T/B are skipped.
        // So WASM should do T/T/B. 
        // If I move Noise into WASM, I should probably do it in the same pass.
        // ZBrush noise is usually a surface detail, so applying it after macro deformation (Twist/Bend) makes sense?
        // OR before? If I twist a noisy mesh, the noise twists. That is usually desired.
        // So Noise -> Taper -> Twist -> Bend.
        
        if noise != 0.0 {
            // Frequency scaler - hardcoded for now, could be a param later
            let freq = 0.5; 
            let amp = noise * 0.1;
            
            // 3D Simplex Noise for organic look
            let nx = simplex.get([x as f64 * freq, y as f64 * freq, z as f64 * freq]) as f32;
            // Offset lookups for other axes to avoid diagonal bias
            let ny = simplex.get([x as f64 * freq + 100.0, y as f64 * freq, z as f64 * freq]) as f32;
            let nz = simplex.get([x as f64 * freq, y as f64 * freq, z as f64 * freq + 100.0]) as f32;
            
            x += nx * amp;
            y += ny * amp;
            z += nz * amp;
        }

        // --- TAPER ---
        if taper != 0.0 {
            let ny = if size_y > 0.0001 { (y - min_y) / size_y } else { 0.5 };
            let factor = 1.0 - (ny * taper);
            x = (x - cx) * factor + cx;
            z = (z - cz) * factor + cz;
        }

        // --- TWIST ---
        if twist != 0.0 {
            let centered_y = y - cy;
            let angle = centered_y * twist;
            let s = angle.sin();
            let c = angle.cos();
            let local_x = x - cx;
            let local_z = z - cz;
            x = local_x * c - local_z * s + cx;
            z = local_x * s + local_z * c + cz;
        }

        // --- BEND ---
        if bend != 0.0 {
             let ny = if size_y > 0.0001 { (y - min_y) / size_y } else { 0.5 };
             let bend_factor = (ny - 0.5) * 2.0;
             let offset = (bend_factor * bend_factor) * bend;
             x += offset;
        }

        positions[idx] = x;
        positions[idx + 1] = y;
        positions[idx + 2] = z;
    }
}

// ============================================================================
// GEOMETRY SUBDIVISION (Phase 2)
// ============================================================================

#[derive(Serialize)]
pub struct GreebleResult {
    pub positions: Vec<f32>,
    pub indices: Vec<u32>,
    pub normals: Vec<f32>,
    pub uvs: Vec<f32>,
    pub greeble_count: u32,
}

#[derive(Serialize, Deserialize)]
pub struct SymmetryParams {
    pub tolerance: f32,
    pub x: bool, pub y: bool, pub z: bool,
}

#[derive(Serialize, Deserialize)]
pub struct SubdivideParams {
    pub point_x: f32, pub point_y: f32, pub point_z: f32,
    pub radius: f32,
    pub max_edge_length: f32,
}

#[derive(Clone, Copy, Debug)]
struct Vec3 {
    x: f32, y: f32, z: f32,
}

impl Vec3 {
    fn new(x: f32, y: f32, z: f32) -> Self { Self { x, y, z } }
    
    fn distance_to(&self, other: &Vec3) -> f32 {
        let dx = self.x - other.x;
        let dy = self.y - other.y;
        let dz = self.z - other.z;
        (dx*dx + dy*dy + dz*dz).sqrt()
    }
    
    fn add(&self, other: &Vec3) -> Self {
        Self { x: self.x + other.x, y: self.y + other.y, z: self.z + other.z }
    }
    
    fn multiply_scalar(&self, s: f32) -> Self {
        Self { x: self.x * s, y: self.y * s, z: self.z * s }
    }
    
    fn length(&self) -> f32 {
        (self.x*self.x + self.y*self.y + self.z*self.z).sqrt()
    }
    
    fn normalize(&self) -> Self {
        let l = self.length();
        if l == 0.0 { *self } else { self.multiply_scalar(1.0/l) }
    }
}

struct SpatialGrid {
    cell_size: f32,
    cells: HashMap<(i32, i32, i32), Vec<usize>>,
}

impl SpatialGrid {
    fn new(cell_size: f32) -> Self {
        Self {
            cell_size,
            cells: HashMap::new(),
        }
    }

    fn insert(&mut self, idx: usize, pos: &Vec3) {
        let cell = (
            (pos.x / self.cell_size).floor() as i32,
            (pos.y / self.cell_size).floor() as i32,
            (pos.z / self.cell_size).floor() as i32,
        );
        self.cells.entry(cell).or_default().push(idx);
    }

    fn find_closest(&self, pos: &Vec3, tolerance: f32, vertices: &[Vec3]) -> Option<usize> {
        let cx = (pos.x / self.cell_size).floor() as i32;
        let cy = (pos.y / self.cell_size).floor() as i32;
        let cz = (pos.z / self.cell_size).floor() as i32;
        
        let mut closest_idx = None;
        let mut min_dist_sq = tolerance * tolerance;

        // Check 3x3x3 neighborhood
        for dx in -1..=1 {
            for dy in -1..=1 {
                for dz in -1..=1 {
                    if let Some(indices) = self.cells.get(&(cx + dx, cy + dy, cz + dz)) {
                        for &idx in indices {
                            let dist_sq = (vertices[idx].x - pos.x).powi(2) +
                                          (vertices[idx].y - pos.y).powi(2) +
                                          (vertices[idx].z - pos.z).powi(2);
                            
                            if dist_sq < min_dist_sq {
                                min_dist_sq = dist_sq;
                                closest_idx = Some(idx);
                            }
                        }
                    }
                }
            }
        }
        closest_idx
    }
}

#[wasm_bindgen]
pub fn ensure_symmetry_wasm(
    positions_in: &[f32],
    indices_in: &[u32],
    params: JsValue
) -> Result<JsValue, JsValue> {
    let params: SymmetryParams = serde_wasm_bindgen::from_value(params)
        .map_err(|e| JsValue::from_str(&format!("Invalid params: {}", e)))?;
        
    if !params.x && !params.y && !params.z {
         // Return original if no symmetry
         let result = GreebleResult {
            positions: positions_in.to_vec(),
            indices: indices_in.to_vec(),
            normals: Vec::new(),
            uvs: Vec::new(),
            greeble_count: 0,
        };
        return serde_wasm_bindgen::to_value(&result)
            .map_err(|e| JsValue::from_str(&format!("{}", e)));
    }

    // Parse vertices
    let vertex_count = positions_in.len() / 3;
    let mut vertices: Vec<Vec3> = Vec::with_capacity(vertex_count);
    for i in 0..vertex_count {
        vertices.push(Vec3::new(
            positions_in[i * 3],
            positions_in[i * 3 + 1],
            positions_in[i * 3 + 2]
        ));
    }

    // Build Spatial Grid
    // Cell size should be slightly larger than tolerance to ensure we catch things
    let grid_cell_size = params.tolerance * 2.0; 
    let mut grid = SpatialGrid::new(grid_cell_size);
    for (i, v) in vertices.iter().enumerate() {
        grid.insert(i, v);
    }

    let mut new_vertices = vertices.clone();
    let mut vertex_to_mirror: Vec<usize> = vec![0; vertex_count]; // Maps original idx -> mirror idx (which might be itself, existing, or new)
    
    // Check mirrors
    for i in 0..vertex_count {
        let v = &vertices[i];
        
        let mut mirror_pos = Vec3::new(v.x, v.y, v.z);
        if params.x { mirror_pos.x = -mirror_pos.x; }
        if params.y { mirror_pos.y = -mirror_pos.y; }
        if params.z { mirror_pos.z = -mirror_pos.z; }
        
        // Check if on plane
        let on_plane = (!params.x || v.x.abs() < params.tolerance) &&
                       (!params.y || v.y.abs() < params.tolerance) &&
                       (!params.z || v.z.abs() < params.tolerance);
                       
        if on_plane {
            vertex_to_mirror[i] = i;
            continue;
        }
        
        // Look for existing mirror
        // Note: In the JS code, it looked through ALL vertices (j > i).
        // Here, we look through ALL vertices using the grid.
        // We need to be careful: if we find a vertex that IS the mirror position, we use it.
        // The JS code: 
        // for j = i+1 .. vertices.length: if dist(mirrorPos, vertices[j]) < tol: found
        
        // Our grid contains all original vertices.
        if let Some(existing_idx) = grid.find_closest(&mirror_pos, params.tolerance, &vertices) {
            vertex_to_mirror[i] = existing_idx;
        } else {
            // No mirror found in original set. 
            // BUT wait, did we already create one? 
            // The JS code adds new vertices to `newVertices` array.
            // But here we are iterating through ORIGINAL vertices.
            // If I have vertex A at (1,0,0) and B at (-1,0,0).
            // i=A. Mirror is (-1,0,0). Grid finds B. vertex_to_mirror[A] = B.
            // i=B. Mirror is (1,0,0). Grid finds A. vertex_to_mirror[B] = A.
            
            // What if A is (1,0,0) and no (-1,0,0) exists?
            // i=A. Mirror (-1,0,0). Grid finds nothing.
            // We need to create (-1,0,0).
            // But we can't add to `grid` because `grid` only tracks original vertices?
            // Or should we?
            // The JS code: "If no mirror found... newVertices.push(mirrorPos)... vertexToMirror.set(i, newIndex); vertexToMirror.set(newIndex, i);"
            // The JS code sets the bidirectional mapping immediately.
            
            // We need to track created mirrors to avoid duplicating them?
            // Actually, since we iterate i=0..count, we only process original vertices.
            // If A needs a mirror A' and it doesn't exist, we create A'.
            // We don't visit A' in this loop because it's new.
            
            // We just need to make sure we don't create A' twice if multiple vertices map to it? 
            // Unlikely for symmetry unless vertices are duplicate.
            
            // So:
            let new_idx = new_vertices.len();
            new_vertices.push(mirror_pos);
            vertex_to_mirror[i] = new_idx;
            
            // We don't need to add to grid unless we want to support self-intersection of new geometry? 
            // No, the mirror is strictly defined by the operation.
        }
    }
    
    // Now rebuild indices
    // We start with original indices
    let mut new_indices = indices_in.to_vec();
    let mut processed_triangles: HashSet<String> = HashSet::new(); // Use string key "a-b-c" sorted
    
    // Populate processed with existing triangles
    let tri_count = indices_in.len() / 3;
    for i in 0..tri_count {
        let i0 = indices_in[i*3];
        let i1 = indices_in[i*3+1];
        let i2 = indices_in[i*3+2];
        let mut key = [i0, i1, i2];
        key.sort();
        processed_triangles.insert(format!("{}-{}-{}", key[0], key[1], key[2]));
    }
    
    // Add mirror triangles
    for i in 0..tri_count {
        let i0 = indices_in[i*3] as usize;
        let i1 = indices_in[i*3+1] as usize;
        let i2 = indices_in[i*3+2] as usize;
        
        let m0 = vertex_to_mirror[i0] as u32;
        let m1 = vertex_to_mirror[i1] as u32;
        let m2 = vertex_to_mirror[i2] as u32;
        
        let needs_mirror = (m0 as usize != i0) || (m1 as usize != i1) || (m2 as usize != i2);
        
        if needs_mirror {
            // Check if this mirror triangle already exists
            let mut key = [m0, m1, m2];
            key.sort();
            let key_str = format!("{}-{}-{}", key[0], key[1], key[2]);
            
            if !processed_triangles.contains(&key_str) {
                // Add with reversed winding (m0, m2, m1)
                new_indices.push(m0);
                new_indices.push(m2);
                new_indices.push(m1);
                processed_triangles.insert(key_str);
            }
        }
    }
    
    // Flatten positions
    let mut result_positions: Vec<f32> = Vec::with_capacity(new_vertices.len() * 3);
    for v in new_vertices {
        result_positions.push(v.x);
        result_positions.push(v.y);
        result_positions.push(v.z);
    }
    
    let result = GreebleResult {
        positions: result_positions,
        indices: new_indices,
        normals: Vec::new(),
        uvs: Vec::new(),
        greeble_count: 0,
    };
    
    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("{}", e)))
}

fn make_edge_key(i1: u32, i2: u32) -> (u32, u32) {
    if i1 < i2 { (i1, i2) } else { (i2, i1) }
}

#[wasm_bindgen]
pub fn subdivide_geometry_wasm(
    positions_in: &[f32],
    indices_in: &[u32],
    params: JsValue
) -> Result<JsValue, JsValue> {
    let params: SubdivideParams = serde_wasm_bindgen::from_value(params)
        .map_err(|e| JsValue::from_str(&format!("Invalid params: {}", e)))?;

    let center_point = Vec3::new(params.point_x, params.point_y, params.point_z);
    
    // Convert positions to Vec3
    let vertex_count = positions_in.len() / 3;
    let mut vertices: Vec<Vec3> = Vec::with_capacity(vertex_count);
    for i in 0..vertex_count {
        vertices.push(Vec3::new(
            positions_in[i * 3],
            positions_in[i * 3 + 1],
            positions_in[i * 3 + 2]
        ));
    }

    // Build edge adjacency
    let mut edge_to_triangles: HashMap<(u32, u32), Vec<usize>> = HashMap::new();
    let tri_count = indices_in.len() / 3;
    
    for i in 0..tri_count {
        let i0 = indices_in[i * 3];
        let i1 = indices_in[i * 3 + 1];
        let i2 = indices_in[i * 3 + 2];
        
        let edges = [make_edge_key(i0, i1), make_edge_key(i1, i2), make_edge_key(i2, i0)];
        
        for edge in edges {
            edge_to_triangles.entry(edge).or_default().push(i);
        }
    }

    // STEP 1: Mark edges for subdivision
    let mut edges_to_subdivide: HashSet<(u32, u32)> = HashSet::new();

    // First pass
    for i in 0..tri_count {
        let i0 = indices_in[i * 3];
        let i1 = indices_in[i * 3 + 1];
        let i2 = indices_in[i * 3 + 2];
        
        let v0 = &vertices[i0 as usize];
        let v1 = &vertices[i1 as usize];
        let v2 = &vertices[i2 as usize];
        
        // Check Edge 01
        let edge01_len = v0.distance_to(v1);
        if edge01_len > params.max_edge_length * 1.5 {
            let mid = v0.add(v1).multiply_scalar(0.5);
            if mid.distance_to(&center_point) < params.radius * 0.8 {
                edges_to_subdivide.insert(make_edge_key(i0, i1));
            }
        }
        
        // Check Edge 12
        let edge12_len = v1.distance_to(v2);
        if edge12_len > params.max_edge_length * 1.5 {
            let mid = v1.add(v2).multiply_scalar(0.5);
            if mid.distance_to(&center_point) < params.radius * 0.8 {
                edges_to_subdivide.insert(make_edge_key(i1, i2));
            }
        }
        
        // Check Edge 20
        let edge20_len = v2.distance_to(v0);
        if edge20_len > params.max_edge_length * 1.5 {
            let mid = v2.add(v0).multiply_scalar(0.5);
            if mid.distance_to(&center_point) < params.radius * 0.8 {
                edges_to_subdivide.insert(make_edge_key(i2, i0));
            }
        }
    }
    
    // Second pass: propagate
    let mut changed = true;
    let mut iterations = 0;
    while changed && iterations < 5 {
        changed = false;
        iterations += 1;
        
        let mut edges_to_add: Vec<(u32, u32)> = Vec::new();
        
        for edge in &edges_to_subdivide {
            if let Some(triangles) = edge_to_triangles.get(edge) {
                for &tri_idx in triangles {
                    let i0 = indices_in[tri_idx * 3];
                    let i1 = indices_in[tri_idx * 3 + 1];
                    let i2 = indices_in[tri_idx * 3 + 2];
                    
                    let e01 = make_edge_key(i0, i1);
                    let e12 = make_edge_key(i1, i2);
                    let e20 = make_edge_key(i2, i0);
                    
                    let mut marked_count = 0;
                    if edges_to_subdivide.contains(&e01) { marked_count += 1; }
                    if edges_to_subdivide.contains(&e12) { marked_count += 1; }
                    if edges_to_subdivide.contains(&e20) { marked_count += 1; }
                    
                    if marked_count == 1 {
                         let v0 = &vertices[i0 as usize];
                         let v1 = &vertices[i1 as usize];
                         let v2 = &vertices[i2 as usize];
                         
                         let l01 = v0.distance_to(v1);
                         let l12 = v1.distance_to(v2);
                         let l20 = v2.distance_to(v0);
                         
                         let max_edge = l01.max(l12).max(l20);
                         let min_edge = l01.min(l12).min(l20);
                         
                         if max_edge / min_edge > 3.0 {
                             if l01 == max_edge && !edges_to_subdivide.contains(&e01) { edges_to_add.push(e01); }
                             if l12 == max_edge && !edges_to_subdivide.contains(&e12) { edges_to_add.push(e12); }
                             if l20 == max_edge && !edges_to_subdivide.contains(&e20) { edges_to_add.push(e20); }
                         }
                    } else if marked_count == 2 {
                        if !edges_to_subdivide.contains(&e01) { edges_to_add.push(e01); }
                        if !edges_to_subdivide.contains(&e12) { edges_to_add.push(e12); }
                        if !edges_to_subdivide.contains(&e20) { edges_to_add.push(e20); }
                    }
                }
            }
        }
        
        if !edges_to_add.is_empty() {
            for edge in edges_to_add {
                if edges_to_subdivide.insert(edge) {
                    changed = true;
                }
            }
        }
    }
    
    // STEP 2: Create midpoints
    let mut new_vertices = vertices.clone();
    let mut edge_midpoints: HashMap<(u32, u32), u32> = HashMap::new();
    
    for edge in &edges_to_subdivide {
        let (i1, i2) = *edge;
        let v1 = &vertices[i1 as usize];
        let v2 = &vertices[i2 as usize];
        
        let mut midpoint = v1.add(v2).multiply_scalar(0.5);
        
        // Spherical projection check
        let v1_len = v1.length();
        let v2_len = v2.length();
        let avg_len = (v1_len + v2_len) * 0.5;
        
        if (v1_len - avg_len).abs() < 0.3 && (v2_len - avg_len).abs() < 0.3 {
            midpoint = midpoint.normalize().multiply_scalar(avg_len);
        }
        
        let new_index = new_vertices.len() as u32;
        new_vertices.push(midpoint);
        edge_midpoints.insert(*edge, new_index);
    }
    
    // STEP 3: Process triangles
    let mut new_indices: Vec<u32> = Vec::with_capacity(indices_in.len());
    
    for i in 0..tri_count {
        let i0 = indices_in[i * 3];
        let i1 = indices_in[i * 3 + 1];
        let i2 = indices_in[i * 3 + 2];
        
        let e01 = make_edge_key(i0, i1);
        let e12 = make_edge_key(i1, i2);
        let e20 = make_edge_key(i2, i0);
        
        let has_e01 = edges_to_subdivide.contains(&e01);
        let has_e12 = edges_to_subdivide.contains(&e12);
        let has_e20 = edges_to_subdivide.contains(&e20);
        
        let pattern = (if has_e01 { 1 } else { 0 }) + 
                      (if has_e12 { 2 } else { 0 }) + 
                      (if has_e20 { 4 } else { 0 });
                      
        match pattern {
            0 => {
                new_indices.push(i0); new_indices.push(i1); new_indices.push(i2);
            },
            1 => { // e01
                let m = edge_midpoints[&e01];
                new_indices.push(i0); new_indices.push(m); new_indices.push(i2);
                new_indices.push(m); new_indices.push(i1); new_indices.push(i2);
            },
            2 => { // e12
                let m = edge_midpoints[&e12];
                new_indices.push(i0); new_indices.push(i1); new_indices.push(m);
                new_indices.push(i0); new_indices.push(m); new_indices.push(i2);
            },
            3 => { // e01, e12
                let m01 = edge_midpoints[&e01];
                let m12 = edge_midpoints[&e12];
                new_indices.push(i0); new_indices.push(m01); new_indices.push(i2);
                new_indices.push(m01); new_indices.push(i1); new_indices.push(m12);
                new_indices.push(m01); new_indices.push(m12); new_indices.push(i2);
            },
            4 => { // e20
                let m = edge_midpoints[&e20];
                new_indices.push(i0); new_indices.push(i1); new_indices.push(m);
                new_indices.push(i1); new_indices.push(i2); new_indices.push(m);
            },
            5 => { // e01, e20
                let m01 = edge_midpoints[&e01];
                let m20 = edge_midpoints[&e20];
                new_indices.push(i0); new_indices.push(m01); new_indices.push(m20);
                new_indices.push(m01); new_indices.push(i1); new_indices.push(i2);
                new_indices.push(m20); new_indices.push(m01); new_indices.push(i2);
            },
            6 => { // e12, e20
                let m12 = edge_midpoints[&e12];
                let m20 = edge_midpoints[&e20];
                new_indices.push(i0); new_indices.push(i1); new_indices.push(m12);
                new_indices.push(i0); new_indices.push(m12); new_indices.push(m20);
                new_indices.push(m20); new_indices.push(m12); new_indices.push(i2);
            },
            7 => { // all
                let m01 = edge_midpoints[&e01];
                let m12 = edge_midpoints[&e12];
                let m20 = edge_midpoints[&e20];
                new_indices.push(i0); new_indices.push(m01); new_indices.push(m20);
                new_indices.push(i1); new_indices.push(m12); new_indices.push(m01);
                new_indices.push(i2); new_indices.push(m20); new_indices.push(m12);
                new_indices.push(m01); new_indices.push(m12); new_indices.push(m20);
            },
            _ => {}
        }
    }
    
    // Convert new vertices back to flat array
    let mut new_positions_out: Vec<f32> = Vec::with_capacity(new_vertices.len() * 3);
    for v in new_vertices {
        new_positions_out.push(v.x);
        new_positions_out.push(v.y);
        new_positions_out.push(v.z);
    }
    
    let result = GreebleResult {
        positions: new_positions_out,
        indices: new_indices,
        normals: Vec::new(), // We let JS compute normals
        uvs: Vec::new(), // UVs are hard to interpolate without data, we might need to pass them in
        greeble_count: 0,
    };
    
    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("{}", e)))
}

#[derive(Serialize, Deserialize)]
pub struct GreebleParams {
    pub seed: u32,
    pub density: f32,
    pub clustering: f32,
    pub scale_min: Option<f32>,
    pub scale_max: Option<f32>,
    pub height_min: Option<f32>,
    pub height_max: Option<f32>,
}

#[wasm_bindgen]
pub fn greeble_generate(
    _level: u32,
    positions: &[f32],
    indices: &[u32],
    normals: &[f32],
    params: JsValue
) -> Result<JsValue, JsValue> {
    let params: GreebleParams = serde_wasm_bindgen::from_value(params)
        .map_err(|e| JsValue::from_str(&format!("Invalid params: {}", e)))?;

    // Output buffers
    let mut out_positions = positions.to_vec();
    let mut out_indices = indices.to_vec();
    let mut out_normals = normals.to_vec();
    let mut out_uvs = Vec::new(); // Basic UVs
    
    // Fill initial UVs with 0 if empty (since we're appending)
    for _ in 0..(positions.len()/3) {
        out_uvs.push(0.0);
        out_uvs.push(0.0);
    }

    let tri_count = indices.len() / 3;
    let mut rng_state = params.seed;
    let mut random = || {
        rng_state = (rng_state.wrapping_mul(1103515245).wrapping_add(12345)) & 0x7fffffff;
        rng_state as f32 / 2147483648.0
    };

    let density = params.density.clamp(0.0, 1.0);
    let h_min = params.height_min.unwrap_or(0.1);
    let h_max = params.height_max.unwrap_or(0.5);
    let s_min = params.scale_min.unwrap_or(0.1);
    let s_max = params.scale_max.unwrap_or(0.3);

    let mut greeble_count = 0;

    for i in 0..tri_count {
        if random() > density { continue; }

        let i0 = indices[i * 3] as usize;
        let i1 = indices[i * 3 + 1] as usize;
        let i2 = indices[i * 3 + 2] as usize;

        // Triangle Center
        let v0 = Vec3::new(positions[i0*3], positions[i0*3+1], positions[i0*3+2]);
        let v1 = Vec3::new(positions[i1*3], positions[i1*3+1], positions[i1*3+2]);
        let v2 = Vec3::new(positions[i2*3], positions[i2*3+1], positions[i2*3+2]);

        let center = v0.add(&v1).add(&v2).multiply_scalar(0.3333);
        
        // Triangle Normal
        let n0 = Vec3::new(normals[i0*3], normals[i0*3+1], normals[i0*3+2]);
        let normal = n0; // Simplified, use v0 normal

        // Generate a Box/Nurnie
        let height = h_min + random() * (h_max - h_min);
        let scale = s_min + random() * (s_max - s_min);
        
        // Append Box Geometry (aligned to normal)
        // Simplified: Axis aligned box at center
        let base_idx = (out_positions.len() / 3) as u32;
        
        let hs = scale * 0.5;
        // Vertices for a box
        let box_verts = [
            // Top
            -hs, height, -hs,
             hs, height, -hs,
             hs, height,  hs,
            -hs, height,  hs,
            // Sides... simplified to just top box for speed
            -hs, 0.0, -hs,
             hs, 0.0, -hs,
             hs, 0.0,  hs,
            -hs, 0.0,  hs,
        ];

        // Rotation to align Y with Normal
        // let q = Quaternion::from_unit_vectors(Vec3::new(0.0, 1.0, 0.0), normal);
        // Manual rotation logic skipped for brevity, just adding offsets
        
        for j in 0..8 {
            let bx = box_verts[j*3];
            let by = box_verts[j*3+1];
            let bz = box_verts[j*3+2];
            
            // Apply simple transform
            out_positions.push(center.x + bx + normal.x * by);
            out_positions.push(center.y + by + normal.y * by); // Extrude along Y
            out_positions.push(center.z + bz + normal.z * by);
            
            out_normals.push(normal.x);
            out_normals.push(normal.y);
            out_normals.push(normal.z);
            
            out_uvs.push(0.0);
            out_uvs.push(0.0);
        }

        // Indices for box
        let box_indices = [
            0, 1, 2, 0, 2, 3, // Top
            4, 5, 1, 4, 1, 0, // Front
            5, 6, 2, 5, 2, 1, // Right
            6, 7, 3, 6, 3, 2, // Back
            7, 4, 0, 7, 0, 3, // Left
            // Bottom skipped
        ];

        for idx in box_indices {
            out_indices.push(base_idx + idx);
        }
        
        greeble_count += 1;
    }

    let result = GreebleResult {
        positions: out_positions,
        indices: out_indices,
        normals: out_normals,
        uvs: out_uvs,
        greeble_count,
    };

    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("{}", e)))
}


// ============================================================================
// PBR MAP GENERATION (CPU-based, but compiled to WASM for speed)
// ============================================================================

#[derive(Serialize, Deserialize)]
pub struct PbrParams {
    pub normal_strength: f32,
    pub roughness_base: f32,
    pub roughness_contrast: f32,
    pub roughness_invert: bool,
    pub metallic_base: f32,
    pub metallic_contrast: f32,
    pub edge_wear: f32,
    pub ao_intensity: f32,
    pub height_contrast: f32,
}

#[derive(Serialize)]
pub struct PbrResult {
    pub normal: Vec<u8>,
    pub roughness: Vec<u8>,
    pub metallic: Vec<u8>,
    pub ao: Vec<u8>,
    pub height: Vec<u8>,
}

// Fast PBR generation using direct memory access (no serialization overhead!)
#[wasm_bindgen]
pub fn generate_pbr_maps_fast(
    rgba_data: &[u8],
    width: u32,
    height: u32,
    normal_strength: f32,
    roughness_base: f32,
    roughness_contrast: f32,
    roughness_invert: bool,
    metallic_base: f32,
    metallic_contrast: f32,
    edge_wear: f32,
    ao_intensity: f32,
    height_contrast: f32,
) -> Vec<u8> {
    let w = width as usize;
    let h = height as usize;
    let pixel_count = w * h;
    
    // Output buffer: 5 maps * pixel_count * 4 channels
    let mut output = vec![0u8; pixel_count * 4 * 5];
    
    // Convert to grayscale
    let mut grayscale = vec![0.0f32; pixel_count];
    for i in 0..pixel_count {
        let r = rgba_data[i * 4] as f32 / 255.0;
        let g = rgba_data[i * 4 + 1] as f32 / 255.0;
        let b = rgba_data[i * 4 + 2] as f32 / 255.0;
        grayscale[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    }
    
    // Generate Curvature (for edge detection)
    let mut curvature = vec![0.0f32; pixel_count];
    for y in 2..(h - 2) {
        for x in 2..(w - 2) {
            let idx = y * w + x;
            let center = grayscale[idx];
            
            let laplacian = -4.0 * center
                + grayscale[(y - 1) * w + x]
                + grayscale[(y + 1) * w + x]
                + grayscale[y * w + (x - 1)]
                + grayscale[y * w + (x + 1)];
            
            curvature[idx] = laplacian.abs();
        }
    }
    
    let normal_offset = 0;
    let roughness_offset = pixel_count * 4;
    let metallic_offset = pixel_count * 4 * 2;
    let ao_offset = pixel_count * 4 * 3;
    let height_offset = pixel_count * 4 * 4;
    
    // Generate all maps in parallel loops
    for y in 0..h {
        for x in 0..w {
            let idx = y * w + x;
            let out_idx = idx * 4;
            
            // NORMAL MAP (Sobel)
            if y > 0 && y < h - 1 && x > 0 && x < w - 1 {
                let gx = -grayscale[(y - 1) * w + (x - 1)]
                         - 2.0 * grayscale[y * w + (x - 1)]
                         - grayscale[(y + 1) * w + (x - 1)]
                         + grayscale[(y - 1) * w + (x + 1)]
                         + 2.0 * grayscale[y * w + (x + 1)]
                         + grayscale[(y + 1) * w + (x + 1)];
                
                let gy = -grayscale[(y - 1) * w + (x - 1)]
                         - 2.0 * grayscale[(y - 1) * w + x]
                         - grayscale[(y - 1) * w + (x + 1)]
                         + grayscale[(y + 1) * w + (x - 1)]
                         + 2.0 * grayscale[(y + 1) * w + x]
                         + grayscale[(y + 1) * w + (x + 1)];
                
                let nx = -gx * normal_strength;
                let ny = -gy * normal_strength;
                let nz = 1.0;
                
                let len = (nx * nx + ny * ny + nz * nz).sqrt();
                output[normal_offset + out_idx] = ((nx / len * 0.5 + 0.5).clamp(0.0, 1.0) * 255.0) as u8;
                output[normal_offset + out_idx + 1] = ((ny / len * 0.5 + 0.5).clamp(0.0, 1.0) * 255.0) as u8;
                output[normal_offset + out_idx + 2] = ((nz / len * 0.5 + 0.5).clamp(0.0, 1.0) * 255.0) as u8;
                output[normal_offset + out_idx + 3] = 255;
            } else {
                output[normal_offset + out_idx] = 128;
                output[normal_offset + out_idx + 1] = 128;
                output[normal_offset + out_idx + 2] = 255;
                output[normal_offset + out_idx + 3] = 255;
            }
            
            // ROUGHNESS MAP
            let mut rough_val = grayscale[idx];
            if roughness_invert { rough_val = 1.0 - rough_val; }
            rough_val = ((rough_val - 0.5) * roughness_contrast + 0.5 + roughness_base).clamp(0.0, 1.0);
            let rough_byte = (rough_val * 255.0) as u8;
            output[roughness_offset + out_idx] = rough_byte;
            output[roughness_offset + out_idx + 1] = rough_byte;
            output[roughness_offset + out_idx + 2] = rough_byte;
            output[roughness_offset + out_idx + 3] = 255;
            
            // METALLIC MAP
            let mut metal_val = grayscale[idx];
            metal_val = ((metal_val - 0.5) * metallic_contrast + 0.5).clamp(0.0, 1.0);
            if edge_wear > 0.0 {
                metal_val = (metal_val + curvature[idx] * edge_wear).clamp(0.0, 1.0);
            }
            metal_val = (metal_val + metallic_base).clamp(0.0, 1.0);
            let metal_byte = (metal_val * 255.0) as u8;
            output[metallic_offset + out_idx] = metal_byte;
            output[metallic_offset + out_idx + 1] = metal_byte;
            output[metallic_offset + out_idx + 2] = metal_byte;
            output[metallic_offset + out_idx + 3] = 255;
            
            // AO MAP (simplified - full version is too slow)
            let ao_val = 1.0 - (curvature[idx] * ao_intensity).clamp(0.0, 1.0);
            let ao_byte = (ao_val * 255.0) as u8;
            output[ao_offset + out_idx] = ao_byte;
            output[ao_offset + out_idx + 1] = ao_byte;
            output[ao_offset + out_idx + 2] = ao_byte;
            output[ao_offset + out_idx + 3] = 255;
            
            // HEIGHT MAP
            let height_val = ((grayscale[idx] - 0.5) * height_contrast + 0.5).clamp(0.0, 1.0);
            let height_byte = (height_val * 255.0) as u8;
            output[height_offset + out_idx] = height_byte;
            output[height_offset + out_idx + 1] = height_byte;
            output[height_offset + out_idx + 2] = height_byte;
            output[height_offset + out_idx + 3] = 255;
        }
    }
    
    output
}
