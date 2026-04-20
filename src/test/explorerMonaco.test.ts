import { describe, expect, it } from "vitest";
import {
  buildExplorerMonacoPreviewOptions,
  getExplorerTextPreviewMetrics,
} from "../config/explorerMonaco";
import { defaultSettings } from "../store/settingsStore";

describe("explorerMonaco", () => {
  it("builds a fast Monaco preview profile from editor settings", () => {
    const options = buildExplorerMonacoPreviewOptions({
      editorSettings: defaultSettings.editor,
      lineCount: 128,
      readOnly: false,
      allowFolding: true,
      topPadding: 10,
    });

    expect(options.fontFamily).toBe(defaultSettings.editor.fontFamily);
    expect(options.fontSize).toBe(defaultSettings.editor.fontSize);
    expect(options.wordWrap).toBe(defaultSettings.editor.wordWrap);
    expect(options.lineNumbers).toBe(defaultSettings.editor.lineNumbers);
    expect(options.minimap).toEqual({ enabled: false });
    expect(options.lineNumbersMinChars).toBe(4);
    expect(options.largeFileOptimizations).toBe(true);
    expect(options.quickSuggestions).toBe(false);
    expect(options.stickyScroll).toEqual({ enabled: false });
    expect(options.folding).toBe(true);
    expect(options.padding).toEqual({ top: 10, bottom: 8 });
  });

  it("measures text preview content once for the preview status strip", () => {
    expect(getExplorerTextPreviewMetrics("alpha beta\ngamma")).toEqual({
      characterCount: 16,
      wordCount: 3,
      lineCount: 2,
    });
    expect(getExplorerTextPreviewMetrics("")).toEqual({
      characterCount: 0,
      wordCount: 0,
      lineCount: 1,
    });
  });
});
