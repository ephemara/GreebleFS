import shippedExplorerChromeLayoutManifestJson from "../../usr/profiles/default/explorer-chrome-layouts/greeblefs-core/explorer-chrome-layout.json";
export type ExplorerChromeSurfaceId =
  | "explorerTopbar"
  | "explorerToolbar"
  | "workspaceHeader"
  | "railHeader"
  | "previewHeader"
  | "explorerStatusBar";

export type ExplorerChromeZoneId =
  | "start"
  | "center"
  | "end"
  | "primaryStart"
  | "primaryCenter"
  | "primaryEnd"
  | "secondaryStart"
  | "secondaryEnd";

export type BuiltInExplorerChromeLayoutId = "default" | "focused-search";
export type ExplorerChromeLayoutId =
  | BuiltInExplorerChromeLayoutId
  | (string & {});

export type BuiltInExplorerChromeControlId =
  | "navigateBack"
  | "navigateForward"
  | "navigateUp"
  | "addressBar"
  | "recentLocations"
  | "pinnedLocations"
  | "archiveActions"
  | "folderSizeSummary"
  | "selectionSizeSummary"
  | "pinLocation"
  | "toggleSearchContent"
  | "semanticIndexBuild"
  | "semanticIndexRebuild"
  | "semanticIndexClear"
  | "saveSearch"
  | "batchRename"
  | "openPropertiesPanel"
  | "tagSelection"
  | "duplicateScan"
  | "undoTrash"
  | "toggleSources"
  | "focusAddressBar"
  | "experimentalModes"
  | "customizeModeToggle"
  | "shellLayout"
  | "viewLayout"
  | "togglePreview"
  | "actionsPaneToggle"
  | "selectionModeToggle"
  | "toggleHiddenFiles"
  | "refresh"
  | "customizeHome"
  | "refreshHome"
  | "openUserHome"
  | "newFolder"
  | "newFile"
  | "pasteClipboard"
  | "workspacePaneCounts"
  | "workspaceMode"
  | "workspaceCommanderSummary"
  | "workspaceLayoutHint"
  | "workspaceTabStrip"
  | "workspaceTabs"
  | "workspaceNewTab"
  | "workspacePaneActionsMenu"
  | "workspaceDuplicateTab"
  | "workspaceFocusLeft"
  | "workspaceFocusRight"
  | "workspaceMoveTab"
  | "workspaceSyncPath"
  | "workspaceLinkNavigation"
  | "workspaceCopyToPane"
  | "workspaceMoveToPane"
  | "workspaceSwapPane"
  | "workspaceSplitToggle"
  | "workspaceCloseTab"
  | "workspaceSplitSummary"
  | "workspaceSplitNudgeLeft"
  | "workspaceSplitReset"
  | "workspaceSplitNudgeRight"
  | "railIdentity"
  | "railBookmarkSummary"
  | "railClose"
  | "railManageToggle"
  | "previewIdentity"
  | "previewState"
  | "previewNavigateBack"
  | "previewModeToggle"
  | "previewSplitToggle"
  | "previewLockToggle"
  | "previewCopyPath"
  | "previewTerminalToggle"
  | "previewClose"
  | "statusItemCount"
  | "statusSelectionMode"
  | "statusSelectionSummary"
  | "statusModeProfile"
  | "statusViewSummary"
  | "statusPreviewSummary"
  | "statusLabsSummary"
  | "statusSearchSummary"
  | "statusTaskBadge"
  | "statusClipboardQueue"
  | "statusPreviewLoading"
  | "terminalDrawerToggle"
  | "statusViewToggles";

export type ExplorerChromeControlId =
  | BuiltInExplorerChromeControlId
  | `plugin:${string}`
  | `action:${string}`;

export type ExplorerChromeSizeVariant = "compact" | "regular" | "wide";

export interface ExplorerChromeControlDefinition {
  id: ExplorerChromeControlId;
  label: string;
  surfaces: ExplorerChromeSurfaceId[];
}

