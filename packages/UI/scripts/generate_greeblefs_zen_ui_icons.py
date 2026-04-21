#!/usr/bin/env python3
"""
Generate the Zen application UI icon coverage pack for GreebleFS.

The goal of this script is not to replace the explorer file/folder glyph set.
It fills the *application chrome* gap by giving every shipped AppIcons slot a
dedicated SVG reference that a theme pack can override without touching Lucide
directly.

Outputs:
- icon-themes/Zen/ui/<slot>.svg for any missing app-glyph slot
- icon-themes/Zen/icon-theme.json updated so uiIcons covers the shipped slots

The script is intentionally data-driven:
- It extracts the current AppIcons slot list from src/components/AppIcons.tsx
- It preserves existing icon theme entries
- It only generates SVGs for missing slots or dedicated app-glyph slots that
  should no longer alias to the panel-tab artwork
"""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Iterable


REPO_ROOT = Path(__file__).resolve().parents[3]
APP_ICONS_PATH = REPO_ROOT / "src/components/AppIcons.tsx"
ZEN_THEME_DIR = REPO_ROOT / "icon-themes/Zen"
ZEN_THEME_PATH = ZEN_THEME_DIR / "icon-theme.json"
ZEN_UI_DIR = ZEN_THEME_DIR / "ui"

PALETTE = [
    "#5DADE2",
    "#38BDF8",
    "#A78BFA",
    "#F472B6",
    "#FB7185",
    "#F59E0B",
    "#22C55E",
    "#34D399",
]

DEDICATED_APP_SLOTS = {
    "camera",
    "hard_drive",
    "puzzle",
    "settings2",
    "sliders_horizontal",
    "sticky_note",
}


ARROW_SLOTS = {
    "arrow_down",
    "arrow_down_to_line",
    "arrow_left",
    "arrow_right",
    "arrow_up",
    "arrow_up_down",
    "arrow_up_left",
    "arrow_up_right",
    "corner_down_left",
    "move_right",
}

CHEVRON_SLOTS = {
    "chevron_down",
    "chevron_left",
    "chevron_right",
    "chevron_up",
}

BASIC_SYMBOL_SLOTS = {
    "check",
    "circle",
    "plus",
    "square",
    "x",
    "xcircle",
}

MEDIA_SLOTS = {
    "audio_lines",
    "audio_waveform",
    "camera",
    "clapperboard",
    "film",
    "image",
    "image_icon",
    "monitor",
    "monitor_play",
    "music",
    "terminal",
    "terminal_square",
}

FILE_SLOTS = {
    "file",
    "file_plus",
    "file_search",
    "file_text",
    "folder",
    "folder_archive",
    "folder_git2",
    "folder_open",
    "folder_plus",
    "folder_tree",
    "hard_drive",
    "hard_drive_download",
}

ACTION_SLOTS = {
    "clipboard",
    "copy",
    "copy_plus",
    "download",
    "external_link",
    "eye",
    "info",
    "loader",
    "loader2",
    "loader_circle",
    "maximize2",
    "more_horizontal",
    "mouse_pointer2",
    "pause",
    "pin",
    "pin_off",
    "play",
    "refresh_ccw",
    "refresh_cw",
    "rotate_ccw",
    "rocket",
    "save",
    "scan_line",
    "scissors",
    "search",
    "skip_back",
    "skip_forward",
    "undo2",
    "upload",
    "trash2",
}

SYSTEM_SLOTS = {
    "alert_circle",
    "alert_triangle",
    "blocks",
    "bot",
    "bug",
    "clock",
    "cpu",
    "crosshair",
    "crop",
    "database",
    "droplet",
    "edit3",
    "eraser",
    "git_branch",
    "git_commit",
    "hash",
    "hard_drive_download",
    "highlighter",
    "home",
    "layers3",
    "layout_grid",
    "list",
    "list_todo",
    "message_square_text",
    "pencil",
    "puzzle",
    "refresh_ccw",
    "refresh_cw",
    "rotate_ccw",
    "settings2",
    "shield",
    "shield_alert",
    "shield_check",
    "signature",
    "sliders",
    "sliders_horizontal",
    "sparkles",
    "split_square_horizontal",
    "split_square_vertical",
    "square_plus",
    "square_split_horizontal",
    "star",
    "star_off",
    "tag",
    "tags",
    "triangle_alert",
    "type",
    "volume2",
    "volume_x",
    "waves",
    "zap",
}


def read_app_icon_slots() -> list[str]:
    source_text = APP_ICONS_PATH.read_text(encoding="utf-8")
    slots = re.findall(r"createThemedIcon\('([^']+)'", source_text)
    # Preserve file order while removing duplicates.
    seen: set[str] = set()
    ordered_slots: list[str] = []
    for slot in slots:
        if slot not in seen:
            seen.add(slot)
            ordered_slots.append(slot)
    return ordered_slots


def read_manifest() -> dict:
    return json.loads(ZEN_THEME_PATH.read_text(encoding="utf-8"))


def write_manifest(manifest: dict) -> None:
    ZEN_THEME_PATH.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def slot_colors(slot: str) -> tuple[str, str]:
    digest = hashlib.sha1(slot.encode("utf-8")).digest()
    return (
        PALETTE[digest[0] % len(PALETTE)],
        PALETTE[digest[1] % len(PALETTE)],
    )


def svg_wrap(body: Iterable[str]) -> str:
    return (
        '<svg width="32" height="32" viewBox="0 0 32 32" fill="none" '
        'xmlns="http://www.w3.org/2000/svg">\n'
        f"  {'\n  '.join(body)}\n"
        "</svg>\n"
    )


def line(x1: float, y1: float, x2: float, y2: float, stroke: str, width: float = 2.2) -> str:
    return (
        f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" '
        f'stroke="{stroke}" stroke-width="{width}" stroke-linecap="round"/>'
    )


def rect(
    x: float,
    y: float,
    width: float,
    height: float,
    fill: str,
    stroke: str | None = None,
    rx: float = 0,
    opacity: float = 1.0,
    stroke_width: float = 2.0,
) -> str:
    attrs = [
        f'x="{x}"',
        f'y="{y}"',
        f'width="{width}"',
        f'height="{height}"',
        f'rx="{rx}"',
        f'fill="{fill}"',
        f'fill-opacity="{opacity}"',
    ]
    if stroke:
        attrs.append(f'stroke="{stroke}"')
        attrs.append(f'stroke-width="{stroke_width}"')
    return f"<rect {' '.join(attrs)} />"


