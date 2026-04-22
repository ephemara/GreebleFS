import type { CSSProperties } from 'react';

export const interactionMotionSurfaceIds = [
  'explorerEntry',
  'explorerRailItem',
  'previewWorkflowTab',
  'panelTab',
  'topBarButton',
  'settingsCard',
] as const;

export type InteractionMotionSurfaceId = typeof interactionMotionSurfaceIds[number];

export const interactionMotionTriggers = [
  'hover',
  'press',
  'select',
  'activate',
  'drop-hover',
] as const;

export type InteractionMotionTrigger = typeof interactionMotionTriggers[number];

export interface InteractionMotionTriggerState {
  hover?: boolean;
  press?: boolean;
  select?: boolean;
  activate?: boolean;
  dropHover?: boolean;
}

export interface InteractionMotionSurfaceDefinition {
  id: InteractionMotionSurfaceId;
  label: string;
  description: string;
}

export interface OverlayInteractionMotionEffect {
  translateX?: number;
  translateY?: number;
  scale?: number;
  rotateDeg?: number;
  rotateXDeg?: number;
  rotateYDeg?: number;
  brightness?: number;
  saturation?: number;
  durationMs?: number;
  easing?: string;
}

export interface OverlayInteractionMotionProfile {
  id: string;
  label: string;
  description: string;
  defaultDurationMs: number;
  defaultEasing: string;
  surfaces: Partial<Record<InteractionMotionSurfaceId, Partial<Record<InteractionMotionTrigger, OverlayInteractionMotionEffect>>>>;
}

export type ResolvedInteractionMotionProfile = OverlayInteractionMotionProfile;

export interface OverlayInteractionMotionSurfaceOverride {
  enabled?: boolean;
  intensityMultiplier?: number;
}

export type OverlayInteractionMotionSurfaceOverrideValue =
  | boolean
  | Partial<OverlayInteractionMotionSurfaceOverride>;

export type OverlayInteractionMotionSurfaceOverrideMap =
  Partial<Record<InteractionMotionSurfaceId, OverlayInteractionMotionSurfaceOverrideValue>>;

export interface OverlayInteractionMotionThemeRecipe {
  defaultPresetId?: string;
  intensityMultiplier?: number;
  surfaceOverrides?: OverlayInteractionMotionSurfaceOverrideMap;
}

export interface InteractionMotionAppearanceSettings {
  interactionMotionEnabled: boolean;
  interactionMotionPresetId: string | null;
  interactionMotionIntensity: number;
  interactionMotionSurfaceOverrides: OverlayInteractionMotionSurfaceOverrideMap;
}

export interface ResolvedInteractionMotionSurfaceOverride {
  enabled?: boolean;
  intensityMultiplier: number;
}

export interface ResolvedInteractionMotionSurfaceStyle {
  enabled: boolean;
  presetId: string;
  intensity: number;
  transition: string | undefined;
  transform: string | undefined;
  filter: string | undefined;
  willChange: string | undefined;
  dataAttributes: Record<string, string>;
}

const DEFAULT_INTERACTION_MOTION_DURATION_MS = 180;
const DEFAULT_INTERACTION_MOTION_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
export const DEFAULT_INTERACTION_MOTION_PRESET_ID = 'subtle';

const DEFAULT_SURFACE_OVERRIDE: ResolvedInteractionMotionSurfaceOverride = {
  intensityMultiplier: 1,
};

const triggerPriority: InteractionMotionTrigger[] = [
  'press',
  'drop-hover',
  'hover',
  'select',
  'activate',
];

const triggerStateLookup: ReadonlyArray<readonly [InteractionMotionTrigger, keyof InteractionMotionTriggerState]> = [
  ['hover', 'hover'],
  ['press', 'press'],
  ['select', 'select'],
  ['activate', 'activate'],
  ['drop-hover', 'dropHover'],
] as const;

