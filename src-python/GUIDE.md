# GreebleFS Python Sidecar Guide

This folder is the source workspace for the managed Python sidecar used by GreebleFS.

## What It Gives You

- A persistent Python sidecar process that Rust owns and React can call through the typed Tauri bridge.
- A small in-process `pyo3` bridge for lightweight Python-in-Rust helpers.
- A clean place to add Python actions without scattering one-off scripts through the repo.
- A managed virtual environment path that can host ONNX Runtime, Torch, CUDA-adjacent tooling, or plain automation packages.

## Folder Layout

- `greeblefs-python-sidecar.json`
  The data-driven manifest for the sidecar module, package presets, and built-in actions.
- `greeblefs_sidecar/`
  The actual sidecar package and stdio JSON protocol host.
- `pyproject.toml`
  Minimal package metadata so the workspace is IDE- and tooling-friendly.

## React Usage

Use the frontend runtime seam instead of calling raw Tauri commands:

```ts
import {
  createPythonSidecarActionRunner,
  probePythonMlRuntime,
  scanDirectoryWithPython,
} from '@/runtime/pythonRuntimeBackend';

const hashPaths = createPythonSidecarActionRunner<
  { paths: string[]; algorithm?: string },
  { algorithm: string; entries: Array<{ path: string; digest: string }> }
>('files.hash_paths');

const mlStatus = await probePythonMlRuntime();
const directory = await scanDirectoryWithPython({ root: '/tmp', limit: 20 });
const hashes = await hashPaths({ paths: ['/tmp/a.txt', '/tmp/b.txt'] });
```

That path will bootstrap the managed env when needed, start the sidecar if it is not running, and JSON-decode the result for you.

## Rust Usage

Use the native helper layers instead of spawning ad hoc Python from random modules:

- `src-tauri/src/python_sidecar.rs`
  Persistent sidecar start/stop/call helpers for heavier work or workflows that want the managed venv.
- `src-tauri/src/python_pyo3.rs`
  Small in-process `pyo3` execution seam for lightweight snippets that are easier to run inside Rust.

Backend code should prefer:

1. `python_sidecar` for filesystem-heavy, ML-heavy, or dependency-heavy work.
2. `python_pyo3` for tiny pure-Python transforms where spinning up the sidecar would be unnecessary.

Rust callers now have typed helpers and built-in action ids, so they do not need to hand-roll JSON request structs:

```rust
use crate::python_sidecar::{self, action_ids};

let scan = python_sidecar::call_sidecar_action_json::<serde_json::Value, serde_json::Value>(
    &app,
    None,
    action_ids::FILES_SCAN_DIRECTORY,
    Some(serde_json::json!({
        "root": ".",
        "limit": 64,
        "includeHidden": false
    })),
    None,
    None,
    Some(true),
)?;

let entries = scan.result["entries"]
    .as_array()
    .map(|value| value.len())
    .unwrap_or(0);
```

For tiny helpers that should stay in-process:

```rust
use crate::python_pyo3;

let summary = python_pyo3::execute_embedded_python_json::<serde_json::Value, serde_json::Value>(
    "def main(payload): return {'count': len(payload['paths'])}",
    None,
    Some(serde_json::json!({
        "paths": ["/tmp/a.txt", "/tmp/b.txt"]
    })),
)?;
```

## Adding A New Sidecar Action

1. Create a new function under `greeblefs_sidecar/actions.py`.
2. Register it with `@python_action("your.action_id")`.
3. Add the action entry to `greeblefs-python-sidecar.json`.
4. Call it from React with `createPythonSidecarActionRunner(...)` or from Rust with `call_sidecar_action_json(...)`.

The action handler receives:

- `payload`: JSON-decoded request payload
- `context.runtime_root`: managed runtime root
- `context.workspace_root`: synced `src-python` root inside the managed runtime
- `context.cwd`: request working directory
- `context.environment`: request-scoped env overrides

Return plain JSON-serializable data only.

## ONNX, Torch, And CUDA

The sidecar does not hardcode heavyweight ML installs by default. That keeps bootstrap fast and avoids forcing every machine to download CUDA/Torch wheels up front.

Recommended flow:

1. Bootstrap the managed runtime.
2. Install the `ML Core` preset for CPU-first work.
3. Add machine-specific Torch/CUDA wheels from the Python panel or by calling `installManagedPythonPackages(...)`.
4. Run the built-in `ml.probe` action to verify what the sidecar can actually import on the current machine.

This keeps the Python lane flexible enough for:

- ONNX Runtime CPU or GPU builds
- Torch CPU or CUDA wheels
- file parsing or pipeline automation
- future per-feature Python actions inside the explorer and workbench

## Dev And Release Behavior

- In development, the Rust host prefers this repo folder as the source of truth and syncs it into the managed runtime before starting the sidecar.
- In installed builds, the synced managed copy is the source the sidecar runs from.

That means the runtime stays self-contained, but the repo still has a real `src-python` home for edits, review, and future expansion.
