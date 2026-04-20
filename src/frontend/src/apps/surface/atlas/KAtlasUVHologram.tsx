/**
 * KAtlasUVHologram.tsx
 * Revolutionary 3D UV visualization where Z-elevation = distortion/stretch
 * Islands float as terrain - perfect UVs are flat, stretched UVs are mountains.
 * 
 * V2 Features:
 * - Stress Sculpting Gizmo (Brush to relax UVs directly on the hologram)
 * - Visual Stress Guide
 * - ResizeObserver for robust layout
 * - Expanded Grid
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Mountain, Eye, Brush } from 'lucide-react';

interface KAtlasUVHologramProps {
    meshes: { [uuid: string]: THREE.Mesh };
    selectedIds: string[];
    version?: number;
}

export default function KAtlasUVHologram({ meshes, selectedIds, version }: KAtlasUVHologramProps) {
    const mountRef = useRef<HTMLDivElement>(null);
    const [elevationScale, setElevationScale] = useState(0.25);
    const [showWireframe, setShowWireframe] = useState(true);

    // Brush State
    const [brushMode, setBrushMode] = useState(false);
    const [brushRadius, setBrushRadius] = useState(0.1);
    const [brushStrength, setBrushStrength] = useState(0.5);

    const engine = useRef<{
        scene: THREE.Scene | null;
        camera: THREE.PerspectiveCamera | null;
        renderer: THREE.WebGLRenderer | null;
        controls: OrbitControls | null;
        hologramMesh: THREE.Mesh | null;
        wireframe: THREE.LineSegments | null;
        cursorMesh: THREE.Mesh | null;
        basePlane: THREE.Mesh | null;
        raycaster: THREE.Raycaster;
        mouse: THREE.Vector2;
        vertexMap: { meshId: string, index: number }[]; // Maps hologram index -> source mesh index
        adjacency: number[][]; // Vertex structural neighbors
        isDragging: boolean;
    }>({
        scene: null, camera: null, renderer: null, controls: null,
        hologramMesh: null, wireframe: null, cursorMesh: null, basePlane: null,
        raycaster: new THREE.Raycaster(), mouse: new THREE.Vector2(),
        vertexMap: [], adjacency: [], isDragging: false
    });

    // Initialize Three.js scene
    useEffect(() => {
        if (!mountRef.current) return;

        const container = mountRef.current;
        const width = container.clientWidth;
        const height = container.clientHeight;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x050508);
        scene.fog = new THREE.Fog(0x050508, 3, 8);

        const camera = new THREE.PerspectiveCamera(50, width / height, 0.01, 100);
        camera.position.set(0.5, 0.8, 1.5);
        camera.lookAt(0.5, 0, 0.5);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.2;
        container.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.target.set(0.5, 0, 0.5);
        controls.update();

        // Lighting
        const ambientLight = new THREE.AmbientLight(0x404060, 0.5);
        scene.add(ambientLight);
        const topLight = new THREE.DirectionalLight(0x00ffcc, 0.8);
        topLight.position.set(0, 5, 0);
        scene.add(topLight);
        const sideLight = new THREE.PointLight(0xff00ff, 0.3, 10);
        sideLight.position.set(2, 1, 2);
        scene.add(sideLight);

        // Grid & Plane
        const gridHelper = new THREE.GridHelper(3, 30, 0x00ffcc, 0x112222);
        gridHelper.position.set(0.5, -0.02, 0.5); // Lowered to avoid Z-fighting
        scene.add(gridHelper);

        const basePlaneGeo = new THREE.PlaneGeometry(3, 3);
        const basePlaneMat = new THREE.MeshBasicMaterial({
            color: 0x00ffcc, transparent: true, opacity: 0.02, side: THREE.DoubleSide, depthWrite: false
        });
        const basePlane = new THREE.Mesh(basePlaneGeo, basePlaneMat);
        basePlane.rotation.x = -Math.PI / 2;
        basePlane.position.set(0.5, -0.01, 0.5); // Slightly below UVs
        scene.add(basePlane);

        // Cursor Gizmo
        const cursorGeo = new THREE.RingGeometry(0.02, 0.025, 32);
        const cursorMat = new THREE.MeshBasicMaterial({ color: 0xff3366, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
        const cursorMesh = new THREE.Mesh(cursorGeo, cursorMat);
        cursorMesh.rotation.x = -Math.PI / 2;
        cursorMesh.visible = false;
        scene.add(cursorMesh);

        engine.current = {
            scene, camera, renderer, controls,
            hologramMesh: null, wireframe: null, cursorMesh, basePlane,
            raycaster: new THREE.Raycaster(), mouse: new THREE.Vector2(),
            vertexMap: [], adjacency: [], isDragging: false
        };

        // Animation Loop
        let frameId: number;
        const animate = () => {
            frameId = requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        };
        animate();

        // Resize
        const handleResize = () => {
            if (!container) return;
            const w = container.clientWidth;
            const h = container.clientHeight;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        };
        const resizeObserver = new ResizeObserver(() => handleResize());
        resizeObserver.observe(container);

        return () => {
            cancelAnimationFrame(frameId);
            resizeObserver.disconnect();
            renderer.dispose();
            container.removeChild(renderer.domElement);
        };
    }, []);

    // Build Hologram
    useEffect(() => {
        if (!engine.current.scene) return;
        const scene = engine.current.scene;

        // Cleanup
        if (engine.current.hologramMesh) {
            scene.remove(engine.current.hologramMesh);
            engine.current.hologramMesh.geometry.dispose();
            (engine.current.hologramMesh.material as THREE.Material).dispose();
        }
        if (engine.current.wireframe) {
            scene.remove(engine.current.wireframe);
            engine.current.wireframe.geometry.dispose();
            (engine.current.wireframe.material as THREE.Material).dispose();
        }

        if (selectedIds.length === 0) return;

        const positions: number[] = [];
        const colors: number[] = [];
        const indices: number[] = []; // Unified indices
        const vertexMap: { meshId: string, index: number }[] = [];
        let totalVertexOffset = 0;

        selectedIds.forEach(id => {
            const mesh = meshes[id];
            if (!mesh || !mesh.geometry.attributes.uv) return;

            const geo = mesh.geometry;
            const uvAttr = geo.attributes.uv;
            const stretchFactors = calculateStretchFactors(geo);

            for (let i = 0; i < uvAttr.count; i++) {
                const u = uvAttr.getX(i);
                const v = uvAttr.getY(i);
                const stretch = stretchFactors[i] || 0;

                positions.push(u, stretch * elevationScale, v);

                const t = Math.min(1, stretch * 2);
                colors.push(t, 1 - t * 0.5, 1 - t);

                vertexMap.push({ meshId: id, index: i });
            }

            // Handle Indices
            if (geo.index) {
                const indexAttr = geo.index;
                for (let i = 0; i < indexAttr.count; i += 3) {
                    indices.push(
                        indexAttr.getX(i) + totalVertexOffset,
                        indexAttr.getX(i + 1) + totalVertexOffset,
                        indexAttr.getX(i + 2) + totalVertexOffset
                    );
                }
            } else {
                for (let i = 0; i < uvAttr.count; i += 3) {
                    indices.push(i + totalVertexOffset, i + 1 + totalVertexOffset, i + 2 + totalVertexOffset);
                }
            }
            totalVertexOffset += uvAttr.count;
        });

        if (positions.length === 0) return;

        const hologramGeo = new THREE.BufferGeometry();
        hologramGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        hologramGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        hologramGeo.setIndex(indices);
        hologramGeo.computeVertexNormals();

        // Build Adjacency Graph for Smoothing
        const adjacency: number[][] = Array.from({ length: positions.length / 3 }, () => []);
        for (let i = 0; i < indices.length; i += 3) {
            const a = indices[i];
            const b = indices[i + 1];
            const c = indices[i + 2];
            // Add undirected edges
            if (!adjacency[a].includes(b)) adjacency[a].push(b);
            if (!adjacency[a].includes(c)) adjacency[a].push(c);
            if (!adjacency[b].includes(a)) adjacency[b].push(a);
            if (!adjacency[b].includes(c)) adjacency[b].push(c);
            if (!adjacency[c].includes(a)) adjacency[c].push(a);
            if (!adjacency[c].includes(b)) adjacency[c].push(b);
        }
        engine.current.adjacency = adjacency;
        engine.current.vertexMap = vertexMap;

        const hologramMat = new THREE.MeshStandardMaterial({
            vertexColors: true, transparent: true, opacity: 0.85, side: THREE.DoubleSide,
            emissive: 0x00ffcc, emissiveIntensity: 0.15, metalness: 0.3, roughness: 0.7
        });

        const hologramMesh = new THREE.Mesh(hologramGeo, hologramMat);
        scene.add(hologramMesh);
        engine.current.hologramMesh = hologramMesh;

        if (showWireframe) {
            const wireGeo = new THREE.WireframeGeometry(hologramGeo);
            const wireMat = new THREE.LineBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.4 });
            const wireframe = new THREE.LineSegments(wireGeo, wireMat);
            scene.add(wireframe);
            engine.current.wireframe = wireframe;
        }

    }, [selectedIds, meshes, version, elevationScale, showWireframe]);

    // Track Alt Key for Navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Alt') {
                if (engine.current.controls) engine.current.controls.enabled = true;
                if (engine.current.cursorMesh) engine.current.cursorMesh.visible = false;
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Alt') {
                // If we are not dragging, cursor comes back
                if (!engine.current.isDragging && engine.current.cursorMesh) {
                    // Cursor visibility handled by mouse move, but force update
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    // Input Handling
    useEffect(() => {
        if (!mountRef.current) return;
        const container = mountRef.current;

        const handlePointerMove = (e: PointerEvent) => {
            // HIDE CURSOR IF ALT PRESSED (Nav Mode)
            if (e.altKey) {
                if (engine.current.cursorMesh) engine.current.cursorMesh.visible = false;
                return;
            }

            if (!engine.current.hologramMesh || !engine.current.cursorMesh) return;

            const rect = container.getBoundingClientRect();
            engine.current.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            engine.current.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

            engine.current.raycaster.setFromCamera(engine.current.mouse, engine.current.camera!);
            const intersects = engine.current.raycaster.intersectObject(engine.current.hologramMesh);

            if (intersects.length > 0) {
                const hit = intersects[0];
                engine.current.cursorMesh.visible = brushMode;
                engine.current.cursorMesh.position.copy(hit.point);
                engine.current.cursorMesh.lookAt(hit.point.clone().add(hit.face!.normal));

                // Scale cursor ring
                const s = brushRadius * 2;
                engine.current.cursorMesh.scale.set(s, s, s);

                // Sculpting Logic
                if (engine.current.isDragging && brushMode) {
                    sculpt(hit.point);
                }
            } else {
                engine.current.cursorMesh.visible = false;
            }
        };

        const handlePointerDown = (e: PointerEvent) => {
            // ALT CLICK = ROTATE (Passthrough to OrbitControls)
            if (e.altKey) return;

            if (e.button === 0 && brushMode) { // Left click
                engine.current.raycaster.setFromCamera(engine.current.mouse, engine.current.camera!);
                const intersects = engine.current.raycaster.intersectObject(engine.current.hologramMesh!);

                if (intersects.length > 0) {
                    // Hit Mesh -> Sculpt Mode
                    engine.current.controls!.enabled = false;
                    engine.current.isDragging = true;
                    sculpt(intersects[0].point);
                } else {
                    // Hit Background -> Camera Mode
                    engine.current.controls!.enabled = true;
                    engine.current.isDragging = false;
                }
            }
        };

        const handlePointerUp = () => {
            engine.current.isDragging = false;
            engine.current.controls!.enabled = true;
            // TODO: Trigger Full Rebuild (height update) here if we want perfectly accurate height after sculpt
        };

        container.addEventListener('pointermove', handlePointerMove);
        container.addEventListener('pointerdown', handlePointerDown);
        window.addEventListener('pointerup', handlePointerUp);

        return () => {
            container.removeEventListener('pointermove', handlePointerMove);
            container.removeEventListener('pointerdown', handlePointerDown);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, [brushMode, brushRadius, brushStrength]);

    const sculpt = (point: THREE.Vector3) => {
        const { hologramMesh, adjacency, vertexMap } = engine.current;
        if (!hologramMesh) return;

        const posAttr = hologramMesh.geometry.attributes.position;
        const count = posAttr.count;
        const radiusSq = brushRadius * brushRadius;
        const localPos = new THREE.Vector3(); // Optimization: Reuse vector

        // Ideally use a spatial hash, but iteration is okay for <50k verts
        // optimization: bounds check

        for (let i = 0; i < count; i++) {
            localPos.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
            // Check distance in XZ plane (UV plane)
            const dx = localPos.x - point.x;
            const dz = localPos.z - point.z; // Z in 3D is V in UV

            if (dx * dx + dz * dz < radiusSq) {
                // Inside Brush
                // get average of neighbors
                const neighbors = adjacency[i];
                if (neighbors.length > 0) {
                    let avgX = 0, avgZ = 0;
                    neighbors.forEach(n => {
                        avgX += posAttr.getX(n);
                        avgZ += posAttr.getZ(n);
                    });
                    avgX /= neighbors.length;
                    avgZ /= neighbors.length;

                    // Laplacian Smooth
                    const str = brushStrength * 0.1; // scale down for stability
                    const newX = localPos.x + (avgX - localPos.x) * str;
                    const newZ = localPos.z + (avgZ - localPos.z) * str;

                    // Update Hologram (Immediate Visual Feedback)
                    posAttr.setX(i, newX);
                    posAttr.setZ(i, newZ);

                    // Update Source Mesh (The Real UVs)
                    const mapping = vertexMap[i];
                    if (mapping) {
                        const srcMesh = meshes[mapping.meshId];
                        if (srcMesh) {
                            srcMesh.geometry.attributes.uv.setXY(mapping.index, newX, newZ); // Z is V
                            srcMesh.geometry.attributes.uv.needsUpdate = true;
                        }
                    }
                }
            }
        }
        posAttr.needsUpdate = true;
    };

    return (
        <div className="w-full h-full relative bg-[#050508] overflow-hidden">
            <div ref={mountRef} className="absolute inset-0" />

            {/* Hologram Controls */}
            <div className="absolute top-14 left-2 z-40 bg-[#0a0a0a]/90 backdrop-blur-sm border border-[#00ffcc]/30 rounded-lg p-3 space-y-3">
                <div className="text-[10px] font-bold text-[#00ffcc] uppercase tracking-widest flex items-center gap-2">
                    <Mountain size={12} /> UV HOLOGRAM
                </div>

                {/* Elevation */}
                <div className="space-y-1">
                    <div className="flex justify-between text-[9px] text-gray-400">
                        <span>ELEVATION</span>
                        <span className="text-[#00ffcc]">{elevationScale.toFixed(2)}</span>
                    </div>
                    <input type="range" min="0" max="2" step="0.05" value={elevationScale}
                        onChange={e => setElevationScale(parseFloat(e.target.value))}
                        className="w-32 h-1 bg-[#222] rounded-full appearance-none accent-[#00ffcc] cursor-pointer" />
                </div>

                <div className="h-px bg-[#333] my-2" />

                {/* Stress Brush - The Gizmo */}
                <div className="space-y-2">
                    <button
                        onClick={() => setBrushMode(!brushMode)}
                        className={`w-full flex items-center justify-center gap-2 px-2 py-2 text-[9px] font-bold rounded transition-colors ${brushMode
                            ? 'bg-[#ff3366] text-black shadow-[0_0_10px_rgba(255,51,102,0.4)]'
                            : 'bg-[#222] text-gray-400 hover:text-white'
                            }`}
                    >
                        <Brush size={12} />
                        {brushMode ? 'STRESS DEFORMER ON' : 'ACTIVATE DEFORMER'}
                    </button>

                    {brushMode && (
                        <div className="animate-in fade-in slide-in-from-top-1 space-y-2 pt-1">
                            <div className="space-y-1">
                                <div className="flex justify-between text-[9px] text-gray-400"><span>RADIUS</span></div>
                                <input type="range" min="0.01" max="0.5" step="0.01" value={brushRadius}
                                    onChange={e => setBrushRadius(parseFloat(e.target.value))}
                                    className="w-full h-1 bg-[#222] rounded-full appearance-none accent-[#ff3366] cursor-pointer" />
                            </div>
                            <div className="space-y-1">
                                <div className="flex justify-between text-[9px] text-gray-400"><span>STRENGTH</span></div>
                                <input type="range" min="0.1" max="1.0" step="0.1" value={brushStrength}
                                    onChange={e => setBrushStrength(parseFloat(e.target.value))}
                                    className="w-full h-1 bg-[#222] rounded-full appearance-none accent-[#ff3366] cursor-pointer" />
                            </div>
                        </div>
                    )}
                </div>

                <div className="h-px bg-[#333] my-2" />

                <button onClick={() => setShowWireframe(!showWireframe)}
                    className={`w-full flex items-center justify-center gap-2 px-2 py-1 text-[9px] font-bold rounded transition-colors ${showWireframe ? 'bg-[#00ffcc]/20 text-[#00ffcc] border border-[#00ffcc]/50' : 'bg-[#222] text-gray-500 border border-[#333]'
                        }`}>
                    <Eye size={10} /> WIREFRAME
                </button>
            </div>

            {/* Legend */}
            <div className="absolute bottom-4 left-4 bg-[#0a0a0a]/80 backdrop-blur-sm border border-[#333] rounded-lg p-3">
                <div className="text-[8px] font-bold text-gray-500 uppercase mb-2">STRETCH GUIDE</div>
                <div className="flex items-center gap-2">
                    <div className="w-24 h-3 rounded-sm" style={{ background: 'linear-gradient(to right, #00ffcc, #ffff00, #ff4444)' }} />
                </div>
                <div className="flex justify-between text-[8px] text-gray-500 mt-1">
                    <span>PERFECT</span>
                    <span>STRETCHED</span>
                </div>
            </div>
            {/* Info */}
            <div className="absolute bottom-4 right-4 text-[9px] text-gray-600 font-mono">
                {brushMode ? 'DRAG TO SCULPT STRESS • ' : ''} DRAG TO ORBIT • SCROLL ZOOM
            </div>
        </div>
    );
}

