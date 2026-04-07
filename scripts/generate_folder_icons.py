from __future__ import annotations

import argparse
import json
import math
import hashlib
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List
from xml.sax.saxutils import escape

try:
    from folder_icon_lib import (
        build_generic_icon_id,
        collect_folder_names,
        load_config,
        now_iso,
        output_manifest_path,
        parse_monorepo_map,
        pick_family,
        slugify,
        stable_choice,
        stable_int,
        write_json,
    )
except ModuleNotFoundError:
    def stable_int(value: str) -> int:
        return int(hashlib.sha256(value.encode("utf-8")).hexdigest()[:8], 16)

    def stable_choice(options: List[str], seed: str) -> str:
        return options[stable_int(seed) % len(options)]

    def slugify(value: str) -> str:
        normalized = "".join(ch.lower() if ch.isalnum() else "-" for ch in value)
        return "-".join(part for part in normalized.split("-") if part)

    def now_iso() -> str:
        return datetime.now(timezone.utc).isoformat()

    def write_json(path: Path, payload: Dict[str, Any]) -> None:
        path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    def output_manifest_path(base_dir: Path) -> Path:
        return base_dir / "scripts" / "icon-data" / "folder-icon-manifest.json"

    def build_generic_icon_id(index: int) -> str:
        return f"generic-{index:03d}"

    def parse_monorepo_map(_path: Path) -> List[Any]:
        return []

    def collect_folder_names(entries: List[Any], bonus_exact_names: List[str]) -> List[str]:
        names = list(bonus_exact_names)
        names.extend(getattr(entry, "name", "") for entry in entries)
        return sorted({name for name in names if name}, key=str.lower)

    def load_config(base_dir: Path) -> Dict[str, Any]:
        return {
            "ui_forge_parent": str(base_dir),
            "ui_forge_root": str(base_dir),
            "source_map": str(base_dir / "docs" / "architecture" / "repomap.md"),
            "output_dir": str(base_dir / "output" / "folder-icon-library"),
            "render_formats": ["svg"],
            "ico_sizes": [16, 24, 32, 48, 64, 128, 256],
            "source_size": 256,
            "bonus_exact_names": [],
            "generic_icon_count": 48,
            "generic_families": ["generic_core", "generic_docs", "generic_ops", "generic_assets"],
            "family_styles": {
                "source": {"palette": "blue", "pattern": "bars", "badge": "code"},
                "docs": {"palette": "amber", "pattern": "grid", "badge": "book"},
                "crates": {"palette": "orange", "pattern": "grid", "badge": "crate"},
                "config": {"palette": "purple", "pattern": "dots", "badge": "sliders"},
                "build": {"palette": "orange", "pattern": "bars", "badge": "wrench"},
                "assets": {"palette": "pink", "pattern": "wave", "badge": "template"},
                "packages": {"palette": "indigo", "pattern": "grid", "badge": "stack"},
                "plugins": {"palette": "fuchsia", "pattern": "dots", "badge": "plug"},
                "database": {"palette": "cyan", "pattern": "grid", "badge": "chip"},
                "api": {"palette": "red", "pattern": "grid", "badge": "nodes"},
                "scripts": {"palette": "green", "pattern": "bars", "badge": "terminal"},
                "tests": {"palette": "lime", "pattern": "dots", "badge": "flask"},
                "public": {"palette": "sky", "pattern": "wave", "badge": "globe"},
                "engine": {"palette": "teal", "pattern": "grid", "badge": "engine"},
                "ai": {"palette": "violet", "pattern": "wave", "badge": "spark"},
                "components": {"palette": "emerald", "pattern": "grid", "badge": "dotgrid"},
                "automation": {"palette": "yellow", "pattern": "dots", "badge": "automation"},
                "shared": {"palette": "slate", "pattern": "grid", "badge": "shared"},
                "generic_core": {"palette": "slate", "pattern": "grid", "badge": "stack"},
                "generic_docs": {"palette": "stone", "pattern": "dots", "badge": "book"},
                "generic_ops": {"palette": "zinc", "pattern": "bars", "badge": "chip"},
                "generic_assets": {"palette": "sky", "pattern": "wave", "badge": "template"}
            }
        }

    def pick_family(name: str, config: Dict[str, Any]) -> str:
        normalized = slugify(name)
        keyword_map = {
            "source": {"src", "source", "sources", "lib", "libs", "app", "apps", "core"},
            "docs": {"doc", "docs", "documentation", "guides", "reference", "notes"},
            "crates": {"crate", "crates"},
            "config": {"config", "configs", "configuration", "settings", "schemas"},
            "build": {"build", "dist", "out", "output", "target", "bin", "release", "generated"},
            "assets": {"assets", "media", "images", "icons", "fonts", "styles", "themes", "textures", "materials", "models", "audio", "video", "screenshots"},
            "packages": {"package", "packages", "modules", "node-modules", "node_modules", "vendor", "third-party", "third_party"},
            "plugins": {"plugin", "plugins", "extensions", "integrations"},
            "database": {"database", "db", "data", "migrations", "storage"},
            "api": {"api", "services", "server", "backend", "workers", "jobs", "tasks"},
            "scripts": {"scripts", "script", "cli", "tools", "tooling"},
            "tests": {"test", "tests", "spec", "specs", "fixtures", "mocks", "coverage"},
            "public": {"public", "web", "frontend", "client"},
            "engine": {"engine", "editor", "runtime", "shaders", "scenes", "animation"},
            "ai": {"ai", "agents", "prompts", "models-ai", "models_ai"},
            "components": {"components", "pages", "routes", "views", "layouts", "hooks", "store", "state", "ui"},
            "automation": {"automation", "workflows", "pipelines"},
            "shared": {"shared", "common"}
        }
        tokens = set(normalized.split("-"))
        for family, keywords in keyword_map.items():
            if tokens & keywords or normalized in keywords:
                return family
        return stable_choice(config["generic_families"], normalized)


