import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../runtime/tauriClient', () => ({
  commands: {
    pythonGetRuntimeStatus: vi.fn(),
    pythonBootstrapRuntime: vi.fn(),
    pythonInstallPackages: vi.fn(),
    pythonExecute: vi.fn(),
    pythonGetSidecarStatus: vi.fn(),
    pythonStartSidecar: vi.fn(),
    pythonStopSidecar: vi.fn(),
    pythonSidecarCall: vi.fn(),
    pythonExecuteEmbedded: vi.fn(),
  },
  unwrapTauriResult: vi.fn((value: { status?: string; data?: unknown }) =>
    value?.status === 'ok' ? value.data : value),
}));

import { commands } from '../runtime/tauriClient';
import {
  createPythonSidecarActionRunner,
  executeEmbeddedPython,
  managedPythonSidecarPackagePresets,
} from '../runtime/pythonRuntimeBackend';

const DEFAULT_RUNTIME_STATUS = {
  runtimeRoot: '/tmp/python-runtime',
  envDir: '/tmp/python-runtime/env',
  scriptsDir: '/tmp/python-runtime/scripts',
  tempDir: '/tmp/python-runtime/temp',
  logsDir: '/tmp/python-runtime/logs',
  managedPythonPath: '/tmp/python-runtime/env/bin/python',
  envExists: true,
  ready: true,
  managedPythonVersion: 'Python 3.11.9',
  managedPipVersion: 'pip 25.0',
  preferredInterpreterPath: null,
  bootstrapPackages: [],
  interpreterHint: 'Python 3.11 is preferred',
  baseInterpreter: null,
  discoveredInterpreters: [],
  boilerplate: {
    readmePath: '/tmp/python-runtime/README.md',
    requirementsPath: '/tmp/python-runtime/requirements.txt',
    packageDir: '/tmp/python-runtime/overlayterm_runtime',
    helloScriptPath: '/tmp/python-runtime/scripts/hello_runtime.py',
    probeScriptPath: '/tmp/python-runtime/scripts/onnx_probe.py',
  },
};

const DEFAULT_SIDECAR_STATUS = {
  runtimeRoot: '/tmp/python-runtime',
  workspaceRoot: '/tmp/python-runtime/src-python',
  manifestPath: '/tmp/python-runtime/src-python/greeblefs-python-sidecar.json',
  guidePath: '/tmp/python-runtime/src-python/GUIDE.md',
  logPath: '/tmp/python-runtime/logs/python-sidecar.log',
  running: true,
  pid: 4242,
  moduleName: 'greeblefs_sidecar',
  entryModule: 'greeblefs_sidecar',
  transport: 'stdio-json-lines',
  actionIds: ['runtime.summary', 'ml.probe'],
  lastError: null,
};

describe('pythonRuntimeBackend', () => {
  beforeEach(() => {
    vi.mocked(commands.pythonSidecarCall).mockReset();
    vi.mocked(commands.pythonExecuteEmbedded).mockReset();
  });

  it('decodes sidecar action JSON and forwards the typed request shape', async () => {
    vi.mocked(commands.pythonSidecarCall).mockResolvedValue({
      status: 'ok',
      data: {
        runtimeStatus: DEFAULT_RUNTIME_STATUS,
        sidecar: DEFAULT_SIDECAR_STATUS,
        requestId: 'sidecar-1',
        actionId: 'ml.probe',
        resultJson: '{"torch":{"installed":true},"onnxInstalled":true}',
      },
    });

    const runProbe = createPythonSidecarActionRunner<
      { includeCuda?: boolean },
      { torch: { installed: boolean }; onnxInstalled: boolean }
    >('ml.probe');

    const response = await runProbe(
      { includeCuda: true },
      {
        config: {
          preferredInterpreterPath: null,
          runtimeRoot: '/tmp/python-runtime',
          bootstrapPackages: null,
          autoUpgradePip: true,
          createBoilerplate: true,
        },
      },
    );

    expect(response.result).toEqual({
      torch: { installed: true },
      onnxInstalled: true,
    });
    expect(commands.pythonSidecarCall).toHaveBeenCalledWith(expect.objectContaining({
      actionId: 'ml.probe',
      payloadJson: '{"includeCuda":true}',
      startIfNeeded: true,
    }));
  });

  it('decodes embedded python JSON output', async () => {
    vi.mocked(commands.pythonExecuteEmbedded).mockResolvedValue({
      status: 'ok',
      data: {
        callableName: 'main',
        resultJson: '{"value":42}',
        pythonVersion: '3.11.9',
      },
    });

    const response = await executeEmbeddedPython<{ value: number }>({
      code: 'def main(payload): return {"value": 42}',
    });

    expect(response.result).toEqual({ value: 42 });
    expect(commands.pythonExecuteEmbedded).toHaveBeenCalledWith({
      code: 'def main(payload): return {"value": 42}',
      callableName: null,
      payloadJson: null,
    });
  });

  it('surfaces manifest-backed package presets for React callers', () => {
    expect(managedPythonSidecarPackagePresets.map(preset => preset.id)).toContain('ml-core');
  });
});
