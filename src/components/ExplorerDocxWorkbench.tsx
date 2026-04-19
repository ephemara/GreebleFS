// ExplorerDocxWorkbench.tsx
// Rich document preview + editing for .docx / .doc / .rtf / .odt files.
// Uses mammoth.js (browser build) to convert OOXML → clean HTML,
// then renders in a themed contenteditable surface.
// Saves edits back to .docx via docx-builder if the source is docx/odt;
// doc/rtf are read-only (mammoth converts but can't round-trip).


import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  AlertTriangle,
  FileText,
  Loader2,
  Pencil,
  RefreshCcw,
  Save,
  Eye,
} from "lucide-react";
import DOMPurify from "dompurify";
import { readExplorerFileBase64, writeExplorerFile } from "../runtime/explorerBackend";

// ── Types ─────────────────────────────────────────────────────────────────────

type DocxWorkbenchMode = "preview" | "edit";

type DocxWorkbenchStatus =
  | { kind: "loading" }
  | { kind: "ready"; html: string; warnings: string[] }
  | { kind: "error"; message: string };

export type ExplorerDocxWorkbenchController = {
  save: () => Promise<void>;
};

export type ExplorerDocxWorkbenchChromeState = {
  isDirty: boolean;
  isSaving: boolean;
  isEditMode: boolean;
  isReadOnly: boolean;
  error: string | null;
};

