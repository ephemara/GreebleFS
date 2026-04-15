# GreebleFS Release Summary

- Release ID: `v0.1.0-rc1`
- Generated At (UTC): `2026-04-15T21:56:14Z`
- Release Folder: `/home/ephemara/Dev/Apps-2D/GreebleFS/release/v0.1.0-rc1`
- Status: `blocked`
- Decision: `blocked`

## Artifact Targets

- [x] Canonical package and app identity updated to `GreebleFS`
- [ ] Linux `deb` / `rpm` / `AppImage` bundles produced
- [ ] Checksums, signatures, or symbols if required
- [x] Release notes and compatibility notes updated
- [x] Release docs and metadata updated

## Command Highlights

- `bun run build`
- `bunx vitest run src/test/layoutProfiles.edge.test.ts src/test/appContentDirectories.test.ts`
- `bunx vitest run --testTimeout 30000 src/test/settingsPage.behavior.test.tsx`
- `bunx vitest run --testTimeout 30000 src/test/gitManager.behavior.test.tsx`
- `bun run release:linux:bundle`

## Results

- Passed:
  - production frontend/native build
  - targeted rename and release-surface tests
  - legacy migration coverage for layout probes and app-content directory env overrides
- Pending:
  - Linux package artifacts under `src-tauri/target/release/bundle/`
- Release-facing changes landed:
  - package/app identity renamed to `GreebleFS`
  - Tauri identifier changed to `co.greeblefs.app`
  - Linux installer paths renamed to `~/.local/opt/greeblefs` and `~/.local/bin/greeblefs`
  - old `overlayterm` plugin/runtime/storage contracts intentionally preserved for one RC via compatibility notes and fallback env/path handling
  - release binary built at `src-tauri/target/release/greeblefs`

## Blockers

- Linux bundle command compiles the release binary but aborts during bundling with `Can't detect any appindicator library`.
- `bun run test:rust` is red/unstable in this workspace: one `fs_commands` test failed before a long-running search/transfer block forced the lane to be cut short.
- Windows signing, macOS signing/notarization, and native-host packaging proof remain external follow-up work.

## Decision Rationale

- The rename and migration slice is in place and the targeted release-surface tests now pass, but the release candidate stays blocked until at least one clean Linux bundle run finishes and the remaining cross-platform/signing tasks are explicitly handed off.
