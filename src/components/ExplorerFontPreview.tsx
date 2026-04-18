import { useEffect, useState, useMemo } from "react";
import { Loader, Type } from "lucide-react";
import { commands } from "../runtime/tauriClient";

const PANGRAMS = [
  "The quick brown fox jumps over the lazy dog.",
  "Pack my box with five dozen liquor jugs.",
  "How vexingly quick daft zebras jump!",
  "Sphinx of black quartz, judge my vow.",
];

export interface ExplorerFontPreviewProps {
  fontPath: string;
  fontName: string;
  fontSource: string;
  fontExtension: string;
}

export function ExplorerFontPreview({
  fontPath,
  fontName,
  fontSource,
  fontExtension,
}: ExplorerFontPreviewProps) {
  const [fontLoaded, setFontLoaded] = useState(false);
  const [fontError, setFontError] = useState(false);
  const [testText, setTestText] = useState(PANGRAMS[0]);
  const [fontSize, setFontSize] = useState(32);

  // Derive a reliable font-family identifier from the file path
  const fontFamilyId = useMemo(
    () => `PreviewFont_${fontPath.replace(/[^a-zA-Z0-9]/g, "")}`,
    [fontPath]
  );

  useEffect(() => {
    let active = true;
    let loadedFontFace: FontFace | null = null;
    setFontLoaded(false);
    setFontError(false);

    const canUseBrowserFontApi =
      typeof window !== "undefined" &&
      typeof FontFace === "function" &&
      typeof document !== "undefined" &&
      "fonts" in document &&
      typeof document.fonts?.add === "function";

    if (!canUseBrowserFontApi) {
      setFontError(true);
      return () => {
        active = false;
      };
    }

    const loadFont = async () => {
      try {
        const result = await commands.fsReadFileBase64(fontPath);
        if (!active) return;
        
        let base64Data: string;
        if (result.status === "ok") {
          base64Data = result.data;
        } else {
          throw new Error(result.error);
        }

        const dataUrl = `data:font/${fontExtension};base64,${base64Data}`;
        const fontFace = new FontFace(fontFamilyId, `url("${dataUrl}")`);
        
        const resolvedFontFace = await fontFace.load();
        if (!active) return;

        document.fonts.add(resolvedFontFace);
        loadedFontFace = resolvedFontFace;
        setFontLoaded(true);
      } catch (error) {
        console.error("Failed to load font preview via base64:", error);
        if (active) {
          setFontError(true);
        }
      }
    };

    void loadFont();

    return () => {
      active = false;
      if (loadedFontFace && typeof document.fonts?.delete === "function") {
        document.fonts.delete(loadedFontFace);
      }
    };
  }, [fontFamilyId, fontSource]);

  if (fontError) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "grid",
          placeItems: "center",
          background: "var(--overlay-explorer-preview-bg)",
          color: "var(--overlay-danger, #f87171)",
          fontSize: 12,
          textAlign: "center",
          padding: 24,
        }}
      >
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontWeight: 700 }}>Failed to load font preview</div>
          <div style={{ color: "var(--overlay-text-dim)", fontSize: 11 }}>{fontName}</div>
        </div>
      </div>
    );
  }

  if (!fontLoaded) {
    return (
      <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", background: "var(--overlay-explorer-preview-bg)" }}>
        <Loader size={18} style={{ animation: "spin 1s linear infinite", color: "var(--overlay-text-muted)" }} />
      </div>
    );
  }

  const alphabetUpper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const alphabetLower = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*()_+-=[]{}|;:'\",.<>/?`~";

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--overlay-explorer-preview-bg)",
        color: "var(--overlay-text-primary, #e2e2f0)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "24px 24px 16px 24px",
          borderBottom: "1px solid var(--overlay-explorer-preview-border)",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          background: "var(--overlay-bg-card)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "var(--overlay-explorer-control-radius)",
              background: "var(--overlay-explorer-chip-bg)",
              border: "1px solid var(--overlay-explorer-chip-border)",
              display: "grid",
              placeItems: "center",
              color: "var(--overlay-accent)",
            }}
          >
            <Type size={16} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--overlay-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {fontName}
            </div>
            <div style={{ fontSize: 11, color: "var(--overlay-text-dim)", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 2 }}>
              {fontExtension} Font File
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "var(--overlay-text-muted)", fontWeight: 600 }}>SIZE</span>
          <input
            type="range"
            min={12}
            max={120}
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            style={{ flex: 1, cursor: "pointer", accentColor: "var(--overlay-accent)" }}
          />
          <span style={{ fontSize: 11, color: "var(--overlay-text-primary)", width: 24, textAlign: "right" }}>{fontSize}px</span>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 32,
          fontFamily: `"${fontFamilyId}", sans-serif`,
        }}
      >
        <div>
          <div style={{ fontFamily: "sans-serif", fontSize: 10, color: "var(--overlay-text-muted)", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 16, textTransform: "uppercase" }}>
            Interactive Preview
          </div>
          <textarea
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            style={{
              width: "100%",
              minHeight: 140,
              background: "transparent",
              border: "none",
              color: "var(--overlay-text-primary)",
              fontSize: `${fontSize}px`,
              fontFamily: "inherit",
              resize: "none",
              outline: "none",
              lineHeight: 1.4,
              padding: 0,
            }}
            placeholder="Type here to test the font..."
          />
        </div>

        <div style={{ display: "grid", gap: 24 }}>
          <div>
            <div style={{ fontFamily: "sans-serif", fontSize: 10, color: "var(--overlay-text-muted)", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 8, textTransform: "uppercase" }}>
              Uppercase
            </div>
            <div style={{ fontSize: 24, color: "var(--overlay-text-primary)", wordBreak: "break-all", lineHeight: 1.6, letterSpacing: "0.02em" }}>
              {alphabetUpper}
            </div>
          </div>
          <div>
            <div style={{ fontFamily: "sans-serif", fontSize: 10, color: "var(--overlay-text-muted)", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 8, textTransform: "uppercase" }}>
              Lowercase
            </div>
            <div style={{ fontSize: 24, color: "var(--overlay-text-primary)", wordBreak: "break-all", lineHeight: 1.6, letterSpacing: "0.02em" }}>
              {alphabetLower}
            </div>
          </div>
          <div>
            <div style={{ fontFamily: "sans-serif", fontSize: 10, color: "var(--overlay-text-muted)", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 8, textTransform: "uppercase" }}>
              Numbers & Symbols
            </div>
            <div style={{ fontSize: 24, color: "var(--overlay-text-primary)", wordBreak: "break-all", lineHeight: 1.6, letterSpacing: "0.05em" }}>
              {numbers} {symbols}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
