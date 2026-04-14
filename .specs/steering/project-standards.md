# Project Standards

## Product Shape

- Treat OverlayTerm, currently labeled GreebleFS in parts of the repo, as a premium desktop command center built on Tauri 2, React 19, TypeScript, Rust, and Yazi-backed explorer crates.
- Preserve the product split: explorer is the flagship surface, but the shell, terminal, plugins, themes, shaders, animations, wallpapers, screenshots, and settings-driven layout system are first-class.
- Prefer durable capability improvements over superficial polish when the two are in tension.
- Keep performance-first mode active. Work should support a believable path toward 60 FPS during common interactions.

## Architecture Boundaries

- Rust in `src-tauri/` owns native truth, filesystem truth, PTY behavior, heavy file work, watchers, task execution, and host integrations.
- Typed bindings generated through Specta are the contract between Rust and TypeScript. Regenerate bindings instead of hand-editing `src/generated/tauri.ts`.
- TypeScript runtime, config, and store layers in `src/runtime/`, `src/config/`, and `src/store/` orchestrate shell behavior.
- React components in `src/components/` render UI and should not accumulate backend or filesystem truth.
- Treat vendored Yazi crates in `crates/fileexplorer/` as engine internals. Change them only when the behavior genuinely belongs below the app layer.

## Performance and Reliability

- Instrument expensive paths before and after major performance work when the hot path is not already obvious.
- Prefer visible-only or active-workspace-only background refresh behavior over repo-wide polling.
- Prefer watcher-driven invalidation over broad polling where the host/runtime allows it.
- Gate expensive development-only watchers behind `settings.system.developerMode` or equivalent explicit controls.
- For previews and diffs, degrade gracefully with metadata or non-text fallbacks instead of large in-memory reads.
- For subprocess-heavy paths such as git, move blocking work off latency-sensitive paths, add timeout protection, and surface actionable errors.

## Spec-Driven Work

- Use `.specs/steering/` for repo-wide guidance and `.specs/<slug>/` for feature-local planning.
- Use the `spec-process-guide` pipeline for any work that is larger than a quick isolated tweak.
- Prefer `micro` or `quick` for small fixes, `standard` for most medium and multi-day work, and `full` for large redesigns or risky migrations.
- Execute from `tasks.md` when a standard or full spec exists instead of improvising a fresh plan inside implementation turns.
- Update the matching spec package when implementation reveals new constraints, not in a separate undocumented note.

## Testing and Validation

- Validate the highest-risk path first.
- Prefer targeted commands before broad suites when iterating:
  - `bun run test`
  - `bun run test:browser`
  - `bun run test:rust`
  - `cargo run --manifest-path src-tauri/Cargo.toml --bin export-bindings`
- Add or extend targeted tests when they materially reduce regression risk for performance, preview, terminal, plugin runtime, or native bridge changes.
- Include manual validation steps when behavior depends on desktop runtime, overlay presentation, watcher behavior, or frame-time responsiveness.

## Documentation

- Keep `AGENTS.md`, `ARCHITECTURE.md`, `SHIPPLAN.md`, and relevant `.specs/` artifacts aligned when the repo’s architecture or execution model changes.
- Record durable cross-session findings in workspace memory or steering, not only in chat.
- Keep docs concrete and repository-specific. Avoid generic best-practice filler.

## Security and Secrets

- Keep secrets, auth stores, and tokens out of the repo.
- Treat `auth-profiles.json`, gateway config, and external credentials as sensitive operator material.
- Validate paths, user-controlled content, and plugin/runtime inputs at the backend boundary.

## Change Discipline

- Shared mainline development is acceptable in this repo because shipping speed matters, but avoid overlapping large edits to the same subsystem at the same time.
- Prefer one coherent objective per pass.
- When a change is risky, include rollback or containment notes in the spec and commit context.
