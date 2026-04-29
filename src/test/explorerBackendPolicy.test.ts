import { describe, expect, it } from 'vitest';

import { resolveExplorerPolicyRuntimeMode } from '../runtime/explorerBackend';

describe('explorer backend policy runtime mode', () => {
  it('keeps explorer navigation on the local host path by default', () => {
    expect(
      resolveExplorerPolicyRuntimeMode({
        platform: 'windows',
        env: {},
      }),
    ).toBe('local');
  });

  it('does not route ordinary folder navigation through the Go sidecar by platform default', () => {
    expect(
      resolveExplorerPolicyRuntimeMode({
        platform: 'linux',
        env: {},
      }),
    ).toBe('local');
  });

  it('allows the Go sidecar policy runtime to be forced for diagnostics', () => {
    expect(
      resolveExplorerPolicyRuntimeMode({
        platform: 'windows',
        env: {
          VITE_GREEBLEFS_EXPLORER_POLICY_RUNTIME: 'go-sidecar',
        },
      }),
    ).toBe('go-sidecar');
  });
});
