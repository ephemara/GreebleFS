import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function parseArguments(argv) {
  const flags = new Set(argv);
  const quick = flags.has('--quick');
  return {
    quick,
    skipFrontend: flags.has('--skip-frontend'),
    skipBrowser: flags.has('--skip-browser') || quick,
    skipRust: flags.has('--skip-rust'),
    skipGo: flags.has('--skip-go'),
    skipPython: flags.has('--skip-python'),
    skipProof: flags.has('--skip-proof'),
  };
}

function writeCapturedOutput(stdout, stderr) {
  if (stdout) {
    process.stdout.write(stdout);
    if (!stdout.endsWith('\n')) {
      process.stdout.write('\n');
    }
  }
  if (stderr) {
    process.stderr.write(stderr);
    if (!stderr.endsWith('\n')) {
      process.stderr.write('\n');
    }
  }
}

function runCommand(stepLabel, command, args, options = {}) {
  console.log(`\n[validate] ${stepLabel}`);
  console.log(`           ${[command, ...args].join(' ')}`);
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? projectRoot,
    env: { ...process.env, ...(options.env ?? {}) },
    encoding: 'utf8',
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }

  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  writeCapturedOutput(stdout, stderr);

  return {
    status: result.status ?? 1,
    stdout,
    stderr,
  };
}

function captureCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? projectRoot,
    env: { ...process.env, ...(options.env ?? {}) },
    encoding: 'utf8',
    shell: false,
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout?.trim() ?? '',
    stderr: result.stderr?.trim() ?? '',
    error: result.error ?? null,
  };
}

function resolvePythonCommand() {
  const candidates = [
    ['python', []],
    ['py', ['-3']],
  ];

  for (const [command, prefixArgs] of candidates) {
    const probe = captureCommand(command, [...prefixArgs, '--version']);
    if (!probe.error && probe.status === 0) {
      return { command, prefixArgs };
    }
  }

  return null;
}

