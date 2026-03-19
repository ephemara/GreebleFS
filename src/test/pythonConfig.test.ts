import { describe, expect, it } from 'vitest';
import { createPythonRuntimeConfig, formatCommandOutput, parseMultilineValues } from '../config/python';

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
});
