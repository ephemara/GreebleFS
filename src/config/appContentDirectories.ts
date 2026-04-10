import { isTauri } from '@tauri-apps/api/core';
import { appLocalDataDir, homeDir, join } from '@tauri-apps/api/path';
import { exists, mkdir, rename } from '@tauri-apps/plugin-fs';

export type ManagedContentDirectoryId =
  | 'plugins'
  | 'themes'
  | 'shaders'
  | 'animations'
  | 'wallpapers'
  | 'notes'
  | 'screenshots';

const LEGACY_RELATIVE_DIRECTORY_NAMES: Record<ManagedContentDirectoryId, string> = {
  plugins: 'plugins',
  themes: 'themes',
  shaders: 'shaders',
  animations: 'animations',
  wallpapers: 'wallpapers',
  notes: 'notes',
  screenshots: 'Screenshots',
};

const RELEASE_DIRECTORY_NAMES: Record<ManagedContentDirectoryId, string> = {
  plugins: 'plugins',
  themes: 'themes',
  shaders: 'shaders',
  animations: 'animations',
  wallpapers: 'wallpapers',
  notes: 'notes',
  screenshots: 'screenshots',
};

const LEGACY_SCREENSHOT_DEFAULT_DIRECTORY = 'M:\\Assets\\Showcase\\TermOverlay';

let initializedManagedDirectories = false;
let initializationPromise: Promise<void> | null = null;
let resolvedManagedDirectories: Partial<Record<ManagedContentDirectoryId, string>> = {};
let resolvedLegacyHomeDirectories: Partial<Record<ManagedContentDirectoryId, string>> = {};

