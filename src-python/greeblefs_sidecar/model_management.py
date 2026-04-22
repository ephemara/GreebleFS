from __future__ import annotations

import importlib
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import TYPE_CHECKING, Any, Iterable

if TYPE_CHECKING:
    from .actions import PythonActionContext

LOCAL_MODEL_CATALOG_PATH = Path("src/config/localModelCatalog.json")
LOCAL_MODEL_CATALOG_CACHE: dict[str, dict[str, Any]] = {}


def load_local_model_catalog(context: PythonActionContext) -> dict[str, Any]:
    cache_key = str(context.workspace_root)
    cached = LOCAL_MODEL_CATALOG_CACHE.get(cache_key)
    if cached is not None:
        return cached

    catalog_path = (context.workspace_root / LOCAL_MODEL_CATALOG_PATH).resolve()
    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    LOCAL_MODEL_CATALOG_CACHE[cache_key] = catalog
    return catalog


def normalize_model_backend_preference(value: Any) -> str:
    if value in {"cpu", "onnx", "cuda"}:
        return str(value)
    return "auto"


def _catalog_cache_definition(catalog: dict[str, Any]) -> dict[str, Any]:
    cache_definition = catalog.get("cache")
    if isinstance(cache_definition, dict):
        return cache_definition
    return {}


def _resolve_cache_root(context: PythonActionContext) -> Path:
    catalog = load_local_model_catalog(context)
    cache_definition = _catalog_cache_definition(catalog)
    runtime_relative_root = str(cache_definition.get("runtimeRelativeRoot") or "cache/models")
    return (context.runtime_root / Path(runtime_relative_root)).resolve()


def resolve_model_cache_paths(context: PythonActionContext) -> dict[str, Path]:
    catalog = load_local_model_catalog(context)
    cache_definition = _catalog_cache_definition(catalog)
    cache_root = _resolve_cache_root(context)
    huggingface_root = cache_root / str(cache_definition.get("huggingFaceDirectoryName") or "huggingface")
    registry_root = cache_root / str(cache_definition.get("registryDirectoryName") or "registry")
    return {
        "cache_root": cache_root,
        "huggingface_root": huggingface_root,
        "registry_root": registry_root,
    }


def configure_shared_model_cache(context: PythonActionContext) -> dict[str, Path]:
    paths = resolve_model_cache_paths(context)
    paths["cache_root"].mkdir(parents=True, exist_ok=True)
    paths["huggingface_root"].mkdir(parents=True, exist_ok=True)
    paths["registry_root"].mkdir(parents=True, exist_ok=True)

    os.environ["HF_HOME"] = str(paths["huggingface_root"])
    os.environ["HUGGINGFACE_HUB_CACHE"] = str(paths["huggingface_root"] / "hub")
    os.environ["TRANSFORMERS_CACHE"] = str(paths["huggingface_root"] / "transformers")
    os.environ["SENTENCE_TRANSFORMERS_HOME"] = str(paths["huggingface_root"] / "sentence-transformers")
    return paths


def import_module(module_name: str) -> Any:
    return importlib.import_module(module_name)


def torch_cuda_available() -> bool:
    try:
        torch = import_module("torch")
        return bool(getattr(torch, "cuda", None) and torch.cuda.is_available())
    except Exception:
        return False


def onnxruntime_available_providers() -> list[str]:
    try:
        onnxruntime = import_module("onnxruntime")
        return list(onnxruntime.get_available_providers())
    except Exception:
        return []


def preferred_onnx_provider(
    provider_preference: Iterable[str],
    *,
    cpu_only: bool,
) -> str | None:
    available = onnxruntime_available_providers()
    if not available:
        return None

    for provider_name in provider_preference:
        if cpu_only and provider_name != "CPUExecutionProvider":
            continue
        if not cpu_only and provider_name == "CPUExecutionProvider":
            continue
        if provider_name in available:
            return provider_name

    if cpu_only and "CPUExecutionProvider" in available:
        return "CPUExecutionProvider"
    return None


def _catalog_models(catalog: dict[str, Any]) -> list[dict[str, Any]]:
    raw_models = catalog.get("models")
    if isinstance(raw_models, list):
        return [entry for entry in raw_models if isinstance(entry, dict)]
    return []


