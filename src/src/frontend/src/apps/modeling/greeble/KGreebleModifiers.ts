
import * as THREE from 'three';
import { SUBTRACTION, INTERSECTION, ADDITION, Brush, Evaluator } from 'three-bvh-csg';

// --- BOOLEAN OPERATIONS ---

export const performBoolean = (
    subject: THREE.Mesh,
    target: THREE.Mesh,
    operation: 'SUBTRACT' | 'UNION' | 'INTERSECT',
    material?: THREE.Material
): THREE.Mesh | null => {
    if (!subject || !target) return null;

    // Ensure matrices are updated
    subject.updateMatrixWorld();
    target.updateMatrixWorld();

    const evaluator = new Evaluator();
    const brush1 = new Brush(subject.geometry, subject.material);
    brush1.position.copy(subject.position);
    brush1.quaternion.copy(subject.quaternion);
    brush1.scale.copy(subject.scale);
    brush1.updateMatrixWorld();

    const brush2 = new Brush(target.geometry, target.material);
    brush2.position.copy(target.position);
    brush2.quaternion.copy(target.quaternion);
    brush2.scale.copy(target.scale);
    brush2.updateMatrixWorld();

    let resultBrush: Brush | null = null;

    try {
        if (operation === 'SUBTRACT') {
            resultBrush = evaluator.evaluate(brush1, brush2, SUBTRACTION);
        } else if (operation === 'UNION') {
            resultBrush = evaluator.evaluate(brush1, brush2, ADDITION);
        } else if (operation === 'INTERSECT') {
            resultBrush = evaluator.evaluate(brush1, brush2, INTERSECTION);
        }

        if (resultBrush) {
            const resultMesh = new THREE.Mesh(resultBrush.geometry, material || subject.material);
            resultMesh.castShadow = true;
            resultMesh.receiveShadow = true;
            resultMesh.position.copy(subject.position);
            resultMesh.quaternion.copy(subject.quaternion);
            resultMesh.scale.copy(subject.scale);

            // Reset geometry transforms since we applied them in world space during evaluation
            // The result geometry from three-bvh-csg is often in world space or relative to the first brush depending on configuration.
            // By default `evaluate` returns geometry in world space if not specified otherwise, 
            // but we want it local to the subject's transform if we're putting it back there.
            // Actually, `three-bvh-csg` returns result in world space usually. 
            // Let's center it back or just reset the mesh transform to identity?
            // Safer strategy: Use the position of the subject as the origin for the new mesh if we want to "replace" it, 
            // BUT the geometry is baked in world space.
            // So we should set the new mesh position to (0,0,0) world, OR inverse transform the geometry.

            // Simpler approach: leave mesh at 0,0,0 and bake everything.
            resultMesh.position.set(0, 0, 0);
            resultMesh.rotation.set(0, 0, 0);
            resultMesh.scale.set(1, 1, 1);

            return resultMesh;
        }
    } catch (e) {
        console.error("CSG Error:", e);
    }

    return null;
};


// --- ARRAY OPERATIONS ---

export const createLinearArray = (
    object: THREE.Object3D,
    count: number,
    offset: THREE.Vector3,
    rotation: THREE.Euler, // Relative rotation per step
    scale: THREE.Vector3 // Relative scale per step (multiplicative)
): THREE.Group => {
    const group = new THREE.Group();
    group.userData.isArrayContainer = true;

    // We don't clone the original here, we assume the caller will handle the original or hide it.
    // Actually, usually an array INCLUDES the original.

    const basePos = object.position.clone();
    const baseRot = object.quaternion.clone();
    const baseScale = object.scale.clone();

    for (let i = 0; i < count; i++) {
        const clone = object.clone();

        // Position: Base + (Offset * i)
        // Note: This is simple relative offset. For rotated arrays we might want local offset.
        // Let's assume World Offset for now as it's easier to control with sliders.
        clone.position.copy(basePos).add(new THREE.Vector3().copy(offset).multiplyScalar(i));

        // Rotation: Base * (Rotation * i)
        // We accumulate rotation
        const euler = new THREE.Euler(
            rotation.x * i,
            rotation.y * i,
            rotation.z * i,
            'XYZ'
        );
        const q = new THREE.Quaternion().setFromEuler(euler);
        clone.quaternion.copy(baseRot).multiply(q);

        // Scale: Base * (Scale ^ i)
        clone.scale.set(
            baseScale.x * Math.pow(scale.x, i),
            baseScale.y * Math.pow(scale.y, i),
            baseScale.z * Math.pow(scale.z, i)
        );

        group.add(clone);
    }

    return group;
};
