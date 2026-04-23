import { invoke, isTauri } from '@tauri-apps/api/core';
import type { MobileShareThemeSnapshot } from '../config/mobileTheme';

let activeMobileShareThemeSnapshot: MobileShareThemeSnapshot | null = null;

export function getActiveMobileShareThemeSnapshot(): MobileShareThemeSnapshot | null {
  return activeMobileShareThemeSnapshot;
}

export function setActiveMobileShareThemeSnapshot(
  snapshot: MobileShareThemeSnapshot | null,
): void {
  activeMobileShareThemeSnapshot = snapshot;
}

export async function syncMobileShareThemeSnapshot(
  snapshot: MobileShareThemeSnapshot | null = activeMobileShareThemeSnapshot,
): Promise<void> {
  if (!snapshot || !isTauri()) {
    return;
  }

  await invoke('mobile_share_set_theme_snapshot', { snapshot });
}

export async function ensureMobileShareThemeSnapshotSynced(): Promise<void> {
  await syncMobileShareThemeSnapshot(activeMobileShareThemeSnapshot);
}
