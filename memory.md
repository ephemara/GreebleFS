# GreebleFS Memory

## 2026-04-15 — Release Candidate Rename / Compatibility Release Prep

- Release-critical naming is now aligned on `GreebleFS` without breaking the legacy runtime surface in one pass.
- Durable implementation shape:
  - release/package surfaces now ship as `GreebleFS` / `greeblefs`, including `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, installer metadata, and visible shell copy.
  - `scripts/build-and-install-linux-local-release.sh` now installs under `~/.local/opt/greeblefs`, creates `~/.local/bin/greeblefs`, and keeps a legacy `overlayterm` CLI alias for one RC.
  - `scripts/run-platform-tauri.mjs` and `src/config/appContentDirectories.ts` now support new `GREEBLEFS_*` / `VITE_GREEBLEFS_*` env names while preserving old `OVERLAYTERM_*` fallbacks.
  - `src/config/appContentDirectories.ts` now migrates release app-local content from the old Tauri identifier root `co.overlayterm.app` into `co.greeblefs.app`, not just the older home-root layout.
  - `docs/release-compatibility.md` is the explicit compatibility contract for the RC and documents which old plugin/runtime/event/storage identifiers remain intentionally unchanged.
- Durable validation note:
  - passed targeted release-surface tests:
    - `src/test/layoutProfiles.edge.test.ts`
    - `src/test/appContentDirectories.test.ts`
    - `src/test/settingsPage.behavior.test.tsx`
    - `src/test/gitManager.behavior.test.tsx`
  - `bun run build` passes, but release packaging and the Rust test lane still remain blockers for a full public ship decision.

## 2026-04-15 — Explorer Commander Bridge / Cross-Pane Power Controls

- The explorer workspace now has first-class commander-style pane actions instead of only passive split layouts.
- Durable implementation shape:
  - `src/components/explorer/ExplorerWorkspace.tsx` now exposes cross-pane controls for path sync, linked navigation, copy-to-pane, and move-to-pane on top of the slot-based `1-Up` / `2-Up` / `4-Up` workspace shell.
  - `src/components/FileExplorer.tsx` now publishes a narrow runtime snapshot upward (`currentPath`, cloud/local state, and selected entries) and accepts explicit workspace commands for navigation, refresh, and selection transfer. This keeps transfer execution in the explorer/native layer instead of duplicating it in workspace chrome.
  - `src/config/explorerChromeLayouts.ts` now knows about the commander controls, so the workspace header can place them through the existing chrome-layout system instead of hardcoded JSX order.
  - `src/store/explorerStore.ts` now preserves focus when `createWorkspaceTab({ activate: false })` is used for hidden-pane creation, so cycling into split/quad layouts no longer steals the operator onto a newly spawned pane.
- Durable product note:
  - the power-user value here is the loop: split the workspace, keep pane focus stable, sync the target when needed, and copy/move the active selection across panes without bouncing through clipboard-only workflows.
- Validation:
  - passed: `bunx vitest run src/test/ExplorerWorkspace.test.tsx src/test/explorerStore.test.ts src/test/fileExplorer.viewModes.test.tsx`
  - observed no matching TypeScript errors for `ExplorerWorkspace`, `FileExplorer`, `explorerChromeLayouts`, `explorerStore`, or `explorerWorkspaceLayouts` while running `bunx tsc --noEmit --skipLibCheck --pretty false 2>&1 | rg "ExplorerWorkspace|FileExplorer|explorerChromeLayouts|explorerStore|explorerWorkspaceLayouts"`

## 2026-04-15 — Explorer Workspace Split System / Quad View

- The explorer workspace no longer assumes a hardcoded left/right dual-pane model.
- Durable implementation shape:
  - `src/config/explorerWorkspaceLayouts.ts` is now the data-driven workspace layout contract for `single`, `split`, and `quad`, plus pane-slot ids `pane-1` through `pane-4`.
  - `src/store/explorerStore.ts` now persists workspace activity against pane slots instead of `left` / `right`, and stores `columnSplitRatio` plus `rowSplitRatio` instead of one `splitRatio`.
  - workspace normalization now migrates legacy `left` / `right`, `dual`, and `splitRatio` state forward while reassigning tabs from hidden panes back into visible panes when layouts collapse.
  - `src/components/explorer/ExplorerWorkspace.tsx` now renders the workspace through the slot/layout contract, exposes `1-Up` / `2-Up` / `4-Up` mode controls, and treats pane focus/tab moves generically instead of hardcoding “other side”.
- Durable product note:
  - the explorer workspace should behave like a simple adaptive pane system, not a fragile left/right lock. `quad` is now the supported path for a denser workspace without introducing a custom docking runtime.
- Validation:
  - passed: `bunx vitest run src/test/explorerChromeLayouts.test.ts src/test/explorerTheme.test.ts src/test/settingsStore.test.ts src/test/explorerStore.test.ts src/test/ExplorerWorkspace.test.tsx src/test/fileExplorer.viewModes.test.tsx`

## 2026-04-15 — Theme Catalog Pilot Suite Reset

- Package themes are no longer treated as one flat catalog.
- Durable implementation shape:
  - `src/config/themeCatalogCuration.ts` is now the host-owned source of truth for package-theme curation tiers and official pilot ordering.
  - `src/config/themePackages.ts` attaches computed `catalog` metadata to every `LoadedOverlayThemePackage`, so downstream UI/runtime code can badge, sort, and group themes without hardcoding ids locally.
  - `src/components/SettingsPage.tsx` now presents the catalog as three lanes:
    - `Official Pilot Suite`
    - `Built-In Baselines`
    - `Legacy / Lab Archive`
  - the current official pilot package set is:
    - `vector-monolith`
    - `cyber-nexus-hud`
    - `celestial-astrolabe`
    - `clarity-line`
- Durable product note:
  - official pilot themes are now the intended front-of-house shells; the archive remains selectable but should not visually dominate Settings or read like equal-status product direction.
- Validation:
  - passed: `bunx vitest run --environment node src/test/themePackages.test.ts src/test/themeCatalogCuration.test.ts`
  - passed: `bunx vitest run --environment jsdom src/test/settingsPage.behavior.test.tsx`

## 2026-04-15 — Celestial Astrolabe Full-Screen Observatory

- `themes/celestial-astrolabe/renderers/astrolabe.tsx` no longer reads like a decorative three-column layout.
- Durable implementation shape:
  - the content stage now occupies the center of the viewport as the primary astronomical instrument
  - launcher groups and panel selectors orbit the stage instead of living as a conventional left sidebar
  - supporting controls moved into a full-width lower deck so the shell uses the full screen more aggressively
  - viewport-safe clamping still comes from the renderer-owned shell model and normalized layout regions
- Durable design note:
  - this theme is now intended to be part of the official pilot suite, not a legacy spectacle demo
- Validation:
  - passed: `bunx vite build`

## 2026-04-15 — Sketchfab Package Plugin / Generic Plugin Panel Requests

- Explorer plugin context menus can now open plugin panels through a shared generic handoff path instead of one-off panel bridges.
- Durable implementation shape:
  - `src/runtime/pluginPanelRequests.ts` is now the shared panel-request contract. It persists the latest request in local storage and broadcasts both a global open-panel event and a panel-specific event so plugins can react immediately when already mounted.
  - `src/config/pluginContributions.ts` and `src/config/pluginPackages.ts` now support a third explorer context-menu execution mode: `panel-request`. Use this when a context-menu action should open a plugin panel with structured payload such as a destination folder path.
  - `src/components/FileExplorer.tsx` resolves panel-request payload templates from the active explorer selection/background path and dispatches them through the shared request bridge, while `src/App.tsx` owns opening the requested plugin panel and surfacing the shell if it is hidden.
  - `src/components/pluginRuntime.tsx` now loads packaged frontend plugins through a module graph instead of a single transpiled file, so package plugins can import sibling helpers with package-local relative imports.
  - The `overlayterm-plugin` runtime module now exposes `getPluginPanelOpenRequestEvent()`, `readPluginPanelOpenRequest()`, and `requestPluginPanelOpen()` for packaged plugins that need to receive or emit shell-level panel handoffs.
  - `plugins/sketchfab/` is now a real package plugin with `plugin.json`, a rewritten `AssetBrowser.tsx`, and `sketchfabService.ts`. Explorer can hand the selected folder into the Sketchfab panel, search downloadable models, and save them into any chosen folder while writing a sibling `.sketchfab.json` attribution file.
- Durable authoring notes:
  - Package plugin relative imports must stay inside the package root. The runtime resolver intentionally blocks traversal outside the plugin directory.
  - `panelRequest.payload` values are string-template tokens resolved against explorer context before the panel opens. Use them for folder/file handoff, not for arbitrary code execution.
  - The Sketchfab plugin currently saves a direct `.glb` when available and otherwise saves the downloadable archive as provided by the API; archive extraction is not implemented yet.
- Validation:
  - passed: `bunx vitest run src/test/pluginRuntime.test.ts src/test/pluginRuntime.edge.test.ts src/test/pluginPackages.test.ts src/test/pluginPanelRequests.test.ts`
  - passed: `bunx vitest run src/test/settingsPage.behavior.test.tsx -t "context menu"`
  - passed: `timeout 20s bunx tsc --noEmit --skipLibCheck 2>&1 | rg "pluginPanelRequests|panel-request|Sketchfab|sketchfab|AssetBrowser|sketchfabService|resolveRelativeModuleSource|pluginRuntime|pluginPackages" || true`
  - passed: runtime smoke loading `plugins/sketchfab/AssetBrowser.tsx` through `loadPluginFromSource`

## 2026-04-15 — Custom Theme Renderer Overhaul Lane A

- Rewrote the owned custom themes to use the newer renderer contract and to feel materially more premium:
  - `themes/clarity-line/renderers/clarity-line-shell.tsx`
  - `themes/xmb-crosswave/renderers/xmb-crosswave.tsx`
  - `themes/wii-channel-home/renderers/wii-channel-home.tsx`
- Durable implementation shape:
  - all three themes now read from `host.shellModel` and normalize their visible shell rails from `host.shellModel.layout.regions`
  - no owned file uses `host.panels` or `host.renderChromeBar()`
  - each renderer uses `host.renderUtilityActionsSurface()` for utility chrome and renders launcher/pinned surfaces as theme-native structural regions instead of duplicated top bars
  - each renderer collapses hidden rails cleanly when the normalized shell regions disappear, so the layouts stay viewport-safe instead of depending on zero-width columns
  - Clarity Line is now an editorial shell with grouped launcher cards and a dedicated pinned rail, XMB Crosswave is a console-style axis/wave layout, and Wii Channel Home is a bright channel wall with a hero surface and channel cards
- Validation:
  - passed: `rg -n "host\\.panels|renderChromeBar\\(" themes/clarity-line themes/xmb-crosswave themes/wii-channel-home`
  - passed: `node <<'NODE' ... transpileModule ... NODE` over the three rewritten renderer files
  - passed: `bunx vite build`

## 2026-04-15 — Retro Console Renderer Rewrite Lane B

- Rebuilt the owned retro-console renderers to use the normalized renderer shell contract instead of the old hardcoded launcher/chrome compositions:
  - `themes/dreamcast-skyline/renderers/dreamcast-skyline.tsx`
  - `themes/gamecube-helix/renderers/gamecube-helix.tsx`
  - `themes/gamecube-orbital/renderers/gamecube-orbital.tsx`
  - `themes/gamecube-prism/renderers/gamecube-prism.tsx`
- Durable implementation shape:
  - all four renderers now anchor geometry to `host.shellModel.layout.regions` and use `host.shellModel.launcher` for groups/panels
  - all four claim `surfaceOwnership` for launcher, chrome, contentFrame, pinnedPanels, and wallpaper so the host does not inject duplicate launcher chrome or pinned surfaces
  - all four use `host.renderUtilityActionsSurface()` for utility chrome and avoid `host.panels` / `host.renderChromeBar()`
  - Dreamcast is now a bright dashboard shell, while the GameCube trio split into helix, orbital, and prism geometry languages instead of sharing one generic shell
- Validation:
  - passed: `npx vitest run --environment node src/test/themeRendererPackages.test.ts src/test/themeRendererRuntime.test.ts src/test/themeRendererShellModel.test.ts src/test/workbenchRenderRuntime.test.ts`
  - passed: `node - <<'NODE' ... transpileModule ... NODE` over the four rewritten renderer files
  - passed: `rg -n "host\\.panels|renderChromeBar" themes/dreamcast-skyline/renderers/dreamcast-skyline.tsx themes/gamecube-helix/renderers/gamecube-helix.tsx themes/gamecube-orbital/renderers/gamecube-orbital.tsx themes/gamecube-prism/renderers/gamecube-prism.tsx`

## 2026-04-15 — Custom Theme Renderer Overhaul Lane C

- Rewrote the owned spectacle themes to use the newer renderer contract instead of raw shell chrome:
  - `themes/celestial-astrolabe/renderers/astrolabe.tsx`
  - `themes/arcade-atrium/renderers/arcade-atrium-shell.tsx`
  - `themes/arcade-arcology/renderers/arcade-arcology.tsx`
- Durable implementation shape:
  - all three themes now build launcher/content geometry from `host.shellModel`, especially `launcher.groups`, `launcher.panels`, and normalized `layout.regions`
  - no owned file uses `host.panels` or `host.renderChromeBar()`
  - utility controls now come from `host.renderUtilityActionsSurface()` instead of duplicated chrome bars
  - the launcher is rendered as a theme-native structural surface in each file, with viewport-safe sizing derived from the normalized shell layout
  - `arcade-arcology` was upgraded from a default-navigation hybrid into a fully owned launcher/chrome shell so the right rail can stay independent of host chrome
- Design note:
  - these shells are now distinct layout languages rather than palette swaps
  - the goal was to keep them spectacle-heavy while still obeying the viewport clamps and ownership contract so they do not float off-screen or render duplicate launcher controls
- Validation:
  - passed: `rg -n "host\\.panels|renderChromeBar\\(" themes/celestial-astrolabe/renderers/astrolabe.tsx themes/arcade-atrium/renderers/arcade-atrium-shell.tsx themes/arcade-arcology/renderers/arcade-arcology.tsx`
  - passed: `node - <<'NODE' ... transpileModule ... NODE`
  - passed: `bash -lc 'if rg -n "host\\.panels|renderChromeBar\\(" themes/celestial-astrolabe/renderers/astrolabe.tsx themes/arcade-atrium/renderers/arcade-atrium-shell.tsx themes/arcade-arcology/renderers/arcade-arcology.tsx; then exit 1; else echo "forbidden patterns absent"; fi'`

## 2026-04-15 — Wayland Dock Host Split

- Linux Wayland dock mode now routes through a dedicated host instead of trying to make the normal `main` Tauri window behave like a panel.
- Durable implementation shape:
  - `src-tauri/src/wayland_dock.rs` owns the separate `dock` webview host and applies `gtk-layer-shell` anchoring/layout for Wayland panel behavior.
  - `src-tauri/src/window_commands.rs` exposes dock-host status and a native dock-layout command, while `src/runtime/windowHost.ts` owns the frontend `main` vs `dock` routing contract and host-targeted event names.
  - `src/App.tsx` now treats presentation as host-owned state on Wayland: `main` keeps the global shortcut and forwards toggle/show requests to `dock` when overlay mode is active, while inactive hosts stay hidden instead of trying to manage geometry.
  - `src/store/settingsStore.ts` and `src/store/explorerStore.ts` listen for `storage` updates so the hidden host can rehydrate persisted settings/explorer session state during cross-window handoff.
  - `src/components/SettingsPage.tsx` and `src/panels/panelRegistry.tsx` route window-mode changes through the host-aware mode-switch callback instead of directly mutating `settings.terminal.windowMode`.
- Validation:
  - passed: `bun run test:unit src/test/app.dockMode.test.tsx`
  - passed: `bun run test:unit src/test/app.dockMode.test.tsx src/test/panelRegistry.test.tsx src/test/settingsPage.behavior.test.tsx src/test/settingsStore.test.ts`
  - passed: `bun run test:unit src/test/app.dockMode.test.tsx src/test/panelRegistry.test.tsx src/test/settingsPage.behavior.test.tsx src/test/settingsStore.test.ts src/test/explorerStore.test.ts src/test/globalShortcuts.test.tsx`
  - passed: `bun run test:browser src/test/browser/animationRuntime.browser.test.tsx`
- Current blocker:
  - `cargo run --manifest-path src-tauri/Cargo.toml --bin export-bindings` is still red on unrelated pre-existing errors in `src-tauri/src/cloud_commands.rs`, so the Wayland dock commands currently need a centralized runtime wrapper instead of relying on freshly regenerated TS bindings.

## 2026-04-15 — Cloud Provider Credentials / Settings-Managed OAuth

- Cloud login no longer depends on external env vars alone.
- Durable implementation shape:
  - `src-tauri/src/cloud_commands.rs` now resolves provider credentials from two lanes:
    - Settings-managed provider config stored under app-local `cloud/providers.json` for the client ID plus OS keychain storage for the optional client secret
    - fallback runtime environment variables for Google Drive and Dropbox
  - Saved Settings credentials take precedence over env vars until the user clears them.
  - Refresh tokens still live in the OS keychain and account metadata still lives in app-local storage; this change only adds a first-class place to manage provider app credentials from inside the desktop shell.
  - Dropbox OAuth no longer uses a random loopback redirect. The backend now uses the fixed callback URI `http://localhost:53682/callback` so the Dropbox app console can whitelist one stable redirect target.
  - `src/runtime/explorerBackend.ts` exposes the new typed provider-config commands, and `src/components/SettingsPage.tsx` now renders per-provider client ID / client secret controls, save/clear actions, source/status badges, and provider-specific setup guidance inline with the Connect button.
