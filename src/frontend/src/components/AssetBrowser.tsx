
import React, { useState } from 'react';
import {
    HardDrive, X, UploadCloud, Loader2, Box, Palette, Stamp,
    Trash2, Download, Combine, CheckSquare, Merge, Activity,
    Filter
} from 'lucide-react';
import { KernelArtifact, KernelMaterial, KernelAlpha } from '../core/types/kernel';
import { CATEGORY_CONFIG } from '../config/appConfig';
import { ChevronRight, ChevronDown } from 'lucide-react';

interface AssetBrowserProps {
    isOpen: boolean;
    browserTab: 'ARTIFACTS' | 'MATERIALS' | 'ALPHAS';
    artifacts: KernelArtifact[];
    materials: KernelMaterial[];
    alphas: KernelAlpha[];
    selectedArtifactIds: string[];
    activeArtifactId: string | null;
    previewArtifactId: string | null;
    isImporting: boolean;
    isMerging: boolean;
    openFolders: Record<string, boolean>;
    onClose: () => void;
    onTabChange: (tab: 'ARTIFACTS' | 'MATERIALS' | 'ALPHAS') => void;
    onToggleFolder: (category: string) => void;
    onArtifactClick: (id: string) => void;
    onArtifactSelect: (id: string, e: React.MouseEvent) => void;
    onArtifactWeld: (id: string, e: React.MouseEvent) => void;
    onArtifactDownload: (id: string, e: React.MouseEvent) => void;
    onArtifactDelete: (id: string, e: React.MouseEvent) => void;
    onMountArtifact: (id: string) => void;
    onUnmountArtifact: () => void;
    onDeselectAll: () => void;
    onMerge: () => void;
    onImport: (file: File) => void;
    onAlphaImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onMaterialDelete: (id: string) => void;
    onAlphaDelete: (id: string) => void;
}

