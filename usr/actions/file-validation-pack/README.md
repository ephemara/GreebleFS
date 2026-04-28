# File Validation Pack

This pack provides edge case testing actions for file operations in GreebleFS.

## Actions

### 1. Check Large Files
- **Context:** Entry
- **Purpose:** Identifies files over 100MB and reports their sizes
- **Runner:** Shell
- **Output:** Task Center

Scans the current directory recursively to find large files that might cause performance issues.

### 2. Validate Special Characters
- **Context:** Entry, Multi-select
- **Purpose:** Checks if selected files have special characters in names that might cause issues
- **Runner:** Python
- **Output:** Task Center

Detects problematic characters in filenames including spaces, quotes, brackets, and unicode characters.

### 3. Permission Audit
- **Context:** Entry, Multi-select
- **Purpose:** Reports detailed permission info for selected entries
- **Runner:** Shell
- **Output:** Task Center

Shows comprehensive permission details including owner, group, mode, and ACLs if available.

### 4. Symlink Inspector
- **Context:** Entry
- **Purpose:** Detects and reports symlinks and their targets
- **Runner:** Shell
- **Output:** Task Center

Identifies symbolic links and shows their target paths, including broken links.

## Usage

1. Open Settings → Context Menus
2. Hit `Refresh Actions`
3. Add these actions from the Action Browser to your desired menu contexts
4. Right-click files or folders to run validation checks

All actions are read-only and safe to run on any filesystem.
