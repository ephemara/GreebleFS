import React, { useState } from 'react';
import { Layers, LayoutGrid, Image as ImageIcon } from 'lucide-react';
import { KRightPanel } from '../../../core/ui/KPanelV2';
import KPainterLayers from './KPainterLayers';
import KPainterTexturesPanel from './KPainterTexturesPanel';

export default function KPainterRightPanel({
    layers,
    activeLayerId,
    targetLayerId,
    onAdd,
    onDelete,
    onToggle,
    onSelect,
    onFill,
    // Texture Sets
    textureSets,
    activeSetId,
    handleSetSelect,
    // Engine Ref for textures
    engineRef
}: any) {
    const [activeTabId, setActiveTabId] = useState('layers');

    const tabs = [
        {
            id: 'layers',
            label: 'Layers',
            icon: Layers,
            view: (
                <div className="flex flex-col h-full -m-4">
                    <KPainterLayers
                        layers={layers}
                        activeLayerId={activeLayerId}
                        targetLayerId={targetLayerId}
                        onAdd={onAdd}
                        onDelete={onDelete}
                        onToggle={onToggle}
                        onSelect={onSelect}
                        onFill={onFill}
                    />
                </div>
            )
        },
        {
            id: 'sets',
            label: 'Texture Sets',
            icon: LayoutGrid,
            view: (
                <div className="flex flex-col h-full -m-4">
                    <div className="p-3 border-b border-[#222] bg-[#1a1a1a] shrink-0">
                        <div className="flex items-center gap-2 text-white font-bold text-xs tracking-wider">
                            <LayoutGrid size={14} className="text-[#3daee9]" /> TEXTURE SETS
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1 bg-[#111]">
                        {textureSets && textureSets.map((set: any) => (
                            <div
                                key={set.id}
                                onClick={() => handleSetSelect(set.id)}
                                className={`p-2 rounded cursor-pointer border text-[10px] font-bold truncate transition-all ${activeSetId === set.id ? 'bg-[#3daee9]/20 border-[#3daee9] text-white' : 'bg-[#16181b] border-transparent text-gray-500 hover:text-gray-300'}`}
                            >
                                {set.name}
                            </div>
                        ))}
                    </div>
                </div>
            )
        },
        {
            id: 'textures',
            label: 'Textures',
            icon: ImageIcon,
            view: <KPainterTexturesPanel engineRef={engineRef} />
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
