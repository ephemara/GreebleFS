import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createGoSidecarActionRunnerMock, runnerCalls, runnerResultOverrides } =
  vi.hoisted(() => ({
    runnerCalls: [] as Array<{
      runtimeId: string;
      actionId: string;
      payload: unknown;
    }>,
    runnerResultOverrides: new Map<string, unknown>(),
    createGoSidecarActionRunnerMock: vi.fn(
      (runtimeId: string, actionId: string) => {
        return async (payload?: unknown) => {
          runnerCalls.push({
            runtimeId,
            actionId,
            payload: payload ?? null,
          });
          const hasOverride = runnerResultOverrides.has(actionId);
          const result = hasOverride
            ? runnerResultOverrides.get(actionId)
            : {
                runtimeId,
                actionId,
                payload: payload ?? null,
              };
          if (hasOverride) {
            runnerResultOverrides.delete(actionId);
          }
          return {
            runtimeId,
            actionId,
            resultJson: JSON.stringify(result),
            result,
          };
        };
      },
    ),
  }));

vi.mock('../runtime/goRuntimeBackend', () => ({
  createGoSidecarActionRunner: createGoSidecarActionRunnerMock,
}));

import {
  EXPLORER_POLICY_SERVICE_RUNTIME_ID,
  bootstrapExplorerPolicySession,
  navigateExplorerPolicySession,
  resolveExplorerEntryOpenWithPolicy,
} from '../runtime/goExplorerPolicyService';

describe('goExplorerPolicyService', () => {
  beforeEach(() => {
    runnerCalls.length = 0;
    runnerResultOverrides.clear();
  });

  it('binds all explorer policy actions to the dedicated runtime id', () => {
    expect(createGoSidecarActionRunnerMock).toHaveBeenCalledTimes(3);
    expect(createGoSidecarActionRunnerMock).toHaveBeenNthCalledWith(
      1,
      EXPLORER_POLICY_SERVICE_RUNTIME_ID,
      'explorer.session.bootstrap',
    );
    expect(createGoSidecarActionRunnerMock).toHaveBeenNthCalledWith(
      2,
      EXPLORER_POLICY_SERVICE_RUNTIME_ID,
      'explorer.session.navigate',
    );
    expect(createGoSidecarActionRunnerMock).toHaveBeenNthCalledWith(
      3,
      EXPLORER_POLICY_SERVICE_RUNTIME_ID,
      'explorer.entry.resolve_open',
    );
  });

  it('forwards bootstrap payloads through the Go sidecar action runner', async () => {
    const result = await bootstrapExplorerPolicySession({
      sessionId: 'pane-1',
      session: {
        currentPath: '/repo',
        history: ['/'],
        historyIdx: 0,
      },
    });

    expect(result).toEqual({
      runtimeId: EXPLORER_POLICY_SERVICE_RUNTIME_ID,
      actionId: 'explorer.session.bootstrap',
      payload: {
        sessionId: 'pane-1',
        session: {
          currentPath: '/repo',
          history: ['/'],
          historyIdx: 0,
        },
      },
    });
  });

  it('preserves explicit historyIndex overrides for back/forward navigation', async () => {
    const result = await navigateExplorerPolicySession({
      sessionId: 'pane-1',
      path: '/repo/src',
      pushHistory: false,
      historyIndex: 2,
      showHidden: true,
    });

    expect(result).toEqual({
      runtimeId: EXPLORER_POLICY_SERVICE_RUNTIME_ID,
      actionId: 'explorer.session.navigate',
      payload: {
        sessionId: 'pane-1',
        path: '/repo/src',
        pushHistory: false,
        historyIndex: 2,
        showHidden: true,
      },
    });
  });

  it('normalizes malformed sidecar session snapshots before returning them', async () => {
    runnerResultOverrides.set('explorer.session.navigate', {
      snapshot: {
        currentPath: '/repo/src',
        history: null,
        historyIdx: 99,
      },
      listing: null,
      isHome: false,
      clearSelection: true,
    });

    const result = await navigateExplorerPolicySession({
      sessionId: 'pane-1',
      path: '/repo/src',
      pushHistory: true,
      showHidden: false,
    });

    expect(result.snapshot).toEqual({
      currentPath: '/repo/src',
      history: ['/repo/src'],
      historyIdx: 0,
    });
  });

  it('routes open-entry policy through the dedicated resolver action', async () => {
    const result = await resolveExplorerEntryOpenWithPolicy({
      sessionId: 'pane-1',
      previewEnabled: true,
      compactDock: false,
      showHidden: false,
      entry: {
        name: 'notes.txt',
        path: '/repo/notes.txt',
        is_dir: false,
        size: 12,
        modified: 1,
        extension: 'txt',
        is_hidden: false,
        is_symlink: false,
        entityId: 'entity-1',
        identityKind: 'native',
        contentRevision: 'rev-1',
      },
    });

    expect(result).toEqual({
      runtimeId: EXPLORER_POLICY_SERVICE_RUNTIME_ID,
      actionId: 'explorer.entry.resolve_open',
      payload: {
        sessionId: 'pane-1',
        previewEnabled: true,
        compactDock: false,
        showHidden: false,
        entry: {
          name: 'notes.txt',
          path: '/repo/notes.txt',
          is_dir: false,
          size: 12,
          modified: 1,
          extension: 'txt',
          is_hidden: false,
          is_symlink: false,
          entityId: 'entity-1',
          identityKind: 'native',
          contentRevision: 'rev-1',
        },
      },
    });
  });
});