export const interactionMotionSurfaceCatalog: InteractionMotionSurfaceDefinition[] = [
  {
    id: 'explorerEntry',
    label: 'Explorer Entries',
    description: 'Rows, cards, and semantic explorer items respond to hover, press, selection, and drop-hover states.',
  },
  {
    id: 'explorerRailItem',
    label: 'Explorer Rail',
    description: 'Sources, bookmarks, saved searches, and drive rows get the same shared interaction treatment.',
  },
  {
    id: 'previewWorkflowTab',
    label: 'Preview Workflow Tabs',
    description: 'Preview and edit workflow chips feel alive without drifting into heavy chrome.',
  },
  {
    id: 'panelTab',
    label: 'Panel Tabs',
    description: 'Top-bar panel tabs and panel-like shell selectors share one motion profile.',
  },
  {
    id: 'topBarButton',
    label: 'Top Bar Buttons',
    description: 'Chrome controls such as layout, mode, command palette, and focus toggles react consistently.',
  },
  {
    id: 'settingsCard',
    label: 'Settings Cards',
    description: 'Settings rail tiles, overview cards, and other authoring surfaces use the same motion stack.',
  },
];

export const interactionMotionProfiles: OverlayInteractionMotionProfile[] = [
  {
    id: 'subtle',
    label: 'Subtle',
    description: 'A restrained lift-and-settle pass for the shell-first default.',
    defaultDurationMs: 170,
    defaultEasing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    surfaces: {
      explorerEntry: {
        hover: { translateY: -1.5, scale: 1.008 },
        press: { translateY: 0.5, scale: 0.988 },
        select: { scale: 1.004, brightness: 1.02 },
        'drop-hover': { translateY: -2, scale: 1.01, brightness: 1.03 },
      },
      explorerRailItem: {
        hover: { translateX: 2, scale: 1.006 },
        press: { translateX: 1, scale: 0.99 },
        activate: { translateX: 1, brightness: 1.03 },
      },
      previewWorkflowTab: {
        hover: { translateY: -1, scale: 1.01 },
        press: { scale: 0.985 },
        activate: { scale: 1.02, brightness: 1.02 },
      },
      panelTab: {
        hover: { translateY: -1.25, scale: 1.01 },
        press: { scale: 0.985 },
        activate: { translateY: -1, scale: 1.015, brightness: 1.03 },
      },
      topBarButton: {
        hover: { translateY: -1, scale: 1.01 },
        press: { translateY: 0.5, scale: 0.98 },
        activate: { scale: 1.01, brightness: 1.03 },
      },
      settingsCard: {
        hover: { translateY: -2, scale: 1.006 },
        press: { scale: 0.992 },
        activate: { brightness: 1.02 },
      },
    },
  },
  {
    id: 'spring',
    label: 'Spring',
    description: 'A deeper spring settle with stronger travel and slightly longer easing.',
    defaultDurationMs: 220,
    defaultEasing: 'cubic-bezier(0.2, 0.9, 0.2, 1.06)',
    surfaces: {
      explorerEntry: {
        hover: { translateY: -2.5, scale: 1.016 },
        press: { translateY: 1, scale: 0.982 },
        select: { scale: 1.01, brightness: 1.03 },
        'drop-hover': { translateY: -3, scale: 1.02, brightness: 1.04 },
      },
      explorerRailItem: {
        hover: { translateX: 4, scale: 1.012 },
        press: { translateX: 2, scale: 0.986 },
        activate: { translateX: 2, brightness: 1.04 },
      },
      previewWorkflowTab: {
        hover: { translateY: -1.5, scale: 1.014 },
        press: { scale: 0.982 },
        activate: { translateY: -1, scale: 1.025, brightness: 1.03 },
      },
      panelTab: {
        hover: { translateY: -2, scale: 1.015 },
        press: { scale: 0.982 },
        activate: { translateY: -1.5, scale: 1.022, brightness: 1.04 },
      },
      topBarButton: {
        hover: { translateY: -1.5, scale: 1.015 },
        press: { translateY: 0.8, scale: 0.978 },
        activate: { scale: 1.018, brightness: 1.03 },
      },
      settingsCard: {
        hover: { translateY: -3, scale: 1.012 },
        press: { scale: 0.988 },
        activate: { brightness: 1.025 },
      },
    },
  },
  {
    id: 'playful',
    label: 'Playful',
    description: 'A tweakable shell profile with more bounce, tilt, and overt motion.',
    defaultDurationMs: 250,
    defaultEasing: 'cubic-bezier(0.18, 0.98, 0.25, 1.08)',
    surfaces: {
      explorerEntry: {
        hover: { translateY: -3, scale: 1.02, rotateDeg: -0.35 },
        press: { translateY: 1.2, scale: 0.978, rotateDeg: 0.35 },
        select: { scale: 1.012, rotateDeg: 0.15, brightness: 1.04 },
        'drop-hover': { translateY: -4, scale: 1.028, rotateDeg: -0.4, brightness: 1.05 },
      },
      explorerRailItem: {
        hover: { translateX: 6, scale: 1.018, rotateDeg: -0.5 },
        press: { translateX: 2.5, scale: 0.982, rotateDeg: 0.45 },
        activate: { translateX: 3, scale: 1.01, brightness: 1.05 },
      },
      previewWorkflowTab: {
        hover: { translateY: -2, scale: 1.02, rotateDeg: -0.4 },
        press: { scale: 0.978, rotateDeg: 0.4 },
        activate: { translateY: -1.5, scale: 1.03, brightness: 1.04 },
      },
      panelTab: {
        hover: { translateY: -2.5, scale: 1.02, rotateDeg: -0.45 },
        press: { scale: 0.978, rotateDeg: 0.42 },
        activate: { translateY: -2, scale: 1.03, brightness: 1.05 },
      },
      topBarButton: {
        hover: { translateY: -2, scale: 1.02, rotateDeg: -0.35 },
        press: { translateY: 1, scale: 0.976, rotateDeg: 0.3 },
        activate: { scale: 1.02, brightness: 1.04 },
      },
      settingsCard: {
        hover: { translateY: -4, scale: 1.016, rotateDeg: -0.35 },
        press: { scale: 0.986, rotateDeg: 0.28 },
        activate: { brightness: 1.03 },
      },
    },
  },
];

