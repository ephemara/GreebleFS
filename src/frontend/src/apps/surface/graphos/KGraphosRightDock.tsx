
import React, { useState, useEffect, useRef } from 'react';
import {
    Palette, Zap, Sliders, Grid, Sparkles, Droplet,
    RefreshCw, Copy, Plus, Trash2, Maximize2, Layers
} from 'lucide-react';
import { KPanel, KButton, KSlider } from '../../../core/ui';
import KGraphosMaterialDock from './KGraphosMaterialDock';
import KGraphosLayers from './KGraphosLayers';

// --- COLOR UTILS ---
const hexToHsl = (hex: string) => {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
        r = parseInt("0x" + hex[1] + hex[1]);
        g = parseInt("0x" + hex[2] + hex[2]);
        b = parseInt("0x" + hex[3] + hex[3]);
    } else if (hex.length === 7) {
        r = parseInt("0x" + hex[1] + hex[2]);
        g = parseInt("0x" + hex[3] + hex[4]);
        b = parseInt("0x" + hex[5] + hex[6]);
    }
    r /= 255; g /= 255; b /= 255;
    const cmin = Math.min(r, g, b), cmax = Math.max(r, g, b), delta = cmax - cmin;
    let h = 0, s = 0, l = 0;
    if (delta === 0) h = 0;
    else if (cmax === r) h = ((g - b) / delta) % 6;
    else if (cmax === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
    l = (cmax + cmin) / 2;
    s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
    s = +(s * 100).toFixed(1);
    l = +(l * 100).toFixed(1);
    return { h, s, l };
};

const hslToHex = (h: number, s: number, l: number) => {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
};

const generateHarmonies = (baseHex: string) => {
    const { h, s, l } = hexToHsl(baseHex);
    return {
        complementary: [hslToHex((h + 180) % 360, s, l)],
        triadic: [hslToHex((h + 120) % 360, s, l), hslToHex((h + 240) % 360, s, l)],
        analogous: [hslToHex((h + 30) % 360, s, l), hslToHex((h - 30 + 360) % 360, s, l)],
        split: [hslToHex((h + 150) % 360, s, l), hslToHex((h + 210) % 360, s, l)],
        monochromatic: [hslToHex(h, s, Math.max(0, l - 20)), hslToHex(h, s, Math.min(100, l + 20))],
        shades: [hslToHex(h, s, Math.max(0, l - 30)), hslToHex(h, s, Math.max(0, l - 15))],
        tints: [hslToHex(h, s, Math.min(100, l + 15)), hslToHex(h, s, Math.min(100, l + 30))]
    };
};

