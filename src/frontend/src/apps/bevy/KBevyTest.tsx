/**
 * KBevyTest - Test App for Bevy + React Leash Sync
 * 
 * This is a proof-of-concept app that demonstrates the "Leash Dog" architecture:
 * - React UI overlay (this component) controls the UI
 * - Bevy (running as separate process) handles 3D rendering
 * - They sync via UDP IPC (The Leash)
 */

import React, { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Dog, Link, Unlink, RefreshCw, Settings, Activity, Box, Hexagon } from 'lucide-react';
import KTopBar from '../../core/ui/KPanelV2/KTopBar';

interface KBevyTestProps {
    sharedState: any;
}

export default function KBevyTest({ sharedState }: KBevyTestProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [lastSync, setLastSync] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
    const [syncCount, setSyncCount] = useState(0);
    const [bevyVisible, setBevyVisible] = useState(true);

    // Debug Logs Feature
    const [showLogs, setShowLogs] = useState(false);
    const [logs, setLogs] = useState<{ type: 'error' | 'info', msg: string, time: string }[]>([]);
    const [hasNewErrors, setHasNewErrors] = useState(false);

    useEffect(() => {
        // Capture Console Errors
        const originalError = console.error;
        console.error = (...args) => {
            const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
            setLogs(prev => [...prev.slice(-49), { type: 'error', msg, time: new Date().toLocaleTimeString() }]);
            setHasNewErrors(true);
            originalError.apply(console, args);
        };

        // Capture Uncaught Errors
        const errorHandler = (event: ErrorEvent) => {
            setLogs(prev => [...prev.slice(-49), { type: 'error', msg: event.message, time: new Date().toLocaleTimeString() }]);
            setHasNewErrors(true);
        };
        window.addEventListener('error', errorHandler);

        return () => {
            console.error = originalError;
            window.removeEventListener('error', errorHandler);
        };
    }, []);

    // Sync window position to Bevy on mount and resize
    useEffect(() => {
        let animFrame: number;
        let lastPos = { x: 0, y: 0, w: 0, h: 0 };

        const syncPosition = async () => {
            try {
                const win = getCurrentWindow();
                const pos = await win.outerPosition();
                const size = await win.outerSize();

                // Only sync if changed
                if (pos.x !== lastPos.x || pos.y !== lastPos.y ||
                    size.width !== lastPos.w || size.height !== lastPos.h) {

                    // Account for header height (96px = h-24)
                    const headerHeight = 96;

                    await invoke('sync_bevy_window', {
                        x: pos.x,
                        y: pos.y + headerHeight,
                        width: size.width,
                        height: size.height - headerHeight
                    });

                    lastPos = { x: pos.x, y: pos.y, w: size.width, h: size.height };
                    setLastSync({ x: pos.x, y: pos.y + headerHeight, w: size.width, h: size.height - headerHeight });
                    setSyncCount(c => c + 1);
                    setIsConnected(true);
                }
            } catch (e) {
                // Don't log sync errors to our UI logger to avoid noise, just console
                // console.error('Leash sync failed:', e);
                setIsConnected(false);
            }

            animFrame = requestAnimationFrame(syncPosition);
        };

        syncPosition();

        return () => {
            if (animFrame) cancelAnimationFrame(animFrame);
        };
    }, []);

    // Toggle Bevy visibility
    const toggleBevyVisibility = async () => {
        try {
            const newVisible = !bevyVisible;
            await invoke('set_bevy_visible', { visible: newVisible });
            setBevyVisible(newVisible);
        } catch (e) {
            console.error('Failed to toggle Bevy visibility:', e);
        }
    };

    const lastCursorSend = useRef(0);
    const isDraggingRef = useRef(false);

    // Prevent Context Menu on Right Click
    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button === 2) { // Right Click
            isDraggingRef.current = true;
        }
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        if (e.button === 2) {
            isDraggingRef.current = false;
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        const now = window.performance.now();
        if (now - lastCursorSend.current < 8) return; // ~120fps for smoother feel

        const rect = e.currentTarget.getBoundingClientRect();

        // 1. Camera Rotation (Right Click Drag)
        if (isDraggingRef.current) {
            // Send delta movement
            // Bevy expects pixel delta or scaled delta?
            // movementX/Y is purely pixel delta.
            const dx = e.movementX;
            const dy = e.movementY;

            invoke('leash_cam_rotate', { dx, dy }).catch(() => { });
        }
        // 2. Cursor Update (Hover)
        else {
            // Calculate NDC (Normalized Device Coordinates)
            // X: -1 (Left) to 1 (Right)
            // Y: 1 (Top) to -1 (Bottom) - Note: Bevy/OpenGL Y is Up? 
            // Wait, usually OpenGL Y is Up (-1 bottom, 1 top).
            // HTML value: Y is 0 at top, H at bottom.
            // Bevy Camera: viewport_to_world expects NDC.
            // If we map 0 -> 1 (Top) and H -> -1 (Bottom), that matches OpenGL.
            const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

            invoke('leash_cursor', { x, y }).catch(err => {
                // Ignore errors (e.g. backend busy) to prevent log spam
            });
        }

        lastCursorSend.current = now;
    };

    // Mouse wheel for zoom
    const handleWheel = (e: React.WheelEvent) => {
        // deltaY is positive when scrolling down (zoom out), negative for up (zoom in)
        // We invert so scroll up = zoom in (positive delta to Bevy)
        const delta = -e.deltaY * 0.1; // Scale down the delta
        invoke('leash_cam_zoom', { delta }).catch(() => { });
    };

    return (
        <div ref={containerRef} className="w-full h-full relative flex flex-col">
            {/* TOP BAR */}
            <KTopBar
                title="BEVY TEST"
                accentColor="purple"
                left={
                    <div className="flex items-center gap-3">
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold ${isConnected ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                            {isConnected ? <Link size={12} /> : <Unlink size={12} />}
                            {isConnected ? 'LEASH ACTIVE' : 'DISCONNECTED'}
                        </div>
                        <span className="text-[10px] text-gray-500 font-mono">
                            SYNCS: {syncCount}
                        </span>
                    </div>
                }
                right={
                    <div className="flex items-center gap-2">
                        {/* DEBUG NOTIFICATION BUTTON */}
                        <button
                            onClick={() => { setShowLogs(!showLogs); setHasNewErrors(false); }}
                            className={`px-3 py-1.5 rounded text-[10px] font-bold transition-all flex items-center gap-2 ${hasNewErrors
                                ? 'bg-red-500 text-white animate-pulse border border-red-600'
                                : 'bg-gray-800 text-gray-400 border border-gray-700'
                                }`}
                        >
                            <Activity size={12} />
                            {hasNewErrors ? 'ERRORS' : 'LOGS'}
                        </button>

                        <button
                            onClick={toggleBevyVisibility}
                            className={`px-3 py-1.5 rounded text-[10px] font-bold transition-all ${bevyVisible ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-gray-700 text-gray-400 border border-gray-600'}`}
                        >
                            {bevyVisible ? 'HIDE BEVY' : 'SHOW BEVY'}
                        </button>
                    </div>
                }
            />

            {/* LOG VIEWER OVERLAY */}
            {showLogs && (
                <div className="absolute top-12 right-4 w-96 max-h-64 bg-black/90 backdrop-blur-md border border-gray-700 rounded-lg p-2 z-50 overflow-y-auto shadow-2xl font-mono text-[10px]">
                    <div className="flex justify-between items-center mb-2 px-1 border-b border-gray-800 pb-1">
                        <span className="font-bold text-gray-400">CONSOLE LOGS</span>
                        <button onClick={() => setLogs([])} className="text-gray-500 hover:text-white">CLEAR</button>
                    </div>
                    <div className="space-y-1">
                        {logs.length === 0 && <div className="text-gray-600 italic p-2">No logs recorded.</div>}
                        {logs.map((log, i) => (
                            <div key={i} className={`p-1 break-all ${log.type === 'error' ? 'text-red-400 bg-red-900/10' : 'text-gray-300'}`}>
                                <span className="text-gray-600 mr-2">[{log.time}]</span>
                                {log.msg}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TRANSPARENT VIEWPORT AREA - This is where Bevy renders behind */}
            <div
                className="flex-1 relative"
                style={{ backgroundColor: 'transparent' }}
                onMouseMove={handleMouseMove}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onContextMenu={handleContextMenu}
                onMouseLeave={(e) => isDraggingRef.current = false}
                onWheel={handleWheel}
            >



                {/* Corner HUD */}
                <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-2 bg-black/50 backdrop-blur-sm rounded-lg border border-[#333]">
                    <Activity size={14} className={isConnected ? 'text-green-400 animate-pulse' : 'text-red-400'} />
                    <span className="text-[10px] font-mono text-gray-400">
                        UDP:19876
                    </span>
                </div>

                {/* Bevy Indicator */}
                <div className="absolute bottom-4 left-4 flex items-center gap-3 px-4 py-2 bg-black/50 backdrop-blur-sm rounded-lg border border-[#333]">
                    <Hexagon size={16} className="text-purple-400 fill-purple-400/20" />
                    <div className="text-[10px]">
                        <span className="text-gray-500">Bevy Window: </span>
                        <span className={bevyVisible ? 'text-green-400' : 'text-gray-600'}>
                            {bevyVisible ? 'VISIBLE' : 'HIDDEN'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
