import { afterEach, describe, expect, it, vi } from 'vitest';
import { getManagedContentDirectory } from '../config/appContentDirectories';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('managed content directories', () => {
  it('defaults notes storage to a portable managed directory name', () => {
    expect(getManagedContentDirectory('notes')).toBe('notes');
  });

  it('defaults top-bar storage to a portable managed directory name', () => {
    expect(getManagedContentDirectory('topBars')).toBe('top-bars');
  });

  it('respects a notes directory override', () => {
    vi.stubEnv('VITE_GREEBLEFS_NOTES_DIR', '/tmp/greeblefs-notes');

    expect(getManagedContentDirectory('notes')).toBe('/tmp/greeblefs-notes');
  });

  it('respects a top-bar directory override', () => {
    vi.stubEnv('VITE_GREEBLEFS_TOP_BARS_DIR', '/tmp/greeblefs-top-bars');

    expect(getManagedContentDirectory('topBars')).toBe('/tmp/greeblefs-top-bars');
  });

  it('still honors the legacy notes directory override', () => {
    vi.stubEnv('VITE_OVERLAYTERM_NOTES_DIR', '/tmp/overlayterm-notes');

    expect(getManagedContentDirectory('notes')).toBe('/tmp/overlayterm-notes');
  });

  it('still honors the legacy top-bar directory override', () => {
    vi.stubEnv('VITE_OVERLAYTERM_TOP_BARS_DIR', '/tmp/overlayterm-top-bars');

    expect(getManagedContentDirectory('topBars')).toBe('/tmp/overlayterm-top-bars');
  });
});
