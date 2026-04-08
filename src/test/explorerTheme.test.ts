import { describe, expect, it } from 'vitest';
import { normalizeThemeDefinition, resolveOverlayAppearance } from '../config/appearance';
import {
  applyExplorerThemeToAdaptiveDensityStop,
  applyExplorerThemeToGridMetrics,
  applyExplorerThemeToRowMetrics,
  resolveExplorerThemeRecipe,
} from '../config/explorerTheme';
import { getAdaptiveSemanticDensityStop } from '../config/explorerExperimentalModes';
import { getExplorerGridMetricsForZoom } from '../config/explorerViewModes';

describe('explorer theme recipe', () => {
  it('resolves xmb-style recipe defaults and keeps custom css vars', () => {
    const appearance = resolveOverlayAppearance({
      customThemes: [
        normalizeThemeDefinition({
          id: 'xmb-shell',
          name: 'XMB Shell',
          explorer: {
            preset: 'xmb',
            railBrandLabel: 'Cross Media',
            cssVars: {
              '--overlay-explorer-brand': 'cross-media',
            },
          },
        }),
      ],
      activeThemeId: 'xmb-shell',
    });

    const recipe = resolveExplorerThemeRecipe(appearance);

    expect(recipe.preset).toBe('xmb');
    expect(recipe.toolbarStyle).toBe('floating');
    expect(recipe.previewStyle).toBe('glass');
    expect(recipe.statusBarStyle).toBe('floating');
    expect(recipe.railBrandLabel).toBe('Cross Media');
    expect(recipe.cssVars['--overlay-explorer-brand']).toBe('cross-media');
  });

  it('scales grid, row, and adaptive metrics through the recipe multipliers', () => {
    const appearance = resolveOverlayAppearance({
      customThemes: [
        normalizeThemeDefinition({
          id: 'channel-grid',
          name: 'Channel Grid',
          explorer: {
            preset: 'channel-grid',
            metrics: {
              gridScale: 1.35,
              iconScale: 1.5,
              rowHeightScale: 1.18,
            },
          },
        }),
      ],
      activeThemeId: 'channel-grid',
    });

    const recipe = resolveExplorerThemeRecipe(appearance);
    const baseGrid = getExplorerGridMetricsForZoom(1);
    const scaledGrid = applyExplorerThemeToGridMetrics(baseGrid, recipe);
    const scaledRows = applyExplorerThemeToRowMetrics({
      rowHeight: 40,
      searchRowHeight: 68,
      newItemHeight: 44,
      iconSize: 18,
    }, recipe);
    const scaledAdaptive = applyExplorerThemeToAdaptiveDensityStop(
      getAdaptiveSemanticDensityStop(0.6),
      recipe,
    );

    expect(scaledGrid.minWidth).toBeGreaterThan(baseGrid.minWidth);
    expect(scaledGrid.iconSize).toBeGreaterThan(baseGrid.iconSize);
    expect(scaledRows?.rowHeight).toBeGreaterThan(40);
    expect(scaledRows?.iconSize).toBeGreaterThan(18);
    expect(scaledAdaptive?.grid?.minHeight).toBeGreaterThan(
      getAdaptiveSemanticDensityStop(0.6).grid?.minHeight ?? 0,
    );
  });
});
