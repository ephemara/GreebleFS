import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { ResolvedOverlayAppearance } from '../config/appearance';
import {
  mergeTransitionValues,
  resolveInteractionMotionSurfaceStyle,
  toInteractionMotionStyleObject,
  type InteractionMotionSurfaceId,
  type InteractionMotionTriggerState,
  type ResolvedInteractionMotionSurfaceStyle,
} from '../config/interactionMotion';
import { useSettingsStore } from '../store/settingsStore';

const INTERACTION_MOTION_STYLESHEET_ID = 'greeblefs-interaction-motion-keyframes';
const INTERACTION_MOTION_CUSTOM_PROPERTY_NAMES = [
  '--interaction-motion-base-transform',
  '--interaction-motion-translate-x',
  '--interaction-motion-translate-y',
  '--interaction-motion-scale-delta',
  '--interaction-motion-rotate-deg',
] as const;

const INTERACTION_MOTION_KEYFRAMES_CSS = `
@keyframes interaction-motion-bounce {
  0%, 100% { transform: var(--interaction-motion-base-transform, translate3d(0px, 0px, 0px)); }
  24% { transform: var(--interaction-motion-base-transform, translate3d(0px, 0px, 0px)) translate3d(0px, var(--interaction-motion-translate-y, 0px), 0px) rotate(var(--interaction-motion-rotate-deg, 0deg)) scale(calc(1 + var(--interaction-motion-scale-delta, 0)), calc(1 - (var(--interaction-motion-scale-delta, 0) * 0.42))); }
  58% { transform: var(--interaction-motion-base-transform, translate3d(0px, 0px, 0px)) translate3d(0px, calc(var(--interaction-motion-translate-y, 0px) * -0.34), 0px) rotate(calc(var(--interaction-motion-rotate-deg, 0deg) * -0.4)) scale(calc(1 - (var(--interaction-motion-scale-delta, 0) * 0.18)), calc(1 + (var(--interaction-motion-scale-delta, 0) * 0.06))); }
}
@keyframes interaction-motion-lissajous {
  0% { transform: var(--interaction-motion-base-transform, translate3d(0px, 0px, 0px)); }
  20% { transform: var(--interaction-motion-base-transform, translate3d(0px, 0px, 0px)) translate3d(var(--interaction-motion-translate-x, 0px), calc(var(--interaction-motion-translate-y, 0px) * -0.35), 0px) rotate(calc(var(--interaction-motion-rotate-deg, 0deg) * 0.45)) scale(calc(1 + (var(--interaction-motion-scale-delta, 0) * 0.5))); }
  40% { transform: var(--interaction-motion-base-transform, translate3d(0px, 0px, 0px)) translate3d(calc(var(--interaction-motion-translate-x, 0px) * -0.55), var(--interaction-motion-translate-y, 0px), 0px) rotate(calc(var(--interaction-motion-rotate-deg, 0deg) * -0.8)) scale(calc(1 + var(--interaction-motion-scale-delta, 0))); }
  60% { transform: var(--interaction-motion-base-transform, translate3d(0px, 0px, 0px)) translate3d(calc(var(--interaction-motion-translate-x, 0px) * -1), calc(var(--interaction-motion-translate-y, 0px) * -0.2), 0px) rotate(calc(var(--interaction-motion-rotate-deg, 0deg) * 0.2)) scale(calc(1 + (var(--interaction-motion-scale-delta, 0) * 0.32))); }
  80% { transform: var(--interaction-motion-base-transform, translate3d(0px, 0px, 0px)) translate3d(calc(var(--interaction-motion-translate-x, 0px) * 0.42), calc(var(--interaction-motion-translate-y, 0px) * -1), 0px) rotate(calc(var(--interaction-motion-rotate-deg, 0deg) * 1)) scale(calc(1 + (var(--interaction-motion-scale-delta, 0) * 0.82))); }
  100% { transform: var(--interaction-motion-base-transform, translate3d(0px, 0px, 0px)); }
}
@keyframes interaction-motion-shake {
  0%, 100% { transform: var(--interaction-motion-base-transform, translate3d(0px, 0px, 0px)); }
  10% { transform: var(--interaction-motion-base-transform, translate3d(0px, 0px, 0px)) translate3d(calc(var(--interaction-motion-translate-x, 0px) * -1), 0px, 0px) rotate(calc(var(--interaction-motion-rotate-deg, 0deg) * -1)); }
  20% { transform: var(--interaction-motion-base-transform, translate3d(0px, 0px, 0px)) translate3d(var(--interaction-motion-translate-x, 0px), 0px, 0px) rotate(var(--interaction-motion-rotate-deg, 0deg)); }
  30% { transform: var(--interaction-motion-base-transform, translate3d(0px, 0px, 0px)) translate3d(calc(var(--interaction-motion-translate-x, 0px) * -0.7), 0px, 0px) rotate(calc(var(--interaction-motion-rotate-deg, 0deg) * -0.6)); }
  40% { transform: var(--interaction-motion-base-transform, translate3d(0px, 0px, 0px)) translate3d(calc(var(--interaction-motion-translate-x, 0px) * 0.7), 0px, 0px) rotate(calc(var(--interaction-motion-rotate-deg, 0deg) * 0.5)); }
  60% { transform: var(--interaction-motion-base-transform, translate3d(0px, 0px, 0px)) translate3d(calc(var(--interaction-motion-translate-x, 0px) * -0.38), 0px, 0px) rotate(calc(var(--interaction-motion-rotate-deg, 0deg) * -0.28)); }
  80% { transform: var(--interaction-motion-base-transform, translate3d(0px, 0px, 0px)) translate3d(calc(var(--interaction-motion-translate-x, 0px) * 0.38), 0px, 0px) rotate(calc(var(--interaction-motion-rotate-deg, 0deg) * 0.24)); }
}
@keyframes interaction-motion-float {
  0%, 100% { transform: var(--interaction-motion-base-transform, translate3d(0px, 0px, 0px)) translate3d(0px, calc(var(--interaction-motion-translate-y, 0px) * -0.35), 0px) scale(calc(1 + (var(--interaction-motion-scale-delta, 0) * 0.35))); }
  50% { transform: var(--interaction-motion-base-transform, translate3d(0px, 0px, 0px)) translate3d(0px, var(--interaction-motion-translate-y, 0px), 0px) rotate(calc(var(--interaction-motion-rotate-deg, 0deg) * -0.4)) scale(calc(1 + var(--interaction-motion-scale-delta, 0))); }
}
@keyframes interaction-motion-pulse {
  0%, 100% { transform: var(--interaction-motion-base-transform, translate3d(0px, 0px, 0px)) scale(1); }
  50% { transform: var(--interaction-motion-base-transform, translate3d(0px, 0px, 0px)) scale(calc(1 + var(--interaction-motion-scale-delta, 0))); }
}
@keyframes interaction-motion-elastic {
  0%, 100% { transform: var(--interaction-motion-base-transform, translate3d(0px, 0px, 0px)); }
  18% { transform: var(--interaction-motion-base-transform, translate3d(0px, 0px, 0px)) translate3d(0px, var(--interaction-motion-translate-y, 0px), 0px) scale(calc(1 + var(--interaction-motion-scale-delta, 0)), calc(1 - (var(--interaction-motion-scale-delta, 0) * 0.36))); }
  42% { transform: var(--interaction-motion-base-transform, translate3d(0px, 0px, 0px)) translate3d(0px, calc(var(--interaction-motion-translate-y, 0px) * -0.22), 0px) scale(calc(1 - (var(--interaction-motion-scale-delta, 0) * 0.18)), calc(1 + (var(--interaction-motion-scale-delta, 0) * 0.14))); }
  64% { transform: var(--interaction-motion-base-transform, translate3d(0px, 0px, 0px)) translate3d(0px, calc(var(--interaction-motion-translate-y, 0px) * 0.1), 0px) scale(calc(1 + (var(--interaction-motion-scale-delta, 0) * 0.08))); }
}
@keyframes interaction-motion-wobble {
  0%, 100% { transform: var(--interaction-motion-base-transform, translate3d(0px, 0px, 0px)); }
  20% { transform: var(--interaction-motion-base-transform, translate3d(0px, 0px, 0px)) translate3d(var(--interaction-motion-translate-x, 0px), 0px, 0px) rotate(var(--interaction-motion-rotate-deg, 0deg)) scale(calc(1 + (var(--interaction-motion-scale-delta, 0) * 0.7))); }
  48% { transform: var(--interaction-motion-base-transform, translate3d(0px, 0px, 0px)) translate3d(calc(var(--interaction-motion-translate-x, 0px) * -0.72), 0px, 0px) rotate(calc(var(--interaction-motion-rotate-deg, 0deg) * -0.8)) scale(calc(1 + var(--interaction-motion-scale-delta, 0))); }
  72% { transform: var(--interaction-motion-base-transform, translate3d(0px, 0px, 0px)) translate3d(calc(var(--interaction-motion-translate-x, 0px) * 0.4), 0px, 0px) rotate(calc(var(--interaction-motion-rotate-deg, 0deg) * 0.45)) scale(calc(1 + (var(--interaction-motion-scale-delta, 0) * 0.35))); }
}
@keyframes interaction-motion-sway {
  0%, 100% { transform: var(--interaction-motion-base-transform, translate3d(0px, 0px, 0px)) rotate(calc(var(--interaction-motion-rotate-deg, 0deg) * -0.82)); }
  50% { transform: var(--interaction-motion-base-transform, translate3d(0px, 0px, 0px)) translate3d(var(--interaction-motion-translate-x, 0px), 0px, 0px) rotate(var(--interaction-motion-rotate-deg, 0deg)) scale(calc(1 + (var(--interaction-motion-scale-delta, 0) * 0.55))); }
}
@keyframes interaction-motion-heartbeat {
  0%, 100% { transform: var(--interaction-motion-base-transform, translate3d(0px, 0px, 0px)) scale(1); }
  16% { transform: var(--interaction-motion-base-transform, translate3d(0px, 0px, 0px)) scale(calc(1 + var(--interaction-motion-scale-delta, 0))); }
  28% { transform: var(--interaction-motion-base-transform, translate3d(0px, 0px, 0px)) scale(1); }
  42% { transform: var(--interaction-motion-base-transform, translate3d(0px, 0px, 0px)) scale(calc(1 + (var(--interaction-motion-scale-delta, 0) * 0.72))); }
  56% { transform: var(--interaction-motion-base-transform, translate3d(0px, 0px, 0px)) scale(1); }
}
@keyframes interaction-motion-orbit {
  0% { transform: var(--interaction-motion-base-transform, translate3d(0px, 0px, 0px)) translate3d(var(--interaction-motion-translate-x, 0px), 0px, 0px) rotate(var(--interaction-motion-rotate-deg, 0deg)) scale(calc(1 + (var(--interaction-motion-scale-delta, 0) * 0.55))); }
  25% { transform: var(--interaction-motion-base-transform, translate3d(0px, 0px, 0px)) translate3d(0px, var(--interaction-motion-translate-y, 0px), 0px) rotate(calc(var(--interaction-motion-rotate-deg, 0deg) * 0.5)) scale(calc(1 + var(--interaction-motion-scale-delta, 0))); }
  50% { transform: var(--interaction-motion-base-transform, translate3d(0px, 0px, 0px)) translate3d(calc(var(--interaction-motion-translate-x, 0px) * -1), 0px, 0px) rotate(calc(var(--interaction-motion-rotate-deg, 0deg) * -1)) scale(calc(1 + (var(--interaction-motion-scale-delta, 0) * 0.55))); }
  75% { transform: var(--interaction-motion-base-transform, translate3d(0px, 0px, 0px)) translate3d(0px, calc(var(--interaction-motion-translate-y, 0px) * -1), 0px) rotate(calc(var(--interaction-motion-rotate-deg, 0deg) * -0.5)) scale(calc(1 + var(--interaction-motion-scale-delta, 0))); }
  100% { transform: var(--interaction-motion-base-transform, translate3d(0px, 0px, 0px)) translate3d(var(--interaction-motion-translate-x, 0px), 0px, 0px) rotate(var(--interaction-motion-rotate-deg, 0deg)) scale(calc(1 + (var(--interaction-motion-scale-delta, 0) * 0.55))); }
}
`;

