from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Sequence


SUPPORTED_SUFFIXES = {".ts", ".tsx", ".js", ".jsx", ".css", ".scss"}

DEFAULT_SCAN_ROOTS = (
    "src",
    "src-mobile",
    "usr/packages/greeblefs-ui/src",
    "usr/plugins",
)

EXCLUDED_DIRECTORY_NAMES = {
    ".git",
    ".kain",
    ".tmp",
    "__pycache__",
    "coverage",
    "dist",
    "dist-mobile",
    "node_modules",
    "target",
    "target-tests",
    "vendor",
}

TEST_PATH_MARKERS = (
    ".test.",
    ".spec.",
    "/test/",
    "/tests/",
    "\\test\\",
    "\\tests\\",
)


@dataclass(frozen=True)
class Rule:
    id: str
    label: str
    pattern: re.Pattern[str]
    lane: str
    weight: int


RULES = (
    Rule(
        "inline-style",
        "Inline React style object",
        re.compile(r"\bstyle\s*=\s*\{\s*\{"),
        "theme.tokens",
        3,
    ),
    Rule(
        "numeric-style-value",
        "Numeric style value",
        re.compile(
            r"\b(?:padding|margin|gap|width|height|minWidth|maxWidth|minHeight|maxHeight|"
            r"borderRadius|fontSize|lineHeight|top|left|right|bottom)\s*:\s*-?\d+(?:\.\d+)?\b"
        ),
        "theme.tokens",
        2,
    ),
    Rule(
        "px-length",
        "Literal px length",
        re.compile(r"(?<![A-Za-z0-9_-])-?\d+(?:\.\d+)?px\b"),
        "theme.tokens",
        2,
    ),
    Rule(
        "hex-color",
        "Literal hex color",
        re.compile(r"(?<![A-Za-z0-9_-])#[0-9a-fA-F]{3,8}\b"),
        "theme.tokens",
        2,
    ),
    Rule(
        "functional-color",
        "Literal functional color or gradient",
        re.compile(r"\b(?:rgba?|hsla?|color-mix|linear-gradient|radial-gradient|conic-gradient)\s*\("),
        "theme.tokens",
        2,
    ),
    Rule(
        "shadow",
        "Literal shadow",
        re.compile(r"\b(?:boxShadow|box-shadow|textShadow|text-shadow)\s*:"),
        "theme.tokens",
        2,
    ),
    Rule(
        "blur",
        "Literal blur/filter",
        re.compile(r"\b(?:backdropFilter|backdrop-filter|filter)\s*:|\bblur\s*\("),
        "theme.tokens",
        2,
    ),
    Rule(
        "z-layer",
        "Literal z layer",
        re.compile(r"\b(?:zIndex|z-index)\s*:"),
        "layout.policy",
        2,
    ),
    Rule(
        "duration-ms",
        "Literal motion duration",
        re.compile(r"(?<![A-Za-z0-9_-])\d+(?:\.\d+)?ms\b"),
        "interaction.motion",
        1,
    ),
    Rule(
        "absolute-position",
        "Local absolute positioning",
        re.compile(r"\bposition\s*:\s*['\"]?absolute['\"]?"),
        "layout.policy",
        1,
    ),
    Rule(
        "drag-drop",
        "Drag and drop behavior",
        re.compile(
            r"\b(?:onDragStart|onDragEnd|onDragOver|onDragEnter|onDragLeave|onDrag|"
            r"onDrop|draggable\s*=|dataTransfer|dragstart|dragover|drop)\b"
        ),
        "lattice.interaction-policy",
        4,
    ),
    Rule(
        "pointer-routing",
        "Pointer or wheel behavior",
        re.compile(r"\b(?:onPointerDown|onPointerMove|onPointerUp|onMouseDown|onMouseMove|onWheel)\b"),
        "lattice.interaction-policy",
        3,
    ),
    Rule(
        "keyboard-routing",
        "Keyboard behavior",
        re.compile(r"\b(?:onKeyDown|KeyboardEvent|addEventListener\s*\(\s*['\"]keydown)"),
        "lattice.interaction-policy",
        2,
    ),
    Rule(
        "context-menu",
        "Context menu behavior",
        re.compile(r"\bonContextMenu\b|\bcontextmenu\b"),
        "lattice.menu-policy",
        2,
    ),
    Rule(
        "global-event-listener",
        "Global DOM event listener",
        re.compile(r"\b(?:window|document)\.addEventListener\s*\("),
        "lattice.interaction-policy",
        3,
    ),
    Rule(
        "direct-lucide-import",
        "Direct lucide-react import",
        re.compile(r"from\s+['\"]lucide-react['\"]"),
        "icon.theme",
        2,
    ),
)


def _to_repo_path(workspace_root: Path, path: Path) -> str:
    try:
        return path.relative_to(workspace_root).as_posix()
    except ValueError:
        return path.as_posix()


