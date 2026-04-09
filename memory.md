# GreebleFS Memory

## 2026-04-08 — Workbench + Explorer Theme Recipe System

- Added a first-class app-wide theming layer under `theme.workbench`.
- Added a first-class explorer theming layer under `theme.explorer`.
- New resolvers live in:
  - `src/config/workbenchTheme.ts`
  - `src/config/explorerTheme.ts`
- The workbench recipe supports shell presets (`workbench`, `xmb`, `channel-grid`) plus overrides for top bar chrome, command palette chrome, terminal shell chrome, settings shell chrome, tabs, metrics, surfaces, typography, and raw workbench CSS vars.
- The explorer recipe supports shell presets (`workbench`, `xmb`, `channel-grid`) plus overrides for chrome, preview, status bar, breadcrumb style, rail position, view-mode preference, metrics, surfaces, typography, and raw explorer-only CSS vars.
- `src/config/appearance.ts` now preserves and inherits both `theme.workbench` and `theme.explorer` data through normal theme normalization, so built-ins, custom imports, and package themes all use the same merge path.
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
