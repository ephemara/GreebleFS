
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type PrimitiveType = 
    | 'CUBE' | 'SPHERE' | 'CYLINDER' | 'TORUS' | 'PLANE' | 'ICOSA'
    | 'CONE' | 'SPIKE' | 'PIPE' | 'CRYSTAL' | 'PYRAMID' | 'CAPSULE' | 'RING' 
    | 'WALL' | 'PLATFORM' | 'PILLAR' | 'TOWER' | 'ARC';

/**
 * PrimitiveFactory
 * Centralizes the creation of standard 3D shapes with consistent 
 * centering, UVs, and vertex merging.
 */
export class PrimitiveFactory {
    
    static create(type: PrimitiveType): THREE.BufferGeometry {
        let geo: THREE.BufferGeometry;

        switch(type) {
            case 'CUBE': 
                geo = new THREE.BoxGeometry(1, 1, 1, 16, 16, 16); 
                break;
            case 'SPHERE': 
                geo = new THREE.IcosahedronGeometry(0.8, 4); 
                break;
            case 'CYLINDER': 
                geo = new THREE.CylinderGeometry(0.5, 0.5, 1, 32, 16); 
                break;
            case 'TORUS': 
                geo = new THREE.TorusGeometry(0.6, 0.2, 32, 64); 
                break;
            case 'PLANE': 
                geo = new THREE.PlaneGeometry(2, 2, 64, 64); 
                // Rotate plane to face up by default
                geo.rotateX(-Math.PI / 2);
                break;
            case 'ICOSA':
                geo = new THREE.IcosahedronGeometry(0.8, 1);
                break;
            // --- KGreeble Additions ---
            case 'CONE':
                geo = new THREE.ConeGeometry(0.5, 1, 32, 16);
                break;
            case 'SPIKE':
                geo = new THREE.ConeGeometry(0.2, 2, 32, 32);
                break;
            case 'PIPE':
                geo = new THREE.TorusKnotGeometry(0.4, 0.15, 128, 16, 2, 3);
                break;
            case 'CRYSTAL':
                geo = new THREE.OctahedronGeometry(0.5, 0);
                break;
            case 'PYRAMID':
                geo = new THREE.ConeGeometry(0.5, 1, 4, 1);
                break;
            case 'CAPSULE':
                geo = new THREE.CapsuleGeometry(0.3, 0.8, 8, 16);
                break;
            case 'RING':
                geo = new THREE.TorusGeometry(0.5, 0.1, 32, 64);
                // Standardize flat orientation
                geo.rotateX(-Math.PI / 2);
                break;
            case 'WALL':
                geo = new THREE.BoxGeometry(2, 1, 0.2, 4, 4, 4);
                break;
            case 'PLATFORM':
                geo = new THREE.BoxGeometry(2, 0.2, 2, 4, 4, 4);
                break;
            case 'PILLAR':
                geo = new THREE.CylinderGeometry(0.2, 0.2, 2, 16, 8);
                break;
            case 'TOWER':
                geo = new THREE.BoxGeometry(0.5, 3, 0.5, 4, 8, 4);
                break;
            case 'ARC':
                geo = new THREE.TorusGeometry(1, 0.2, 16, 32, Math.PI);
                // Rotate to stand upright like an archway
                geo.rotateY(Math.PI / 2);
                break;
            default: 
                geo = new THREE.BoxGeometry(1, 1, 1);
        }

        return this.process(geo);
    }

    /**
     * Standard processing pipeline for geometry:
     * 1. Merge vertices (for smooth shading/sculpting connectivity)
     * 2. Compute Vertex Normals
     * 3. Compute Bounding Box
     * 4. Center
     * 5. Ensure Color Attribute exists (for painting)
     */
    private static process(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
        let mergedGeo;
        
        // Attempt to merge vertices to ensure topology is connected for sculpting
        try { 
            mergedGeo = BufferGeometryUtils.mergeVertices(geometry); 
        } catch (e) { 
            console.warn("Merge vertices failed, using raw geometry", e);
            mergedGeo = geometry.clone(); 
        }
        
        mergedGeo.computeVertexNormals();
        mergedGeo.computeBoundingBox();
        mergedGeo.center();

        // Add vertex colors if missing (initialized to white)
        if (!mergedGeo.attributes.color) {
            const count = mergedGeo.attributes.position.count;
            const colors = new Float32Array(count * 3).fill(1);
            mergedGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        }

        return mergedGeo;
    }
}
