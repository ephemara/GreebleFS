# UI Inventory Bridge Example

This example shows the intended GreebleFS pattern for Kain Python FFI work:

```text
Kain .kn
  -> std::python::bridge
  -> repo-local Python worker
  -> structured report artifact
```

It mirrors the style of `D:/Kain-Lang/smoketest/python/*`: the Kain file owns the orchestration, Python owns dependency-heavy analysis, and the output stays structured enough for later UI/runtime consumption.

Files:

- `smoke.kn`
  Runnable catalog smoke that works with the bundled GreebleFS Kain payload.
- `bridge_example.kn`
  Full `std::python::bridge` example for Python-enabled Kain runtimes. It calls `ui_inventory.py` and writes report artifacts.

Run the bundled-payload smoke from the GreebleFS root:

```powershell
D:\GreebleFS\toolchains\kain\payload\bin\kain.exe run D:\GreebleFS\src-kain\ffi\python\examples\ui_inventory_bridge\smoke.kn
```

Generated reports are written under `outputs/`.
