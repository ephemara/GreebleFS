# Tango Report

## Release Readiness

- Status: not yet shippable on the Linux VPS. This run improved release-gate honesty by converting a multi-minute validator hang into a deterministic fast failure with a local-exec-root path, but the lane still lacks green VPS unit/browser/build evidence.

## Release-Readiness Impact

- The search-telemetry implementation remains in place:
  - `/home/azureuser/Desktop/M on Player (NoMachine)/OverlayTerm/src-tauri/src/fs_commands.rs`
  - `/home/azureuser/Desktop/M on Player (NoMachine)/OverlayTerm/src/components/FileExplorer.tsx`
  - `/home/azureuser/Desktop/M on Player (NoMachine)/OverlayTerm/src/config/searchTelemetry.ts`
- This run tightened validator execution instead of product logic:
  - `/home/azureuser/Desktop/M on Player (NoMachine)/OverlayTerm/scripts/with-vps-artifacts.sh` now fails fast on the mounted Windows path and instructs the operator to set `OVERLAYTERM_VPS_EXEC_ROOT` to a VPS-local OverlayTerm checkout/worktree.
  - The same wrapper now exports `OVERLAYTERM_VPS_SOURCE_ROOT`, so redirected VPS commands retain source-of-truth context while executing from local disk.
- Exact diagnostic upgrade:
  - Vitest and Playwright both timed out on plain `import(...)` from the mounted workspace before any tool-specific startup logs appeared.
  - `strace` showed slow `statx/openat` churn under mounted `node_modules`, which proves the blocker is filesystem-level module startup on the Windows-origin mount rather than only a Vitest worker-pool regression.

## Current Known Gaps

- No synced VPS-local OverlayTerm checkout/worktree was validated yet for redirected `*:vps` commands, so there is still no green `test:unit:vps`, `test:browser:vps`, or `build:vps` evidence after this run.
- The available local Codex worktree cannot yet be used as release evidence because its HEAD (`2d8d72ba5eab307c00963dde71edf88ba8e3c1d6`) differs from the mounted repo HEAD (`6446e3f38b37e16ee2deb7604a59d4c674501aa7`).
- Attempts to `rsync` or `tar` the mounted repo into a root-disk mirror also hit uninterruptible source I/O, so auto-mirroring from the mount is still unproven and unsafe.
- Large-real-tree validator smoke is still missing for watched-root external-edit freshness, cold versus warm search behavior, over-budget fallback perception, and rapid clear-search interruption.
- `include_content=true` still performs a cold full-tree scan on roots whose eligible text exceeds the configured total content-cache budget, exceeds the configured per-file content-search size limit, or includes unreadable text files.
- External churn outside the active watcher coverage is still TTL-bounded; only in-app mutations or watched-root filesystem notifications invalidate the cache immediately.
- Directory listings still need one metadata read per entry because the UI currently expects modified time, size, hidden state, and symlink state immediately.
- The current search scope wiring assumes one live primary explorer; multi-explorer reuse would need per-instance scope derivation.

## Ranked Release Risks

1. VPS release-gate commands are still not green because the lane does not yet have a synced VPS-local exec root for `test:unit:vps`, browser coverage, or `build:vps`.
2. The mounted Windows-origin filesystem still blocks direct Node-based validation on the source-of-truth checkout; bypassing the wrapper would reintroduce misleading hangs.
3. The lane still lacks real-workspace UI evidence that `explorer_search` telemetry records the correct backend execution strategy and content-cache status for cold, warm, and over-budget queries under a known runtime policy.
4. Browser-based validator coverage remains unproven until Playwright runs successfully from a synced local exec root.
5. Large or unreadable roots still pay the full cold content-scan cost on every `include_content=true` query.
6. External edits outside the active watcher coverage are still TTL-bounded unless the user triggers an explicit refresh.
7. Native directory listing still scales with live per-entry metadata reads, even though the cache layer is now bounded, refresh-aware, and configurable.
8. Secondary metadata work still competes too directly with primary navigation responsiveness.
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
  - `/home/azureuser/Desktop/M on Player (NoMachine)/OverlayTerm/src/config/performanceTelemetry.ts`
  - `/home/azureuser/Desktop/M on Player (NoMachine)/OverlayTerm/src/config/runtimeCachePolicy.ts`
  - `/home/azureuser/Desktop/M on Player (NoMachine)/OverlayTerm/src/config/searchTelemetry.ts`
  - `/home/azureuser/Desktop/M on Player (NoMachine)/OverlayTerm/src/components/FileExplorer.tsx`
  - `/home/azureuser/Desktop/M on Player (NoMachine)/OverlayTerm/src-tauri/src/fs_commands.rs`
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
  - persisted `explorer_search` samples are validator-backed at the unit level
  - `*:vps` wrapper commands now fail fast when invoked from the mounted Windows path without a local exec root

## Verification

- Green:
  - `source scripts/vps-artifacts.sh && timeout 45s npm run test:unit:vps -- src/test/runtimeCachePolicy.test.ts`
  - Result: fast deterministic mounted-path failure message.
  - `source scripts/vps-artifacts.sh && timeout 45s npm run build:vps`
  - Result: fast deterministic mounted-path failure message.
  - `OVERLAYTERM_VPS_EXEC_ROOT='/home/azureuser/.codex/worktrees/ba94/OverlayTerm' bash scripts/with-vps-artifacts.sh pwd`
  - Result: redirected into the local exec root successfully.
  - `OVERLAYTERM_VPS_EXEC_ROOT='/home/azureuser/.codex/worktrees/ba94/OverlayTerm' bash scripts/with-vps-artifacts.sh bash -lc 'printf "%s\n%s\n" "$OVERLAYTERM_VPS_SOURCE_ROOT" "$PWD"'`
  - Result: preserved mounted source root while executing locally.
- Reproduced blocker:
  - `source scripts/vps-artifacts.sh && timeout 60s node -e "import('vitest').then(() => console.log('vitest-import-ok')).catch(err => { console.error(err); process.exit(1); })"`
  - Result: timed out with exit code `124`.
  - `source scripts/vps-artifacts.sh && timeout 60s node -e "import('playwright').then(() => console.log('playwright-import-ok')).catch(err => { console.error(err); process.exit(1); })"`
  - Result: timed out with exit code `124`.
  - `timeout 20s strace -f -tt -o /tmp/overlayterm-vitest.strace node node_modules/vitest/vitest.mjs run src/test/runtimeCachePolicy.test.ts --pool=threads --reporter=verbose || true`
  - `timeout 20s strace -f -tt -o /tmp/overlayterm-playwright.strace node node_modules/playwright/cli.js --version || true`
  - Result: both traces showed mounted-path module-resolution churn before timeout.
- Attempted but not green:
  - `rsync` and `tar` mirror attempts from the mounted repo.
  - Result: source-side I/O entered `D` state, so no safe auto-mirror landed.

## Current Execution Bias

- The next validator move should provision or sync a VPS-local OverlayTerm checkout/worktree first, then set `OVERLAYTERM_VPS_EXEC_ROOT` to it.
- Once that local exec root is proven equivalent to the mounted repo commit, rerun:
  - `npm run test:unit:vps`
  - `npm run test:browser:vps`
  - `npm run build:vps`
- Only after dependable VPS gates are restored should Tango resume the real-workspace UI smoke pass for cold, warm, and over-budget `explorer_search` telemetry.

## Goal

- Convert performance work into measured, validated, release-oriented progress over repeated hourly runs without letting mounted-filesystem toolchain failures masquerade as product regressions.
