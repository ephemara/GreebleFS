import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, CopyPlus, MoreHorizontal, Plus, SquareSplitHorizontal, X } from '@/components/AppIcons';
import { useShallow } from 'zustand/react/shallow';
import type { ResolvedOverlayAppearance } from '../../config/appearance';
import {
  moveExplorerChromeControlInResolvedSurfaces,
  resolveExplorerChromeSurfaceLayout,
  type ExplorerChromeControlId,
  type ExplorerChromeControlDefinition,
  type ExplorerChromeResolvedControlPlacement,
  type ExplorerChromeSurfaceId,
  type ExplorerChromeZoneId,
} from '../../config/explorerChromeLayouts';
import type {
  OverlayPluginContextMenuContribution,
  OverlayPluginExplorerActionContribution,
} from '../../config/pluginContributions';
import type { ExplorerLayoutMode } from '../../config/layoutProfiles';
import type { LoadedExplorerHomePack } from '../../config/homePackages';
import {
  resolveEffectiveExplorerModeProfile,
  resolveExplorerModeProfileChromeLayoutId,
} from '../../config/explorerModeProfiles';
import { isExplorerHomePath } from '../../config/explorerVirtualLocations';
import { resolveExplorerThemeRecipe } from '../../config/explorerTheme';
import {
  createEmptyExplorerPaneRecord,
  getExplorerPaneLabel,
  getExplorerWorkspaceLayoutDefinition,
  getExplorerWorkspaceVisiblePaneIds,
  type ExplorerPaneId,
  type ExplorerWorkspaceLayoutMode,
} from '../../config/explorerWorkspaceLayouts';
import {
  PRIMARY_EXPLORER_INSTANCE_ID,
  defaultExplorerSession,
  useExplorerStore,
  type ExplorerTabSnapshot,
} from '../../store/explorerStore';
import { useSettingsStore } from '../../store/settingsStore';
import type { SettingsSectionKey } from '../../config/settingsNavigation';
import { ExplorerChromeSurface } from './ExplorerChromeSurface';
import { FileExplorer } from '../FileExplorer';
import type {
  ExplorerWorkspaceNavigationRequest,
  ExplorerWorkspaceRefreshRequest,
  ExplorerWorkspaceRuntimeSelectionEntry,
  ExplorerWorkspaceRuntimeSnapshot,
  ExplorerWorkspaceSelectionTransferRequest,
  ExplorerWorkspaceSelectionTransferResult,
} from '../FileExplorer';

interface ExplorerWorkspaceProps {
  theme: { accent: string; bg: string; bgPanel: string; text: string; border: string; textMuted: string };
  appearance?: ResolvedOverlayAppearance;
  onOpenInTerminal: (path: string) => void;
  onOpenInFilesystemAquarium?: (path: string) => void;
  onAddBookmark: (name: string, path: string) => void | Promise<void>;
  homePacks?: LoadedExplorerHomePack[];
  onOpenPanel?: (panelId: string) => void;
  onOpenSettingsSection?: (section: SettingsSectionKey) => void;
  pluginActions?: OverlayPluginExplorerActionContribution[];
  pluginContextMenuItems?: OverlayPluginContextMenuContribution[];
  layoutMode?: ExplorerLayoutMode;
  chromeControlSurface?: 'toolbar' | 'topbar';
  repositoryPicker?: {
    active: boolean;
    allowMultiple: boolean;
    requestId: number;
    onConfirm: (paths: string[]) => void;
    onCancel: () => void;
  } | null;
}

function getPathLeaf(path: string): string {
  const trimmed = path.trim();
  if (!trimmed || isExplorerHomePath(trimmed)) {
    return 'Home';
  }
  const parts = trimmed.split(/[\\/]/).filter(Boolean);
  return parts.length > 0 ? (parts[parts.length - 1] ?? trimmed) : trimmed;
}

function getPaneShortLabel(paneId: ExplorerPaneId): string {
  return getExplorerPaneLabel(paneId).replace('Pane ', 'P');
}

function getTabDisplayLabel(tab: ExplorerTabSnapshot, currentPath: string): string {
  if (currentPath.trim()) {
    return getPathLeaf(currentPath);
  }
  return tab.title.trim() || 'Explorer';
}

function resolvePaneAccent(active: boolean): React.CSSProperties {
  return active
    ? {
      borderColor: 'var(--overlay-accent)',
      boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--overlay-accent) 52%, transparent)',
    }
    : {
      borderColor: 'var(--overlay-border)',
      boxShadow: 'none',
    };
}

function getNextVisiblePaneId(
  visiblePaneIds: ExplorerPaneId[],
  paneId: ExplorerPaneId,
): ExplorerPaneId | null {
  const currentIndex = visiblePaneIds.indexOf(paneId);
  if (currentIndex === -1 || visiblePaneIds.length <= 1) {
    return null;
  }
  return visiblePaneIds[(currentIndex + 1) % visiblePaneIds.length] ?? null;
}

function sameSelectionEntry(
  left: ExplorerWorkspaceRuntimeSelectionEntry,
  right: ExplorerWorkspaceRuntimeSelectionEntry,
): boolean {
  return left.path === right.path
    && left.name === right.name
    && left.is_dir === right.is_dir;
}

function sameRuntimeSnapshot(
  left: ExplorerWorkspaceRuntimeSnapshot | null | undefined,
  right: ExplorerWorkspaceRuntimeSnapshot,
): boolean {
  if (!left) {
    return false;
  }
  if (
    left.instanceId !== right.instanceId
    || left.currentPath !== right.currentPath
    || left.currentPathIsCloud !== right.currentPathIsCloud
    || left.selectedEntries.length !== right.selectedEntries.length
  ) {
    return false;
  }
  return left.selectedEntries.every((entry, index) => sameSelectionEntry(entry, right.selectedEntries[index] ?? entry));
}

