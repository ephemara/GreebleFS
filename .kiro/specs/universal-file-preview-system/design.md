# Design Document: Universal File Preview System

## Overview

The Universal File Preview System extends GreebleFS's existing preview capabilities to support 150+ additional file types across 16 major categories. The system transforms the file explorer into a true all-in-one interactive command center by enabling rich, contextual previews with editing capabilities where they add value.

### Design Goals

1. **Extensibility**: Clean extension points for adding new preview types without modifying core routing logic
2. **Performance**: Lazy loading, memory budgets, and file size limits ensure responsiveness
3. **Consistency**: Unified editing framework with undo/redo, auto-save, and validation across all editable formats
4. **Backward Compatibility**: Existing preview types remain unchanged; new types extend the system

### Current Architecture

The existing preview system consists of:

- **Preview Router** (`src/config/filePreview.ts`): Extension detection functions mapping file extensions to preview types
- **PreviewState Type** (`src/components/FileExplorer.tsx`): Discriminated union defining all preview variants
- **Workbench Components**: Dedicated React components for each preview type (e.g., `ExplorerAudioWorkbench`, `ExplorerPdfWorkbench`)
- **Backend Commands** (`src-tauri/src/`): Tauri/Rust commands for native file operations
- **Existing Previews**: image, audio, video, font, sqlite, pdf, text, model3d, folder, archive, docx, spreadsheet

---

## Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FileExplorer.tsx                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      Preview Selection Handler                        │    │
│  │   • Detects file selection changes                                    │    │
│  │   • Invokes PreviewRouter to determine preview type                   │    │
│  │   • Constructs PreviewState object                                    │    │
│  │   • Manages preview lifecycle (load, cleanup, cancel)                 │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Preview Router Layer                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐           │
│  │ filePreview.ts   │  │ previewRouter.ts │  │ previewTypes.ts  │           │
│  │ (existing)       │  │ (new)            │  │ (new)            │           │
│  │                  │  │                  │  │                  │           │
│  │ • isImage*       │  │ • detectPreview  │  │ • PreviewType    │           │
│  │ • isAudio*       │  │   Category()     │  │   enum           │           │
│  │ • isVideo*       │  │ • resolvePreview │  │ • PreviewMeta    │           │
│  │ • isPdf*         │  │   Metadata()     │  │   interfaces     │           │
│  │ • ...            │  │ • MIME mapping   │  │                  │           │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PreviewState (Discriminated Union)                   │
│                                                                              │
│  type PreviewState =                                                        │
│    | { type: "none"; path: string }                                         │
│    | { type: "image"; path: string; name: string; content: string }         │
│    | { type: "hex"; path: string; name: string; size: number;               │
│        initialBytes: string; editState: HexEditState | null }               │
│    | { type: "georaster"; path: string; name: string; format: string;       │
│        metadata: GeoRasterMetadata; previewUrl: string }                    │
│    | { type: "notebook"; path: string; name: string; cells: NotebookCell[]; │
│        editState: NotebookEditState | null }                                │
│    | ... (all existing + new types)                                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Workbench Component Layer                            │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    PreviewPanel (Router Component)                    │   │
│  │   • Switches on PreviewState.type                                     │   │
│  │   • Lazy loads workbench components                                   │   │
│  │   • Provides ErrorBoundary                                            │   │
│  │   • Manages loading states                                            │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│  │ HexViewer   │ │ GeoRaster   │ │ Notebook    │ │ Archive     │            │
│  │ Workbench   │ │ Workbench   │ │ Workbench   │ │ Workbench   │            │
│  │             │ │             │ │             │ │             │            │
│  │ • Byte grid │ │ • Map render│ │ • Cell list │ │ • File tree │            │
│  │ • Edit mode │ │ • Metadata  │ │ • Edit mode │ │ • Extract   │            │
│  │ • Search    │ │ • Band info │ │ • Monaco    │ │ • Preview   │            │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘            │
│                                                                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│  │ RAW Image   │ │ Certificate │ │ Molecular   │ │ Subtitle    │            │
│  │ Workbench   │ │ Workbench   │ │ Workbench   │ │ Workbench   │            │
│  │             │ │             │ │             │ │             │            │
│  │ • Preview   │ │ • Cert info │ │ • 3D render │ │ • Timeline  │            │
│  │ • Adjust    │ │ • Chain     │ │ • Represen- │ │ • Edit text │            │
│  │ • Export    │ │ • Generate  │ │   tations   │ │ • Timing    │            │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘            │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Backend Command Layer (Tauri/Rust)                   │
│                                                                              │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐             │
│  │ hex_commands.rs  │ │ geo_commands.rs  │ │ notebook_        │             │
│  │                  │ │                  │ │ commands.rs      │             │
│  │ • hex_read_      │ │ • geo_read_      │ │ • notebook_parse │             │
│  │   range          │ │   raster_meta    │ │ • notebook_save  │             │
│  │ • hex_write_     │ │ • geo_read_      │ │                  │             │
│  │   bytes          │ │   vector         │ │                  │             │
│  │ • hex_search     │ │ • geo_render_    │ │                  │             │
│  │                  │ │   thumbnail      │ │                  │             │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘             │
│                                                                              │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐             │
│  │ archive_ops.rs   │ │ raw_commands.rs  │ │ cert_commands.rs │             │
│  │ (extended)       │ │                  │ │                  │             │
│  │                  │ │ • raw_extract_   │ │ • cert_parse     │             │
│  │ • inspect_zst    │ │   preview        │ │ • cert_generate  │             │
│  │ • inspect_lz4    │ │ • raw_adjust     │ │ • cert_export    │             │
│  │ • inspect_iso    │ │ • raw_export     │ │ • ssh_key_gen    │             │
│  │ • inspect_deb    │ │                  │ │                  │             │
│  │ • inspect_rpm    │ │                  │ │                  │             │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Hierarchy

```
FileExplorer.tsx
├── PreviewPanel (new router component)
│   ├── ErrorBoundary
│   │   └── Suspense
│   │       └── [Lazy-loaded Workbench]
│   │           ├── ExplorerHexWorkbench (new)
│   │           ├── ExplorerGeoRasterWorkbench (new)
│   │           ├── ExplorerGeoVectorWorkbench (new)
│   │           ├── ExplorerNotebookWorkbench (new)
│   │           ├── ExplorerRawImageWorkbench (new)
│   │           ├── ExplorerCertificateWorkbench (new)
│   │           ├── ExplorerMolecularWorkbench (new)
│   │           ├── ExplorerSubtitleWorkbench (new)
│   │           ├── ExplorerDataFormatWorkbench (new)
│   │           ├── ExplorerBioSequenceWorkbench (new)
│   │           ├── ExplorerGameAssetWorkbench (new)
│   │           └── [existing workbenches...]
│   └── LoadingIndicator
└── [existing components...]
```

### Data Flow

```
User selects file
       │
       ▼
FileExplorer detects selection change
       │
       ▼
PreviewRouter.detectPreviewCategory(entry)
       │
       ├── Check extension against registered patterns
       ├── Check compound extensions (tar.gz, etc.)
       ├── Optional: content-based detection for ambiguous formats
       │
       ▼
PreviewRouter.resolvePreviewMetadata(path, category)
       │
       ├── Invoke backend command for metadata
       ├── Construct PreviewState variant
       │
       ▼
FileExplorer.setState({ previewState })
       │
       ▼
PreviewPanel renders appropriate workbench
       │
       ├── Lazy load component
       ├── Pass PreviewState as props
       ├── Workbench may invoke additional backend commands
       │
       ▼
User interacts with preview (view/edit)
       │
       ├── Edits tracked in EditState
       ├── Auto-save drafts periodically
       ├── On save: invoke backend command
       │
       ▼
Backend writes file, returns result
       │
       ▼
Workbench updates UI state
```

---

## Preview Router Design

### Extension Detection Architecture

The preview router uses a layered detection strategy:

1. **Primary Extension Match**: Direct extension-to-category mapping
2. **Compound Extension Match**: Handle multi-part extensions (tar.gz, tar.bz2)
3. **Content-Based Detection**: For ambiguous formats (JSON that might be GeoJSON)

