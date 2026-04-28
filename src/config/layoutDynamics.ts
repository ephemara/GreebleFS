import shippedLayoutDynamicsManifestJson from "../../usr/layout-dynamics/greeblefs-core/layout-dynamics.json";
export type LayoutDynamicsAxisMode = "horizontal-band" | "free-2d";
export type LayoutDynamicsBoundsMode = "band" | "surface";

export type LayoutDynamicsSurfaceId =
  | "explorerTopbar"
  | "explorerToolbar"
  | "workspaceHeader"
  | "railHeader"
  | "previewHeader"
  | "explorerStatusBar"
  | "workbenchTopBar";

export interface LayoutDynamicsNode {
  id: string;
  bandId: string;
  x: number;
  y: number;
  anchorX: number;
  anchorY: number;
  width: number;
  height: number;
  velocityX: number;
  velocityY: number;
}

export interface LayoutDynamicsSolverProfile {
  id: string;
  label: string;
  description: string;
  groupId: "system";
  auraRadiusPx: number;
  auraStrength: number;
  collisionStrength: number;
  springStiffness: number;
  damping: number;
  maxDisplacementPx: number;
  maxVelocityPx: number;
  settleVelocityPx: number;
  gapPx: number;
}

export interface LayoutDynamicsSurfaceProfile {
  id: LayoutDynamicsSurfaceId;
  label: string;
  supportsAuthoring: boolean;
  axisMode: LayoutDynamicsAxisMode;
  boundsMode: LayoutDynamicsBoundsMode;
  defaultPresetId: string;
  controlCatalog: "explorerChrome" | "topBarChrome";
}

export interface LayoutDynamicsSurfaceOverride {
  enabled?: boolean;
  presetId?: string | null;
  intensityMultiplier?: number;
}

export type LayoutDynamicsSurfaceOverrideMap = Partial<
  Record<LayoutDynamicsSurfaceId, LayoutDynamicsSurfaceOverride | boolean>
>;

export interface LayoutDynamicsThemeRecipe {
  defaultPresetId?: string;
  surfaceOverrides?: LayoutDynamicsSurfaceOverrideMap;
}

export interface LayoutDynamicsAuthoringEntry {
  nodeId: string;
  bandId: string;
  x: number;
  y: number;
  hidden?: boolean;
  widthPx?: number;
  heightPx?: number;
}

export interface LayoutDynamicsAuthoringSnapshot {
  entries: LayoutDynamicsAuthoringEntry[];
}

export interface LayoutDynamicsSettings {
  enabled: boolean;
  presetId: string | null;
  intensity: number;
  surfaceOverrides: LayoutDynamicsSurfaceOverrideMap;
  topBarLayoutsById: Record<string, LayoutDynamicsAuthoringSnapshot>;
}

interface ShippedLayoutDynamicsManifest {
  defaultPresetId?: string;
  intensityBounds?: {
    min?: number;
    max?: number;
  };
  presets?: LayoutDynamicsSolverProfile[];
  surfaces?: LayoutDynamicsSurfaceProfile[];
}

const shippedLayoutDynamicsManifest =
  shippedLayoutDynamicsManifestJson as ShippedLayoutDynamicsManifest;
const LAYOUT_DYNAMICS_DEFAULT_PRESET_ID =
  typeof shippedLayoutDynamicsManifest.defaultPresetId === "string" &&
  shippedLayoutDynamicsManifest.defaultPresetId.trim().length > 0
    ? shippedLayoutDynamicsManifest.defaultPresetId.trim()
    : "liquid-repulse";
const LAYOUT_DYNAMICS_INTENSITY_MIN =
  typeof shippedLayoutDynamicsManifest.intensityBounds?.min === "number" &&
  Number.isFinite(shippedLayoutDynamicsManifest.intensityBounds.min)
    ? shippedLayoutDynamicsManifest.intensityBounds.min
    : 0.25;
const LAYOUT_DYNAMICS_INTENSITY_MAX =
  typeof shippedLayoutDynamicsManifest.intensityBounds?.max === "number" &&
  Number.isFinite(shippedLayoutDynamicsManifest.intensityBounds.max)
    ? shippedLayoutDynamicsManifest.intensityBounds.max
    : 2;

export const layoutDynamicsPresetCatalog = Array.isArray(
  shippedLayoutDynamicsManifest.presets,
)
  ? shippedLayoutDynamicsManifest.presets.map((profile) => ({ ...profile }))
  : [];

export const layoutDynamicsSurfaceCatalog = Array.isArray(
  shippedLayoutDynamicsManifest.surfaces,
)
  ? shippedLayoutDynamicsManifest.surfaces.map((surface) => ({ ...surface }))
  : [];

