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
    expect(selectKainPluginPreviewWorkbenches(catalog)).toHaveLength(1);
  });
});