export const interactionMotionProfilesById = new Map(
  interactionMotionProfiles.map(profile => [profile.id, profile] as const),
);

export const interactionMotionPresetOptions = interactionMotionProfiles.map(profile => ({
  id: profile.id,
  label: profile.label,
  description: profile.description,
}));

export function clampInteractionMotionIntensity(value: unknown, fallback = 1): number {
  const numericValue = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.min(2.5, Math.max(0.25, numericValue));
}

export function normalizeInteractionMotionPresetId(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

export function normalizeInteractionMotionSurfaceOverride(
  value: OverlayInteractionMotionSurfaceOverrideValue | null | undefined,
): ResolvedInteractionMotionSurfaceOverride {
  if (typeof value === 'boolean') {
    return {
      enabled: value,
      intensityMultiplier: 1,
    };
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return DEFAULT_SURFACE_OVERRIDE;
  }

  return {
    enabled: typeof value.enabled === 'boolean' ? value.enabled : undefined,
    intensityMultiplier: clampInteractionMotionIntensity(value.intensityMultiplier, 1),
  };
}

export function normalizeInteractionMotionSurfaceOverrideMap(
  value: unknown,
): OverlayInteractionMotionSurfaceOverrideMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([surfaceId]) => interactionMotionSurfaceIds.includes(surfaceId as InteractionMotionSurfaceId))
      .map(([surfaceId, overrideValue]) => {
        if (typeof overrideValue === 'boolean') {
          return [surfaceId, overrideValue];
        }

        if (!overrideValue || typeof overrideValue !== 'object' || Array.isArray(overrideValue)) {
          return [surfaceId, normalizeInteractionMotionSurfaceOverride(undefined)];
        }

        const normalizedOverride = normalizeInteractionMotionSurfaceOverride(
          overrideValue as OverlayInteractionMotionSurfaceOverrideValue,
        );
        return [surfaceId, normalizedOverride];
      }),
  ) as OverlayInteractionMotionSurfaceOverrideMap;
}

