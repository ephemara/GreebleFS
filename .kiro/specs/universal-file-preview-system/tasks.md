# Implementation Plan: Universal File Preview System

## Overview

This implementation plan extends GreebleFS's preview capabilities to support 150+ additional file types across 16 major categories, organized into 4 phases. The system adds new PreviewState variants, workbench components, backend commands, and an editing framework while maintaining backward compatibility with existing previews.

**Implementation Approach**: Each phase builds incrementally on previous work. Phase 1 establishes core infrastructure (preview router, type system, editing framework) that subsequent phases leverage. All workbench components are lazy-loaded for performance.

**Technology Stack**: TypeScript/React for frontend workbenches, Rust/Tauri for backend commands, Specta for type-safe bindings.

---

## Tasks

### Phase 1: Core Infrastructure & High-Value Previews

- [ ] 1. Set up preview router infrastructure
  - Create `src/config/previewRouter.ts` with `PreviewCategory` type and `PreviewCategoryDefinition` interface
  - Create `src/config/previewTypes.ts` with all new PreviewState variant interfaces
  - Create `src/config/previewMimeTypes.ts` with MIME type mappings for new formats
  - Create `src/config/previewLimits.ts` with file size limits per category
  - Create `src/config/previewContentDetection.ts` for content-based format detection
  - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6_

- [ ] 2. Extend PreviewState type in FileExplorer
  - Add new PreviewState variants to the discriminated union in `src/components/FileExplorer.tsx`
  - Ensure backward compatibility with existing preview types (image, audio, video, font, sqlite, pdf, text, model3d, folder, archive, docx, spreadsheet)
  - Add type guards for new preview categories
  - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5_

- [ ] 3. Create editing framework infrastructure
  - [ ] 3.1 Implement UndoRedoManager in `src/components/previews/editing/UndoRedoManager.ts`
    - Create generic UndoRedoManager class with configurable history depth (default 50)
    - Implement push, undo, redo, canUndo, canRedo, clear methods
    - _Requirements: 22.4_

  - [ ] 3.2 Implement AutoSaveManager in `src/components/previews/editing/AutoSaveManager.ts`
    - Create AutoSaveManager with configurable interval (default 60s) and debounce (default 1s)
    - Implement start, stop, notifyChange, and triggerSave methods
    - _Requirements: 22.6_

  - [ ] 3.3 Implement DraftPersistence in `src/components/previews/editing/DraftPersistence.ts`
    - Create saveDraft, loadDraft, clearDraft functions using Tauri filesystem
    - Store drafts in app-local preview-drafts directory
    - _Requirements: 22.6, 22.9_

  - [ ] 3.4 Implement ValidationPipeline in `src/components/previews/editing/ValidationPipeline.ts`
    - Create generic ValidationPipeline with addValidator and validate methods
    - Implement jsonValidator and geoJsonValidator as example validators
    - _Requirements: 22.8_

  - [ ] 3.5 Implement ConflictResolution in `src/components/previews/editing/ConflictResolution.ts`
    - Create detectConflict function comparing modification timestamps
    - Define ConflictResolution type ('overwrite' | 'keep-original' | 'save-as' | 'cancel')
    - _Requirements: 22.3_

- [ ] 4. Create PreviewPanel router component
  - Create `src/components/previews/PreviewPanel.tsx` with switch on PreviewState.type
  - Create `src/components/previews/PreviewErrorBoundary.tsx` for error handling
  - Create `src/components/previews/PreviewLoading.tsx` for loading states
  - Create `src/components/previews/PreviewError.tsx` for error display
  - Integrate ErrorBoundary and Suspense for lazy loading
  - _Requirements: 19.3, 20.1, 20.2, 20.3, 20.4, 20.5, 20.6_

