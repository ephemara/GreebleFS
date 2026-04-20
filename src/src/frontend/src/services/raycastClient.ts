/**
 * raycastClient.ts
 * 
 * TypeScript bindings for K_OS Rust raycasting backend (parry3d).
 * Provides high-performance ray-mesh intersection via Tauri.
 */

// Type definitions matching Rust structs
export interface RaycastResult {
    hit: boolean;
    point: [number, number, number] | null;
    normal: [number, number, number] | null;
    distance: number | null;
    face_index: number | null;
    time_ms: number;
}

export type RaycastMeshHandle = number;

// Check if we're running in Tauri
const isTauri = (): boolean => {
    return typeof window !== 'undefined' && '__TAURI__' in window;
};

// Lazy import Tauri invoke
let tauriInvoke: ((cmd: string, args?: any) => Promise<any>) | null = null;

const getInvoke = async () => {
    if (tauriInvoke) return tauriInvoke;

    if (isTauri()) {
        try {
            const tauri = await import('@tauri-apps/api/core');
            tauriInvoke = tauri.invoke;
            return tauriInvoke;
        } catch (e) {
            console.warn('Failed to import Tauri API:', e);
        }
    }
    return null;
};

/**
 * Rust Raycasting Backend
 */
export const rustRaycast = {
    /**
     * Initialize a mesh for raycasting (builds BVH)
     */
    initMesh: async (positions: Float32Array | number[], indices: Uint32Array | number[]): Promise<RaycastMeshHandle | null> => {
        const invoke = await getInvoke();

        if (invoke) {
            try {
                const posArray = Array.from(positions);
                const idxArray = Array.from(indices);
                const handle: RaycastMeshHandle = await invoke('init_raycast_mesh', {
                    positions: posArray,
                    indices: idxArray,
                });
                console.log(`[rustRaycast] Mesh initialized with BVH: handle=${handle}, verts=${posArray.length / 3}`);
                return handle;
            } catch (e) {
                console.error('[rustRaycast] Failed to init mesh:', e);
                return null;
            }
        }
        return null;
    },

    /**
     * Perform a raycast against the mesh
     */
    cast: async (
        handle: RaycastMeshHandle,
        origin: [number, number, number],
        direction: [number, number, number],
        maxDistance: number = 1000
    ): Promise<RaycastResult | null> => {
        const invoke = await getInvoke();

        if (invoke && handle) {
            try {
                const result: RaycastResult = await invoke('raycast', {
                    handle,
                    origin,
                    direction,
                    maxDistance,
                });
                return result;
            } catch (e) {
                console.error('[rustRaycast] Raycast failed:', e);
                return null;
            }
        }
        return null;
    },

    /**
     * Update mesh positions (rebuilds BVH)
     */
    updateMesh: async (handle: RaycastMeshHandle, positions: Float32Array | number[]): Promise<boolean> => {
        const invoke = await getInvoke();

        if (invoke && handle) {
            try {
                await invoke('update_raycast_mesh', {
                    handle,
                    positions: Array.from(positions),
                });
                return true;
            } catch (e) {
                console.error('[rustRaycast] Update mesh failed:', e);
                return false;
            }
        }
        return false;
    },

    /**
     * Dispose of a raycast mesh
     */
    dispose: async (handle: RaycastMeshHandle): Promise<void> => {
        const invoke = await getInvoke();

        if (invoke && handle) {
            try {
                await invoke('dispose_raycast_mesh', { handle });
            } catch (e) {
                console.error('[rustRaycast] Dispose failed:', e);
            }
        }
    },

    /**
     * Benchmark raycasting performance
     */
    benchmark: async (handle: RaycastMeshHandle, numRays: number): Promise<string | null> => {
        const invoke = await getInvoke();

        if (invoke && handle) {
            try {
                return await invoke('benchmark_raycast', { handle, numRays });
            } catch (e) {
                console.error('[rustRaycast] Benchmark failed:', e);
                return null;
            }
        }
        return null;
    },

    /**
     * Check if Rust backend is available
     */
    isAvailable: async (): Promise<boolean> => {
        const invoke = await getInvoke();
        return invoke !== null;
    },
};

