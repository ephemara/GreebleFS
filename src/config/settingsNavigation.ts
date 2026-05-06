export type SettingsPageArchetype = 'rows' | 'catalog-inspector' | 'tool-editor' | 'hybrid';

export interface SettingsSectionShellHints {
  inspector?: boolean;
  preferredContentDensity?: 'compact' | 'comfortable' | 'immersive';
  disableContentScroll?: boolean;
}

export interface SettingsSectionCatalogEntry {
  key: string;
  label: string;
  subtitle: string;
  keywords: readonly string[];
  overviewSummary: string;
  featuredInOverview: boolean;
  archetype: SettingsPageArchetype;
  shell?: SettingsSectionShellHints;
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
    archetype: 'hybrid',
    shell: { preferredContentDensity: 'comfortable' },
    order: 10,
  },
  {
    key: 'system',
    label: 'System',
    subtitle: 'Startup and OS integration status.',
    keywords: ['system', 'startup', 'tray', 'taskbar', 'diagnostics'],
    overviewSummary: 'Launch, tray, taskbar, GPU tier, and machine-level diagnostics.',
    featuredInOverview: true,
    archetype: 'rows',
    shell: { preferredContentDensity: 'comfortable' },
    order: 20,
  },
  {
    key: 'profiles',
    label: 'Profiles',
    subtitle: 'Shared-root usr plus profile-local workbench overlays.',
    keywords: ['profiles', 'usr', 'overrides', 'shared root', 'workbench config'],
    overviewSummary: 'Switch named usr overlays, inspect profile-owned settings slices, and keep shared-root content global.',
    featuredInOverview: true,
    archetype: 'hybrid',
    shell: { preferredContentDensity: 'comfortable' },
    order: 22,
  },
  {
    key: 'models',
    label: 'Models',
    subtitle: 'Managed local-model catalog, cache, and acceleration-aware bindings.',
    keywords: ['models', 'local ai', 'semantic indexing', 'cuda', 'onnx', 'huggingface'],
    overviewSummary: 'Local model cache, prewarm controls, and capability bindings for semantic search and future AI features.',
    featuredInOverview: true,
    archetype: 'hybrid',
    shell: { preferredContentDensity: 'comfortable' },
    order: 25,
  },
  {
    key: 'terminal',
    label: 'Terminal',
    subtitle: 'Shell defaults and external handoff.',
    keywords: ['terminal', 'shell', 'external terminal', 'cursor', 'integrated shell'],
    overviewSummary: 'Integrated terminal defaults and external handoff.',
    featuredInOverview: true,
    archetype: 'rows',
    shell: { preferredContentDensity: 'comfortable' },
    order: 30,
  },
  {
    key: 'dock',
    label: 'Dock Mode',
    subtitle: 'Dock presentations, placement, sizing, and preview policy.',
    keywords: ['dock', 'floating', 'yakuake', 'preview', 'placement', 'dock presentations'],
    overviewSummary: 'Dock mode placement, top bar, sizing, and Explorer preview policy.',
    featuredInOverview: true,
    archetype: 'rows',
    shell: { preferredContentDensity: 'comfortable' },
    order: 35,
  },
  {
    key: 'explorer',
    label: 'Explorer',
    subtitle: 'Startup path, file visibility, layout, and thumbnail behavior.',
    keywords: ['explorer', 'files', 'browse', 'thumbnails', 'folders'],
    overviewSummary: 'Click behavior, layout bias, startup path, and thumbnails.',
    featuredInOverview: true,
    archetype: 'hybrid',
    shell: { preferredContentDensity: 'comfortable' },
    order: 40,
  },
  {
    key: 'context-menus',
    label: 'Context Menus',
    subtitle: 'Menu packs, composer layouts, renderers, and shareable authoring surfaces.',
    keywords: ['context menus', 'menu packs', 'radial menu', 'composer', 'submenu', 'renderer'],
    overviewSummary: 'Explorer menu packs, renderer choices, and context-specific composer overrides.',
    featuredInOverview: true,
    archetype: 'tool-editor',
    shell: {
      inspector: true,
      preferredContentDensity: 'immersive',
      disableContentScroll: true,
    },
    order: 42,
  },
  {
    key: 'home',
    label: 'Home',
    subtitle: 'Explorer home packs, presets, telemetry, and launch surfaces.',
    keywords: ['home', 'home page', 'dashboard', 'start page', 'favorites'],
    overviewSummary: 'Explorer home packs, presets, usage telemetry, and launchpad controls.',
    featuredInOverview: true,
    archetype: 'hybrid',
    shell: { preferredContentDensity: 'comfortable' },
    order: 45,
  },
  {
    key: 'layouts',
    label: 'Layouts',
    subtitle: 'Workbench profiles and shell chrome.',
    keywords: ['layout', 'profiles', 'chrome', 'dock'],
    overviewSummary: 'Manifest-driven panel profiles and shell chrome.',
    featuredInOverview: true,
    archetype: 'catalog-inspector',
    shell: { inspector: true, preferredContentDensity: 'comfortable' },
    order: 50,
  },
  {
    key: 'hotkeys',
    label: 'Hotkeys',
    subtitle: 'Overlay opener and gesture bindings.',
    keywords: ['hotkeys', 'shortcuts', 'keybindings'],
    overviewSummary: 'Shortcut bindings for the overlay shell and focus toggles.',
    featuredInOverview: false,
    archetype: 'rows',
    shell: { preferredContentDensity: 'compact' },
    order: 60,
  },
  {
    key: 'cloud',
    label: 'Cloud',
    subtitle: 'OAuth-backed Google Drive and Dropbox accounts.',
    keywords: ['cloud', 'google drive', 'dropbox', 'oauth'],
    overviewSummary: 'Cloud accounts and provider credentials.',
    featuredInOverview: false,
    archetype: 'rows',
    shell: { preferredContentDensity: 'comfortable' },
    order: 70,
  },
  {
    key: 'mobile',
    label: 'Mobile',
    subtitle: 'Mobile PWA delivery, tailnet access, and iPhone-facing remote paths.',
    keywords: ['mobile', 'pwa', 'tailscale', 'iphone', 'remote access', 'tailnet'],
    overviewSummary: 'Phone access mode, Tailscale pairing status, and remote-share launch behavior.',
    featuredInOverview: true,
    archetype: 'hybrid',
    shell: { preferredContentDensity: 'comfortable' },
    order: 75,
  },
  {
    key: 'audio',
    label: 'Audio',
    subtitle: 'Theme-driven shell sound packs, native notifications, and VST3 integration.',
    keywords: ['audio', 'sound pack', 'ui sounds', 'notifications', 'vst', 'vst3', 'plugin'],
    overviewSummary: 'Shell feedback sounds, native task notifications, and audio plugin discovery.',
    featuredInOverview: false,
    archetype: 'hybrid',
    shell: { preferredContentDensity: 'comfortable' },
    order: 90,
  },
  {
    key: 'appearance',
    label: 'Appearance',
    subtitle: 'Theme, opacity, panel transparency, blur, and zoom.',
    keywords: ['appearance', 'theme', 'palette', 'fonts', 'wallpaper'],
    overviewSummary: 'Theme recipes, blur, transparency, and fonts.',
    featuredInOverview: true,
    archetype: 'catalog-inspector',
    shell: { inspector: true, preferredContentDensity: 'immersive' },
    order: 100,
  },
  {
    key: 'appearance-packs',
    label: 'Appearance Packs',
    subtitle: 'Standalone palette, typography, and visual identity packs that can follow theme defaults or stay pinned.',
    keywords: ['appearance pack', 'palette pack', 'theme look', 'visual identity', 'fonts', 'visuals'],
    overviewSummary: 'Appearance packs can follow the active theme bundle or stay pinned independently.',
    featuredInOverview: false,
    archetype: 'catalog-inspector',
    shell: { inspector: true, preferredContentDensity: 'comfortable' },
    order: 105,
  },
  {
    key: 'theme-recipes',
    label: 'Theme Recipes',
    subtitle: 'Workbench, explorer, and dock recipe packs that can follow theme defaults or stay pinned.',
    keywords: ['theme recipe', 'workbench recipe', 'explorer recipe', 'dock recipe'],
    overviewSummary: 'Theme recipe packs control workbench, explorer, and dock presentation lanes.',
    featuredInOverview: false,
    archetype: 'catalog-inspector',
    shell: { inspector: true, preferredContentDensity: 'comfortable' },
    order: 107,
  },
  {
    key: 'theme-engines',
    label: 'Theme Engines',
    subtitle: 'Design tokens, render styles, and engine-default packs that can follow theme defaults or stay pinned.',
    keywords: ['theme engine', 'design tokens', 'render styles', 'layout primitives', 'navigation patterns'],
    overviewSummary: 'Theme engine packs control design tokens, render styles, and engine defaults.',
    featuredInOverview: false,
    archetype: 'catalog-inspector',
    shell: { inspector: true, preferredContentDensity: 'comfortable' },
    order: 108,
  },
  {
    key: 'shell-renderers',
    label: 'Shell Renderers',
    subtitle: 'Standalone renderer modules that can follow theme defaults or stay pinned.',
    keywords: ['shell renderer', 'theme renderer', 'workbench runtime', 'renderer module'],
    overviewSummary: 'Shell renderer packs control the active runtime renderer lane.',
    featuredInOverview: false,
    archetype: 'catalog-inspector',
    shell: { inspector: true, preferredContentDensity: 'comfortable' },
    order: 109,
  },
  {
    key: 'top-bars',
    label: 'Top Bars',
    subtitle: 'Standalone shell chrome workflows that can follow theme defaults or stay pinned independently.',
    keywords: ['top bar', 'chrome', 'header', 'shell chrome'],
    overviewSummary: 'Top-bar workflows can follow the theme or stay pinned.',
    featuredInOverview: false,
    archetype: 'catalog-inspector',
    shell: { inspector: true, preferredContentDensity: 'comfortable' },
    order: 110,
  },
  {
    key: 'icons',
    label: 'Icons',
    subtitle: 'VS Code-style icon packs for explorer files, folders, and shell chrome.',
    keywords: ['icons', 'icon theme', 'folder icons', 'ui icons'],
    overviewSummary: 'Icon packs, folder rules, and native icon fallback behavior.',
    featuredInOverview: false,
    archetype: 'catalog-inspector',
    shell: { inspector: true, preferredContentDensity: 'comfortable' },
    order: 120,
  },
  {
    key: 'wallpapers',
    label: 'Wallpapers',
    subtitle: 'Theme-backed wallpapers plus custom image, video, and live backgrounds.',
    keywords: ['wallpaper', 'background', 'video wallpaper', 'live wallpaper'],
    overviewSummary: 'Wallpaper catalog, overrides, and live background sources.',
    featuredInOverview: false,
    archetype: 'catalog-inspector',
    shell: { inspector: true, preferredContentDensity: 'immersive' },
    order: 130,
  },
  {
    key: 'shaders',
    label: 'Shaders',
    subtitle: 'Shell-wide shader profiles for background, chrome, and rails.',
    keywords: ['shader', 'render', 'visuals'],
    overviewSummary: 'Shader profiles, live preview, and surface routing.',
    featuredInOverview: false,
    archetype: 'catalog-inspector',
    shell: { inspector: true, preferredContentDensity: 'comfortable' },
    order: 140,
  },
  {
    key: 'animations',
    label: 'Animations',
    subtitle: 'Open and close motion modules.',
    keywords: ['animation', 'motion', 'transition'],
    overviewSummary: 'Open and close window motion modules.',
    featuredInOverview: false,
    archetype: 'catalog-inspector',
    shell: { inspector: true, preferredContentDensity: 'comfortable' },
    order: 150,
  },
  {
    key: 'interaction-motion',
    label: 'Interaction Motion',
    subtitle: 'Shell micro-interactions, presets, and Motion Lab previews.',
    keywords: ['interaction motion', 'interaction', 'micro interaction', 'motion lab', 'wiggle', 'bounce'],
    overviewSummary: 'Theme-driven interaction motion for explorer entries, shell chrome, and settings surfaces.',
    featuredInOverview: false,
    archetype: 'hybrid',
    shell: { preferredContentDensity: 'comfortable' },
    order: 155,
  },
  {
    key: 'layout-dynamics',
    label: 'Layout Customization',
    subtitle: 'ZBrush-style move, save, and canonical reset controls for shell and explorer chrome.',
    keywords: ['layout customization', 'layout dynamics', 'layout physics', 'zbrush', 'authoring', 'widget canvas', 'top bar', 'reset layout'],
    overviewSummary: 'Direct layout customization commands with advanced physics tucked behind an expert section.',
    featuredInOverview: false,
    archetype: 'hybrid',
    shell: { preferredContentDensity: 'comfortable' },
    order: 156,
  },
  {
    key: 'lookdev',
    label: 'Lookdev',
    subtitle: 'Global semantic shell authoring, live presets, and mode-aware export flows.',
    keywords: ['lookdev', 'theme authoring', 'global customize', 'preset', 'shell overlay', 'dock mode', 'app mode'],
    overviewSummary: 'Open the immersive global lookdev overlay, manage semantic presets, and keep theme-aligned exports in sync.',
    featuredInOverview: false,
    archetype: 'hybrid',
    shell: { preferredContentDensity: 'comfortable' },
    order: 158,
  },
  {
    key: 'theme-json',
    label: 'Theme JSON',
    subtitle: 'Raw theme authoring and import.',
    keywords: ['theme json', 'import', 'export', 'raw theme'],
    overviewSummary: 'Direct JSON editing for bundle manifests and modular theme composition.',
    featuredInOverview: true,
    archetype: 'tool-editor',
    shell: { preferredContentDensity: 'compact' },
    order: 160,
  },
] as const satisfies readonly SettingsSectionCatalogEntry[];