export function ExplorerWorkspace({
  theme,
  appearance,
  onOpenInTerminal,
  onOpenInFilesystemAquarium = () => undefined,
  onAddBookmark,
  homePacks = [],
  onOpenPanel = () => undefined,
  onOpenSettingsSection = () => undefined,
  pluginActions = [],
  pluginContextMenuItems = [],
  layoutMode = 'full',
  chromeControlSurface = 'toolbar',
  repositoryPicker = null,
}: ExplorerWorkspaceProps) {
  const {
    sessions,
    workspace,
    chromeEditSession,
    closeChromeEditSession,
    createWorkspaceTab,
    closeWorkspaceTab,
    focusWorkspaceTab,
    moveWorkspaceTabToPane,
    registerChromeEditSurface,
    setChromeEditDraggingControl,
    setWorkspaceColumnSplitRatio,
    setWorkspaceLayoutMode,
    setWorkspaceRowSplitRatio,
    setFocusedPane,
    unregisterChromeEditSurface,
    updateChromeEditDraft,
  } = useExplorerStore(useShallow((state) => ({
    sessions: state.sessions,
    workspace: state.workspace,
    chromeEditSession: state.chromeEditSession,
    closeChromeEditSession: state.closeChromeEditSession,
    createWorkspaceTab: state.createWorkspaceTab,
    closeWorkspaceTab: state.closeWorkspaceTab,
    focusWorkspaceTab: state.focusWorkspaceTab,
    moveWorkspaceTabToPane: state.moveWorkspaceTabToPane,
    registerChromeEditSurface: state.registerChromeEditSurface,
    setChromeEditDraggingControl: state.setChromeEditDraggingControl,
    setWorkspaceColumnSplitRatio: state.setWorkspaceColumnSplitRatio,
    setWorkspaceLayoutMode: state.setWorkspaceLayoutMode,
    setWorkspaceRowSplitRatio: state.setWorkspaceRowSplitRatio,
    setFocusedPane: state.setFocusedPane,
    unregisterChromeEditSurface: state.unregisterChromeEditSurface,
    updateChromeEditDraft: state.updateChromeEditDraft,
  })));
  const {
    activeThemeId,
    modeProfileOverridesByThemeId,
    chromeLayoutOverridesByThemeId,
  } = useSettingsStore(useShallow((state) => ({
    activeThemeId: state.settings.appearance.activeThemeId,
    modeProfileOverridesByThemeId: state.settings.explorer.modeProfileOverridesByThemeId,
    chromeLayoutOverridesByThemeId: state.settings.explorer.chromeLayoutOverridesByThemeId,
  })));

  const containerRef = useRef<HTMLDivElement>(null);
  const paneSurfaceRef = useRef<HTMLDivElement>(null);
  const commandSequenceRef = useRef(0);
  const paneActionsMenuRef = useRef<HTMLDivElement>(null);
  const [linkedNavigationEnabled, setLinkedNavigationEnabled] = useState(false);
  const [paneActionsMenuOpen, setPaneActionsMenuOpen] = useState(false);
  const [runtimeSnapshotsByInstanceId, setRuntimeSnapshotsByInstanceId] = useState<Record<string, ExplorerWorkspaceRuntimeSnapshot>>({});
  const [navigationRequestsByInstanceId, setNavigationRequestsByInstanceId] = useState<Record<string, ExplorerWorkspaceNavigationRequest>>({});
  const [selectionTransferRequestsByInstanceId, setSelectionTransferRequestsByInstanceId] = useState<Record<string, ExplorerWorkspaceSelectionTransferRequest>>({});
  const [refreshRequestsByInstanceId, setRefreshRequestsByInstanceId] = useState<Record<string, ExplorerWorkspaceRefreshRequest>>({});

  const explorerTheme = useMemo(
    () => appearance?.explorerTheme ?? resolveExplorerThemeRecipe(appearance),
    [appearance],
  );
  const explorerChromeThemeId = useMemo(() => {
    const resolvedAppearanceThemeId = appearance?.baseTheme.id?.trim();
    if (resolvedAppearanceThemeId) {
      return resolvedAppearanceThemeId;
    }

    const trimmedActiveThemeId = activeThemeId.trim();
    return trimmedActiveThemeId || 'operator';
  }, [appearance?.baseTheme.id, activeThemeId]);

  const tabs = workspace.tabs;
  const workspaceLayout = useMemo(
    () => getExplorerWorkspaceLayoutDefinition(workspace.layoutMode),
    [workspace.layoutMode],
  );
  const visiblePaneIds = useMemo(
    () => getExplorerWorkspaceVisiblePaneIds(workspace.layoutMode),
    [workspace.layoutMode],
  );
  const tabsByPane = useMemo(() => {
    const record = createEmptyExplorerPaneRecord<ExplorerTabSnapshot[]>(() => []);
    for (const tab of tabs) {
      record[tab.pane].push(tab);
    }
    return record;
  }, [tabs]);
  const activeTabByPane = useMemo(() => {
    const record = createEmptyExplorerPaneRecord<ExplorerTabSnapshot | null>(() => null);
    for (const paneId of visiblePaneIds) {
      const paneTabs = tabsByPane[paneId];
      record[paneId] = paneTabs.find((tab) => tab.id === workspace.activeTabIdByPane[paneId]) ?? paneTabs[0] ?? null;
    }
    return record;
  }, [tabsByPane, visiblePaneIds, workspace.activeTabIdByPane]);
  const activePane = useMemo(
    () => (
      visiblePaneIds.includes(workspace.focusedPane)
        ? workspace.focusedPane
        : visiblePaneIds[0] ?? 'pane-1'
    ),
    [visiblePaneIds, workspace.focusedPane],
  );
  const activeTab = activeTabByPane[activePane]
    ?? visiblePaneIds.map((paneId) => activeTabByPane[paneId]).find((tab): tab is ExplorerTabSnapshot => Boolean(tab))
    ?? null;
  const focusedPaneTabs = tabsByPane[activePane];
  const workspacePaneCount = visiblePaneIds.length as 1 | 2 | 4;
  const commanderTargetPaneId = useMemo(
    () => visiblePaneIds.length === 2 ? getNextVisiblePaneId(visiblePaneIds, activePane) : null,
    [activePane, visiblePaneIds],
  );
  const commanderTargetTab = commanderTargetPaneId ? activeTabByPane[commanderTargetPaneId] : null;
  const activeRuntime = activeTab ? runtimeSnapshotsByInstanceId[activeTab.instanceId] ?? null : null;
  const commanderTargetRuntime = commanderTargetTab ? runtimeSnapshotsByInstanceId[commanderTargetTab.instanceId] ?? null : null;
  const activePanePath = activeRuntime?.currentPath
    ?? (activeTab ? sessions[activeTab.instanceId]?.currentPath ?? '' : '');
  const commanderTargetPath = commanderTargetRuntime?.currentPath
    ?? (commanderTargetTab ? sessions[commanderTargetTab.instanceId]?.currentPath ?? '' : '');
  const commanderSelectionCount = activeRuntime?.selectedEntries.length ?? 0;
  const canUseCommanderActions = Boolean(
    activeTab
    && commanderTargetPaneId
    && commanderTargetTab
    && activePanePath.trim()
    && commanderTargetPath.trim(),
  );
  const commanderSummaryText = useMemo(() => {
    if (!canUseCommanderActions || !commanderTargetPaneId) {
      return null;
    }
    const targetLeaf = getPathLeaf(commanderTargetPath);
    if (commanderSelectionCount > 0) {
      return `${commanderSelectionCount} selected -> ${getPaneShortLabel(commanderTargetPaneId)} · ${targetLeaf}`;
    }
    return `${getPaneShortLabel(commanderTargetPaneId)} · ${targetLeaf}`;
  }, [
    canUseCommanderActions,
    commanderSelectionCount,
    commanderTargetPaneId,
    commanderTargetPath,
  ]);
  const legacyShellLayoutId = sessions[activeTab?.instanceId ?? PRIMARY_EXPLORER_INSTANCE_ID]?.shellLayoutId
    ?? defaultExplorerSession.shellLayoutId;
  const effectiveModeProfile = useMemo(
    () => resolveEffectiveExplorerModeProfile({
      themeOverrideModeProfileId: modeProfileOverridesByThemeId[explorerChromeThemeId] ?? null,
      themeDefaultModeProfileId: explorerTheme.defaultModeProfileId,
      legacyShellLayoutId,
    }),
    [
      explorerChromeThemeId,
      explorerTheme.defaultModeProfileId,
      legacyShellLayoutId,
      modeProfileOverridesByThemeId,
    ],
  );
  const explorerChromeLayoutId = useMemo(
    () => resolveExplorerModeProfileChromeLayoutId({
      modeProfile: effectiveModeProfile,
      themeChromeLayoutId: explorerTheme.chromeLayoutId,
    }),
    [effectiveModeProfile, explorerTheme.chromeLayoutId],
  );
  const persistedExplorerChromeOverride = useMemo(
    () => chromeLayoutOverridesByThemeId[explorerChromeThemeId]?.[explorerChromeLayoutId] ?? null,
    [chromeLayoutOverridesByThemeId, explorerChromeLayoutId, explorerChromeThemeId],
  );
  const explorerChromeOverride = useMemo(
    () => (
      chromeEditSession
      && chromeEditSession.themeId === explorerChromeThemeId
      && chromeEditSession.layoutId === explorerChromeLayoutId
        ? chromeEditSession.draftOverride
        : persistedExplorerChromeOverride
    ),
    [chromeEditSession, explorerChromeLayoutId, explorerChromeThemeId, persistedExplorerChromeOverride],
  );

  const nextCommandSequence = useCallback(() => {
    commandSequenceRef.current += 1;
    return commandSequenceRef.current;
  }, []);
  const getPreferredSourceInstanceId = useCallback(() => {
    if (activeTab) {
      return activeTab.instanceId;
    }
    const visibleInstanceId = visiblePaneIds
      .map((paneId) => activeTabByPane[paneId]?.instanceId)
      .find((instanceId): instanceId is string => Boolean(instanceId));
    return visibleInstanceId ?? PRIMARY_EXPLORER_INSTANCE_ID;
  }, [activeTab, activeTabByPane, visiblePaneIds]);
  const publishRuntimeSnapshot = useCallback((snapshot: ExplorerWorkspaceRuntimeSnapshot) => {
    setRuntimeSnapshotsByInstanceId((current) => {
      const previous = current[snapshot.instanceId];
      if (sameRuntimeSnapshot(previous, snapshot)) {
        return current;
      }
      return {
        ...current,
        [snapshot.instanceId]: snapshot,
      };
    });
  }, []);
  const issueNavigationRequest = useCallback((
    instanceId: string,
    path: string,
    pushHistory = true,
  ) => {
    const trimmedPath = path.trim();
    if (!instanceId.trim() || !trimmedPath) {
      return;
    }
    setNavigationRequestsByInstanceId((current) => ({
      ...current,
      [instanceId]: {
        sequence: nextCommandSequence(),
        path: trimmedPath,
        pushHistory,
      },
    }));
  }, [nextCommandSequence]);
  const issueSelectionTransferRequest = useCallback((
    instanceId: string,
    targetDir: string,
    operation: ExplorerWorkspaceSelectionTransferRequest['operation'],
  ) => {
    const trimmedTargetDir = targetDir.trim();
    if (!instanceId.trim() || !trimmedTargetDir) {
      return;
    }
    setSelectionTransferRequestsByInstanceId((current) => ({
      ...current,
      [instanceId]: {
        sequence: nextCommandSequence(),
        targetDir: trimmedTargetDir,
        operation,
      },
    }));
  }, [nextCommandSequence]);
  const issueRefreshRequest = useCallback((instanceId: string) => {
    if (!instanceId.trim()) {
      return;
    }
    setRefreshRequestsByInstanceId((current) => ({
      ...current,
      [instanceId]: {
        sequence: nextCommandSequence(),
      },
    }));
  }, [nextCommandSequence]);
  const ensureWorkspaceLayout = useCallback((nextLayoutMode: ExplorerWorkspaceLayoutMode) => {
    const nextVisiblePaneIds = getExplorerWorkspaceVisiblePaneIds(nextLayoutMode);
    const sourceInstanceId = getPreferredSourceInstanceId();
    setWorkspaceLayoutMode(nextLayoutMode);
    setFocusedPane(nextVisiblePaneIds.includes(activePane) ? activePane : nextVisiblePaneIds[0] ?? 'pane-1');
    const nextWorkspaceTabs = useExplorerStore.getState().workspace.tabs;
    const nextTabsByPane = createEmptyExplorerPaneRecord<ExplorerTabSnapshot[]>(() => []);
    for (const tab of nextWorkspaceTabs) {
      nextTabsByPane[tab.pane].push(tab);
    }
    for (const paneId of nextVisiblePaneIds) {
      if (nextTabsByPane[paneId].length === 0) {
        createWorkspaceTab({
          sourceInstanceId,
          pane: paneId,
          activate: false,
        });
      }
    }
  }, [
    activePane,
    createWorkspaceTab,
    getPreferredSourceInstanceId,
    setFocusedPane,
    setWorkspaceLayoutMode,
  ]);
  const duplicateActiveTab = useCallback(() => {
    if (!activeTab) {
      return;
    }
    createWorkspaceTab({
      sourceInstanceId: activeTab.instanceId,
      pane: activePane,
    });
  }, [activePane, activeTab, createWorkspaceTab]);
  const createTabInFocusedPane = useCallback(() => {
    createWorkspaceTab({
      sourceInstanceId: getPreferredSourceInstanceId(),
      pane: activePane,
    });
  }, [activePane, createWorkspaceTab, getPreferredSourceInstanceId]);
  const closeActiveTab = useCallback(() => {
    if (!activeTab) {
      return;
    }
    closeWorkspaceTab(activeTab.id);
  }, [activeTab, closeWorkspaceTab]);
  const moveActiveTabToNextPane = useCallback(() => {
    if (!activeTab) {
      return;
    }
    const targetPaneId = getNextVisiblePaneId(visiblePaneIds, activePane);
    if (!targetPaneId) {
      return;
    }
    moveWorkspaceTabToPane(activeTab.id, targetPaneId);
  }, [activePane, activeTab, moveWorkspaceTabToPane, visiblePaneIds]);
  const focusNextPane = useCallback(() => {
    const nextPaneId = getNextVisiblePaneId(visiblePaneIds, activePane);
    if (!nextPaneId) {
      return;
    }
    setFocusedPane(nextPaneId);
  }, [activePane, setFocusedPane, visiblePaneIds]);
  const syncCommanderTargetToActivePane = useCallback(() => {
    if (!commanderTargetTab || !activePanePath.trim()) {
      return;
    }
    if (activePanePath === commanderTargetPath) {
      return;
    }
    issueNavigationRequest(commanderTargetTab.instanceId, activePanePath, true);
  }, [activePanePath, commanderTargetPath, commanderTargetTab, issueNavigationRequest]);
  const copySelectionToCommanderTarget = useCallback(() => {
    if (!activeTab || !commanderTargetPath.trim()) {
      return;
    }
    issueSelectionTransferRequest(activeTab.instanceId, commanderTargetPath, 'copy');
  }, [activeTab, commanderTargetPath, issueSelectionTransferRequest]);
  const moveSelectionToCommanderTarget = useCallback(() => {
    if (!activeTab || !commanderTargetPath.trim()) {
      return;
    }
    issueSelectionTransferRequest(activeTab.instanceId, commanderTargetPath, 'move');
  }, [activeTab, commanderTargetPath, issueSelectionTransferRequest]);
  const handleWorkspaceSelectionTransferComplete = useCallback((
    result: ExplorerWorkspaceSelectionTransferResult,
  ) => {
    if (!result.success) {
      return;
    }
    const targetInstanceIds = new Set(
      tabs
        .map((tab) => tab.instanceId)
        .filter((instanceId) => {
          const runtimePath = runtimeSnapshotsByInstanceId[instanceId]?.currentPath;
          const sessionPath = sessions[instanceId]?.currentPath ?? '';
          return (runtimePath ?? sessionPath) === result.targetDir;
        }),
    );
    for (const instanceId of targetInstanceIds) {
      issueRefreshRequest(instanceId);
    }
  }, [issueRefreshRequest, runtimeSnapshotsByInstanceId, sessions, tabs]);

  useEffect(() => {
    const liveInstanceIds = new Set(tabs.map((tab) => tab.instanceId));
    setRuntimeSnapshotsByInstanceId((current) => {
      const nextEntries = Object.entries(current).filter(([instanceId]) => liveInstanceIds.has(instanceId));
      if (nextEntries.length === Object.keys(current).length) {
        return current;
      }
      return Object.fromEntries(nextEntries);
    });
    setNavigationRequestsByInstanceId((current) => {
      const nextEntries = Object.entries(current).filter(([instanceId]) => liveInstanceIds.has(instanceId));
      if (nextEntries.length === Object.keys(current).length) {
        return current;
      }
      return Object.fromEntries(nextEntries);
    });
    setSelectionTransferRequestsByInstanceId((current) => {
      const nextEntries = Object.entries(current).filter(([instanceId]) => liveInstanceIds.has(instanceId));
      if (nextEntries.length === Object.keys(current).length) {
        return current;
      }
      return Object.fromEntries(nextEntries);
    });
    setRefreshRequestsByInstanceId((current) => {
      const nextEntries = Object.entries(current).filter(([instanceId]) => liveInstanceIds.has(instanceId));
      if (nextEntries.length === Object.keys(current).length) {
        return current;
      }
      return Object.fromEntries(nextEntries);
    });
  }, [tabs]);

  useEffect(() => {
    if (!linkedNavigationEnabled || visiblePaneIds.length !== 2 || !commanderTargetTab) {
      return;
    }
    if (!activePanePath.trim() || !commanderTargetPath.trim()) {
      return;
    }
    if (activePanePath === commanderTargetPath) {
      return;
    }
    issueNavigationRequest(commanderTargetTab.instanceId, activePanePath, true);
  }, [
    activePanePath,
    commanderTargetPath,
    commanderTargetTab,
    issueNavigationRequest,
    linkedNavigationEnabled,
    visiblePaneIds.length,
  ]);
  useEffect(() => {
    if (!paneActionsMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (paneActionsMenuRef.current?.contains(event.target as Node)) {
        return;
      }
      setPaneActionsMenuOpen(false);
    };

    window.addEventListener('mousedown', handlePointerDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
    };
  }, [paneActionsMenuOpen]);
  useEffect(() => {
    setPaneActionsMenuOpen(false);
  }, [activePane, workspace.layoutMode]);

  const handleWorkspaceChromeControlMove = useCallback((args: {
    controlId: ExplorerChromeControlId;
    targetSurfaceId: ExplorerChromeSurfaceId;
    targetZoneId: ExplorerChromeZoneId;
    targetIndex: number;
  }) => {
    if (!chromeEditSession) {
      return;
    }

    const registeredSurfaces = Object.values(chromeEditSession.registeredSurfaces)
      .filter((surface): surface is NonNullable<typeof surface> => surface != null);
    updateChromeEditDraft(moveExplorerChromeControlInResolvedSurfaces({
      surfaces: registeredSurfaces,
      controlId: args.controlId,
      targetSurfaceId: args.targetSurfaceId,
      targetZoneId: args.targetZoneId,
      targetIndex: args.targetIndex,
    }));
  }, [chromeEditSession, updateChromeEditDraft]);
  const workspaceChromeEditMode = useMemo(
    () => (
      chromeEditSession
      && chromeEditSession.themeId === explorerChromeThemeId
      && chromeEditSession.layoutId === explorerChromeLayoutId
        ? {
          active: true,
          draggingControlId: chromeEditSession.draggingControlId,
          onRegisterSurface: registerChromeEditSurface,
          onUnregisterSurface: unregisterChromeEditSurface,
          onDragStart: setChromeEditDraggingControl,
          onDragEnd: () => setChromeEditDraggingControl(null),
          onMoveControl: handleWorkspaceChromeControlMove,
        }
        : undefined
    ),
    [
      chromeEditSession,
      explorerChromeLayoutId,
      explorerChromeThemeId,
      handleWorkspaceChromeControlMove,
      registerChromeEditSurface,
      setChromeEditDraggingControl,
      unregisterChromeEditSurface,
    ],
  );
  useEffect(() => {
    if (
      chromeEditSession
      && (
        chromeEditSession.themeId !== explorerChromeThemeId
        || chromeEditSession.layoutId !== explorerChromeLayoutId
      )
    ) {
      closeChromeEditSession();
    }
  }, [chromeEditSession, closeChromeEditSession, explorerChromeLayoutId, explorerChromeThemeId]);

  const columnSplitPercent = Math.round(workspace.columnSplitRatio * 100);
  const rowSplitPercent = Math.round(workspace.rowSplitRatio * 100);
  const workspaceHeaderRowStyle = useMemo<React.CSSProperties>(() => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    minWidth: 0,
    flexWrap: 'wrap',
  }), []);
  const getWorkspaceHeaderZoneStyle = useCallback((zoneId: ExplorerChromeZoneId): React.CSSProperties => {
    switch (zoneId) {
      case 'center':
        return {
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flex: 1,
          minWidth: 0,
          overflowX: 'auto',
        };
      case 'end':
        return {
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexShrink: 0,
          flexWrap: 'wrap',
          justifyContent: 'flex-end',
          minWidth: 0,
        };
      case 'start':
      default:
        return {
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          minWidth: 0,
          flexWrap: 'wrap',
        };
    }
  }, []);
  const commanderButtonsDisabled = !canUseCommanderActions || commanderSelectionCount === 0;
  const workspaceChromeControlRegistry = useMemo<Array<ExplorerChromeControlDefinition & {
    isVisible: (surfaceId: ExplorerChromeSurfaceId) => boolean;
    render: (placement: ExplorerChromeResolvedControlPlacement) => React.ReactNode;
  }>>(() => [
    {
      id: 'workspacePaneCounts',
      label: 'Pane Switcher',
      surfaces: ['workspaceHeader'],
      isVisible: () => visiblePaneIds.length > 1,
      render: () => (
        <div aria-label="Workspace panes" role="group" style={paneSwitcherGroupStyle}>
          {visiblePaneIds.map((paneId) => (
            <button
              key={paneId}
              type="button"
              onClick={() => setFocusedPane(paneId)}
              title={`Focus ${getExplorerPaneLabel(paneId)}`}
              style={paneSwitcherButtonStyle(activePane === paneId, theme.accent)}
            >
              <span>{getPaneShortLabel(paneId)}</span>
              {tabsByPane[paneId].length > 1 && (
                <span style={paneSwitcherCountStyle(activePane === paneId, theme.accent)}>
                  {tabsByPane[paneId].length}
                </span>
              )}
            </button>
          ))}
        </div>
      ),
    },
    {
      id: 'workspaceTabs',
      label: 'Workspace Tabs',
      surfaces: ['workspaceHeader'],
      isVisible: () => focusedPaneTabs.length > 0,
      render: () => (
        <>
          {focusedPaneTabs.map((tab) => {
            const currentPath = runtimeSnapshotsByInstanceId[tab.instanceId]?.currentPath
              ?? sessions[tab.instanceId]?.currentPath
              ?? '';
            const isActive = activeTab?.id === tab.id;
            const moveTargetPaneId = getNextVisiblePaneId(visiblePaneIds, activePane);
            return (
              <div
                key={tab.id}
                style={workspaceTabChipStyle(isActive, theme.accent)}
              >
                <button
                  type="button"
                  onClick={() => focusWorkspaceTab(tab.id)}
                  title={currentPath || tab.title || 'Explorer'}
                  style={workspaceTabButtonStyle(isActive)}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 999,
                      background: isActive ? theme.accent : 'rgba(255,255,255,0.35)',
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11.5, fontWeight: 600 }}>
                    {getTabDisplayLabel(tab, currentPath)}
                  </span>
                </button>
                {moveTargetPaneId && (
                  <button
                    type="button"
                    onClick={() => moveWorkspaceTabToPane(tab.id, moveTargetPaneId)}
                    title={`Move tab to ${getExplorerPaneLabel(moveTargetPaneId)}`}
                    style={workspaceTabIconButtonStyle}
                  >
                    <SquareSplitHorizontal size={11} />
                  </button>
                )}
                {tabs.length > 1 && (
                  <button
                    type="button"
                    onClick={() => closeWorkspaceTab(tab.id)}
                    title="Close tab"
                    style={workspaceTabIconButtonStyle}
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            );
          })}
        </>
      ),
    },
    {
      id: 'workspaceNewTab',
      label: 'New Tab',
      surfaces: ['workspaceHeader'],
      isVisible: () => true,
      render: () => (
        <button type="button" onClick={createTabInFocusedPane} title={`New tab in ${getExplorerPaneLabel(activePane)}`} style={toolbarButtonStyle}>
          <Plus size={13} />
        </button>
      ),
    },
    {
      id: 'workspacePaneActionsMenu',
      label: 'Pane Actions Menu',
      surfaces: ['workspaceHeader'],
      isVisible: () => true,
      render: () => (
        <div ref={paneActionsMenuRef} style={{ position: 'relative' }}>
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={paneActionsMenuOpen}
            aria-label="Workspace pane actions"
            onClick={() => setPaneActionsMenuOpen((current) => !current)}
            title="Workspace pane actions"
            style={toolbarButtonStyle}
          >
            <MoreHorizontal size={13} />
          </button>
          {paneActionsMenuOpen && (
            <div role="menu" aria-label="Workspace pane actions" style={workspaceOverflowMenuStyle}>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  duplicateActiveTab();
                  setPaneActionsMenuOpen(false);
                }}
                disabled={!activeTab}
                style={workspaceOverflowMenuItemStyle(false, !activeTab)}
              >
                <CopyPlus size={12} />
                Duplicate Active Tab
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  closeActiveTab();
                  setPaneActionsMenuOpen(false);
                }}
                disabled={!activeTab || tabs.length <= 1}
                style={workspaceOverflowMenuItemStyle(false, !activeTab || tabs.length <= 1)}
              >
                <X size={12} />
                Close Active Tab
              </button>
              {visiblePaneIds.length > 1 && (
                <>
                  <div style={workspaceOverflowDividerStyle} />
                  <div style={workspaceOverflowLabelStyle}>Pane</div>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      moveActiveTabToNextPane();
                      setPaneActionsMenuOpen(false);
                    }}
                    disabled={!activeTab}
                    style={workspaceOverflowMenuItemStyle(false, !activeTab)}
                  >
                    <SquareSplitHorizontal size={12} />
                    Move Tab To Next Pane
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      focusNextPane();
                      setPaneActionsMenuOpen(false);
                    }}
                    style={workspaceOverflowMenuItemStyle(false, false)}
                  >
                    <span style={workspaceOverflowLeadingGlyphStyle}>→</span>
                    Focus Next Pane
                  </button>
                </>
              )}
              {commanderTargetPaneId && (
                <>
                  <div style={workspaceOverflowDividerStyle} />
                  <div style={workspaceOverflowLabelStyle}>Commander</div>
                  {commanderSummaryText && (
                    <div style={workspaceOverflowSummaryStyle(theme.accent)}>
                      {commanderSummaryText}
                    </div>
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      syncCommanderTargetToActivePane();
                      setPaneActionsMenuOpen(false);
                    }}
                    disabled={!canUseCommanderActions}
                    style={workspaceOverflowMenuItemStyle(false, !canUseCommanderActions)}
                  >
                    <span style={workspaceOverflowLeadingGlyphStyle}>↺</span>
                    Sync Target Pane
                  </button>
                  <button
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={linkedNavigationEnabled}
                    onClick={() => {
                      setLinkedNavigationEnabled((current) => !current);
                      setPaneActionsMenuOpen(false);
                    }}
                    style={workspaceOverflowMenuItemStyle(linkedNavigationEnabled, false)}
                  >
                    <span style={workspaceOverflowLeadingGlyphStyle}>{linkedNavigationEnabled ? '●' : '○'}</span>
                    Linked Navigation
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      copySelectionToCommanderTarget();
                      setPaneActionsMenuOpen(false);
                    }}
                    disabled={commanderButtonsDisabled}
                    style={workspaceOverflowMenuItemStyle(false, commanderButtonsDisabled)}
                  >
                    <span style={workspaceOverflowLeadingGlyphStyle}>⎘</span>
                    Copy Selection To Pane
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      moveSelectionToCommanderTarget();
                      setPaneActionsMenuOpen(false);
                    }}
                    disabled={commanderButtonsDisabled}
                    style={workspaceOverflowMenuItemStyle(false, commanderButtonsDisabled)}
                  >
                    <span style={workspaceOverflowLeadingGlyphStyle}>⇄</span>
                    Move Selection To Pane
                  </button>
                </>
              )}
              {(workspaceLayout.supportsColumnSplit || workspaceLayout.supportsRowSplit) && (
                <>
                  <div style={workspaceOverflowDividerStyle} />
                  <div style={workspaceOverflowLabelStyle}>Split</div>
                  <div style={workspaceOverflowMetaStyle}>
                    {workspaceLayout.supportsColumnSplit ? `Cols ${columnSplitPercent}%` : 'Cols off'}
                    {workspaceLayout.supportsRowSplit ? ` · Rows ${rowSplitPercent}%` : ''}
                  </div>
                  {workspaceLayout.supportsColumnSplit && (
                    <>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setWorkspaceColumnSplitRatio(workspace.columnSplitRatio - 0.05);
                          setPaneActionsMenuOpen(false);
                        }}
                        style={workspaceOverflowMenuItemStyle(false, false)}
                      >
                        <ChevronLeft size={12} />
                        Narrow First Column
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setWorkspaceColumnSplitRatio(0.5);
                          setPaneActionsMenuOpen(false);
                        }}
                        style={workspaceOverflowMenuItemStyle(false, false)}
                      >
                        <SquareSplitHorizontal size={12} />
                        Reset Column Split
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setWorkspaceColumnSplitRatio(workspace.columnSplitRatio + 0.05);
                          setPaneActionsMenuOpen(false);
                        }}
                        style={workspaceOverflowMenuItemStyle(false, false)}
                      >
                        <ChevronRight size={12} />
                        Widen First Column
                      </button>
                    </>
                  )}
                  {workspaceLayout.supportsRowSplit && (
                    <>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setWorkspaceRowSplitRatio(workspace.rowSplitRatio - 0.05);
                          setPaneActionsMenuOpen(false);
                        }}
                        style={workspaceOverflowMenuItemStyle(false, false)}
                      >
                        <span style={workspaceOverflowLeadingGlyphStyle}>↑</span>
                        Reduce Top Row
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setWorkspaceRowSplitRatio(0.5);
                          setPaneActionsMenuOpen(false);
                        }}
                        style={workspaceOverflowMenuItemStyle(false, false)}
                      >
                        <span style={workspaceOverflowLeadingGlyphStyle}>↕</span>
                        Reset Row Split
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setWorkspaceRowSplitRatio(workspace.rowSplitRatio + 0.05);
                          setPaneActionsMenuOpen(false);
                        }}
                        style={workspaceOverflowMenuItemStyle(false, false)}
                      >
                        <span style={workspaceOverflowLeadingGlyphStyle}>↓</span>
                        Expand Top Row
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'workspaceSplitToggle',
      label: 'Workspace Layout',
      surfaces: ['workspaceHeader'],
      isVisible: () => true,
      render: () => (
        <div
          aria-label="Workspace layout"
          role="group"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: 3,
            borderRadius: 999,
            border: '1px solid var(--overlay-border)',
            background: 'color-mix(in srgb, var(--overlay-explorer-chip-bg) 86%, black 14%)',
          }}
        >
          {(['single', 'split', 'quad'] as const).map((layoutId) => {
            const layoutDefinition = getExplorerWorkspaceLayoutDefinition(layoutId);
            const isActiveLayout = workspace.layoutMode === layoutId;
            return (
              <button
                key={layoutId}
                type="button"
                aria-pressed={isActiveLayout}
                onClick={() => ensureWorkspaceLayout(layoutId)}
                title={
                  isActiveLayout
                    ? `${layoutDefinition.shortLabel} active`
                    : `Switch workspace to ${layoutDefinition.label}`
                }
                style={paneActionButtonStyle(isActiveLayout, theme.accent)}
              >
                {layoutDefinition.shortLabel}
              </button>
            );
          })}
        </div>
      ),
    },
  ], [
    activePane,
    activeTab,
    canUseCommanderActions,
    closeActiveTab,
    closeWorkspaceTab,
    columnSplitPercent,
    commanderButtonsDisabled,
    commanderSummaryText,
    commanderTargetPaneId,
    copySelectionToCommanderTarget,
    createTabInFocusedPane,
    duplicateActiveTab,
    ensureWorkspaceLayout,
    focusNextPane,
    focusWorkspaceTab,
    focusedPaneTabs,
    linkedNavigationEnabled,
    moveActiveTabToNextPane,
    moveSelectionToCommanderTarget,
    moveWorkspaceTabToPane,
    paneActionsMenuOpen,
    rowSplitPercent,
    runtimeSnapshotsByInstanceId,
    sessions,
    setFocusedPane,
    setPaneActionsMenuOpen,
    setWorkspaceColumnSplitRatio,
    setWorkspaceRowSplitRatio,
    syncCommanderTargetToActivePane,
    tabs,
    tabsByPane,
    theme.accent,
    visiblePaneIds,
    workspace.columnSplitRatio,
    workspace.layoutMode,
    workspace.rowSplitRatio,
    workspaceLayout.supportsColumnSplit,
    workspaceLayout.supportsRowSplit,
  ]);
  const workspaceChromeControlRegistryById = useMemo(
    () => new Map(workspaceChromeControlRegistry.map((entry) => [entry.id, entry])),
    [workspaceChromeControlRegistry],
  );
  const workspaceHeaderSurface = useMemo(
    () => resolveExplorerChromeSurfaceLayout({
      layoutId: explorerChromeLayoutId,
      surfaceId: 'workspaceHeader',
      controlDefinitions: workspaceChromeControlRegistry,
      override: explorerChromeOverride,
      isControlVisible: (controlId, surfaceId) => workspaceChromeControlRegistryById.get(controlId)?.isVisible(surfaceId) ?? false,
    }),
    [
      explorerChromeLayoutId,
      explorerChromeOverride,
      workspaceChromeControlRegistry,
      workspaceChromeControlRegistryById,
    ],
  );
  const renderWorkspaceChromeControl = useCallback((placement: ExplorerChromeResolvedControlPlacement) => (
    workspaceChromeControlRegistryById.get(placement.controlId)?.render(placement) ?? null
  ), [workspaceChromeControlRegistryById]);

  const renderPane = useCallback((pane: ExplorerPaneId, tab: ExplorerTabSnapshot | null) => {
    const isActivePane = activePane === pane;
    if (!tab) {
      return (
        <div
          style={{
            minWidth: 0,
            minHeight: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            border: '1px dashed var(--overlay-border)',
            borderRadius: 14,
            background: 'var(--overlay-bg-panel)',
            color: 'var(--overlay-text-muted)',
          }}
          onMouseDown={() => setFocusedPane(pane)}
        >
          <div
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 0,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <button
              type="button"
              onClick={() => createWorkspaceTab({
                sourceInstanceId: getPreferredSourceInstanceId(),
                pane,
              })}
              style={{
                border: '1px solid var(--overlay-border)',
                borderRadius: 999,
                padding: '8px 14px',
                background: 'var(--overlay-explorer-chip-bg)',
                color: 'var(--overlay-text-primary)',
                cursor: 'pointer',
              }}
            >
              Open Explorer
            </button>
          </div>
        </div>
      );
    }

    return (
      <div
        style={{
          minWidth: 0,
          minHeight: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid var(--overlay-border)',
          borderRadius: 14,
          overflow: 'hidden',
          background: 'var(--overlay-bg-panel)',
          ...resolvePaneAccent(isActivePane),
        }}
        onMouseDown={() => setFocusedPane(pane)}
      >
        <FileExplorer
          appearance={appearance}
          chromeControlSurface={chromeControlSurface}
          externalNavigationRequest={navigationRequestsByInstanceId[tab.instanceId] ?? null}
          externalRefreshRequest={refreshRequestsByInstanceId[tab.instanceId] ?? null}
          externalSelectionTransferRequest={selectionTransferRequestsByInstanceId[tab.instanceId] ?? null}
          instanceId={tab.instanceId}
          layoutMode={layoutMode}
          workspacePaneCount={workspacePaneCount}
          onWorkspaceRuntimeSnapshotChange={publishRuntimeSnapshot}
          onWorkspaceSelectionTransferComplete={handleWorkspaceSelectionTransferComplete}
          pluginActions={pluginActions}
          pluginContextMenuItems={pluginContextMenuItems}
          repositoryPicker={repositoryPicker}
          theme={theme}
          onAddBookmark={onAddBookmark}
          homePacks={homePacks}
          onOpenPanel={onOpenPanel}
          onOpenSettingsSection={onOpenSettingsSection}
          onOpenInFilesystemAquarium={onOpenInFilesystemAquarium}
          onOpenInTerminal={onOpenInTerminal}
        />
      </div>
    );
  }, [
    activePane,
    appearance,
    chromeControlSurface,
    createWorkspaceTab,
    getPreferredSourceInstanceId,
    handleWorkspaceSelectionTransferComplete,
    layoutMode,
    navigationRequestsByInstanceId,
    onAddBookmark,
    homePacks,
    onOpenInFilesystemAquarium,
    onOpenInTerminal,
    onOpenPanel,
    onOpenSettingsSection,
    pluginActions,
    pluginContextMenuItems,
    publishRuntimeSnapshot,
    refreshRequestsByInstanceId,
    repositoryPicker,
    selectionTransferRequestsByInstanceId,
    setFocusedPane,
    theme,
    workspacePaneCount,
  ]);

  const startColumnResize = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startRatio = workspace.columnSplitRatio;
    const width = paneSurfaceRef.current?.getBoundingClientRect().width ?? containerRef.current?.getBoundingClientRect().width ?? 1;
    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      setWorkspaceColumnSplitRatio(startRatio + delta / width);
    };
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [setWorkspaceColumnSplitRatio, workspace.columnSplitRatio]);
  const startRowResize = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startY = event.clientY;
    const startRatio = workspace.rowSplitRatio;
    const height = paneSurfaceRef.current?.getBoundingClientRect().height ?? containerRef.current?.getBoundingClientRect().height ?? 1;
    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientY - startY;
      setWorkspaceRowSplitRatio(startRatio + delta / height);
    };
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [setWorkspaceRowSplitRatio, workspace.rowSplitRatio]);
  const renderColumnHandle = useCallback((key: string) => (
    <div
      key={key}
      style={splitHandleStyle}
      onMouseDown={startColumnResize}
    >
      <div style={splitHandleInnerStyle} />
    </div>
  ), [startColumnResize]);
  const renderRowHandle = useCallback((key: string) => (
    <div
      key={key}
      style={{ ...splitHandleStyle, width: '100%', height: 8, cursor: 'row-resize' }}
      onMouseDown={startRowResize}
    >
      <div style={{ ...splitHandleInnerStyle, width: '100%', height: 2 }} />
    </div>
  ), [startRowResize]);

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        height: '100%',
        gap: 10,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          minHeight: 36,
          padding: '6px 10px',
          borderRadius: 14,
          border: '1px solid var(--overlay-border)',
          background: 'color-mix(in srgb, var(--overlay-bg-panel) 88%, black 12%)',
        }}
      >
        <ExplorerChromeSurface
          surface={workspaceHeaderSurface}
          style={{ width: '100%' }}
          getRowStyle={() => workspaceHeaderRowStyle}
          getZoneStyle={getWorkspaceHeaderZoneStyle}
          renderControl={renderWorkspaceChromeControl}
          editMode={workspaceChromeEditMode}
        />
      </div>
      {workspace.layoutMode === 'single' ? (
        <div style={{ flex: 1, minHeight: 0 }}>
          {renderPane('pane-1', activeTabByPane['pane-1'])}
        </div>
      ) : workspace.layoutMode === 'split' ? (
        <div ref={paneSurfaceRef} style={{ display: 'flex', flex: 1, minHeight: 0, gap: 10 }}>
          <div style={{ flex: workspace.columnSplitRatio, minWidth: 0, minHeight: 0 }}>
            {renderPane('pane-1', activeTabByPane['pane-1'])}
          </div>
          {renderColumnHandle('split-column')}
          <div style={{ flex: 1 - workspace.columnSplitRatio, minWidth: 0, minHeight: 0 }}>
            {renderPane('pane-2', activeTabByPane['pane-2'])}
          </div>
        </div>
      ) : (
        <div ref={paneSurfaceRef} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: 10 }}>
          <div style={{ display: 'flex', minHeight: 0, flex: workspace.rowSplitRatio, gap: 10 }}>
            <div style={{ flex: workspace.columnSplitRatio, minWidth: 0, minHeight: 0 }}>
              {renderPane('pane-1', activeTabByPane['pane-1'])}
            </div>
            {renderColumnHandle('quad-column-top')}
            <div style={{ flex: 1 - workspace.columnSplitRatio, minWidth: 0, minHeight: 0 }}>
              {renderPane('pane-2', activeTabByPane['pane-2'])}
            </div>
          </div>
          {renderRowHandle('quad-row')}
          <div style={{ display: 'flex', minHeight: 0, flex: 1 - workspace.rowSplitRatio, gap: 10 }}>
            <div style={{ flex: workspace.columnSplitRatio, minWidth: 0, minHeight: 0 }}>
              {renderPane('pane-3', activeTabByPane['pane-3'])}
            </div>
            {renderColumnHandle('quad-column-bottom')}
            <div style={{ flex: 1 - workspace.columnSplitRatio, minWidth: 0, minHeight: 0 }}>
              {renderPane('pane-4', activeTabByPane['pane-4'])}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const toolbarButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 30,
  height: 30,
  borderRadius: 999,
  border: '1px solid var(--overlay-border)',
  background: 'var(--overlay-explorer-chip-bg)',
  color: 'var(--overlay-text-primary)',
  cursor: 'pointer',
};

const paneSwitcherGroupStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  minWidth: 0,
  flexWrap: 'wrap',
};

function paneSwitcherButtonStyle(active: boolean, accent: string): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minWidth: 38,
    padding: '4px 9px',
    borderRadius: 999,
    border: `1px solid ${active ? `${accent}66` : 'var(--overlay-border)'}`,
    background: active ? `${accent}18` : 'var(--overlay-explorer-chip-bg)',
    color: active ? 'var(--overlay-text-primary)' : 'var(--overlay-text-muted)',
    fontSize: 10,
    fontWeight: 700,
    cursor: 'pointer',
  };
}

function paneSwitcherCountStyle(active: boolean, accent: string): React.CSSProperties {
  return {
    minWidth: 16,
    padding: '1px 5px',
    borderRadius: 999,
    background: active ? `${accent}24` : 'rgba(255,255,255,0.08)',
    color: active ? 'var(--overlay-text-primary)' : 'var(--overlay-text-dim)',
    fontSize: 9,
    fontWeight: 700,
    lineHeight: 1.2,
  };
}

function workspaceTabChipStyle(active: boolean, accent: string): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
    padding: '6px 8px 6px 10px',
    borderRadius: 999,
    border: `1px solid ${active ? `${accent}66` : 'var(--overlay-border)'}`,
    background: active ? `${accent}1b` : 'var(--overlay-explorer-chip-bg)',
  };
}

