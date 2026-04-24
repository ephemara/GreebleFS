from __future__ import annotations

import base64
import io
import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING, Any

from .model_management import normalize_model_backend_preference, resolve_model_descriptor

if TYPE_CHECKING:
    from .actions import PythonActionContext

try:
    from PIL import Image, ImageChops, ImageEnhance, ImageFilter, ImageOps
except Exception as error:  # pragma: no cover - runtime dependency
    Image = None  # type: ignore[assignment]
    ImageChops = None  # type: ignore[assignment]
    ImageEnhance = None  # type: ignore[assignment]
    ImageFilter = None  # type: ignore[assignment]
    ImageOps = None  # type: ignore[assignment]
    _PIL_IMPORT_ERROR = error
else:
    _PIL_IMPORT_ERROR = None


IMAGE_CUTOUT_CAPABILITY_ID = "image-cutout"
DEFAULT_PREVIEW_MAX_DIMENSION = 1280
MASK_THRESHOLD = 164
_CUTOUT_SESSION_CACHE: dict[str, "CutoutSession"] = {}
PIL_RESAMPLE_LANCZOS = getattr(
    getattr(Image, "Resampling", Image),
    "LANCZOS",
    1,
)


@dataclass(frozen=True)
class CutoutPrompt:
    x_norm: float
    y_norm: float
    kind: str


@dataclass
class CutoutSession:
    session_id: str
    logical_output_path: str | None
    analysis_image: Any
    original_image: Any
    base_mask: Any
    current_mask: Any
    prompts: list[CutoutPrompt] = field(default_factory=list)
    descriptor: dict[str, Any] = field(default_factory=dict)
    provider_kind: str = "python-sidecar"
    backend_kind: str = "cpu"
    message: str | None = None


def _require_pillow() -> None:
    if Image is None:
        raise RuntimeError(
            "The image cutout runtime requires Pillow in the managed Python sidecar. "
            f"Import error: {_PIL_IMPORT_ERROR}"
        )


def _payload_dict(payload: Any) -> dict[str, Any]:
    if isinstance(payload, dict):
        return payload
    return {}


def _clamp_norm(value: Any) -> float:
    try:
        numeric = float(value)
    except Exception:
        numeric = 0.5
    return max(0.0, min(1.0, numeric))


def _sanitize_prompt_kind(value: Any) -> str:
    text = str(value or "positive").strip().lower()
    return "negative" if text == "negative" else "positive"


def _parse_prompt(payload: Any) -> CutoutPrompt | None:
    if not isinstance(payload, dict):
        return None
    return CutoutPrompt(
        x_norm=_clamp_norm(payload.get("xNorm")),
        y_norm=_clamp_norm(payload.get("yNorm")),
        kind=_sanitize_prompt_kind(payload.get("kind")),
    )


def _parse_prompts(payload: Any) -> list[CutoutPrompt]:
    if not isinstance(payload, list):
        return []
    prompts = []
    for candidate in payload:
        prompt = _parse_prompt(candidate)
        if prompt is not None:
            prompts.append(prompt)
    return prompts


def _decode_data_url_image(data_url: str) -> Any:
    _require_pillow()
    prefix, _, payload = data_url.partition(",")
    if not prefix.startswith("data:image/") or not payload:
        raise ValueError("Expected a valid image data URL.")
    image_bytes = base64.b64decode(payload)
    return Image.open(io.BytesIO(image_bytes)).convert("RGBA")


def _load_input_image(payload_dict: dict[str, Any]) -> Any:
    input_data_url = payload_dict.get("inputDataUrl")
    if isinstance(input_data_url, str) and input_data_url.strip():
        return _decode_data_url_image(input_data_url.strip())

    input_path = payload_dict.get("inputPath")
    if isinstance(input_path, str) and input_path.strip():
        path = Path(input_path).expanduser().resolve()
        if not path.exists() or not path.is_file():
            raise FileNotFoundError(f"Cutout source image was not found: {path}")
        return Image.open(path).convert("RGBA")

    raise ValueError("Cutout session open requires either inputPath or inputDataUrl.")


