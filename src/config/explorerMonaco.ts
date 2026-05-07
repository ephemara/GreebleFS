import type { EditorProps } from "@monaco-editor/react";
import type { EditorSettings } from "../store/settingsStore";
import type {
  OverlayMonacoThemeCompatibility,
  OverlayMonacoThemeCompatibilityRule,
  ResolvedOverlayAppearance,
} from "./appearance";
import {
  normalizeMonacoLiteralColor,
  parseOverlayColor,
} from "./colorUtils";

export type ExplorerMonacoEditorOptions = NonNullable<EditorProps["options"]>;

type ExplorerMonacoThemeDescriptor = {
  id: string;
  base: "vs" | "vs-dark" | "hc-black";
  colors: Record<string, string>;
  rules: OverlayMonacoThemeCompatibilityRule[];
};

export type ExplorerTextPreviewMetrics = {
  characterCount: number;
  wordCount: number;
  lineCount: number;
};

type BuildExplorerMonacoPreviewOptionsArgs = {
  editorSettings: EditorSettings;
  lineCount: number;
  readOnly: boolean;
  allowFolding?: boolean;
  topPadding?: number;
};

const EXPLORER_MONACO_SCROLLBAR_OPTIONS = {
  vertical: "visible",
  horizontal: "visible",
  verticalScrollbarSize: 10,
  horizontalScrollbarSize: 10,
  useShadows: false,
  alwaysConsumeMouseWheel: false,
} as const satisfies NonNullable<ExplorerMonacoEditorOptions["scrollbar"]>;

const EXPLORER_MONACO_FAST_PATH_OPTIONS = {
  automaticLayout: true,
  scrollBeyondLastLine: false,
  scrollBeyondLastColumn: 0,
  minimap: { enabled: false },
  overviewRulerLanes: 0,
  overviewRulerBorder: false,
  hideCursorInOverviewRuler: true,
  lineDecorationsWidth: 12,
  renderWhitespace: "selection",
  renderValidationDecorations: "off",
  renderLineHighlight: "line",
  selectionHighlight: false,
  selectionHighlightMultiline: false,
  occurrencesHighlight: "off",
  occurrencesHighlightDelay: 0,
  scrollbar: EXPLORER_MONACO_SCROLLBAR_OPTIONS,
  mouseWheelZoom: false,
  smoothScrolling: false,
  cursorSmoothCaretAnimation: "off",
  stickyScroll: { enabled: false },
  hover: { enabled: false },
  links: false,
  codeLens: false,
  colorDecorators: false,
  quickSuggestions: false,
  quickSuggestionsDelay: 0,
  parameterHints: { enabled: false },
  suggestOnTriggerCharacters: false,
  acceptSuggestionOnEnter: "off",
  snippetSuggestions: "none",
  tabCompletion: "off",
  wordBasedSuggestions: "off",
  inlineSuggest: { enabled: false },
  inlayHints: { enabled: "off" },
  guides: {
    bracketPairs: false,
    bracketPairsHorizontal: false,
    highlightActiveBracketPair: false,
    indentation: false,
    highlightActiveIndentation: false,
  },
  bracketPairColorization: { enabled: false },
  unicodeHighlight: {
    ambiguousCharacters: false,
    invisibleCharacters: false,
    nonBasicASCII: false,
    includeComments: false,
    includeStrings: false,
  },
  dropIntoEditor: { enabled: false },
  copyWithSyntaxHighlighting: false,
  dragAndDrop: false,
  formatOnType: false,
  formatOnPaste: false,
  largeFileOptimizations: true,
  maxTokenizationLineLength: 20_000,
  stopRenderingLineAfter: 20_000,
  fixedOverflowWidgets: true,
  allowOverflow: false,
  wrappingIndent: "same",
} as const satisfies ExplorerMonacoEditorOptions;

function normalizeMonacoColorValue(color: string | undefined): string | undefined {
  return normalizeMonacoLiteralColor(color);
}

