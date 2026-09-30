/**
 * updateStore — persisted update-checker state + orchestration.
 *
 * - Persists auto-check prefs, last result, skipped/dismissed tags.
 * - checkForUpdates() is the single entry point (manual or background).
 * - Fires a native OS notification only when a *new* update tag appears and
 *   the user hasn't skipped/dismissed it (best effort, never throws).
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  checkForAppUpdates,
  getCurrentAppVersion,
  UPDATE_FALLBACK_VERSION,
  type UpdateReleaseInfo,
} from '../runtime/updateChecker';

export const UPDATE_AUTO_CHECK_INTERVALS = [
  { id: 'hourly', label: 'Every hour', hours: 1 },
  { id: '6h', label: 'Every 6 hours', hours: 6 },
  { id: '12h', label: 'Every 12 hours', hours: 12 },
  { id: 'daily', label: 'Daily', hours: 24 },
  { id: 'weekly', label: 'Weekly', hours: 168 },
] as const;

export type UpdateAutoCheckIntervalId = (typeof UPDATE_AUTO_CHECK_INTERVALS)[number]['id'];

export function resolveUpdateCheckIntervalHours(id: string | null | undefined): number {
  const hit = UPDATE_AUTO_CHECK_INTERVALS.find(o => o.id === id);
  return hit ? hit.hours : 12;
}

interface UpdateState {
  currentVersion: string;
  latest: UpdateReleaseInfo | null;
  updateAvailable: boolean;
  checking: boolean;
  lastCheckedAt: number | null;
  lastError: string | null;
  autoCheckEnabled: boolean;
  autoCheckIntervalId: UpdateAutoCheckIntervalId;
  skippedVersion: string | null;
  bannerDismissedFor: string | null;
  lastNotifiedTag: string | null;
}

interface UpdateActions {
  initCurrentVersion: () => Promise<void>;
  checkForUpdates: (opts?: { manual?: boolean; notify?: boolean }) => Promise<boolean>;
  dismissBanner: () => void;
  skipVersion: (tag: string) => void;
  clearSkipped: () => void;
  setAutoCheckEnabled: (enabled: boolean) => void;
  setAutoCheckInterval: (id: UpdateAutoCheckIntervalId) => void;
  shouldAutoCheckNow: () => boolean;
}

type UpdateStore = UpdateState & UpdateActions;

async function maybeNotifyNative(title: string, body: string): Promise<void> {
  try {
    const mod = await import('../runtime/nativeNotifications').catch(() => null);
    if (mod && typeof mod.sendNativeNotification === 'function') {
      await mod.sendNativeNotification({ title, body, requestPermission: true }).catch(() => false);
    }
  } catch {
    // notifications are best-effort — banner + settings still show the update
  }
}

export const useUpdateStore = create<UpdateStore>()(
  persist(
    (set, get) => ({
      currentVersion: UPDATE_FALLBACK_VERSION,
      latest: null,
      updateAvailable: false,
      checking: false,
      lastCheckedAt: null,
      lastError: null,
      autoCheckEnabled: true,
      autoCheckIntervalId: '12h',
      skippedVersion: null,
      bannerDismissedFor: null,
      lastNotifiedTag: null,

      initCurrentVersion: async () => {
        try {
          const v = await getCurrentAppVersion();
          if (v && v !== get().currentVersion) set({ currentVersion: v });
        } catch {
          // keep fallback
        }
      },

      checkForUpdates: async (opts) => {
        const manual = opts?.manual === true;
        const notify = opts?.notify ?? true;
        if (get().checking) return get().updateAvailable;
        // Background throttle: skip if checked recently (manual always forces).
        if (!manual && !get().shouldAutoCheckNow() && get().lastCheckedAt != null) {
          return get().updateAvailable;
        }
        set({ checking: true, lastError: null });
        try {
          const result = await checkForAppUpdates();
          const skipped = get().skippedVersion;
          const suppressed = skipped != null && result.latest?.tag === skipped;
          set({
            currentVersion: result.currentVersion,
            latest: result.latest,
            updateAvailable: suppressed ? false : result.updateAvailable,
            lastCheckedAt: result.checkedAt,
            lastError: result.error,
            checking: false,
            // A fresh tag clears a stale per-tag dismissal.
            bannerDismissedFor:
              result.latest && get().bannerDismissedFor !== result.latest.tag
                ? null
                : get().bannerDismissedFor,
          });
          const state = get();
          if (
            notify
            && result.error == null
            && state.updateAvailable
            && state.latest
            && state.lastNotifiedTag !== state.latest.tag
          ) {
            set({ lastNotifiedTag: state.latest.tag });
            const tag = state.latest.tag;
            const name = state.latest.name ?? tag;
            void maybeNotifyNative(
              'GreebleFS update available',
              `${name} is ready — you have v${state.currentVersion}. Open Settings → System → Updates to get it.`,
            );
          }
          return get().updateAvailable;
        } catch (error) {
          set({
            checking: false,
            lastCheckedAt: Date.now(),
            lastError: error instanceof Error ? error.message : String(error),
          });
          return false;
        }
      },

      dismissBanner: () => {
        const tag = get().latest?.tag ?? null;
        set({ bannerDismissedFor: tag });
      },

      skipVersion: (tag) => {
        set({
          skippedVersion: tag,
          updateAvailable: false,
          bannerDismissedFor: tag,
        });
      },

      clearSkipped: () => set({ skippedVersion: null }),

      setAutoCheckEnabled: (enabled) => set({ autoCheckEnabled: enabled }),

      setAutoCheckInterval: (id) => set({ autoCheckIntervalId: id }),

      shouldAutoCheckNow: () => {
        const s = get();
        if (!s.autoCheckEnabled) return false;
        if (s.lastCheckedAt == null) return true;
        const intervalMs = resolveUpdateCheckIntervalHours(s.autoCheckIntervalId) * 3_600_000;
        return Date.now() - s.lastCheckedAt >= intervalMs;
      },
    }),
    {
      name: 'greeblefs-update-state',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        currentVersion: s.currentVersion,
        latest: s.latest,
        updateAvailable: s.updateAvailable,
        lastCheckedAt: s.lastCheckedAt,
        lastError: s.lastError,
        autoCheckEnabled: s.autoCheckEnabled,
        autoCheckIntervalId: s.autoCheckIntervalId,
        skippedVersion: s.skippedVersion,
        bannerDismissedFor: s.bannerDismissedFor,
        lastNotifiedTag: s.lastNotifiedTag,
      } as UpdateState),
    },
  ),
);
