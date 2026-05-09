import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { CSSProperties } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ExplorerWorkflowModal } from '../components/explorer/ExplorerWorkflowModal';
import type { ExplorerWorkflowSession } from '../components/explorer/explorerWorkflowContracts';

function createWorkflowSession(
  overrides: Partial<ExplorerWorkflowSession> = {},
): ExplorerWorkflowSession {
  return {
    id: 'workflow-session',
    definition: {
      id: 'builtin.test-workflow',
      title: 'Test Workflow',
      description: 'Workflow description',
      contexts: ['background'],
      defaultSize: 'md',
    },
    launch: {
      workflowId: 'builtin.test-workflow',
      source: 'builtin',
    },
    title: 'Test Workflow',
    size: 'md',
    busy: false,
    status: {
      label: 'Ready',
      tone: 'neutral',
    },
    footerActions: [
      {
        id: 'confirm',
        label: 'Confirm',
        tone: 'accent',
        onSelect: () => undefined,
      },
    ],
    openedAt: 1,
    ...overrides,
  };
}

describe('ExplorerWorkflowModal', () => {
  it('copies scoped explorer theme variables into the modal portal', async () => {
    const onRequestClose = vi.fn();
    const explorerScopeStyle = {
      '--overlay-explorer-modal-surface': 'rgb(1, 2, 3)',
      '--overlay-text-primary': 'rgb(4, 5, 6)',
    } as CSSProperties;

    render(
      <div
        data-overlay-explorer
        data-testid="explorer-scope"
        style={explorerScopeStyle}
      >
        <ExplorerWorkflowModal
          session={createWorkflowSession()}
          onRequestClose={onRequestClose}
        >
          <div>Workflow body</div>
        </ExplorerWorkflowModal>
      </div>,
    );

    await screen.findByRole('dialog');
    expect(
      screen.getByRole('presentation', { hidden: true }).getAttribute('style'),
    ).toContain(
      '--overlay-explorer-modal-surface: rgb(1, 2, 3)',
    );
  });

  it('renders the shared workflow shell and honors normal dismiss actions', async () => {
    const onRequestClose = vi.fn();
    const { unmount } = render(
      <ExplorerWorkflowModal
        session={createWorkflowSession()}
        onRequestClose={onRequestClose}
      >
        <div>Workflow body</div>
      </ExplorerWorkflowModal>,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Workflow description')).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByText('Workflow body')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Close workflow' }),
      ).toHaveFocus(),
    );

    fireEvent.mouseDown(screen.getByRole('presentation', { hidden: true }));
    expect(onRequestClose).toHaveBeenCalledTimes(1);

    unmount();
    onRequestClose.mockClear();

    render(
      <ExplorerWorkflowModal
        session={createWorkflowSession()}
        onRequestClose={onRequestClose}
      >
        <div>Workflow body</div>
      </ExplorerWorkflowModal>,
    );

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Close workflow' }),
      ).toHaveFocus(),
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onRequestClose).toHaveBeenCalledTimes(1);
  });

  it('suppresses dismiss actions while the workflow session is busy', () => {
    const onRequestClose = vi.fn();
    render(
      <ExplorerWorkflowModal
        session={createWorkflowSession({
          busy: true,
          status: {
            label: 'Working',
            tone: 'warning',
          },
        })}
        onRequestClose={onRequestClose}
      >
        <div>Busy workflow</div>
      </ExplorerWorkflowModal>,
    );

    const closeButton = screen.getByRole('button', { name: 'Close workflow' });
    expect(closeButton).toBeDisabled();

    fireEvent.click(closeButton);
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.mouseDown(screen.getByRole('presentation', { hidden: true }));

    expect(onRequestClose).not.toHaveBeenCalled();
    expect(screen.getByText('Working')).toBeInTheDocument();
  });
});
