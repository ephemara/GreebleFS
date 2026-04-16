# GreebleFS Architecture

## Purpose

GreebleFS is a Tauri desktop workbench centered on a highly themeable file explorer, terminal overlay, plugins, shaders, animations, screenshots, and settings-driven shell customization.

## Release Identity

- The canonical shipped product name is now `GreebleFS`.
- Release/package surfaces use:
  - npm package name `greeblefs`
  - Rust package/binary `greeblefs`
  - Tauri product name `GreebleFS`
  - Tauri identifier `co.greeblefs.app`
- The repository still intentionally preserves several legacy `OverlayTerm` runtime contracts for compatibility during `v0.1.0-rc1`:
  - plugin/runtime module ids such as `overlayterm-plugin`
  - event namespaces and drag payload keys prefixed with `overlayterm`
  - older `OVERLAYTERM_*` and `VITE_OVERLAYTERM_*` environment overrides as fallbacks
  - legacy layout/config discovery paths where migration is safe

## Stack

- Frontend: React 19 + TypeScript + Vite
- State: Zustand
- Desktop host: Tauri 2 + Rust
- Visual system: CSS variables, theme packages, icon themes, shaders, animations
- Tests: Vitest unit/browser, Rust tests

## Main Entry Points

- `src/main.tsx`
  Frontend bootstrap. It now selects the root app by webview label, rendering `App` for the main shell and `src/windows/FileOperationsWindowApp.tsx` for the dedicated `file-operations` popout.
- `src/App.tsx`
  Overlay window shell, theme/runtime discovery, panel orchestration.
- `src/panels/panelRegistry.tsx`
  Built-in panel registration and prop wiring.
- `src/components/FileExplorer.tsx`
  Main explorer shell, navigation, preview, standard layout modes, experimental explorer runtimes, and the dock-owned layout contract used when the app switches into overlay mode.
- `src/components/explorer/ExplorerWorkspace.tsx`
  Explorer-local workspace shell that wraps `FileExplorer` instances with explorer tabs, slot-based `1-Up` / `2-Up` / `4-Up` pane layouts, pane focus, and adaptive split sizing.
- `src/components/explorer/ExplorerSideRail.tsx`
  Explorer rail, drives, bookmarks, saved searches, and tag-filter browsing.
- `src/config/appearance.ts`
  Core overlay theme model and resolved CSS variables.
- `src/config/pilotThemeContract.ts`
  Data-driven pilot theme baseline for built-in theme defaults, app/dock recipe normalization, and explorer/layout reset behavior when built-in themes are selected.
- `src/config/workbenchTheme.ts`
  App-wide workbench recipe resolution and workbench-scoped CSS variable contract.
- `src/config/explorerTheme.ts`
  Explorer-specific theme recipe resolution, metrics scaling, and explorer-scoped CSS variable contract.
- `src/config/explorerModeProfiles.ts`
  Explorer mode-profile registry that maps user-facing explorer modes onto pane-layout ids, chrome-layout ids, and view-bias defaults.
- `src/config/explorerShellLayouts.ts`
  Pane-layout presets that still own rail visibility, preview placement, and live pane sizing behavior. These remain the pane-composition layer even after mode profiles and chrome layouts were split out.
- `src/config/explorerChromeLayouts.ts`
  Explorer chrome layout registry/resolver for adaptive topbar, toolbar, workspace header, rail header, preview header, and status-strip control placement plus zone-based layout override snapshots.
- `src/config/themeEngineBindings.ts`
  Shared engine-manifest binding helpers for layout/navigation/render-driven recipe defaults.
- `src/config/workbenchRenderRuntime.ts`
  Resolves the active workbench interaction runtime from the theme engine manifest and layout profile.
- `src/config/layoutProfiles.ts`
  Built-in and external layout manifest normalization for shell blueprints, pinned panels, control docks, and top/bottom chrome behavior.
- `src/config/themePackages.ts`
  Theme package discovery and manifest loading from `themes/`.
- `src/config/themeCatalogCuration.ts`
  Host-owned curation metadata for packaged themes. It defines the official pilot suite, legacy/lab tiers, archive tiers, and stable sort/badge metadata used by Settings and loader consumers.
- `src/config/wallpapers.ts`
  Wallpaper directory resolution, fit-mode contract, and wallpaper runtime config.
- `src/components/WorkbenchNavigationSurface.tsx`
  Runtime-swappable launcher surface for cross-axis, channel-grid, desktop, and tabbed shells.
- `src/components/ScreenshotsManager.tsx`
  Screenshot capture/editor/library surface. It owns monitor preview orchestration, selection editing, annotation authoring, and gallery actions, but annotated export is now delegated to Rust instead of being rasterized in the browser.
- `src/components/pluginRuntime.tsx`
  Packaged frontend plugin runtime loader. It owns the allowlisted module graph for frontend plugins, including package-local relative imports and the host-provided `overlayterm-plugin` bridge helpers.
- `src/components/DevPerformanceHud.tsx`
  Fixed dev-only diagnostics HUD rendered by `App.tsx` whenever the frontend runs in `import.meta.env.DEV` or explicit developer mode. It shows live frame, navigation, CLS, INP, long-task, and memory telemetry for local development.