export default rustRaycast;

// ============================================================================
// UV-ENABLED RAYCASTING (For KPainter)
// ============================================================================

/**
 * Raycast result with UV coordinates (for texture painting)
 */
export interface RaycastResultWithUV {
    hit: boolean;
    point: [number, number, number] | null;
    normal: [number, number, number] | null;
    uv: [number, number] | null;
    distance: number | null;
    face_index: number | null;
    time_ms: number;
}

/**
 * Rust UV Raycasting Backend (for KPainter)
 * Returns UV coordinates at hit points for texture painting
 */
export const rustRaycastUV = {
    /**
     * Initialize a mesh with UV data for raycasting
     */
    initMesh: async (
        positions: Float32Array | number[],
        indices: Uint32Array | number[],
        uvs: Float32Array | number[]
    ): Promise<RaycastMeshHandle | null> => {
        const invoke = await getInvoke();

        if (invoke) {
            try {
                const posArray = Array.from(positions);
                const idxArray = Array.from(indices);
                const uvArray = Array.from(uvs);
                const handle: RaycastMeshHandle = await invoke('init_raycast_mesh_with_uvs', {
                    positions: posArray,
                    indices: idxArray,
                    uvs: uvArray,
                });
                console.log(`[rustRaycastUV] Mesh with UVs initialized: handle=${handle}, verts=${posArray.length / 3}`);
                return handle;
            } catch (e) {
                console.error('[rustRaycastUV] Failed to init mesh:', e);
                return null;
            }
        }
        return null;
    },

    /**
     * Perform a raycast that returns UV coordinates at hit point
     */
    cast: async (
        handle: RaycastMeshHandle,
        origin: [number, number, number],
        direction: [number, number, number],
        maxDistance: number = 1000
    ): Promise<RaycastResultWithUV | null> => {
        const invoke = await getInvoke();

        if (invoke && handle) {
            try {
                const result: RaycastResultWithUV = await invoke('raycast_with_uv', {
                    handle,
                    origin,
                    direction,
                    maxDistance,
                });
                return result;
            } catch (e) {
                console.error('[rustRaycastUV] Raycast failed:', e);
                return null;
            }
        }
        return null;
    },

    /**
     * Update mesh positions (rebuilds BVH)
     */
    updateMesh: async (handle: RaycastMeshHandle, positions: Float32Array | number[]): Promise<boolean> => {
        const invoke = await getInvoke();

        if (invoke && handle) {
            try {
                await invoke('update_raycast_mesh_with_uvs', {
                    handle,
                    positions: Array.from(positions),
                });
                return true;
            } catch (e) {
                console.error('[rustRaycastUV] Update mesh failed:', e);
                return false;
            }
        }
        return false;
    },

    /**
     * Dispose of a UV raycast mesh
     */
    dispose: async (handle: RaycastMeshHandle): Promise<void> => {
        const invoke = await getInvoke();

        if (invoke && handle) {
            try {
                await invoke('dispose_raycast_mesh_with_uvs', { handle });
            } catch (e) {
                console.error('[rustRaycastUV] Dispose failed:', e);
            }
        }
    },

    /**
     * Check if Rust backend is available
     */
    isAvailable: async (): Promise<boolean> => {
        const invoke = await getInvoke();
        return invoke !== null;
    },
};

// ============================================================================
// RUST RAYCAST MANAGER - Full integration with throttling + caching
// ============================================================================

/**
 * Cached raycast hit for smooth 60fps
 */
interface CachedHit {
    point: { x: number; y: number; z: number };
    normal: { x: number; y: number; z: number };
    distance: number;
    timestamp: number;
}

