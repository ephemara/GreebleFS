import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeThemeDefinition, resolveOverlayAppearance } from '../config/appearance';
import { defaultExplorerRailSnapshot } from '../components/explorer/explorerRailState';
import {
  PRIMARY_EXPLORER_INSTANCE_ID,
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

  it('renders without triggering a snapshot instability warning', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { container } = render(
      <ExplorerWorkspace
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

    expect(screen.getByTestId('file-explorer-primary')).toBeInTheDocument();
    expect(getRenderedFileExplorerProps(PRIMARY_EXPLORER_INSTANCE_ID).workspacePaneCount).toBe(1);
    const explorerPane = container.querySelector('[data-testid="file-explorer-primary"]')?.parentElement as HTMLDivElement | null;
    expect(explorerPane).not.toBeNull();
    expect(explorerPane?.style.height).toBe('100%');
    expect(explorerPane?.style.display).toBe('flex');
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
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

    render(
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
        onOpenInTerminal={() => undefined}
        onAddBookmark={() => undefined}
      />,
    );

    expect(getWorkspaceControl('workspacePaneActionsMenu')?.getAttribute('data-overlay-explorer-control-zone')).toBe('end');
  });

  it('routes commander sync, copy, and target refresh through the workspace/file-explorer bridge', async () => {
    render(
      <ExplorerWorkspace
        theme={{
          accent: '#8ab4f8',
          bg: '#0f1115',
          bgPanel: '#151923',
          text: '#f4f7fb',
          border: '#2a2f3a',
          textMuted: '#9aa4b2',
        }}
        onOpenInTerminal={() => undefined}
        onAddBookmark={() => undefined}
      />,
    );

    fireEvent.click(getWorkspaceLayoutButton('2-Up'));
    await waitFor(() => {
      expect(renderedFileExplorerPropsByInstanceId.has(PRIMARY_EXPLORER_INSTANCE_ID)).toBe(true);
      expect(renderedFileExplorerPropsByInstanceId.size).toBe(2);
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

    const syncButton = within(paneActionsMenu).getByRole('menuitem', { name: /sync target pane/i });
    const copyButton = within(paneActionsMenu).getByRole('menuitem', { name: /copy selection to pane/i });
    expect(syncButton).toBeEnabled();
    expect(copyButton).toBeEnabled();

    fireEvent.click(syncButton);
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

    fireEvent.click(getWorkspaceButton('workspacePaneActionsMenu') as HTMLButtonElement);
    fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: /linked navigation/i }));
    emitRuntimeSnapshot(PRIMARY_EXPLORER_INSTANCE_ID, {
      currentPath: '/workspace/source/materials',
      currentPathIsCloud: false,
      selectedEntries: [
        {
          path: '/workspace/source/materials/brick.png',
          name: 'brick.png',
          is_dir: false,
        },
      ],
    });

    await waitFor(() => {
      expect(getRenderedFileExplorerProps(targetInstanceId as string).externalNavigationRequest).toMatchObject({
        path: '/workspace/source/materials',
      });
    });

    emitRuntimeSnapshot(PRIMARY_EXPLORER_INSTANCE_ID, {
      currentPath: '/workspace/source/materials',
      currentPathIsCloud: false,
      selectedEntries: [],
    });

    fireEvent.click(getWorkspaceButton('workspacePaneActionsMenu') as HTMLButtonElement);
    expect(await screen.findByText('P2 · destination')).toBeInTheDocument();
  });

  it('switches the shared tab strip with the focused pane and removes pane-header copy', async () => {
    render(
      <ExplorerWorkspace
        theme={{
          accent: '#8ab4f8',
          bg: '#0f1115',
          bgPanel: '#151923',
          text: '#f4f7fb',
          border: '#2a2f3a',
          textMuted: '#9aa4b2',
        }}
        onOpenInTerminal={() => undefined}
        onAddBookmark={() => undefined}
      />,
    );

    fireEvent.click(getWorkspaceLayoutButton('2-Up'));
    await waitFor(() => {
      expect(renderedFileExplorerPropsByInstanceId.size).toBe(2);
    });

    useExplorerStore.getState().createWorkspaceTab({
      pane: 'pane-1',
      title: 'Alpha Pane',
      activate: false,
    });
    useExplorerStore.getState().createWorkspaceTab({
      pane: 'pane-2',
      title: 'Beta Pane',
      activate: false,
    });

    await waitFor(() => {
      expect(getWorkspaceControl('workspaceTabs')?.textContent).toContain('Alpha Pane');
      expect(getWorkspaceControl('workspaceTabs')?.textContent).not.toContain('Beta Pane');
    });

    const paneSwitcher = getWorkspaceControl('workspacePaneCounts');
    expect(paneSwitcher).not.toBeNull();
    expect(getWorkspaceControl('workspacePaneActionsMenu')).not.toBeNull();

    fireEvent.click(within(paneSwitcher as HTMLElement).getByTitle('Focus Pane 2'));
    await waitFor(() => {
      expect(getWorkspaceControl('workspaceTabs')?.textContent).toContain('Beta Pane');
      expect(getWorkspaceControl('workspaceTabs')?.textContent).not.toContain('Alpha Pane');
    });

    expect(screen.queryByText(/^Pane 1$/)).toBeNull();
    expect(screen.queryByText(/^Focused$/)).toBeNull();
  });

  it('keeps single-pane mode one click away through direct workspace layout buttons', async () => {
    render(
      <ExplorerWorkspace
        theme={{
          accent: '#8ab4f8',
          bg: '#0f1115',
          bgPanel: '#151923',
          text: '#f4f7fb',
          border: '#2a2f3a',
          textMuted: '#9aa4b2',
        }}
        onOpenInTerminal={() => undefined}
        onAddBookmark={() => undefined}
      />,
    );

    fireEvent.click(getWorkspaceLayoutButton('2-Up'));
    await waitFor(() => {
      expect(useExplorerStore.getState().workspace.layoutMode).toBe('split');
      expect(renderedFileExplorerPropsByInstanceId.size).toBe(2);
      expect(getRenderedFileExplorerProps(PRIMARY_EXPLORER_INSTANCE_ID).workspacePaneCount).toBe(2);
    });

    fireEvent.click(getWorkspaceLayoutButton('1-Up'));
    await waitFor(() => {
      expect(useExplorerStore.getState().workspace.layoutMode).toBe('single');
      expect(getWorkspaceLayoutButton('1-Up')).toHaveAttribute('aria-pressed', 'true');
    });
  });
});
