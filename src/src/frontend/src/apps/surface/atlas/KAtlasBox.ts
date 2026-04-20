import * as THREE from 'three';
import { KBinPacker } from './KBinPacker';

export interface BoxProjectionConfig {
    padding: number;
    worldAlign: boolean;
    cameraCount?: number; // NEW: Number of projection cameras (6, 14, 26, 50, 98)
}

/**
 * Generate camera directions using Fibonacci sphere distribution.
 * More cameras = better coverage = less stretching on angled faces.
 */
function generateCameraDirections(count: number): THREE.Vector3[] {
    const directions: THREE.Vector3[] = [];

    if (count <= 6) {
        // Standard 6-axis box projection (cardinal directions)
        directions.push(
            new THREE.Vector3(1, 0, 0),   // +X
            new THREE.Vector3(-1, 0, 0),  // -X
            new THREE.Vector3(0, 1, 0),   // +Y
            new THREE.Vector3(0, -1, 0),  // -Y
            new THREE.Vector3(0, 0, 1),   // +Z
            new THREE.Vector3(0, 0, -1)   // -Z
        );
        return directions;
    }

    // Fibonacci sphere for even distribution
    const goldenRatio = (1 + Math.sqrt(5)) / 2;

    for (let i = 0; i < count; i++) {
        const theta = 2 * Math.PI * i / goldenRatio;
        const phi = Math.acos(1 - 2 * (i + 0.5) / count);

        directions.push(new THREE.Vector3(
            Math.sin(phi) * Math.cos(theta),
            Math.sin(phi) * Math.sin(theta),
            Math.cos(phi)
        ).normalize());
    }

    return directions;
}

/**
 * Get projection axes (U, V plane) for a given camera direction
 */
function getProjectionPlane(direction: THREE.Vector3): { u: THREE.Vector3; v: THREE.Vector3 } {
    // Use world up unless direction is parallel to Y
    let worldUp = new THREE.Vector3(0, 1, 0);
    if (Math.abs(direction.dot(worldUp)) > 0.99) {
        worldUp = new THREE.Vector3(0, 0, 1);
    }

    const u = new THREE.Vector3().crossVectors(worldUp, direction).normalize();
    const v = new THREE.Vector3().crossVectors(direction, u).normalize();

    return { u, v };
}

export const applyBoxProjection = (mesh: THREE.Mesh, config: BoxProjectionConfig) => {
    const geo = mesh.geometry;
    geo.computeBoundingBox();
    const bbox = geo.boundingBox!;
    const center = new THREE.Vector3();
    bbox.getCenter(center);
    const size = new THREE.Vector3();
    bbox.getSize(size);

    // Prevent divide by zero
    size.x = Math.max(size.x, 0.001);
    size.y = Math.max(size.y, 0.001);
    size.z = Math.max(size.z, 0.001);

    const maxDim = Math.max(size.x, size.y, size.z);

    // Convert to non-indexed for sharp seams
    const nonIndexed = geo.toNonIndexed();
    const pos = nonIndexed.attributes.position;
    const count = pos.count;

    // Generate camera directions based on config
    const cameraCount = config.cameraCount || 6;
    const cameraDirections = generateCameraDirections(cameraCount);
    console.log(`KAtlas Box: Using ${cameraDirections.length} projection cameras`);

    // Compute face normals and assign to best camera
    const pA = new THREE.Vector3(), pB = new THREE.Vector3(), pC = new THREE.Vector3();
    const cb = new THREE.Vector3(), ab = new THREE.Vector3();
    const normal = new THREE.Vector3();

    const uvs = new Float32Array(count * 2);

    // Matrix for World Align
    const worldMatrix = mesh.matrixWorld;
    const worldNormalMatrix = new THREE.Matrix3().getNormalMatrix(worldMatrix);

    // Group triangles by best matching camera
    const islands: Map<number, number[]> = new Map();
    for (let i = 0; i < cameraDirections.length; i++) {
        islands.set(i, []);
    }

    for (let i = 0; i < count; i += 3) {
        pA.fromBufferAttribute(pos, i);
        pB.fromBufferAttribute(pos, i + 1);
        pC.fromBufferAttribute(pos, i + 2);

        // Calculate face normal
        ab.subVectors(pB, pA);
        cb.subVectors(pC, pA);
        normal.crossVectors(ab, cb).normalize();

        // Transform to world space if needed
        if (config.worldAlign) {
            normal.applyMatrix3(worldNormalMatrix).normalize();
        }

        // Find best matching camera (highest dot product)
        let bestCamera = 0;
        let bestDot = -Infinity;
        for (let c = 0; c < cameraDirections.length; c++) {
            const dot = normal.dot(cameraDirections[c]);
            if (dot > bestDot) {
                bestDot = dot;
                bestCamera = c;
            }
        }

        islands.get(bestCamera)!.push(i);
    }

    // Now project and pack each camera's island
    const charts: {
        cameraIdx: number;
        width: number;
        height: number;
        minU: number;
        minV: number;
        uvs: { idx: number; u: number; v: number }[];
    }[] = [];

    for (let [cameraIdx, triangles] of islands) {
        if (triangles.length === 0) continue;

        const direction = cameraDirections[cameraIdx];
        const { u: uAxis, v: vAxis } = getProjectionPlane(direction);

        // Calculate bounds and project
        let minU = Infinity, maxU = -Infinity;
        let minV = Infinity, maxV = -Infinity;
        const islandUVs: { idx: number; u: number; v: number }[] = [];

        for (const tIdx of triangles) {
            for (let k = 0; k < 3; k++) {
                const idx = tIdx + k;
                pA.fromBufferAttribute(pos, idx);

                // Transform to world if needed
                let projPoint = pA.clone();
                if (config.worldAlign) {
                    projPoint.applyMatrix4(worldMatrix);
                }

                // Project onto UV plane
                // Normalize to object size for consistent texel density
                const u = projPoint.dot(uAxis) / maxDim;
                const v = projPoint.dot(vAxis) / maxDim;

                islandUVs.push({ idx, u, v });

                if (u < minU) minU = u;
                if (u > maxU) maxU = u;
                if (v < minV) minV = v;
                if (v > maxV) maxV = v;
            }
        }

        const width = maxU - minU;
        const height = maxV - minV;

        if (width > 0.0001 && height > 0.0001) {
            charts.push({
                cameraIdx,
                width,
                height,
                minU,
                minV,
                uvs: islandUVs
            });
        }
    }

    console.log(`KAtlas Box: Created ${charts.length} UV islands from ${cameraDirections.length} cameras`);

    // Pack islands
    const packerInput = charts.map((c, i) => ({
        id: i, w: c.width, h: c.height, x: 0, y: 0
    }));

    const packer = new KBinPacker(1, 1);
    packer.fit(packerInput, config.padding);

    // Apply to geometry
    for (let i = 0; i < charts.length; i++) {
        const chart = charts[i];
        const rect = packerInput[i];

        for (const vert of chart.uvs) {
            // Normalize to 0-1 within chart
            const localU = chart.width > 0 ? (vert.u - chart.minU) / chart.width : 0;
            const localV = chart.height > 0 ? (vert.v - chart.minV) / chart.height : 0;

            // Map to packed position
            const finalU = rect.x + (localU * rect.w);
            const finalV = rect.y + (localV * rect.h);

            uvs[vert.idx * 2] = finalU;
            uvs[vert.idx * 2 + 1] = finalV;
        }
    }

    nonIndexed.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    nonIndexed.computeVertexNormals();

    mesh.geometry.dispose();
    mesh.geometry = nonIndexed;
};
