import shippedExplorerZoomBehaviorManifestJson from "../../usr/explorer-zoom-behaviors/greeblefs-core/explorer-zoom-behavior.json";

export type ExplorerZoomGridAnchorId =
  | "icons-xl"
  | "icons-l"
  | "icons-m"
  | "icons-s";

export interface ExplorerZoomGridAnchorMap {
  "icons-xl": number;
  "icons-l": number;
  "icons-m": number;
  "icons-s": number;
}

export interface ExplorerZoomLayoutDomain {
  minimumRowZoom: number;
  gridToTableEnterZoom: number;
  tableToGridExitZoom: number;
  tableToListEnterZoom: number;
  listToTableExitZoom: number;
  columnsDetailsMidpointZoom: number;
  liveGridMaxZoom: number;
}

export interface ExplorerZoomWheelBehavior {
  lineDeltaPixels: number;
  pageDeltaFallbackPixels: number;
  zoomSensitivity: number;
  maxPerEventZoomDelta: number;
  minimumAbsoluteZoomDelta: number;
  commitIdleMs: number;
}

export interface ExplorerZoomOversizeBehavior {
  tileScaleMax: number;
  rowScaleMax: number;
  spacingScaleMax: number;
  paddingScaleMax: number;
  tileRadiusScaleMax: number;
  nameLinesMax: number;
}

export interface ExplorerZoomGridItemPaddingBehavior {
  topRatio: number;
  horizontalRatio: number;
  bottomRatio: number;
  topMinPx: number;
  topMaxPx: number;
  horizontalMinPx: number;
  horizontalMaxPx: number;
  bottomMinPx: number;
  bottomMaxPx: number;
}

export interface ExplorerZoomGridThumbnailRadiusBehavior {
  scale: number;
  minPx: number;
  maxPx: number;
}

export interface ExplorerZoomRowThumbnailStageBehavior {
  addPx: number;
  minPx: number;
  maxPx: number;
}

export interface ExplorerZoomPresentationBehavior {
  gridItemPadding: ExplorerZoomGridItemPaddingBehavior;
  gridThumbnailRadius: ExplorerZoomGridThumbnailRadiusBehavior;
  rowThumbnailStage: ExplorerZoomRowThumbnailStageBehavior;
}

export interface ExplorerZoomHudSegments {
  list: number;
  columns: number;
  details: number;
  grid: number;
  oversize: number;
}

interface ShippedExplorerZoomBehaviorManifest {
  version?: number;
  id?: string;
  name?: string;
  description?: string;
  gridAnchors?: Partial<Record<ExplorerZoomGridAnchorId, number>>;
  layoutDomain?: Partial<ExplorerZoomLayoutDomain>;
  wheel?: Partial<ExplorerZoomWheelBehavior>;
  oversize?: Partial<ExplorerZoomOversizeBehavior>;
  presentation?: {
    gridItemPadding?: Partial<ExplorerZoomGridItemPaddingBehavior>;
    gridThumbnailRadius?: Partial<ExplorerZoomGridThumbnailRadiusBehavior>;
    rowThumbnailStage?: Partial<ExplorerZoomRowThumbnailStageBehavior>;
  };
  hudSegments?: Partial<ExplorerZoomHudSegments>;
}

export interface ExplorerZoomBehaviorManifest {
  version: number;
  id: string;
  name: string;
  description: string;
  gridAnchors: ExplorerZoomGridAnchorMap;
  layoutDomain: ExplorerZoomLayoutDomain;
  wheel: ExplorerZoomWheelBehavior;
  oversize: ExplorerZoomOversizeBehavior;
  presentation: ExplorerZoomPresentationBehavior;
  hudSegments: ExplorerZoomHudSegments;
}

const defaultGridAnchors: ExplorerZoomGridAnchorMap = Object.freeze({
  "icons-s": 0,
  "icons-m": 0.34,
  "icons-l": 0.67,
  "icons-xl": 1,
});

