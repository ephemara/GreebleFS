import { afterEach, describe, expect, it, vi } from 'vitest';
import { getManagedContentDirectory } from '../config/appContentDirectories';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('managed content directories', () => {
  it('defaults notes storage to a portable managed directory name', () => {
    expect(getManagedContentDirectory('notes')).toBe('notes');
  });

  it('defaults icon-theme storage to a portable managed directory name', () => {
    expect(getManagedContentDirectory('iconThemes')).toBe('icon-themes');
  });

  it('defaults top-bar storage to a portable managed directory name', () => {
    expect(getManagedContentDirectory('topBars')).toBe('top-bars');
  });

  it('defaults menu-pack storage to a portable managed directory name', () => {
    expect(getManagedContentDirectory('menuPacks')).toBe('menu-packs');
  });

  it('respects a notes directory override', () => {
    vi.stubEnv('VITE_GREEBLEFS_NOTES_DIR', '/tmp/greeblefs-notes');

    expect(getManagedContentDirectory('notes')).toBe('/tmp/greeblefs-notes');
  });

  it('respects a top-bar directory override', () => {
    vi.stubEnv('VITE_GREEBLEFS_TOP_BARS_DIR', '/tmp/greeblefs-top-bars');

    expect(getManagedContentDirectory('topBars')).toBe('/tmp/greeblefs-top-bars');
  });

  it('respects an icon-theme directory override', () => {
    vi.stubEnv('VITE_GREEBLEFS_ICON_THEMES_DIR', '/tmp/greeblefs-icon-themes');

    expect(getManagedContentDirectory('iconThemes')).toBe('/tmp/greeblefs-icon-themes');
  });

  it('respects a menu-pack directory override', () => {
    vi.stubEnv('VITE_GREEBLEFS_MENU_PACKS_DIR', '/tmp/greeblefs-menu-packs');

    expect(getManagedContentDirectory('menuPacks')).toBe('/tmp/greeblefs-menu-packs');
  });

  it('still honors the legacy notes directory override', () => {
    vi.stubEnv('VITE_OVERLAYTERM_NOTES_DIR', '/tmp/overlayterm-notes');

    expect(getManagedContentDirectory('notes')).toBe('/tmp/overlayterm-notes');
  });

  it('still honors the legacy icon-theme directory override', () => {
    vi.stubEnv('VITE_OVERLAYTERM_ICON_THEMES_DIR', '/tmp/overlayterm-icon-themes');

    expect(getManagedContentDirectory('iconThemes')).toBe('/tmp/overlayterm-icon-themes');
  });

  it('still honors the legacy top-bar directory override', () => {
    vi.stubEnv('VITE_OVERLAYTERM_TOP_BARS_DIR', '/tmp/overlayterm-top-bars');

    expect(getManagedContentDirectory('topBars')).toBe('/tmp/overlayterm-top-bars');
  });

  it('still honors the legacy menu-pack directory override', () => {
    vi.stubEnv('VITE_OVERLAYTERM_MENU_PACKS_DIR', '/tmp/overlayterm-menu-packs');

    expect(getManagedContentDirectory('menuPacks')).toBe('/tmp/overlayterm-menu-packs');
  });
});