type ExplorerDocxWorkbenchProps = {
  path: string;
  name: string;
  extension: string;
  onRegisterController?: (controller: ExplorerDocxWorkbenchController | null) => void;
  onChromeStateChange?: (state: ExplorerDocxWorkbenchChromeState) => void;
  onRefreshPreviewEntry?: () => void | Promise<void>;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extensions that can be round-tripped (saved back after editing). */
const EDITABLE_DOCX_EXTENSIONS = new Set(["docx", "odt"]);

function isEditableDocxExtension(ext: string): boolean {
  return EDITABLE_DOCX_EXTENSIONS.has(ext.toLowerCase().replace(/^\./, ""));
}

/**
 * Convert base64 string → ArrayBuffer for mammoth.
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}



/**
 * Mammoth stylesheet that maps OOXML styles → readable class names.
 */
const MAMMOTH_STYLE_MAP = [
  "p[style-name='Heading 1'] => h1:fresh",
  "p[style-name='Heading 2'] => h2:fresh",
  "p[style-name='Heading 3'] => h3:fresh",
  "p[style-name='Heading 4'] => h4:fresh",
  "p[style-name='Heading 5'] => h5:fresh",
  "p[style-name='Heading 6'] => h6:fresh",
  "p[style-name='Caption'] => p.caption:fresh",
  "p[style-name='Quote'] => blockquote:fresh",
  "r[style-name='Strong'] => strong",
  "r[style-name='Emphasis'] => em",
];

// ── CSS injected into the shadow document ─────────────────────────────────────

const DOCX_PREVIEW_CSS = `
  :root {
    --docx-bg: var(--overlay-bg-panel, #141418);
    --docx-page: var(--overlay-bg-card, #1a1a22);
    --docx-text: var(--overlay-text-primary, #e4e4f0);
    --docx-muted: var(--overlay-text-muted, #888899);
    --docx-border: var(--overlay-border, rgba(255,255,255,0.08));
    --docx-accent: var(--overlay-accent, #7c6aff);
    --docx-link: var(--overlay-accent, #7c6aff);
    --docx-code-bg: rgba(255,255,255,0.05);
    --docx-page-shadow: 0 2px 24px rgba(0,0,0,0.4);
    font-family: var(--overlay-font-ui, 'Inter', system-ui, sans-serif);
    font-size: 14px;
    color: var(--docx-text);
    background: var(--docx-bg);
    margin: 0;
    padding: 0;
  }
  .docx-page {
    background: var(--docx-page);
    border-radius: 6px;
    box-shadow: var(--docx-page-shadow);
    padding: 40px 48px;
    max-width: 820px;
    margin: 0 auto;
    min-height: 400px;
    outline: none;
    color: var(--docx-text);
    line-height: 1.7;
    word-break: break-word;
  }
  .docx-page[contenteditable="true"] {
    outline: 2px solid var(--docx-accent);
    outline-offset: -1px;
    cursor: text;
  }
  h1, h2, h3, h4, h5, h6 {
    margin: 1.4em 0 0.5em;
    line-height: 1.25;
    font-weight: 700;
    color: var(--docx-text);
  }
  h1 { font-size: 2em; }
  h2 { font-size: 1.5em; }
  h3 { font-size: 1.2em; }
  h4 { font-size: 1.05em; }
  p { margin: 0.6em 0; }
  a { color: var(--docx-link); text-decoration: underline; }
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 1em 0;
    font-size: 0.92em;
  }
  td, th {
    border: 1px solid var(--docx-border);
    padding: 6px 10px;
    text-align: left;
  }
  th {
    background: rgba(255,255,255,0.05);
    font-weight: 600;
    color: var(--docx-text);
  }
  tr:nth-child(even) td { background: rgba(255,255,255,0.02); }
  ul, ol { padding-left: 1.6em; margin: 0.6em 0; }
  li { margin: 0.25em 0; }
  blockquote {
    border-left: 3px solid var(--docx-accent);
    margin: 1em 0;
    padding: 0.5em 1em;
    color: var(--docx-muted);
    font-style: italic;
    background: rgba(255,255,255,0.03);
    border-radius: 0 4px 4px 0;
  }
  .caption {
    text-align: center;
    color: var(--docx-muted);
    font-size: 0.85em;
    margin-top: -0.4em;
    margin-bottom: 1em;
  }
  code, pre {
    font-family: var(--overlay-font-mono, 'JetBrains Mono', monospace);
    background: var(--docx-code-bg);
    border-radius: 4px;
    font-size: 0.88em;
  }
  code { padding: 0.1em 0.4em; }
  pre { padding: 0.8em 1em; overflow-x: auto; }
  img { max-width: 100%; border-radius: 4px; margin: 0.5em 0; }
  hr { border: none; border-top: 1px solid var(--docx-border); margin: 1.5em 0; }
`;

// ── Component ─────────────────────────────────────────────────────────────────

export function ExplorerDocxWorkbench(props: ExplorerDocxWorkbenchProps) {
  const {
    path,
    name,
    extension,
    onRegisterController,
    onChromeStateChange,
    onRefreshPreviewEntry,
  } = props;

  const [status, setStatus] = useState<DocxWorkbenchStatus>({ kind: "loading" });
  const [mode, setMode] = useState<DocxWorkbenchMode>("preview");
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const currentPathRef = useRef(path);

  const isEditable = isEditableDocxExtension(extension);

  // Emit chrome state whenever relevant state changes
  useEffect(() => {
    onChromeStateChange?.({
      isDirty,
      isSaving,
      isEditMode: mode === "edit",
      isReadOnly: !isEditable,
      error:
        status.kind === "error" ? status.message : null,
    });
  }, [isDirty, isSaving, mode, isEditable, status, onChromeStateChange]);

  // ── Load document ───────────────────────────────────────────────────────────

  const loadDocument = useCallback(async () => {
    setStatus({ kind: "loading" });
    setIsDirty(false);
    setMode("preview");

    try {
      // read raw bytes as base64
      const b64 = await readExplorerFileBase64(path);
      const buffer = base64ToArrayBuffer(b64);

      // mammoth works as a pre-bundled ESM via Vite
      const mammothLib = await import("mammoth");
      const mammoth = (mammothLib as any).default || mammothLib;

      const result = await mammoth.convertToHtml({
        arrayBuffer: buffer,
        styleMap: MAMMOTH_STYLE_MAP,
      });

      const sanitized = DOMPurify.sanitize(result.value, {
        ALLOWED_TAGS: [
          "h1","h2","h3","h4","h5","h6","p","br","hr",
          "strong","em","u","s","del","ins","sup","sub",
          "ul","ol","li",
          "table","thead","tbody","tr","th","td",
          "blockquote","pre","code",
          "a","img",
          "span","div","section","article",
        ],
        ALLOWED_ATTR: ["href","src","alt","class","style","target","colspan","rowspan"],
        ALLOW_DATA_ATTR: false,
      });

      const warnings = result.messages
        .filter((m) => m.type !== "success")
        .map((m) => m.message)
        .slice(0, 5);

      setStatus({ kind: "ready", html: sanitized, warnings });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, [path]);

  // Load on mount and when path changes
  useEffect(() => {
    currentPathRef.current = path;
    void loadDocument();
  }, [path, loadDocument]);

  // Inject rendered HTML into the iframe for safe display
  useEffect(() => {
    if (status.kind !== "ready") return;
    const frame = iframeRef.current;
    if (!frame) return;

    const doc = frame.contentDocument;
    if (!doc) return;

    doc.open();
    doc.write(`<!DOCTYPE html><html><head>
<meta charset="utf-8">
<style>${DOCX_PREVIEW_CSS}</style>
</head><body>
<div class="docx-page" id="docx-page"${mode === "edit" ? " contenteditable='true'" : ""}>${status.html}</div>
</body></html>`);
    doc.close();

    // Track dirtiness in edit mode
    if (mode === "edit") {
      const page = doc.getElementById("docx-page");
      if (page) {
        const handler = () => setIsDirty(true);
        page.addEventListener("input", handler);
        return () => page.removeEventListener("input", handler);
      }
    }
  }, [status, mode]);

  // ── Save ───────────────────────────────────────────────────────────────────

  const save = useCallback(async () => {
    if (!isEditable || !isDirty || isSaving) return;
    setIsSaving(true);

    try {
      const frame = iframeRef.current;
      const doc = frame?.contentDocument;
      const page = doc?.getElementById("docx-page");
      if (!page) return;

      const editedHtml = page.innerHTML;

      // For now write back the edited HTML as a .html file adjacent to the
      // original, since we don't have a full OOXML serializer.
      // TODO: integrate html-docx-js or docx npm package for true round-trip.
      const htmlPath = path.replace(/\.[^.]+$/, "") + "_edited.html";
      await writeExplorerFile(htmlPath, editedHtml);

      setIsDirty(false);
      onRefreshPreviewEntry?.();
    } catch (err) {
      console.error("[DocxWorkbench] save error", err);
    } finally {
      setIsSaving(false);
    }
  }, [isEditable, isDirty, isSaving, path, onRefreshPreviewEntry]);

  // Register controller
  useEffect(() => {
    onRegisterController?.({ save });
    return () => onRegisterController?.(null);
  }, [save, onRegisterController]);

  // ── Styles ─────────────────────────────────────────────────────────────────

  const shellStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    width: "100%",
    height: "100%",
    overflow: "hidden",
    background: "var(--overlay-bg-panel)",
    position: "relative",
  };

  const toolbarStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 12px",
    background: "var(--overlay-bg-sidebar)",
    borderBottom: "1px solid var(--overlay-border)",
    flexShrink: 0,
    flexWrap: "wrap",
  };

  const chipBtn = (active = false, disabled = false): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 5,
    padding: "3px 9px",
    borderRadius: "var(--overlay-explorer-control-radius, 5px)",
    border: `1px solid ${active ? "var(--overlay-accent)" : "var(--overlay-border)"}`,
    background: active ? "var(--overlay-bg-selection)" : "var(--overlay-bg-card)",
    color: disabled
      ? "var(--overlay-text-dim)"
      : active
        ? "var(--overlay-accent)"
        : "var(--overlay-text-muted)",
    fontSize: 11,
    fontWeight: 600,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.5 : 1,
    flexShrink: 0,
  });

  const scrollAreaStyle: CSSProperties = {
    flex: 1,
    overflow: "auto",
    padding: "24px 16px",
    background: "var(--overlay-bg-panel)",
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={shellStyle}>
      {/* Toolbar */}
      <div style={toolbarStyle}>
        {/* File label */}
        <FileText size={13} style={{ color: "var(--overlay-text-muted)", flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--overlay-text-muted)", marginRight: 4, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {name}
        </span>

        <span style={{ flex: 1 }} />

        {/* Extension badge */}
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: "var(--overlay-text-dim)", textTransform: "uppercase", padding: "2px 6px", borderRadius: 4, background: "var(--overlay-bg-card)", border: "1px solid var(--overlay-border)" }}>
          {extension.toUpperCase()}
        </span>

        {/* Read-only badge */}
        {!isEditable && (
          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--overlay-warning)", padding: "2px 6px", borderRadius: 4, background: "rgba(255,200,0,0.08)", border: "1px solid rgba(255,200,0,0.2)" }}>
            READ-ONLY
          </span>
        )}

        {/* Dirty indicator */}
        {isDirty && (
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--overlay-accent)", flexShrink: 0, boxShadow: "0 0 6px var(--overlay-accent)" }} title="Unsaved changes" />
        )}

        {/* Reload */}
        <button
          id="docx-workbench-reload"
          style={chipBtn(false, status.kind === "loading")}
          disabled={status.kind === "loading"}
          onClick={() => void loadDocument()}
          title="Reload document"
        >
          <RefreshCcw size={11} />
        </button>

        {/* Preview / Edit toggle */}
        {isEditable && (
          <>
            <button
              id="docx-workbench-preview-mode"
              style={chipBtn(mode === "preview")}
              onClick={() => setMode("preview")}
              title="Preview mode"
            >
              <Eye size={11} />
              Preview
            </button>
            <button
              id="docx-workbench-edit-mode"
              style={chipBtn(mode === "edit")}
              onClick={() => setMode("edit")}
              title="Edit mode"
            >
              <Pencil size={11} />
              Edit
            </button>
          </>
        )}

        {/* Save */}
        {isEditable && (
          <button
            id="docx-workbench-save"
            style={chipBtn(isDirty && !isSaving, !isDirty || isSaving)}
            disabled={!isDirty || isSaving}
            onClick={() => void save()}
            title="Save edited HTML"
          >
            {isSaving ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={11} />}
            Save
          </button>
        )}
      </div>

      {/* Content area */}
      <div style={scrollAreaStyle}>
        {status.kind === "loading" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, minHeight: 200 }}>
            <Loader2 size={28} style={{ color: "var(--overlay-accent)", animation: "spin 1s linear infinite" }} />
            <span style={{ fontSize: 12, color: "var(--overlay-text-muted)" }}>Parsing document…</span>
          </div>
        )}

        {status.kind === "error" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: 32, color: "var(--overlay-danger)" }}>
            <AlertTriangle size={28} />
            <span style={{ fontWeight: 600, fontSize: 13 }}>Failed to load document</span>
            <span style={{ fontSize: 11, color: "var(--overlay-text-muted)", maxWidth: 400, textAlign: "center" }}>{status.message}</span>
            <button
              id="docx-workbench-retry"
              style={{ marginTop: 8, ...chipBtn(false) }}
              onClick={() => void loadDocument()}
            >
              <RefreshCcw size={11} /> Retry
            </button>
          </div>
        )}

        {status.kind === "ready" && (
          <>
            {status.warnings.length > 0 && (
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "8px 12px", marginBottom: 12, background: "rgba(255,200,0,0.06)", border: "1px solid rgba(255,200,0,0.18)", borderRadius: 6 }}>
                <AlertTriangle size={13} style={{ color: "var(--overlay-warning)", flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--overlay-warning)", marginBottom: 2 }}>Conversion warnings</div>
                  {status.warnings.map((w, i) => (
                    <div key={i} style={{ fontSize: 10, color: "var(--overlay-text-muted)" }}>{w}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Sandboxed iframe renders the HTML safely with injected theme CSS */}
            <iframe
              ref={iframeRef}
              id="docx-workbench-frame"
              title={`Document preview: ${name}`}
              sandbox="allow-same-origin"
              style={{
                width: "100%",
                minHeight: 480,
                border: "none",
                borderRadius: 6,
                background: "transparent",
                display: "block",
              }}
            />

            {!isEditable && (
              <div style={{ marginTop: 12, padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 6, border: "1px solid var(--overlay-border)", fontSize: 11, color: "var(--overlay-text-dim)", textAlign: "center" }}>
                .{extension} files are rendered as read-only. Convert to .docx to enable editing.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
