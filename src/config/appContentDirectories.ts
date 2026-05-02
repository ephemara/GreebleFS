import { isTauri } from "@tauri-apps/api/core";
import { appLocalDataDir, homeDir, join } from "@tauri-apps/api/path";
import { exists, mkdir, rename } from "@tauri-apps/plugin-fs";

import {
  getGreebleUsrShippedRelativeDirectory,
  getGreebleUsrManifestEntry,
  greebleUsrManagedContentEntries,
  LEGACY_USR_SOURCE_ROOT_ENV_VAR,
  PRIMARY_USR_SOURCE_ROOT_ENV_VAR,
} from "./usrManifest";

export interface ManagedContentDirectoryDefinition {
  id: string;
  label: string;
  description: string;
  keywords: readonly string[];
  relativeDirectoryName: string;
  legacyRelativeDirectoryName: string;
  envVarSuffix?: string;
  order: number;
  shippingMode: "shipped" | "runtime-state";
}

interface ManagedContentDirectoryMetadata {
  label: string;
  description: string;
  keywords: readonly string[];
  order: number;
}

interface ManagedContentRootsSnapshot {
  bundledUsrRoot: string;
  writableRoot: string;
}

export interface ManagedContentDirectoryStackOverride {
  laneId: string;
  directories: string[];
  writableDirectory: string;
}