- `src/components/wallpaperRuntime.tsx`
  Imported image/video wallpapers, authored live wallpaper modules, and theme-wallpaper selection helpers.
- `src/runtime/pluginPanelRequests.ts`
  Shared plugin-panel handoff bridge for explorer/plugin context flows. It persists the latest request payload and dispatches shell-level open-panel events plus panel-specific update events.
- `src/runtime/fileOperationsWindow.ts`
  Shared file-operations popout bridge. It owns the `file-operations` window label, persisted request/completion payloads, cross-window event names, and the helper that creates or focuses the dedicated popout window.
- `src/windows/FileOperationsWindowApp.tsx`
  Themeable secondary window for destination picking and long-running explorer file-operation visibility. It shares the same appearance/runtime stack as the main shell but stays scoped to copy/move flows and the explorer task feed.
- `src/store/explorerStore.ts`
  Persisted explorer rail, named explorer session snapshots, and explorer-local workspace state for tabs plus slot-based workspace layouts.
- `src/store/explorerTaskStore.ts`
  Explorer-local task-center store. It hydrates durable task history from the Rust backend, subscribes to live explorer task progress events, and owns the open/close state plus retry/cancel/clear helpers used by the explorer toolbar badge and command palette.
- `src/store/settingsStore.ts`
  Persisted layout/profile settings, wallpaper/shader/animation overrides, app-vs-dock theme selection, the native `windowMode` presentation toggle, and machine-level developer-mode behavior.

## Theme / Workbench Architecture

- Overlay themes still own the global palette, effects, fonts, icon theme, visuals, and shader/motion defaults.
- `src/config/pilotThemeContract.ts` is the source of truth for the boring default shell:
  - `pilot-dark` and `pilot-light` are the canonical built-in defaults
  - all built-in themes inherit the same pilot workbench, explorer, and dock recipe baseline unless they explicitly override it
  - built-in theme switches can also carry appearance/explorer/layout reset defaults instead of only changing palette data
- Theme packages can ship a wallpaper asset through `theme.assets.backgroundUrl`; that asset is now the theme-default wallpaper layer instead of only preview metadata.
- Package-theme curation is now host-owned instead of being implied by package manifests alone:
  - `src/config/themeCatalogCuration.ts` defines the current official pilot set and the non-flagship tiers
  - packaged themes carry computed `catalog` metadata through `LoadedOverlayThemePackage`
  - `SettingsPage.tsx` groups the catalog into `Official Pilot Suite`, `Built-In Baselines`, and `Legacy / Lab Archive` instead of presenting one flat wall
  - the current official pilot package set is `vector-monolith`, `cyber-nexus-hud`, `celestial-astrolabe`, and `clarity-line`
- Theme packages can also ship a generalized engine manifest through `presentation`, `layoutPrimitives`, `navigationPatterns`, and `renderStyles`.
- `src/config/appearance.ts` now preserves compiled engine manifests on the active theme so recipe resolution can use them at runtime.
- Workbench theming is now a first-class recipe layer under `theme.workbench`.
- `theme.workbench` supports optional recipe seeds like `workbench`, `xmb`, and `channel-grid`, plus explicit `layoutPrimitiveId` / `navigationPatternId` / `renderStyleId` bindings and app-wide overrides for:
  - top bar chrome
  - command palette chrome
  - terminal shell chrome
  - settings shell chrome
  - shared tabs and button treatment
  - shell insets, radii, and panel spacing
  - workbench-scoped CSS vars
- Explorer theming is now a first-class recipe layer under `theme.explorer`.
- `theme.explorer` supports optional recipe seeds like `workbench`, `xmb`, and `channel-grid`, plus explicit `layoutPrimitiveId` / `navigationPatternId` / `renderStyleId` bindings and local overrides for:
  - chrome style
  - `chromeLayoutId` for explorer control composition
  - `defaultModeProfileId` for theme-driven explorer mode defaults
  - breadcrumb style
  - preview style
  - status bar style
  - rail position and brand label
  - preferred explorer view mode / experimental mode
  - metrics
  - surfaces
  - typography
  - raw explorer-only CSS vars
- When no recipe seed is provided, `src/config/workbenchTheme.ts` and `src/config/explorerTheme.ts` now derive shell defaults from the active engine-manifest presentation, layout primitive, navigation pattern, and render style.
- Render styles are no longer passive metadata. `src/config/workbenchRenderRuntime.ts` now maps the active theme engine state and active layout shell blueprint into a live interaction runtime:
  - `workbench-tabs`
  - `cross-axis-media`
  - `channel-launcher`
  - `desktop-stack`
