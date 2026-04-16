import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Clipboard, CopyPlus, Plus, SquareSplitHorizontal, X } from 'lucide-react';
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
import {
  resolveEffectiveExplorerModeProfile,
  resolveExplorerModeProfileChromeLayoutId,
} from '../../config/explorerModeProfiles';
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
  if (!trimmed) {
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
  const [linkedNavigationEnabled, setLinkedNavigationEnabled] = useState(false);
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
  const copyPanePath = useCallback(async (path: string) => {
    if (!path.trim() || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      return;
    }
    await navigator.clipboard.writeText(path);
  }, []);
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
    gap: 10,
    minWidth: 0,
    flexWrap: 'wrap',
  }), []);
  const getWorkspaceHeaderZoneStyle = useCallback((zoneId: ExplorerChromeZoneId): React.CSSProperties => {
    switch (zoneId) {
      case 'center':
        return {
          display: 'flex',
          alignItems: 'center',
          gap: 8,
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
          gap: 8,
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
      label: 'Pane Counts',
      surfaces: ['workspaceHeader'],
      isVisible: () => true,
      render: () => (
        <>
          {visiblePaneIds.map((paneId) => (
            <span key={paneId} style={paneBadgeStyle(activePane === paneId, theme.accent)}>
              {getPaneShortLabel(paneId)} {tabsByPane[paneId].length}
            </span>
          ))}
        </>
      ),
    },
    {
      id: 'workspaceMode',
      label: 'Workspace Mode',
      surfaces: ['workspaceHeader'],
      isVisible: () => true,
      render: () => (
        <span style={workspaceMetaStyle}>
          {workspaceLayout.shortLabel} · {getPaneShortLabel(activePane)} active
        </span>
      ),
    },
    {
      id: 'workspaceCommanderSummary',
      label: 'Commander Summary',
      surfaces: ['workspaceHeader'],
      isVisible: () => Boolean(commanderSummaryText),
      render: () => commanderSummaryText ? (
        <span style={{ ...workspaceMetaStyle, color: theme.accent }}>
          {commanderSummaryText}
        </span>
      ) : null,
    },
    {
      id: 'workspaceTabs',
      label: 'Workspace Tabs',
      surfaces: ['workspaceHeader'],
      isVisible: () => true,
      render: () => (
        <>
          {tabs.map((tab) => {
            const currentPath = runtimeSnapshotsByInstanceId[tab.instanceId]?.currentPath
              ?? sessions[tab.instanceId]?.currentPath
              ?? '';
            const isActive = activeTabByPane[tab.pane]?.id === tab.id;
            const moveTargetPaneId = getNextVisiblePaneId(visiblePaneIds, tab.pane);
            return (
              <div
                key={tab.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  minWidth: 0,
                  padding: '6px 8px 6px 10px',
                  borderRadius: 999,
                  border: `1px solid ${isActive ? `${theme.accent}66` : 'var(--overlay-border)'}`,
                  background: isActive ? `${theme.accent}1b` : 'var(--overlay-explorer-chip-bg)',
                }}
              >
                <button
                  type="button"
                  onClick={() => focusWorkspaceTab(tab.id)}
                  title={currentPath || tab.title || 'Explorer'}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    minWidth: 0,
                    border: 'none',
                    background: 'transparent',
                    color: isActive ? 'var(--overlay-text-primary)' : 'var(--overlay-text-muted)',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 999,
                      background: tab.pane === activePane ? theme.accent : 'rgba(255,255,255,0.45)',
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11.5, fontWeight: 600 }}>
                    {getTabDisplayLabel(tab, currentPath)}
                  </span>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: isActive ? 'var(--overlay-text-primary)' : 'var(--overlay-text-dim)', opacity: 0.8 }}>
                    {getPaneShortLabel(tab.pane)}
                  </span>
                  {isActive && (
                    <span style={{ fontSize: 9, fontWeight: 800, color: theme.accent, padding: '2px 5px', borderRadius: 999, border: `1px solid ${theme.accent}55`, background: `${theme.accent}14` }}>
                      Active
                    </span>
                  )}
                </button>
                {moveTargetPaneId && (
                  <button
                    type="button"
                    onClick={() => moveWorkspaceTabToPane(tab.id, moveTargetPaneId)}
                    title={`Move tab to ${getExplorerPaneLabel(moveTargetPaneId)}`}
                    style={{
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
                    }}
                  >
                    <SquareSplitHorizontal size={11} />
                  </button>
                )}
                {tabs.length > 1 && (
                  <button
                    type="button"
                    onClick={() => closeWorkspaceTab(tab.id)}
                    title="Close tab"
                    style={{
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
                    }}
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
      id: 'workspaceDuplicateTab',
      label: 'Duplicate Tab',
      surfaces: ['workspaceHeader'],
      isVisible: () => true,
      render: () => (
        <button type="button" onClick={duplicateActiveTab} title="Duplicate active tab" style={toolbarButtonStyle}>
          <CopyPlus size={13} />
        </button>
      ),
    },
    {
      id: 'workspaceFocusLeft',
      label: 'Focus Pane 1',
      surfaces: ['workspaceHeader'],
      isVisible: () => visiblePaneIds.includes('pane-1') && visiblePaneIds.length > 1,
      render: () => (
        <button type="button" onClick={() => setFocusedPane('pane-1')} title="Focus Pane 1" style={paneActionButtonStyle(activePane === 'pane-1', theme.accent)}>
          P1
        </button>
      ),
    },
    {
      id: 'workspaceFocusRight',
      label: 'Focus Pane 2',
      surfaces: ['workspaceHeader'],
      isVisible: () => visiblePaneIds.includes('pane-2') && visiblePaneIds.length > 1,
      render: () => (
        <button type="button" onClick={() => setFocusedPane('pane-2')} title="Focus Pane 2" style={paneActionButtonStyle(activePane === 'pane-2', theme.accent)}>
          P2
        </button>
      ),
    },
    {
      id: 'workspaceMoveTab',
      label: 'Move Active Tab',
      surfaces: ['workspaceHeader'],
      isVisible: () => visiblePaneIds.length > 1,
      render: () => (
        <button type="button" onClick={moveActiveTabToNextPane} title="Move active tab to the next visible pane" style={paneActionButtonStyle(false, theme.accent)}>
          Move
        </button>
      ),
    },
    {
      id: 'workspaceSyncPath',
      label: 'Sync Target Pane',
      surfaces: ['workspaceHeader'],
      isVisible: () => Boolean(commanderTargetPaneId),
      render: () => (
        <button
          type="button"
          onClick={syncCommanderTargetToActivePane}
          disabled={!canUseCommanderActions}
          title="Sync the target pane to the active pane path"
          style={paneActionButtonStyle(false, theme.accent, !canUseCommanderActions)}
        >
          Sync
        </button>
      ),
    },
    {
      id: 'workspaceLinkNavigation',
      label: 'Link Navigation',
      surfaces: ['workspaceHeader'],
      isVisible: () => Boolean(commanderTargetPaneId),
      render: () => (
        <button
          type="button"
          onClick={() => setLinkedNavigationEnabled((current) => !current)}
          title={linkedNavigationEnabled ? 'Disable linked navigation' : 'Keep the target pane synced to the active pane'}
          style={paneActionButtonStyle(linkedNavigationEnabled, theme.accent)}
        >
          Link
        </button>
      ),
    },
    {
      id: 'workspaceCopyToPane',
      label: 'Copy Selection To Pane',
      surfaces: ['workspaceHeader'],
      isVisible: () => Boolean(commanderTargetPaneId),
      render: () => (
        <button
          type="button"
          onClick={copySelectionToCommanderTarget}
          disabled={commanderButtonsDisabled}
          title="Copy the active selection into the target pane folder"
          style={paneActionButtonStyle(false, theme.accent, commanderButtonsDisabled)}
        >
          Copy
        </button>
      ),
    },
    {
      id: 'workspaceMoveToPane',
      label: 'Move Selection To Pane',
      surfaces: ['workspaceHeader'],
      isVisible: () => Boolean(commanderTargetPaneId),
      render: () => (
        <button
          type="button"
          onClick={moveSelectionToCommanderTarget}
          disabled={commanderButtonsDisabled}
          title="Move the active selection into the target pane folder"
          style={paneActionButtonStyle(false, theme.accent, commanderButtonsDisabled)}
        >
          Move
        </button>
      ),
    },
    {
      id: 'workspaceSwapPane',
      label: 'Focus Next Pane',
      surfaces: ['workspaceHeader'],
      isVisible: () => visiblePaneIds.length > 1,
      render: () => (
        <button type="button" onClick={focusNextPane} title="Switch focus to the next visible pane" style={paneActionButtonStyle(false, theme.accent)}>
          Next
        </button>
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
    {
      id: 'workspaceCloseTab',
      label: 'Close Active Tab',
      surfaces: ['workspaceHeader'],
      isVisible: () => true,
      render: () => (
        <button type="button" onClick={closeActiveTab} title="Close active tab" style={toolbarButtonStyle}>
          <X size={13} />
        </button>
      ),
    },
    {
      id: 'workspaceSplitSummary',
      label: 'Split Summary',
      surfaces: ['workspaceHeader'],
      isVisible: () => workspaceLayout.supportsColumnSplit || workspaceLayout.supportsRowSplit,
      render: () => (
        <span style={{ ...workspaceMetaStyle, paddingLeft: 4, paddingRight: 2 }}>
          {workspaceLayout.supportsColumnSplit ? `Cols ${columnSplitPercent}%` : 'Cols off'}
          {workspaceLayout.supportsRowSplit ? ` · Rows ${rowSplitPercent}%` : ''}
        </span>
      ),
    },
    {
      id: 'workspaceSplitNudgeLeft',
      label: 'Narrow First Column',
      surfaces: ['workspaceHeader'],
      isVisible: () => workspaceLayout.supportsColumnSplit,
      render: () => (
        <button
          type="button"
          onClick={() => setWorkspaceColumnSplitRatio(workspace.columnSplitRatio - 0.05)}
          title="Narrow the first column"
          style={toolbarButtonStyle}
        >
          <ChevronLeft size={13} />
        </button>
      ),
    },
    {
      id: 'workspaceSplitReset',
      label: 'Reset Column Split',
      surfaces: ['workspaceHeader'],
      isVisible: () => workspaceLayout.supportsColumnSplit,
      render: () => (
        <button
          type="button"
          onClick={() => setWorkspaceColumnSplitRatio(0.5)}
          title="Reset the column split to 50/50"
          style={toolbarButtonStyle}
        >
          <SquareSplitHorizontal size={13} />
        </button>
      ),
    },
    {
      id: 'workspaceSplitNudgeRight',
      label: 'Widen First Column',
      surfaces: ['workspaceHeader'],
      isVisible: () => workspaceLayout.supportsColumnSplit,
      render: () => (
        <button
          type="button"
          onClick={() => setWorkspaceColumnSplitRatio(workspace.columnSplitRatio + 0.05)}
          title="Widen the first column"
          style={toolbarButtonStyle}
        >
          <ChevronRight size={13} />
        </button>
      ),
    },
  ], [
    activePane,
    activePanePath,
    activeTab,
    activeTabByPane,
    canUseCommanderActions,
    closeActiveTab,
    closeWorkspaceTab,
    columnSplitPercent,
    commanderButtonsDisabled,
    commanderSelectionCount,
    commanderSummaryText,
    commanderTargetPaneId,
    copySelectionToCommanderTarget,
    copyPanePath,
    createTabInFocusedPane,
    duplicateActiveTab,
    ensureWorkspaceLayout,
    focusNextPane,
    focusWorkspaceTab,
    linkedNavigationEnabled,
    moveActiveTabToNextPane,
    moveSelectionToCommanderTarget,
    moveWorkspaceTabToPane,
    rowSplitPercent,
    runtimeSnapshotsByInstanceId,
    sessions,
    setFocusedPane,
    setWorkspaceColumnSplitRatio,
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
    workspaceLayout.shortLabel,
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
    const paneLabel = getExplorerPaneLabel(pane);
    const panePath = tab
      ? (
        runtimeSnapshotsByInstanceId[tab.instanceId]?.currentPath
        ?? sessions[tab.instanceId]?.currentPath
        ?? ''
      )
      : '';
    const paneTabsCount = tabsByPane[pane].length;
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
              Open {paneLabel}
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 10px', borderBottom: '1px solid var(--overlay-border)', background: isActivePane ? `color-mix(in srgb, ${theme.accent} 12%, var(--overlay-bg-panel) 88%)` : 'color-mix(in srgb, var(--overlay-bg-panel) 92%, black 8%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: isActivePane ? 'var(--overlay-text-primary)' : 'var(--overlay-text-muted)' }}>
              {paneLabel}
            </span>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--overlay-text-dim)' }}>
              {paneTabsCount} tabs
            </span>
            {isActivePane && (
              <span style={{ fontSize: 9, fontWeight: 700, color: theme.accent, padding: '2px 6px', borderRadius: 999, border: `1px solid ${theme.accent}55`, background: `${theme.accent}14` }}>
                Focused
              </span>
            )}
            <span
              title={tab.title || panePath}
              style={{
                maxWidth: 170,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: 10,
                color: 'var(--overlay-text-dim)',
                fontWeight: 600,
              }}
            >
              {getTabDisplayLabel(tab, panePath)}
            </span>
          </div>
          <span
            title="Click to copy path"
            onClick={() => copyPanePath(panePath)}
            style={{ fontSize: 10, color: 'var(--overlay-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1, textAlign: 'right', cursor: 'copy' }}
          >
            {panePath || 'No path'}
          </span>
          {panePath && (
            <button
              type="button"
              onClick={() => copyPanePath(panePath)}
              title="Copy pane path"
              style={{
                ...toolbarButtonStyle,
                width: 24,
                height: 24,
                flexShrink: 0,
              }}
            >
              <Clipboard size={12} />
            </button>
          )}
        </div>
        <FileExplorer
          appearance={appearance}
          chromeControlSurface={chromeControlSurface}
          externalNavigationRequest={navigationRequestsByInstanceId[tab.instanceId] ?? null}
          externalRefreshRequest={refreshRequestsByInstanceId[tab.instanceId] ?? null}
          externalSelectionTransferRequest={selectionTransferRequestsByInstanceId[tab.instanceId] ?? null}
          instanceId={tab.instanceId}
          layoutMode={layoutMode}
          onWorkspaceRuntimeSnapshotChange={publishRuntimeSnapshot}
          onWorkspaceSelectionTransferComplete={handleWorkspaceSelectionTransferComplete}
          pluginActions={pluginActions}
          pluginContextMenuItems={pluginContextMenuItems}
          repositoryPicker={repositoryPicker}
          theme={theme}
          onAddBookmark={onAddBookmark}
          onOpenInFilesystemAquarium={onOpenInFilesystemAquarium}
          onOpenInTerminal={onOpenInTerminal}
        />
      </div>
    );
  }, [
    activePane,
    appearance,
    chromeControlSurface,
    copyPanePath,
    createWorkspaceTab,
    getPreferredSourceInstanceId,
    handleWorkspaceSelectionTransferComplete,
    layoutMode,
    navigationRequestsByInstanceId,
    onAddBookmark,
    onOpenInFilesystemAquarium,
    onOpenInTerminal,
    pluginActions,
    pluginContextMenuItems,
    publishRuntimeSnapshot,
    refreshRequestsByInstanceId,
    repositoryPicker,
    runtimeSnapshotsByInstanceId,
    selectionTransferRequestsByInstanceId,
    sessions,
    setFocusedPane,
    tabsByPane,
    theme,
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
          gap: 10,
          minHeight: 40,
          padding: '8px 10px',
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

function paneBadgeStyle(active: boolean, accent: string): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 34,
    padding: '3px 8px',
    borderRadius: 999,
    border: `1px solid ${active ? `${accent}66` : 'var(--overlay-border)'}`,
    background: active ? `${accent}18` : 'var(--overlay-explorer-chip-bg)',
    color: active ? 'var(--overlay-text-primary)' : 'var(--overlay-text-muted)',
    fontSize: 10,
    fontWeight: 700,
  };
}

const workspaceMetaStyle: React.CSSProperties = {
  color: 'var(--overlay-text-dim)',
  fontSize: 10.5,
  fontWeight: 600,
  whiteSpace: 'nowrap',
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
