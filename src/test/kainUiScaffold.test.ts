import { describe, expect, it } from 'vitest';
import { normalizeKainUiScaffold } from '../runtime/kainUiScaffold';

describe('normalizeKainUiScaffold', () => {
  it('keeps valid semantic UI scaffold documents', () => {
    const scaffold = normalizeKainUiScaffold({
      schemaVersion: 1,
      kind: 'greeblefs.ui.scaffold',
      source: 'src-kain/app/main.kn',
      stdlib: 'src-kain/stdlib/greeblefs/ui.kn',
      renderer: 'src/components/kain/KainUiRenderer.tsx',
      summary: 'Semantic scaffold.',
      surfaces: [
        {
          id: 'settings.kain-authoring-proof',
          kind: 'settings-module',
          title: 'Kain UI Authoring Proof',
          summary: 'Proof.',
          mountSlot: 'settings.kain-ui',
          order: 30,
          root: {
            id: 'root',
            kind: 'stack',
            layout: { direction: 'column', gap: 'compact', ignoredObject: { no: true } },
            children: [
              {
                id: 'row',
                kind: 'row',
                title: 'Renderer',
                children: [
                  {
                    id: 'pill',
                    kind: 'status-pill',
                    label: 'wired',
                    active: true,
                    children: [],
                  },
                ],
              },
            ],
          },
        },
      ],
      primitives: [{ kind: 'row', mapsTo: 'SettingsRow', status: 'wired' }],
      tokens: [{ id: 'gap.compact', category: 'spacing', value: 'compact', mapsTo: 'settings' }],
      actions: [{ id: 'kain.ui.reload', label: 'Reload', command: 'tauron.kain.reload', status: 'planned' }],
      consumers: ['src/components/kain/KainUiRenderer.tsx'],
    });

    expect(scaffold?.kind).toBe('greeblefs.ui.scaffold');
    expect(scaffold?.surfaces).toHaveLength(1);
    expect(scaffold?.surfaces[0]?.root?.children[0]?.children[0]?.label).toBe('wired');
    expect(scaffold?.surfaces[0]?.root?.layout).toEqual({ direction: 'column', gap: 'compact' });
    expect(scaffold?.surfaces[0]?.mountSlot).toBe('settings.kain-ui');
    expect(scaffold?.surfaces[0]?.order).toBe(30);
    expect(scaffold?.actions[0]?.id).toBe('kain.ui.reload');
  });

  it('rejects invalid scaffold documents', () => {
    expect(normalizeKainUiScaffold(null)).toBeNull();
    expect(normalizeKainUiScaffold({ schemaVersion: 1, kind: 'wrong' })).toBeNull();
    expect(normalizeKainUiScaffold({ schemaVersion: 0, kind: 'greeblefs.ui.scaffold' })).toBeNull();
  });
});
