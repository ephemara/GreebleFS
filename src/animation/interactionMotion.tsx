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
    interactionMotionSurfaceOverrides: state.settings.appearance.interactionMotionSurfaceOverrides,
  })));
  const prefersReducedMotion = usePrefersReducedMotion();
  const themeDefaults = appearance?.baseTheme.interactionMotion;

  const resolveSurfaceStyle = useCallback((args: {
    surfaceId: InteractionMotionSurfaceId;
    triggerState?: InteractionMotionTriggerState;
    baseTransform?: string;
    baseTransition?: string;
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
    });
    const hoverTriggerState = { ...baseTriggerState, hover: true };
    const pressedTriggerState = { ...hoverTriggerState, press: true };
    const hoverSurface = resolveSurfaceStyle({
      surfaceId: args.surfaceId,
      triggerState: hoverTriggerState,
      baseTransform: args.baseTransform,
      baseTransition: args.baseTransition,
    });
    const pressedSurface = resolveSurfaceStyle({
      surfaceId: args.surfaceId,
      triggerState: pressedTriggerState,
      baseTransform: args.baseTransform,
      baseTransition: args.baseTransition,
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