const defaultLayoutDomain: ExplorerZoomLayoutDomain = Object.freeze({
  minimumRowZoom: -0.42,
  gridToTableEnterZoom: -0.08,
  tableToGridExitZoom: 0.04,
  tableToListEnterZoom: -0.3,
  listToTableExitZoom: -0.22,
  columnsDetailsMidpointZoom: -0.16,
  liveGridMaxZoom: 2.8,
});

const defaultWheelBehavior: ExplorerZoomWheelBehavior = Object.freeze({
  lineDeltaPixels: 40,
  pageDeltaFallbackPixels: 320,
  zoomSensitivity: 0.001,
  maxPerEventZoomDelta: 0.12,
  minimumAbsoluteZoomDelta: 0.0005,
  commitIdleMs: 160,
});

const defaultOversizeBehavior: ExplorerZoomOversizeBehavior = Object.freeze({
  tileScaleMax: 3.2,
  rowScaleMax: 2.7,
  spacingScaleMax: 2.05,
  paddingScaleMax: 1.8,
  tileRadiusScaleMax: 1.6,
  nameLinesMax: 4,
});

const defaultPresentationBehavior: ExplorerZoomPresentationBehavior = Object.freeze({
  gridItemPadding: Object.freeze({
    topRatio: 0.1,
    horizontalRatio: 0.08,
    bottomRatio: 0.08,
    topMinPx: 8,
    topMaxPx: 18,
    horizontalMinPx: 6,
    horizontalMaxPx: 14,
    bottomMinPx: 6,
    bottomMaxPx: 14,
  }),
  gridThumbnailRadius: Object.freeze({
    scale: 0.72,
    minPx: 10,
    maxPx: 32,
  }),
  rowThumbnailStage: Object.freeze({
    addPx: 12,
    minPx: 28,
    maxPx: 72,
  }),
});

const defaultHudSegments: ExplorerZoomHudSegments = Object.freeze({
  list: 12,
  columns: 10,
  details: 10,
  grid: 48,
  oversize: 20,
});

const shippedExplorerZoomBehaviorManifest =
  shippedExplorerZoomBehaviorManifestJson as ShippedExplorerZoomBehaviorManifest;

