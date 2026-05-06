import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createGeometry, generateSuperGreeble, generateHyperGreeble, SHAPES } from './KGreebleEngine';
import { getGreeble3DWasmInterface } from './services/WasmService';

// --- SIMPLEX NOISE IMPLEMENTATION (Ported from GLSL) ---
// Based on Ashima WebGL Noise
function mod289(x: THREE.Vector3): THREE.Vector3;
function mod289(x: THREE.Vector4): THREE.Vector4;
function mod289(x: THREE.Vector3 | THREE.Vector4) {
    if (x instanceof THREE.Vector3) {
        return new THREE.Vector3(
            x.x - Math.floor(x.x * (1.0 / 289.0)) * 289.0,
            x.y - Math.floor(x.y * (1.0 / 289.0)) * 289.0,
            x.z - Math.floor(x.z * (1.0 / 289.0)) * 289.0
        );
    }
    return new THREE.Vector4(
        x.x - Math.floor(x.x * (1.0 / 289.0)) * 289.0,
        x.y - Math.floor(x.y * (1.0 / 289.0)) * 289.0,
        x.z - Math.floor(x.z * (1.0 / 289.0)) * 289.0,
        x.w - Math.floor(x.w * (1.0 / 289.0)) * 289.0
    );
}

const permute = (x: THREE.Vector4) => {
    return mod289(new THREE.Vector4(
        ((x.x * 34.0) + 1.0) * x.x,
        ((x.y * 34.0) + 1.0) * x.y,
        ((x.z * 34.0) + 1.0) * x.z,
        ((x.w * 34.0) + 1.0) * x.w
    ));
}

const taylorInvSqrt = (r: THREE.Vector4) => {
    return new THREE.Vector4(
        1.79284291400159 - 0.85373472095314 * r.x,
        1.79284291400159 - 0.85373472095314 * r.y,
        1.79284291400159 - 0.85373472095314 * r.z,
        1.79284291400159 - 0.85373472095314 * r.w
    );
}

