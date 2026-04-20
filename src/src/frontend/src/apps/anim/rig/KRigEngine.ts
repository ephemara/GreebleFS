

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { StudioStage } from '../../../core/three/StudioStage';
import { GizmoSystem } from '../../../core/three/GizmoSystem';
import { KRigPhysics } from './KRigPhysics';

// New Systems
import { KRigMarkerSystem, MarkerType, SkeletonFitter } from './KRigMarkers';
import { KRigCompute } from './KRigCompute';
import { applyDQSToMesh, DQSShaderInjector } from './KRigDQS';
import { invoke } from '@tauri-apps/api/core';

const CCD_ITERATIONS = 5;
const IK_EPSILON = 0.001;

// Standard T-Pose Configs
export const BONE_CONFIGS: any = {
    BIPED: {
        bones: [
            { name: 'Hips', pos: [0, 1.0, 0], parent: -1 },
            { name: 'Spine', pos: [0, 1.3, 0], parent: 0 },
            { name: 'Chest', pos: [0, 1.6, 0], parent: 1 },
            { name: 'Neck', pos: [0, 1.75, 0], parent: 2 },
            { name: 'Head', pos: [0, 1.9, 0], parent: 3 },
            { name: 'L_Shoulder', pos: [0.15, 1.55, 0], parent: 2 },
            { name: 'L_Arm', pos: [0.35, 1.55, 0], parent: 5 },
            { name: 'L_ForeArm', pos: [0.6, 1.55, 0], parent: 6 },
            { name: 'L_Hand', pos: [0.85, 1.55, 0], parent: 7, isIK: true },
            { name: 'R_Shoulder', pos: [-0.15, 1.55, 0], parent: 2 },
            { name: 'R_Arm', pos: [-0.35, 1.55, 0], parent: 9 },
            { name: 'R_ForeArm', pos: [-0.6, 1.55, 0], parent: 10 },
            { name: 'R_Hand', pos: [-0.85, 1.55, 0], parent: 11, isIK: true },
            { name: 'L_UpLeg', pos: [0.15, 0.9, 0], parent: 0 },
            { name: 'L_Leg', pos: [0.15, 0.5, 0], parent: 13 },
            { name: 'L_Foot', pos: [0.15, 0.1, 0.1], parent: 14, isIK: true },
            { name: 'R_UpLeg', pos: [-0.15, 0.9, 0], parent: 0 },
            { name: 'R_Leg', pos: [-0.15, 0.5, 0], parent: 16 },
            { name: 'R_Foot', pos: [-0.15, 0.1, 0.1], parent: 17, isIK: true },
        ]
    },
    UE5_MANNEQUIN: {
        bones: [
            { name: 'root', pos: [0, 0, 0], parent: -1 },
            { name: 'pelvis', pos: [0, 1.0, 0], parent: 0 },
            { name: 'spine_01', pos: [0, 1.15, 0], parent: 1 },
            { name: 'spine_02', pos: [0, 1.3, 0], parent: 2 },
            { name: 'spine_03', pos: [0, 1.45, 0], parent: 3 },
            { name: 'clavicle_l', pos: [0.1, 1.5, 0], parent: 4 },
            { name: 'upperarm_l', pos: [0.25, 1.5, 0], parent: 5 },
            { name: 'lowerarm_l', pos: [0.5, 1.5, 0], parent: 6 },
            { name: 'hand_l', pos: [0.75, 1.5, 0], parent: 7, isIK: true },
            { name: 'clavicle_r', pos: [-0.1, 1.5, 0], parent: 4 },
            { name: 'upperarm_r', pos: [-0.25, 1.5, 0], parent: 9 },
            { name: 'lowerarm_r', pos: [-0.5, 1.5, 0], parent: 10 },
            { name: 'hand_r', pos: [-0.75, 1.5, 0], parent: 11, isIK: true },
            { name: 'neck_01', pos: [0, 1.55, 0], parent: 4 },
            { name: 'head', pos: [0, 1.7, 0], parent: 13 },
            { name: 'thigh_l', pos: [0.15, 0.9, 0], parent: 1 },
            { name: 'calf_l', pos: [0.15, 0.5, 0], parent: 15 },
            { name: 'foot_l', pos: [0.15, 0.1, 0.1], parent: 16, isIK: true },
            { name: 'thigh_r', pos: [-0.15, 0.9, 0], parent: 1 },
            { name: 'calf_r', pos: [-0.15, 0.5, 0], parent: 18 },
            { name: 'foot_r', pos: [-0.15, 0.1, 0.1], parent: 19, isIK: true },
        ]
    },
    ROBOTIC_ARM: {
        bones: [
            { name: 'Base', pos: [0, 0.1, 0], parent: -1 },
            { name: 'Joint_1', pos: [0, 0.5, 0], parent: 0 },
            { name: 'Joint_2', pos: [0, 1.2, 0], parent: 1 },
            { name: 'Joint_3', pos: [0, 1.8, 0], parent: 2 },
            { name: 'Claw', pos: [0, 2.2, 0], parent: 3, isIK: true }
        ]
    },
    QUADRUPED: {
        bones: [
            { name: 'Root', pos: [0, 1.0, 0], parent: -1 },
            { name: 'Spine_01', pos: [0, 1.0, 0.3], parent: 0 },
            { name: 'Spine_02', pos: [0, 1.1, 0.6], parent: 1 },
            { name: 'Neck', pos: [0, 1.25, 0.9], parent: 2 },
            { name: 'Head', pos: [0, 1.35, 1.1], parent: 3 },
            { name: 'Tail_01', pos: [0, 0.95, -0.2], parent: 0 },
            { name: 'Tail_02', pos: [0, 0.8, -0.5], parent: 5 },

            // Front Left
            { name: 'FL_Thigh', pos: [0.2, 1.1, 0.6], parent: 2 },
            { name: 'FL_Calf', pos: [0.2, 0.6, 0.65], parent: 7 },
            { name: 'FL_Foot', pos: [0.2, 0.0, 0.7], parent: 8, isIK: true },

            // Front Right
            { name: 'FR_Thigh', pos: [-0.2, 1.1, 0.6], parent: 2 },
            { name: 'FR_Calf', pos: [-0.2, 0.6, 0.65], parent: 10 },
            { name: 'FR_Foot', pos: [-0.2, 0.0, 0.7], parent: 11, isIK: true },

            // Back Left
            { name: 'BL_Thigh', pos: [0.2, 1.0, 0], parent: 0 },
            { name: 'BL_Calf', pos: [0.2, 0.5, -0.1], parent: 13 },
            { name: 'BL_Foot', pos: [0.2, 0.0, -0.2], parent: 14, isIK: true },

            // Back Right
            { name: 'BR_Thigh', pos: [-0.2, 1.0, 0], parent: 0 },
            { name: 'BR_Calf', pos: [-0.2, 0.5, -0.1], parent: 16 },
            { name: 'BR_Foot', pos: [-0.2, 0.0, -0.2], parent: 17, isIK: true },
        ]
    }
};