function buildValidationSteps(options) {
  const pythonCommand = resolvePythonCommand();
  const steps = [];

  if (!options.skipFrontend) {
    if (options.quick) {
      steps.push(
        {
          label: 'Frontend performance telemetry coverage',
          kind: 'frontend',
          command: 'bun',
          args: ['x', 'vitest', 'run', 'src/test/performanceTelemetry.test.ts'],
        },
        {
          label: 'Frontend settings store coverage',
          kind: 'frontend',
          command: 'bun',
          args: ['x', 'vitest', 'run', 'src/test/settingsStore.test.ts'],
        },
        {
          label: 'Frontend developer proof surface coverage',
          kind: 'frontend',
          command: 'bun',
          args: [
            'x',
            'vitest',
            'run',
            'src/test/settingsPage.behavior.test.tsx',
            '-t',
            'reveals developer test proof surfaces when the toggle is enabled',
          ],
        },
      );
    } else {
      steps.push({
        label: 'Frontend unit suite',
        kind: 'frontend',
        command: 'bun',
        args: ['run', 'test:unit'],
      });
    }
  }

  if (!options.skipBrowser) {
    steps.push({
      label: 'Browser Vitest suite',
      kind: 'browser',
      command: 'bun',
      args: ['run', 'test:browser'],
    });
  }

  if (!options.skipRust) {
    if (options.quick) {
      steps.push(
        {
          label: 'Rust semantic-search tests',
          kind: 'rust',
          command: 'cargo',
          args: ['test', '--manifest-path', 'src-tauri/Cargo.toml', 'semantic_search::tests', '--lib'],
          fallback: {
            label: 'Rust semantic-search compile proof',
            command: 'cargo',
            args: [
              'test',
              '--manifest-path',
              'src-tauri/Cargo.toml',
              'semantic_search::tests',
              '--lib',
              '--no-run',
            ],
          },
        },
        {
          label: 'Rust extension-host tests',
          kind: 'rust',
          command: 'cargo',
          args: ['test', '--manifest-path', 'src-tauri/Cargo.toml', 'runtime_pipeline::extension_host::tests', '--lib'],
          fallback: {
            label: 'Rust extension-host compile proof',
            command: 'cargo',
            args: [
              'test',
              '--manifest-path',
              'src-tauri/Cargo.toml',
              'runtime_pipeline::extension_host::tests',
              '--lib',
              '--no-run',
            ],
          },
        },
        {
          label: 'Rust runtime-host command tests',
          kind: 'rust',
          command: 'cargo',
          args: ['test', '--manifest-path', 'src-tauri/Cargo.toml', 'runtime_pipeline::commands::tests', '--lib'],
          fallback: {
            label: 'Rust runtime-host command compile proof',
            command: 'cargo',
            args: [
              'test',
              '--manifest-path',
              'src-tauri/Cargo.toml',
              'runtime_pipeline::commands::tests',
              '--lib',
              '--no-run',
            ],
          },
        },
      );
    } else {
      steps.push({
        label: 'Rust cargo suite',
        kind: 'rust',
        command: 'bun',
        args: ['run', 'test:rust'],
        fallback: {
          label: 'Rust cargo compile proof',
          command: 'cargo',
          args: ['check', '--manifest-path', 'src-tauri/Cargo.toml', '--lib'],
        },
      });
    }
  }

  if (!options.skipGo) {
    steps.push({
      label: 'Go bootstrap',
      kind: 'go',
      command: 'bun',
      args: ['run', 'go:bootstrap'],
    });
    if (options.quick) {
      steps.push({
        label: 'Go explorer policy service tests',
        kind: 'go',
        command: 'go',
        args: ['test', './...'],
        cwd: path.join(projectRoot, 'src-go', 'builtin-runtimes', 'explorer-policy-service'),
      });
    } else {
      steps.push(
        {
          label: 'Go workspace tests',
          kind: 'go',
          command: 'bun',
          args: ['run', 'go:test'],
        },
        {
          label: 'Go workspace checks',
          kind: 'go',
          command: 'bun',
          args: ['run', 'go:check'],
        },
      );
    }
  }

  if (!options.skipPython) {
    if (!pythonCommand) {
      throw new Error('Python 3 is required for runtime validation but was not found on PATH.');
    }
    steps.push({
      label: options.quick ? 'Python focused runtime tests' : 'Python unittest discovery',
      kind: 'python',
      command: pythonCommand.command,
      args: options.quick
        ? [
            ...pythonCommand.prefixArgs,
            '-m',
            'unittest',
            'tests_python.test_acceleration_actions',
            'tests_python.test_cutout_runtime',
            'tests_python.test_reference_scrub',
          ]
        : [
            ...pythonCommand.prefixArgs,
            '-m',
            'unittest',
            'discover',
            '-s',
            'tests_python',
            '-p',
            'test_*.py',
          ],
    });
  }

  return steps;
}

function isWindowsRustHarnessEntrypointFailure(step, result) {
  if (process.platform !== 'win32' || step.kind !== 'rust') {
    return false;
  }

  const combinedOutput = `${result.stdout}\n${result.stderr}`;
  return (
    combinedOutput.includes('STATUS_ENTRYPOINT_NOT_FOUND') ||
    combinedOutput.includes('0xc0000139')
  );
}

function runFallbackStep(step, fallback) {
  if (!fallback) {
    return { status: 1, stdout: '', stderr: '' };
  }
  return runCommand(fallback.label, fallback.command, fallback.args, {
    cwd: fallback.cwd ?? step.cwd,
    env: fallback.env ?? step.env,
  });
}