export const snoise = (v: THREE.Vector3) => {
    const C = new THREE.Vector2(1.0 / 6.0, 1.0 / 3.0);
    const D = new THREE.Vector4(0.0, 0.5, 1.0, 2.0);

    // First corner
    let i = new THREE.Vector3(
        Math.floor(v.x + (v.x + v.y + v.z) * C.y),
        Math.floor(v.y + (v.x + v.y + v.z) * C.y),
        Math.floor(v.z + (v.x + v.y + v.z) * C.y)
    );
    
    let x0 = new THREE.Vector3(
        v.x - i.x + (i.x + i.y + i.z) * C.x,
        v.y - i.y + (i.x + i.y + i.z) * C.x,
        v.z - i.z + (i.x + i.y + i.z) * C.x
    );

    // Other corners
    const g = new THREE.Vector3(
        x0.y < x0.x ? 0.0 : 1.0,
        x0.z < x0.y ? 0.0 : 1.0,
        x0.x < x0.z ? 0.0 : 1.0
    ); // step(x0.yzx, x0.xyz)
    
    const l = new THREE.Vector3(1.0 - g.x, 1.0 - g.y, 1.0 - g.z);
    const i1 = new THREE.Vector3(Math.min(g.x, l.z), Math.min(g.y, l.x), Math.min(g.z, l.y));
    const i2 = new THREE.Vector3(Math.max(g.x, l.z), Math.max(g.y, l.x), Math.max(g.z, l.y));

    const x1 = new THREE.Vector3(x0.x - i1.x + C.x, x0.y - i1.y + C.x, x0.z - i1.z + C.x);
    const x2 = new THREE.Vector3(x0.x - i2.x + C.y, x0.y - i2.y + C.y, x0.z - i2.z + C.y);
    const x3 = new THREE.Vector3(x0.x - 1.0 + 3.0 * C.x, x0.y - 1.0 + 3.0 * C.x, x0.z - 1.0 + 3.0 * C.x);

    // Permutations
    i = mod289(i) as THREE.Vector3;
    const p = permute(permute(permute(
        new THREE.Vector4(i.z, i.z + i1.z, i.z + i2.z, i.z + 1.0)
    ).add(new THREE.Vector4(i.y, i.y + i1.y, i.y + i2.y, i.y + 1.0)))
    .add(new THREE.Vector4(i.x, i.x + i1.x, i.x + i2.x, i.x + 1.0)));

    const n_ = 0.142857142857; // 1.0/7.0
    const ns = new THREE.Vector3(n_ * D.w, n_ * D.y, n_ * D.z).sub(new THREE.Vector3(D.x, D.z, D.x)); // D.wyz - D.xzx
    
    // j = p - 49.0 * floor(p * ns.z * ns.z);
    const j = new THREE.Vector4(
        p.x - 49.0 * Math.floor(p.x * ns.z * ns.z),
        p.y - 49.0 * Math.floor(p.y * ns.z * ns.z),
        p.z - 49.0 * Math.floor(p.z * ns.z * ns.z),
        p.w - 49.0 * Math.floor(p.w * ns.z * ns.z)
    );

    const x_ = new THREE.Vector4(Math.floor(j.x * ns.z), Math.floor(j.y * ns.z), Math.floor(j.z * ns.z), Math.floor(j.w * ns.z));
    const y_ = new THREE.Vector4(Math.floor(j.x - 7.0 * x_.x), Math.floor(j.y - 7.0 * x_.y), Math.floor(j.z - 7.0 * x_.z), Math.floor(j.w - 7.0 * x_.w));

    const x = new THREE.Vector4(x_.x * ns.x + ns.y, x_.y * ns.x + ns.y, x_.z * ns.x + ns.y, x_.w * ns.x + ns.y);
    const y = new THREE.Vector4(y_.x * ns.x + ns.y, y_.y * ns.x + ns.y, y_.z * ns.x + ns.y, y_.w * ns.x + ns.y);

    const h = new THREE.Vector4(1.0 - Math.abs(x.x) - Math.abs(y.x), 1.0 - Math.abs(x.y) - Math.abs(y.y), 1.0 - Math.abs(x.z) - Math.abs(y.z), 1.0 - Math.abs(x.w) - Math.abs(y.w));

    const b0 = new THREE.Vector4(x.x, x.y, y.x, y.y);
    const b1 = new THREE.Vector4(x.z, x.w, y.z, y.w);

    const s0 = new THREE.Vector4(Math.floor(b0.x) * 2.0 + 1.0, Math.floor(b0.y) * 2.0 + 1.0, Math.floor(b0.z) * 2.0 + 1.0, Math.floor(b0.w) * 2.0 + 1.0);
    const s1 = new THREE.Vector4(Math.floor(b1.x) * 2.0 + 1.0, Math.floor(b1.y) * 2.0 + 1.0, Math.floor(b1.z) * 2.0 + 1.0, Math.floor(b1.w) * 2.0 + 1.0);

    const sh = new THREE.Vector4(h.x < 0 ? -1 : 0, h.y < 0 ? -1 : 0, h.z < 0 ? -1 : 0, h.w < 0 ? -1 : 0); // -step(h, vec4(0.0))

    const a0_ = new THREE.Vector4(
        b0.x + s0.x * sh.x,
        b0.z + s0.z * sh.x,
        b0.y + s0.y * sh.y,
        b0.w + s0.w * sh.y
    );
    
    // vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
    const a1_ = new THREE.Vector4(
        b1.x + s1.x * sh.z,
        b1.z + s1.z * sh.z,
        b1.y + s1.y * sh.w,
        b1.w + s1.w * sh.w
    );

    const p0 = new THREE.Vector3(a0_.x, a0_.y, h.x);
    const p1 = new THREE.Vector3(a0_.z, a0_.w, h.y);
    const p2 = new THREE.Vector3(a1_.x, a1_.y, h.z);
    const p3 = new THREE.Vector3(a1_.z, a1_.w, h.w);

    const norm = taylorInvSqrt(new THREE.Vector4(p0.lengthSq(), p1.lengthSq(), p2.lengthSq(), p3.lengthSq()));
    
    p0.multiplyScalar(norm.x);
    p1.multiplyScalar(norm.y);
    p2.multiplyScalar(norm.z);
    p3.multiplyScalar(norm.w);

    // vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    const m = new THREE.Vector4(
        Math.max(0.6 - x0.lengthSq(), 0.0),
        Math.max(0.6 - x1.lengthSq(), 0.0),
        Math.max(0.6 - x2.lengthSq(), 0.0),
        Math.max(0.6 - x3.lengthSq(), 0.0)
    );

    // m = m * m;
    const m2 = new THREE.Vector4(m.x * m.x, m.y * m.y, m.z * m.z, m.w * m.w);
    // return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
    
    const finalDot = new THREE.Vector4(
        p0.dot(x0),
        p1.dot(x1),
        p2.dot(x2),
        p3.dot(x3)
    );

    return 42.0 * (m2.x * m2.x * finalDot.x + m2.y * m2.y * finalDot.y + m2.z * m2.z * finalDot.z + m2.w * m2.w * finalDot.w);
}


