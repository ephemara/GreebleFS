#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from collections import Counter
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Iterable, Iterator

try:
    import tomllib
except ModuleNotFoundError:  # pragma: no cover
    tomllib = None  # type: ignore[assignment]


QUEUE_ROOT = Path(__file__).resolve().parent
REPO_ROOT = QUEUE_ROOT.parent
STAGING_ROOT = QUEUE_ROOT / "staging"
VAULT_ROOT = QUEUE_ROOT / "vault"

REPO_SCAN_ROOT_NAMES = (
    "src",
    "src-tauri",
    "crates",
    "packages",
    "themes",
    "plugins",
    "wallpapers",
    "shaders",
    "animations",
    "docs",
)

SKIP_DIRECTORY_NAMES = {
    ".git",
    ".idea",
    ".vscode",
    "__pycache__",
    "node_modules",
    "target",
    "dist",
    "dist-mobile",
    "build",
    ".next",
    ".turbo",
    ".venv",
    "venv",
    "coverage",
    ".cache",
    "staging",
    "vault",
}

TEXT_FILE_SUFFIXES = {
    ".c",
    ".cc",
    ".cfg",
    ".clj",
    ".conf",
    ".cpp",
    ".cs",
    ".css",
    ".cue",
    ".dart",
    ".env",
    ".glsl",
    ".go",
    ".h",
    ".hpp",
    ".hlsl",
    ".html",
    ".ini",
    ".java",
    ".jl",
    ".js",
    ".json",
    ".jsx",
    ".kts",
    ".lua",
    ".m",
    ".md",
    ".metal",
    ".mm",
    ".proto",
    ".ps1",
    ".py",
    ".rb",
    ".rs",
    ".scss",
    ".sh",
    ".sol",
    ".sql",
    ".svg",
    ".swift",
    ".toml",
    ".ts",
    ".tsx",
    ".txt",
    ".vue",
    ".wgsl",
    ".xml",
    ".yaml",
    ".yml",
}

LANGUAGE_BY_SUFFIX = {
    ".c": "c",
    ".cc": "cpp",
    ".cfg": "config",
    ".clj": "clojure",
    ".conf": "config",
    ".cpp": "cpp",
    ".cs": "csharp",
    ".css": "css",
    ".cue": "cue",
    ".dart": "dart",
    ".env": "dotenv",
    ".glsl": "glsl",
    ".go": "go",
    ".h": "c",
    ".hpp": "cpp",
    ".hlsl": "hlsl",
    ".html": "html",
    ".ini": "config",
    ".java": "java",
    ".jl": "julia",
    ".js": "javascript",
    ".json": "json",
    ".jsx": "react",
    ".kts": "kotlin",
    ".lua": "lua",
    ".m": "objective-c",
    ".md": "markdown",
    ".metal": "metal",
    ".mm": "objective-c",
    ".proto": "protobuf",
    ".ps1": "powershell",
    ".py": "python",
    ".rb": "ruby",
    ".rs": "rust",
    ".scss": "scss",
    ".sh": "shell",
    ".sol": "solidity",
    ".sql": "sql",
    ".svg": "svg",
    ".swift": "swift",
    ".toml": "toml",
    ".ts": "typescript",
    ".tsx": "tsx",
    ".txt": "text",
    ".vue": "vue",
    ".wgsl": "wgsl",
    ".xml": "xml",
    ".yaml": "yaml",
    ".yml": "yaml",
}

MANIFEST_FILE_NAMES = {
    "Cargo.toml",
    "package.json",
    "pyproject.toml",
    "go.mod",
    "requirements.txt",
    "README",
    "README.md",
    "README.txt",
}

STOP_TOKENS = {
    "a",
    "all",
    "and",
    "app",
    "apps",
    "as",
    "async",
    "auto",
    "be",
    "bind",
    "bin",
    "bool",
    "build",
    "button",
    "cargo",
    "case",
    "class",
    "clone",
    "code",
    "command",
    "commands",
    "common",
    "component",
    "config",
    "const",
    "crate",
    "data",
    "default",
    "dep",
    "desktop",
    "derive",
    "dev",
    "debug",
    "deserialize",
    "dyn",
    "ease",
    "else",
    "enum",
    "event",
    "error",
    "export",
    "false",
    "feature",
    "features",
    "file",
    "f32",
    "files",
    "fn",
    "for",
    "from",
    "function",
    "get",
    "greeble",
    "greeblefs",
    "impl",
    "import",
    "in",
    "include",
    "info",
    "into",
    "i32",
    "is",
    "it",
    "json",
    "let",
    "lib",
    "line",
    "list",
    "main",
    "match",
    "message",
    "mod",
    "module",
    "name",
    "new",
    "node",
    "none",
    "null",
    "of",
    "on",
    "option",
    "or",
    "package",
    "path",
    "plugin",
    "pub",
    "python",
    "react",
    "ref",
    "repo",
    "result",
    "root",
    "rust",
    "rs",
    "self",
    "serde",
    "serialize",
    "set",
    "shell",
    "some",
    "src",
    "state",
    "string",
    "struct",
    "test",
    "text",
    "the",
    "this",
    "to",
    "toml",
    "true",
    "type",
    "typescript",
    "ui",
    "u32",
    "u64",
    "use",
    "unwrap",
    "value",
    "var",
    "vec",
    "version",
    "with",
}