export interface ExplorerChromeSlotDefinition {
  zone: ExplorerChromeZoneId;
  order: number;
  bandId?: string;
  anchorX?: number;
  anchorY?: number;
  offsetPx?: number;
  grow?: number;
  shrink?: number;
  collapsePriority?: number;
  overflowEligible?: boolean;
  sizeVariant?: ExplorerChromeSizeVariant;
  widthPx?: number;
  showLabel?: boolean;
  showIcon?: boolean;
}

export interface ExplorerChromeLayoutDefinition {
  id: ExplorerChromeLayoutId;
  label: string;
  placements: Partial<
    Record<
      ExplorerChromeControlId,
      Partial<Record<ExplorerChromeSurfaceId, ExplorerChromeSlotDefinition>>
    >
  >;
}

export interface ExplorerChromeOverrideEntry {
  controlId: ExplorerChromeControlId;
  surfaceId: ExplorerChromeSurfaceId;
  zone: ExplorerChromeZoneId;
  order: number;
  bandId?: string;
  anchorX?: number;
  anchorY?: number;
  offsetPx?: number;
  hidden?: boolean;
  sizeVariant?: ExplorerChromeSizeVariant;
  widthPx?: number;
  showLabel?: boolean;
  showIcon?: boolean;
}

export interface ExplorerChromeOverrideSnapshot {
  entries: ExplorerChromeOverrideEntry[];
}

export interface ExplorerChromeResolvedControlPlacement extends ExplorerChromeSlotDefinition {
  controlId: ExplorerChromeControlId;
  surfaceId: ExplorerChromeSurfaceId;
  bandId?: string;
  anchorX?: number;
  anchorY?: number;
  offsetPx?: number;
  hidden?: boolean;
  sizeVariant?: ExplorerChromeSizeVariant;
  widthPx?: number;
  showLabel?: boolean;
  showIcon?: boolean;
}

export interface ExplorerChromeResolvedZone {
  id: ExplorerChromeZoneId;
  controls: ExplorerChromeResolvedControlPlacement[];
}

export interface ExplorerChromeResolvedRow {
  id: string;
  zones: ExplorerChromeResolvedZone[];
}

export interface ExplorerChromeResolvedSurface {
  surfaceId: ExplorerChromeSurfaceId;
  rows: ExplorerChromeResolvedRow[];
  visibleControlIds: ExplorerChromeControlId[];
}

interface ExplorerChromeSurfaceDefinition {
  id: ExplorerChromeSurfaceId;
  rows: Array<{
    id: string;
    zones: ExplorerChromeZoneId[];
  }>;
}

interface ShippedExplorerChromeLayoutManifest {
  chromeLayouts?: ExplorerChromeLayoutDefinition[];
}

const explorerChromeSurfaceDefinitions: Record<
  ExplorerChromeSurfaceId,
  ExplorerChromeSurfaceDefinition
> = {
  explorerTopbar: {
    id: "explorerTopbar",
    rows: [
      {
        id: "primary",
        zones: ["start", "center", "end"],
      },
    ],
  },
  explorerToolbar: {
    id: "explorerToolbar",
    rows: [
      {
        id: "primary",
        zones: ["primaryStart", "primaryCenter", "primaryEnd"],
      },
      {
        id: "secondary",
        zones: ["secondaryStart", "secondaryEnd"],
      },
    ],
  },
  workspaceHeader: {
    id: "workspaceHeader",
    rows: [
      {
        id: "primary",
        zones: ["start", "center", "end"],
      },
    ],
  },
  railHeader: {
    id: "railHeader",
    rows: [
      {
        id: "primary",
        zones: ["start", "center", "end"],
      },
    ],
  },
  previewHeader: {
    id: "previewHeader",
    rows: [
      {
        id: "primary",
        zones: ["start", "center", "end"],
      },
    ],
  },
  explorerStatusBar: {
    id: "explorerStatusBar",
    rows: [
      {
        id: "primary",
        zones: ["start", "center", "end"],
      },
    ],
  },
};

