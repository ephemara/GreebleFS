import { create } from "zustand";

import type {
  AppearanceSettings,
  DockSettings,
  ExplorerSettings,
  PresentationSettings,
  PresentationWindowMode,
} from "./settingsStore";
import {
  createEmptyLookdevPresetManifest,
  type LoadedLookdevPreset,
  type LookdevPresetManifest,
  type LookdevPresetScopedOverrides,
  type LookdevScope,
} from "../config/lookdevPresets";

export type LookdevOverlayLens =
  | "shell"
  | "explorer"
  | "menus-actions"
  | "theme"
  | "dock-panels"
  | "save";

export type LookdevScopeMode = "follow-current" | LookdevScope;
export type LookdevScopedSectionKey =
  | "appearance"
  | "explorer"
  | "dock"
  | "presentation";

export interface LookdevBaselineSnapshot {
  appearance: AppearanceSettings;
  explorer: ExplorerSettings;
  dock: DockSettings;
  presentation: PresentationSettings;
}

export interface LookdevDraftSession {
  presetId: string | null;
  manifest: LookdevPresetManifest;
  baseline: LookdevBaselineSnapshot;
  openedAt: number;
  initialWindowMode: PresentationWindowMode;
}

interface LookdevCatalogState {
  presets: LoadedLookdevPreset[];
  presetsDirectory: string;
  presetsLoading: boolean;
  presetsError: string | null;
  presetsWarnings: string[];
}

interface LookdevSessionState {
  isOpen: boolean;
  activeLens: LookdevOverlayLens;
  scopeMode: LookdevScopeMode;
  draftSession: LookdevDraftSession | null;
  statusMessage: string | null;
  selectedPresetId: string | null;
  activeAppliedPresetId: string | null;
}

interface LookdevStoreState extends LookdevCatalogState, LookdevSessionState {
  setCatalogState: (
    nextState: Partial<LookdevCatalogState>,
  ) => void;
  openSession: (input: {
    baseline: LookdevBaselineSnapshot;
    initialWindowMode: PresentationWindowMode;
    preset?: LoadedLookdevPreset | null;
  }) => void;
  closeSession: () => void;
  setActiveLens: (lens: LookdevOverlayLens) => void;
  setScopeMode: (mode: LookdevScopeMode) => void;
  setStatusMessage: (message: string | null) => void;
  setSelectedPresetId: (presetId: string | null) => void;
  setActiveAppliedPresetId: (presetId: string | null) => void;
  clearActiveAppliedPresetId: () => void;
  setDraftManifest: (manifest: LookdevPresetManifest) => void;
  updateDraftScopedSection: (
    scope: LookdevScope,
    sectionKey: LookdevScopedSectionKey,
    patch: Record<string, unknown>,
  ) => void;
}

function cloneJsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function cloneLookdevBaselineSnapshot(
  baseline: LookdevBaselineSnapshot,
): LookdevBaselineSnapshot {
  return cloneJsonValue(baseline);
}

export function resolveLookdevEditableScope(
  scopeMode: LookdevScopeMode,
  currentWindowMode: PresentationWindowMode,
): LookdevScope {
  if (scopeMode === "shared") {
    return "shared";
  }

  if (scopeMode === "windowed" || scopeMode === "dock") {
    return scopeMode;
  }

  return currentWindowMode === "dock" ? "dock" : "windowed";
}

export const useLookdevStore = create<LookdevStoreState>((set) => ({
  presets: [],
  presetsDirectory: "",
  presetsLoading: false,
  presetsError: null,
  presetsWarnings: [],
  isOpen: false,
  activeLens: "theme",
  scopeMode: "follow-current",
  draftSession: null,
  statusMessage: null,
  selectedPresetId: null,
  activeAppliedPresetId: null,

  setCatalogState: (nextState) =>
    set((state) => ({
      ...state,
      ...nextState,
    })),

  openSession: ({ baseline, initialWindowMode, preset }) =>
    set((state) => ({
      ...state,
      isOpen: true,
      activeLens: "theme",
      scopeMode: "follow-current",
      statusMessage: null,
      selectedPresetId: preset?.id ?? state.selectedPresetId,
      draftSession: {
        presetId: preset?.id ?? null,
        manifest: cloneJsonValue(
          preset?.manifest ??
            createEmptyLookdevPresetManifest({
              id: "live-lookdev-session",
              name: "Live Lookdev Session",
              description:
                "Ephemeral lookdev draft built from the current live shell state.",
            }),
        ),
        baseline: cloneLookdevBaselineSnapshot(baseline),
        openedAt: Date.now(),
        initialWindowMode,
      },
    })),

  closeSession: () =>
    set((state) => ({
      ...state,
      isOpen: false,
      statusMessage: null,
      draftSession: null,
    })),

  setActiveLens: (lens) =>
    set((state) => ({
      ...state,
      activeLens: lens,
    })),

  setScopeMode: (mode) =>
    set((state) => ({
      ...state,
      scopeMode: mode,
    })),

  setStatusMessage: (message) =>
    set((state) => ({
      ...state,
      statusMessage: message,
    })),

  setSelectedPresetId: (presetId) =>
    set((state) => ({
      ...state,
      selectedPresetId: presetId,
    })),

  setActiveAppliedPresetId: (presetId) =>
    set((state) => ({
      ...state,
      activeAppliedPresetId: presetId,
    })),

  clearActiveAppliedPresetId: () =>
    set((state) => ({
      ...state,
      activeAppliedPresetId: null,
    })),

  setDraftManifest: (manifest) =>
    set((state) => {
      if (!state.draftSession) {
        return state;
      }

      return {
        ...state,
        draftSession: {
          ...state.draftSession,
          manifest: cloneJsonValue(manifest),
        },
      };
    }),

  updateDraftScopedSection: (scope, sectionKey, patch) =>
    set((state) => {
      if (!state.draftSession) {
        return state;
      }

      const currentScopedOverrides =
        cloneJsonValue(
          state.draftSession.manifest[scope] ?? {},
        ) as LookdevPresetScopedOverrides;

      return {
        ...state,
        draftSession: {
          ...state.draftSession,
          manifest: {
            ...state.draftSession.manifest,
            [scope]: {
              ...currentScopedOverrides,
              [sectionKey]: {
                ...(currentScopedOverrides[sectionKey] ?? {}),
                ...cloneJsonValue(patch),
              },
            },
          },
        },
      };
    }),
}));
