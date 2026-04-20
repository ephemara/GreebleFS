import React, { useState } from 'react';
import {
    Hammer, Circle, Move, Activity, Square, Maximize, Paintbrush,
    Sliders, Hexagon, ArrowUpRight, Undo, Scan, Box, HardDrive, Palette, X,
    Scissors, Layers, Type, Trash2, Combine, History, Eraser, RefreshCcw, Copy
} from 'lucide-react';
import KSculptBrushes from './KSculptBrushes';
import { KLeftPanel } from '../../../core/ui/KPanelV2';
import KAlphaToolkit from '../../../core/ui/widgets/KAlphaToolkit';
// THREE.js REMOVED - Now using Bevy backend via IPC

export interface KSculptUIProps {
    onCommand?: (command: string, params?: any) => void;
    // All the existing props from parent
    mode?: any;
    setMode?: any;
    activeTab?: any;
    setActiveTab?: any;
    activeTool?: any;
    setActiveTool?: any;
    activeColor?: any;
    setActiveColor?: any;
    subdivisionLevel?: any;
    polyCount?: any;
    handleStepUp?: any;
    undo?: any;
    wireframe?: any;
    setWireframe?: any;
    transformData?: any;
    updateTransformFromUI?: any;
    loadPrimitive?: any;
    sharedState?: any;
    loadFromStorage?: any;
    layers?: any;
    activeLayerId?: any;
    setActiveLayerId?: any;
    toggleVisibility?: any;
    deleteLayer?: any;
    mergeDown?: any;
    mergeSelected?: any;
    mergeAll?: any;
    selectedLayerIds?: any;
    materialMode?: any;
    setMaterialMode?: any;
    activeMaterial?: any;
    applyMaterial?: any;
    projectMaterials?: any;
    gizmoMode?: any;
    setGizmoMode?: any;
    transformSpace?: any;
    setTransformSpace?: any;
    snapEnabled?: any;
    setSnapEnabled?: any;
    onClearMask?: any;
    onInvertMask?: any;
    onExtractMask?: any;
    toggleBrushMenu?: any;
    onRemesh?: any;
    activeAlpha?: any;
    setActiveAlpha?: any;
    onSaveAlphaToStorage?: any;
}

