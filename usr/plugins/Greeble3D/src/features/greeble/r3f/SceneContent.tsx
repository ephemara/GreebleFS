import { OrbitControls, Environment, Grid, ContactShadows } from '@react-three/drei';
import { useGreebleStore } from '../../../store/useGreebleStore';
import * as THREE from 'three';
import { LayersRenderer } from './LayersRenderer';
import { GizmoControls } from './GizmoControls';
import { logger } from '../../../lib/utils/logger';

export const SceneContent = () => {
    const {
        sunIntensity, sunAngle, envMap, isSnapshotting, selectedObjectUUID, mode
    } = useGreebleStore();

    // Light Positions
    const sunRad = (sunAngle * Math.PI) / 180;
    const sunX = Math.sin(sunRad) * 10;
    const sunY = Math.cos(sunRad) * 10;

    // Debug: log when selection changes
    logger.log('SceneContent - selectedObjectUUID:', selectedObjectUUID, 'mode:', mode);

    return (
        <>
            {/* --- CONTROLS --- */}
            {/* Standard controls - the old mouse handler from your DCC disables these when it takes over */}
            {/* Middle mouse also rotates for Blender users */}
            {/* RIGHT MOUSE DISABLED - Used for IMM Brush rotation in build mode */}
            <OrbitControls
                makeDefault
                dampingFactor={0.05}
                maxDistance={4000}
                mouseButtons={{
                    LEFT: THREE.MOUSE.ROTATE,
                    MIDDLE: THREE.MOUSE.ROTATE,
                    RIGHT: undefined // DISABLED for IMM brush system
                }}
                enableDamping={true}
            />

            {/* --- LIGHTING --- */}
            <hemisphereLight args={[0xffffff, 0x444444, 2.5]} />
            <directionalLight
                position={[sunX, sunY, 5]}
                intensity={sunIntensity}
                castShadow
                shadow-mapSize={[2048, 2048]}
            />

            {envMap && <Environment files={envMap} background />}

            {/* --- ENVIRONMENT --- */}
            {!isSnapshotting && (
                <Grid
                    infiniteGrid
                    fadeDistance={4000}
                    sectionSize={100}
                    cellSize={10}
                    sectionColor="#444444"
                    cellColor="#222222"
                    position={[0, -0.01, 0]}
                />
            )}

            <ContactShadows
                opacity={0.5}
                scale={100}
                blur={2}
                far={10}
                resolution={512}
                color="#000000"
            />

            {/* --- LAYERS RENDERER --- */}
            {/* Objects are rendered from the zustand store, spawning is handled by the DCC mouse handler */}
            <LayersRenderer />

            {/* --- TRANSFORM GIZMO --- */}
            <GizmoControls />

        </>
    );
};

