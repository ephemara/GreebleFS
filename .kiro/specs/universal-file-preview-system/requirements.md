# Requirements Document: Universal File Preview System

## Introduction

The Universal File Preview System extends GreebleFS's existing preview capabilities to support a comprehensive range of file formats across 12 major categories. The system transforms the file explorer into a true all-in-one interactive command center by enabling rich, contextual previews for geospatial data, scientific notebooks, extended archives, specialized images, office documents, data formats, bioinformatics files, binary inspection, security credentials, media metadata, and game engine assets.

The current preview system supports: image, audio, video, font, sqlite, pdf, text, model3d, folder, archive, docx, and spreadsheet. This specification defines requirements for expanding coverage to 150+ additional file types while maintaining performance, fallback strategies, and architectural consistency.

## Glossary

- **PreviewState**: The TypeScript discriminated union type defining all preview variants in the FileExplorer component
- **PreviewRouter**: The extension detection and routing logic in `src/config/filePreview.ts` that maps file extensions to preview types
- **WorkbenchComponent**: A dedicated React component for rendering a specific preview type (e.g., `ExplorerAudioWorkbench`, `ExplorerPdfWorkbench`)
- **BackendCommand**: A Tauri/Rust command in `src-tauri/src/` that performs native file operations for previews
- **GeoTIFF**: A TIFF file format with embedded georeferencing metadata (projection, CRS, bounds)
- **CRS**: Coordinate Reference System - defines how geographic coordinates map to positions on Earth
- **DEM**: Digital Elevation Model - raster representation of terrain elevation
- **Shapefile**: ESRI's geospatial vector data format consisting of .shp, .shx, and .dbf files
- **GeoJSON**: JSON format for encoding geographic data structures
- **Jupyter Notebook**: Interactive document format (.ipynb) containing code, markdown, and outputs
- **LiDAR**: Light Detection and Ranging - point cloud data format for 3D spatial information
- **PDB**: Protein Data Bank format for 3D molecular structures
- **FASTA**: Text-based format for representing nucleotide or amino acid sequences
- **X.509**: Standard format for public key certificates
- **Monaco Editor**: The code editor component used for text-based previews with syntax highlighting
- **Leaflet/MapLibre**: JavaScript libraries for interactive map rendering
- **3Dmol.js/NGL**: JavaScript libraries for molecular visualization
- **HexViewer**: Component for displaying binary file contents in hexadecimal format

---

## Requirements

### Requirement 1: Geospatial Raster Preview

**User Story:** As a GIS analyst, I want to preview geospatial raster files, so that I can quickly inspect projection metadata, bounds, and band information without opening specialized software.

#### Acceptance Criteria

1. WHEN a GeoTIFF file (.tiff, .tif) is selected, THE GeoTIFF_Previewer SHALL display projection information, CRS definition, geographic bounds, and band metadata
2. WHEN a DEM file (.dem) is selected, THE DEM_Previewer SHALL display elevation statistics, spatial extent, and a contour or hillshade visualization
3. WHEN an ASC file (.asc) is selected, THE ASC_Previewer SHALL parse ESRI ASCII Raster format and display header metadata with a grayscale elevation preview
4. WHEN an HGT file (.hgt) is selected, THE HGT_Previewer SHALL parse SRTM elevation data and display elevation statistics with terrain visualization
5. WHEN a NetCDF file (.nc) is selected, THE NetCDF_Previewer SHALL display variable metadata, dimensions, and a heatmap visualization for the primary variable
6. WHEN a GRIB file (.grib, .grib2) is selected, THE GRIB_Previewer SHALL display weather model metadata and available message layers
7. WHEN a PRJ file (.prj) is selected, THE PRJ_Previewer SHALL display the WKT projection definition with syntax highlighting
8. WHEN a CPG file (.cpg) is selected, THE CPG_Previewer SHALL display the codepage encoding information as plain text
9. THE GeoTIFF_Previewer SHALL render raster thumbnails within 500ms for files under 10MB
10. IF a raster file exceeds 50MB, THE Preview_System SHALL display metadata only without full rendering

---

### Requirement 2: Geospatial Vector Preview

**User Story:** As a cartographer, I want to preview vector geospatial files, so that I can inspect geometry types, attribute tables, and spatial relationships.

#### Acceptance Criteria

