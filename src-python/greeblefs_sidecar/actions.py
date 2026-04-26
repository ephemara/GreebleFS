from __future__ import annotations

import hashlib
import importlib
import importlib.util
import os
import platform
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

from .model_management import (
    build_model_cache_summary,
    local_model_catalog_status_action,
    prewarm_local_model_action,
)
from .cutout_runtime import (
    image_cutout_apply_prompts_action,
    image_cutout_close_session_action,
    image_cutout_open_session_action,
    image_cutout_reset_session_action,
    image_cutout_stage_export_action,
)
from .semantic_search_runtime import (
    semantic_delete_index_action,
    semantic_find_similar_file_action,
    semantic_index_root_action,
    semantic_index_status_action,
    semantic_query_index_action,
)


@dataclass(frozen=True)
class PythonActionContext:
    action_id: str
    runtime_root: Path
    workspace_root: Path
    cwd: Path
    environment: dict[str, str]
    input_artifacts: list[dict[str, Any]] = field(default_factory=list)
    resource_handles: list[dict[str, Any]] = field(default_factory=list)


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


def _module_version(module: Any) -> str | None:
    return getattr(module, "__version__", None)


def _optional_module_probe(module_name: str) -> dict[str, Any]:
    installed = _module_installed(module_name)
    result: dict[str, Any] = {
        "id": module_name,
        "installed": installed,
        "imported": None,
        "importError": None,
        "version": None,
    }
    if not installed:
        return result

    imported, error, module = _safe_import(module_name)
    result["imported"] = imported
    result["importError"] = error
    if imported and module is not None:
        result["version"] = _module_version(module)
    return result


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


