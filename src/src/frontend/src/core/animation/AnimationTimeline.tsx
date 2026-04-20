import React from 'react';
import { Play, Pause, SkipBack } from 'lucide-react';
import { useAnimation, AnimationState } from './useAnimation';

interface Keyframe {
    time: number;
    id: string;
    color?: string;
}

interface AnimationTimelineProps {
    animation: ReturnType<typeof useAnimation>;
    keyframes?: Keyframe[];
    onAddKeyframe?: (time: number) => void;
    onDeleteKeyframe?: (id: string) => void;
    onScrub?: (time: number) => void;
    className?: string;
}

export default function AnimationTimeline({
    animation,
    keyframes = [],
    onAddKeyframe,
    onDeleteKeyframe,
    onScrub,
    className = ''
}: AnimationTimelineProps) {
    const progress = animation.duration > 0 ? (animation.time / animation.duration) * 100 : 0;
    const timelineRef = React.useRef<HTMLDivElement>(null);

    const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!timelineRef.current) return;
        const rect = timelineRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percent = x / rect.width;
        const newTime = percent * animation.duration;
        animation.seek(newTime);
        if (onScrub) onScrub(newTime);
    };

    return (
        <div className={`bg-[#111]/90 backdrop-blur-md border border-[#333] rounded-xl flex flex-col shadow-2xl overflow-hidden ${className}`}>
            <div className="flex items-center justify-between p-2 border-b border-[#333] bg-[#0a0a0a]/50">
                <div className="flex items-center gap-2">
                    <button onClick={animation.stop} className="text-gray-400 hover:text-white p-1">
                        <SkipBack size={14} />
                    </button>
                    <button
                        onClick={animation.toggle}
                        className={`text-white w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                            animation.isPlaying
                                ? 'bg-red-500 hover:bg-red-600'
                                : 'bg-green-500 hover:bg-green-600'
                        }`}
                    >
                        {animation.isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
                    </button>
                    <div className="text-[10px] font-mono text-pink-400 ml-2 bg-black/40 px-2 py-1 rounded border border-pink-900/30">
                        {animation.time.toFixed(2)}s / {animation.duration.toFixed(2)}s
                    </div>
                </div>
            </div>

            <div
                ref={timelineRef}
                onClick={handleTimelineClick}
                className="relative h-20 bg-[#050505] cursor-pointer group"
            >
                {/* Grid */}
                <div className="absolute inset-0 flex justify-between px-2 opacity-20 pointer-events-none">
                    {Array.from({ length: 20 }).map((_, i) => (
                        <div key={i} className="w-px h-full bg-[#333]" />
                    ))}
                </div>

                {/* Keyframes */}
                {keyframes.map(kf => {
                    const pos = (kf.time / animation.duration) * 100;
                    return (
                        <div
                            key={kf.id}
                            className="absolute top-0 bottom-0 w-1 bg-blue-500 z-10 cursor-pointer hover:bg-blue-400"
                            style={{ left: `${pos}%` }}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onDeleteKeyframe) onDeleteKeyframe(kf.id);
                            }}
                        />
                    );
                })}

                {/* Playhead */}
                <div
                    className="absolute top-0 bottom-0 w-0.5 bg-pink-500 z-20 pointer-events-none shadow-[0_0_15px_#ec4899]"
                    style={{ left: `${progress}%` }}
                />
            </div>
        </div>
    );
}