1. WHEN a Shapefile (.shp) is selected, THE Shapefile_Previewer SHALL display geometry type, feature count, bounding box, and attribute table schema
2. WHEN a Shapefile is selected, THE Shapefile_Previewer SHALL render a map preview using Leaflet or MapLibre GL JS
3. WHEN a GeoJSON file (.geojson, .json with geo content) is selected, THE GeoJSON_Previewer SHALL parse and validate the GeoJSON structure
4. WHEN a valid GeoJSON file is selected, THE GeoJSON_Previewer SHALL render an interactive map with feature highlighting
5. WHEN a TopoJSON file (.topojson) is selected, THE TopoJSON_Previewer SHALL convert to GeoJSON and render an interactive map
6. WHEN a GPX file (.gpx) is selected, THE GPX_Previewer SHALL parse GPS tracks and waypoints and render them on a map
7. WHEN a KML file (.kml) is selected, THE KML_Previewer SHALL parse and render placemarks, paths, and polygons on a map
8. WHEN a KMZ file (.kmz) is selected, THE KMZ_Previewer SHALL extract the inner KML and render the contents
9. WHEN a GeoPackage file (.gpkg) is selected, THE GeoPackage_Previewer SHALL list available layers and render the selected layer
10. WHEN an MBTiles file (.mbtiles) is selected, THE MBTiles_Previewer SHALL display tile metadata and render a sample tile grid
11. WHEN an OSM file (.osm) is selected, THE OSM_Previewer SHALL parse OpenStreetMap XML and display node/way/relation counts
12. WHEN a GML file (.gml) is selected, THE GML_Previewer SHALL parse the XML structure and render features on a map
13. WHEN a DXF file (.dxf) is selected, THE DXF_Previewer SHALL render 2D vector geometry
14. WHEN a DWG file (.dwg) is selected, THE DWG_Previewer SHALL display "Open in native application" fallback with file metadata
15. THE Vector_Previewer SHALL render maps with pan and zoom controls
16. THE Vector_Previewer SHALL display attribute tables with sortable columns

---

### Requirement 3: LiDAR and Point Cloud Preview

**User Story:** As a surveyor, I want to preview LiDAR point cloud files, so that I can inspect point density, classification, and spatial extent.

#### Acceptance Criteria

1. WHEN a LAS file (.las) is selected, THE LAS_Previewer SHALL parse the header and display point count, bounding box, and available dimensions
2. WHEN a LAZ file (.laz) is selected, THE LAZ_Previewer SHALL decompress and display point cloud metadata with a 3D preview
3. WHEN an E57 file (.e57) is selected, THE E57_Previewer SHALL display scan metadata and point count
4. WHEN an XYZ point cloud file (.xyz) is selected, THE XYZ_Previewer SHALL parse the text format and display point statistics
5. THE PointCloud_Previewer SHALL render a 3D visualization with orbit controls for files under 5 million points
6. THE PointCloud_Previewer SHALL display classification breakdown when available
7. IF a point cloud exceeds 10 million points, THE Preview_System SHALL display metadata only with a subsampled preview

---

### Requirement 4: Jupyter Notebook Preview

**User Story:** As a data scientist, I want to preview Jupyter notebooks, so that I can inspect code cells, outputs, and markdown documentation.

#### Acceptance Criteria

1. WHEN a Jupyter notebook file (.ipynb) is selected, THE Notebook_Previewer SHALL parse the JSON structure and render cells
2. THE Notebook_Previewer SHALL render markdown cells with proper formatting
3. THE Notebook_Previewer SHALL render code cells with syntax highlighting
4. THE Notebook_Previewer SHALL display output cells including text, images, and tables
5. THE Notebook_Previewer SHALL display execution counts and cell metadata
6. WHEN a notebook contains images, THE Notebook_Previewer SHALL render embedded base64 images
7. WHEN a notebook contains errors, THE Notebook_Previewer SHALL display error outputs with appropriate styling

#### Editing Capabilities

1. THE Notebook_Previewer SHALL allow editing of markdown cells with live preview
2. THE Notebook_Previewer SHALL allow editing of code cells with Monaco editor integration
3. THE Notebook_Previewer SHALL support adding new cells (markdown and code)
4. THE Notebook_Previewer SHALL support deleting cells
5. THE Notebook_Previewer SHALL support reordering cells via drag and drop
6. THE Notebook_Previewer SHALL save changes back to the .ipynb file preserving the notebook format
7. THE Notebook_Previewer SHALL NOT execute code cells (editing only, no kernel execution)
8. THE Notebook_Previewer SHALL display unsaved changes indicator when cells are modified

---

### Requirement 5: Scientific Document Preview

**User Story:** As a researcher, I want to preview scientific document formats, so that I can quickly review R Markdown, Quarto, and other notebook formats.

#### Acceptance Criteria

