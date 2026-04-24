import { isTauri } from '@tauri-apps/api/core';
import { appLocalDataDir, homeDir, join } from '@tauri-apps/api/path';
import { exists, mkdir, rename } from '@tauri-apps/plugin-fs';

export interface ManagedContentDirectoryDefinition {
  id: string;
  label: string;
  description: string;
  keywords: readonly string[];
  releaseDirectoryName: string;
  legacyRelativeDirectoryName: string;
  envVarSuffix: string;
  order: number;
}

export const managedContentDirectoryCatalog = [
  {
    id: 'plugins',
    label: 'Plugins',
    description: 'Drop TSX panels and runtime modules here.',
    keywords: ['plugin', 'panel', 'runtime module', 'command'],
    releaseDirectoryName: 'plugins',
    legacyRelativeDirectoryName: 'plugins',
    envVarSuffix: 'PLUGINS',
    order: 10,
  },
  {
    id: 'themes',
    label: 'Themes',
    description: 'Package theme bundle manifests and local child pack folders here.',
    keywords: ['theme', 'theme bundle', 'appearance', 'catalog'],
    releaseDirectoryName: 'themes',
    legacyRelativeDirectoryName: 'themes',
    envVarSuffix: 'THEMES',
    order: 20,
  },
  {
    id: 'appearancePacks',
    label: 'Appearance Packs',
    description: 'Author reusable color, typography, and chrome look packs here.',
    keywords: ['appearance', 'theme look', 'palette', 'visual identity'],
    releaseDirectoryName: 'appearance-packs',
    legacyRelativeDirectoryName: 'appearance-packs',
    envVarSuffix: 'APPEARANCE_PACKS',
    order: 22,
  },
  {
    id: 'topBars',
    label: 'Top Bars',
    description: 'Author standalone shell chrome workflows here.',
    keywords: ['top bar', 'chrome', 'header', 'shell chrome'],
    releaseDirectoryName: 'top-bars',
    legacyRelativeDirectoryName: 'top-bars',
    envVarSuffix: 'TOP_BARS',
    order: 25,
  },
  {
    id: 'homePacks',
    label: 'Home Packs',
    description: 'Author explorer home dashboards, presets, and runtime modules here.',
    keywords: ['home', 'home pack', 'dashboard', 'start page'],
    releaseDirectoryName: 'home-packs',
    legacyRelativeDirectoryName: 'home-packs',
    envVarSuffix: 'HOME_PACKS',
    order: 28,
  },
  {
    id: 'menuPacks',
    label: 'Menu Packs',
    description: 'Author explorer menu layouts, submenus, and presentation-ready packs here.',
    keywords: ['menu', 'context menu', 'submenu', 'explorer menu'],
    releaseDirectoryName: 'menu-packs',
    legacyRelativeDirectoryName: 'menu-packs',
    envVarSuffix: 'MENU_PACKS',
    order: 29,
  },
  {
    id: 'iconThemes',
    label: 'Icon Themes',
    description: 'Drop VS Code-style icon-theme manifests here for explorer and shell icon swaps.',
    keywords: ['icons', 'icon theme', 'folder icons', 'ui icons'],
    releaseDirectoryName: 'icon-themes',
    legacyRelativeDirectoryName: 'icon-themes',
    envVarSuffix: 'ICON_THEMES',
    order: 30,
  },
  {
    id: 'interactionMotionPacks',
    label: 'Interaction Motion',
    description: 'Author theme-selectable interaction motion defaults here.',
    keywords: ['interaction motion', 'motion', 'hover', 'press'],
    releaseDirectoryName: 'interaction-motion',
    legacyRelativeDirectoryName: 'interaction-motion',
    envVarSuffix: 'INTERACTION_MOTION',
    order: 35,
  },
  {
    id: 'soundPacks',
    label: 'Sound Packs',
    description: 'Author theme-selectable shell sound packs and notification cues here.',
    keywords: ['sound', 'sound pack', 'audio cue', 'notification sound', 'ui sound'],
    releaseDirectoryName: 'sound-packs',
    legacyRelativeDirectoryName: 'sound-packs',
    envVarSuffix: 'SOUND_PACKS',
    order: 36,
  },
  {
    id: 'shaders',
    label: 'Shaders',
    description: 'Author shell shader profiles with surface-level controls.',
    keywords: ['shader', 'render', 'visuals'],
    releaseDirectoryName: 'shaders',
    legacyRelativeDirectoryName: 'shaders',
    envVarSuffix: 'SHADERS',
    order: 40,
  },
  {
    id: 'animations',
    label: 'Animations',
    description: 'Author open and close motion modules here.',
    keywords: ['animation', 'motion', 'transition'],
    releaseDirectoryName: 'animations',
    legacyRelativeDirectoryName: 'animations',
    envVarSuffix: 'ANIMATIONS',
    order: 50,
  },
  {
    id: 'wallpapers',
    label: 'Wallpapers',
    description: 'Import images, videos, and live wallpaper modules here.',
    keywords: ['wallpaper', 'background', 'video wallpaper', 'live wallpaper'],
    releaseDirectoryName: 'wallpapers',
    legacyRelativeDirectoryName: 'wallpapers',
    envVarSuffix: 'WALLPAPERS',
    order: 60,
  },
  {
    id: 'shellRenderers',
    label: 'Shell Renderers',
    description: 'Author standalone theme renderer manifests and entry modules here.',
    keywords: ['renderer', 'shell renderer', 'workbench runtime', 'theme renderer'],
    releaseDirectoryName: 'shell-renderers',
    legacyRelativeDirectoryName: 'shell-renderers',
    envVarSuffix: 'SHELL_RENDERERS',
    order: 62,
  },
  {
    id: 'themeRecipes',
    label: 'Theme Recipes',
    description: 'Author reusable workbench, explorer, and dock recipe packs here.',
    keywords: ['theme recipe', 'workbench', 'explorer', 'dock'],
    releaseDirectoryName: 'theme-recipes',
    legacyRelativeDirectoryName: 'theme-recipes',
    envVarSuffix: 'THEME_RECIPES',
    order: 64,
  },
  {
    id: 'themeEngines',
    label: 'Theme Engines',
    description: 'Author reusable theme engine manifests and design-token packs here.',
    keywords: ['theme engine', 'design token', 'layout primitive', 'render style'],
    releaseDirectoryName: 'theme-engines',
    legacyRelativeDirectoryName: 'theme-engines',
    envVarSuffix: 'THEME_ENGINES',
    order: 66,
  },
  {
    id: 'notes',
    label: 'Notes',
    description: 'Managed notes live here in development and release builds.',
    keywords: ['notes', 'scratchpad', 'documents'],
    releaseDirectoryName: 'notes',
    legacyRelativeDirectoryName: 'notes',
    envVarSuffix: 'NOTES',
    order: 70,
  },
  {
    id: 'screenshots',
    label: 'Screenshots',
    description: 'Saved captures and annotated proof land here.',
    keywords: ['screenshot', 'capture', 'proof'],
    releaseDirectoryName: 'screenshots',
    legacyRelativeDirectoryName: 'Screenshots',
    envVarSuffix: 'SCREENSHOTS',
    order: 80,
  },
] as const satisfies readonly ManagedContentDirectoryDefinition[];

