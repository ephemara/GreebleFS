
import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { CURSOR_VERTEX, CURSOR_FRAGMENT } from './KTectonshaders';

export const useKTectonInteraction = (
    mountRef: React.RefObject<HTMLDivElement>,
    engineRef: React.MutableRefObject<any>,
    sculptParams: any,
    sculptEngineRef: React.MutableRefObject<any>,
    dimensions: { sizeX: number, sizeZ: number },
    enabled = true
) => {
    const isDragging = useRef(false);
    const cursorRef = useRef<THREE.Mesh | null>(null);
    const planeRef = useRef<THREE.Mesh | null>(null);

    // Setup Keys
    useEffect(() => {
        if (!enabled) {
            return;
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            const r = engineRef.current;
            if (!r.controls) return;
            
            // IF ALT IS PRESSED -> ENABLE ORBIT ROTATION & PAN
            if (e.key === 'Alt' || e.altKey) {
                r.controls.enableRotate = true;
                r.controls.enablePan = true;
                if (mountRef.current) mountRef.current.style.cursor = 'move';
                // Hide cursor when moving camera
                if (cursorRef.current) cursorRef.current.visible = false;
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            const r = engineRef.current;
            if (!r.controls) return;

            // IF ALT IS RELEASED -> DISABLE ORBIT ROTATION (ENABLE SCULPT)
            // Note: Zoom remains enabled!
            if (e.key === 'Alt' || !e.altKey) {
                r.controls.enableRotate = false;
                r.controls.enablePan = false;
                if (mountRef.current) mountRef.current.style.cursor = 'crosshair';
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [enabled, engineRef]);

    useEffect(() => {
        if (!enabled) {
            return;
        }

        const r = engineRef.current;
        if (!r.scene || !r.mesh) return;

        // Plane needs to be HUGE to catch rays in a 4k world
        const planeGeo = new THREE.PlaneGeometry(100000, 100000); 
        planeGeo.rotateX(-Math.PI / 2);
        const planeMat = new THREE.MeshBasicMaterial({ visible: false });
        const rayPlane = new THREE.Mesh(planeGeo, planeMat);
        r.scene.add(rayPlane);
        planeRef.current = rayPlane;

        const cursorGeo = new THREE.PlaneGeometry(1, 1, 64, 64);
        cursorGeo.rotateX(-Math.PI / 2); 
        
        const cursorMat = new THREE.ShaderMaterial({
            uniforms: {
                heightMap: { value: null },
                heightScale: { value: 30.0 },
                color: { value: new THREE.Color(0x10b981) }, // Emerald Green Cursor
                opacity: { value: 0.5 }
            },
            vertexShader: CURSOR_VERTEX,
            fragmentShader: CURSOR_FRAGMENT,
            transparent: true,
            depthTest: false, 
            depthWrite: false
        });

        const cursor = new THREE.Mesh(cursorGeo, cursorMat);
        cursor.frustumCulled = false; 
        cursor.renderOrder = 999;
        r.scene.add(cursor);
        cursorRef.current = cursor;

        return () => {
            r.scene.remove(rayPlane);
            r.scene.remove(cursor);
            cursorGeo.dispose();
            cursorMat.dispose();
            planeGeo.dispose();
            planeMat.dispose();
        };
    }, [enabled, engineRef.current.scene]);

    // Use Pointer events instead of Mouse events for broader support
    const handleMouseDown = useCallback((e: React.PointerEvent) => {
        if (!enabled) return;
        // If Alt is held, we are navigating, do not sculpt
        if (e.altKey) return; 

        if (sculptParams.activeTab !== 'sculpt') return;
        if (e.button === 0) {
            isDragging.current = true;
        }
    }, [enabled, sculptParams.activeTab]);

    const handleMouseUp = useCallback(() => {
        isDragging.current = false;
    }, []);

    const handleMouseMove = useCallback((e: React.PointerEvent) => {
        if (!enabled) return;
        const r = engineRef.current;
        const cursor = cursorRef.current;
        const plane = planeRef.current;
        
        // If Alt is pressed, we are likely orbiting, hide brush
        if (e.altKey) {
            if (cursor) cursor.visible = false;
            return;
        }
        
        if (!r.camera || !mountRef.current || !cursor || !plane) return;

        const rect = mountRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        r.mouse.set(x, y);
        r.raycaster.setFromCamera(r.mouse, r.camera);

        const intersects = r.raycaster.intersectObject(plane);
        
        if (intersects.length > 0) {
            const hit = intersects[0];
            const hitPoint = hit.point;
            
            // CALCULATE UV MANUALLY BASED ON TERRAIN SIZE
            // Terrain is centered at 0,0. 
            // x range: [-sizeX/2, sizeX/2] -> [0, 1]
            // z range: [-sizeZ/2, sizeZ/2] -> [0, 1] (or 1,0 depending on orientation)
            
            // Map world X/Z to 0..1 UV
            const u = (hitPoint.x + dimensions.sizeX / 2) / dimensions.sizeX;
            // The plane geometry is generated standard and rotated -90 X. 
            // This usually maps V bottom-to-top as Z positive-to-negative.
            // Z increases downwards in world space relative to screen 'up'.
            const v = 1.0 - (hitPoint.z + dimensions.sizeZ / 2) / dimensions.sizeZ;
            
            // Check bounds to ensure we don't sculpt outside
            if (u >= 0 && u <= 1 && v >= 0 && v <= 1) {
                const uv = new THREE.Vector2(u, v); 

                const size = sculptParams.brushSize * (Math.max(dimensions.sizeX, dimensions.sizeZ) * 0.2); 
                cursor.scale.set(size, 1, size);
                cursor.position.set(hitPoint.x, 0, hitPoint.z); 
                cursor.visible = true;

                const mat = cursor.material as THREE.ShaderMaterial;
                mat.uniforms.heightMap.value = r.targetA.texture; 
                mat.uniforms.heightScale.value = sculptParams.heightScale;

                if (isDragging.current && sculptParams.activeTab === 'sculpt') {
                    const sculptor = sculptEngineRef.current;
                    if (sculptor) {
                        sculptor.applyBrush(
                            r.targetA, 
                            r.targetB, 
                            uv, 
                            { 
                                radius: sculptParams.brushSize * 0.5, // Scale brush relative to UV 
                                strength: sculptParams.brushStrength, 
                                mode: sculptParams.sculptMode 
                            }
                        );
                        const temp = r.targetA;
                        r.targetA = r.targetB;
                        r.targetB = temp;
                    }
                }
            } else {
                cursor.visible = false;
            }
        } else {
            cursor.visible = false;
        }
    }, [dimensions, enabled, sculptEngineRef, sculptParams]);

    return { handleMouseDown, handleMouseUp, handleMouseMove };
};
