import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';

/**
 * useGlobalShortcut
 *
 * Ctrl+Space is registered natively in the Rust backend (lib.rs) so it works
 * even when the window is hidden. The backend emits 'overlay://toggle-request'
 * when the shortcut fires, so we just listen for that event here instead of
 * double-registering from the frontend (which caused a startup crash).
 *
 * The `shortcut` parameter is kept for API compatibility but ignored — only
 * the 'overlay://toggle-request' event is used.
 */
export function useGlobalShortcut(_shortcut: string, callback: () => void, enabled: boolean = true) {
    useEffect(() => {
        if (!enabled || typeof window === 'undefined' || !(window as any).__TAURI__) return;

        let unlisten: (() => void) | null = null;

        listen('overlay://toggle-request', () => {
            callback();
        }).then(fn => {
            unlisten = fn;
        }).catch(err => {
            console.warn('Failed to listen for overlay toggle event:', err);
        });

        return () => {
            unlisten?.();
        };
    }, [callback, enabled]);
}
