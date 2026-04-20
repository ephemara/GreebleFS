
import * as THREE from 'three';
import { createGeometry, generateSuperGreeble, SHAPES } from './KGreebleEngine';

/**
 * Handles the logic for spawning procedural objects at a specific point/normal.
 * Encapsulates the complex shape generation logic (City, Tentacle, etc).
 */
export const spawnMeshAtPosition = (
    point: THREE.Vector3,
    normal: THREE.Vector3,
    type: string,
    material: THREE.Material,
    userImports: any[]
): THREE.Group | null => {
    const container = new THREE.Group();
    container.userData.isContainer = true;
    container.position.copy(point);
    const up = new THREE.Vector3(0, 1, 0);
    container.quaternion.setFromUnitVectors(up, normal);

    // Handle User Imports (GLB/OBJ from Kernel)
    if (type.startsWith('import_')) {
        const importData = userImports.find(u => u.id === type);
        if (importData) {
            const clone = importData.scene.clone(true);
            clone.traverse((child: any) => {
                if (child.isMesh) {
                    // Only override if no material exists, otherwise respect source
                    if (!child.material) {
                        child.material = material;
                    } else {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                }
            });
            container.add(clone);
        }
    }
    // Handle Complex Procedural Shapes
    else if (type === SHAPES.GREEBLE) {
        const greeble = generateSuperGreeble(material);
        greeble.scale.set(0.5, 0.5, 0.5);
        container.add(greeble);
    }
    else if (type === SHAPES.TENTACLE) {
        for (let i = 0; i < 8; i++) {
            const m = new THREE.Mesh(new THREE.SphereGeometry((1.0 - i / 8) * 0.3, 32, 32), material);
            m.position.set(Math.sin(i * 0.5) * 0.2, i * 0.4 + 0.15, Math.cos(i * 0.5) * 0.2);
            m.castShadow = true; m.receiveShadow = true; container.add(m);
        }
    }
    else if (type === SHAPES.SWARM) {
        for (let i = 0; i < 12; i++) {
            const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.15, 1), material);
            m.position.set((Math.random() - 0.5) * 2.5, (Math.random() * 2.0) + 0.5, (Math.random() - 0.5) * 2.5);
            m.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
            m.castShadow = true; m.receiveShadow = true; container.add(m);
        }
    }
    else if (type === SHAPES.CHAIN) {
        for (let i = 0; i < 6; i++) {
            const m = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 16, 32), material);
            m.position.y = (i * 0.3) * -1;
            if (i % 2 === 0) m.rotateY(Math.PI / 2);
            m.castShadow = true; m.receiveShadow = true; container.add(m);
        }
    }
    else if (type === SHAPES.GEAR) {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.2, 32, 4), material);
        m.position.y = 0.1; m.castShadow = true; container.add(m);
        container.add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 32, 4), material).translateY(0.15));
    }
    else if (type === SHAPES.FLORA) {
        for (let i = 0; i < 4; i++) {
            const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.8, 8, 16), material);
            m.position.set((Math.random() - 0.5) * 0.5, 0.4, (Math.random() - 0.5) * 0.5);
            m.rotation.set((Math.random() - 0.5), 0, (Math.random() - 0.5));
            m.castShadow = true; container.add(m);
        }
    }
    else if (type === SHAPES.SPINE) {
        for (let i = 0; i < 8; i++) {
            const m = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.4), material);
            m.position.y = i * 0.25; m.rotation.y = i * 0.2;
            m.castShadow = true; m.receiveShadow = true; container.add(m);
        }
    }
    else if (type === SHAPES.RUINS) {
        for (let i = 0; i < 4; i++) {
            const m = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.8, 0.4, 4, 8, 4), material);
            m.position.set((Math.random() - 0.5) * 1.5, 0.4, (Math.random() - 0.5) * 1.5);
            m.rotation.set((Math.random() - 0.5) * 0.5, Math.random(), (Math.random() - 0.5) * 0.5);
            m.castShadow = true; container.add(m);
        }
    }
    else if (type === SHAPES.STRUCT) {
        [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]].forEach(([x, z]) => {
            const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2, 0.1), material);
            b.position.set(x, 1, z); b.castShadow = true; container.add(b);
        });
        container.add(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.1), material).translateY(1));
    }
    else if (type === SHAPES.CITY) {
        for (let i = 0; i < 8; i++) {
            const h = 0.5 + Math.random();
            const m = new THREE.Mesh(new THREE.BoxGeometry(0.2, h, 0.2, 2, 8, 2), material);
            m.position.set((Math.random() - 0.5) * 1.2, h / 2, (Math.random() - 0.5) * 1.2);
            m.castShadow = true; container.add(m);
        }
    }
    else if (type === SHAPES.FRACTAL) {
        const spawn = (p: any, s: any, d: any) => {
            if (d === 0) return;
            const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s, 4, 4, 4), material);
            m.position.copy(p); m.castShadow = true; container.add(m);
            const o = s * 0.75;
            spawn(new THREE.Vector3(p.x + o, p.y + o, p.z), s * 0.5, d - 1);
            spawn(new THREE.Vector3(p.x - o, p.y + o, p.z), s * 0.5, d - 1);
            spawn(new THREE.Vector3(p.x, p.y + o, p.z + o), s * 0.5, d - 1);
            spawn(new THREE.Vector3(p.x, p.y + o, p.z - o), s * 0.5, d - 1);
        };
        spawn(new THREE.Vector3(0, 0.25, 0), 0.5, 2);
    }
    // Standard Primitive
    else {
        const m = new THREE.Mesh(createGeometry(type), material);
        m.castShadow = true; m.receiveShadow = true;
        container.add(m);
    }

    container.scale.set(0.1, 0.1, 0.1);
    return container;
};

