# GreebleFS Memory

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
- Added a Linux backend-selection fallback in `src-tauri/src/main.rs`:
  - Wayland sessions with XWayland available now default to `WINIT_UNIX_BACKEND=x11` and `GDK_BACKEND=x11` before Tauri initializes
  - this is controlled by `OVERLAYTERM_LINUX_BACKEND=auto|x11|wayland`
  - the goal is pragmatic: the current Tauri/winit Wayland path cannot honor dock window positioning, so edge-anchored overlay mode needs X11 unless a future layer-shell path is added
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
