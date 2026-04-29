import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveOverlayAppearance } from '../config/appearance';
import {
  SYNCED_OVERLAY_APPEARANCE_EVENT,
  SYNCED_OVERLAY_APPEARANCE_STORAGE_KEY,
  listenToSyncedOverlayAppearanceSnapshots,
  publishSyncedOverlayAppearanceSnapshot,
  readSyncedOverlayAppearanceSnapshot,
} from '../runtime/appearanceSync';

describe('appearanceSync', () => {
  beforeEach(() => {
    window.localStorage.removeItem(SYNCED_OVERLAY_APPEARANCE_STORAGE_KEY);
  });

  it('publishes a resolved theme snapshot for secondary windows', () => {
    const appearance = resolveOverlayAppearance({
      activeThemeId: 'operator',
      panelTransparency: 0.25,
    });
    const listener = vi.fn();
    const stopListening = listenToSyncedOverlayAppearanceSnapshots(listener);

    const snapshot = publishSyncedOverlayAppearanceSnapshot(appearance);

    stopListening();

    expect(snapshot.themeId).toBe(appearance.theme.id);
    expect(snapshot.cssVars['--overlay-bg-app']).toBe(appearance.cssVars['--overlay-bg-app']);
    expect(snapshot.explorerCssVars['--overlay-explorer-popup-bg']).toBeTruthy();
    expect(window.localStorage.getItem(SYNCED_OVERLAY_APPEARANCE_STORAGE_KEY)).toContain(snapshot.themeId);
    expect(readSyncedOverlayAppearanceSnapshot()).toMatchObject({
      themeId: snapshot.themeId,
      palette: expect.objectContaining({
        accent: appearance.theme.palette.accent,
      }),
    });
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      themeId: snapshot.themeId,
    }));
  });

  it('ignores malformed appearance snapshots', () => {
    window.localStorage.setItem(
      SYNCED_OVERLAY_APPEARANCE_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        themeId: '',
        themeName: '',
        cssVars: {},
        explorerCssVars: {},
      }),
    );

    expect(readSyncedOverlayAppearanceSnapshot()).toBeNull();

    const listener = vi.fn();
    const stopListening = listenToSyncedOverlayAppearanceSnapshots(listener);
    window.dispatchEvent(new CustomEvent(SYNCED_OVERLAY_APPEARANCE_EVENT, {
      detail: { version: 1, themeId: '' },
    }));
    stopListening();

    expect(listener).not.toHaveBeenCalled();
  });
});
