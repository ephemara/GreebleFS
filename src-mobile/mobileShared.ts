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

export type MobileBuiltInTabId = "explorer" | "search" | "transfers" | "settings";
export type MobilePluginTabId = `plugin:${string}`;
export type MobileTabId = MobileBuiltInTabId | MobilePluginTabId;

export function buildMobilePluginTabId(paneId: string): MobilePluginTabId {
  return `plugin:${paneId}`;
}

export function isMobilePluginTabId(tabId: MobileTabId | string): tabId is MobilePluginTabId {
  return tabId.startsWith("plugin:");
}

export function getMobilePluginPaneIdFromTab(tabId: MobileTabId | string): string | null {
  return isMobilePluginTabId(tabId) ? tabId.slice("plugin:".length) : null;
}

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

function resolveKnownIconId(
  iconId: string | null | undefined,
  snapshot: MobileShareThemeSnapshot,
): string | null {
  if (!iconId) {
    return null;
  }

  const normalizedIconId = iconId.trim();
  if (!normalizedIconId) {
    return null;
  }

  return snapshot.iconTheme.iconDefinitions[normalizedIconId]
    ? normalizedIconId
    : null;
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

  const iconTheme = createResolvedIconTheme(snapshot);
  if (entry.isDir) {
    const folderResolution = resolveFolderIcon(entry.relativePath || entry.name, {
      rules: snapshot.folderIconRules as FolderIconRule[],
      defaultIcon: snapshot.defaultFolderIcon as FolderIconValue,
      iconTheme,
    });
    const themedFolderIconId = openFolder
      ? resolveOpenFolderIconId(folderResolution.icon, snapshot)
      : folderResolution.icon;
    const iconId =
      resolveKnownIconId(themedFolderIconId, snapshot)
      ?? resolveKnownIconId(entry.iconId, snapshot)
      ?? resolveKnownIconId(snapshot.defaultFolderIcon, snapshot)
      ?? resolveKnownIconId(snapshot.iconTheme.folder, snapshot);
    return iconId ? buildMobileIconUrl(iconId) : null;
  }

  const iconId =
    resolveKnownIconId(resolveFileIconId(entry.name, entry.extension, iconTheme), snapshot)
    ?? resolveKnownIconId(entry.iconId, snapshot)
    ?? resolveKnownIconId(snapshot.iconTheme.file, snapshot);
  return iconId ? buildMobileIconUrl(iconId) : null;
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

export type MobileFormFactor = "mobile" | "desktop";
export type MobileFormFactorOverride = "auto" | MobileFormFactor;

export const MOBILE_DESKTOP_MIN_WIDTH_PX = 900;

export interface MobileFormFactorHints {
  userAgent?: string;
  viewportWidth?: number;
  pointerFine?: boolean;
  pointerCoarse?: boolean;
  touchPoints?: number;
}

const MOBILE_UA_PATTERN = /android|iphone|ipod|windows phone|blackberry|bb10|mobile|phone/i;
const TABLET_UA_PATTERN = /ipad|tablet|kindle|silk|playbook/i;

export function isMobileUserAgent(userAgent: string): boolean {
  if (!userAgent) {
    return false;
  }
  return MOBILE_UA_PATTERN.test(userAgent) || TABLET_UA_PATTERN.test(userAgent);
}

export function normalizeMobileFormFactorOverride(value: unknown): MobileFormFactorOverride {
  return value === "mobile" || value === "desktop" || value === "auto" ? value : "auto";
}

export function detectMobileFormFactor(hints: MobileFormFactorHints = {}): MobileFormFactor {
  const viewportWidth = hints.viewportWidth ?? 0;
  if (hints.userAgent && isMobileUserAgent(hints.userAgent)) {
    return "mobile";
  }
  if (!viewportWidth || viewportWidth < MOBILE_DESKTOP_MIN_WIDTH_PX) {
    return "mobile";
  }
  // Large touch-first tablet that never reports a fine pointer stays on the
  // thumb-friendly layout even when the viewport is wide.
  if (hints.pointerFine === false && (hints.touchPoints ?? 0) > 0 && hints.pointerCoarse !== false) {
    return "mobile";
  }
  if (hints.pointerFine === true) {
    return "desktop";
  }
  // No pointer signal (SSR, jsdom, kiosk): a wide viewport with no touch
  // points is almost always a real computer browser.
  if ((hints.touchPoints ?? 0) === 0 && hints.pointerCoarse !== true) {
    return "desktop";
  }
  return "mobile";
}

export function resolveMobileFormFactor(
  override: MobileFormFactorOverride | unknown,
  hints: MobileFormFactorHints = {},
): MobileFormFactor {
  const normalizedOverride = normalizeMobileFormFactorOverride(override);
  if (normalizedOverride !== "auto") {
    return normalizedOverride;
  }
  return detectMobileFormFactor(hints);
}

export function readMobileFormFactorHints(viewportWidth?: number): MobileFormFactorHints {
  if (typeof window === "undefined") {
    return { viewportWidth: viewportWidth ?? 0 };
  }
  const width = viewportWidth ?? window.innerWidth ?? 0;
  let pointerFine: boolean | undefined;
  let pointerCoarse: boolean | undefined;
  try {
    if (typeof window.matchMedia === "function") {
      pointerFine = window.matchMedia("(pointer: fine)").matches || undefined;
      // matchMedia returns false for both queries when the feature is
      // unsupported (jsdom) — leave both undefined so detection falls back
      // to the conservative mobile layout instead of flipping to desktop.
      if (pointerFine !== true) {
        pointerFine = undefined;
      }
      const coarseMatches = window.matchMedia("(pointer: coarse)").matches;
      pointerCoarse = coarseMatches ? true : undefined;
    }
  } catch {
    pointerFine = undefined;
    pointerCoarse = undefined;
  }
  let touchPoints = 0;
  try {
    touchPoints = window.navigator?.maxTouchPoints ?? 0;
  } catch {
    touchPoints = 0;
  }
  return {
    userAgent: window.navigator?.userAgent ?? "",
    viewportWidth: width,
    pointerFine,
    pointerCoarse,
    touchPoints,
  };
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