- [ ] 5. Implement Hex Viewer workbench
  - [ ] 5.1 Create hex viewer backend commands in `src-tauri/src/hex_commands.rs`
    - Implement `hex_read_range` command for reading byte ranges
    - Implement `hex_write_bytes` command for writing byte modifications
    - Implement `hex_search` command for byte sequence search
    - Define HexReadRangeRequest, HexReadRangeResult, HexWriteBytesRequest, HexSearchRequest, HexSearchResult types
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7_

  - [ ] 5.2 Create hex viewer runtime in `src/runtime/hexBackend.ts`
    - Create typed functions wrapping Tauri commands
    - Implement streaming read for large files
    - _Requirements: 13.1, 13.3_

  - [ ] 5.3 Create ExplorerHexWorkbench component in `src/components/previews/ExplorerHexWorkbench.tsx`
    - Implement byte grid with offset, hex, and ASCII columns
    - Implement virtualized scrolling for large files
    - Implement edit mode (hex and ASCII)
    - Integrate UndoRedoManager for byte edits
    - Implement search functionality
    - Display file size and entropy statistics
    - Highlight magic bytes and file signatures
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7_

  - [ ] 5.4 Implement hex viewer editing features
    - Allow editing individual bytes in hex or ASCII mode
    - Support undo/redo for byte edits
    - Allow searching for byte sequences
    - Allow replacing byte sequences
    - Save modified files with new name or overwrite
    - Display diff view showing modified bytes
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_

  - [ ]* 5.5 Write property tests for hex viewer
    - **Property 1: Hex Edit Round-Trip** - For any valid hex edit sequence, writing modified bytes and reading back SHALL produce exact modified values
    - **Validates: Requirements 13.1, 13.2, 13.5**

- [ ] 6. Implement Extended Archive preview
  - [ ] 6.1 Extend archive_ops.rs for new formats
    - Add ArchiveFormat enum variants: Zstd, Lz4, Cab, Iso, Deb, Rpm, Apk, Whl, Vsix
    - Implement detect_archive_format for new extensions
    - Add zstd and lz4 crate dependencies to Cargo.toml
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.15, 6.16_

  - [ ] 6.2 Implement archive inspection commands
    - Implement `archive_inspect_zst` for Zstandard archives
    - Implement `archive_inspect_lz4` for LZ4 archives
    - Implement `archive_inspect_iso` for ISO disc images
    - Implement `archive_inspect_deb` for Debian packages (ar + tar.gz)
    - Implement `archive_inspect_rpm` for RPM packages
    - Implement `archive_inspect_apk` for Android packages (zip-based with manifest)
    - Implement `archive_inspect_whl` for Python wheels (zip-based with metadata)
    - Implement `archive_inspect_vsix` for VS Code extensions (zip-based with package.json)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.15, 6.16_

  - [ ] 6.3 Create extended archive runtime in `src/runtime/extendedArchiveBackend.ts`
    - Create typed functions for each archive inspection command
    - Define ExtendedArchiveMetadata interface
    - _Requirements: 6.17, 6.18_

  - [ ] 6.4 Create ExplorerExtendedArchiveWorkbench component
    - Display archive format, entry count, sizes, and compression ratio
    - Show file tree with nested archive support
    - Display manifest content for APK, WHL, VSIX
    - Support extraction of individual files
    - _Requirements: 6.1-6.18_

  - [ ]* 6.5 Write property tests for archive inspection
    - **Property 2: Archive Inspection Idempotence** - For any supported archive format, inspecting multiple times SHALL produce identical entry lists
    - **Validates: Requirements 6.1-6.18**

