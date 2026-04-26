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


def audit_path_separators(file_path: Path) -> dict[str, Any]:
    """Audit a file for path separator usage."""
    if not file_path.is_file():
        return {"error": "Not a file"}
    
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read(65536)  # Read first 64KB
        
        forward_slashes = content.count('/')
        backslashes = content.count('\\')
        
        # Look for path-like patterns
        forward_paths = content.count('/')
        backward_paths = content.count('\\')
        
        has_mixed = forward_slashes > 0 and backslashes > 0
        
        issues = []
        if has_mixed:
            issues.append("Mixed separators detected")
        
        # Check for common problematic patterns
        if '\\\\' in content:
            issues.append("Double backslashes found")
        if '//' in content and 'http://' not in content and 'https://' not in content:
            issues.append("Double forward slashes found")
        
        return {
            "forward_slashes": forward_slashes,
            "backslashes": backslashes,
            "has_mixed": has_mixed,
            "issues": issues,
            "recommendation": get_recommendation(forward_slashes, backslashes, has_mixed)
        }
    
    except Exception as e:
        return {"error": str(e)}


def get_recommendation(forward: int, backward: int, mixed: bool) -> str:
    """Get platform compatibility recommendation."""
    if forward == 0 and backward == 0:
        return "No path separators detected"
    
    if mixed:
        return "⚠️  Mixed separators - may cause cross-platform issues"
    
    if backward > 0 and forward == 0:
        return "⚠️  Windows-style paths only - may not work on Unix/Linux/macOS"
    
    if forward > 0 and backward == 0:
        return "✓ Unix-style paths - cross-platform compatible"
    
    return "Unknown pattern"


def main() -> None:
    payload = read_action_payload()
    invocation = payload.get("invocation") if isinstance(payload, dict) else {}
    if not isinstance(invocation, dict):
        invocation = {}

    selected_entries = invocation.get("selectedEntries")
    if not isinstance(selected_entries, list):
        selected_entries = []

    current_platform = os.name
    separator = os.sep

    print("Platform Compatibility: Path Separator Audit")
    print("=" * 60)
    print(f"Current platform: {current_platform}")
    print(f"Native separator: {repr(separator)}")
    print()

    if not selected_entries:
        print("No files selected.")
        return

    text_extensions = {
        '.txt', '.md', '.json', '.xml', '.html', '.css', '.js', '.ts',
        '.py', '.java', '.c', '.cpp', '.h', '.rs', '.go', '.sh', '.bash',
        '.yml', '.yaml', '.toml', '.ini', '.cfg', '.conf', '.log',
        '.csv', '.sql', '.r', '.rb', '.php', '.pl', '.lua', '.vim',
        '.cmake', '.make', '.dockerfile', '.env'
    }

    total_issues = 0

    for index, entry in enumerate(selected_entries, start=1):
        if not isinstance(entry, dict):
            continue
        
        name = entry.get("name", "<unnamed>")
        path_str = entry.get("path", "")
        is_directory = bool(entry.get("isDirectory"))
        
        if is_directory:
            print(f"{index}. {name} [directory]")
            print(f"   Skipped: directories not analyzed")
            print()
            continue
        
        file_path = Path(path_str)
        extension = file_path.suffix.lower()
        
        # Only analyze text files
        if extension not in text_extensions:
            print(f"{index}. {name}")
            print(f"   Skipped: binary or non-text file")
            print()
            continue
        
        result = audit_path_separators(file_path)
        
        print(f"{index}. {name}")
        print(f"   Path: {path_str}")
        
        if "error" in result:
            print(f"   Error: {result['error']}")
        else:
            print(f"   Forward slashes (/): {result['forward_slashes']}")
            print(f"   Backslashes (\\): {result['backslashes']}")
            
            if result['issues']:
                total_issues += len(result['issues'])
                print(f"   Issues:")
                for issue in result['issues']:
                    print(f"     - {issue}")
            
            print(f"   {result['recommendation']}")
        
        print()

    print("=" * 60)
    if total_issues > 0:
        print(f"⚠️  Found {total_issues} potential compatibility issue(s)")
    else:
        print("✓ No path separator issues detected")


if __name__ == "__main__":
    main()
