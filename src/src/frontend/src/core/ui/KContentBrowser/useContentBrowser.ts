import { useState, useEffect, useCallback } from 'react';

export function useContentBrowser(initialState = false) {
    const [isOpen, setIsOpen] = useState(initialState);

    const toggle = useCallback(() => setIsOpen(prev => !prev), []);
    const open = useCallback(() => setIsOpen(true), []);
    const close = useCallback(() => setIsOpen(false), []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Check for Ctrl + Space
            if (e.ctrlKey && e.code === 'Space') {
                e.preventDefault(); // Prevent scroll or other default actions
                toggle();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [toggle]);

    return {
        isOpen,
        toggle,
        open,
        close
    };
}
