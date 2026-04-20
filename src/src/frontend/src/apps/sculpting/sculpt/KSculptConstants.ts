import { Circle, Move, Activity, Square, Maximize, Paintbrush, MousePointer2, Minimize2, PenTool, Eraser, Archive, Waves, Mountain } from 'lucide-react';

export const BRUSHES = [
    { id: 'SELECT', icon: MousePointer2, label: 'SELECT', key: 'S' },
    { id: 'CLAY', icon: Circle, label: 'CLAY', key: '1' },
    { id: 'MOVE', icon: Move, label: 'MOVE', key: '2' },
    { id: 'SMOOTH', icon: Activity, label: 'SMOOTH', key: '3' },
    { id: 'FLATTEN', icon: Square, label: 'FLATTEN', key: '4' },
    { id: 'INFLATE', icon: Maximize, label: 'INFLATE', key: '5' },
    { id: 'PINCH', icon: Minimize2, label: 'PINCH', key: '6' },
    { id: 'CREASE', icon: PenTool, label: 'CREASE', key: '7' },
    { id: 'SCRAPE', icon: Eraser, label: 'SCRAPE', key: '8' },
    { id: 'FILL', icon: Archive, label: 'FILL', key: '9' },
    { id: 'NOISE', icon: Waves, label: 'NOISE', key: 'N' },      // Procedural noise displacement
    { id: 'TERRAIN', icon: Mountain, label: 'TERRAIN', key: 'T' }, // Terrain sculpting (fBm)
    { id: 'PAINT', icon: Paintbrush, label: 'PAINT', key: '0' },
];
