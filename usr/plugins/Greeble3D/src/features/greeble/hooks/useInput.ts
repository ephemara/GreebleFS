/**
 * K-Greeble Standalone Input Hook
 * Simplified input system for the web demo
 */

import { useEffect, useRef, useCallback } from 'react';
import { DefaultKeyMap, InputActionType } from './keyMap';

type ActionHandler = () => void;

interface InputOptions {
    onActionDown?: Partial<Record<InputActionType, ActionHandler>>;
    onActionUp?: Partial<Record<InputActionType, ActionHandler>>;
    enable?: boolean;
}

export const useInput = (options: InputOptions = {}) => {
    const activeActions = useRef<Set<InputActionType>>(new Set());

    // Helper to identify inputs we should ignore (typing in text fields)
    const shouldIgnore = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement;
        return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
    };

    const getKeyString = (e: KeyboardEvent): string => {
        return e.key.toLowerCase();
    };

    const getActionFromEvent = (e: KeyboardEvent): InputActionType | null => {
        const key = getKeyString(e);

        // Handle Combinations first
        if ((e.ctrlKey || e.metaKey) && key === 'z') {
            return e.shiftKey ? 'REDO' : 'UNDO';
        }
        if ((e.ctrlKey || e.metaKey) && key === 'y') return 'REDO';
        if ((e.ctrlKey || e.metaKey) && key === 's') return 'SAVE';
        if ((e.ctrlKey || e.metaKey) && key === 'd') return 'DUPLICATE';
        if ((e.ctrlKey || e.metaKey) && key === 'a') return 'SELECT_ALL';

        // Fallback to simple map
        return DefaultKeyMap[key] || null;
    };

    const isPressed = useCallback((action: InputActionType) => {
        return activeActions.current.has(action);
    }, []);

    useEffect(() => {
        if (options.enable === false) return;

        const handleDown = (e: KeyboardEvent) => {
            if (shouldIgnore(e)) return;

            const action = getActionFromEvent(e);
            if (action) {
                // Prevent default for common hotkeys to stop browser conflicts
                if (['SAVE', 'UNDO', 'REDO', 'SELECT_ALL'].includes(action)) {
                    e.preventDefault();
                }

                if (!activeActions.current.has(action)) {
                    activeActions.current.add(action);
                    if (options.onActionDown?.[action]) {
                        options.onActionDown[action]!();
                    }
                }
            }
        };

        const handleUp = (e: KeyboardEvent) => {
            if (shouldIgnore(e)) return;

            const action = getActionFromEvent(e);
            if (action) {
                activeActions.current.delete(action);
                if (options.onActionUp?.[action]) {
                    options.onActionUp[action]!();
                }
            }
        };

        // Clear all on window blur to prevent stuck keys
        const handleBlur = () => {
            activeActions.current.clear();
        };

        window.addEventListener('keydown', handleDown);
        window.addEventListener('keyup', handleUp);
        window.addEventListener('blur', handleBlur);

        return () => {
            window.removeEventListener('keydown', handleDown);
            window.removeEventListener('keyup', handleUp);
            window.removeEventListener('blur', handleBlur);
        };
    }, [options]);

    return {
        activeActions,
        isPressed
    };
};
