# MEMORY.md - OT Aristotle

## Durable role

- Agent: OT Aristotle
- Lane: Architecture and systems lead
- Repo: F:\apps-2d\overlayterm
- Fleet root: F:\apps-2d\overlayterm\.openclaw

## Working rule

Push OverlayTerm toward premium, monetizable, final-boss quality.

## 2026-04-14 architecture pass

- Best remaining systems-level cleanup is the plugin live-reload path in `src/runtime/useFolderPluginRuntime.ts`.
- That hook still concentrates discovery, watcher setup, debounce handling, and polling fallback in one place, so it is the clearest leverage point for reducing runtime glue without changing product behavior.
- Keep future work aimed at separating watcher orchestration from plugin discovery and making fallback scanning cheaper and more explicit.

## 2026-04-14 follow-up pass

- Re-checked the current implementation direction and the same leverage point still holds.
- `useFolderPluginRuntime.ts` remains the clearest boundary to split next, because live reload currently bundles discovery, watcher lifecycle, debounce, and fallback policy together.
- The durable cleanup target is to make plugin discovery a simpler read path and move watcher/polling policy into a more explicit orchestration layer.

## 2026-04-14 spec pass

- Confirmed the performance spec should stay hybrid and risk-first, with Scenario A as the default baseline.
- GitManager already has visibility gating plus refresh coalescing, so the spec should harden that boundary instead of pretending the policy is absent.
- `useFolderPluginRuntime.ts` already behaves like an orchestration boundary, so the next spec tightening is to make that boundary explicit and keep fallback polling bounded.

## 2026-04-14 follow-up spec pass

- Re-checked the active performance spec and it still tracks repo reality cleanly.
- `GitManager` refresh sequencing remains the right boundary to harden, but the spec should keep its language focused on bounded resync and coalesced refreshes, not generic refresh churn.
- The diff-preview task is safe only if its fallback stays explicit, so the spec now treats omitted previews as a deliberate, explainable UX state rather than an implicit failure.

## 2026-04-14 final spec pass

- Final re-check shows no new architecture mismatch in the active performance spec.
- The current task ordering still makes sense, with baseline/instrumentation first, then git and GitManager, then previews, runtime reload, terminal, and validation closure.
- No spec edits were needed this round.

## 2026-04-14 late pass

- Another re-check still shows the active spec holding together cleanly.
- No new boundary, sequencing, or failure-handling gap surfaced in design or tasks.
- This pass required no spec changes.

## 2026-04-14 09:55 UTC pass

- Re-checked the active performance spec again and it still matches repo reality.
- No new spec tightening was needed.
- Boundary, sequencing, and failure-handling shape remains coherent.

## 2026-04-14 10:20 UTC pass

- Re-checked the active performance spec and found no new boundary or sequencing issue.
- Failure-handling and fallback language still aligns with the repo behavior already observed.
- No spec changes were needed.

## 2026-04-14 10:45 UTC pass

- Re-checked the active performance spec again and it still matches repo reality.
- No boundary, sequencing, or failure-handling tightening was needed.
- This pass required no spec edits.

## 2026-04-14 wave closeout audit

- Confirmed the closed 60fps performance spec still holds and does not need reopening from the hourly wave.
- Tightened the ot-aristotle -> ot-dalmascus handoff to stay no-reopen unless a concrete regression gap appears.
- No spec or code changes were needed beyond the handoff update.

## 2026-04-14 12:52 UTC wave closeout

- Re-checked the verified explorer-to-terminal path and the shell handoff still looks clean.
- `bun test src/test/terminalCommandUtils.test.ts` passed again, and `FileExplorer.tsx` still exposes `Open in Terminal` for directory entries.
- Updated the ot-aristotle -> ot-dalmascus handoff to keep the wave closed unless a real regression gap appears.

## 2026-04-14 13:53 UTC wave closeout

- Re-checked the verified explorer-to-terminal path again and found no new regression gap.
- `bun test src/test/terminalCommandUtils.test.ts` passed again, and `FileExplorer.tsx` still exposes `Open in Terminal` for directory entries.
- Updated the ot-aristotle -> ot-dalmascus handoff again to keep the wave closed unless a real regression gap appears.

