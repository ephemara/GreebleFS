# GreebleFS Alternate Views & Experimental Modes

GreebleFS provides multiple view modes and experimental features that extend beyond traditional file browsing. This document details the alternate views, experimental modes, and advanced visualization capabilities.

## Overview

While the standard grid and list views serve everyday file browsing needs, GreebleFS includes several alternate views for specialized use cases:

- **Constellation View**: Orbit-band visualization for spatial file organization
- **Experimental View Modes**: Adaptive and semantic grid layouts
- **Explorer Runtimes**: Multiple explorer implementations with switchable behavior
- **Treemap Visualization**: Storage forensics with size-weighted visualization

---

## Constellation View

### Concept

Constellation View provides a spatial, orbit-based visualization of file systems. Files are organized into "orbit bands" around a central anchor, creating a visual representation that emphasizes relationships and groupings.

### Visual Design

```
                    ┌─────────────────┐
                    │   📁 Projects   │
                    │    (Anchor)     │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
   ┌────▼────┐         ┌────▼────┐         ┌────▼────┐
   │📄 main.ts│        │📄 utils.ts│       │📄 types.ts│
   │  (Satellite)│     │  (Satellite)│     │  (Satellite)│
   └─────────┘         └─────────┘         └─────────┘
        │                    │                    │
   ┌────▼────┐         ┌────▼────┐         ┌────▼────┐
   │📄 index.ts│       │📄 helpers.ts│     │📄 interfaces.ts│
   │  (Satellite)│     │  (Satellite)│     │  (Satellite)│
   └─────────┘         └─────────┘         └─────────┘
```

### Orbit Band Structure

```typescript
interface ConstellationOrbitBand {
  id: string;
  label: string;
  description: string;
  dominant: boolean;      // Primary band (anchor)
  entries: FileEntry[];   // Files in this band
}

interface ConstellationOrbitNode {
  entry: FileEntry;
  x: number;
  y: number;
  size: number;
  labelVisible: boolean;
  emphasis: 'anchor' | 'selected' | 'satellite';
}
```

### Band Types

| Type | Description | Visual Treatment |
|------|-------------|------------------|
| **Anchor** | Central/dominant band | Larger, centered |
| **Satellite** | Secondary bands | Orbiting the anchor |
| **Selected** | Currently selected files | Highlighted, emphasized |

### Building Orbit Bands

```typescript
function buildConstellationOrbitBands(
  bands: ConstellationOrbitBandInput[],
  selectedPaths: Set<string>,
  density: ThemeDensity
): ConstellationOrbitBand[] {
  return bands.map(band => ({
    ...band,
    nodes: band.entries.map(entry => ({
      entry,
      x: calculateOrbitPosition(band, entry),
      y: calculateRadialPosition(band, entry),
      size: getNodeSize(entry, density),
      labelVisible: shouldShowLabel(entry, density),
      emphasis: getEmphasis(entry, selectedPaths)
    })),
    hiddenEntryCount: countHiddenEntries(band, density)
  }));
}
```

### Features

- **Spatial Navigation**: Click and drag to pan, scroll to zoom
- **Selection Highlighting**: Selected files emphasized with glow effect
- **Contextual Bands**: Files grouped by type, date, or custom criteria
- **Dynamic Sizing**: Node size reflects file size or importance
- **Label Toggle**: Show/hide file labels based on density

### Use Cases

- **Project Overview**: Visualize project structure at a glance
- **File Relationships**: See connections between related files
- **Size Analysis**: Identify large files in spatial context
- **Creative Workflow**: Alternative browsing for creative professionals

---

## Experimental View Modes

### Adaptive Semantic Grid

The Adaptive Semantic Grid provides intelligent file organization based on content analysis.

```typescript
interface SemanticGridConfig {
  clusteringAlgorithm: 'kmeans' | 'hierarchical' | 'dbscan';
  featureExtractor: 'color' | 'texture' | 'semantic' | 'metadata';
  maxClusterSize: number;
  minClusterSize: number;
  layoutAlgorithm: 'force' | 'grid' | 'circular';
}
```

### Features