- Durable operator note:
  - Google Drive should be set up as a desktop OAuth client.
  - Dropbox must allow `http://localhost:53682/callback`; if sign-in times out, verify that callback first.
- Validation:
  - passed: `cargo run --manifest-path src-tauri/Cargo.toml --bin export-bindings`
  - passed: `bunx vitest run src/test/settingsPage.behavior.test.tsx`
  - passed: filtered targeted TS check showing no errors from `src/runtime/explorerBackend.ts`, `src/components/SettingsPage.tsx`, `src/test/settingsPage.behavior.test.tsx`, or `src/generated/tauri.ts`
  - repo note: the narrowed `bunx tsc --noEmit ...` path is still red on unrelated existing failures in `FileExplorer.tsx`, `GitManager.tsx`, `ScreenshotsManager.tsx`, `performanceTelemetry.ts`, and `explorerStore.ts`

## 2026-04-15 — Vector Monolith Three.js Theme Package

- Added `themes/vector-monolith/` as the first packaged Three.js theme built on top of the new multi-file renderer module graph.
- Durable shape:
  - the package ships one renderer entrypoint but splits behavior into separate app and dock shells under `renderers/monolith/modes/`
  - the dock lane is authored in-package through `theme.dock.workbench` and `theme.dock.explorer`, so overlay mode gets tighter chrome and explorer defaults without needing a separate manifest contract
  - shared Three.js scene plumbing lives in `renderers/monolith/components/three-backdrop.tsx`, while the 3D shell framing stays in host-owned React surfaces via `host.renderPanelSurface(...)`
  - `src/test/themeRendererPackages.test.ts` now resolves real filesystem-relative imports, so packaged multi-file renderer fixtures are exercised directly instead of assuming single-file entrypoints
- Validation target:
  - `bunx vitest run src/test/themeRendererPackages.test.ts src/test/themeRendererRuntime.test.tsx src/test/themePackages.test.ts`
- Current limitation:
  - this is a shell-level 3D treatment around host panels; the explorer contents themselves are still DOM surfaces, not yet a native in-scene 3D object graph of individual files/folders

## 2026-04-15 — Explorer Context Menu Catalog / Plugin Composer

- Explorer context menus now resolve through a shared typed catalog instead of ad hoc hardcoded JSX-only item lists.
- Durable implementation shape:
  - `src/config/explorerContextMenu.ts` is the source of truth for built-in explorer context menu actions, group/order metadata, override normalization, sorting, and legacy explorer-action compatibility shims.
  - `src/config/pluginContributions.ts` and `src/config/pluginPackages.ts` now support `contextMenuItems` plugin contributions. Package manifests can contribute either:
    - terminal-template items that inject/run terminal commands with token substitution
    - compiled backend items that execute a plugin-owned binary/script entry through the existing native plugin backend runner
  - `src/runtime/useFolderPluginRuntime.ts`, `src/panels/panelRegistry.tsx`, `src/components/explorer/ExplorerWorkspace.tsx`, and `src/components/FileExplorer.tsx` now carry `pluginContextMenuItems` all the way into the explorer surface.
  - `FileExplorer.tsx` now builds entry/background menus from the shared catalog, then applies per-item visibility and user-defined sort overrides before rendering separators.
  - `src/store/settingsStore.ts` now persists `settings.explorer.contextMenuItemOverrides`, and `src/components/SettingsPage.tsx` exposes a `Context Menu Composer` for enabling/disabling items and reordering built-ins plus plugin items together.
- Durable authoring note:
  - plugin manifest `contributions.contextMenuItems` supports `contexts`, `appliesTo`, `group`, `order`, `iconName`, `command`, `runOnSelect`, and `backend.{ entry, args }`
  - plugin manifest `contributions.contextMenuItems` also supports `panelRequest.{ panelId?, payload }` for opening a plugin panel with explorer-derived context
  - backend entries must stay package-relative and pass the same safe-relative-path validation as other plugin assets
- Validation:
  - passed: `bunx vitest run src/test/pluginPackages.test.ts src/test/panelRegistry.test.tsx src/test/pluginsManager.test.tsx src/test/useFolderPluginRuntime.test.tsx src/test/useFolderPluginRuntime.queue.test.tsx src/test/ExplorerWorkspace.test.tsx`
  - passed: `bunx vitest run src/test/settingsStore.test.ts -t "context menu overrides"`
  - passed: `bunx vitest run src/test/settingsPage.behavior.test.tsx -t "context menu composer"`
  - repo note: broad `bunx tsc --noEmit --skipLibCheck` is still red on unrelated long-standing `explorerStore` and `FileExplorer.tsx` issues, and the fallback polling watcher suite still has pre-existing timer/cleanup instability that is not specific to the context-menu plugin path

## 2026-04-15 — Theme Renderer Multi-File Module Graph

- Theme renderers are no longer single-file only.
- Durable implementation shape:
  - `src/runtime/moduleRuntime.ts` now supports compiling and executing a small runtime module graph, not just a single transpiled module blob.
  - `src/components/themeRendererRuntime.tsx` now uses that graph path, so a renderer entry file can import sibling helpers with relative paths while still using the host-owned allowlist for external libraries.
  - `src/config/themePackages.ts` now resolves relative theme-renderer imports against the current theme package root, tries `.ts` / `.tsx` / `.js` / `.jsx` plus `index.*`, and blocks path traversal outside the package by returning no resolution when `..` would escape the root.
  - `three` remains a host allowlisted external import for theme renderers, but theme packages still do not get arbitrary package-manager access; external imports must be explicitly injected by the host runtime.
