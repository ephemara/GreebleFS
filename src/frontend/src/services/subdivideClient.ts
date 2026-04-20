/**
 * subdivideClient.ts
 * 
 * TypeScript bindings for K_OS Rust subdivision backend.
 * Provides high-performance Loop subdivision via Tauri.
 */

// Type definitions matching Rust structs
export interface Attribute {
    values: number[]; // Flat array
    item_size: number;
}

export interface SubdivisionResult {
    positions: number[];
    indices: number[];
    attributes: Attribute[];
    vertex_count: number;
    face_count: number;
    time_ms: number;
}

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
 * Rust Subdivision Backend
 */
export const rustSubdivide = {
    /**
     * Perform Loop subdivision on a mesh
     * @param positions Flat array of vertex positions [x0,y0,z0, ...]
     * @param indices Flat array of triangle indices
     * @param attributes List of attributes to subdivide (UVs, Colors, etc.)
     * @param levels Number of subdivision levels (1-4)
     * @returns Subdivided mesh positions and indices
     */
    subdivide: async (
        positions: Float32Array | number[],
        indices: Uint32Array | number[],
        attributes: Attribute[] = [],
        levels: number = 1
    ): Promise<SubdivisionResult | null> => {
        const invoke = await getInvoke();

        if (invoke) {
            try {
                console.log(`[rustSubdivide] Starting ${levels} level(s) subdivision...`);
                // Ensure plain arrays for serialization
                const safeAttributes = attributes.map(attr => ({
                    values: Array.from(attr.values),
                    item_size: attr.item_size
                }));

                const result: SubdivisionResult = await invoke('subdivide_mesh', {
                    positions: Array.from(positions),
                    indices: Array.from(indices),
                    attributes: safeAttributes,
                    levels,
                });
                console.log(`[rustSubdivide] Complete: ${result.vertex_count} verts, ${result.face_count} faces in ${result.time_ms.toFixed(2)}ms`);
                return result;
            } catch (e) {
                console.error('[rustSubdivide] Failed:', e);
                return null;
            }
        }
        return null;
    },

    /**
     * Benchmark subdivision performance
     */
    benchmark: async (levels: number): Promise<string | null> => {
        const invoke = await getInvoke();

        if (invoke) {
            try {
                return await invoke('benchmark_subdivide', { vertexCount: 12, levels });
            } catch (e) {
                console.error('[rustSubdivide] Benchmark failed:', e);
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

export default rustSubdivide;
