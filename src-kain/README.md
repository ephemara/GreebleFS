# GreebleFS Kain Runtime Lane

`src-kain` is the repo-owned home for Kain-authored GreebleFS runtimes. The host treats these packages exactly like other runtime pipeline packages: each runtime owns a `runtime.toml`, declares its compiler as `kain-script`, and runs through the native sidecar protocol.

The first tiny runtime is `greeblefs-kain-host-smoke`, a host-bridge proof that asks GreebleFS for `files.stat` and returns the result with Kain metadata. The first real control-plane runtime is `greeblefs-kain-control-plane`, a Kain-authored sidecar that exposes host reflection, plugin proof emission, settings proof emission, and pipeline planning actions.

## What Changed With The Tauron Kain Bridge

Kain is no longer only a private executable that GreebleFS can launch as a sidecar. Tauron now has a generic Kain bridge plugin, and GreebleFS opts into it.

Current hard wiring:

- Tauron owns the framework bridge in `D:/tauron/crates/tauri-plugin-kain`.
- Tauron exposes frontend calls through `@tauri-apps/api/kain`.
- GreebleFS registers `tauri_plugin_kain::init()` in `src-tauri/src/lib.rs`.
- GreebleFS grants `kain:default` in `src-tauri/capabilities/default.json`.
- GreebleFS wraps the API in `src/runtime/kainTauronBridge.ts`.
- GreebleFS normalizes the app-level Kain contribution manifest in `src/runtime/kainManifest.ts`.
- GreebleFS normalizes the app-level Kain semantic UI scaffold in `src/runtime/kainUiScaffold.ts`.
- GreebleFS renders the first known Kain UI primitives through `src/components/kain/KainUiRenderer.tsx`.
- First-party Kain runtime packages still live here under `src-kain/runtimes/**`.

Simple model:

```text
Webview UI
  -> @tauri-apps/api/kain
  -> Tauron tauri-plugin-kain
  -> Kain bridge manifest / runtime dispatch / host events
  -> GreebleFS runtime pipeline, plugins, settings, UI, files, GPU, or tools
```

This means Kain can become a source-of-truth/orchestration layer while Tauron stays the native window/app host and GreebleFS stays the product consuming that power.

## App Manifest Dispatch

`src-kain/app/main.kn` now exposes app-level dispatch lanes through `kain_bridge_dispatch`:

- `greeblefs.ui.graph`
  Returns the Kain-authored UI graph consumed by Settings and app defaults.
- `greeblefs.ui.scaffold`
  Returns Kain-authored semantic UI surfaces, primitive vocabulary, token hints, and action ids consumed by `src/runtime/kainUiScaffold.ts`.
- `greeblefs.lattice.catalog`
  Returns the Kain Lattice QML-like package/component catalog consumed by `src/runtime/kainLatticeCatalog.ts`.
- `greeblefs.ffi.catalog`
  Returns the Kain FFI monorepo lane catalog consumed by `src/runtime/kainFfiCatalog.ts`.
- `greeblefs.kain.manifest`
  Returns the first-class Kain contribution manifest consumed by `src/runtime/kainManifest.ts` and surfaced in Settings > Kain UI.
- `greeblefs.plugins.catalog`
  Returns the parallel Kain-native plugin catalog consumed by `src/runtime/kainPluginCatalog.ts` and merged into the existing plugin discovery lane.
- `greeblefs.plugins.action`
  Runs trusted Kain plugin actions through the resident bridge. In v1 this returns safe proof payloads; deeper per-plugin FFI execution should stay behind explicit trust/permission gates.

The manifest shape is intentionally small and additive:

- `schemaVersion`
- `kind = "greeblefs.kain.manifest"`
- `bridge`
- `capabilities`
- `dispatch`
- `generatedArtifacts`
- `settingsSchemas`
- `pipelines`
- `ffiLanes`
- `consumers`

Settings > Kain UI publishes smoke-test DOM hooks so MCP automation can prove the live app is consuming the Kain manifest instead of only passing CLI tests:

