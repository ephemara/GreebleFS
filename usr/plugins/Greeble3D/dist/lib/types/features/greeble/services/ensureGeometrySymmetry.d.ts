import * as THREE from 'three';
/**
 * Ensure geometry has perfect symmetry by adding missing mirror vertices
 * This is needed after subdivision which might create asymmetric topology
 */
export declare function ensureGeometrySymmetry(geometry: THREE.BufferGeometry, symmetryAxes: {
    x: boolean;
    y: boolean;
    z: boolean;
}, tolerance?: number): THREE.BufferGeometry;
