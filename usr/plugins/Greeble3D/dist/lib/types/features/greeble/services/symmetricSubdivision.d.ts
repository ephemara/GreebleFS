import * as THREE from 'three';
/**
 * Subdivide geometry around multiple points simultaneously to maintain symmetry
 * This ensures that when we subdivide symmetric regions, the topology stays symmetric
 */
export declare function subdivideSymmetrically(geometry: THREE.BufferGeometry, localPoints: THREE.Vector3[], localRadius: number, maxEdgeLength: number): THREE.BufferGeometry;
