# Storage Research Alignment

## Purpose

`docs/deep-research-report.md` is useful, but it is intentionally broad and repo-agnostic. This note maps the durable parts of that research onto the current GreebleFS architecture so future work lands in the right layer.

## Already Present In GreebleFS

- `src/runtime/globalSearchBackend.ts` plus the native global-search commands already push filename search toward an index-first path instead of crawling the live tree for every query.
- `src-tauri/src/semantic_search.rs` plus `src/config/semanticSearch.ts` already keep semantic search as an optional side index rather than as filesystem truth.
- `src/config/accelerationRuntime.ts` already models GPU and CUDA as workload-specific companion lanes instead of pretending every file operation should run through acceleration.
- `src-tauri/src/fs_commands.rs` plus the explorer checksum surfaces already provide lightweight integrity primitives for normal file work.
- `src/config/explorerArchives.ts` plus `src/components/ExplorerArchivePreview.tsx` already treat archives as read-only virtual surfaces with extraction as the escape hatch.

## What The Research Gets Right For This Repo

- Keep the hot control plane separate from the heavy data plane.
- Prefer index-first search and cached metadata over repeated live traversal.
- Keep GPU/CUDA lanes focused on coarse-grained batched work, not tiny namespace touches.
- Keep semantic search as a higher layer alongside deterministic metadata truth.
- Treat archive and package formats as workload-specific access shapes, not as one generic compressed-file bucket.

## Highest-Value Next Steps

1. Archive/package bridge
   - The strongest near-term gap is still the planned archive/package bridge hinted by `crates/yazi-specta`.
   - Build a typed pack manifest and policy layer before adding more codecs or a packed-image mode.
   - Include per-format access policy, mutability, and extraction defaults in that contract.

2. Verified immutable pack manifests
   - Add manifest-backed verification or chunk/file digest trees for future immutable packs, model bundles, shader packs, and curated snapshots.
   - Keep raw per-file checksums as the lightweight explorer path; do not block normal browsing on full verification work.

3. Snapshot-native metadata substrate
   - The current global-search and semantic-search lanes already move in the right direction, but a larger indexing push should target append-only snapshot manifests and incremental refresh.
   - That work belongs in Rust/native indexing services, not in React components.

## What Not To Do

- Do not chase universal-compression claims as a product strategy.
- Do not move fine-grained path lookups or metadata mutations onto CUDA or direct-storage lanes.
- Do not let vector or semantic search replace deterministic metadata truth.
- Do not add new pack or image formats without a typed manifest and an integrity story.

## Immediate Intake From This Research Pass

- Archive descriptors now carry access and workflow guidance so the explorer preview can steer users toward browse-first versus extract-first behavior by format.
- Acceleration workload copy now makes the batched/coarse-grained GPU guidance explicit, especially for direct-storage and similarity-search lanes.
