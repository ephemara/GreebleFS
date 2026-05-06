import * as THREE from 'three';
import { getGreeble3DWasmInterface } from './services/WasmService';

// --- DEFORMATION FUNCTIONS ---

/**
 * Applies a stack of deformations to a geometry.
 * IMPORTANT: This is destructive to 'geo', so we usually clone positions first.
 */
export const applyDeformations = (mesh: THREE.Mesh, params: any) => {
    const geo = mesh.geometry;

    // 1. RESTORE BASE STATE (Crucial for Slider feel)
    // We look for the original positions. If not found, we save them.
    if (!mesh.userData) mesh.userData = {};
    if (!mesh.userData.originalPos) {
        mesh.userData.originalPos = Float32Array.from(geo.attributes.position.array);
        // We also need original normals to recalculate correctly or use them for inflate
        mesh.userData.originalNormals = Float32Array.from(geo.attributes.normal.array);
    }

    const originalPos = mesh.userData.originalPos;
    const posAttribute = geo.attributes.position;

    // Reset current positions to original before applying new modifiers
    // This allows the slider to go up/down without compounding errors
    posAttribute.array.set(originalPos);
    posAttribute.needsUpdate = true;

    // Early exit if all params are zero
    const isZero = Object.values(params).every(v => v === 0);
    if (isZero) {
        geo.computeVertexNormals();
        return;
    }

    const count = posAttribute.count;
    // Compute bounds on the ORIGINAL positions to keep deformations stable
    // Actually, we should probably cache the bbox too, but computing it from current (reset) pos is fast enough
    geo.computeBoundingBox();

    const min = geo.boundingBox!.min;
    const max = geo.boundingBox!.max;
    const size = new THREE.Vector3().subVectors(max, min);
    const center = new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5);

    // 0. WASM OPTIMIZATION (Taper, Twist, Bend)
    // If Inflate/Spherize/Noise are 0, we can use WASM entirely for a huge speedup.
    // Even if they are not 0, WASM can do the heavy lifting for T/T/B.
    const wasm = getGreeble3DWasmInterface();
    // FIXED: WASM backend deformers non-functional. Forcing JS fallback.
    if (false && wasm && wasm.deform_mesh_wasm) {
        // Run WASM deformation on the buffer directly
        // Note: WASM updates the buffer in place.
        wasm.deform_mesh_wasm(
            posAttribute.array,
            center.x, center.y, center.z,
            size.y,
            params.taper, params.twist, params.bend,
            params.noise // Pass noise to Rust!
        );
        posAttribute.needsUpdate = true;

        // If no other modifiers are active, we are done!
        // Inflate and Spherize are still JS-only
        if (params.inflate === 0 && params.spherize === 0) {
            geo.computeVertexNormals();
            return;
        }

        // If we have other modifiers, we fall through to the JS loop to apply them.
        // However, the JS loop reads from buffer (which WASM just updated) and applies logic.
        // But the JS loop logic for Taper/Twist/Bend/Noise re-applies them!
        // We must prevent double application.
        // We can temporarily set T/T/B/N to 0 in a local params object.
    }

    // Shadow params to disable T/T/B/N if WASM already handled them
    const loopParams = { ...params };
    if (false && wasm && wasm.deform_mesh_wasm) {
        loopParams.taper = 0;
        loopParams.twist = 0;
        loopParams.bend = 0;
        loopParams.noise = 0;
    }

    // Temp vectors
    const v = new THREE.Vector3();
    const normal = new THREE.Vector3();

    // --- APPLY LOOP ---
    for (let i = 0; i < count; i++) {
        v.fromBufferAttribute(posAttribute, i);

        // Normalize coordinates (-1 to 1 relative to center) for consistent math
        // Avoiding divide by zero
        // const ny = size.y > 0.0001 ? (v.y - min.y) / size.y : 0.5; // 0 to 1 (Bottom to Top)
        // const centeredY = v.y - center.y;

        // -----------------------
        // 1. INFLATE (Move along Normal)
        // -----------------------
        if (loopParams.inflate !== 0) {
            normal.fromBufferAttribute(geo.attributes.normal, i);
            v.add(normal.multiplyScalar(loopParams.inflate * 0.1));
        }

        // -----------------------
        // 2. TAPER (Scale X/Z based on Y)
        // -----------------------
        if (loopParams.taper !== 0) {
            const ny = size.y > 0.0001 ? (v.y - min.y) / size.y : 0.5;
            // ZBrush Taper: 0 = none, 1 = sharp point at top
            // Logic: Scale factor decreases as Y goes up
            const amount = loopParams.taper;
            // If tapering Top: factor 1.0 at bottom, (1-amount) at top
            const factor = 1.0 - (ny * amount);
            v.x = (v.x - center.x) * factor + center.x;
            v.z = (v.z - center.z) * factor + center.z;
        }

        // -----------------------
        // 3. TWIST (Rotate X/Z around Y)
        // -----------------------
        if (loopParams.twist !== 0) {
            const centeredY = v.y - center.y;
            const angle = centeredY * loopParams.twist; // Rotation depends on height
            const s = Math.sin(angle);
            const c = Math.cos(angle);

            const localX = v.x - center.x;
            const localZ = v.z - center.z;

            v.x = localX * c - localZ * s + center.x;
            v.z = localX * s + localZ * c + center.z;
        }

        // -----------------------
        // 4. BEND (Simple Curve)
        // -----------------------
        if (loopParams.bend !== 0) {
            const ny = size.y > 0.0001 ? (v.y - min.y) / size.y : 0.5;
            // Simple bend: Offset X based on Y^2
            // ZBrush actually bends space around a pivot, but parabolic is cheaper
            const bendFactor = (ny - 0.5) * 2; // -1 to 1
            const offset = (bendFactor * bendFactor) * loopParams.bend;
            v.x += offset;
        }

        // -----------------------
        // 5. SPHERIZE (Morph to Sphere)
        // -----------------------
        if (loopParams.spherize !== 0) {
            const currentVec = new THREE.Vector3(v.x - center.x, v.y - center.y, v.z - center.z);
            const len = currentVec.length();
            if (len > 0.0001) {
                // Target: Normalized vector * Radius (Radius approx size.y/2)
                const targetLen = size.y * 0.5;
                const sphereVec = currentVec.normalize().multiplyScalar(targetLen);

                // Lerp
                v.x = center.x + (currentVec.x + (sphereVec.x - currentVec.x) * loopParams.spherize);
                v.y = center.y + (currentVec.y + (sphereVec.y - currentVec.y) * loopParams.spherize);
                v.z = center.z + (currentVec.z + (sphereVec.z - currentVec.z) * loopParams.spherize);
            }
        }

        // -----------------------
        // 6. NOISE (Roughness)
        // -----------------------
        if (loopParams.noise > 0) {
            // Deterministic noise based on position to avoid flickering if possible, 
            // but here simple random is used as per snippet. 
            // Ideally use a seeded random or position hash.
            v.x += (Math.random() - 0.5) * loopParams.noise * 0.1;
            v.y += (Math.random() - 0.5) * loopParams.noise * 0.1;
            v.z += (Math.random() - 0.5) * loopParams.noise * 0.1;
        }

        posAttribute.setXYZ(i, v.x, v.y, v.z);
    }

    posAttribute.needsUpdate = true;
    geo.computeVertexNormals(); // Recalculate lighting
};
