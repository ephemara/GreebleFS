import {
  resolveFolderIcon,
  type FolderIconRule,
  type FolderIconValue,
} from "../src/config/folderIcons";
import {
  resolveFileIconId,
  resolveUiIconReference,
  type OverlayResolvedIconTheme,
} from "../src/config/iconTheme";
import type { MobileShareThemeSnapshot } from "./types";
import type { MobileShareEntry } from "./types";

export type MobileTabId = "explorer" | "search" | "transfers" | "settings";

export interface MobileUiIconReference {
  kind: "icon" | "lucide";
  value: string;
}

function createResolvedIconTheme(
  snapshot: MobileShareThemeSnapshot,
): OverlayResolvedIconTheme {
  return {
    ...snapshot.iconTheme,
    version: 1,
    description: snapshot.iconTheme.name,
  };
}

function resolveOpenFolderIconId(
  iconId: string,
  snapshot: MobileShareThemeSnapshot,
): string {
  const openIconId =
    iconId === snapshot.iconTheme.folder
      ? snapshot.iconTheme.folderExpanded
      : `${iconId}_open`;
  return snapshot.iconTheme.iconDefinitions[openIconId] ? openIconId : iconId;
}

export function buildMobileIconUrl(iconId: string): string {
  return `/api/icon?id=${encodeURIComponent(iconId)}`;
}

export function resolveMobileEntryIconUrl(
  entry: MobileShareEntry,
  snapshot: MobileShareThemeSnapshot | null,
  openFolder = false,
): string | null {
  if (!snapshot) {
    return null;
  }

  if (entry.iconId.trim()) {
    const iconId =
      openFolder && entry.isDir
        ? resolveOpenFolderIconId(entry.iconId, snapshot)
        : entry.iconId;
    return buildMobileIconUrl(iconId);
  }

  const iconTheme = createResolvedIconTheme(snapshot);
  if (entry.isDir) {
    const folderResolution = resolveFolderIcon(entry.relativePath || entry.name, {
      rules: snapshot.folderIconRules as FolderIconRule[],
      defaultIcon: snapshot.defaultFolderIcon as FolderIconValue,
      iconTheme,
    });
    const iconId = openFolder
      ? resolveOpenFolderIconId(folderResolution.icon, snapshot)
      : folderResolution.icon;
    return buildMobileIconUrl(iconId);
  }

  const iconId = resolveFileIconId(entry.name, entry.extension, iconTheme);
  return buildMobileIconUrl(iconId);
}

export function resolveMobileNavIcon(
  slotId: string,
  snapshot: MobileShareThemeSnapshot | null,
): MobileUiIconReference | null {
  if (!snapshot) {
    return null;
  }

  const iconTheme = createResolvedIconTheme(snapshot);
  const reference = resolveUiIconReference(slotId, iconTheme);
  if (!reference) {
    return null;
  }

  if (reference.startsWith("lucide:")) {
    return {
      kind: "lucide",
      value: reference.slice("lucide:".length),
    };
  }

  return {
    kind: "icon",
    value: reference,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  const value = bytes / 1024 ** unitIndex;
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function formatRelativePath(path: string): string {
  return path.length > 0 ? path : "Shared";
}

export function buildParentPath(path: string): string {
  const segments = path.split("/").filter(Boolean);
  if (segments.length <= 1) {
    return "";
  }
  return segments.slice(0, -1).join("/");
}

export function formatModifiedLabel(timestampMs: number | null): string {
  if (!timestampMs || !Number.isFinite(timestampMs) || timestampMs <= 0) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestampMs));
}

export function isStandaloneWebApp(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIosSafari(): boolean {
  const userAgent = window.navigator.userAgent;
  const isAppleMobile = /iPhone|iPad|iPod/i.test(userAgent);
  const isSafariEngine =
    /Safari/i.test(userAgent) && !/CriOS|FxiOS|EdgiOS/i.test(userAgent);
  return isAppleMobile && isSafariEngine;
}
