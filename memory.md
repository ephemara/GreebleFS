# GreebleFS Memory

## 2026-04-09 — UE Content Browser Dock Overhaul

- Reframed the UE-style content browser as a first-class layout contract instead of a side effect of pinned explorer panels or native overlay window mode.
- `src/config/layoutProfiles.ts` now exposes `contentBrowserDock` on `LayoutProfile` with:
  - `mode: 'drawer-and-tab'`
  - `defaultPlacement`
  - `defaultPresentation`
  - `defaultOpen`
  - `drawerSize`
  - `dockSize`
- Legacy external layout manifests that still use a pinned explorer with `mode: 'compact-dock'` now normalize into the new dock contract and drop the old pinned explorer entry so the browser does not render twice.
- Added built-in profile `ue-content-browser`:
  - bottom dock by default
  - persistent dock open on launch
  - main tabbed workbench defaults to `terminal` instead of duplicating the explorer as a tab
- `src/store/settingsStore.ts` now persists per-profile content-browser dock state in `settings.layout.contentBrowserDockByProfile`.
- `src/store/explorerStore.ts` now persists explorer sessions by stable instance id instead of one global snapshot:
  - `primary`
  - `content-browser-drawer`
  - `content-browser-dock`
- Explorer sessions now persist `sourcesVisible` per instance in addition to path/history/search/layout/preview state.
- `src/components/FileExplorer.tsx` now:
  - seeds from an explicit explorer instance id
  - supports `surfaceKind: 'workspace' | 'drawer' | 'dock'`
  - syncs drawer/dock source-panel visibility from the per-instance store
  - shares directory/search result caches across explorer instances
  - invalidates those caches on create/rename/delete/move/write mutations
- Added `src/components/WorkbenchContentBrowserDock.tsx` as the dedicated shell dock surface. It:
  - renders either the temporary drawer or the persistent dock
  - keeps hidden surfaces unmounted so previews/model loads do not continue in the background
  - exposes explicit shell actions for dock/undock/close/toggle-sources/focus-search
- `src/App.tsx` now routes explorer activation into the new content-browser controller when a layout profile declares `contentBrowserDock`, instead of opening the explorer as a normal tab.
- Added focused App-level RTL coverage in `src/test/app.contentBrowserDock.test.tsx` for:
  - UE profile persistent-dock behavior
  - first drawer-to-dock promotion copying drawer session state into the dock
  - repeat dock promotion preserving an existing dock session instead of overwriting it
  - windowed/overlay presentation toggles preserving dock-managed explorer state
- Native presentation copy is now `Windowed/Overlay` in the shell/settings/hotkeys so `dock` refers only to the content-browser system.
- Linux/native overlay positioning was corrected on the frontend side:
  - monitor selection now prefers the current or last-active monitor instead of `primaryMonitor()`
  - `computeOverlayWindowLayout()` now edge-anchors the overlay on X instead of centering it
- Focused validation that passed:
  - `bunx vitest run src/test/app.contentBrowserDock.test.tsx src/test/layoutProfiles.test.ts src/test/explorerStore.test.ts src/test/overlayWindow.test.ts src/test/settingsPage.behavior.test.tsx`
  - `bunx vite build`
- Known follow-up risk:
  - the new App coverage is intentionally narrow and mock-heavy; the next hardening pass should add browser-level proof around the real dock surface UI if launcher/menu regressions start slipping past RTL.

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
