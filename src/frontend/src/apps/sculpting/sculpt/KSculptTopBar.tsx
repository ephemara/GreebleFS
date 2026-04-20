import React from 'react';
import {
    Scan, Split, Palette
} from 'lucide-react';
import { MATCAPS } from './KSculptMatCaps';

export default function KSculptTopBar({
    radius, setRadius,
    intensity, setIntensity,
    wireframe, setWireframe,
    symmetry, setSymmetry,
    currentMatCap, setCurrentMatCap
}: any) {
    return (
        <div className="absolute top-4 left-4 right-4 h-12 bg-[#111]/80 backdrop-blur-md border border-[#333]/50 rounded-xl flex items-center justify-between px-6 z-40 shadow-2xl animate-in slide-in-from-top-2">

            {/* LEFT: BRUSH SETTINGS */}
            <div className="flex items-center gap-8">
                {/* RADIUS */}
                <div className="flex flex-col w-32 gap-1 group">
                    <div className="flex justify-between text-[8px] font-bold text-gray-500 uppercase tracking-wider group-hover:text-gray-300 transition-colors">
                        <span>Radius</span> <span className="text-orange-400">{radius.toFixed(2)}</span>
                    </div>
                    <input
                        type="range" min="0.05" max="2.0" step="0.05"
                        value={radius}
                        onChange={(e) => setRadius(parseFloat(e.target.value))}
                        className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer accent-orange-500 hover:accent-orange-400"
                    />
                </div>

                {/* INTENSITY */}
                <div className="flex flex-col w-32 gap-1 group">
                    <div className="flex justify-between text-[8px] font-bold text-gray-500 uppercase tracking-wider group-hover:text-gray-300 transition-colors">
                        <span>Intensity</span> <span className="text-orange-400">{intensity.toFixed(2)}</span>
                    </div>
                    <input
                        type="range" min="0.1" max="1.0" step="0.05"
                        value={intensity}
                        onChange={(e) => setIntensity(parseFloat(e.target.value))}
                        className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer accent-orange-500 hover:accent-orange-400"
                    />
                </div>
            </div>

            {/* CENTER: MATCAP SELECTOR */}
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-[#0a0a0a] p-1 rounded-lg border border-[#222]">
                    {Object.values(MATCAPS).map((mc) => (
                        <button
                            key={mc}
                            onClick={() => setCurrentMatCap(mc)}
                            className={`px-3 py-1 rounded text-[9px] font-bold transition-all ${currentMatCap === mc ? 'bg-[#333] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            {mc.replace('_', ' ')}
                        </button>
                    ))}
                </div>
            </div>

            {/* RIGHT: TOGGLES */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => setSymmetry(symmetry === 'X' ? 'NONE' : 'X')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-[9px] font-bold transition-all border ${symmetry === 'X' ? 'bg-blue-900/20 text-blue-400 border-blue-500' : 'bg-transparent text-gray-500 border-transparent hover:text-white'}`}
                >
                    <Split size={12} /> {symmetry === 'X' ? 'SYM: X' : 'SYM: OFF'}
                </button>

                <div className="h-6 w-px bg-[#333]"></div>

                <button
                    onClick={() => setWireframe(!wireframe)}
                    className={`p-2 rounded border transition-all ${wireframe ? 'bg-orange-900/20 text-orange-400 border-orange-500' : 'bg-[#1a1a1a] text-gray-500 border-transparent hover:text-white'}`}
                    title="Toggle Wireframe (W)"
                >
                    <Scan size={14} />
                </button>
            </div>
        </div>
    );
}
