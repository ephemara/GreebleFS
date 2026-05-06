import { z } from 'zod';

import {
  sanitizeFiniteNumber,
  sanitizeObjectArray,
  sanitizeOptionalTrimmedString,
  sanitizeRecordValues,
  sanitizeRequiredTrimmedString,
} from '../config/schemaSanitizers';

type LooseRecord = Record<string, unknown>;

export type ThemeTokenScale = Record<string, string | number>;

export interface ThemeDesignTokens {
  color: ThemeTokenScale;
  typography: ThemeTokenScale;
  spacing: ThemeTokenScale;
  radius: ThemeTokenScale;
  border: ThemeTokenScale;
  shadow: ThemeTokenScale;
  opacity: ThemeTokenScale;
  blur: ThemeTokenScale;
  geometry: ThemeTokenScale;
  layer: ThemeTokenScale;
  motion: ThemeTokenScale;
  interaction: ThemeTokenScale;
}

export type ThemeLayoutPrimitiveKind = 'stack' | 'grid' | 'split' | 'dock' | 'freeform';

export interface ThemeLayoutPrimitive {
  id: string;
  name: string;
  kind: ThemeLayoutPrimitiveKind;
  props: Record<string, string | number | boolean>;
}

export type ThemeNavigationPatternKind = 'xmb' | 'tabbed' | 'hierarchy' | 'palette' | 'spatial' | 'custom';

export interface ThemeNavigationPattern {
  id: string;
  name: string;
  kind: ThemeNavigationPatternKind;
  axis: 'horizontal' | 'vertical' | 'both';
  props: Record<string, string | number | boolean>;
}

export interface ThemeAnimationProfile {
  id: string;
  name: string;
  durationMs: number;
  easing: string;
  intensity: number;
}

export interface ThemeIconPack {
  id: string;
  name: string;
  style: 'system' | 'vector' | 'pixel' | 'skeuomorphic' | 'custom';
}

export interface ThemeRenderStyle {
  id: string;
  name: string;
  entryClassName?: string;
  description?: string;
}

export interface ThemeEngineManifest {
  schemaVersion: number;
  designTokens: ThemeDesignTokens;
  layoutPrimitives: ThemeLayoutPrimitive[];
  navigationPatterns: ThemeNavigationPattern[];
  animationProfiles: ThemeAnimationProfile[];
  iconPacks: ThemeIconPack[];
  renderStyles: ThemeRenderStyle[];
  defaults: {
    layoutPrimitiveId?: string;
    navigationPatternId?: string;
    animationProfileId?: string;
    iconPackId?: string;
    renderStyleId?: string;
  };
}

export interface ThemeEngineManifestInput {
  schemaVersion?: unknown;
  designTokens?: unknown;
  layoutPrimitives?: unknown;
  navigationPatterns?: unknown;
  animationProfiles?: unknown;
  iconPacks?: unknown;
  renderStyles?: unknown;
  defaults?: unknown;
  defaultLayoutPrimitiveId?: unknown;
  defaultNavigationPatternId?: unknown;
  defaultAnimationProfileId?: unknown;
  defaultIconPackId?: unknown;
  defaultRenderStyleId?: unknown;
}

export interface CompiledThemeEngineContract {
  themeId: string;
  schemaVersion: number;
  manifest: ThemeEngineManifest;
  maps: {
    layoutPrimitives: Map<string, ThemeLayoutPrimitive>;
    navigationPatterns: Map<string, ThemeNavigationPattern>;
    animationProfiles: Map<string, ThemeAnimationProfile>;
    iconPacks: Map<string, ThemeIconPack>;
    renderStyles: Map<string, ThemeRenderStyle>;
  };
  defaults: {
    layoutPrimitive?: ThemeLayoutPrimitive;
    navigationPattern?: ThemeNavigationPattern;
    animationProfile?: ThemeAnimationProfile;
    iconPack?: ThemeIconPack;
    renderStyle?: ThemeRenderStyle;
  };
}

export interface ThemeEngineCapabilitySummary {
  designTokens: number;
  layoutPrimitives: number;
  navigationPatterns: number;
  animationProfiles: number;
  iconPacks: number;
  renderStyles: number;
}

const themeTokenScaleValueSchema = z.union([z.string(), z.number().finite()]);
const themePrimitivePropValueSchema = z.union([
  z.string(),
  z.number().finite(),
  z.boolean(),
]);

const rawThemeLayoutPrimitiveSchema = z.object({
  id: z.unknown().optional(),
  name: z.unknown().optional(),
  kind: z.enum(['stack', 'grid', 'split', 'dock', 'freeform']).catch('stack').optional(),
  props: z.unknown().optional(),
}).strip();

