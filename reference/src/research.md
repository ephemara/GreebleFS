# Reference Research: How These Patterns Slice Into GreebleFS

This note turns the four reference systems into concrete guidance for GreebleFS. The goal is not to copy Rage literally, but to identify the pieces that map cleanly onto the current explorer, cache, identity, and preview architecture.

## Executive Summary

- Best immediate fit: path hashing and viewport-aware prefetch.
- Strong backend fit: intrusive containers for hot metadata/cached lookup graphs.
- Conditional fit: a dedicated buddy-style pool for thumbnail/preview scratch buffers.
- Weak fit as a full rewrite: literal OS-style paging or replacing React state with intrusive runtime structures.

The main reason these ideas are sliceable here is that GreebleFS already has the right seams:

- `src-tauri/src/fs_commands.rs` already owns directory listing caches, search caches, cache policy, and the `Vec<FileEntry>` materialization path.
- `src-tauri/src/explorer_identity.rs` already persists `entity_id`, `content_revision`, and thumbnail artifact records.
- `src/runtime/explorerBackend.ts` is the orchestration layer for listings, search, thumbnails, and cache-policy routing.
- `src/components/FileExplorer.tsx` already tracks viewport metrics, visible entries, identity lookups, thumbnail hydration, and adjacent preview prefetch.

That means the reference ideas should mostly tighten the backend and cache layers, not replace the explorer UI model.

## 1. Intrusive Containers

### Reference files

- `atl/inlist.h`
- `atl/inmap.h`
- `atl/atinbintree.h`

### What they actually guarantee

- Nodes live inside the item itself.
- List and tree operations do not allocate.
- Multiple containers can coexist for the same item if each uses its own embedded link.
- Traversal and lookup stay pointer-native and compact.

### Why it matters

These structures are ideal when you have a lot of churn and want to avoid heap fragmentation and allocator overhead.

### How it slices into GreebleFS

Best candidates:

- backend directory metadata graphs
- cache indices for directory listings and search results
- identity and revision lookup structures
- selection and reconciliation helper graphs in the native layer

Poor candidates:

- React component state
- payloads sent across Tauri boundaries
- any structure that is mainly rendered rather than queried

### Best landing zone

- `src-tauri/src/fs_commands.rs`
- `src-tauri/src/explorer_identity.rs`

### Practical take

Use intrusive structures as an internal Rust optimization. Keep `FileEntry[]` and plain JSON snapshots as the boundary contract.

## 2. Buddy Allocator

### Reference files

- `atl/pool.h`
- `system/virtualallocator.h`

### What they actually guarantee

- Fixed-size or bucketed allocation with O(1) alloc/free behavior.
- Explicit memory ownership.
- On the virtual allocator side, explicit physical/virtual mapping and page-based control.

### Why it matters

The reference design is about controlling fragmentation and keeping hot memory predictable.

### How it slices into GreebleFS

Best candidates:

- thumbnail decode scratch buffers
- preview render buffers
- video frame staging
- maybe large transient image/audio processing workspaces

Bad idea:

- swapping the entire app over to a custom allocator before profiling proves the need

### Best landing zone

- `src-tauri/src/thumbnail_commands.rs`
- any future dedicated native preview/render worker layer

### Practical take

This should be a narrow pool for high-churn media buffers, not an app-wide memory policy. If profiling does not show allocator churn there, this stays a theoretical optimization.

## 3. Path Hashing

### Reference files

- `atl/hashstring.h`
- `string/stringhash.h`

### What they actually guarantee

- Stable integer keys from normalized strings.
- Case and slash normalization for filename-oriented hashing.
- A typed wrapper layer so hashes do not float around unstructured.

### Why it matters

This is the cleanest and most immediately reusable idea in the set. String equality is not the right primary key for every hot path.

### How it slices into GreebleFS

Best candidates:

- directory cache keys
- mount table keys
- search index keys
- thumbnail artifact keys
- internal reconciliation maps for visible entries and selection

Existing signals in GreebleFS:

- `src-tauri/src/explorer_identity.rs` already builds stable `entity_id` and `content_revision` values.
- `src/components/FileExplorer.tsx` already uses `path` and `entityId::contentRevision` style keys in its lookup maps.

### Best landing zone

- `src-tauri/src/explorer_identity.rs`
- `src-tauri/src/fs_commands.rs`
- `src/runtime/explorerBackend.ts`

### Practical take

Keep canonical path strings at the API boundary, but add a normalized hash companion internally. That gives you fast lookup without breaking debuggability.

## 4. Manual Paging / Streamer

### Reference file

- `paging/streamer.h`

### What it actually guarantees

- Asynchronous open/read/cancel behavior.
- Client-managed priority.
- Explicit queueing and completion semantics.
- A model where the caller decides what is important to bring in next.

### Why it matters

This is not an OS page-file replacement. It is a user-space streaming contract.

### How it slices into GreebleFS

Best candidates:

- viewport-aware metadata prefetch
- adjacent thumbnail loading
- proactive eviction of off-screen preview data
- prioritizing search or preview work based on what the user can currently see

Existing signals in GreebleFS:

- `src/components/FileExplorer.tsx` already tracks `scrollTop`, `clientHeight`, `visibleEntries`, `visibleEntryIndexLookup`, and adjacent-preview prefetch.
- `src/runtime/explorerBackend.ts` already routes thumbnail and listing requests.
- `src-tauri/src/fs_commands.rs` already exposes cache-policy knobs and invalidation-friendly listing behavior.

### Best landing zone

- `src/components/FileExplorer.tsx`
- `src/runtime/explorerBackend.ts`
- `src-tauri/src/fs_commands.rs`

### Practical take

Treat this as a viewport-driven scheduler for explorer data. Do not try to emulate OS virtual memory inside the app.

## Recommended Build Order

1. Add normalized path-hash keys to the backend cache/identity layer.
2. Use viewport metrics and visible-entry windows to drive thumbnail and preview prefetch.
3. If hot metadata still churns too much, move the backend caches for those paths to intrusive structures.
4. Only add a dedicated buddy allocator if profiling shows decode-buffer allocation churn is still a problem.

## Risks And Constraints

- GreebleFS already has snapshot-style UI state and cache invalidation. Replacing those wholesale would create more risk than value.
- Intrusive containers are a backend data-structure choice, not a UI architecture choice.
- Buddy allocation only pays off if there is sustained media-buffer churn.
- Paging should be framed as a scheduling problem, not as a promise to manage OS virtual memory directly.

## Best Reference Files To Revisit

- `atl/inlist.h` for zero-allocation intrusive list patterns.
- `atl/inmap.h` for intrusive map/index patterns.
- `atl/atinbintree.h` for intrusive tree mechanics and duplicate-key behavior.
- `atl/pool.h` for fixed-pool allocation and spillover behavior.
- `system/virtualallocator.h` for page-based allocation and explicit mapping strategy.
- `atl/hashstring.h` and `string/stringhash.h` for normalized path hashing.
- `paging/streamer.h` for explicit async load/cancel/priority control.

## Bottom Line

If we slice these ideas into GreebleFS in the right order, the app gets most of the benefit without a risky rewrite:

- hashes for fast internal identity
- intrusive structures for backend hot paths
- a viewport scheduler for thumbnails and previews
- a dedicated buffer pool only where media allocation churn justifies it