export default function KGraphosRightDock({
    brush, setBrush,
    projectMaterials, activeMaterial, setActiveMaterial,
    materialMode, setMaterialMode,
    materialChannels, setMaterialChannels,
    engineRef, onMaterialCommit,
    // Layer Props
    layers, activeLayerId, setActiveLayerId,
    onLayerAdd, onLayerDelete, onLayerVisibility, onLayerOpacity
}: any) {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [activeTab, setActiveTab] = useState(materialMode ? 'material' : 'color');
    const [harmonies, setHarmonies] = useState<any>(null);
    const [swatches, setSwatches] = useState<string[]>([
        '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff',
        '#ffffff', '#000000', '#808080', '#ff8000', '#8000ff', '#0080ff'
    ]);

    // Color Wheel State
    const wheelRef = useRef<HTMLDivElement>(null);
    const [isDraggingWheel, setIsDraggingWheel] = useState(false);

    // Auto-activate material mode when Material tab is selected
    useEffect(() => {
        if (activeTab === 'material') {
            setMaterialMode(true);
        } else if (activeTab === 'color') {
            setMaterialMode(false);
        }
    }, [activeTab, setMaterialMode]);

    useEffect(() => {
        setHarmonies(generateHarmonies(brush.color));
    }, [brush.color]);

    const handleWheelMove = (e: React.PointerEvent) => {
        if (!wheelRef.current || !isDraggingWheel) return;
        const rect = wheelRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const dx = e.clientX - centerX;
        const dy = e.clientY - centerY;

        let angle = Math.atan2(dy, dx) * (180 / Math.PI);
        if (angle < 0) angle += 360;
        const hue = angle;

        const dist = Math.min(Math.sqrt(dx * dx + dy * dy), rect.width / 2);
        const normalizedDist = dist / (rect.width / 2);

        // Tint Wheel Logic: Center = White (L=100), Edge = Pure Color (L=50, S=100)
        const s = 100 * normalizedDist;
        const l = 100 - (50 * normalizedDist);

        setBrush((prev: any) => ({ ...prev, color: hslToHex(hue, s, l) }));
    };

    const tabs = [
        { id: 'color', icon: Palette, label: 'COLOR', color: 'rose' },
        { id: 'material', icon: Layers, label: 'MATERIAL', color: 'purple' },
        { id: 'assets', icon: Grid, label: 'ASSETS', color: 'cyan' },
    ];

    return (
        <div className="flex-shrink-0 h-full border-l border-[#222]">
            <KPanel
                width="w-80"
                collapsible
                isCollapsed={isCollapsed}
                onCollapseChange={setIsCollapsed}
                collapsedContent={
                    <div className="flex flex-col gap-6 w-full items-center">
                        {tabs.map(t => (
                            <button key={t.id} onClick={() => setActiveTab(t.id)} className={`p-2 rounded-lg transition-all group relative ${activeTab === t.id ? `text-${t.color}-400 bg-${t.color}-900/20` : 'text-gray-500 hover:text-white hover:bg-[#222]'}`} title={t.label}>
                                <t.icon size={20} />
                                {activeTab === t.id && <div className={`absolute right-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-${t.color}-500 rounded-l-full -mr-2`} />}
                            </button>
                        ))}
                    </div>
                }
            >
                <div className="flex flex-col h-full">
                    {/* TOP SECTION: LAYERS */}
                    <div className="h-[35%] flex flex-col border-b border-[#222] bg-[#0c0c0c]">
                        <div className="p-2 flex-1 min-h-0">
                            <KGraphosLayers
                                layers={layers}
                                activeLayerId={activeLayerId}
                                setActiveLayerId={setActiveLayerId}
                                onAdd={onLayerAdd}
                                onDelete={onLayerDelete}
                                onToggleVisibility={onLayerVisibility}
                                onOpacityChange={onLayerOpacity}
                            />
                        </div>
                    </div>

                    {/* BOTTOM SECTION: TABS */}
                    <div className="flex-1 flex flex-col min-h-0">
                        {/* TABS HEADER */}
                        <div className="flex border-b border-[#222] bg-[#0f0f0f]">
                            {tabs.map(t => (
                                <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex-1 py-4 text-[9px] font-bold flex flex-col items-center gap-1 transition-all ${activeTab === t.id ? `text-${t.color}-400 bg-[#0a0a0a] border-b-2 border-${t.color}-500` : 'text-gray-600 hover:text-gray-300 hover:bg-[#111]'}`}>
                                    <t.icon size={14} /> {t.label}
                                </button>
                            ))}
                        </div>

                        <div className="flex-1 overflow-y-auto p-5 space-y-8 custom-scrollbar bg-[#0a0a0a]">

                            {activeTab === 'color' && (
                                <div className="space-y-6 animate-in slide-in-from-right-4">

                                    {/* MAIN COLOR WHEEL */}
                                    <div className="relative aspect-square w-full bg-[#111] rounded-xl border border-[#222] shadow-inner flex items-center justify-center overflow-hidden group">
                                        <div
                                            ref={wheelRef}
                                            className="w-56 h-56 rounded-full relative cursor-crosshair shadow-2xl"
                                            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setIsDraggingWheel(true); handleWheelMove(e); }}
                                            onPointerMove={handleWheelMove}
                                            onPointerUp={(e) => { e.currentTarget.releasePointerCapture(e.pointerId); setIsDraggingWheel(false); }}
                                        >
                                            <div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(from 90deg, red, yellow, lime, aqua, blue, magenta, red)` }} />
                                            <div className="absolute inset-0 rounded-full" style={{ background: `radial-gradient(circle, white 0%, transparent 70%)` }} />

                                            {/* Selector Puck */}
                                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full border-4 border-[#111] shadow-xl z-10" style={{ backgroundColor: brush.color }} />
                                        </div>

                                        {/* Hex Input */}
                                        <div className="absolute bottom-2 right-2 bg-black/50 backdrop-blur px-2 py-1 rounded text-[10px] font-mono text-gray-400 border border-white/10">
                                            {brush.color.toUpperCase()}
                                        </div>
                                    </div>

                                    {/* SLIDERS */}
                                    <div className="space-y-4 bg-[#111] p-4 rounded-xl border border-[#222]">
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-[9px] font-bold text-gray-500"><span>LIGHTNESS</span></div>
                                            <input
                                                type="range" min="0" max="100"
                                                value={hexToHsl(brush.color).l}
                                                onChange={(e) => {
                                                    const { h, s } = hexToHsl(brush.color);
                                                    setBrush((b: any) => ({ ...b, color: hslToHex(h, s, parseFloat(e.target.value)) }));
                                                }}
                                                className="w-full h-2 bg-gradient-to-r from-black via-gray-500 to-white rounded-full appearance-none accent-white"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-[9px] font-bold text-gray-500"><span>SATURATION</span></div>
                                            <input
                                                type="range" min="0" max="100"
                                                value={hexToHsl(brush.color).s}
                                                onChange={(e) => {
                                                    const { h, l } = hexToHsl(brush.color);
                                                    setBrush((b: any) => ({ ...b, color: hslToHex(h, parseFloat(e.target.value), l) }));
                                                }}
                                                className="w-full h-2 bg-gradient-to-r from-gray-500 to-rose-500 rounded-full appearance-none accent-rose-500"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-[9px] font-bold text-gray-500"><span>ANGLE</span><span>{Math.round((brush.angle || 0) * 180 / Math.PI)}°</span></div>
                                            <input
                                                type="range" min="0" max="360"
                                                value={(brush.angle || 0) * 180 / Math.PI}
                                                onChange={(e) => setBrush((b: any) => ({ ...b, angle: parseFloat(e.target.value) * Math.PI / 180 }))}
                                                className="w-full h-2 bg-[#222] rounded-full appearance-none accent-white"
                                            />
                                        </div>
                                    </div>

                                    {/* HARMONY GENERATOR (EXPERIMENTAL) */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold text-rose-500 flex items-center gap-2"><Sparkles size={12} /> HARMONY ENGINE</span>
                                            <button onClick={() => setHarmonies(generateHarmonies(brush.color))} className="text-gray-600 hover:text-white"><RefreshCw size={12} /></button>
                                        </div>

                                        {harmonies && (
                                            <div className="grid grid-cols-1 gap-2">
                                                {Object.entries(harmonies).map(([name, colors]: [string, any]) => (
                                                    <div key={name} className="flex items-center gap-2 bg-[#111] p-2 rounded border border-[#222] hover:border-rose-500/30 transition-all group">
                                                        <span className="text-[8px] font-bold text-gray-500 w-20 uppercase">{name}</span>
                                                        <div className="flex-1 flex gap-1">
                                                            {colors.map((c: string, i: number) => (
                                                                <button
                                                                    key={`${c}-${i}`}
                                                                    onClick={() => setBrush((b: any) => ({ ...b, color: c }))}
                                                                    className="h-6 flex-1 rounded border border-white/10 hover:scale-110 transition-transform shadow-sm"
                                                                    style={{ backgroundColor: c }}
                                                                    title={c}
                                                                />
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* SWATCHES */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold text-gray-500 flex items-center gap-2"><Grid size={12} /> SWATCHES</span>
                                            <button onClick={() => setSwatches([...swatches, brush.color])} className="text-gray-600 hover:text-rose-500"><Plus size={12} /></button>
                                        </div>
                                        <div className="grid grid-cols-6 gap-2">
                                            {swatches.map((c, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => setBrush((b: any) => ({ ...b, color: c }))}
                                                    onContextMenu={(e) => { e.preventDefault(); setSwatches(swatches.filter((_, idx) => idx !== i)); }}
                                                    className="aspect-square rounded-lg border border-white/10 hover:border-white hover:scale-110 transition-all shadow-sm relative group"
                                                    style={{ backgroundColor: c }}
                                                >
                                                    {brush.color === c && <div className="absolute inset-0 flex items-center justify-center"><div className="w-1.5 h-1.5 bg-white rounded-full shadow-md" /></div>}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                </div>
                            )}

                            {activeTab === 'material' && (
                                <KGraphosMaterialDock
                                    projectMaterials={projectMaterials}
                                    activeMaterial={activeMaterial}
                                    setActiveMaterial={setActiveMaterial}
                                    channels={materialChannels}
                                    setChannels={setMaterialChannels}
                                    brush={brush}
                                    engineRef={engineRef}
                                    onMaterialCommit={onMaterialCommit}
                                />
                            )}

                        </div>
                    </div>
                </div>
            </KPanel >
        </div >
    );
}
