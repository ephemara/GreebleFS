
import { Hammer, ChevronRight } from 'lucide-react';
import { BRUSHES } from './KSculptConstants';

export default function KSculptBrushes({ activeTool, setActiveTool, toggleBrushMenu }: any) {
    const currentBrush = BRUSHES.find(b => b.id === activeTool) || BRUSHES[1];

    return (
        <div className="space-y-3">
            <button
                onClick={toggleBrushMenu}
                className="w-full aspect-[4/3] bg-[#000] border border-[#333] hover:border-orange-500 rounded-xl flex flex-col items-center justify-center gap-2 group transition-all text-gray-400 hover:text-white shadow-xl relative overflow-hidden"
            >
                {/* Background Decor */}
                <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                {/* Active Brush Icon - Large */}
                <currentBrush.icon size={48} className="text-gray-500 group-hover:text-orange-500 transition-colors" opacity={0.8} />

                <div className="flex flex-col items-center">
                    <span className="text-[14px] font-black uppercase tracking-wide group-hover:text-orange-400">{currentBrush.label}</span>
                </div>

                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ChevronRight size={14} className="text-orange-500" />
                </div>
            </button >
        </div >
    );
}
