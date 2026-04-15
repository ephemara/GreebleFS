# GreebleFS Bug Sweep

## High-Risk Surfaces

- [x] Startup and launch path
- [x] Packaging and installer flow
- [x] Update or upgrade path
- [x] Core user journey after first launch
- [x] Release-only assets, config, or environment differences

## Findings

- Severity: `high`
  - Linux package artifacts were not produced because Tauri bundling aborted with `Can't detect any appindicator library`.
- Severity: `high`
  - `bun run test:rust` is not green. The lane reached a real failing test, `fs_commands::tests::external_path_invalidation_refreshes_parent_directory_listing_cache`, and then stalled in a long-running search/transfer cluster.
- Severity: `medium`
  - `bun run build` still emits four Rust warnings from `src-tauri/src/terminal.rs`. They do not block compilation but should not remain invisible in a release gate.
- Severity: `medium`
  - The Vite production build still emits oversized chunk warnings for `App` and `typescript`, which increases distribution size and startup risk.
- Severity: `medium`
  - Tauri warns that `co.greeblefs.app` ends with `.app`. Linux packaging is unaffected, but macOS bundle hygiene should be revisited before a public release.
- Severity: `low`
  - Legacy `OverlayTerm` runtime/plugin/event identifiers remain intentionally intact for compatibility in `v0.1.0-rc1`; this is a documented defer, not an accidental naming miss.

## Logs And Evidence

- Passing validation:
  - `bunx vitest run src/test/layoutProfiles.edge.test.ts src/test/appContentDirectories.test.ts`
  - `bunx vitest run --testTimeout 30000 src/test/settingsPage.behavior.test.tsx`
  - `bunx vitest run --testTimeout 30000 src/test/gitManager.behavior.test.tsx`
- Production build:
  - `bun run build`
- Rust validation:
  - `bun run test:rust`
- Compatibility reference:
  - `/home/ephemara/Dev/Apps-2D/GreebleFS/docs/release-compatibility.md`

## Exit Condition

- Current ship blockers:
  - missing packaged Linux artifacts due appindicator dependency gap
  - red / unstable Rust test lane
  - unsigned / unnotarized Windows and macOS release work
