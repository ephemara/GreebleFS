import type { EditorProps } from "@monaco-editor/react";
import type { EditorSettings } from "../store/settingsStore";

export type ExplorerMonacoEditorOptions = NonNullable<EditorProps["options"]>;

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
