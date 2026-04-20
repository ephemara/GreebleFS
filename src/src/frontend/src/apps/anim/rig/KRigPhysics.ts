
import * as THREE from 'three';

interface VerletNode {
    bone: THREE.Bone;
    position: THREE.Vector3;
    previous: THREE.Vector3;
    restLength: number;
    parent: VerletNode | null;
    isRoot: boolean;
}

export class KRigPhysics {
    nodes: VerletNode[] = [];
    gravity = new THREE.Vector3(0, -9.81, 0);
    drag = 0.95; // Damping
    stiffness = 0.2; // How much it pulls back to original pose

    // If true, physics affects bones. If false, pass-through.
    enabled = false;

    constructor() { }

    /**
     * registerChain
     * Adds a chain of bones to the physics simulation.
     * @param chain Array of bones (Parent -> Child -> GrandChild)
     */
    registerChain(chain: THREE.Bone[]) {
        if (chain.length < 2) return;

        let parentNode: VerletNode | null = null;

        chain.forEach((bone, i) => {
            const pos = bone.getWorldPosition(new THREE.Vector3());
            const node: VerletNode = {
                bone: bone,
                position: pos.clone(),
                previous: pos.clone(),
                restLength: i > 0 ? pos.distanceTo(chain[i - 1].getWorldPosition(new THREE.Vector3())) : 0,
                parent: parentNode,
                isRoot: i === 0
            };
            this.nodes.push(node);
            parentNode = node;
        });
    }

    clear() {
        this.nodes = [];
    }

    update(dt: number) {
        if (!this.enabled || this.nodes.length === 0) return;

        // 1. Verlet Integration
        for (const node of this.nodes) {
            if (node.isRoot) {
                // Root is pinned to animation/skeleton
                node.bone.getWorldPosition(node.position);
                node.previous.copy(node.position);
                continue;
            }

            // Calculate velocity
            const vel = node.position.clone().sub(node.previous).multiplyScalar(this.drag);

            // Save current as previous
            node.previous.copy(node.position);

            // Apply Gravity
            const g = this.gravity.clone().multiplyScalar(dt * dt);

            // Apply stiffness (pull towards original local rotation target)
            // This is simplified: We assume "Rest" is just staying with parent.
            // A better way is: Transform the "Rest Pose" offset by parent's current rotation.
            if (node.parent) {
                // Desired position based on parent's orientation?
                // For now, let's just let it dangle (pure lag) + gravity
            }

            // Apply new position
            node.position.add(vel).add(g);
        }

        // 2. Constraints (Distance Constraint)
        // We iterate a few times to satisfy stiff constraints
        for (let iter = 0; iter < 5; iter++) {
            for (const node of this.nodes) {
                if (!node.parent) continue;

                const delta = node.position.clone().sub(node.parent.position);
                const currentLen = delta.length();
                const diff = (currentLen - node.restLength) / currentLen;

                // Pull node towards parent to satisfy length
                const correction = delta.multiplyScalar(0.5 * diff); // 0.5 for equal weight, but parent might be fixed

                // If parent is NOT root, we might move it too, but usually parent is closer to root.
                // Let's assume parent is "heavier" or we verify order.
                // We iterate Parent->Child so Parent is already updated.

                // Actually constraint should just fix Child relative to Parent.
                // Move child fully?
                node.position.sub(correction.multiplyScalar(2.0)); // Move child 100% of error
            }

            // Collisions? (Ground plane)
            for (const node of this.nodes) {
                if (node.position.y < 0) node.position.y = 0;
            }
        }

        // 3. Apply to Bones (Rotation)
        // We need to rotate the PARENT to point to the CHILD's new position.
        // Wait, if we have a chain A->B->C
        // Node B is at posB. Node A is at posA.
        // A needs to lookAt B.

        for (const node of this.nodes) {
            if (!node.parent) continue;

            // Parent Bone needs to rotate to point to This Bone (node)
            const parentBone = node.parent.bone;
            const childPos = node.position;

            // Use our helper orient function (we can't access engine's private method, so we reimplement a simple one)
            this.orientBone(parentBone, childPos);
        }
    }

    private orientBone(bone: THREE.Bone, targetNodesWorldPos: THREE.Vector3) {
        // Convert target world pos to bone's parent space to apply local rotation
        const parent = bone.parent;
        if (!parent) return;

        const localTarget = targetNodesWorldPos.clone().applyMatrix4(parent.matrixWorld.clone().invert());
        const localPos = bone.position.clone();

        const dir = localTarget.sub(localPos).normalize();

        // Assume bone points +Y (standard for vertical chains) or +Z?
        // Let's try +Y first as existing K-Rig seems to favour that.
        // If "Tail" moves back (-Z), bone should rotate.

        const currentDir = new THREE.Vector3(0, 1, 0); // Bone default axis
        const q = new THREE.Quaternion().setFromUnitVectors(currentDir, dir);

        // Slerp for smoothness?
        bone.quaternion.slerp(q, 0.5); // Soft follow
        bone.updateMatrixWorld();
    }
}