const rawThemeNavigationPatternSchema = z.object({
  id: z.unknown().optional(),
  name: z.unknown().optional(),
  kind: z.enum(['xmb', 'tabbed', 'hierarchy', 'palette', 'spatial', 'custom']).catch('custom').optional(),
  axis: z.enum(['horizontal', 'vertical', 'both']).catch('both').optional(),
  props: z.unknown().optional(),
}).strip();

const rawThemeAnimationProfileSchema = z.object({
  id: z.unknown().optional(),
  name: z.unknown().optional(),
  durationMs: z.unknown().optional(),
  easing: z.unknown().optional(),
  intensity: z.unknown().optional(),
}).strip();

const rawThemeIconPackSchema = z.object({
  id: z.unknown().optional(),
  name: z.unknown().optional(),
  style: z.enum(['system', 'vector', 'pixel', 'skeuomorphic', 'custom']).catch('custom').optional(),
}).strip();

const rawThemeRenderStyleSchema = z.object({
  id: z.unknown().optional(),
  name: z.unknown().optional(),
  entryClassName: z.unknown().optional(),
  className: z.unknown().optional(),
  description: z.unknown().optional(),
}).strip();

function asRecord(value: unknown): LooseRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as LooseRecord;
}

function asTokenScale(value: unknown): ThemeTokenScale {
  return sanitizeRecordValues(value, themeTokenScaleValueSchema) as ThemeTokenScale;
}

function normalizeDesignTokens(value: unknown): ThemeDesignTokens {
  const source = asRecord(value);
  return {
    color: asTokenScale(source?.color),
    typography: asTokenScale(source?.typography),
    spacing: asTokenScale(source?.spacing),
    radius: asTokenScale(source?.radius),
    border: asTokenScale(source?.border),
    shadow: asTokenScale(source?.shadow),
    opacity: asTokenScale(source?.opacity),
    blur: asTokenScale(source?.blur),
    geometry: asTokenScale(source?.geometry),
    layer: asTokenScale(source?.layer),
    motion: asTokenScale(source?.motion),
    interaction: asTokenScale(source?.interaction),
  };
}

function createId(value: unknown, fallbackPrefix: string, index: number): string {
  const explicit = sanitizeRequiredTrimmedString(value)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return explicit || `${fallbackPrefix}-${index + 1}`;
}

function asPrimitiveProps(value: unknown): Record<string, string | number | boolean> {
  return sanitizeRecordValues(value, themePrimitivePropValueSchema) as Record<string, string | number | boolean>;
}

function normalizeLayoutPrimitives(value: unknown): ThemeLayoutPrimitive[] {
  return sanitizeObjectArray(value, rawThemeLayoutPrimitiveSchema).map((record, index) => {
    const kind = record.kind ?? 'stack';
    const id = createId(record.id ?? record.name, 'layout', index);
    return {
      id,
      name: sanitizeRequiredTrimmedString(record.name, id),
      kind,
      props: asPrimitiveProps(record.props),
    };
  });
}

function normalizeNavigationPatterns(value: unknown): ThemeNavigationPattern[] {
  return sanitizeObjectArray(value, rawThemeNavigationPatternSchema).map((record, index) => {
    const kind = record.kind ?? 'custom';
    const axis = record.axis ?? 'both';
    const id = createId(record.id ?? record.name, 'navigation', index);
    return {
      id,
      name: sanitizeRequiredTrimmedString(record.name, id),
      kind,
      axis,
      props: asPrimitiveProps(record.props),
    };
  });
}

function normalizeAnimationProfiles(value: unknown): ThemeAnimationProfile[] {
  return sanitizeObjectArray(value, rawThemeAnimationProfileSchema).map((record, index) => {
    const id = createId(record.id ?? record.name, 'animation-profile', index);
    return {
      id,
      name: sanitizeRequiredTrimmedString(record.name, id),
      durationMs: Math.max(0, sanitizeFiniteNumber(record.durationMs, 240)),
      easing: sanitizeRequiredTrimmedString(record.easing, 'ease'),
      intensity: Math.max(0, sanitizeFiniteNumber(record.intensity, 1)),
    };
  });
}

function normalizeIconPacks(value: unknown): ThemeIconPack[] {
  return sanitizeObjectArray(value, rawThemeIconPackSchema).map((record, index) => {
    const style = record.style ?? 'custom';
    const id = createId(record.id ?? record.name, 'icon-pack', index);
    return {
      id,
      name: sanitizeRequiredTrimmedString(record.name, id),
      style,
    };
  });
}

