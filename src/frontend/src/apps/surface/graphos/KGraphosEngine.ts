
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PaintEngine, PaintLayer } from '../../../core/surface/PaintSystem';
import {
    QUAD_VERT, GEN_NOISE_FRAG, GEN_PATTERN_FRAG, GEN_VORONOI_FRAG, GEN_FBM_FRAG,
    FILTER_BLUR_FRAG, FILTER_NORMAL_FRAG, FILTER_LEVELS_FRAG, FILTER_PIXEL_SORT_FRAG, FILTER_EDGE_FRAG,
    SIM_DRIP_FRAG, SIM_BLEED_FRAG, SIM_LIQUIFY_FRAG,
    SIM_WIND_FRAG, SIM_MAGNETIC_FRAG, SIM_DATAMOSH_FRAG,
    SIM_NEBULA_FRAG, SIM_THERMAL_FRAG, SIM_SORT_FRAG, SIM_LIFE_FRAG,
    VORTEX_FRAG, BLACK_HOLE_FRAG,
    // New generators & filters
    GEN_GRADIENT_FRAG, GEN_SEAMLESS_FRAG, GEN_AO_FRAG, GEN_CURVATURE_FRAG,
    FILTER_SHARPEN_FRAG, FILTER_HSL_FRAG, FILTER_POSTERIZE_FRAG, FILTER_EMBOSS_FRAG, FILTER_THRESHOLD_FRAG
} from './GraphosShaders';

export interface GraphosConfig {
    width: number;
    height: number;
}