function ensureInteractionMotionStylesheet(): void {
  if (typeof document === 'undefined') {
    return;
  }

  if (document.getElementById(INTERACTION_MOTION_STYLESHEET_ID)) {
    return;
  }

  const styleElement = document.createElement('style');
  styleElement.id = INTERACTION_MOTION_STYLESHEET_ID;
  styleElement.textContent = INTERACTION_MOTION_KEYFRAMES_CSS;
  document.head.appendChild(styleElement);
}

function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => {
      setPrefersReducedMotion(mediaQuery.matches);
    };

    updatePreference();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updatePreference);
      return () => mediaQuery.removeEventListener('change', updatePreference);
    }

    mediaQuery.addListener(updatePreference);
    return () => mediaQuery.removeListener(updatePreference);
  }, []);

  return prefersReducedMotion;
}

function applyMotionStyleToElement(
  target: HTMLElement,
  style: ReturnType<typeof toInteractionMotionStyleObject>,
): void {
  if (style.transform) {
    target.style.transform = style.transform;
  } else {
    target.style.removeProperty('transform');
  }

  if (style.filter) {
    target.style.filter = style.filter;
  } else {
    target.style.removeProperty('filter');
  }

  const animationValue = typeof style.animation === 'string' ? style.animation : undefined;
  if (animationValue) {
    target.style.animation = animationValue;
  } else {
    target.style.removeProperty('animation');
  }

  if (style.transition) {
    target.style.transition = style.transition;
  } else {
    target.style.removeProperty('transition');
  }

  if (style.willChange) {
    target.style.willChange = style.willChange;
  } else {
    target.style.removeProperty('will-change');
  }

  INTERACTION_MOTION_CUSTOM_PROPERTY_NAMES.forEach(propertyName => {
    const propertyValue = (style as Record<string, string | undefined>)[propertyName];
    if (propertyValue) {
      target.style.setProperty(propertyName, propertyValue);
      return;
    }

    target.style.removeProperty(propertyName);
  });
}

