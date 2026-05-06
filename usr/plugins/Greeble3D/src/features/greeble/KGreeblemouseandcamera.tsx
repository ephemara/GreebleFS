
import { useCallback, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useGreebleStore } from '../../store/useGreebleStore';

/**
 * 🔥 ZBRUSH-STYLE IMM BRUSH SYSTEM
 * 
 * BUILD MODE CONTROLS:
 * - DRAG: Scale object exponentially (smooth, INFINITE - no limits!)
 * - CTRL + DRAG: Rotate around surface normal (spawns at size 1.0, horizontal mouse = rotation)
 * - ALT + DRAG: Move/reposition object along surface (spawns at size 1.0, no scaling)
 * - SHIFT + DRAG: Uniform constrained scale (INFINITE with 0.25 snap increments)
 * - RIGHT-CLICK + DRAG: Free screen-space rotation (spawns at size 1.0, X/Y axes)
 * 
 * ARCHITECTURE:
 * - NO MODIFIER: Wait for drag threshold, then spawn and scale based on distance (INFINITE)
 * - WITH MODIFIER: Spawn IMMEDIATELY at default size (1.0), then apply modifier action
 * - DYNAMIC SWITCHING: Hold/release modifiers during drag to switch modes in real-time
 * - This prevents tiny objects when using modifiers
 * 
 * SCALING:
 * - Default drag: Exponential curve Math.pow(dist * 2.5, 1.8) - NO LIMITS!
 * - Shift drag: Exponential with snapping Math.pow(mouseDist * 10, 1.5) - NO LIMITS!
 * - Both scale infinitely from tiny to massive
 * 
 * MODIFIERS:
 * - Hold modifier BEFORE clicking to activate mode
 * - Hold/release modifiers DURING drag to switch modes dynamically
 * - Right-click on existing object to rotate it (doesn't spawn new)
 * - Status bar updates in real-time showing active mode
 */

