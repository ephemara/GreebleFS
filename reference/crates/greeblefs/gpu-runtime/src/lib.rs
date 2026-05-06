//! Curated GPU runtime bundle extracted from `bevydcc` for GreebleFS adoption.
//!
//! This crate is a staging manifest plus provenance holder. The real source
//! material lives under `upstream/`.

pub const BUNDLE_ID: &str = "gpu-runtime";
pub const UPSTREAM_CRATES: &[&str] = &["gpu-pipeline", "renderer", "wasm"];
