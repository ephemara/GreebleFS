import { describe, expect, it } from 'vitest';

import type { LoadedLookdevPreset } from '../config/lookdevPresets';
import type { SecondaryWindowDescriptor } from '../generated/tauri';
import {
  LOOKDEV_SECONDARY_WINDOW_ID,
  createLookdevSecondaryWindowOpenRequest,
  isLookdevSecondaryWindowDescriptor,
  parseLookdevSecondaryWindowPayload,
} from '../runtime/lookdevWindow';

const preset: LoadedLookdevPreset = {
  id: 'oxide-lab',
  localId: 'oxide-lab',
  name: 'Oxide Lab',
  description: 'Dense workbench chrome for testing the lookdev tool window.',
  directoryPath: 'usr/lookdev-presets/greeblefs-core/oxide-lab',
  manifestPath: 'usr/lookdev-presets/greeblefs-core/oxide-lab/lookdev-preset.json',
  tags: ['lookdev', 'window'],
  warnings: [],
  exports: {},
  manifest: {
    version: 1,
    id: 'oxide-lab',
    name: 'Oxide Lab',
    shared: {
      appearance: {
        accentColor: '#ffaa44',
      },
    },
  },
};

describe('lookdev secondary window helpers', () => {
  it('creates a dedicated tool-window request with a serialized preset payload', () => {
    const request = createLookdevSecondaryWindowOpenRequest({
      presetId: preset.id,
      preset,
    });

    expect(request.windowId).toBe(LOOKDEV_SECONDARY_WINDOW_ID);
    expect(request.surfaceKind).toBe('lookdev');
    expect(request.presentation).toBe('tool-window');
    expect(request.initialSize).toEqual({ width: 1240, height: 860 });
    expect(request.minSize).toEqual({ width: 760, height: 560 });
    expect(parseLookdevSecondaryWindowPayload(request.payloadJson)).toEqual({
      presetId: preset.id,
      preset,
    });
  });

  it('detects lookdev descriptors by surface kind', () => {
    const descriptor: SecondaryWindowDescriptor = {
      windowId: LOOKDEV_SECONDARY_WINDOW_ID,
      windowLabel: 'secondary-lookdev-lookdev',
      surfaceKind: 'lookdev',
      presentation: 'tool-window',
      title: 'Global Lookdev',
      initialSize: { width: 1240, height: 860 },
      minSize: { width: 760, height: 560 },
      rememberBounds: true,
      sourceWindowLabel: 'main',
      dockTarget: null,
      payloadJson: null,
    };

    expect(isLookdevSecondaryWindowDescriptor(descriptor)).toBe(true);
    expect(isLookdevSecondaryWindowDescriptor({
      ...descriptor,
      surfaceKind: 'panel',
    })).toBe(false);
  });
});