- `App.tsx` now uses that runtime to swap navigation behavior and content presentation, and `OverlayPanelDefinition.navigation` metadata in `src/panels/panelRegistry.tsx` gives render runtimes enough structure to regroup panels without hardcoded one-off app logic.
- Custom theme renderers now run against a renderer-owned shell contract instead of implicitly layering custom launchers on top of shared chrome:
  - `src/components/themeRendererShellModel.ts` builds a normalized `shellModel` with launcher groups, utility actions, viewport metrics, and clamped shell regions for `chrome`, `launcher`, `content`, and pinned sides
  - `src/components/themeRendererRuntime.tsx` exposes that `shellModel` plus explicit `surfaceOwnership` flags on each renderer definition
  - `App.tsx` uses `surfaceOwnership` to suppress default launcher chrome, pinned shells, and duplicate wallpaper/content framing when the renderer claims those surfaces
  - ownership only suppresses the host's automatic placement; a renderer can still deliberately pull host surfaces into its own layout through `host.renderDefaultNavigationSurface()`, `host.renderPinnedPanels()`, and `host.renderDefaultContentSurface()`
  - bundled renderers should prefer `host.shellModel` and `host.renderUtilityActionsSurface()` over raw `host.panels` + `host.renderChromeBar()` composition where possible
- The retro-console custom renderers are now being rewritten as distinct shell languages instead of palette-only variants:
  - `themes/dreamcast-skyline/renderers/dreamcast-skyline.tsx`
  - `themes/gamecube-helix/renderers/gamecube-helix.tsx`
  - `themes/gamecube-orbital/renderers/gamecube-orbital.tsx`
  - `themes/gamecube-prism/renderers/gamecube-prism.tsx`
  - they now anchor all geometry to normalized shell regions and renderer-owned launcher/content surfaces so layout cannot drift off-screen
- The shared top bar is now renderer-aware instead of universally assuming launcher ownership:
  - `TopBar` strips launcher/menu/tab-strip chrome when the active renderer claims `launcher`, so themes with custom radial/channel/XMB launchers no longer render a second launcher system through `host.renderChromeBar()`
- `src/components/WorkbenchNavigationSurface.tsx` now takes its rail width from `src/config/workbenchRenderRuntime.ts` instead of hardcoded per-runtime widths inside the component, so launcher sizing stays in the runtime contract.
- `themes/celestial-astrolabe/renderers/astrolabe.tsx` was rebuilt as a full-screen observatory shell:
  - the content stage now owns the center of the viewport
  - launcher groups/panels orbit the stage instead of living in a boxed sidebar column
  - the lower deck is a full-width control band, so the theme uses the viewport more like a flagship shell and less like a themed three-column dashboard
- Wallpaper rendering is now a first-class layered pass in `App.tsx`:
  - theme wallpaper asset or user-selected wallpaper renders as the base layer
  - `theme.effects.backgroundImage` renders as the theme effect layer above the wallpaper
  - shader background/border surfaces still render above wallpapers
  - `theme.visuals` still render above the shader background
- Wallpaper selection is part of the persisted appearance contract:
  - `settings.appearance.activeWallpaperId === null` follows the active theme wallpaper
  - `settings.appearance.activeWallpaperId === 'none'` disables the wallpaper layer
  - any other id targets an imported or authored wallpaper in `wallpapers/`
- Wallpapers now support three sources:
  - theme asset wallpapers from `theme.assets.backgroundUrl`
  - imported media wallpapers in `wallpapers/` (`png`, `jpg`, `gif`, `webp`, `svg`, `mp4`, `webm`, etc.)
  - authored live wallpaper runtime modules in `wallpapers/` (`ts`, `tsx`, `js`, `jsx`)
- The shell now resolves two appearance lanes from the same theme catalog:
  - `settings.terminal.windowMode === 'windowed'` selects the app lane
  - `settings.terminal.windowMode === 'overlay'` selects the dock lane
  - `settings.appearance.dockThemeMode === 'follow-app'` reuses the active app theme as the dock base theme, then merges any optional `theme.dock.workbench` / `theme.dock.explorer` recipe overrides
  - `settings.appearance.dockThemeMode === 'override'` resolves the dock lane from `settings.appearance.activeDockThemeId`, with safe fallback to the active app theme when the dock override id is missing or invalid
  - `src/config/appearance.ts` returns both `app` and `dock` channels and exposes the currently active channel based on `windowMode`
- Theme selection now has an explicit normalization path in `src/store/settingsStore.ts`:
  - `applyThemeSelection()` is the correct path for app-theme switches
  - `applyDockThemeSelection()` is the correct path for dock override switches
  - built-in app-theme switches can reset theme-managed appearance overrides plus explorer/layout presentation state, but they intentionally preserve navigation truth like current path, history, and search
  - raw `updateAppearance({ activeThemeId })` should not be used for normal built-in theme switching because it skips that normalization contract
- Theme packages can now declare dock-specific recipe overlays under `theme.dock`:
  - `theme.dock.workbench` tunes dock-shell chrome without changing the application shell recipe
  - `theme.dock.explorer` tunes dock explorer chrome, metrics, and layout defaults without forking explorer domain behavior
  - `src/config/themePackages.ts` exposes dock capability metadata so Settings can label dock-aware themes
- Active explorer shell controls now belong to the explorer toolbar / omnibox row instead of the shared command-center top bar:
  - sources visibility
  - focus search
  - experimental mode
  - explorer mode picker
  - explorer view mode
  - preview toggle
