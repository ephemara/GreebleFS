#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path, PurePosixPath
from typing import Callable, Iterable

import tomllib


RepomixRunner = Callable[[Path, Path, tuple[str, ...]], None]


class ReferenceScrubError(RuntimeError):
    pass


@dataclass(frozen=True)
class GlobalRules:
    repomap_filename: str
    manifest_filename: str
    staging_dir_suffix: str
    backup_dir_suffix: str
    collapse_container_names: tuple[str, ...]
    generic_hoist_root_names: tuple[str, ...]
    drop_dir_names: tuple[str, ...]
    repomix_ignore_patterns: tuple[str, ...]
    binary_extensions: tuple[str, ...]
    root_text_file_names: tuple[str, ...]


@dataclass(frozen=True)
class RepoProfile:
    name: str
    keep_roots: tuple[str, ...] = ()
    drop_roots: tuple[str, ...] = ()
    hoist_roots: tuple[str, ...] = ()
    collapse_roots: tuple[str, ...] = ()
    drop_paths: tuple[str, ...] = ()
    root_aliases: dict[str, str] = field(default_factory=dict)


@dataclass
class ScrubResult:
    repo_name: str
    profile_name: str
    apply: bool
    only_repomix: bool
    kept_root_entries: list[str]
    dropped_root_entries: list[str]
    alias_operations: list[dict[str, str]]
    hoist_operations: list[dict[str, str]]
    collapse_operations: list[dict[str, str]]
    repomap_path: str | None = None
    manifest_path: str | None = None


def default_workspace_root() -> Path:
    script_path = Path(__file__).resolve()
    for candidate in script_path.parents:
        if (candidate / "package.json").exists() and (candidate / "reference").is_dir():
            return candidate
    return script_path.parents[2]


def default_profiles_path(workspace_root: Path) -> Path:
    return workspace_root / "scripts" / "reference-tools" / "reference_scrub_profiles.toml"


def load_profile_data(profiles_path: Path) -> tuple[GlobalRules, dict[str, RepoProfile]]:
    raw = tomllib.loads(profiles_path.read_text(encoding="utf-8"))
    global_raw = raw["global"]
    profiles_raw = raw.get("profiles", {})
    global_rules = GlobalRules(
        repomap_filename=global_raw["repomap_filename"],
        manifest_filename=global_raw["manifest_filename"],
        staging_dir_suffix=global_raw["staging_dir_suffix"],
        backup_dir_suffix=global_raw["backup_dir_suffix"],
        collapse_container_names=tuple(global_raw["collapse_container_names"]),
        generic_hoist_root_names=tuple(global_raw["generic_hoist_root_names"]),
        drop_dir_names=tuple(global_raw["drop_dir_names"]),
        repomix_ignore_patterns=tuple(global_raw["repomix_ignore_patterns"]),
        binary_extensions=tuple(global_raw["binary_extensions"]),
        root_text_file_names=tuple(global_raw["root_text_file_names"]),
    )
    profiles: dict[str, RepoProfile] = {}
    for name, profile_raw in profiles_raw.items():
        profiles[name] = RepoProfile(
            name=name,
            keep_roots=tuple(_normalize_relative_path(value) for value in profile_raw.get("keep_roots", [])),
            drop_roots=tuple(_normalize_relative_path(value) for value in profile_raw.get("drop_roots", [])),
            hoist_roots=tuple(_normalize_relative_path(value) for value in profile_raw.get("hoist_roots", [])),
            collapse_roots=tuple(_normalize_relative_path(value) for value in profile_raw.get("collapse_roots", [])),
            drop_paths=tuple(_normalize_relative_path(value) for value in profile_raw.get("drop_paths", [])),
            root_aliases={
                _normalize_relative_path(source): _normalize_relative_path(destination)
                for source, destination in profile_raw.get("root_aliases", {}).items()
            },
        )
    return global_rules, profiles