- Durable authoring note:
  - Theme renderer entries can now be split into small local files such as `renderers/shell/body.tsx` and `renderers/shell/frame.ts`.
  - Use relative imports for local helpers. Do not assume arbitrary npm dependencies are available inside theme packages.
- Validation:
  - passed: `bunx vitest run src/test/themeRendererRuntime.test.tsx src/test/themePackages.test.ts`
  - passed: `bunx vitest run src/test/themeRendererPackages.test.ts src/test/themePackageExplorerRecipe.test.ts`
  - blocked by pre-existing unrelated workspace TypeScript errors in `FileExplorer.tsx`, `GitManager.tsx`, `ScreenshotsManager.tsx`, `ExplorerWorkspace.tsx`, `explorerContextMenu.ts`, `performanceTelemetry.ts`, and `explorerStore.ts` during narrowed `bunx tsc --noEmit ...`

## 2026-04-15 — Pilot Default Theme Baseline

- Added `src/config/pilotThemeContract.ts` as the data-driven source of truth for the boring/default shell baseline.
- Durable implementation shape:
  - `pilot-dark` and `pilot-light` are now the canonical built-in defaults, and `pilot-dark` is the repo default/fallback theme instead of `operator`.
  - `src/config/appearance.ts` now gives all built-in themes the same pilot workbench, explorer, and dock recipe baseline, so built-in theme changes keep the shell layout contract stable even when the palette changes.
  - `src/store/settingsStore.ts` now owns `applyThemeSelection()` and `applyDockThemeSelection()`; Settings should use those actions instead of directly flipping `activeThemeId`.
  - built-in theme selection now resets theme-managed shell state in one place: dock follow/override defaults, wallpaper/shader/open-close motion overrides, clean app visual controls, explorer presentation defaults, primary layout profile, and dock theme normalization.
  - built-in theme selection deliberately does not mutate live explorer session state anymore. It resets explorer settings/layout defaults, but `currentPath`, `history`, `shellLayoutId`, preview/source visibility, and live sidebar/preview widths stay session-owned.
  - package theme selection still clears theme-managed shader/motion overrides and can force managed icons on, but it does not force the pilot layout reset path unless the selected theme id is in the built-in pilot-default contract.
- Durable UI note:
  - `src/components/SettingsPage.tsx` theme cards can now show both pilot recipe badges and package capability badges, so the capability badge limit was widened to keep package metadata visible after the pilot baseline landed.
- Validation:
  - passed: `bunx vitest run src/test/appearance.test.ts src/test/settingsStore.test.ts src/test/settingsPage.behavior.test.tsx src/test/app.dockMode.test.tsx`
  - passed: `bunx vitest run src/test/themeEngineBackend.test.ts src/test/workbenchRenderRuntime.test.ts src/test/fileExplorer.viewModes.test.tsx src/test/themeEngineCatalog.regression.test.ts`
  - repo note: broad `bunx tsc --noEmit` is still red on many pre-existing `App.tsx`, `FileExplorer.tsx`, store, and test typing issues outside this pilot-theme pass

## 2026-04-15 — Dock Theme Lane / Dock Presentation Split

- Dock mode is now a first-class presentation lane instead of a thin alias of the app shell.
- Durable implementation shape:
  - `src/store/settingsStore.ts` now persists `settings.appearance.dockThemeMode` (`follow-app` or `override`) plus `settings.appearance.activeDockThemeId`.
  - `src/config/appearance.ts` now resolves both `app` and `dock` appearance channels at once and then selects the active lane from `settings.terminal.windowMode`.
  - Theme manifests can now declare `theme.dock.workbench` and `theme.dock.explorer`. Those dock overrides merge on top of the selected dock base theme rather than replacing the entire theme pipeline.
  - When dock follows the app theme, the dock base theme is the active app theme. When dock overrides the app theme, the dock base theme comes from `activeDockThemeId`, with safe fallback back to the app theme if the override id is missing or invalid.
  - `src/config/themePackages.ts` now preserves `theme.dock.*` and exposes dock capability metadata so the theme catalog can label dock-aware themes.
  - `src/App.tsx` and `src/components/TerminalOverlay.tsx` now consume the mode-aware appearance result, and the explorer panel wiring now uses `explorerLayoutMode: 'dock'`.
  - `src/config/layoutProfiles.ts` normalizes legacy persisted `compact-dock` values to `dock`, so old layout/profile state keeps loading cleanly.
  - `src/components/SettingsPage.tsx` now exposes dock-theme controls: follow the application theme or pick a separate dock theme, plus theme-card badges for dock-capable packages.
- Durable behavior note:
  - dock still reuses the same explorer/workspace sessions and filesystem truth as app mode, but its layout and appearance are now intentionally separable so the UE-style dock surface can be tuned harder without destabilizing the main shell
  - the dock layout contract keeps inline preview closed, and `FileExplorer.tsx` now mounts cleanly in dock mode after removing a real `borderBottom`/`borderColor` style conflict from list rows
- Validation:
  - passed: `cargo run --manifest-path src-tauri/Cargo.toml --bin export-bindings`
  - passed: `bunx vitest run src/test/appearance.test.ts src/test/settingsStore.test.ts src/test/themePackageExplorerRecipe.test.ts src/test/settingsPage.behavior.test.tsx src/test/app.dockMode.test.tsx src/test/layoutProfiles.test.ts src/test/fileExplorer.viewModes.test.tsx src/test/themePackages.test.ts`

## 2026-04-15 — Adaptive Explorer Chrome Phase 1

- Explorer chrome composition is now a first-class config/runtime layer, separate from explorer pane composition.
- Durable implementation shape:
  - `src/config/explorerChromeLayouts.ts` defines the built-in chrome surfaces (`explorerTopbar`, `explorerToolbar`, `workspaceHeader`), control ids, layout ids, zone/order metadata, and override normalization/resolution helpers.
  - `src/components/explorer/ExplorerChromeSurface.tsx` is the shared renderer for resolved chrome surfaces. `FileExplorer.tsx` and `ExplorerWorkspace.tsx` should render resolved control surfaces through this component instead of hardcoding toolbar/header button order in JSX.
  - `src/config/explorerTheme.ts` now carries `chromeLayoutId` on the resolved explorer recipe, with `default` normalization so existing themes keep working without explicit chrome config.
  - `src/store/settingsStore.ts` now persists `settings.explorer.chromeLayoutOverridesByThemeId`, keyed by theme id and `chromeLayoutId`. This is intentionally separate from `shellLayoutId`, `sidebarWidth`, `previewWidth`, `sourcesVisible`, and named explorer session state.
  - `shellLayoutId` still owns pane structure like rail visibility and preview placement. `chromeLayoutId` only owns explorer control composition.
- Stabilization fix:
  - `FileExplorer.tsx` no longer uses the old mount-time boot navigation effect path that could synchronously schedule state updates during passive-effect mount. Boot navigation now runs through a deferred callback path, which stops the `getRootForUpdatedFiber` / OverlayTerm runtime crash seen during initial explorer mount and strict remounts.
- Durable testing posture:
  - `src/test/explorerChromeLayouts.test.ts` covers chrome layout normalization and override resolution.
  - `src/test/explorerTheme.test.ts`, `src/test/themePackageExplorerRecipe.test.ts`, `src/test/settingsStore.test.ts`, `src/test/fileExplorer.viewModes.test.tsx`, and `src/test/ExplorerWorkspace.test.tsx` now cover `chromeLayoutId`, per-theme overrides, workspace-header chrome composition, topbar rendering, and the strict-mode boot regression.
- Related durable note:
  - explorer drag intent still defaults to native drag-out on plain drag and internal-only drag on `Shift`. Keep docs/tests aligned with that runtime contract unless the drag model is deliberately redesigned.

## 2026-04-15 — Adaptive Explorer Chrome Phase 2

- Explorer modes are now a first-class config/runtime layer instead of being implied by `session.shellLayoutId`.
- Durable implementation shape:
  - `src/config/explorerModeProfiles.ts` is the new source of truth for explorer mode identities. Built-ins currently map:
    - `balanced` -> `paneLayoutId: balanced`, `chromeLayoutId: default`
    - `navigator` -> `paneLayoutId: navigator`, `chromeLayoutId: default`
    - `focus` -> `paneLayoutId: focus`, `chromeLayoutId: focused-search`
    - `inspector` -> `paneLayoutId: inspector`, `chromeLayoutId: default`
  - `src/config/explorerTheme.ts` now resolves `defaultModeProfileId` on the explorer recipe. Theme/user mode resolution precedence is:
    - per-theme `settings.explorer.modeProfileOverridesByThemeId`
    - theme `defaultModeProfileId`
    - legacy `session.shellLayoutId`
    - built-in `balanced`
  - `src/store/settingsStore.ts` now persists `modeProfileOverridesByThemeId` separately from `chromeLayoutOverridesByThemeId`. Theme selection no longer rewrites explorer session pane state.
  - `src/config/explorerChromeLayouts.ts` now covers six surfaces instead of three:
    - `explorerTopbar`
    - `explorerToolbar`
    - `workspaceHeader`
    - `railHeader`
    - `previewHeader`
    - `explorerStatusBar`
  - `FileExplorer.tsx`, `ExplorerWorkspace.tsx`, `ExplorerSideRail.tsx`, and the preview panel now all resolve chrome through shared surface layouts. The status strip is no longer hardcoded JSX.
  - Zone-based chrome edit mode now exists for explorer chrome. It persists per-theme/per-layout override snapshots and only supports surface/zone/order changes; it is not a free-pixel docking system.
  - `session.shellLayoutId` still remains in `src/store/explorerStore.ts` as the pane-layout compatibility fallback for existing sessions, and live `sidebarWidth`, `previewWidth`, and `sourcesVisible` stay session-owned.
- Durable testing posture:
  - passed: `bunx vitest run src/test/explorerChromeLayouts.test.ts src/test/explorerTheme.test.ts src/test/settingsStore.test.ts src/test/fileExplorer.viewModes.test.tsx src/test/ExplorerWorkspace.test.tsx`
  - passed: `bunx vitest run src/test/settingsPage.behavior.test.tsx -t "pilot light baseline|separate dock theme override"`
  - repo note: the full `src/test/settingsPage.behavior.test.tsx` file still contains an unrelated cloud-provider timeout outside the explorer/theme-selection path and was not treated as a regression from this pass.

## 2026-04-15 — Explorer To Filesystem Aquarium Handoff

- Explorer can now hand a folder or file context directly into the `filesystem-aquarium` plugin instead of making the user paste a path manually.
- Durable implementation shape:
  - `src/runtime/filesystemAquariumBridge.ts` is the shared handoff contract. It normalizes the requested path, persists the latest request in local storage, and broadcasts a window event so the plugin can react immediately if it is already mounted.
  - `src/App.tsx` owns panel activation for the handoff. Opening Aquarium from Explorer now ensures the `filesystem-aquarium` panel is visible, active, and undismissed before showing the shell if needed.
  - `src/panels/panelRegistry.tsx`, `src/components/explorer/ExplorerWorkspace.tsx`, and `src/components/FileExplorer.tsx` now route the `onOpenInFilesystemAquarium()` intent through the explorer surface.
  - Explorer exposes the handoff from three user-facing entry points:
    - file or folder context menu
    - empty-space folder context menu
    - current-location toolbar chip
  - The shipped `plugins/filesystem-aquarium/dist/index.tsx` runtime reads the persisted request on mount and listens for the handoff event, so the panel can retarget to the requested habitat without a refresh.