COMMON_TECH_TOKENS = {
    "api",
    "animation",
    "animations",
    "async",
    "bevy",
    "bindings",
    "binary",
    "bincode",
    "bridge",
    "desktop",
    "engine",
    "event",
    "focus",
    "layout",
    "layouts",
    "message",
    "messages",
    "node",
    "nodes",
    "patch",
    "patches",
    "portal",
    "preview",
    "proto",
    "protocol",
    "react",
    "runtime",
    "serde",
    "serialize",
    "state",
    "sync",
    "transport",
    "typescript",
    "virtual",
    "list",
}

SANITIZE_PATTERNS = [
    (
        "absolute-path",
        re.compile(r"(?P<value>(?:[A-Za-z]:[\\/][^\s\"'`]+)|(?:/(?:Users|home|var|etc|opt|tmp|mnt|srv|Volumes|Applications|Library|System|usr|bin)(?![A-Za-z0-9_-])(?:[\\/][^\s\"'`]*)?))"),
        "Move machine-specific paths into managed directories, config, or runtime discovery.",
    ),
    (
        "network-endpoint",
        re.compile(r"(?P<value>https?://[^\s\"'`<>)]+)"),
        "Move endpoints into config or environment-backed settings before assimilation.",
    ),
    (
        "localhost-endpoint",
        re.compile(r"(?P<value>https?://(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d{2,5})?[^\s\"'`<>)]+)"),
        "Replace local-only endpoints with runtime discovery or configurable environment values.",
    ),
    (
        "magic-port",
        re.compile(r"(?P<value>\b(?:port|listen|localhost|127\.0\.0\.1|0\.0\.0\.0)[^#\n]{0,24}?\b\d{2,5}\b)", re.IGNORECASE),
        "Promote ports into config or settings instead of leaving them inline in the code.",
    ),
]

CURATED_CONNECTION_HINTS = [
    {
        "tokens": {"protocol", "transport", "message", "messages", "state", "serde", "bincode", "specta", "ts", "bindings"},
        "targets": [
            (
                "crates/overlay-contracts",
                "Shared Rust/TS contract layer where protocol-style code can become a durable cross-boundary surface.",
            ),
            (
                "src-tauri/src/specta_bindings.rs",
                "Rust -> TypeScript binding generation seam for host contracts.",
            ),
            (
                "src/generated/tauri.ts",
                "Typed frontend contract consumer generated from Rust.",
            ),
        ],
    },
    {
        "tokens": {"bevy", "gpu", "render", "shader", "wgpu", "engine"},
        "targets": [
            (
                "crates/.reference/bevydcc-greeblefs",
                "Bundled Bevy/GPU reference material for cross-adoption decisions.",
            ),
            (
                "src/runtime/gpuRuntimeBackend.ts",
                "Frontend GPU control-plane seam.",
            ),
            (
                "src-tauri/src",
                "Native host layer for compute, rendering-adjacent, or acceleration-backed work.",
            ),
        ],
    },
    {
        "tokens": {"layout", "portal", "focus", "virtual", "list", "animation", "patch", "node"},
        "targets": [
            (
                "src/components",
                "Frontend shell surfaces where reusable UI runtime or tree/patch systems may fit.",
            ),
            (
                "src/components/home",
                "Runtime-authored UI module lane for home packs and dynamic shell surfaces.",
            ),
            (
                "src/components/explorer",
                "Complex explorer UI substrate where advanced tree/layout/runtime patterns may transfer.",
            ),
        ],
    },
]


@dataclass
class RepoPathMatch:
    path: str
    score: float
    matched_tokens: list[str]
    reason: str
    match_type: str


@dataclass
class SanitizeFinding:
    category: str
    file: str | None
    line: int | None
    value: str
    recommendation: str


@dataclass
class CandidateInventory:
    candidate_name: str
    candidate_path: Path
    source: str
    file_count: int
    text_file_count: int
    total_lines: int
    total_bytes: int
    languages: dict[str, int]
    dependencies_by_ecosystem: dict[str, list[str]]
    manifest_files: list[str]
    top_tokens: list[str]
    path_tokens: list[str]
    technology_tags: list[str]
    summary: str
    token_counts: Counter[str]


@dataclass
class CandidateReport:
    candidate: str
    source: str
    candidate_path: str
    summary: str
    technology_tags: list[str]
    stats: dict[str, Any]
    dependencies_by_ecosystem: dict[str, list[str]]
    manifest_files: list[str]
    novelty: dict[str, Any]
    repo_connections: list[RepoPathMatch]
    sanitize: dict[str, Any]
    next_steps: list[str]


@dataclass
class RepoPathRecord:
    relative_path: str
    tokens: set[str]