const builtInExplorerChromeLayoutOrder = [
  "default",
  "focused-search",
] as const satisfies readonly BuiltInExplorerChromeLayoutId[];

const explorerChromeZoneSurfaceMap = Object.values(
  explorerChromeSurfaceDefinitions,
).reduce((map, surface) => {
  for (const row of surface.rows) {
    for (const zone of row.zones) {
      const currentSurfaceIds = map.get(zone) ?? [];
      if (!currentSurfaceIds.includes(surface.id)) {
        currentSurfaceIds.push(surface.id);
      }
      map.set(zone, currentSurfaceIds);
    }
  }
  return map;
}, new Map<ExplorerChromeZoneId, ExplorerChromeSurfaceId[]>());

export const defaultExplorerChromeLayoutId: BuiltInExplorerChromeLayoutId =
  "default";

function cloneExplorerChromeSlotDefinition(
  slot: ExplorerChromeSlotDefinition,
): ExplorerChromeSlotDefinition {
  return { ...slot };
}

function cloneExplorerChromeLayoutDefinition(
  layout: ExplorerChromeLayoutDefinition,
): ExplorerChromeLayoutDefinition {
  const placements: ExplorerChromeLayoutDefinition["placements"] = {};
  for (const [controlId, surfacePlacements] of Object.entries(
    layout.placements ?? {},
  )) {
    const nextSurfacePlacements: Partial<
      Record<ExplorerChromeSurfaceId, ExplorerChromeSlotDefinition>
    > = {};
    for (const [surfaceId, slotDefinition] of Object.entries(
      surfacePlacements ?? {},
    )) {
      if (!slotDefinition) {
        continue;
      }
      nextSurfacePlacements[surfaceId as ExplorerChromeSurfaceId] =
        cloneExplorerChromeSlotDefinition(slotDefinition);
    }
    placements[controlId as ExplorerChromeControlId] = nextSurfacePlacements;
  }

  return {
    ...layout,
    placements,
  };
}

function resolveBuiltInExplorerChromeLayouts(
  manifest: ShippedExplorerChromeLayoutManifest | null | undefined,
): Record<BuiltInExplorerChromeLayoutId, ExplorerChromeLayoutDefinition> {
  const shippedExplorerChromeLayouts = Array.isArray(manifest?.chromeLayouts)
    ? manifest.chromeLayouts.map(cloneExplorerChromeLayoutDefinition)
    : [];
  const shippedExplorerChromeLayoutById = new Map(
    shippedExplorerChromeLayouts.map((layout) => [layout.id, layout] as const),
  );

  return Object.fromEntries(
    builtInExplorerChromeLayoutOrder.map((layoutId) => {
      const layout = shippedExplorerChromeLayoutById.get(layoutId);
      if (!layout) {
        throw new Error(`Missing shipped explorer chrome layout: ${layoutId}`);
      }
      return [layoutId, cloneExplorerChromeLayoutDefinition(layout)] as const;
    }),
  ) as Record<BuiltInExplorerChromeLayoutId, ExplorerChromeLayoutDefinition>;
}

let builtInExplorerChromeLayouts =
  {} as Record<BuiltInExplorerChromeLayoutId, ExplorerChromeLayoutDefinition>;

export function applyUsrExplorerChromeLayoutManifest(
  manifest: ShippedExplorerChromeLayoutManifest | null | undefined,
): void {
  builtInExplorerChromeLayouts = resolveBuiltInExplorerChromeLayouts(manifest);
}

applyUsrExplorerChromeLayoutManifest(
  shippedExplorerChromeLayoutManifestJson as ShippedExplorerChromeLayoutManifest,
);

function isExplorerChromeSurfaceId(
  value: unknown,
): value is ExplorerChromeSurfaceId {
  return (
    value === "explorerTopbar" ||
    value === "explorerToolbar" ||
    value === "workspaceHeader" ||
    value === "railHeader" ||
    value === "previewHeader" ||
    value === "explorerStatusBar"
  );
}

