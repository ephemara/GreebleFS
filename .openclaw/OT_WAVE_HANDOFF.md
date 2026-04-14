# OverlayTerm Wave Handoff

Last updated: 2026-04-14T21:12:00Z

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
- Objective: define the smallest high-leverage startup/presentation fix and open the code lane immediately.
- Exact files to inspect first: `SHIPPLAN.md`, `src/App.tsx`, `src-tauri/src/lib.rs`, `src-tauri/src/window_commands.rs`, `src/store/settingsStore.ts`, `src/test/app.dockMode.test.tsx`, `src/test/settingsPage.behavior.test.tsx`, and this handoff file.
- Expected move: identify the startup or mode-switch race that is most responsible for inconsistent behavior, patch the smallest safe part of it if obvious, then hand off exact invariants and files.
- Guardrail: do not spend the pass re-closing the performance spec or rewriting validation notes.

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
- Objective: land any Tauri-side fix needed for tray, taskbar, startup, or window presentation behavior.
- Primary files: `src-tauri/src/lib.rs`, `src-tauri/src/window_commands.rs`, `src-tauri/src/startup_commands.rs`, `src/generated/tauri.ts` if regeneration is required.
- Expected move: handle native fallout from the main implementation, especially around startup visibility, tray visibility, and taskbar behavior.

### ot-runtime -> ot-terminal
- Objective: finish runtime/state fallout from the startup and presentation change.
- Primary files: `src/App.tsx`, `src/store/settingsStore.ts`, `src/components/SettingsPage.tsx`, targeted tests.
- Expected move: make sure settings state and live presentation mode stay coherent after the code changes.

### ot-terminal -> ot-explorer
- Objective: validate dock-vs-application mode follow-through in the terminal-facing shell controls.
- Primary files: `src/App.tsx`, `src/test/app.dockMode.test.tsx`, terminal-facing mode switch UI.
- Expected move: tighten or add targeted tests around mode switching and visible shell behavior.

### ot-explorer -> ot-qa
- Objective: validate explorer and layout follow-through for the presentation change.
- Primary files: `src/App.tsx`, `src/components/FileExplorer.tsx`, `src/test/app.dockMode.test.tsx`.
- Expected move: verify the explorer layout and visible panel behavior remain correct when switching modes.

### ot-qa -> ot-cleo
- Objective: close the wave on real startup/presentation proof, not markdown churn.
- Expected validation: targeted tests for app mode switching and settings toggles, plus direct repo inspection of the changed startup/presentation code path.
- Required output: exact code files changed, exact tests run, blockers that still remain, and the next concrete code objective.

## Current blockers

- Local Vitest startup has been flaky in earlier waves because of missing `vitest` / `@vitejs/plugin-react` resolution in some runs.
- Rust-side validation can still hit local mingw linker issues.
- Those blockers do not justify idle markdown churn. If they block a lane, the lane should either repair the toolchain or keep the code slice narrow enough to validate another way.