/**
 * High-performance raycast manager with:
 * - Throttled async raycasting (max 60/sec)
 * - Result caching for instant access
 * - Automatic mesh registration
 * - BVH sync after sculpting
 */
class RustRaycastManager {
    private handles: Map<string, RaycastMeshHandle> = new Map();
    private initialized: boolean = false;
    private available: boolean = false;

    // Throttling state
    private pendingRaycast: boolean = false;
    private lastRaycastTime: number = 0;
    private readonly MIN_RAYCAST_INTERVAL = 16; // ~60fps max

    // Cached result for instant access
    private cachedHit: CachedHit | null = null;
    private cachedMeshId: string | null = null;

    // Dirty flag - set after sculpting to trigger BVH rebuild
    private dirtyMeshes: Set<string> = new Set();

    async init() {
        if (this.initialized) return;
        this.available = await rustRaycast.isAvailable();
        this.initialized = true;
        console.log(`[RustRaycastManager] Backend available: ${this.available}`);
    }

    isAvailable(): boolean {
        return this.available;
    }

    /**
     * Register a THREE.Mesh for Rust raycasting
     */
    async registerMesh(mesh: any): Promise<RaycastMeshHandle | null> {
        await this.init();

        if (!this.available) return null;

        const uuid = mesh.uuid;
        if (this.handles.has(uuid)) {
            return this.handles.get(uuid)!;
        }

        const geo = mesh.geometry;
        const posAttr = geo.attributes.position;
        const positions = new Float32Array(posAttr.array);

        const indexAttr = geo.index;
        if (!indexAttr) {
            console.warn('[RustRaycastManager] Mesh has no indices, skipping');
            return null;
        }
        const indices = new Uint32Array(indexAttr.array);

        console.log(`[RustRaycastManager] Registering raycast mesh with ${positions.length / 3} verts...`);
        const handle = await rustRaycast.initMesh(positions, indices);
        if (handle !== null) {
            this.handles.set(uuid, handle);
            console.log(`[RustRaycastManager] Raycast mesh registered: ${uuid} -> handle ${handle}`);
        }
        return handle;
    }

    /**
     * Get cached raycast result (instant, no async)
     * Use this in the render loop for smooth 60fps
     */
    getCachedHit(): CachedHit | null {
        // Cache expires after 100ms
        if (this.cachedHit && Date.now() - this.cachedHit.timestamp < 100) {
            return this.cachedHit;
        }
        return null;
    }

    /**
     * Request a raycast (throttled, async)
     * Results are cached and retrieved via getCachedHit()
     */
    requestRaycast(
        mesh: any,
        origin: { x: number; y: number; z: number },
        direction: { x: number; y: number; z: number },
        maxDistance: number = 1000
    ): void {
        if (!this.available) return;

        const uuid = mesh.uuid;
        const handle = this.handles.get(uuid);
        if (!handle) return;

        // Throttle: skip if already pending or too soon
        const now = Date.now();
        if (this.pendingRaycast || (now - this.lastRaycastTime) < this.MIN_RAYCAST_INTERVAL) {
            return;
        }

        this.pendingRaycast = true;
        this.lastRaycastTime = now;
        this.cachedMeshId = uuid;

        // Fire async raycast
        rustRaycast.cast(
            handle,
            [origin.x, origin.y, origin.z],
            [direction.x, direction.y, direction.z],
            maxDistance
        ).then(result => {
            this.pendingRaycast = false;

            if (result && result.hit && result.point && result.normal) {
                this.cachedHit = {
                    point: { x: result.point[0], y: result.point[1], z: result.point[2] },
                    normal: { x: result.normal[0], y: result.normal[1], z: result.normal[2] },
                    distance: result.distance!,
                    timestamp: Date.now(),
                };
            } else {
                this.cachedHit = null;
            }
        }).catch(() => {
            this.pendingRaycast = false;
        });
    }

