# GreebleFS Pass-Through Tasks

## Alpha — Release And Packaging

- [x] Confirm canonical release commands
- [x] Build production assets and bindings
- [ ] Produce Linux `deb` / `rpm` / `AppImage` outputs from one clean `bun run release:linux:bundle`
- [ ] Record exact artifact paths and signature status

## Delta — Integration And Docs

- [x] Update release notes and compatibility docs
- [x] Update distribution metadata and installer naming
- [ ] Run user-visible smoke checks on the built Linux artifact
- [ ] Hand off Windows signing and macOS signing/notarization requirements

## Charlie — Validation And Evidence

- [ ] Re-run or explicitly waive `bun run test:rust`
- [x] Complete checklist and build ledger
- [x] Record bug sweep findings, blockers, and workarounds

## Merge Notes

- [x] Summarize handoff results back into the release summary