- Explorer chrome composition is now a distinct layer from explorer pane composition:
  - `src/config/explorerShellLayouts.ts` still owns pane structure like rail visibility, preview side, and live session sizing behavior
  - `src/config/explorerModeProfiles.ts` owns the curated user-facing explorer modes (`balanced`, `navigator`, `focus`, `inspector`) and maps them onto pane-layout ids plus chrome-layout ids
  - `src/config/explorerChromeLayouts.ts` owns topbar/toolbar/workspace-header/rail-header/preview-header/status-strip control zones, order, and per-layout adaptive placement
  - `settingsStore.ts` persists per-theme `modeProfileOverridesByThemeId`, keyed by theme id, so users can retune a theme's default explorer mode without mutating live explorer session state
  - `settingsStore.ts` persists per-theme `chromeLayoutOverridesByThemeId`, keyed by theme id and `chromeLayoutId`
  - `FileExplorer.tsx`, `ExplorerWorkspace.tsx`, `ExplorerSideRail.tsx`, and the preview panel should render resolved chrome surfaces instead of hardcoded button sequences
  - zone-based chrome edit mode moves controls across those surfaces by rewriting override snapshots; it is not a free-pixel docking system
- `settings.system.developerMode` is now the live-reload gate for expensive development-only watchers:
  - plugin directory watch / fallback polling in `useFolderPluginRuntime.ts`
  - authored shader polling in `App.tsx`
  - authored animation polling in `App.tsx`
  - explorer entry-size root watching in `FileExplorer.tsx`
- `App.tsx` now also renders a fixed `DevPerformanceHud` in local development so frame and browser telemetry stay visible without a manual diagnostics toggle.
- Managed content roots now split by runtime mode:
  - `tauri dev` keeps repo-relative `plugins/`, `themes/`, `shaders/`, `animations/`, `wallpapers/`, and `notes/` so authoring stays in the workspace
  - installed/release builds resolve those directories under Tauri `AppLocalData` instead of creating top-level `$HOME/plugins`, `$HOME/themes`, `$HOME/shaders`, `$HOME/animations`, `$HOME/wallpapers`, `$HOME/notes`, or `$HOME/Screenshots`
  - `src/config/appContentDirectories.ts` owns that bootstrap and the legacy-home-path detection/migration rules
  - release migrations now also carry old `co.overlayterm.app` app-local directories forward into `co.greeblefs.app`
  - layout auto-probe now prefers `~/.greeblefs/greeblefs.layouts.{json,toml}` before older `.greeble` / `.overlayterm` fallbacks
- Production/default behavior is manual refresh:
  - Plugins panel `Refresh`
  - Settings `Refresh Shaders`
  - Settings `Refresh Animations`
- Layout profiles still shape the shell through `shellBlueprint`, `chrome`, `controlDock`, `interaction`, and optional pinned panels. They do not define a separate content-browser drawer contract.
- `FileExplorer.tsx` consumes the resolved explorer recipe and applies it to:
  - shell chrome
  - rail placement
  - toolbar treatment
  - entry hover/selection behavior
  - grid/list/table metrics
  - adaptive semantic density metrics
  - preview panel chrome
  - status bar visibility/treatment
- `FileExplorer.tsx` also layers user-controlled explorer session state on top of the theme recipe:
  - persisted inline preview enable/disable
  - persisted path/history/search/layout/preview/source-panel state
  - legacy `session.shellLayoutId` remains the pane-layout compatibility fallback for older sessions
  - active explorer mode now resolves through theme default -> per-theme mode override -> legacy `session.shellLayoutId` -> built-in `balanced`
  - mode profiles can hide the rail or move the preview pane without requiring a theme swap, while live widths and source visibility remain session-owned
- Dock mode is now a distinct presentation subsystem over the same explorer/runtime truth layer:
  - `App.tsx` still forces the explorer forward when entering overlay mode, but now passes `explorerLayoutMode: 'dock'`
  - dock mode keeps the same explorer sessions, filesystem data plane, tabs, and workspace state as app mode
  - dock mode can diverge in workbench recipe, explorer recipe, metrics, and chrome layout without becoming a separate filesystem subsystem
  - the dock layout contract keeps inline preview closed so the overlay reads like a focused content browser instead of a zoomed-out app shell
  - `src/config/layoutProfiles.ts` still normalizes legacy persisted `compact-dock` layout values to `dock` for compatibility
- Linux Wayland dock mode now has a dedicated native host path instead of pretending a normal top-level window can behave like a panel:
  - `src-tauri/src/wayland_dock.rs` owns the separate `dock` webview host and applies `gtk-layer-shell` configuration for anchored panel behavior
  - `src-tauri/src/window_commands.rs` exposes the Wayland dock host status plus a dock-layout command so the frontend can switch between the normal app window path and the layer-shell dock path
  - `src/runtime/windowHost.ts` is the frontend routing contract for `main` vs `dock`, host-targeted events, and the global-shortcut ownership rule
  - `App.tsx` now decides which host owns the active presentation and forwards `Ctrl+Space` / mode-switch requests across windows instead of trying to show both modes from the same native window on Wayland
  - `src/store/settingsStore.ts` and `src/store/explorerStore.ts` rehydrate persisted state on `storage` events so the hidden host stays in sync with the active host during mode handoff
