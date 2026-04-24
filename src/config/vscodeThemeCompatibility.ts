import { parse as parseJsonc, printParseErrorCode, type ParseError } from 'jsonc-parser';

import {
  DEFAULT_PILOT_DARK_THEME_ID,
  DEFAULT_PILOT_LIGHT_THEME_ID,
} from './pilotThemeContract';
import { joinPlatformPath } from './platform';
import {
  getBuiltInIconTheme,
  mergeResolvedIconThemes,
  resolveIconThemeManifest,
  type OverlayIconThemeManifest,
  type OverlayResolvedIconTheme,
} from './iconTheme';
import {
  normalizeThemeDefinition,
  overlayThemePresets,
  type OverlayMonacoThemeCompatibility,
  type OverlayMonacoThemeCompatibilityRule,
  type OverlayThemeDefinition,
  type OverlayThemePalette,
  type OverlayXTermTheme,
} from './appearance';
import {
  commands,
  unwrapTauriResult,
} from '../runtime/tauriClient';

type LooseRecord = Record<string, unknown>;

type FileSystemEntryLike = {
  name: string;
  path: string;
  is_dir?: boolean;
  isDirectory?: boolean;
  extension?: string;
};

type VsCodeExtensionSourceKind = 'folder' | 'vsix';

type VsCodeIconThemeContribution = {
  id?: string;
  label?: string;
  path?: string;
};

type VsCodeColorThemeContribution = {
  id?: string;
  label?: string;
  path?: string;
  uiTheme?: string;
};

type VsCodeExtensionManifest = {
  name?: string;
  publisher?: string;
  displayName?: string;
  description?: string;
  version?: string;
  contributes?: {
    iconThemes?: VsCodeIconThemeContribution[];
    themes?: VsCodeColorThemeContribution[];
  };
};

type VsCodeIconThemeDefinition = {
  file?: string;
  folder?: string;
  folderExpanded?: string;
  iconDefinitions?: Record<string, {
    iconPath?: string;
    fontCharacter?: string;
    fontColor?: string;
    fontSize?: string | number;
    fontId?: string;
  }>;
  fileExtensions?: Record<string, string>;
  fileNames?: Record<string, string>;
  folderNames?: Record<string, string>;
  folderNamesExpanded?: Record<string, string>;
  fonts?: Array<{
    id?: string;
    size?: string | number;
    weight?: string;
    style?: string;
    src?: Array<{
      path?: string;
      format?: string;
    }>;
  }>;
};

type VsCodeColorThemeDocument = {
  type?: string;
  colors?: Record<string, string>;
  tokenColors?: unknown[];
};

type LoadedVsCodeFontFace = {
  id: string;
  dataUrl: string;
  format: string;
  weight: string;
  style: string;
  size: number;
};

type ResolvedVsCodeExtension = {
  originalPath: string;
  sourceKind: VsCodeExtensionSourceKind;
  cachedExtractionPath?: string;
  extensionRootPath: string;
  packageJsonPath: string;
  manifest: VsCodeExtensionManifest;
  extensionId: string;
  extensionName: string;
  extensionDescription?: string;
  versionLabel: string;
  versionNumber: number;
};

export interface ManagedPackageSourceInfo {
  compatibility: 'native' | 'vscode';
  source: 'built-in' | 'folder' | 'vsix' | 'plugin';
  originalPath: string;
  resolvedRootPath?: string;
  cachedExtractionPath?: string;
  extensionId?: string;
  contributionId?: string;
  contributionLabel?: string;
}

export interface LoadedVsCodeIconThemeContribution {
  id: string;
  name: string;
  version: number;
  description?: string;
  directoryPath: string;
  manifestPath: string;
  warnings: string[];
  iconTheme: OverlayResolvedIconTheme;
  sourceInfo: ManagedPackageSourceInfo;
}

export interface LoadedVsCodeColorThemeContribution {
  id: string;
  name: string;
  version: number;
  description?: string;
  directoryPath: string;
  manifestPath: string;
  warnings: string[];
  theme: OverlayThemeDefinition;
  localIconThemes: LoadedVsCodeIconThemeContribution[];
  sourceInfo: ManagedPackageSourceInfo;
}

export interface VsCodeCompatibilityLoadResult<TPackage> {
  packages: TPackage[];
  warnings: string[];
}

type ResolvedVsCodeColorThemeFile = {
  type?: string;
  colors: Record<string, string>;
  tokenColors: unknown[];
};

const DEFAULT_FALLBACK_THEME =
  overlayThemePresets.find(theme => theme.id === DEFAULT_PILOT_DARK_THEME_ID)
  ?? overlayThemePresets[0];

const DEFAULT_LIGHT_FALLBACK_THEME =
  overlayThemePresets.find(theme => theme.id === DEFAULT_PILOT_LIGHT_THEME_ID)
  ?? overlayThemePresets[0];