BASE_DIR = Path(__file__).resolve().parent
CONFIG = load_config(BASE_DIR)

for path_value in (CONFIG["ui_forge_parent"], CONFIG["ui_forge_root"]):
    if path_value not in sys.path:
        sys.path.insert(0, path_value)

try:
    from core import UIForgeEngine
    from llm_api import circle, icon, line, path, polygon, rect, solid, stroke  # noqa: E402
except ModuleNotFoundError:
    UIForgeEngine = None

    def solid(color: str) -> Dict[str, Any]:
        return {"colors": [color]}

    def stroke(color: str, width: int = 1, cap: str = "round", join: str = "round", miter_limit: int = 4) -> Dict[str, Any]:
        return {"color": color, "width": width, "cap": cap, "join": join, "miter_limit": miter_limit}

    def rect(x: int, y: int, width: int, height: int, rx: int | None = None, ry: int | None = None, fill: Dict[str, Any] | None = None, stroke: Dict[str, Any] | None = None, opacity: float = 1.0) -> Dict[str, Any]:
        geometry: Dict[str, Any] = {"x": x, "y": y, "width": width, "height": height}
        if rx is not None:
            geometry["rx"] = rx
        if ry is not None:
            geometry["ry"] = ry
        return {"type": "rect", "geometry": geometry, "fill": fill, "stroke": stroke, "opacity": opacity}

    def circle(cx: int, cy: int, r: int, fill: Dict[str, Any] | None = None, stroke: Dict[str, Any] | None = None, opacity: float = 1.0) -> Dict[str, Any]:
        return {"type": "circle", "geometry": {"cx": cx, "cy": cy, "r": r}, "fill": fill, "stroke": stroke, "opacity": opacity}

    def polygon(points: List[tuple[int, int]], fill: Dict[str, Any] | None = None, stroke: Dict[str, Any] | None = None, opacity: float = 1.0) -> Dict[str, Any]:
        return {"type": "polygon", "geometry": {"points": points}, "fill": fill, "stroke": stroke, "opacity": opacity}

    def line(x1: int, y1: int, x2: int, y2: int, stroke: Dict[str, Any] | None = None, fill: Dict[str, Any] | None = None, opacity: float = 1.0) -> Dict[str, Any]:
        return {"type": "line", "geometry": {"x1": x1, "y1": y1, "x2": x2, "y2": y2}, "fill": fill, "stroke": stroke, "opacity": opacity}

    def path(d: str, stroke: Dict[str, Any] | None = None, fill: Dict[str, Any] | None = None, opacity: float = 1.0) -> Dict[str, Any]:
        return {"type": "path", "geometry": {"d": d}, "fill": fill, "stroke": stroke, "opacity": opacity}

    def icon(*_args: Any, **_kwargs: Any) -> Dict[str, Any]:
        return {}