1. WHEN an R Markdown file (.rmd) is selected, THE RMarkdown_Previewer SHALL render the markdown content with syntax highlighting for R code blocks
2. WHEN a Quarto file (.qmd) is selected, THE Quarto_Previewer SHALL render the markdown content with YAML header display
3. WHEN a Julia file (.jl) is selected, THE Julia_Previewer SHALL display the code with Monaco julia language support
4. WHEN an R script file (.r) is selected, THE R_Previewer SHALL display the code with Monaco r language support
5. WHEN a MATLAB file (.m) is selected, THE MATLAB_Previewer SHALL display the code with Monaco matlab language support
6. WHEN a Mathematica notebook (.nb) is selected, THE Mathematica_Previewer SHALL display file metadata and cell structure

---

### Requirement 6: Extended Archive Preview

**User Story:** As a developer, I want to preview additional archive formats, so that I can inspect contents without extraction.

#### Acceptance Criteria

1. WHEN a Zstandard archive (.zst) is selected, THE Archive_Previewer SHALL list archive contents
2. WHEN an LZ4 archive (.lz4) is selected, THE Archive_Previewer SHALL list archive contents
3. WHEN a Cabinet archive (.cab) is selected, THE Archive_Previewer SHALL list archive contents
4. WHEN an ISO image (.iso) is selected, THE Archive_Previewer SHALL list disc image contents
5. WHEN a disk image (.img) is selected, THE Archive_Previewer SHALL list image contents
6. WHEN a Debian package (.deb) is selected, THE Archive_Previewer SHALL list package contents and control file
7. WHEN an RPM package (.rpm) is selected, THE Archive_Previewer SHALL list package contents
8. WHEN an Android package (.apk) is selected, THE Archive_Previewer SHALL list APK contents and manifest
9. WHEN an iOS app (.ipa) is selected, THE Archive_Previewer SHALL list IPA contents
10. WHEN a JAR file (.jar) is selected, THE Archive_Previewer SHALL list JAR contents and manifest
11. WHEN a WAR file (.war) is selected, THE Archive_Previewer SHALL list WAR contents
12. WHEN an EAR file (.ear) is selected, THE Archive_Previewer SHALL list EAR contents
13. WHEN a NuGet package (.nupkg) is selected, THE Archive_Previewer SHALL list package contents and nuspec
14. WHEN a Chrome extension (.crx) is selected, THE Archive_Previewer SHALL list extension contents and manifest
15. WHEN a Python wheel (.whl) is selected, THE Archive_Previewer SHALL list wheel contents and metadata
16. WHEN a VS Code extension (.vsix) is selected, THE Archive_Previewer SHALL list extension contents and package.json
17. THE Archive_Previewer SHALL display file sizes and compressed ratios for all archive types
18. THE Archive_Previewer SHALL support nested archive inspection for archives within archives

---

### Requirement 7: Camera RAW and HDR Image Preview

**User Story:** As a photographer, I want to preview camera RAW files and HDR images, so that I can quickly review shots without importing into photo software.

#### Acceptance Criteria

1. WHEN a Canon RAW file (.cr2, .cr3) is selected, THE RAW_Previewer SHALL extract and display the embedded preview image
2. WHEN a Nikon RAW file (.nef) is selected, THE RAW_Previewer SHALL extract and display the embedded preview image
3. WHEN a Sony RAW file (.arw) is selected, THE RAW_Previewer SHALL extract and display the embedded preview image
4. WHEN an Olympus RAW file (.orf) is selected, THE RAW_Previewer SHALL extract and display the embedded preview image
5. WHEN a Panasonic RAW file (.rw2) is selected, THE RAW_Previewer SHALL extract and display the embedded preview image
6. WHEN an Adobe DNG file (.dng) is selected, THE RAW_Previewer SHALL extract and display the embedded preview image
7. WHEN a Pentax RAW file (.pef) is selected, THE RAW_Previewer SHALL extract and display the embedded preview image
8. WHEN a Samsung RAW file (.srf) is selected, THE RAW_Previewer SHALL extract and display the embedded preview image
9. WHEN a generic RAW file (.raw) is selected, THE RAW_Previewer SHALL attempt to parse and display available metadata
10. WHEN an HDR image (.hdr) is selected, THE HDR_Previewer SHALL display the image with tone mapping
11. WHEN an OpenEXR file (.exr) is selected, THE EXR_Previewer SHALL display the image with available channels listed
12. THE RAW_Previewer SHALL display EXIF metadata including camera model, ISO, aperture, shutter speed, and capture date
13. THE RAW_Previewer SHALL render previews within 1 second for files under 50MB

#### Editing Capabilities

