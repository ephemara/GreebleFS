# AGENTS.md

## What This Repo Is

GreebleFS is a desktop command center built with:

- Tauri 2 for the native desktop host
- React 19 + TypeScript + Vite for the frontend shell
- Rust for native commands, filesystem work, terminal integration, screenshots, plugins, and typed contracts
- Yazi crates as the explorer engine layer

This is not supposed to become "just a file manager".

The intended product is:

- a highly themeable file explorer
- a shell/workbench for terminal, source control, notes, screenshots, and plugins
- a runtime-authored system with themes, shaders, animations, wallpapers, and layout variants

Think of it like this:

- Yazi is the engine room
- Tauri/Rust is the native host and capability layer
- React/TypeScript is the shell and presentation layer
- themes/layouts/plugins transform the experience without forking the whole app

## Shipping Loop: File Explorer Heartbeat

When working on the file explorer, prefer 20-minute passes that end with one concrete improvement or a clear next step.

- Re-check `FileExplorer`, `ExplorerWorkspace`, `ExplorerSideRail`, and the explorer config before each pass.
- Favor the highest-leverage UI, UX, performance, or workflow change available.
- Keep `AGENTS.md` and `memory.md` updated when the explorer direction or lessons change.
- Preserve the split: Rust owns truth, TS runtime/store orchestrates, components render.

## Architecture Intent

The intended split is:

- `src/`
  Owns the app shell, panel system, runtime discovery, theming, layout resolution, and frontend state.
- `src-tauri/`
  Owns native commands, filesystem truth, terminal PTY, screenshots, plugin backend helpers, window behavior, and Specta bindings export.
- `crates/fileexplorer/`
  Vendored Yazi code and related crates. Treat this as engine internals, not the first place to change app behavior.
- `crates/overlay-contracts/` and `crates/yazi-specta/`
  Typed cross-boundary contracts that keep Rust and TypeScript in sync.

Preferred layering:

1. Rust/backend owns filesystem truth, search truth, watchers, task state, native integration, and heavy file operations.
2. Typed bindings expose those capabilities into TS through Specta-generated contracts.
3. Frontend runtime/config/store layers orchestrate the shell and panel behavior.
4. Components render UI and should not grow backend/domain logic.

Do not collapse these boundaries by putting filesystem logic directly into React components or by wiring raw ad hoc Tauri invokes everywhere.

## Key Folders

### Main app

- `src/main.tsx`
  Frontend bootstrap. Initializes managed content roots before rendering.
- `src/App.tsx`
  Main shell. Orchestrates panels, workbench runtime, theme/shader/animation/wallpaper loading, overlay behavior, and layout mode.
- `src/panels/`
  Built-in panel registry and panel wiring for Explorer, Terminal, Source, Notes, Screenshots, Settings, and Plugins.
- `src/components/`
  Major UI surfaces. `FileExplorer.tsx` is the flagship explorer surface, but it is still one panel inside the larger shell.
- `src/components/explorer/`
  Explorer-specific UI pieces like the side rail and task badge.
- `src/config/`
  The most important folder for product-shape work. Holds theme resolution, workbench/explorer recipes, layout profiles, wallpapers, shaders, animations, plugin discovery, managed content roots, hotkeys, and platform rules.
- `src/runtime/`
  TS-side bridge helpers around generated Tauri bindings and runtime integrations.
- `src/store/`
  Zustand stores for persisted settings, explorer sessions/state, terminal state, and explorer task state.
- `src/generated/tauri.ts`
  Generated Specta bindings. Do not hand-edit. Regenerated from Rust.

### Native backend

- `src-tauri/src/lib.rs`
  Tauri app entry/setup.
- `src-tauri/src/fs_commands.rs`
  Core filesystem and explorer-facing native commands.
- `src-tauri/src/terminal.rs`
  PTY terminal backend.
- `src-tauri/src/plugin_commands.rs`
  Plugin backend runtime and directory watching.
- `src-tauri/src/screenshot_commands.rs`
  Screenshot capture/save/copy support.
- `src-tauri/src/window_commands.rs`
  Window/tray/overlay presentation behavior.
- `src-tauri/src/specta_bindings.rs`
  Source of generated TS bindings in `src/generated/tauri.ts`.

### Contracts and engine crates

- `crates/overlay-contracts/`
  Shared typed manifests and workbench/theme contract types.
- `crates/yazi-specta/`
  Yazi-facing types exported through Specta.
- `crates/fileexplorer/`
  Vendored Yazi project and related crates. Modify only when a change truly belongs in engine behavior.
- `crates/explorer/`
  Older explorer integration material. Read carefully before relying on it as current architecture; the live app primarily routes through `src-tauri/src/fs_commands.rs` and the TS runtime layer.

### Runtime-authored content

- `themes/`
  Theme packages discovered at runtime. Themes are deep system inputs, not just color swaps.
- `plugins/`
  File plugins and package plugins. Plugins can contribute panels, commands, explorer actions, themes, shaders, assets, fonts, and backend helpers.
- `shaders/`
  Runtime shader modules.
- `animations/`
  Runtime animation modules.
- `wallpapers/`
  Imported wallpapers and live wallpaper modules when present.
- `notes/`
  Managed notes root in dev; release builds relocate managed content under Tauri app data.
- `automations/`
  Agent/team memory and handoff material. Useful as project history, not app runtime code.

### Docs and build

- `ARCHITECTURE.md`
  Current detailed architecture notes. Read this first for deeper system context.
- `README.md`
  Product summary and run/test commands.
- `scripts/`
  Dev/build/release helpers, including Tauri startup and local install flows.

## The Important Product Rules

- The shell is first-class. Explorer is the flagship surface, but not the entire app.
- Yazi is a backend capability source, not a visual constraint.
- Theming must stay deep: colors, fonts, iconography, motion, surfaces, layout behavior, and runtime selection are all part of the system.
- Layouts and themes should be able to radically change presentation without rewriting core components.
- New backend/native behavior should usually enter through Rust plus typed bindings, then through `src/runtime/`, not straight into components.
- Prefer extending config/contract layers over scattering one-off visual constants through large components.

## Practical Guidance For Future Agents

- Start by reading `ARCHITECTURE.md`, then inspect `src/App.tsx`, `src/panels/panelRegistry.tsx`, and the relevant files in `src/config/`.
- For explorer behavior, check whether the change belongs in:
  - `src/config/explorerTheme.ts`
  - `src/config/explorerShellLayouts.ts`
  - `src/config/explorerViewModes.ts`
  - `src/components/FileExplorer.tsx`
  - `src/runtime/explorerBackend.ts`
  - `src-tauri/src/fs_commands.rs`
- For theme/workbench changes, prefer `src/config/appearance.ts`, `src/config/workbenchTheme.ts`, `src/config/layoutProfiles.ts`, and theme package manifests under `themes/`.
- For TS/Rust bridge changes, update Rust commands/types first, then regenerate bindings instead of patching `src/generated/tauri.ts` manually.
- Avoid editing vendored Yazi crates unless the app genuinely needs an engine-level change.

## Files And Folders Usually Not Worth Touching First

- `target/`, `src-tauri/target/`, `dist/`, `node_modules/`
  Build outputs or installed dependencies.
- `src/generated/tauri.ts`
  Generated file.
- random content files under managed runtime roots
  These are often user/runtime data, not architecture.

Protect the intended model: custom shell on top, typed native bridge in the middle, Yazi-backed engine underneath.
