/**
 * KSculptBevy - Full Bevy-Powered Sculpting Engine
 * 
 * React handles UI only (panels, menus, state)
 * Bevy handles all 3D rendering and sculpting via The Leash IPC
 * 
 * This replaces Three.js which hits performance limits at ~300k polys
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

import KSculptUI from './KSculptUI';
import KSculptRightPanel from './KSculptRightPanel';
import KSculptTopBar from './KSculptTopBar';
import KSculptBrushMenu from './KSculptBrushMenu';
import KSculptAlphaMenu from './KSculptAlphaMenu';
import KSculptSpaceMenu from './KSculptSpaceMenu';
import { useKSculptKeybinds } from './useKSculptKeybinds';
import { MATCAPS } from './KSculptMatCaps';

interface KSculptBevyProps {
    sharedState: any;
    onCommit?: (data: any) => void;
    onAlphaCommit?: (alpha: any) => void;
    performance?: any;
}

export default function KSculptBevy({ sharedState, onCommit, onAlphaCommit, performance }: KSculptBevyProps) {
    // --- UI STATE ---
    const [mode, setMode] = useState<'SCULPT' | 'TRANSFORM'>('SCULPT');
    const [activeTab, setActiveTab] = useState<'BRUSH' | 'GEO' | 'EDIT'>('BRUSH');
    const [activeTool, setActiveTool] = useState('CLAY');
    const [radius, setRadius] = useState(0.5);
    const [intensity, setIntensity] = useState(0.5);
    const [wireframe, setWireframe] = useState(false);
    const [symmetry, setSymmetry] = useState<'NONE' | 'X'>('X');
    const [status, setStatus] = useState("BEVY SCULPT ENGINE");
    const [activeColor, setActiveColor] = useState('#ffffff');
    const [brushMode, setBrushMode] = useState<'ADD' | 'SUB'>('ADD');

    // Dynamic Topology State
    const [dynamicTopology, setDynamicTopology] = useState(false);
    const [detailSize, setDetailSize] = useState(0.5);

    // Transform Gizmo State
    const [gizmoMode, setGizmoMode] = useState<'translate' | 'rotate' | 'scale'>('translate');
    const [transformSpace, setTransformSpace] = useState<'world' | 'local'>('world');
    const [snapEnabled, setSnapEnabled] = useState(false);

    // Menus
    const [isBrushMenuOpen, setIsBrushMenuOpen] = useState(false);
    const [isAlphaMenuOpen, setIsAlphaMenuOpen] = useState(false);
    const [isSpaceMenuOpen, setIsSpaceMenuOpen] = useState(false);
    const [isSpaceMenuLocked, setIsSpaceMenuLocked] = useState(false);
    const [isBrushMenuLocked, setIsBrushMenuLocked] = useState(false);
    const [spaceMenuPos, setSpaceMenuPos] = useState({ x: 0, y: 0 });
    const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });

    // Layer System (Bevy manages actual meshes, React tracks metadata)
    const [layers, setLayers] = useState<any[]>([]);
    const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
    const [selectedLayerIds, setSelectedLayerIds] = useState<Set<string>>(new Set());

    // Material / Alpha
    const [materialMode, setMaterialMode] = useState<'CLAY' | 'PBR'>('CLAY');
    const [activeMaterial, setActiveMaterial] = useState<any>(null);
    const [activeAlpha, setActiveAlpha] = useState<any>(null);
    const [currentMatCap, setCurrentMatCap] = useState(MATCAPS.ICE);
    const [showGrid, setShowGrid] = useState(true);
    const [isBevyDebugOpen, setIsBevyDebugOpen] = useState(true); // Egui panel open by default
    const [isEguiOnly, setIsEguiOnly] = useState(true); // Egui-only mode: React UI disabled

    // Computed values for UI
    const [polyCount, setPolyCount] = useState(0);
    const [subdivisionLevel, setSubdivisionLevel] = useState(0);
    const [extractionThickness, setExtractionThickness] = useState(0.01);

    // Transform State
    const [transformData, setTransformData] = useState({
        posX: 0, posY: 0, posZ: 0,
        rotX: 0, rotY: 0, rotZ: 0,
        scaleX: 1, scaleY: 1, scaleZ: 1
    });

    // Refs
    const viewportRef = useRef<HTMLDivElement>(null);
    const mousePosRef = useRef({ x: 0, y: 0 });
    const lastCursorSend = useRef(0);
    const isDraggingRef = useRef(false);
    const isRightDragging = useRef(false);
    const isSculptingRef = useRef(false);
    const lastRotRef = useRef({ x: 0, y: 0 });
    const orbitPointerIdRef = useRef<number | null>(null);
    const orbitLastClientRef = useRef({ x: 0, y: 0 });

    // Bevy Connection State
    const [isBevyConnected, setIsBevyConnected] = useState(false);

    // =========================================================================
    // BEVY VISIBILITY - Show Bevy when KSculpt mounts, hide when unmounts
    // =========================================================================
    useEffect(() => {
        // Show Bevy window when KSculpt becomes active
        invoke('set_bevy_visible', { visible: true }).catch(() => { });
        // Enable egui debug panel on mount (since we're egui-only now)
        invoke('leash_debug_ui', { enabled: true }).catch(() => { });

        return () => {
            // Ensure we never leave the overlay window in click-through mode
            getCurrentWindow().setIgnoreCursorEvents(false).catch(() => { });
            // Hide Bevy window when leaving KSculpt
            invoke('set_bevy_visible', { visible: false }).catch(() => { });
        };
    }, []);

    // =========================================================================
    // EGUI-ONLY MODE (Click-through overlay so Bevy can receive mouse input)
    // =========================================================================
    useEffect(() => {
        getCurrentWindow().setIgnoreCursorEvents(isEguiOnly).catch(() => { });

        // Tell Bevy to toggle window level (AlwaysOnTop when egui-only so it receives click-through input)
        invoke('leash_egui_only', { enabled: isEguiOnly }).catch(() => { });

        // When switching to egui-only, keep the Bevy debug UI on so you always have controls.
        if (isEguiOnly && !isBevyDebugOpen) {
            setIsBevyDebugOpen(true);
            invoke('leash_debug_ui', { enabled: true }).catch(() => { });
        }
    }, [isEguiOnly, isBevyDebugOpen]);

    // =========================================================================
    // VIEWPORT SYNC - Tell Bevy exactly where to render
    // =========================================================================
    useEffect(() => {
        let animFrame: number;
        let lastPos = { x: 0, y: 0, w: 0, h: 0 };

        const syncViewport = async () => {
            if (!viewportRef.current) {
                animFrame = requestAnimationFrame(syncViewport);
                return;
            }

            try {
                const win = getCurrentWindow();
                const windowPos = await win.outerPosition();
                const rect = viewportRef.current.getBoundingClientRect();

                // Calculate absolute screen position of the viewport div
                const x = Math.round(windowPos.x + rect.left);
                const y = Math.round(windowPos.y + rect.top);
                const width = Math.round(rect.width);
                const height = Math.round(rect.height);

                // Only sync if changed
                if (x !== lastPos.x || y !== lastPos.y || width !== lastPos.w || height !== lastPos.h) {
                    await invoke('sync_bevy_window', { x, y, width, height });
                    lastPos = { x, y, w: width, h: height };
                    setIsBevyConnected(true);
                }
            } catch (e) {
                setIsBevyConnected(false);
            }

            animFrame = requestAnimationFrame(syncViewport);
        };

        syncViewport();
        return () => { if (animFrame) cancelAnimationFrame(animFrame); };
    }, []);

    // =========================================================================
    // MOUSE HANDLERS - Forward to Bevy via Leash IPC
    // =========================================================================
    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (!viewportRef.current) return;

        const now = window.performance?.now?.() ?? Date.now();
        const prevClient = mousePosRef.current;
        mousePosRef.current = { x: e.clientX, y: e.clientY };

        // Throttle to ~120fps
        if (now - lastCursorSend.current < 8) return;
        lastCursorSend.current = now;

        const rect = viewportRef.current.getBoundingClientRect();

        // Calculate NDC (-1 to 1)
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        // Camera Rotation (Right Click Drag)
        if (isRightDragging.current && orbitPointerIdRef.current === e.pointerId) {
            const dx = e.clientX - orbitLastClientRef.current.x;
            const dy = e.clientY - orbitLastClientRef.current.y;
            orbitLastClientRef.current = { x: e.clientX, y: e.clientY };
            invoke('leash_cam_rotate', { dx, dy }).catch(() => { });
            return;
        }

        // Sculpting (Left Click Drag)
        if (isSculptingRef.current && mode === 'SCULPT') {
            const toolMap: Record<string, number> = {
                'CLAY': 0, 'SMOOTH': 1, 'FLATTEN': 2,
                'GRAB': 3, 'MOVE': 4, 'SNAKE': 5,
                'MASK': 6, 'PAINT': 7
            };
            const toolId = toolMap[activeTool] ?? 0;

            // Compute delta using previous client position
            const lastX = ((prevClient.x - rect.left) / rect.width) * 2 - 1;
            const lastY = -((prevClient.y - rect.top) / rect.height) * 2 + 1;
            const dx = x - lastX;
            const dy = y - lastY;

            invoke('leash_brush', {
                tool: toolId,
                radius,
                intensity: brushMode === 'SUB' ? -intensity : intensity,
                x, y, dx, dy
            }).catch(() => { });
        }

        // Always send cursor position for hover preview
        invoke('leash_cursor', { x, y }).catch(() => { });
    }, [mode, activeTool, radius, intensity, brushMode]);

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        // Prevent default behaviors (context menu / drag)
        if (e.button === 2) {
            e.preventDefault();
            isRightDragging.current = true;
            orbitPointerIdRef.current = e.pointerId;
            orbitLastClientRef.current = { x: e.clientX, y: e.clientY };
            try {
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            } catch {
                // ignore
            }
            return;
        }

        if (e.button === 0) {
            // Snapshot only once per stroke (avoid spamming undo stack)
            if (!isSculptingRef.current) {
                invoke('leash_snapshot').catch(() => { });
            }
            isSculptingRef.current = true;
            try {
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            } catch {
                // ignore
            }
        }
    }, []);

    const handlePointerUp = useCallback((e: React.PointerEvent) => {
        if (e.button === 0) {
            isSculptingRef.current = false;
        }

        // Right button up doesn't always arrive with button===2 depending on platform;
        // also handle via lostpointercapture.
        if (orbitPointerIdRef.current === e.pointerId) {
            isRightDragging.current = false;
            orbitPointerIdRef.current = null;
            try {
                (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
            } catch {
                // ignore
            }
        }
    }, []);

    const handleLostPointerCapture = useCallback((e: React.PointerEvent) => {
        if (orbitPointerIdRef.current === e.pointerId) {
            isRightDragging.current = false;
            orbitPointerIdRef.current = null;
        }
        isSculptingRef.current = false;
    }, []);

    const handleWheel = useCallback((e: React.WheelEvent) => {
        const delta = -e.deltaY * 0.1;
        invoke('leash_cam_zoom', { delta }).catch(() => { });
    }, []);

    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
    }, []);

    // =========================================================================
    // KEYBINDS
    // =========================================================================
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'F1' && !e.repeat) {
                e.preventDefault();
                setIsBevyDebugOpen(prev => {
                    const next = !prev;
                    invoke('leash_debug_ui', { enabled: next }).catch(() => { });
                    return next;
                });
            }

            // Toggle EGUI-only mode (F2)
            // Note: when click-through is enabled, clicking the viewport will focus Bevy.
            // To toggle back, you may need to refocus the Tauri window (Alt+Tab) then press F2.
            if (e.key === 'F2' && !e.repeat) {
                e.preventDefault();
                setIsEguiOnly(prev => !prev);
            }

            // Space Menu (Q)
            if (e.key.toLowerCase() === 'q' && !e.repeat) {
                setIsSpaceMenuOpen(prev => !prev);
                setSpaceMenuPos({ x: mousePosRef.current.x, y: mousePosRef.current.y });
            }

            // Undo (Ctrl+Z)
            if (e.ctrlKey && e.key.toLowerCase() === 'z' && !e.shiftKey) {
                e.preventDefault();
                invoke('leash_undo').catch(() => { });
            }

            // Redo (Ctrl+Shift+Z or Ctrl+Y)
            if ((e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'z') ||
                (e.ctrlKey && e.key.toLowerCase() === 'y')) {
                e.preventDefault();
                invoke('leash_redo').catch(() => { });
            }

            // Wireframe (W)
            if (e.key.toLowerCase() === 'w' && !e.ctrlKey) {
                setWireframe(prev => {
                    const newVal = !prev;
                    invoke('leash_wireframe', { enabled: newVal }).catch(() => { });
                    return newVal;
                });
            }

            // Symmetry (X)
            if (e.key.toLowerCase() === 'x' && !e.ctrlKey) {
                setSymmetry(prev => {
                    const newVal = prev === 'X' ? 'NONE' : 'X';
                    invoke('leash_symmetry', { axis: newVal === 'X' ? 1 : 0 }).catch(() => { });
                    return newVal;
                });
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // =========================================================================
    // ACTIONS (Called from UI)
    // =========================================================================
    const handleUndo = useCallback(() => {
        invoke('leash_undo').catch(() => { });
    }, []);

    const handleRedo = useCallback(() => {
        invoke('leash_redo').catch(() => { });
    }, []);

    const handleStepUp = useCallback(() => {
        // TODO: Send subdivide command to Bevy
        setSubdivisionLevel(prev => prev + 1);
        setStatus("SUBDIVIDING...");
    }, []);

    const handleRemesh = useCallback(() => {
        // TODO: Send remesh command to Bevy
        setStatus("REMESHING...");
    }, []);

    const loadPrimitive = useCallback((type: string) => {
        const primitiveMap: Record<string, number> = {
            'SPHERE': 0, 'CUBE': 1, 'CYLINDER': 2,
            'TORUS': 3, 'PLANE': 4, 'ICOSA': 5
        };
        const primitiveType = primitiveMap[type] ?? 0;
        invoke('leash_load_primitive', { primitive_type: primitiveType }).catch(() => { });
        setStatus(`LOADING ${type}...`);
    }, []);

    const loadFromStorage = useCallback((item: any) => {
        // KernelArtifact -> write to assets/ then ask Bevy to load it.
        // Prefer welded blob if present.
        (async () => {
            try {
                const blob: Blob | undefined = (item?.isWelded && item?.weldedBlob) ? item.weldedBlob : item?.blob;
                if (!blob) {
                    setStatus("KERNEL ITEM HAS NO BLOB");
                    return;
                }

                setStatus(`IMPORTING ${item?.name ?? 'KERNEL'}...`);
                const buffer = await blob.arrayBuffer();
                const uint8 = new Uint8Array(buffer);
                const path = await invoke<string>('save_temp_glb', { data: Array.from(uint8) });
                await invoke('leash_load_model', { path });
                setStatus("SYNCED TO BEVY ENGINE");
            } catch (e) {
                setStatus("KERNEL IMPORT FAILED");
            }
        })();
    }, []);

    const handleClearMask = useCallback(() => {
        // TODO: Send clear mask to Bevy
    }, []);

    const handleInvertMask = useCallback(() => {
        // TODO: Send invert mask to Bevy
    }, []);

    const handleExtractMask = useCallback(() => {
        // TODO: Send extract mask to Bevy
    }, []);

    const updateTransformFromUI = useCallback((key: string, value: number) => {
        setTransformData(prev => ({ ...prev, [key]: value }));
        // TODO: Send transform update to Bevy
    }, []);

    const toggleVisibility = useCallback((id: string) => {
        setLayers(prev => prev.map(l => l.id === id ? { ...l, visible: !l.visible } : l));
    }, []);

    const deleteLayer = useCallback((id: string) => {
        setLayers(prev => prev.filter(l => l.id !== id));
        // TODO: Send delete to Bevy
    }, []);

    const mergeDown = useCallback((id: string) => {
        // TODO: Implement merge
    }, []);

    const mergeSelected = useCallback(() => {
        // TODO: Implement merge selected
    }, []);

    const mergeAll = useCallback(() => {
        // TODO: Implement merge all
    }, []);

    const applyMaterial = useCallback((mat: any) => {
        setActiveMaterial(mat);
        // TODO: Send material to Bevy
    }, []);

    const handleSaveAlphaToStorage = useCallback((alpha: any) => {
        if (onAlphaCommit) onAlphaCommit(alpha);
    }, [onAlphaCommit]);

    return (
        <div className={`flex w-full h-full ${isEguiOnly ? 'bg-transparent' : 'bg-[#0a0a0a]'}`}>
            {/* LEFT PANEL (opaque wrapper for Bevy transparency) */}
            {!isEguiOnly && (
                <div className="bg-[#0a0a0a] shrink-0">
                    <KSculptUI
                        mode={mode}
                        setMode={setMode}
                        activeTab={activeTab}
                        setActiveTab={setActiveTab}
                        activeTool={activeTool}
                        setActiveTool={setActiveTool}
                        activeColor={activeColor}
                        setActiveColor={setActiveColor}
                        subdivisionLevel={subdivisionLevel}
                        polyCount={polyCount}
                        handleStepUp={handleStepUp}
                        undo={handleUndo}
                        wireframe={wireframe}
                        setWireframe={setWireframe}
                        transformData={transformData}
                        updateTransformFromUI={updateTransformFromUI}
                        loadPrimitive={loadPrimitive}
                        sharedState={sharedState}
                        loadFromStorage={loadFromStorage}
                        layers={layers}
                        activeLayerId={activeLayerId}
                        setActiveLayerId={setActiveLayerId}
                        toggleVisibility={toggleVisibility}
                        deleteLayer={deleteLayer}
                        mergeDown={mergeDown}
                        mergeSelected={mergeSelected}
                        mergeAll={mergeAll}
                        selectedLayerIds={selectedLayerIds}
                        materialMode={materialMode}
                        setMaterialMode={setMaterialMode}
                        activeMaterial={activeMaterial}
                        applyMaterial={applyMaterial}
                        projectMaterials={sharedState?.materials || []}
                        gizmoMode={gizmoMode}
                        setGizmoMode={setGizmoMode}
                        transformSpace={transformSpace}
                        setTransformSpace={setTransformSpace}
                        snapEnabled={snapEnabled}
                        setSnapEnabled={setSnapEnabled}
                        onClearMask={handleClearMask}
                        onInvertMask={handleInvertMask}
                        onExtractMask={handleExtractMask}
                        toggleBrushMenu={() => setIsBrushMenuOpen(prev => !prev)}
                        onRemesh={handleRemesh}
                        activeAlpha={activeAlpha}
                        setActiveAlpha={setActiveAlpha}
                        onSaveAlphaToStorage={handleSaveAlphaToStorage}
                    />
                </div>
            )}

            {/* CENTER - BEVY VIEWPORT (Transparent, Bevy renders behind) */}
            <div className="flex-1 flex flex-col relative">
                {/* TOP BAR (opaque wrapper) */}
                {!isEguiOnly && (
                    <div className="bg-[#0a0a0a] shrink-0">
                        <KSculptTopBar
                            radius={radius}
                            setRadius={setRadius}
                            intensity={intensity}
                            setIntensity={setIntensity}
                            wireframe={wireframe}
                            setWireframe={setWireframe}
                            symmetry={symmetry}
                            setSymmetry={setSymmetry}
                            currentMatCap={currentMatCap}
                            setCurrentMatCap={setCurrentMatCap}
                        />
                    </div>
                )}

                {/* VIEWPORT - This is where Bevy renders */}
                <div
                    ref={viewportRef}
                    className="flex-1 relative cursor-crosshair"
                    style={{ backgroundColor: 'transparent', touchAction: 'none' }}
                    onPointerMove={handlePointerMove}
                    onPointerDown={handlePointerDown}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handleLostPointerCapture}
                    onLostPointerCapture={handleLostPointerCapture}
                    onPointerLeave={() => {
                        isSculptingRef.current = false;
                        isRightDragging.current = false;
                        orbitPointerIdRef.current = null;
                    }}
                    onWheel={handleWheel}
                    onContextMenu={handleContextMenu}
                >
                    {/* Connection Status */}
                    {!isEguiOnly && (
                        <div className={`absolute top-20 right-4 px-3 py-1.5 rounded-full text-[9px] font-bold flex items-center gap-2 ${isBevyConnected
                                ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                                : 'bg-red-500/10 text-red-400 border border-red-500/30'
                            }`}>
                            <div className={`w-2 h-2 rounded-full ${isBevyConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                            {isBevyConnected ? 'BEVY ACTIVE' : 'BEVY OFFLINE'}
                        </div>
                    )}

                    {/* Status Bar */}
                    {!isEguiOnly && (
                        <div className="absolute bottom-4 left-4 px-4 py-2 bg-black/50 backdrop-blur-sm rounded-lg border border-[#333] text-[10px] font-mono text-gray-400">
                            {status} | {activeTool} | R:{radius.toFixed(2)} I:{intensity.toFixed(2)}
                        </div>
                    )}

                    {/* Poly Count */}
                    {!isEguiOnly && (
                        <div className="absolute bottom-4 right-4 px-4 py-2 bg-black/50 backdrop-blur-sm rounded-lg border border-[#333] text-[10px] font-mono text-orange-400">
                            {polyCount.toLocaleString()} POLYS
                        </div>
                    )}
                </div>
            </div>

            {/* RIGHT PANEL (opaque wrapper for Bevy transparency) */}
            {!isEguiOnly && (
                <div className="bg-[#0a0a0a] shrink-0">
                    <KSculptRightPanel
                        layers={layers}
                        activeLayerId={activeLayerId}
                        setActiveLayerId={setActiveLayerId}
                        toggleVisibility={toggleVisibility}
                        deleteLayer={deleteLayer}
                        mergeDown={mergeDown}
                        mergeSelected={mergeSelected}
                        mergeAll={mergeAll}
                        selectedLayerIds={selectedLayerIds}
                        materialMode={materialMode}
                        setMaterialMode={setMaterialMode}
                        activeMaterial={activeMaterial}
                        applyMaterial={applyMaterial}
                        projectMaterials={sharedState?.materials || []}
                        loadPrimitive={loadPrimitive}
                        loadFromStorage={loadFromStorage}
                        sharedState={sharedState}
                    />
                </div>
            )}

            {/* FLOATING MENUS */}
            {!isEguiOnly && isSpaceMenuOpen && (
                <KSculptSpaceMenu
                    position={spaceMenuPos}
                    activeTool={activeTool}
                    setActiveTool={(tool: string) => {
                        setActiveTool(tool);
                        if (!isSpaceMenuLocked) setIsSpaceMenuOpen(false);
                    }}
                    onClose={() => setIsSpaceMenuOpen(false)}
                    isLocked={isSpaceMenuLocked}
                    setIsLocked={setIsSpaceMenuLocked}
                />
            )}

            {!isEguiOnly && isBrushMenuOpen && (
                <KSculptBrushMenu
                    position={menuPos}
                    activeTool={activeTool}
                    setActiveTool={setActiveTool}
                    onClose={() => setIsBrushMenuOpen(false)}
                    isLocked={isBrushMenuLocked}
                    setIsLocked={setIsBrushMenuLocked}
                />
            )}

            {!isEguiOnly && isAlphaMenuOpen && (
                <KSculptAlphaMenu
                    position={menuPos}
                    activeAlpha={activeAlpha}
                    setActiveAlpha={setActiveAlpha}
                    alphas={sharedState?.alphas || []}
                    onClose={() => setIsAlphaMenuOpen(false)}
                />
            )}
        </div>
    );
}