const shippedManagedDirectoryMetadata = {
  plugins: {
    label: "Plugins",
    description: "Drop TSX panels and runtime modules here.",
    keywords: ["plugin", "panel", "runtime module", "command"],
    order: 10,
  },
  themes: {
    label: "Themes",
    description:
      "Drop native theme bundles plus VS Code color-theme extension folders or .vsix archives here.",
    keywords: ["theme", "theme bundle", "appearance", "catalog"],
    order: 20,
  },
  appearancePacks: {
    label: "Appearance Packs",
    description:
      "Author reusable color, typography, and chrome look packs here.",
    keywords: ["appearance", "theme look", "palette", "visual identity"],
    order: 22,
  },
  topBars: {
    label: "Top Bars",
    description: "Author standalone shell chrome workflows here.",
    keywords: ["top bar", "chrome", "header", "shell chrome"],
    order: 25,
  },
  dockPresentations: {
    label: "Dock Presentations",
    description:
      "Author dock placement, sizing, preview policy, and dock top-bar contracts here.",
    keywords: [
      "dock",
      "presentation",
      "floating",
      "yakuake",
      "preview",
    ],
    order: 25.5,
  },
  explorerLayouts: {
    label: "Explorer Layouts",
    description:
      "Author file-backed explorer layouts, chrome snapshots, and pane presets here.",
    keywords: [
      "explorer layout",
      "layout preset",
      "chrome snapshot",
      "workspace header",
    ],
    order: 26,
  },
  explorerChromeLayouts: {
    label: "Explorer Chrome Layouts",
    description:
      "Author movable explorer chrome placement manifests for topbar, toolbar, workspace, preview, and status surfaces here.",
    keywords: [
      "explorer chrome",
      "control placement",
      "header layout",
      "toolbar layout",
    ],
    order: 26.2,
  },
  explorerCustomizeControls: {
    label: "Explorer Customize Controls",
    description:
      "Author the explorer control catalog, per-control capabilities, and customize-browser metadata here.",
    keywords: [
      "explorer customize",
      "control catalog",
      "movable controls",
      "chrome controls",
    ],
    order: 26.4,
  },
  explorerModeProfiles: {
    label: "Explorer Mode Profiles",
    description:
      "Author user-facing explorer mode profiles that map layout cards onto shell and chrome behavior here.",
    keywords: ["explorer mode", "mode profile", "view bias", "layout card"],
    order: 26.6,
  },
  explorerShellLayouts: {
    label: "Explorer Shell Layouts",
    description:
      "Author pane-composition presets for preview placement, source visibility, and width bias here.",
    keywords: [
      "explorer shell layout",
      "preview placement",
      "rail width",
      "pane composition",
    ],
    order: 26.8,
  },
  explorerWorkspaceLayouts: {
    label: "Explorer Workspace Layouts",
    description:
      "Author multi-pane explorer workspace templates and visible-pane topologies here.",
    keywords: [
      "workspace layout",
      "split view",
      "multi-pane explorer",
      "pane topology",
    ],
    order: 27,
  },
  explorerExperimentalModes: {
    label: "Explorer Experimental Modes",
    description:
      "Author experimental explorer view-mode catalogs, density stops, and density labels here.",
    keywords: [
      "experimental explorer",
      "constellation",
      "timeline",
      "adaptive grid",
    ],
    order: 27.2,
  },
  explorerZoomBehaviors: {
    label: "Explorer Zoom Behaviors",
    description:
      "Author Explorer ctrl/cmd-wheel routing, detent thresholds, oversize scaling, and gesture-tuning tokens here.",
    keywords: [
      "explorer zoom",
      "ctrl wheel",
      "layout zoom",
      "gesture tuning",
      "zoom tokens",
    ],
    order: 27.4,
  },
  explorerPerformance: {
    label: "Explorer Performance",
    description:
      "Author Explorer hot-path interaction tuning and latency budgets here.",
    keywords: [
      "explorer performance",
      "folder activation",
      "double click",
      "latency budget",
      "navigation warm",
    ],
    order: 27.6,
  },
  homePacks: {
    label: "Home Packs",
    description:
      "Author explorer home dashboards, presets, and runtime modules here.",
    keywords: ["home", "home pack", "dashboard", "start page"],
    order: 28,
  },
  menuPacks: {
    label: "Menu Packs",
    description:
      "Author explorer menu layouts, submenus, and presentation-ready packs here.",
    keywords: ["menu", "context menu", "submenu", "explorer menu"],
    order: 29,
  },
  actions: {
    label: "Actions",
    description:
      "Author runnable explorer actions, script packs, and custom pipeline commands here.",
    keywords: [
      "actions",
      "scripts",
      "pipelines",
      "context menu actions",
      "automation",
    ],
    order: 29.5,
  },
  runtimes: {
    label: "Runtime Packages",
    description:
      "Drop authored polyglot runtime packages (Go, Wasm, Python sidecars) here. Each runtime owns a `runtime.toml` plus its source tree.",
    keywords: [
      "runtime",
      "sidecar",
      "wasm",
      "panel",
      "go",
      "python sidecar",
      "native command",
    ],
    order: 29.7,
  },
  iconThemes: {
    label: "Icon Themes",
    description:
      "Drop native icon-theme packs plus VS Code icon-theme extension folders or .vsix archives here.",
    keywords: ["icons", "icon theme", "folder icons", "ui icons"],
    order: 30,
  },
  interactionMotionPacks: {
    label: "Interaction Motion",
    description: "Author theme-selectable interaction motion defaults here.",
    keywords: ["interaction motion", "motion", "hover", "press"],
    order: 35,
  },
  layoutDynamics: {
    label: "Layout Dynamics",
    description:
      "Author layout-dynamics presets and surface profiles for movable chrome here.",
    keywords: [
      "layout dynamics",
      "authoring physics",
      "movable chrome",
      "surface profile",
    ],
    order: 35.5,
  },
  hotkeys: {
    label: "Hotkeys",
    description:
      "Author the shipped hotkey binding catalog and default shortcut map here.",
    keywords: ["hotkeys", "shortcuts", "keybindings", "gesture bindings"],
    order: 35.7,
  },
  soundPacks: {
    label: "Sound Packs",
    description:
      "Author theme-selectable shell sound packs and notification cues here.",
    keywords: [
      "sound",
      "sound pack",
      "audio cue",
      "notification sound",
      "ui sound",
    ],
    order: 36,
  },
  shaders: {
    label: "Shaders",
    description: "Author shell shader profiles with surface-level controls.",
    keywords: ["shader", "render", "visuals"],
    order: 40,
  },
  animations: {
    label: "Animations",
    description: "Author open and close motion modules here.",
    keywords: ["animation", "motion", "transition"],
    order: 50,
  },
  wallpapers: {
    label: "Wallpapers",
    description: "Import images, videos, and live wallpaper modules here.",
    keywords: ["wallpaper", "background", "video wallpaper", "live wallpaper"],
    order: 60,
  },
  shellRenderers: {
    label: "Shell Renderers",
    description:
      "Author standalone theme renderer manifests and entry modules here.",
    keywords: [
      "renderer",
      "shell renderer",
      "workbench runtime",
      "theme renderer",
    ],
    order: 62,
  },
  themeRecipes: {
    label: "Theme Recipes",
    description:
      "Author reusable workbench, explorer, and dock recipe packs here.",
    keywords: ["theme recipe", "workbench", "explorer", "dock"],
    order: 64,
  },
  themeEngines: {
    label: "Theme Engines",
    description:
      "Author reusable theme engine manifests and design-token packs here.",
    keywords: [
      "theme engine",
      "design token",
      "layout primitive",
      "render style",
    ],
    order: 66,
  },
} as const satisfies Record<string, ManagedContentDirectoryMetadata>;