    /**
     * Mark mesh as dirty (call after sculpting)
     * BVH will be rebuilt on next sync
     */
    markDirty(mesh: any): void {
        this.dirtyMeshes.add(mesh.uuid);
    }

    /**
     * Sync dirty meshes - rebuild BVH for sculpted meshes
     * Call this on pointer up (end of stroke)
     */
    async syncDirtyMeshes(meshes: Map<string, any>): Promise<void> {
        if (!this.available || this.dirtyMeshes.size === 0) return;

        for (const uuid of this.dirtyMeshes) {
            const handle = this.handles.get(uuid);
            const mesh = meshes.get(uuid);
            if (handle && mesh) {
                const positions = mesh.geometry.attributes.position.array as Float32Array;
                await rustRaycast.updateMesh(handle, positions);
            }
        }
        this.dirtyMeshes.clear();
    }

    /**
     * Dispose mesh and remove from manager
     */
    async disposeMesh(mesh: any): Promise<void> {
        const uuid = mesh.uuid;
        const handle = this.handles.get(uuid);
        if (handle) {
            await rustRaycast.dispose(handle);
            this.handles.delete(uuid);
            this.dirtyMeshes.delete(uuid);
        }
    }

    /**
     * Dispose all meshes
     */
    async disposeAll(): Promise<void> {
        for (const [uuid, handle] of this.handles) {
            await rustRaycast.dispose(handle);
        }
        this.handles.clear();
        this.dirtyMeshes.clear();
        this.cachedHit = null;
    }

    /**
     * Get handle for mesh
     */
    getHandle(mesh: any): RaycastMeshHandle | null {
        return this.handles.get(mesh.uuid) ?? null;
    }
}

// Global singleton
export const rustRaycastManager = new RustRaycastManager();

// ============================================================================
// UV RAYCAST MANAGER (For KPainter)
// ============================================================================

/**
 * Cached UV raycast hit
 */
interface CachedUVHit {
    point: { x: number; y: number; z: number };
    normal: { x: number; y: number; z: number };
    uv: { x: number; y: number };
    distance: number;
    timestamp: number;
}

/**
 * High-performance UV raycast manager for KPainter
 * - Caches UV coordinates at hit points
 * - Throttled for 60fps
 * - Used for texture painting
 */
class RustRaycastUVManager {
    private handles: Map<string, RaycastMeshHandle> = new Map();
    private initialized: boolean = false;
    private available: boolean = false;

    // Throttling state
    private pendingRaycast: boolean = false;
    private lastRaycastTime: number = 0;
    private readonly MIN_RAYCAST_INTERVAL = 8; // 120+ fps capable

    // Cached result with UV
    private cachedHit: CachedUVHit | null = null;

    async init() {
        if (this.initialized) return;
        this.available = await rustRaycastUV.isAvailable();
        this.initialized = true;
        console.log(`[RustRaycastUVManager] Backend available: ${this.available}`);
    }

    isAvailable(): boolean {
        return this.available;
    }

    /**
     * Register a THREE.Mesh with UVs for raycasting
     */
    async registerMesh(mesh: any): Promise<RaycastMeshHandle | null> {
        await this.init();

        if (!this.available) return null;

        const uuid = mesh.uuid;
        if (this.handles.has(uuid)) {
            return this.handles.get(uuid)!;
        }

        const geo = mesh.geometry;
        const posAttr = geo.attributes.position;
        const uvAttr = geo.attributes.uv;
        const positions = new Float32Array(posAttr.array);

        if (!uvAttr) {
            console.warn('[RustRaycastUVManager] Mesh has no UVs, cannot use for painting');
            return null;
        }
        const uvs = new Float32Array(uvAttr.array);

        const indexAttr = geo.index;
        if (!indexAttr) {
            console.warn('[RustRaycastUVManager] Mesh has no indices, skipping');
            return null;
        }
        const indices = new Uint32Array(indexAttr.array);

        console.log(`[RustRaycastUVManager] Registering mesh with ${positions.length / 3} verts and ${uvs.length / 2} UVs...`);
        const handle = await rustRaycastUV.initMesh(positions, indices, uvs);
        if (handle !== null) {
            this.handles.set(uuid, handle);
            console.log(`[RustRaycastUVManager] Mesh registered: ${uuid} -> handle ${handle}`);
        }
        return handle;
    }

