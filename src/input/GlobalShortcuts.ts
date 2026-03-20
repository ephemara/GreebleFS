import { useEffect, useEffectEvent, useRef } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { isRegistered, register, unregister } from '@tauri-apps/plugin-global-shortcut';
import { normalizeKeybindingValue } from '../config/hotkeys';

export function useGlobalShortcut(shortcut: string, callback: () => void, enabled: boolean = true) {
  const registrationGenerationRef = useRef(0);
  const onShortcutPressed = useEffectEvent(callback);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !isTauri()) {
      return;
    }

    const normalizedShortcut = normalizeKeybindingValue(shortcut, 'Ctrl+Space');
    const generation = registrationGenerationRef.current + 1;
    registrationGenerationRef.current = generation;
    let didRegister = false;

    const registerShortcut = async () => {
      try {
        const alreadyRegistered = await isRegistered(normalizedShortcut);
        if (registrationGenerationRef.current !== generation) {
          return;
        }

        if (alreadyRegistered) {
          await unregister(normalizedShortcut);
          if (registrationGenerationRef.current !== generation) {
            return;
          }
        }

        await register(normalizedShortcut, event => {
          if (event.state === 'Pressed') {
            onShortcutPressed();
          }
        });

        if (registrationGenerationRef.current !== generation) {
          await unregister(normalizedShortcut);
          return;
        }

        didRegister = true;
      } catch (error) {
        console.warn(`Failed to register global shortcut "${normalizedShortcut}":`, error);
      }
    };

    void registerShortcut();

    return () => {
      registrationGenerationRef.current += 1;
      if (!didRegister) {
        return;
      }

      void unregister(normalizedShortcut).catch(error => {
        console.warn(`Failed to unregister global shortcut "${normalizedShortcut}":`, error);
      });
    };
  }, [enabled, shortcut]);
}
