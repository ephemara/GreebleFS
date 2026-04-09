# OverlayTerm Theme Packages

Drop theme folders into this directory and OverlayTerm will discover them automatically.

## Folder Shape

```text
themes/
  my-theme/
    theme.json
    icon-theme.json
    assets/
      wallpaper.svg
    shaders/
      ambient-shell.tsx
    animations/
      open-bloom.tsx
    icons/
      folder.svg
      folder_open.svg
      folder_src.svg
      folder_src_open.svg
      txt.svg
      typescript.svg
```

## Manifest

`theme.json` or `theme.toml` is supported.

Top-level fields:

- `id`, `name`, `description`, `author`, `homepage`, `tags`
- `extends`
  - Optional base theme id. Can point at a built-in theme or another package theme.
- `theme`
  - Partial OverlayTerm theme definition with `palette`, `effects`, `xterm`, `fonts`, `cssVars`, `visuals`, `defaultShaderId`, `defaultOpenAnimationId`, `defaultCloseAnimationId`, `workbench`, and `explorer`.
  - `theme.workbench` is the app-wide shell recipe layer. It controls the command-center chrome, command palette, terminal shell, settings shell, tabs, shell radii, and shared workbench surfaces.
  - `theme.explorer` is the explorer-shell recipe layer. It is where package authors can swap between high-level presets like `workbench`, `xmb`, and `channel-grid`, set structural choices such as `toolbarStyle`, `breadcrumbStyle`, `previewStyle`, `statusBarStyle`, `railPosition`, `preferredViewMode`, and `preferredExperimentalViewMode`, and then override geometry/surfaces through `metrics`, `surfaces`, `typography`, and raw explorer-scoped `cssVars`.
- `designTokens`, `layoutPrimitives`, `navigationPatterns`
  - Typed backend contract slices. Token values and primitive props can be strings, numbers, booleans, or structured JSON values.
- `renderStyles`
  - Backend render-style contracts. Set `supportsLiveSwap` on a style when it can be hot-swapped without restarting the explorer shell.
- `assets.background`
  - Relative path to a wallpaper/image asset.
- `assets.preview`
  - Optional preview image used by the in-app theme picker. Falls back to the theme wallpaper when omitted.
- `assets.iconTheme`
  - Relative path to an icon theme JSON file. This is the preferred way to ship icon overrides and matcher overrides.
- `assets.iconsDirectory`
  - Legacy folder-only icon override mode. Still supported for older theme packages.
- `contributions.shaders`
  - Optional list of relative shader module paths. When omitted, OverlayTerm auto-discovers supported files from the package `shaders/` folder.
- `contributions.animations`
  - Optional list of relative animation module paths. When omitted, OverlayTerm auto-discovers supported files from the package `animations/` folder.
- `visuals`
  - Declarative animated layers rendered behind the shell content.

## Explorer Recipe Highlights

- `theme.explorer.preset`
  - `workbench`, `xmb`, `channel-grid`, or `custom`
- `theme.explorer.metrics`
  - `railWidth`, `previewWidth`, `chromeInset`, `toolbarPaddingX`, `toolbarPaddingY`, `toolbarGap`, `controlRadius`, `panelRadius`, `spacingScale`, `gridScale`, `rowHeightScale`, `iconScale`, `hoverLiftPx`
- `theme.explorer.surfaces`
  - High-level chrome/entry colors for the root shell, toolbar, omnibox, preview, status bar, chips, hover state, selected state, and drop state
- `theme.explorer.typography`
  - Explorer-specific font sizing and label weighting without touching the rest of the workbench
- `theme.explorer.cssVars`
  - Raw escape hatch for explorer-only CSS variables when the typed fields are not enough

This is the layer that makes theme packages capable of approximating shells like PS3 XMB flows, Wii channel grids, glassy dock navigators, or heavier desktop workbenches without forking the explorer component.

## Workbench Recipe Highlights

- `theme.workbench.preset`
  - `workbench`, `xmb`, `channel-grid`, or `custom`
- `theme.workbench.topBarStyle`
  - `solid`, `glass`, `floating`, or `minimal`
- `theme.workbench.commandPaletteStyle`, `theme.workbench.terminalStyle`, `theme.workbench.settingsStyle`
  - `solid`, `glass`, or `floating`
- `theme.workbench.tabStyle`
  - `underline`, `capsule`, or `segment`
- `theme.workbench.metrics`
  - `chromeHeight`, `controlRadius`, `panelRadius`, `shellInset`, `commandPaletteWidth`, `commandPaletteTopInset`, `pagePadding`, `panelGap`
- `theme.workbench.surfaces`
  - App-wide shell surfaces for chrome, menus, command palette, settings shell, terminal shell, and shared button/tab treatments
- `theme.workbench.cssVars`
  - Raw escape hatch for workbench-only CSS variables when the typed fields are not enough

## Authoring Format

- Theme manifests are authored in `JSON` or `TOML`.
- Color/effect/layout values are mostly CSS-like strings and numbers.
  - Examples: `rgba(...)`, `linear-gradient(...)`, `blur(18px)`, `24`, `0.18`
- Icon themes are authored in `JSON`.
- Shaders and animations are authored as `TSX` runtime modules inside `shaders/` and `animations/`.

So the practical answer is:

- theme package structure and recipes: `JSON` or `TOML`
- icon mapping: `JSON`
- motion and shader contributions: `TSX`
- most styling primitives inside the manifest: CSS-like values

That means an XMB-like theme is mainly a data package, not a custom React fork.

## Icon Theme JSON

The icon JSON intentionally mirrors the useful parts of VS Code's icon-theme shape:

- `iconDefinitions`
  - Canonical icon id to relative file path.
- `fileExtensions`
  - Extension matcher to icon id.
- `fileNames`
  - Exact file-name matcher to icon id.
- `folderNames`
  - Closed-folder matcher to icon id.
- `folderNamesExpanded`
  - Open-folder matcher to icon id.

Use [`themes/_starter/icon-theme.json`](/M:/OverlayTerm/themes/_starter/icon-theme.json) as the copyable reference file for community themes.

## Canonical Ids

Packages only need to ship the icons they want to replace.

Useful file names:

- `folder.svg`
- `folder_open.svg`
- `folder_src.svg`
- `folder_src_open.svg`
- `folder_docs.svg`
- `folder_docs_open.svg`
- `txt.svg`
- `typescript.svg`

File and folder icons fall back to the built-in `/icons` catalog automatically when a package does not provide an override.

## Notes

- Theme packages are scanned from this `themes` folder.
- Shader modules bundled inside a theme package are loaded into the same live shader registry as global shaders.
- Animation modules bundled inside a theme package are loaded into the same live animation registry as global animations.
- Theme packages can set `theme.defaultOpenAnimationId` and `theme.defaultCloseAnimationId` so motion follows the active theme unless the user chooses an explicit override in Settings.
- Theme package metadata such as `author`, `homepage`, `tags`, version, preview media, and bundled capabilities render directly in the theme picker cards.
- Use the Settings panel to refresh package discovery or open this directory.
- Visual layers are optional; they are how you can add animated glass, soft glow, plasma drift, and similar background motion without hardcoding theme behavior into the app.
