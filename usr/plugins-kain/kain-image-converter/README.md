# Kain Image Converter Plugin

This is the production Kain image converter plugin. Keep this package lean: plugin source, trusted runtime declarations, and actual helper lanes only.

The important split:

- `plugin.kn` is the source of truth for plugin identity, tool metadata, workbench mounts, preview workbenches, trusted action ids, FFI lanes, pipeline stages, and contracts.
- `KainPluginWorkbenchHost.tsx` is the trusted GreebleFS renderer. Kain does not inject arbitrary DOM.
- `src-python/greeblefs_sidecar/image_converter_runtime.py` is the live byte-writing path for inspect, plan, convert, SVG emit, and ICO/PDF/raster output.
- Node, Cargo FFI, C runtime, and WASM lanes are explicit growth paths. They are declared in Kain now and should graduate one lane at a time.

## Package Map

```text
usr/plugins-kain/kain-image-converter/
  plugin.kn                         source of truth plugin contract
  plugin.runtime/kain/              Kain runtime smoke and reports
  plugin.runtime/python/            Python FFI bridge manifest
  plugin.runtime/node/              Node FFI bridge manifest
  plugin.runtime/c-runtime/         C ABI / DLL / SDK codec bridge manifest
  plugin.runtime/cargo/             plugin-owned Rust/Cargo FFI helper
  plugin.runtime/wasm/              future Kain WASM preview worker
```

Teaching examples live beside this package:

- `usr/plugins-kain/kain-plugin-authoring-examples/`
- `usr/plugins-kain/kain-plugin-ffi-full-stack-example/`

## Validation

Run from `D:/GreebleFS`:

```powershell
D:\GreebleFS\toolchains\kain\payload\bin\kain.exe run D:\GreebleFS\usr\plugins-kain\kain-image-converter\plugin.kn
D:\GreebleFS\toolchains\kain\payload\bin\kain.exe run D:\GreebleFS\usr\plugins-kain\kain-image-converter\plugin.runtime\kain\image_converter_pipeline.kn
D:\GreebleFS\toolchains\kain\payload\bin\kain.exe run D:\GreebleFS\usr\plugins-kain\kain-image-converter\plugin.runtime\c-runtime\image_converter_c_runtime_bridge.kn
D:\GreebleFS\toolchains\kain\payload\bin\kain.exe build D:\GreebleFS\usr\plugins-kain\kain-image-converter\plugin.kn -t ts -o D:\GreebleFS\target\kain-image-converter-plugin-build\plugin.ts
```