// --- SPATIAL HASH FOR OPTIMIZED VERTEX LOOKUP ---
class VertexSpatialHash {
    cellSize: number;
    cells: Map<string, number[]> = new Map();

    constructor(cellSize: number) {
        this.cellSize = cellSize;
    }

    private getKey(x: number, y: number, z: number): string {
        const cx = Math.floor(x / this.cellSize);
        const cy = Math.floor(y / this.cellSize);
        const cz = Math.floor(z / this.cellSize);
        return `${cx},${cy},${cz}`;
    }

    build(geometry: THREE.BufferGeometry, matrixWorld: THREE.Matrix4) {
        this.cells.clear();
        const posAttr = geometry.attributes.position;
        const vertex = new THREE.Vector3();

        for (let i = 0; i < posAttr.count; i++) {
            vertex.fromBufferAttribute(posAttr, i);
            vertex.applyMatrix4(matrixWorld);

            const key = this.getKey(vertex.x, vertex.y, vertex.z);
            if (!this.cells.has(key)) {
                this.cells.set(key, []);
            }
            this.cells.get(key)!.push(i);
        }
    }

    query(center: THREE.Vector3, radius: number): number[] {
        const results: number[] = [];
        const minX = Math.floor((center.x - radius) / this.cellSize);
        const maxX = Math.floor((center.x + radius) / this.cellSize);
        const minY = Math.floor((center.y - radius) / this.cellSize);
        const maxY = Math.floor((center.y + radius) / this.cellSize);
        const minZ = Math.floor((center.z - radius) / this.cellSize);
        const maxZ = Math.floor((center.z + radius) / this.cellSize);

        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (let z = minZ; z <= maxZ; z++) {
                    const key = `${x},${y},${z}`;
                    const indices = this.cells.get(key);
                    if (indices) {
                        results.push(...indices);
                    }
                }
            }
        }
        return results;
    }
}

export class KRigEngine {
    stage: StudioStage;
    gizmo: GizmoSystem;

    mesh: THREE.SkinnedMesh | THREE.Mesh | null = null;
    skeleton: THREE.Skeleton | null = null;
    helper: THREE.SkeletonHelper | null = null;

    bones: THREE.Bone[] = [];
    ikChains: any[] = [];
    ikTargets: THREE.Mesh[] = [];

    // Animation System
    mixer: THREE.AnimationMixer | null = null;
    clips: THREE.AnimationClip[] = [];
    activeAction: THREE.AnimationAction | null = null;

    raycaster = new THREE.Raycaster();

    // Weight Painting
    isWeightPaintMode = false;
    weightBoneIndex = -1;
    originalMaterial: THREE.Material | null = null;
    weightMaterial: THREE.MeshStandardMaterial | null = null;

    // Optimization
    spatialHash: VertexSpatialHash | null = null;

    // Physics
    physics: KRigPhysics;

    markerSystem: KRigMarkerSystem;
    computer: KRigCompute;

    constructor(stage: StudioStage) {
        this.stage = stage;
        this.gizmo = new GizmoSystem(stage);
        this.physics = new KRigPhysics();
        this.markerSystem = new KRigMarkerSystem(stage.scene);
        this.computer = new KRigCompute();

        // Initialize WebGPU
        this.computer.initialize().catch(e => console.error("Failed to init WebGPU compute:", e));
    }