def circle(cx: float, cy: float, radius: float, fill: str, stroke: str | None = None, stroke_width: float = 2.0, opacity: float = 1.0) -> str:
    attrs = [
        f'cx="{cx}"',
        f'cy="{cy}"',
        f'r="{radius}"',
        f'fill="{fill}"',
        f'fill-opacity="{opacity}"',
    ]
    if stroke:
        attrs.append(f'stroke="{stroke}"')
        attrs.append(f'stroke-width="{stroke_width}"')
    return f"<circle {' '.join(attrs)} />"


def path(d: str, fill: str = "none", stroke: str | None = None, stroke_width: float = 2.0, opacity: float = 1.0) -> str:
    attrs = [f'd="{d}"', f'fill="{fill}"', f'fill-opacity="{opacity}"']
    if stroke:
        attrs.append(f'stroke="{stroke}"')
        attrs.append(f'stroke-width="{stroke_width}"')
        attrs.append('stroke-linecap="round"')
        attrs.append('stroke-linejoin="round"')
    return f"<path {' '.join(attrs)} />"


def polygon(points: str, fill: str, stroke: str | None = None, stroke_width: float = 2.0, opacity: float = 1.0) -> str:
    attrs = [f'points="{points}"', f'fill="{fill}"', f'fill-opacity="{opacity}"']
    if stroke:
        attrs.append(f'stroke="{stroke}"')
        attrs.append(f'stroke-width="{stroke_width}"')
        attrs.append('stroke-linejoin="round"')
    return f"<polygon {' '.join(attrs)} />"


def frame(accent: str, accent2: str) -> list[str]:
    return [
        rect(5, 5, 22, 22, "none", accent, rx=5, stroke_width=2.1),
        rect(8, 8, 16, 16, accent, opacity=0.1, rx=4),
        circle(23, 9, 1.2, accent2),
    ]


def arrow_symbol(kind: str, accent: str) -> list[str]:
    if kind == "arrow_left":
        return [line(22, 16, 10, 16, accent), path("M14 12 L10 16 L14 20", stroke=accent)]
    if kind == "arrow_right":
        return [line(10, 16, 22, 16, accent), path("M18 12 L22 16 L18 20", stroke=accent)]
    if kind == "arrow_up":
        return [line(16, 22, 16, 10, accent), path("M12 14 L16 10 L20 14", stroke=accent)]
    if kind == "arrow_down":
        return [line(16, 10, 16, 22, accent), path("M12 18 L16 22 L20 18", stroke=accent)]
    if kind == "arrow_up_down":
        return [
            line(16, 10, 16, 22, accent),
            path("M12 14 L16 10 L20 14", stroke=accent),
            path("M12 18 L16 22 L20 18", stroke=accent),
        ]
    if kind == "arrow_up_left":
        return [line(21, 21, 12, 12, accent), path("M12 16 L12 12 L16 12", stroke=accent)]
    if kind == "arrow_up_right":
        return [line(11, 21, 20, 12, accent), path("M20 16 L20 12 L16 12", stroke=accent)]
    if kind == "corner_down_left":
        return [line(20, 10, 20, 18, accent), line(20, 18, 11, 18, accent), path("M14 14 L11 18 L14 22", stroke=accent)]
    if kind == "arrow_down_to_line":
        return [line(16, 8, 16, 19, accent), path("M12 15 L16 19 L20 15", stroke=accent), line(8, 24, 24, 24, accent)]
    return [line(10, 16, 22, 16, accent)]


def chevron_symbol(kind: str, accent: str) -> list[str]:
    if kind == "chevron_left":
        return [path("M19 10 L13 16 L19 22", stroke=accent)]
    if kind == "chevron_right":
        return [path("M13 10 L19 16 L13 22", stroke=accent)]
    if kind == "chevron_up":
        return [path("M10 19 L16 13 L22 19", stroke=accent)]
    if kind == "chevron_down":
        return [path("M10 13 L16 19 L22 13", stroke=accent)]
    return [path("M13 10 L19 16 L13 22", stroke=accent)]


def basic_symbol(kind: str, accent: str, accent2: str) -> list[str]:
    if kind == "plus":
        return [line(16, 10, 16, 22, accent), line(10, 16, 22, 16, accent)]
    if kind == "check":
        return [path("M10 17 L14 21 L22 11", stroke=accent)]
    if kind == "x":
        return [line(10, 10, 22, 22, accent), line(22, 10, 10, 22, accent)]
    if kind == "circle":
        return [circle(16, 16, 8, "none", accent, stroke_width=2.2), circle(16, 16, 2, accent2)]
    if kind == "square":
        return [rect(9, 9, 14, 14, "none", accent, rx=3, stroke_width=2.2), rect(12, 12, 8, 8, accent, opacity=0.12, rx=2)]
    if kind == "xcircle":
        return [
            circle(16, 16, 8, "none", accent, stroke_width=2.2),
            line(12, 12, 20, 20, accent),
            line(20, 12, 12, 20, accent),
        ]
    return [line(10, 16, 22, 16, accent), line(16, 10, 16, 22, accent)]


def search_symbol(accent: str) -> list[str]:
    return [
        circle(14, 14, 6, "none", accent, stroke_width=2.2),
        line(18, 18, 23, 23, accent),
    ]


def alert_symbol(kind: str, accent: str, accent2: str) -> list[str]:
    if kind == "alert_triangle" or kind == "triangle_alert":
        return [
            polygon("16,6 26,24 6,24", "none", accent, stroke_width=2.2),
            line(16, 11, 16, 17, accent),
            circle(16, 20.5, 1.2, accent2),
        ]
    return [
        circle(16, 16, 8.5, "none", accent, stroke_width=2.2),
        line(16, 12, 16, 18, accent),
        circle(16, 21, 1.2, accent2),
    ]