PALETTES: Dict[str, List[List[str]]] = {
    "amber": [["#f59e0b", "#d97706", "#fcd34d", "#7c2d12"], ["#fb7185", "#be123c", "#fed7aa", "#4a044e"]],
    "blue": [["#60a5fa", "#2563eb", "#bfdbfe", "#0f172a"], ["#38bdf8", "#0284c7", "#bae6fd", "#082f49"]],
    "cyan": [["#22d3ee", "#0891b2", "#a5f3fc", "#083344"], ["#67e8f9", "#0e7490", "#cffafe", "#164e63"]],
    "emerald": [["#34d399", "#059669", "#a7f3d0", "#022c22"], ["#10b981", "#047857", "#d1fae5", "#064e3b"]],
    "fuchsia": [["#e879f9", "#c026d3", "#f5d0fe", "#4a044e"], ["#f472b6", "#db2777", "#fbcfe8", "#500724"]],
    "green": [["#4ade80", "#16a34a", "#bbf7d0", "#052e16"], ["#22c55e", "#15803d", "#dcfce7", "#14532d"]],
    "indigo": [["#818cf8", "#4338ca", "#c7d2fe", "#1e1b4b"], ["#6366f1", "#4f46e5", "#e0e7ff", "#312e81"]],
    "lime": [["#a3e635", "#65a30d", "#d9f99d", "#1a2e05"], ["#bef264", "#4d7c0f", "#ecfccb", "#365314"]],
    "orange": [["#fb923c", "#ea580c", "#fed7aa", "#431407"], ["#f97316", "#c2410c", "#ffedd5", "#7c2d12"]],
    "pink": [["#f472b6", "#db2777", "#fbcfe8", "#500724"], ["#fb7185", "#e11d48", "#ffe4e6", "#4c0519"]],
    "purple": [["#c084fc", "#9333ea", "#e9d5ff", "#3b0764"], ["#a78bfa", "#7c3aed", "#ede9fe", "#2e1065"]],
    "red": [["#f87171", "#dc2626", "#fecaca", "#450a0a"], ["#fb7185", "#be123c", "#ffe4e6", "#4c0519"]],
    "rose": [["#fb7185", "#e11d48", "#fecdd3", "#4c0519"], ["#f43f5e", "#be123c", "#ffe4e6", "#881337"]],
    "sky": [["#38bdf8", "#0ea5e9", "#bae6fd", "#082f49"], ["#7dd3fc", "#0284c7", "#e0f2fe", "#0c4a6e"]],
    "slate": [["#94a3b8", "#475569", "#e2e8f0", "#0f172a"], ["#64748b", "#334155", "#cbd5e1", "#020617"]],
    "stone": [["#a8a29e", "#57534e", "#e7e5e4", "#1c1917"], ["#d6d3d1", "#78716c", "#fafaf9", "#292524"]],
    "teal": [["#2dd4bf", "#0f766e", "#99f6e4", "#042f2e"], ["#14b8a6", "#0d9488", "#ccfbf1", "#134e4a"]],
    "violet": [["#a78bfa", "#7c3aed", "#ddd6fe", "#2e1065"], ["#8b5cf6", "#6d28d9", "#ede9fe", "#3b0764"]],
    "yellow": [["#facc15", "#ca8a04", "#fef08a", "#422006"], ["#fde047", "#a16207", "#fef9c3", "#713f12"]],
    "zinc": [["#a1a1aa", "#52525b", "#e4e4e7", "#18181b"], ["#d4d4d8", "#71717a", "#fafafa", "#27272a"]]
}

GENERIC_BADGES = ["spark", "stack", "dotgrid", "wave", "grid", "chip", "signal", "archive"]
TAXONOMY_PATH = BASE_DIR / "scripts" / "icon-data" / "icon_taxonomy.json"


def load_enterprise_folder_library() -> List[str]:
    data = json.loads(TAXONOMY_PATH.read_text(encoding="utf-8"))
    names = data.get("folder_library", [])
    unique_names = sorted({str(name).strip() for name in names if str(name).strip()}, key=str.lower)
    return unique_names


def palette_for(family: str, seed: str) -> List[str]:
    palette_name = CONFIG["family_styles"][family]["palette"]
    variants = PALETTES[palette_name]
    return variants[stable_int(seed + "::palette") % len(variants)]


def folder_layers(colors: List[str], seed: str) -> List[Dict[str, Any]]:
    primary, secondary, highlight, ink = colors
    stripe_opacity = 0.18 + (stable_int(seed + "::stripe") % 12) / 100
    layers = [
        rect(26, 64, 204, 138, rx=28, fill=solid(secondary)),
        rect(42, 48, 74, 34, rx=16, fill=solid(primary)),
        rect(20, 78, 216, 132, rx=30, fill=solid(primary)),
        rect(30, 90, 196, 100, rx=24, fill=solid(highlight), opacity=0.14),
        rect(20, 166, 216, 12, rx=6, fill=solid(ink), opacity=0.1),
        rect(34, 106, 188, 10, rx=5, fill=solid(highlight), opacity=0.12)
    ]

    pattern = CONFIG["family_styles"][pick_family(seed, CONFIG)]["pattern"] if False else None
    variant = stable_int(seed + "::tab") % 3
    if variant == 0:
        layers.append(rect(150, 52, 54, 12, rx=6, fill=solid(highlight), opacity=0.18))
    elif variant == 1:
        layers.append(rect(134, 54, 72, 8, rx=4, fill=solid(highlight), opacity=0.14))
    else:
        layers.append(rect(126, 52, 82, 10, rx=5, fill=solid(highlight), opacity=0.16))

    stripe_count = 3 + stable_int(seed + "::bars") % 3
    for index in range(stripe_count):
        layers.append(
            rect(
                48 + index * 24,
                138,
                10,
                48,
                rx=4,
                fill=solid(ink),
                opacity=stripe_opacity
            )
        )
    return layers