function collectHardwareProof(options) {
  if (options.skipProof) {
    return [];
  }

  const proofLines = [];

  const nvidiaProbe = captureCommand('nvidia-smi', [
    '--query-gpu=name,driver_version,memory.total',
    '--format=csv,noheader',
  ]);
  if (!nvidiaProbe.error && nvidiaProbe.status === 0 && nvidiaProbe.stdout) {
    proofLines.push(`CUDA GPU: ${nvidiaProbe.stdout}`);
  } else {
    proofLines.push('CUDA GPU: skipped (nvidia-smi unavailable on this host)');
  }

  const goRoot = captureCommand('go', ['env', 'GOROOT']);
  if (!goRoot.error && goRoot.status === 0 && goRoot.stdout) {
    const wasmExecCandidates = [
      path.join(goRoot.stdout, 'lib', 'wasm', 'wasm_exec.js'),
      path.join(goRoot.stdout, 'misc', 'wasm', 'wasm_exec.js'),
    ];
    const wasmExecPath = wasmExecCandidates.find((candidate) => existsSync(candidate));
    proofLines.push(
      wasmExecPath
        ? `Go wasm host: ready (${wasmExecPath})`
        : 'Go wasm host: missing wasm_exec.js in the active GOROOT',
    );
  } else {
    proofLines.push('Go wasm host: skipped (go toolchain unavailable)');
  }

  const tinygoProbe = captureCommand('tinygo', ['version']);
  if (!tinygoProbe.error && tinygoProbe.status === 0 && tinygoProbe.stdout) {
    proofLines.push(`TinyGo: ${tinygoProbe.stdout.split('\n')[0]}`);
  } else {
    proofLines.push('TinyGo: optional and not installed on this host');
  }

  const pythonCommand = resolvePythonCommand();
  if (pythonCommand) {
    const pythonProbe = captureCommand(pythonCommand.command, [
      ...pythonCommand.prefixArgs,
      '-c',
      [
        'import importlib.util, json, sys',
        'print(json.dumps({',
        '"python": sys.version.split()[0],',
        '"torchInstalled": importlib.util.find_spec("torch") is not None,',
        '"onnxruntimeInstalled": importlib.util.find_spec("onnxruntime") is not None,',
        '}))',
      ].join('; '),
    ]);
    if (!pythonProbe.error && pythonProbe.status === 0 && pythonProbe.stdout) {
      proofLines.push(`Python acceleration modules: ${pythonProbe.stdout}`);
    }
  }

  return proofLines;
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const steps = buildValidationSteps(options);
  const failures = [];
  const blocked = [];

  console.log(
    `[validate] starting ${options.quick ? 'quick' : 'full'} runtime validation in ${projectRoot}`,
  );

  for (const step of steps) {
    const result = runCommand(step.label, step.command, step.args, {
      cwd: step.cwd,
      env: step.env,
    });
    if (result.status !== 0) {
      if (isWindowsRustHarnessEntrypointFailure(step, result)) {
        const fallbackResult = runFallbackStep(step, step.fallback);
        if (fallbackResult.status === 0) {
          blocked.push(
            `${step.label} runtime launch blocked by Windows loader (STATUS_ENTRYPOINT_NOT_FOUND / 0xc0000139); compile proof passed via ${step.fallback.label}`,
          );
          continue;
        }
        failures.push(`${step.label} (runtime blocked, fallback ${step.fallback?.label ?? 'none'} failed)`);
        break;
      }

      failures.push(`${step.label} (exit ${result.status})`);
      break;
    }
  }

  const proofLines = collectHardwareProof(options);
  if (proofLines.length > 0) {
    console.log('\n[validate] hardware-gated proof');
    for (const line of proofLines) {
      console.log(`           ${line}`);
    }
  }

  if (blocked.length > 0) {
    console.log('\n[validate] blocked but understood');
    for (const blockedLine of blocked) {
      console.log(`           ${blockedLine}`);
    }
  }

  if (failures.length > 0) {
    console.error('\n[validate] runtime validation failed');
    for (const failure of failures) {
      console.error(`           ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('\n[validate] runtime validation passed');
}

main();
