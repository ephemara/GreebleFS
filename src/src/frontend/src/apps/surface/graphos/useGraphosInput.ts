
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useZenControlBindings } from '../../../core/zen';

export const useGraphosInput = (
    canvasRef: React.RefObject<HTMLCanvasElement>,
    viewportRef: React.RefObject<HTMLDivElement>,
    engineRef: React.MutableRefObject<any>,
    targetZoomRef: React.MutableRefObject<number>,
    targetPanRef: React.MutableRefObject<THREE.Vector2>,
    zoomWorldPointRef: React.MutableRefObject<THREE.Vector2 | null>,
    zoomScreenPointRef: React.MutableRefObject<THREE.Vector2 | null>,
    onSpaceChange: (isHeld: boolean) => void
) => {
    const isPainting = useRef(false);
    const isSpaceHeld = useRef(false);
    const isPanning = useRef(false);
    const lastPointer = useRef({ x: 0, y: 0 });
    const isOrbiting = useRef(false);

    useZenControlBindings('graphos', ({ actionId, phase, sourceModuleId }) => {
        if (sourceModuleId !== 'graphos') {
            return false;
        }

        const canvas = canvasRef.current;
        if (!canvas) {
            return false;
        }

        if (actionId === 'canvas.pan.hold') {
            const isHeld = phase === 'down';
            isSpaceHeld.current = isHeld;
            if (!isHeld) {
                isPanning.current = false;
            }
            onSpaceChange(isHeld);
            canvas.style.cursor = isHeld ? 'grab' : 'crosshair';
            return true;
        }

        if (actionId === 'camera.orbit.hold') {
            const isHeld = phase === 'down';
            isOrbiting.current = isHeld;
            canvas.style.cursor = isHeld ? 'move' : (isSpaceHeld.current ? 'grab' : 'crosshair');
            return true;
        }

        return false;
    });

    useEffect(() => {
        const canvas = canvasRef.current;
        const viewport = viewportRef.current;
        if (!canvas || !viewport) return;

        const handlePointerDown = (e: PointerEvent) => {
            const r = engineRef.current;
            if (!r) return;

            lastPointer.current = { x: e.clientX, y: e.clientY };
            canvas.setPointerCapture(e.pointerId);

            // Pan: Spacebar OR Middle Click
            if (isSpaceHeld.current || e.button === 1) {
                isPanning.current = true;
                canvas.style.cursor = 'grabbing';
                e.preventDefault();
                return;
            }

            // Orbit logic is handled by OrbitControls internally via engine, but we block paint
            if (isOrbiting.current) {
                return;
            }

            // Paint: Left Click ONLY
            if (e.button === 0 && !isOrbiting.current) {
                isPainting.current = true;
                if (r.handlePaint) {
                    r.lastPaintPos = null; // Reset previous position to prevent interpolation jump
                    paintAtEvent(e);
                }
            }

            // Right click (button 2) is reserved for Context Menu (handled in parent component)
        };

        const handlePointerMove = (e: PointerEvent) => {
            const r = engineRef.current;
            if (!r) return;

            const dx = e.clientX - lastPointer.current.x;
            const dy = e.clientY - lastPointer.current.y;
            lastPointer.current = { x: e.clientX, y: e.clientY };

            if (isPanning.current) {
                // Only pan if not in 3D mode (3D uses orbit controls)
                if (!r.is3D) {
                    r.pan.x += dx;
                    r.pan.y += dy;
                    targetPanRef.current.x = r.pan.x;
                    targetPanRef.current.y = r.pan.y;
                    // Direct transform update for pan is fine, speed is 1:1
                    r.setTransform(r.zoom, r.pan);
                }
                return;
            }

            if (isPainting.current && !isOrbiting.current) {
                if (r.handlePaint) {
                    paintAtEvent(e);
                }
            }
        };

        const handlePointerUp = (e: PointerEvent) => {
            isPainting.current = false;
            isPanning.current = false; // Always clear panning - Space only prepares, you need click+drag to pan
            if (canvas) {
                canvas.releasePointerCapture(e.pointerId);
                canvas.style.cursor = isSpaceHeld.current ? 'grab' : 'crosshair';
            }
        };

        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            const r = engineRef.current;
            const viewport = viewportRef.current;
            if (!r || !viewport) return;

            if (r.is3D) return;

            // 1. Calculate the Offset of the mouse from the VIEWPORT Center (Stationary Reference)
            const rect = viewport.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            const offsetX = e.clientX - centerX;
            const offsetY = e.clientY - centerY;

            // Calculate World Point using the Current Render State (Interpolated)
            // WorldX = (ScreenOffset - Pan) / Zoom
            const currentWorldX = (offsetX - r.pan.x) / r.zoom;
            const currentWorldY = (offsetY - r.pan.y) / r.zoom;

            // 2. Update Target Zoom (Exponential)
            // Use a factor based on deltaY. 
            // e.g. deltaY = 100 (zoom out) -> factor < 1. 
            // deltaY = -100 (zoom in) -> factor > 1.
            const zoomSpeed = 0.0015;
            let scaleFactor = 1.0 - (e.deltaY * zoomSpeed);

            // Clamp scale factor per event to prevent explosion on fast scroll
            scaleFactor = Math.max(0.5, Math.min(1.5, scaleFactor));

            const oldTargetZoom = targetZoomRef.current;
            const newTargetZoom = Math.max(0.01, Math.min(50.0, oldTargetZoom * scaleFactor));

            targetZoomRef.current = newTargetZoom;

            // 3. Calculate New Target Pan
            // To keep WorldPoint stationary at Mouse:
            // Mouse = PanNew + World * ZoomNew
            // PanNew = Mouse - World * ZoomNew
            const newTargetPanX = offsetX - currentWorldX * newTargetZoom;
            const newTargetPanY = offsetY - currentWorldY * newTargetZoom;

            if (targetPanRef.current) {
                targetPanRef.current.x = newTargetPanX;
                targetPanRef.current.y = newTargetPanY;
            }
        };

        const paintAtEvent = (e: PointerEvent) => {
            const r = engineRef.current;
            if (!canvas || !r.handlePaint) return;

            const rect = canvas.getBoundingClientRect();

            // Local pixel coordinates
            const localX = e.clientX - rect.left;
            const localY = e.clientY - rect.top;

            // Normalize to 0..1 UV
            const u = localX / rect.width;
            const v = 1.0 - (localY / rect.height); // Flip Y for GL

            // Allow slight over-paint for brush edges
            if (u >= -0.2 && u <= 1.2 && v >= -0.2 && v <= 1.2) {
                const pressure = e.pressure || 1.0;
                r.handlePaint(new THREE.Vector2(u, v), pressure);
            }
        };

        canvas.addEventListener('pointerdown', handlePointerDown);
        viewport.addEventListener('pointermove', handlePointerMove); // Viewport for pan anywhere
        canvas.addEventListener('pointerup', handlePointerUp);
        canvas.addEventListener('pointerleave', handlePointerUp);
        window.addEventListener('wheel', handleWheel, { passive: false }); // Global zoom like painting apps

        return () => {
            canvas.removeEventListener('pointerdown', handlePointerDown);
            viewport.removeEventListener('pointermove', handlePointerMove);
            canvas.removeEventListener('pointerup', handlePointerUp);
            canvas.removeEventListener('pointerleave', handlePointerUp);
            window.removeEventListener('wheel', handleWheel);
        };
    }, [canvasRef, viewportRef, engineRef, targetZoomRef, targetPanRef, zoomWorldPointRef, zoomScreenPointRef, onSpaceChange]);

    return {};
};
