# Kain Image Converter C Runtime Lane

This lane is intentionally plugin-owned. It is the place for C ABI, DLL, SDK, and legacy codec bridges that Kain can orchestrate before anything graduates into a hardened Rust host command.

Current status: declared. The live byte-writing path is Python/Pillow; the C lane documents the native-codec growth point and provides a runnable Kain manifest for agents.

Smoke:

```powershell
D:\GreebleFS\toolchains\kain\payload\bin\kain.exe run D:\GreebleFS\usr\plugins-kain\kain-image-converter\plugin.runtime\c-runtime\image_converter_c_runtime_bridge.kn
```