```typescript
// src/config/previewRouter.ts (new file)

import type { FileEntry } from '../generated/tauri';

export type PreviewCategory =
  // Existing
  | 'image'
  | 'audio'
  | 'video'
  | 'font'
  | 'sqlite'
  | 'pdf'
  | 'text'
  | 'model3d'
  | 'folder'
  | 'archive'
  | 'docx'
  | 'spreadsheet'
  // New Phase 1
  | 'hex'
  | 'rawImage'
  | 'extendedArchive'
  // New Phase 2
  | 'officeDocument'
  | 'dataFormat'
  | 'certificate'
  | 'subtitle'
  // New Phase 3
  | 'geoRaster'
  | 'geoVector'
  | 'notebook'
  | 'molecular'
  // New Phase 4
  | 'lidar'
  | 'bioSequence'
  | 'gameAsset';

export interface PreviewCategoryDefinition {
  id: PreviewCategory;
  label: string;
  extensions: readonly string[];
  compoundExtensions?: readonly string[];
  mimeTypes?: Record<string, string>;
  priority: number; // Higher = checked first
  requiresContentDetection?: boolean;
  maxSizeBytes?: number;
  supportsEditing: boolean;
}

// Category definitions with priority ordering
export const PREVIEW_CATEGORIES: readonly PreviewCategoryDefinition[] = [
  // High-priority specific formats
  {
    id: 'notebook',
    label: 'Jupyter Notebook',
    extensions: ['ipynb'],
    priority: 100,
    supportsEditing: true,
  },
  {
    id: 'geoRaster',
    label: 'Geospatial Raster',
    extensions: ['tiff', 'tif', 'dem', 'asc', 'hgt', 'nc', 'grib', 'grib2'],
    priority: 95,
    maxSizeBytes: 50 * 1024 * 1024,
    supportsEditing: false,
  },
  {
    id: 'geoVector',
    label: 'Geospatial Vector',
    extensions: ['shp', 'geojson', 'topojson', 'gpx', 'kml', 'kmz', 'gpkg', 'mbtiles', 'osm', 'gml'],
    priority: 95,
    supportsEditing: true,
  },
  {
    id: 'rawImage',
    label: 'Camera RAW',
    extensions: ['cr2', 'cr3', 'nef', 'arw', 'orf', 'rw2', 'dng', 'pef', 'srf', 'raw', 'hdr', 'exr'],
    priority: 90,
    maxSizeBytes: 100 * 1024 * 1024,
    supportsEditing: true,
  },
  {
    id: 'extendedArchive',
    label: 'Extended Archive',
    extensions: ['zst', 'lz4', 'cab', 'iso', 'img', 'deb', 'rpm', 'apk', 'ipa', 'whl', 'vsix', 'nupkg', 'crx'],
    compoundExtensions: ['.tar.zst', '.tar.lz4'],
    priority: 85,
    supportsEditing: false,
  },
  {
    id: 'hex',
    label: 'Binary/Hex',
    extensions: [], // Fallback for unrecognized binary files
    priority: 0, // Lowest priority - fallback
    supportsEditing: true,
  },
  // ... additional categories
];

export function detectPreviewCategory(entry: FileEntry): PreviewCategory | null {
  if (entry.is_dir) {
    return 'folder';
  }

  const lowerName = entry.name.toLowerCase();
  
  // Check compound extensions first (longer matches)
  for (const category of PREVIEW_CATEGORIES) {
    if (category.compoundExtensions) {
      for (const ext of category.compoundExtensions) {
        if (lowerName.endsWith(ext)) {
          return category.id;
        }
      }
    }
  }
  
  // Check single extensions
  const extension = lowerName.split('.').pop() ?? '';
  for (const category of PREVIEW_CATEGORIES) {
    if (category.extensions.includes(extension)) {
      return category.id;
    }
  }
  
  // Fallback to hex for unrecognized binary files
  return 'hex';
}
```

### MIME Type Mapping

```typescript
// src/config/previewMimeTypes.ts (new file)

export const PREVIEW_MIME_TYPES: Record<string, string> = {
  // Geospatial
  'geotiff': 'image/tiff; application=geotiff',
  'dem': 'application/x-dem',
  'netcdf': 'application/x-netcdf',
  'grib': 'application/x-grib',
  'geojson': 'application/geo+json',
  'gpx': 'application/gpx+xml',
  'kml': 'application/vnd.google-earth.kml+xml',
  
  // Archives
  'zst': 'application/zstd',
  'lz4': 'application/x-lz4',
  'iso': 'application/x-iso9660-image',
  'deb': 'application/vnd.debian.binary-package',
  'rpm': 'application/x-rpm',
  'apk': 'application/vnd.android.package-archive',
  'whl': 'application/zip', // Python wheel is a zip
  'vsix': 'application/zip', // VS Code extension is a zip
  
  // Camera RAW
  'cr2': 'image/x-canon-cr2',
  'nef': 'image/x-nikon-nef',
  'arw': 'image/x-sony-arw',
  'dng': 'image/x-adobe-dng',
  'exr': 'image/x-exr',
  
  // Data formats
  'parquet': 'application/x-parquet',
  'arrow': 'application/x-apache-arrow',
  'cbor': 'application/cbor',
  'msgpack': 'application/x-msgpack',
  
  // Certificates
  'pem': 'application/x-pem-file',
  'crt': 'application/x-x509-ca-cert',
  'csr': 'application/pkcs10',
  
  // Subtitles
  'srt': 'application/x-subrip',
  'vtt': 'text/vtt',
  'ass': 'text/x-ssa',
  
  // Molecular
  'pdb': 'chemical/x-pdb',
  'mol': 'chemical/x-mdl-molfile',
  'sdf': 'chemical/x-mdl-sdfile',
  
  // Bioinformatics
  'fasta': 'chemical/x-fasta',
  'fastq': 'chemical/x-fastq',
  'bam': 'application/x-bam',
  'vcf': 'text/x-vcard', // Actually variant call format
};

export function getPreviewMimeType(extension: string): string | null {
  return PREVIEW_MIME_TYPES[extension.toLowerCase()] ?? null;
}
```

### Content-Based Detection

For ambiguous formats like JSON files that might be GeoJSON:

```typescript
// src/config/previewContentDetection.ts (new file)

export async function detectJsonSubtype(
  path: string,
  initialContent: string
): Promise<'geojson' | 'json' | 'jsonl'> {
  try {
    const parsed = JSON.parse(initialContent);
    
    // GeoJSON detection
    if (parsed.type && (
      parsed.type === 'Feature' ||
      parsed.type === 'FeatureCollection' ||
      parsed.type === 'GeometryCollection'
    )) {
      return 'geojson';
    }
    
    return 'json';
  } catch {
    // Check for JSONL
    const lines = initialContent.split('\n').slice(0, 10);
    let validJsonLines = 0;
    for (const line of lines) {
      try {
        JSON.parse(line);
        validJsonLines++;
      } catch {
        break;
      }
    }
    if (validJsonLines >= 3) {
      return 'jsonl';
    }
    return 'json';
  }
}
```

---

## PreviewState Type Design

### Discriminated Union Structure

The PreviewState type extends the existing discriminated union with new variants:

