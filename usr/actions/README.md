# GreebleFS Action Packs

This directory contains action packs for the GreebleFS explorer action system. Each pack provides a collection of related actions that can be added to context menus and invoked on files, folders, and selections.

## Available Packs

### 1. Smoke Test Pack (`smoke-test-pack/`)
**Purpose:** Basic validation and debugging of the action runtime system

**Actions:**
- Inspect Selection - Print invocation payload and selected entries
- Report Current Folder - Echo current folder and environment
- Preview Terminal Ping - Test preview-terminal routing
- Cargo Context Report - Verify Cargo runner path

**Use Case:** Initial testing and validation of the action system

---

### 2. File Validation Pack (`file-validation-pack/`)
**Purpose:** Edge case testing for file operations and filesystem validation

**Actions:**
- Check Large Files - Identify files over 100MB
- Validate Special Characters - Detect problematic filename characters
- Permission Audit - Report detailed permission info
- Symlink Inspector - Detect and report symlinks and targets

**Use Case:** Validating file safety, permissions, and filesystem edge cases

---

### 3. Batch Operations Pack (`batch-operations-pack/`)
**Purpose:** Testing batch operations and multi-file edge cases

**Actions:**
- Dry Run Rename - Simulate batch rename operations
- Count by Extension - Group files by extension with statistics
- Detect Duplicates - Find duplicate files by checksum
- Stress Test Selection - Test handling of large selections (10+ items)

**Use Case:** Testing multi-file operations, duplicate detection, and performance with large selections

---

### 4. Platform Compatibility Pack (`platform-compat-pack/`)
**Purpose:** Cross-platform compatibility and encoding validation

**Actions:**
- Detect Encoding - Identify file encoding (UTF-8, ASCII, etc.)
- Path Separator Audit - Check for mixed path separators
- Line Ending Inspector - Detect line endings (LF, CRLF, CR)
- Platform Report - Report platform info and environment

**Use Case:** Ensuring cross-platform compatibility and detecting encoding issues

---

### 5. Archive Inspector Pack (`archive-inspector-pack/`)
**Purpose:** Archive and compression edge case testing

**Actions:**
- Inspect Archive - List archive contents without extracting
- Compression Ratio - Calculate compression ratios
- Nested Archive Detector - Detect archives within archives
- Archive Integrity Check - Test archive integrity

**Use Case:** Working with compressed files and validating archive integrity

---

## Usage

1. Open **Settings → Context Menus** in GreebleFS
2. Click **Refresh Actions** to discover all action packs
3. Browse the **Action Browser** to see available actions
4. Add actions to your desired menu contexts (entry, multi-select, background, etc.)
5. Right-click files, folders, or empty space to invoke actions

## Action Pack Structure

Each action pack follows this structure:

```
pack-name/
├── action-pack.toml          # Pack metadata
├── README.md                 # Pack documentation
└── actions/                  # Individual actions
    └── action-name/
        ├── action.toml       # Action definition
        └── python/           # Scripts (if needed)
            └── script.py
```

## Safety

All actions in these packs are **read-only** and safe to run. They:
- Do not modify files or directories
- Do not delete or move content
- Only report information to the task center
- Are designed for testing and validation

## Development

When creating new action packs:
- Follow the existing structure
- Use descriptive IDs and names
- Tag actions appropriately
- Document all actions in the pack README
- Test with various file types and edge cases
- Ensure cross-platform compatibility where possible

## Tags Reference

Common tags used across packs:
- `smoke`, `test`, `debug` - Testing and validation
- `validation`, `edge-cases` - Edge case testing
- `batch`, `operations` - Multi-file operations
- `platform`, `compatibility`, `encoding` - Cross-platform concerns
- `archive`, `compression`, `integrity` - Archive operations
- `permissions`, `security` - Security and access control
- `filesystem`, `symlinks` - Filesystem features

---

**Note:** These action packs are designed for the GreebleFS explorer and require the action runtime system to be enabled.
