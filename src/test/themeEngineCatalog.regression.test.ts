import { describe, expect, it, vi } from 'vitest';

import type { WorkbenchPreset } from '../generated/tauri';
import { commands } from '../runtime/tauriClient';
import {
  compileThemeEngineManifest,
  listThemeEngineCatalog,
  normalizeThemeManifestDraft,
} from '../runtime/themeEngineBackend';

describe('theme engine catalog regressions', () => {
  it('falls back to first entries when blank defaults are supplied across theme slices', () => {
    const manifest = normalizeThemeManifestDraft({
      id: 'cross-theme-defaults',
      name: 'Cross Theme Defaults',
      compatibility: {
        shellBlueprints: ['classic-dock', ' classic-dock ', 'retro-desktop'],
        tags: [' glossy ', 'glossy', 'light'],
      },
      layoutPrimitives: [
        { id: 'dock-shell', name: 'Dock Shell', kind: 'dock', props: { side: 'bottom' } },
      ],
      navigationPatterns: [
        { id: 'dock-nav', name: 'Dock Nav', kind: 'palette', axis: 'horizontal', props: {} },
      ],
      animationProfiles: [
        { id: 'dock-glow', name: 'Dock Glow', durationMs: 180, easing: 'ease-out', intensity: 32 },
      ],
      iconPacks: [
        { id: 'dock-icons', name: 'Dock Icons', style: 'skeuomorphic' },
      ],
      renderStyles: [
        {
          id: 'dock-render',
          label: 'Dock Render',
          kind: 'vs-code-workbench',
          entryModule: 'renderers/dock.tsx',
          supportsLiveSwap: true,
          description: null,
        },
      ],
      defaultLayoutPrimitiveId: '   ',
      defaultNavigationPatternId: ' ',
      defaultAnimationProfileId: '',
      defaultIconPackId: '\t',
      defaultRenderStyleId: '  ',
    });

    const compiled = compileThemeEngineManifest(manifest);

    expect(manifest.compatibility.shellBlueprints).toEqual(['classic-dock', 'retro-desktop']);
    expect(manifest.compatibility.tags).toEqual(['glossy', 'light']);
    expect(manifest.defaultLayoutPrimitiveId).toBeNull();
    expect(manifest.defaultNavigationPatternId).toBeNull();
    expect(manifest.defaultAnimationProfileId).toBeNull();
    expect(manifest.defaultIconPackId).toBeNull();
    expect(manifest.defaultRenderStyleId).toBeNull();
    expect(compiled.defaultLayoutPrimitive?.id).toBe('dock-shell');
    expect(compiled.defaultNavigationPattern?.id).toBe('dock-nav');
    expect(compiled.defaultAnimationProfile?.id).toBe('dock-glow');
    expect(compiled.defaultIconPack?.id).toBe('dock-icons');
    expect(compiled.defaultRenderStyle?.id).toBe('dock-render');
    expect(compiled.supportsHotSwappingRenderStyles).toBe(true);
  });

  it('preserves backend ordering when listing theme manifests alongside workbench presets', async () => {
    const manifests = [
      normalizeThemeManifestDraft({ id: 'vista-glass', name: 'Vista Glass' }),
      normalizeThemeManifestDraft({ id: 'aqua-light', name: 'Aqua Light' }),
    ];
    const presets: WorkbenchPreset[] = [
      {
        id: 'glass-shell',
        label: 'Glass Shell',
        description: 'Glass-first preset',
        shellBlueprint: 'classic-dock',
        navigationModel: 'tabs',
        windowProfile: { mode: 'windowed', anchor: 'center', aspectRatio: '16:10' },
        inputProfile: {
          mode: 'pointer',
          directionalNavigation: true,
          pointerGestures: true,
          density: 'comfortable',
        },
        panelBindings: [],
        preferredThemeIds: ['vista-glass', 'aqua-light'],
      },
      {
        id: 'aqua-shell',
        label: 'Aqua Shell',
        description: 'Light-first preset',
        shellBlueprint: 'retro-desktop',
        navigationModel: 'desktop',
        windowProfile: { mode: 'windowed', anchor: 'top', aspectRatio: '4:3' },
        inputProfile: {
          mode: 'touch',
          directionalNavigation: true,
          pointerGestures: false,
          density: 'compact',
        },
        panelBindings: [],
        preferredThemeIds: ['aqua-light', 'vista-glass'],
      },
    ];

    vi.spyOn(commands, 'domainListThemeManifests').mockResolvedValue(manifests);
    vi.spyOn(commands, 'domainListWorkbenchPresets').mockResolvedValue(presets);

    const catalog = await listThemeEngineCatalog();

    expect(catalog.manifests.map(entry => entry.id)).toEqual(['vista-glass', 'aqua-light']);
    expect(catalog.presets.map(entry => entry.id)).toEqual(['glass-shell', 'aqua-shell']);
    expect(catalog.presets[0]?.preferredThemeIds).toEqual(['vista-glass', 'aqua-light']);
    expect(catalog.presets[1]?.preferredThemeIds).toEqual(['aqua-light', 'vista-glass']);
  });
});
