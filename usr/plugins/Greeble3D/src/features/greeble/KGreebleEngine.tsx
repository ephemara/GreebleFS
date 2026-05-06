
import * as THREE from 'three';
import { createSupershapeWasm } from './services/WasmService';

// --- TITAN PROTOCOL MATH ---

// 1. The Superformula (2D Profile Generator)
// r = (|1/a * cos(m/4 * phi)|^n2 + |1/b * sin(m/4 * phi)|^n3)^(-1/n1)
const superformula = (phi: number, a: number, b: number, m: number, n1: number, n2: number, n3: number) => {
    const t1 = Math.abs((1 / a) * Math.cos((m * phi) / 4));
    const t2 = Math.abs((1 / b) * Math.sin((m * phi) / 4));
    return Math.pow(Math.pow(t1, n2) + Math.pow(t2, n3), -1 / n1);
};

// 2. 3D Supershape Generator (Spherical Product)
export const createSupershapeGeometry = (params: any) => {
    // Phase 1: Try WASM implementation for performance and IP protection
    try {
        const wasmResult = createSupershapeWasm(params);
        if (wasmResult) {
            const bufferGeo = new THREE.BufferGeometry();
            bufferGeo.setAttribute('position', new THREE.Float32BufferAttribute(wasmResult.positions, 3));
            bufferGeo.setAttribute('uv', new THREE.Float32BufferAttribute(wasmResult.uvs, 2));

            // Handle indices (Uint32Array from WASM)
            bufferGeo.setIndex(Array.from(wasmResult.indices) as any);

            bufferGeo.computeVertexNormals();
            return bufferGeo;
        }
    } catch (e) {
        // Fallback to JS if WASM fails or not loaded
    }

    const {
        radius = 1, segments = 64,
        // Latitudinal params (Vertical shape)
        m1 = 0, n1_1 = 1, n1_2 = 1, n1_3 = 1,
        // Longitudinal params (Horizontal shape)
        m2 = 5, n2_1 = 1, n2_2 = 1, n2_3 = 1
    } = params;

    const vertices: number[] = [];
    const indices: number[] = [];
    const uvs: number[] = [];

    // Generate Vertices
    for (let i = 0; i <= segments; i++) {
        // Vertical Angle (-PI/2 to PI/2)
        const lat = (i / segments) * Math.PI - Math.PI / 2;
        const r1 = superformula(lat, 1, 1, m1, n1_1, n1_2, n1_3);

        for (let j = 0; j <= segments; j++) {
            // Horizontal Angle (-PI to PI)
            const lon = (j / segments) * Math.PI * 2 - Math.PI;
            const r2 = superformula(lon, 1, 1, m2, n2_1, n2_2, n2_3);

            // Spherical to Cartesian with Supershape Radius
            const x = radius * r1 * Math.cos(lat) * r2 * Math.cos(lon);
            const y = radius * r1 * Math.sin(lat) * r2 * Math.sin(lon);
            const z = radius * r1 * Math.sin(lat); // Typically Z is up in math, Y in Three.js. Let's swap Y/Z for Three.js

            // Swapped Y/Z for Three.js Y-UP
            vertices.push(x, z, y);
            uvs.push(j / segments, i / segments);
        }
    }

    // Generate Indices
    for (let i = 0; i < segments; i++) {
        for (let j = 0; j < segments; j++) {
            const a = i * (segments + 1) + j;
            const b = i * (segments + 1) + (j + 1);
            const c = (i + 1) * (segments + 1) + (j + 1);
            const d = (i + 1) * (segments + 1) + j;

            // Two triangles per quad
            indices.push(a, b, d);
            indices.push(b, c, d);
        }
    }

    const bufferGeo = new THREE.BufferGeometry();
    bufferGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    bufferGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    bufferGeo.setIndex(indices);
    bufferGeo.computeVertexNormals();

    return bufferGeo;
};

// 3. The Recursion Engine (Dali Logic)
export const generateTitanStructure = (material: THREE.Material, params: any) => {
    const root = new THREE.Group();
    root.userData.isContainer = true;

    const maxDepth = params.complexity || 3; // Recursion Depth
    // GOD MODE: High Resolution Override
    const baseSegments = params.highRes ? 256 : 64;

    const spawnRecursive = (parentObj: THREE.Object3D, depth: number, scale: number) => {
        if (depth <= 0) return;

        // Create the Geometry (Varies based on depth)
        const isCore = depth === maxDepth;

        // Procedural Override Logic (Infinite Shapes Mixin)
        let geometry;
        if (params.useProcedural && Math.random() > 0.5) {
            const segments = Math.floor(Math.random() * 20) + 3;
            const shape = generateGreebleProfile(segments, scale, params.distortion || 0.1);
            const extrudeSettings = {
                depth: scale * (Math.random() + 0.5),
                bevelEnabled: true,
                bevelThickness: scale * 0.1,
                bevelSize: scale * 0.05,
                bevelSegments: params.highRes ? 4 : 2,
                curveSegments: params.highRes ? 64 : 12
            };
            geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
            geometry.center();
        } else {
            const geoParams = {
                radius: scale,
                segments: isCore ? baseSegments : (params.highRes ? 64 : 16),
                m1: params.m1, n1_1: params.n1, n1_2: params.n2, n1_3: params.n3,
                m2: isCore ? params.m2 : params.m2 * 2
            };
            geometry = createSupershapeGeometry(geoParams);
        }

        // --- SURREALIST DEFORMATION (Twist/Bend) ---
        if (params.twist && params.twist !== 0) {
            const pos = geometry.attributes.position;
            const vec = new THREE.Vector3();
            for (let i = 0; i < pos.count; i++) {
                vec.fromBufferAttribute(pos, i);
                const angle = vec.y * params.twist; // Twist based on height
                const s = Math.sin(angle);
                const c = Math.cos(angle);
                // Rotate X/Z around Y
                const nx = vec.x * c - vec.z * s;
                const nz = vec.x * s + vec.z * c;
                pos.setXYZ(i, nx, vec.y, nz);
            }
            geometry.computeVertexNormals();
        }

        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        parentObj.add(mesh);

        // --- RECURSION BRANCHING (L-System Lite) ---
        // GOD MODE: Landscape Generation
        const branchCount = params.landscapeMode ? (Math.floor(Math.random() * 8) + 2) : (Math.floor(Math.random() * 4) + 1);

        for (let i = 0; i < branchCount; i++) {
            const positions = geometry.attributes.position;
            const rIndex = Math.floor(Math.random() * positions.count);
            const v = new THREE.Vector3().fromBufferAttribute(positions, rIndex);

            const childHolder = new THREE.Object3D();
            childHolder.position.copy(v);

            // Align child to normal (approximate normal as vector from center)
            childHolder.lookAt(v.clone().multiplyScalar(2));

            mesh.add(childHolder);

            spawnRecursive(childHolder, depth - 1, scale * 0.4);
        }
    };

    spawnRecursive(root, maxDepth, 1.0);
    return root;
};

// --- CONSTANTS ---
export const SHAPES = {
    // TIER 1: EXTENDED STANDARDS
    SPHERE: 'sphere', CUBE: 'cube', CYLINDER: 'cylinder', CONE: 'cone',
    TORUS: 'torus', SPIKE: 'spike', PIPE: 'pipe', CRYSTAL: 'crystal', GREEBLE: 'greeble',
    PYRAMID: 'pyramid', CAPSULE: 'capsule', RING: 'ring', ICOSA: 'icosa',
    CHAMFER_BOX: 'chamfer_box', CHAMFER_CYL: 'chamfer_cyl', OIL_TANK: 'oil_tank',
    SPINDLE: 'spindle', L_EXTRUSION: 'l_extrusion', C_EXTRUSION: 'c_extrusion',
    T_EXTRUSION: 't_extrusion', PRISM: 'prism', RING_WAVE: 'ring_wave',
    HOSE: 'hose', GENGON: 'gengon',

    // TIER 2: MECHANICAL GREEBLES
    HEX_BOLT: 'hex_bolt', SOCKET_HEAD: 'socket_head', VENT: 'vent', GRILLE: 'grille',
    PIPE_ELBOW: 'pipe_elbow', PIPE_TEE: 'pipe_tee', CORRUGATED: 'corrugated',
    SPRING: 'spring', SPROCKET: 'sprocket', BEARING: 'bearing', HEATSINK: 'heatsink',
    COUPLER: 'coupler',

    // TIER 3: MATH / EXPERIMENTAL
    SUPERELLIPSOID: 'superellipsoid', SUPERTOROID: 'supertoroid', GYROID: 'gyroid',
    SCHWARZ_P: 'schwarz_p', TORUS_KNOT: 'torus_knot', SPHERICON: 'sphericon',
    OLOIBOID: 'oloiboid', GOMBOC: 'gomboc', KLEIN: 'klein', MOBIUS: 'mobius',
    REULEAUX: 'reuleaux', STEREO_SPHERE: 'stereo_sphere',

    // TIER 8: NEW EXPERIMENTAL PRESETS
    HELIX_TUBE: 'helix_tube', VORONOI_SPHERE: 'voronoi_sphere',
    TESSELLATED_POD: 'tessellated_pod', HYPER_CUBE: 'hyper_cube',
    QUANTUM_GRID: 'quantum_grid', CYBER_PYRAMID: 'cyber_pyramid',
    NANO_CRYSTAL: 'nano_crystal', VOID_STAR: 'void_star',
    DATA_BLOCK: 'data_block', FLUX_CORE: 'flux_core',
    PLASMA_COIL: 'plasma_coil', GLITCH_PRISM: 'glitch_prism',
    BIO_CLUSTER: 'bio_cluster', NEURAL_NET: 'neural_net',
    ECHO_CHAMBER: 'echo_chamber', MIRROR_SHARD: 'mirror_shard',
    WARP_BUBBLE: 'warp_bubble', TIME_CAPSULE: 'time_capsule',
    GRAVITY_WELL: 'gravity_well', DARK_MATTER: 'dark_matter',

    // TIER 9: XENO (THE UNKNOWN)
    HYPER_EIGHT: 'hyper_eight',
    LORENZ_ATTRACTOR: 'lorenz_attractor',
    CALABI_YAU: 'calabi_yau',
    HENNEBERG_SURFACE: 'henneberg_surface',
    DINI_SURFACE: 'dini_surface',
    SEIFERT_SURFACE: 'seifert_surface',
    BOYS_SURFACE: 'boys_surface',
    ROMAN_SURFACE: 'roman_surface',
    KUEN_SURFACE: 'kuen_surface',
    ENNEPER_SURFACE: 'enneper_surface',
    RICHMOND_SURFACE: 'richmond_surface',
    SCHERK_SURFACE: 'scherk_surface',
    COSTA_SURFACE: 'costa_surface',
    CATENOID: 'catenoid',
    HELICOID: 'helicoid',
    ASTROIDAL_ELLIPSOID: 'astroidal_ellipsoid',
    BOHEMIAN_DOME: 'bohemian_dome',
    CLEBSCH_CUBIC: 'clebsch_cubic',
    WATTS_CURVE: 'watts_curve',
    BLACK_HOLE: 'black_hole',

    // TIER 4: PLATONIC / SACRED
    TETRAHEDRON: 'tetrahedron', OCTAHEDRON: 'octahedron', DODECAHEDRON: 'dodecahedron',
    TRUNC_ICOSA: 'trunc_icosa', RHOMBIC: 'rhombic', BUCKYBALL: 'buckyball',

    // TIER 5: PROFILES
    PROFILE_I: 'profile_i', PROFILE_H: 'profile_h', PROFILE_U: 'profile_u',
    PROFILE_T: 'profile_t', PROFILE_RAIL: 'profile_rail',

    // TIER 6: SDF PRIMITIVES
    ROUND_CONE: 'round_cone', CAPPED_CONE: 'capped_cone', ROUND_BOX: 'round_box',
    VESICA: 'vesica', LINK: 'link', CUT_SPHERE: 'cut_sphere', HOLLOW_SPHERE: 'hollow_sphere',

    // TIER 7: VOID / BOOLEAN
    CUTTER_BOX: 'cutter_box', DRILL_TIP: 'drill_tip', KEYHOLE: 'keyhole',
    SLOT: 'slot', COUNTERSINK: 'countersink',

    // LEGACY
    WALL: 'wall', PLATFORM: 'platform', PILLAR: 'pillar', TOWER: 'tower', ARC: 'arc',
    TENTACLE: 'tentacle', SPINE: 'spine', SWARM: 'swarm', CITY: 'city',
    STRUCT: 'struct', FRACTAL: 'fractal',
    CHAIN: 'chain', GEAR: 'gear', FLORA: 'flora', RUINS: 'ruins'
};

