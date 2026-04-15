# GreebleFS Release Summary

- Release ID: `v0.1.0-rc1`
- Generated At (UTC): `2026-04-15T21:56:14Z`
- Last Updated (America/New_York): `2026-04-15 18:24 EDT`
- Release Folder: `/home/ephemara/Dev/Apps-2D/GreebleFS/release/v0.1.0-rc1`
- Status: `blocked`
- Decision: `blocked`

## Artifact Targets

- [x] Native release binary produced
- [ ] Linux `deb` / `rpm` / `AppImage` bundles produced
- [ ] Checksums, signatures, or symbols if required
- [x] Release notes and compatibility notes updated
- [x] Release docs and metadata updated

## Command Highlights

- `bun run build` passed.
- `bun run test:unit` failed with `9` files, `20` tests, and `2` unhandled errors.
- `bun run test:browser` failed with `1` browser regression in repository-picker coverage.
- `bun run test:rust` compiled and began running `src-tauri` tests but did not finish within the release pass window.
- `bun run release:linux:bundle` built `/home/ephemara/Dev/Apps-2D/GreebleFS/src-tauri/target/release/greeblefs` and then failed in Tauri bundling with `Can't detect any appindicator library`.
- `bunx vitest run src/test/gitManager.behavior.test.tsx -t "omits large untracked files from inline diffs without reading file contents"` passed as a targeted sanity rerun.

## Results

- Produced:
  - native release binary at `/home/ephemara/Dev/Apps-2D/GreebleFS/src-tauri/target/release/greeblefs`
  - frontend production assets under `/home/ephemara/Dev/Apps-2D/GreebleFS/dist/`
  - regenerated Specta bindings at `/home/ephemara/Dev/Apps-2D/GreebleFS/src/generated/tauri.ts`
- Not produced:
  - Linux package artifacts under `src-tauri/target/release/bundle/`
  - checksums, signatures, or symbols
- Release-facing rename and compatibility work remains present:
  - package/app identity ships as `GreebleFS`
  - Tauri identifier is `co.greeblefs.app`
  - Linux installer paths target `~/.local/opt/greeblefs` and `~/.local/bin/greeblefs`
  - legacy `overlayterm` plugin/runtime/storage contracts remain intentionally preserved for this RC via compatibility notes and fallback env/path handling

## Blockers

- `bun run test:unit` is red.
- `bun run test:browser` is red.
- Linux packaging is blocked on appindicator detection through `pkg-config` on the current Linux bundle host.
- `bun run test:rust` has no completed green result recorded for this pass.
- Windows signing and macOS signing or notarization remain external follow-up work.

## Decision Rationale

- The release rename and compatibility slice is in place, and the production build itself succeeds, but the release candidate remains blocked because the declared validation gates are not green and the declared Linux package outputs were not produced.
- If an internal binary drop is needed, `/home/ephemara/Dev/Apps-2D/GreebleFS/src-tauri/target/release/greeblefs` exists, but that is not equivalent to a release-ready bundle set.