- Validation:
  - passed: `bunx vitest run src/test/filesystemAquariumBridge.test.ts src/test/ExplorerWorkspace.test.tsx src/test/panelRegistry.test.tsx`
  - passed: `bunx tsc --noEmit --skipLibCheck 2>&1 | rg "filesystemAquariumBridge|handleOpenInFilesystemAquarium|OpenInFilesystemAquarium|panelDefinitions|FILESYSTEM_AQUARIUM_PANEL_ID|src/test/fileExplorer.viewModes.test.tsx\\(287|src/test/fileExplorer.viewModes.test.tsx\\(308"`
    - interpretation: no output means the new Aquarium-specific symbols are no longer surfacing targeted TS errors in the noisy workspace typecheck.
  - passed: `cmp -s plugins/filesystem-aquarium/dist/index.tsx src-tauri/plugins/filesystem-aquarium/dist/index.tsx && echo mirrored`
  - repo note: the broad `src/test/fileExplorer.viewModes.test.tsx` suite still has pre-existing failures unrelated to the Aquarium handoff and is not a reliable green gate yet.

## 2026-04-15 — Screenshot Native Export / Capture Isolation / Editor Controls

- Moved annotated screenshot export out of the browser canvas path and into `src-tauri/src/screenshot_commands.rs`.
- Durable reason:
  annotated save/copy had been compositing against the preview-sized data URL inside `ScreenshotsManager`, which meant any annotated output was silently capped to preview resolution instead of the full cached capture.
- New native screenshot contract:
  - `screenshot_export_annotated` now accepts typed annotation payloads plus an optional crop region
  - Rust composites annotations directly onto the cached full-resolution `RgbaImage`
  - annotated save/copy now uses the same native image/clipboard path as the plain capture workflow
- Cross-platform capture isolation improved:
  - Windows still uses `WDA_EXCLUDEFROMCAPTURE`
  - non-Windows capture preview now temporarily hides/restores the app window around monitor capture instead of doing nothing
- `src/components/ScreenshotsManager.tsx` no longer writes annotated files or clipboard images through browser APIs.
- The screenshot editor now has a real selection interaction model:
  - drag inside the selection moves it
  - drag handles resize it
  - arrow keys nudge it
  - `Alt` + arrows resize it
  - `Ctrl/Cmd + A` selects the full preview
- Added focused proof:
  - `src/test/screenshotsManager.test.tsx` now covers native annotated export, keyboard move/resize, and pointer-handle resize behavior
  - `src/test/screenshotsUtils.test.ts` now covers resize-handle hit detection
  - Rust tests now cover annotated rectangle rendering and crop-region behavior
- Validation:
  - passed: `cargo run --manifest-path src-tauri/Cargo.toml --bin export-bindings`
  - passed: `cargo test --manifest-path src-tauri/Cargo.toml screenshot_commands`
  - passed: `bunx vitest run src/test/screenshotsManager.test.tsx src/test/screenshotsUtils.test.ts`
  - passed: `bun run build`
  - live smoke: `timeout 75s bun run tauri dev` reached Vite-ready state and launched `target/debug/greeble`; verified the native process was running with `ps -eo pid,cmd | rg 'target/debug/greeble|greeble$'`
- Remaining risk:
  the live Tauri smoke proved the desktop runtime boots with the new screenshot path, but it did not yet click through a fully automated real capture session inside the desktop window. A future proof harness should drive the screenshot panel in the running Tauri app, not only the jsdom/browser-mocked tests.

## 2026-04-15 — Vibe Capsule Flagship Plugin Pass

- Added a new built-in package plugin under `plugins/vibe-capsule/`:
  - `plugin.json` package manifest
  - `dist/index.tsx` runtime entry
  - `themes/vibe-capsule-shell/theme.json` packaged theme contribution
- `Vibe Capsule` is meant to be a high-signal consumer/creative reference plugin, not a narrow utility panel. It ingests dropped explorer paths or browser-picked files, derives a mood profile from the source material, renders a playable ambient shrine scene, persists archived capsules in plugin storage, and exports a generated shell-skin theme manifest.
- Durable implementation constraints:
  - the plugin runtime now supports package-local relative imports through the shared module-graph loader, but external imports are still limited to the allowlisted host modules (`react`, `lucide-react`, selected Tauri modules, `overlayterm-plugin`)
  - this plugin still stays intentionally lightweight and does not assume bundled `three` or arbitrary npm dependencies
  - explorer-origin drops flow through `application/x-overlayterm-paths`
  - native file access inside plugins currently routes through `api.invoke('fs_list_dir' | 'fs_read_text_file' | 'fs_read_file_base64' | 'fs_open_file' | 'fs_reveal_in_explorer')`
- Added regression coverage:
  - `src/test/pluginRuntime.test.ts` now validates the shipped runtime-entry plugins that actually exist on disk: `drawable-canvas`, `filesystem-aquarium`, and `vibe-capsule`
  - `src/test/vibeCapsule.pluginPackage.test.ts` exercises real on-disk package discovery for `plugins/vibe-capsule`, including its theme contribution
- Updated `.gitignore` to whitelist `plugins/**/dist/**`. Durable reason:
  packaged plugin `dist/` folders are source/runtime entries in this repo, not disposable app-build output. Without the whitelist, built-in package plugins vanish from Git tracking.
- Validation:
  - passed: `bunx vitest run src/test/pluginRuntime.test.ts src/test/vibeCapsule.pluginPackage.test.ts`
  - repo note: `bunx vitest run src/test/pluginPackages.test.ts` still has a pre-existing failing assertion in the unsafe-relative-path warning case and was not part of this plugin pass
- Recommended next step:
  if Aquarium becomes the second flagship plugin, either expose `three` through the plugin runtime allowlist or add a dedicated richer visual host path before pushing it further.

## 2026-04-15 — Renderer-Owned Shell Contract Pass

- Added `src/components/themeRendererShellModel.ts`, which builds a normalized theme-renderer shell model with:
  - grouped launcher metadata
  - utility action metadata
  - viewport metrics
  - clamped shell regions for chrome, launcher, content, and pinned panel sides
- `src/components/themeRendererRuntime.tsx` now supports explicit renderer `surfaceOwnership`, and `App.tsx` now uses that contract to suppress duplicated host surfaces when a theme renderer owns launcher/chrome/content/wallpaper responsibilities.
- `App.tsx` now also exposes `host.renderUtilityActionsSurface()`, and the bundled renderer catalog no longer relies on raw `host.panels` or `host.renderChromeBar()` for custom launcher shells.
- Corrected an important host-contract bug: `surfaceOwnership` now only suppresses the host's automatic shell placement. It no longer makes `host.renderDefaultNavigationSurface()` or `host.renderPinnedPanels()` return `null`, so hybrid renderers and starter templates can embed default host surfaces inside custom layouts safely.
- `TopBar` now removes launcher-facing chrome when the active renderer owns the launcher surface, which fixes the bundled “double top bar / duplicate launcher strip” failure mode without gutting the shared utility controls.
- `src/config/workbenchRenderRuntime.ts` now carries `navigationRailWidth`, and `WorkbenchNavigationSurface.tsx` consumes that runtime-owned sizing instead of hardcoded width branches.
- Migrated the starter renderer plus bundled custom shells to the new ownership model:
  - fully custom launcher shells now declare `launcher`, `chrome`, `contentFrame`, and `wallpaper`
  - hybrid shells like `arcade-arcology` keep the default launcher surface but still declare custom chrome/content ownership
- Durable reason:
  the old renderer contract let themes render their own launcher while still inheriting launcher/menu/tab chrome from `host.renderChromeBar()`, which caused duplicate bars, duplicate launcher affordances, and layout drift across the theme catalog.
- Validation:
  - passed: `npx vitest run --environment node src/test/themeRendererRuntime.test.tsx src/test/themeRendererShellModel.test.ts src/test/workbenchRenderRuntime.test.ts src/test/themeRendererPackages.test.ts`
  - passed: targeted TS transpile syntax check for `App.tsx`, the renderer runtime/shell model files, and the touched bundled renderers
  - blocked by pre-existing workspace type errors in `FileExplorer.tsx`, `GitManager.tsx`, `performanceTelemetry.ts`, and `explorerStore.ts`
- Recommended next step:
  migrate the remaining bundled renderers from raw `host.panels` iteration toward `host.shellModel.launcher` / normalized regions, then push the same structural-contract treatment deeper into explorer-local chrome and dialogs.

## 2026-04-15 — Vector Monolith Explorer Depth Pass

- `themes/vector-monolith/renderers/monolith/components/surface-stage.tsx` no longer places the live host panel DOM inside the rotated decorative stage mesh. Durable reason:
  explorer chrome menus and the explorer context menu depend on normal absolute/fixed positioning, and a transformed or overflow-clipped ancestor was making those surfaces appear empty or misplaced.
- The stage now splits into:
  - a transformed decorative Three.js-style chassis and holographic frame
  - a flat interactive plane above it that keeps `host.renderPanelSurface()` alive with `overflow: visible`
- `src/components/FileExplorer.tsx` now exposes stable `data-overlay-explorer-*` hooks for root mode and major planes like `rail`, `toolbar`, `file-area`, `content-viewport`, `preview`, and `status`.
- `themes/vector-monolith/renderers/monolith/components/scoped-styles.tsx` uses those hooks to push the live explorer DOM into a layered 3D cockpit treatment without taking ownership of explorer truth or breaking its menus.
- Durable lesson:
  renderer-owned 3D shells should not rotate or clip the actual interactive host surface if that surface contains fixed or absolute menus, drag affordances, or other UI that depends on normal DOM positioning. Keep the depth in sibling chrome and scoped descendant styling instead.

## 2026-04-15 — Theme Catalog / Renderer Stability Pass

- `src/components/SettingsPage.tsx` now keys theme catalog cards with source-aware composite keys instead of raw `theme.id`, so package/custom themes that intentionally share an id no longer spam React duplicate-key warnings in Settings.
- `src/config/themePackages.ts` now inlines packaged SVG preview and wallpaper assets through `fsReadFileBase64()` before handing them to the frontend. Durable reason:
  Tauri/WebKit was intermittently failing to display packaged SVG theme assets when they stayed on filesystem-backed URLs, which showed up as repeated `Failed to load resource` errors for theme wallpapers/previews.
- `themes/celestial-astrolabe/renderers/astrolabe.tsx` and `themes/cyber-nexus-hud/renderers/cyber-nexus.tsx` no longer animate via React state on every frame. They now use CSS keyframes for decorative motion so mounted heavy panels like `FileExplorer` are not forced through renderer-driven rerender loops.
- Added regression coverage for the touched runtime surface by extending `src/test/themeRendererPackages.test.ts` to load the Astrolabe and Cyber Nexus theme renderers, and kept `src/test/themePackages.test.ts` green with SVG asset inlining expectations.
- Validation:
  - passed: `bunx vitest run src/test/themePackages.test.ts src/test/themeRendererPackages.test.ts`
  - blocked by pre-existing workspace/typecheck issues: narrowed `bunx tsc --noEmit --skipLibCheck ...` still fails in unrelated `FileExplorer`, `GitManager`, `performanceTelemetry`, `explorerStore`, plus the runtime-only `overlayterm-theme-renderer` alias not being visible to plain `tsc`

## 2026-04-15 — File Explorer Async Navigation Guard

- `src/components/FileExplorer.tsx` now invalidates in-flight directory/search work on unmount and on newer directory-load requests.
- Durable reason:
  overlay-mode panel swaps and `React.StrictMode` remounts were letting stale boot/navigation completions call back into an explorer instance that had already been replaced, which could surface the `getRootForUpdatedFiber` runtime error and briefly repaint the wrong listing.
