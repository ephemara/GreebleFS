import type { ThemePresentation, ThemeValue } from '../generated/tauri';
import type {
  CompiledThemeEngineManifest,
  ExplorerThemeLayoutPrimitive,
  ExplorerThemeNavigationPattern,
  ExplorerThemeRenderStyleManifest,
} from '../runtime/themeEngineBackend';

export interface ThemeEngineRecipeBindingIds {
  layoutPrimitiveId?: string;
  navigationPatternId?: string;
  renderStyleId?: string;
}

export interface ResolvedThemeEngineBindings {
  presentation: ThemePresentation | null;
  layoutPrimitive: ExplorerThemeLayoutPrimitive | null;
  navigationPattern: ExplorerThemeNavigationPattern | null;
  renderStyle: ExplorerThemeRenderStyleManifest | null;
}

function asTrimmedString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function pickThemeEngineEntry<T extends { id: string }>(
  lookup: Record<string, T>,
  fallback: T | null,
  preferredId?: string,
): T | null {
  if (preferredId) {
    return lookup[preferredId] ?? fallback;
  }
  return fallback;
}

export function resolveThemeEngineBindings(
  compiledEngineManifest?: CompiledThemeEngineManifest,
  preferredIds?: ThemeEngineRecipeBindingIds,
): ResolvedThemeEngineBindings {
  if (!compiledEngineManifest) {
    return {
      presentation: null,
      layoutPrimitive: null,
      navigationPattern: null,
      renderStyle: null,
    };
  }

  return {
    presentation: compiledEngineManifest.manifest.presentation,
    layoutPrimitive: pickThemeEngineEntry(
      compiledEngineManifest.layoutPrimitiveLookup,
      compiledEngineManifest.defaultLayoutPrimitive,
      asTrimmedString(preferredIds?.layoutPrimitiveId),
    ),
    navigationPattern: pickThemeEngineEntry(
      compiledEngineManifest.navigationPatternLookup,
      compiledEngineManifest.defaultNavigationPattern,
      asTrimmedString(preferredIds?.navigationPatternId),
    ),
    renderStyle: pickThemeEngineEntry(
      compiledEngineManifest.renderStyleLookup,
      compiledEngineManifest.defaultRenderStyle,
      asTrimmedString(preferredIds?.renderStyleId),
    ),
  };
}

export function readThemeNumberProp(
  props: Partial<Record<string, ThemeValue>> | undefined,
  key: string,
): number | undefined {
  const value = props?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function readThemeBooleanProp(
  props: Partial<Record<string, ThemeValue>> | undefined,
  key: string,
): boolean | undefined {
  const value = props?.[key];
  return typeof value === 'boolean' ? value : undefined;
}

export function readThemeStringProp(
  props: Partial<Record<string, ThemeValue>> | undefined,
  key: string,
): string | undefined {
  const value = props?.[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}
