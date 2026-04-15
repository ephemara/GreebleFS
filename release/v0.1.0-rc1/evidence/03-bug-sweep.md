# GreebleFS Bug Sweep

## High-Risk Surfaces

- [x] Startup and launch path
- [x] Packaging and installer flow
- [x] Update or upgrade path
- [x] Core user journey after first launch
- [x] Release-only assets, config, or environment differences

## Findings

- Severity: `high`
  - Linux package artifacts were not produced in this pass. `bun run release:linux:bundle` built the optimized native binary and then aborted in the bundler with `Can't detect any appindicator library`, so there is still no packaged artifact to smoke-test.
- Severity: `medium`
  - `bun run test:unit` is red with `9` failing files, `20` failing tests, and `2` unhandled errors. The failing areas include watcher fallback timing, GitManager and telemetry expectations, generated binding expectations, workbench theme expectations, one settings timeout, one terminal REPL assertion, and one animation-count assertion.
- Severity: `medium`
  - `bun run test:browser` is red on the repository-picker flow. That is a user-visible browser regression in a core explorer path, not just infrastructure noise.
- Severity: `medium`
  - `bun run test:rust` compiled successfully and started the `src-tauri` suite, but no green result was recorded because long-running filesystem search and transfer tests exceeded the release-pass time budget.
- Severity: `low`
  - `bun run build` still emits four Rust warnings from `src-tauri/src/terminal.rs`, and Vite still reports oversized chunks for `App` (`2.3M`) and `typescript` (`3.5M`).
- Severity: `low`
  - Tauri warns that `co.greeblefs.app` ends with `.app`. Linux packaging is unaffected, but macOS bundle-identity hygiene should be revisited before a public release.

## Logs And Evidence

- Validation:
  - `bun run test:unit`
  - `bun run test:browser`
  - `bun run test:rust`
- Production build and package:
  - `bun run build`
  - `bun run release:linux:bundle`
- Targeted sanity rerun:
  - `bunx vitest run src/test/gitManager.behavior.test.tsx -t "omits large untracked files from inline diffs without reading file contents"`
- Compatibility reference:
  - `/home/ephemara/Dev/Apps-2D/GreebleFS/docs/release-compatibility.md`

## Exit Condition

- Current ship blockers:
  - red unit suite
  - red browser suite
  - missing packaged Linux artifacts
  - no completed green Rust suite in the current ship pass
  - unsigned or unnotarized Windows and macOS release work
