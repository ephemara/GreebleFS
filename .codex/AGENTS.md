# AGENTS.md

## GreebleFS, OverlayTerm, and `greeble`

This repository has naming drift.

- The repo is `GreebleFS`
- The Rust package / binary is currently `greeble`
- Several docs and UX strings still say `OverlayTerm`

Treat those as the same product line unless a task is explicitly about renaming or brand cleanup.

## What This Repo Actually Is

GreebleFS is a desktop workbench built around a premium, highly themeable file explorer and a broader native shell.

It is built from four major layers:

- React 19 + TypeScript + Vite for the shell, panels, theming, layouts, and runtime-authored presentation
- Tauri 2 + Rust for the native desktop host, filesystem truth, PTY integration, screenshots, plugin/runtime plumbing, and window behavior
- Specta-generated contracts for the typed bridge between Rust and TypeScript
- Yazi crates as the explorer engine substrate

This repo should not collapse into “just a file manager.”

The product is supposed to feel like:

- a world-class content browser
- a native desktop command center
- a runtime-authored shell that can radically change its identity through themes, layouts, shaders, wallpapers, animations, and plugins

If you need a quick mental model:

- Yazi is the engine room
- Rust/Tauri is the host and truth layer
- Specta is the language between worlds
- React is the shell and orchestration layer
- the explorer is the flagship workspace, not the whole app

## The UE5 Content Browser Vibe

The explorer is heavily inspired by the feel of Unreal Engine's Content Browser, but this app is not trying to become a literal clone.

What is being borrowed:

- the idea that browsing content can be the hero workflow, not a side utility
- a serious sources rail, aggressive previewing, and rich selection state
- a panel that feels dockable, persistent, and powerful enough to live inside a larger workstation
- workflows that feel asset-first, keyboard-first, and fast enough to trust
- the sense that the browser is part of a bigger editor shell, not a standalone window with tabs glued on

What is not being borrowed:

- Unreal’s exact visual language
- Unreal’s engine/editor assumptions
- a hardcoded single layout
- a frontend that owns domain truth

The target is “UE5 content browser energy inside a transformable desktop shell,” not cosplay.

Useful repo evidence for this intent:

- `src/components/FileExplorer.tsx` is explicitly described as a UE5-feel explorer
- `src/components/TerminalOverlay.tsx` references a UE5 content-drawer-style terminal
- `docs/reference/` contains Unreal Content Browser reference material used as design research

## The Product Shape To Protect

The intended product shape is:

- shell first
- explorer as flagship mode
- native/backend owns truth
- frontend orchestrates and renders
- theming changes deep presentation, not just accents
- layouts can materially change the shell without rewriting core behavior
- plugins can extend the app without forking the whole system

Do not flatten this into a generic enterprise dashboard.
Do not flatten it into a terminal app with a file picker.
Do not flatten it into a web file manager wearing expensive CSS.

## How The App Works

At a high level, the runtime flow is:

1. `src/main.tsx`
   Boots the frontend and initializes managed content roots before the shell renders.
2. `src/App.tsx`
   Loads persisted settings, resolves themes/layouts/workbench runtime, hydrates wallpapers/shaders/animations/plugins, and orchestrates the active shell.
3. `src/panels/panelRegistry.tsx`
   Defines the built-in panel registry and wires the explorer, terminal, source, notes, screenshots, settings, and plugins surfaces into the shell.
4. `src/components/FileExplorer.tsx` plus explorer subcomponents
   Render the hero explorer surface, dual-pane workspace behavior, rail, view modes, previews, and interaction chrome.
5. `src/runtime/` and `src/generated/tauri.ts`
   Bridge frontend intent to typed native commands instead of ad hoc raw invoke calls.
6. `src-tauri/src/*.rs`
   Execute native work: filesystem reads/mutations, terminal PTY work, screenshot capture, plugin scanning, overlay geometry, cloud/python/domain helpers, and explorer-pro utilities.
7. Rust/Yazi/services return typed data back through Specta
   The TS stores/runtime layer adopts that data, and React rerenders the shell.

That separation matters. Protect it.

## Why The Explorer Is Complex

Do not underestimate the explorer. It is one of the most complex surfaces in the repo.

Current scale markers:

- `src/components/FileExplorer.tsx`: about 7.7k lines
- `src/components/explorer/ExplorerSideRail.tsx`: about 1.2k lines
- `src/components/explorer/ExplorerWorkspace.tsx`: about 644 lines
- `src-tauri/src/fs_commands.rs`: about 6k lines
- `src-tauri/src/explorer_pro_commands.rs`: about 1.1k lines

That size exists because the explorer is not just a directory list. It has to coordinate:

- path navigation and history
- cached directory loads and search results
- inline preview behavior
- multiple explorer view modes
- experimental explorer runtimes
- shared session state and named sessions
- tabs and dual-pane workspace layout
- bookmarks, drives, tags, and saved searches
- drag/drop behavior for both in-app and OS targets
- native icon resolution and entry size measurement
- long-running file operations and task state
- overlay mode vs full window mode
- theme-driven chrome, metrics, density, and presentation
- fast enough performance to still feel native

The explorer is hard because it combines:

- a demanding UI surface
- a high-volume async data plane
- theme/layout transformability
- native desktop expectations
- a large number of edge cases around cache invalidation, remounts, stale requests, preview limits, drag semantics, and performance

Do not do casual drive-by edits in the explorer.
First decide whether the change belongs in:

- Rust commands
- typed contracts
- runtime bridge helpers
- Zustand stores
- explorer config / recipe files
- the rendering layer

If you skip that decision and patch the first component you see, you will make the system worse.

## Architecture Intent

The intended layering is:

1. Rust/backend owns filesystem truth, task truth, search truth, watcher truth, preview truth, and native integrations
2. Specta exports typed contracts into TypeScript
3. TS runtime/config/store layers orchestrate shell behavior
4. React components render the UI and push intents downward

This means:

- no filesystem truth living inside components
- no random `invoke("some_string")` calls scattered through the app if the runtime layer can own them
- no theme-specific constants pasted directly into large surfaces when a config or recipe layer should own them
- no Yazi engine edits unless the behavior truly belongs in engine territory

## Repo Map

### `src/` — frontend shell

This is the main React/TypeScript application layer.

Important files and folders:

- `src/main.tsx`
  Frontend bootstrap and managed-content initialization.
- `src/App.tsx`
  Main shell. Handles theme/runtime resolution, panel orchestration, overlay behavior, wallpaper/shader/animation layering, and app mode.
- `src/panels/`
  Built-in panel registry and panel metadata.
- `src/components/`
  Major UI surfaces including explorer, terminal, source control, screenshots, settings, plugins, and shell chrome.
- `src/components/explorer/`
  Explorer-local UI like the side rail, task badge, workspace shell, and related explorer surfaces.
- `src/config/`
  One of the highest-leverage folders in the repo. Holds appearance, workbench theme, explorer theme, layout profiles, explorer shell layouts, experimental modes, wallpapers, overlay geometry rules, plugin discovery, hotkeys, and content-root behavior.
- `src/runtime/`
  TS-side service layer around generated native bindings and runtime integrations.
- `src/store/`
  Zustand stores for settings, explorer state, terminal state, explorer task state, and other persisted shell behavior.
- `src/generated/tauri.ts`
  Generated Specta bindings. Do not hand-edit.

### `src-tauri/` — native desktop host

This folder is the Tauri application and the native truth layer.

Important files:

- `src-tauri/src/lib.rs`
  Tauri setup and app registration entrypoint.
- `src-tauri/src/fs_commands.rs`
  Core filesystem and explorer-facing command surface. This is one of the most important backend files in the entire repo.
- `src-tauri/src/explorer_pro_commands.rs`
  Higher-level explorer utilities like app-managed trash, duplicate scanning, batch rename, tags, and saved searches.
- `src-tauri/src/terminal.rs`
  PTY terminal backend.
- `src-tauri/src/plugin_commands.rs`
  Plugin discovery/runtime helpers and directory watching.
- `src-tauri/src/screenshot_commands.rs`
  Screenshot capture, crop/save/copy, and monitor-aware image handling.
- `src-tauri/src/window_commands.rs`
  Overlay/dock/window behavior and presentation-mode commands.
- `src-tauri/src/cloud_commands.rs`
  Cloud-facing command surface.
- `src-tauri/src/python_commands.rs`
  Python/runtime integration helpers.
- `src-tauri/src/desktop_integration.rs`
  Platform/Desktop integration helpers.