- `navigate()`, `refresh()`, the boot drive/path effect, and `runSearch()` now all check mount/request ownership before applying async results.
- Added focused regression coverage in `src/test/fileExplorer.viewModes.test.tsx` for a stale directory response arriving after a newer `showHiddenFiles` refresh.
- Validation:
  - passed: `bunx vitest run src/test/fileExplorer.viewModes.test.tsx -t "ignores stale directory responses after a newer refresh updates the explorer state"`
  - blocked by pre-existing workspace errors: narrowed `bunx tsc --noEmit --skipLibCheck ... src/components/FileExplorer.tsx src/test/fileExplorer.viewModes.test.tsx`

## 2026-04-15 — Overlay Render Ordering Crash Fix

- Reproduced the first-render crash in headless Chromium against `localhost:1420` and traced it to hook-order and TDZ bugs in the monolithic overlay shell.
- Fixed several render-time ordering failures:
  - `src/App.tsx` now declares the overlay auto-open effect after the memoized `openPanelIds` state it reads.
  - `src/components/FileExplorer.tsx` now declares `selectedEntries` before `selectedSizeSummary`, keeps the preview-close effects below `closePreview`, and wires `pollDuplicateScan` into the explorer backend destructure.
- The fixed-port `localhost:1420` dev server can look cross-wired if an old tab or another repo is still pointed at the same port. Verify the active client/server pair before assuming one repo imported another repo.
- Browser-only Tauri API errors are a separate issue from the Tauri webview runtime. They can appear when loading the Vite server directly in Chromium, so use the desktop runtime for real validation.

## 2026-04-15 — Dev HUD Always-On Pass

- Added `src/components/DevPerformanceHud.tsx` and mounted it from `App.tsx` so local development now always shows a fixed telemetry HUD without needing a separate plugin or settings hop.
- The HUD reuses the existing overlay frame sampler and adds browser-side navigation, long-task, CLS, INP, and memory reads so dev mode has a visible diagnostics surface instead of a hidden storage-only path.
- `import.meta.env.DEV` now forces the HUD on in local development; the existing `systemSettings.developerMode` toggle still gates the heavier live-reload/watch paths.
- Validation passed with `bunx vite build` and `bunx vitest run src/test/frameTelemetry.test.ts`.
- `bunx vitest run src/test/performanceTelemetry.test.ts` still has a pre-existing failure in the `git_repo_state_load` assertion and was not changed by this pass.

## 2026-04-14 — Terminal Handoff Validation Pass

- Explorer-to-terminal now uses the shared shell-aware `buildTerminalCdCommand` helper, which keeps PowerShell, cmd, and POSIX-style shells on the right `cd` syntax path.
- Focused test coverage passed for the helper itself, but the broader terminal overlay test is currently blocked here by a local `react/jsx-dev-runtime` module resolution issue.
- Next pass should either repair the local test environment or extend the terminal handoff coverage deeper once the UI runtime can start cleanly.

## 2026-04-14 — Taskbar Sync Native Pass

- `windowApplyMode` now drives taskbar visibility through the native platform helper, so macOS Dock state follows the same presentation policy as Linux/Windows skip-taskbar handling.
- `App.tsx` now syncs `windowSetTaskbarVisibility()` when the persisted `showInTaskbar` setting changes, so taskbar state updates immediately instead of waiting for the next mode transition.
- Validation here is still blocked by the mingw linker missing `-lgcc_eh` / `-lgcc`, and Vitest still fails to resolve `vitest/config` plus `@vitejs/plugin-react` in this workspace.

## 2026-04-14 — Explorer Workspace Split Controls Pass

- `ExplorerWorkspace` now shows a compact split indicator plus nudge/reset controls in dual-pane mode, so pane sizing is no longer dependent on the drag handle alone.
- This makes the two-pane layout faster to rebalance after opening a temporary tab or preview-heavy pane, which is a small but real dual-pane ergonomics win.
- Next passes should keep pushing toward dual-pane ergonomics, search/filter polish, and large-folder performance.

## 2026-04-13 — File Explorer Clipboard Shared Across Panes

- Moved the explorer clipboard from `FileExplorer` local state into `src/store/explorerStore.ts`, so copy/cut/paste now survives switching panes and multiple explorer instances inside the same workspace.
- The clipboard payload is now normalized into a small shared snapshot (`path`, `name`, `is_dir`) instead of holding raw React entry objects.
- Next passes should keep pushing toward dual-pane ergonomics, search/filter polish, and large-folder performance.

## 2026-04-14 — Explorer Selected Size Pass

- The explorer toolbar now shows a compact size summary for selected items when size data is available.
- This gives the analyzer surface a more premium, action-oriented feel by answering the obvious follow-up question, "how much space is this selection taking?"
- Next passes should keep pushing toward premium capability depth, especially queueing, network mounts, archive handling, compare/analyzer tools, and advanced automation.

## 2026-04-14 — Explorer Size Summary Pass

- The explorer toolbar now shows a compact size summary for the currently visible entries, using the already-cached entry size data.
- This is the first small step toward a premium storage-analyzer style surface, because it turns raw rows into an at-a-glance space readout.
- Next passes should keep pushing toward premium capability depth, especially queueing, network mounts, archive handling, compare/analyzer tools, and advanced automation.

## 2026-04-14 — Explorer Bookmarks Strip Pass

- The explorer toolbar now surfaces a small pinned-locations strip alongside recent locations.
- This makes the navigation chrome feel more like a premium power-user launcher, because users can jump straight to saved places without hunting.
- Next passes should keep pushing toward premium capability depth, especially queueing, network mounts, archive handling, compare/analyzer tools, and advanced automation.

## 2026-04-14 — Explorer Quick Pin Pass

- The explorer toolbar now exposes a quick `Pin` action for the current location.
- This turns the recent-locations strip into a stronger premium navigation pattern, because users can now keep important places at hand instead of rediscovering them.
- Next passes should keep pushing toward premium capability depth, especially queueing, network mounts, archive handling, compare/analyzer tools, and advanced automation.

## 2026-04-14 — Explorer Recent Locations Pass

- The explorer toolbar now surfaces a small `Recent` strip built from navigation history.
- This gives users a one-click way back to the last few locations, which is a small but very premium-feeling navigation affordance.
- Next passes should keep pushing toward premium capability depth, especially queueing, network mounts, archive handling, compare/analyzer tools, and advanced automation.

## 2026-04-14 — Premium Feature Parity Focus Shift

- Explorer work is now explicitly aimed at premium feature parity, not just polish passes.
- Highest-value gaps to close next: cloud/network mounts, archive handling, file compare, storage analysis, sync/queue tools, metadata editing, and richer batch operations.
- Next passes should keep pushing toward dual-pane ergonomics, search/filter polish, large-folder performance, and premium capability depth.

## 2026-04-14 — Explorer Workspace Empty Pane Copy Pass

- The empty dual-pane placeholder now says `Open Explorer Here`, which makes the first action a little more obvious.
- This is a tiny clarity win, but it helps the split view feel less vague when one side is empty.
- Next passes should keep pushing toward dual-pane ergonomics, search/filter polish, and large-folder performance.

## 2026-04-14 — Explorer Workspace Focus Wash Pass

- The focused pane header now gets a slightly stronger accent-tinted background, which makes the active side pop faster in dual-pane mode.
- This is a small but constant readability win when both panes are busy.
- Next passes should keep pushing toward dual-pane ergonomics, search/filter polish, and large-folder performance.

## 2026-04-14 — Explorer Workspace Move Hint Pass

- The dual-pane chrome now reminds users they can move tabs with either the chip arrow or the dedicated Move button.
- This is a small guidance cue, but it helps the new dual-pane controls feel discoverable instead of hidden.
- Next passes should keep pushing toward dual-pane ergonomics, search/filter polish, and large-folder performance.

## 2026-04-14 — Explorer Workspace Active Tab Pass

- Active tabs in `ExplorerWorkspace` now show an explicit `Active` badge inside the chip, so the current tab is easier to spot in dense tab strips.
- This is a tiny but useful orientation cue for dual-pane work when multiple tabs are open on both sides.
- Next passes should keep pushing toward dual-pane ergonomics, search/filter polish, and large-folder performance.

## 2026-04-13 — Explorer Workspace Focus Cue Pass

- The active pane header now shows a small `Focused` badge, so the current work side is easier to spot instantly.
- This keeps dual-pane navigation from feeling ambiguous when both sides are full of tabs.
- Next passes should keep pushing toward dual-pane ergonomics, search/filter polish, and large-folder performance.

## 2026-04-13 — Explorer Workspace Tab Side Pass

- Tab chips in `ExplorerWorkspace` now carry an explicit `L` or `R` marker, so it’s easier to see which pane each tab belongs to.
- This complements the pane headers and action buttons, tightening the mental model for dual-pane work.
- Next passes should keep pushing toward dual-pane ergonomics, search/filter polish, and large-folder performance.

## 2026-04-13 — Explorer Workspace Pane Identity Pass

- Each dual-pane view now shows a small pane header with its side label and current path, which makes the split feel anchored and easier to scan.
- This pairs with the explicit pane action buttons and helps users keep a mental map of where they are working.
- Next passes should keep pushing toward dual-pane ergonomics, search/filter polish, and large-folder performance.

## 2026-04-13 — Explorer Workspace Pane Action Pass

- Added explicit left/right focus and move controls in the `ExplorerWorkspace` toolbar, so dual-pane tab movement is more discoverable.
- This reduces the “where do I send this tab?” moment and makes the workspace feel more like a real two-pane workbench.
- Next passes should keep pushing toward dual-pane ergonomics, search/filter polish, and large-folder performance.

## 2026-04-13 — File Explorer Preview Trust Pass

- The preview header now shows whether a text preview is saved, dirty, or currently saving.
- This makes the inline editor feel less ambiguous when you’re actively changing files in the explorer.
- Next passes should keep pushing toward dual-pane ergonomics, search/filter polish, and large-folder performance.

## 2026-04-13 — File Explorer Responsiveness Pass

- Reduced frontend pressure in `src/components/FileExplorer.tsx` by trimming the background viewport enrichment batches.
- File size measurement batches now top out lower, and native icon fetch bursts are smaller, which should help the explorer feel less busy on large folders.
- Next passes should keep pushing toward dual-pane ergonomics, search/filter polish, and large-folder performance.

## 2026-04-13 — File Explorer Filter Count Clarity Pass

- The explorer footer now shows filtered-vs-source counts, so large folders and tagged searches are easier to reason about.
- When tag filters hide part of the result set, the footer now says how many items are hidden, which should reduce the “where did my files go?” moment.
- Next passes should keep pushing toward dual-pane ergonomics, search/filter polish, and large-folder performance.

## 2026-04-13 — Explorer Workspace Pane Clarity Pass

- Added explicit left/right pane badges and active-pane text to the `ExplorerWorkspace` chrome, so dual-pane mode is easier to read at a glance.
- The explorer workspace header now tells you how many tabs live in each pane and which side has focus, which should reduce confusion when moving tabs between panes.
- Next passes should keep pushing toward dual-pane ergonomics, search/filter polish, and large-folder performance.

## 2026-04-13 — File Explorer Preview Clarity Pass

- The explorer footer now names the active preview type when preview is open, instead of only showing preview on/off.
- Text previews, image previews, and 3D previews now surface their mode alongside the current file name, which makes inline preview state easier to trust at a glance.
- Next passes should keep pushing toward dual-pane ergonomics, search/filter polish, and large-folder performance.

