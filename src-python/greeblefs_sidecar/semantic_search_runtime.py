from __future__ import annotations

import json
import sqlite3
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Any, Iterable

from .model_management import (
    configure_shared_model_cache,
    import_module,
    mark_model_registry_ready,
    preferred_onnx_provider,
    resolve_model_descriptor,
    torch_cuda_available,
    touch_model_registry_usage,
    normalize_model_backend_preference,
)

if TYPE_CHECKING:
    from .actions import PythonActionContext

SEMANTIC_RUNTIME_CONFIG_PATH = Path("src/config/semanticSearchRuntime.json")
SEMANTIC_DATABASE_SCHEMA_VERSION = 1


@dataclass(frozen=True)
class SemanticRuntimeConfig:
    schema_version: int
    model_id: str
    max_sequence_length: int
    chunk_max_lines: int
    chunk_overlap_lines: int
    chunk_max_chars: int
    snippet_max_chars: int
    torch_batch_size: int
    onnx_batch_size: int
    preferred_onnx_providers: tuple[str, ...]


@dataclass
class SemanticChunk:
    chunk_index: int
    line_start: int | None
    line_end: int | None
    snippet: str
    embedding: list[float]


@dataclass
class SemanticIndexedFile:
    file_id: str
    path: str
    relative_path: str
    name: str
    extension: str
    size_bytes: int
    modified_ms: int
    snippet_preview: str
    embedding: list[float]
    chunks: list[SemanticChunk]


@dataclass
class SemanticBackendHandle:
    kind: str
    provider_kind: str
    model_id: str
    provider_model_id: str
    batch_size: int
    tokenizer: Any
    runtime: Any
    device: str | None = None
    provider_name: str | None = None


_SEMANTIC_RUNTIME_CONFIG_CACHE: dict[str, SemanticRuntimeConfig] = {}
_SEMANTIC_BACKEND_CACHE: dict[str, SemanticBackendHandle] = {}


def semantic_index_root_action(
    payload: Any,
    context: PythonActionContext,
) -> dict[str, Any]:
    payload_dict = _payload_dict(payload)
    db_path = _required_path(payload_dict, "dbPath")
    root_path = _required_path(payload_dict, "rootPath")
    allowed_extensions = _normalized_extension_set(payload_dict.get("allowedExtensions"))
    max_file_bytes = _positive_int(payload_dict.get("maxFileBytes"), fallback=2 * 1024 * 1024)
    source_signature = _required_string(payload_dict, "sourceSignature")
    force_cpu = bool(payload_dict.get("forceCpu", False))
    requested_model_id = payload_dict.get("modelId")
    backend_preference = normalize_model_backend_preference(payload_dict.get("backendPreference"))

    runtime_config = _load_runtime_config(context)
    model_descriptor = resolve_model_descriptor(
        context,
        model_id=str(requested_model_id).strip() if isinstance(requested_model_id, str) else None,
        capability_id="semantic-indexing",
        fallback_provider_model_id=runtime_config.model_id,
    )
    backend = _resolve_backend(
        context,
        runtime_config,
        model_descriptor=model_descriptor,
        force_cpu=force_cpu,
        backend_preference=backend_preference,
    )
    connection = _connect_database(db_path)
    indexed_at_ms = int(time.time() * 1000)
    root_id = str(uuid.uuid4())

    try:
        with connection:
            _delete_root_records(connection, str(root_path))
            connection.execute(
                """
                INSERT INTO indexed_roots(
                  id,
                  root_path,
                  model_id,
                  backend_kind,
                  provider_kind,
                  source_signature,
                  indexed_at_ms,
                  file_count,
                  chunk_count,
                  last_error
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, 0, NULL)
                """,
                (
                    root_id,
                    str(root_path),
                    backend.model_id,
                    backend.kind,
                    backend.provider_kind,
                    source_signature,
                    indexed_at_ms,
                ),
            )

            indexed_files = 0
            indexed_chunks = 0
            for indexed_file in _build_index_records(
                root_path=root_path,
                allowed_extensions=allowed_extensions,
                max_file_bytes=max_file_bytes,
                runtime_config=runtime_config,
                backend=backend,
            ):
                _insert_indexed_file(connection, root_id, indexed_file)
                indexed_files += 1
                indexed_chunks += len(indexed_file.chunks)

            connection.execute(
                """
                UPDATE indexed_roots
                SET file_count = ?2, chunk_count = ?3, indexed_at_ms = ?4, last_error = NULL
                WHERE id = ?1
                """,
                (root_id, indexed_files, indexed_chunks, indexed_at_ms),
            )
    except Exception as error:
        with connection:
            _delete_root_records(connection, str(root_path))
            connection.execute(
                """
                INSERT INTO indexed_roots(
                  id,
                  root_path,
                  model_id,
                  backend_kind,
                  provider_kind,
                  source_signature,
                  indexed_at_ms,
                  file_count,
                  chunk_count,
                  last_error
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, 0, ?8)
                """,
                (
                    str(uuid.uuid4()),
                    str(root_path),
                    backend.model_id,
                    backend.kind,
                    backend.provider_kind,
                    source_signature,
                    indexed_at_ms,
                    str(error),
                ),
            )
        raise
    finally:
        connection.close()

    return {
        "indexed": True,
        "rootPath": str(root_path),
        "fileCount": indexed_files,
        "chunkCount": indexed_chunks,
        "indexedAt": indexed_at_ms,
        "modelId": backend.model_id,
        "backendKind": backend.kind,
        "providerKind": backend.provider_kind,
    }


