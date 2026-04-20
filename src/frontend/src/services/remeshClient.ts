/**
 * remeshClient.ts
 * 
 * TypeScript bindings for K_OS Rust remeshing backend.
 * Provides marching cubes remeshing and fast KD-tree vertex queries.
 */

// Type definitions matching Rust structs
export interface RemeshResult {
    positions: number[];
    indices: number[];
    original_vertex_count: number;
    new_vertex_count: number;
    original_face_count: number;
    new_face_count: number;
    time_ms: number;
}

// Lazy import Tauri invoke
let tauriInvoke: ((cmd: string, args?: any) => Promise<any>) | null = null;

const isTauri = (): boolean => {
    return typeof window !== 'undefined' && '__TAURI__' in window;
};

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
 * Rust Remesh Backend
 */
export const rustRemesh = {
    /**
     * Remesh using marching cubes / voxel grid
     * @param resolution - Voxel grid resolution (higher = more detail)
     */
    remesh: async (
        positions: Float32Array | number[],
        indices: Uint32Array | number[],
        resolution: number = 64
    ): Promise<RemeshResult | null> => {
        const invoke = await getInvoke();

        if (invoke) {
            try {
                const result: RemeshResult = await invoke('remesh_marching_cubes', {
                    positions: Array.from(positions),
                    indices: Array.from(indices),
                    resolution,
                });
                console.log(`[rustRemesh] Remesh complete: ${result.original_vertex_count} -> ${result.new_vertex_count} verts`);
                return result;
            } catch (e) {
                console.error('[rustRemesh] remesh failed:', e);
                return null;
            }
        }
        return null;
    },

    /**
     * Remesh with binary data (faster for large meshes)
     */
    remeshBinary: async (
        positions: Float32Array,
        indices: Uint32Array,
        resolution: number = 64
    ): Promise<RemeshResult | null> => {
        const invoke = await getInvoke();

        if (invoke) {
            try {
                const result: RemeshResult = await invoke('remesh_marching_cubes_binary', {
                    positionsBytes: Array.from(new Uint8Array(positions.buffer)),
                    indicesBytes: Array.from(new Uint8Array(indices.buffer)),
                    resolution,
                });
                return result;
            } catch (e) {
                console.error('[rustRemesh] remesh_binary failed:', e);
                return null;
            }
        }
        return null;
    },

    /**
     * Query nearest vertices using KD-tree (ultra-fast)
     * Use this for brush radius queries on high-poly meshes
     */
    queryNearestVertices: async (
        positions: Float32Array | number[],
        queryPoint: [number, number, number],
        radius: number,
        maxResults: number = 10000
    ): Promise<number[] | null> => {
        const invoke = await getInvoke();

        if (invoke) {
            try {
                const result: number[] = await invoke('query_nearest_vertices', {
                    positions: Array.from(positions),
                    queryPoint,
                    radius,
                    maxResults,
                });
                return result;
            } catch (e) {
                console.error('[rustRemesh] query_nearest_vertices failed:', e);
                return null;
            }
        }
        return null;
    },

    /**
     * Check if remesh backend is available
     */
    isAvailable: async (): Promise<boolean> => {
        const invoke = await getInvoke();
        return invoke !== null;
    },
};

/**
 * Apply remesh result to Three.js geometry
 */
export function applyRemeshToGeometry(
    geometry: any, // THREE.BufferGeometry
    result: RemeshResult
): void {
    // Dispose old geometry data
    geometry.dispose();

    // Set new positions
    geometry.setAttribute(
        'position',
        new (window as any).THREE.Float32BufferAttribute(result.positions, 3)
    );

    // Set new indices
    geometry.setIndex(Array.from(result.indices));

    // Compute normals for new mesh
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
}

export default rustRemesh;
