import type { CSSProperties } from 'react';

export const interactionMotionSurfaceIds = [
  'explorerEntry',
  'explorerEntryIcon',
  'explorerRailItem',
  'previewWorkflowTab',
  'panelTab',
  'topBarButton',
  'actionButton',
  'settingsCard',
] as const;

export type InteractionMotionSurfaceId = typeof interactionMotionSurfaceIds[number];

export const interactionMotionModuleIds = [
  'shellChrome',
  'fileItems',
] as const;

export type InteractionMotionModuleId = typeof interactionMotionModuleIds[number];

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
  moduleId: InteractionMotionModuleId;
  label: string;
  description: string;
}

export interface InteractionMotionModuleDefinition {
  id: InteractionMotionModuleId;
  label: string;
  description: string;
  surfaceIds: readonly InteractionMotionSurfaceId[];
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
  animationPresetId?: InteractionMotionAnimationPresetId;
  animationDurationMs?: number;
  animationIterationCount?: number | 'infinite';
  animationDirection?: 'normal' | 'alternate' | 'alternate-reverse';
}

export type InteractionMotionPresetGroupId = 'system' | 'kcloner';

export interface OverlayInteractionMotionProfile {
  id: string;
  label: string;
  description: string;
  groupId: InteractionMotionPresetGroupId;
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

export interface InteractionMotionModifierControlDefinition {
  id: string;
  label: string;
  description: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  valueSuffix?: string;
}

export type OverlayInteractionMotionModifierValueMap = Record<string, number>;
export type OverlayInteractionMotionModifierValueByPresetId = Partial<Record<string, OverlayInteractionMotionModifierValueMap>>;

export interface OverlayInteractionMotionModuleOverride {
  enabled?: boolean;
  presetId?: string | null;
  intensityMultiplier?: number;
  modifierValuesByPresetId?: OverlayInteractionMotionModifierValueByPresetId;
}

export type OverlayInteractionMotionModuleOverrideMap =
  Partial<Record<InteractionMotionModuleId, OverlayInteractionMotionModuleOverride>>;

export interface OverlayInteractionMotionThemeRecipe {
  defaultPresetId?: string;
  intensityMultiplier?: number;
  surfaceOverrides?: OverlayInteractionMotionSurfaceOverrideMap;
}

export interface InteractionMotionAppearanceSettings {
  interactionMotionEnabled: boolean;
  interactionMotionPresetId: string | null;
  interactionMotionIntensity: number;
  interactionMotionModuleOverrides: OverlayInteractionMotionModuleOverrideMap;
  interactionMotionSurfaceOverrides: OverlayInteractionMotionSurfaceOverrideMap;
}

export interface ResolvedInteractionMotionSurfaceOverride {
  enabled?: boolean;
  intensityMultiplier: number;
}

export interface ResolvedInteractionMotionModuleOverride {
  enabled?: boolean;
  presetId: string | null;
  intensityMultiplier: number;
  modifierValuesByPresetId: OverlayInteractionMotionModifierValueByPresetId;
}

export interface ResolvedInteractionMotionSurfaceStyle {
  enabled: boolean;
  presetId: string;
  intensity: number;
  transition: string | undefined;
  transform: string | undefined;
  filter: string | undefined;
  animation: string | undefined;
  customProperties: Record<string, string>;
  willChange: string | undefined;
  dataAttributes: Record<string, string>;
}

export const interactionMotionAnimationPresetIds = [
  'bounce',
  'lissajous',
  'shake',
  'float',
  'pulse',
  'elastic',
  'wobble',
  'sway',
  'heartbeat',
  'orbit',
] as const;

export type InteractionMotionAnimationPresetId = typeof interactionMotionAnimationPresetIds[number];

export interface InteractionMotionAnimationPresetDefinition {
  id: InteractionMotionAnimationPresetId;
  label: string;
  description: string;
  defaultDurationMs: number;
  defaultEasing: string;
  defaultDirection: 'normal' | 'alternate' | 'alternate-reverse';
}

const DEFAULT_INTERACTION_MOTION_DURATION_MS = 180;
const DEFAULT_INTERACTION_MOTION_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
export const DEFAULT_INTERACTION_MOTION_PRESET_ID = 'subtle';

const DEFAULT_SURFACE_OVERRIDE: ResolvedInteractionMotionSurfaceOverride = {
  intensityMultiplier: 1,
};

const DEFAULT_MODULE_OVERRIDE: ResolvedInteractionMotionModuleOverride = {
  presetId: null,
  intensityMultiplier: 1,
  modifierValuesByPresetId: {},
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
    moduleId: 'fileItems',
    label: 'Explorer Entries',
    description: 'Rows, cards, and semantic explorer items respond to hover, press, selection, and drop-hover states.',
  },
  {
    id: 'explorerEntryIcon',
    moduleId: 'fileItems',
    label: 'Explorer Entry Icons',
    description: 'Folder/file glyphs and thumbnail stages can animate independently from the surrounding row or card.',
  },
  {
    id: 'explorerRailItem',
    moduleId: 'shellChrome',
    label: 'Explorer Rail',
    description: 'Sources, bookmarks, saved searches, and drive rows get the same shared interaction treatment.',
  },
  {
    id: 'previewWorkflowTab',
    moduleId: 'shellChrome',
    label: 'Preview Workflow Tabs',
    description: 'Preview and edit workflow chips feel alive without drifting into heavy chrome.',
  },
  {
    id: 'panelTab',
    moduleId: 'shellChrome',
    label: 'Panel Tabs',
    description: 'Top-bar panel tabs and panel-like shell selectors share one motion profile.',
  },
  {
    id: 'topBarButton',
    moduleId: 'shellChrome',
    label: 'Top Bar Buttons',
    description: 'Chrome controls such as layout, mode, command palette, and focus toggles react consistently.',
  },
  {
    id: 'actionButton',
    moduleId: 'shellChrome',
    label: 'Action Buttons',
    description: 'Settings, dialog, menu, and utility action buttons share one interaction treatment outside the top bar.',
  },
  {
    id: 'settingsCard',
    moduleId: 'shellChrome',
    label: 'Settings Cards',
    description: 'Settings rail tiles, overview cards, and other authoring surfaces use the same motion stack.',
  },
];

export const interactionMotionModuleCatalog: InteractionMotionModuleDefinition[] = [
  {
    id: 'shellChrome',
    label: 'Shell Chrome',
    description: 'Top-bar buttons, tabs, rails, and other shell-adjacent chrome can keep their own motion language.',
    surfaceIds: [
      'explorerRailItem',
      'previewWorkflowTab',
      'panelTab',
      'topBarButton',
      'actionButton',
      'settingsCard',
    ],
  },
  {
    id: 'fileItems',
    label: 'Files & Folders',
    description: 'Explorer rows, cards, thumbnails, file glyphs, and folder icons can use richer content feedback.',
    surfaceIds: [
      'explorerEntry',
      'explorerEntryIcon',
    ],
  },
];

