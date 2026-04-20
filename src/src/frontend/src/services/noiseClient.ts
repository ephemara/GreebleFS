/**
 * noiseClient.ts
 * 
 * TypeScript bindings for K_OS Rust procedural noise backend.
 * Provides noise-based sculpting brushes and texture generation.
 */

// Type definitions matching Rust structs
export interface NoiseParams {
    noise_type: 'perlin' | 'simplex' | 'worley' | 'fbm';
    frequency: number;
    amplitude: number;
    octaves: number;      // For fbm
    lacunarity: number;   // For fbm  
    persistence: number;  // For fbm
    seed: number;
}

export interface NoiseDisplacementResult {
    positions: number[];
    time_ms: number;
    vertex_count: number;
}

// Default noise params
export const defaultNoiseParams: NoiseParams = {
    noise_type: 'perlin',
    frequency: 1.0,
    amplitude: 0.1,
    octaves: 4,
    lacunarity: 2.0,
    persistence: 0.5,
    seed: 0,
};

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
 * Rust Noise Backend
 */
export const rustNoise = {
    /**
     * Apply noise displacement to mesh vertices
     * Displaces each vertex along its normal by noise value
     */
    applyDisplacement: async (
        positions: Float32Array | number[],
        normals: Float32Array | number[],
        params: NoiseParams
    ): Promise<NoiseDisplacementResult | null> => {
        const invoke = await getInvoke();

        if (invoke) {
            try {
                const result: NoiseDisplacementResult = await invoke('apply_noise_displacement', {
                    positions: Array.from(positions),
                    normals: Array.from(normals),
                    params,
                });
                console.log(`[rustNoise] Displacement applied: ${result.vertex_count} verts in ${result.time_ms.toFixed(2)}ms`);
                return result;
            } catch (e) {
                console.error('[rustNoise] apply_noise_displacement failed:', e);
                return null;
            }
        }
        return null;
    },

    /**
     * Sample noise at a single 3D point
     * Useful for brush preview or per-vertex queries
     */
    samplePoint: async (
        x: number,
        y: number,
        z: number,
        params: NoiseParams
    ): Promise<number> => {
        const invoke = await getInvoke();

        if (invoke) {
            try {
                return await invoke('sample_noise_point', { x, y, z, params });
            } catch (e) {
                console.error('[rustNoise] sample_noise_point failed:', e);
                return 0;
            }
        }
        return 0;
    },

    /**
     * Generate a 2D noise texture (for brush alphas)
     * Returns normalized 0-1 values
     */
    generateTexture: async (
        width: number,
        height: number,
        params: NoiseParams
    ): Promise<Float32Array | null> => {
        const invoke = await getInvoke();

        if (invoke) {
            try {
                const result: number[] = await invoke('generate_noise_texture', {
                    width,
                    height,
                    params,
                });
                console.log(`[rustNoise] Texture generated: ${width}x${height}`);
                return new Float32Array(result);
            } catch (e) {
                console.error('[rustNoise] generate_noise_texture failed:', e);
                return null;
            }
        }
        return null;
    },

    /**
     * Check if noise backend is available
     */
    isAvailable: async (): Promise<boolean> => {
        const invoke = await getInvoke();
        return invoke !== null;
    },
};

export default rustNoise;
