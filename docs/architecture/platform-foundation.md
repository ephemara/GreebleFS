# Platform Foundation

## Refactor goals

- Keep the React shell focused on composition, rendering, and interaction.
- Push filesystem, process, indexing, and manifest-validation work toward Rust crates.
- Treat themes as full presentation systems, not just color palettes.
- Treat layouts as shell blueprints so radically different UX models can coexist.

## Frontend boundaries

- `src/config/appearance.ts`
  - Owns theme semantics, presentation tokens, and CSS variable projection.
- `src/config/shellBlueprints.ts`
  - Defines the shell paradigms the app can support: classic dock, XMB, retro desktop, tile start, dual-screen handheld.
- `src/config/layoutProfiles.ts`
  - Chooses a shell blueprint and configures how a specific profile behaves inside that paradigm.

## Rust boundaries

- `src-tauri`
  - Tauri wiring and command registration only.
- `crates/overlay-contracts`
  - Shared domain contracts for shell blueprints and theme presentation.
- Future crates
  - `overlay-fs`: directory listing, search, caching, watchers.
  - `overlay-terminal`: PTY lifecycle, external terminal launch, terminal session state.
  - `overlay-theme`: manifest discovery, schema validation, asset indexing.
  - `overlay-plugins`: plugin manifest parsing, watch pipelines, backend execution.

## Migration order

1. Keep the current classic dock working while new shell blueprints are introduced behind contracts.
2. Move `src/App.tsx` orchestration into feature modules by runtime concern.
3. Peel `src-tauri/src/fs_commands.rs` and `src-tauri/src/terminal.rs` into workspace crates.
4. Move theme and layout manifest validation into Rust once schema stabilizes.