/**
 * Handles the logic for spawning procedural objects at a specific point/normal.
 * Encapsulates the complex shape generation logic (City, Tentacle, etc).
 */
export const spawnMeshAtPosition = (
    point: THREE.Vector3,
    normal: THREE.Vector3,
    type: string,
    material: THREE.Material,
    userImports: any[],
    greebleParams?: any,
    primitiveParams?: any
): THREE.Group | null => {
    const container = new THREE.Group();
    container.userData.isContainer = true;
    container.position.copy(point);
    const up = new THREE.Vector3(0, 1, 0);
    container.quaternion.setFromUnitVectors(up, normal);

    // --- INFINITE SHAPES OVERRIDE (PRIMITIVES) ---
    if (primitiveParams && primitiveParams.infiniteShapes) {
         const segments = primitiveParams.shapeSegments || 12;
         const distortion = primitiveParams.distortion || 0;
         
         const radius = 0.5;
         const vertices: THREE.Vector2[] = [];
         const safeSegments = Math.max(3, segments);
         const angleStep = (Math.PI * 2) / safeSegments;

         for (let i = 0; i < safeSegments; i++) {
             const currentAngle = i * angleStep;
             let modRadius = radius;
             if (segments > 12) {
                 if (i % 2 === 0) modRadius *= 0.8; 
                 if (i % 6 === 0) modRadius *= 1.2;
             }
             const irregularity = (Math.random() - 0.5) * 2 * distortion;
             const finalRadius = modRadius + (irregularity * radius * 0.5);
             const x = Math.cos(currentAngle) * finalRadius;
             const y = Math.sin(currentAngle) * finalRadius;
             vertices.push(new THREE.Vector2(x, y));
         }
         const shape = new THREE.Shape(vertices);
         const extrudeSettings = { depth: 0.2 + Math.random()*0.5, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2 };
         const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
         geometry.center();
         
         const mesh = new THREE.Mesh(geometry, material);
         mesh.castShadow = true;
         mesh.receiveShadow = true;
         container.add(mesh);
         
         container.scale.set(0.1, 0.1, 0.1);
         return container;
    }

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
        if (greebleParams) {
             const greeble = generateHyperGreeble(material, greebleParams, userImports);
             greeble.scale.set(0.2, 0.2, 0.2); 
             container.add(greeble);
        } else {
            const greeble = generateSuperGreeble(material);
            greeble.scale.set(0.5, 0.5, 0.5);
            container.add(greeble);
        }
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
 * Merges and welds the scene geometry for a clean export.
 * Collapses InstancedMesh, applies transforms, and fuses vertices.
 */
export const weldScene = (scene: THREE.Group): THREE.Group => {
    const meshesByMaterial = new Map<string, { material: THREE.Material, geometries: THREE.BufferGeometry[] }>();

    scene.updateMatrixWorld(true);

    scene.traverse((child: any) => {
        if (child.isMesh || child.isInstancedMesh) {
            // Skip invisible or helper objects if needed (though export usually wants everything)
            if (!child.visible) return;

            const material = Array.isArray(child.material) ? child.material[0] : child.material;
            const matUuid = material.uuid;

            if (!meshesByMaterial.has(matUuid)) {
                meshesByMaterial.set(matUuid, { material: material, geometries: [] });
            }
            const bucket = meshesByMaterial.get(matUuid)!;

            if (child.isInstancedMesh) {
                const imesh = child as THREE.InstancedMesh;
                const tempMatrix = new THREE.Matrix4();
                
                for (let i = 0; i < imesh.count; i++) {
                    imesh.getMatrixAt(i, tempMatrix);
                    // Combine instance matrix with world matrix of the InstancedMesh
                    const finalMatrix = tempMatrix.clone().premultiply(imesh.matrixWorld);
                    
                    const geom = child.geometry.clone();
                    geom.applyMatrix4(finalMatrix);
                    bucket.geometries.push(geom);
                }
            } else {
                const geom = child.geometry.clone();
                geom.applyMatrix4(child.matrixWorld);
                bucket.geometries.push(geom);
            }
        }
    });

    const weldedGroup = new THREE.Group();
    weldedGroup.name = "Welded_Export";

    meshesByMaterial.forEach((bucket, uuid) => {
        if (bucket.geometries.length > 0) {
            try {
                // 1. Merge all geometries sharing this material
                const merged = BufferGeometryUtils.mergeGeometries(bucket.geometries, false);
                
                // 2. Weld vertices (remove duplicates)
                // Default tolerance is usually fine, but let's be explicit if needed. Default is usually epsilon.
                const welded = BufferGeometryUtils.mergeVertices(merged);
                
                // 3. Create Mesh
                const mesh = new THREE.Mesh(welded, bucket.material);
                mesh.name = `Merged_${bucket.material.name || 'Material'}_${uuid.slice(0,4)}`;
                weldedGroup.add(mesh);

                // Cleanup source geometries
                bucket.geometries.forEach(g => g.dispose());
            } catch (e) {
                console.error("Failed to weld geometry group", e);
            }
        }
    });

    return weldedGroup;
};

/**
 * Clones the scene and removes helper objects (like the base plane) for export.
 * ALSO BAKES FLUX SHADER DEFORMATIONS INTO GEOMETRY
 */
export const prepareSceneForExport = (rootGroup: THREE.Group, includeBase: boolean, selectionBox?: THREE.BoxHelper, weld: boolean = false) => {
    if (selectionBox) selectionBox.visible = false;
    
    // Ensure names for export tracking
    rootGroup.traverse((c: any) => {
        if ((c.userData && c.userData.isContainer) || c.isMesh) {
            c.name = c.uuid;
        }
    });

    let sceneToExport = rootGroup.clone();

    // --- FLUX BAKING ---
    sceneToExport.traverse((child: any) => {
        // Check for Flux Material (Original Shared Material)
        // Add defensive checks for userData
        if (child.isMesh && child.material && child.material.userData && child.material.userData.isFlux) {
            
            const fluxState = child.material.userData.fluxState;
            const uniforms = child.material.uniforms;
            
            if (fluxState && uniforms) {
                const chaos = fluxState.chaos;
                const time = uniforms.time.value;
                const colorAObj = new THREE.Color(fluxState.colorA);
                const colorBObj = new THREE.Color(fluxState.colorB);
                const type = fluxState.type || 'standard';

                // Bake Displacement
                const geometry = child.geometry.clone();
                const posAttr = geometry.attributes.position;
                const normalAttr = geometry.attributes.normal;
                const uvAttr = geometry.attributes.uv;
                
                // Create color attribute for vertex coloring
                const count = posAttr.count;
                const colors = new Float32Array(count * 3);
                
                const tempPos = new THREE.Vector3();
                const tempNormal = new THREE.Vector3();

                // 0. WASM OPTIMIZATION (Noise Pre-calculation)
                // If we are doing 'standard' or 'liquid' or 'plasma', we use simplex noise.
                // We can pre-fill the noise buffer using WASM to avoid snoise() per vertex.
                let noiseBuffer: Float32Array | null = null;
                const wasm = getGreeble3DWasmInterface();
                if (wasm && wasm.noiseGeneratorInstance && (type === 'standard' || type === 'liquid' || type === 'plasma')) {
                    noiseBuffer = new Float32Array(count);
                    // Rust impl uses: z * scale + time
                    // TS legacy uses: tempPos * 2.0 + time * 0.5
                    // We map: scale = 2.0, time = time * 0.5
                    wasm.noiseGeneratorInstance.fill_noise_buffer(
                        posAttr.array,
                        noiseBuffer,
                        2.0,
                        time * 0.5
                    );
                }
                
                for (let i = 0; i < count; i++) {
                    tempPos.fromBufferAttribute(posAttr, i);
                    tempNormal.fromBufferAttribute(normalAttr, i);
                    
                    let displacement = 0;
                    let mixFactor = 0;

                    // --- CPU REPLICATION OF GLSL SHADERS ---
                    if (type === 'hologram') {
                        // Jitter
                        const jitter = (Math.sin(time * 20.0 + tempPos.y * 10.0) > 0.95 ? 1 : 0) * chaos * 0.1;
                        tempPos.x += jitter;
                        displacement = jitter;
                        mixFactor = displacement * 5.0; // Estimate
                    } else if (type === 'glitch') {
                         // Quantize
                         const q = 5.0 + (1.0 - chaos) * 20.0;
                         const qPos = tempPos.clone().multiplyScalar(q).floor().divideScalar(q);
                         const noise = snoise(qPos.multiplyScalar(2.0).addScalar(time * 5.0));
                         const spike = (noise > 0.8 ? 1 : 0) * chaos * 0.5;
                         tempPos.add(tempNormal.clone().multiplyScalar(spike));
                         displacement = spike;
                         mixFactor = spike * 5.0;
                    } else {
                        // Standard / Liquid / Plasma (Simplex approximation)
                        let noise;
                        if (noiseBuffer) {
                            noise = noiseBuffer[i];
                        } else {
                            const noisePos = tempPos.clone().multiplyScalar(2.0).addScalar(time * 0.5);
                            noise = snoise(noisePos);
                        }
                        displacement = noise * chaos;
                        tempPos.add(tempNormal.clone().multiplyScalar(displacement));
                        mixFactor = displacement * 2.0 + 0.5;
                    }

                    posAttr.setXYZ(i, tempPos.x, tempPos.y, tempPos.z);
                    
                    // Bake Color
                    const finalColor = new THREE.Color().lerpColors(colorBObj, colorAObj, THREE.MathUtils.clamp(mixFactor, 0, 1));
                    
                    // Grid/Pattern overlay (Standard/Holo only)
                    if (uvAttr && (type === 'standard' || type === 'hologram')) {
                         const u = uvAttr.getX(i) * 20.0;
                         const v = uvAttr.getY(i) * 20.0;
                         const grid = (u % 1 > 0.95 || v % 1 > 0.95) ? 1.0 : 0.0;
                         if (grid > 0.5) {
                             finalColor.lerp(new THREE.Color(1, 1, 1), chaos * 0.5);
                         }
                    }
                    
                    colors[i * 3] = finalColor.r;
                    colors[i * 3 + 1] = finalColor.g;
                    colors[i * 3 + 2] = finalColor.b;
                }
                
                geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
                child.geometry = geometry;
                
                // Replace ShaderMaterial with StandardMaterial that uses Vertex Colors
                const bakedMat = new THREE.MeshStandardMaterial({
                    vertexColors: true,
                    roughness: 0.4,
                    metalness: 0.6,
                    side: THREE.DoubleSide
                });
                child.material = bakedMat;
            }
        }
    });


    if (!includeBase) {
        const toRemove: any[] = [];
        sceneToExport.traverse((child: any) => {
            if (child.userData && child.userData.isDefaultBase) {
                toRemove.push(child);
            }
        });
        toRemove.forEach((c: any) => {
            if (c.parent) c.parent.remove(c);
        });
    }

    // --- APPLY WELDING IF REQUESTED ---
    if (weld) {
        sceneToExport = weldScene(sceneToExport);
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