const VSCODE_TO_OVERLAY_PALETTE: Array<{
  target: keyof OverlayThemePalette;
  sourceIds: readonly string[];
}> = [
  { target: 'appBackground', sourceIds: ['editorGroupHeader.tabsBackground', 'sideBar.background', 'editor.background'] },
  { target: 'appBackgroundAlt', sourceIds: ['editor.background', 'sideBarSectionHeader.background', 'panel.background'] },
  { target: 'shellBackground', sourceIds: ['editorGroupHeader.tabsBackground', 'editor.background'] },
  { target: 'shellBackgroundSolid', sourceIds: ['editorGroupHeader.tabsBackground', 'editor.background'] },
  { target: 'topBarBackground', sourceIds: ['titleBar.activeBackground', 'activityBar.background', 'editorGroupHeader.tabsBackground'] },
  { target: 'topBarMenuBackground', sourceIds: ['menu.background', 'dropdown.background', 'editorWidget.background'] },
  { target: 'sidebarBackground', sourceIds: ['sideBar.background', 'activityBar.background', 'editorGroupHeader.tabsBackground'] },
  { target: 'panelBackground', sourceIds: ['editor.background', 'panel.background', 'peekViewEditor.background'] },
  { target: 'panelAltBackground', sourceIds: ['editorWidget.background', 'dropdown.listBackground', 'peekViewResult.background'] },
  { target: 'cardBackground', sourceIds: ['editorWidget.background', 'dropdown.background', 'input.background'] },
  { target: 'cardHoverBackground', sourceIds: ['list.hoverBackground', 'tab.inactiveBackground', 'editor.lineHighlightBackground'] },
  { target: 'contextMenuBackground', sourceIds: ['menu.background', 'dropdown.background'] },
  { target: 'inputBackground', sourceIds: ['input.background', 'quickInput.background', 'dropdown.background'] },
  { target: 'terminalBackground', sourceIds: ['terminal.background', 'panel.background', 'editor.background'] },
  { target: 'selectionBackground', sourceIds: ['editor.selectionBackground', 'selection.background', 'list.activeSelectionBackground'] },
  { target: 'scrimBackground', sourceIds: ['widget.shadow', 'editorGroup.dropBackground'] },
  { target: 'textPrimary', sourceIds: ['editor.foreground', 'sideBar.foreground', 'menu.foreground'] },
  { target: 'textSecondary', sourceIds: ['foreground', 'panelTitle.activeForeground', 'list.highlightForeground'] },
  { target: 'textMuted', sourceIds: ['descriptionForeground', 'panelTitle.inactiveForeground', 'editorLineNumber.foreground'] },
  { target: 'textDim', sourceIds: ['disabledForeground', 'editorWhitespace.foreground', 'editorLineNumber.foreground'] },
  { target: 'textInverse', sourceIds: ['button.foreground', 'badge.foreground', 'statusBar.foreground'] },
  { target: 'border', sourceIds: ['panel.border', 'tab.border', 'editorWidget.border'] },
  { target: 'borderStrong', sourceIds: ['focusBorder', 'panelTitle.activeBorder', 'inputOption.activeBorder'] },
  { target: 'accent', sourceIds: ['button.background', 'focusBorder', 'panelTitle.activeBorder', 'statusBar.debuggingBackground'] },
  { target: 'accentSoft', sourceIds: ['list.activeSelectionBackground', 'list.inactiveSelectionBackground', 'editor.selectionBackground'] },
  { target: 'accentContrast', sourceIds: ['button.foreground', 'badge.foreground', 'statusBar.foreground'] },
  { target: 'success', sourceIds: ['gitDecoration.addedResourceForeground', 'terminal.ansiBrightGreen', 'terminal.ansiGreen'] },
  { target: 'warning', sourceIds: ['inputValidation.warningBorder', 'terminal.ansiBrightYellow', 'terminal.ansiYellow'] },
  { target: 'danger', sourceIds: ['inputValidation.errorBorder', 'terminal.ansiBrightRed', 'terminal.ansiRed'] },
  { target: 'info', sourceIds: ['inputValidation.infoBorder', 'terminal.ansiBrightBlue', 'terminal.ansiBlue'] },
  { target: 'note', sourceIds: ['inputValidation.infoBorder', 'terminal.ansiBrightBlue', 'terminal.ansiBlue'] },
  { target: 'todo', sourceIds: ['gitDecoration.addedResourceForeground', 'terminal.ansiBrightGreen', 'terminal.ansiGreen'] },
  { target: 'bug', sourceIds: ['inputValidation.errorBorder', 'terminal.ansiBrightRed', 'terminal.ansiRed'] },
  { target: 'prompt', sourceIds: ['terminal.ansiBrightMagenta', 'terminal.ansiMagenta'] },
];

