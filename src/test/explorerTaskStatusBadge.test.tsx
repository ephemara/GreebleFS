import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { ExplorerTaskStatusBadge } from '../components/explorer/ExplorerTaskStatusBadge';
import {
  closeExplorerTaskCenter,
  useExplorerTaskStore,
} from '../store/explorerTaskStore';
import {
  recordExplorerActionRun,
  useExplorerActionRunStore,
} from '../store/explorerActionRunStore';

function seedActionRun() {
  recordExplorerActionRun({
    id: 'action-run-1',
    packId: 'test-pack',
    actionId: 'echo',
    actionTitle: 'Echo Workspace',
    actionDirectory: 'C:/Dev/GreebleFS/actions',
    currentLocation: 'C:/Dev/GreebleFS',
    selectedPaths: [],
    outputTarget: 'task-center',
    status: 'succeeded',
    startedAt: 1_700_000_000_000,
    finishedAt: 1_700_000_000_100,
    exitCode: 0,
    timedOut: false,
    runtimeUsed: 'shell',
    commandDisplay: 'echo ok',
    workingDirectory: 'C:/Dev/GreebleFS',
    stdout: 'ok',
    stderr: '',
    launchedInNativeTerminal: false,
  });
}

describe('ExplorerTaskStatusBadge', () => {
  beforeEach(() => {
    closeExplorerTaskCenter();
    useExplorerTaskStore.setState({
      tasks: {},
      taskOrder: [],
      subscriptionState: 'idle',
      subscriptionError: null,
      hydrationState: 'idle',
      hydrationError: null,
      isTaskCenterOpen: false,
      activeTaskCenterSurfaceId: null,
    });
    useExplorerActionRunStore.setState({
      runs: {},
      runOrder: [],
    });
  });

  it('opens the task center on a floating surface outside the clipped chrome control', async () => {
    seedActionRun();

    const rendered = render(
      <div data-overlay-explorer="true" data-testid="explorer-root">
        <div
          data-testid="clipped-status-row"
          style={{ height: 1, overflow: 'hidden' }}
        >
          <ExplorerTaskStatusBadge
            accent="cyan"
            border="rgba(255,255,255,0.18)"
            danger="red"
            muted="gray"
            text="white"
          />
        </div>
      </div>,
    );

    fireEvent.click(screen.getByRole('button', { name: /activity\s*1 action run/i }));

    const dialog = await screen.findByRole('dialog', {
      name: /explorer task center/i,
    });
    expect(dialog).toHaveTextContent('Action Runs');

    const floatingSurface = dialog.closest(
      '[data-overlay-explorer-floating-surface="true"]',
    );
    expect(floatingSurface).not.toBeNull();
    expect(screen.getByTestId("clipped-status-row")).not.toContainElement(
      floatingSurface as HTMLElement,
    );
    expect(screen.getByTestId("explorer-root")).toContainElement(
      floatingSurface as HTMLElement,
    );

    fireEvent.mouseDown(dialog);
    expect(screen.getByRole('dialog', { name: /explorer task center/i })).toBeInTheDocument();

    fireEvent.mouseDown(rendered.container);
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: /explorer task center/i }),
      ).not.toBeInTheDocument();
    });
  });

  it('keeps duplicate task badge surfaces from opening multiple task centers', async () => {
    render(
      <div data-overlay-explorer="true" data-testid="explorer-root">
        <ExplorerTaskStatusBadge
          accent="cyan"
          border="rgba(255,255,255,0.18)"
          danger="red"
          muted="gray"
          text="white"
        />
        <ExplorerTaskStatusBadge
          accent="cyan"
          border="rgba(255,255,255,0.18)"
          danger="red"
          muted="gray"
          text="white"
        />
      </div>,
    );

    const taskButtons = screen.getAllByRole('button', { name: /tasks\s*no tasks/i });
    expect(taskButtons).toHaveLength(2);

    fireEvent.click(taskButtons[1]);

    await waitFor(() => {
      expect(screen.getAllByRole('dialog', { name: /explorer task center/i })).toHaveLength(1);
    });

    fireEvent.click(taskButtons[0]);

    await waitFor(() => {
      expect(screen.getAllByRole('dialog', { name: /explorer task center/i })).toHaveLength(1);
    });
  });
});
