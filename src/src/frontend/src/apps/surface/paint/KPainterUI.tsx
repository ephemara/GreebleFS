import React, { useState, useMemo, useCallback, useRef } from 'react';
import { Activity } from 'lucide-react';
import { usePainter } from './PainterContext';
import KPainterTopBar from './KPainterTopBar';
import KPainterLeftPanel from './KPainterLeftPanel';
import KPainterRightPanel from './KPainterRightPanel';
import KPainterQuickMenu from './KPainterQuickMenu';
import KPainterUVView from './KPainterUVView';
import { useKPainterKeybinds } from './useKPainterKeybinds';

export default function KPainterUI({ canvasRef, engineRef, zenShellMode = 'standalone' }: any) {
    const {
        brush, setBrush,
        layers, activeLayerId,
        handleLayerAdd, handleLayerDelete, handleLayerToggle, handleLayerSelect, handleLayerFill,
        activeMaterial, projectMaterials,
        setActiveMaterial, handleChangeMesh, handleExport,
        status,
        textureSets, activeSetId, handleSetSelect,
        alphas, handleGenerateAlpha, handleImportAlpha, isGeneratingAlpha, alphaPrompt, setAlphaPrompt,
        blackHole, setBlackHole,
        activeMods, setActiveMods,
        modParams, setModParams,
        handleClearMask,
        viewMode, viewChannel,
        paint, recordHistory
    } = usePainter();

    // UI States
    const [activeLeftTab, setActiveLeftTab] = useState('BRUSH');
    const [quickMenuVisible, setQuickMenuVisible] = useState(false);
    const [quickMenuPos, setQuickMenuPos] = useState({ x: 0, y: 0 });
    const isViewportHost = zenShellMode === 'viewport-host';
    const isToolOverlay = zenShellMode === 'tool-overlay';

    // Keybinds (Passing setQuickMenuVisible to useKPainterKeybinds)
    useKPainterKeybinds(engineRef, setQuickMenuVisible, setQuickMenuPos);

    // Memoized UV View props - MUST be at top level, not inside conditional JSX
    const uvViewMeshes = useMemo(() => {
        const engine = engineRef?.current;
        if (!engine?.textureSetData || !activeSetId) return [];
        const set = engine.textureSetData[activeSetId];
        return set?.meshes || [];
    }, [activeSetId, engineRef]);

    const activeCompositeLayer = useMemo(() => {
        const engine = engineRef?.current;
        if (!engine?.textureSetData || !activeSetId) return null;
        const set = engine.textureSetData[activeSetId];
        return set?.compositeLayer || null;
    }, [activeSetId, engineRef]);

    // Force UV view update trigger
    const [uvVersion, setUvVersion] = useState(0);

    // Update UV view when texture set changes
    React.useEffect(() => {
        setUvVersion(v => v + 1);
    }, [activeSetId, viewChannel]);

    // UV View Paint Handlers
    const lastUvRef = useRef<THREE.Vector2 | null>(null);

    const handlePaintDown = useCallback((uv: THREE.Vector2, e: React.PointerEvent) => {
        if (e.button !== 0 || e.altKey || e.ctrlKey) return;
        recordHistory();
        lastUvRef.current = uv.clone();
        paint(uv, e.pressure || 1.0, e);
    }, [recordHistory, paint]);

    const handlePaintMove = useCallback((uv: THREE.Vector2, e: React.PointerEvent) => {
        // Only paint if dragging (primary button)
        if (e.buttons !== 1) return;

        const pressure = e.pressure || 1.0;

        // Interpolation
        if (lastUvRef.current) {
            const dist = lastUvRef.current.distanceTo(uv);
            // KPainter generic size is roughly pixels based on 2048 map? 
            // Let's approximate spacing to 10% of brush size in UV space
            const uvBrushSize = (brush.size || 50) / 2048;
            const spacing = Math.max(0.0001, uvBrushSize * 0.1);

            const steps = Math.floor(dist / spacing);

            for (let i = 1; i <= steps; i++) {
                const t = i / steps;
                const lerpedUV = lastUvRef.current.clone().lerp(uv, t);
                paint(lerpedUV, pressure, e);
            }
        }

        lastUvRef.current = uv.clone();
        paint(uv, pressure, e);
    }, [paint, brush.size]);

    const handlePaintUp = useCallback((e: React.PointerEvent) => {
        lastUvRef.current = null;
    }, []);

    return (
        <div className={`flex w-full h-full overflow-hidden select-none ${isToolOverlay ? 'pointer-events-none bg-transparent' : 'bg-[#050505]'}`}>

            {/* LEFT PANEL (Brushes + Materials) */}
            {!isViewportHost && (
                <div className={isToolOverlay ? 'pointer-events-auto' : ''}>
                    <KPainterLeftPanel
                        activeTab={activeLeftTab}
                        setActiveTab={setActiveLeftTab}
                        brush={brush}
                        setBrush={setBrush}
                        projectMaterials={projectMaterials}
                        activeMaterial={activeMaterial}
                        setActiveMaterial={setActiveMaterial}
                        handleChangeMesh={handleChangeMesh}
                        handleExport={handleExport}
                        alphas={alphas}
                        handleGenerateAlpha={handleGenerateAlpha}
                        handleImportAlpha={handleImportAlpha}
                        isGeneratingAlpha={isGeneratingAlpha}
                        alphaPrompt={alphaPrompt}
                        setAlphaPrompt={setAlphaPrompt}
                    />
                </div>
            )}

            {/* CENTER COLUMN (Top Bar + Canvas) */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* TOP BAR - Now flexes between panels */}
                {!isViewportHost && (
                    <div className={isToolOverlay ? 'pointer-events-auto' : ''}>
                        <KPainterTopBar />
                    </div>
                )}

                {/* VIEWPORT */}
                <div className={`flex-1 relative cursor-crosshair overflow-hidden ${isToolOverlay ? 'pointer-events-none bg-transparent' : 'bg-[#050505]'}`}>
                    {/* 3D CANVAS - Hidden when in 2D mode */}
                    <canvas
                        ref={canvasRef}
                        className="block w-full h-full outline-none touch-none"
                    />

                    {/* 2D UV VIEW - Shown when in 2D mode */}
                    {!isViewportHost && !isToolOverlay && viewMode === '2D' && (
                        <div className="absolute inset-0 z-10 pointer-events-none">
                            <div className="w-full h-full pointer-events-auto">
                                <KPainterUVView
                                    meshes={uvViewMeshes}
                                    compositeLayer={activeCompositeLayer}
                                    viewChannel={viewChannel as any}
                                    version={uvVersion}
                                    cursorSize={brush.size / 2048}
                                    cursorColor="#3daee9"
                                    onPointerDown={handlePaintDown}
                                    onPointerMove={handlePaintMove}
                                    onPointerUp={handlePaintUp}
                                    transparentBackground={true}
                                />
                            </div>
                        </div>
                    )}

                    {/* STATUS OVERLAY (Bottom Left) */}
                    {!isViewportHost && (
                    <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur px-3 py-1 rounded text-[10px] text-gray-400 font-mono border border-gray-800 flex items-center gap-2 pointer-events-none z-30">
                        <Activity size={12} className={status.includes("READY") ? "text-green-500" : "text-orange-500 animate-pulse"} />
                        {status}
                    </div>
                    )}

                    {/* HOTKEY HINT */}
                    {!isViewportHost && (
                    <div className="absolute top-4 left-4 pointer-events-none opacity-50">
                        <div className="text-[9px] font-bold text-gray-500 flex flex-col gap-1">
                            <span>Q: QUICK MENU</span>
                            <span>{viewMode === '3D' ? 'ALT: ORBIT' : 'MMB: PAN | SCROLL: ZOOM'}</span>
                        </div>
                    </div>
                    )}

                    {/* QUICK MENU OVERLAY */}
                    {!isViewportHost && (
                    <div className={isToolOverlay ? 'pointer-events-auto' : ''}>
                        <KPainterQuickMenu
                            visible={quickMenuVisible}
                            position={quickMenuPos}
                            brush={brush}
                            setBrush={setBrush}
                            blackHole={blackHole}
                            setBlackHole={setBlackHole}
                            activeMods={activeMods}
                            setActiveMods={setActiveMods}
                            modParams={modParams}
                            setModParams={setModParams}
                            alphas={alphas}
                        />
                    </div>
                    )}
                </div>
            </div>

            {/* RIGHT PANEL (Layers + Texture Sets) */}
            {!isViewportHost && (
                <div className={isToolOverlay ? 'pointer-events-auto' : ''}>
                    <KPainterRightPanel
                        layers={layers}
                        activeLayerId={activeLayerId}
                        onAdd={handleLayerAdd}
                        onDelete={handleLayerDelete}
                        onToggle={handleLayerToggle}
                        onSelect={handleLayerSelect}
                        onFill={handleLayerFill}
                        textureSets={textureSets}
                        activeSetId={activeSetId}
                        handleSetSelect={handleSetSelect}
                        engineRef={engineRef}
                    />
                </div>
            )}

        </div>
    );
}
