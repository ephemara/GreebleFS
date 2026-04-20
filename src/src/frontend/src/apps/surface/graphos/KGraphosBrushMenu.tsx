
import React, { useEffect, useRef, useState } from 'react';
import {
    Brush, Eraser, PenTool, Highlighter, Square,
    Droplet, PaintBucket, Shuffle, X, Lock, Unlock, Sparkles
} from 'lucide-react';

const SYMMETRY_MODES = [
    { id: 'NONE', label: 'OFF' },
    { id: 'X', label: 'X-AXIS' },
    { id: 'Y', label: 'Y-AXIS' },
    { id: 'RADIAL', label: 'RADIAL' }
];

// --- COLOR CONVERSION UTILS ---
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

const ICON_MAP: any = {
    'PenTool': PenTool,
    'Brush': Brush,
    'Square': Square,
    'Highlighter': Highlighter,
    'Droplet': Droplet,
    'Eraser': Eraser,
    'Shuffle': Shuffle,
    'PaintBucket': PaintBucket,
    'Star': Sparkles // Fallback/New
};

export default function KGraphosBrushMenu({ visible, position, brush, setBrush, onSelect, brushes, ...props }: any) {
    const [colorState, setColorState] = useState({ h: 0, s: 100, l: 50 });
    const wheelRef = useRef<HTMLDivElement>(null);
    const isDraggingRef = useRef(false);

    useEffect(() => {
        if (visible) {
            // Reset drag state on show
            isDraggingRef.current = false;
        }
    }, [visible]);

    // Handle Color Wheel Interaction
    const handleWheelMove = (e: React.PointerEvent) => {
        if (!wheelRef.current || !isDraggingRef.current) return;
        const rect = wheelRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const dx = e.clientX - centerX;
        const dy = e.clientY - centerY;

        // Angle = Hue
        let angle = Math.atan2(dy, dx) * (180 / Math.PI);
        if (angle < 0) angle += 360;
        const hue = angle; // Match CSS gradient (Red at 3 o'clock)

        // Distance = Saturation/Lightness mix (Simplified)
        const dist = Math.min(Math.sqrt(dx * dx + dy * dy), rect.width / 2);
        const normalizedDist = dist / (rect.width / 2);

        // Inner circle for Lightness/Saturation
        // Center = White (L=100), Edge = Pure Color (L=50, S=100)
        const lit = 100 - (normalizedDist * 50);

        const hex = hslToHex(hue, 100, lit);
        setColorState({ h: hue, s: 100, l: lit });
        setBrush((prev: any) => ({ ...prev, color: hex }));
    };

    if (!visible) return null;

    const style = {
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -50%)'
    };

    const radius = 150; // Distance of brushes from center
    const buttonSize = 48;
    const brushList = brushes || [];

    const handlePreset = (preset: any) => {
        setBrush((prev: any) => ({
            ...prev,
            hardness: preset.hardness,
            flow: preset.flow,
            opacity: preset.opacity,
            erase: preset.id === 'ERASE',
            tool: preset.id,
            jitterPos: preset.id === 'SCATTER' ? 1.0 : 0.0,
            jitterSize: preset.id === 'SCATTER' ? 0.5 : 0.0,
            alphaMap: preset.alphaMap ? preset.alphaMap : prev.alphaMap // Apply alpha if present
        }));
        onSelect();
    };

    return (
        <div
            className="fixed z-[100] pointer-events-none" // Container is pass-through, children capture events
            style={style}
        >
            {/* BACKDROP CLICK CATCHER */}
            <div className="fixed inset-[-100vw] bg-black/10 pointer-events-auto" onClick={onSelect} onContextMenu={(e) => { e.preventDefault(); onSelect(); }} />

            <div className="relative w-0 h-0 animate-in zoom-in duration-200 ease-out">

                {/* COLOR WHEEL CORE */}
                <div
                    className="absolute -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full pointer-events-auto shadow-[0_0_50px_rgba(0,0,0,0.8)] border-4 border-[#222] overflow-hidden group cursor-crosshair"
                    ref={wheelRef}
                    onPointerDown={(e) => {
                        e.stopPropagation();
                        isDraggingRef.current = true;
                        e.currentTarget.setPointerCapture(e.pointerId);
                        handleWheelMove(e);
                    }}
                    onPointerMove={handleWheelMove}
                    onPointerUp={(e) => {
                        isDraggingRef.current = false;
                        e.currentTarget.releasePointerCapture(e.pointerId);
                    }}
                >
                    {/* CONIC GRADIENT (HUE) */}
                    <div className="absolute inset-0" style={{ background: `conic-gradient(from 90deg, red, yellow, lime, aqua, blue, magenta, red)` }} />
                    {/* RADIAL GRADIENT (SATURATION/LIGHTNESS MOCK) */}
                    <div className="absolute inset-0" style={{ background: `radial-gradient(circle, white 0%, transparent 70%)` }} />

                    {/* CURRENT COLOR INDICATOR */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-12 h-12 rounded-full shadow-lg border-2 border-white/20 backdrop-blur-sm" style={{ backgroundColor: brush.color }} />
                    </div>
                </div>

                {/* ORBITAL BRUSHES */}
                {brushList.map((b: any, i: number) => {
                    const angle = (i / brushList.length) * 2 * Math.PI - (Math.PI / 2); // Start top
                    const bx = Math.cos(angle) * radius;
                    const by = Math.sin(angle) * radius;
                    const isActive = (brush.erase && b.id === 'ERASE') || (!brush.erase && brush.tool === b.id);
                    const Icon = ICON_MAP[b.icon] || Brush;

                    return (
                        <button
                            key={b.id}
                            onClick={(e) => { e.stopPropagation(); handlePreset(b); }}
                            className={`
                                absolute w-12 h-12 rounded-full border-2 flex items-center justify-center pointer-events-auto transition-all duration-200 hover:scale-110
                                ${isActive
                                    ? 'bg-rose-600 text-white border-white shadow-[0_0_20px_#e11d48]'
                                    : 'bg-[#111]/90 border-[#333] text-gray-400 hover:border-rose-500 hover:text-rose-500'
                                }
                            `}
                            style={{
                                transform: `translate(calc(${bx}px - 50%), calc(${by}px - 50%))`
                            }}
                            title={b.label}
                        >
                            <Icon size={20} />
                        </button>
                    );
                })}

                {/* SETTINGS PANEL (RIGHT SIDE) */}
                <div
                    className="absolute pointer-events-auto flex flex-col gap-4"
                    style={{
                        left: '220px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: '180px'
                    }}
                >
                    {/* SLIDERS */}
                    <div className="flex flex-col gap-3">
                        <div className="space-y-1">
                            <div className="flex justify-between text-[9px] font-bold text-gray-400">
                                <span>SIZE</span>
                                <span>{brush.size.toFixed(0)}px</span>
                            </div>
                            <input
                                type="range" min="1" max="300"
                                value={brush.size}
                                onChange={(e) => setBrush((b: any) => ({ ...b, size: parseFloat(e.target.value) }))}
                                className="w-full h-1.5 bg-black/50 rounded-full appearance-none accent-rose-500 backdrop-blur-sm border border-white/10"
                            />
                        </div>
                        <div className="space-y-1">
                            <div className="flex justify-between text-[9px] font-bold text-gray-400">
                                <span>OPACITY</span>
                                <span>{(brush.opacity * 100).toFixed(0)}%</span>
                            </div>
                            <input
                                type="range" min="0" max="1" step="0.01"
                                value={brush.opacity}
                                onChange={(e) => setBrush((b: any) => ({ ...b, opacity: parseFloat(e.target.value) }))}
                                className="w-full h-1.5 bg-black/50 rounded-full appearance-none accent-rose-500 backdrop-blur-sm border border-white/10"
                            />
                        </div>
                    </div>

                    {/* SYMMETRY */}
                    <div className="space-y-2 pt-2">
                        <span className="text-[9px] font-bold text-gray-500 tracking-wider">SYMMETRY</span>
                        <div className="grid grid-cols-2 gap-2">
                            {SYMMETRY_MODES.map(m => (
                                <button
                                    key={m.id}
                                    onClick={() => setBrush((b: any) => ({ ...b, symmetry: m.id }))}
                                    className={`
                                        text-[9px] py-2 px-2 rounded-lg border backdrop-blur-md transition-all
                                        ${brush.symmetry === m.id
                                            ? 'bg-rose-500/20 border-rose-500 text-rose-100 shadow-[0_0_10px_rgba(225,29,72,0.3)]'
                                            : 'bg-black/40 border-white/10 text-gray-400 hover:bg-white/5 hover:text-white'
                                        }
                                    `}
                                >
                                    {m.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="text-[9px] text-rose-500/50 text-right font-mono pt-2 flex justify-between items-center">
                        <button
                            onClick={props.onToggleLock}
                            className={`p-1 rounded hover:bg-rose-900/30 transition-colors ${props.isLocked ? 'text-rose-400' : 'text-gray-600'}`}
                            title={props.isLocked ? "Unlock Menu" : "Lock Menu Open"}
                        >
                            {props.isLocked ? <Lock size={10} /> : <Unlock size={10} />}
                        </button>
                        <span>{brush.tool} // {brush.symmetry}</span>
                    </div>
                </div>

            </div>
        </div>
    );
}

