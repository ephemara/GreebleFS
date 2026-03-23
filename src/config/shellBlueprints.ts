export type OverlayShellBlueprintId =
  | 'classic-dock'
  | 'xmb-cross-media'
  | 'retro-desktop'
  | 'tile-start'
  | 'handheld-dual-screen';

export type OverlayShellNavigationModel =
  | 'tabs'
  | 'cross-axis'
  | 'desktop'
  | 'tiles'
  | 'stacked-dual-pane';

export type OverlayShellSurfaceStyle =
  | 'glass'
  | 'solid'
  | 'skeuomorphic'
  | 'flat'
  | 'pixel';

export interface OverlayShellBlueprint {
  id: OverlayShellBlueprintId;
  label: string;
  description: string;
  navigationModel: OverlayShellNavigationModel;
  surfaceStyle: OverlayShellSurfaceStyle;
  supportsPinnedPanels: boolean;
  supportsViewportDock: boolean;
  supportsPanelTabs: boolean;
  supportsDualScreen: boolean;
}

export const OVERLAY_SHELL_BLUEPRINTS: OverlayShellBlueprint[] = [
  {
    id: 'classic-dock',
    label: 'Classic Dock',
    description: 'Single-workspace overlay shell with chrome, tabs, and optional docked panels.',
    navigationModel: 'tabs',
    surfaceStyle: 'glass',
    supportsPinnedPanels: true,
    supportsViewportDock: true,
    supportsPanelTabs: true,
    supportsDualScreen: false,
  },
  {
    id: 'xmb-cross-media',
    label: 'XMB',
    description: 'Cross-axis media bar with lateral category navigation and deep vertical stacks.',
    navigationModel: 'cross-axis',
    surfaceStyle: 'glass',
    supportsPinnedPanels: false,
    supportsViewportDock: false,
    supportsPanelTabs: false,
    supportsDualScreen: false,
  },
  {
    id: 'retro-desktop',
    label: 'Retro Desktop',
    description: 'Windowed desktop metaphor for classic Macintosh and Hackintosh-inspired shells.',
    navigationModel: 'desktop',
    surfaceStyle: 'skeuomorphic',
    supportsPinnedPanels: true,
    supportsViewportDock: false,
    supportsPanelTabs: false,
    supportsDualScreen: false,
  },
  {
    id: 'tile-start',
    label: 'Tile Start',
    description: 'Grid-first shell optimized for touch-friendly launchers and dashboard surfaces.',
    navigationModel: 'tiles',
    surfaceStyle: 'flat',
    supportsPinnedPanels: false,
    supportsViewportDock: true,
    supportsPanelTabs: false,
    supportsDualScreen: false,
  },
  {
    id: 'handheld-dual-screen',
    label: 'Handheld Dual Screen',
    description: 'Primary workspace paired with a persistent secondary surface for controls or navigation.',
    navigationModel: 'stacked-dual-pane',
    surfaceStyle: 'pixel',
    supportsPinnedPanels: true,
    supportsViewportDock: false,
    supportsPanelTabs: false,
    supportsDualScreen: true,
  },
];

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