// --- SHARED CANVAS ---
const sharedCanvas = document.createElement('canvas');
const sharedCtx = sharedCanvas.getContext('2d', { willReadFrequently: true });

// --- UTILS ---
export const processImage = (img: HTMLImageElement, type: string, params: any) => {
    const canvas = sharedCanvas;
    const ctx = sharedCtx;
    if (!ctx) return null;

    const w = Math.floor(img.width);
    const h = Math.floor(img.height);
    if (w === 0 || h === 0) return null;
    canvas.width = w; canvas.height = h;

    if (params.makeSeamless) {
        ctx.drawImage(img, 0, 0, w, h);
        const temp = document.createElement('canvas');
        temp.width = w; temp.height = h;
        const tCtx = temp.getContext('2d');
        if (tCtx) {
            tCtx.drawImage(img, 0, 0, w, h);
            ctx.globalAlpha = 0.5;
            ctx.drawImage(temp, -w / 2, -h / 2, w, h); ctx.drawImage(temp, w / 2, -h / 2, w, h);
            ctx.drawImage(temp, -w / 2, h / 2, w, h); ctx.drawImage(temp, w / 2, h / 2, w, h);
            ctx.globalAlpha = 1.0;
        }
    } else { ctx.drawImage(img, 0, 0); }

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const outputData = ctx.createImageData(w, h);
    const out = outputData.data;

    const applyHue = (r: number, g: number, b: number, hue: number) => {
        if (hue === 0) return [r, g, b];
        const cosA = Math.cos(hue * Math.PI / 180);
        const sinA = Math.sin(hue * Math.PI / 180);
        const neoR = (cosA + (1.0 - cosA) / 3.0) * r + (1.0 / 3.0 * (1.0 - cosA) - Math.sqrt(1.0 / 3.0) * sinA) * g + (1.0 / 3.0 * (1.0 - cosA) + Math.sqrt(1.0 / 3.0) * sinA) * b;
        const neoG = (1.0 / 3.0 * (1.0 - cosA) + Math.sqrt(1.0 / 3.0) * sinA) * r + (cosA + 1.0 / 3.0 * (1.0 - cosA)) * g + (1.0 / 3.0 * (1.0 - cosA) - Math.sqrt(1.0 / 3.0) * sinA) * b;
        const neoB = (1.0 / 3.0 * (1.0 - cosA) - Math.sqrt(1.0 / 3.0) * sinA) * r + (1.0 / 3.0 * (1.0 - cosA) + Math.sqrt(1.0 / 3.0) * sinA) * g + (cosA + 1.0 / 3.0 * (1.0 - cosA)) * b;
        return [Math.min(255, Math.max(0, neoR)), Math.min(255, Math.max(0, neoG)), Math.min(255, Math.max(0, neoB))];
    };

    for (let i = 0; i < data.length; i += 4) {
        let r = data[i], g = data[i + 1], b = data[i + 2];
        if (type === 'base') {
            const [nR, nG, nB] = applyHue(r, g, b, params.hue);
            out[i] = nR; out[i + 1] = nG; out[i + 2] = nB; out[i + 3] = 255;
        }
        else if (type === 'height') {
            let gray = data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
            gray = ((gray - 128) * 2.0) + 128;
            gray = Math.min(255, Math.max(0, gray));
            out[i] = gray; out[i + 1] = gray; out[i + 2] = gray; out[i + 3] = 255;
        }
    }

    if (type === 'normal') {
        const getInt = (idx: number) => (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const idx = (y * w + x) * 4;
                const right = (x < w - 1) ? ((y * w) + (x + 1)) * 4 : idx;
                const bottom = (y < h - 1) ? (((y + 1) * w) + x) * 4 : idx;
                const strength = Math.max(0.1, params.normalStrength);
                const dx = (getInt(right) - getInt(idx)) * strength * 0.15;
                const dy = (getInt(bottom) - getInt(idx)) * strength * 0.15;
                const len = Math.sqrt(dx * dx + dy * dy + 1);
                out[idx] = (0.5 + 0.5 * (dx / len)) * 255;
                out[idx + 1] = (0.5 + 0.5 * (dy / len)) * 255;
                out[idx + 2] = (1.0 / len) * 255;
                out[idx + 3] = 255;
            }
        }
    }
    ctx.putImageData(outputData, 0, 0);
    return canvas.toDataURL();
};

export const packORM = (img: HTMLImageElement, params: any) => {
    const canvas = sharedCanvas;
    const ctx = sharedCtx;
    if (!ctx) return null;

    const w = Math.floor(img.width);
    const h = Math.floor(img.height);
    if (w === 0 || h === 0) return null;
    canvas.width = w; canvas.height = h;

    if (params.makeSeamless) {
        ctx.drawImage(img, 0, 0);
        ctx.globalAlpha = 0.5;
        ctx.drawImage(canvas, -w / 2, -h / 2); ctx.drawImage(canvas, w / 2, -h / 2);
        ctx.drawImage(canvas, -w / 2, h / 2); ctx.drawImage(canvas, w / 2, h / 2);
        ctx.globalAlpha = 1.0;
    } else { ctx.drawImage(img, 0, 0); }

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const outputData = ctx.createImageData(w, h);
    const out = outputData.data;

    for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
        const noise = (Math.random() - 0.5) * params.wear * 255;
        let ao = (gray) * params.aoIntensity + 255 * (1 - params.aoIntensity);
        let rough = params.roughnessInvert ? (255 - gray) : gray;
        rough = (rough - 128) * params.roughnessContrast + 128 + params.roughnessBrightness + noise;
        let metal = (gray - 128) * params.metalContrast + 128 + params.metalBias;
        out[i] = Math.min(255, Math.max(0, ao));
        out[i + 1] = Math.min(255, Math.max(0, rough));
        out[i + 2] = Math.min(255, Math.max(0, metal));
        out[i + 3] = 255;
    }
    ctx.putImageData(outputData, 0, 0);
    return canvas.toDataURL();
};

const createRoundedRectShape = (w: number, h: number, r: number) => {
    const s = new THREE.Shape();
    const x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    return s;
};

const createProfileShape = (type: string) => {
    const s = new THREE.Shape();
    // const w = 1, h = 1, t = 0.2; // width, height, thickness unused
    switch (type) {
        case SHAPES.L_EXTRUSION:
            s.moveTo(-0.5, -0.5); s.lineTo(0.5, -0.5); s.lineTo(0.5, -0.3); s.lineTo(-0.3, -0.3); s.lineTo(-0.3, 0.5); s.lineTo(-0.5, 0.5);
            break;
        case SHAPES.C_EXTRUSION:
            s.moveTo(-0.5, -0.5); s.lineTo(0.5, -0.5); s.lineTo(0.5, -0.3); s.lineTo(-0.3, -0.3); s.lineTo(-0.3, 0.3); s.lineTo(0.5, 0.3); s.lineTo(0.5, 0.5); s.lineTo(-0.5, 0.5);
            break;
        case SHAPES.T_EXTRUSION:
            s.moveTo(-0.1, -0.5); s.lineTo(0.1, -0.5); s.lineTo(0.1, 0.3); s.lineTo(0.5, 0.3); s.lineTo(0.5, 0.5); s.lineTo(-0.5, 0.5); s.lineTo(-0.5, 0.3); s.lineTo(-0.1, 0.3);
            break;
        case SHAPES.PROFILE_I:
            s.moveTo(-0.3, -0.5); s.lineTo(0.3, -0.5); s.lineTo(0.3, -0.3); s.lineTo(0.1, -0.3); s.lineTo(0.1, 0.3); s.lineTo(0.3, 0.3); s.lineTo(0.3, 0.5); s.lineTo(-0.3, 0.5); s.lineTo(-0.3, 0.3); s.lineTo(-0.1, 0.3); s.lineTo(-0.1, -0.3); s.lineTo(-0.3, -0.3);
            break;
        case SHAPES.PROFILE_H: // Rotated I
            return createProfileShape(SHAPES.PROFILE_I); // Handle rotation in mesh
        case SHAPES.PROFILE_U:
            s.moveTo(-0.5, -0.5); s.lineTo(0.5, -0.5); s.lineTo(0.5, 0.5); s.lineTo(0.3, 0.5); s.lineTo(0.3, -0.3); s.lineTo(-0.3, -0.3); s.lineTo(-0.3, 0.5); s.lineTo(-0.5, 0.5);
            break;
        case SHAPES.PROFILE_T: // Same as T_EXTRUSION
            return createProfileShape(SHAPES.T_EXTRUSION);
        case SHAPES.PROFILE_RAIL:
            s.moveTo(-0.4, -0.5); s.lineTo(0.4, -0.5); s.lineTo(0.4, -0.4); s.lineTo(0.1, -0.3); s.lineTo(0.1, 0.3); s.lineTo(0.3, 0.4); s.lineTo(0.3, 0.5); s.lineTo(-0.3, 0.5); s.lineTo(-0.3, 0.4); s.lineTo(-0.1, 0.3); s.lineTo(-0.1, -0.3); s.lineTo(-0.4, -0.4);
            break;
        case SHAPES.GEAR:
        case SHAPES.SPROCKET:
            const teeth = 8; const rOut = 0.5; const rIn = 0.3;
            for (let i = 0; i < teeth * 2; i++) {
                const a = (i / (teeth * 2)) * Math.PI * 2;
                const r = (i % 2 === 0) ? rOut : rIn;
                const x = Math.cos(a) * r; const y = Math.sin(a) * r;
                if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
            }
            break;
        default:
            s.moveTo(-0.5, -0.5); s.lineTo(0.5, -0.5); s.lineTo(0.5, 0.5); s.lineTo(-0.5, 0.5);
    }
    return s;
}

