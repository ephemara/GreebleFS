import * as THREE from 'three';
import { rustSculpt, applyBrushResultToGeometry, type SculptMeshHandle, type BrushResult } from '../../../services/sculptClient';

// ============================================================================
// MESH TOPOLOGY - Used for Dynamic Topology (Dyntopo) JS-side edge splitting
// ============================================================================

export class MeshTopology {
    // Map vertex index -> list of face indices
    vertexFaces: number[][] = [];
    // Edges: key "min_max" -> { a, b, faces: [] }
    edges: Map<string, { a: number, b: number, faces: number[], midpoint?: number }> = new Map();

    build(geometry: THREE.BufferGeometry) {
        const posCount = geometry.attributes.position.count;
        this.vertexFaces = new Array(posCount).fill(0).map(() => []);
        this.edges.clear();

        const index = geometry.index;
        if (index) {
            const count = index.count / 3;
            for (let i = 0; i < count; i++) {
                const a = index.getX(i * 3);
                const b = index.getX(i * 3 + 1);
                const c = index.getX(i * 3 + 2);
                this.vertexFaces[a].push(i);
                this.vertexFaces[b].push(i);
                this.vertexFaces[c].push(i);

                this.addEdge(a, b, i);
                this.addEdge(b, c, i);
                this.addEdge(c, a, i);
            }
        }
    }

    addEdge(a: number, b: number, faceIdx: number) {
        const key = a < b ? `${a}_${b}` : `${b}_${a}`;
        if (!this.edges.has(key)) {
            this.edges.set(key, { a: Math.min(a, b), b: Math.max(a, b), faces: [] });
        }
        this.edges.get(key)!.faces.push(faceIdx);
    }

    /**
     * Dynamic Topology: Naive Edge Split Logic
     * Returns TRUE if topology changed (new geometry created)
     * 
     * NOTE: This remains in JS because it mutates Three.js geometry directly.
     * Eventually should be ported to Rust for performance.
     */
    refineTopology(
        mesh: THREE.Mesh,
        localPoint: THREE.Vector3,
        radius: number,
        detailSize: number
    ): boolean {
        const posAttr = mesh.geometry.attributes.position;
        const indexAttr = mesh.geometry.index;
        const colorAttr = mesh.geometry.attributes.color;
        const uvAttr = mesh.geometry.attributes.uv;
        const maskAttr = mesh.geometry.attributes.mask;

        if (!indexAttr) return false;

        const toSplit: string[] = [];
        const rSq = radius * radius;
        const dSq = detailSize * detailSize;

        // Collect candidates - edges in brush radius that are too long
        for (const [key, edge] of this.edges) {
            const ax = posAttr.getX(edge.a); const ay = posAttr.getY(edge.a); const az = posAttr.getZ(edge.a);
            const bx = posAttr.getX(edge.b); const by = posAttr.getY(edge.b); const bz = posAttr.getZ(edge.b);

            const mx = (ax + bx) / 2;
            const my = (ay + by) / 2;
            const mz = (az + bz) / 2;

            const dx = mx - localPoint.x;
            const dy = my - localPoint.y;
            const dz = mz - localPoint.z;

            if (dx * dx + dy * dy + dz * dz < rSq) {
                const lenSq = (ax - bx) ** 2 + (ay - by) ** 2 + (az - bz) ** 2;
                if (lenSq > dSq) {
                    toSplit.push(key);
                }
            }
        }

        if (toSplit.length === 0) return false;

        // --- PERFORM SPLITS ---
        const positions = Array.from(posAttr.array);
        const indices = Array.from(indexAttr.array);
        const colors = colorAttr ? Array.from(colorAttr.array) : [];
        const uvs = uvAttr ? Array.from(uvAttr.array) : [];
        const masks = maskAttr ? Array.from(maskAttr.array) : [];

        const facesToRemove = new Set<number>();
        const newFaces: number[] = [];
        let newVertIdx = positions.length / 3;

        for (const key of toSplit) {
            const edge = this.edges.get(key)!;

            // Calculate midpoint
            const ax = posAttr.getX(edge.a); const ay = posAttr.getY(edge.a); const az = posAttr.getZ(edge.a);
            const bx = posAttr.getX(edge.b); const by = posAttr.getY(edge.b); const bz = posAttr.getZ(edge.b);
            const mx = (ax + bx) / 2; const my = (ay + by) / 2; const mz = (az + bz) / 2;

            positions.push(mx, my, mz);

            // Interpolate attributes
            if (colorAttr) {
                const cax = colorAttr.getX(edge.a); const cay = colorAttr.getY(edge.a); const caz = colorAttr.getZ(edge.a);
                const cbx = colorAttr.getX(edge.b); const cby = colorAttr.getY(edge.b); const cbz = colorAttr.getZ(edge.b);
                colors.push((cax + cbx) / 2, (cay + cby) / 2, (caz + cbz) / 2);
            }
            if (uvAttr) {
                const uax = uvAttr.getX(edge.a); const uay = uvAttr.getY(edge.a);
                const ubx = uvAttr.getX(edge.b); const uby = uvAttr.getY(edge.b);
                uvs.push((uax + ubx) / 2, (uay + uby) / 2);
            }
            if (maskAttr) {
                const ma = maskAttr.getX(edge.a);
                const mb = maskAttr.getX(edge.b);
                masks.push((ma + mb) / 2);
            }

            const midIdx = newVertIdx++;

            // Split faces containing this edge
            for (const fIdx of edge.faces) {
                if (facesToRemove.has(fIdx)) continue;

                const i1 = indexAttr.getX(fIdx * 3);
                const i2 = indexAttr.getX(fIdx * 3 + 1);
                const i3 = indexAttr.getX(fIdx * 3 + 2);
                const vArr = [i1, i2, i3];

                const idxA = vArr.indexOf(edge.a);
                const idxB = vArr.indexOf(edge.b);

                // Create two new triangles
                const t1 = [...vArr]; t1[idxB] = midIdx;
                const t2 = [...vArr]; t2[idxA] = midIdx;

                newFaces.push(...t1, ...t2);
                facesToRemove.add(fIdx);
            }
        }

        // Rebuild index buffer
        const finalIndices: number[] = [];
        const originalFaceCount = indexAttr.count / 3;
        for (let i = 0; i < originalFaceCount; i++) {
            if (!facesToRemove.has(i)) {
                finalIndices.push(indexAttr.getX(i * 3), indexAttr.getX(i * 3 + 1), indexAttr.getX(i * 3 + 2));
            }
        }
        finalIndices.push(...newFaces);

        // Update geometry
        mesh.geometry.dispose();
        mesh.geometry = new THREE.BufferGeometry();
        mesh.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        if (colors.length > 0) mesh.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        if (uvs.length > 0) mesh.geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        if (masks.length > 0) mesh.geometry.setAttribute('mask', new THREE.Float32BufferAttribute(masks, 1));

        mesh.geometry.setIndex(finalIndices);
        mesh.geometry.computeVertexNormals();

        // Rebuild BVH immediately
        // @ts-ignore
        if (mesh.geometry.computeBoundsTree) mesh.geometry.computeBoundsTree();

        // Rebuild topology
        this.build(mesh.geometry);
        return true;
    }

