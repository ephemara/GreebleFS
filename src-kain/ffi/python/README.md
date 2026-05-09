# Kain Python FFI

This lane connects Kain to the existing `greeblefs-python-sidecar`.

Current concrete hook:

- Python sidecar action: `kain.ffi.catalog`
- Python sidecar action: `kain.ffi.ui_inventory`
- Python implementation: `src-python/greeblefs_sidecar/actions.py`
- Python manifest: `src-python/greeblefs-python-sidecar.json`
- Kain lane descriptor: `src-kain/ffi/python/ffi.toml`
- Kain bridge smoke: `src-kain/ffi/python/examples/ui_inventory_bridge/smoke.kn`
- Kain bridge example: `src-kain/ffi/python/examples/ui_inventory_bridge/bridge_example.kn`

Kain Python reference smokes in `D:/Kain-Lang` show the real power surface:

- `smoketest/python/numpy_supernova`
  Uses `std::python::bridge`, `std::python::numpy`, and DCC image/tensor/mesh wrappers for shared NumPy arrays, procedural images, tensors, and point clouds.
- `smoketest/python/pygame_poster`
  Uses `std::python::pygame` plus DCC image conversion for poster/image generation and mutation.
- `smoketest/python/trimesh_glb_forge`
  Uses `std::python::trimesh` plus DCC mesh conversion for GLB/mesh forging and shared geometry mutation.

Use this lane for dependency-heavy analysis, AST/report generation, ML/data tooling, and reusable codebase inventory scripts.

The first live repo-local consumer is the TS frontend UI inventory analyzer:

```text
src-kain/ffi/python/examples/ui_inventory_bridge/bridge_example.kn
  -> use std::python::bridge
  -> src-kain/ffi/python/analysis/ui_inventory.py
  -> greeblefs.ui.hardcoded-surface-map
```

Keep future GreebleFS Python examples shaped like the Kain smoketests in `D:/Kain-Lang/smoketest/python`: `.kn` orchestration first, Python ecosystem work behind `std::python::bridge`, structured outputs under an `outputs/` folder.