const layoutDynamicsPresetById = new Map<string, LayoutDynamicsSolverProfile>(
  layoutDynamicsPresetCatalog.map((profile) => [profile.id, profile] as const),
);

const layoutDynamicsSurfaceById = new Map<
  LayoutDynamicsSurfaceId,
  LayoutDynamicsSurfaceProfile
>(
  layoutDynamicsSurfaceCatalog.map((surface) => [surface.id, surface] as const),
);

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asFiniteInteger(value: unknown): number | null {
  const parsed = asFiniteNumber(value);
  return parsed == null ? null : Math.trunc(parsed);
}

function asBooleanOrUndefined(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function asTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

export function clampLayoutDynamicsIntensity(value: unknown): number {
  const numericValue =
    typeof value === "number" && Number.isFinite(value) ? value : 1;
  return Math.min(
    LAYOUT_DYNAMICS_INTENSITY_MAX,
    Math.max(LAYOUT_DYNAMICS_INTENSITY_MIN, numericValue),
  );
}

export function normalizeLayoutDynamicsPresetId(value: unknown): string | null {
  const presetId = asTrimmedString(value);
  return presetId && layoutDynamicsPresetById.has(presetId) ? presetId : null;
}

export function isLayoutDynamicsSurfaceId(
  value: unknown,
): value is LayoutDynamicsSurfaceId {
  return (
    typeof value === "string" &&
    layoutDynamicsSurfaceById.has(value as LayoutDynamicsSurfaceId)
  );
}

export function normalizeLayoutDynamicsSurfaceOverride(
  value: unknown,
): LayoutDynamicsSurfaceOverride | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const source = value as Partial<LayoutDynamicsSurfaceOverride>;
  const enabled = asBooleanOrUndefined(source.enabled);
  const presetId = normalizeLayoutDynamicsPresetId(source.presetId) ?? null;
  const intensityMultiplier = clampLayoutDynamicsIntensity(
    source.intensityMultiplier,
  );
  const hasExplicitIntensityMultiplier =
    typeof source.intensityMultiplier === "number" &&
    Number.isFinite(source.intensityMultiplier);

  const nextOverride: LayoutDynamicsSurfaceOverride = {};
  if (enabled !== undefined) {
    nextOverride.enabled = enabled;
  }
  if (
    source.presetId === null ||
    normalizeLayoutDynamicsPresetId(source.presetId) != null
  ) {
    nextOverride.presetId = source.presetId === null ? null : presetId;
  }
  if (hasExplicitIntensityMultiplier) {
    nextOverride.intensityMultiplier = intensityMultiplier;
  }

  return Object.keys(nextOverride).length > 0 ? nextOverride : null;
}

export function normalizeLayoutDynamicsSurfaceOverrideMap(
  value: unknown,
): LayoutDynamicsSurfaceOverrideMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([surfaceId, overrideValue]) => {
        if (!isLayoutDynamicsSurfaceId(surfaceId)) {
          return null;
        }

        if (typeof overrideValue === "boolean") {
          return [surfaceId, overrideValue] as const;
        }

        const override = normalizeLayoutDynamicsSurfaceOverride(overrideValue);
        return override ? ([surfaceId, override] as const) : null;
      })
      .filter(
        (
          entry,
        ): entry is readonly [
          LayoutDynamicsSurfaceId,
          LayoutDynamicsSurfaceOverride | boolean,
        ] => entry != null,
      ),
  );
}

function normalizeLayoutDynamicsEntry(
  value: unknown,
): LayoutDynamicsAuthoringEntry | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const source = value as Partial<LayoutDynamicsAuthoringEntry>;
  const nodeId = asTrimmedString(source.nodeId);
  const bandId = asTrimmedString(source.bandId);
  const x = asFiniteInteger(source.x);
  const y = asFiniteInteger(source.y);
  const widthPx = asFiniteInteger(source.widthPx);
  const heightPx = asFiniteInteger(source.heightPx);

  if (!nodeId || !bandId || x == null || y == null) {
    return null;
  }

  return {
    nodeId,
    bandId,
    x,
    y,
    hidden: asBooleanOrUndefined(source.hidden),
    widthPx: widthPx == null ? undefined : Math.max(1, widthPx),
    heightPx: heightPx == null ? undefined : Math.max(1, heightPx),
  };
}

