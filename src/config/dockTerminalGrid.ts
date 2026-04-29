import { overlayWindowGeometry } from './overlayWindow';

export interface DockTerminalGrid {
  rows: number;
  columns: number;
}

export interface DockTerminalSize {
  edgeSize: number;
  edgeWidth: number;
}

export interface DockTerminalGridMeasurementArgs {
  edgeSize: number;
  edgeWidth: number;
  terminalFontSize?: number;
  dockTopBarHeight?: number;
}

export interface DockTerminalSizeMeasurementArgs extends DockTerminalGrid {
  terminalFontSize?: number;
  dockTopBarHeight?: number;
}

export const dockTerminalGridGeometry = {
  defaultRows: 24,
  defaultColumns: 100,
  minRows: 8,
  maxRows: 80,
  minColumns: 40,
  maxColumns: 260,
  defaultTerminalFontSize: 13,
  dockTopBarHeight: 32,
  terminalHorizontalPadding: 64,
  terminalVerticalPadding: 82,
  terminalCellWidthRatio: 0.62,
  terminalCellHeightRatio: 1.38,
} as const;

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clampInteger(value: unknown, fallback: number, min: number, max: number): number {
  const rounded = Math.round(finiteNumber(value, fallback));
  return Math.min(Math.max(rounded, min), max);
}

export function normalizeDockTerminalRows(
  value: unknown,
  fallback: number = dockTerminalGridGeometry.defaultRows,
): number {
  return clampInteger(
    value,
    fallback,
    dockTerminalGridGeometry.minRows,
    dockTerminalGridGeometry.maxRows,
  );
}

export function normalizeDockTerminalColumns(
  value: unknown,
  fallback: number = dockTerminalGridGeometry.defaultColumns,
): number {
  return clampInteger(
    value,
    fallback,
    dockTerminalGridGeometry.minColumns,
    dockTerminalGridGeometry.maxColumns,
  );
}

function resolveDockTerminalCellMetrics(terminalFontSize: unknown): {
  cellWidth: number;
  cellHeight: number;
} {
  const fontSize = Math.max(
    9,
    Math.min(28, finiteNumber(terminalFontSize, dockTerminalGridGeometry.defaultTerminalFontSize)),
  );

  return {
    cellWidth: Math.max(6, fontSize * dockTerminalGridGeometry.terminalCellWidthRatio),
    cellHeight: Math.max(14, fontSize * dockTerminalGridGeometry.terminalCellHeightRatio),
  };
}

export function estimateDockTerminalGridFromSize(
  args: DockTerminalGridMeasurementArgs,
): DockTerminalGrid {
  const { cellWidth, cellHeight } = resolveDockTerminalCellMetrics(args.terminalFontSize);
  const dockTopBarHeight = Math.max(
    0,
    Math.round(finiteNumber(args.dockTopBarHeight, dockTerminalGridGeometry.dockTopBarHeight)),
  );
  const usableWidth = Math.max(
    0,
    finiteNumber(args.edgeWidth, overlayWindowGeometry.defaultWidth) -
      dockTerminalGridGeometry.terminalHorizontalPadding,
  );
  const usableHeight = Math.max(
    0,
    finiteNumber(args.edgeSize, overlayWindowGeometry.defaultHeight) -
      dockTopBarHeight -
      dockTerminalGridGeometry.terminalVerticalPadding,
  );

  return {
    rows: normalizeDockTerminalRows(Math.floor(usableHeight / cellHeight)),
    columns: normalizeDockTerminalColumns(Math.floor(usableWidth / cellWidth)),
  };
}

export function estimateDockSizeFromTerminalGrid(
  args: DockTerminalSizeMeasurementArgs,
): DockTerminalSize {
  const { cellWidth, cellHeight } = resolveDockTerminalCellMetrics(args.terminalFontSize);
  const dockTopBarHeight = Math.max(
    0,
    Math.round(finiteNumber(args.dockTopBarHeight, dockTerminalGridGeometry.dockTopBarHeight)),
  );
  const rows = normalizeDockTerminalRows(args.rows);
  const columns = normalizeDockTerminalColumns(args.columns);

  return {
    edgeSize: Math.max(
      overlayWindowGeometry.minHeight,
      Math.round(rows * cellHeight + dockTopBarHeight + dockTerminalGridGeometry.terminalVerticalPadding),
    ),
    edgeWidth: Math.max(
      overlayWindowGeometry.minWidth,
      Math.round(columns * cellWidth + dockTerminalGridGeometry.terminalHorizontalPadding),
    ),
  };
}

export function formatDockTerminalGrid(grid: DockTerminalGrid): string {
  return `${grid.columns} x ${grid.rows}`;
}
