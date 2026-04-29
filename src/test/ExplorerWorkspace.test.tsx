import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LoadedExplorerAction } from '../config/actionPacks';
import { resolveOverlayAppearance } from '../config/appearance';
import { defaultExplorerRailSnapshot } from '../components/explorer/explorerRailState';
import {
  PRIMARY_EXPLORER_INSTANCE_ID,
  PRIMARY_EXPLORER_TAB_ID,
  defaultExplorerSession,
  defaultExplorerWorkspace,
  useExplorerStore,
} from '../store/explorerStore';
import { useSettingsStore } from '../store/settingsStore';
import type {
  ExplorerWorkspaceRuntimeSnapshot,
  ExplorerWorkspaceSelectionTransferResult,
} from '../components/FileExplorer';
import {
  endExplorerDragInteraction,
  updateExplorerDragInteractionFromResolvedHit,
} from '../components/explorer/explorerDragAndDrop';

const renderedFileExplorerPropsByInstanceId = new Map<string, Record<string, unknown>>();

vi.mock('../components/FileExplorer', () => ({
  FileExplorer: (props: Record<string, unknown>) => {
    const instanceId = typeof props.instanceId === 'string' ? props.instanceId : PRIMARY_EXPLORER_INSTANCE_ID;
    renderedFileExplorerPropsByInstanceId.set(instanceId, props);
    const externalChromeControls = Array.isArray(props.externalChromeControls)
      ? (props.externalChromeControls as Array<{
          id: string;
          surfaces: string[];
          render?: (placement: Record<string, unknown>) => unknown;
        }>)
      : [];
    const chromeControlSurface =
      typeof props.chromeControlSurface === 'string' ? props.chromeControlSurface : 'toolbar';
    const activeHeaderSurface =
      chromeControlSurface === 'topbar' ? 'explorerTopbar' : 'explorerToolbar';
    const chromeEditActive =
      Boolean(
        useExplorerStore.getState().chromeEditSession &&
          useExplorerStore.getState().chromeEditSession?.layoutId === 'default',
      );
    const defaultZoneByControlId: Record<string, 'center' | 'end'> = {
      workspaceTabStrip: 'center',
      workspaceTabs: 'center',
      workspacePaneCounts: 'end',
      workspaceNewTab: 'end',
      workspacePaneActionsMenu: 'end',
      workspaceSplitToggle: 'end',
    };
    return (
      <div
        data-workspace-pane-shell="true"
        style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}
      >
        {externalChromeControls.length > 0 ? (
          <div data-layout-dynamics-surface={activeHeaderSurface}>
            {externalChromeControls
              .filter((entry) => entry.surfaces.includes(activeHeaderSurface))
              .map((entry) => {
                const zone = defaultZoneByControlId[entry.id] ?? 'end';
                return (
                  <div
                    key={entry.id}
                    data-overlay-explorer-control={entry.id}
                    data-overlay-explorer-control-zone={zone}
                  >
                    {entry.render?.({
                      controlId: entry.id,
                      surfaceId: activeHeaderSurface,
                      zone,
                      order: 10,
                      offsetPx: 0,
                      sizeVariant: 'regular',
                    }) as ReactNode}
                  </div>
                );
              })}
          </div>
        ) : null}
        {chromeEditActive ? (
          <div data-layout-dynamics-surface={activeHeaderSurface} />
        ) : null}
        <div data-testid={`file-explorer-${instanceId}`} />
      </div>
    );
  },
}));

import { ExplorerWorkspace } from '../components/explorer/ExplorerWorkspace';

function getWorkspaceControl(controlId: string) {
  return document.querySelector(`[data-overlay-explorer-control="${controlId}"]`) as HTMLElement | null;
}

function getRequiredWorkspaceControl(controlId: string): HTMLElement {
  const control = getWorkspaceControl(controlId);
  if (!control) {
    throw new Error(`Workspace control ${controlId} not found`);
  }
  return control;
}

function getWorkspaceTabStrip(): HTMLElement {
  return getRequiredWorkspaceControl('workspaceTabStrip');
}

function getWorkspacePaneCountsControl(): HTMLElement {
  return getRequiredWorkspaceControl('workspacePaneCounts');
}

function getWorkspaceTabsRegion(): HTMLElement {
  return within(getWorkspaceTabStrip()).getByLabelText('Workspace tabs');
}

