# OptiMatrix Storage System

GPU-accelerated, matrix-based storage system for K_OS providing sub-millisecond asset access through intelligent caching and content-addressable deduplication.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Storage Engine                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Transaction  │  │ Cache        │  │ Metrics      │     │
│  │ Manager      │  │ Manager      │  │ Collector    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
         │                  │                  │
         ▼                  ▼                  ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Matrix Database │  │ Entanglement    │  │ Version Manager │
│ (Indexing)      │  │ Layer (CAS)     │  │ (Deltas)        │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         │                  │                  │
         └──────────────────┴──────────────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ Storage Backend │
                  │   (RocksDB)     │
                  └─────────────────┘
```

## Performance Targets

- **<1ms** retrieval from Flux Cache (GPU)
- **<10ms** store latency for assets <100MB
- **<50ms** cold retrieval from disk
- **>500 MB/s** compression throughput
- **>80%** cache hit rate

## Key Features

### 1. Matrix Database
Multi-dimensional indexing for O(log n) queries:
- By asset type
- By project
- By tags
- By time range
- By dependencies

### 2. Quantum Entanglement (Content-Addressable Storage)
- Automatic deduplication via BLAKE3 content hashing
- Cross-project asset sharing
- Copy-on-write for shared assets
- Automatic garbage collection

### 3. Flux Cache
GPU-resident cache using wgpu buffers:
- Sub-millisecond access times
- Zero-copy operations
- LRU eviction policy
- Automatic prefetching

### 4. GPU Compression
wgpu compute pipelines for:
- Mesh quantization (16-bit positions)
- Normal octahedral encoding
- Texture BC7 compression
- 500+ MB/s throughput

### 5. Version Management
- Automatic versioning on updates
- Delta compression for space efficiency
- Temporal queries (get asset at timestamp)
- Configurable retention policies

### 6. Transaction Safety
- ACID guarantees
- Write-ahead logging
- Crash recovery
- Deadlock detection

## Configuration

All behavior is data-driven via `storage_registry.json`:

```json
{
  "backends": [...],
  "cache_policy": {...},
  "compression_policies": [...],
  "entanglement_policy": {...},
  "retention_policies": [...]
}
```

See `storage_registry.json` for full configuration options.

## Usage

```rust
use k_os_io::storage::{StorageEngine, StorageConfig, Asset};

// Initialize
let config = StorageConfig::default();
let engine = StorageEngine::new(config).await?;

// Store an asset
let mesh = Asset::Mesh(MeshAsset { ... });
let handle = engine.store(mesh).await?;

// Retrieve an asset
let retrieved = engine.retrieve(handle).await?;

// Query assets
let query = AssetQuery::default()
    .with_type("Mesh")
    .with_project("my-project")
    .with_tag("character");
let results = engine.query(query).await?;

// Get metrics
let metrics = engine.metrics();
println!("Cache hit rate: {:.2}%", metrics.cache_hit_rate * 100.0);
```

## Module Structure

```
storage/
├── mod.rs                  # Public API exports
├── types.rs                # Asset types and handles
├── engine.rs               # Storage engine core
├── matrix_db.rs            # Multi-dimensional indexing
├── entanglement.rs         # Content-addressable storage
├── version.rs              # Asset versioning
├── cache.rs                # Multi-tier caching
├── compression.rs          # GPU compression pipelines
├── transaction.rs          # ACID transactions
├── config.rs               # Configuration types
├── metrics.rs              # Performance metrics
├── backends/
│   ├── mod.rs              # Backend trait
│   └── rocksdb.rs          # RocksDB implementation
└── tests/
    └── mod.rs              # Unit tests
```

## Implementation Status

✅ Module structure created
✅ Type definitions
✅ Configuration system
✅ Backend trait
⏳ Core storage operations (Phase 1)
⏳ Matrix database (Phase 2)
⏳ GPU compression (Phase 3)
⏳ Flux cache (Phase 4)
⏳ Entanglement layer (Phase 5)
⏳ Version manager (Phase 6)
⏳ Transaction manager (Phase 7)
⏳ Import/export (Phase 8)

## Testing

```bash
# Run all storage tests
cargo test --package k-os-engine storage

# Run with property-based tests
cargo test --package k-os-engine storage -- --include-ignored

# Benchmark
cargo bench --package k-os-engine storage
```

## Dependencies

- **rocksdb**: Persistent storage backend
- **tokio**: Async runtime
- **dashmap**: Concurrent hash maps
- **blake3**: Content hashing
- **bincode**: Binary serialization
- **wgpu**: GPU compute
- **async-trait**: Async trait support

## Future Enhancements

- Remote backends (S3, HTTP)
- Distributed storage
- Real-time replication
- Advanced query language
- ML-based prefetching
- CUDA acceleration for compression
