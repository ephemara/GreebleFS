import { useCallback, useMemo } from "react";
import type { ResolvedOverlayAppearance } from "../config/appearance";
import {
  getLayoutDynamicsPreset,
  getLayoutDynamicsSurfaceProfile,
  resolveLayoutDynamicsPresetId,
  resolveLayoutDynamicsSurfaceOverride,
  type LayoutDynamicsSolverProfile,
  type LayoutDynamicsSurfaceId,
  type LayoutDynamicsSurfaceProfile,
} from "../config/layoutDynamics";
import { useSettingsStore } from "../store/settingsStore";

export interface ResolvedLayoutDynamicsSurfaceSettings {
  surface: LayoutDynamicsSurfaceProfile;
  preset: LayoutDynamicsSolverProfile;
  enabled: boolean;
  intensity: number;
}

export function useLayoutDynamicsController(
  appearance?: Pick<ResolvedOverlayAppearance, "baseTheme"> | null,
) {
  const {
    layoutDynamicsEnabled,
    layoutDynamicsIntensity,
    layoutDynamicsPresetId,
    layoutDynamicsSurfaceOverrides,
  } = useSettingsStore((state) => ({
    layoutDynamicsEnabled: state.settings.appearance.layoutDynamicsEnabled,
    layoutDynamicsIntensity: state.settings.appearance.layoutDynamicsIntensity,
    layoutDynamicsPresetId: state.settings.appearance.layoutDynamicsPresetId,
    layoutDynamicsSurfaceOverrides:
      state.settings.appearance.layoutDynamicsSurfaceOverrides,
  }));

  const prefersReducedMotion = useMemo(() => {
    if (typeof window === "undefined" || !("matchMedia" in window)) {
      return false;
    }
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const resolveSurfaceSettings = useCallback(
    (surfaceId: LayoutDynamicsSurfaceId): ResolvedLayoutDynamicsSurfaceSettings => {
      const surface = getLayoutDynamicsSurfaceProfile(surfaceId);
      const themeRecipe = appearance?.baseTheme.layoutDynamics;
      const override = resolveLayoutDynamicsSurfaceOverride({
        surfaceId,
        surfaceOverrides: layoutDynamicsSurfaceOverrides,
        themeSurfaceOverrides: themeRecipe?.surfaceOverrides,
      });
      const overrideObject =
        override && typeof override === "object" && !Array.isArray(override)
          ? override
          : null;
      const enabled =
        layoutDynamicsEnabled &&
        override !== false &&
        overrideObject?.enabled !== false;
      const presetId = resolveLayoutDynamicsPresetId({
        requestedPresetId:
          overrideObject?.presetId ?? layoutDynamicsPresetId ?? null,
        themeDefaultPresetId: themeRecipe?.defaultPresetId ?? null,
        surfaceId,
      });
      const intensityMultiplier = overrideObject?.intensityMultiplier ?? 1;
      const reducedMotionScale = prefersReducedMotion ? 0.72 : 1;
      return {
        surface,
        preset: getLayoutDynamicsPreset(presetId),
        enabled,
        intensity:
          layoutDynamicsIntensity * intensityMultiplier * reducedMotionScale,
      };
    },
    [
      appearance?.baseTheme.layoutDynamics,
      layoutDynamicsEnabled,
      layoutDynamicsIntensity,
      layoutDynamicsPresetId,
      layoutDynamicsSurfaceOverrides,
      prefersReducedMotion,
    ],
  );

  return {
    enabled: layoutDynamicsEnabled,
    prefersReducedMotion,
    resolveSurfaceSettings,
  };
}