function readDirectoryOverride(id: ManagedContentDirectoryId): string | null {
  const env = import.meta.env as {
    VITE_OVERLAYTERM_PLUGINS_DIR?: string;
    VITE_OVERLAYTERM_THEMES_DIR?: string;
    VITE_OVERLAYTERM_SHADERS_DIR?: string;
    VITE_OVERLAYTERM_ANIMATIONS_DIR?: string;
    VITE_OVERLAYTERM_WALLPAPERS_DIR?: string;
    VITE_OVERLAYTERM_NOTES_DIR?: string;
    VITE_OVERLAYTERM_SCREENSHOTS_DIR?: string;
  };

  const rawValue = (() => {
    switch (id) {
      case 'plugins':
        return env.VITE_OVERLAYTERM_PLUGINS_DIR;
      case 'themes':
        return env.VITE_OVERLAYTERM_THEMES_DIR;
      case 'shaders':
        return env.VITE_OVERLAYTERM_SHADERS_DIR;
      case 'animations':
        return env.VITE_OVERLAYTERM_ANIMATIONS_DIR;
      case 'wallpapers':
        return env.VITE_OVERLAYTERM_WALLPAPERS_DIR;
      case 'notes':
        return env.VITE_OVERLAYTERM_NOTES_DIR;
      case 'screenshots':
        return env.VITE_OVERLAYTERM_SCREENSHOTS_DIR;
      default:
        return '';
    }
  })();

  const normalizedValue = typeof rawValue === 'string' ? rawValue.trim() : '';
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function normalizePathForComparison(path: string): string {
  return path
    .replace(/\\/g, '/')
    .replace(/\/+$/, '')
    .toLowerCase();
}

function shouldUseReleaseManagedDirectories(): boolean {
  return isTauri() && !import.meta.env.DEV;
}

async function buildReleaseManagedDirectoryMap(): Promise<Record<ManagedContentDirectoryId, string>> {
  const root = (await appLocalDataDir()).replace(/[\\/]+$/, '');

  return {
    plugins: await join(root, RELEASE_DIRECTORY_NAMES.plugins),
    themes: await join(root, RELEASE_DIRECTORY_NAMES.themes),
    shaders: await join(root, RELEASE_DIRECTORY_NAMES.shaders),
    animations: await join(root, RELEASE_DIRECTORY_NAMES.animations),
    wallpapers: await join(root, RELEASE_DIRECTORY_NAMES.wallpapers),
    notes: await join(root, RELEASE_DIRECTORY_NAMES.notes),
    screenshots: await join(root, RELEASE_DIRECTORY_NAMES.screenshots),
  };
}

async function buildLegacyHomeDirectoryMap(): Promise<Record<ManagedContentDirectoryId, string>> {
  const root = (await homeDir()).replace(/[\\/]+$/, '');

  return {
    plugins: await join(root, LEGACY_RELATIVE_DIRECTORY_NAMES.plugins),
    themes: await join(root, LEGACY_RELATIVE_DIRECTORY_NAMES.themes),
    shaders: await join(root, LEGACY_RELATIVE_DIRECTORY_NAMES.shaders),
    animations: await join(root, LEGACY_RELATIVE_DIRECTORY_NAMES.animations),
    wallpapers: await join(root, LEGACY_RELATIVE_DIRECTORY_NAMES.wallpapers),
    notes: await join(root, LEGACY_RELATIVE_DIRECTORY_NAMES.notes),
    screenshots: await join(root, LEGACY_RELATIVE_DIRECTORY_NAMES.screenshots),
  };
}

async function migrateLegacyHomeDirectory(
  id: ManagedContentDirectoryId,
  nextDirectory: string,
): Promise<void> {
  const legacyDirectory = resolvedLegacyHomeDirectories[id];
  if (!legacyDirectory) {
    return;
  }

  if (normalizePathForComparison(legacyDirectory) === normalizePathForComparison(nextDirectory)) {
    return;
  }

  if (!await exists(legacyDirectory)) {
    return;
  }

  if (await exists(nextDirectory)) {
    return;
  }

  const parentDirectory = await join(nextDirectory, '..');
  await mkdir(parentDirectory, { recursive: true });
  await rename(legacyDirectory, nextDirectory);
}

export async function initializeManagedContentDirectories(): Promise<void> {
  if (initializedManagedDirectories) {
    return;
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      resolvedManagedDirectories = {};
      resolvedLegacyHomeDirectories = {};

      if (!shouldUseReleaseManagedDirectories()) {
        initializedManagedDirectories = true;
        return;
      }

      const [releaseDirectories, legacyDirectories] = await Promise.all([
        buildReleaseManagedDirectoryMap(),
        buildLegacyHomeDirectoryMap(),
      ]);

      resolvedLegacyHomeDirectories = legacyDirectories;

      for (const id of Object.keys(RELEASE_DIRECTORY_NAMES) as ManagedContentDirectoryId[]) {
        const overrideDirectory = readDirectoryOverride(id);
        resolvedManagedDirectories[id] = overrideDirectory ?? releaseDirectories[id];
      }

      for (const id of Object.keys(RELEASE_DIRECTORY_NAMES) as ManagedContentDirectoryId[]) {
        if (readDirectoryOverride(id)) {
          continue;
        }

        const nextDirectory = resolvedManagedDirectories[id];
        if (typeof nextDirectory === 'string' && nextDirectory.length > 0) {
          await migrateLegacyHomeDirectory(id, nextDirectory);
        }
      }
    } catch (error) {
      console.warn('OverlayTerm: failed to initialize managed content directories', error);
    } finally {
      initializedManagedDirectories = true;
    }
  })();

  return initializationPromise;
}

export function getManagedContentDirectory(id: ManagedContentDirectoryId): string {
  const overrideDirectory = readDirectoryOverride(id);
  if (overrideDirectory) {
    return overrideDirectory;
  }

  const resolvedDirectory = resolvedManagedDirectories[id];
  if (typeof resolvedDirectory === 'string' && resolvedDirectory.length > 0) {
    return resolvedDirectory;
  }

  return LEGACY_RELATIVE_DIRECTORY_NAMES[id];
}

export function isLegacyScreenshotDirectory(path: string | null | undefined): boolean {
  if (typeof path !== 'string' || path.trim().length === 0) {
    return false;
  }

  const normalizedPath = normalizePathForComparison(path.trim());
  if (normalizedPath === normalizePathForComparison(LEGACY_SCREENSHOT_DEFAULT_DIRECTORY)) {
    return true;
  }

  const legacyHomeDirectory = resolvedLegacyHomeDirectories.screenshots;
  return typeof legacyHomeDirectory === 'string'
    && normalizePathForComparison(legacyHomeDirectory) === normalizedPath;
}