    async loadArtifact(url: string): Promise<boolean> {
        const loader = new GLTFLoader();
        const gltf = await loader.loadAsync(url);

        if (this.mesh) this.stage.scene.remove(this.mesh);
        this.clearSkeleton();

        // Store Animations
        this.clips = gltf.animations || [];

        let foundSkinnedMesh: THREE.SkinnedMesh | null = null;
        let foundStaticMesh: THREE.Mesh | null = null;

        gltf.scene.traverse((c: any) => {
            if (c.isSkinnedMesh && !foundSkinnedMesh) {
                foundSkinnedMesh = c;
            } else if (c.isMesh && !foundStaticMesh && !c.isSkinnedMesh) {
                foundStaticMesh = c;
            }
        });

        const targetMesh = foundSkinnedMesh || foundStaticMesh;

        if (targetMesh) {
            // Container to handle scaling without breaking rig matrices
            const container = new THREE.Group();
            container.add(gltf.scene);

            // --- GOD SCALE NORMALIZATION ---
            const box = new THREE.Box3().setFromObject(container);
            const size = new THREE.Vector3(); box.getSize(size);
            const maxDim = Math.max(size.x, size.y, size.z);

            // Target ~1.8m height (Human Standard)
            const targetHeight = 1.8;
            const scale = targetHeight / (maxDim || 1);
            container.scale.set(scale, scale, scale);

            // AUTO-SCALE MARKERS
            // Markers should be roughly 1/50th of the character height
            // Since we normalize character to 1.8, we can just use 1.0 (default base radius 0.05 is ~3% of 1.8)
            // But let's be safe and explicitly set it.
            // If character height is 1.8, marker base 0.05 is fine.
            this.markerSystem.setMarkerScale(1.0);

            // Recenter bottom to 0
            box.setFromObject(container);
            const center = new THREE.Vector3(); box.getCenter(center);
            const min = box.min;

            container.position.x -= center.x;
            container.position.z -= center.z;
            container.position.y -= min.y; // Sit on floor

            // CRITICAL: Update world matrices so raycasts return correct positions
            container.updateMatrixWorld(true);

            this.stage.scene.add(container);

            if (foundSkinnedMesh) {
                console.log("K-RIG: Skinned Mesh Detected. Hydrating Skeleton...");
                this.mesh = foundSkinnedMesh;
                this.hydrateSkeletonFromImport(foundSkinnedMesh);

                // Init Mixer if animations exist
                if (this.clips.length > 0) {
                    // Use the root object of the GLTF for the mixer to ensure it catches hierarchy animations
                    this.mixer = new THREE.AnimationMixer(gltf.scene);
                }

                return true;
            } else {
                console.log("K-RIG: Static Mesh Detected. Ready for Genesis.");
                if (targetMesh instanceof THREE.Mesh) {
                    targetMesh.material = new THREE.MeshStandardMaterial({
                        color: 0x888888, roughness: 0.5, metalness: 0.5
                    });
                }
                this.mesh = targetMesh;
                return false;
            }
        }
        return false;
    }

    hydrateSkeletonFromImport(skinnedMesh: THREE.SkinnedMesh) {
        this.skeleton = skinnedMesh.skeleton;
        this.bones = this.skeleton.bones;

        // Create Helper
        if (this.helper) this.stage.scene.remove(this.helper);
        this.helper = new THREE.SkeletonHelper(skinnedMesh);
        (this.helper.material as any).linewidth = 2;
        this.stage.scene.add(this.helper);

        skinnedMesh.updateMatrixWorld(true);
    }

    // --- ANIMATION CONTROL ---
    playAnimation(clipName: string) {
        if (!this.mixer) return;
        const clip = this.clips.find(c => c.name === clipName);
        if (clip) {
            if (this.activeAction) this.activeAction.stop();
            const action = this.mixer.clipAction(clip);
            action.reset();
            action.play();
            this.activeAction = action;
        }
    }

    stopAnimation() {
        if (this.activeAction) {
            this.activeAction.stop();
            this.activeAction = null;
        }
    }

    update(dt: number) {
        if (this.mixer) {
            this.mixer.update(dt);
        }
        this.physics.update(dt);
    }

    setXRay(active: boolean) {
        if (this.mesh) {
            const mat = this.mesh.material as THREE.MeshStandardMaterial;
            if (mat) {
                mat.transparent = active;
                mat.opacity = active ? 0.3 : 1.0;
                mat.depthWrite = !active;
                mat.needsUpdate = true;
            }
        }
    }

