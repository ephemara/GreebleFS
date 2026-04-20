import React from 'react';
import { Share2, RotateCw, Merge, LayoutGrid, CheckCircle2, Circle } from 'lucide-react';
import KTopBar from '../../../core/ui/KPanelV2/KTopBar';

interface KScatterTopBarProps {
    objectCount: number;
    setObjectCount: (v: number) => void;
    scatterRadius: number;
    setScatterRadius: (v: number) => void;
    minScale: number;
    setMinScale: (v: number) => void;
    maxScale: number;
    setMaxScale: (v: number) => void;
    autoRotate: boolean;
    setAutoRotate: (v: boolean) => void;
    weldGeometry: boolean;
    setWeldGeometry: (v: boolean) => void;
    distributionEnabled: boolean;
    setDistributionEnabled: (v: boolean) => void;
    onUplink: () => void;
}

export default function KScatterTopBar({
    objectCount, setObjectCount,
    scatterRadius, setScatterRadius,
    minScale, setMinScale,
    maxScale, setMaxScale,
    autoRotate, setAutoRotate,
    weldGeometry, setWeldGeometry,
    distributionEnabled, setDistributionEnabled,
    onUplink
}: KScatterTopBarProps) {
    return (
        <KTopBar
            onUplink={onUplink}
            themeColor="#ec4899" // Pink theme for KScatter
            leftContent={
                <>
                    {/* DENSITY */}
                    <div className="flex flex-col w-24 gap-1 group">
                        <div className="flex justify-between text-[8px] font-bold text-gray-500 uppercase tracking-wider group-hover:text-gray-300 transition-colors">
                            <span>Density</span> <span className="text-pink-400">{objectCount}</span>
                        </div>
                        <input
                            type="range" min="10" max="2000" step="10"
                            value={objectCount}
                            onChange={(e) => setObjectCount(parseInt(e.target.value))}
                            className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer accent-pink-500"
                        />
                    </div>

                    {/* SPREAD */}
                    <div className="flex flex-col w-24 gap-1 group">
                        <div className="flex justify-between text-[8px] font-bold text-gray-500 uppercase tracking-wider group-hover:text-gray-300 transition-colors">
                            <span>Spread</span> <span className="text-pink-400">{scatterRadius.toFixed(1)}</span>
                        </div>
                        <input
                            type="range" min="0.5" max="20" step="0.5"
                            value={scatterRadius}
                            onChange={(e) => setScatterRadius(parseFloat(e.target.value))}
                            className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer accent-pink-500"
                        />
                    </div>

                    <div className="h-6 w-px bg-[#333] mx-2"></div>

                    {/* SCALE RANGE */}
                    <div className="flex items-center gap-2">
                        <div className="flex flex-col w-16 gap-1 group">
                            <div className="flex justify-between text-[8px] font-bold text-gray-500 uppercase tracking-wider group-hover:text-gray-300 transition-colors">
                                <span>Min</span> <span className="text-cyan-400">{minScale.toFixed(2)}</span>
                            </div>
                            <input
                                type="range" min="0.01" max="0.5" step="0.01"
                                value={minScale}
                                onChange={(e) => setMinScale(parseFloat(e.target.value))}
                                className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer accent-cyan-500"
                            />
                        </div>
                        <div className="flex flex-col w-16 gap-1 group">
                            <div className="flex justify-between text-[8px] font-bold text-gray-500 uppercase tracking-wider group-hover:text-gray-300 transition-colors">
                                <span>Max</span> <span className="text-cyan-400">{maxScale.toFixed(2)}</span>
                            </div>
                            <input
                                type="range" min="0.1" max="2.0" step="0.1"
                                value={maxScale}
                                onChange={(e) => setMaxScale(parseFloat(e.target.value))}
                                className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer accent-cyan-500"
                            />
                        </div>
                    </div>
                </>
            }
            rightContent={
                <>
                    {/* AUTO-ROTATE */}
                    <button
                        onClick={() => setAutoRotate(!autoRotate)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded text-[9px] font-bold transition-all border ${autoRotate
                            ? 'bg-pink-900/20 border-pink-500 text-pink-400'
                            : 'bg-[#1a1a1a] border-[#333] text-gray-500 hover:text-white'
                            }`}
                    >
                        <RotateCw size={12} className={autoRotate ? "animate-spin" : ""} />
                        SPIN
                    </button>

                    <div className="h-6 w-px bg-[#333]"></div>

                    {/* WELD GEOMETRY */}
                    <button
                        onClick={() => setWeldGeometry(!weldGeometry)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded text-[9px] font-bold transition-all border ${weldGeometry
                            ? 'bg-emerald-900/20 border-emerald-500 text-emerald-400'
                            : 'bg-[#1a1a1a] border-[#333] text-gray-500 hover:text-white'
                            }`}
                    >
                        <Merge size={12} />
                        {weldGeometry ? 'WELD' : 'INST'}
                    </button>

                    {/* DISTRIBUTION */}
                    <button
                        onClick={() => setDistributionEnabled(!distributionEnabled)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded text-[9px] font-bold transition-all border ${distributionEnabled
                            ? 'bg-cyan-900/20 border-cyan-500 text-cyan-400'
                            : 'bg-[#1a1a1a] border-[#333] text-gray-500 hover:text-white'
                            }`}
                    >
                        {distributionEnabled ? <CheckCircle2 size={12} /> : <Circle size={12} />}
                        R-ROBIN
                    </button>
                </>
            }
        />
    );
}