export type SettingsSectionKey = typeof settingsSectionCatalog[number]['key'];

export type SettingsRailPathKey = 'settings' | 'plugins';

export interface SettingsRailPathEntry {
  key: SettingsRailPathKey;
  label: string;
  description: string;
  order: number;
}

export const settingsRailPathCatalog = [
  {
    key: 'settings',
    label: 'Settings',
    description: 'Workbench, shell, explorer, and machine-level controls.',
    order: 10,
  },
  {
    key: 'plugins',
    label: 'Plugins',
    description: 'Extension-owned durable settings slots and tweak lanes.',
    order: 20,
  },
] as const satisfies readonly SettingsRailPathEntry[];

export type SettingsSectionCategoryKey =
  | 'start'
  | 'core-features'
  | 'pipelines'
  | 'connectivity'
  | 'appearance'
  | 'motion-rendering'
  | 'authoring';

export interface SettingsSectionCategoryEntry {
  key: SettingsSectionCategoryKey;
  label: string;
  description: string;
  order: number;
  sectionKeys: readonly SettingsSectionKey[];
}

export const settingsSectionCategoryCatalog = [
  {
    key: 'start',
    label: 'Start',
    description: 'Orientation, startup behavior, and global controls.',
    order: 10,
    sectionKeys: ['overview', 'system', 'profiles', 'hotkeys'],
  },
  {
    key: 'core-features',
    label: 'Core Features',
    description: 'Main workbench, explorer, terminal, and menu workflows.',
    order: 20,
    sectionKeys: ['terminal', 'dock', 'explorer', 'context-menus', 'home', 'layouts'],
  },
  {
    key: 'pipelines',
    label: 'Pipelines',
    description: 'Model, audio, and runtime feature pipelines.',
    order: 30,
    sectionKeys: ['models', 'audio'],
  },
  {
    key: 'connectivity',
    label: 'Connectivity',
    description: 'Cloud and mobile delivery surfaces.',
    order: 40,
    sectionKeys: ['cloud', 'mobile'],
  },
  {
    key: 'appearance',
    label: 'Appearance',
    description: 'Theme, visual identity, shell chrome, icons, and wallpaper.',
    order: 50,
    sectionKeys: [
      'appearance',
      'appearance-packs',
      'theme-recipes',
      'theme-engines',
      'shell-renderers',
      'top-bars',
      'icons',
      'wallpapers',
    ],
  },
  {
    key: 'motion-rendering',
    label: 'Motion & Rendering',
    description: 'Shaders, animation, interaction motion, and layout physics.',
    order: 60,
    sectionKeys: ['shaders', 'animations', 'interaction-motion', 'layout-dynamics'],
  },
  {
    key: 'authoring',
    label: 'Authoring',
    description: 'Lookdev, raw theme, and package editing surfaces.',
    order: 70,
    sectionKeys: ['lookdev', 'theme-json'],
  },
] as const satisfies readonly SettingsSectionCategoryEntry[];

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

export function normalizeSettingsRailPathKey(value: unknown): SettingsRailPathKey {
  return value === 'plugins' ? 'plugins' : 'settings';
}

export const featuredSettingsSectionKeys = settingsSectionCatalog
  .filter(section => section.featuredInOverview)
  .map(section => section.key) as SettingsSectionKey[];
