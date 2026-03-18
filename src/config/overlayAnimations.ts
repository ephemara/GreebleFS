import type { CSSProperties } from 'react';

export type OverlayAnimationPresetId =
  | 'none'
  | 'slide'
  | 'spring-lift'
  | 'lift'
  | 'dissolve'
  | 'burn'
  | 'fizzle';

export type OverlayAnimationDirection = 'enter' | 'exit';
export type OverlayAnimationPhase = 'closed' | 'opening' | 'open' | 'closing';
export type OverlayAnimationVerticalOrigin = 'top' | 'bottom';

interface MotionShape {
  translateYPercent: number;
  scale: number;
  rotateDeg: number;
  opacity: number;
  blurPx: number;
  saturate: number;
}

interface OverlayAnimationPreset {
  id: OverlayAnimationPresetId;
  label: string;
  description: string;
  group: 'motion' | 'effect';
  enterFrom: MotionShape;
  exitTo: MotionShape;
  enterEasing: string;
  exitEasing: string;
  effect: 'none' | 'dissolve' | 'burn' | 'fizzle';
}

const OPEN_STATE: MotionShape = {
  translateYPercent: 0,
  scale: 1,
  rotateDeg: 0,
  opacity: 1,
  blurPx: 0,
  saturate: 1,
};

export const OVERLAY_ANIMATION_DURATION_MIN = 140;
export const OVERLAY_ANIMATION_DURATION_MAX = 1200;
export const OVERLAY_ANIMATION_INTENSITY_MIN = 0.55;
export const OVERLAY_ANIMATION_INTENSITY_MAX = 1.8;

export const overlayAnimationPresets: OverlayAnimationPreset[] = [
  {
    id: 'none',
    label: 'Instant',
    description: 'No theatrical motion. The shell snaps cleanly in and out.',
    group: 'motion',
    enterFrom: { translateYPercent: 0, scale: 1, rotateDeg: 0, opacity: 0, blurPx: 0, saturate: 1 },
    exitTo: { translateYPercent: 0, scale: 1, rotateDeg: 0, opacity: 0, blurPx: 0, saturate: 1 },
    enterEasing: 'linear',
    exitEasing: 'linear',
    effect: 'none',
  },
  {
    id: 'slide',
    label: 'Slide',
    description: 'A clean bottom-up dock slide with minimal drama.',
    group: 'motion',
    enterFrom: { translateYPercent: 18, scale: 0.992, rotateDeg: 0, opacity: 0, blurPx: 10, saturate: 0.94 },
    exitTo: { translateYPercent: 24, scale: 0.99, rotateDeg: 0, opacity: 0, blurPx: 10, saturate: 0.95 },
    enterEasing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    exitEasing: 'cubic-bezier(0.4, 0, 1, 1)',
    effect: 'none',
  },
  {
    id: 'spring-lift',
    label: 'Spring Lift',
    description: 'Snappy lift with a little rebound for the default hero feel.',
    group: 'motion',
    enterFrom: { translateYPercent: 22, scale: 0.965, rotateDeg: -0.55, opacity: 0, blurPx: 14, saturate: 0.92 },
    exitTo: { translateYPercent: 16, scale: 0.982, rotateDeg: 0.45, opacity: 0, blurPx: 12, saturate: 0.94 },
    enterEasing: 'cubic-bezier(0.18, 0.9, 0.22, 1.16)',
    exitEasing: 'cubic-bezier(0.5, 0, 0.9, 0.25)',
    effect: 'none',
  },
  {
    id: 'lift',
    label: 'Lift',
    description: 'A calmer rise that feels a little more premium and deliberate.',
    group: 'motion',
    enterFrom: { translateYPercent: 12, scale: 0.978, rotateDeg: -0.15, opacity: 0, blurPx: 8, saturate: 0.96 },
    exitTo: { translateYPercent: 12, scale: 0.988, rotateDeg: 0.18, opacity: 0, blurPx: 8, saturate: 0.96 },
    enterEasing: 'cubic-bezier(0.2, 0.85, 0.24, 1)',
    exitEasing: 'cubic-bezier(0.55, 0.08, 0.68, 0.53)',
    effect: 'none',
  },
  {
    id: 'dissolve',
    label: 'Dissolve',
    description: 'Soft translucency with a gentle evaporating edge.',
    group: 'effect',
    enterFrom: { translateYPercent: 10, scale: 0.992, rotateDeg: 0, opacity: 0, blurPx: 18, saturate: 0.9 },
    exitTo: { translateYPercent: 8, scale: 1.01, rotateDeg: 0, opacity: 0, blurPx: 20, saturate: 0.88 },
    enterEasing: 'cubic-bezier(0.16, 1, 0.3, 1)',
    exitEasing: 'cubic-bezier(0.7, 0, 0.84, 0)',
    effect: 'dissolve',
  },
  {
    id: 'burn',
    label: 'Burn Away',
    description: 'Hot edge glow and ember fade for a dramatic close.',
    group: 'effect',
    enterFrom: { translateYPercent: 8, scale: 0.992, rotateDeg: 0.15, opacity: 0, blurPx: 12, saturate: 0.94 },
    exitTo: { translateYPercent: 6, scale: 1.016, rotateDeg: -0.2, opacity: 0, blurPx: 22, saturate: 0.78 },
    enterEasing: 'cubic-bezier(0.18, 1, 0.3, 1)',
    exitEasing: 'cubic-bezier(0.76, 0.02, 0.92, 0.38)',
    effect: 'burn',
  },
  {
    id: 'fizzle',
    label: 'Fizzle',
    description: 'Noisy breakup with a digital scatter on the way out.',
    group: 'effect',
    enterFrom: { translateYPercent: 10, scale: 0.988, rotateDeg: 0, opacity: 0, blurPx: 14, saturate: 0.92 },
    exitTo: { translateYPercent: 10, scale: 1.012, rotateDeg: 0.1, opacity: 0, blurPx: 18, saturate: 0.82 },
    enterEasing: 'cubic-bezier(0.18, 1, 0.3, 1)',
    exitEasing: 'cubic-bezier(0.7, 0, 0.9, 0.25)',
    effect: 'fizzle',
  },
];

