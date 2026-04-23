import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeThemeDefinition, resolveOverlayAppearance } from '../config/appearance';
import { defaultExplorerRailSnapshot } from '../components/explorer/explorerRailState';
import {
  PRIMARY_EXPLORER_INSTANCE_ID,
  PRIMARY_EXPLORER_TAB_ID,
  defaultExplorerSession,
  defaultExplorerWorkspace,
  useExplorerStore,
} from '../store/explorerStore';
import type {
  ExplorerWorkspaceRuntimeSnapshot,
  ExplorerWorkspaceSelectionTransferResult,
} from '../components/FileExplorer';

const renderedFileExplorerPropsByInstanceId = new Map<string, Record<string, unknown>>();

vi.mock('../components/FileExplorer', () => ({
  FileExplorer: (props: Record<string, unknown>) => {
    const instanceId = typeof props.instanceId === 'string' ? props.instanceId : PRIMARY_EXPLORER_INSTANCE_ID;
    renderedFileExplorerPropsByInstanceId.set(instanceId, props);
    return <div data-testid={`file-explorer-${instanceId}`} />;
  },
}));

import { ExplorerWorkspace } from '../components/explorer/ExplorerWorkspace';

function getWorkspaceControl(controlId: string) {
  return document.querySelector(`[data-overlay-explorer-control="${controlId}"]`) as HTMLElement | null;
}

function getWorkspaceButton(controlId: string): HTMLButtonElement | null {
  const control = getWorkspaceControl(controlId);
  if (!control) {
    return null;
  }
  return control instanceof HTMLButtonElement
    ? control
    : (control.querySelector('button') as HTMLButtonElement | null);
}

function getWorkspaceLayoutButton(label: string): HTMLButtonElement {
  const control = getWorkspaceControl('workspaceSplitToggle');
  if (!control) {
    throw new Error('Workspace layout control not found');
  }
  return within(control).getByRole('button', { name: label });
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

function renderWorkspace(appearance?: ReturnType<typeof resolveOverlayAppearance>) {
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
    />,
  );
}

describe('ExplorerWorkspace', () => {
  beforeEach(() => {
    renderedFileExplorerPropsByInstanceId.clear();
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
    });
  });

  afterEach(() => {
    renderedFileExplorerPropsByInstanceId.clear();
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
    });
  });

  it('renders the primary workspace pane', async () => {
    const { container } = renderWorkspace();

    expect(screen.getByTestId('file-explorer-primary')).toBeInTheDocument();
    expect(getRenderedFileExplorerProps(PRIMARY_EXPLORER_INSTANCE_ID).workspacePaneCount).toBe(1);
    const explorerPane = container.querySelector('[data-testid="file-explorer-primary"]')?.parentElement as HTMLDivElement | null;
    expect(explorerPane).not.toBeNull();
    expect(explorerPane?.style.height).toBe('100%');
    expect(explorerPane?.style.display).toBe('flex');
  });

  it('repositions workspace header controls through chromeLayoutId', () => {
    const appearance = resolveOverlayAppearance({
      activeThemeId: 'focused-layout',
      customThemes: [
        normalizeThemeDefinition({
          id: 'focused-layout',
          name: 'Focused Layout',
          explorer: {
            defaultModeProfileId: 'focus',
          },
        }),
      ],
    });

    renderWorkspace(appearance);

    expect(getWorkspaceControl('workspacePaneActionsMenu')?.getAttribute('data-overlay-explorer-control-zone')).toBe('end');
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

    fireEvent.click(getWorkspaceButton('workspacePaneActionsMenu') as HTMLButtonElement);
    const paneActionsMenu = await screen.findByRole('menu', { name: 'Workspace pane actions' });
    expect(within(paneActionsMenu).getByText('1 selected -> P2 · destination')).toBeInTheDocument();

    fireEvent.click(within(paneActionsMenu).getByRole('menuitem', { name: /sync target pane/i }));
    await waitFor(() => {
      expect(getRenderedFileExplorerProps(targetInstanceId as string).externalNavigationRequest).toMatchObject({
        path: '/workspace/source',
      });
    });

    fireEvent.click(getWorkspaceButton('workspacePaneActionsMenu') as HTMLButtonElement);
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
      const workspaceTabs = getWorkspaceControl('workspaceTabs');
      expect(workspaceTabs?.textContent).toContain('Secondary Workspace');
      expect(within(workspaceTabs as HTMLElement).getAllByRole('button', { name: /workspace|explorer/i })).toHaveLength(2);
    });

    const paneSwitcher = getWorkspaceControl('workspacePaneCounts');
    expect(paneSwitcher).not.toBeNull();
    fireEvent.click(within(paneSwitcher as HTMLElement).getByTitle('Focus Pane 2'));

    await waitFor(() => {
      const workspaceTabs = getWorkspaceControl('workspaceTabs');
      expect(workspaceTabs?.textContent).toContain('Secondary Workspace');
      expect(within(workspaceTabs as HTMLElement).getAllByRole('button', { name: /workspace|explorer/i })).toHaveLength(2);
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
      expect(getWorkspaceControl('workspaceTabs')?.textContent).toContain('Secondary Workspace');
    });

    fireEvent.click(screen.getByRole('button', { name: /secondary workspace/i }));
    await waitFor(() => {
      expect(useExplorerStore.getState().workspace.activeWorkspaceTabId).toBe(nextTab.id);
    });

    fireEvent.click(getWorkspaceButton('workspacePaneActionsMenu') as HTMLButtonElement);
    fireEvent.click(await screen.findByRole('menuitem', { name: /duplicate workspace tab/i }));
    await waitFor(() => {
      expect(useExplorerStore.getState().workspace.tabs).toHaveLength(3);
    });

    fireEvent.click(getWorkspaceButton('workspacePaneActionsMenu') as HTMLButtonElement);
    fireEvent.click(await screen.findByRole('menuitem', { name: /close workspace tab/i }));
    await waitFor(() => {
      expect(useExplorerStore.getState().workspace.tabs).toHaveLength(2);
    });
  });
});