- `data-kain-manifest-proof`
- `data-kain-manifest-kind`
- `data-kain-manifest-capabilities`
- `data-kain-manifest-dispatch`
- `data-kain-ui-scaffold-proof`
- `data-kain-ui-scaffold-surfaces`
- `data-kain-ui-scaffold-primitives`
- `data-kain-semantic-settings-modules`
- `data-kain-semantic-topbar-applets`
- `data-kain-lattice-proof`
- `data-kain-lattice-packages`
- `data-kain-lattice-host-objects`
- `data-kain-ffi-proof`
- `data-kain-ffi-lanes`
- `data-kain-ffi-python`
- `data-kain-plugin-catalog-proof`
- `data-kain-plugin-count`
- `data-kain-plugin-preview-workbenches`
- `data-kain-plugin-ffi-capabilities`
- `data-kain-plugin-wasm-targets`
- `data-kain-plugin-cargo-ffi-targets`

The workbench top bar also exposes the compact applet strip through:

- `data-kain-semantic-applet-strip`
- `data-kain-semantic-applet-slot`
- `data-kain-semantic-applet-count`
- `data-kain-semantic-applet-packages`

If the Kain file changes while the app is already running, restart or reload the resident Tauron Kain runtime before judging the in-app proof. The old process can otherwise keep serving the previous `src-kain/app/main.kn` dispatch table.

## Semantic UI Scaffold

The first Kain UI authoring scaffold is additive. It does not replace existing React surfaces yet.

Current files:

- `src-kain/stdlib/greeblefs/ui.kn`
  Reusable Kain helper vocabulary for semantic GreebleFS UI nodes and surfaces.
- `src-kain/ui/kain_ui_scaffold.kn`
  Standalone reference surface that can run through the Kain CLI.
- `src/runtime/kainUiScaffold.ts`
  TypeScript normalization boundary for `greeblefs.ui.scaffold`.
- `src/components/kain/KainUiRenderer.tsx`
  Trusted React renderer for known semantic primitives.

The model is:

```text
Kain .kn surface intent
  -> greeblefs.ui.scaffold semantic IR
  -> TypeScript normalizer
  -> KainSemanticSurfaceHost
  -> GreebleFS renderer primitives
```

First primitives:

- `stack`
- `section`
- `row`
- `action-strip`
- `divider`
- `key-value`
- `notice`
- `status-pill`
- `text`
- `button`
- `toggle`
- `select`
- `slider`
- `settings-module`
- `shell-applet`
- `applet`
- `indicator`
- `icon-button`
- `mini-meter`

`src/runtime/kainSemanticUiRuntime.ts` is now the small semantic registry between scaffold data and Lattice package metadata. It preserves deterministic ordering through `order`, filters mounts by `kind` and `mountSlot`, and keeps legacy lookup by `surfaceId`, `mountId`, or `packageId`. `src/components/kain/KainSemanticSurfaceHost.tsx` is the reusable frontend mount point: it resolves a scaffold surface, associates it with a Lattice package, renders through `KainUiRenderer`, and handles trusted actions such as `kain.ui.reload`.

Keep this lane semantic, not JSX codegen. Kain should own structure, labels, layout intent, state, host-model declarations, and action ids. GreebleFS should own rendering, theme variables, trusted host actions, permissions, and fallbacks. Graduate one consumer at a time.

## Kain Lattice

Kain Lattice is the QML-like authoring system for GreebleFS.

The name is deliberate. Plasma is hot, free-flowing ionized matter; a lattice is the ordered structure on the other side. Lattice is where Kain turns GreebleFS UI, settings modules, panels, applets, actions, host models, bindings, and package metadata into authorable source that does not require editing JavaScript for every surface.

Current files:

- `src-kain/stdlib/greeblefs/lattice.kn`
  Kain helper vocabulary for packages, components, properties, bindings, signals, actions, and permissions.
- `src-kain/lattice/`
  Package root for Kain Lattice packages.
- `src-kain/lattice/greeblefs-shell-control/`
  First reference package for a KCM-style Settings module and shell-control applet lane.
- `src-kain/lattice/greeblefs-panel-registry/`
  First panel-registry package that mirrors built-in panel metadata as Lattice source.
