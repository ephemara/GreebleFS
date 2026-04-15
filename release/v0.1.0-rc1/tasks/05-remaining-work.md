# GreebleFS Remaining Work

## Blockers

- [ ] `bun run test:unit` failed with `9` files, `20` tests, and `2` unhandled errors.
- [ ] `bun run test:browser` failed in `src/test/browser/fileExplorer.repositoryPicker.browser.test.tsx`.
- [ ] `bun run release:linux:bundle` aborted with `Can't detect any appindicator library`.
- [ ] Re-establish `bun run test:rust` as a release gate or explicitly waive it with evidence.
- [ ] Complete Windows signing or distribution planning on a Windows-capable lane.
- [ ] Complete macOS signing or notarization planning on a macOS-capable lane.

## Caveats

- [ ] Legacy `OverlayTerm` plugin, runtime, and event identifiers remain for one RC to preserve compatibility.
- [ ] `co.greeblefs.app` currently triggers a Tauri bundle-identifier warning because it ends with `.app`.
- [ ] Production build still emits Rust warnings and large-chunk warnings.

## Next Actions

- [ ] Install `libayatana-appindicator3-dev` or an equivalent `pkg-config`-visible appindicator package on the Linux bundler host, then rerun `bun run release:linux:bundle`.
- [ ] Fix the red JS and browser suites, then rerun `bun run test:unit` and `bun run test:browser` to green.
- [ ] Re-run `bun run test:rust` to completion on a less time-constrained pass and either fix or explicitly waive any remaining long-running failures.
- [ ] After artifacts exist, capture paths into `02-build-and-validation.md` and smoke-test one installed Linux build.
- [ ] Decide whether to rename the bundle identifier away from the `.app` suffix before public release.

## External Dependencies

- [ ] Windows code-signing credentials and installer lane
- [ ] macOS signing and notarization credentials plus native build host
- [ ] Public release checksum or signing policy
- [ ] Linux package builder needs a `pkg-config`-visible appindicator development package. This host currently has `libayatana-appindicator3.so.1` installed at runtime, but `pkg-config` cannot resolve `ayatana-appindicator3-0.1` or `appindicator3-0.1`.
