---
name: greeblefs-command-palette
description: Use when changing GreebleFS's global command palette, including the compact launcher UI, quick-scope filters, fuzzy search ranking, recent/pinned command state, or the app-side action assembly that feeds commands, panels, plugins, settings, and indexed file results into the palette.
---

# GreebleFS Command Palette

Use this skill when the task touches the shell-level command palette instead of an explorer-local action menu.

## Core Map

- `src/components/CommandPalette.tsx`
  Owns the modal UI, fuzzy matching, quick filters, compact result rows, shortcut badges, and pin button rendering.
- `src/store/commandPaletteStore.ts`
  Persists pinned action ids, recent action ids, and the last selected quick filter in local storage.
- `src/App.tsx`
  Builds the palette action list, attaches action metadata (`kind`, `badge`, `shortcutLabel`), wraps action execution to record recents, and wires the palette to global search plus shell actions.
- `src/config/workbenchTheme.ts`
  Owns the global command-palette width/top-inset defaults and the preset-derived sizing logic.
- `src/config/pilotThemeContract.ts`
  Keeps the shipped baseline workbench recipe aligned with the compact palette metrics.
- `usr/appearance-packs/andromeda-appearance/tokens/geometry.json`
  Theme-authored geometry override for the Andromeda shell.
- `usr/theme-recipes/andromeda-observatory/workbench.json`
  Theme-authored workbench recipe override for the Andromeda command-palette shell.

## Editing Rules

1. Keep shell-level command truth in `src/App.tsx`; do not bury global palette action assembly inside the component.
2. Keep palette usage state in `src/store/commandPaletteStore.ts`; recent/pinned behavior should not become ad hoc local state inside `App.tsx`.
3. Treat indexed file hits as ephemeral query results. They can render in the palette, but the durable pinned/recent lane is intended for stable commands, panels, and plugin actions.
4. Route size changes through workbench metrics or theme-authored geometry/recipe files before hardcoding local width or top-inset values in JSX.
5. If adding a new action type, extend `OverlayCommandPaletteAction.kind` and the quick-filter matching logic together so counts, filters, and sorting stay coherent.

## Validation

```powershell
cd D:\GreebleFS
bunx vitest run src/test/commandPalette.test.tsx src/test/workbenchTheme.test.ts --reporter=dot
```

For a narrower type sweep on palette-owned files:

```powershell
$tsc = bunx tsc --noEmit --pretty false -p tsconfig.json 2>&1
$tsc | Select-String -Pattern 'CommandPalette\.tsx|commandPaletteStore\.ts|workbenchTheme\.ts|pilotThemeContract\.ts|commandPalette\.test\.tsx'
```

## Known Gotchas

- The repo currently has unrelated broader TypeScript noise, including an older `src/App.tsx` error outside the palette block. Treat the focused palette file sweep plus targeted tests as the reliable proof path unless that broader noise is cleaned up.
- If recent or pinned ids appear to disappear unexpectedly, inspect `persistentCommandPaletteActionIds` in `src/App.tsx`; pruning intentionally excludes ephemeral file-search results.