export function normalizeInteractionMotionThemeRecipe(
  recipe?: OverlayInteractionMotionThemeRecipe,
  fallback?: OverlayInteractionMotionThemeRecipe,
): OverlayInteractionMotionThemeRecipe | undefined {
  const hasRecipe = Boolean(recipe) || Boolean(fallback);
  if (!hasRecipe) {
    return undefined;
  }

  const merged = { ...(fallback ?? {}), ...(recipe ?? {}) };
  return {
    defaultPresetId: normalizeInteractionMotionPresetId(merged.defaultPresetId)
      ?? normalizeInteractionMotionPresetId(fallback?.defaultPresetId)
      ?? DEFAULT_INTERACTION_MOTION_PRESET_ID,
    intensityMultiplier: clampInteractionMotionIntensity(
      merged.intensityMultiplier,
      fallback?.intensityMultiplier ?? 1,
    ),
    surfaceOverrides: normalizeInteractionMotionSurfaceOverrideMap({
      ...(fallback?.surfaceOverrides ?? {}),
      ...(merged.surfaceOverrides ?? {}),
    }),
  };
}

export function createDefaultInteractionMotionThemeRecipe(): OverlayInteractionMotionThemeRecipe {
  return {
    defaultPresetId: DEFAULT_INTERACTION_MOTION_PRESET_ID,
    intensityMultiplier: 1,
    surfaceOverrides: {},
  };
}

export function resolveInteractionMotionProfileId(args: {
  userOverrideId?: string | null;
  themeDefaultPresetId?: string | null;
  fallbackPresetId?: string;
}): string {
  const fallbackPresetId = args.fallbackPresetId ?? DEFAULT_INTERACTION_MOTION_PRESET_ID;
  const candidateIds = [
    args.userOverrideId,
    args.themeDefaultPresetId,
    fallbackPresetId,
  ].map(candidate => normalizeInteractionMotionPresetId(candidate));

  for (const candidateId of candidateIds) {
    if (candidateId && interactionMotionProfilesById.has(candidateId)) {
      return candidateId;
    }
  }

  return fallbackPresetId;
}

export function resolveInteractionMotionProfile(profileId?: string | null): ResolvedInteractionMotionProfile {
  const resolvedId = resolveInteractionMotionProfileId({ userOverrideId: profileId });
  return interactionMotionProfilesById.get(resolvedId) ?? interactionMotionProfiles[0];
}

function mergeInteractionMotionSurfaceOverrides(
  themeOverride: OverlayInteractionMotionSurfaceOverrideValue | null | undefined,
  userOverride: OverlayInteractionMotionSurfaceOverrideValue | null | undefined,
): ResolvedInteractionMotionSurfaceOverride {
  const normalizedThemeOverride = normalizeInteractionMotionSurfaceOverride(themeOverride);
  const normalizedUserOverride = normalizeInteractionMotionSurfaceOverride(userOverride);

  return {
    enabled: normalizedUserOverride.enabled ?? normalizedThemeOverride.enabled,
    intensityMultiplier: clampInteractionMotionIntensity(
      normalizedThemeOverride.intensityMultiplier * normalizedUserOverride.intensityMultiplier,
      1,
    ),
  };
}

