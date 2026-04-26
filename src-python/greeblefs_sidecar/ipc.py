from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING, Any, Iterable

if TYPE_CHECKING:
    from .actions import PythonActionContext


def _normalize_retention(value: Any) -> str:
    text = str(value or "ephemeral").strip().lower()
    return "persistent" if text == "persistent" else "ephemeral"


def _artifact_dicts(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)]


def find_input_artifact(
    context: "PythonActionContext",
    *,
    artifact_id: str | None = None,
    kind: str | None = None,
) -> dict[str, Any] | None:
    normalized_id = str(artifact_id or "").strip()
    normalized_kind = str(kind or "").strip()

    for artifact in _artifact_dicts(context.input_artifacts):
        candidate_id = str(artifact.get("id") or "").strip()
        candidate_kind = str(artifact.get("kind") or "").strip()
        if normalized_id and candidate_id != normalized_id:
            continue
        if normalized_kind and candidate_kind != normalized_kind:
            continue
        return artifact
    return None


def resolve_input_artifact_path(
    context: "PythonActionContext",
    *,
    artifact_id: str | None = None,
    kind: str | None = None,
) -> Path | None:
    artifact = find_input_artifact(context, artifact_id=artifact_id, kind=kind)
    if artifact is None:
        return None

    file_path = str(artifact.get("filePath") or "").strip()
    if not file_path:
        return None
    return Path(file_path).expanduser().resolve()


def require_input_artifact_path(
    context: "PythonActionContext",
    *,
    artifact_id: str | None = None,
    kind: str | None = None,
) -> Path:
    artifact_path = resolve_input_artifact_path(
        context,
        artifact_id=artifact_id,
        kind=kind,
    )
    if artifact_path is None:
        expected_label = artifact_id or kind or "artifact"
        raise FileNotFoundError(f"Required Python sidecar input artifact was not found: {expected_label}")
    if not artifact_path.exists() or not artifact_path.is_file():
        raise FileNotFoundError(f"Python sidecar input artifact path was not found: {artifact_path}")
    return artifact_path


def build_output_artifact_candidate(
    *,
    token: str | None = None,
    kind: str,
    file_path: str | Path,
    media_type: str | None = None,
    retention: str = "ephemeral",
    identity_key: str | None = None,
    content_revision: str | None = None,
    delete_on_release: bool | None = None,
) -> dict[str, Any]:
    normalized_retention = _normalize_retention(retention)
    should_delete_on_release = (
        normalized_retention == "ephemeral"
        if delete_on_release is None
        else bool(delete_on_release)
    )
    return {
        "token": str(token).strip() if token is not None and str(token).strip() else None,
        "kind": kind,
        "filePath": str(Path(file_path).expanduser().resolve()),
        "mediaType": media_type,
        "retention": normalized_retention,
        "identityKey": identity_key,
        "contentRevision": content_revision,
        "deleteOnRelease": should_delete_on_release,
    }


def delete_existing_paths(paths: Iterable[Path]) -> None:
    for path in paths:
        try:
            path.unlink(missing_ok=True)
        except Exception:
            continue
