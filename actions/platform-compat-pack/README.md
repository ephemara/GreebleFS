# Platform Compatibility Pack

Cross-platform compatibility testing actions for GreebleFS.

This pack provides read-only diagnostic actions to detect and report platform-specific edge cases around file encoding, path separators, line endings, and environment configuration.

## Actions

### 1. Detect Encoding
**Context:** Entry, Multi-select  
**Icon:** FileType  
Detects file encoding (UTF-8, ASCII, Latin-1, etc.) for text files in your selection.

### 2. Path Separator Audit
**Context:** Entry, Multi-select  
**Icon:** GitBranch  
Checks for mixed path separators (forward slash vs backslash) and reports platform compatibility issues.

### 3. Line Ending Inspector
**Context:** Entry (files only)  
**Icon:** FileText  
Detects line endings (LF, CRLF, CR) in text files and reports consistency.

### 4. Platform Report
**Context:** Background  
**Icon:** Monitor  
Reports current platform info and environment variables relevant to file operations.

## Usage

1. Open Settings → Context Menus
2. Click `Refresh Actions`
3. Add these actions from the Action Browser to your desired menu contexts
4. Right-click files, folders, or background to run diagnostics

All actions are read-only and output results to the task center.

## Use Cases

- Verify file encoding before committing to version control
- Detect mixed line endings that could cause issues
- Audit path separator usage in configuration files
- Check platform environment for debugging file operation issues
- Validate cross-platform compatibility of text files
