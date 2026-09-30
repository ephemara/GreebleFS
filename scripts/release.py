#!/usr/bin/env python3
"""scripts/release.py — Automated GitHub Release Script for GreebleFS.

Modeled on TurboKain's scripts/release.py. Fast path: reuses the existing
NSIS bundle, stages a portable zip, commits build-relevant source, tags,
and publishes via `gh`.

Usage:
    python scripts/release.py [options]

Options:
    --version TAG       Release tag (default: v0.1.0)
    --title TITLE       Release title (default: "GreebleFS <tag> — First Light")
    --notes-file PATH   Markdown release notes (default: built-in notes)
    --build             Run the full release build first
                        (needs GREEBLEFS_KAIN_SOURCE_ROOT, GREEBLEFS_KAIN_EXE,
                        PYO3_PYTHON in env; takes 30-60 min cold)
    --draft             Create as draft release
    --prerelease        Mark as pre-release
    --skip-commit       Skip git commit/tag/push (publish binaries only)

Auth: GH_TOKEN / GITHUB_TOKEN env, else `git credential fill`
(GitHub Desktop's credential-helper token — same trick as TurboKain).

DANGER NOTES (learned 2026-09-29, do not regress):
  - NEVER modify PATH in the build shell: D:/tools/kain/kain.exe fails to
    start if PATH differs from login state (api-ms-win-crt loader error).
    makensis is found via the bundler's self-downloaded NSIS, not PATH.
  - Release needs PYO3_PYTHON pointed at Python 3.12 (pyo3-ffi 0.21 caps 3.12).
  - Kain stage needs GREEBLEFS_KAIN_SOURCE_ROOT=D:/kain and
    GREEBLEFS_KAIN_EXE=D:/tools/kain/kain.exe.
"""

import argparse
import hashlib
import os
import shutil
import subprocess
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NSIS_DIR = ROOT / "target" / "release" / "bundle" / "nsis"

# Source files that make a release reproducible. Derived artifacts
# (toolchains/kain/payload-runtime, public/icons sync output, dist/,
# src/generated) are intentionally excluded.
RELEASE_TRACKED = [
    "Cargo.toml",
    "package.json",
    "bun.lock",
    "src-tauri/tauri.conf.json",
    "src-tauri/Cargo.toml",
    "src-tauri/windows/greeblefs-installer.nsi",
    "src-tauri/icons/",
    # v0.2.2: usr-root honor lane — custom install root for ALL data lanes.
    "src-tauri/src/usr.rs",
    "src-tauri/src/lib.rs",
    "src-tauri/src/archive_ops.rs",
    "src-tauri/src/cloud_commands.rs",
    "src-tauri/src/global_search/query.rs",
    "src-tauri/src/global_search/scan.rs",
    "src-tauri/src/lan_share/push.rs",
    "src-tauri/src/telemetry.rs",
    "src-tauri/src/entry_size_cache.rs",
    "src-tauri/src/explorer_identity.rs",
    "src-tauri/src/explorer_pro_commands.rs",
    "src-tauri/src/image_cutout_commands.rs",
    "src-tauri/src/indexing/mod.rs",
    "src-tauri/src/python_commands.rs",
    "src-tauri/src/remote_storage_commands.rs",
    "src-tauri/src/runtime_pipeline/cache.rs",
    "src-tauri/src/runtime_pipeline/commands.rs",
    "src-tauri/src/screenshot_commands.rs",
    "src-tauri/src/semantic_search.rs",
    "src-tauri/src/thumbnail_commands.rs",
    "src-tauri/src/video_engine.rs",
    "src/config/appContentDirectories.ts",
    "src/runtime/ipc/artifacts.ts",
    "src/runtime/useFolderPluginRuntime.ts",
    "tauron/packages/api/",
    "tauron/crates/tauri-plugin/src/build/",
    "scripts/release.py",
]


def resolve_node() -> str:
    """Absolute node path: background shells often lack node on PATH."""
    found = shutil.which("node")
    if found:
        return found
    for cand in (
        r"C:\Program Files\nodejs\node.exe",
        r"C:\Program Files (x86)\nodejs\node.exe",
    ):
        if Path(cand).exists():
            return cand
    return "node"


def run_cmd(cmd, env=None, check=True, capture=True):
    print(f"--> {' '.join(cmd) if isinstance(cmd, list) else cmd}")
    res = subprocess.run(cmd, cwd=ROOT, env=env,
                         shell=isinstance(cmd, str),
                         capture_output=capture, text=True)
    if check and res.returncode != 0:
        print(f"FAILED (exit {res.returncode}):")
        if res.stdout:
            print(res.stdout[-4000:])
        if res.stderr:
            print(res.stderr[-4000:])
        sys.exit(res.returncode)
    return res


