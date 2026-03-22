# Tango Handoff

## Current Status

- `fs_list_dir` and `fs_search_entries` still run on `spawn_blocking`, the watched explorer root still invalidates warm list/name/content caches on external edits, and the backend now exposes its effective cache TTL/budget policy at runtime.
- Warm native reuse remains in place for:
  - directory listings
  - recursive names-only search indexes
  - bounded recursive content indexes
- Those cache timings and budgets are no longer source-only constants; they now come from a single backend runtime policy with env overrides and a Tauri inspection command.

## Files Changed

- `M:\OverlayTerm\src-tauri\src\fs_commands.rs`
- `M:\OverlayTerm\src-tauri\src\lib.rs`
- `C:\Users\Admin\.codex\automations\tango-team-1\memory.md`
- `M:\OverlayTerm\automations\tango\memory.md`
- `M:\OverlayTerm\automations\tango\handoff.md`
- `M:\OverlayTerm\automations\tango\report.md`

## Exact Findings

- Builder slice landed: `M:\OverlayTerm\src-tauri\src\fs_commands.rs` now resolves cache policy from env-backed overrides once at startup and uses that policy across directory-list pruning, search-index reuse, entry-size TTL reuse, entry-size scan budgeting, and content-search file/budget thresholds.
- Builder slice landed: zero-valued TTL/budget overrides now act as deterministic disable switches for the corresponding in-memory cache layer, which gives validation and release runs a cold-path toggle without editing Rust code.
- Builder slice landed: `fs_get_runtime_cache_policy` is exported from `M:\OverlayTerm\src-tauri\src\lib.rs`, so validators can label telemetry with the exact active TTL and budget values instead of inferring them from the repo state.
- Backend correctness remains green after the policy refactor; no regression reproduced in the native list/search cache suite.
- Remaining evidence gap: the lane still lacks real-workspace UI proof that watched-root external edits refresh explorer rows and live search results immediately while preserving the warm-cache latency wins under a known runtime policy.

## Exact Verification

- Team 1 builder verification:
  - `CARGO_TARGET_DIR=M:\OverlayTerm\src-tauri\target-tests-tango-team-1 cargo test --manifest-path M:\OverlayTerm\src-tauri\Cargo.toml resolve_fs_cache_policy -- --nocapture`
  - `CARGO_TARGET_DIR=M:\OverlayTerm\src-tauri\target-tests-tango-team-1 cargo test --manifest-path M:\OverlayTerm\src-tauri\Cargo.toml dir_list_cache_prunes_expired_variants -- --nocapture`
  - `CARGO_TARGET_DIR=M:\OverlayTerm\src-tauri\target-tests-tango-team-1 cargo test --manifest-path M:\OverlayTerm\src-tauri\Cargo.toml search_entries_content_over_budget_stays_uncached -- --nocapture`
  - `CARGO_TARGET_DIR=M:\OverlayTerm\src-tauri\target-tests-tango-team-1 cargo test --manifest-path M:\OverlayTerm\src-tauri\Cargo.toml fs_commands::tests -- --nocapture`
- New or tightened regression coverage:
  - `parse_fs_cache_policy_u64_defaults_for_missing_blank_and_invalid_values`
  - `resolve_fs_cache_policy_uses_defaults_without_overrides`
  - `resolve_fs_cache_policy_applies_valid_overrides`
  - `dir_list_cache_prunes_expired_variants`
  - `search_entries_content_over_budget_stays_uncached`

## Risks

- Real-workspace UI smoke is still missing for watched-root external-edit freshness, cold versus warm content-search latency, large-root over-budget fallback perception, and rapid clear-search interruption.
- `include_content=true` still takes the cold recursive scan path on roots whose eligible text exceeds the configured total content-cache budget, exceed the configured per-file text limit, or include unreadable text files.
- External filesystem churn outside the actively watched explorer root is still TTL-bounded unless the UI explicitly refreshes or broadens watcher coverage.
- The current fixed search scope `primary_file_explorer` is only safe while one live explorer instance owns it.
- Build output still needs release-oriented attention for oversized JS chunks.

## Ranked Queue

1. Run a real-workspace UI smoke pass that first calls `fs_get_runtime_cache_policy`, then edits files externally under the active explorer root, and captures whether listings plus name/content search refresh immediately while recording cold versus warm content-search telemetry under that exact policy.
2. Decide whether watcher coverage needs to expand beyond the current explorer root before relying less on TTL-based freshness.
3. Use the new runtime policy surface to test whether the default content-cache budget and per-file content limit are well calibrated on real workspaces before making them adaptive.
4. Push size/icon/preview hydration further off the primary navigation path.
5. Isolate explorer hot-path state away from the top-level React shell.

## Single Best Next Step For Delta Team 3 Or The Next Tango Cycle

- Tango Team 2 should run a real-workspace UI smoke pass that invokes `fs_get_runtime_cache_policy`, records the returned TTL/budget values in the validation notes, then verifies watched-root external-edit freshness plus cold versus warm `include_content=true` latency and over-budget fallback behavior in the live UI.
