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
  - Partial OverlayTerm theme definition with `palette`, `effects`, `xterm`, `fonts`, `cssVars`, `visuals`, `defaultShaderId`, `defaultOpenAnimationId`, and `defaultCloseAnimationId`.
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
