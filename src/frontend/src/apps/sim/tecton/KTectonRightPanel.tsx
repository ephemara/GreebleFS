import React from 'react';
import KRightPanel from '../../../core/ui/KPanelV2/KRightPanel';
import {
    Hammer, Minimize2, Layers, Activity, Droplet, AlignJustify, Target,
    Zap, Shrink, RotateCw, PenTool
} from 'lucide-react';

interface KTectonRightPanelProps {
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    activeTab: 'sculpt';
    setActiveTab: (tab: 'sculpt') => void;

    // Sculpt Props
    sculptMode: number; setSculptMode: (m: number) => void;
    brushSize: number; setBrushSize: (s: number) => void;
    brushStrength: number; setBrushStrength: (s: number) => void;
}

export default function KTectonRightPanel({
    isOpen, setIsOpen,
    activeTab, setActiveTab,
    sculptMode, setSculptMode,
    brushSize, setBrushSize,
    brushStrength, setBrushStrength
}: KTectonRightPanelProps) {

    const tabs = [
        {
            id: 'sculpt',
            label: 'SCULPT',
            icon: PenTool,
            view: (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="space-y-3">
                        <div className="text-[10px] font-bold text-gray-400 flex items-center gap-2 uppercase tracking-widest">
                            <PenTool size={12} /> Manual Tools
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { id: 0, l: 'UPLIFT', i: Hammer },
                                { id: 1, l: 'ERODE', i: Minimize2 },
                                { id: 2, l: 'FLATTEN', i: Layers },
                                { id: 3, l: 'NOISE', i: Activity },
                                { id: 4, l: 'SMOOTH', i: Droplet },
                                { id: 5, l: 'TERRACE', i: AlignJustify },
                                { id: 6, l: 'CRATER', i: Target },
                                { id: 7, l: 'SHARPEN', i: Zap },
                                { id: 8, l: 'PINCH', i: Shrink },
                                { id: 9, l: 'TWIST', i: RotateCw }
                            ].map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => setSculptMode(t.id)}
                                    className={`p-3 border rounded flex flex-col items-center justify-center gap-2 transition-all group ${sculptMode === t.id ? 'bg-emerald-900/20 border-emerald-500 text-white' : 'bg-[#0a0a0a] text-gray-500 border-[#222] hover:border-gray-500'}`}
                                >
                                    <t.i size={16} className={sculptMode === t.id ? 'text-emerald-400' : 'text-gray-600 group-hover:text-gray-400'} />
                                    <span className="text-[9px] font-bold tracking-widest">{t.l}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="p-4 bg-[#0a0a0a] rounded border border-[#1a1a1a] space-y-5">
                        <div>
                            <div className="flex justify-between text-[10px] text-gray-500 mb-2 font-medium">Brush Radius</div>
                            <input type="range" min="0.01" max="0.5" step="0.01" value={brushSize} onChange={e => setBrushSize(parseFloat(e.target.value))} className="w-full h-1 bg-[#222] rounded-lg appearance-none accent-emerald-500 cursor-pointer" />
                        </div>
                        <div>
                            <div className="flex justify-between text-[10px] text-gray-500 mb-2 font-medium">Brush Force</div>
                            <input type="range" min="0.01" max="1.0" step="0.01" value={brushStrength} onChange={e => setBrushStrength(parseFloat(e.target.value))} className="w-full h-1 bg-[#222] rounded-lg appearance-none accent-lime-500 cursor-pointer" />
                        </div>
                    </div>
                </div>
            )
        }
    ];

    return (
        <KRightPanel
            isCollapsed={!isOpen}
            onCollapseChange={(collapsed) => setIsOpen(!collapsed)}
            activeTabId={activeTab}
            onTabChange={setActiveTab as any}
            tabs={tabs}
        />
    );
}
