# GreebleFS Pass-Through Tasks

## Alpha — Release And Packaging

- [x] Confirm canonical release commands
- [x] Build production assets and bindings
- [ ] Install a `pkg-config`-visible appindicator development package on the Linux bundle host and rerun `bun run release:linux:bundle`
- [ ] Produce Linux `deb` / `rpm` / `AppImage` outputs from one clean bundle pass
- [x] Record exact artifact paths and current signature status

## Delta — Integration And Docs

- [x] Update release notes and compatibility docs
- [x] Update distribution metadata and installer naming
- [ ] Run user-visible smoke checks on the built Linux artifact
- [ ] Hand off Windows signing and macOS signing/notarization requirements

## Charlie — Validation And Evidence

- [ ] Stabilize the red `bun run test:unit` suite
- [ ] Fix the repository-picker browser regression and rerun `bun run test:browser`
- [ ] Re-run or explicitly waive `bun run test:rust`
- [x] Complete checklist and build ledger
- [x] Record bug sweep findings, blockers, and workarounds

## Merge Notes

- [x] Summarize handoff results back into the release summary