def file_symbol(kind: str, accent: str, accent2: str) -> list[str]:
    if kind == "folder":
        return [
            path("M6 10 H13 L15 13 H26 V23 C26 24.7 24.7 26 23 26 H9 C7.3 26 6 24.7 6 23 Z", fill=accent, opacity=0.18, stroke=accent),
            path("M6 10 H13 L15 13 H26", stroke=accent),
        ]
    if kind == "folder_open":
        return [
            path("M6 12 L10 8 H14 L16 11 H26 L24 24 H8 Z", fill=accent, opacity=0.18, stroke=accent),
            path("M6 12 H24", stroke=accent),
        ]
    if kind == "folder_plus":
        return [
            path("M6 10 H13 L15 13 H26 V23 C26 24.7 24.7 26 23 26 H9 C7.3 26 6 24.7 6 23 Z", fill=accent, opacity=0.18, stroke=accent),
            line(16, 15, 16, 21, accent),
            line(13, 18, 19, 18, accent),
        ]
    if kind == "folder_archive":
        return [
            path("M6 10 H13 L15 13 H26 V23 C26 24.7 24.7 26 23 26 H9 C7.3 26 6 24.7 6 23 Z", fill=accent, opacity=0.18, stroke=accent),
            rect(12, 15, 8, 7, accent2, opacity=0.3, rx=1.5),
            line(13, 18, 19, 18, accent),
        ]
    if kind == "folder_tree":
        return [
            path("M6 10 H13 L15 13 H26 V23 C26 24.7 24.7 26 23 26 H9 C7.3 26 6 24.7 6 23 Z", fill=accent, opacity=0.18, stroke=accent),
            line(13, 16, 13, 22, accent2),
            line(13, 16, 18, 16, accent2),
            circle(18, 16, 1.1, accent2),
            circle(13, 22, 1.1, accent2),
        ]
    if kind == "folder_git2":
        return [
            path("M6 10 H13 L15 13 H26 V23 C26 24.7 24.7 26 23 26 H9 C7.3 26 6 24.7 6 23 Z", fill=accent, opacity=0.18, stroke=accent),
            line(12, 16, 16, 20, accent2),
            line(16, 20, 20, 16, accent2),
            circle(12, 16, 1.1, accent2),
            circle(20, 16, 1.1, accent2),
            circle(16, 20, 1.1, accent2),
        ]
    if kind == "file":
        return [
            path("M9 5 H20 L26 11 V26 H9 C7.3 26 6 24.7 6 23 V8 C6 6.3 7.3 5 9 5 Z", fill=accent, opacity=0.18, stroke=accent),
            path("M20 5 V11 H26", stroke=accent),
        ]
    if kind == "file_text":
        return [
            path("M9 5 H20 L26 11 V26 H9 C7.3 26 6 24.7 6 23 V8 C6 6.3 7.3 5 9 5 Z", fill=accent, opacity=0.18, stroke=accent),
            line(10, 14, 22, 14, accent),
            line(10, 18, 22, 18, accent),
            line(10, 22, 18, 22, accent2),
            path("M20 5 V11 H26", stroke=accent),
        ]
    if kind == "file_plus":
        return [
            path("M9 5 H20 L26 11 V26 H9 C7.3 26 6 24.7 6 23 V8 C6 6.3 7.3 5 9 5 Z", fill=accent, opacity=0.18, stroke=accent),
            path("M20 5 V11 H26", stroke=accent),
            line(14, 17, 20, 17, accent2),
            line(17, 14, 17, 20, accent2),
        ]
    if kind == "file_search":
        return [
            path("M9 5 H20 L26 11 V26 H9 C7.3 26 6 24.7 6 23 V8 C6 6.3 7.3 5 9 5 Z", fill=accent, opacity=0.18, stroke=accent),
            path("M20 5 V11 H26", stroke=accent),
            circle(18, 18, 3.2, "none", accent2, stroke_width=2),
            line(20.5, 20.5, 23.5, 23.5, accent2),
        ]
    if kind == "folder_plus":
        return [
            path("M6 10 H13 L15 13 H26 V23 C26 24.7 24.7 26 23 26 H9 C7.3 26 6 24.7 6 23 Z", fill=accent, opacity=0.18, stroke=accent),
            line(15.5, 16, 15.5, 22, accent2),
            line(12.5, 19, 18.5, 19, accent2),
        ]
    if kind == "hard_drive":
        return [
            rect(6, 9, 20, 14, accent, opacity=0.16, stroke=accent, rx=4),
            rect(8, 12, 16, 4, accent2, opacity=0.28, rx=2),
            circle(10, 21, 1.1, accent2),
            circle(22, 21, 1.1, accent2),
        ]
    if kind == "hard_drive_download":
        return [
            rect(6, 9, 20, 14, accent, opacity=0.16, stroke=accent, rx=4),
            rect(8, 12, 16, 4, accent2, opacity=0.28, rx=2),
            line(16, 15, 16, 21, accent2),
            path("M13 18 L16 21 L19 18", stroke=accent2),
        ]
    return [
        path("M9 5 H20 L26 11 V26 H9 C7.3 26 6 24.7 6 23 V8 C6 6.3 7.3 5 9 5 Z", fill=accent, opacity=0.12, stroke=accent),
        path("M20 5 V11 H26", stroke=accent),
    ]


def database_symbol(accent: str, accent2: str) -> list[str]:
    return [
        path("M8 10 C8 7.8 11.6 6 16 6 C20.4 6 24 7.8 24 10 C24 12.2 20.4 14 16 14 C11.6 14 8 12.2 8 10 Z", fill=accent, opacity=0.2, stroke=accent),
        rect(8, 10, 16, 10, accent, opacity=0.12, stroke=accent, rx=8),
        path("M8 15 C8 17.2 11.6 19 16 19 C20.4 19 24 17.2 24 15", stroke=accent2),
        path("M8 20 C8 22.2 11.6 24 16 24 C20.4 24 24 22.2 24 20", stroke=accent2),
    ]