def semantic_query_index_action(
    payload: Any,
    context: PythonActionContext,
) -> dict[str, Any]:
    payload_dict = _payload_dict(payload)
    db_path = _required_path(payload_dict, "dbPath")
    root_path = _required_path(payload_dict, "rootPath")
    query = _required_string(payload_dict, "query").strip()
    limit = _positive_int(payload_dict.get("limit"), fallback=60)
    force_cpu = bool(payload_dict.get("forceCpu", False))
    requested_model_id = payload_dict.get("modelId")
    backend_preference = normalize_model_backend_preference(payload_dict.get("backendPreference"))

    if not query:
        raise ValueError("semantic.query_index requires a non-empty 'query'.")

    runtime_config = _load_runtime_config(context)
    model_descriptor = resolve_model_descriptor(
        context,
        model_id=str(requested_model_id).strip() if isinstance(requested_model_id, str) else None,
        capability_id="semantic-indexing",
        fallback_provider_model_id=runtime_config.model_id,
    )
    backend = _resolve_backend(
        context,
        runtime_config,
        model_descriptor=model_descriptor,
        force_cpu=force_cpu,
        backend_preference=backend_preference,
    )
    query_vector = _encode_texts(backend, runtime_config, [query])[0]

    connection = _connect_database(db_path)
    try:
        root_row = _read_root_row(connection, str(root_path))
        if root_row is None:
            raise ValueError(f"No semantic index exists for root '{root_path}'.")

        chunk_rows = connection.execute(
            """
            SELECT
              files.id AS file_id,
              files.path AS path,
              files.relative_path AS relative_path,
              files.name AS name,
              files.extension AS extension,
              files.size_bytes AS size_bytes,
              files.modified_ms AS modified_ms,
              chunks.line_start AS line_start,
              chunks.snippet AS snippet,
              chunks.embedding_json AS embedding_json
            FROM indexed_roots AS roots
            INNER JOIN indexed_files AS files
              ON files.root_id = roots.id
            INNER JOIN indexed_chunks AS chunks
              ON chunks.file_id = files.id
            WHERE roots.root_path = ?1
            """,
            (str(root_path),),
        ).fetchall()

        results_by_file: dict[str, dict[str, Any]] = {}
        for row in chunk_rows:
            score = _cosine_similarity(query_vector, _decode_embedding(row["embedding_json"]))
            file_id = str(row["file_id"])
            current = results_by_file.get(file_id)
            if current is None or score > current["semanticScore"]:
                path = str(row["path"])
                results_by_file[file_id] = {
                    "name": str(row["name"]),
                    "path": path,
                    "relativePath": str(row["relative_path"]),
                    "isDir": False,
                    "size": int(row["size_bytes"]),
                    "modified": int(row["modified_ms"]),
                    "extension": str(row["extension"]),
                    "isHidden": Path(path).name.startswith("."),
                    "isSymlink": Path(path).is_symlink(),
                    "matchKind": None,
                    "snippet": str(row["snippet"]),
                    "lineNumber": int(row["line_start"]) if row["line_start"] is not None else None,
                    "semanticScore": score,
                }

        ranked = sorted(
            results_by_file.values(),
            key=lambda result: result["semanticScore"],
            reverse=True,
        )[:limit]
        return _build_semantic_response(
            root_row=root_row,
            backend=backend,
            results=ranked,
        )
    finally:
        connection.close()