```typescript
// src/config/previewTypes.ts (new file)

import type { ModelPreviewFormat } from './filePreview';

// ─── Edit State Tracking ─────────────────────────────────────────────────────

export interface EditStateBase {
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: number | null;
  canUndo: boolean;
  canRedo: boolean;
}

// ─── Phase 1: Extended Archives ───────────────────────────────────────────────

export interface ExtendedArchiveMetadata {
  format: 'zst' | 'lz4' | 'cab' | 'iso' | 'deb' | 'rpm' | 'apk' | 'whl' | 'vsix' | 'nupkg';
  entryCount: number;
  totalSize: number;
  compressedSize: number;
  hasManifest: boolean;
  manifestContent?: string; // For APK, WHL, VSIX
}

// ─── Phase 1: Hex Viewer ──────────────────────────────────────────────────────

export interface HexEditState extends EditStateBase {
  modifiedRanges: Array<{ offset: number; length: number }>;
  searchQuery: string | null;
  searchResults: Array<{ offset: number; length: number }>;
}

// ─── Phase 1: Camera RAW ──────────────────────────────────────────────────────

export interface RawImageAdjustments {
  exposure: number;      // -2.0 to +2.0 EV
  temperature: number;   // 2000 to 50000 K
  tint: number;          // -150 to +150
  contrast: number;      // -100 to +100
  highlights: number;    // -100 to +100
  shadows: number;       // -100 to +100
  whites: number;        // -100 to +100
  blacks: number;        // -100 to +100
  clarity: number;       // -100 to +100
  vibrance: number;      // -100 to +100
  saturation: number;    // -100 to +100
}

export interface RawImageMetadata {
  cameraMake: string;
  cameraModel: string;
  lensModel: string | null;
  iso: number;
  aperture: number;
  shutterSpeed: string;
  focalLength: number;
  captureDate: string;
  width: number;
  height: number;
  bitDepth: number;
}

// ─── Phase 2: Data Formats ────────────────────────────────────────────────────

export interface DataFormatSchema {
  fields: Array<{
    name: string;
    type: string;
    nullable: boolean;
  }>;
  rowCount: number;
}

// ─── Phase 2: Certificates ────────────────────────────────────────────────────

export interface CertificateMetadata {
  subject: string;
  issuer: string;
  serialNumber: string;
  notBefore: string;
  notAfter: string;
  signatureAlgorithm: string;
  publicKeyAlgorithm: string;
  publicKeyBits: number;
  san?: string[]; // Subject Alternative Names
  isExpired: boolean;
  isSelfSigned: boolean;
}

// ─── Phase 2: Subtitles ───────────────────────────────────────────────────────

export interface SubtitleEntry {
  index: number;
  startTime: number; // milliseconds
  endTime: number;
  text: string;
  style?: string; // For ASS/SSA
}

// ─── Phase 3: Geospatial ──────────────────────────────────────────────────────

export interface GeoRasterMetadata {
  crs: string;
  bounds: [number, number, number, number]; // [west, south, east, north]
  width: number;
  height: number;
  bandCount: number;
  dataType: string;
  noDataValue: number | null;
}

export interface GeoVectorMetadata {
  geometryType: 'Point' | 'LineString' | 'Polygon' | 'MultiPoint' | 'MultiLineString' | 'MultiPolygon';
  featureCount: number;
  bounds: [number, number, number, number];
  properties: Array<{ name: string; type: string }>;
}

// ─── Phase 3: Jupyter Notebooks ───────────────────────────────────────────────

export interface NotebookCell {
  id: string;
  type: 'markdown' | 'code' | 'raw';
  source: string;
  outputs?: Array<{
    type: 'stream' | 'display_data' | 'execute_result' | 'error';
    data?: Record<string, unknown>;
    text?: string;
  }>;
  executionCount?: number;
  metadata: Record<string, unknown>;
}

// ─── Phase 3: Molecular ───────────────────────────────────────────────────────

export interface MolecularMetadata {
  atomCount: number;
  bondCount: number;
  molecularWeight: number;
  formula: string;
  title?: string;
  chains?: string[];
}

// ─── Phase 4: Bioinformatics ──────────────────────────────────────────────────

export interface BioSequenceMetadata {
  sequenceType: 'dna' | 'rna' | 'protein';
  sequenceCount: number;
  totalLength: number;
  gcContent?: number;
}

// ─── Phase 4: LiDAR ───────────────────────────────────────────────────────────

export interface LidarMetadata {
  pointCount: number;
  bounds: [number, number, number, number, number, number]; // [xmin, ymin, zmin, xmax, ymax, zmax]
  dimensions: string[];
  formatVersion: string;
  compression: boolean;
}

// ─── Complete PreviewState Union ──────────────────────────────────────────────

export type PreviewState =
  // Existing types (unchanged)
  | { type: 'none'; path: string }
  | { type: 'image'; path: string; name: string; content: string }
  | { type: 'audio'; path: string; name: string; source: string; extension: string; mimeType: string | null; size: number }
  | { type: 'video'; path: string; name: string; source: string; extension: string; mimeType: string | null; size: number }
  | { type: 'font'; path: string; name: string; source: string; extension: string; size: number }
  | { type: 'sqlite'; path: string; name: string; size: number }
  | { type: 'pdf'; path: string; name: string; size: number; document: unknown }
  | { type: 'text'; path: string; name: string; content: string; language: string; renderKind: string; focusTarget: unknown | null; isDirty: boolean; isSaving: boolean; lastSavedAt: number | null; error: string | null }
  | { type: 'model3d'; path: string; format: ModelPreviewFormat; name: string; size: number }
  | { type: 'folder'; path: string; name: string }
  | { type: 'archive'; path: string; name: string; size: number; descriptor: unknown }
  | { type: 'spreadsheet'; path: string; name: string; extension: string; size: number; fileKind: 'workbook' | 'tabular' }
  | { type: 'docx'; path: string; name: string; extension: string; size: number }
  | { type: 'fallback'; path: string; name: string; label: string; detail?: string }
  
  // Phase 1: New types
  | { type: 'hex'; path: string; name: string; size: number; initialBytes: string; editState: HexEditState | null }
  | { type: 'extendedArchive'; path: string; name: string; size: number; metadata: ExtendedArchiveMetadata; entries: string[] }
  | { type: 'rawImage'; path: string; name: string; extension: string; size: number; previewUrl: string; metadata: RawImageMetadata; adjustments: RawImageAdjustments; editState: EditStateBase | null }
  
  // Phase 2: New types
  | { type: 'dataFormat'; path: string; name: string; extension: string; size: number; schema: DataFormatSchema; sampleData: unknown[]; editState: EditStateBase | null }
  | { type: 'certificate'; path: string; name: string; extension: string; metadata: CertificateMetadata; pemContent: string; editState: EditStateBase | null }
  | { type: 'subtitle'; path: string; name: string; extension: string; entries: SubtitleEntry[]; editState: EditStateBase | null }
  
  // Phase 3: New types
  | { type: 'geoRaster'; path: string; name: string; extension: string; size: number; metadata: GeoRasterMetadata; previewUrl: string }
  | { type: 'geoVector'; path: string; name: string; extension: string; size: number; metadata: GeoVectorMetadata; geoJsonContent: string; editState: EditStateBase | null }
  | { type: 'notebook'; path: string; name: string; cells: NotebookCell[]; editState: EditStateBase | null }
  | { type: 'molecular'; path: string; name: string; extension: string; size: number; metadata: MolecularMetadata; pdbContent: string; editState: EditStateBase | null }
  
  // Phase 4: New types
  | { type: 'bioSequence'; path: string; name: string; extension: string; metadata: BioSequenceMetadata; sequences: Array<{ header: string; sequence: string }> }
  | { type: 'lidar'; path: string; name: string; extension: string; size: number; metadata: LidarMetadata }
  | { type: 'gameAsset'; path: string; name: string; extension: string; size: number; metadata: Record<string, unknown> };
```

### Backward Compatibility

The PreviewState type maintains backward compatibility by:

1. **Preserving existing variants**: All existing preview types remain unchanged
2. **Additive approach**: New variants are added, not modified
3. **Type narrowing**: TypeScript discriminated unions allow safe type narrowing

---

## Workbench Component Architecture

### Base Workbench Interface

```typescript
// src/components/previews/types.ts (new file)

import type { ReactNode } from 'react';

export interface WorkbenchPropsBase {
  path: string;
  name: string;
  size: number;
  onClose?: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

export interface EditableWorkbenchProps extends WorkbenchPropsBase {
  editState: EditStateBase | null;
  onSave?: () => Promise<void>;
  onUndo?: () => void;
  onRedo?: () => void;
}

export interface WorkbenchChromeConfig {
  showToolbar: boolean;
  toolbarItems: ReactNode[];
  showStatusBar: boolean;
  statusText?: string;
}

export interface WorkbenchController {
  save: () => Promise<void>;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  isDirty: boolean;
}
```

### Lazy Loading Strategy

