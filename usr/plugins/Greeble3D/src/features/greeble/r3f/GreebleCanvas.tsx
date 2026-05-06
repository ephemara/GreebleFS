import { Canvas, useThree } from '@react-three/fiber';
import { SceneContent } from './SceneContent';
import { useGreebleStore } from '../../../store/useGreebleStore';
import * as THREE from 'three';
import { useEffect } from 'react';

const SceneBridge = ({ sceneRef, onSceneReady }: { sceneRef: any, onSceneReady?: () => void }) => {
    const { scene, camera, gl, controls } = useThree();

    useEffect(() => {
        if (sceneRef && sceneRef.current) {
            sceneRef.current.scene = scene;
            sceneRef.current.camera = camera;
            sceneRef.current.renderer = gl;

            // Sync OrbitControls to sceneRef so the mouse handler can access it
            // This is set by OrbitControls with makeDefault prop
            sceneRef.current.controls = controls;

            // Ensure rootGroup exists in the scene
            let rootGroup = scene.getObjectByName('rootGroup');
            if (!rootGroup) {
                rootGroup = new THREE.Group();
                rootGroup.name = 'rootGroup';
                scene.add(rootGroup);
            }
            sceneRef.current.rootGroup = rootGroup;

            // Initialize raycaster and mouse if not already present
            if (!sceneRef.current.raycaster) {
                sceneRef.current.raycaster = new THREE.Raycaster();
            }
            if (!sceneRef.current.mouse) {
                sceneRef.current.mouse = new THREE.Vector2();
            }
            if (!sceneRef.current.startPoint) {
                sceneRef.current.startPoint = new THREE.Vector3();
            }

            if (onSceneReady) onSceneReady();
        }
    }, [scene, camera, gl, controls, sceneRef, onSceneReady]);

    return null;
};

export const KGreebleCanvas = ({ sceneRef, onSceneReady }: { sceneRef: any, onSceneReady?: () => void }) => {
    const { graphicsQuality } = useGreebleStore();
    // ...Dpr Mapping
    const dpr = graphicsQuality === 'low' ? 0.5 :
        graphicsQuality === 'medium' ? 0.75 :
            graphicsQuality === 'extreme' ? [1, 2] : 1;

    return (
        <Canvas
            id="greeble-canvas-r3f"
            dpr={dpr as any}
            shadows={graphicsQuality !== 'low'}
            gl={{
                antialias: true,
                toneMapping: THREE.ACESFilmicToneMapping,
                outputColorSpace: THREE.SRGBColorSpace,
                preserveDrawingBuffer: true // For screenshots
            }}
            camera={{ position: [3, 4, 6], fov: 45, near: 0.1, far: 8000 }}
            style={{ width: '100%', height: '100%', background: '#151515', touchAction: 'none' }}
        >
            <SceneBridge sceneRef={sceneRef} onSceneReady={onSceneReady} />
            <SceneContent />
        </Canvas>
    );
};