1. THE RAW_Previewer SHALL allow exposure adjustment (+/- EV) on the embedded preview
2. THE RAW_Previewer SHALL allow white balance adjustment with temperature/tint controls
3. THE RAW_Previewer SHALL allow contrast, highlights, shadows, and blacks adjustments
4. THE RAW_Previewer SHALL provide crop and rotate tools
5. THE RAW_Previewer SHALL export adjusted image as JPEG or PNG (non-destructive, does not modify original RAW)
6. THE HDR_Previewer SHALL allow tone mapping parameter adjustments (exposure, gamma, saturation)
7. THE EXR_Previewer SHALL allow channel selection and exposure adjustment per channel
8. THE Image_Editor SHALL display before/after comparison toggle

---

### Requirement 8: Adobe and Design File Preview

**User Story:** As a designer, I want to preview Adobe and design files, so that I can quickly review artwork without opening Creative Cloud applications.

#### Acceptance Criteria

1. WHEN a Photoshop file (.psd) is selected, THE PSD_Previewer SHALL extract and display the flattened composite preview
2. WHEN a Photoshop file is selected, THE PSD_Previewer SHALL display layer names and structure
3. WHEN an Illustrator file (.ai) is selected, THE AI_Previewer SHALL display the embedded PDF preview if available
4. WHEN an EPS file (.eps) is selected, THE EPS_Previewer SHALL display the embedded preview or render the PostScript
5. WHEN a GIMP file (.xcf) is selected, THE XCF_Previewer SHALL display the merged image preview
6. WHEN a JPEG XL file (.jxl) is selected, THE JXL_Previewer SHALL decode and display the image
7. WHEN a HEIC/HEIF file (.heic, .heif) is selected, THE HEIF_Previewer SHALL decode and display the image
8. WHEN a QOI file (.qoi) is selected, THE QOI_Previewer SHALL decode and display the image
9. WHEN a Targa file (.tga) is selected, THE TGA_Previewer SHALL decode and display the image
10. WHEN a PCX file (.pcx) is selected, THE PCX_Previewer SHALL decode and display the image
11. WHEN a NetPBM file (.pbm, .pgm, .ppm, .pnm) is selected, THE NetPBM_Previewer SHALL decode and display the image
12. WHEN a DDS file (.dds) is selected, THE DDS_Previewer SHALL decode and display the texture with format information
13. WHEN a KTX file (.ktx, .ktx2) is selected, THE KTX_Previewer SHALL decode and display the texture
14. WHEN a Basis Universal file (.basis) is selected, THE Basis_Previewer SHALL decode and display the texture

#### Editing Capabilities

1. THE PSD_Previewer SHALL allow layer visibility toggle
2. THE PSD_Previewer SHALL allow exporting individual layers as PNG
3. THE PSD_Previewer SHALL allow basic adjustments (brightness, contrast, saturation) on the composite
4. THE Design_Previewer SHALL allow exporting the preview to standard formats (PNG, JPEG)
5. THE DDS_Previewer SHALL allow mip level selection for viewing
6. THE KTX_Previewer SHALL allow mip level and face selection for cubemap textures

---

### Requirement 9: Office Document Preview

**User Story:** As an office worker, I want to preview office documents, so that I can review content without opening full office applications.

#### Acceptance Criteria

1. WHEN a PowerPoint file (.pptx) is selected, THE PPTX_Previewer SHALL render slide thumbnails in a scrollable list
2. WHEN a PowerPoint file is selected, THE PPTX_Previewer SHALL display slide count and presentation metadata
3. WHEN a legacy PowerPoint file (.ppt) is selected, THE PPT_Previewer SHALL attempt conversion or display fallback message
4. WHEN an OpenDocument text file (.odt) is selected, THE ODT_Previewer SHALL render the document content
5. WHEN an OpenDocument presentation (.odp) is selected, THE ODP_Previewer SHALL render slide thumbnails
6. WHEN an RTF file (.rtf) is selected, THE RTF_Previewer SHALL render the formatted text
7. WHEN an EPUB file (.epub) is selected, THE EPUB_Previewer SHALL render the book content with navigation
8. WHEN a Kindle file (.mobi, .azw3) is selected, THE Kindle_Previewer SHALL display metadata and text content
9. WHEN a DjVu file (.djvu) is selected, THE DjVu_Previewer SHALL render the document pages
10. THE Document_Previewer SHALL support text selection in rendered documents
11. THE Document_Previewer SHALL display document metadata including author, creation date, and page count

---

### Requirement 10: Data Format Preview

**User Story:** As a data engineer, I want to preview structured data files, so that I can inspect schemas and sample data.

#### Acceptance Criteria

