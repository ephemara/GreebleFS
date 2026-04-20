
import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Square, Circle, ChevronDown, Film, Eye, EyeOff, X, GripVertical, ZoomIn, ZoomOut } from 'lucide-react';

import { Keyframe, KeyframeTransform } from './easings';

interface SequencerProps {
    layers: any[];
    activeLayerId: string | null;
    setActiveLayerId: (id: string | null) => void;
    currentFrame: number;
    setCurrentFrame: (f: number) => void;
    totalFrames: number;
    setTotalFrames: (f: number) => void;
    isPlaying: boolean;
    setIsPlaying: (p: boolean) => void;
    fps: number;
    setFps: (f: number) => void;
    isOpen: boolean;
    setIsOpen: (o: boolean) => void;
    onAddKeyframe: (layerId: string, frame: number) => void;
    onDeleteKeyframe: (layerId: string, frame: number) => void;
    onUpdateTransform: (layerId: string, transform: Partial<KeyframeTransform>) => void;
}

export default function KGraphosSequencer({
    layers,
    activeLayerId,
    setActiveLayerId,
    currentFrame,
    setCurrentFrame,
    totalFrames,
    setTotalFrames,
    isPlaying,
    setIsPlaying,
    fps,
    setFps,
    isOpen,
    setIsOpen,
    onAddKeyframe,
    onDeleteKeyframe,
    onUpdateTransform
}: SequencerProps) {
    const timelineRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
    const [isDraggingEnd, setIsDraggingEnd] = useState(false);
    const [zoom, setZoom] = useState(1.0);

    const BASE_FRAME_WIDTH = 8;
    const frameWidth = BASE_FRAME_WIDTH * zoom;
    const timelineWidth = totalFrames * frameWidth;

    // Scrub handler for playhead
    const handleScrub = (e: React.MouseEvent | MouseEvent) => {
        if (!timelineRef.current || isDraggingEnd) return;
        const rect = timelineRef.current.getBoundingClientRect();
        const scrollLeft = scrollContainerRef.current?.scrollLeft || 0;
        const x = Math.max(0, e.clientX - rect.left + scrollLeft);
        const frame = Math.min(totalFrames - 1, Math.max(0, Math.round(x / frameWidth)));
        setCurrentFrame(frame);
    };

    // Handle end marker drag
    const handleEndDrag = (e: MouseEvent) => {
        if (!scrollContainerRef.current) return;
        const rect = scrollContainerRef.current.getBoundingClientRect();
        const scrollLeft = scrollContainerRef.current.scrollLeft;
        const x = e.clientX - rect.left + scrollLeft;
        const newFrames = Math.round(x / frameWidth);
        setTotalFrames(Math.max(10, Math.min(999, newFrames)));
    };

    // Scroll wheel - always capture to prevent canvas zoom
    const handleWheel = (e: React.WheelEvent) => {
        e.stopPropagation(); // Prevent canvas from zooming

        if (e.ctrlKey || e.metaKey) {
            // Ctrl+Scroll = Zoom timeline
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            setZoom(z => Math.max(0.2, Math.min(3.0, z + delta)));
        }
        // Regular scroll = horizontal pan (handled by overflow-x: auto)
    };

    // Drag playhead
    useEffect(() => {
        if (!isDraggingPlayhead) return;
        const handleMove = (e: MouseEvent) => handleScrub(e);
        const handleUp = () => setIsDraggingPlayhead(false);
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
        };
    }, [isDraggingPlayhead, totalFrames, frameWidth]);

    // Drag end marker
    useEffect(() => {
        if (!isDraggingEnd) return;
        const handleMove = (e: MouseEvent) => handleEndDrag(e);
        const handleUp = () => setIsDraggingEnd(false);
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
        };
    }, [isDraggingEnd, frameWidth]);

    // Refs for playback (avoid stale closure in interval)
    const currentFrameRef = useRef(currentFrame);
    const totalFramesRef = useRef(totalFrames);

    useEffect(() => { currentFrameRef.current = currentFrame; }, [currentFrame]);
    useEffect(() => { totalFramesRef.current = totalFrames; }, [totalFrames]);

    // Playback loop
    useEffect(() => {
        if (!isPlaying) return;
        const interval = setInterval(() => {
            const nextFrame = (currentFrameRef.current + 1) % totalFramesRef.current;
            setCurrentFrame(nextFrame);
        }, 1000 / fps);
        return () => clearInterval(interval);
    }, [isPlaying, fps, setCurrentFrame]);

    const playheadX = currentFrame * frameWidth;

    // Keyboard shortcut: K to add keyframe
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'k' || e.key === 'K') {
                if (activeLayerId) {
                    onAddKeyframe(activeLayerId, currentFrame);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, activeLayerId, currentFrame, onAddKeyframe]);

    const handleClose = () => {
        setIsPlaying(false);
        setIsOpen(false);
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="absolute bottom-0 left-1/2 -translate-x-1/2 bg-[#111] border border-[#333] border-b-0 rounded-t-lg px-4 py-1 flex items-center gap-2 text-gray-400 hover:text-white hover:bg-[#1a1a1a] transition-all z-50"
            >
                <Film size={12} />
                <span className="text-[9px] font-bold">SEQUENCER</span>
                <ChevronDown size={12} className="rotate-180" />
            </button>
        );
    }

    const gridInterval = zoom >= 1.5 ? 5 : zoom >= 0.5 ? 10 : 20;

    return (
        <div
            className="bg-[#0a0a0a] border-t border-[#333] flex flex-col select-none"
            style={{ height: activeLayerId ? 220 : 180, flexShrink: 0, minWidth: 0 }}
        >
            {/* HEADER */}
            <div className="h-10 bg-[#111] border-b border-[#222] flex items-center justify-between px-4 flex-shrink-0">
                {/* LEFT: PLAYBACK CONTROLS */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsPlaying(!isPlaying)}
                        className={`p-2 rounded ${isPlaying ? 'bg-rose-600 text-white' : 'bg-[#222] text-gray-400 hover:text-white'}`}
                    >
                        {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                    </button>
                    <button
                        onClick={() => { setIsPlaying(false); setCurrentFrame(0); }}
                        className="p-2 rounded bg-[#222] text-gray-400 hover:text-white"
                    >
                        <Square size={14} />
                    </button>
                    <button
                        onClick={() => activeLayerId && onAddKeyframe(activeLayerId, currentFrame)}
                        className="px-2 py-1 rounded bg-[#222] text-yellow-400 hover:bg-yellow-500/20 hover:text-yellow-300 flex items-center gap-1"
                        title="Add Keyframe (K)"
                    >
                        <span className="text-[10px] font-bold">◆ K</span>
                    </button>
                    <div className="w-px h-6 bg-[#333] mx-2" />
                    <span className="text-[10px] font-mono text-gray-400">
                        <span className="text-white">{String(currentFrame + 1).padStart(3, '0')}</span>
                        <span className="text-gray-600"> / </span>
                        <span>{String(totalFrames).padStart(3, '0')}</span>
                    </span>
                </div>

                {/* CENTER: TITLE + ZOOM */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-gray-500">
                        <Film size={12} />
                        <span className="text-[9px] font-bold">FLUX TIMELINE</span>
                    </div>
                    <div className="flex items-center gap-1 bg-[#1a1a1a] rounded px-2 py-1">
                        <ZoomOut size={10} className="text-gray-500" />
                        <input
                            type="range"
                            min={0.2}
                            max={3.0}
                            step={0.1}
                            value={zoom}
                            onChange={(e) => setZoom(parseFloat(e.target.value))}
                            className="w-16 h-1 bg-[#333] rounded appearance-none cursor-pointer accent-rose-500"
                        />
                        <ZoomIn size={10} className="text-gray-500" />
                        <span className="text-[8px] text-gray-500 ml-1 w-8">{(zoom * 100).toFixed(0)}%</span>
                    </div>
                </div>

                {/* RIGHT: SETTINGS + CLOSE */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] text-gray-500">FPS</span>
                        <select
                            value={fps}
                            onChange={(e) => setFps(parseInt(e.target.value))}
                            className="bg-[#222] border border-[#333] rounded px-2 py-1 text-[10px] text-white cursor-pointer"
                        >
                            <option value={12}>12</option>
                            <option value={24}>24</option>
                            <option value={30}>30</option>
                            <option value={60}>60</option>
                        </select>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-1.5 rounded bg-[#222] text-gray-500 hover:text-white hover:bg-rose-600 transition-colors"
                        title="Close Sequencer"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* TRANSFORM CONTROLS BAR */}
            {activeLayerId && (
                <div className="h-8 bg-[#0f0f0f] border-b border-[#222] flex items-center px-4 gap-4 flex-shrink-0">
                    <span className="text-[8px] text-gray-500 font-bold">TRANSFORM</span>

                    {/* Position X */}
                    <div className="flex items-center gap-2">
                        <span className="text-[8px] text-cyan-400 font-bold w-4">X</span>
                        <input
                            type="range"
                            min={-500}
                            max={500}
                            value={layers.find(l => l.id === activeLayerId)?.transform?.x ?? 0}
                            onChange={(e) => {
                                const v = parseFloat(e.target.value);
                                console.log('[Transform] X =', v);
                                onUpdateTransform(activeLayerId, { x: v });
                            }}
                            className="w-20 h-1 bg-[#333] rounded appearance-none cursor-pointer accent-cyan-500"
                        />
                        <span className="text-[8px] text-gray-400 w-8">{layers.find(l => l.id === activeLayerId)?.transform?.x?.toFixed(0) ?? 0}</span>
                    </div>

                    {/* Position Y */}
                    <div className="flex items-center gap-2">
                        <span className="text-[8px] text-cyan-400 font-bold w-4">Y</span>
                        <input
                            type="range"
                            min={-500}
                            max={500}
                            value={layers.find(l => l.id === activeLayerId)?.transform?.y ?? 0}
                            onChange={(e) => {
                                const v = parseFloat(e.target.value);
                                console.log('[Transform] Y =', v);
                                onUpdateTransform(activeLayerId, { y: v });
                            }}
                            className="w-20 h-1 bg-[#333] rounded appearance-none cursor-pointer accent-cyan-500"
                        />
                        <span className="text-[8px] text-gray-400 w-8">{layers.find(l => l.id === activeLayerId)?.transform?.y?.toFixed(0) ?? 0}</span>
                    </div>

                    <div className="w-px h-4 bg-[#333]" />

                    {/* Scale */}
                    <div className="flex items-center gap-2">
                        <span className="text-[8px] text-green-400 font-bold w-6">Scale</span>
                        <input
                            type="range"
                            min={0.1}
                            max={3}
                            step={0.05}
                            value={layers.find(l => l.id === activeLayerId)?.transform?.scaleX ?? 1}
                            onChange={(e) => {
                                const v = parseFloat(e.target.value);
                                console.log('[Transform] Scale =', v);
                                onUpdateTransform(activeLayerId, { scaleX: v, scaleY: v });
                            }}
                            className="w-20 h-1 bg-[#333] rounded appearance-none cursor-pointer accent-green-500"
                        />
                        <span className="text-[8px] text-gray-400 w-8">{(layers.find(l => l.id === activeLayerId)?.transform?.scaleX ?? 1).toFixed(2)}</span>
                    </div>

                    <div className="w-px h-4 bg-[#333]" />

                    {/* Rotation */}
                    <div className="flex items-center gap-2">
                        <span className="text-[8px] text-orange-400 font-bold w-4">Rot</span>
                        <input
                            type="range"
                            min={-180}
                            max={180}
                            value={layers.find(l => l.id === activeLayerId)?.transform?.rotation ?? 0}
                            onChange={(e) => {
                                const v = parseFloat(e.target.value);
                                console.log('[Transform] Rotation =', v);
                                onUpdateTransform(activeLayerId, { rotation: v });
                            }}
                            className="w-20 h-1 bg-[#333] rounded appearance-none cursor-pointer accent-orange-500"
                        />
                        <span className="text-[8px] text-gray-400 w-8">{layers.find(l => l.id === activeLayerId)?.transform?.rotation?.toFixed(0) ?? 0}°</span>
                    </div>

                    <div className="flex-1" />

                    {/* Reset */}
                    <button
                        onClick={() => {
                            console.log('[Transform] RESET');
                            onUpdateTransform(activeLayerId, { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 });
                        }}
                        className="text-[8px] text-gray-500 hover:text-white px-2 py-1 rounded bg-[#1a1a1a] hover:bg-rose-600 transition-colors"
                    >
                        RESET
                    </button>
                </div>
            )}

            {/* TIMELINE BODY */}
            <div className="flex flex-1 overflow-hidden min-w-0">
                {/* LAYER NAMES - FIXED WIDTH */}
                <div className="w-36 flex-shrink-0 bg-[#0f0f0f] border-r border-[#222] flex flex-col">
                    <div className="h-5 border-b border-[#222] flex items-center justify-center flex-shrink-0">
                        <span className="text-[8px] text-gray-600">LAYERS</span>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {layers.map((layer) => (
                            <div
                                key={layer.id}
                                className={`h-8 flex items-center px-3 gap-2 border-b border-[#1a1a1a] flex-shrink-0 ${layer.id === activeLayerId ? 'bg-rose-900/20 text-rose-300' : 'text-gray-400'
                                    }`}
                            >
                                {layer.visible ? <Eye size={10} /> : <EyeOff size={10} className="opacity-30" />}
                                <span className="text-[10px] font-bold truncate">{layer.name}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* TIMELINE TRACKS - SCROLLABLE */}
                <div
                    ref={scrollContainerRef}
                    className="flex-1 overflow-x-auto overflow-y-hidden min-w-0"
                    onWheel={handleWheel}
                >
                    <div style={{ width: timelineWidth, minWidth: '100%' }}>
                        {/* FRAME RULER */}
                        <div className="h-5 bg-[#111] border-b border-[#222] flex flex-shrink-0">
                            {Array.from({ length: Math.ceil(totalFrames / gridInterval) + 1 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="text-[8px] text-gray-500 font-mono pl-1 border-r border-[#222] flex-shrink-0"
                                    style={{ width: gridInterval * frameWidth }}
                                >
                                    {i * gridInterval}
                                </div>
                            ))}
                        </div>

                        {/* TRACK ROWS */}
                        <div
                            ref={timelineRef}
                            className="relative"
                            onMouseDown={(e) => { setIsDraggingPlayhead(true); handleScrub(e); }}
                        >
                            {layers.map((layer) => (
                                <div
                                    key={layer.id}
                                    className={`h-8 border-b border-[#1a1a1a] relative cursor-pointer ${layer.id === activeLayerId ? 'bg-rose-900/10' : 'bg-[#0a0a0a] hover:bg-[#111]'
                                        }`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveLayerId(layer.id);
                                    }}
                                    onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        // Calculate which frame was double-clicked
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const x = e.clientX - rect.left;
                                        const frame = Math.round(x / frameWidth);
                                        onAddKeyframe(layer.id, Math.max(0, Math.min(totalFrames - 1, frame)));
                                    }}
                                >
                                    <div className="absolute inset-0 flex pointer-events-none">
                                        {Array.from({ length: Math.ceil(totalFrames / gridInterval) }).map((_, f) => (
                                            <div
                                                key={f}
                                                className="h-full border-r border-[#222] flex-shrink-0"
                                                style={{ width: gridInterval * frameWidth }}
                                            />
                                        ))}
                                    </div>
                                    {/* KEYFRAMES */}
                                    {layer.keyframes?.map((kf: Keyframe) => (
                                        <div
                                            key={kf.frame}
                                            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-yellow-400 rotate-45 cursor-pointer hover:bg-yellow-300 hover:scale-125 transition-transform z-10"
                                            style={{ left: kf.frame * frameWidth - 4 }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setCurrentFrame(kf.frame);
                                            }}
                                            onDoubleClick={(e) => {
                                                e.stopPropagation();
                                                onDeleteKeyframe(layer.id, kf.frame);
                                            }}
                                            title={`Frame ${kf.frame} - Double-click to delete`}
                                        />
                                    ))}
                                </div>
                            ))}

                            {/* PLAYHEAD */}
                            <div
                                className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-20 pointer-events-none"
                                style={{ left: playheadX }}
                            >
                                <div className="absolute -top-5 left-1/2 -translate-x-1/2 w-3 h-3 bg-rose-500 rotate-45" />
                            </div>

                            {/* END MARKER */}
                            <div
                                className="absolute top-0 bottom-0 w-3 bg-gradient-to-r from-transparent to-orange-500 z-30 cursor-ew-resize group"
                                style={{ left: timelineWidth - 3 }}
                                onMouseDown={(e) => { e.stopPropagation(); setIsDraggingEnd(true); }}
                                title="Drag to extend/shrink timeline"
                            >
                                <div className="absolute inset-y-0 right-0 w-1 bg-orange-400 group-hover:bg-orange-300" />
                                <GripVertical size={10} className="absolute top-1/2 right-0 -translate-y-1/2 text-orange-300 opacity-0 group-hover:opacity-100" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
