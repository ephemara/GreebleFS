import type { RuntimePlatform } from './platform';

export interface PythonRuntimeConfig {
  preferredInterpreterPath?: string | null;
  runtimeRoot?: string | null;
  bootstrapPackages?: string | null;
  autoUpgradePip?: boolean | null;
  createBoilerplate?: boolean | null;
}

export interface PythonInterpreterDescriptor {
  id: string;
  label: string;
  command: string;
  args: string[];
  source: string;
  preferred: boolean;
  recommended: boolean;
  executable: string;
  version: string;
  major: number;
  minor: number;
  micro: number;
}

export interface PythonBoilerplateFiles {
  readmePath: string;
  requirementsPath: string;
  packageDir: string;
  helloScriptPath: string;
  probeScriptPath: string;
}

export interface PythonRuntimeStatus {
  runtimeRoot: string;
  envDir: string;
  scriptsDir: string;
  tempDir: string;
  logsDir: string;
  managedPythonPath: string;
  envExists: boolean;
  ready: boolean;
  managedPythonVersion: string | null;
  managedPipVersion: string | null;
  preferredInterpreterPath: string | null;
  bootstrapPackages: string[];
  interpreterHint: string;
  baseInterpreter: PythonInterpreterDescriptor | null;
  discoveredInterpreters: PythonInterpreterDescriptor[];
  boilerplate: PythonBoilerplateFiles;
}

export interface PythonCommandResult {
  command: string;
  workingDirectory: string;
  exitCode: number;
  success: boolean;
  stdout: string;
  stderr: string;
}

export interface PythonActionResponse {
  status: PythonRuntimeStatus;
  result: PythonCommandResult;
}

export type PythonExecutionMode = 'inline' | 'script' | 'module';

export interface PythonQuickPackagePreset {
  id: string;
  label: string;
  description: string;
  packages: string[];
}

export interface PythonExamplePreset {
  id: string;
  label: string;
  mode: PythonExecutionMode;
  entry: string;
  description: string;
}

export const pythonQuickPackagePresets: PythonQuickPackagePreset[] = [
  {
    id: 'core-data',
    label: 'Core Data',
    description: 'Base scientific stack for desktop automation and data transforms.',
    packages: ['numpy', 'pillow', 'pydantic'],
  },
  {
    id: 'onnx-stack',
    label: 'ONNX Stack',
    description: 'ONNX runtime tooling for model execution and verification.',
    packages: ['numpy', 'onnx', 'onnxruntime'],
  },
  {
    id: 'vision-stack',
    label: 'Vision',
    description: 'Image-oriented runtime for computer vision experiments.',
    packages: ['numpy', 'opencv-python', 'pillow'],
  },
];

export const pythonExamplePresets: PythonExamplePreset[] = [
  {
    id: 'inline-json',
    label: 'Inline JSON',
    mode: 'inline',
    description: 'Runs inline Python and prints structured JSON.',
    entry: [
      'import json',
      'import platform',
      '',
      'print(json.dumps({',
      '    "overlay": "python-runtime",',
      '    "platform": platform.platform(),',
      '    "status": "ok",',
      '}))',
      '',
    ].join('\n'),
  },
  {
    id: 'hello-script',
    label: 'Hello Script',
    mode: 'script',
    description: 'Runs the managed hello script generated during bootstrap.',
    entry: 'hello_runtime.py',
  },
  {
    id: 'onnx-probe',
    label: 'ONNX Probe',
    mode: 'script',
    description: 'Checks whether ONNX-related packages are available in the managed env.',
    entry: 'onnx_probe.py',
  },
];

export function parseMultilineValues(raw: string): string[] {
  return raw
    .split(/\r?\n/g)
    .map(value => value.trim())
    .filter(Boolean);
}

export function createPythonRuntimeConfig(settings: {
  preferredInterpreterPath: string;
  runtimeRoot: string;
  bootstrapPackages: string;
  autoUpgradePip: boolean;
  createBoilerplate: boolean;
}): PythonRuntimeConfig {
  return {
    preferredInterpreterPath: settings.preferredInterpreterPath.trim() || null,
    runtimeRoot: settings.runtimeRoot.trim() || null,
    bootstrapPackages: settings.bootstrapPackages.trim() || null,
    autoUpgradePip: settings.autoUpgradePip,
    createBoilerplate: settings.createBoilerplate,
  };
}

export function summarizeInterpreter(interpreter: PythonInterpreterDescriptor | null): string {
  if (!interpreter) {
    return 'No interpreter detected';
  }

  return `${interpreter.label} · ${interpreter.version}`;
}

export function formatCommandOutput(result: PythonCommandResult): string {
  return [
    `$ ${result.command}`,
    result.stdout.trim(),
    result.stderr.trim(),
  ]
    .filter(Boolean)
    .join('\n\n');
}

function quotePowerShellLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function quotePosixLiteral(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

export function buildManagedPythonReplCommand(
  managedPythonPath: string,
  shell: string,
  platform: RuntimePlatform,
): string {
  const normalizedShell = shell.trim().toLowerCase();

  if (platform === 'windows') {
    if (normalizedShell.includes('cmd')) {
      return `"${managedPythonPath.replace(/"/g, '""')}"`;
    }

    return `& ${quotePowerShellLiteral(managedPythonPath)}`;
  }

  return quotePosixLiteral(managedPythonPath);
}
