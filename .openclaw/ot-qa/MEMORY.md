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
