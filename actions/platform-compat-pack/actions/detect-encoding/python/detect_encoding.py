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


def detect_encoding(file_path: Path) -> str:
    """Detect file encoding by attempting to decode with various encodings."""
    if not file_path.is_file():
        return "N/A (not a file)"
    
    try:
        # Try reading a sample of the file
        with open(file_path, 'rb') as f:
            raw_data = f.read(8192)  # Read first 8KB
        
        if not raw_data:
            return "Empty file"
        
        # Check for BOM markers
        if raw_data.startswith(b'\xef\xbb\xbf'):
            return "UTF-8 with BOM"
        if raw_data.startswith(b'\xff\xfe') or raw_data.startswith(b'\xfe\xff'):
            return "UTF-16 with BOM"
        
        # Try UTF-8
        try:
            raw_data.decode('utf-8')
            # Check if it's pure ASCII
            if all(byte < 128 for byte in raw_data):
                return "ASCII"
            return "UTF-8"
        except UnicodeDecodeError:
            pass
        
        # Try Latin-1 (ISO-8859-1)
        try:
            raw_data.decode('latin-1')
            return "Latin-1 (ISO-8859-1)"
        except UnicodeDecodeError:
            pass
        
        # Try Windows-1252
        try:
            raw_data.decode('windows-1252')
            return "Windows-1252"
        except UnicodeDecodeError:
            pass
        
        return "Binary or unknown encoding"
    
    except Exception as e:
        return f"Error: {str(e)}"


def main() -> None:
    payload = read_action_payload()
    invocation = payload.get("invocation") if isinstance(payload, dict) else {}
    if not isinstance(invocation, dict):
        invocation = {}

    selected_entries = invocation.get("selectedEntries")
    if not isinstance(selected_entries, list):
        selected_entries = []

    print("Platform Compatibility: Detect Encoding")
    print("=" * 60)
    print()

    if not selected_entries:
        print("No files selected.")
        return

    text_extensions = {
        '.txt', '.md', '.json', '.xml', '.html', '.css', '.js', '.ts',
        '.py', '.java', '.c', '.cpp', '.h', '.rs', '.go', '.sh', '.bash',
        '.yml', '.yaml', '.toml', '.ini', '.cfg', '.conf', '.log',
        '.csv', '.sql', '.r', '.rb', '.php', '.pl', '.lua', '.vim'
    }

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
        
        # Check if it's a text file
        is_text = extension in text_extensions
        
        encoding = detect_encoding(file_path)
        
        print(f"{index}. {name}")
        print(f"   Path: {path_str}")
        print(f"   Type: {'Text file' if is_text else 'Binary/Other'}")
        print(f"   Encoding: {encoding}")
        print()

    print("=" * 60)
    print("Encoding detection complete.")


if __name__ == "__main__":
    main()
