
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { UNIVERSAL_VIEWPORT_BACKGROUND_HEX, UNIVERSAL_VIEWPORT_BACKGROUND_IMAGE } from '../zen/viewportTheme';
import { AdaptiveInfiniteGrid } from './AdaptiveInfiniteGrid';

export interface StudioStageOptions {
    cameraPosition?: [number, number, number];
    controls?: boolean;
    lighting?: boolean;
    background?: number;
    shadows?: boolean;
    grid?: boolean;
}

/**
 * StudioStage
 * A standardized high-fidelity Three.js environment for K-OS apps.
 * Handles: Renderer, Scene, Camera, Controls, Lights, Resizing.
 */
export class StudioStage {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls | null = null;
    
    // Public access to lights for tweaking
    lights: {
        key: THREE.DirectionalLight;
        fill: THREE.PointLight;
        rim: THREE.PointLight;
        ambient: THREE.AmbientLight;
    } | null = null;

    private frameId: number = 0;
    private callbacks: (() => void)[] = [];
    private grid: AdaptiveInfiniteGrid | null = null;

    constructor(container: HTMLElement, options: StudioStageOptions = {}) {
        const w = container.clientWidth;
        const h = container.clientHeight;

        container.style.backgroundColor = UNIVERSAL_VIEWPORT_BACKGROUND_HEX;
        container.style.backgroundImage = UNIVERSAL_VIEWPORT_BACKGROUND_IMAGE;

        // 1. Renderer
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true, 
            alpha: true,
            powerPreference: "high-performance"
        });
        this.renderer.setSize(w, h);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(0x000000, 0);
        if (options.shadows !== false) {
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        }
        container.appendChild(this.renderer.domElement);

        // 2. Scene
        this.scene = new THREE.Scene();
        if (options.background !== undefined) {
            this.scene.background = new THREE.Color(options.background);
        }

        // 3. Camera
        this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
        const [cx, cy, cz] = options.cameraPosition || [0, 0, 4];
        this.camera.position.set(cx, cy, cz);

        // 4. Controls
        if (options.controls !== false) {
            this.controls = new OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
        }

        // 5. Lighting (Standard Studio Rig)
        if (options.lighting !== false) {
            const ambient = new THREE.AmbientLight(0xffffff, 0.4);
            
            const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
            keyLight.position.set(5, 5, 5);
            keyLight.castShadow = true;
            keyLight.shadow.mapSize.set(2048, 2048);
            
            const fillLight = new THREE.PointLight(0x3daee9, 0.4); // Cool fill
            fillLight.position.set(-5, 0, 5);
            
            const rimLight = new THREE.PointLight(0xffaa00, 0.5); // Warm rim
            rimLight.position.set(0, 5, -5);

            this.scene.add(ambient, keyLight, fillLight, rimLight);
            
            this.lights = { key: keyLight, fill: fillLight, rim: rimLight, ambient };
        }

        if (options.grid !== false) {
            this.grid = new AdaptiveInfiniteGrid();
            this.scene.add(this.grid.group);
        }

        // Start Loop
        this.animate();
    }

    onLoop(callback: () => void) {
        this.callbacks.push(callback);
    }

    private animate = () => {
        this.frameId = requestAnimationFrame(this.animate);
        
        if (this.controls) this.controls.update();
        this.grid?.update(this.camera, this.controls?.target);
        
        // Run external hooks
        for (const cb of this.callbacks) {
            cb();
        }

        this.renderer.render(this.scene, this.camera);
    }

    resize() {
        const parent = this.renderer.domElement.parentElement;
        if (parent) {
            const w = parent.clientWidth;
            const h = parent.clientHeight;
            this.camera.aspect = w / h;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(w, h);
        }
    }

    dispose() {
        cancelAnimationFrame(this.frameId);
        this.grid?.dispose();
        this.renderer.dispose();
        if (this.controls) this.controls.dispose();
        // Remove canvas
        if (this.renderer.domElement.parentElement) {
            this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
        }
    }
}