1. WHEN a Parquet file (.parquet) is selected, THE Parquet_Previewer SHALL display the schema and first 100 rows
2. WHEN an Arrow/Feather file (.arrow) is selected, THE Arrow_Previewer SHALL display the schema and sample data
3. WHEN an Avro file (.avro) is selected, THE Avro_Previewer SHALL display the schema and sample records
4. WHEN a CBOR file (.cbor) is selected, THE CBOR_Previewer SHALL decode and display as formatted JSON
5. WHEN a MessagePack file (.msgpack) is selected, THE MessagePack_Previewer SHALL decode and display as formatted JSON
6. WHEN a Protobuf schema file (.proto) is selected, THE Proto_Previewer SHALL display with Monaco proto syntax highlighting
7. WHEN a FlatBuffers schema file (.fbs) is selected, THE FBS_Previewer SHALL display with Monaco syntax highlighting
8. WHEN a Cap'n Proto schema file (.capnp) is selected, THE Capnp_Previewer SHALL display with Monaco syntax highlighting
9. WHEN a Thrift IDL file (.thrift) is selected, THE Thrift_Previewer SHALL display with Monaco syntax highlighting
10. WHEN a GraphQL schema file (.graphql, .gql) is selected, THE GraphQL_Previewer SHALL display with Monaco graphql syntax highlighting
11. WHEN a HCL file (.hcl, .tf, .tfvars) is selected, THE HCL_Previewer SHALL display with Monaco hcl syntax highlighting
12. WHEN a Nix file (.nix) is selected, THE Nix_Previewer SHALL display with Monaco text syntax highlighting
13. WHEN a Dhall file (.dhall) is selected, THE Dhall_Previewer SHALL display with Monaco syntax highlighting
14. WHEN a RON file (.ron) is selected, THE RON_Previewer SHALL display with Monaco syntax highlighting
15. WHEN a KDL file (.kdl) is selected, THE KDL_Previewer SHALL display with Monaco syntax highlighting
16. WHEN a CUE file (.cue) is selected, THE CUE_Previewer SHALL display with Monaco syntax highlighting
17. WHEN a Jsonnet file (.jsonnet, .libsonnet) is selected, THE Jsonnet_Previewer SHALL display with Monaco syntax highlighting
18. WHEN a Pkl file (.pkl) is selected, THE Pkl_Previewer SHALL display with Monaco syntax highlighting
19. THE Data_Previewer SHALL display column statistics for tabular formats when available

---

### Requirement 11: Bioinformatics Sequence Preview

**User Story:** As a bioinformatician, I want to preview sequence files, so that I can inspect sequence data and metadata.

#### Acceptance Criteria

1. WHEN a FASTA file (.fasta, .fa) is selected, THE FASTA_Previewer SHALL display sequences with syntax coloring for nucleotides/amino acids
2. THE FASTA_Previewer SHALL display sequence length, GC content (for nucleotides), and header information
3. WHEN a FASTQ file (.fastq, .fq) is selected, THE FASTQ_Previewer SHALL display reads with quality scores visualization
4. WHEN a SAM file (.sam) is selected, THE SAM_Previewer SHALL display alignment data in tabular format
5. WHEN a BAM file (.bam) is selected, THE BAM_Previewer SHALL display metadata and first N aligned reads
6. WHEN a VCF file (.vcf) is selected, THE VCF_Previewer SHALL display variant calls in tabular format
7. WHEN a BED file (.bed) is selected, THE BED_Previewer SHALL display genomic regions in tabular format with region visualization
8. WHEN a GFF file (.gff, .gff3) is selected, THE GFF_Previewer SHALL display gene annotations in tabular format
9. WHEN a GTF file (.gtf) is selected, THE GTF_Previewer SHALL display gene annotations in tabular format
10. THE Sequence_Previewer SHALL support sequence search within the preview

---

### Requirement 12: Molecular Structure Preview

**User Story:** As a structural biologist, I want to preview molecular structure files, so that I can inspect 3D conformations and metadata.

#### Acceptance Criteria

1. WHEN a PDB file (.pdb) is selected, THE PDB_Previewer SHALL render a 3D visualization using 3Dmol.js or NGL
2. WHEN a CIF/mmCIF file (.cif, .mmcif) is selected, THE CIF_Previewer SHALL render a 3D visualization
3. WHEN a MOL file (.mol) is selected, THE MOL_Previewer SHALL render a 3D visualization using 3Dmol.js
4. WHEN a MOL2 file (.mol2) is selected, THE MOL2_Previewer SHALL render a 3D visualization
5. WHEN an SDF file (.sdf) is selected, THE SDF_Previewer SHALL render the first structure with navigation for multiple molecules
6. WHEN a chemistry XYZ file (.xyz) is selected, THE XYZ_Previewer SHALL render the 3D structure
7. THE Molecular_Previewer SHALL display atom count, bond count, and molecular weight
8. THE Molecular_Previewer SHALL provide orbit controls for 3D navigation
9. THE Molecular_Previewer SHALL support different representation modes (ball-and-stick, space-filling, ribbon)

---

