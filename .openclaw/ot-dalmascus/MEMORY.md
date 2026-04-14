# MEMORY.md - OT Dalmascus

## Durable role

- Agent: OT Dalmascus
- Lane: Core implementation strike lead
- Repo: F:\apps-2d\overlayterm
- Fleet root: F:\apps-2d\overlayterm\.openclaw

## Working rule

Push OverlayTerm toward premium, monetizable, final-boss quality.

## Pass notes

- GitManager untracked diff size hints now cache per preview path inside the component instance, so repeated opens of the same untracked file no longer rescan the parent directory every time.
- Git backend now reports non-zero git exits with explicit exit codes plus stderr/stdout context, and a Rust test covers the failure path.
- Rust verification was partially blocked by the local mingw linker missing `-lgcc` / `-lgcc_eh`, but `cargo fmt --manifest-path src-tauri/Cargo.toml` completed cleanly after the edit.
- Plugin runtime fallback follow-through added cleanup coverage for the unmount path and max-backoff coverage for the polling loop in `src/test/useFolderPluginRuntime.fallback.test.tsx`, and the watcher failure path now serially unwinds attempted registration before falling back to polling while treating unwatch cleanup failures as logged non-fatal setup noise; direct Vitest execution is still blocked locally by unresolved `vitest/config` and `@vitejs/plugin-react` imports.