def _normalize_relative_path(value: str) -> str:
    raw = value.replace("\\", "/").strip("/")
    if not raw:
        raise ReferenceScrubError("Empty relative path is not allowed in profile configuration.")
    path = PurePosixPath(raw)
    if path.is_absolute():
        raise ReferenceScrubError(f"Absolute profile path is not allowed: {value}")
    for part in path.parts:
        if part in ("", ".", ".."):
            raise ReferenceScrubError(f"Unsafe profile path is not allowed: {value}")
    return path.as_posix()


def slugify_path_fragment(value: str) -> str:
    slug = re.sub(r"[^A-Za-z0-9._-]+", "-", value.strip())
    slug = re.sub(r"-{2,}", "-", slug).strip("-")
    return slug or "path"


def is_probably_text_file(path: Path) -> bool:
    with path.open("rb") as handle:
        chunk = handle.read(8192)
    if not chunk:
        return True
    if b"\0" in chunk:
        return False
    try:
        chunk.decode("utf-8")
        return True
    except UnicodeDecodeError:
        return False


def default_repomix_runner(repo_path: Path, output_path: Path, ignore_patterns: tuple[str, ...]) -> None:
    command = [
        "repomix",
        "--style",
        "markdown",
        "--compress",
        "--quiet",
        "--output",
        str(output_path),
        "--ignore",
        ",".join(ignore_patterns),
        ".",
    ]
    subprocess.run(command, cwd=repo_path, check=True)


