import { describe, expect, it } from 'vitest';

import {
  normalizeKainPluginCatalog,
  selectKainPluginPreviewWorkbenches,
} from '../runtime/kainPluginCatalog';

describe('kainPluginCatalog', () => {
  it('normalizes Kain-native plugin workbenches, preview workbenches, WASM, and Cargo FFI metadata', () => {
    const catalog = normalizeKainPluginCatalog({
      schemaVersion: 1,
      kind: 'greeblefs.kain.plugin.catalog',
      source: 'src-kain/plugins/registry.kn',
      root: 'usr/plugins-kain',
      stdlib: 'src-kain/plugins/stdlib/greeblefs/plugin.kn',
      host: 'src/runtime/kainPluginCatalog.ts',
      summary: 'Kain plugin catalog.',
      plugins: [
        {
          id: 'kain-workbench-smoke',
          name: 'Kain Workbench Smoke',
          version: '0.1.0',
          description: 'Proof plugin.',
          source: 'usr/plugins-kain/kain-workbench-smoke/plugin.kn',
          tags: ['kain', 'ffi'],
          ffiCapabilities: [
            {
              id: 'cargo.pipeline',
              label: 'Cargo FFI pipeline',
              lane: 'cargo-ffi',
              status: 'available-in-kain',
            },
          ],
          tools: [
            {
              id: 'image-tool',
              kind: 'image-converter',
              label: 'Image Tool',
              supportedInputExtensions: ['PNG', 'jpg'],
              defaultOutputFormat: 'png',
              resizeModes: ['contain', 'cover'],
              formats: [
                {
                  id: 'png',
                  label: 'PNG',
                  extension: '.png',
                  mimeType: 'image/png',
                  encoder: 'Pillow PNG',
                  write: true,
                },
              ],
              resizePresets: [
                {
                  id: 'icon',
                  label: '256',
                  width: 256,
                  height: 256,
                  fitMode: 'contain',
                },
              ],
              pipelineBackends: [
                {
                  id: 'python',
                  label: 'Python',
                  lane: 'python',
                  role: 'convert',
                  packages: ['pillow'],
                },
              ],
            },
          ],
          hostUiKit: {
            id: 'greeblefs.workbench-kit',
            label: 'GreebleFS Workbench Kit',
            version: '0.1.0',
            status: 'live',
            primitives: ['path-input', 'action-strip', 'ffi-meter'],
            tokens: ['density.compact'],
            components: [
              {
                id: 'converter-shell',
                kind: 'tool-shell',
                label: 'Converter Shell',
                role: 'workbench',
                surface: 'workbench',
                status: 'live',
                primitives: ['path-input', 'format-select'],
                actions: ['inspect'],
                bindings: ['host.files'],
              },
            ],
          },
          hostUiComponents: [
            {
              id: 'preview-strip',
              kind: 'preview-toolbar',
              label: 'Preview Strip',
              role: 'preview-workbench',
              surface: 'preview-workbench',
              density: 'compact',
              status: 'live',
              primitives: ['icon-button'],
              actions: ['inspect'],
              bindings: ['host.preview'],
            },
          ],
          workbenches: [
            {
              id: 'main',
              title: 'Main',
              order: 2,
              rendererKind: 'kain-host',
              toolId: 'image-tool',
              actions: ['inspect'],
            },
          ],
          previewWorkbenches: [
            {
              id: 'kn-preview',
              title: 'Kain Source Preview',
              order: 980,
              rendererKind: 'kain-host',
              match: {
                extensions: ['KN', 'ks'],
                previewKinds: ['script'],
              },
              capabilities: {
                workflowTabs: true,
                contextMenu: true,
                prefetch: true,
              },
              workbenchChrome: {
                includePreviewTab: true,
                topBarDensity: 'compact',
              },
              toolId: 'image-tool',
              actions: ['inspect'],
              ffiLanes: ['python', 'cargo-ffi', 'wasm'],
            },
          ],
          actions: [
            {
              id: 'inspect',
              label: 'Inspect',
              ffiLanes: ['python'],
              toolId: 'image-tool',
              sidecarActionId: 'kain.plugin.image_converter.inspect',
              effect: 'inspect',
            },
          ],
          wasmTargets: [
            {
              id: 'worker',
              label: 'Worker',
              source: 'worker.kn',
              target: 'worker.wasm',
            },
          ],
          cargoFfiTargets: [
            {
              id: 'crate',
              label: 'Crate',
              crateName: 'smoke',
              cratePath: 'plugin.runtime/cargo/smoke',
            },
          ],
          authoring: {
            id: 'image-tool.reference',
            summary: 'Reference plugin.',
            entry: 'usr/plugins-kain/image-tool/plugin.kn',
            languageFeatures: [
              {
                id: 'typed-domain-model',
                label: 'Typed domain model',
                status: 'live',
                sourcePath: 'usr/plugins-kain/image-tool/plugin.kn',
              },
            ],
            examples: [
              {
                id: 'minimal',
                label: 'Minimal',
                path: 'plugin.examples/00_minimal.kn',
                kind: 'run',
                proof: 'kain run',
                features: ['workbench'],
              },
            ],
            designRules: ['Kain owns intent'],
            smokeCommands: ['kain run plugin.kn'],
          },
          contracts: [
            {
              id: 'tool.contract',
              kind: 'tool',
              symbol: 'build_tool',
              sourcePath: 'plugin.kn',
              status: 'live',
              summary: 'Tool contract.',
            },
          ],
          pipelineStages: [
            {
              id: 'python-bytes',
              label: 'Python',
              runtime: 'python',
              entry: 'worker.py',
              status: 'live',
              outputs: ['output-file'],
            },
          ],
          fabricPipelines: [
            {
              id: 'image-fabric',
              label: 'Image Fabric',
              manifestPath: 'usr/plugins-kain/image-tool/KAIN.fabric.toml',
              workspaceRoot: '.',
              reportDirectory: '.kain/fabric/reports',
              status: 'declared',
              eventStream: true,
              runtimes: ['python', 'kain', 'node'],
              ffiLanes: ['python', 'node'],
              requiredCapabilities: ['runtime.python'],
              outputContracts: ['value', 'shared-image'],
              steps: [
                {
                  id: 'python-source',
                  label: 'Python Source',
                  runtime: 'python',
                  entry: 'scripts/source.py',
                  status: 'declared',
                  dependsOn: [],
                  requires: ['runtime.python'],
                  outputs: [
                    {
                      name: 'settings',
                      kind: 'value',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      consumers: ['src/runtime/kainPluginCatalog.ts'],
    });

    expect(catalog?.kind).toBe('greeblefs.kain.plugin.catalog');
    expect(catalog?.plugins[0]?.directory).toBe('usr/plugins-kain/kain-workbench-smoke');
    expect(catalog?.plugins[0]?.ffiCapabilities[0]).toMatchObject({
      id: 'cargo.pipeline',
      lane: 'cargo-ffi',
      required: false,
    });
    expect(catalog?.plugins[0]?.tools[0]).toMatchObject({
      id: 'image-tool',
      kind: 'image-converter',
      supportedInputExtensions: ['png', 'jpg'],
      formats: [
        expect.objectContaining({
          id: 'png',
          write: true,
          read: true,
        }),
      ],
      pipelineBackends: [
        expect.objectContaining({
          lane: 'python',
          required: false,
        }),
      ],
    });
    expect(catalog?.plugins[0]?.workbenches[0]?.toolId).toBe('image-tool');
    expect(catalog?.plugins[0]?.actions[0]).toMatchObject({
      toolId: 'image-tool',
      sidecarActionId: 'kain.plugin.image_converter.inspect',
      effect: 'inspect',
    });
    expect(catalog?.plugins[0]?.previewWorkbenches[0]?.match.extensions).toEqual(['kn', 'ks']);
    expect(catalog?.plugins[0]?.previewWorkbenches[0]?.capabilities).toMatchObject({
      workflowTabs: true,
      contextMenu: true,
      prefetch: true,
      save: false,
    });
    expect(catalog?.plugins[0]?.wasmTargets[0]?.buildTarget).toBe('wasm32-unknown-unknown');
    expect(catalog?.plugins[0]?.cargoFfiTargets[0]?.status).toBe('declared');
    expect(catalog?.plugins[0]?.authoring?.languageFeatures[0]).toMatchObject({
      id: 'typed-domain-model',
      status: 'live',
    });
    expect(catalog?.plugins[0]?.authoring?.examples[0]?.features).toEqual(['workbench']);
    expect(catalog?.plugins[0]?.contracts[0]).toMatchObject({
      id: 'tool.contract',
      kind: 'tool',
    });
    expect(catalog?.plugins[0]?.pipelineStages[0]).toMatchObject({
      id: 'python-bytes',
      runtime: 'python',
    });
    expect(catalog?.plugins[0]?.hostUiKit?.components[0]).toMatchObject({
      id: 'converter-shell',
      primitives: ['path-input', 'format-select'],
    });
    expect(catalog?.plugins[0]?.hostUiComponents[0]).toMatchObject({
      id: 'preview-strip',
      density: 'compact',
    });
    expect(catalog?.plugins[0]?.fabricPipelines[0]).toMatchObject({
      id: 'image-fabric',
      eventStream: true,
      steps: [
        expect.objectContaining({
          id: 'python-source',
          outputs: [expect.objectContaining({ kind: 'value' })],
        }),
      ],
    });
    expect(selectKainPluginPreviewWorkbenches(catalog)).toHaveLength(1);
  });
});
