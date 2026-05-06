import * as THREE from 'three';
/**
 * Check if a triangle needs subdivision based on its size
 */
export declare function triangleNeedsSubdivision(v1: THREE.Vector3, v2: THREE.Vector3, v3: THREE.Vector3, maxEdgeLength?: number): boolean;
/**
 * Adaptive subdivision with transition patterns to prevent T-junctions
 */
export declare function subdivideGeometryLocally(geometry: THREE.BufferGeometry, point: THREE.Vector3, radius: number, maxEdgeLength?: number): THREE.BufferGeometry;
/**
 * Simple subdivision of entire geometry (for testing)
 */
export declare function subdivideGeometry(geometry: THREE.BufferGeometry): THREE.BufferGeometry;
