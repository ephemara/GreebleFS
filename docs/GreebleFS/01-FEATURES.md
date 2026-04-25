# GreebleFS Feature Overview

GreebleFS is a premium desktop workbench built around a highly themeable file explorer, terminal overlay, and extensible shell system. This document provides a comprehensive overview of all major features and capabilities.

## Core Philosophy

GreebleFS is designed to feel like a world-class content browser and native desktop command center. The product philosophy emphasizes:

- **Shell First**: The shell is first-class; the explorer is the hero surface, not the whole app
- **Deep Theming**: Colors, typography, iconography, motion, shell chrome, render style, wallpaper, shader atmosphere, and layout behavior all matter
- **Transformable Presentation**: Layouts can materially change presentation without forcing a rewrite of domain logic
- **Native Truth**: Rust/Tauri owns filesystem truth, task truth, search truth, watcher truth, preview truth, and native integrations

---

## 1. Flagship File Explorer

The GreebleFS file explorer is the flagship surface of the application, inspired by Unreal Engine's Content Browser.

### UE5 Content Browser Inspiration

- Aggressive previewing with rich selection state
- Asset-first workflows designed for content creators
- Dockable panel architecture that feels like part of a larger editor shell
- Keyboard-first navigation with indexed jump capabilities

### Workspace Layouts

- **1-Up Mode**: Single pane for focused single-directory browsing
- **2-Up Mode**: Dual-pane workspace for side-by-side comparison and transfer operations
- **3-Up Mode**: Three-pane layout for complex navigation scenarios
- **4-Up Mode**: Four-pane maximum workspace for power users

Each workspace tab owns its own pane topology plus per-pane explorer sessions; pane switching does not swap the tab strip.

### View Modes

- **Grid View**: Icon-dense grid layout for visual file browsing
- **List View**: Compact list layout for rapid scanning
- **Constellation View**: Experimental orbit-band visualization (see Alternate Views)
- **Adaptive Semantic Grid**: Experimental density-adaptive grid layout

### Side Rail

The explorer side rail provides comprehensive navigation aids:

- **Drives**: Physical and virtual drive enumeration
- **Bookmarks**: User-defined quick-access locations with custom categories
- **Saved Searches**: Pre-configured search queries for recurring needs
- **Tag Filtering**: Browse and filter files by assigned tags
- **Custom Categories**: User-created bookmark organization with color coding

### Advanced File Operations

- **Drag and Drop**: Native OS-level drag with coalesced pointer updates for 120Hz smoothness
- **Batch Rename**: Pattern-based renaming with find/replace, numbering, prefix/suffix support
- **Duplicate Scanning**: Find duplicate files across the filesystem
- **Trash Management**: App-managed trash with restore capabilities
- **Tag Management**: Assign, remove, and filter by file tags
- **Saved Searches**: Persist complex search criteria for reuse

### Performance Optimizations

- Coalesced pointer drag updates through requestAnimationFrame
- Memoized drop-surface bindings by surface ID
- Cached element rects for current animation frame
- Cached normalized source-path validation context

---

## 2. Advanced Preview Lanes

GreebleFS provides comprehensive preview capabilities for various file types through specialized workbenches.

### Image Editor

- Full-featured raster editor with CropperJS integration
- Filter deck for adjustments
- Integrated cutout workflow
- Save/reset surface shared with ScreenshotsManager

### Image Cutout & Background Removal

- Prompt-first semantic segmentation
- Local mask editing with multiple tools:
  - **Spark**: Quick selection
  - **Sweep**: Sweep selection
  - **Soft Edge**: Edge softening
  - **Edge Pull**: Precise edge refinement
- Marching-ants overlay drawn from actual resolved selection boundary
- Preview-first lane with fullscreen subject stage

### Video Editor

- Playback-first preview surface
- Non-destructive trim export
- ffmpeg proxy generation for unsupported formats
- Loop-aware transport controls
- Integration with Rust video engine

### Audio Workbench