### Requirement 13: Binary and Hex Preview

**User Story:** As a reverse engineer, I want to preview binary files, so that I can inspect file structure and content.

#### Acceptance Criteria

1. WHEN an unrecognized binary file is selected, THE Hex_Previewer SHALL display the first N bytes in hexadecimal format
2. THE Hex_Previewer SHALL display both hexadecimal and ASCII representations side by side
3. THE Hex_Previewer SHALL support scrolling through larger files with virtualized rendering
4. THE Hex_Previewer SHALL display file offset addresses
5. THE Hex_Previewer SHALL highlight common magic bytes and file signatures
6. THE Hex_Previewer SHALL limit initial display to 64KB with option to load more
7. THE Hex_Previewer SHALL display file size and entropy statistics

---

### Requirement 14: Certificate and Key Preview

**User Story:** As a security engineer, I want to preview certificates and keys, so that I can inspect security credentials without external tools.

#### Acceptance Criteria

1. WHEN a PEM certificate (.pem, .crt, .cer) is selected, THE Cert_Previewer SHALL parse and display certificate details
2. THE Cert_Previewer SHALL display subject, issuer, validity period, and serial number
3. THE Cert_Previewer SHALL display Subject Alternative Names (SANs) when present
4. THE Cert_Previewer SHALL display the certificate chain if multiple certificates are present
5. WHEN a DER certificate (.der) is selected, THE Cert_Previewer SHALL parse the binary format and display details
6. WHEN an SSH public key (.pub) is selected, THE SSH_Previewer SHALL display key type, fingerprint, and comment
7. WHEN a PGP key (.asc with PGP content) is selected, THE PGP_Previewer SHALL display key metadata and fingerprint
8. WHEN a PKCS#12 file (.p12, .pfx) is selected, THE PKCS12_Previewer SHALL display metadata without extracting private key
9. WHEN a CSR file (.csr) is selected, THE CSR_Previewer SHALL parse and display the certificate signing request details
10. WHEN a Java KeyStore (.jks) is selected, THE JKS_Previewer SHALL display alias list and certificate chain metadata
11. THE Cert_Previewer SHALL display certificate validity warnings for expired or soon-to-expire certificates
12. THE Cert_Previewer SHALL NOT display or export private key material

---

### Requirement 15: Media Metadata and Subtitle Preview

**User Story:** As a video editor, I want to preview subtitle files and media playlists, so that I can inspect timing and content.

#### Acceptance Criteria

1. WHEN an SRT subtitle file (.srt) is selected, THE Subtitle_Previewer SHALL display subtitles with timing information
2. WHEN a VTT subtitle file (.vtt) is selected, THE VTT_Previewer SHALL display subtitles with styling cues
3. WHEN an ASS/SSA subtitle file (.ass, .ssa) is selected, THE ASS_Previewer SHALL display subtitles with style information
4. WHEN a SUB subtitle file (.sub) is selected, THE SUB_Previewer SHALL display subtitle content
5. WHEN an M3U playlist (.m3u) is selected, THE M3U_Previewer SHALL display playlist entries
6. WHEN an M3U8 playlist (.m3u8) is selected, THE M3U8_Previewer SHALL display HLS playlist structure
7. WHEN a PLS playlist (.pls) is selected, THE PLS_Previewer SHALL display playlist entries with metadata
8. WHEN a CUE sheet (.cue) is selected, THE CUE_Previewer SHALL display track information
9. THE Subtitle_Previewer SHALL display subtitle count and total duration when calculable

---

### Requirement 16: Game Engine Asset Preview

**User Story:** As a game developer, I want to preview game engine assets, so that I can inspect resources without opening the engine.

#### Acceptance Criteria

1. WHEN a Unity StyleSheet (.uss) is selected, THE USS_Previewer SHALL display with Monaco syntax highlighting
2. WHEN an Unreal asset file (.uasset) is selected, THE Uasset_Previewer SHALL display metadata and property list
3. WHEN a PAK archive (.pak) is selected, THE PAK_Previewer SHALL list archive contents
4. WHEN a Valve material file (.vmt) is selected, THE VMT_Previewer SHALL display the text-based material definition
5. WHEN a Valve texture file (.vtf) is selected, THE VTF_Previewer SHALL decode and display the texture
6. WHEN a GoldSrc/idTech model file (.mdl) is selected, THE MDL_Previewer SHALL display model metadata
7. WHEN a BSP map file (.bsp) is selected, THE BSP_Previewer SHALL display map metadata and entity list
8. WHEN a particle effect file (.pcf) is selected, THE PCF_Previewer SHALL display the text/XML content
9. WHEN a Blender file (.blend) is selected, THE Blend_Previewer SHALL display scene metadata and object list
10. WHEN a Maya ASCII file (.ma) is selected, THE MA_Previewer SHALL display the text content
11. WHEN a Maya binary file (.mb) is selected, THE MB_Previewer SHALL display file metadata
12. WHEN a Houdini file (.hip) is selected, THE HIP_Previewer SHALL display "Open in Houdini" fallback with metadata