type ShippedManagedContentDirectoryId =
  keyof typeof shippedManagedDirectoryMetadata;
export type ManagedContentDirectoryId =
  | ShippedManagedContentDirectoryId
  | "notes"
  | "screenshots";

const runtimeStateDirectoryDefinitions = [
  {
    id: "notes",
    label: "Notes",
    description: "Managed notes live here in development and release builds.",
    keywords: ["notes", "scratchpad", "documents"],
    relativeDirectoryName: "notes",
    legacyRelativeDirectoryName: "notes",
    envVarSuffix: "NOTES",
    order: 70,
    shippingMode: "runtime-state",
  },
] as const satisfies readonly ManagedContentDirectoryDefinition[];

const disabledRuntimeStateDirectoryDefinitions = [
  {
    id: "screenshots",
    label: "Screenshots",
    description: "Saved captures and annotated proof land here.",
    keywords: ["screenshot", "capture", "proof"],
    relativeDirectoryName: "screenshots",
    legacyRelativeDirectoryName: "Screenshots",
    envVarSuffix: "SCREENSHOTS",
    order: 80,
    shippingMode: "runtime-state",
  },
] as const satisfies readonly ManagedContentDirectoryDefinition[];

function createShippedManagedDirectoryDefinitions(): ManagedContentDirectoryDefinition[] {
  return greebleUsrManagedContentEntries.map((entry) => {
    const metadata =
      shippedManagedDirectoryMetadata[
        entry.id as ShippedManagedContentDirectoryId
      ];
    if (!metadata) {
      throw new Error(
        `usr/manifest.json contains an unknown managed content lane: ${entry.id}`,
      );
    }

    return {
      id: entry.id,
      label: metadata.label,
      description: metadata.description,
      keywords: metadata.keywords,
      relativeDirectoryName: getGreebleUsrShippedRelativeDirectory(entry),
      legacyRelativeDirectoryName: entry.relativeDirectory,
      envVarSuffix: entry.envVarSuffix,
      order: metadata.order,
      shippingMode: "shipped",
    };
  });
}

const allManagedContentDirectoryDefinitions = [
  ...createShippedManagedDirectoryDefinitions(),
  ...runtimeStateDirectoryDefinitions,
] as const satisfies readonly ManagedContentDirectoryDefinition[];

export const managedContentDirectoryCatalog = allManagedContentDirectoryDefinitions;

const managedContentDirectoryLookup = new Map(
  [
    ...allManagedContentDirectoryDefinitions,
    ...disabledRuntimeStateDirectoryDefinitions,
  ].map((entry) => [entry.id, entry] as const),
);

