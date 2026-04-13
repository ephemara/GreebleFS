# GreebleFS Memory

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
  - `overlay` passes `explorerLayoutMode: 'compact-dock'`
  - entering dock mode forces the explorer panel forward so the compact shell behaves like the portable UE-style browser
- Explorer shell controls were lifted back into the command-center top bar:
  - sources visibility
  - focus search
  - experimental mode cycling
  - shell layout cycling
  - view mode cycling
  - preview toggle
- `src/components/FileExplorer.tsx` no longer exposes drawer/dock surface semantics. It now renders as the same explorer surface in either `full` or `compact-dock` mode, and embedded shell-layout/view/preview controls are suppressed when the command center owns them in the top bar.
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
  - compact explorer rendering in dock mode
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
