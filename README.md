# GreebleFS

<p align="center">
  <img src="https://img.shields.io/badge/Release-v0.2.0--workbench-blue.svg?style=for-the-badge&logo=tauri" alt="Release v0.2.0-workbench">
  <img src="https://img.shields.io/badge/Architecture-Tauron%20Native%20Fork-00e5ff.svg?style=for-the-badge" alt="Tauron Native Fork">
  <img src="https://img.shields.io/badge/Engine-Rust%20%7C%20wgpu%20%7C%20React%2019-ff6d00.svg?style=for-the-badge" alt="Rust wgpu React">
  <img src="https://img.shields.io/badge/Filesystem-USN%20MFT%20Fastpath-00e676.svg?style=for-the-badge" alt="USN MFT Fastpath">
  <img src="https://img.shields.io/badge/Themes%20%26%20Packs-30%2B%20Lanes-d500f9.svg?style=for-the-badge" alt="30+ Theme Lanes">
  <img src="https://img.shields.io/badge/Polyglot-Rust%20%7C%20Go%20%7C%20Python%20%7C%20Kain%20%7C%20TS-7c4dff.svg?style=for-the-badge" alt="Polyglot Runtime">
</p>

### The Native Desktop Workbench: File Explorer × High-Density IDE Crossover
*A hyper-customizable, GPU-accelerated desktop workstation built on a custom zero-copy Tauri fork (`Tauron`), native Rust file engines, wgpu compute, and full polyglot plugin execution.*

> ⚡ **What is GreebleFS?** Forget basic file managers and bloated web wrappers. GreebleFS is an **entire desktop workbench** built from the ground up where the file manager *is* the operating environment. It combines the deep, high-speed directory mastery of Directory Opus with the full-bore workspace power of VS Code, wrapped in hardware-accelerated shaders, customizable shell chrome, and a zero-serialization native IPC engine.
>
> 🚀 **The Tauron Engine:** GreebleFS doesn't run on stock Tauri. It runs on **Tauron** (our sibling fork of Tauri 2) engineered with zero-copy shared buffers (`native_buffer_pool`), raw live byte streams (`native_stream`), and ring-buffered IPC for instant 100k+ file scans and live terminal streams.

> 📖 **Deep Dive Documentation:**
> - **[Architecture Spec (`architecture.md`)](architecture.md)** — Exhaustive 2,700-line deep dive into every subsystem, IPC contract, and thread model.
> - **[User Content System (`usr/README.md`)](usr/README.md)** — Guide to authoring themes, appearance packs, layout physics, top bars, and plugins.
> - **[Developer Memory (`memory.md`)](memory.md)** — Architectural evolution, decisions, and system history.

---

## 1. What GreebleFS Actually Is

Most operating systems treat the file explorer as an afterthought — a dumb, floating grid of icons you click through to launch "real" apps. **GreebleFS flips that inside out.**

The file explorer is not a sidecar utility. It is your **primary command deck**:

```
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │ GREEBLEFS WORKBENCH SHELL                                                   │
 │ ┌──────────┬──────────────────────────────────────┬───────────────────────┐ │
 │ │ ACTIVITY │ DUAL-PANE FILE EXPLORER              │ INTEGRATED WORKBENCH  │ │
 │ │ RAIL     │                                      │                       │ │
 │ │          │  📁 /src/components/                  │ 🛠️ Code (Monaco)      │ │
 │ │ 🔍 Search│  ├─ 📄 App.tsx          [8.5k lines] │ 🎨 DAW / Audio (VST3) │ │
 │ │ 🧭 Nav   │  ├─ 📄 FileExplorer.tsx [30k lines]  │ 🎬 Video Editor (MP4) │ │
 │ │ 🧠 Vector│  └─ 📁 usr/                          │ 🖼️ Image / AI Cutout  │ │
 │ │ 🧩 Ext   │     ├─ 🎨 themes/      (30+ bundles) │ 📊 Spreadsheets       │ │
 │ │ ⚡ Tasks │     ├─ 🔮 shaders/     (wgpu compute)│ 🗄️ SQLite Database    │ │
 │ │ ⚙️ Setup │     └─ 🔌 plugins/     (sandboxed)   │ 🧊 3D Models (PBR)    │ │
 │ ├──────────┴──────────────────────────────────────┴───────────────────────┤ │
 │ │ >_ NATIVE TERMINAL OVERLAY (xterm.js + Tauron raw byte streaming)       │ │
 │ └─────────────────────────────────────────────────────────────────────────┘ │
 └─────────────────────────────────────────────────────────────────────────────┘
```