## 2026-04-13 — File Explorer Search Clarity Pass

- Tightened the explorer footer search affordance in `src/components/FileExplorer.tsx` so active searches now show result counts and loading state inline.
- The empty search state now explains whether recursive text search or names-only search is active, which should reduce confusion when results are sparse.
- Next passes should keep pushing toward dual-pane ergonomics, search/filter polish, and large-folder performance.

## 2026-04-13 — File Explorer Tag Filter Clarity Pass

- Added a compact active-filter summary to `src/components/explorer/ExplorerSideRail.tsx`, so tag filters are easier to notice and clear at a glance.
- The side rail now surfaces the number of active tag filters before the tag chips themselves, which should make search/filter state feel less hidden.
- Next passes should keep pushing toward dual-pane ergonomics, search/filter polish, and large-folder performance.

## 2026-04-13 — File Explorer Heartbeat Plan

- Current explorer posture: `ExplorerWorkspace` owns tabs and panes, while `FileExplorer` remains the main work surface for navigation, preview, drag/drop, search, experimental modes, explorer-pro, and toolbar/rail controls.
- Shipping loop: run focused 20-minute passes, aiming for one meaningful explorer improvement per pass.
- Keep `AGENTS.md` and this file current as priorities shift, especially around monetizable polish, speed, and ergonomics.
- Near-term value targets: cross-pane clipboard flow, sharper search/filtering, preview ergonomics, smoother large-directory performance, and more obvious power-user affordances.

## 2026-04-10 — Explorer Pro Basics Tranche 1 Substrate

- Landed the first explorer-local workspace pass instead of extending the global workbench tab system:
  - new `src/components/explorer/ExplorerWorkspace.tsx` now owns explorer-local tabs, single/dual-pane layout, active pane focus, and persisted split ratio
  - `src/panels/panelRegistry.tsx` now mounts the explorer through `ExplorerWorkspace`, while each pane/tab still renders the existing `FileExplorer` with a distinct `instanceId`
  - `src/store/explorerStore.ts` now persists a workspace snapshot alongside named explorer sessions, including tabs, pane activity, layout mode, focus, and split ratio
- Added Rust-backed Explorer Pro commands in `src-tauri/src/explorer_pro_commands.rs` and exported them through Specta:
  - local app-managed trash with undoable recent action journal
  - batch rename validation/execution
  - progressive duplicate scan start/poll/cancel
  - app-data explorer metadata for tags and saved searches
- `src/runtime/explorerBackend.ts` now exposes the new explorer-pro command surface to the frontend instead of forcing ad hoc Tauri calls from components.
- `src/components/FileExplorer.tsx` picked up the first end-user integrations:
  - trash-by-default confirm flow with explicit permanent delete fallback
  - undo trash toolbar action
  - batch rename dialog with TS-side preview and Rust execution
  - duplicate finder dialog backed by the progressive scan commands
  - saved-search save/apply/delete flow
  - manual tags plus tag-filtered visible entries
  - explorer side rail now has saved-search and tag filter sections
- Durable implementation choices:
  - trash is currently app-managed under Tauri app data rather than OS-native trash because reliable cross-platform undo needs full control over restore locations
  - tags and saved searches are Rust-owned metadata, not project manifests or file xattrs
  - duplicate scanning is rooted at the current local folder tree and intentionally excludes cloud paths in v1
- Focused validation that passed:
  - `cargo run --manifest-path src-tauri/Cargo.toml --bin export-bindings`
  - `bunx vitest run src/test/explorerStore.test.ts`
  - `cargo test --manifest-path src-tauri/Cargo.toml explorer_pro_commands`
- Follow-up still recommended:
  - move explorer clipboard state out of `FileExplorer` local state so copy/cut/paste works seamlessly across dual panes
  - break more explorer-pro dialogs and metadata surfaces out of the monolithic `FileExplorer.tsx` once behavior stabilizes
  - add targeted UI tests around saved-search/tag rail sections and duplicate-finder actions when the current test environment is less noisy

## 2026-04-10 — Explorer Controls Returned To The Omnibox Row

- Moved explorer-only shell controls out of the shared top bar and back into the explorer chrome:
  - `src/App.tsx` now hosts the explorer with `explorerChromeControlSurface: 'toolbar'`
  - the shared `TopBar` no longer renders `Sources`, `Search`, Labs mode, shell layout, view mode, or preview controls
- `src/components/FileExplorer.tsx` now keeps the full explorer control cluster beside the path/search field in the local toolbar:
  - added `Sources` and `Search` buttons to the existing omnibox control row
  - retained the existing Labs, shell layout, view mode, and preview controls in that same row
- Removed the now-dead App/panel-registry wiring that only existed to push explorer toolbar actions through the top bar.
- Durable rationale:
  - the shared top bar should stay panel-agnostic and preserve horizontal space for global shell controls
  - explorer mode/source/preview controls are contextual and belong next to the explorer’s oversized path/search bar, where their impact on navigation is immediate

## 2026-04-10 — First Smoothness Pass For 120 Hz

- Landed a deliberate first pass focused on perceived smoothness rather than visual richness.
- `src/components/FileExplorer.tsx` no longer uses Framer Motion in the explorer hot path:
  - icon-size changes now use CSS transitions
  - experimental layout sections now render without JS-driven layout animation
  - the new-item grid placeholder no longer animates through Framer Motion
- The global blur toggle is now honored across the major shell surfaces:
  - explorer preview / toolbar / status / zoom HUD / experimental HUD
  - top bar and top bar menus
  - command palette scrim and body
  - settings shell
  - terminal shell
- `src/config/performanceTelemetry.ts` now records `overlay_frame_time` against an `8.3ms` p95 target so the stored frame budget matches a 120 Hz goal.
- Narrow validation passed with:
  - `bunx tsc --noEmit --skipLibCheck --jsx react-jsx --module esnext --target es2022 --moduleResolution bundler --allowSyntheticDefaultImports src/vite-env.d.ts src/App.tsx src/components/FileExplorer.tsx src/components/CommandPalette.tsx src/components/SettingsPage.tsx src/components/TerminalOverlay.tsx src/config/performanceTelemetry.ts`
- Recommended next step:
  - profile release-mode wallpaper/shader/animation layer stacking and any remaining scroll-selection hotspots after testing with blur disabled

## 2026-04-10 — Screenshot Task Isolation + Managed Notes Root

- Fixed the screenshot panel status-bar bleed-through in `src/components/ScreenshotsManager.tsx`:
  - removed the `explorerTaskStore` subscription from the screenshot UI
  - durable reason: the explorer/Yazi task feed is global, so screenshot capture errors were surfacing unrelated delete jobs like stale note-file cleanup and making the screenshot tool look like it was deleting arbitrary files
- Fixed cross-platform path joining for screenshot annotated saves:
  - annotated saves now use `joinPlatformPath()` instead of forcing `\\`
  - this keeps Linux/macOS from writing odd backslash-bearing filenames when the screenshot library path is repo-relative or app-data-relative
- Moved notes storage off the old hardcoded Windows root in `src/components/NotesManager.tsx`:
  - new `src/config/notes.ts` resolves notes through `getManagedContentDirectory('notes')`
  - `src/config/appContentDirectories.ts` now treats `notes` as a first-class managed content root in both dev and release/runtime modes
  - note category/file paths now use platform-aware joining instead of manual `\\` concatenation
- This change addresses the bug that was creating literal filenames like `M:\\Assets\\OverlayTerm\\notes\\...md` inside the Linux workspace and then exposing those paths through unrelated explorer delete-task UI.
- Added focused regression coverage in:
  - `src/test/screenshotsManager.test.tsx`
  - `src/test/notesConfig.test.ts`
- Validation that passed:
  - `bunx vitest run src/test/screenshotsManager.test.tsx src/test/notesConfig.test.ts`
  - `bunx tsc --noEmit --skipLibCheck --jsx react-jsx --module esnext --target es2022 --moduleResolution bundler --allowSyntheticDefaultImports --types node,vitest/globals,@testing-library/jest-dom src/vite-env.d.ts src/components/ScreenshotsManager.tsx src/components/NotesManager.tsx src/config/appContentDirectories.ts src/config/notes.ts src/test/screenshotsManager.test.tsx src/test/notesConfig.test.ts`
- Follow-up cleanup still recommended:
  - remove any already-created stray bug artifacts such as repo-local filenames that literally include `M:\\Assets\\OverlayTerm\\...` once the user confirms they are disposable

## 2026-04-09 — Explorer Rail + Drag UX Pass

- Reworked explorer drag behavior so file drag-out is no longer hidden behind `Alt`:
  - `src/components/FileExplorer.tsx` now defaults explorer drags to the native drag bridge and only forces an internal-only drag when `Shift` is held
  - explorer entries still publish the internal `application/x-overlayterm-paths` payload, so in-explorer drops keep their custom move/copy path available
  - explorer drag sources now tag themselves with `data-overlay-drag-intent` during drag start so the shell can distinguish native-export drags from internal explorer drags
- `src/App.tsx` no longer hides the entire overlay for ordinary explorer file drags unless a drag source explicitly opts into overlay-hide behavior.
  - durable reason: the old blanket hide-on-drag made “drag a file out” and “drag a file into another explorer folder” share the same shell teardown path, which made the whole interaction feel broken and fragile
- `src/components/explorer/ExplorerSideRail.tsx` was simplified into a navigator-first rail:
  - the header now foregrounds the current location and bookmark count
  - bookmark organization controls moved behind a deliberate `Manage` mode instead of always occupying the rail chrome
  - bookmark row controls for nested-folder creation, rename, recolor, and delete are hidden unless `Manage` is active
  - bookmark search remains always-on, but category chips and creation controls only surface when managing or when active filters are in play
  - the duplicate `Home` row inside the bookmark tree was removed to reduce visual repetition
- Explorer rail defaults were tightened:
  - `src/config/explorerRail.ts` now uses slimmer full/compact width bounds
  - `src/components/FileExplorer.tsx` now seeds the initial rail width from `getExplorerRailWidthBounds()` instead of the broader theme metric
- Added targeted regression updates in:
  - `src/test/fileExplorer.viewModes.test.tsx`
  - `src/test/explorerSideRail.test.tsx`
- Validation for this pass:
  - passed: narrowed `bunx tsc --noEmit --skipLibCheck --jsx react-jsx --module esnext --target es2022 --moduleResolution bundler --allowSyntheticDefaultImports --types node,vitest/globals,@testing-library/jest-dom src/vite-env.d.ts src/App.tsx src/components/FileExplorer.tsx src/components/explorer/ExplorerSideRail.tsx src/config/explorerRail.ts src/store/explorerStore.ts src/test/explorerSideRail.test.tsx src/test/fileExplorer.viewModes.test.tsx`
  - blocked: Vitest/JSDOM coverage is still failing in this workspace because of the existing `html-encoding-sniffer` -> `@exodus/bytes` CommonJS/ESM incompatibility

## 2026-04-09 — Explorer UI Responsiveness Pass

- Reduced frontend jank in `src/components/FileExplorer.tsx` by moving large explorer result adoption onto React transitions:
  - directory loads now `startTransition()` the bulk `entries` update
  - search responses now `startTransition()` the `searchResults` update
  - background native-icon and entry-size maps now update through transitions instead of competing with active input/scroll work
- Added short viewport-settle delays before launching background enrichment work for visible entries:
  - entry-size batches wait `72ms`
  - native-icon batches wait `96ms`
