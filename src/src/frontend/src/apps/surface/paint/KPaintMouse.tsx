
import React, { useRef } from 'react';
import * as THREE from 'three';

// --- RUST UV RAYCASTING (Mandatory) ---
import { rustRaycastUVManager } from '../../../services/raycastClient';

export const usePaintInput = (
    canvasRef: React.RefObject<HTMLCanvasElement>,
    engineRef: React.MutableRefObject<any>,
    brushRef: React.MutableRefObject<any>
) => {
    const isPainting = useRef(false);
    const lastScreenPos = useRef<THREE.Vector2 | null>(null);
    const _lerpVec = useRef(new THREE.Vector2());

    // Reusable objects to avoid GC pressure
    const _inverseMatrix = useRef(new THREE.Matrix4());
    const _localOrigin = useRef(new THREE.Vector3());
    const _localDir = useRef(new THREE.Vector3());
    const _worldHit = useRef(new THREE.Vector3());

    const handlePointerDown = (e: any, paintCallback: (uv: THREE.Vector2, pressure: number, event: any) => void) => {
        const r = engineRef.current;
        if (r.controls) {
            if (e.button === 2 || (e.button === 0 && e.altKey)) {
                isPainting.current = false;
                r.controls.enabled = true;
                if (canvasRef.current) canvasRef.current.style.cursor = 'move';
                return;
            }
        }

        if (e.button === 0 && !e.altKey) {
            isPainting.current = true;
            lastScreenPos.current = null;
            if (r.controls) r.controls.enabled = false;

            if (canvasRef.current) {
                canvasRef.current.setPointerCapture(e.pointerId);
                canvasRef.current.style.cursor = 'crosshair';
            }

            handlePointerMove(e, paintCallback);
        }
    };

    const handlePointerUp = (e: any) => {
        isPainting.current = false;
        lastScreenPos.current = null;

        if (engineRef.current.controls) {
            engineRef.current.controls.enabled = true;
        }

        if (canvasRef.current && e.pointerId) {
            canvasRef.current.releasePointerCapture(e.pointerId);
            canvasRef.current.style.cursor = 'crosshair';
        }
    };

    const handlePointerMove = (e: any, paintCallback: (uv: THREE.Vector2, pressure: number, event: any) => void) => {
        const r = engineRef.current;
        if (!r.initialized || !canvasRef.current || !r.camera || !r.targetMeshes?.length || !r.raycaster) return;

        const isNavigating = r.controls && r.controls.enabled;
        if (isNavigating && !isPainting.current) return;

        const rect = canvasRef.current.getBoundingClientRect();
        let pressure = e.pressure;
        if (e.pointerType === 'mouse' || pressure === 0) pressure = 1.0;

        // NDC coordinates
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        const currentScreen = new THREE.Vector2(x, y);

        // --- RUST BVH PROJECTION PAINTING (ONLY MODE) ---
        const processPoint = async (ndc: THREE.Vector2): Promise<void> => {
            const mesh = r.targetMeshes[0] as THREE.Mesh;
            if (!mesh) return;

            const rustHandle = rustRaycastUVManager.getHandle(mesh);
            if (!rustHandle) return; // Wait for registration

            // Compute ray and transform to local space (reuse objects)
            r.raycaster.setFromCamera(ndc, r.camera);
            _inverseMatrix.current.copy(mesh.matrixWorld).invert();
            _localOrigin.current.copy(r.raycaster.ray.origin).applyMatrix4(_inverseMatrix.current);
            _localDir.current.copy(r.raycaster.ray.direction).transformDirection(_inverseMatrix.current).normalize();

            const hit = await rustRaycastUVManager.raycastSync(
                mesh,
                { x: _localOrigin.current.x, y: _localOrigin.current.y, z: _localOrigin.current.z },
                { x: _localDir.current.x, y: _localDir.current.y, z: _localDir.current.z },
                1000
            );

            if (hit) {
                // Update cursor position for projection painting
                if (r.cursorMesh) {
                    _worldHit.current.set(hit.point.x, hit.point.y, hit.point.z);
                    _worldHit.current.applyMatrix4(mesh.matrixWorld);
                    r.cursorMesh.position.copy(_worldHit.current);
                }

                if (isPainting.current) {
                    paintCallback(new THREE.Vector2(hit.uv.x, hit.uv.y), pressure, e);
                }
            }
        };

        // Stroke interpolation
        if (isPainting.current && lastScreenPos.current) {
            const dist = lastScreenPos.current.distanceTo(currentScreen);
            const brushSizePixels = brushRef.current.size;
            const spacing = brushRef.current.spacing || 0.1;
            const pixelToNDC = 2.0 / Math.max(rect.width, rect.height);
            const stepDist = Math.max(0.001, (brushSizePixels * spacing) * pixelToNDC);
            const steps = Math.min(Math.floor(dist / stepDist), 25);

            for (let i = 1; i <= steps; i++) {
                const t = i / steps;
                _lerpVec.current.lerpVectors(lastScreenPos.current, currentScreen, t);
                processPoint(_lerpVec.current.clone());
            }
        }

        processPoint(currentScreen);
        lastScreenPos.current = currentScreen.clone();
    };

    return { handlePointerDown, handlePointerMove, handlePointerUp };
};
