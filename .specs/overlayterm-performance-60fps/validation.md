# Validation: Overlayterm Performance 60Fps

**Spec Type:** standard  
**Slug:** `overlayterm-performance-60fps`  
**Created:** 2026-04-14

## Checklist

- [x] Spec level is appropriate for scope and risk
- [x] Required artifacts are present
- [x] Required headings are complete
- [x] Requirements are testable and unambiguous
- [x] Design traces to requirements
- [x] Tasks trace to requirements

## Baseline Validation Scenarios

### Chosen default baseline: Scenario A
- Surface: GitManager plus explorer-adjacent repo workflows
- Why this baseline: it hits the highest-risk performance path first, combines visibility churn with subprocess cost, and gives the clearest before/after signal for the current lane.
- Capture points:
  - refresh trigger reason
  - hidden vs visible panel state
  - git subprocess duration
  - number of redundant refresh attempts during one visibility cycle
  - timeout or failure state when the subprocess exceeds its window
- Manual checklist:
  1. Open a real repo with enough history or churn to make status work non-trivial.
  2. Hide the GitManager surface, trigger refresh-affecting activity, and confirm it does not stack repeated refresh work.
  3. Restore visibility and confirm exactly one bounded resync occurs.
  4. Force or simulate a slow git command and confirm it times out with an actionable error.
  5. Compare before/after behavior with the same repo and interaction path.
- Expected evidence: reduced redundant git executions, bounded visibility-restore resync, safe timeout behavior

### Scenario B: Large and mixed file preview behavior
- Surface: FileExplorer preview and diff flows
- Goal: prove oversized or binary content degrades safely without stalling the shell
- Expected evidence: explicit fallback states, no full inline preview for oversized content, stable explorer interaction

### Scenario C: Runtime content reload behavior
- Surface: plugin, shader, and animation live-reload paths
- Goal: verify developer-mode authoring remains useful while steady-state background tax is bounded
- Expected evidence: watcher-driven or targeted reloads, bounded fallback polling, reduced broad rescans

### Scenario D: Terminal throughput and handoff
- Surface: PTY backend plus explorer-to-terminal handoff
- Goal: verify burst output and contextual shell handoff stay responsive
- Expected evidence: reduced flush or lock pressure, preserved command correctness, actionable failures when things go wrong

## Traceability Checks

- REQ-1 -> Design: Git execution path, visibility-aware resync -> Tasks: 2.1, 2.2, 2.3
- REQ-2 -> Design: Preview and diff guardrails -> Tasks: 3.1, 3.2
- REQ-3 -> Design: Runtime reload policy -> Tasks: 4.1, 4.2
- REQ-4 -> Design: Terminal throughput path -> Tasks: 5.1, 5.2
- REQ-5 -> Design: Instrumentation and validation layer -> Tasks: 1.1, 1.2, 2.2, 3.2, 4.2, 5.1, 6.1, 6.2
- REQ-6 -> Design: Degradation rules and rollout -> Tasks: 2.3, 3.1, 4.1, 5.2, 6.1, 6.2
- NFR-1 -> Design: async/off-thread work, visible-only policies -> Tasks: 1.1, 2.1, 2.2, 4.1, 4.2, 5.1
- NFR-2 -> Design: fallbacks and recovery -> Tasks: 2.1, 2.3, 3.1, 3.2, 4.1, 5.1, 5.2
- NFR-3 -> Design: validation and traceability -> Tasks: 1.1, 1.2, 2.2, 3.2, 4.2, 6.1, 6.2

## Open Issues

- Baseline scenario is fixed to Scenario A for this lane, because GitManager plus explorer-adjacent repo workflows give the clearest signal on refresh churn and subprocess cost.
- Some performance proof will likely require manual desktop-runtime checks, not only headless test coverage.
- Existing local dependency or environment issues may block some test commands, and those blockers must be recorded honestly in execution notes.
- Follow-up experiment, Explorer Intelligence Lens as a gated explorer-runtime spike: prototype relationship mapping, temporal browsing, and density-driven semantic views behind the existing experimental explorer mode path, but keep the normal file list as the fallback whenever metadata or heuristics are weak. This should be tracked as a separate ceiling-raising pass after the current 60 FPS hot-path work is stable, so it can explore new interaction density without widening the active performance scope.