const VSCODE_TO_WORKBENCH_CSS_VARS: Array<{
  cssVar: string;
  sourceIds: readonly string[];
}> = [
  { cssVar: '--overlay-workbench-shell-bg', sourceIds: ['editorGroupHeader.tabsBackground', 'editor.background'] },
  { cssVar: '--overlay-workbench-chrome-bg', sourceIds: ['titleBar.activeBackground', 'activityBar.background', 'editorGroupHeader.tabsBackground'] },
  { cssVar: '--overlay-workbench-chrome-menu-bg', sourceIds: ['menu.background', 'dropdown.background', 'editorWidget.background'] },
  { cssVar: '--overlay-workbench-chrome-border', sourceIds: ['panel.border', 'tab.border', 'focusBorder'] },
  { cssVar: '--overlay-workbench-chrome-button-bg', sourceIds: ['button.background', 'input.background'] },
  { cssVar: '--overlay-workbench-chrome-button-hover-bg', sourceIds: ['list.hoverBackground', 'tab.inactiveBackground'] },
  { cssVar: '--overlay-workbench-chrome-button-active-bg', sourceIds: ['list.activeSelectionBackground', 'button.background'] },
  { cssVar: '--overlay-workbench-chrome-button-active-border', sourceIds: ['focusBorder', 'panelTitle.activeBorder'] },
  { cssVar: '--overlay-workbench-chrome-tab-bg', sourceIds: ['tab.inactiveBackground', 'editorGroupHeader.tabsBackground'] },
  { cssVar: '--overlay-workbench-chrome-tab-active-bg', sourceIds: ['editor.background', 'tab.activeBackground', 'editorGroupHeader.tabsBackground'] },
  { cssVar: '--overlay-workbench-chrome-tab-border', sourceIds: ['tab.border', 'panel.border'] },
  { cssVar: '--overlay-workbench-command-palette-bg', sourceIds: ['quickInput.background', 'editorWidget.background', 'dropdown.background'] },
  { cssVar: '--overlay-workbench-command-palette-border', sourceIds: ['focusBorder', 'panel.border'] },
  { cssVar: '--overlay-workbench-command-palette-input-bg', sourceIds: ['input.background', 'dropdown.background'] },
  { cssVar: '--overlay-workbench-command-palette-item-bg', sourceIds: ['quickInput.background', 'list.inactiveSelectionBackground'] },
  { cssVar: '--overlay-workbench-command-palette-item-active-bg', sourceIds: ['quickInputList.focusBackground', 'list.activeSelectionBackground'] },
  { cssVar: '--overlay-workbench-settings-bg', sourceIds: ['editor.background', 'panel.background'] },
  { cssVar: '--overlay-workbench-settings-rail-bg', sourceIds: ['sideBar.background', 'activityBar.background'] },
  { cssVar: '--overlay-workbench-settings-card-bg', sourceIds: ['editorWidget.background', 'dropdown.background'] },
  { cssVar: '--overlay-workbench-settings-card-border', sourceIds: ['panel.border', 'focusBorder'] },
  { cssVar: '--overlay-workbench-settings-badge-bg', sourceIds: ['badge.background', 'button.background'] },
  { cssVar: '--overlay-workbench-settings-badge-border', sourceIds: ['focusBorder', 'panelTitle.activeBorder'] },
  { cssVar: '--overlay-workbench-terminal-bg', sourceIds: ['terminal.background', 'panel.background'] },
  { cssVar: '--overlay-workbench-terminal-panel-bg', sourceIds: ['panel.background', 'editor.background'] },
  { cssVar: '--overlay-workbench-terminal-pane-bg', sourceIds: ['terminal.background', 'editor.background'] },
  { cssVar: '--overlay-workbench-terminal-border', sourceIds: ['panel.border', 'focusBorder'] },
  { cssVar: '--overlay-workbench-terminal-status-bg', sourceIds: ['statusBar.background', 'panel.background'] },
];

const VSCODE_TO_EXPLORER_CSS_VARS: Array<{
  cssVar: string;
  sourceIds: readonly string[];
}> = [
  { cssVar: '--overlay-explorer-root-bg', sourceIds: ['sideBar.background', 'editor.background'] },
  { cssVar: '--overlay-explorer-content-bg', sourceIds: ['editor.background', 'panel.background'] },
  { cssVar: '--overlay-explorer-sidebar-bg', sourceIds: ['sideBar.background', 'activityBar.background'] },
  { cssVar: '--overlay-explorer-toolbar-bg', sourceIds: ['sideBarSectionHeader.background', 'editorGroupHeader.tabsBackground'] },
  { cssVar: '--overlay-explorer-omnibox-bg', sourceIds: ['input.background', 'dropdown.background'] },
  { cssVar: '--overlay-explorer-preview-bg', sourceIds: ['editor.background', 'panel.background'] },
  { cssVar: '--overlay-explorer-preview-header-bg', sourceIds: ['editorGroupHeader.tabsBackground', 'sideBarSectionHeader.background'] },
  { cssVar: '--overlay-explorer-status-bg', sourceIds: ['statusBar.background', 'panel.background'] },
  { cssVar: '--overlay-explorer-item-hover-bg', sourceIds: ['list.hoverBackground', 'tab.inactiveBackground'] },
  { cssVar: '--overlay-explorer-item-selected-bg', sourceIds: ['list.activeSelectionBackground', 'editor.selectionBackground'] },
  { cssVar: '--overlay-explorer-item-drop-bg', sourceIds: ['list.dropBackground', 'editorGroup.dropBackground'] },
  { cssVar: '--overlay-explorer-input-bg', sourceIds: ['input.background', 'dropdown.background'] },
  { cssVar: '--overlay-explorer-chip-bg', sourceIds: ['badge.background', 'button.background'] },
  { cssVar: '--overlay-explorer-chip-active-bg', sourceIds: ['list.activeSelectionBackground', 'button.background'] },
  { cssVar: '--overlay-explorer-code-bg', sourceIds: ['editor.background', 'panel.background'] },
];