    updateNormals(geometry: THREE.BufferGeometry, _affectedVertices: number[]) {
        // Rust handles incremental normals now, but keep this for dyntopo fallback
        geometry.computeVertexNormals();
    }
}

// ============================================================================
// RUST BACKEND INTEGRATION
// ============================================================================

/**
 * State manager for Rust sculpt meshes
 * Maps Three.js mesh UUID to Rust handle
 */
class RustSculptManager {
    private handles: Map<string, SculptMeshHandle> = new Map();
    private initialized: boolean = false;
    private available: boolean = false;

    async init() {
        if (this.initialized) return;
        this.available = await rustSculpt.isAvailable();
        this.initialized = true;
        console.log(`[RustSculptManager] Backend available: ${this.available}`);
    }

    isAvailable(): boolean {
        return this.available;
    }

    async registerMesh(mesh: THREE.Mesh): Promise<SculptMeshHandle | null> {
        await this.init();

        if (!this.available) {
            console.warn('[RustSculptManager] Rust backend not available - sculpting will be disabled');
            return null;
        }

        const uuid = mesh.uuid;
        if (this.handles.has(uuid)) {
            return this.handles.get(uuid)!;
        }

        const geo = mesh.geometry;
        const posAttr = geo.attributes.position;
        const positions = new Float32Array(posAttr.array);

        const indexAttr = geo.index;
        if (!indexAttr) {
            console.warn('[RustSculptManager] Mesh has no indices, skipping');
            return null;
        }
        const indices = new Uint32Array(indexAttr.array);

        console.log(`[RustSculptManager] Registering mesh with ${positions.length / 3} verts, ${indices.length / 3} faces...`);
        const handle = await rustSculpt.initMesh(positions, indices);
        if (handle !== null) {
            this.handles.set(uuid, handle);
            console.log(`[RustSculptManager] Registered mesh ${uuid} with handle ${handle}`);
        } else {
            console.error('[RustSculptManager] Failed to register mesh with Rust backend');
        }
        return handle;
    }

