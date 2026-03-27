import { commands } from './tauriClient';
import type {
  ThemeAnimationProfile,
  ThemeCompatibility,
  ThemeDesignToken,
  ThemeIconPackManifest,
  ThemeLayoutPrimitive,
  ThemeManifest,
  ThemeNavigationPattern,
  ThemePresentation,
  ThemeRenderStyleManifest,
  WorkbenchPreset,
} from '../generated/tauri';

export type ExplorerThemeManifest = ThemeManifest;
export type ExplorerThemePresentation = ThemePresentation;
export type ExplorerThemeCompatibility = ThemeCompatibility;
export type ExplorerThemeDesignToken = ThemeDesignToken;
export type ExplorerThemeLayoutPrimitive = ThemeLayoutPrimitive;
export type ExplorerThemeNavigationPattern = ThemeNavigationPattern;
export type ExplorerThemeAnimationProfile = ThemeAnimationProfile;
export type ExplorerThemeIconPackManifest = ThemeIconPackManifest;
export type ExplorerThemeRenderStyleManifest = ThemeRenderStyleManifest;
export type ExplorerWorkbenchPreset = WorkbenchPreset;

export interface CompiledThemeEngineManifest {
  manifest: ExplorerThemeManifest;
  designTokenLookup: Record<string, ExplorerThemeDesignToken>;
  layoutPrimitiveLookup: Record<string, ExplorerThemeLayoutPrimitive>;
  navigationPatternLookup: Record<string, ExplorerThemeNavigationPattern>;
  animationProfileLookup: Record<string, ExplorerThemeAnimationProfile>;
  iconPackLookup: Record<string, ExplorerThemeIconPackManifest>;
  renderStyleLookup: Record<string, ExplorerThemeRenderStyleManifest>;
  defaultDesignToken: ExplorerThemeDesignToken | null;
  defaultLayoutPrimitive: ExplorerThemeLayoutPrimitive | null;
  defaultNavigationPattern: ExplorerThemeNavigationPattern | null;
  defaultAnimationProfile: ExplorerThemeAnimationProfile | null;
  defaultIconPack: ExplorerThemeIconPackManifest | null;
  defaultRenderStyle: ExplorerThemeRenderStyleManifest | null;
  capabilitySummary: {
    designTokens: number;
    layoutPrimitives: number;
    navigationPatterns: number;
    animationProfiles: number;
    iconPacks: number;
    renderStyles: number;
  };
  supportsHotSwappingRenderStyles: boolean;
}

export interface ThemeEngineCatalog {
  manifests: ExplorerThemeManifest[];
  presets: ExplorerWorkbenchPreset[];
}

export async function listThemeEngineCatalog(): Promise<ThemeEngineCatalog> {
  const [manifests, presets] = await Promise.all([
    commands.domainListThemeManifests(),
    commands.domainListWorkbenchPresets(),
  ]);

  return {
    manifests,
    presets,
  };
}

function createLookup<T extends { id: string }>(entries: readonly T[]): Record<string, T> {
  return Object.fromEntries(entries.map(entry => [entry.id, entry] as const));
}

function pickDefault<T extends { id: string }>(
  entries: readonly T[],
  lookup: Record<string, T>,
  preferredId?: string | null,
): T | null {
  if (preferredId) {
    return lookup[preferredId] ?? entries[0] ?? null;
  }
  return entries[0] ?? null;
}