def semantic_find_similar_file_action(
    payload: Any,
    context: PythonActionContext,
) -> dict[str, Any]:
    payload_dict = _payload_dict(payload)
    db_path = _required_path(payload_dict, "dbPath")
    root_path = _required_path(payload_dict, "rootPath")
    target_path = _required_path(payload_dict, "targetPath")
    limit = _positive_int(payload_dict.get("limit"), fallback=60)
    force_cpu = bool(payload_dict.get("forceCpu", False))
    requested_model_id = payload_dict.get("modelId")
    backend_preference = normalize_model_backend_preference(payload_dict.get("backendPreference"))

    runtime_config = _load_runtime_config(context)
    model_descriptor = resolve_model_descriptor(
        context,
        model_id=str(requested_model_id).strip() if isinstance(requested_model_id, str) else None,
        capability_id="semantic-indexing",
        fallback_provider_model_id=runtime_config.model_id,
    )
    backend = _resolve_backend(
        context,
        runtime_config,
        model_descriptor=model_descriptor,
        force_cpu=force_cpu,
        backend_preference=backend_preference,
    )

    connection = _connect_database(db_path)
    try:
        root_row = _read_root_row(connection, str(root_path))
        if root_row is None:
            raise ValueError(f"No semantic index exists for root '{root_path}'.")

        target_row = connection.execute(
            """
            SELECT
              id,
              embedding_json
            FROM indexed_files
            WHERE path = ?1
            """,
            (str(target_path),),
        ).fetchone()
        if target_row is None:
            raise ValueError(f"File '{target_path}' has not been indexed yet.")

        target_file_id = str(target_row["id"])
        target_embedding = _decode_embedding(target_row["embedding_json"])
        file_rows = connection.execute(
            """
            SELECT
              files.id AS file_id,
              files.path AS path,
              files.relative_path AS relative_path,
              files.name AS name,
              files.extension AS extension,
              files.size_bytes AS size_bytes,
              files.modified_ms AS modified_ms,
              files.snippet_preview AS snippet_preview,
              files.embedding_json AS embedding_json
            FROM indexed_roots AS roots
            INNER JOIN indexed_files AS files
              ON files.root_id = roots.id
            WHERE roots.root_path = ?1
            """,
            (str(root_path),),
        ).fetchall()

        results: list[dict[str, Any]] = []
        for row in file_rows:
            file_id = str(row["file_id"])
            if file_id == target_file_id:
                continue
            path = str(row["path"])
            results.append(
                {
                    "name": str(row["name"]),
                    "path": path,
                    "relativePath": str(row["relative_path"]),
                    "isDir": False,
                    "size": int(row["size_bytes"]),
                    "modified": int(row["modified_ms"]),
                    "extension": str(row["extension"]),
                    "isHidden": Path(path).name.startswith("."),
                    "isSymlink": Path(path).is_symlink(),
                    "matchKind": None,
                    "snippet": str(row["snippet_preview"]),
                    "lineNumber": None,
                    "semanticScore": _cosine_similarity(
                        target_embedding,
                        _decode_embedding(row["embedding_json"]),
                    ),
                }
            )

        ranked = sorted(
            results,
            key=lambda result: result["semanticScore"],
            reverse=True,
        )[:limit]
        return _build_semantic_response(
            root_row=root_row,
            backend=backend,
            results=ranked,
        )
    finally:
        connection.close()


def semantic_delete_index_action(
    payload: Any,
    context: PythonActionContext,
) -> dict[str, Any]:
    payload_dict = _payload_dict(payload)
    db_path = _required_path(payload_dict, "dbPath")
    root_path = _required_path(payload_dict, "rootPath")
    _ = context

    connection = _connect_database(db_path)
    try:
        with connection:
            _delete_root_records(connection, str(root_path))
    finally:
        connection.close()

    return {
        "indexed": False,
        "rootPath": str(root_path),
        "fileCount": 0,
        "chunkCount": 0,
        "indexedAt": None,
        "modelId": None,
        "backendKind": None,
        "providerKind": None,
    }