function resolveActiveInteractionTriggers(
  triggerState: InteractionMotionTriggerState,
): InteractionMotionTrigger[] {
  return triggerStateLookup
    .filter(([, stateKey]) => triggerState[stateKey] === true)
    .map(([trigger]) => trigger);
}

function composeTransformValue(parts: Array<string | null | undefined>): string | undefined {
  const filteredParts = parts
    .map(part => part?.trim())
    .filter((part): part is string => Boolean(part) && part !== 'none');
  return filteredParts.length > 0 ? filteredParts.join(' ') : undefined;
}

function composeFilterValue(parts: Array<string | null | undefined>): string | undefined {
  const filteredParts = parts
    .map(part => part?.trim())
    .filter((part): part is string => Boolean(part) && part !== 'none');
  return filteredParts.length > 0 ? filteredParts.join(' ') : undefined;
}

function buildInteractionMotionTransform(effect: {
  translateX: number;
  translateY: number;
  scale: number;
  rotateDeg: number;
  rotateXDeg: number;
  rotateYDeg: number;
}): string | undefined {
  return composeTransformValue([
    effect.translateX !== 0 || effect.translateY !== 0
      ? `translate3d(${effect.translateX.toFixed(3)}px, ${effect.translateY.toFixed(3)}px, 0)`
      : null,
    effect.rotateXDeg !== 0 ? `rotateX(${effect.rotateXDeg.toFixed(3)}deg)` : null,
    effect.rotateYDeg !== 0 ? `rotateY(${effect.rotateYDeg.toFixed(3)}deg)` : null,
    effect.rotateDeg !== 0 ? `rotate(${effect.rotateDeg.toFixed(3)}deg)` : null,
    Math.abs(effect.scale - 1) > 0.0005 ? `scale(${effect.scale.toFixed(4)})` : null,
  ]);
}

function buildInteractionMotionFilter(effect: {
  brightness: number;
  saturation: number;
}): string | undefined {
  return composeFilterValue([
    Math.abs(effect.brightness - 1) > 0.0005 ? `brightness(${effect.brightness.toFixed(3)})` : null,
    Math.abs(effect.saturation - 1) > 0.0005 ? `saturate(${effect.saturation.toFixed(3)})` : null,
  ]);
}

function resolveTriggerEffect(
  surfaceEffects: Partial<Record<InteractionMotionTrigger, OverlayInteractionMotionEffect>> | undefined,
  trigger: InteractionMotionTrigger,
): OverlayInteractionMotionEffect | null {
  return surfaceEffects?.[trigger] ?? null;
}

export function mergeTransitionValues(...values: Array<string | null | undefined>): string | undefined {
  const filteredValues = values
    .map(value => value?.trim())
    .filter((value): value is string => Boolean(value));
  return filteredValues.length > 0 ? filteredValues.join(', ') : undefined;
}

