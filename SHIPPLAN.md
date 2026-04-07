# OverlayTerm Ship Plan

## Mission
Push OverlayTerm toward shippable quality through repeated heartbeat passes. **Performance-first mode is now in effect.** Prioritize a real-world path to **60 FPS** UI performance above general polish, while still preserving correctness and validation.

## Top 10 Priority Fixes

1. **Harden `git_exec` backend**
   - move blocking subprocess work off the async path
   - add timeout protection
   - return richer error data if needed

2. **Reduce GitManager command churn**
   - lower repeated git process count
   - scope polling to active/visible repos
   - debounce refresh paths better

3. **Guard untracked diff preview**
   - size cap
   - binary detection
   - metadata fallback for non-text or large files

4. **Reduce shader/animation runtime scan overhead**
   - prefer watching over polling where possible
   - reload changed assets, not everything
   - cap concurrency if needed

5. **Reduce plugin runtime background tax**
   - improve watcher fallback strategy
   - backoff polling when stable

6. **Improve terminal throughput**
   - batch writes better
   - reduce unnecessary flush pressure
   - inspect lock granularity

7. **Reduce preview memory spikes**
   - revisit `fs_read_file_base64`
   - lower or route around large in-memory previews

8. **Startup / overlay UX consistency**
   - align tray-first / overlay-first release behavior
   - reduce startup visual churn

9. **Broaden targeted perf instrumentation**
   - track expensive repo refreshes, scans, previews, and hot paths
   - measure and protect the path toward **60 FPS** during common UI interactions

10. **Ship-grade validation + UX polish**
   - fix flaky tests
   - improve awkward confirmations / states / empty states
   - add quality-of-life improvements where leverage is high

## Progress Log

### 2026-04-07
- Initial review pass completed.
- Identified top performance / issue hotspots in GitManager, Tauri git backend, asset polling, preview memory paths, terminal throughput, and startup UX.
- Heartbeat loop configured to keep pushing this plan forward.
- Landed first hardening slice for `git_exec` in `src-tauri/src/fs_commands.rs`:
  - moved execution off the async path with `spawn_blocking`
  - added timeout enforcement
  - kill-on-timeout behavior for stuck git subprocesses
  - improved empty-stderr failure fallback text
  - added targeted Rust tests for success and timeout behavior
- Targeted Rust validation started: `cargo test --manifest-path src-tauri/Cargo.toml git_exec_`.
- That targeted validation exposed a real issue in the new test harness: the `OVERLAYTERM_GIT_EXECUTABLE` override could leak across tests.
- Landed a follow-up fix for the Rust tests:
  - added a dedicated test env lock for git executable override mutation
  - explicitly clear the override in the success-path test
  - serialized env mutation around the timeout-path test
- Started a targeted Rust rerun after the test-isolation fix.
- The targeted Rust rerun for `git_exec_` passed cleanly after the test-isolation fix.
- Landed a fast UI/test reliability fix in `src/test/panelRegistry.test.tsx` by updating the assertion to account for the current `DeferredPanel` wrapper around `LazyGitManager`.
- Targeted validation passed: `bun vitest run src/test/panelRegistry.test.tsx`.
- Fixed the broken Chrono Rift sample package by adding the missing frontend entrypoint at `plugins/chronorift/dist/index.tsx` so the manifest now matches reality.
- Targeted plugin runtime validation passed: `bun vitest run src/test/pluginRuntime.test.ts`.
- Fixed the screenshots post-save handoff in `src/components/ScreenshotsManager.tsx` so save actions that should close the editor switch to the library section before resetting editor state.
- Targeted screenshots validation passed: `bun vitest run src/test/screenshotsManager.test.tsx`.
- Fixed terminal toolbar accessibility / regression issues in `src/components/TerminalOverlay.tsx`:
  - added proper `aria-label` values to icon-only toolbar buttons
  - normalized button `title` handling instead of concatenating label/title strings
  - restored the missing `Copy Snapshot` toolbar action
  - aligned split action labels with the current test/user-facing expectations
