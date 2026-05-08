import { describe, expect, it } from 'vitest';
import { normalizeKainAppManifest } from '../runtime/kainManifest';

describe('Kain app manifest runtime', () => {
  it('normalizes the first-class Kain manifest contract', () => {
    const manifest = normalizeKainAppManifest({
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
    });

    expect(manifest?.kind).toBe('greeblefs.kain.manifest');
    expect(manifest?.bridge.supervisor).toBe('tauri-plugin-kain');
    expect(manifest?.capabilities).toHaveLength(1);
    expect(manifest?.dispatch[0]?.namespace).toBe('greeblefs.kain');
    expect(manifest?.settingsSchemas[0]?.consumer).toBe('Settings > Kain UI');
  });

  it('rejects non-manifest payloads', () => {
    expect(normalizeKainAppManifest({ schemaVersion: 1, kind: 'greeblefs.ui.graph' })).toBeNull();
    expect(normalizeKainAppManifest(null)).toBeNull();
  });
});