@dataclass
class RepoInventory:
    dependency_names: set[str]
    path_records: list[RepoPathRecord]
    repo_tokens: set[str]


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="queue.py",
        description="Analyze staged queue folders for GreebleFS adoption, novelty, and scrub targets.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    list_parser = subparsers.add_parser("list", help="List queue candidates.")
    list_parser.add_argument("--source", choices=("staging", "vault", "all"), default="staging")
    list_parser.set_defaults(func=handle_list)

    check_parser = subparsers.add_parser("check", help="Analyze one queued folder or every folder in staging.")
    check_parser.add_argument("target", nargs="?", help="Candidate name or path. Defaults to every folder in staging.")
    check_parser.add_argument("--source", choices=("staging", "vault"), default="staging")
    check_parser.add_argument("--json", action="store_true", help="Emit JSON instead of markdown.")
    check_parser.add_argument("--limit", type=int, default=10, help="Maximum repo connection matches to show.")
    check_parser.set_defaults(func=handle_check)

    sanitize_parser = subparsers.add_parser("sanitize", help="Run only the sanitize pass for a queued folder.")
    sanitize_parser.add_argument("target", help="Candidate name or path.")
    sanitize_parser.add_argument("--source", choices=("staging", "vault"), default="staging")
    sanitize_parser.add_argument("--json", action="store_true", help="Emit JSON instead of markdown.")
    sanitize_parser.set_defaults(func=handle_sanitize)

    move_parser = subparsers.add_parser("move", help="Move a queued folder between staging and vault.")
    move_parser.add_argument("target", help="Candidate name or path.")
    move_parser.add_argument("--to", choices=("staging", "vault"), required=True)
    move_parser.add_argument("--source", choices=("staging", "vault"), default="staging")
    move_parser.set_defaults(func=handle_move)

    return parser


def handle_list(args: argparse.Namespace) -> int:
    sources = ["staging", "vault"] if args.source == "all" else [args.source]
    grouped = {source: list_queue_candidates(source) for source in sources}

    if not any(grouped.values()):
        print("No queue candidates found.")
        return 0

    for index, source in enumerate(sources):
        if index:
            print()
        print(f"{source}:")
        candidates = grouped[source]
        if not candidates:
            print("  (empty)")
            continue
        for candidate in candidates:
            print(f"  - {candidate.name}")
    return 0


def handle_check(args: argparse.Namespace) -> int:
    candidates = resolve_candidates(args.target, args.source)
    if not candidates:
        print("No matching queue candidates found.", file=sys.stderr)
        return 1

    repo_inventory = build_repo_inventory(REPO_ROOT)
    reports = [
        analyze_candidate(candidate_path, repo_inventory, limit=args.limit)
        for candidate_path in candidates
    ]

    if args.json:
        print(json.dumps([report_to_dict(report) for report in reports], indent=2))
        return 0

    for index, report in enumerate(reports):
        if index:
            print()
            print("=" * 88)
            print()
        print(format_markdown_report(report))
    return 0


def handle_sanitize(args: argparse.Namespace) -> int:
    candidates = resolve_candidates(args.target, args.source)
    if not candidates:
        print("No matching queue candidate found.", file=sys.stderr)
        return 1

    repo_inventory = build_repo_inventory(REPO_ROOT)
    candidate_path = candidates[0]
    inventory = build_candidate_inventory(candidate_path)
    sanitize_summary = build_sanitize_summary(candidate_path, inventory, repo_inventory)

    if args.json:
        print(json.dumps(sanitize_summary, indent=2))
        return 0

    print(format_markdown_sanitize(candidate_path, sanitize_summary))
    return 0


def handle_move(args: argparse.Namespace) -> int:
    candidates = resolve_candidates(args.target, args.source)
    if not candidates:
        print("No matching queue candidate found.", file=sys.stderr)
        return 1

    source_path = candidates[0]
    destination_root = staging_or_vault_root(args.to)
    destination_path = destination_root / source_path.name
    if destination_path.exists():
        print(f"Destination already exists: {destination_path}", file=sys.stderr)
        return 1

    destination_root.mkdir(parents=True, exist_ok=True)
    shutil.move(str(source_path), str(destination_path))
    print(f"Moved {source_path.name} -> {destination_path}")
    return 0


def resolve_candidates(target: str | None, source: str) -> list[Path]:
    if target:
        candidate = resolve_candidate_path(target, source)
        return [candidate] if candidate else []
    return list_queue_candidates(source)


def resolve_candidate_path(target: str, source: str) -> Path | None:
    raw_path = Path(target).expanduser()
    if raw_path.exists():
        return raw_path.resolve()

    root = staging_or_vault_root(source)
    direct = root / target
    if direct.exists():
        return direct.resolve()

    matches = [candidate for candidate in list_queue_candidates(source) if candidate.name == target]
    return matches[0] if matches else None


def list_queue_candidates(source: str) -> list[Path]:
    root = staging_or_vault_root(source)
    if not root.exists():
        return []
    return sorted(
        [child.resolve() for child in root.iterdir() if child.is_dir()],
        key=lambda path: path.name.lower(),
    )


def staging_or_vault_root(source: str) -> Path:
    if source == "vault":
        return VAULT_ROOT
    return STAGING_ROOT


def analyze_candidate(candidate_path: Path, repo_inventory: RepoInventory, limit: int) -> CandidateReport:
    inventory = build_candidate_inventory(candidate_path)
    novelty = assess_novelty(inventory, repo_inventory)
    repo_connections = find_repo_connections(inventory, repo_inventory, limit=limit)
    existing_reference_paths = find_existing_reference_paths(inventory, repo_connections)
    novelty["existing_reference_paths"] = existing_reference_paths
    if existing_reference_paths:
        novelty["label"] = "low"
    sanitize_summary = build_sanitize_summary(candidate_path, inventory, repo_inventory)
    next_steps = build_next_steps(inventory, novelty, sanitize_summary, repo_connections)

    return CandidateReport(
        candidate=inventory.candidate_name,
        source=inventory.source,
        candidate_path=display_path(candidate_path),
        summary=inventory.summary,
        technology_tags=inventory.technology_tags,
        stats={
            "file_count": inventory.file_count,
            "text_file_count": inventory.text_file_count,
            "total_lines": inventory.total_lines,
            "total_bytes": inventory.total_bytes,
            "languages": inventory.languages,
            "top_tokens": inventory.top_tokens,
        },
        dependencies_by_ecosystem=inventory.dependencies_by_ecosystem,
        manifest_files=inventory.manifest_files,
        novelty=novelty,
        repo_connections=repo_connections,
        sanitize=sanitize_summary,
        next_steps=next_steps,
    )