def _load_override_mask(
    payload_dict: dict[str, Any],
    expected_size: tuple[int, int],
) -> Any | None:
    override_mask_data_url = payload_dict.get("overrideMaskDataUrl")
    if not isinstance(override_mask_data_url, str) or not override_mask_data_url.strip():
        return None

    override_image = _decode_data_url_image(override_mask_data_url.strip())
    mask_alpha = override_image.getchannel("A")
    if mask_alpha.getextrema()[0] == mask_alpha.getextrema()[1]:
        mask_alpha = _rgba_to_luminance(override_image)
    if mask_alpha.size != expected_size:
        mask_alpha = mask_alpha.resize(expected_size, PIL_RESAMPLE_LANCZOS)
    return mask_alpha.convert("L")


def _fit_image(image: Any, max_dimension: int) -> Any:
    width, height = image.size
    if width <= max_dimension and height <= max_dimension:
        return image.copy()

    scale = min(max_dimension / max(width, 1), max_dimension / max(height, 1))
    next_width = max(1, int(round(width * scale)))
    next_height = max(1, int(round(height * scale)))
    return image.resize((next_width, next_height), PIL_RESAMPLE_LANCZOS)


def _expand_mask(mask: Any, radius: int) -> Any:
    return mask.filter(ImageFilter.MaxFilter(size=max(3, radius * 2 + 1)))


def _contract_mask(mask: Any, radius: int) -> Any:
    return mask.filter(ImageFilter.MinFilter(size=max(3, radius * 2 + 1)))


def _image_to_png_data_url(image: Any) -> str:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")


def _rgba_to_luminance(image: Any) -> Any:
    return image.convert("RGB").convert("L")


def _estimate_border_background_luminance(image: Any) -> int:
    width, height = image.size
    if width <= 2 or height <= 2:
        return 0

    border = []
    for x in range(width):
        border.append(image.getpixel((x, 0)))
        border.append(image.getpixel((x, height - 1)))
    for y in range(1, height - 1):
        border.append(image.getpixel((0, y)))
        border.append(image.getpixel((width - 1, y)))

    if not border:
        return 0

    total = 0
    for red, green, blue, _ in border:
        total += int(round((red * 0.299) + (green * 0.587) + (blue * 0.114)))
    return int(round(total / len(border)))


def _build_center_weight(width: int, height: int, x: int, y: int) -> float:
    cx = (width - 1) / 2.0
    cy = (height - 1) / 2.0
    dx = (x - cx) / max(width / 2.0, 1.0)
    dy = (y - cy) / max(height / 2.0, 1.0)
    distance = math.sqrt((dx * dx) + (dy * dy))
    return max(0.0, 1.0 - distance)


def _build_initial_mask(image: Any) -> Any:
    width, height = image.size
    grayscale = _rgba_to_luminance(image)
    edges = grayscale.filter(ImageFilter.FIND_EDGES)
    blurred_edges = edges.filter(ImageFilter.GaussianBlur(radius=3.2))
    background_luma = _estimate_border_background_luminance(image)

    mask = Image.new("L", (width, height), 0)
    mask_data = mask.load()
    grayscale_data = grayscale.load()
    edges_data = blurred_edges.load()

    for y in range(height):
        for x in range(width):
            luminance = grayscale_data[x, y]
            edge_energy = edges_data[x, y]
            contrast_from_border = abs(int(luminance) - background_luma)
            center_weight = _build_center_weight(width, height, x, y)
            score = (contrast_from_border * 1.1) + (edge_energy * 0.9) + (center_weight * 168.0)
            if score >= 178:
                mask_data[x, y] = 255

    mask = _expand_mask(mask, 4)
    mask = _contract_mask(mask, 3)
    mask = mask.filter(ImageFilter.GaussianBlur(radius=3.0))
    return mask


