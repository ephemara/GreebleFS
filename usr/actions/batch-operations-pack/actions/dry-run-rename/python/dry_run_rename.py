from __future__ import annotations

import json
import os
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


def simulate_rename(entries: list[dict[str, Any]], pattern: str = "file_{index:03d}") -> list[dict[str, str]]:
    """Simulate batch rename without actually renaming files."""
    results = []
    
    for index, entry in enumerate(entries, start=1):
        if not isinstance(entry, dict):
            continue
            
        original_name = entry.get("name", "")
        original_path = entry.get("path", "")
        is_directory = bool(entry.get("isDirectory"))
        
        # Extract extension for files
        extension = ""
        if not is_directory and "." in original_name:
            extension = original_name.rsplit(".", 1)[1]
        
        # Generate new name based on pattern
        new_name = pattern.format(index=index)
        if extension:
            new_name = f"{new_name}.{extension}"
        
        # Simulate new path
        parent_dir = str(Path(original_path).parent)
        new_path = str(Path(parent_dir) / new_name)
        
        results.append({
            "original_name": original_name,
            "original_path": original_path,
            "new_name": new_name,
            "new_path": new_path,
            "type": "directory" if is_directory else "file",
            "collision": False  # Would check for actual collisions in real implementation
        })
    
    return results


def main() -> None:
    payload = read_action_payload()
    invocation = payload.get("invocation") if isinstance(payload, dict) else {}
    if not isinstance(invocation, dict):
        invocation = {}

    selected_entries = invocation.get("selectedEntries")
    if not isinstance(selected_entries, list):
        selected_entries = []

    print("=== Dry-Run Rename ===")
    print(f"Selected items: {len(selected_entries)}")
    print()
    
    if len(selected_entries) < 2:
        print("Error: Minimum 2 items required for batch rename")
        return
    
    # Simulate different rename patterns
    patterns = [
        ("Sequential numbering", "file_{index:03d}"),
        ("Prefix pattern", "renamed_{index}"),
        ("Date-style", "item_{index:04d}"),
    ]
    
    for pattern_name, pattern in patterns:
        print(f"Pattern: {pattern_name} ('{pattern}')")
        print("-" * 60)
        
        results = simulate_rename(selected_entries, pattern)
        
        for result in results:
            print(f"  {result['original_name']} → {result['new_name']}")
            print(f"    Type: {result['type']}")
            print(f"    Original: {result['original_path']}")
            print(f"    New:      {result['new_path']}")
            if result['collision']:
                print(f"    ⚠️  WARNING: Name collision detected!")
            print()
        
        print()
    
    print("✓ Dry-run complete - no files were actually renamed")


if __name__ == "__main__":
    main()