function calculateStretchFactors(geo: THREE.BufferGeometry): number[] {
    const posAttr = geo.attributes.position;
    const uvAttr = geo.attributes.uv;
    const indexAttr = geo.index;
    if (!uvAttr) return [];

    const stretchSums = new Float32Array(posAttr.count);
    const stretchCounts = new Float32Array(posAttr.count);
    const pos3D = new THREE.Vector3(), pos3D2 = new THREE.Vector3();
    const faceCount = indexAttr ? indexAttr.count / 3 : posAttr.count / 3;

    for (let f = 0; f < faceCount; f++) {
        const i = f * 3;
        const a = indexAttr ? indexAttr.getX(i) : i;
        const b = indexAttr ? indexAttr.getX(i + 1) : i + 1;
        const c = indexAttr ? indexAttr.getX(i + 2) : i + 2;

        pos3D.set(posAttr.getX(a), posAttr.getY(a), posAttr.getZ(a));
        pos3D2.set(posAttr.getX(b), posAttr.getY(b), posAttr.getZ(b));
        const edge3D_ab = pos3D.distanceTo(pos3D2);
        pos3D.set(posAttr.getX(b), posAttr.getY(b), posAttr.getZ(b));
        pos3D2.set(posAttr.getX(c), posAttr.getY(c), posAttr.getZ(c));
        const edge3D_bc = pos3D.distanceTo(pos3D2);
        pos3D.set(posAttr.getX(c), posAttr.getY(c), posAttr.getZ(c));
        pos3D2.set(posAttr.getX(a), posAttr.getY(a), posAttr.getZ(a));
        const edge3D_ca = pos3D.distanceTo(pos3D2);

        const uv_a = { x: uvAttr.getX(a), y: uvAttr.getY(a) };
        const uv_b = { x: uvAttr.getX(b), y: uvAttr.getY(b) };
        const uv_c = { x: uvAttr.getX(c), y: uvAttr.getY(c) };
        const edgeUV_ab = Math.sqrt((uv_b.x - uv_a.x) ** 2 + (uv_b.y - uv_a.y) ** 2);
        const edgeUV_bc = Math.sqrt((uv_c.x - uv_b.x) ** 2 + (uv_c.y - uv_b.y) ** 2);
        const edgeUV_ca = Math.sqrt((uv_a.x - uv_c.x) ** 2 + (uv_a.y - uv_c.y) ** 2);

        const calcStretch = (uv: number, d3: number) => {
            if (d3 < 0.0001 || uv < 0.0001) return 0;
            const ratio = uv / d3;
            // Normalize around 1.0 (ideally log scale)
            return Math.abs(Math.log(ratio)) * 0.5;
        };

        const stretch_ab = calcStretch(edgeUV_ab, edge3D_ab);
        const stretch_bc = calcStretch(edgeUV_bc, edge3D_bc);
        const stretch_ca = calcStretch(edgeUV_ca, edge3D_ca);
        const avgStretch = (stretch_ab + stretch_bc + stretch_ca) / 3;

        stretchSums[a] += avgStretch; stretchSums[b] += avgStretch; stretchSums[c] += avgStretch;
        stretchCounts[a]++; stretchCounts[b]++; stretchCounts[c]++;
    }

    const result: number[] = [];
    for (let i = 0; i < posAttr.count; i++) {
        result.push(stretchCounts[i] > 0 ? stretchSums[i] / stretchCounts[i] : 0);
    }
    return result;
}