const interactionMotionSurfaceModuleLookup = new Map(
  interactionMotionSurfaceCatalog.map(surface => [surface.id, surface.moduleId] as const),
);

export function getInteractionMotionModuleIdForSurface(
  surfaceId: InteractionMotionSurfaceId,
): InteractionMotionModuleId {
  return interactionMotionSurfaceModuleLookup.get(surfaceId) ?? 'shellChrome';
}

export const interactionMotionAnimationPresetCatalog: InteractionMotionAnimationPresetDefinition[] = [
  {
    id: 'bounce',
    label: 'Bounce',
    description: 'Vertical lift with squash-and-settle energy.',
    defaultDurationMs: 760,
    defaultEasing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    defaultDirection: 'alternate',
  },
  {
    id: 'lissajous',
    label: 'Lissajous',
    description: 'Figure-trace drift for richer 2D pathing.',
    defaultDurationMs: 1400,
    defaultEasing: 'cubic-bezier(0.37, 0, 0.18, 1)',
    defaultDirection: 'normal',
  },
  {
    id: 'shake',
    label: 'Shake',
    description: 'Short reactive jitter for selection or warning energy.',
    defaultDurationMs: 340,
    defaultEasing: 'linear',
    defaultDirection: 'normal',
  },
  {
    id: 'float',
    label: 'Float',
    description: 'Light ambient up/down drift.',
    defaultDurationMs: 1800,
    defaultEasing: 'ease-in-out',
    defaultDirection: 'alternate',
  },
  {
    id: 'pulse',
    label: 'Pulse',
    description: 'Scale breathing for active emphasis.',
    defaultDurationMs: 960,
    defaultEasing: 'ease-in-out',
    defaultDirection: 'alternate',
  },
  {
    id: 'elastic',
    label: 'Elastic',
    description: 'Overshoot-and-settle spring motion.',
    defaultDurationMs: 620,
    defaultEasing: 'cubic-bezier(0.18, 0.9, 0.2, 1.22)',
    defaultDirection: 'alternate',
  },
  {
    id: 'wobble',
    label: 'Wobble',
    description: 'Tilt and lateral wobble for playful chrome.',
    defaultDurationMs: 820,
    defaultEasing: 'ease-in-out',
    defaultDirection: 'alternate',
  },
  {
    id: 'sway',
    label: 'Sway',
    description: 'Pendulum-style swing for tabs and cards.',
    defaultDurationMs: 1250,
    defaultEasing: 'ease-in-out',
    defaultDirection: 'alternate',
  },
  {
    id: 'heartbeat',
    label: 'Heartbeat',
    description: 'Two-step accent pulse for active objects.',
    defaultDurationMs: 1100,
    defaultEasing: 'ease-in-out',
    defaultDirection: 'normal',
  },
  {
    id: 'orbit',
    label: 'Orbit',
    description: 'Tiny circular drift around the base pose.',
    defaultDurationMs: 1500,
    defaultEasing: 'linear',
    defaultDirection: 'normal',
  },
];

const interactionMotionAnimationPresetMap = new Map(
  interactionMotionAnimationPresetCatalog.map(preset => [preset.id, preset] as const),
);

function scaleAnimatedAmplitude(
  effect: OverlayInteractionMotionEffect,
  factor: number,
): OverlayInteractionMotionEffect {
  const nextScale = 1 + (((effect.scale ?? 1) - 1) * factor);
  const nextBrightness = 1 + (((effect.brightness ?? 1) - 1) * factor);
  const nextSaturation = 1 + (((effect.saturation ?? 1) - 1) * factor);

  return {
    translateX: (effect.translateX ?? 0) * factor || undefined,
    translateY: (effect.translateY ?? 0) * factor || undefined,
    scale: Math.abs(nextScale - 1) > 0.0005 ? nextScale : undefined,
    rotateDeg: (effect.rotateDeg ?? 0) * factor || undefined,
    brightness: Math.abs(nextBrightness - 1) > 0.0005 ? nextBrightness : undefined,
    saturation: Math.abs(nextSaturation - 1) > 0.0005 ? nextSaturation : undefined,
  };
}

function createAnimatedEffect(
  animationPresetId: InteractionMotionAnimationPresetId,
  effect: OverlayInteractionMotionEffect,
  options?: {
    durationMs?: number;
    easing?: string;
    iterationCount?: number | 'infinite';
    direction?: 'normal' | 'alternate' | 'alternate-reverse';
  },
): OverlayInteractionMotionEffect {
  return {
    ...effect,
    animationPresetId,
    animationDurationMs: options?.durationMs,
    animationIterationCount: options?.iterationCount ?? 'infinite',
    animationDirection: options?.direction,
    easing: options?.easing,
  };
}

function createAnimatedSurfaceProfile(
  animationPresetId: InteractionMotionAnimationPresetId,
  effect: OverlayInteractionMotionEffect,
  durationMs: number,
  easing: string,
  options?: {
    supportsSelect?: boolean;
    supportsActivate?: boolean;
    pressScale?: number;
  },
): Partial<Record<InteractionMotionTrigger, OverlayInteractionMotionEffect>> {
  const supportsSelect = options?.supportsSelect !== false;
  const supportsActivate = options?.supportsActivate !== false;

  return {
    hover: createAnimatedEffect(animationPresetId, effect, {
      durationMs,
      easing,
      direction: 'alternate',
    }),
    press: { scale: options?.pressScale ?? 0.982 },
    ...(supportsSelect
      ? {
        select: createAnimatedEffect(
          animationPresetId,
          scaleAnimatedAmplitude(effect, 0.78),
          { durationMs: Math.round(durationMs * 1.08), easing, direction: 'alternate' },
        ),
      }
      : {}),
    ...(supportsActivate
      ? {
        activate: createAnimatedEffect(
          animationPresetId,
          scaleAnimatedAmplitude(effect, 0.72),
          { durationMs: Math.round(durationMs * 1.04), easing, direction: 'alternate' },
        ),
      }
      : {}),
    'drop-hover': createAnimatedEffect(
      animationPresetId,
      scaleAnimatedAmplitude(effect, 1.18),
      { durationMs: Math.max(220, Math.round(durationMs * 0.92)), easing, direction: 'alternate' },
    ),
  };
}

