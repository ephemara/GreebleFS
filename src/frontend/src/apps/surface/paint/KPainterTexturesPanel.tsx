import React, { useRef, useMemo } from 'react';
import { usePainter } from './PainterContext';
import { Download, Palette, Layers as LayersIcon, Box } from 'lucide-react';

// Channel display config
const CHANNELS = [
    { id: 'albedo', label: 'Albedo', color: '#f87171' },
    { id: 'normal', label: 'Normal', color: '#60a5fa' },
    { id: 'roughness', label: 'Roughness', color: '#a78bfa' },
    { id: 'metalness', label: 'Metalness', color: '#fbbf24' },
    { id: 'emission', label: 'Emission', color: '#34d399' }
];

export default function KPainterTexturesPanel({ engineRef }: { engineRef?: React.MutableRefObject<any> }) {
    const { handleExportTextures, activeSetId } = usePainter();

    // Get composite layer textures from active set
    const channelTextures = useMemo(() => {
        if (!engineRef?.current?.textureSetData || !activeSetId) return [];
        const set = engineRef.current.textureSetData[activeSetId];
        if (!set?.compositeLayer) return [];

        return CHANNELS.map(ch => {
            const target = set.compositeLayer.getRead(ch.id);
            const texture = target?.texture;
            return {
                ...ch,
                texture,
                // Create data URL for preview if texture exists
                preview: texture?.image?.src || null
            };
        });
    }, [engineRef, activeSetId]);

    return (
        <div className="flex flex-col h-full bg-[#111]">
            {/* Header */}
            <div className="p-3 border-b border-[#222] bg-[#1a1a1a]">
                <div className="flex items-center gap-2 text-white font-bold text-xs tracking-wider">
                    <Palette size={14} className="text-[#3daee9]" />
                    ACTIVE TEXTURES
                </div>
                <div className="text-[10px] text-gray-500 mt-1">
                    {activeSetId || 'No texture set selected'}
                </div>
            </div>

            {/* Channel Grid */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                {channelTextures.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-600 space-y-2 opacity-50">
                        <Box size={32} />
                        <span className="text-xs">No Active Texture Set</span>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {channelTextures.map((ch) => (
                            <div
                                key={ch.id}
                                className="flex items-center gap-3 p-2 bg-[#1a1a1a] rounded border border-[#222] hover:border-[#3daee9]/50 transition-colors"
                            >
                                {/* Color indicator */}
                                <div
                                    className="w-3 h-3 rounded-full shrink-0"
                                    style={{ backgroundColor: ch.color }}
                                />

                                {/* Label */}
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-medium text-white truncate">
                                        {ch.label}
                                    </div>
                                    <div className="text-[10px] text-gray-500">
                                        {ch.texture ? '2048×2048' : 'Empty'}
                                    </div>
                                </div>

                                {/* Status indicator */}
                                <div className={`w-2 h-2 rounded-full ${ch.texture ? 'bg-green-500' : 'bg-gray-600'}`} />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Export Button */}
            <div className="p-3 border-t border-[#222] bg-[#1a1a1a]">
                <button
                    onClick={handleExportTextures}
                    className="w-full bg-[#3daee9] hover:bg-[#3daee9]/80 text-black font-bold text-xs py-2.5 px-4 rounded flex items-center justify-center gap-2 transition-colors"
                >
                    <Download size={14} />
                    <span>EXPORT ALL</span>
                </button>
            </div>
        </div>
    );
}
