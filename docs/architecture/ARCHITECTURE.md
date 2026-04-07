# OverlayTerm Architecture

## Purpose

OverlayTerm is a Tauri desktop overlay/workbench for terminal-centric development and asset browsing. It combines a floating terminal shell, content-browser-style explorer, source control tools, plugins, settings, theming, shader/animation authoring, and screenshot tooling into one app.

## High-Level Stack

- Frontend: React + TypeScript + Vite
- State: Zustand
- Desktop shell: Tauri 2
- Backend: Rust
- Styling/visuals: CSS, Tailwind, theme packages, animations, shaders, shader surfaces
- Testing: Vitest, browser tests, Rust tests

## Main Entry Points

- `src/main.tsx` - frontend bootstrap
- `src/App.tsx` - main overlay shell and orchestration root
- `src/panels/panelRegistry.tsx` - panel definitions and composition
- `src-tauri/src/` - native commands, window behavior, plugins, and backend integration

## Major Frontend Subsystems

- `src/components/`
  - Terminal overlay UI
  - File explorer UI
  - Git/source panel UI
  - Plugin manager and plugin runtime bridge
  - Screenshots manager
  - Settings page
  - Runtime layers for animations and shaders
- `src/config/`
  - Theme, layout, hotkey, overlay window, animation, shader, plugin, platform, and appearance configuration
- `src/runtime/`
  - Tauri bridge helpers, explorer backend access, overlay utilities, plugin runtime helpers
- `src/store/`
  - Zustand stores for terminal, explorer, settings, and task state
- `src/input/`
  - Global shortcut wiring
- `src/test/`
  - unit, browser, and proof tests

## Native / Rust Subsystems

- `src-tauri/` owns the desktop shell, window behavior, platform plugins, and native file/system integrations.
- The Rust side exposes commands used by the React app for window control, filesystem access, drag/drop, startup integration, notifications, and other native hooks.
- The workspace also includes several support crates for file opening and overlay contracts.

## Asset / Authoring Roots

- `themes/` - authored themes and theme assets
- `plugins/` - folder-driven plugin workbench area
- `animations/` - authored overlay animations
- `shaders/` - authored overlay shaders
- `public/` - web assets and icons
- `src-tauri/themes/` - native theme packages and icon themes used by the desktop layer

## Data Flow Shape

1. App bootstraps in React and hydrates settings/stores.
2. Theme, shader, animation, and plugin catalogs are discovered from disk and merged with built-ins.
3. `App.tsx` resolves presentation state and decides which panels are open, pinned, or active.
4. Tauri commands drive native window behavior, filesystem actions, drag/drop, startup settings, and platform integrations.
5. The command palette and global shortcuts act as the main navigation/action surface across the workbench.

## Validation Commands

- `bun run test:unit`
- `bun run test:browser`
- `bun run test:rust`
- `bun run build`
- `bun run tauri dev`

## Common Errors / Lessons Learned

- `src/App.tsx` is very large and central; keep edits surgical and well-scoped.
- The repo has many generated/derived artifacts in `target/`, `dist/`, and multiple `target-tests*` folders; avoid treating those as source.
- Rust manifest path references should be checked carefully before changing dependencies or crate locations.
- The overlay presentation logic is stateful and timing-sensitive; changing window behavior can have side effects on resize, focus, and hide/show flows.
- Theme/shader/animation discovery is file-driven, so directory structure matters.

## Notes for Future Agents

- This project is ship-focused and already has a strong baseline of panel, theme, plugin, and runtime infrastructure.
- When extending the UI, prefer integrating with existing settings, hotkey, and panel systems instead of bolting on separate flows.
- The human has explicitly defined a phased roadmap for the next stretch of work; treat it as the source of truth unless they revise it.
