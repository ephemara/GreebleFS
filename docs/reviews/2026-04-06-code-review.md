# OverlayTerm Code Review

Date: 2026-04-06

Scope:
- Full repo review with emphasis on Tauri/Rust desktop shell, startup/windowing behavior, and the current working tree.
- Findings below are limited to concrete bugs, regressions, or high-risk behavior.

Reviewed state:
- This review was performed against the current local working tree, which includes uncommitted changes in the startup/build path.

## Findings

### [P1] Explicit artifact-root builds still rewrite Tauri into a broken `file://` frontend origin

- File: `M:\apps\overlayterm\scripts\run-platform-tauri.mjs:73`
- File: `M:\apps\overlayterm\scripts\run-platform-tauri.mjs:80`
- File: `M:\apps\overlayterm\scripts\run-platform-tauri.mjs:199`

When `OVERLAYTERM_VPS_ARTIFACTS_ROOT` or the related config/frontend env overrides are set, the wrapper still generates a runtime Tauri config that hardcodes `build.frontendDist` to an absolute filesystem path. In this repo, that path causes WebView2 to boot the packaged app on `file://...` instead of `http://tauri.localhost/`, and the browser then blocks the module/CSS loads by CORS. Local builds are now okay because they skip the runtime config, but the explicit artifact-root/VPS path remains vulnerable to the same failure mode.

Impact:
- VPS artifact builds can succeed at packaging while still producing a blank desktop app.
- This is high severity because it defeats the main deployment path the wrapper exists to support.

### [P1] Closing the window can strand the process with no visible entry point when tray is disabled

- File: `M:\apps\overlayterm\src\App.tsx:1364`

`onCloseRequested` always prevents the native close and hides the window instead. That is safe only when a tray icon remains available. If the user disables tray visibility and relies on the taskbar instead, closing the window removes the taskbar entry (because the window is hidden) and leaves the background process running with no obvious UI affordance to restore it.

Impact:
- A normal window close can leave the app apparently “gone” while the process continues running.
- Recovery depends on the user knowing the global shortcut or launching a second instance.

### [P2] Release startup now ignores persisted tray/taskbar visibility preferences and always steals focus

- File: `M:\apps\overlayterm\src-tauri\src\lib.rs:72`

The current release `setup` path forcibly calls `set_skip_taskbar(false)`, `show()`, and `set_focus()` on every launch. That overrides the user’s stored system-mode choices (`hideAppInTray`, `showInTaskbar`) before the React side has a chance to synchronize them, and it also causes startup focus-stealing on login/autostart.

Impact:
- Startup behavior no longer matches the settings UI contract.
- Autostart/login launches can steal focus and flash a taskbar entry even for users who wanted a tray-resident app.

### [P2] Tray/menu toggle has no native recovery path; it depends entirely on a live frontend listener

- File: `M:\apps\overlayterm\src-tauri\src\lib.rs:24`
- File: `M:\apps\overlayterm\src-tauri\src\lib.rs:100`

`toggle_overlay` never calls `show()`, `unminimize()`, or `set_focus()` itself. It only emits `overlay://toggle-request` into the webview, and both tray-click and tray-menu toggle actions route through that function. If the frontend listener is not mounted yet, or the webview is stuck in a broken boot state, the tray toggle becomes a no-op instead of acting as a reliable recovery mechanism.

Impact:
- The tray cannot reliably recover from frontend boot failures.
- This materially increases support/debugging cost because the native affordance does not work independently of the JS app.

### [P2] The app now boots in `open` phase, which bypasses the intended startup reveal logic and alters first-toggle semantics

- File: `M:\apps\overlayterm\src\App.tsx:318`
- File: `M:\apps\overlayterm\src\App.tsx:1137`
- File: `M:\apps\overlayterm\src\App.tsx:1188`

The initial React state is now `overlayPhase = 'open'`. That makes the shell logically visible before any of the startup reveal logic runs, so the one-shot startup timer at lines 1188-1191 no longer fires. It also changes first-toggle behavior: the first global toggle/hotkey path now enters the “hide” branch instead of the “show current presentation” branch.

Impact:
- Startup behavior becomes stateful and harder to reason about because the initial render no longer matches the native window state.
- Future fixes to the reveal path can be masked by this forced-open initialization.

## Residual Risks / Notes

- `src-tauri/src/window_commands.rs` did not surface a concrete correctness bug in this pass, but it still swallows most setup failures upstream because callers generally `.catch()` and log warnings rather than enforcing a degraded-mode fallback.
- `src-tauri/src/desktop_integration.rs` looks structurally sound for icon/drag plumbing in this pass; no concrete review finding there.
- The windowing stack is now carrying both native-side startup forcing and frontend-side startup forcing. Even when it works, it is brittle because responsibility is duplicated across Rust and React.