def media_symbol(kind: str, accent: str, accent2: str) -> list[str]:
    if kind == "camera":
        return [
            rect(7, 11, 18, 11, accent, opacity=0.16, stroke=accent, rx=3),
            circle(16, 17, 4.2, "none", accent2, stroke_width=2.2),
            rect(10, 8, 6, 4, accent2, opacity=0.6, rx=1),
        ]
    if kind == "image" or kind == "image_icon":
        return [
            rect(7, 8, 18, 15, accent, opacity=0.14, stroke=accent, rx=3),
            path("M10 19 L14 15 L18 19 L21 16 L23 18 V21 H10 Z", fill=accent2, opacity=0.28, stroke=accent2),
            circle(13, 12, 1.2, accent2),
        ]
    if kind == "film":
        return [
            rect(7, 8, 18, 15, accent, opacity=0.14, stroke=accent, rx=2),
            line(11, 8, 11, 23, accent2),
            line(15, 8, 15, 23, accent2),
            line(19, 8, 19, 23, accent2),
            circle(11, 11, 0.8, accent2),
            circle(11, 19, 0.8, accent2),
            circle(19, 11, 0.8, accent2),
            circle(19, 19, 0.8, accent2),
        ]
    if kind == "clapperboard":
        return [
            rect(7, 12, 18, 12, accent, opacity=0.14, stroke=accent, rx=2),
            path("M7 12 L11 8 H26 L22 12 Z", fill=accent2, opacity=0.5, stroke=accent2),
            line(10, 12, 13, 8, accent2),
            line(14, 12, 17, 8, accent2),
            line(18, 12, 21, 8, accent2),
        ]
    if kind == "monitor":
        return [
            rect(6, 8, 20, 14, accent, opacity=0.14, stroke=accent, rx=2.5),
            line(12, 24, 20, 24, accent2),
            line(16, 22, 16, 24, accent2),
            path("M11 12 H21", stroke=accent2),
        ]
    if kind == "monitor_play":
        return [
            rect(6, 8, 20, 14, accent, opacity=0.14, stroke=accent, rx=2.5),
            path("M14 12 L20 16 L14 20 Z", fill=accent2, opacity=0.5, stroke=accent2),
            line(12, 24, 20, 24, accent2),
            line(16, 22, 16, 24, accent2),
        ]
    if kind == "music":
        return [
            path("M17 8 V19.5 C17 21.4 15.4 23 13.5 23 C11.6 23 10 21.4 10 19.5 C10 17.6 11.6 16 13.5 16 C14.2 16 14.9 16.2 15.5 16.6 V9 L22 7.5 V17.5 C22 19.4 20.4 21 18.5 21 C16.6 21 15 19.4 15 17.5 C15 15.6 16.6 14 18.5 14 C19.2 14 19.9 14.2 20.5 14.6", stroke=accent),
        ]
    if kind == "audio_lines":
        return [line(10, 17, 22, 17, accent), line(10, 13, 18, 13, accent2), line(10, 21, 18, 21, accent2)]
    if kind == "audio_waveform":
        return [path("M8 18 Q10 10 12 18 T16 18 T20 18 T24 18", stroke=accent), path("M8 22 Q10 14 12 22 T16 22 T20 22 T24 22", stroke=accent2)]
    if kind == "terminal":
        return [
            rect(6, 8, 20, 14, accent, opacity=0.14, stroke=accent, rx=2),
            path("M10 12 L13 15 L10 18", stroke=accent2),
            line(15, 18, 21, 18, accent2),
        ]
    if kind == "terminal_square":
        return [
            rect(6, 8, 20, 14, accent, opacity=0.14, stroke=accent, rx=2),
            path("M10 12 L13 15 L10 18", stroke=accent2),
            line(15, 18, 21, 18, accent2),
            rect(6, 8, 20, 14, "none", accent, rx=2, stroke_width=2.2),
        ]
    return [rect(8, 8, 16, 16, accent, opacity=0.12, stroke=accent, rx=4)]


