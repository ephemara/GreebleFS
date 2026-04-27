import type { ThemeRenderStyleKind } from '../generated/tauri';
import type { ResolvedOverlayAppearance } from './appearance';
import type { LayoutProfile } from './layoutProfiles';
import { resolveThemeEngineBindings } from './themeEngineBindings';
import type { OverlayShellBlueprintId } from './shellBlueprints';

export type WorkbenchRenderRuntimeKind =
  | 'workbench-tabs'
  | 'ide-dock-graph'
  | 'cross-axis-media'
  | 'channel-launcher'
  | 'desktop-stack';

export type WorkbenchNavigationSurfaceKind =
  | 'tabs'
  | 'cross-axis'
  | 'launcher-grid'
  | 'launcher-list';

export type WorkbenchContentLayoutKind =
  | 'tabbed'
  | 'dock-graph'
  | 'spotlight'
  | 'desktop-card';

export interface ResolvedWorkbenchRenderRuntime {
  kind: WorkbenchRenderRuntimeKind;
  label: string;
  description: string;
  renderStyleId: string | null;
  renderStyleKind: ThemeRenderStyleKind | null;
  layoutPrimitiveId: string | null;
  navigationPatternId: string | null;
  shellBlueprint: OverlayShellBlueprintId;
  navigationSurface: WorkbenchNavigationSurfaceKind;
  contentLayout: WorkbenchContentLayoutKind;
  launcherPlacement: 'hidden' | 'sidebar';
  navigationRailWidth: number;
  showTabStrip: boolean;
  showExplorerShortcut: boolean;
  showSettingsShortcut: boolean;
  preferLargeLauncherTargets: boolean;
  useGroupedNavigation: boolean;
}

export interface WorkbenchNavigationMetadata {
  groupId: string;
  groupLabel: string;
  groupOrder?: number;
  itemOrder?: number;
}

export interface WorkbenchNavigationPanelDescriptor {
  id: string;
  label: string;
  description: string;
  navigation?: WorkbenchNavigationMetadata;
}

export interface WorkbenchNavigationGroup<TPanel extends WorkbenchNavigationPanelDescriptor = WorkbenchNavigationPanelDescriptor> {
  id: string;
  label: string;
  order: number;
  panels: TPanel[];
}

export function getWorkbenchNavigationRailWidth(runtime: Pick<ResolvedWorkbenchRenderRuntime, 'kind'>): number {
  switch (runtime.kind) {
    case 'ide-dock-graph':
      return 68;
    case 'channel-launcher':
      return 296;
    case 'desktop-stack':
      return 244;
    case 'cross-axis-media':
      return 236;
    default:
      return 0;
  }
}

function compareGroupOrder(
  left: WorkbenchNavigationGroup,
  right: WorkbenchNavigationGroup,
): number {
  if (left.order !== right.order) {
    return left.order - right.order;
  }

  return left.label.localeCompare(right.label);
}

function comparePanelOrder(
  left: WorkbenchNavigationPanelDescriptor,
  right: WorkbenchNavigationPanelDescriptor,
): number {
  const leftOrder = left.navigation?.itemOrder ?? 999;
  const rightOrder = right.navigation?.itemOrder ?? 999;
  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  return left.label.localeCompare(right.label);
}

export function groupPanelsForWorkbenchNavigation<TPanel extends WorkbenchNavigationPanelDescriptor>(
  panels: readonly TPanel[],
): WorkbenchNavigationGroup<TPanel>[] {
  const groupMap = new Map<string, WorkbenchNavigationGroup<TPanel>>();

  panels.forEach(panel => {
    const groupId = panel.navigation?.groupId?.trim() || 'other';
    const groupLabel = panel.navigation?.groupLabel?.trim() || 'Other';
    const groupOrder = panel.navigation?.groupOrder ?? 999;
    const existing = groupMap.get(groupId);
    if (existing) {
      existing.panels.push(panel);
      return;
    }

    groupMap.set(groupId, {
      id: groupId,
      label: groupLabel,
      order: groupOrder,
      panels: [panel],
    });
  });

  return [...groupMap.values()]
    .map(group => ({
      ...group,
      panels: [...group.panels].sort(comparePanelOrder),
    }))
    .sort(compareGroupOrder);
}