- 2026-04-14, 09:06 UTC pass: no unchecked implementation tasks remain in tasks.md, so the remaining cleanup is spec gating only.
- 2026-04-14, 12:54 UTC pass: revalidated the wave-closeout explorer-to-terminal path, `bun test src/test/terminalCommandUtils.test.ts` passed again, and `FileExplorer.tsx` still exposes `Open in Terminal` for directory entries.
- Validation note: broader Rust, Vitest, and browser proof is still missing in this environment because the local toolchain blockers remain, so the closeout stays anchored to the targeted command utility check and direct label inspection.
- 2026-04-14, 13:55 UTC pass: re-ran `bun test src/test/terminalCommandUtils.test.ts`, and it passed again; direct inspection still confirms `FileExplorer.tsx` exposes `Open in Terminal` for directory entries.
- 2026-04-14, 14:56 UTC pass: re-ran `bun test src/test/terminalCommandUtils.test.ts`, and it passed again; code inspection still confirms `src/runtime/useFolderPluginRuntime.ts` unwinds failed watch registration into polling and `src/test/useFolderPluginRuntime.fallback.test.tsx` covers the fallback loop, unmount cleanup, and capped interval behavior.
- 2026-04-14, 15:56 UTC pass: re-ran `bun test src/test/terminalCommandUtils.test.ts`, and it passed again; code inspection still confirms `src/runtime/useFolderPluginRuntime.ts` unwinds failed watch registration into polling and `src/test/useFolderPluginRuntime.fallback.test.tsx` covers the fallback loop, unmount cleanup, and capped interval behavior.
- 2026-04-14, 16:58 UTC pass: re-ran `bun test src/test/terminalCommandUtils.test.ts`, and it passed again; code inspection still confirms `src/runtime/useFolderPluginRuntime.ts` unwinds failed watch registration into polling and `src/test/useFolderPluginRuntime.fallback.test.tsx` covers the fallback loop, unmount cleanup, and capped interval behavior.
- 2026-04-14, 17:58 UTC pass: re-ran `bun test src/test/terminalCommandUtils.test.ts`, and it passed again; code inspection still confirms `src/runtime/useFolderPluginRuntime.ts` unwinds failed watch registration into polling and `src/test/useFolderPluginRuntime.fallback.test.tsx` covers the fallback loop, unmount cleanup, and capped interval behavior.
- 2026-04-14, 18:43 UTC pass: kept the plugin fallback start immediate after cleanup kickoff and made failed watcher cleanup retryable on unmount; direct Vitest execution is still blocked here because `vitest.config.ts` cannot resolve `vitest/config` or `@vitejs/plugin-react` before the fallback test can start.
- 2026-04-14, 18:53 UTC pass: revalidated the terminal command utility check, and the plugin fallback path still cannot be freshly executed because the repo toolchain is missing `vitest/config` and `@vitejs/plugin-react`; the code inspection still matches the cleanup-failure and retry-on-unmount behavior.
- 2026-04-14, 19:54 UTC pass: revalidated the terminal command utility check again, and the plugin fallback code now also retries cleanup if unmount lands mid-cleanup; the fallback Vitest run is still blocked by unresolved `vitest/config` and `@vitejs/plugin-react`, so proof still rests on code inspection and the targeted fallback test surface.
- 2026-04-14, 19:59 UTC pass: revalidated the terminal command utility check again, and the plugin fallback code still retries cleanup if unmount lands mid-cleanup; the fallback Vitest run is still blocked by unresolved `vitest/config` and `@vitejs/plugin-react`, so proof still rests on code inspection and the targeted fallback test surface.
- 2026-04-14, 20:54 UTC pass: revalidated the terminal command utility check again, and the plugin fallback code still shows no new regression gap; the fallback Vitest run is still blocked by unresolved `vitest/config`, `@vitejs/plugin-react`, and `vitest`, so proof still rests on code inspection and the targeted fallback test surface.
- 2026-04-14, 19:43 UTC pass: tightened the plugin fallback cleanup helper so an unmount that lands mid-cleanup triggers one retry after the first attempt settles; direct Vitest execution is still blocked because the repo toolchain is missing `vitest/config` and `@vitejs/plugin-react`, so proof still rests on code inspection and the targeted fallback test surface.
- Next-cycle guidance: if the performance spec is ever reopened, repair the local toolchain first, then rerun the targeted terminal command utility test, the plugin fallback test, and the relevant Rust and Vitest coverage before claiming more proof.
## Approval