def action_symbol(kind: str, accent: str, accent2: str) -> list[str]:
    if kind == "clipboard":
        return [
            rect(9, 8, 14, 18, accent, opacity=0.12, stroke=accent, rx=2.5),
            rect(12, 6, 8, 4, accent2, opacity=0.65, rx=1.5),
            line(12, 13, 20, 13, accent2),
            line(12, 17, 20, 17, accent2),
        ]
    if kind == "copy":
        return [
            rect(8, 9, 10, 12, accent2, opacity=0.18, stroke=accent2, rx=2),
            rect(13, 12, 11, 11, accent, opacity=0.14, stroke=accent, rx=2),
        ]
    if kind == "copy_plus":
        return [
            rect(8, 9, 10, 12, accent2, opacity=0.18, stroke=accent2, rx=2),
            rect(13, 12, 11, 11, accent, opacity=0.14, stroke=accent, rx=2),
            line(19, 16, 23, 16, accent),
            line(21, 14, 21, 18, accent),
        ]
    if kind == "download":
        return [line(16, 8, 16, 20, accent), path("M12 16 L16 20 L20 16", stroke=accent), line(9, 24, 23, 24, accent2)]
    if kind == "upload":
        return [line(16, 20, 16, 8, accent), path("M12 12 L16 8 L20 12", stroke=accent), line(9, 24, 23, 24, accent2)]
    if kind == "external_link":
        return [
            rect(8, 12, 12, 12, "none", accent, rx=2, stroke_width=2.2),
            path("M16 8 H24 V16", stroke=accent2),
            path("M24 8 L14 18", stroke=accent2),
        ]
    if kind == "eye":
        return [path("M6 16 C9 11 12 9 16 9 C20 9 23 11 26 16 C23 21 20 23 16 23 C12 23 9 21 6 16 Z", fill=accent, opacity=0.12, stroke=accent), circle(16, 16, 3, accent2)]
    if kind == "info":
        return [circle(16, 16, 8, "none", accent, stroke_width=2.2), line(16, 12, 16, 18, accent), circle(16, 20, 1.2, accent2)]
    if kind == "loader":
        return [circle(16, 16, 8, "none", accent, stroke_width=2.2, opacity=0.5), path("M24 16 A8 8 0 0 1 20 23", stroke=accent)]
    if kind == "loader2":
        return [circle(16, 16, 8, "none", accent, stroke_width=2.2, opacity=0.5), circle(16, 16, 2.2, accent2)]
    if kind == "loader_circle":
        return [circle(16, 16, 8, "none", accent, stroke_width=2.2, opacity=0.5), circle(16, 8, 1.6, accent2)]
    if kind == "maximize2":
        return [
            path("M10 12 L10 10 L12 10", stroke=accent),
            path("M22 12 L22 10 L20 10", stroke=accent),
            path("M10 20 L10 22 L12 22", stroke=accent),
            path("M22 20 L22 22 L20 22", stroke=accent),
        ]
    if kind == "more_horizontal":
        return [circle(10, 16, 1.4, accent), circle(16, 16, 1.4, accent2), circle(22, 16, 1.4, accent)]
    if kind == "mouse_pointer2":
        return [polygon("9,7 21,16 15,16 18,24 15,25 12,17 8,20", accent, stroke=accent2, stroke_width=1.2, opacity=0.16)]
    if kind == "move_right":
        return [line(8, 16, 22, 16, accent), path("M18 12 L22 16 L18 20", stroke=accent)]
    if kind == "pause":
        return [rect(10, 10, 4, 12, accent, opacity=0.32, rx=1.2), rect(18, 10, 4, 12, accent2, opacity=0.32, rx=1.2)]
    if kind == "pin":
        return [path("M16 6 L19 11 L17 16 L20 18 L16 22 L12 18 L15 16 L13 11 Z", fill=accent, opacity=0.18, stroke=accent)]
    if kind == "pin_off":
        return [path("M16 6 L19 11 L17 16 L20 18 L16 22 L12 18 L15 16 L13 11 Z", fill=accent, opacity=0.18, stroke=accent), line(10, 22, 22, 10, accent2)]
    if kind == "play":
        return [path("M12 10 L22 16 L12 22 Z", fill=accent, opacity=0.3, stroke=accent)]
    if kind == "refresh_ccw" or kind == "refresh_cw":
        return [
            path("M11 10 A8 8 0 1 1 10 21", stroke=accent),
            path("M10 21 L9 17 L13 18", stroke=accent2),
        ]
    if kind == "rotate_ccw":
        return [path("M20 11 A7 7 0 1 0 11 20", stroke=accent), path("M11 20 L10 16 L14 17", stroke=accent2)]
    if kind == "rocket":
        return [path("M16 6 C19 8 22 12 22 16 C22 20 19 23 16 26 C13 23 10 20 10 16 C10 12 13 8 16 6 Z", fill=accent, opacity=0.16, stroke=accent), circle(16, 15, 2.2, accent2)]
    if kind == "save":
        return [rect(8, 8, 16, 16, accent, opacity=0.12, stroke=accent, rx=2), rect(11, 8, 10, 5, accent2, opacity=0.6, rx=1), rect(12, 16, 8, 6, "none", accent, rx=1.5, stroke_width=2)]
    if kind == "scan_line":
        return [rect(8, 8, 16, 16, "none", accent, rx=2, stroke_width=2), line(9, 16, 23, 16, accent2), line(10, 12, 10, 20, accent2)]
    if kind == "scissors":
        return [circle(11, 12, 2.4, "none", accent, stroke_width=2), circle(11, 20, 2.4, "none", accent, stroke_width=2), line(13, 13, 22, 10, accent2), line(13, 19, 22, 22, accent2)]
    if kind == "search":
        return search_symbol(accent)
    if kind == "skip_back":
        return [path("M20 10 L12 16 L20 22 Z", fill=accent, opacity=0.26, stroke=accent), line(22, 10, 22, 22, accent2)]
    if kind == "skip_forward":
        return [path("M12 10 L20 16 L12 22 Z", fill=accent, opacity=0.26, stroke=accent), line(10, 10, 10, 22, accent2)]
    if kind == "trash2":
        return [rect(10, 10, 12, 14, "none", accent, rx=2, stroke_width=2), line(9, 10, 23, 10, accent2), line(13, 7, 19, 7, accent2)]
    if kind == "undo2":
        return [path("M13 12 L8 16 L13 20", stroke=accent), path("M8 16 H18 C21 16 23 18 23 21", stroke=accent2)]
    if kind == "upload":
        return [line(16, 20, 16, 8, accent), path("M12 12 L16 8 L20 12", stroke=accent), line(9, 24, 23, 24, accent2)]
    if kind == "download":
        return [line(16, 8, 16, 20, accent), path("M12 16 L16 20 L20 16", stroke=accent), line(9, 24, 23, 24, accent2)]
    if kind == "clipboard":
        return [rect(9, 8, 14, 18, accent, opacity=0.12, stroke=accent, rx=2.5), rect(12, 6, 8, 4, accent2, opacity=0.65, rx=1.5)]
    if kind == "circle":
        return [circle(16, 16, 8, "none", accent, stroke_width=2.2), circle(16, 16, 1.8, accent2)]
    if kind == "square":
        return [rect(9, 9, 14, 14, "none", accent, rx=3, stroke_width=2.2)]
    if kind == "plus":
        return [line(16, 10, 16, 22, accent), line(10, 16, 22, 16, accent)]
    if kind == "x":
        return [line(10, 10, 22, 22, accent), line(22, 10, 10, 22, accent)]
    if kind == "check":
        return [path("M10 17 L14 21 L22 11", stroke=accent)]
    return [rect(8, 8, 16, 16, accent, opacity=0.12, stroke=accent, rx=4)]