- **Content-Based Clustering**: Group similar files together
- **Semantic Analysis**: Use AI to understand file content
- **Adaptive Layout**: Automatically adjust grid based on content
- **Dynamic Reorganization**: Re-cluster when new files added

### Layout Algorithms

| Algorithm | Description | Best For |
|-----------|-------------|----------|
| **Force** | Physics-based layout | Exploring relationships |
| **Grid** | Structured grid | Quick scanning |
| **Circular** | Radial layout | Hierarchical structures |

### Density Adaptation

```typescript
interface AdaptiveDensity {
  viewportWidth: number;
  viewportHeight: number;
  fileCount: number;
  averageFileSize: number;
  
  calculateGridMetrics(): GridMetrics;
  adjustSpacing(): void;
  optimizeLabels(): void;
}
```

### Experimental Density System

```typescript
interface ExperimentalDensity {
  level: number; // 0-100
  baseGridSize: number;
  gapMultiplier: number;
  labelScale: number;
  iconScale: number;
  
  calculateMetrics(): DensityMetrics;
  applyToView(view: FileView): void;
}
```

---

## Explorer Runtimes

### Concept

Explorer Runtimes allow switching between different explorer implementations with different behaviors and features.

### Available Runtimes

| Runtime | Description | Use Case |
|---------|-------------|----------|
| **Standard** | Default Yazi-based explorer | General use |
| **Constellation** | Spatial orbit-band view | Visual exploration |
| **Semantic** | AI-powered organization | Content discovery |
| **Minimal** | Lightweight, fast loading | Large directories |

### Runtime Switching

```typescript
type ExplorerRuntimeId = 
  | 'standard'
  | 'constellation'
  | 'semantic'
  | 'minimal';

interface ExplorerRuntime {
  id: ExplorerRuntimeId;
  name: string;
  description: string;
  capabilities: string[];
  performanceProfile: 'light' | 'medium' | 'heavy';
  
  createView(props: ExplorerProps): React.ReactNode;
  handleNavigation(path: string): Promise<void>;
  handleSelection(paths: string[]): void;
}
```

### Standard Runtime

The default Yazi-based explorer with full feature support:

- Directory listing with metadata
- File operations (copy, move, delete, rename)
- Preview pane integration
- Search integration
- Tag management

### Constellation Runtime

Specialized runtime for constellation view:

- Orbit band management
- Spatial navigation
- Band-based filtering
- Visual emphasis controls

### Semantic Runtime

AI-powered explorer with semantic understanding:

- Content-based clustering
- Semantic search integration
- Auto-tagging
- Similar file suggestions

### Minimal Runtime

Lightweight explorer for performance-critical scenarios:

- Reduced memory footprint
- Simplified UI
- Basic operations only
- Fast directory loading

---

## Treemap Visualization

### Overview

Treemap visualization provides a space-filling view of storage usage, with file/folder sizes represented by rectangle areas.

### Implementation

```typescript
interface TreemapConfig {
  algorithm: 'squarified' | 'slice-and-dice' | 'strip';
  padding: number;
  aspectRatio: number;
  colorScheme: 'size' | 'type' | 'date' | 'custom';
  showLabels: boolean;
  labelPosition: 'inside' | 'outside' | 'hover';
}

interface TreemapNode {
  id: string;
  path: string;
  name: string;
  size: number;
  children?: TreemapNode[];
  color?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
```

### Layout Algorithms

| Algorithm | Description | Characteristics |
|-----------|-------------|-----------------|
| **Squarified** | Creates near-square rectangles | Best readability |
| **Slice-and-Dice** | Alternating horizontal/vertical cuts | Good for time series |
| **Strip** | Row-based layout | Simple, predictable |

### Example Squarified Layout

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  ┌─────────────┐  ┌─────────────────────────────┐  │
│  │   45 MB     │  │                             │  │
│  │   (Image)   │  │      120 MB (Video)         │  │
│  └─────────────┘  │                             │  │
│                   │                             │  │
│  ┌─────────────┐  │                             │  │
│  │   25 MB     │  │                             │  │
│  │   (Audio)   │  └─────────────────────────────┘  │
│  └─────────────┘                                     │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │              200 MB (Documents)               │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Color Schemes

