import { describe, expect, it } from 'vitest';
import {
  getExplorerGridMetricsForZoom,
  getNearestExplorerGridMode,
  getExplorerViewModeDefinition,
  normalizeExplorerGridZoom,
  normalizeExplorerViewMode,
  resolveEffectiveExplorerViewMode,
  stepExplorerGridZoom,
  stepExplorerViewMode,
} from '../config/explorerViewModes';

describe('explorerViewModes', () => {
  it('maps legacy view modes into richer explorer presets', () => {
    expect(normalizeExplorerViewMode('grid')).toBe('icons-l');
    expect(normalizeExplorerViewMode('list')).toBe('details');
    expect(normalizeExplorerViewMode('columns')).toBe('columns');
  });

  it('steps between layout presets in UE-style zoom order', () => {
    expect(stepExplorerViewMode('icons-l', 'larger')).toBe('icons-xl');
    expect(stepExplorerViewMode('icons-l', 'smaller')).toBe('icons-m');
    expect(stepExplorerViewMode('details', 'smaller')).toBe('details');
  });

  it('interpolates grid zoom between the icon presets', () => {
    expect(normalizeExplorerGridZoom(99)).toBe(1);
    expect(stepExplorerGridZoom(0.5, 'larger')).toBeGreaterThan(0.5);
    expect(getNearestExplorerGridMode(0.1)).toBe('icons-m');
    expect(getNearestExplorerGridMode(0.5)).toBe('icons-l');

    const metrics = getExplorerGridMetricsForZoom(0.25);
    expect(metrics.iconSize).toBeGreaterThan(42);
    expect(metrics.iconSize).toBeLessThan(60);
    expect(metrics.minWidth).toBeGreaterThan(122);
    expect(metrics.minWidth).toBeLessThan(152);
  });

  it('falls back from icon grids to details while search is active', () => {
    expect(resolveEffectiveExplorerViewMode('icons-m', { isCompactDock: false, isSearchActive: true })).toBe('details');
    expect(resolveEffectiveExplorerViewMode('columns', { isCompactDock: false, isSearchActive: true })).toBe('columns');
    expect(resolveEffectiveExplorerViewMode('details', { isCompactDock: true, isSearchActive: false })).toBe('list');
  });

  it('exposes stable labels for menu rendering', () => {
    expect(getExplorerViewModeDefinition('icons-xl').label).toBe('XL Icons');
    expect(getExplorerViewModeDefinition('details').shortLabel).toBe('Details');
  });
});