- [ ] 7. Implement Camera RAW image preview
  - [ ] 7.1 Create RAW image backend commands in `src-tauri/src/raw_commands.rs`
    - Add rawloader crate dependency to Cargo.toml
    - Implement `raw_extract_preview` command for embedded preview extraction
    - Implement `raw_adjust_preview` command for non-destructive adjustments
    - Implement `raw_export_image` command for JPEG/PNG export
    - Define RawImageMetadata, RawImageAdjustments, RawImagePreviewRequest, RawImagePreviewResult types
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11, 7.12, 7.13_

  - [ ] 7.2 Create RAW image runtime in `src/runtime/rawImageBackend.ts`
    - Create typed functions wrapping Tauri commands
    - Define RawImageAdjustments interface with exposure, temperature, tint, contrast, highlights, shadows, whites, blacks, clarity, vibrance, saturation
    - _Requirements: 7.1-7.13_

  - [ ] 7.3 Create ExplorerRawImageWorkbench component
    - Display embedded preview image
    - Show EXIF metadata (camera model, ISO, aperture, shutter speed, capture date)
    - Implement adjustment sliders for exposure, temperature, tint, contrast, etc.
    - Implement before/after comparison toggle
    - Implement export to JPEG/PNG (non-destructive)
    - _Requirements: 7.1-7.13, 7.1-7.8 (Editing)_

  - [ ] 7.4 Implement RAW image editing features
    - Allow exposure adjustment (+/- EV)
    - Allow white balance adjustment with temperature/tint controls
    - Allow contrast, highlights, shadows, blacks adjustments
    - Provide crop and rotate tools
    - Export adjusted image as JPEG or PNG (non-destructive)
    - _Requirements: 7.1-7.8 (Editing)_

  - [ ]* 7.5 Write property tests for RAW image handling
    - **Property 3: RAW Adjustment Non-Destructiveness** - For any RAW image file, applying adjustments and exporting SHALL NOT modify the original file
    - **Validates: Requirements 7.1-7.5 (Editing)**

- [ ] 8. Create lazy loading exports in `src/components/previews/index.ts`
  - Export ExplorerHexWorkbench as lazy component
  - Export ExplorerExtendedArchiveWorkbench as lazy component
  - Export ExplorerRawImageWorkbench as lazy component
  - _Requirements: 19.3_

- [ ] 9. Register Phase 1 commands in lib.rs
  - Register hex_commands module
  - Register raw_commands module
  - Register extended archive commands
  - Update specta_bindings.rs for new types
  - Regenerate TypeScript bindings
  - _Requirements: 17.1, 17.2_

- [ ] 10. Checkpoint - Phase 1 validation
  - Ensure all Phase 1 tests pass
  - Verify lazy loading works correctly
  - Verify memory budget enforcement
  - Ask the user if questions arise.

---

### Phase 2: Office Documents, Data Formats, Certificates, Subtitles

- [ ] 11. Implement Office Document previews
  - [ ] 11.1 Create PPTX preview backend
    - Implement `pptx_parse` command to extract slide metadata and thumbnails
    - Implement `pptx_save` command for slide reordering/deletion
    - Define PptxMetadata, PptxSlide types
    - _Requirements: 9.1, 9.2, 9.3_

  - [ ] 11.2 Create ExplorerPptxWorkbench component
    - Render slide thumbnails in scrollable list
    - Display slide count and presentation metadata
    - Implement slide reordering via drag and drop
    - Implement slide deletion and duplication
    - Save changes back to .pptx file
    - _Requirements: 9.1, 9.2, 9.3, 9.1-9.4 (Editing)_

  - [ ] 11.3 Create ODT/ODP preview support
    - Implement OpenDocument text rendering
    - Implement OpenDocument presentation slide thumbnails
    - _Requirements: 9.4, 9.5_

  - [ ] 11.4 Create RTF preview and editor
    - Implement RTF parsing and rendering
    - Allow text editing with basic formatting (bold, italic, underline)
    - Save changes back to .rtf file
    - _Requirements: 9.6, 9.6 (Editing)_

  - [ ] 11.5 Create EPUB preview support
    - Implement EPUB rendering with navigation
    - Display book content with chapter navigation
    - _Requirements: 9.8_

  - [ ]* 11.6 Write unit tests for office document previews
    - Test PPTX slide reordering round-trip
    - Test RTF formatting preservation
    - _Requirements: 9.1-9.11_