def system_symbol(kind: str, accent: str, accent2: str) -> list[str]:
    if kind == "blocks":
        return [rect(8, 9, 7, 7, accent, opacity=0.22, rx=1.5), rect(17, 9, 7, 7, accent2, opacity=0.22, rx=1.5), rect(12.5, 18, 7, 7, accent, opacity=0.22, rx=1.5)]
    if kind == "bot":
        return [rect(8, 9, 16, 12, accent, opacity=0.14, stroke=accent, rx=4), circle(12, 14, 1.2, accent2), circle(20, 14, 1.2, accent2), line(16, 6, 16, 9, accent2)]
    if kind == "bug":
        return [circle(16, 16, 6, accent, opacity=0.18, stroke=accent), line(16, 10, 16, 6, accent2), line(12, 12, 8, 10, accent2), line(20, 12, 24, 10, accent2), line(12, 20, 8, 22, accent2), line(20, 20, 24, 22, accent2)]
    if kind == "clock":
        return [circle(16, 16, 8, "none", accent, stroke_width=2.2), line(16, 12, 16, 17, accent), line(16, 16, 20, 18, accent2)]
    if kind == "database":
        return database_symbol(accent, accent2)
    if kind == "cpu":
        return [rect(9, 9, 14, 14, accent, opacity=0.12, stroke=accent, rx=2), rect(12, 12, 8, 8, accent2, opacity=0.28, rx=1), line(16, 6, 16, 9, accent2), line(16, 23, 16, 26, accent2), line(6, 16, 9, 16, accent2), line(23, 16, 26, 16, accent2)]
    if kind == "crosshair":
        return [circle(16, 16, 7, "none", accent, stroke_width=2), line(16, 8, 16, 12, accent2), line(16, 20, 16, 24, accent2), line(8, 16, 12, 16, accent2), line(20, 16, 24, 16, accent2), circle(16, 16, 1.4, accent2)]
    if kind == "crop":
        return [line(10, 8, 10, 14, accent), line(8, 10, 14, 10, accent), line(22, 18, 22, 24, accent2), line(18, 22, 24, 22, accent2), line(14, 14, 22, 22, accent)]
    if kind == "database":
        return [path("M8 10 C8 7.8 11.6 6 16 6 C20.4 6 24 7.8 24 10 C24 12.2 20.4 14 16 14 C11.6 14 8 12.2 8 10 Z", fill=accent, opacity=0.18, stroke=accent), path("M8 15 C8 17.2 11.6 19 16 19 C20.4 19 24 17.2 24 15", stroke=accent2), path("M8 20 C8 22.2 11.6 24 16 24 C20.4 24 24 22.2 24 20", stroke=accent2)]
    if kind == "droplet":
        return [path("M16 6 C19 11 23 14 23 18 C23 22.4 19.4 26 16 26 C12.6 26 9 22.4 9 18 C9 14 13 11 16 6 Z", fill=accent, opacity=0.18, stroke=accent), circle(16, 19, 2, accent2)]
    if kind == "edit3" or kind == "pencil":
        return [path("M10 22 L13 23 L23 13 L20 10 Z", fill=accent, opacity=0.2, stroke=accent), path("M13 23 L9 24 L10 20 Z", fill=accent2, opacity=0.5, stroke=accent2)]
    if kind == "eraser":
        return [
            path("M10 20 L17 13 L23 19 L18 24 H12 Z", fill=accent, opacity=0.2, stroke=accent),
            line(12, 22, 20, 14, accent2),
        ]
    if kind == "external_link":
        return [rect(8, 12, 12, 12, "none", accent, rx=2, stroke_width=2.2), path("M16 8 H24 V16", stroke=accent2), path("M24 8 L14 18", stroke=accent2)]
    if kind == "eye":
        return [path("M6 16 C9 11 12 9 16 9 C20 9 23 11 26 16 C23 21 20 23 16 23 C12 23 9 21 6 16 Z", fill=accent, opacity=0.12, stroke=accent), circle(16, 16, 3, accent2)]
    if kind == "hash":
        return [line(12, 8, 10, 24, accent), line(20, 8, 18, 24, accent), line(8, 12, 24, 12, accent2), line(7, 20, 23, 20, accent2)]
    if kind == "highlighter":
        return [
            path("M10 22 L17 15 L21 19 L14 26 H10 Z", fill=accent, opacity=0.18, stroke=accent),
            line(11, 24, 20, 15, accent2),
        ]
    if kind == "home":
        return [path("M8 15 L16 8 L24 15 V24 H8 Z", fill=accent, opacity=0.16, stroke=accent), line(12, 24, 12, 18, accent2), line(20, 24, 20, 18, accent2)]
    if kind == "layers3":
        return [polygon("16,7 24,12 16,17 8,12", accent, opacity=0.16, stroke=accent), polygon("16,13 24,18 16,23 8,18", accent2, opacity=0.16, stroke=accent2), polygon("16,19 22,23 16,27 10,23", accent, opacity=0.12, stroke=accent)]
    if kind == "layout_grid":
        return [rect(8, 8, 6, 6, accent, opacity=0.18, rx=1.2), rect(18, 8, 6, 6, accent2, opacity=0.18, rx=1.2), rect(8, 18, 6, 6, accent2, opacity=0.18, rx=1.2), rect(18, 18, 6, 6, accent, opacity=0.18, rx=1.2)]
    if kind == "list":
        return [line(11, 11, 24, 11, accent), line(11, 16, 24, 16, accent2), line(11, 21, 24, 21, accent)]
    if kind == "list_todo":
        return [rect(8, 10, 3, 3, "none", accent, rx=0.7), rect(8, 15.5, 3, 3, "none", accent2, rx=0.7), rect(8, 21, 3, 3, "none", accent, rx=0.7), line(14, 11.5, 24, 11.5, accent), line(14, 17, 24, 17, accent2), line(14, 22.5, 24, 22.5, accent)]
    if kind == "maximize2":
        return [path("M10 12 L10 10 L12 10", stroke=accent), path("M22 12 L22 10 L20 10", stroke=accent2), path("M10 20 L10 22 L12 22", stroke=accent2), path("M22 20 L22 22 L20 22", stroke=accent)]
    if kind == "message_square_text":
        return [path("M8 9 H24 V21 H15 L11 25 V21 H8 Z", fill=accent, opacity=0.12, stroke=accent), line(11, 13, 21, 13, accent2), line(11, 17, 18, 17, accent2)]
    if kind == "mouse_pointer2":
        return [polygon("8,7 21,16 15,16 18,24 15,25 12,17 8,20", accent, stroke=accent2, opacity=0.16)]
    if kind == "move_right":
        return [line(8, 16, 22, 16, accent), path("M18 12 L22 16 L18 20", stroke=accent)]
    if kind == "pin":
        return [path("M16 6 L19 11 L17 16 L20 18 L16 22 L12 18 L15 16 L13 11 Z", fill=accent, opacity=0.18, stroke=accent)]
    if kind == "pin_off":
        return [path("M16 6 L19 11 L17 16 L20 18 L16 22 L12 18 L15 16 L13 11 Z", fill=accent, opacity=0.18, stroke=accent), line(9, 23, 23, 9, accent2)]
    if kind == "puzzle":
        return [path("M10 10 H14 C14 8.5 15.2 7 16.8 7 C18.4 7 19.6 8.5 19.6 10 H22 V14 C23.5 14 25 15.2 25 16.8 C25 18.4 23.5 19.6 22 19.6 V22 H18 C18 23.5 16.8 25 15.2 25 C13.6 25 12.4 23.5 12.4 22 H10 V18 C8.5 18 7 16.8 7 15.2 C7 13.6 8.5 12.4 10 12.4 Z", fill=accent, opacity=0.16, stroke=accent)]
    if kind == "refresh_ccw" or kind == "refresh_cw":
        return [path("M11 10 A8 8 0 1 1 10 21", stroke=accent), path("M10 21 L9 17 L13 18", stroke=accent2)]
    if kind == "rocket":
        return [path("M16 6 C19 8 22 12 22 16 C22 20 19 23 16 26 C13 23 10 20 10 16 C10 12 13 8 16 6 Z", fill=accent, opacity=0.16, stroke=accent), circle(16, 15, 2.2, accent2)]
    if kind == "rotate_ccw":
        return [path("M20 11 A7 7 0 1 0 11 20", stroke=accent), path("M11 20 L10 16 L14 17", stroke=accent2)]
    if kind == "save":
        return [rect(8, 8, 16, 16, accent, opacity=0.12, stroke=accent, rx=2), rect(11, 8, 10, 5, accent2, opacity=0.6, rx=1), rect(12, 16, 8, 6, "none", accent, rx=1.5, stroke_width=2)]
    if kind == "scan_line":
        return [rect(8, 8, 16, 16, "none", accent, rx=2, stroke_width=2), line(9, 16, 23, 16, accent2), line(10, 12, 10, 20, accent2)]
    if kind == "scissors":
        return [circle(11, 12, 2.4, "none", accent, stroke_width=2), circle(11, 20, 2.4, "none", accent, stroke_width=2), line(13, 13, 22, 10, accent2), line(13, 19, 22, 22, accent2)]
    if kind == "shield":
        return [path("M16 6 L23 9 V15 C23 20 20 23 16 26 C12 23 9 20 9 15 V9 Z", fill=accent, opacity=0.16, stroke=accent)]
    if kind == "shield_alert":
        return [path("M16 6 L23 9 V15 C23 20 20 23 16 26 C12 23 9 20 9 15 V9 Z", fill=accent, opacity=0.16, stroke=accent), line(16, 12, 16, 18, accent2), circle(16, 20, 1.2, accent2)]
    if kind == "shield_check":
        return [path("M16 6 L23 9 V15 C23 20 20 23 16 26 C12 23 9 20 9 15 V9 Z", fill=accent, opacity=0.16, stroke=accent), path("M12 16 L15 19 L21 12", stroke=accent2)]
    if kind == "signature":
        return [path("M8 20 C11 14 13 14 16 18 C18 21 20 21 24 16", stroke=accent), circle(12, 19, 1.1, accent2)]
    if kind == "sliders":
        return [line(8, 10, 24, 10, accent2), circle(12, 10, 1.8, accent), line(8, 16, 24, 16, accent2), circle(19, 16, 1.8, accent), line(8, 22, 24, 22, accent2), circle(15, 22, 1.8, accent)]
    if kind == "sliders_horizontal":
        return [line(8, 10, 24, 10, accent2), circle(12, 10, 1.8, accent), line(8, 16, 24, 16, accent2), circle(19, 16, 1.8, accent), line(8, 22, 24, 22, accent2), circle(15, 22, 1.8, accent)]
    if kind == "sparkles":
        return [path("M16 6 L17.7 12.3 L24 14 L17.7 15.7 L16 22 L14.3 15.7 L8 14 L14.3 12.3 Z", fill=accent, opacity=0.18, stroke=accent), circle(23, 9, 1.1, accent2), circle(10, 22, 0.9, accent2)]
    if kind == "split_square_horizontal" or kind == "square_split_horizontal":
        return [rect(8, 8, 16, 16, "none", accent, rx=3, stroke_width=2), line(16, 8, 16, 24, accent2)]
    if kind == "split_square_vertical":
        return [rect(8, 8, 16, 16, "none", accent, rx=3, stroke_width=2), line(8, 16, 24, 16, accent2)]
    if kind == "square_plus":
        return [rect(8, 8, 16, 16, "none", accent, rx=3, stroke_width=2), line(16, 11, 16, 21, accent2), line(11, 16, 21, 16, accent2)]
    if kind == "star":
        return [path("M16 7 L18.8 12.8 L25 13.3 L20 17.2 L21.6 23.3 L16 20 L10.4 23.3 L12 17.2 L7 13.3 L13.2 12.8 Z", fill=accent, opacity=0.18, stroke=accent)]
    if kind == "star_off":
        return [path("M16 7 L18.8 12.8 L25 13.3 L20 17.2 L21.6 23.3 L16 20 L10.4 23.3 L12 17.2 L7 13.3 L13.2 12.8 Z", fill=accent, opacity=0.18, stroke=accent), line(9, 23, 23, 9, accent2)]
    if kind == "tag":
        return [path("M9 10 H16 L24 18 L18 24 L9 15 Z", fill=accent, opacity=0.16, stroke=accent), circle(15.5, 14.5, 1.1, accent2)]
    if kind == "tags":
        return [path("M8 11 H15 L21 17 L16 22 L8 14 Z", fill=accent, opacity=0.16, stroke=accent), path("M12 8 H19 L25 14 L20 19 L12 11 Z", fill=accent2, opacity=0.14, stroke=accent2)]
    if kind == "table" or kind == "table2":
        return [rect(7, 8, 18, 16, "none", accent, rx=2, stroke_width=2), line(7, 13, 25, 13, accent2), line(7, 18, 25, 18, accent2), line(13, 8, 13, 24, accent2), line(19, 8, 19, 24, accent2)]
    if kind == "triangle_alert":
        return alert_symbol(kind, accent, accent2)
    if kind == "type":
        return [line(8, 10, 24, 10, accent), line(16, 10, 16, 24, accent), path("M11 24 H21", stroke=accent2)]
    if kind == "volume2":
        return [path("M8 16 H12 L18 10 V22 L12 16 H8 Z", fill=accent, opacity=0.16, stroke=accent), path("M20 12 C22 14 22 18 20 20", stroke=accent2), path("M22 9 C25 13 25 19 22 23", stroke=accent2)]
    if kind == "volume_x":
        return [path("M8 16 H12 L18 10 V22 L12 16 H8 Z", fill=accent, opacity=0.16, stroke=accent), line(20, 11, 24, 21, accent2), line(24, 11, 20, 21, accent2)]
    if kind == "waves":
        return [path("M8 16 Q11 10 14 16 T20 16 T26 16", stroke=accent), path("M8 20 Q11 14 14 20 T20 20 T26 20", stroke=accent2)]
    if kind == "x":
        return basic_symbol("x", accent, accent2)
    if kind == "xcircle":
        return basic_symbol("xcircle", accent, accent2)
    if kind == "zap":
        return [polygon("16,6 11,16 16,16 13,26 22,14 17,14", accent, stroke=accent2, stroke_width=1.0, opacity=0.18)]
    return [rect(8, 8, 16, 16, accent, opacity=0.12, stroke=accent, rx=4)]


