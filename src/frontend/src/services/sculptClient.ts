/**
 * sculptClient.ts
 * 
 * TypeScript bindings for K_OS Rust sculpting backend.
 * Provides high-performance brush operations via Tauri.
 * Falls back to JavaScript implementation when Tauri is not available.
 */

// Type definitions matching Rust structs
export interface BrushResult {
    modified_indices: number[];
    new_positions: number[];
    new_normals?: number[];      // Normals computed by Rust (glam SIMD)
    normal_indices?: number[];   // Indices for new_normals (superset of modified_indices)
    time_ms: number;
    affected_count: number;
}

export type SculptMeshHandle = number;

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
 * Rust Sculpting Backend
 */
export const rustSculpt = {
    /**
     * Initialize a mesh for Rust-accelerated sculpting
     * @param positions Flat array of vertex positions [x0,y0,z0, x1,y1,z1, ...]
     * @param indices Flat array of triangle indices
     * @returns Handle for subsequent operations
     */
    initMesh: async (positions: Float32Array | number[], indices: Uint32Array | number[]): Promise<SculptMeshHandle | null> => {
        const invoke = await getInvoke();

        if (invoke) {
            try {
                const posArray = Array.from(positions);
                const idxArray = Array.from(indices);
                const handle: SculptMeshHandle = await invoke('init_sculpt_mesh', {
                    positions: posArray,
                    indices: idxArray,
                });
                console.log(`[rustSculpt] Mesh initialized: handle=${handle}, verts=${posArray.length / 3}`);
                return handle;
            } catch (e) {
                console.error('[rustSculpt] Failed to init mesh:', e);
                return null;
            }
        }
        return null;
    },

    /**
     * Apply a brush stroke to the mesh
     */
    applyBrush: async (
        handle: SculptMeshHandle,
        point: [number, number, number],
        normal: [number, number, number],
        tool: string,
        radius: number,
        intensity: number,
        symmetry?: 'X' | 'NONE'
    ): Promise<BrushResult | null> => {
        const invoke = await getInvoke();

        if (invoke && handle) {
            try {
                const result: BrushResult = await invoke('apply_brush', {
                    handle,
                    point,
                    normal,
                    tool,
                    radius,
                    intensity,
                    symmetry: symmetry === 'X' ? 'X' : null,
                });
                return result;
            } catch (e) {
                console.error('[rustSculpt] Brush failed:', e);
                return null;
            }
        }
        return null;
    },

    /**
     * Update mesh positions in Rust (after JS-side changes like undo)
     */
    updatePositions: async (handle: SculptMeshHandle, positions: Float32Array | number[]): Promise<boolean> => {
        const invoke = await getInvoke();

        if (invoke && handle) {
            try {
                await invoke('update_sculpt_positions', {
                    handle,
                    positions: Array.from(positions),
                });
                return true;
            } catch (e) {
                console.error('[rustSculpt] Update positions failed:', e);
                return false;
            }
        }
        return false;
    },

    /**
     * Get all positions from Rust mesh
     */
    getPositions: async (handle: SculptMeshHandle): Promise<Float32Array | null> => {
        const invoke = await getInvoke();

        if (invoke && handle) {
            try {
                const positions: number[] = await invoke('get_sculpt_positions', { handle });
                return new Float32Array(positions);
            } catch (e) {
                console.error('[rustSculpt] Get positions failed:', e);
                return null;
            }
        }
        return null;
    },

    /**
     * Dispose of a sculpt mesh handle
     */
    dispose: async (handle: SculptMeshHandle): Promise<void> => {
        const invoke = await getInvoke();

        if (invoke && handle) {
            try {
                await invoke('dispose_sculpt_mesh', { handle });
            } catch (e) {
                console.error('[rustSculpt] Dispose failed:', e);
            }
        }
    },

    /**
     * Benchmark the spatial grid performance
     */
    benchmark: async (vertexCount: number, radius: number): Promise<string | null> => {
        const invoke = await getInvoke();

        if (invoke) {
            try {
                return await invoke('benchmark_sculpt', { vertexCount, radius });
            } catch (e) {
                console.error('[rustSculpt] Benchmark failed:', e);
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

/**
 * Helper to apply brush result to Three.js geometry
 * Now uses Rust-computed normals for high performance
 */
export function applyBrushResultToGeometry(
    geometry: any, // THREE.BufferGeometry
    result: BrushResult,
    skipNormals: boolean = false // Now we can afford normals since Rust computes them!
): void {
    const posAttr = geometry.attributes.position;
    const posArray = posAttr.array as Float32Array;

    // Apply modified positions
    for (let i = 0; i < result.modified_indices.length; i++) {
        const idx = result.modified_indices[i];
        posArray[idx * 3] = result.new_positions[i * 3];
        posArray[idx * 3 + 1] = result.new_positions[i * 3 + 1];
        posArray[idx * 3 + 2] = result.new_positions[i * 3 + 2];
    }
    posAttr.needsUpdate = true;

    // Apply Rust-computed normals (FAST - no JS recomputation needed!)
    if (!skipNormals && result.new_normals && result.normal_indices) {
        const normalAttr = geometry.attributes.normal;
        if (normalAttr) {
            const normalArray = normalAttr.array as Float32Array;
            for (let i = 0; i < result.normal_indices.length; i++) {
                const idx = result.normal_indices[i];
                normalArray[idx * 3] = result.new_normals[i * 3];
                normalArray[idx * 3 + 1] = result.new_normals[i * 3 + 1];
                normalArray[idx * 3 + 2] = result.new_normals[i * 3 + 2];
            }
            normalAttr.needsUpdate = true;
        }
    } else if (!skipNormals && !result.new_normals) {
        // Fallback to JS if Rust didn't provide normals
        geometry.computeVertexNormals();
    }
}

export default rustSculpt;
