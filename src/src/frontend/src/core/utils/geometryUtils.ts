import * as THREE from 'three';

// Geometry normalization and manipulation utilities

export interface NormalizeOptions {
    targetSize?: number;
    center?: boolean;
}

/**
 * Normalize an object's size and optionally center it
 */
export const normalizeGeometry = (
    object: THREE.Object3D,
    options: NormalizeOptions = {}
): void => {
    const { targetSize = 3.0, center = true } = options;
    
    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    box.getSize(size);
    const centerPoint = new THREE.Vector3();
    box.getCenter(centerPoint);
    
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = targetSize / (maxDim || 1);
    
    if (center) {
        object.position.sub(centerPoint);
    }
    
    object.scale.multiplyScalar(scale);
};

/**
 * Get bounding box info for an object
 */
export const getBoundingBox = (object: THREE.Object3D) => {
    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z);
    
    return { box, size, center, maxDim };
};

