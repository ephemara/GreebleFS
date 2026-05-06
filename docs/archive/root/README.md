# GreebleFS

GreebleFS is a Tauri desktop workbench that keeps the terminal, file explorer, source control, plugins, runtime theming, and screenshot capture in one shell.

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

## Cloud OAuth

- Google Drive and Dropbox login already use the system browser plus a localhost callback from `Settings > Cloud Accounts`.
- To ship app-owned OAuth credentials with a build, copy `.env.example` to `.env` or `.env.local`, fill the `GREEBLE_*` cloud keys, then rebuild the Tauri app.
- Saved credentials from `Settings > Cloud Accounts` still override bundled/environment credentials on that machine.

## Verification

- Unit tests: `bun run test:unit` or `npm run test:unit`
- Browser tests: `bun run test:browser` or `npm run test:browser`
- Production build: `bun run build` or `npm run build`
- Linux bundles: `bun run release:linux:bundle`
- Linux local install: `bun run release:linux:install`
- Windows local clean install: `bun run release:windows:install`
- Windows uninstall only: `bun run release:windows:uninstall`

## Release Notes

- The shipped app, Tauri bundle identity, Linux installer, and desktop entry now use the `GreebleFS` name.
- Windows local installs now use `scripts/platform/install-windows-local.ps1`, which rebuilds the app, clears the prior per-user install/state roots, and reinstalls into `%LOCALAPPDATA%\Programs\GreebleFS`.
- Legacy `OverlayTerm` runtime/import/storage identifiers remain supported for this release candidate where they are part of plugin compatibility or persisted local state.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/)
- [Tauri VS Code extension](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
