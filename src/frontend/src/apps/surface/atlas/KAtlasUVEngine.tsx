import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
// @ts-ignore
// import XAtlasLoader from 'xatlas-three';

// --- KIPP UTILS: HIGH-FIDELITY UV GRID ---
export const createKippUVGrid = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.Texture();

    // Base Dark
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, 1024, 1024);

    const tiles = 8;
    const size = 1024 / tiles;

    for (let y = 0; y < tiles; y++) {
        for (let x = 0; x < tiles; x++) {
            const isDark = (x + y) % 2 === 0;
            ctx.fillStyle = isDark ? '#1a1a1a' : '#252525';
            ctx.fillRect(x * size, y * size, size, size);

            ctx.strokeStyle = '#333333';
            ctx.lineWidth = 2;
            ctx.strokeRect(x * size, y * size, size, size);

            ctx.fillStyle = isDark ? '#00b894' : '#ffffff';
            ctx.font = 'bold 24px monospace';
            ctx.fillText(`${x},${y}`, x * size + 20, y * size + 40);

            ctx.strokeStyle = isDark ? '#00b894' : '#ffffff';
            ctx.beginPath();
            ctx.moveTo(x * size + 20, y * size + 80);
            ctx.lineTo(x * size + 80, y * size + 80);
            ctx.moveTo(x * size + 20, y * size + 80);
            ctx.lineTo(x * size + 20, y * size + 20);
            ctx.stroke();
        }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 4;
    return tex;
};

export interface ProjectionConfig {
    projection: string;
    targetAxis: string; // 'X', 'Y', 'Z'
    coordSpace: string; // 'LOCAL', 'WORLD'
    scale: number;
    stretchU: number;
    stretchV: number;
    rotation: number;
    offsetU: number;
    offsetV: number;
    jitter: number;
    camera: THREE.Camera;
}

// --- THE CORE ALGORITHM ---
export const applyUVProjection = (
    mesh: THREE.Mesh,
    originalGeo: THREE.BufferGeometry,
    config: ProjectionConfig
): number => {

    const geo = mesh.geometry;
    const pos = geo.attributes.position;

    // RESTORE ORIGINAL UVs
    if (config.projection === 'ORIGINAL') {
        if (originalGeo && originalGeo.attributes.uv) {
            geo.setAttribute('uv', originalGeo.attributes.uv.clone());
            geo.attributes.uv.needsUpdate = true;
        }
        return pos.count;
    }

    // CALCULATE NEW UVs
    const norm = geo.attributes.normal;
    const uvs = new Float32Array(pos.count * 2);

    const rotRad = (config.rotation * Math.PI) / 180;
    const cosR = Math.cos(rotRad);
    const sinR = Math.sin(rotRad);

    // World Matrix for WORLD space projection
    const worldMat = mesh.matrixWorld;
    const vec = new THREE.Vector3();

    for (let i = 0; i < pos.count; i++) {
        // Get Coordinate
        let x, y, z;
        let nx, ny, nz;

        if (config.coordSpace === 'WORLD') {
            vec.set(pos.getX(i), pos.getY(i), pos.getZ(i));
            vec.applyMatrix4(worldMat);
            x = vec.x; y = vec.y; z = vec.z;

            vec.set(norm.getX(i), norm.getY(i), norm.getZ(i));
            vec.transformDirection(worldMat); // Rotate normal only
            nx = Math.abs(vec.x); ny = Math.abs(vec.y); nz = Math.abs(vec.z);
        } else {
            x = pos.getX(i); y = pos.getY(i); z = pos.getZ(i);
            nx = Math.abs(norm.getX(i)); ny = Math.abs(norm.getY(i)); nz = Math.abs(norm.getZ(i));
        }

        let u = 0, v = 0;

        if (config.projection === 'BOX') {
            if (nx >= ny && nx >= nz) { u = z; v = y; }
            else if (ny >= nx && ny >= nz) { u = x; v = z; }
            else { u = x; v = y; }
        }
        else if (config.projection === 'SPHERICAL') {
            const r = Math.sqrt(x * x + y * y + z * z);
            u = Math.atan2(x, z) / (Math.PI * 2) + 0.5;
            v = Math.asin(y / r) / Math.PI + 0.5;
        }
        else if (config.projection === 'CYLINDRICAL') {
            let angle, height;
            if (config.targetAxis === 'Y') { angle = Math.atan2(x, z); height = y; }
            else if (config.targetAxis === 'X') { angle = Math.atan2(y, z); height = x; }
            else { angle = Math.atan2(x, y); height = z; }
            u = angle / (2 * Math.PI) + 0.5;
            v = height;
        }
        else if (config.projection === 'PLANAR_AXIS') {
            if (config.targetAxis === 'X') { u = z; v = y; }
            else if (config.targetAxis === 'Y') { u = x; v = z; }
            else { u = x; v = y; }
        }
        else if (config.projection === 'CAMERA_VIEW') {
            vec.set(x, y, z);
            if (config.coordSpace === 'LOCAL') vec.applyMatrix4(worldMat); // Project needs world
            vec.project(config.camera);
            u = vec.x * 0.5 + 0.5;
            v = vec.y * 0.5 + 0.5;
        }
        else if (config.projection === 'NORMAL_FRACTURE') {
            u = x + (config.coordSpace === 'WORLD' ? vec.x : norm.getX(i));
            v = y + (config.coordSpace === 'WORLD' ? vec.y : norm.getY(i));
        }

        // Stack Modifiers
        u *= config.scale; v *= config.scale;
        u *= config.stretchU; v *= config.stretchV;
        const uC = u; const vC = v;
        u = (uC * cosR - vC * sinR); v = (uC * sinR + vC * cosR);
        u += config.offsetU; v += config.offsetV;

        // JITTER (Experimental)
        if (config.jitter > 0) {
            u += (Math.random() - 0.5) * config.jitter;
            v += (Math.random() - 0.5) * config.jitter;
        }

        uvs[i * 2] = u;
        uvs[i * 2 + 1] = v;
    }

    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.attributes.uv.needsUpdate = true;

    return pos.count;
};

// --- LSCM SOLVER (XATLAS) ---
export interface LSCMConfig {
    maxIterations: number;
    padding: number;
    texelsPerUnit: number;
    resolution: number;
}

// --- LSCM SOLVER (XATLAS) ---
// --- LSCM SOLVER (XATLAS MANUAL INTEGRATION) ---
// --- LSCM SOLVER (CUSTOM K_OS IMPLEMENTATION) ---
import { applyKAtlasLSCM } from './KAtlasLSCM';

export const applyLSCM = async (mesh: THREE.Mesh, config: LSCMConfig): Promise<number> => {
    try {
        console.log("Initializing K-LSCM Solver (Native Mode)...");

        // 1. Pre-process: Pass raw mesh to solver
        // KAtlasLSCM ("The Honey Badger") now handles all welding & sanitation internally.
        // We skip the redundant pre-weld here to save time.
        console.log("KAtlas: Handing off mesh to LSCM Core...");

        // 2. Run Custom Solver
        // We pass the mesh directly. KAtlasLSCM modifies it in place.
        const result = await applyKAtlasLSCM(mesh, {
            maxIterations: config.maxIterations
        });

        console.log(`K-LSCM Success: ${result.vertCount} verts in ${result.time.toFixed(2)}ms`);
        return result.vertCount;

    } catch (e) {
        console.error("LSCM Error:", e);
        throw e;
    }
};
