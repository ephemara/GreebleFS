# greeblefs-go

First-party Go SDK for the GreebleFS universal polyglot runtime pipeline.

## Subpackages

- `ipc`     — stdio JSON-lines protocol shared with the host's `ExternalSidecarManager`.
- `runtime` — high-level helpers for `native-sidecar` and `native-command` runtimes.
- `hostapi` — typed access to the host bridge (`callRuntimeAction`, storage, events) when running as a `wasm-panel`.
- `panel`   — DOM mount helpers for `wasm-panel` runtimes that render against `syscall/js`.

Host-side: see `src-tauri/src/runtime_pipeline/`.
