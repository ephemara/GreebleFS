import { beforeEach, describe, expect, it, vi } from 'vitest';

const { callRuntimeActionMock } = vi.hoisted(() => ({
  callRuntimeActionMock: vi.fn(),
}));

vi.mock('../runtime/externalRuntimeBackend', () => ({
  callRuntimeAction: callRuntimeActionMock,
}));

import {
  activateVsCodeExtension,
  executeVsCodeCommand,
  getVsCodeTreeView,
  refreshVsCodeTreeView,
  VSCODE_BRIDGE_RUNTIME_ID,
  type VsCodeBridgeExtensionMetadata,
} from '../runtime/vscodeBridgeBackend';

const extensionMetadata: VsCodeBridgeExtensionMetadata = {
  extensionId: 'eamodio.gitlens',
  extensionName: 'GitLens',
  extensionRootPath: '/cache/gitlens',
  packageJsonPath: '/cache/gitlens/package.json',
  originalPath: '/usr/plugins/gitlens.vsix',
  main: './dist/extension.js',
  activationEvents: ['onView:gitlens.repositories'],
};

describe('vscodeBridgeBackend', () => {
  beforeEach(() => {
    callRuntimeActionMock.mockReset();
  });

  it('routes extension activation through the builtin VS Code bridge runtime', async () => {
    callRuntimeActionMock.mockResolvedValueOnce({
      result: { activated: true },
      resultJson: '{"activated":true}',
    });

    await expect(
      activateVsCodeExtension(extensionMetadata, 'onView:gitlens.repositories'),
    ).resolves.toEqual({ activated: true });
    expect(callRuntimeActionMock).toHaveBeenCalledWith({
      runtimeId: VSCODE_BRIDGE_RUNTIME_ID,
      actionId: 'vscode.activateExtension',
      payload: {
        ...extensionMetadata,
        activationEvent: 'onView:gitlens.repositories',
      },
      executionContext: null,
    });
  });

  it('routes VS Code command execution with command args intact', async () => {
    callRuntimeActionMock.mockResolvedValueOnce({
      result: { opened: true },
      resultJson: '{"opened":true}',
    });

    await expect(
      executeVsCodeCommand(
        { ...extensionMetadata, commandId: 'gitlens.open' },
        ['repo-a'],
      ),
    ).resolves.toEqual({ opened: true });
    expect(callRuntimeActionMock).toHaveBeenCalledWith({
      runtimeId: VSCODE_BRIDGE_RUNTIME_ID,
      actionId: 'vscode.executeCommand',
      payload: {
        ...extensionMetadata,
        commandId: 'gitlens.open',
        args: ['repo-a'],
      },
      executionContext: null,
    });
  });

  it('routes tree view reads and refreshes to the bridge runtime', async () => {
    callRuntimeActionMock
      .mockResolvedValueOnce({
        result: {
          extensionId: 'eamodio.gitlens',
          viewId: 'gitlens.repositories',
          items: [],
        },
        resultJson: '{"items":[]}',
      })
      .mockResolvedValueOnce({
        result: { refreshed: true },
        resultJson: '{"refreshed":true}',
      });

    await expect(
      getVsCodeTreeView({
        ...extensionMetadata,
        viewId: 'gitlens.repositories',
        parentHandle: 'root-1',
        activationEvent: 'onView:gitlens.repositories',
      }),
    ).resolves.toEqual({
      extensionId: 'eamodio.gitlens',
      viewId: 'gitlens.repositories',
      items: [],
    });
    await expect(
      refreshVsCodeTreeView({
        ...extensionMetadata,
        viewId: 'gitlens.repositories',
      }),
    ).resolves.toEqual({ refreshed: true });

    expect(callRuntimeActionMock).toHaveBeenNthCalledWith(1, {
      runtimeId: VSCODE_BRIDGE_RUNTIME_ID,
      actionId: 'vscode.getTreeView',
      payload: {
        ...extensionMetadata,
        viewId: 'gitlens.repositories',
        parentHandle: 'root-1',
        activationEvent: 'onView:gitlens.repositories',
      },
      executionContext: null,
    });
    expect(callRuntimeActionMock).toHaveBeenNthCalledWith(2, {
      runtimeId: VSCODE_BRIDGE_RUNTIME_ID,
      actionId: 'vscode.refreshTreeView',
      payload: {
        ...extensionMetadata,
        viewId: 'gitlens.repositories',
      },
      executionContext: null,
    });
  });
});
