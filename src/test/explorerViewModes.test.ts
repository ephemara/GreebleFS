import { describe, expect, it } from 'vitest';
import {
  adjustExplorerLayoutZoomState,
  commitExplorerLayoutZoomState,
  createExplorerLayoutZoomState,
  getAdjacentExplorerGridMode,
  getExplorerGridIconMetricsForMode,
  getExplorerGridLayoutMetricsForZoom,
  getExplorerGridMetricsForZoom,
  getNearestExplorerGridMode,
  getExplorerViewModeDefinition,
  normalizeExplorerGridZoom,
  resolveExplorerLayoutZoomState,
  normalizeExplorerViewMode,
  resolveEffectiveExplorerViewMode,
  resolveThemedExplorerViewModes,
  stepExplorerGridZoom,
  stepExplorerViewMode,
} from '../config/explorerViewModes';

describe('explorerViewModes', () => {
  it('maps legacy grid mode and preserves first-class row presets', () => {
    expect(normalizeExplorerViewMode('grid')).toBe('icons-l');
    expect(normalizeExplorerViewMode('list')).toBe('list');
    expect(normalizeExplorerViewMode('columns')).toBe('columns');
  });

  it('steps between layout presets in UE-style zoom order', () => {
    expect(stepExplorerViewMode('icons-l', 'larger')).toBe('icons-xl');
    expect(stepExplorerViewMode('icons-l', 'smaller')).toBe('icons-m');
    expect(stepExplorerViewMode('icons-m', 'smaller')).toBe('icons-s');
    expect(stepExplorerViewMode('details', 'larger')).toBe('list');
    expect(stepExplorerViewMode('list', 'larger')).toBe('columns');
    expect(stepExplorerViewMode('details', 'smaller')).toBe('details');
  });

  it('interpolates grid zoom between the icon presets', () => {
    expect(normalizeExplorerGridZoom(99)).toBe(2.8);
    expect(stepExplorerGridZoom(0.5, 'larger')).toBeGreaterThan(0.5);
    expect(getNearestExplorerGridMode(0.1)).toBe('icons-s');
    expect(getNearestExplorerGridMode(0.5)).toBe('icons-m');

    const layoutMetrics = getExplorerGridLayoutMetricsForZoom(0.25);
    const metrics = getExplorerGridMetricsForZoom(0.25);
    expect(layoutMetrics.minWidth).toBeGreaterThan(94);
    expect(layoutMetrics.minWidth).toBeLessThan(122);
    expect(metrics.iconSize).toBeGreaterThan(
      getExplorerGridIconMetricsForMode('icons-s').iconSize,
    );
    expect(metrics.iconSize).toBeLessThan(
      getExplorerGridIconMetricsForMode('icons-m').iconSize,
    );
  });

  it('extends the live zoom continuum past icons-xl for oversized browsing without changing the durable anchors', () => {
    const oversizedMetrics = getExplorerGridMetricsForZoom(2.8);
    const oversizedLayoutMetrics = getExplorerGridLayoutMetricsForZoom(2.8);

    expect(oversizedLayoutMetrics.minWidth).toBeGreaterThan(560);
    expect(oversizedMetrics.iconStageSize).toBeGreaterThan(
      getExplorerGridIconMetricsForMode('icons-xl').iconStageSize,
    );
    expect(oversizedMetrics.iconSize).toBeGreaterThan(
      getExplorerGridIconMetricsForMode('icons-xl').iconSize,
    );
    expect(oversizedLayoutMetrics.nameLines).toBe(4);
    expect(commitExplorerLayoutZoomState({
      family: 'grid',
      layoutZoom: 2.8,
      storedGridZoom: 2.8,
    })).toEqual({
      viewMode: 'icons-xl',
      gridZoom: 2.8,
    });
  });

  it('treats named icon layouts as anchors while zooming between them', () => {
    expect(getAdjacentExplorerGridMode('icons-l', 'larger')).toBe('icons-xl');
    expect(getAdjacentExplorerGridMode('icons-l', 'smaller')).toBe('icons-m');
    expect(getAdjacentExplorerGridMode('icons-xl', 'smaller')).toBe('icons-l');
    expect(getAdjacentExplorerGridMode('icons-m', 'smaller')).toBe('icons-s');
  });

  it('falls back from icon grids to details while search is active', () => {
    expect(resolveEffectiveExplorerViewMode('icons-m', { isCompactDock: false, isSearchActive: true })).toBe('details');
    expect(resolveEffectiveExplorerViewMode('columns', { isCompactDock: false, isSearchActive: true })).toBe('columns');
    expect(resolveEffectiveExplorerViewMode('details', { isCompactDock: true, isSearchActive: false })).toBe('list');
  });

  it('keeps explicit default explorer mode selections from being re-overridden by theme experimental defaults', () => {
    expect(resolveThemedExplorerViewModes({
      viewMode: 'details',
      experimentalViewMode: 'off',
      preferredViewMode: 'icons-xl',
      preferredExperimentalViewMode: 'adaptive-semantic-grid',
    })).toEqual({
      viewMode: 'icons-xl',
      experimentalViewMode: 'off',
    });

    expect(resolveThemedExplorerViewModes({
      viewMode: 'details',
      experimentalViewMode: 'constellation',
      preferredViewMode: 'icons-xl',
      preferredExperimentalViewMode: 'adaptive-semantic-grid',
    })).toEqual({
      viewMode: 'icons-xl',
      experimentalViewMode: 'constellation',
    });
  });

  it('exposes stable labels for menu rendering', () => {
    expect(getExplorerViewModeDefinition('icons-xl').label).toBe('XL Icons');
    expect(getExplorerViewModeDefinition('icons-s').label).toBe('Small Icons');
    expect(getExplorerViewModeDefinition('details').shortLabel).toBe('Details');
  });

  it('maps persisted settings into the live layout zoom continuum', () => {
    expect(createExplorerLayoutZoomState('icons-m', 0.34)).toMatchObject({
      family: 'grid',
      layoutZoom: 0.34,
      storedGridZoom: 0.34,
    });
    expect(createExplorerLayoutZoomState('details', 0.67)).toMatchObject({
      family: 'table',
      storedGridZoom: 0.67,
    });
  });

  it('crosses from the compact grid boundary into the table family before list mode', () => {
    const compactGrid = createExplorerLayoutZoomState('icons-s', 0);
    const tableState = adjustExplorerLayoutZoomState(compactGrid, -0.12);
    expect(tableState.family).toBe('table');
    expect(resolveExplorerLayoutZoomState(tableState)).toMatchObject({
      family: 'table',
      viewMode: 'details',
      zoomPercent: null,
    });
    const listState = adjustExplorerLayoutZoomState(tableState, -0.24);
    expect(listState.family).toBe('list');
    expect(commitExplorerLayoutZoomState(listState)).toEqual({ viewMode: 'list' });
  });

  it('commits live grid zoom back to the nearest durable icon anchor', () => {
    const seededState = createExplorerLayoutZoomState('icons-l', 0.67);
    const expandedState = adjustExplorerLayoutZoomState(seededState, 0.2);
    const resolvedState = resolveExplorerLayoutZoomState(expandedState);

    expect(resolvedState.family).toBe('grid');
    expect(resolvedState.gridZoom).toBeGreaterThan(0.8);
    expect(commitExplorerLayoutZoomState(expandedState)).toEqual({
      viewMode: 'icons-xl',
      gridZoom: resolvedState.gridZoom,
    });
  });
});
