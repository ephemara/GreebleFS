import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/runtime/kainPluginCatalog', () => ({
  runKainPluginAction: vi.fn(),
}));

vi.mock('@/runtime/kainImageConverterBackend', () => ({
  inspectKainImageConverterSource: vi.fn(),
  planKainImageConversion: vi.fn(),
  convertKainImage: vi.fn(),
}));

import { runKainPluginAction } from '@/runtime/kainPluginCatalog';
import { convertKainImage } from '@/runtime/kainImageConverterBackend';
import { KainPluginWorkbenchHost } from '../components/kain/KainPluginWorkbenchHost';
import type { KainPluginDefinition } from '../runtime/kainPluginCatalog';

const imagePlugin: KainPluginDefinition = {
  id: 'kain-image-converter',
  name: 'Kain Image Converter',
  version: '0.1.0',
  description: 'Image conversion.',
  category: 'Kain Plugins',
  source: 'usr/plugins-kain/kain-image-converter/plugin.kn',
  directory: 'usr/plugins-kain/kain-image-converter',
  manifestPath: 'usr/plugins-kain/kain-image-converter/plugin.kn',
  status: 'live',
  tags: ['kain', 'image'],
  permissions: [],
  ffiCapabilities: [],
  runtimes: [],
  tools: [
    {
      id: 'kain-image-converter.tool',
      kind: 'image-converter',
      label: 'Kain Image Converter',
      summary: 'Convert images through Kain-authored FFI lanes.',
      primaryActionId: 'kain.image.convert',
      defaultOutputFormat: 'png',
      supportedInputExtensions: ['png', 'jpg'],
      resizeModes: ['contain', 'cover', 'stretch', 'scale-down'],
      formats: [
        {
          id: 'png',
          label: 'PNG',
          extension: '.png',
          mimeType: 'image/png',
          encoder: 'Pillow PNG',
          status: 'live',
          read: true,
          write: true,
        },
        {
          id: 'ico',
          label: 'ICO',
          extension: '.ico',
          mimeType: 'image/x-icon',
          encoder: 'Pillow ICO',
          status: 'live',
          read: true,
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
          status: 'live',
          required: true,
          packages: ['pillow'],
        },
      ],
      ui: {},
    },
  ],
  hostUiKit: {
    id: 'greeblefs.image-toolkit',
    label: 'Image Toolkit',
    version: '0.1.0',
    status: 'live',
    summary: 'Trusted compact controls for Kain image tools.',
    primitives: ['path-input', 'format-select', 'action-strip', 'mini-meter'],
    tokens: ['density.compact'],
    components: [
      {
        id: 'image-converter-shell',
        kind: 'tool-shell',
        label: 'Image Converter Shell',
        role: 'workbench',
        surface: 'workbench',
        density: 'compact',
        status: 'live',
        summary: 'Host-rendered converter controls.',
        primitives: ['path-input', 'format-select'],
        actions: ['kain.image.convert'],
        bindings: ['host.files'],
      },
    ],
  },
  hostUiComponents: [
    {
      id: 'image-preview-strip',
      kind: 'preview-toolbar',
      label: 'Image Preview Strip',
      role: 'preview-workbench',
      surface: 'preview-workbench',
      density: 'compact',
      status: 'live',
      summary: 'Preview-pane converter controls.',
      primitives: ['icon-button', 'action-strip'],
      actions: ['kain.image.inspect'],
      bindings: ['host.preview'],
    },
  ],
  workbenches: [
    {
      id: 'kain-image-converter.main',
      title: 'Kain Image Converter',
      summary: 'Convert images.',
      kind: 'workbench',
      mountSlot: 'workbench.panels',
      order: 18,
      rendererKind: 'kain-host',
      toolId: 'kain-image-converter.tool',
      defaultOpen: false,
      hostModels: ['host.files'],
      actions: ['kain.image.inspect', 'kain.image.plan-conversion', 'kain.image.convert'],
      ffiLanes: ['python'],
    },
  ],
  previewWorkbenches: [],
  actions: [
    {
      id: 'kain.image.inspect',
      label: 'Inspect',
      summary: 'Inspect image.',
      command: 'greeblefs.plugins.action',
      kind: 'bridge-action',
      status: 'live',
      requiresTrust: true,
      ffiLanes: ['python'],
      toolId: 'kain-image-converter.tool',
      effect: 'inspect',
      sidecarActionId: 'kain.plugin.image_converter.inspect',
    },
    {
      id: 'kain.image.plan-conversion',
      label: 'Plan',
      summary: 'Plan conversion.',
      command: 'greeblefs.plugins.action',
      kind: 'bridge-action',
      status: 'live',
      requiresTrust: true,
      ffiLanes: ['python'],
      toolId: 'kain-image-converter.tool',
      effect: 'plan',
      sidecarActionId: 'kain.plugin.image_converter.plan',
    },
    {
      id: 'kain.image.convert',
      label: 'Convert',
      summary: 'Convert image.',
      command: 'greeblefs.plugins.action',
      kind: 'bridge-action',
      status: 'live',
      requiresTrust: true,
      ffiLanes: ['python'],
      toolId: 'kain-image-converter.tool',
      effect: 'convert',
      sidecarActionId: 'kain.plugin.image_converter.convert',
    },
  ],
  wasmTargets: [],
  cargoFfiTargets: [],
  generatedArtifacts: [],
  authoring: {
    id: 'kain-image-converter.reference',
    summary: 'Reference Kain plugin.',
    entry: 'usr/plugins-kain/kain-image-converter/plugin.kn',
    languageFeatures: [
      {
        id: 'typed-domain-model',
        label: 'Typed domain model',
        status: 'live',
        sourcePath: 'plugin.kn',
        summary: 'Typed plugin source.',
      },
    ],
    examples: [
      {
        id: 'minimal',
        label: 'Minimal',
        path: 'plugin.examples/00_minimal_plugin.kn',
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
      id: 'tool.image-converter',
      kind: 'tool',
      symbol: 'build_image_converter_tool',
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
      summary: 'Python sidecar.',
      outputs: ['output-file'],
    },
  ],
  fabricPipelines: [
    {
      id: 'image-converter.fabric',
      label: 'Image Converter Fabric',
      manifestPath: 'usr/plugins-kain/kain-image-converter/KAIN.fabric.toml',
      workspaceRoot: '.',
      reportDirectory: '.kain/fabric/reports',
      status: 'declared',
      summary: 'Python, Kain, C, Cargo, Node, and GPU-capable image pipeline.',
      eventStream: true,
      runtimes: ['python', 'kain', 'c_abi', 'rust_crate', 'node'],
      ffiLanes: ['python', 'c-runtime', 'cargo-ffi', 'node'],
      requiredCapabilities: ['runtime.python', 'runtime.node'],
      outputContracts: ['value', 'shared-image'],
      steps: [
        {
          id: 'python-source',
          label: 'Python Source',
          runtime: 'python',
          entry: 'scripts/python_step.py',
          status: 'declared',
          summary: 'Source image bytes.',
          dependsOn: [],
          requires: ['runtime.python'],
          outputs: [{ name: 'settings', kind: 'value' }],
        },
      ],
    },
  ],
};

describe('KainPluginWorkbenchHost', () => {
  it('renders the Kain image converter tool and routes convert through Kain then Python FFI', async () => {
    vi.mocked(runKainPluginAction).mockResolvedValue({
      ok: true,
      pluginId: 'kain-image-converter',
      actionId: 'kain.image.convert',
      label: 'Convert',
      summary: 'approved',
      ffiLanes: ['python'],
      result: {},
    });
    vi.mocked(convertKainImage).mockResolvedValue({
      result: {
        ok: true,
        action: 'convert',
        backend: 'python:pillow',
        source: {
          path: 'D:/art/source.png',
          format: 'PNG',
          mode: 'RGBA',
          width: 640,
          height: 480,
          hasAlpha: true,
        },
        output: {
          path: 'D:/art/source.kain-256x256.png',
          format: 'PNG',
          mode: 'RGBA',
          width: 256,
          height: 256,
          hasAlpha: true,
        },
        outputPath: 'D:/art/source.kain-256x256.png',
        outputFormat: 'png',
        supportedFormats: ['png', 'ico'],
        warnings: [],
      },
    } as never);

    const { container } = render(
      <KainPluginWorkbenchHost
        kainPlugin={imagePlugin}
        mode="workbench"
        workbench={imagePlugin.workbenches[0]}
        file={{
          name: 'source.png',
          resolvedPath: 'D:/art/source.png',
          extension: 'png',
          isDirectory: false,
        }}
      />,
    );

    expect(container.querySelector('[data-kain-image-converter-workbench]')).toHaveAttribute(
      'data-kain-image-converter-tool',
      'kain-image-converter.tool',
    );
    expect(container.querySelector('[data-kain-plugin-workbench-host]')).toHaveAttribute(
      'data-kain-plugin-authoring-examples',
      '1',
    );
    expect(container.querySelector('[data-kain-plugin-reference-strip]')).toBeTruthy();
    expect(container.querySelector('[data-kain-plugin-capability-strip]')).toBeTruthy();
    expect(container.querySelector('[data-kain-plugin-host-ui-strip]')).toBeTruthy();
    expect(container.querySelector('[data-kain-plugin-fabric-strip]')).toBeTruthy();
    expect(container.querySelector('[data-kain-plugin-workbench-host]')).toHaveAttribute(
      'data-kain-plugin-fabric-pipelines',
      '1',
    );
    expect(screen.getByDisplayValue('D:/art/source.png')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Convert' }));

    await waitFor(() => {
      expect(runKainPluginAction).toHaveBeenCalledWith(expect.objectContaining({
        pluginId: 'kain-image-converter',
        actionId: 'kain.image.convert',
      }));
      expect(convertKainImage).toHaveBeenCalledWith(expect.objectContaining({
        sourcePath: 'D:/art/source.png',
        outputFormat: 'png',
        width: 256,
        height: 256,
      }));
    });
    await screen.findByText('D:/art/source.kain-256x256.png');
  });
});
