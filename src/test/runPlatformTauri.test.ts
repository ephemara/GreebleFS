import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildManagedContentDirectoryEnvironment } from '../../scripts/run-platform-tauri.mjs';

describe('buildManagedContentDirectoryEnvironment', () => {
  it('pins tauri dev authored content roots to the workspace root', () => {
    const projectRootPath = path.join(path.sep, 'tmp', 'greeblefs');

    const environment = buildManagedContentDirectoryEnvironment({
      tauriCommand: 'dev',
      projectRootPath,
      existingEnv: {},
    });

    expect(environment).toEqual({
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

    expect(environment.VITE_OVERLAYTERM_THEMES_DIR).toBeUndefined();
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