const VSCODE_TO_XTERM: Array<{
  target: keyof OverlayXTermTheme;
  sourceIds: readonly string[];
}> = [
  { target: 'background', sourceIds: ['terminal.background', 'panel.background', 'editor.background'] },
  { target: 'foreground', sourceIds: ['terminal.foreground', 'editor.foreground'] },
  { target: 'cursor', sourceIds: ['terminalCursor.foreground', 'editorCursor.foreground', 'focusBorder'] },
  { target: 'black', sourceIds: ['terminal.ansiBlack'] },
  { target: 'red', sourceIds: ['terminal.ansiRed'] },
  { target: 'green', sourceIds: ['terminal.ansiGreen'] },
  { target: 'yellow', sourceIds: ['terminal.ansiYellow'] },
  { target: 'blue', sourceIds: ['terminal.ansiBlue'] },
  { target: 'magenta', sourceIds: ['terminal.ansiMagenta'] },
  { target: 'cyan', sourceIds: ['terminal.ansiCyan'] },
  { target: 'white', sourceIds: ['terminal.ansiWhite'] },
  { target: 'brightBlack', sourceIds: ['terminal.ansiBrightBlack'] },
  { target: 'brightRed', sourceIds: ['terminal.ansiBrightRed'] },
  { target: 'brightGreen', sourceIds: ['terminal.ansiBrightGreen'] },
  { target: 'brightYellow', sourceIds: ['terminal.ansiBrightYellow'] },
  { target: 'brightBlue', sourceIds: ['terminal.ansiBrightBlue'] },
  { target: 'brightMagenta', sourceIds: ['terminal.ansiBrightMagenta'] },
  { target: 'brightCyan', sourceIds: ['terminal.ansiBrightCyan'] },
  { target: 'brightWhite', sourceIds: ['terminal.ansiBrightWhite'] },
];

function asRecord(value: unknown): LooseRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as LooseRecord;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isAbsolutePath(path: string): boolean {
  return /^(?:[a-z]:[\\/]|[\\/]{2}|\/)/i.test(path);
}

function normalizeCompatibilityId(value: string, fallback: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

function getParentDirectoryPath(path: string): string {
  const normalized = normalizePath(path);
  const lastSlash = normalized.lastIndexOf('/');
  if (lastSlash <= 0) {
    return normalized.startsWith('/') ? '/' : '.';
  }
  return normalized.slice(0, lastSlash);
}

function normalizeRelativeAssetPath(path: string): string {
  return path.trim().replace(/^\.([/\\])/, '');
}

function resolveRelativePath(rootPath: string, nextPath: string): string {
  const trimmedPath = nextPath.trim();
  if (!trimmedPath) {
    return rootPath;
  }
  if (isAbsolutePath(trimmedPath)) {
    return normalizePath(trimmedPath);
  }
  return joinPlatformPath(rootPath, normalizeRelativeAssetPath(trimmedPath));
}

function parseSemverMajor(value: string): number {
  const match = value.trim().match(/^(\d+)/);
  return match ? Math.max(1, Number.parseInt(match[1], 10)) : 1;
}

function normalizeEntry(entry: FileSystemEntryLike): Required<Pick<FileSystemEntryLike, 'name' | 'path' | 'extension'>> & { isDirectory: boolean } {
  const normalizedPath = normalizePath(entry.path);
  const normalizedExtension = asString(entry.extension).toLowerCase();
  return {
    name: entry.name,
    path: normalizedPath,
    extension: normalizedExtension,
    isDirectory: entry.isDirectory ?? entry.is_dir ?? false,
  };
}

function entryLooksLikeVsix(entry: ReturnType<typeof normalizeEntry>): boolean {
  return entry.extension === 'vsix' || entry.path.toLowerCase().endsWith('.vsix');
}

function detectMimeType(filePath: string, fallback = 'application/octet-stream'): string {
  const extension = normalizePath(filePath).split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'svg':
      return 'image/svg+xml';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'woff':
      return 'font/woff';
    case 'woff2':
      return 'font/woff2';
    case 'ttf':
      return 'font/ttf';
    case 'otf':
      return 'font/otf';
    default:
      return fallback;
  }
}

async function readTextFileIfExists(path: string): Promise<string | null> {
  try {
    return await commands.fsReadTextFile(path).then(unwrapTauriResult);
  } catch {
    return null;
  }
}

function formatJsoncErrors(errors: ParseError[]): string {
  return errors.map(error => printParseErrorCode(error.error)).join(', ');
}

function parseJsoncObject<TRecord extends LooseRecord>(source: string, filePath: string): TRecord {
  const errors: ParseError[] = [];
  const parsed = parseJsonc(source, errors, {
    allowTrailingComma: true,
    disallowComments: false,
  });
  if (errors.length > 0) {
    throw new Error(`Failed to parse JSONC ${filePath}: ${formatJsoncErrors(errors)}`);
  }
  const record = asRecord(parsed);
  if (!record) {
    throw new Error(`Expected an object in ${filePath}`);
  }
  return record as TRecord;
}

