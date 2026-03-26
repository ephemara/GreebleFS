import type {
  ThemeChromeStyle as GeneratedThemeChromeStyle,
  ThemeDensity as GeneratedThemeDensity,
  ThemeIconStyle as GeneratedThemeIconStyle,
  ThemeMotionStyle as GeneratedThemeMotionStyle,
  ThemePresentation as GeneratedThemePresentation,
} from '../generated/tauri';
import type { OverlayShellBlueprintId } from './shellBlueprints';
import { mergeResolvedIconThemes, type OverlayResolvedIconTheme } from './iconTheme';
import { clampOverlayVisualControlValue } from './overlayWindow';

export interface OverlayXTermTheme {
  background: string;
  foreground: string;
  cursor: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

export interface OverlayThemePalette {
  appBackground: string;
  appBackgroundAlt: string;
  shellBackground: string;
  shellBackgroundSolid: string;
  topBarBackground: string;
  topBarMenuBackground: string;
  sidebarBackground: string;
  panelBackground: string;
  panelAltBackground: string;
  cardBackground: string;
  cardHoverBackground: string;
  contextMenuBackground: string;
  inputBackground: string;
  terminalBackground: string;
  selectionBackground: string;
  scrimBackground: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textDim: string;
  textInverse: string;
  border: string;
  borderStrong: string;
  accent: string;
  accentSoft: string;
  accentContrast: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  note: string;
  todo: string;
  bug: string;
  prompt: string;
}

export interface OverlayThemeEffects {
  backgroundImage: string;
  backgroundSize: string;
  backgroundPosition: string;
  shadow: string;
  overlayShadow: string;
}

export type OverlayThemeSource = 'built-in' | 'custom' | 'package';

export interface OverlayThemeVisualAnimation {
  kind: 'drift' | 'pulse' | 'pan';
  durationMs?: number;
  easing?: string;
  direction?: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';
}

export interface OverlayThemeVisualLayer {
  id: string;
  backgroundImage: string;
  backgroundSize?: string;
  backgroundPosition?: string;
  backgroundRepeat?: string;
  opacity?: number;
  blendMode?: string;
  filter?: string;
  inset?: string;
  animation?: OverlayThemeVisualAnimation;
}

export interface OverlayThemeAssets {
  packageRoot?: string;
  manifestPath?: string;
  backgroundUrl?: string;
  previewUrl?: string;
  iconTheme?: OverlayResolvedIconTheme;
  iconEntries?: Record<string, string>;
}

export interface OverlayThemeFonts {
  ui?: string;
  mono?: string;
}

export type OverlayThemeDensity = GeneratedThemeDensity;
export type OverlayThemeChromeStyle = GeneratedThemeChromeStyle;
export type OverlayThemeIconStyle = GeneratedThemeIconStyle;
export type OverlayThemeMotionStyle = GeneratedThemeMotionStyle;

export interface OverlayThemeCompatibility {
  shellBlueprints?: OverlayShellBlueprintId[];
  tags?: string[];
}

export type OverlayThemePresentation = Partial<GeneratedThemePresentation>;

export interface OverlayThemeDefinition {
  id: string;
  name: string;
  description?: string;
  defaultShaderId?: string;
  defaultOpenAnimationId?: string;
  defaultCloseAnimationId?: string;
  palette: OverlayThemePalette;
  effects: OverlayThemeEffects;
  xterm: OverlayXTermTheme;
  source?: OverlayThemeSource;
  extendsThemeId?: string;
  fonts?: OverlayThemeFonts;
  assets?: OverlayThemeAssets;
  visuals?: OverlayThemeVisualLayer[];
  cssVars?: Record<string, string>;
  presentation?: OverlayThemePresentation;
  compatibility?: OverlayThemeCompatibility;
}

export interface OverlayAppearanceSelection {
  activeThemeId?: string;
  customThemes?: OverlayThemeDefinition[];
  packageThemes?: OverlayThemeDefinition[];
  uiFontFamily?: string;
  monoFontFamily?: string;
  panelTransparency?: number;
}

export interface ResolvedOverlayAppearance {
  theme: OverlayThemeDefinition;
  baseTheme: OverlayThemeDefinition;
  themes: OverlayThemeDefinition[];
  fonts: {
    ui: string;
    mono: string;
  };
  cssVars: Record<string, string>;
  panelTransparency: number;
}

export interface OverlayFontOption {
  id: string;
  name: string;
  family: string;
}

export interface OverlayRegisteredFontContribution extends OverlayFontOption {
  faceName?: string;
  sourceUrl: string;
  format?: string;
  style?: string;
  weight?: string;
}

const builtInOverlayFontCatalog: OverlayFontOption[] = [
  { id: 'inter', name: 'Inter', family: 'Inter, system-ui, sans-serif' },
  { id: 'geist', name: 'Geist', family: 'Geist, Inter, system-ui, sans-serif' },
  { id: 'space-grotesk', name: 'Space Grotesk', family: '"Space Grotesk", Inter, system-ui, sans-serif' },
  { id: 'jetbrains-mono', name: 'JetBrains Mono', family: '"JetBrains Mono", "Cascadia Code", monospace' },
  { id: 'fira-code', name: 'Fira Code', family: '"Fira Code", "Cascadia Code", monospace' },
  { id: 'ibm-plex-mono', name: 'IBM Plex Mono', family: '"IBM Plex Mono", "Cascadia Code", monospace' },
  { id: 'system-ui', name: 'System UI', family: 'system-ui, sans-serif' },
];

export const overlayFontCatalog: OverlayFontOption[] = [...builtInOverlayFontCatalog];

const defaultUiFont = overlayFontCatalog[0].family;
const defaultMonoFont = overlayFontCatalog[3].family;

const loadedFonts = new Set<string>();
const pluginFontFamilies = new Set<string>();
const pluginFontsStyleElementId = 'overlayterm-plugin-fonts';

function getPrimaryFontFamily(fontFamily: string): string | null {
  return fontFamily
    .split(',')
    .map(part => part.trim().replace(/^['\"]|['\"]$/g, ''))
    .find(part => part && !part.includes('sans-serif') && !part.includes('monospace') && !part.includes('serif'))
    ?? null;
}

function getPluginFontsStyleElement(): HTMLStyleElement | null {
  if (typeof document === 'undefined') {
    return null;
  }

  let style = document.getElementById(pluginFontsStyleElementId) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = pluginFontsStyleElementId;
    document.head.appendChild(style);
  }
  return style;
}

export function setOverlayPluginFonts(fonts: OverlayRegisteredFontContribution[]): void {
  const mergedOptions = new Map<string, OverlayFontOption>(
    builtInOverlayFontCatalog.map(font => [font.id, font] as const),
  );
  const fontFaceRules: string[] = [];

  pluginFontFamilies.clear();

  fonts.forEach(font => {
    const faceName = font.faceName?.trim() || getPrimaryFontFamily(font.family) || font.name;
    pluginFontFamilies.add(faceName);
    mergedOptions.set(font.id, { id: font.id, name: font.name, family: font.family });
    fontFaceRules.push(
      `@font-face { font-family: "${faceName.replace(/"/g, '\\"')}"; src: url("${font.sourceUrl}") format("${font.format ?? 'truetype'}"); font-style: ${font.style ?? 'normal'}; font-weight: ${font.weight ?? '400'}; font-display: swap; }`,
    );
  });

  overlayFontCatalog.splice(0, overlayFontCatalog.length, ...mergedOptions.values());

  const style = getPluginFontsStyleElement();
  if (style) {
    style.textContent = fontFaceRules.join('\n');
  }
}

export function ensureFontFamilyLoaded(fontFamily: string): void {
  if (typeof document === 'undefined') return;

  const familyName = fontFamily
    .split(',')
    .map(part => part.trim().replace(/^['"]|['"]$/g, ''))
    .find(part => part && !part.includes('sans-serif') && !part.includes('monospace') && !part.includes('serif'));

  if (!familyName || loadedFonts.has(familyName) || pluginFontFamilies.has(familyName)) {
    return;
  }

  loadedFonts.add(familyName);

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(familyName)}:wght@400;500;600;700&display=swap`;
  document.head.appendChild(link);
}

function clampUnitInterval(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(Math.max(value, 0), 1);
}

function formatAlphaComponent(value: number): string {
  return String(Math.round(clampUnitInterval(value) * 1000) / 1000);
}

export function multiplyColorAlpha(color: string, alphaMultiplier: number): string {
  const multiplier = clampUnitInterval(alphaMultiplier);
  const trimmed = color.trim();
  if (!trimmed) {
    return color;
  }
  if (multiplier >= 0.999) {
    return trimmed;
  }
  if (trimmed === 'transparent') {
    return 'rgba(0, 0, 0, 0)';
  }

  if (trimmed.startsWith('#')) {
    const hex = trimmed.slice(1);
    if (![3, 4, 6, 8].includes(hex.length)) {
      return `color-mix(in srgb, ${trimmed} ${Math.round(multiplier * 100)}%, transparent)`;
    }
    const expanded = hex.length <= 4
      ? hex.split('').map(char => `${char}${char}`).join('')
      : hex;
    const red = Number.parseInt(expanded.slice(0, 2), 16);
    const green = Number.parseInt(expanded.slice(2, 4), 16);
    const blue = Number.parseInt(expanded.slice(4, 6), 16);
    const sourceAlpha = expanded.length === 8
      ? Number.parseInt(expanded.slice(6, 8), 16) / 255
      : 1;
    return `rgba(${red}, ${green}, ${blue}, ${formatAlphaComponent(sourceAlpha * multiplier)})`;
  }

  const rgbaMatch = trimmed.match(/^rgba\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^)]+)\)$/i);
  if (rgbaMatch) {
    const [, red, green, blue, alpha] = rgbaMatch;
    return `rgba(${red.trim()}, ${green.trim()}, ${blue.trim()}, ${formatAlphaComponent(Number.parseFloat(alpha) * multiplier)})`;
  }

  const rgbMatch = trimmed.match(/^rgb\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^)]+)\)$/i);
  if (rgbMatch) {
    const [, red, green, blue] = rgbMatch;
    return `rgba(${red.trim()}, ${green.trim()}, ${blue.trim()}, ${formatAlphaComponent(multiplier)})`;
  }

  const hslaMatch = trimmed.match(/^hsla\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^)]+)\)$/i);
  if (hslaMatch) {
    const [, hue, saturation, lightness, alpha] = hslaMatch;
    return `hsla(${hue.trim()}, ${saturation.trim()}, ${lightness.trim()}, ${formatAlphaComponent(Number.parseFloat(alpha) * multiplier)})`;
  }

  const hslMatch = trimmed.match(/^hsl\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^)]+)\)$/i);
  if (hslMatch) {
    const [, hue, saturation, lightness] = hslMatch;
    return `hsla(${hue.trim()}, ${saturation.trim()}, ${lightness.trim()}, ${formatAlphaComponent(multiplier)})`;
  }

  return `color-mix(in srgb, ${trimmed} ${Math.round(multiplier * 100)}%, transparent)`;
}

function applyPanelTransparency(
  theme: OverlayThemeDefinition,
  panelTransparency: number,
): OverlayThemeDefinition {
  const panelOpacity = 1 - clampOverlayVisualControlValue('panelTransparency', panelTransparency);
  if (panelOpacity >= 0.999) {
    return theme;
  }

  return {
    ...theme,
    palette: {
      ...theme.palette,
      topBarBackground: multiplyColorAlpha(theme.palette.topBarBackground, panelOpacity),
      topBarMenuBackground: multiplyColorAlpha(theme.palette.topBarMenuBackground, panelOpacity),
      sidebarBackground: multiplyColorAlpha(theme.palette.sidebarBackground, panelOpacity),
      panelBackground: multiplyColorAlpha(theme.palette.panelBackground, panelOpacity),
      panelAltBackground: multiplyColorAlpha(theme.palette.panelAltBackground, panelOpacity),
      cardBackground: multiplyColorAlpha(theme.palette.cardBackground, panelOpacity),
      cardHoverBackground: multiplyColorAlpha(theme.palette.cardHoverBackground, panelOpacity),
      contextMenuBackground: multiplyColorAlpha(theme.palette.contextMenuBackground, panelOpacity),
      inputBackground: multiplyColorAlpha(theme.palette.inputBackground, panelOpacity),
      border: multiplyColorAlpha(theme.palette.border, panelOpacity),
      borderStrong: multiplyColorAlpha(theme.palette.borderStrong, panelOpacity),
    },
  };
}

function createTheme(
  id: string,
  name: string,
  description: string,
  palette: Partial<OverlayThemePalette>,
  effects: Partial<OverlayThemeEffects>,
  xterm: Partial<OverlayXTermTheme>,
): OverlayThemeDefinition {
  return {
    id,
    name,
    description,
    source: 'built-in',
    palette: {
      appBackground: '#07070f',
      appBackgroundAlt: '#0b0b18',
      shellBackground: 'rgba(7, 7, 15, 0.76)',
      shellBackgroundSolid: 'rgba(7, 7, 15, 0.96)',
      topBarBackground: '#0b0b18',
      topBarMenuBackground: '#111224',
      sidebarBackground: '#111217',
      panelBackground: '#131419',
      panelAltBackground: '#181a21',
      cardBackground: '#181a21',
      cardHoverBackground: '#1e2029',
      contextMenuBackground: '#1a1c25',
      inputBackground: '#1e2130',
      terminalBackground: '#05050e',
      selectionBackground: 'rgba(99,102,241,0.22)',
      scrimBackground: 'rgba(0,0,0,0.68)',
      textPrimary: '#e2e2f0',
      textSecondary: '#d6d9ef',
      textMuted: 'rgba(226,226,240,0.58)',
      textDim: 'rgba(226,226,240,0.28)',
      textInverse: '#05050e',
      border: 'rgba(255,255,255,0.08)',
      borderStrong: 'rgba(255,255,255,0.14)',
      accent: '#6366f1',
      accentSoft: 'rgba(99,102,241,0.18)',
      accentContrast: '#eef0ff',
      success: '#4ade80',
      warning: '#fbbf24',
      danger: '#f87171',
      info: '#60a5fa',
      note: '#60a5fa',
      todo: '#4ade80',
      bug: '#f87171',
      prompt: '#c084fc',
      ...palette,
    },
    effects: {
      backgroundImage: 'radial-gradient(circle at 20% 15%, rgba(99,102,241,0.22), transparent 28%), radial-gradient(circle at 82% 18%, rgba(56,189,248,0.14), transparent 24%), linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0))',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      shadow: '0 16px 48px rgba(0,0,0,0.48)',
      overlayShadow: '0 -4px 0 0 #6366f1, 0 -32px 80px rgba(0,0,0,0.98)',
      ...effects,
    },
    xterm: {
      background: '#05050e',
      foreground: '#c9d1d9',
      cursor: '#6366f1',
      black: '#161b22',
      red: '#ff7b72',
      green: '#3fb950',
      yellow: '#d29922',
      blue: '#58a6ff',
      magenta: '#bc8cff',
      cyan: '#39c5cf',
      white: '#b1bac4',
      brightBlack: '#6e7681',
      brightRed: '#ffa198',
      brightGreen: '#56d364',
      brightYellow: '#e3b341',
      brightBlue: '#79c0ff',
      brightMagenta: '#d2a8ff',
      brightCyan: '#56d4dd',
      brightWhite: '#f0f6fc',
      ...xterm,
    },
    presentation: {
      density: 'comfortable',
      chromeStyle: 'floating',
      iconStyle: 'vector',
      motionStyle: 'fluid',
      cornerRadius: 18,
      panelSpacing: 12,
    },
  };
}

const builtInThemePresets: OverlayThemeDefinition[] = [
  createTheme(
    'operator',
    'Operator',
    'Indigo glass with a terminal-heavy neon shell.',
    {
      appBackground: '#07070f',
      appBackgroundAlt: '#0b0b18',
      shellBackground: 'rgba(7, 7, 15, 0.76)',
      shellBackgroundSolid: 'rgba(7, 7, 15, 0.96)',
      topBarBackground: '#0b0b18',
      topBarMenuBackground: '#111224',
      sidebarBackground: '#111217',
      panelBackground: '#131419',
      panelAltBackground: '#181a21',
      cardBackground: '#181a21',
      cardHoverBackground: '#1e2029',
      contextMenuBackground: '#1a1c25',
      inputBackground: '#1e2130',
      terminalBackground: '#05050e',
      selectionBackground: 'rgba(99,102,241,0.22)',
      textPrimary: '#e2e2f0',
      textSecondary: '#d6d9ef',
      textMuted: 'rgba(226,226,240,0.58)',
      textDim: 'rgba(226,226,240,0.22)',
      border: 'rgba(255,255,255,0.08)',
      borderStrong: 'rgba(255,255,255,0.16)',
      accent: '#6366f1',
      accentSoft: 'rgba(99,102,241,0.18)',
      accentContrast: '#eef0ff',
      success: '#4ade80',
      warning: '#fbbf24',
      danger: '#f87171',
      info: '#60a5fa',
      note: '#60a5fa',
      todo: '#4ade80',
      bug: '#f87171',
      prompt: '#c084fc',
    },
    {
      backgroundImage: 'radial-gradient(circle at 16% 12%, rgba(99,102,241,0.26), transparent 30%), radial-gradient(circle at 84% 14%, rgba(56,189,248,0.16), transparent 22%), linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0))',
      overlayShadow: '0 -4px 0 0 #6366f1, 0 -32px 80px rgba(0,0,0,0.98)',
    },
    {},
  ),
  createTheme(
    'dracula',
    'Dracula',
    'Violet noir with saturated magenta edges.',
    {
      appBackground: '#18131f',
      appBackgroundAlt: '#201827',
      shellBackground: 'rgba(30, 24, 39, 0.8)',
      shellBackgroundSolid: 'rgba(30, 24, 39, 0.96)',
      topBarBackground: '#221b2c',
      topBarMenuBackground: '#2a2136',
      sidebarBackground: '#221d2d',
      panelBackground: '#272235',
      panelAltBackground: '#2d2840',
      cardBackground: '#312c44',
      cardHoverBackground: '#3a3551',
      contextMenuBackground: '#2f2940',
      inputBackground: '#39324c',
      terminalBackground: '#191a26',
      selectionBackground: 'rgba(189,147,249,0.24)',
      textPrimary: '#f8f8f2',
      textSecondary: '#e5def9',
      textMuted: 'rgba(248,248,242,0.62)',
      textDim: 'rgba(248,248,242,0.24)',
      border: 'rgba(189,147,249,0.18)',
      borderStrong: 'rgba(189,147,249,0.32)',
      accent: '#bd93f9',
      accentSoft: 'rgba(189,147,249,0.18)',
      accentContrast: '#fdf7ff',
      note: '#8be9fd',
      todo: '#50fa7b',
      bug: '#ff5555',
      prompt: '#ff79c6',
    },
    {
      backgroundImage: 'radial-gradient(circle at 12% 14%, rgba(189,147,249,0.28), transparent 28%), radial-gradient(circle at 84% 18%, rgba(255,121,198,0.16), transparent 24%), linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0))',
      overlayShadow: '0 -4px 0 0 #bd93f9, 0 -32px 80px rgba(12,8,18,0.94)',
    },
    {
      background: '#191a26',
      foreground: '#f8f8f2',
      cursor: '#bd93f9',
      black: '#21222c',
      red: '#ff5555',
      green: '#50fa7b',
      yellow: '#f1fa8c',
      blue: '#6272a4',
      magenta: '#ff79c6',
      cyan: '#8be9fd',
      white: '#f8f8f2',
      brightBlack: '#6272a4',
      brightRed: '#ff6e6e',
      brightGreen: '#69ff94',
      brightYellow: '#ffffa5',
      brightBlue: '#d6acff',
      brightMagenta: '#ff92df',
      brightCyan: '#a4ffff',
      brightWhite: '#ffffff',
    },
  ),
  createTheme(
    'nord',
    'Nord',
    'Cool arctic steel with restrained cyan accents.',
    {
      appBackground: '#161a22',
      appBackgroundAlt: '#1a1f28',
      shellBackground: 'rgba(22, 26, 34, 0.8)',
      shellBackgroundSolid: 'rgba(22, 26, 34, 0.96)',
      topBarBackground: '#1b2029',
      topBarMenuBackground: '#202632',
      sidebarBackground: '#20252f',
      panelBackground: '#242a35',
      panelAltBackground: '#28303c',
      cardBackground: '#2d3441',
      cardHoverBackground: '#343b49',
      contextMenuBackground: '#2b3440',
      inputBackground: '#303947',
      terminalBackground: '#181c24',
      selectionBackground: 'rgba(136,192,208,0.22)',
      textPrimary: '#eceff4',
      textSecondary: '#d8dee9',
      textMuted: 'rgba(236,239,244,0.58)',
      textDim: 'rgba(236,239,244,0.22)',
      border: 'rgba(136,192,208,0.16)',
      borderStrong: 'rgba(136,192,208,0.28)',
      accent: '#88c0d0',
      accentSoft: 'rgba(136,192,208,0.16)',
      accentContrast: '#09141a',
      success: '#a3be8c',
      warning: '#ebcb8b',
      danger: '#bf616a',
      info: '#81a1c1',
      note: '#81a1c1',
      todo: '#a3be8c',
      bug: '#bf616a',
      prompt: '#b48ead',
    },
    {
      backgroundImage: 'radial-gradient(circle at 18% 15%, rgba(136,192,208,0.22), transparent 28%), radial-gradient(circle at 78% 18%, rgba(129,161,193,0.14), transparent 22%), linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0))',
      overlayShadow: '0 -4px 0 0 #88c0d0, 0 -32px 80px rgba(8,13,20,0.94)',
    },
    {
      background: '#181c24',
      foreground: '#d8dee9',
      cursor: '#88c0d0',
      black: '#3b4252',
      red: '#bf616a',
      green: '#a3be8c',
      yellow: '#ebcb8b',
      blue: '#81a1c1',
      magenta: '#b48ead',
      cyan: '#88c0d0',
      white: '#e5e9f0',
      brightBlack: '#4c566a',
      brightRed: '#bf616a',
      brightGreen: '#a3be8c',
      brightYellow: '#ebcb8b',
      brightBlue: '#81a1c1',
      brightMagenta: '#b48ead',
      brightCyan: '#8fbcbb',
      brightWhite: '#eceff4',
    },
  ),
  createTheme(
    'monokai',
    'Monokai',
    'Warm noir with acid highlights.',
    {
      appBackground: '#171710',
      appBackgroundAlt: '#1d1d14',
      shellBackground: 'rgba(23, 23, 16, 0.82)',
      shellBackgroundSolid: 'rgba(23, 23, 16, 0.96)',
      topBarBackground: '#1f2018',
      topBarMenuBackground: '#25261d',
      sidebarBackground: '#222319',
      panelBackground: '#272820',
      panelAltBackground: '#2c2d24',
      cardBackground: '#313229',
      cardHoverBackground: '#37392f',
      contextMenuBackground: '#303126',
      inputBackground: '#393a30',
      terminalBackground: '#161712',
      selectionBackground: 'rgba(230,219,116,0.24)',
      textPrimary: '#f8f8f2',
      textSecondary: '#e7e6d0',
      textMuted: 'rgba(248,248,242,0.56)',
      textDim: 'rgba(248,248,242,0.22)',
      border: 'rgba(230,219,116,0.16)',
      borderStrong: 'rgba(230,219,116,0.3)',
      accent: '#e6db74',
      accentSoft: 'rgba(230,219,116,0.18)',
      accentContrast: '#11130a',
      success: '#a6e22e',
      warning: '#fd971f',
      danger: '#f92672',
      info: '#66d9ef',
      note: '#66d9ef',
      todo: '#a6e22e',
      bug: '#f92672',
      prompt: '#ae81ff',
    },
    {
      backgroundImage: 'radial-gradient(circle at 18% 14%, rgba(230,219,116,0.22), transparent 28%), radial-gradient(circle at 82% 20%, rgba(102,217,239,0.14), transparent 20%), linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0))',
      overlayShadow: '0 -4px 0 0 #e6db74, 0 -32px 80px rgba(10,10,7,0.94)',
    },
    {
      background: '#161712',
      foreground: '#f8f8f2',
      cursor: '#f8f8f2',
      black: '#272822',
      red: '#f92672',
      green: '#a6e22e',
      yellow: '#e6db74',
      blue: '#66d9ef',
      magenta: '#ae81ff',
      cyan: '#a1efe4',
      white: '#f8f8f2',
      brightBlack: '#75715e',
      brightRed: '#f92672',
      brightGreen: '#a6e22e',
      brightYellow: '#e6db74',
      brightBlue: '#66d9ef',
      brightMagenta: '#ae81ff',
      brightCyan: '#a1efe4',
      brightWhite: '#f9f8f5',
    },
  ),
  createTheme(
    'github-dark',
    'GitHub Dark',
    'Sharper blue-on-graphite shell.',
    {
      appBackground: '#0d1117',
      appBackgroundAlt: '#111827',
      shellBackground: 'rgba(13, 17, 23, 0.8)',
      shellBackgroundSolid: 'rgba(13, 17, 23, 0.96)',
      topBarBackground: '#161b22',
      topBarMenuBackground: '#1a2028',
      sidebarBackground: '#161b22',
      panelBackground: '#1f2630',
      panelAltBackground: '#242c36',
      cardBackground: '#222b36',
      cardHoverBackground: '#2c3744',
      contextMenuBackground: '#202734',
      inputBackground: '#253041',
      terminalBackground: '#0a0e14',
      selectionBackground: 'rgba(88,166,255,0.22)',
      textPrimary: '#c9d1d9',
      textSecondary: '#eef2f7',
      textMuted: 'rgba(201,209,217,0.6)',
      textDim: 'rgba(201,209,217,0.25)',
      border: 'rgba(48,54,61,0.82)',
      borderStrong: 'rgba(88,166,255,0.26)',
      accent: '#58a6ff',
      accentSoft: 'rgba(88,166,255,0.18)',
      accentContrast: '#f0f6fc',
      success: '#3fb950',
      warning: '#d29922',
      danger: '#ff7b72',
      info: '#58a6ff',
      note: '#58a6ff',
      todo: '#3fb950',
      bug: '#ff7b72',
      prompt: '#bc8cff',
    },
    {
      backgroundImage: 'radial-gradient(circle at 16% 12%, rgba(88,166,255,0.22), transparent 28%), radial-gradient(circle at 84% 16%, rgba(188,140,255,0.14), transparent 20%), linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0))',
      overlayShadow: '0 -4px 0 0 #58a6ff, 0 -32px 80px rgba(2,6,12,0.94)',
    },
    {
      background: '#0a0e14',
      foreground: '#c9d1d9',
      cursor: '#58a6ff',
      black: '#484f58',
      red: '#ff7b72',
      green: '#3fb950',
      yellow: '#d29922',
      blue: '#58a6ff',
      magenta: '#bc8cff',
      cyan: '#39c5cf',
      white: '#b1bac4',
      brightBlack: '#6e7681',
      brightRed: '#ffa198',
      brightGreen: '#56d364',
      brightYellow: '#e3b341',
      brightBlue: '#79c0ff',
      brightMagenta: '#d2a8ff',
      brightCyan: '#56d4dd',
      brightWhite: '#f0f6fc',
    },
  ),
  createTheme(
    'catppuccin',
    'Catppuccin',
    'Dreamy blue-lilac shell with soft contrast.',
    {
      appBackground: '#1b1b2f',
      appBackgroundAlt: '#1f2036',
      shellBackground: 'rgba(30, 30, 46, 0.82)',
      shellBackgroundSolid: 'rgba(30, 30, 46, 0.96)',
      topBarBackground: '#24273a',
      topBarMenuBackground: '#292d42',
      sidebarBackground: '#25283d',
      panelBackground: '#2a2f46',
      panelAltBackground: '#31374f',
      cardBackground: '#363d58',
      cardHoverBackground: '#3d4563',
      contextMenuBackground: '#343a55',
      inputBackground: '#3b425f',
      terminalBackground: '#181825',
      selectionBackground: 'rgba(203,166,247,0.24)',
      textPrimary: '#cdd6f4',
      textSecondary: '#eef2ff',
      textMuted: 'rgba(205,214,244,0.62)',
      textDim: 'rgba(205,214,244,0.24)',
      border: 'rgba(203,166,247,0.16)',
      borderStrong: 'rgba(203,166,247,0.3)',
      accent: '#cba6f7',
      accentSoft: 'rgba(203,166,247,0.18)',
      accentContrast: '#1a1322',
      success: '#a6e3a1',
      warning: '#f9e2af',
      danger: '#f38ba8',
      info: '#89b4fa',
      note: '#89b4fa',
      todo: '#a6e3a1',
      bug: '#f38ba8',
      prompt: '#f5c2e7',
    },
    {
      backgroundImage: 'radial-gradient(circle at 16% 13%, rgba(203,166,247,0.24), transparent 28%), radial-gradient(circle at 84% 16%, rgba(137,180,250,0.16), transparent 20%), linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0))',
      overlayShadow: '0 -4px 0 0 #cba6f7, 0 -32px 80px rgba(8,8,14,0.94)',
    },
    {
      background: '#181825',
      foreground: '#cdd6f4',
      cursor: '#cba6f7',
      black: '#313244',
      red: '#f38ba8',
      green: '#a6e3a1',
      yellow: '#f9e2af',
      blue: '#89b4fa',
      magenta: '#cba6f7',
      cyan: '#89dceb',
      white: '#bac2de',
      brightBlack: '#585b70',
      brightRed: '#f38ba8',
      brightGreen: '#a6e3a1',
      brightYellow: '#f9e2af',
      brightBlue: '#89b4fa',
      brightMagenta: '#cba6f7',
      brightCyan: '#89dceb',
      brightWhite: '#a6adc8',
    },
  ),
];

const overlayThemeDefaultShaderIds: Partial<Record<string, string>> = {
  operator: 'nebula-flow',
  dracula: 'prism-wave',
  nord: 'hologram-grid',
  'github-dark': 'hologram-grid',
  catppuccin: 'nebula-flow',
};

const overlayThemeDefaultOpenAnimationIds: Partial<Record<string, string>> = {
  operator: 'spring-lift',
  dracula: 'dissolve',
  nord: 'lift',
  'github-dark': 'spring-lift',
  catppuccin: 'dissolve',
};

const overlayThemeDefaultCloseAnimationIds: Partial<Record<string, string>> = {
  operator: 'burn',
  dracula: 'fizzle',
  nord: 'dissolve',
  'github-dark': 'burn',
  catppuccin: 'fizzle',
};

export const overlayThemePresets: OverlayThemeDefinition[] = builtInThemePresets.map(theme => ({
  ...theme,
  defaultShaderId: overlayThemeDefaultShaderIds[theme.id] ?? theme.defaultShaderId,
  defaultOpenAnimationId: overlayThemeDefaultOpenAnimationIds[theme.id] ?? theme.defaultOpenAnimationId,
  defaultCloseAnimationId: overlayThemeDefaultCloseAnimationIds[theme.id] ?? theme.defaultCloseAnimationId,
}));

const presetMap = new Map(overlayThemePresets.map(theme => [theme.id, theme]));

function normalizeThemeVisualLayer(
  layer: OverlayThemeVisualLayer,
  index: number,
): OverlayThemeVisualLayer {
  return {
    ...layer,
    id: String(layer.id ?? `visual-${index}`),
    backgroundImage: String(layer.backgroundImage ?? '').trim(),
    backgroundSize: layer.backgroundSize ?? 'cover',
    backgroundPosition: layer.backgroundPosition ?? 'center',
    backgroundRepeat: layer.backgroundRepeat ?? 'no-repeat',
    opacity: typeof layer.opacity === 'number' ? layer.opacity : 1,
    blendMode: layer.blendMode ?? 'normal',
    filter: layer.filter ?? 'none',
    inset: layer.inset ?? '0',
    animation: layer.animation
      ? {
          kind: layer.animation.kind,
          durationMs: typeof layer.animation.durationMs === 'number' ? layer.animation.durationMs : 18000,
          easing: layer.animation.easing ?? 'ease-in-out',
          direction: layer.animation.direction ?? 'alternate',
        }
      : undefined,
  };
}

function mergeThemeAssets(
  fallbackAssets?: OverlayThemeAssets,
  themeAssets?: OverlayThemeAssets,
): OverlayThemeAssets | undefined {
  if (!fallbackAssets && !themeAssets) {
    return undefined;
  }

  return {
    ...fallbackAssets,
    ...themeAssets,
    iconTheme: fallbackAssets?.iconTheme && themeAssets?.iconTheme
      ? mergeResolvedIconThemes(fallbackAssets.iconTheme, themeAssets.iconTheme)
      : (themeAssets?.iconTheme ?? fallbackAssets?.iconTheme),
    iconEntries: {
      ...(fallbackAssets?.iconEntries ?? {}),
      ...(themeAssets?.iconEntries ?? {}),
    },
  };
}

export function normalizeThemeDefinition(
  theme: Partial<OverlayThemeDefinition>,
  fallbackTheme?: OverlayThemeDefinition,
): OverlayThemeDefinition {
  const fallback = fallbackTheme ?? presetMap.get('operator') ?? overlayThemePresets[0];
  return {
    ...fallback,
    ...theme,
    id: String(theme.id ?? fallback.id),
    name: String(theme.name ?? fallback.name),
    description: theme.description ?? fallback.description,
    defaultShaderId: typeof theme.defaultShaderId === 'string'
      ? theme.defaultShaderId.trim() || undefined
      : fallback.defaultShaderId,
    defaultOpenAnimationId: typeof theme.defaultOpenAnimationId === 'string'
      ? theme.defaultOpenAnimationId.trim() || undefined
      : fallback.defaultOpenAnimationId,
    defaultCloseAnimationId: typeof theme.defaultCloseAnimationId === 'string'
      ? theme.defaultCloseAnimationId.trim() || undefined
      : fallback.defaultCloseAnimationId,
    source: theme.source ?? fallback.source ?? 'custom',
    extendsThemeId: theme.extendsThemeId ?? fallback.extendsThemeId,
    palette: {
      ...fallback.palette,
      ...(theme.palette ?? {}),
    },
    effects: {
      ...fallback.effects,
      ...(theme.effects ?? {}),
    },
    xterm: {
      ...fallback.xterm,
      ...(theme.xterm ?? {}),
    },
    fonts: {
      ...(fallback.fonts ?? {}),
      ...(theme.fonts ?? {}),
    },
    presentation: {
      ...(fallback.presentation ?? {}),
      ...(theme.presentation ?? {}),
    },
    compatibility: {
      shellBlueprints: Array.from(new Set(
        (theme.compatibility?.shellBlueprints ?? fallback.compatibility?.shellBlueprints ?? [])
          .filter((entry): entry is OverlayShellBlueprintId => typeof entry === 'string' && entry.trim().length > 0),
      )),
      tags: Array.from(new Set(
        (theme.compatibility?.tags ?? fallback.compatibility?.tags ?? [])
          .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
          .map(entry => entry.trim()),
      )),
    },
    assets: mergeThemeAssets(fallback.assets, theme.assets),
    visuals: (theme.visuals ?? fallback.visuals ?? [])
      .filter(layer => Boolean(layer?.backgroundImage))
      .map((layer, index) => normalizeThemeVisualLayer(layer, index)),
    cssVars: {
      ...(fallback.cssVars ?? {}),
      ...(theme.cssVars ?? {}),
    },
  };
}

export function upsertCustomTheme(
  customThemes: OverlayThemeDefinition[],
  nextTheme: OverlayThemeDefinition,
): OverlayThemeDefinition[] {
  const normalized = normalizeThemeDefinition(nextTheme);
  const existingIndex = customThemes.findIndex(theme => theme.id === normalized.id);

  if (existingIndex === -1) {
    return [...customThemes, normalized];
  }

  const updated = [...customThemes];
  updated[existingIndex] = normalized;
  return updated;
}

export function parseImportedTheme(source: string): OverlayThemeDefinition {
  const parsed = JSON.parse(source) as Partial<OverlayThemeDefinition> | { theme?: Partial<OverlayThemeDefinition> };
  const candidate = 'theme' in parsed ? parsed.theme ?? {} : parsed;
  return normalizeThemeDefinition(candidate as Partial<OverlayThemeDefinition>);
}

export function serializeTheme(theme: OverlayThemeDefinition): string {
  return JSON.stringify(theme, null, 2);
}

export function resolveOverlayAppearance(selection?: OverlayAppearanceSelection): ResolvedOverlayAppearance {
  const customThemes = (selection?.customThemes ?? []).map(theme => normalizeThemeDefinition(theme));
  const packageThemes = (selection?.packageThemes ?? []).map(theme => normalizeThemeDefinition(theme, presetMap.get(theme.extendsThemeId ?? '') ?? undefined));
  const activeThemeId = selection?.activeThemeId ?? 'operator';
  const panelTransparency = clampOverlayVisualControlValue('panelTransparency', selection?.panelTransparency ?? 0);
  const themeLookup = new Map<string, OverlayThemeDefinition>([
    ...overlayThemePresets.map(theme => [theme.id, theme] as const),
    ...packageThemes.map(theme => [theme.id, theme] as const),
    ...customThemes.map(theme => [theme.id, theme] as const),
  ]);

  const baseTheme = themeLookup.get(activeThemeId) ?? overlayThemePresets[0];
  const theme = applyPanelTransparency(baseTheme, panelTransparency);
  const fonts = {
    ui: selection?.uiFontFamily?.trim() || baseTheme.fonts?.ui || defaultUiFont,
    mono: selection?.monoFontFamily?.trim() || baseTheme.fonts?.mono || defaultMonoFont,
  };

  return {
    theme,
    baseTheme,
    themes: [...overlayThemePresets, ...packageThemes, ...customThemes],
    fonts,
    panelTransparency,
    cssVars: {
      '--overlay-font-ui': fonts.ui,
      '--overlay-font-mono': fonts.mono,
      '--overlay-bg-app': theme.palette.appBackground,
      '--overlay-bg-app-alt': theme.palette.appBackgroundAlt,
      '--overlay-bg-shell': theme.palette.shellBackground,
      '--overlay-bg-shell-solid': theme.palette.shellBackgroundSolid,
      '--overlay-bg-topbar': theme.palette.topBarBackground,
      '--overlay-bg-topbar-menu': theme.palette.topBarMenuBackground,
      '--overlay-bg-sidebar': theme.palette.sidebarBackground,
      '--overlay-bg-panel': theme.palette.panelBackground,
      '--overlay-bg-panel-alt': theme.palette.panelAltBackground,
      '--overlay-bg-card': theme.palette.cardBackground,
      '--overlay-bg-card-hover': theme.palette.cardHoverBackground,
      '--overlay-bg-context': theme.palette.contextMenuBackground,
      '--overlay-bg-input': theme.palette.inputBackground,
      '--overlay-bg-terminal': theme.palette.terminalBackground,
      '--overlay-bg-selection': theme.palette.selectionBackground,
      '--overlay-bg-scrim': theme.palette.scrimBackground,
      '--overlay-text-primary': theme.palette.textPrimary,
      '--overlay-text-secondary': theme.palette.textSecondary,
      '--overlay-text-muted': theme.palette.textMuted,
      '--overlay-text-dim': theme.palette.textDim,
      '--overlay-text-inverse': theme.palette.textInverse,
      '--overlay-border': theme.palette.border,
      '--overlay-border-strong': theme.palette.borderStrong,
      '--overlay-accent': theme.palette.accent,
      '--overlay-accent-soft': theme.palette.accentSoft,
      '--overlay-accent-contrast': theme.palette.accentContrast,
      '--overlay-success': theme.palette.success,
      '--overlay-warning': theme.palette.warning,
      '--overlay-danger': theme.palette.danger,
      '--overlay-info': theme.palette.info,
      '--overlay-note': theme.palette.note,
      '--overlay-todo': theme.palette.todo,
      '--overlay-bug': theme.palette.bug,
      '--overlay-prompt': theme.palette.prompt,
      '--overlay-background-image': theme.effects.backgroundImage,
      '--overlay-background-size': theme.effects.backgroundSize,
      '--overlay-background-position': theme.effects.backgroundPosition,
      '--overlay-shadow': theme.effects.shadow,
      '--overlay-overlay-shadow': theme.effects.overlayShadow,
      '--overlay-panel-transparency': String(panelTransparency),
      '--overlay-panel-opacity': formatAlphaComponent(1 - panelTransparency),
      '--overlay-density': theme.presentation?.density ?? 'comfortable',
      '--overlay-chrome-style': theme.presentation?.chromeStyle ?? 'floating',
      '--overlay-icon-style': theme.presentation?.iconStyle ?? 'vector',
      '--overlay-motion-style': theme.presentation?.motionStyle ?? 'fluid',
      '--overlay-corner-radius': String(theme.presentation?.cornerRadius ?? 18),
      '--overlay-panel-spacing': String(theme.presentation?.panelSpacing ?? 12),
      ...(theme.cssVars ?? {}),
    },
  };
}

export function getThemeSourceLabel(theme: OverlayThemeDefinition): string {
  switch (theme.source) {
    case 'package':
      return 'Package';
    case 'custom':
      return 'Custom';
    default:
      return 'Built In';
  }
}

export function isThemeCompatibleWithShellBlueprint(
  theme: OverlayThemeDefinition,
  shellBlueprint: OverlayShellBlueprintId,
): boolean {
  const supportedShells = theme.compatibility?.shellBlueprints ?? [];
  return supportedShells.length === 0 || supportedShells.includes(shellBlueprint);
}