    async bindMeshToSkeleton(radius: number = 0.5) {
        if (!this.mesh || !this.skeleton) return;
        if (this.mesh instanceof THREE.SkinnedMesh) return;

        console.log("K-RIG: Starting Rust Geodesic Binding...");

        // Extract mesh data for Rust
        const geometry = this.mesh.geometry;
        const positions = geometry.attributes.position;
        const indices = geometry.index;

        // Format vertices as [[f32; 3]] for Rust
        const vertices: [number, number, number][] = [];
        for (let i = 0; i < positions.count; i++) {
            vertices.push([
                positions.getX(i),
                positions.getY(i),
                positions.getZ(i)
            ]);
        }

        // Format triangles as [[u32; 3]] for Rust
        const triangles: [number, number, number][] = [];
        if (indices) {
            for (let i = 0; i < indices.count; i += 3) {
                triangles.push([
                    indices.getX(i),
                    indices.getX(i + 1),
                    indices.getX(i + 2)
                ]);
            }
        } else {
            // Non-indexed geometry
            for (let i = 0; i < positions.count; i += 3) {
                triangles.push([i, i + 1, i + 2]);
            }
        }

        // Format bone positions as [[f32; 3]] for Rust
        const bonePositions: [number, number, number][] = this.bones.map(b => {
            const pos = b.getWorldPosition(new THREE.Vector3());
            return [pos.x, pos.y, pos.z];
        });

        let weights: any;
        try {
            console.log("K-RIG: Invoking Rust geodesic skinning...");
            weights = await invoke<any>('compute_skin_weights_geodesic', {
                vertices,
                triangles,
                bonePositions,
                resolution: 64 // Lower resolution for speed, can increase later
            });
            console.log("K-RIG: Rust skinning complete");
        } catch (err) {
            console.error("K-RIG: Rust geodesic failed, using distance fallback:", err);
            weights = await invoke<any>('compute_skin_weights_distance', {
                vertices,
                bonePositions
            });
        }

        // Apply weights to geometry
        const count = positions.count;
        const skinIndex = new THREE.Uint16BufferAttribute(new Uint16Array(count * 4), 4);
        const skinWeight = new THREE.Float32BufferAttribute(new Float32Array(count * 4), 4);

        for (let i = 0; i < count; i++) {
            skinIndex.setXYZW(i,
                weights.bone_indices[i * 4 + 0],
                weights.bone_indices[i * 4 + 1],
                weights.bone_indices[i * 4 + 2],
                weights.bone_indices[i * 4 + 3]
            );
            skinWeight.setXYZW(i,
                weights.bone_weights[i * 4 + 0],
                weights.bone_weights[i * 4 + 1],
                weights.bone_weights[i * 4 + 2],
                weights.bone_weights[i * 4 + 3]
            );
        }

        geometry.setAttribute('skinIndex', skinIndex);
        geometry.setAttribute('skinWeight', skinWeight);

        const mat = (this.mesh.material as THREE.Material).clone();
        // @ts-ignore
        mat.skinning = true;

        const skinnedMesh = new THREE.SkinnedMesh(geometry, mat);
        skinnedMesh.bind(this.skeleton);

        skinnedMesh.scale.copy(this.mesh.scale);
        skinnedMesh.position.copy(this.mesh.position);
        skinnedMesh.rotation.copy(this.mesh.rotation);

        // Apply DQS by default
        applyDQSToMesh(skinnedMesh);

        this.stage.scene.add(skinnedMesh);

        if (this.mesh.parent) {
            this.mesh.removeFromParent();
        } else {
            this.stage.scene.remove(this.mesh);
        }
        this.mesh = skinnedMesh;

        if (this.helper) this.stage.scene.remove(this.helper);
        this.helper = new THREE.SkeletonHelper(skinnedMesh);
        this.stage.scene.add(this.helper);

        console.log("K-RIG: Rust Geodesic Binding Complete. DQS Active.");
    }

    async solveSkeletonFromMarkers() {
        if (!this.markerSystem.isComplete()) {
            console.error("K-RIG: Missing markers!");
            return false;
        }

        const markerMap = this.markerSystem.getMarkerPositions();

        // Convert Map<MarkerType, THREE.Vector3> to [[f32; 3]; 8] for Rust
        // Order: chin, l_wrist, r_wrist, l_elbow, r_elbow, l_knee, r_knee, groin
        const markersArray: [number, number, number][] = [
            [markerMap.get(MarkerType.HEAD)!.x, markerMap.get(MarkerType.HEAD)!.y, markerMap.get(MarkerType.HEAD)!.z],
            [markerMap.get(MarkerType.L_WRIST)!.x, markerMap.get(MarkerType.L_WRIST)!.y, markerMap.get(MarkerType.L_WRIST)!.z],
            [markerMap.get(MarkerType.R_WRIST)!.x, markerMap.get(MarkerType.R_WRIST)!.y, markerMap.get(MarkerType.R_WRIST)!.z],
            [markerMap.get(MarkerType.L_ELBOW)!.x, markerMap.get(MarkerType.L_ELBOW)!.y, markerMap.get(MarkerType.L_ELBOW)!.z],
            [markerMap.get(MarkerType.R_ELBOW)!.x, markerMap.get(MarkerType.R_ELBOW)!.y, markerMap.get(MarkerType.R_ELBOW)!.z],
            [markerMap.get(MarkerType.L_KNEE)!.x, markerMap.get(MarkerType.L_KNEE)!.y, markerMap.get(MarkerType.L_KNEE)!.z],
            [markerMap.get(MarkerType.R_KNEE)!.x, markerMap.get(MarkerType.R_KNEE)!.y, markerMap.get(MarkerType.R_KNEE)!.z],
            [markerMap.get(MarkerType.GROIN)!.x, markerMap.get(MarkerType.GROIN)!.y, markerMap.get(MarkerType.GROIN)!.z],
        ];

        try {
            console.log("K-RIG: Invoking Rust skeleton solver...");
            console.log("K-RIG: Markers array:", markersArray);
            const skeleton = await invoke<any>('generate_skeleton_from_markers', { markers: markersArray });
            console.log("K-RIG: Rust returned skeleton:", skeleton);
            console.log("K-RIG: First bone (Hips):", skeleton.bones[0]);

            this.spawnSkeletonFromRust(skeleton);
            return true;
        } catch (err) {
            console.error("K-RIG: Rust skeleton solver failed, falling back to JS:", err);
            // Fallback to JS implementation
            const config = SkeletonFitter.fitBipedSkeleton(markerMap);
            this.spawnSkeletonFromConfig(config);
            return true;
        }
    }