function isExplorerChromeZoneId(value: unknown): value is ExplorerChromeZoneId {
  return (
    typeof value === "string" &&
    explorerChromeZoneSurfaceMap.has(value as ExplorerChromeZoneId)
  );
}

function isValidZoneForSurface(
  surfaceId: ExplorerChromeSurfaceId,
  zone: ExplorerChromeZoneId,
): boolean {
  return explorerChromeZoneSurfaceMap.get(zone)?.includes(surfaceId) ?? false;
}

function asFiniteInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value)
    : null;
}

function asTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function asBooleanOrUndefined(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function normalizeExplorerChromeSizeVariant(
  value: unknown,
): ExplorerChromeSizeVariant | undefined {
  return value === "compact" || value === "wide" || value === "regular"
    ? value
    : undefined;
}

function normalizeExplorerChromeWidthPx(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.max(56, Math.min(1600, Math.round(value)));
}

function normalizeExplorerChromeOffsetPx(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.max(0, Math.min(4000, Math.round(value)));
}

function normalizeExplorerChromeAnchorCoordinate(
  value: unknown,
): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.round(value);
}

const explorerChromeFlexibleSurfaceSupport: Partial<
  Record<BuiltInExplorerChromeControlId, ExplorerChromeSurfaceId[]>
> = {
  addressBar: [
    "explorerTopbar",
    "explorerToolbar",
    "workspaceHeader",
    "previewHeader",
    "explorerStatusBar",
  ],
  workspaceTabStrip: [
    "explorerTopbar",
    "explorerToolbar",
    "workspaceHeader",
    "previewHeader",
    "explorerStatusBar",
  ],
  statusTaskBadge: [
    "explorerTopbar",
    "explorerToolbar",
    "workspaceHeader",
    "previewHeader",
    "explorerStatusBar",
  ],
  statusSearchSummary: [
    "explorerTopbar",
    "explorerToolbar",
    "workspaceHeader",
    "previewHeader",
    "explorerStatusBar",
  ],
  statusClipboardQueue: [
    "explorerTopbar",
    "explorerToolbar",
    "workspaceHeader",
    "previewHeader",
    "explorerStatusBar",
  ],
  statusPreviewSummary: [
    "explorerTopbar",
    "explorerToolbar",
    "workspaceHeader",
    "previewHeader",
    "explorerStatusBar",
  ],
  statusViewSummary: [
    "explorerTopbar",
    "explorerToolbar",
    "workspaceHeader",
    "previewHeader",
    "explorerStatusBar",
  ],
  statusModeProfile: [
    "explorerTopbar",
    "explorerToolbar",
    "workspaceHeader",
    "previewHeader",
    "explorerStatusBar",
  ],
  statusItemCount: [
    "explorerTopbar",
    "explorerToolbar",
    "workspaceHeader",
    "previewHeader",
    "explorerStatusBar",
  ],
};

export function normalizeExplorerChromeLayoutId(
  value: unknown,
): ExplorerChromeLayoutId {
  const trimmed = asTrimmedString(value);
  return trimmed ?? defaultExplorerChromeLayoutId;
}

export function getExplorerChromeSurfaceDefinition(
  surfaceId: ExplorerChromeSurfaceId,
): ExplorerChromeSurfaceDefinition {
  return explorerChromeSurfaceDefinitions[surfaceId];
}

export function getExplorerChromeLayoutDefinition(
  layoutId?: ExplorerChromeLayoutId | null,
): ExplorerChromeLayoutDefinition {
  const normalizedId = normalizeExplorerChromeLayoutId(layoutId);
  return (
    builtInExplorerChromeLayouts[
      normalizedId as BuiltInExplorerChromeLayoutId
    ] ?? builtInExplorerChromeLayouts[defaultExplorerChromeLayoutId]
  );
}

