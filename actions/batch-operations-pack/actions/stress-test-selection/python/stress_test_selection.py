from __future__ import annotations

import json
import os
import time
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


def analyze_selection_stats(entries: list[dict[str, Any]]) -> dict[str, Any]:
    """Analyze statistics for large selections."""
    start_time = time.time()
    
    stats = {
        "total_count": len(entries),
        "file_count": 0,
        "directory_count": 0,
        "total_size": 0,
        "extensions": defaultdict(int),
        "depth_distribution": defaultdict(int),
        "name_lengths": [],
        "path_lengths": [],
    }
    
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        
        name = entry.get("name", "")
        path = entry.get("path", "")
        is_directory = bool(entry.get("isDirectory"))
        
        if is_directory:
            stats["directory_count"] += 1
        else:
            stats["file_count"] += 1
            
            # Extension analysis
            if "." in name:
                extension = name.rsplit(".", 1)[1].lower()
                stats["extensions"][extension] += 1
            else:
                stats["extensions"]["[no extension]"] += 1
        
        # Path depth analysis
        depth = path.count(os.sep)
        stats["depth_distribution"][depth] += 1
        
        # Name and path length analysis
        stats["name_lengths"].append(len(name))
        stats["path_lengths"].append(len(path))
        
        # Try to get file size
        try:
            if not is_directory:
                size = Path(path).stat().st_size
                stats["total_size"] += size
        except:
            pass
    
    stats["processing_time"] = time.time() - start_time
    
    return stats


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

    print("=== Stress Test Selection ===")
    print(f"Processing {len(selected_entries)} items...")
    print()
    
    if len(selected_entries) < 10:
        print("Error: Minimum 10 items required for stress testing")
        return
    
    stats = analyze_selection_stats(selected_entries)
    
    print("Selection Statistics:")
    print("-" * 60)
    print(f"Total items:       {stats['total_count']:,}")
    print(f"Files:             {stats['file_count']:,}")
    print(f"Directories:       {stats['directory_count']:,}")
    print(f"Total size:        {format_size(stats['total_size'])}")
    print(f"Processing time:   {stats['processing_time']:.3f} seconds")
    print()
    
    # Name length statistics
    if stats['name_lengths']:
        name_lengths = stats['name_lengths']
        print("Name Length Statistics:")
        print(f"  Min:     {min(name_lengths)} characters")
        print(f"  Max:     {max(name_lengths)} characters")
        print(f"  Average: {sum(name_lengths) / len(name_lengths):.1f} characters")
        print()
    
    # Path length statistics
    if stats['path_lengths']:
        path_lengths = stats['path_lengths']
        print("Path Length Statistics:")
        print(f"  Min:     {min(path_lengths)} characters")
        print(f"  Max:     {max(path_lengths)} characters")
        print(f"  Average: {sum(path_lengths) / len(path_lengths):.1f} characters")
        print()
    
    # Extension distribution (top 10)
    if stats['extensions']:
        print("Top 10 Extensions:")
        sorted_extensions = sorted(
            stats['extensions'].items(),
            key=lambda x: x[1],
            reverse=True
        )[:10]
        
        for ext, count in sorted_extensions:
            percentage = (count / stats['file_count']) * 100 if stats['file_count'] > 0 else 0
            print(f"  {ext:20s} : {count:5d} ({percentage:5.1f}%)")
        print()
    
    # Depth distribution
    if stats['depth_distribution']:
        print("Directory Depth Distribution:")
        sorted_depths = sorted(stats['depth_distribution'].items())
        for depth, count in sorted_depths:
            print(f"  Depth {depth:2d}: {count:5d} items")
        print()
    
    # Performance assessment
    items_per_second = stats['total_count'] / stats['processing_time'] if stats['processing_time'] > 0 else 0
    print("Performance Assessment:")
    print(f"  Throughput: {items_per_second:,.0f} items/second")
    
    if items_per_second > 10000:
        print("  Status: ✓ Excellent performance")
    elif items_per_second > 1000:
        print("  Status: ✓ Good performance")
    elif items_per_second > 100:
        print("  Status: ⚠ Acceptable performance")
    else:
        print("  Status: ⚠ Performance may need optimization")
    
    print()
    print("✓ Stress test complete")


if __name__ == "__main__":
    main()
