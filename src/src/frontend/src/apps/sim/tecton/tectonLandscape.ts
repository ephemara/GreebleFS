import * as THREE from 'three';
import { generateTerrainData } from './KTectonheightmapgen';

export const TECTON_LANDSCAPE_LAYER_ID = 'tecton:landscape';
export const TECTON_LANDSCAPE_LAYER_NAME = 'Landscape';
export const TECTON_LANDSCAPE_BOOTSTRAP_LAYER_NAMES = ['QuadSphere', 'Sphere_Fallback', 'SPHERE'] as const;
export const TECTON_LANDSCAPE_RESOLUTION_OPTIONS = [512, 1024, 2048] as const;
export const TECTON_LANDSCAPE_SEGMENTS_BY_RESOLUTION = {
    512: 128,
    1024: 192,
    2048: 256
} as const;
export const TECTON_LANDSCAPE_METERS_TO_VIEWPORT_UNITS = 1 / 1024;

export type TectonLandscapeResolution = (typeof TECTON_LANDSCAPE_RESOLUTION_OPTIONS)[number];

export interface TectonLandscapeConfig {
    sizeX: number;
    sizeZ: number;
    heightScale: number;
    resolution: TectonLandscapeResolution;
    seed: number;
    revision: number;
}

export const TECTON_LANDSCAPE_DEFAULTS: TectonLandscapeConfig = {
    sizeX: 4096,
    sizeZ: 4096,
    heightScale: 1200,
    resolution: 512,
    seed: 12345,
    revision: 1
};

const clamp = (value: number, min: number, max: number): number =>
    Math.min(max, Math.max(min, value));

const toFiniteNumber = (value: unknown, fallback: number): number => {
    const nextValue = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(nextValue) ? nextValue : fallback;
};

export const coerceTectonLandscapeConfig = (
    moduleState?: Record<string, unknown>
): TectonLandscapeConfig => {
    const requestedResolution = toFiniteNumber(moduleState?.resolution, TECTON_LANDSCAPE_DEFAULTS.resolution);
    const resolution = TECTON_LANDSCAPE_RESOLUTION_OPTIONS.includes(
        requestedResolution as TectonLandscapeResolution
    )
        ? requestedResolution as TectonLandscapeResolution
        : TECTON_LANDSCAPE_DEFAULTS.resolution;

    return {
        sizeX: clamp(Math.round(toFiniteNumber(moduleState?.sizeX, TECTON_LANDSCAPE_DEFAULTS.sizeX) / 1024) * 1024, 1024, 16384),
        sizeZ: clamp(Math.round(toFiniteNumber(moduleState?.sizeZ, TECTON_LANDSCAPE_DEFAULTS.sizeZ) / 1024) * 1024, 1024, 16384),
        heightScale: clamp(toFiniteNumber(moduleState?.heightScale, TECTON_LANDSCAPE_DEFAULTS.heightScale), 100, 25000),
        resolution,
        seed: Math.round(toFiniteNumber(moduleState?.seed, TECTON_LANDSCAPE_DEFAULTS.seed)),
        revision: Math.max(1, Math.round(toFiniteNumber(moduleState?.revision, TECTON_LANDSCAPE_DEFAULTS.revision)))
    };
};

export const createTectonLandscapeGeometry = (
    config: TectonLandscapeConfig
): THREE.BufferGeometry => {
    const segments = TECTON_LANDSCAPE_SEGMENTS_BY_RESOLUTION[config.resolution];
    const sampleResolution = segments + 1;
    const heightData = generateTerrainData(sampleResolution, sampleResolution, config.seed);
    const geometry = new THREE.PlaneGeometry(
        config.sizeX * TECTON_LANDSCAPE_METERS_TO_VIEWPORT_UNITS,
        config.sizeZ * TECTON_LANDSCAPE_METERS_TO_VIEWPORT_UNITS,
        segments,
        segments
    );
    const normalizedHeightScale = config.heightScale * TECTON_LANDSCAPE_METERS_TO_VIEWPORT_UNITS;
    const positions = geometry.attributes.position as THREE.BufferAttribute;

    geometry.rotateX(-Math.PI / 2);

    for (let index = 0; index < positions.count; index += 1) {
        const heightSample = heightData[index * 4] ?? 0;
        positions.setY(index, heightSample * normalizedHeightScale);
    }

    positions.needsUpdate = true;
    geometry.computeVertexNormals();

    return geometry;
};
