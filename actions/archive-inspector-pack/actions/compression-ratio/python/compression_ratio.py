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


def format_size(size_bytes: int) -> str:
    """Format bytes into human-readable size."""
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if size_bytes < 1024.0:
            return f"{size_bytes:.2f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.2f} PB"


def get_zip_info(archive_path: Path) -> tuple[int, int] | None:
    """Get compressed and uncompressed sizes for ZIP archives."""
    try:
        with zipfile.ZipFile(archive_path, "r") as zf:
            compressed_size = sum(info.compress_size for info in zf.infolist())
            uncompressed_size = sum(info.file_size for info in zf.infolist())
            return compressed_size, uncompressed_size
    except Exception:
        return None


def get_tar_info(archive_path: Path) -> tuple[int, int] | None:
    """Get compressed and uncompressed sizes for TAR archives."""
    try:
        # Get compressed size (actual file size)
        compressed_size = archive_path.stat().st_size

        # Get uncompressed size using tar
        result = subprocess.run(
            ["tar", "-tvf", str(archive_path)],
            capture_output=True,
            text=True,
            check=True,
        )

        # Parse tar output to sum file sizes
        uncompressed_size = 0
        for line in result.stdout.splitlines():
            parts = line.split()
            if len(parts) >= 3:
                try:
                    # Size is typically the 3rd field in tar -tvf output
                    uncompressed_size += int(parts[2])
                except (ValueError, IndexError):
                    continue

        return compressed_size, uncompressed_size
    except Exception:
        return None


def get_7z_info(archive_path: Path) -> tuple[int, int] | None:
    """Get compressed and uncompressed sizes for 7Z archives."""
    try:
        result = subprocess.run(
            ["7z", "l", "-slt", str(archive_path)],
            capture_output=True,
            text=True,
            check=True,
        )

        compressed_size = 0
        uncompressed_size = 0

        for line in result.stdout.splitlines():
            if line.startswith("Packed Size = "):
                compressed_size += int(line.split("=")[1].strip())
            elif line.startswith("Size = "):
                uncompressed_size += int(line.split("=")[1].strip())

        return compressed_size, uncompressed_size
    except Exception:
        return None


def get_rar_info(archive_path: Path) -> tuple[int, int] | None:
    """Get compressed and uncompressed sizes for RAR archives."""
    try:
        result = subprocess.run(
            ["unrar", "l", "-v", str(archive_path)],
            capture_output=True,
            text=True,
            check=True,
        )

        # Parse unrar output for sizes
        compressed_size = archive_path.stat().st_size
        uncompressed_size = 0

        for line in result.stdout.splitlines():
            parts = line.split()
            if len(parts) >= 4 and parts[0].isdigit():
                try:
                    uncompressed_size += int(parts[0])
                except ValueError:
                    continue

        return compressed_size, uncompressed_size
    except Exception:
        return None


def analyze_archive(archive_path: Path) -> dict[str, Any]:
    """Analyze a single archive file."""
    extension = archive_path.suffix.lower()
    name = archive_path.name

    # Determine archive type and get info
    info = None
    archive_type = "unknown"

    if extension == ".zip":
        info = get_zip_info(archive_path)
        archive_type = "ZIP"
    elif extension == ".tar":
        info = get_tar_info(archive_path)
        archive_type = "TAR"
    elif extension in [".gz", ".tgz"] or archive_path.name.endswith(".tar.gz"):
        info = get_tar_info(archive_path)
        archive_type = "TAR.GZ"
    elif extension in [".bz2", ".tbz2"] or archive_path.name.endswith(".tar.bz2"):
        info = get_tar_info(archive_path)
        archive_type = "TAR.BZ2"
    elif extension == ".7z":
        info = get_7z_info(archive_path)
        archive_type = "7Z"
    elif extension == ".rar":
        info = get_rar_info(archive_path)
        archive_type = "RAR"

    if info is None:
        return {
            "name": name,
            "type": archive_type,
            "error": "Unable to analyze archive",
        }

    compressed_size, uncompressed_size = info

    if uncompressed_size > 0:
        ratio = (1 - (compressed_size / uncompressed_size)) * 100
    else:
        ratio = 0.0

    return {
        "name": name,
        "type": archive_type,
        "compressed_size": compressed_size,
        "uncompressed_size": uncompressed_size,
        "ratio": ratio,
    }


def main() -> None:
    payload = read_action_payload()
    invocation = payload.get("invocation") if isinstance(payload, dict) else {}
    if not isinstance(invocation, dict):
        invocation = {}

    selected_entries = invocation.get("selectedEntries")
    if not isinstance(selected_entries, list):
        selected_entries = []

    print("Compression Ratio Analysis")
    print("=" * 60)
    print()

    if not selected_entries:
        print("Error: No files selected")
        return

    results = []
    total_compressed = 0
    total_uncompressed = 0

    for entry in selected_entries:
        if not isinstance(entry, dict):
            continue

        path_str = entry.get("path", "")
        if not path_str:
            continue

        archive_path = Path(path_str)
        if not archive_path.is_file():
            continue

        result = analyze_archive(archive_path)
        results.append(result)

        if "error" not in result:
            total_compressed += result["compressed_size"]
            total_uncompressed += result["uncompressed_size"]

    # Print individual results
    for result in results:
        print(f"File: {result['name']}")
        print(f"Type: {result['type']}")

        if "error" in result:
            print(f"Status: {result['error']}")
        else:
            print(f"Compressed:   {format_size(result['compressed_size'])}")
            print(f"Uncompressed: {format_size(result['uncompressed_size'])}")
            print(f"Ratio:        {result['ratio']:.2f}% reduction")

        print()

    # Print summary if multiple files
    if len(results) > 1:
        print("=" * 60)
        print("Summary")
        print("=" * 60)
        print(f"Total files analyzed: {len(results)}")
        print(f"Total compressed:     {format_size(total_compressed)}")
        print(f"Total uncompressed:   {format_size(total_uncompressed)}")

        if total_uncompressed > 0:
            overall_ratio = (1 - (total_compressed / total_uncompressed)) * 100
            print(f"Overall ratio:        {overall_ratio:.2f}% reduction")


if __name__ == "__main__":
    main()