def _prompt_point(image: Any, prompt: CutoutPrompt) -> tuple[int, int]:
    width, height = image.size
    x = min(width - 1, max(0, int(round(prompt.x_norm * max(width - 1, 0)))))
    y = min(height - 1, max(0, int(round(prompt.y_norm * max(height - 1, 0)))))
    return (x, y)


def _sample_prompt_color(image: Any, point: tuple[int, int]) -> tuple[int, int, int]:
    red, green, blue, _ = image.getpixel(point)
    return red, green, blue


def _apply_prompt_refinement(image: Any, mask: Any, prompts: list[CutoutPrompt]) -> Any:
    if not prompts:
        return mask

    width, height = image.size
    refined = mask.copy()
    refined_pixels = refined.load()
    image_pixels = image.load()

    for prompt in prompts:
        center_x, center_y = _prompt_point(image, prompt)
        sample_red, sample_green, sample_blue = _sample_prompt_color(image, (center_x, center_y))
        radius = max(22, int(min(width, height) * 0.15))
        radius_sq = float(radius * radius)

        for y in range(max(0, center_y - radius), min(height, center_y + radius + 1)):
            for x in range(max(0, center_x - radius), min(width, center_x + radius + 1)):
                dx = x - center_x
                dy = y - center_y
                spatial_sq = float((dx * dx) + (dy * dy))
                if spatial_sq > radius_sq:
                    continue

                red, green, blue, _ = image_pixels[x, y]
                color_distance = math.sqrt(
                    float((red - sample_red) ** 2 + (green - sample_green) ** 2 + (blue - sample_blue) ** 2)
                )
                if color_distance > 96:
                    continue

                spatial_weight = 1.0 - (spatial_sq / max(radius_sq, 1.0))
                color_weight = 1.0 - min(color_distance / 96.0, 1.0)
                influence = int(round(255 * spatial_weight * color_weight))
                current_value = refined_pixels[x, y]
                if prompt.kind == "positive":
                    refined_pixels[x, y] = min(255, current_value + influence)
                else:
                    refined_pixels[x, y] = max(0, current_value - influence)

    refined = refined.filter(ImageFilter.GaussianBlur(radius=2.4))
    return refined


def _compose_preview_cutout(image: Any, mask: Any) -> Any:
    rgba = image.copy()
    source_alpha = rgba.getchannel("A")
    alpha = ImageChops.multiply(source_alpha, mask)
    rgba.putalpha(alpha)
    return rgba


def _resize_mask_for_export(mask: Any, output_size: tuple[int, int]) -> Any:
    if mask.size == output_size:
        return mask.copy()
    return mask.resize(output_size, PIL_RESAMPLE_LANCZOS)


def _normalize_filter_number(value: Any, fallback: float) -> float:
    try:
        numeric = float(value)
    except Exception:
        return fallback
    if not math.isfinite(numeric):
        return fallback
    return numeric


def _apply_hue_rotation(image: Any, degrees: float) -> Any:
    if abs(degrees) < 0.01:
        return image

    hsv = image.convert("HSV")
    hue, saturation, value = hsv.split()
    shift = int(round((degrees % 360.0) * 255.0 / 360.0))
    shifted_hue = hue.point(lambda channel: (int(channel) + shift) % 256)
    return Image.merge("HSV", (shifted_hue, saturation, value)).convert("RGBA")