- `src/config/panelLatticeRegistry.ts`
  TypeScript descriptor registry that makes built-in panel metadata/catalog/dock placement come from Lattice-shaped data before the renderers move.
- `src/runtime/kainLatticeCatalog.ts`
  TypeScript normalization boundary for `greeblefs.lattice.catalog`.

Plasma-inspired mapping:

- QML component -> Kain Lattice component.
- Plasmoid package metadata -> Kain Lattice package metadata.
- `Plasmoid.configuration` -> Kain-owned config schema and profile defaults.
- `Q_PROPERTY` / `Q_INVOKABLE` -> Rust/Tauron reflected host objects and actions.
- KCM -> Kain-authored Settings module.
- KRunner -> Kain-authored command/search/action provider.

This sits above the semantic UI scaffold. The scaffold defines renderable nodes; Lattice defines packages and live object contracts that can produce those nodes.

The first live Lattice mounts are `settings:kain-lattice-proof` in `settings.kain-ui` and `applet:kain-runtime-status` in `workbench.topbar.trailing`. They are authored by `src-kain/app/main.kn` from the reference package shape in `src-kain/lattice/greeblefs-shell-control/main.kn`, normalized by `src/runtime/kainUiScaffold.ts`, selected by `src/runtime/kainSemanticUiRuntime.ts`, and rendered by reusable hosts without adding custom React components for those surfaces.

The first production panel migration is `greeblefs.lattice.panel-registry`: `src/config/panelLatticeRegistry.ts` owns built-in panel labels, catalog descriptions, dock placement, IDE roles, icon slots, and Lattice component ids. `src/panels/panelRegistry.tsx` still owns trusted React renderers, but its built-in catalog now derives from the descriptor registry instead of hand-built catalog rows.

## Kain Plugin System

Kain plugins are additive to the existing TSX plugin system. Keep `usr/plugins` and `usr/packages` for React/package plugins; use `usr/plugins-kain` for Kain-native plugin packages.

Current first pass:

- `usr/plugins-kain/kain-workbench-smoke/plugin.kn`
  First Kain-native plugin source. It declares a workbench, a `.kn`/`.ks` preview workbench, trusted bridge actions, FFI capabilities, a WASM target, and a Cargo FFI target.
- `src-kain/plugins/registry.kn`
  Kain-side catalog proof for `greeblefs.plugins.catalog`.
- `src-kain/plugins/stdlib/greeblefs/plugin.kn`
  Authoring vocabulary for Kain plugins.
- `src/runtime/kainPluginCatalog.ts`
  TypeScript normalization boundary for Kain plugin catalog/action responses.
- `src/components/kain/KainPluginWorkbenchHost.tsx`
  Compact trusted host for Kain workbench and preview-workbench surfaces.
- `src/config/pluginPackages.ts`
  Merges normalized Kain catalog entries into the existing plugin catalog as metadata plugins and preview-lane contributions.

Model:

```text
usr/plugins-kain/<plugin>/plugin.kn
  -> greeblefs.plugins.catalog
  -> src/runtime/kainPluginCatalog.ts
  -> src/config/pluginPackages.ts
  -> existing workbench, preview, Plugins Manager, Settings, and enablement lanes
```

Kain owns plugin intent and heavy runtime orchestration. GreebleFS owns install/discovery, permissions, renderer safety, preview/workbench lifecycle, and host actions. Kain FFI lanes such as Python, Node, C runtime, Cargo FFI, WASM, Rust reflection, Tauron view, and SPIR-V are privileged plugin capabilities, not browser-level React APIs.

## What Is Possible Now

These are capability lanes Kain can grow into inside GreebleFS. Some are active now, some are next-step architecture targets unlocked by the bridge.

## Kain FFI Monorepo

`src-kain/ffi/` is the monorepo-style home for Kain cross-language bridge lanes:

- `python/`
  Hooked to the existing `greeblefs-python-sidecar` through `kain.ffi.catalog` and the live UI inventory action `kain.ffi.ui_inventory`.
- `node/`
  Scaffold for Node/native npm package FFI.
- `c-runtime/`
  Scaffold for C ABI, DLL, SDK, and legacy native-library integration.
- `rust-reflection/`
  Scaffold for Rust/Tauron host reflection and generated wrappers.
