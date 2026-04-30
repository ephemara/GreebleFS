import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ExplorerDuplicateScan } from '../runtime/explorerBackend';
import {
  BatchRenameWorkflowView,
  DuplicateFinderWorkflowView,
} from '../components/explorer/ExplorerBuiltInWorkflowViews';
import type {
  ExplorerWorkflowHostControls,
  ExplorerWorkflowSession,
} from '../components/explorer/explorerWorkflowContracts';

function createWorkflowHost(): ExplorerWorkflowHostControls {
  return {
    close: vi.fn(async () => undefined),
    setTitle: vi.fn(),
    setStatus: vi.fn(),
    setBusy: vi.fn(),
    setSize: vi.fn(),
    setFooterActions: vi.fn(),
    setCloseGuard: vi.fn(),
  };
}

function createWorkflowSession(
  overrides: Partial<ExplorerWorkflowSession> = {},
): ExplorerWorkflowSession {
  return {
    id: 'workflow-session',
    definition: {
      id: 'builtin.workflow',
      title: 'Workflow Surface',
      description: 'Workflow description',
      contexts: ['background'],
      defaultSize: 'md',
    },
    launch: {
      workflowId: 'builtin.workflow',
      source: 'builtin',
    },
    title: 'Workflow Surface',
    size: 'md',
    busy: false,
    status: null,
    footerActions: [],
    openedAt: 1,
    ...overrides,
  };
}

function getLatestFooterActions(host: ExplorerWorkflowHostControls) {
  const footerCalls = vi.mocked(host.setFooterActions).mock.calls;
  const latestActions =
    footerCalls.length > 0 ? footerCalls[footerCalls.length - 1]?.[0] : null;
  if (!latestActions) {
    throw new Error('Workflow footer actions were never registered.');
  }
  return latestActions;
}

