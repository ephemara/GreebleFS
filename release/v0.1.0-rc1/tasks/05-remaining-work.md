# GreebleFS Remaining Work

## Blockers

- [ ] Install the missing Linux appindicator dependency and finish one clean `bun run release:linux:bundle` run.
- [ ] Re-establish `bun run test:rust` as a release gate or explicitly waive the failing/slow Rust tests with evidence.
- [ ] Complete Windows signing/distribution planning on a Windows-capable lane.
- [ ] Complete macOS signing/notarization planning on a macOS-capable lane.

## Caveats

- [ ] Legacy `OverlayTerm` plugin/runtime/event identifiers remain for one RC to preserve compatibility.
- [ ] `co.greeblefs.app` currently triggers a Tauri bundle-identifier warning because it ends with `.app`.
- [ ] Production build still emits Rust warnings and large-chunk warnings.

## Next Actions

- [ ] Ensure only one Tauri build process is active, then rerun `bun run release:linux:bundle`.
- [ ] After artifacts exist, capture paths into `02-build-and-validation.md` and smoke-test one installed Linux build.
- [ ] Decide whether to rename the bundle identifier away from the `.app` suffix before public release.

## External Dependencies

- [ ] Windows code-signing credentials and installer lane
- [ ] macOS signing and notarization credentials plus native build host
- [ ] Public release checksum/signing policy
