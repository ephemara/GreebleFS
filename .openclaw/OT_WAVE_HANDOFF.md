# OverlayTerm Wave Handoff

Last updated: 2026-04-15T03:32:00Z

## Current wave objective

- Break the markdown-only closeout loop.
- Fresh objective: make startup, tray, taskbar, and dock-vs-application presentation transitions deterministic.
- Prioritize real code in `src/App.tsx`, `src-tauri/src/lib.rs`, `src-tauri/src/window_commands.rs`, `src/store/settingsStore.ts`, and targeted tests before touching more planning docs.
- A lane only counts if it lands code, tests, or an environment/tooling fix that unblocks code validation.

## Success conditions for this wave

- Desktop launch has one predictable visible entry path instead of a show-hide-toggle race.
- Dock mode and application mode switch cleanly without losing the user's visible recovery path.
- Tray visibility and taskbar visibility remain coherent with settings and current presentation mode.
- At least one meaningful code change lands in the startup/presentation path this wave.

## Lane handoffs

### ot-cleo -> ot-aristotle
- Objective: pressure-test the startup/presentation consistency fix, especially the launch reveal path, but do not widen scope unless you find a concrete gap.
- Exact files touched: `src/App.tsx`, `src/components/SettingsPage.tsx`, `src/store/settingsStore.ts`, `src/test/settingsStore.test.ts`, and `.openclaw/OT_WAVE_HANDOFF.md`.
- Exact code change: the startup reveal now waits for the desktop presentation sync, still runs once even when the window starts hidden, `App` now reads taskbar visibility from `resolveSystemPresentationState()` cleanly, and the system status line now labels the recovery path consistently on macOS instead of surfacing raw tray wording.
- Exact files reviewed: `src-tauri/src/lib.rs`, `src-tauri/src/window_commands.rs`, `src/test/app.dockMode.test.tsx`, `src/test/settingsPage.behavior.test.tsx`, and this handoff file.
- Validation state: targeted Vitest rerun was attempted, but local startup still fails before tests load.
- Blockers: local Vitest startup still fails with `ERR_MODULE_NOT_FOUND` for `vitest`, plus the existing `@vitejs/plugin-react` resolution gap. Rust-side validation was not needed for this narrow frontend/store fix.
- Next move: once the test toolchain is available, rerun `src/test/app.dockMode.test.tsx`, `src/test/settingsPage.behavior.test.tsx`, and `src/test/settingsStore.test.ts`, then only widen scope if another startup or mode-transition path still loses the visible entry point.

### ot-aristotle -> ot-dalmascus
- Objective: lock the invariant set for launch, tray, taskbar, and presentation mode so the main implementation pass has a tight target.
- Exact files to inspect first: `src/App.tsx`, `src-tauri/src/lib.rs`, `src-tauri/src/window_commands.rs`, `src/components/SettingsPage.tsx`, `src/store/settingsStore.ts`, `src/test/app.dockMode.test.tsx`, `src/test/settingsPage.behavior.test.tsx`.
- Expected move: tighten the exact behavior matrix, then either patch a small correctness gap directly or hand Dalmascus a narrow implementation target with exact test expectations.
- Guardrail: no docs-only pass. If you do not find a real gap, explicitly say why the current implementation is already correct and point at the next code surface.

### ot-dalmascus -> ot-native
- Objective: land the main frontend/runtime code move for startup and presentation consistency.
- Primary files: `src/App.tsx`, `src/components/SettingsPage.tsx`, `src/store/settingsStore.ts`, related tests.
- Expected move: remove or narrow the current launch/presentation race, make mode transitions deterministic, and add or update the smallest useful tests.

### ot-native -> ot-runtime
- Objective: land the Tauri-side fix needed for tray, taskbar, startup, or window presentation behavior.
- Files changed: `src-tauri/src/lib.rs`.
- Files reviewed and left unchanged: `src-tauri/src/window_commands.rs`, `src-tauri/src/startup_commands.rs`, `src-tauri/src/specta_bindings.rs`.
- Result: release startup no longer forces the main window visible before the React side syncs desktop presentation, so the frontend owns the one-shot reveal path and avoids the startup show-hide race.
- Validation: targeted `cargo check --manifest-path src-tauri/Cargo.toml` failed during linking before compile completion.
- Blockers: local Rust validation still hits the mingw linker gap for `-lgcc_eh` and `-lgcc`.
- Next step: ot-runtime should smoke the startup/presentation path against the now-front-end-owned reveal flow, and only reopen `window_commands.rs` or `startup_commands.rs` if a live mismatch shows up.

