import React, { useEffect, useRef } from 'react';
import { useZenControlBindings } from '../../../core/zen';

export const useKPainterKeybinds = (
    engineRef: React.MutableRefObject<any>,
    setQuickMenuVisible: (visible: boolean) => void,
    setQuickMenuPos: (pos: { x: number, y: number }) => void
) => {
    // Track mouse position for menu placement
    const mousePosRef = useRef({ x: 0, y: 0 });

    useEffect(() => {
        console.log("KPainterKeybinds: MOUNTED - Q Menu Version");
        const handleMouseMove = (e: MouseEvent) => {
            mousePosRef.current = { x: e.clientX, y: e.clientY };
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    useZenControlBindings('painter', ({ actionId, phase, sourceModuleId }) => {
        if (sourceModuleId !== 'painter') {
            return false;
        }

        const engine = engineRef.current;

        if (actionId === 'menu.quick.hold') {
            if (phase === 'down') {
                setQuickMenuPos(mousePosRef.current);
                setQuickMenuVisible(true);
            } else {
                setQuickMenuVisible(false);
            }
            return true;
        }

        if (actionId !== 'camera.orbit.hold') {
            return false;
        }

        if (!engine?.controls) {
            return false;
        }

        const isActive = phase === 'down';
        engine.controls.enabled = isActive;
        engine.controls.enableRotate = isActive;
        engine.controls.enableZoom = isActive;

        if (engine.cursorMesh) {
            engine.cursorMesh.visible = !isActive;
        }

        if (engine.canvas) {
            engine.canvas.style.cursor = isActive ? 'move' : 'crosshair';
        }

        return true;
    });
};
