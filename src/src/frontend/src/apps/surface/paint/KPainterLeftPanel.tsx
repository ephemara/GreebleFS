import React from 'react';
import { Paintbrush, Hexagon, Scan } from 'lucide-react';
import { KLeftPanel } from '../../../core/ui/KPanelV2';
import KPainterMats from './KPainterMats';
import KPainterAlphas from './KPainterAlphas';

export default function KPainterLeftPanel({
    activeTab, setActiveTab,
    // Brush
    brush, setBrush,
    // Mats
    projectMaterials, activeMaterial, setActiveMaterial, handleChangeMesh, handleExport,
    // Alphas
    alphas, handleGenerateAlpha, handleImportAlpha, isGeneratingAlpha, alphaPrompt, setAlphaPrompt
}: any) {

    // Panel Actions
    const actions = [
        {
            id: 'BRUSH',
            label: 'Brush',
            icon: Paintbrush,
            onClick: () => setActiveTab('BRUSH'),
            active: activeTab === 'BRUSH'
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
                    <div className="flex items-center gap-2 text-[#3daee9] mb-1">
                        <Paintbrush size={16} />
                        <span className="font-black tracking-[0.2em] text-xs">K-PAINTER</span>
                    </div>
                    <div className="text-[9px] text-gray-600 uppercase tracking-widest">PBR Texture Engine</div>
                </div>

                {/* CONTENT AREA - SPLIT VIEW */}
                <div className="flex-1 flex flex-col min-h-0">

                    {/* TOP HALF: BRUSH SETTINGS & ALPHAS (Scrollable) */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
                        {/* BRUSH MODE INDICATOR */}
                        <div className="space-y-4">
                            <div className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2 tracking-wider"><Paintbrush size={12} /> Brush Engine</div>

                            {/* ALPHAS */}
                            <KPainterAlphas
                                alphas={alphas}
                                activeAlpha={brush.alphaMap}
                                onSelect={(alpha: any) => setBrush((prev: any) => ({ ...prev, alphaMap: alpha ? alpha.texture : null }))}
                                handleGenerateAlpha={handleGenerateAlpha}
                                handleImportAlpha={handleImportAlpha}
                                isGeneratingAlpha={isGeneratingAlpha}
                                alphaPrompt={alphaPrompt}
                                setAlphaPrompt={setAlphaPrompt}
                            />
                        </div>
                    </div>

                    {/* BOTTOM HALF: MATERIALS (Always Visible) */}
                    <div className="h-1/3 min-h-[200px] border-t border-[#333] flex flex-col bg-[#111]">
                        <KPainterMats
                            projectMaterials={projectMaterials}
                            activeMaterial={activeMaterial}
                            onSelect={setActiveMaterial}
                            onChangeMesh={handleChangeMesh}
                            onExport={handleExport}
                        />
                    </div>

                </div>
            </div>
        </KLeftPanel>
    );
}