def build_candidate_inventory(candidate_path: Path) -> CandidateInventory:
    files = list(iter_candidate_files(candidate_path))
    language_counter: Counter[str] = Counter()
    token_counter: Counter[str] = Counter()
    manifest_files: list[str] = []
    dependency_map: dict[str, set[str]] = {}
    total_bytes = 0
    total_lines = 0
    text_file_count = 0

    for file_path in files:
        suffix = file_path.suffix.lower()
        language = detect_language(file_path)
        if language:
            language_counter[language] += 1

        total_bytes += safe_file_size(file_path)

        if file_path.name in MANIFEST_FILE_NAMES:
            manifest_files.append(display_path(file_path))
            merge_dependency_maps(dependency_map, collect_dependencies_from_manifest(file_path))

        token_counter.update(tokenize_identifierish(file_path.name))
        token_counter.update(tokenize_identifierish(file_path.parent.name))

        if not is_probably_text_file(file_path):
            continue

        text = read_text_file(file_path)
        if text is None:
            continue

        text_file_count += 1
        total_lines += text.count("\n") + (1 if text and not text.endswith("\n") else 0)
        token_counter.update(extract_code_tokens(text))

    path_tokens = ranked_tokens(token_counter, limit=14)
    technology_tags = infer_technology_tags(language_counter, dependency_map, path_tokens)
    summary = summarize_candidate(candidate_path.name, language_counter, dependency_map, technology_tags)
    source = classify_queue_source(candidate_path)

    return CandidateInventory(
        candidate_name=candidate_path.name,
        candidate_path=candidate_path,
        source=source,
        file_count=len(files),
        text_file_count=text_file_count,
        total_lines=total_lines,
        total_bytes=total_bytes,
        languages=dict(language_counter.most_common()),
        dependencies_by_ecosystem={key: sorted(value) for key, value in sorted(dependency_map.items())},
        manifest_files=sorted(manifest_files),
        top_tokens=ranked_tokens(token_counter, limit=12),
        path_tokens=path_tokens,
        technology_tags=technology_tags,
        summary=summary,
        token_counts=token_counter,
    )


def build_repo_inventory(repo_root: Path) -> RepoInventory:
    manifest_dependencies: dict[str, set[str]] = {}
    path_records: list[RepoPathRecord] = []
    repo_tokens: set[str] = set()

    manifest_paths = find_manifest_files(repo_root)
    for manifest_path in manifest_paths:
        merge_dependency_maps(manifest_dependencies, collect_dependencies_from_manifest(manifest_path))

    for scan_root in iter_repo_scan_roots(repo_root):
        for file_path in iter_candidate_files(scan_root):
            relative_path = display_path(file_path)
            tokens = set(tokenize_identifierish(relative_path))
            if not tokens:
                continue
            path_records.append(RepoPathRecord(relative_path=relative_path, tokens=tokens))
            repo_tokens.update(tokens)

    for dependency_names in manifest_dependencies.values():
        repo_tokens.update(tokenize_identifierish(" ".join(dependency_names)))

    dependency_names = {
        dependency_name
        for ecosystem in manifest_dependencies.values()
        for dependency_name in ecosystem
    }

    return RepoInventory(
        dependency_names=dependency_names,
        path_records=path_records,
        repo_tokens=repo_tokens,
    )


def assess_novelty(inventory: CandidateInventory, repo_inventory: RepoInventory) -> dict[str, Any]:
    candidate_dependencies = {
        dependency
        for ecosystem in inventory.dependencies_by_ecosystem.values()
        for dependency in ecosystem
    }
    new_dependencies = sorted(candidate_dependencies - repo_inventory.dependency_names)
    familiar_dependencies = sorted(candidate_dependencies & repo_inventory.dependency_names)
    unique_tokens = [
        token
        for token in inventory.top_tokens
        if token not in repo_inventory.repo_tokens and token not in COMMON_TECH_TOKENS
    ]

    novelty_points = len(new_dependencies) * 1.4 + len(unique_tokens) * 0.6
    if novelty_points >= 8:
        novelty_label = "high"
    elif novelty_points >= 4:
        novelty_label = "medium"
    else:
        novelty_label = "low"

    return {
        "label": novelty_label,
        "new_dependencies": new_dependencies,
        "familiar_dependencies": familiar_dependencies[:12],
        "unique_tokens": unique_tokens[:12],
    }


def find_repo_connections(
    inventory: CandidateInventory,
    repo_inventory: RepoInventory,
    limit: int,
) -> list[RepoPathMatch]:
    token_weights = build_weighted_token_map(inventory)
    matches: list[RepoPathMatch] = []

    for record in repo_inventory.path_records:
        overlap = sorted(record.tokens & token_weights.keys())
        if not overlap:
            continue

        score = sum(token_weights[token] for token in overlap)
        if score < 2.2:
            continue

        matches.append(
            RepoPathMatch(
                path=record.relative_path,
                score=round(score, 2),
                matched_tokens=overlap[:8],
                reason=f"Path overlaps candidate tokens: {', '.join(overlap[:5])}.",
                match_type="path-overlap",
            )
        )

    matches.extend(build_curated_connections(inventory))
    deduped = dedupe_repo_matches(matches)
    deduped.sort(key=lambda match: (-match.score, match.path))
    return deduped[:limit]


