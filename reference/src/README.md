# Rage reference source map

This folder is a reference slice of the Rage engine source tree, with the highest-value material concentrated in the filesystem, archive, serialization, and import/export layers.

If you are looking for the useful stuff fast, start here:

- `file/` for the core filesystem abstraction, stream wrapper, archive devices, packfiles, savegames, remote file access, and asset path routing.
- `data/` for generic serialization, resource relocation/fixup, compression, crypto helpers, and binary data containers.
- `xmldata/` for the schema-driven XML import/export path used by tool and content data.
- `system/` for lower-level platform plumbing that supports mounting, file access, and runtime startup.
- `REPO_MAP.md` for the exhaustive file-by-file index with sizes, imports, and semantic summaries.

## Mental model

The stack is layered. The important part is that each layer has a narrow job:

1. `fiDevice` is the filesystem abstraction.
2. `fiStream` is the buffered byte-stream wrapper on top of a device or file handle.
3. `fiAssetManager` translates logical asset names into actual read/write paths.
4. `fiArchive` and `datSerialize` provide typed object serialization.
5. `xmldata` and savegame code build structured import/export pipelines on top of those primitives.

That separation is the main design pattern worth borrowing into GreebleFS.

## Core filesystem layer

### `file/device.h` and `file/device_common.cpp`

`fiDevice` is the central filesystem driver interface. It provides:

- device mounting and unmounting
- open/read/write/seek/close
- bulk I/O entry points for aligned large reads
- directory enumeration
- file metadata, attributes, timestamps, delete, rename, copy, and mkdir style operations
- resource lookup for archive-backed content
- safe wrappers around partial reads and writes

Important design ideas:

- Paths are resolved through device prefixes, not through one global root.
- Mounts can be layered.
- Some paths are handled by special relative devices instead of a plain local filesystem.
- Bulk I/O is first-class, which matters for archive and asset loading.

### `file/device_relative.h` and `file/device_relative.cpp`

`fiDeviceRelative` is a path adapter that resolves relative roots like `common:/`, `platform:/`, `update:/`, and similar device-style aliases.

This is one of the cleanest examples in the tree of path indirection done explicitly rather than by hidden global state.

### `file/stream.h`

`fiStream` is the buffered stream API that sits above `fiDevice`.

Useful traits:

- file open/create helpers
- read/write/seek/size helpers
- typed read/write helpers for primitive values
- `PreLoad` to slurp a stream into memory
- compatibility shims that resemble stdio

This is the class to study if you want to see how the engine standardizes binary file access without exposing raw platform handles everywhere.

### `file/asset.h` and `file/asset.cpp`

`fiAssetManager` is the logical path layer.

It handles:

- root path stacks
- multiple semicolon-separated roots
- read vs write path resolution
- implicit folder and extension insertion
- relative path conversion
- path existence and attribute queries

This is the engine's higher-level answer to "where does this asset live?" and it is probably the most directly reusable pattern for GreebleFS path handling.

## Archive and container formats

### `file/packfile.h`, `file/packfile.cpp`

`fiPackfile` is the custom RPF7 archive device.

What it does:

- mounts an archive as a filesystem device
- exposes files, directories, and resource entries through the same device API
- supports bulk reads
- tracks compressed vs uncompressed entries
- can surface embedded resource metadata
- maintains handle-to-entry mapping through collection state

Important format ideas:

- entry names are stored compactly in a name heap
- files can be compressed or left raw
- resources have special headers and resource info payloads
- archive entry layout is designed for fast lookup and streaming, not human readability

### `file/packfile_builder.h` and `file/packfile_builder.cpp`

This is the export path for RPF7.

It can:

- add existing files from disk
- add raw in-memory data
- choose compression automatically for selected file types
- write the final archive to a stream
- flatten the tree and build the packed entry table

If you want the "how do they write archives back out?" answer, this is the file pair to read.

### `file/packfile_tool.cpp`

This contains tool-side extraction and archive inspection logic, including decompression and resource reconstruction paths.

It is a useful companion to the packfile builder because it shows the other side of the container lifecycle.

### `file/zipfile.h` and `file/zipfile.cpp`

`fiZipfile` is a read-only zip-backed device.

It is simpler than packfile, but it uses the same abstraction layer, which is the key thing to notice.

### `file/savegame.h` and `file/savegame_pc.cpp`

The savegame layer is its own filesystem-backed pipeline.

Notable features:

- asynchronous, state-machine driven save/load flow
- device selection and enumeration
- save, load, delete, icon write, and free-space checks
- platform-specific save path handling
- validation and version/hash checks for PC save files

The PC implementation is a good example of a small binary container with explicit import/export boundaries.

### `file/remote.h` and `file/remote.cpp`

Remote file access and remote control live here.

This is the debug/network bridge that lets the engine expose file operations and related utilities over a remote connection.

## Structured import/export

### XML pipeline: `xmldata/xmltoken.cpp`, `xmldata/data.cpp`, `xmldata/datatypes.cpp`

This is the main structured content import/export path.

The flow is:

1. `xmlAsciiTokenizerXml` tokenizes XML from an `fiStream`.
2. `aDataStruct::LoadXML` reads `<attributes>` and `<contents>`.
3. `aDataType` subclasses parse individual typed fields.
4. `aDataStruct::SaveXML` writes the structure back out.

Useful details:

- Attributes are schema-driven and registered through `aDataStructManager`.
- Types include ints, floats, vectors, enums, bitfields, strings, and bools.
- Parent inheritance is supported during load and save.
- Missing or unknown fields are handled through the schema rather than by ad hoc parsing.
- Save output omits unchanged values when parent inheritance makes that safe.

If you are looking for the engine's "authorable data format" system, this is the one.

### Generic serialization: `file/archive.h` and `data/serialize.h`

These files define the generic object serialization helpers used across the tree.

Highlights:

- primitive read/write operators
- vector and pair support
- container helpers
- fallback to `Serialize()` methods on custom types
- flags for read/write/binary/error state

These are the low-level building blocks behind many binary import/export flows.

### Resource relocation: `data/resource.h`

`datResource` is the relocation/fixup layer for runtime-loaded data.

It is not a file format by itself, but it is crucial for understanding how loaded data is patched into live memory after import.

Think of it as the bridge between a serialized blob and usable runtime objects.

## Other useful references

- `file/device_common.cpp` for mount table behavior, safe read/write, and general device routing.
- `file/diskcache.*` for caching behavior around archive content.
- `file/token.*` for tokenization helpers used by file or data parsing paths.
- `security/` if you need to trace secure loading or protected memory/data paths.
- `parser/` if you want the deeper codegen/schema side of the runtime, but it is much broader than the file I/O pipeline.

## Patterns worth borrowing into GreebleFS

- Keep logical asset names separate from physical paths.
- Make device routing explicit and prefix-based.
- Treat bulk read paths as a first-class fast path.
- Separate stream primitives from higher-level serialization.
- Prefer schema-driven import/export for structured data.
- Use state machines for multi-step platform flows like save/select/load/delete.
- Keep archive writers and archive readers symmetric so the export path is testable, not implied.

## Practical reading order

If you only read a few files, read them in this order:

1. `file/device.h`
2. `file/stream.h`
3. `file/asset.h`
4. `file/packfile.h`
5. `file/packfile_builder.h`
6. `xmldata/data.h`
7. `xmldata/data.cpp`
8. `xmldata/datatypes.cpp`

That gives the fastest path to understanding how the engine moves bytes from disk to structured runtime data and back again.
