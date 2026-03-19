import { useEffect } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { register, unregister } from '@tauri-apps/plugin-global-shortcut';
import { normalizeKeybindingValue } from '../config/hotkeys';

export function useGlobalShortcut(shortcut: string, callback: () => void, enabled: boolean = true) {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !isTauri()) {
      return;
    }

    const normalizedShortcut = normalizeKeybindingValue(shortcut, 'Ctrl+Space');
    let didRegister = false;
    let cancelled = false;

    register(normalizedShortcut, event => {
      if (event.state === 'Pressed') {
        callback();
      }
    })
      .then(() => {
        didRegister = true;
        if (cancelled) {
          void unregister(normalizedShortcut).catch(error => {
            console.warn(`Failed to unregister global shortcut "${normalizedShortcut}":`, error);
          });
        }
      })
      .catch(error => {
        console.warn(`Failed to register global shortcut "${normalizedShortcut}":`, error);
      });

    return () => {
      cancelled = true;
      if (!didRegister) {
        return;
      }

      void unregister(normalizedShortcut).catch(error => {
        console.warn(`Failed to unregister global shortcut "${normalizedShortcut}":`, error);
      });
    };
  }, [callback, enabled, shortcut]);
}
