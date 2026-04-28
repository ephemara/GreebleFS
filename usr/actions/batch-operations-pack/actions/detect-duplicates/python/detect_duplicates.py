from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from typing import Any
from collections import defaultdict


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


def calculate_checksums(file_path: str) -> dict[str, str] | None:
    """Calculate MD5 and SHA256 checksums for a file."""
    try:
        path = Path(file_path)
        if not path.is_file():
            return None
        
        # Read file in chunks to handle large files
        md5_hash = hashlib.md5()
        sha256_hash = hashlib.sha256()
        
        with open(path, "rb") as f:
            while chunk := f.read(8192):
                md5_hash.update(chunk)
                sha256_hash.update(chunk)
        
        return {
            "md5": md5_hash.hexdigest(),
            "sha256": sha256_hash.hexdigest(),
        }
    except Exception as error:
        return {"error": str(error)}


def find_duplicates(entries: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    """Find duplicate files by checksum."""
    checksum_groups = defaultdict(list)
    
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        
        path = entry.get("path", "")
        name = entry.get("name", "")
        is_directory = bool(entry.get("isDirectory"))
        
        if is_directory:
            continue
        
        checksums = calculate_checksums(path)
        if checksums and "error" not in checksums:
            # Use SHA256 as primary key (more reliable than MD5)
            key = checksums["sha256"]
            checksum_groups[key].append({
                "name": name,
                "path": path,
                "md5": checksums["md5"],
                "sha256": checksums["sha256"],
            })
    
    # Filter to only groups with duplicates
    return {k: v for k, v in checksum_groups.items() if len(v) > 1}


def format_size(size: int) -> str:
    """Format file size in human-readable format."""
    for unit in ["B", "KB", "MB", "GB"]:
        if size < 1024:
            return f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} TB"


def main() -> None:
    payload = read_action_payload()
    invocation = payload.get("invocation") if isinstance(payload, dict) else {}
    if not isinstance(invocation, dict):
        invocation = {}

    selected_entries = invocation.get("selectedEntries")
    if not isinstance(selected_entries, list):
        selected_entries = []

    print("=== Detect Duplicates ===")
    print(f"Scanning {len(selected_entries)} files...")
    print()
    
    if len(selected_entries) < 2:
        print("Error: Minimum 2 files required for duplicate detection")
        return
    
    duplicate_groups = find_duplicates(selected_entries)
    
    if not duplicate_groups:
        print("✓ No duplicates found!")
        print(f"All {len(selected_entries)} files are unique.")
        return
    
    total_duplicates = sum(len(group) for group in duplicate_groups.values())
    
    print(f"Found {len(duplicate_groups)} duplicate groups ({total_duplicates} files)")
    print("-" * 60)
    print()
    
    for group_index, (checksum, files) in enumerate(duplicate_groups.items(), start=1):
        print(f"Duplicate Group {group_index} ({len(files)} files):")
        print(f"  SHA256: {checksum[:16]}...{checksum[-16:]}")
        print(f"  MD5:    {files[0]['md5']}")
        print()
        
        for file_info in files:
            print(f"  - {file_info['name']}")
            print(f"    Path: {file_info['path']}")
            
            # Try to get file size
            try:
                size = Path(file_info['path']).stat().st_size
                print(f"    Size: {format_size(size)}")
            except:
                pass
        
        print()
    
    # Calculate potential space savings
    print("Potential Space Savings:")
    total_wasted = 0
    for files in duplicate_groups.values():
        try:
            # Keep one copy, count others as wasted
            size = Path(files[0]['path']).stat().st_size
            wasted = size * (len(files) - 1)
            total_wasted += wasted
        except:
            pass
    
    if total_wasted > 0:
        print(f"  {format_size(total_wasted)} could be saved by removing duplicates")
    
    print()
    print("✓ Duplicate detection complete")


if __name__ == "__main__":
    main()