- **Explorer as the Shell:** Launch directly into `greeblefs://home`. Your filesystem is the workspace canvas, with dual-pane views, virtual archive mounting (`.zip`, `.tar`, `.7z`), tabs, and live directory watching.
- **Full IDE & Media Workbenches Built In:** Click a file, and GreebleFS transforms right there into an IDE, audio DAW, video editor, or 3D viewport without ever leaving the explorer:
  - **Code:** Full Monaco editor with language servers, syntax highlighting, and theme integration.
  - **Audio DAW:** CPAL + Symphonia native audio pipeline, waveform/spectral views, DAW-style fades, and live **VST3 plugin hosting**.
  - **Video Studio:** High-performance preview engine, hardware decode with FFmpeg fallback, inspector deck, and trim tooling.
  - **Image & AI Cutout:** Pan/zoom stage, CropperJS deck, and one-click AI background removal via the Python sidecar.
  - **Data & Databases:** Native Glide Data Grid + HyperFormula spreadsheets and interactive SQLite query engines.
  - **3D & Shaders:** Hardware-accelerated Three.js and Bevy/Wasm PBR model viewports, plus live WebGPU shader workbenches.
- **Instant Dual-Surface Modes:** Hit a hotkey to toggle between the **full workbench shell** and a lightning-fast **drop-down Quake-style overlay dock** (`Yakuake`/`Guake`-style) sharing the exact same state, tabs, and filesystem data planes.

---

## 2. The Scale & The Engine

GreebleFS is an uncompromising engineering effort spanning over **200,000 lines of code** across five languages:

| Metric | Details |
|---|---|
| **Core Languages** | Rust (Host & Engines), TypeScript/React 19 (Shell), Go, Python, Kain |
| **Workspace Crates** | **17 native Rust crates** (`greeblefs-index-core`, `vst-host`, `audio-engine`, etc.) |
| **Tauri Framework** | Custom **Tauron fork** (vendored directly in repo at `tauron/`) patched at the crate level |
| **Windows Indexer** | Dedicated **NTFS MFT & USN Journal tailing service** for sub-millisecond lookups |
| **UI Core** | `App.tsx` (~8.5k lines), `FileExplorer.tsx` (~30k lines of dense frontend logic) |
| **User Space (`/usr`)** | 30+ Theme Bundles, 15+ Appearance Packs, Shaders, Sound Packs, Plugins |
| **Polyglot Sidecars** | Go (Wasm runtime), Python (AI/cutout), Kain (Lattice UI), Node (VS Code bridge) |

---

## 3. Why Stock Tauri Wasn't Enough: The Tauron Fork

Stock Tauri is great for lightweight apps, but its IPC model forces every single byte through JSON serialization strings. When you have a folder with **150,000 files**, stream 4K video frames, or tail massive live terminal streams, **JSON IPC chokes**.

GreebleFS solved this by integrating a custom in-tree fork of Tauri 2: **Tauron** (vendored directly in the repo at `tauron/`):

