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


def inspect_line_endings(file_path: Path) -> dict[str, Any]:
    """Inspect line endings in a file."""
    if not file_path.is_file():
        return {"error": "Not a file"}
    
    try:
        with open(file_path, 'rb') as f:
            content = f.read()
        
        if not content:
            return {
                "empty": True,
                "line_count": 0,
                "crlf_count": 0,
                "lf_count": 0,
                "cr_count": 0
            }
        
        # Count different line ending types
        crlf_count = content.count(b'\r\n')
        lf_only_count = content.count(b'\n') - crlf_count
        cr_only_count = content.count(b'\r') - crlf_count
        
        total_lines = crlf_count + lf_only_count + cr_only_count
        
        # Determine dominant type
        dominant = "None"
        if crlf_count > lf_only_count and crlf_count > cr_only_count:
            dominant = "CRLF (Windows)"
        elif lf_only_count > crlf_count and lf_only_count > cr_only_count:
            dominant = "LF (Unix/Linux/macOS)"
        elif cr_only_count > 0:
            dominant = "CR (Classic Mac)"
        
        # Check for mixed line endings
        types_present = sum([crlf_count > 0, lf_only_count > 0, cr_only_count > 0])
        has_mixed = types_present > 1
        
        return {
            "empty": False,
            "line_count": total_lines,
            "crlf_count": crlf_count,
            "lf_count": lf_only_count,
            "cr_count": cr_only_count,
            "dominant": dominant,
            "has_mixed": has_mixed,
            "file_size": len(content)
        }
    
    except Exception as e:
        return {"error": str(e)}


def get_recommendation(result: dict[str, Any]) -> str:
    """Get recommendation based on line ending analysis."""
    if result.get("empty"):
        return "Empty file"
    
    if result.get("error"):
        return f"Error: {result['error']}"
    
    if result["line_count"] == 0:
        return "No line breaks detected"
    
    if result["has_mixed"]:
        return "⚠️  Mixed line endings - normalize for consistency"
    
    dominant = result["dominant"]
    if dominant == "CRLF (Windows)":
        return "✓ Consistent CRLF (Windows style)"
    elif dominant == "LF (Unix/Linux/macOS)":
        return "✓ Consistent LF (Unix style) - recommended for cross-platform"
    elif dominant == "CR (Classic Mac)":
        return "⚠️  Classic Mac CR - consider converting to LF"
    
    return "Unknown pattern"


def main() -> None:
    payload = read_action_payload()
    invocation = payload.get("invocation") if isinstance(payload, dict) else {}
    if not isinstance(invocation, dict):
        invocation = {}

    selected_entries = invocation.get("selectedEntries")
    if not isinstance(selected_entries, list):
        selected_entries = []

    print("Platform Compatibility: Line Ending Inspector")
    print("=" * 60)
    print()

    if not selected_entries:
        print("No files selected.")
        return

    text_extensions = {
        '.txt', '.md', '.json', '.xml', '.html', '.css', '.js', '.ts',
        '.py', '.java', '.c', '.cpp', '.h', '.rs', '.go', '.sh', '.bash',
        '.yml', '.yaml', '.toml', '.ini', '.cfg', '.conf', '.log',
        '.csv', '.sql', '.r', '.rb', '.php', '.pl', '.lua', '.vim',
        '.jsx', '.tsx', '.vue', '.svelte', '.astro'
    }

    total_mixed = 0

    for index, entry in enumerate(selected_entries, start=1):
        if not isinstance(entry, dict):
            continue
        
        name = entry.get("name", "<unnamed>")
        path_str = entry.get("path", "")
        is_directory = bool(entry.get("isDirectory"))
        
        if is_directory:
            continue
        
        file_path = Path(path_str)
        extension = file_path.suffix.lower()
        
        # Only analyze text files
        if extension not in text_extensions:
            print(f"{index}. {name}")
            print(f"   Skipped: binary or non-text file")
            print()
            continue
        
        result = inspect_line_endings(file_path)
        
        print(f"{index}. {name}")
        print(f"   Path: {path_str}")
        
        if result.get("error"):
            print(f"   Error: {result['error']}")
        elif result.get("empty"):
            print(f"   Empty file")
        else:
            print(f"   Total lines: {result['line_count']}")
            print(f"   CRLF (\\r\\n): {result['crlf_count']}")
            print(f"   LF (\\n): {result['lf_count']}")
            print(f"   CR (\\r): {result['cr_count']}")
            print(f"   Dominant: {result['dominant']}")
            
            if result['has_mixed']:
                total_mixed += 1
            
            print(f"   {get_recommendation(result)}")
        
        print()

    print("=" * 60)
    if total_mixed > 0:
        print(f"⚠️  Found {total_mixed} file(s) with mixed line endings")
    else:
        print("✓ All files have consistent line endings")


if __name__ == "__main__":
    main()
