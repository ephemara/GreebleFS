# Tango Report

## Release Readiness

- Status: not yet shippable, but release evidence improved. The new search-diagnostics telemetry slice is now validator-backed from native tests through persisted frontend performance samples.

## Release-Readiness Impact

- `M:\OverlayTerm\src-tauri\src\fs_commands.rs` still exposes `fs_search_entries_with_diagnostics`, which reports native execution strategy plus content-cache status and scan/index counts.
- `M:\OverlayTerm\src\components\FileExplorer.tsx` still records that backend search metadata together with the runtime cache-policy fingerprint on successful `explorer_search` samples.
- `M:\OverlayTerm\src\config\searchTelemetry.ts` keeps the diagnostic-to-telemetry mapping data-driven instead of scattering field names through the explorer component.
- `M:\OverlayTerm\src\test\fileExplorer.searchTelemetry.test.tsx` now proves the persisted `explorer_search` sample shape end-to-end through a real `FileExplorer` render and search flow.
- `M:\OverlayTerm\src\test\browser\fileExplorer.repositoryPicker.browser.test.tsx` now knows about `fs_get_runtime_cache_policy`, so the browser test path no longer lags behind the explorer startup contract.
- Focused Rust coverage, focused frontend unit coverage, and the production build are green for this slice.

## Current Known Gaps

- Large-real-tree validator smoke is still missing for watched-root external-edit freshness, cold versus warm search behavior, over-budget fallback perception, and rapid clear-search interruption.
- The browser-harness command for repository-picker coverage still hangs in this environment, so browser-based validator coverage is not dependable yet.
- `include_content=true` still performs a cold full-tree scan on roots whose eligible text exceeds the configured total content-cache budget, exceeds the configured per-file content-search size limit, or includes unreadable text files.
- External churn outside the active watcher coverage is still TTL-bounded; only in-app mutations or watched-root filesystem notifications invalidate the cache immediately.
- Directory listings still need one metadata read per entry because the UI currently expects modified time, size, hidden state, and symlink state immediately.
- Performance budgets are formalized in `src/config/performanceTelemetry.ts`, but real runtime baselines still need more interactive samples.
- The current search scope wiring assumes one live primary explorer; multi-explorer reuse would need per-instance scope derivation.
- The app shell still carries too much coordination load in the top-level React component.

## Ranked Release Risks

1. The lane still lacks real-workspace UI evidence that `explorer_search` telemetry records the correct backend execution strategy and content-cache status for cold, warm, and over-budget queries under a known runtime policy.
2. Browser-based validator coverage is currently unreliable because the targeted Vitest browser repository-picker run hangs instead of returning a deterministic result.
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
  - warm names-only search reuse is present in native code and telemetry-visible
  - warm content-enabled search reuse is present for fully cacheable roots and telemetry-visible
  - over-budget content fallback is validator-backed as fully uncached and telemetry-visible
  - watched-root external invalidation is present in native code
  - effective native cache TTLs and budgets are inspectable at runtime through `fs_get_runtime_cache_policy`
  - first explorer samples now finalize with runtime policy metadata instead of persisting as `pending`
  - persisted `explorer_search` samples are now validator-backed for both runtime cache-policy fields and backend search diagnostics

## Verification

- Validator verification:
  - `$env:CARGO_TARGET_DIR='M:\OverlayTerm\src-tauri\target-tests-tango-team-2'; cargo test --manifest-path M:\OverlayTerm\src-tauri\Cargo.toml fs_commands::tests -- --nocapture`
  - `npx vitest run src/test/fileExplorer.searchTelemetry.test.tsx --reporter=verbose`
  - `npm run test:unit -- src/test/runtimeCachePolicy.test.ts src/test/searchTelemetry.test.ts`
  - `npm run build`
- Attempted but not green:
  - `npx vitest run --config vitest.browser.config.ts src/test/browser/fileExplorer.repositoryPicker.browser.test.tsx --reporter=verbose`
  - Result: hung past the 180-second timeout without a deterministic pass/fail result.

## Current Execution Bias

- The next validator move should be a real-workspace UI smoke pass with telemetry capture, focused on watched-root external-edit freshness, cold versus warm search path labeling, over-budget fallback perception, and rapid typing or clear-search interruption.
- That validator run should call `fs_get_runtime_cache_policy` first, then confirm the recorded `explorer_search` samples contain both the runtime cache-policy fingerprint and the expected backend diagnostic fields for each scenario.
- After that, the builder should use those live samples to decide whether watcher coverage or the default content-cache thresholds need to become broader or adaptive.

## Goal

- Convert performance work into measured, validated, release-oriented progress over repeated hourly runs.
