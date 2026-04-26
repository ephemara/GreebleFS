from __future__ import annotations

import json
import os
import sys
import traceback
from pathlib import Path
from typing import Any

from .actions import (
    PythonActionContext,
    dispatch_python_action,
    list_python_actions,
    register_builtin_actions,
)


MANIFEST_FILENAME = "greeblefs-python-sidecar.json"


def _runtime_root() -> Path:
    value = os.environ.get("GREEBLEFS_PYTHON_RUNTIME_ROOT", "").strip()
    if value:
        return Path(value).expanduser().resolve()
    return Path.cwd().resolve()


def _workspace_root() -> Path:
    value = os.environ.get("GREEBLEFS_PYTHON_SIDECAR_ROOT", "").strip()
    if value:
        return Path(value).expanduser().resolve()
    return Path(__file__).resolve().parent.parent


def _load_manifest() -> dict[str, Any]:
    manifest_path = _workspace_root() / MANIFEST_FILENAME
    return json.loads(manifest_path.read_text(encoding="utf-8"))


def _json_default(value: Any) -> Any:
    if isinstance(value, Path):
        return str(value)
    return str(value)


def _emit(payload: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(payload, ensure_ascii=False, default=_json_default))
    sys.stdout.write("\n")
    sys.stdout.flush()


def _response(
    request_id: str,
    *,
    ok: bool,
    result_json: str | None = None,
    output_artifacts: list[dict[str, Any]] | None = None,
    resource_handles: list[dict[str, Any]] | None = None,
    error: str | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "requestId": request_id,
        "ok": ok,
    }
    if result_json is not None:
        payload["resultJson"] = result_json
    if output_artifacts is not None:
        payload["outputArtifacts"] = output_artifacts
    if resource_handles is not None:
        payload["resourceHandles"] = resource_handles
    if error is not None:
        payload["error"] = error
    return payload


def _normalize_descriptor_list(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)]


def _unwrap_action_result(result: Any) -> tuple[Any, list[dict[str, Any]], list[dict[str, Any]]]:
    if not isinstance(result, dict):
        return result, [], []

    if (
        "result" not in result
        and "outputArtifacts" not in result
        and "resourceHandles" not in result
    ):
        return result, [], []

    return (
        result.get("result"),
        _normalize_descriptor_list(result.get("outputArtifacts")),
        _normalize_descriptor_list(result.get("resourceHandles")),
    )


def _handle_handshake(request_id: str) -> dict[str, Any]:
    manifest = _load_manifest()
    payload = {
        "manifestId": manifest.get("id"),
        "displayName": manifest.get("displayName"),
        "moduleName": manifest.get("moduleName"),
        "entryModule": manifest.get("entryModule"),
        "transport": manifest.get("transport"),
        "guidePath": manifest.get("guidePath"),
        "availableActions": list_python_actions(),
        "pythonVersion": sys.version.split()[0],
        "executable": sys.executable,
    }
    return _response(request_id, ok=True, result_json=json.dumps(payload, ensure_ascii=False))


def _handle_action(request: dict[str, Any]) -> dict[str, Any]:
    request_id = str(request.get("requestId") or "")
    action_id = str(request.get("actionId") or "").strip()
    if not action_id:
        return _response(request_id, ok=False, error="Missing sidecar action id.")

    payload_json = request.get("payloadJson")
    payload = json.loads(payload_json) if isinstance(payload_json, str) and payload_json.strip() else None

    cwd_value = request.get("cwd")
    if isinstance(cwd_value, str) and cwd_value.strip():
        cwd = Path(cwd_value).expanduser().resolve()
    else:
        cwd = Path.cwd().resolve()

    environment = request.get("environment")
    environment_dict = environment if isinstance(environment, dict) else {}
    input_artifacts = _normalize_descriptor_list(request.get("inputArtifacts"))
    resource_handles = _normalize_descriptor_list(request.get("resourceHandles"))
    context = PythonActionContext(
        action_id=action_id,
        runtime_root=_runtime_root(),
        workspace_root=_workspace_root(),
        cwd=cwd,
        environment={str(key): str(value) for key, value in environment_dict.items()},
        input_artifacts=input_artifacts,
        resource_handles=resource_handles,
    )

    raw_result = dispatch_python_action(action_id, payload, context)
    result, output_artifacts, returned_resource_handles = _unwrap_action_result(raw_result)
    return _response(
        request_id,
        ok=True,
        result_json=json.dumps(result, ensure_ascii=False, default=_json_default),
        output_artifacts=output_artifacts,
        resource_handles=returned_resource_handles,
    )


def _handle_request(raw_line: str) -> tuple[dict[str, Any], bool]:
    request = json.loads(raw_line)
    request_id = str(request.get("requestId") or "")
    kind = str(request.get("kind") or "action").strip().lower()

    if kind == "handshake":
        return _handle_handshake(request_id), False
    if kind == "shutdown":
        return _response(request_id, ok=True, result_json=json.dumps({"stopped": True})), True
    return _handle_action(request), False


def run_stdio_sidecar() -> int:
    register_builtin_actions()

    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue

        try:
            response, should_exit = _handle_request(line)
        except Exception as error:  # pragma: no cover - runtime-specific
            request_id = ""
            try:
                request_id = str(json.loads(line).get("requestId") or "")
            except Exception:
                request_id = ""

            response = _response(
                request_id,
                ok=False,
                error=f"{error}\n{traceback.format_exc()}",
            )
            should_exit = False

        _emit(response)
        if should_exit:
            return 0

    return 0