| Tauron Primitive | What It Does | Why It Dominates Stock Tauri |
|---|---|---|
| **`native_buffer_pool`** | WebView2 shared-memory zero-copy buffer leases | Transfers 100k+ file directory snapshots in milliseconds without base64 or JSON bloat. |
| **`native_stream`** | Raw native byte stream pipeline | Live streaming for xterm.js terminal shells and global search results directly into the UI. |
| **`native_control`** | High-density binary/JSON RPC control plane | Handles high-frequency UI commands and handle leases with near-zero latency. |
| **`message_ring`** | Bounded, replay-capable event rings | Ensures zero lost filesystem events, window mutations, or task graph changes. |

*Cargo and pnpm hook directly into the Tauron source tree, with automated preflight validation scripts (`scripts/tauron-preflight.mjs`) ensuring zero stale bindings.*

---

---

## 4. The Complete Workbench Matrix

GreebleFS ships built-in dedicated workbenches that mount natively when navigating or previewing files, turning the explorer into a domain-specific IDE on demand:

| Workbench | File Types / Triggers | Engine / Technologies | Key Superpowers |
|---|---|---|---|
| **Monaco Code IDE** | `.ts`, `.rs`, `.py`, `.go`, `.json`, `.md`, etc. | Monaco Editor + Language Server Bridge | Full syntax parsing, theme matching, fast code editing inside the directory tree. |
| **Audio DAW & VST3** | `.wav`, `.mp3`, `.flac`, `.ogg` | CPAL + Symphonia + `vst-host` crate | Native waveform & spectral display, DAW fades, live VST3 instrument/effect processing. |
| **Video Production Deck**| `.mp4`, `.webm`, `.mkv`, `.mov` | Hardware video engine + FFmpeg fallback | Scrubbing timeline, trim tool, frame stepping, CPAL/Symphonia audio sync. |
| **Image & AI Cutout** | `.png`, `.jpg`, `.webp`, `.svg`, `.psd` | WebGL canvas + Python sidecar (rembg/U2Net) | Pan/zoom stage, CropperJS filter decks, one-click subject isolation & transparent PNG export. |
| **Spreadsheet Lab** | `.csv`, `.tsv`, `.xlsx` | Glide Data Grid + HyperFormula engine | Real calculation graph, million-cell virtualization, formula parsing, instant sorting. |
| **Database Inspector**| `.db`, `.sqlite`, `.sqlite3` | Native SQLite driver | Live table schema viewer, dynamic SQL querying, paginated table data inspection. |
| **Shader Studio** | `.wgsl`, `.glsl`, `.frag` | `wgpu` + WebGPU preview canvas | Live GPU compilation, real-time uniform manipulation, and frame diagnostic HUD. |
| **3D Asset Viewport** | `.glb`, `.gltf`, `.obj`, `.fbx`, `.stl` | Three.js + Bevy/Wasm PBR engine | Physically-based rendering, orbit controls, material inspector, wireframe/normal overlays. |
| **PDF Workshop** | `.pdf` | Native Pdfium bridge | Multi-page virtualized rendering, overlay vector annotations, AcroForm interactive editing. |
| **Virtual Archive Mount**| `.zip`, `.tar`, `.7z`, `.gz`, `.xz` | `archive_ops.rs` virtual filesystem | Mounts archives as real browsable folder hierarchies with on-demand entry materialization. |

---

## 5. The `/usr` Data-Driven Architecture

In GreebleFS, **data owns truth, not hardcoded code**. Themes, UI layouts, hotkeys, contextual menus, performance caps, and chrome layouts live in `/usr` as editable JSON/manifest files. You can customize, swap, or fork the entire shell's behavior without recompiling a single line of Rust or TypeScript.

### Layout Hierarchy

