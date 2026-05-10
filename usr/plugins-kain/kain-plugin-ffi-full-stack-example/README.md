# Kain Plugin FFI Full Stack Example

This is a root-level teaching package for the real Kain FFI style. It mirrors the `src-kain/ffi/examples` shape without bloating the production `kain-image-converter` plugin.

Roles:

- Python creates the shared RGBA source image.
- Kain mutates bytes and owns the smoke contract.
- Cargo FFI imports the image helper crate from the production converter runtime.
- C FFI mutates the same shared image through a native DLL.
- Node emits HTML and PPM proof artifacts.

Run the proof from this folder with MCP/tooling commands:

```powershell
clang -shared -O2 native\image_converter_fx.c -o native\image_converter_fx.dll
D:\GreebleFS\toolchains\kain\payload\bin\kain.exe import-crate greeblefs_kain_image_tools --crate-path ..\kain-image-converter\plugin.runtime\cargo\greeblefs-kain-image-tools --mode both --output generated --report-json generated\greeblefs_kain_image_tools_report.json
D:\GreebleFS\toolchains\kain\payload\bin\kain.exe smoke.kn -t test
D:\GreebleFS\toolchains\kain\payload\bin\kain.exe smoke.kn -t interpret
```

Generated `outputs/`, `generated/`, and native library artifacts are ignored.

If the staged payload reports `Unknown identifier 'py_bridge_exec'`, rebuild/restage Kain from `D:/Kain-Lang`; this example requires the stdlib submodule import typechecker fix that lets `use std::python::bridge` expose its exported helpers during type checking.