| Scheme | Description | Use Case |
|--------|-------------|----------|
| **Size** | Color by file size | Identify large files |
| **Type** | Color by file type | File type distribution |
| **Date** | Color by modification date | Recent vs old files |
| **Custom** | Custom color mapping | Custom analysis |

### Storage Panel Integration

The treemap is used in the Storage Forensics Panel:

```typescript
// storageTreemap.ts
export function createStorageTreemap(
  storageTree: StorageNode[],
  config: TreemapConfig
): TreemapNode[] {
  // Transform storage tree to treemap layout
  const normalized = normalizeStorageData(storageTree);
  const layout = applySquarifiedLayout(normalized, config);
  return layout;
}
```

---

## Explorer Chrome Layouts

### Adaptive Chrome System

GreebleFS provides adaptive chrome layouts that adjust based on context and user preferences.

### Layout Zones

```typescript
interface ExplorerChromeZone {
  id: ExplorerChromeZoneId;
  name: string;
  surfaces: ExplorerChromeSurfaceId[];
  order: number;
  grow?: number;
  shrink?: number;
  collapsePriority?: number;
  overflowEligible?: boolean;
}

type ExplorerChromeZoneId =
  | 'topbar'
  | 'toolbar'
  | 'workspace-header'
  | 'rail-header'
  | 'preview-header'
  | 'status-strip';
```

### Control Definitions

```typescript
interface ExplorerChromeControl {
  id: ExplorerChromeControlId;
  label: string;
  surfaces: ExplorerChromeSurfaceId[];
}

type ExplorerChromeControlId =
  | 'navigation'
  | 'search'
  | 'view-mode'
  | 'split-toggle'
  | 'preview-toggle'
  | 'bookmarks'
  | 'tags'
  | 'history'
  | 'settings';
```

### Zone-Based Editing

Controls can be moved between surfaces via override snapshots:

```typescript
interface ChromeOverrideEntry {
  controlId: ExplorerChromeControlId;
  surfaceId: ExplorerChromeSurfaceId;
  zone: ExplorerChromeZoneId;
  order: number;
}

interface ChromeOverrideSnapshot {
  entries: ChromeOverrideEntry[];
}
```

### Example Layout

```
┌─────────────────────────────────────────────────────────────┐
│ [☰][←][→]  /home/user/projects  [🔍]           [⚙️]      │  // Topbar
├─────────────────────────────────────────────────────────────┤
│ [📁][📄][🔲]  [Grid▼]  [✓]  [⋮]                          │  // Toolbar
├──────────┬────────────────────────────────────────────────┤
│          │  ┌──────────────────────────────────────────┐  │
│  Side    │  │                                          │  │  // Workspace
│  Rail    │  │           File Content                   │  │
│          │  │                                          │  │
│  [📁]    │  │                                          │  │
│  [⭐]    │  └──────────────────────────────────────────┘  │
│  [🏷️]    │                                                │
│          │  ┌──────────────────────────────────────────┐  │
│          │  │ [Preview]  [Edit]  [Cutout]  [Remove BG] │  │  // Preview Header
│          │  └──────────────────────────────────────────┘  │
│          │                                                │
│          │  ┌──────────────────────────────────────────┐  │
│          │  │         Preview Content Area             │  │  // Preview
│          │  │                                          │  │
│          │  └──────────────────────────────────────────┘  │
├──────────┴────────────────────────────────────────────────┤
│  Ready                                              0/0  │  // Status Strip
└─────────────────────────────────────────────────────────────┘
```

---

## Explorer Mode Profiles

### Concept

Explorer Mode Profiles map user-facing modes to pane and chrome configurations.

### Built-in Profiles

| Profile | Description | Layout |
|---------|-------------|--------|
| **Balanced** | Default balanced experience | 2-Up, standard chrome |
| **Navigator** | Focus on navigation | 1-Up, minimal chrome |
| **Focus** | Content-focused | 1-Up, hidden rail |
| **Inspector** | Detail-focused | 2-Up, wide preview |

### Profile Configuration

