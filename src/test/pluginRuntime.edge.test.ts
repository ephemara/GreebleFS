import { describe, expect, it } from 'vitest';
import { loadPluginFromSource } from '../components/pluginRuntime';
import { createMockOverlayPluginApi } from './helpers/createMockOverlayPluginApi';

const entry = {
  name: 'broken-plugin.tsx',
  path: 'plugins/broken-plugin.tsx',
  is_dir: false,
  modified: 1,
  extension: 'tsx',
};

const hostApiFactory = () => createMockOverlayPluginApi();

describe('pluginRuntime edge cases', () => {
  it('returns a structured error when plugin imports unsupported modules', async () => {
    const loaded = await loadPluginFromSource(
      `
        import React from 'react';
        import leftPad from 'left-pad';

        export default function BrokenPlugin() {
          return React.createElement('div', null, leftPad('a', 2));
        }
      `,
      entry,
      hostApiFactory,
    );

    expect(loaded.component).toBeNull();
    expect(loaded.error).toContain('Unsupported import "left-pad"');
  });

  it('returns a structured error when plugin export does not provide a component', async () => {
    const loaded = await loadPluginFromSource(
      `
        export default {
          name: 'Missing Component'
        };
      `,
      entry,
      hostApiFactory,
    );

    expect(loaded.component).toBeNull();
    expect(loaded.error).toContain('Plugin must export either a React component');
  });

  it('returns a structured error when transpilation diagnostics are present', async () => {
    const loaded = await loadPluginFromSource(
      `
        const x: = 1;
        export default function BadSyntax() {
          return null;
        }
      `,
      entry,
      hostApiFactory,
    );

    expect(loaded.component).toBeNull();
    expect(loaded.error).toBeTruthy();
  });
});