```typescript
// src/components/previews/index.ts (new file)

import { lazy } from 'react';

// Phase 1
export const ExplorerHexWorkbench = lazy(() =>
  import('./ExplorerHexWorkbench').then(m => ({ default: m.ExplorerHexWorkbench }))
);

export const ExplorerExtendedArchiveWorkbench = lazy(() =>
  import('./ExplorerExtendedArchiveWorkbench').then(m => ({ default: m.ExplorerExtendedArchiveWorkbench }))
);

export const ExplorerRawImageWorkbench = lazy(() =>
  import('./ExplorerRawImageWorkbench').then(m => ({ default: m.ExplorerRawImageWorkbench }))
);

// Phase 2
export const ExplorerDataFormatWorkbench = lazy(() =>
  import('./ExplorerDataFormatWorkbench').then(m => ({ default: m.ExplorerDataFormatWorkbench }))
);

export const ExplorerCertificateWorkbench = lazy(() =>
  import('./ExplorerCertificateWorkbench').then(m => ({ default: m.ExplorerCertificateWorkbench }))
);

export const ExplorerSubtitleWorkbench = lazy(() =>
  import('./ExplorerSubtitleWorkbench').then(m => ({ default: m.ExplorerSubtitleWorkbench }))
);

// Phase 3
export const ExplorerGeoRasterWorkbench = lazy(() =>
  import('./ExplorerGeoRasterWorkbench').then(m => ({ default: m.ExplorerGeoRasterWorkbench }))
);

export const ExplorerGeoVectorWorkbench = lazy(() =>
  import('./ExplorerGeoVectorWorkbench').then(m => ({ default: m.ExplorerGeoVectorWorkbench }))
);

export const ExplorerNotebookWorkbench = lazy(() =>
  import('./ExplorerNotebookWorkbench').then(m => ({ default: m.ExplorerNotebookWorkbench }))
);

export const ExplorerMolecularWorkbench = lazy(() =>
  import('./ExplorerMolecularWorkbench').then(m => ({ default: m.ExplorerMolecularWorkbench }))
);

// Phase 4
export const ExplorerBioSequenceWorkbench = lazy(() =>
  import('./ExplorerBioSequenceWorkbench').then(m => ({ default: m.ExplorerBioSequenceWorkbench }))
);

export const ExplorerLidarWorkbench = lazy(() =>
  import('./ExplorerLidarWorkbench').then(m => ({ default: m.ExplorerLidarWorkbench }))
);

export const ExplorerGameAssetWorkbench = lazy(() =>
  import('./ExplorerGameAssetWorkbench').then(m => ({ default: m.ExplorerGameAssetWorkbench }))
);
```

### Preview Panel Router

```typescript
// src/components/PreviewPanel.tsx (new file)

import React, { Suspense, useRef } from 'react';
import type { PreviewState } from '../config/previewTypes';
import { 
  ExplorerHexWorkbench,
  ExplorerExtendedArchiveWorkbench,
  ExplorerRawImageWorkbench,
  // ... other lazy imports
} from './previews';
import { ExplorerImageEditor } from './ExplorerImageEditor';
import { ExplorerAudioWorkbench } from './ExplorerAudioWorkbench';
// ... existing imports

interface PreviewPanelProps {
  previewState: PreviewState;
  onCloseGuard?: () => Promise<boolean>;
}

export function PreviewPanel({ previewState, onCloseGuard }: PreviewPanelProps): JSX.Element {
  const controllerRef = useRef<WorkbenchController | null>(null);
  
  const renderPreview = () => {
    switch (previewState.type) {
      // Existing types
      case 'image':
        return <ExplorerImageEditor path={previewState.path} name={previewState.name} content={previewState.content} />;
      case 'audio':
        return <ExplorerAudioWorkbench path={previewState.path} name={previewState.name} source={previewState.source} extension={previewState.extension} mimeType={previewState.mimeType} size={previewState.size} />;
      // ... other existing cases
      
      // Phase 1: New types
      case 'hex':
        return <ExplorerHexWorkbench path={previewState.path} name={previewState.name} size={previewState.size} initialBytes={previewState.initialBytes} editState={previewState.editState} />;
      case 'extendedArchive':
        return <ExplorerExtendedArchiveWorkbench path={previewState.path} name={previewState.name} size={previewState.size} metadata={previewState.metadata} entries={previewState.entries} />;
      case 'rawImage':
        return <ExplorerRawImageWorkbench path={previewState.path} name={previewState.name} extension={previewState.extension} size={previewState.size} previewUrl={previewState.previewUrl} metadata={previewState.metadata} adjustments={previewState.adjustments} editState={previewState.editState} />;
      
      // Phase 2-4: Additional cases
      // ...
      
      case 'none':
      case 'fallback':
      default:
        return <FallbackPreview state={previewState} />;
    }
  };
  
  return (
    <ErrorBoundary fallback={<PreviewError state={previewState} />}>
      <Suspense fallback={<PreviewLoading state={previewState} />}>
        {renderPreview()}
      </Suspense>
    </ErrorBoundary>
  );
}
```

### Error Boundary

```typescript
// src/components/previews/PreviewErrorBoundary.tsx (new file)

import React, { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class PreviewErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };
  
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }
  
  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}
```

---

## Editing Framework Design

### Undo/Redo System Architecture

```typescript
// src/components/previews/editing/UndoRedoManager.ts (new file)

export interface UndoRedoAction<T> {
  type: string;
  previousState: T;
  nextState: T;
  timestamp: number;
}

export class UndoRedoManager<T> {
  private undoStack: UndoRedoAction<T>[] = [];
  private redoStack: UndoRedoAction<T>[] = [];
  private maxHistory: number;
  
  constructor(maxHistory = 50) {
    this.maxHistory = maxHistory;
  }
  
  push(action: Omit<UndoRedoAction<T>, 'timestamp'>): void {
    this.undoStack.push({
      ...action,
      timestamp: Date.now(),
    });
    this{}
    this.redoStack = []; // Clear redo stack on new action
    
    // Enforce max history
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
  }
  
  undo(): UndoRedoAction<T> | null {
    const action = this.undoStack.pop();
    if (action) {
      this.redoStack.push(action);
    }
    return action ?? null;
  }
  
  redo(): UndoRedoAction<T> | null {
    const action = this.redoStack.pop();
    if (action) {
      this.undoStack.push(action);
    }
    return action ?? null;
  }
  
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }
  
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }
  
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}
```

### Auto-Save Mechanism

```typescript
// src/components/previews/editing/AutoSaveManager.ts (new file)

export interface AutoSaveConfig {
  enabled: boolean;
  intervalMs: number;
  debounceMs: number;
}

const DEFAULT_AUTO_SAVE_CONFIG: AutoSaveConfig = {
  enabled: true,
  intervalMs: 60000, // 60 seconds
  debounceMs: 1000,  // 1 second after last change
};

export class AutoSaveManager {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private debounceTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private lastSaveTime: number = 0;
  private pendingChanges: boolean = false;
  
  constructor(
    private config: AutoSaveConfig = DEFAULT_AUTO_SAVE_CONFIG,
    private onSave: () => Promise<void>
  ) {}
  
  start(): void {
    if (!this.config.enabled) return;
    
    this.intervalId = setInterval(() => {
      if (this.pendingChanges) {
        this.triggerSave();
      }
    }, this.config.intervalMs);
  }
  
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.debounceTimeoutId) {
      clearTimeout(this.debounceTimeoutId);
      this.debounceTimeoutId = null;
    }
  }
  
  notifyChange(): void {
    this.pendingChanges = true;
    
    // Debounced save
    if (this.debounceTimeoutId) {
      clearTimeout(this.debounceTimeoutId);
    }
    this.debounceTimeoutId = setTimeout(() => {
      this.triggerSave();
    }, this.config.debounceMs);
  }
  
  private async triggerSave(): Promise<void> {
    try {
      await this.onSave();
      this.lastSaveTime = Date.now();
      this.pendingChanges = false;
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  }
}
```

### Draft Persistence

```typescript
// src/components/previews/editing/DraftPersistence.ts (new file)

import { commands } from '../../runtime/tauriClient';

const DRAFT_DIR = 'preview-drafts';

export interface DraftMetadata {
  originalPath: string;
  draftPath: string;
  createdAt: number;
  modifiedAt: number;
}

export async function saveDraft(
  originalPath: string,
  content: Uint8Array | string
): Promise<DraftMetadata> {
  const draftFileName = `${Buffer.from(originalPath).toString('base64')}.draft`;
  const draftPath = `${DRAFT_DIR}/${draftFileName}`;
  
  await commands.fs_write_file({
    path: draftPath,
    content: typeof content === 'string' ? new TextEncoder().encode(content) : content,
  });
  
  return {
    originalPath,
    draftPath,
    createdAt: Date.now(),
    modifiedAt: Date.now(),
  };
}

export async function loadDraft(originalPath: string): Promise<{ content: Uint8Array; metadata: DraftMetadata } | null> {
  const draftFileName = `${Buffer.from(originalPath).toString('base64')}.draft`;
  const draftPath = `${DRAFT_DIR}/${draftFileName}`;
  
  try {
    const content = await commands.fs_read_file({ path: draftPath });
    return {
      content: new Uint8Array(content),
      metadata: {
        originalPath,
        draftPath,
        createdAt: 0, // Would be read from metadata file
        modifiedAt: 0,
      },
    };
  } catch {
    return null;
  }
}

export async function clearDraft(originalPath: string): Promise<void> {
  const draftFileName = `${Buffer.from(originalPath).toString('base64')}.draft`;
  const draftPath = `${DRAFT_DIR}/${draftFileName}`;
  
  try {
    await commands.fs_remove({ path: draftPath });
  } catch {
    // Ignore if draft doesn't exist
  }
}
```