export function getOverlayAnimationPreset(id: OverlayAnimationPresetId): OverlayAnimationPreset {
  return overlayAnimationPresets.find(preset => preset.id === id) ?? overlayAnimationPresets[0];
}

export function clampOverlayAnimationDuration(value: number): number {
  return Math.min(Math.max(value, OVERLAY_ANIMATION_DURATION_MIN), OVERLAY_ANIMATION_DURATION_MAX);
}

export function clampOverlayAnimationIntensity(value: number): number {
  return Math.min(Math.max(value, OVERLAY_ANIMATION_INTENSITY_MIN), OVERLAY_ANIMATION_INTENSITY_MAX);
}

function scaleMotionShape(shape: MotionShape, intensity: number): MotionShape {
  const safeIntensity = clampOverlayAnimationIntensity(intensity);
  return {
    translateYPercent: shape.translateYPercent * safeIntensity,
    scale: 1 + ((shape.scale - 1) * safeIntensity),
    rotateDeg: shape.rotateDeg * safeIntensity,
    opacity: shape.opacity,
    blurPx: shape.blurPx * safeIntensity,
    saturate: 1 + ((shape.saturate - 1) * Math.max(0.4, safeIntensity)),
  };
}

function getVerticalDirectionSign(origin: OverlayAnimationVerticalOrigin | undefined): number {
  return origin === 'top' ? -1 : 1;
}

export function getOverlayAnimationTransition(args: {
  phase: OverlayAnimationPhase;
  direction: OverlayAnimationDirection;
  presetId: OverlayAnimationPresetId;
  durationMs: number;
}): string {
  if (args.phase === 'open' || args.phase === 'closed') {
    return 'none';
  }

  const preset = getOverlayAnimationPreset(args.presetId);
  const duration = clampOverlayAnimationDuration(args.durationMs);
  const easing = args.direction === 'enter' ? preset.enterEasing : preset.exitEasing;
  return [
    `transform ${duration}ms ${easing}`,
    `opacity ${duration}ms ${easing}`,
    `filter ${duration}ms ${easing}`,
  ].join(', ');
}