def badge_layers(kind: str, colors: List[str], seed: str) -> List[Dict[str, Any]]:
    primary, secondary, highlight, ink = colors
    outline = stroke(ink, width=8, cap="round", join="round")
    soft_outline = stroke(ink, width=6, cap="round", join="round")

    if kind == "book":
        return [
            rect(126, 118, 66, 54, rx=10, fill=solid("#ffffff"), stroke=soft_outline),
            line(159, 122, 159, 170, stroke=stroke(ink, width=6)),
            line(140, 136, 154, 136, stroke=stroke(secondary, width=5)),
            line(164, 136, 178, 136, stroke=stroke(secondary, width=5))
        ]
    if kind == "terminal":
        return [
            rect(124, 118, 72, 54, rx=12, fill=solid(ink), opacity=0.94),
            line(138, 136, 152, 146, stroke=stroke(highlight, width=7)),
            line(138, 156, 152, 146, stroke=stroke(highlight, width=7)),
            line(160, 158, 180, 158, stroke=stroke(highlight, width=6))
        ]
    if kind == "crate":
        return [
            polygon([(130, 130), (158, 118), (188, 132), (160, 144)], fill=solid(highlight), stroke=soft_outline),
            polygon([(130, 130), (130, 158), (160, 174), (160, 144)], fill=solid("#ffffff"), stroke=soft_outline),
            polygon([(160, 144), (188, 132), (188, 162), (160, 174)], fill=solid(primary), stroke=soft_outline)
        ]
    if kind == "node":
        return [
            circle(142, 144, 10, fill=solid("#ffffff"), stroke=soft_outline),
            circle(178, 132, 10, fill=solid("#ffffff"), stroke=soft_outline),
            circle(178, 162, 10, fill=solid("#ffffff"), stroke=soft_outline),
            line(150, 142, 168, 134, stroke=stroke(ink, width=6)),
            line(150, 146, 168, 160, stroke=stroke(ink, width=6))
        ]
    if kind == "code":
        return [
            line(142, 130, 128, 145, stroke=stroke("#ffffff", width=8)),
            line(128, 145, 142, 160, stroke=stroke("#ffffff", width=8)),
            line(178, 130, 192, 145, stroke=stroke("#ffffff", width=8)),
            line(192, 145, 178, 160, stroke=stroke("#ffffff", width=8)),
            line(160, 126, 150, 164, stroke=stroke(highlight, width=7))
        ]
    if kind == "chip":
        layers = [rect(136, 126, 48, 40, rx=8, fill=solid("#ffffff"), stroke=soft_outline)]
        for offset in range(4):
            y = 132 + offset * 10
            layers.append(line(128, y, 136, y, stroke=stroke(ink, width=4)))
            layers.append(line(184, y, 192, y, stroke=stroke(ink, width=4)))
        return layers
    if kind == "wrench":
        return [
            circle(142, 132, 10, fill=solid("#ffffff"), stroke=soft_outline),
            line(148, 138, 176, 166, stroke=stroke("#ffffff", width=10)),
            circle(182, 172, 9, fill=solid(primary), stroke=soft_outline)
        ]
    if kind == "globe" or kind == "web":
        return [
            circle(160, 145, 28, fill=solid("#ffffff"), stroke=soft_outline),
            line(132, 145, 188, 145, stroke=stroke(secondary, width=5)),
            line(160, 117, 160, 173, stroke=stroke(secondary, width=5)),
            path("M 140 126 Q 160 145 140 164", stroke=stroke(secondary, width=4)),
            path("M 180 126 Q 160 145 180 164", stroke=stroke(secondary, width=4))
        ]
    if kind == "audio":
        return [
            line(134, 152, 144, 136, stroke=stroke("#ffffff", width=8)),
            line(144, 136, 156, 136, stroke=stroke("#ffffff", width=8)),
            line(156, 136, 156, 164, stroke=stroke("#ffffff", width=8)),
            circle(152, 170, 8, fill=solid("#ffffff")),
            circle(176, 160, 8, fill=solid("#ffffff")),
            line(176, 130, 176, 160, stroke=stroke("#ffffff", width=8))
        ]
    if kind == "archive" or kind == "outbox":
        return [
            rect(130, 126, 60, 44, rx=10, fill=solid("#ffffff"), stroke=soft_outline),
            rect(142, 120, 36, 12, rx=6, fill=solid(highlight), stroke=stroke(ink, width=5)),
            line(146, 148, 174, 148, stroke=stroke(secondary, width=6))
        ]
    if kind == "flask" or kind == "beaker":
        return [
            path("M 148 122 L 172 122 L 166 138 L 184 168 Q 186 176 178 178 L 142 178 Q 134 176 136 168 L 154 138 Z", fill=solid("#ffffff"), stroke=soft_outline),
            line(146, 164, 174, 164, stroke=stroke(secondary, width=6))
        ]
    if kind == "plug":
        return [
            rect(144, 130, 30, 28, rx=8, fill=solid("#ffffff"), stroke=soft_outline),
            line(150, 122, 150, 130, stroke=stroke("#ffffff", width=6)),
            line(168, 122, 168, 130, stroke=stroke("#ffffff", width=6)),
            line(159, 158, 159, 172, stroke=stroke("#ffffff", width=8))
        ]
    if kind == "unreal":
        return [
            path("M 138 124 Q 138 176 160 176 Q 182 176 182 124", stroke=stroke("#ffffff", width=10)),
            line(138, 124, 150, 124, stroke=stroke("#ffffff", width=8)),
            line(170, 124, 182, 124, stroke=stroke("#ffffff", width=8))
        ]
    if kind == "python":
        return [
            rect(134, 126, 30, 22, rx=10, fill=solid("#3776ab"), stroke=stroke("#ffffff", width=4)),
            rect(156, 144, 30, 22, rx=10, fill=solid("#ffd43b"), stroke=stroke("#ffffff", width=4)),
            circle(156, 136, 3, fill=solid("#ffffff")),
            circle(164, 158, 3, fill=solid(ink))
        ]
    if kind == "shared":
        return [
            circle(144, 144, 10, fill=solid("#ffffff"), stroke=soft_outline),
            circle(176, 144, 10, fill=solid("#ffffff"), stroke=soft_outline),
            circle(160, 168, 10, fill=solid("#ffffff"), stroke=soft_outline),
            line(152, 146, 168, 146, stroke=stroke(secondary, width=6)),
            line(149, 152, 156, 160, stroke=stroke(secondary, width=6)),
            line(171, 152, 164, 160, stroke=stroke(secondary, width=6))
        ]
    if kind == "automation":
        return [
            circle(160, 146, 22, fill=solid("#ffffff"), stroke=soft_outline),
            circle(160, 146, 8, fill=solid(primary)),
            line(160, 116, 160, 126, stroke=stroke(ink, width=6)),
            line(160, 166, 160, 176, stroke=stroke(ink, width=6)),
            line(130, 146, 140, 146, stroke=stroke(ink, width=6)),
            line(180, 146, 190, 146, stroke=stroke(ink, width=6))
        ]
    if kind == "browser" or kind == "window":
        return [
            rect(126, 120, 68, 52, rx=10, fill=solid("#ffffff"), stroke=soft_outline),
            rect(126, 120, 68, 12, rx=10, fill=solid(highlight)),
            circle(138, 126, 3, fill=solid(primary)),
            circle(148, 126, 3, fill=solid(primary)),
            circle(158, 126, 3, fill=solid(primary))
        ]
    if kind == "engine":
        return [
            circle(160, 146, 22, fill=solid("#ffffff"), stroke=soft_outline),
            circle(160, 146, 8, fill=solid(primary)),
            polygon([(160, 118), (166, 126), (154, 126)], fill=solid("#ffffff")),
            polygon([(188, 146), (180, 152), (180, 140)], fill=solid("#ffffff")),
            polygon([(160, 174), (166, 166), (154, 166)], fill=solid("#ffffff")),
            polygon([(132, 146), (140, 152), (140, 140)], fill=solid("#ffffff"))
        ]
    if kind == "factory":
        return [
            rect(132, 136, 58, 34, rx=4, fill=solid("#ffffff"), stroke=soft_outline),
            polygon([(132, 136), (146, 122), (158, 136), (172, 122), (190, 136)], fill=solid("#ffffff"), stroke=soft_outline),
            rect(144, 148, 10, 22, rx=2, fill=solid(primary)),
            rect(160, 148, 10, 22, rx=2, fill=solid(primary))
        ]
    if kind == "gamepad":
        return [
            rect(130, 136, 60, 28, rx=14, fill=solid("#ffffff"), stroke=soft_outline),
            line(144, 150, 156, 150, stroke=stroke(primary, width=6)),
            line(150, 144, 150, 156, stroke=stroke(primary, width=6)),
            circle(172, 146, 4, fill=solid(primary)),
            circle(180, 154, 4, fill=solid(primary))
        ]
    if kind == "hub":
        return [
            circle(160, 146, 12, fill=solid("#ffffff"), stroke=soft_outline),
            circle(132, 132, 8, fill=solid("#ffffff"), stroke=soft_outline),
            circle(188, 132, 8, fill=solid("#ffffff"), stroke=soft_outline),
            circle(160, 174, 8, fill=solid("#ffffff"), stroke=soft_outline),
            line(142, 140, 150, 144, stroke=stroke(secondary, width=6)),
            line(178, 140, 170, 144, stroke=stroke(secondary, width=6)),
            line(160, 158, 160, 166, stroke=stroke(secondary, width=6))
        ]
    if kind == "kain":
        return [
            line(138, 124, 138, 176, stroke=stroke("#ffffff", width=10)),
            line(138, 150, 180, 124, stroke=stroke(highlight, width=8)),
            line(152, 148, 184, 176, stroke=stroke("#ffffff", width=8))
        ]
    if kind == "kos":
        return [
            line(138, 124, 138, 176, stroke=stroke("#ffffff", width=10)),
            line(138, 150, 176, 124, stroke=stroke(highlight, width=8)),
            line(138, 150, 176, 176, stroke=stroke(highlight, width=8)),
            line(150, 150, 186, 150, stroke=stroke("#ffffff", width=8))
        ]
    if kind == "mocap":
        return [
            circle(160, 126, 8, fill=solid("#ffffff")),
            circle(160, 146, 7, fill=solid("#ffffff")),
            circle(144, 164, 6, fill=solid("#ffffff")),
            circle(176, 164, 6, fill=solid("#ffffff")),
            line(160, 134, 160, 156, stroke=stroke("#ffffff", width=6)),
            line(160, 150, 144, 162, stroke=stroke("#ffffff", width=5)),
            line(160, 150, 176, 162, stroke=stroke("#ffffff", width=5))
        ]
    if kind == "model" or kind == "prism":
        return [
            polygon([(160, 118), (186, 132), (186, 160), (160, 174), (134, 160), (134, 132)], fill=solid("#ffffff"), stroke=soft_outline),
            line(160, 118, 160, 174, stroke=stroke(primary, width=5)),
            line(134, 132, 160, 146, stroke=stroke(primary, width=5)),
            line(186, 132, 160, 146, stroke=stroke(primary, width=5))
        ]
    if kind == "portal":
        return [
            circle(160, 146, 26, fill=solid("#ffffff"), stroke=soft_outline),
            circle(160, 146, 12, fill=solid(primary)),
            line(160, 118, 160, 126, stroke=stroke(highlight, width=6)),
            line(160, 166, 160, 174, stroke=stroke(highlight, width=6))
        ]
    if kind == "prompt":
        return [
            polygon([(160, 120), (166, 138), (184, 144), (166, 150), (160, 168), (154, 150), (136, 144), (154, 138)], fill=solid("#ffffff"), stroke=soft_outline),
            circle(186, 128, 4, fill=solid(highlight)),
            circle(134, 162, 4, fill=solid(highlight))
        ]
    if kind == "pulse" or kind == "signal" or kind == "wave":
        return [
            path("M 132 154 L 144 154 L 152 138 L 162 166 L 170 146 L 188 146", stroke=stroke("#ffffff", width=8))
        ]
    if kind == "sliders":
        return [
            line(138, 132, 182, 132, stroke=stroke("#ffffff", width=6)),
            line(138, 146, 182, 146, stroke=stroke("#ffffff", width=6)),
            line(138, 160, 182, 160, stroke=stroke("#ffffff", width=6)),
            circle(152, 132, 7, fill=solid(highlight)),
            circle(172, 146, 7, fill=solid(highlight)),
            circle(160, 160, 7, fill=solid(highlight))
        ]
    if kind == "shelves":
        return [
            rect(136, 124, 48, 50, rx=6, fill=solid("#ffffff"), stroke=soft_outline),
            line(136, 142, 184, 142, stroke=stroke(primary, width=5)),
            line(136, 158, 184, 158, stroke=stroke(primary, width=5))
        ]
    if kind == "stack":
        return [
            rect(138, 126, 44, 14, rx=6, fill=solid("#ffffff"), stroke=soft_outline),
            rect(134, 142, 52, 14, rx=6, fill=solid(highlight), stroke=soft_outline),
            rect(130, 158, 60, 14, rx=6, fill=solid("#ffffff"), stroke=soft_outline)
        ]
    if kind == "spark":
        return [
            polygon([(160, 120), (166, 140), (186, 146), (166, 152), (160, 172), (154, 152), (134, 146), (154, 140)], fill=solid("#ffffff"), stroke=soft_outline)
        ]
    if kind == "template":
        return [
            rect(132, 122, 56, 54, rx=10, fill=solid("#ffffff"), stroke=soft_outline),
            line(144, 138, 176, 138, stroke=stroke(primary, width=5)),
            line(144, 150, 176, 150, stroke=stroke(primary, width=5)),
            line(144, 162, 168, 162, stroke=stroke(primary, width=5))
        ]
    if kind == "nodes":
        return [
            circle(140, 132, 8, fill=solid("#ffffff"), stroke=soft_outline),
            circle(180, 132, 8, fill=solid("#ffffff"), stroke=soft_outline),
            circle(160, 166, 8, fill=solid("#ffffff"), stroke=soft_outline),
            line(148, 136, 172, 136, stroke=stroke(primary, width=5)),
            line(146, 140, 156, 160, stroke=stroke(primary, width=5)),
            line(174, 140, 164, 160, stroke=stroke(primary, width=5))
        ]
    if kind == "dotgrid":
        layers: List[Dict[str, Any]] = []
        for x in (144, 160, 176):
            for y in (132, 148, 164):
                layers.append(circle(x, y, 4, fill=solid("#ffffff")))
        return layers

    return [
        circle(160, 146, 20, fill=solid("#ffffff"), stroke=outline),
        circle(160, 146, 8, fill=solid(primary))
    ]


