# GreebleFS Kain Runtime Lane

`src-kain` is the repo-owned home for Kain-authored GreebleFS runtimes. The host treats these packages exactly like other runtime pipeline packages: each runtime owns a `runtime.toml`, declares its compiler as `kain-script`, and runs through the native sidecar protocol.

The first runtime is `greeblefs-kain-host-smoke`, a tiny host-bridge proof that asks GreebleFS for `files.stat` and returns the result with Kain metadata. It is intentionally small so future settings, plugin, and pipeline work can copy the shape without inheriting a big example.

## What Changed With The Tauron Kain Bridge

Kain is no longer only a private executable that GreebleFS can launch as a sidecar. Tauron now has a generic Kain bridge plugin, and GreebleFS opts into it.

Current hard wiring:

- Tauron owns the framework bridge in `D:/tauron/crates/tauri-plugin-kain`.
- Tauron exposes frontend calls through `@tauri-apps/api/kain`.
- GreebleFS registers `tauri_plugin_kain::init()` in `src-tauri/src/lib.rs`.
- GreebleFS grants `kain:default` in `src-tauri/capabilities/default.json`.
- GreebleFS wraps the API in `src/runtime/kainTauronBridge.ts`.
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

## What Is Possible Now

These are capability lanes Kain can grow into inside GreebleFS. Some are active now, some are next-step architecture targets unlocked by the bridge.

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

- Add a Kain bridge manifest emitted from Kain and loaded by `tauri-plugin-kain`.
- Add a tiny UI proof that calls `probeKainTauronBridge()` and shows bridge status in an existing developer surface.
- Create a Kain-authored plugin/action manifest generator that emits current GreebleFS plugin JSON.
- Prototype a Kain settings-source file that emits one small existing settings/profile artifact.