def semantic_index_status_action(
    payload: Any,
    context: PythonActionContext,
) -> dict[str, Any]:
    payload_dict = _payload_dict(payload)
    db_path = _required_path(payload_dict, "dbPath")
    root_path = _required_path(payload_dict, "rootPath")
    _ = context

    connection = _connect_database(db_path)
    try:
        root_row = _read_root_row(connection, str(root_path))
        if root_row is None:
            return {
                "indexed": False,
                "rootPath": str(root_path),
                "fileCount": 0,
                "chunkCount": 0,
                "indexedAt": None,
                "modelId": None,
                "backendKind": None,
                "providerKind": None,
            }
        return {
            "indexed": True,
            "rootPath": str(root_path),
            "fileCount": int(root_row["file_count"]),
            "chunkCount": int(root_row["chunk_count"]),
            "indexedAt": int(root_row["indexed_at_ms"]),
            "modelId": str(root_row["model_id"]),
            "backendKind": str(root_row["backend_kind"]),
            "providerKind": str(root_row["provider_kind"]),
        }
    finally:
        connection.close()


def _payload_dict(payload: Any) -> dict[str, Any]:
    if isinstance(payload, dict):
        return payload
    return {}


def _required_string(payload_dict: dict[str, Any], key: str) -> str:
    value = payload_dict.get(key)
    if isinstance(value, str) and value.strip():
        return value.strip()
    raise ValueError(f"semantic-search payload requires a non-empty '{key}'.")


def _required_path(payload_dict: dict[str, Any], key: str) -> Path:
    return Path(_required_string(payload_dict, key)).expanduser().resolve()


def _positive_int(value: Any, fallback: int) -> int:
    try:
        parsed = int(value)
    except Exception:
        return fallback
    return max(1, parsed)


def _normalized_extension_set(raw_extensions: Any) -> set[str]:
    if not isinstance(raw_extensions, list):
        return set()
    normalized = {
        str(extension).strip().lower().lstrip(".")
        for extension in raw_extensions
        if str(extension).strip()
    }
    return {extension for extension in normalized if extension}


def _load_runtime_config(context: PythonActionContext) -> SemanticRuntimeConfig:
    cache_key = str(context.workspace_root)
    cached = _SEMANTIC_RUNTIME_CONFIG_CACHE.get(cache_key)
    if cached is not None:
        return cached

    config_path = (context.workspace_root / SEMANTIC_RUNTIME_CONFIG_PATH).resolve()
    config_payload = json.loads(config_path.read_text(encoding="utf-8"))
    runtime_config = SemanticRuntimeConfig(
        schema_version=int(config_payload.get("schemaVersion", 1)),
        model_id=str(config_payload.get("modelId") or "sentence-transformers/all-MiniLM-L6-v2"),
        max_sequence_length=max(32, int(config_payload.get("maxSequenceLength", 256))),
        chunk_max_lines=max(4, int(config_payload.get("chunkMaxLines", 24))),
        chunk_overlap_lines=max(0, int(config_payload.get("chunkOverlapLines", 6))),
        chunk_max_chars=max(256, int(config_payload.get("chunkMaxChars", 1200))),
        snippet_max_chars=max(80, int(config_payload.get("snippetMaxChars", 220))),
        torch_batch_size=max(1, int(config_payload.get("torchBatchSize", 24))),
        onnx_batch_size=max(1, int(config_payload.get("onnxBatchSize", 48))),
        preferred_onnx_providers=tuple(
            str(provider).strip()
            for provider in config_payload.get(
                "preferredOnnxProviders",
                ["TensorrtExecutionProvider", "CUDAExecutionProvider", "CPUExecutionProvider"],
            )
            if str(provider).strip()
        ),
    )
    _SEMANTIC_RUNTIME_CONFIG_CACHE[cache_key] = runtime_config
    return runtime_config


