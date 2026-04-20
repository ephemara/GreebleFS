/**
 * Procedural Texture Generator Client
 * TypeScript bindings for Rust noise and pattern generation
 */

import { invoke } from '@tauri-apps/api/core';

// ============================================================================
// TYPES
// ============================================================================

export type NoiseType = 'perlin' | 'simplex' | 'worley' | 'fbm' | 'ridged' | 'billowy';

export interface ProceduralParams {
    noise_type: NoiseType;
    width: number;
    height: number;
    scale: number;
    octaves: number;
    persistence: number;
    lacunarity: number;
    seed: number;
    invert: boolean;
    contrast: number;
    brightness: number;
    seamless: boolean;
}

export interface VoronoiParams {
    width: number;
    height: number;
    cell_count: number;
    seed: number;
    distance_type: 'euclidean' | 'manhattan' | 'chebyshev';
    output_type: 'distance' | 'cell_value' | 'edges';
    edge_thickness: number;
    jitter: number;
    invert: boolean;
}

export interface ProceduralResult {
    image: string;
    time_ms: number;
}

// ============================================================================
// DEFAULTS
// ============================================================================

export const DEFAULT_PROCEDURAL_PARAMS: ProceduralParams = {
    noise_type: 'perlin',
    width: 1024,
    height: 1024,
    scale: 4.0,
    octaves: 6,
    persistence: 0.5,
    lacunarity: 2.0,
    seed: 42,
    invert: false,
    contrast: 1.0,
    brightness: 0.0,
    seamless: false,
};

export const DEFAULT_VORONOI_PARAMS: VoronoiParams = {
    width: 1024,
    height: 1024,
    cell_count: 50,
    seed: 42,
    distance_type: 'euclidean',
    output_type: 'distance',
    edge_thickness: 0.02,
    jitter: 1.0,
    invert: false,
};

// ============================================================================
// API
// ============================================================================

/**
 * Generate procedural noise texture
 */
export async function generateProceduralTexture(
    params: Partial<ProceduralParams> = {}
): Promise<ProceduralResult> {
    const fullParams = { ...DEFAULT_PROCEDURAL_PARAMS, ...params };
    return await invoke<ProceduralResult>('generate_procedural_texture', { params: fullParams });
}

/**
 * Generate Voronoi pattern texture
 */
export async function generateVoronoiTexture(
    params: Partial<VoronoiParams> = {}
): Promise<ProceduralResult> {
    const fullParams = { ...DEFAULT_VORONOI_PARAMS, ...params };
    return await invoke<ProceduralResult>('generate_voronoi_texture', { params: fullParams });
}

/**
 * Blend two textures together
 */
export async function blendTextures(
    baseImage: string,
    overlayImage: string,
    blendMode: 'multiply' | 'screen' | 'overlay' | 'add' | 'subtract' = 'multiply',
    opacity: number = 1.0
): Promise<string> {
    return await invoke<string>('blend_textures', {
        baseImage,
        overlayImage,
        blendMode,
        opacity,
    });
}

// ============================================================================
// CONVENIENCE PRESETS
// ============================================================================

/** Generate checker pattern using high-contrast Worley */
export async function generateChecker(size: number = 1024): Promise<string> {
    const result = await generateProceduralTexture({
        noise_type: 'worley',
        width: size,
        height: size,
        scale: 8,
        contrast: 5.0,
        brightness: -0.3,
    });
    return result.image;
}

/** Generate noise pattern */
export async function generateNoise(size: number = 1024, type: NoiseType = 'fbm'): Promise<string> {
    const result = await generateProceduralTexture({
        noise_type: type,
        width: size,
        height: size,
        scale: 4,
        octaves: 6,
    });
    return result.image;
}

/** Generate brick-like pattern using Voronoi edges */
export async function generateBricks(size: number = 1024): Promise<string> {
    const result = await generateVoronoiTexture({
        width: size,
        height: size,
        cell_count: 30,
        output_type: 'edges',
        edge_thickness: 0.015,
        jitter: 0.3,
    });
    return result.image;
}

// ============================================================================
// EXPORTS
// ============================================================================

export const rustProcedural = {
    generateProceduralTexture,
    generateVoronoiTexture,
    blendTextures,
    generateChecker,
    generateNoise,
    generateBricks,
    DEFAULT_PROCEDURAL_PARAMS,
    DEFAULT_VORONOI_PARAMS,
};

export default rustProcedural;
