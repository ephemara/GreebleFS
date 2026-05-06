# GreebleFS Documentation

Comprehensive documentation for the GreebleFS desktop workbench.

## Overview

GreebleFS is a premium desktop workbench built around a highly themeable file explorer, terminal overlay, and extensible shell system. It combines the power of a native desktop application with the flexibility of a web-based interface.

## Architecture

GreebleFS is built on a multi-layered architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                      React Frontend                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Shell     │  │  Explorer   │  │   Terminal          │  │
│  │   App.tsx   │  │FileExplorer │  │   Overlay           │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │              │
│         └────────────────┼─────────────────────┘              │
│                          │                                    │
│                   ┌──────▼──────┐                            │
│                   │   Zustand   │                            │
│                   │   Stores    │                            │
│                   └──────┬──────┘                            │
│                          │                                    │
│                   ┌──────▼──────┐                            │
│                   │   Runtime   │                            │
│                   │   Services  │                            │
│                   └──────┬──────┘                            │
└──────────────────────────┼───────────────────────────────────┘
                           │
┌──────────────────────────┼───────────────────────────────────┐
│                      Tauri Backend                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Specta     │  │  Yazi       │  │   Rust              │  │
│  │  Bindings   │  │  Engine     │  │   Commands          │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │              │
│         └────────────────┼─────────────────────┘              │
│                          │                                    │
│                   ┌──────▼──────┐                            │
│                   │   Native    │                            │
│                   │   Features  │                            │
│                   └─────────────┘                            │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React 19 + TypeScript + Vite | UI rendering, state management |
| **State** | Zustand | Client-side state management |
| **Backend** | Tauri 2 + Rust | Native desktop integration |
| **IPC** | Specta | Type-safe Rust/TypeScript bridge |
| **Engine** | Yazi crates | File system operations |
| **Mobile** | Vite PWA + Axum | Mobile access via HTTP |

## Documentation Structure

### 1. Feature Overview

**[01-FEATURES.md](01-FEATURES.md)** - Comprehensive overview of all major features:

- Flagship File Explorer (UE5-inspired, dual-pane, advanced operations)
- Advanced Preview Lanes (Image, Video, Audio, PDF, Python, Shader)
- Terminal Overlay (xterm.js, shell integration)
- Storage Forensics Panel
- Notes Workspace
- Screenshots & Annotation
- Git Integration
- Global Search & Indexing
- Plugin System
- Native Integrations
- Performance & Telemetry
- Developer Mode

### 2. Theming System

**[02-THEMING-SYSTEM.md](02-THEMING-SYSTEM.md)** - Deep dive into the cutting-edge theming system:

- Bundle-First Architecture
- Modular Theme Lanes (Appearance, Top Bars, Icons, Wallpapers, Shaders, Animations, Sounds, Motion, Shell Renderers, Recipes, Engines, Home Packs, Menu Packs)
- VS Code Theme Compatibility
- Theme Catalog Curation
- Pilot Theme Defaults
- Theme Resolution Pipeline
- CSS Variable Contract
- Theme Development

### 3. Mobile & Tailscale

**[03-MOBILE-TAILSCALE.md](03-MOBILE-TAILSCALE.md)** - Mobile PWA and remote access capabilities:

- Mobile PWA Architecture
- Mobile Shell (Four-tab app: Explorer, Search, Transfers, Settings)
- Mobile API Endpoints
- Service Worker & Caching
- Tailscale Integration (MagicDNS, WireGuard encryption)
- LAN Share (mDNS Discovery, Direct Streaming)
- Mobile Push Notifications
- Mobile Preview System
- Upload/Download Queue
- Cross-Device Experience

### 4. Alternate Views & Experimental Modes

**[04-ALTERNATE-VIEWS.md](04-ALTERNATE-VIEWS.md)** - Advanced visualization and experimental features:

- Constellation View (Orbit-band spatial visualization)
- Experimental View Modes (Adaptive Semantic Grid, Density Adaptation)
- Explorer Runtimes (Standard, Constellation, Semantic, Minimal)
- Treemap Visualization (Storage forensics, layout algorithms)
- Explorer Chrome Layouts (Zone-based, adaptive)
- Explorer Mode Profiles (Balanced, Navigator, Focus, Inspector)
- Preview Workflow Tabs
- Context Menu Composition

### 5. GPU & CUDA Acceleration

**[05-GPU-CUDA.md](05-GPU-CUDA.md)** - High-performance computing capabilities:

- wgpu Integration (Native WebGPU compute, pipeline management)
- CUDA Support (ffmpeg acceleration, video processing)
- GPU Tier Policy (Adaptive effects based on hardware)
- Acceleration Routing (Cross-provider compute)
- Performance Monitoring (GPU metrics, frame telemetry)
- 3D Model Thumbnail Generation
- Shader Runtime (WGSL compilation)

## Key Concepts

### Shell First Philosophy

GreebleFS treats the shell as first-class, with the explorer as the hero surface. This means:

- The shell provides navigation, theming, and layout
- The explorer is one panel among many
- Panels can be docked, floated, or overlaid
- The entire application can be themed deeply

### Deep Theming

Unlike traditional theming that only changes colors, GreebleFS themes can transform:

