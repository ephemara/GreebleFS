/**
 * KAtlasHybrid.ts
 * Rizom UV-style intelligent unwrapping system.
 * Auto-classifies meshes and routes to the best solver (LSCM vs Box).
 * 
 * NOW USING RUST BACKEND for classification (10x+ faster)
 */

import * as THREE from 'three';
import { invoke } from '@tauri-apps/api/core';
import { applyKAtlasLSCM } from './KAtlasLSCM';
import { applyBoxProjection } from './KAtlasBox';

// --- TYPES ---
export type MeshClassification = 'ORGANIC' | 'HARD_SURFACE' | 'MIXED';

export interface HybridConfig {
    lscmIterations: number;
    boxPadding: number;
    boxWorldAlign: boolean;
    boxCameraCount?: number;
    autoClassify: boolean;
    forceMode?: 'LSCM' | 'BOX'; // Override automatic classification
}

export interface HybridResult {
    vertCount: number;
    time: number;
    classification: MeshClassification;
    solver: 'LSCM' | 'BOX' | 'HYBRID';
}

// Rust classification result
interface ClassificationResult {
    classification: string;
    sharp_edge_percent: number;
    avg_curvature: number;
    planarity_score: number;
    time_ms: number;
}

// --- MESH CLASSIFICATION (NOW RUST-POWERED) ---
/**
 * Analyzes mesh geometry using Rust backend for fast classification.
 * Returns ORGANIC, HARD_SURFACE, or MIXED based on edge sharpness, curvature, and planarity.
 */
const classifyMeshType = async (mesh: THREE.Mesh): Promise<MeshClassification> => {
    const geo = mesh.geometry;

    if (!geo.index) {
        console.warn('KAtlas Hybrid: No index, defaulting to ORGANIC');
        return 'ORGANIC';
    }

    // Extract data for Rust
    const positions = Array.from(geo.attributes.position.array as Float32Array);
    const indices = Array.from(geo.index.array);

    try {
        const result = await invoke<ClassificationResult>('classify_mesh', {
            positions,
            indices
        });

        console.log(`KAtlas Hybrid (Rust): ${result.classification}`);
        console.log(`  Sharp Edges: ${(result.sharp_edge_percent * 100).toFixed(1)}%`);
        console.log(`  Avg Curvature: ${result.avg_curvature.toFixed(3)}`);
        console.log(`  Planarity: ${result.planarity_score.toFixed(3)}`);
        console.log(`  Time: ${result.time_ms.toFixed(2)}ms`);

        return result.classification as MeshClassification;
    } catch (e) {
        console.error('KAtlas: Rust classification failed, falling back to ORGANIC', e);
        return 'ORGANIC';
    }
};

// --- MAIN HYBRID UNWRAP FUNCTION ---
export const applyHybridAutoUnwrap = async (
    mesh: THREE.Mesh,
    config: HybridConfig
): Promise<HybridResult> => {
    const startTime = performance.now();

    // Helper: Fallback to Box projection when LSCM fails
    const fallbackToBox = (reason: string): HybridResult => {
        console.warn(`KAtlas Hybrid: LSCM failed (${reason}), falling back to Box projection`);
        applyBoxProjection(mesh, {
            padding: config.boxPadding,
            worldAlign: config.boxWorldAlign,
            cameraCount: config.boxCameraCount
        });
        return {
            vertCount: mesh.geometry.attributes.position.count,
            time: performance.now() - startTime,
            classification: 'MIXED',
            solver: 'BOX'
        };
    };

    // Force mode override
    if (config.forceMode) {
        console.log(`KAtlas Hybrid: Force mode ${config.forceMode}, skipping classification`);

        if (config.forceMode === 'LSCM') {
            try {
                const result = await applyKAtlasLSCM(mesh, { maxIterations: config.lscmIterations });
                return {
                    vertCount: result.vertCount,
                    time: performance.now() - startTime,
                    classification: 'ORGANIC',
                    solver: 'LSCM'
                };
            } catch (e) {
                return fallbackToBox(`LSCM exception: ${e}`);
            }
        } else {
            applyBoxProjection(mesh, {
                padding: config.boxPadding,
                worldAlign: config.boxWorldAlign,
                cameraCount: config.boxCameraCount
            });
            return {
                vertCount: mesh.geometry.attributes.position.count,
                time: performance.now() - startTime,
                classification: 'HARD_SURFACE',
                solver: 'BOX'
            };
        }
    }

    // Auto classification (NOW RUST-POWERED!)
    const classification = config.autoClassify ? await classifyMeshType(mesh) : 'MIXED';

    if (classification === 'ORGANIC') {
        // Pure organic → Try LSCM (Rust XAtlas), fallback to Box if it crashes
        console.log('KAtlas Hybrid: Routing to LSCM solver (Rust XAtlas) for organic mesh');
        try {
            const result = await applyKAtlasLSCM(mesh, { maxIterations: config.lscmIterations });
            return {
                vertCount: result.vertCount,
                time: performance.now() - startTime,
                classification,
                solver: 'LSCM'
            };
        } catch (e) {
            return fallbackToBox(`non-manifold or complex geometry`);
        }

    } else if (classification === 'HARD_SURFACE') {
        // Pure hard surface → Use Box (no xatlas needed!)
        console.log('KAtlas Hybrid: Routing to Box projection for hard-surface mesh');
        applyBoxProjection(mesh, {
            padding: config.boxPadding,
            worldAlign: config.boxWorldAlign,
            cameraCount: config.boxCameraCount
        });
        return {
            vertCount: mesh.geometry.attributes.position.count,
            time: performance.now() - startTime,
            classification,
            solver: 'BOX'
        };

    } else {
        // MIXED → Try LSCM with enhanced segmentation, fallback to Box if needed
        console.log('KAtlas Hybrid: Mixed geometry detected, trying LSCM (XAtlas handles segmentation)');
        try {
            const result = await applyKAtlasLSCM(mesh, { maxIterations: config.lscmIterations });
            return {
                vertCount: result.vertCount,
                time: performance.now() - startTime,
                classification,
                solver: 'HYBRID'
            };
        } catch (e) {
            return fallbackToBox(`xatlas can't handle this geometry`);
        }
    }
};