- `src/store/explorerStore.ts` supports named explorer sessions, and the dock now reuses those sessions through its own appearance/layout lane rather than through a separate drawer subsystem.
- The explorer now has a local workspace shell separate from the global workbench tabs:
  - `ExplorerWorkspace.tsx` owns explorer tabs and slot-based `single` / `split` / `quad` rendering
  - each tab maps to a distinct `ExplorerInstanceId`, so the existing `FileExplorer` session model still owns path/history/search/preview state
  - `explorerStore.ts` persists the workspace snapshot (`tabs`, pane activity, layout mode, focused pane, column split ratio, row split ratio) alongside the underlying named sessions
  - workspace normalization is collapse-safe: when the UI drops from `quad` to `split` or `single`, tabs from hidden panes are reassigned into visible panes instead of being stranded in invisible left/right slots
  - commander-style cross-pane actions are an explicit bridge, not header-owned filesystem logic: `FileExplorer.tsx` publishes live pane path/selection snapshots upward, and `ExplorerWorkspace.tsx` sends navigation / refresh / selection-transfer requests back down into the active explorer instance
- `FileExplorer.tsx` shares directory/search result caches across explorer sessions so alternate surfaces do not duplicate backend reads unless a mutation invalidates the cache.
- `FileExplorer.tsx` now settle-batches viewport enrichment work so visible-entry size measurement and native-icon resolution only launch after a short scroll idle window instead of hammering Tauri on every transient virtualized viewport shift.
- `FileExplorer.tsx` owns both file-centric actions and explorer-local shell controls, so the shared top bar stays panel-agnostic while the explorer keeps its mode/source/preview controls adjacent to the path/search field.
- `FileExplorer.tsx` had a dev-only infinite update loop risk in the virtualized entry-size and native-icon batching effects because in-flight `Set` state was being cleared/re-added on every render. Those effects now leave in-flight batches intact until async completion.
- Explorer Pro metadata and long-running utilities now route through Rust instead of TS-only persistence:
  - `src-tauri/src/explorer_pro_commands.rs` owns app-managed trash + undo, batch rename, duplicate-scan lifecycle, tags, and saved searches
  - `src-tauri/src/fs_commands.rs` now also owns the durable explorer task registry used by copy/move/delete jobs plus the retry/cancel/history command surface exposed through Specta
  - local transfer UX now has a two-step contract instead of silent collision auto-rename:
    - `fs_plan_transfer_items` reports pending name collisions before paste/drag/pane transfers run
    - `fs_transfer_items` accepts explicit collision policies: `keep_both`, `replace`, and `skip`
    - transfer results now report both the collision policy used and whether a source was actually transferred or skipped
  - `src/runtime/explorerBackend.ts` is the only TS entry point for explorer task list/retry/cancel/clear operations; React surfaces should not call raw `invoke(...)` for task actions
  - `src/components/explorer/ExplorerTaskStatusBadge.tsx` is now an explorer-local Task Center popover instead of a transient badge-only indicator, and it is intentionally scoped to the explorer chrome rather than a global shell panel
  - `src/components/explorer/ExplorerTaskCenterContent.tsx` is the shared Task Center renderer used by both the inline explorer popover and the dedicated file-operations popout window
  - `src/runtime/fileOperationsWindow.ts` plus `src/windows/FileOperationsWindowApp.tsx` are now the shell-owned copy/move popout path:
    - `FileExplorer.tsx` can issue explicit `Copy To...` / `Move To...` requests into the popout
    - successful transfers publish completion events so other explorer instances can refresh source and target folders without inventing a second transfer backend
    - the popout is destination-picking and task-visibility UI only; transfer truth still stays in Rust plus `src/runtime/explorerBackend.ts`
  - tags and saved searches live under Tauri app-local explorer metadata
  - trash currently uses a GreebleFS-managed trash root so restore locations stay deterministic across platforms
- Explorer drag behavior now defaults to native file export while keeping internal drop metadata available:
  - plain explorer drag starts the native drag bridge and still publishes `application/x-overlayterm-paths` for in-app drops
  - `Shift` forces an internal-only explorer drag
  - breadcrumb chips now accept internal drop targets, so operators can move/copy directly onto ancestor folders without navigating first
  - native drag previews use the dragged item's native icon when available, with a generated file-shaped fallback instead of the app icon
- `ExplorerSideRail.tsx` is now navigator-first instead of bookmark-authoring-first:
  - the rail header foregrounds the current location and pinned-count summary
  - the `Drives` section now doubles as a lazy local folder tree, with drive-root expansion and nested folder navigation backed by the same cached directory listings used by the main explorer
  - bookmark search is always available
  - bookmark structure editing, category authoring, recolor, rename, and delete controls only appear in `Manage` mode
  - this keeps the default rail lighter in dock mode without removing the deeper bookmark tooling
- Overlay monitor placement is now resolved from the current or last-active monitor instead of always using the primary monitor, and `computeOverlayWindowLayout()` now left-anchors the overlay on X instead of centering it.
- Overlay/dock mode now treats position as edge-owned state:
  - `src/config/overlayWindow.ts` exposes `computeAnchoredOverlayWindowLayout()` so current overlay bounds can preserve size without preserving stale X/Y drift
  - `src/App.tsx` re-applies dock geometry after show on Linux so WMs that recenter undecorated windows cannot leave the dock floating in the middle of the screen
  - resize/move listeners in overlay mode now snap back to the dock edge instead of accepting free-floating coordinates as the persisted dock position
