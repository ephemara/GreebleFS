# OverlayTerm Wave Handoff

Last updated: 2026-04-14T23:46:00Z

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
- Objective: pressure-test the startup/presentation consistency fix, especially the app-vs-dock taskbar behavior, but do not widen scope unless you find a concrete gap.
- Exact files touched: `src/App.tsx`, `src/test/app.dockMode.test.tsx`.
- Exact code change: `syncWindowPresentation()` now preserves `showInTaskbar` when switching back to application mode, instead of hardcoding taskbar visibility off during the transition.
- Exact files reviewed: `src/store/settingsStore.ts`, `src/components/SettingsPage.tsx`, `src-tauri/src/lib.rs`, `src-tauri/src/window_commands.rs`, `src/test/settingsPage.behavior.test.tsx`, and this handoff file.
- Validation state: targeted Vitest run `bunx vitest run src/test/app.dockMode.test.tsx src/test/settingsPage.behavior.test.tsx` still fails to start locally.
- Blockers: local Vitest startup still fails with `ERR_MODULE_NOT_FOUND` for `vitest`, plus the existing `@vitejs/plugin-react` resolution gap. Rust-side validation was not needed for this narrow frontend fix.
- Next move: confirm no other mode-transition path still hardcodes taskbar visibility, then hand the cleanest remaining follow-up to the next lane.

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
- Files changed: `src-tauri/src/window_commands.rs`.
- Files reviewed and left unchanged: `src-tauri/src/lib.rs`, `src-tauri/src/startup_commands.rs`, `src-tauri/src/specta_bindings.rs`.
- Result: `window_apply_mode()` now routes taskbar visibility through `set_native_taskbar_visibility()`, so macOS uses dock visibility and other platforms keep `set_skip_taskbar` behavior aligned with the frontend `showInTaskbar` state.
- Validation: targeted `cargo test --manifest-path src-tauri/Cargo.toml main_tray_icon_id_is_stable -- --nocapture` failed during linking before tests could run.
- Blockers: local Rust validation still hits the mingw linker gap for `-lgcc_eh` and `-lgcc`.
- Next step: ot-runtime should keep verifying the persisted presentation sync path against the new native bridge, and only reopen `lib.rs` if a live startup smoke exposes a readback mismatch.

### ot-runtime -> ot-terminal
- Objective: finish runtime/state fallout from the startup and presentation change.
- Primary files: `src/App.tsx`, `src/store/settingsStore.ts`, `src/components/SettingsPage.tsx`, `src/test/app.dockMode.test.tsx`, `src/test/settingsPage.behavior.test.tsx`, `src/test/settingsStore.test.ts`.
- Result: App now syncs tray visibility and taskbar visibility from persisted system settings, and the store reset path restores the safe system defaults instead of preserving stale tray/taskbar state.
- Validation: targeted Vitest run `bunx vitest run src/test/app.dockMode.test.tsx src/test/settingsPage.behavior.test.tsx src/test/settingsStore.test.ts` is blocked locally by `ERR_MODULE_NOT_FOUND` for `vitest` plus the existing `@vitejs/plugin-react` config resolution gap.
- Next move: keep the lane narrow, and only revisit startup readback if the missing test runtime or a live smoke check exposes another presentation mismatch.

### ot-terminal -> ot-explorer
- Objective: validate dock-vs-application mode follow-through in the terminal-facing shell controls, and make sure the taskbar flag tracks `showInTaskbar` instead of a hardcoded off state.
- Primary files: `src/App.tsx`, `src/test/app.dockMode.test.tsx`, `src/components/TerminalOverlay.tsx`, `src/components/terminalCommandUtils.ts`, `src/test/terminalOverlay.test.tsx`, `src/test/terminalCommandUtils.test.ts`.
- Result: `src/test/app.dockMode.test.tsx` now checks the dock → application switch preserves the taskbar preference when `showInTaskbar` is enabled, which would catch a hardcoded-off regression in `syncWindowPresentation()`.
- Terminal controls check: the existing terminal overlay and `buildTerminalCdCommand` tests already cover the shell-aware CD injection and toolbar actions changed earlier in the wave.
- Next move: keep the explorer lane focused on any remaining presentation regressions only, then hand off to QA.

### ot-explorer -> ot-qa
- Objective: validate explorer and layout follow-through for the presentation change.
- Primary files: `src/App.tsx`, `src/components/FileExplorer.tsx`, `src/test/app.dockMode.test.tsx`, `src/test/fileExplorer.viewModes.test.tsx`.
- Result: fixed the broken compact-dock preview close paths in `FileExplorer` so dock mode clears/hides inline preview state instead of writing invalid fallback entries, and tightened the compact-dock explorer test to assert that inline previews stay closed there.
- Expected move: verify the explorer layout and visible panel behavior remain correct when switching modes.
- Validation: targeted Vitest rerun was attempted but blocked by the local exec approval gate before the test runner could start.

### ot-qa -> ot-cleo
- Objective: close the wave on real startup/presentation proof, not markdown churn.
- Exact code files changed this wave: `src/App.tsx`, `src-tauri/src/window_commands.rs`, `src/test/app.dockMode.test.tsx`.
- Exact code files reviewed and left unchanged: `src/components/SettingsPage.tsx`, `src/store/settingsStore.ts`, `src-tauri/src/lib.rs`, `src/test/settingsPage.behavior.test.tsx`.
- Exact tests run: `bunx vitest run src/test/app.dockMode.test.tsx src/test/settingsPage.behavior.test.tsx` and `cargo test --manifest-path src-tauri/Cargo.toml main_tray_icon_id_is_stable -- --nocapture`.
- Remaining blockers: local Vitest still fails to resolve `vitest/config`, `vitest`, and `@vitejs/plugin-react`; Rust validation still hits the mingw linker gap for `-lgcc_eh` and `-lgcc`.
- Next concrete code objective: restore local Vitest startup, rerun the two targeted tests, then only revisit `src-tauri/src/lib.rs` if validation exposes a startup readback gap.

## Current blockers

- Local Vitest startup has been flaky in earlier waves because of missing `vitest` / `@vitejs/plugin-react` resolution in some runs.
- Rust-side validation can still hit local mingw linker issues.
- Those blockers do not justify idle markdown churn. If they block a lane, the lane should either repair the toolchain or keep the code slice narrow enough to validate another way.