export interface InteractionMotionBinding {
  motionStyle: ReturnType<typeof toInteractionMotionStyleObject>;
  motionDataAttributes: Record<string, string>;
  onPointerEnter: React.PointerEventHandler<HTMLElement>;
  onPointerLeave: React.PointerEventHandler<HTMLElement>;
  onPointerDown: React.PointerEventHandler<HTMLElement>;
  onPointerUp: React.PointerEventHandler<HTMLElement>;
  onPointerCancel: React.PointerEventHandler<HTMLElement>;
  resolveStateStyle: (triggerState: InteractionMotionTriggerState) => ReturnType<typeof toInteractionMotionStyleObject>;
}

export function useInteractionMotionController(appearance?: Pick<ResolvedOverlayAppearance, 'baseTheme'> | null) {
  const interactionMotionSettings = useSettingsStore(useShallow((state) => ({
    interactionMotionEnabled: state.settings.appearance.interactionMotionEnabled,
    interactionMotionPresetId: state.settings.appearance.interactionMotionPresetId,
    interactionMotionIntensity: state.settings.appearance.interactionMotionIntensity,
    interactionMotionModuleOverrides: state.settings.appearance.interactionMotionModuleOverrides,
    interactionMotionSurfaceOverrides: state.settings.appearance.interactionMotionSurfaceOverrides,
  })));
  const prefersReducedMotion = usePrefersReducedMotion();
  const themeDefaults = appearance?.baseTheme.interactionMotion;

  useEffect(() => {
    ensureInteractionMotionStylesheet();
  }, []);

  const resolveSurfaceStyle = useCallback((args: {
    surfaceId: InteractionMotionSurfaceId;
    triggerState?: InteractionMotionTriggerState;
    baseTransform?: string;
    baseTransition?: string;
    motionStepIndex?: number;
  }): {
    resolved: ResolvedInteractionMotionSurfaceStyle;
    style: ReturnType<typeof toInteractionMotionStyleObject>;
  } => {
    const resolved = resolveInteractionMotionSurfaceStyle({
      surfaceId: args.surfaceId,
      triggerState: args.triggerState,
      settings: interactionMotionSettings,
      themeDefaults,
      reducedMotion: prefersReducedMotion,
      baseTransform: args.baseTransform,
      motionStepIndex: args.motionStepIndex,
    });

    return {
      resolved,
      style: toInteractionMotionStyleObject(resolved, args.baseTransition),
    };
  }, [
    interactionMotionSettings,
    prefersReducedMotion,
    themeDefaults,
  ]);

  const bindSurface = useCallback((args: {
    surfaceId: InteractionMotionSurfaceId;
    triggerState?: InteractionMotionTriggerState;
    baseTransform?: string;
    baseTransition?: string;
    motionStepIndex?: number;
    onPointerEnter?: React.PointerEventHandler<HTMLElement>;
    onPointerLeave?: React.PointerEventHandler<HTMLElement>;
    onPointerDown?: React.PointerEventHandler<HTMLElement>;
    onPointerUp?: React.PointerEventHandler<HTMLElement>;
    onPointerCancel?: React.PointerEventHandler<HTMLElement>;
  }): InteractionMotionBinding => {
    const baseTriggerState = args.triggerState ?? {};
    const restingSurface = resolveSurfaceStyle({
      surfaceId: args.surfaceId,
      triggerState: baseTriggerState,
      baseTransform: args.baseTransform,
      baseTransition: args.baseTransition,
      motionStepIndex: args.motionStepIndex,
    });
    const hoverTriggerState = { ...baseTriggerState, hover: true };
    const pressedTriggerState = { ...hoverTriggerState, press: true };
    const hoverSurface = resolveSurfaceStyle({
      surfaceId: args.surfaceId,
      triggerState: hoverTriggerState,
      baseTransform: args.baseTransform,
      baseTransition: args.baseTransition,
      motionStepIndex: args.motionStepIndex,
    });
    const pressedSurface = resolveSurfaceStyle({
      surfaceId: args.surfaceId,
      triggerState: pressedTriggerState,
      baseTransform: args.baseTransform,
      baseTransition: args.baseTransition,
      motionStepIndex: args.motionStepIndex,
    });

    return {
      motionStyle: restingSurface.style,
      motionDataAttributes: restingSurface.resolved.dataAttributes,
      onPointerEnter: (event: React.PointerEvent<HTMLElement>) => {
        applyMotionStyleToElement(event.currentTarget, hoverSurface.style);
        args.onPointerEnter?.(event);
      },
      onPointerLeave: (event: React.PointerEvent<HTMLElement>) => {
        applyMotionStyleToElement(event.currentTarget, restingSurface.style);
        args.onPointerLeave?.(event);
      },
      onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
        applyMotionStyleToElement(event.currentTarget, pressedSurface.style);
        args.onPointerDown?.(event);
      },
      onPointerUp: (event: React.PointerEvent<HTMLElement>) => {
        applyMotionStyleToElement(event.currentTarget, hoverSurface.style);
        args.onPointerUp?.(event);
      },
      onPointerCancel: (event: React.PointerEvent<HTMLElement>) => {
        applyMotionStyleToElement(event.currentTarget, restingSurface.style);
        args.onPointerCancel?.(event);
      },
      resolveStateStyle: (triggerState: InteractionMotionTriggerState) => (
        resolveSurfaceStyle({
          surfaceId: args.surfaceId,
          triggerState: { ...baseTriggerState, ...triggerState },
          baseTransform: args.baseTransform,
          baseTransition: args.baseTransition,
          motionStepIndex: args.motionStepIndex,
        }).style
      ),
    };
  }, [resolveSurfaceStyle]);

  return useMemo(() => ({
    prefersReducedMotion,
    resolveSurfaceStyle,
    bindSurface,
    mergeTransitionValues,
  }), [bindSurface, prefersReducedMotion, resolveSurfaceStyle]);
}