export function getOverlayAnimationStyle(args: {
  phase: OverlayAnimationPhase;
  direction: OverlayAnimationDirection;
  presetId: OverlayAnimationPresetId;
  baseOpacity: number;
  intensity: number;
  durationMs: number;
  verticalOrigin?: OverlayAnimationVerticalOrigin;
}): CSSProperties {
  const preset = getOverlayAnimationPreset(args.presetId);
  const enterFrom = scaleMotionShape(preset.enterFrom, args.intensity);
  const exitTo = scaleMotionShape(preset.exitTo, args.intensity);
  const verticalDirectionSign = getVerticalDirectionSign(args.verticalOrigin);
  const shape = args.phase === 'closed'
    ? (args.direction === 'enter' ? enterFrom : exitTo)
    : args.phase === 'closing'
      ? exitTo
      : OPEN_STATE;

  return {
    transform: `translate3d(0, ${shape.translateYPercent * verticalDirectionSign}%, 0) scale(${shape.scale}) rotate(${shape.rotateDeg}deg)`,
    opacity: shape.opacity === 0 ? 0 : args.baseOpacity * shape.opacity,
    filter: `blur(${shape.blurPx}px) saturate(${shape.saturate})`,
    transition: getOverlayAnimationTransition(args),
    willChange: 'transform, opacity, filter',
  };
}

export function getOverlayEffectStyle(args: {
  phase: OverlayAnimationPhase;
  direction: OverlayAnimationDirection;
  presetId: OverlayAnimationPresetId;
  durationMs: number;
  intensity: number;
  accentColor: string;
  verticalOrigin?: OverlayAnimationVerticalOrigin;
}): CSSProperties | null {
  const preset = getOverlayAnimationPreset(args.presetId);
  if (preset.effect === 'none') {
    return null;
  }

  const duration = clampOverlayAnimationDuration(args.durationMs);
  const intensity = clampOverlayAnimationIntensity(args.intensity);
  const active = args.direction === 'enter'
    ? args.phase === 'closed'
    : args.phase === 'closing' || args.phase === 'closed';
  const opacity = active ? Math.min(0.92, 0.42 + intensity * 0.18) : 0;
  const lift = 12 * intensity * getVerticalDirectionSign(args.verticalOrigin);

  if (preset.effect === 'dissolve') {
    return {
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      opacity,
      backgroundImage: [
        'radial-gradient(circle at 18% 18%, rgba(255,255,255,0.18), transparent 28%)',
        `linear-gradient(180deg, rgba(255,255,255,0.18), ${args.accentColor}22 55%, rgba(8,10,18,0.84))`,
      ].join(', '),
      mixBlendMode: 'screen',
      filter: `blur(${10 * intensity}px) saturate(${1.1 + intensity * 0.12})`,
      transform: active ? `translate3d(0, ${lift * 0.35}px, 0) scale(1.02)` : 'translate3d(0, 0, 0) scale(1)',
      transition: `opacity ${duration}ms ease, transform ${duration}ms ease, filter ${duration}ms ease`,
    };
  }

  if (preset.effect === 'burn') {
    return {
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      opacity,
      backgroundImage: [
        `radial-gradient(circle at 50% 100%, ${args.accentColor}88 0%, rgba(255,170,64,0.22) 20%, transparent 44%)`,
        'linear-gradient(180deg, transparent 48%, rgba(255,145,64,0.08) 58%, rgba(11,7,4,0.88) 100%)',
        'repeating-linear-gradient(115deg, rgba(255,255,255,0.08) 0 2px, transparent 2px 12px)',
      ].join(', '),
      mixBlendMode: 'screen',
      filter: `blur(${8 + intensity * 5}px) saturate(${1.2 + intensity * 0.18}) hue-rotate(-10deg)`,
      transform: active ? `translate3d(0, ${lift * 0.55}px, 0) scale(1.03)` : 'translate3d(0, 0, 0) scale(1)',
      transition: `opacity ${duration}ms ease, transform ${duration}ms ease, filter ${duration}ms ease`,
    };
  }

  return {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    opacity,
    backgroundImage: [
      `radial-gradient(circle at 20% 20%, ${args.accentColor}55 0%, transparent 22%)`,
      `radial-gradient(circle at 78% 32%, rgba(255,255,255,0.18) 0%, transparent 18%)`,
      'repeating-radial-gradient(circle at 50% 100%, rgba(255,255,255,0.09) 0 3px, transparent 3px 12px)',
      'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(8,12,18,0.85))',
    ].join(', '),
    mixBlendMode: 'screen',
    filter: `blur(${6 + intensity * 4}px) saturate(${1.08 + intensity * 0.14})`,
    transform: active ? `translate3d(0, ${lift * 0.4}px, 0) scale(1.018)` : 'translate3d(0, 0, 0) scale(1)',
    transition: `opacity ${duration}ms ease, transform ${duration}ms ease, filter ${duration}ms ease`,
  };
}
