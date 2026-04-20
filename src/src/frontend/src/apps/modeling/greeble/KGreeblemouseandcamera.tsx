
import { useCallback, useRef } from 'react';
import * as THREE from 'three';

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
            const obj = callbacks.spawnProceduralObject(p, n, state.activeShape);
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
        if (e.button !== 0) return;
        // GIZMO PROTECTION: If dragging gizmo, ignore selection clicks
        if (state.isGizmoDragging && state.isGizmoDragging.current) return;

        const { raycaster, mouse, camera, rootGroup, selectionBox } = sceneRef.current;
        if (!camera || !raycaster) return;

        raycaster.setFromCamera(mouse, camera);

        // SCULPT MODE
        if (state.mode === 'sculpt' && !e.ctrlKey) {
            const intersects = raycaster.intersectObjects(rootGroup.children, true);
            const hit = intersects.find((i: any) => i.object.isMesh && i.object.visible);

            if (hit) {
                sceneRef.current.isDragging = true;
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
                while (target && !target.userData.isContainer && target.parent) target = target.parent;

                if (target && target.userData.isContainer) {
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
                sceneRef.current.isDragging = true;
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
            }
        }
    }, [state, setters, callbacks]);

    const handleMouseMove = useCallback((e: any) => {
        if (!mountRef.current || !sceneRef.current.camera) return;
        const rect = mountRef.current.getBoundingClientRect();
        sceneRef.current.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        sceneRef.current.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        const { isDragging, mouse, camera, raycaster, dragPlane, dragOffset, selectedObject, dragTarget, rootGroup, brushCursor, moveData } = sceneRef.current;

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
            if (isDragging && selectedObject) {
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
                const { startPoint, activeObjects, pendingSpawn, hasSpawned } = sceneRef.current;
                if (!startPoint) return;

                // CHECK DRAG THRESHOLD
                const screenStart = startPoint.clone().project(camera);
                const dx = mouse.x - screenStart.x;
                const dy = mouse.y - screenStart.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                // THRESHOLD VALUE (Normalized screen space)
                const DRAG_THRESHOLD = 0.02; // Equivalent to small pixel movement

                if (!hasSpawned && dist > DRAG_THRESHOLD && pendingSpawn) {
                    executeSpawn(pendingSpawn.point, pendingSpawn.normal);
                    sceneRef.current.hasSpawned = true;
                }

                if (sceneRef.current.hasSpawned && sceneRef.current.activeObjects) {
                    // Base scale logic
                    let scale = Math.max(0.05, Math.pow(dist * 4, 1.5));

                    sceneRef.current.activeObjects.forEach((obj: any) => {
                        if (obj) {
                            // If chaos mode, maintain relative scale noise
                            const mult = state.chaosMode ? (Math.random() * 0.5 + 0.75) : 1;
                            obj.scale.set(scale * mult, scale * mult, scale * mult);
                        }
                    });
                }
            }
        }
    }, [state, setters]);

    const handleMouseUp = useCallback(() => {
        if (!sceneRef.current || !sceneRef.current.rootGroup) return;
        if (state.mode === 'animate' && sceneRef.current.isDragging && sceneRef.current.selectedObject) {
            if (callbacks.captureCurrentTransform) callbacks.captureCurrentTransform();
        }

        // Finalize Sculpt
        if (state.mode === 'sculpt' && sceneRef.current.isDragging) {
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
            setters.setObjectCount(count);
            setters.setStatus("Anomaly Created");
        }
    }, [state, setters, callbacks]);

    const resetCamera = useCallback(() => {
        if (!sceneRef.current.camera) return;
        sceneRef.current.camera.position.set(3, 4, 6);
        sceneRef.current.controls.target.set(0, 0, 0);
    }, []);

    return { handleMouseDown, handleMouseMove, handleMouseUp, resetCamera };
};
