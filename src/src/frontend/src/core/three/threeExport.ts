import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { normalizeGeometry } from '../utils/geometryUtils';

export type ExportFormat = 'GLB' | 'GLTF' | 'OBJ';

export interface ExportOptions {
    format?: ExportFormat;
    binary?: boolean;
    normalize?: boolean;
    targetSize?: number;
    animations?: THREE.AnimationClip[]; 
}

/**
 * Export a Three.js scene/object to a Blob.
 * Handles both standard Objects and Animation Bake Results.
 */
export const exportScene = (
    input: THREE.Object3D | { scene: THREE.Scene, animations: THREE.AnimationClip[] },
    options: ExportOptions = {}
): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        let object: THREE.Object3D;
        let animations: THREE.AnimationClip[] = options.animations || [];

        // Determine if input is a raw Object3D or a BakeResult
        if ('scene' in input && 'animations' in input) {
            object = input.scene;
            if (input.animations && input.animations.length > 0) {
                animations = input.animations;
            }
        } else {
            object = input as THREE.Object3D;
        }

        const {
            format = 'GLB',
            binary = true,
            normalize = true,
            targetSize = 3.0,
        } = options;

        // Normalize if requested
        if (normalize) {
            // We clone to avoid modifying the input, but deep cloning a scene 
            // right before export might be heavy. Proceed with caution.
            const cloned = object.clone();
            normalizeGeometry(cloned, { targetSize, center: true });
            object = cloned;
        }

        if (format === 'GLB' || format === 'GLTF') {
            const exporter = new GLTFExporter();
            
            const gltfOptions: any = { binary };
            if (animations && animations.length > 0) {
                gltfOptions.animations = animations;
            }

            exporter.parse(
                object,
                (result) => {
                    const blob = new Blob(
                        [result as ArrayBuffer],
                        { type: 'model/gltf-binary' }
                    );
                    resolve(blob);
                },
                (error) => reject(error),
                gltfOptions
            );
        } else if (format === 'OBJ') {
            const exporter = new OBJExporter();
            const result = exporter.parse(object);
            const blob = new Blob([result], { type: 'text/plain' });
            resolve(blob);
        } else {
            reject(new Error(`Unsupported format: ${format}`));
        }
    });
};

/**
 * Download exported scene as file
 */
export const downloadExportedScene = (
    blob: Blob,
    filename: string
): void => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};