```typescript
interface ExplorerModeProfile {
  id: ExplorerModeProfileId;
  label: string;
  shortLabel: string;
  description: string;
  paneLayoutId: ExplorerShellLayoutId;
  chromeLayoutId: ExplorerChromeLayoutId;
  viewBias: 'navigation' | 'preview' | 'balanced';
  preferredViewMode?: ExplorerViewMode;
}

type ExplorerModeProfileId =
  | 'balanced'
  | 'navigator'
  | 'focus'
  | 'inspector'
  | 'custom';
```

### Resolving Mode Profiles

```typescript
function resolveExplorerModeProfile(
  input: ExplorerModeProfileId | undefined
): ExplorerModeProfile {
  const normalized = normalizeExplorerModeProfileId(input);
  const definition = getExplorerModeProfileDefinition(normalized);
  
  return {
    ...definition,
    paneLayout: resolvePaneLayout(definition.paneLayoutId),
    chromeLayout: resolveChromeLayout(definition.chromeLayoutId)
  };
}
```

---

## Preview Workflow Tabs

### System Overview

Preview workflow tabs provide context-aware actions for different file types.

### Built-in Tabs

| File Type | Tabs | Description |
|-----------|------|-------------|
| **Image** | Preview, Edit, Cutout, Remove BG | Image editing workflow |
| **Video** | Preview, Edit | Video playback and trim |
| **Audio** | Preview, Edit, VST | Audio playback and effects |
| **PDF** | Preview, Edit | PDF viewing and annotation |
| **Spreadsheet** | Preview, Edit | Spreadsheet viewing and edit |
| **Python** | Edit, Run, Runtime | Code and execution |
| **Shader** | Preview, Edit | Shader editing and preview |

### Workflow Tab Contract

```typescript
interface ExplorerPreviewWorkflowTab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  order: number;
  isDefault: boolean;
  wildcard: boolean; // Lane-registered tab
  
  renderPreview(): React.ReactNode;
  renderEdit?(): React.ReactNode;
  handleAction?(action: string): void;
}

interface PreviewWorkflowState {
  activeTab: string;
  laneTabs: Record<string, string>; // laneId -> tabId
  wildcardTabs: PreviewWorkflowTab[];
}
```

### Tab Resolution

```typescript
function resolvePreviewWorkflowTabs(
  fileType: FileType,
  laneId?: string
): ExplorerPreviewWorkflowTab[] {
  const builtIn = getBuiltInTabs(fileType);
  const wildcard = getWildcardTabs(laneId);
  
  return [...builtIn, ...wildcard].sort((a, b) => a.order - b.order);
}
```

---

## Context Menu Composition

### Layered Authoring

Context menus use a layered authored runtime system:

```typescript
interface ContextMenuLayer {
  id: string;
  source: 'built-in' | 'plugin' | 'user';
  priority: number;
  items: ContextMenuItem[];
}

interface ContextMenuItem {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  action: string | ((entry: FileEntry) => void);
  enabled?: boolean;
  visible?: boolean;
  children?: ContextMenuItem[];
}
```

### Menu Sources

| Source | Priority | Description |
|--------|----------|-------------|
| **Built-in** | 0 | Core file operations |
| **Theme** | 10 | Theme-contributed items |
| **Plugin** | 20 | Plugin-contributed items |
| **User** | 30 | User-defined items |

### Preview-Pane Adaptation

Preview context menus adapt to preview kind and workflow:

```typescript
interface PreviewContextMenuConfig {
  previewKind: 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'code';
  activeWorkflowTab: string;
  laneId: string;
  
  getBaseActions(): ContextMenuItem[];
  getWorkflowActions(): ContextMenuItem[];
  getAdaptiveActions(): ContextMenuItem[];
}
```

---

## Summary

GreebleFS alternate views and experimental modes provide:

- **Constellation View**: Spatial orbit-band visualization for creative workflows
- **Adaptive Semantic Grid**: AI-powered content-based file organization
- **Explorer Runtimes**: Switchable explorer implementations for different use cases
- **Treemap Visualization**: Size-weighted storage visualization
- **Adaptive Chrome**: Zone-based, customizable chrome layouts
- **Mode Profiles**: Pre-configured layouts for different workflows
- **Workflow Tabs**: Context-aware preview actions
- **Context Menu Composition**: Layered, adaptive context menus

These features enable GreebleFS to serve diverse workflows beyond traditional file management.