export function listBuiltInExplorerChromeControlIds(): BuiltInExplorerChromeControlId[] {
  const builtInIds = new Set<BuiltInExplorerChromeControlId>();
  for (const layout of Object.values(builtInExplorerChromeLayouts)) {
    for (const controlId of Object.keys(
      layout.placements,
    ) as BuiltInExplorerChromeControlId[]) {
      builtInIds.add(controlId);
    }
  }
  return Array.from(builtInIds).sort();
}

export function getSupportedExplorerChromeSurfaces(
  controlId: ExplorerChromeControlId,
): ExplorerChromeSurfaceId[] {
  const supportedSurfaces = new Set<ExplorerChromeSurfaceId>();
  const flexibleSupport =
    explorerChromeFlexibleSurfaceSupport[
      controlId as BuiltInExplorerChromeControlId
    ] ?? [];
  for (const surfaceId of flexibleSupport) {
    supportedSurfaces.add(surfaceId);
  }
  for (const layout of Object.values(builtInExplorerChromeLayouts)) {
    const placements = layout.placements[controlId];
    if (!placements) {
      continue;
    }
    for (const surfaceId of Object.keys(
      placements,
    ) as ExplorerChromeSurfaceId[]) {
      supportedSurfaces.add(surfaceId);
    }
  }
  return Array.from(supportedSurfaces);
}

export function normalizeExplorerChromeOverrideSnapshot(
  value: unknown,
): ExplorerChromeOverrideSnapshot {
  const entries = Array.isArray(
    (value as ExplorerChromeOverrideSnapshot | undefined)?.entries,
  )
    ? (value as ExplorerChromeOverrideSnapshot).entries
    : [];
  const normalizedEntries = new Map<
    ExplorerChromeControlId,
    ExplorerChromeOverrideEntry
  >();

  for (const entry of entries) {
    const controlId = asTrimmedString(
      entry?.controlId,
    ) as ExplorerChromeControlId | null;
    const surfaceId = entry?.surfaceId;
    const zone = entry?.zone;
    const order = asFiniteInteger(entry?.order);
    const bandId = asTrimmedString(entry?.bandId);
    const anchorX = normalizeExplorerChromeAnchorCoordinate(entry?.anchorX);
    const anchorY = normalizeExplorerChromeAnchorCoordinate(entry?.anchorY);
    const offsetPx = normalizeExplorerChromeOffsetPx(entry?.offsetPx);
    const hidden = asBooleanOrUndefined(entry?.hidden) ?? false;
    const sizeVariant = normalizeExplorerChromeSizeVariant(entry?.sizeVariant);
    const widthPx = normalizeExplorerChromeWidthPx(entry?.widthPx);
    const showLabel = asBooleanOrUndefined(entry?.showLabel);
    const showIcon = asBooleanOrUndefined(entry?.showIcon);

    if (
      !controlId ||
      !isExplorerChromeSurfaceId(surfaceId) ||
      !isExplorerChromeZoneId(zone) ||
      order == null ||
      !isValidZoneForSurface(surfaceId, zone)
    ) {
      continue;
    }

    normalizedEntries.set(controlId, {
      controlId,
      surfaceId,
      zone,
      order,
      bandId: bandId ?? undefined,
      anchorX,
      anchorY,
      offsetPx,
      hidden,
      sizeVariant,
      widthPx,
      showLabel,
      showIcon,
    });
  }

  return {
    entries: Array.from(normalizedEntries.values()),
  };
}