function createKClonerProfile(args: {
  id: string;
  label: string;
  description: string;
  animationPresetId: InteractionMotionAnimationPresetId;
  durationMs: number;
  easing: string;
  explorerEntry: OverlayInteractionMotionEffect;
  explorerEntryIcon: OverlayInteractionMotionEffect;
  explorerRailItem: OverlayInteractionMotionEffect;
  previewWorkflowTab: OverlayInteractionMotionEffect;
  panelTab: OverlayInteractionMotionEffect;
  topBarButton: OverlayInteractionMotionEffect;
  actionButton: OverlayInteractionMotionEffect;
  settingsCard: OverlayInteractionMotionEffect;
}): OverlayInteractionMotionProfile {
  return {
    id: args.id,
    label: args.label,
    description: args.description,
    groupId: 'kcloner',
    defaultDurationMs: args.durationMs,
    defaultEasing: args.easing,
    surfaces: {
      explorerEntry: createAnimatedSurfaceProfile(
        args.animationPresetId,
        args.explorerEntry,
        args.durationMs,
        args.easing,
        { supportsActivate: false, pressScale: 0.978 },
      ),
      explorerEntryIcon: createAnimatedSurfaceProfile(
        args.animationPresetId,
        args.explorerEntryIcon,
        Math.max(260, Math.round(args.durationMs * 0.95)),
        args.easing,
        { supportsActivate: false, pressScale: 0.968 },
      ),
      explorerRailItem: createAnimatedSurfaceProfile(
        args.animationPresetId,
        args.explorerRailItem,
        Math.max(220, Math.round(args.durationMs * 0.88)),
        args.easing,
        { supportsSelect: false, pressScale: 0.984 },
      ),
      previewWorkflowTab: createAnimatedSurfaceProfile(
        args.animationPresetId,
        args.previewWorkflowTab,
        Math.max(220, Math.round(args.durationMs * 0.84)),
        args.easing,
        { supportsSelect: false, pressScale: 0.982 },
      ),
      panelTab: createAnimatedSurfaceProfile(
        args.animationPresetId,
        args.panelTab,
        Math.max(220, Math.round(args.durationMs * 0.86)),
        args.easing,
        { supportsSelect: false, pressScale: 0.982 },
      ),
      topBarButton: createAnimatedSurfaceProfile(
        args.animationPresetId,
        args.topBarButton,
        Math.max(220, Math.round(args.durationMs * 0.8)),
        args.easing,
        { supportsSelect: false, pressScale: 0.978 },
      ),
      actionButton: createAnimatedSurfaceProfile(
        args.animationPresetId,
        args.actionButton,
        Math.max(220, Math.round(args.durationMs * 0.88)),
        args.easing,
        { supportsSelect: false, pressScale: 0.982 },
      ),
      settingsCard: createAnimatedSurfaceProfile(
        args.animationPresetId,
        args.settingsCard,
        Math.max(280, Math.round(args.durationMs * 1.1)),
        args.easing,
        { supportsSelect: false, pressScale: 0.988 },
      ),
    },
  };
}

