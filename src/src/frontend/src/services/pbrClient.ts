/**
 * PBR Texture Generator Client
 * TypeScript bindings for Rust-accelerated PBR map generation
 */

import { invoke } from '@tauri-apps/api/core';

// ============================================================================
// TYPES
// ============================================================================

export interface PbrParams {
    // Normal map
    normal_strength: number;

    // Roughness
    roughness_brightness: number;
    roughness_contrast: number;
    roughness_invert: boolean;

    // Metallic
    metal_bias: number;
    metal_contrast: number;

    // Effects
    dust: number;
    grunge: number;
    scratches: number;
    noise: number;
    edge_wear: number;
    cavity_dirt: number;

    // Post-processing
    brightness: number;
    contrast: number;
    gamma: number;
    chromatic: number;
    make_seamless: boolean;
}

export interface PbrMapSet {
    base: string | null;
    normal: string | null;
    roughness: string | null;
    metallic: string | null;
    ao: string | null;
    height: string | null;
    emissive: string | null;
    time_ms: number;
}

// ============================================================================
// DEFAULT PARAMS
// ============================================================================

export const DEFAULT_PBR_PARAMS: PbrParams = {
    normal_strength: 1.0,
    roughness_brightness: 0.0,
    roughness_contrast: 1.0,
    roughness_invert: false,
    metal_bias: 0.0,
    metal_contrast: 1.0,
    dust: 0.0,
    grunge: 0.0,
    scratches: 0.0,
    noise: 0.0,
    edge_wear: 0.0,
    cavity_dirt: 0.0,
    brightness: 1.0,
    contrast: 1.0,
    gamma: 1.0,
    chromatic: 0.0,
    make_seamless: false,
};

// ============================================================================
// API
// ============================================================================

/**
 * Check if Rust PBR backend is available
 */
export async function isAvailable(): Promise<boolean> {
    try {
        await invoke('generate_normal_map', {
            imageBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            strength: 1.0
        });
        return true;
    } catch {
        return false;
    }
}

/**
 * Generate all PBR maps from a base image
 * @param imageBase64 Base64-encoded source image (PNG or JPEG)
 * @param params PBR generation parameters
 * @returns PbrMapSet with all generated maps as base64 data URLs
 */
export async function generatePbrMaps(
    imageBase64: string,
    params: Partial<PbrParams> = {}
): Promise<PbrMapSet> {
    const fullParams: PbrParams = { ...DEFAULT_PBR_PARAMS, ...params };

    return await invoke<PbrMapSet>('generate_pbr_maps', {
        imageBase64,
        params: fullParams,
    });
}

/**
 * Generate just a normal map (faster for preview)
 * @param imageBase64 Base64-encoded source image
 * @param strength Normal map intensity
 * @returns Base64 data URL of the normal map
 */
export async function generateNormalMap(
    imageBase64: string,
    strength: number = 1.0
): Promise<string> {
    return await invoke<string>('generate_normal_map', {
        imageBase64,
        strength,
    });
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

export const rustPbr = {
    isAvailable,
    generatePbrMaps,
    generateNormalMap,
    DEFAULT_PARAMS: DEFAULT_PBR_PARAMS,
};

export default rustPbr;
