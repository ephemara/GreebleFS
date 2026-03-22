# Tango Handoff

## Current Status

- The explorer can now label successful search samples with backend execution diagnostics instead of relying on latency-only inference.
- `fs_search_entries_with_diagnostics` reports warm name-index hits, warm content-index hits, or live scans, plus content-cache status and scan/index counts.
- `FileExplorer` now records that native search-path metadata alongside the existing runtime cache-policy fingerprint on `explorer_search` telemetry samples.

## Files Changed

- `M:\OverlayTerm\src-tauri\src\fs_commands.rs`
- `M:\OverlayTerm\src-tauri\src\lib.rs`
- `M:\OverlayTerm\src\components\FileExplorer.tsx`
- `M:\OverlayTerm\src\config\searchTelemetry.ts`
- `M:\OverlayTerm\src\test\searchTelemetry.test.ts`
- `M:\OverlayTerm\src\test\browser\fileExplorer.repositoryPicker.browser.test.tsx`
- `C:\Users\Admin\.codex\automations\tango-team-1\memory.md`
- `M:\OverlayTerm\automations\tango\memory.md`
- `M:\OverlayTerm\automations\tango\handoff.md`
- `M:\OverlayTerm\automations\tango\report.md`

## Exact Findings

- Builder slice landed: `M:\OverlayTerm\src-tauri\src\fs_commands.rs` now exposes `FileSearchResponse` and `FileSearchDiagnostics`, and the new Tauri command `fs_search_entries_with_diagnostics` returns results plus backend execution metadata.
- Diagnostic metadata includes:
  - `executionStrategy`: `name_index_cache_hit`, `content_index_cache_hit`, or `live_scan`
  - `contentCacheStatus`: `not_requested`, `cache_hit`, `warmed`, `disabled`, `over_budget_fallback`, or `read_failure_fallback`
  - `scannedEntryCount`, `indexedEntryCount`, `contentCacheStoredFileCount`, and `contentCacheStoredByteCount`
- `M:\OverlayTerm\src\components\FileExplorer.tsx` now calls `fs_search_entries_with_diagnostics` and merges those backend diagnostics into every successful `explorer_search` sample through `M:\OverlayTerm\src\config\searchTelemetry.ts`.
- Rust coverage now proves both a warm names-only cache hit and an over-budget content-search fallback report the expected diagnostics.
- Remaining evidence gap: the live UI still needs a real-workspace validator pass that confirms the recorded telemetry matches actual warm/cold behavior under a known runtime cache policy.

## Exact Verification

- `$env:CARGO_TARGET_DIR='M:\OverlayTerm\src-tauri\target-tests-tango-team-1'; cargo test --manifest-path M:\OverlayTerm\src-tauri\Cargo.toml search_entries_with_diagnostics_ -- --nocapture`
- `npm run test:unit -- src/test/runtimeCachePolicy.test.ts src/test/searchTelemetry.test.ts`
- `npm run build`
- Attempted but not green:
  - `npm run test:browser -- src/test/browser/fileExplorer.repositoryPicker.browser.test.tsx`
  - Result: timed out twice in this environment without a deterministic pass/fail signal.

## Risks

- Real-workspace UI smoke is still missing for watched-root external-edit freshness, first-query versus warm-query content-search latency, over-budget fallback perception, and rapid clear-search interruption.
- Browser-harness stability is still unproven for the repository-picker coverage command because the targeted Vitest browser run timed out twice.
- `include_content=true` still takes the cold recursive scan path on roots whose eligible text exceeds the configured total content-cache budget, exceeds the configured per-file text limit, or includes unreadable text files.
- External filesystem churn outside the actively watched explorer root is still TTL-bounded unless the UI explicitly refreshes or watcher coverage expands.
- The current fixed search scope `primary_file_explorer` is only safe while one live explorer instance owns it.
- Build output still needs release-oriented attention for oversized JS chunks.

## Ranked Queue

1. Run a real-workspace UI smoke pass that calls `fs_get_runtime_cache_policy`, then confirms `explorer_search` samples record the expected `explorerSearchExecutionStrategy` and `explorerSearchContentCacheStatus` values for cold, warm, and over-budget queries.
2. Determine why the targeted Vitest browser run hangs in this environment so repository-picker/browser coverage can become a reliable validator gate again.
3. Decide whether watcher coverage needs to expand beyond the current explorer root before relying less on TTL-based freshness.
4. Use the runtime policy surface plus real telemetry to test whether the default content-cache budget and per-file content limit are well calibrated on real workspaces before making them adaptive.
5. Push size/icon/preview hydration further off the primary navigation path.

## Single Best Next Step For Tango Team 2

- Run a real-workspace UI smoke pass that captures `explorer_search` telemetry for one cold names-only query, one warm repeated names-only query, and one over-budget content query, then verify the recorded backend diagnostics match the expected native search path under the active runtime cache policy.