function workspaceTabButtonStyle(active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    minWidth: 0,
    border: 'none',
    background: 'transparent',
    color: active ? 'var(--overlay-text-primary)' : 'var(--overlay-text-muted)',
    cursor: 'pointer',
    padding: 0,
  };
}

const workspaceTabIconButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 20,
  height: 20,
  borderRadius: 999,
  border: 'none',
  background: 'transparent',
  color: 'var(--overlay-text-dim)',
  cursor: 'pointer',
  flexShrink: 0,
};

function paneActionButtonStyle(
  active: boolean,
  accent: string,
  disabled = false,
): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
    padding: '6px 10px',
    borderRadius: 999,
    border: `1px solid ${active ? `${accent}66` : 'var(--overlay-border)'}`,
    background: active ? `${accent}18` : 'var(--overlay-explorer-chip-bg)',
    color: active ? 'var(--overlay-text-primary)' : 'var(--overlay-text-muted)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 10.5,
    fontWeight: 700,
    opacity: disabled ? 0.45 : 1,
  };
}

const workspaceOverflowMenuStyle: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 8px)',
  right: 0,
  zIndex: 40,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  minWidth: 240,
  padding: 8,
  borderRadius: 14,
  border: '1px solid var(--overlay-border)',
  background: 'color-mix(in srgb, var(--overlay-bg-panel) 94%, black 6%)',
  boxShadow: '0 20px 40px rgba(0,0,0,0.28)',
};

