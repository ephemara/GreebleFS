
import React, { useEffect, useRef, useState } from 'react';

interface KGraphosCursorProps {
    brush: {
        size: number;
        color: string;
        erase: boolean;
        hardness: number;
        alphaMap?: any;
        angle?: number;
    };
    zoomRef: React.MutableRefObject<number>;
    viewportRef: React.RefObject<HTMLDivElement>;
    show: boolean;
}

export default function KGraphosCursor({ brush, zoomRef, viewportRef, show }: KGraphosCursorProps) {
    const cursorRef = useRef<HTMLDivElement>(null);
    const outerRingRef = useRef<HTMLDivElement>(null);
    const [isInBounds, setIsInBounds] = useState(false);

    useEffect(() => {
        const handleMove = (e: MouseEvent) => {
            if (!cursorRef.current) return;

            // Check if mouse is within viewport bounds
            if (viewportRef.current) {
                const rect = viewportRef.current.getBoundingClientRect();
                const inBounds =
                    e.clientX >= rect.left &&
                    e.clientX <= rect.right &&
                    e.clientY >= rect.top &&
                    e.clientY <= rect.bottom;
                setIsInBounds(inBounds);
            }

            // Using transform for performance
            cursorRef.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
        };

        window.addEventListener('mousemove', handleMove);
        return () => window.removeEventListener('mousemove', handleMove);
    }, [viewportRef]);

    // Smooth cursor size updates via RAF
    useEffect(() => {
        if (!show) return;

        let rafId: number;
        const updateSize = () => {
            if (outerRingRef.current) {
                const pixelSize = Math.max(4, brush.size * zoomRef.current);
                const outerRing = outerRingRef.current;

                outerRing.style.width = `${pixelSize}px`;
                outerRing.style.height = `${pixelSize}px`;

                if (cursorRef.current) {
                    cursorRef.current.style.marginTop = `${-pixelSize / 2}px`;
                    cursorRef.current.style.marginLeft = `${-pixelSize / 2}px`;
                }
            }
            rafId = requestAnimationFrame(updateSize);
        };

        rafId = requestAnimationFrame(updateSize);
        return () => cancelAnimationFrame(rafId);
    }, [show, brush.size, brush.color, brush.erase, zoomRef]);

    // Don't render if not showing or not in bounds
    if (!show || !isInBounds) return null;

    const initialPixelSize = Math.max(4, brush.size * zoomRef.current);
    const borderColor = brush.erase ? '#f43f5e' : '#ffffff';
    const alphaSrc = brush.alphaMap?.image?.src || (brush.alphaMap?.image instanceof HTMLCanvasElement ? brush.alphaMap.image.toDataURL() : null);

    return (
        <div
            ref={cursorRef}
            className="fixed top-0 left-0 pointer-events-none z-[9999]"
            style={{
                willChange: 'transform',
                marginTop: -initialPixelSize / 2,
                marginLeft: -initialPixelSize / 2
            }}
        >
            {/* OUTER RING (BRUSH SIZE) */}
            <div
                ref={outerRingRef}
                className="rounded-full border flex items-center justify-center relative overflow-hidden"
                style={{
                    width: initialPixelSize,
                    height: initialPixelSize,
                    borderColor: borderColor,
                    borderWidth: '1px',
                    borderStyle: brush.erase ? 'dashed' : 'solid',
                    backgroundColor: brush.erase ? 'rgba(244, 63, 94, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                    boxShadow: '0 0 10px rgba(0,0,0,0.5)',
                    transform: `rotate(${brush.angle || 0}rad)`
                }}
            >
                {/* ALPHA PREVIEW */}
                {alphaSrc && !brush.erase && (
                    <div className="absolute inset-0 w-full h-full flex items-center justify-center">
                        <img
                            src={alphaSrc}
                            className="w-full h-full object-cover"
                            style={{ mixBlendMode: 'difference', opacity: 1.0 }}
                            alt=""
                        />
                    </div>
                )}

                {/* INNER CROSSHAIR */}
                {(!alphaSrc || brush.erase) && (
                    <>
                        <div className="absolute w-[4px] h-[4px] bg-white rounded-full mix-blend-difference" />
                        <div className="absolute w-[1px] h-[10px] bg-white mix-blend-difference" />
                        <div className="absolute w-[10px] h-[1px] bg-white mix-blend-difference" />
                    </>
                )}
            </div>
        </div>
    );
}
