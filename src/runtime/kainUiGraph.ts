import { callKainTauronBridge } from "./kainTauronBridge";

export interface KainUiThemeGraph {
  selectionMode?: string;
  activeThemeId?: string;
  activeDockThemeId?: string;
  recommendedThemeId?: string;
  activeAppearancePackId?: string;
  activeThemeRecipeId?: string;
  activeThemeEngineId?: string;
  activeShellRendererId?: string;
  activeTopBarId?: string;
  activeIconThemeId?: string;
  appOpacity?: number;
  panelTransparency?: number;
  appZoom?: number;
  blurStrengthPx?: number;
  source?: string;
  authoredThemes?: KainUiAuthoredThemeGraph[];
}

export interface KainUiAuthoredThemeGraph {
  id: string;
  name: string;
  description?: string;
  source?: string;
  compatibilityThemeId?: string;
  compatibilityBundlePath?: string;
  status?: string;
  selectable: boolean;
}

export interface KainUiChromeGraph {
  density?: string;
  topBarMode?: string;
  buttonSize?: string;
  showAdvancedThemeLanes?: boolean;
}

export interface KainUiLayoutGraph {
  shellFamily?: string;
  settingsRailMode?: string;
  explorerChromePreset?: string;
}

export interface KainUiMotionGraph {
  preset?: string;
  interactionPreset?: string;
  shaderPerformanceMode?: string;
}

export interface KainUiSettingsCategoryGraph {
  key: string;
  label: string;
  description: string;
  sectionKeys: string[];
}

export interface KainUiSettingsGraph {
  mode?: string;
  categories: KainUiSettingsCategoryGraph[];
  hiddenSectionKeys: string[];
  primarySectionKeys: string[];
}

export interface KainUiProfileGraph {
  source?: string;
  scope?: string;
  overlays?: string[];
}

export interface KainUiGraph {
  schemaVersion: number;
  kind: string;
  source: string;
  theme: KainUiThemeGraph;
  chrome: KainUiChromeGraph;
  layout: KainUiLayoutGraph;
  motion: KainUiMotionGraph;
  settings: KainUiSettingsGraph;
  profile: KainUiProfileGraph;
}

export interface KainUiGraphLoadResult {
  graph: KainUiGraph | null;
  error: string | null;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(stringValue).filter((item): item is string => Boolean(item))
    : [];
}

function normalizeThemeGraph(value: unknown): KainUiThemeGraph {
  const source = asObject(value) ?? {};
  const authoredThemes: KainUiAuthoredThemeGraph[] = Array.isArray(source.authoredThemes)
    ? source.authoredThemes.reduce<KainUiAuthoredThemeGraph[]>((themes, theme) => {
        const themeObject = asObject(theme);
        if (!themeObject) {
          return themes;
        }
        const id = stringValue(themeObject.id);
        const name = stringValue(themeObject.name);
        if (!id || !name) {
          return themes;
        }
        themes.push({
          id,
          name,
          description: stringValue(themeObject.description),
          source: stringValue(themeObject.source),
          compatibilityThemeId: stringValue(themeObject.compatibilityThemeId),
          compatibilityBundlePath: stringValue(themeObject.compatibilityBundlePath),
          status: stringValue(themeObject.status),
          selectable: booleanValue(themeObject.selectable) ?? true,
        });
        return themes;
      }, [])
    : [];

  return {
    selectionMode: stringValue(source.selectionMode),
    activeThemeId: stringValue(source.activeThemeId),
    activeDockThemeId: stringValue(source.activeDockThemeId),
    recommendedThemeId: stringValue(source.recommendedThemeId),
    activeAppearancePackId: stringValue(source.activeAppearancePackId),
    activeThemeRecipeId: stringValue(source.activeThemeRecipeId),
    activeThemeEngineId: stringValue(source.activeThemeEngineId),
    activeShellRendererId: stringValue(source.activeShellRendererId),
    activeTopBarId: stringValue(source.activeTopBarId),
    activeIconThemeId: stringValue(source.activeIconThemeId),
    appOpacity: numberValue(source.appOpacity),
    panelTransparency: numberValue(source.panelTransparency),
    appZoom: numberValue(source.appZoom),
    blurStrengthPx: numberValue(source.blurStrengthPx),
    source: stringValue(source.source),
    authoredThemes,
  };
}

function normalizeSettingsGraph(value: unknown): KainUiSettingsGraph {
  const source = asObject(value) ?? {};
  const categories = Array.isArray(source.categories)
    ? source.categories
        .map((category) => {
          const categoryObject = asObject(category);
          if (!categoryObject) {
            return null;
          }
          const key = stringValue(categoryObject.key);
          const label = stringValue(categoryObject.label);
          if (!key || !label) {
            return null;
          }
          return {
            key,
            label,
            description: stringValue(categoryObject.description) ?? "",
            sectionKeys: stringList(categoryObject.sectionKeys),
          };
        })
        .filter((category): category is KainUiSettingsCategoryGraph => Boolean(category))
    : [];

  return {
    mode: stringValue(source.mode),
    categories,
    hiddenSectionKeys: stringList(source.hiddenSectionKeys),
    primarySectionKeys: stringList(source.primarySectionKeys),
  };
}

function normalizeChromeGraph(value: unknown): KainUiChromeGraph {
  const source = asObject(value) ?? {};
  return {
    density: stringValue(source.density),
    topBarMode: stringValue(source.topBarMode),
    buttonSize: stringValue(source.buttonSize),
    showAdvancedThemeLanes: booleanValue(source.showAdvancedThemeLanes),
  };
}

function normalizeLayoutGraph(value: unknown): KainUiLayoutGraph {
  const source = asObject(value) ?? {};
  return {
    shellFamily: stringValue(source.shellFamily),
    settingsRailMode: stringValue(source.settingsRailMode),
    explorerChromePreset: stringValue(source.explorerChromePreset),
  };
}

function normalizeMotionGraph(value: unknown): KainUiMotionGraph {
  const source = asObject(value) ?? {};
  return {
    preset: stringValue(source.preset),
    interactionPreset: stringValue(source.interactionPreset),
    shaderPerformanceMode: stringValue(source.shaderPerformanceMode),
  };
}

export function normalizeKainUiGraph(value: unknown): KainUiGraph | null {
  const source = asObject(value);
  if (!source) {
    return null;
  }

  const schemaVersion = numberValue(source.schemaVersion) ?? 0;
  if (schemaVersion < 1) {
    return null;
  }

  return {
    schemaVersion,
    kind: stringValue(source.kind) ?? "greeblefs.ui.graph",
    source: stringValue(source.source) ?? "kain",
    theme: normalizeThemeGraph(source.theme),
    chrome: normalizeChromeGraph(source.chrome),
    layout: normalizeLayoutGraph(source.layout),
    motion: normalizeMotionGraph(source.motion),
    settings: normalizeSettingsGraph(source.settings),
    profile: {
      source: stringValue(asObject(source.profile)?.source),
      scope: stringValue(asObject(source.profile)?.scope),
      overlays: stringList(asObject(source.profile)?.overlays),
    },
  };
}

export async function loadKainUiGraph(args: Record<string, unknown> = {}): Promise<KainUiGraphLoadResult> {
  try {
    const rawGraph = await callKainTauronBridge<unknown, Record<string, unknown>>(
      "greeblefs.ui",
      "graph",
      args,
    );
    const graph = normalizeKainUiGraph(rawGraph);
    return graph
      ? { graph, error: null }
      : { graph: null, error: "Kain UI graph response was empty or invalid." };
  } catch (error) {
    return {
      graph: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