    getHandle(mesh: THREE.Mesh): SculptMeshHandle | null {
        return this.handles.get(mesh.uuid) ?? null;
    }

    async syncPositions(mesh: THREE.Mesh): Promise<void> {
        const handle = this.handles.get(mesh.uuid);
        if (!handle) return;

        const positions = mesh.geometry.attributes.position.array as Float32Array;
        await rustSculpt.updatePositions(handle, positions);
    }

    async disposeMesh(mesh: THREE.Mesh): Promise<void> {
        const uuid = mesh.uuid;
        const handle = this.handles.get(uuid);
        if (handle) {
            await rustSculpt.dispose(handle);
            this.handles.delete(uuid);
        }
    }

    async disposeAll(): Promise<void> {
        for (const [uuid, handle] of this.handles) {
            await rustSculpt.dispose(handle);
        }
        this.handles.clear();
    }
}

// Global singleton
export const rustSculptManager = new RustSculptManager();

// ============================================================================
// MAIN ENTRY POINT - Rust-only sculpting (no JS fallback)
// ============================================================================

/**
 * Apply brush using Rust backend
 * 
 * This is the main entry point for high-performance sculpting.
 * JS fallback has been removed - Rust is required for sculpting.
 * 
 * Dyntopo (dynamic topology) still uses JS for geometry mutation,
 * but the actual sculpting is handled by Rust.
 */
export async function applyBrushRust(
    mesh: THREE.Mesh,
    topology: MeshTopology | null,
    worldPoint: THREE.Vector3,
    worldNormal: THREE.Vector3,
    radius: number,
    intensity: number,
    tool: string,
    symmetry: 'X' | 'NONE' = 'NONE',
    alphaTexture: THREE.Texture | null = null,
    enableDyntopo: boolean = false,
    detailSize: number = 0.5
): Promise<{ usedRust: boolean; timeMs: number; affectedCount: number }> {
    // Initialize manager on first call
    await rustSculptManager.init();

    // Check Rust availability
    const handle = rustSculptManager.getHandle(mesh);
    const isAvailable = rustSculptManager.isAvailable();

    if (!handle || !isAvailable) {
        console.error('[applyBrushRust] Rust backend not available or mesh not registered');
        return { usedRust: false, timeMs: 0, affectedCount: 0 };
    }

    // Transform world to local space
    const invMat = mesh.matrixWorld.clone().invert();
    const localPoint = worldPoint.clone().applyMatrix4(invMat);
    const localNormal = worldNormal.clone().transformDirection(invMat).normalize();

    const scale = new THREE.Vector3();
    mesh.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
    const safeScale = (Math.abs(scale.x) + Math.abs(scale.y) + Math.abs(scale.z)) / 3 || 1;
    const localRadius = radius / safeScale;
    const localDetailSize = detailSize / safeScale;

    // --- DYNAMIC TOPOLOGY PASS (JS-side geometry mutation) ---
    if (enableDyntopo && topology) {
        const topologyChanged = topology.refineTopology(mesh, localPoint, localRadius * 1.5, localDetailSize);
        if (topologyChanged) {
            // After dyntopo, we need to re-register the mesh with Rust
            await rustSculptManager.disposeMesh(mesh);
            await rustSculptManager.registerMesh(mesh);
            console.log('[applyBrushRust] Topology changed, re-registered mesh with Rust');
        }
    }

    // Get the (potentially new) handle after dyntopo
    const currentHandle = rustSculptManager.getHandle(mesh);
    if (!currentHandle) {
        console.error('[applyBrushRust] Lost mesh handle after dyntopo');
        return { usedRust: false, timeMs: 0, affectedCount: 0 };
    }

    // Alpha textures not yet supported in Rust - log warning
    if (alphaTexture) {
        console.warn('[applyBrushRust] Alpha textures not yet supported in Rust backend');
    }

    // Apply brush via Rust
    const result = await rustSculpt.applyBrush(
        currentHandle,
        [localPoint.x, localPoint.y, localPoint.z],
        [localNormal.x, localNormal.y, localNormal.z],
        tool,
        localRadius,
        intensity,
        symmetry
    );

    if (result) {
        applyBrushResultToGeometry(mesh.geometry, result);
        return {
            usedRust: true,
            timeMs: result.time_ms,
            affectedCount: result.affected_count
        };
    }

    return { usedRust: false, timeMs: 0, affectedCount: 0 };
}

/**
 * Re-export for convenience
 */
export { rustSculpt, applyBrushResultToGeometry, type SculptMeshHandle, type BrushResult };
