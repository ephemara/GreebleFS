import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Pane } from "tweakpane";
import "tweakpane/dist/tweakpane.css";
import {
  ExternalLink,
  FolderOpen,
  Layers3,
  LayoutGrid,
  Palette,
  PanelTop,
  Puzzle,
  RefreshCw,
  Save,
  SlidersHorizontal,
  Sparkles,
  X,
} from "@/components/AppIcons";
import { isTauri } from "@tauri-apps/api/core";
import { mkdir } from "@tauri-apps/plugin-fs";
import { useShallow } from "zustand/react/shallow";

import type { ResolvedOverlayAppearance } from "../../config/appearance";
import {
  getManagedContentDirectory,
  getManagedContentPrimaryDirectory,
} from "../../config/appContentDirectories";
import {
  resolveAvailableDockPresentations,
  type LoadedDockPresentationPackage,
} from "../../config/dockPresentations";
import type { LoadedExplorerAction } from "../../config/actionPacks";
import type { LoadedExplorerMenuPack } from "../../config/menuPacks";
import {
  resolveLookdevPresetForWindowMode,
  saveLookdevPresetManifest,
  type LoadedLookdevPreset,
} from "../../config/lookdevPresets";
import type { SettingsSectionKey } from "../../config/settingsNavigation";
import { getBuiltInShellCustomizeCatalog } from "../../config/shellCustomizeCatalog";
import {
  resolveAvailableTopBars,
  type LoadedOverlayTopBarDefinition,
} from "../../config/topBars";
import {
  createThemeBundleManifestFromThemeDefinition,
  upsertCustomThemeBundle,
  type LoadedOverlayThemePackage,
} from "../../config/themePackages";
import { openExplorerPath } from "../../runtime/explorerBackend";
import {
  applyLookdevScopedOverridesToSettings,
  captureLookdevScopedOverridesFromSettings,
} from "../../runtime/lookdevRuntime";
import {
  resolveLookdevEditableScope,
  useLookdevStore,
  type LookdevOverlayLens,
} from "../../store/lookdevStore";
import { useSettingsStore } from "../../store/settingsStore";

const LOOKDEV_COMMAND_EVENT_OPEN = "greeblefs:open-lookdev-overlay";
const LOOKDEV_COMMAND_EVENT_TOGGLE = "greeblefs:toggle-lookdev-overlay";