def _path_has_test_marker(path: Path) -> bool:
    path_text = path.as_posix()
    lowered = path_text.lower()
    return any(marker in lowered for marker in TEST_PATH_MARKERS)


def _iter_source_files(
    workspace_root: Path,
    roots: Sequence[str],
    include_tests: bool,
) -> Iterable[Path]:
    for root in roots:
        scan_root = (workspace_root / root).resolve()
        if not scan_root.exists():
            continue
        for path in scan_root.rglob("*"):
            if not path.is_file() or path.suffix not in SUPPORTED_SUFFIXES:
                continue
            if any(part in EXCLUDED_DIRECTORY_NAMES for part in path.parts):
                continue
            if not include_tests and _path_has_test_marker(path):
                continue
            yield path


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def _classify_surface(repo_path: str) -> str:
    lowered = repo_path.lower()
    if lowered.startswith("src-mobile/"):
        return "mobile"
    if "usr/packages/greeblefs-ui" in lowered:
        return "shared-ui-package"
    if "usr/plugins/" in lowered:
        return "plugin-package"
    if "panelregistry" in lowered or lowered.startswith("src/panels/"):
        return "shell-panel-registry"
    if "fileexplorer" in lowered or "src/components/explorer/" in lowered:
        return "explorer"
    if "settingspage" in lowered or "src/components/settings/" in lowered:
        return "settings"
    if "terminal" in lowered:
        return "terminal"
    if "pluginsmanager" in lowered or "pluginruntime" in lowered:
        return "plugin-host"
    if "workbench" in lowered or "topbar" in lowered or lowered == "src/app.tsx":
        return "shell-workbench"
    return "ui-surface"


def _migration_lane(repo_path: str, surface: str, rule_counts: dict[str, int]) -> str:
    if surface == "shell-panel-registry":
        return "lattice.panel-registry"
    if rule_counts.get("drag-drop", 0) or rule_counts.get("pointer-routing", 0):
        return "lattice.interaction-policy"
    if surface == "explorer":
        return "lattice.explorer-surface"
    if surface == "settings":
        return "lattice.settings-module"
    if surface in {"plugin-host", "plugin-package"}:
        return "lattice.plugin-surface"
    if repo_path.endswith(".css") or any(
        rule_counts.get(rule_id, 0)
        for rule_id in ("inline-style", "numeric-style-value", "px-length", "hex-color", "functional-color")
    ):
        return "theme.tokens"
    return "lattice.semantic-surface"


def _count_rule_hits(line: str, rule: Rule) -> int:
    return len(rule.pattern.findall(line))


def _scan_file(workspace_root: Path, path: Path) -> dict[str, Any] | None:
    repo_path = _to_repo_path(workspace_root, path)
    text = _read_text(path)
    rule_counts: dict[str, int] = {}
    lane_counts: dict[str, int] = {}
    samples: list[dict[str, Any]] = []
    score = 0

    for line_number, line in enumerate(text.splitlines(), start=1):
        for rule in RULES:
            hits = _count_rule_hits(line, rule)
            if hits == 0:
                continue
            rule_counts[rule.id] = rule_counts.get(rule.id, 0) + hits
            lane_counts[rule.lane] = lane_counts.get(rule.lane, 0) + hits
            score += hits * rule.weight
            if len(samples) < 12:
                samples.append(
                    {
                        "line": line_number,
                        "ruleId": rule.id,
                        "lane": rule.lane,
                        "excerpt": line.strip()[:180],
                    }
                )

    if not rule_counts:
        return None

    surface = _classify_surface(repo_path)
    dominant_rules = sorted(rule_counts, key=lambda rule_id: (-rule_counts[rule_id], rule_id))[:6]
    return {
        "path": repo_path,
        "surface": surface,
        "migrationLane": _migration_lane(repo_path, surface, rule_counts),
        "hardcodedScore": score,
        "ruleCounts": dict(sorted(rule_counts.items())),
        "laneCounts": dict(sorted(lane_counts.items())),
        "dominantRules": dominant_rules,
        "samples": samples,
    }


def _increment_counts(target: dict[str, int], source: dict[str, int]) -> None:
    for key, value in source.items():
        target[key] = target.get(key, 0) + value


def _top_paths_for_rule(files: Sequence[dict[str, Any]], rule_id: str, limit: int = 12) -> list[dict[str, Any]]:
    matches = [
        {
            "path": file_record["path"],
            "surface": file_record["surface"],
            "count": file_record["ruleCounts"].get(rule_id, 0),
            "migrationLane": file_record["migrationLane"],
        }
        for file_record in files
        if file_record["ruleCounts"].get(rule_id, 0) > 0
    ]
    return sorted(matches, key=lambda item: (-item["count"], item["path"]))[:limit]


