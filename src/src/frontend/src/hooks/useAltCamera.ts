import React, { useEffect, useRef } from 'react';
import { StudioStage } from '../core/three/StudioStage';

/**
 * Enforces "Alt-to-Orbit" navigation.
 * Disables camera controls by default.
 * Enables them only while ALT is held.
 */
export const useAltCamera = (stageRef: React.MutableRefObject<StudioStage | null>) => {
    // Track state to prevent fighting with other tools (like Gizmo)
    const isAltHeld = useRef(false);

    useEffect(() => {
        const handleDown = (e: KeyboardEvent) => {
            if (!stageRef.current?.controls) return;
            
            if (e.key === 'Alt') {
                isAltHeld.current = true;
                stageRef.current.controls.enabled = true;
                
                // Optional: Change cursor to indicate navigation
                stageRef.current.renderer.domElement.style.cursor = 'move';
            }
        };

        const handleUp = (e: KeyboardEvent) => {
            if (!stageRef.current?.controls) return;

            if (e.key === 'Alt') {
                isAltHeld.current = false;
                stageRef.current.controls.enabled = false;
                stageRef.current.renderer.domElement.style.cursor = 'default';
            }
        };

        window.addEventListener('keydown', handleDown);
        window.addEventListener('keyup', handleUp);

        // INITIAL LOCK
        // We defer slightly to ensure stage is ready
        setTimeout(() => {
            if (stageRef.current?.controls) {
                stageRef.current.controls.enabled = false;
            }
        }, 100);

        return () => {
            window.removeEventListener('keydown', handleDown);
            window.removeEventListener('keyup', handleUp);
        };
    }, []);

    return isAltHeld;
};
