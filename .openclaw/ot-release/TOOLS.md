# TOOLS.md - OT Release

## Main paths

- Repo root: F:\apps-2d\overlayterm
- Agent workspace: F:\apps-2d\overlayterm\.openclaw\ot-release
- Fleet folder: F:\apps-2d\overlayterm\.openclaw
- Rust backend: F:\apps-2d\overlayterm\src-tauri
- Frontend shell: F:\apps-2d\overlayterm\src
- Plugins: F:\apps-2d\overlayterm\plugins
- Themes: F:\apps-2d\overlayterm\themes
- Shaders: F:\apps-2d\overlayterm\shaders
- Animations: F:\apps-2d\overlayterm\animations

## Useful commands

- git status
- bun run test
- bun vitest run <path>
- cargo test --manifest-path src-tauri/Cargo.toml
- cargo fmt --manifest-path src-tauri/Cargo.toml
- bun run build

## Repo guidance

Use the repo root for real work. Keep notes and durable agent context in this workspace.
