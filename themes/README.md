# Snapyard Theme Packages

Drop theme folders into this directory and Snapyard will discover them automatically.

## Folder Shape

```text
themes/
  my-theme/
    theme.json
    assets/
      wallpaper.svg
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

- `id`, `name`, `description`
- `extends`
  - Optional base theme id. Can point at a built-in theme or another package theme.
- `theme`
  - Partial Snapyard theme definition with `palette`, `effects`, `xterm`, `fonts`, `cssVars`, and `visuals`.
- `assets.background`
  - Relative path to a wallpaper/image asset.
- `assets.iconsDirectory`
  - Relative folder that contains icon overrides.
- `visuals`
  - Declarative animated layers rendered behind the shell content.

## Icon Override Naming

Packages only need to ship the icons they want to replace.

Useful file names:

- `folder.svg`
- `folder_open.svg`
- `folder_src.svg`
- `folder_src_open.svg`
- `txt.svg`
- `typescript.svg`

File icons fall back to the built-in `/icons` catalog automatically when a package does not provide an override.

## Notes

- Theme packages are scanned from this `themes` folder.
- Use the Settings panel to refresh package discovery or open this directory.
- Visual layers are optional; they are how you can add animated glass, soft glow, plasma drift, and similar background motion without hardcoding theme behavior into the app.
