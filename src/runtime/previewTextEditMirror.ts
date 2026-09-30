/**
 * previewTextEditMirror — keystroke-fast staging for the Monaco text preview.
 *
 * Root cause of the "cursor can't follow text" glitch: every keystroke used
 * to flow `onChange -> setPreview(content) -> full FileExplorer re-render ->
 * controlled value={content} push -> localStorage draft write`, plus a
 * debounced disk save that re-rendered twice more. The controlled push
 * (full-model executeEdits + pushUndoStop per keystroke) fought Monaco's
 * native cursor, and the render storm made it visibly lag.
 *
 * New contract: Monaco owns the text (uncontrolled `defaultValue`, remount
 * only when the underlying file revision changes). Keystrokes land here —
 * a single-entry ref mirror keyed by path — and React state only flips the
 * `isDirty` edge. Save/flush/close read the mirror, so nothing is lost.
 * State `content` converges to the last-saved snapshot on each save.
 */

export interface PreviewTextMirrorEntry {
  path: string;
  content: string;
}

export interface PreviewTextEditMirror {
  /** Stage freshly typed content (hot path — must stay allocation-light). */
  stage: (path: string, content: string) => void;
  /** Latest content: staged typing wins, otherwise the saved fallback. */
  read: (path: string, fallback: string) => string;
  /** True when unsaved typing is staged for this path. */
  hasPending: (path: string) => boolean;
  /** Drop staged typing (after a clean save, or a fresh disk load). */
  discard: (path?: string) => void;
  /** Peek at the raw entry (draft persistence, debugging). */
  peek: () => PreviewTextMirrorEntry | null;
}

export function createPreviewTextEditMirror(): PreviewTextEditMirror {
  let entry: PreviewTextMirrorEntry | null = null;
  return {
    stage: (path, content) => {
      entry = { path, content };
    },
    read: (path, fallback) =>
      entry != null && entry.path === path ? entry.content : fallback,
    hasPending: (path) => entry != null && entry.path === path,
    discard: (path) => {
      if (path == null || entry?.path === path) {
        entry = null;
      }
    },
    peek: () => entry,
  };
}

/** Monotonic revision so editor remount keys stay unique per disk load. */
let previewTextContentRevisionCounter = 0;

export function nextPreviewTextContentRevision(): number {
  previewTextContentRevisionCounter += 1;
  return previewTextContentRevisionCounter;
}

/** Remount key: stable while typing/saving, fresh when disk content lands. */
export function buildPreviewTextEditorKey(
  path: string,
  contentRevision: number,
): string {
  return `${path}::r${contentRevision}`;
}