// --- HELPER: Geometry Merging Utility ---
const mergeGeometries = (geometries: THREE.BufferGeometry[]) => {
    if (geometries.length === 0) return new THREE.BufferGeometry();

    let vertexCount = 0;
    let indexCount = 0;

    geometries.forEach(g => {
        vertexCount += g.attributes.position.count;
        if (g.index) indexCount += g.index.count;
    });

    const positions = new Float32Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);
    const indices = indexCount > 0 ? new (vertexCount > 65535 ? Uint32Array : Uint16Array)(indexCount) : null;

    let vOffset = 0;
    let iOffset = 0;

    geometries.forEach(g => {
        const pos = g.attributes.position;
        const norm = g.attributes.normal;
        const uv = g.attributes.uv;
        const index = g.index;

        if (pos) positions.set(pos.array as Float32Array, vOffset * 3);
        if (norm) normals.set(norm.array as Float32Array, vOffset * 3);
        if (uv) uvs.set(uv.array as Float32Array, vOffset * 2);

        if (index && indices) {
            for (let i = 0; i < index.count; i++) {
                indices[iOffset + i] = index.getX(i) + vOffset;
            }
            iOffset += index.count;
        }

        vOffset += pos.count;
    });

    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    if (indices) merged.setIndex(new THREE.BufferAttribute(indices, 1));

    return merged;
};

