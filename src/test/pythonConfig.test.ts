import { describe, expect, it } from 'vitest';
import {
  buildManagedPythonPipInstallCommand,
  buildManagedPythonReplCommand,
  createAccelerationAutoInstallPlan,
  createPythonRuntimeConfig,
  formatCommandOutput,
  parseMultilineValues,
  pythonQuickPackagePresets,
  pythonSidecarActionCatalog,
  shouldAutoInstallAccelerationPackages,
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

  it('builds a managed Python pip install command for PowerShell shells', () => {
    expect(buildManagedPythonPipInstallCommand({
      managedPythonPath: 'C:\\Python Runtime\\env\\Scripts\\python.exe',
      shell: 'powershell.exe',
      platform: 'windows',
      packages: ['numpy', 'sentence-transformers'],
    })).toBe("& 'C:\\Python Runtime\\env\\Scripts\\python.exe' -m pip install 'numpy' 'sentence-transformers'");
  });

  it('creates a CUDA auto-install plan and merges it into the managed package queue', () => {
    expect(createAccelerationAutoInstallPlan({
      routingMode: 'preferCuda',
      currentPackageInput: 'numpy\ncustom-tooling',
    })).toEqual({
      presetId: 'cuda-ai-indexing',
      presetLabel: 'CUDA AI Indexing',
      packages: [
        'numpy',
        'custom-tooling',
        'pillow',
        'torch',
        'onnx',
        'onnxruntime-gpu',
        'sentence-transformers',
        'transformers',
        'tokenizers',
        'optimum',
        'faiss-cpu',
      ],
      packageInput: [
        'numpy',
        'custom-tooling',
        'pillow',
        'torch',
        'onnx',
        'onnxruntime-gpu',
        'sentence-transformers',
        'transformers',
        'tokenizers',
        'optimum',
        'faiss-cpu',
      ].join('\n'),
    });
  });

  it('only auto-installs acceleration packages when the managed runtime is effectively blank', () => {
    expect(shouldAutoInstallAccelerationPackages({
      torch: { installed: false },
      onnxruntime: { installed: false },
      optionalModules: [
        { id: 'numpy', installed: false },
        { id: 'PIL', installed: false },
        { id: 'sentence_transformers', installed: false },
      ],
    })).toBe(true);

    expect(shouldAutoInstallAccelerationPackages({
      torch: { installed: false },
      onnxruntime: { installed: false },
      optionalModules: [
        { id: 'numpy', installed: true },
      ],
    })).toBe(false);
  });

  it('loads package presets and action catalog from the sidecar manifest', () => {
    expect(pythonQuickPackagePresets.map(preset => preset.id)).toContain('ml-core');
    expect(pythonQuickPackagePresets.map(preset => preset.id)).toContain('cuda-ai-indexing');
    expect(pythonQuickPackagePresets.find(preset => preset.id === 'ml-core')?.packages).toContain('faiss-cpu');
    expect(pythonQuickPackagePresets.find(preset => preset.id === 'ml-core')?.packages).toContain('sentence-transformers');
    expect(pythonQuickPackagePresets.find(preset => preset.id === 'cuda-ai-indexing')?.packages).toContain('faiss-cpu');
    expect(pythonSidecarActionCatalog.map(action => action.id)).toEqual([
      'runtime.summary',
      'kain.ffi.catalog',
      'ml.probe',
      'acceleration.cuda_probe',
      'models.catalog_status',
      'models.cache_summary',
      'models.prewarm',
      'image.cutout_open_session',
      'image.cutout_apply_prompts',
      'image.cutout_reset_session',
      'image.cutout_stage_export',
      'image.cutout_close_session',
      'kain.plugin.image_converter.inspect',
      'kain.plugin.image_converter.plan',
      'kain.plugin.image_converter.convert',
      'files.scan_directory',
      'files.hash_paths',
      'semantic.index_root',
      'semantic.query_index',
      'semantic.find_similar_file',
      'semantic.delete_index',
      'semantic.index_status',
    ]);
  });
});
