import type { CSSProperties } from "react";

import {
  getFolderIconSrc,
  type FolderIconRule,
  type FolderIconValue,
} from "../config/folderIcons";
import {
  getBuiltInIconTheme,
  resolveFileIconSrc,
  type OverlayResolvedIconTheme,
} from "../config/iconTheme";
import type { ExplorerFileEntry } from "../runtime/explorerBackend";

export interface ExplorerPreviewFolderIconConfig {
  folderIconRules?: readonly FolderIconRule[];
  defaultFolderIcon?: FolderIconValue;
  iconTheme?: OverlayResolvedIconTheme;
}

export interface ExplorerArchivePreviewEntryMetadata {
  originalPath: string;
  normalizedPath: string;
  name: string;
  parentPath: string;
  isDirectory: boolean;
}

function getEffectiveIconTheme(
  iconTheme?: OverlayResolvedIconTheme,
): OverlayResolvedIconTheme {
  return iconTheme ?? getBuiltInIconTheme();
}

function getExplorerEntryExtension(
  entry: Pick<ExplorerFileEntry, "is_dir" | "name" | "extension">,
): string {
  if (entry.is_dir) {
    return "";
  }

  const normalizedExtension = entry.extension?.trim().replace(/^\./, "").toLowerCase();
  if (normalizedExtension) {
    return normalizedExtension;
  }

  const lastDotIndex = entry.name.lastIndexOf(".");
  if (lastDotIndex <= 0 || lastDotIndex === entry.name.length - 1) {
    return "";
  }

  return entry.name.slice(lastDotIndex + 1).toLowerCase();
}

function getArchiveEntryExtension(entryName: string): string {
  const lastDotIndex = entryName.lastIndexOf(".");
  if (lastDotIndex <= 0 || lastDotIndex === entryName.length - 1) {
    return "";
  }

  return entryName.slice(lastDotIndex + 1).toLowerCase();
}

function trimArchivePath(path: string): string {
  return path.replace(/[/\\]+$/, "");
}

export function resolveExplorerPreviewFolderIconSrc(
  folderPath: string,
  open = false,
  options: ExplorerPreviewFolderIconConfig = {},
): string {
  const iconTheme = getEffectiveIconTheme(options.iconTheme);
  return getFolderIconSrc(folderPath, open, {
    rules: options.folderIconRules,
    defaultIcon: options.defaultFolderIcon,
    iconTheme,
  });
}

export function resolveExplorerPreviewEntryIconSrc(
  entry: Pick<ExplorerFileEntry, "path" | "is_dir" | "name" | "extension">,
  options: ExplorerPreviewFolderIconConfig = {},
): string {
  const iconTheme = getEffectiveIconTheme(options.iconTheme);
  if (entry.is_dir) {
    return resolveExplorerPreviewFolderIconSrc(entry.path, false, options);
  }

  return resolveFileIconSrc(entry.name, getExplorerEntryExtension(entry), iconTheme);
}

export function buildArchivePreviewEntryMetadata(
  paths: readonly string[],
): ExplorerArchivePreviewEntryMetadata[] {
  const directoryHints = new Set<string>();

  for (const path of paths) {
    const normalizedPath = trimArchivePath(path);
    if (!normalizedPath) {
      continue;
    }

    const segments = normalizedPath.split(/[\\/]+/).filter(Boolean);
    for (let index = 1; index < segments.length; index += 1) {
      directoryHints.add(segments.slice(0, index).join("/"));
    }
  }

  return paths
    .map((path) => {
      const normalizedPath = trimArchivePath(path);
      if (!normalizedPath) {
        return null;
      }

      const segments = normalizedPath.split(/[\\/]+/).filter(Boolean);
      const name = segments[segments.length - 1] ?? normalizedPath;
      const parentPath = segments.slice(0, -1).join("/");

      return {
        originalPath: path,
        normalizedPath,
        name,
        parentPath,
        isDirectory: /[/\\]+$/.test(path) || directoryHints.has(normalizedPath),
      } satisfies ExplorerArchivePreviewEntryMetadata;
    })
    .filter(
      (entry): entry is ExplorerArchivePreviewEntryMetadata => entry !== null,
    );
}

export function resolveArchivePreviewEntryIconSrc(
  entry: ExplorerArchivePreviewEntryMetadata,
  options: ExplorerPreviewFolderIconConfig = {},
): string {
  const iconTheme = getEffectiveIconTheme(options.iconTheme);
  if (entry.isDirectory) {
    return resolveExplorerPreviewFolderIconSrc(entry.normalizedPath, false, options);
  }

  return resolveFileIconSrc(
    entry.name,
    getArchiveEntryExtension(entry.name),
    iconTheme,
  );
}

export function ExplorerPreviewEntryIconImage({
  src,
  size = 18,
  style,
}: {
  src: string;
  size?: number | string;
  style?: CSSProperties;
}) {
  return (
    <img
      data-overlay-preview-entry-icon="true"
      src={src}
      alt=""
      aria-hidden="true"
      draggable={false}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        objectFit: "contain",
        display: "block",
        flexShrink: 0,
        ...style,
      }}
    />
  );
}
