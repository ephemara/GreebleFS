# Explorer Crate Integration

The explorer crate provides comprehensive file management, search, terminal, and job monitoring capabilities for ULTACODE Desktop.

## Features

### File Management (`commands.rs`)

High-performance file operations with parallel processing:

- **Directory Reading**: Fast directory listing with metadata (size, modified date, MIME type)
- **File Operations**: Read, write, create, delete (with trash support), rename, copy
- **Drive Detection**: Windows drive enumeration (A-Z)
- **Directory Size**: Recursive size calculation
- **File Stats**: Detailed file metadata

### Search (`search.rs`)

Two powerful search modes:

1. **Fuzzy File Search**: Fast filename matching using `nucleo-matcher`
   - Configurable max results and depth
   - Case-sensitive/insensitive options
   - Score-based ranking

2. **Content Search**: Regex-based file content search using `grep-searcher`
   - Line number tracking
   - Context extraction
   - Binary file filtering

### Terminal (`terminal.rs`)

Full PTY terminal implementation:

- **Cross-platform**: PowerShell on Windows, bash/zsh on Unix
- **Real-time I/O**: Streaming output via Tauri events
- **Resize Support**: Dynamic terminal resizing
- **Multiple Instances**: Manage multiple terminals by ID

### Job Management (`jobs.rs`)

Background job tracking system:

- **Job States**: Queued, Running, Paused, Completed, Failed, Cancelled
- **Progress Tracking**: 0-1 progress values
- **Real-time Updates**: Event-driven job status changes
- **Bulk Operations**: Clear completed jobs

## Frontend Hooks

### `useExplorer`

Main file system hook:

```typescript
const {
  currentPath,
  entries,
  loading,
  error,
  readDirectory,
  readFileContent,
  writeFileContent,
  createDirectory,
  deletePath,
  renamePath,
  copyPath,
  getFileStats,
  getDrives,
  getDirectorySize,
  fuzzySearch,
  contentSearch,
} = useExplorer();
```

### `useTerminal`

Terminal management hook:

```typescript
const { output, isActive, spawn, write, resize, kill } = useTerminal('terminal-1');

// Spawn terminal
await spawn({ workingDir: 'C:\\Projects', rows: 24, cols: 80 });

// Write input
await write('ls\n');

// Listen to output
console.log(output);
```

### `useJobManager`

Job tracking hook:

```typescript
const {
  jobs,
  createJob,
  updateJobStatus,
  updateJobProgress,
  removeJob,
  clearCompleted,
} = useJobManager();

// Create job
const job = await createJob('Processing files');

// Update progress
await updateJobProgress(job.id, 0.5);

// Complete job
await updateJobStatus(job.id, JobStatus.Completed);
```

## Components

### `FileExplorerEnhanced`

Full-featured file explorer with:
- Drive selection
- Search filtering
- Context menu (rename, delete, copy path)
- File icons by type
- Size display
- Trash support

### `SearchPanel`

Dedicated search interface:
- Fuzzy filename search
- Content/regex search
- Result highlighting
- Line number display

## Tauri Commands

All commands are registered in `lib.rs`:

```rust
// File operations
read_directory(path: String) -> Vec<FileEntry>
read_file_content(path: String) -> String
write_file_content(path: String, content: String)
create_directory(path: String)
delete_path(path: String, use_trash: bool)
rename_path(old_path: String, new_path: String)
copy_path(source: String, destination: String)
get_file_stats(path: String) -> FileEntry
get_drives() -> Vec<String>
get_directory_size(path: String) -> u64

// Search
fuzzy_search(root_path: String, query: String, ...) -> Vec<SearchResult>
content_search(root_path: String, pattern: String, ...) -> Vec<SearchResult>

// Terminal
terminal_spawn(id: String, working_dir: Option<String>, rows: u16, cols: u16)
terminal_write(id: String, data: String)
terminal_resize(id: String, rows: u16, cols: u16)
terminal_kill(id: String)

// Jobs
job_create(name: String) -> JobItem
job_list() -> Vec<JobItem>
job_get(id: String) -> Option<JobItem>
job_update_status(id: String, status: JobStatus)
job_update_progress(id: String, progress: f32)
job_remove(id: String)
job_clear_completed() -> usize
```

## Performance

- **Parallel Processing**: Uses `rayon` for multi-threaded directory traversal
- **Efficient Search**: `nucleo-matcher` provides fast fuzzy matching
- **Streaming**: Terminal output streams via events (no polling)
- **Smart Caching**: File metadata cached during directory reads

## Dependencies

Already included in `Cargo.toml`:

```toml
rayon = "1.10.0"
humansize = "2.1.3"
mime_guess = "2.0.5"
walkdir = "2.5.0"
trash = "5.2.3"
notify = "8.2.0"
portable-pty = "0.9.0"
grep-searcher = "0.1.16"
nucleo-matcher = "0.3.1"
grep-regex = "0.1.14"
```

## Usage Example

```typescript
import { useExplorer } from '../../hooks/useExplorer';
import { useTerminal } from '../../hooks/useTerminal';
import { useJobManager } from '../../hooks/useJobManager';

function MyComponent() {
  const explorer = useExplorer('C:\\Projects');
  const terminal = useTerminal('main');
  const jobs = useJobManager();

  // Search files
  const results = await explorer.fuzzySearch('C:\\Projects', 'main.rs');

  // Spawn terminal
  await terminal.spawn({ workingDir: 'C:\\Projects' });
  await terminal.write('cargo build\n');

  // Track job
  const job = await jobs.createJob('Building project');
  await jobs.updateJobProgress(job.id, 0.5);
}
```

## Integration Status

✅ Rust backend fully implemented
✅ Tauri commands registered
✅ TypeScript hooks created
✅ Enhanced FileExplorer component
✅ SearchPanel component
✅ All dependencies installed

Ready to use!
