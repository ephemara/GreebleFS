# GreebleFS Architecture

## Purpose

GreebleFS is a Tauri desktop workbench centered on a highly themeable file explorer, terminal overlay, plugins, shaders, animations, screenshots, and settings-driven shell customization.

## Stack

- Frontend: React 19 + TypeScript + Vite
- State: Zustand
- Desktop host: Tauri 2 + Rust
- Visual system: CSS variables, theme packages, icon themes, shaders, animations
- Tests: Vitest unit/browser, Rust tests

## Main Entry Points

- `src/main.tsx`
  Frontend bootstrap.
- `src/App.tsx`
  Overlay window shell, theme/runtime discovery, panel orchestration.
- `src/panels/panelRegistry.tsx`
  Built-in panel registration and prop wiring.
- `src/components/FileExplorer.tsx`
  Main explorer shell, navigation, preview, standard layout modes, experimental explorer runtimes, and the compact dock presentation used when the app switches into overlay mode.
- `src/components/explorer/ExplorerSideRail.tsx`
  Explorer rail, bookmarks, drives, and bookmark authoring.
- `src/config/appearance.ts`
  Core overlay theme model and resolved CSS variables.
- `src/config/workbenchTheme.ts`
  App-wide workbench recipe resolution and workbench-scoped CSS variable contract.
- `src/config/explorerTheme.ts`
  Explorer-specific theme recipe resolution, metrics scaling, and explorer-scoped CSS variable contract.
- `src/config/explorerShellLayouts.ts`
  User-selectable explorer pane-layout presets that rebalance the rail and preview pane independently from theme recipes.
- `src/config/themeEngineBindings.ts`
  Shared engine-manifest binding helpers for layout/navigation/render-driven recipe defaults.
- `src/config/workbenchRenderRuntime.ts`
  Resolves the active workbench interaction runtime from the theme engine manifest and layout profile.
- `src/config/layoutProfiles.ts`
  Built-in and external layout manifest normalization for shell blueprints, pinned panels, control docks, and top/bottom chrome behavior.
- `src/config/themePackages.ts`
  Theme package discovery and manifest loading from `themes/`.
- `src/components/WorkbenchNavigationSurface.tsx`
  Runtime-swappable launcher surface for cross-axis, channel-grid, desktop, and tabbed shells.
- `src/store/explorerStore.ts`
  Persisted explorer rail plus named explorer session snapshots.
- `src/store/settingsStore.ts`
  Persisted layout/profile settings, the native `windowMode` presentation toggle, and machine-level developer-mode behavior.

## Theme / Workbench Architecture

- Overlay themes still own the global palette, effects, fonts, icon theme, visuals, and shader/motion defaults.
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
- The shell is a hybrid presentation system again:
  - `settings.terminal.windowMode === 'windowed'` is the larger application shell
  - `settings.terminal.windowMode === 'overlay'` is the compact dock shell
  - `App.tsx` forces the explorer forward when entering overlay mode and passes `explorerLayoutMode: 'compact-dock'` into the explorer panel wiring
- Active explorer shell controls now belong to the command-center top bar instead of the explorer toolbar:
  - sources visibility
  - focus search
  - experimental mode
  - shell layout preset
  - explorer view mode
  - preview toggle
- `settings.system.developerMode` is now the live-reload gate for expensive development-only watchers:
  - plugin directory watch / fallback polling in `useFolderPluginRuntime.ts`
  - authored shader polling in `App.tsx`
  - authored animation polling in `App.tsx`
  - explorer entry-size root watching in `FileExplorer.tsx`
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
  - persisted shell layout presets (`balanced`, `navigator`, `focus`, `inspector`)
  - persisted path/history/search/layout/preview/source-panel state
  - shell presets can hide the rail or move the preview pane without requiring a theme swap
- `src/store/explorerStore.ts` supports named explorer sessions, but the shipping dock behavior is the same explorer surface rendered in compact mode rather than a separate drawer/dock subsystem.
- `FileExplorer.tsx` shares directory/search result caches across explorer sessions so alternate surfaces do not duplicate backend reads unless a mutation invalidates the cache.
- `FileExplorer.tsx` still owns file-centric actions like search scope, refresh, and create file/folder, but embedded shell-level layout toggles are suppressed when the explorer is hosted inside the command center.
- `FileExplorer.tsx` had a dev-only infinite update loop risk in the virtualized entry-size and native-icon batching effects because in-flight `Set` state was being cleared/re-added on every render. Those effects now leave in-flight batches intact until async completion.
- Overlay monitor placement is now resolved from the current or last-active monitor instead of always using the primary monitor, and `computeOverlayWindowLayout()` now left-anchors the overlay on X instead of centering it.
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
  Theme, explorer, layout, shader, animation, plugin, and runtime configuration.
- `src/runtime/`
  Tauri/backend bridge helpers.
- `src/store/`
  Persisted settings, explorer state, terminal state, and task state.
- `themes/`
  Theme packages discovered at runtime.
- `animations/`
  Authored animation modules.
- `shaders/`
  Authored shader modules.
- `src-tauri/`
  Native host and Rust-side integration.

## Validation Commands

- `npx vitest run --environment node src/test/workbenchTheme.test.ts src/test/explorerTheme.test.ts src/test/themePackageExplorerRecipe.test.ts`
- `npx tsc --noEmit --skipLibCheck --jsx react-jsx --module esnext --target es2022 --moduleResolution bundler --allowSyntheticDefaultImports --types vitest/globals,@testing-library/jest-dom src/vite-env.d.ts src/config/workbenchTheme.ts src/config/explorerTheme.ts src/config/appearance.ts src/components/CommandPalette.tsx src/components/TerminalOverlay.tsx src/components/SettingsPage.tsx src/components/explorer/ExplorerSideRail.tsx src/components/FileExplorer.tsx src/App.tsx src/test/workbenchTheme.test.ts src/test/explorerTheme.test.ts src/test/themePackageExplorerRecipe.test.ts src/test/themePackages.test.ts src/test/explorerSideRail.test.tsx`
- `bun run test:unit`
- `bun run test:browser`
- `bun run build`

## Common Errors / Lessons Learned

- Repo-wide `npx tsc --noEmit` is currently red on several pre-existing generated-contract and test typing issues unrelated to the workbench/explorer theme system. The narrowed command above now only leaves `src/runtime/useFolderPluginRuntime.ts` as an unrelated pre-existing failure.
- JSDOM-backed Vitest runs currently fail in this workspace because `html-encoding-sniffer` requires an ESM dependency through a CommonJS path. Node-environment tests still work, so keep pure logic/package-loader tests runnable there until the dependency issue is fixed.
- `bun run build` and the Linux release wrapper currently assume a newer Node runtime than the machine provides. On Node 18 hosts, run `bun scripts/sync-canonical-icons.mjs`, `cargo run --manifest-path src-tauri/Cargo.toml --bin export-bindings`, `bunx vite build`, and `cargo build --manifest-path src-tauri/Cargo.toml --release`, then install the produced binary manually until Node is upgraded.
- The explorer component is large and performance-sensitive. Route new chrome/metric changes through `src/config/explorerTheme.ts` instead of scattering new magic numbers through `FileExplorer.tsx`.
- If the Linux/native overlay appears on the wrong display, inspect the monitor-resolution path in `App.tsx` before touching Rust window flags. The frontend now owns monitor selection and overlay geometry; `windowApplyMode` should only apply the chosen presentation atomically.
- Theme package manifests can now carry app-wide shell structure via `theme.workbench` and explorer-specific structure via `theme.explorer`; prefer those over ad hoc `cssVars` whenever a behavior or metric deserves a named contract.
