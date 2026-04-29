import { describe, expect, it } from 'vitest';

import {
  dockTerminalGridGeometry,
  estimateDockSizeFromTerminalGrid,
  estimateDockTerminalGridFromSize,
  formatDockTerminalGrid,
  normalizeDockTerminalColumns,
  normalizeDockTerminalRows,
} from '../config/dockTerminalGrid';

describe('dock terminal grid geometry', () => {
  it('normalizes rows and columns into the Yakuake sizing range', () => {
    expect(normalizeDockTerminalRows(1)).toBe(dockTerminalGridGeometry.minRows);
    expect(normalizeDockTerminalRows(999)).toBe(dockTerminalGridGeometry.maxRows);
    expect(normalizeDockTerminalRows(Number.NaN, 32)).toBe(32);

    expect(normalizeDockTerminalColumns(1)).toBe(dockTerminalGridGeometry.minColumns);
    expect(normalizeDockTerminalColumns(999)).toBe(dockTerminalGridGeometry.maxColumns);
    expect(normalizeDockTerminalColumns(Number.NaN, 120)).toBe(120);
  });

  it('round-trips dock pixels through terminal grid estimates', () => {
    const size = estimateDockSizeFromTerminalGrid({
      rows: 30,
      columns: 132,
      terminalFontSize: 13,
      dockTopBarHeight: 32,
    });

    expect(size.edgeSize).toBeGreaterThan(0);
    expect(size.edgeWidth).toBeGreaterThan(0);
    const estimatedGrid = estimateDockTerminalGridFromSize({
      ...size,
      terminalFontSize: 13,
      dockTopBarHeight: 32,
    });
    expect(estimatedGrid.columns).toBe(132);
    expect(estimatedGrid.rows).toBeGreaterThanOrEqual(29);
    expect(estimatedGrid.rows).toBeLessThanOrEqual(30);
  });

  it('formats grid telemetry as columns by rows', () => {
    expect(formatDockTerminalGrid({ columns: 100, rows: 24 })).toBe('100 x 24');
  });
});