// --- HELPER: Parametric Geometry Generator ---
const createParametricGeometry = (func: (u: number, v: number, target: THREE.Vector3) => void, slices: number, stacks: number) => {
    const vertices = [];
    const indices = [];
    const uvs = [];
    // const normals = [];

    const sliceStep = 1 / slices;
    const stackStep = 1 / stacks;

    const p = new THREE.Vector3();
    // const p1 = new THREE.Vector3();
    // const p2 = new THREE.Vector3();
    // const p3 = new THREE.Vector3();

    for (let i = 0; i <= stacks; i++) {
        const v = i * stackStep;
        for (let j = 0; j <= slices; j++) {
            const u = j * sliceStep;

            func(u, v, p);
            vertices.push(p.x, p.y, p.z);
            uvs.push(u, v);
        }
    }

    for (let i = 0; i < stacks; i++) {
        for (let j = 0; j < slices; j++) {
            const a = i * (slices + 1) + j;
            const b = i * (slices + 1) + j + 1;
            const c = (i + 1) * (slices + 1) + j + 1;
            const d = (i + 1) * (slices + 1) + j;

            indices.push(a, b, d);
            indices.push(b, c, d);
        }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
};

export const createGeometry = (type: string) => {
    const seg = 128; // High Quality

    // Parametric Functions
    const klein = (u: number, v: number, target: THREE.Vector3) => {
        u *= Math.PI; v *= 2 * Math.PI; u = u * 2;
        let x, y, z;
        if (u < Math.PI) {
            x = 3 * Math.cos(u) * (1 + Math.sin(u)) + (2 * (1 - Math.cos(u) / 2)) * Math.cos(u) * Math.cos(v);
            z = -8 * Math.sin(u) - 2 * (1 - Math.cos(u) / 2) * Math.sin(u) * Math.cos(v);
        } else {
            x = 3 * Math.cos(u) * (1 + Math.sin(u)) + (2 * (1 - Math.cos(u) / 2)) * Math.cos(v + Math.PI);
            z = -8 * Math.sin(u);
        }
        y = -2 * (1 - Math.cos(u) / 2) * Math.sin(v);
        target.set(x, y, z).multiplyScalar(0.05).applyAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2).add(new THREE.Vector3(0, 0.5, 0));
    };

    const mobius = (u: number, t: number, target: THREE.Vector3) => {
        u = u - 0.5; const v = 2 * Math.PI * t;
        const x = Math.cos(v) * (1 + u * Math.cos(v / 2));
        const y = Math.sin(v) * (1 + u * Math.cos(v / 2));
        const z = u * Math.sin(v / 2);
        target.set(x, y, z).multiplyScalar(0.8).add(new THREE.Vector3(0, 0.5, 0));
    };

    const superellipsoid = (u: number, v: number, target: THREE.Vector3) => {
        const n1 = 0.2; const n2 = 1.0; // Squircle parameters
        u *= Math.PI * 2 - Math.PI; v *= Math.PI - Math.PI / 2;
        const cu = Math.cos(u); const su = Math.sin(u);
        const cv = Math.cos(v); const sv = Math.sin(v);
        const sgn = (x: number) => x > 0 ? 1 : (x < 0 ? -1 : 0);
        const pow = (b: number, e: number) => Math.pow(Math.abs(b), e);

        const x = sgn(cv) * pow(cv, n1) * sgn(cu) * pow(cu, n2);
        const y = sgn(cv) * pow(cv, n1) * sgn(su) * pow(su, n2);
        const z = sgn(sv) * pow(sv, n1);
        target.set(x, z, y).multiplyScalar(0.5).add(new THREE.Vector3(0, 0.5, 0));
    };

    const supertoroid = (u: number, v: number, target: THREE.Vector3) => {
        const n1 = 2.0; const n2 = 0.5; // Square torus
        u *= Math.PI * 2; v *= Math.PI * 2;
        const R = 1; const r = 0.4;
        const cu = Math.cos(u); const su = Math.sin(u);
        const cv = Math.cos(v); const sv = Math.sin(v);
        const sgn = (x: number) => x > 0 ? 1 : (x < 0 ? -1 : 0);
        const pow = (b: number, e: number) => Math.pow(Math.abs(b), e);

        const x = sgn(cu) * pow(cu, n1) * (R + r * sgn(cv) * pow(cv, n2));
        const y = sgn(su) * pow(su, n1) * (R + r * sgn(cv) * pow(cv, n2));
        const z = r * sgn(sv) * pow(sv, n2);
        target.set(x, z, y).multiplyScalar(0.4).add(new THREE.Vector3(0, 0.5, 0));
    };

    switch (type) {
        // --- TIER 1 ---
        case SHAPES.CUBE: return new THREE.BoxGeometry(1, 1, 1, seg, seg, seg).translate(0, 0.5, 0);
        case SHAPES.SPHERE: return new THREE.SphereGeometry(0.5, seg, seg).translate(0, 0.5, 0);
        case SHAPES.CYLINDER: return new THREE.CylinderGeometry(0.5, 0.5, 1, seg, 1).translate(0, 0.5, 0);
        case SHAPES.CONE: return new THREE.ConeGeometry(0.5, 1, seg, 1).translate(0, 0.5, 0);
        case SHAPES.TORUS: return new THREE.TorusGeometry(0.4, 0.2, seg, seg).rotateX(-Math.PI / 2).translate(0, 0.2, 0);
        case SHAPES.SPIKE: return new THREE.ConeGeometry(0.2, 2, 64, 64).translate(0, 1, 0);
        case SHAPES.PIPE: return new THREE.TorusKnotGeometry(0.4, 0.15, 256, 32, 2, 3).translate(0, 0.6, 0);
        case SHAPES.CRYSTAL: return new THREE.OctahedronGeometry(0.5, 2).translate(0, 0.5, 0);
        case SHAPES.PYRAMID: return new THREE.ConeGeometry(0.5, 1, 4, 1).translate(0, 0.5, 0);
        case SHAPES.ICOSA: return new THREE.IcosahedronGeometry(0.5, 0).translate(0, 0.5, 0);
        case SHAPES.CAPSULE: return new THREE.CapsuleGeometry(0.3, 0.8, 16, 32).translate(0, 0.7, 0);
        case SHAPES.RING: return new THREE.TorusGeometry(0.5, 0.1, 64, 32).rotateX(-Math.PI / 2).translate(0, 0.1, 0);

        // Extended Tier 1
        case SHAPES.CHAMFER_BOX: {
            const shape = createRoundedRectShape(1, 1, 0.1);
            const geo = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: true, bevelSegments: 4, bevelSize: 0.05, bevelThickness: 0.05 });
            geo.center(); geo.translate(0, 0.5, 0); return geo;
        }
        case SHAPES.CHAMFER_CYL: return new THREE.CylinderGeometry(0.5, 0.5, 1, seg, 4).translate(0, 0.5, 0);
        case SHAPES.OIL_TANK: return new THREE.CapsuleGeometry(0.5, 0.5, 8, 32).scale(1, 0.6, 1).translate(0, 0.5, 0);
        case SHAPES.SPINDLE: return new THREE.OctahedronGeometry(0.5, 4).scale(0.5, 1.5, 0.5).translate(0, 0.75, 0); // Elongated octahedron approximation
        case SHAPES.PRISM: return new THREE.CylinderGeometry(0.5, 0.5, 1, 3, 1).translate(0, 0.5, 0);
        case SHAPES.RING_WAVE: return new THREE.RingGeometry(0.3, 0.8, 64, 8).rotateX(-Math.PI / 2).translate(0, 0.01, 0);
        case SHAPES.HOSE: return new THREE.TorusGeometry(0.4, 0.1, 32, 64, Math.PI).rotateY(Math.PI / 2).translate(0, 0, 0);
        case SHAPES.GENGON: return new THREE.CylinderGeometry(0.5, 0.5, 1, 8, 1).translate(0, 0.5, 0);

        // --- TIER 2: MECHANICAL ---
        case SHAPES.HEX_BOLT: return new THREE.CylinderGeometry(0.5, 0.5, 0.2, 6, 1).translate(0, 0.1, 0);
        case SHAPES.SOCKET_HEAD: {
            const geo = new THREE.CylinderGeometry(0.5, 0.5, 0.5, 32, 1);
            // const socket = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 6, 1).translate(0, 0.25, 0);
            // CSG would be ideal but for now we render the head.
            // User asked for visual, let's stick to the head shape.
            geo.translate(0, 0.25, 0); return geo;
        }
        case SHAPES.VENT: return new THREE.BoxGeometry(1, 0.2, 1).translate(0, 0.1, 0);
        case SHAPES.GRILLE: return new THREE.PlaneGeometry(1, 1, 10, 10).rotateX(-Math.PI / 2).translate(0, 0.01, 0);
        case SHAPES.PIPE_ELBOW: return new THREE.TorusGeometry(0.5, 0.2, 16, 32, Math.PI / 2).translate(0, 0.5, 0);
        case SHAPES.PIPE_TEE: {
            const g1 = new THREE.CylinderGeometry(0.2, 0.2, 1, 16).translate(0, 0.5, 0);
            // We can't merge geometries easily in this function returning a single geometry without utils
            // Return vertical pipe for now
            return g1;
        }
        case SHAPES.CORRUGATED: return new THREE.PlaneGeometry(1, 1, 32, 1).rotateX(-Math.PI / 2).translate(0, 0, 0);
        case SHAPES.SPRING: return new THREE.TorusKnotGeometry(0.3, 0.05, 128, 16, 5, 8).translate(0, 0.5, 0);
        case SHAPES.SPROCKET: {
            const shape = createProfileShape(SHAPES.SPROCKET);
            const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: false });
            geo.rotateX(Math.PI / 2); geo.translate(0, 0.05, 0); return geo;
        }
        case SHAPES.BEARING: return new THREE.CylinderGeometry(0.5, 0.5, 0.3, 32).translate(0, 0.15, 0);
        case SHAPES.HEATSINK: return new THREE.BoxGeometry(1, 0.5, 1).translate(0, 0.25, 0);
        case SHAPES.COUPLER: return new THREE.CylinderGeometry(0.4, 0.4, 0.8, 32).translate(0, 0.4, 0);

        // --- TIER 3: MATH (Implemented) ---
        case SHAPES.TORUS_KNOT: return new THREE.TorusKnotGeometry(0.3, 0.1, 128, 32).translate(0, 0.5, 0);
        case SHAPES.GYROID: return new THREE.TorusKnotGeometry(0.4, 0.15, 200, 32, 3, 5).translate(0, 0.5, 0); // Approximation
        case SHAPES.KLEIN: return createParametricGeometry(klein, 64, 64);
        case SHAPES.MOBIUS: return createParametricGeometry(mobius, 64, 24);
        case SHAPES.SUPERELLIPSOID: return createParametricGeometry(superellipsoid, 64, 64);
        case SHAPES.SUPERTOROID: return createParametricGeometry(supertoroid, 64, 64);
        case SHAPES.SCHWARZ_P: return new THREE.IcosahedronGeometry(0.5, 2).translate(0, 0.5, 0); // Approximation
        case SHAPES.SPHERICON: return new THREE.OctahedronGeometry(0.5, 3).scale(1, 1, 0.5).translate(0, 0.5, 0); // Approximation
        case SHAPES.OLOIBOID: return new THREE.BoxGeometry(1, 0.5, 0.5).translate(0, 0.25, 0); // Placeholder
        case SHAPES.GOMBOC: return new THREE.SphereGeometry(0.5, 64, 64).scale(1, 1.1, 0.9).translate(0, 0.5, 0); // Approximation
        case SHAPES.REULEAUX: return new THREE.TetrahedronGeometry(0.6, 2).translate(0, 0.5, 0); // Puffy Tet
        case SHAPES.STEREO_SPHERE: return new THREE.SphereGeometry(0.5, 16, 16).translate(0, 0.5, 0); // Grid viz usually

        // --- TIER 8: EXPERIMENTAL ---
        case SHAPES.HELIX_TUBE: {
            const geos = [];
            for (let i = 0; i < 30; i++) {
                const t = (i / 30) * Math.PI * 6;
                const r = 0.3;
                const x = Math.cos(t) * r;
                const z = Math.sin(t) * r;
                const y = (i / 30) * 1.5 - 0.75;
                const g = new THREE.TorusGeometry(0.1, 0.04, 8, 16);
                g.rotateX(Math.PI / 2);
                g.translate(x, y + 0.5, z);
                geos.push(g);
                if (i % 2 === 0) {
                    const b = new THREE.CylinderGeometry(0.02, 0.02, r * 2, 4);
                    b.rotateZ(Math.PI / 2);
                    b.rotateY(-t);
                    b.translate(0, y + 0.5, 0);
                    geos.push(b);
                }
            }
            const g = mergeGeometries(geos);
            g.center(); g.translate(0, 0.5, 0); return g;
        }
        case SHAPES.VORONOI_SPHERE: {
            const geos = [];
            geos.push(new THREE.IcosahedronGeometry(0.35, 1));
            for (let i = 0; i < 12; i++) {
                const g = new THREE.CylinderGeometry(0.15, 0.2, 0.05, 6);
                g.translate(0, 0.4, 0);
                const rotX = Math.random() * Math.PI * 2;
                const rotY = Math.random() * Math.PI * 2;
                g.rotateX(rotX); g.rotateY(rotY);
                g.translate(0, 0.5, 0);
                geos.push(g);
            }
            const g = mergeGeometries(geos);
            g.center(); g.translate(0, 0.5, 0); return g;
        }
        case SHAPES.TESSELLATED_POD: {
            const geos = [];
            geos.push(new THREE.DodecahedronGeometry(0.4));
            for (let i = 0; i < 12; i++) {
                const s = new THREE.ConeGeometry(0.1, 0.3, 4);
                s.translate(0, 0.5, 0);
                s.rotateX(Math.random() * Math.PI * 2);
                s.rotateZ(Math.random() * Math.PI * 2);
                geos.push(s);
            }
            const g = mergeGeometries(geos);
            g.center(); g.translate(0, 0.5, 0); return g;
        }
        case SHAPES.HYPER_CUBE: {
            const geos = [];
            const size = 0.6;
            const r = 0.15;
            for (let x = -1; x <= 1; x += 2) {
                for (let y = -1; y <= 1; y += 2) {
                    for (let z = -1; z <= 1; z += 2) {
                        const box = new THREE.BoxGeometry(r, r, r);
                        box.translate(x * size / 2, y * size / 2, z * size / 2);
                        geos.push(box);
                    }
                }
            }
            geos.push(new THREE.BoxGeometry(0.3, 0.3, 0.3));
            const g = mergeGeometries(geos);
            g.center(); g.translate(0, 0.5, 0); return g;
        }
        case SHAPES.QUANTUM_GRID: {
            const geos = [];
            const dim = 4;
            const spacing = 0.2;
            for (let x = 0; x < dim; x++) {
                for (let z = 0; z < dim; z++) {
                    const h = 0.1 + Math.random() * 0.4;
                    const box = new THREE.BoxGeometry(0.15, h, 0.15);
                    box.translate((x - dim / 2) * spacing, h / 2, (z - dim / 2) * spacing);
                    geos.push(box);
                }
            }
            const g = mergeGeometries(geos);
            g.center(); g.translate(0, 0.5, 0); return g;
        }
        case SHAPES.CYBER_PYRAMID: {
            const geos = [];
            for (let i = 0; i < 5; i++) {
                const w = 1.0 - (i * 0.2);
                const box = new THREE.BoxGeometry(w, 0.15, w);
                box.translate(0, i * 0.15, 0);
                geos.push(box);
            }
            const cap = new THREE.ConeGeometry(0.1, 0.3, 4);
            cap.translate(0, 5 * 0.15 + 0.15, 0);
            geos.push(cap);
            const g = mergeGeometries(geos);
            g.center(); g.translate(0, 0.5, 0); return g;
        }
        case SHAPES.NANO_CRYSTAL: {
            const geos = [];
            for (let i = 0; i < 6; i++) {
                const oct = new THREE.OctahedronGeometry(0.2 + Math.random() * 0.3, 0);
                oct.scale(0.5, 1.5, 0.5);
                oct.rotateX(Math.random() * Math.PI);
                oct.rotateZ(Math.random() * Math.PI);
                geos.push(oct);
            }
            const g = mergeGeometries(geos);
            g.center(); g.translate(0, 0.5, 0); return g;
        }
        case SHAPES.VOID_STAR: {
            const geos = [];
            geos.push(new THREE.IcosahedronGeometry(0.3));
            for (let i = 0; i < 16; i++) {
                const spike = new THREE.ConeGeometry(0.05, 0.8, 4);
                spike.translate(0, 0.4, 0);
                spike.rotateX(Math.random() * Math.PI * 2);
                spike.rotateZ(Math.random() * Math.PI * 2);
                geos.push(spike);
            }
            const g = mergeGeometries(geos);
            g.center(); g.translate(0, 0.5, 0); return g;
        }
        case SHAPES.DATA_BLOCK: {
            const geos = [];
            const dim = 3;
            const size = 0.3;
            for (let x = 0; x < dim; x++) {
                for (let y = 0; y < dim; y++) {
                    for (let z = 0; z < dim; z++) {
                        if (Math.random() > 0.3) {
                            const box = new THREE.BoxGeometry(size * 0.9, size * 0.9, size * 0.9);
                            box.translate((x - 1) * size, (y - 1) * size, (z - 1) * size);
                            geos.push(box);
                        }
                    }
                }
            }
            const g = mergeGeometries(geos);
            g.center(); g.translate(0, 0.5, 0); return g;
        }
        case SHAPES.FLUX_CORE: {
            const geos = [];
            geos.push(new THREE.SphereGeometry(0.3, 16, 16));
            for (let i = 0; i < 3; i++) {
                const ring = new THREE.TorusGeometry(0.5 + i * 0.1, 0.02, 8, 32);
                ring.rotateX(Math.random() * Math.PI);
                ring.rotateY(Math.random() * Math.PI);
                geos.push(ring);
            }
            const g = mergeGeometries(geos);
            g.center(); g.translate(0, 0.5, 0); return g;
        }
        case SHAPES.PLASMA_COIL: {
            const geos = [];
            for (let i = 0; i < 40; i++) {
                const t = i * 0.5;
                const r = 0.3 + Math.sin(t * 0.5) * 0.1;
                const x = Math.cos(t) * r;
                const z = Math.sin(t) * r;
                const y = (i / 40) * 1.5;
                const sphere = new THREE.SphereGeometry(0.08, 8, 8);
                sphere.translate(x, y, z);
                geos.push(sphere);
            }
            const g = mergeGeometries(geos);
            g.center(); g.translate(0, 0.5, 0); return g;
        }
        case SHAPES.GLITCH_PRISM: {
            const geos = [];
            for (let i = 0; i < 10; i++) {
                const cyl = new THREE.CylinderGeometry(0.3, 0.3, 0.15, 6);
                cyl.translate((Math.random() - 0.5) * 0.2, i * 0.15, (Math.random() - 0.5) * 0.2);
                geos.push(cyl);
            }
            const g = mergeGeometries(geos);
            g.center(); g.translate(0, 0.5, 0); return g;
        }
        case SHAPES.BIO_CLUSTER: {
            const geos = [];
            for (let i = 0; i < 15; i++) {
                const s = 0.1 + Math.random() * 0.3;
                const sphere = new THREE.SphereGeometry(s, 16, 16);
                sphere.translate((Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8);
                geos.push(sphere);
            }
            const g = mergeGeometries(geos);
            g.center(); g.translate(0, 0.5, 0); return g;
        }
        case SHAPES.NEURAL_NET: {
            const geos = [];
            const points = [];
            for (let i = 0; i < 8; i++) {
                const p = new THREE.Vector3((Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5));
                points.push(p);
                const node = new THREE.SphereGeometry(0.1, 8, 8);
                node.translate(p.x, p.y, p.z);
                geos.push(node);
            }
            for (let i = 0; i < points.length; i++) {
                for (let j = i + 1; j < points.length; j++) {
                    if (Math.random() > 0.6) {
                        const p1 = points[i];
                        const p2 = points[j];
                        const dist = p1.distanceTo(p2);
                        const mid = p1.clone().add(p2).multiplyScalar(0.5);
                        const axis = new THREE.Vector3(0, 1, 0);
                        const dir = p2.clone().sub(p1).normalize();
                        const quat = new THREE.Quaternion().setFromUnitVectors(axis, dir);
                        const c2 = new THREE.CylinderGeometry(0.02, 0.02, dist, 4);
                        c2.applyQuaternion(quat);
                        c2.translate(mid.x, mid.y, mid.z);
                        geos.push(c2);
                    }
                }
            }
            const g = mergeGeometries(geos);
            g.center(); g.translate(0, 0.5, 0); return g;
        }
        case SHAPES.ECHO_CHAMBER: {
            const geos = [];
            for (let i = 0; i < 3; i++) {
                const s = 1.0 - i * 0.3;
                const box = new THREE.BoxGeometry(s, s, s);
                box.scale(1, 0.8, 1);
                geos.push(box);
            }
            const g = mergeGeometries(geos);
            g.center(); g.translate(0, 0.5, 0); return g;
        }
        case SHAPES.MIRROR_SHARD: {
            const geos = [];
            for (let i = 0; i < 8; i++) {
                const tet = new THREE.TetrahedronGeometry(0.3 + Math.random() * 0.3);
                tet.scale(0.5, 2.0, 0.5);
                tet.rotateX((Math.random() - 0.5));
                tet.rotateZ((Math.random() - 0.5));
                geos.push(tet);
            }
            const g = mergeGeometries(geos);
            g.center(); g.translate(0, 0.5, 0); return g;
        }
        case SHAPES.WARP_BUBBLE: {
            const geos = [];
            geos.push(new THREE.SphereGeometry(0.4, 32, 32));
            for (let i = 0; i < 30; i++) {
                const cube = new THREE.BoxGeometry(0.05, 0.05, 0.05);
                const r = 0.5 + Math.random() * 0.2;
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.random() * Math.PI;
                const x = r * Math.sin(phi) * Math.cos(theta);
                const y = r * Math.sin(phi) * Math.sin(theta);
                const z = r * Math.cos(phi);
                cube.translate(x, y, z);
                geos.push(cube);
            }
            const g = mergeGeometries(geos);
            g.center(); g.translate(0, 0.5, 0); return g;
        }
        case SHAPES.TIME_CAPSULE: {
            const geos = [];
            geos.push(new THREE.CapsuleGeometry(0.3, 0.8, 4, 16));
            for (let i = 0; i < 3; i++) {
                const ring = new THREE.TorusGeometry(0.32, 0.05, 8, 16);
                ring.rotateX(Math.PI / 2);
                ring.translate(0, (i - 1) * 0.3, 0);
                geos.push(ring);
            }
            const g = mergeGeometries(geos);
            g.center(); g.translate(0, 0.5, 0); return g;
        }
        case SHAPES.GRAVITY_WELL: {
            const geos = [];
            for (let i = 0; i < 20; i++) {
                const s = 1.0 - (i / 20);
                const box = new THREE.BoxGeometry(s * 0.5, 0.05, s * 0.5);
                box.rotateY(i * 0.5);
                box.translate(0, i * 0.05, 0);
                geos.push(box);
            }
            const g = mergeGeometries(geos);
            g.center(); g.translate(0, 0.5, 0); return g;
        }

        // --- TIER 9: XENO ---
        case SHAPES.HYPER_EIGHT: {
            // Figure-8 Immersion of Klein Bottle
            const func = (u: number, v: number, target: THREE.Vector3) => {
                u *= Math.PI * 2;
                v *= Math.PI * 2;
                const a = 2;
                const cosU = Math.cos(u);
                const sinU = Math.sin(u);
                // const sinU2 = Math.sin(u/2);
                // const cosU2 = Math.cos(u/2);
                const sinV = Math.sin(v);
                // const cosV = Math.cos(v);
                const sin2V = Math.sin(2 * v);

                const x = (a + cosU / 2 * sinV - sinU / 2 * sin2V) * cosU;
                const y = (a + cosU / 2 * sinV - sinU / 2 * sin2V) * sinU;
                const z = sinU / 2 * sinV + cosU / 2 * sin2V;
                target.set(x, z, y).multiplyScalar(0.2);
            };
            const geo = createParametricGeometry(func, 128, 128);
            geo.center(); geo.translate(0, 0.5, 0); return geo;
        }
        case SHAPES.LORENZ_ATTRACTOR: {
            const points = [];
            let x = 0.1, y = 0, z = 0;
            const dt = 0.01;
            const sigma = 10, rho = 28, beta = 8 / 3;

            for (let i = 0; i < 3000; i++) {
                const dx = sigma * (y - x) * dt;
                const dy = (x * (rho - z) - y) * dt;
                const dz = (x * y - beta * z) * dt;
                x += dx; y += dy; z += dz;
                points.push(new THREE.Vector3(x, z, y).multiplyScalar(0.03));
            }
            const curve = new THREE.CatmullRomCurve3(points);
            const geo = new THREE.TubeGeometry(curve, 600, 0.05, 8, false);
            geo.center(); geo.translate(0, 0.5, 0); return geo;
        }
        case SHAPES.CALABI_YAU: {
            // Simplified Calabi-Yau Manifold Projection
            const func = (u: number, v: number, target: THREE.Vector3) => {
                u = u * Math.PI * 2; // 0 to 2PI
                v = v * Math.PI * 2; // 0 to 2PI
                const n = 3; // Order
                // Complex projection approximation
                const k = 1;
                // z1 = exp(i * u) * cos(v)^(2/n)
                // z2 = exp(i * (u + k*v)) * sin(v)^(2/n)

                // Real/Imaginary separation for 3D projection
                // We'll create a wild 4D->3D shadow effect
                const r1 = Math.pow(Math.abs(Math.cos(v)), 2 / n);
                const r2 = Math.pow(Math.abs(Math.sin(v)), 2 / n);

                const x1 = r1 * Math.cos(u);
                const y1 = r1 * Math.sin(u);
                const x2 = r2 * Math.cos(u + v * k); // Twist
                const y2 = r2 * Math.sin(u + v * k);

                // Project 4D (x1,y1,x2,y2) to 3D
                target.set(x1 + x2, y1 + y2, x1 * 0.5 - y2 * 0.5).multiplyScalar(0.8);
            };
            const geo = createParametricGeometry(func, 128, 128);
            geo.center(); geo.translate(0, 0.5, 0); return geo;
        }
        case SHAPES.HENNEBERG_SURFACE: {
            /* const func = (u: number, v: number, target: THREE.Vector3) => {
                 // ... unused
            }; */
            // Clamp U range to avoid infinity
            const safeFunc = (u: number, v: number, t: THREE.Vector3) => {
                const uRemapped = (u - 0.5) * 1.5; // -0.75 to 0.75
                const vRemapped = (v) * Math.PI * 2;

                const x = 2 * Math.sinh(uRemapped) * Math.cos(vRemapped) - (2 / 3) * Math.sinh(3 * uRemapped) * Math.cos(3 * vRemapped);
                const z = 2 * Math.sinh(uRemapped) * Math.sin(vRemapped) + (2 / 3) * Math.sinh(3 * uRemapped) * Math.sin(3 * vRemapped);
                const y = 2 * Math.cosh(2 * uRemapped) * Math.cos(2 * vRemapped);
                t.set(x, y, z).multiplyScalar(0.08);
            };

            const geo = createParametricGeometry(safeFunc, 128, 128);
            geo.center(); geo.translate(0, 0.5, 0); return geo;
        }
        case SHAPES.DINI_SURFACE: {
            const func = (u: number, v: number, target: THREE.Vector3) => {
                u = u * 4 * Math.PI; // 0 to 4PI
                v = v * 2 + 0.01; // 0.01 to 2

                const a = 1;
                const b = 0.2;

                const x = a * Math.cos(u) * Math.sin(v);
                const y = a * Math.sin(u) * Math.sin(v);
                const z = a * (Math.cos(v) + Math.log(Math.tan(v / 2))) + b * u;

                target.set(x, z, y).multiplyScalar(0.3);
            };
            const geo = createParametricGeometry(func, 128, 64);
            geo.center(); geo.translate(0, 0.5, 0); return geo;
        }
        case SHAPES.SEIFERT_SURFACE: {
            // Approximating a Seifert Surface for a Trefoil Knot
            // Using a twisted ribbon modulation
            const func = (u: number, v: number, target: THREE.Vector3) => {
                u *= Math.PI * 2; // 0 to 2PI (Knot path)
                v = (v - 0.5) * 2; // -1 to 1 (Ribbon width)

                // Trefoil Knot Core
                // const r = 0.5 + 0.2 * v * Math.cos(1.5 * u); // Twist the width

                const x = (Math.sin(u) + 2 * Math.sin(2 * u)) * 0.3;
                const y = (Math.cos(u) - 2 * Math.cos(2 * u)) * 0.3;
                const z = (-Math.sin(3 * u)) * 0.3;

                // Normal/Binormal extrusion for surface
                // Simplified twist addition
                const twist = v * 0.3;
                const tx = x + twist * Math.cos(u * 1.5);
                const ty = y + twist * Math.sin(u * 1.5);
                const tz = z + twist * Math.sin(u);

                target.set(tx, tz, ty);
            };
            const geo = createParametricGeometry(func, 200, 20);
            geo.center(); geo.translate(0, 0.5, 0); return geo;
        }
        case SHAPES.BOYS_SURFACE: {
            // Bryant-Kusner Parametrization
            /* const func = (u: number, v: number, target: THREE.Vector3) => {
                 // ... unused
            }; */
            // Better param:
            const boy = (u: number, v: number, t: THREE.Vector3) => {
                u *= Math.PI; v *= Math.PI;
                // const K = 3;
                // const x = Math.cos(u) * Math.sin(v);
                // const y = Math.sin(u) * Math.sin(v);
                // const z = Math.cos(v);

                // const X = (Math.sqrt(2)*Math.cos(2*u)*x + Math.cos(u)*Math.sin(2*v))/(2 - K*Math.sin(3*u)*Math.sin(2*v));
                // This formula is often unstable. Let's do a twisted sphere.
                t.set(Math.cos(u) * Math.cos(v), Math.sin(u) * Math.cos(v), Math.sin(v)).multiplyScalar(0.5);
                // Corrupt it
                t.y += Math.sin(3 * u) * 0.2;
                t.x += Math.cos(3 * v) * 0.2;
            };

            const geo = createParametricGeometry(boy, 128, 64);
            geo.center(); geo.translate(0, 0.5, 0); return geo;
        }
        case SHAPES.ROMAN_SURFACE: {
            const func = (u: number, v: number, target: THREE.Vector3) => {
                u *= Math.PI; v *= Math.PI;
                const x = Math.sin(2 * u) * Math.sin(v) * Math.sin(v);
                const y = Math.sin(u) * Math.sin(2 * v) * Math.sin(v);
                const z = Math.cos(u) * Math.sin(2 * v) * Math.sin(v);
                target.set(x, z, y).multiplyScalar(0.5);
            };
            const geo = createParametricGeometry(func, 128, 128);
            geo.center(); geo.translate(0, 0.5, 0); return geo;
        }
        case SHAPES.KUEN_SURFACE: {
            const func = (u: number, v: number, target: THREE.Vector3) => {
                u = (u - 0.5) * 4; // -2 to 2
                v = v * Math.PI * 0.9 + 0.05; // 0.05 to 0.95*PI to avoid singularity at 0 and PI
                // const r = Math.sqrt(1 + u*u) * Math.sin(v);
                // Kuen surface parametric equations:
                // x = (2(cos(u) + u*sin(u))*sin(v)) / (1 + u^2*sin(v)^2) -- Wait, standard is different
                // Let's use the mathworld standard:
                // x = 2*cosh(u)*(cos(v) + u*sin(v)) / (cosh(u)^2 + u^2) -- wait this is complex
                // Let's stick to the one I wrote but fix singularity

                const denom = 1 + u * u * Math.sin(v) * Math.sin(v);
                const x = (2 * (Math.cos(v) + u * Math.sin(v)) * Math.sin(v)) / denom;
                const y = (2 * (Math.sin(v) - u * Math.cos(v)) * Math.sin(v)) / denom;
                const z = Math.log(Math.tan(v / 2)) + (2 * Math.cos(v)) / denom;

                target.set(x, z, y).multiplyScalar(0.15);
            };
            const geo = createParametricGeometry(func, 128, 128);
            geo.center(); geo.translate(0, 0.5, 0); return geo;
        }
        case SHAPES.ENNEPER_SURFACE: {
            const func = (u: number, v: number, target: THREE.Vector3) => {
                u = (u - 0.5) * 4;
                v = (v - 0.5) * 4;
                const x = u - u * u * u / 3 + u * v * v;
                const y = v - v * v * v / 3 + v * u * u;
                const z = u * u - v * v;
                target.set(x, z, y).multiplyScalar(0.15);
            };
            const geo = createParametricGeometry(func, 128, 128);
            geo.center(); geo.translate(0, 0.5, 0); return geo;
        }
        case SHAPES.RICHMOND_SURFACE: {
            /* const func = (u: number, v: number, target: THREE.Vector3) => {
                 // ... unused
            }; */
            // Better Richmond (Parametric)
            const rich = (u: number, v: number, t: THREE.Vector3) => {
                u *= Math.PI * 2; v = v * 2 + 0.1;
                const x = -1 / (2 * v) * Math.cos(u) - v * v * v / 6 * Math.cos(3 * u);
                const y = -1 / (2 * v) * Math.sin(u) - v * v * v / 6 * Math.sin(3 * u);
                const z = v * Math.cos(u);
                t.set(x, z, y).multiplyScalar(0.4);
            };
            const geo = createParametricGeometry(rich, 128, 64);
            geo.center(); geo.translate(0, 0.5, 0); return geo;
        }
        case SHAPES.SCHERK_SURFACE: {
            const func = (u: number, v: number, target: THREE.Vector3) => {
                u = (u - 0.5) * 5; // -2.5 to 2.5
                v = (v - 0.5) * 5;
                // z = ln(cos y / cos x)
                // Handle asymptotes
                let cx = Math.cos(u); let cy = Math.cos(v);
                if (Math.abs(cx) < 0.1) cx = 0.1;
                if (Math.abs(cy) < 0.1) cy = 0.1; // Avoid infinity
                const z = Math.log(Math.abs(cy / cx));
                target.set(u, z, v).multiplyScalar(0.15);
            };
            const geo = createParametricGeometry(func, 128, 128);
            geo.center(); geo.translate(0, 0.5, 0); return geo;
        }
        case SHAPES.COSTA_SURFACE: {
            // Very complex. Using a torus deformation proxy.
            const func = (u: number, v: number, target: THREE.Vector3) => {
                u *= Math.PI * 2; v *= Math.PI * 2;
                const r = 1 + 0.5 * Math.sin(3 * u);
                const x = r * Math.cos(u) * (2 + Math.cos(v));
                const y = r * Math.sin(u) * (2 + Math.cos(v));
                const z = (r * Math.sin(v)) + Math.cos(3 * u);
                target.set(x, z, y).multiplyScalar(0.15);
            };
            const geo = createParametricGeometry(func, 128, 64);
            geo.center(); geo.translate(0, 0.5, 0); return geo;
        }
        case SHAPES.CATENOID: {
            const func = (u: number, v: number, target: THREE.Vector3) => {
                u = (u - 0.5) * Math.PI * 2; // -PI to PI
                v = (v - 0.5) * 3; // Height
                const c = 1; // Constant
                const x = c * Math.cosh(v / c) * Math.cos(u);
                const z = c * Math.cosh(v / c) * Math.sin(u);
                const y = v;
                target.set(x, y, z).multiplyScalar(0.15);
            };
            const geo = createParametricGeometry(func, 128, 64);
            geo.center(); geo.translate(0, 0.5, 0); return geo;
        }
        case SHAPES.HELICOID: {
            const func = (u: number, v: number, target: THREE.Vector3) => {
                u = (u - 0.5) * 6; // Height
                v = (v - 0.5) * 4; // Radius
                const x = v * Math.cos(u);
                const z = v * Math.sin(u);
                const y = u;
                target.set(x, y, z).multiplyScalar(0.15);
            };
            const geo = createParametricGeometry(func, 128, 64);
            geo.center(); geo.translate(0, 0.5, 0); return geo;
        }
        case SHAPES.ASTROIDAL_ELLIPSOID: {
            const func = (u: number, v: number, target: THREE.Vector3) => {
                u = u * Math.PI - Math.PI / 2;
                v = v * 2 * Math.PI - Math.PI;
                const pow = (x: number) => Math.pow(Math.abs(x), 3); // Astroid power
                const x = pow(Math.cos(u)) * pow(Math.cos(v));
                const y = pow(Math.cos(u)) * pow(Math.sin(v));
                const z = pow(Math.sin(u));
                target.set(x, z, y).multiplyScalar(0.5);
            };
            const geo = createParametricGeometry(func, 128, 128);
            geo.center(); geo.translate(0, 0.5, 0); return geo;
        }
        case SHAPES.BOHEMIAN_DOME: {
            const func = (u: number, v: number, target: THREE.Vector3) => {
                u *= Math.PI * 2; v *= Math.PI * 2;
                const a = 1, b = 1, c = 0.5;
                const x = a * Math.cos(u);
                const y = b * Math.cos(v) + a * Math.sin(u);
                const z = c * Math.sin(v);
                target.set(x, z, y).multiplyScalar(0.3);
            };
            const geo = createParametricGeometry(func, 128, 128);
            geo.center(); geo.translate(0, 0.5, 0); return geo;
        }
        case SHAPES.CLEBSCH_CUBIC: {
            // Approximating the diagonal surface
            const func = (u: number, v: number, target: THREE.Vector3) => {
                u = (u - 0.5) * 2; v = (v - 0.5) * 2;
                const r = 1 - u * u - v * v;
                const h = r > 0 ? Math.pow(r, 1.5) : 0; // Cubic bulge
                target.set(u, h, v).multiplyScalar(0.5);
                // Twist it to look like Clebsch
                target.y += (u * u * u - v * v * v) * 0.3;
            };
            const geo = createParametricGeometry(func, 128, 128);
            geo.center(); geo.translate(0, 0.5, 0); return geo;
        }
        case SHAPES.WATTS_CURVE: {
            const func = (u: number, v: number, target: THREE.Vector3) => {
                u *= Math.PI * 2; v *= Math.PI; // Tube around curve
                // const a = 1, c = 1;
                // Watt's Curve 2D
                // const sinu = Math.sin(u);
                // const cosu = Math.cos(u);
                const wx = Math.sin(u);
                const wy = Math.sin(2 * u) * 0.5; // Lemniscate-ish

                // Extrude to 3D
                const r = 0.1;
                target.set(wx + r * Math.cos(v), wy + r * Math.sin(v), u * 0.1 - 0.3).multiplyScalar(0.6);
            };
            const geo = createParametricGeometry(func, 128, 32);
            geo.center(); geo.translate(0, 0.5, 0); return geo;
        }
        case SHAPES.BLACK_HOLE: {
            const geos = [];
            // Event Horizon
            const sphere = new THREE.SphereGeometry(0.3, 64, 64);
            geos.push(sphere);

            // Accretion Disk (Deformed)
            const diskFunc = (u: number, v: number, target: THREE.Vector3) => {
                u *= Math.PI * 2; // Angle
                v = 0.4 + v * 0.6; // Radius from 0.4 to 1.0

                // Relativistic Beaming / Lensing effect (Bend up at back)
                let y = 0;
                const bend = Math.cos(u);
                if (bend < 0) {
                    // Back of disk bends UP visually
                    y = -bend * (1 / v) * 0.1;
                }

                const x = v * Math.cos(u);
                const z = v * Math.sin(u);
                target.set(x, y, z);
            };
            const disk = createParametricGeometry(diskFunc, 128, 32);
            geos.push(disk);

            // Photon Ring
            const ring = new THREE.TorusGeometry(0.35, 0.005, 16, 128);
            ring.rotateX(Math.PI / 2);
            geos.push(ring);

            const g = mergeGeometries(geos);
            g.center(); g.translate(0, 0.5, 0); return g;
        }

        // --- TIER 4: PLATONIC ---
        case SHAPES.TETRAHEDRON: return new THREE.TetrahedronGeometry(0.5).translate(0, 0.5, 0);
        case SHAPES.OCTAHEDRON: return new THREE.OctahedronGeometry(0.5).translate(0, 0.5, 0);
        case SHAPES.DODECAHEDRON: return new THREE.DodecahedronGeometry(0.5).translate(0, 0.5, 0);
        case SHAPES.ICOSA: return new THREE.IcosahedronGeometry(0.5).translate(0, 0.5, 0);
        case SHAPES.TRUNC_ICOSA: return new THREE.IcosahedronGeometry(0.5, 1).translate(0, 0.5, 0); // Approx
        case SHAPES.RHOMBIC: return new THREE.OctahedronGeometry(0.5, 1).translate(0, 0.5, 0); // Approx
        case SHAPES.BUCKYBALL: return new THREE.IcosahedronGeometry(0.5, 1).translate(0, 0.5, 0);

        // --- TIER 5: PROFILES ---
        case SHAPES.PROFILE_I:
        case SHAPES.PROFILE_H:
        case SHAPES.PROFILE_U:
        case SHAPES.PROFILE_T:
        case SHAPES.PROFILE_RAIL:
        case SHAPES.L_EXTRUSION:
        case SHAPES.C_EXTRUSION:
        case SHAPES.T_EXTRUSION: {
            const shape = createProfileShape(type);
            const geo = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false });
            geo.center(); geo.translate(0, 0.5, 0); return geo;
        }

        // --- TIER 6: SDF ---
        case SHAPES.ROUND_BOX: {
            const shape = createRoundedRectShape(1, 1, 0.2);
            const geo = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: true, bevelSegments: 8, bevelSize: 0.2, bevelThickness: 0.2 });
            geo.center(); geo.translate(0, 0.5, 0); return geo;
        }
        case SHAPES.ROUND_CONE: return new THREE.ConeGeometry(0.5, 1, 64).translate(0, 0.5, 0);
        case SHAPES.CAPPED_CONE: return new THREE.CylinderGeometry(0.3, 0.5, 1, 64).translate(0, 0.5, 0);
        case SHAPES.HOLLOW_SPHERE: return new THREE.SphereGeometry(0.5, 64, 64).translate(0, 0.5, 0);
        case SHAPES.CUT_SPHERE: return new THREE.SphereGeometry(0.5, 64, 64, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0, 0);
        case SHAPES.VESICA: return new THREE.ConeGeometry(0.5, 1, 64).scale(1, 0.5, 0.5).translate(0, 0.5, 0); // Approx
        case SHAPES.LINK: return new THREE.TorusGeometry(0.4, 0.15, 32, 64).scale(1, 1, 2).translate(0, 0.5, 0);

        // --- TIER 7: VOID ---
        case SHAPES.CUTTER_BOX: return new THREE.BoxGeometry(1.2, 1.2, 1.2).translate(0, 0.5, 0);
        case SHAPES.DRILL_TIP: return new THREE.ConeGeometry(0.4, 0.5, 32).translate(0, 0.25, 0);
        case SHAPES.KEYHOLE: return new THREE.CylinderGeometry(0.5, 0.5, 0.1, 32).translate(0, 0.05, 0);
        case SHAPES.SLOT: return new THREE.BoxGeometry(0.2, 1, 0.2).translate(0, 0.5, 0);
        case SHAPES.COUNTERSINK: return new THREE.ConeGeometry(0.5, 0.5, 32).translate(0, 0.25, 0);

        // LEGACY
        case SHAPES.WALL: return new THREE.BoxGeometry(2, 1, 0.2, seg, seg, 10).translate(0, 0.5, 0);
        case SHAPES.PLATFORM: return new THREE.BoxGeometry(2, 0.2, 2, seg, 10, seg).translate(0, 0.1, 0);
        case SHAPES.PILLAR: return new THREE.CylinderGeometry(0.2, 0.2, 2, 32, 32).translate(0, 1, 0);
        case SHAPES.TOWER: return new THREE.BoxGeometry(0.5, 3, 0.5, 32, 64, 32).translate(0, 1.5, 0);
        case SHAPES.ARC: return new THREE.TorusGeometry(1, 0.2, 32, 64, Math.PI).rotateY(Math.PI / 2).translate(0, 0, 0);

        // FALLBACK for GREEBLE if WASM fails/hiccups
        case SHAPES.GREEBLE: {
            const geos = [];
            // Center block
            geos.push(new THREE.BoxGeometry(0.8, 0.8, 0.8).translate(0, 0.4, 0));
            // Random greebles attached
            for (let i = 0; i < 6; i++) {
                const size = 0.3;
                const dist = 0.4;
                const box = new THREE.BoxGeometry(size, size, size);
                // Simple variations
                if (i === 0) box.translate(dist, 0.4, 0);
                if (i === 1) box.translate(-dist, 0.4, 0);
                if (i === 2) box.translate(0, 0.4, dist);
                if (i === 3) box.translate(0, 0.4, -dist);
                if (i === 4) box.translate(0, 0.4 + dist, 0);
                geos.push(box);
            }
            const g = mergeGeometries(geos);
            g.center(); g.translate(0, 0.5, 0);
            return g;
        }

        default: return new THREE.BoxGeometry(1, 1, 1, 64, 64, 64).translate(0, 0.5, 0);
    }
};

