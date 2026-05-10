from __future__ import annotations

import base64
import io
import os
from pathlib import Path
from typing import Any


COMMON_FORMAT_EXTENSIONS: dict[str, str] = {
    "png": ".png",
    "jpg": ".jpg",
    "jpeg": ".jpg",
    "webp": ".webp",
    "bmp": ".bmp",
    "tiff": ".tiff",
    "gif": ".gif",
    "ico": ".ico",
    "svg": ".svg",
    "pdf": ".pdf",
}

PILLOW_FORMATS: dict[str, str] = {
    "png": "PNG",
    "jpg": "JPEG",
    "jpeg": "JPEG",
    "webp": "WEBP",
    "bmp": "BMP",
    "tiff": "TIFF",
    "gif": "GIF",
    "ico": "ICO",
    "pdf": "PDF",
}


def _require_pillow() -> tuple[Any, Any]:
    try:
        from PIL import Image, ImageOps
    except Exception as error:  # pragma: no cover - runtime-specific
        raise RuntimeError(
            "The Kain image converter requires Pillow in the managed Python sidecar. "
            "Install the ml-core preset or add pillow to the Python runtime."
        ) from error
    return Image, ImageOps


def _payload_dict(payload: Any) -> dict[str, Any]:
    return payload if isinstance(payload, dict) else {}


def _payload_string(payload: dict[str, Any], key: str, fallback: str = "") -> str:
    value = payload.get(key)
    return value.strip() if isinstance(value, str) and value.strip() else fallback


def _payload_int(payload: dict[str, Any], key: str, fallback: int | None = None) -> int | None:
    value = payload.get(key)
    if isinstance(value, bool):
        return fallback
    if isinstance(value, int):
        return value if value > 0 else fallback
    if isinstance(value, float) and value.is_integer():
        value_int = int(value)
        return value_int if value_int > 0 else fallback
    if isinstance(value, str) and value.strip():
        try:
            parsed = int(value.strip())
        except ValueError:
            return fallback
        return parsed if parsed > 0 else fallback
    return fallback


def _normalize_format(value: str) -> str:
    normalized = value.strip().lower().lstrip(".")
    return "jpg" if normalized == "jpeg" else normalized


def _supported_formats() -> list[str]:
    Image, _ = _require_pillow()
    registered = {
        extension.lower().lstrip(".")
        for extension in Image.registered_extensions()
        if extension
    }
    return sorted(set(COMMON_FORMAT_EXTENSIONS).union(registered))


def _resolve_source_path(payload: dict[str, Any]) -> Path:
    source = _payload_string(payload, "sourcePath")
    if not source:
        raise ValueError("sourcePath is required.")
    path = Path(source).expanduser()
    if not path.is_absolute():
        path = Path.cwd() / path
    path = path.resolve()
    if not path.exists():
        raise FileNotFoundError(f"Image source was not found: {path}")
    if not path.is_file():
        raise ValueError(f"Image source is not a file: {path}")
    return path


def _default_output_path(source_path: Path, payload: dict[str, Any], output_format: str) -> Path:
    requested = _payload_string(payload, "outputPath")
    extension = COMMON_FORMAT_EXTENSIONS.get(output_format, f".{output_format}")
    if requested:
        output = Path(requested).expanduser()
        if not output.is_absolute():
            output = (source_path.parent / output).resolve()
        return output

    width = _payload_int(payload, "width")
    height = _payload_int(payload, "height")
    size_label = f"{width or 'auto'}x{height or 'auto'}"
    return source_path.with_name(f"{source_path.stem}.kain-{size_label}{extension}")


def _image_info(path: Path, image: Any) -> dict[str, Any]:
    return {
        "path": str(path),
        "format": image.format,
        "mode": image.mode,
        "width": int(image.width),
        "height": int(image.height),
        "hasAlpha": image.mode in {"RGBA", "LA"} or "transparency" in getattr(image, "info", {}),
    }


def _background_tuple(value: str) -> tuple[int, int, int]:
    normalized = value.strip().lstrip("#")
    if len(normalized) == 3:
        normalized = "".join(part * 2 for part in normalized)
    if len(normalized) != 6:
        return (0, 0, 0)
    try:
        return (
            int(normalized[0:2], 16),
            int(normalized[2:4], 16),
            int(normalized[4:6], 16),
        )
    except ValueError:
        return (0, 0, 0)


def _flatten_alpha(image: Any, background: str) -> Any:
    Image, _ = _require_pillow()
    if image.mode not in {"RGBA", "LA"} and "transparency" not in getattr(image, "info", {}):
        return image.convert("RGB")
    rgba = image.convert("RGBA")
    canvas = Image.new("RGBA", rgba.size, (*_background_tuple(background), 255))
    canvas.alpha_composite(rgba)
    return canvas.convert("RGB")