def _risk_buckets(files: Sequence[dict[str, Any]]) -> dict[str, Any]:
    return {
        "panelRegistryMigration": [
            item
            for item in files
            if item["migrationLane"] == "lattice.panel-registry"
        ][:12],
        "dragDropAndPointerPolicy": _top_paths_for_rule(files, "drag-drop", 16),
        "globalEventRouting": _top_paths_for_rule(files, "global-event-listener", 16),
        "visualTokenDebt": sorted(
            [
                {
                    "path": item["path"],
                    "surface": item["surface"],
                    "count": sum(
                        item["ruleCounts"].get(rule_id, 0)
                        for rule_id in (
                            "inline-style",
                            "numeric-style-value",
                            "px-length",
                            "hex-color",
                            "functional-color",
                            "shadow",
                            "blur",
                        )
                    ),
                    "migrationLane": item["migrationLane"],
                }
                for item in files
            ],
            key=lambda item: (-item["count"], item["path"]),
        )[:20],
    }


def analyze_ui_inventory(
    workspace_root: str | Path,
    roots: Sequence[str] | None = None,
    include_tests: bool = False,
    max_files: int = 80,
) -> dict[str, Any]:
    resolved_workspace_root = Path(workspace_root).resolve()
    scan_roots = tuple(roots or DEFAULT_SCAN_ROOTS)
    scanned_files = sorted(
        _iter_source_files(resolved_workspace_root, scan_roots, include_tests),
        key=lambda path: _to_repo_path(resolved_workspace_root, path),
    )

    files = [
        file_record
        for path in scanned_files
        if (file_record := _scan_file(resolved_workspace_root, path)) is not None
    ]
    files.sort(key=lambda item: (-item["hardcodedScore"], item["path"]))

    rule_totals: dict[str, int] = {}
    lane_totals: dict[str, int] = {}
    surface_totals: dict[str, int] = {}
    for file_record in files:
        _increment_counts(rule_totals, file_record["ruleCounts"])
        _increment_counts(lane_totals, file_record["laneCounts"])
        surface = file_record["surface"]
        surface_totals[surface] = surface_totals.get(surface, 0) + 1

    limited_files = files[:max(1, max_files)]
    return {
        "schemaVersion": 1,
        "kind": "greeblefs.ui.hardcoded-surface-map",
        "source": "src-kain/ffi/python/analysis/ui_inventory.py",
        "workspaceRoot": str(resolved_workspace_root),
        "scannedRoots": list(scan_roots),
        "includeTests": include_tests,
        "summary": {
            "filesVisited": len(scanned_files),
            "filesWithFindings": len(files),
            "totalFindings": sum(rule_totals.values()),
            "hardcodedScore": sum(file_record["hardcodedScore"] for file_record in files),
            "ruleTotals": dict(sorted(rule_totals.items())),
            "laneTotals": dict(sorted(lane_totals.items())),
            "surfaceTotals": dict(sorted(surface_totals.items())),
        },
        "rules": [
            {
                "id": rule.id,
                "label": rule.label,
                "migrationLane": rule.lane,
                "weight": rule.weight,
            }
            for rule in RULES
        ],
        "migrationLanes": {
            "lattice.panel-registry": "Built-in panel metadata should become Lattice descriptors while React renderers remain trusted hosts.",
            "lattice.interaction-policy": "Drag/drop, pointer, keyboard, and global event behavior should move into authored interaction policy.",
            "lattice.explorer-surface": "Explorer panels, lanes, previews, and chrome should graduate into Lattice-authored surface packages.",
            "lattice.settings-module": "Settings pages should become KCM-style Lattice modules with typed config/default ownership.",
            "lattice.plugin-surface": "Plugin host chrome should share the same authored surface contract as first-party panels.",
            "theme.tokens": "Colors, spacing, shadows, layers, blur, and motion should route through UI tokens and theme packs.",
        },
        "riskBuckets": _risk_buckets(files),
        "topFiles": limited_files,
    }


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Emit a GreebleFS hardcoded UI surface map.")
    parser.add_argument("--workspace-root", default=".", help="GreebleFS workspace root.")
    parser.add_argument(
        "--root",
        action="append",
        dest="roots",
        help="Relative root to scan. May be passed more than once.",
    )
    parser.add_argument("--include-tests", action="store_true", help="Include test/spec files.")
    parser.add_argument("--max-files", type=int, default=80, help="Maximum detailed file records to emit.")
    parser.add_argument("--output", help="Optional JSON output path.")
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    report = analyze_ui_inventory(
        workspace_root=args.workspace_root,
        roots=args.roots,
        include_tests=args.include_tests,
        max_files=args.max_files,
    )
    serialized = json.dumps(report, indent=2, sort_keys=True)
    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(serialized + "\n", encoding="utf-8")
    else:
        print(serialized)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