export function normalizeExplorerChromeOverrideSnapshotMap(
  value: unknown,
): Record<string, Record<string, ExplorerChromeOverrideSnapshot>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([themeId, themeOverrides]) => {
        const trimmedThemeId = themeId.trim();
        if (
          !trimmedThemeId ||
          !themeOverrides ||
          typeof themeOverrides !== "object" ||
          Array.isArray(themeOverrides)
        ) {
          return [trimmedThemeId, {}] as const;
        }

        const normalizedThemeOverrides = Object.fromEntries(
          Object.entries(themeOverrides as Record<string, unknown>)
            .map(([layoutId, snapshot]) => {
              const trimmedLayoutId = layoutId.trim();
              if (!trimmedLayoutId) {
                return null;
              }

              return [
                trimmedLayoutId,
                normalizeExplorerChromeOverrideSnapshot(snapshot),
              ] as const;
            })
            .filter(
              (
                entry,
              ): entry is readonly [string, ExplorerChromeOverrideSnapshot] =>
                entry != null,
            ),
        );

        return [trimmedThemeId, normalizedThemeOverrides] as const;
      })
      .filter(
        (
          entry,
        ): entry is readonly [
          string,
          Record<string, ExplorerChromeOverrideSnapshot>,
        ] => Boolean(entry[0]),
      ),
  );
}

function getOverridePlacementMap(
  override?: ExplorerChromeOverrideSnapshot | null,
): Map<ExplorerChromeControlId, ExplorerChromeOverrideEntry> {
  const normalized = normalizeExplorerChromeOverrideSnapshot(override);
  return new Map(normalized.entries.map((entry) => [entry.controlId, entry]));
}

function getBasePlacement(
  layout: ExplorerChromeLayoutDefinition,
  controlId: ExplorerChromeControlId,
  surfaceId: ExplorerChromeSurfaceId,
): ExplorerChromeResolvedControlPlacement | null {
  const placement =
    layout.placements[controlId]?.[surfaceId] ??
    (surfaceId === "explorerTopbar"
      ? layout.placements[controlId]?.workspaceHeader
      : undefined);
  if (!placement) {
    return null;
  }

  return {
    controlId,
    surfaceId,
    ...placement,
    offsetPx: 0,
    hidden: false,
  };
}

function getOverridePlacement(
  overridePlacementMap: Map<
    ExplorerChromeControlId,
    ExplorerChromeOverrideEntry
  >,
  controlId: ExplorerChromeControlId,
  surfaceId: ExplorerChromeSurfaceId,
  basePlacement: ExplorerChromeResolvedControlPlacement | null,
): ExplorerChromeResolvedControlPlacement | null {
  const overridePlacement = overridePlacementMap.get(controlId);
  if (!overridePlacement) {
    return basePlacement;
  }

  if (overridePlacement.hidden) {
    return null;
  }

  const normalizedOverrideSurfaceId =
    overridePlacement.surfaceId === "workspaceHeader"
      ? "explorerTopbar"
      : overridePlacement.surfaceId;
  if (normalizedOverrideSurfaceId !== surfaceId) {
    return basePlacement?.surfaceId === surfaceId ? null : null;
  }

  return {
    controlId,
    surfaceId,
    zone: overridePlacement.zone,
    order: overridePlacement.order,
    bandId: overridePlacement.bandId ?? basePlacement?.bandId,
    anchorX: overridePlacement.anchorX ?? basePlacement?.anchorX,
    anchorY: overridePlacement.anchorY ?? basePlacement?.anchorY,
    offsetPx: overridePlacement.offsetPx ?? basePlacement?.offsetPx,
    grow: basePlacement?.grow,
    shrink: basePlacement?.shrink,
    collapsePriority: basePlacement?.collapsePriority,
    overflowEligible: basePlacement?.overflowEligible,
    hidden: false,
    sizeVariant: overridePlacement.sizeVariant ?? basePlacement?.sizeVariant,
    widthPx: overridePlacement.widthPx ?? basePlacement?.widthPx,
    showLabel: overridePlacement.showLabel ?? basePlacement?.showLabel,
    showIcon: overridePlacement.showIcon ?? basePlacement?.showIcon,
  };
}

function collectResolvedSurfacePlacements(
  surface: ExplorerChromeResolvedSurface,
): ExplorerChromeResolvedControlPlacement[] {
  return surface.rows.flatMap((row) =>
    row.zones.flatMap((zone) => zone.controls),
  );
}