def pattern_layers(pattern: str, colors: List[str], seed: str) -> List[Dict[str, Any]]:
    primary, secondary, highlight, ink = colors
    opacity = 0.08 + (stable_int(seed + "::pattern") % 7) / 100
    layers: List[Dict[str, Any]] = []

    if pattern == "grid":
        for x in (64, 98, 132, 166, 200):
            layers.append(rect(x, 102, 4, 84, rx=2, fill=solid(ink), opacity=opacity))
        for y in (114, 138, 162):
            layers.append(rect(46, y, 168, 4, rx=2, fill=solid(ink), opacity=opacity))
    elif pattern == "dots":
        for x in (72, 108, 144, 180):
            for y in (116, 144, 172):
                layers.append(circle(x, y, 3, fill=solid(ink), opacity=opacity + 0.04))
    elif pattern == "bars":
        for index in range(5):
            layers.append(rect(52 + index * 28, 116, 16, 56, rx=6, fill=solid(ink), opacity=opacity))
    elif pattern == "wave":
        layers.append(path("M 44 152 Q 62 138 80 152 T 116 152 T 152 152 T 188 152 T 224 152", stroke=stroke(ink, width=5), opacity=opacity + 0.06))
        layers.append(path("M 44 170 Q 62 156 80 170 T 116 170 T 152 170 T 188 170 T 224 170", stroke=stroke(ink, width=5), opacity=opacity + 0.04))
    else:
        for index in range(6):
            x = 46 + index * 30
            layers.append(polygon([(x, 176), (x + 10, 176), (x + 44, 116), (x + 34, 116)], fill=solid(ink), opacity=opacity))

    layers.append(rect(40, 114, 176, 70, rx=18, fill=solid(highlight), opacity=0.05))
    return layers