def _apply_filter_state(image: Any, filters: dict[str, Any] | None) -> Any:
    if not filters:
        return image

    output = image.copy()
    brightness = _normalize_filter_number(filters.get("brightness"), 100.0)
    contrast = _normalize_filter_number(filters.get("contrast"), 100.0)
    saturate = _normalize_filter_number(filters.get("saturate"), 100.0)
    hue_rotate = _normalize_filter_number(filters.get("hueRotate"), 0.0)
    grayscale = _normalize_filter_number(filters.get("grayscale"), 0.0)
    sepia = _normalize_filter_number(filters.get("sepia"), 0.0)
    invert = _normalize_filter_number(filters.get("invert"), 0.0)
    blur = _normalize_filter_number(filters.get("blur"), 0.0)

    if abs(brightness - 100.0) > 0.01:
        output = ImageEnhance.Brightness(output).enhance(max(0.0, brightness / 100.0))
    if abs(contrast - 100.0) > 0.01:
        output = ImageEnhance.Contrast(output).enhance(max(0.0, contrast / 100.0))
    if abs(saturate - 100.0) > 0.01:
        output = ImageEnhance.Color(output).enhance(max(0.0, saturate / 100.0))
    output = _apply_hue_rotation(output, hue_rotate)

    if grayscale > 0.0:
        mono = ImageOps.grayscale(output).convert("RGBA")
        grayscale_mix = max(0.0, min(1.0, grayscale / 100.0))
        output = Image.blend(output, mono, grayscale_mix)

    if sepia > 0.0:
        sepia_mix = max(0.0, min(1.0, sepia / 100.0))
        mono = ImageOps.grayscale(output)
        sepia_rgb = ImageOps.colorize(mono, "#24160c", "#f3d7a0").convert("RGBA")
        output = Image.blend(output, sepia_rgb, sepia_mix)

    if invert > 0.0:
        invert_mix = max(0.0, min(1.0, invert / 100.0))
        alpha = output.getchannel("A")
        inverted_rgb = ImageOps.invert(output.convert("RGB")).convert("RGBA")
        inverted_rgb.putalpha(alpha)
        output = Image.blend(output, inverted_rgb, invert_mix)

    if blur > 0.0:
        output = output.filter(ImageFilter.GaussianBlur(radius=max(0.0, blur)))

    return output


def _resolve_backend_kind(backend_preference: str) -> str:
    if backend_preference == "cuda":
        try:
            from .model_management import torch_cuda_available
        except Exception:
            return "cpu"
        return "cuda" if torch_cuda_available() else "cpu"
    return "cpu"


def _diagnostics_payload(session: CutoutSession) -> dict[str, Any]:
    descriptor = session.descriptor
    return {
        "providerKind": session.provider_kind,
        "backendKind": session.backend_kind,
        "modelId": descriptor.get("modelId"),
        "providerModelId": descriptor.get("providerModelId"),
        "family": descriptor.get("family"),
        "message": session.message,
    }


def _build_session_payload(session: CutoutSession) -> dict[str, Any]:
    preview_cutout = _compose_preview_cutout(session.analysis_image, session.current_mask)
    return {
        "sessionId": session.session_id,
        "previewMaskDataUrl": _image_to_png_data_url(session.current_mask),
        "cutoutPreviewDataUrl": _image_to_png_data_url(preview_cutout),
        "previewWidth": session.analysis_image.width,
        "previewHeight": session.analysis_image.height,
        "promptCount": len(session.prompts),
        "diagnostics": _diagnostics_payload(session),
    }