function resolveMonacoLiteralColor(...candidates: Array<string | undefined>): string | undefined {
  for (const candidate of candidates) {
    const normalized = normalizeMonacoColorValue(candidate);
    if (typeof normalized === "string" && /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(normalized)) {
      return normalized;
    }
  }
  return undefined;
}

function normalizeMonacoThemeColors(
  colors: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(colors).map(([key, value]) => [key, normalizeMonacoColorValue(value) ?? value]),
  );
}

function normalizeExplorerMonacoThemeIdFragment(themeId: string | undefined): string {
  const normalized = String(themeId ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'default';
}

function isLightAppearance(appearance: ResolvedOverlayAppearance): boolean {
  const color = parseOverlayColor(appearance.theme.palette.appBackground)
    ?? parseOverlayColor(appearance.theme.palette.panelBackground);
  if (!color) {
    return false;
  }
  const luminance = (0.299 * color.red + 0.587 * color.green + 0.114 * color.blue) / 255;
  return luminance >= 0.62;
}

function normalizeMonacoThemeRules(
  rules: OverlayMonacoThemeCompatibility["rules"],
): OverlayMonacoThemeCompatibilityRule[] {
  return (rules ?? [])
    .filter(rule => typeof rule?.token === "string")
    .map(rule => ({
      token: rule.token,
      foreground: rule.foreground,
      background: rule.background,
      fontStyle: rule.fontStyle,
    }));
}

export function resolveExplorerMonacoThemeId(
  appearance?: ResolvedOverlayAppearance | null,
): string {
  if (!appearance) {
    return "greeblefs-monaco-default";
  }
  return `greeblefs-monaco-${normalizeExplorerMonacoThemeIdFragment(appearance.theme.id)}`;
}

export function buildExplorerMonacoThemeDescriptor(
  appearance?: ResolvedOverlayAppearance | null,
): ExplorerMonacoThemeDescriptor {
  const compatibilityTheme = appearance?.theme.assets?.monacoTheme;
  const scrollbarTheme = appearance?.theme.scrollbar;
  const scrollbarThumbColor = resolveMonacoLiteralColor(
    scrollbarTheme?.thumb,
    appearance?.cssVars["--overlay-scrollbar-thumb"],
  );
  const scrollbarThumbHoverColor = resolveMonacoLiteralColor(
    scrollbarTheme?.thumbHover,
    appearance?.cssVars["--overlay-scrollbar-thumb-hover"],
  );
  const base = compatibilityTheme?.baseTheme
    ?? (appearance && isLightAppearance(appearance) ? "vs" : "vs-dark");
  const colors = normalizeMonacoThemeColors({
    "editor.background": appearance?.cssVars["--overlay-explorer-code-bg"]
      ?? appearance?.theme.palette.panelBackground
      ?? "#0f131a",
    "editor.foreground": appearance?.theme.palette.textPrimary ?? "#e5e7eb",
    "editorLineNumber.foreground": appearance?.theme.palette.textDim ?? "#7c8697",
    "editorLineNumber.activeForeground": appearance?.theme.palette.textPrimary ?? "#e5e7eb",
    "editorCursor.foreground": appearance?.theme.palette.accent ?? "#8ab4ff",
    "editor.selectionBackground": appearance?.theme.palette.selectionBackground ?? "rgba(138,180,255,0.18)",
    "editor.lineHighlightBackground": appearance?.theme.palette.cardHoverBackground ?? "rgba(255,255,255,0.04)",
    "editorWhitespace.foreground": appearance?.theme.palette.textDim ?? "#5b6472",
    "editorIndentGuide.background": appearance?.theme.palette.border ?? "#2f3a4a",
    "editorIndentGuide.activeBackground": appearance?.theme.palette.borderStrong ?? "#46566f",
    "editorWidget.background": appearance?.theme.palette.cardBackground ?? "#141922",
    "editorWidget.border": appearance?.theme.palette.borderStrong ?? "#46566f",
    "scrollbarSlider.background": scrollbarThumbColor
      ?? appearance?.theme.palette.border
      ?? "#394456",
    "scrollbarSlider.hoverBackground": scrollbarThumbHoverColor
      ?? appearance?.theme.palette.borderStrong
      ?? "#516178",
    "scrollbarSlider.activeBackground": scrollbarThumbHoverColor
      ?? appearance?.theme.palette.accentSoft
      ?? "#6d86aa",
    "diffEditor.insertedTextBackground": appearance?.theme.palette.success ?? "#3fb95044",
    "diffEditor.removedTextBackground": appearance?.theme.palette.danger ?? "#ff7b7244",
    ...(compatibilityTheme?.colors ?? {}),
  });

  return {
    id: resolveExplorerMonacoThemeId(appearance),
    base,
    colors,
    rules: normalizeMonacoThemeRules(compatibilityTheme?.rules),
  };
}

export function applyExplorerMonacoTheme(
  monaco: {
    editor?: {
      defineTheme?: (themeName: string, data: {
        base: "vs" | "vs-dark" | "hc-black";
        inherit: boolean;
        colors: Record<string, string>;
        rules: OverlayMonacoThemeCompatibilityRule[];
      }) => void;
      setTheme?: (themeName: string) => void;
    };
  } | null | undefined,
  appearance?: ResolvedOverlayAppearance | null,
): string {
  const descriptor = buildExplorerMonacoThemeDescriptor(appearance);
  monaco?.editor?.defineTheme?.(descriptor.id, {
    base: descriptor.base,
    inherit: true,
    colors: descriptor.colors,
    rules: descriptor.rules,
  });
  monaco?.editor?.setTheme?.(descriptor.id);
  return descriptor.id;
}

function getExplorerMonacoLineNumberMinChars(lineCount: number): number {
  const normalizedLineCount = Math.max(1, Math.trunc(lineCount));
  return Math.max(4, String(normalizedLineCount).length + 1);
}

export function buildExplorerMonacoPreviewOptions({
  editorSettings,
  lineCount,
  readOnly,
  allowFolding = false,
  topPadding = 8,
}: BuildExplorerMonacoPreviewOptionsArgs): ExplorerMonacoEditorOptions {
  return {
    ...EXPLORER_MONACO_FAST_PATH_OPTIONS,
    readOnly,
    domReadOnly: readOnly,
    fontFamily: editorSettings.fontFamily,
    fontSize: editorSettings.fontSize,
    lineHeight: Math.max(
      editorSettings.fontSize + 4,
      Math.round(editorSettings.fontSize * 1.55),
    ),
    tabSize: editorSettings.tabSize,
    wordWrap: editorSettings.wordWrap,
    lineNumbers: editorSettings.lineNumbers,
    lineNumbersMinChars: getExplorerMonacoLineNumberMinChars(lineCount),
    cursorBlinking: editorSettings.cursorBlinking,
    cursorStyle: editorSettings.cursorStyle,
    padding: { top: topPadding, bottom: 8 },
    folding: allowFolding,
    foldingHighlight: allowFolding,
  };
}

export function getExplorerTextPreviewMetrics(
  content: string,
): ExplorerTextPreviewMetrics {
  const normalizedContent = content ?? "";
  const characterCount = normalizedContent.length;
  if (characterCount === 0) {
    return {
      characterCount: 0,
      wordCount: 0,
      lineCount: 1,
    };
  }

  let wordCount = 0;
  let lineCount = 1;
  let insideWord = false;

  for (let index = 0; index < characterCount; index += 1) {
    const character = normalizedContent[index];
    const isWhitespace =
      character === " " ||
      character === "\n" ||
      character === "\r" ||
      character === "\t" ||
      character === "\f" ||
      character === "\v";

    if (character === "\n") {
      lineCount += 1;
    }

    if (isWhitespace) {
      insideWord = false;
      continue;
    }

    if (!insideWord) {
      wordCount += 1;
      insideWord = true;
    }
  }

  return {
    characterCount,
    wordCount,
    lineCount,
  };
}
