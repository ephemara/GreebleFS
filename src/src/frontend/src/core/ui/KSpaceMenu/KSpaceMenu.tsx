import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';

export interface SpaceMenuItem {
    id: string;
    label: string;
    icon: any; // Lucide Icon or React Component
    desc: string;
    onClick?: () => void;
    disabled?: boolean;
}

export interface SpaceMenuSlider {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    onChange: (val: number) => void;
    colorClass?: string; // Valid Tailwind text color class e.g "text-orange-600"
    accentClass?: string; // Valid Tailwind accent color class e.g "accent-orange-500"
}

export interface KSpaceMenuProps {
    visible: boolean;
    position: { x: number, y: number } | null;
    title?: React.ReactNode;

    // Items
    items: SpaceMenuItem[];
    activeItemId?: string;
    onItemSelect: (id: string) => void;

    // Sliders (Optional)
    sliders?: SpaceMenuSlider[];

    // Header Actions (Custom Buttons like Lock/Sim Toggle)
    headerActions?: React.ReactNode;

    // Footer Actions
    onReset?: () => void;

    className?: string;
}

export default function KSpaceMenu({
    visible, position,
    title = "FLUX REACTOR",
    items, activeItemId, onItemSelect,
    sliders,
    headerActions,
    onReset,
    className
}: KSpaceMenuProps) {
    const [page, setPage] = useState(0);

    if (!visible) return null;

    // Pagination Logic (9 items per page)
    const ITEMS_PER_PAGE = 9;
    const PAGES = [];
    for (let i = 0; i < items.length; i += ITEMS_PER_PAGE) {
        PAGES.push(items.slice(i, i + ITEMS_PER_PAGE));
    }
    const currentItems = PAGES[page] || [];

    const style = position ? {
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -50%)'
    } : {
        top: '50%', left: '50%', transform: 'translate(-50%, -50%)'
    };

    return (
        <div
            className={`fixed z-[100] bg-[#0a0a0a]/95 backdrop-blur-xl border border-orange-500/30 rounded-2xl p-4 shadow-[0_0_80px_rgba(249,115,22,0.15)] animate-in fade-in zoom-in-95 duration-100 w-80 flex flex-col gap-3 pointer-events-auto font-sans select-none ${className || ''}`}
            style={style}
            onPointerDown={(e) => e.stopPropagation()}
        >
            {/* HEADER */}
            <div className="flex justify-between items-center border-b border-orange-900/30 pb-2">
                <div className="text-[10px] font-black text-orange-500 tracking-[0.2em] flex items-center gap-2">
                    {title}
                </div>
                <div className="flex items-center gap-2">
                    {headerActions}
                </div>
            </div>

            {/* SLIDERS (CENTRAL CONTROL) */}
            {sliders && sliders.length > 0 && (
                <div className="bg-[#111] border border-[#222] rounded-lg p-3 space-y-3">
                    {sliders.map((slider, idx) => (
                        <div key={idx} className="space-y-1">
                            <div className="flex justify-between items-center">
                                <span className={`text-[8px] font-bold ${slider.colorClass || 'text-orange-600'}`}>{slider.label}</span>
                                <span className={`text-[8px] font-mono ${slider.colorClass || 'text-orange-400'}`}>{slider.value.toFixed(2)}</span>
                            </div>
                            <input
                                type="range" min={slider.min} max={slider.max} step={slider.step}
                                value={slider.value}
                                onChange={(e) => slider.onChange(parseFloat(e.target.value))}
                                className={`w-full h-1 bg-[#222] rounded appearance-none ${slider.accentClass || 'accent-orange-500'}`}
                            />
                        </div>
                    ))}
                </div>
            )}

            {/* ITEMS GRID (PAGED) */}
            <div className="grid grid-cols-3 gap-1.5 h-48">
                {currentItems.map((item) => {
                    const isActive = activeItemId === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => {
                                if (item.onClick) item.onClick();
                                onItemSelect(item.id);
                            }}
                            disabled={item.disabled}
                            className={`
                                flex flex-col items-center justify-center gap-1 rounded border transition-all group relative overflow-hidden
                                ${isActive
                                    ? 'bg-orange-900/20 border-orange-500/50 text-orange-100 shadow-[inset_0_0_15px_rgba(249,115,22,0.2)]'
                                    : 'bg-[#111] border-[#222] text-gray-500 hover:border-orange-900/50 hover:text-gray-300'
                                }
                                ${item.disabled ? 'opacity-30 cursor-not-allowed' : ''}
                            `}
                            title={item.desc}
                        >
                            {item.icon && <item.icon size={18} className={isActive ? 'text-orange-400 drop-shadow-[0_0_5px_rgba(249,115,22,0.8)]' : 'text-gray-600'} />}
                            <span className="text-[8px] font-bold tracking-wider">{item.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* PAGINATION & ACTIONS */}
            <div className="flex items-center justify-between pt-1">
                <div className="flex gap-1">
                    <button
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page === 0}
                        className="p-1.5 rounded border border-[#333] hover:bg-[#222] text-gray-400 disabled:opacity-30"
                    >
                        <ChevronLeft size={12} />
                    </button>
                    <div className="flex items-center gap-1.5 px-2">
                        {PAGES.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => setPage(i)}
                                className={`w-2.5 h-2.5 rounded-full transition-all ${i === page ? 'bg-orange-500 scale-110' : 'bg-[#333] hover:bg-gray-500'}`}
                            />
                        ))}
                    </div>
                    <button
                        onClick={() => setPage(p => Math.min(PAGES.length - 1, p + 1))}
                        disabled={page === PAGES.length - 1}
                        className="p-1.5 rounded border border-[#333] hover:bg-[#222] text-gray-400 disabled:opacity-30"
                    >
                        <ChevronRight size={12} />
                    </button>
                </div>

                {onReset && (
                    <button
                        onClick={onReset}
                        className="px-3 py-1.5 bg-red-900/10 hover:bg-red-900/30 border border-red-900/50 text-red-500 rounded text-[8px] font-bold flex items-center gap-2 transition-all"
                    >
                        <RotateCcw size={10} /> RESET
                    </button>
                )}
            </div>
        </div>
    );
}