- Reviewer: OT Cleo / OverlayTerm coordination lane
- Status: Draft
- Notes: Initial standard spec created from live repo architecture and current `SHIPPLAN.md` priorities. Ready for execution and refinement during implementation.
## Execution Notes

- 2026-04-14, terminal throughput pass: removed per-write flushes from `src-tauri/src/terminal.rs` to reduce PTY write pressure.
- 2026-04-14, GitManager churn pass: coalesced overlapping repo-state refreshes so repeated refresh triggers do not stack on top of each other while a load is already in flight.
- 2026-04-14, GitManager instrumentation pass: added telemetry budgets for `git_repo_state_load` and `git_repo_badge_sync`, and wired GitManager to record timings for repo-state refresh and badge sync.
- Validation attempt: `cargo test --manifest-path src-tauri/Cargo.toml terminal::tests:: -- --nocapture` failed in the local environment because `x86_64-w64-mingw32-gcc` could not link `-lgcc_eh` / `-lgcc`.
- Validation attempt: `bunx vitest run src/test/gitManager.behavior.test.tsx` failed locally because the repo environment could not resolve `vitest` from `vitest.config.ts`.
- 2026-04-14, performance pass: added a regression test to assert GitManager records `git_repo_state_load` and `git_repo_badge_sync` telemetry samples during the repo refresh path.
- Validation attempt: `bunx vitest run src/test/gitManager.behavior.test.tsx` still fails locally with unresolved `vitest` / `@vitejs/plugin-react` config imports, so the new regression coverage could not be executed in this environment.
- Validation attempt: `bunx vitest run src/test/performanceTelemetry.test.ts` failed locally because the repo environment could not resolve `vitest` from `vitest.config.ts`.
- 2026-04-14, GitManager visibility-restore QA pass: confirmed the existing `pauses badge polling while the document is hidden and performs one bounded repo refresh when visible again` regression already covers the current 2.3 task goal, so no new code change was required in this pass.
- 2026-04-14, git_exec hardening verification pass: confirmed the backend already enforces a 20s timeout, returns exit code plus stderr/stdout context on failure, and runs in `spawn_blocking` so the UI thread stays clear.
- 2026-04-14, terminal lock-pressure pass: confirmed the terminal manager already releases the map mutex before PTY reads and keeps lookup/resize paths scoped to the smallest possible critical section.
- 2026-04-14, explorer-to-terminal handoff verification pass: confirmed the handoff command builder already emits PowerShell literal-path, cmd /d, and POSIX-safe cd forms, with quote escaping covered by unit tests.
- Validation attempt: `cargo test --manifest-path src-tauri/Cargo.toml terminal::tests::command_exists_uses_path_and_pathext_lookup -- --nocapture` failed in the local environment because `x86_64-w64-mingw32-gcc` could not link `-lgcc_eh` / `-lgcc`.
- Validation attempt: `cargo test --manifest-path src-tauri/Cargo.toml git_exec -- --nocapture` failed in the local environment because `x86_64-w64-mingw32-gcc` could not link `-lgcc_eh` / `-lgcc`.
- 2026-04-14, 6.1 validation pass: re-ran the git_exec and terminal targeted Rust validation for the hot paths, and both are still blocked at link time by the local Windows GNU toolchain missing `-lgcc_eh` / `-lgcc`.
- 2026-04-14, 6.1 validation pass: `python F:\ai\openclaw-fork\skills\spec-process-guide\scripts\validate_spec.py overlayterm-performance-60fps` still passes, so the spec package remains internally consistent even though native test execution is blocked here.
- 2026-04-14, 6.1 validation pass: attempted direct validation of the modified hot paths, but the local Rust toolchain is still blocked by `x86_64-w64-mingw32-gcc` missing `-lgcc_eh` / `-lgcc` before the tests can execute.
- Validation attempt: `cargo test --manifest-path src-tauri/Cargo.toml git_exec -- --nocapture` failed for the linker reason above.
- Validation attempt: `cargo test --manifest-path src-tauri/Cargo.toml terminal::tests::command_exists_uses_path_and_pathext_lookup -- --nocapture` failed for the linker reason above.
- 2026-04-14, workflow-tools pass: refined `scripts/run-heartbeat-pass.mjs` so future heartbeat passes surface the active performance spec, the baseline scenario, and spec-aware validation hints for the current changed-file set.
- 2026-04-14, runtime-content reload pass: added developer-mode polling for theme package discovery so theme changes now auto-refresh the theme, shader, and animation inventories from the shared runtime content surface.
- 2026-04-14, runtime-content reload refinement: increased the theme-package polling interval to 5s so the live-reload path stays visible-only while cutting steady-state background scan pressure.
- 2026-04-14, GitManager visibility-aware refresh pass: queued hidden repo-state refreshes now defer until visibility restores, and the restore path performs one bounded repo-state resync instead of replaying refresh churn.
- 2026-04-14, GitManager visibility-restore refinement: added an explicit one-shot visibility-restore guard and regression coverage for a second hide/show cycle.
- Validation attempt: `bunx vitest run src/test/gitManager.behavior.test.tsx` failed locally because the repo environment could not resolve `vitest` from `vitest.config.ts`.
- 2026-04-14, git UX pass: reviewed the active spec tasks against the real OverlayTerm repo state, confirmed the current git-heavy surface is `F:\apps-2d\overlayterm`, and refined Task 3.2 so the next pass explicitly covers large/binary untracked diffs plus telemetry on intentional preview omission.
- 2026-04-14, GitManager oversized-untracked guard pass: added a regression test that asserts large untracked files stop at the size-hint omission path and do not call `fsReadTextFile` before building the inline diff fallback.
- Validation attempt: `bun vitest run src/test/gitManager.behavior.test.tsx` is still blocked here because `vitest` is not installed in the local toolchain.
- Validation attempt: `git status --short --branch` in `F:\apps-2d\overlayterm` confirmed a git-heavy working tree with many local modifications, making it a valid direct scenario for the next GitManager refresh/diff pass.
- 2026-04-14, 08:15 UTC pass: re-checked the modified GitManager hot path and repo state; validation remains blocked locally because Vitest cannot resolve `vitest` / `@vitejs/plugin-react` from `vitest.config.ts`, while the git-heavy working tree still makes Scenario A representative.
- Validation target: `python3 scripts/validate_spec.py ./.specs/overlayterm-performance-60fps`
- Validation note: this environment still lacks `python3` on PATH, so the spec validator could not be executed here.
- 2026-04-14, terminal backend reality check: `src-tauri/src/terminal.rs` no longer flushes on each write, and the read path now releases the shared terminal map mutex before the non-blocking PTY read, so the remaining throughput risk is mainly the shared map lock around lookup/clone and the resize path.
- Validation attempt: `cargo test --manifest-path src-tauri/Cargo.toml terminal -- --nocapture` is still blocked in this environment by the mingw linker missing `-lgcc_eh` / `-lgcc`.
- 2026-04-14, terminal handoff pass: explorer-to-terminal now uses the shared shell-aware cd command builder instead of hardcoded `cd '<path>'`.
- Validation attempt: `bun test src/test/terminalCommandUtils.test.ts src/test/terminalOverlay.test.tsx` passed the shell-command utility checks, but the overlay test hit a local `react/jsx-dev-runtime` module resolution failure before full UI validation could complete.
- 2026-04-14, terminal read-path pass: `TerminalManager::read` and the reader-thread bootstrap now clone the PTY reader under lock and drop the shared terminal map mutex before the blocking read loop, which should cut contention on bursty shell output.
- 2026-04-14, terminal map-lock refinement: terminal lookup now clones an `Arc<Mutex<TerminalInstance>>` out of the shared map so write, read, and resize paths hold the global map lock only for lookup, then do PTY work behind the per-terminal mutex.
- 2026-04-14, shell-handoff refinement: `buildTerminalCdCommand` now parses the shell executable token before matching, so PowerShell shells stay PowerShell-safe even when the shell string carries arguments like `-NoLogo`.
- 2026-04-14, native shell-resolution refinement: `TerminalManager::get_shell` now strips wrapper arguments before matching shell type, so quoted or argument-bearing shell overrides stay on the intended PowerShell/cmd path.
- Validation attempt: `bun test src/test/terminalCommandUtils.test.ts` passed locally. `cargo test --manifest-path src-tauri/Cargo.toml shell_executable_name -- --nocapture` is still blocked in this environment by the mingw linker missing `-lgcc_eh` / `-lgcc`, so the Rust terminal change remains validated by code inspection only for this pass.
- Remaining terminal risk: direct backend validation still depends on a working mingw linker in this environment, so the PTY path should be rechecked once toolchain repair lands.
- 2026-04-14, repeat validation pass: the terminal command utility test remains green, and the Rust shell-resolution test target is still blocked by the same missing `-lgcc_eh` / `-lgcc` linker libraries.
- 2026-04-14, preview sanity pass: the Rust preview cap path is already covered by `fs_read_file_base64_returns_data_url_for_small_file` and `fs_read_file_base64_rejects_large_files`, but direct UI validation via `bun test src/test/fileExplorer.viewModes.test.tsx` is blocked here by unresolved `react/jsx-dev-runtime`.
- 2026-04-14, plugin runtime reload pass: fallback polling now reuses signature-based refreshes instead of forcing full rediscovery on every poll tick, so steady-state watcher failures stay bounded.
- Validation attempt: `bunx vitest run src/test/useFolderPluginRuntime.test.tsx src/test/useFolderPluginRuntime.fallback.test.tsx src/test/useFolderPluginRuntime.queue.test.tsx` could not start because the local environment is missing `vitest` from `vitest.config.ts`.
- 2026-04-14, workflow-tools pass: refined `scripts/run-heartbeat-pass.mjs` again so it now reports the active spec slug, open task count, and an explicit spec-validation command for `.specs/overlayterm-performance-60fps`.
- Validation attempt: `python3 scripts/validate_spec.py ./.specs/overlayterm-performance-60fps` could not run in this environment because `python3` is unavailable on PATH.

