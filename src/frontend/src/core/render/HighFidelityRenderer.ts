
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SAOPass } from 'three/examples/jsm/postprocessing/SAOPass.js';
import { SSRPass } from 'three/examples/jsm/postprocessing/SSRPass.js';
import { GammaCorrectionShader } from 'three/examples/jsm/shaders/GammaCorrectionShader.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface RenderSettings {
    exposure: number;
    bloomStrength: number;
    bloomRadius: number;
    bloomThreshold: number;
    rayTracing: boolean; // Enables SSR + SAO
    autoRotate: boolean;
    wireframe: boolean;
    grid: boolean;
    clayMode: boolean;
}

export class HighFidelityRenderer {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    composer: EffectComposer;
    controls: OrbitControls;
    
    // Scene Elements
    modelGroup: THREE.Group;
    gridHelper: THREE.GridHelper;
    selectionBox: THREE.BoxHelper;
    groundPlane: THREE.Mesh;
    lights: { key: THREE.DirectionalLight; fill: THREE.PointLight; rim: THREE.SpotLight };

    // Passes
    private bloomPass: UnrealBloomPass;
    private saoPass: any; // SAOPass type definition issues in some three versions
    private ssrPass: SSRPass;
    
    private frameId: number = 0;
    private width: number;
    private height: number;

    constructor(canvas: HTMLCanvasElement) {
        this.width = canvas.clientWidth || 300; // Fallback to avoid 0 size crashes
        this.height = canvas.clientHeight || 300;

        // 1. Renderer Setup (High Performance)
        this.renderer = new THREE.WebGLRenderer({ 
            canvas,
            antialias: false, // Post-proc handles AA
            powerPreference: "high-performance", 
            alpha: false,
            depth: true,
            stencil: true
        });
        this.renderer.setSize(this.width, this.height, false);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;

        // 2. Scene & Environment
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x050505);
        const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

        // 3. Camera
        this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 0.1, 500);
        this.camera.position.set(5, 3, 5);

        // 4. Controls
        this.controls = new OrbitControls(this.camera, canvas);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;

        // 5. Scene Graph Initialization
        this.modelGroup = new THREE.Group();
        this.scene.add(this.modelGroup);

        this.gridHelper = new THREE.GridHelper(20, 20, 0x333333, 0x111111);
        this.scene.add(this.gridHelper);

        this.selectionBox = new THREE.BoxHelper(undefined, 0x00ffcc);
        this.selectionBox.visible = false;
        this.scene.add(this.selectionBox);

        // Ground Plane for Reflections (Hidden unless Ray Tracing on)
        const planeGeo = new THREE.PlaneGeometry(50, 50);
        const planeMat = new THREE.MeshStandardMaterial({ 
            color: 0x050505, roughness: 0.1, metalness: 0.5, 
            side: THREE.DoubleSide 
        });
        this.groundPlane = new THREE.Mesh(planeGeo, planeMat);
        this.groundPlane.rotation.x = -Math.PI / 2;
        this.groundPlane.position.y = -0.01;
        this.groundPlane.receiveShadow = true;
        this.groundPlane.visible = false; 
        this.scene.add(this.groundPlane);

        // Lighting
        this.lights = {
            key: new THREE.DirectionalLight(0xffffff, 2),
            fill: new THREE.PointLight(0xffaa00, 0.5),
            rim: new THREE.SpotLight(0x00d4ff, 5)
        };
        this.lights.key.position.set(5, 10, 5);
        this.lights.key.castShadow = true;
        this.lights.key.shadow.mapSize.set(2048, 2048);
        this.lights.key.shadow.bias = -0.0001;
        this.scene.add(this.lights.key);
        this.scene.add(this.lights.fill);
        this.scene.add(this.lights.rim);

        // 6. Post-Processing Stack (The "Marmoset" Sauce)
        this.composer = new EffectComposer(this.renderer);
        
        // Pass 1: Base Render
        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);

        // Pass 2: SAO (Screen Space Ambient Occlusion)
        this.saoPass = new (SAOPass as any)(this.scene, this.camera, false, true);
        this.saoPass.enabled = false;
        this.saoPass.params.saoBias = 0.5;
        this.saoPass.params.saoIntensity = 0.05;
        this.saoPass.params.saoScale = 50;
        this.saoPass.params.saoKernelRadius = 30;
        this.composer.addPass(this.saoPass);

        // Pass 3: SSR (Screen Space Reflections)
        this.ssrPass = new SSRPass({
            renderer: this.renderer,
            scene: this.scene,
            camera: this.camera,
            width: this.width,
            height: this.height,
            groundReflector: null,
            selects: null
        });
        this.ssrPass.thickness = 0.01;
        this.ssrPass.infiniteThick = false;
        this.ssrPass.enabled = false;
        this.composer.addPass(this.ssrPass);

        // Pass 4: Bloom
        this.bloomPass = new UnrealBloomPass(new THREE.Vector2(this.width, this.height), 1.5, 0.4, 0.85);
        this.composer.addPass(this.bloomPass);

        // Pass 5: Gamma Correction (Crucial)
        const gammaPass = new ShaderPass(GammaCorrectionShader);
        this.composer.addPass(gammaPass);

        this.startLoop();
    }

    private startLoop() {
        const animate = () => {
            this.frameId = requestAnimationFrame(animate);
            this.controls.update();
            this.composer.render();
        };
        animate();
    }

    updateSettings(s: RenderSettings) {
        // Renderer
        this.renderer.toneMappingExposure = s.exposure;
        
        // Bloom
        this.bloomPass.strength = s.bloomStrength;
        this.bloomPass.radius = s.bloomRadius;
        this.bloomPass.threshold = s.bloomThreshold;
        
        // Ray Tracing
        this.saoPass.enabled = s.rayTracing;
        this.ssrPass.enabled = s.rayTracing;
        this.groundPlane.visible = s.rayTracing; // Only show floor reflection in RT mode

        // Scene
        this.gridHelper.visible = s.grid;
        if (s.autoRotate) this.modelGroup.rotation.y += 0.002;

        // Materials (Clay/Wireframe)
        this.modelGroup.traverse((c: any) => {
            if (c.isMesh && c.material) {
                c.material.wireframe = s.wireframe;
                
                // Clay Mode Logic
                if (s.clayMode) {
                    if (!c.userData.originalMaterial) c.userData.originalMaterial = c.material;
                    // Cached clay material singleton could be better, but this works for now
                    const clay = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.6, metalness: 0.1 });
                    clay.wireframe = s.wireframe;
                    c.material = clay;
                } else if (c.userData.originalMaterial) {
                    c.material = c.userData.originalMaterial;
                    c.material.wireframe = s.wireframe;
                }
            }
        });
    }

    public resize() {
        const canvas = this.renderer.domElement;
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        
        // Avoid 0 size which crashes some passes
        if (w === 0 || h === 0) return;

        if (canvas.width !== w || canvas.height !== h) {
            this.renderer.setSize(w, h, false);
            this.composer.setSize(w, h);
            this.camera.aspect = w / h;
            this.camera.updateProjectionMatrix();
        }
    }

    dispose() {
        cancelAnimationFrame(this.frameId);
        this.renderer.dispose();
        this.controls.dispose();
    }
}