function getWorkspaceLayoutButton(label: string): HTMLButtonElement {
  return within(getWorkspacePaneCountsControl()).getByRole('button', { name: label });
}

function getWorkspacePaneActionsButton(): HTMLButtonElement {
  return within(getRequiredWorkspaceControl('workspacePaneActionsMenu')).getByRole('button', {
    name: 'Workspace pane actions',
  });
}

function getRenderedFileExplorerProps(instanceId: string) {
  const props = renderedFileExplorerPropsByInstanceId.get(instanceId);
  if (!props) {
    throw new Error(`Mock FileExplorer props were not captured for ${instanceId}`);
  }
  return props;
}

function getVisibleFileExplorerCount() {
  return document.querySelectorAll('[data-testid^="file-explorer-"]').length;
}

function emitRuntimeSnapshot(
  instanceId: string,
  snapshot: Omit<ExplorerWorkspaceRuntimeSnapshot, 'instanceId'>,
) {
  const props = getRenderedFileExplorerProps(instanceId);
  const handler = props.onWorkspaceRuntimeSnapshotChange as ((value: ExplorerWorkspaceRuntimeSnapshot) => void) | undefined;
  handler?.({
    instanceId,
    ...snapshot,
  });
}

function emitSelectionTransferComplete(
  instanceId: string,
  result: ExplorerWorkspaceSelectionTransferResult,
) {
  const props = getRenderedFileExplorerProps(instanceId);
  const handler = props.onWorkspaceSelectionTransferComplete as ((value: ExplorerWorkspaceSelectionTransferResult) => void) | undefined;
  handler?.(result);
}

function getActiveWorkspaceTab() {
  const { workspace } = useExplorerStore.getState();
  return workspace.tabs.find((tab) => tab.id === workspace.activeWorkspaceTabId) ?? workspace.tabs[0] ?? null;
}

const workspaceHeaderAction: LoadedExplorerAction = {
  id: 'workspace.sample-action',
  actionId: 'sample-action',
  packId: 'workspace-pack',
  packName: 'Workspace Pack',
  version: 1,
  title: 'Sample Workspace Action',
  description: 'Used by workspace header action rendering tests.',
  tags: [],
  directoryPath: '/actions/workspace-pack/sample-action',
  manifestPath: '/actions/workspace-pack/sample-action/action.json',
  sourceKind: 'action-pack-directory',
  sourceLabel: 'Actions',
  sourceBadgeLabel: 'ACTION',
  contexts: ['background', 'entry', 'multi-select'],
  appliesTo: 'any',
  selection: {
    minCount: 0,
    allowFiles: true,
    allowDirectories: true,
    extensions: [],
  },
  execution: {
    runner: 'shell',
    entry: 'echo',
    args: ['workspace'],
    env: {},
  },
  presentation: {
    outputTarget: 'silent',
  },
  warnings: [],
};

function renderWorkspace(
  appearance?: ReturnType<typeof resolveOverlayAppearance>,
  props?: Partial<Parameters<typeof ExplorerWorkspace>[0]>,
) {
  return render(
    <ExplorerWorkspace
      appearance={appearance}
      theme={{
        accent: '#8ab4f8',
        bg: '#0f1115',
        bgPanel: '#151923',
        text: '#f4f7fb',
        border: '#2a2f3a',
        textMuted: '#9aa4b2',
      }}
      onOpenInFilesystemAquarium={() => undefined}
      onOpenInTerminal={() => undefined}
      onAddBookmark={() => undefined}
      {...props}
    />,
  );
}

