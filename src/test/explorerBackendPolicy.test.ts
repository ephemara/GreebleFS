import { describe, expect, it } from 'vitest';

import { resolveExplorerPolicyRuntimeMode } from '../runtime/explorerBackend';

describe('explorer backend policy runtime mode', () => {
  it('keeps Windows explorer navigation on the local host path by default', () => {
    expect(
      resolveExplorerPolicyRuntimeMode({
        platform: 'windows',
        env: {},
      }),
    ).toBe('local');
  });

  it('keeps the Go sidecar as the default explorer policy runtime off Windows', () => {
    expect(
      resolveExplorerPolicyRuntimeMode({
        platform: 'linux',
        env: {},
      }),
    ).toBe('go-sidecar');
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