/**
 * Converts keyframe data into THREE.AnimationClip for export.
 */
export const generateAnimationClips = (keyframes: any, rootNameMap: any) => {
    const tracks: any[] = [];
    Object.keys(keyframes).forEach(uuid => {
        const keys = keyframes[uuid];
        if (!keys || keys.length === 0) return;
        
        const nodeName = rootNameMap.get(uuid);
        if (!nodeName) return;

        const sortedKeys = [...keys].sort((a: any, b: any) => a.t - b.t);
        const times = sortedKeys.map((k: any) => k.t);
        
        const pos: any[] = [];
        const rot: any[] = [];
        const scl: any[] = [];

        sortedKeys.forEach((k: any) => {
            pos.push(k.p.x, k.p.y, k.p.z);
            rot.push(k.q.x, k.q.y, k.q.z, k.q.w);
            scl.push(k.s.x, k.s.y, k.s.z);
        });

        if (pos.length) tracks.push(new THREE.VectorKeyframeTrack(`${nodeName}.position`, times, pos));
        if (rot.length) tracks.push(new THREE.QuaternionKeyframeTrack(`${nodeName}.quaternion`, times, rot));
        if (scl.length) tracks.push(new THREE.VectorKeyframeTrack(`${nodeName}.scale`, times, scl));
    });

    if (tracks.length === 0) return [];
    return [new THREE.AnimationClip('Greeble_Action', -1, tracks)];
};

/**
 * Clones the scene and removes helper objects (like the base plane) for export.
 */
export const prepareSceneForExport = (rootGroup: THREE.Group, includeBase: boolean, selectionBox?: THREE.BoxHelper) => {
    if (selectionBox) selectionBox.visible = false;
    
    // Ensure names for export tracking
    rootGroup.traverse((c: any) => {
        if (c.userData.isContainer || c.isMesh) {
            c.name = c.uuid;
        }
    });

    const sceneToExport = rootGroup.clone();

    if (!includeBase) {
        const toRemove: any[] = [];
        sceneToExport.traverse((child: any) => {
            if (child.userData.isDefaultBase) {
                toRemove.push(child);
            }
        });
        toRemove.forEach((c: any) => {
            if (c.parent) c.parent.remove(c);
        });
    }

    return sceneToExport;
};

export const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
};