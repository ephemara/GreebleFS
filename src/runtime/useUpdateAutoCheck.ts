/**
 * useUpdateAutoCheck — startup + interval driver for the update checker.
 *
 * Call once from App root. Resolves the running version, runs an initial
 * background check when due, then re-checks on the configured interval.
 * Safe to mount in secondary windows (they just share persisted state).
 */

import { useEffect } from 'react';
import { resolveUpdateCheckIntervalHours, useUpdateStore } from '../store/updateStore';

export function useUpdateAutoCheck(): void {
  useEffect(() => {
    let cancelled = false;
    let intervalId: number | null = null;

    const store = useUpdateStore.getState();
    void store.initCurrentVersion().then(() => {
      if (cancelled) return;
      if (useUpdateStore.getState().shouldAutoCheckNow()) {
        void useUpdateStore.getState().checkForUpdates({ manual: false });
      }
    });

    const schedule = () => {
      const hours = resolveUpdateCheckIntervalHours(
        useUpdateStore.getState().autoCheckIntervalId,
      );
      const ms = Math.max(15 * 60_000, hours * 3_600_000);
      intervalId = window.setInterval(() => {
        if (useUpdateStore.getState().shouldAutoCheckNow()) {
          void useUpdateStore.getState().checkForUpdates({ manual: false });
        }
      }, ms);
    };
    schedule();

    // Re-schedule when the user changes the interval toggle.
    const unsub = useUpdateStore.subscribe((s, prev) => {
      if (s.autoCheckIntervalId !== prev.autoCheckIntervalId) {
        if (intervalId != null) window.clearInterval(intervalId);
        schedule();
      }
    });

    return () => {
      cancelled = true;
      if (intervalId != null) window.clearInterval(intervalId);
      unsub();
    };
  }, []);
}
