from __future__ import annotations

import json
import os
import subprocess
import zipfile
from pathlib import Path
from typing import Any


def read_action_payload() -> dict[str, Any]:
    context_file = os.environ.get("GREEBLEFS_ACTION_CONTEXT_FILE", "").strip()
    if not context_file:
        return {}

    payload_path = Path(context_file)
    if not payload_path.is_file():
        return {}

    try:
        return json.loads(payload_path.read_text(encoding="utf-8"))
    except Exception as error:
        return {"payloadReadError": str(error), "contextFile": str(payload_path)}


ARCHIVE_EXTENSIONS = {
    ".zip",
    ".tar",
    ".gz",
    ".tgz",
    ".bz2",
    ".tbz2",
    ".7z",
    ".rar",
    ".xz",
    ".lz",
    ".lzma",
    ".z",
}


def is_archive_filename(filename: str) -> bool:
    """Check if a filename appears to be an archive."""
    filename_lower = filename.lower()

    # Check for compound extensions like .tar.gz
    if ".tar." in filename_lower:
        return True

    # Check for standard extensions
    for ext in ARCHIVE_EXTENSIONS:
        if filename_lower.endswith(ext):
            return True

    return False


def get_zip_listing(archive_path: Path) -> list[str]:
    """Get file listing from ZIP archive."""
    try:
        with zipfile.ZipFile(archive_path, "r") as zf:
            return [info.filename for info in zf.infolist()]
    except Exception:
        return []


def get_tar_listing(archive_path: Path) -> list[str]:
    """Get file listing from TAR archive."""
    try:
        result = subprocess.run(
            ["tar", "-tf", str(archive_path)],
            capture_output=True,
            text=True,
            check=True,
        )
        return [line.strip() for line in result.stdout.splitlines() if line.strip()]
    except Exception:
        return []


def get_7z_listing(archive_path: Path) -> list[str]:
    """Get file listing from 7Z archive."""
    try:
        result = subprocess.run(
            ["7z", "l", "-ba", str(archive_path)],
            capture_output=True,
            text=True,
            check=True,
        )

        files = []
        for line in result.stdout.splitlines():
            parts = line.split()
            if len(parts) >= 6:
                # Last part is typically the filename
                filename = " ".join(parts[5:])
                files.append(filename)

        return files
    except Exception:
        return []


def get_rar_listing(archive_path: Path) -> list[str]:
    """Get file listing from RAR archive."""
    try:
        result = subprocess.run(
            ["unrar", "lb", str(archive_path)],
            capture_output=True,
            text=True,
            check=True,
        )
        return [line.strip() for line in result.stdout.splitlines() if line.strip()]
    except Exception:
        return []


def get_archive_listing(archive_path: Path) -> list[str]:
    """Get file listing from archive based on type."""
    extension = archive_path.suffix.lower()
    name = archive_path.name.lower()

    if extension == ".zip":
        return get_zip_listing(archive_path)
    elif extension in [".tar", ".gz", ".tgz", ".bz2", ".tbz2"] or ".tar." in name:
        return get_tar_listing(archive_path)
    elif extension == ".7z":
        return get_7z_listing(archive_path)
    elif extension == ".rar":
        return get_rar_listing(archive_path)

    return []


def detect_nested_archives(archive_path: Path) -> dict[str, Any]:
    """Detect nested archives within an archive."""
    listing = get_archive_listing(archive_path)

    if not listing:
        return {
            "error": "Unable to read archive contents",
            "nested_archives": [],
        }

    nested_archives = []
    for filename in listing:
        # Extract just the filename from path
        basename = Path(filename).name

        if is_archive_filename(basename):
            nested_archives.append(filename)

    return {
        "total_files": len(listing),
        "nested_archives": nested_archives,
        "nested_count": len(nested_archives),
    }


def main() -> None:
    payload = read_action_payload()
    invocation = payload.get("invocation") if isinstance(payload, dict) else {}
    if not isinstance(invocation, dict):
        invocation = {}

    primary_path = os.environ.get("GREEBLEFS_PRIMARY_PATH", "").strip()

    if not primary_path:
        print("Error: No archive file specified")
        return

    archive_path = Path(primary_path)

    if not archive_path.is_file():
        print(f"Error: File not found: {archive_path}")
        return

    print("Nested Archive Detector")
    print("=" * 60)
    print(f"Archive: {archive_path.name}")
    print(f"Path: {archive_path}")
    print()

    result = detect_nested_archives(archive_path)

    if "error" in result:
        print(f"Error: {result['error']}")
        return

    print(f"Total files in archive: {result['total_files']}")
    print(f"Nested archives found: {result['nested_count']}")
    print()

    if result["nested_count"] > 0:
        print("Nested archives:")
        print("-" * 60)
        for nested in result["nested_archives"]:
            # Determine archive type from extension
            nested_lower = nested.lower()
            if ".tar." in nested_lower:
                archive_type = "TAR (compressed)"
            else:
                ext = Path(nested).suffix.lower()
                type_map = {
                    ".zip": "ZIP",
                    ".tar": "TAR",
                    ".gz": "GZIP",
                    ".tgz": "TAR.GZ",
                    ".bz2": "BZIP2",
                    ".tbz2": "TAR.BZ2",
                    ".7z": "7Z",
                    ".rar": "RAR",
                    ".xz": "XZ",
                    ".lz": "LZ",
                    ".lzma": "LZMA",
                }
                archive_type = type_map.get(ext, "Archive")

            print(f"  [{archive_type}] {nested}")
    else:
        print("No nested archives detected.")
        print()
        print("This archive contains only regular files and directories.")


if __name__ == "__main__":
    main()
