import * as THREE from 'three';
export declare const snoise: (v: THREE.Vector3) => number;
/**
 * Handles the logic for spawning procedural objects at a specific point/normal.
 * Encapsulates the complex shape generation logic (City, Tentacle, etc).
 */
export declare const spawnMeshAtPosition: (point: THREE.Vector3, normal: THREE.Vector3, type: string, material: THREE.Material, userImports: any[], greebleParams?: any, primitiveParams?: any) => THREE.Group | null;
/**
 * Converts keyframe data into THREE.AnimationClip for export.
 */
export declare const generateAnimationClips: (keyframes: any, rootNameMap: any) => THREE.AnimationClip[];
/**
 * Merges and welds the scene geometry for a clean export.
 * Collapses InstancedMesh, applies transforms, and fuses vertices.
 */
export declare const weldScene: (scene: THREE.Group) => THREE.Group;
/**
 * Clones the scene and removes helper objects (like the base plane) for export.
 * ALSO BAKES FLUX SHADER DEFORMATIONS INTO GEOMETRY
 */
export declare const prepareSceneForExport: (rootGroup: THREE.Group, includeBase: boolean, selectionBox?: THREE.BoxHelper, weld?: boolean) => THREE.Group<THREE.Object3DEventMap>;
export declare const toggleFullscreen: () => void;