- `cargo-ffi/`
  Scaffold for Kain importing or calling Cargo crates from plugin/runtime pipelines.
- `tauri-view/`
  Live Tauron Kain bridge view lane.
- `wasm/`
  Scaffold for Kain compiling WASM artifacts consumed by GreebleFS `wasm-panel` and `wasm-worker` hosts.
- `spirv/`
  Scaffold for shader and compute artifact generation.

The app-level `greeblefs.ffi.catalog` dispatch advertises these lanes to the frontend and Settings > Kain UI. The root runnable reference is `src-kain/ffi/registry.kn`.

The Python lane is intentionally first because Kain's Python bridge is already serious machinery, not just "run a script." The reference smokes in `D:/Kain-Lang/smoketest/python/{numpy_supernova,pygame_poster,trimesh_glb_forge}` show `std::python::bridge`, `std::python::numpy`, `std::python::pygame`, `std::python::trimesh`, and DCC image/tensor/mesh wrappers doing shared-array, image, tensor, point-cloud, and GLB-style work.

The first GreebleFS analysis worker is live at `src-kain/ffi/python/analysis/ui_inventory.py` and emits `greeblefs.ui.hardcoded-surface-map` for inline styles, colors, pixel values, icons, drag/drop, pointer, keyboard, context-menu, and global listener surfaces. `src-python/greeblefs_sidecar/actions.py:kain.ffi.ui_inventory` exposes it through the Python sidecar. `src-kain/ffi/python/examples/ui_inventory_bridge/smoke.kn` is runnable on the staged payload today; `bridge_example.kn` is the true `std::python::bridge` example for Python-enabled Kain builds.

## Control Plane Runtime

`src-kain/runtimes/greeblefs-kain-control-plane/` is the v0 Kain control-plane package.

It declares these sidecar actions:

- `control-plane.describe`
- `host.reflect`
- `plugin.emit-proof`
- `settings.emit-proof`
- `pipeline.plan`

The runtime speaks GreebleFS `stdio-json-lines-v2` packets. It can emit normal action responses, send nested `host-call` packets such as `host.get_api_schema`, `files.create_directory`, and `files.write_text`, then read the matching `host-response` packet before completing the original action.

Important implementation note: `src/server.kn` is intentionally self-contained for v0. The sibling files `host_reflection.kn`, `plugin_authoring.kn`, `settings_authoring.kn`, and `pipeline_tools.kn` are compile-checked authoring modules/reference shapes, but the current `kain run src/server.kn` path did not expose local module symbols reliably enough for the runtime server to depend on them. Promote those modules into the live server once Kain local module linkage is hardened for this shape.

### Node FFI Bridge

Kain can call into Node/native packages when that is the fastest path. That makes Kain a good orchestrator for npm ecosystem tools, native Node modules, asset processors, code generators, and workflow scripts that would otherwise require a separate JS command layer.

Use this for:

- pipelines that already have strong Node packages
- package/plugin authoring helpers
- codegen or asset transforms that should not be rewritten in Rust

Do not make React the broker for this. React should ask the Kain/Tauron bridge or the runtime pipeline for the result.

### C Runtime Bridge

Kain can talk to C libraries, native DLLs, compiled tools, legacy SDKs, and weird vendor runtimes. This is the lane for using system-level or domain-specific native code without turning GreebleFS Rust into a pile of one-off bindings.

Use this for:

- DLL/native SDK experiments
- media, graphics, filesystem, or device libraries that are easier to reach through Kain
- legacy code that should be wrapped and orchestrated before it graduates into first-class Rust

Keep host trust boundaries clear. If a C bridge becomes core and stable, consider promoting the hardened boundary into Rust later.

### Rust Reflection Bridge

Kain has a Rust reflection feature, and Tauron/GreebleFS can describe host capabilities back to Kain. That means Kain can inspect a host contract, generate bridge calls, or route requests without humans maintaining duplicate glue everywhere.

Use this for:

- host API discovery
- generated Kain wrappers for GreebleFS runtime methods
- keeping Kain scripts aligned with Rust command/permission contracts

