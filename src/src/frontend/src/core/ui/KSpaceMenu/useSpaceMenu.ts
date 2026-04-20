import { useState, useEffect, useRef } from 'react';

/**
 * Hook to manage the state and activation of a Space Menu.
 * Handles the "Q" hotkey and mouse position tracking.
 */
export function useSpaceMenu(
    initialVisible = false,
    hotkey = 'q'
) {
    const [isOpen, setIsOpen] = useState(initialVisible);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const mousePosRef = useRef({ x: 0, y: 0 });

    // Track mouse global for initial open position
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            mousePosRef.current = { x: e.clientX, y: e.clientY };
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    // Handle Toggle Key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if input is focused (basic check, can be expanded)
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            if (e.key.toLowerCase() === hotkey.toLowerCase() && !e.repeat) {
                if (isOpen) {
                    setIsOpen(false);
                } else {
                    setIsOpen(true);
                    setPosition({ x: mousePosRef.current.x, y: mousePosRef.current.y });
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, hotkey]);

    return {
        isOpen,
        setIsOpen,
        position,
        setPosition
    };
}