- The settle-delay avoids firing repeated `fs_measure_entry_sizes` / `fs_resolve_native_icons` batches while the user is still scrolling the virtualized viewport, which reduces Tauri IPC churn and unnecessary rerender pressure during fast navigation.
- Exported `invalidateExplorerResultCaches()` from `src/components/FileExplorer.tsx` so tests and support tooling can explicitly clear the shared explorer directory/search caches when they need isolated backend state.
- Updated `src/test/fileExplorer.searchTelemetry.test.tsx` to clear the shared explorer caches in `beforeEach`, which keeps the diagnostics assertions honest now that cache reuse is an intentional cross-mount behavior.
- Validation completed for this pass:
  - `bun run test:browser`
  - `npx vitest run src/test/fileExplorer.searchTelemetry.test.tsx --reporter verbose`
  - `bun run build`
- Validation still blocked by pre-existing workspace issues:
  - `bun run test:unit` still does not complete cleanly within a 45s timeout and reports unrelated failures in `terminalOverlay`, `app.dockMode`, `pluginRuntime`, and `animationRuntime`
  - JSDOM still logs repeated `HTMLCanvasElement.getContext()` not-implemented warnings in this workspace without the optional `canvas` package


## 2026-04-09 — Shader Runtime Performance Pass

- Targeted the shell shader path because the sluggishness was coming from the built-in shader surfaces doing React-driven animation every frame.
- `src/components/shaderRuntime.tsx` now keeps the built-in animated shader surfaces off the React RAF path:
  - Nebula and Prism background/top-bar/border surfaces now use injected CSS keyframes instead of `useSyncExternalStore` + React rerenders every frame
  - this removes the shared built-in shader RAF clock entirely
- Canvas-backed shader surfaces still animate, but they are now throttled to roughly 24 FPS through the shared canvas animator instead of drawing every browser frame.
- Canvas shader DPR is now capped at `1.25` instead of `1.5` to reduce fill-rate pressure on large translucent surfaces.
- Validation that passed:
  - narrowed `bunx tsc --noEmit --skipLibCheck --jsx react-jsx --module esnext --target es2022 --moduleResolution bundler --allowSyntheticDefaultImports --types node,vitest/globals,@testing-library/jest-dom ...`
  - `bunx vitest run --environment node src/test/shaderRuntime.test.ts`
- Remaining likely hotspots if the UI still feels slow after this pass:
  - shell-wide `backdrop-filter` blur
  - live wallpapers / video wallpapers
  - large explorer panel renders while shaders, wallpaper, and animation overlays are stacked together

## 2026-04-09 — Linux Local Installer Stale Binary Fix

- Fixed the local Linux install scripts so they no longer copy `src-tauri/target/release/greeble`.
- Root cause: this repo is a Cargo workspace, and `cargo build --manifest-path src-tauri/Cargo.toml --release` writes the fresh binary to the workspace target directory at `target/release/greeble`.
- The stale install symptom was caused by older binaries still sitting under `src-tauri/target/release/greeble`, which made the installed app show an older UI even though `bun run tauri dev` reflected current frontend changes.
- Follow-up root cause: the base `src-tauri/tauri.conf.json` also carried `build.devUrl`, which caused direct release builds to keep trying `http://localhost:1420` and surface the "Could not connect to localhost: Connection refused" startup error.
- `src-tauri/tauri.conf.json` now keeps only release-safe build settings, and `scripts/run-platform-tauri.mjs` injects `devUrl` only when running `tauri dev`.
- `scripts/build-and-install-linux-local-release.sh` now resolves `cargo metadata` `target_directory` with Bun and installs from that real workspace output.
- `scripts/platform/install_linux.sh` now resolves the same `target_directory` with Node before copying the built binary into `~/.local/bin`.
- Verified end-to-end with `bash ./install.sh` and confirmed:
  - `/home/ephemara/Dev/Apps-2D/GreebleFS/target/release/greeble` matches `/home/ephemara/.local/opt/overlayterm/overlayterm`
  - the installed binary no longer matches the stale `/home/ephemara/Dev/Apps-2D/GreebleFS/src-tauri/target/release/greeble`
  - `strace -f -e trace=connect` against the rebuilt installed binary shows no more connection attempts to `127.0.0.1:1420`
  - `timeout 20s bun run tauri dev` still starts Vite on `http://localhost:1420/` and reaches the Tauri dev runner

## 2026-04-09 — Theme Wallpapers + Wallpaper Runtime Layer

- Added a first-class wallpaper runtime so backgrounds are no longer limited to theme CSS gradients.
- Managed content now includes a `wallpapers/` root alongside `themes/`, `shaders/`, and `animations/`.
- New wallpaper runtime files:
  - `src/config/wallpapers.ts`
  - `src/components/wallpaperRuntime.tsx`
- Wallpapers now support:
  - theme-default wallpaper assets via `theme.assets.backgroundUrl`
  - imported image/video wallpapers saved into `wallpapers/`
  - authored live wallpaper modules in `wallpapers/`
- Wallpaper selection is now part of `settings.appearance`:
  - `activeWallpaperId: null` follows the active theme
  - `activeWallpaperId: 'none'` disables the wallpaper layer
  - any other id selects an imported/authored wallpaper override
  - `wallpaperFitMode`, `wallpaperOpacity`, and `wallpaperMuted` now persist too
- `src/App.tsx` render order was intentionally changed so the layers compose instead of replacing each other:
  - wallpaper base layer
  - theme effect layer
  - shader background surface
  - theme visuals
  - shader border surface
  - shell animation overlay
- This specifically preserves the user-requested behavior:
  - wallpapers can remain part of the theme system
  - user wallpaper overrides can still sit under live shader passes
  - wallpaper and shader effects can both be active at the same time
- `src/components/SettingsPage.tsx` now has a dedicated Wallpapers section for:
  - importing media/runtime wallpaper files
  - opening and refreshing the wallpaper folder
  - following the theme wallpaper, disabling the wallpaper layer, or choosing a user override
  - changing wallpaper fit, opacity, and mute state
- `src/panels/panelRegistry.tsx` and the Settings panel prop contract were extended so wallpaper catalog data and actions flow through the normal panel system.
- Durable implementation note:
  - theme packages often used `theme.effects.backgroundImage` as a fallback wallpaper path before this change
  - the runtime now suppresses that fallback only when it duplicates `theme.assets.backgroundUrl`, so explicit theme effect gradients still layer correctly above wallpapers
- Validation that passed:
  - narrowed `bunx tsc --noEmit --skipLibCheck --jsx react-jsx --module esnext --target es2022 --moduleResolution bundler --allowSyntheticDefaultImports --types vitest/globals,@testing-library/jest-dom ...`
  - `bunx vitest run src/test/settingsStore.test.ts src/test/panelRegistry.test.tsx src/test/settingsPage.behavior.test.tsx src/test/settingsPage.shaders.test.tsx src/test/wallpaperRuntime.test.ts`

## 2026-04-09 — Hybrid App Mode / Dock Mode Correction

- Corrected the shell model after the drawer misread:
  - `windowed` is the larger application shell
  - `overlay` is the compact dock shell
  - dock mode is not a separate in-app content drawer
- `src/App.tsx` now drives the explorer directly from `settings.terminal.windowMode` again:
  - `windowed` passes `explorerLayoutMode: 'full'`
  - `overlay` passes `explorerLayoutMode: 'dock'`
  - entering dock mode forces the explorer panel forward so the compact shell behaves like the portable UE-style browser
- Explorer shell controls were lifted back into the command-center top bar:
  - sources visibility
  - focus search
  - experimental mode cycling
  - shell layout cycling
  - view mode cycling
  - preview toggle
- `src/components/FileExplorer.tsx` no longer exposes drawer/dock surface semantics. It now renders as the same explorer surface in either `full` or `dock` mode, and embedded shell-layout/view/preview controls are suppressed when the command center owns them in the top bar.
- Added `settings.system.developerMode` and flipped live watcher behavior to opt-in:
  - plugin directory watching and fallback polling only run when developer mode is enabled
  - authored shader polling only runs when developer mode is enabled
  - authored animation polling only runs when developer mode is enabled
  - explorer entry-size root watching only runs when developer mode is enabled
- Manual refresh is now the default production path:
  - Plugins panel `Refresh`
  - Settings `Refresh Shaders`
  - Settings `Refresh Animations`
- Fixed the `FileExplorer.tsx` update-depth loop in the virtualized batching effects by keeping in-flight entry-size/native-icon sets stable until the async batch resolves instead of clearing/re-adding them every render.
- Removed the incorrect drawer/dock subsystem:
  - deleted `src/components/WorkbenchContentBrowserDock.tsx`
  - removed `contentBrowserDock` from `src/config/layoutProfiles.ts`
  - removed `layout.contentBrowserDockByProfile` from `src/store/settingsStore.ts`
  - removed the old content-browser-specific explorer instance ids from `src/store/explorerStore.ts`
- Restored shell copy and controls back to the actual product language:
  - `App/Dock Mode` in the shell and hotkeys
  - `Application Mode` / `Dock Mode` in settings
- Added focused app coverage in `src/test/app.dockMode.test.tsx` for:
  - full explorer rendering in application mode
  - dock explorer rendering in dock mode
  - foregrounding explorer when switching into dock mode
- Updated supporting tests to match the corrected model:
  - `src/test/layoutProfiles.test.ts`
  - `src/test/settingsPage.behavior.test.tsx`
  - `src/test/explorerStore.test.ts`
- Linux/native overlay positioning improvements remain in place:
  - monitor selection prefers the current or last-active monitor instead of `primaryMonitor()`
  - `computeOverlayWindowLayout()` left-anchors the overlay on X instead of centering it
- Validation that passed:
  - `bunx vite build`
  - `cargo run --manifest-path src-tauri/Cargo.toml --bin export-bindings`
  - `cargo build --manifest-path src-tauri/Cargo.toml --release`
  - narrowed `bunx tsc --noEmit --skipLibCheck ... src/store/settingsStore.ts src/runtime/useFolderPluginRuntime.ts src/components/FileExplorer.tsx src/components/PluginsManager.tsx src/components/SettingsPage.tsx src/App.tsx`
- Added a real local Linux installer entrypoint:
  - root `install.sh`
  - fixed `scripts/build-and-install-linux-local-release.sh`
  - patched `package.json` build/dev icon-sync commands to use Bun instead of Node for the JSON import-attribute script
- Corrected the release/install content-root behavior that was creating top-level home folders like `~/plugins`, `~/themes`, `~/shaders`, `~/animations`, and `~/Screenshots`:
  - added `src/config/appContentDirectories.ts`
  - `tauri dev` still uses repo-relative content folders for in-repo authoring
  - installed/release builds now resolve managed content under Tauri `AppLocalData`
  - `src/main.tsx` now initializes managed content directories before importing `App`
  - screenshot settings imports now migrate away from the old bad default path when loading persisted settings
  - the Linux installer now seeds `plugins`, `themes`, `shaders`, and `animations` into `~/.local/share/co.overlayterm.app`
- Fixed Linux dock-mode geometry regression where the overlay WM could recenter the dock in the middle of the screen after show:
  - added `computeAnchoredOverlayWindowLayout()` in `src/config/overlayWindow.ts`
  - `src/App.tsx` now preserves overlay size but always re-derives dock X/Y from the active monitor edge
  - Linux overlay open now performs a short delayed re-dock pass after `show()` to override WM recentering
  - overlay move/resize listeners now snap overlay mode back to the dock edge instead of persisting floating coordinates
  - added regression coverage in `src/test/overlayWindow.test.ts`
