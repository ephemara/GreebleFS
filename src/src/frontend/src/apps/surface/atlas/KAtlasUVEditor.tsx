import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { KAtlasUVBrush, UVBrushType } from './KAtlasUVBrush';
import { Brush, Hand, Zap, Maximize2 } from 'lucide-react';

interface KAtlasUVEditorProps {
    meshes: { [uuid: string]: THREE.Mesh };
    selectedIds: string[];
    syncSelection: number[]; // Selected face indices from 3D view
    onSelectionChange: (indices: number[]) => void;
    version?: number; // Force update trigger
}

export default function KAtlasUVEditor({ meshes, selectedIds, syncSelection, onSelectionChange, version }: KAtlasUVEditorProps) {
    const mountRef = useRef<HTMLDivElement>(null);
    const [zoom, setZoom] = useState(1.0);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [uvBounds, setUvBounds] = useState({ minU: -0.1, maxU: 1.1, minV: -0.1, maxV: 1.1 });

    // Brush State
    const [isBrushActive, setIsBrushActive] = useState(false);
    const [brushType, setBrushType] = useState<UVBrushType>('GRAB');
    const [brushRadius, setBrushRadius] = useState(0.1);
    const [brushIntensity, setBrushIntensity] = useState(0.5);

    const brushEngine = useRef(new KAtlasUVBrush());
    const isPointerDown = useRef(false);
    const isPanning = useRef(false);
    const lastPanPos = useRef({ x: 0, y: 0 });

    const engine = useRef<any>({
        scene: null, camera: null, renderer: null,
        grid: null,
        uvLines: null,
        selectionPoints: null,
        brushCursor: null
    });

    // Calculate UV bounds from all selected meshes
    const calculateUVBounds = () => {
        if (selectedIds.length === 0) {
            return { minU: -0.1, maxU: 1.1, minV: -0.1, maxV: 1.1 };
        }

        let minU = Infinity, maxU = -Infinity;
        let minV = Infinity, maxV = -Infinity;

        selectedIds.forEach(id => {
            const mesh = meshes[id];
            if (!mesh) return;

            const uv = mesh.geometry.attributes.uv;
            if (uv) {
                for (let i = 0; i < uv.count; i++) {
                    const u = uv.getX(i);
                    const v = uv.getY(i);
                    minU = Math.min(minU, u);
                    maxU = Math.max(maxU, u);
                    minV = Math.min(minV, v);
                    maxV = Math.max(maxV, v);
                }
            }
        });

        // Add 10% padding
        const paddingU = (maxU - minU) * 0.1;
        const paddingV = (maxV - minV) * 0.1;

        return {
            minU: minU - paddingU,
            maxU: maxU + paddingU,
            minV: minV - paddingV,
            maxV: maxV + paddingV
        };
    };

    // Frame all UVs in view
    const frameAll = () => {
        const bounds = calculateUVBounds();
        setUvBounds(bounds);
        setZoom(1.0);
        setPan({ x: 0, y: 0 });
    };

    // Init 2D Engine - ONCE on mount
    useEffect(() => {
        if (!mountRef.current) return;
        const w = mountRef.current.clientWidth;
        const h = mountRef.current.clientHeight;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(w, h);
        renderer.setClearColor(0x111111);
        mountRef.current.appendChild(renderer.domElement);

        const scene = new THREE.Scene();

        // Ortho Camera for 2D - initial setup
        const camera = new THREE.OrthographicCamera(
            -0.1, 1.1, 1.1, -0.1, 0.1, 100
        );
        camera.position.z = 10;

        // Grid - initial setup
        const gridHelper = new THREE.GridHelper(2, 20, 0x444444, 0x222222);
        gridHelper.rotation.x = Math.PI / 2;
        gridHelper.position.set(0.5, 0.5, 0);
        scene.add(gridHelper);

        // Axis
        const axes = new THREE.AxesHelper(0.1);
        scene.add(axes);

        // Brush Cursor
        const cursorGeo = new THREE.RingGeometry(0.02, 0.025, 32);
        const cursorMat = new THREE.MeshBasicMaterial({ color: 0x3daee9, transparent: true, opacity: 0.8, depthTest: false });
        const brushCursor = new THREE.Mesh(cursorGeo, cursorMat);
        brushCursor.visible = false;
        scene.add(brushCursor);

        engine.current = { scene, camera, renderer, grid: gridHelper, brushCursor };

        const animate = () => {
            requestAnimationFrame(animate);
            renderer.render(scene, camera);
        };
        animate();

        return () => {
            if (engine.current.uvLines) {
                engine.current.uvLines.geometry.dispose();
            }
            renderer.dispose();
            if (mountRef.current) mountRef.current.innerHTML = '';
        };
    }, []); // ONLY run once on mount

    // Update camera and grid when bounds/zoom/pan change
    useEffect(() => {
        if (!mountRef.current || !engine.current.camera || !engine.current.grid) return;

        const { camera, grid, scene } = engine.current;
        const nw = mountRef.current.clientWidth;
        const nh = mountRef.current.clientHeight;

        // Update grid size and position
        const gridSize = Math.max(
            Math.abs(uvBounds.maxU - uvBounds.minU),
            Math.abs(uvBounds.maxV - uvBounds.minV),
            2
        ) * 2;

        // Remove old grid and create new one with updated size
        scene.remove(grid);
        const newGrid = new THREE.GridHelper(gridSize, Math.ceil(gridSize * 10), 0x444444, 0x222222);
        newGrid.rotation.x = Math.PI / 2;
        newGrid.position.set(
            (uvBounds.minU + uvBounds.maxU) / 2,
            (uvBounds.minV + uvBounds.maxV) / 2,
            0
        );
        scene.add(newGrid);
        engine.current.grid = newGrid;

        // Calculate view size based on bounds, zoom, and pan
        const baseWidth = (uvBounds.maxU - uvBounds.minU) / zoom;
        const baseHeight = (uvBounds.maxV - uvBounds.minV) / zoom;
        const centerU = (uvBounds.minU + uvBounds.maxU) / 2;
        const centerV = (uvBounds.minV + uvBounds.maxV) / 2;

        // Maintain aspect ratio in ortho view
        const aspect = nw / nh;

        if (aspect > 1) {
            camera.left = centerU - (baseWidth * aspect) / 2 + pan.x;
            camera.right = centerU + (baseWidth * aspect) / 2 + pan.x;
            camera.top = centerV + baseHeight / 2 + pan.y;
            camera.bottom = centerV - baseHeight / 2 + pan.y;
        } else {
            camera.left = centerU - baseWidth / 2 + pan.x;
            camera.right = centerU + baseWidth / 2 + pan.x;
            camera.top = centerV + (baseHeight / aspect) / 2 + pan.y;
            camera.bottom = centerV - (baseHeight / aspect) / 2 + pan.y;
        }
        camera.updateProjectionMatrix();
    }, [zoom, pan, uvBounds]);

    // Handle window resize
    // Handle container resize (fix for layout changes)
    useEffect(() => {
        if (!mountRef.current) return;

        const handleResize = () => {
            if (mountRef.current && engine.current.camera && engine.current.renderer) {
                const nw = mountRef.current.clientWidth;
                const nh = mountRef.current.clientHeight;
                engine.current.renderer.setSize(nw, nh);

                // Trigger camera update by setting zoom to itself (forces recalc)
                setZoom(z => z); // This triggers the camera update effect
            }
        };

        const resizeObserver = new ResizeObserver(() => {
            handleResize();
        });

        resizeObserver.observe(mountRef.current);

        return () => {
            resizeObserver.disconnect();
        };
    }, []);

    // Track if we've auto-framed for current selection
    const hasAutoFramed = useRef<string>('');

    // Auto-frame ONLY on initial mesh load, not on every UV update
    useEffect(() => {
        if (selectedIds.length > 0) {
            const selectionKey = selectedIds.sort().join(',');

            // Only auto-frame if this is a NEW selection we haven't seen before
            if (hasAutoFramed.current !== selectionKey) {
                const bounds = calculateUVBounds();

                // Only update if bounds are significantly different from default
                const isNonStandard =
                    bounds.minU < -0.2 || bounds.maxU > 1.2 ||
                    bounds.minV < -0.2 || bounds.maxV > 1.2;

                if (isNonStandard) {
                    setUvBounds(bounds);
                    setZoom(1.0);
                    setPan({ x: 0, y: 0 });
                }

                hasAutoFramed.current = selectionKey;
            }
        }
    }, [selectedIds, meshes]); // Removed 'version' dependency to prevent constant updates

    // Update Brush Cursor Visuals
    useEffect(() => {
        if (engine.current.brushCursor) {
            engine.current.brushCursor.visible = isBrushActive;
            const s = brushRadius; // In ortho, scale is direct
            engine.current.brushCursor.scale.set(s / 0.025, s / 0.025, 1);
        }
    }, [isBrushActive, brushRadius]);

    // Interaction State
    const raycaster = useRef(new THREE.Raycaster());
    const mouse = useRef(new THREE.Vector2());

    const handlePointerDown = (e: React.PointerEvent) => {
        if (!mountRef.current || !engine.current.camera) return;

        const rect = mountRef.current.getBoundingClientRect();

        // Middle mouse button OR right-click = pan
        if (e.button === 1 || e.button === 2) {
            isPanning.current = true;
            lastPanPos.current = { x: e.clientX, y: e.clientY };
            e.preventDefault();
            return;
        }

        isPointerDown.current = true;

        if (isBrushActive) {
            // Brush Logic handled in Move
            handlePointerMove(e);
        } else {
            // Selection Logic
            mouse.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

            raycaster.current.setFromCamera(mouse.current, engine.current.camera);

            let closestFaceIndex = -1;
            let minDist = Infinity;

            selectedIds.forEach(id => {
                const mesh = meshes[id];
                if (!mesh) return;

                const uv = mesh.geometry.attributes.uv;
                const index = mesh.geometry.index;

                if (uv) {
                    const count = index ? index.count / 3 : uv.count / 3;

                    for (let i = 0; i < count; i++) {
                        let a, b, c;
                        if (index) {
                            a = index.getX(i * 3);
                            b = index.getX(i * 3 + 1);
                            c = index.getX(i * 3 + 2);
                        } else {
                            a = i * 3; b = i * 3 + 1; c = i * 3 + 2;
                        }

                        const u1 = uv.getX(a); const v1 = uv.getY(a);
                        const u2 = uv.getX(b); const v2 = uv.getY(b);
                        const u3 = uv.getX(c); const v3 = uv.getY(c);

                        // Centroid
                        const cx = (u1 + u2 + u3) / 3;
                        const cy = (v1 + v2 + v3) / 3;

                        // Distance to mouse ray origin (which is at z=10, looking down)
                        // In ortho, ray origin x/y matches mouse x/y mapped to world.

                        // Map mouse NDC to World
                        const wx = mouse.current.x * (engine.current.camera.right - engine.current.camera.left) / 2 + (engine.current.camera.right + engine.current.camera.left) / 2;
                        const wy = mouse.current.y * (engine.current.camera.top - engine.current.camera.bottom) / 2 + (engine.current.camera.top + engine.current.camera.bottom) / 2;

                        const dx = cx - wx;
                        const dy = cy - wy;
                        const dist = dx * dx + dy * dy;

                        if (dist < minDist && dist < 0.01) { // Threshold
                            minDist = dist;
                            closestFaceIndex = i; // This is local to the mesh, need global ID?
                            // For now assuming single mesh selection or handling first hit
                        }
                    }
                }
            });

            if (closestFaceIndex !== -1) {
                const newSel = syncSelection.includes(closestFaceIndex)
                    ? syncSelection.filter(i => i !== closestFaceIndex)
                    : [...syncSelection, closestFaceIndex];
                onSelectionChange(newSel);
            } else {
                // Deselect if click empty
                onSelectionChange([]);
            }
        }
    };

    const handlePointerUp = () => {
        isPointerDown.current = false;
        isPanning.current = false;

        // Reset brush engine state
        if (isBrushActive && mountRef.current) {
            brushEngine.current.applyBrush(
                meshes, selectedIds, engine.current.camera,
                mouse.current,
                { radius: brushRadius, intensity: brushIntensity, type: brushType },
                false,
                mountRef.current.getBoundingClientRect()
            );
        }

        // Trigger geometry update for lines
        updateUVLines();
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!mountRef.current || !engine.current.camera) return;

        const rect = mountRef.current.getBoundingClientRect();

        // Handle panning
        if (isPanning.current) {
            const deltaX = e.clientX - lastPanPos.current.x;
            const deltaY = e.clientY - lastPanPos.current.y;

            // Convert pixel delta to world space delta
            const worldWidth = (uvBounds.maxU - uvBounds.minU) / zoom;
            const worldHeight = (uvBounds.maxV - uvBounds.minV) / zoom;
            const panDeltaX = -(deltaX / rect.width) * worldWidth;
            const panDeltaY = (deltaY / rect.height) * worldHeight;

            setPan(prev => ({
                x: prev.x + panDeltaX,
                y: prev.y + panDeltaY
            }));

            lastPanPos.current = { x: e.clientX, y: e.clientY };
            return;
        }

        mouse.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        // Update Cursor Position
        if (engine.current.brushCursor) {
            const wx = mouse.current.x * (engine.current.camera.right - engine.current.camera.left) / 2 + (engine.current.camera.right + engine.current.camera.left) / 2;
            const wy = mouse.current.y * (engine.current.camera.top - engine.current.camera.bottom) / 2 + (engine.current.camera.top + engine.current.camera.bottom) / 2;
            engine.current.brushCursor.position.set(wx, wy, 0);
        }

        if (isBrushActive) {
            brushEngine.current.applyBrush(
                meshes, selectedIds, engine.current.camera,
                mouse.current,
                { radius: brushRadius, intensity: brushIntensity, type: brushType },
                isPointerDown.current,
                rect
            );

            if (isPointerDown.current) {
                updateUVLines();
            }
        }
    };

    // Helper to redraw lines
    const updateUVLines = () => {
        const { scene, uvLines } = engine.current;
        if (!scene) return;

        if (uvLines) {
            scene.remove(uvLines);
            uvLines.geometry.dispose();
        }

        if (selectedIds.length === 0) return;

        const combinedGeo = new THREE.BufferGeometry();
        const positions: number[] = [];

        selectedIds.forEach(id => {
            const mesh = meshes[id];
            if (!mesh) return;

            const uv = mesh.geometry.attributes.uv;
            const index = mesh.geometry.index;

            if (uv) {
                const count = index ? index.count / 3 : uv.count / 3;
                for (let i = 0; i < count; i++) {
                    let a, b, c;
                    if (index) {
                        a = index.getX(i * 3);
                        b = index.getX(i * 3 + 1);
                        c = index.getX(i * 3 + 2);
                    } else {
                        a = i * 3; b = i * 3 + 1; c = i * 3 + 2;
                    }

                    const u1 = uv.getX(a); const v1 = uv.getY(a);
                    const u2 = uv.getX(b); const v2 = uv.getY(b);
                    const u3 = uv.getX(c); const v3 = uv.getY(c);

                    positions.push(u1, v1, 0, u2, v2, 0);
                    positions.push(u2, v2, 0, u3, v3, 0);
                    positions.push(u3, v3, 0, u1, v1, 0);
                }
            }
        });

        combinedGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        const material = new THREE.LineBasicMaterial({ color: 0x00ffcc, opacity: 0.5, transparent: true });
        const lines = new THREE.LineSegments(combinedGeo, material);
        scene.add(lines);
        engine.current.uvLines = lines;
    };

    // Initial Draw
    useEffect(() => {
        updateUVLines();
    }, [selectedIds, meshes, version]);

    // Mouse wheel zoom
    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        setZoom(z => Math.max(0.1, Math.min(10, z * zoomFactor)));
    };

    return (
        <div className="w-full h-full relative bg-[#111] overflow-hidden">
            <div
                ref={mountRef}
                className={`absolute inset-0 ${isPanning.current ? 'cursor-grabbing' : isBrushActive ? 'cursor-none' : 'cursor-crosshair'}`}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onPointerMove={handlePointerMove}
                onPointerLeave={handlePointerUp}
                onWheel={handleWheel}
                onContextMenu={(e) => e.preventDefault()}
            />

            {/* View Controls */}
            <div className="absolute top-2 right-2 flex gap-1">
                <button
                    onClick={frameAll}
                    className="bg-[#222] text-white p-1.5 text-xs rounded hover:bg-teal-600 transition-colors"
                    title="Frame All UVs"
                >
                    <Maximize2 size={14} />
                </button>
                <button onClick={() => setZoom(z => z * 1.2)} className="bg-[#222] text-white px-2 py-1 text-xs rounded hover:bg-[#333]">+</button>
                <button onClick={() => setZoom(z => z * 0.8)} className="bg-[#222] text-white px-2 py-1 text-xs rounded hover:bg-[#333]">-</button>
            </div>

            {/* Brush Controls */}
            <div className="absolute bottom-2 left-2 right-2 flex justify-between items-end pointer-events-none">
                <div className="text-[9px] text-gray-500 font-mono pointer-events-auto flex flex-col gap-0.5">
                    <div>UV EDITOR {isBrushActive ? '(SCULPT MODE)' : '(FACE SELECT)'}</div>
                    <div className="text-[8px] text-gray-600">
                        Bounds: [{uvBounds.minU.toFixed(2)}, {uvBounds.minV.toFixed(2)}] → [{uvBounds.maxU.toFixed(2)}, {uvBounds.maxV.toFixed(2)}] | Zoom: {zoom.toFixed(1)}x
                    </div>
                </div>

                <div className="flex gap-2 pointer-events-auto bg-[#1a1a1a] p-1 rounded-md border border-[#333]">
                    <button
                        onClick={() => setIsBrushActive(!isBrushActive)}
                        className={`p-1.5 rounded ${isBrushActive ? 'bg-teal-600 text-white' : 'bg-[#222] text-gray-400'}`}
                        title="Toggle Sculpt Mode"
                    >
                        <Brush size={14} />
                    </button>

                    {isBrushActive && (
                        <>
                            <div className="w-[1px] bg-[#333] mx-1" />

                            <button
                                onClick={() => setBrushType('GRAB')}
                                className={`p-1.5 rounded ${brushType === 'GRAB' ? 'bg-teal-900 text-teal-200' : 'hover:bg-[#222] text-gray-400'}`}
                                title="Grab Brush"
                            >
                                <Hand size={14} />
                            </button>
                            <button
                                onClick={() => setBrushType('RELAX')}
                                className={`p-1.5 rounded ${brushType === 'RELAX' ? 'bg-teal-900 text-teal-200' : 'hover:bg-[#222] text-gray-400'}`}
                                title="Relax Brush"
                            >
                                <Zap size={14} />
                            </button>

                            <div className="w-[1px] bg-[#333] mx-1" />

                            <div className="flex flex-col justify-center w-20">
                                <span className="text-[8px] text-gray-500">RADIUS</span>
                                <input
                                    type="range" min="0.01" max="0.5" step="0.01"
                                    value={brushRadius} onChange={e => setBrushRadius(parseFloat(e.target.value))}
                                    className="h-1 bg-[#333] rounded-full accent-teal-500"
                                />
                            </div>
                            <div className="flex flex-col justify-center w-20">
                                <span className="text-[8px] text-gray-500">INTENSITY</span>
                                <input
                                    type="range" min="0.1" max="1.0" step="0.1"
                                    value={brushIntensity} onChange={e => setBrushIntensity(parseFloat(e.target.value))}
                                    className="h-1 bg-[#333] rounded-full accent-teal-500"
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
