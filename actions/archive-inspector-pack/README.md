# Archive Inspector Pack

Read-only actions for inspecting and testing archive files without extraction.

This pack provides four specialized actions for working with compressed archives:

## Actions

### 1. Inspect Archive
Lists the contents of archive files without extracting them. Supports multiple archive formats and provides detailed file listings.

- **Context**: Entry (single file)
- **Applies To**: Files only
- **Runner**: Shell
- **Output**: Task Center

### 2. Compression Ratio
Calculates and reports compression ratios for archive files. Shows original size, compressed size, and compression percentage for both individual files and batch selections.

- **Context**: Entry, Multi-select
- **Applies To**: Files only
- **Runner**: Python
- **Output**: Task Center

### 3. Nested Archive Detector
Detects archives within archives by analyzing file listings. Useful for identifying nested compression and complex archive structures.

- **Context**: Entry (single file)
- **Applies To**: Files only
- **Runner**: Python
- **Output**: Task Center

### 4. Archive Integrity Check
Tests archive integrity without extracting files. Verifies that archives are not corrupted and can be safely extracted.

- **Context**: Entry (single file)
- **Applies To**: Files only
- **Runner**: Shell
- **Output**: Task Center

## Supported Formats

All actions support the following archive formats:

- **ZIP** (.zip)
- **TAR** (.tar)
- **GZIP** (.tar.gz, .tgz)
- **BZIP2** (.tar.bz2, .tbz2)
- **7-Zip** (.7z)
- **RAR** (.rar)

## Usage

1. Open Settings → Context Menus
2. Click "Refresh Actions"
3. Add desired actions from the Action Browser to your preferred contexts
4. Right-click archive files to access the actions

All actions are read-only and safe to use on production archives.
