# Alien code map for `reference/src`

This is the weirdest, most reusable code I found in the Rage reference tree.

I am not counting ordinary filesystem plumbing here. This is the code that feels unusually modern, data-oriented, or architecture-heavy for its era, and that could actually inform GreebleFS design.

## 1. `net/task2.h`

This is the strongest find.

What makes it unusual:

- Tasks are represented by C++ lambdas.
- A task can stay `Pending` across many updates.
- Tasks support continuations.
- Tasks support child tasks, with parent sleep/until-children-complete behavior.
- Cancellation propagates through antecedents, continuations, and children.
- Tasks can run either on the main thread or the thread pool.

Why it matters for GreebleFS:

- This is a clean model for background indexing, preview generation, metadata extraction, import pipelines, and any operation that needs cancellation.
- It is also a better mental model than ad hoc async callbacks because it has explicit task lifetimes and dependency edges.

Files to study first:

- `net/task2.h`
- `system/threadpool.h`
- `system/task.h`

## 2. `system/task.h`, `system/threadpool.h`, `system/task_spu.h`

This is the older but still very exotic job/runtime layer.

What makes it unusual:

- Explicit task manager with scheduler classes.
- Worker threads are registered into a pool and pull work items from a queue.
- The SPU-facing header wires in DMA, scratch buffers, trace hooks, and corruption checks.
- There is a hard job-size budget and platform-specific scheduling policy.

Why it matters for GreebleFS:

- This is a strong reference for a real work-queue architecture with explicit routing and cancellation.
- Even though the SPU details are not portable, the shape of the system is excellent for heavy background work and pipeline staging.

Files to study first:

- `system/task.h`
- `system/threadpool.h`
- `system/task_spu.h`
- `system/task_spu_config.h`

## 3. `vectormath/`

This is the engine's high-performance math rewrite.

What makes it unusual:

- It is a "new vector/matrix library" rather than a thin wrapper around older math types.
- The tree is full of platform-specialized implementations.
- There are SoA variants, Xenon-specific code, PS3-specific code, and dense permutation helpers.

Why it matters for GreebleFS:

- If we need fast batched layout math, hit testing, transforms, or camera-style computations, this is the kind of data-oriented library to imitate.
- The SoA split is especially useful for any future batch-processed work in the explorer shell.

Files to study first:

- `vectormath/README.txt`
- `vectormath/classfreefuncsv_soa.h`
- `vectormath/v4vector4vcore_win32pc.inl`
- `vectormath/v4vector4vcore_xbox360.inl`

## 4. `system/virtualallocator.h`

This is not flashy, but it is one of the best "serious runtime" files in the tree.

What makes it unusual:

- It uses 64K pages to reduce TLB misses.
- It separates virtual allocation from physical allocation.
- It supports memtype tagging and resource-map allocation.
- It treats memory layout as a first-class runtime policy.

Why it matters for GreebleFS:

- This is a good model for a file cache, preview cache, thumbnail cache, or any staged memory system that wants to control layout instead of letting the OS pick everything.

Files to study first:

- `system/virtualallocator.h`
- `data/resource.h`
- `system/tinybuddyheap.h`

## 5. `audioengine/ambisonics.h`, `audiohardware/granularsubmix.cpp`, `audiohardware/waveslot.cpp`

This is where the tree gets genuinely strange.

What makes it unusual:

- `ambisonics.h` contains a higher-order ambisonic decoder and a `TabuSpuOutput` structure, which points to search-based coefficient optimization.
- `granularsubmix.cpp` uses SPU scratch buffers, crossfades, resampling, FFT timing, and grain scheduling.
- `waveslot.cpp` handles async wave loading, batching, reference counts, search paths, and cache tables.

Why it matters for GreebleFS:

- The audio code is not directly portable to a file explorer, but the architecture is useful:
  - staged loading
  - batch work
  - cache tables
  - explicit reference counts
  - graph-like runtime objects

Files to study first:

- `audioengine/ambisonics.h`
- `audiohardware/granularsubmix.cpp`
- `audiohardware/waveslot.cpp`

## 6. `zlib/inflateServer.cpp`

This is a small but very clean service-style compute pipeline.

What makes it unusual:

- It is an SPU task that DMA-streams compressed input and decompressed output.
- It uses a dedicated buffer choreography loop instead of a simple blocking inflate call.
- It looks like a tiny worker service, not just a library wrapper.

Why it matters for GreebleFS:

- This is a good pattern for heavy decompression, archive expansion, or asset ingest pipelines that should not block the main UI thread.

Files to study first:

- `zlib/inflateServer.cpp`
- `zlib/inflateServer.task`
- `zlib/inflateServer.h`

## Strongest borrow targets for GreebleFS

If we only mine a few ideas from the tree, I would take these:

1. `net/task2.h` for cancellable task graphs.
2. `system/task.h` and `system/threadpool.h` for explicit worker scheduling.
3. `vectormath/` for batched SIMD-style math.
4. `system/virtualallocator.h` for cache-aware memory management.
5. `zlib/inflateServer.cpp` for staged decompression services.

## What I would not copy literally

- Anything SPU-specific or PS3/DMA-specific.
- Audio-domain logic unless we are actually building audio tooling.
- Platform macro scaffolding unless we need the same split across targets.

## Honorable mentions

- `atl/` is a very deep custom container and utility layer. Useful if we need intrusive lists, pools, maps, defrag heaps, or custom delegates.
- `data/resource.h` is a strong resource relocation/fixup system for runtime-loaded blobs.
- `audioeffecttypes/` and `audiohardware/` are full of higher-end DSP graphs if we want more streaming or compute ideas.
