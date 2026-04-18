import { describe, expect, it } from 'vitest';

import {
  DOCK_WINDOW_HOST_LABEL,
  MAIN_WINDOW_HOST_LABEL,
  hasSeparateWaylandDockHost,
  shouldForceMainWindowStartupMode,
} from '../runtime/windowHost';

describe('windowHost', () => {
  it('enables the separate Wayland dock host only for Linux Wayland sessions', () => {
    expect(hasSeparateWaylandDockHost({
      runtimePlatform: 'linux',
      linuxDisplayServer: 'wayland',
      waylandDockHostEnabled: true,
    })).toBe(true);

    expect(hasSeparateWaylandDockHost({
      runtimePlatform: 'linux',
      linuxDisplayServer: 'x11',
      waylandDockHostEnabled: true,
    })).toBe(false);

    expect(hasSeparateWaylandDockHost({
      runtimePlatform: 'windows',
      linuxDisplayServer: 'wayland',
      waylandDockHostEnabled: true,
    })).toBe(false);
  });

  it('forces the main host back to windowed startup when Wayland overlay handoff would hide it', () => {
    expect(shouldForceMainWindowStartupMode({
      runtimePlatform: 'linux',
      linuxDisplayServer: 'wayland',
      useSeparateWaylandDockHost: true,
      windowMode: 'overlay',
      hostRole: MAIN_WINDOW_HOST_LABEL,
    })).toBe(true);

    expect(shouldForceMainWindowStartupMode({
      runtimePlatform: 'linux',
      linuxDisplayServer: 'wayland',
      useSeparateWaylandDockHost: true,
      windowMode: 'overlay',
      hostRole: DOCK_WINDOW_HOST_LABEL,
    })).toBe(false);

    expect(shouldForceMainWindowStartupMode({
      runtimePlatform: 'linux',
      linuxDisplayServer: 'x11',
      useSeparateWaylandDockHost: true,
      windowMode: 'overlay',
      hostRole: MAIN_WINDOW_HOST_LABEL,
    })).toBe(false);

    expect(shouldForceMainWindowStartupMode({
      runtimePlatform: 'linux',
      linuxDisplayServer: 'wayland',
      useSeparateWaylandDockHost: true,
      windowMode: 'windowed',
      hostRole: MAIN_WINDOW_HOST_LABEL,
    })).toBe(false);
  });
});
