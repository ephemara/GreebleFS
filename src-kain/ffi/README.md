# Kain FFI Monorepo

`src-kain/ffi` is the repo-owned map for Kain's cross-language bridge lanes inside GreebleFS.

This folder is intentionally shaped like a tiny monorepo:

- `registry.kn` returns the top-level Kain FFI catalog.
- `python/` owns the Python sidecar bridge lane and future Python-backed analysis scripts.
- `node/` owns Node/native package FFI plans.
- `c-runtime/` owns C ABI, DLL, SDK, and native library lanes.
- `rust-reflection/` owns Rust/Tauron reflection handoff plans.
- `tauri-view/` owns webview/Tauron bridge view orchestration.
- `spirv/` owns shader and GPU artifact lanes.

The first concrete hook is Python: the existing GreebleFS Python sidecar now advertises `kain.ffi.catalog` and `kain.ffi.ui_inventory`, and Kain advertises that bridge through `greeblefs.ffi.catalog`.

TS frontend analysis now enters through `python/analysis/ui_inventory.py` and has a repo-local Kain bridge example at `python/examples/ui_inventory_bridge/bridge_example.kn`. Future analyzers should follow the same shape: `.kn` orchestration using `std::python::bridge`, Python worker module for dependency-heavy analysis, structured output report.