def _resolve_backend(
    context: PythonActionContext,
    runtime_config: SemanticRuntimeConfig,
    *,
    model_descriptor: dict[str, Any],
    force_cpu: bool,
    backend_preference: str,
) -> SemanticBackendHandle:
    configure_shared_model_cache(context)
    attempts: list[tuple[str, str]] = []
    if force_cpu or backend_preference == "cpu":
        attempts.extend([
            ("torch", "cpu"),
            ("onnx", "CPUExecutionProvider"),
        ])
    elif backend_preference == "onnx":
        attempts.extend([
            ("onnx", "CPUExecutionProvider"),
        ])
        onnx_gpu_provider = preferred_onnx_provider(
            runtime_config.preferred_onnx_providers,
            cpu_only=False,
        )
        if onnx_gpu_provider is not None:
            attempts.append(("onnx", onnx_gpu_provider))
        attempts.append(("torch", "cpu"))
    else:
        if not force_cpu:
            onnx_gpu_provider = preferred_onnx_provider(
                runtime_config.preferred_onnx_providers,
                cpu_only=False,
            )
            if onnx_gpu_provider is not None:
                attempts.append(("onnx", onnx_gpu_provider))
            if torch_cuda_available():
                attempts.append(("torch", "cuda"))
        attempts.extend([
            ("onnx", "CPUExecutionProvider"),
            ("torch", "cpu"),
        ])

    errors: list[str] = []
    for backend_kind, provider_name in attempts:
        cache_key = f"{backend_kind}:{provider_name}:{model_descriptor['modelId']}"
        cached = _SEMANTIC_BACKEND_CACHE.get(cache_key)
        if cached is not None:
            touch_model_registry_usage(context, model_descriptor)
            return cached
        try:
            if backend_kind == "onnx":
                backend = _load_onnx_backend(runtime_config, model_descriptor, provider_name)
            else:
                backend = _load_torch_backend(runtime_config, model_descriptor, provider_name)
            _SEMANTIC_BACKEND_CACHE[cache_key] = backend
            mark_model_registry_ready(
                context,
                model_descriptor,
                backend_kind=backend.kind,
                provider_kind=backend.provider_kind,
                capability_id="semantic-indexing",
            )
            return backend
        except Exception as error:
            errors.append(f"{backend_kind}:{provider_name} -> {error}")

    raise RuntimeError(
        "Unable to initialize any semantic embedding backend. "
        + " | ".join(errors)
    )


def _load_torch_backend(
    runtime_config: SemanticRuntimeConfig,
    model_descriptor: dict[str, Any],
    provider_name: str,
) -> SemanticBackendHandle:
    torch = import_module("torch")
    transformers = import_module("transformers")
    tokenizer = transformers.AutoTokenizer.from_pretrained(model_descriptor["providerModelId"])
    model = transformers.AutoModel.from_pretrained(model_descriptor["providerModelId"])
    device = "cuda" if provider_name == "cuda" else "cpu"
    model.to(device)
    model.eval()
    return SemanticBackendHandle(
        kind="torch",
        provider_kind="cudaPython" if device == "cuda" else "cpu",
        model_id=model_descriptor["modelId"],
        provider_model_id=model_descriptor["providerModelId"],
        batch_size=runtime_config.torch_batch_size,
        tokenizer=tokenizer,
        runtime=model,
        device=device,
        provider_name=provider_name,
    )


def _load_onnx_backend(
    runtime_config: SemanticRuntimeConfig,
    model_descriptor: dict[str, Any],
    provider_name: str,
) -> SemanticBackendHandle:
    transformers = import_module("transformers")
    optimum_onnxruntime = import_module("optimum.onnxruntime")
    tokenizer = transformers.AutoTokenizer.from_pretrained(model_descriptor["providerModelId"])
    model = optimum_onnxruntime.ORTModelForFeatureExtraction.from_pretrained(
        model_descriptor["providerModelId"],
        export=True,
        provider=provider_name,
    )
    return SemanticBackendHandle(
        kind="onnx",
        provider_kind="cudaPython" if provider_name != "CPUExecutionProvider" else "cpu",
        model_id=model_descriptor["modelId"],
        provider_model_id=model_descriptor["providerModelId"],
        batch_size=runtime_config.onnx_batch_size,
        tokenizer=tokenizer,
        runtime=model,
        device=None,
        provider_name=provider_name,
    )