export const initGraphosEngine = (canvas: HTMLCanvasElement, config: GraphosConfig = { width: 2048, height: 2048 }) => {
    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
        premultipliedAlpha: false
    });
    canvas.style.transformOrigin = 'center center';
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(config.width, config.height, false);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();

    const orthoCamera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.1, 1000);
    orthoCamera.position.z = 10;

    const perspectiveCamera = new THREE.PerspectiveCamera(45, config.width / config.height, 0.1, 10000);
    perspectiveCamera.position.set(0, 0, 1.5);

    let activeCamera: THREE.Camera = orthoCamera;

    const geo = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        transparent: true,
        roughness: 1.0,
        metalness: 0.0,
        side: THREE.DoubleSide
    });
    const quadMesh = new THREE.Mesh(geo, material);
    scene.add(quadMesh);

    const ambient = new THREE.AmbientLight(0xffffff, 0.8);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(5, 5, 10);
    scene.add(ambient, dirLight);

    const backLight = new THREE.DirectionalLight(0xff00cc, 0.5);
    backLight.position.set(0, 0, -10);
    scene.add(backLight);

    const controls = new OrbitControls(perspectiveCamera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enabled = true; // Enable globally for Zoom
    controls.enableRotate = false; // Disable rotate by default (Painting mode)
    controls.enableZoom = true;
    controls.enablePan = false; // We pan with standard pan logic or maybe Right Click in future, but for now disable conflict

    const paintEngine = new PaintEngine(renderer);
    let layers: PaintLayer[] = [];
    const compLayer = new PaintLayer('graphos_comp', 'Composite', config.width, config.height);

    const genMaterials = {
        noise: new THREE.ShaderMaterial({ uniforms: { uScale: { value: 1.0 }, uDetail: { value: 4.0 }, uSeed: { value: 0.0 }, uColorA: { value: new THREE.Color(0, 0, 0) }, uColorB: { value: new THREE.Color(1, 1, 1) } }, vertexShader: QUAD_VERT, fragmentShader: GEN_NOISE_FRAG }),
        pattern: new THREE.ShaderMaterial({ uniforms: { uScale: { value: 10.0 }, uMode: { value: 0 }, uColorA: { value: new THREE.Color(0, 0, 0) }, uColorB: { value: new THREE.Color(1, 1, 1) } }, vertexShader: QUAD_VERT, fragmentShader: GEN_PATTERN_FRAG }),
        voronoi: new THREE.ShaderMaterial({ uniforms: { uScale: { value: 5.0 }, uSeed: { value: 0.0 }, uColorA: { value: new THREE.Color(0, 0, 0) }, uColorB: { value: new THREE.Color(1, 1, 1) } }, vertexShader: QUAD_VERT, fragmentShader: GEN_VORONOI_FRAG }),
        fbm: new THREE.ShaderMaterial({ uniforms: { uScale: { value: 2.0 }, uSeed: { value: 0.0 }, uColorA: { value: new THREE.Color(0, 0, 0) }, uColorB: { value: new THREE.Color(1, 1, 1) }, uTime: { value: 0 } }, vertexShader: QUAD_VERT, fragmentShader: GEN_FBM_FRAG }),

        filterBlur: new THREE.ShaderMaterial({ uniforms: { tInput: { value: null }, uResolution: { value: new THREE.Vector2(config.width, config.height) }, uStrength: { value: 1.0 }, uDirection: { value: new THREE.Vector2(1, 0) } }, vertexShader: QUAD_VERT, fragmentShader: FILTER_BLUR_FRAG }),
        filterNormal: new THREE.ShaderMaterial({ uniforms: { tInput: { value: null }, uResolution: { value: new THREE.Vector2(config.width, config.height) }, uStrength: { value: 1.0 } }, vertexShader: QUAD_VERT, fragmentShader: FILTER_NORMAL_FRAG }),
        filterLevels: new THREE.ShaderMaterial({ uniforms: { tInput: { value: null }, uMin: { value: 0.0 }, uMax: { value: 1.0 }, uGamma: { value: 1.0 }, uInvert: { value: false } }, vertexShader: QUAD_VERT, fragmentShader: FILTER_LEVELS_FRAG }),
        filterPixelSort: new THREE.ShaderMaterial({ uniforms: { tInput: { value: null }, uResolution: { value: new THREE.Vector2(config.width, config.height) }, uThreshold: { value: 0.2 } }, vertexShader: QUAD_VERT, fragmentShader: FILTER_PIXEL_SORT_FRAG }),
        filterEdge: new THREE.ShaderMaterial({ uniforms: { tInput: { value: null }, uResolution: { value: new THREE.Vector2(config.width, config.height) } }, vertexShader: QUAD_VERT, fragmentShader: FILTER_EDGE_FRAG }),

        simDrip: new THREE.ShaderMaterial({ uniforms: { tInput: { value: null }, uResolution: { value: new THREE.Vector2(config.width, config.height) }, uSpeed: { value: 1.0 }, uThreshold: { value: 0.1 } }, vertexShader: QUAD_VERT, fragmentShader: SIM_DRIP_FRAG }),
        simBleed: new THREE.ShaderMaterial({ uniforms: { tInput: { value: null }, uResolution: { value: new THREE.Vector2(config.width, config.height) }, uSpeed: { value: 1.0 } }, vertexShader: QUAD_VERT, fragmentShader: SIM_BLEED_FRAG }),
        simLiquify: new THREE.ShaderMaterial({ uniforms: { tInput: { value: null }, tVelocity: { value: null }, uSpeed: { value: 1.0 } }, vertexShader: QUAD_VERT, fragmentShader: SIM_LIQUIFY_FRAG }),
        simWind: new THREE.ShaderMaterial({ uniforms: { tInput: { value: null }, uResolution: { value: new THREE.Vector2(config.width, config.height) }, uSpeed: { value: 1.0 }, uWindDir: { value: new THREE.Vector2(1, 0) } }, vertexShader: QUAD_VERT, fragmentShader: SIM_WIND_FRAG }),
        simMagnetic: new THREE.ShaderMaterial({ uniforms: { tInput: { value: null }, uResolution: { value: new THREE.Vector2(config.width, config.height) }, uSpeed: { value: 1.0 } }, vertexShader: QUAD_VERT, fragmentShader: SIM_MAGNETIC_FRAG }),
        simDatamosh: new THREE.ShaderMaterial({ uniforms: { tInput: { value: null }, uResolution: { value: new THREE.Vector2(config.width, config.height) }, uSpeed: { value: 1.0 } }, vertexShader: QUAD_VERT, fragmentShader: SIM_DATAMOSH_FRAG }),
        simNebula: new THREE.ShaderMaterial({ uniforms: { tInput: { value: null }, uTime: { value: 0 }, uSpeed: { value: 1.0 }, uChaos: { value: 1.0 }, uScale: { value: 1.0 } }, vertexShader: QUAD_VERT, fragmentShader: SIM_NEBULA_FRAG }),
        simThermal: new THREE.ShaderMaterial({ uniforms: { tInput: { value: null }, uResolution: { value: new THREE.Vector2(config.width, config.height) }, uSpeed: { value: 1.0 }, uDecay: { value: 0.99 } }, vertexShader: QUAD_VERT, fragmentShader: SIM_THERMAL_FRAG }),
        simSort: new THREE.ShaderMaterial({ uniforms: { tInput: { value: null }, uResolution: { value: new THREE.Vector2(config.width, config.height) }, uSpeed: { value: 1.0 }, uChaos: { value: 0.0 } }, vertexShader: QUAD_VERT, fragmentShader: SIM_SORT_FRAG }),
        simLife: new THREE.ShaderMaterial({ uniforms: { tInput: { value: null }, uResolution: { value: new THREE.Vector2(config.width, config.height) }, uSpeed: { value: 1.0 }, uChaos: { value: 1.0 }, uTime: { value: 0 } }, vertexShader: QUAD_VERT, fragmentShader: SIM_LIFE_FRAG }),
        simVortex: new THREE.ShaderMaterial({ uniforms: { tSource: { value: null }, time: { value: 0 }, resolution: { value: new THREE.Vector2(config.width, config.height) } }, vertexShader: QUAD_VERT, fragmentShader: VORTEX_FRAG }),
        simBlackHole: new THREE.ShaderMaterial({ uniforms: { tVelocity: { value: null }, uCenter: { value: new THREE.Vector2(0.5, 0.5) }, uStrength: { value: 10.0 }, uSpin: { value: 5.0 }, uRadius: { value: 0.1 }, uDecay: { value: 0.95 }, uDt: { value: 0.016 } }, vertexShader: QUAD_VERT, fragmentShader: BLACK_HOLE_FRAG }),

        // NEW Generators
        gradient: new THREE.ShaderMaterial({ uniforms: { uMode: { value: 0 }, uAngle: { value: 0.0 }, uColorA: { value: new THREE.Color(0, 0, 0) }, uColorB: { value: new THREE.Color(1, 1, 1) }, uCenter: { value: new THREE.Vector2(0.5, 0.5) } }, vertexShader: QUAD_VERT, fragmentShader: GEN_GRADIENT_FRAG }),
        seamless: new THREE.ShaderMaterial({ uniforms: { tInput: { value: null }, uBlend: { value: 0.25 } }, vertexShader: QUAD_VERT, fragmentShader: GEN_SEAMLESS_FRAG }),
        ao: new THREE.ShaderMaterial({ uniforms: { tInput: { value: null }, uResolution: { value: new THREE.Vector2(config.width, config.height) }, uRadius: { value: 5.0 }, uIntensity: { value: 2.0 } }, vertexShader: QUAD_VERT, fragmentShader: GEN_AO_FRAG }),
        curvature: new THREE.ShaderMaterial({ uniforms: { tInput: { value: null }, uResolution: { value: new THREE.Vector2(config.width, config.height) }, uStrength: { value: 5.0 } }, vertexShader: QUAD_VERT, fragmentShader: GEN_CURVATURE_FRAG }),

        // NEW Filters
        filterSharpen: new THREE.ShaderMaterial({ uniforms: { tInput: { value: null }, uResolution: { value: new THREE.Vector2(config.width, config.height) }, uStrength: { value: 1.0 } }, vertexShader: QUAD_VERT, fragmentShader: FILTER_SHARPEN_FRAG }),
        filterHSL: new THREE.ShaderMaterial({ uniforms: { tInput: { value: null }, uHue: { value: 0.0 }, uSaturation: { value: 1.0 }, uLightness: { value: 0.0 } }, vertexShader: QUAD_VERT, fragmentShader: FILTER_HSL_FRAG }),
        filterPosterize: new THREE.ShaderMaterial({ uniforms: { tInput: { value: null }, uLevels: { value: 4.0 } }, vertexShader: QUAD_VERT, fragmentShader: FILTER_POSTERIZE_FRAG }),
        filterEmboss: new THREE.ShaderMaterial({ uniforms: { tInput: { value: null }, uResolution: { value: new THREE.Vector2(config.width, config.height) }, uStrength: { value: 2.0 } }, vertexShader: QUAD_VERT, fragmentShader: FILTER_EMBOSS_FRAG }),
        filterThreshold: new THREE.ShaderMaterial({ uniforms: { tInput: { value: null }, uThreshold: { value: 0.5 } }, vertexShader: QUAD_VERT, fragmentShader: FILTER_THRESHOLD_FRAG }),
    };

    const compose = () => {
        if (!layers || layers.length === 0) {
            material.map = null;
            material.needsUpdate = true;
            return;
        }
        try {
            paintEngine.compose(layers, compLayer);
            const tex = compLayer.getRead('albedo').texture;
            if (tex) {
                material.map = tex;
                material.normalMap = compLayer.getRead('normal').texture;
                material.roughnessMap = compLayer.getRead('roughness').texture;
                material.metalnessMap = compLayer.getRead('metalness').texture;
                material.needsUpdate = true;
            }
        } catch (e) {
            console.error("Compose failed:", e);
        }
    };

    const addLayer = (id: string, name: string, initialColor?: number[]) => {
        const layer = new PaintLayer(id, name, config.width, config.height);
        paintEngine.clearLayer(layer);
        if (initialColor) {
            paintEngine.fillLayer(layer, { albedo: initialColor, normal: [0.5, 0.5, 1, 0], roughness: [0, 0, 0, 0], metalness: [0, 0, 0, 0], emission: [0, 0, 0, 0] });
        }
        layers.push(layer);
        compose();
    };

    const deleteLayer = (id: string) => {
        const idx = layers.findIndex(l => l.id === id);
        if (idx !== -1) {
            const layer = layers[idx];
            layer.dispose();
            layers.splice(idx, 1);
            compose();
        }
    };

    const getLayer = (id: string) => layers.find(l => l.id === id);

    const runSim = (layerId: string, type: string, params: any) => {
        const layer = getLayer(layerId);
        if (!layer) return;

        const run = (mat: THREE.ShaderMaterial, target: any) => {
            renderer.setRenderTarget(target);
            paintEngine.copyMesh.material = mat;
            renderer.render(paintEngine.copyScene, paintEngine.copyCamera);
            renderer.setRenderTarget(null);
        };

        if (type === 'DRIP') {
            const mat = genMaterials.simDrip; mat.uniforms.tInput.value = layer.getRead('albedo').texture; mat.uniforms.uSpeed.value = params.speed;
            run(mat, layer.getWrite('albedo')); layer.swap('albedo');
        }
        else if (type === 'BLEED') {
            const mat = genMaterials.simBleed; mat.uniforms.tInput.value = layer.getRead('albedo').texture; mat.uniforms.uSpeed.value = params.speed;
            run(mat, layer.getWrite('albedo')); layer.swap('albedo');
        }
        else if (type === 'LIQUIFY') {
            // Use real fluid simulation for viscous feel across all channels
            paintEngine.stepFluid(layer, ['albedo', 'normal', 'roughness', 'metalness', 'emission']);
        }
        else if (type === 'WIND') {
            const mat = genMaterials.simWind; mat.uniforms.tInput.value = layer.getRead('albedo').texture; mat.uniforms.uSpeed.value = params.speed; if (currentVelocity) mat.uniforms.uWindDir.value.copy(currentVelocity);
            run(mat, layer.getWrite('albedo')); layer.swap('albedo');
        }
        else if (type === 'MAGNETIC') {
            const mat = genMaterials.simMagnetic; mat.uniforms.tInput.value = layer.getRead('albedo').texture; mat.uniforms.uSpeed.value = params.speed;
            run(mat, layer.getWrite('albedo')); layer.swap('albedo');
        }
        else if (type === 'DATAMOSH') {
            const mat = genMaterials.simDatamosh; mat.uniforms.tInput.value = layer.getRead('albedo').texture; mat.uniforms.uSpeed.value = params.speed;
            run(mat, layer.getWrite('albedo')); layer.swap('albedo');
        }
        else if (type === 'NEBULA') {
            const mat = genMaterials.simNebula; mat.uniforms.tInput.value = layer.getRead('albedo').texture;
            mat.uniforms.uSpeed.value = params.speed; mat.uniforms.uChaos.value = params.chaos; mat.uniforms.uScale.value = params.scale; mat.uniforms.uTime.value = performance.now() * 0.001;
            run(mat, layer.getWrite('albedo')); layer.swap('albedo');
        }
        else if (type === 'THERMAL') {
            const mat = genMaterials.simThermal; mat.uniforms.tInput.value = layer.getRead('albedo').texture; mat.uniforms.uSpeed.value = params.speed; mat.uniforms.uDecay.value = params.decay;
            run(mat, layer.getWrite('albedo')); layer.swap('albedo');
        }
        else if (type === 'SORT') {
            const mat = genMaterials.simSort; mat.uniforms.tInput.value = layer.getRead('albedo').texture; mat.uniforms.uSpeed.value = params.speed; mat.uniforms.uChaos.value = params.chaos;
            run(mat, layer.getWrite('albedo')); layer.swap('albedo');
        }
        else if (type === 'LIFE') {
            const mat = genMaterials.simLife; mat.uniforms.tInput.value = layer.getRead('albedo').texture; mat.uniforms.uSpeed.value = params.speed; mat.uniforms.uChaos.value = params.chaos; mat.uniforms.uTime.value = performance.now() * 0.001;
            run(mat, layer.getWrite('albedo')); layer.swap('albedo');
        }
        else if (type === 'VORTEX') { paintEngine.stepVortex(layer); }
        else if (type === 'GRAVITY') { paintEngine.stepGravity(layer, params); }
        else if (type === 'RIVULET') { paintEngine.stepRivulet(layer, params); }
        else if (type === 'GROWTH') { paintEngine.stepGrowth(layer, params); }
    };

    const applyGenerator = (layerId: string, type: string, params: any) => {
        const layer = getLayer(layerId);
        if (!layer) return;
        let mat: THREE.ShaderMaterial | null = null;

        if (type === 'NOISE') { mat = genMaterials.noise; mat.uniforms.uScale.value = params.scale; mat.uniforms.uDetail.value = params.detail; mat.uniforms.uSeed.value = Math.random(); mat.uniforms.uColorA.value.set(params.colorA); mat.uniforms.uColorB.value.set(params.colorB); }
        else if (type === 'PATTERN') { mat = genMaterials.pattern; mat.uniforms.uScale.value = params.scale; mat.uniforms.uMode.value = params.mode; mat.uniforms.uColorA.value.set(params.colorA); mat.uniforms.uColorB.value.set(params.colorB); }
        else if (type === 'VORONOI') { mat = genMaterials.voronoi; mat.uniforms.uScale.value = params.scale; mat.uniforms.uSeed.value = Math.random(); mat.uniforms.uColorA.value.set(params.colorA); mat.uniforms.uColorB.value.set(params.colorB); }
        else if (type === 'FBM') { mat = genMaterials.fbm; mat.uniforms.uScale.value = params.scale; mat.uniforms.uSeed.value = Math.random(); mat.uniforms.uTime.value = performance.now() * 0.001; mat.uniforms.uColorA.value.set(params.colorA); mat.uniforms.uColorB.value.set(params.colorB); }
        // NEW Generators
        else if (type === 'GRADIENT') { mat = genMaterials.gradient; mat.uniforms.uMode.value = params.mode || 0; mat.uniforms.uAngle.value = params.angle || 0; mat.uniforms.uColorA.value.set(params.colorA || '#000000'); mat.uniforms.uColorB.value.set(params.colorB || '#ffffff'); mat.uniforms.uCenter.value.set(0.5, 0.5); }
        else if (type === 'SEAMLESS') { mat = genMaterials.seamless; mat.uniforms.tInput.value = layer.getRead('albedo').texture; mat.uniforms.uBlend.value = params.blend || 0.25; }
        else if (type === 'AO') { mat = genMaterials.ao; mat.uniforms.tInput.value = layer.getRead('albedo').texture; mat.uniforms.uRadius.value = params.radius || 5.0; mat.uniforms.uIntensity.value = params.intensity || 2.0; }
        else if (type === 'CURVATURE') { mat = genMaterials.curvature; mat.uniforms.tInput.value = layer.getRead('albedo').texture; mat.uniforms.uStrength.value = params.strength || 5.0; }

        if (mat) {
            renderer.setRenderTarget(layer.getWrite('albedo'));
            paintEngine.copyMesh.material = mat;
            renderer.render(paintEngine.copyScene, paintEngine.copyCamera);
            layer.swap('albedo');
            renderer.setRenderTarget(null);
            compose();
        }
    };

    const applyFilter = (layerId: string, type: string, params: any) => {
        const layer = getLayer(layerId);
        if (!layer) return;
        const readTex = layer.getRead('albedo').texture;
        let mat: THREE.ShaderMaterial | null = null;

        if (type === 'BLUR') {
            mat = genMaterials.filterBlur; mat.uniforms.tInput.value = readTex; mat.uniforms.uStrength.value = params.strength; mat.uniforms.uDirection.value.set(1, 0);
            renderer.setRenderTarget(layer.getWrite('albedo')); paintEngine.copyMesh.material = mat; renderer.render(paintEngine.copyScene, paintEngine.copyCamera); layer.swap('albedo');
            mat.uniforms.tInput.value = layer.getRead('albedo').texture; mat.uniforms.uDirection.value.set(0, 1);
            renderer.setRenderTarget(layer.getWrite('albedo')); renderer.render(paintEngine.copyScene, paintEngine.copyCamera); layer.swap('albedo');
            mat = null; // Done
        } else if (type === 'NORMAL') {
            mat = genMaterials.filterNormal; mat.uniforms.tInput.value = readTex; mat.uniforms.uStrength.value = params.strength;
            renderer.setRenderTarget(layer.getWrite('normal')); paintEngine.copyMesh.material = mat; renderer.render(paintEngine.copyScene, paintEngine.copyCamera); layer.swap('normal');
            mat = null;
        } else if (type === 'LEVELS') {
            mat = genMaterials.filterLevels; mat.uniforms.tInput.value = readTex; mat.uniforms.uMin.value = params.min; mat.uniforms.uMax.value = params.max; mat.uniforms.uGamma.value = params.gamma; mat.uniforms.uInvert.value = params.invert;
        } else if (type === 'PIXEL_SORT') {
            mat = genMaterials.filterPixelSort; mat.uniforms.tInput.value = readTex; mat.uniforms.uThreshold.value = params.threshold;
        } else if (type === 'EDGE') {
            mat = genMaterials.filterEdge; mat.uniforms.tInput.value = readTex;
        }
        // NEW Filters
        else if (type === 'SHARPEN') {
            mat = genMaterials.filterSharpen; mat.uniforms.tInput.value = readTex; mat.uniforms.uStrength.value = params.strength || 1.0;
        } else if (type === 'HSL') {
            mat = genMaterials.filterHSL; mat.uniforms.tInput.value = readTex; mat.uniforms.uHue.value = params.hue || 0; mat.uniforms.uSaturation.value = params.saturation || 1.0; mat.uniforms.uLightness.value = params.lightness || 0;
        } else if (type === 'POSTERIZE') {
            mat = genMaterials.filterPosterize; mat.uniforms.tInput.value = readTex; mat.uniforms.uLevels.value = params.levels || 4;
        } else if (type === 'EMBOSS') {
            mat = genMaterials.filterEmboss; mat.uniforms.tInput.value = readTex; mat.uniforms.uStrength.value = params.strength || 2.0;
        } else if (type === 'THRESHOLD') {
            mat = genMaterials.filterThreshold; mat.uniforms.tInput.value = readTex; mat.uniforms.uThreshold.value = params.threshold || 0.5;
        }

        if (mat) {
            renderer.setRenderTarget(layer.getWrite('albedo')); paintEngine.copyMesh.material = mat; renderer.render(paintEngine.copyScene, paintEngine.copyCamera); layer.swap('albedo');
        }
        renderer.setRenderTarget(null);
        compose();
    };

    const render = () => { renderer.render(scene, activeCamera); };

    let zoom = 1.0; let pan = new THREE.Vector2(0, 0);
    const setTransform = (z: number, p: THREE.Vector2) => { if (activeCamera === orthoCamera) { zoom = Math.max(0.01, Math.min(50.0, z)); pan.copy(p); canvas.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`; } };

    const fitToScreen = () => {
        if (canvas.parentElement) {
            const pw = canvas.parentElement.clientWidth; const ph = canvas.parentElement.clientHeight;
            if (pw <= 0 || ph <= 0) return;
            const margin = 40; const scaleX = (pw - margin) / config.width; const scaleY = (ph - margin) / config.height;
            const newZoom = Math.min(scaleX, scaleY, 1.0);
            if (newZoom > 0 && isFinite(newZoom)) { setTransform(newZoom, new THREE.Vector2(0, 0)); }
        }
    }

    const toggle3D = (is3D: boolean) => {
        if (is3D) { activeCamera = perspectiveCamera; canvas.style.transform = 'none'; perspectiveCamera.position.set(0, 0, 1.5); perspectiveCamera.lookAt(0, 0, 0); if (controls) { controls.enabled = true; controls.enableRotate = false; controls.enableZoom = true; controls.object = perspectiveCamera; controls.target.set(0, 0, 0); controls.update(); } }
        else { activeCamera = orthoCamera; canvas.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`; if (controls) controls.enabled = false; }
    };

    const resize = (newWidth: number, newHeight: number) => { /* Resize Logic omitted for brevity */ };

    const exportImage = (callback: (blob: Blob) => void, type: 'PNG' | 'JPEG' = 'PNG') => { render(); canvas.toBlob((blob) => { if (blob) callback(blob); }, type === 'PNG' ? 'image/png' : 'image/jpeg'); };
    const dispose = () => { paintEngine.dispose(); layers.forEach(l => l.dispose()); compLayer.dispose(); Object.values(genMaterials).forEach(m => m.dispose()); renderer.dispose(); };
    let currentVelocity: THREE.Vector2 | null = null;

    return { renderer, scene, controls, get camera() { return activeCamera }, quadMesh, paintEngine, layers, compLayer, addLayer, deleteLayer, getLayer, compose, render, applyGenerator, applyFilter, runSim, setTransform, fitToScreen, toggle3D, resize, get zoom() { return zoom }, get pan() { return pan }, exportImage, dispose, lastPaintPos: null, handlePaint: null, get currentVelocity() { return currentVelocity; }, set currentVelocity(v) { currentVelocity = v; }, needsUpdate: false };
};
