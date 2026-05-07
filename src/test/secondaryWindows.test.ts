import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SecondaryWindowDescriptor } from '../generated/tauri';
import {
  getCurrentSecondaryWindowDescriptor,
  listSecondaryWindowDescriptors,
} from '../runtime/secondaryWindows';
import { commands } from '../runtime/tauriClient';

const descriptor: SecondaryWindowDescriptor = {
  windowId: 'workbench-surface-settings',
  windowLabel: 'secondary-panel-workbench-surface-settings',
  surfaceKind: 'panel',
  presentation: 'tool-window',
  title: 'Settings',
  initialSize: { width: 1040, height: 760 },
  minSize: { width: 720, height: 480 },
  rememberBounds: true,
  sourceWindowLabel: 'main',
  dockTarget: {
    surfaceId: 'settings',
    restorePlacement: 'right-sidebar',
  },
  payloadJson: JSON.stringify({ panelId: 'settings' }),
};

describe('secondaryWindows runtime', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the live native descriptor for the current secondary host', async () => {
    vi.spyOn(commands, 'secondaryWindowGetCurrentDescriptor').mockResolvedValue(
      descriptor,
    );

    await expect(getCurrentSecondaryWindowDescriptor()).resolves.toEqual(
      descriptor,
    );
  });

  it('returns null when the current window has no native descriptor', async () => {
    vi.spyOn(commands, 'secondaryWindowGetCurrentDescriptor').mockResolvedValue(
      null,
    );

    await expect(getCurrentSecondaryWindowDescriptor()).resolves.toBeNull();
  });

  it('returns null when the descriptor command is unavailable', async () => {
    vi.spyOn(commands, 'secondaryWindowGetCurrentDescriptor').mockRejectedValue(
      new Error('invoke lane unavailable'),
    );

    await expect(getCurrentSecondaryWindowDescriptor()).resolves.toBeNull();
  });

  it('lists live descriptors through the host-owned secondary-window manager', async () => {
    vi.spyOn(commands, 'secondaryWindowListDescriptors').mockResolvedValue([
      descriptor,
    ]);

    await expect(listSecondaryWindowDescriptors()).resolves.toEqual([
      descriptor,
    ]);
  });
});
