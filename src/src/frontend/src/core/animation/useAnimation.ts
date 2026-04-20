import { useState, useEffect, useRef, useCallback } from 'react';

export interface AnimationState {
    isPlaying: boolean;
    time: number;
    duration: number;
    fps: number;
}

export interface UseAnimationOptions {
    initialDuration?: number;
    initialFPS?: number;
    autoPlay?: boolean;
    onTimeUpdate?: (time: number) => void;
    onComplete?: () => void;
}

export const useAnimation = (options: UseAnimationOptions = {}) => {
    const {
        initialDuration = 10.0,
        initialFPS = 60,
        autoPlay = false,
        onTimeUpdate,
        onComplete
    } = options;

    const [isPlaying, setIsPlaying] = useState(autoPlay);
    const [time, setTime] = useState(0);
    const [duration, setDuration] = useState(initialDuration);
    const [fps, setFPS] = useState(initialFPS);
    
    const frameRef = useRef<number | null>(null);
    const lastTimeRef = useRef<number>(0);
    const accumulatedTimeRef = useRef<number>(0);

    const play = useCallback(() => setIsPlaying(true), []);
    const pause = useCallback(() => setIsPlaying(false), []);
    const stop = useCallback(() => {
        setIsPlaying(false);
        setTime(0);
        accumulatedTimeRef.current = 0;
    }, []);
    
    const seek = useCallback((newTime: number) => {
        const clampedTime = Math.max(0, Math.min(newTime, duration));
        setTime(clampedTime);
        accumulatedTimeRef.current = clampedTime;
    }, [duration]);

    useEffect(() => {
        if (!isPlaying) {
            if (frameRef.current) {
                cancelAnimationFrame(frameRef.current);
            }
            return;
        }

        const animate = (currentTime: number) => {
            if (lastTimeRef.current === 0) {
                lastTimeRef.current = currentTime;
            }

            const delta = (currentTime - lastTimeRef.current) / 1000; // Convert to seconds
            lastTimeRef.current = currentTime;

            accumulatedTimeRef.current += delta;
            
            if (accumulatedTimeRef.current >= duration) {
                accumulatedTimeRef.current = accumulatedTimeRef.current % duration; // Loop
                if (onComplete) onComplete();
            }

            setTime(accumulatedTimeRef.current);
            if (onTimeUpdate) onTimeUpdate(accumulatedTimeRef.current);

            frameRef.current = requestAnimationFrame(animate);
        };

        frameRef.current = requestAnimationFrame(animate);

        return () => {
            if (frameRef.current) {
                cancelAnimationFrame(frameRef.current);
            }
        };
    }, [isPlaying, duration, onTimeUpdate, onComplete]);

    return {
        isPlaying,
        time,
        duration,
        fps,
        setDuration,
        setFPS,
        play,
        pause,
        stop,
        seek,
        toggle: () => setIsPlaying(prev => !prev)
    };
};