def build_curated_connections(inventory: CandidateInventory) -> list[RepoPathMatch]:
    active_tokens = set(inventory.top_tokens) | set(inventory.technology_tags)
    matches: list[RepoPathMatch] = []
    for hint in CURATED_CONNECTION_HINTS:
        matched_tokens = sorted(active_tokens & set(hint["tokens"]))
        if not matched_tokens:
            continue
        for path, reason in hint["targets"]:
            matches.append(
                RepoPathMatch(
                    path=path,
                    score=24.0 + len(matched_tokens) * 0.35,
                    matched_tokens=matched_tokens,
                    reason=reason,
                    match_type="curated-hint",
                )
            )
    return matches


def build_sanitize_summary(
    candidate_path: Path,
    inventory: CandidateInventory,
    repo_inventory: RepoInventory,
) -> dict[str, Any]:
    findings: list[SanitizeFinding] = []
    seen: set[tuple[str, str | None, int | None, str]] = set()

    for file_path in iter_candidate_files(candidate_path):
        if not is_probably_text_file(file_path):
            continue
        text = read_text_file(file_path)
        if text is None:
            continue

        for line_number, line in enumerate(text.splitlines(), start=1):
            for category, pattern, recommendation in SANITIZE_PATTERNS:
                for match in pattern.finditer(line):
                    value = match.group("value").strip()
                    if should_skip_sanitize_match(category, value, line):
                        continue
                    finding_key = (category, display_path(file_path), line_number, value)
                    if finding_key in seen:
                        continue
                    seen.add(finding_key)
                    findings.append(
                        SanitizeFinding(
                            category=category,
                            file=display_path(file_path),
                            line=line_number,
                            value=value,
                            recommendation=recommendation,
                        )
                    )

    findings.extend(detect_brand_identifier_findings(inventory, repo_inventory))
    findings_by_category = Counter(finding.category for finding in findings)

    return {
        "total_findings": len(findings),
        "counts_by_category": dict(findings_by_category),
        "findings": [asdict(finding) for finding in findings[:40]],
        "truncated": max(0, len(findings) - 40),
    }


def collect_candidate_structural_tokens(candidate_path: Path) -> Counter[str]:
    token_counts: Counter[str] = Counter()
    token_counts.update(tokenize_identifierish(candidate_path.name))

    for file_path in iter_candidate_files(candidate_path):
        try:
            relative_path = file_path.relative_to(candidate_path)
        except ValueError:
            relative_path = file_path

        for part in relative_path.parts:
            part_path = Path(part)
            token_counts.update(tokenize_identifierish(part_path.stem))
            token_counts.update(tokenize_identifierish(part))

    return token_counts


def detect_brand_identifier_findings(
    inventory: CandidateInventory,
    _repo_inventory: RepoInventory,
) -> list[SanitizeFinding]:
    structural_token_counts = collect_candidate_structural_tokens(inventory.candidate_path)
    seeded_tokens = {
        token
        for token, count in structural_token_counts.items()
        if count >= 2
        and token not in STOP_TOKENS
        and token not in COMMON_TECH_TOKENS
        and len(token) >= 3
    }
    seeded_tokens.update(
        token
        for token in tokenize_identifierish(inventory.candidate_name)
        if token not in STOP_TOKENS
        and token not in COMMON_TECH_TOKENS
        and len(token) >= 3
    )

    branded_tokens = [
        token
        for token, count in inventory.token_counts.most_common(40)
        if count >= 2
        and token in seeded_tokens
        and token not in STOP_TOKENS
        and token not in COMMON_TECH_TOKENS
        and len(token) >= 3
    ]

    findings = []
    for token in branded_tokens[:8]:
        count = inventory.token_counts[token]
        findings.append(
            SanitizeFinding(
                category="brand-identifier",
                file=None,
                line=None,
                value=f"{token} ({count} hits)",
                recommendation="Rename or abstract project-specific identifiers before assimilation into GreebleFS.",
            )
        )
    return findings


def find_existing_reference_paths(
    inventory: CandidateInventory,
    repo_connections: list[RepoPathMatch],
) -> list[str]:
    candidate_name = inventory.candidate_name.lower()
    candidate_tokens = set(tokenize_identifierish(inventory.candidate_name))
    matches: list[str] = []

    for match in repo_connections:
        if match.match_type != "path-overlap":
            continue

        normalized_path = match.path.lower()
        path_tokens = set(tokenize_identifierish(match.path))
        candidate_name_hit = bool(candidate_name) and candidate_name in normalized_path
        token_subset_hit = bool(candidate_tokens) and candidate_tokens <= path_tokens
        if not candidate_name_hit and not token_subset_hit:
            continue
        matches.append(match.path)

    return matches[:3]


