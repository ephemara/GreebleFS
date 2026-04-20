
import {
    Terminal, Command, Cpu, Zap, Database,
    PenTool, Layers, Grid, LayoutGrid, Copy,
    Map as MapIcon, Aperture, Paintbrush,
    Search, Activity, Box, Hexagon,
    Globe, Waves, HardDrive, FileJson, X, Check, Trash2, Download, UploadCloud, FileCode,
    Merge, CheckSquare, Combine, Group, Component, Loader2,
    FolderOpen, FolderClosed, ChevronRight, ChevronDown, Rocket, Mountain, Disc,
    Settings, Power, Battery, Wifi, Volume2, Info, Monitor, MemoryStick, Skull, Atom,
    FilePlus, Save, Palette, Image as ImageIcon, Key, Gauge, Stamp, TestTube, Sprout,
    PencilRuler, ScanLine, Brush, Maximize
} from 'lucide-react';

// Import app components
import KChronos from '../apps/sim/KChronos/KChronos';
import KAtlas from '../apps/surface/atlas/KAtlas';
import KPainter from '../apps/surface/paint/KPainter';
import KGraphos from '../apps/surface/graphos/KGraphos';
import KInspect from '../apps/render/inspect/KInspect';
import KTecton from '../apps/sim/tecton/KTecton';
import KGreeble from '../apps/modeling/greeble/KGreeble';
import KScatter from '../apps/modeling/scatter/KScatter';
import KAutopbr from '../apps/surface/autopbr/KAutopbr';
import KCloner from '../apps/modeling/cloner/KCloner';
import KSculpt from '../apps/sculpting/sculpt/KSculpt'; // Original Three.js (Bevy version: KSculptBevy.tsx)
import KQuantum from '../apps/sim/quantum/KQuantum';
import KRig from '../apps/anim/rig/KRig';
import KGenius from '../apps/dev/genius/KGenius';

export const CATEGORY_CONFIG: Record<string, { label: string, color: string, icon: any, border: string, bg: string }> = {
    'K-SCULPT': { label: 'K-SCULPT', color: 'text-orange-500', border: 'border-orange-500', bg: 'bg-orange-900/20', icon: PenTool },
    'K-GREEBLE': { label: 'K-GREEBLE', color: 'text-emerald-500', border: 'border-emerald-500', bg: 'bg-emerald-900/20', icon: Rocket },
    'K-TECTON': { label: 'K-TECTON', color: 'text-cyan-500', border: 'border-cyan-500', bg: 'bg-cyan-900/20', icon: Mountain },
    'K-SCATTER': { label: 'K-SCATTER', color: 'text-pink-500', border: 'border-pink-500', bg: 'bg-pink-900/20', icon: LayoutGrid },
    'K-CLONER': { label: 'K-CLONER', color: 'text-cyan-400', border: 'border-cyan-400', bg: 'bg-cyan-900/20', icon: Activity },
    'K-CHRONOS': { label: 'K-CHRONOS', color: 'text-purple-500', border: 'border-purple-500', bg: 'bg-purple-900/20', icon: Waves },
    'K-QUANTUM': { label: 'K-QUANTUM', color: 'text-purple-400', border: 'border-purple-400', bg: 'bg-purple-900/20', icon: Atom },
    'K-PAINTER': { label: 'K-PAINTER', color: 'text-indigo-500', border: 'border-indigo-500', bg: 'bg-indigo-900/20', icon: Paintbrush },
    'K-GRAPHOS': { label: 'K-GRAPHOS', color: 'text-rose-500', border: 'border-rose-500', bg: 'bg-rose-900/20', icon: Brush },
    'K-ATLAS': { label: 'K-ATLAS', color: 'text-teal-500', border: 'border-teal-500', bg: 'bg-teal-900/20', icon: MapIcon },
    'K-RIG': { label: 'K-RIG', color: 'text-violet-500', border: 'border-violet-500', bg: 'bg-violet-900/20', icon: Zap },
    'MERGED': { label: 'FUSIONS', color: 'text-yellow-500', border: 'border-yellow-500', bg: 'bg-yellow-900/20', icon: Merge },
    'IMPORT': { label: 'IMPORTS', color: 'text-slate-400', border: 'border-slate-500', bg: 'bg-slate-800', icon: HardDrive },
};

export const WORKFLOW = [
    {
        label: "MODEL",
        color: "text-blue-500",
        border: "border-blue-500/30",
        modules: [
            { id: 'sculpt', name: 'K-SCULPT', icon: PenTool, component: KSculpt },
            { id: 'greeble', name: 'K-GREEBLE', icon: Grid, component: KGreeble },
            { id: 'scatter', name: 'K-SCATTER', icon: LayoutGrid, component: KScatter },
        ]
    },
    {
        label: "UV",
        color: "text-teal-500",
        border: "border-teal-500/30",
        modules: [
            { id: 'atlas', name: 'K-ATLAS', icon: MapIcon, component: KAtlas },
        ]
    },
    {
        label: "SURFACE",
        color: "text-rose-500",
        border: "border-rose-500/30",
        modules: [
            { id: 'graphos', name: 'K-GRAPHOS', icon: Brush, component: KGraphos },
            { id: 'autopbr', name: 'K-SAMPLE', icon: Aperture, component: KAutopbr },
            { id: 'painter', name: 'K-PAINTER', icon: Paintbrush, component: KPainter },
        ]
    },
    {
        label: "ANIM",
        color: "text-violet-500",
        border: "border-violet-500/30",
        modules: [
            { id: 'rig', name: 'K-RIG', icon: Zap, component: KRig },
            { id: 'cloner', name: 'K-CLONER', icon: Copy, component: KCloner },
        ]
    },
    {
        label: "RENDER",
        color: "text-emerald-500",
        border: "border-emerald-500/30",
        modules: [
            { id: 'inspect', name: 'K-INSPECT', icon: Search, component: KInspect },
        ]
    },
    {
        label: "SIM",
        color: "text-cyan-500",
        border: "border-cyan-500/30",
        modules: [
            { id: 'tecton', name: 'K-TECTON', icon: Globe, component: KTecton },
            { id: 'chronos', name: 'K-CHRONOS', icon: Waves, component: KChronos },
            { id: 'quantum', name: 'K-QUANTUM', icon: Atom, component: KQuantum },
        ]
    },
    {
        label: "DEV",
        color: "text-lime-400",
        border: "border-lime-400/30",
        modules: [
            { id: 'genius', name: 'K-GENIUS', icon: Cpu, component: KGenius },
        ]
    },
];

export const ALL_MODULES = WORKFLOW.flatMap(g => g.modules);
