import React, { useState, useEffect, useCallback } from 'react';
import { Layers, Activity, Maximize, Move, Circle, Wind, Zap } from 'lucide-react';

interface KGreebleDeformPanelProps {
    deformParams: any;
    setDeformParams: (params: any) => void;
    activeLayerName: string;
}

// Optimized Slider Component to prevent "React Glitch" on heavy updates
const DeformSlider = ({ label, icon: Icon, value, onChange, min, max, step, color = "text-gray-400", accent = "accent-white" }: any) => {
    const [localValue, setLocalValue] = useState(value);

    // Sync with parent when prop changes (e.g. Reset or Layer Switch)
    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = parseFloat(e.target.value);
        setLocalValue(newValue); // Instant UI update
        onChange(newValue); // Trigger parent update
    };

    return (
        <div className="space-y-1">
            <div className="flex justify-between text-[9px] font-bold">
                <div className={`flex items-center gap-1.5 ${color}`}>
                    {Icon && <Icon size={10} />}
                    {label}
                </div>
                <span className={color}>{localValue?.toFixed(2)}</span>
            </div>
            <input 
                type="range" 
                min={min} max={max} step={step} 
                value={localValue} 
                onChange={handleChange} 
                className={`w-full h-1 bg-[#1a1a1a] rounded-lg appearance-none ${accent}`} 
            />
        </div>
    );
};

export default function KGreebleDeformPanel({ deformParams, setDeformParams, activeLayerName }: KGreebleDeformPanelProps) {
    
    const update = useCallback((key: string, value: number) => {
        setDeformParams({ ...deformParams, [key]: value });
    }, [deformParams, setDeformParams]);

    const reset = () => {
        setDeformParams({
            inflate: 0,
            taper: 0,
            twist: 0,
            bend: 0,
            spherize: 0,
            noise: 0
        });
    };

    return (
        <div className="flex-1 p-4 bg-[#0a0a0a] space-y-5 animate-in fade-in slide-in-from-right-4">
            <div className="flex items-center justify-between border-b border-[#222] pb-2">
                <div className="text-[10px] font-bold text-yellow-500 uppercase tracking-wider flex items-center gap-2">
                    <Layers size={12} /> {activeLayerName} Deform
                </div>
                <button 
                    onClick={reset}
                    className="text-[8px] font-bold text-gray-600 hover:text-white bg-[#161616] px-2 py-1 rounded border border-[#222] hover:border-gray-500 transition-colors"
                >
                    RESET ALL
                </button>
            </div>

            <div className="space-y-4">
                <DeformSlider 
                    label="INFLATE" icon={Maximize} 
                    value={deformParams.inflate || 0} 
                    onChange={(v: number) => update('inflate', v)} 
                    min={-5} max={5} step={0.1} 
                    color="text-blue-400" accent="accent-blue-500" 
                />
                <DeformSlider 
                    label="TAPER" icon={Move} 
                    value={deformParams.taper || 0} 
                    onChange={(v: number) => update('taper', v)} 
                    min={-2} max={2} step={0.01} 
                    color="text-green-400" accent="accent-green-500" 
                />
                <DeformSlider 
                    label="TWIST" icon={Activity} 
                    value={deformParams.twist || 0} 
                    onChange={(v: number) => update('twist', v)} 
                    min={-5} max={5} step={0.1} 
                    color="text-purple-400" accent="accent-purple-500" 
                />
                <DeformSlider 
                    label="BEND" icon={Wind} 
                    value={deformParams.bend || 0} 
                    onChange={(v: number) => update('bend', v)} 
                    min={-2} max={2} step={0.01} 
                    color="text-orange-400" accent="accent-orange-500" 
                />
                <DeformSlider 
                    label="SPHERIZE" icon={Circle} 
                    value={deformParams.spherize || 0} 
                    onChange={(v: number) => update('spherize', v)} 
                    min={0} max={1} step={0.01} 
                    color="text-cyan-400" accent="accent-cyan-500" 
                />
                <DeformSlider 
                    label="NOISE" icon={Zap} 
                    value={deformParams.noise || 0} 
                    onChange={(v: number) => update('noise', v)} 
                    min={0} max={2} step={0.01} 
                    color="text-red-400" accent="accent-red-500" 
                />
            </div>

            <div className="p-3 bg-yellow-900/10 border border-yellow-900/30 rounded text-[9px] text-yellow-500/80 italic text-center">
                Deformations apply to all objects in this layer individually.
            </div>
        </div>
    );
}