- [ ] 12. Implement Data Format previews
  - [ ] 12.1 Create data format backend commands in `src-tauri/src/data_commands.rs`
    - Add arrow, parquet, serde_cbor, rmp-serde crate dependencies
    - Implement `data_read_parquet` command for schema and sample rows
    - Implement `data_read_arrow` command for Arrow/Feather files
    - Implement `data_read_cbor` command for CBOR decoding
    - Implement `data_read_msgpack` command for MessagePack decoding
    - Implement `data_write_parquet`, `data_write_cbor`, `data_write_msgpack` for edits
    - Define DataFormatSchema, DataFormatPreview types
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ] 12.2 Create data format runtime in `src/runtime/dataFormatBackend.ts`
    - Create typed functions for each data format command
    - Define DataFormatSchema interface with fields, types, nullable flags
    - _Requirements: 10.1-10.19_

  - [ ] 12.3 Create ExplorerDataFormatWorkbench component
    - Display schema with field names, types, and nullability
    - Render data table with first 100 rows
    - Support column sorting
    - Display column statistics when available
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.19_

  - [ ] 12.4 Implement data format editing features
    - Allow editing cell values in data table
    - Allow adding and deleting rows
    - Export modified data to CSV, JSON, or new Parquet file
    - Allow editing JSON representation for CBOR/MessagePack
    - _Requirements: 10.1-10.8 (Editing)_

  - [ ] 12.5 Create schema file previews (proto, fbs, capnp, thrift, graphql, hcl, etc.)
    - Add Monaco language support for proto, graphql, hcl, thrift, capnp, fbs
    - Implement syntax highlighting and validation
    - Allow editing with save back to original file
    - _Requirements: 10.6, 10.7, 10.8, 10.9, 10.10, 10.11, 10.12, 10.13, 10.14, 10.15, 10.16, 10.17, 10.18_

  - [ ]* 12.6 Write property tests for data format round-trips
    - **CBOR/JSON Round-Trip** - For any valid JSON object, encoding to CBOR then decoding SHALL produce equivalent JSON
    - **MessagePack/JSON Round-Trip** - For any valid JSON object, encoding to MessagePack then decoding SHALL produce equivalent JSON
    - **Validates: Requirements 10.4, 10.5, 10.5-10.7 (Editing)**

- [ ] 13. Implement Certificate preview
  - [ ] 13.1 Create certificate backend commands in `src-tauri/src/cert_commands.rs`
    - Add x509-parser, rcgen, ssh-key crate dependencies
    - Implement `cert_parse` command for X.509 certificate parsing
    - Implement `cert_generate` command for self-signed certificate generation
    - Implement `cert_generate_csr` command for CSR generation
    - Implement `ssh_key_generate` command for SSH key pair generation
    - Define CertificateMetadata, CertificateGenerateRequest, SshKeyGenerateRequest types
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 14.9, 14.10, 14.11, 14.12_

  - [ ] 13.2 Create certificate runtime in `src/runtime/certificateBackend.ts`
    - Create typed functions for certificate commands
    - Define CertificateMetadata interface with subject, issuer, validity, SANs, etc.
    - _Requirements: 14.1-14.12_

  - [ ] 13.3 Create ExplorerCertificateWorkbench component
    - Display certificate details (subject, issuer, validity, serial number)
    - Display Subject Alternative Names
    - Display certificate chain if multiple certificates present
    - Show validity warnings for expired/soon-to-expire certificates
    - Display SSH public key type, fingerprint, and comment
    - _Requirements: 14.1-14.12_

  - [ ] 13.4 Implement certificate editing features
    - Allow exporting certificates to PEM or DER format
    - Allow exporting certificate chain as bundle
    - Allow generating new self-signed certificate with user parameters
    - Allow generating new CSR from user parameters
    - Allow generating new SSH key pairs (ed25519, rsa, ecdsa)
    - Allow converting between PEM and DER formats
    - _Requirements: 14.1-14.8 (Editing)_

  - [ ]* 13.5 Write property tests for certificate handling
    - **Property 8: Certificate Private Key Protection** - For any certificate or key file, the previewer SHALL NOT display or export private key material
    - **Validates: Requirements 14.12**