### Validation Pipeline

```typescript
// src/components/previews/editing/ValidationPipeline.ts (new file)

export interface ValidationResult {
  valid: boolean;
  errors: Array<{
    path?: string;
    message: string;
    severity: 'error' | 'warning';
  }>;
}

export type Validator<T> = (value: T) => Promise<ValidationResult>;

export class ValidationPipeline<T> {
  private validators: Validator<T>[] = [];
  
  addValidator(validator: Validator<T>): this {
    this.validators.push(validator);
    return this;
  }
  
  async validate(value: T): Promise<ValidationResult> {
    const allErrors: ValidationResult['errors'] = [];
    
    for (const validator of this.validators) {
      const result = await validator(value);
      allErrors.push(...result.errors);
    }
    
    return {
      valid: allErrors.filter(e => e.severity === 'error').length === 0,
      errors: allErrors,
    };
  }
}

// Example validators
export const jsonValidator: Validator<string> = async (content) => {
  try {
    JSON.parse(content);
    return { valid: true, errors: [] };
  } catch (error) {
    return {
      valid: false,
      errors: [{ message: `Invalid JSON: ${error}`, severity: 'error' }],
    };
  }
};

export const geoJsonValidator: Validator<string> = async (content) => {
  const jsonResult = await jsonValidator(content);
  if (!jsonResult.valid) return jsonResult;
  
  const parsed = JSON.parse(content);
  const errors: ValidationResult['errors'] = [];
  
  if (!['Feature', 'FeatureCollection', 'GeometryCollection'].includes(parsed.type)) {
    errors.push({
      message: 'GeoJSON must have a valid type (Feature, FeatureCollection, or GeometryCollection)',
      severity: 'error',
    });
  }
  
  return { valid: errors.length === 0, errors };
};
```

### Save Conflict Resolution

```typescript
// src/components/previews/editing/ConflictResolution.ts (new file)

export interface ConflictInfo {
  originalModifiedAt: number;
  currentModifiedAt: number;
  hasUnsavedChanges: boolean;
}

export type ConflictResolution = 'overwrite' | 'keep-original' | 'save-as' | 'cancel';

export function detectConflict(
  originalModifiedAt: number,
  knownModifiedAt: number
): boolean {
  return originalModifiedAt > knownModifiedAt;
}

export function showConflictDialog(info: ConflictInfo): Promise<ConflictResolution> {
  return new Promise((resolve) => {
    // This would integrate with the app's modal system
    // For now, return a simple resolution
    resolve('overwrite');
  });
}
```

---

## Backend Command Design

### New Tauri Commands

```rust
// src-tauri/src/hex_commands.rs (new file)

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct HexReadRangeRequest {
    pub path: String,
    pub offset: u64,
    pub length: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct HexReadRangeResult {
    pub bytes: Vec<u8>,
    pub total_size: u64,
    pub offset: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct HexWriteBytesRequest {
    pub path: String,
    pub offset: u64,
    pub bytes: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct HexSearchRequest {
    pub path: String,
    pub query: Vec<u8>,
    pub start_offset: Option<u64>,
    pub max_results: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct HexSearchResult {
    pub matches: Vec<HexSearchMatch>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct HexSearchMatch {
    pub offset: u64,
    pub length: u64,
}

#[tauri::command]
#[specta::specta]
pub async fn hex_read_range(
    request: HexReadRangeRequest,
) -> Result<HexReadRangeResult, String> {
    let path = PathBuf::from(&request.path);
    let metadata = std::fs::metadata(&path)
        .map_err(|e| format!("Failed to read file metadata: {}", e))?;
    let total_size = metadata.len();
    
    let mut file = std::fs::File::open(&path)
        .map_err(|e| format!("Failed to open file: {}", e))?;
    
    use std::io::{Read, Seek, SeekFrom};
    file.seek(SeekFrom::Start(request.offset))
        .map_err(|e| format!("Failed to seek: {}", e))?;
    
    let mut buffer = vec![0u8; request.length as usize];
    file.read_exact(&mut buffer)
        .map_err(|e| format!("Failed to read: {}", e))?;
    
    Ok(HexReadRangeResult {
        bytes: buffer,
        total_size,
        offset: request.offset,
    })
}

#[tauri::command]
#[specta::specta]
pub async fn hex_write_bytes(
    request: HexWriteBytesRequest,
) -> Result<(), String> {
    let path = PathBuf::from(&request.path);
    
    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .open(&path)
        .map_err(|e| format!("Failed to open file for writing: {}", e))?;
    
    use std::io::{Seek, SeekFrom, Write};
    file.seek(SeekFrom::Start(request.offset))
        .map_err(|e| format!("Failed to seek: {}", e))?;
    
    file.write_all(&request.bytes)
        .map_err(|e| format!("Failed to write: {}", e))?;
    
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn hex_search(
    request: HexSearchRequest,
) -> Result<HexSearchResult, String> {
    // Implementation would use memory-mapped files for large files
    // or streaming search for very large files
    Ok(HexSearchResult { matches: vec![] })
}
```

### Extended Archive Commands

```rust
// src-tauri/src/archive_ops.rs (extensions)

// Add support for new archive formats

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ArchiveFormat {
    // Existing
    Zip,
    SevenZip,
    Tar,
    TarGz,
    TarBz2,
    TarXz,
    Gzip,
    Bzip2,
    Xz,
    // New
    Zstd,
    Lz4,
    Cab,
    Iso,
    Deb,
    Rpm,
    Apk,
    Whl,  // Python wheel (zip-based)
    Vsix, // VS Code extension (zip-based)
}

pub fn detect_archive_format(path: &Path) -> Option<ArchiveFormat> {
    let file_name = path.file_name()?.to_string_lossy().to_lowercase();
    
    // Check compound extensions first
    if file_name.ends_with(".tar.zst") || file_name.ends_with(".tzst") {
        return Some(ArchiveFormat::Zstd);
    }
    if file_name.ends_with(".tar.lz4") {
        return Some(ArchiveFormat::Lz4);
    }
    
    // Check single extensions
    let extension = file_name.split('.').last()?;
    match extension {
        "zst" => Some(ArchiveFormat::Zstd),
        "lz4" => Some(ArchiveFormat::Lz4),
        "cab" => Some(ArchiveFormat::Cab),
        "iso" | "img" => Some(ArchiveFormat::Iso),
        "deb" => Some(ArchiveFormat::Deb),
        "rpm" => Some(ArchiveFormat::Rpm),
        "apk" => Some(ArchiveFormat::Apk),
        "whl" => Some(ArchiveFormat::Whl),
        "vsix" => Some(ArchiveFormat::Vsix),
        // ... existing formats
        _ => None,
    }
}

pub fn inspect_zst_archive(path: &Path) -> Result<Vec<String>, String> {
    // Use zstd crate to decompress and list contents
    todo!("Implement zst inspection")
}

pub fn inspect_lz4_archive(path: &Path) -> Result<Vec<String>, String> {
    // Use lz4 crate to decompress and list contents
    todo!("Implement lz4 inspection")
}

pub fn inspect_iso_archive(path: &Path) -> Result<Vec<String>, String> {
    // Use iso9660 crate to list disc image contents
    todo!("Implement ISO inspection")
}

pub fn inspect_deb_archive(path: &Path) -> Result<Vec<String>, String> {
    // Debian packages are ar archives containing tar.gz
    // Use ar and tar crates
    todo!("Implement deb inspection")
}

pub fn inspect_rpm_archive(path: &Path) -> Result<Vec<String>, String> {
    // Use rpm crate to list package contents
    todo!("Implement rpm inspection")
}
```

