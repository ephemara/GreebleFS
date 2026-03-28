import { describe, expect, it, vi } from 'vitest';
import { OVERLAY_THEME_MANIFESTS } from '../generated/tauri';
import { commands } from '../runtime/tauriClient';
import {
  compileThemeEngineManifest,
  listThemeEngineCatalog,
  normalizeThemeManifestDraft,
} from '../runtime/themeEngineBackend';

describe('themeEngineBackend', () => {
  it('compiles render style lookup and default render style', () => {
    const manifest = normalizeThemeManifestDraft({
      id: 'xmb',
      name: 'XMB',
      designTokens: [
        {
          id: 'accent',
          name: 'Accent',
          kind: 'color',
          value: '#59e3ff',
        },
      ],
      layoutPrimitives: [
        {
          id: 'crossbar',
          name: 'Crossbar',
          kind: 'dock',
          props: { side: 'top' },
        },
      ],
      navigationPatterns: [
        {
          id: 'xmb-nav',
          name: 'XMB Nav',
          kind: 'xmb',
          axis: 'horizontal',
          props: { categoryDepth: '2' },
        },
      ],
      animationProfiles: [
        {
          id: 'glide',
          name: 'Glide',
          durationMs: 220,
          easing: 'ease-out',
          intensity: 48,
        },
      ],
      iconPacks: [
        {
          id: 'console-icons',
          name: 'Console Icons',
          style: 'vector',
        },
      ],
      renderStyles: [
        {
          id: 'xmb-render',
          label: 'XMB Render',
          kind: 'ps-3-xmb',
          entryModule: 'renderers/xmb.tsx',
          supportsLiveSwap: true,
        },
      ],
      defaultLayoutPrimitiveId: 'crossbar',
      defaultNavigationPatternId: 'xmb-nav',
      defaultAnimationProfileId: 'glide',
      defaultIconPackId: 'console-icons',
      defaultRenderStyleId: 'xmb-render',
    });

    const compiled = compileThemeEngineManifest(manifest);
    expect(compiled.defaultDesignToken?.id).toBe('accent');
    expect(compiled.designTokenLookup.accent?.kind).toBe('color');
    expect(compiled.defaultLayoutPrimitive?.id).toBe('crossbar');
    expect(compiled.layoutPrimitiveLookup.crossbar?.kind).toBe('dock');
    expect(compiled.defaultNavigationPattern?.id).toBe('xmb-nav');
    expect(compiled.navigationPatternLookup['xmb-nav']?.kind).toBe('xmb');
    expect(compiled.defaultAnimationProfile?.id).toBe('glide');
    expect(compiled.animationProfileLookup.glide?.durationMs).toBe(220);
    expect(compiled.defaultIconPack?.id).toBe('console-icons');
    expect(compiled.iconPackLookup['console-icons']?.style).toBe('vector');
    expect(compiled.defaultRenderStyle?.id).toBe('xmb-render');
    expect(compiled.renderStyleLookup['xmb-render']?.kind).toBe('ps-3-xmb');
    expect(compiled.capabilitySummary).toEqual({
      designTokens: 1,
      layoutPrimitives: 1,
      navigationPatterns: 1,
      animationProfiles: 1,
      iconPacks: 1,
      renderStyles: 1,
    });
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

  it('keeps partial presentation overrides and disables render-style hot swapping when none exist', () => {
    const manifest = normalizeThemeManifestDraft({
      id: 'partial',
      name: 'Partial',
      presentation: {
        chromeStyle: 'system',
      },
      compatibility: {
        tags: ['experimental'],
      },
    });

    const compiled = compileThemeEngineManifest(manifest);
    expect(manifest.presentation.chromeStyle).toBe('system');
    expect(manifest.presentation.density).toBe('comfortable');
    expect(manifest.compatibility.tags).toEqual(['experimental']);
    expect(compiled.supportsHotSwappingRenderStyles).toBe(false);
  });

  it('falls back to the first render style when the configured default id is missing', () => {
    const manifest = normalizeThemeManifestDraft({
      id: 'fallback',
      name: 'Fallback',
      renderStyles: [
        {
          id: 'render-a',
          label: 'Render A',
          kind: 'vs-code-workbench',
          entryModule: 'renderers/a.tsx',
          supportsLiveSwap: true,
        },
        {
          id: 'render-b',
          label: 'Render B',
          kind: 'ios-springboard',
          entryModule: 'renderers/b.tsx',
          supportsLiveSwap: true,
        },
      ],
      defaultRenderStyleId: 'missing-render',
    });

    const compiled = compileThemeEngineManifest(manifest);
    expect(compiled.defaultRenderStyle?.id).toBe('render-a');
  });

  it('disables hot swapping when any render style opts out of live swap support', () => {
    const manifest = normalizeThemeManifestDraft({
      id: 'mixed-live-swap',
      name: 'Mixed Live Swap',
      renderStyles: [
        {
          id: 'swap-ok',
          label: 'Swap OK',
          kind: 'vs-code-workbench',
          entryModule: 'renderers/ok.tsx',
          supportsLiveSwap: true,
        },
        {
          id: 'swap-no',
          label: 'Swap No',
          kind: 'ps-3-xmb',
          entryModule: 'renderers/no.tsx',
          supportsLiveSwap: false,
        },
      ],
      defaultRenderStyleId: 'swap-ok',
    });

    const compiled = compileThemeEngineManifest(manifest);
    expect(compiled.supportsHotSwappingRenderStyles).toBe(false);
  });

  it('trims duplicate compatibility entries while preserving explicit render defaults', () => {
    const normalized = normalizeThemeManifestDraft({
      id: 'compat-trimmed',
      name: 'Compat Trimmed',
      compatibility: {
        shellBlueprints: ['classic-dock', ' classic-dock ', 'retro-desktop'],
        tags: [' cinematic ', 'cinematic', 'focused'],
      },
      renderStyles: [
        {
          id: 'render-primary',
          label: 'Render Primary',
          kind: 'vs-code-workbench',
          entryModule: 'renderers/primary.tsx',
          supportsLiveSwap: true,
        },
      ],
      defaultRenderStyleId: 'render-primary',
    });

    expect(normalized.compatibility.shellBlueprints).toEqual(['classic-dock', 'retro-desktop']);
    expect(normalized.compatibility.tags).toEqual(['cinematic', 'focused']);
    expect(normalized.defaultRenderStyleId).toBe('render-primary');
  });

  it('clears blank render defaults while preserving first-entry engine defaults', () => {
    const normalized = normalizeThemeManifestDraft({
      id: 'blank-default',
      name: 'Blank Default',
      layoutPrimitives: [
        {
          id: 'shell',
          name: 'Shell',
          kind: 'split',
          props: { primaryRatio: '0.62' },
        },
      ],
      navigationPatterns: [
        {
          id: 'spatial-nav',
          name: 'Spatial Nav',
          kind: 'spatial',
          axis: 'both',
          props: { breadcrumb: 'true' },
        },
      ],
      renderStyles: [
        {
          id: 'render-primary',
          label: 'Render Primary',
          kind: 'vs-code-workbench',
          entryModule: 'renderers/primary.tsx',
          supportsLiveSwap: true,
        },
      ],
      defaultLayoutPrimitiveId: 'shell',
      defaultNavigationPatternId: 'spatial-nav',
      defaultRenderStyleId: '   ',
    });

    const compiled = compileThemeEngineManifest(normalized);
    expect(normalized.defaultRenderStyleId).toBeNull();
    expect(normalized.defaultLayoutPrimitiveId).toBe('shell');
    expect(normalized.defaultNavigationPatternId).toBe('spatial-nav');
    expect(compiled.defaultLayoutPrimitive?.id).toBe('shell');
    expect(compiled.defaultNavigationPattern?.id).toBe('spatial-nav');
    expect(compiled.defaultRenderStyle?.id).toBe('render-primary');
  });

  it('preserves native ThemeValue shapes from the generated theme catalog', () => {
    const operator = OVERLAY_THEME_MANIFESTS.find(manifest => manifest.id === 'operator');
    const aqua = OVERLAY_THEME_MANIFESTS.find(manifest => manifest.id === 'aqua-light');
    const vintage = OVERLAY_THEME_MANIFESTS.find(manifest => manifest.id === 'vintage-macintosh');

    expect(operator?.designTokens.find(token => token.id === 'panel-spacing')?.value).toBe(8);
    expect(operator?.layoutPrimitives.find(primitive => primitive.id === 'operator-stack')?.props.gap).toBe(8);
    expect(aqua?.layoutPrimitives.find(primitive => primitive.id === 'aqua-shell')?.props.primaryRatio).toBe(0.62);
    expect(aqua?.navigationPatterns.find(pattern => pattern.id === 'aqua-cascade')?.props.breadcrumb).toBe(true);
    expect(vintage?.navigationPatterns.find(pattern => pattern.id === 'vintage-desktop')?.props.menuBar).toBe(true);

    const compiled = compileThemeEngineManifest(aqua!);
    expect(compiled.layoutPrimitiveLookup['aqua-shell']?.props.primaryRatio).toBe(0.62);
    expect(compiled.navigationPatternLookup['aqua-cascade']?.props.breadcrumb).toBe(true);
  });

  it('lists theme manifests and workbench presets from the backend catalog together', async () => {
    const manifests = [
      normalizeThemeManifestDraft({
        id: 'catalog-theme',
        name: 'Catalog Theme',
      }),
    ];
    const presets = [
      {
        id: 'catalog-preset',
        label: 'Catalog Preset',
        description: 'Catalog shell',
        shellBlueprint: 'classic-dock',
        navigationModel: 'hierarchical',
        windowProfile: {
          mode: 'windowed',
          anchor: 'center',
          aspectRatio: '16:10',
        },
        inputProfile: {
          mode: 'pointer',
          directionalNavigation: true,
          pointerGestures: true,
          density: 'comfortable',
        },
        panelBindings: [],
        preferredThemeIds: ['catalog-theme'],
      },
    ];

    const manifestSpy = vi.spyOn(commands, 'domainListThemeManifests').mockResolvedValue(manifests);
    const presetSpy = vi.spyOn(commands, 'domainListWorkbenchPresets').mockResolvedValue(presets);

    const catalog = await listThemeEngineCatalog();

    expect(manifestSpy).toHaveBeenCalledTimes(1);
    expect(presetSpy).toHaveBeenCalledTimes(1);
    expect(catalog.manifests).toEqual(manifests);
    expect(catalog.presets).toEqual(presets);
  });
});