- [ ] 14. Implement Subtitle preview
  - [ ] 14.1 Create subtitle parsing in frontend
    - Implement SRT parser with timing and text extraction
    - Implement VTT parser with styling cues
    - Implement ASS/SSA parser with style information
    - Define SubtitleEntry interface with index, startTime, endTime, text, style
    - _Requirements: 15.1, 15.2, 15.3, 15.4_

  - [ ] 14.2 Create ExplorerSubtitleWorkbench component
    - Display subtitles with timing information in list view
    - Show subtitle count and total duration
    - Implement timeline visualization
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.9_

  - [ ] 14.3 Implement subtitle editing features
    - Allow editing subtitle text content
    - Allow adjusting timing via time input or drag handles
    - Allow adding new subtitle entries
    - Allow deleting subtitle entries
    - Allow merging adjacent subtitles
    - Allow splitting a subtitle into multiple entries
    - Support converting between SRT, VTT, and ASS formats
    - Save changes back to original file format
    - _Requirements: 15.1-15.9 (Editing)_

  - [ ]* 14.4 Write property tests for subtitle format conversion
    - **Subtitle Format Conversion** - For any valid SRT file, converting to VTT and back SHALL preserve timing and text content
    - **Validates: Requirements 15.1-15.9 (Editing)**

- [ ] 15. Implement Playlist preview
  - Create M3U/M3U8/PLS playlist parser
  - Display playlist entries with metadata
  - Allow reordering entries via drag and drop
  - Allow adding and removing entries
  - Save changes back to playlist file
  - _Requirements: 15.5, 15.6, 15.7, 15.8, 9-11 (Editing)_

- [ ] 16. Update lazy exports for Phase 2
  - Export ExplorerPptxWorkbench, ExplorerDataFormatWorkbench, ExplorerCertificateWorkbench, ExplorerSubtitleWorkbench
  - Add cases to PreviewPanel router
  - _Requirements: 19.3_

- [ ] 17. Register Phase 2 commands in lib.rs
  - Register data_commands module
  - Register cert_commands module
  - Update specta_bindings.rs
  - Regenerate TypeScript bindings
  - _Requirements: 17.1, 17.2_

- [ ] 18. Checkpoint - Phase 2 validation
  - Ensure all Phase 2 tests pass
  - Verify editing framework integration
  - Ask the user if questions arise.

---

### Phase 3: Geospatial, Notebooks, Molecular

- [ ] 19. Implement Geospatial Raster preview
  - [ ] 19.1 Create geospatial backend commands in `src-tauri/src/geo_commands.rs`
    - Add gdal crate dependency (optional, may use WASM alternative)
    - Implement `geo_read_raster_meta` command for GeoTIFF/DEM metadata
    - Implement `geo_render_thumbnail` command for raster preview
    - Define GeoRasterMetadata type with CRS, bounds, dimensions, band info
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10_

  - [ ] 19.2 Create geospatial runtime in `src/runtime/geoBackend.ts`
    - Create typed functions for geospatial commands
    - Add geotiff npm package for frontend parsing
    - _Requirements: 1.1-1.10_

  - [ ] 19.3 Create ExplorerGeoRasterWorkbench component
    - Display projection information and CRS definition
    - Display geographic bounds and dimensions
    - Display band metadata and statistics
    - Render raster thumbnail/heatmap
    - For DEM files, display elevation statistics and terrain visualization
    - For NetCDF, display variable metadata and heatmap
    - _Requirements: 1.1-1.10_

  - [ ]* 19.4 Write unit tests for geospatial raster
    - Test GeoTIFF metadata extraction
    - Test DEM elevation statistics
    - _Requirements: 1.1-1.10_

