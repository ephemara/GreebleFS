
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

interface SessionOptions {
    autoRotate?: boolean;
    initCameraPos?: [number, number, number];
}

export const useThreeSession = (
    mountRef: React.RefObject<HTMLElement>, 
    options: SessionOptions = {}
) => {
    const [isReady, setIsReady] = useState(false);
    const sessionRef = useRef<{
        scene: THREE.Scene;
        camera: THREE.PerspectiveCamera;
        renderer: THREE.WebGLRenderer;
        controls: OrbitControls;
        startLoop: (cb: () => void) => void;
    } | null>(null);

    useEffect(() => {
        if (!mountRef.current) return;
        const w = mountRef.current.clientWidth;
        const h = mountRef.current.clientHeight;

        // Init
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        mountRef.current.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x050505);
        scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;

        const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
        camera.position.set(...(options.initCameraPos || [5, 5, 5]));

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.autoRotate = !!options.autoRotate;

        // Basic Lighting
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
        dirLight.position.set(5, 10, 5);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.set(2048, 2048);
        scene.add(dirLight);
        scene.add(new THREE.AmbientLight(0xffffff, 0.2));

        let frameId: number;
        const loopCallbacks: (() => void)[] = [];

        const animate = () => {
            frameId = requestAnimationFrame(animate);
            controls.update();
            loopCallbacks.forEach(cb => cb());
            renderer.render(scene, camera);
        };
        animate();

        // Handle Resize
        const handleResize = () => {
            if (!mountRef.current) return;
            const nw = mountRef.current.clientWidth;
            const nh = mountRef.current.clientHeight;
            camera.aspect = nw / nh;
            camera.updateProjectionMatrix();
            renderer.setSize(nw, nh);
        };
        window.addEventListener('resize', handleResize);

        sessionRef.current = {
            scene, camera, renderer, controls,
            startLoop: (cb) => loopCallbacks.push(cb)
        };
        setIsReady(true);

        return () => {
            window.removeEventListener('resize', handleResize);
            cancelAnimationFrame(frameId);
            renderer.dispose();
            if (mountRef.current) mountRef.current.innerHTML = '';
        };
    }, []);

    return { session: sessionRef.current, isReady };
};