def build_next_steps(
    inventory: CandidateInventory,
    novelty: dict[str, Any],
    sanitize_summary: dict[str, Any],
    repo_connections: list[RepoPathMatch],
) -> list[str]:
    next_steps: list[str] = []
    if sanitize_summary["total_findings"] > 0:
        next_steps.append("Run the sanitize pass first and scrub paths, endpoints, ports, and branded identifiers before copying code.")
    existing_reference_paths = novelty.get("existing_reference_paths", [])
    if existing_reference_paths:
        next_steps.append(f"An existing repo reference already looks very close at `{existing_reference_paths[0]}`; treat this queue folder as compare-or-salvage, not automatically novel.")
    if novelty["new_dependencies"]:
        next_steps.append("Review new dependencies and decide whether they belong in GreebleFS or should be stripped during assimilation.")
    strongest_curated_match = next((match for match in repo_connections if match.match_type == "curated-hint"), None)
    strongest_path_match = next((match for match in repo_connections if match.match_type == "path-overlap"), None)
    if strongest_curated_match:
        next_steps.append(f"Route the integration review through `{strongest_curated_match.path}` because it is the strongest likely adoption seam.")
    elif strongest_path_match:
        next_steps.append(f"Start the repo-fit review at `{strongest_path_match.path}` because it is the strongest current connection.")
    if "protocol" in inventory.technology_tags:
        next_steps.append("Treat this as a contract/reference candidate and compare it against existing Rust/TS bridge seams before copying large surfaces.")
    if "ui-runtime" in inventory.technology_tags:
        next_steps.append("Look for patterns worth porting into shell or explorer UI runtime layers instead of importing the queue folder wholesale.")
    if not next_steps:
        next_steps.append("Review the top repo matches and decide whether this folder is a keeper, a partial donor, or a vault candidate.")
    return next_steps


def merge_dependency_maps(
    destination: dict[str, set[str]],
    addition: dict[str, set[str]],
) -> None:
    for ecosystem, dependencies in addition.items():
        destination.setdefault(ecosystem, set()).update(dependencies)


def collect_dependencies_from_manifest(file_path: Path) -> dict[str, set[str]]:
    if not file_path.exists():
        return {}
    try:
        text = file_path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        text = file_path.read_text(encoding="utf-8", errors="ignore")

    lower_name = file_path.name.lower()
    if lower_name == "cargo.toml":
        return {"cargo": parse_cargo_dependencies(text)}
    if lower_name == "package.json":
        return {"npm": parse_package_json_dependencies(text)}
    if lower_name == "pyproject.toml":
        return {"python": parse_pyproject_dependencies(text)}
    if lower_name == "go.mod":
        return {"go": parse_go_mod_dependencies(text)}
    if lower_name == "requirements.txt":
        return {"python": parse_requirements_txt(text)}
    return {}


def parse_cargo_dependencies(text: str) -> set[str]:
    if tomllib is None:
        return set()
    try:
        parsed = tomllib.loads(text)
    except Exception:
        return set()

    dependencies: set[str] = set()
    for section_name in ("dependencies", "dev-dependencies", "build-dependencies"):
        section = parsed.get(section_name)
        if isinstance(section, dict):
            dependencies.update(str(key).strip() for key in section if str(key).strip())

    workspace = parsed.get("workspace")
    if isinstance(workspace, dict):
        workspace_dependencies = workspace.get("dependencies")
        if isinstance(workspace_dependencies, dict):
            dependencies.update(str(key).strip() for key in workspace_dependencies if str(key).strip())

    return dependencies


def parse_package_json_dependencies(text: str) -> set[str]:
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        return set()

    dependencies: set[str] = set()
    for section_name in ("dependencies", "devDependencies", "peerDependencies", "optionalDependencies"):
        section = parsed.get(section_name)
        if isinstance(section, dict):
            dependencies.update(str(key).strip() for key in section if str(key).strip())
    return dependencies


def parse_pyproject_dependencies(text: str) -> set[str]:
    if tomllib is None:
        return set()
    try:
        parsed = tomllib.loads(text)
    except Exception:
        return set()

    dependencies: set[str] = set()
    project = parsed.get("project")
    if isinstance(project, dict):
        dependencies.update(parse_python_requirement_entries(project.get("dependencies")))
        optional_dependencies = project.get("optional-dependencies")
        if isinstance(optional_dependencies, dict):
            for entries in optional_dependencies.values():
                dependencies.update(parse_python_requirement_entries(entries))

    tool = parsed.get("tool")
    if isinstance(tool, dict):
        poetry = tool.get("poetry")
        if isinstance(poetry, dict):
            poetry_deps = poetry.get("dependencies")
            if isinstance(poetry_deps, dict):
                dependencies.update(str(key).strip() for key in poetry_deps if str(key).strip() and key != "python")
            poetry_group = poetry.get("group")
            if isinstance(poetry_group, dict):
                for group_entry in poetry_group.values():
                    if isinstance(group_entry, dict) and isinstance(group_entry.get("dependencies"), dict):
                        dependencies.update(str(key).strip() for key in group_entry["dependencies"] if str(key).strip())

    return dependencies


def parse_python_requirement_entries(value: Any) -> set[str]:
    if not isinstance(value, list):
        return set()
    dependencies: set[str] = set()
    for entry in value:
        if not isinstance(entry, str):
            continue
        match = re.match(r"^\s*([A-Za-z0-9_.-]+)", entry)
        if match:
            dependencies.add(match.group(1))
    return dependencies


def parse_go_mod_dependencies(text: str) -> set[str]:
    dependencies: set[str] = set()
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("//"):
            continue
        if line.startswith("require "):
            line = line[len("require "):].strip()
        if line.startswith("(") or line.startswith(")"):
            continue
        if " " in line and "/" in line:
            dependency = line.split()[0].strip()
            if dependency and dependency != "module":
                dependencies.add(dependency)
    return dependencies