describe('ExplorerBuiltInWorkflowViews', () => {
  it('configures batch rename workflow chrome and confirms ready previews', async () => {
    const host = createWorkflowHost();
    const onChange = vi.fn();
    const onConfirm = vi.fn(async () => undefined);

    render(
      <BatchRenameWorkflowView
        session={createWorkflowSession({
          title: 'Batch Rename',
          definition: {
            id: 'builtin.batchRename',
            title: 'Batch Rename',
            description: 'Rename many files at once.',
            contexts: ['background', 'entry', 'multi-select'],
            defaultSize: 'lg',
          },
          launch: {
            workflowId: 'builtin.batchRename',
            source: 'builtin',
          },
        })}
        launch={{ workflowId: 'builtin.batchRename', source: 'builtin' }}
        host={host}
        executionContext={null}
        state={{
          mode: 'literal',
          findText: 'hero',
          replaceText: 'shot',
          prefix: '',
          suffix: '',
          startingNumber: 1,
          padding: 2,
        }}
        previewRows={[
          {
            sourcePath: 'C:/shots/hero.png',
            currentName: 'hero.png',
            nextName: 'shot01.png',
            destinationPath: 'C:/shots/shot01.png',
            collision: false,
            validationError: null,
          },
        ]}
        targetCount={1}
        onChange={onChange}
        onConfirm={onConfirm}
      />,
    );

    await waitFor(() => expect(host.setFooterActions).toHaveBeenCalled());

    expect(host.setTitle).toHaveBeenLastCalledWith('Batch Rename');
    expect(host.setSize).toHaveBeenLastCalledWith('lg');
    expect(host.setBusy).toHaveBeenLastCalledWith(false);
    expect(host.setCloseGuard).toHaveBeenLastCalledWith(null);
    expect(host.setStatus).toHaveBeenLastCalledWith({
      label: '1 rename preview ready.',
      tone: 'neutral',
    });
    expect(screen.getByText('hero.png')).toBeInTheDocument();
    expect(screen.getByText('shot01.png')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Regex Off' }));
    expect(onChange).toHaveBeenCalledWith({ mode: 'regex' });

    const footerActions = getLatestFooterActions(host);
    expect(footerActions[0]).toMatchObject({
      id: 'cancel',
      label: 'Cancel',
    });
    expect(footerActions[1]).toMatchObject({
      id: 'confirm',
      label: 'Rename',
      tone: 'accent',
      disabled: false,
    });

    await act(async () => {
      await footerActions[1]?.onSelect();
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('marks batch rename collisions and validation failures as non-committable', async () => {
    const host = createWorkflowHost();

    render(
      <BatchRenameWorkflowView
        session={createWorkflowSession({
          title: 'Batch Rename',
          definition: {
            id: 'builtin.batchRename',
            title: 'Batch Rename',
            description: 'Rename many files at once.',
            contexts: ['background', 'entry', 'multi-select'],
            defaultSize: 'lg',
          },
          launch: {
            workflowId: 'builtin.batchRename',
            source: 'builtin',
          },
        })}
        launch={{ workflowId: 'builtin.batchRename', source: 'builtin' }}
        host={host}
        executionContext={null}
        state={{
          mode: 'regex',
          findText: '[(',
          replaceText: 'shot',
          prefix: '',
          suffix: '',
          startingNumber: 1,
          padding: 2,
        }}
        previewRows={[
          {
            sourcePath: 'C:/shots/hero.png',
            currentName: 'hero.png',
            nextName: 'hero.png',
            destinationPath: 'C:/shots/hero.png',
            collision: true,
            validationError: 'Invalid regex pattern: Unterminated character class',
          },
        ]}
        targetCount={1}
        onChange={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    await waitFor(() => expect(host.setFooterActions).toHaveBeenCalled());

    expect(host.setStatus).toHaveBeenLastCalledWith({
      label: 'Invalid regex pattern: Unterminated character class',
      tone: 'danger',
    });
    expect(
      screen.getAllByText(
        'Invalid regex pattern: Unterminated character class',
      ),
    ).toHaveLength(2);

    const footerActions = getLatestFooterActions(host);
    expect(footerActions[1]).toMatchObject({
      id: 'confirm',
      disabled: true,
    });
  });

  it('boots duplicate finder into scan mode and wires the cancel action through the host footer', async () => {
    const host = createWorkflowHost();
    const onStartScan = vi.fn(async () => undefined);
    const onCancelScan = vi.fn(async () => undefined);

    render(
      <DuplicateFinderWorkflowView
        session={createWorkflowSession({
          title: 'Duplicate Finder',
          definition: {
            id: 'builtin.duplicateFinder',
            title: 'Duplicate Finder',
            description: 'Scan for duplicate files.',
            contexts: ['background', 'entry'],
            defaultSize: 'xl',
          },
          launch: {
            workflowId: 'builtin.duplicateFinder',
            source: 'builtin',
          },
        })}
        launch={{ workflowId: 'builtin.duplicateFinder', source: 'builtin' }}
        host={host}
        executionContext={null}
        state={{
          scanId: 'scan-1',
          status: null,
          loading: true,
        }}
        formatSize={(value) => `${value} B`}
        onStartScan={onStartScan}
        onCancelScan={onCancelScan}
        onSelectPath={vi.fn()}
        onRevealPath={vi.fn()}
        onTrashPath={vi.fn()}
        onDeletePath={vi.fn()}
      />,
    );

    await waitFor(() => expect(onStartScan).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(host.setFooterActions).toHaveBeenCalled());

    expect(host.setTitle).toHaveBeenLastCalledWith('Duplicate Finder');
    expect(host.setSize).toHaveBeenLastCalledWith('xl');
    expect(host.setBusy).toHaveBeenLastCalledWith(true);
    expect(host.setStatus).toHaveBeenLastCalledWith({
      label: 'Scanning current folder tree…',
      tone: 'neutral',
    });

    const footerActions = getLatestFooterActions(host);
    expect(footerActions).toHaveLength(1);
    expect(footerActions[0]).toMatchObject({
      id: 'cancel-scan',
      label: 'Cancel Scan',
    });

    await act(async () => {
      await footerActions[0]?.onSelect();
    });
    expect(onCancelScan).toHaveBeenCalledTimes(1);
  });

  it('renders duplicate results and routes per-entry actions back into explorer callbacks', async () => {
    const host = createWorkflowHost();
    const onSelectPath = vi.fn();
    const onRevealPath = vi.fn();
    const onTrashPath = vi.fn();
    const onDeletePath = vi.fn();

    const status: ExplorerDuplicateScan = {
      scanId: 'scan-2',
      rootPath: 'C:/shots',
      scannedFileCount: 4,
      candidateFileCount: 4,
      completed: true,
      cancelled: false,
      error: null,
      groups: [
        {
          contentHash: 'abc123',
          fileSize: 1024,
          entries: [
            {
              path: 'C:/shots/hero.png',
              name: 'hero.png',
            },
          ],
        },
      ],
    };

    render(
      <DuplicateFinderWorkflowView
        session={createWorkflowSession({
          title: 'Duplicate Finder',
          definition: {
            id: 'builtin.duplicateFinder',
            title: 'Duplicate Finder',
            description: 'Scan for duplicate files.',
            contexts: ['background', 'entry'],
            defaultSize: 'xl',
          },
          launch: {
            workflowId: 'builtin.duplicateFinder',
            source: 'builtin',
          },
        })}
        launch={{ workflowId: 'builtin.duplicateFinder', source: 'builtin' }}
        host={host}
        executionContext={null}
        state={{
          scanId: 'scan-2',
          status,
          loading: false,
        }}
        formatSize={(value) => `${value} B`}
        onStartScan={vi.fn(async () => undefined)}
        onCancelScan={vi.fn(async () => undefined)}
        onSelectPath={onSelectPath}
        onRevealPath={onRevealPath}
        onTrashPath={onTrashPath}
        onDeletePath={onDeletePath}
      />,
    );

    await waitFor(() => expect(host.setFooterActions).toHaveBeenCalled());

    expect(host.setBusy).toHaveBeenLastCalledWith(false);
    expect(host.setStatus).toHaveBeenLastCalledWith({
      label: '1 duplicate group, 4 files scanned.',
      tone: 'neutral',
    });
    expect(screen.getByText('hero.png')).toBeInTheDocument();
    expect(screen.getByText('1024 B')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reveal' }));
    fireEvent.click(screen.getByRole('button', { name: 'Trash' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onSelectPath).toHaveBeenCalledWith('C:/shots/hero.png');
    expect(onRevealPath).toHaveBeenCalledWith('C:/shots/hero.png');
    expect(onTrashPath).toHaveBeenCalledWith('C:/shots/hero.png');
    expect(onDeletePath).toHaveBeenCalledWith('C:/shots/hero.png');

    const footerActions = getLatestFooterActions(host);
    expect(footerActions[0]).toMatchObject({
      id: 'close',
      label: 'Close',
    });

    await act(async () => {
      await footerActions[0]?.onSelect();
    });
    expect(host.close).toHaveBeenCalledTimes(1);
  });
});
