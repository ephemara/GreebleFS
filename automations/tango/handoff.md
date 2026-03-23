# Tango Handoff

## Current Status

- The search-telemetry implementation remains intact, but the highest-risk Tango blocker is still VPS validator execution.
- Team 2 proved the blocker is the mounted Windows-origin filesystem itself, not only Vitest `forks`, and landed a fail-fast wrapper change so `*:vps` commands no longer masquerade as hung product checks.
- The lane is still not green on the Linux VPS because no synced VPS-local OverlayTerm checkout/worktree has been validated yet for redirected `test:unit:vps`, `test:browser:vps`, and `build:vps` runs.

## Files Changed

- `/home/azureuser/Desktop/M on Player (NoMachine)/OverlayTerm/scripts/with-vps-artifacts.sh`
- `/home/azureuser/.codex/automations/tango-team-2/memory.md`
- `/home/azureuser/Desktop/M on Player (NoMachine)/OverlayTerm/automations/tango/memory.md`
- `/home/azureuser/Desktop/M on Player (NoMachine)/OverlayTerm/automations/tango/handoff.md`
- `/home/azureuser/Desktop/M on Player (NoMachine)/OverlayTerm/automations/tango/report.md`

## Exact Findings

- Exact validator finding: the mounted Windows-origin workspace is the real VPS blocker, not a Vitest-specific worker-pool problem.
  - `source scripts/vps-artifacts.sh && timeout 60s node -e "import('vitest').then(() => console.log('vitest-import-ok')).catch(err => { console.error(err); process.exit(1); })"` timed out with no stdout.
  - `source scripts/vps-artifacts.sh && timeout 60s node -e "import('playwright').then(() => console.log('playwright-import-ok')).catch(err => { console.error(err); process.exit(1); })"` timed out with no stdout.
  - `timeout 20s strace -f -tt -o /tmp/overlayterm-vitest.strace node node_modules/vitest/vitest.mjs run src/test/runtimeCachePolicy.test.ts --pool=threads --reporter=verbose || true` showed prolonged `statx/openat` churn under mounted `node_modules` until timeout killed the process.
  - `timeout 20s strace -f -tt -o /tmp/overlayterm-playwright.strace node node_modules/playwright/cli.js --version || true` showed the same mounted-filesystem startup pattern for Playwright.
- Exact wrapper fix:
  - `/home/azureuser/Desktop/M on Player (NoMachine)/OverlayTerm/scripts/with-vps-artifacts.sh` now detects the mounted Windows path and exits immediately with an actionable `OVERLAYTERM_VPS_EXEC_ROOT` instruction instead of letting `build:vps` or `test:unit:vps` hang during Node module startup.
  - The wrapper now supports redirecting Node-based VPS execution to a VPS-local repo root via `OVERLAYTERM_VPS_EXEC_ROOT`.
  - The wrapper now exports `OVERLAYTERM_VPS_SOURCE_ROOT`, preserving the mounted source-of-truth path for redirected commands.
- Exact remaining blocker:
  - No synced VPS-local OverlayTerm checkout/worktree was proven equivalent to the mounted repo state in this run, so full green unit/browser/build evidence is still missing.
  - The available local Codex worktree is not an acceptable substitute yet because its HEAD (`2d8d72ba5eab307c00963dde71edf88ba8e3c1d6`) differs from the mounted repo HEAD (`6446e3f38b37e16ee2deb7604a59d4c674501aa7`).
  - Attempts to `rsync` or `tar` the mounted repo into a local mirror also entered uninterruptible source I/O, so auto-mirroring was not safe to land this run.

## Exact Verification