def _resize_image(image: Any, payload: dict[str, Any]) -> Any:
    _, ImageOps = _require_pillow()
    width = _payload_int(payload, "width")
    height = _payload_int(payload, "height")
    if not width and not height:
        return image

    source_width, source_height = image.size
    target_width = width or max(1, round(source_width * (height or source_height) / source_height))
    target_height = height or max(1, round(source_height * (width or source_width) / source_width))
    target = (target_width, target_height)
    fit_mode = _payload_string(payload, "fitMode", "contain").lower()

    if fit_mode == "stretch":
        return image.resize(target)
    if fit_mode == "cover":
        return ImageOps.fit(image, target)
    if fit_mode == "scale-down" and source_width <= target_width and source_height <= target_height:
        return image
    return ImageOps.contain(image, target)


def _svg_embed(image: Any, output_path: Path) -> dict[str, Any]:
    image = image.convert("RGBA")
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    svg = (
        f"<svg xmlns=\"http://www.w3.org/2000/svg\" "
        f"viewBox=\"0 0 {image.width} {image.height}\" "
        f"width=\"{image.width}\" height=\"{image.height}\">"
        f"<image href=\"data:image/png;base64,{encoded}\" "
        f"width=\"{image.width}\" height=\"{image.height}\"/></svg>"
    )
    output_path.write_text(svg, encoding="utf-8")
    return {
        "path": str(output_path),
        "format": "SVG",
        "mode": "embedded-raster",
        "width": int(image.width),
        "height": int(image.height),
        "hasAlpha": True,
    }


def _save_image(image: Any, output_path: Path, output_format: str, payload: dict[str, Any]) -> dict[str, Any]:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_format == "svg":
        return _svg_embed(image, output_path)

    pillow_format = PILLOW_FORMATS.get(output_format, output_format.upper())
    quality = max(1, min(100, _payload_int(payload, "quality", 92) or 92))
    save_kwargs: dict[str, Any] = {}
    output_image = image

    if pillow_format in {"JPEG", "PDF"}:
        output_image = _flatten_alpha(image, _payload_string(payload, "background", "#000000"))
    elif pillow_format == "ICO":
        output_image = image.convert("RGBA")
        max_side = min(256, max(output_image.size))
        sizes = []
        for size in (16, 24, 32, 48, 64, 128, 256):
            if size <= max_side:
                sizes.append((size, size))
        save_kwargs["sizes"] = sizes or [(min(256, output_image.width), min(256, output_image.height))]
    elif pillow_format == "GIF":
        output_image = image.convert("P", palette=1)

    if pillow_format in {"JPEG", "WEBP"}:
        save_kwargs["quality"] = quality
    if pillow_format == "PNG":
        save_kwargs["optimize"] = True

    output_image.save(output_path, format=pillow_format, **save_kwargs)
    with output_path.open("rb") as handle:
        header_image = _require_pillow()[0].open(handle)
        header_image.load()
    return _image_info(output_path, header_image)


def inspect_image_converter_source(payload: Any) -> dict[str, Any]:
    payload_dict = _payload_dict(payload)
    Image, _ = _require_pillow()
    source_path = _resolve_source_path(payload_dict)
    with Image.open(source_path) as image:
        image.load()
        source = _image_info(source_path, image)
    return {
        "ok": True,
        "action": "inspect",
        "backend": "python:pillow",
        "source": source,
        "output": None,
        "outputPath": None,
        "outputFormat": None,
        "supportedFormats": _supported_formats(),
        "warnings": [],
    }


def plan_image_converter_output(payload: Any) -> dict[str, Any]:
    payload_dict = _payload_dict(payload)
    inspect_result = inspect_image_converter_source(payload_dict)
    output_format = _normalize_format(_payload_string(payload_dict, "outputFormat", "png"))
    output_path = _default_output_path(Path(inspect_result["source"]["path"]), payload_dict, output_format)
    inspect_result.update(
        {
            "action": "plan",
            "outputPath": str(output_path),
            "outputFormat": output_format,
        }
    )
    return inspect_result


def convert_image_with_python(payload: Any) -> dict[str, Any]:
    payload_dict = _payload_dict(payload)
    Image, _ = _require_pillow()
    source_path = _resolve_source_path(payload_dict)
    output_format = _normalize_format(_payload_string(payload_dict, "outputFormat", "png"))
    output_path = _default_output_path(source_path, payload_dict, output_format)
    if output_path.exists() and not bool(payload_dict.get("overwrite", False)):
        raise FileExistsError(f"Output already exists: {output_path}")

    warnings: list[str] = []
    if output_format not in _supported_formats() and output_format != "svg":
        warnings.append(f"{output_format} is not in the advertised Pillow extension registry.")

    with Image.open(source_path) as source_image:
        source_image.load()
        source = _image_info(source_path, source_image)
        working_image = _resize_image(source_image.convert("RGBA"), payload_dict)
        output = _save_image(working_image, output_path, output_format, payload_dict)

    return {
        "ok": True,
        "action": "convert",
        "backend": "python:pillow",
        "source": source,
        "output": output,
        "outputPath": str(output_path),
        "outputFormat": output_format,
        "supportedFormats": _supported_formats(),
        "warnings": warnings,
        "bytes": os.path.getsize(output_path),
    }