export default function AssetBrowser({
    isOpen,
    browserTab,
    artifacts,
    materials,
    alphas,
    selectedArtifactIds,
    activeArtifactId,
    previewArtifactId,
    isImporting,
    isMerging,
    openFolders,
    onClose,
    onTabChange,
    onToggleFolder,
    onArtifactClick,
    onArtifactSelect,
    onArtifactWeld,
    onArtifactDownload,
    onArtifactDelete,
    onMountArtifact,
    onUnmountArtifact,
    onDeselectAll,
    onMerge,
    onImport,
    onAlphaImport,
    onMaterialDelete,
    onAlphaDelete
}: AssetBrowserProps) {
    const [artifactFilter, setArtifactFilter] = useState<'ALL' | 'MESH' | 'RIG' | 'ANIM'>('ALL');

    if (!isOpen) return null;

    const getFilterMatch = (source: string) => {
        if (artifactFilter === 'ALL') return true;
        if (artifactFilter === 'RIG') return source === 'K-RIG';
        if (artifactFilter === 'ANIM') return source === 'K-CLONER' || source === 'K-RIG';
        if (artifactFilter === 'MESH') return source !== 'K-RIG' && source !== 'K-CLONER';
        return true;
    };

    const categorizedArtifacts = () => {
        const groups: Record<string, KernelArtifact[]> = {};
        artifacts.forEach(art => {
            if (!getFilterMatch(art.source)) return;
            const cat = CATEGORY_CONFIG[art.source] ? art.source : 'IMPORT';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(art);
        });
        return groups;
    };

    const renderCategory = (category: string, items: KernelArtifact[]) => {
        const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG['IMPORT'];
        const isOpen = openFolders[category];

        if (items.length === 0) return null;

        return (
            <div key={category} className="mb-4 animate-in fade-in slide-in-from-left-4 duration-300">
                <div
                    onClick={() => onToggleFolder(category)}
                    className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-all border border-transparent hover:border-[#333] ${isOpen ? 'bg-[#111]' : 'hover:bg-[#111]'}`}
                >
                    {isOpen ? <ChevronDown size={14} className="text-gray-500" /> : <ChevronRight size={14} className="text-gray-500" />}
                    <div className={`p-1.5 rounded ${config.bg} ${config.border} border`}>
                        <config.icon size={14} className={config.color} />
                    </div>
                    <span className={`text-[10px] font-bold tracking-widest flex-1 ${config.color}`}>{config.label}</span>
                    <span className="text-[9px] text-gray-600 font-mono bg-[#050505] px-2 py-0.5 rounded-full">{items.length}</span>
                </div>

                {isOpen && (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 p-2 pl-4 border-l border-[#222] ml-2 mt-2">
                        {items.map(art => {
                            const isSelected = selectedArtifactIds.includes(art.id);
                            const isMounted = activeArtifactId === art.id;
                            const isPreview = previewArtifactId === art.id;

                            return (
                                <div
                                    key={art.id}
                                    onClick={() => onArtifactClick(art.id)}
                                    className={`relative group p-2 rounded-lg border transition-all cursor-pointer
                                        ${isPreview ? 'bg-white/10 border-white ring-1 ring-white' :
                                            isMounted ? `bg-${config.color.split('-')[1]}-900/20 ${config.border} ring-1 ring-${config.color.split('-')[1]}-500` :
                                                isSelected ? 'bg-orange-500/10 border-orange-500' : 'bg-[#0f0f0f] border-[#222] hover:border-gray-600'}
                                    `}
                                >
                                    <div className="absolute top-2 left-2 z-20">
                                        <button
                                            onClick={(e) => onArtifactSelect(art.id, e)}
                                            className={`p-1 rounded hover:bg-black/50 ${isSelected ? 'text-orange-500' : 'text-gray-500 hover:text-white'}`}
                                        >
                                            <CheckSquare size={12} />
                                        </button>
                                    </div>

                                    <div className="aspect-square bg-[#050505] rounded mb-2 flex items-center justify-center relative overflow-hidden group-hover:bg-black transition-colors">
                                        {art.thumbnail ? (
                                            <img src={art.thumbnail} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt={art.name} />
                                        ) : (
                                            <Box size={24} className="text-gray-700" />
                                        )}
                                        {isMounted && (
                                            <div className={`absolute top-2 right-2 ${config.bg} ${config.color} text-[8px] font-bold px-1.5 py-0.5 rounded border ${config.border} shadow-lg z-10`}>MOUNTED</div>
                                        )}
                                        {art.isWelded && (
                                            <div className="absolute bottom-2 right-2 bg-purple-900/80 text-purple-200 text-[8px] font-bold px-1.5 py-0.5 rounded border border-purple-500 shadow-lg">MONOLITH</div>
                                        )}
                                        {art.isProcessing && (
                                            <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-30">
                                                <Loader2 size={20} className="text-purple-500 animate-spin" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex justify-between items-start">
                                        <div className="overflow-hidden">
                                            <div className={`text-[9px] font-bold truncate ${isPreview ? 'text-white' : isMounted ? config.color : 'text-gray-300'}`}>{art.name}</div>
                                            <div className="text-[8px] text-gray-600 font-mono mt-0.5">{(art.size / 1024).toFixed(0)} KB</div>
                                        </div>

                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={(e) => onArtifactWeld(art.id, e)} className="text-gray-500 hover:text-purple-400" title="Weld"><Combine size={10} /></button>
                                            <button onClick={(e) => onArtifactDownload(art.id, e)} className="text-gray-500 hover:text-blue-400" title="Download"><Download size={10} /></button>
                                            <button onClick={(e) => onArtifactDelete(art.id, e)} className="text-gray-500 hover:text-red-400" title="Delete"><Trash2 size={10} /></button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="absolute inset-0 z-[100] bg-black/60 backdrop-blur-2xl flex items-center justify-center p-12 animate-in fade-in duration-300">
            <div className="w-full max-w-6xl h-[85vh] bg-[#0a0a0a]/90 border border-[#222] rounded-3xl shadow-2xl flex flex-col overflow-hidden relative backdrop-blur-xl">

                {/* HEADER SECTION */}
                <div className="flex flex-col border-b border-[#222]">

                    {/* ROW 1: PRIMARY NAVIGATION */}
                    <div className="flex items-center justify-between p-6 pb-2">
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-3 text-white">
                                <HardDrive size={24} className="text-[#00ffcc]" />
                                <div>
                                    <h2 className="text-lg font-black tracking-widest leading-none">STORAGE MATRIX</h2>
                                    <div className="text-[10px] text-gray-500 font-mono tracking-wider">KERNEL DATA ACCESS</div>
                                </div>
                            </div>

                            {/* MAIN TABS */}
                            <div className="flex bg-black/50 p-1.5 rounded-full border border-[#222]">
                                <button
                                    onClick={() => onTabChange('ARTIFACTS')}
                                    className={`px-6 py-2 rounded-full text-[10px] font-bold transition-all ${browserTab === 'ARTIFACTS' ? 'bg-[#222] text-white shadow-[0_0_15px_rgba(255,255,255,0.05)] ring-1 ring-inset ring-white/10' : 'text-gray-500 hover:text-white'}`}
                                >
                                    DATA BANK {artifacts.length > 0 && <span className="ml-1 opacity-50">({artifacts.length})</span>}
                                </button>
                                <button
                                    onClick={() => onTabChange('MATERIALS')}
                                    className={`px-6 py-2 rounded-full text-[10px] font-bold transition-all ${browserTab === 'MATERIALS' ? 'bg-[#222] text-white shadow-[0_0_15px_rgba(255,255,255,0.05)] ring-1 ring-inset ring-white/10' : 'text-gray-500 hover:text-white'}`}
                                >
                                    MATERIALS {materials.length > 0 && <span className="ml-1 opacity-50">({materials.length})</span>}
                                </button>
                                <button
                                    onClick={() => onTabChange('ALPHAS')}
                                    className={`px-6 py-2 rounded-full text-[10px] font-bold transition-all ${browserTab === 'ALPHAS' ? 'bg-[#222] text-white shadow-[0_0_15px_rgba(255,255,255,0.05)] ring-1 ring-inset ring-white/10' : 'text-gray-500 hover:text-white'}`}
                                >
                                    ALPHAS {alphas.length > 0 && <span className="ml-1 opacity-50">({alphas.length})</span>}
                                </button>
                            </div>
                        </div>

                        {/* CLOSE */}
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-gray-500 hover:text-white transition-colors">
                            <X size={24} />
                        </button>
                    </div>

                    {/* ROW 2: SECONDARY TOOLBAR */}
                    <div className="flex items-center justify-between px-6 pb-6 pt-2">
                        {/* LEFT: FILTERS (Only active for DATA BANK) */}
                        <div className="flex items-center gap-4 h-8">
                            {browserTab === 'ARTIFACTS' && (
                                <div className="flex gap-1 p-1 bg-black/30 rounded-full border border-[#222]/50">
                                    {['ALL', 'MESH', 'RIG', 'ANIM'].map(f => (
                                        <button
                                            key={f}
                                            onClick={() => setArtifactFilter(f as any)}
                                            className={`px-4 py-1 rounded-full text-[9px] font-bold transition-all ${artifactFilter === f ? 'bg-[#222] text-[#00ffcc] shadow-[0_0_10px_rgba(0,255,204,0.1)]' : 'text-gray-600 hover:text-gray-300'}`}
                                        >
                                            {f}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* RIGHT: ACTIONS & IMPORTS */}
                        <div className="flex items-center gap-3">

                            {/* SELECTION ACTIONS */}
                            {selectedArtifactIds.length > 0 && browserTab === 'ARTIFACTS' && (
                                <div className="flex items-center gap-2 mr-4 animate-in fade-in slide-in-from-right-4">
                                    <span className="text-[10px] font-bold text-orange-500 mr-2">
                                        {selectedArtifactIds.length} SELECTED
                                    </span>
                                    {selectedArtifactIds.length >= 2 && (
                                        <button onClick={onMerge} disabled={isMerging} className="px-4 py-1.5 bg-orange-500/10 hover:bg-orange-500 text-orange-500 hover:text-white border border-orange-500/50 rounded-full text-[10px] font-bold flex items-center gap-2 transition-all">
                                            {isMerging ? <Activity size={12} className="animate-spin" /> : <Merge size={12} />}
                                            MERGE
                                        </button>
                                    )}
                                    <button onClick={onDeselectAll} className="px-3 py-1.5 hover:bg-white/10 text-gray-500 hover:text-white rounded-full text-[10px] font-bold transition-colors">
                                        CLEAR
                                    </button>
                                </div>
                            )}

                            {/* MOUNT ACTION (Moved from footer) */}
                            {previewArtifactId && previewArtifactId !== activeArtifactId && browserTab === 'ARTIFACTS' && (
                                <button onClick={() => onMountArtifact(previewArtifactId)} className="mr-4 px-5 py-2 bg-[#00ffcc] hover:bg-[#00eebb] text-black rounded-full text-[10px] font-bold flex items-center gap-2 shadow-[0_0_20px_rgba(0,255,204,0.3)] hover:shadow-[0_0_30px_rgba(0,255,204,0.5)] transition-all animate-in fade-in zoom-in">
                                    <HardDrive size={14} /> LOAD TO KERNEL
                                </button>
                            )}

                            {/* IMPORT BUTTONS */}
                            {browserTab === 'ARTIFACTS' && (
                                <label className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-full text-[10px] font-bold cursor-pointer transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)]">
                                    {isImporting ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
                                    <span>{isImporting ? 'IMPORTING...' : 'IMPORT FILE'}</span>
                                    <input type="file" onChange={(e) => { if (e.target.files?.[0]) onImport(e.target.files[0]) }} className="hidden" />
                                </label>
                            )}

                            {browserTab === 'ALPHAS' && (
                                <label className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-full text-[10px] font-bold cursor-pointer transition-all">
                                    <UploadCloud size={14} />
                                    <span>UPLOAD ALPHAS</span>
                                    <input type="file" multiple onChange={onAlphaImport} accept="image/*" className="hidden" />
                                </label>
                            )}
                        </div>
                    </div>
                </div>

                {/* CONTENT AREA */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-[#050505]/50">
                    {browserTab === 'ARTIFACTS' ? (
                        artifacts.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-50">
                                <Box size={64} className="mb-6 opacity-20" />
                                <p className="text-sm font-mono tracking-widest">DATA BANK EMPTY</p>
                            </div>
                        ) : (
                            <div className="space-y-8">
                                {Object.entries(categorizedArtifacts()).map(([cat, items]) => renderCategory(cat, items))}
                            </div>
                        )
                    ) : browserTab === 'MATERIALS' ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {materials.length === 0 ? (
                                <div className="col-span-full h-full flex flex-col items-center justify-center text-gray-600 opacity-50 mt-20">
                                    <Palette size={64} className="mb-6 opacity-20" />
                                    <p className="text-sm font-mono tracking-widest">NO MATERIALS</p>
                                </div>
                            ) : (
                                materials.map(mat => (
                                    <div key={mat.id} className="bg-[#111] border border-[#222] rounded-xl overflow-hidden group hover:border-[#00ffcc] hover:shadow-[0_0_20px_rgba(0,255,204,0.1)] transition-all relative">
                                        <div className="aspect-square relative">
                                            <img src={mat.preview} className="w-full h-full object-cover" alt={mat.name} />
                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                <button onClick={() => onMaterialDelete(mat.id)} className="p-3 bg-red-500/20 text-red-400 rounded-full hover:bg-red-500 hover:text-white transition-colors backdrop-blur-md"><Trash2 size={16} /></button>
                                            </div>
                                        </div>
                                        <div className="p-3">
                                            <div className="text-xs font-bold text-gray-200 truncate">{mat.name}</div>
                                            <div className="text-[9px] text-gray-500 font-mono mt-1">PBR MATERIAL</div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
                            {alphas.length === 0 ? (
                                <div className="col-span-full h-full flex flex-col items-center justify-center text-gray-600 opacity-50 mt-20">
                                    <Stamp size={64} className="mb-6 opacity-20" />
                                    <p className="text-sm font-mono tracking-widest">NO ALPHAS</p>
                                </div>
                            ) : (
                                alphas.map(alpha => (
                                    <div key={alpha.id} className="bg-[#111] border border-[#222] rounded-xl overflow-hidden group hover:border-[#00ffcc] hover:shadow-[0_0_20px_rgba(0,255,204,0.1)] transition-all relative">
                                        <div className="aspect-square relative p-4 flex items-center justify-center bg-black">
                                            <img src={alpha.preview} className="w-full h-full object-contain filter invert" alt={alpha.name} />
                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                <button onClick={() => onAlphaDelete(alpha.id)} className="p-2 bg-red-500/20 text-red-400 rounded-full hover:bg-red-500 hover:text-white transition-colors backdrop-blur-md"><Trash2 size={14} /></button>
                                            </div>
                                        </div>
                                        <div className="p-2 bg-[#0a0a0a] border-t border-[#222]">
                                            <div className="text-[9px] font-bold text-gray-400 truncate text-center">{alpha.name}</div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                {/* FOOTER - ONLY FOR STATUS IF NEEDED OR REMOVED */}
                <div className="border-t border-[#222] bg-[#080808] px-8 py-3 flex justify-between items-center text-[10px] text-gray-600 font-mono">
                    <div>STORAGE: {(artifacts.length + materials.length + alphas.length)} ITEMS</div>
                    {activeArtifactId && (
                        <div className="flex items-center gap-2 text-green-500">
                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                            SYSTEM ENGAGED
                            <span className="text-gray-500 mx-2">|</span>
                            <button onClick={onUnmountArtifact} className="hover:text-white">UNMOUNT</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