```
usr/
├── manifest.json              # Canonical source of truth for all managed content lanes
├── README.md                  # Developer operator guide for shared vs profile lanes
│
├── profiles/                  # User profile and layout overlays
│   ├── catalog.json           # Active profile registry
│   ├── default/               # Shipped default profile baseline
│   │   ├── settings.json      # Profile-local settings
│   │   ├── explorer-performance/ # Hardware-tailored rendering & thumbnail limits
│   │   ├── explorer-chrome-layouts/ # Modular dock & rail layout configurations
│   │   └── hotkeys/           # Customizable keybinding matrices
│   └── variants.json          # Seed profiles (focused-authoring, review-presentation, etc.)
│
├── appearance-packs/          # Visual design tokens (palette, spacing, typography, borders)
├── interaction-motion/        # Micro-interaction timing, spring physics, and hover dynamics
├── layout-dynamics/           # Solver physics presets for panels and splitters
├── theme-recipes/             # Multi-layer recipes unifying workbench, explorer, and dock
├── themes/                    # 30+ Complete Theme Bundles (Cyberpunk, Nord, Solarized, Matrix, etc.)
├── icon-themes/               # Full file, folder, and UI glyph icon themes
├── sound-packs/               # Tactile UI audio cues (clicks, mount chimes, completion sounds)
├── top-bars/                  # Data-driven top bar layouts and quick-action toolbars
├── shaders/                   # Custom wgpu / WebGL background and glass shader effects
├── animations/                # Fluid shell transitions and dynamic state changes
├── wallpapers/                # Ambient dynamic canvas & live interactive wallpapers
├── menu-packs/                # Deep contextual right-click menu action trees
├── plugins/                   # Sandboxed plugin bundles (React + Wasm + assets)
└── plugins-kain/              # Semantic plugins authored in Kain
```

### Shared-Root vs Profile-Overlay

- **Shared-Root (`usr/<lane>`)**: Machine-global assets shared across all user profiles (Themes, Icon Themes, Appearance Packs, Plugins, Shaders, Sound Packs).
- **Profile-Overlay (`usr/profiles/<id>/<lane>`)**: User-specific or task-tailored configurations (Keybindings, Custom Chrome Layouts, Virtual Workspaces, Performance Manifests).

The resolution chain is rock-solid: **Active Profile $\to$ Canonical Baseline $\to$ Bundled Fallback**.

---

## 6. Architecture & Full Data Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                   PRESENTATION SHELL (React 19 + TS)                    │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────────┐ │
│  │   App.tsx    │ │ FileExplorer │ │ TerminalDeck │ │ Workbenches    │ │
│  │ (Shell State)│ │ (Dual-Pane)  │ │ (xterm.js)   │ │ (Monaco/DAW/3D)│ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └────────────────┘ │
│           │ Zustand Stores (Theme, Settings, Explorer, Navigation)     │
└───────────┼────────────────────────────────────────────────────────────┘
            │ ⚡ TAURON FASTPATH TRANSPORT (Bypasses stock JSON serialization)
            ├─► native_control      (Fast binary/JSON RPC control plane)
            ├─► native_buffer_pool  (WebView2 zero-copy memory leases)
            ├─► native_stream       (Unbounded live byte pipelines)
            └─► message_ring        (Replay-capable event history)
┌───────────▼────────────────────────────────────────────────────────────┐
│                    NATIVE RUST HOST (Tauri 2 Core)                     │
│  ┌──────────────┬──────────────┬──────────────┬──────────────────────┐ │
│  │ fs_commands  │ task_graph   │ audio_engine │ video_engine         │ │
│  │ (Fast IO)    │ (Cancellable)│ (CPAL/Symph) │ (Hardware/FFmpeg)    │ │
│  ├──────────────┼──────────────┼──────────────┼──────────────────────┤ │
│  │ global_search│ semantic_srch│ wgpu_runtime │ vst_host             │ │
│  │ (Multi-core) │ (Vector/LLM) │ (Compute)    │ (Live VST3 plugins)  │ │
│  └──────────────┴──────────────┴──────────────┴──────────────────────┘ │
│           │                    │                     │                 │
│  ┌────────▼────────┐  ┌────────▼────────┐   ┌────────▼───────────────┐ │
│  │ NTFS USN DAEMON │  │ POLYGLOT SIDECAR│   │ VIRTUAL ARCHIVE FS     │ │
│  │ Direct MFT Tail │  │ Go / Python /   │   │ In-memory staging of   │ │
│  │ Sub-ms indexing │  │ Kain / Node     │   │ ZIP, 7z, TAR, GZ, XZ   │ │
│  └─────────────────┘  └─────────────────┘   └────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Technology Stack