def _encode_texts(
    backend: SemanticBackendHandle,
    runtime_config: SemanticRuntimeConfig,
    texts: list[str],
) -> list[list[float]]:
    if not texts:
        return []
    if backend.kind == "onnx":
        return _encode_texts_onnx(backend, runtime_config, texts)
    return _encode_texts_torch(backend, runtime_config, texts)


def _encode_texts_torch(
    backend: SemanticBackendHandle,
    runtime_config: SemanticRuntimeConfig,
    texts: list[str],
) -> list[list[float]]:
    numpy = import_module("numpy")
    torch = import_module("torch")
    all_embeddings: list[list[float]] = []
    for batch in _batched(texts, backend.batch_size):
        encoded = backend.tokenizer(
            list(batch),
            padding=True,
            truncation=True,
            max_length=runtime_config.max_sequence_length,
            return_tensors="pt",
        )
        if backend.device is not None:
            encoded = {key: value.to(backend.device) for key, value in encoded.items()}
        with torch.no_grad():
            output = backend.runtime(**encoded)
        last_hidden_state = output.last_hidden_state
        attention_mask = encoded["attention_mask"]
        masked = last_hidden_state * attention_mask.unsqueeze(-1)
        token_sums = masked.sum(dim=1)
        token_counts = attention_mask.sum(dim=1).clamp(min=1).unsqueeze(-1)
        pooled = token_sums / token_counts
        normalized = torch.nn.functional.normalize(pooled, p=2, dim=1)
        batch_embeddings = normalized.detach().cpu().numpy().astype(numpy.float32)
        all_embeddings.extend(batch_embeddings.tolist())
    return all_embeddings