function normalizeRenderStyles(value: unknown): ThemeRenderStyle[] {
  return sanitizeObjectArray(value, rawThemeRenderStyleSchema).map((record, index) => {
    const id = createId(record.id ?? record.name, 'render-style', index);
    const entryClassName = sanitizeOptionalTrimmedString(record.entryClassName)
      ?? sanitizeOptionalTrimmedString(record.className);
    return {
      id,
      name: sanitizeRequiredTrimmedString(record.name, id),
      entryClassName: entryClassName || undefined,
      description: sanitizeOptionalTrimmedString(record.description) || undefined,
    };
  });
}

export function normalizeThemeEngineManifest(input?: ThemeEngineManifestInput): ThemeEngineManifest {
  const defaultsSource = asRecord(input?.defaults);
  return {
    schemaVersion: Math.max(1, Math.round(sanitizeFiniteNumber(input?.schemaVersion, 1))),
    designTokens: normalizeDesignTokens(input?.designTokens),
    layoutPrimitives: normalizeLayoutPrimitives(input?.layoutPrimitives),
    navigationPatterns: normalizeNavigationPatterns(input?.navigationPatterns),
    animationProfiles: normalizeAnimationProfiles(input?.animationProfiles),
    iconPacks: normalizeIconPacks(input?.iconPacks),
    renderStyles: normalizeRenderStyles(input?.renderStyles),
    defaults: {
      layoutPrimitiveId: sanitizeOptionalTrimmedString(defaultsSource?.layoutPrimitiveId ?? input?.defaultLayoutPrimitiveId),
      navigationPatternId: sanitizeOptionalTrimmedString(defaultsSource?.navigationPatternId ?? input?.defaultNavigationPatternId),
      animationProfileId: sanitizeOptionalTrimmedString(defaultsSource?.animationProfileId ?? input?.defaultAnimationProfileId),
      iconPackId: sanitizeOptionalTrimmedString(defaultsSource?.iconPackId ?? input?.defaultIconPackId),
      renderStyleId: sanitizeOptionalTrimmedString(defaultsSource?.renderStyleId ?? input?.defaultRenderStyleId),
    },
  };
}

export function compileThemeEngineContract(
  input: ThemeEngineManifestInput | undefined,
  themeId: string,
): CompiledThemeEngineContract {
  const manifest = normalizeThemeEngineManifest(input);
  const maps = {
    layoutPrimitives: new Map(manifest.layoutPrimitives.map(entry => [entry.id, entry] as const)),
    navigationPatterns: new Map(manifest.navigationPatterns.map(entry => [entry.id, entry] as const)),
    animationProfiles: new Map(manifest.animationProfiles.map(entry => [entry.id, entry] as const)),
    iconPacks: new Map(manifest.iconPacks.map(entry => [entry.id, entry] as const)),
    renderStyles: new Map(manifest.renderStyles.map(entry => [entry.id, entry] as const)),
  };

  return {
    themeId,
    schemaVersion: manifest.schemaVersion,
    manifest,
    maps,
    defaults: {
      layoutPrimitive: manifest.defaults.layoutPrimitiveId
        ? maps.layoutPrimitives.get(manifest.defaults.layoutPrimitiveId)
        : manifest.layoutPrimitives[0],
      navigationPattern: manifest.defaults.navigationPatternId
        ? maps.navigationPatterns.get(manifest.defaults.navigationPatternId)
        : manifest.navigationPatterns[0],
      animationProfile: manifest.defaults.animationProfileId
        ? maps.animationProfiles.get(manifest.defaults.animationProfileId)
        : manifest.animationProfiles[0],
      iconPack: manifest.defaults.iconPackId
        ? maps.iconPacks.get(manifest.defaults.iconPackId)
        : manifest.iconPacks[0],
      renderStyle: manifest.defaults.renderStyleId
        ? maps.renderStyles.get(manifest.defaults.renderStyleId)
        : manifest.renderStyles[0],
    },
  };
}

export function summarizeThemeEngineCapabilities(
  contract: CompiledThemeEngineContract,
): ThemeEngineCapabilitySummary {
  const tokenGroupCount = [
    contract.manifest.designTokens.color,
    contract.manifest.designTokens.typography,
    contract.manifest.designTokens.spacing,
    contract.manifest.designTokens.radius,
    contract.manifest.designTokens.shadow,
    contract.manifest.designTokens.motion,
  ].reduce((total, group) => total + Object.keys(group).length, 0);

  return {
    designTokens: tokenGroupCount,
    layoutPrimitives: contract.manifest.layoutPrimitives.length,
    navigationPatterns: contract.manifest.navigationPatterns.length,
    animationProfiles: contract.manifest.animationProfiles.length,
    iconPacks: contract.manifest.iconPacks.length,
    renderStyles: contract.manifest.renderStyles.length,
  };
}