    /**
     * Spawn skeleton from Rust Skeleton structure
     */
    spawnSkeletonFromRust(rustSkeleton: any) {
        this.clearSkeleton();

        const bones: THREE.Bone[] = [];

        // Create bones
        for (const boneData of rustSkeleton.bones) {
            const bone = new THREE.Bone();
            bone.name = boneData.name;
            // Note: Rust returns local_position, not world position
            bone.position.set(
                boneData.local_position[0],
                boneData.local_position[1],
                boneData.local_position[2]
            );
            bone.quaternion.set(
                boneData.local_rotation[0],
                boneData.local_rotation[1],
                boneData.local_rotation[2],
                boneData.local_rotation[3]
            );
            bones.push(bone);
        }

        // Set up hierarchy
        for (let i = 0; i < rustSkeleton.bones.length; i++) {
            const parentIdx = rustSkeleton.bones[i].parent_index;
            if (parentIdx !== null && parentIdx !== undefined) {
                bones[parentIdx].add(bones[i]);
            } else {
                this.stage.scene.add(bones[i]);
            }
        }

        const skeleton = new THREE.Skeleton(bones);
        const helper = new THREE.SkeletonHelper(bones[0]);
        (helper.material as any).linewidth = 3;
        this.stage.scene.add(helper);

        // CRITICAL: Update world matrices before IK chain setup
        // Otherwise getWorldPosition() returns garbage
        bones[0].updateWorldMatrix(true, true);

        // Set up IK chains from Rust data
        for (const ikChain of rustSkeleton.ik_chains) {
            const effectorIdx = ikChain.bone_indices[ikChain.bone_indices.length - 1];
            const effectorBone = bones[effectorIdx];
            this.addIKChain(bones, effectorIdx, effectorBone.name);
        }

        this.bones = bones;
        this.skeleton = skeleton;
        this.helper = helper;

        console.log(`K-RIG: Spawned skeleton with ${bones.length} bones from Rust`);
    }

    addNextMarker(point: THREE.Vector3) {
        const order = [
            MarkerType.HEAD,
            MarkerType.L_WRIST,
            MarkerType.R_WRIST,
            MarkerType.L_ELBOW,
            MarkerType.R_ELBOW,
            MarkerType.L_KNEE,
            MarkerType.R_KNEE,
            MarkerType.GROIN
        ];

        const count = this.markerSystem.markers.size;
        if (count < 8) {
            this.markerSystem.placeMarker(order[count], point);
        }
    }

    spawnSkeletonFromConfig(config: any) {
        this.clearSkeleton();

        const bones: THREE.Bone[] = [];

        config.bones.forEach((bData: any) => {
            const bone = new THREE.Bone();
            bone.name = bData.name;
            bone.position.fromArray(bData.pos);
            bones.push(bone);
        });

        // Hierarchy
        config.bones.forEach((bData: any, i: number) => {
            if (bData.parent !== -1) {
                bones[bData.parent].add(bones[i]);
                // Positions in config are WORLD. Bones need LOCAL.
                const parentWorld = new THREE.Vector3().fromArray(config.bones[bData.parent].pos);
                const myWorld = new THREE.Vector3().fromArray(bData.pos);
                bones[i].position.copy(myWorld.sub(parentWorld));
            } else {
                this.stage.scene.add(bones[i]);
            }
        });

        const skeleton = new THREE.Skeleton(bones);
        const helper = new THREE.SkeletonHelper(bones[0]);
        (helper.material as any).linewidth = 3;
        this.stage.scene.add(helper);

        // CRITICAL: Update world matrices before IK chain setup
        bones[0].updateWorldMatrix(true, true);

        // IK Setup
        config.bones.forEach((bData: any, i: number) => {
            if (bData.isIK) {
                this.addIKChain(bones, i, bData.name);
            }
        });

        this.bones = bones;
        this.skeleton = skeleton;
        this.helper = helper;
    }

    addIKChain(bones: THREE.Bone[], effectorIdx: number, boneName: string) {
        const effector = bones[effectorIdx];
        const middle = effector.parent;
        const root = middle?.parent;

        if (root && middle) {
            const targetGeo = new THREE.OctahedronGeometry(0.1);
            const targetMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc, wireframe: true, depthTest: false });
            const targetMesh = new THREE.Mesh(targetGeo, targetMat);

            const effWorld = new THREE.Vector3();
            effector.getWorldPosition(effWorld);
            targetMesh.position.copy(effWorld);
            targetMesh.userData = { isIKHandle: true, boneName: boneName };

