# Greeble3D

Portable extraction of the Greeble website modeler, bundled with its Rust/WASM geometry runtime and Sketchfab import flow.

## What is inside

- Standalone React/Vite app entrypoint
- Embeddable `mountGreeble3D(...)` library entrypoint
- Rust/WASM crate in `wasm/`
- Prewired modeler source in `src/features/greeble/`
- Sketchfab search and download integration
- `dist/app/` standalone production output
- `dist/lib/` embeddable library output plus declaration files
- Generated WASM bindings in `src/features/greeble/pkg/`

## Quick start

```bash
npm install
npm run dev
```

## Build outputs

```bash
npm run build
npm run build:lib
```

- `build` creates the standalone app bundle in `dist/app/`.
- `build:lib` creates the embeddable library bundle in `dist/lib/` plus declaration files in `dist/lib/types/`.

## GreebleFS workbench panel

- `extension.toml` exposes the bundle as the `greeble3d` folder plugin inside GreebleFS.
- The plugin panel mounts `dist/app/index.html` in an isolated iframe so the modeler keeps its own CSS, window listeners, fullscreen behavior, and WASM boot path.
- The Vite app build uses a relative asset base so the copied `dist/app/` folder stays portable when GreebleFS loads it from `usr/plugins/Greeble3D`.

## Portable bundle notes

- `wasm/` is detached from the parent Rust workspace so the folder can compile on its own after moving.
- The extracted build disables the `wasm-opt` post-pass for portability; Rust release optimization still stays enabled.
- The package exports the library entry, stylesheet, and manifest through `package.json` so the folder can be used like a drop-in module.

## Sketchfab token

The in-app browser stores the token in local storage under the key declared in [`Greeble3D.manifest.json`](./Greeble3D.manifest.json).

## Runtime overrides

Environment overrides:

- `VITE_GREEBLE3D_TITLE`
- `VITE_GREEBLE3D_EXIT_HREF`
- `VITE_GREEBLE3D_SHOW_EXIT`
- `VITE_GREEBLE3D_LAYOUT_ID`
- `VITE_GREEBLE3D_SKETCHFAB_API_BASE`
- `VITE_GREEBLE3D_SKETCHFAB_TOKEN_KEY`
- `VITE_GREEBLE3D_WASM_GLOBAL_KEY`
- `VITE_GREEBLE3D_WASM_READY_EVENT`

## Embedding

```ts
import { mountGreeble3D } from 'greeble3d'
import 'greeble3d/styles.css'

mountGreeble3D(document.getElementById('root')!, {
  homeHref: '/tools',
  showExit: true,
})
```