async function resolveVsCodeExtensionFromEntry(
  entryLike: FileSystemEntryLike,
): Promise<ResolvedVsCodeExtension | null> {
  const entry = normalizeEntry(entryLike);
  let extensionRootPath = entry.path;
  let packageJsonPath = '';
  let manifest: VsCodeExtensionManifest | null = null;
  let sourceKind: VsCodeExtensionSourceKind = 'folder';
  let cachedExtractionPath: string | undefined;

  if (entry.isDirectory) {
    const rootPackageJsonPath = joinPlatformPath(entry.path, 'package.json');
    const rootPackageJson = await readTextFileIfExists(rootPackageJsonPath);
    if (rootPackageJson) {
      packageJsonPath = rootPackageJsonPath;
      manifest = parseJsoncObject<VsCodeExtensionManifest>(rootPackageJson, rootPackageJsonPath);
    } else {
      const extensionPackageJsonPath = joinPlatformPath(entry.path, 'extension', 'package.json');
      const extensionPackageJson = await readTextFileIfExists(extensionPackageJsonPath);
      if (!extensionPackageJson) {
        return null;
      }
      extensionRootPath = joinPlatformPath(entry.path, 'extension');
      packageJsonPath = extensionPackageJsonPath;
      manifest = parseJsoncObject<VsCodeExtensionManifest>(extensionPackageJson, extensionPackageJsonPath);
    }
  } else if (entryLooksLikeVsix(entry)) {
    sourceKind = 'vsix';
    const extractionResult = await commands.fsExtractArchive({
      archivePath: entry.path,
      mode: 'openCached',
      targetDirectory: null,
    }).then(unwrapTauriResult);
    cachedExtractionPath = extractionResult.outputPath;

    const extractedRootPackageJsonPath = joinPlatformPath(extractionResult.outputPath, 'package.json');
    const extractedRootPackageJson = await readTextFileIfExists(extractedRootPackageJsonPath);
    if (extractedRootPackageJson) {
      extensionRootPath = extractionResult.outputPath;
      packageJsonPath = extractedRootPackageJsonPath;
      manifest = parseJsoncObject<VsCodeExtensionManifest>(extractedRootPackageJson, extractedRootPackageJsonPath);
    } else {
      const extractedExtensionPackageJsonPath = joinPlatformPath(extractionResult.outputPath, 'extension', 'package.json');
      const extractedExtensionPackageJson = await readTextFileIfExists(extractedExtensionPackageJsonPath);
      if (!extractedExtensionPackageJson) {
        return null;
      }
      extensionRootPath = joinPlatformPath(extractionResult.outputPath, 'extension');
      packageJsonPath = extractedExtensionPackageJsonPath;
      manifest = parseJsoncObject<VsCodeExtensionManifest>(extractedExtensionPackageJson, extractedExtensionPackageJsonPath);
    }
  } else {
    return null;
  }

  const extensionName = asString(manifest?.displayName) || asString(manifest?.name) || entry.name;
  const extensionId = [
    asString(manifest?.publisher),
    asString(manifest?.name) || normalizeCompatibilityId(entry.name, 'vscode-extension'),
  ]
    .filter(Boolean)
    .join('.')
    || normalizeCompatibilityId(entry.name, 'vscode-extension');
  const versionLabel = asString(manifest?.version) || '1.0.0';

  return {
    originalPath: entry.path,
    sourceKind,
    cachedExtractionPath,
    extensionRootPath,
    packageJsonPath,
    manifest: manifest ?? {},
    extensionId,
    extensionName,
    extensionDescription: asString(manifest?.description) || undefined,
    versionLabel,
    versionNumber: parseSemverMajor(versionLabel),
  };
}

function resolveCompatibilitySourceInfo(
  extension: ResolvedVsCodeExtension,
  contributionId: string,
  contributionLabel: string,
): ManagedPackageSourceInfo {
  return {
    compatibility: 'vscode',
    source: extension.sourceKind,
    originalPath: extension.originalPath,
    resolvedRootPath: extension.extensionRootPath,
    cachedExtractionPath: extension.cachedExtractionPath,
    extensionId: extension.extensionId,
    contributionId,
    contributionLabel,
  };
}

async function resolveFileAsDataUrl(filePath: string): Promise<string> {
  const fileData = await commands.fsReadFileBase64(filePath).then(unwrapTauriResult);
  if (/^(?:data:|blob:|https?:)/i.test(fileData)) {
    return fileData;
  }
  return `data:${detectMimeType(filePath)};base64,${fileData}`;
}

