import * as THREE from 'three';
/**
 * Simple triangle-based subdivision that avoids T-junctions
 * by subdividing entire triangles uniformly
 */
export declare function subdivideGeometryLocally(geometry: THREE.BufferGeometry, point: THREE.Vector3, radius: number, maxEdgeLength: number): THREE.BufferGeometry;