export const interactionMotionProfiles: OverlayInteractionMotionProfile[] = [
  {
    id: 'subtle',
    label: 'Subtle',
    description: 'Restrained lift-and-settle shell default.',
    groupId: 'system',
    defaultDurationMs: 170,
    defaultEasing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    surfaces: {
      explorerEntry: {
        hover: { translateY: -1.5, scale: 1.008 },
        press: { translateY: 0.5, scale: 0.988 },
        select: { scale: 1.004, brightness: 1.02 },
        'drop-hover': { translateY: -2, scale: 1.01, brightness: 1.03 },
      },
      explorerEntryIcon: {
        hover: { translateY: -2.5, scale: 1.024 },
        press: { scale: 0.97 },
        select: { translateY: -1.25, scale: 1.03, brightness: 1.03 },
        'drop-hover': { translateY: -3, scale: 1.04, brightness: 1.04 },
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
      actionButton: {
        hover: { translateY: -1.25, scale: 1.012 },
        press: { translateY: 0.5, scale: 0.982 },
        activate: { scale: 1.012, brightness: 1.03 },
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
    description: 'Deeper settle with more travel and overshoot.',
    groupId: 'system',
    defaultDurationMs: 220,
    defaultEasing: 'cubic-bezier(0.2, 0.9, 0.2, 1.06)',
    surfaces: {
      explorerEntry: {
        hover: { translateY: -2.5, scale: 1.016 },
        press: { translateY: 1, scale: 0.982 },
        select: { scale: 1.01, brightness: 1.03 },
        'drop-hover': { translateY: -3, scale: 1.02, brightness: 1.04 },
      },
      explorerEntryIcon: {
        hover: { translateY: -4, scale: 1.04 },
        press: { scale: 0.966 },
        select: { translateY: -2, scale: 1.05, brightness: 1.04 },
        'drop-hover': { translateY: -5, scale: 1.06, brightness: 1.05 },
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
      actionButton: {
        hover: { translateY: -1.75, scale: 1.018 },
        press: { translateY: 0.8, scale: 0.98 },
        activate: { scale: 1.02, brightness: 1.03 },
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
    description: 'Tilted, lively shell motion with more personality.',
    groupId: 'system',
    defaultDurationMs: 250,
    defaultEasing: 'cubic-bezier(0.18, 0.98, 0.25, 1.08)',
    surfaces: {
      explorerEntry: {
        hover: { translateY: -3, scale: 1.02, rotateDeg: -0.35 },
        press: { translateY: 1.2, scale: 0.978, rotateDeg: 0.35 },
        select: { scale: 1.012, rotateDeg: 0.15, brightness: 1.04 },
        'drop-hover': { translateY: -4, scale: 1.028, rotateDeg: -0.4, brightness: 1.05 },
      },
      explorerEntryIcon: {
        hover: { translateY: -5, scale: 1.06, rotateDeg: -3 },
        press: { scale: 0.964, rotateDeg: 3 },
        select: { translateY: -2, scale: 1.07, rotateDeg: -1.5, brightness: 1.05 },
        'drop-hover': { translateY: -6, scale: 1.08, rotateDeg: -4, brightness: 1.06 },
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
      actionButton: {
        hover: { translateY: -2.25, scale: 1.022, rotateDeg: -0.25 },
        press: { translateY: 1, scale: 0.978, rotateDeg: 0.24 },
        activate: { scale: 1.024, brightness: 1.04 },
      },
      settingsCard: {
        hover: { translateY: -4, scale: 1.016, rotateDeg: -0.35 },
        press: { scale: 0.986, rotateDeg: 0.28 },
        activate: { brightness: 1.03 },
      },
    },
  },
  createKClonerProfile({
    id: 'bounce',
    label: 'Bounce',
    description: 'KCloner-style vertical bounce for files, tabs, and chrome.',
    animationPresetId: 'bounce',
    durationMs: 760,
    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    explorerEntry: { translateY: -6, scale: 1.03 },
    explorerEntryIcon: { translateY: -10, scale: 1.08, rotateDeg: -3 },
    explorerRailItem: { translateY: -4, scale: 1.03 },
    previewWorkflowTab: { translateY: -4, scale: 1.04 },
    panelTab: { translateY: -4, scale: 1.04 },
    topBarButton: { translateY: -3, scale: 1.04 },
    actionButton: { translateY: -4, scale: 1.03 },
    settingsCard: { translateY: -6, scale: 1.02 },
  }),
  createKClonerProfile({
    id: 'lissajous',
    label: 'Lissajous',
    description: 'Figure-eight pathing pulled from the KCloner motion set.',
    animationPresetId: 'lissajous',
    durationMs: 1400,
    easing: 'cubic-bezier(0.37, 0, 0.18, 1)',
    explorerEntry: { translateX: 5, translateY: -4, rotateDeg: 1.2, scale: 1.02 },
    explorerEntryIcon: { translateX: 8, translateY: -7, rotateDeg: 3, scale: 1.05 },
    explorerRailItem: { translateX: 4, translateY: -2, rotateDeg: 1.4, scale: 1.02 },
    previewWorkflowTab: { translateX: 3, translateY: -2, rotateDeg: 1.1, scale: 1.02 },
    panelTab: { translateX: 3.5, translateY: -2.5, rotateDeg: 1.2, scale: 1.02 },
    topBarButton: { translateX: 2.5, translateY: -2, rotateDeg: 1.1, scale: 1.02 },
    actionButton: { translateX: 3.25, translateY: -2.5, rotateDeg: 1, scale: 1.02 },
    settingsCard: { translateX: 4, translateY: -4, rotateDeg: 0.8, scale: 1.015 },
  }),
  createKClonerProfile({
    id: 'shake',
    label: 'Shake',
    description: 'Fast reactive jitter for warnings, picks, and punchy feedback.',
    animationPresetId: 'shake',
    durationMs: 340,
    easing: 'linear',
    explorerEntry: { translateX: 3, rotateDeg: 1.4 },
    explorerEntryIcon: { translateX: 6, rotateDeg: 4.5, scale: 1.02 },
    explorerRailItem: { translateX: 3, rotateDeg: 1.5 },
    previewWorkflowTab: { translateX: 2.5, rotateDeg: 1.2 },
    panelTab: { translateX: 2.5, rotateDeg: 1.2 },
    topBarButton: { translateX: 2.25, rotateDeg: 1.1 },
    actionButton: { translateX: 2.25, rotateDeg: 1 },
    settingsCard: { translateX: 2, rotateDeg: 0.9 },
  }),
  createKClonerProfile({
    id: 'float',
    label: 'Float',
    description: 'Ambient up/down drift for calmer shell motion.',
    animationPresetId: 'float',
    durationMs: 1800,
    easing: 'ease-in-out',
    explorerEntry: { translateY: -4, scale: 1.012 },
    explorerEntryIcon: { translateY: -8, scale: 1.05 },
    explorerRailItem: { translateY: -2.5, scale: 1.015 },
    previewWorkflowTab: { translateY: -2.5, scale: 1.015 },
    panelTab: { translateY: -3, scale: 1.016 },
    topBarButton: { translateY: -2.5, scale: 1.016 },
    actionButton: { translateY: -3.5, scale: 1.015 },
    settingsCard: { translateY: -5, scale: 1.012 },
  }),
  createKClonerProfile({
    id: 'pulse',
    label: 'Pulse',
    description: 'Scale pulse for active or focused shell targets.',
    animationPresetId: 'pulse',
    durationMs: 960,
    easing: 'ease-in-out',
    explorerEntry: { scale: 1.045, brightness: 1.03 },
    explorerEntryIcon: { scale: 1.085, brightness: 1.05 },
    explorerRailItem: { scale: 1.04, brightness: 1.03 },
    previewWorkflowTab: { scale: 1.05, brightness: 1.03 },
    panelTab: { scale: 1.05, brightness: 1.035 },
    topBarButton: { scale: 1.045, brightness: 1.03 },
    actionButton: { scale: 1.04, brightness: 1.028 },
    settingsCard: { scale: 1.028, brightness: 1.02 },
  }),
  createKClonerProfile({
    id: 'elastic',
    label: 'Elastic',
    description: 'Overshoot and rebound without full chaos.',
    animationPresetId: 'elastic',
    durationMs: 620,
    easing: 'cubic-bezier(0.18, 0.9, 0.2, 1.22)',
    explorerEntry: { translateY: -4, scale: 1.06 },
    explorerEntryIcon: { translateY: -8, scale: 1.11, rotateDeg: -2 },
    explorerRailItem: { translateX: 2.5, scale: 1.05 },
    previewWorkflowTab: { translateY: -2.5, scale: 1.06 },
    panelTab: { translateY: -3, scale: 1.06 },
    topBarButton: { translateY: -2.5, scale: 1.055 },
    actionButton: { translateY: -3, scale: 1.05 },
    settingsCard: { translateY: -5, scale: 1.03 },
  }),
  createKClonerProfile({
    id: 'wobble',
    label: 'Wobble',
    description: 'Playful tilt-and-slide for expressive UI chrome.',
    animationPresetId: 'wobble',
    durationMs: 820,
    easing: 'ease-in-out',
    explorerEntry: { translateX: 4, rotateDeg: 2.6, scale: 1.02 },
    explorerEntryIcon: { translateX: 6, rotateDeg: 5, scale: 1.06 },
    explorerRailItem: { translateX: 3.5, rotateDeg: 2.3, scale: 1.025 },
    previewWorkflowTab: { translateX: 2.5, rotateDeg: 2.1, scale: 1.025 },
    panelTab: { translateX: 3, rotateDeg: 2.2, scale: 1.025 },
    topBarButton: { translateX: 2.5, rotateDeg: 2.1, scale: 1.022 },
    actionButton: { translateX: 3, rotateDeg: 1.8, scale: 1.02 },
    settingsCard: { translateX: 4, rotateDeg: 1.5, scale: 1.018 },
  }),
  createKClonerProfile({
    id: 'sway',
    label: 'Sway',
    description: 'Pendulum motion for tabs, cards, and list surfaces.',
    animationPresetId: 'sway',
    durationMs: 1250,
    easing: 'ease-in-out',
    explorerEntry: { translateX: 2, rotateDeg: 4.5, scale: 1.015 },
    explorerEntryIcon: { translateX: 4, rotateDeg: 8, scale: 1.045 },
    explorerRailItem: { translateX: 1.5, rotateDeg: 4.2, scale: 1.02 },
    previewWorkflowTab: { translateX: 1.5, rotateDeg: 3.8, scale: 1.02 },
    panelTab: { translateX: 1.5, rotateDeg: 4.1, scale: 1.02 },
    topBarButton: { translateX: 1.25, rotateDeg: 3.6, scale: 1.018 },
    actionButton: { translateX: 1.75, rotateDeg: 2.8, scale: 1.018 },
    settingsCard: { translateX: 2.25, rotateDeg: 2.5, scale: 1.015 },
  }),
  createKClonerProfile({
    id: 'heartbeat',
    label: 'Heartbeat',
    description: 'Double-pulse accent for active shell surfaces.',
    animationPresetId: 'heartbeat',
    durationMs: 1100,
    easing: 'ease-in-out',
    explorerEntry: { scale: 1.05, brightness: 1.03 },
    explorerEntryIcon: { scale: 1.095, brightness: 1.05 },
    explorerRailItem: { scale: 1.04, brightness: 1.03 },
    previewWorkflowTab: { scale: 1.05, brightness: 1.03 },
    panelTab: { scale: 1.05, brightness: 1.03 },
    topBarButton: { scale: 1.045, brightness: 1.03 },
    actionButton: { scale: 1.04, brightness: 1.028 },
    settingsCard: { scale: 1.03, brightness: 1.02 },
  }),
  createKClonerProfile({
    id: 'orbit',
    label: 'Orbit',
    description: 'Small circular drift for icons and shell controls.',
    animationPresetId: 'orbit',
    durationMs: 1500,
    easing: 'linear',
    explorerEntry: { translateX: 4, translateY: -4, rotateDeg: 1.3, scale: 1.02 },
    explorerEntryIcon: { translateX: 7, translateY: -7, rotateDeg: 3.5, scale: 1.05 },
    explorerRailItem: { translateX: 3, translateY: -2, rotateDeg: 1.5, scale: 1.02 },
    previewWorkflowTab: { translateX: 2.5, translateY: -1.5, rotateDeg: 1.2, scale: 1.02 },
    panelTab: { translateX: 2.5, translateY: -1.5, rotateDeg: 1.3, scale: 1.02 },
    topBarButton: { translateX: 2, translateY: -1.5, rotateDeg: 1.2, scale: 1.02 },
    actionButton: { translateX: 2.5, translateY: -2, rotateDeg: 1.05, scale: 1.02 },
    settingsCard: { translateX: 3, translateY: -3, rotateDeg: 1.1, scale: 1.016 },
  }),
];

export const interactionMotionProfilesById = new Map(
  interactionMotionProfiles.map(profile => [profile.id, profile] as const),
);

export const interactionMotionPresetOptions = interactionMotionProfiles.map(profile => ({
  id: profile.id,
  label: profile.label,
  description: profile.description,
  groupId: profile.groupId,
}));

interface InteractionMotionProfileModifierDefinition {
  profileId: string;
  controls: readonly InteractionMotionModifierControlDefinition[];
}

const interactionMotionProfileModifierCatalog: InteractionMotionProfileModifierDefinition[] = [
  {
    profileId: 'bounce',
    controls: withInteractionMotionStepControl([
      {
        id: 'height',
        label: 'Height',
        description: 'How far the motion lifts before settling back.',
        min: 0.4,
        max: 2.4,
        step: 0.05,
        defaultValue: 1,
        valueSuffix: 'x',
      },
      {
        id: 'squash',
        label: 'Squash',
        description: 'How much the surface compresses and stretches at the peak.',
        min: 0.5,
        max: 2.2,
        step: 0.05,
        defaultValue: 1,
        valueSuffix: 'x',
      },
      {
        id: 'pace',
        label: 'Pace',
        description: 'Higher pace means faster bounce loops.',
        min: 0.5,
        max: 2.2,
        step: 0.05,
        defaultValue: 1,
        valueSuffix: 'x',
      },
    ], 0.1),
  },
  {
    profileId: 'lissajous',
    controls: withInteractionMotionStepControl([
      {
        id: 'width',
        label: 'Width',
        description: 'Horizontal travel along the Lissajous path.',
        min: 0.4,
        max: 2.5,
        step: 0.05,
        defaultValue: 1,
        valueSuffix: 'x',
      },
      {
        id: 'height',
        label: 'Height',
        description: 'Vertical travel along the path.',
        min: 0.4,
        max: 2.5,
        step: 0.05,
        defaultValue: 1,
        valueSuffix: 'x',
      },
      {
        id: 'spin',
        label: 'Spin',
        description: 'Adds more rotational energy and speeds the pattern up.',
        min: 0.5,
        max: 2.2,
        step: 0.05,
        defaultValue: 1,
        valueSuffix: 'x',
      },
    ], 0.05),
  },
  {
    profileId: 'shake',
    controls: withInteractionMotionStepControl([
      {
        id: 'distance',
        label: 'Distance',
        description: 'How far the jitter throws the surface.',
        min: 0.4,
        max: 2.5,
        step: 0.05,
        defaultValue: 1,
        valueSuffix: 'x',
      },
      {
        id: 'tilt',
        label: 'Tilt',
        description: 'How much rotational punch gets mixed into the shake.',
        min: 0.4,
        max: 2.5,
        step: 0.05,
        defaultValue: 1,
        valueSuffix: 'x',
      },
      {
        id: 'pace',
        label: 'Pace',
        description: 'Higher pace shortens the reactive burst.',
        min: 0.5,
        max: 2.4,
        step: 0.05,
        defaultValue: 1,
        valueSuffix: 'x',
      },
    ], 0.05),
  },
  {
    profileId: 'float',
    controls: withInteractionMotionStepControl([
      {
        id: 'height',
        label: 'Height',
        description: 'How far the idle drift rises and falls.',
        min: 0.4,
        max: 2.5,
        step: 0.05,
        defaultValue: 1,
        valueSuffix: 'x',
      },
      {
        id: 'scale',
        label: 'Scale',
        description: 'How much size breathing accompanies the drift.',
        min: 0.4,
        max: 2.2,
        step: 0.05,
        defaultValue: 1,
        valueSuffix: 'x',
      },
      {
        id: 'pace',
        label: 'Pace',
        description: 'Higher pace makes the float loop cycle faster.',
        min: 0.5,
        max: 2.2,
        step: 0.05,
        defaultValue: 1,
        valueSuffix: 'x',
      },
    ], 0.2),
  },
  {
    profileId: 'pulse',
    controls: withInteractionMotionStepControl([
      {
        id: 'amount',
        label: 'Amount',
        description: 'How large the scale pulse becomes.',
        min: 0.4,
        max: 2.4,
        step: 0.05,
        defaultValue: 1,
        valueSuffix: 'x',
      },
      {
        id: 'glow',
        label: 'Glow',
        description: 'How bright the pulse reads at its peak.',
        min: 0.4,
        max: 2.4,
        step: 0.05,
        defaultValue: 1,
        valueSuffix: 'x',
      },
      {
        id: 'pace',
        label: 'Pace',
        description: 'Higher pace makes the pulse loop faster.',
        min: 0.5,
        max: 2.2,
        step: 0.05,
        defaultValue: 1,
        valueSuffix: 'x',
      },
    ], 0.1),
  },
  {
    profileId: 'elastic',
    controls: withInteractionMotionStepControl([
      {
        id: 'travel',
        label: 'Travel',
        description: 'How far the overshoot travels before rebound.',
        min: 0.4,
        max: 2.5,
        step: 0.05,
        defaultValue: 1,
        valueSuffix: 'x',
      },
      {
        id: 'overshoot',
        label: 'Overshoot',
        description: 'How strong the stretch and rebound feel.',
        min: 0.4,
        max: 2.4,
        step: 0.05,
        defaultValue: 1,
        valueSuffix: 'x',
      },
      {
        id: 'pace',
        label: 'Pace',
        description: 'Higher pace speeds up the settle.',
        min: 0.5,
        max: 2.3,
        step: 0.05,
        defaultValue: 1,
        valueSuffix: 'x',
      },
    ], 0.1),
  },
  {
    profileId: 'wobble',
    controls: withInteractionMotionStepControl([
      {
        id: 'travel',
        label: 'Travel',
        description: 'How far the wobble slides side to side.',
        min: 0.4,
        max: 2.5,
        step: 0.05,
        defaultValue: 1,
        valueSuffix: 'x',
      },
      {
        id: 'angle',
        label: 'Angle',
        description: 'How much the wobble tilts.',
        min: 0.4,
        max: 2.5,
        step: 0.05,
        defaultValue: 1,
        valueSuffix: 'x',
      },
      {
        id: 'stretch',
        label: 'Stretch',
        description: 'How much scale breathing gets mixed into the wobble.',
        min: 0.4,
        max: 2.2,
        step: 0.05,
        defaultValue: 1,
        valueSuffix: 'x',
      },
    ], 0.2),
  },
  {
    profileId: 'sway',
    controls: withInteractionMotionStepControl([
      {
        id: 'angle',
        label: 'Angle',
        description: 'How far the pendulum swing rotates.',
        min: 0.4,
        max: 2.5,
        step: 0.05,
        defaultValue: 1,
        valueSuffix: 'x',
      },
      {
        id: 'travel',
        label: 'Travel',
        description: 'How much horizontal slide accompanies the swing.',
        min: 0.4,
        max: 2.4,
        step: 0.05,
        defaultValue: 1,
        valueSuffix: 'x',
      },
      {
        id: 'pace',
        label: 'Pace',
        description: 'Higher pace makes the sway cycle faster.',
        min: 0.5,
        max: 2.2,
        step: 0.05,
        defaultValue: 1,
        valueSuffix: 'x',
      },
    ], 0.2),
  },
  {
    profileId: 'heartbeat',
    controls: withInteractionMotionStepControl([
      {
        id: 'amount',
        label: 'Amount',
        description: 'How much scale gets pumped into each beat.',
        min: 0.4,
        max: 2.4,
        step: 0.05,
        defaultValue: 1,
        valueSuffix: 'x',
      },
      {
        id: 'glow',
        label: 'Glow',
        description: 'How bright the double-beat accent becomes.',
        min: 0.4,
        max: 2.4,
        step: 0.05,
        defaultValue: 1,
        valueSuffix: 'x',
      },
      {
        id: 'pace',
        label: 'Pace',
        description: 'Higher pace makes the heartbeat quicker.',
        min: 0.5,
        max: 2.4,
        step: 0.05,
        defaultValue: 1,
        valueSuffix: 'x',
      },
    ], 0),
  },
  {
    profileId: 'orbit',
    controls: withInteractionMotionStepControl([
      {
        id: 'radius',
        label: 'Radius',
        description: 'How far the surface travels around the orbit path.',
        min: 0.4,
        max: 2.6,
        step: 0.05,
        defaultValue: 1,
        valueSuffix: 'x',
      },
      {
        id: 'lift',
        label: 'Lift',
        description: 'How much vertical climb gets mixed into the orbit.',
        min: 0.4,
        max: 2.6,
        step: 0.05,
        defaultValue: 1,
        valueSuffix: 'x',
      },
      {
        id: 'spin',
        label: 'Spin',
        description: 'Higher spin increases rotation and orbit speed.',
        min: 0.5,
        max: 2.4,
        step: 0.05,
        defaultValue: 1,
        valueSuffix: 'x',
      },
    ], 0.1),
  },
];

function createInteractionMotionStepControl(
  defaultValue: number,
): InteractionMotionModifierControlDefinition {
  return {
    id: 'step',
    label: 'Step',
    description: 'Per-instance phase offset in seconds. Higher values spread matching items out instead of running them in perfect sync.',
    min: 0,
    max: 0.5,
    step: 0.01,
    defaultValue,
    valueSuffix: 's',
  };
}

function withInteractionMotionStepControl(
  controls: readonly InteractionMotionModifierControlDefinition[],
  defaultStepValue: number,
): readonly InteractionMotionModifierControlDefinition[] {
  return [
    ...controls,
    createInteractionMotionStepControl(defaultStepValue),
  ];
}

const interactionMotionProfileModifierLookup = new Map(
  interactionMotionProfileModifierCatalog.map(entry => [entry.profileId, entry.controls] as const),
);

export function getInteractionMotionProfileModifierControls(
  profileId: string,
): readonly InteractionMotionModifierControlDefinition[] {
  return interactionMotionProfileModifierLookup.get(profileId) ?? [];
}

function clampInteractionMotionModifierControlValue(
  control: InteractionMotionModifierControlDefinition,
  value: unknown,
): number {
  const numericValue = typeof value === 'number' && Number.isFinite(value)
    ? value
    : control.defaultValue;
  return Math.min(control.max, Math.max(control.min, numericValue));
}

export function resolveInteractionMotionModifierValues(
  profileId: string,
  value: unknown,
): OverlayInteractionMotionModifierValueMap {
  const controls = getInteractionMotionProfileModifierControls(profileId);
  if (controls.length === 0) {
    return {};
  }

  const inputValues = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

  return Object.fromEntries(
    controls.map(control => [
      control.id,
      clampInteractionMotionModifierControlValue(control, inputValues[control.id]),
    ]),
  );
}

export function formatInteractionMotionModifierControlValue(
  control: InteractionMotionModifierControlDefinition,
  value: number,
): string {
  const resolvedValue = clampInteractionMotionModifierControlValue(control, value);
  return `${resolvedValue.toFixed(2)}${control.valueSuffix ?? ''}`;
}

function normalizeInteractionMotionModifierValueByPresetId(
  value: unknown,
): OverlayInteractionMotionModifierValueByPresetId {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([profileId]) => interactionMotionProfilesById.has(profileId))
      .map(([profileId, controlValues]) => [
        profileId,
        resolveInteractionMotionModifierValues(profileId, controlValues),
      ]),
  );
}

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

export function normalizeInteractionMotionModuleOverride(
  value: OverlayInteractionMotionModuleOverride | null | undefined,
): ResolvedInteractionMotionModuleOverride {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return DEFAULT_MODULE_OVERRIDE;
  }

  return {
    enabled: typeof value.enabled === 'boolean' ? value.enabled : undefined,
    presetId: normalizeInteractionMotionPresetId(value.presetId) ?? null,
    intensityMultiplier: clampInteractionMotionIntensity(value.intensityMultiplier, 1),
    modifierValuesByPresetId: normalizeInteractionMotionModifierValueByPresetId(value.modifierValuesByPresetId),
  };
}

export function normalizeInteractionMotionModuleOverrideMap(
  value: unknown,
): OverlayInteractionMotionModuleOverrideMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([moduleId]) => interactionMotionModuleIds.includes(moduleId as InteractionMotionModuleId))
      .map(([moduleId, overrideValue]) => [
        moduleId,
        normalizeInteractionMotionModuleOverride(
          overrideValue as OverlayInteractionMotionModuleOverride | null | undefined,
        ),
      ]),
  ) as OverlayInteractionMotionModuleOverrideMap;
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

export function resolveInteractionMotionModuleProfileId(args: {
  moduleId: InteractionMotionModuleId;
  settings: InteractionMotionAppearanceSettings;
  themeDefaultPresetId?: string | null;
}): string {
  const moduleOverride = normalizeInteractionMotionModuleOverride(
    args.settings.interactionMotionModuleOverrides[args.moduleId],
  );

  return resolveInteractionMotionProfileId({
    userOverrideId: moduleOverride.presetId ?? args.settings.interactionMotionPresetId,
    themeDefaultPresetId: args.themeDefaultPresetId,
  });
}

function scaleInteractionMotionDeltaValue(
  value: number | undefined,
  factor: number,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  return 1 + ((value - 1) * factor);
}

function tuneInteractionMotionEffect(
  effect: OverlayInteractionMotionEffect,
  factors: {
    translateX?: number;
    translateY?: number;
    scale?: number;
    rotate?: number;
    brightness?: number;
    saturation?: number;
    duration?: number;
  },
): OverlayInteractionMotionEffect {
  const durationMultiplier = factors.duration ?? 1;
  return {
    ...effect,
    translateX: effect.translateX === undefined
      ? undefined
      : effect.translateX * (factors.translateX ?? 1),
    translateY: effect.translateY === undefined
      ? undefined
      : effect.translateY * (factors.translateY ?? 1),
    scale: scaleInteractionMotionDeltaValue(effect.scale, factors.scale ?? 1),
    rotateDeg: effect.rotateDeg === undefined
      ? undefined
      : effect.rotateDeg * (factors.rotate ?? 1),
    rotateXDeg: effect.rotateXDeg === undefined
      ? undefined
      : effect.rotateXDeg * (factors.rotate ?? 1),
    rotateYDeg: effect.rotateYDeg === undefined
      ? undefined
      : effect.rotateYDeg * (factors.rotate ?? 1),
    brightness: scaleInteractionMotionDeltaValue(effect.brightness, factors.brightness ?? 1),
    saturation: scaleInteractionMotionDeltaValue(effect.saturation, factors.saturation ?? 1),
    durationMs: effect.durationMs === undefined
      ? undefined
      : Math.max(120, Math.round(effect.durationMs * durationMultiplier)),
    animationDurationMs: effect.animationDurationMs === undefined
      ? undefined
      : Math.max(120, Math.round(effect.animationDurationMs * durationMultiplier)),
  };
}

function mapInteractionMotionProfileEffects(
  profile: OverlayInteractionMotionProfile,
  mapper: (effect: OverlayInteractionMotionEffect) => OverlayInteractionMotionEffect,
  options?: {
    defaultDurationMultiplier?: number;
  },
): OverlayInteractionMotionProfile {
  const nextSurfaces = Object.fromEntries(
    Object.entries(profile.surfaces).map(([surfaceId, triggerMap]) => [
      surfaceId,
      Object.fromEntries(
        Object.entries(triggerMap ?? {}).map(([triggerId, effect]) => [
          triggerId,
          mapper(effect as OverlayInteractionMotionEffect),
        ]),
      ),
    ]),
  ) as OverlayInteractionMotionProfile['surfaces'];

  return {
    ...profile,
    defaultDurationMs: Math.max(
      120,
      Math.round(profile.defaultDurationMs * (options?.defaultDurationMultiplier ?? 1)),
    ),
    surfaces: nextSurfaces,
  };
}

function applyInteractionMotionModifierValues(
  profile: OverlayInteractionMotionProfile,
  modifierValues: OverlayInteractionMotionModifierValueMap,
): OverlayInteractionMotionProfile {
  switch (profile.id) {
    case 'bounce':
      return mapInteractionMotionProfileEffects(
        profile,
        effect => tuneInteractionMotionEffect(effect, {
          translateY: modifierValues.height,
          scale: modifierValues.squash,
          duration: 1 / modifierValues.pace,
        }),
        { defaultDurationMultiplier: 1 / modifierValues.pace },
      );
    case 'lissajous':
      return mapInteractionMotionProfileEffects(
        profile,
        effect => tuneInteractionMotionEffect(effect, {
          translateX: modifierValues.width,
          translateY: modifierValues.height,
          rotate: modifierValues.spin,
          duration: 1 / modifierValues.spin,
        }),
        { defaultDurationMultiplier: 1 / modifierValues.spin },
      );
    case 'shake':
      return mapInteractionMotionProfileEffects(
        profile,
        effect => tuneInteractionMotionEffect(effect, {
          translateX: modifierValues.distance,
          rotate: modifierValues.tilt,
          duration: 1 / modifierValues.pace,
        }),
        { defaultDurationMultiplier: 1 / modifierValues.pace },
      );
    case 'float':
      return mapInteractionMotionProfileEffects(
        profile,
        effect => tuneInteractionMotionEffect(effect, {
          translateY: modifierValues.height,
          scale: modifierValues.scale,
          duration: 1 / modifierValues.pace,
        }),
        { defaultDurationMultiplier: 1 / modifierValues.pace },
      );
    case 'pulse':
      return mapInteractionMotionProfileEffects(
        profile,
        effect => tuneInteractionMotionEffect(effect, {
          scale: modifierValues.amount,
          brightness: modifierValues.glow,
          duration: 1 / modifierValues.pace,
        }),
        { defaultDurationMultiplier: 1 / modifierValues.pace },
      );
    case 'elastic':
      return mapInteractionMotionProfileEffects(
        profile,
        effect => tuneInteractionMotionEffect(effect, {
          translateX: modifierValues.travel,
          translateY: modifierValues.travel,
          scale: modifierValues.overshoot,
          duration: 1 / modifierValues.pace,
        }),
        { defaultDurationMultiplier: 1 / modifierValues.pace },
      );
    case 'wobble':
      return mapInteractionMotionProfileEffects(
        profile,
        effect => tuneInteractionMotionEffect(effect, {
          translateX: modifierValues.travel,
          rotate: modifierValues.angle,
          scale: modifierValues.stretch,
        }),
      );
    case 'sway':
      return mapInteractionMotionProfileEffects(
        profile,
        effect => tuneInteractionMotionEffect(effect, {
          translateX: modifierValues.travel,
          rotate: modifierValues.angle,
          duration: 1 / modifierValues.pace,
        }),
        { defaultDurationMultiplier: 1 / modifierValues.pace },
      );
    case 'heartbeat':
      return mapInteractionMotionProfileEffects(
        profile,
        effect => tuneInteractionMotionEffect(effect, {
          scale: modifierValues.amount,
          brightness: modifierValues.glow,
          duration: 1 / modifierValues.pace,
        }),
        { defaultDurationMultiplier: 1 / modifierValues.pace },
      );
    case 'orbit':
      return mapInteractionMotionProfileEffects(
        profile,
        effect => tuneInteractionMotionEffect(effect, {
          translateX: modifierValues.radius,
          translateY: modifierValues.lift,
          rotate: modifierValues.spin,
          duration: 1 / modifierValues.spin,
        }),
        { defaultDurationMultiplier: 1 / modifierValues.spin },
      );
    default:
      return profile;
  }
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

function resolveInteractionMotionAnimationPreset(
  presetId: InteractionMotionAnimationPresetId | undefined,
): InteractionMotionAnimationPresetDefinition | null {
  return presetId ? (interactionMotionAnimationPresetMap.get(presetId) ?? null) : null;
}

function formatInteractionMotionIterationCount(
  iterationCount: number | 'infinite' | undefined,
): string {
  if (iterationCount === undefined) {
    return 'infinite';
  }

  return iterationCount === 'infinite' ? iterationCount : String(iterationCount);
}

function normalizeInteractionMotionStepIndex(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.floor(value);
}

function resolveInteractionMotionPhaseDelayMs(
  modifierValues: OverlayInteractionMotionModifierValueMap,
  motionStepIndex: number,
): number {
  const stepValue = typeof modifierValues.step === 'number' && Number.isFinite(modifierValues.step)
    ? Math.max(0, modifierValues.step)
    : 0;
  if (motionStepIndex <= 0 || stepValue <= 0) {
    return 0;
  }

  return Math.round(stepValue * motionStepIndex * 1000);
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
  motionStepIndex?: number;
}): ResolvedInteractionMotionSurfaceStyle {
  const normalizedThemeDefaults = normalizeInteractionMotionThemeRecipe(args.themeDefaults);
  const moduleId = getInteractionMotionModuleIdForSurface(args.surfaceId);
  const moduleOverride = normalizeInteractionMotionModuleOverride(
    args.settings.interactionMotionModuleOverrides[moduleId],
  );
  const profileId = resolveInteractionMotionModuleProfileId({
    moduleId,
    settings: args.settings,
    themeDefaultPresetId: normalizedThemeDefaults?.defaultPresetId,
  });
  const modifierValues = resolveInteractionMotionModifierValues(
    profileId,
    moduleOverride.modifierValuesByPresetId[profileId],
  );
  const profile = applyInteractionMotionModifierValues(
    resolveInteractionMotionProfile(profileId),
    modifierValues,
  );
  const motionStepIndex = normalizeInteractionMotionStepIndex(args.motionStepIndex);
  const triggerState = args.triggerState ?? {};
  const activeTriggers = resolveActiveInteractionTriggers(triggerState);
  const surfaceOverride = mergeInteractionMotionSurfaceOverrides(
    normalizedThemeDefaults?.surfaceOverrides?.[args.surfaceId],
    args.settings.interactionMotionSurfaceOverrides[args.surfaceId],
  );
  const enabled = args.settings.interactionMotionEnabled
    && moduleOverride.enabled !== false
    && args.reducedMotion !== true
    && surfaceOverride.enabled !== false;
  const themeIntensityMultiplier = normalizedThemeDefaults?.intensityMultiplier ?? 1;
  const intensity = enabled
    ? clampInteractionMotionIntensity(
        args.settings.interactionMotionIntensity
        * moduleOverride.intensityMultiplier
        * themeIntensityMultiplier
        * surfaceOverride.intensityMultiplier,
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
    if (!triggerEffect || triggerEffect.animationPresetId) {
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

  const animatedPriorityEffect = enabled && priorityEffect?.animationPresetId
    ? {
      animationPreset: resolveInteractionMotionAnimationPreset(priorityEffect.animationPresetId),
      translateX: (priorityEffect.translateX ?? 0) * intensity,
      translateY: (priorityEffect.translateY ?? 0) * intensity,
      scaleDelta: ((priorityEffect.scale ?? 1) - 1) * intensity,
      rotateDeg: (priorityEffect.rotateDeg ?? 0) * intensity,
      durationMs: Math.max(
        120,
        Math.round(
          priorityEffect.animationDurationMs
            ?? priorityEffect.durationMs
            ?? profile.defaultDurationMs
            ?? DEFAULT_INTERACTION_MOTION_DURATION_MS,
        ),
      ),
      easing: priorityEffect.easing ?? profile.defaultEasing ?? DEFAULT_INTERACTION_MOTION_EASING,
      iterationCount: priorityEffect.animationIterationCount,
      direction: priorityEffect.animationDirection,
    }
    : null;

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
  const composedTransform = composeTransformValue([args.baseTransform, motionTransform]);
  const resolvedAnimationPreset = animatedPriorityEffect?.animationPreset;
  const animation = enabled && resolvedAnimationPreset
    ? [
      `interaction-motion-${resolvedAnimationPreset.id}`,
      `${animatedPriorityEffect.durationMs}ms`,
      animatedPriorityEffect.easing ?? resolvedAnimationPreset.defaultEasing,
      `${resolveInteractionMotionPhaseDelayMs(modifierValues, motionStepIndex) * -1}ms`,
      formatInteractionMotionIterationCount(animatedPriorityEffect.iterationCount),
      animatedPriorityEffect.direction ?? resolvedAnimationPreset.defaultDirection,
      'both',
    ].join(' ')
    : undefined;
  const customProperties: Record<string, string> = animation
    ? {
      '--interaction-motion-base-transform': composedTransform ?? 'translate3d(0px, 0px, 0px)',
      '--interaction-motion-translate-x': `${animatedPriorityEffect?.translateX.toFixed(3) ?? '0'}px`,
      '--interaction-motion-translate-y': `${animatedPriorityEffect?.translateY.toFixed(3) ?? '0'}px`,
      '--interaction-motion-scale-delta': `${animatedPriorityEffect?.scaleDelta.toFixed(4) ?? '0'}`,
      '--interaction-motion-rotate-deg': `${animatedPriorityEffect?.rotateDeg.toFixed(3) ?? '0'}deg`,
    }
    : {};

  return {
    enabled,
    presetId: profile.id,
    intensity,
    transition,
    transform: composedTransform,
    filter: motionFilter,
    animation,
    customProperties,
    willChange: enabled ? 'transform, filter' : undefined,
    dataAttributes: {
      'data-interaction-motion-surface': args.surfaceId,
      'data-interaction-motion-enabled': enabled ? 'true' : 'false',
      'data-interaction-motion-preset': profile.id,
      'data-interaction-motion-module': moduleId,
      ...(motionStepIndex > 0
        ? {
          'data-interaction-motion-step-index': String(motionStepIndex),
        }
        : {}),
    },
  };
}

export function toInteractionMotionStyleObject(
  value: ResolvedInteractionMotionSurfaceStyle,
  baseTransition?: string,
): CSSProperties {
  const style: CSSProperties = {
    ...(value.transform ? { transform: value.transform } : {}),
    ...(value.filter ? { filter: value.filter } : {}),
    ...(value.animation ? { animation: value.animation } : {}),
    ...(mergeTransitionValues(baseTransition, value.transition)
      ? { transition: mergeTransitionValues(baseTransition, value.transition) }
      : {}),
    ...(value.willChange ? { willChange: value.willChange } : {}),
  };

  Object.entries(value.customProperties).forEach(([propertyName, propertyValue]) => {
    (style as Record<string, string>)[propertyName] = propertyValue;
  });

  return style;
}