def panel_sketchfab_symbol(accent: str, accent2: str) -> list[str]:
    return [
        polygon("16,6 24,11 16,16 8,11", accent, opacity=0.18, stroke=accent, stroke_width=2.0),
        polygon("8,11 16,16 16,26 8,21", accent2, opacity=0.15, stroke=accent2, stroke_width=2.0),
        polygon("24,11 16,16 16,26 24,21", accent, opacity=0.14, stroke=accent, stroke_width=2.0),
        line(8, 11, 16, 16, accent2),
        line(24, 11, 16, 16, accent2),
        line(16, 16, 16, 26, accent2),
        circle(16, 16, 1.6, accent2),
    ]


def classify_slot(slot: str) -> str:
    if slot in ARROW_SLOTS:
        return slot
    if slot in CHEVRON_SLOTS:
        return slot
    if slot in BASIC_SYMBOL_SLOTS:
        return slot
    if slot in {"alert_circle", "alert_triangle", "triangle_alert"}:
        return slot
    if slot == "search":
        return "search"
    if slot in FILE_SLOTS:
        return slot
    if slot in MEDIA_SLOTS:
        return slot
    if slot in ACTION_SLOTS:
        return slot
    if slot in SYSTEM_SLOTS:
        return slot
    if slot in DEDICATED_APP_SLOTS:
        return slot
    return "generic"


