import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildLinuxGraphicsEnvironment,
  buildManagedContentDirectoryEnvironment,
} from '../../scripts/run-platform-tauri.mjs';
import { getUsrManagedContentEntries } from '../../scripts/usr-manifest.mjs';

function buildExpectedDevManagedEnvironment(projectRootPath: string) {
  const usrRootPath = path.join(projectRootPath, 'usr');
  const expectedEnvironment: Record<string, string> = {
    VITE_GREEBLEFS_USR_DIR: usrRootPath,
    VITE_OVERLAYTERM_USR_DIR: usrRootPath,
    GREEBLEFS_USR_DIR: usrRootPath,
    OVERLAYTERM_USR_DIR: usrRootPath,
    GREEBLEFS_MANAGED_CONTENT_ROOT: usrRootPath,
    OVERLAYTERM_MANAGED_CONTENT_ROOT: usrRootPath,
    VITE_GREEBLEFS_NOTES_DIR: path.join(projectRootPath, 'notes'),
    VITE_OVERLAYTERM_NOTES_DIR: path.join(projectRootPath, 'notes'),
  };

  for (const entry of getUsrManagedContentEntries()) {
    expectedEnvironment[`VITE_GREEBLEFS_${entry.envVarSuffix}_DIR`] = path.join(
      usrRootPath,
      entry.relativeDirectory,
    );
    expectedEnvironment[`VITE_OVERLAYTERM_${entry.envVarSuffix}_DIR`] = path.join(
      usrRootPath,
      entry.relativeDirectory,
    );
  }

  return expectedEnvironment;
}

describe('buildManagedContentDirectoryEnvironment', () => {
  it('pins tauri dev authored content roots to the canonical usr workspace root', () => {
    const projectRootPath = path.join(path.sep, 'tmp', 'greeblefs');

    const environment = buildManagedContentDirectoryEnvironment({
      tauriCommand: 'dev',
      projectRootPath,
      existingEnv: {},
    });

    expect(environment).toEqual(buildExpectedDevManagedEnvironment(projectRootPath));
  });

  it('preserves explicit directory overrides', () => {
    const projectRootPath = path.join(path.sep, 'tmp', 'greeblefs');

    const environment = buildManagedContentDirectoryEnvironment({
      tauriCommand: 'dev',
      projectRootPath,
      existingEnv: {
        VITE_OVERLAYTERM_THEMES_DIR: '/custom/themes',
      },
    });

    expect(environment.VITE_GREEBLEFS_THEMES_DIR).toBeUndefined();
    expect(environment.VITE_OVERLAYTERM_THEMES_DIR).toBeUndefined();
    expect(environment.VITE_GREEBLEFS_PLUGINS_DIR).toBe(path.join(projectRootPath, 'usr', 'plugins'));
    expect(environment.VITE_OVERLAYTERM_PLUGINS_DIR).toBe(path.join(projectRootPath, 'usr', 'plugins'));
    expect(environment.VITE_GREEBLEFS_USR_DIR).toBe(path.join(projectRootPath, 'usr'));
    expect(environment.GREEBLEFS_MANAGED_CONTENT_ROOT).toBe(path.join(projectRootPath, 'usr'));
  });

  it('does not inject workspace paths outside tauri dev', () => {
    const environment = buildManagedContentDirectoryEnvironment({
      tauriCommand: 'build',
      projectRootPath: path.join(path.sep, 'tmp', 'greeblefs'),
      existingEnv: {},
    });

    expect(environment).toEqual({});
  });
});

describe('buildLinuxGraphicsEnvironment', () => {
  it('does nothing outside Linux tauri dev', () => {
    expect(buildLinuxGraphicsEnvironment({
      tauriCommand: 'build',
      platform: 'linux',
      existingEnv: {},
    })).toEqual({});
    expect(buildLinuxGraphicsEnvironment({
      tauriCommand: 'dev',
      platform: 'win32',
      existingEnv: {},
    })).toEqual({});
  });

  it('leaves backend selection to Rust when both Wayland and X11 are available', () => {
    expect(buildLinuxGraphicsEnvironment({
      tauriCommand: 'dev',
      platform: 'linux',
      existingEnv: {
        DISPLAY: ':0',
        WAYLAND_DISPLAY: 'wayland-0',
        XDG_SESSION_TYPE: 'wayland',
      },
    })).toEqual({});
  });

  it('respects explicit app backend overrides without forcing GDK_BACKEND', () => {
    expect(buildLinuxGraphicsEnvironment({
      tauriCommand: 'dev',
      platform: 'linux',
      existingEnv: {
        DISPLAY: ':0',
        WAYLAND_DISPLAY: 'wayland-0',
        GREEBLEFS_LINUX_DISPLAY_BACKEND: 'x11',
      },
    })).toEqual({});
  });

  it('pins the only available Linux backend when no fallback path exists', () => {
    expect(buildLinuxGraphicsEnvironment({
      tauriCommand: 'dev',
      platform: 'linux',
      existingEnv: {
        WAYLAND_DISPLAY: 'wayland-0',
        XDG_SESSION_TYPE: 'wayland',
      },
    })).toEqual({
      GDK_BACKEND: 'wayland',
    });
  });

  it('throws a clear error when no Linux display session is available', () => {
    expect(() => buildLinuxGraphicsEnvironment({
      tauriCommand: 'dev',
      platform: 'linux',
      existingEnv: {},
    })).toThrow(/No DISPLAY or WAYLAND_DISPLAY/);
  });
});
