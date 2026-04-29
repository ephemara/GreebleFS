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

function asRecord(value: unknown): LooseRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as LooseRecord;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asTokenScale(value: unknown): ThemeTokenScale {
  const source = asRecord(value);
  if (!source) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(source).filter(([, tokenValue]) =>
      typeof tokenValue === 'string' || typeof tokenValue === 'number'
    ),
  ) as ThemeTokenScale;
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
  const explicit = asString(value)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return explicit || `${fallbackPrefix}-${index + 1}`;
}

function asPrimitiveProps(value: unknown): Record<string, string | number | boolean> {
  const source = asRecord(value);
  if (!source) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(source).filter(([, propValue]) =>
      typeof propValue === 'string' || typeof propValue === 'number' || typeof propValue === 'boolean'
    ),
  ) as Record<string, string | number | boolean>;
}

function normalizeLayoutPrimitives(value: unknown): ThemeLayoutPrimitive[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry, index) => {
    const record = asRecord(entry);
    if (!record) {
      return [];
    }
    const kindValue = asString(record.kind);
    const kind: ThemeLayoutPrimitiveKind = (
      kindValue === 'stack'
      || kindValue === 'grid'
      || kindValue === 'split'
      || kindValue === 'dock'
      || kindValue === 'freeform'
    ) ? kindValue : 'stack';
    const id = createId(record.id ?? record.name, 'layout', index);
    return [{
      id,
      name: asString(record.name) || id,
      kind,
      props: asPrimitiveProps(record.props),
    }];
  });
}

function normalizeNavigationPatterns(value: unknown): ThemeNavigationPattern[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry, index) => {
    const record = asRecord(entry);
    if (!record) {
      return [];
    }
    const kindValue = asString(record.kind);
    const axisValue = asString(record.axis);
    const kind: ThemeNavigationPatternKind = (
      kindValue === 'xmb'
      || kindValue === 'tabbed'
      || kindValue === 'hierarchy'
      || kindValue === 'palette'
      || kindValue === 'spatial'
      || kindValue === 'custom'
    ) ? kindValue : 'custom';
    const axis: ThemeNavigationPattern['axis'] = (
      axisValue === 'horizontal'
      || axisValue === 'vertical'
      || axisValue === 'both'
    ) ? axisValue : 'both';
    const id = createId(record.id ?? record.name, 'navigation', index);
    return [{
      id,
      name: asString(record.name) || id,
      kind,
      axis,
      props: asPrimitiveProps(record.props),
    }];
  });
}

function normalizeAnimationProfiles(value: unknown): ThemeAnimationProfile[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry, index) => {
    const record = asRecord(entry);
    if (!record) {
      return [];
    }
    const id = createId(record.id ?? record.name, 'animation-profile', index);
    return [{
      id,
      name: asString(record.name) || id,
      durationMs: Math.max(0, asNumber(record.durationMs, 240)),
      easing: asString(record.easing) || 'ease',
      intensity: Math.max(0, asNumber(record.intensity, 1)),
    }];
  });
}

function normalizeIconPacks(value: unknown): ThemeIconPack[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry, index) => {
    const record = asRecord(entry);
    if (!record) {
      return [];
    }
    const styleValue = asString(record.style);
    const style: ThemeIconPack['style'] = (
      styleValue === 'system'
      || styleValue === 'vector'
      || styleValue === 'pixel'
      || styleValue === 'skeuomorphic'
      || styleValue === 'custom'
    ) ? styleValue : 'custom';
    const id = createId(record.id ?? record.name, 'icon-pack', index);
    return [{
      id,
      name: asString(record.name) || id,
      style,
    }];
  });
}

function normalizeRenderStyles(value: unknown): ThemeRenderStyle[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry, index) => {
    const record = asRecord(entry);
    if (!record) {
      return [];
    }
    const id = createId(record.id ?? record.name, 'render-style', index);
    const entryClassName = asString(record.entryClassName) || asString(record.className);
    return [{
      id,
      name: asString(record.name) || id,
      entryClassName: entryClassName || undefined,
      description: asString(record.description) || undefined,
    }];
  });
}

export function normalizeThemeEngineManifest(input?: ThemeEngineManifestInput): ThemeEngineManifest {
  const defaultsSource = asRecord(input?.defaults);
  return {
    schemaVersion: Math.max(1, Math.round(asNumber(input?.schemaVersion, 1))),
    designTokens: normalizeDesignTokens(input?.designTokens),
    layoutPrimitives: normalizeLayoutPrimitives(input?.layoutPrimitives),
    navigationPatterns: normalizeNavigationPatterns(input?.navigationPatterns),
    animationProfiles: normalizeAnimationProfiles(input?.animationProfiles),
    iconPacks: normalizeIconPacks(input?.iconPacks),
    renderStyles: normalizeRenderStyles(input?.renderStyles),
    defaults: {
      layoutPrimitiveId: asString(defaultsSource?.layoutPrimitiveId ?? input?.defaultLayoutPrimitiveId) || undefined,
      navigationPatternId: asString(defaultsSource?.navigationPatternId ?? input?.defaultNavigationPatternId) || undefined,
      animationProfileId: asString(defaultsSource?.animationProfileId ?? input?.defaultAnimationProfileId) || undefined,
      iconPackId: asString(defaultsSource?.iconPackId ?? input?.defaultIconPackId) || undefined,
      renderStyleId: asString(defaultsSource?.renderStyleId ?? input?.defaultRenderStyleId) || undefined,
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
