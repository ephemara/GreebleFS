from __future__ import annotations

import fnmatch
import json
import os
import shutil
import sys
import tempfile
import unittest
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import reference_scrub


def fake_repomix_runner(repo_path: Path, output_path: Path, ignore_patterns: tuple[str, ...]) -> None:
    files: list[str] = []
    for file_path in sorted(repo_path.rglob("*")):
        if not file_path.is_file():
            continue
        relative = file_path.relative_to(repo_path).as_posix()
        if any(fnmatch.fnmatch(relative, pattern) or fnmatch.fnmatch(file_path.name, pattern) for pattern in ignore_patterns):
            continue
        files.append(relative)
    output_path.write_text("\n".join(files) + ("\n" if files else ""), encoding="utf-8")


class ReferenceScrubberTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.workspace_root = Path(self.temp_dir.name)
        self.reference_root = self.workspace_root / "reference"
        self.reference_root.mkdir()
        self.scrubber = reference_scrub.ReferenceScrubber(
            workspace_root=ROOT_DIR,
            reference_root=self.reference_root,
            profiles_path=ROOT_DIR / "reference_scrub_profiles.toml",
            repomix_runner=fake_repomix_runner,
        )

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def test_rejects_outside_repo_name(self) -> None:
        with self.assertRaises(reference_scrub.ReferenceScrubError):
            self.scrubber.resolve_repo_path("../outside")

    def test_rejects_symlink_escape(self) -> None:
        repo = self.reference_root / "symlinked"
        repo.mkdir()
        external_file = self.workspace_root / "external.txt"
        external_file.write_text("secret\n", encoding="utf-8")
        os.symlink(external_file, repo / "escape.txt")
        with self.assertRaises(reference_scrub.ReferenceScrubError):
            self.scrubber.scrub_repo("symlinked", apply=True)

    def test_dry_run_leaves_repo_untouched(self) -> None:
        repo = self._make_files_main_fixture()
        before = self.snapshot_tree(repo)
        self.scrubber.scrub_repo("files-main", apply=False)
        after = self.snapshot_tree(repo)
        self.assertEqual(before, after)
        self.assertFalse((repo / "repomap.md").exists())

    def test_files_main_hoists_projects_and_removes_tests(self) -> None:
        repo = self._make_files_main_fixture()
        self.scrubber.scrub_repo("files-main", apply=True)
        self.assertTrue((repo / "Files.App").is_dir())
        self.assertTrue((repo / "Files.App" / "Program.cs").is_file())
        self.assertTrue((repo / "Files.Shared").is_dir())
        self.assertFalse((repo / "src").exists())
        self.assertFalse((repo / "tests").exists())
        self.assertTrue((repo / "reference-scrub-manifest.json").is_file())
        self.assertTrue((repo / "repomap.md").is_file())

    def test_fexplorer_collapses_src_tauri_src(self) -> None:
        repo = self.reference_root / "fexplorer"
        (repo / "src" / "components").mkdir(parents=True)
        (repo / "src-tauri" / "src").mkdir(parents=True)
        (repo / "src" / "App.tsx").write_text("export const App = () => null;\n", encoding="utf-8")
        (repo / "src" / "components" / "Pane.tsx").write_text("export const Pane = () => null;\n", encoding="utf-8")
        (repo / "src-tauri" / "Cargo.toml").write_text("[package]\nname = 'fexplorer'\n", encoding="utf-8")
        (repo / "src-tauri" / "src" / "main.rs").write_text("fn main() {}\n", encoding="utf-8")
        (repo / "screenshots").mkdir()
        (repo / "screenshots" / "shot.png").write_bytes(b"\x89PNG\r\n")

        self.scrubber.scrub_repo("fexplorer", apply=True)

        self.assertTrue((repo / "App.tsx").is_file())
        self.assertTrue((repo / "components" / "Pane.tsx").is_file())
        self.assertTrue((repo / "src-tauri" / "main.rs").is_file())
        self.assertFalse((repo / "src").exists())
        self.assertFalse((repo / "src-tauri" / "src").exists())
        self.assertFalse((repo / "screenshots").exists())

    def test_vscode_hoists_extensions_and_src_vs(self) -> None:
        repo = self.reference_root / "vscode"
        (repo / "extensions" / "json").mkdir(parents=True)
        (repo / "src" / "vs" / "workbench").mkdir(parents=True)
        (repo / "cli" / "src" / "bin").mkdir(parents=True)
        (repo / "extensions" / "json" / "package.json").write_text("{\"name\":\"json\"}\n", encoding="utf-8")
        (repo / "src" / "vs" / "workbench" / "main.ts").write_text("export const main = true;\n", encoding="utf-8")
        (repo / "cli" / "Cargo.toml").write_text("[package]\nname='code-cli'\n", encoding="utf-8")
        (repo / "cli" / "src" / "bin" / "code.rs").write_text("fn main() {}\n", encoding="utf-8")

        self.scrubber.scrub_repo("vscode", apply=True)

        self.assertTrue((repo / "json" / "package.json").is_file())
        self.assertTrue((repo / "vs" / "workbench" / "main.ts").is_file())
        self.assertTrue((repo / "cli" / "bin" / "code.rs").is_file())
        self.assertFalse((repo / "extensions").exists())
        self.assertFalse((repo / "src").exists())
        self.assertFalse((repo / "cli" / "src").exists())

    def test_zed_hoists_crates(self) -> None:
        repo = self.reference_root / "zed"
        (repo / "crates" / "editor" / "src").mkdir(parents=True)
        (repo / "tooling" / "xtask" / "lib").mkdir(parents=True)
        (repo / "crates" / "editor" / "Cargo.toml").write_text("[package]\nname='editor'\n", encoding="utf-8")
        (repo / "crates" / "editor" / "src" / "lib.rs").write_text("pub fn editor() {}\n", encoding="utf-8")
        (repo / "tooling" / "xtask" / "lib" / "task.rs").write_text("pub fn task() {}\n", encoding="utf-8")

        self.scrubber.scrub_repo("zed", apply=True)

        self.assertTrue((repo / "editor" / "lib.rs").is_file())
        self.assertTrue((repo / "xtask" / "task.rs").is_file())
        self.assertFalse((repo / "crates").exists())
        self.assertFalse((repo / "tooling").exists())

    def test_collision_renaming_is_deterministic(self) -> None:
        repo = self.reference_root / "collision"
        (repo / "apps" / "common").mkdir(parents=True)
        (repo / "src" / "common").mkdir(parents=True)
        (repo / "apps" / "common" / "app.ts").write_text("export const app = 1;\n", encoding="utf-8")
        (repo / "src" / "common" / "ui.ts").write_text("export const ui = 1;\n", encoding="utf-8")

        self.scrubber.scrub_repo("collision", apply=True)

        self.assertTrue((repo / "common" / "ui.ts").is_file())
        self.assertTrue((repo / "apps__common" / "app.ts").is_file())

    def test_repomap_is_generated_and_excluded_on_repeat_runs(self) -> None:
        repo = self._make_files_main_fixture()
        self.scrubber.scrub_repo("files-main", apply=True)
        first_repomap = (repo / "repomap.md").read_text(encoding="utf-8")
        self.assertNotIn("repomap.md", first_repomap)
        self.scrubber.scrub_repo("files-main", apply=True)
        second_repomap = (repo / "repomap.md").read_text(encoding="utf-8")
        self.assertEqual(first_repomap, second_repomap)
        self.assertNotIn("repomap.md", second_repomap)

    def test_repeated_runs_are_idempotent(self) -> None:
        repo = self.reference_root / "sigma"
        (repo / "src" / "components").mkdir(parents=True)
        (repo / "packages" / "api").mkdir(parents=True)
        (repo / "src-tauri" / "src").mkdir(parents=True)
        (repo / "src" / "components" / "Explorer.tsx").write_text("export const Explorer = () => null;\n", encoding="utf-8")
        (repo / "packages" / "api" / "index.ts").write_text("export const api = true;\n", encoding="utf-8")
        (repo / "src-tauri" / "src" / "main.rs").write_text("fn main() {}\n", encoding="utf-8")

        self.scrubber.scrub_repo("sigma", apply=True)
        first_snapshot = self.snapshot_tree(repo)
        self.scrubber.scrub_repo("sigma", apply=True)
        second_snapshot = self.snapshot_tree(repo)
        self.assertEqual(first_snapshot, second_snapshot)

    def _make_files_main_fixture(self) -> Path:
        repo = self.reference_root / "files-main"
        (repo / "src" / "Files.App").mkdir(parents=True)
        (repo / "src" / "Files.Shared").mkdir(parents=True)
        (repo / "tests" / "Files.App.UITests").mkdir(parents=True)
        (repo / "Files.slnx").write_text("Solution\n", encoding="utf-8")
        (repo / "src" / "Files.App" / "Program.cs").write_text("class Program {}\n", encoding="utf-8")
        (repo / "src" / "Files.Shared" / "Shared.cs").write_text("class Shared {}\n", encoding="utf-8")
        (repo / "tests" / "Files.App.UITests" / "UiTests.cs").write_text("class UiTests {}\n", encoding="utf-8")
        return repo

    def snapshot_tree(self, root: Path) -> dict[str, str]:
        snapshot: dict[str, str] = {}
        for file_path in sorted(root.rglob("*")):
            relative = file_path.relative_to(root).as_posix()
            if file_path.is_dir():
                snapshot[f"dir:{relative}"] = ""
                continue
            snapshot[f"file:{relative}"] = file_path.read_text(encoding="utf-8", errors="replace")
        return snapshot


if __name__ == "__main__":
    unittest.main()
