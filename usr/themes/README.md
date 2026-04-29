# GreebleFS Theme Packages

Drop theme bundle folders into this directory and GreebleFS will discover them automatically.

## Canonical `/usr` Token Pipeline

Top-level `/usr` is the single authored source of truth for UI visual and interaction values. Theme bundles in `usr/themes/` should orchestrate external packs by id instead of embedding colors, spacing, radii, shadows, motion, z-layers, mobile metrics, or other presentational values inline.

Canonical storage lanes:

- `usr/appearance-packs/<pack-id>/manifest.json` plus `tokens/color.json`, `typography.json`, `spacing.json`, `radius.json`, `border.json`, `shadow.json`, `opacity.json`, `blur.json`, `geometry.json`, and `layer.json`.
- `usr/interaction-motion/<pack-id>/manifest.json` plus `tokens/motion.json` and `tokens/interaction.json`.
- `usr/theme-recipes/<recipe-id>/manifest.json` plus `presentation.json`, `layout.json`, `navigation.json`, `render.json`, `workbench.json`, `explorer.json`, and `mobile.json`.
- `usr/theme-engines/<engine-id>/theme-engine.json` is a thin composition manifest with `appearancePackId`, `interactionMotionPackId`, and `themeRecipeId`; do not put inline token payloads in engine files.

`usr/domain/theme-manifests.json` is derived/cache metadata for the Rust domain catalog. Do not use it as an authored UI value store.

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
    renderers/
      custom-shell.tsx
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

Top-level bundle fields:

- `id`, `name`, `description`, `author`, `homepage`, `tags`
- `extends`
  - Optional base theme id. Can point at a built-in theme or another package theme.
- `appearancePackId`, `interactionMotionPackId`, `themeRecipeId`, `themeEngineId`
  - The preferred v1 theme path. `appearance.activeThemeEngineId` remains the persisted selector in Settings, and the selected engine composes these packs into the resolved desktop/mobile CSS variable snapshot.
- `topBarId`, `iconThemeId`, `wallpaperId`, `shaderId`, `openAnimationId`, `closeAnimationId`, `soundPackId`, `homePackId`, `menuPackId`
  - Bundle orchestration ids for non-token assets and subsystem packs.
- `themeRenderer`
  - Optional V2 shell renderer module. This is the opt-in path for themes that want to replace the built-in workbench presentation with a theme-authored React shell while still using host-owned panels, navigation state, wallpaper APIs, and native capabilities.
  - `entryModule`
    - Relative path to a `TSX` renderer module, for example `renderers/custom-shell.tsx`.
  - `apiVersion`
    - Renderer host contract version. Current value: `1`.
  - `supportsLiveSwap`
    - Marks renderers that are safe to reload without dropping back to the built-in shell.
  - `fallbackRuntime`
    - Optional built-in runtime kind to use if the renderer fails. Supported values: `workbench-tabs`, `cross-axis-media`, `channel-launcher`, `desktop-stack`.
  - `capabilities`
    - Optional booleans for `customScreens`, `wallpaperScene`, and `surfaceAdapters`.
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

## Generalized Authoring Model

- `presentation`, `layoutPrimitives`, `navigationPatterns`, and `renderStyles` describe the theme in generic terms.
- `theme.workbench` and `theme.explorer` are optional app/default override layers on top of that engine manifest.
- `theme.dock.workbench` and `theme.dock.explorer` are optional dock-only override layers on top of the selected dock base theme.
- If you omit the recipe `preset`, GreebleFS now derives sensible workbench and explorer defaults from the active layout primitive, navigation pattern, render style, density, chrome style, radius, spacing, icon style, and motion style.
- Recipes can explicitly bind to a non-default engine descriptor with:
  - `theme.workbench.layoutPrimitiveId`, `theme.workbench.navigationPatternId`, `theme.workbench.renderStyleId`
  - `theme.explorer.layoutPrimitiveId`, `theme.explorer.navigationPatternId`, `theme.explorer.renderStyleId`

## Dock Recipe Overrides

