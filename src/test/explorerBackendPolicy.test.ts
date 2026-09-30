import { describe, expect, it } from 'vitest';

import type { FileEntry } from '../generated/tauri';
import {
  resolveExplorerEntryOpenWithPolicy,
  resolveExplorerPolicyRuntimeMode,
} from '../runtime/explorerBackend';

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

  it('routes explicit open of previewable files to the OS shell, not the preview pane', async () => {
    // Regression: double-click/Enter resolved to "preview" for everything
    // except executables, so non-exe files never launched natively.
    const entries: FileEntry[] = [
      {
        name: 'hero.png',
        path: '/tmp/hero.png',
        is_dir: false,
        size: 12,
        modified: 1,
        extension: 'png',
        is_hidden: false,
        is_symlink: false,
        entityId: 'entity-png',
        identityKind: 'native',
        contentRevision: 'rev-1',
      },
      {
        name: 'score.wav',
        path: '/tmp/score.wav',
        is_dir: false,
        size: 12,
        modified: 1,
        extension: 'wav',
        is_hidden: false,
        is_symlink: false,
        entityId: 'entity-wav',
        identityKind: 'native',
        contentRevision: 'rev-1',
      },
      {
        name: 'scene.uproject',
        path: '/tmp/scene.uproject',
        is_dir: false,
        size: 12,
        modified: 1,
        extension: 'uproject',
        is_hidden: false,
        is_symlink: false,
        entityId: 'entity-uproject',
        identityKind: 'native',
        contentRevision: 'rev-1',
      },
    ];

    for (const entry of entries) {
      const result = await resolveExplorerEntryOpenWithPolicy({
        sessionId: 'pane-1',
        entry,
        previewEnabled: true,
        compactDock: false,
        showHidden: false,
      });
      expect(result.effect).toBe('openPath');
      expect(result.targetPath).toBe(entry.path);
    }
  });
});