def build_icon_layers(family: str, asset_name: str) -> List[Dict[str, Any]]:
    style = CONFIG["family_styles"][family]
    colors = palette_for(family, asset_name)
    layers = folder_layers(colors, asset_name)
    layers.extend(pattern_layers(style["pattern"], colors, asset_name))

    badge = style["badge"]
    if family.startswith("generic"):
        badge = stable_choice(GENERIC_BADGES, asset_name)
    layers.extend(badge_layers(badge, colors, asset_name))

    return layers


def build_exact_catalog(folder_names: List[str]) -> List[Dict[str, Any]]:
    catalog: List[Dict[str, Any]] = []
    seen_asset_names: set[str] = set()
    for folder_name in folder_names:
        family = pick_family(folder_name, CONFIG)
        asset_name = f"folder-{slugify(folder_name)}"
        if asset_name in seen_asset_names:
            continue
        seen_asset_names.add(asset_name)
        catalog.append(
            {
                "name": asset_name,
                "description": f"Folder icon for {folder_name}",
                "category": "exact",
                "tags": ["folder", "monorepo", family, folder_name],
                "formats": CONFIG["render_formats"],
                "ico_sizes": CONFIG["ico_sizes"],
                "size": CONFIG["source_size"],
                "padding": 0,
                "antialias": 2,
                "alpha_mode": "embedded",
                "layers": build_icon_layers(family, folder_name)
            }
        )
    return catalog


