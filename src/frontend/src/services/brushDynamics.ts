/**
 * brushDynamics.ts
 * 
 * TypeScript bindings for K_OS Rust brush dynamics.
 * High-performance: interpolation, symmetry, and velocity grid.
 */

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
            console.warn('[brushDynamics] Failed to import Tauri API:', e);
        }
    }
    return null;
};

// ============================================================================
// TYPES
// ============================================================================

export interface InterpolatedPoint {
    uv: [number, number];
    pressure: number;
    t: number;
}

export interface SymmetryConfig {
    mirror_x: boolean;
    mirror_y: boolean;
    mirror_z: boolean;
    radial_count: number;
    center: [number, number];
}

export interface PaintOp {
    uv: [number, number];
    pressure: number;
}

// ============================================================================
// BRUSH INTERPOLATION - Replaces 100-raycast JS loop!
// ============================================================================

/**
 * Interpolate brush stroke between two UV positions.
 * Returns max 50 intermediate points (capped for performance).
 */
export async function interpolateBrushStroke(
    startUv: [number, number],
    endUv: [number, number],
    startPressure: number,
    endPressure: number,
    spacing: number,
    brushSizeUv: number
): Promise<InterpolatedPoint[]> {
    const invoke = await getInvoke();
    if (!invoke) {
        // Fallback: simple JS interpolation
        const dist = Math.hypot(endUv[0] - startUv[0], endUv[1] - startUv[1]);
        const steps = Math.min(Math.floor(dist / (brushSizeUv * spacing)), 20);
        const points: InterpolatedPoint[] = [];
        for (let i = 0; i <= steps; i++) {
            const t = i / Math.max(steps, 1);
            points.push({
                uv: [
                    startUv[0] + (endUv[0] - startUv[0]) * t,
                    startUv[1] + (endUv[1] - startUv[1]) * t
                ],
                pressure: startPressure + (endPressure - startPressure) * t,
                t
            });
        }
        return points;
    }

    try {
        return await invoke('interpolate_brush_stroke', {
            startUv,
            endUv,
            startPressure,
            endPressure,
            spacing,
            brushSizeUv,
        });
    } catch (e) {
        console.error('[brushDynamics] Interpolation failed:', e);
        return [{ uv: endUv, pressure: endPressure, t: 1 }];
    }
}

// ============================================================================
// SYMMETRY - Replaces triple JS loop!
// ============================================================================

/**
 * Calculate all symmetry UVs for a single paint point.
 * Replaces the triple JS mirror/radial loop.
 */
export async function calculateSymmetryUvs(
    uv: [number, number],
    config: SymmetryConfig
): Promise<[number, number][]> {
    const invoke = await getInvoke();
    if (!invoke) {
        // Fallback: simple JS symmetry
        const results: [number, number][] = [uv];
        if (config.mirror_x) results.push([1 - uv[0], uv[1]]);
        if (config.mirror_y) {
            const copy = [...results] as [number, number][];
            copy.forEach(p => results.push([p[0], 1 - p[1]]));
        }
        return results;
    }

    try {
        return await invoke('calculate_symmetry_uvs', { uv, config });
    } catch (e) {
        console.error('[brushDynamics] Symmetry failed:', e);
        return [uv];
    }
}

/**
 * Batch calculate symmetry for multiple points (parallel in Rust).
 */
export async function batchSymmetryUvs(
    uvs: [number, number][],
    config: SymmetryConfig
): Promise<[number, number][][]> {
    const invoke = await getInvoke();
    if (!invoke) {
        // Fallback
        return Promise.all(uvs.map(uv => calculateSymmetryUvs(uv, config)));
    }

    try {
        return await invoke('batch_symmetry_uvs', { uvs, config });
    } catch (e) {
        console.error('[brushDynamics] Batch symmetry failed:', e);
        return uvs.map(uv => [uv]);
    }
}

// ============================================================================
// VELOCITY GRID RGBA - No JS conversion needed!
// ============================================================================

/**
 * Get velocity grid as RGBA Float32Array ready for WebGL.
 * No JS conversion loop needed - Rust returns [R=vx, G=vy, B=0, A=1, ...].
 */
export async function getVelocityGridRgba(
    simId: number,
    resolution: number
): Promise<Float32Array | null> {
    const invoke = await getInvoke();
    if (!invoke) return null;

    try {
        const rgba: number[] = await invoke('get_velocity_grid_rgba', {
            simId,
            resolution,
        });
        return new Float32Array(rgba);
    } catch (e) {
        console.error('[brushDynamics] RGBA velocity failed:', e);
        return null;
    }
}

// ============================================================================
// FULL STROKE PROCESSING - Interpolation + Symmetry in ONE call!
// ============================================================================

/**
 * Process entire brush stroke: interpolate + symmetry in one Rust call.
 * Returns all paint operations ready for GPU batch.
 */
export async function processBrushStroke(
    startUv: [number, number],
    endUv: [number, number],
    startPressure: number,
    endPressure: number,
    spacing: number,
    brushSizeUv: number,
    symmetry?: SymmetryConfig
): Promise<PaintOp[]> {
    const invoke = await getInvoke();
    if (!invoke) {
        // Fallback: chain JS calls
        const points = await interpolateBrushStroke(
            startUv, endUv, startPressure, endPressure, spacing, brushSizeUv
        );
        if (!symmetry) {
            return points.map(p => ({ uv: p.uv, pressure: p.pressure }));
        }
        const allOps: PaintOp[] = [];
        for (const p of points) {
            const symUvs = await calculateSymmetryUvs(p.uv, symmetry);
            for (const uv of symUvs) {
                allOps.push({ uv, pressure: p.pressure });
            }
        }
        return allOps;
    }

    try {
        return await invoke('process_brush_stroke', {
            startUv,
            endUv,
            startPressure,
            endPressure,
            spacing,
            brushSizeUv,
            symmetry,
        });
    } catch (e) {
        console.error('[brushDynamics] Stroke processing failed:', e);
        return [{ uv: endUv, pressure: endPressure }];
    }
}

export default {
    interpolateBrushStroke,
    calculateSymmetryUvs,
    batchSymmetryUvs,
    getVelocityGridRgba,
    processBrushStroke,
};