export function normalizeLayoutDynamicsAuthoringSnapshot(
  value: unknown,
): LayoutDynamicsAuthoringSnapshot {
  const sourceEntries = Array.isArray(
    (value as LayoutDynamicsAuthoringSnapshot | undefined)?.entries,
  )
    ? (value as LayoutDynamicsAuthoringSnapshot).entries
    : [];
  const entriesByNodeId = new Map<string, LayoutDynamicsAuthoringEntry>();

  for (const entry of sourceEntries) {
    const normalizedEntry = normalizeLayoutDynamicsEntry(entry);
    if (!normalizedEntry) {
      continue;
    }
    entriesByNodeId.set(normalizedEntry.nodeId, normalizedEntry);
  }

  return {
    entries: Array.from(entriesByNodeId.values()),
  };
}

export function normalizeLayoutDynamicsTopBarLayoutMap(
  value: unknown,
): Record<string, LayoutDynamicsAuthoringSnapshot> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([topBarId, snapshot]) => {
        const normalizedTopBarId = asTrimmedString(topBarId);
        if (!normalizedTopBarId) {
          return null;
        }

        return [
          normalizedTopBarId,
          normalizeLayoutDynamicsAuthoringSnapshot(snapshot),
        ] as const;
      })
      .filter(
        (entry): entry is readonly [string, LayoutDynamicsAuthoringSnapshot] =>
          entry != null,
      ),
  );
}

export function createDefaultLayoutDynamicsThemeRecipe(): LayoutDynamicsThemeRecipe {
  return {
    defaultPresetId: LAYOUT_DYNAMICS_DEFAULT_PRESET_ID,
    surfaceOverrides: {},
  };
}

export function normalizeLayoutDynamicsThemeRecipe(
  value: unknown,
  fallback: LayoutDynamicsThemeRecipe = createDefaultLayoutDynamicsThemeRecipe(),
): LayoutDynamicsThemeRecipe {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Partial<LayoutDynamicsThemeRecipe>)
      : {};
  return {
    defaultPresetId:
      normalizeLayoutDynamicsPresetId(source.defaultPresetId) ??
      normalizeLayoutDynamicsPresetId(fallback.defaultPresetId) ??
      LAYOUT_DYNAMICS_DEFAULT_PRESET_ID,
    surfaceOverrides: normalizeLayoutDynamicsSurfaceOverrideMap(
      source.surfaceOverrides ?? fallback.surfaceOverrides,
    ),
  };
}

export function getLayoutDynamicsPreset(
  presetId: string | null | undefined,
): LayoutDynamicsSolverProfile {
  return (
    (presetId ? layoutDynamicsPresetById.get(presetId) : null) ??
    layoutDynamicsPresetById.get(LAYOUT_DYNAMICS_DEFAULT_PRESET_ID) ??
    layoutDynamicsPresetCatalog[0]
  );
}

export function getLayoutDynamicsSurfaceProfile(
  surfaceId: LayoutDynamicsSurfaceId,
): LayoutDynamicsSurfaceProfile {
  return (
    layoutDynamicsSurfaceById.get(surfaceId) ?? layoutDynamicsSurfaceCatalog[0]
  );
}

export function resolveLayoutDynamicsPresetId(args: {
  requestedPresetId?: string | null;
  themeDefaultPresetId?: string | null;
  surfaceId?: LayoutDynamicsSurfaceId;
}): string {
  const requestedPresetId = normalizeLayoutDynamicsPresetId(
    args.requestedPresetId,
  );
  if (requestedPresetId) {
    return requestedPresetId;
  }

  const themeDefaultPresetId = normalizeLayoutDynamicsPresetId(
    args.themeDefaultPresetId,
  );
  if (themeDefaultPresetId) {
    return themeDefaultPresetId;
  }

  if (args.surfaceId) {
    return getLayoutDynamicsSurfaceProfile(args.surfaceId).defaultPresetId;
  }

  return LAYOUT_DYNAMICS_DEFAULT_PRESET_ID;
}

export function resolveLayoutDynamicsSurfaceOverride(args: {
  surfaceId: LayoutDynamicsSurfaceId;
  surfaceOverrides?: LayoutDynamicsSurfaceOverrideMap | null;
  themeSurfaceOverrides?: LayoutDynamicsSurfaceOverrideMap | null;
}): LayoutDynamicsSurfaceOverride | boolean | null {
  const settingOverride = args.surfaceOverrides?.[args.surfaceId];
  if (settingOverride !== undefined) {
    return settingOverride;
  }
  return args.themeSurfaceOverrides?.[args.surfaceId] ?? null;
}

export function createDefaultLayoutDynamicsSettings(): LayoutDynamicsSettings {
  return {
    enabled: true,
    presetId: null,
    intensity: 1,
    surfaceOverrides: {},
    topBarLayoutsById: {},
  };
}