export function createExplorerChromeOverrideSnapshotFromResolvedSurfaces(
  surfaces: ExplorerChromeResolvedSurface[],
): ExplorerChromeOverrideSnapshot {
  return normalizeExplorerChromeOverrideSnapshot({
    entries: surfaces
      .flatMap((surface) => collectResolvedSurfacePlacements(surface))
      .map((placement) => ({
        controlId: placement.controlId,
        surfaceId: placement.surfaceId,
        zone: placement.zone,
        order: placement.order,
        bandId: placement.bandId,
        anchorX: placement.anchorX,
        anchorY: placement.anchorY,
        offsetPx: placement.offsetPx,
        hidden: placement.hidden,
        sizeVariant: placement.sizeVariant,
        widthPx: placement.widthPx,
        showLabel: placement.showLabel,
        showIcon: placement.showIcon,
      })),
  });
}

export function getExplorerChromeResolvedSurfaceSignature(
  surface: ExplorerChromeResolvedSurface,
): string {
  return JSON.stringify({
    surfaceId: surface.surfaceId,
    visibleControlIds: surface.visibleControlIds,
    rows: surface.rows.map((row) => ({
      id: row.id,
      zones: row.zones.map((zone) => ({
        id: zone.id,
        controls: zone.controls.map((placement) => ({
          controlId: placement.controlId,
          surfaceId: placement.surfaceId,
          zone: placement.zone,
          order: placement.order,
          bandId: placement.bandId,
          anchorX: placement.anchorX,
          anchorY: placement.anchorY,
          offsetPx: placement.offsetPx,
          grow: placement.grow,
          shrink: placement.shrink,
          collapsePriority: placement.collapsePriority,
          overflowEligible: placement.overflowEligible,
          hidden: placement.hidden,
          sizeVariant: placement.sizeVariant,
          widthPx: placement.widthPx,
          showLabel: placement.showLabel,
          showIcon: placement.showIcon,
        })),
      })),
    })),
  });
}

export function moveExplorerChromeControlInResolvedSurfaces(input: {
  surfaces: ExplorerChromeResolvedSurface[];
  controlId: ExplorerChromeControlId;
  targetSurfaceId: ExplorerChromeSurfaceId;
  targetZoneId: ExplorerChromeZoneId;
  targetIndex: number;
  targetOffsetPx?: number;
}): ExplorerChromeOverrideSnapshot {
  const normalizedTargetIndex = Math.max(0, Math.trunc(input.targetIndex));
  const normalizedTargetOffsetPx = normalizeExplorerChromeOffsetPx(
    input.targetOffsetPx,
  );
  const placementsBySurfaceAndZone = new Map<
    string,
    ExplorerChromeResolvedControlPlacement[]
  >();
  let movingPlacement: ExplorerChromeResolvedControlPlacement | null = null;

  for (const surface of input.surfaces) {
    for (const row of surface.rows) {
      for (const zone of row.zones) {
        const nextControls = zone.controls
          .filter((placement) => {
            if (placement.controlId !== input.controlId) {
              return true;
            }
            movingPlacement = placement;
            return false;
          })
          .map((placement) => ({ ...placement }));
        placementsBySurfaceAndZone.set(
          `${surface.surfaceId}:${zone.id}`,
          nextControls,
        );
      }
    }
  }

  const targetKey = `${input.targetSurfaceId}:${input.targetZoneId}`;
  const targetControls = placementsBySurfaceAndZone.get(targetKey);
  if (
    !targetControls ||
    !isValidZoneForSurface(input.targetSurfaceId, input.targetZoneId)
  ) {
    return createExplorerChromeOverrideSnapshotFromResolvedSurfaces(
      input.surfaces,
    );
  }

  const fallbackPlacement = movingPlacement ?? {
    controlId: input.controlId,
    surfaceId: input.targetSurfaceId,
    zone: input.targetZoneId,
    order: 10,
    offsetPx: 0,
    hidden: false,
  };
  const nextPlacement: ExplorerChromeResolvedControlPlacement = {
    ...fallbackPlacement,
    surfaceId: input.targetSurfaceId,
    zone: input.targetZoneId,
    offsetPx: normalizedTargetOffsetPx ?? fallbackPlacement.offsetPx ?? 0,
  };
  const insertionIndex = Math.min(normalizedTargetIndex, targetControls.length);
  targetControls.splice(insertionIndex, 0, nextPlacement);
  placementsBySurfaceAndZone.set(targetKey, targetControls);

  return normalizeExplorerChromeOverrideSnapshot({
    entries: input.surfaces.flatMap((surface) =>
      surface.rows.flatMap((row) =>
        row.zones.flatMap((zone) => {
          const controls =
            placementsBySurfaceAndZone.get(`${surface.surfaceId}:${zone.id}`) ??
            [];
          return controls.map((placement, index) => ({
            controlId: placement.controlId,
            surfaceId: surface.surfaceId,
            zone: zone.id,
            order: (index + 1) * 10,
            bandId: placement.bandId,
            anchorX: placement.anchorX,
            anchorY: placement.anchorY,
            offsetPx: placement.offsetPx,
            hidden: placement.hidden,
            sizeVariant: placement.sizeVariant,
            widthPx: placement.widthPx,
            showLabel: placement.showLabel,
            showIcon: placement.showIcon,
          }));
        }),
      ),
    ),
  });
}

