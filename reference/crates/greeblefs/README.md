# GreebleFS Adoption Bundle

This folder is a curated extraction bundle assembled from `bevydcc/crates` for likely GreebleFS reuse.

It is organized into three adoption lanes:

- `gpu-runtime/`: high-value `wgpu` and render-service patterns for thumbnail, preview, upload, and frame-budget work
- `asset-pipeline/`: content-hash caching, metadata-first processing, registry-driven import policy, and workspace indexing
- `shell-patterns/`: host routing, panel/surface composition, diagnostics, and asset-browser reference patterns

The top-level `crates/greeblefs` folder intentionally does not contain a `Cargo.toml`. `bevydcc` uses `members = ["crates/*"]`, so only the nested category folders are standalone crates. That keeps this bundle import-ready without changing the parent workspace.

Each category crate contains:

- `Cargo.toml`: a minimal manifest with machine-readable curation metadata
- `src/lib.rs`: crate-local documentation and bundle identifiers
- `upstream/`: copied source files with original relative paths preserved under `upstream/crates/...`

Use this bundle as a staging area, not as a direct dependency. The copied files are reference-quality source material for selective porting into GreebleFS.
