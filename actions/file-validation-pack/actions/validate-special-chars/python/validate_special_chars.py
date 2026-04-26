from __future__ import annotations

import json
import os
import re
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


def check_special_characters(filename: str) -> list[str]:
    """Check for problematic characters in filename."""
    issues = []
    
    # Check for spaces
    if " " in filename:
        issues.append("contains spaces")
    
    # Check for quotes
    if '"' in filename or "'" in filename:
        issues.append("contains quotes")
    
    # Check for brackets
    if any(char in filename for char in "[]{}()"):
        issues.append("contains brackets")
    
    # Check for special shell characters
    if any(char in filename for char in "&|;<>$`\\!*?"):
        issues.append("contains shell metacharacters")
    
    # Check for non-ASCII characters
    if not filename.isascii():
        issues.append("contains non-ASCII/unicode characters")
    
    # Check for leading/trailing spaces or dots
    if filename != filename.strip():
        issues.append("has leading/trailing whitespace")
    
    if filename.startswith(".") and len(filename) > 1:
        issues.append("hidden file (starts with dot)")
    
    # Check for multiple consecutive spaces
    if "  " in filename:
        issues.append("contains multiple consecutive spaces")
    
    # Check for control characters
    if any(ord(char) < 32 for char in filename):
        issues.append("contains control characters")
    
    return issues


def main() -> None:
    payload = read_action_payload()
    invocation = payload.get("invocation") if isinstance(payload, dict) else {}
    if not isinstance(invocation, dict):
        invocation = {}

    selected_entries = invocation.get("selectedEntries")
    if not isinstance(selected_entries, list):
        selected_entries = []

    print("=== Special Character Validation ===")
    print(f"Checking {len(selected_entries)} selected entries")
    print()

    clean_count = 0
    issue_count = 0

    for index, entry in enumerate(selected_entries, start=1):
        if not isinstance(entry, dict):
            continue
        
        name = entry.get("name", "<unnamed>")
        path = entry.get("path", "<missing path>")
        is_directory = bool(entry.get("isDirectory"))
        kind = "DIR" if is_directory else "FILE"
        
        issues = check_special_characters(name)
        
        if issues:
            issue_count += 1
            print(f"[{kind}] {name}")
            print(f"  Path: {path}")
            print(f"  Issues:")
            for issue in issues:
                print(f"    - {issue}")
            print()
        else:
            clean_count += 1

    print("=" * 40)
    print(f"Summary:")
    print(f"  Clean filenames: {clean_count}")
    print(f"  Files with issues: {issue_count}")
    
    if issue_count == 0:
        print()
        print("✓ All selected files have safe filenames!")


if __name__ == "__main__":
    main()
