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
- `greeblefs.kain.manifest`
  Returns the first-class Kain contribution manifest consumed by `src/runtime/kainManifest.ts` and surfaced in Settings > Kain UI.

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
- `data-kain-lattice-proof`
- `data-kain-lattice-packages`
- `data-kain-lattice-host-objects`

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
  -> GreebleFS renderer primitives
```

First primitives:

- `stack`
- `section`
- `row`
- `status-pill`
- `text`
- `button`

Keep this lane semantic, not JSX codegen. Kain should own structure, labels, layout intent, state, and action ids. GreebleFS should own rendering, theme variables, trusted host actions, permissions, and fallbacks. Graduate one consumer at a time.

## Kain Lattice

Kain Lattice is the QML-like authoring system for GreebleFS.

The name is deliberate. Plasma is hot, free-flowing ionized matter; a lattice is the ordered structure on the other side. Lattice is where Kain turns GreebleFS UI, settings modules, panels, applets, actions, host models, bindings, and package metadata into authorable source that does not require editing JavaScript for every surface.

Current files:

- `src-kain/stdlib/greeblefs/lattice.kn`
  Kain helper vocabulary for packages, components, properties, bindings, signals, actions, and permissions.
- `src-kain/lattice/`
  Future package root for Kain Lattice packages.
- `src-kain/lattice/greeblefs-shell-control/`
  First reference package for a KCM-style Settings module and shell-control applet lane.
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

## What Is Possible Now

These are capability lanes Kain can grow into inside GreebleFS. Some are active now, some are next-step architecture targets unlocked by the bridge.

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

- Turn `button` scaffold actions into a real Kain action dispatch path, starting with `kain.ui.reload`.
- Render the first Kain Lattice package as a real KCM-style Settings module.
- Move one small Settings sub-surface from React-authored JSX to Kain-authored semantic IR while keeping the same renderer primitive output.
- Promote the `greeblefs-kain-control-plane` proof actions into a consumed generated-artifact lane.
- Convert one proof artifact from `greeblefs.kain.manifest.generatedArtifacts` into a real generated plugin/action manifest loaded by the plugin system.
- Replace the proof plugin/settings artifacts with one real GreebleFS plugin/action manifest and one real settings/profile artifact.
- Feed Rust/Tauron reflection into the manifest so `kain.host.reflection` can move from planned to live.
