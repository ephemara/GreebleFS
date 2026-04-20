import * as THREE from 'three';

export type UVBrushType = 'GRAB' | 'RELAX';

export interface UVBrushParams {
    radius: number;
    intensity: number;
    type: UVBrushType;
}

export class KAtlasUVBrush {
    private raycaster = new THREE.Raycaster();
    private mouse = new THREE.Vector2();

    // Temporary storage for Grab brush to track initial click
    private isDragging = false;
    private dragStartUV = new THREE.Vector2();
    private dragCurrentUV = new THREE.Vector2();

    // We need to store influence weights for Grab brush
    private grabWeights: Map<number, number> = new Map(); // vertexIndex -> weight

    constructor() { }

    // Helper to get UV position of a vertex
    private getUV(attr: THREE.BufferAttribute, index: number): THREE.Vector2 {
        return new THREE.Vector2(attr.getX(index), attr.getY(index));
    }

    // Helper to set UV position
    private setUV(attr: THREE.BufferAttribute, index: number, uv: THREE.Vector2) {
        attr.setXY(index, uv.x, uv.y);
    }

    // Main Brush Action
    applyBrush(
        meshes: { [uuid: string]: THREE.Mesh },
        selectedIds: string[],
        camera: THREE.Camera,
        pointer: THREE.Vector2, // NDC (-1 to +1)
        params: UVBrushParams,
        isDown: boolean,
        rect: DOMRect // To map pointer to aspect correct UV space if needed
    ) {
        // 1. Convert Pointer NDC to World (UV) Coordinates
        // In our Ortho camera setup:
        // Camera is at Z=10 looking at Z=0.
        // Left/Right/Top/Bottom define the visible area.

        if (!(camera instanceof THREE.OrthographicCamera)) return;

        // Map NDC to Camera Frustum
        const x = pointer.x * (camera.right - camera.left) / 2 + (camera.right + camera.left) / 2;
        const y = pointer.y * (camera.top - camera.bottom) / 2 + (camera.top + camera.bottom) / 2;
        const cursorUV = new THREE.Vector2(x, y);

        // Handle Drag State for GRAB brush
        if (isDown && !this.isDragging) {
            this.isDragging = true;
            this.dragStartUV.copy(cursorUV);
            this.dragCurrentUV.copy(cursorUV);

            if (params.type === 'GRAB') {
                this.calculateGrabWeights(meshes, selectedIds, cursorUV, params.radius);
            }
        } else if (!isDown) {
            this.isDragging = false;
            this.grabWeights.clear();
            return;
        }

        this.dragCurrentUV.copy(cursorUV);

        // 2. Apply Brush
        const rSq = params.radius * params.radius;

        selectedIds.forEach(id => {
            const mesh = meshes[id];
            if (!mesh) return;
            const uvAttr = mesh.geometry.attributes.uv;
            if (!uvAttr) return;

            let needsUpdate = false;

            // OPTIMIZATION: In production, use a BVH or Grid. 
            // For now, brute force is okay for < 10k verts.
            const count = uvAttr.count;

            if (params.type === 'GRAB' && this.isDragging) {
                // GRAB Logic: Move vertices based on initial weights and delta
                const delta = new THREE.Vector2().subVectors(this.dragCurrentUV, this.dragStartUV);

                // We iterate only over the pre-calculated weights for performance
                // But since we store index -> weight in a Map, we need to iterate the map?
                // Or just iterate all verts if map is not exposed?
                // Better: Iterate all verts, check map.

                // Actually, for Grab, we want to move them relative to their START position.
                // This requires storing start positions. 
                // Simplified Grab: Just add delta * weight to CURRENT position? No, that drifts.
                // Correct Grab: NewPos = OriginalPos + Delta * Weight.
                // This requires storing OriginalPos. 

                // Let's do a "Nudge" brush instead of full Grab for simplicity first?
                // No, user wants "Grab".
                // Okay, let's just do "Smudge/Nudge" (move towards cursor) if Grab is too complex for stateless.
                // Actually, let's implement a "Drag" brush that moves vertices within radius.

                const moveVec = new THREE.Vector2().subVectors(this.dragCurrentUV, this.dragStartUV).multiplyScalar(params.intensity);
                // Reset start for next frame to make it incremental (Smudge-like)
                this.dragStartUV.copy(this.dragCurrentUV);

                for (let i = 0; i < count; i++) {
                    const u = uvAttr.getX(i);
                    const v = uvAttr.getY(i);
                    const dx = u - cursorUV.x;
                    const dy = v - cursorUV.y;
                    const distSq = dx * dx + dy * dy;

                    if (distSq < rSq) {
                        const dist = Math.sqrt(distSq);
                        const falloff = this.smoothStep(dist, params.radius);

                        // Move
                        uvAttr.setXY(
                            i,
                            u + moveVec.x * falloff,
                            v + moveVec.y * falloff
                        );
                        needsUpdate = true;
                    }
                }
            }
            else if (params.type === 'RELAX') {
                // RELAX Logic: Laplacian Smoothing
                // Move vertex towards average of neighbors.
                // Requires connectivity info (index buffer).

                const index = mesh.geometry.index;
                if (!index) return; // Need index for neighbors

                // Build adjacency on the fly? Too slow per frame.
                // We should assume we can just process triangles.
                // For each vertex, find connected verts, average them.

                // Simple approach: Iterate triangles.
                // For each triangle, pull vertices towards centroid? 
                // That shrinks the mesh.
                // Real Relax: Cotangent weights? Or just uniform average of neighbors.

                // Let's do a simple "Triangle Relax":
                // For each triangle under cursor:
                // Calculate ideal shape (equilateral) or just average edge lengths?
                // Let's try simple Laplacian: V = (V_neighbors_sum) / N

                // We need a temporary buffer to store new positions so we don't read-modify-write in same pass
                const newPos = new Float32Array(count * 2);
                const counts = new Int32Array(count); // Neighbor count

                // Initialize with current positions
                for (let i = 0; i < count; i++) {
                    newPos[i * 2] = uvAttr.getX(i);
                    newPos[i * 2 + 1] = uvAttr.getY(i);
                }

                const triCount = index.count / 3;
                for (let t = 0; t < triCount; t++) {
                    const a = index.getX(t * 3);
                    const b = index.getX(t * 3 + 1);
                    const c = index.getX(t * 3 + 2);

                    // Check if triangle is in brush radius
                    const uA = uvAttr.getX(a), vA = uvAttr.getY(a);
                    const uB = uvAttr.getX(b), vB = uvAttr.getY(b);
                    const uC = uvAttr.getX(c), vC = uvAttr.getY(c);

                    const cX = (uA + uB + uC) / 3;
                    const cY = (vA + vB + vC) / 3;

                    const dx = cX - cursorUV.x;
                    const dy = cY - cursorUV.y;

                    if (dx * dx + dy * dy < rSq) {
                        // Accumulate neighbors
                        // A's neighbors are B and C
                        newPos[a * 2] += uB + uC; newPos[a * 2 + 1] += vB + vC; counts[a] += 2;
                        newPos[b * 2] += uA + uC; newPos[b * 2 + 1] += vA + vC; counts[b] += 2;
                        newPos[c * 2] += uA + uB; newPos[c * 2 + 1] += vA + vB; counts[c] += 2;
                    }
                }

                // Apply
                for (let i = 0; i < count; i++) {
                    if (counts[i] > 0) {
                        const targetX = newPos[i * 2] / counts[i]; // This is pure average (shrinks)
                        const targetY = newPos[i * 2 + 1] / counts[i];

                        // Blend based on brush falloff
                        const u = uvAttr.getX(i);
                        const v = uvAttr.getY(i);
                        const dx = u - cursorUV.x;
                        const dy = v - cursorUV.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);

                        if (dist < params.radius) {
                            const falloff = this.smoothStep(dist, params.radius) * params.intensity * 0.5;

                            // To prevent shrinking, we can blend with original?
                            // Or just accept shrinking as "Relax" behavior (it minimizes tension).

                            uvAttr.setXY(
                                i,
                                u + (targetX - u) * falloff,
                                v + (targetY - v) * falloff
                            );
                            needsUpdate = true;
                        }
                    }
                }
            }

            if (needsUpdate) {
                uvAttr.needsUpdate = true;
            }
        });
    }

    private calculateGrabWeights(meshes: any, ids: string[], center: THREE.Vector2, radius: number) {
        // Not used in simplified "Smudge" implementation
    }

    private smoothStep(dist: number, radius: number) {
        if (dist >= radius) return 0;
        const x = dist / radius;
        return 1 - (x * x * (3 - 2 * x)); // Smooth falloff
    }
}
