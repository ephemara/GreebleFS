import { describe, expect, it } from 'vitest';
import {
  getExplorerViewModeDefinition,
  normalizeExplorerViewMode,
  resolveEffectiveExplorerViewMode,
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
