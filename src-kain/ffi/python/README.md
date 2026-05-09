# Kain Python FFI

This lane connects Kain to the existing `greeblefs-python-sidecar`.

Current concrete hook:

- Python sidecar action: `kain.ffi.catalog`
- Python implementation: `src-python/greeblefs_sidecar/actions.py`
- Python manifest: `src-python/greeblefs-python-sidecar.json`
- Kain lane descriptor: `src-kain/ffi/python/ffi.toml`

Kain Python reference smokes in `D:/Kain-Lang` show the real power surface:

- `smoketest/python/numpy_supernova`
  Uses `std::python::bridge`, `std::python::numpy`, and DCC image/tensor/mesh wrappers for shared NumPy arrays, procedural images, tensors, and point clouds.
- `smoketest/python/pygame_poster`
  Uses `std::python::pygame` plus DCC image conversion for poster/image generation and mutation.
- `smoketest/python/trimesh_glb_forge`
  Uses `std::python::trimesh` plus DCC mesh conversion for GLB/mesh forging and shared geometry mutation.

Use this lane for dependency-heavy analysis, AST/report generation, ML/data tooling, and reusable codebase inventory scripts. The first planned consumer is the TS frontend UI inventory analyzer.