def parse_requirements_txt(text: str) -> set[str]:
    dependencies: set[str] = set()
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        match = re.match(r"^([A-Za-z0-9_.-]+)", line)
        if match:
            dependencies.add(match.group(1))
    return dependencies


def find_manifest_files(root: Path) -> list[Path]:
    manifests: list[Path] = []
    for scan_root in iter_repo_scan_roots(root):
        for file_path in iter_candidate_files(scan_root):
            if file_path.name in MANIFEST_FILE_NAMES:
                manifests.append(file_path)
    return manifests


def iter_repo_scan_roots(root: Path) -> Iterator[Path]:
    for name in REPO_SCAN_ROOT_NAMES:
        candidate = root / name
        if candidate.exists():
            yield candidate


def iter_candidate_files(root: Path) -> Iterator[Path]:
    if not root.exists():
        return
    for current_root, dir_names, file_names in __import__("os").walk(root):
        dir_names[:] = [name for name in dir_names if name not in SKIP_DIRECTORY_NAMES]
        current_root_path = Path(current_root)
        for file_name in file_names:
            file_path = current_root_path / file_name
            yield file_path


def detect_language(file_path: Path) -> str | None:
    return LANGUAGE_BY_SUFFIX.get(file_path.suffix.lower())


def safe_file_size(file_path: Path) -> int:
    try:
        return file_path.stat().st_size
    except OSError:
        return 0


def is_probably_text_file(file_path: Path) -> bool:
    if file_path.suffix.lower() in TEXT_FILE_SUFFIXES:
        return True
    try:
        with file_path.open("rb") as handle:
            chunk = handle.read(512)
    except OSError:
        return False
    return b"\x00" not in chunk


def read_text_file(file_path: Path) -> str | None:
    try:
        return file_path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        try:
            return file_path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            return None
    except OSError:
        return None


def classify_queue_source(candidate_path: Path) -> str:
    try:
        candidate_path.relative_to(STAGING_ROOT)
        return "staging"
    except ValueError:
        pass

    try:
        candidate_path.relative_to(VAULT_ROOT)
        return "vault"
    except ValueError:
        return "external"


def tokenize_identifierish(value: str) -> list[str]:
    spaced = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", value)
    tokens = re.split(r"[^A-Za-z0-9]+", spaced)
    normalized_tokens = []
    for token in tokens:
        normalized = token.strip().lower()
        if len(normalized) < 2 or normalized.isdigit():
            continue
        if normalized in STOP_TOKENS:
            continue
        normalized_tokens.append(normalized)
    return normalized_tokens


def extract_code_tokens(text: str) -> list[str]:
    tokens = re.findall(r"[A-Za-z_][A-Za-z0-9_]{2,}", text)
    normalized: list[str] = []
    for token in tokens:
        normalized.extend(tokenize_identifierish(token))
    return normalized


def ranked_tokens(counter: Counter[str], limit: int) -> list[str]:
    return [token for token, _count in counter.most_common(limit)]


def infer_technology_tags(
    languages: Counter[str],
    dependencies_by_ecosystem: dict[str, set[str]],
    top_tokens: list[str],
) -> list[str]:
    tags: list[str] = []
    dependency_names = {
        dependency.lower()
        for dependencies in dependencies_by_ecosystem.values()
        for dependency in dependencies
    }
    token_set = set(top_tokens) | dependency_names | set(languages.keys())

    if "rust" in languages:
        tags.append("rust")
    if "typescript" in languages or "tsx" in languages or "react" in languages:
        tags.append("frontend")
    if {"serde", "bincode", "protocol", "transport", "state"} & token_set:
        tags.append("protocol")
    if {"ts", "bindings", "ts-rs", "specta"} & token_set or "ts_rs" in token_set:
        tags.append("ts-bindings")
    if {"bevy", "wgpu", "shader", "render", "gpu"} & token_set:
        tags.append("engine")
    if {"layout", "portal", "focus", "virtual", "animation", "patch"} & token_set:
        tags.append("ui-runtime")
    if {"plugin", "module", "command"} & token_set:
        tags.append("extensible")

    return tags or ["general"]


def summarize_candidate(
    candidate_name: str,
    languages: Counter[str],
    dependencies_by_ecosystem: dict[str, set[str]],
    technology_tags: list[str],
) -> str:
    primary_language = languages.most_common(1)[0][0] if languages else "mixed"
    dependency_names = sorted(
        {
            dependency
            for dependencies in dependencies_by_ecosystem.values()
            for dependency in dependencies
        }
    )
    dependency_summary = ", ".join(dependency_names[:4]) if dependency_names else "no obvious external dependencies"
    tag_summary = ", ".join(technology_tags[:4])
    return (
        f"{candidate_name} looks like a {primary_language}-leaning queue candidate focused on {tag_summary}; "
        f"manifest evidence points to {dependency_summary}."
    )


def build_weighted_token_map(inventory: CandidateInventory) -> dict[str, float]:
    token_weights: dict[str, float] = {}
    for index, token in enumerate(inventory.top_tokens):
        token_weights[token] = max(token_weights.get(token, 0.0), 3.8 - index * 0.18)
    for token in inventory.path_tokens:
        token_weights[token] = max(token_weights.get(token, 0.0), 3.0)
    for ecosystem, dependencies in inventory.dependencies_by_ecosystem.items():
        for dependency in dependencies:
            for token in tokenize_identifierish(dependency):
                token_weights[token] = max(token_weights.get(token, 0.0), 2.9 if ecosystem == "cargo" else 2.4)
    for token in inventory.technology_tags:
        token_weights[token] = max(token_weights.get(token, 0.0), 2.0)
    return token_weights