- Colors and typography
- Iconography and visual language
- Motion and animation profiles
- Shell chrome and layout behavior
- Wallpaper and shader atmosphere
- Sound and audio cues
- Interaction patterns

### Native Truth

GreebleFS maintains a clear separation of concerns:

- **Rust/Tauri** owns filesystem truth, task truth, search truth, watcher truth, preview truth, and native integrations
- **Specta** provides typed bridges between Rust and TypeScript
- **TypeScript Runtime** orchestrates shell behavior
- **React** renders UI and pushes intents downward

### Runtime-Authored Content

GreebleFS supports runtime-discovered content:

| Content Type | Location | Purpose |
|--------------|----------|---------|
| **Themes** | `themes/` | Visual customization |
| **Plugins** | `plugins/` | Extensibility |
| **Shaders** | `shaders/` | Visual effects |
| **Animations** | `animations/` | Motion design |
| **Wallpapers** | `wallpapers/` | Background visuals |
| **Notes** | `notes/` | Markdown workspace |
| **Automations** | `automations/` | Workflow automation |

## Getting Started

### Installation

```bash
# Linux
bun run release:linux:install

# macOS
brew install greeblefs

# Windows
bun run release:windows:install
```

### Development

```bash
# Install dependencies
bun install

# Run development server
bun run dev

# Run Tauri development
bun run tauri dev

# Build for production
bun run build
```

### Running Tests

```bash
# Unit tests
bun run test:unit

# Browser tests
bun run test:browser

# Rust tests
bun run test:rust
```

## Configuration

### Settings Store

GreebleFS uses Zustand for state management with persisted settings:

```typescript
interface SettingsStore {
  appearance: AppearanceSettings;
  explorer: ExplorerSettings;
  terminal: TerminalSettings;
  python: PythonSettings;
  editor: EditorSettings;
  
  // Actions
  updateAppearance(settings: Partial<AppearanceSettings>): void;
  updateExplorer(settings: Partial<ExplorerSettings>): void;
  resetToDefaults(): void;
}
```

### Hotkeys

GreebleFS supports global, gesture, and local hotkeys:

```typescript
interface HotkeyBinding {
  key: string;
  label: string;
  description: string;
  defaultValue: string;
  scope: 'global' | 'gesture' | 'local';
}
```

## Performance

### Optimization Strategies

- **Coalesced Pointer Updates**: 120Hz drag smoothness
- **Virtualization**: Large list rendering
- **Lazy Loading**: On-demand component loading
- **Memoization**: React performance optimization
- **Worker Threads**: Background task processing
- **GPU Acceleration**: Compute-intensive operations

### Telemetry

GreebleFS collects performance telemetry:

- Frame rate and latency
- Interaction timing
- Search performance
- Memory usage
- GPU metrics

## Security

### Sandbox Model

- Tauri provides OS-level sandboxing
- Plugin capabilities are allowlisted
- File operations require explicit permissions
- Network access is controlled

### Encryption

- Tailscale provides WireGuard encryption
- Local storage is encrypted
- Credentials are stored securely
- HTTPS for all HTTP API endpoints

## Extending GreebleFS

### Creating Themes

1. Create a theme directory: `themes/my-theme/`
2. Add `theme.json` manifest
3. Add component folders as needed
4. Test with `bun run dev`

### Building Plugins

1. Create a plugin directory: `plugins/my-plugin/`
2. Add `plugin.json` manifest
3. Implement required capabilities
4. Register with the plugin system

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes
4. Run tests
5. Submit pull request

## Resources

- **Repository**: https://github.com/greeblefs/greeblefs
- **Documentation**: https://docs.greeblefs.app
- **Issues**: https://github.com/greeblefs/greeblefs/issues
- **Discord**: https://discord.gg/greeblefs

## License

GreebleFS is licensed under the MIT License. See LICENSE for details.

---

## Quick Reference

### File Structure

```
greeblefs/
├── src/                    # Frontend React application
│   ├── components/         # UI components
│   ├── config/             # Configuration files
│   ├── runtime/            # Runtime services
│   ├── store/              # Zustand stores
│   └── panels/             # Panel definitions
├── src-tauri/              # Tauri backend
│   └── src/                # Rust commands
├── crates/                 # Rust crates
├── themes/                 # Theme packages
├── plugins/                # Plugin packages
├── shaders/                # Shader modules
├── animations/             # Animation modules
├── wallpapers/             # Wallpaper content
└── docs/                   # Documentation
```

### Key Files

| File | Purpose |
|------|---------|
| `src/App.tsx` | Main shell application |
| `src/components/FileExplorer.tsx` | Flagship explorer |
| `src-tauri/src/fs_commands.rs` | Filesystem commands |
| `src/config/appearance.ts` | Theme configuration |
| `src/runtime/explorerBackend.ts` | Explorer runtime |
| `src/store/explorerStore.ts` | Explorer state |

### Commands

| Command | Description |
|---------|-------------|
| `bun run dev` | Start development server |
| `bun run tauri dev` | Start Tauri development |
| `bun run build` | Build for production |
| `bun run test:unit` | Run unit tests |
| `bun run test:browser` | Run browser tests |
| `bun run test:rust` | Run Rust tests |

---

For more details, see the individual documentation files in this directory.
