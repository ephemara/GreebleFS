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
const CURRENT_RELEASE_APP_IDENTIFIER = 'co.greeblefs.app';
const LEGACY_RELEASE_APP_IDENTIFIER = 'co.overlayterm.app';

let initializedManagedDirectories = false;
let initializationPromise: Promise<void> | null = null;
let resolvedManagedDirectories: Partial<Record<ManagedContentDirectoryId, string>> = {};
let resolvedLegacyHomeDirectories: Partial<Record<ManagedContentDirectoryId, string>> = {};
let resolvedLegacyReleaseDirectories: Partial<Record<ManagedContentDirectoryId, string>> = {};

function readDirectoryOverride(id: ManagedContentDirectoryId): string | null {
  const env = import.meta.env as {
    VITE_GREEBLEFS_PLUGINS_DIR?: string;
    VITE_GREEBLEFS_THEMES_DIR?: string;
    VITE_GREEBLEFS_SHADERS_DIR?: string;
    VITE_GREEBLEFS_ANIMATIONS_DIR?: string;
    VITE_GREEBLEFS_WALLPAPERS_DIR?: string;
    VITE_GREEBLEFS_NOTES_DIR?: string;
    VITE_GREEBLEFS_SCREENSHOTS_DIR?: string;
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
        return env.VITE_GREEBLEFS_PLUGINS_DIR ?? env.VITE_OVERLAYTERM_PLUGINS_DIR;
      case 'themes':
        return env.VITE_GREEBLEFS_THEMES_DIR ?? env.VITE_OVERLAYTERM_THEMES_DIR;
      case 'shaders':
        return env.VITE_GREEBLEFS_SHADERS_DIR ?? env.VITE_OVERLAYTERM_SHADERS_DIR;
      case 'animations':
        return env.VITE_GREEBLEFS_ANIMATIONS_DIR ?? env.VITE_OVERLAYTERM_ANIMATIONS_DIR;
      case 'wallpapers':
        return env.VITE_GREEBLEFS_WALLPAPERS_DIR ?? env.VITE_OVERLAYTERM_WALLPAPERS_DIR;
      case 'notes':
        return env.VITE_GREEBLEFS_NOTES_DIR ?? env.VITE_OVERLAYTERM_NOTES_DIR;
      case 'screenshots':
        return env.VITE_GREEBLEFS_SCREENSHOTS_DIR ?? env.VITE_OVERLAYTERM_SCREENSHOTS_DIR;
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

function replaceTrailingDirectoryName(path: string, fromName: string, toName: string): string | null {
  const escapedFromName = fromName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`([\\\\/])${escapedFromName}$`);
  if (!pattern.test(path)) {
    return null;
  }

  return path.replace(pattern, `$1${toName}`);
}

async function buildLegacyReleaseDirectoryMap(): Promise<Partial<Record<ManagedContentDirectoryId, string>>> {
  const releaseRoot = (await appLocalDataDir()).replace(/[\\\\/]+$/, '');
  const legacyRoot = replaceTrailingDirectoryName(
    releaseRoot,
    CURRENT_RELEASE_APP_IDENTIFIER,
    LEGACY_RELEASE_APP_IDENTIFIER,
  );

  if (!legacyRoot || normalizePathForComparison(legacyRoot) === normalizePathForComparison(releaseRoot)) {
    return {};
  }

  return {
    plugins: await join(legacyRoot, RELEASE_DIRECTORY_NAMES.plugins),
    themes: await join(legacyRoot, RELEASE_DIRECTORY_NAMES.themes),
    shaders: await join(legacyRoot, RELEASE_DIRECTORY_NAMES.shaders),
    animations: await join(legacyRoot, RELEASE_DIRECTORY_NAMES.animations),
    wallpapers: await join(legacyRoot, RELEASE_DIRECTORY_NAMES.wallpapers),
    notes: await join(legacyRoot, RELEASE_DIRECTORY_NAMES.notes),
    screenshots: await join(legacyRoot, RELEASE_DIRECTORY_NAMES.screenshots),
  };
}

async function migrateLegacyDirectory(
  legacyDirectory: string | undefined,
  nextDirectory: string,
): Promise<void> {
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
      resolvedLegacyReleaseDirectories = {};

      if (!shouldUseReleaseManagedDirectories()) {
        initializedManagedDirectories = true;
        return;
      }

      const [releaseDirectories, legacyHomeDirectories, legacyReleaseDirectories] = await Promise.all([
        buildReleaseManagedDirectoryMap(),
        buildLegacyHomeDirectoryMap(),
        buildLegacyReleaseDirectoryMap(),
      ]);

      resolvedLegacyHomeDirectories = legacyHomeDirectories;
      resolvedLegacyReleaseDirectories = legacyReleaseDirectories;

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
          await migrateLegacyDirectory(resolvedLegacyHomeDirectories[id], nextDirectory);
          await migrateLegacyDirectory(resolvedLegacyReleaseDirectories[id], nextDirectory);
        }
      }
    } catch (error) {
      console.warn('GreebleFS: failed to initialize managed content directories', error);
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
  if (typeof legacyHomeDirectory === 'string'
    && normalizePathForComparison(legacyHomeDirectory) === normalizedPath) {
    return true;
  }

  const legacyReleaseDirectory = resolvedLegacyReleaseDirectories.screenshots;
  return typeof legacyReleaseDirectory === 'string'
    && normalizePathForComparison(legacyReleaseDirectory) === normalizedPath;
}