const corruptGeometry = (geometry: THREE.BufferGeometry, intensity: number = 0.1) => {
    const posAttribute = geometry.attributes.position;
    const vertex = new THREE.Vector3();
    for (let i = 0; i < posAttribute.count; i++) {
        vertex.fromBufferAttribute(posAttribute, i);
        vertex.x += (Math.random() - 0.5) * intensity;
        vertex.y += (Math.random() - 0.5) * intensity;
        vertex.z += (Math.random() - 0.5) * intensity;
        posAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }
    geometry.computeVertexNormals();
    posAttribute.needsUpdate = true;
    return geometry;
};

// --- PROCEDURAL SHAPE GENERATOR (Polar/Cartesian Logic) ---
const generateGreebleProfile = (segments: number, radius: number, noise: number) => {
    const vertices: THREE.Vector2[] = [];
    const safeSegments = Math.max(3, segments);
    const angleStep = (Math.PI * 2) / safeSegments;

    for (let i = 0; i < safeSegments; i++) {
        const currentAngle = i * angleStep;

        // Modulo Logic for "Cool" shapes at high counts
        let modRadius = radius;
        if (segments > 12) {
            // Star/Gear logic
            if (i % 2 === 0) modRadius *= 0.8;
            if (i % 6 === 0) modRadius *= 1.2; // Spike every 6
        }

        // Random Jitter
        const irregularity = (Math.random() - 0.5) * 2 * noise;
        const finalRadius = modRadius + (irregularity * radius * 0.5);

        const x = Math.cos(currentAngle) * finalRadius;
        const y = Math.sin(currentAngle) * finalRadius;
        vertices.push(new THREE.Vector2(x, y));
    }
    return new THREE.Shape(vertices);
};