export function compileThemeEngineManifest(manifest: ExplorerThemeManifest): CompiledThemeEngineManifest {
  const designTokenLookup = createLookup(manifest.designTokens);
  const layoutPrimitiveLookup = createLookup(manifest.layoutPrimitives);
  const navigationPatternLookup = createLookup(manifest.navigationPatterns);
  const animationProfileLookup = createLookup(manifest.animationProfiles);
  const iconPackLookup = createLookup(manifest.iconPacks);
  const renderStyleLookup = createLookup(manifest.renderStyles);
  const defaultDesignToken = pickDefault(manifest.designTokens, designTokenLookup);
  const defaultLayoutPrimitive = pickDefault(manifest.layoutPrimitives, layoutPrimitiveLookup, manifest.defaultLayoutPrimitiveId);
  const defaultNavigationPattern = pickDefault(manifest.navigationPatterns, navigationPatternLookup, manifest.defaultNavigationPatternId);
  const defaultAnimationProfile = pickDefault(manifest.animationProfiles, animationProfileLookup, manifest.defaultAnimationProfileId);
  const defaultIconPack = pickDefault(manifest.iconPacks, iconPackLookup, manifest.defaultIconPackId);
  const defaultRenderStyle = pickDefault(manifest.renderStyles, renderStyleLookup, manifest.defaultRenderStyleId);

  return {
    manifest,
    designTokenLookup,
    layoutPrimitiveLookup,
    navigationPatternLookup,
    animationProfileLookup,
    iconPackLookup,
    renderStyleLookup,
    defaultDesignToken,
    defaultLayoutPrimitive,
    defaultNavigationPattern,
    defaultAnimationProfile,
    defaultIconPack,
    defaultRenderStyle,
    capabilitySummary: {
      designTokens: manifest.designTokens.length,
      layoutPrimitives: manifest.layoutPrimitives.length,
      navigationPatterns: manifest.navigationPatterns.length,
      animationProfiles: manifest.animationProfiles.length,
      iconPacks: manifest.iconPacks.length,
      renderStyles: manifest.renderStyles.length,
    },
    supportsHotSwappingRenderStyles: manifest.renderStyles.length > 0
      && manifest.renderStyles.every(style => style.supportsLiveSwap),
  };
}

export function normalizeThemeManifestDraft(
  draft: Partial<ExplorerThemeManifest> & Pick<ExplorerThemeManifest, 'id' | 'name'>,
): ExplorerThemeManifest {
  const presentationDefaults: ExplorerThemePresentation = {
    density: 'comfortable',
    chromeStyle: 'floating',
    iconStyle: 'vector',
    motionStyle: 'fluid',
    cornerRadius: 12,
    panelSpacing: 8,
  };
  const presentation: ExplorerThemePresentation = {
    ...presentationDefaults,
    ...(draft.presentation ?? {}),
  };
  const compatibility: ExplorerThemeCompatibility = {
    shellBlueprints: Array.from(new Set(
      (draft.compatibility?.shellBlueprints ?? [])
        .filter((entry): entry is ExplorerThemeCompatibility['shellBlueprints'][number] => typeof entry === 'string' && entry.trim().length > 0)
        .map(entry => entry.trim() as ExplorerThemeCompatibility['shellBlueprints'][number]),
    )),
    tags: Array.from(new Set(
      (draft.compatibility?.tags ?? [])
        .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
        .map(entry => entry.trim()),
    )),
  };

  return {
    id: draft.id,
    name: draft.name,
    extends: draft.extends ?? null,
    presentation,
    compatibility,
    designTokens: draft.designTokens ?? [],
    layoutPrimitives: draft.layoutPrimitives ?? [],
    navigationPatterns: draft.navigationPatterns ?? [],
    animationProfiles: draft.animationProfiles ?? [],
    iconPacks: draft.iconPacks ?? [],
    renderStyles: draft.renderStyles ?? [],
    defaultLayoutPrimitiveId: typeof draft.defaultLayoutPrimitiveId === 'string' && draft.defaultLayoutPrimitiveId.trim().length > 0
      ? draft.defaultLayoutPrimitiveId.trim()
      : null,
    defaultNavigationPatternId: typeof draft.defaultNavigationPatternId === 'string' && draft.defaultNavigationPatternId.trim().length > 0
      ? draft.defaultNavigationPatternId.trim()
      : null,
    defaultAnimationProfileId: typeof draft.defaultAnimationProfileId === 'string' && draft.defaultAnimationProfileId.trim().length > 0
      ? draft.defaultAnimationProfileId.trim()
      : null,
    defaultIconPackId: typeof draft.defaultIconPackId === 'string' && draft.defaultIconPackId.trim().length > 0
      ? draft.defaultIconPackId.trim()
      : null,
    defaultRenderStyleId: typeof draft.defaultRenderStyleId === 'string' && draft.defaultRenderStyleId.trim().length > 0
      ? draft.defaultRenderStyleId.trim()
      : null,
  };
}
