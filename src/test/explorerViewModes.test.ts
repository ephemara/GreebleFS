import { describe, expect, it } from 'vitest';
import {
  getAdjacentExplorerGridMode,
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
    expect(normalizeExplorerGridZoom(99)).toBe(1);
    expect(stepExplorerGridZoom(0.5, 'larger')).toBeGreaterThan(0.5);
    expect(getNearestExplorerGridMode(0.1)).toBe('icons-s');
    expect(getNearestExplorerGridMode(0.5)).toBe('icons-m');

    const metrics = getExplorerGridMetricsForZoom(0.25);
    expect(metrics.iconSize).toBeGreaterThan(28);
    expect(metrics.iconSize).toBeLessThan(42);
    expect(metrics.minWidth).toBeGreaterThan(94);
    expect(metrics.minWidth).toBeLessThan(122);
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

  it('exposes stable labels for menu rendering', () => {
    expect(getExplorerViewModeDefinition('icons-xl').label).toBe('XL Icons');
    expect(getExplorerViewModeDefinition('icons-s').label).toBe('Small Icons');
    expect(getExplorerViewModeDefinition('details').shortLabel).toBe('Details');
  });
});
