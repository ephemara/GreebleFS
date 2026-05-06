---
name: greeblefs-greeble3d-workbench
description: Use when changing the portable `usr/plugins/Greeble3D` workbench panel, its iframe host wrapper, or the copied modeler bundle portability/build flow inside GreebleFS. Covers `usr/plugins/Greeble3D/extension.toml`, `index.tsx`, `vite.config.ts`, `README.md`, and the rebuild commands.
---

# GreebleFS Greeble3D Workbench

Use this skill when the task touches the Greeble3D plugin as mounted inside GreebleFS.

## Core Model

- `usr/plugins/Greeble3D/extension.toml`
  Registers the folder-plugin panel.
- `usr/plugins/Greeble3D/index.tsx`
  Intentionally stays a thin iframe host for `dist/app/index.html`.
- `usr/plugins/Greeble3D/vite.config.ts`
  Must keep the production build portable with a relative asset base.
- `usr/plugins/Greeble3D/dist/app/`
  Standalone app bundle used by the workbench panel.
- `usr/plugins/Greeble3D/dist/lib/`
  Embeddable library output for non-GreebleFS consumers.
- `usr/plugins/Greeble3D/Greeble3D.manifest.json` and `usr/plugins/Greeble3D/src/config/greeble3dRuntime.ts`
  Portable runtime config source of truth.

## Editing Rules

1. Keep the GreebleFS panel isolated through the iframe unless Greeble3D first stops depending on global CSS, fullscreen, `document.title`, localStorage, and window-level listeners.
2. Keep app-build asset URLs relative. If `dist/app/index.html` ever goes back to `/assets/...`, the workbench panel will break when loaded from `usr/plugins`.
3. Keep `extension.toml` and `README.md` aligned with the actual mounting strategy.
4. If deeper host integration is needed, prefer explicit bridge/query-param/panel-request seams over importing random host code into the modeler.

## Validation

```powershell
cd D:\GreebleFS\usr\plugins\Greeble3D
npm run check
npm run build
npm run build:lib
```

Then confirm `dist/app/index.html` references `./assets/...`.

## Known Gotchas

- `npm run build` and `npm run build:lib` may still warn about the duplicate `SHAPES.ICOSA` switch case in `src/features/greeble/KGreebleEngine.tsx`; that warning is not caused by the GreebleFS wrapper.
- Windows `rustup target add wasm32-unknown-unknown` can fail once with a rename error during `build:lib`; retry once before changing the build scripts.
