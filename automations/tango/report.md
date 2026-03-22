# Tango Report

## Release Readiness

- Status: not yet shippable, but release evidence improved again. Search telemetry can now prove which native path actually executed instead of inferring warm versus cold behavior only from duration.

## Release-Readiness Impact

- `M:\OverlayTerm\src-tauri\src\fs_commands.rs` now exposes `fs_search_entries_with_diagnostics`, which returns search results plus backend execution diagnostics.
- Warm native reuse for recursive names-only and bounded content-enabled search is now directly observable in telemetry through `executionStrategy` and `contentCacheStatus`.
- `M:\OverlayTerm\src\components\FileExplorer.tsx` now records that backend search metadata on successful `explorer_search` samples, alongside the already-buffered runtime cache-policy fingerprint.
- `M:\OverlayTerm\src\config\searchTelemetry.ts` keeps the frontend metadata mapping data-driven instead of scattering telemetry field names through the explorer component.
- Focused Rust and unit tests now protect the new diagnostics contract for warm names-only reuse and over-budget content fallback.
- Production build remains green after the new command surface and telemetry wiring.

## Current Known Gaps

- Large-real-tree validator smoke is still missing for watched-root external-edit freshness, first-query versus warm-query search latency, over-budget fallback perception, and rapid clear-search interruption.
- The browser-harness command for repository-picker coverage timed out twice in this environment, so that validator path is still not dependable.
- `include_content=true` still performs a cold full-tree scan on roots whose eligible text exceeds the configured total content-cache budget, exceeds the configured per-file content-search size limit, or includes unreadable text files.
- External churn outside the active watcher coverage is still TTL-bounded; only in-app mutations or watched-root filesystem notifications invalidate the cache immediately.
- Directory listings still need one metadata read per entry because the UI currently expects modified time, size, hidden state, and symlink state immediately.
- Performance budgets are formalized in `src/config/performanceTelemetry.ts`, but real runtime baselines still need more interactive samples.
- The current search scope wiring assumes one live primary explorer; multi-explorer reuse would need per-instance scope derivation.
- The app shell still carries too much coordination load in the top-level React component.

## Ranked Release Risks

1. The lane still lacks real-workspace UI evidence that `explorer_search` telemetry now records the correct backend execution strategy and content-cache status for cold, warm, and over-budget queries under a known runtime policy.
2. Browser-based validator coverage is currently unreliable because the targeted Vitest browser run timed out twice instead of returning a deterministic result.
3. Large or unreadable roots still pay the full cold content-scan cost on every `include_content=true` query.
4. External edits outside the active watcher coverage are still TTL-bounded unless the user triggers an explicit refresh.
5. Native directory listing still scales with live per-entry metadata reads, even though the cache layer is now bounded, refresh-aware, and configurable.
6. Secondary metadata work still competes too directly with primary navigation responsiveness.
7. Hot-path UI logic is concentrated in very large React files.
8. Build output still needs release-oriented attention for oversized JS chunks.
9. The current fixed search scope is not ready for multiple simultaneous explorer instances without additional scoping.

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
  - `M:\OverlayTerm\src\config\runtimeCachePolicy.ts`
  - `M:\OverlayTerm\src\config\searchTelemetry.ts`
  - `M:\OverlayTerm\src\components\FileExplorer.tsx`
  - `M:\OverlayTerm\src-tauri\src\fs_commands.rs`
- Runtime storage:
  - localStorage key `overlayterm-explorer-performance-v1`
- Current state:
  - instrumentation landed
  - baseline collection is active
  - native listing and search both run on the blocking pool
  - warm names-only search reuse is present in native code and now telemetry-visible
  - warm content-enabled search reuse is present for fully cacheable roots and now telemetry-visible
  - over-budget content fallback is validator-backed as fully uncached and now telemetry-visible
  - watched-root external invalidation is present in native code
  - effective native cache TTLs and budgets are inspectable at runtime through `fs_get_runtime_cache_policy`
  - first explorer samples now finalize with runtime policy metadata instead of persisting as `pending`

## Verification

- Builder verification:
  - `$env:CARGO_TARGET_DIR='M:\OverlayTerm\src-tauri\target-tests-tango-team-1'; cargo test --manifest-path M:\OverlayTerm\src-tauri\Cargo.toml search_entries_with_diagnostics_ -- --nocapture`
  - `npm run test:unit -- src/test/runtimeCachePolicy.test.ts src/test/searchTelemetry.test.ts`
  - `npm run build`
- Attempted but not green:
  - `npm run test:browser -- src/test/browser/fileExplorer.repositoryPicker.browser.test.tsx`
  - Result: timed out twice in this environment.

## Current Execution Bias

- The next validator move should be a real-workspace UI smoke pass with telemetry capture, focused on watched-root external-edit freshness, cold versus warm search path labeling, over-budget fallback perception, and rapid typing or clear-search interruption.
- That validator run should call `fs_get_runtime_cache_policy` first, then confirm recorded `explorer_search` samples contain both the runtime cache-policy fingerprint and the expected backend diagnostic fields.
- After that, the builder should use those live samples to decide whether watcher coverage or the default content-cache thresholds need to become broader or adaptive.

## Goal

- Convert performance work into measured, validated, release-oriented progress over repeated hourly runs.