@python_action("acceleration.cuda_probe")
def acceleration_cuda_probe_action(payload: Any, context: PythonActionContext) -> dict[str, Any]:
    _ = payload
    _ = context

    torch_info: dict[str, Any] = {
        "installed": _module_installed("torch"),
        "imported": None,
        "importError": None,
        "version": None,
        "cudaAvailable": None,
        "cudaVersion": None,
        "cudnnAvailable": None,
        "deviceCount": None,
        "devices": [],
    }
    if torch_info["installed"]:
        imported, error, module = _safe_import("torch")
        torch_info["imported"] = imported
        torch_info["importError"] = error
        if imported and module is not None:
            torch_info["version"] = _module_version(module)
            cuda = getattr(module, "cuda", None)
            if cuda is not None:
                cuda_available = bool(cuda.is_available())
                torch_info["cudaAvailable"] = cuda_available
                torch_info["cudaVersion"] = getattr(getattr(module, "version", None), "cuda", None)
                backends = getattr(module, "backends", None)
                cudnn = getattr(backends, "cudnn", None) if backends is not None else None
                torch_info["cudnnAvailable"] = bool(cudnn and cudnn.is_available())

                if cuda_available:
                    try:
                        device_count = int(cuda.device_count())
                    except Exception as device_count_error:  # pragma: no cover - runtime-specific
                        device_count = 0
                        torch_info["importError"] = (
                            f"{torch_info['importError'] or ''} device_count failed: {device_count_error}"
                        ).strip()

                    torch_info["deviceCount"] = device_count
                    devices: list[dict[str, Any]] = []
                    for index in range(device_count):
                        try:
                            capability = cuda.get_device_capability(index)
                            capability_label = ".".join(str(part) for part in capability)
                        except Exception:  # pragma: no cover - runtime-specific
                            capability_label = None
                        try:
                            props = cuda.get_device_properties(index)
                            total_memory = int(getattr(props, "total_memory", 0) or 0)
                        except Exception:  # pragma: no cover - runtime-specific
                            total_memory = None
                        try:
                            name = str(cuda.get_device_name(index))
                        except Exception:  # pragma: no cover - runtime-specific
                            name = f"cuda:{index}"
                        devices.append(
                            {
                                "index": index,
                                "name": name,
                                "capability": capability_label,
                                "totalMemoryBytes": total_memory,
                            }
                        )
                    torch_info["devices"] = devices

    onnxruntime_info: dict[str, Any] = {
        "installed": _module_installed("onnxruntime"),
        "imported": None,
        "importError": None,
        "availableProviders": None,
        "providerError": None,
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

    optional_modules = [
        _optional_module_probe("numpy"),
        _optional_module_probe("PIL"),
        _optional_module_probe("sentence_transformers"),
        _optional_module_probe("transformers"),
        _optional_module_probe("tokenizers"),
        _optional_module_probe("optimum"),
        _optional_module_probe("faiss"),
    ]

    return {
        "pythonVersion": sys.version.split()[0],
        "platform": platform.platform(),
        "cudaVisibleDevices": os.environ.get("CUDA_VISIBLE_DEVICES"),
        "cudaHome": os.environ.get("CUDA_HOME"),
        "cudaPath": os.environ.get("CUDA_PATH"),
        "torch": torch_info,
        "onnxruntime": onnxruntime_info,
        "optionalModules": optional_modules,
    }


@python_action("models.catalog_status")
def models_catalog_status_action(payload: Any, context: PythonActionContext) -> dict[str, Any]:
    return local_model_catalog_status_action(payload, context)


@python_action("models.cache_summary")
def models_cache_summary_action(payload: Any, context: PythonActionContext) -> dict[str, Any]:
    _ = payload
    return build_model_cache_summary(context)


@python_action("models.prewarm")
def models_prewarm_action(payload: Any, context: PythonActionContext) -> dict[str, Any]:
    return prewarm_local_model_action(payload, context)


@python_action("image.cutout_open_session")
def image_cutout_open_session_registered_action(
    payload: Any,
    context: PythonActionContext,
) -> dict[str, Any]:
    return image_cutout_open_session_action(payload, context)


@python_action("image.cutout_apply_prompts")
def image_cutout_apply_prompts_registered_action(
    payload: Any,
    context: PythonActionContext,
) -> dict[str, Any]:
    return image_cutout_apply_prompts_action(payload, context)


@python_action("image.cutout_reset_session")
def image_cutout_reset_session_registered_action(
    payload: Any,
    context: PythonActionContext,
) -> dict[str, Any]:
    return image_cutout_reset_session_action(payload, context)


@python_action("image.cutout_stage_export")
def image_cutout_stage_export_registered_action(
    payload: Any,
    context: PythonActionContext,
) -> dict[str, Any]:
    return image_cutout_stage_export_action(payload, context)


@python_action("image.cutout_close_session")
def image_cutout_close_session_registered_action(
    payload: Any,
    context: PythonActionContext,
) -> dict[str, Any]:
    return image_cutout_close_session_action(payload, context)


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


@python_action("semantic.index_root")
def semantic_index_root_registered_action(
    payload: Any,
    context: PythonActionContext,
) -> dict[str, Any]:
    return semantic_index_root_action(payload, context)


@python_action("semantic.query_index")
def semantic_query_index_registered_action(
    payload: Any,
    context: PythonActionContext,
) -> dict[str, Any]:
    return semantic_query_index_action(payload, context)


@python_action("semantic.find_similar_file")
def semantic_find_similar_file_registered_action(
    payload: Any,
    context: PythonActionContext,
) -> dict[str, Any]:
    return semantic_find_similar_file_action(payload, context)


@python_action("semantic.delete_index")
def semantic_delete_index_registered_action(
    payload: Any,
    context: PythonActionContext,
) -> dict[str, Any]:
    return semantic_delete_index_action(payload, context)


@python_action("semantic.index_status")
def semantic_index_status_registered_action(
    payload: Any,
    context: PythonActionContext,
) -> dict[str, Any]:
    return semantic_index_status_action(payload, context)


def register_builtin_actions() -> None:
    # Import-time decorators already populate the registry. This function exists so
    # callers have an explicit bootstrap hook and a stable import target.
    return None