def build_generic_catalog() -> List[Dict[str, Any]]:
    catalog: List[Dict[str, Any]] = []
    for index in range(1, CONFIG["generic_icon_count"] + 1):
        generic_id = build_generic_icon_id(index)
        family = stable_choice(CONFIG["generic_families"], generic_id)
        catalog.append(
            {
                "name": generic_id,
                "description": f"Generic folder icon {index}",
                "category": "generic",
                "tags": ["folder", "generic", family],
                "formats": CONFIG["render_formats"],
                "ico_sizes": CONFIG["ico_sizes"],
                "size": CONFIG["source_size"],
                "padding": 0,
                "antialias": 2,
                "alpha_mode": "embedded",
                "layers": build_icon_layers(family, generic_id)
            }
        )
    return catalog


def template_from_item(item: Dict[str, Any]):
    return icon(
        item["name"],
        *item["layers"],
        description=item["description"],
        category=item["category"],
        tags=item["tags"],
        size=item["size"],
        formats=item["formats"],
        ico_sizes=item["ico_sizes"],
        padding=item["padding"],
        antialias=item["antialias"],
        alpha_mode=item["alpha_mode"]
    )


def _svg_color(fill_value: Dict[str, Any] | None) -> str:
    if not fill_value:
        return "none"
    colors = fill_value.get("colors") or []
    return str(colors[0]) if colors else "none"


def _svg_stroke_attrs(stroke_value: Dict[str, Any] | None) -> str:
    if not stroke_value:
        return 'stroke="none"'
    return (
        f'stroke="{escape(str(stroke_value["color"]))}" '
        f'stroke-width="{stroke_value.get("width", 1)}" '
        f'stroke-linecap="{escape(str(stroke_value.get("cap", "round")))}" '
        f'stroke-linejoin="{escape(str(stroke_value.get("join", "round")))}" '
        f'stroke-miterlimit="{stroke_value.get("miter_limit", 4)}"'
    )


def _svg_common_attrs(layer: Dict[str, Any]) -> str:
    parts = [f'fill="{escape(_svg_color(layer.get("fill")))}"']
    if layer.get("opacity", 1.0) != 1.0:
        parts.append(f'opacity="{layer["opacity"]}"')
    parts.append(_svg_stroke_attrs(layer.get("stroke")))
    return " ".join(parts)


def _layer_to_svg(layer: Dict[str, Any]) -> str:
    geometry = layer["geometry"]
    attrs = _svg_common_attrs(layer)
    shape_type = layer["type"]

    if shape_type == "rect":
        extra = ""
        if "rx" in geometry:
            extra += f' rx="{geometry["rx"]}"'
        if "ry" in geometry:
            extra += f' ry="{geometry["ry"]}"'
        return (
            f'<rect x="{geometry["x"]}" y="{geometry["y"]}" '
            f'width="{geometry["width"]}" height="{geometry["height"]}"{extra} {attrs} />'
        )
    if shape_type == "circle":
        return f'<circle cx="{geometry["cx"]}" cy="{geometry["cy"]}" r="{geometry["r"]}" {attrs} />'
    if shape_type == "polygon":
        points = " ".join(f"{point[0]},{point[1]}" for point in geometry["points"])
        return f'<polygon points="{points}" {attrs} />'
    if shape_type == "line":
        return (
            f'<line x1="{geometry["x1"]}" y1="{geometry["y1"]}" '
            f'x2="{geometry["x2"]}" y2="{geometry["y2"]}" {attrs} />'
        )
    if shape_type == "path":
        return f'<path d="{escape(str(geometry["d"]))}" {attrs} />'
    raise ValueError(f"Unsupported SVG layer type: {shape_type}")