def _catalog_capabilities(catalog: dict[str, Any]) -> list[dict[str, Any]]:
    raw_capabilities = catalog.get("capabilities")
    if isinstance(raw_capabilities, list):
        return [entry for entry in raw_capabilities if isinstance(entry, dict)]
    return []


def _find_catalog_model(catalog: dict[str, Any], model_id: str) -> dict[str, Any] | None:
    trimmed_model_id = model_id.strip()
    if not trimmed_model_id:
        return None

    for model in _catalog_models(catalog):
        if str(model.get("id") or "").strip() == trimmed_model_id:
            return model
        if str(model.get("providerModelId") or "").strip() == trimmed_model_id:
            return model
    return None


def _find_capability(catalog: dict[str, Any], capability_id: str | None) -> dict[str, Any] | None:
    if not capability_id:
        return None
    trimmed_capability_id = capability_id.strip()
    if not trimmed_capability_id:
        return None
    for capability in _catalog_capabilities(catalog):
        if str(capability.get("id") or "").strip() == trimmed_capability_id:
            return capability
    return None


def resolve_model_descriptor(
    context: PythonActionContext,
    *,
    model_id: str | None = None,
    capability_id: str | None = None,
    fallback_provider_model_id: str | None = None,
    fallback_family: str = "sentence-transformer",
) -> dict[str, Any]:
    catalog = load_local_model_catalog(context)

    model_entry: dict[str, Any] | None = None
    if model_id:
        model_entry = _find_catalog_model(catalog, model_id)

    if model_entry is None:
        capability_entry = _find_capability(catalog, capability_id)
        capability_default_model_id = str(capability_entry.get("defaultModelId") or "").strip() if capability_entry else ""
        if capability_default_model_id:
            model_entry = _find_catalog_model(catalog, capability_default_model_id)

    if model_entry is not None:
        return {
            "modelId": str(model_entry.get("id") or "").strip() or str(model_entry.get("providerModelId") or "").strip(),
            "providerModelId": str(model_entry.get("providerModelId") or "").strip(),
            "label": str(model_entry.get("label") or model_entry.get("id") or "Model"),
            "family": str(model_entry.get("family") or fallback_family),
            "hardwareProfileId": str(model_entry.get("hardwareProfileId") or "").strip() or None,
            "capabilityIds": [
                str(capability).strip()
                for capability in model_entry.get("capabilityIds", [])
                if str(capability).strip()
            ],
        }

    fallback_provider = (fallback_provider_model_id or model_id or "").strip()
    if fallback_provider:
        return {
            "modelId": fallback_provider,
            "providerModelId": fallback_provider,
            "label": fallback_provider,
            "family": fallback_family,
            "hardwareProfileId": None,
            "capabilityIds": [capability_id] if capability_id else [],
        }

    raise ValueError("Unable to resolve a local model descriptor.")


def _normalize_registry_file_id(model_id: str) -> str:
    return re.sub(r"[^a-zA-Z0-9._-]+", "_", model_id).strip("._-") or "model"


def _registry_file_path(context: PythonActionContext, model_id: str) -> Path:
    paths = configure_shared_model_cache(context)
    return paths["registry_root"] / f"{_normalize_registry_file_id(model_id)}.json"


def read_model_registry_entries(context: PythonActionContext) -> dict[str, dict[str, Any]]:
    registry_root = configure_shared_model_cache(context)["registry_root"]
    entries: dict[str, dict[str, Any]] = {}
    for path in sorted(registry_root.glob("*.json")):
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        model_id = str(payload.get("modelId") or "").strip()
        if not model_id:
            continue
        entries[model_id] = payload
    return entries


def _write_model_registry_entry(
    context: PythonActionContext,
    payload: dict[str, Any],
) -> None:
    model_id = str(payload.get("modelId") or "").strip()
    if not model_id:
        raise ValueError("Registry payload requires a modelId.")

    path = _registry_file_path(context, model_id)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")


