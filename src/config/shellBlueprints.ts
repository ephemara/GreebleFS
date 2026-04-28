import type {
  ShellBlueprint as GeneratedShellBlueprint,
  ShellBlueprintId as GeneratedShellBlueprintId,
  ShellNavigationModel as GeneratedShellNavigationModel,
  ShellSurfaceStyle as GeneratedShellSurfaceStyle,
} from '../generated/tauri';
import { OVERLAY_SHELL_BLUEPRINTS as GENERATED_OVERLAY_SHELL_BLUEPRINTS } from '../generated/tauri';

export type OverlayShellBlueprintId = GeneratedShellBlueprintId;
export type OverlayShellNavigationModel = GeneratedShellNavigationModel;
export type OverlayShellSurfaceStyle = GeneratedShellSurfaceStyle;
export type OverlayShellBlueprint = GeneratedShellBlueprint;

export const OVERLAY_SHELL_BLUEPRINTS: OverlayShellBlueprint[] =
  GENERATED_OVERLAY_SHELL_BLUEPRINTS.map(blueprint => ({ ...blueprint }));

const shellBlueprintMap = new Map(
  OVERLAY_SHELL_BLUEPRINTS.map(blueprint => [blueprint.id, blueprint] as const),
);

export function getShellBlueprint(
  blueprintId: string | null | undefined,
): OverlayShellBlueprint {
  return shellBlueprintMap.get((blueprintId ?? '').trim() as OverlayShellBlueprintId)
    ?? OVERLAY_SHELL_BLUEPRINTS[0];
}

export function normalizeShellBlueprintId(
  value: unknown,
  fallback: OverlayShellBlueprintId = 'classic-dock',
): OverlayShellBlueprintId {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim() as OverlayShellBlueprintId;
  return shellBlueprintMap.has(trimmed) ? trimmed : fallback;
}