def _encode_texts_onnx(
    backend: SemanticBackendHandle,
    runtime_config: SemanticRuntimeConfig,
    texts: list[str],
) -> list[list[float]]:
    numpy = import_module("numpy")
    all_embeddings: list[list[float]] = []
    for batch in _batched(texts, backend.batch_size):
        encoded = backend.tokenizer(
            list(batch),
            padding=True,
            truncation=True,
            max_length=runtime_config.max_sequence_length,
            return_tensors="np",
        )
        output = backend.runtime(**encoded)
        last_hidden_state = getattr(output, "last_hidden_state", None)
        if last_hidden_state is None:
            if isinstance(output, tuple) and output:
                last_hidden_state = output[0]
            elif isinstance(output, dict) and output:
                last_hidden_state = next(iter(output.values()))
            else:
                raise RuntimeError("ONNX semantic backend returned no hidden state output.")
        hidden_state_array = numpy.asarray(last_hidden_state, dtype=numpy.float32)
        attention_mask = numpy.asarray(encoded["attention_mask"], dtype=numpy.float32)
        expanded_mask = attention_mask[:, :, None]
        token_sums = (hidden_state_array * expanded_mask).sum(axis=1)
        token_counts = expanded_mask.sum(axis=1)
        token_counts[token_counts == 0] = 1.0
        pooled = token_sums / token_counts
        norms = numpy.linalg.norm(pooled, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        normalized = pooled / norms
        all_embeddings.extend(normalized.astype(numpy.float32).tolist())
    return all_embeddings


def _batched(items: list[str], batch_size: int) -> Iterable[list[str]]:
    for index in range(0, len(items), batch_size):
        yield items[index : index + batch_size]


def _build_index_records(
    *,
    root_path: Path,
    allowed_extensions: set[str],
    max_file_bytes: int,
    runtime_config: SemanticRuntimeConfig,
    backend: SemanticBackendHandle,
) -> Iterable[SemanticIndexedFile]:
    for file_path in _iter_indexable_files(root_path, allowed_extensions, max_file_bytes):
        text = _read_text_file(file_path)
        if text is None:
            continue
        chunks = _chunk_text(text, runtime_config)
        if not chunks:
            continue

        chunk_embeddings = _encode_texts(
            backend,
            runtime_config,
            [chunk["text"] for chunk in chunks],
        )
        semantic_chunks = [
            SemanticChunk(
                chunk_index=index,
                line_start=chunk["line_start"],
                line_end=chunk["line_end"],
                snippet=chunk["snippet"],
                embedding=embedding,
            )
            for index, (chunk, embedding) in enumerate(zip(chunks, chunk_embeddings))
        ]
        file_embedding = _average_embeddings(chunk_embeddings)
        stat = file_path.stat()
        relative_path = file_path.relative_to(root_path).as_posix()
        yield SemanticIndexedFile(
            file_id=str(uuid.uuid4()),
            path=str(file_path),
            relative_path=relative_path,
            name=file_path.name,
            extension=file_path.suffix.lower().lstrip("."),
            size_bytes=int(stat.st_size),
            modified_ms=int(stat.st_mtime * 1000),
            snippet_preview=semantic_chunks[0].snippet,
            embedding=file_embedding,
            chunks=semantic_chunks,
        )


def _iter_indexable_files(
    root_path: Path,
    allowed_extensions: set[str],
    max_file_bytes: int,
) -> Iterable[Path]:
    for current_root, dir_names, file_names in os.walk(root_path):
        dir_names[:] = [
            directory_name
            for directory_name in sorted(dir_names)
            if not directory_name.startswith(".")
        ]
        for file_name in sorted(file_names):
            if file_name.startswith("."):
                continue
            file_path = Path(current_root) / file_name
            extension = file_path.suffix.lower().lstrip(".")
            if allowed_extensions and extension not in allowed_extensions:
                continue
            try:
                stat = file_path.stat()
            except OSError:
                continue
            if not file_path.is_file() or stat.st_size <= 0 or stat.st_size > max_file_bytes:
                continue
            yield file_path.resolve()


def _read_text_file(file_path: Path) -> str | None:
    try:
        content = file_path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return None
    if not content.strip():
        return None
    if "\x00" in content:
        return None
    return content


def _chunk_text(
    content: str,
    runtime_config: SemanticRuntimeConfig,
) -> list[dict[str, Any]]:
    normalized_lines = [line.rstrip() for line in content.splitlines()]
    if not normalized_lines:
        return []

    chunks: list[dict[str, Any]] = []
    start_index = 0
    step = max(1, runtime_config.chunk_max_lines - runtime_config.chunk_overlap_lines)
    while start_index < len(normalized_lines):
        end_index = min(len(normalized_lines), start_index + runtime_config.chunk_max_lines)
        chunk_lines = normalized_lines[start_index:end_index]
        chunk_text = "\n".join(chunk_lines).strip()
        if len(chunk_text) > runtime_config.chunk_max_chars:
            chunk_text = chunk_text[: runtime_config.chunk_max_chars].rstrip()
        if chunk_text:
            chunk_lines_for_snippet = " ".join(line.strip() for line in chunk_lines if line.strip())
            snippet = chunk_lines_for_snippet[: runtime_config.snippet_max_chars].strip()
            chunks.append(
                {
                    "text": chunk_text,
                    "line_start": start_index + 1,
                    "line_end": end_index,
                    "snippet": snippet or chunk_text[: runtime_config.snippet_max_chars].strip(),
                }
            )
        if end_index >= len(normalized_lines):
            break
        start_index += step
    return chunks


def _average_embeddings(embeddings: list[list[float]]) -> list[float]:
    if not embeddings:
        return []
    vector_length = len(embeddings[0])
    accum = [0.0] * vector_length
    for embedding in embeddings:
        for index, value in enumerate(embedding):
            accum[index] += float(value)
    averaged = [value / len(embeddings) for value in accum]
    return _normalize_vector(averaged)


def _normalize_vector(values: list[float]) -> list[float]:
    length = sum(value * value for value in values) ** 0.5
    if length <= 0:
        return values
    return [value / length for value in values]


def _cosine_similarity(left: list[float], right: list[float]) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0
    return float(sum(left_value * right_value for left_value, right_value in zip(left, right)))


def _connect_database(db_path: Path) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(str(db_path))
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA journal_mode = WAL")
    connection.execute("PRAGMA foreign_keys = ON")
    _ensure_schema(connection)
    return connection


def _ensure_schema(connection: sqlite3.Connection) -> None:
    connection.executescript(
        """
        CREATE TABLE IF NOT EXISTS semantic_meta (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS indexed_roots (
          id TEXT PRIMARY KEY NOT NULL,
          root_path TEXT NOT NULL UNIQUE,
          model_id TEXT NOT NULL,
          backend_kind TEXT NOT NULL,
          provider_kind TEXT NOT NULL,
          source_signature TEXT NOT NULL,
          indexed_at_ms INTEGER NOT NULL,
          file_count INTEGER NOT NULL,
          chunk_count INTEGER NOT NULL,
          last_error TEXT
        );

        CREATE TABLE IF NOT EXISTS indexed_files (
          id TEXT PRIMARY KEY NOT NULL,
          root_id TEXT NOT NULL,
          path TEXT NOT NULL,
          relative_path TEXT NOT NULL,
          name TEXT NOT NULL,
          extension TEXT NOT NULL,
          size_bytes INTEGER NOT NULL,
          modified_ms INTEGER NOT NULL,
          chunk_count INTEGER NOT NULL,
          snippet_preview TEXT NOT NULL,
          embedding_json TEXT NOT NULL,
          UNIQUE(root_id, path),
          FOREIGN KEY(root_id) REFERENCES indexed_roots(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS indexed_chunks (
          id TEXT PRIMARY KEY NOT NULL,
          file_id TEXT NOT NULL,
          chunk_index INTEGER NOT NULL,
          line_start INTEGER,
          line_end INTEGER,
          snippet TEXT NOT NULL,
          embedding_json TEXT NOT NULL,
          UNIQUE(file_id, chunk_index),
          FOREIGN KEY(file_id) REFERENCES indexed_files(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS indexed_files_root_id_idx
          ON indexed_files(root_id);
        CREATE INDEX IF NOT EXISTS indexed_chunks_file_id_idx
          ON indexed_chunks(file_id);
        """
    )
    connection.execute(
        "INSERT OR REPLACE INTO semantic_meta(key, value) VALUES ('schemaVersion', ?1)",
        (str(SEMANTIC_DATABASE_SCHEMA_VERSION),),
    )


def _delete_root_records(connection: sqlite3.Connection, root_path: str) -> None:
    connection.execute("DELETE FROM indexed_roots WHERE root_path = ?1", (root_path,))


def _read_root_row(connection: sqlite3.Connection, root_path: str) -> sqlite3.Row | None:
    return connection.execute(
        """
        SELECT
          id,
          root_path,
          model_id,
          backend_kind,
          provider_kind,
          indexed_at_ms,
          file_count,
          chunk_count
        FROM indexed_roots
        WHERE root_path = ?1
        """,
        (root_path,),
    ).fetchone()


def _insert_indexed_file(
    connection: sqlite3.Connection,
    root_id: str,
    indexed_file: SemanticIndexedFile,
) -> None:
    connection.execute(
        """
        INSERT INTO indexed_files(
          id,
          root_id,
          path,
          relative_path,
          name,
          extension,
          size_bytes,
          modified_ms,
          chunk_count,
          snippet_preview,
          embedding_json
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
        """,
        (
            indexed_file.file_id,
            root_id,
            indexed_file.path,
            indexed_file.relative_path,
            indexed_file.name,
            indexed_file.extension,
            indexed_file.size_bytes,
            indexed_file.modified_ms,
            len(indexed_file.chunks),
            indexed_file.snippet_preview,
            _encode_embedding(indexed_file.embedding),
        ),
    )
    connection.executemany(
        """
        INSERT INTO indexed_chunks(
          id,
          file_id,
          chunk_index,
          line_start,
          line_end,
          snippet,
          embedding_json
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
        """,
        [
            (
                str(uuid.uuid4()),
                indexed_file.file_id,
                chunk.chunk_index,
                chunk.line_start,
                chunk.line_end,
                chunk.snippet,
                _encode_embedding(chunk.embedding),
            )
            for chunk in indexed_file.chunks
        ],
    )


def _encode_embedding(embedding: list[float]) -> str:
    return json.dumps([float(value) for value in embedding], separators=(",", ":"))


def _decode_embedding(value: str) -> list[float]:
    raw_values = json.loads(value)
    if not isinstance(raw_values, list):
        return []
    return [float(item) for item in raw_values]


def _build_semantic_response(
    *,
    root_row: sqlite3.Row,
    backend: SemanticBackendHandle,
    results: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "results": results,
        "diagnostics": {
            "backendKind": backend.kind,
            "providerKind": backend.provider_kind,
            "modelId": backend.model_id,
            "indexedFileCount": int(root_row["file_count"]),
            "indexedChunkCount": int(root_row["chunk_count"]),
        },
    }