export type ManagedContentDirectoryId = typeof managedContentDirectoryCatalog[number]['id'];

const managedContentDirectoryLookup = new Map(
  managedContentDirectoryCatalog.map(entry => [entry.id, entry] as const),
);

const LEGACY_SCREENSHOT_DEFAULT_DIRECTORY = 'M:\\Assets\\Showcase\\TermOverlay';
const CURRENT_RELEASE_APP_IDENTIFIER = 'co.greeblefs.app';
const LEGACY_RELEASE_APP_IDENTIFIER = 'co.overlayterm.app';

let initializedManagedDirectories = false;
let initializationPromise: Promise<void> | null = null;
let resolvedManagedDirectories: Partial<Record<ManagedContentDirectoryId, string>> = {};
let resolvedLegacyHomeDirectories: Partial<Record<ManagedContentDirectoryId, string>> = {};
let resolvedLegacyReleaseDirectories: Partial<Record<ManagedContentDirectoryId, string>> = {};

function readDirectoryOverride(id: ManagedContentDirectoryId): string | null {
  const env = import.meta.env as Record<string, string | undefined>;

  const directoryDefinition = managedContentDirectoryLookup.get(id);
  if (!directoryDefinition) {
    return null;
  }

  const rawValue = env[`VITE_GREEBLEFS_${directoryDefinition.envVarSuffix}_DIR`]
    ?? env[`VITE_OVERLAYTERM_${directoryDefinition.envVarSuffix}_DIR`];

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
  return Object.fromEntries(
    await Promise.all(
      managedContentDirectoryCatalog.map(async entry => [entry.id as ManagedContentDirectoryId, await join(root, entry.releaseDirectoryName)] as const),
    ),
  ) as Record<ManagedContentDirectoryId, string>;
}

async function buildLegacyHomeDirectoryMap(): Promise<Record<ManagedContentDirectoryId, string>> {
  const root = (await homeDir()).replace(/[\\/]+$/, '');
  return Object.fromEntries(
    await Promise.all(
      managedContentDirectoryCatalog.map(async entry => [entry.id as ManagedContentDirectoryId, await join(root, entry.legacyRelativeDirectoryName)] as const),
    ),
  ) as Record<ManagedContentDirectoryId, string>;
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

  return Object.fromEntries(
    await Promise.all(
      managedContentDirectoryCatalog.map(async entry => [entry.id as ManagedContentDirectoryId, await join(legacyRoot, entry.releaseDirectoryName)] as const),
    ),
  ) as Partial<Record<ManagedContentDirectoryId, string>>;
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

      for (const entry of managedContentDirectoryCatalog) {
        const id = entry.id as ManagedContentDirectoryId;
        const overrideDirectory = readDirectoryOverride(id);
        resolvedManagedDirectories[id] = overrideDirectory ?? releaseDirectories[id];
      }

      for (const entry of managedContentDirectoryCatalog) {
        const id = entry.id as ManagedContentDirectoryId;
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
  const directoryDefinition = managedContentDirectoryLookup.get(id);
  if (!directoryDefinition) {
    return id;
  }

  const overrideDirectory = readDirectoryOverride(id);
  if (overrideDirectory) {
    return overrideDirectory;
  }

  const resolvedDirectory = resolvedManagedDirectories[id];
  if (typeof resolvedDirectory === 'string' && resolvedDirectory.length > 0) {
    return resolvedDirectory;
  }

  return directoryDefinition.legacyRelativeDirectoryName;
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