- Waveform and spectral visualization
- DAW-style fade edge handles
- VST plugin support with parameter control
- Loop/gain/rate control
- Offline export actions
- Spectrogram rendering
- Per-deck host for VST parameter edits

### PDF Workbench

- Single-page rendering with navigation
- Zoom and fit controls
- AcroForm editing support
- Page-space overlay annotations
- Rust PDF bridge for document truth

### Spreadsheet Editor

- Preview-first shell model (read-only until edit mode)
- Glide grid integration
- Formula bar
- Sheet management
- Same themed table-preview surface as SQLite lane

### Python Workbench

- Code-first editor (opens on Edit tab by default)
- Managed execution with structured stdout/stderr
- REPL handoff
- Runtime bootstrap/package maintenance
- Terminal fallback for script runs

### Shader Workbench

- WGSL/HLSL/SPIR-V editing
- WebGPU live preview when available
- Stage/entrypoint pickers
- Scene-mode controls
- Diagnostics output fallback

### SQLite Preview

- Themed table preview surface
- Dataset inspection
- Shared with spreadsheet preview

### Archive Preview

- Native extraction for multiple formats
- Virtual file browsing within archives
- Direct opening of archive contents

---

## 3. Terminal Overlay

The integrated terminal provides shell access within the workbench context.

### Architecture

- **Tree-Based Pane Model**: Multiple PTY instances with workspace-tab persistence
- **Shell Integration**: Native integration for cwd sync, prompt hooks, OSC markers
- **Reverse Sync**: Terminal cwd changes navigate the explorer

### Rendering Engine

- **xterm.js**: WebGL rendering with hardware probe
- **Software Fallback**: Graceful degradation when WebGL unavailable
- **Customizable Appearance**: Theme-driven chrome, metrics, and density

### Features

- Embedded preview terminal (separate from bottom drawer)
- Script execution routing
- Python REPL handoff
- Shell integration commands

---

## 4. Storage Forensics Panel

First-class storage analysis capabilities for system maintenance.

### Shell Architecture

- **Compact Scan Rail**: Left-side navigation with drives and context
- **Workbench Command Strip**: Slim command bar over main view
- **Unified Inspector**: Single right-side panel for all inspection needs

### Visualization

- **Treemap**: Deterministic SVG rectangles weighted by allocated bytes
- **Matrix View**: Dense storage table with sorting and filtering
- **Optional Modes**: Split-map, types view, focus modes

### Batch Operations

- **Cleanup Queue**: Staged trash/delete actions
- **Filter Controls**: Filter queue by various criteria
- **Batch Actions**: Bulk trash or delete operations

### Navigation

- Indexed jump/search within active storage scope
- Keyboard navigation
- Expandable tree paths

---

## 5. Notes Workspace

Folder-first markdown workspace for note-taking and documentation.

### Architecture

- Managed `notes/` root directory
- Explorer-like sidebar tree
- Shared context-menu and dialog flows
- Coalesced autosave/flush behavior

### Editor

- Tiptap-based rich markdown editor
- Local markdown extensions:
  - Blockquote styling
  - Code highlighting
  - Code block support
  - Hard break handling
  - Link processing

### Backend

- Filesystem-backed folder/document operations
- Local markdown summarization for post-save updates
- Integration with explorer runtime

---

## 6. Screenshots & Annotation

Comprehensive screenshot capture and editing system.

### Capture

- Monitor preview orchestration for multi-monitor setups
- Region selection
- Full-screen capture
- Window selection

### Annotation

- In-browser annotation authoring
- Rust-backed export
- Various annotation tools

### Gallery

- Screenshot library management
- Capture/editor/library surfaces
- Thumbnail generation
- Clipboard integration

---

## 7. Git Integration

Source control integration for developers.

### Features

- **Repo Rail**: Repository navigation and status
- **Working Tree**: Staging and diff viewing
- **Commit History**: Full commit history with metadata
- **Branch Management**: Branch switching and comparison
- **Changed Files**: Diff-aware file tracking
- **Patch Loading**: Full patch retrieval for commits