export default function KSculptUI({
    onCommand,
    mode, setMode,
    activeTab, setActiveTab,
    activeTool, setActiveTool,
    activeColor, setActiveColor,
    subdivisionLevel, polyCount, handleStepUp,
    undo, wireframe, setWireframe,
    transformData, updateTransformFromUI,
    loadPrimitive,
    sharedState, loadFromStorage,
    layers, activeLayerId, setActiveLayerId, toggleVisibility, deleteLayer,
    mergeDown, mergeSelected, mergeAll, selectedLayerIds,
    // Material Props
    materialMode, setMaterialMode,
    activeMaterial, applyMaterial,
    projectMaterials,
    // Gizmo Props
    gizmoMode, setGizmoMode,
    transformSpace, setTransformSpace,
    snapEnabled, setSnapEnabled,
    // Masking
    onClearMask, onInvertMask, onExtractMask,
    // Menus
    toggleBrushMenu,
    // Remesh
    // Remesh
    onRemesh,
    // Alpha
    activeAlpha, setActiveAlpha,
    onSaveAlphaToStorage
}: KSculptUIProps) {
    // Alpha System State - Uses Shared Kernel State
    const alphas = sharedState?.alphas || [];

    const handleSaveAlpha = (alpha: { name: string, url: string }) => {
        if (onSaveAlphaToStorage) onSaveAlphaToStorage(alpha);
    };

    // Panel Actions for KLeftPanel
    const actions = [
        {
            id: 'BRUSH',
            label: 'Brushes',
            icon: Paintbrush,
            onClick: () => { setActiveTab('BRUSH'); if (mode === 'TRANSFORM') setMode('SCULPT'); },
            active: activeTab === 'BRUSH'
        },
        {
            id: 'GEO',
            label: 'Geometry',
            icon: Hexagon,
            onClick: () => { setActiveTab('GEO'); setMode('SCULPT'); },
            active: activeTab === 'GEO'
        },
        {
            id: 'EDIT',
            label: 'Edit',
            icon: Move,
            onClick: () => { setActiveTab('EDIT'); setMode('TRANSFORM'); },
            active: activeTab === 'EDIT'
        }
    ];

    return (
        <KLeftPanel
            width="w-80"
            actions={actions}
            currentActionId={activeTab}
        >
            <div className="flex flex-col h-full bg-[#0f0f0f]">
                {/* HEADER */}
                <div className="p-4 border-b border-[#222] bg-[#111] shrink-0">
                    <div className="flex items-center gap-2 text-orange-500 mb-1">
                        <Hammer size={16} />
                        <span className="font-black tracking-[0.2em] text-xs">K-SCULPT</span>
                    </div>
                    <div className="text-[9px] text-gray-600 uppercase tracking-widest">Digital Clay Engine</div>
                </div>

                {/* TABS (Secondary Nav inside the panel) - Optional since we have the sidebar icons, but good for clarity/context at top */}
                <div className="flex border-b border-[#222] bg-[#161616] shrink-0">
                    <button onClick={() => { setActiveTab('BRUSH'); if (mode === 'TRANSFORM') setMode('SCULPT'); }} className={`flex-1 py-3 text-[10px] font-bold transition-all relative ${activeTab === 'BRUSH' ? 'text-orange-500 bg-[#222]' : 'text-gray-500 hover:text-gray-300'}`}>
                        BRUSH
                        {activeTab === 'BRUSH' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500" />}
                    </button>
                    <button onClick={() => { setActiveTab('GEO'); setMode('SCULPT'); }} className={`flex-1 py-3 text-[10px] font-bold transition-all relative ${activeTab === 'GEO' ? 'text-blue-500 bg-[#222]' : 'text-gray-500 hover:text-gray-300'}`}>
                        GEO
                        {activeTab === 'GEO' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />}
                    </button>
                </div>

                {/* CONTENT */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6 pb-20">

                    {/* BRUSH TAB */}
                    {activeTab === 'BRUSH' && (
                        <div className="animate-in slide-in-from-left-4 space-y-6">

                            {/* SCULPT TOOLS */}
                            <div className="space-y-4">
                                <div className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2 tracking-wider"><Paintbrush size={12} /> Sculpt Brushes</div>
                                <KSculptBrushes activeTool={activeTool} setActiveTool={(tool: string) => { setActiveTool(tool); setMode('SCULPT'); }} />
                            </div>

                            {/* ALPHA SYSTEM */}
                            <div className="pt-4 border-t border-[#222] space-y-4">
                                <div className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2 tracking-wider"><Scan size={12} /> Alpha System</div>
                                <div className="min-h-[480px] border border-[#222] rounded-lg overflow-hidden bg-black/20 flex flex-col">
                                    <KAlphaToolkit
                                        alphas={alphas}
                                        activeAlpha={activeAlpha}
                                        onSelectAlpha={setActiveAlpha}
                                        onSaveAlpha={handleSaveAlpha}
                                        className="p-2 flex-1"
                                    />
                                </div>
                            </div>

                            {/* UTILS */}
                            <div className="grid grid-cols-2 gap-2 pt-4 border-t border-[#222]">
                                <button onClick={undo} className="py-2 bg-[#222] hover:bg-[#333] rounded text-gray-400 text-[10px] font-bold flex items-center justify-center gap-2"><Undo size={12} /> UNDO</button>
                                <button onClick={() => setWireframe(!wireframe)} className={`py-2 rounded text-[10px] font-bold flex items-center justify-center gap-2 ${wireframe ? 'bg-blue-900/30 text-blue-400 border border-blue-900' : 'bg-[#222] text-gray-400'}`}><Scan size={12} /> WIREFRAME</button>
                            </div>

                            {activeTool === 'PAINT' && (
                                <div className="flex items-center gap-2 pt-2 border-t border-[#333] animate-in fade-in">
                                    <span className="text-[9px] font-bold text-gray-400">ACTIVE COLOR</span>
                                    <input type="color" value={activeColor} onChange={(e) => setActiveColor(e.target.value)} className="flex-1 bg-transparent border-none h-6 cursor-pointer" />
                                </div>
                            )}
                        </div>
                    )}

                    {/* GEO TAB (Geometry, Masking, Transform) */}
                    {activeTab === 'GEO' && (
                        <div className="animate-in slide-in-from-left-4 space-y-6">

                            {/* MASKING TOOLS */}
                            <div className="space-y-2">
                                <div className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2 tracking-wider"><Scan size={12} /> Masking</div>
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={onClearMask} className="py-2 bg-[#222] hover:bg-[#333] rounded text-gray-400 text-[9px] font-bold">CLEAR MASK (Alt+C)</button>
                                    <button onClick={onInvertMask} className="py-2 bg-[#222] hover:bg-[#333] rounded text-gray-400 text-[9px] font-bold">INVERT MASK (Alt+I)</button>
                                    <button onClick={onExtractMask} className="col-span-2 py-2 bg-[#222] hover:bg-[#333] border border-[#333] hover:border-orange-500/50 rounded text-gray-400 hover:text-orange-400 text-[9px] font-bold flex items-center justify-center gap-2"><Copy size={12} /> EXTRACT MASK (Duplicate)</button>
                                </div>
                            </div>

                            {/* GEOMETRY OPS */}
                            <div className="space-y-4 pt-4 border-t border-[#222]">
                                <div className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2 tracking-wider"><Activity size={12} /> Geometry Ops</div>

                                {/* SUBDIVISION */}
                                <div className="p-3 bg-[#161616] rounded border border-[#222]">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-[9px] font-bold text-gray-400">Subdivision Level</span>
                                        <span className="text-[9px] font-bold text-orange-500">{subdivisionLevel}</span>
                                    </div>
                                    <div className="flex justify-between items-center mb-3">
                                        <span className="text-[9px] font-bold text-gray-500">Poly Count</span>
                                        <span className="text-[9px] font-bold text-orange-500">{polyCount.toLocaleString()} tris</span>
                                    </div>
                                    <button
                                        onClick={handleStepUp}
                                        className="w-full py-2 bg-gradient-to-r from-orange-900/50 to-red-900/50 border border-orange-500/30 hover:border-orange-500 text-orange-200 rounded text-[9px] font-bold flex items-center justify-center gap-2 group transition-all"
                                    >
                                        <ArrowUpRight size={12} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" /> SUBDIVIDE
                                    </button>
                                </div>

                                {/* REMESH */}
                                <div className="p-3 bg-[#161616] rounded border border-[#222]">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-[9px] font-bold text-gray-400">Voxel Remesh</span>
                                    </div>
                                    <button
                                        onClick={onRemesh}
                                        className="w-full py-2 bg-[#222] border border-[#333] hover:border-white text-gray-300 rounded text-[9px] font-bold flex items-center justify-center gap-2 group transition-all"
                                    >
                                        <RefreshCcw size={12} className={mode === 'SCULPT' ? "" : "animate-spin"} /> REMESH (VOXEL)
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* EDIT TAB (Transform & Properties) */}
                    {activeTab === 'EDIT' && (
                        <div className="animate-in slide-in-from-left-4 space-y-6">

                            {/* TRANSFORM TOOLS */}
                            <div className="space-y-4">
                                <div className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2 tracking-wider"><Move size={12} /> Transform</div>

                                <div className="p-3 bg-[#161616] rounded border border-[#222] space-y-3">
                                    <div className="grid grid-cols-2 gap-2">
                                        <button onClick={() => setGizmoMode('translate')} className={`py-2 rounded text-[9px] font-bold border flex items-center justify-center gap-2 ${gizmoMode === 'translate' ? 'bg-blue-900/50 border-blue-500 text-white' : 'bg-[#222] border-[#333] text-gray-500 hover:text-gray-300'}`}>
                                            <Move size={12} /> MOVE
                                        </button>
                                        <button onClick={() => setGizmoMode('rotate')} className={`py-2 rounded text-[9px] font-bold border flex items-center justify-center gap-2 ${gizmoMode === 'rotate' ? 'bg-green-900/50 border-green-500 text-white' : 'bg-[#222] border-[#333] text-gray-500 hover:text-gray-300'}`}>
                                            <RefreshCcw size={12} /> ROTATE
                                        </button>
                                        <button onClick={() => setGizmoMode('scale')} className={`py-2 rounded text-[9px] font-bold border flex items-center justify-center gap-2 ${gizmoMode === 'scale' ? 'bg-red-900/50 border-red-500 text-white' : 'bg-[#222] border-[#333] text-gray-500 hover:text-gray-300'}`}>
                                            <Maximize size={12} /> SCALE
                                        </button>
                                        <button onClick={() => setTransformSpace(s => s === 'world' ? 'local' : 'world')} className="py-2 rounded text-[9px] font-bold border bg-[#222] border-[#333] text-gray-400 hover:text-white uppercase">
                                            {transformSpace}
                                        </button>
                                    </div>

                                    {/* NUMERICAL INPUTS */}
                                    <div className="space-y-2 pt-2 border-t border-[#333]">
                                        {/* POSITION */}
                                        <div className="grid grid-cols-4 gap-1 items-center">
                                            <div className="text-[8px] font-bold text-gray-500">POS</div>
                                            <input type="number" value={transformData.posX} onChange={(e) => updateTransformFromUI('posX', parseFloat(e.target.value))} className="bg-[#111] rounded px-1 text-[9px] text-red-400 border border-[#333] focus:border-red-500 outline-none" placeholder="X" />
                                            <input type="number" value={transformData.posY} onChange={(e) => updateTransformFromUI('posY', parseFloat(e.target.value))} className="bg-[#111] rounded px-1 text-[9px] text-green-400 border border-[#333] focus:border-green-500 outline-none" placeholder="Y" />
                                            <input type="number" value={transformData.posZ} onChange={(e) => updateTransformFromUI('posZ', parseFloat(e.target.value))} className="bg-[#111] rounded px-1 text-[9px] text-blue-400 border border-[#333] focus:border-blue-500 outline-none" placeholder="Z" />
                                        </div>

                                        {/* ROTATION */}
                                        <div className="grid grid-cols-4 gap-1 items-center">
                                            <div className="text-[8px] font-bold text-gray-500">ROT</div>
                                            <input type="number" value={transformData.rotX} onChange={(e) => updateTransformFromUI('rotX', parseFloat(e.target.value))} className="bg-[#111] rounded px-1 text-[9px] text-red-400 border border-[#333] focus:border-red-500 outline-none" placeholder="X" />
                                            <input type="number" value={transformData.rotY} onChange={(e) => updateTransformFromUI('rotY', parseFloat(e.target.value))} className="bg-[#111] rounded px-1 text-[9px] text-green-400 border border-[#333] focus:border-green-500 outline-none" placeholder="Y" />
                                            <input type="number" value={transformData.rotZ} onChange={(e) => updateTransformFromUI('rotZ', parseFloat(e.target.value))} className="bg-[#111] rounded px-1 text-[9px] text-blue-400 border border-[#333] focus:border-blue-500 outline-none" placeholder="Z" />
                                        </div>

                                        {/* SCALE */}
                                        <div className="grid grid-cols-4 gap-1 items-center">
                                            <div className="text-[8px] font-bold text-gray-500">SCL</div>
                                            <input type="number" value={transformData.scaleX} onChange={(e) => updateTransformFromUI('scaleX', parseFloat(e.target.value))} className="bg-[#111] rounded px-1 text-[9px] text-red-400 border border-[#333] focus:border-red-500 outline-none" placeholder="X" />
                                            <input type="number" value={transformData.scaleY} onChange={(e) => updateTransformFromUI('scaleY', parseFloat(e.target.value))} className="bg-[#111] rounded px-1 text-[9px] text-green-400 border border-[#333] focus:border-green-500 outline-none" placeholder="Y" />
                                            <input type="number" value={transformData.scaleZ} onChange={(e) => updateTransformFromUI('scaleZ', parseFloat(e.target.value))} className="bg-[#111] rounded px-1 text-[9px] text-blue-400 border border-[#333] focus:border-blue-500 outline-none" placeholder="Z" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div >
            </div>
        </KLeftPanel >
    );
}