export function resolveExplorerChromeSurfaceLayout(input: {
  layoutId?: ExplorerChromeLayoutId | null;
  surfaceId: ExplorerChromeSurfaceId;
  controlDefinitions: ExplorerChromeControlDefinition[];
  override?: ExplorerChromeOverrideSnapshot | null;
  isControlVisible?: (
    controlId: ExplorerChromeControlId,
    surfaceId: ExplorerChromeSurfaceId,
  ) => boolean;
}): ExplorerChromeResolvedSurface {
  const surfaceDefinition = getExplorerChromeSurfaceDefinition(input.surfaceId);
  const layout = getExplorerChromeLayoutDefinition(input.layoutId);
  const overridePlacementMap = getOverridePlacementMap(input.override);
  const resolvedPlacements: ExplorerChromeResolvedControlPlacement[] = [];

  for (const control of input.controlDefinitions) {
    if (!control.surfaces.includes(input.surfaceId)) {
      continue;
    }
    if (
      input.isControlVisible &&
      !input.isControlVisible(control.id, input.surfaceId)
    ) {
      continue;
    }

    const basePlacement = getBasePlacement(layout, control.id, input.surfaceId);
    const resolvedPlacement = getOverridePlacement(
      overridePlacementMap,
      control.id,
      input.surfaceId,
      basePlacement,
    );

    if (
      !resolvedPlacement ||
      !isValidZoneForSurface(input.surfaceId, resolvedPlacement.zone)
    ) {
      continue;
    }

    resolvedPlacements.push(resolvedPlacement);
  }

  resolvedPlacements.sort((left, right) => {
    if (left.order !== right.order) {
      return left.order - right.order;
    }
    if ((left.offsetPx ?? 0) !== (right.offsetPx ?? 0)) {
      return (left.offsetPx ?? 0) - (right.offsetPx ?? 0);
    }
    return left.controlId.localeCompare(right.controlId);
  });

  const placementsByZone = new Map<
    ExplorerChromeZoneId,
    ExplorerChromeResolvedControlPlacement[]
  >();
  for (const placement of resolvedPlacements) {
    const current = placementsByZone.get(placement.zone) ?? [];
    current.push(placement);
    placementsByZone.set(placement.zone, current);
  }

  return {
    surfaceId: input.surfaceId,
    rows: surfaceDefinition.rows.map((row) => ({
      id: row.id,
      zones: row.zones.map((zone) => ({
        id: zone,
        controls: placementsByZone.get(zone) ?? [],
      })),
    })),
    visibleControlIds: resolvedPlacements.map(
      (placement) => placement.controlId,
    ),
  };
}
