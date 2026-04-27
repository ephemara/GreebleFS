import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getManagedContentDirectory,
  managedContentDirectoryCatalog,
} from '../config/appContentDirectories';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('universal runtime pipeline managed-content root', () => {
  it('exposes the runtimes/ root through the catalog with a stable id', () => {
    const entry = managedContentDirectoryCatalog.find(item => item.id === 'runtimes');
    expect(entry, 'runtimes managed-content entry must exist').toBeDefined();
    expect(entry?.releaseDirectoryName).toBe('runtimes');
    expect(entry?.legacyRelativeDirectoryName).toBe('runtimes');
    expect(entry?.envVarSuffix).toBe('RUNTIMES');
  });

  it('defaults runtimes storage to a portable managed directory name', () => {
    expect(getManagedContentDirectory('runtimes')).toBe('runtimes');
  });

  it('respects a runtimes directory override', () => {
    vi.stubEnv('VITE_GREEBLEFS_RUNTIMES_DIR', '/tmp/greeblefs-runtimes');

    expect(getManagedContentDirectory('runtimes')).toBe('/tmp/greeblefs-runtimes');
  });

  it('still honors the legacy runtimes directory override', () => {
    vi.stubEnv('VITE_OVERLAYTERM_RUNTIMES_DIR', '/tmp/overlayterm-runtimes');

    expect(getManagedContentDirectory('runtimes')).toBe('/tmp/overlayterm-runtimes');
  });
});