            this.stage.scene.add(targetMesh);
            this.ikTargets.push(targetMesh);
            this.ikChains.push({
                chain: [root, middle, effector],
                targetMesh: targetMesh,
                lengths: [
                    root.position.distanceTo(middle.position),
                    middle.position.distanceTo(effector.position)
                ]
            });
        }
    }
    toggleWeightPaint(active: boolean, boneIndex: number = -1) {
        if (!this.mesh || !(this.mesh instanceof THREE.SkinnedMesh)) return;

        this.isWeightPaintMode = active;
        this.weightBoneIndex = boneIndex;

        if (active) {
            this.originalMaterial = this.mesh.material;
            const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.0 });

            mat.onBeforeCompile = (shader) => {
                shader.uniforms.uBoneIndex = { value: boneIndex };
                shader.vertexShader = `
                    varying float vWeight;
                    uniform float uBoneIndex;
                    ${shader.vertexShader}
                `.replace(
                    '#include <skinning_vertex>',
                    `
                    #include <skinning_vertex>
                    float w = 0.0;
                    if (abs(skinIndex.x - uBoneIndex) < 0.1) w += skinWeight.x;
                    if (abs(skinIndex.y - uBoneIndex) < 0.1) w += skinWeight.y;
                    if (abs(skinIndex.z - uBoneIndex) < 0.1) w += skinWeight.z;
                    if (abs(skinIndex.w - uBoneIndex) < 0.1) w += skinWeight.w;
                    vWeight = w;
                    `
                );

                shader.fragmentShader = `
                    varying float vWeight;
                    ${shader.fragmentShader}
                `.replace(
                    'vec4 diffuseColor = vec4( diffuse, opacity );',
                    `
                    vec3 cold = vec3(0.0, 0.0, 0.5);
                    vec3 hot = vec3(1.0, 0.2, 0.0);
                    vec3 heat = mix(cold, hot, vWeight);
                    vec4 diffuseColor = vec4( heat, opacity );
                    `
                );
                mat.userData.shader = shader;
            };

            this.weightMaterial = mat;
            this.mesh.material = mat;

            if (this.helper) this.helper.visible = false;
            this.ikTargets.forEach(t => t.visible = false);
            this.gizmo.detach();

            // Rebuild hash if needed (in case mesh moved)
            if (!this.spatialHash) {
                this.spatialHash = new VertexSpatialHash(0.1);
                this.spatialHash.build(this.mesh.geometry, this.mesh.matrixWorld);
            }

        } else {
            if (this.originalMaterial) {
                this.mesh.material = this.originalMaterial;
            }
            if (this.helper) this.helper.visible = true;
            this.ikTargets.forEach(t => t.visible = true);
        }
    }

    paintWeights(point: THREE.Vector3, radius: number, intensity: number, subtract: boolean) {
        if (!this.mesh || !(this.mesh instanceof THREE.SkinnedMesh) || !this.spatialHash) return;

        const geo = this.mesh.geometry;
        const posAttr = geo.attributes.position;
        const skinIndex = geo.attributes.skinIndex;
        const skinWeight = geo.attributes.skinWeight;
        const targetBone = this.weightBoneIndex;

        // Use Spatial Hash to get candidate indices
        const candidateIndices = this.spatialHash.query(point, radius);

        let modified = false;

        // Pre-calculate squared radius for faster checks
        const rSq = radius * radius;

        for (const i of candidateIndices) {
            const vx = posAttr.getX(i);
            const vy = posAttr.getY(i);
            const vz = posAttr.getZ(i);

            // Transform vertex to world (approximation, assuming hash is built on world)
            // Actually, spatial hash is built on world coords, so we can compare directly to point
            // BUT we need to be careful if mesh moved.
            // For now, let's assume mesh is static during painting or hash is rebuilt.

            // Wait, posAttr is LOCAL. Hash stores indices based on WORLD at build time.
            // We need to check distance in WORLD space.
            // Let's get world pos of vertex i
            const vWorld = new THREE.Vector3(vx, vy, vz).applyMatrix4(this.mesh.matrixWorld);

            const dSq = vWorld.distanceToSquared(point);

            if (dSq < rSq) {
                const dist = Math.sqrt(dSq);
                const falloff = 1.0 - smoothstep(0, radius, dist);
                const factor = intensity * falloff * (subtract ? -1 : 1);

                const indices = [skinIndex.getX(i), skinIndex.getY(i), skinIndex.getZ(i), skinIndex.getW(i)];
                const weights = [skinWeight.getX(i), skinWeight.getY(i), skinWeight.getZ(i), skinWeight.getW(i)];

                let slot = indices.indexOf(targetBone);

                if (slot === -1) {
                    if (subtract) continue;
                    let minW = 1.0;
                    let minIdx = -1;
                    for (let k = 0; k < 4; k++) {
                        if (weights[k] < minW) { minW = weights[k]; minIdx = k; }
                    }
                    slot = minIdx;
                    indices[slot] = targetBone;
                    skinIndex.setComponent(i, slot, targetBone);
                }

                let newW = weights[slot] + factor;
                newW = Math.max(0, Math.min(1, newW));

                if (newW !== weights[slot]) {
                    weights[slot] = newW;
                    const remaining = 1.0 - newW;
                    let otherSum = 0;
                    for (let k = 0; k < 4; k++) if (k !== slot) otherSum += weights[k];

                    if (otherSum > 0) {
                        const scale = remaining / otherSum;
                        for (let k = 0; k < 4; k++) if (k !== slot) weights[k] *= scale;
                    }
                    skinWeight.setXYZW(i, weights[0], weights[1], weights[2], weights[3]);
                    modified = true;
                }
            }
        }

        if (modified) {
            skinWeight.needsUpdate = true;
            skinIndex.needsUpdate = true;
        }
    }

    updateIK() {
        this.ikChains.forEach(chainData => {
            if (chainData.targetMesh) {
                this.solveFABRIK(chainData.chain, chainData.targetMesh.position);
            }
        });
    }

    private solveFABRIK(chain: THREE.Bone[], targetPos: THREE.Vector3) {
        if (!chain || chain.length < 3) return; // Need at least Root, Joint, Effector

        // FABRIK Algorithm
        const root = chain[0];
        const joint = chain[1];
        const effector = chain[2];

        const target = targetPos.clone();

        // Get current positions
        const p0 = root.getWorldPosition(new THREE.Vector3());
        const p1 = joint.getWorldPosition(new THREE.Vector3());
        const p2 = effector.getWorldPosition(new THREE.Vector3());

        // Lengths
        const l1 = p0.distanceTo(p1);
        const l2 = p1.distanceTo(p2);
        const totalLen = l1 + l2;

        // Distance to target
        const dist = p0.distanceTo(target);

        if (dist > totalLen) {
            // Target is unreachable - stretch
            const dir = target.clone().sub(p0).normalize();

            // We can't easily stretch bones in ThreeJS without scaling, 
            // so we just point them at the target.
            // Simple lookAt approach for unreachable

            // Root looks at target
            this.orientBone(root, target);
            // Joint looks at target
            this.orientBone(joint, target);

        } else {
            // Target is reachable
            let t0 = p0.clone();
            let t1 = p1.clone();
            let t2 = p2.clone();

            // Iterations
            for (let i = 0; i < 10; i++) {
                // FORWARD REACHING
                // Set effector to target
                t2.copy(target);

                // Solve Joint (t1)
                const dir1 = t1.clone().sub(t2).normalize();
                t1.copy(t2.clone().add(dir1.multiplyScalar(l2)));

                // BACKWARD REACHING
                // Set root to original position
                t0.copy(p0);

                // Solve Joint (t1)
                const dir2 = t1.clone().sub(t0).normalize();
                t1.copy(t0.clone().add(dir2.multiplyScalar(l1)));
            }

            // Apply rotations to bones to match solved positions
            // Root needs to point to t1
            this.orientBone(root, t1);

            // Joint needs to point to t2 (target)
            this.orientBone(joint, t2);
        }
    }

    private orientBone(bone: THREE.Bone, target: THREE.Vector3) {
        const bonePos = bone.getWorldPosition(new THREE.Vector3());
        const targetDir = target.clone().sub(bonePos).normalize();

        // Assuming bones point along Y axis (standard for many rigs, but check config)
        // Our config spawns them vertically, so Y is likely the primary axis.
        // However, lookAt usually aligns Z.
        // We need to rotate such that the bone's Y axis points to target.

        // Create a quaternion that rotates Vector3(0,1,0) to targetDir
        const up = new THREE.Vector3(0, 1, 0);
        const q = new THREE.Quaternion().setFromUnitVectors(up, targetDir);

        // Apply to bone. Note: This is world rotation.
        // We need to be careful about local rotation.

        // Simplification: Use lookAt but adjust for bone axis
        // If bone points +Y, we want +Y to face target.
        // ThreeJS lookAt makes +Z face target.

        // Let's use a helper matrix
        const m = new THREE.Matrix4().lookAt(bonePos, target, new THREE.Vector3(0, 0, 1));
        // m aligns -Z to target.

        // Better approach:
        // 1. Convert target to bone's parent space
        const parent = bone.parent;
        if (parent) {
            const localTarget = target.clone().applyMatrix4(parent.matrixWorld.clone().invert());
            const localPos = bone.position.clone();
            const localDir = localTarget.sub(localPos).normalize();

            const qLocal = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), localDir);
            bone.quaternion.copy(qLocal);
            bone.updateMatrixWorld();
        }
    }

    spawnSkeleton(configKey: string) {
        const config = BONE_CONFIGS[configKey];
        if (!config) return;
        this.spawnSkeletonFromConfig(config);
    }

    autoFitSkeleton() {
        if (!this.mesh || !this.skeleton) return;
        // 1. Calculate Mesh Bounds & Volumetric Centers
        const box = new THREE.Box3().setFromObject(this.mesh);
        const center = new THREE.Vector3(); box.getCenter(center);
        const size = new THREE.Vector3(); box.getSize(size);

        // 2. Identify Skeleton Root
        const root = this.bones[0];

        if (root) {
            // 3. Smart Scaling
            const currentCofigHeight = 1.9;
            const meshHeight = size.y;
            const scaleFactor = meshHeight / currentCofigHeight;
            const safeScale = Math.max(0.1, Math.min(10.0, scaleFactor));

            this.bones.forEach(b => {
                b.position.multiplyScalar(safeScale);
            });

            // 4. Align Root
            root.position.x = center.x;
            root.position.z = center.z;

            const hipRatio = 1.0 / 1.9;
            root.position.y = box.min.y + (meshHeight * hipRatio);

            root.updateMatrixWorld(true);
            this.updateIKTargetsFromBones();
        }
    }

    stripSkeleton() {
        if (this.mesh && this.mesh instanceof THREE.SkinnedMesh) {
            const geometry = this.mesh.geometry.clone();
            geometry.deleteAttribute('skinIndex');
            geometry.deleteAttribute('skinWeight');

            const material = new THREE.MeshStandardMaterial({
                color: 0x888888, roughness: 0.5, metalness: 0.5
            });

            const newMesh = new THREE.Mesh(geometry, material);
            newMesh.position.copy(this.mesh.position);
            newMesh.rotation.copy(this.mesh.rotation);
            newMesh.scale.copy(this.mesh.scale);

            // Remove from parent
            if (this.mesh.parent) {
                this.mesh.parent.add(newMesh);
                this.mesh.removeFromParent();
            } else {
                this.stage.scene.add(newMesh);
                this.stage.scene.remove(this.mesh);
            }

            this.mesh = newMesh;
            this.clearSkeleton();
        }
    }



    applyMirror(movedBoneName: string) {
        if (!movedBoneName) return;
        const isLeft = movedBoneName.startsWith('L_') || movedBoneName.endsWith('_l');
        const isRight = movedBoneName.startsWith('R_') || movedBoneName.endsWith('_r');
        if (!isLeft && !isRight) return;

        let targetName = "";
        if (isLeft) targetName = movedBoneName.replace('L_', 'R_').replace('_l', '_r');
        else targetName = movedBoneName.replace('R_', 'L_').replace('_r', '_l');

        const sourceBone = this.bones.find(b => b.name === movedBoneName);
        const targetBone = this.bones.find(b => b.name === targetName);
        if (sourceBone && targetBone) {
            targetBone.position.x = -sourceBone.position.x;
            targetBone.position.y = sourceBone.position.y;
            targetBone.position.z = sourceBone.position.z;
            targetBone.rotation.x = sourceBone.rotation.x;
            targetBone.rotation.y = -sourceBone.rotation.y;
            targetBone.rotation.z = -sourceBone.rotation.z;
            targetBone.updateMatrixWorld();
            this.updateIKTargetsFromBones();
        }
    }

    updateIKTargetsFromBones() {
        this.ikChains.forEach(chain => {
            const effector = chain.chain[chain.chain.length - 1];
            const target = chain.targetMesh;
            const worldPos = new THREE.Vector3();
            effector.getWorldPosition(worldPos);
            target.position.copy(worldPos);
        });
    }



    clearSkeleton() {
        if (this.skeleton) {
            this.bones.forEach(b => {
                if (!b.parent && b.parent === this.stage.scene) {
                    this.stage.scene.remove(b);
                }
            });
        }

        if (this.helper) {
            this.stage.scene.remove(this.helper);
            this.helper = null;
        }

        this.ikTargets.forEach(t => this.stage.scene.remove(t));
        this.ikTargets = [];
        this.ikChains = [];
        this.bones = [];
        this.skeleton = null;
        this.gizmo.detach();
    }

    select(ndc: { x: number, y: number }) {
        this.raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), this.stage.camera);

        const ikHits = this.raycaster.intersectObjects(this.ikTargets);
        if (ikHits.length > 0) {
            const t = ikHits[0].object;
            this.gizmo.attach(t);
            return t;
        }

        let closestBone = null;
        let minDist = 0.2;

        if (this.skeleton && this.helper && this.helper.visible) {
            for (const bone of this.bones) {
                const pos = new THREE.Vector3();
                bone.getWorldPosition(pos);
                pos.project(this.stage.camera);
                const d = new THREE.Vector2(pos.x, pos.y).distanceTo(new THREE.Vector2(ndc.x, ndc.y));
                if (d < minDist) {
                    minDist = d;
                    closestBone = bone;
                }
            }
        }

        if (closestBone) {
            this.gizmo.attach(closestBone);
            return closestBone;
        }

        this.gizmo.detach();
        return null;
    }

    prepareForExport() {
        if (this.helper) this.helper.visible = false;
        this.ikTargets.forEach(t => t.visible = false);
        this.gizmo.detach();

        if (this.isWeightPaintMode && this.originalMaterial && this.mesh) {
            this.mesh.material = this.originalMaterial;
        }
    }

    restoreAfterExport() {
        if (this.isWeightPaintMode && this.weightMaterial && this.mesh) {
            this.mesh.material = this.weightMaterial;
        } else {
            if (this.helper) this.helper.visible = true;
            this.ikTargets.forEach(t => t.visible = true);
        }
    }

    dispose() {
        this.clearSkeleton();
        this.gizmo.dispose();
    }
}

function smoothstep(min: number, max: number, value: number) {
    const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
    return x * x * (3 - 2 * x);
}