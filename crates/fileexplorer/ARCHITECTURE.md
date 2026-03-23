# Architecture

## Goal

Build a desktop product on top of Yazi that is fast, themeable, panel-based, and AI-friendly to extend. The architecture must keep domain logic out of the UI while preserving enough flexibility to support multiple shell identities.

## Top-Level Shape

The system should be divided into five major layers:

1. Rust domain engine
2. Tauri shell and bridge
3. Typed contract generation
4. Frontend runtime
5. Presentation and theming

## 1. Rust Domain Engine

The Rust side is the source of truth for application behavior.

Responsibilities:

- directory listing
- filesystem metadata
- watchers
- previews and preview metadata
- search
- tasks and long-running jobs
- plugin discovery metadata
- theme and layout package discovery metadata
- workspace persistence
- domain events

Preferred direction:

- keep Yazi as the foundation
- extract or wrap engine-facing capabilities behind stable services
- avoid coupling desktop UI decisions directly into the engine layer

The engine should expose intent-driven operations such as:

- navigate to path
- list children
- fetch preview
- start search
- cancel search
- execute action
- observe path changes
- observe job progress

## 2. Tauri Shell

Tauri should provide native desktop responsibilities, not business logic.

Responsibilities:

- window lifecycle
- tray and taskbar integration
- drag/drop and native window behavior
- updater and packaging
- native OS bridges
- command/event transport between frontend and Rust

Tauri should not become the application architecture by itself. It is the shell and transport boundary.

## 3. Typed Contract Layer

This layer is mandatory.

The project must not scatter raw `invoke("string_name")` and ad hoc event names throughout the frontend. Instead, commands and events should be declared from a single contract source and generate:

- Rust command bindings
- TypeScript request and response types
- typed frontend clients
- typed event names and payloads
- optional runtime validators on the frontend

Desired frontend ergonomics:

- `backend.explorer.listDir(...)`
- `backend.explorer.search(...)`
- `backend.window.toggleOverlay()`
- `backend.events.onJobProgress(...)`

The contract layer should define:

- request payloads
- response payloads
- success and error shape
- event payloads
- state snapshot shape

## 4. Frontend Runtime

The frontend runtime should be framework-specific but architecture-stable.

Preferred stack:

- Tauri v2
- SvelteKit
- TypeScript

Responsibilities:

- application shell state
- workspace and panel composition
- local interaction state
- subscribing to backend snapshots and events
- theme resolution
- layout resolution
- command routing

Rules:

- components do not call raw backend commands directly
- components do not own filesystem truth
- components do not contain theme-specific literals when those should come from tokens or recipes
- heavy surfaces must be isolated so unrelated shell changes do not cause jank

## 5. Presentation And Theming

The visual system must be treated as a product subsystem, not decoration.

### Theme System

OverlayTerm already demonstrated the right direction: themes should be package-like assets with more than colors.

Themes should be able to define:

- palette tokens
- semantic roles
- fonts
- icon themes
- wallpaper/backgrounds
- visual layers
- motion defaults
- shader defaults
- CSS variables
- component recipe overrides

The theme system should support inheritance or extension so a package can build on top of another base.

### Layout System

Layouts should be explicit profiles, not accidental arrangements.

Layouts should control:

- chrome position
- dock position
- pinned panels
- workspace composition
- default active panels
- control visibility
- layout behavior presets

This is how one product can support shell identities like:

- standard desktop shell
- bottom navigator shell
- XMB-like flow
- touch-forward split layouts
- board/tile layouts

### Motion And Shader System

Motion and shader systems should be modular runtime contributions rather than hardcoded one-off effects.

Requirements:

- safe failure boundaries
- package loading and discovery
- per-theme defaults
- runtime selection
- optional user overrides

These systems exist to enrich the shell without infecting core domain behavior.

## Workspace Model

The application should be organized around workspaces and panels.

Core concepts:

- shell
- workspace
- panel
- layout profile
- theme package
- plugin package

Panels are units like:

- explorer
- preview
- inspector
- terminal
- tasks
- settings
- plugins

The shell owns panel orchestration. A single workspace should not become the entire app.

## Recommended Initial Repo Shape

This is a conceptual target, not a rigid naming requirement.

- `apps/desktop`
  Svelte/Tauri frontend shell
- `crates/engine`
  Yazi-backed domain APIs
- `crates/contracts`
  typed command and event declarations
- `crates/desktop-host`
  Tauri command implementation layer
- `packages/frontend-contracts`
  generated TS clients and types
- `packages/theme-schema`
  theme and layout schema definitions
- `themes/`
  installable theme packages
- `plugins/`
  installable plugin packages
- `docs/`
  shared context for humans and agents

## Architectural Non-Negotiables

- No business logic hidden inside view components.
- No theme system limited to color swaps.
- No one-workspace-first architecture.
- No raw stringly typed frontend bridge spread through the app.
- No direct port of the OverlayTerm frontend structure.
- No assumption that the initial shell style is the final style.

## Delivery Order

1. docs and contract definitions
2. typed bridge generation
3. shell and panel framework
4. theme and layout engine
5. Yazi-backed explorer slice
6. preview and search slice
7. plugin and package loading
8. premium motion and shell polish

## North Star

The final product should feel like a coherent desktop environment whose flagship workspace is a world-class content browser, with Yazi providing the operational strength underneath and a fully transformable shell on top.
