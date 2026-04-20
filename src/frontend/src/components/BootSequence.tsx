import React from 'react';
import { Terminal } from 'lucide-react';

export default function BootSequence() {
    return (
        <div className="flex items-center justify-center w-screen h-screen text-[#00ffcc] font-mono" style={{ backgroundColor: '#000000' }}>
            <div className="flex flex-col items-center gap-4">
                <Terminal size={48} className="animate-pulse" />
                <div className="text-xs tracking-[0.5em] animate-pulse">K-OS KERNEL LOADING...</div>
            </div>
        </div>
    );
}

