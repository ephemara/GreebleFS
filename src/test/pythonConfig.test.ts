import { describe, expect, it } from 'vitest';
import {
  buildManagedPythonReplCommand,
  createPythonRuntimeConfig,
  formatCommandOutput,
  parseMultilineValues,
  pythonQuickPackagePresets,
  pythonSidecarActionCatalog,
} from '../config/python';

describe('python config helpers', () => {
  it('normalizes blank runtime settings to nullable config values', () => {
    const config = createPythonRuntimeConfig({
      preferredInterpreterPath: '  ',
      runtimeRoot: '',
      bootstrapPackages: '  ',
      autoUpgradePip: true,
      createBoilerplate: true,
    });

    expect(config.preferredInterpreterPath).toBeNull();
    expect(config.runtimeRoot).toBeNull();
    expect(config.bootstrapPackages).toBeNull();
    expect(config.autoUpgradePip).toBe(true);
    expect(config.createBoilerplate).toBe(true);
  });

  it('splits multiline values and removes blank lines', () => {
    expect(parseMultilineValues('\nalpha\n\nbeta\r\ngamma\n')).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('formats command output for the console', () => {
    const output = formatCommandOutput({
      command: 'python hello.py',
      workingDirectory: 'M:\\OverlayTerm',
      exitCode: 0,
      success: true,
      stdout: 'ready',
      stderr: '',
    });

    expect(output).toContain('$ python hello.py');
    expect(output).toContain('ready');
  });

  it('builds a managed Python REPL command for PowerShell shells', () => {
    expect(buildManagedPythonReplCommand(
      'C:\\Python Runtime\\env\\Scripts\\python.exe',
      'powershell.exe',
      'windows',
    )).toBe("& 'C:\\Python Runtime\\env\\Scripts\\python.exe'");
  });

  it('builds a managed Python REPL command for cmd shells', () => {
    expect(buildManagedPythonReplCommand(
      'C:\\Python Runtime\\env\\Scripts\\python.exe',
      'cmd.exe',
      'windows',
    )).toBe('"C:\\Python Runtime\\env\\Scripts\\python.exe"');
  });

  it('loads package presets and action catalog from the sidecar manifest', () => {
    expect(pythonQuickPackagePresets.map(preset => preset.id)).toContain('ml-core');
    expect(pythonQuickPackagePresets.map(preset => preset.id)).toContain('cuda-ai-indexing');
    expect(pythonSidecarActionCatalog.map(action => action.id)).toEqual([
      'runtime.summary',
      'ml.probe',
      'acceleration.cuda_probe',
      'files.scan_directory',
      'files.hash_paths',
    ]);
  });
});