class ReferenceScrubber:
    def __init__(
        self,
        workspace_root: Path | None = None,
        reference_root: Path | None = None,
        profiles_path: Path | None = None,
        repomix_runner: RepomixRunner | None = None,
    ) -> None:
        self.workspace_root = (workspace_root or default_workspace_root()).resolve()
        self.reference_root = (reference_root or (self.workspace_root / "reference")).resolve()
        self.profiles_path = (profiles_path or default_profiles_path(self.workspace_root)).resolve()
        self.global_rules, self.profiles = load_profile_data(self.profiles_path)
        self.repomix_runner = repomix_runner or default_repomix_runner

    def list_repositories(self) -> list[str]:
        if not self.reference_root.exists():
            return []
        repos = [path.name for path in self.reference_root.iterdir() if path.is_dir()]
        return sorted(repos)

    def resolve_repo_path(self, repo_name: str) -> Path:
        pure_name = PurePosixPath(repo_name.replace("\\", "/"))
        if pure_name.is_absolute() or len(pure_name.parts) != 1 or pure_name.name in ("", ".", ".."):
            raise ReferenceScrubError(f"Repo must be a direct child name under reference/: {repo_name}")
        repo_path = (self.reference_root / pure_name.name).resolve()
        if repo_path.parent != self.reference_root:
            raise ReferenceScrubError(f"Repo path escapes reference/: {repo_name}")
        if not repo_path.exists():
            raise ReferenceScrubError(f"Repo does not exist under reference/: {repo_name}")
        if not repo_path.is_dir():
            raise ReferenceScrubError(f"Repo path is not a directory: {repo_name}")
        if repo_path.is_symlink():
            raise ReferenceScrubError(f"Repo path may not be a symlink: {repo_name}")
        return repo_path

    def scrub_repo(
        self,
        repo_name: str,
        *,
        apply: bool = False,
        skip_repomix: bool = False,
        only_repomix: bool = False,
    ) -> ScrubResult:
        repo_path = self.resolve_repo_path(repo_name)
        self._reject_symlinks(repo_path)
        profile = self.profiles.get(repo_name, RepoProfile(name="generic"))

        if only_repomix:
            repomap_path = repo_path / self.global_rules.repomap_filename
            if apply and not skip_repomix:
                self.repomix_runner(repo_path, repomap_path, self.global_rules.repomix_ignore_patterns)
            return ScrubResult(
                repo_name=repo_name,
                profile_name=profile.name,
                apply=apply,
                only_repomix=True,
                kept_root_entries=[],
                dropped_root_entries=[],
                alias_operations=[],
                hoist_operations=[],
                collapse_operations=[],
                repomap_path=str(repomap_path) if apply and not skip_repomix else None,
            )

        if apply:
            return self._apply_scrub(repo_path, profile, skip_repomix=skip_repomix)
        return self._dry_run_scrub(repo_path, profile, skip_repomix=skip_repomix)

    def _dry_run_scrub(self, repo_path: Path, profile: RepoProfile, *, skip_repomix: bool) -> ScrubResult:
        prefix = f".{repo_path.name}{self.global_rules.staging_dir_suffix}-dryrun-"
        with tempfile.TemporaryDirectory(prefix=prefix, dir=self.reference_root) as temp_dir:
            staging_root = Path(temp_dir)
            result = self._build_scrubbed_tree(repo_path, staging_root, profile, skip_repomix=skip_repomix)
        result.apply = False
        return result

    def _apply_scrub(self, repo_path: Path, profile: RepoProfile, *, skip_repomix: bool) -> ScrubResult:
        staging_root = self.reference_root / f".{repo_path.name}{self.global_rules.staging_dir_suffix}"
        backup_root = self.reference_root / f".{repo_path.name}{self.global_rules.backup_dir_suffix}"
        self._remove_if_exists(staging_root)
        self._remove_if_exists(backup_root)
        try:
            result = self._build_scrubbed_tree(repo_path, staging_root, profile, skip_repomix=skip_repomix)
            os.replace(repo_path, backup_root)
            try:
                os.replace(staging_root, repo_path)
            except Exception:
                os.replace(backup_root, repo_path)
                raise
            self._remove_if_exists(backup_root)
            result.apply = True
            result.repomap_path = str(repo_path / self.global_rules.repomap_filename) if not skip_repomix else None
            result.manifest_path = str(repo_path / self.global_rules.manifest_filename)
            return result
        finally:
            if staging_root.exists():
                self._remove_if_exists(staging_root)
            if backup_root.exists():
                self._remove_if_exists(backup_root)

    def _build_scrubbed_tree(self, repo_path: Path, staging_root: Path, profile: RepoProfile, *, skip_repomix: bool) -> ScrubResult:
        staging_root.mkdir(parents=True, exist_ok=True)
        kept_root_entries: list[str] = []
        dropped_root_entries: list[str] = []

        for entry in sorted(repo_path.iterdir(), key=lambda path: path.name):
            relative_name = entry.name
            if self._is_generated_name(repo_path.name, relative_name):
                dropped_root_entries.append(relative_name)
                continue
            if entry.is_symlink():
                raise ReferenceScrubError(f"Symlink entries are not supported: {entry}")
            if entry.is_dir():
                if self._should_keep_root_dir(entry, profile):
                    copied = self._copy_filtered_directory(entry, staging_root / entry.name, PurePosixPath(entry.name), profile)
                    if copied:
                        kept_root_entries.append(relative_name)
                    else:
                        dropped_root_entries.append(relative_name)
                else:
                    dropped_root_entries.append(relative_name)
                continue
            if self._should_keep_file(entry, at_root=True):
                shutil.copy2(entry, staging_root / entry.name)
                kept_root_entries.append(relative_name)
            else:
                dropped_root_entries.append(relative_name)

        alias_operations = self._apply_root_aliases(staging_root, profile)
        hoist_operations, collapse_targets = self._apply_root_hoists(staging_root, repo_path.name, profile)
        collapse_targets.update(PurePosixPath(path) for path in profile.collapse_roots)
        collapse_targets.update(PurePosixPath(item["destination"]) for item in alias_operations if (staging_root / item["destination"]).is_dir())
        collapse_operations = self._collapse_targets(staging_root, repo_path.name, collapse_targets)
        self._remove_empty_directories(staging_root)

        repomap_path: Path | None = None
        if not skip_repomix:
            repomap_path = staging_root / self.global_rules.repomap_filename
            self.repomix_runner(staging_root, repomap_path, self.global_rules.repomix_ignore_patterns)

        manifest_path = staging_root / self.global_rules.manifest_filename
        final_root_entries = sorted(
            entry.name
            for entry in staging_root.iterdir()
            if entry.name not in {self.global_rules.manifest_filename, self.global_rules.repomap_filename}
        )
        manifest = {
            "repo_name": repo_path.name,
            "profile_name": profile.name,
            "source_repo": str(repo_path),
            "profile": {
                "keep_roots": list(profile.keep_roots),
                "drop_roots": list(profile.drop_roots),
                "hoist_roots": list(profile.hoist_roots),
                "collapse_roots": list(profile.collapse_roots),
                "drop_paths": list(profile.drop_paths),
                "root_aliases": profile.root_aliases,
            },
            "final_root_entries": final_root_entries,
            "generated_files": sorted(
                name
                for name in (self.global_rules.manifest_filename, self.global_rules.repomap_filename)
                if (staging_root / name).exists()
            ),
        }
        manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")

        return ScrubResult(
            repo_name=repo_path.name,
            profile_name=profile.name,
            apply=True,
            only_repomix=False,
            kept_root_entries=kept_root_entries,
            dropped_root_entries=dropped_root_entries,
            alias_operations=alias_operations,
            hoist_operations=hoist_operations,
            collapse_operations=collapse_operations,
            repomap_path=str(repomap_path) if repomap_path else None,
            manifest_path=str(manifest_path),
        )

    def _should_keep_root_dir(self, path: Path, profile: RepoProfile) -> bool:
        name = path.name
        normalized_name = _normalize_relative_path(name)
        if normalized_name in profile.drop_roots or name in self.global_rules.drop_dir_names:
            return False
        if name.startswith(".") and normalized_name not in profile.keep_roots:
            return False
        if normalized_name in profile.keep_roots:
            return True
        return True

    def _copy_filtered_directory(self, source_dir: Path, destination_dir: Path, relative_dir: PurePosixPath, profile: RepoProfile) -> bool:
        if source_dir.is_symlink():
            raise ReferenceScrubError(f"Symlink directories are not supported: {source_dir}")
        copied_any = False
        destination_dir.mkdir(parents=True, exist_ok=True)
        for child in sorted(source_dir.iterdir(), key=lambda path: path.name):
            child_relative = relative_dir / child.name
            if child.is_symlink():
                raise ReferenceScrubError(f"Symlink entries are not supported: {child}")
            if child.is_dir():
                if self._should_drop_dir(child_relative, child.name, profile):
                    continue
                child_copied = self._copy_filtered_directory(child, destination_dir / child.name, child_relative, profile)
                copied_any = copied_any or child_copied
                continue
            if self._should_keep_file(child, at_root=False):
                target_path = destination_dir / child.name
                target_path.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(child, target_path)
                copied_any = True
        if not copied_any:
            self._remove_if_exists(destination_dir)
        return copied_any

    def _should_drop_dir(self, relative_dir: PurePosixPath, dir_name: str, profile: RepoProfile) -> bool:
        normalized = relative_dir.as_posix()
        if dir_name in self.global_rules.drop_dir_names:
            return True
        if normalized in profile.drop_roots:
            return True
        return self._matches_drop_path(normalized, profile.drop_paths)

    def _matches_drop_path(self, relative_path: str, drop_paths: Iterable[str]) -> bool:
        for drop_path in drop_paths:
            if relative_path == drop_path or relative_path.startswith(f"{drop_path}/"):
                return True
        return False

    def _should_keep_file(self, path: Path, *, at_root: bool) -> bool:
        if self._is_generated_name("", path.name):
            return False
        suffix = path.suffix.lower()
        if suffix in self.global_rules.binary_extensions:
            return False
        if at_root and path.name in self.global_rules.root_text_file_names:
            return True
        return is_probably_text_file(path)

    def _apply_root_aliases(self, staging_root: Path, profile: RepoProfile) -> list[dict[str, str]]:
        operations: list[dict[str, str]] = []
        for source_value, destination_value in sorted(profile.root_aliases.items()):
            source_relative = PurePosixPath(source_value)
            destination_relative = PurePosixPath(destination_value)
            source_path = staging_root / source_relative
            if not source_path.exists():
                continue
            target_parent = staging_root / destination_relative.parent
            target_parent.mkdir(parents=True, exist_ok=True)
            final_name = self._choose_destination_name(
                target_parent=target_parent,
                candidate_name=destination_relative.name,
                source_relative=source_relative,
            )
            final_path = target_parent / final_name
            shutil.move(str(source_path), str(final_path))
            self._remove_empty_ancestors(source_path.parent, stop_at=staging_root)
            operations.append(
                {
                    "source": source_relative.as_posix(),
                    "destination": str((destination_relative.parent / final_name).as_posix()),
                }
            )
        return operations

    def _apply_root_hoists(
        self,
        staging_root: Path,
        repo_name: str,
        profile: RepoProfile,
    ) -> tuple[list[dict[str, str]], set[PurePosixPath]]:
        operations: list[dict[str, str]] = []
        collapse_targets: set[PurePosixPath] = set()
        hoist_roots = tuple(profile.hoist_roots or self._discover_generic_hoist_roots(staging_root))
        for root_value in hoist_roots:
            root_relative = PurePosixPath(root_value)
            root_path = staging_root / root_relative
            if not root_path.exists() or not root_path.is_dir():
                continue
            for child in sorted(root_path.iterdir(), key=lambda path: path.name):
                child_relative = root_relative / child.name
                destination_name = self._choose_destination_name(
                    target_parent=staging_root,
                    candidate_name=child.name,
                    source_relative=child_relative,
                )
                destination_path = staging_root / destination_name
                shutil.move(str(child), str(destination_path))
                operations.append(
                    {
                        "source": child_relative.as_posix(),
                        "destination": destination_name,
                    }
                )
                if destination_path.is_dir():
                    collapse_targets.add(PurePosixPath(destination_name))
            self._remove_empty_ancestors(root_path, stop_at=staging_root)
        return operations, collapse_targets

    def _discover_generic_hoist_roots(self, staging_root: Path) -> list[str]:
        discovered: list[str] = []
        for candidate_name in self.global_rules.generic_hoist_root_names:
            candidate_path = staging_root / candidate_name
            if candidate_path.is_dir():
                discovered.append(candidate_name)
        return discovered

    def _collapse_targets(
        self,
        staging_root: Path,
        repo_name: str,
        collapse_targets: set[PurePosixPath],
    ) -> list[dict[str, str]]:
        operations: list[dict[str, str]] = []
        for target_relative in sorted(collapse_targets, key=lambda value: value.as_posix()):
            target_path = staging_root / target_relative
            if not target_path.exists() or not target_path.is_dir():
                continue
            changed = True
            while changed:
                changed = False
                for container_name in self.global_rules.collapse_container_names:
                    container_path = target_path / container_name
                    if not container_path.is_dir():
                        continue
                    changed = True
                    for child in sorted(container_path.iterdir(), key=lambda path: path.name):
                        child_relative = target_relative / container_name / child.name
                        destination_name = self._choose_destination_name(
                            target_parent=target_path,
                            candidate_name=child.name,
                            source_relative=child_relative,
                        )
                        destination_path = target_path / destination_name
                        shutil.move(str(child), str(destination_path))
                        operations.append(
                            {
                                "source": child_relative.as_posix(),
                                "destination": str((target_relative / destination_name).as_posix()),
                            }
                        )
                    self._remove_empty_ancestors(container_path, stop_at=target_path)
        return operations

    def _choose_destination_name(
        self,
        *,
        target_parent: Path,
        candidate_name: str,
        source_relative: PurePosixPath,
    ) -> str:
        initial_target = target_parent / candidate_name
        if not initial_target.exists():
            return candidate_name
        immediate_prefix = slugify_path_fragment(source_relative.parent.name or "root")
        prefixed_name = f"{immediate_prefix}__{candidate_name}"
        if not (target_parent / prefixed_name).exists():
            return prefixed_name
        full_prefix = slugify_path_fragment(source_relative.parent.as_posix())
        fully_prefixed_name = f"{full_prefix}__{candidate_name}"
        if not (target_parent / fully_prefixed_name).exists():
            return fully_prefixed_name
        raise ReferenceScrubError(
            f"Unable to deterministically rename collision for {source_relative.as_posix()} -> {target_parent / candidate_name}"
        )

    def _reject_symlinks(self, repo_path: Path) -> None:
        for current_root, dir_names, file_names in os.walk(repo_path, followlinks=False):
            current_path = Path(current_root)
            for name in dir_names + file_names:
                candidate = current_path / name
                if candidate.is_symlink():
                    raise ReferenceScrubError(f"Symlink entries are not supported: {candidate}")

    def _is_generated_name(self, repo_name: str, entry_name: str) -> bool:
        if entry_name in {self.global_rules.repomap_filename, self.global_rules.manifest_filename}:
            return True
        if repo_name:
            if entry_name.startswith(f".{repo_name}{self.global_rules.staging_dir_suffix}"):
                return True
            if entry_name.startswith(f".{repo_name}{self.global_rules.backup_dir_suffix}"):
                return True
        return False

    def _remove_empty_directories(self, root: Path) -> None:
        for directory in sorted((path for path in root.rglob("*") if path.is_dir()), key=lambda path: len(path.parts), reverse=True):
            try:
                directory.rmdir()
            except OSError:
                continue

    def _remove_empty_ancestors(self, start_path: Path, *, stop_at: Path) -> None:
        current = start_path
        while current != stop_at and current.exists():
            try:
                current.rmdir()
            except OSError:
                break
            current = current.parent

    def _remove_if_exists(self, path: Path) -> None:
        if not path.exists():
            return
        if path.is_dir():
            shutil.rmtree(path)
            return
        path.unlink()