- `src-tauri/src/specta_bindings.rs`
  Generates the TypeScript bindings that land in `src/generated/tauri.ts`.

Also note:

- `src-tauri/tauri.conf.json` is release-safe config; dev-only URL injection is handled by scripts
- `src-tauri/plugins/`, `themes/`, `shaders/`, `animations/`, and `wallpapers/` contain native-side sample/runtime-authored content used by the app host

### `crates/` — contracts, platform helpers, and engine dependencies

Important crates:

- `crates/overlay-contracts/`
  Shared typed contracts for theme/workbench/plugin-facing metadata crossing the Rust/TS boundary.
- `crates/overlay-theme/`
  Theme-related shared crate support.
- `crates/yazi-specta/`
  Yazi-facing types exported through Specta for the frontend bridge.
- `crates/fileexplorer/`
  Vendored Yazi project and related crates. This is engine substrate, not the first place to patch app behavior.
- `crates/file-opening*`
  Platform-specific file opening helpers for Linux/macOS/Windows.
- `crates/macos/`
  macOS-specific integration work.

Special caution:

- `crates/explorer/` exists, but the live app primarily routes through `src-tauri/src/fs_commands.rs` plus the TS runtime/store layers
- do not assume older crates or experiments are the canonical path without verifying current usage

### Runtime-authored content roots

These are not decorative extras. They are part of the product architecture.

- `themes/`
  Runtime-discovered theme packages
- `plugins/`
  Package and file-driven plugins that can contribute panels, commands, assets, themes, shaders, and other capabilities
- `shaders/`
  Runtime shader modules
- `animations/`
  Runtime animation modules
- `wallpapers/`
  Imported and authored wallpaper content
- `notes/`
  Managed notes root in development
- `automations/`
  Project/team memory and handoff material, not core app runtime code

Development vs release behavior matters:

- `tauri dev` uses repo-relative content roots so authoring happens in the workspace
- installed/release builds relocate managed content under Tauri app-local data

Do not break that split by assuming `$HOME/plugins`-style paths are still correct.

### Docs and support material

- `ARCHITECTURE.md`
  Deep architecture notes. Read this first for serious work.
- `memory.md`
  Durable project/task memory and lessons learned.
- `README.md`
  Product summary and basic commands.
- `SHIPPLAN.md`
  Current shipping priorities and performance-first plan.
- `HEARTBEAT.md`
  Explorer heartbeat guidance.
- `docs/reference/`
  Design/reference material, including Unreal Content Browser source references.

## The Most Important Frontend Files

If you need to reason about the product quickly, start here:

- `src/App.tsx`
- `src/panels/panelRegistry.tsx`
- `src/components/FileExplorer.tsx`
- `src/components/explorer/ExplorerWorkspace.tsx`
- `src/components/explorer/ExplorerSideRail.tsx`
- `src/config/appearance.ts`
- `src/config/workbenchTheme.ts`
- `src/config/explorerTheme.ts`
- `src/config/layoutProfiles.ts`
- `src/config/explorerShellLayouts.ts`
- `src/config/explorerExperimentalModes.ts`
- `src/runtime/explorerBackend.ts`
- `src/store/explorerStore.ts`
- `src/store/settingsStore.ts`

## Change Routing Guide

When deciding where a change belongs, use this routing:

### Explorer visual treatment, density, chrome, view metrics

Look at:

- `src/config/explorerTheme.ts`
- `src/config/explorerShellLayouts.ts`
- `src/config/explorerViewModes.ts`
- `src/config/explorerExperimentalModes.ts`
- theme package manifests under `themes/`

### Explorer UI composition, interactions, tabs, preview, rail behavior

Look at:

- `src/components/FileExplorer.tsx`
- `src/components/explorer/ExplorerWorkspace.tsx`
- `src/components/explorer/ExplorerSideRail.tsx`
- `src/store/explorerStore.ts`

### Filesystem truth, search truth, native file operations, explorer metadata, long-running jobs

Look at:

- `src-tauri/src/fs_commands.rs`
- `src-tauri/src/explorer_pro_commands.rs`
- `src/runtime/`
- `src/generated/tauri.ts`

### Workbench shell, panel orchestration, layout runtime, overlay behavior

Look at:

- `src/App.tsx`
- `src/panels/panelRegistry.tsx`
- `src/config/layoutProfiles.ts`
- `src/config/workbenchTheme.ts`
- `src/config/overlayWindow.ts`
- `src-tauri/src/window_commands.rs`