function normalizeVsCodeFontSize(value: string | number | undefined, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const trimmed = asString(value);
  if (!trimmed) {
    return fallback;
  }
  if (trimmed.endsWith('%')) {
    const parsed = Number.parseFloat(trimmed.slice(0, -1));
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  if (trimmed.endsWith('px')) {
    const parsed = Number.parseFloat(trimmed.slice(0, -2));
    return Number.isFinite(parsed) ? (parsed / 16) * 100 : fallback;
  }
  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function decodeFontCharacter(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.replace(/\\u([0-9a-fA-F]{4})|\\([0-9a-fA-F]{4,6})/g, (_match, unicodeGroup, shortGroup) =>
    String.fromCodePoint(Number.parseInt(unicodeGroup ?? shortGroup, 16)),
  );
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildFontSvgDataUrl(args: {
  character: string;
  color: string;
  fontFace: LoadedVsCodeFontFace;
  size: number;
}): string {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">',
    '<defs>',
    '<style>',
    `@font-face{font-family:"GreebleVsCodeThemeFont";src:url("${args.fontFace.dataUrl}") format("${args.fontFace.format}");font-weight:${args.fontFace.weight};font-style:${args.fontFace.style};}`,
    'text{font-family:"GreebleVsCodeThemeFont";text-anchor:middle;dominant-baseline:central;}',
    '</style>',
    '</defs>',
    `<text x="50" y="52" font-size="${args.size}" fill="${escapeXml(args.color)}">${escapeXml(args.character)}</text>`,
    '</svg>',
  ].join('');
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

async function loadVsCodeFontFaces(
  extensionRootPath: string,
  themeDirectoryPath: string,
  themeDefinition: VsCodeIconThemeDefinition,
): Promise<Map<string, LoadedVsCodeFontFace>> {
  const fontFaceMap = new Map<string, LoadedVsCodeFontFace>();

  for (const fontDefinition of themeDefinition.fonts ?? []) {
    const fontId = asString(fontDefinition.id);
    const primarySource = Array.isArray(fontDefinition.src) ? fontDefinition.src[0] : undefined;
    const sourcePath = asString(primarySource?.path);
    if (!fontId || !sourcePath) {
      continue;
    }
    const resolvedFontPath = resolveRelativePath(themeDirectoryPath, sourcePath);
    const fontDataUrl = await resolveFileAsDataUrl(resolvedFontPath);
    const format = asString(primarySource?.format) || detectMimeType(resolvedFontPath, 'woff').replace(/^font\//, '');
    fontFaceMap.set(fontId, {
      id: fontId,
      dataUrl: fontDataUrl,
      format,
      weight: asString(fontDefinition.weight) || 'normal',
      style: asString(fontDefinition.style) || 'normal',
      size: normalizeVsCodeFontSize(fontDefinition.size, 100),
    });
  }

  return fontFaceMap;
}

async function buildVsCodeIconDefinitions(
  themeFilePath: string,
  themeDefinition: VsCodeIconThemeDefinition,
): Promise<{ iconDefinitions: Record<string, string>; warnings: string[] }> {
  const warnings: string[] = [];
  const themeDirectoryPath = getParentDirectoryPath(themeFilePath);
  const fontFaces = await loadVsCodeFontFaces(getParentDirectoryPath(themeFilePath), themeDirectoryPath, themeDefinition);
  const defaultFontFace = fontFaces.values().next().value as LoadedVsCodeFontFace | undefined;
  const iconDefinitions: Record<string, string> = {};

  for (const [iconId, definition] of Object.entries(themeDefinition.iconDefinitions ?? {})) {
    const iconPath = asString(definition.iconPath);
    if (iconPath) {
      try {
        const resolvedIconPath = resolveRelativePath(themeDirectoryPath, iconPath);
        iconDefinitions[iconId] = await resolveFileAsDataUrl(resolvedIconPath);
      } catch (error) {
        warnings.push(`${iconId}: ${String(error)}`);
      }
      continue;
    }

    const fontCharacter = asString(definition.fontCharacter);
    if (!fontCharacter) {
      warnings.push(`${iconId}: missing iconPath or fontCharacter`);
      continue;
    }

    const fontFace = fontFaces.get(asString(definition.fontId)) ?? defaultFontFace;
    if (!fontFace) {
      warnings.push(`${iconId}: missing declared font asset`);
      continue;
    }

    const decodedCharacter = decodeFontCharacter(fontCharacter);
    if (!decodedCharacter) {
      warnings.push(`${iconId}: invalid fontCharacter`);
      continue;
    }

    iconDefinitions[iconId] = buildFontSvgDataUrl({
      character: decodedCharacter,
      color: asString(definition.fontColor) || '#d4d4d4',
      fontFace,
      size: normalizeVsCodeFontSize(definition.fontSize, fontFace.size),
    });
  }

  return { iconDefinitions, warnings };
}

async function buildVsCodeIconThemeContribution(
  extension: ResolvedVsCodeExtension,
  contribution: VsCodeIconThemeContribution,
): Promise<LoadedVsCodeIconThemeContribution> {
  const contributionPath = asString(contribution.path);
  if (!contributionPath) {
    throw new Error('missing icon theme path');
  }

  const contributionId = normalizeCompatibilityId(
    asString(contribution.id) || asString(contribution.label) || contributionPath,
    'icon-theme',
  );
  const packageId = normalizeCompatibilityId(
    `vscode-${extension.extensionId}-${contributionId}`,
    'vscode-icon-theme',
  );
  const packageName = asString(contribution.label) || extension.extensionName;
  const themeFilePath = resolveRelativePath(extension.extensionRootPath, contributionPath);
  const themeDefinition = parseJsoncObject<VsCodeIconThemeDefinition>(
    await commands.fsReadTextFile(themeFilePath).then(unwrapTauriResult),
    themeFilePath,
  );
  const iconDefinitionResult = await buildVsCodeIconDefinitions(themeFilePath, themeDefinition);
  const resolvedIconTheme = mergeResolvedIconThemes(
    getBuiltInIconTheme(),
    resolveIconThemeManifest(
      {
        id: packageId,
        name: packageName,
        version: extension.versionNumber,
        description: extension.extensionDescription,
        file: themeDefinition.file,
        folder: themeDefinition.folder,
        folderExpanded: themeDefinition.folderExpanded,
        iconDefinitions: Object.fromEntries(
          Object.entries(iconDefinitionResult.iconDefinitions).map(([iconId, iconDataUrl]) => [iconId, iconDataUrl] as const),
        ) as OverlayIconThemeManifest['iconDefinitions'],
        fileExtensions: themeDefinition.fileExtensions,
        fileNames: themeDefinition.fileNames,
        folderNames: themeDefinition.folderNames,
        folderNamesExpanded: themeDefinition.folderNamesExpanded,
      },
      iconPath => iconPath,
    ),
  );

  return {
    id: packageId,
    name: packageName,
    version: extension.versionNumber,
    description: extension.extensionDescription,
    directoryPath: extension.originalPath,
    manifestPath: themeFilePath,
    warnings: iconDefinitionResult.warnings,
    iconTheme: resolvedIconTheme,
    sourceInfo: resolveCompatibilitySourceInfo(
      extension,
      contributionId,
      packageName,
    ),
  };
}

async function loadVsCodeIconThemeContributionsFromExtension(
  extension: ResolvedVsCodeExtension,
): Promise<VsCodeCompatibilityLoadResult<LoadedVsCodeIconThemeContribution>> {
  const iconThemeContributions = Array.isArray(extension.manifest.contributes?.iconThemes)
    ? extension.manifest.contributes?.iconThemes ?? []
    : [];
  if (iconThemeContributions.length === 0) {
    return { packages: [], warnings: [] };
  }

  const packages: LoadedVsCodeIconThemeContribution[] = [];
  const warnings: string[] = [];

  for (const contribution of iconThemeContributions) {
    try {
      packages.push(await buildVsCodeIconThemeContribution(extension, contribution));
    } catch (error) {
      const label = asString(contribution.label) || asString(contribution.id) || asString(contribution.path) || 'icon theme';
      warnings.push(`${label}: ${String(error)}`);
    }
  }

  return { packages, warnings };
}

export async function loadVsCodeIconThemeContributionsFromEntry(
  entry: FileSystemEntryLike,
): Promise<VsCodeCompatibilityLoadResult<LoadedVsCodeIconThemeContribution>> {
  const extension = await resolveVsCodeExtensionFromEntry(entry);
  if (!extension) {
    return { packages: [], warnings: [] };
  }
  return loadVsCodeIconThemeContributionsFromExtension(extension);
}

function mergeVsCodeColorThemeFiles(
  parentTheme: ResolvedVsCodeColorThemeFile,
  childTheme: ResolvedVsCodeColorThemeFile,
): ResolvedVsCodeColorThemeFile {
  return {
    type: childTheme.type || parentTheme.type,
    colors: {
      ...parentTheme.colors,
      ...childTheme.colors,
    },
    tokenColors: [
      ...parentTheme.tokenColors,
      ...childTheme.tokenColors,
    ],
  };
}

async function loadVsCodeColorThemeFile(
  filePath: string,
  visitedFiles = new Set<string>(),
): Promise<ResolvedVsCodeColorThemeFile> {
  const normalizedFilePath = normalizePath(filePath);
  if (visitedFiles.has(normalizedFilePath)) {
    throw new Error(`color theme include cycle detected at ${normalizedFilePath}`);
  }
  visitedFiles.add(normalizedFilePath);

  const source = parseJsoncObject<LooseRecord>(
    await commands.fsReadTextFile(filePath).then(unwrapTauriResult),
    filePath,
  );
  const includePath = asString(source.include);
  const childTheme: ResolvedVsCodeColorThemeFile = {
    type: asString(source.type) || undefined,
    colors: Object.fromEntries(
      Object.entries(asRecord(source.colors) ?? {})
        .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].trim().length > 0)
        .map(([key, value]) => [key.trim(), value.trim()] as const),
    ),
    tokenColors: Array.isArray(source.tokenColors) ? source.tokenColors : [],
  };

  if (!includePath) {
    return childTheme;
  }

  const parentTheme = await loadVsCodeColorThemeFile(
    resolveRelativePath(getParentDirectoryPath(filePath), includePath),
    visitedFiles,
  );
  return mergeVsCodeColorThemeFiles(parentTheme, childTheme);
}

function pickMappedColor(
  colors: Record<string, string>,
  sourceIds: readonly string[],
): string | undefined {
  for (const sourceId of sourceIds) {
    const value = asString(colors[sourceId]);
    if (value) {
      return value;
    }
  }
  return undefined;
}

function buildVsCodePalettePatch(colors: Record<string, string>): Partial<OverlayThemePalette> {
  return Object.fromEntries(
    VSCODE_TO_OVERLAY_PALETTE
      .map(mapping => {
        const value = pickMappedColor(colors, mapping.sourceIds);
        return value ? [mapping.target, value] as const : null;
      })
      .filter((entry): entry is readonly [keyof OverlayThemePalette, string] => Boolean(entry)),
  ) as Partial<OverlayThemePalette>;
}

function buildVsCodeCssVarPatch(
  colors: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    [...VSCODE_TO_WORKBENCH_CSS_VARS, ...VSCODE_TO_EXPLORER_CSS_VARS]
      .map(mapping => {
        const value = pickMappedColor(colors, mapping.sourceIds);
        return value ? [mapping.cssVar, value] as const : null;
      })
      .filter((entry): entry is readonly [string, string] => Boolean(entry)),
  );
}

function buildVsCodeXtermPatch(colors: Record<string, string>): Partial<OverlayXTermTheme> {
  return Object.fromEntries(
    VSCODE_TO_XTERM
      .map(mapping => {
        const value = pickMappedColor(colors, mapping.sourceIds);
        return value ? [mapping.target, value] as const : null;
      })
      .filter((entry): entry is readonly [keyof OverlayXTermTheme, string] => Boolean(entry)),
  ) as Partial<OverlayXTermTheme>;
}

function sanitizeMonacoTokenColor(value: string | undefined): string | undefined {
  const trimmed = asString(value);
  if (!trimmed) {
    return undefined;
  }
  const normalized = trimmed.replace(/^#/, '');
  return /^[0-9a-fA-F]{6,8}$/.test(normalized) ? normalized : undefined;
}

function normalizeVsCodeTokenScopes(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(entry => normalizeVsCodeTokenScopes(entry));
  }
  if (typeof value !== 'string') {
    return [''];
  }
  const scopes = value
    .split(',')
    .map(scope => scope.trim())
    .filter(Boolean);
  return scopes.length > 0 ? scopes : [''];
}

function buildVsCodeMonacoRules(tokenColors: unknown[]): OverlayMonacoThemeCompatibilityRule[] {
  const rules: OverlayMonacoThemeCompatibilityRule[] = [];

  for (const tokenColor of tokenColors) {
    const entry = asRecord(tokenColor);
    const settings = asRecord(entry?.settings);
    if (!settings) {
      continue;
    }

    const foreground = sanitizeMonacoTokenColor(asString(settings.foreground));
    const background = sanitizeMonacoTokenColor(asString(settings.background));
    const fontStyle = asString(settings.fontStyle) || undefined;
    if (!foreground && !background && !fontStyle) {
      continue;
    }

    for (const token of normalizeVsCodeTokenScopes(entry?.scope)) {
      rules.push({
        token,
        foreground,
        background,
        fontStyle,
      });
    }
  }

  return rules;
}

function deriveMonacoBaseTheme(
  themeType: string | undefined,
  contributionUiTheme: string,
): NonNullable<OverlayMonacoThemeCompatibility['baseTheme']> {
  const normalizedType = themeType?.toLowerCase();
  if (normalizedType === 'light' || /light/i.test(contributionUiTheme)) {
    return 'vs';
  }
  if (normalizedType === 'hc' || /high-contrast/i.test(contributionUiTheme)) {
    return 'hc-black';
  }
  return 'vs-dark';
}

function resolveVsCodeFallbackTheme(
  themeType: string | undefined,
  contributionUiTheme: string,
): OverlayThemeDefinition {
  const baseTheme = deriveMonacoBaseTheme(themeType, contributionUiTheme);
  return baseTheme === 'vs'
    ? DEFAULT_LIGHT_FALLBACK_THEME
    : DEFAULT_FALLBACK_THEME;
}

function buildVsCodeMonacoThemeCompatibility(
  colorTheme: ResolvedVsCodeColorThemeFile,
  contributionUiTheme: string,
): OverlayMonacoThemeCompatibility {
  return {
    baseTheme: deriveMonacoBaseTheme(colorTheme.type, contributionUiTheme),
    colors: colorTheme.colors,
    rules: buildVsCodeMonacoRules(colorTheme.tokenColors),
  };
}

async function buildVsCodeColorThemeContribution(
  extension: ResolvedVsCodeExtension,
  contribution: VsCodeColorThemeContribution,
  localIconThemeResult: VsCodeCompatibilityLoadResult<LoadedVsCodeIconThemeContribution>,
): Promise<LoadedVsCodeColorThemeContribution> {
  const contributionPath = asString(contribution.path);
  if (!contributionPath) {
    throw new Error('missing color theme path');
  }

  const contributionId = normalizeCompatibilityId(
    asString(contribution.id) || asString(contribution.label) || contributionPath,
    'color-theme',
  );
  const packageId = normalizeCompatibilityId(
    `vscode-${extension.extensionId}-${contributionId}`,
    'vscode-color-theme',
  );
  const packageName = asString(contribution.label) || extension.extensionName;
  const themeFilePath = resolveRelativePath(extension.extensionRootPath, contributionPath);
  const colorThemeFile = await loadVsCodeColorThemeFile(themeFilePath);
  const fallbackTheme = resolveVsCodeFallbackTheme(
    colorThemeFile.type,
    asString(contribution.uiTheme),
  );
  const palettePatch = buildVsCodePalettePatch(colorThemeFile.colors);
  const themeDefinition = normalizeThemeDefinition(
    {
      id: packageId,
      name: packageName,
      description: extension.extensionDescription,
      source: 'package',
      extendsThemeId: fallbackTheme.id,
      palette: palettePatch,
      xterm: buildVsCodeXtermPatch(colorThemeFile.colors),
      cssVars: buildVsCodeCssVarPatch(colorThemeFile.colors),
      assets: {
        manifestPath: themeFilePath,
        packageRoot: extension.extensionRootPath,
        monacoTheme: buildVsCodeMonacoThemeCompatibility(
          colorThemeFile,
          asString(contribution.uiTheme),
        ),
      },
    },
    fallbackTheme,
  );

  return {
    id: packageId,
    name: packageName,
    version: extension.versionNumber,
    description: extension.extensionDescription,
    directoryPath: extension.originalPath,
    manifestPath: themeFilePath,
    warnings: [...localIconThemeResult.warnings],
    theme: themeDefinition,
    localIconThemes: localIconThemeResult.packages,
    sourceInfo: resolveCompatibilitySourceInfo(
      extension,
      contributionId,
      packageName,
    ),
  };
}

export async function loadVsCodeColorThemeContributionsFromEntry(
  entry: FileSystemEntryLike,
): Promise<VsCodeCompatibilityLoadResult<LoadedVsCodeColorThemeContribution>> {
  const extension = await resolveVsCodeExtensionFromEntry(entry);
  if (!extension) {
    return { packages: [], warnings: [] };
  }

  const colorThemeContributions = Array.isArray(extension.manifest.contributes?.themes)
    ? extension.manifest.contributes?.themes ?? []
    : [];
  if (colorThemeContributions.length === 0) {
    return { packages: [], warnings: [] };
  }

  const localIconThemeResult = await loadVsCodeIconThemeContributionsFromExtension(extension);
  const packages: LoadedVsCodeColorThemeContribution[] = [];
  const warnings: string[] = [...localIconThemeResult.warnings];

  for (const contribution of colorThemeContributions) {
    try {
      packages.push(await buildVsCodeColorThemeContribution(
        extension,
        contribution,
        localIconThemeResult,
      ));
    } catch (error) {
      const label = asString(contribution.label) || asString(contribution.id) || asString(contribution.path) || 'color theme';
      warnings.push(`${label}: ${String(error)}`);
    }
  }

  return { packages, warnings };
}