def get_gh_token():
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if token:
        return token
    try:
        proc = subprocess.run(
            ["git", "credential", "fill"],
            input="protocol=https\nhost=github.com\n",
            capture_output=True, text=True, check=True, cwd=ROOT,
        )
        for line in proc.stdout.splitlines():
            if line.startswith("password="):
                return line.split("=", 1)[1].strip()
    except Exception as e:
        print(f"Warning: could not retrieve credential helper token: {e}")
    return None


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def installer_for_version(tag: str) -> Path:
    ver = tag.lstrip("v")
    cand = NSIS_DIR / f"GreebleFS_{ver}_x64-setup.exe"
    if cand.exists():
        return cand
    exes = sorted(NSIS_DIR.glob("GreebleFS_*-setup.exe"))
    if exes:
        return exes[0]
    sys.exit(f"ERROR: no NSIS installer in {NSIS_DIR} (run with --build first).")


def main():
    parser = argparse.ArgumentParser(description="GreebleFS automated release packager")
    parser.add_argument("--version", default="v0.1.0")
    parser.add_argument("--title")
    parser.add_argument("--notes-file")
    parser.add_argument("--build", action="store_true")
    parser.add_argument("--draft", action="store_true")
    parser.add_argument("--prerelease", action="store_true")
    parser.add_argument("--skip-commit", action="store_true")
    args = parser.parse_args()

    tag = args.version
    title = args.title or f"GreebleFS {tag} — First Light"
    print("=" * 72)
    print(f" GreebleFS Automated Release Pipeline -> {tag}")
    print(f" Title: {title}")
    print("=" * 72)

    gh_token = get_gh_token()
    if not gh_token:
        sys.exit("ERROR: No GH_TOKEN found and git credential helper gave nothing.")
    env = os.environ.copy()
    env["GH_TOKEN"] = gh_token

    if args.build:
        print("\n[Step 1/5] Full release build (30-60 min cold)...")
        build_env = os.environ.copy()
        for key in ("GREEBLEFS_KAIN_SOURCE_ROOT", "GREEBLEFS_KAIN_EXE", "PYO3_PYTHON"):
            if not build_env.get(key):
                sys.exit(f"ERROR: {key} must be set for --build.")
        run_cmd([resolve_node(), "scripts/run-platform-tauri.mjs", "build",
                 "--bundles", "nsis", "--ci"], env=build_env, capture=False)
    else:
        print("\n[Step 1/5] Skipping build (--build not given).")

    print("\n[Step 2/5] Staging artifacts...")
    installer = installer_for_version(tag)
    print(f"  installer: {installer.name} ({installer.stat().st_size / 1e6:.1f} MB)")
    stage_dir = ROOT / "_tmp" / f"greeblefs-{tag}"
    if stage_dir.exists():
        shutil.rmtree(stage_dir)
    (stage_dir / "portable").mkdir(parents=True)

    # Portable zip: main exe + USN daemon + readme
    portable_files = []
    for name in ("greeblefs.exe", "greeblefs-usn-daemon.exe"):
        src = ROOT / "target" / "release" / name
        if src.exists():
            shutil.copy2(src, stage_dir / "portable" / name)
            portable_files.append(name)
    # Portable install profile: keeps the whole workspace (usr content +
    # caches) beside the exe instead of leaking into AppData. The backend
    # resolves relative profile paths against the executable directory.
    (stage_dir / "portable" / "greeblefs-install-profile.toml").write_text(
        "schemaVersion = 1\ninstallRoot = '.'\n"
        "managedContentRoot = './usr'\n",
        encoding="utf-8",
    )
    if (ROOT / "README.md").exists():
        shutil.copy2(ROOT / "README.md", stage_dir / "portable" / "README.md")
    zip_name = f"greeblefs-{tag}-windows-x64-portable.zip"
    zip_path = ROOT / zip_name
    if zip_path.exists():
        zip_path.unlink()
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in sorted((stage_dir / "portable").rglob("*")):
            if f.is_file():
                zf.write(f, f.relative_to(stage_dir / "portable"))
    print(f"  portable: {zip_name}")

    print("\n[Step 3/5] SHA-256 sums...")
    artifacts = {"installer": installer, "portable": zip_path}
    sums = {k: sha256_file(p) for k, p in artifacts.items()}
    for k, h in sums.items():
        print(f"  {k}: {h}")
    sums_path = ROOT / "SHA256SUMS.txt"
    with open(sums_path, "w") as f:
        for k, p in artifacts.items():
            f.write(f"{sums[k]}  {p.name}\n")

    if not args.skip_commit:
        print("\n[Step 4/5] Commit + tag + push...")
        # -f: repo .gitignore broadly ignores `packages/` and `Build/`, which
        # also matches the Tauron guest API + restored plugin build dir.
        # (Deslopp: narrow those patterns instead of force-adding.)
        run_cmd(["git", "add", "-f", *RELEASE_TRACKED])
        diff_res = subprocess.run(["git", "diff", "--staged", "--quiet"], cwd=ROOT)
        if diff_res.returncode != 0:
            run_cmd(["git", "commit", "-m", f"release: {tag} — {title}"], env=env)
        else:
            print("  (nothing new to commit)")
        branch = run_cmd(["git", "branch", "--show-current"],
                         env=env).stdout.strip() or "master"
        run_cmd(["git", "push", "origin", branch], env=env)
        run_cmd(f"git tag -f {tag}", env=env)
        run_cmd(f"git push -f origin {tag}", env=env)
    else:
        print("\n[Step 4/5] Skipping commit (--skip-commit).")

    print("\n[Step 5/5] Publishing via gh...")
    if args.notes_file:
        notes_path = Path(args.notes_file)
    else:
        built = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        notes_path = ROOT / "_tmp" / "RELEASE_NOTES.md"
        notes_path.parent.mkdir(parents=True, exist_ok=True)
        notes_path.write_text(f"""# {title} 🟢

First public binary. New procedural icon (lime split-pane folder, zero AI vibes),
full explorer / terminal / plugin workbench, bundled Kain payload + USN indexer
service + LAN mobile bundle.

Built {built} from a fresh-clone-verified pipeline
(`bun run build` + NSIS via `scripts/release.py`).

## Install
1. Run `{installer.name}` (per-machine NSIS, Start Menu + Desktop shortcuts).
2. The installer registers the `GreebleFSUsnIndexer` service for fast NTFS indexing.

## What's fixed (v0.2.3)
- Empty-root hardening: some installs wrote `managedContentRoot = ''` into
  `greeblefs-install-profile.toml` (page-skip edge), and the backend read
  that as "no choice" → AppData. Two fixes: the installer now falls back
  to `$INSTDIR\\usr` instead of writing empty, and the backend treats an
  installed-but-rootless profile as "workspace beside the exe" (created +
  bootstrapped automatically) instead of AppData. Existing broken installs
  heal on next app start — no reinstall needed.

## What's fixed (v0.2.2)
- Custom usr-root installs are honored end to end: every backend data lane
  (cloud tokens, thumbnails, models, screenshots, caches, indexes, ...) and
  every frontend lane (notes, screenshots, IPC artifacts, plugin storage)
  now roots at the installer-chosen directory (e.g. T:/...) instead of
  leaking back into AppData. Stock installs behave exactly as before.
- Portable zip ships an install profile so it stays beside the exe too.
- Perf honesty: the app crate still ships opt-0/single-CGU (opt1/2/3 all
  LLVM-OOM at ~6 GB free — re-verified this release). All dependency crates
  ship fully optimized, which is where the hot code lives. Full app-opt
  follows the great crate split.

## Heads-up (honest notes)
- Unsigned build — Windows SmartScreen will ask; expected.
- Native GPU / shared-buffer lanes run in invoke-compatibility mode.

## SHA-256
```text
{sums['installer']}  {installer.name}
{sums['portable']}  {zip_name}
```
""", encoding="utf-8")

    check_rel = subprocess.run(["gh", "release", "view", tag],
                               env=env, capture_output=True, cwd=ROOT)
    if check_rel.returncode == 0:
        print(f"  release {tag} exists, deleting first...")
        run_cmd(["gh", "release", "delete", tag, "--yes"], env=env)

    gh_cmd = ["gh", "release", "create", tag, str(installer), str(zip_path),
              str(sums_path), "--title", title, "--notes-file", str(notes_path)]
    if args.draft:
        gh_cmd.append("--draft")
    if args.prerelease:
        gh_cmd.append("--prerelease")
    run_cmd(gh_cmd, env=env)
    print(f"\nSUCCESS: Published {tag} to GitHub!")


if __name__ == "__main__":
    main()