def build_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Destructively scrub reference repos into flat agent-friendly code roots.")
    parser.add_argument("--repo", action="append", default=[], help="Direct child name under reference/ to scrub. Can be repeated.")
    parser.add_argument("--all", action="store_true", help="Scrub every direct child of reference/.")
    parser.add_argument("--apply", action="store_true", help="Apply the scrub. Dry-run is the default.")
    parser.add_argument("--skip-repomix", action="store_true", help="Skip repomap generation.")
    parser.add_argument("--only-repomix", action="store_true", help="Only regenerate repomap.md for the selected repo(s).")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_argument_parser()
    args = parser.parse_args(argv)
    if args.all and args.repo:
        parser.error("--all cannot be combined with --repo")
    scrubber = ReferenceScrubber()
    selected_repos = scrubber.list_repositories() if args.all else sorted(dict.fromkeys(args.repo))
    if not selected_repos:
        parser.error("Select at least one repo with --repo or use --all")
    exit_code = 0
    for repo_name in selected_repos:
        try:
            result = scrubber.scrub_repo(
                repo_name,
                apply=args.apply,
                skip_repomix=args.skip_repomix,
                only_repomix=args.only_repomix,
            )
            if result.only_repomix:
                mode = "APPLIED" if args.apply else "DRY-RUN"
                print(f"[{mode}] {repo_name}: repomap-only")
                continue
            mode = "APPLIED" if args.apply else "DRY-RUN"
            print(
                f"[{mode}] {repo_name}: kept={len(result.kept_root_entries)} "
                f"dropped={len(result.dropped_root_entries)} "
                f"aliases={len(result.alias_operations)} "
                f"hoists={len(result.hoist_operations)} "
                f"collapses={len(result.collapse_operations)}"
            )
        except ReferenceScrubError as error:
            exit_code = 1
            print(f"[ERROR] {repo_name}: {error}", file=sys.stderr)
        except subprocess.CalledProcessError as error:
            exit_code = 1
            print(f"[ERROR] {repo_name}: repomix failed with exit code {error.returncode}", file=sys.stderr)
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
