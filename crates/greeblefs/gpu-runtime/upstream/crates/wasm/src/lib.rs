use serde::Serialize;
use serde_wasm_bindgen::{from_value, to_value};
use wasm_bindgen::prelude::*;
use web_sys::HtmlCanvasElement;

use k_os_gpu_pipeline::device::GpuComputeDevice;
use k_os_gpu_pipeline::raycast::bvh as gpu_bvh;
use k_os_mesh::primitive_gen;
use k_os_sculpt as sculpt;

#[wasm_bindgen]
pub async fn init_gpu(_canvas: HtmlCanvasElement) -> Result<(), JsValue> {
    GpuComputeDevice::init()
        .await
        .map_err(|e| JsValue::from_str(&e))?;
    Ok(())
}

#[derive(Serialize)]
struct PrimitiveResultJs {
    positions: Vec<f32>,
    indices: Vec<u32>,
    normals: Vec<f32>,
    uvs: Vec<f32>,
}

#[wasm_bindgen]
pub fn spawn_primitive(primitive_id: String, params: JsValue) -> Result<JsValue, JsValue> {
    let mut p = primitive_gen::PrimitiveParams::default();
    let map: Option<serde_json::Map<String, serde_json::Value>> = from_value(params)
        .ok()
        .and_then(|v: serde_json::Value| v.as_object().cloned());
    if let Some(m) = map {
        if let Some(v) = m.get("subdivisions").and_then(|v| v.as_u64()) {
            p.subdivisions = Some(v as u32);
        }
        if let Some(v) = m.get("segments").and_then(|v| v.as_u64()) {
            p.segments = Some(v as u32);
        }
        if let Some(v) = m.get("radius").and_then(|v| v.as_f64()) {
            p.radius = Some(v as f32);
        }
    }
    let res =
        primitive_gen::spawn_primitive(&primitive_id, p).map_err(|e| JsValue::from_str(&e))?;
    let out = PrimitiveResultJs {
        positions: res.positions,
        indices: res.indices,
        normals: res.normals,
        uvs: res.uvs,
    };
    to_value(&out).map_err(|e| JsValue::from_str(&format!("{e}")))
}

#[wasm_bindgen]
pub fn raycast_init(
    positions: Vec<f32>,
    indices: Vec<u32>,
    uvs: Option<Vec<f32>>,
) -> Result<u64, JsValue> {
    gpu_bvh::gpu_raycast_init(positions, indices, uvs).map_err(|e| JsValue::from_str(&e))
}

#[wasm_bindgen]
pub fn raycast(handle: u64, origin: Box<[f32]>, direction: Box<[f32]>) -> Result<JsValue, JsValue> {
    let origin = [origin[0], origin[1], origin[2]];
    let direction = [direction[0], direction[1], direction[2]];
    let hit = gpu_bvh::gpu_raycast(handle, origin, direction).map_err(|e| JsValue::from_str(&e))?;
    to_value(&hit).map_err(|e| JsValue::from_str(&format!("{e}")))
}

#[wasm_bindgen]
pub fn raycast_dispose(handle: u64) -> Result<(), JsValue> {
    gpu_bvh::gpu_raycast_dispose(handle).map_err(|e| JsValue::from_str(&e))
}

#[wasm_bindgen]
pub fn sculpt_init(positions: Vec<f32>, indices: Vec<u32>) -> Result<u64, JsValue> {
    sculpt::init_sculpt_mesh(positions, indices).map_err(|e| JsValue::from_str(&e))
}

#[wasm_bindgen]
pub fn sculpt_apply(
    handle: u64,
    point: Box<[f32]>,
    normal: Box<[f32]>,
    tool: String,
    radius: f32,
    intensity: f32,
    use_gpu: bool,
) -> Result<JsValue, JsValue> {
    let result = sculpt::apply_brush(
        handle,
        [point[0], point[1], point[2]],
        [normal[0], normal[1], normal[2]],
        tool,
        radius,
        intensity,
        None,
        Some(use_gpu),
        None,
        None,
    )
    .map_err(|e| JsValue::from_str(&e))?;
    to_value(&result).map_err(|e| JsValue::from_str(&format!("{e}")))
}

#[wasm_bindgen]
pub fn sculpt_get_positions(handle: u64) -> Result<Box<[f32]>, JsValue> {
    let positions = sculpt::get_sculpt_positions(handle).map_err(|e| JsValue::from_str(&e))?;
    Ok(positions.into_boxed_slice())
}

#[wasm_bindgen]
pub fn sculpt_dispose(handle: u64) -> Result<(), JsValue> {
    sculpt::dispose_sculpt_mesh(handle).map_err(|e| JsValue::from_str(&e))
}

// ============================================================================
// GRAPHOS PAINTER (2D)
// ============================================================================

use k_os_brushes::paint_wasm::{BrushParams, StrokeManager};
use lazy_static::lazy_static;
use std::collections::HashMap;
use std::sync::Mutex;

lazy_static! {
    static ref PAINTERS: Mutex<HashMap<u64, StrokeManager>> = Mutex::new(HashMap::new());
    static ref NEXT_PAINTER_HANDLE: Mutex<u64> = Mutex::new(1);
}

#[wasm_bindgen]
pub fn painter_init() -> u64 {
    let mut artists = PAINTERS.lock().unwrap();
    let mut h = NEXT_PAINTER_HANDLE.lock().unwrap();
    let handle = *h;
    *h += 1;
    artists.insert(handle, StrokeManager::new());
    handle
}

#[wasm_bindgen]
pub fn painter_update(
    handle: u64,
    x: f32,
    y: f32,
    pressure: f32,
    params: JsValue,
) -> Result<JsValue, JsValue> {
    let mut artists = PAINTERS.lock().unwrap();
    let artist = artists
        .get_mut(&handle)
        .ok_or_else(|| JsValue::from_str("Painter handle not found"))?;

    let p: BrushParams =
        from_value(params).map_err(|e| JsValue::from_str(&format!("Invalid params: {e}")))?;
    let splats = artist.update(nalgebra::Vector2::new(x, y), pressure, &p);

    to_value(&splats).map_err(|e| JsValue::from_str(&format!("{e}")))
}

#[wasm_bindgen]
pub fn painter_reset(handle: u64) -> Result<(), JsValue> {
    let mut artists = PAINTERS.lock().unwrap();
    let artist = artists
        .get_mut(&handle)
        .ok_or_else(|| JsValue::from_str("Painter handle not found"))?;
    artist.reset();
    Ok(())
}

#[wasm_bindgen]
pub fn painter_dispose(handle: u64) -> Result<(), JsValue> {
    let mut artists = PAINTERS.lock().unwrap();
    artists.remove(&handle);
    Ok(())
}