### Plugin, shader, wallpaper, animation, theme discovery/runtime

Look at:

- `src/runtime/useFolderPluginRuntime.ts`
- `src/config/themePackages.ts`
- `src/config/wallpapers.ts`
- `src/components/wallpaperRuntime.tsx`
- `src-tauri/src/plugin_commands.rs`

### Rust/TS contract changes

Do this in order:

1. change Rust types/commands
2. update `src-tauri/src/specta_bindings.rs` if needed
3. regenerate bindings
4. update TS runtime usage
5. update UI

Do not patch `src/generated/tauri.ts` by hand.

## Product Rules Future Agents Should Not Break

- The shell is first-class. Explorer is the hero surface, not the whole app.
- Yazi is a capability source, not a UI prison.
- Themes must stay deep: colors, typography, iconography, motion, shell chrome, render style, wallpaper, shader atmosphere, and layout behavior all matter.
- Layouts should be able to materially change presentation without forcing a rewrite of domain logic.
- New native behavior should usually enter through Rust plus typed bindings, then through `src/runtime/`, not directly inside components.
- Prefer data/config/manifest-driven extension points over inline constants and one-off branching.
- Keep managed-content dev vs release path behavior intact.
- Do not assume overlay/dock mode is a separate fake subsystem unless current architecture proves it.
- Do not scatter raw platform behavior through React when the Tauri layer should own it.

## Known Complexity / Risk Areas

These are easy places to create regressions:

- explorer cache invalidation and stale async completion
- preview memory limits and large-file handling
- drag/drop semantics between in-app and OS-native paths
- overlay geometry, especially Linux/Wayland/X11 behavior
- developer-mode watcher behavior vs production manual refresh behavior
- generated contracts and Specta binding drift
- theme/layout changes that accidentally hardcode one visual identity
- touching vendored Yazi crates when the change belongs in the app layer

If a change seems simple but touches one of those areas, assume it is not simple.

## What Not To Touch First

Usually do not start in:

- `target/`
- `src-tauri/target/`
- `dist/`
- `node_modules/`
- `src/generated/tauri.ts`
- random files under runtime content roots
- vendored Yazi crates unless you already proved the bug is engine-level

## Practical Workflow For Agents

Before substantial work:

1. read `ARCHITECTURE.md`
2. skim `memory.md`
3. inspect the relevant runtime/config/component/backend files
4. decide the correct layer before editing

When changing behavior:

1. prefer vertical slices over half-finished scaffolding
2. keep contracts explicit
3. keep shell logic in shell layers
4. keep domain truth in Rust/native layers
5. validate the narrowest relevant path

When changing the explorer:

1. re-check `FileExplorer.tsx`
2. re-check `ExplorerWorkspace.tsx`
3. re-check `ExplorerSideRail.tsx`
4. re-check explorer config and store files
5. make one durable improvement, not five speculative ones

## Validation Commands

Common commands from this repo:

- `bun run dev`
- `bun run tauri dev`
- `bun run build`
- `bun run test:unit`
- `bun run test:browser`
- `bun run test:rust`
- `cargo run --manifest-path src-tauri/Cargo.toml --bin export-bindings`
- `bash ./install.sh`
- `bun run release:linux:install`

Prefer targeted validation when the workspace has known unrelated failures.

## Durable Lessons

- The explorer is performance-sensitive. Prefer routing chrome/metric changes through config/recipe layers instead of scattering magic numbers through `FileExplorer.tsx`.
- Shared explorer caches are intentional. Clear or invalidate them deliberately in tests and diagnostics instead of assuming mount isolation.
- Release/install paths and `tauri dev` content roots do not behave the same way. Respect that split.
- Generated bindings are generated. Regenerate them.
- The current product identity depends on preserving shell ambition and transformable presentation. If a change makes the app feel more generic, it is probably wrong.

## The Short Version

If you remember nothing else, remember this:

- this repo is building a premium desktop shell, not a dressed-up file manager
- the explorer is the flagship workspace, inspired by UE5 content-browser energy
- Rust owns truth
- Specta owns the bridge
- TS runtime/store layers orchestrate
- React renders
- themes/layouts/plugins are core architecture, not garnish

Protect that shape every time you touch the repo.
