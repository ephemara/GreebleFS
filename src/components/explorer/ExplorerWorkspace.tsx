import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, Clipboard, Columns2, CopyPlus, Plus, SquareSplitHorizontal, X } from 'lucide-react';
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
  PRIMARY_EXPLORER_INSTANCE_ID,
  defaultExplorerSession,
  useExplorerStore,
  type ExplorerPaneId,
  type ExplorerTabSnapshot,
} from '../../store/explorerStore';
import { useSettingsStore } from '../../store/settingsStore';
import { ExplorerChromeSurface } from './ExplorerChromeSurface';
import { FileExplorer } from '../FileExplorer';

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
    setWorkspaceLayoutMode,
    setFocusedPane,
    setWorkspaceSplitRatio,
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
    setWorkspaceLayoutMode: state.setWorkspaceLayoutMode,
    setFocusedPane: state.setFocusedPane,
    setWorkspaceSplitRatio: state.setWorkspaceSplitRatio,
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
  const leftTabs = useMemo(
    () => tabs.filter((tab) => tab.pane === 'left'),
    [tabs],
  );
  const rightTabs = useMemo(
    () => tabs.filter((tab) => tab.pane === 'right'),
    [tabs],
  );
  const activeLeftTab = leftTabs.find((tab) => tab.id === workspace.activeTabIdByPane.left) ?? leftTabs[0] ?? null;
  const activeRightTab = rightTabs.find((tab) => tab.id === workspace.activeTabIdByPane.right) ?? rightTabs[0] ?? null;
  const activePane = workspace.focusedPane;
  const activeTab = (activePane === 'right' ? activeRightTab : activeLeftTab)
    ?? activeLeftTab
    ?? activeRightTab
    ?? null;
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
  const splitPercent = Math.round(workspace.splitRatio * 100);
  const activePaneTabs = activePane === 'left' ? leftTabs : rightTabs;

  const getPreferredSourceInstanceId = () => activeTab?.instanceId ?? (activePane === 'left' ? activeRightTab?.instanceId : activeLeftTab?.instanceId) ?? PRIMARY_EXPLORER_INSTANCE_ID;

  const ensureDualPane = () => {
    if (!activeRightTab) {
      createWorkspaceTab({
        sourceInstanceId: getPreferredSourceInstanceId(),
        pane: 'right',
      });
    }
    setWorkspaceLayoutMode('dual');
  };

  const toggleDualPane = () => {
    if (workspace.layoutMode === 'dual') {
      setWorkspaceLayoutMode('single');
      setFocusedPane('left');
      return;
    }
    ensureDualPane();
  };

  const duplicateActiveTab = () => {
    if (!activeTab) {
      return;
    }
    createWorkspaceTab({
      sourceInstanceId: activeTab.instanceId,
      pane: activePane,
    });
  };

  const createTabInFocusedPane = () => {
    createWorkspaceTab({
      sourceInstanceId: getPreferredSourceInstanceId(),
      pane: activePane,
    });
  };

  const closeActiveTab = () => {
    if (!activeTab) {
      return;
    }
    closeWorkspaceTab(activeTab.id);
  };

  const moveActiveTabToOtherPane = () => {
    if (!activeTab) {
      return;
    }
    if (workspace.layoutMode !== 'dual') {
      ensureDualPane();
      return;
    }
    const targetPane: ExplorerPaneId = activePane === 'left' ? 'right' : 'left';
    moveWorkspaceTabToPane(activeTab.id, targetPane);
  };

  const focusOtherPane = () => {
    setFocusedPane(activePane === 'left' ? 'right' : 'left');
  };

  const copyPanePath = async (path: string) => {
    if (!path.trim() || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      return;
    }
    await navigator.clipboard.writeText(path);
  };

  const renderPane = (pane: ExplorerPaneId, tab: ExplorerTabSnapshot | null) => {
    const isActivePane = workspace.focusedPane === pane;
    const paneLabel = pane === 'left' ? 'Left pane' : 'Right pane';
    const panePath = tab ? (sessions[tab.instanceId]?.currentPath ?? '') : '';
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
              sourceInstanceId: activeLeftTab?.instanceId ?? activeRightTab?.instanceId ?? getPreferredSourceInstanceId(),
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
            Open {pane === 'left' ? 'Left' : 'Right'} Pane
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
            <span style={{ fontSize: 10.5, fontWeight: 700, color: isActivePane ? 'var(--overlay-text-primary)' : 'var(--overlay-text-muted)' }}>{paneLabel}</span>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--overlay-text-dim)' }}>
              {activePaneTabs.length} tabs
            </span>
            {isActivePane && (
              <span style={{ fontSize: 9, fontWeight: 700, color: theme.accent, padding: '2px 6px', borderRadius: 999, border: `1px solid ${theme.accent}55`, background: `${theme.accent}14` }}>
                Focused
              </span>
            )}
            <span
              title={tab?.title ?? panePath}
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
              {tab ? getTabDisplayLabel(tab, panePath) : 'Empty'}
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
          instanceId={tab.instanceId}
          layoutMode={layoutMode}
          pluginActions={pluginActions}
          repositoryPicker={repositoryPicker}
          theme={theme}
          onAddBookmark={onAddBookmark}
          onOpenInFilesystemAquarium={onOpenInFilesystemAquarium}
          onOpenInTerminal={onOpenInTerminal}
          pluginContextMenuItems={pluginContextMenuItems}
        />
      </div>
    );
  };

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
          <span style={paneBadgeStyle(activePane === 'left', theme.accent)}>L {leftTabs.length}</span>
          <span style={paneBadgeStyle(activePane === 'right', theme.accent)}>R {rightTabs.length}</span>
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
          {workspace.layoutMode === 'dual' ? 'Dual pane' : 'Single pane'} · {activePane === 'left' ? 'Left active' : 'Right active'}
        </span>
      ),
    },
    {
      id: 'workspaceLayoutHint',
      label: 'Workspace Hint',
      surfaces: ['workspaceHeader'],
      isVisible: () => workspace.layoutMode === 'dual',
      render: () => (
        <span style={{ ...workspaceMetaStyle, color: theme.accent }}>
          Move tabs with the chip arrow or the Move button
        </span>
      ),
    },
    {
      id: 'workspaceTabs',
      label: 'Workspace Tabs',
      surfaces: ['workspaceHeader'],
      isVisible: () => true,
      render: () => (
        <>
          {tabs.map((tab) => {
            const currentPath = sessions[tab.instanceId]?.currentPath ?? '';
            const isActive = (tab.pane === 'left' ? activeLeftTab?.id : activeRightTab?.id) === tab.id;
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
                      background: tab.pane === 'left' ? theme.accent : 'rgba(255,255,255,0.45)',
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11.5, fontWeight: 600 }}>
                    {getTabDisplayLabel(tab, currentPath)}
                  </span>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: isActive ? 'var(--overlay-text-primary)' : 'var(--overlay-text-dim)', opacity: 0.8 }}>
                    {tab.pane === 'left' ? 'L' : 'R'}
                  </span>
                  {isActive && (
                    <span style={{ fontSize: 9, fontWeight: 800, color: theme.accent, padding: '2px 5px', borderRadius: 999, border: `1px solid ${theme.accent}55`, background: `${theme.accent}14` }}>
                      Active
                    </span>
                  )}
                </button>
                {workspace.layoutMode === 'dual' && (
                  <button
                    type="button"
                    onClick={() => moveWorkspaceTabToPane(tab.id, tab.pane === 'left' ? 'right' : 'left')}
                    title={tab.pane === 'left' ? 'Move tab to right pane' : 'Move tab to left pane'}
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
        <button type="button" onClick={createTabInFocusedPane} title="New explorer tab" style={toolbarButtonStyle}>
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
      label: 'Focus Left',
      surfaces: ['workspaceHeader'],
      isVisible: () => workspace.layoutMode === 'dual',
      render: () => (
        <button type="button" onClick={() => setFocusedPane('left')} title="Focus left pane" style={paneActionButtonStyle(activePane === 'left', theme.accent)}>
          Left
        </button>
      ),
    },
    {
      id: 'workspaceFocusRight',
      label: 'Focus Right',
      surfaces: ['workspaceHeader'],
      isVisible: () => workspace.layoutMode === 'dual',
      render: () => (
        <button type="button" onClick={() => setFocusedPane('right')} title="Focus right pane" style={paneActionButtonStyle(activePane === 'right', theme.accent)}>
          Right
        </button>
      ),
    },
    {
      id: 'workspaceMoveTab',
      label: 'Move Active Tab',
      surfaces: ['workspaceHeader'],
      isVisible: () => workspace.layoutMode === 'dual',
      render: () => (
        <button type="button" onClick={moveActiveTabToOtherPane} title="Move active tab to the other pane" style={paneActionButtonStyle(false, theme.accent)}>
          Move
        </button>
      ),
    },
    {
      id: 'workspaceSwapPane',
      label: 'Swap Focus',
      surfaces: ['workspaceHeader'],
      isVisible: () => workspace.layoutMode === 'dual',
      render: () => (
        <button type="button" onClick={focusOtherPane} title="Switch focus to the other pane" style={paneActionButtonStyle(false, theme.accent)}>
          Swap
        </button>
      ),
    },
    {
      id: 'workspaceSplitToggle',
      label: 'Toggle Split',
      surfaces: ['workspaceHeader'],
      isVisible: () => true,
      render: () => workspace.layoutMode === 'dual' ? (
        <button type="button" onClick={toggleDualPane} title="Return to single pane" style={toolbarButtonStyle}>
          <Columns2 size={13} />
        </button>
      ) : (
        <button type="button" onClick={toggleDualPane} title="Open dual pane" style={paneActionButtonStyle(false, theme.accent)}>
          Split
        </button>
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
      isVisible: () => workspace.layoutMode === 'dual',
      render: () => (
        <span style={{ ...workspaceMetaStyle, paddingLeft: 4, paddingRight: 2 }} title={`Left pane ${splitPercent}% wide`}>
          Split {splitPercent}%
        </span>
      ),
    },
    {
      id: 'workspaceSplitNudgeLeft',
      label: 'Narrow Left Pane',
      surfaces: ['workspaceHeader'],
      isVisible: () => workspace.layoutMode === 'dual',
      render: () => (
        <button
          type="button"
          onClick={() => setWorkspaceSplitRatio(workspace.splitRatio - 0.05)}
          title="Narrow left pane"
          style={toolbarButtonStyle}
        >
          <ChevronLeft size={13} />
        </button>
      ),
    },
    {
      id: 'workspaceSplitReset',
      label: 'Reset Split',
      surfaces: ['workspaceHeader'],
      isVisible: () => workspace.layoutMode === 'dual',
      render: () => (
        <button
          type="button"
          onClick={() => setWorkspaceSplitRatio(0.5)}
          title="Reset split to 50/50"
          style={toolbarButtonStyle}
        >
          <SquareSplitHorizontal size={13} />
        </button>
      ),
    },
    {
      id: 'workspaceSplitNudgeRight',
      label: 'Widen Left Pane',
      surfaces: ['workspaceHeader'],
      isVisible: () => workspace.layoutMode === 'dual',
      render: () => (
        <button
          type="button"
          onClick={() => setWorkspaceSplitRatio(workspace.splitRatio + 0.05)}
          title="Widen left pane"
          style={toolbarButtonStyle}
        >
          <ChevronRight size={13} />
        </button>
      ),
    },
  ], [
    activeLeftTab?.id,
    activePane,
    activeRightTab?.id,
    closeActiveTab,
    closeWorkspaceTab,
    createTabInFocusedPane,
    duplicateActiveTab,
    focusOtherPane,
    focusWorkspaceTab,
    leftTabs.length,
    moveActiveTabToOtherPane,
    moveWorkspaceTabToPane,
    rightTabs.length,
    sessions,
    setFocusedPane,
    setWorkspaceSplitRatio,
    splitPercent,
    tabs,
    theme.accent,
    toggleDualPane,
    workspace.layoutMode,
    workspace.splitRatio,
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
          {renderPane(activePane, activeTab)}
        </div>
      ) : (
        <div style={{ display: 'flex', flex: 1, minHeight: 0, gap: 10 }}>
          <div style={{ flex: workspace.splitRatio, minWidth: 0, minHeight: 0 }}>
            {renderPane('left', activeLeftTab)}
          </div>
          <div
            style={{
              width: 8,
              borderRadius: 999,
              cursor: 'col-resize',
              background: 'transparent',
              position: 'relative',
              flexShrink: 0,
            }}
            onMouseDown={(event) => {
              event.preventDefault();
              const startX = event.clientX;
              const startRatio = workspace.splitRatio;
              const width = containerRef.current?.getBoundingClientRect().width ?? 1;
              const onMouseMove = (moveEvent: MouseEvent) => {
                const delta = moveEvent.clientX - startX;
                setWorkspaceSplitRatio(startRatio + delta / width);
              };
              const onMouseUp = () => {
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
              };
              window.addEventListener('mousemove', onMouseMove);
              window.addEventListener('mouseup', onMouseUp);
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                margin: 'auto',
                width: 2,
                height: '100%',
                borderRadius: 999,
                background: 'color-mix(in srgb, var(--overlay-border) 85%, transparent)',
              }}
            />
          </div>
          <div style={{ flex: 1 - workspace.splitRatio, minWidth: 0, minHeight: 0 }}>
            {renderPane('right', activeRightTab)}
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

function paneActionButtonStyle(active: boolean, accent: string): React.CSSProperties {
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
    cursor: 'pointer',
    fontSize: 10.5,
    fontWeight: 700,
  };
}
