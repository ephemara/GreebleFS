# MEMORY.md - OT QA

## Durable role

- Agent: OT QA
- Lane: Quality, perf, and crash-hardening lead
- Repo: F:\apps-2d\overlayterm
- Fleet root: F:\apps-2d\overlayterm\.openclaw

## Working rule

Push OverlayTerm toward premium, monetizable, final-boss quality.

## 2026-04-14 QA note
- Verified `buildTerminalCdCommand()` outputs shell-specific handoff commands for PowerShell, cmd, and Unix shells, including apostrophe escaping.
- Checked GitManager polling throttling for hidden documents and file-size hint caching for untracked diff previews.
- Local Vitest run is currently blocked by missing `vitest` / `@vitejs/plugin-react` resolution in this workspace, so direct function execution was used for validation instead.
- For `.specs/overlayterm-performance-60fps`, chose Scenario A as the default baseline because it best exercises GitManager refresh churn, hidden/visible transitions, and subprocess timeout risk.
- Added regression coverage for GitManager telemetry sampling (`git_repo_state_load`, `git_repo_badge_sync`) so the performance lane has a direct assertion on measurable hot-path instrumentation.
- Local Vitest execution for that regression is still blocked by unresolved `vitest` / `@vitejs/plugin-react` config imports in this workspace.
- Confirmed the visibility-restore lane already has coverage via the `pauses badge polling while the document is hidden and performs one bounded repo refresh when visible again` test, so task 2.3 is effectively closed for the current spec state.
- Re-ran targeted Rust validation for task 6.1 (`git_exec` and terminal paths); both are still blocked in this environment by the Windows GNU linker missing `-lgcc_eh` / `-lgcc`, while spec validation continues to pass.
- 2026-04-14, 6.2 closeout pass: consolidated the repeated validation evidence, confirmed Scenario A remains the baseline, and left the blocker trail intact for the next operator.
- 2026-04-14, hourly wave closeout: `bun test src/test/terminalCommandUtils.test.ts` passed, `FileExplorer.tsx` still exposes `Open in Terminal` for directory entries, and the OT wave handoff now points the next cycle at a fresh product risk instead of reopening the closed performance spec.
- 2026-04-14, 12:54 UTC closeout: revalidated the explorer-to-terminal path, noted the remaining missing proof is full Rust/Vitest/browser execution because the local toolchain is still blocked, and left the next-cycle guidance in `OT_WAVE_HANDOFF.md` and the spec validation notes.
- 2026-04-14, 13:55 UTC closeout: re-ran `bun test src/test/terminalCommandUtils.test.ts` and confirmed `FileExplorer.tsx` still exposes `Open in Terminal`; the wave remains closed and the next cycle should start from a fresh product risk unless the toolchain is repaired first.
- 2026-04-14, 14:56 UTC closeout: re-ran `bun test src/test/terminalCommandUtils.test.ts`, inspected the plugin fallback unwind in `src/runtime/useFolderPluginRuntime.ts`, and confirmed the next proof gap is still `vitest` / `@vitejs/plugin-react` resolution for `src/test/useFolderPluginRuntime.fallback.test.tsx`.
- 2026-04-14, 15:56 UTC closeout: re-ran `bun test src/test/terminalCommandUtils.test.ts`, rechecked the plugin fallback unwind, and confirmed the wave remains closed while the only fresh gap is still `vitest` / `@vitejs/plugin-react` resolution for `src/test/useFolderPluginRuntime.fallback.test.tsx`.
