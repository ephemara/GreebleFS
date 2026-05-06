import { useState, useEffect } from 'react';
import { Plus, MousePointer2, Film, Layers, Grid, Anchor, Dna, ArrowLeft, ClipboardCopy, Trash2, Activity, Cloud, MonitorPlay, Expand, Command, Maximize, ArrowUpToLine } from 'lucide-react';
import { GreebleAppShell } from './ui/GreebleAppShell';
import { GreebleLeftPanel } from './ui/GreebleLeftPanel';
import { GreebleRightPanel } from './ui/GreebleRightPanel';
import { AppTopBar, AppTopBarGroup, AppTopBarSeparator, AppTopBarButton, AppTopBarToggleGroup, AppTopBarToggleItem, AppTopBarSlider } from './ui/AppTopBar';
import { SketchfabBrowser } from './ui/SketchfabBrowser';
import { KGreebleTimeline } from './KGreebleAnimation';
import { useGreebleStore } from '../../store/useGreebleStore';
import './greeble-scrollbar.css';

export default function KGreebleUI({
    mountRef, handleMouseDown, handleMouseMove, handleMouseUp,
    handleUndo, handleClear,
    handleExport,
    handleSketchfabImport, handleTextureUploadClick, handleTextureUpload, textureInputRef,
    handleTimelineScrub, handleSliderChange, handleSliderUp, handleAddKeyframe, handleDeleteKeyframe,
    togglePlay, stopPlay, toggleFullscreen, animTime, animDuration, setAnimDuration, isPlaying, 
    keyframes, targetFPS, setTargetFPS, updateTransformFromUI, commitMaterial,
    handleSetEnvMap, loadFromStorage, userImports, selectLayerObject, children, sharedState,
    // Layer functions from KGreeble (not store)
    layers: layersProp, activeLayerId: activeLayerIdProp, setActiveLayerId: setActiveLayerIdProp,
    addLayer: addLayerProp, updateLayer: updateLayerProp, deleteLayer: deleteLayerProp,
    duplicateLayer: duplicateLayerProp, mergeLayer: mergeLayerProp, mergeSelectedLayers: mergeSelectedLayersProp,
    toggleLayerVisibility: toggleLayerVisibilityProp, setLayerSolo: setLayerSoloProp,
    onExit, exitLabel, showExit, layoutAutoSaveId
}: any) {
    const [sketchfabOpen, setSketchfabOpen] = useState(false);
    const [quickMenuOpen, setQuickMenuOpen] = useState(false);

    const { 
        mode, setMode, gizmoMode, setGizmoMode, transformSpace, setTransformSpace, 
        snapEnabled, setSnapEnabled, selectedObjectUUID, transformData, buildTab, setBuildTab,
        activeShape, setActiveShape,
        // Get selectedLayerIds from store (it's reactive state)
        selectedLayerIds, setSelectedLayerIds,
        // Use props for layer data, not store
        symmetry, setSymmetry, radialCount, setRadialCount, gridLock, setGridLock, gridSize, setGridSize,
        surfaceMode, setSurfaceMode, voidAnchor, setVoidAnchor, chaosMode, setChaosMode,
        fractalEcho, setFractalEcho, neonMode, setNeonMode, graphicsQuality, setGraphicsQuality,
        sunIntensity, setSunIntensity, sunAngle, setSunAngle, matParams, setMatParams, materialLibrary,
        targetEngine, setTargetEngine, mergeOnExport, setMergeOnExport, includeBase, setIncludeBase,
        greebleParams, setGreebleParams, primitiveParams, setPrimitiveParams, titanParams, setTitanParams,
        setIsSnapshotting
    } = useGreebleStore();

    const handleHDSnapshot = () => {
        setIsSnapshotting(true);
        const prevQuality = graphicsQuality;
        if (graphicsQuality !== 'extreme') setGraphicsQuality('extreme');
        setTimeout(() => {
            const canvas = document.getElementById('greeble-canvas-r3f') as HTMLCanvasElement;
            if (canvas) {
                const url = canvas.toDataURL('image/png', 1.0);
                const link = document.createElement('a');
                link.download = `greeble_snap_${Date.now()}.png`;
                link.href = url;
                link.click();
            }
            setIsSnapshotting(false);
            if (prevQuality !== 'extreme') setGraphicsQuality(prevQuality);
        }, 200);
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            if (e.code === 'Space') {
                e.preventDefault();
                setQuickMenuOpen(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <>
            <SketchfabBrowser 
                isOpen={sketchfabOpen} 
                onClose={() => setSketchfabOpen(false)} 
                onImport={(url, name) => handleSketchfabImport(url, name)}
            />

            <GreebleAppShell
                autoSaveId={layoutAutoSaveId}
                topBar={
                    <AppTopBar>
                        <AppTopBarGroup>
                            <div className="flex items-center gap-2 mr-4">
                                <span className="font-black text-lg tracking-tighter text-white">K-GREEBLE</span>
                                <span className="text-[9px] text-emerald-500/80 font-bold tracking-wider border border-emerald-900/50 px-1 rounded">ALPHA 0.5</span>
                            </div>
                            {showExit && onExit && (
                                <AppTopBarButton icon={<ArrowLeft size={14} />} onClick={onExit} tooltip={exitLabel || 'Exit'} />
                            )}
                        </AppTopBarGroup>
                        <AppTopBarSeparator />
                        <AppTopBarGroup>
                            <AppTopBarButton icon={<ClipboardCopy size={14} />} label="UNDO" onClick={handleUndo} shortcut="Ctrl+Z" tooltip="Undo last action" />
                            <AppTopBarButton icon={<Trash2 size={14} />} label="CLEAR" onClick={handleClear} className="text-red-400 hover:text-red-300 hover:bg-red-900/20" tooltip="Reset Scene" />
                        </AppTopBarGroup>
                        <AppTopBarSeparator />
                        <AppTopBarGroup>
                            <div className="flex items-center gap-2">
                                <AppTopBarToggleGroup type="single" value={symmetry} onValueChange={(v) => v && setSymmetry(v)}>
                                    <AppTopBarToggleItem value="none" label="NONE" tooltip="No Symmetry" />
                                    <AppTopBarToggleItem value="x" label="X-SYM" tooltip="X-Axis Symmetry" />
                                    <AppTopBarToggleItem value="z" label="Z-SYM" tooltip="Z-Axis Symmetry" />
                                    <AppTopBarToggleItem value="radial" label="RADIAL" tooltip="Radial Symmetry" />
                                </AppTopBarToggleGroup>
                                {symmetry === 'radial' && (
                                    <AppTopBarSlider value={radialCount} min={3} max={24} step={1} onChange={setRadialCount} label="COUNT" width="w-20" />
                                )}
                            </div>
                        </AppTopBarGroup>
                        <AppTopBarSeparator />
                        <AppTopBarGroup>
                            <AppTopBarToggleGroup type="multiple">
                                <AppTopBarToggleItem value="grid" data-state={gridLock ? 'on' : 'off'} onClick={() => setGridLock(!gridLock)} icon={<Grid size={14} />} tooltip="Grid Snap/Lock" />
                                <AppTopBarToggleItem value="surface" data-state={surfaceMode ? 'on' : 'off'} onClick={() => setSurfaceMode(!surfaceMode)} icon={<Layers size={14} />} tooltip="Surface Placement Mode" />
                                <AppTopBarToggleItem value="void" data-state={voidAnchor ? 'on' : 'off'} onClick={() => setVoidAnchor(!voidAnchor)} icon={<Anchor size={14} />} tooltip="Void Anchor (Force Up)" />
                            </AppTopBarToggleGroup>
                            {gridLock && <AppTopBarSlider value={gridSize} min={0.1} max={5.0} step={0.1} onChange={setGridSize} label="GRID" width="w-20" />}
                        </AppTopBarGroup>
                        <AppTopBarSeparator />
                        <AppTopBarGroup>
                            <AppTopBarToggleGroup type="multiple">
                                <AppTopBarToggleItem value="chaos" data-state={chaosMode ? 'on' : 'off'} onClick={() => setChaosMode(!chaosMode)} icon={<Activity size={14} />} tooltip="Entropy (Random Transform)" />
                                <AppTopBarToggleItem value="fractal" data-state={fractalEcho ? 'on' : 'off'} onClick={() => setFractalEcho(!fractalEcho)} icon={<Dna size={14} />} tooltip="Fractal Echo (Recursive)" />
                            </AppTopBarToggleGroup>
                        </AppTopBarGroup>
                        <AppTopBarSeparator />
                        {/* BRUSH SCALE RANGE */}
                        <AppTopBarGroup>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <Maximize size={12} className="text-emerald-400" />
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">BRUSH</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[8px] text-gray-500 uppercase">MIN</span>
                                    <input 
                                        type="range" 
                                        min="0.001" 
                                        max="1" 
                                        step="0.001" 
                                        value={primitiveParams?.immBrushScaleMin || 0.01} 
                                        onChange={e => setPrimitiveParams({ ...primitiveParams, immBrushScaleMin: parseFloat(e.target.value) })} 
                                        className="w-16 h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                    />
                                    <span className="text-[8px] text-emerald-400 font-mono w-8">{(primitiveParams?.immBrushScaleMin || 0.01).toFixed(2)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[8px] text-gray-500 uppercase">MAX</span>
                                    <input 
                                        type="range" 
                                        min="1" 
                                        max="100" 
                                        step="0.1" 
                                        value={primitiveParams?.immBrushScaleMax || 3} 
                                        onChange={e => setPrimitiveParams({ ...primitiveParams, immBrushScaleMax: parseFloat(e.target.value) })} 
                                        className="w-16 h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                    />
                                    <span className="text-[8px] text-emerald-400 font-mono w-10">{(primitiveParams?.immBrushScaleMax || 3).toFixed(1)}</span>
                                </div>
                            </div>
                        </AppTopBarGroup>
                        <AppTopBarSeparator />
                        {/* PROCEDURAL OVERRIDE */}
                        <AppTopBarGroup>
                            <AppTopBarToggleGroup type="multiple">
                                <AppTopBarToggleItem 
                                    value="procedural" 
                                    data-state={primitiveParams?.infiniteShapes ? 'on' : 'off'} 
                                    onClick={() => setPrimitiveParams({ ...primitiveParams, infiniteShapes: !primitiveParams?.infiniteShapes })} 
                                    icon={<ArrowUpToLine size={14} />} 
                                    label="PROC"
                                    tooltip="Procedural Override - Generate infinite geometry variations" 
                                />
                            </AppTopBarToggleGroup>
                            {primitiveParams?.infiniteShapes && (
                                <>
                                    <AppTopBarSlider 
                                        value={primitiveParams?.shapeSegments || 32} 
                                        min={3} 
                                        max={100} 
                                        step={1} 
                                        onChange={(v) => setPrimitiveParams({ ...primitiveParams, shapeSegments: v })} 
                                        label="SEG" 
                                        width="w-20" 
                                    />
                                    <AppTopBarSlider 
                                        value={primitiveParams?.distortion || 0} 
                                        min={0} 
                                        max={1.0} 
                                        step={0.05} 
                                        onChange={(v) => setPrimitiveParams({ ...primitiveParams, distortion: v })} 
                                        label="DIST" 
                                        width="w-20" 
                                    />
                                </>
                            )}
                        </AppTopBarGroup>
                        <AppTopBarSeparator />
                        <AppTopBarGroup align="end">
                            <AppTopBarButton icon={<Command size={14} />} label="CMD" active={quickMenuOpen} onClick={() => setQuickMenuOpen(!quickMenuOpen)} tooltip="Toggle Quick Command Menu (SPACE)" className={quickMenuOpen ? "text-orange-400 bg-orange-900/20 border-orange-900/50" : ""} />
                            <AppTopBarSeparator />
                            <AppTopBarButton icon={<Cloud size={14} />} label="SKETCHFAB" onClick={() => setSketchfabOpen(true)} className="text-orange-500 hover:text-orange-400 bg-orange-900/10 hover:bg-orange-900/30 border-orange-900/50" tooltip="Browse Sketchfab Library" />
                            <AppTopBarSeparator />
                            <AppTopBarButton icon={<MonitorPlay size={14} />} active={neonMode} onClick={() => setNeonMode(!neonMode)} tooltip="Neon Protocol" />
                            <AppTopBarButton icon={<Expand size={14} />} onClick={toggleFullscreen} tooltip="Fullscreen" />
                        </AppTopBarGroup>
                    </AppTopBar>
                }
                leftPanel={
                    <GreebleLeftPanel
                        mode={mode}
                        setMode={setMode}
                        buildTab={buildTab}
                        setBuildTab={setBuildTab}
                        activeShape={activeShape}
                        setActiveShape={setActiveShape}
                        gizmoMode={gizmoMode}
                        setGizmoMode={setGizmoMode}
                        transformSpace={transformSpace}
                        setTransformSpace={setTransformSpace}
                        snapEnabled={snapEnabled}
                        setSnapEnabled={setSnapEnabled}
                        selectedObjectUUID={selectedObjectUUID}
                        transformData={transformData}
                        updateTransformFromUI={updateTransformFromUI}
                        greebleParams={greebleParams}
                        setGreebleParams={setGreebleParams}
                        primitiveParams={primitiveParams}
                        setPrimitiveParams={setPrimitiveParams}
                        titanParams={titanParams}
                        setTitanParams={setTitanParams}
                        userImports={userImports}
                        loadFromStorage={loadFromStorage}
                        sharedState={sharedState}
                    />
                }
                rightPanel={
                    <GreebleRightPanel
                        layers={layersProp}
                        activeLayerId={activeLayerIdProp}
                        setActiveLayerId={setActiveLayerIdProp}
                        selectedLayerIds={selectedLayerIds}
                        setSelectedLayerIds={setSelectedLayerIds}
                        addLayer={addLayerProp}
                        updateLayer={updateLayerProp}
                        deleteLayer={deleteLayerProp}
                        duplicateLayer={duplicateLayerProp}
                        mergeLayer={mergeLayerProp}
                        mergeSelectedLayers={mergeSelectedLayersProp}
                        toggleLayerVisibility={toggleLayerVisibilityProp}
                        setLayerSolo={setLayerSoloProp}
                        selectLayerObject={selectLayerObject}
                        materialLibrary={materialLibrary}
                        commitMaterial={commitMaterial}
                        handleTextureUploadClick={handleTextureUploadClick}
                        handleTextureUpload={handleTextureUpload}
                        textureInputRef={textureInputRef}
                        matParams={matParams}
                        setMatParams={setMatParams}
                        graphicsQuality={graphicsQuality}
                        setGraphicsQuality={setGraphicsQuality}
                        sunIntensity={sunIntensity}
                        setSunIntensity={setSunIntensity}
                        sunAngle={sunAngle}
                        setSunAngle={setSunAngle}
                        handleSetEnvMap={handleSetEnvMap}
                        targetEngine={targetEngine}
                        setTargetEngine={setTargetEngine}
                        mergeOnExport={mergeOnExport}
                        setMergeOnExport={setMergeOnExport}
                        includeBase={includeBase}
                        setIncludeBase={setIncludeBase}
                        handleExport={handleExport}
                        handleHDSnapshot={handleHDSnapshot}
                    />
                }
                viewport={
                    <>
                        <div 
                            ref={mountRef}
                            className="absolute inset-0 w-full h-full"
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                        >
                            {children}
                        </div>

                        {/* Status Overlays */}
                        <div className="absolute top-4 left-6 pointer-events-none flex flex-col gap-2 z-30">
                            <div className={`flex items-center gap-2 text-[10px] font-bold bg-black/80 px-4 py-2 rounded border backdrop-blur ${
                                mode === 'build' ? 'text-emerald-500 border-emerald-900/50' : 
                                mode === 'edit' ? 'text-blue-400 border-blue-900/50' : 
                                'text-pink-400 border-pink-900/50'
                            }`}>
                                {mode === 'build' ? <Plus size={12} /> : mode === 'edit' ? <MousePointer2 size={12} /> : <Film size={12} />}
                                PROTOCOL: {mode.toUpperCase()}
                            </div>
                            {mode === 'build' && (
                                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 bg-black/60 px-3 py-1.5 rounded border border-white/10 backdrop-blur">
                                    INSERT: {activeShape.startsWith('import') ? activeShape.split('_')[1] : activeShape.toUpperCase()}
                                </div>
                            )}
                            <div className="flex items-center gap-2 text-[10px] font-bold text-purple-400 bg-black/60 px-3 py-1.5 rounded border border-purple-900/50 backdrop-blur">
                                <Layers size={12} /> STRATUM: {layersProp.find((l: any) => l.id === activeLayerIdProp)?.name.toUpperCase()}
                            </div>
                            {surfaceMode && (
                                <div className="flex items-center gap-2 text-[10px] font-bold text-blue-400 bg-black/60 px-3 py-1.5 rounded border border-blue-900/50 backdrop-blur">
                                    <Grid size={12} /> SURFACE MODE: ACTIVE
                                </div>
                            )}
                            {gridLock && (
                                <div className="flex items-center gap-2 text-[10px] font-bold text-blue-400 bg-black/60 px-3 py-1.5 rounded border border-blue-900/50 backdrop-blur">
                                    <Grid size={12} /> GRID LOCK: {gridSize}
                                </div>
                            )}
                            {voidAnchor && (
                                <div className="flex items-center gap-2 text-[10px] font-bold text-purple-400 bg-black/60 px-3 py-1.5 rounded border border-purple-900/50 backdrop-blur">
                                    <Anchor size={12} /> VOID ANCHOR: ON
                                </div>
                            )}
                            {fractalEcho && (
                                <div className="flex items-center gap-2 text-[10px] font-bold text-pink-400 bg-black/60 px-3 py-1.5 rounded border border-pink-900/50 backdrop-blur">
                                    <Dna size={12} /> FRACTAL ECHO
                                </div>
                            )}
                        </div>
                    </>
                }
                bottomOverlay={
                    mode === 'animate' ? (
                        <KGreebleTimeline
                            animTime={animTime}
                            animDuration={animDuration}
                            setAnimDuration={setAnimDuration}
                            isPlaying={isPlaying}
                            togglePlay={togglePlay}
                            stopPlay={stopPlay}
                            handleTimelineScrub={handleTimelineScrub}
                            handleSliderChange={handleSliderChange}
                            handleSliderUp={handleSliderUp}
                            keyframes={keyframes}
                            selectedObjectUUID={selectedObjectUUID}
                            handleAddKeyframe={handleAddKeyframe}
                            handleDeleteKeyframe={handleDeleteKeyframe}
                            targetFPS={targetFPS}
                            setTargetFPS={setTargetFPS}
                        />
                    ) : undefined
                }
            />
        </>
    );
}
