
import React from 'react';
import {
    Box, FlaskConical, Grip, AlignVerticalDistributeCenter, Anchor, Settings, Flower, Square, Building2, MoreHorizontal, Network, GitMerge
} from 'lucide-react';
import { SHAPES } from './KGreebleEngine';

export default function KGreeblePrimitives({ activeShape, setActiveShape }: any) {
    return (
        <>
            <section>
                <div className="text-[10px] font-bold text-gray-500 uppercase mb-3 flex items-center gap-2 tracking-wider">
                    <Box size={12} /> Primitives
                </div>
                <div className="grid grid-cols-3 gap-2">
                    {Object.values(SHAPES).filter((s: any) => !['greeble', 'city', 'ruins', 'flora', 'tentacle', 'spine', 'chain', 'gear', 'swarm', 'struct', 'fractal'].includes(s)).map((s: any) => (
                        <button
                            key={s}
                            onClick={() => setActiveShape(s)}
                            className={`relative aspect-square rounded-xl border overflow-hidden group transition-all duration-200 ${activeShape === s ? 'border-emerald-500 ring-1 ring-emerald-500/50' : 'border-[#222] hover:border-[#333]'}`}
                        >
                            {/* Background Image Layer */}
                            <div className="absolute inset-0 bg-[#161616]" />
                            <div
                                className="absolute inset-2 bg-contain bg-center bg-no-repeat opacity-50 group-hover:opacity-80 transition-opacity duration-300 grayscale group-hover:grayscale-0"
                                style={{ backgroundImage: `url(/primitives/${s.toLowerCase()}.png)` }}
                            />

                            {/* Overlay Gradient for Text Readability */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-80" />

                            {/* Text Content */}
                            <div className="absolute inset-0 flex items-center justify-center z-10">
                                <span className={`text-[9px] font-bold uppercase tracking-widest ${activeShape === s ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`}>
                                    {s}
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            </section>

            <section className="mt-6">
                <div className="text-[10px] font-bold text-emerald-500 uppercase mb-3 flex items-center gap-2 tracking-wider animate-pulse">
                    <FlaskConical size={12} /> Experimental
                </div>
                <div className="grid grid-cols-2 gap-2">
                    {[
                        { id: SHAPES.TENTACLE, icon: Grip, label: 'BIO-TENTACLE' },
                        { id: SHAPES.SPINE, icon: AlignVerticalDistributeCenter, label: 'MECH-SPINE' },
                        { id: SHAPES.CHAIN, icon: Anchor, label: 'CHAIN-LINK' },
                        { id: SHAPES.GEAR, icon: Settings, label: 'TECH-GEAR' },
                        { id: SHAPES.FLORA, icon: Flower, label: 'ALIEN-FLORA' },
                        { id: SHAPES.RUINS, icon: Square, label: 'ANCIENT-RUINS' },
                        { id: SHAPES.CITY, icon: Building2, label: 'MEGA-CITY' },
                        { id: SHAPES.SWARM, icon: MoreHorizontal, label: 'NANO-SWARM' },
                        { id: SHAPES.STRUCT, icon: Network, label: 'STRUCTURE' },
                        { id: SHAPES.FRACTAL, icon: GitMerge, label: 'FRACTAL' }
                    ].map(s => (
                        <button
                            key={s.id}
                            onClick={() => setActiveShape(s.id)}
                            className={`relative py-3 rounded-xl border overflow-hidden group transition-all duration-200 ${activeShape === s.id ? 'border-emerald-500 ring-1 ring-emerald-500/50' : 'border-[#222] bg-[#161616] text-gray-500 hover:border-[#333]'}`}
                        >
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="relative z-10 flex flex-col items-center justify-center gap-1">
                                <s.icon size={14} className={`${activeShape === s.id ? 'text-emerald-400' : 'text-gray-500 group-hover:text-emerald-400'} transition-colors`} />
                                <span className={`text-[9px] font-bold ${activeShape === s.id ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`}>{s.label}</span>
                            </div>
                        </button>
                    ))}
                </div>
            </section>
        </>
    );
}