export const generateHyperGreeble = (material: THREE.Material, params: any, userImports: any[]) => {
    const container = new THREE.Group();
    container.userData.isContainer = true;

    const rng = (min: number, max: number) => Math.random() * (max - min) + min;

    // Complexity Multiplier
    const density = params.density || 0.5;
    const clustering = params.clustering || 0.5;
    const baseCount = 4; // Minimum shapes
    const maxCount = 50; // Maximum shapes
    const count = Math.floor(rng(baseCount, maxCount) * (density * 2.0));

    // Core Structure
    const coreW = rng(0.5, 1.5);
    const coreH = rng(0.5, 2.0);
    const coreD = rng(0.5, 1.5);

    const coreGeo = new THREE.BoxGeometry(coreW, coreH, coreD);
    if (params.distortion > 0) corruptGeometry(coreGeo, params.distortion);

    const core = new THREE.Mesh(coreGeo, material);
    core.castShadow = true;
    core.receiveShadow = true;
    container.add(core);

    // Sub-Modules
    const availableShapes = Object.values(SHAPES);

    for (let i = 0; i < count; i++) {
        const isImport = userImports.length > 0 && Math.random() < (params.useImports ? 0.3 : 0);
        let modMesh;

        if (isImport) {
            const imp = userImports[Math.floor(Math.random() * userImports.length)];
            modMesh = imp.scene.clone(true);
            // Normalize scale
            const box = new THREE.Box3().setFromObject(modMesh);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = (rng(0.2, 0.5) / maxDim);
            modMesh.scale.set(scale, scale, scale);
        } else {
            // Procedural Primitive
            modMesh = new THREE.Mesh();
            modMesh.castShadow = true;
            modMesh.receiveShadow = true;
            modMesh.material = material;

            // Use Shape Generator if high segment count requested or randomly
            const useShapeGen = params.infiniteShapes && Math.random() > 0.5;
            const s = rng(params.scale_min || 0.1, params.scale_max || 0.4);

            if (useShapeGen) {
                const segments = Math.floor(rng(3, params.shapeSegments || 12));
                const shape = generateGreebleProfile(segments, s, params.distortion || 0.1);
                const extrudeSettings = {
                    depth: s * rng(0.2, 2.0),
                    bevelEnabled: true,
                    bevelThickness: s * 0.1,
                    bevelSize: s * 0.05,
                    bevelSegments: 2
                };
                modMesh.geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
                // Center geometry
                modMesh.geometry.center();
            } else {
                // Pick any random shape from the library
                const randomShapeType = availableShapes[Math.floor(Math.random() * availableShapes.length)];
                modMesh.geometry = createGeometry(randomShapeType);

                // Random scaling
                const scaleX = s * rng(0.5, 1.5);
                const scaleY = s * rng(0.5, 1.5);
                const scaleZ = s * rng(0.5, 1.5);
                modMesh.scale.set(scaleX, scaleY, scaleZ);
            }

            if (params.distortion > 0 && !useShapeGen) corruptGeometry(modMesh.geometry, params.distortion);
        }

        // Placement logic based on clustering
        // Let's interpret clustering: 1.0 = tight, 0.0 = spread
        const spread = (1.0 - clustering) * 2.0 + 0.5;

        const face = Math.floor(Math.random() * 6);
        const offset = 0.05;

        // Position relative to core face
        let px = 0, py = 0, pz = 0;

        if (face < 2) { // Top/Bottom
            py = (face === 0 ? 1 : -1) * (coreH / 2 + offset);
            px = rng(-coreW / 2, coreW / 2) * spread;
            pz = rng(-coreD / 2, coreD / 2) * spread;
        } else if (face < 4) { // Left/Right
            px = (face === 2 ? 1 : -1) * (coreW / 2 + offset);
            py = rng(-coreH / 2, coreH / 2) * spread;
            pz = rng(-coreD / 2, coreD / 2) * spread;
            if (!isImport) modMesh.rotation.z = Math.PI / 2;
        } else { // Front/Back
            pz = (face === 4 ? 1 : -1) * (coreD / 2 + offset);
            px = rng(-coreW / 2, coreW / 2) * spread;
            py = rng(-coreH / 2, coreH / 2) * spread;
            if (!isImport) modMesh.rotation.x = Math.PI / 2;
        }

        modMesh.position.set(px, py, pz);

        // Shader Injection
        if (params.useShaders && !isImport && Math.random() > 0.5) {
            // Assign a random Flux material variant
            const fluxTypes = ['hologram', 'liquid', 'glitch', 'plasma'];
            const fType = fluxTypes[Math.floor(Math.random() * fluxTypes.length)];
            const fMat = getFluxMaterial(fType, {
                time: { value: 0 },
                chaos: { value: params.distortion || 0.5 },
                colorA: { value: new THREE.Color(Math.random() * 0xffffff) },
                colorB: { value: new THREE.Color(0x000000) },
                map: { value: null }
            });
            const shaderMat = new THREE.ShaderMaterial(fMat);
            shaderMat.userData.isFlux = true;
            shaderMat.userData.fluxType = fType;
            modMesh.material = shaderMat;
        }

        container.add(modMesh);
    }

    return container;
};