- **Native Host & Runtimes:** Rust 2021, Tauron (custom Tauri 2 fork), `wgpu` (WebGPU compute & rendering), CPAL / Symphonia / Rubato (pro audio), `vst-host` (VST3 plugin execution), FFmpeg, Pdfium.
- **Frontend & UI Engine:** React 19, TypeScript, Vite, Tailwind CSS, TanStack Virtual (infinite scrolling lists), Zustand (state management), Monaco Editor, Glide Data Grid, HyperFormula, Three.js, Bevy/Wasm.
- **Windows Acceleration:** Dedicated Windows Background Service reading the NTFS Master File Table (MFT) and tailing the Update Sequence Number (USN) journal with a SQLite v2 cache layer.
- **Polyglot Plugin Pipeline:**
  - **Go / TinyGo:** High-performance sandboxed Wasm extension panels and CLI tools.
  - **Python:** Managed local AI sidecar (background removal, media tagging, semantic vector embeddings).
  - **Kain:** First-class compilation and execution of declarative UI lattices and plugins.
  - **Node.js:** Extensible bridge running real VS Code marketplace extensions.

---

## 8. Getting Started

### Prerequisites

- **Node / Runtime:** [Bun](https://bun.sh/) (preferred) or Node.js v20+ with `pnpm`
- **Rust Toolchain:** Stable Rust (1.80+) with `cargo`
- **Tauron Engine:** In-tree vendored at `tauron/` (verified automatically during preflight)
- **C++ Build Tools:** Windows SDK & MSVC toolchain (on Windows) or standard `build-essential` (on Linux)

### Installation & Development

```bash
# Clone the repository
git clone https://github.com/your-org/greeblefs.git
cd greeblefs

# Install dependencies
bun install

# Verify the Tauron framework fork preflight
bun run tauron:preflight

# Start the full desktop dev session (launches frontend + Rust engine)
bun run tauri dev
```

### Fast Prototyping Modes

```bash
# Run frontend only with hot-reloading (ideal for UI/theme styling)
bun run dev:frontend

# Run Tauron UI proofs (instantly test components without compiling Rust)
bun run proof:ui
bun run proof:ui:explorer

# Stage the Kain compiler toolchain
bun run kain:stage

# Build the companion mobile PWA
bun run build:mobile
```

---

## 9. Testing & Quality Assurance

GreebleFS maintains a rigorous verification pipeline spanning unit tests, native proofs, and performance scanners:

```bash
# Run unit test suite (Vitest)
bun run test:unit

# Run native Rust crate tests
bun run test:rust

# Multi-runtime stack validation (Rust, Go, Python, Kain)
bun run test:runtime-stack:quick

# MCP Agent doctor & runtime attach probe
bun run mcp:doctor

# Full battery testing
bun run test:all
```

---

## 10. Design Tenets: All Killer, No Filler

1. **No Dumb File Managers:** If a tool only lists file names and icons, it's wasting your screen real estate. The explorer must be an active, high-density, multi-discipline IDE.
2. **Data Over Hardcoded Logic:** If you want to change a layout, color token, shortcut, or audio feedback, edit the JSON in `/usr`. Code normalizes; data dictates truth.
3. **Zero-Copy Where It Counts:** When moving 100k records, video frames, or audio buffers, JSON serialization is banned. Native shared memory leases do the heavy lifting.
4. **Resilient Degradation:** If `wgpu` hardware compute isn't present, fall back to optimized CPU SIMD. If the NTFS USN journal isn't accessible, fall back to live async directory enumeration. Never crash silently.
5. **Compositor-Owned Velocity:** The file list uses native compositor scrolling physics. No synthetic JavaScript scroll hijacking, no dropped frames during high-speed wheel navigation.

---

## 11. Key Subsystems Under the Hood

### 1. The Core File Explorer (`FileExplorer.tsx`)
The centerpiece of GreebleFS. A high-performance, virtualized, multi-pane filesystem surface featuring:
- **Adaptive Density:** Seamless switching between Grid, List, and Detail Table views.
- **Deep Inline Workbenches:** Instantly preview and edit images, videos, audio, PDFs, code, data spreadsheets, SQLite, shaders, and 3D assets.
- **Virtual Archive Mounting:** Browse `.zip`, `.tar`, `.7z`, `.gz`, `.xz`, and `.bz2` archives as native folders with on-demand staging.
- **Experimental Modes:** Constellation relational graph, adaptive-semantic-grid, and timeline-surface navigation.
- **Pro Explorer Tooling:** Tagging, deep bookmarking, saved search facets, multi-pane layouts (1-Up to 4-Up), and native Windows COM shell context menus.

### 2. The Composable Theme Engine
A full-stack, data-driven design token orchestration pipeline:
- **Orchestration Manifests:** One theme JSON orchestrates appearance packs, motion physics, icon themes, sound packs, and shaders.
- **CSS Custom Property Pipeline:** Over 100+ normalized CSS variables (`--gfs-ui-*`) controlling every millimeter of chrome, borders, typography, and elevations.
- **Physics-Based Layout Dynamics:** Real-time spring/repulsion solvers controlling dock behavior, rail collapse, and splitter movement.
- **Live Visual FX:** Background WebGPU glass shaders, dynamic interactive canvas wallpapers, and fluid shell transitions.
- **30+ Shipped Theme Bundles:** Including Cyberpunk, Nord, Solarized, Matrix, Tokyo Night, and the complete Official Pilot Suite.

### 3. The GreebleFS Extension API (`src/api/`, `import from 'greeblefs'`)
The single contract every extension speaks — plugin, theme, workbench, script. One TypeScript module, one factory, **no manifest files**. Full doc: [`src/api/README.md`](src/api/README.md).

```tsx
// usr/plugins/xmb/index.tsx — the code IS the manifest
import type { GreebleHarness } from 'greeblefs';
export default function (fs: GreebleHarness) {
  fs.registerCommand({ id: 'xmb-next', title: 'Next',
    run: (_a, ctx) => ctx.explorer.open(ctx.explorer.selection().paths[0]) });
  fs.registerViewMode({ id: 'xmb-row', title: 'XMB Row',
    appliesTo: { isDirectory: true }, component: ({ data, ctx }) => <XmbRow entries={data} ctx={ctx} /> });
  fs.on('file:before-open', e => e.size > 2_000_000 ? { block: true, reason: 'too large' } : undefined);
}
```

- **Three rules:** (1) registration is a verb — `fs.registerX()` at load time, never TOML/JSON; (2) context is injected — handlers receive a capability bag (`ctx`: `ui, explorer, paths, fs, index, settings, storage, shell, log, events`), not imports; (3) the core never changes — new domains, events, and context slices arrive via `declare module 'greeblefs'`.
- **25+ typed verbs, one escape hatch:** `registerShell|Theme|IconTheme|SoundPack|Shader|Motion|Animation|HomePack|MenuPack|Layout|Font|ViewMode|PreviewLane|ExplorerWidget|ActivityLane|Command|Action|ActionPack|ContextMenuItem|Hotkey|Workflow|Panel|SettingsSlot|Provider|Tool` — plus `register(domain, entry)` which works for ANY domain, known or not. Every verb returns a disposable `GreebleHandle`, so hot reload is a clean replace, never an accumulation.
- **Event spine + bus:** `fs.on(event, handler, { priority })` middleware chain — return `{ patch }` to mutate for the next handler, `{ block: true }` to cancel before-events (`file:before-open`, `explorer:before-action`, …). Inter-extension chatter rides namespaced bus channels (`fs.events.emit('pdf:rendered', …)`).
- **Sandboxed by capability:** per-extension tokens (`fs:read|write|watch`, `index:query`, `process:spawn`, `net:fetch`, `shell:panel|chrome`, `ui:overlay|notify`, `storage:*`, `settings:write`, `theme:override`) enforced by the host harness; legacy `definePlugin`/`extension.toml` and `defineThemeRenderer` TSX shims ride on top of the same verbs.
- **Kain + VS Code lanes:** Kain lattice plugins over zero-overhead FFI and VSIX manifests bridged into activity lanes speak the same harness.

### 4. Bounded Native Task Graph
Engineered to prevent UI starvation and out-of-memory crashes:
- Rust-native task executor managing scan-class, thumbnail decoding, archive unpacks, and directory walks.
- Per-lane concurrency caps with priority FIFO ordering.
- Cooperative generation-based cancellation tokens: when you navigate away, in-flight work for the previous directory is instantly cancelled.

### 5. Hardware-Accelerated wgpu Compute
- Dedicated `wgpu` compute pipeline offloading heavy calculations directly to your discrete GPU.
- High-speed parallel thumbnail generation, audio waveform decimation, and spectrogram rasterization.
- Automatic CPU SIMD fallback guarantees rock-solid reliability on low-power devices or headless setups.

---

## 12. Full System Flow & Life of an Action

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

### Plugin Activation Flow (GreebleFS Extension API — `src/api/`, `import from 'greeblefs'`)

> New extensions speak the harness, not manifests: default-export a factory `(fs: GreebleHarness) => void`, call `fs.registerX()` verbs, observe/patch/block via `fs.on(...)`. Legacy `extension.toml` / `definePlugin` / `defineThemeRenderer` packages are shimmed onto the same verbs. Full contract: [`src/api/README.md`](src/api/README.md).

```
1. App startup / user Refresh in Plugins Manager
   │
2. Host mints one harness per extension (host.ts: runGreebleExtension)
   ├── identity { id, version, entryPath, rootDir, capabilities, tags, meta }
   ├── shared GreebleDomainBookImpl + GreebleEventSpineImpl + GreebleExtensionBusImpl
   ├── per-extension entry store (appendEntry/getEntry — survives reload)
   └── lazy buildContext() → ctx { ui, explorer, paths, fs, index, settings, storage, shell, log, events }
   │
3. Factory runs → fs.registerX() verbs write into typed domain registries
   ├── shell/theme/iconTheme/soundPack/shader/motion/animation/homePack/menuPack/layout/font
   ├── viewMode/previewLane/explorerWidget/activityLane (explorer surfaces)
   ├── command/action/actionPack/contextMenuItem/hotkey/workflow (interaction)
   ├── panel/settingsSlot/provider/tool — or register(domain, entry) for ANY domain
   ├── every verb returns a GreebleHandle; dispose() withdraws it
   └── legacy scan still feeds the shims:
       ├── usr/plugins/<id>/extension.toml (or plugin.json) → shimmed verbs
       └── usr/plugins-kain/<id>/plugin.kn → normalized, rendered via KainPluginWorkbenchHost.tsx
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

## 13. Project Tree & Source Layout


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

## 14. The Beauty of GreebleFS

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

The vendored `tauron/` tree is the **hidden foundation**. Without it, GreebleFS would be a slower, JSON-choked file explorer. With it, it can stream 100K directory entries across a shared buffer in milliseconds, pipe live terminal output through a native byte stream, and lease WebView2 shared buffers for preview payloads — all while the user scrolls smoothly through their files.

The framework boundary is intentionally clean: GreebleFS patches the core crates in `Cargo.toml` (`[patch.crates-io]`) to point to `tauron/crates/*` and consumes the JS API from `tauron/packages/api/dist`. When Tauron improves, GreebleFS benefits. When GreebleFS needs new transport primitives, they land in Tauron first and flow back through the patch.

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
