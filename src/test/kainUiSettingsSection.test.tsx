import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { KainUiSettingsSection } from '../components/settings/sections/KainUiSettingsSection';
import type { KainAppManifest } from '../runtime/kainManifest';
import type { KainUiGraph } from '../runtime/kainUiGraph';

const graph: KainUiGraph = {
  schemaVersion: 1,
  kind: 'greeblefs.ui.graph',
  source: 'src-kain/app/main.kn',
  theme: {
    activeThemeId: 'pilot-dark',
  },
  chrome: {
    density: 'compact',
  },
  layout: {
    settingsRailMode: 'streamlined',
  },
  motion: {
    preset: 'subtle',
  },
  settings: {
    mode: 'streamlined',
    categories: [
      {
        key: 'start',
        label: 'Start',
        description: 'Start lane.',
        sectionKeys: ['overview', 'system', 'kain-ui'],
      },
    ],
    hiddenSectionKeys: ['theme-json'],
    primarySectionKeys: ['overview', 'system', 'kain-ui'],
  },
  profile: {
    source: 'app',
    scope: 'global',
    overlays: ['usr/kain-ui/main.kn'],
  },
};

const manifest: KainAppManifest = {
  schemaVersion: 1,
  kind: 'greeblefs.kain.manifest',
  source: 'src-kain/app/main.kn',
  label: 'GreebleFS Kain Manifest',
  summary: 'Kain-authored contribution map.',
  bridge: {
    runtimeId: 'greeblefs-kain-app',
    entry: 'src-kain/app/main.kn',
    dispatchFunction: 'kain_bridge_dispatch',
    transport: 'tauron.kain.bridge.json-lines',
    supervisor: 'tauri-plugin-kain',
  },
  capabilities: [
    {
      id: 'kain.app.manifest',
      lane: 'bridge',
      label: 'Kain app manifest',
      summary: 'Kain can describe app-level features.',
      status: 'live',
      implemented: true,
    },
    {
      id: 'kain.node.ffi',
      lane: 'ffi',
      label: 'Node FFI bridge',
      summary: 'Kain can call Node/native packages.',
      status: 'available-in-kain',
      implemented: false,
    },
  ],
  dispatch: [
    {
      namespace: 'greeblefs.kain',
      method: 'manifest',
      summary: 'Return Kain contributions.',
      consumedBy: 'src/runtime/kainManifest.ts',
    },
  ],
  generatedArtifacts: [
    {
      id: 'kain.plugin.proof',
      kind: 'plugin-manifest',
      source: 'plugin_authoring.kn',
      target: 'generated/plugin-proof.json',
      status: 'proof',
    },
  ],
  settingsSchemas: [
    {
      id: 'greeblefs.kain.ui',
      label: 'Kain UI Settings',
      source: 'src-kain/app/main.kn',
      consumer: 'Settings > Kain UI',
      status: 'live',
    },
  ],
  pipelines: [
    {
      id: 'kain.plugin.first-class',
      label: 'Plugin manifest generation',
      summary: 'Emit compatibility artifacts.',
      status: 'next',
    },
  ],
  ffiLanes: [
    {
      id: 'node',
      label: 'Node FFI',
      summary: 'Use npm-native tooling.',
      status: 'available-in-kain',
    },
  ],
  consumers: ['src/components/settings/sections/KainUiSettingsSection.tsx'],
};

describe('KainUiSettingsSection', () => {
  it('renders a live Kain manifest proof hook', () => {
    const { container } = render(
      <KainUiSettingsSection
        graph={graph}
        error={null}
        manifest={manifest}
        manifestError={null}
      />,
    );

    const proof = container.querySelector('[data-kain-manifest-proof]');
    expect(proof).toHaveAttribute('data-kain-manifest-proof', 'live');
    expect(proof).toHaveAttribute('data-kain-manifest-kind', 'greeblefs.kain.manifest');
    expect(proof).toHaveAttribute('data-kain-manifest-capabilities', '2');
    expect(screen.getByText('Kain Manifest')).toBeInTheDocument();
    expect(screen.getByText(/Plugin manifest generation/)).toBeInTheDocument();
    expect(screen.getByText(/Node FFI/)).toBeInTheDocument();
  });
});
