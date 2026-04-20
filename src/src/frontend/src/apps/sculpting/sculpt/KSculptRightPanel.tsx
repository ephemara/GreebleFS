import React, { useState } from 'react';
import { Layers, Palette, X, Box, HardDrive, Circle, Activity, Square, Hexagon } from 'lucide-react';
import { KRightPanel } from '../../../core/ui/KPanelV2';
import KSculptLayers from './KSculptLayers';

const PRIMITIVES = [
    { id: 'SPHERE', label: 'Sphere', icon: Circle },
    { id: 'CUBE', label: 'Cube', icon: Box },
    { id: 'CYLINDER', label: 'Cylinder', icon: Activity },
    { id: 'TORUS', label: 'Torus', icon: Circle },
    { id: 'PLANE', label: 'Plane', icon: Square },
    { id: 'ICOSA', label: 'Icosa', icon: Hexagon },
];

export default function KSculptRightPanel({
    layers,
    activeLayerId,
    setActiveLayerId,
    toggleVisibility,
    deleteLayer,
    mergeDown,
    mergeSelected,
    mergeAll,
    selectedLayerIds,
    // Material Props
    materialMode, setMaterialMode,
    activeMaterial, applyMaterial,
    projectMaterials,
    // Assets
    loadPrimitive,
    loadFromStorage,
    sharedState
}: any) {
    const [activeTabId, setActiveTabId] = useState('layers');
    const [assetMode, setAssetMode] = useState<'PRIMS' | 'STORAGE'>('PRIMS');

    // Define Tabs
    const tabs = [
        {
            id: 'layers',
            label: 'Subtools',
            icon: Layers,
            view: (
                <div className="flex flex-col h-full w-full">
                    <div className="flex-1 min-h-0 overflow-y-auto mb-4">
                        <KSculptLayers
                            layers={layers}
                            activeLayerId={activeLayerId}
                            setActiveLayerId={setActiveLayerId}
                            toggleVisibility={toggleVisibility}
                            deleteLayer={deleteLayer}
                            mergeDown={mergeDown}
                            mergeSelected={mergeSelected}
                            mergeAll={mergeAll}
                            selectedLayerIds={selectedLayerIds}
                        />
                    </div>

                    {/* ASSETS SECTION (Bottom Half-ish) */}
                    <div className="border-t border-[#333] pt-2 mt-2 shrink-0">
                        {/* Toggle Header */}
                        <div className="flex items-center gap-1 mb-2 bg-[#161616] p-0.5 rounded border border-[#222]">
                            <button
                                onClick={() => setAssetMode('PRIMS')}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[9px] font-bold rounded transition-all ${assetMode === 'PRIMS' ? 'bg-[#333] text-orange-500 shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                <Box size={10} /> PRIMS
                            </button>
                            <div className="w-px h-4 bg-[#333]"></div>
                            <button
                                onClick={() => setAssetMode('STORAGE')}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[9px] font-bold rounded transition-all ${assetMode === 'STORAGE' ? 'bg-[#333] text-purple-500 shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                <HardDrive size={10} /> STORAGE
                            </button>
                        </div>

                        {/* Content Grid */}
                        <div className="h-40 overflow-y-auto custom-scrollbar bg-[#111] rounded border border-[#222] p-2">
                            {assetMode === 'PRIMS' ? (
                                <div className="grid grid-cols-4 gap-1.5">
                                    {PRIMITIVES.map(prim => (
                                        <button
                                            key={prim.id}
                                            onClick={() => loadPrimitive(prim.id)}
                                            className="aspect-square flex flex-col items-center justify-center gap-1.5 bg-[#161616] border border-[#222] hover:border-orange-500/50 hover:bg-[#222] rounded transition-all text-gray-500 hover:text-orange-100 group"
                                            title={prim.label}
                                        >
                                            <prim.icon size={14} className="group-hover:scale-110 transition-transform" />
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <>
                                    {(!sharedState?.storage || sharedState.storage.length === 0) ? (
                                        <div className="h-full flex flex-col items-center justify-center text-center text-[9px] text-gray-600 italic px-4">
                                            <HardDrive size={16} className="mb-2 opacity-20" />
                                            Kernel Memory Empty.
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-3 gap-1.5">
                                            {sharedState.storage.map((item: any) => (
                                                <button
                                                    key={item.id}
                                                    onClick={() => loadFromStorage(item)}
                                                    className="relative aspect-square rounded border border-[#222] overflow-hidden hover:border-purple-500 transition-all group bg-[#000]"
                                                    title={item.name}
                                                >
                                                    {item.thumbnail ? (
                                                        <img src={item.thumbnail} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" alt={item.name} />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center bg-[#111]"><Box size={14} className="text-gray-600" /></div>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: 'mats',
            label: 'Materials',
            icon: Palette,
            view: (
                <div className="space-y-6">
                    {/* Mode Switcher */}
                    <div className="bg-[#161616] p-1 rounded border border-[#222] flex">
                        <button onClick={() => setMaterialMode('CLAY')} className={`flex-1 py-2 text-[9px] font-bold rounded transition-all ${materialMode === 'CLAY' ? 'bg-orange-500 text-black' : 'text-gray-500 hover:text-white'}`}>CLAY (SCULPT)</button>
                        <button onClick={() => setMaterialMode('PBR')} className={`flex-1 py-2 text-[9px] font-bold rounded transition-all ${materialMode === 'PBR' ? 'bg-pink-500 text-black' : 'text-gray-500 hover:text-white'}`}>PBR (SHOW)</button>
                    </div>

                    {materialMode === 'PBR' && (
                        <div className="space-y-4">
                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><Palette size={10} /> Project Materials</div>
                            {(!projectMaterials || projectMaterials.length === 0) ? (
                                <div className="p-4 border border-dashed border-[#222] rounded text-center text-[9px] text-gray-600 italic">No Materials in Kernel. Create in K-Autopbr first.</div>
                            ) : (
                                <div className="grid grid-cols-2 gap-2">
                                    {projectMaterials.map((mat: any) => (
                                        <button
                                            key={mat.id}
                                            onClick={() => applyMaterial(mat)}
                                            className={`relative aspect-square rounded border overflow-hidden group transition-all ${activeMaterial?.id === mat.id ? 'border-pink-500 ring-1 ring-500' : 'border-[#222] hover:border-gray-500'}`}
                                        >
                                            <img src={mat.preview} className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <span className="text-[8px] font-bold text-white text-center px-1">{mat.name}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                            {activeMaterial && (
                                <div className="p-2 bg-[#222] rounded flex items-center justify-between text-[9px]">
                                    <span className="text-gray-400">Active: <span className="text-white font-bold">{activeMaterial.name}</span></span>
                                    <button onClick={() => applyMaterial(null)} className="text-gray-500 hover:text-red-400"><X size={12} /></button>
                                </div>
                            )}
                        </div>
                    )}

                    {materialMode === 'CLAY' && (
                        <div className="p-4 border border-dashed border-[#222] rounded text-center text-[10px] text-gray-600">
                            Vertex Painting & Sculpting Mode Active.<br />Materials hidden.
                        </div>
                    )}
                </div>
            )
        }
    ];

    return (
        <KRightPanel
            width="w-72"
            tabs={tabs}
            activeTabId={activeTabId}
            onTabChange={setActiveTabId}
        />
    );
}