export function resolveInteractionMotionSurfaceStyle(args: {
  surfaceId: InteractionMotionSurfaceId;
  triggerState?: InteractionMotionTriggerState;
  settings: InteractionMotionAppearanceSettings;
  themeDefaults?: OverlayInteractionMotionThemeRecipe;
  reducedMotion?: boolean;
  baseTransform?: string;
}): ResolvedInteractionMotionSurfaceStyle {
  const normalizedThemeDefaults = normalizeInteractionMotionThemeRecipe(args.themeDefaults);
  const profileId = resolveInteractionMotionProfileId({
    userOverrideId: args.settings.interactionMotionPresetId,
    themeDefaultPresetId: normalizedThemeDefaults?.defaultPresetId,
  });
  const profile = resolveInteractionMotionProfile(profileId);
  const triggerState = args.triggerState ?? {};
  const activeTriggers = resolveActiveInteractionTriggers(triggerState);
  const surfaceOverride = mergeInteractionMotionSurfaceOverrides(
    normalizedThemeDefaults?.surfaceOverrides?.[args.surfaceId],
    args.settings.interactionMotionSurfaceOverrides[args.surfaceId],
  );
  const enabled = args.settings.interactionMotionEnabled
    && args.reducedMotion !== true
    && surfaceOverride.enabled !== false;
  const themeIntensityMultiplier = normalizedThemeDefaults?.intensityMultiplier ?? 1;
  const intensity = enabled
    ? clampInteractionMotionIntensity(
        args.settings.interactionMotionIntensity * themeIntensityMultiplier * surfaceOverride.intensityMultiplier,
        1,
      )
    : 0;
  const surfaceEffects = profile.surfaces[args.surfaceId];
  const highestPriorityTrigger = triggerPriority.find(trigger => activeTriggers.includes(trigger));
  const priorityEffect = highestPriorityTrigger
    ? resolveTriggerEffect(surfaceEffects, highestPriorityTrigger)
    : null;
  const aggregateEffect = activeTriggers.reduce((current, trigger) => {
    const triggerEffect = resolveTriggerEffect(surfaceEffects, trigger);
    if (!triggerEffect) {
      return current;
    }

    current.translateX += (triggerEffect.translateX ?? 0) * intensity;
    current.translateY += (triggerEffect.translateY ?? 0) * intensity;
    current.scale *= 1 + (((triggerEffect.scale ?? 1) - 1) * intensity);
    current.rotateDeg += (triggerEffect.rotateDeg ?? 0) * intensity;
    current.rotateXDeg += (triggerEffect.rotateXDeg ?? 0) * intensity;
    current.rotateYDeg += (triggerEffect.rotateYDeg ?? 0) * intensity;
    current.brightness *= 1 + (((triggerEffect.brightness ?? 1) - 1) * intensity);
    current.saturation *= 1 + (((triggerEffect.saturation ?? 1) - 1) * intensity);
    return current;
  }, {
    translateX: 0,
    translateY: 0,
    scale: 1,
    rotateDeg: 0,
    rotateXDeg: 0,
    rotateYDeg: 0,
    brightness: 1,
    saturation: 1,
  });

  const motionTransform = enabled ? buildInteractionMotionTransform(aggregateEffect) : undefined;
  const motionFilter = enabled ? buildInteractionMotionFilter(aggregateEffect) : undefined;
  const durationMs = enabled
    ? Math.max(80, Math.round(priorityEffect?.durationMs ?? profile.defaultDurationMs ?? DEFAULT_INTERACTION_MOTION_DURATION_MS))
    : undefined;
  const easing = enabled
    ? (priorityEffect?.easing ?? profile.defaultEasing ?? DEFAULT_INTERACTION_MOTION_EASING)
    : undefined;
  const transition = enabled
    ? mergeTransitionValues(
        durationMs && easing ? `transform ${durationMs}ms ${easing}` : undefined,
        durationMs && easing ? `filter ${durationMs}ms ${easing}` : undefined,
      )
    : undefined;

  return {
    enabled,
    presetId: profile.id,
    intensity,
    transition,
    transform: composeTransformValue([args.baseTransform, motionTransform]),
    filter: motionFilter,
    willChange: enabled ? 'transform, filter' : undefined,
    dataAttributes: {
      'data-interaction-motion-surface': args.surfaceId,
      'data-interaction-motion-enabled': enabled ? 'true' : 'false',
      'data-interaction-motion-preset': profile.id,
    },
  };
}

export function toInteractionMotionStyleObject(
  value: ResolvedInteractionMotionSurfaceStyle,
  baseTransition?: string,
): CSSProperties {
  return {
    ...(value.transform ? { transform: value.transform } : {}),
    ...(value.filter ? { filter: value.filter } : {}),
    ...(mergeTransitionValues(baseTransition, value.transition)
      ? { transition: mergeTransitionValues(baseTransition, value.transition) }
      : {}),
    ...(value.willChange ? { willChange: value.willChange } : {}),
  };
}
