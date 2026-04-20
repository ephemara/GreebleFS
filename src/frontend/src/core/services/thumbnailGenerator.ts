import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getBoundingBox } from '../utils/geometryUtils';

/**
 * Thumbnail Generator Singleton
 * Generates thumbnails for 3D models with robust auto-framing and lighting
 */
class ThumbnailGenerator {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private mainLight: THREE.DirectionalLight;
    private fillLight: THREE.HemisphereLight;
    private loader: GLTFLoader;
    private initialized: boolean = false;

    // Configuration
    private readonly FOV = 45;
    private readonly BG_COLOR = 0x000000;
    private readonly BG_ALPHA = 0;
    private readonly THUMB_SIZE = 256; // Increased resolution

    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(this.FOV, 1, 0.01, 1000);
        this.renderer = new THREE.WebGLRenderer({
            alpha: true,
            antialias: true,
            preserveDrawingBuffer: true,
            logarithmicDepthBuffer: true // Better for huge scale differences
        });

        // Setup Lighting
        // 1. Hemisphere light for base visibility (prevents completely black shadows)
        this.fillLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);

        // 2. Directional light for definition
        this.mainLight = new THREE.DirectionalLight(0xffffff, 1.2);

        this.loader = new GLTFLoader();
        this.init();
    }

    private init(): void {
        if (this.initialized) return;

        this.renderer.setSize(this.THUMB_SIZE, this.THUMB_SIZE);
        this.renderer.setClearColor(this.BG_COLOR, this.BG_ALPHA);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace; // Modern color management

        this.scene.add(this.fillLight);
        this.scene.add(this.mainLight);
        this.scene.add(this.camera); // Add camera to scene so lights can be attached if needed

        // Attach main light to camera so the object is always lit from the view direction
        this.camera.add(this.mainLight);
        this.mainLight.position.set(2, 4, 3); // Slightly offset from camera

        this.initialized = true;
    }

    async generate(blob: Blob): Promise<string> {
        if (!this.initialized) this.init();
        const url = URL.createObjectURL(blob);

        return new Promise((resolve) => {
            this.loader.load(
                url,
                (gltf) => {
                    const root = gltf.scene;

                    // Add current object to scene
                    this.scene.add(root);

                    // 1. Calculate Bounding Box
                    const bounds = getBoundingBox(root);
                    const { center, size, maxDim } = bounds;
                    const objectRadius = maxDim / 2;

                    // 2. Auto-Frame Camera
                    // Calculate distance needed to fit object within FOV
                    // dist = radius / sin(fov/2)
                    const fovRad = (this.FOV * Math.PI) / 180;
                    const cameraDist = (objectRadius / Math.sin(fovRad / 2)) * 1.5; // 1.5x margin

                    // Position camera: Offset from center by distance along a nice angle
                    // Using a classic "isometric-ish" angle (1, 0.8, 1) or similar
                    const viewDir = new THREE.Vector3(1, 0.8, 1).normalize();
                    const camPos = center.clone().add(viewDir.multiplyScalar(cameraDist));

                    this.camera.position.copy(camPos);
                    this.camera.lookAt(center);

                    // 3. Dynamic Clipping Planes
                    // Ensure we don't clip the object regardless of scale (mountain vs penny)
                    this.camera.near = cameraDist / 100;
                    this.camera.far = cameraDist * 100;
                    this.camera.updateProjectionMatrix();

                    // 4. Render
                    this.renderer.render(this.scene, this.camera);
                    const dataUrl = this.renderer.domElement.toDataURL('image/png');

                    // Cleanup
                    this.scene.remove(root);
                    URL.revokeObjectURL(url);

                    resolve(dataUrl);
                },
                undefined,
                (err) => {
                    console.error('Thumbnail generation failed:', err);
                    URL.revokeObjectURL(url);
                    resolve('');
                }
            );
        });
    }
}

// Export singleton instance
export const ThumbnailGen = new ThumbnailGenerator();

