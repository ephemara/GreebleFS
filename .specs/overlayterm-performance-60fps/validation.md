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
- Validation attempt: `bunx vitest run src/test/performanceTelemetry.test.ts` failed locally because the repo environment could not resolve `vitest` from `vitest.config.ts`.
- 2026-04-14, git_exec hardening verification pass: confirmed the backend already enforces a 20s timeout, returns exit code plus stderr/stdout context on failure, and runs in `spawn_blocking` so the UI thread stays clear.
- Validation attempt: `cargo test --manifest-path src-tauri/Cargo.toml git_exec -- --nocapture` failed in the local environment because `x86_64-w64-mingw32-gcc` could not link `-lgcc_eh` / `-lgcc`.
- 2026-04-14, workflow-tools pass: refined `scripts/run-heartbeat-pass.mjs` so future heartbeat passes surface the active performance spec, the baseline scenario, and spec-aware validation hints for the current changed-file set.
- 2026-04-14, runtime-content reload pass: added developer-mode polling for theme package discovery so theme changes now auto-refresh the theme, shader, and animation inventories from the shared runtime content surface.
- 2026-04-14, GitManager visibility-aware refresh pass: queued hidden repo-state refreshes now defer until visibility restores, and the restore path performs one bounded repo-state resync instead of replaying refresh churn.
- Validation attempt: `bunx vitest run src/test/gitManager.behavior.test.tsx` failed locally because the repo environment could not resolve `vitest` from `vitest.config.ts`.
- Validation target: `python3 scripts/validate_spec.py ./.specs/overlayterm-performance-60fps`
- Validation note: this environment still lacks `python3` on PATH, so the spec validator could not be executed here.
