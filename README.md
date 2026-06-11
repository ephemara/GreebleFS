# GreebleFS

> *A Tauri desktop workbench centered on a highly themeable file explorer, terminal overlay, plugins, shaders, animations, and settings-driven shell customization.*

**GreebleFS** is not just a file explorer. It is a desktop workbench — a themable, extensible, GPU-accelerated native surface where the file explorer is the center of everything. Think VS Code meets Directory Opus, running on Tauri 2 + Rust + React, with a custom fork of the Tauri framework itself.

---

## Table of Contents

1. [What GreebleFS Is Trying To Do](#what-greeblefs-is-trying-to-do)
2. [Scale & Scope](#scale--scope)
3. [Architecture at a Glance](#architecture-at-a-glance)
4. [The Tauron Fork](#the-tauron-fork)
5. [The `/usr` Folder System](#the-usr-folder-system)
6. [Full Flow: How Everything Is Wired Up](#full-flow-how-everything-is-wired-up)
7. [Technology Stack](#technology-stack)
8. [Key Subsystems](#key-subsystems)
9. [Project Structure](#project-structure)
10. [Getting Started](#getting-started)
11. [Validation & Testing](#validation--testing)
12. [Design Principles](#design-principles)
13. [The Beauty of GreebleFS](#the-beauty-of-greeblefs)

---

## What GreebleFS Is Trying To Do

GreebleFS is a **theme-first, explorer-centric desktop workbench**. It reimagines the file explorer not as a utility window you open and close, but as the **primary surface** of your desktop interaction.

### Core Goals

1. **Make the file explorer the shell.** The explorer is not a sidebar or a popup — it is the default launch surface (`greeblefs://home`), the workspace hub, and the background against which all other tools operate.

2. **Theme everything.** Themes are not just color palettes. They are composable orchestration manifests that control appearance, interaction motion, layout dynamics, chrome layout, icon themes, wallpapers, shaders, animations, sound packs, render styles, workbench recipes, explorer recipes, and dock presentation — all authored as data, not code.

3. **Plugin-native extensibility.** Every preview lane, every explorer workflow, every settings slot, every activity rail item can be contributed by a plugin. Plugins have a real sandbox, a declared dependency graph, and access to host files, events, selection context, and terminal services.

4. **GPU-accelerated native performance.** A custom `wgpu` backplane renders behind the WebView, native buffer pools carry directory listings and preview bytes across the host boundary without JSON serialization, and a bounded task graph manages cancellable scan/thumbnail/preview/archive work.

5. **Multi-runtime polyglot.** The app orchestrates Rust (native host), React/TypeScript (shell), Go/TinyGo (Wasm panels and native sidecars), Python (AI/media sidecar), Kain (semantic UI and lattice authoring), and Node (VS Code extension bridge) — all through one typed extension-host schema.

6. **Dual-surface shell.** The app has two presentation modes — a full windowed application shell and a compact overlay dock (Yakuake/Guake-style) — that share the same explorer sessions, filesystem data plane, and workspace state.

7. **Mobile companion.** A separate PWA bundle served over LAN/mobile sharing provides a browser-safe file browser, search, transfers, and plugin panes from your phone, all backed by the same desktop host.

---

## Scale & Scope

GreebleFS is a **massive** codebase. Here are some numbers that suggest its scale:

| Metric | Count |
|--------|-------|
| **Total files** | ~5,600+ |
| **TypeScript/TSX source files** | ~1,000+ |
| **Rust source files** | ~80+ in `src-tauri/src/`, plus 17 workspace crates |
| **Go source modules** | ~20+ in `src-go/` (SDK + builtin runtimes) |
| **Python modules** | Sidecar package in `src-python/` |
| **Kain modules** | `src-kain/` with stdlib, lattice, plugins, runtimes, FFI bridges |
| **Theme bundles** | 30+ in `usr/themes/` |
| **Appearance packs** | 15+ token lanes in `usr/appearance-packs/` |
| **Icon themes** | Multiple in `usr/icon-themes/` |
| **Plugins** | 20+ in `usr/plugins/`, plus Kain plugins in `usr/plugins-kain/` |
| **Architecture documentation** | 1,186 lines of dense architectural specification |
| **Test files** | 50+ Vitest test suites |
| **zulgent of Rust dependencies** | ~200 workspace dependencies |
| **npm packages** | ~100 dependencies |
| **Vite configs** | 6 separate configs (main, mobile, shared, vitest browser, vitest echo) |

### Lines of Code (estimate)

- `src/App.tsx`: ~8,500 lines (the main shell orchestrator)
- `src/components/FileExplorer.tsx`: ~30,000+ lines ~ the eldritch horror of typescript.
- `architecture.md`: ~2,700 lines
- `memory.md`: ~9,300 lines (developer session memory)
- `scripts/run-platform-tauri.mjs`: ~1,400 lines (dev/build orchestration)
- **Total estimated code**: well over 200,000 lines across all languages.

### What Makes This Scale Special

This is not a weekend project. It is a **sustained, multi-year workbench** built by someone with deep knowledge of:
- Desktop application architecture
- Tauri internals (hence the fork)
- Filesystem APIs and NTFS internals
- GPU programming and real-time rendering
- Plugin systems and extension hosts
- Theme engines and design tokens
- Polyglot runtime orchestration

The result is a codebase where almost every subsystem has been **architected from first principles** rather than stitched together from tutorials.

---

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────────┐
│                    USER INTERFACE                        │
│  ┌───────────────────────────────────────────────────┐  │
│  │              React 19 + TypeScript                 │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │  │
│  │  │ App.tsx  │ │FileExpl- │ │ TerminalOverlay  │  │  │
│  │  │ (shell)  │ │ orer.tsx │ │ (xterm + native  │  │  │
│  │  │          │ │ (main UI)│ │  byte stream)    │  │  │
│  │  └──────────┘ └──────────┘ └──────────────────┘  │  │
│  │         Zustand Stores (settings, explorer, etc)   │  │
│  └───────────────────────────────────────────────────┘  │
│                         │ IPC                            │
│  ┌───────────────────────────────────────────────────┐  │
│  │              RUST BACKEND (Tauri 2)                │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │  │
│  │  │fs_commands│ │native_   │ │runtime_pipeline  │  │  │
│  │  │(filesys) │ │task_graph│ │(polyglot host)   │  │  │
│  │  └──────────┘ └──────────┘ └──────────────────┘  │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │  │
│  │  │audio_    │ │video_    │ │gpu_runtime       │  │  │
│  │  │engine.rs │ │engine.rs │ │(wgpu offload)    │  │  │
│  │  └──────────┘ └──────────┘ └──────────────────┘  │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │  │
│  │  │global_   │ │semantic_ │ │python_sidecar.rs │  │  │
│  │  │search/   │ │search.rs │ │(managed Python)  │  │  │
│  │  └──────────┘ └──────────┘ └──────────────────┘  │  │
│  └───────────────────────────────────────────────────┘  │
│           │                    │            │            │
│  ┌────────┴───────┐  ┌────────┴──────┐  ┌──┴──────────┐│
│  │ TAURON FORK    │  │ Native        │  │ Sidecars    ││
│  │ (patched Tauri)│  │ Services      │  │ Go, Python, ││
│  │ native_control │  │ USN Indexer   │  │ Kain, Node  ││
│  │ native_buffer  │  │ Windows       │  │             ││
│  │ native_stream  │  │ Daemon        │  │             ││
│  └────────────────┘  └───────────────┘  └─────────────┘│
└─────────────────────────────────────────────────────────┘
```

### The Three-Layer Stack

1. **Presentation Layer** (TypeScript/React)
   - App shell, explorer UI, terminal, settings, panels
   - Zustand for persisted state
   - CSS variables for theming
   - Framer Motion for shell transitions (not explorer rows)

2. **Host Layer** (Rust/Tauri)
   - Filesystem operations, search, indexing
   - Media engines (audio via CPAL/Symphonia, video via ffmpeg)
   - GPU runtime (wgpu compute for thumbnails, waveforms, spectrograms)
   - Native task graph for cancellable background work
   - Extension host for polyglot runtimes

3. **Transport Layer** (Tauron Fork)
   - `native_control`: compact JSON control plane for metadata/actions
   - `native_buffer_pool`: finite shared-buffer lane for directory snapshots and preview bytes
   - `native_stream`: live byte stream for terminal output and search results
   - `message_ring`: bounded replay-capable message rings for host events

---

## The Tauron Fork

GreebleFS does not use stock Tauri. It uses **Tauron**, a sibling fork of the entire Tauri 2 framework located at `D:/tauron` (hardcoded path in the repo workspace configuration).

### Why Tauron Exists

Stock Tauri's IPC model is built around JSON serialization of every payload through `invoke()` calls. This is fine for configuration and metadata, but it falls apart for GreebleFS's performance-critical data flows:

- **Directory listings** with 100,000+ files would require serializing a massive JSON array
- **Preview bytes** for images, PDFs, and video frames would base64-encode through JSON
- **Terminal output** streams would need per-chunk event emission
- **Search results** streaming large batches would saturate the event bus

Tauron adds three native transport primitives that bypass JSON entirely:

| Primitive | Purpose | Direction |
|-----------|---------|-----------|
| `native_control` | Compact JSON RPC for metadata, actions, and handle creation | Bidirectional |
| `native_buffer_pool` | WebView2 shared-buffer lease for large binary snapshots | Host → WebView |
| `native_stream` | Live byte stream for terminal output, search batches | Host → WebView |
| `message_ring` | Bounded, replay-capable ring buffers for event history | Host → WebView |

### What Gets Patched

In the root `Cargo.toml`, the `[patch.crates-io]` section overrides every core Tauri crate:

```toml
[patch.crates-io]
tauri = { path = "../tauron/crates/tauri" }
tauri-build = { path = "../tauron/crates/tauri-build" }
tauri-codegen = { path = "../tauron/crates/tauri-codegen" }
tauri-macros = { path = "../tauron/crates/tauri-macros" }
tauri-plugin = { path = "../tauron/crates/tauri-plugin" }
tauri-runtime = { path = "../tauron/crates/tauri-runtime" }
tauri-runtime-wry = { path = "../tauron/crates/tauri-runtime-wry" }
tauri-utils = { path = "../tauron/crates/tauri-utils" }
```

Similarly, the JS `@tauri-apps/api` package is consumed from the fork:

```json
"@tauri-apps/api": "file:../tauron/packages/api/dist"
```

The fork also includes **first-party Tauron plugins** consumed by GreebleFS:
- `tauri-plugin-windowmgr` — native window management and HWND attachment for owned-window proofs
- `tauri-plugin-kain` — Kain language bridge for semantic UI and lattice authoring
- Dev observatory — native telemetry, performance snapshots, and CDP attach support

### The Preflight Guard

A script at `scripts/tauron-preflight.mjs` runs before every Cargo-backed command (`tauri dev`, `tauri build`, `bindings:generate`). It verifies:
1. The sibling `../tauron` workspace exists
2. Required core crate manifests are present
3. The JS API `dist/` is fresh (checked against generated outputs, not metadata)
4. If stale on Windows, it shells `pnpm build:api` through `cmd.exe` before proceeding

This prevents cryptic compilation errors when the fork is missing or outdated.

---

## The `/usr` Folder System

`/usr` is the **shipped authoring root** for all runtime-discovered content. It is the canonical place to author themes, appearance packs, icon themes, plugins, shaders, animations, sound packs, layout presets, hotkeys, menu packs, and performance manifests — as data, not code.

### Layout Philosophy

```
usr/
├── manifest.json              # Source of truth for every managed lane
├── README.md                  # Operator map for shared vs profile lanes
│
├── profiles/                  # Profile system
│   ├── catalog.json           # Active profile registry
│   ├── variants.json          # Named seed variations
│   ├── shared/
│   │   └── settings.json      # Machine-global settings baseline
│   └── default/               # Canonical shipped profile baseline
│       ├── settings.json      # Profile-local settings
│       ├── explorer-performance/
│       ├── explorer-rail-trees/
│       ├── explorer-mode-profiles/
│       ├── explorer-chrome-layouts/
│       ├── explorer-shell-layouts/
│       ├── explorer-workspace-layouts/
│       ├── explorer-customize-controls/
│       ├── explorer-experimental-modes/
│       ├── explorer-zoom-behaviors/
│       ├── shell-customize-controls/
│       └── hotkeys/
│
├── appearance-packs/          # Visual tokens (color, typography, spacing, etc.)
├── interaction-motion/        # Micro-interaction profiles
├── layout-dynamics/           # Solver/surface physics presets
├── theme-recipes/             # Workbench, explorer, mobile, dock recipes
├── theme-engines/             # Thin composition manifests
├── themes/                    # 30+ theme bundles (bundle-first orchestration)
├── icon-themes/               # VS Code-style icon packages
├── sound-packs/               # Shell audio packs
├── top-bars/                  # Data-driven top bar definitions
├── shaders/                   # Authored shader modules
├── animations/                # Authored animation modules
├── wallpapers/                # Imported media + live wallpaper modules
├── lookdev-presets/           # Shared lookdev system presets
├── menu-packs/                # Explorer context-menu structure definitions
├── actions/                   # Pack-first action definitions
├── domain/                    # Rust domain presets and derived metadata
├── explorer-widgets/          # Explorer widget packages
├── plugins/                   # Package plugins (React + Wasm + assets)
├── plugins-kain/              # Kain-authored plugins
└── packages/                  # Shared library packages
    ├── greeblefs-ui/          # @greeblefs/ui (DCC controls, layouts)
    └── greeblefs-plugin-tools/ # @greeblefs/plugin-tools (file/state helpers)
```

### Shared-Root vs Profile-Overlay

Every managed-content lane is classified as either **shared-root** or **profile-overlay**:

- **Shared-root** lanes (top-level `usr/<lane>`) stay global across all profiles. Examples: themes, icon themes, appearance packs, plugins, sound packs, shaders, animations, wallpapers.

- **Profile-overlay** lanes (`usr/profiles/default/<lane>`) are intentionally profile-specific. Examples: settings, hotkeys, explorer layouts, explorer performance manifests, chrome layouts, menu packs.

The resolution chain is: **active profile → canonical baseline → bundled fallback**. This means users can override profile-scoped content without affecting shared global resources, and each profile has its own settings, layouts, and hotkey bindings.

### Settings Pipeline

1. `usr/profiles/shared/settings.json` + `usr/profiles/default/settings.json` define the shipped first-run baseline
2. `src/config/usrDefaultSettings.ts` imports those files and builds the effective canonical default snapshot
3. `src/store/settingsStore.ts` uses that snapshot as the canonical `defaultSettings`
4. `src-tauri/src/usr_profiles.rs` handles splitting and persisting shared-vs-profile settings at runtime

New product defaults should be authored in `/usr`, not hardcoded in the Zustand store.

### Profile Variations

The system ships four seed variations:
- `canonical-default` — mirrors the shipped baseline exactly
- `focused-authoring` — dense, quieter authoring defaults
- `review-presentation` — preview-first demo and browsing defaults
- `minimal-low-motion` — reduced motion and shell noise

These are partial overrides, not full settings files. They only change the slices they intentionally differ on.

---

## Full Flow: How Everything Is Wired Up

### Startup Flow

```
1. User launches greeblefs.exe / bun run tauri dev
   │
2. run-platform-tauri.mjs (canonical Tauri launcher)
   ├── Kills stale GreebleFS dev processes
   ├── Runs tauron-preflight.mjs (verifies D:/tauron fork)
   ├── Stages Go runtime assets
   ├── Builds mobile share bundle
   ├── Runs Specta bindings generation (missing-only)
   ├── Stages Kain toolchain payload
   ├── Injects MCP/dev-session environment variables
   ├── Writes session truth to MCP/.state/
   │   ├── tauri-dev-session.json (wrapper truth)
   │   ├── tauron-webview2-session.json (WebView/CDP truth)
   │   └── greeblefs-native-automation.json (native RPC truth)
   └── Launches @tauri-apps/cli tauri dev
       │
3. Tauri BeforeDevCommand: scripts/run-frontend-dev.mjs
   ├── Syncs canonical icons
   ├── Starts Vite dev server (programmatic API)
   ├── Warms critical entrypoints (App.tsx, FileExplorer.tsx, etc.)
   └── Listens on localhost:1420
       │
4. Rust host compiles and boots
   ├── lib.rs registers plugins, state, and commands
   ├── linux_graphics.rs applies NVIDIA/WebKit workarounds
   ├── usr_profiles.rs loads profile catalog
   ├── dev_observatory.rs initializes dev telemetry
   ├── native_task_graph.rs starts task executor
   └── Creates WebView2 window pointing at Vite dev URL
       │
5. Frontend bootstrap (src/main.tsx)
   ├── Reads window descriptor (main, picker, file-operations, etc.)
   ├── Installs React Aria OverlayProvider
   ├── Installs dev bridge (window.__GREEBLEFS_DEV_MCP__)
   ├── Installs react-scan in dev/MCP mode
   └── Renders App component
       │
6. App.tsx initialization
   ├── Hydrates Zustand stores from Tauri plugin-store
   ├── Loads managed content catalog from usr/
   ├── Resolves active theme bundle
   │   ├── appearance pack → CSS variables
   │   ├── interaction motion → pointer bindings
   │   ├── layout dynamics → solver physics
   │   ├── theme recipe → workbench/explorer recipes
   │   ├── icon theme → file/folder/UI icon mappings
   │   ├── top bar → header control layout
   │   ├── wallpaper → background layer
   │   ├── shader → background/border FX
   │   ├── animation → shell transition modules
   │   └── sound pack → shell audio cues
   ├── Loads plugin catalog (usr/plugins + usr/plugins-kain)
   ├── Registers panels in panelRegistry.tsx
   ├── Mounts default explorer at greeblefs://home
   └── Renders shell with resolved theme
```

### Explorer Navigation Flow

```
1. User navigates to a folder (double-click, address bar, rail, etc.)
   │
2. FileExplorer.tsx → loadCachedExplorerLocation(path, showHidden)
   │
3. explorerDirectoryCache.ts (React wrapper)
   └── explorerBackend.ts (typed TS bridge)
       │
4. Try: native_control (explorer.list_location)
   │   → native_buffer_pool shared buffer with directory snapshot
   │   → native_pool_snapshots.rs decodes GFLS binary format
   │   → Fallback: fs_list_dir invoke (Specta/JSON)
   │
5. Path index acceleration (Windows)
   ├── Path warm in explorerPathIndex.ts
   ├── Indexed snapshot from GreebleFSUsnIndexer daemon
   │   → greeblefs-index-core crate (SQLite v2, MFT enumeration)
   │   → USN journal tailing for live change detection
   └── Falls back to live directory listing
       │
6. explorerVisibleEntries.ts shapes the listing
   ├── Tag filtering
   ├── Dir-first sorting
   ├── Worker-hosted compute for large folders
   └── Direct fast path for default name/asc view
       │
7. explorerViewportThumbnailScheduler.ts
   ├── Bounded work lane with priority ordering
   ├── Hover → visible → forward-prefetch → backward-prefetch
   └── Throttled through explorerPerformance manifest caps
       │
8. explorerThumbnailArtifactRuntime.ts
   ├── Batched native_control thumbnail artifact reads
   ├── IPC resource descriptors
   ├── entityId + contentRevision identity cache
   └── Legacy data-URL fallback
       │
9. React renders virtualized file list
   ├── @tanstack/react-virtual for windowing
   ├── CSS transitions for layout changes (no Framer Motion)
   ├── Native scrollbar (no JS scroll simulation)
   └── Compositor-owned scrolling with native physics
```

### Preview Flow (Opening a File)

```
1. User clicks a file → FileExplorer.tsx resolves preview
   │
2. explorerPreviewRegistry.ts
   ├── Collects built-in + plugin preview lane candidates
   ├── Sorts by priority
   ├── Matches entry against lane rules (extension, MIME, etc.)
   └── Returns canonical descriptor
       │
3. Workbench selection (explorerWorkbenches.ts)
   ├── Saved user default for normalized extension
   ├── Priority-based built-in selection
   └── Plugin contribution precedence
       │
4. Preview lane mounts
   │
   ├── Image → ExplorerImageEditor.tsx
   │   ├── Preview tab: pannable/zoomable stage
   │   ├── Edit tab: CropperJS filter/crop deck
   │   └── Cutout tab: AI-powered subject isolation
   │       → Backend: image_cutout_commands.rs → Python sidecar
   │
   ├── Video → ExplorerVideoEditor.tsx
   │   ├── Preview-first: <video> from asset URL
   │   ├── MP4 proxy fallback on decode error (ffmpeg)
   │   ├── Edit mode: trim/inspector workbench
   │   └── Transport: video_engine.rs (CPAL/Symphonia audio link)
   │
   ├── Audio → ExplorerAudioWorkbench.tsx
   │   ├── Preview tab: playback-first surface
   │   ├── Edit tab: waveform/spectral editor, DAW-style fades
   │   ├── VST tab: compact plugin lane (VST3 via crates/vst-host)
   │   └── Engine: audio_engine.rs (CPAL stream, Symphonia decode, rubato resampling)
   │
   ├── PDF → ExplorerPdfWorkbench.tsx
   │   ├── Page-by-page rendering (Pdfium)
   │   ├── Page-space overlay annotations + AcroForm edits
   │   └── Save/writeback: pdf_commands.rs
   │
   ├── Text/Code → ExplorerMonacoCodeView.tsx
   │   └── Monaco editor with theme integration
   │
   ├── Python → ExplorerPythonWorkbench.tsx
   │   ├── Code-first: Edit tab + Run + Runtime tabs
   │   └── Managed execution: pythonRuntimeBackend.ts
   │
   ├── Spreadsheet → ExplorerSpreadsheetWorkbench.tsx
   │   ├── Preview: themed table surface
   │   └── Edit: Glide Data Grid + HyperFormula
   │
   ├── SQLite → ExplorerSqlitePreview.tsx
   │   └── SQL query + table preview
   │
   ├── Shader → ExplorerShaderWorkbench.tsx
   │   └── WebGPU preview + diagnostics
   │
   ├── 3D Model → Plugin workbenches
   │   ├── greeblefs-workbench-model3d (Three.js, broader format support)
   │   └── greeblefs-workbench-bevy-model3d (Bevy/Wasm, wgpu PBR for GLB)
   │
   └── Archive → virtual greeblefs://archive route
       ├── archive_ops.rs: ZIP, TAR, 7z, Gzip, Bzip2, XZ
       ├── Materialize-on-demand: entries staged as real files
       └── Preview lanes read from staged real paths
```

### Theme Resolution Flow

```
1. User selects a theme (Settings → Themes, or theme bundle default)
   │
2. settingsStore.applyThemeSelection(themeId)
   │
3. themePackages.ts discovers and loads theme bundle
   ├── themes/<bundle>/theme.json (orchestration manifest)
   │   ├── appearancePackId → usr/appearance-packs/<id>/tokens/*.json
   │   ├── interactionMotionPackId → usr/interaction-motion/<id>/tokens/*.json
   │   ├── themeRecipeId → usr/theme-recipes/<id>/*.json
   │   ├── themeEngineId → usr/theme-engines/<id>/manifest.json
   │   ├── iconThemeId → usr/icon-themes/<id>/manifest.json
   │   ├── topBarId → usr/top-bars/<id>/top-bar.json
   │   ├── wallpaperId → usr/wallpapers/<id>
   │   ├── shaderId → usr/shaders/<id>
   │   ├── openAnimationId → usr/animations/<id>
   │   ├── closeAnimationId → usr/animations/<id>
   │   ├── soundPackId → usr/sound-packs/<id>
   │   └── homePackId → Home pack selection
   │
4. Appearance tokens → CSS variables
   ├── uiTokenContract.ts normalizes token categories
   │   ├── color → --gfs-ui-color-*
   │   ├── typography → --gfs-ui-font-*
   │   ├── spacing → --gfs-ui-space-*
   │   ├── radius → --gfs-ui-radius-*
   │   ├── border → --gfs-ui-border-*
   │   ├── shadow → --gfs-ui-shadow-*
   │   ├── opacity → --gfs-ui-opacity-*
   │   ├── blur → --gfs-ui-blur-*
   │   ├── geometry → --gfs-ui-geom-*
   │   └── layer → --gfs-ui-layer-*
   │
5. Workbench recipe → workbenchTheme.ts
   ├── Shell chrome treatment
   ├── Command palette chrome
   ├── Terminal chrome + renderer mode
   ├── Settings chrome
   └── Workbench-scoped CSS vars
   │
6. Explorer recipe → explorerTheme.ts
   ├── Chrome style
   ├── Breadcrumb style
   ├── Preview panel chrome
   ├── Status bar visibility
   ├── Rail position + brand label
   ├── Entry hover/selection behavior
   ├── Grid/list/table metrics
   └── Explorer-scoped CSS vars
   │
7. Icon theme → iconTheme.ts
   ├── File extension → icon ID mapping
   ├── Folder name → icon ID mapping
   ├── UI icon slot → icon ID mapping
   └── Merge with built-in canonical icon map
   │
8. Top bar → WorkbenchTopBar.tsx
   ├── Leading controls (launcher, navigation)
   ├── Navigation shortcuts
   ├── Trailing controls (window controls, status)
   └── Active renderer awareness (custom themes suppress parts)
```

### Plugin Activation Flow

```
1. App startup / user Refresh in Plugins Manager
   │
2. pluginPackages.ts scans:
   ├── usr/plugins/<id>/extension.toml (or plugin.json)
   │   ├── packageKind: "plugin" | "library"
   │   ├── source visibility: open | hybrid | compiled | private
   │   ├── dependencies with id, version, importAs, required
   │   ├── exports.modules for library packages
   │   ├── contributions:
   │   │   ├── previewLanes → register preview workbenches
   │   │   ├── settingsSlots → register Settings UI sections
   │   │   ├── workflows → register explorer modal workflows
   │   │   ├── views → register explorer view modes
   │   │   ├── widgets → register explorer chrome widgets
   │   │   ├── activityLanes → register explorer activity rail items
   │   │   ├── mobilePanes → register mobile PWA tabs
   │   │   └── commands → register command-palette actions
   │   └── panelRuntime for Wasm-backed panels
   │
   ├── usr/packages/<id>/extension.toml (libraries)
   │   └── Source-importable by default
   │
   └── usr/plugins-kain/<id>/plugin.kn (Kain plugins)
       ├── Normalized into same catalog
       └── Rendered through KainPluginWorkbenchHost.tsx
   │
3. Dependency graph resolution
   ├── Required deps must exist and be enabled
   ├── Circular dependencies rejected
   ├── Disabled plugins blocked from runtime
   └── source-private plugins blocked from imports
   │
4. Runtime mounting
   ├── useFolderPluginRuntime.ts binds execution context
   │   ├── api.index → indexed filesystem search
   │   ├── api.workflows → explorer workflow bridge
   │   ├── api.host.files → privileged file lane
   │   ├── api.openPanel → docked panel open
   │   ├── api.openWindowedPanel → native tear-off
   │   └── api.dockWindowedPanel → dock-back
   │
   ├── pluginRuntime.tsx executes sandboxed module graph
   │   ├── Package-local relative imports
   │   ├── Declared dependency bare imports
   │   ├── Host bridge: overlayterm-plugin
   │   └── Sandboxed: lucide-react → AppIcons.tsx
   │
   └── WasmPanelHost.tsx for wasm-panel runtimes
       ├── Go/TinyGo: wasm_exec.js
       ├── Rust: cargo-wasm-bindgen JS module
       ├── Unique data-bridge-token per mount
       └── Bridge token → window.__greeblefsRuntimeHostBridge
```

### Native Task Graph Flow

```
1. Explorer requests background work (scan, thumbnail, preview read)
   │
2. native_task_graph.rs
   ├── Loads policy from usr/profiles/default/explorer-performance/
   ├── Bounded queue pressure per lane
   ├── Stable priority/FIFO ordering per lane
   ├── Per-lane concurrency caps
   │   ├── DirectoryScan: concurrent scans
   │   ├── ThumbnailDecode: parallel thumbnail generation
   │   ├── PreviewRead: shared preview byte reads
   │   └── Archive: archive entry staging
   ├── Stale work-key generation cancellation
   ├── Parent/child cancellation metadata
   └── Timing/counter telemetry → dev observatory
       │
3. Work execution
   ├── submit_blocking for CPU-bound filesystem work
   ├── submit_async for IO-bound work
   └── Cooperative cancellation tokens for long tasks
       │
4. Results flow back through Specta events or native_control
```

---

## Technology Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| **React 19** | UI framework for the shell and all components |
| **TypeScript 5.8** | Type-safe development across the entire frontend |
| **Vite 7** | Build tool and dev server |
| **Zustand 5** | Lightweight state management (settings, explorer, terminal, etc.) |
| **Tailwind CSS 4** | Utility-first CSS framework |
| **@tanstack/react-virtual** | Virtualized file lists for huge directories |
| **Monaco Editor** | Code editing (text/shader preview lanes) |
| **xterm.js 6** | Terminal emulation with WebGL renderer |
| **Three.js** | 3D model preview (fallback workbench) |
| **Framer Motion** | Shell-level animations (not used on hot paths) |
| **React Aria 3.48** | Accessible UI primitives (select, modal, overlay) |
| **Floating UI** | Anchored popup positioning |
| **tweakpane** | Compact inspector for lookdev |
| **CropperJS** | Image crop/filter surface |
| **Glide Data Grid** | Spreadsheet editing |
| **HyperFormula** | Spreadsheet engine |
| **Tiptap/ProseMirror** | Rich text editing (notes) |
| **Culori** | Color math and theme token normalization |
| **Zod 4** | Schema validation for manifests and settings |

### Backend (Rust)
| Technology | Purpose |
|------------|---------|
| **Tauri 2 (Tauron fork)** | Desktop application framework |
| **Tokio** | Async runtime for all backend work |
| **Specta** | TypeScript binding generation from Rust commands |
| **wgpu** | GPU compute for thumbnails, waveforms, spectrograms |
| **CPAL + Symphonia** | Audio playback engine (no browser audio) |
| **ffmpeg** | Video proxy generation and media codec bridge |
| **Pdfium** | PDF rendering and AcroForm manipulation |
| **Tantivy** | Full-text search index |
| **SQLite (rusqlite)** | Explorer identity, path index, semantic search index |
| **VST3 (crates/vst-host)** | Audio plugin host |
| **Pyo3** | Embedded Python for lightweight in-process helpers |
| **Windows API** | NTFS USN journal, MFT enumeration, shell context menus |

### Polyglot Runtimes
| Runtime | Compiler | Use Case |
|---------|----------|----------|
| **Python** | Virtualenv + stdio JSON sidecar | AI inference, image cutout, model management, semantic search |
| **Go** | go-native, go-js-wasm | Native sidecars, Wasm panels |
| **TinyGo** | tinygo-wasm | Lightweight Wasm panels |
| **Rust/Wasm** | cargo-wasm-bindgen | Bevy 3D model viewer |
| **Kain** | kain-script | Semantic UI graph, lattice authoring, plugin workbenches |
| **Node** | node-script | VS Code extension bridge host |

### Transport (Tauron Fork)
| Transport | Use |
|-----------|-----|
| **Specta/JSON** | Configuration, metadata, small payloads |
| **native_control** | Compact JSON RPC for explorer actions, handle creation |
| **native_buffer_pool** | Directory snapshots (GFLS binary), preview bytes |
| **native_stream** | Live terminal output, search result streaming |
| **message_ring** | Host events with replay capability |
| **IPC resources** | Opaque artifact handles (thumbnails, media) |

---

## Key Subsystems

### 1. File Explorer (`FileExplorer.tsx`)
The crown jewel. A virtualized, multi-pane, multi-view-mode file explorer that supports:
- Grid, list, and table views with adaptive density
- Inline preview pane (image, video, audio, PDF, text, code, spreadsheets, SQLite, shaders, 3D models)
- Archive browsing (ZIP, 7z, TAR, GZ, BZ2, XZ) as virtual directories
- Experimental folder views: adaptive-semantic-grid, constellation, timeline-surface
- Drag-and-drop with native OS integration
- Multi-pane workspace (1-Up through 4-Up) with independent tabs
- Activity rail with search, semantic, tasks, and plugin lanes
- Explorer Home surface at `greeblefs://home`
- Full context menu system with authored menu packs, action packs, and native Windows shell menus
- Tags, bookmarks, saved searches
- Copy/move with collision detection and resolution policies

### 2. Theme Engine
A complete design-token pipeline:
- Bundle-first orchestration: one manifest composes many standalone packs
- CSS custom properties for every visual token
- Separate workbench, explorer, and mobile recipe layers
- Icon theming: file/folder mappings + UI icon overrides
- Render styles: mapped to live interaction runtimes (tabs, cross-axis, channel, desktop)
- Top bars: data-driven catalog, moveable controls
- Layout dynamics: physics-based repulsion/spring solver for explorer chrome
- Interaction motion: micro-interaction profiles for surface hover/press behavior
- Wallpapers: imported media + authored live wallpaper modules
- Shaders: background/border shader surfaces (CSS + canvas)
- Sound packs: shell audio cues
- 30+ shipped theme bundles including the Official Pilot Suite

### 3. Plugin System
A sandboxed, dependency-graph-aware package plugin runtime:
- Package-local module graph with relative imports
- Declared dependencies with version matching
- Source visibility gates (open, hybrid, compiled, private)
- Host bridge with files, events, selection, explorer, preview, tasks, terminal, repo services
- Sandboxed `lucide-react` → `AppIcons.tsx` resolution
- Shared library packages: `@greeblefs/ui` (DCC controls), `@greeblefs/plugin-tools`
- VSIX extension discovery: maps `contributes.viewsContainers` into Explorer activity lanes
- Kain plugin lane: parallel Kain-authored plugins with Fabric multi-runtime pipelines

### 4. Polyglot Runtime Pipeline
A unified extension host supporting six runtime families:
- Content-addressed compile cache with source fingerprinting
- Runtime discovery from `src-go/builtin-runtimes/`, `src-node/builtin-runtimes/`, `src-kain/runtimes/`, and managed-content `runtimes/`
- Sidecar lifecycle with host-call/host-response nested packets
- Wasm panel mounting with unique bridge tokens per instance
- Terminal service for Go/Wasm panels (spawn, write, resize, shell integration)
- Ambient execution context: cwd, selection, preview state, repo context

### 5. Native Task Graph
A Rust-native bounded executor for cancellable background work:
- Scan-class, directory-list misses, thumbnail-decode, preview-read, archive lanes
- Stable priority/FIFO ordering per lane
- Per-lane concurrency caps
- Stale work-key cancellation by generation
- Cooperative cancellation tokens
- Timing/counter telemetry fed to dev observatory

### 6. GPU Runtime
A wgpu compute offload subsystem:
- One long-lived device/queue
- Adapter capability probing with safe/integrated/discrete tier resolution
- Workloads: image thumbnails, image editor preview, audio waveform reduction, spectrogram rasterization
- CPU fallback on every path

### 7. Cross-Provider Acceleration
A control plane above GPU + Python CUDA:
- Composes native wgpu snapshot with Python-sidecar CUDA/Torch/ONNX probing
- Routing-mode-aware workload assignment
- `preferCuda` as preference, not guarantee

### 8. Windows Path-Index Acceleration
NTFS-level directory listing acceleration:
- `greeblefs-index-core` crate: SQLite schema v2, MFT enumeration, USN journal operations
- `greeblefs-usn-daemon`: LocalSystem Windows service on 127.0.0.1:12462
- Drive-root index builds directly into SQLite
- USN journal tailing for live change detection
- App stays unelevated; service handles privileged NTFS access

### 9. Media Engines
Native playback that bypasses browser media:
- **Audio**: CPAL output stream + Symphonia decode (ffmpeg fallback) + rubato resampling
- **Video**: ffmpeg for proxy generation; browser `<video>` for playback
- **PDF**: Pdfium page raster + AcroForm extraction/writeback
- **VST3**: crates/vst-host for plugin scanning and parameter editing

### 10. Terminal
An integrated terminal with multiple deployment modes:
- Preview-embedded terminal
- Bottom drawer terminal
- Side-dock terminal lane
- xterm.js with WebGL renderer (hardware-probed)
- Native byte stream for live output (Tauron native_stream)
- IPC message ring for fallback and replay
- Shell integration for cwd sync (OSC markers)
- Profile-aware shell launch (shellPath, shellArgs)

### 11. Git Panel
Source control integrated into the shell:
- Repo rail with working-tree staging
- Diff actions and ship controls
- History and branch browsing
- Commit patch loading

### 12. Storage Panel
Storage forensics and cleanup:
- Drive context rail
- Matrix-first workspace with treemap
- Split map/types/focus modes
- Scroll-safe inspector
- Native drive scans (logical vs allocated size, file-type buckets)
- Batch cleanup queue

### 13. Notes Workspace
A folder-first markdown workspace:
- Explorer-like sidebar tree
- Tiptap rich markdown editor
- Context-menu/dialog flows
- Coalesced autosave/flush
- Backend: filesystem operations through explorer runtime

### 14. Mobile Companion
A browser-safe PWA surface:
- Separate Vite entrypoint (`vite.mobile.config.ts`)
- Served by Axum over LAN/mobile sharing
- Explorer, Search, Transfers, Settings tabs
- Plugin-contributed mobile panes
- HTTP control plane for desktop host access
- Tailscale integration for remote access

### 15. Dev MCP Automation
A standalone MCP server for agents and automated testing:
- Compact router tool surface (gfs_*, gfs_kain)
- Native CDP attach to live Tauri WebView
- DOM snapshots, UI actions, screenshots
- Host schema/RPC/event access
- Agent coding context (branch, dirty files, memory, architecture)
- Performance flow snapshots
- Windows-native window capture fallback

### 16. Tauron WindowMgr
First-party executable embedding:
- Launch external Windows processes
- Attach HWND to GreebleFS window
- Keep external window following a React-owned rectangle
- Native coordinate conversion (physical pixels for legacy, host-local for DirectComposition)

### 17. Wayland Dock
A dedicated layer-shell dock host for Linux:
- Separate webview using gtk-layer-shell
- Anchored panel behavior (Yakuake-style)
- Independent from main app window
- Frontend routing between main and dock hosts

### 18. Kain Integration
A polyglot authoring language embedded in GreebleFS:
- Semantic UI graph: live theme/chrome/layout/motion/settings data
- UI scaffold: Kain-authored surface structure, the host renders
- Lattice: QML-like package/component/host-model catalog
- FFI catalog: Python, Node, C, Rust, Tauri, Wasm, SPIR-V bridges
- Plugin lane: parallel Kain-authored plugins with Fabric pipelines
- Bridge through Tauron's tauri-plugin-kain

---

## Project Structure

```
GreebleFS/
├── src/                       # Frontend TypeScript/React source
│   ├── App.tsx                # Main shell orchestrator (~8,500 lines)
│   ├── main.tsx               # Entry point, window descriptor routing
│   ├── App.css                # Shell-level CSS
│   ├── components/            # UI components
│   │   ├── FileExplorer.tsx   # Core explorer (~30k lines)
│   │   ├── explorer/          # Explorer sub-components
│   │   │   ├── ExplorerWorkspace.tsx      # Multi-pane workspace shell
│   │   │   ├── ExplorerSideRail.tsx       # Drive/bookmark rail
│   │   │   ├── ExplorerActivityRail.tsx   # Utility pane rail
│   │   │   ├── ExplorerDockLayoutAdapter.tsx
│   │   │   ├── ExplorerSearchLane.tsx
│   │   │   ├── ExplorerSemanticLane.tsx
│   │   │   ├── explorerDirectoryCache.ts
│   │   │   ├── explorerPreviewRegistry.ts
│   │   │   ├── explorerPreviewSystem.ts
│   │   │   ├── explorerPreviewCache.ts
│   │   │   ├── explorerEditSession.ts
│   │   │   ├── explorerMenuRuntime.ts
│   │   │   ├── explorerCommandLibrary.tsx
│   │   │   ├── explorerImageStage.ts
│   │   │   ├── explorerWidgetRuntime.tsx
│   │   │   ├── explorerWorkflowContracts.ts
│   │   │   ├── ExplorerWorkflowModal.tsx
│   │   │   ├── ExplorerWorkflowPrimitives.tsx
│   │   │   └── ExplorerBuiltInWorkflowViews.tsx
│   │   ├── ExplorerCollectionPreviewSurface.tsx
│   │   ├── ExplorerImageEditor.tsx
│   │   ├── ExplorerImageCutoutSurface.tsx
│   │   ├── ExplorerVideoEditor.tsx
│   │   ├── ExplorerAudioWorkbench.tsx
│   │   ├── ExplorerPdfWorkbench.tsx
│   │   ├── ExplorerPythonWorkbench.tsx
│   │   ├── ExplorerShaderWorkbench.tsx
│   │   ├── ExplorerSpreadsheetWorkbench.tsx
│   │   ├── ExplorerSqlitePreview.tsx
│   │   ├── ExplorerDocxWorkbench.tsx
│   │   ├── TerminalOverlay.tsx      # Terminal shell
│   │   ├── terminal/                # Terminal sub-components
│   │   ├── WorkbenchTopBar.tsx      # Shell top bar
│   │   ├── WorkbenchIdeShell.tsx    # IDE dock-graph shell
│   │   ├── WorkbenchNavigationSurface.tsx
│   │   ├── CommandPalette.tsx       # Global command palette
│   │   ├── SettingsPage.tsx         # Settings entry surface
│   │   ├── SettingsPageLegacy.tsx   # Deep settings compatibility
│   │   ├── settings/                # Settings sections
│   │   ├── StoragePanel.tsx         # Storage forensics
│   │   ├── GitManager.tsx           # Source control
│   │   ├── NotesManager.tsx         # Notes workspace
│   │   ├── notes/                   # Notes sub-components
│   │   ├── PluginsManager.tsx       # Plugin browser
│   │   ├── pluginRuntime.tsx        # Plugin sandbox
│   │   ├── WasmPanelHost.tsx        # Wasm UI host
│   │   ├── PluginWasmRuntimeSurfaces.tsx
│   │   ├── home/                    # Explorer Home surface
│   │   ├── lookdev/                 # Lookdev overlay
│   │   ├── layoutDynamics/          # Layout physics canvas
│   │   ├── wallpaperRuntime.tsx     # Wallpaper layer
│   │   ├── animationRuntime.tsx     # Shell animation loader
│   │   ├── AppModal.tsx             # Modal/overlay primitives
│   │   ├── AppSelect.tsx            # Themed select/dropdown
│   │   ├── AppIcons.tsx             # Icon compatibility layer
│   │   ├── OverlayScrollArea.tsx    # Themed scrollbar
│   │   └── DevPerformanceHud.tsx    # Dev diagnostics HUD
│   ├── config/                 # Configuration, normalization, loaders
│   │   ├── appearance.ts           # Theme model + CSS variable injection
│   │   ├── workbenchTheme.ts       # Workbench recipe resolution
│   │   ├── explorerTheme.ts        # Explorer recipe resolution
│   │   ├── themePackages.ts        # Theme bundle discovery
│   │   ├── themeBundlePacks.ts     # Modular pack loaders
│   │   ├── uiTokenContract.ts      # CSS variable contract
│   │   ├── iconTheme.ts            # Icon theme resolution
│   │   ├── iconThemePackages.ts    # Icon package discovery
│   │   ├── topBars.ts              # Top bar catalog
│   │   ├── topBarPackages.ts       # Top bar package loader
│   │   ├── interactionMotion.ts    # Micro-interaction profiles
│   │   ├── layoutDynamics.ts       # Layout physics config
│   │   ├── layoutProfiles.ts       # Shell-blueprint normalization
│   │   ├── ideWorkbenchLayout.ts   # IDE dock-graph state
│   │   ├── pluginPackages.ts       # Plugin discovery/aggregation
│   │   ├── plugins.ts              # Legacy plugin loader
│   │   ├── explorerPerformance.ts  # Hot-path policy loader
│   │   ├── explorerContextMenu.ts  # Menu command graph
│   │   ├── menuPacks.ts            # Menu pack loader
│   │   ├── actionPacks.ts          # Action pack loader
│   │   ├── explorerCustomizeCatalog.ts  # Chrome control catalog
│   │   ├── explorerChromeLayouts.ts     # Chrome layout resolver
│   │   ├── explorerShellLayouts.ts      # Pane layout resolver
│   │   ├── explorerModeProfiles.ts      # Explorer mode registry
│   │   ├── explorerRailTree.ts          # Rail root-tree loader
│   │   ├── explorerWidgets.ts           # Widget package loader
│   │   ├── explorerWorkbenches.ts       # Workbench arbitration
│   │   ├── previewWorkbenchChrome.ts    # Preview chrome contract
│   │   ├── explorerZoomBehavior.ts      # Zoom/gesture tuning
│   │   ├── explorerArchives.ts          # Archive registry
│   │   ├── explorerViewModes.ts         # View mode config
│   │   ├── filePreview.ts               # Preview MIME/heuristic helpers
│   │   ├── hotkeys.ts                   # Hotkey catalog loader
│   │   ├── soundPacks.ts                # Sound pack discovery
│   │   ├── wallpapers.ts                # Wallpaper resolution
│   │   ├── python.ts                    # Python runtime config
│   │   ├── localModels.ts               # Model catalog
│   │   ├── semanticSearch.ts            # Semantic search config
│   │   ├── accelerationRuntime.ts       # Acceleration routing
│   │   ├── gpuRuntime.ts                # GPU tier policy
│   │   ├── appContentDirectories.ts     # Managed content paths
│   │   ├── usrManifest.ts               # /usr manifest bridge
│   │   ├── usrDefaultSettings.ts        # Shipped defaults
│   │   ├── settingsNavigation.ts        # Settings section catalog
│   │   ├── dockPresentations.ts         # Dock presentation loader
│   │   ├── dockTerminalGrid.ts          # Dock terminal sizing
│   │   ├── workbenchRenderRuntime.ts    # Render runtime resolver
│   │   ├── workbenchPerformance.ts      # Adaptive effects policy
│   │   ├── schemaSanitizers.ts          # Zod validation layer
│   │   └── colorUtils.ts                # Culori color helpers
│   ├── runtime/                # Tauri/backend bridge + runtime logic
│   │   ├── explorerBackend.ts           # Filesystem/search/task bridge
│   │   ├── explorerPathIndex.ts         # Durable path-index client
│   │   ├── explorerNativePool.ts        # Native buffer pool facade
│   │   ├── explorerNativeStreams.ts     # Native byte stream facade
│   │   ├── explorerVisibleEntries.ts    # Visible-entry compute
│   │   ├── explorerThumbnailArtifactRuntime.ts
│   │   ├── explorerCollectionPreviewThumbnails.ts
│   │   ├── boundedWorkLane.ts           # Bounded work-lane runtime
│   │   ├── explorerViewportThumbnailScheduler.ts
│   │   ├── explorerViewportPreviewPrefetchScheduler.ts
│   │   ├── explorerWorkflowBridge.ts    # Explorer workflow events
│   │   ├── explorerExtensionContext.ts  # Execution context builder
│   │   ├── tauriClient.ts              # Typed Specta event facade
│   │   ├── nativeControl.ts            # native_control facade
│   │   ├── ipc/                        # IPC transport adapters
│   │   ├── workerHost.ts               # Web Worker orchestrator
│   │   ├── moduleRuntime.ts            # Authored module compiler
│   │   ├── usrProfiles.ts              # /usr profile overlay runtime
│   │   ├── usrProfileStaticConfigRuntime.ts
│   │   ├── extensionHostApi.ts         # Extension host client
│   │   ├── pluginPanelRequests.ts      # Plugin panel handoff
│   │   ├── pluginIndexApi.ts           # Plugin index adapter
│   │   ├── useFolderPluginRuntime.ts   # Plugin runtime binding
│   │   ├── externalRuntimeBackend.ts   # Polyglot runtime bridge
│   │   ├── goRuntimeBackend.ts         # Go runtime convenience layer
│   │   ├── nativeSurface.ts            # Native surface control
│   │   ├── windowHost.ts              # Main vs dock routing
│   │   ├── windowMgr.ts               # WindowMgr proof helpers
│   │   ├── secondaryWindows.ts         # Secondary window client
│   │   ├── devMcpBridge.ts            # Dev automation bridge
│   │   ├── pythonRuntimeBackend.ts     # Python sidecar client
│   │   ├── modelManagementBackend.ts   # Model management client
│   │   ├── imageCutoutBackend.ts       # Image cutout client
│   │   ├── audioWorkbenchBackend.ts    # Audio engine client
│   │   ├── videoEngineBackend.ts       # Video engine client
│   │   ├── pdfPreviewBackend.ts        # PDF session client
│   │   ├── shaderPreviewBackend.ts     # Shader compile client
│   │   ├── spreadsheetWorkbook.ts      # SheetJS + HyperFormula bridge
│   │   ├── gitPanelBackend.ts          # Git runtime seam
│   │   ├── storageBackend.ts           # Storage scan bridge
│   │   ├── globalSearchBackend.ts      # Global search bridge
│   │   ├── notesWorkspaceBackend.ts    # Notes filesystem backend
│   │   ├── modelThumbnailBackend.ts    # 3D model thumbnail bridge
│   │   ├── gpuRuntimeBackend.ts        # GPU runtime client
│   │   ├── accelerationRuntimeBackend.ts # Acceleration client
│   │   ├── soundEffects.ts             # Sound playback runtime
│   │   ├── layoutDynamicsRuntime.ts    # Layout physics solver
│   │   ├── lookdevRuntime.ts           # Lookdev bridge
│   │   ├── lookdevEvents.ts            # Lookdev event bus
│   │   ├── actionBackend.ts            # Action execution client
│   │   ├── vscodeBridgeBackend.ts      # VS Code bridge client
│   │   ├── goExplorerPolicyService.ts  # Go policy sidecar client
│   │   └── ...                         # Kain UI graph/scaffold/lattice bridges
│   ├── store/                  # Zustand persisted state stores
│   │   ├── settingsStore.ts            # Settings, theme, layout state
│   │   ├── explorerStore.ts            # Explorer sessions, workspace, chrome
│   │   ├── explorerTaskStore.ts        # Task history + progress
│   │   ├── globalSearchStore.ts        # Palette search state
│   │   ├── audioEngineStore.ts         # Audio engine snapshot
│   │   ├── videoEngineStore.ts         # Video engine snapshot
│   │   ├── gpuRuntimeStore.ts          # GPU runtime snapshot
│   │   ├── accelerationRuntimeStore.ts # Acceleration snapshot
│   │   ├── storageStore.ts             # Storage workbench state
│   │   ├── terminalStore.ts            # Terminal sessions
│   │   ├── lookdevStore.ts             # Lookdev session state
│   │   └── mobileShareStore.ts         # Mobile share state
│   ├── panels/                 # Panel registry and definitions
│   ├── windows/                # Secondary window apps
│   │   ├── PickerWindowApp.tsx          # Destination picker
│   │   └── FileOperationsWindowApp.tsx  # Task center popout
│   ├── proofs/                 # UI runner proofs
│   ├── test/                   # Vitest test suites
│   ├── animation/              # Shell animation + MoGraph toolkit
│   ├── types/                  # TypeScript type definitions
│   ├── contracts/              # IPC/runtime contracts
│   ├── vendor/                 # Vendored source (Tiptap)
│   └── generated/              # Specta-generated Tauri bindings
│
├── src-tauri/                  # Rust backend
│   ├── src/
│   │   ├── lib.rs                      # Plugin/state/command registration
│   │   ├── main.rs                     # Binary entry point
│   │   ├── fs_commands.rs              # Filesystem operations (huge)
│   │   ├── fs_commands_test_stub.rs    # Test-mode stub
│   │   ├── native_task_graph.rs        # Bounded task executor
│   │   ├── native_pool_snapshots.rs    # GFLS binary snapshot codec
│   │   ├── native_surface.rs           # wgpu composition backplane
│   │   ├── message_ring.rs             # Bounded replay rings
│   │   ├── preview_streaming.rs        # Chunked preview bytes
│   │   ├── archive_ops.rs              # Archive extraction/listing
│   │   ├── explorer_identity.rs        # Stable file identity (SQLite)
│   │   ├── explorer_path_key.rs        # Normalized path key
│   │   ├── explorer_pro_commands.rs    # Trash, tags, saved searches
│   │   ├── desktop_integration.rs      # OS icons, drag-out
│   │   ├── thumbnail_commands.rs       # Rich thumbnail generation
│   │   ├── image_commands.rs           # Image processing
│   │   ├── image_cutout_commands.rs    # AI cutout sessions
│   │   ├── audio_engine.rs             # CPAL/Symphonia audio engine
│   │   ├── audio_commands.rs           # Audio analysis/export (SoX)
│   │   ├── video_engine.rs             # Video transport engine
│   │   ├── video_commands.rs           # ffmpeg proxy/export
│   │   ├── pdf_commands.rs             # Pdfium PDF sessions
│   │   ├── shader_preview_commands.rs  # Shader inspection
│   │   ├── gpu_runtime/                # wgpu compute offload
│   │   ├── acceleration_runtime.rs     # Cross-provider acceleration
│   │   ├── global_search/              # Tantivy filename index
│   │   ├── semantic_search.rs          # Semantic search orchestrator
│   │   ├── indexing/                   # App-local indexing
│   │   ├── path_index_acceleration.rs  # Windows USN acceleration
│   │   ├── runtime_pipeline/           # Polyglot extension host
│   │   │   ├── extension_host.rs       # Canonical schema + permissions
│   │   │   ├── commands.rs             # Host-call dispatch
│   │   │   ├── sidecar.rs              # Sidecar lifecycle
│   │   │   ├── driver.rs               # Compiler driver
│   │   │   ├── discovery.rs            # Runtime discovery + sandbox
│   │   │   ├── cache.rs                # Content-addressed compile cache
│   │   │   ├── manifest.rs             # Runtime manifest parsing
│   │   │   └── host_events.rs          # Host event bus + context cache
│   │   ├── ipc_runtime/                # IPC transport layer
│   │   ├── secondary_windows.rs        # Secondary window manager
│   │   ├── window_commands.rs          # Window geometry/overlay
│   │   ├── wayland_dock.rs             # gtk-layer-shell dock
│   │   ├── linux_graphics.rs           # NVIDIA/WebKit workarounds
│   │   ├── usr_profiles.rs             # Profile management
│   │   ├── python_sidecar.rs           # Persistent Python sidecar
│   │   ├── python_commands.rs          # Python interpreter management
│   │   ├── python_pyo3.rs              # Embedded Python helpers
│   │   ├── storage_commands.rs         # Storage drive scans
│   │   ├── cloud_commands.rs           # Cloud drive operations
│   │   ├── remote_storage_commands.rs  # Remote storage ops
│   │   ├── action_commands.rs          # Action execution (pack-first)
│   │   ├── lan_share.rs                # Mobile share HTTP server
│   │   ├── lan_share/
│   │   │   ├── mobile.rs               # Mobile control plane
│   │   │   └── mobile_plugins.rs       # Mobile plugin bridge
│   │   ├── share_commands.rs           # Share operations
│   │   ├── open_with/                  # OS app association
│   │   ├── tailscale_commands.rs       # Tailscale integration
│   │   ├── domain_commands.rs          # Domain presets
│   │   ├── telemetry.rs                # Dev/release telemetry
│   │   ├── dev_observatory.rs          # Dev telemetry + loopback
│   │   ├── dev_mcp_native_automation.rs # MCP native automation server
│   │   ├── system_tray.rs              # Tray menu
│   │   ├── startup_commands.rs         # Startup preferences
│   │   ├── specta_bindings.rs          # Specta command export
│   │   ├── plugin_commands.rs          # Plugin backend actions
│   │   ├── sqlite_commands.rs          # SQLite operations
│   │   ├── screenshot_commands.rs      # Screenshot file ops (dormant)
│   │   ├── vst_commands.rs             # VST3 discovery
│   │   ├── vst_host_runtime.rs         # VST session bookkeeping
│   │   └── bin/
│   │       └── greeble.rs              # CLI: greeble ext inspect/build/pack/install
│   ├── Cargo.toml              # Tauri app dependencies
│   ├── tauri.conf.json         # Tauri config (main window only)
│   ├── build.rs                # Build script (env var injection)
│   ├── capabilities/           # Tauri v2 capability declarations
│   │   └── default.json
│   ├── icons/                  # App icons
│   └── windows/                # Windows-specific
│       ├── greeblefs-installer.nsi    # NSIS installer template
│       └── assets/                    # Installer art
│
├── crates/                     # Workspace Rust crates
│   ├── greeblefs-index-core/   # NTFS index core (SQLite v2)
│   ├── greeblefs-usn-daemon/   # Windows USN indexer service
│   ├── greeble-ipc-contracts/  # IPC contract definitions
│   ├── file-opening/           # Cross-platform file association
│   ├── file-opening-windows/   # Windows shell COM bridge
│   ├── file-opening-macos/     # macOS app association
│   ├── macos/                  # macOS-specific utilities
│   ├── overlay-contracts/      # Overlay shell contracts
│   ├── yazi-specta/            # Specta integration helpers
│   ├── vst-host/               # VST3 plugin host
│   ├── ffmpeg-suite-rs/        # ffmpeg bindings
│   ├── cuda/                   # CUDA integration
│   ├── fileexplorer/           # File explorer utilities
│   └── tauri-plugins/          # Source-controlled Tauri plugins
│
├── src-go/                     # Go runtime workspace
│   ├── sdk/
│   │   └── greeblefs-go/       # First-party Go SDK
│   │       ├── ipc/            # IPC protocol
│   │       ├── runtime/        # Runtime: sidecar, host services
│   │       ├── hostapi/        # Host API wrappers
│   │       └── panel/          # Panel bridge
│   ├── builtin-runtimes/       # Built-in Go runtimes
│   │   ├── echo-sidecar/       # Reference smoke runtime
│   │   ├── echo-command/       # Command runtime example
│   │   ├── sample-panel/       # Wasm panel smoke test
│   │   └── explorer-policy-service/  # Go policy service
│   └── go.work                 # Go workspace
│
├── src-python/                 # Python workspace
│   ├── greeblefs_sidecar/      # Managed sidecar package
│   ├── greeblefs-python-sidecar.json  # Sidecar manifest
│   ├── runtime.toml            # Runtime manifest (for unified registry)
│   └── GUIDE.md                # Python developer guide
│
├── src-kain/                   # Kain language workspace
│   ├── app/main.kn             # App-level Kain bridge
│   ├── stdlib/                 # Standard library
│   │   └── greeblefs/          # GreebleFS Kain vocabulary
│   ├── lattice/                # Lattice packages
│   ├── plugins/                # Kain plugin definitions
│   ├── ffi/                    # FFI bridges (Python, Node, C, Rust, etc.)
│   ├── runtimes/               # Kain runtimes (control-plane, etc.)
│   ├── reflection/             # Rust reflection bridge
│   ├── guides/                 # Kain documentation
│   └── ui/                     # Kain UI modules
│
├── src-mobile/                 # Mobile PWA source
│   ├── main.tsx                # Mobile entry point
│   ├── App.tsx                 # Mobile shell (~3,700 lines)
│   ├── mobileApi.ts            # HTTP API client
│   ├── mobileStore.ts          # Mobile-only Zustand store
│   ├── mobilePluginRuntime.tsx # Mobile plugin binding
│   └── sw.ts                   # Service worker
│
├── src-node/                   # Node runtime workspace
│   └── builtin-runtimes/
│       └── vscode-bridge-host/ # VS Code extension bridge
│
├── usr/                        # Shipped authoring root
│   ├── profiles/               # Profile system
│   ├── themes/                 # Theme bundles
│   ├── appearance-packs/       # Visual token packs
│   ├── interaction-motion/     # Micro-interaction packs
│   ├── theme-recipes/          # Workbench/explorer recipes
│   ├── theme-engines/          # Composition manifests
│   ├── icon-themes/            # Icon packages
│   ├── top-bars/               # Top bar definitions
│   ├── sound-packs/            # Sound packs
│   ├── shaders/                # Shader modules
│   ├── animations/             # Animation modules
│   ├── wallpapers/             # Wallpaper assets + modules
│   ├── lookdev-presets/        # Lookdev systems
│   ├── menu-packs/             # Context menu definitions
│   ├── actions/                # Action packs
│   ├── explorer-widgets/       # Explorer widgets
│   ├── layout-dynamics/        # Layout physics presets
│   ├── plugins/                # Package plugins
│   ├── plugins-kain/           # Kain plugins
│   ├── packages/               # Shared library packages
│   │   ├── greeblefs-ui/       # @greeblefs/ui (DCC controls)
│   │   └── greeblefs-plugin-tools/  # Plugin tooling
│   └── domain/                 # Rust domain presets
│
├── packages/                   # Reference + vendored code
│   ├── KOS/                    # KOS DCC suite (16 apps, 400+ Rust files)
│   ├── UI/                     # UI utilities (icon generator scripts)
│   ├── img-editor/             # Image editor reference
│   ├── vid-editor/             # Video editor reference
│   └── marmaduketoolbag/       # Toolbag utilities
│
├── runtimes/                   # Managed-content runtimes
│   └── bevy-model3d-viewer/    # Rust/Bevy Wasm 3D viewer
│
├── toolchains/                 # Toolchain manifests + private payloads
│   ├── go/
│   │   └── toolchains.json
│   └── kain/
│       └── toolchains.json
│
├── scripts/                    # Build, dev, install, proof scripts
│   ├── run-platform-tauri.mjs  # Canonical Tauri launcher (~1,400 lines)
│   ├── run-frontend-dev.mjs    # Vite dev server wrapper
│   ├── tauron-preflight.mjs    # Tauron fork freshness guard
│   ├── run-export-bindings.mjs # Specta binding generator
│   ├── run-tauron-ui-proof.mjs # UI runner proof harness
│   ├── perf/                   # Performance scanning scripts
│   ├── platform/               # Platform installers
│   ├── go/                     # Go toolchain scripts
│   ├── kain/                   # Kain staging scripts
│   ├── proofs/                 # Proof fixtures
│   ├── reference-tools/        # Reference scrubber
│   └── ...                     # Icon generators, audits, etc.
│
├── MCP/                        # Dev MCP automation subsystem
│   └── greeblefs-dev-mcp/      # MCP server + automation runtime
│       ├── src/                # MCP tools, runtime, capture
│       └── AGENT_USAGE.md      # Agent manual
│
├── Cargo.toml                  # Root Cargo workspace (with Tauron patches)
├── package.json                # npm package manifest
├── vite.config.ts              # Main Vite config
├── vite.mobile.config.ts       # Mobile PWA Vite config
├── vite.shared.ts              # Shared alias config (Tauron API)
├── tsconfig.json               # TypeScript config
├── architecture.md             # Architectural specification (1,186 lines)
├── memory.md                   # Developer session memory
└── README.md                   # This file
```

---

## Getting Started

### Prerequisites

- **Bun** 1.3.x (package manager and script runner)
- **Rust** 1.92+ (for the Tauri backend)
- **Go** (for Go runtime compilation, optional but recommended)
- **Python** 3.x (for the Python sidecar)
- **Node** 22+ (for MCP automation, `tsx`)
- **The Tauron fork** at `D:/tauron` (required for all Cargo-backed workflows)

### Development

```bash
# Install dependencies
bun install

# Bootstrap Go toolchain (optional)
bun run go:bootstrap

# Generate Specta Tauri bindings
bun run bindings:generate

# Start the dev server (frontend only, no Cargo)
bun run dev:frontend

# Start the full Tauri dev session
bun run tauri dev

# Stage Kain toolchain (required for release builds)
bun run kain:stage

# Build the mobile PWA companion
bun run build:mobile
```

### Running Tests

```bash
# Unit tests
bun run test:unit

# Browser tests
bun run test:browser

# Rust tests
bun run test:rust

# Runtime stack validation
bun run test:runtime-stack:quick

# UI runner proofs (fast, no Cargo compile)
bun run proof:ui

# Native icon smoke test
bun run test:proof:native-icons

# MCP doctor
bun run mcp:doctor

# All tests
bun run test:all
```

### Building for Release

```bash
# Windows
bun run release:windows:bundle
bun run release:windows:install

# Linux
bun run release:linux:install

# USN daemon (Windows only)
bun run usn:service:install
```

---

## Validation & Testing

GreebleFS has a multi-layered validation strategy:

### TypeScript/Vitest
- **~50+ test suites** covering stores, config, components, plugins, and runtime logic
- Node-environment tests for pure logic, config, and store seams
- Browser-environment tests for DOM-dependent explorer behavior (currently blocked by JSDOM ESM dependency issue)

### Rust Tests
- `cargo test --manifest-path src-tauri/Cargo.toml --lib` for unit tests
- `cargo test --manifest-path src-tauri/Cargo.toml global_search -- --nocapture`
- `cargo test --manifest-path src-tauri/Cargo.toml runtime_pipeline:: -- --nocapture`
- `cargo check --manifest-path src-tauri/Cargo.toml --lib` for compilation validation
- The Rust lib test uses a Windows-safe unit graph that excludes desktop/Tauri modules

### Go Tests
- `go test ./sdk/greeblefs-go/...` for SDK tests
- `go vet ./...` with `GOOS=js GOARCH=wasm` for Wasm runtimes

### Python Tests
- `python3 -m py_compile src-python/greeblefs_sidecar/*.py` for syntax validation
- `python3 -m unittest discover -s tests_python` for unit tests

### UI Proofs (Tauron UI Runner)
- Fast WebView-based proofs with no Cargo compilation
- `bun run proof:ui` — spoofed-filesystem smoke fixture
- `bun run proof:ui:usr` — `/usr` manifest imports
- `bun run proof:ui:explorer` — Exploror repository-picker proof

### MCP Smoke Tests
- `bun run mcp:smoke` — runtime proof harness
- `bun run mcp:doctor` — status/attach probe
- Agent coding context and performance flow snapshots

### End-to-End
- `bun run perf:explorer` — Playwright/CDP performance scanner
- `scripts/run-heartbeat-pass.mjs` — comprehensive heartbeat
- `scripts/validate-runtime-stack.mjs` — multi-runtime stack validation

---

## Design Principles

1. **All killer, no filler.** No text explanations in UI, no boxy bloated layouts. UI must be raw, compact, and only hold what it needs — especially panes, previews, and explorer surfaces.

2. **Data over code.** Themes, layouts, hotkeys, menu structures, performance policies, and chrome composition are authored as data in `/usr`, not as logic in TypeScript. The code normalizes and resolves; the data owns truth.

3. **Theme everything.** Every visual property, every surface metric, every interaction behavior, every sound cue is themable. If something looks hardcoded, it's a bug.

4. **Native where it matters.** Filesystem operations, media playback, GPU compute, and NTFS indexing stay in Rust. Browser APIs are for presentation, not for media truth.

5. **Bounded at every layer.** Task graphs have bounded queues. Message rings have bounded capacity. Preview caches have byte budgets. Worker lanes have concurrency caps. Nothing is unbounded by default.

6. **Fallback always works.** Every GPU path has a CPU fallback. Every native buffer pool read has an invoke fallback. Every native stream has an IPC stream fallback. The app degrades gracefully, never crashes silently.

7. **Plugin sandboxing is real.** Plugins cannot import undeclared dependencies, cannot escape their package root, cannot self-call the host bridge, and cannot access raw Tauri invokes. This is security architecture, not a wish.

8. **Compositor-owned scrolling.** The main file list uses native scrollbars with native physics. No JS scroll simulation, no `preventDefault()` wheel remapping, no Framer Motion on hot paths.

9. **Stale work is cancelled.** Navigation re-enters cancel in-flight directory loads. Task graph entries are cancelled by stale generation. Thumbnail batches are cancelled when the viewport shifts. Nothing from a previous folder poisons the current one.

10. **The fork exists for a reason.** When the framework IPC model is the bottleneck, you fix the framework. Tauron exists because stock Tauri's JSON-only transport cannot handle 100K+ file directories, live terminal streams, or large preview payloads without becoming the bottleneck itself.

---

## The Beauty of GreebleFS

What makes GreebleFS beautiful is not any individual feature — it's the **coherence of the whole**.

### Architecture as Art

The codebase is a textbook example of **sustained architectural thinking**. Every system has been thought through from first principles:

- The **transport layer** (native_control / native_buffer_pool / native_stream / message_ring) wasn't bolted on — it's a custom fork of the framework itself, designed to handle the specific data shapes of a file explorer.

- The **theme engine** isn't a pile of CSS variables — it's a composable pipeline from authored tokens through CSS custom properties through runtime recipes, with separate lanes for appearance, motion, layout physics, icon theming, chrome composition, sound design, and render styles.

- The **plugin system** isn't a `require()` hack — it has a dependency graph with version matching, source visibility gates, a sandboxed module runtime, and a typed extension-host schema shared across Rust, Go, TypeScript, and Kain.

- The **polyglot runtime pipeline** isn't six separate ad hoc integrations — it's a unified registry with content-addressed caching, compiler drivers, path sandboxing, and a single typed command surface.

### The Explorer as Center

The file explorer isn't a utility. It's the **first thing you see** (`greeblefs://home`). It has:
- A configurable activity rail (search, semantic, tasks, VS Code extensions)
- A movable, ZBrush-style chrome customize mode
- Virtual archive browsing that feels like a real folder
- A preview pane that can be an image editor, a video player, an audio workstation, a PDF annotator, a code editor, a spreadsheet, a database browser, a shader sandbox, or a 3D model viewer
- Multi-pane workspaces with independent tabs
- An extension context that feeds cwd, selection, preview, and repo truth to every plugin
- A context menu system that includes native Windows shell menus with real COM hierarchy

### The Scale of Ambition

This is a project that:
- Forked an entire desktop framework to get the right IPC primitives
- Wrote a Windows NTFS daemon that reads the MFT and tails the USN journal
- Built a GPU compute runtime for media workloads
- Created a cross-provider acceleration control plane (CPU, wgpu, CUDA)
- Authored a QML-like declarative UI language (Kain Lattice)
- Implemented a VS Code extension bridge so real extensions can run
- Shipped a mobile companion PWA with its own plugin system
- Built a dev MCP server so AI agents can inspect and test the live app
- Wrote 1,186 lines of dense architecture documentation
- And made all of it themable

### The Missing Tauron

The sibling `D:/tauron` fork is the **hidden foundation**. Without it, GreebleFS would be a slower, JSON-choked file explorer. With it, it can stream 100K directory entries across a shared buffer in milliseconds, pipe live terminal output through a native byte stream, and lease WebView2 shared buffers for preview payloads — all while the user scrolls smoothly through their files.

The fork boundary is intentionally clean: GreebleFS patches the core crates through Cargo and consumes the JS API from the fork's dist. When Tauron improves, GreebleFS benefits. When GreebleFS needs new transport primitives, they land in Tauron first and flow back through the patch.

### Why It Matters

GreebleFS proves that a desktop file explorer can be:
- **Beautiful** without being shallow
- **Fast** without being bare
- **Extensible** without being insecure
- **Themeable** without being inconsistent
- **Ambitious** without being incoherent

It is a workbench built by someone who refused to accept the limitations of existing tools and decided to build the whole stack — framework, renderer, theme engine, plugin system, runtime pipeline, and all — from the ground up, with every layer designed to work together.

---

*GreebleFS — the file explorer as a workbench, the workbench as a shell, the shell as a canvas.*
