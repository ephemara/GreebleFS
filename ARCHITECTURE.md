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
  Main explorer shell, navigation, preview, layout modes, and explorer runtime UI.
- `src/components/explorer/ExplorerSideRail.tsx`
  Explorer rail, bookmarks, drives, and bookmark authoring.
- `src/config/appearance.ts`
  Core overlay theme model and resolved CSS variables.
- `src/config/explorerTheme.ts`
  Explorer-specific theme recipe resolution, metrics scaling, and explorer-scoped CSS variable contract.
- `src/config/themePackages.ts`
  Theme package discovery and manifest loading from `themes/`.

## Theme / Explorer Architecture

- Overlay themes still own the global palette, effects, fonts, icon theme, visuals, and shader/motion defaults.
- Explorer theming is now a first-class recipe layer under `theme.explorer`.
- `theme.explorer` supports structural presets like `workbench`, `xmb`, and `channel-grid`, plus local overrides for:
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
- `FileExplorer.tsx` consumes the resolved explorer recipe and applies it to:
  - shell chrome
  - rail placement
  - toolbar treatment
  - entry hover/selection behavior
  - grid/list/table metrics
  - adaptive semantic density metrics
  - preview panel chrome
  - status bar visibility/treatment

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

- `npx vitest run --environment node src/test/explorerTheme.test.ts src/test/themePackageExplorerRecipe.test.ts`
- `npx tsc --noEmit --skipLibCheck --jsx react-jsx --module esnext --target es2022 --moduleResolution bundler --allowSyntheticDefaultImports --types vitest/globals,@testing-library/jest-dom src/vite-env.d.ts src/config/explorerTheme.ts src/components/explorer/ExplorerSideRail.tsx src/components/FileExplorer.tsx src/test/explorerTheme.test.ts src/test/themePackageExplorerRecipe.test.ts src/test/themePackages.test.ts src/test/explorerSideRail.test.tsx`
- `bun run test:unit`
- `bun run test:browser`
- `bun run build`

## Common Errors / Lessons Learned

- Repo-wide `npx tsc --noEmit` is currently red on several pre-existing generated-contract and test typing issues unrelated to the explorer theme system. Use the targeted typecheck command above for the explorer/theme slice.
- JSDOM-backed Vitest runs currently fail in this workspace because `html-encoding-sniffer` requires an ESM dependency through a CommonJS path. Node-environment tests still work, so keep pure logic/package-loader tests runnable there until the dependency issue is fixed.
- The explorer component is large and performance-sensitive. Route new chrome/metric changes through `src/config/explorerTheme.ts` instead of scattering new magic numbers through `FileExplorer.tsx`.
- Theme package manifests can now carry explorer shell structure via `theme.explorer`; prefer that over ad hoc `cssVars` whenever a behavior or metric deserves a named contract.
