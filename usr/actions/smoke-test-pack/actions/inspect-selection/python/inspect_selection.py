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


def main() -> None:
    payload = read_action_payload()
    invocation = payload.get("invocation") if isinstance(payload, dict) else {}
    if not isinstance(invocation, dict):
        invocation = {}

    selected_entries = invocation.get("selectedEntries")
    if not isinstance(selected_entries, list):
        selected_entries = []

    print("GreebleFS action smoke test: Inspect Selection")
    print(f"pack: {os.environ.get('GREEBLEFS_ACTION_PACK_ID', '<missing>')}")
    print(f"action: {os.environ.get('GREEBLEFS_ACTION_ID', '<missing>')}")
    print(f"current location: {os.environ.get('GREEBLEFS_CURRENT_LOCATION', '<missing>')}")
    print(f"selected count env: {os.environ.get('GREEBLEFS_SELECTED_COUNT', '<missing>')}")
    print(f"primary path env: {os.environ.get('GREEBLEFS_PRIMARY_PATH', '<missing>')}")
    print(f"context kind: {invocation.get('kind', '<missing>')}")
    print(f"runtime platform: {invocation.get('runtimePlatform', '<missing>')}")
    print(f"input modality: {invocation.get('inputModality', '<missing>')}")
    print()
    print("Selected entries:")

    if not selected_entries:
        print("- <none>")
    else:
        for index, entry in enumerate(selected_entries, start=1):
            if not isinstance(entry, dict):
                print(f"- {index}. <invalid entry>")
                continue
            name = entry.get("name", "<unnamed>")
            path = entry.get("path", "<missing path>")
            is_directory = bool(entry.get("isDirectory"))
            kind = "directory" if is_directory else "file"
            print(f"- {index}. {name} [{kind}]")
            print(f"  path: {path}")

    preview_context = invocation.get("previewContext")
    if isinstance(preview_context, dict):
        print()
        print("Preview context:")
        print(json.dumps(preview_context, indent=2))

    search_result = invocation.get("searchResult")
    if isinstance(search_result, dict):
        print()
        print("Search context:")
        print(json.dumps(search_result, indent=2))


if __name__ == "__main__":
    main()
