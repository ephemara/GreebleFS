# Tango Report

## Release Readiness

- Status: not yet shippable, but the native explorer cache stack is now both validator-backed and runtime-tunable, which reduces release risk for performance experiments and makes future telemetry runs more interpretable.

## Release-Readiness Impact

- `M:\OverlayTerm\src-tauri\src\fs_commands.rs` still routes both `fs_list_dir` and `fs_search_entries` through `spawn_blocking`, so cold directory and search traversal stay off the async command lane.
- Recursive names-only search and bounded content-enabled search still support warm reuse, but their TTLs and byte budgets are now resolved from a shared runtime cache policy instead of being hardcoded independently in the hot path.
- `M:\OverlayTerm\src-tauri\src\lib.rs` now exports `fs_get_runtime_cache_policy`, so validator/UI runs can record the exact active list/search/entry-size TTLs plus content-search byte limits alongside telemetry samples.
- Zero-valued runtime overrides now intentionally disable the corresponding in-memory cache layer, which gives release/debug runs a deterministic cold-path switch without editing source or rebuilding.
- The content path remains complete-or-nothing, and the lane still has explicit regression proof that over-budget roots fall back to the authoritative cold scan without persisting a partial recursive content index across repeated searches.
- External watcher-driven invalidation still clears listing, names-only search, and content-search caches for file changes under the actively watched explorer root, so watched out-of-band edits no longer have to wait for TTL expiry before the next query rebuilds authoritative data.

## Current Known Gaps

- Large-real-tree validator smoke is still missing for watched-root external-edit freshness, cold versus warm content-search latency, over-budget fallback perception, and rapid clear-search interruption.
- `include_content=true` still performs a cold full-tree scan on roots whose eligible text exceeds the configured total content-cache budget, exceeds the configured per-file content-search size limit, or includes unreadable text files.
- External churn outside the active watcher coverage is still TTL-bounded; only in-app mutations or watched-root filesystem notifications invalidate the cache immediately.
- Directory listings still need one metadata read per entry because the UI currently expects modified time, size, hidden state, and symlink state immediately.
- Performance budgets are formalized in `src/config/performanceTelemetry.ts`, but real runtime baselines still need more interactive samples.
- The current search scope wiring assumes one live primary explorer; multi-explorer reuse would need per-instance scope derivation.
- The app shell still carries too much coordination load in the top-level React component.

## Ranked Release Risks

1. The watcher-backed freshness behavior and the over-budget content-search fallback still lack real-workspace UI evidence and telemetry capture in the actual app, even though runtime policy inspection is now available.
2. Large or unreadable roots still pay the full cold content-scan cost on every `include_content=true` query.
3. External edits outside the active watcher coverage are still TTL-bounded unless the user triggers an explicit refresh.
4. Native directory listing still scales with live per-entry metadata reads, even though the cache layer is now bounded, refresh-aware, and configurable.
5. Secondary metadata work still competes too directly with primary navigation responsiveness.
6. Hot-path UI logic is concentrated in very large React files.
7. Build output still needs release-oriented attention for oversized JS chunks.
8. The current fixed search scope is not ready for multiple simultaneous explorer instances without additional scoping.

## Budget Targets

- Explorer navigation:
  - target: 120 ms
- Explorer search:
  - target: 180 ms
- Entry-size batch:
  - target: 160 ms
- Native icon batch:
  - target: 140 ms
- Explorer first interactive:
  - target: 350 ms

## Baseline Source

- Code:
  - `M:\OverlayTerm\src\config\performanceTelemetry.ts`
  - `M:\OverlayTerm\src\components\FileExplorer.tsx`
  - `M:\OverlayTerm\src-tauri\src\fs_commands.rs`
- Runtime storage:
  - localStorage key `overlayterm-explorer-performance-v1`
- Current state:
  - instrumentation landed
  - baseline collection is active
  - native listing and search both run on the blocking pool
  - warm names-only search reuse is present in native code
  - warm content-enabled search reuse is present for fully cacheable roots
  - over-budget content fallback is validator-backed as fully uncached
  - watched-root external invalidation is present in native code
  - effective native cache TTLs and budgets are now inspectable at runtime through `fs_get_runtime_cache_policy`

## Verification

- Team 1 builder verification:
  - `CARGO_TARGET_DIR=M:\OverlayTerm\src-tauri\target-tests-tango-team-1 cargo test --manifest-path M:\OverlayTerm\src-tauri\Cargo.toml resolve_fs_cache_policy -- --nocapture`
  - `CARGO_TARGET_DIR=M:\OverlayTerm\src-tauri\target-tests-tango-team-1 cargo test --manifest-path M:\OverlayTerm\src-tauri\Cargo.toml dir_list_cache_prunes_expired_variants -- --nocapture`
  - `CARGO_TARGET_DIR=M:\OverlayTerm\src-tauri\target-tests-tango-team-1 cargo test --manifest-path M:\OverlayTerm\src-tauri\Cargo.toml search_entries_content_over_budget_stays_uncached -- --nocapture`
  - `CARGO_TARGET_DIR=M:\OverlayTerm\src-tauri\target-tests-tango-team-1 cargo test --manifest-path M:\OverlayTerm\src-tauri\Cargo.toml fs_commands::tests -- --nocapture`

## Current Execution Bias

- The next validator move should be a real-workspace UI smoke pass with telemetry capture, focused on watched-root external-edit freshness, cold versus warm `include_content=true` latency, over-budget fallback perception, and rapid typing/clear-search interruption.
- That validator run should call `fs_get_runtime_cache_policy` first and record the returned TTL/budget values beside the telemetry samples so future comparisons are apples-to-apples.
- After that, the builder should use the new runtime policy surface plus telemetry to decide whether watcher coverage or the default content-cache thresholds need to become broader or adaptive.

## Goal

- Convert performance work into measured, validated, release-oriented progress over repeated hourly runs.