    /**
     * Get cached UV hit (instant, no async)
     */
    getCachedHit(): CachedUVHit | null {
        // Cache expires after 100ms
        if (this.cachedHit && Date.now() - this.cachedHit.timestamp < 100) {
            return this.cachedHit;
        }
        return null;
    }

    /**
     * Request a UV raycast (throttled, async)
     */
    requestRaycast(
        mesh: any,
        origin: { x: number; y: number; z: number },
        direction: { x: number; y: number; z: number },
        maxDistance: number = 1000
    ): void {
        if (!this.available) return;

        const uuid = mesh.uuid;
        const handle = this.handles.get(uuid);
        if (!handle) return;

        // Throttle
        const now = Date.now();
        if (this.pendingRaycast || (now - this.lastRaycastTime) < this.MIN_RAYCAST_INTERVAL) {
            return;
        }

        this.pendingRaycast = true;
        this.lastRaycastTime = now;

        // Fire async raycast
        rustRaycastUV.cast(
            handle,
            [origin.x, origin.y, origin.z],
            [direction.x, direction.y, direction.z],
            maxDistance
        ).then(result => {
            this.pendingRaycast = false;

            if (result && result.hit && result.point && result.normal && result.uv) {
                this.cachedHit = {
                    point: { x: result.point[0], y: result.point[1], z: result.point[2] },
                    normal: { x: result.normal[0], y: result.normal[1], z: result.normal[2] },
                    uv: { x: result.uv[0], y: result.uv[1] },
                    distance: result.distance!,
                    timestamp: Date.now(),
                };
            } else {
                this.cachedHit = null;
            }
        }).catch(() => {
            this.pendingRaycast = false;
        });
    }

    /**
     * Sync raycast (blocking, for critical operations)
     */
    async raycastSync(
        mesh: any,
        origin: { x: number; y: number; z: number },
        direction: { x: number; y: number; z: number },
        maxDistance: number = 1000
    ): Promise<CachedUVHit | null> {
        if (!this.available) return null;

        const uuid = mesh.uuid;
        const handle = this.handles.get(uuid);
        if (!handle) return null;

        const result = await rustRaycastUV.cast(
            handle,
            [origin.x, origin.y, origin.z],
            [direction.x, direction.y, direction.z],
            maxDistance
        );

        if (result && result.hit && result.point && result.normal && result.uv) {
            return {
                point: { x: result.point[0], y: result.point[1], z: result.point[2] },
                normal: { x: result.normal[0], y: result.normal[1], z: result.normal[2] },
                uv: { x: result.uv[0], y: result.uv[1] },
                distance: result.distance!,
                timestamp: Date.now(),
            };
        }
        return null;
    }

    /**
     * Dispose mesh
     */
    async disposeMesh(mesh: any): Promise<void> {
        const uuid = mesh.uuid;
        const handle = this.handles.get(uuid);
        if (handle) {
            await rustRaycastUV.dispose(handle);
            this.handles.delete(uuid);
        }
    }

    /**
     * Dispose all
     */
    async disposeAll(): Promise<void> {
        for (const [uuid, handle] of this.handles) {
            await rustRaycastUV.dispose(handle);
        }
        this.handles.clear();
        this.cachedHit = null;
    }

    /**
     * Get handle for mesh
     */
    getHandle(mesh: any): RaycastMeshHandle | null {
        return this.handles.get(mesh.uuid) ?? null;
    }
}

// Global singleton for KPainter
export const rustRaycastUVManager = new RustRaycastUVManager();