def mark_model_registry_ready(
    context: PythonActionContext,
    descriptor: dict[str, Any],
    *,
    backend_kind: str,
    provider_kind: str,
    capability_id: str | None = None,
) -> None:
    now_ms = int(time.time() * 1000)
    entries = read_model_registry_entries(context)
    current = entries.get(str(descriptor["modelId"])) or {}
    backend_kinds = sorted({
        *(str(value) for value in current.get("backendKinds", []) if str(value).strip()),
        backend_kind,
    })
    provider_kinds = sorted({
        *(str(value) for value in current.get("providerKinds", []) if str(value).strip()),
        provider_kind,
    })
    capability_ids = sorted({
        *(str(value) for value in current.get("capabilityIds", []) if str(value).strip()),
        *(str(value) for value in descriptor.get("capabilityIds", []) if str(value).strip()),
        capability_id.strip() if isinstance(capability_id, str) and capability_id.strip() else "",
    } - {""})

    _write_model_registry_entry(
        context,
        {
            "schemaVersion": 1,
            "modelId": descriptor["modelId"],
            "providerModelId": descriptor["providerModelId"],
            "label": descriptor.get("label"),
            "family": descriptor.get("family"),
            "hardwareProfileId": descriptor.get("hardwareProfileId"),
            "capabilityIds": capability_ids,
            "backendKinds": backend_kinds,
            "providerKinds": provider_kinds,
            "lastWarmedAtMs": now_ms,
            "lastUsedAtMs": now_ms,
            "lastError": None,
        },
    )


def touch_model_registry_usage(
    context: PythonActionContext,
    descriptor: dict[str, Any],
) -> None:
    entries = read_model_registry_entries(context)
    current = entries.get(str(descriptor["modelId"]))
    if current is None:
        return

    current["lastUsedAtMs"] = int(time.time() * 1000)
    _write_model_registry_entry(context, current)


def record_model_registry_error(
    context: PythonActionContext,
    descriptor: dict[str, Any],
    error: str,
) -> None:
    entries = read_model_registry_entries(context)
    current = entries.get(str(descriptor["modelId"])) or {
        "schemaVersion": 1,
        "modelId": descriptor["modelId"],
        "providerModelId": descriptor["providerModelId"],
        "label": descriptor.get("label"),
        "family": descriptor.get("family"),
        "hardwareProfileId": descriptor.get("hardwareProfileId"),
        "capabilityIds": descriptor.get("capabilityIds", []),
        "backendKinds": [],
        "providerKinds": [],
        "lastWarmedAtMs": None,
        "lastUsedAtMs": None,
    }
    current["lastError"] = error
    _write_model_registry_entry(context, current)


def directory_size_bytes(path: Path) -> int:
    if not path.exists():
        return 0

    total = 0
    for child in path.rglob("*"):
        try:
            if child.is_file():
                total += int(child.stat().st_size)
        except OSError:
            continue
    return total


def build_model_cache_summary(context: PythonActionContext) -> dict[str, Any]:
    paths = configure_shared_model_cache(context)
    registry_entries = read_model_registry_entries(context)
    return {
        "pythonVersion": sys.version.split()[0],
        "cacheRoot": str(paths["cache_root"]),
        "huggingFaceCacheRoot": str(paths["huggingface_root"]),
        "registryRoot": str(paths["registry_root"]),
        "totalCacheSizeBytes": directory_size_bytes(paths["cache_root"]),
        "installedModelCount": len(registry_entries),
    }


def local_model_catalog_status_action(
    payload: Any,
    context: PythonActionContext,
) -> dict[str, Any]:
    _ = payload
    catalog = load_local_model_catalog(context)
    registry_entries = read_model_registry_entries(context)
    cache_summary = build_model_cache_summary(context)

    models = []
    for model in _catalog_models(catalog):
        model_id = str(model.get("id") or "").strip()
        if not model_id:
            continue
        registry_entry = registry_entries.get(model_id)
        models.append(
            {
                "modelId": model_id,
                "installed": registry_entry is not None,
                "backendKinds": list(registry_entry.get("backendKinds", [])) if registry_entry else [],
                "providerKinds": list(registry_entry.get("providerKinds", [])) if registry_entry else [],
                "lastWarmedAtMs": registry_entry.get("lastWarmedAtMs") if registry_entry else None,
                "lastUsedAtMs": registry_entry.get("lastUsedAtMs") if registry_entry else None,
                "lastError": registry_entry.get("lastError") if registry_entry else None,
            }
        )

    return {
        **cache_summary,
        "models": models,
    }