The durable direction is: Rust describes capabilities, Kain consumes that shape, generated glue stays boring.

### Tauri View Bridge

The webview can now call `@tauri-apps/api/kain`, and the injected bridge can expose `window.__KAIN_TAURI__`. This lets Kain become part of app/view orchestration instead of living behind unrelated Tauri invokes.

Use this for:

- Kain-authored UI workflows
- hot reload or bridge-ready events
- view/action manifests that Kain owns and GreebleFS renders
- command palettes, settings flows, and plugin panels that need a smarter script layer

Generic bridge code belongs in Tauron. GreebleFS should only add product-specific wrappers and consumers.

### SPIR-V And Shader Pipeline

Kain can compile SPIR-V/shader artifacts. GreebleFS already has GPU, shader, preview, and runtime-pipeline surfaces, so Kain can eventually become a shader/kernel authoring and build layer.

Use this for:

- generated preview shaders
- GPU processing kernels
- lookdev/theme shader pipelines
- runtime-authored visual effects that need compiled artifacts

Compiled artifacts should flow through the runtime pipeline or a dedicated GPU/shader cache, not random frontend file paths.

### Plugin Authoring

Plugins could be authored in Kain as scripts/manifests instead of hand-maintained JSON plus TypeScript glue. Kain can generate the boring plugin files that GreebleFS already understands, or it can drive plugin behavior directly through the bridge/runtime lane.

Use this for:

- plugin package templates
- action manifests
- preview lane manifests
- workflow definitions
- typed plugin API wrappers

The strongest shape is: Kain is the source of truth, generated JSON/TS is compatibility output.

### Settings Replacement

Kain can generate or own settings schemas and emit the boring settings/profile files GreebleFS currently needs. This is the likely path away from fragile JSON-only settings flows.

Use this for:

- settings schemas
- profile defaults
- validation and migration scripts
- UI settings sections generated from typed intent

Do not delete the existing settings store until Kain can emit the same stable artifacts. The migration path is Kain-authored source -> generated GreebleFS-compatible files -> runtime adoption.

### Pipeline Orchestration

Kain can coordinate Rust, Node, C, GPU, UI, filesystem, sidecars, and codegen from one language layer. This is the main reason it belongs here as a first-class citizen.

Use this for:

- multi-step build/runtime tasks
- cross-domain plugin pipelines
- generated UI and settings flows
- artifact preparation
- app automation and developer tools

This is where Kain should reduce cross-domain slop: one orchestration source, many boring outputs.

## Agent Rules

- Put Kain-authored GreebleFS source under `src-kain/`.
- Put generic Tauron/Kain bridge behavior in `D:/tauron/crates/tauri-plugin-kain` and `D:/tauron/packages/api/src/kain.ts`.
- Keep private Kain payload artifacts out of git. `toolchains/kain/payload/` and `.kain/` are ignored on purpose.
- Prefer Kain as source-of-truth when replacing JSON-heavy flows, then generate the existing GreebleFS-compatible artifacts until the runtime can consume Kain directly.
- Do not route permanent Kain host work through React as a broker. Use the Tauron Kain bridge, runtime pipeline, or extension-host APIs.
- Document whether a lane is implemented now or only unlocked by the bridge. Do not imply Node FFI, C runtime, SPIR-V, or settings ownership is fully wired in GreebleFS until that specific pass lands.

## First Next Passes

- Move Explorer interaction policy, drag/drop, and panel placement toward Lattice descriptors one compact surface at a time.
- Move one small production Settings sub-surface from React-authored JSX to Kain-authored semantic IR while keeping the same trusted renderer primitive output.
- Add reflected host models so read-only `toggle`, `select`, and `slider` primitives can graduate into permissioned writes.
- Promote the `greeblefs-kain-control-plane` proof actions into a consumed generated-artifact lane.
- Convert one proof artifact from `greeblefs.kain.manifest.generatedArtifacts` into a real generated plugin/action manifest loaded by the plugin system.
- Replace the proof plugin/settings artifacts with one real GreebleFS plugin/action manifest and one real settings/profile artifact.
- Feed Rust/Tauron reflection into the manifest so `kain.host.reflection` can move from planned to live.
