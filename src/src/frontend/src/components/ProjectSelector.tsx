import React from 'react';
import { Hexagon, FilePlus, FolderOpen, Loader2 } from 'lucide-react';

interface ProjectSelectorProps {
    isOpen: boolean;
    isProjectLoading: boolean;
    onNewProject: () => void;
    onLoadProject: (file: File) => void;
}

export default function ProjectSelector({
    isOpen,
    isProjectLoading,
    onNewProject,
    onLoadProject
}: ProjectSelectorProps) {
    if (!isOpen) return null;

    return (
        <div className="absolute inset-0 z-[200] backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-500" style={{ backgroundColor: 'rgba(0,0,0,0.98)' }}>
            <div className="w-full max-w-2xl bg-[#0a0a0a] border border-[#222] rounded-2xl shadow-2xl overflow-hidden p-8 relative">
                <div className="flex flex-col items-center justify-center mb-8">
                    <Hexagon size={48} className="text-[#00ffcc] fill-[#00ffcc]/10 mb-4 animate-spin-slow"/>
                    <h1 className="text-2xl font-black text-white tracking-[0.3em]">KIPP ENGINE</h1>
                    <div className="text-[10px] text-gray-500 font-mono mt-2">WORKSPACE SELECTOR</div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <button
                        onClick={onNewProject}
                        className="group relative h-48 bg-[#111] border border-[#333] hover:border-[#00ffcc] rounded-xl p-6 flex flex-col items-center justify-center gap-4 transition-all hover:bg-[#00ffcc]/5"
                    >
                        <div className="w-16 h-16 rounded-full bg-[#222] group-hover:bg-[#00ffcc] text-gray-400 group-hover:text-black flex items-center justify-center transition-all shadow-xl">
                            <FilePlus size={32}/>
                        </div>
                        <div className="text-center">
                            <div className="text-sm font-bold text-white group-hover:text-[#00ffcc]">INITIALIZE NEW KERNEL</div>
                            <div className="text-[10px] text-gray-500 mt-1">Start with a clean slate</div>
                        </div>
                    </button>

                    <div className="relative group h-48 bg-[#111] border border-[#333] hover:border-purple-500 rounded-xl p-6 flex flex-col items-center justify-center gap-4 transition-all hover:bg-purple-900/10">
                        <input
                            type="file"
                            accept=".kipp"
                            onChange={(e) => e.target.files?.[0] && onLoadProject(e.target.files[0])}
                            className="absolute inset-0 opacity-0 cursor-pointer z-10"
                        />
                        <div className="w-16 h-16 rounded-full bg-[#222] group-hover:bg-purple-500 text-gray-400 group-hover:text-white flex items-center justify-center transition-all shadow-xl">
                            {isProjectLoading ? <Loader2 size={32} className="animate-spin"/> : <FolderOpen size={32}/>}
                        </div>
                        <div className="text-center">
                            <div className="text-sm font-bold text-white group-hover:text-purple-400">
                                {isProjectLoading ? "DECOMPRESSING..." : "MOUNT ARCHIVE"}
                            </div>
                            <div className="text-[10px] text-gray-500 mt-1">Load .KIPP Project File</div>
                        </div>
                    </div>
                </div>

                <div className="mt-8 text-center text-[9px] text-gray-600 font-mono">
                    v9.0.2 // SECURE CONNECTION ESTABLISHED
                </div>
            </div>
        </div>
    );
}