function workspaceOverflowMenuItemStyle(active: boolean, disabled: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    minWidth: 0,
    border: 'none',
    borderRadius: 10,
    background: active ? 'var(--overlay-explorer-chip-active-bg)' : 'transparent',
    color: disabled ? 'var(--overlay-text-dim)' : 'var(--overlay-text-primary)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    padding: '7px 9px',
    fontSize: 11,
    fontWeight: 600,
    textAlign: 'left',
    opacity: disabled ? 0.5 : 1,
  };
}

const workspaceOverflowDividerStyle: React.CSSProperties = {
  height: 1,
  margin: '4px 0 1px',
  background: 'var(--overlay-border)',
  opacity: 0.8,
};

const workspaceOverflowLabelStyle: React.CSSProperties = {
  padding: '2px 9px 0',
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--overlay-text-dim)',
};

const workspaceOverflowLeadingGlyphStyle: React.CSSProperties = {
  width: 12,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

function workspaceOverflowSummaryStyle(accent: string): React.CSSProperties {
  return {
    padding: '2px 9px 4px',
    fontSize: 10,
    fontWeight: 600,
    color: accent,
  };
}

const workspaceOverflowMetaStyle: React.CSSProperties = {
  padding: '2px 9px 4px',
  fontSize: 10,
  fontWeight: 600,
  color: 'var(--overlay-text-dim)',
  whiteSpace: 'nowrap',
};

const splitHandleStyle: React.CSSProperties = {
  width: 8,
  borderRadius: 999,
  cursor: 'col-resize',
  background: 'transparent',
  position: 'relative',
  flexShrink: 0,
};

const splitHandleInnerStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  margin: 'auto',
  width: 2,
  height: '100%',
  borderRadius: 999,
  background: 'color-mix(in srgb, var(--overlay-border) 85%, transparent)',
};
