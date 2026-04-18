import * as THREE from 'three';

export interface BakeRange {
    name: string;
    start: number;
    end: number;
}

export interface BakeOptions {
    duration: number;
    fps?: number;
    ranges?: BakeRange[]; // If provided, splits animation into multiple clips (Split Chain)
    mode?: 'INSTANCED' | 'SEPARATED'; // SEPARATED = Explodes InstancedMesh into individual Meshes
    targets?: THREE.Object3D[]; // Optional: restrict to specific objects
}

export interface BakeResult {
    scene: THREE.Scene; // The new scene ready for export (with exploded meshes)
    animations: THREE.AnimationClip[];
}

/**
 * Advanced Animation Baker
 * Ported from K-Cloner engine. Handles:
 * 1. Simulation stepping
 * 2. InstancedMesh -> Mesh explosion (for individual animation)
 * 3. Clip splitting (Chains)
 */
export const bakeAnimation = async (
    sourceRoot: THREE.Object3D,
    onUpdate: (time: number) => void,
    options: BakeOptions
): Promise<BakeResult> => {
    const { 
        duration, 
        fps = 30, 
        ranges = [], 
        mode = 'SEPARATED' 
    } = options;

    const totalFrames = Math.floor(duration * fps);
    const times: number[] = [];
    
    // 1. Prepare Export Scene
    const exportScene = new THREE.Scene();
    
    // Map to link Source Objects -> Export Objects
    // If Mode is SEPARATED: Source(InstancedMesh) -> [ExportMesh_0, ExportMesh_1, ...]
    // If Mode is INSTANCED: Source(Obj) -> [ExportObj]
    const objectMap = new Map<THREE.Object3D, THREE.Object3D[]>();
    
    // Data stores for tracks: Map<ExportUUID, { p: [], q: [], s: [] }>
    const tracksMap = new Map<string, { p: number[], q: number[], s: number[] }>();

    // 2. Scene Traversal & Explosion
    sourceRoot.updateMatrixWorld(true);
    
    sourceRoot.traverse((child) => {
        if (child.userData.skipBake) return; // Allow opting out

        if (child instanceof THREE.InstancedMesh && mode === 'SEPARATED') {
            // EXPLOSION LOGIC
            const count = child.count;
            const originalGeo = child.geometry.clone();
            const originalMat = Array.isArray(child.material) 
                ? child.material.map(m => m.clone()) 
                : child.material.clone();

            const instances: THREE.Mesh[] = [];
            const tempMatrix = new THREE.Matrix4();

            for (let i = 0; i < count; i++) {
                const clone = new THREE.Mesh(originalGeo, originalMat);
                clone.name = `${child.name}_${i}`;
                
                // Copy initial transform
                child.getMatrixAt(i, tempMatrix);
                tempMatrix.decompose(clone.position, clone.quaternion, clone.scale);
                
                exportScene.add(clone);
                instances.push(clone);
                
                // Initialize track data
                tracksMap.set(clone.uuid, { p: [], q: [], s: [] });
            }
            
            objectMap.set(child, instances);
        } else if (child instanceof THREE.Mesh || child instanceof THREE.Group || child instanceof THREE.Object3D) {
            // STANDARD CLONE LOGIC
            // We only clone if it's not the root itself (unless root is mesh)
            if (child !== sourceRoot || (child instanceof THREE.Mesh)) {
                const clone = child.clone(false); // Shallow clone
                exportScene.add(clone);
                
                // If we are keeping instances, we just track the mesh itself
                objectMap.set(child, [clone]);
                tracksMap.set(clone.uuid, { p: [], q: [], s: [] });
            }
        }
    });

    // 3. Baking Loop
    const dummy = new THREE.Object3D(); // Helper for matrix decomposition

    for (let f = 0; f <= totalFrames; f++) {
        const time = f / fps;
        times.push(time);

        // A. Run Simulation
        onUpdate(time);
        
        // B. Sync Transforms & Record
        sourceRoot.updateMatrixWorld(true);

        objectMap.forEach((exportObjects, sourceObject) => {
            if (sourceObject instanceof THREE.InstancedMesh && mode === 'SEPARATED') {
                // Sync Instances
                for (let i = 0; i < exportObjects.length; i++) {
                    const target = exportObjects[i];
                    
                    // Extract matrix from source instance i
                    sourceObject.getMatrixAt(i, dummy.matrix);
                    dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
                    
                    // Apply to target
                    target.position.copy(dummy.position);
                    target.quaternion.copy(dummy.quaternion);
                    target.scale.copy(dummy.scale);
                    
                    // Record
                    const data = tracksMap.get(target.uuid);
                    if (data) {
                        data.p.push(target.position.x, target.position.y, target.position.z);
                        data.q.push(target.quaternion.x, target.quaternion.y, target.quaternion.z, target.quaternion.w);
                        data.s.push(target.scale.x, target.scale.y, target.scale.z);
                    }
                }
            } else {
                // Sync Standard Object
                const target = exportObjects[0];
                target.position.copy(sourceObject.position);
                target.quaternion.copy(sourceObject.quaternion);
                target.scale.copy(sourceObject.scale);
                
                const data = tracksMap.get(target.uuid);
                if (data) {
                    data.p.push(target.position.x, target.position.y, target.position.z);
                    data.q.push(target.quaternion.x, target.quaternion.y, target.quaternion.z, target.quaternion.w);
                    data.s.push(target.scale.x, target.scale.y, target.scale.z);
                }
            }
        });

        // Yield to UI every 10 frames to prevent freeze
        if (f % 10 === 0) await new Promise(r => setTimeout(r, 0));
    }

    // 4. Generate Clips
    const clips: THREE.AnimationClip[] = [];

    // Helper to build tracks for a specific time range
    const buildTracks = (startT: number, endT: number): THREE.KeyframeTrack[] => {
        const tracks: THREE.KeyframeTrack[] = [];
        
        // Find indices in global time array
        let startIdx = times.findIndex(t => t >= startT);
        let endIdx = times.findIndex(t => t > endT);
        if (startIdx === -1) startIdx = 0;
        if (endIdx === -1) endIdx = times.length;

        const sliceTimes = times.slice(startIdx, endIdx).map(t => t - startT); // Normalize time to 0

        tracksMap.forEach((data, uuid) => {
            // Find the object name in the export scene
            let objName = '';
            exportScene.traverse(c => { if(c.uuid === uuid) objName = c.name || uuid; });
            if (!objName) return;

            // Slice data
            const pSlice = data.p.slice(startIdx * 3, endIdx * 3);
            const qSlice = data.q.slice(startIdx * 4, endIdx * 4);
            const sSlice = data.s.slice(startIdx * 3, endIdx * 3);

            if (pSlice.length) tracks.push(new THREE.VectorKeyframeTrack(`${objName}.position`, sliceTimes, pSlice));
            if (qSlice.length) tracks.push(new THREE.QuaternionKeyframeTrack(`${objName}.quaternion`, sliceTimes, qSlice));
            if (sSlice.length) tracks.push(new THREE.VectorKeyframeTrack(`${objName}.scale`, sliceTimes, sSlice));
        });

        return tracks;
    };

    if (ranges && ranges.length > 0) {
        // SPLIT CHAINS
        for (const range of ranges) {
            const tracks = buildTracks(range.start, range.end);
            if (tracks.length > 0) {
                const duration = range.end - range.start;
                clips.push(new THREE.AnimationClip(range.name, duration, tracks));
            }
        }
    } else {
        // SINGLE CLIP
        const tracks = buildTracks(0, duration);
        if (tracks.length > 0) {
            clips.push(new THREE.AnimationClip('Animation', duration, tracks));
        }
    }

    return { scene: exportScene, animations: clips };
};