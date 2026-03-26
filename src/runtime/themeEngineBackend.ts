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
  renderStyleLookup: Record<string, ExplorerThemeRenderStyleManifest>;
  defaultRenderStyle: ExplorerThemeRenderStyleManifest | null;
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

export function compileThemeEngineManifest(manifest: ExplorerThemeManifest): CompiledThemeEngineManifest {
  const renderStyleLookup = Object.fromEntries(
    manifest.renderStyles.map(style => [style.id, style] as const),
  );
  const defaultRenderStyle = manifest.defaultRenderStyleId
    ? (renderStyleLookup[manifest.defaultRenderStyleId] ?? null)
    : (manifest.renderStyles[0] ?? null);

  return {
    manifest,
    renderStyleLookup,
    defaultRenderStyle,
    supportsHotSwappingRenderStyles: manifest.renderStyles.every(style => style.supportsLiveSwap),
  };
}

export function normalizeThemeManifestDraft(
  draft: Partial<ExplorerThemeManifest> & Pick<ExplorerThemeManifest, 'id' | 'name'>,
): ExplorerThemeManifest {
  const presentation: ExplorerThemePresentation = draft.presentation ?? {
    density: 'comfortable',
    chromeStyle: 'floating',
    iconStyle: 'vector',
    motionStyle: 'fluid',
    cornerRadius: 12,
    panelSpacing: 8,
  };

  return {
    id: draft.id,
    name: draft.name,
    extends: draft.extends ?? null,
    presentation,
    compatibility: draft.compatibility ?? {
      shellBlueprints: [],
      tags: [],
    },
    designTokens: draft.designTokens ?? [],
    layoutPrimitives: draft.layoutPrimitives ?? [],
    navigationPatterns: draft.navigationPatterns ?? [],
    animationProfiles: draft.animationProfiles ?? [],
    iconPacks: draft.iconPacks ?? [],
    renderStyles: draft.renderStyles ?? [],
    defaultRenderStyleId: draft.defaultRenderStyleId ?? null,
  };
}
