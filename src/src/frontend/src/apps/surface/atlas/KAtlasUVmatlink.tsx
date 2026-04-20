
import * as THREE from 'three';

/**
 * Traverses the object hierarchy and caches the original material
 * into userData.originalMaterial for later restoration.
 */
export const setupMaterialLink = (root: THREE.Object3D) => {
    let count = 0;
    root.traverse((child: any) => {
        if (child.isMesh) {
            // Avoid overwriting if already saved (e.g. re-processing)
            if (!child.userData.originalMaterial) {
                // Clone the material to ensure we have a distinct reference instance
                // if the loader reuses materials across meshes.
                if (Array.isArray(child.material)) {
                    child.userData.originalMaterial = child.material.map((m: any) => m.clone());
                } else if (child.material) {
                    child.userData.originalMaterial = child.material.clone();
                }
                count++;
            }
        }
    });
    console.log(`[KAtlas] Linked materials for ${count} meshes.`);
};

/**
 * Toggles the visibility of the original material vs the debug UV grid material.
 */
export const updateMaterialView = (root: THREE.Object3D, showOriginal: boolean, gridMaterial: THREE.Material) => {
    let restored = 0;
    let grid = 0;
    root.traverse((child: any) => {
        if (child.isMesh) {
            if (showOriginal) {
                if (child.userData.originalMaterial) {
                    child.material = child.userData.originalMaterial;
                    restored++;
                } else {
                    // Fallback if no original material found (shouldn't happen if setup ran)
                    // Keep current or set to error mat?
                    // console.warn("No original material found for", child.name);
                }
            } else {
                child.material = gridMaterial;
                grid++;
            }
            // Ensure material update flags are set if switching types
            if (Array.isArray(child.material)) {
                child.material.forEach((m: any) => m.needsUpdate = true);
            } else {
                child.material.needsUpdate = true;
            }
        }
    });
    // console.log(`[KAtlas] View Update: Original=${restored}, Grid=${grid}`);
};