function resolveRuntimeKind(
  renderStyleKind: ThemeRenderStyleKind | null,
  shellBlueprint: OverlayShellBlueprintId,
  navigationPatternKind: string | null,
  layoutPrimitiveKind: string | null,
): WorkbenchRenderRuntimeKind {
  switch (renderStyleKind) {
    case 'ps-3-xmb':
      return 'cross-axis-media';
    case 'ios-springboard':
    case 'wii-channels':
      return 'channel-launcher';
    case 'desktop-window-manager':
      return 'desktop-stack';
    default:
      break;
  }

  switch (shellBlueprint) {
    case 'ide-workbench':
      return 'ide-dock-graph';
    case 'xmb-cross-media':
      return 'cross-axis-media';
    case 'tile-start':
      return 'channel-launcher';
    case 'retro-desktop':
      return 'desktop-stack';
    default:
      break;
  }

  if (navigationPatternKind === 'xmb') {
    return 'cross-axis-media';
  }
  if (navigationPatternKind === 'spatial' && layoutPrimitiveKind === 'grid') {
    return 'channel-launcher';
  }
  if (navigationPatternKind === 'hierarchy' && layoutPrimitiveKind === 'freeform') {
    return 'desktop-stack';
  }

  return 'workbench-tabs';
}

function buildResolvedWorkbenchRuntime(
  runtimeKind: WorkbenchRenderRuntimeKind,
  appearance: ResolvedOverlayAppearance,
  layoutProfile: LayoutProfile,
  renderStyleKind: ThemeRenderStyleKind | null,
  engineBindings: ReturnType<typeof resolveThemeEngineBindings>,
): ResolvedWorkbenchRenderRuntime {
  switch (runtimeKind) {
    case 'ide-dock-graph':
      return {
        kind: runtimeKind,
        label: 'IDE Workbench',
        description: 'Navigation rail, dock graph panes, floating utility windows, and a bottom panel region.',
        renderStyleId: engineBindings.renderStyle?.id ?? appearance.workbenchTheme.renderStyleId,
        renderStyleKind,
        layoutPrimitiveId: engineBindings.layoutPrimitive?.id ?? appearance.workbenchTheme.layoutPrimitiveId,
        navigationPatternId: engineBindings.navigationPattern?.id ?? appearance.workbenchTheme.navigationPatternId,
        shellBlueprint: layoutProfile.shellBlueprint,
        navigationSurface: 'launcher-list',
        contentLayout: 'dock-graph',
        launcherPlacement: 'sidebar',
        navigationRailWidth: getWorkbenchNavigationRailWidth({ kind: runtimeKind }),
        showTabStrip: false,
        showExplorerShortcut: false,
        showSettingsShortcut: false,
        preferLargeLauncherTargets: false,
        useGroupedNavigation: true,
      };
    case 'cross-axis-media':
      return {
        kind: runtimeKind,
        label: 'Cross Axis',
        description: 'Group-first navigation with a focused launcher rail.',
        renderStyleId: engineBindings.renderStyle?.id ?? appearance.workbenchTheme.renderStyleId,
        renderStyleKind,
        layoutPrimitiveId: engineBindings.layoutPrimitive?.id ?? appearance.workbenchTheme.layoutPrimitiveId,
        navigationPatternId: engineBindings.navigationPattern?.id ?? appearance.workbenchTheme.navigationPatternId,
        shellBlueprint: layoutProfile.shellBlueprint,
        navigationSurface: 'cross-axis',
        contentLayout: 'spotlight',
        launcherPlacement: 'sidebar',
        navigationRailWidth: getWorkbenchNavigationRailWidth({ kind: runtimeKind }),
        showTabStrip: false,
        showExplorerShortcut: false,
        showSettingsShortcut: false,
        preferLargeLauncherTargets: false,
        useGroupedNavigation: true,
      };
    case 'channel-launcher':
      return {
        kind: runtimeKind,
        label: 'Launcher Grid',
        description: 'Large-target channel navigation with grouped launch tiles.',
        renderStyleId: engineBindings.renderStyle?.id ?? appearance.workbenchTheme.renderStyleId,
        renderStyleKind,
        layoutPrimitiveId: engineBindings.layoutPrimitive?.id ?? appearance.workbenchTheme.layoutPrimitiveId,
        navigationPatternId: engineBindings.navigationPattern?.id ?? appearance.workbenchTheme.navigationPatternId,
        shellBlueprint: layoutProfile.shellBlueprint,
        navigationSurface: 'launcher-grid',
        contentLayout: 'spotlight',
        launcherPlacement: 'sidebar',
        navigationRailWidth: getWorkbenchNavigationRailWidth({ kind: runtimeKind }),
        showTabStrip: false,
        showExplorerShortcut: false,
        showSettingsShortcut: false,
        preferLargeLauncherTargets: true,
        useGroupedNavigation: true,
      };
    case 'desktop-stack':
      return {
        kind: runtimeKind,
        label: 'Desktop Stack',
        description: 'Dock-style launcher with card-like panel presentation.',
        renderStyleId: engineBindings.renderStyle?.id ?? appearance.workbenchTheme.renderStyleId,
        renderStyleKind,
        layoutPrimitiveId: engineBindings.layoutPrimitive?.id ?? appearance.workbenchTheme.layoutPrimitiveId,
        navigationPatternId: engineBindings.navigationPattern?.id ?? appearance.workbenchTheme.navigationPatternId,
        shellBlueprint: layoutProfile.shellBlueprint,
        navigationSurface: 'launcher-list',
        contentLayout: 'desktop-card',
        launcherPlacement: 'sidebar',
        navigationRailWidth: getWorkbenchNavigationRailWidth({ kind: runtimeKind }),
        showTabStrip: false,
        showExplorerShortcut: false,
        showSettingsShortcut: false,
        preferLargeLauncherTargets: false,
        useGroupedNavigation: true,
      };
    default:
      return {
        kind: 'workbench-tabs',
        label: 'Workbench Tabs',
        description: 'Classic tabbed workbench navigation.',
        renderStyleId: engineBindings.renderStyle?.id ?? appearance.workbenchTheme.renderStyleId,
        renderStyleKind,
        layoutPrimitiveId: engineBindings.layoutPrimitive?.id ?? appearance.workbenchTheme.layoutPrimitiveId,
        navigationPatternId: engineBindings.navigationPattern?.id ?? appearance.workbenchTheme.navigationPatternId,
        shellBlueprint: layoutProfile.shellBlueprint,
        navigationSurface: 'tabs',
        contentLayout: 'tabbed',
        launcherPlacement: 'hidden',
        navigationRailWidth: getWorkbenchNavigationRailWidth({ kind: 'workbench-tabs' }),
        showTabStrip: true,
        showExplorerShortcut: true,
        showSettingsShortcut: true,
        preferLargeLauncherTargets: false,
        useGroupedNavigation: false,
      };
  }
}

export function resolveWorkbenchRenderRuntime(
  appearance: ResolvedOverlayAppearance,
  layoutProfile: LayoutProfile,
  forcedRuntimeKind?: WorkbenchRenderRuntimeKind | null,
): ResolvedWorkbenchRenderRuntime {
  const engineBindings = resolveThemeEngineBindings(
    appearance.baseTheme.compiledEngineManifest,
    appearance.baseTheme.workbench,
  );
  const renderStyleKind = engineBindings.renderStyle?.kind ?? null;
  const runtimeKind = forcedRuntimeKind ?? resolveRuntimeKind(
    renderStyleKind,
    layoutProfile.shellBlueprint,
    engineBindings.navigationPattern?.kind ?? null,
    engineBindings.layoutPrimitive?.kind ?? null,
  );

  return buildResolvedWorkbenchRuntime(
    runtimeKind,
    appearance,
    layoutProfile,
    renderStyleKind,
    engineBindings,
  );
}
