# Batch Operations Pack

This pack provides edge case testing for batch file operations in GreebleFS.

## Actions

### 1. Dry-Run Rename
Simulates batch rename operations without actually renaming files. Useful for previewing rename patterns before applying them.

- **Context**: Multi-select (minimum 2 files)
- **Output**: Task center
- **Icon**: FileEdit

### 2. Count by Extension
Groups selected files by extension and displays counts. Helps understand file type distribution in selections.

- **Context**: Multi-select
- **Output**: Task center
- **Icon**: FileType

### 3. Detect Duplicates
Finds duplicate files by comparing checksums (MD5 and SHA256). Identifies identical files even with different names.

- **Context**: Multi-select (minimum 2 files)
- **Output**: Task center
- **Icon**: FileCopy

### 4. Stress Test Selection
Tests handling of very large selections by reporting statistics. Validates performance with high file counts.

- **Context**: Multi-select (minimum 10 files)
- **Output**: Task center
- **Icon**: Activity

## Usage

1. Open Settings → Context Menus
2. Click "Refresh Actions"
3. Add desired actions from the Action Browser
4. Select multiple files and right-click to test

All actions are read-only and safe to run on any file selection.
