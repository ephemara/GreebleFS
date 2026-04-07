# OverlayTerm Frontend Shell Review

Date: 2026-04-06

Scope:
- `src/main.tsx`
- `src/App.tsx`
- frontend startup/loading flow
- packaging-sensitive asset/loading assumptions

## Findings

### P1 - Startup visibility state no longer matches the native window state

The frontend now initializes `overlayPhase` to `'open'` in [src/App.tsx](M:/apps/overlayterm/src/App.tsx):318, but the Tauri config still declares the main window hidden and skipped from the taskbar in [src-tauri/tauri.conf.json](M:/apps/overlayterm/src-tauri/tauri.conf.json):21 and [src-tauri/tauri.conf.json](M:/apps/overlayterm/src-tauri/tauri.conf.json):23. At the same time, the Rust setup path force-shows the release window in [src-tauri/src/lib.rs](M:/apps/overlayterm/src-tauri/src/lib.rs):76 and [src-tauri/src/lib.rs](M:/apps/overlayterm/src-tauri/src/lib.rs):77. This means the frontend no longer goes through its intended `showCurrentPresentation()` bootstrap gate in [src/App.tsx](M:/apps/overlayterm/src/App.tsx):1189, so the normal presentation sizing/positioning path is skipped on first launch. The configured default windowed size in [src/store/settingsStore.ts](M:/apps/overlayterm/src/store/settingsStore.ts):435, [src/store/settingsStore.ts](M:/apps/overlayterm/src/store/settingsStore.ts):436, and [src/store/settingsStore.ts](M:/apps/overlayterm/src/store/settingsStore.ts):437 is therefore not authoritative at startup.

Impact:
- first-launch behavior depends on whichever layer "wins" the race
- native window config, frontend phase state, and user window-mode settings can disagree
- regressions are likely when tray/startup behavior changes again

### P2 - Window placement always snaps back to the primary monitor

Every show/reposition path uses `primaryMonitor()` in [src/App.tsx](M:/apps/overlayterm/src/App.tsx):792, [src/App.tsx](M:/apps/overlayterm/src/App.tsx):899, [src/App.tsx](M:/apps/overlayterm/src/App.tsx):1271, and [src/App.tsx](M:/apps/overlayterm/src/App.tsx):1394. That means users who work on a secondary display will have the shell re-anchored to the primary display whenever the app reopens, transitions modes, or re-applies overlay positioning. For a launcher-style overlay, that is a persistent multi-monitor usability bug.

Impact:
- reopening from tray/global shortcut can move the app to the wrong monitor
- stored bounds are effectively reinterpreted against the wrong work area
- windowed mode and overlay mode both inherit the problem

### P2 - The fatal startup overlay does not catch failures in the imported module graph

The diagnostics overlay in [src/main.tsx](M:/apps/overlayterm/src/main.tsx):6, [src/main.tsx](M:/apps/overlayterm/src/main.tsx):50, and [src/main.tsx](M:/apps/overlayterm/src/main.tsx):54 is installed only after the static imports at [src/main.tsx](M:/apps/overlayterm/src/main.tsx):1 through [src/main.tsx](M:/apps/overlayterm/src/main.tsx):4 have already been evaluated. Any failure while loading `./App` or one of its transitive imports will happen before those listeners exist, so the window can still fail blank with no visible diagnostic. The recent packaging failure mode was exactly in this class.

Impact:
- startup diagnostics are incomplete for the failures that matter most
- regressions in top-level module evaluation still present as a transparent/blank window

### P3 - The app still ships a guaranteed missing favicon request

The Vite entry HTML still references `/vite.svg` in [index.html](M:/apps/overlayterm/index.html):5. That asset is not part of the app and does not exist on the packaged Tauri origin, so startup always emits a 404/noise request in packaged builds.

Impact:
- unnecessary failed request at startup
- noisy packaging diagnostics that obscure more important errors

## Residual Risks

- The current shell bootstrap is fragile because visibility is being coordinated in both Rust and React instead of having one source of truth.
- The packaging path is now correct for local builds again, but `scripts/run-platform-tauri.mjs` remains a high-risk area because it can silently override Tauri config at build time.