export const generateSuperGreeble = (material: THREE.Material) => {
    const container = new THREE.Group();
    container.userData.isContainer = true;
    const coreW = 0.5 + Math.random() * 0.5; const coreH = 0.5 + Math.random() * 0.5; const coreD = 0.5 + Math.random() * 0.5;
    const core = new THREE.Mesh(new THREE.BoxGeometry(coreW, coreH, coreD), material);
    core.castShadow = true; core.receiveShadow = true; container.add(core);
    const numModules = 4 + Math.floor(Math.random() * 6);
    for (let i = 0; i < numModules; i++) {
        const type = Math.floor(Math.random() * 4);
        const modMesh = new THREE.Mesh(); modMesh.castShadow = true; modMesh.receiveShadow = true; modMesh.material = material;
        const face = Math.floor(Math.random() * 6); const offset = 0.05;
        if (type === 0) { modMesh.geometry = new THREE.BoxGeometry(coreW * 0.8, coreH * 0.1, coreD * 0.8); if (face < 2) modMesh.scale.set(1, 1, 1); else modMesh.scale.set(0.1, 1, 1); }
        else if (type === 1) { modMesh.geometry = new THREE.BoxGeometry(coreW * 0.9, coreH * 0.05, coreD * 0.05); }
        else if (type === 2) { modMesh.geometry = new THREE.CylinderGeometry(0.1, 0.1, Math.max(coreW, coreH), 16); modMesh.rotation.z = Math.PI / 2; }
        else { modMesh.geometry = new THREE.SphereGeometry(0.15, 16, 16); }
        if (face === 0 || face === 1) { modMesh.position.set((Math.random() - 0.5) * coreW, (face === 0 ? 1 : -1) * (coreH / 2 + offset), (Math.random() - 0.5) * coreD); }
        else if (face === 2 || face === 3) { modMesh.position.set((face === 2 ? 1 : -1) * (coreW / 2 + offset), (Math.random() - 0.5) * coreH, (Math.random() - 0.5) * coreD); modMesh.rotation.z = Math.PI / 2; }
        else { modMesh.position.set((Math.random() - 0.5) * coreW, (Math.random() - 0.5) * coreH, (face === 4 ? 1 : -1) * (coreD / 2 + offset)); modMesh.rotation.x = Math.PI / 2; }
        container.add(modMesh);
    }
    return container;
};

