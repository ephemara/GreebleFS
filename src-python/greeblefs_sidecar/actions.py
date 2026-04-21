from __future__ import annotations

import hashlib
import importlib
import importlib.util
import os
import platform
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable


@dataclass(frozen=True)
class PythonActionContext:
    action_id: str
    runtime_root: Path
    workspace_root: Path
    cwd: Path
    environment: dict[str, str]


PythonActionHandler = Callable[[Any, PythonActionContext], Any]
_REGISTRY: dict[str, PythonActionHandler] = {}


def python_action(action_id: str) -> Callable[[PythonActionHandler], PythonActionHandler]:
    def decorator(handler: PythonActionHandler) -> PythonActionHandler:
        _REGISTRY[action_id] = handler
        return handler

    return decorator


def dispatch_python_action(
    action_id: str,
    payload: Any,
    context: PythonActionContext,
) -> Any:
    handler = _REGISTRY.get(action_id)
    if handler is None:
        raise KeyError(f"Unknown Python sidecar action: {action_id}")
    return handler(payload, context)


def list_python_actions() -> list[str]:
    return sorted(_REGISTRY)


def _payload_dict(payload: Any) -> dict[str, Any]:
    if isinstance(payload, dict):
        return payload
    return {}


def _module_installed(module_name: str) -> bool:
    return importlib.util.find_spec(module_name) is not None


def _safe_import(module_name: str) -> tuple[bool, str | None, Any | None]:
    try:
        module = importlib.import_module(module_name)
        return True, None, module
    except Exception as error:  # pragma: no cover - runtime-specific
        return False, str(error), None


@python_action("runtime.summary")
def runtime_summary_action(payload: Any, context: PythonActionContext) -> dict[str, Any]:
    _ = payload
    return {
        "pythonVersion": sys.version.split()[0],
        "executable": sys.executable,
        "platform": platform.platform(),
        "cwd": str(context.cwd),
        "runtimeRoot": str(context.runtime_root),
        "workspaceRoot": str(context.workspace_root),
        "environmentKeys": sorted(context.environment),
        "availableActions": list_python_actions(),
    }


@python_action("ml.probe")
def ml_probe_action(payload: Any, context: PythonActionContext) -> dict[str, Any]:
    _ = payload
    _ = context

    torch_info: dict[str, Any] = {
        "installed": _module_installed("torch"),
    }
    if torch_info["installed"]:
        imported, error, module = _safe_import("torch")
        torch_info["imported"] = imported
        torch_info["importError"] = error
        if imported and module is not None:
            cuda = getattr(module, "cuda", None)
            cuda_available = bool(cuda and cuda.is_available())
            torch_info["version"] = getattr(module, "__version__", None)
            torch_info["cudaAvailable"] = cuda_available
            torch_info["cudaVersion"] = getattr(getattr(module, "version", None), "cuda", None)
            torch_info["mpsAvailable"] = bool(
                getattr(getattr(module, "backends", None), "mps", None)
                and module.backends.mps.is_available()
            )

    onnxruntime_info: dict[str, Any] = {
        "installed": _module_installed("onnxruntime"),
    }
    if onnxruntime_info["installed"]:
        imported, error, module = _safe_import("onnxruntime")
        onnxruntime_info["imported"] = imported
        onnxruntime_info["importError"] = error
        if imported and module is not None:
            try:
                onnxruntime_info["availableProviders"] = list(module.get_available_providers())
            except Exception as provider_error:  # pragma: no cover - runtime-specific
                onnxruntime_info["providerError"] = str(provider_error)

    return {
        "pythonVersion": sys.version.split()[0],
        "onnxInstalled": _module_installed("onnx"),
        "onnxruntime": onnxruntime_info,
        "torch": torch_info,
        "cudaVisibleDevices": os.environ.get("CUDA_VISIBLE_DEVICES"),
    }


@python_action("files.scan_directory")
def scan_directory_action(payload: Any, context: PythonActionContext) -> dict[str, Any]:
    payload_dict = _payload_dict(payload)
    root_value = payload_dict.get("root")
    limit = int(payload_dict.get("limit", 50) or 50)
    include_hidden = bool(payload_dict.get("includeHidden", False))
    limit = max(1, min(limit, 1000))

    root = Path(root_value).expanduser() if isinstance(root_value, str) and root_value.strip() else context.cwd
    root = root.resolve()

    entries: list[dict[str, Any]] = []
    truncated = False
    for child in sorted(root.iterdir(), key=lambda entry: (not entry.is_dir(), entry.name.lower())):
        if not include_hidden and child.name.startswith("."):
            continue

        stat = child.stat()
        entries.append(
            {
                "name": child.name,
                "path": str(child),
                "isDir": child.is_dir(),
                "sizeBytes": None if child.is_dir() else stat.st_size,
                "modifiedAtEpochMs": int(stat.st_mtime * 1000),
            }
        )
        if len(entries) >= limit:
            truncated = True
            break

    return {
        "root": str(root),
        "count": len(entries),
        "truncated": truncated,
        "entries": entries,
    }


@python_action("files.hash_paths")
def hash_paths_action(payload: Any, context: PythonActionContext) -> dict[str, Any]:
    payload_dict = _payload_dict(payload)
    raw_paths = payload_dict.get("paths")
    if not isinstance(raw_paths, list) or not raw_paths:
        raise ValueError("files.hash_paths requires a non-empty 'paths' array.")

    algorithm = str(payload_dict.get("algorithm") or "sha256").strip().lower()
    chunk_size = int(payload_dict.get("chunkSize", 1024 * 1024) or 1024 * 1024)
    chunk_size = max(4096, min(chunk_size, 8 * 1024 * 1024))

    if not hasattr(hashlib, algorithm):
        raise ValueError(f"Unsupported hash algorithm: {algorithm}")

    entries: list[dict[str, Any]] = []
    for raw_path in raw_paths:
        if not isinstance(raw_path, str) or not raw_path.strip():
            continue

        path = Path(raw_path).expanduser()
        if not path.is_absolute():
            path = (context.cwd / path).resolve()
        else:
            path = path.resolve()

        digest = getattr(hashlib, algorithm)()
        with path.open("rb") as handle:
            while True:
                chunk = handle.read(chunk_size)
                if not chunk:
                    break
                digest.update(chunk)

        entries.append(
            {
                "path": str(path),
                "algorithm": algorithm,
                "digest": digest.hexdigest(),
            }
        )

    return {
        "algorithm": algorithm,
        "entries": entries,
    }


def register_builtin_actions() -> None:
    # Import-time decorators already populate the registry. This function exists so
    # callers have an explicit bootstrap hook and a stable import target.
    return None
