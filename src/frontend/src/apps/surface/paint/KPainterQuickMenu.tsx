import React, { useMemo } from 'react';
import {
    Paintbrush, CircleDot, Droplets, Sparkles, Zap, Wind,
    Flame, Waves, Sprout, Magnet, Atom, Clock, Target, Infinity
} from 'lucide-react';
import KPainterSpaceMenu from './KPainterSpaceMenu';
import { SpaceMenuItem } from '../../../core/ui/KSpaceMenu/KSpaceMenu';

export default function KPainterQuickMenu({
    visible, position,
    onReset,
    brush, setBrush,
    blackHole, setBlackHole,
    activeMods, setActiveMods,
    modParams, setModParams,
    alphas
}: any) {
    if (!visible) return null;

    // Check if any simulation effect is active
    const hasActiveSimMod = () => {
        const simMods = ['hydro', 'particulate', 'entropy', 'inertia', 'vector', 'reaction', 'vortex', 'drip', 'flow', 'growth', 'ferro', 'quantum', 'chronos'];
        return simMods.some(id => activeMods?.[id]);
    };

    // All available brush modifiers/sims with unique colors
    const ALL_MODS = [
        // Core Modes (Top Section)
        { id: 'standard', label: 'STANDARD', icon: Paintbrush, desc: 'Standard PBR Painting', type: 'core', color: '#6b7280' },
        { id: 'blackhole', label: 'BLACK HOLE', icon: CircleDot, desc: 'Event Horizon Blending', type: 'core', color: '#a855f7' },

        // Separator
        { id: 'separator', label: '---', icon: null, desc: '', type: 'separator', color: '#333' },

        // Simulation Effects (Color-coded for chaining)
        { id: 'hydro', label: 'HYDRO', icon: Droplets, desc: 'Fluid Dynamics Simulation', type: 'sim', color: '#22d3ee' }, // Cyan
        { id: 'particulate', label: 'PARTICLE', icon: Sparkles, desc: 'Particle Scattering', type: 'sim', color: '#fbbf24' }, // Amber
        { id: 'entropy', label: 'ENTROPY', icon: Zap, desc: 'Chaos & Disorder', type: 'sim', color: '#ef4444' }, // Red
        { id: 'inertia', label: 'INERTIA', icon: Target, desc: 'Momentum Preservation', type: 'sim', color: '#3b82f6' }, // Blue
        { id: 'vector', label: 'VECTOR', icon: Wind, desc: 'Directional Flow', type: 'sim', color: '#10b981' }, // Green
        { id: 'reaction', label: 'REACTION', icon: Flame, desc: 'Chemical Reactions', type: 'sim', color: '#f97316' }, // Orange
        { id: 'vortex', label: 'VORTEX', icon: Waves, desc: 'Swirling Patterns', type: 'sim', color: '#06b6d4' }, // Cyan-600
        { id: 'drip', label: 'DRIP', icon: Droplets, desc: 'Gravity Drip Effect', type: 'sim', color: '#8b5cf6' }, // Violet
        { id: 'flow', label: 'FLOW', icon: Waves, desc: 'Smooth Flow Dynamics', type: 'sim', color: '#14b8a6' }, // Teal
        { id: 'growth', label: 'GROWTH', icon: Sprout, desc: 'Organic Growth', type: 'sim', color: '#84cc16' }, // Lime
        { id: 'ferro', label: 'FERRO', icon: Magnet, desc: 'Magnetic Field', type: 'sim', color: '#ec4899' }, // Pink
        { id: 'quantum', label: 'QUANTUM', icon: Atom, desc: 'Quantum Fluctuations', type: 'sim', color: '#6366f1' }, // Indigo
        { id: 'chronos', label: 'CHRONOS', icon: Clock, desc: 'Time Distortion', type: 'sim', color: '#a78bfa' }, // Purple
    ];

    // Check if a specific mode is active
    const isActive = (id: string) => {
        if (id === 'separator') return false;
        if (id === 'blackhole') return blackHole?.active || false;
        if (id === 'standard') {
            // Standard is active if no sims are active
            const noSims = !blackHole?.active && (!activeMods || Object.values(activeMods).every(v => !v));
            return noSims;
        }
        return activeMods?.[id] || false;
    };

    // Get all active mode IDs for display
    const getActiveModeIds = () => {
        const actives = [];
        if (blackHole?.active) actives.push('blackhole');
        if (activeMods) {
            Object.keys(activeMods).forEach(key => {
                if (activeMods[key]) actives.push(key);
            });
        }
        if (actives.length === 0) actives.push('standard');
        return actives;
    };

    const activeModeIds = getActiveModeIds();
    const primaryMode = activeModeIds[0] || 'standard'; // For sliders display

    const setActiveMode = (id: string) => {
        if (id === 'separator') return; // Ignore separator clicks

        if (id === 'blackhole') {
            // Toggle blackhole
            setBlackHole?.((p: any) => ({ ...p, active: !p.active }));
        } else if (id === 'standard') {
            // Standard mode: Turn OFF all sims
            setBlackHole?.((p: any) => ({ ...p, active: false }));
            if (setActiveMods) {
                const resetMods: any = {};
                Object.keys(activeMods || {}).forEach(key => resetMods[key] = false);
                setActiveMods(resetMods);
            }
        } else {
            // Toggle sim modifier (allows chaining!)
            if (setActiveMods) {
                setActiveMods((prev: any) => ({
                    ...prev,
                    [id]: !prev[id]
                }));
            }
        }
    };

    const menuItems: SpaceMenuItem[] = ALL_MODS.map(m => ({
        id: m.id,
        label: m.label,
        icon: m.icon,
        desc: m.desc,
        disabled: m.type === 'separator',
        active: isActive(m.id), // Mark item as active if it's currently enabled
        color: m.color // Pass color for styling
    }));

    // Dynamic Sliders based on Active Mode
    const getSliders = () => {
        if (primaryMode === 'blackhole') {
            return [
                {
                    label: 'RADIUS',
                    value: blackHole?.radius || 0.1,
                    min: 0.01, max: 0.5, step: 0.01,
                    onChange: (val: number) => setBlackHole?.((p: any) => ({ ...p, radius: val })),
                    colorClass: 'text-purple-300',
                    accentClass: 'accent-purple-500'
                },
                {
                    label: 'GRAVITY',
                    value: blackHole?.strength || 2.0,
                    min: 1.0, max: 20.0, step: 0.1,
                    onChange: (val: number) => setBlackHole?.((p: any) => ({ ...p, strength: val })),
                    colorClass: 'text-purple-400',
                    accentClass: 'accent-purple-500'
                },
                {
                    label: 'SPIN',
                    value: blackHole?.spin || 5.0,
                    min: -10.0, max: 10.0, step: 0.1,
                    onChange: (val: number) => setBlackHole?.((p: any) => ({ ...p, spin: val })),
                    colorClass: 'text-purple-500',
                    accentClass: 'accent-purple-500'
                },
                {
                    label: 'DECAY',
                    value: blackHole?.decay || 0.95,
                    min: 0.8, max: 0.99, step: 0.01,
                    onChange: (val: number) => !blackHole?.infinite && setBlackHole?.((p: any) => ({ ...p, decay: val })),
                    colorClass: 'text-blue-300',
                    accentClass: 'accent-blue-500'
                }
            ];
        } else if (hasActiveSimMod()) {
            // --- SIMULATION EFFECT SLIDERS ---
            // Show when any sim effect is active (hydro, drip, vortex, etc.)
            return [
                {
                    label: 'SPEED',
                    value: modParams?.speed || 1.0,
                    min: 0.1, max: 3.0, step: 0.1,
                    onChange: (val: number) => setModParams?.((p: any) => ({ ...p, speed: val })),
                    colorClass: 'text-cyan-300',
                    accentClass: 'accent-cyan-500'
                },
                {
                    label: 'CHAOS',
                    value: modParams?.chaos || 0.5,
                    min: 0.0, max: 2.0, step: 0.1,
                    onChange: (val: number) => setModParams?.((p: any) => ({ ...p, chaos: val })),
                    colorClass: 'text-orange-300',
                    accentClass: 'accent-orange-500'
                },
                {
                    label: 'INTENSITY',
                    value: modParams?.intensity || 1.0,
                    min: 0.1, max: 5.0, step: 0.1,
                    onChange: (val: number) => setModParams?.((p: any) => ({ ...p, intensity: val })),
                    colorClass: 'text-pink-300',
                    accentClass: 'accent-pink-500'
                },
                {
                    label: 'SIZE',
                    value: brush?.size || 50,
                    min: 1, max: 200, step: 1,
                    onChange: (val: number) => setBrush?.((b: any) => ({ ...b, size: val })),
                    colorClass: 'text-blue-400',
                    accentClass: 'accent-blue-500'
                }
            ];
        } else {
            // Standard brush sliders
            return [
                {
                    label: 'SIZE',
                    value: brush?.size || 50,
                    min: 1, max: 200, step: 1,
                    onChange: (val: number) => setBrush?.((b: any) => ({ ...b, size: val })),
                    colorClass: 'text-blue-400',
                    accentClass: 'accent-blue-500'
                },
                {
                    label: 'FLOW',
                    value: brush?.flow || 0.5,
                    min: 0.01, max: 1.0, step: 0.01,
                    onChange: (val: number) => setBrush?.((b: any) => ({ ...b, flow: val })),
                    colorClass: 'text-cyan-400',
                    accentClass: 'accent-cyan-500'
                },
                {
                    label: 'OPACITY',
                    value: brush?.opacity || 1.0,
                    min: 0.01, max: 1.0, step: 0.01,
                    onChange: (val: number) => setBrush?.((b: any) => ({ ...b, opacity: val })),
                    colorClass: 'text-white',
                    accentClass: 'accent-white'
                },
                {
                    label: 'EDGE MASK',
                    value: brush?.smartMask?.edge || 0,
                    min: -1.0, max: 1.0, step: 0.1,
                    onChange: (val: number) => setBrush?.((b: any) => ({ ...b, smartMask: { ...b.smartMask, edge: val } })),
                    colorClass: 'text-green-400',
                    accentClass: 'accent-green-500'
                },
                {
                    label: 'CAVITY MASK',
                    value: brush?.smartMask?.slope || 0,
                    min: -1.0, max: 1.0, step: 0.1,
                    onChange: (val: number) => setBrush?.((b: any) => ({ ...b, smartMask: { ...b.smartMask, slope: val } })),
                    colorClass: 'text-orange-400',
                    accentClass: 'accent-orange-500'
                },
                {
                    label: 'HEIGHT MASK',
                    value: brush?.smartMask?.height || 0,
                    min: -1.0, max: 1.0, step: 0.1,
                    onChange: (val: number) => setBrush?.((b: any) => ({ ...b, smartMask: { ...b.smartMask, height: val } })),
                    colorClass: 'text-yellow-400',
                    accentClass: 'accent-yellow-500'
                }
            ];
        }
    };

    const sliders = getSliders();

    // Extra Header Actions for Black Hole
    const headerActions = primaryMode === 'blackhole' ? (
        <button
            onClick={() => setBlackHole?.((p: any) => ({ ...p, infinite: !p.infinite }))}
            className={`px-2 py-1 rounded text-[8px] font-bold border transition-all flex items-center gap-1 ${blackHole?.infinite ? 'bg-purple-900/40 border-purple-500 text-white' : 'bg-[#1a1a1a] border-[#333] text-gray-500'}`}
        >
            <Infinity size={10} /> {blackHole?.infinite ? "STABLE" : "DECAY"}
        </button>
    ) : null;

    return (
        <KPainterSpaceMenu
            visible={visible}
            position={position}
            title={<><Paintbrush size={14} /> PAINTER Q-MENU</>}
            items={menuItems}
            activeItemId={activeModeIds[0] || 'standard'}
            activeItemIds={activeModeIds} // Highlight ALL active effects
            onItemSelect={setActiveMode}
            sliders={sliders}
            headerActions={headerActions}
            onReset={onReset}
        />
    );
}
