import React, { useMemo } from 'react';
import {
    Wind, ArrowDown, CloudRain, Waves, Layers, Tornado, Magnet, Sprout,
    Flame, Sun, Sparkles, Zap, Move, Activity, Atom, Clock,
    Monitor, AlignCenterVertical, ScanLine, Shuffle,
    Globe, Scissors, RotateCw, Expand,
    Flower, Heart, Feather,
    Lock, Unlock, Thermometer, Mountain, Snowflake, Droplet
} from 'lucide-react';
import KSpaceMenu, { SpaceMenuItem } from '../../../core/ui/KSpaceMenu/KSpaceMenu';

const RAW_FORCES = [
    { id: 'BLOB', label: 'BLOB', icon: CloudRain, desc: 'Volumetric Expansion' },
    { id: 'BLOOM', label: 'BLOOM', icon: Flower, desc: 'Radial Petal Expansion' },
    { id: 'CRYSTALLIZE', label: 'CRYSTAL', icon: Snowflake, desc: 'Grid Snap Struct' },
    { id: 'ERODE', label: 'ERODE', icon: Mountain, desc: 'Weathering & Decay' },
    { id: 'GLITCH', label: 'GLITCH', icon: Zap, desc: 'Digital Distortion' },
    { id: 'GRAVITY', label: 'GRAVITY', icon: ArrowDown, desc: 'Linear Downward Pull' },
    { id: 'GROWTH', label: 'GROWTH', icon: Sprout, desc: 'Recursive Branching' },
    { id: 'MAGMA', label: 'MAGMA', icon: Flame, desc: 'Fluid Viscosity Flow' },
    { id: 'MAGNET', label: 'MAGNET', icon: Magnet, desc: 'Magnetic Pull' },
    { id: 'MELT', label: 'MELT', icon: Droplet, desc: 'Viscous Gravity' },
    { id: 'NOISE', label: 'NOISE', icon: Shuffle, desc: 'Entropy & Chaos' },
    { id: 'ORBIT', label: 'ORBIT', icon: RotateCw, desc: 'Singularity Rotation' },
    { id: 'PULSE', label: 'PULSE', icon: Heart, desc: 'Rhythmic Inflation' },
    { id: 'REPEL', label: 'REPEL', icon: Expand, desc: 'Anti-Gravity Field' },
    { id: 'SHATTER', label: 'SHATTER', icon: Scissors, desc: 'Voronoi Fracture' },
    { id: 'SPIKE', label: 'SPIKE', icon: Mountain, desc: 'Normal Extrusion' },
    { id: 'TECTONIC', label: 'TECTONIC', icon: Activity, desc: 'Seismic Plate Shift' },
    { id: 'TERRA', label: 'TERRA', icon: Globe, desc: 'Planetary Uplift' },
    { id: 'TERRACE', label: 'TERRACE', icon: ScanLine, desc: 'Height Quantization' },
    { id: 'THERMAL', label: 'THERMAL', icon: Thermometer, desc: 'Heat Diffusion' },
    { id: 'TWIST', label: 'TWIST', icon: Move, desc: 'Axial Torque' },
    { id: 'VELVET', label: 'VELVET', icon: Feather, desc: 'Soft Noise Inflation' },
    { id: 'VOID', label: 'VOID', icon: Sun, desc: 'Singularity Collapse' },
    { id: 'VORTEX', label: 'VORTEX', icon: Tornado, desc: 'Fluid Swirl' },
    { id: 'WAVE', label: 'WAVE', icon: Waves, desc: 'Ripple Propagation' },
];

const FORCES = RAW_FORCES.sort((a, b) => a.label.localeCompare(b.label));

export default function KSculptSpaceMenu({
    visible, position,
    activeForce, setActiveForce,
    forceParams, setForceParams,
    onReset,
    gpuMode, setGpuMode,
    isLocked, onToggleLock
}: any) {
    if (!visible) return null;

    // Map FORCES to SpaceMenuItem format
    const menuItems: SpaceMenuItem[] = useMemo(() => FORCES.map(f => ({
        id: f.id,
        label: f.label,
        icon: f.icon,
        desc: f.desc,
        disabled: !gpuMode // Existing logic: only active when GPU Sim is active
    })), [gpuMode]);

    // Define Header Actions (Lock + GPU Toggle)
    const headerActions = (
        <>
            <button
                onClick={onToggleLock}
                className={`p-1 rounded hover:bg-orange-900/30 transition-colors ${isLocked ? 'text-orange-500' : 'text-gray-600'}`}
                title={isLocked ? "Unlock Menu" : "Lock Menu Open"}
            >
                {isLocked ? <Lock size={12} /> : <Unlock size={12} />}
            </button>
            <button
                onClick={() => setGpuMode(!gpuMode)}
                className={`px-3 py-1 rounded-full text-[8px] font-bold flex items-center gap-1 border transition-all ${gpuMode ? 'bg-orange-500 text-black border-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.4)]' : 'bg-[#1a1a1a] text-gray-500 border-[#333]'}`}
            >
                {gpuMode ? 'SIM: ACTIVE' : 'SIM: PAUSED'}
            </button>
        </>
    );

    // Define Sliders
    const sliders = [
        {
            label: 'INTENSITY',
            value: forceParams?.intensity || 0.5,
            min: 0.0, max: 1.0, step: 0.01,
            onChange: (val: number) => setForceParams({ ...forceParams, intensity: val }),
            colorClass: 'text-orange-600',
            accentClass: 'accent-orange-500'
        },
        {
            label: 'RADIUS',
            value: forceParams?.radius || 0.5,
            min: 0.1, max: 2.0, step: 0.1,
            onChange: (val: number) => setForceParams({ ...forceParams, radius: val }),
            colorClass: 'text-yellow-500',
            accentClass: 'accent-yellow-500'
        }
    ];

    return (
        <KSpaceMenu
            visible={visible}
            position={position}
            title={<><Atom size={14} /> FLUX REACTOR</>}
            items={menuItems}
            activeItemId={activeForce}
            onItemSelect={setActiveForce}
            sliders={sliders}
            headerActions={headerActions}
            onReset={onReset}
        />
    );
}

// Helper icon import (Atom was used in header but not imported in original top list properly sometimes, ensuring it works)
// Added Atom to lucide imports above.
