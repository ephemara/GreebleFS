# Caveman God Mode

This package is intentionally the strongest copyable reference theme in the repo.

It is meant to show future LLMs how to author a serious package without guessing:

- a full `theme.json` manifest with workbench, explorer, and dock lanes
- a renderer with explicit `surfaceOwnership`
- renderer code that uses `host.shellModel` and `host.renderUtilityActionsSurface()`
- relative helper modules so the package can grow without collapsing into one unreadable file
- package-local assets for wallpaper and preview media

## Package Shape

```text
themes/
  caveman-god-mode/
    theme.json
    README.md
    assets/
      wallpaper.svg
      preview.svg
    renderers/
      caveman-god-mode-shell.tsx
      lib/
        palette.ts
        surfaces.tsx
```

## Why This Exists

The repo already supports deep shell theming, but future agents need a package that demonstrates the intended bar:

- bold visual direction
- readable manifest structure
- renderer-owned shell composition
- no raw `host.panels`
- no legacy `host.renderChromeBar()` composition
- helper extraction before the entry module becomes unmaintainable

## Authoring Notes For Future LLMs

1. Start with `theme.json` and decide the package identity first.
2. Keep the renderer host-bound.
   Use `host.shellModel.launcher` for navigation structure and `host.renderPanelSurface(...)` for the focused stage.
3. Declare `surfaceOwnership` explicitly.
   If the renderer owns chrome, launcher, content framing, or wallpaper, say so directly.
4. Put repeatable style tokens in helper modules.
   Do not turn the entry renderer into a 900-line inline CSS dump.
5. Treat dock overrides as part of the package.
   Dock mode is a first-class lane in this app, not an afterthought.

## Practical Copy Points

- Copy `theme.json` when you need a full package manifest.
- Copy `renderers/caveman-god-mode-shell.tsx` when you need a modern renderer entrypoint.
- Copy `renderers/lib/surfaces.tsx` when you need a pattern for splitting layout helpers out of the entry file.

If you make a new package from this one, keep the structural discipline and change the visual language, not the architecture.