- [ ] 20. Implement Geospatial Vector preview
  - [ ] 20.1 Create vector backend commands
    - Implement `geo_read_vector` command for Shapefile/GeoJSON parsing
    - Define GeoVectorMetadata type with geometry type, feature count, bounds, properties
    - _Requirements: 2.1-2.16_

  - [ ] 20.2 Create ExplorerGeoVectorWorkbench component
    - Add leaflet or maplibre-gl-js npm package
    - Render interactive map with pan and zoom controls
    - Display geometry type, feature count, bounding box
    - Display attribute table with sortable columns
    - _Requirements: 2.1, 2.2, 2.15, 2.16_

  - [ ] 20.3 Implement GeoJSON editing features
    - Add leaflet-draw npm package
    - Allow editing feature properties in attribute table
    - Allow adding new features via drawing tools
    - Allow deleting features
    - Allow modifying geometry via vertex editing
    - Support undo/redo for geometry and property edits
    - Save changes back to .geojson file
    - _Requirements: 2.1-2.8 (Editing)_

  - [ ] 20.4 Implement GPX preview and editing
    - Parse GPS tracks and waypoints
    - Render on map with track visualization
    - Allow editing track names and waypoint metadata
    - Allow deleting track points and waypoints
    - _Requirements: 2.6, 2.7-2.8 (Editing)_

  - [ ] 20.5 Implement KML/KMZ preview
    - Parse KML placemarks, paths, and polygons
    - Render on map
    - Handle KMZ extraction
    - _Requirements: 2.7, 2.8_

  - [ ] 20.6 Implement additional vector formats
    - Implement TopoJSON parsing and conversion
    - Implement GeoPackage layer listing and rendering
    - Implement MBTiles tile metadata display
    - Implement OSM XML parsing with node/way/relation counts
    - Implement GML parsing and rendering
    - Implement DXF 2D vector geometry rendering
    - _Requirements: 2.5, 2.9, 2.10, 2.11, 2.12, 2.13_

  - [ ]* 20.7 Write property tests for GeoJSON round-trip
    - **GeoJSON Parse/Serialize** - For any valid GeoJSON object, parsing then serializing SHALL produce semantically equivalent GeoJSON
    - **Validates: Requirements 2.3, 2.4, 2.1-2.6 (Editing)**

- [ ] 21. Implement Jupyter Notebook preview
  - [ ] 21.1 Create notebook backend commands in `src-tauri/src/notebook_commands.rs`
    - Implement `notebook_parse` command for .ipynb JSON parsing
    - Implement `notebook_save` command for saving modified notebooks
    - Define NotebookCell type with id, type, source, outputs, executionCount, metadata
    - _Requirements: 4.1-4.7, 4.1-4.8 (Editing)_

  - [ ] 21.2 Create notebook runtime in `src/runtime/notebookBackend.ts`
    - Add @jupyterlab/nbformat npm package
    - Create typed functions for notebook commands
    - _Requirements: 4.1-4.7_

  - [ ] 21.3 Create ExplorerNotebookWorkbench component
    - Parse notebook JSON and render cells
    - Render markdown cells with proper formatting
    - Render code cells with Monaco syntax highlighting
    - Display output cells (text, images, tables, errors)
    - Display execution counts and cell metadata
    - Render embedded base64 images
    - _Requirements: 4.1-4.7_

  - [ ] 21.4 Implement notebook editing features
    - Allow editing markdown cells with live preview
    - Allow editing code cells with Monaco editor
    - Support adding new cells (markdown and code)
    - Support deleting cells
    - Support reordering cells via drag and drop
    - Display unsaved changes indicator
    - Save changes preserving notebook format (NO kernel execution)
    - _Requirements: 4.1-4.8 (Editing)_

  - [ ]* 21.5 Write unit tests for notebook parsing
    - Test cell rendering
    - Test cell reordering round-trip
    - _Requirements: 4.1-4.7_