- The explorer now ships three experimental folder-view runtimes behind the Labs control:
  - `adaptive-semantic-grid`
  - `constellation`
  - `timeline-surface`
- `src/config/explorerExperimentalModes.ts` owns the shared metadata for those modes, including whether a mode is shipped and the meaning of the shared density/granularity control for each runtime.
- `FileExplorer.tsx` keeps the control plane shared across those experimental runtimes:
  - one persisted `experimentalViewMode`
  - one persisted `experimentalDensity`
  - Ctrl/Cmd + wheel and the layout hotkey now route into the active experimental runtime instead of only the adaptive grid
- `App.tsx`, `CommandPalette.tsx`, `TerminalOverlay.tsx`, and `SettingsPage.tsx` now consume the resolved workbench recipe and apply it to shared command-center chrome.

## Important Folders

- `src/components/`
  UI components and explorer runtime surfaces.
- `src/config/`
  Theme, explorer, layout, wallpaper, shader, animation, plugin, and runtime configuration.
- `src/runtime/`
  Tauri/backend bridge helpers.
- `src/store/`
  Persisted settings, explorer state, terminal state, and task state.
- `themes/`
  Theme packages discovered at runtime.
- `animations/`
  Authored animation modules.
- `wallpapers/`
  Imported wallpaper media and authored live wallpaper modules.
- `notes/`
  Managed notes/todos/bugs/prompts content root in development. Release builds move the same root under Tauri `AppLocalData`.
- `shaders/`
  Authored shader modules.
- `src-tauri/`
  Native host and Rust-side integration.
  `src-tauri/src/cloud_commands.rs` is the cloud-drive truth layer for provider credential resolution, OAuth callback handling, account metadata persistence, keychain refresh-token storage, and cloud-backed explorer file operations.
  `src-tauri/src/explorer_pro_commands.rs` is the explorer-pro feature backend for trash/undo, batch rename, duplicate scans, tags, and saved searches.
  `src-tauri/src/screenshot_commands.rs` is the screenshot truth layer for monitor capture, cached full-resolution images, native clipboard work, gallery thumbnails, and annotated export compositing.

## Validation Commands

- `npx vitest run --environment node src/test/workbenchTheme.test.ts src/test/explorerTheme.test.ts src/test/themePackageExplorerRecipe.test.ts`
- `npx tsc --noEmit --skipLibCheck --jsx react-jsx --module esnext --target es2022 --moduleResolution bundler --allowSyntheticDefaultImports --types vitest/globals,@testing-library/jest-dom src/vite-env.d.ts src/config/workbenchTheme.ts src/config/explorerTheme.ts src/config/appearance.ts src/components/CommandPalette.tsx src/components/TerminalOverlay.tsx src/components/SettingsPage.tsx src/components/explorer/ExplorerSideRail.tsx src/components/FileExplorer.tsx src/App.tsx src/test/workbenchTheme.test.ts src/test/explorerTheme.test.ts src/test/themePackageExplorerRecipe.test.ts src/test/themePackages.test.ts src/test/explorerSideRail.test.tsx`
- `bun run test:unit`
- `bun run test:browser`
- `bun run build`
- `bash ./install.sh`
- `bash ./install.sh --launch`
- `bun run release:linux:install`

## Common Errors / Lessons Learned

- Cloud provider credentials now have two sources:
  - saved from `Settings > Cloud Accounts`, which stores the provider client ID in app-local data and the optional client secret in the OS keychain
  - runtime environment variables (`GREEBLE_GOOGLE_DRIVE_CLIENT_ID`, `GREEBLE_GOOGLE_DRIVE_CLIENT_SECRET`, `GREEBLE_DROPBOX_CLIENT_ID`, `GREEBLE_DROPBOX_CLIENT_SECRET`)
  Saved Settings credentials take precedence over env vars until they are cleared.
