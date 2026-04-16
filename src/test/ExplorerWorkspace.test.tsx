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

    expect(getWorkspaceControl('workspaceMode')?.getAttribute('data-overlay-explorer-control-zone')).toBe('end');
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

    await waitFor(() => {
      expect(getWorkspaceControl('workspaceCommanderSummary')?.textContent).toContain('1 selected -> P2 · destination');
    });

    const syncButton = getWorkspaceButton('workspaceSyncPath');
    const copyButton = getWorkspaceButton('workspaceCopyToPane');
    const linkButton = getWorkspaceButton('workspaceLinkNavigation');

    expect(syncButton).not.toBeNull();
    expect(copyButton).not.toBeNull();
    expect(linkButton).not.toBeNull();
    expect(syncButton?.disabled).toBe(false);
    expect(copyButton?.disabled).toBe(false);

    fireEvent.click(syncButton as HTMLButtonElement);
    await waitFor(() => {
      expect(getRenderedFileExplorerProps(targetInstanceId as string).externalNavigationRequest).toMatchObject({
        path: '/workspace/source',
      });
    });

    fireEvent.click(copyButton as HTMLButtonElement);
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

    fireEvent.click(linkButton as HTMLButtonElement);
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
    });

    fireEvent.click(getWorkspaceLayoutButton('1-Up'));
    await waitFor(() => {
      expect(useExplorerStore.getState().workspace.layoutMode).toBe('single');
      expect(getWorkspaceLayoutButton('1-Up')).toHaveAttribute('aria-pressed', 'true');
    });
  });
});
