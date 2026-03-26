import { describe, expect, it } from 'vitest';
import { compileThemeEngineManifest, normalizeThemeManifestDraft } from '../runtime/themeEngineBackend';

describe('themeEngineBackend', () => {
  it('compiles render style lookup and default render style', () => {
    const manifest = normalizeThemeManifestDraft({
      id: 'xmb',
      name: 'XMB',
      renderStyles: [
        {
          id: 'xmb-render',
          label: 'XMB Render',
          kind: 'ps-3-xmb',
          entryModule: 'renderers/xmb.tsx',
          supportsLiveSwap: true,
        },
      ],
      defaultRenderStyleId: 'xmb-render',
    });

    const compiled = compileThemeEngineManifest(manifest);
    expect(compiled.defaultRenderStyle?.id).toBe('xmb-render');
    expect(compiled.renderStyleLookup['xmb-render']?.kind).toBe('ps-3-xmb');
    expect(compiled.supportsHotSwappingRenderStyles).toBe(true);
  });

  it('fills defaults for sparse drafts', () => {
    const normalized = normalizeThemeManifestDraft({
      id: 'minimal',
      name: 'Minimal',
    });

    expect(normalized.presentation.density).toBe('comfortable');
    expect(normalized.compatibility.shellBlueprints).toEqual([]);
    expect(normalized.renderStyles).toEqual([]);
  });
});