- Hardened the Linux dock path so presentation-only window flag failures do not cancel geometry:
  - `src-tauri/src/window_commands.rs` now logs best-effort failures for `set_decorations`, `set_always_on_top`, `set_shadow`, and `set_skip_taskbar` instead of aborting before `set_size` / `set_position`
  - `src/App.tsx` now unwraps `windowApplyMode()` results so Tauri command errors surface instead of being silently ignored on the TS side
  - this specifically protects `tauri dev` on Linux where some WMs reject transparent/undecorated presentation changes during startup
- Replaced the backend-forcing detour with a targeted Wayland toggle fix:
  - reverted the `src-tauri/src/main.rs` backend override so native Wayland stays enabled
  - added `window_get_linux_display_server()` in `src-tauri/src/window_commands.rs`
  - Wayland overlay reopen now preserves compositor-managed placement by skipping dock geometry reapplication during the hidden overlay open path
  - `src/App.tsx` now marks `isFreefloatingRef.current = true` on real overlay move/resize events so a snapped bottom-edge dock can survive `Ctrl+Space` close/open cycles
- The installer now performs the full build/install flow directly:
  - sync icons
  - regenerate Tauri bindings
  - build frontend
  - build release binary
  - install to `~/.local/opt/overlayterm`
  - update `~/.local/bin/overlayterm`
  - update the desktop entry and icon
- Verified end-to-end with `bash ./install.sh`.
- Validation/workflow blockers still present in the workspace:
  - JSDOM-backed `vitest` runs are still blocked by the existing `html-encoding-sniffer` / `@exodus/bytes` ESM worker failure
  - `bun run release:linux:install*` currently fails on Node 18 because `scripts/sync-canonical-icons.mjs` uses JSON import attributes; use the direct Bun/Cargo build path until Node is upgraded
- Release binary was rebuilt and reinstalled manually to:
  - `/home/ephemara/.local/opt/overlayterm/overlayterm`
  - symlink `/home/ephemara/.local/bin/overlayterm`
  - desktop entry `/home/ephemara/.local/share/applications/co.overlayterm.app.desktop`

## 2026-04-09 — Explorer Experimental Layouts Completed

- Finished the two previously stubbed explorer experimental modes in `src/components/FileExplorer.tsx`:
  - `constellation`
  - `timeline-surface`
- `src/config/explorerExperimentalModes.ts` now treats all three experimental layouts as shipped and adds mode-specific density descriptors so the same persisted `experimentalDensity` value can mean:
  - semantic density for `adaptive-semantic-grid`
  - link density for `constellation`
  - timeline granularity for `timeline-surface`
- `FileExplorer.tsx` now uses one shared experimental control plane across all modes:
  - the toolbar Labs button shows the active mode glyph and density percentage
  - the HUD reflects the active mode’s density descriptor instead of assuming adaptive-only labels
  - Ctrl/Cmd + wheel and the layout toggle hotkey step density for any active experimental mode, not just the adaptive grid
  - compact dock and active search still force the existing fallback to the normal explorer
- `constellation` reuses the semantic grouping system from the adaptive grid and renders those bands as orbital cluster fields with direct entry interaction.
- `timeline-surface` renders entries into time-banded surfaces whose bucket granularity changes with the same persisted density setting.
- Added/updated focused coverage in:
  - `src/test/explorerExperimentalModes.test.ts`
  - `src/test/fileExplorer.viewModes.test.tsx`
- Validation that passed for this change:
  - narrowed `tsc --noEmit` over `src/config/explorerExperimentalModes.ts`, `src/components/FileExplorer.tsx`, and the touched tests
- Validation that is still blocked by workspace issues:
  - `vitest run` remains blocked by the existing `html-encoding-sniffer` / `@exodus/bytes` JSDOM worker failure recorded in `ARCHITECTURE.md`

## 2026-04-09 — Explorer Shell Layout Presets + Real Preview Toggle

- Added `src/config/explorerShellLayouts.ts` as a data-driven explorer shell layout layer separate from theme recipes.
- Explorer shell layout presets now include:
  - `balanced`
  - `navigator`
  - `focus`
  - `inspector`
- These presets are session-persisted through `src/store/explorerStore.ts` via `session.shellLayoutId`.
- Explorer inline preview now has a real persisted enable/disable flag through `session.previewEnabled`.
- `src/components/FileExplorer.tsx` now treats the preview toggle as authoritative:
  - single-click no longer auto-previews files when preview is off
  - `openEntry()` no longer routes text/image/model files into the inline preview when preview is off
  - turning preview off closes the current preview and keeps the side pane hidden
- The shell layout presets currently change explorer structure without needing a theme swap:
  - `focus` hides the side rail
  - `inspector` moves the preview pane to the leading edge and enlarges it
  - `navigator` emphasizes the rail and de-emphasizes preview width
- Added focused coverage in:
  - `src/test/fileExplorer.viewModes.test.tsx`
  - `src/test/explorerStore.test.ts`
- Validation that passed for this change:
  - `npx vitest run src/test/explorerStore.test.ts src/test/fileExplorer.viewModes.test.tsx`
  - narrow `tsc --noEmit` over the touched explorer files

## 2026-04-08 — Workbench + Explorer Theme Recipe System

- Added a first-class app-wide theming layer under `theme.workbench`.
- Added a first-class explorer theming layer under `theme.explorer`.
- New resolvers live in:
  - `src/config/workbenchTheme.ts`
  - `src/config/explorerTheme.ts`
- Added `src/config/themeEngineBindings.ts` so workbench/explorer recipe resolution can bind to generalized theme-engine descriptors instead of only hardcoded archetypes.
- The workbench recipe supports optional recipe seeds (`workbench`, `xmb`, `channel-grid`), explicit `layoutPrimitiveId` / `navigationPatternId` / `renderStyleId` bindings, plus overrides for top bar chrome, command palette chrome, terminal shell chrome, settings shell chrome, tabs, metrics, surfaces, typography, and raw workbench CSS vars.
- The explorer recipe supports optional recipe seeds (`workbench`, `xmb`, `channel-grid`), explicit `layoutPrimitiveId` / `navigationPatternId` / `renderStyleId` bindings, plus overrides for chrome, preview, status bar, breadcrumb style, rail position, view-mode preference, metrics, surfaces, typography, and raw explorer-only CSS vars.
- `src/config/appearance.ts` now preserves compiled engine manifests on themes and compiles raw engine manifests when present, so built-ins, custom imports, and package themes can all feed the same live recipe path.
- Theme packages now carry `engineManifest` and `compiledEngineManifest` directly on their resolved `theme` object, which lets the active workbench/explorer recipes derive defaults from generic layout/navigation/render descriptors.
- `src/components/FileExplorer.tsx` now consumes the resolved explorer recipe and uses it to drive:
  - root/toolbar/preview/status chrome
  - rail placement
  - grid/list/table/adaptive metric scaling
  - entry hover/selection/drop behavior
  - more themeable input/dialog surfaces
- `src/components/explorer/ExplorerSideRail.tsx` now reads the explorer recipe branding/chrome variables instead of assuming a fixed workbench identity.
- `src/App.tsx`, `src/components/CommandPalette.tsx`, `src/components/TerminalOverlay.tsx`, and `src/components/SettingsPage.tsx` now consume the workbench recipe so theme packages can reshape the whole command center, not just the explorer.
- Added sample theme packages:
  - `themes/xmb-crosswave/theme.json`
  - `themes/wii-channel-home/theme.json`
- Added focused tests for the new recipe path:
  - `src/test/workbenchTheme.test.ts`
  - `src/test/explorerTheme.test.ts`
  - `src/test/themePackageExplorerRecipe.test.ts`

## 2026-04-08 — Live Render Runtime Layer

- Added `src/config/workbenchRenderRuntime.ts` so render styles now resolve into an actual shell interaction runtime instead of staying metadata-only.
- The runtime currently supports four interaction models:
  - `workbench-tabs`
  - `cross-axis-media`
  - `channel-launcher`
  - `desktop-stack`
- `src/components/WorkbenchNavigationSurface.tsx` now renders a runtime-specific launcher rail for cross-axis, channel-grid, and desktop-style shells.
- `src/App.tsx` now delegates shell navigation/content structure to the resolved runtime:
  - tabbed workbench keeps the old chrome tab strip
  - cross-axis themes get grouped launcher navigation
  - iOS / Wii style themes get larger grouped launcher tiles
  - desktop-style themes get dock/list navigation with card-style panel presentation
- `src/panels/panelRegistry.tsx` now attaches navigation metadata to panels so runtimes can regroup panels by domain without app-wide ad hoc switch statements.
- This keeps the system generalized: themes define `renderStyles`, `navigationPatterns`, `layoutPrimitives`, and `presentation`, and the app picks a runtime from those descriptors rather than from hardcoded theme names.

## Validation Notes

- Narrowed workbench/explorer typecheck passed except for the existing unrelated `src/runtime/useFolderPluginRuntime.ts` failure recorded in `ARCHITECTURE.md`.
- Pure Node Vitest coverage for the new recipe path passed.
- JSDOM-based explorer tests could not be executed in this environment because of the existing `html-encoding-sniffer` / `@exodus/bytes` ESM worker failure.

## Recommended Next Step

- Fix the workspace JSDOM/Vitest worker issue so the DOM-level explorer tests can run again, then add browser/RTL coverage that asserts:
  - workbench recipe chrome changes on the top bar, command palette, and settings shell
  - rail-right layouts
  - floating/glass preview shells
  - status-bar hidden/floating modes
  - theme-preferred initial explorer layout selection

## 2026-04-09 — Theme Pack Expansion

- Added ten new package themes under `themes/` so the theme picker has a broader range of shell personalities without requiring any app-code changes:
  - `windows-95-classic`
  - `windows-xp-luna`
  - `vista-aero-glass`
  - `amber-cathode`
  - `dos-navigator`
  - `palm-organizer`
  - `gamecube-orbital`
  - `dreamcast-skyline`
  - `synthwave-highway`
  - `midnight-noir`
- The new set intentionally spans multiple runtime families instead of only palette swaps:
  - desktop-window-manager shells for the Windows-inspired themes
  - launcher-grid shells for Palm / GameCube / Dreamcast inspired themes
  - cross-axis media styling for `synthwave-highway`
  - denser workbench shells for `amber-cathode`, `dos-navigator`, and `midnight-noir`
- Each theme is authored as a self-contained `theme.json` package with its own palette, workbench recipe, explorer recipe, engine metadata, and visual overlay layer.
- Validation completed for this pass:
  - all `themes/*/theme.json` files parse as valid JSON
  - theme ids are unique across the current package set

- GitManager badge polling now skips hidden documents during steady-state refresh, and visibility restoration triggers an immediate resync instead of waiting for the next 30s tick.


## 2026-04-14 — GitManager Visibility Restore Bound Pass

- Added an explicit one-shot visibility-restore guard in `src/components/GitManager.tsx` so a hidden panel only resyncs once per restore cycle.
- Added regression coverage for a second hide/show cycle to confirm the restore guard resets after the document hides again.
- Validation attempt: `bunx vitest run src/test/gitManager.behavior.test.tsx` is still blocked here because the repo environment cannot resolve `vitest` from `vitest.config.ts`.
- Next pass should keep pushing toward terminal throughput and shell handoff responsiveness, unless a GitManager regression shows up again.

## 2026-04-14 — Terminal Backend Reality Check

- The terminal backend no longer flushes on each write, so the remaining throughput hotspot is the shared terminal map mutex across write/read/resize paths.
- `cargo test --manifest-path src-tauri/Cargo.toml terminal -- --nocapture` is still blocked here by the mingw linker missing `-lgcc_eh` / `-lgcc`.
- Next terminal pass should address lock scope or instance ownership, not flush calls.
