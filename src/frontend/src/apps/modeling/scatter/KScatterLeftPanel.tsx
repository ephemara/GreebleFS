import React, { useState } from 'react';
import { Box, Circle, Dna, Triangle, Layers, HardDrive, LayoutGrid } from 'lucide-react';
import { KLeftPanel } from '../../../core/ui/KPanelV2';

interface KScatterLeftPanelProps {
    activeTab: 'primitives' | 'storage';
    setActiveTab: (tab: 'primitives' | 'storage') => void;
    activePrimitive: string;
    setActivePrimitive: (v: string) => void;
    updatePaletteFromPrimitive: (v: string) => void;
    activeStorageId: string | null;
    setActiveStorageId: (v: string) => void;
    updatePaletteFromStorage: (item: any) => void;
    sharedState: any;
}

const PRIMITIVES = [
    { id: 'CUBE', icon: Box },
    { id: 'SPHERE', icon: Circle },
    { id: 'CYLINDER', icon: Dna },
    { id: 'PYRAMID', icon: Triangle },
    { id: 'PLATE', icon: Layers },
];

export default function KScatterLeftPanel({
    activeTab, setActiveTab,
    activePrimitive, setActivePrimitive, updatePaletteFromPrimitive,
    activeStorageId, setActiveStorageId, updatePaletteFromStorage,
    sharedState
}: KScatterLeftPanelProps) {

    // Panel Actions
    const actions = [
        {
            id: 'primitives',
            label: 'Primitives',
            icon: Box,
            onClick: () => setActiveTab('primitives'),
            color: activeTab === 'primitives' ? 'bg-pink-900/50 text-pink-400' : ''
        },
        {
            id: 'storage',
            label: 'Kernel Storage',
            icon: HardDrive,
            onClick: () => setActiveTab('storage'),
            color: activeTab === 'storage' ? 'bg-pink-900/50 text-pink-400' : ''
        }
    ];

    return (
        <KLeftPanel
            width="w-72"
            actions={actions}
            currentActionId={activeTab}
        >
            <div className="flex flex-col h-full bg-[#0f0f0f]">
                {/* HEADER */}
                <div className="p-4 border-b border-[#222] bg-[#111] shrink-0">
                    <div className="flex items-center gap-2 text-pink-500 mb-1">
                        <LayoutGrid size={16} />
                        <span className="font-black tracking-[0.2em] text-xs">K-SCATTER</span>
                    </div>
                    <div className="text-[9px] text-gray-600 uppercase tracking-widest">Instancing Engine</div>
                </div>

                {/* TABS */}
                <div className="flex border-b border-[#222] shrink-0">
                    <button
                        onClick={() => setActiveTab('primitives')}
                        className={`flex-1 py-3 text-[10px] font-bold transition-all ${activeTab === 'primitives'
                            ? 'bg-[#1a1a1a] text-pink-400 border-b-2 border-pink-500'
                            : 'text-gray-500 hover:text-white'
                            }`}
                    >
                        PRIMITIVES
                    </button>
                    <button
                        onClick={() => setActiveTab('storage')}
                        className={`flex-1 py-3 text-[10px] font-bold transition-all ${activeTab === 'storage'
                            ? 'bg-[#1a1a1a] text-pink-400 border-b-2 border-pink-500'
                            : 'text-gray-500 hover:text-white'
                            }`}
                    >
                        KERNEL STORAGE
                    </button>
                </div>

                {/* CONTENT */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                    {activeTab === 'primitives' && (
                        <div className="grid grid-cols-4 gap-2">
                            {PRIMITIVES.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => {
                                        setActivePrimitive(p.id);
                                        updatePaletteFromPrimitive(p.id);
                                    }}
                                    className={`aspect-square rounded border flex items-center justify-center transition-all ${activePrimitive === p.id
                                        ? 'bg-pink-900/20 border-pink-500 text-pink-400'
                                        : 'bg-[#111] border-[#222] text-gray-600 hover:text-white hover:border-gray-500'
                                        }`}
                                    title={p.id}
                                >
                                    <p.icon size={16} />
                                </button>
                            ))}
                        </div>
                    )}

                    {activeTab === 'storage' && (
                        <div className="space-y-2">
                            <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                <HardDrive size={10} /> Available Assets
                            </div>

                            {(!sharedState?.storage || sharedState.storage.length === 0) ? (
                                <div className="text-[10px] text-gray-600 italic p-4 text-center border border-dashed border-[#222] rounded">
                                    Kernel Memory Empty.<br />Commit objects from Sculpt/Greeble first.
                                </div>
                            ) : (
                                <div className="grid grid-cols-3 gap-2">
                                    {sharedState.storage.map((item: any) => (
                                        <button
                                            key={item.id}
                                            onClick={() => {
                                                setActiveStorageId(item.id);
                                                updatePaletteFromStorage(item);
                                            }}
                                            className={`relative aspect-square rounded border overflow-hidden transition-all group ${activeStorageId === item.id
                                                ? 'border-pink-500 ring-1 ring-pink-500'
                                                : 'border-[#222] hover:border-gray-500'
                                                }`}
                                        >
                                            {item.thumbnail ? (
                                                <img
                                                    src={item.thumbnail}
                                                    className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"
                                                    alt={item.name}
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-[#111]">
                                                    <Box size={16} className="text-gray-600" />
                                                </div>
                                            )}
                                            <div className="absolute bottom-0 left-0 right-0 bg-black/80 text-[7px] text-center py-1 truncate px-1 text-gray-300">
                                                {item.name}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </KLeftPanel>
    );
}
