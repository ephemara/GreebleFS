# Tango Handoff

## Current Status

- The latest search telemetry slice is validator-backed at the unit level.
- `fs_search_entries_with_diagnostics` still exposes native execution strategy and content-cache diagnostics, and `FileExplorer` still records that metadata together with the runtime cache-policy fingerprint on successful `explorer_search` samples.
- Team 2 added end-to-end frontend proof that the persisted search sample contains both metadata sets.

## Files Changed

- `M:\OverlayTerm\src\test\fileExplorer.searchTelemetry.test.tsx`
- `M:\OverlayTerm\src\test\browser\fileExplorer.repositoryPicker.browser.test.tsx`
- `C:\Users\Admin\.codex\automations\tango-team-2\memory.md`
- `M:\OverlayTerm\automations\tango\memory.md`
- `M:\OverlayTerm\automations\tango\handoff.md`
- `M:\OverlayTerm\automations\tango\report.md`

## Exact Findings

- Builder slice remains live: `M:\OverlayTerm\src-tauri\src\fs_commands.rs` returns `FileSearchResponse` plus `FileSearchDiagnostics`, and `M:\OverlayTerm\src\components\FileExplorer.tsx` records those backend diagnostics through `M:\OverlayTerm\src\config\searchTelemetry.ts`.
- Exact validator finding: no new production correctness defect reproduced in the latest search-diagnostics implementation.
- Tightening landed: `M:\OverlayTerm\src\test\fileExplorer.searchTelemetry.test.tsx` now mounts `FileExplorer`, triggers a search, and proves the persisted `explorer_search` sample contains:
  - runtime cache-policy status and fingerprint
  - runtime TTL/budget fields
  - backend execution strategy
  - backend content-cache status
  - backend scanned/indexed/cache-count diagnostics
- Tightening landed: `M:\OverlayTerm\src\test\browser\fileExplorer.repositoryPicker.browser.test.tsx` now mocks `fs_get_runtime_cache_policy`, so the repository-picker test path stays aligned with the new explorer startup IPC.
- Exact validator blocker: browser-run coverage is still not dependable here. `npx vitest run --config vitest.browser.config.ts src/test/browser/fileExplorer.repositoryPicker.browser.test.tsx --reporter=verbose` hung past the 180-second timeout without emitting per-test output.

## Exact Verification

- `$env:CARGO_TARGET_DIR='M:\OverlayTerm\src-tauri\target-tests-tango-team-2'; cargo test --manifest-path M:\OverlayTerm\src-tauri\Cargo.toml fs_commands::tests -- --nocapture`
- `npx vitest run src/test/fileExplorer.searchTelemetry.test.tsx --reporter=verbose`
- `npm run test:unit -- src/test/runtimeCachePolicy.test.ts src/test/searchTelemetry.test.ts`
- `npm run build`
- Attempted but not green:
  - `npx vitest run --config vitest.browser.config.ts src/test/browser/fileExplorer.repositoryPicker.browser.test.tsx --reporter=verbose`
  - Result: hung past the 180-second timeout without producing a deterministic pass/fail result.

## Risks

- Real-workspace UI smoke is still missing for watched-root external-edit freshness, first-query versus warm-query search behavior, over-budget fallback perception, and rapid clear-search interruption.
- Browser-based validator coverage is still unreliable because the targeted Vitest browser repository-picker run hangs instead of returning a result.
- `include_content=true` still takes the cold recursive scan path on roots whose eligible text exceeds the configured total content-cache budget, exceeds the configured per-file text limit, or includes unreadable text files.
- External filesystem churn outside the actively watched explorer root is still TTL-bounded unless the UI explicitly refreshes or watcher coverage expands.
- The current fixed search scope `primary_file_explorer` is only safe while one live explorer instance owns it.
- Build output still needs release-oriented attention for oversized JS chunks.

## Ranked Queue

1. Run a real-workspace UI smoke pass that calls `fs_get_runtime_cache_policy`, performs cold, warm, and over-budget searches, and verifies the recorded `explorer_search` sample metadata matches the expected backend diagnostics.
2. Isolate why the targeted Vitest browser repository-picker run hangs so browser coverage can become a dependable validator gate again.
3. Decide whether watcher coverage needs to expand beyond the current explorer root before relying less on TTL-based freshness.
4. Use the runtime policy surface plus real telemetry to test whether the default content-cache budget and per-file content limit are well calibrated on real workspaces before making them adaptive.
5. Push size/icon/preview hydration further off the primary navigation path.

## Single Best Next Step For Delta Team 3 Or The Next Tango Cycle

- Tango Team 2 should run a real-workspace UI smoke pass under a recorded runtime cache policy and capture cold, warm, and over-budget `explorer_search` telemetry samples, while noting that the current browser Vitest path is still not reliable enough to substitute for that smoke.
