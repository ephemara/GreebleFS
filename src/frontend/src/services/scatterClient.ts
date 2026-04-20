/**
 * K_OS Scatter Client
 * 
 * TypeScript service layer for invoking Rust scatter commands.
 * Provides type-safe access to high-performance procedural distribution algorithms.
 */

import { invoke } from '@tauri-apps/api/core';

// ============================================================================
// TYPES
// ============================================================================

export interface ScatterTransform {
    position: [number, number, number];
    rotation: [number, number, number, number]; // Quaternion (x, y, z, w)
    scale: [number, number, number];
}

// ============================================================================
// ALGORITHMIC SCATTER (KD-Tree / Math)
// ============================================================================

/**
 * Poisson disk sampling - evenly spaced points with guaranteed minimum distance.
 * Uses KD-tree for O(n log n) performance.
 */
export async function poissonDiskScatter(
    count: number,
    radius: number,
    minDistance: number,
    seed: number = Date.now()
): Promise<[number, number, number][]> {
    return invoke('poisson_disk_scatter', {
        count,
        radius,
        minDistance,
        seed: BigInt(seed),
    });
}

/**
 * Surface-constrained Poisson disk - places points on mesh surface with minimum spacing.
 */
export async function poissonDiskSurface(
    surfacePoints: [number, number, number][],
    surfaceNormals: [number, number, number][],
    count: number,
    minDistance: number,
    seed: number = Date.now()
): Promise<ScatterTransform[]> {
    return invoke('poisson_disk_surface', {
        surfacePoints,
        surfaceNormals,
        count,
        minDistance,
        seed: BigInt(seed),
    });
}

/**
 * Voronoi cell-based scatter - places points at Lloyd-relaxed cell centroids.
 */
export async function voronoiCellScatter(
    count: number,
    radius: number,
    seed: number = Date.now()
): Promise<[number, number, number][]> {
    return invoke('voronoi_cell_scatter', {
        count,
        radius,
        seed: BigInt(seed),
    });
}

/**
 * Fibonacci spiral (3D phyllotaxis) - golden angle distribution.
 */
export async function fibonacciSpiralScatter(
    count: number,
    radius: number,
    height: number
): Promise<[number, number, number][]> {
    return invoke('fibonacci_spiral_scatter', { count, radius, height });
}

/**
 * Sunflower disk pattern - 2D Fibonacci on a plane.
 */
export async function sunflowerDiskScatter(
    count: number,
    radius: number
): Promise<[number, number, number][]> {
    return invoke('sunflower_disk_scatter', { count, radius });
}

/**
 * Halton sequence - low-discrepancy quasi-random distribution.
 */
export async function haltonScatter(
    count: number,
    radius: number
): Promise<[number, number, number][]> {
    return invoke('halton_scatter', { count, radius });
}

// ============================================================================
// NATURE-INSPIRED SCATTER
// ============================================================================

/**
 * Clustered distribution with organic feel.
 */
export async function clusterScatter(
    count: number,
    radius: number,
    clusterCount: number,
    clusterTightness: number,
    seed: number = Date.now()
): Promise<[number, number, number][]> {
    return invoke('cluster_scatter', {
        count,
        radius,
        clusterCount,
        clusterTightness,
        seed: BigInt(seed),
    });
}

/**
 * Organic noise-based distribution.
 */
export async function organicScatter(
    count: number,
    radius: number,
    noiseScale: number,
    densityThreshold: number,
    seed: number = Date.now()
): Promise<[number, number, number][]> {
    return invoke('organic_scatter', {
        count,
        radius,
        noiseScale,
        densityThreshold,
        seed: BigInt(seed),
    });
}

// ============================================================================
// PHYSICS SIMULATION
// ============================================================================

/**
 * Physics drop simulation - spawn objects, let them fall and settle.
 * Uses Rapier3D for realistic stacking and collision.
 */
export async function physicsDropScatter(
    count: number,
    spawnHeight: number,
    spawnRadius: number,
    objectRadius: number,
    gravity: number = -9.81,
    iterations: number = 300,
    seed: number = Date.now()
): Promise<ScatterTransform[]> {
    return invoke('physics_drop_scatter', {
        count,
        spawnHeight,
        spawnRadius,
        objectRadius,
        gravity,
        iterations,
        seed: BigInt(seed),
    });
}
