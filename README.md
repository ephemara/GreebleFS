# OverlayTerm

OverlayTerm is a Tauri desktop command overlay that keeps the terminal, file explorer, source control, plugins, runtime theming, and screenshot capture in one workbench.

## Product Surface

- `Terminal`: primary command workspace with integrated shell and external handoff support.
- `Explorer`: file navigation, bookmarks, repo picking, drag/drop, and asset browsing.
- `Source`: repository import, diff inspection, stage/unstage/discard, conflict resolution, commit, and quick ship flows.
- `Plugins`: folder-driven TSX plugin host with preview and top-bar tab integration.
- `Settings`: appearance, layouts, hotkeys, system startup, explorer rules, shader/animation/theme authoring.
- `Screenshots`: multi-monitor capture, annotation, save/copy, and gallery review.

## Quick Start

1. Install dependencies with `bun install` or `npm install`.
2. Start the frontend with `bun run dev` or `npm run dev`.
3. Start the desktop shell with `bun run tauri dev` or `npm run tauri dev`.
4. Open the `Source` panel and import a repository from `Explorer`.
5. Use `Settings > Overview` to open the authoring roots for plugins, themes, shaders, animations, and screenshots.

## Workspace Roots

- Themes: `themes/`
- Plugins: `plugins/`
- Frontend source: `src/`
- Tauri backend: `src-tauri/`
- Animations: `animations/`
- Shaders: `shaders/`

## Verification

- Unit tests: `bun run test:unit` or `npm run test:unit`
- Browser tests: `bun run test:browser` or `npm run test:browser`
- Production build: `bun run build` or `npm run build`

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/)
- [Tauri VS Code extension](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