### Camera RAW Commands

```rust
// src-tauri/src/raw_commands.rs (new file)

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct RawImageMetadata {
    pub camera_make: String,
    pub camera_model: String,
    pub lens_model: Option<String>,
    pub iso: u32,
    pub aperture: f32,
    pub shutter_speed: String,
    pub focal_length: f32,
    pub capture_date: String,
    pub width: u32,
    pub height: u32,
    pub bit_depth: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct RawImagePreviewRequest {
    pub path: String,
    pub max_dimension: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct RawImagePreviewResult {
    pub preview_data_url: String,
    pub metadata: RawImageMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct RawImageAdjustRequest {
    pub path: String,
    pub adjustments: RawImageAdjustments,
    pub max_dimension: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct RawImageAdjustments {
    pub exposure: f32,
    pub temperature: f32,
    pub tint: f32,
    pub contrast: f32,
    pub highlights: f32,
    pub shadows: f32,
    pub whites: f32,
    pub blacks: f32,
    pub clarity: f32,
    pub vibrance: f32,
    pub saturation: f32,
}

#[tauri::command]
#[specta::specta]
pub async fn raw_extract_preview(
    request: RawImagePreviewRequest,
) -> Result<RawImagePreviewResult, String> {
    // Use rawloader crate to extract embedded preview
    // and metadata
    todo!("Implement RAW preview extraction")
}

#[tauri::command]
#[specta::specta]
pub async fn raw_adjust_preview(
    request: RawImageAdjustRequest,
) -> Result<RawImagePreviewResult, String> {
    // Apply non-destructive adjustments to embedded preview
    todo!("Implement RAW adjustment")
}

#[tauri::command]
#[specta::specta]
pub async fn raw_export_image(
    path: String,
    adjustments: RawImageAdjustments,
    output_format: String,
) -> Result<Vec<u8>, String> {
    // Export adjusted image as JPEG or PNG
    todo!("Implement RAW export")
}
```

### Rust Crate Dependencies

```toml
# src-tauri/Cargo.toml additions

[dependencies]
# Extended archives
zstd = "0.13"
lz4 = "1.24"
# cab = "0.4"  # Cabinet archive support
# iso9660 = "0.1"  # ISO image support

# Camera RAW
rawloader = "0.37"
# exr = "1.72"  # OpenEXR support

# Data formats
# arrow = "50"  # Apache Arrow
# parquet = "50"  # Parquet files
serde_cbor = "0.11"
rmp-serde = "1.1"  # MessagePack

# Certificates
x509-parser = "0.15"
rcgen = "0.12"
ssh-key = "0.6"

# Geospatial (Phase 3)
# gdal = "0.16"  # GDAL bindings
# geojson = "0.24"
# las = "0.8"  # LiDAR

# Molecular (Phase 3)
# pdbtbx = "0.11"  # PDB parsing
```

---

## Performance Considerations

### Lazy Loading Strategy

1. **Code Splitting**: Each workbench component is lazy-loaded via React.lazy()
2. **Chunk Organization**: Related previews grouped into chunks
   - `preview-phase1.js`: Hex, Extended Archives, RAW Images
   - `preview-phase2.js`: Data Formats, Certificates, Subtitles
   - `preview-phase3.js`: Geospatial, Notebooks, Molecular
   - `preview-phase4.js`: Bio, LiDAR, Game Assets

### Memory Budget Enforcement

```typescript
// src/components/previews/PreviewMemoryManager.ts (new file)

const MEMORY_BUDGET_BYTES = 500 * 1024 * 1024; // 500MB

interface PreviewMemoryEntry {
  path: string;
  estimatedBytes: number;
  lastAccessed: number;
}

export class PreviewMemoryManager {
  private entries: Map<string, PreviewMemoryEntry> = new Map();
  private currentUsage: number = 0;
  
  register(path: string, estimatedBytes: number): void {
    if (this.currentUsage + estimatedBytes > MEMORY_BUDGET_BYTES) {
      this.evictOldest();
    }
    
    this.entries.set(path, {
      path,
      estimatedBytes,
      lastAccessed: Date.now(),
    });
    this.currentUsage += estimatedBytes;
  }
  
  access(path: string): void {
    const entry = this.entries.get(path);
    if (entry) {
      entry.lastAccessed = Date.now();
    }
  }
  
  release(path: string): void {
    const entry = this.entries.get(path);
    if (entry) {
      this.currentUsage -= entry.estimatedBytes;
      this.entries.delete(path);
    }
  }
  
  private evictOldest(): void {
    const sorted = [...this.entries.values()].sort((a, b) => 
      a.lastAccessed - b.lastAccessed
    );
    
    while (this.currentUsage > MEMORY_BUDGET_BYTES * 0.8 && sorted.length > 0) {
      const oldest = sorted.shift()!;
      this.release(oldest.path);
    }
  }
}
```

### File Size Limits Per Category

```typescript
// src/config/previewLimits.ts (new file)

export const PREVIEW_SIZE_LIMITS: Record<string, number> = {
  // Images
  image: 100 * 1024 * 1024,      // 100MB
  rawImage: 100 * 1024 * 1024,   // 100MB
  
  // Archives
  archive: 2 * 1024 * 1024 * 1024, // 2GB (metadata only for large)
  extendedArchive: 2 * 1024 * 1024 * 1024,
  
  // Geospatial
  geoRaster: 50 * 1024 * 1024,   // 50MB (full render)
  geoVector: 100 * 1024 * 1024,  // 100MB
  
  // Notebooks
  notebook: 10 * 1024 * 1024,    // 10MB
  
  // Data formats
  dataFormat: 500 * 1024 * 1024, // 500MB
  
  // Molecular
  molecular: 50 * 1024 * 1024,   // 50MB
  
  // LiDAR
  lidar: 500 * 1024 * 1024,      // 500MB (subsampled preview)
  
  // Hex viewer
  hex: Number.MAX_SAFE_INTEGER,  // No limit (streaming)
};

export function shouldRenderFullPreview(
  category: string,
  size: number
): boolean {
  const limit = PREVIEW_SIZE_LIMITS[category] ?? 50 * 1024 * 1024;
  return size <= limit;
}
```

### Caching Strategy

```typescript
// src/components/previews/PreviewCache.ts (new file)

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  size: number;
}

export class PreviewCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private maxSize: number = 100 * 1024 * 1024; // 100MB cache
  private currentSize: number = 0;
  private ttl: number = 5 * 60 * 1000; // 5 minutes
  
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > this.ttl) {
      this.delete(key);
      return null;
    }
    
    return entry.data as T;
  }
  
  set<T>(key: string, data: T, size: number): void {
    // Evict old entries if needed
    while (this.currentSize + size > this.maxSize && this.cache.size > 0) {
      const oldest = [...this.cache.entries()]
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
      if (oldest) {
        this.delete(oldest[0]);
      }
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      size,
    });
    this.currentSize += size;
  }
  
  delete(key: string): void {
    const entry = this.cache.get(key);
    if (entry) {
      this.currentSize -= entry.size;
      this.cache.delete(key);
    }
  }
  
  clear(): void {
    this.cache.clear();
    this.currentSize = 0;
  }
}
```

### Resource Cleanup

```typescript
// src/components/previews/PreviewCleanup.ts (new file)

export interface CleanupHandler {
  (): Promise<void>;
}

const cleanupHandlers = new Map<string, CleanupHandler>();

export function registerCleanupHandler(path: string, handler: CleanupHandler): void {
  cleanupHandlers.set(path, handler);
}

export function unregisterCleanupHandler(path: string): void {
  cleanupHandlers.delete(path);
}

export async function cleanupPreview(path: string): Promise<void> {
  const handler = cleanupHandlers.get(path);
  if (handler) {
    await handler();
    cleanupHandlers.delete(path);
  }
}

// Called when preview is closed or selection changes
export async function cleanupAllPreviews(): Promise<void> {
  const handlers = [...cleanupHandlers.values()];
  cleanupHandlers.clear();
  await Promise.all(handlers.map(h => h()));
}
```

---

## Phase 1 Implementation Detail

### File Structure

