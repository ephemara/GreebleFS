# GreebleFS Pass-Through Tasks

## Alpha — Release And Packaging

- [x] Confirm canonical release commands
- [x] Build production assets and bindings
- [ ] Install the required appindicator development library on the Linux packaging host, then rerun `bun run release:linux:bundle`
- [ ] Record exact artifact paths and signature status

## Delta — Integration And Docs

- [x] Update release notes and compatibility docs
- [x] Update distribution metadata and installer naming
- [ ] Run user-visible smoke checks on the built Linux artifact
- [ ] Hand off Windows signing and macOS signing/notarization requirements

## Charlie — Validation And Evidence

- [ ] Investigate or explicitly waive `fs_commands::tests::external_path_invalidation_refreshes_parent_directory_listing_cache`
- [ ] Decide whether the long-running search/transfer Rust tests need isolation, extra timeout budget, or a targeted split
- [x] Complete checklist and build ledger
- [x] Record bug sweep findings, blockers, and workarounds

## Merge Notes

- [x] Summarize handoff results back into the release summary
