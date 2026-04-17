//! Curated asset pipeline bundle extracted from `bevydcc` for GreebleFS adoption.
//!
//! This crate is a staging manifest plus provenance holder. The real source
//! material lives under `upstream/`.

pub const BUNDLE_ID: &str = "asset-pipeline";
pub const UPSTREAM_CRATES: &[&str] = &[
    "asset-pipeline",
    "io",
    "plugin",
    "workspace-registry",
];