const LEGACY_SCREENSHOT_DEFAULT_DIRECTORY = "M:\\Assets\\Showcase\\TermOverlay";
const CURRENT_RELEASE_APP_IDENTIFIER = "co.greeblefs.app";
const LEGACY_RELEASE_APP_IDENTIFIER = "co.overlayterm.app";

let initializedManagedDirectories = false;
let initializationPromise: Promise<void> | null = null;
let resolvedManagedDirectories: Partial<
  Record<ManagedContentDirectoryId, string>
> = {};
let resolvedLegacyHomeDirectories: Partial<
  Record<ManagedContentDirectoryId, string>
> = {};
let resolvedLegacyReleaseDirectories: Partial<
  Record<ManagedContentDirectoryId, string>
> = {};
let managedContentDirectorySearchOverrides: Partial<
  Record<ManagedContentDirectoryId, string[]>
> = {};
let managedContentPrimaryDirectoryOverrides: Partial<
  Record<ManagedContentDirectoryId, string>
> = {};

function readDirectoryOverride(id: ManagedContentDirectoryId): string | null {
  const env = import.meta.env as Record<string, string | undefined>;

  const directoryDefinition = managedContentDirectoryLookup.get(id);
  if (!directoryDefinition?.envVarSuffix) {
    return null;
  }

  const rawValue =
    env[`VITE_GREEBLEFS_${directoryDefinition.envVarSuffix}_DIR`] ??
    env[`VITE_OVERLAYTERM_${directoryDefinition.envVarSuffix}_DIR`];
  const normalizedValue = typeof rawValue === "string" ? rawValue.trim() : "";
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function readUsrSourceRootOverride(): string | null {
  const env = import.meta.env as Record<string, string | undefined>;
  const rawValue =
    env[PRIMARY_USR_SOURCE_ROOT_ENV_VAR] ?? env[LEGACY_USR_SOURCE_ROOT_ENV_VAR];
  const normalizedValue = typeof rawValue === "string" ? rawValue.trim() : "";
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function appendRelativePath(
  basePath: string,
  relativeDirectory: string,
): string {
  const normalizedBasePath = basePath.replace(/[\\/]+$/, "");
  const separator =
    normalizedBasePath.includes("\\") && !normalizedBasePath.includes("/")
      ? "\\"
      : "/";
  return `${normalizedBasePath}${separator}${relativeDirectory}`;
}

function normalizePathForComparison(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

function shouldUseReleaseManagedDirectories(): boolean {
  return isTauri() && !import.meta.env.DEV;
}

async function resolveNativeManagedContentRoots(): Promise<ManagedContentRootsSnapshot | null> {
  if (!isTauri()) {
    return null;
  }

  try {
    const { commands, unwrapTauriResult } =
      await import("../runtime/tauriClient");
    const resolvedRoots = await commands
      .startupResolveManagedContentRoots()
      .then(unwrapTauriResult);
    const bundledUsrRoot = resolvedRoots.bundledUsrRoot?.trim();
    const writableRoot = resolvedRoots.writableRoot?.trim();

    if (!bundledUsrRoot || !writableRoot) {
      return null;
    }

    return {
      bundledUsrRoot,
      writableRoot,
    };
  } catch (error) {
    console.warn(
      "GreebleFS: failed to resolve native managed content roots",
      error,
    );
    return null;
  }
}

async function buildReleaseManagedDirectoryMap(): Promise<
  Record<ManagedContentDirectoryId, string>
> {
  const appLocalDataRoot = (await appLocalDataDir()).replace(/[\\/]+$/, "");
  const managedContentRoots = await resolveNativeManagedContentRoots();

  const writableManagedRoot = managedContentRoots?.writableRoot
    ? managedContentRoots.writableRoot.replace(/[\\/]+$/, "")
    : await join(appLocalDataRoot, "usr");

  const resolvedEntries = await Promise.all(
    managedContentDirectoryCatalog.map(async (entry) => {
      const targetRoot =
        entry.shippingMode === "shipped"
          ? writableManagedRoot
          : appLocalDataRoot;
      return [
        entry.id as ManagedContentDirectoryId,
        await join(targetRoot, entry.relativeDirectoryName),
      ] as const;
    }),
  );

  return Object.fromEntries(resolvedEntries) as Record<
    ManagedContentDirectoryId,
    string
  >;
}

async function buildLegacyHomeDirectoryMap(): Promise<
  Record<ManagedContentDirectoryId, string>
> {
  const root = (await homeDir()).replace(/[\\/]+$/, "");
  return Object.fromEntries(
    await Promise.all(
      managedContentDirectoryCatalog.map(
        async (entry) =>
          [
            entry.id as ManagedContentDirectoryId,
            await join(root, entry.legacyRelativeDirectoryName),
          ] as const,
      ),
    ),
  ) as Record<ManagedContentDirectoryId, string>;
}

function replaceTrailingDirectoryName(
  path: string,
  fromName: string,
  toName: string,
): string | null {
  const escapedFromName = fromName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`([\\\\/])${escapedFromName}$`);
  if (!pattern.test(path)) {
    return null;
  }

  return path.replace(pattern, `$1${toName}`);
}

async function buildLegacyReleaseDirectoryMap(): Promise<
  Partial<Record<ManagedContentDirectoryId, string>>
> {
  const releaseRoot = (await appLocalDataDir()).replace(/[\\/]+$/, "");
  const legacyRoot = replaceTrailingDirectoryName(
    releaseRoot,
    CURRENT_RELEASE_APP_IDENTIFIER,
    LEGACY_RELEASE_APP_IDENTIFIER,
  );

  if (
    !legacyRoot ||
    normalizePathForComparison(legacyRoot) ===
      normalizePathForComparison(releaseRoot)
  ) {
    return {};
  }

  return Object.fromEntries(
    await Promise.all(
      managedContentDirectoryCatalog.map(
        async (entry) =>
          [
            entry.id as ManagedContentDirectoryId,
            await join(legacyRoot, entry.legacyRelativeDirectoryName),
          ] as const,
      ),
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

  if (
    normalizePathForComparison(legacyDirectory) ===
    normalizePathForComparison(nextDirectory)
  ) {
    return;
  }

  if (!(await exists(legacyDirectory))) {
    return;
  }

  if (await exists(nextDirectory)) {
    return;
  }

  const parentDirectory = await join(nextDirectory, "..");
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

      const [
        releaseDirectories,
        legacyHomeDirectories,
        legacyReleaseDirectories,
      ] = await Promise.all([
        buildReleaseManagedDirectoryMap(),
        buildLegacyHomeDirectoryMap(),
        buildLegacyReleaseDirectoryMap(),
      ]);

      resolvedLegacyHomeDirectories = legacyHomeDirectories;
      resolvedLegacyReleaseDirectories = legacyReleaseDirectories;

      for (const entry of managedContentDirectoryCatalog) {
        const id = entry.id as ManagedContentDirectoryId;
        const overrideDirectory = readDirectoryOverride(id);
        resolvedManagedDirectories[id] =
          overrideDirectory ?? releaseDirectories[id];
      }

      for (const entry of managedContentDirectoryCatalog) {
        const id = entry.id as ManagedContentDirectoryId;
        if (readDirectoryOverride(id)) {
          continue;
        }

        const nextDirectory = resolvedManagedDirectories[id];
        if (typeof nextDirectory === "string" && nextDirectory.length > 0) {
          await migrateLegacyDirectory(
            resolvedLegacyHomeDirectories[id],
            nextDirectory,
          );
          await migrateLegacyDirectory(
            resolvedLegacyReleaseDirectories[id],
            nextDirectory,
          );
        }
      }
    } catch (error) {
      console.warn(
        "GreebleFS: failed to initialize managed content directories",
        error,
      );
    } finally {
      initializedManagedDirectories = true;
    }
  })();

  return initializationPromise;
}

export function getManagedContentDirectory(
  id: ManagedContentDirectoryId,
): string {
  const directoryDefinition = managedContentDirectoryLookup.get(id);
  if (!directoryDefinition) {
    return id;
  }

  const overrideDirectory = readDirectoryOverride(id);
  if (overrideDirectory) {
    return overrideDirectory;
  }

  const resolvedDirectory = resolvedManagedDirectories[id];
  if (typeof resolvedDirectory === "string" && resolvedDirectory.length > 0) {
    return resolvedDirectory;
  }

  if (directoryDefinition.shippingMode === "shipped") {
    const manifestEntry = getGreebleUsrManifestEntry(id);
    if (manifestEntry) {
      const usrRootOverride = readUsrSourceRootOverride();
      return appendRelativePath(
        usrRootOverride ?? "usr",
        getGreebleUsrShippedRelativeDirectory(manifestEntry),
      );
    }
  }

  return directoryDefinition.legacyRelativeDirectoryName;
}

export function applyManagedContentDirectoryStackOverrides(
  overrides: ManagedContentDirectoryStackOverride[],
): void {
  const nextSearchOverrides: Partial<Record<ManagedContentDirectoryId, string[]>> = {};
  const nextPrimaryOverrides: Partial<Record<ManagedContentDirectoryId, string>> = {};

  for (const override of overrides) {
    const directoryId = override.laneId as ManagedContentDirectoryId;
    if (!managedContentDirectoryLookup.has(directoryId)) {
      continue;
    }

    const normalizedDirectories = override.directories
      .filter(
        (directory): directory is string =>
          typeof directory === 'string' && directory.trim().length > 0,
      )
      .map((directory) => directory.trim());
    if (normalizedDirectories.length === 0) {
      continue;
    }

    nextSearchOverrides[directoryId] = normalizedDirectories;
    const writableDirectory =
      typeof override.writableDirectory === 'string' &&
      override.writableDirectory.trim().length > 0
        ? override.writableDirectory.trim()
        : normalizedDirectories[0];
    nextPrimaryOverrides[directoryId] = writableDirectory;
  }

  managedContentDirectorySearchOverrides = nextSearchOverrides;
  managedContentPrimaryDirectoryOverrides = nextPrimaryOverrides;
}

export function clearManagedContentDirectoryStackOverrides(): void {
  managedContentDirectorySearchOverrides = {};
  managedContentPrimaryDirectoryOverrides = {};
}

export function getManagedContentDirectorySearchDirectories(
  id: ManagedContentDirectoryId,
): string[] {
  const overriddenDirectories = managedContentDirectorySearchOverrides[id];
  if (Array.isArray(overriddenDirectories) && overriddenDirectories.length > 0) {
    return [...overriddenDirectories];
  }

  return [getManagedContentDirectory(id)];
}

export function getManagedContentPrimaryDirectory(
  id: ManagedContentDirectoryId,
): string {
  const overriddenDirectory = managedContentPrimaryDirectoryOverrides[id];
  if (typeof overriddenDirectory === 'string' && overriddenDirectory.length > 0) {
    return overriddenDirectory;
  }

  return getManagedContentDirectory(id);
}

export function isLegacyScreenshotDirectory(
  path: string | null | undefined,
): boolean {
  if (typeof path !== "string" || path.trim().length === 0) {
    return false;
  }

  const normalizedPath = normalizePathForComparison(path.trim());
  if (
    normalizedPath ===
    normalizePathForComparison(LEGACY_SCREENSHOT_DEFAULT_DIRECTORY)
  ) {
    return true;
  }

  const legacyHomeDirectory = resolvedLegacyHomeDirectories.screenshots;
  if (
    typeof legacyHomeDirectory === "string" &&
    normalizePathForComparison(legacyHomeDirectory) === normalizedPath
  ) {
    return true;
  }

  const legacyReleaseDirectory = resolvedLegacyReleaseDirectories.screenshots;
  return (
    typeof legacyReleaseDirectory === "string" &&
    normalizePathForComparison(legacyReleaseDirectory) === normalizedPath
  );
}