def render_icon(slot: str) -> str:
    accent, accent2 = slot_colors(slot)
    kind = classify_slot(slot)

    if kind in ARROW_SLOTS:
        return svg_wrap(arrow_symbol(kind, accent))
    if kind in CHEVRON_SLOTS:
        return svg_wrap(chevron_symbol(kind, accent))
    if kind in BASIC_SYMBOL_SLOTS:
        return svg_wrap(basic_symbol(kind, accent, accent2))
    if kind == "search":
        return svg_wrap(search_symbol(accent))
    if kind in {"alert_circle", "alert_triangle", "triangle_alert"}:
        return svg_wrap(alert_symbol(kind, accent, accent2))
    if kind in FILE_SLOTS:
        return svg_wrap(file_symbol(kind, accent, accent2))
    if kind in MEDIA_SLOTS:
        return svg_wrap(media_symbol(kind, accent, accent2))
    if kind in ACTION_SLOTS:
        return svg_wrap(action_symbol(kind, accent, accent2))
    if kind in SYSTEM_SLOTS:
        return svg_wrap(system_symbol(kind, accent, accent2))
    if kind in DEDICATED_APP_SLOTS:
        return svg_wrap(system_symbol(kind, accent, accent2))
    return svg_wrap(frame(accent, accent2))


def render_panel_icon(slot: str) -> str:
    accent, accent2 = slot_colors(slot)
    if slot == "panel_sketchfab":
        return svg_wrap(panel_sketchfab_symbol(accent, accent2))
    return render_icon(slot)


def ensure_file(path: Path, content: str) -> bool:
    path.parent.mkdir(parents=True, exist_ok=True)
    current = path.read_text(encoding="utf-8") if path.exists() else None
    if current == content:
        return False
    path.write_text(content, encoding="utf-8")
    return True


def main() -> None:
    slots = read_app_icon_slots()
    manifest = read_manifest()
    icon_definitions = manifest.setdefault("iconDefinitions", {})
    ui_icons = manifest.setdefault("uiIcons", {})

    generated: list[str] = []
    added_manifest_entries: list[str] = []

    for slot in slots:
        if ui_icons.get(slot) != slot:
            ui_icons[slot] = slot
            added_manifest_entries.append(f"uiIcons.{slot}")

        if slot in DEDICATED_APP_SLOTS or slot not in icon_definitions:
            icon_definitions[slot] = f"ui/{slot}.svg"
            svg_path = ZEN_UI_DIR / f"{slot}.svg"
            svg = render_icon(slot)
            if ensure_file(svg_path, svg):
                generated.append(str(svg_path.relative_to(ZEN_THEME_DIR)))

    # Keep the panel coverage examples explicit and aligned with the UI slot
    # contract. We only add these if they do not already exist.
    panel_overrides = {
        "panel_storage": "panel_storage",
        "panel_notes": "panel_notes",
        "panel_screenshots": "panel_screenshots",
        "panel_plugins": "panel_plugins",
        "panel_settings": "panel_settings",
        "panel_drawable_canvas": "panel_drawable_canvas",
        "panel_chronorift": "panel_chronorift",
        "panel_filesystem_aquarium": "panel_filesystem_aquarium",
        "panel_vibe_capsule": "panel_vibe_capsule",
        "panel_sketchfab": "panel_sketchfab",
    }
    for slot, icon_id in panel_overrides.items():
        if ui_icons.get(slot) != icon_id:
            ui_icons[slot] = icon_id
            added_manifest_entries.append(f"uiIcons.{slot}")
        if slot == "panel_sketchfab":
            icon_definitions[slot] = f"ui/{slot}.svg"
            svg_path = ZEN_UI_DIR / f"{slot}.svg"
            svg = render_panel_icon(slot)
            if ensure_file(svg_path, svg):
                generated.append(str(svg_path.relative_to(ZEN_THEME_DIR)))

    write_manifest(manifest)

    print(f"Updated Zen manifest at {ZEN_THEME_PATH}")
    print(f"Generated/updated {len(generated)} UI glyph SVGs under {ZEN_UI_DIR}")
    if generated:
        for rel_path in generated:
            print(f" - {rel_path}")
    if added_manifest_entries:
        print("Manifest entries touched:")
        for entry in added_manifest_entries:
            print(f" - {entry}")


if __name__ == "__main__":
    main()
