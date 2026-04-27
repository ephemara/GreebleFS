import { describe, expect, it, vi } from 'vitest';

const { runGoCommandMock } = vi.hoisted(() => ({
  runGoCommandMock: vi.fn(async () => ({
    runtimeId: 'go-workbench-driver',
    exitStatus: 0,
    stdout: 'ok\n',
    stderr: '',
    durationMs: 12,
    timedOut: false,
  })),
}));

vi.mock('../runtime/goRuntimeBackend', () => ({
  runGoCommand: runGoCommandMock,
}));

import {
  goWorkbenchActions,
  runGoWorkbenchAction,
} from '../runtime/goWorkbenchActions';

describe('goWorkbenchActions', () => {
  it('exposes the canonical Run/Test/Build/Fmt/REPL set', () => {
    const ids = goWorkbenchActions.map(action => action.id);
    expect(ids).toEqual([
      'go.run',
      'go.test',
      'go.build',
      'go.fmt',
      'go.openTaskConsole',
    ]);
  });

  it('forwards the action defaults plus the file path to the runtime backend', async () => {
    runGoCommandMock.mockClear();
    await runGoWorkbenchAction({
      runtimeId: 'go-workbench-driver',
      actionId: 'go.test',
      filePath: '/repo/src-go/sample/main.go',
      workingDirectory: '/repo/src-go/sample',
    });
    expect(runGoCommandMock).toHaveBeenCalledTimes(1);
    expect(runGoCommandMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        runtimeId: 'go-workbench-driver',
        args: ['test', '/repo/src-go/sample/main.go'],
        workingDirectory: '/repo/src-go/sample',
      }),
    );
  });

  it('rejects unknown action ids', async () => {
    await expect(
      runGoWorkbenchAction({
        runtimeId: 'go-workbench-driver',
        actionId: 'go.unknown' as never,
        filePath: 'main.go',
      }),
    ).rejects.toThrow(/Unknown Go workbench action/);
  });
});
