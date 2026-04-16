import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildLinuxGraphicsEnvironment,
  buildManagedContentDirectoryEnvironment,
} from '../../scripts/run-platform-tauri.mjs';

describe('buildManagedContentDirectoryEnvironment', () => {
  it('pins tauri dev authored content roots to the workspace root', () => {
    const projectRootPath = path.join(path.sep, 'tmp', 'greeblefs');

    const environment = buildManagedContentDirectoryEnvironment({
      tauriCommand: 'dev',
      projectRootPath,
      existingEnv: {},
    });

    expect(environment).toEqual({
      VITE_GREEBLEFS_PLUGINS_DIR: path.join(projectRootPath, 'plugins'),
      VITE_GREEBLEFS_THEMES_DIR: path.join(projectRootPath, 'themes'),
      VITE_GREEBLEFS_SHADERS_DIR: path.join(projectRootPath, 'shaders'),
      VITE_GREEBLEFS_ANIMATIONS_DIR: path.join(projectRootPath, 'animations'),
      VITE_GREEBLEFS_WALLPAPERS_DIR: path.join(projectRootPath, 'wallpapers'),
      VITE_GREEBLEFS_NOTES_DIR: path.join(projectRootPath, 'notes'),
      VITE_OVERLAYTERM_PLUGINS_DIR: path.join(projectRootPath, 'plugins'),
      VITE_OVERLAYTERM_THEMES_DIR: path.join(projectRootPath, 'themes'),
      VITE_OVERLAYTERM_SHADERS_DIR: path.join(projectRootPath, 'shaders'),
      VITE_OVERLAYTERM_ANIMATIONS_DIR: path.join(projectRootPath, 'animations'),
      VITE_OVERLAYTERM_WALLPAPERS_DIR: path.join(projectRootPath, 'wallpapers'),
      VITE_OVERLAYTERM_NOTES_DIR: path.join(projectRootPath, 'notes'),
    });
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
    expect(environment.VITE_GREEBLEFS_PLUGINS_DIR).toBe(path.join(projectRootPath, 'plugins'));
    expect(environment.VITE_OVERLAYTERM_PLUGINS_DIR).toBe(path.join(projectRootPath, 'plugins'));
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
