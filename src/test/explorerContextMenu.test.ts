import { describe, expect, it } from 'vitest';
import { normalizePluginContextMenuContributions } from '../config/explorerContextMenu';
import type { OverlayPluginContextMenuContribution } from '../config/pluginContributions';

describe('explorer context menu normalization', () => {
  it('drops malformed plugin contributions instead of throwing during render', () => {
    expect(() => normalizePluginContextMenuContributions([
      null,
      undefined,
      {
        id: 'broken.plugin-backend',
        pluginId: 'broken',
        pluginName: 'Broken Tools',
        title: 'Broken Backend',
        contexts: ['entry'],
        appliesTo: 'file',
        execution: {
          kind: 'plugin-backend',
          entry: '',
          args: ['{path}'],
        },
      } as unknown as OverlayPluginContextMenuContribution,
      {
        id: 'valid.plugin-backend',
        pluginId: 'valid',
        pluginName: 'Valid Tools',
        title: 'Run Indexer',
        contexts: ['entry'],
        appliesTo: 'file',
        execution: {
          kind: 'plugin-backend',
          entry: 'backend/indexer',
          args: ['{path}', 42 as unknown as string],
        },
      } as unknown as OverlayPluginContextMenuContribution,
    ])).not.toThrow();

    const normalized = normalizePluginContextMenuContributions([
      null,
      {
        id: 'broken.panel',
        pluginId: 'broken',
        pluginName: 'Broken Tools',
        title: 'Broken Panel',
        contexts: ['entry'],
        appliesTo: 'file',
        execution: {
          kind: 'panel-request',
          panelId: '',
          payload: {},
        },
      } as unknown as OverlayPluginContextMenuContribution,
      {
        id: 'valid.plugin-backend',
        pluginId: 'valid',
        pluginName: 'Valid Tools',
        title: 'Run Indexer',
        contexts: ['entry'],
        appliesTo: 'file',
        execution: {
          kind: 'plugin-backend',
          entry: 'backend/indexer',
          args: ['{path}', 42 as unknown as string],
        },
      } as unknown as OverlayPluginContextMenuContribution,
    ]);

    expect(normalized).toHaveLength(1);
    expect(normalized[0]).toMatchObject({
      id: 'valid.plugin-backend',
      pluginId: 'valid',
      pluginName: 'Valid Tools',
      title: 'Run Indexer',
      contexts: ['entry'],
      appliesTo: 'file',
      group: 'plugin',
      iconName: 'Puzzle',
      execution: {
        kind: 'plugin-backend',
        entry: 'backend/indexer',
        args: ['{path}'],
      },
    });
  });

  it('fills safe defaults for malformed optional plugin fields', () => {
    const normalized = normalizePluginContextMenuContributions([
      {
        id: 'sample.command',
        pluginId: '',
        pluginName: '',
        title: '',
        contexts: ['bogus'] as unknown as Array<'entry' | 'background'>,
        appliesTo: 'bogus' as unknown as 'any' | 'file' | 'directory',
        group: 'bogus',
        iconName: '',
        execution: {
          kind: 'terminal-template',
          command: 'echo {path}',
          runOnSelect: 'yes' as unknown as boolean,
        },
      } as unknown as OverlayPluginContextMenuContribution,
    ]);

    expect(normalized).toEqual([
      expect.objectContaining({
        id: 'sample.command',
        pluginId: 'plugin-1',
        pluginName: 'plugin-1',
        title: 'plugin-1',
        contexts: ['entry'],
        appliesTo: 'any',
        group: 'plugin',
        iconName: 'Puzzle',
        execution: {
          kind: 'terminal-template',
          command: 'echo {path}',
          runOnSelect: false,
        },
      }),
    ]);
  });
});
