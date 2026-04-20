/**
 * KAtlasLSCM.ts
 * REFACTORED: Now uses the robust "XAtlas" (Adobe/Industry Standard) solver via Rust Backend.
 * The heavy lifting (Segmentation, Parameterization, Packing) is done in native code.
 */

import * as THREE from 'three';
import { invoke } from '@tauri-apps/api/core';

// --- CONFIG ---
// Kept for interface compatibility, though XAtlas handles most internally.
interface LSCMResult {
    vertCount: number;
    time: number;
}

interface LSCMConfig {
    maxIterations?: number; // Not currently used by XAtlas wrapper, but kept for API
}

interface AtlasResult {
    positions: number[];
    indices: number[];
    uvs: number[];
}

export const applyKAtlasLSCM = async (mesh: THREE.Mesh, config?: LSCMConfig): Promise<LSCMResult> => {
    const startTime = performance.now();

    console.log("KAtlas: Sending mesh to Rust XAtlas backend...");

    // 1. Extract Data
    const geo = mesh.geometry;
    let positions: Float32Array;
    let indices: ArrayLike<number>;

    if (!geo.index) {
        // Retrieve non-indexed positions
        positions = geo.attributes.position.array as Float32Array;
        // Generate indices [0, 1, 2, ...]
        const idx = new Uint32Array(positions.length / 3);
        for (let i = 0; i < idx.length; i++) idx[i] = i;
        indices = idx;
    } else {
        positions = geo.attributes.position.array as Float32Array;
        indices = geo.index.array;
    }

    // Ensure we send plain arrays/Vectors (Tauri converts them)
    // For large meshes, we might want to use Uint8Array/Bytes later, but basic Invoke is fine for now.

    try {
        const result = await invoke<AtlasResult>('unwrap_mesh_xatlas', {
            positions: Array.from(positions), // TODO: optimize with specific typed array passing if supported/needed
            indices: Array.from(indices)
        });

        console.log(`KAtlas: Rust returned ${result.positions.length / 3} verts.`);

        // 2. Reconstruct Geometry
        // XAtlas may split vertices for seams, so we get a completely new topology.
        const newGeo = new THREE.BufferGeometry();

        const newPos = new Float32Array(result.positions);
        const newUVs = new Float32Array(result.uvs);
        const newIdx = new Uint32Array(result.indices);

        newGeo.setAttribute('position', new THREE.BufferAttribute(newPos, 3));
        newGeo.setAttribute('uv', new THREE.BufferAttribute(newUVs, 2));
        newGeo.setIndex(new THREE.BufferAttribute(newIdx, 1));
        newGeo.computeVertexNormals();
        // newGeo.computeBoundingSphere();

        // 3. Apply to Mesh
        mesh.geometry.dispose();
        mesh.geometry = newGeo;

        return {
            vertCount: newPos.length / 3,
            time: performance.now() - startTime
        };

    } catch (e) {
        console.error("KAtlas: XAtlas Failed!", e);
        throw e;
    }
};
