export interface SettingsSectionCatalogEntry {
  key: string;
  label: string;
  subtitle: string;
  keywords: readonly string[];
  overviewSummary: string;
  featuredInOverview: boolean;
  order: number;
}

export const settingsSectionCatalog = [
  {
    key: 'overview',
    label: 'Overview',
    subtitle: 'Start here for the workbench map and release-facing paths.',
    keywords: ['overview', 'home', 'start', 'orientation', 'settings map'],
    overviewSummary: 'First-run orientation, workspace roots, and the settings slices that matter most for a credible ship candidate.',
    featuredInOverview: false,
    order: 10,
  },
  {
    key: 'system',
    label: 'System',
    subtitle: 'Startup and OS integration status.',
    keywords: ['system', 'startup', 'tray', 'taskbar', 'diagnostics'],
    overviewSummary: 'Launch, tray, taskbar, GPU tier, and machine-level diagnostics.',
    featuredInOverview: true,
    order: 20,
  },
  {
    key: 'models',
    label: 'Models',
    subtitle: 'Managed local-model catalog, cache, and acceleration-aware bindings.',
    keywords: ['models', 'local ai', 'semantic indexing', 'cuda', 'onnx', 'huggingface'],
    overviewSummary: 'Local model cache, prewarm controls, and capability bindings for semantic search and future AI features.',
    featuredInOverview: true,
    order: 25,
  },
  {
    key: 'terminal',
    label: 'Terminal',
    subtitle: 'Shell defaults and external handoff.',
    keywords: ['terminal', 'shell', 'external terminal', 'cursor', 'integrated shell'],
    overviewSummary: 'Shell presentation, integrated defaults, and external handoff.',
    featuredInOverview: true,
    order: 30,
  },
  {
    key: 'explorer',
    label: 'Explorer',
    subtitle: 'Startup path, file visibility, layout, and thumbnail behavior.',
    keywords: ['explorer', 'files', 'browse', 'thumbnails', 'folders'],
    overviewSummary: 'Click behavior, layout bias, startup path, and thumbnails.',
    featuredInOverview: true,
    order: 40,
  },
  {
    key: 'home',
    label: 'Home',
    subtitle: 'Explorer home packs, presets, telemetry, and launch surfaces.',
    keywords: ['home', 'home page', 'dashboard', 'start page', 'favorites'],
    overviewSummary: 'Explorer home packs, presets, usage telemetry, and launchpad controls.',
    featuredInOverview: true,
    order: 45,
  },
  {
    key: 'layouts',
    label: 'Layouts',
    subtitle: 'Workbench profiles and shell chrome.',
    keywords: ['layout', 'profiles', 'chrome', 'dock'],
    overviewSummary: 'Manifest-driven panel profiles and shell chrome.',
    featuredInOverview: true,
    order: 50,
  },
  {
    key: 'hotkeys',
    label: 'Hotkeys',
    subtitle: 'Overlay opener and gesture bindings.',
    keywords: ['hotkeys', 'shortcuts', 'keybindings'],
    overviewSummary: 'Shortcut bindings for the overlay shell and focus toggles.',
    featuredInOverview: false,
    order: 60,
  },
  {
    key: 'cloud',
    label: 'Cloud',
    subtitle: 'OAuth-backed Google Drive and Dropbox accounts.',
    keywords: ['cloud', 'google drive', 'dropbox', 'oauth'],
    overviewSummary: 'Cloud accounts and provider credentials.',
    featuredInOverview: false,
    order: 70,
  },
  {
    key: 'screenshots',
    label: 'Screenshots',
    subtitle: 'Capture defaults, save path, and proof-focused editor behavior.',
    keywords: ['screenshot', 'capture', 'proof', 'snip'],
    overviewSummary: 'Capture defaults, output actions, and proof workflow.',
    featuredInOverview: false,
    order: 80,
  },
  {
    key: 'audio',
    label: 'Audio',
    subtitle: 'Audio pathing and VST3 integration.',
    keywords: ['audio', 'vst', 'vst3', 'plugin'],
    overviewSummary: 'Audio scan paths and plugin discovery.',
    featuredInOverview: false,
    order: 90,
  },
  {
    key: 'appearance',
    label: 'Appearance',
    subtitle: 'Theme, opacity, panel transparency, blur, and zoom.',
    keywords: ['appearance', 'theme', 'palette', 'fonts', 'wallpaper'],
    overviewSummary: 'Theme recipes, blur, transparency, and fonts.',
    featuredInOverview: true,
    order: 100,
  },
  {
    key: 'top-bars',
    label: 'Top Bars',
    subtitle: 'Standalone shell chrome workflows that can follow theme defaults or stay pinned independently.',
    keywords: ['top bar', 'chrome', 'header', 'shell chrome'],
    overviewSummary: 'Top-bar workflows can follow the theme or stay pinned.',
    featuredInOverview: false,
    order: 110,
  },
  {
    key: 'icons',
    label: 'Icons',
    subtitle: 'VS Code-style icon packs for explorer files, folders, and shell chrome.',
    keywords: ['icons', 'icon theme', 'folder icons', 'ui icons'],
    overviewSummary: 'Icon packs, folder rules, and native icon fallback behavior.',
    featuredInOverview: false,
    order: 120,
  },
  {
    key: 'wallpapers',
    label: 'Wallpapers',
    subtitle: 'Theme-backed wallpapers plus custom image, video, and live backgrounds.',
    keywords: ['wallpaper', 'background', 'video wallpaper', 'live wallpaper'],
    overviewSummary: 'Wallpaper catalog, overrides, and live background sources.',
    featuredInOverview: false,
    order: 130,
  },
  {
    key: 'shaders',
    label: 'Shaders',
    subtitle: 'Shell-wide shader profiles for background, chrome, and rails.',
    keywords: ['shader', 'render', 'visuals'],
    overviewSummary: 'Shader profiles, live preview, and surface routing.',
    featuredInOverview: false,
    order: 140,
  },
  {
    key: 'animations',
    label: 'Animations',
    subtitle: 'Open and close motion modules.',
    keywords: ['animation', 'motion', 'transition'],
    overviewSummary: 'Open and close window motion modules.',
    featuredInOverview: false,
    order: 150,
  },
  {
    key: 'interaction-motion',
    label: 'Interaction Motion',
    subtitle: 'Shell micro-interactions, presets, and Motion Lab previews.',
    keywords: ['interaction motion', 'interaction', 'micro interaction', 'motion lab', 'wiggle', 'bounce'],
    overviewSummary: 'Theme-driven interaction motion for explorer entries, shell chrome, and settings surfaces.',
    featuredInOverview: false,
    order: 155,
  },
  {
    key: 'theme-json',
    label: 'Theme JSON',
    subtitle: 'Raw theme authoring and import.',
    keywords: ['theme json', 'import', 'export', 'raw theme'],
    overviewSummary: 'Direct JSON editing for full theme definitions.',
    featuredInOverview: true,
    order: 160,
  },
] as const satisfies readonly SettingsSectionCatalogEntry[];

export type SettingsSectionKey = typeof settingsSectionCatalog[number]['key'];

const SETTINGS_SECTION_LOOKUP = new Map(
  settingsSectionCatalog.map(entry => [entry.key, entry] as const),
);

export function getSettingsSectionCatalogEntry(key: SettingsSectionKey): SettingsSectionCatalogEntry | null {
  return SETTINGS_SECTION_LOOKUP.get(key) ?? null;
}

export function normalizeSettingsSectionKey(value: unknown): SettingsSectionKey {
  if (typeof value !== 'string') {
    return 'overview';
  }

  const trimmedValue = value.trim();
  const normalizedValue = trimmedValue as SettingsSectionKey;
  return SETTINGS_SECTION_LOOKUP.has(normalizedValue) ? normalizedValue : 'overview';
}

export const featuredSettingsSectionKeys = settingsSectionCatalog
  .filter(section => section.featuredInOverview)
  .map(section => section.key) as SettingsSectionKey[];