- Dropbox OAuth no longer uses a random localhost callback. The app now expects the Dropbox app console to allow the fixed redirect URI `http://localhost:53682/callback`; if Dropbox sign-in times out, check that exact callback registration before touching the browser-launch code.
- Repo-wide `npx tsc --noEmit` is currently red on several pre-existing generated-contract and test typing issues unrelated to the workbench/explorer theme system. The narrowed command above now only leaves `src/runtime/useFolderPluginRuntime.ts` as an unrelated pre-existing failure.
- A current narrowed file-operations/explorer typecheck also still trips an unrelated screenshot typing issue in `src/components/ScreenshotsManager.tsx`: `SelectionHandle` includes `"move"` but the resize-handle consumer only accepts edge handles. Treat that as pre-existing unless the task is on screenshot selection editing.
- Built-in theme switches should go through `settingsStore.applyThemeSelection()` or the Settings theme catalog flow, not a direct `updateAppearance({ activeThemeId })` call. The direct path now skips pilot baseline resets for dock mode, layout profile, explorer presentation, wallpaper/shader overrides, and related default-shell behavior.
- JSDOM-backed Vitest runs currently fail in this workspace because `html-encoding-sniffer` requires an ESM dependency through a CommonJS path. Node-environment tests still work, so keep pure logic/package-loader tests runnable there until the dependency issue is fixed.
- `bun run test:browser` currently launches a headed Playwright Chromium session in this workspace. Without an X server it fails before any tests run; use `xvfb-run` or a headless browser config if you need browser validation locally.
- `plugins/**/dist/**` is versioned source for packaged frontend plugins in this repo. Do not treat those directories like app-build output or let a blanket `dist/` ignore swallow shipped plugin entries.
- Packaged frontend plugins are no longer single-file only. `src/components/pluginRuntime.tsx` now executes a package-local module graph, so plugin entries may import sibling helpers with relative paths, but those imports must remain inside the plugin root and still cannot pull arbitrary npm dependencies.
- Explorer context-menu plugin contributions can now open plugin panels through `panel-request` execution. If a plugin needs a folder/file handoff from Explorer, use `src/runtime/pluginPanelRequests.ts` and the `overlayterm-plugin` helpers instead of inventing ad hoc window events or local-storage keys.
- The dev HUD is internal to this app. It is not a Tauri plugin or external Chrome overlay, and it should be treated as part of the shell runtime.
- Do not wire the screenshot panel to `explorerTaskStore`. That store is global explorer/Yazi task state; rendering it inside screenshot status chrome leaks unrelated delete/copy jobs into screenshot errors and makes debugging cross-subsystem issues much harder.
- Annotated screenshot export belongs in Rust now, not in the browser canvas path. The frontend should author selection/annotation intent, while `src-tauri/src/screenshot_commands.rs` composites those annotations onto the cached full-resolution capture and handles save/copy. Reintroducing browser-side annotated save logic will silently degrade output resolution again.
- Non-Windows screenshot preview capture now briefly hides/restores the app window to avoid self-capture. If Linux/macOS preview behavior regresses, inspect that hide/show path before assuming the capture backend itself is wrong.
- Explorer interaction tests that need DOM drag/drop still need a browser-like environment, so the current JSDOM dependency failure blocks the most relevant explorer UI regressions even when the narrowed TypeScript pass is green.
- Packaged theme SVG previews and wallpapers are safest when inlined to data URLs before they reach the frontend. In this workspace, Tauri/WebKit can intermittently fail on filesystem-backed SVG theme assets and spam `Failed to load resource` errors if they stay on raw asset URLs.
- Theme renderer motion should prefer CSS animation for decorative effects. Renderer-local React state that ticks every frame can force mounted heavy panels like `FileExplorer` through avoidable rerender pressure and can resurrect update-depth problems.
- The local Linux installer now avoids the old Node/Tauri wrapper path. `install.sh` and `scripts/build-and-install-linux-local-release.sh` build with Bun + Cargo directly, then install into `~/.local/opt/greeblefs`.
- Do not keep `build.devUrl` in the base `src-tauri/tauri.conf.json` for release-capable paths. In this workspace, a direct `cargo build --release` will otherwise compile a binary that keeps trying to boot from `http://localhost:1420`. `scripts/run-platform-tauri.mjs` now injects `devUrl` only for the `tauri dev` command.
- This repo is a Cargo workspace, so release binaries land under the workspace-level `target/` directory, not `src-tauri/target/`. Linux install scripts should resolve `cargo metadata` `target_directory` before copying binaries, or they can silently reinstall a stale executable from an old path or from the wrong binary name.
- The local Linux installer now also seeds the managed content directories into `~/.local/share/co.greeblefs.app/{plugins,themes,shaders,animations}` so the installed release has writable runtime content without polluting the top level of `$HOME`.
- Vite still prints a Node 18 warning during builds, but `bunx vite build` succeeds in this workspace and the installer completes successfully on that host setup.
- The explorer component is large and performance-sensitive. Route new chrome/metric changes through `src/config/explorerTheme.ts` instead of scattering new magic numbers through `FileExplorer.tsx`.
- Avoid mixing CSS border shorthands with border longhands in the same React style object on explorer rows and chrome surfaces. The dock/layout tests hit real `cssstyle` failures when `borderBottom` and `borderColor` were mounted together, and the longhand form is safer for theme-driven overrides anyway.
- Explorer directory/search caches are intentionally shared at the module level across explorer mounts. Tests or one-off diagnostics harnesses that need isolated backend behavior should call the exported `invalidateExplorerResultCaches()` helper before rendering.
- The side rail local folder tree must use the shared explorer directory cache in `src/components/explorer/explorerDirectoryCache.ts` rather than calling `fs_list_dir` blindly from component-local state. Otherwise the rail and the main explorer will drift on refresh and remount behavior.
- Explorer async directory/search work needs both mount cleanup and request invalidation. Overlay-mode panel swaps and `React.StrictMode` remounts can otherwise let stale `navigate()` / `refresh()` completions write into a dead or superseded explorer instance, which shows up as `getRootForUpdatedFiber` runtime errors or visible listing flicker.
- If the Linux/native overlay appears on the wrong display, inspect the monitor-resolution path in `App.tsx` before touching Rust window flags. The frontend now owns monitor selection and overlay geometry; `windowApplyMode` should only apply the chosen presentation atomically.
- If Linux dock mode starts floating in the middle of the screen again, check the post-show re-dock path in `App.tsx` and confirm overlay move/resize listeners are not re-persisting raw X/Y coordinates into `runtimeOverlayBoundsRef`.
- On Linux, do not let `window_apply_mode` abort geometry just because a WM rejects `set_shadow`, `set_skip_taskbar`, or another presentation-only flag. The TS call sites should unwrap the returned Tauri `Result`, and the Rust command should log best-effort flag failures while still applying size/position.
- Explorer task state is now durable and snapshot-backed. Task UIs should hydrate from `fs_list_explorer_tasks` through `src/runtime/explorerBackend.ts` and then merge live `explorerTaskProgressEvent` updates; do not rebuild task truth from component-local event listeners or assume the event stream alone is sufficient after remount/startup.
- Screenshot capture uses physical monitor geometry end-to-end for preview selection and crop/save math. Tauri `Monitor.size` / `Monitor.position` are physical pixels, while the Rust preview path should capture the full monitor image and the crop/save path should stay on the cached physical-pixel image. Keep logical scaling for human-readable labels only.
- Screenshot preview images should stay on stable data URLs or equally stable sources. Avoid converting them to blob URLs and revoking them inside a React state updater, because `React.StrictMode` can replay that updater and revoke the fresh preview before the browser finishes loading it.
- `bun run tauri dev` uses the generated runtime Tauri config from `scripts/run-platform-tauri.mjs`, which points Tauri at the Vite `devUrl`. TS/React edits hot-reload through Vite during that session, but binding generation and startup prep scripts only rerun when the Tauri dev process starts.
- Linux NVIDIA/WebKitGTK launch stability now has a native pre-Tauri guard in `src-tauri/src/linux_graphics.rs`:
  - it runs before `tauri::Builder::default()` so both dev and installed binaries inherit the workaround
  - when the active Linux backend resolves to Wayland on an NVIDIA system, it sets `__NV_DISABLE_EXPLICIT_SYNC=1`
  - when the active Linux backend resolves to X11 on an NVIDIA system, it sets `WEBKIT_DISABLE_DMABUF_RENDERER=1`
  - explicit user-provided values for those environment variables are respected
  - if Linux launch regresses with `libEGL`, `driver (null)`, `failed to create dri2 screen`, blank WebKit surfaces, or Wayland protocol errors on NVIDIA, inspect that helper before changing shell/UI code