function clampNumber(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function asFiniteNumber(
  value: unknown,
  fallback: number,
  options?: { minimum?: number; maximum?: number },
): number {
  const candidate = typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
  if (!options) {
    return candidate;
  }
  return clampNumber(
    candidate,
    options.minimum ?? Number.NEGATIVE_INFINITY,
    options.maximum ?? Number.POSITIVE_INFINITY,
  );
}

function normalizeGridAnchors(
  value: ShippedExplorerZoomBehaviorManifest["gridAnchors"],
): ExplorerZoomGridAnchorMap {
  return {
    "icons-s": asFiniteNumber(
      value?.["icons-s"],
      defaultGridAnchors["icons-s"],
      { minimum: 0, maximum: defaultGridAnchors["icons-m"] },
    ),
    "icons-m": asFiniteNumber(
      value?.["icons-m"],
      defaultGridAnchors["icons-m"],
      { minimum: defaultGridAnchors["icons-s"], maximum: defaultGridAnchors["icons-l"] },
    ),
    "icons-l": asFiniteNumber(
      value?.["icons-l"],
      defaultGridAnchors["icons-l"],
      { minimum: defaultGridAnchors["icons-m"], maximum: defaultGridAnchors["icons-xl"] },
    ),
    "icons-xl": asFiniteNumber(
      value?.["icons-xl"],
      defaultGridAnchors["icons-xl"],
      { minimum: defaultGridAnchors["icons-l"], maximum: 1 },
    ),
  };
}

function normalizeLayoutDomain(
  value: ShippedExplorerZoomBehaviorManifest["layoutDomain"],
): ExplorerZoomLayoutDomain {
  const minimumRowZoom = asFiniteNumber(
    value?.minimumRowZoom,
    defaultLayoutDomain.minimumRowZoom,
    { maximum: -0.12 },
  );
  const tableToListEnterZoom = asFiniteNumber(
    value?.tableToListEnterZoom,
    defaultLayoutDomain.tableToListEnterZoom,
    { minimum: minimumRowZoom + 0.04, maximum: -0.14 },
  );
  const listToTableExitZoom = asFiniteNumber(
    value?.listToTableExitZoom,
    defaultLayoutDomain.listToTableExitZoom,
    { minimum: tableToListEnterZoom + 0.02, maximum: -0.08 },
  );
  const columnsDetailsMidpointZoom = asFiniteNumber(
    value?.columnsDetailsMidpointZoom,
    defaultLayoutDomain.columnsDetailsMidpointZoom,
    { minimum: listToTableExitZoom - 0.18, maximum: -0.04 },
  );
  const gridToTableEnterZoom = asFiniteNumber(
    value?.gridToTableEnterZoom,
    defaultLayoutDomain.gridToTableEnterZoom,
    { minimum: columnsDetailsMidpointZoom, maximum: 0 },
  );
  const tableToGridExitZoom = asFiniteNumber(
    value?.tableToGridExitZoom,
    defaultLayoutDomain.tableToGridExitZoom,
    { minimum: 0, maximum: 0.18 },
  );
  const liveGridMaxZoom = asFiniteNumber(
    value?.liveGridMaxZoom,
    defaultLayoutDomain.liveGridMaxZoom,
    { minimum: 1, maximum: 4 },
  );

  return {
    minimumRowZoom,
    gridToTableEnterZoom,
    tableToGridExitZoom,
    tableToListEnterZoom,
    listToTableExitZoom,
    columnsDetailsMidpointZoom,
    liveGridMaxZoom,
  };
}

function normalizeWheelBehavior(
  value: ShippedExplorerZoomBehaviorManifest["wheel"],
): ExplorerZoomWheelBehavior {
  return {
    lineDeltaPixels: asFiniteNumber(
      value?.lineDeltaPixels,
      defaultWheelBehavior.lineDeltaPixels,
      { minimum: 1, maximum: 240 },
    ),
    pageDeltaFallbackPixels: asFiniteNumber(
      value?.pageDeltaFallbackPixels,
      defaultWheelBehavior.pageDeltaFallbackPixels,
      { minimum: 1, maximum: 2000 },
    ),
    zoomSensitivity: asFiniteNumber(
      value?.zoomSensitivity,
      defaultWheelBehavior.zoomSensitivity,
      { minimum: 0.0001, maximum: 0.02 },
    ),
    maxPerEventZoomDelta: asFiniteNumber(
      value?.maxPerEventZoomDelta,
      defaultWheelBehavior.maxPerEventZoomDelta,
      { minimum: 0.01, maximum: 1 },
    ),
    minimumAbsoluteZoomDelta: asFiniteNumber(
      value?.minimumAbsoluteZoomDelta,
      defaultWheelBehavior.minimumAbsoluteZoomDelta,
      { minimum: 0, maximum: 0.1 },
    ),
    commitIdleMs: asFiniteNumber(
      value?.commitIdleMs,
      defaultWheelBehavior.commitIdleMs,
      { minimum: 40, maximum: 2000 },
    ),
  };
}

function normalizeOversizeBehavior(
  value: ShippedExplorerZoomBehaviorManifest["oversize"],
): ExplorerZoomOversizeBehavior {
  return {
    tileScaleMax: asFiniteNumber(
      value?.tileScaleMax,
      defaultOversizeBehavior.tileScaleMax,
      { minimum: 1, maximum: 8 },
    ),
    rowScaleMax: asFiniteNumber(
      value?.rowScaleMax,
      defaultOversizeBehavior.rowScaleMax,
      { minimum: 1, maximum: 8 },
    ),
    spacingScaleMax: asFiniteNumber(
      value?.spacingScaleMax,
      defaultOversizeBehavior.spacingScaleMax,
      { minimum: 1, maximum: 6 },
    ),
    paddingScaleMax: asFiniteNumber(
      value?.paddingScaleMax,
      defaultOversizeBehavior.paddingScaleMax,
      { minimum: 1, maximum: 6 },
    ),
    tileRadiusScaleMax: asFiniteNumber(
      value?.tileRadiusScaleMax,
      defaultOversizeBehavior.tileRadiusScaleMax,
      { minimum: 1, maximum: 4 },
    ),
    nameLinesMax: Math.round(asFiniteNumber(
      value?.nameLinesMax,
      defaultOversizeBehavior.nameLinesMax,
      { minimum: 2, maximum: 8 },
    )),
  };
}

function normalizePresentationBehavior(
  value: ShippedExplorerZoomBehaviorManifest["presentation"],
): ExplorerZoomPresentationBehavior {
  return {
    gridItemPadding: {
      topRatio: asFiniteNumber(
        value?.gridItemPadding?.topRatio,
        defaultPresentationBehavior.gridItemPadding.topRatio,
        { minimum: 0, maximum: 1 },
      ),
      horizontalRatio: asFiniteNumber(
        value?.gridItemPadding?.horizontalRatio,
        defaultPresentationBehavior.gridItemPadding.horizontalRatio,
        { minimum: 0, maximum: 1 },
      ),
      bottomRatio: asFiniteNumber(
        value?.gridItemPadding?.bottomRatio,
        defaultPresentationBehavior.gridItemPadding.bottomRatio,
        { minimum: 0, maximum: 1 },
      ),
      topMinPx: asFiniteNumber(
        value?.gridItemPadding?.topMinPx,
        defaultPresentationBehavior.gridItemPadding.topMinPx,
        { minimum: 0, maximum: 64 },
      ),
      topMaxPx: asFiniteNumber(
        value?.gridItemPadding?.topMaxPx,
        defaultPresentationBehavior.gridItemPadding.topMaxPx,
        { minimum: 0, maximum: 96 },
      ),
      horizontalMinPx: asFiniteNumber(
        value?.gridItemPadding?.horizontalMinPx,
        defaultPresentationBehavior.gridItemPadding.horizontalMinPx,
        { minimum: 0, maximum: 64 },
      ),
      horizontalMaxPx: asFiniteNumber(
        value?.gridItemPadding?.horizontalMaxPx,
        defaultPresentationBehavior.gridItemPadding.horizontalMaxPx,
        { minimum: 0, maximum: 96 },
      ),
      bottomMinPx: asFiniteNumber(
        value?.gridItemPadding?.bottomMinPx,
        defaultPresentationBehavior.gridItemPadding.bottomMinPx,
        { minimum: 0, maximum: 64 },
      ),
      bottomMaxPx: asFiniteNumber(
        value?.gridItemPadding?.bottomMaxPx,
        defaultPresentationBehavior.gridItemPadding.bottomMaxPx,
        { minimum: 0, maximum: 96 },
      ),
    },
    gridThumbnailRadius: {
      scale: asFiniteNumber(
        value?.gridThumbnailRadius?.scale,
        defaultPresentationBehavior.gridThumbnailRadius.scale,
        { minimum: 0, maximum: 4 },
      ),
      minPx: asFiniteNumber(
        value?.gridThumbnailRadius?.minPx,
        defaultPresentationBehavior.gridThumbnailRadius.minPx,
        { minimum: 0, maximum: 96 },
      ),
      maxPx: asFiniteNumber(
        value?.gridThumbnailRadius?.maxPx,
        defaultPresentationBehavior.gridThumbnailRadius.maxPx,
        { minimum: 0, maximum: 144 },
      ),
    },
    rowThumbnailStage: {
      addPx: asFiniteNumber(
        value?.rowThumbnailStage?.addPx,
        defaultPresentationBehavior.rowThumbnailStage.addPx,
        { minimum: 0, maximum: 96 },
      ),
      minPx: asFiniteNumber(
        value?.rowThumbnailStage?.minPx,
        defaultPresentationBehavior.rowThumbnailStage.minPx,
        { minimum: 0, maximum: 144 },
      ),
      maxPx: asFiniteNumber(
        value?.rowThumbnailStage?.maxPx,
        defaultPresentationBehavior.rowThumbnailStage.maxPx,
        { minimum: 0, maximum: 192 },
      ),
    },
  };
}

function normalizeHudSegments(
  value: ShippedExplorerZoomBehaviorManifest["hudSegments"],
): ExplorerZoomHudSegments {
  return {
    list: asFiniteNumber(value?.list, defaultHudSegments.list, { minimum: 0, maximum: 100 }),
    columns: asFiniteNumber(
      value?.columns,
      defaultHudSegments.columns,
      { minimum: 0, maximum: 100 },
    ),
    details: asFiniteNumber(
      value?.details,
      defaultHudSegments.details,
      { minimum: 0, maximum: 100 },
    ),
    grid: asFiniteNumber(value?.grid, defaultHudSegments.grid, { minimum: 0, maximum: 100 }),
    oversize: asFiniteNumber(
      value?.oversize,
      defaultHudSegments.oversize,
      { minimum: 0, maximum: 100 },
    ),
  };
}

export const explorerZoomBehavior: ExplorerZoomBehaviorManifest = Object.freeze({
  version: Math.max(1, Math.round(asFiniteNumber(
    shippedExplorerZoomBehaviorManifest.version,
    1,
  ))),
  id:
    typeof shippedExplorerZoomBehaviorManifest.id === "string" &&
      shippedExplorerZoomBehaviorManifest.id.trim().length > 0
      ? shippedExplorerZoomBehaviorManifest.id.trim()
      : "greeblefs-core-explorer-zoom-behavior",
  name:
    typeof shippedExplorerZoomBehaviorManifest.name === "string" &&
      shippedExplorerZoomBehaviorManifest.name.trim().length > 0
      ? shippedExplorerZoomBehaviorManifest.name.trim()
      : "GreebleFS Core Explorer Zoom Behavior",
  description:
    typeof shippedExplorerZoomBehaviorManifest.description === "string" &&
      shippedExplorerZoomBehaviorManifest.description.trim().length > 0
      ? shippedExplorerZoomBehaviorManifest.description.trim()
      : "Canonical Explorer ctrl/cmd-wheel layout zoom behavior.",
  gridAnchors: normalizeGridAnchors(shippedExplorerZoomBehaviorManifest.gridAnchors),
  layoutDomain: normalizeLayoutDomain(
    shippedExplorerZoomBehaviorManifest.layoutDomain,
  ),
  wheel: normalizeWheelBehavior(shippedExplorerZoomBehaviorManifest.wheel),
  oversize: normalizeOversizeBehavior(shippedExplorerZoomBehaviorManifest.oversize),
  presentation: normalizePresentationBehavior(
    shippedExplorerZoomBehaviorManifest.presentation,
  ),
  hudSegments: normalizeHudSegments(shippedExplorerZoomBehaviorManifest.hudSegments),
});

export const explorerGridZoomAnchors = Object.freeze([
  { id: "icons-s" as const, zoom: explorerZoomBehavior.gridAnchors["icons-s"] },
  { id: "icons-m" as const, zoom: explorerZoomBehavior.gridAnchors["icons-m"] },
  { id: "icons-l" as const, zoom: explorerZoomBehavior.gridAnchors["icons-l"] },
  { id: "icons-xl" as const, zoom: explorerZoomBehavior.gridAnchors["icons-xl"] },
]);

export const EXPLORER_LAYOUT_ZOOM_COMMIT_IDLE_MS =
  explorerZoomBehavior.wheel.commitIdleMs;

export function resolveExplorerGridItemPadding(stageSize: number): {
  top: number;
  horizontal: number;
  bottom: number;
} {
  const behavior = explorerZoomBehavior.presentation.gridItemPadding;
  return {
    top: clampNumber(
      Math.round(stageSize * behavior.topRatio),
      behavior.topMinPx,
      Math.max(behavior.topMinPx, behavior.topMaxPx),
    ),
    horizontal: clampNumber(
      Math.round(stageSize * behavior.horizontalRatio),
      behavior.horizontalMinPx,
      Math.max(behavior.horizontalMinPx, behavior.horizontalMaxPx),
    ),
    bottom: clampNumber(
      Math.round(stageSize * behavior.bottomRatio),
      behavior.bottomMinPx,
      Math.max(behavior.bottomMinPx, behavior.bottomMaxPx),
    ),
  };
}

export function resolveExplorerGridThumbnailRadius(tileRadius: number): number {
  const behavior = explorerZoomBehavior.presentation.gridThumbnailRadius;
  return clampNumber(
    Math.round(tileRadius * behavior.scale),
    behavior.minPx,
    Math.max(behavior.minPx, behavior.maxPx),
  );
}

export function resolveExplorerRowThumbnailStageSize(iconSize: number): number {
  const behavior = explorerZoomBehavior.presentation.rowThumbnailStage;
  return clampNumber(
    Math.round(iconSize + behavior.addPx),
    behavior.minPx,
    Math.max(behavior.minPx, behavior.maxPx),
  );
}

export function getNormalizedExplorerZoomWheelPixels(
  event: Pick<WheelEvent, "deltaMode" | "deltaX" | "deltaY">,
  viewportHeight: number,
): { x: number; y: number } {
  const normalizedViewportHeight = Math.max(
    viewportHeight,
    explorerZoomBehavior.wheel.pageDeltaFallbackPixels,
  );
  const pixelScale =
    event.deltaMode === 1
      ? explorerZoomBehavior.wheel.lineDeltaPixels
      : event.deltaMode === 2
        ? normalizedViewportHeight
        : 1;

  return {
    x: event.deltaX * pixelScale,
    y: event.deltaY * pixelScale,
  };
}

export function resolveExplorerLayoutZoomWheelDelta(
  event: Pick<WheelEvent, "deltaMode" | "deltaX" | "deltaY">,
  viewportHeight: number,
): number {
  const { y } = getNormalizedExplorerZoomWheelPixels(event, viewportHeight);
  const delta = clampNumber(
    -y * explorerZoomBehavior.wheel.zoomSensitivity,
    -explorerZoomBehavior.wheel.maxPerEventZoomDelta,
    explorerZoomBehavior.wheel.maxPerEventZoomDelta,
  );
  return Math.abs(delta) < explorerZoomBehavior.wheel.minimumAbsoluteZoomDelta
    ? 0
    : delta;
}

export function getExplorerLayoutZoomHudProgress(layoutZoom: number): number {
  const {
    columnsDetailsMidpointZoom,
    liveGridMaxZoom,
    minimumRowZoom,
    tableToGridExitZoom,
    tableToListEnterZoom,
  } = explorerZoomBehavior.layoutDomain;
  const { columns, details, grid, list, oversize } =
    explorerZoomBehavior.hudSegments;

  let cumulative = 0;

  if (layoutZoom < tableToListEnterZoom) {
    const span = tableToListEnterZoom - minimumRowZoom;
    const t = clamp01(
      span <= 0 ? 0 : (layoutZoom - minimumRowZoom) / span,
    );
    return cumulative + t * list;
  }
  cumulative += list;

  if (layoutZoom < columnsDetailsMidpointZoom) {
    const span = columnsDetailsMidpointZoom - tableToListEnterZoom;
    const t = clamp01(
      span <= 0 ? 0 : (layoutZoom - tableToListEnterZoom) / span,
    );
    return cumulative + t * columns;
  }
  cumulative += columns;

  if (layoutZoom < tableToGridExitZoom) {
    const span = tableToGridExitZoom - columnsDetailsMidpointZoom;
    const t = clamp01(
      span <= 0 ? 0 : (layoutZoom - columnsDetailsMidpointZoom) / span,
    );
    return cumulative + t * details;
  }
  cumulative += details;

  if (layoutZoom <= 1) {
    const span = 1 - tableToGridExitZoom;
    const t = clamp01(
      span <= 0 ? 0 : (layoutZoom - tableToGridExitZoom) / span,
    );
    return cumulative + t * grid;
  }
  cumulative += grid;

  const oversizeSpan = liveGridMaxZoom - 1;
  const oversizeT = clamp01(
    oversizeSpan <= 0 ? 0 : (layoutZoom - 1) / oversizeSpan,
  );
  return cumulative + oversizeT * oversize;
}

function clamp01(value: number): number {
  return clampNumber(value, 0, 1);
}