def write_svg_asset(item: Dict[str, Any], output_path: Path) -> None:
    size = item["size"]
    layer_markup = "\n  ".join(_layer_to_svg(layer) for layer in item["layers"])
    svg_text = (
        f'<svg width="{size}" height="{size}" viewBox="0 0 {size} {size}" '
        'fill="none" xmlns="http://www.w3.org/2000/svg">\n'
        f"  {layer_markup}\n"
        "</svg>\n"
    )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(svg_text, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate enterprise folder icon catalog.")
    parser.add_argument("--map-path", default=CONFIG["source_map"], help="Path to monorepo map markdown file.")
    parser.add_argument("--include-map-names", action="store_true", help="Blend folder names from the monorepo map into the enterprise catalog.")
    parser.add_argument("--limit", type=int, default=0, help="Optional limit for debugging/resume. 0 means all.")
    args = parser.parse_args()

    entries = parse_monorepo_map(Path(args.map_path)) if args.include_map_names else []
    folder_names = load_enterprise_folder_library()
    if args.include_map_names:
        folder_names = sorted(
            set(folder_names) | set(collect_folder_names(entries, CONFIG["bonus_exact_names"])),
            key=str.lower,
        )

    output_dir = Path(CONFIG["output_dir"])
    output_dir.mkdir(parents=True, exist_ok=True)

    engine = UIForgeEngine(output_dir=output_dir) if UIForgeEngine else None
    catalog = build_exact_catalog(folder_names) + build_generic_catalog()
    if args.limit > 0:
        catalog = catalog[:args.limit]

    exact_name_icons: Dict[str, str] = {}
    exact_name_svgs: Dict[str, str] = {}
    generic_icons: List[str] = []
    generic_svgs: List[str] = []
    failures: List[Dict[str, Any]] = []
    total = len(catalog)

    for index, item in enumerate(catalog, start=1):
        asset_dir = output_dir / item["category"] / item["name"]
        expected_ico = asset_dir / f"{item['name']}.ico"
        expected_svg = asset_dir / f"{item['name']}.svg"
        if not expected_svg.exists():
            write_svg_asset(item, expected_svg)

        if expected_ico.exists():
            result = None
            ico_path = str(expected_ico)
            svg_path = str(expected_svg)
        elif engine is not None:
            template = template_from_item(item)
            result = engine.generate_asset(template)
            ico_path = result.output_paths.get("ico") if result else None
            svg_path = result.output_paths.get("svg") if result else None

            if not ico_path and expected_ico.exists():
                ico_path = str(expected_ico)
            if not svg_path and expected_svg.exists():
                svg_path = str(expected_svg)
        else:
            result = None
            ico_path = str(expected_svg)
            svg_path = str(expected_svg)

        if not ico_path:
            failures.append(
                {
                    "name": item["name"],
                    "error": None if result is None else result.error,
                    "warnings": [] if result is None else result.warnings
                }
            )
            print(f"[{index}/{total}] failed {item['name']}")
            continue

        if item["name"].startswith("generic-"):
            generic_icons.append(ico_path)
            if svg_path:
                generic_svgs.append(svg_path)
        else:
            human_name = item["name"].removeprefix("folder-").replace("-", " ")
            for candidate in folder_names:
                if slugify(candidate) == item["name"].removeprefix("folder-"):
                    human_name = candidate
                    break
            exact_name_icons[human_name] = ico_path
            if svg_path:
                exact_name_svgs[human_name] = svg_path

        print(f"[{index}/{total}] ready {item['name']}")

    path_assignments = []
    for entry in entries:
        chosen = exact_name_icons.get(entry.name)
        if not chosen:
            chosen = generic_icons[stable_int(entry.name) % len(generic_icons)] if generic_icons else None
        path_assignments.append(
            {
                "name": entry.name,
                "path": str(entry.path),
                "hot": entry.hot,
                "icon": chosen
            }
        )

    manifest = {
        "generated_at": now_iso(),
        "source_map": str(Path(args.map_path)) if args.include_map_names else None,
        "taxonomy_source": str(TAXONOMY_PATH),
        "catalog_profile": "enterprise",
        "include_map_names": args.include_map_names,
        "output_dir": str(output_dir),
        "source_size": CONFIG["source_size"],
        "ico_sizes": CONFIG["ico_sizes"],
        "total_requested_icons": len(catalog),
        "total_generated_icons": len(exact_name_icons) + len(generic_icons),
        "exact_name_icons": exact_name_icons,
        "exact_name_svgs": exact_name_svgs,
        "generic_icons": generic_icons,
        "generic_svgs": generic_svgs,
        "path_assignments": path_assignments,
        "failures": failures
    }
    write_json(output_manifest_path(BASE_DIR), manifest)

    print(f"Generated {manifest['total_generated_icons']} icons into {output_dir}")
    if failures:
        print(f"Failures: {len(failures)}")
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