- Wayland overlay handling is now compositor-preserving instead of backend-forcing:
  - `window_get_linux_display_server()` exposes whether the Linux session is running on Wayland or X11
  - overlay `Ctrl+Space` reopen on Wayland now avoids reapplying dock geometry during the hidden-to-visible transition so manual compositor snaps can survive hide/show
  - `isFreefloatingRef` is now set on real overlay move/resize events so reopened overlay sessions can reuse the last compositor-managed bounds instead of recomputing from a fresh dock anchor every time
- Do not try to fix Wayland dock centering by adding more `set_position` / `set_outer_position` retries to the normal app window path. The durable fix is the separate layer-shell dock host in `src-tauri/src/wayland_dock.rs`; if dock mode recenters again, inspect host routing in `src/runtime/windowHost.ts` and `App.tsx` before touching generic window geometry.
- `cargo run --manifest-path src-tauri/Cargo.toml --bin export-bindings` is green again. Keep `src/generated/tauri.ts` generated-only and route any new explorer task commands through `src/runtime/explorerBackend.ts` instead of introducing ad hoc `invoke` calls in React.
- Built-in shader performance is now split by runtime type:
  - the CSS-heavy built-ins no longer use a React RAF clock; they animate through injected keyframes so shader motion does not force React rerenders every frame
  - canvas-backed shader surfaces are throttled to about 24 FPS and capped to `devicePixelRatio <= 1.25`
  - if overlay performance still feels bad after this pass, inspect shell `backdrop-filter` blur and wallpaper/shader/animation layer stacking before adding more shader complexity
- Explorer smoothness now favors cheaper composition over JS-driven motion:
  - `FileExplorer.tsx` no longer uses Framer Motion in the main explorer path for grid/icon/layout transitions
  - size changes now rely on CSS transitions or immediate layout so directory navigation and zooming avoid extra layout animation work
- `settings.appearance.appBlur` is now the real shell-wide blur kill switch:
  - it still controls the outer shell blur in `App.tsx`
  - it now also disables top bar/menu blur, command palette blur, terminal blur, settings blur, and explorer-local blur surfaces
  - `src/config/performanceTelemetry.ts` now treats `overlay_frame_time` as an `8.3ms` p95 target so telemetry aligns with a 120 Hz goal instead of a 60 Hz goal
- Theme package manifests can now carry app-wide shell structure via `theme.workbench` and explorer-specific structure via `theme.explorer`; prefer those over ad hoc `cssVars` whenever a behavior or metric deserves a named contract.
- If a theme needs a default wallpaper, put the asset in `theme.assets.backgroundUrl`. Reserve `theme.effects.backgroundImage` for overlay gradients/effects so theme wallpaper assets and shader layers can stack cleanly instead of duplicating the same image twice.
- If a custom theme renderer owns a launcher, chrome band, content frame, or wallpaper treatment, declare it through `surfaceOwnership`. Do not rely on `host.renderChromeBar()` to magically cooperate with a fully custom launcher layout.
