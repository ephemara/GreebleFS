import shippedExplorerModeProfileManifestJson from "../../usr/profiles/default/explorer-mode-profiles/greeblefs-core/explorer-mode-profile.json";
import {
  getExplorerShellLayoutDefinition,
  type ExplorerShellLayoutId,
} from "./explorerShellLayouts";
import {
  defaultExplorerChromeLayoutId,
  normalizeExplorerChromeLayoutId,
  type ExplorerChromeLayoutId,
} from "./explorerChromeLayouts";
import type { ExplorerExperimentalViewMode } from "./explorerExperimentalModes";
import type { ExplorerViewMode } from "./explorerViewModes";

export type BuiltInExplorerModeProfileId =
  | "balanced"
  | "navigator"
  | "focus"
  | "inspector";
export type ExplorerModeProfileId =
  | BuiltInExplorerModeProfileId
  | (string & {});
export type ExplorerModeViewBias =
  | "balanced"
  | "browsing"
  | "content-focus"
  | "preview-heavy";

export interface ExplorerModeProfileDefinition {
  id: ExplorerModeProfileId;
  label: string;
  shortLabel: string;
  description: string;
  paneLayoutId: ExplorerShellLayoutId;
  chromeLayoutId: ExplorerChromeLayoutId;
  viewBias: ExplorerModeViewBias;
  preferredViewMode?: ExplorerViewMode;
  preferredExperimentalViewMode?: ExplorerExperimentalViewMode;
}

interface ShippedExplorerModeProfileManifest {
  modeProfiles?: ExplorerModeProfileDefinition[];
}

const builtInExplorerModeProfileOrder = [
  "balanced",
  "navigator",
  "focus",
  "inspector",
] as const satisfies readonly BuiltInExplorerModeProfileId[];

export const defaultExplorerModeProfileId: BuiltInExplorerModeProfileId =
  "balanced";

function cloneExplorerModeProfileDefinition(
  profile: ExplorerModeProfileDefinition,
): ExplorerModeProfileDefinition {
  return { ...profile };
}

function resolveBuiltInExplorerModeProfiles(
  manifest: ShippedExplorerModeProfileManifest | null | undefined,
): Record<BuiltInExplorerModeProfileId, ExplorerModeProfileDefinition> {
  const shippedExplorerModeProfiles = Array.isArray(manifest?.modeProfiles)
    ? manifest.modeProfiles.map(cloneExplorerModeProfileDefinition)
    : [];
  const shippedExplorerModeProfileById = new Map(
    shippedExplorerModeProfiles.map((profile) => [profile.id, profile] as const),
  );

  return Object.fromEntries(
    builtInExplorerModeProfileOrder.map((modeProfileId) => {
      const modeProfile = shippedExplorerModeProfileById.get(modeProfileId);
      if (!modeProfile) {
        throw new Error(
          `Missing shipped explorer mode profile: ${modeProfileId}`,
        );
      }
      return [modeProfileId, cloneExplorerModeProfileDefinition(modeProfile)] as const;
    }),
  ) as Record<BuiltInExplorerModeProfileId, ExplorerModeProfileDefinition>;
}

let builtInExplorerModeProfiles =
  {} as Record<BuiltInExplorerModeProfileId, ExplorerModeProfileDefinition>;

export let explorerModeProfiles: ExplorerModeProfileDefinition[] = [];

export function applyUsrExplorerModeProfileManifest(
  manifest: ShippedExplorerModeProfileManifest | null | undefined,
): void {
  builtInExplorerModeProfiles = resolveBuiltInExplorerModeProfiles(manifest);
  explorerModeProfiles = builtInExplorerModeProfileOrder.map(
    (modeProfileId) => builtInExplorerModeProfiles[modeProfileId],
  );
}

applyUsrExplorerModeProfileManifest(
  shippedExplorerModeProfileManifestJson as ShippedExplorerModeProfileManifest,
);

export function stepExplorerModeProfile(input: {
  currentModeProfileId?: ExplorerModeProfileId | null;
  direction?: "next" | "previous";
}): ExplorerModeProfileDefinition {
  const direction = input.direction ?? "next";
  const currentModeProfileId = normalizeExplorerModeProfileId(
    input.currentModeProfileId,
  );
  const currentIndex = explorerModeProfiles.findIndex(
    (modeProfile) => modeProfile.id === currentModeProfileId,
  );
  const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;
  const offset = direction === "previous" ? -1 : 1;
  const nextIndex =
    (safeCurrentIndex + offset + explorerModeProfiles.length) %
    explorerModeProfiles.length;
  return explorerModeProfiles[nextIndex] ?? explorerModeProfiles[0];
}

function asTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

export function normalizeExplorerModeProfileId(
  value: unknown,
): ExplorerModeProfileId {
  return (
    (asTrimmedString(value) as ExplorerModeProfileId | null) ??
    defaultExplorerModeProfileId
  );
}

export function getExplorerModeProfileDefinition(
  modeProfileId?: ExplorerModeProfileId | null,
): ExplorerModeProfileDefinition {
  const normalizedModeProfileId = normalizeExplorerModeProfileId(modeProfileId);
  return (
    builtInExplorerModeProfiles[
      normalizedModeProfileId as BuiltInExplorerModeProfileId
    ] ?? builtInExplorerModeProfiles[defaultExplorerModeProfileId]
  );
}

export function mapLegacyShellLayoutIdToExplorerModeProfileId(
  shellLayoutId?: ExplorerShellLayoutId | null,
): ExplorerModeProfileId {
  return getExplorerShellLayoutDefinition(shellLayoutId).id;
}

export function resolveEffectiveExplorerModeProfileId(input: {
  themeOverrideModeProfileId?: ExplorerModeProfileId | null;
  themeDefaultModeProfileId?: ExplorerModeProfileId | null;
  legacyShellLayoutId?: ExplorerShellLayoutId | null;
}): ExplorerModeProfileId {
  if (input.themeOverrideModeProfileId) {
    return normalizeExplorerModeProfileId(input.themeOverrideModeProfileId);
  }
  if (input.themeDefaultModeProfileId) {
    return normalizeExplorerModeProfileId(input.themeDefaultModeProfileId);
  }
  if (input.legacyShellLayoutId) {
    return mapLegacyShellLayoutIdToExplorerModeProfileId(
      input.legacyShellLayoutId,
    );
  }
  return defaultExplorerModeProfileId;
}

export function resolveEffectiveExplorerModeProfile(input: {
  themeOverrideModeProfileId?: ExplorerModeProfileId | null;
  themeDefaultModeProfileId?: ExplorerModeProfileId | null;
  legacyShellLayoutId?: ExplorerShellLayoutId | null;
}): ExplorerModeProfileDefinition {
  return getExplorerModeProfileDefinition(
    resolveEffectiveExplorerModeProfileId(input),
  );
}

export function resolveExplorerModeProfileChromeLayoutId(input: {
  modeProfile?: Pick<ExplorerModeProfileDefinition, "chromeLayoutId"> | null;
  themeChromeLayoutId?: ExplorerChromeLayoutId | null;
}): ExplorerChromeLayoutId {
  return normalizeExplorerChromeLayoutId(
    input.modeProfile?.chromeLayoutId ??
      input.themeChromeLayoutId ??
      defaultExplorerChromeLayoutId,
  );
}