---

### Requirement 17: Preview Router Extension

**User Story:** As a developer, I want the preview router to support all new file types, so that the system correctly routes files to appropriate previewers.

#### Acceptance Criteria

1. THE Preview_Router SHALL define extension detection functions for all new preview categories
2. THE Preview_Router SHALL maintain a consistent naming pattern for detection functions (e.g., `isGeoRasterExtension`, `isNotebookExtension`)
3. THE Preview_Router SHALL integrate with the existing `isEditableTextExtension` function to exclude binary formats
4. THE Preview_Router SHALL provide MIME type mappings for formats that require them
5. THE Preview_Router SHALL support compound extensions (e.g., .tar.gz, .tar.bz2)
6. THE Preview_Router SHALL handle case-insensitive extension matching

---

### Requirement 18: PreviewState Type Extension

**User Story:** As a developer, I want the PreviewState type to include all new preview variants, so that TypeScript enforces type safety across the codebase.

#### Acceptance Criteria

1. THE PreviewState_type SHALL include a discriminated union variant for each new preview category
2. EACH PreviewState variant SHALL include path, name, and extension fields
3. EACH PreviewState variant SHALL include format-specific metadata fields
4. THE PreviewState_type SHALL maintain backward compatibility with existing preview types
5. THE PreviewState_type SHALL be defined in a single location for maintainability

---

### Requirement 19: Performance and Resource Management

**User Story:** As a user, I want previews to load quickly and not consume excessive memory, so that the application remains responsive.

#### Acceptance Criteria

1. THE Preview_System SHALL display metadata within 200ms for files under 10MB
2. THE Preview_System SHALL render visual previews within 1 second for files under 50MB
3. THE Preview_System SHALL implement lazy loading for preview components
4. THE Preview_System SHALL cancel preview loading when selection changes
5. THE Preview_System SHALL limit memory usage to 500MB for preview rendering
6. THE Preview_System SHALL display progress indicators for files taking longer than 500ms to load
7. THE Preview_System SHALL implement file size limits per preview category
8. THE Preview_System SHALL clean up resources when preview is closed

---

### Requirement 20: Fallback Strategy

**User Story:** As a user, I want graceful fallbacks for unsupported or corrupted files, so that I always see useful information.

#### Acceptance Criteria

1. WHEN a file cannot be parsed, THE Preview_System SHALL display the fallback preview with file metadata
2. WHEN a file exceeds the size limit, THE Preview_System SHALL display metadata only
3. WHEN a file is corrupted, THE Preview_System SHALL display an error message with available metadata
4. WHEN a required library is unavailable, THE Preview_System SHALL display a "Preview not available" message
5. WHEN a format is partially supported, THE Preview_System SHALL display available information with a note about limitations
6. THE Fallback_Previewer SHALL always display file name, size, and modification date

---

### Requirement 21: Dependency Management

**User Story:** As a developer, I want clear documentation of required dependencies, so that I can implement previews efficiently.

#### Acceptance Criteria

1. THE Preview_System SHALL document required npm packages for each preview category
2. THE Preview_System SHALL document required WASM modules for binary parsing
3. THE Preview_System SHALL document required Rust crates for backend processing
4. THE Preview_System SHALL minimize bundle size impact through code splitting
5. THE Preview_System SHALL use native Tauri/Rust processing for performance-critical operations
6. THE Preview_System SHALL prefer web-standard APIs over large dependencies where feasible

---

### Requirement 22: Implementation Phasing

**User Story:** As a product manager, I want implementation prioritized by value and complexity, so that the most impactful previews ship first.

#### Acceptance Criteria

1. PHASE_1 SHALL implement high-value, low-complexity previews: extended archives, additional images, hex viewer
2. PHASE_2 SHALL implement medium-complexity previews: office documents, data formats, certificates
3. PHASE_3 SHALL implement high-complexity previews: geospatial, molecular, notebooks
4. PHASE_4 SHALL implement specialized previews: game engine assets, bioinformatics
5. EACH phase SHALL be deliverable independently
6. EACH phase SHALL include appropriate test coverage

---

## Implementation Priority Matrix