- Targeted terminal validation passed: `bun vitest run src/test/terminalOverlay.test.tsx`.
- Ran a broader unit-suite sanity pass and found a cross-test contamination bug in `src/test/screenshotsManager.test.tsx`: the file passed in isolation but failed inside the full Vitest run because persisted `ultacode-settings` data could leak in from earlier tests.
- Fixed that suite-level isolation issue by clearing `window.localStorage` in the screenshots test `beforeEach`.
- Broader unit validation passed cleanly: `bun run test` → 68 files passed, 413 tests passed.
- Landed a GitManager polling-churn reduction in `src/components/GitManager.tsx`:
  - kept the initial badge sync as a full-repo hydration pass
  - reduced steady-state 30s polling to the active/selected repo instead of every tracked repo
  - added slower background badge sweeps for non-selected repos every 2 minutes
- Targeted GitManager validation passed: `bun vitest run src/test/gitManager.behavior.test.tsx src/test/gitManager.utils.test.ts`.
- Added untracked diff safety guards in `src/components/GitManager.tsx`:
  - size-check untracked files before synthesizing inline diffs
  - skip synthetic inline diffs for large untracked files (>128 KB)
  - fall back to summary patches for unavailable/binary-looking untracked content instead of forcing a full text read/diff path
- Post-change GitManager validation passed: `bun vitest run src/test/gitManager.behavior.test.tsx src/test/gitManager.utils.test.ts`.
- Reduced post-action GitManager refresh fan-out in `src/components/GitManager.tsx` so repo actions now refresh the selected repo state plus only that repo's badge, instead of refreshing badges for every tracked repo after each local action.
- Follow-up GitManager validation passed: `bun vitest run src/test/gitManager.behavior.test.tsx src/test/gitManager.utils.test.ts`.
- Reduced preview memory pressure in `src-tauri/src/fs_commands.rs` by lowering the `fs_read_file_base64` inline preview cap from 50 MB to 12 MB and centralizing that threshold in a named constant.
- Added backend tests for the inline base64 preview guard:
  - small previewable files still return a data URL
  - oversized files are rejected once they exceed the new 12 MB cap
- Rust validation passed: `cargo test --manifest-path src-tauri/Cargo.toml fs_read_file_base64_`.
- Reduced plugin runtime background tax in watcher-fallback mode:
  - added `fallbackScanMaxIntervalMs` to plugin runtime config
  - changed fallback polling in `src/runtime/useFolderPluginRuntime.ts` from a fixed interval to a self-scheduling backoff loop
  - fallback polling now starts at 20s and backs off up to 120s while the watcher remains unavailable
- Targeted plugin runtime fallback validation passed: `bun vitest run src/test/useFolderPluginRuntime.fallback.test.tsx src/test/useFolderPluginRuntime.test.tsx`.
- Tightened overlay frame telemetry around the 60 FPS target in `src/config/frameTelemetry.ts`:
  - frame telemetry stats now expose a `withinTarget` signal
  - recorded overlay frame samples now include `targetFps`, `targetFrameMs`, and `withinTarget` metadata
  - added targeted tests covering both over-budget and budget-meeting frame windows
- Surfaced the 60 FPS target status in `src/components/SettingsPage.tsx` so the settings overview now reports whether the latest frame telemetry window is within or over budget.
- Reduced settings overview telemetry refresh churn in `src/components/SettingsPage.tsx` by slowing the performance summary polling cadence from 2s to 5s while the overview section is active.
- Targeted telemetry/settings validation passed: `bun vitest run src/test/settingsPage.behavior.test.tsx src/test/performanceTelemetry.test.ts src/test/frameTelemetry.test.ts`.
- Improved terminal throughput in `src-tauri/src/terminal.rs` by changing `write_many` to batch writes first and flush each touched terminal once at the end, instead of flushing after every individual write request.
- Added a follow-up terminal throughput trim in `src-tauri/src/terminal.rs` so both `write` and `write_many` now skip empty payloads instead of taking the lock, writing nothing, and flushing anyway.
- Targeted terminal validation passed: `bun vitest run src/test/terminalOverlay.test.tsx`.

## Notes
- Prefer small, validated wins over giant speculative rewrites.
- Keep this file updated after each meaningful pass.
small, validated wins over giant speculative rewrites.
- Keep this file updated after each meaningful pass.