def prewarm_local_model_action(
    payload: Any,
    context: PythonActionContext,
) -> dict[str, Any]:
    payload_dict = payload if isinstance(payload, dict) else {}
    requested_model_id = payload_dict.get("modelId")
    capability_id = payload_dict.get("capabilityId")
    backend_preference = normalize_model_backend_preference(payload_dict.get("backendPreference"))
    descriptor = resolve_model_descriptor(
        context,
        model_id=str(requested_model_id).strip() if isinstance(requested_model_id, str) else None,
        capability_id=str(capability_id).strip() if isinstance(capability_id, str) else None,
    )
    configure_shared_model_cache(context)

    provider_preference = [
        "TensorrtExecutionProvider",
        "CUDAExecutionProvider",
        "CPUExecutionProvider",
    ]

    attempts: list[tuple[str, str]] = []
    if backend_preference == "cuda":
        onnx_gpu_provider = preferred_onnx_provider(provider_preference, cpu_only=False)
        if onnx_gpu_provider is not None:
            attempts.append(("onnx", onnx_gpu_provider))
        if torch_cuda_available():
            attempts.append(("torch", "cuda"))
        attempts.append(("onnx", "CPUExecutionProvider"))
        attempts.append(("torch", "cpu"))
    elif backend_preference == "onnx":
        attempts.append(("onnx", "CPUExecutionProvider"))
        onnx_gpu_provider = preferred_onnx_provider(provider_preference, cpu_only=False)
        if onnx_gpu_provider is not None:
            attempts.append(("onnx", onnx_gpu_provider))
        attempts.append(("torch", "cpu"))
    elif backend_preference == "cpu":
        attempts.append(("torch", "cpu"))
        attempts.append(("onnx", "CPUExecutionProvider"))
    else:
        onnx_gpu_provider = preferred_onnx_provider(provider_preference, cpu_only=False)
        if onnx_gpu_provider is not None:
            attempts.append(("onnx", onnx_gpu_provider))
        if torch_cuda_available():
            attempts.append(("torch", "cuda"))
        attempts.append(("onnx", "CPUExecutionProvider"))
        attempts.append(("torch", "cpu"))

    errors: list[str] = []
    for backend_kind, provider_name in attempts:
        try:
            if descriptor.get("family") != "sentence-transformer":
                raise RuntimeError(
                    f"Model family '{descriptor.get('family')}' is not prewarmable yet."
                )

            transformers = import_module("transformers")
            _ = transformers.AutoTokenizer.from_pretrained(descriptor["providerModelId"])

            if backend_kind == "onnx":
                optimum_onnxruntime = import_module("optimum.onnxruntime")
                _ = optimum_onnxruntime.ORTModelForFeatureExtraction.from_pretrained(
                    descriptor["providerModelId"],
                    export=True,
                    provider=provider_name,
                )
            else:
                torch = import_module("torch")
                model = transformers.AutoModel.from_pretrained(descriptor["providerModelId"])
                device = "cuda" if provider_name == "cuda" else "cpu"
                model.to(device)
                model.eval()
                _ = torch

            provider_kind = (
                "cudaPython"
                if provider_name == "cuda" or provider_name != "CPUExecutionProvider" and backend_kind == "onnx"
                else "cpu"
            )
            mark_model_registry_ready(
                context,
                descriptor,
                backend_kind=backend_kind,
                provider_kind=provider_kind,
                capability_id=str(capability_id).strip() if isinstance(capability_id, str) else None,
            )
            cache_summary = build_model_cache_summary(context)
            return {
                **cache_summary,
                "modelId": descriptor["modelId"],
                "providerModelId": descriptor["providerModelId"],
                "backendKind": backend_kind,
                "providerKind": provider_kind,
                "backendPreference": backend_preference,
                "message": f"Prewarmed {descriptor['label']} via {backend_kind}/{provider_kind}.",
            }
        except Exception as error:
            errors.append(f"{backend_kind}:{provider_name} -> {error}")

    error_message = " | ".join(errors) if errors else "No valid backend attempt was available."
    record_model_registry_error(context, descriptor, error_message)
    raise RuntimeError(
        "Unable to prewarm the requested local model. " + error_message
    )
