import { invoke } from '@tauri-apps/api/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_SOUND_PACK_ID,
  loadSoundPacksFromDirectoryEntries,
} from '../config/soundPacks';

describe('sound packs', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  it('loads built-in packs, standalone packs, and scoped theme-local packs', async () => {
    vi.mocked(invoke).mockImplementation(async (command: string, args: unknown) => {
      if (command === 'fs_read_text_file') {
        const payload = args as { path?: string } | undefined;
        if (payload?.path === '/workspace/sound-packs/glass-clicks/sound-pack.json') {
          return JSON.stringify({
            id: 'glass-clicks',
            name: 'Glass Clicks',
            masterVolume: 0.84,
            sounds: {
              'shell-button-press': {
                kind: 'synth',
                tones: [
                  { frequency: 880, durationMs: 24, gain: 0.16, waveform: 'triangle' },
                ],
              },
            },
          });
        }

        if (payload?.path === '/workspace/themes/vista-glass/sound-packs/starlight/sound-pack.json') {
          return JSON.stringify({
            id: 'starlight',
            name: 'Starlight',
            sounds: {
              'explorer-selection-step': {
                kind: 'synth',
                tones: [
                  { frequency: 620, durationMs: 18, gain: 0.14, waveform: 'sine' },
                ],
              },
            },
          });
        }
      }

      throw new Error(`Unexpected invoke: ${command} ${JSON.stringify(args)}`);
    });

    const standaloneResult = await loadSoundPacksFromDirectoryEntries(
      [
        {
          name: 'glass-clicks',
          path: '/workspace/sound-packs/glass-clicks',
          is_dir: true,
          extension: '',
          modified: 1710000000,
        },
      ],
      '/workspace/sound-packs',
    );

    expect(standaloneResult.sourceError).toBeNull();
    expect(standaloneResult.warnings).toEqual([]);
    expect(standaloneResult.packs.some(pack => pack.id === DEFAULT_SOUND_PACK_ID)).toBe(true);

    const standalonePack = standaloneResult.packs.find(pack => pack.id === 'glass-clicks');
    expect(standalonePack).toMatchObject({
      id: 'glass-clicks',
      localId: 'glass-clicks',
      name: 'Glass Clicks',
      masterVolume: 0.84,
    });
    expect(standalonePack?.sounds['shell-button-press']?.kind).toBe('synth');

    const scopedResult = await loadSoundPacksFromDirectoryEntries(
      [
        {
          name: 'starlight',
          path: '/workspace/themes/vista-glass/sound-packs/starlight',
          is_dir: true,
          extension: '',
          modified: 1710000001,
        },
      ],
      '/workspace/themes/vista-glass/sound-packs',
      {
        includeBuiltIns: false,
        scopeId: 'vista-glass',
        sourceKind: 'sound-pack-directory',
        sourceLabel: 'Vista Glass',
      },
    );

    expect(scopedResult.sourceError).toBeNull();
    expect(scopedResult.warnings).toEqual([]);
    expect(scopedResult.packs).toHaveLength(1);
    expect(scopedResult.packs[0]).toMatchObject({
      id: 'vista-glass:starlight',
      localId: 'starlight',
      sourceLabel: 'Vista Glass',
    });
  });

  it('prefers an authored sound pack when it redefines the shipped default id', async () => {
    vi.mocked(invoke).mockImplementation(async (command: string, args: unknown) => {
      if (command === 'fs_read_text_file') {
        const payload = args as { path?: string } | undefined;
        if (payload?.path === '/workspace/sound-packs/default/sound-pack.json') {
          return JSON.stringify({
            id: DEFAULT_SOUND_PACK_ID,
            name: 'Usr Default Override',
            masterVolume: 0.5,
            sounds: {
              'shell-button-press': {
                kind: 'synth',
                tones: [
                  { frequency: 510, durationMs: 18, gain: 0.12, waveform: 'sine' },
                ],
              },
            },
          });
        }
      }

      throw new Error(`Unexpected invoke: ${command} ${JSON.stringify(args)}`);
    });

    const result = await loadSoundPacksFromDirectoryEntries(
      [
        {
          name: 'default',
          path: '/workspace/sound-packs/default',
          is_dir: true,
          extension: '',
          modified: 1710000002,
        },
      ],
      '/workspace/sound-packs',
    );

    expect(result.packs).toHaveLength(1);
    expect(result.packs[0]).toMatchObject({
      id: DEFAULT_SOUND_PACK_ID,
      name: 'Usr Default Override',
      masterVolume: 0.5,
      sourceKind: 'sound-pack-directory',
    });
  });
});
