/**
 * optimizeClient.ts
 * 
 * TypeScript bindings for K_OS Rust mesh optimization backend.
 * Provides GPU-optimized mesh processing via meshopt.
 */

// Type definitions matching Rust structs
export interface OptimizeMeshResult {
    positions: number[];
    normals: number[];
    uvs: number[] | null;
    indices: number[];
    original_vertex_count: number;
    final_vertex_count: number;
    original_face_count: number;
    final_face_count: number;
    time_ms: number;
    optimizations: string[];
}

export interface SimplifyResult {
    indices: number[];
    original_face_count: number;
    final_face_count: number;
    reduction_ratio: number;
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
 * Rust Mesh Optimization Backend
 */
export const rustOptimize = {
    /**
     * Optimize mesh for GPU rendering
     * Applies vertex cache and vertex fetch optimizations
     * Results in 30-50% faster GPU rendering
     */
    optimizeMesh: async (
        positions: Float32Array | number[],
        normals: Float32Array | number[],
        indices: Uint32Array | number[],
        uvs?: Float32Array | number[]
    ): Promise<OptimizeMeshResult | null> => {
        const invoke = await getInvoke();

        if (invoke) {
            try {
                const result: OptimizeMeshResult = await invoke('optimize_mesh', {
                    positions: Array.from(positions),
                    normals: Array.from(normals),
                    indices: Array.from(indices),
                    uvs: uvs ? Array.from(uvs) : null,
                });
                console.log(`[rustOptimize] Mesh optimized: ${result.optimizations.join(', ')}`);
                return result;
            } catch (e) {
                console.error('[rustOptimize] optimize_mesh failed:', e);
                return null;
            }
        }
        return null;
    },

    /**
     * Simplify mesh to target polygon ratio
     * Uses quadric error decimation for high-quality results
     * @param targetRatio - Target ratio (0.5 = reduce to 50%)
     * @param lockBorder - If true, preserve mesh borders (UV seams, etc.)
     */
    simplifyMesh: async (
        positions: Float32Array | number[],
        indices: Uint32Array | number[],
        targetRatio: number,
        lockBorder: boolean = true
    ): Promise<SimplifyResult | null> => {
        const invoke = await getInvoke();

        if (invoke) {
            try {
                const result: SimplifyResult = await invoke('simplify_mesh', {
                    positions: Array.from(positions),
                    indices: Array.from(indices),
                    targetRatio,
                    lockBorder,
                });
                console.log(`[rustOptimize] Mesh simplified: ${result.original_face_count} -> ${result.final_face_count} faces`);
                return result;
            } catch (e) {
                console.error('[rustOptimize] simplify_mesh failed:', e);
                return null;
            }
        }
        return null;
    },

    /**
     * Generate LOD chain for mesh
     * Creates multiple simplified versions at exponentially decreasing detail
     * LOD 0 = 50%, LOD 1 = 25%, LOD 2 = 12.5%, etc.
     */
    generateLODChain: async (
        positions: Float32Array | number[],
        indices: Uint32Array | number[],
        lodCount: number = 3
    ): Promise<SimplifyResult[] | null> => {
        const invoke = await getInvoke();

        if (invoke) {
            try {
                const result: SimplifyResult[] = await invoke('generate_lod_chain', {
                    positions: Array.from(positions),
                    indices: Array.from(indices),
                    lodCount,
                });
                console.log(`[rustOptimize] LOD chain generated: ${lodCount} levels`);
                return result;
            } catch (e) {
                console.error('[rustOptimize] generate_lod_chain failed:', e);
                return null;
            }
        }
        return null;
    },

    /**
     * Check if optimization backend is available
     */
    isAvailable: async (): Promise<boolean> => {
        const invoke = await getInvoke();
        return invoke !== null;
    },
};

/**
 * Helper to apply optimization result to Three.js geometry
 */
export function applyOptimizationToGeometry(
    geometry: any, // THREE.BufferGeometry
    result: OptimizeMeshResult
): void {
    // Replace position attribute
    const posAttr = geometry.attributes.position;
    const newPosArray = new Float32Array(result.positions);
    posAttr.array = newPosArray;
    posAttr.count = result.final_vertex_count;
    posAttr.needsUpdate = true;

    // Replace normal attribute
    const normalAttr = geometry.attributes.normal;
    if (normalAttr) {
        const newNormArray = new Float32Array(result.normals);
        normalAttr.array = newNormArray;
        normalAttr.count = result.final_vertex_count;
        normalAttr.needsUpdate = true;
    }

    // Replace UV attribute if provided
    if (result.uvs && geometry.attributes.uv) {
        const uvAttr = geometry.attributes.uv;
        const newUvArray = new Float32Array(result.uvs);
        uvAttr.array = newUvArray;
        uvAttr.count = result.final_vertex_count;
        uvAttr.needsUpdate = true;
    }

    // Replace index
    if (geometry.index) {
        geometry.setIndex(Array.from(result.indices));
    }

    // Update bounding volumes
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
}

export default rustOptimize;