### Runtime

- Reusable runtime seam for history/branch metadata
- Structured commit data extraction
- Background loading for performance

---

## 8. Global Search & Indexing

Powerful search capabilities across the filesystem.

### Indexing Engine

- **Tantivy-Backed Index**: Native filename indexing
- **Priority-Path Fallback**: Fast results for important directories
- **Background Indexing**: Non-blocking index updates
- **Status Polling**: Real-time index status
- **Cancellation**: Stop indexing operations

### Search Modes

- **Name Search**: Filename matching
- **Content Search**: Full-text content search
- **Semantic Search**: AI-powered similarity search
- **Telemetry Tracking**: Query and mode-specific metrics

### Integration

- Command palette integration
- Indexed results display
- Fast navigation to results

---

## 9. Plugin System

Extensible plugin architecture for adding functionality.

### Frontend Runtime

- Allowlisted module graph
- Package-local relative imports
- Live reload in developer mode

### Plugin Capabilities

- **Commands**: Custom commands accessible from command palette
- **Explorer Actions**: Context menu and toolbar actions
- **Context Menu Items**: Custom context menu entries
- **Panels**: First-class panel registration
- **Themes**: Theme package contributions
- **Shaders**: Shader module contributions
- **Animations**: Animation module contributions

### Discovery & Management

- Folder-based discovery from `plugins/`
- Capability declarations (mesh_processing, gpu_compute, file_io, network)
- Resource limits per plugin:
  - Memory constraints
  - File handle limits
  - Operation time limits

---

## 10. Native Integrations

Platform-specific functionality for optimal desktop experience.

### Open With System

- Platform-specific file association resolution
- Native system picker fallback
- Run-as-admin support on Windows

### Desktop Integration

- Native icon resolution with size measurement
- Platform-specific helpers (Windows/Linux/macOS)
- Desktop file operations

### Display Server Support

- **Wayland**: Separate dock host with anchor/monitor positioning
- **X11**: Traditional X11 support
- **Linux Graphics**: Display server detection with fallback handling

### macOS Integration

- Native macOS-specific helpers
- Platform-optimized behaviors

---

## 11. Performance & Telemetry

Comprehensive performance monitoring and optimization systems.

### Frame Telemetry

- Live frame rate monitoring
- FPS tracking
- CLS (Cumulative Layout Shift) measurement
- INP (Interaction to Next Paint) tracking
- Long-task detection

### Worker Host

- Browser-worker orchestration
- Per-lane telemetry
- Task completion tracking
- Error monitoring

### Developer Tools

- **Performance HUD**: Dev-only diagnostics
- Memory tracking
- Worker status monitoring
- Navigation timing

### Adaptive Systems

- **Effects Tiers**: `full | reduced | minimal` based on platform/telemetry
- GPU tier policy: `auto | safe | integrated | discrete`
- Acceleration routing across providers

---

## 12. Developer Mode

Specialized features for application development.

### Live Reload Gates

- Plugin live reload
- Shader hot reloading
- Animation reloading
- Entry-size watching

### Debug Features

- Performance HUD visibility
- Telemetry export
- State inspection

---

## Summary

GreebleFS provides a comprehensive desktop workbench experience with:

- **Powerful File Management**: UE5-inspired explorer with advanced operations
- **Rich Preview Capabilities**: Specialized workbenches for images, video, audio, PDFs, and more
- **Integrated Terminal**: Shell access within the workbench context
- **Deep Customization**: Bundle-first theming system with modular components
- **Extensibility**: Plugin system with capability-based permissions
- **Platform Integration**: Native desktop features across Windows, Linux, and macOS
- **Performance Focus**: Optimized for 120Hz smoothness and responsiveness

The application is built on React 19 + TypeScript + Vite for the frontend, Tauri 2 + Rust for the native desktop host, and uses Yazi crates as the explorer engine substrate.