export const useKGreebleInteraction = (
    sceneRef: any,
    mountRef: any,
    state: any,
    setters: any,
    callbacks: {
        spawnProceduralObject: (point: THREE.Vector3, normal: THREE.Vector3, type: string) => THREE.Group | null,
        captureCurrentTransform: () => void
    }
) => {
    // Get brush scale range from store
    const immBrushScaleMin = useGreebleStore(state => state.primitiveParams?.immBrushScaleMin || 0.01);
    const immBrushScaleMax = useGreebleStore(state => state.primitiveParams?.immBrushScaleMax || 3);
    
    // Stable refs for global event listeners
    const stateRef = useRef(state);
    const settersRef = useRef(setters);
    const callbacksRef = useRef(callbacks);
    const mouseUpRef = useRef<(e: any) => void>(() => { }); // Global listener ref

    useEffect(() => { stateRef.current = state; }, [state]);
    useEffect(() => { settersRef.current = setters; }, [setters]);
    useEffect(() => { callbacksRef.current = callbacks; }, [callbacks]);

    // Sculpting Logic Helper
    const deformMesh = (
        mesh: THREE.Mesh,
        point: THREE.Vector3,
        normal: THREE.Vector3,
        settings: any,
        tool: string,
        color: string
    ) => {
        if (!mesh.geometry) return;
        const posAttr = mesh.geometry.attributes.position;
        const worldMat = mesh.matrixWorld.clone();
        const invMat = worldMat.invert();
        const localPoint = point.clone().applyMatrix4(invMat);

        // Use average scale to normalize brush size in local space
        const scale = new THREE.Vector3();
        mesh.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
        const avgScale = (Math.abs(scale.x) + Math.abs(scale.y) + Math.abs(scale.z)) / 3 || 1;

        const localRadius = settings.radius / avgScale;
        const rSq = localRadius * localRadius;
        const strength = (settings.intensity * 0.05) / avgScale;

        // Transform normal to local space for direction
        const localNormal = normal.clone().transformDirection(invMat).normalize();

        // Needed for some tools
        const colAttr = mesh.geometry.attributes.color;
        // Vertex Normals needed for Inflate
        const normAttr = mesh.geometry.attributes.normal;

        const v = new THREE.Vector3();
        let modified = false;
        let colorModified = false;

        // Naive iteration
        for (let i = 0; i < posAttr.count; i++) {
            v.fromBufferAttribute(posAttr, i);
            const distSq = v.distanceToSquared(localPoint);

            if (distSq < rSq) {
                const dist = Math.sqrt(distSq);
                const falloff = 0.5 * (1 + Math.cos(Math.PI * (dist / localRadius)));
                const force = strength * falloff;

                if (tool === 'CLAY') {
                    // Standard Uplift
                    v.addScaledVector(localNormal, force);
                    posAttr.setXYZ(i, v.x, v.y, v.z);
                    modified = true;
                } else if (tool === 'ERODE') {
                    // Subtractive Clay
                    v.addScaledVector(localNormal, -force);
                    posAttr.setXYZ(i, v.x, v.y, v.z);
                    modified = true;
                } else if (tool === 'FLATTEN') {
                    // Flatten towards plane defined by point and normal
                    const vecToPoint = v.clone().sub(localPoint);
                    const distToPlane = vecToPoint.dot(localNormal);
                    v.addScaledVector(localNormal, -distToPlane * force * 0.5);
                    posAttr.setXYZ(i, v.x, v.y, v.z);
                    modified = true;
                } else if (tool === 'SMOOTH') {
                    // Smooth (Lerp to local average point - simple pinch effect)
                    v.lerp(localPoint, force * 0.1);
                    posAttr.setXYZ(i, v.x, v.y, v.z);
                    modified = true;
                } else if (tool === 'INFLATE') {
                    // Move along vertex normal
                    if (normAttr) {
                        const nX = normAttr.getX(i);
                        const nY = normAttr.getY(i);
                        const nZ = normAttr.getZ(i);
                        v.x += nX * force;
                        v.y += nY * force;
                        v.z += nZ * force;
                        posAttr.setXYZ(i, v.x, v.y, v.z);
                        modified = true;
                    }
                } else if (tool === 'NOISE') {
                    // Random noise
                    const rnd = (Math.random() - 0.5) * force * 0.5;
                    v.addScaledVector(localNormal, rnd);
                    posAttr.setXYZ(i, v.x, v.y, v.z);
                    modified = true;
                } else if (tool === 'PAINT') {
                    if (colAttr) {
                        const c = new THREE.Color(color);
                        // Blend current color with new color based on force
                        const currR = colAttr.getX(i);
                        const currG = colAttr.getY(i);
                        const currB = colAttr.getZ(i);
                        const a = force * 5.0; // Boost paint strength

                        const newR = THREE.MathUtils.lerp(currR, c.r, a);
                        const newG = THREE.MathUtils.lerp(currG, c.g, a);
                        const newB = THREE.MathUtils.lerp(currB, c.b, a);

                        colAttr.setXYZ(i, newR, newG, newB);
                        colorModified = true;
                    }
                }
            }
        }

        if (modified) {
            posAttr.needsUpdate = true;
            mesh.geometry.computeVertexNormals();
        }
        if (colorModified && colAttr) {
            colAttr.needsUpdate = true;
        }
    };

    const executeSpawn = (point: THREE.Vector3, normal: THREE.Vector3) => {
        sceneRef.current.activeObjects = [];
        const spawn = (p: THREE.Vector3, n: THREE.Vector3, isChild = false) => {
            const obj = callbacksRef.current.spawnProceduralObject(p, n, state.activeShape);
            if (obj) {
                // CHAOS MODIFIER
                if (state.chaosMode) {
                    obj.rotation.set(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2);
                    const s = 0.5 + Math.random();
                    obj.scale.multiplyScalar(s);
                }

                // FRACTAL ECHO (Recursive Spawning)
                if (state.fractalEcho && !isChild) {
                    const childCount = 4;
                    for (let i = 0; i < childCount; i++) {
                        const angle = (Math.PI * 2 * i) / childCount;
                        const offset = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)).multiplyScalar(0.5);
                        // Orient offset to surface normal
                        offset.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n));

                        const childP = p.clone().add(offset);
                        const child = spawn(childP, n, true); // Recursive call marked as child to stop infinite
                        if (child) {
                            child.scale.multiplyScalar(0.4);
                            sceneRef.current.activeObjects.push(child);
                        }
                    }
                }
            }
            return obj;
        };

        sceneRef.current.activeObjects.push(spawn(point, normal));

        if (state.symmetry === 'x') {
            const symP = point.clone(); symP.x *= -1;
            const symN = normal.clone(); symN.x *= -1;
            sceneRef.current.activeObjects.push(spawn(symP, symN));
        } else if (state.symmetry === 'z') {
            const symP = point.clone(); symP.z *= -1;
            const symN = normal.clone(); symN.z *= -1;
            sceneRef.current.activeObjects.push(spawn(symP, symN));
        } else if (state.symmetry === 'radial') {
            const r = Math.sqrt(point.x ** 2 + point.z ** 2);
            const startA = Math.atan2(point.z, point.x);
            for (let i = 1; i < state.radialCount; i++) {
                const a = startA + (Math.PI * 2 * i) / state.radialCount;
                const rx = Math.cos(a) * r;
                const rz = Math.sin(a) * r;
                const rP = new THREE.Vector3(rx, point.y, rz);
                const rN = normal.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), (Math.PI * 2 * i) / state.radialCount);
                sceneRef.current.activeObjects.push(spawn(rP, rN));
            }
        }
    };

    const handleMouseDown = useCallback((e: any) => {
        // Allow left-click (0) and right-click (2) for IMM brush
        if (e.button !== 0 && e.button !== 2) return;
        
        // Prevent context menu and default behavior on right-click
        if (e.button === 2) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        // GIZMO PROTECTION: If dragging gizmo, ignore selection clicks
        if (state.isGizmoDragging) return;

        const { raycaster, mouse, camera, rootGroup, selectionBox } = sceneRef.current;
        if (!camera || !raycaster) return;

        raycaster.setFromCamera(mouse, camera);

        // SCULPT MODE
        if (state.mode === 'sculpt' && !e.ctrlKey) {
            const intersects = raycaster.intersectObjects(rootGroup.children, true);
            const hit = intersects.find((i: any) => i.object.isMesh && i.object.visible);

            if (hit) {
                sceneRef.current.isDragging = true;
                // GLOBAL LISTENER: Catch release outside canvas
                const onUp = (ev: any) => {
                    if (mouseUpRef.current) mouseUpRef.current(ev);
                    window.removeEventListener('mouseup', onUp);
                    window.removeEventListener('pointerup', onUp);
                };
                window.addEventListener('mouseup', onUp);
                window.addEventListener('pointerup', onUp);

                sceneRef.current.controls.enabled = false;
                sceneRef.current.selectedObject = hit.object; // Track object being sculpted

                const mesh = hit.object as THREE.Mesh;
                const tool = state.sculptTool;

                // HANDLE MOVE & STRETCH INIT (Latching vertices)
                if (tool === 'MOVE' || tool === 'STRETCH') {
                    if (!mesh.geometry) return;

                    const posAttr = mesh.geometry.attributes.position;
                    const invMat = mesh.matrixWorld.clone().invert();
                    const localHover = hit.point.clone().applyMatrix4(invMat);

                    const scale = new THREE.Vector3();
                    mesh.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
                    const safeScale = (Math.abs(scale.x) + Math.abs(scale.y) + Math.abs(scale.z)) / 3 || 1;
                    const localRadius = state.sculptSettings.radius / safeScale;
                    const rSq = localRadius * localRadius;

                    const indices = [];
                    const weights = [];
                    const initialPos = [];

                    for (let i = 0; i < posAttr.count; i++) {
                        const px = posAttr.getX(i);
                        const py = posAttr.getY(i);
                        const pz = posAttr.getZ(i);
                        const dx = px - localHover.x;
                        const dy = py - localHover.y;
                        const dz = pz - localHover.z;
                        const dSq = dx * dx + dy * dy + dz * dz;

                        if (dSq < rSq) {
                            const dist = Math.sqrt(dSq);
                            // Soft selection
                            const t = dist / localRadius;
                            const w = 0.5 * (1 + Math.cos(Math.PI * t));

                            indices.push(i);
                            weights.push(w);
                            initialPos.push(new THREE.Vector3(px, py, pz));
                        }
                    }

                    // Store move data for drag phase
                    const viewDir = new THREE.Vector3();
                    camera.getWorldDirection(viewDir);

                    sceneRef.current.moveData = {
                        indices, weights, initialPos,
                        screenPlane: new THREE.Plane().setFromNormalAndCoplanarPoint(viewDir, hit.point),
                        grabPoint: hit.point.clone(),
                        grabNormal: hit.face ? hit.face.normal.clone() : new THREE.Vector3(0, 1, 0),
                        dragStartMouse: { x: e.clientX, y: e.clientY }
                    };
                } else {
                    // Immediate action for other brushes
                    if (hit.face) {
                        deformMesh(mesh, hit.point, hit.face.normal, state.sculptSettings, state.sculptTool, state.sculptColor);
                    }
                }

                setters.setStatus(`Sculpting (${tool})...`);
            }
            return;
        }

        // OTHER MODES
        const intersects = raycaster.intersectObjects(rootGroup.children, true);
        let hit = intersects.find((i: any) => i.object.visible);

        // SURFACE MODE FALLBACK
        if (!hit && state.surfaceMode) {
            const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
            const target = new THREE.Vector3();
            if (raycaster.ray.intersectPlane(plane, target)) {
                hit = {
                    point: target,
                    face: { normal: new THREE.Vector3(0, 1, 0) },
                    object: { matrixWorld: new THREE.Matrix4() } // Identity matrix
                };
            }
        }

        if (state.mode === 'edit' || state.mode === 'animate' || e.ctrlKey || e.shiftKey) {
            if (hit && hit.object && hit.object.userData) {
                let target = hit.object;
                while (target && target.userData && !target.userData.isContainer && target.parent) target = target.parent;

                if (target && target.userData && target.userData.isContainer) {
                    // SELECTION ONLY - GIZMO HANDLES TRANSFORM
                    sceneRef.current.selectedObject = target;
                    setters.setTransformData({
                        scale: target.scale.x, rotationY: target.rotation.y, height: target.position.y,
                        posX: target.position.x, posY: target.position.y, posZ: target.position.z,
                        rotX: target.rotation.x, rotY: target.rotation.y, rotZ: target.rotation.z,
                        scaleX: target.scale.x, scaleY: target.scale.y, scaleZ: target.scale.z
                    });
                    setters.setSelectedObjectUUID(target.uuid);
                    if (selectionBox) { selectionBox.setFromObject(target); selectionBox.visible = true; }

                    // SHIFT + CLICK: FORCE MOVE MODE
                    if (e.shiftKey) {
                        setters.setMode('edit');
                        setters.setGizmoMode('translate');
                        setters.setStatus("Quick Move Engaged");
                    } else {
                        setters.setStatus("Subject Acquired");
                    }
                }
            } else {
                sceneRef.current.selectedObject = null;
                setters.setSelectedObjectUUID(null);
                if (selectionBox) selectionBox.visible = false;

                if (state.mode === 'edit') {
                    setters.setMode('build');
                    setters.setStatus("Build Protocol Resumed");
                } else {
                    setters.setStatus("Scanning...");
                }
            }
        } else if (state.mode === 'build') {
            if (hit) {
                // 🔥 RIGHT-CLICK ON EXISTING OBJECT: Don't spawn new, just rotate existing
                if (e.button === 2 && sceneRef.current.hasSpawned && sceneRef.current.activeObjects && sceneRef.current.activeObjects.length > 0) {
                    // Just enable dragging for rotation, don't spawn new object
                    sceneRef.current.isDragging = true;
                    sceneRef.current.controls.enabled = false;
                    
                    // Store initial mouse position for rotation
                    sceneRef.current.immBrushMode = {
                        isRightClick: true,
                        ctrlKey: false,
                        altKey: false,
                        shiftKey: false,
                        startMouseX: e.clientX,
                        startMouseY: e.clientY,
                        initialRotation: 0,
                        initialPosition: hit.point.clone()
                    };
                    
                    setters.setStatus("IMM BRUSH: FREE ROTATE (Right-Click)");
                    return; // Don't spawn new object!
                }
                
                sceneRef.current.isDragging = true;
                // GLOBAL LISTENER: Catch release outside canvas
                const onUp = (ev: any) => {
                    if (mouseUpRef.current) mouseUpRef.current(ev);
                    window.removeEventListener('mouseup', onUp);
                    window.removeEventListener('pointerup', onUp);
                };
                window.addEventListener('mouseup', onUp);
                window.addEventListener('pointerup', onUp);

                sceneRef.current.hasSpawned = false; // RESET SPAWN FLAG
                sceneRef.current.controls.enabled = false;
                let point = hit.point.clone();

                // GRID LOCK MODIFIER
                if (state.gridLock && state.gridSize > 0) {
                    point.x = Math.round(point.x / state.gridSize) * state.gridSize;
                    point.y = Math.round(point.y / state.gridSize) * state.gridSize;
                    point.z = Math.round(point.z / state.gridSize) * state.gridSize;
                }

                // VOID ANCHOR MODIFIER (Override Normal)
                let normal = state.voidAnchor
                    ? new THREE.Vector3(0, 1, 0)
                    : (hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize() : new THREE.Vector3(0, 1, 0));

                sceneRef.current.startPoint.copy(point);

                // STORE SPAWN DATA FOR DRAG TRIGGER
                sceneRef.current.pendingSpawn = { point, normal };
                sceneRef.current.activeObjects = [];
                
                // 🔥 IMM BRUSH INITIAL STATE (will be updated live during drag)
                sceneRef.current.immBrushMode = {
                    isRightClick: e.button === 2,
                    ctrlKey: e.ctrlKey,
                    altKey: e.altKey,
                    shiftKey: e.shiftKey,
                    startMouseX: e.clientX,
                    startMouseY: e.clientY,
                    initialRotation: 0,
                    initialPosition: point.clone()
                };
                
                // Status feedback for active mode
                if (e.button === 2) {
                    setters.setStatus("IMM BRUSH: FREE ROTATE (Right-Click)");
                } else if (e.ctrlKey) {
                    setters.setStatus("IMM BRUSH: SURFACE ROTATE (Ctrl)");
                } else if (e.altKey) {
                    setters.setStatus("IMM BRUSH: MOVE (Alt)");
                } else if (e.shiftKey) {
                    setters.setStatus("IMM BRUSH: UNIFORM SCALE (Shift)");
                } else {
                    setters.setStatus("IMM BRUSH: SCALE (Drag)");
                }
            }
        }
    }, [state, setters, callbacks]);

    const handleMouseMove = useCallback((e: any) => {
        if (!mountRef.current || !sceneRef.current.camera) return;
        const rect = mountRef.current.getBoundingClientRect();
        sceneRef.current.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        sceneRef.current.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        const { isDragging, mouse, camera, raycaster, selectedObject, rootGroup, brushCursor, moveData } = sceneRef.current;

        raycaster.setFromCamera(mouse, camera);

        // SCULPT MODE VISUALS & LOGIC
        if (state.mode === 'sculpt') {
            const intersects = raycaster.intersectObjects(rootGroup.children, true);
            const hit = intersects.find((i: any) => i.object.isMesh && i.object.visible);

            // Cursor Update
            if (hit && brushCursor) {
                brushCursor.visible = true;
                brushCursor.position.copy(hit.point);
                brushCursor.lookAt(hit.point.clone().add(hit.face ? hit.face.normal : new THREE.Vector3(0, 1, 0)));
                const s = state.sculptSettings.radius;
                brushCursor.scale.set(s, s, s);
                // Color Feedback
                const mat = brushCursor.material;
                if (state.sculptTool === 'PAINT') mat.color.set(state.sculptColor);
                else mat.color.set(0x3daee9);
            } else if (brushCursor) {
                brushCursor.visible = false;
            }

            // Handle Sculpt Drag
            if (isDragging && selectedObject && state.mode === 'sculpt') {
                const tool = state.sculptTool;
                const mesh = selectedObject as THREE.Mesh;

                if (tool === 'MOVE' || tool === 'STRETCH') {
                    // MOVE/STRETCH LOGIC
                    if (moveData) {
                        if (tool === 'STRETCH') {
                            const dy = (e.clientY - moveData.dragStartMouse.y);
                            const stretchFactor = dy * 0.01;
                            const worldDelta = moveData.grabNormal.clone().multiplyScalar(-stretchFactor);
                            const invMat = mesh.matrixWorld.clone().invert();
                            const localDelta = worldDelta.clone().transformDirection(invMat);
                            const posAttr = mesh.geometry.attributes.position;

                            for (let i = 0; i < moveData.indices.length; i++) {
                                const idx = moveData.indices[i];
                                const w = moveData.weights[i];
                                const orig = moveData.initialPos[i];
                                const moveVec = localDelta.clone().multiplyScalar(w);
                                posAttr.setXYZ(idx, orig.x + moveVec.x, orig.y + moveVec.y, orig.z + moveVec.z);
                            }
                            posAttr.needsUpdate = true;
                            mesh.geometry.computeVertexNormals();
                        } else {
                            // MOVE (Screen Plane)
                            const targetPoint = new THREE.Vector3();
                            raycaster.ray.intersectPlane(moveData.screenPlane, targetPoint);
                            if (targetPoint) {
                                const invMat = mesh.matrixWorld.clone().invert();
                                const localTarget = targetPoint.clone().applyMatrix4(invMat);
                                const localGrab = moveData.grabPoint.clone().applyMatrix4(invMat);
                                const localDelta = localTarget.sub(localGrab);
                                const posAttr = mesh.geometry.attributes.position;

                                for (let i = 0; i < moveData.indices.length; i++) {
                                    const idx = moveData.indices[i];
                                    const w = moveData.weights[i];
                                    const orig = moveData.initialPos[i];
                                    const moveVec = localDelta.clone().multiplyScalar(w);
                                    posAttr.setXYZ(idx, orig.x + moveVec.x, orig.y + moveVec.y, orig.z + moveVec.z);
                                }
                                posAttr.needsUpdate = true;
                                mesh.geometry.computeVertexNormals();
                            }
                        }
                    }
                } else {
                    // CONTINUOUS TOOLS (Clay, Smooth, Paint, etc)
                    if (hit && hit.face) {
                        deformMesh(mesh, hit.point, hit.face.normal, state.sculptSettings, tool, state.sculptColor);
                    }
                }
            }
            return; // Exit here, handled sculpt
        }

        if (isDragging) {
            if (state.mode === 'build') {
                const { startPoint, pendingSpawn, hasSpawned } = sceneRef.current;
                if (!startPoint) return;

                // CHECK DRAG THRESHOLD
                const screenStart = startPoint.clone().project(camera);
                const dx = mouse.x - screenStart.x;
                const dy = mouse.y - screenStart.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                // THRESHOLD VALUE (Normalized screen space)
                const DRAG_THRESHOLD = 0.02; // Equivalent to small pixel movement
                
                // 🔥 ZBRUSH IMM BRUSH: Check LIVE modifier state from event
                const immMode = sceneRef.current.immBrushMode;
                
                // Check CURRENT keyboard state (live during drag)
                const isCtrlHeld = e.ctrlKey;
                const isAltHeld = e.altKey;
                const isShiftHeld = e.shiftKey;
                const isRightClickMode = immMode && immMode.isRightClick;
                
                const hasModifier = isCtrlHeld || isAltHeld || isShiftHeld || isRightClickMode;
                
                // Spawn immediately if modifier is held, otherwise wait for drag threshold
                if (!hasSpawned && pendingSpawn) {
                    if (hasModifier || dist > DRAG_THRESHOLD) {
                        executeSpawn(pendingSpawn.point, pendingSpawn.normal);
                        sceneRef.current.hasSpawned = true;
                        
                        // Set default scale for modifier modes (1.0 = normal size)
                        if (hasModifier && sceneRef.current.activeObjects) {
                            sceneRef.current.activeObjects.forEach((obj: any) => {
                                if (obj) {
                                    obj.scale.set(1, 1, 1); // Default size
                                }
                            });
                        }
                    }
                }

                if (sceneRef.current.hasSpawned && sceneRef.current.activeObjects) {
                    
                    // 🔥 ZBRUSH-STYLE IMM BRUSH MODIFIERS (check LIVE state)
                    if (immMode) {
                        const mouseDeltaX = e.clientX - immMode.startMouseX;
                        const mouseDeltaY = e.clientY - immMode.startMouseY;
                        
                        // Update status based on current modifiers
                        if (isAltHeld) {
                            setters.setStatus("IMM BRUSH: MOVE (Alt)");
                        } else if (isCtrlHeld) {
                            setters.setStatus("IMM BRUSH: SURFACE ROTATE (Ctrl)");
                        } else if (isShiftHeld) {
                            setters.setStatus("IMM BRUSH: UNIFORM SCALE (Shift)");
                        } else if (isRightClickMode) {
                            setters.setStatus("IMM BRUSH: FREE ROTATE (Right-Click)");
                        } else {
                            setters.setStatus("IMM BRUSH: SCALE (Drag)");
                        }
                        
                        sceneRef.current.activeObjects.forEach((obj: any) => {
                            if (!obj) return;
                            
                            // ALT + DRAG: MOVE/REPOSITION (no scaling)
                            if (isAltHeld) {
                                // Move along surface plane
                                const intersects = raycaster.intersectObjects(rootGroup.children, true);
                                const newHit = intersects.find((i: any) => i.object.visible);
                                if (newHit) {
                                    const newPoint = newHit.point.clone();
                                    if (state.gridLock && state.gridSize > 0) {
                                        newPoint.x = Math.round(newPoint.x / state.gridSize) * state.gridSize;
                                        newPoint.y = Math.round(newPoint.y / state.gridSize) * state.gridSize;
                                        newPoint.z = Math.round(newPoint.z / state.gridSize) * state.gridSize;
                                    }
                                    obj.position.copy(newPoint);
                                }
                                // Keep scale at 1.0 (no scaling in move mode)
                            }
                            // CTRL + DRAG: ROTATE AROUND SURFACE NORMAL
                            else if (isCtrlHeld) {
                                // Horizontal mouse movement = rotation around surface normal
                                const rotationSpeed = 0.01;
                                const angle = mouseDeltaX * rotationSpeed;
                                
                                // Get surface normal from spawn data
                                const normal = pendingSpawn.normal;
                                const axis = normal.clone().normalize();
                                
                                // Apply rotation around surface normal
                                const quaternion = new THREE.Quaternion().setFromAxisAngle(axis, angle);
                                obj.setRotationFromQuaternion(quaternion);
                                
                                // Keep scale at 1.0 (no scaling in rotate mode)
                            }
                            // RIGHT-CLICK DRAG: FREE SCREEN-SPACE ROTATION
                            else if (isRightClickMode) {
                                // Horizontal = Y-axis rotation, Vertical = X-axis rotation
                                const rotX = -mouseDeltaY * 0.01;
                                const rotY = mouseDeltaX * 0.01;
                                
                                obj.rotation.set(rotX, rotY, 0);
                                
                                // Keep scale at 1.0 (no scaling in rotate mode)
                            }
                            // SHIFT + DRAG: UNIFORM CONSTRAINED SCALE (with user-defined range)
                            else if (isShiftHeld) {
                                // Map mouse distance to scale range with exponential curve
                                const normalizedDist = Math.min(dist * 3, 1); // Normalize to 0-1
                                const exponentialFactor = Math.pow(normalizedDist, 1.5); // Smooth exponential
                                const rawScale = immBrushScaleMin + (exponentialFactor * (immBrushScaleMax - immBrushScaleMin));
                                const snappedScale = Math.round(rawScale * 4) / 4; // Snap to 0.25 increments
                                const finalScale = Math.max(immBrushScaleMin, Math.min(immBrushScaleMax, snappedScale));
                                
                                obj.scale.set(finalScale, finalScale, finalScale);
                            }
                            // DEFAULT: SMOOTH EXPONENTIAL SCALING (user-defined range)
                            else {
                                // Map normalized distance (0-1) to scale range (min-max) with smooth exponential curve
                                const normalizedDist = Math.min(dist * 3, 1); // Normalize drag distance to 0-1
                                const exponentialFactor = Math.pow(normalizedDist, 1.5); // Smooth exponential curve
                                const scale = immBrushScaleMin + (exponentialFactor * (immBrushScaleMax - immBrushScaleMin));
                                const mult = state.chaosMode ? (Math.random() * 0.5 + 0.75) : 1;
                                obj.scale.set(scale * mult, scale * mult, scale * mult);
                            }
                        });
                    } else {
                        // FALLBACK: Original scaling behavior
                        const scale = Math.pow(dist * 2.5, 1.8);
                        sceneRef.current.activeObjects.forEach((obj: any) => {
                            if (obj) {
                                const mult = state.chaosMode ? (Math.random() * 0.5 + 0.75) : 1;
                                obj.scale.set(scale * mult, scale * mult, scale * mult);
                            }
                        });
                    }
                }
            }
        }
    }, [state, setters]);

    const handleMouseUp = useCallback((_e?: any) => {
        // Use stable refs for callback execution
        const state = stateRef.current;
        const setters = settersRef.current;
        const callbacks = callbacksRef.current;

        if (!sceneRef.current || !sceneRef.current.rootGroup) return;

        // IDEMPOTENCY: prevent double-fire
        if (!sceneRef.current.isDragging) return;

        if (state.mode === 'animate' && sceneRef.current.selectedObject) {
            if (callbacks.captureCurrentTransform) callbacks.captureCurrentTransform();
        }

        // Finalize Sculpt
        if (state.mode === 'sculpt') {
            const obj = sceneRef.current.selectedObject as THREE.Mesh;
            if (obj && obj.geometry) {
                obj.geometry.computeVertexNormals();
                obj.geometry.computeBoundingBox();
                obj.geometry.computeBoundingSphere();
            }
            setters.setStatus("Sculpt Operation Complete");
            sceneRef.current.moveData = null; // Clear move data
        }

        sceneRef.current.isDragging = false;
        if (sceneRef.current.controls) sceneRef.current.controls.enabled = true;
        if (state.mode === 'build') {
            let count = 0;
            sceneRef.current.rootGroup.traverse((o: any) => { if (o.isMesh) count++; });
            if (setters.setObjectCount) setters.setObjectCount(count);
            setters.setStatus("Anomaly Created");
        }
    }, []);

    // Sync stable handler to ref for global events
    useEffect(() => { mouseUpRef.current = handleMouseUp; }, [handleMouseUp]);

    const resetCamera = useCallback(() => {
        if (!sceneRef.current.camera) return;
        sceneRef.current.camera.position.set(3, 4, 6);
        sceneRef.current.controls.target.set(0, 0, 0);
    }, []);

    return { handleMouseDown, handleMouseMove, handleMouseUp, resetCamera };
};