def image_cutout_open_session_action(
    payload: Any,
    context: PythonActionContext,
) -> dict[str, Any]:
    _require_pillow()
    payload_dict = _payload_dict(payload)
    session_id = str(payload_dict.get("sessionId") or "").strip()
    if not session_id:
        raise ValueError("image.cutout_open_session requires a sessionId.")

    preview_max_dimension = int(
        payload_dict.get("previewMaxDimension") or DEFAULT_PREVIEW_MAX_DIMENSION
    )
    preview_max_dimension = max(256, min(preview_max_dimension, 2048))
    backend_preference = normalize_model_backend_preference(
        payload_dict.get("backendPreference")
    )

    descriptor = resolve_model_descriptor(
        context,
        model_id=str(payload_dict.get("modelId")).strip()
        if isinstance(payload_dict.get("modelId"), str)
        else None,
        capability_id=IMAGE_CUTOUT_CAPABILITY_ID,
        fallback_provider_model_id="facebook/sam2-hiera-small",
        fallback_family="image-cutout",
    )
    input_image = _load_input_image(payload_dict)
    analysis_image = _fit_image(input_image, preview_max_dimension)
    base_mask = _build_initial_mask(analysis_image)
    current_mask = base_mask.copy()
    backend_kind = _resolve_backend_kind(backend_preference)
    message = (
        "Heuristic cutout runtime active; the promptable SAM2 provider slot is reserved "
        "behind the same capability contract for a later managed-weights pass."
    )

    session = CutoutSession(
        session_id=session_id,
        logical_output_path=str(payload_dict.get("logicalOutputPath")).strip()
        if isinstance(payload_dict.get("logicalOutputPath"), str)
        and str(payload_dict.get("logicalOutputPath")).strip()
        else None,
        analysis_image=analysis_image,
        original_image=input_image,
        base_mask=base_mask,
        current_mask=current_mask,
        descriptor=descriptor,
        backend_kind=backend_kind,
        message=message,
    )
    _CUTOUT_SESSION_CACHE[session_id] = session
    return _build_session_payload(session)


def image_cutout_apply_prompts_action(
    payload: Any,
    context: PythonActionContext,
) -> dict[str, Any]:
    _ = context
    payload_dict = _payload_dict(payload)
    session_id = str(payload_dict.get("sessionId") or "").strip()
    session = _CUTOUT_SESSION_CACHE.get(session_id)
    if session is None:
        raise KeyError(f"Image cutout session was not found: {session_id}")

    prompts = _parse_prompts(payload_dict.get("prompts"))
    if prompts:
        session.prompts.extend(prompts)
        session.current_mask = _apply_prompt_refinement(
            session.analysis_image,
            session.current_mask,
            prompts,
        )

    return _build_session_payload(session)


def image_cutout_reset_session_action(
    payload: Any,
    context: PythonActionContext,
) -> dict[str, Any]:
    _ = context
    payload_dict = _payload_dict(payload)
    session_id = str(payload_dict.get("sessionId") or "").strip()
    session = _CUTOUT_SESSION_CACHE.get(session_id)
    if session is None:
        raise KeyError(f"Image cutout session was not found: {session_id}")

    session.prompts.clear()
    session.current_mask = session.base_mask.copy()
    return _build_session_payload(session)


def image_cutout_stage_export_action(
    payload: Any,
    context: PythonActionContext,
) -> dict[str, Any]:
    _ = context
    payload_dict = _payload_dict(payload)
    session_id = str(payload_dict.get("sessionId") or "").strip()
    output_path = str(payload_dict.get("outputPath") or "").strip()
    if not output_path:
        raise ValueError("image.cutout_stage_export requires an outputPath.")

    session = _CUTOUT_SESSION_CACHE.get(session_id)
    if session is None:
        raise KeyError(f"Image cutout session was not found: {session_id}")

    output = _apply_filter_state(session.original_image, payload_dict.get("filters"))
    override_mask = _load_override_mask(payload_dict, session.analysis_image.size)
    export_mask = _resize_mask_for_export(
        override_mask if override_mask is not None else session.current_mask,
        output.size,
    )
    source_alpha = output.getchannel("A")
    output.putalpha(ImageChops.multiply(source_alpha, export_mask))

    destination = Path(output_path).expanduser().resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    output.save(destination, format="PNG")
    return {
        "outputPath": str(destination),
        "width": output.width,
        "height": output.height,
    }


def image_cutout_close_session_action(
    payload: Any,
    context: PythonActionContext,
) -> dict[str, Any]:
    _ = context
    payload_dict = _payload_dict(payload)
    session_id = str(payload_dict.get("sessionId") or "").strip()
    _CUTOUT_SESSION_CACHE.pop(session_id, None)
    return {"closed": True}