- Dock mode can either follow the active app theme or use a separate dock theme selected in Settings.
- When dock mode follows the app theme, `theme.dock.workbench` and `theme.dock.explorer` still apply on top of that shared base theme.
- When the user picks a separate dock theme, the dock recipe overlays apply on top of that dock theme instead.
- This lets a single package ship both a broader app shell identity and a tighter UE-style dock/browser identity without forking the explorer runtime.

The practical effect is that the system is not limited to a few named examples. XMB, Wii, iOS, desktop, media-center, and custom shells can all come from the same underlying manifest vocabulary, with recipes used only where you want stronger overrides.

Current built-in runtime mappings:

- `vs-code-workbench` -> tabbed workbench
- `ps-3-xmb` -> cross-axis media runtime
- `ios-springboard` / `wii-channels` -> launcher-grid runtime
- `desktop-window-manager` -> desktop-stack runtime

## Explorer Recipe Highlights

- `theme.explorer.preset`
  - Optional recipe seed: `workbench`, `xmb`, `channel-grid`, or `custom`
- `theme.explorer.layoutPrimitiveId`, `theme.explorer.navigationPatternId`, `theme.explorer.renderStyleId`
  - Optional binding ids for selecting which engine manifest entries drive the explorer recipe defaults
- `theme.explorer.metrics`
  - `railWidth`, `previewWidth`, `chromeInset`, `toolbarPaddingX`, `toolbarPaddingY`, `toolbarGap`, `controlRadius`, `panelRadius`, `spacingScale`, `gridScale`, `rowHeightScale`, `iconScale`, `hoverLiftPx`
- `theme.explorer.surfaces`
  - High-level chrome/entry colors for the root shell, toolbar, omnibox, preview, status bar, chips, hover state, selected state, and drop state
- `theme.explorer.typography`
  - Explorer-specific font sizing and label weighting without touching the rest of the workbench
- `explorer.json` `cssVars`
  - Recipe-authored explorer-only CSS variables for semantic surfaces when the typed fields are not enough.

This is the layer that makes theme packages capable of approximating shells like PS3 XMB flows, Wii channel grids, iOS-inspired launchers, glassy dock navigators, or heavier desktop workbenches without forking the explorer component.

## Workbench Recipe Highlights

- `theme.workbench.preset`
  - Optional recipe seed: `workbench`, `xmb`, `channel-grid`, or `custom`
- `theme.workbench.layoutPrimitiveId`, `theme.workbench.navigationPatternId`, `theme.workbench.renderStyleId`
  - Optional binding ids for selecting which engine manifest entries drive the workbench recipe defaults
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
- `workbench.json` `cssVars`
  - Recipe-authored workbench-only CSS variables for semantic surfaces when the typed fields are not enough.

## Authoring Rules

- Theme manifests are authored in `JSON` or `TOML`.
- UI value literals are data, not source code. Put CSS-like strings and numeric presentation values in the `/usr` pack files above.
- UI source under `src/**` and `src-mobile/**` should consume emitted CSS variables or typed token lookups. New raw `px`, color, blur, shadow, duration, easing, and z-layer literals are blocked by `node scripts/audit-ui-literals.mjs`.
- Numeric literals are acceptable only for non-presentational algorithmic math, percentages, SVG viewBox data, and values derived from tokens.
- Icon themes are authored in `JSON`.
- Shaders and animations are authored as `TSX` runtime modules inside `shaders/` and `animations/`.

So the practical answer is:

- theme package structure and recipes: `JSON` or `TOML`
- icon mapping: `JSON`
- motion and shader contributions: `TSX`
- most styling primitives inside the manifest: CSS-like values

That means a theme can stay a mostly declarative data package, or it can opt into a host-constrained custom React shell through `themeRenderer` when the built-in runtime mappings are not enough.

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
- Dock-aware packages are labeled in the theme picker so users can see which themes ship dedicated dock recipes.
- Use the Settings panel to refresh package discovery or open this directory.
- Visual layers are optional; they are how you can add animated glass, soft glow, plasma drift, and similar background motion without hardcoding theme behavior into the app.