// --- FLUX SHADER (GLSL) ---
export const FluxShader = {
    uniforms: {
        time: { value: 1.0 },
        chaos: { value: 0.0 },
        colorA: { value: new THREE.Color("#ff003c") },
        colorB: { value: new THREE.Color("#000000") },
        map: { value: null } // Added map uniform support
    },
    // Common noise functions for re-use
    common: `
    // Simplex noise function
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
    float snoise(vec3 v) {
      const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
      const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i  = floor(v + dot(v, C.yyy) );
      vec3 x0 = v - i + dot(i, C.xxx) ;
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min( g.xyz, l.zxy );
      vec3 i2 = max( g.xyz, l.zxy );
      vec3 x0_copy = x0; 
      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;
      i = mod289(i);
      vec4 p = permute( permute( permute( i.z + vec4(0.0, i1.z, i2.z, 1.0 )) + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
      float n_ = 0.142857142857;
      vec3  ns = n_ * D.wyz - D.xzx;
      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_ );
      vec4 x = x_ *ns.x + ns.yyyy;
      vec4 y = y_ *ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);
      vec4 b0 = vec4( x.xy, y.xy );
      vec4 b1 = vec4( x.zw, y.zw );
      vec4 s0 = floor(b0)*2.0 + 1.0;
      vec4 s1 = floor(b1)*2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
      vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
      vec3 p0 = vec3(a0.xy,h.x);
      vec3 p1 = vec3(a0.zw,h.y);
      vec3 p2 = vec3(a1.xy,h.z);
      vec3 p3 = vec3(a1.zw,h.w);
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
      p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
    }
  `,
    // Vertex Shaders per Type
    vertex: {
        standard: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying float vDisplacement;
      uniform float time;
      uniform float chaos;
      // [INSERT_COMMON]

      void main() {
        vUv = uv;
        vNormal = normal;
        
        float noise = snoise(position * 2.0 + time * 0.5);
        vDisplacement = noise * chaos;
        
        vec3 newPos = position + normal * vDisplacement;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
      }
    `,
        hologram: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying float vDisplacement;
      varying vec3 vPos;
      uniform float time;
      uniform float chaos;
      // [INSERT_COMMON]

      void main() {
        vUv = uv;
        vNormal = normal;
        
        // Glitch jitter
        float jitter = step(0.95, sin(time * 20.0 + position.y * 10.0)) * chaos * 0.1;
        vec3 newPos = position;
        newPos.x += jitter;
        vPos = newPos;
        
        vDisplacement = jitter;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
      }
    `,
        liquid: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying float vDisplacement;
      uniform float time;
      uniform float chaos;
      // [INSERT_COMMON]

      void main() {
        vUv = uv;
        vNormal = normal;
        
        float noise1 = snoise(position * 1.5 + time * 0.8);
        float noise2 = snoise(position * 3.0 - time * 1.2);
        
        vDisplacement = (noise1 + noise2) * 0.5 * chaos;
        
        vec3 newPos = position + normal * vDisplacement;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
      }
    `,
        glitch: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying float vDisplacement;
      uniform float time;
      uniform float chaos;
      // [INSERT_COMMON]

      void main() {
        vUv = uv;
        vNormal = normal;
        
        // Quantize position
        float q = 5.0 + (1.0-chaos) * 20.0;
        vec3 qPos = floor(position * q) / q;
        
        float noise = snoise(qPos * 2.0 + time * 5.0);
        float spike = step(0.8, noise) * chaos * 0.5;
        
        vec3 newPos = position + normal * spike;
        
        // Random offset
        if(noise > 0.9) newPos += normal * sin(time * 50.0) * 0.2 * chaos;

        vDisplacement = spike;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
      }
    `,
        plasma: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying float vDisplacement;
      uniform float time;
      uniform float chaos;
      // [INSERT_COMMON]

      void main() {
        vUv = uv;
        vNormal = normal;
        
        float n = 0.0;
        vec3 pos = position;
        float freq = 1.0;
        float amp = 1.0;
        
        for(int i=0; i<3; i++) {
            n += snoise(pos * freq + time) * amp;
            freq *= 2.0;
            amp *= 0.5;
        }
        
        vDisplacement = n * chaos * 0.5;
        vec3 newPos = position + normal * vDisplacement;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
      }
    `
    },
    // Fragment Shaders per Type
    fragment: {
        standard: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying float vDisplacement;
      uniform vec3 colorA;
      uniform vec3 colorB;
      uniform float chaos;
      uniform float time;
      uniform sampler2D map;

      void main() {
        vec4 texColor = texture2D(map, vUv);
        float fresnel = dot(vNormal, vec3(0.0, 0.0, 1.0));
        vec3 mixColor = mix(colorB, colorA, vDisplacement * 2.0 + 0.5);
        float grid = step(0.95, fract(vUv.x * 20.0)) + step(0.95, fract(vUv.y * 20.0));
        vec3 finalColor = mix(mixColor, vec3(1.0), grid * chaos * 0.5);
        finalColor = mix(finalColor, texColor.rgb, 0.5);
        float pulse = sin(time * 2.0) * 0.5 + 0.5;
        finalColor += vec3(pulse * 0.2 * chaos);
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
        hologram: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPos;
      uniform vec3 colorA;
      uniform vec3 colorB;
      uniform float chaos;
      uniform float time;
      uniform sampler2D map;

      void main() {
        vec4 texColor = texture2D(map, vUv);
        
        float scanline = sin(vPos.y * 50.0 - time * 5.0) * 0.5 + 0.5;
        float rim = 1.0 - dot(normalize(vNormal), vec3(0.0, 0.0, 1.0));
        rim = pow(rim, 3.0);
        
        vec3 holoColor = mix(colorB, colorA, rim + scanline * 0.2);
        
        // Add noise grain
        float noise = fract(sin(dot(vUv, vec2(12.9898, 78.233))) * 43758.5453);
        holoColor += noise * 0.1 * chaos;

        vec3 finalColor = mix(holoColor, texColor.rgb, 0.2); // Mostly holo
        
        float alpha = rim + scanline * 0.5;
        alpha = clamp(alpha, 0.0, 1.0);
        
        gl_FragColor = vec4(finalColor, alpha);
      }
    `,
        liquid: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying float vDisplacement;
      uniform vec3 colorA;
      uniform vec3 colorB;
      uniform float chaos;
      uniform float time;
      uniform sampler2D map;

      void main() {
        vec4 texColor = texture2D(map, vUv);
        
        // Specular highlight
        vec3 viewDir = vec3(0.0, 0.0, 1.0);
        vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
        vec3 reflectDir = reflect(-lightDir, vNormal);
        float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
        
        vec3 fluidColor = mix(colorB, colorA, vDisplacement + 0.5);
        fluidColor += vec3(spec);
        
        vec3 finalColor = mix(fluidColor, texColor.rgb, 0.3);
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
        glitch: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying float vDisplacement;
      uniform vec3 colorA;
      uniform vec3 colorB;
      uniform float chaos;
      uniform float time;
      uniform sampler2D map;

      void main() {
        vec2 uv = vUv;
        // UV shift
        float shift = step(0.9, sin(uv.y * 10.0 + time * 10.0)) * chaos * 0.1;
        uv.x += shift;
        
        vec4 texColor = texture2D(map, uv);
        
        vec3 glitchColor = mix(colorB, colorA, abs(vDisplacement) * 5.0);
        
        // Chromatic aberration
        float r = texture2D(map, uv + vec2(0.01 * chaos, 0.0)).r;
        float b = texture2D(map, uv - vec2(0.01 * chaos, 0.0)).b;
        
        vec3 finalColor = mix(glitchColor, vec3(r, texColor.g, b), 0.6);
        
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
        plasma: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying float vDisplacement;
      uniform vec3 colorA;
      uniform vec3 colorB;
      uniform float chaos;
      uniform float time;
      uniform sampler2D map;

      void main() {
        vec4 texColor = texture2D(map, vUv);
        
        float pattern = sin(vUv.x * 10.0 + time) * sin(vUv.y * 10.0 - time);
        pattern += sin(length(vUv - 0.5) * 20.0 + time * 2.0);
        
        vec3 plasmaColor = mix(colorB, colorA, pattern * 0.5 + 0.5);
        plasmaColor += vDisplacement * 2.0; // Highlight peaks
        
        vec3 finalColor = mix(plasmaColor, texColor.rgb, 0.4);
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `
    }
};

// Helper to get shader material params
export const getFluxMaterial = (type: string, uniforms: any) => {
    const t = (type in FluxShader.vertex) ? type : 'standard';
    // Inject common code
    const vert = FluxShader.vertex[t as keyof typeof FluxShader.vertex].replace('// [INSERT_COMMON]', FluxShader.common);
    const frag = FluxShader.fragment[t as keyof typeof FluxShader.fragment];

    return {
        uniforms: uniforms,
        vertexShader: vert,
        fragmentShader: frag,
        wireframe: false,
        transparent: t === 'hologram', // Enable transparency for hologram
        side: THREE.DoubleSide
    };
};