| Phase | Category | Complexity | Value | Priority |
|-------|----------|------------|-------|----------|
| 1 | Extended Archives | Low | High | P0 |
| 1 | Hex Viewer | Low | High | P0 |
| 1 | Camera RAW | Medium | High | P0 |
| 1 | Additional Images | Low | Medium | P1 |
| 2 | Office Documents | Medium | High | P1 |
| 2 | Data Formats | Medium | High | P1 |
| 2 | Certificates | Medium | Medium | P1 |
| 2 | Subtitles | Low | Medium | P1 |
| 3 | Geospatial Raster | High | Medium | P2 |
| 3 | Geospatial Vector | High | Medium | P2 |
| 3 | Jupyter Notebooks | Medium | High | P2 |
| 3 | Molecular Structures | High | Medium | P2 |
| 4 | LiDAR/Point Cloud | High | Low | P3 |
| 4 | Bioinformatics | High | Low | P3 |
| 4 | Game Engine Assets | Medium | Low | P3 |

---

## Dependency Reference

### NPM Packages (Frontend)

| Category | Package | Purpose |
|----------|---------|---------|
| Geospatial | `geotiff` | GeoTIFF parsing |
| Geospatial | `shapefile` | Shapefile parsing |
| Geospatial | `leaflet` or `maplibre-gl-js` | Map rendering |
| Geospatial | `@turf/turf` | GeoJSON operations |
| Geospatial | `openlayers` | Advanced GIS rendering |
| Notebooks | `@jupyterlab/nbformat` | Notebook parsing |
| Archives | `libarchive.js` | Extended archive support |
| Images | `utif` | TIFF/GeoTIFF |
| Images | `exifreader` | EXIF metadata |
| Images | `jxl.js` | JPEG XL decoding |
| Images | `heic2any` | HEIC conversion |
| Documents | `mammoth` | DOCX (existing) |
| Documents | `pptxgenjs` or `jszip` | PPTX parsing |
| Documents | `epub.js` | EPUB rendering |
| Documents | `djvu.js` | DjVu rendering |
| Data | `apache-arrow` | Arrow/Parquet |
| Data | `parquetjs` | Parquet reading |
| Data | `cbor-x` | CBOR encoding/decoding |
| Data | `@msgpack/msgpack` | MessagePack |
| Bio | `bioinformatics` | Sequence parsing |
| Molecular | `3dmol` | Molecular visualization |
| Molecular | `ngl` | Advanced molecular viz |
| Binary | Custom component | Hex viewer |
| Certs | `node-forge` or `x509.js` | Certificate parsing |
| Certs | `sshpk` | SSH key parsing |

### Rust Crates (Backend)

| Category | Crate | Purpose |
|----------|-------|---------|
| Geospatial | `gdal` | GDAL bindings |
| Geospatial | `geo` | GeoJSON operations |
| Geospatial | `las` | LAS/LAZ point clouds |
| Archives | `zip` | ZIP archives (existing) |
| Archives | `tar` | TAR archives (existing) |
| Archives | `zstd` | Zstandard compression |
| Archives | `lz4` | LZ4 compression |
| Images | `image` | Image processing (existing) |
| Images | `rawloader` | Camera RAW |
| Images | `exr` | OpenEXR |
| Data | `arrow` | Apache Arrow |
| Data | `parquet` | Parquet files |
| Certs | `x509-parser` | X.509 parsing |
| Certs | `pkcs8` | PKCS#8 keys |

---

## Correctness Properties

### Round-Trip Properties

1. **GeoJSON Parse/Serialize**: FOR ALL valid GeoJSON objects, parsing then serializing SHALL produce semantically equivalent GeoJSON
2. **CBOR/JSON Round-Trip**: FOR ALL valid JSON objects, encoding to CBOR then decoding SHALL produce equivalent JSON
3. **MessagePack/JSON Round-Trip**: FOR ALL valid JSON objects, encoding to MessagePack then decoding SHALL produce equivalent JSON

### Invariants

1. **Preview Memory Budget**: THE Preview_System SHALL NOT exceed 500MB memory usage for all active previews
2. **Preview Load Timeout**: THE Preview_System SHALL cancel preview loading after 30 seconds
3. **File Size Limits**: THE Preview_System SHALL enforce per-category file size limits before attempting full rendering

### Idempotence

1. **Preview State Reset**: Closing and reopening the same file SHALL produce identical preview state
2. **Archive Listing**: Listing archive contents multiple times SHALL produce identical results

### Error Conditions

1. **Corrupted File Handling**: WHEN a corrupted file is encountered, THE Preview_System SHALL display error message without crashing
2. **Unsupported Format Handling**: WHEN an unsupported format is encountered, THE Preview_System SHALL display fallback preview
3. **Memory Exhaustion**: WHEN memory limit is reached, THE Preview_System SHALL evict oldest cached preview

---

## Out of Scope

- Editing capabilities for any preview type (preview only)
- Real-time collaboration on previewed documents
-{}