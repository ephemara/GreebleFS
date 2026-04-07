# Yazi / File Explorer Review

Date: 2026-04-06

Scope:
- `src-tauri/src/fs_commands.rs`
- `src-tauri/src/entry_size_cache.rs`
- `src/runtime/explorerBackend.ts`
- `src/components/FileExplorer.tsx`
- Embedded Yazi workspace under `crates/fileexplorer/**`

## Findings

### [P1] Batch transfer can partially mutate disk state, then return a single error without invalidating caches for already-completed items

File: `src-tauri/src/fs_commands.rs:2765`

`fs_transfer_items` applies copy/move operations one by one inside the `for source in sources` loop. If an early item succeeds and a later item fails, the function returns `Err(...)` immediately at `2804-2805`, before the post-loop invalidation block at `2815-2824` runs. That leaves the filesystem partially changed while the caller receives only a single error and no per-item success list. The result is twofold:

1. The frontend cannot tell which earlier items already completed, so retrying the batch can duplicate copies or produce confusing move failures.
2. Explorer/search caches for the already-completed items remain stale until some later refresh/TTL expiry.

This is a correctness bug, not just UX polish, because batch failure currently does not preserve atomicity or accurately report partial success.

### [P2] Entry-size watcher teardown uses a different key than watcher registration, so canonicalized watches can leak forever

File: `src-tauri/src/entry_size_cache.rs:342`

`fs_watch_entry_size_root` resolves the requested path through `resolve_watch_root(trimmed)` and stores the watcher under `watch_key_for_path(&root)` (`351-352`). `fs_unwatch_entry_size_root`, however, computes its lookup key from the raw caller string via `watch_key_for_path(Path::new(trimmed))` (`403`), without running the same resolution step.

That mismatch means any case where `resolve_watch_root` changes the path shape relative to what the frontend later passes back will fail to decrement/remove the watcher. Relative paths, symlinked paths, canonicalized drive roots, and other aliasing cases can therefore leak recursive filesystem watches and keep stale ref-count entries around indefinitely.

### [P2] Recursive self-move/copy protection is lexical only and can be bypassed with `..` segments or path aliases

File: `src-tauri/src/fs_commands.rs:2848`

`validate_transfer_destination` is supposed to block moving/copying a directory into itself or one of its descendants. The check is:

- normalize absolute vs relative by prefixing `current_dir()`
- reject when `normalized_destination.starts_with(&normalized_source)` (`2872`)

The problem is that neither side is canonicalized or path-normalized beyond that. A destination like `source/../source/nested` or an alias reached through a symlink/junction can refer to the same subtree while failing the lexical `starts_with` check. That allows recursive copy/move requests to slip through the guard even though they still target the source tree semantically.

For directory operations this is dangerous: once it reaches the scheduler/provider layer, behavior depends on lower-level handling instead of being rejected deterministically at the command boundary.

## Residual Risks

- `search_requests()` in `src-tauri/src/fs_commands.rs` is written as a growing scope map and never appears to evict stale scopes. I did not classify this as a primary finding because the impact is gradual rather than immediate, but long-lived sessions that visit many unique directories/panels will retain dead cancellation scopes.
- The embedded Yazi workspace contains many internal `unwrap`/`expect` calls, but most are inside the vendored crates’ internal invariants or test/build paths. I did not elevate those without a clearer OverlayTerm-owned call path to a user-facing failure mode.