describe('ExplorerWorkspace', () => {
  beforeEach(() => {
    renderedFileExplorerPropsByInstanceId.clear();
    endExplorerDragInteraction();
    useExplorerStore.setState({
      sessions: {
        primary: defaultExplorerSession,
      },
      session: defaultExplorerSession,
      workspace: defaultExplorerWorkspace,
      rail: defaultExplorerRailSnapshot,
      clipboard: null,
      persistence: {
        status: 'ready',
        message: null,
        hasBackup: false,
      },
      chromeEditSession: null,
      pendingOpenRequest: null,
    });
    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        appearance: {
          ...state.settings.appearance,
          activeThemeId: 'operator',
        },
        explorer: {
          ...state.settings.explorer,
          chromeLayoutOverridesByThemeId: {},
        },
      },
    }));
  });

  afterEach(() => {
    renderedFileExplorerPropsByInstanceId.clear();
    endExplorerDragInteraction();
    useExplorerStore.setState({
      sessions: {
        primary: defaultExplorerSession,
      },
      session: defaultExplorerSession,
      workspace: defaultExplorerWorkspace,
      rail: defaultExplorerRailSnapshot,
      clipboard: null,
      persistence: {
        status: 'ready',
        message: null,
        hasBackup: false,
      },
      chromeEditSession: null,
      pendingOpenRequest: null,
    });
    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        appearance: {
          ...state.settings.appearance,
          activeThemeId: 'operator',
        },
        explorer: {
          ...state.settings.explorer,
          chromeLayoutOverridesByThemeId: {},
        },
      },
    }));
  });

  it('renders the primary workspace pane', async () => {
    const { container } = renderWorkspace();

    expect(screen.getByTestId('file-explorer-primary')).toBeInTheDocument();
    expect(getRenderedFileExplorerProps(PRIMARY_EXPLORER_INSTANCE_ID).workspacePaneCount).toBe(1);
    expect(getRenderedFileExplorerProps(PRIMARY_EXPLORER_INSTANCE_ID).renderDragOverlayHost).toBe(false);
    const explorerPane = container.querySelector('[data-testid="file-explorer-primary"]')?.parentElement as HTMLDivElement | null;
    expect(explorerPane).not.toBeNull();
    expect(explorerPane?.style.height).toBe('100%');
    expect(explorerPane?.style.display).toBe('flex');
  });

  it('renders the unified workspace tab strip through the shared header surface', () => {
    renderWorkspace();

    expect(screen.getByLabelText('Workspace tabs')).toBeInTheDocument();
    expect(getWorkspaceControl('workspacePaneCounts')).not.toBeNull();
    expect(getWorkspaceControl('workspaceNewTab')).not.toBeNull();
    expect(getWorkspaceControl('workspacePaneActionsMenu')).not.toBeNull();
  });

  it('mounts the shared drag overlay during normal live workspace panes', () => {
    renderWorkspace();

    act(() => {
      updateExplorerDragInteractionFromResolvedHit({
        resolvedHit: null,
        sourceKind: 'internal',
        sourcePaths: ['/workspace/notes.txt'],
        operation: 'move',
        platform: 'linux',
        primaryLabel: 'notes.txt',
        pointer: { x: 48, y: 56 },
      });
    });

    expect(document.querySelector('[data-explorer-drag-overlay="true"]')).not.toBeNull();
  });

  it('routes commander sync, copy, and target refresh through the workspace bridge', async () => {
    renderWorkspace();

    fireEvent.click(getWorkspaceLayoutButton('2-Up'));
    await waitFor(() => {
      expect(renderedFileExplorerPropsByInstanceId.has(PRIMARY_EXPLORER_INSTANCE_ID)).toBe(true);
      expect(getVisibleFileExplorerCount()).toBe(2);
    });

    const targetInstanceId = [...renderedFileExplorerPropsByInstanceId.keys()]
      .find((instanceId) => instanceId !== PRIMARY_EXPLORER_INSTANCE_ID);
    expect(targetInstanceId).toBeTruthy();

    emitRuntimeSnapshot(PRIMARY_EXPLORER_INSTANCE_ID, {
      currentPath: '/workspace/source',
      currentPathIsCloud: false,
      selectedEntries: [
        {
          path: '/workspace/source/alpha.txt',
          name: 'alpha.txt',
          is_dir: false,
        },
      ],
    });
    emitRuntimeSnapshot(targetInstanceId as string, {
      currentPath: '/workspace/destination',
      currentPathIsCloud: false,
      selectedEntries: [],
    });

    fireEvent.click(getWorkspacePaneActionsButton());
    const paneActionsMenu = await screen.findByRole('menu', { name: 'Workspace pane actions' });
    expect(
      getWorkspacePaneActionsButton().parentElement?.contains(paneActionsMenu),
    ).toBe(false);
    expect(within(paneActionsMenu).getByText('1 selected -> P2 · destination')).toBeInTheDocument();

    fireEvent.click(within(paneActionsMenu).getByRole('menuitem', { name: /sync target pane/i }));
    await waitFor(() => {
      expect(getRenderedFileExplorerProps(targetInstanceId as string).externalNavigationRequest).toMatchObject({
        path: '/workspace/source',
      });
    });

    fireEvent.click(getWorkspacePaneActionsButton());
    fireEvent.click(await screen.findByRole('menuitem', { name: /copy selection to pane/i }));
    await waitFor(() => {
      expect(getRenderedFileExplorerProps(PRIMARY_EXPLORER_INSTANCE_ID).externalSelectionTransferRequest).toMatchObject({
        targetDir: '/workspace/destination',
        operation: 'copy',
      });
    });

    emitSelectionTransferComplete(PRIMARY_EXPLORER_INSTANCE_ID, {
      sequence: 4,
      instanceId: PRIMARY_EXPLORER_INSTANCE_ID,
      targetDir: '/workspace/destination',
      operation: 'copy',
      sourcePaths: ['/workspace/source/alpha.txt'],
      success: true,
    });
    await waitFor(() => {
      expect(getRenderedFileExplorerProps(targetInstanceId as string).externalRefreshRequest).toBeTruthy();
    });
  });

  it('forwards store reveal requests into the active pane explorer instance', async () => {
    renderWorkspace();

    act(() => {
      useExplorerStore.getState().requestOpenInExplorer({
        directoryPath: ' /workspace/target ',
        selectionPath: ' /workspace/target/alpha.txt ',
        pushHistory: false,
      });
    });

    await waitFor(() => {
      expect(
        getRenderedFileExplorerProps(PRIMARY_EXPLORER_INSTANCE_ID).externalRevealRequest,
      ).toMatchObject({
        directoryPath: '/workspace/target',
        selectionPath: '/workspace/target/alpha.txt',
        pushHistory: false,
      });
    });
  });

  it('keeps the tab strip stable when focus changes between panes', async () => {
    renderWorkspace();

    fireEvent.click(getWorkspaceLayoutButton('2-Up'));
    await waitFor(() => {
      expect(getVisibleFileExplorerCount()).toBe(2);
    });

    useExplorerStore.getState().updateWorkspaceTabTitle(PRIMARY_EXPLORER_TAB_ID, 'Primary Workspace');
    const nextTab = useExplorerStore.getState().createWorkspaceTab({
      sourceWorkspaceTabId: PRIMARY_EXPLORER_TAB_ID,
      activate: false,
    });
    useExplorerStore.getState().updateWorkspaceTabTitle(nextTab.id, 'Secondary Workspace');

    await waitFor(() => {
      const workspaceTabStrip = getWorkspaceTabStrip();
      expect(workspaceTabStrip.textContent).toContain('Secondary Workspace');
      expect(
        within(getWorkspaceTabsRegion()).getAllByRole('button', {
          name: /workspace|explorer/i,
        }),
      ).toHaveLength(2);
    });

    fireEvent.click(within(getWorkspaceTabStrip()).getByTitle('Focus Pane 2'));

    await waitFor(() => {
      const workspaceTabStrip = getWorkspaceTabStrip();
      expect(workspaceTabStrip.textContent).toContain('Secondary Workspace');
      expect(
        within(getWorkspaceTabsRegion()).getAllByRole('button', {
          name: /workspace|explorer/i,
        }),
      ).toHaveLength(2);
      expect(useExplorerStore.getState().workspace.activeWorkspaceTabId).toBe(PRIMARY_EXPLORER_TAB_ID);
      expect(getActiveWorkspaceTab()?.focusedPane).toBe('pane-2');
    });
  });

  it('switches layouts per workspace tab and supports 3-Up', async () => {
    renderWorkspace();

    fireEvent.click(getWorkspaceLayoutButton('3-Up'));
    await waitFor(() => {
      expect(getActiveWorkspaceTab()?.layoutMode).toBe('triple');
      expect(getVisibleFileExplorerCount()).toBe(3);
      expect(getRenderedFileExplorerProps(PRIMARY_EXPLORER_INSTANCE_ID).workspacePaneCount).toBe(3);
      expect(getWorkspaceLayoutButton('3-Up')).toHaveAttribute('aria-pressed', 'true');
    });

    useExplorerStore.getState().updateWorkspaceTabTitle(PRIMARY_EXPLORER_TAB_ID, 'Primary Workspace');
    const secondaryTab = useExplorerStore.getState().createWorkspaceTab({
      sourceWorkspaceTabId: PRIMARY_EXPLORER_TAB_ID,
    });
    useExplorerStore.getState().updateWorkspaceTabTitle(secondaryTab.id, 'Secondary Workspace');

    await waitFor(() => {
      expect(useExplorerStore.getState().workspace.activeWorkspaceTabId).toBe(secondaryTab.id);
      expect(getActiveWorkspaceTab()?.layoutMode).toBe('single');
      expect(getVisibleFileExplorerCount()).toBe(1);
    });

    fireEvent.click(screen.getByRole('button', { name: /primary workspace/i }));
    await waitFor(() => {
      expect(useExplorerStore.getState().workspace.activeWorkspaceTabId).toBe(PRIMARY_EXPLORER_TAB_ID);
      expect(getActiveWorkspaceTab()?.layoutMode).toBe('triple');
      expect(getVisibleFileExplorerCount()).toBe(3);
    });
  });

  it('duplicates and closes workspace tabs from the overflow menu', async () => {
    renderWorkspace();

    useExplorerStore.getState().updateWorkspaceTabTitle(PRIMARY_EXPLORER_TAB_ID, 'Primary Workspace');
    const nextTab = useExplorerStore.getState().createWorkspaceTab({
      sourceWorkspaceTabId: PRIMARY_EXPLORER_TAB_ID,
    });
    useExplorerStore.getState().updateWorkspaceTabTitle(nextTab.id, 'Secondary Workspace');

    await waitFor(() => {
      expect(useExplorerStore.getState().workspace.tabs).toHaveLength(2);
      expect(getWorkspaceTabStrip().textContent).toContain('Secondary Workspace');
    });

    fireEvent.click(screen.getByRole('button', { name: /secondary workspace/i }));
    await waitFor(() => {
      expect(useExplorerStore.getState().workspace.activeWorkspaceTabId).toBe(nextTab.id);
    });

    fireEvent.click(getWorkspacePaneActionsButton());
    fireEvent.click(await screen.findByRole('menuitem', { name: /duplicate workspace tab/i }));
    await waitFor(() => {
      expect(useExplorerStore.getState().workspace.tabs).toHaveLength(3);
    });

    fireEvent.click(getWorkspacePaneActionsButton());
    fireEvent.click(await screen.findByRole('menuitem', { name: /close workspace tab/i }));
    await waitFor(() => {
      expect(useExplorerStore.getState().workspace.tabs).toHaveLength(2);
    });
  });

  it('renders action-backed workspace header controls from persisted chrome overrides', async () => {
    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        appearance: {
          ...state.settings.appearance,
          activeThemeId: 'operator',
        },
        explorer: {
          ...state.settings.explorer,
          chromeLayoutOverridesByThemeId: {
            ...state.settings.explorer.chromeLayoutOverridesByThemeId,
            operator: {
              ...(state.settings.explorer.chromeLayoutOverridesByThemeId.operator ?? {}),
              default: {
                entries: [
                  {
                    controlId: 'action:workspace.sample-action',
                    surfaceId: 'workspaceHeader',
                    zone: 'end',
                    order: 10,
                    offsetPx: 64,
                  },
                ],
              },
            },
          },
        },
      },
    }));

    renderWorkspace(undefined, {
      actions: [workspaceHeaderAction],
    });

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /sample workspace action/i }),
      ).toBeInTheDocument();
    });

    const placedControl = getWorkspaceControl('action:workspace.sample-action');
    expect(placedControl).not.toBeNull();
    expect(
      placedControl?.getAttribute('data-overlay-explorer-control-zone'),
    ).toBe('end');
  });

  it('uses the layout-dynamics canvas for the workspace header during customize mode', async () => {
    useExplorerStore.getState().openChromeEditSession({
      themeId: 'operator',
      layoutId: 'default',
      initialOverride: {
        entries: [],
      },
    });

    const { container } = renderWorkspace();

    await waitFor(() => {
      expect(
        container.querySelector(
          '[data-layout-dynamics-surface="explorerToolbar"]',
        ),
      ).not.toBeNull();
    });
  });
});