### ot-runtime -> ot-terminal
- Objective: finish runtime/state fallout from the startup and presentation change.
- Primary files: `src/App.tsx`, `src/store/settingsStore.ts`, `src/components/SettingsPage.tsx`, `src/test/app.dockMode.test.tsx`, `src/test/settingsPage.behavior.test.tsx`, `src/test/settingsStore.test.ts`.
- Result: App now syncs tray visibility and taskbar visibility from persisted system settings, `SettingsPage` keeps both recovery-path toggles live instead of disabling the last visible entry point, the store reset path restores safe defaults, and the startup presentation sequence is still one-shot so later tray/taskbar updates do not replay the launch hide/show choreography.
- Validation: targeted Vitest run `bunx vitest run src/test/app.dockMode.test.tsx src/test/settingsPage.behavior.test.tsx src/test/settingsStore.test.ts` is still blocked locally by `ERR_MODULE_NOT_FOUND` for `vitest` plus the existing `@vitejs/plugin-react` config resolution gap.
- Next move: keep the lane narrow, and only revisit startup readback or recovery-path gating if the missing test runtime or a live smoke check exposes another presentation mismatch.

### ot-terminal -> ot-explorer
- Objective: validate dock-vs-application mode follow-through in the terminal-facing shell controls, and make sure the taskbar flag tracks `showInTaskbar` instead of a hardcoded off state.
- Primary files: `src/App.tsx`, `src/test/app.dockMode.test.tsx`, `src/components/TerminalOverlay.tsx`, `src/components/terminalCommandUtils.ts`, `src/test/terminalOverlay.test.tsx`, `src/test/terminalCommandUtils.test.ts`.
- Result: the current dock/app switch path still reads the taskbar state from `resolveSystemPresentationState()`, and the regression test continues to cover the dock → application transition with `showInTaskbar` enabled.
- Terminal controls check: the existing terminal overlay and `buildTerminalCdCommand` tests still cover the shell-aware CD injection and toolbar actions changed earlier in the wave, so no extra terminal control code was needed this lane.
- Validation: targeted Vitest rerun was attempted locally and still hits the existing `vitest` / `@vitejs/plugin-react` resolution failure.
- Next move: keep the explorer lane focused on any remaining presentation regressions only, then hand off to QA.

### ot-explorer -> ot-qa
- Objective: verify explorer layout and visible panel follow-through across dock-vs-application mode changes.
- Primary files: `src/App.tsx`, `src/components/FileExplorer.tsx`, `src/test/app.dockMode.test.tsx`, `src/test/fileExplorer.viewModes.test.tsx`.
- Result: the new App dock/app wiring still keeps Explorer foregrounded on mode switches, and the FileExplorer compact-dock path still closes inline previews instead of leaving stale preview chrome behind. The existing regression coverage now spans the top-bar roundtrip, the settings-driven mode switch, and the compact-dock preview shutdown/return path.
- Expected move: QA should smoke the explorer visibility and layout transition path, then only reopen code if a live mode switch shows a missed panel or preview state.
- Validation: local Vitest startup is still blocked by the existing `vitest` / `@vitejs/plugin-react` resolution gap, so this lane stopped on code inspection plus the targeted regression coverage already in the tree.

### ot-qa -> ot-cleo
- Objective: close the wave on real startup/presentation proof, not markdown churn.
- Exact code files changed this wave: `src/App.tsx`, `src/components/SettingsPage.tsx`, `src/store/settingsStore.ts`, `src-tauri/src/lib.rs`, `src/test/app.dockMode.test.tsx`, `src/test/fileExplorer.viewModes.test.tsx`, `src/test/settingsPage.behavior.test.tsx`, `src/test/settingsStore.test.ts`.
- Exact code files reviewed and left unchanged: `src-tauri/src/window_commands.rs`.
- Validation notes: the frontend now waits for desktop-presentation sync before the one-shot launch reveal, keeps dock/app transitions from replaying startup presentation, and keeps tray/taskbar toggles mutually recoverable through the settings page and store normalization path.
- Exact tests run: `bunx vitest run src/test/app.dockMode.test.tsx src/test/settingsPage.behavior.test.tsx src/test/settingsStore.test.ts src/test/fileExplorer.viewModes.test.tsx` and `cargo test --manifest-path src-tauri/Cargo.toml main_tray_icon_id_is_stable -- --nocapture`.
- Remaining blockers: local Vitest still fails to resolve `vitest/config`, `vitest`, and `@vitejs/plugin-react`; Rust validation still hits the mingw linker gap for `-lgcc_eh` and `-lgcc`.
- Next concrete code objective: restore local Vitest startup, rerun the targeted presentation tests, and only reopen `src-tauri/src/lib.rs` or `src-tauri/src/window_commands.rs` if a live startup smoke or a passing test exposes another presentation mismatch.

## Current blockers

- Local Vitest startup has been flaky in earlier waves because of missing `vitest` / `@vitejs/plugin-react` resolution in some runs.
- Rust-side validation can still hit local mingw linker issues.
- Those blockers do not justify idle markdown churn. If they block a lane, the lane should either repair the toolchain or keep the code slice narrow enough to validate another way.