```
src/
├── config/
│   ├── previewRouter.ts          (new)
│   ├── previewTypes.ts           (new)
│   ├── previewMimeTypes.ts       (new)
│   ├── previewLimits.ts          (new)
│   └── filePreview.ts            (existing, extended)
│
├── components/
│   ├── previews/
│   │   ├── index.ts              (new - lazy exports)
│   │   ├── types.ts              (new)
│   │   ├── PreviewPanel.tsx      (new)
│   │   ├── PreviewErrorBoundary.tsx (new)
│   │   ├── editing/
│   │   │   ├── UndoRedoManager.ts    (new)
│   │   │   ├── AutoSaveManager.ts    (new)
│   │   │   ├── DraftPersistence.ts   (new)
│   │   │   ├── ValidationPipeline.ts (new)
│   │   │   └── ConflictResolution.ts (new)
│   │   │
│   │   ├── ExplorerHexWorkbench.tsx          (new)
│   │   ├── ExplorerExtendedArchiveWorkbench.tsx (new)
│   │   └── ExplorerRawImageWorkbench.tsx     (new)
│   │
│   └── FileExplorer.tsx         (existing, modified)
│
├── runtime/
│   ├── hexBackend.ts            (new)
│   ├── extendedArchiveBackend.ts (new)
│   └── rawImageBackend.ts       (new)
│
└── generated/
    └── tauri.ts                 (regenerated)

src-tauri/
├── src/
│   ├── hex_commands.rs          (new)
│   ├── raw_commands.rs          (new)
│   ├── archive_ops.rs           (existing, extended)
│   ├── lib.rs                   (existing, register new commands)
│   └── specta_bindings.rs       (existing, regenerate)
│
└── Cargo.toml                   (existing, add dependencies)
```

### Component Interfaces

```typescript
// src/components/previews/ExplorerHexWorkbench.tsx

import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { HexEditState, EditStateBase } from '../../config/previewTypes';
import { UndoRedoManager } from './editing/UndoRedoManager';

interface ExplorerHexWorkbenchProps {
  path: string;
  name: string;
  size: number;
  initialBytes: string;
  editState: HexEditState | null;
}

interface HexRow {
  offset: number;
  bytes: number[];
  ascii: string;
}

const BYTES_PER_ROW = 16;
const INITIAL_ROWS = 50;

export function ExplorerHexWorkbench({
  path,
  name,
  size,
  initialBytes,
  editState,
}: ExplorerHexWorkbenchProps): JSX.Element {
  const [rows, setRows] = useState<HexRow[]>([]);
  const [offset, setOffset] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [editMode, setEditMode] = useState<'hex' | 'ascii'>('hex');
  const [cursorPosition, setCursorPosition] = useState({ row: 0, col: 0 });
  
  const undoRedoRef = useRef(new UndoRedoManager<{ rows: HexRow[]; offset: number }>());
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  
  // Load initial data
  useEffect(() => {
    loadBytes(0, INITIAL_ROWS * BYTES_PER_ROW);
  }, [path]);
  
  const loadBytes = async (startOffset: number, length: number) => {
    // Call backend to read bytes
    // Update rows state
  };
  
  const handleByteEdit = useCallback((row: number, col: number, newValue: number) => {
    const previousRows = [...rows];
    
    // Update the byte
    const newRows = [...rows];
    newRows[row].bytes[col] = newValue;
    newRows[row].ascii = bytesToAscii(newRows[row].bytes);
    setRows(newRows);
    
    // Record for undo
    undoRedoRef.current.push({
      type: 'byte-edit',
      previousState: { rows: previousRows, offset },
      nextState: { rows: newRows, offset },
    });
    
    setCanUndo(undoRedoRef.current.canUndo());
    setIsDirty(true);
  }, [rows, offset]);
  
  const handleUndo = useCallback(() => {
    const action = undoRedoRef.current.undo();
    if (action) {
      setRows(action.previousState.rows);
      setOffset(action.previousState.offset);
    }
    setCanUndo(undoRedoRef.current.canUndo());
    setCanRedo(undoRedoRef.current.canRedo());
  }, []);
  
  const handleRedo = useCallback(() => {
    const action = undoRedoRef.current.redo();
    if (action) {
      setRows(action.nextState.rows);
      setOffset(action.nextState.offset);
    }
    setCanUndo(undoRedoRef.current.canUndo());
    setCanRedo(undoRedoRef.current.canRedo());
  }, []);
  
  const handleSave = useCallback(async () => {
    // Write modified bytes to file
    setIsDirty(false);
  }, []);
  
  return (
    <div className="hex-workbench">
      <div className="hex-toolbar">
        <span className="file-name">{name}</span>
        <span className="file-size">{formatSize(size)}</span>
        <input
          type="text"
          placeholder="Search (hex or ASCII)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button onClick={handleUndo} disabled={!canUndo}>Undo</button>
        <button onClick={handleRedo} disabled={!canRedo}>Redo</button>
        <button onClick={handleSave} disabled={!isDirty}>Save</button>
      </div>
      
      <div className="hex-content">
        <div className="hex-offset-column">
          {rows.map((row, i) => (
            <div key={i} className="hex-offset">
              {row.offset.toString(16).padStart(8, '0')}
            </div>
          ))}
        </div>
        
        <div className="hex-bytes-column">
          {rows.map((row, rowIndex) => (
            <div key={rowIndex} className="hex-row">
              {row.bytes.map((byte, colIndex) => (
                <span
                  key={colIndex}
                  className={`hex-byte ${cursorPosition.row === rowIndex && cursorPosition.col === colIndex ? 'cursor' : ''}`}
                  onClick={() => setCursorPosition({ row: rowIndex, col: colIndex })}
                >
                  {byte.toString(16).padStart(2, '0')}
                </span>
              ))}
            </div>
          ))}
        </div>
        
        <div className="hex-ascii-column">
          {rows.map((row, i) => (
            <div key={i} className="hex-ascii">{row.ascii}</div>
          ))}
        </div>
      </div>
      
      <div className="hex-status">
        Offset: {offset.toString(16)} | Edit Mode: {editMode} | {isDirty ? 'Modified' : 'Unchanged'}
      </div>
    </div>
  );
}

function bytesToAscii(bytes: number[]): string {
  return bytes.map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.').join('');
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
```

### Backend Command Signatures

```rust
// Phase 1 commands to register in lib.rs

// Hex viewer
hex_read_range(request: HexReadRangeRequest) -> Result<HexReadRangeResult, String>
hex_write_bytes(request: HexWriteBytesRequest) -> Result<(), String>
hex_search(request: HexSearchRequest) -> Result<HexSearchResult, String>

// Extended archives
archive_inspect_zst(path: String) -> Result<Vec<String>, String>
archive_inspect_lz4(path: String) -> Result<Vec<String>, String>
archive_inspect_iso(path: String) -> Result<Vec<String>, String>
archive_inspect_deb(path: String) -> Result<DebArchiveInfo, String>
archive_inspect_rpm(path: String) -> Result<RpmArchiveInfo, String>
archive_inspect_apk(path: String) -> Result<ApkArchiveInfo, String>
archive_inspect_whl(path: String) -> Result<WhlArchiveInfo, String>
archive_inspect_vsix(path: String) -> Result<VsixArchiveInfo, String>

// Camera RAW
raw_extract_preview(request: RawImagePreviewRequest) -> Result<RawImagePreviewResult, String>
raw_adjust_preview(request: RawImageAdjustRequest) -> Result<RawImagePreviewResult, String>
raw_export_image(path: String, adjustments: RawImageAdjustments, output_format: String) -> Result<Vec<u8>, String>
```

### State Management Approach

Phase 1 previews use local component state with optional integration into the existing explorer store:

```typescript
// src/store/explorerStore.ts (extensions)

// Add preview-specific state tracking
interface ExplorerPreviewState {
  activePreviewPath: string | null;
  previewMemoryUsage: number;
  previewEditStates: Map<string, EditStateBase>;
}

// Extend the store
interface ExplorerStore {
  // ... existing state
  
  // Preview state
  previewState: ExplorerPreviewState;
  setPreviewPath: (path: string | null) => void;
  updatePreviewEditState: (path: string, state: Partial<EditStateBase>) => void;
  clearPreviewEditState: (path: string) => void;
}
```

---

## Error Handling

### Error Categories