- [ ] 22. Implement Molecular Structure preview
  - [ ] 22.1 Create molecular backend commands in `src-tauri/src/molecular_commands.rs`
    - Add pdbtbx crate dependency for PDB parsing
    - Implement `molecular_parse` command for PDB/MOL/SDF parsing
    - Define MolecularMetadata type with atom count, bond count, molecular weight, formula
    - _Requirements: 12.1-12.9, 12.1-12.6 (Editing)_

  - [ ] 22.2 Create molecular runtime in `src/runtime/molecularBackend.ts`
    - Add 3dmol or ngl npm package
    - Create typed functions for molecular commands
    - _Requirements: 12.1-12.9_

  - [ ] 22.3 Create ExplorerMolecularWorkbench component
    - Render 3D visualization with orbit controls
    - Display atom count, bond count, molecular weight, formula
    - Support representation modes (ball-and-stick, space-filling, ribbon, wireframe)
    - Support color schemes (element, residue, chain, secondary structure)
    - _Requirements: 12.1-12.9_

  - [ ] 22.4 Implement molecular editing features
    - Allow rotating bonds by selecting and dragging
    - Allow changing representation mode
    - Allow color scheme selection
    - Allow exporting current view as PNG
    - Allow exporting to different formats (PDB to MOL, MOL to XYZ)
    - Allow editing metadata/properties in SDF files
    - _Requirements: 12.1-12.6 (Editing)_

  - [ ]* 22.5 Write unit tests for molecular parsing
    - Test PDB parsing
    - Test 3D rendering initialization
    - _Requirements: 12.1-12.9_

- [ ] 23. Update lazy exports for Phase 3
  - Export ExplorerGeoRasterWorkbench, ExplorerGeoVectorWorkbench, ExplorerNotebookWorkbench, ExplorerMolecularWorkbench
  - Add cases to PreviewPanel router
  - _Requirements: 19.3_

- [ ] 24. Register Phase 3 commands in lib.rs
  - Register geo_commands module
  - Register notebook_commands module
  - Register molecular_commands module
  - Update specta_bindings.rs
  - Regenerate TypeScript bindings
  - _Requirements: 17.1, 17.2_

- [ ] 25. Checkpoint - Phase 3 validation
  - Ensure all Phase 3 tests pass
  - Verify map rendering performance
  - Verify 3D molecular visualization
  - Ask the user if questions arise.

---

### Phase 4: LiDAR, Bioinformatics, Game Assets

- [ ] 26. Implement LiDAR Point Cloud preview
  - [ ] 26.1 Create LiDAR backend commands in `src-tauri/src/lidar_commands.rs`
    - Add las crate dependency
    - Implement `lidar_parse` command for LAS/LAZ parsing
    - Define LidarMetadata type with point count, bounds, dimensions, format version
    - _Requirements: 3.1-3.7_

  - [ ] 26.2 Create LiDAR runtime in `src/runtime/lidarBackend.ts`
    - Create typed functions for LiDAR commands
    - _Requirements: 3.1-3.7_

  - [ ] 26.3 Create ExplorerLidarWorkbench component
    - Display point count, bounding box, available dimensions
    - Render 3D visualization with orbit controls for files under 5M points
    - Display classification breakdown when available
    - For files over 10M points, display metadata only with subsampled preview
    - _Requirements: 3.1-3.7_

  - [ ]* 26.4 Write unit tests for LiDAR parsing
    - Test LAS/LAZ header parsing
    - Test point count accuracy
    - _Requirements: 3.1-3.7_

- [ ] 27. Implement Bioinformatics Sequence preview
  - [ ] 27.1 Create bio sequence parsing in frontend
    - Implement FASTA parser with sequence coloring
    - Implement FASTQ parser with quality score visualization
    - Implement SAM/BAM metadata display
    - Implement VCF variant call display
    - Implement BED/GFF/GTF genomic region display
    - Define BioSequenceMetadata type
    - _Requirements: 11.1-11.10_

  - [ ] 27.2 Create ExplorerBioSequenceWorkbench component
    - Display sequences with syntax coloring for nucleotides/amino acids
    - Display sequence length, GC content, header information
    - Display quality scores for FASTQ
    - Display alignment data in tabular format for SAM
    - Display variant calls in tabular format for VCF
    - Support sequence search within preview
    - _Requirements: 11.1-11.10_

  - [ ]* 27.3 Write unit tests for bio sequence parsing
    - Test FASTA parsing
    - Test GC content calculation
    - _Requirements: 11.1-11.10_