function slugifyLookdevLabel(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toTweakpaneOptions(entries: Array<{ label: string; value: string }>) {
  return Object.fromEntries(entries.map((entry) => [entry.label, entry.value]));
}

function cloneJsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function shouldApplyLivePreview(
  scope: "shared" | "windowed" | "dock",
  currentWindowMode: "windowed" | "dock",
): boolean {
  return scope === "shared" || scope === currentWindowMode;
}

export interface LookdevOverlayProps {
  appearance: ResolvedOverlayAppearance;
  themePackages: LoadedOverlayThemePackage[];
  topBarPackages: Array<{ topBars?: LoadedOverlayTopBarDefinition[] | null }>;
  dockPresentationPackages: LoadedDockPresentationPackage[];
  menuPacks: LoadedExplorerMenuPack[];
  actions: LoadedExplorerAction[];
  onRefreshLookdevPresets: () => Promise<void>;
  onRefreshThemes: () => Promise<void>;
  onRefreshTopBars: () => Promise<void>;
  onRefreshDockPresentations: () => Promise<void>;
  onRefreshMenuPacks: () => Promise<void>;
  onOpenSettingsSection?: (section: SettingsSectionKey) => void;
  onToggleTopBarCustomize: () => void;
}

export function LookdevOverlay({
  appearance,
  themePackages,
  topBarPackages,
  dockPresentationPackages,
  menuPacks,
  actions,
  onRefreshLookdevPresets,
  onRefreshThemes,
  onRefreshTopBars,
  onRefreshDockPresentations,
  onRefreshMenuPacks,
  onOpenSettingsSection,
  onToggleTopBarCustomize,
}: LookdevOverlayProps) {
  const paneHostRef = useRef<HTMLDivElement | null>(null);
  const paneInstanceRef = useRef<Pane | null>(null);
  const {
    isOpen,
    activeLens,
    scopeMode,
    draftSession,
    statusMessage,
    presets,
    presetsLoading,
    selectedPresetId,
    activeAppliedPresetId,
    setActiveLens,
    setScopeMode,
    setStatusMessage,
    setSelectedPresetId,
    setActiveAppliedPresetId,
    clearActiveAppliedPresetId,
    setDraftManifest,
    updateDraftScopedSection,
    closeSession,
  } = useLookdevStore(
    useShallow((state) => ({
      isOpen: state.isOpen,
      activeLens: state.activeLens,
      scopeMode: state.scopeMode,
      draftSession: state.draftSession,
      statusMessage: state.statusMessage,
      presets: state.presets,
      presetsLoading: state.presetsLoading,
      selectedPresetId: state.selectedPresetId,
      activeAppliedPresetId: state.activeAppliedPresetId,
      setActiveLens: state.setActiveLens,
      setScopeMode: state.setScopeMode,
      setStatusMessage: state.setStatusMessage,
      setSelectedPresetId: state.setSelectedPresetId,
      setActiveAppliedPresetId: state.setActiveAppliedPresetId,
      clearActiveAppliedPresetId: state.clearActiveAppliedPresetId,
      setDraftManifest: state.setDraftManifest,
      updateDraftScopedSection: state.updateDraftScopedSection,
      closeSession: state.closeSession,
    })),
  );
  const {
    appearanceSettings,
    explorerSettings,
    dockSettings,
    presentationSettings,
    applyThemeSelection,
    updateAppearance,
    updateExplorer,
    updateDock,
    updatePresentation,
  } = useSettingsStore(
    useShallow((state) => ({
      appearanceSettings: state.settings.appearance,
      explorerSettings: state.settings.explorer,
      dockSettings: state.settings.dock,
      presentationSettings: state.settings.presentation,
      applyThemeSelection: state.applyThemeSelection,
      updateAppearance: state.updateAppearance,
      updateExplorer: state.updateExplorer,
      updateDock: state.updateDock,
      updatePresentation: state.updatePresentation,
    })),
  );
  const [presetName, setPresetName] = useState("");
  const [presetDescription, setPresetDescription] = useState("");

  useEffect(() => {
    if (!draftSession) {
      setPresetName("");
      setPresetDescription("");
      return;
    }

    setPresetName(draftSession.manifest.name?.trim() ?? "");
    setPresetDescription(draftSession.manifest.description?.trim() ?? "");
  }, [draftSession]);

  const currentWindowMode = presentationSettings.windowMode;
  const editableScope = resolveLookdevEditableScope(scopeMode, currentWindowMode);
  const liveSnapshot = useMemo(
    () => ({
      appearance: appearanceSettings,
      explorer: explorerSettings,
      dock: dockSettings,
      presentation: presentationSettings,
    }),
    [appearanceSettings, dockSettings, explorerSettings, presentationSettings],
  );
  const topBars = useMemo(
    () => resolveAvailableTopBars([...themePackages, ...topBarPackages]),
    [themePackages, topBarPackages],
  );
  const availableDockPresentations = useMemo(
    () => resolveAvailableDockPresentations(dockPresentationPackages),
    [dockPresentationPackages],
  );
  const themeOptions = useMemo(() => {
    const options = new Map<string, string>();
    for (const themePackage of themePackages) {
      options.set(themePackage.name, themePackage.id);
    }
    for (const customThemeBundle of appearanceSettings.customThemeBundles) {
      if (customThemeBundle.id?.trim()) {
        options.set(
          customThemeBundle.name?.trim() || customThemeBundle.id,
          customThemeBundle.id,
        );
      }
    }
    if (!options.has(appearanceSettings.activeThemeId)) {
      options.set(appearanceSettings.activeThemeId, appearanceSettings.activeThemeId);
    }
    return Array.from(options.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [appearanceSettings.activeThemeId, appearanceSettings.customThemeBundles, themePackages]);
  const topBarOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const topBar of topBars) {
      map.set(topBar.name, topBar.id);
    }
    if (appearanceSettings.activeTopBarId && !Array.from(map.values()).includes(appearanceSettings.activeTopBarId)) {
      map.set(appearanceSettings.activeTopBarId, appearanceSettings.activeTopBarId);
    }
    return Array.from(map.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [appearanceSettings.activeTopBarId, topBars]);
  const dockPresentationOptions = useMemo(
    () =>
      availableDockPresentations.map((presentation) => ({
        label: presentation.name,
        value: presentation.id,
      })),
    [availableDockPresentations],
  );
  const menuPackOptions = useMemo(() => {
    const values = menuPacks.map((menuPack) => ({
      label: menuPack.name,
      value: menuPack.id,
    }));
    if (
      explorerSettings.activeMenuPackId &&
      !values.some((entry) => entry.value === explorerSettings.activeMenuPackId)
    ) {
      values.push({
        label: explorerSettings.activeMenuPackId,
        value: explorerSettings.activeMenuPackId,
      });
    }
    return values.sort((left, right) => left.label.localeCompare(right.label));
  }, [explorerSettings.activeMenuPackId, menuPacks]);
  const selectedPreset = useMemo(
    () => presets.find((preset) => preset.id === selectedPresetId) ?? null,
    [presets, selectedPresetId],
  );
  const shellCustomizeCatalog = useMemo(
    () => getBuiltInShellCustomizeCatalog(),
    [],
  );

  const applyCallbacks = useMemo(
    () => ({
      updateAppearance,
      updateExplorer,
      updateDock,
      updatePresentation,
    }),
    [updateAppearance, updateDock, updateExplorer, updatePresentation],
  );

  function patchDraftAndPreview(
    sectionKey: "appearance" | "explorer" | "dock" | "presentation",
    patch: Record<string, unknown>,
  ) {
    updateDraftScopedSection(editableScope, sectionKey, patch);
    if (!shouldApplyLivePreview(editableScope, currentWindowMode)) {
      setStatusMessage(
        `Editing ${editableScope} overrides while the shell is in ${currentWindowMode} mode.`,
      );
      return;
    }

    if (sectionKey === "appearance") {
      updateAppearance(patch as never);
    } else if (sectionKey === "explorer") {
      updateExplorer(patch as never);
    } else if (sectionKey === "dock") {
      updateDock(patch as never);
    } else {
      updatePresentation(patch as never);
    }
  }

  useEffect(() => {
    if (!isOpen || !paneHostRef.current) {
      paneInstanceRef.current?.dispose();
      paneInstanceRef.current = null;
      return;
    }

    const pane = new Pane({
      container: paneHostRef.current,
      title: "Lookdev Inspector",
      expanded: true,
    });
    paneInstanceRef.current = pane;
    paneHostRef.current.innerHTML = "";

    const shellFolder = pane.addFolder({
      title:
        activeLens === "shell"
          ? "Shell"
          : activeLens === "explorer"
            ? "Explorer"
            : activeLens === "menus-actions"
              ? "Menus & Actions"
              : activeLens === "theme"
                ? "Theme"
                : activeLens === "dock-panels"
                  ? "Dock & Panels"
                  : "Save",
      expanded: true,
    });

    if (activeLens === "shell" || activeLens === "theme") {
      const shellParams = {
        appOpacity: appearanceSettings.appOpacity,
        panelTransparency: appearanceSettings.panelTransparency,
        appZoom: appearanceSettings.appZoom,
        appBlurStrength: appearanceSettings.appBlurStrength,
        compactMode: appearanceSettings.compactMode,
        activeTopBarId: appearanceSettings.activeTopBarId ?? "",
      };

      shellFolder
        .addBinding(shellParams, "appOpacity", {
          min: 0.3,
          max: 1,
          step: 0.01,
          label: "App Opacity",
        })
        .on("change", (event) =>
          patchDraftAndPreview("appearance", { appOpacity: event.value }),
        );
      shellFolder
        .addBinding(shellParams, "panelTransparency", {
          min: 0,
          max: 0.9,
          step: 0.01,
          label: "Panel Alpha",
        })
        .on("change", (event) =>
          patchDraftAndPreview("appearance", {
            panelTransparency: event.value,
          }),
        );
      shellFolder
        .addBinding(shellParams, "appZoom", {
          min: 0.75,
          max: 1.4,
          step: 0.01,
          label: "Zoom",
        })
        .on("change", (event) =>
          patchDraftAndPreview("appearance", { appZoom: event.value }),
        );
      shellFolder
        .addBinding(shellParams, "appBlurStrength", {
          min: 0,
          max: 30,
          step: 1,
          label: "Blur",
        })
        .on("change", (event) =>
          patchDraftAndPreview("appearance", {
            appBlurStrength: event.value,
            appBlur: event.value > 0,
          }),
        );
      shellFolder
        .addBinding(shellParams, "compactMode", {
          label: "Compact",
        })
        .on("change", (event) =>
          patchDraftAndPreview("appearance", { compactMode: event.value }),
        );
      shellFolder
        .addBinding(shellParams, "activeTopBarId", {
          label: "Top Bar",
          options: toTweakpaneOptions(topBarOptions),
        })
        .on("change", (event) =>
          patchDraftAndPreview("appearance", { activeTopBarId: event.value }),
        );
    }

    if (activeLens === "theme") {
      const themeParams = {
        activeThemeId: appearanceSettings.activeThemeId,
        accentColor: appearanceSettings.accentColor,
        useNativeOsIcons: appearanceSettings.useNativeOsIcons,
      };

      shellFolder
        .addBinding(themeParams, "activeThemeId", {
          label: "Theme",
          options: toTweakpaneOptions(themeOptions),
        })
        .on("change", (event) => {
          updateDraftScopedSection(editableScope, "appearance", {
            activeThemeId: event.value,
          });
          if (shouldApplyLivePreview(editableScope, currentWindowMode)) {
            applyThemeSelection(String(event.value));
          }
        });
      shellFolder
        .addBinding(themeParams, "accentColor", {
          label: "Accent",
          view: "color",
        })
        .on("change", (event) =>
          patchDraftAndPreview("appearance", { accentColor: event.value }),
        );
      shellFolder
        .addBinding(themeParams, "useNativeOsIcons", {
          label: "Native Icons",
        })
        .on("change", (event) =>
          patchDraftAndPreview("appearance", {
            useNativeOsIcons: event.value,
          }),
        );
    }

    if (activeLens === "explorer" || activeLens === "menus-actions") {
      const explorerParams = {
        activeMenuPackId: explorerSettings.activeMenuPackId ?? "",
        followThemeExplorerLayout: explorerSettings.followThemeExplorerLayout,
      };

      shellFolder
        .addBinding(explorerParams, "activeMenuPackId", {
          label: "Menu Pack",
          options: toTweakpaneOptions(menuPackOptions),
        })
        .on("change", (event) =>
          patchDraftAndPreview("explorer", {
            activeMenuPackId: event.value,
          }),
        );
      shellFolder
        .addBinding(explorerParams, "followThemeExplorerLayout", {
          label: "Follow Theme Layout",
        })
        .on("change", (event) =>
          patchDraftAndPreview("explorer", {
            followThemeExplorerLayout: event.value,
          }),
        );
    }

    if (activeLens === "dock-panels") {
      const dockParams = {
        activePresentationId: dockSettings.activePresentationId ?? "",
        placementMode: dockSettings.placementMode,
        edgeSize: dockSettings.edgeSize,
        edgeWidth: dockSettings.edgeWidth,
        previewEnabled: dockSettings.previewEnabled,
        previewSplitMode: dockSettings.previewSplitMode,
      };

      shellFolder
        .addBinding(dockParams, "activePresentationId", {
          label: "Presentation",
          options: toTweakpaneOptions(dockPresentationOptions),
        })
        .on("change", (event) =>
          patchDraftAndPreview("dock", {
            activePresentationId: event.value,
          }),
        );
      shellFolder
        .addBinding(dockParams, "placementMode", {
          label: "Placement",
          options: {
            "Top Edge": "top-edge",
            "Bottom Edge": "bottom-edge",
            Floating: "floating",
          },
        })
        .on("change", (event) =>
          patchDraftAndPreview("dock", { placementMode: event.value }),
        );
      shellFolder
        .addBinding(dockParams, "edgeSize", {
          label: "Dock Size",
          min: 220,
          max: 900,
          step: 2,
        })
        .on("change", (event) =>
          patchDraftAndPreview("dock", { edgeSize: event.value }),
        );
      shellFolder
        .addBinding(dockParams, "edgeWidth", {
          label: "Dock Width",
          min: 640,
          max: 2200,
          step: 4,
        })
        .on("change", (event) =>
          patchDraftAndPreview("dock", { edgeWidth: event.value }),
        );
      shellFolder
        .addBinding(dockParams, "previewEnabled", {
          label: "Preview",
        })
        .on("change", (event) =>
          patchDraftAndPreview("dock", {
            previewEnabled: event.value,
          }),
        );
      shellFolder
        .addBinding(dockParams, "previewSplitMode", {
          label: "Preview Split",
          options: {
            Inline: "inline",
            Pane: "pane",
          },
        })
        .on("change", (event) =>
          patchDraftAndPreview("dock", {
            previewSplitMode: event.value,
          }),
        );
    }

    if (activeLens === "save") {
      shellFolder
        .addButton({ title: "Open Preset Folder" })
        .on("click", () => {
          void (async () => {
            if (!isTauri()) {
              return;
            }
            const directory = getManagedContentPrimaryDirectory("lookdevPresets");
            await mkdir(directory, { recursive: true });
            await openExplorerPath(directory);
          })();
        });
      shellFolder
        .addButton({ title: "Refresh Presets" })
        .on("click", () => {
          void onRefreshLookdevPresets();
        });
    }

    return () => {
      pane.dispose();
      if (paneInstanceRef.current === pane) {
        paneInstanceRef.current = null;
      }
    };
  }, [
    activeLens,
    applyThemeSelection,
    appearanceSettings.activeThemeId,
    appearanceSettings.activeTopBarId,
    appearanceSettings.accentColor,
    appearanceSettings.appBlurStrength,
    appearanceSettings.appOpacity,
    appearanceSettings.compactMode,
    appearanceSettings.panelTransparency,
    appearanceSettings.useNativeOsIcons,
    appearanceSettings.appZoom,
    currentWindowMode,
    dockPresentationOptions,
    dockSettings.activePresentationId,
    dockSettings.edgeSize,
    dockSettings.edgeWidth,
    dockSettings.placementMode,
    dockSettings.previewEnabled,
    dockSettings.previewSplitMode,
    editableScope,
    explorerSettings.activeMenuPackId,
    explorerSettings.followThemeExplorerLayout,
    isOpen,
    menuPackOptions,
    onRefreshLookdevPresets,
    topBarOptions,
    updateAppearance,
    updateDock,
    updateDraftScopedSection,
    updateExplorer,
    updatePresentation,
  ]);

  const lensButtons: Array<{
    lens: LookdevOverlayLens;
    label: string;
    icon: JSX.Element;
  }> = [
    { lens: "shell", label: "Shell", icon: <SlidersHorizontal size={13} /> },
    { lens: "explorer", label: "Explorer", icon: <Layers3 size={13} /> },
    { lens: "menus-actions", label: "Menus", icon: <Puzzle size={13} /> },
    { lens: "theme", label: "Theme", icon: <Palette size={13} /> },
    { lens: "dock-panels", label: "Dock", icon: <PanelTop size={13} /> },
    { lens: "save", label: "Save", icon: <Save size={13} /> },
  ];

  async function handleCancelSession() {
    if (!draftSession) {
      closeSession();
      return;
    }

    applyLookdevScopedOverridesToSettings(
      captureLookdevScopedOverridesFromSettings(draftSession.baseline),
      applyCallbacks,
    );
    closeSession();
  }

  async function handleApplySession() {
    clearActiveAppliedPresetId();
    closeSession();
  }

  async function handleSavePreset() {
    if (!draftSession) {
      return;
    }

    const normalizedName = presetName.trim() || "Lookdev Preset";
    const presetId =
      draftSession.manifest.id?.trim() ||
      selectedPresetId ||
      slugifyLookdevLabel(normalizedName) ||
      "lookdev-preset";
    const latestLiveScopedOverrides =
      captureLookdevScopedOverridesFromSettings(liveSnapshot);
    const nextManifest = {
      ...cloneJsonValue(draftSession.manifest),
      version: 1,
      id: presetId,
      name: normalizedName,
      description: presetDescription.trim() || undefined,
      [editableScope]: latestLiveScopedOverrides,
    };

    const savedPreset = await saveLookdevPresetManifest(nextManifest);
    setDraftManifest(savedPreset.manifest);
    setSelectedPresetId(savedPreset.id);
    setActiveAppliedPresetId(savedPreset.id);
    setStatusMessage(`Saved ${savedPreset.name}.`);
    await onRefreshLookdevPresets();
  }

  async function handleExportThemeAssets() {
    const normalizedName = presetName.trim() || "Lookdev Theme";
    const themeBundleId = `${
      slugifyLookdevLabel(normalizedName) || "lookdev-theme"
    }-theme`;
    const themeBundle = {
      ...createThemeBundleManifestFromThemeDefinition(appearance.theme),
      id: themeBundleId,
      name: `${normalizedName} Theme`,
      description:
        presetDescription.trim() ||
        "Theme bundle exported from the live lookdev overlay.",
    };
    updateAppearance({
      customThemeBundles: upsertCustomThemeBundle(
        appearanceSettings.customThemeBundles,
        themeBundle,
      ),
    });
    if (draftSession) {
      setDraftManifest({
        ...draftSession.manifest,
        exports: {
          ...(draftSession.manifest.exports ?? {}),
          themeBundleId,
        },
      });
    }
    setStatusMessage(`Exported ${themeBundle.name}.`);
    await onRefreshThemes();
  }

  function handleLoadPresetForPreview(preset: LoadedLookdevPreset) {
    setSelectedPresetId(preset.id);
    setDraftManifest(preset.manifest);
    setPresetName(preset.name);
    setPresetDescription(preset.description);
    applyLookdevScopedOverridesToSettings(
      resolveLookdevPresetForWindowMode(preset.manifest, currentWindowMode),
      applyCallbacks,
    );
    setStatusMessage(`Previewing ${preset.name}.`);
  }

  function handleApplySelectedPresetRuntime() {
    if (!selectedPreset) {
      return;
    }
    setActiveAppliedPresetId(selectedPreset.id);
    applyLookdevScopedOverridesToSettings(
      resolveLookdevPresetForWindowMode(selectedPreset.manifest, currentWindowMode),
      applyCallbacks,
    );
    setStatusMessage(`${selectedPreset.name} is now the active runtime preset.`);
  }

  if (!isOpen) {
    return null;
  }

  const overlayStyle: CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 2100,
    background:
      "linear-gradient(180deg, rgba(8,10,14,0.78) 0%, rgba(6,8,12,0.72) 48%, rgba(6,8,12,0.82) 100%)",
    backdropFilter: "blur(18px) saturate(1.2)",
    WebkitBackdropFilter: "blur(18px) saturate(1.2)",
  };

  return (
    <div style={overlayStyle}>
      <div className="flex h-full min-h-0">
        <div className="flex min-w-0 flex-1 flex-col px-5 pb-5 pt-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] opacity-65">
                <Sparkles size={12} />
                <span>Global Lookdev</span>
              </div>
              <div className="mt-1 text-[20px] font-semibold leading-none">
                Shape the live shell.
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.12em] opacity-70">
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1">
                  Mode · {currentWindowMode}
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1">
                  Scope · {editableScope}
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1">
                  Shell Controls · {shellCustomizeCatalog.length}
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1">
                  Actions · {actions.length}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleCancelSession()}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors hover:bg-white/[0.09]"
            >
              <X size={12} />
              Close
            </button>
          </div>

          <div className="mt-4 grid min-h-0 flex-1 grid-cols-[220px_minmax(0,1fr)] gap-4">
            <div className="flex min-h-0 flex-col gap-4">
              <div className="rounded-[22px] border border-white/10 bg-black/20 p-2">
                <div className="grid grid-cols-2 gap-2">
                  {lensButtons.map((entry) => {
                    const active = activeLens === entry.lens;
                    return (
                      <button
                        key={entry.lens}
                        type="button"
                        onClick={() => setActiveLens(entry.lens)}
                        className="inline-flex items-center justify-center gap-2 rounded-[16px] px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors"
                        style={{
                          background: active ? `${appearance.theme.palette.accent}22` : "rgba(255,255,255,0.03)",
                          border: `1px solid ${
                            active ? `${appearance.theme.palette.accent}66` : "rgba(255,255,255,0.08)"
                          }`,
                          color: active
                            ? appearance.theme.palette.accent
                            : appearance.theme.palette.textPrimary,
                        }}
                      >
                        {entry.icon}
                        {entry.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[22px] border border-white/10 bg-black/20 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-55">
                  Scope Target
                </div>
                <div className="mt-2 space-y-2">
                  {[
                    { id: "follow-current", label: "Follow Current" },
                    { id: "shared", label: "Shared" },
                    { id: "windowed", label: "Windowed" },
                    { id: "dock", label: "Dock" },
                  ].map((entry) => {
                    const active = scopeMode === entry.id;
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() =>
                          setScopeMode(
                            entry.id as "follow-current" | "shared" | "windowed" | "dock",
                          )
                        }
                        className="flex w-full items-center justify-between rounded-[14px] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.12em]"
                        style={{
                          background: active ? `${appearance.theme.palette.accent}18` : "rgba(255,255,255,0.03)",
                          border: `1px solid ${
                            active ? `${appearance.theme.palette.accent}55` : "rgba(255,255,255,0.08)"
                          }`,
                          color: appearance.theme.palette.textPrimary,
                        }}
                      >
                        <span>{entry.label}</span>
                        {active ? <span style={{ color: appearance.theme.palette.accent }}>Live</span> : null}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="min-h-0 rounded-[22px] border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-55">
                    Presets
                  </div>
                  <button
                    type="button"
                    onClick={() => void onRefreshLookdevPresets()}
                    className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.12em] opacity-70 hover:opacity-100"
                  >
                    <RefreshCw size={10} />
                    Refresh
                  </button>
                </div>
                <div className="mt-2 space-y-2 overflow-y-auto pr-1" style={{ maxHeight: "calc(100vh - 420px)" }}>
                  {presetsLoading ? (
                    <div className="rounded-[14px] border border-white/10 bg-white/[0.03] px-3 py-3 text-[11px] opacity-55">
                      Loading presets...
                    </div>
                  ) : null}
                  {presets.map((preset) => {
                    const active = selectedPresetId === preset.id;
                    const runtimeActive = activeAppliedPresetId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleLoadPresetForPreview(preset)}
                        className="w-full rounded-[16px] px-3 py-3 text-left"
                        style={{
                          background: active ? `${appearance.theme.palette.accent}14` : "rgba(255,255,255,0.03)",
                          border: `1px solid ${
                            active ? `${appearance.theme.palette.accent}55` : "rgba(255,255,255,0.08)"
                          }`,
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-[11px] font-semibold uppercase tracking-[0.12em]">
                              {preset.name}
                            </div>
                            <div className="mt-1 line-clamp-2 text-[10px] leading-4 opacity-55">
                              {preset.description}
                            </div>
                          </div>
                          {runtimeActive ? (
                            <span
                              className="rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em]"
                              style={{
                                background: `${appearance.theme.palette.accent}22`,
                                color: appearance.theme.palette.accent,
                              }}
                            >
                              Runtime
                            </span>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_420px] gap-4">
              <div className="min-h-0 rounded-[28px] border border-white/10 bg-black/15 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      window.dispatchEvent(new CustomEvent(LOOKDEV_COMMAND_EVENT_OPEN))
                    }
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
                  >
                    <Sparkles size={11} />
                    Focus Lookdev
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      window.dispatchEvent(
                        new CustomEvent("greeblefs:open-explorer-customize"),
                      )
                    }
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
                  >
                    <LayoutGrid size={11} />
                    Explorer Customize
                  </button>
                  <button
                    type="button"
                    onClick={onToggleTopBarCustomize}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
                  >
                    <PanelTop size={11} />
                    Top Bar Customize
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenSettingsSection?.("context-menus")}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
                  >
                    <Puzzle size={11} />
                    Menu Composer
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      window.dispatchEvent(
                        new CustomEvent(LOOKDEV_COMMAND_EVENT_TOGGLE),
                      )
                    }
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
                  >
                    <Layers3 size={11} />
                    Toggle Overlay
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
                  <div className="rounded-[20px] border border-white/10 bg-black/20 p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-55">
                      Draft Identity
                    </div>
                    <div className="mt-3 space-y-3">
                      <label className="block">
                        <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] opacity-55">
                          Name
                        </div>
                        <input
                          value={presetName}
                          onChange={(event) => setPresetName(event.target.value)}
                          className="w-full rounded-[14px] border border-white/10 bg-white/[0.03] px-3 py-3 text-[13px] outline-none"
                          placeholder="Lookdev preset name"
                        />
                      </label>
                      <label className="block">
                        <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] opacity-55">
                          Description
                        </div>
                        <textarea
                          value={presetDescription}
                          onChange={(event) =>
                            setPresetDescription(event.target.value)
                          }
                          className="min-h-[92px] w-full rounded-[14px] border border-white/10 bg-white/[0.03] px-3 py-3 text-[12px] outline-none"
                          placeholder="Compact notes for this shell profile"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="rounded-[20px] border border-white/10 bg-black/20 p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-55">
                      Live Route
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                      <div className="rounded-[14px] border border-white/10 bg-white/[0.03] px-3 py-3">
                        <div className="opacity-50">Theme</div>
                        <div className="mt-1 font-semibold">
                          {appearanceSettings.activeThemeId}
                        </div>
                      </div>
                      <div className="rounded-[14px] border border-white/10 bg-white/[0.03] px-3 py-3">
                        <div className="opacity-50">Top Bar</div>
                        <div className="mt-1 font-semibold">
                          {appearanceSettings.activeTopBarId ?? "none"}
                        </div>
                      </div>
                      <div className="rounded-[14px] border border-white/10 bg-white/[0.03] px-3 py-3">
                        <div className="opacity-50">Menu Pack</div>
                        <div className="mt-1 font-semibold">
                          {explorerSettings.activeMenuPackId ?? "none"}
                        </div>
                      </div>
                      <div className="rounded-[14px] border border-white/10 bg-white/[0.03] px-3 py-3">
                        <div className="opacity-50">Dock</div>
                        <div className="mt-1 font-semibold">
                          {dockSettings.activePresentationId ?? "none"}
                        </div>
                      </div>
                    </div>
                    {statusMessage ? (
                      <div
                        className="mt-3 rounded-[14px] border px-3 py-2 text-[11px]"
                        style={{
                          borderColor: `${appearance.theme.palette.accent}44`,
                          background: `${appearance.theme.palette.accent}10`,
                          color: appearance.theme.palette.textPrimary,
                        }}
                      >
                        {statusMessage}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 rounded-[20px] border border-white/10 bg-black/20 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleSavePreset()}
                      className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                      style={{
                        background: `${appearance.theme.palette.accent}18`,
                        border: `1px solid ${appearance.theme.palette.accent}55`,
                        color: appearance.theme.palette.accent,
                      }}
                    >
                      <Save size={11} />
                      Save Preset
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleApplySession()}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                    >
                      <Sparkles size={11} />
                      Apply To Profile
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleExportThemeAssets()}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                    >
                      <Palette size={11} />
                      Export Theme Assets
                    </button>
                    <button
                      type="button"
                      disabled={!selectedPreset}
                      onClick={() => handleApplySelectedPresetRuntime()}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] disabled:opacity-40"
                    >
                      <Layers3 size={11} />
                      Apply Runtime Preset
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCancelSession()}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                    >
                      <X size={11} />
                      Cancel
                    </button>
                  </div>
                </div>
              </div>

              <div className="min-h-0 rounded-[28px] border border-white/10 bg-black/25 p-3">
                <div className="flex items-center justify-between gap-3 px-2 pb-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-55">
                      Inspector
                    </div>
                    <div className="mt-1 text-[11px] opacity-60">
                      {activeLens === "menus-actions"
                        ? "Use existing composer and customize seams from here."
                        : "Live controls write through the same settings-backed lanes the shell already uses."}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => void onRefreshThemes()}
                      className="rounded-full border border-white/10 p-2 opacity-70 hover:opacity-100"
                      title="Refresh themes"
                    >
                      <RefreshCw size={11} />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!isTauri()) {
                          return;
                        }
                        const directory = getManagedContentDirectory("lookdevPresets");
                        await mkdir(directory, { recursive: true });
                        await openExplorerPath(directory);
                      }}
                      className="rounded-full border border-white/10 p-2 opacity-70 hover:opacity-100"
                      title="Open lookdev presets folder"
                    >
                      <FolderOpen size={11} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenSettingsSection?.("appearance")}
                      className="rounded-full border border-white/10 p-2 opacity-70 hover:opacity-100"
                      title="Open appearance settings"
                    >
                      <ExternalLink size={11} />
                    </button>
                  </div>
                </div>
                <div
                  ref={paneHostRef}
                  className="h-full min-h-0 overflow-y-auto rounded-[20px] border border-white/10 bg-black/15 p-2"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
