import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildExplorerMonacoThemeDescriptor,
  buildExplorerMonacoPreviewOptions,
  getExplorerTextPreviewMetrics,
  resolveExplorerMonacoThemeId,
} from "../config/explorerMonaco";
import { normalizeThemeDefinition, resolveOverlayAppearance } from "../config/appearance";
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

  it("derives Monaco theme colors and token rules from the active compatibility theme", () => {
    const compatibilityTheme = normalizeThemeDefinition({
      id: "vscode-import",
      name: "VS Code Import",
      extendsThemeId: "pilot-dark",
      palette: {
        panelBackground: "#272822",
        textPrimary: "#f8f8f2",
        accent: "#e6db74",
      },
      cssVars: {
        "--overlay-explorer-code-bg": "#272822",
      },
      assets: {
        monacoTheme: {
          baseTheme: "vs-dark",
          colors: {
            "editor.background": "#272822",
            "editor.foreground": "#f8f8f2",
          },
          rules: [
            { token: "comment", foreground: "88846f" },
            { token: "keyword", foreground: "F92672" },
          ],
        },
      },
    });
    const appearance = resolveOverlayAppearance({
      activeThemeId: "vscode-import",
      packageThemes: [compatibilityTheme],
    });

    const descriptor = buildExplorerMonacoThemeDescriptor(appearance);

    expect(descriptor.id).toBe("greeblefs-monaco-vscode-import");
    expect(descriptor.base).toBe("vs-dark");
    expect(descriptor.colors["editor.background"]).toBe("#272822");
    expect(descriptor.colors["editor.foreground"]).toBe("#f8f8f2");
    expect(descriptor.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({ token: "comment", foreground: "88846f" }),
      expect.objectContaining({ token: "keyword", foreground: "F92672" }),
    ]));
  });

  it("normalizes built-in Monaco UI colors away from raw rgba values", () => {
    const appearance = resolveOverlayAppearance({
      activeThemeId: "monokai",
      panelTransparency: 0.35,
    });

    const descriptor = buildExplorerMonacoThemeDescriptor(appearance);

    expect(descriptor.colors["editorLineNumber.foreground"]).toMatch(/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/);
    expect(descriptor.colors["scrollbarSlider.activeBackground"]).toMatch(/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/);
    expect(descriptor.colors["editor.selectionBackground"]).toMatch(/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/);
  });

  it("sanitizes scoped or punctuated theme ids into Monaco-safe names", () => {
    const scopedTheme = normalizeThemeDefinition({
      id: "doors:txt-preview@lane",
      name: "Doors Scoped",
      extendsThemeId: "github-dark",
    });
    const appearance = resolveOverlayAppearance({
      activeThemeId: scopedTheme.id,
      packageThemes: [scopedTheme],
    });

    expect(resolveExplorerMonacoThemeId(appearance)).toBe("greeblefs-monaco-doors-txt-preview-lane");
  });

  it("keeps Monaco surfaces off the hardcoded vs-dark path", () => {
    const fileExplorerSource = readFileSync(resolve(process.cwd(), "src/components/FileExplorer.tsx"), "utf8");
    const gitManagerSource = readFileSync(resolve(process.cwd(), "src/components/GitManager.tsx"), "utf8");
    const shaderWorkbenchSource = readFileSync(resolve(process.cwd(), "src/components/ExplorerShaderWorkbench.tsx"), "utf8");

    expect(fileExplorerSource).not.toContain('theme="vs-dark"');
    expect(gitManagerSource).not.toContain('theme="vs-dark"');
    expect(shaderWorkbenchSource).not.toContain('theme="vs-dark"');
  });
});
