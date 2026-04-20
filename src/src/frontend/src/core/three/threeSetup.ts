import * as THREE from 'three';

export interface ThreeSceneSetup {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
}

export interface ThreeSetupOptions {
    fov?: number;
    near?: number;
    far?: number;
    antialias?: boolean;
    alpha?: boolean;
    preserveDrawingBuffer?: boolean;
}

/**
 * Initialize a Three.js scene, camera, and renderer
 */
export const createThreeScene = (
    container: HTMLElement,
    options: ThreeSetupOptions = {}
): ThreeSceneSetup => {
    const {
        fov = 75,
        near = 0.1,
        far = 1000,
        antialias = true,
        alpha = false,
        preserveDrawingBuffer = false
    } = options;

    const scene = new THREE.Scene();
    
    const camera = new THREE.PerspectiveCamera(
        fov,
        container.clientWidth / container.clientHeight,
        near,
        far
    );
    
    const renderer = new THREE.WebGLRenderer({
        antialias,
        alpha,
        preserveDrawingBuffer
    });
    
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);
    
    return { scene, camera, renderer };
};

/**
 * Handle window resize for Three.js scene
 */
export const handleResize = (
    setup: ThreeSceneSetup,
    container: HTMLElement
): void => {
    const { camera, renderer } = setup;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
};