def dedupe_repo_matches(matches: list[RepoPathMatch]) -> list[RepoPathMatch]:
    best_by_path: dict[str, RepoPathMatch] = {}
    for match in matches:
        existing = best_by_path.get(match.path)
        if existing is None or match.score > existing.score:
            best_by_path[match.path] = match
    return list(best_by_path.values())


def should_skip_sanitize_match(category: str, value: str, line: str) -> bool:
    if category == "network-endpoint" and "localhost" in value:
        return True
    if category == "absolute-path" and value.startswith("/icons/"):
        return True
    if category == "magic-port":
        return "__pycache__" in line
    return False


def format_markdown_report(report: CandidateReport) -> str:
    lines = [
        f"# Queue Report: {report.candidate}",
        "",
        f"- Source: `{report.source}`",
        f"- Candidate Path: `{report.candidate_path}`",
        f"- Summary: {report.summary}",
        f"- Technology Tags: {', '.join(report.technology_tags) or 'none'}",
        "",
        "## Stats",
        "",
        f"- Files: {report.stats['file_count']}",
        f"- Text Files: {report.stats['text_file_count']}",
        f"- Total Lines: {report.stats['total_lines']}",
        f"- Total Bytes: {report.stats['total_bytes']}",
        f"- Languages: {format_counts(report.stats['languages'])}",
        f"- Top Tokens: {', '.join(report.stats['top_tokens']) or 'none'}",
        "",
        "## Dependencies",
        "",
    ]

    if report.dependencies_by_ecosystem:
        for ecosystem, dependencies in report.dependencies_by_ecosystem.items():
            lines.append(f"- {ecosystem}: {', '.join(dependencies) if dependencies else 'none'}")
    else:
        lines.append("- none")

    lines.extend([
        "",
        "## Novelty",
        "",
        f"- Label: `{report.novelty['label']}`",
        f"- New Dependencies: {', '.join(report.novelty['new_dependencies']) or 'none'}",
        f"- Familiar Dependencies: {', '.join(report.novelty['familiar_dependencies']) or 'none'}",
        f"- Unique Tokens: {', '.join(report.novelty['unique_tokens']) or 'none'}",
        f"- Existing Reference Paths: {', '.join(report.novelty.get('existing_reference_paths', [])) or 'none'}",
        "",
        "## Repo Connections",
        "",
    ])

    if report.repo_connections:
        for match in report.repo_connections:
            lines.append(
                f"- `{match.path}` [{match.match_type}, score {match.score:.2f}]"
                f": matched {', '.join(match.matched_tokens) or 'none'}; {match.reason}"
            )
    else:
        lines.append("- none")

    lines.extend([
        "",
        "## Sanitize",
        "",
        f"- Total Findings: {report.sanitize['total_findings']}",
        f"- Counts: {format_counts(report.sanitize['counts_by_category'])}",
    ])

    findings = report.sanitize.get("findings", [])
    if findings:
        lines.append("- Findings:")
        for finding in findings[:12]:
            location = (
                f"`{finding['file']}:{finding['line']}`"
                if finding["file"] and finding["line"]
                else "`candidate-wide`"
            )
            lines.append(
                f"  - {finding['category']} at {location}: `{finding['value']}` -> {finding['recommendation']}"
            )
        if report.sanitize.get("truncated", 0):
            lines.append(f"  - ... {report.sanitize['truncated']} more findings omitted")
    else:
        lines.append("- Findings: none")

    lines.extend([
        "",
        "## Next Steps",
        "",
    ])
    for step in report.next_steps:
        lines.append(f"- {step}")

    return "\n".join(lines)


def format_markdown_sanitize(candidate_path: Path, sanitize_summary: dict[str, Any]) -> str:
    lines = [
        f"# Queue Sanitize: {candidate_path.name}",
        "",
        f"- Candidate Path: `{display_path(candidate_path)}`",
        f"- Total Findings: {sanitize_summary['total_findings']}",
        f"- Counts: {format_counts(sanitize_summary['counts_by_category'])}",
        "",
        "## Findings",
        "",
    ]
    findings = sanitize_summary.get("findings", [])
    if not findings:
        lines.append("- none")
    else:
        for finding in findings:
            location = (
                f"`{finding['file']}:{finding['line']}`"
                if finding["file"] and finding["line"]
                else "`candidate-wide`"
            )
            lines.append(
                f"- {finding['category']} at {location}: `{finding['value']}` -> {finding['recommendation']}"
            )
    if sanitize_summary.get("truncated", 0):
        lines.extend([
            "",
            f"... {sanitize_summary['truncated']} more findings omitted",
        ])
    return "\n".join(lines)


def format_counts(counts: dict[str, Any]) -> str:
    if not counts:
        return "none"
    return ", ".join(f"{key}={value}" for key, value in counts.items())


def display_path(path: Path) -> str:
    try:
        return str(path.resolve().relative_to(REPO_ROOT))
    except ValueError:
        return str(path.resolve())


def report_to_dict(report: CandidateReport) -> dict[str, Any]:
    data = asdict(report)
    data["repo_connections"] = [asdict(match) for match in report.repo_connections]
    return data


if __name__ == "__main__":
    raise SystemExit(main())