- Green:
  - `source scripts/vps-artifacts.sh && timeout 45s npm run test:unit:vps -- src/test/runtimeCachePolicy.test.ts`
  - Result: fast, deterministic failure with the mounted-workspace guidance instead of a hang.
  - `source scripts/vps-artifacts.sh && timeout 45s npm run build:vps`
  - Result: fast, deterministic failure with the mounted-workspace guidance instead of a hang.
  - `OVERLAYTERM_VPS_EXEC_ROOT='/home/azureuser/.codex/worktrees/ba94/OverlayTerm' bash scripts/with-vps-artifacts.sh pwd`
  - Result: `/home/azureuser/.codex/worktrees/ba94/OverlayTerm`
  - `OVERLAYTERM_VPS_EXEC_ROOT='/home/azureuser/.codex/worktrees/ba94/OverlayTerm' bash scripts/with-vps-artifacts.sh bash -lc 'printf "%s\n%s\n" "$OVERLAYTERM_VPS_SOURCE_ROOT" "$PWD"'`
  - Result:
    - source root: `/home/azureuser/Desktop/M on Player (NoMachine)/OverlayTerm`
    - exec root: `/home/azureuser/.codex/worktrees/ba94/OverlayTerm`
- Reproduced blocker:
  - `source scripts/vps-artifacts.sh && timeout 60s node -e "import('vitest').then(() => console.log('vitest-import-ok')).catch(err => { console.error(err); process.exit(1); })"`
  - Result: timed out with exit code `124`.
  - `source scripts/vps-artifacts.sh && timeout 60s node -e "import('playwright').then(() => console.log('playwright-import-ok')).catch(err => { console.error(err); process.exit(1); })"`
  - Result: timed out with exit code `124`.
  - `timeout 20s strace -f -tt -o /tmp/overlayterm-vitest.strace node node_modules/vitest/vitest.mjs run src/test/runtimeCachePolicy.test.ts --pool=threads --reporter=verbose || true`
  - `timeout 20s strace -f -tt -o /tmp/overlayterm-playwright.strace node node_modules/playwright/cli.js --version || true`
  - Result: both traces captured slow mounted-path module resolution before timeout.
- Attempted but not green:
  - `rsync -a ...` and `tar -C . -cf - ...` mirror attempts from the mounted repo.
  - Result: source-side I/O entered `D` state, so automated mirroring from the mounted workspace was not safe to continue.

## Risks

- The Linux VPS still has no green release-gate evidence for `test:unit:vps`, browser coverage, or `build:vps`.
- The mounted Windows-origin filesystem can still make validator commands appear hung if someone bypasses `scripts/with-vps-artifacts.sh`.
- Real-workspace UI smoke is still missing for watched-root external-edit freshness, cold versus warm search behavior, over-budget fallback perception, and rapid clear-search interruption.
- `include_content=true` still takes the cold recursive scan path on roots whose eligible text exceeds the configured total content-cache budget, exceeds the configured per-file text limit, or includes unreadable text files.
- External filesystem churn outside the actively watched explorer root is still TTL-bounded unless the UI explicitly refreshes or watcher coverage expands.
- The current fixed search scope `primary_file_explorer` is only safe while one live explorer instance owns it.

## Ranked Queue

1. Provision or sync a VPS-local OverlayTerm checkout/worktree to the mounted repo state and export it as `OVERLAYTERM_VPS_EXEC_ROOT`.
2. Rerun `npm run test:unit:vps`, `npm run test:browser:vps`, and `npm run build:vps` through the wrapper against that local exec root.
3. Once validator tooling is dependable again, resume the real-workspace UI smoke pass for cold, warm, and over-budget `explorer_search` telemetry.
4. Decide whether watcher coverage needs to expand beyond the current explorer root before relying less on TTL-based freshness.

## Single Best Next Step For Delta Team 3 Or The Next Tango Cycle

- Create or sync a VPS-local OverlayTerm checkout/worktree to the mounted repo commit `6446e3f38b37e16ee2deb7604a59d4c674501aa7`, set `OVERLAYTERM_VPS_EXEC_ROOT` to that local root, and immediately rerun `npm run test:unit:vps`, `npm run test:browser:vps`, and `npm run build:vps`.