- [ ] 28. Implement Game Engine Asset preview
  - [ ] 28.1 Create game asset backend commands in `src-tauri/src/game_commands.rs`
    - Implement `game_parse_pak` command for PAK archive listing
    - Implement `game_parse_blend` command for Blender metadata
    - Define GameAssetMetadata type
    - _Requirements: 16.1-16.12_

  - [ ] 28.2 Create ExplorerGameAssetWorkbench component
    - Display USS with Monaco syntax highlighting
    - Display uasset metadata and property list
    - List PAK archive contents
    - Display VMT material definitions
    - Decode and display VTF textures
    - Display MDL model metadata
    - Display BSP map metadata and entity list
    - Display Blender scene metadata and object list
    - Display Maya ASCII file content
    - Display Maya binary file metadata
    - Display "Open in Houdini" fallback for .hip files
    - _Requirements: 16.1-16.12_

  - [ ]* 28.3 Write unit tests for game asset parsing
    - Test PAK archive listing
    - Test VTF texture decoding
    - _Requirements: 16.1-16.12_

- [ ] 29. Update lazy exports for Phase 4
  - Export ExplorerLidarWorkbench, ExplorerBioSequenceWorkbench, ExplorerGameAssetWorkbench
  - Add cases to PreviewPanel router
  - _Requirements: 19.3_

- [ ] 30. Register Phase 4 commands in lib.rs
  - Register lidar_commands module
  - Register game_commands module
  - Update specta_bindings.rs
  - Regenerate TypeScript bindings
  - _Requirements: 17.1, 17.2_

- [ ] 31. Checkpoint - Phase 4 validation
  - Ensure all Phase 4 tests pass
  - Verify point cloud rendering performance
  - Ask the user if questions arise.

---

### Cross-Phase: Performance, Memory, and Error Handling

- [ ] 32. Implement PreviewMemoryManager
  - Create `src/components/previews/PreviewMemoryManager.ts`
  - Implement 500MB memory budget enforcement
  - Implement LRU eviction for cached previews
  - Track memory usage per preview
  - _Requirements: 19.5_

- [ ] 33. Implement PreviewCache
  - Create `src/components/previews/PreviewCache.ts`
  - Implement 100MB cache with 5-minute TTL
  - Support get, set, delete, clear operations
  - _Requirements: 19.5_

- [ ] 34. Implement PreviewCleanup
  - Create `src/components/previews/PreviewCleanup.ts`
  - Register cleanup handlers per preview
  - Clean up resources when preview closes or selection changes
  - _Requirements: 19.8_

- [ ] 35. Implement comprehensive error handling
  - Create error categorization (parse, size, permission, dependency, memory)
  - Implement graceful fallback for corrupted files
  - Implement size limit enforcement per category
  - Display "Preview not available" for missing dependencies
  - _Requirements: 20.1-20.6_

- [ ] 36. Implement progress indicators
  - Display loading progress for files taking >500ms
  - Implement cancelable preview loading
  - Implement 30-second timeout for preview loading
  - _Requirements: 19.4, 19.6, 19.7_

- [ ]* 37. Write property tests for system properties
  - **Property 4: Undo/Redo Cycle** - For any editable preview, performing undo then redo SHALL restore the exact previous state
  - **Property 5: Preview Memory Budget** - For any set of active previews, total memory usage SHALL NOT exceed 500MB
  - **Property 6: Preview Load Timeout** - For any preview taking longer than 30 seconds, the system SHALL cancel and display error
  - **Property 7: Draft Recovery** -{}
 For any file with unsaved changes when the application crashes, the draft SHALL be recoverable
  - **Validates: Requirements 22.4, 19.5, 19.4, 22.6**

- [ ] 38. Final integration and documentation
  - Verify all phases work together
  - Verify backward compatibility with existing previews
  - Update ARCHITECTURE.md with new preview system documentation
  - Ensure all Specta bindings are regenerated
  - _Requirements: 18.4, 21.1-21.6_

---

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at phase boundaries
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The editing framework (UndoRedoManager, AutoSaveManager, etc.) is implemented once in Phase 1 and reused across all editable previews
- Backend commands are organized by category (hex, raw, geo, data, cert, etc.) for maintainability
- All workbench components are lazy-loaded to minimize initial bundle size
- Memory budget of 500MB is enforced across all active previews
- File size limits per category prevent performance issues with large files