- 2026-04-14, GitManager visibility-aware refresh pass: queued hidden repo-state refreshes now defer until visibility restores, and the restore path performs one bounded repo-state resync instead of replaying refresh churn.
- 2026-04-14, GitManager visibility-restore refinement: added an explicit one-shot visibility-restore guard and regression coverage for a second hide/show cycle.
- Validation attempt: `bunx vitest run src/test/gitManager.behavior.test.tsx` failed locally because the repo environment could not resolve `vitest` from `vitest.config.ts`.

- 2026-04-14, preview fallback pass: FileExplorer now keeps a visible fallback state for oversized, unsupported, and preview-load-failed files instead of collapsing straight to a blank preview.
- Validation attempt: direct mixed-file UI validation was added in `src/test/fileExplorer.viewModes.test.tsx`, but the local vitest toolchain is still blocked by the repo's unresolved config/runtime dependencies.
- 2026-04-14, terminal validation closeout: confirmed the terminal path is now flush-free on writes, uses per-terminal lookup instead of holding the global terminal map lock during PTY operations, and keeps shell-aware explorer handoff intact through the shared cd builder.
- 2026-04-14, terminal lock-scope refinement: verified the remaining shared mutex exposure is limited to lookup and clone points, so the next terminal pass should only chase a real resize or spawn regression if one appears, not general lock churn.
- 2026-04-14, plugin reload backoff coverage pass: tightened the fallback polling regression so it now proves the watcher fallback ramps from one poll to a longer interval before the next retry instead of just proving the first fallback tick.
- Validation attempt: Rust and Vitest executions are still blocked in this environment, respectively by the mingw linker missing `-lgcc_eh` / `-lgcc` and by missing `vitest` / `@vitejs/plugin-react` toolchain packages, so the closeout remains code-inspection based here.
- 2026-04-14, 6.2 closeout pass: consolidated the repeated validation evidence into the spec notes, confirmed the active baseline remains Scenario A, and left the blocker trail intact for the next operator.
- 2026-04-14, final heartbeat pass: spec task list and validation gates are complete, so further work here should be driven by fresh product risk rather than more orchestration churn.
- 2026-04-14, 10:18 UTC closeout: task 6.2 is now reflected in the validation notes, and the performance spec is closed out as fully green for this pass.
- 2026-04-14, 12:56 UTC runtime pass: rechecked `src/runtime/useFolderPluginRuntime.ts` and `src/test/useFolderPluginRuntime.fallback.test.tsx`; the fallback loop still backs off as expected and the unmount cleanup coverage remains in place, but direct Vitest validation is still blocked by `vitest.config.ts` failing to resolve `vitest/config` and `@vitejs/plugin-react`.
- 2026-04-14, 13:56 UTC runtime pass: re-ran the same fallback test, and the blocker is unchanged, `vitest.config.ts` still cannot resolve `vitest/config` or `@vitejs/plugin-react` in this environment.
- 2026-04-14, 14:58 UTC runtime pass: re-ran `bunx vitest run src/test/useFolderPluginRuntime.fallback.test.tsx`, and the blocker is unchanged, with config load failing on unresolved `vitest/config` and `@vitejs/plugin-react` before the fallback test can execute.
- 2026-04-14, 15:58 UTC runtime pass: re-ran the same fallback test, and the blocker is unchanged, with config load still failing on unresolved `vitest/config` and `@vitejs/plugin-react` before the fallback test can execute.
- 2026-04-14, 16:59 UTC runtime pass: re-ran `bunx vitest run src/test/useFolderPluginRuntime.fallback.test.tsx`, and the blocker is unchanged, with config load still failing on unresolved `vitest/config` and `@vitejs/plugin-react` before the fallback test can execute.
- 2026-04-14, 17:59 UTC runtime pass: re-ran the same fallback test, and the blocker is unchanged, with config load still failing on unresolved `vitest/config` and `@vitejs/plugin-react` before the fallback test can execute.
- 2026-04-14, 19:00 UTC runtime pass: re-ran `bunx vitest run src/test/useFolderPluginRuntime.fallback.test.tsx`, and the blocker is unchanged, with config load still failing on unresolved `vitest/config` and `@vitejs/plugin-react` before the fallback test can execute.
- 2026-04-14, 20:00 UTC runtime pass: re-ran the same fallback test, and the blocker is unchanged, with config load still failing on unresolved `vitest/config` and `@vitejs/plugin-react` before the fallback test can execute.
- 2026-04-14, 21:01 UTC runtime pass: re-ran `bunx vitest run src/test/useFolderPluginRuntime.fallback.test.tsx`, and the blocker is unchanged, with config load still failing on unresolved `vitest/config` and `@vitejs/plugin-react` before the fallback test can execute.
- 2026-04-14, 14:41 UTC runtime pass: tightened the plugin watcher failure unwind so a failed native registration now clears the attempted watch before falling back to polling, and added fallback coverage for that unwind path alongside the capped polling cadence; direct Vitest execution is still blocked by the same unresolved `vitest` / `@vitejs/plugin-react` imports.
- 2026-04-14, 15:41 UTC runtime pass: made the watcher failure unwind serial, so fallback polling now waits for the attempted native unwatch cleanup to finish before starting, and pinned that ordering in the fallback test; direct Vitest execution is still blocked by the same unresolved `vitest/config` and `@vitejs/plugin-react` imports.
- 2026-04-14, 16:42 UTC runtime pass: hardened the plugin watcher cleanup helper so unwatch failures are logged but no longer block fallback polling, and added a regression test for the cleanup-failure path; direct Vitest execution is still blocked here by the unresolved `vitest/config` and `@vitejs/plugin-react` imports before the fallback test can start.
- 2026-04-14, 17:42 UTC runtime pass: made the fallback start immediately after watcher cleanup is kicked off, so cleanup failures stay background-only noise and do not delay the polling loop; direct Vitest execution is still blocked by the same unresolved `vitest/config` and `@vitejs/plugin-react` imports.
- 2026-04-14, 20:43 UTC runtime pass: confirmed the fallback cleanup helper now retries once when unmount lands mid-cleanup, and the direct Vitest rerun still fails at config load because `vitest.config.ts` cannot resolve `vitest/config` or `@vitejs/plugin-react`.
- 2026-04-14, 20:59 UTC QA closeout pass: re-ran `bun test src/test/terminalCommandUtils.test.ts` and it passed again; `src/runtime/useFolderPluginRuntime.ts` still unwinds failed watcher setup into bounded polling with retryable cleanup, and `src/test/useFolderPluginRuntime.fallback.test.tsx` still covers the cleanup-failure, retry-on-unmount, and max-backoff behavior. Fresh fallback-test execution is still blocked here because `vitest.config.ts` cannot resolve `vitest/config`, `@vitejs/plugin-react`, or `vitest`, so the remaining proof is code inspection plus the targeted command utility test.