1. **Parse Errors**: File cannot be parsed (corrupted, wrong format)
2. **Size Errors**: File exceeds size limit for preview type
3. **Permission Errors**: Cannot read/write file
4. **Dependency Errors**: Required library/WASM module unavailable
5. **Memory Errors**: Memory budget exceeded

### Error Display

```typescript
// src/components/previews/PreviewError.tsx

interface PreviewErrorProps {
  state: PreviewState;
  error: Error;
}

export function PreviewError({ state, error }: PreviewErrorProps): JSX.Element {
  const errorCategory = categorizeError(error);
  
  return (
    <div className="preview-error">
      <div className="error-icon">{getErrorIcon(errorCategory)}</div>
      <div className="error-title">{getErrorTitle(errorCategory)}</div>
      <div className="error-message">{error.message}</div>
      
      {state.type !== 'none' && (
        <div className="file-info">
          <div>File: {state.name}</div>
          {'size' in state && <div>Size: {formatSize(state.size)}</div>}
        </div>
      )}
      
      {errorCategory === 'size' && (
        <button onClick={() => openInExternalApp(state.path)}>
          Open in External Application
        </button>
      )}
    </div>
  );
}
```

---

## Testing Strategy

### Unit Tests

- Extension detection functions
- MIME type mapping
- PreviewState type narrowing
- Undo/redo manager
- Auto-save manager
- Validation pipeline

### Integration Tests

- Preview router end-to-end
- Backend command execution
- File read/write operations
- Memory management

### Property-Based Tests

See Correctness Properties section below.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Hex Edit Round-Trip

*For any* valid hex edit sequence, writing the modified bytes and reading them back SHALL produce the exact modified values.

**Validates: Requirements 13.1, 13.2, 13.5**

### Property 2: Archive Inspection Idempotence

*For any* supported archive format, inspecting the archive multiple times SHALL produce identical entry lists.

**Validates: Requirements 6.1-6.18**

### Property 3: RAW Adjustment Non-Destructiveness

*For any* RAW image file, applying adjustments and exporting SHALL NOT modify the original file.

**Validates: Requirements 7.1-7.5**

### Property 4: Undo/Redo Cycle

*For any* editable preview, performing undo then redo SHALL restore the exact previous state.

**Validates: Requirements 22.4**

### Property 5: Preview Memory Budget

*For any* set of active previews, total memory usage SHALL NOT exceed 500MB.

**Validates: Requirements 19.5**

### Property 6: Preview Load Timeout

*For any* preview taking longer than 30 seconds to load, the system SHALL cancel the operation and display an error.

**Validates: Requirements 19.4**

### Property 7: Draft Recovery

*For any* file with unsaved changes when the application crashes, the draft SHALL be recoverable on next launch.

**Validates{}
: Requirements 22.6**

### Property 8: Certificate Private Key Protection

*For any* certificate or key file, the previewer SHALL NOT display or export private key material.

**Validates: Requirements 14.12**

---

## Extension Points

### Adding a New Preview Type

1. **Define the category** in `previewRouter.ts`:
   ```typescript
   {
     id: 'newType',
     label: 'New Type',
     extensions: ['ext1', 'ext2'],
     priority: 50,
     supportsEditing: false,
   }
   ```

2. **Add PreviewState variant** in `previewTypes.ts`:
   ```typescript
   | { type: 'newType'; path: string; name: string; /* ... */ }
   ```

3. **Create workbench component** in `previews/ExplorerNewTypeWorkbench.tsx`

4. **Add lazy export** in `previews/index.ts`

5. **Add case to PreviewPanel** router

6. **Implement backend commands** if needed

7. **Add tests** for detection and rendering

### Plugin Extension (Future)

The architecture supports future plugin-based preview extensions:

```typescript
interface PreviewPlugin {
  id: string;
  category: PreviewCategory;
  extensions: string[];
  workbenchComponent: React.ComponentType<WorkbenchPropsBase>;
  backendCommands?: BackendCommand[];
}
```

---

## Dependencies

### NPM Packages (Frontend)

| Category | Package | Purpose | Phase |
|----------|---------|---------|-------|
| Hex Viewer | Custom | Byte grid with editing | 1 |
| Archives | `libarchive.js` | Extended archive support | 1 |
| RAW Images | `raw-loader` (WASM) | Camera RAW decoding | 1 |
| EXR | `exr-loader` | OpenEXR decoding | 1 |
| Data | `apache-arrow` | Arrow/Parquet | 2 |
| Data | `cbor-x` | CBOR encoding | 2 |
| Data | `@msgpack/msgpack` | MessagePack | 2 |
| Certs | `node-forge` | Certificate parsing | 2 |
| Subtitles | Custom | SRT/VTT/ASS parsing | 2 |
| Geo | `geotiff` | GeoTIFF parsing | 3 |
| Geo | `leaflet` | Map rendering | 3 |
| Geo | `shapefile` | Shapefile parsing | 3 |
| Notebooks | `@jupyterlab/nbformat` | Notebook parsing | 3 |
| Molecular | `3dmol` | Molecular visualization | 3 |
| Bio | Custom | FASTA/FASTQ parsing | 4 |

### Rust Crates (Backend)

| Category | Crate | Purpose | Phase |
|----------|-------|---------|-------|
| Archives | `zstd` | Zstandard compression | 1 |
| Archives | `lz4` | LZ4 compression | 1 |
| RAW | `rawloader` | Camera RAW | 1 |
| RAW | `kamadak-exr` | OpenEXR | 1 |
| Data | `arrow` | Apache Arrow | 2 |
| Data | `parquet` | Parquet files | 2 |
| Data | `serde_cbor` | CBOR | 2 |
| Data | `rmp-serde` | MessagePack | 2 |
| Certs | `x509-parser` | X.509 parsing | 2 |
| Certs | `rcgen` | Certificate generation | 2 |
| Certs | `ssh-key` | SSH key generation | 2 |
| Geo | `gdal` | GDAL bindings | 3 |
| Geo | `geojson` | GeoJSON | 3 |
| LiDAR | `las` | LAS/LAZ | 4 |

---

## Implementation Phases

### Phase 1 (P0): High-Value, Low-Complexity

**Duration**: 2-3 weeks

**Deliverables**:
- Extended Archives (zst, lz4, cab, iso, deb, rpm, apk, whl, vsix)
- Hex Viewer with editing
- Camera RAW with non-destructive adjustments

**Dependencies**:
- `zstd`, `lz4` crates
- `rawloader` crate
- Custom hex viewer component

### Phase 2 (P1): Medium-Complexity

**Duration**: 3-4 weeks

**Deliverables**:
- Office Documents (PPTX slide reordering, RTF editing)
- Data Formats (Parquet, Arrow, CBOR, MessagePack)
- Certificates (viewing, generation, export)
- Subtitles (SRT, VTT, ASS with timing/text editing)

**Dependencies**:
- `apache-arrow`, `parquet` crates
- `x509-parser`, `rcgen` crates
- Custom subtitle editor component

### Phase 3 (P2): High-Complexity

**Duration**: 4-5 weeks

**Deliverables**:
- Geospatial Raster (GeoTIFF, DEM, NetCDF)
- Geospatial Vector (Shapefile, GeoJSON with editing)
- Jupyter Notebooks (cell editing, no execution)
- Molecular Structures (3D visualization, bond rotation)

**Dependencies**:
- `gdal` crate (optional, may use WASM)
- `geotiff`, `leaflet` npm packages
- `@jupyterlab/nbformat` npm package
- `3dmol` npm package

### Phase 4 (P3): Specialized

**Duration**: 3-4 weeks

**Deliverables**:
- LiDAR/Point Cloud (LAS, LAZ, E57)
- Bioinformatics (FASTA, FASTQ, BAM, VCF)
- Game Engine Assets (USS, uasset, PAK, VTF)

**Dependencies**:
- `las` crate
- Custom bio parsing
- Game asset format libraries

---

## Out of Scope

- Real-time collaboration on previewed documents
- Full kernel execution for Jupyter notebooks (editing only)
- RAW file development (non-destructive adjustments on embedded preview only)
- Full CAD editing for DWG/DXF files
- 3D modeling operations for molecular structures
- Private key extraction from PKCS#12/KeyStore files
- Game engine asset creation or complex modification
- LiDAR point cloud editing
- Bioinformatics sequence analysis tools
- Geospatial raster editing
