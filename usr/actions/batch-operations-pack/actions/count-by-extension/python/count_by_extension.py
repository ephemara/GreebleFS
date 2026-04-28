from __future__ import annotations

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


def analyze_extensions(entries: list[dict[str, Any]]) -> dict[str, list[str]]:
    """Group files by extension."""
    extension_groups = defaultdict(list)
    
    for entry in entries:
        if not isinstance(entry, dict):
            continue
            
        name = entry.get("name", "")
        is_directory = bool(entry.get("isDirectory"))
        
        if is_directory:
            extension_groups["[directories]"].append(name)
        elif "." in name:
            extension = name.rsplit(".", 1)[1].lower()
            extension_groups[f".{extension}"].append(name)
        else:
            extension_groups["[no extension]"].append(name)
    
    return dict(extension_groups)


def main() -> None:
    payload = read_action_payload()
    invocation = payload.get("invocation") if isinstance(payload, dict) else {}
    if not isinstance(invocation, dict):
        invocation = {}

    selected_entries = invocation.get("selectedEntries")
    if not isinstance(selected_entries, list):
        selected_entries = []

    print("=== Count by Extension ===")
    print(f"Total items: {len(selected_entries)}")
    print()
    
    if not selected_entries:
        print("No items selected")
        return
    
    extension_groups = analyze_extensions(selected_entries)
    
    # Sort by count (descending) then by extension name
    sorted_groups = sorted(
        extension_groups.items(),
        key=lambda x: (-len(x[1]), x[0])
    )
    
    print("Extension Distribution:")
    print("-" * 60)
    
    for extension, files in sorted_groups:
        count = len(files)
        percentage = (count / len(selected_entries)) * 100
        print(f"{extension:20s} : {count:4d} files ({percentage:5.1f}%)")
    
    print()
    print("Detailed Breakdown:")
    print("-" * 60)
    
    for extension, files in sorted_groups:
        print(f"\n{extension} ({len(files)} files):")
        for filename in sorted(files)[:10]:  # Show first 10
            print(f"  - {filename}")
        if len(files) > 10:
            print(f"  ... and {len(files) - 10} more")
    
    print()
    print("✓ Analysis complete")


if __name__ == "__main__":
    main()
