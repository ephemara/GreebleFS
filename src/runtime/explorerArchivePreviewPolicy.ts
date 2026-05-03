export type ExplorerArchivePreviewKind = string;

const STREAM_CAPABLE_ARCHIVE_PREVIEW_KINDS = new Set<ExplorerArchivePreviewKind>([
  "docx",
  "image",
  "model3d",
  "script",
  "spreadsheet",
  "text",
]);

export function shouldMaterializeArchiveEntryForPreviewKind(
  kind: ExplorerArchivePreviewKind,
): boolean {
  return !STREAM_CAPABLE_ARCHIVE_PREVIEW_KINDS.has(kind);
}