## 2026-04-14 14:53 UTC wave closeout

- Pressure-tested the current wave objective against repo reality, and the plugin watcher fallback unwind is real and covered, so it belongs in the handoff scope too.
- `bun test src/test/terminalCommandUtils.test.ts` passed again, and `bunx vitest run src/test/useFolderPluginRuntime.fallback.test.tsx` is still blocked by the repo toolchain missing `vitest/config`, `@vitejs/plugin-react`, and the `vitest` package itself.
- Tightened the ot-aristotle -> ot-dalmascus handoff to include the plugin fallback unwind path, exact files, and blocker state.

## 2026-04-14 15:53 UTC wave closeout

- Re-checked the plugin watcher cleanup ordering against repo reality, and the code clears the attempted watch before entering fallback polling, but the unwatch cleanup remains best-effort background cleanup rather than a freshly proven serial await.
- `bun test src/test/terminalCommandUtils.test.ts` passed again, `bunx vitest run src/test/useFolderPluginRuntime.fallback.test.tsx` is still blocked by the same unresolved `vitest/config` and `@vitejs/plugin-react` imports, and the handoff wording was corrected to match that behavior.
- No code change was needed, just a tighter description of the actual unwind behavior.

## 2026-04-14 16:53 UTC wave closeout

- Rechecked the plugin fallback path again, and the cleanup-failure case is explicitly covered in `src/test/useFolderPluginRuntime.fallback.test.tsx` while `useFolderPluginRuntime.ts` logs cleanup failures and still falls back to polling.
- `bun test src/test/terminalCommandUtils.test.ts` passed again, and the fallback Vitest run is still blocked by unresolved `vitest/config` and `@vitejs/plugin-react` imports before execution can start.
- Tightened the handoff wording to name the cleanup-failure path instead of flattening it into a generic cleanup note.

## 2026-04-14 17:53 UTC wave closeout

- Rechecked the plugin fallback path one more time, and the current shape is now: failed watch setup clears the watcher, cleanup failures are logged, and fallback polling starts immediately.
- `bun test src/test/terminalCommandUtils.test.ts` passed again, and `bunx vitest run src/test/useFolderPluginRuntime.fallback.test.tsx` is still blocked before execution by unresolved `vitest/config` and `@vitejs/plugin-react` imports.
- Tightened the handoff wording again so it says exactly that, no stronger unwind claim.

## 2026-04-14 18:53 UTC wave closeout

- Rechecked the plugin fallback path again, and the cleanup-failure case is explicitly covered while unmount cleanup is retryable after a failure.
- `bun test src/test/terminalCommandUtils.test.ts` passed again, and the fallback Vitest run is still blocked before execution by unresolved `vitest/config` and `@vitejs/plugin-react` imports.
- Tightened the handoff wording again so it names retryable unmount cleanup after cleanup failure.

## 2026-04-14 19:54 UTC wave closeout

- Rechecked the plugin fallback path again, and the code now also retries cleanup if unmount lands mid-cleanup, so the handoff needs to name that race explicitly.
- `bun test src/test/terminalCommandUtils.test.ts` passed again, and `bunx vitest run src/test/useFolderPluginRuntime.fallback.test.tsx` is still blocked before execution by unresolved `vitest/config` and `@vitejs/plugin-react` imports.
- Tightened the handoff wording once more so it says retry cleanup on mid-cleanup unmount races.

## 2026-04-14 20:54 UTC wave closeout

- Rechecked the same plugin fallback edge one more time, and there is still no new regression gap beyond the already documented Vitest/config blocker.
- `bun test src/test/terminalCommandUtils.test.ts` passed again, and `bunx vitest run src/test/useFolderPluginRuntime.fallback.test.tsx` still fails at config load for missing `vitest/config`, `@vitejs/plugin-react`, and `vitest`.
- No code change was needed, just a fresh handoff refresh with the same verified blocker state.
