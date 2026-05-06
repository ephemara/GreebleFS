import * as THREE from 'three';
/**
 * Applies a stack of deformations to a geometry.
 * IMPORTANT: This is destructive to 'geo', so we usually clone positions first.
 */
export declare const applyDeformations: (mesh: THREE.Mesh, params: any) => void;
