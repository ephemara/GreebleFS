import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Bot, Camera, Cpu, Database, Download, FolderOpen, getPanelIconSlotId, GitBranch, HardDrive, Home, Image, LayoutGrid, Loader2, MonitorPlay, Music, Palette, Plus, Puzzle, RefreshCw, RotateCcw, Search, Settings2, SlidersHorizontal, Sparkles, StickyNote, TerminalSquare, ThemedPanelIcon, Trash2, Type, VolumeX } from '@/components/AppIcons';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useShallow } from 'zustand/react/shallow';
import type { LoadedOverlayAnimation } from './animationRuntime';
import { getOverlayWallpaperKindLabel, type LoadedOverlayWallpaper } from './wallpaperRuntime';
import {
  normalizeShaderControlValue,
  resolveShaderComputedUniforms,
  resolveShaderControlValues,
  type LoadedOverlayShader,
  type OverlayShaderControlDefinition,
  type OverlayShaderShellContext,
} from './shaderRuntime';
import {
  ensureFontFamilyLoaded,
  getThemeSourceLabel,
  overlayFontCatalog,
  overlayThemePresets,
  parseImportedTheme,
  serializeTheme,
  upsertCustomTheme,
  type OverlayThemeDefinition,
  type ResolvedOverlayAppearance,
} from '../config/appearance';
import {
  createDefaultDirectoryBookmarks,
  detectClientPlatform,
  getExternalTerminalProfileOptions,
  type ExternalTerminalProfile,
} from '../config/platform';
import {
  getGpuTierModeLabel,
  gpuRuntimeTierOptions,
} from '../config/gpuRuntime';
import {
  accelerationRoutingModeOptions,
  accelerationWorkloadCatalog,
  getAccelerationRoutingModeLabel,
  resolveAccelerationProviderForWorkload,
} from '../config/accelerationRuntime';
import { createPythonRuntimeConfig } from '../config/python';
import {
  formatLocalModelEstimatedFootprint,
  getCapabilityModels,
  getLocalModelCapabilityDefinition,
  getLocalModelDefinition,
  getLocalModelDefinitionByProviderModelId,
  getLocalModelHardwareProfile,
  localModelBackendOptions,
  localModelCapabilityCatalog,
  localModelDefinitions,
  normalizeLocalModelBackendPreference,
  semanticIndexingCapabilityId,
  type LocalModelBackendPreference,
} from '../config/localModels';
import {
  beginCloudAuth,
  clearCloudProviderConfiguration,
  disconnectCloudAccount,
  createExplorerDir,
  getExplorerDrives,
  getExplorerHomeDir,
  listCloudAccounts,
  listExplorerSavedSearches,
  listExplorerDir,
  openExplorerPath,
  pollCloudAuth,
  setCloudProviderConfiguration,
  type ExplorerDriveInfo,
  type ExplorerSavedSearch,
  type ExplorerCloudAccountSummary,
  type ExplorerCloudAccountsSnapshot,
  type ExplorerCloudProviderConfigurationSource,
  type ExplorerCloudProviderId,
} from '../runtime/explorerBackend';
import {
  createDefaultFolderIconRules,
  FOLDER_ICON_OPTIONS,
  getNamedFolderIconSrc,
  normalizeFolderIconMatcher,
  type FolderIconRule,
  type FolderIconValue,
} from '../config/folderIcons';
import {
  explorerViewModes,
  getExplorerViewModeDefinition,
} from '../config/explorerViewModes';
import { clampVideoHoverScrubFrameCount } from '../config/explorerThumbnails';
import {
  BUILT_IN_EXPLORER_CONTEXT_MENU_ITEMS,
  buildExplorerContextMenuOverrideMap,
  createLegacyExplorerActionContextMenuContributions,
  isExplorerContextMenuItemEnabled,
  moveExplorerContextMenuItem,
  normalizePluginContextMenuContributions,
  sortExplorerContextMenuItems,
  withExplorerContextMenuItemEnabled,
} from '../config/explorerContextMenu';
import { getBuiltInIconTheme, resolveFileIconSrc } from '../config/iconTheme';
import { animationSystemConfig, resolvePreferredAnimationId } from '../config/animations';
import {
  clampInteractionMotionIntensity,
  formatInteractionMotionModifierControlValue,
  getInteractionMotionProfileModifierControls,
  interactionMotionModuleCatalog,
  interactionMotionPresetOptions,
  interactionMotionSurfaceCatalog,
  normalizeInteractionMotionModuleOverride,
  normalizeInteractionMotionPresetId,
  resolveInteractionMotionModifierValues,
  resolveInteractionMotionModuleProfileId,
} from '../config/interactionMotion';
import {
  getOverlayWallpaperFitModeLabel,
  overlayWallpaperFitModes,
  wallpaperSystemConfig,
} from '../config/wallpapers';
import {
  getManagedContentDirectory,
  managedContentDirectoryCatalog,
  type ManagedContentDirectoryId,
} from '../config/appContentDirectories';
import {
  settingsSectionCatalog,
  type SettingsSectionKey,
} from '../config/settingsNavigation';
import { OverlayScrollArea } from './OverlayScrollArea';
import { ResizablePane, usePersistentPanelSize } from './ResizablePane';
import { InteractionMotionLab } from '../animation/MotionLab';
import { useInteractionMotionController, type InteractionMotionBinding } from '../animation/interactionMotion';
import {
  BUILT_IN_LAYOUT_MANIFEST,
  loadExternalLayoutManifest,
  resolveLayoutProfile,
  type LoadedLayoutManifest,
} from '../config/layoutProfiles';
import type { LoadedOverlayThemePackage } from '../config/themePackages';
import type { LoadedOverlayTopBarPackage } from '../config/topBarPackages';
import type { LoadedExplorerHomePack } from '../config/homePackages';
import {
  iconThemeSystemConfig,
  normalizeIconThemePackageSelectionId,
  resolveLoadedIconThemePackage,
  type LoadedIconThemePackage,
} from '../config/iconThemePackages';
import {
  createExplorerHomeHost,
  createExplorerHomeLaunchpadItems,
  createExplorerHomeQuickAccessItems,
  resolveExplorerHomePackSelection,
} from './home/ExplorerHomeSurface';
import type { ExplorerHomeBookmarkItem, ExplorerHomeUsageEntry } from './home/homePackRuntime';
import {
  getTopBarControlLabel,
  getTopBarNavigationModeLabel,
  getTopBarSourceLabel,
  getTopBarStyleLabel,
  resolveActiveTopBarSelection,
  type LoadedOverlayTopBarDefinition,
} from '../config/topBars';
import {
  getOverlayShaderSurfaceLabel,
  getShaderEnabledSurfaceIds,
  getShaderPerformanceProfile,
  resolvePreferredShaderId,
  shaderPerformanceProfiles,
} from '../config/shaders';
import {
  clampOverlayAnimationDuration,
  clampOverlayAnimationIntensity,
} from '../config/overlayAnimations';
import {
  clampOverlayVisualControlValue,
  formatOverlayVisualControlValue,
  overlayVisualControls,
} from '../config/overlayWindow';
import {
  loadExplorerPerformanceSnapshot,
  summarizeExplorerPerformance,
} from '../config/performanceTelemetry';
import {
  formatHotkeyLabel,
  getHotkeyBindingDefinition,
  hotkeyBindingDefinitions,
  normalizeKeybindingValue,
  type HotkeyBindingKey,
} from '../config/hotkeys';
import { screenshotFeatureConfig, type ScreenshotCaptureModeId, type ScreenshotOutputActionId } from '../config/screenshots';
import type {
  OverlayPluginContextMenuContribution,
  OverlayPluginExplorerActionContribution,
} from '../config/pluginContributions';
import { useSettingsStore, resolveSystemPresentationState, type TerminalWindowMode } from '../store/settingsStore';
import { useExplorerStore } from '../store/explorerStore';
import { useExplorerTaskSnapshots } from '../store/explorerTaskStore';
import {
  refreshAccelerationRuntimeStatus,
  useAccelerationRuntimeStore,
} from '../store/accelerationRuntimeStore';
import { useGpuRuntimeStore } from '../store/gpuRuntimeStore';
import { useTerminalStore } from '../store/terminalStore';
import {
  commands,
  unwrapTauriResult,
  type LinuxDisplayBackendPreference,
  type LinuxDisplayBackendStatus,
} from '../runtime/tauriClient';
import {
  clearTelemetrySessions,
  exportTelemetrySupportBundle,
  getTelemetryStatus,
  type OverlayTelemetrySessionStatus,
} from '../runtime/telemetryBackend';
import {
  getLocalModelCatalogStatus,
  prewarmLocalModel,
  type LocalModelCatalogStatus,
} from '../runtime/modelManagementBackend';
import {
  clearExplorerHomeUsage,
  listExplorerHomeUsage,
  type ExplorerHomeUsageSnapshotValue,
} from '../runtime/homeBackend';

function ThemeBadge({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <span
      className="rounded px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em]"
      style={{
        border: `1px solid ${active ? 'currentColor' : 'var(--overlay-workbench-settings-badge-border)'}`,
        background: active ? 'var(--overlay-workbench-chrome-button-active-bg)' : 'var(--overlay-workbench-settings-badge-bg)',
      }}
    >
      {label}
    </span>
  );
}

function getThemePreviewBackground(
  theme: OverlayThemeDefinition,
  previewUrl?: string,
): string {
  if (previewUrl) {
    return [
      'linear-gradient(180deg, rgba(5,10,18,0.1) 0%, rgba(5,10,18,0.72) 100%)',
      `url("${previewUrl}")`,
    ].join(', ');
  }

  return [
    `radial-gradient(circle at 18% 20%, ${theme.palette.accentSoft || `${theme.palette.accent}33`}, transparent 28%)`,
    `linear-gradient(135deg, ${theme.palette.appBackgroundAlt} 0%, ${theme.palette.appBackground} 52%, ${theme.palette.panelBackground} 100%)`,
  ].join(', ');
}

function clampThemeDescription(text: string | undefined): string | null {
  const trimmed = text?.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.length > 120 ? `${trimmed.slice(0, 117)}...` : trimmed;
}

function getThemePackageSourceBadgeLabel(sourceKind: LoadedOverlayThemePackage['sourceKind']): string {
  return sourceKind === 'plugin-package' ? 'Plugin Package' : 'Theme Folder';
}

type ThemeCatalogSectionId = 'official-pilot' | 'built-in' | 'legacy-archive';

function resolveThemeCatalogSectionId(
  theme: OverlayThemeDefinition,
  packageInfo: LoadedOverlayThemePackage | undefined,
): ThemeCatalogSectionId {
  if (theme.source === 'built-in') {
    return 'built-in';
  }

  if (packageInfo?.catalog.isOfficialPilot) {
    return 'official-pilot';
  }

  return 'legacy-archive';
}

function getThemeCatalogBadgeLabel(
  sectionId: ThemeCatalogSectionId,
  packageInfo: LoadedOverlayThemePackage | undefined,
): string {
  if (sectionId === 'built-in') {
    return 'Built-In';
  }

  return packageInfo?.catalog.badgeLabel ?? 'Package';
}

function getThemeCatalogSectionTitle(sectionId: ThemeCatalogSectionId): string {
  switch (sectionId) {
    case 'official-pilot':
      return 'Official Pilot Suite';
    case 'built-in':
      return 'Built-In Baselines';
    case 'legacy-archive':
      return 'Legacy / Lab Archive';
  }
}

function getThemeCatalogSectionSubtitle(sectionId: ThemeCatalogSectionId): string {
  switch (sectionId) {
    case 'official-pilot':
      return 'The current pilot set. These are the front-of-house themes that should feel full-screen, readable, and intentional.';
    case 'built-in':
      return 'Bundled baseline themes stay visible and supported as stable defaults for the app and dock.';
    case 'legacy-archive':
      return 'Older experiments, transitional shells, and archive material remain selectable without reading like the primary product.';
  }
}

function getThemeCatalogEntrySortRank(packageInfo: LoadedOverlayThemePackage | undefined): number {
  return packageInfo?.catalog.sortRank ?? 0;
}

function getThemeCatalogCardOpacity(sectionId: ThemeCatalogSectionId): number {
  if (sectionId === 'legacy-archive') {
    return 0.82;
  }

  if (sectionId === 'built-in') {
    return 0.96;
  }

  return 1;
}

function ThemeCatalogCard({
  themeOption,
  packageInfo,
  active,
  sectionId,
  onSelect,
  motionBinding,
}: {
  themeOption: OverlayThemeDefinition;
  packageInfo: LoadedOverlayThemePackage | undefined;
  active: boolean;
  sectionId: ThemeCatalogSectionId;
  onSelect: (themeId: string) => void;
  motionBinding?: InteractionMotionBinding;
}) {
  const description = clampThemeDescription(packageInfo?.description ?? themeOption.description);
  const previewBackground = getThemePreviewBackground(themeOption, packageInfo?.previewUrl);
  const compiledEngineManifest = packageInfo?.compiledEngineManifest;
  const defaultLayoutPrimitive = compiledEngineManifest?.defaultLayoutPrimitive;
  const defaultNavigationPattern = compiledEngineManifest?.defaultNavigationPattern;
  const defaultAnimationProfile = compiledEngineManifest?.defaultAnimationProfile;
  const defaultIconPack = compiledEngineManifest?.defaultIconPack;
  const defaultRenderStyle = compiledEngineManifest?.defaultRenderStyle;
  const workbenchPreset = themeOption.workbench?.preset;
  const explorerPreset = themeOption.explorer?.preset;
  const dockPreset = themeOption.dock?.workbench?.preset ?? themeOption.dock?.explorer?.preset ?? null;
  const capabilityLabels = [
    workbenchPreset ? `Workbench ${workbenchPreset}` : null,
    explorerPreset ? `Explorer ${explorerPreset}` : null,
    dockPreset ? `Dock ${dockPreset}` : null,
    (themeOption.dock?.workbench || themeOption.dock?.explorer) ? 'Dock Ready' : null,
    packageInfo?.capabilitySummary.icons ? 'Icons' : null,
    packageInfo?.capabilitySummary.shaders ? `Shaders ${packageInfo.capabilitySummary.shaders}` : null,
    packageInfo?.capabilitySummary.animations ? `Motion ${packageInfo.capabilitySummary.animations}` : null,
    packageInfo?.capabilitySummary.visuals ? `Visuals ${packageInfo.capabilitySummary.visuals}` : null,
    compiledEngineManifest?.capabilitySummary.designTokens ? `Tokens ${compiledEngineManifest.capabilitySummary.designTokens}` : null,
    packageInfo?.capabilitySummary.themeRenderer ? 'Renderer V2' : null,
  ].filter((value): value is string => Boolean(value)).slice(0, 10);

  return (
    <button
      type="button"
      data-theme-catalog-theme-id={themeOption.id}
      onClick={() => onSelect(themeOption.id)}
      className="overflow-hidden rounded text-left transition-opacity hover:opacity-100"
      {...motionBinding?.motionDataAttributes}
      onPointerEnter={motionBinding?.onPointerEnter}
      onPointerLeave={motionBinding?.onPointerLeave}
      onPointerDown={motionBinding?.onPointerDown}
      onPointerUp={motionBinding?.onPointerUp}
      onPointerCancel={motionBinding?.onPointerCancel}
      style={{
        opacity: getThemeCatalogCardOpacity(sectionId),
        background: themeOption.palette.appBackground,
        border: `1px solid ${active ? themeOption.palette.accent : themeOption.palette.border}`,
        color: themeOption.palette.textPrimary,
        boxShadow: active ? `0 0 0 1px ${themeOption.palette.accent}40 inset` : 'none',
        ...motionBinding?.motionStyle,
      }}
    >
      <div
        className="relative w-full"
        style={{
          minHeight: sectionId === 'official-pilot' ? '11rem' : '6.75rem',
          backgroundImage: previewBackground,
          backgroundSize: packageInfo?.previewUrl ? 'cover' : '100% 100%',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2">
          <div className="flex flex-wrap items-center gap-1">
            <ThemeBadge label={getThemeSourceLabel(themeOption)} active={active} />
            {packageInfo ? <ThemeBadge label={getThemePackageSourceBadgeLabel(packageInfo.sourceKind)} active={active} /> : null}
            <ThemeBadge label={getThemeCatalogBadgeLabel(sectionId, packageInfo)} active={active} />
          </div>
          {packageInfo ? (
            <div className="flex items-center gap-1">
              {packageInfo?.warnings.length ? <ThemeBadge label={`Warnings ${packageInfo.warnings.length}`} /> : null}
              <ThemeBadge label={`v${packageInfo.version}`} active={active} />
              {packageInfo.author ? <ThemeBadge label={packageInfo.author} /> : null}
            </div>
          ) : null}
        </div>
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: themeOption.palette.accent }} />
            <div className="truncate text-[11px] font-semibold">{themeOption.name}</div>
          </div>
          {active && <span className="text-[9px] font-semibold uppercase tracking-[0.12em] opacity-75">Live</span>}
        </div>
      </div>
      <div className={sectionId === 'legacy-archive' ? 'space-y-2 px-3 py-2.5' : 'space-y-2 px-3 py-3'}>
        <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.12em] opacity-55">
          <span>{themeOption.id}</span>
          {packageInfo?.sourceLabel ? (
            <>
              <span aria-hidden="true">•</span>
              <span>{packageInfo.sourceLabel}</span>
            </>
          ) : null}
          {packageInfo?.homepage ? <span>• {packageInfo.homepage.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span> : null}
        </div>
        {description ? (
          <p className={sectionId === 'official-pilot' ? 'min-h-[3rem] text-[11px] leading-4 opacity-75' : 'min-h-[2.5rem] text-[11px] leading-4 opacity-70'}>
            {description}
          </p>
        ) : (
          <p className="min-h-[2.5rem] text-[11px] leading-4 opacity-35">No package summary provided yet.</p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {defaultLayoutPrimitive ? <ThemeBadge label={`Layout ${defaultLayoutPrimitive.kind}`} active={active} /> : null}
          {defaultNavigationPattern ? <ThemeBadge label={`Nav ${defaultNavigationPattern.kind}`} active={active} /> : null}
          {defaultIconPack ? <ThemeBadge label={`Icons ${defaultIconPack.style}`} active={active} /> : null}
          {defaultRenderStyle ? <ThemeBadge label={`Render ${defaultRenderStyle.kind}`} active={active} /> : null}
          {compiledEngineManifest?.supportsHotSwappingRenderStyles
            ? <ThemeBadge label="Live Swap Ready" active={active} />
            : compiledEngineManifest
              ? <ThemeBadge label="Static Render" active={active} />
              : null}
          {themeOption.defaultShaderId ? <ThemeBadge label={`Shader ${themeOption.defaultShaderId}`} active={active} /> : null}
          {themeOption.defaultOpenAnimationId ? <ThemeBadge label={`Open ${themeOption.defaultOpenAnimationId}`} active={active} /> : null}
          {themeOption.defaultCloseAnimationId ? <ThemeBadge label={`Close ${themeOption.defaultCloseAnimationId}`} active={active} /> : null}
          {defaultAnimationProfile ? <ThemeBadge label={`Profile ${defaultAnimationProfile.id}`} active={active} /> : null}
          {capabilityLabels.map(label => (
            <ThemeBadge key={`${themeOption.id}-${label}`} label={label} />
          ))}
          {(packageInfo?.tags ?? []).slice(0, 3).map(tag => (
            <ThemeBadge key={`${themeOption.id}-tag-${tag}`} label={tag} />
          ))}
        </div>
        {packageInfo?.warnings.length ? (
          <div className="rounded border px-2.5 py-2 text-[10px] leading-4" style={{ borderColor: 'rgba(245,158,11,0.32)', background: 'rgba(245,158,11,0.12)', color: '#fde68a' }}>
            {packageInfo.warnings.map(warning => (
              <div key={`${themeOption.id}-${warning}`}>{warning}</div>
            ))}
          </div>
        ) : null}
      </div>
    </button>
  );
}

function ThemeCatalogSection({
  sectionId,
  themes,
  activeThemeId,
  onSelect,
  themePackageLookup,
  createThemeCardMotion,
}: {
  sectionId: ThemeCatalogSectionId;
  themes: OverlayThemeDefinition[];
  activeThemeId: string | null;
  onSelect: (themeId: string) => void;
  themePackageLookup: Map<string, LoadedOverlayThemePackage>;
  createThemeCardMotion?: (active: boolean) => InteractionMotionBinding;
}) {
  if (themes.length === 0) {
    return null;
  }

  const isOfficialSuite = sectionId === 'official-pilot';
  const sectionStyle = sectionId === 'official-pilot'
    ? {
      borderColor: 'rgba(125,211,255,0.34)',
      background: 'linear-gradient(180deg, rgba(16,22,34,0.94) 0%, rgba(10,14,24,0.98) 100%)',
    }
    : sectionId === 'built-in'
      ? {
        borderColor: 'rgba(255,255,255,0.12)',
        background: 'rgba(255,255,255,0.03)',
      }
      : {
        borderColor: 'rgba(148,163,184,0.18)',
        background: 'rgba(255,255,255,0.018)',
        opacity: 0.92,
      };

  const sortedThemes = [...themes].sort((left, right) => {
    const leftPackageInfo = themePackageLookup.get(left.id);
    const rightPackageInfo = themePackageLookup.get(right.id);
    const leftWeight = getThemeCatalogEntrySortRank(leftPackageInfo);
    const rightWeight = getThemeCatalogEntrySortRank(rightPackageInfo);
    if (leftWeight !== rightWeight) {
      return leftWeight - rightWeight;
    }
    return left.name.localeCompare(right.name);
  });

  return (
    <section
      data-theme-catalog-group={sectionId}
      className="rounded border p-3"
      style={sectionStyle}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] opacity-65">
            {isOfficialSuite ? <Sparkles size={11} /> : <LayoutGrid size={11} />}
            <span>{getThemeCatalogSectionTitle(sectionId)}</span>
          </div>
          <p className="mt-1 text-[11px] leading-4 opacity-48">
            {getThemeCatalogSectionSubtitle(sectionId)}
          </p>
        </div>
        <ThemeBadge label={`${themes.length} theme${themes.length === 1 ? '' : 's'}`} active={isOfficialSuite} />
      </div>
      <div className={isOfficialSuite ? 'grid grid-cols-1 gap-4 xl:grid-cols-2' : 'grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3'}>
        {sortedThemes.map((themeOption, index) => {
          const packageInfo = themePackageLookup.get(themeOption.id);
          const active = activeThemeId === themeOption.id;
          const themeSectionId = resolveThemeCatalogSectionId(themeOption, packageInfo);

          return (
            <ThemeCatalogCard
              key={getThemeCatalogEntryKey(themeOption, packageInfo, index)}
              themeOption={themeOption}
              packageInfo={packageInfo}
              active={active}
              sectionId={themeSectionId}
              onSelect={onSelect}
              motionBinding={createThemeCardMotion?.(active)}
            />
          );
        })}
      </div>
    </section>
  );
}

function getThemeCatalogEntryKey(
  theme: OverlayThemeDefinition,
  packageInfo: LoadedOverlayThemePackage | undefined,
  index: number,
): string {
  const sourceKind = packageInfo?.sourceKind ?? theme.source ?? 'built-in';
  const sourceLabel = packageInfo?.sourceLabel ?? packageInfo?.directoryPath ?? 'catalog';
  return `${theme.id}:${sourceKind}:${sourceLabel}:${index}`;
}

function ThemeCatalogGrid({
  themes,
  activeThemeId,
  onSelect,
  themePackageLookup,
  createThemeCardMotion,
}: {
  themes: OverlayThemeDefinition[];
  activeThemeId: string | null;
  onSelect: (themeId: string) => void;
  themePackageLookup: Map<string, LoadedOverlayThemePackage>;
  createThemeCardMotion?: (active: boolean) => InteractionMotionBinding;
}) {
  const catalogSections = useMemo(() => {
    const groupedThemes: Record<ThemeCatalogSectionId, OverlayThemeDefinition[]> = {
      'official-pilot': [],
      'built-in': [],
      'legacy-archive': [],
    };

    themes.forEach(themeOption => {
      const packageInfo = themePackageLookup.get(themeOption.id);
      const sectionId = resolveThemeCatalogSectionId(themeOption, packageInfo);
      groupedThemes[sectionId].push(themeOption);
    });

    return (['official-pilot', 'built-in', 'legacy-archive'] as const).map(sectionId => ({
      sectionId,
      themes: groupedThemes[sectionId],
    }));
  }, [themes, themePackageLookup]);

  return (
    <div className="space-y-4">
      {catalogSections.map(section => (
        <ThemeCatalogSection
          key={section.sectionId}
          sectionId={section.sectionId}
          themes={section.themes}
          activeThemeId={activeThemeId}
          onSelect={onSelect}
          themePackageLookup={themePackageLookup}
          createThemeCardMotion={createThemeCardMotion}
        />
      ))}
    </div>
  );
}

function summarizeTopBarControls(topBar: LoadedOverlayTopBarDefinition): string {
  const prioritizedControls = [
    ...topBar.navigationShortcuts,
    ...topBar.leadingControls,
    ...topBar.trailingControls,
  ];

  const labels = Array.from(new Set(
    prioritizedControls.map(controlId => getTopBarControlLabel(controlId)),
  ));

  return labels.slice(0, 4).join(' · ');
}

function TopBarCatalogCard({
  topBar,
  active,
  border,
  accent,
  text,
  muted,
  onClick,
}: {
  topBar: LoadedOverlayTopBarDefinition;
  active: boolean;
  border: string;
  accent: string;
  text: string;
  muted: string;
  onClick: () => void;
}) {
  const controlSummary = summarizeTopBarControls(topBar);

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded border p-3 text-left transition-colors"
      style={{
        borderColor: active ? accent : border,
        background: active ? `${accent}12` : 'rgba(255,255,255,0.03)',
        color: text,
        boxShadow: active ? `inset 0 0 0 1px ${accent}22` : 'none',
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold">{topBar.name}</div>
          <div className="mt-1 text-[11px] leading-4 opacity-55">{topBar.description}</div>
        </div>
        {active ? <ThemeBadge label="Pinned" active /> : null}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <ThemeBadge label={getTopBarSourceLabel(topBar.source)} active={active} />
        <ThemeBadge label={getTopBarStyleLabel(topBar.topBarStyle)} active={active} />
        <ThemeBadge label={getTopBarNavigationModeLabel(topBar.navigationMode)} active={active} />
        {topBar.tags.slice(0, 2).map(tag => (
          <ThemeBadge key={`${topBar.id}-${tag}`} label={tag} />
        ))}
      </div>
      {controlSummary ? (
        <div className="mt-3 text-[10px] uppercase tracking-[0.12em]" style={{ color: active ? accent : muted }}>
          {controlSummary}
        </div>
      ) : null}
    </button>
  );
}

function ColorToken({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex flex-col gap-1 rounded border p-2" style={{ borderColor: 'var(--overlay-workbench-settings-card-border)', background: 'var(--overlay-workbench-settings-card-bg)' }}>
      <span className="text-[9px] font-semibold uppercase tracking-wide opacity-50">{label}</span>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={event => onChange(event.target.value)} className="h-7 w-9 rounded border-0 bg-transparent p-0" />
        <input
          value={value}
          onChange={event => onChange(event.target.value)}
          className="w-full bg-transparent text-[10px] outline-none"
        />
      </div>
    </label>
  );
}

function SectionTitle({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] opacity-60">
          {icon}
          <span>{title}</span>
        </div>
        <p className="mt-0.5 text-[10px] leading-4 opacity-40">{subtitle}</p>
      </div>
    </div>
  );
}

type RgbColor = { r: number; g: number; b: number };

function parseCssColorToRgb(color: string | undefined): RgbColor | null {
  const trimmed = color?.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('#')) {
    const hex = trimmed.slice(1);
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
      };
    }
    if (hex.length === 6 || hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
      };
    }
    return null;
  }

  const rgbMatch = trimmed.match(/^rgba?\(([^)]+)\)$/i);
  if (!rgbMatch) {
    return null;
  }

  const channels = rgbMatch[1]
    .split(',')
    .slice(0, 3)
    .map(channel => Number.parseFloat(channel.trim()));

  if (channels.length < 3 || channels.some(channel => Number.isNaN(channel))) {
    return null;
  }

  return {
    r: channels[0] ?? 0,
    g: channels[1] ?? 0,
    b: channels[2] ?? 0,
  };
}

function getRelativeColorLuminance(color: RgbColor): number {
  const normalize = (channel: number) => {
    const srgb = Math.max(0, Math.min(255, channel)) / 255;
    return srgb <= 0.04045
      ? srgb / 12.92
      : ((srgb + 0.055) / 1.055) ** 2.4;
  };

  return (0.2126 * normalize(color.r)) + (0.7152 * normalize(color.g)) + (0.0722 * normalize(color.b));
}

function resolveSettingsFormColorScheme(backgroundColor: string, textColor: string): 'light' | 'dark' {
  const backgroundRgb = parseCssColorToRgb(backgroundColor);
  if (backgroundRgb) {
    return getRelativeColorLuminance(backgroundRgb) < 0.42 ? 'dark' : 'light';
  }

  const textRgb = parseCssColorToRgb(textColor);
  if (textRgb) {
    return getRelativeColorLuminance(textRgb) > 0.58 ? 'dark' : 'light';
  }

  return 'dark';
}

function RangeField({
  label,
  description,
  min,
  max,
  step,
  value,
  valueLabel,
  onChange,
}: {
  label: string;
  description: string;
  min: number;
  max: number;
  step: number;
  value: number;
  valueLabel: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="rounded border p-3" style={{ borderColor: 'var(--overlay-workbench-settings-card-border)', background: 'var(--overlay-workbench-settings-card-bg)' }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">{label}</div>
          <p className="mt-1 text-[11px] opacity-40">{description}</p>
        </div>
        <span className="rounded border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] opacity-80">
          {valueLabel}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={event => onChange(parseFloat(event.target.value))}
        className="mt-3 w-full cursor-pointer"
      />
    </label>
  );
}

function formatShaderControlValue(control: OverlayShaderControlDefinition, value: number): string {
  if (control.formatValue) {
    return control.formatValue(value);
  }

  if (control.step >= 1) {
    return `${Math.round(value)}`;
  }

  const decimals = `${control.step}`.split('.')[1]?.length ?? 2;
  return value.toFixed(Math.min(decimals, 3));
}

function ShortcutField({
  bindingKey,
  value,
  onCommit,
}: {
  bindingKey: HotkeyBindingKey;
  value: string;
  onCommit: (value: string) => void;
}) {
  const definition = getHotkeyBindingDefinition(bindingKey);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = useCallback(() => {
    const normalized = normalizeKeybindingValue(draft, definition.defaultValue);
    setDraft(normalized);
    onCommit(normalized);
  }, [definition.defaultValue, draft, onCommit]);

  return (
    <label className="rounded border p-3" style={{ borderColor: 'var(--overlay-workbench-settings-card-border)', background: 'var(--overlay-workbench-settings-card-bg)' }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">{definition.label}</div>
          <p className="mt-1 text-[11px] opacity-40">{definition.description}</p>
        </div>
        <span className="rounded border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] opacity-80">
          {definition.scope}
        </span>
      </div>
      <input
        value={draft}
        onChange={event => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            setDraft(value);
          }
        }}
        className="mt-3 w-full rounded border px-3 py-2 text-[11px] outline-none"
        style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' }}
      />
      <div className="mt-2 flex items-center justify-between gap-3 text-[10px] opacity-45">
        <span>Live value: {formatHotkeyLabel(value)}</span>
        <button
          type="button"
          onClick={() => {
            setDraft(definition.defaultValue);
            onCommit(definition.defaultValue);
          }}
          className="rounded border px-2 py-1 font-semibold uppercase tracking-[0.14em]"
          style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' }}
        >
          Reset
        </button>
      </div>
    </label>
  );
}

function parseMatcherInput(value: string): string[] {
  return value
    .split(',')
    .map(part => normalizeFolderIconMatcher(part))
    .filter(Boolean);
}

function stringifyMatchers(matchers: string[]): string {
  return matchers.join(', ');
}

const DEFAULT_LOADED_LAYOUT_MANIFEST: LoadedLayoutManifest = {
  manifest: BUILT_IN_LAYOUT_MANIFEST,
  sourcePath: null,
  sourceType: 'built-in',
  sourceError: null,
};

function SettingsRailButton({
  active,
  icon,
  label,
  subtitle,
  summary,
  accent,
  border,
  text,
  muted,
  onClick,
  motionBinding,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  subtitle: string;
  summary: string;
  accent: string;
  border: string;
  text: string;
  muted: string;
  onClick: () => void;
  motionBinding?: InteractionMotionBinding;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={subtitle}
      className="w-full rounded px-2 py-2 text-left transition-colors"
      {...motionBinding?.motionDataAttributes}
      onPointerEnter={motionBinding?.onPointerEnter}
      onPointerLeave={motionBinding?.onPointerLeave}
      onPointerDown={motionBinding?.onPointerDown}
      onPointerUp={motionBinding?.onPointerUp}
      onPointerCancel={motionBinding?.onPointerCancel}
      style={{
        border: `1px solid ${active ? `${accent}88` : border}`,
        background: active ? 'var(--overlay-workbench-chrome-button-active-bg)' : 'var(--overlay-workbench-settings-rail-bg)',
        color: text,
        boxShadow: active ? `inset 0 0 0 1px ${accent}22` : 'none',
        ...motionBinding?.motionStyle,
      }}
    >
      <div className="flex items-center gap-2">
        <div
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded"
          style={{
            background: active ? 'var(--overlay-workbench-chrome-button-active-bg)' : 'var(--overlay-workbench-settings-badge-bg)',
            color: active ? accent : muted,
            border: `1px solid ${active ? `${accent}55` : 'var(--overlay-workbench-settings-badge-border)'}`,
          }}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.08em]">{label}</div>
          <div className="mt-0.5 text-[10px] leading-4" style={{ color: active ? accent : muted }}>
            {summary}
          </div>
        </div>
      </div>
    </button>
  );
}

function getSettingsSectionIcon(sectionKey: SettingsSectionKey): ReactNode {
  switch (sectionKey) {
    case 'overview':
      return <Sparkles size={14} />;
    case 'system':
      return <Settings2 size={14} />;
    case 'models':
      return <Bot size={14} />;
    case 'terminal':
      return <TerminalSquare size={14} />;
    case 'explorer':
      return <FolderOpen size={14} />;
    case 'home':
      return <Home size={14} />;
    case 'layouts':
      return <LayoutGrid size={14} />;
    case 'hotkeys':
      return <SlidersHorizontal size={14} />;
    case 'cloud':
      return <HardDrive size={14} />;
    case 'screenshots':
      return <Camera size={14} />;
    case 'audio':
      return <Music size={14} />;
    case 'appearance':
      return <Palette size={14} />;
    case 'top-bars':
      return <SlidersHorizontal size={14} />;
    case 'icons':
      return <Image size={14} />;
    case 'wallpapers':
      return <MonitorPlay size={14} />;
    case 'shaders':
      return <Sparkles size={14} />;
    case 'animations':
      return <RotateCcw size={14} />;
    case 'interaction-motion':
      return <Sparkles size={14} />;
    case 'theme-json':
      return <Type size={14} />;
  }

  return <Settings2 size={14} />;
}

interface SettingsSectionContentContext {
  effectiveThemeName: string;
  activeLayoutLabel: string;
  workspaceRootCount: number;
  installedModelCount: number;
  localModelCacheFootprint: string;
  semanticIndexModelSummary: string;
  launchAtStartup: boolean;
  systemPresentationState: ReturnType<typeof resolveSystemPresentationState>;
  platform: 'windows' | 'macos' | 'linux' | 'unknown';
  terminalWindowMode: TerminalWindowMode;
  terminalPreferredOpenMode: 'integrated' | 'external';
  terminalCursorStyle: string;
  explorerViewModeLabel: string;
  explorerFolderClickMode: 'single' | 'double';
  explorerThumbnailsEnabled: boolean;
  homePackSummary: string;
  layoutProfileCount: number;
  zenFocusMode: boolean;
  hotkeyLabels: string[];
  connectedCloudAccountCount: number;
  configuredCloudProviderCount: number;
  screenshotDefaultCaptureMode: ScreenshotCaptureModeId;
  screenshotDefaultOutputAction: ScreenshotOutputActionId;
  screenshotShowGrid: boolean;
  audioFolderCount: number;
  availableWallpapersCount: number;
  themeWallpaperAvailable: boolean;
  wallpaperFailureCount: number;
  availableShadersCount: number;
  shaderPerformanceLabel: string;
  shaderFailureCount: number;
  availableAnimationsCount: number;
  animationFailureCount: number;
  interactionMotionEnabled: boolean;
  interactionMotionProfileLabel: string;
  interactionMotionSurfaceCount: number;
  topBarSelectionSummary: string;
  availableTopBarsCount: number;
  followThemeTopBarDetail: string;
  iconThemeSelectionSummary: string;
  appOpacity: number;
  panelTransparency: number;
  appZoom: number;
  appBlurStrength: number;
}

function getSettingsSectionContent(
  sectionKey: SettingsSectionKey,
  context: SettingsSectionContentContext,
): { summary: string; detail: string } {
  switch (sectionKey) {
    case 'overview':
      return {
        summary: `${context.effectiveThemeName} · ${context.activeLayoutLabel} · ${context.workspaceRootCount} workspace roots`,
        detail: 'Orient new operators quickly: learn the panel handoff flow, jump into key settings areas, and open the authoring folders that define the release surface.',
      };
    case 'system':
      return {
        summary: [
          context.launchAtStartup ? 'Startup on' : 'Startup off',
          context.systemPresentationState.trayVisible ? 'Tray on' : 'Tray off',
          context.systemPresentationState.taskbarVisible ? 'Taskbar on' : 'Taskbar off',
        ].join(' · '),
        detail: `Handle machine-level behavior like login launch and the ${context.systemPresentationState.recoveryPath === 'tray' ? 'tray' : context.platform === 'macos' ? 'Dock' : 'taskbar'} recovery path in one place.`,
      };
    case 'models':
      return {
        summary: `${context.installedModelCount} installed · ${context.semanticIndexModelSummary} · ${context.localModelCacheFootprint}`,
        detail: 'Manage the shared local-model cache, prewarm curated models, and route semantic indexing plus future local inference lanes through explicit backend and model bindings.',
      };
    case 'terminal':
      return {
        summary: `${context.terminalWindowMode === 'windowed' ? 'application' : 'dock'} mode · ${context.terminalPreferredOpenMode} · ${context.terminalCursorStyle} cursor`,
        detail: 'Control the integrated terminal, its typography, and how commands hand off to external shells.',
      };
    case 'explorer':
      return {
        summary: `${context.explorerViewModeLabel} · ${context.explorerFolderClickMode === 'single' ? 'Single-click folders' : 'Double-click folders'} · ${context.explorerThumbnailsEnabled ? 'Rich thumbnails' : 'Icons only'}`,
        detail: 'Shape the file browser around your machine, including content-browser layout modes, folder activation behavior, and thumbnail policy without mixing in icon-pack management.',
      };
    case 'home':
      return {
        summary: context.homePackSummary,
        detail: 'Home is now an app-owned explorer surface with pack selection, preset routing, usage telemetry, and a dedicated runtime-authored customization lane.',
      };
    case 'layouts':
      return {
        summary: `${context.activeLayoutLabel} · ${context.layoutProfileCount} profiles · ${context.zenFocusMode ? 'Zen on' : 'Zen off'}`,
        detail: 'Switch between shell profiles, point at external manifests, and control the workbench shape at the layout level.',
      };
    case 'hotkeys':
      return {
        summary: context.hotkeyLabels.join(' · '),
        detail: 'Keep the overlay easy to summon, control shell presentation, and remap the primary focus toggles without digging through raw config.',
      };
    case 'cloud':
      return {
        summary: `${context.connectedCloudAccountCount} connected · ${context.configuredCloudProviderCount}/2 providers configured`,
        detail: 'Manage provider credentials from Settings or the runtime environment, keep account tokens off the settings store, and surface each connected account as an explorer drive.',
      };
    case 'screenshots':
      return {
        summary: `${context.screenshotDefaultCaptureMode === 'monitor' ? 'Full monitor default' : 'Area snip default'} · ${formatScreenshotOutputActionLabel(context.screenshotDefaultOutputAction)} · ${context.screenshotShowGrid ? 'Grid on' : 'Grid off'}`,
        detail: 'Set the default screenshot landing path and decide how the built-in capture tool behaves before and after a proof action.',
      };
    case 'audio':
      return {
        summary: `${context.audioFolderCount} user folders`,
        detail: 'Configure scan paths for audio integrations and DAW-like plugin discovery.',
      };
    case 'appearance':
      return {
        summary: `${context.effectiveThemeName} · ${formatOverlayVisualControlValue('opacity', context.appOpacity)} OP · ${formatOverlayVisualControlValue('panelTransparency', context.panelTransparency)} PT · ${formatOverlayVisualControlValue('zoom', context.appZoom)} ZM · ${formatOverlayVisualControlValue('blurStrength', context.appBlurStrength)} BL`,
        detail: 'Tune the shell look and feel, from engine-driven recipes and palette tokens to blur, transparency, UI typography, and the theme package catalog that can now contribute separate top bars.',
      };
    case 'top-bars':
      return {
        summary: `${context.topBarSelectionSummary} · ${context.availableTopBarsCount} variants`,
        detail: context.followThemeTopBarDetail,
      };
    case 'icons':
      return {
        summary: context.iconThemeSelectionSummary,
        detail: 'Choose a dedicated icon theme independently from the active shell theme, keep folder rules in one place, and decide when OS-native icons should still fill gaps.',
      };
    case 'wallpapers':
      return {
        summary: `${context.availableWallpapersCount} catalog items${context.themeWallpaperAvailable ? ' · theme default available' : ''}${context.wallpaperFailureCount > 0 ? ` · ${context.wallpaperFailureCount} errors` : ''}`,
        detail: 'Wallpapers stay in the theme system, can be overridden per user, and still render underneath shader and visual layers instead of replacing them.',
      };
    case 'shaders':
      return {
        summary: `${context.availableShadersCount} profiles · ${context.shaderPerformanceLabel}${context.shaderFailureCount > 0 ? ` · ${context.shaderFailureCount} errors` : ''}`,
        detail: `Default mode is ${context.shaderPerformanceLabel.toLowerCase()}, which keeps automatic theme shaders off until you explicitly choose a profile and keeps the live preview budgeted.`,
      };
    case 'animations':
      return {
        summary: `${context.availableAnimationsCount} modules${context.animationFailureCount > 0 ? ` · ${context.animationFailureCount} errors` : ''}`,
        detail: 'Browse built-in and authored animation modules, assign the live open/close bindings, and manage the animation authoring folder.',
      };
    case 'interaction-motion':
      return {
        summary: `${context.interactionMotionProfileLabel} · ${context.interactionMotionEnabled ? 'Live' : 'Disabled'} · ${context.interactionMotionSurfaceCount} surfaces`,
        detail: 'Control shell micro-interactions separately from window transitions, including presets, per-surface toggles, and the Motion Lab preview harness.',
      };
    case 'theme-json':
      return {
        summary: 'Direct JSON editing',
        detail: 'Paste, tweak, and version full theme definitions directly when the recipe controls and token pickers are not enough.',
      };
  }

  return {
    summary: String(sectionKey),
    detail: 'Configure this settings slice.',
  };
}

function formatScreenshotOutputActionLabel(action: ScreenshotOutputActionId): string {
  if (action === 'save-copy') {
    return 'Save + Copy';
  }

  return action === 'save' ? 'Save' : 'Copy';
}

function OverviewCard({
  title,
  subtitle,
  badges,
  children,
  motionBinding,
}: {
  title: string;
  subtitle: string;
  badges?: string[];
  children: ReactNode;
  motionBinding?: InteractionMotionBinding;
}) {
  return (
    <div
      className="rounded border p-3"
      {...motionBinding?.motionDataAttributes}
      onPointerEnter={motionBinding?.onPointerEnter}
      onPointerLeave={motionBinding?.onPointerLeave}
      onPointerDown={motionBinding?.onPointerDown}
      onPointerUp={motionBinding?.onPointerUp}
      onPointerCancel={motionBinding?.onPointerCancel}
      style={{
        borderColor: 'var(--overlay-workbench-settings-card-border)',
        background: 'var(--overlay-workbench-settings-card-bg)',
        ...motionBinding?.motionStyle,
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">{title}</div>
          <p className="mt-1 text-[11px] leading-4 opacity-45">{subtitle}</p>
        </div>
        {badges && badges.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1">
            {badges.map(badge => (
              <span
                key={badge}
                className="rounded border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em]"
                style={{ borderColor: 'var(--overlay-workbench-settings-badge-border)', background: 'var(--overlay-workbench-settings-badge-bg)' }}
              >
                {badge}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

const EMPTY_CLOUD_ACCOUNTS_SNAPSHOT: ExplorerCloudAccountsSnapshot = {
  accounts: [],
  providers: [],
};

const CLOUD_PROVIDER_IDS = ['google-drive', 'dropbox'] as const satisfies readonly ExplorerCloudProviderId[];
const DROPBOX_CALLBACK_URI = 'http://localhost:53682/callback';

type CloudProviderCredentialDraft = {
  clientId: string;
  clientSecret: string;
};

type CloudProviderCredentialDraftMap = Record<ExplorerCloudProviderId, CloudProviderCredentialDraft>;

function getCloudProviderLabel(provider: ExplorerCloudProviderId): string {
  return provider === 'google-drive' ? 'Google Drive' : 'Dropbox';
}

function createEmptyCloudProviderCredentialDrafts(): CloudProviderCredentialDraftMap {
  return {
    'google-drive': { clientId: '', clientSecret: '' },
    dropbox: { clientId: '', clientSecret: '' },
  };
}

function getCloudProviderConfigurationSourceLabel(
  source: ExplorerCloudProviderConfigurationSource,
): string {
  switch (source) {
    case 'settings':
      return 'Saved in Settings';
    case 'environment':
      return 'Runtime Environment';
    default:
      return 'Not Configured';
  }
}

function getHomeEntryLabel(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, '');
  if (!trimmed) {
    return 'Home';
  }

  const segments = trimmed.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] ?? trimmed;
}

function formatModelCacheBytes(bytes: number | null | undefined): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }

  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function formatModelTimestamp(epochMs: number | null | undefined): string {
  if (typeof epochMs !== 'number' || !Number.isFinite(epochMs) || epochMs <= 0) {
    return 'Not warmed yet';
  }

  return new Date(epochMs).toLocaleString();
}

function mapExplorerHomeUsageEntries(
  records: ExplorerHomeUsageSnapshotValue['mostUsed'],
): ExplorerHomeUsageEntry[] {
  return records.map((record: ExplorerHomeUsageSnapshotValue['mostUsed'][number]) => ({
    path: record.path,
    label: getHomeEntryLabel(record.path),
    openCount: record.openCount,
    lastOpenedAt: record.lastOpenedAt,
  }));
}

function mapExplorerHomeBookmarks(
  rail: ReturnType<typeof useExplorerStore.getState>['rail'],
): ExplorerHomeBookmarkItem[] {
  return rail.nodes
    .filter((node): node is typeof rail.nodes[number] & { kind: 'bookmark'; path: string } => node.kind === 'bookmark')
    .map((node) => ({
      id: node.id,
      label: node.name,
      path: node.path,
      color: node.color,
      categoryIds: node.categoryIds,
    }));
}


export function SettingsPage({
  appearance,
  topBarPackages,
  topBarPackagesDirectory,
  topBarPackagesLoading,
  topBarPackagesError,
  topBarPackagesWarnings,
  homePacks = [],
  homePacksDirectory = '',
  homePacksLoading = false,
  homePacksError = null,
  homePacksWarnings = [],
  themePackages,
  themePackagesDirectory,
  themePackagesLoading,
  themePackagesError,
  themePackagesWarnings,
  iconThemePackages = [],
  iconThemePackagesDirectory = iconThemeSystemConfig.iconThemesDirectory,
  iconThemePackagesLoading = false,
  iconThemePackagesError = null,
  iconThemePackagesWarnings = [],
  onRefreshTopBars,
  onOpenTopBarsFolder,
  onRefreshHomePacks = async () => { },
  onOpenHomePacksFolder = async () => { },
  onRefreshThemes,
  onOpenThemesFolder,
  onRefreshIconThemes = async () => { },
  onOpenIconThemesFolder = async () => { },
  shaders,
  shaderDiagnostics,
  shadersDirectory,
  shadersLoading,
  shadersError,
  onRefreshShaders,
  onOpenShadersFolder,
  animations,
  animationDiagnostics,
  animationsDirectory,
  animationsLoading,
  animationsError,
  onRefreshAnimations,
  onOpenAnimationsFolder,
  wallpapers,
  wallpaperDiagnostics,
  wallpapersDirectory,
  wallpapersLoading,
  wallpapersError,
  onRefreshWallpapers,
  onOpenWallpapersFolder,
  onImportWallpaperFiles,
  onSetWindowMode,
  pluginContextMenuItems = [],
  pluginExplorerActions = [],
}: {
  appearance: ResolvedOverlayAppearance;
  topBarPackages: LoadedOverlayTopBarPackage[];
  topBarPackagesDirectory: string;
  topBarPackagesLoading: boolean;
  topBarPackagesError: string | null;
  topBarPackagesWarnings: string[];
  homePacks?: LoadedExplorerHomePack[];
  homePacksDirectory?: string;
  homePacksLoading?: boolean;
  homePacksError?: string | null;
  homePacksWarnings?: string[];
  themePackages: LoadedOverlayThemePackage[];
  themePackagesDirectory: string;
  themePackagesLoading: boolean;
  themePackagesError: string | null;
  themePackagesWarnings: string[];
  iconThemePackages?: LoadedIconThemePackage[];
  iconThemePackagesDirectory?: string;
  iconThemePackagesLoading?: boolean;
  iconThemePackagesError?: string | null;
  iconThemePackagesWarnings?: string[];
  onRefreshTopBars: () => Promise<void>;
  onOpenTopBarsFolder: () => Promise<void>;
  onRefreshHomePacks?: () => Promise<void>;
  onOpenHomePacksFolder?: () => Promise<void>;
  onRefreshThemes: () => Promise<void>;
  onOpenThemesFolder: () => Promise<void>;
  onRefreshIconThemes?: () => Promise<void>;
  onOpenIconThemesFolder?: () => Promise<void>;
  shaders: LoadedOverlayShader[];
  shaderDiagnostics: LoadedOverlayShader[];
  shadersDirectory: string;
  shadersLoading: boolean;
  shadersError: string | null;
  onRefreshShaders: () => Promise<void>;
  onOpenShadersFolder: () => Promise<void>;
  animations: LoadedOverlayAnimation[];
  animationDiagnostics: LoadedOverlayAnimation[];
  animationsDirectory: string;
  animationsLoading: boolean;
  animationsError: string | null;
  onRefreshAnimations: () => Promise<void>;
  onOpenAnimationsFolder: () => Promise<void>;
  wallpapers: LoadedOverlayWallpaper[];
  wallpaperDiagnostics: LoadedOverlayWallpaper[];
  wallpapersDirectory: string;
  wallpapersLoading: boolean;
  wallpapersError: string | null;
  onRefreshWallpapers: () => Promise<void>;
  onOpenWallpapersFolder: () => Promise<void>;
  onImportWallpaperFiles: (files: File[]) => Promise<void>;
  onSetWindowMode?: (mode: TerminalWindowMode) => Promise<void> | void;
  pluginContextMenuItems?: OverlayPluginContextMenuContribution[];
  pluginExplorerActions?: OverlayPluginExplorerActionContribution[];
}) {
  const platform = useMemo(() => detectClientPlatform(), []);
  const platformLabel = useMemo(() => {
    if (platform === 'windows') return 'Windows';
    if (platform === 'macos') return 'macOS';
    if (platform === 'linux') return 'Linux';
    return 'the OS';
  }, [platform]);
  const {
    activeSection,
    setActiveSection,
    settings,
    updateTerminal,
    updateExplorer,
    updateHome,
    updateAppearance,
    applyThemeSelection: applyThemeSelectionWithDefaults,
    applyDockThemeSelection: applyDockThemeSelectionWithDefaults,
    updateLayout,
    updateKeybindings,
    updateScreenshots,
    updateSystem,
    updateModels,
    updateAudio,
    setHomePackState,
    setHomePresetSelection,
    resetToDefaults,
  } = useSettingsStore(useShallow(state => ({
    activeSection: state.activeSection,
    setActiveSection: state.setActiveSection,
    settings: state.settings,
    updateTerminal: state.updateTerminal,
    updateExplorer: state.updateExplorer,
    updateHome: state.updateHome,
    updateAppearance: state.updateAppearance,
    applyThemeSelection: state.applyThemeSelection,
    applyDockThemeSelection: state.applyDockThemeSelection,
    updateLayout: state.updateLayout,
    updateKeybindings: state.updateKeybindings,
    updateScreenshots: state.updateScreenshots,
    updateSystem: state.updateSystem,
    updateModels: state.updateModels,
    updateAudio: state.updateAudio,
    setHomePackState: state.setHomePackState,
    setHomePresetSelection: state.setHomePresetSelection,
    resetToDefaults: state.resetToDefaults,
  })));
  const systemPresentationState = useMemo(
    () => resolveSystemPresentationState(settings.system),
    [settings.system],
  );
  const {
    snapshot: gpuRuntimeSnapshot,
    hydrationState: gpuRuntimeHydrationState,
    hydrationError: gpuRuntimeHydrationError,
    subscriptionState: gpuRuntimeSubscriptionState,
    subscriptionError: gpuRuntimeSubscriptionError,
  } = useGpuRuntimeStore(useShallow(state => ({
    snapshot: state.snapshot,
    hydrationState: state.hydrationState,
    hydrationError: state.hydrationError,
    subscriptionState: state.subscriptionState,
    subscriptionError: state.subscriptionError,
  })));
  const {
    snapshot: accelerationRuntimeSnapshot,
    hydrationState: accelerationRuntimeHydrationState,
    hydrationError: accelerationRuntimeHydrationError,
  } = useAccelerationRuntimeStore(useShallow(state => ({
    snapshot: state.snapshot,
    hydrationState: state.hydrationState,
    hydrationError: state.hydrationError,
  })));
  const { directoryBookmarks, addDirectoryBookmark } = useTerminalStore(useShallow(state => ({
    directoryBookmarks: state.directoryBookmarks,
    addDirectoryBookmark: state.addDirectoryBookmark,
  })));
  const explorerRail = useExplorerStore((state) => state.rail);
  const homeTasks = useExplorerTaskSnapshots();

  const profileOptions = useMemo(() => getExternalTerminalProfileOptions(platform), [platform]);
  const [themeDraft, setThemeDraft] = useState(() => serializeTheme(appearance.app.baseTheme));
  const [themeImportError, setThemeImportError] = useState<string | null>(null);
  const [folderIconSearch, setFolderIconSearch] = useState('');
  const [startupSyncPending, setStartupSyncPending] = useState(false);
  const [startupSyncError, setStartupSyncError] = useState<string | null>(null);
  const [linuxDisplayBackendSyncPending, setLinuxDisplayBackendSyncPending] = useState(false);
  const [linuxDisplayBackendSyncError, setLinuxDisplayBackendSyncError] = useState<string | null>(null);
  const [linuxDisplayBackendStatus, setLinuxDisplayBackendStatus] = useState<LinuxDisplayBackendStatus | null>(null);
  const [telemetryStatus, setTelemetryStatus] = useState<OverlayTelemetrySessionStatus | null>(null);
  const [telemetryStatusPending, setTelemetryStatusPending] = useState(false);
  const [telemetryStatusError, setTelemetryStatusError] = useState<string | null>(null);
  const [telemetryNotice, setTelemetryNotice] = useState<string | null>(null);
  const [telemetryActionPending, setTelemetryActionPending] = useState<'export' | 'clear' | null>(null);
  const [localModelStatus, setLocalModelStatus] = useState<LocalModelCatalogStatus | null>(null);
  const [localModelStatusPending, setLocalModelStatusPending] = useState(false);
  const [localModelStatusError, setLocalModelStatusError] = useState<string | null>(null);
  const [localModelNotice, setLocalModelNotice] = useState<string | null>(null);
  const [modelPrewarmPendingId, setModelPrewarmPendingId] = useState<string | null>(null);
  const [semanticOverrideRootPathDraft, setSemanticOverrideRootPathDraft] = useState('');
  const [semanticOverrideModelIdDraft, setSemanticOverrideModelIdDraft] = useState<string | null>(
    settings.models.capabilityBindings[semanticIndexingCapabilityId]?.modelId ?? null,
  );
  const [semanticOverrideBackendPreferenceDraft, setSemanticOverrideBackendPreferenceDraft] =
    useState<LocalModelBackendPreference>(
      normalizeLocalModelBackendPreference(
        settings.models.capabilityBindings[semanticIndexingCapabilityId]?.backendPreference,
      ),
    );
  const [homeUserPath, setHomeUserPath] = useState('');
  const [homeUsageSnapshot, setHomeUsageSnapshot] = useState<ExplorerHomeUsageSnapshotValue>({
    mostUsed: [],
    recent: [],
  });
  const [homeSavedSearches, setHomeSavedSearches] = useState<ExplorerSavedSearch[]>([]);
  const [homeDrives, setHomeDrives] = useState<ExplorerDriveInfo[]>([]);
  const [accelerationProbePending, setAccelerationProbePending] = useState(false);
  const [accelerationProbeNotice, setAccelerationProbeNotice] = useState<string | null>(null);
  const [accelerationProbeError, setAccelerationProbeError] = useState<string | null>(null);
  const [overviewNotice, setOverviewNotice] = useState<string | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [cloudSnapshot, setCloudSnapshot] = useState<ExplorerCloudAccountsSnapshot>(EMPTY_CLOUD_ACCOUNTS_SNAPSHOT);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudNotice, setCloudNotice] = useState<string | null>(null);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [cloudAuthProvider, setCloudAuthProvider] = useState<ExplorerCloudProviderId | null>(null);
  const [cloudCredentialDrafts, setCloudCredentialDrafts] = useState<CloudProviderCredentialDraftMap>(
    () => createEmptyCloudProviderCredentialDrafts(),
  );
  const [cloudCredentialBusyProvider, setCloudCredentialBusyProvider] = useState<ExplorerCloudProviderId | null>(null);
  const [cloudCredentialBusyAction, setCloudCredentialBusyAction] = useState<'save' | 'clear' | null>(null);
  const [wallpaperNotice, setWallpaperNotice] = useState<string | null>(null);
  const [wallpaperImportError, setWallpaperImportError] = useState<string | null>(null);
  const [layoutManifestState, setLayoutManifestState] = useState<LoadedLayoutManifest>(DEFAULT_LOADED_LAYOUT_MANIFEST);
  const [railWidth, setRailWidth] = usePersistentPanelSize('overlayterm-settings-rail-width', 236, 190, 320);
  const availableLinuxDisplayBackends = linuxDisplayBackendStatus?.availableBackends ?? [];
  const linuxDisplayBackendStatusSummary = useMemo(() => {
    if (platform !== 'linux') {
      return null;
    }

    if (linuxDisplayBackendSyncPending && linuxDisplayBackendStatus == null) {
      return 'Reading Linux display backend status...';
    }

    if (linuxDisplayBackendSyncError) {
      return `Linux display backend sync failed: ${linuxDisplayBackendSyncError}`;
    }

    if (linuxDisplayBackendStatus == null) {
      return 'Linux display backend status is unavailable.';
    }

    const availableBackendsLabel = availableLinuxDisplayBackends.length > 0
      ? availableLinuxDisplayBackends.join(', ')
      : 'none detected';

    return [
      `session ${linuxDisplayBackendStatus.sessionBackend ?? 'unknown'}`,
      `active backend ${linuxDisplayBackendStatus.activeBackend ?? 'unknown'}`,
      `available launch backends ${availableBackendsLabel}`,
      linuxDisplayBackendStatus.autoX11FallbackActive
        ? 'auto X11 fallback active for NVIDIA/WebKit'
        : 'auto fallback inactive',
      'restart required after changes',
    ].join(' · ');
  }, [
    availableLinuxDisplayBackends,
    linuxDisplayBackendStatus,
    linuxDisplayBackendSyncError,
    linuxDisplayBackendSyncPending,
    platform,
  ]);
  const gpuRuntimeDiagnosticsSummary = useMemo(() => {
    const adapterLabel = gpuRuntimeSnapshot.adapterName ?? 'not detected';
    const backendLabel = gpuRuntimeSnapshot.backendName ?? 'n/a';
    const adapterTypeLabel = gpuRuntimeSnapshot.adapterType ?? 'unknown';
    const queueLabel = `${gpuRuntimeSnapshot.queueDepth} queued`;
    const computeLabel = gpuRuntimeSnapshot.computeAvailable ? 'compute ready' : 'compute unavailable';
    const rendererLabel = gpuRuntimeSnapshot.softwareRenderer ? 'software renderer' : 'hardware renderer';
    return `${adapterLabel} · ${adapterTypeLabel} · ${backendLabel} · ${rendererLabel} · ${computeLabel} · ${queueLabel}`;
  }, [gpuRuntimeSnapshot]);
  const gpuRuntimeFeedStatus = useMemo(() => {
    if (gpuRuntimeHydrationState === 'loading' || gpuRuntimeSubscriptionState === 'loading') {
      return 'Refreshing native GPU runtime diagnostics...';
    }

    if (gpuRuntimeHydrationError) {
      return `GPU runtime hydration failed: ${gpuRuntimeHydrationError}`;
    }

    if (gpuRuntimeSubscriptionError) {
      return `GPU runtime event subscription failed: ${gpuRuntimeSubscriptionError}`;
    }

    if (gpuRuntimeSnapshot.runtimeError) {
      return `Runtime note: ${gpuRuntimeSnapshot.runtimeError}`;
    }

    return `Configured ${getGpuTierModeLabel(settings.system.gpuTierMode)} · effective ${getGpuTierModeLabel(gpuRuntimeSnapshot.effectiveTier)}.`;
  }, [
    gpuRuntimeHydrationError,
    gpuRuntimeHydrationState,
    gpuRuntimeSnapshot.effectiveTier,
    gpuRuntimeSnapshot.runtimeError,
    gpuRuntimeSubscriptionError,
    gpuRuntimeSubscriptionState,
    settings.system.gpuTierMode,
  ]);
  const accelerationProviderSummary = useMemo(() => {
    const readyProviders = accelerationRuntimeSnapshot.providers.filter(provider => provider.ready);
    if (readyProviders.length === 0) {
      return 'No accelerator providers are currently ready; CPU fallback remains active.';
    }

    return readyProviders
      .map(provider => `${provider.label} ready`)
      .join(' · ');
  }, [accelerationRuntimeSnapshot.providers]);
  const accelerationPipelineStatus = useMemo(() => {
    if (accelerationRuntimeHydrationState === 'loading') {
      return 'Refreshing acceleration pipeline diagnostics...';
    }

    if (accelerationRuntimeHydrationError) {
      return `Acceleration runtime hydration failed: ${accelerationRuntimeHydrationError}`;
    }

    if (accelerationProbeError) {
      return `CUDA/AI probe failed: ${accelerationProbeError}`;
    }

    if (accelerationProbeNotice) {
      return accelerationProbeNotice;
    }

    if (accelerationRuntimeSnapshot.pythonProbeError) {
      return `Python probe note: ${accelerationRuntimeSnapshot.pythonProbeError}`;
    }

    return `Routing ${getAccelerationRoutingModeLabel(settings.system.accelerationRoutingMode)} · ${accelerationProviderSummary}`;
  }, [
    accelerationProviderSummary,
    accelerationProbeError,
    accelerationProbeNotice,
    accelerationRuntimeHydrationError,
    accelerationRuntimeHydrationState,
    accelerationRuntimeSnapshot.pythonProbeError,
    settings.system.accelerationRoutingMode,
  ]);
  const accelerationWorkloadRoutes = useMemo(() => (
    accelerationWorkloadCatalog.map(definition => ({
      definition,
      resolution: resolveAccelerationProviderForWorkload(
        accelerationRuntimeSnapshot,
        definition.id,
        settings.system.accelerationRoutingMode,
      ),
    }))
  ), [
    accelerationRuntimeSnapshot,
    settings.system.accelerationRoutingMode,
  ]);
  const managedPythonRuntimeConfig = useMemo(
    () => createPythonRuntimeConfig(settings.python),
    [settings.python],
  );
  const handleProbeAccelerationPipeline = useCallback(async () => {
    setAccelerationProbePending(true);
    setAccelerationProbeNotice(null);
    setAccelerationProbeError(null);
    try {
      const snapshot = await refreshAccelerationRuntimeStatus({
        config: managedPythonRuntimeConfig,
        routingMode: settings.system.accelerationRoutingMode,
        startSidecarIfNeeded: true,
      });
      const readyProviders = snapshot.providers.filter(provider => provider.ready);
      setAccelerationProbeNotice(
        readyProviders.length > 0
          ? `Probe complete · ${readyProviders.map(provider => provider.label).join(', ')} ready.`
          : 'Probe complete · no accelerator provider reported ready, CPU fallback remains active.',
      );
    } catch (error) {
      setAccelerationProbeError(error instanceof Error ? error.message : String(error));
    } finally {
      setAccelerationProbePending(false);
    }
  }, [
    managedPythonRuntimeConfig,
    settings.system.accelerationRoutingMode,
  ]);
  const cudaProviderStatus = useMemo(
    () => accelerationRuntimeSnapshot.providers.find(provider => provider.providerKind === 'cudaPython') ?? null,
    [accelerationRuntimeSnapshot.providers],
  );
  const cudaProviderReady = cudaProviderStatus?.ready === true || cudaProviderStatus?.available === true;
  const semanticIndexingCapability = useMemo(
    () => getLocalModelCapabilityDefinition(semanticIndexingCapabilityId),
    [],
  );
  const semanticIndexingBinding = useMemo(
    () => settings.models.capabilityBindings[semanticIndexingCapabilityId] ?? {
      modelId: semanticIndexingCapability?.defaultModelId ?? null,
      backendPreference: semanticIndexingCapability?.defaultBackendPreference ?? 'auto',
    },
    [
      semanticIndexingCapability?.defaultBackendPreference,
      semanticIndexingCapability?.defaultModelId,
      settings.models.capabilityBindings,
    ],
  );
  const semanticIndexingModels = useMemo(
    () => getCapabilityModels(semanticIndexingCapabilityId),
    [],
  );
  const localModelStatusById = useMemo(
    () => new Map((localModelStatus?.models ?? []).map(entry => [entry.modelId, entry] as const)),
    [localModelStatus],
  );
  const semanticIndexOverrideEntries = useMemo(
    () => Object.entries(settings.models.semanticIndexRootOverrides)
      .sort(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath)),
    [settings.models.semanticIndexRootOverrides],
  );
  const refreshLocalModels = useCallback(async (startIfNeeded = true) => {
    setLocalModelStatusPending(true);
    setLocalModelStatusError(null);
    try {
      const response = await getLocalModelCatalogStatus(
        {},
        { config: managedPythonRuntimeConfig, startIfNeeded },
      );
      setLocalModelStatus(response.result);
    } catch (error) {
      setLocalModelStatusError(error instanceof Error ? error.message : String(error));
    } finally {
      setLocalModelStatusPending(false);
    }
  }, [managedPythonRuntimeConfig]);
  const handlePrewarmLocalModel = useCallback(async (
    modelId: string,
    capabilityId: string | null,
    backendPreference: LocalModelBackendPreference,
  ) => {
    setModelPrewarmPendingId(modelId);
    setLocalModelNotice(null);
    setLocalModelStatusError(null);
    try {
      const response = await prewarmLocalModel(
        {
          modelId,
          capabilityId,
          backendPreference,
        },
        { config: managedPythonRuntimeConfig, startIfNeeded: true },
      );
      setLocalModelNotice(response.result.message);
      setLocalModelStatus(await getLocalModelCatalogStatus(
        {},
        { config: managedPythonRuntimeConfig, startIfNeeded: true },
      ).then(result => result.result));
    } catch (error) {
      setLocalModelStatusError(error instanceof Error ? error.message : String(error));
    } finally {
      setModelPrewarmPendingId(null);
    }
  }, [managedPythonRuntimeConfig]);
  const handleUpdateModelCapabilityBinding = useCallback((
    capabilityId: string,
    updates: {
      modelId?: string | null;
      backendPreference?: LocalModelBackendPreference;
    },
  ) => {
    const currentBinding = settings.models.capabilityBindings[capabilityId] ?? {
      modelId: null,
      backendPreference: 'auto' as LocalModelBackendPreference,
    };
    updateModels({
      capabilityBindings: {
        ...settings.models.capabilityBindings,
        [capabilityId]: {
          modelId: updates.modelId ?? currentBinding.modelId,
          backendPreference: updates.backendPreference ?? currentBinding.backendPreference,
        },
      },
    });
  }, [settings.models.capabilityBindings, updateModels]);
  const handleApplySemanticIndexOverride = useCallback(() => {
    const normalizedRootPath = semanticOverrideRootPathDraft.trim();
    if (!normalizedRootPath) {
      setLocalModelStatusError('Semantic index override requires a root path.');
      return;
    }

    updateModels({
      semanticIndexRootOverrides: {
        ...settings.models.semanticIndexRootOverrides,
        [normalizedRootPath]: {
          modelId: semanticOverrideModelIdDraft,
          backendPreference: semanticOverrideBackendPreferenceDraft,
        },
      },
    });
    setLocalModelNotice(`Saved semantic index override for ${normalizedRootPath}.`);
    setSemanticOverrideRootPathDraft('');
  }, [
    semanticOverrideBackendPreferenceDraft,
    semanticOverrideModelIdDraft,
    semanticOverrideRootPathDraft,
    settings.models.semanticIndexRootOverrides,
    updateModels,
  ]);
  const handleRemoveSemanticIndexOverride = useCallback((rootPath: string) => {
    const nextOverrides = { ...settings.models.semanticIndexRootOverrides };
    delete nextOverrides[rootPath];
    updateModels({ semanticIndexRootOverrides: nextOverrides });
  }, [settings.models.semanticIndexRootOverrides, updateModels]);
  const handleOpenLocalModelCache = useCallback(async () => {
    const cacheRoot = localModelStatus?.cacheRoot?.trim();
    if (!cacheRoot) {
      setLocalModelStatusError('Model cache location is unavailable until the managed Python runtime is ready.');
      return;
    }
    try {
      await createExplorerDir(cacheRoot).catch(() => {});
      await openExplorerPath(cacheRoot);
    } catch (error) {
      setLocalModelStatusError(error instanceof Error ? error.message : String(error));
    }
  }, [localModelStatus?.cacheRoot]);

  useEffect(() => {
    setSemanticOverrideModelIdDraft(semanticIndexingBinding.modelId);
    setSemanticOverrideBackendPreferenceDraft(
      normalizeLocalModelBackendPreference(semanticIndexingBinding.backendPreference),
    );
  }, [semanticIndexingBinding.backendPreference, semanticIndexingBinding.modelId]);

  useEffect(() => {
    if (activeSection !== 'models') {
      return;
    }

    if (localModelStatus == null && !localModelStatusPending) {
      void refreshLocalModels(true);
    }
  }, [
    activeSection,
    localModelStatus,
    localModelStatusPending,
    refreshLocalModels,
  ]);

  useEffect(() => {
    let disposed = false;
    void getExplorerHomeDir()
      .then((path) => {
        if (!disposed) {
          setHomeUserPath(path.trim());
        }
      })
      .catch(() => {
        if (!disposed) {
          setHomeUserPath('');
        }
      });

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    if (activeSection !== 'home') {
      return;
    }

    let disposed = false;
    void Promise.all([
      listExplorerHomeUsage().catch(() => ({ mostUsed: [], recent: [] })),
      listExplorerSavedSearches().catch(() => []),
      getExplorerDrives().catch(() => []),
    ]).then(([usageSnapshot, savedSearchesSnapshot, drivesSnapshot]) => {
      if (disposed) {
        return;
      }

      setHomeUsageSnapshot(usageSnapshot);
      setHomeSavedSearches(savedSearchesSnapshot);
      setHomeDrives(drivesSnapshot);
    });

    return () => {
      disposed = true;
    };
  }, [activeSection]);

  const wallpaperFileInputRef = useRef<HTMLInputElement | null>(null);
  const contextMenuCatalog = useMemo(
    () => sortExplorerContextMenuItems(
      [
        ...BUILT_IN_EXPLORER_CONTEXT_MENU_ITEMS,
        ...normalizePluginContextMenuContributions([
          ...pluginContextMenuItems,
          ...createLegacyExplorerActionContextMenuContributions(pluginExplorerActions),
        ]),
      ],
      settings.explorer.contextMenuItemOverrides,
    ),
    [
      pluginContextMenuItems,
      pluginExplorerActions,
      settings.explorer.contextMenuItemOverrides,
    ],
  );
  const availableAnimations = useMemo(
    () => animations.filter(animation => !animation.error),
    [animations],
  );
  const availableWallpapers = useMemo(
    () => wallpapers.filter(wallpaper => !wallpaper.error),
    [wallpapers],
  );
  const themePackageLookup = useMemo(
    () => new Map(themePackages.map(pkg => [pkg.id, pkg] as const)),
    [themePackages],
  );
  const normalizedActiveIconThemeId = useMemo(
    () => normalizeIconThemePackageSelectionId(settings.appearance.activeIconThemeId),
    [settings.appearance.activeIconThemeId],
  );
  const iconThemePackageLookup = useMemo(
    () => new Map(
      iconThemePackages.map(pkg => [normalizeIconThemePackageSelectionId(pkg.id) ?? pkg.id, pkg] as const),
    ),
    [iconThemePackages],
  );
  const activeIconThemePackage = useMemo(
    () => normalizedActiveIconThemeId
      ? (iconThemePackageLookup.get(normalizedActiveIconThemeId)
        ?? resolveLoadedIconThemePackage(iconThemePackages, normalizedActiveIconThemeId))
      : null,
    [iconThemePackageLookup, iconThemePackages, normalizedActiveIconThemeId],
  );
  const availableShaders = useMemo(
    () => shaders.filter(shader => !shader.error),
    [shaders],
  );
  const openAnimationOptions = useMemo(
    () => availableAnimations.filter(animation => animation.open),
    [availableAnimations],
  );
  const closeAnimationOptions = useMemo(
    () => availableAnimations.filter(animation => animation.close),
    [availableAnimations],
  );
  const availableOpenAnimationIds = useMemo(
    () => openAnimationOptions.map(animation => animation.id),
    [openAnimationOptions],
  );
  const availableCloseAnimationIds = useMemo(
    () => closeAnimationOptions.map(animation => animation.id),
    [closeAnimationOptions],
  );
  const animationFailures = useMemo(
    () => animationDiagnostics.filter(animation => Boolean(animation.error)),
    [animationDiagnostics],
  );
  const wallpaperFailures = useMemo(
    () => wallpaperDiagnostics.filter(wallpaper => Boolean(wallpaper.error)),
    [wallpaperDiagnostics],
  );
  const shaderFailures = useMemo(
    () => shaderDiagnostics.filter(shader => Boolean(shader.error)),
    [shaderDiagnostics],
  );
  const availableShaderIds = useMemo(
    () => availableShaders.map(shader => shader.id),
    [availableShaders],
  );
  const shaderPerformanceMode = settings.appearance.shaderPerformanceMode;
  const shaderPerformanceProfile = useMemo(
    () => getShaderPerformanceProfile(shaderPerformanceMode),
    [shaderPerformanceMode],
  );
  const appAppearance = appearance.app;
  const dockAppearance = appearance.dock;
  const resolvedTopBarSelection = useMemo(
    () => resolveActiveTopBarSelection({
      requestedTopBarId: settings.appearance.activeTopBarId,
      theme: appearance.baseTheme,
      packageSources: [...topBarPackages, ...themePackages],
    }),
    [appearance.baseTheme, settings.appearance.activeTopBarId, themePackages, topBarPackages],
  );
  const availableTopBars = resolvedTopBarSelection.availableTopBars;
  const topBarCatalogLoading = topBarPackagesLoading || themePackagesLoading;
  const authoredTopBarCount = useMemo(
    () => topBarPackages.reduce((total, pkg) => total + pkg.topBars.length, 0),
    [topBarPackages],
  );
  const themeContributedTopBarCount = useMemo(
    () => themePackages.reduce((total, pkg) => total + (pkg.topBars?.length ?? 0), 0),
    [themePackages],
  );
  const blurEnabled = settings.appearance.appBlur !== false;
  const activeWallpaperSelectionId = settings.appearance.activeWallpaperId ?? null;
  const themeWallpaperAvailable = Boolean(appAppearance.baseTheme.assets?.backgroundUrl);
  const wallpaperSelectionSummary = activeWallpaperSelectionId == null
    ? (themeWallpaperAvailable ? 'Theme Default' : 'No Wallpaper')
    : activeWallpaperSelectionId === wallpaperSystemConfig.noneWallpaperId
      ? 'Disabled'
      : 'Settings Override';
  const topBarSelectionSummary = settings.appearance.activeTopBarId == null
    ? `Follow Theme · ${resolvedTopBarSelection.topBar.name}`
    : resolvedTopBarSelection.explicitSelectionMissing
      ? `Pinned missing · ${resolvedTopBarSelection.topBar.name}`
      : `Pinned · ${resolvedTopBarSelection.topBar.name}`;
  const followThemeTopBarDetail = resolvedTopBarSelection.resolvedFrom === 'theme-default'
    ? `${appearance.baseTheme.name} explicitly defaults to ${resolvedTopBarSelection.topBar.name}.`
    : resolvedTopBarSelection.resolvedFrom === 'theme-legacy-style'
      ? `${appearance.baseTheme.name} does not declare a standalone top bar yet, so the shell falls back from that theme's legacy workbench top-bar style into ${resolvedTopBarSelection.topBar.name}.`
      : `${appearance.baseTheme.name} is currently using the built-in top-bar fallback ${resolvedTopBarSelection.topBar.name}.`;
  const semanticIndexingSelectedModel = useMemo(
    () => getLocalModelDefinition(semanticIndexingBinding.modelId)
      ?? getLocalModelDefinitionByProviderModelId(semanticIndexingBinding.modelId),
    [semanticIndexingBinding.modelId],
  );
  const semanticIndexingBackendLabel = useMemo(
    () => localModelBackendOptions.find(
      option => option.id === normalizeLocalModelBackendPreference(semanticIndexingBinding.backendPreference),
    )?.label ?? 'Auto',
    [semanticIndexingBinding.backendPreference],
  );
  const installedLocalModelCount = localModelStatus?.installedModelCount
    ?? (localModelStatus?.models.filter(model => model.installed).length ?? 0);
  const localModelCacheFootprint = `${formatModelCacheBytes(localModelStatus?.totalCacheSizeBytes ?? 0)} cache`;
  const semanticIndexModelSummary = `${semanticIndexingSelectedModel?.label ?? 'No model'} · ${semanticIndexingBackendLabel}`;
  const semanticIndexingSelectedModelStatus = useMemo(
    () => semanticIndexingSelectedModel
      ? localModelStatusById.get(semanticIndexingSelectedModel.id) ?? null
      : null,
    [localModelStatusById, semanticIndexingSelectedModel],
  );
  const semanticIndexingSelectedHardwareProfile = useMemo(
    () => getLocalModelHardwareProfile(semanticIndexingSelectedModel?.hardwareProfileId),
    [semanticIndexingSelectedModel?.hardwareProfileId],
  );
  const effectiveShaderId = useMemo(
    () => resolvePreferredShaderId({
      availableShaderIds,
      userOverrideId: settings.appearance.activeShaderId,
      themeDefaultShaderId: appAppearance.baseTheme.defaultShaderId,
      performanceMode: shaderPerformanceMode,
    }),
    [appAppearance.baseTheme.defaultShaderId, availableShaderIds, shaderPerformanceMode, settings.appearance.activeShaderId],
  );
  const effectiveShader = useMemo(
    () => availableShaders.find(shader => shader.id === effectiveShaderId) ?? null,
    [availableShaders, effectiveShaderId],
  );
  const enabledShaderSurfaces = useMemo(
    () => getShaderEnabledSurfaceIds(effectiveShader),
    [effectiveShader],
  );
  const effectiveShaderControlOverrides = useMemo(
    () => effectiveShader
      ? (settings.appearance.shaderControlValues[effectiveShader.id] ?? {})
      : {},
    [effectiveShader, settings.appearance.shaderControlValues],
  );
  const shaderSettingsShellContext = useMemo<OverlayShaderShellContext | null>(() => {
    if (!effectiveShader) {
      return null;
    }

    return {
      id: effectiveShader.id,
      name: effectiveShader.name,
      filePath: effectiveShader.filePath,
      shaderRoot: effectiveShader.shaderRoot,
      source: effectiveShader.source,
      viewport: {
        width: typeof window === 'undefined' ? 0 : window.innerWidth,
        height: typeof window === 'undefined' ? 0 : window.innerHeight,
      },
      accentColor: appearance.theme.palette.accent,
      theme: appearance.theme,
      panelTransparency: settings.appearance.panelTransparency,
      blurStrength: settings.appearance.appBlurStrength,
      zoom: settings.appearance.appZoom,
      isSettingsActive: true,
      shaderControlValues: effectiveShaderControlOverrides,
    };
  }, [
    appearance.theme,
    effectiveShader,
    effectiveShaderControlOverrides,
    settings.appearance.appBlurStrength,
    settings.appearance.appZoom,
    settings.appearance.panelTransparency,
  ]);
  const effectiveShaderComputedUniforms = useMemo(
    () => shaderSettingsShellContext
      ? resolveShaderComputedUniforms(effectiveShader, shaderSettingsShellContext)
      : {},
    [effectiveShader, shaderSettingsShellContext],
  );
  const effectiveShaderControlValues = useMemo(
    () => resolveShaderControlValues(
      effectiveShader,
      effectiveShaderControlOverrides,
      effectiveShaderComputedUniforms,
    ),
    [effectiveShader, effectiveShaderComputedUniforms, effectiveShaderControlOverrides],
  );
  const shaderSelectionSummary = settings.appearance.activeShaderId
    ? 'Settings Override'
    : shaderPerformanceProfile.shellUsesThemeDefault
      ? (appAppearance.baseTheme.defaultShaderId ? 'Theme Default' : 'Fallback')
      : `${shaderPerformanceProfile.label} Mode`;
  const effectiveOpenAnimationId = useMemo(
    () => resolvePreferredAnimationId({
      availableAnimationIds: availableOpenAnimationIds,
      userOverrideId: settings.appearance.appOpenAnimation,
      themeDefaultAnimationId: appAppearance.baseTheme.defaultOpenAnimationId,
      fallbackAnimationId: animationSystemConfig.defaultOpenAnimationId,
    }),
    [appAppearance.baseTheme.defaultOpenAnimationId, availableOpenAnimationIds, settings.appearance.appOpenAnimation],
  );
  const effectiveCloseAnimationId = useMemo(
    () => resolvePreferredAnimationId({
      availableAnimationIds: availableCloseAnimationIds,
      userOverrideId: settings.appearance.appCloseAnimation,
      themeDefaultAnimationId: appAppearance.baseTheme.defaultCloseAnimationId,
      fallbackAnimationId: animationSystemConfig.defaultCloseAnimationId,
    }),
    [appAppearance.baseTheme.defaultCloseAnimationId, availableCloseAnimationIds, settings.appearance.appCloseAnimation],
  );
  const settingsInteractionMotion = useInteractionMotionController(appAppearance);
  const settingsCardTransition = 'background 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease, color 0.16s ease, opacity 0.16s ease';
  const themeInteractionMotionPresetId = useMemo(
    () => normalizeInteractionMotionPresetId(appAppearance.baseTheme.interactionMotion?.defaultPresetId),
    [appAppearance.baseTheme.interactionMotion?.defaultPresetId],
  );
  const sharedInteractionMotionPresetId = useMemo(
    () => normalizeInteractionMotionPresetId(settings.appearance.interactionMotionPresetId),
    [settings.appearance.interactionMotionPresetId],
  );
  const interactionMotionPresetGroups = useMemo(() => ([
    {
      id: 'system',
      label: 'System Profiles',
      subtitle: 'Fast shell defaults tuned for everyday UI interaction.',
      options: interactionMotionPresetOptions.filter(option => option.groupId === 'system'),
    },
    {
      id: 'kcloner',
      label: 'KCloner Motion Set',
      subtitle: 'Cinema4D / MoGraph-flavored UI motion families pulled into the shell.',
      options: interactionMotionPresetOptions.filter(option => option.groupId === 'kcloner'),
    },
  ]), []);
  const interactionMotionModuleEditorStates = useMemo(() => (
    interactionMotionModuleCatalog.map(module => {
      const moduleOverride = normalizeInteractionMotionModuleOverride(
        settings.appearance.interactionMotionModuleOverrides[module.id],
      );
      const effectivePresetId = resolveInteractionMotionModuleProfileId({
        moduleId: module.id,
        settings: settings.appearance,
        themeDefaultPresetId: themeInteractionMotionPresetId,
      });
      const effectiveProfile = interactionMotionPresetOptions.find(option => option.id === effectivePresetId)
        ?? interactionMotionPresetOptions[0];
      const modifierControls = getInteractionMotionProfileModifierControls(effectivePresetId);
      const modifierValues = resolveInteractionMotionModifierValues(
        effectivePresetId,
        moduleOverride.modifierValuesByPresetId[effectivePresetId],
      );

      return {
        module,
        moduleOverride,
        effectivePresetId,
        effectiveProfile,
        modifierControls,
        modifierValues,
      };
    })
  ), [
    settings.appearance,
    themeInteractionMotionPresetId,
  ]);
  const effectiveInteractionMotionProfileLabel = useMemo(
    () => interactionMotionModuleEditorStates
      .map(state => `${state.module.label}: ${state.effectiveProfile.label}`)
      .join(' · '),
    [interactionMotionModuleEditorStates],
  );
  const bindSettingsCardMotion = useCallback((active = false) => (
    settingsInteractionMotion.bindSurface({
      surfaceId: 'settingsCard',
      triggerState: active ? { activate: true } : undefined,
      baseTransition: settingsCardTransition,
    })
  ), [settingsCardTransition, settingsInteractionMotion]);
  const setInteractionMotionModuleEnabled = useCallback((moduleId: (typeof interactionMotionModuleCatalog)[number]['id'], enabled: boolean) => {
    const currentOverride = normalizeInteractionMotionModuleOverride(
      settings.appearance.interactionMotionModuleOverrides[moduleId],
    );
    updateAppearance({
      interactionMotionModuleOverrides: {
        ...settings.appearance.interactionMotionModuleOverrides,
        [moduleId]: {
          ...currentOverride,
          enabled,
        },
      },
    });
  }, [settings.appearance.interactionMotionModuleOverrides, updateAppearance]);
  const setInteractionMotionModulePresetId = useCallback((moduleId: (typeof interactionMotionModuleCatalog)[number]['id'], presetId: string | null) => {
    const currentOverride = normalizeInteractionMotionModuleOverride(
      settings.appearance.interactionMotionModuleOverrides[moduleId],
    );
    updateAppearance({
      interactionMotionModuleOverrides: {
        ...settings.appearance.interactionMotionModuleOverrides,
        [moduleId]: {
          ...currentOverride,
          presetId,
        },
      },
    });
  }, [settings.appearance.interactionMotionModuleOverrides, updateAppearance]);
  const setInteractionMotionModuleIntensity = useCallback((moduleId: (typeof interactionMotionModuleCatalog)[number]['id'], intensityMultiplier: number) => {
    const currentOverride = normalizeInteractionMotionModuleOverride(
      settings.appearance.interactionMotionModuleOverrides[moduleId],
    );
    updateAppearance({
      interactionMotionModuleOverrides: {
        ...settings.appearance.interactionMotionModuleOverrides,
        [moduleId]: {
          ...currentOverride,
          intensityMultiplier: clampInteractionMotionIntensity(intensityMultiplier),
        },
      },
    });
  }, [settings.appearance.interactionMotionModuleOverrides, updateAppearance]);
  const setInteractionMotionModuleModifierValue = useCallback((moduleId: (typeof interactionMotionModuleCatalog)[number]['id'], presetId: string, controlId: string, value: number) => {
    const currentOverride = normalizeInteractionMotionModuleOverride(
      settings.appearance.interactionMotionModuleOverrides[moduleId],
    );
    const nextModifierValuesByPresetId = {
      ...currentOverride.modifierValuesByPresetId,
      [presetId]: {
        ...(currentOverride.modifierValuesByPresetId[presetId] ?? {}),
        [controlId]: value,
      },
    };

    updateAppearance({
      interactionMotionModuleOverrides: {
        ...settings.appearance.interactionMotionModuleOverrides,
        [moduleId]: {
          ...currentOverride,
          modifierValuesByPresetId: nextModifierValuesByPresetId,
        },
      },
    });
  }, [settings.appearance.interactionMotionModuleOverrides, updateAppearance]);
  const setInteractionMotionSurfaceEnabled = useCallback((surfaceId: (typeof interactionMotionSurfaceCatalog)[number]['id'], enabled: boolean) => {
    const nextOverrides = { ...settings.appearance.interactionMotionSurfaceOverrides };
    const currentOverride = nextOverrides[surfaceId];

    if (enabled) {
      if (currentOverride && typeof currentOverride === 'object' && !Array.isArray(currentOverride)) {
        const nextOverride = { ...currentOverride };
        delete nextOverride.enabled;
        if (Object.keys(nextOverride).length > 0) {
          nextOverrides[surfaceId] = nextOverride;
        } else {
          delete nextOverrides[surfaceId];
        }
      } else {
        delete nextOverrides[surfaceId];
      }
    } else if (currentOverride && typeof currentOverride === 'object' && !Array.isArray(currentOverride)) {
      nextOverrides[surfaceId] = {
        ...currentOverride,
        enabled: false,
      };
    } else {
      nextOverrides[surfaceId] = false;
    }

    updateAppearance({ interactionMotionSurfaceOverrides: nextOverrides });
  }, [settings.appearance.interactionMotionSurfaceOverrides, updateAppearance]);
  const shellTransitionMotionCard = bindSettingsCardMotion();
  const interactionMotionCard = bindSettingsCardMotion(settings.appearance.interactionMotionEnabled);

  useEffect(() => {
    ensureFontFamilyLoaded(appearance.fonts.ui);
    ensureFontFamilyLoaded(settings.terminal.fontFamily);
  }, [appearance.fonts.ui, settings.terminal.fontFamily]);

  useEffect(() => {
    setThemeDraft(serializeTheme(appAppearance.baseTheme));
  }, [appAppearance.baseTheme]);

  useEffect(() => {
    let cancelled = false;

    loadExternalLayoutManifest(settings.layout.configPath)
      .then(result => {
        if (!cancelled) {
          setLayoutManifestState(result);
        }
      })
      .catch(error => {
        if (!cancelled) {
          console.warn('OverlayTerm: failed to load layout manifest in settings', error);
          setLayoutManifestState({
            ...DEFAULT_LOADED_LAYOUT_MANIFEST,
            sourceError: String(error),
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [settings.layout.configPath]);

  const persistTheme = useCallback((nextTheme: OverlayThemeDefinition) => {
    const builtinIds = new Set(overlayThemePresets.map(themeDef => themeDef.id));
    const needsCustomId = builtinIds.has(nextTheme.id);
    const customTheme = {
      ...nextTheme,
      id: needsCustomId ? `${nextTheme.id}-custom` : nextTheme.id,
      name: needsCustomId ? `${nextTheme.name} Custom` : nextTheme.name,
    };
    const nextCustomThemes = upsertCustomTheme(settings.appearance.customThemes, customTheme);
    updateAppearance({
      customThemes: nextCustomThemes,
      activeThemeId: customTheme.id,
    });
    setThemeDraft(serializeTheme(customTheme));
    return customTheme;
  }, [settings.appearance.customThemes, updateAppearance]);

  const applyThemeSelection = useCallback((themeId: string) => {
    applyThemeSelectionWithDefaults(themeId);
  }, [applyThemeSelectionWithDefaults]);
  const applyDockThemeSelection = useCallback((themeId: string) => {
    applyDockThemeSelectionWithDefaults(themeId);
  }, [applyDockThemeSelectionWithDefaults]);
  const applyIconThemeSelection = useCallback((iconThemeId: string | null) => {
    updateAppearance({ activeIconThemeId: iconThemeId });
  }, [updateAppearance]);
  const toggleContextMenuItemEnabled = useCallback((itemId: string, enabled: boolean) => {
    const item = contextMenuCatalog.find(entry => entry.id === itemId);
    if (!item) {
      return;
    }

    updateExplorer({
      contextMenuItemOverrides: withExplorerContextMenuItemEnabled(
        settings.explorer.contextMenuItemOverrides,
        item,
        enabled,
      ),
    });
  }, [contextMenuCatalog, settings.explorer.contextMenuItemOverrides, updateExplorer]);
  const moveContextMenuItem = useCallback((itemId: string, direction: 'up' | 'down') => {
    updateExplorer({
      contextMenuItemOverrides: moveExplorerContextMenuItem(
        contextMenuCatalog,
        settings.explorer.contextMenuItemOverrides,
        itemId,
        direction,
      ),
    });
  }, [contextMenuCatalog, settings.explorer.contextMenuItemOverrides, updateExplorer]);
  const resetContextMenuLayout = useCallback(() => {
    updateExplorer({
      contextMenuItemOverrides: buildExplorerContextMenuOverrideMap(
        sortExplorerContextMenuItems(
          [
            ...BUILT_IN_EXPLORER_CONTEXT_MENU_ITEMS,
            ...normalizePluginContextMenuContributions([
              ...pluginContextMenuItems,
              ...createLegacyExplorerActionContextMenuContributions(pluginExplorerActions),
            ]),
          ],
          {},
        ),
        settings.explorer.contextMenuItemOverrides,
      ),
    });
  }, [
    pluginContextMenuItems,
    pluginExplorerActions,
    settings.explorer.contextMenuItemOverrides,
    updateExplorer,
  ]);

  const updateThemePalette = useCallback((patch: Partial<OverlayThemeDefinition['palette']>) => {
    persistTheme({
      ...appAppearance.baseTheme,
      palette: {
        ...appAppearance.baseTheme.palette,
        ...patch,
      },
    });
  }, [appAppearance.baseTheme, persistTheme]);

  const applyThemeDraft = useCallback(() => {
    try {
      const importedTheme = parseImportedTheme(themeDraft);
      persistTheme(importedTheme);
      setThemeImportError(null);
    } catch (error) {
      setThemeImportError(`Theme import failed: ${String(error)}`);
    }
  }, [persistTheme, themeDraft]);

  const seedDefaultBookmarks = useCallback(async () => {
    try {
      const home = await commands.fsGetHomeDir().then(unwrapTauriResult);
      const seeds = createDefaultDirectoryBookmarks(home, platform);
      for (const seed of seeds) {
        if (!directoryBookmarks.some(bookmark => bookmark.value === seed.value)) {
          await addDirectoryBookmark(seed);
        }
      }
    } catch (error) {
      console.warn('OverlayTerm: failed to seed default bookmarks', error);
    }
  }, [addDirectoryBookmark, directoryBookmarks, platform]);

  const ensureWorkspaceDirectory = useCallback(async (path: string) => {
    const normalizedPath = path.trim();
    if (!normalizedPath) {
      throw new Error('No workspace directory is configured yet.');
    }

    try {
      await listExplorerDir(normalizedPath, false);
    } catch {
      await createExplorerDir(normalizedPath);
    }
  }, []);

  const openWorkspaceDirectory = useCallback(async (label: string, path: string) => {
    setOverviewNotice(null);
    setOverviewError(null);

    try {
      await ensureWorkspaceDirectory(path);
      await openExplorerPath(path);
      setOverviewNotice(`Opened ${label}: ${path}`);
    } catch (error) {
      setOverviewError(`Failed to open ${label}: ${String(error)}`);
    }
  }, [ensureWorkspaceDirectory]);

  const refreshCloudAccounts = useCallback(async () => {
    setCloudLoading(true);
    try {
      const snapshot = await listCloudAccounts();
      setCloudSnapshot(
        snapshot
          && Array.isArray(snapshot.accounts)
          && Array.isArray(snapshot.providers)
          ? snapshot
          : EMPTY_CLOUD_ACCOUNTS_SNAPSHOT,
      );
      setCloudError(null);
    } catch (error) {
      setCloudError(`Failed to load cloud accounts: ${String(error)}`);
    } finally {
      setCloudLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCloudAccounts();
  }, [refreshCloudAccounts]);

  const safeCloudSnapshot = cloudSnapshot
    && Array.isArray(cloudSnapshot.accounts)
    && Array.isArray(cloudSnapshot.providers)
    ? cloudSnapshot
    : EMPTY_CLOUD_ACCOUNTS_SNAPSHOT;

  useEffect(() => {
    const nextDrafts = createEmptyCloudProviderCredentialDrafts();
    for (const provider of safeCloudSnapshot.providers) {
      nextDrafts[provider.provider] = {
        clientId: provider.client_id ?? '',
        clientSecret: '',
      };
    }
    setCloudCredentialDrafts(nextDrafts);
  }, [safeCloudSnapshot.providers]);

  const updateCloudCredentialDraft = useCallback((
    provider: ExplorerCloudProviderId,
    key: keyof CloudProviderCredentialDraft,
    value: string,
  ) => {
    setCloudCredentialDrafts(current => ({
      ...current,
      [provider]: {
        ...current[provider],
        [key]: value,
      },
    }));
  }, []);

  const saveCloudProviderCredentials = useCallback(async (provider: ExplorerCloudProviderId) => {
    const draft = cloudCredentialDrafts[provider];
    setCloudError(null);
    setCloudNotice(null);
    setCloudCredentialBusyProvider(provider);
    setCloudCredentialBusyAction('save');
    try {
      await setCloudProviderConfiguration(
        provider,
        draft.clientId,
        draft.clientSecret.trim().length > 0 ? draft.clientSecret : null,
      );
      await refreshCloudAccounts();
      setCloudNotice(`Saved ${getCloudProviderLabel(provider)} provider credentials.`);
    } catch (error) {
      setCloudError(`Failed to save ${getCloudProviderLabel(provider)} credentials: ${String(error)}`);
    } finally {
      setCloudCredentialBusyProvider(null);
      setCloudCredentialBusyAction(null);
    }
  }, [cloudCredentialDrafts, refreshCloudAccounts]);

  const clearSavedCloudProviderCredentials = useCallback(async (provider: ExplorerCloudProviderId) => {
    setCloudError(null);
    setCloudNotice(null);
    setCloudCredentialBusyProvider(provider);
    setCloudCredentialBusyAction('clear');
    try {
      await clearCloudProviderConfiguration(provider);
      await refreshCloudAccounts();
      setCloudNotice(`Cleared saved ${getCloudProviderLabel(provider)} provider credentials.`);
    } catch (error) {
      setCloudError(`Failed to clear ${getCloudProviderLabel(provider)} credentials: ${String(error)}`);
    } finally {
      setCloudCredentialBusyProvider(null);
      setCloudCredentialBusyAction(null);
    }
  }, [refreshCloudAccounts]);

  const connectCloudProvider = useCallback(async (provider: ExplorerCloudProviderId) => {
    setCloudError(null);
    setCloudNotice(null);
    setCloudAuthProvider(provider);

    try {
      const session = await beginCloudAuth(provider);
      await openUrl(session.authorization_url);
      setCloudNotice(`Opened ${getCloudProviderLabel(provider)} in the system browser. Finish sign-in there and this page will update automatically.`);

      const startedAt = Date.now();
      while (Date.now() - startedAt < 5 * 60_000) {
        const status = await pollCloudAuth(session.request_id);
        if (status.status === 'pending') {
          await new Promise((resolve) => window.setTimeout(resolve, 1200));
          continue;
        }

        if (status.status === 'completed') {
          await refreshCloudAccounts();
          const accountLabel = status.account?.email || status.account?.display_name || getCloudProviderLabel(provider);
          setCloudNotice(`Connected ${accountLabel}.`);
          return;
        }

        throw new Error(status.error || `Authentication failed with status: ${status.status}`);
      }

      throw new Error('Timed out waiting for the browser sign-in flow to finish.');
    } catch (error) {
      setCloudError(`Failed to connect ${getCloudProviderLabel(provider)}: ${String(error)}`);
    } finally {
      setCloudAuthProvider(null);
    }
  }, [refreshCloudAccounts]);

  const disconnectProviderAccount = useCallback(async (account: ExplorerCloudAccountSummary) => {
    setCloudError(null);
    setCloudNotice(null);
    try {
      await disconnectCloudAccount(account.id);
      await refreshCloudAccounts();
      setCloudNotice(`Disconnected ${account.email || account.display_name}.`);
    } catch (error) {
      setCloudError(`Failed to disconnect ${account.email || account.display_name}: ${String(error)}`);
    }
  }, [refreshCloudAccounts]);

  const handleWallpaperFileSelection = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (selectedFiles.length === 0) {
      return;
    }

    setWallpaperNotice(null);
    setWallpaperImportError(null);
    try {
      await onImportWallpaperFiles(selectedFiles);
      setWallpaperNotice(`Imported ${selectedFiles.length} wallpaper file${selectedFiles.length === 1 ? '' : 's'}.`);
    } catch (error) {
      setWallpaperImportError(`Failed to import wallpaper files: ${String(error)}`);
    }
  }, [onImportWallpaperFiles]);

  const triggerWallpaperImport = useCallback(() => {
    wallpaperFileInputRef.current?.click();
  }, []);

  const effectiveTheme = appearance.theme;
  const editableTheme = appAppearance.baseTheme;
  const inputBackground = effectiveTheme.palette.inputBackground;
  const border = effectiveTheme.palette.border;
  const text = effectiveTheme.palette.textPrimary;
  const muted = effectiveTheme.palette.textMuted;
  const accent = effectiveTheme.palette.accent;
  const workbench = appearance.workbenchTheme;
  const settingsFormColorScheme = useMemo(
    () => resolveSettingsFormColorScheme(inputBackground, text),
    [inputBackground, text],
  );
  const settingsFieldStyle = useMemo<CSSProperties>(
    () => ({
      borderColor: border,
      backgroundColor: 'var(--overlay-bg-input)',
      color: text,
      caretColor: text,
      colorScheme: settingsFormColorScheme,
    }),
    [border, settingsFormColorScheme, text],
  );
  const settingsMonoFieldStyle = useMemo<CSSProperties>(
    () => ({
      ...settingsFieldStyle,
      fontFamily: appearance.fonts.mono,
    }),
    [appearance.fonts.mono, settingsFieldStyle],
  );
  const settingsSelectStyle = useMemo<CSSProperties>(
    () => ({
      ...settingsFieldStyle,
      appearance: 'none',
      WebkitAppearance: 'none',
      MozAppearance: 'none',
      backgroundImage: [
        `linear-gradient(45deg, transparent 50%, ${muted} 50%)`,
        `linear-gradient(135deg, ${muted} 50%, transparent 50%)`,
      ].join(', '),
      backgroundPosition: 'calc(100% - 16px) calc(50% - 2px), calc(100% - 11px) calc(50% - 2px)',
      backgroundSize: '5px 5px',
      backgroundRepeat: 'no-repeat',
      paddingRight: '2.4rem',
    }),
    [muted, settingsFieldStyle],
  );
  const settingsMonoSelectStyle = useMemo<CSSProperties>(
    () => ({
      ...settingsSelectStyle,
      fontFamily: appearance.fonts.mono,
    }),
    [appearance.fonts.mono, settingsSelectStyle],
  );
  const themeIconTheme = activeIconThemePackage?.iconTheme ?? editableTheme.assets?.iconTheme ?? getBuiltInIconTheme();
  const iconThemeSelectionSummary = activeIconThemePackage
    ? `${activeIconThemePackage.name} · ${activeIconThemePackage.capabilitySummary.iconDefinitions} glyphs · ${activeIconThemePackage.capabilitySummary.uiIcons} UI overrides`
    : `Follow Theme Default · ${themeIconTheme.name}`;
  const homeQuickAccess = useMemo(
    () => createExplorerHomeQuickAccessItems(homeUserPath),
    [homeUserPath],
  );
  const homeBookmarks = useMemo(
    () => mapExplorerHomeBookmarks(explorerRail),
    [explorerRail],
  );
  const homeMostUsedFolders = useMemo(
    () => mapExplorerHomeUsageEntries(homeUsageSnapshot.mostUsed),
    [homeUsageSnapshot.mostUsed],
  );
  const homeRecentFolders = useMemo(
    () => mapExplorerHomeUsageEntries(homeUsageSnapshot.recent),
    [homeUsageSnapshot.recent],
  );
  const homeLaunchpad = useMemo(
    () => createExplorerHomeLaunchpadItems(),
    [],
  );
  const homeSelection = useMemo(
    () => resolveExplorerHomePackSelection({
      packs: homePacks,
      requestedPackId: settings.home.activePackId,
      themeDefaultPackId: appearance.baseTheme.defaultHomePackId,
    }),
    [appearance.baseTheme.defaultHomePackId, homePacks, settings.home.activePackId],
  );
  const activeHomePack = homeSelection.activePack;
  const activeHomePackState = useMemo<Record<string, unknown>>(
    () => (activeHomePack ? (settings.home.packStateById[activeHomePack.id] ?? {}) : {}),
    [activeHomePack, settings.home.packStateById],
  );
  const activeHomePresetId = activeHomePack
    ? (settings.home.activePresetIdByPackId[activeHomePack.id]
      ?? activeHomePack.runtime.defaultPresetId
      ?? null)
    : null;
  const homePackSummary = activeHomePack
    ? `${homeSelection.isFallback ? 'Fallback' : 'Active'} · ${activeHomePack.name} · ${settings.home.usageTrackingEnabled ? 'Telemetry on' : 'Telemetry off'}`
    : 'No Home packs available';
  const homePackSettingsHost = useMemo(
    () => activeHomePack
      ? createExplorerHomeHost(
        {
          appearance,
          activePresetId: activeHomePresetId,
          usageTrackingEnabled: settings.home.usageTrackingEnabled,
          quickAccess: homeQuickAccess,
          bookmarks: homeBookmarks,
          mostUsedFolders: homeMostUsedFolders,
          recentFolders: homeRecentFolders,
          savedSearches: homeSavedSearches,
          drives: homeDrives,
          tasks: homeTasks,
          launchpad: homeLaunchpad,
          packState: activeHomePackState,
          packWarnings: homeSelection.warnings,
          diagnostics: {
            isFallback: homeSelection.isFallback,
            authoredPackCount: homeSelection.authoredPackCount,
            selectedPackError: homeSelection.selectedPackError,
          },
        },
        {
          navigate: () => undefined,
          openSavedSearch: () => undefined,
          openPanel: () => undefined,
          openSettingsSection: setActiveSection,
          refresh: () => {
            void onRefreshHomePacks();
          },
          updatePackState: (updates) => {
            if (activeHomePack) {
              setHomePackState(activeHomePack.id, {
                ...activeHomePackState,
                ...updates,
              });
            }
          },
          setPreset: (presetId) => {
            if (activeHomePack) {
              setHomePresetSelection(activeHomePack.id, presetId);
            }
          },
        },
      )
      : null,
    [
      activeHomePack,
      activeHomePackState,
      activeHomePresetId,
      appearance,
      homeBookmarks,
      homeDrives,
      homeLaunchpad,
      homeMostUsedFolders,
      homeQuickAccess,
      homeRecentFolders,
      homeSavedSearches,
      homeSelection.authoredPackCount,
      homeSelection.isFallback,
      homeSelection.selectedPackError,
      homeSelection.warnings,
      homeTasks,
      onRefreshHomePacks,
      setActiveSection,
      setHomePackState,
      setHomePresetSelection,
      settings.home.usageTrackingEnabled,
    ],
  );
  const handleResetHomeUsage = useCallback(async () => {
    const snapshot = await clearExplorerHomeUsage();
    setHomeUsageSnapshot(snapshot);
  }, []);
  const activeLayoutProfile = useMemo(
    () => resolveLayoutProfile(layoutManifestState.manifest, settings.layout.activeProfileId),
    [layoutManifestState.manifest, settings.layout.activeProfileId],
  );
  const [performanceTelemetryRevision, setPerformanceTelemetryRevision] = useState(0);
  const PERFORMANCE_TELEMETRY_REFRESH_MS = 5000;
  const layoutSourceSummary = useMemo(() => {
    if (layoutManifestState.sourceType === 'file' && layoutManifestState.sourcePath) {
      return `Loaded from ${layoutManifestState.sourcePath}`;
    }
    if (settings.layout.configPath.trim()) {
      return 'Custom path failed, using built-in layouts';
    }
    return 'Using built-in layouts with home-directory auto-probe';
  }, [layoutManifestState.sourcePath, layoutManifestState.sourceType, settings.layout.configPath]);
  useEffect(() => {
    if (activeSection !== 'overview') {
      return;
    }

    const interval = window.setInterval(() => {
      setPerformanceTelemetryRevision(current => current + 1);
    }, PERFORMANCE_TELEMETRY_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [activeSection]);
  const performanceSnapshot = useMemo(
    () => loadExplorerPerformanceSnapshot(),
    [performanceTelemetryRevision],
  );
  const performanceSummary = useMemo(
    () => summarizeExplorerPerformance(performanceSnapshot),
    [performanceSnapshot],
  );
  const overlayFrameTelemetry = performanceSummary.overlay_frame_time;
  const overlayFrameValue = useMemo(() => {
    if (overlayFrameTelemetry.count === 0) {
      return 'Waiting for live sample';
    }

    const avgFps = overlayFrameTelemetry.latestMetadata.avgFps;
    const avgFrameMs = overlayFrameTelemetry.latestMetadata.avgFrameMs;
    const withinTarget = overlayFrameTelemetry.latestMetadata.withinTarget;
    const fpsLabel = typeof avgFps === 'number' ? `${Math.round(avgFps)} fps` : 'fps n/a';
    const avgLabel = typeof avgFrameMs === 'number' ? `${avgFrameMs.toFixed(1)} ms avg` : 'avg n/a';
    const p95Label = overlayFrameTelemetry.latestMs != null
      ? `${overlayFrameTelemetry.latestMs.toFixed(1)} ms p95`
      : 'p95 n/a';
    const targetLabel = withinTarget === true
      ? 'within 120 fps target'
      : withinTarget === false
        ? 'over 120 fps budget'
        : 'target status n/a';
    return `${fpsLabel} • ${avgLabel} • ${p95Label} • ${targetLabel}`;
  }, [overlayFrameTelemetry]);
  const filteredFolderIconOptions = useMemo(() => {
    const query = folderIconSearch.trim().toLowerCase();
    if (!query) {
      return FOLDER_ICON_OPTIONS;
    }

    return FOLDER_ICON_OPTIONS.filter(option => option.label.toLowerCase().includes(query) || option.value.toLowerCase().includes(query));
  }, [folderIconSearch]);
  const overviewStats = useMemo(() => [
    {
      id: 'theme',
      label: 'Theme',
      value: effectiveTheme.name,
    },
    {
      id: 'layout',
      label: 'Layout',
      value: activeLayoutProfile.label,
    },
    {
      id: 'startup',
      label: 'Startup',
      value: settings.system.launchAtStartup ? 'Ready at sign-in' : 'Manual launch',
    },
    {
      id: 'source',
      label: 'Source',
      value: 'Explorer import + file actions live',
    },
    {
      id: 'frames',
      label: 'Frame Telemetry',
      value: overlayFrameValue,
    },
  ], [activeLayoutProfile.label, effectiveTheme.name, overlayFrameValue, settings.system.launchAtStartup]);
  const overviewWorkflows = useMemo(() => [
    {
      id: 'explorer-to-source',
      icon: <GitBranch size={13} />,
      title: 'Explorer -> Source',
      description: 'Navigate to a repo in Explorer, confirm it for Source, then stage, diff, commit, or quick ship without leaving the overlay.',
      actionLabel: 'Explorer Settings',
      action: () => setActiveSection('explorer'),
    },
    {
      id: 'terminal-and-layout',
      icon: <TerminalSquare size={13} />,
      title: 'Terminal + Layouts',
      description: 'Tune the shell, choose how external handoff behaves, and swap layout profiles so the overlay matches the machine you are driving.',
      actionLabel: 'Terminal Settings',
      action: () => setActiveSection('terminal'),
    },
    {
      id: 'plugins-and-assets',
      icon: <Puzzle size={13} />,
      title: 'Plugins + Assets',
      description: 'Drop plugins, themes, wallpapers, shaders, and animations into their workspace folders so GreebleFS can discover them as live runtime modules.',
      actionLabel: 'Appearance Settings',
      action: () => setActiveSection('appearance'),
    },
    {
      id: 'capture-proof',
      icon: <Camera size={13} />,
      title: 'Screenshots + Proof',
      description: 'Capture the current desktop, annotate details, and save or copy release proof from the built-in screenshot workflow.',
      actionLabel: 'Screenshot Settings',
      action: () => setActiveSection('screenshots'),
    },
  ], [setActiveSection]);
  const workspaceRoots = useMemo(() => managedContentDirectoryCatalog.map(entry => ({
    id: entry.id,
    label: entry.label,
    path: getManagedContentDirectory(entry.id as ManagedContentDirectoryId),
    description: entry.description,
  })), []);
  const settingsJumpCards = useMemo(() => settingsSectionCatalog
    .filter(section => section.featuredInOverview)
    .map(section => ({
      id: section.key,
      title: section.label,
      summary: section.overviewSummary,
      action: () => setActiveSection(section.key as SettingsSectionKey),
    })), [setActiveSection]);
  const connectedCloudAccountCount = safeCloudSnapshot.accounts.filter(account => account.status === 'connected').length;
  const configuredCloudProviderCount = safeCloudSnapshot.providers.filter(provider => provider.configured).length;

  const patchFolderRules = useCallback((rules: FolderIconRule[]) => {
    updateExplorer({ folderIconRules: rules });
  }, [updateExplorer]);

  const updateFolderRule = useCallback((ruleId: string, patch: Partial<FolderIconRule>) => {
    patchFolderRules(
      settings.explorer.folderIconRules.map(rule => (rule.id === ruleId ? { ...rule, ...patch } : rule)),
    );
  }, [patchFolderRules, settings.explorer.folderIconRules]);

  const removeFolderRule = useCallback((ruleId: string) => {
    patchFolderRules(settings.explorer.folderIconRules.filter(rule => rule.id !== ruleId));
  }, [patchFolderRules, settings.explorer.folderIconRules]);

  const addFolderRule = useCallback(() => {
    patchFolderRules([
      ...settings.explorer.folderIconRules,
      {
        id: `custom-${Date.now()}`,
        label: 'Custom Rule',
        matchers: [],
        icon: settings.explorer.defaultFolderIcon,
      },
    ]);
  }, [patchFolderRules, settings.explorer.defaultFolderIcon, settings.explorer.folderIconRules]);

  const setLaunchAtStartup = useCallback(async (enabled: boolean) => {
    setStartupSyncPending(true);
    setStartupSyncError(null);
    try {
      const nextValue = await commands.startupSetLaunchAtStartup(enabled).then(unwrapTauriResult);
      updateSystem({ launchAtStartup: nextValue });
    } catch (error) {
      setStartupSyncError(String(error));
    } finally {
      setStartupSyncPending(false);
    }
  }, [updateSystem]);

  useEffect(() => {
    if (platform !== 'linux') {
      setLinuxDisplayBackendStatus(null);
      setLinuxDisplayBackendSyncPending(false);
      setLinuxDisplayBackendSyncError(null);
      return;
    }

    let cancelled = false;
    setLinuxDisplayBackendSyncPending(true);
    setLinuxDisplayBackendSyncError(null);

    commands.startupGetLinuxDisplayBackendStatus()
      .then(unwrapTauriResult)
      .then(status => {
        if (cancelled) {
          return;
        }

        setLinuxDisplayBackendStatus(status);
        updateSystem({ linuxDisplayBackendPreference: status.preferredBackend });
      })
      .catch(error => {
        if (!cancelled) {
          setLinuxDisplayBackendStatus(null);
          setLinuxDisplayBackendSyncError(String(error));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLinuxDisplayBackendSyncPending(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [platform, updateSystem]);

  useEffect(() => {
    if (activeSection !== 'system') {
      return;
    }

    let cancelled = false;
    setTelemetryStatusPending(true);
    setTelemetryStatusError(null);

    getTelemetryStatus()
      .then(status => {
        if (!cancelled) {
          setTelemetryStatus(status);
        }
      })
      .catch(error => {
        if (!cancelled) {
          setTelemetryStatus(null);
          setTelemetryStatusError(String(error));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setTelemetryStatusPending(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    activeSection,
    settings.system.consumerDiagnosticsEnabled,
    settings.system.developerTelemetryCaptureMode,
    settings.system.developerTelemetryEnabled,
    settings.system.developerTelemetryMaxFileSizeMb,
    settings.system.developerTelemetryPayloadMode,
    settings.system.developerTelemetryWriteToFile,
  ]);

  const refreshTelemetryStatus = useCallback(async () => {
    setTelemetryStatusPending(true);
    setTelemetryStatusError(null);
    try {
      setTelemetryStatus(await getTelemetryStatus());
    } catch (error) {
      setTelemetryStatus(null);
      setTelemetryStatusError(String(error));
    } finally {
      setTelemetryStatusPending(false);
    }
  }, []);

  const handleTelemetryExport = useCallback(async () => {
    setTelemetryActionPending('export');
    setTelemetryNotice(null);
    setTelemetryStatusError(null);
    try {
      const result = await exportTelemetrySupportBundle();
      setTelemetryNotice(`Support bundle written to ${result.export_path}`);
      await refreshTelemetryStatus();
    } catch (error) {
      setTelemetryStatusError(String(error));
    } finally {
      setTelemetryActionPending(null);
    }
  }, [refreshTelemetryStatus]);

  const handleTelemetryClear = useCallback(async () => {
    setTelemetryActionPending('clear');
    setTelemetryNotice(null);
    setTelemetryStatusError(null);
    try {
      await clearTelemetrySessions();
      setTelemetryNotice('Telemetry sessions cleared.');
      await refreshTelemetryStatus();
    } catch (error) {
      setTelemetryStatusError(String(error));
    } finally {
      setTelemetryActionPending(null);
    }
  }, [refreshTelemetryStatus]);

  const setHideAppInTray = useCallback((enabled: boolean) => {
    updateSystem({
      hideAppInTray: enabled,
      ...(enabled ? {} : { showInTaskbar: true }),
    });
  }, [updateSystem]);

  const setShowInTaskbar = useCallback((enabled: boolean) => {
    updateSystem({
      showInTaskbar: enabled,
      ...(enabled ? {} : { hideAppInTray: true }),
    });
  }, [updateSystem]);

  const setLinuxDisplayBackendPreference = useCallback(async (preferredBackend: LinuxDisplayBackendPreference) => {
    setLinuxDisplayBackendSyncPending(true);
    setLinuxDisplayBackendSyncError(null);
    try {
      const nextStatus = await commands
        .startupSetLinuxDisplayBackendPreference(preferredBackend)
        .then(unwrapTauriResult);
      setLinuxDisplayBackendStatus(nextStatus);
      updateSystem({ linuxDisplayBackendPreference: nextStatus.preferredBackend });
    } catch (error) {
      setLinuxDisplayBackendSyncError(String(error));
    } finally {
      setLinuxDisplayBackendSyncPending(false);
    }
  }, [updateSystem]);

  const setShaderControlValue = useCallback((
    shader: LoadedOverlayShader,
    control: OverlayShaderControlDefinition,
    rawValue: number,
  ) => {
    const existingShaderValues = settings.appearance.shaderControlValues[shader.id] ?? {};
    const fallbackValue = typeof effectiveShaderComputedUniforms[control.id] === 'number'
      ? effectiveShaderComputedUniforms[control.id] as number
      : control.defaultValue;
    const normalizedValue = normalizeShaderControlValue(control, rawValue, fallbackValue);
    const defaultValue = resolveShaderControlValues(shader, undefined, effectiveShaderComputedUniforms)[control.id];
    const nextShaderValues = { ...existingShaderValues };

    if (typeof defaultValue === 'number' && Math.abs(normalizedValue - defaultValue) < Number.EPSILON * 10) {
      delete nextShaderValues[control.id];
    } else {
      nextShaderValues[control.id] = normalizedValue;
    }

    const nextShaderControlValues = { ...settings.appearance.shaderControlValues };
    if (Object.keys(nextShaderValues).length === 0) {
      delete nextShaderControlValues[shader.id];
    } else {
      nextShaderControlValues[shader.id] = nextShaderValues;
    }

    updateAppearance({ shaderControlValues: nextShaderControlValues });
  }, [
    effectiveShaderComputedUniforms,
    settings.appearance.shaderControlValues,
    updateAppearance,
  ]);

  const settingsSectionContext = useMemo<SettingsSectionContentContext>(() => ({
    effectiveThemeName: effectiveTheme.name,
    activeLayoutLabel: activeLayoutProfile.label,
    workspaceRootCount: workspaceRoots.length,
    installedModelCount: installedLocalModelCount,
    localModelCacheFootprint,
    semanticIndexModelSummary,
    launchAtStartup: settings.system.launchAtStartup,
    systemPresentationState,
    platform: platform as SettingsSectionContentContext['platform'],
    terminalWindowMode: settings.terminal.windowMode,
    terminalPreferredOpenMode: settings.terminal.preferredOpenMode,
    terminalCursorStyle: settings.terminal.cursorStyle,
    explorerViewModeLabel: getExplorerViewModeDefinition(settings.explorer.viewMode).label,
    explorerFolderClickMode: settings.explorer.folderClickMode,
    explorerThumbnailsEnabled: settings.explorer.thumbnails.enabled,
    homePackSummary,
    layoutProfileCount: layoutManifestState.manifest.profiles.length,
    zenFocusMode: settings.layout.zenFocusMode,
    hotkeyLabels: [
      settings.keybindings.terminalToggle,
      settings.keybindings.windowModeToggle,
      settings.keybindings.zenFocusModeToggle,
    ].map(formatHotkeyLabel),
    connectedCloudAccountCount,
    configuredCloudProviderCount,
    screenshotDefaultCaptureMode: settings.screenshots.defaultCaptureMode,
    screenshotDefaultOutputAction: settings.screenshots.defaultOutputAction,
    screenshotShowGrid: settings.screenshots.showGrid,
    audioFolderCount: settings.audio.vst3AdditionalFolders.length,
    availableWallpapersCount: availableWallpapers.length,
    themeWallpaperAvailable,
    wallpaperFailureCount: wallpaperFailures.length,
    availableShadersCount: availableShaders.length,
    shaderPerformanceLabel: shaderPerformanceProfile.label,
    shaderFailureCount: shaderFailures.length,
    availableAnimationsCount: availableAnimations.length,
    animationFailureCount: animationFailures.length,
    interactionMotionEnabled: settings.appearance.interactionMotionEnabled,
    interactionMotionProfileLabel: effectiveInteractionMotionProfileLabel,
    interactionMotionSurfaceCount: interactionMotionSurfaceCatalog.length,
    topBarSelectionSummary,
    availableTopBarsCount: availableTopBars.length,
    followThemeTopBarDetail,
    iconThemeSelectionSummary,
    appOpacity: settings.appearance.appOpacity,
    panelTransparency: settings.appearance.panelTransparency,
    appZoom: settings.appearance.appZoom,
    appBlurStrength: settings.appearance.appBlurStrength,
  }), [
    activeLayoutProfile.label,
    animationFailures.length,
    availableAnimations.length,
    availableShaders.length,
    availableTopBars.length,
    availableWallpapers.length,
    connectedCloudAccountCount,
    configuredCloudProviderCount,
    effectiveTheme.name,
    effectiveInteractionMotionProfileLabel,
    followThemeTopBarDetail,
    homePackSummary,
    iconThemeSelectionSummary,
    installedLocalModelCount,
    interactionMotionSurfaceCatalog.length,
    layoutManifestState.manifest.profiles.length,
    localModelCacheFootprint,
    platform,
    semanticIndexModelSummary,
    settings.audio.vst3AdditionalFolders.length,
    settings.appearance.appBlurStrength,
    settings.appearance.appOpacity,
    settings.appearance.interactionMotionEnabled,
    settings.appearance.appZoom,
    settings.appearance.panelTransparency,
    settings.explorer.folderClickMode,
    settings.explorer.thumbnails.enabled,
    settings.explorer.viewMode,
    settings.keybindings.terminalToggle,
    settings.keybindings.windowModeToggle,
    settings.keybindings.zenFocusModeToggle,
    settings.layout.zenFocusMode,
    settings.screenshots.defaultCaptureMode,
    settings.screenshots.defaultOutputAction,
    settings.screenshots.showGrid,
    settings.system.launchAtStartup,
    shaderFailures.length,
    shaderPerformanceProfile.label,
    systemPresentationState,
    themeWallpaperAvailable,
    topBarSelectionSummary,
    workspaceRoots.length,
  ]);

  const settingsSections = useMemo(() => settingsSectionCatalog.map(section => {
    const content = getSettingsSectionContent(section.key as SettingsSectionKey, settingsSectionContext);
    return {
      key: section.key as SettingsSectionKey,
      label: section.label,
      subtitle: section.subtitle,
      summary: content.summary,
      detail: content.detail,
      icon: getSettingsSectionIcon(section.key as SettingsSectionKey),
    };
  }), [settingsSectionContext]);
  const activeSectionMeta = settingsSections.find(section => section.key === activeSection) ?? settingsSections[0];
  const ActiveHomePackSettingsComponent = activeHomePack?.runtime.settingsComponent ?? null;

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        minHeight: 0,
        minWidth: 0,
        fontFamily: appearance.fonts.ui,
        colorScheme: settingsFormColorScheme,
        background: 'var(--overlay-workbench-settings-bg)',
        gap: 'var(--overlay-workbench-panel-gap)',
        padding: 'var(--overlay-workbench-page-padding)',
      }}
    >
      <ResizablePane
        size={railWidth}
        minSize={190}
        maxSize={320}
        onSizeChange={setRailWidth}
        borderColor={`${accent}55`}
        style={{
          display: 'flex',
          minHeight: 0,
          flexDirection: 'column',
          border: `1px solid var(--overlay-workbench-settings-card-border)`,
          borderRadius: workbench.metrics.panelRadius,
          background: 'var(--overlay-workbench-settings-rail-bg)',
          boxShadow: workbench.settingsStyle === 'floating' || workbench.settingsStyle === 'glass'
            ? 'var(--overlay-workbench-shell-shadow)'
            : 'none',
          backdropFilter: blurEnabled && workbench.settingsStyle === 'glass' ? 'blur(18px)' : 'none',
          WebkitBackdropFilter: blurEnabled && workbench.settingsStyle === 'glass' ? 'blur(18px)' : 'none',
          overflow: 'hidden',
        }}
      >
        <div className="border-b px-4 py-3" style={{ borderColor: border }}>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: muted }}>
            <SlidersHorizontal size={12} />
            <span>Workbench Settings</span>
          </div>
          <h1 className="mt-1.5 text-[16px] font-semibold leading-none" style={{ color: text }}>Settings</h1>
        </div>

        <OverlayScrollArea style={{ flex: 1, minHeight: 0 }} viewportStyle={{ padding: '8px 10px 10px 10px' }}>
          <div className="space-y-2">
            {settingsSections.map(section => (
              <SettingsRailButton
                key={section.key}
                active={activeSection === section.key}
                icon={section.icon}
                label={section.label}
                subtitle={section.subtitle}
                summary={section.summary}
                accent={accent}
                border={border}
                text={text}
                muted={muted}
                onClick={() => setActiveSection(section.key)}
                motionBinding={bindSettingsCardMotion(activeSection === section.key)}
              />
            ))}
          </div>
        </OverlayScrollArea>
      </ResizablePane>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="border-b px-4 py-3" style={{ borderColor: 'var(--overlay-workbench-settings-card-border)', borderRadius: workbench.settingsStyle === 'floating' || workbench.settingsStyle === 'glass' ? workbench.metrics.panelRadius : 0, background: 'var(--overlay-workbench-settings-card-bg)' }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="min-w-[240px] flex-1 text-[11px] leading-4" style={{ color: muted }}>
                {activeSectionMeta.detail}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
              <span
                className="rounded px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.12em]"
                style={{ border: '1px solid var(--overlay-workbench-settings-badge-border)', color: muted, background: 'var(--overlay-workbench-settings-badge-bg)' }}
              >
                Theme · {effectiveTheme.name}
              </span>
              <span
                className="rounded px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.12em]"
                style={{ border: '1px solid var(--overlay-workbench-settings-badge-border)', color: muted, background: 'var(--overlay-workbench-settings-badge-bg)' }}
              >
                Layout · {activeLayoutProfile.label}
              </span>
              <span
                className="rounded px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.12em]"
                style={{ border: '1px solid var(--overlay-workbench-settings-badge-border)', color: muted, background: 'var(--overlay-workbench-settings-badge-bg)' }}
              >
                Startup · {settings.system.launchAtStartup ? 'Enabled' : 'Disabled'}
              </span>
              <span
                className="hidden rounded px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] xl:inline-flex"
                style={{ border: '1px solid var(--overlay-workbench-settings-badge-border)', color: muted, background: 'var(--overlay-workbench-settings-badge-bg)' }}
              >
                {activeSectionMeta.summary}
              </span>
              <button
                onClick={() => resetToDefaults()}
                className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors"
                style={{ border: '1px solid var(--overlay-workbench-settings-badge-border)', color: text, background: 'var(--overlay-workbench-settings-badge-bg)' }}
              >
                <RotateCcw size={12} />
                Reset Defaults
              </button>
            </div>
          </div>
        </div>

        <OverlayScrollArea style={{ flex: 1, minHeight: 0 }} viewportStyle={{ padding: 0 }}>
          <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-3 pb-5">
            {activeSection === 'overview' && (
              <section className="rounded border p-4" style={{ borderColor: 'var(--overlay-workbench-settings-card-border)', background: 'var(--overlay-workbench-settings-card-bg)' }}>
                <SectionTitle
                  icon={<Sparkles size={12} />}
                  title="Overview"
                  subtitle="First-run orientation, workspace roots, and the settings slices that matter most for a credible ship candidate."
                />

                <div className="mt-4 space-y-4">
                  <div className="rounded border p-4" style={{ borderColor: `${accent}44`, background: `${accent}0d` }}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="max-w-[640px]">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: muted }}>GreebleFS Control Surface</div>
                        <h2 className="mt-2 text-[18px] font-semibold" style={{ color: text }}>Ship the shell, not a template.</h2>
                        <p className="mt-2 text-[12px] leading-5" style={{ color: muted }}>
                          GreebleFS is a desktop workbench with a live terminal, file explorer, source-control rail, plugin host, theme and motion authoring, and screenshot proof capture in one surface.
                        </p>
                      </div>
                      <div className="grid min-w-[220px] flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
                        {overviewStats.map(stat => (
                          <div
                            key={stat.id}
                            className="rounded border px-3 py-2"
                            style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' }}
                          >
                            <div className="text-[9px] font-semibold uppercase tracking-[0.12em]" style={{ color: muted }}>{stat.label}</div>
                            <div className="mt-1 text-[12px] font-semibold" style={{ color: text }}>{stat.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <OverviewCard
                    title="Core Workflows"
                    subtitle="These are the panel handoffs operators need to understand on first contact."
                    badges={['Explorer', 'Source', 'Plugins', 'Screenshots']}
                  >
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {overviewWorkflows.map(workflow => (
                        <div
                          key={workflow.id}
                          className="rounded border p-3"
                          style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}
                        >
                          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: muted }}>
                            {workflow.icon}
                            <span>{workflow.title}</span>
                          </div>
                          <p className="mt-2 text-[11px] leading-5" style={{ color: muted }}>{workflow.description}</p>
                          <button
                            type="button"
                            onClick={workflow.action}
                            className="mt-3 rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                            style={{ border: `1px solid ${border}`, background: 'rgba(255,255,255,0.04)', color: text }}
                          >
                            {workflow.actionLabel}
                          </button>
                        </div>
                      ))}
                    </div>
                  </OverviewCard>

                  <OverviewCard
                    title="Workspace Roots"
                    subtitle="Open or create the directories that feed GreebleFS runtime discovery."
                    badges={[`${workspaceRoots.length} roots`, 'Create on demand']}
                  >
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {workspaceRoots.map(root => (
                        <div
                          key={root.id}
                          className="rounded border p-3"
                          style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-[11px] font-semibold" style={{ color: text }}>{root.label}</div>
                              <p className="mt-1 text-[11px] leading-4" style={{ color: muted }}>{root.description}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => void openWorkspaceDirectory(root.label, root.path)}
                              className="rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                              style={{ border: `1px solid ${accent}55`, background: `${accent}16`, color: text }}
                            >
                              Open {root.label} Folder
                            </button>
                          </div>
                          <div className="mt-3 rounded border px-3 py-2 text-[10px]" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.12)', color: muted, fontFamily: appearance.fonts.mono }}>
                            {root.path}
                          </div>
                        </div>
                      ))}
                    </div>
                    {overviewNotice ? (
                      <div className="mt-3 rounded border px-3 py-2 text-[11px]" style={{ borderColor: `${accent}44`, background: `${accent}12`, color: text }}>
                        {overviewNotice}
                      </div>
                    ) : null}
                    {overviewError ? (
                      <div className="mt-3 rounded border px-3 py-2 text-[11px]" style={{ borderColor: '#7f1d1d', background: 'rgba(127,29,29,0.18)', color: '#fecaca' }}>
                        {overviewError}
                      </div>
                    ) : null}
                  </OverviewCard>

                  <OverviewCard
                    title="Settings Shortcuts"
                    subtitle="Jump straight to the settings surfaces most likely to unblock a real release session."
                    badges={['System', 'Terminal', 'Explorer', 'Layouts']}
                  >
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      {settingsJumpCards.map(card => (
                        <button
                          key={card.id}
                          type="button"
                          onClick={card.action}
                          className="rounded px-3 py-3 text-left transition-colors"
                          style={{ border: `1px solid ${border}`, background: 'rgba(255,255,255,0.03)', color: text }}
                        >
                          <div className="text-[11px] font-semibold">{card.title}</div>
                          <div className="mt-1 text-[11px] opacity-45">{card.summary}</div>
                        </button>
                      ))}
                    </div>
                  </OverviewCard>
                </div>
              </section>
            )}

            {activeSection === 'models' && (
              <section className="rounded border p-4" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
                <SectionTitle
                  icon={<Bot size={12} />}
                  title="Models"
                  subtitle="Shared local-model management for semantic indexing now, with the same cache and capability routing ready for future inference, source separation, and other Python-backed AI lanes."
                />

                <div className="mt-4 space-y-4">
                  <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                    <OverviewCard
                      title="Managed Cache"
                      subtitle="Curated models download into the shared managed runtime cache so future AI features reuse one install surface."
                      badges={[
                        `${installedLocalModelCount} installed`,
                        localModelCacheFootprint,
                        localModelStatusPending ? 'Refreshing' : 'Ready',
                      ]}
                    >
                      <div className="space-y-3">
                        <div className="rounded border px-3 py-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                            <Database size={11} />
                            <span>Cache Location</span>
                          </div>
                          <div className="mt-2 break-all text-[11px]" style={{ color: text, fontFamily: appearance.fonts.mono }}>
                            {localModelStatus?.cacheRoot ?? managedPythonRuntimeConfig?.runtimeRoot ?? 'Initialize the managed Python runtime to resolve the cache root.'}
                          </div>
                          {localModelStatus ? (
                            <div className="mt-2 text-[10px] opacity-45">
                              Python {localModelStatus.pythonVersion} · registry {localModelStatus.registryRoot}
                            </div>
                          ) : (
                            <div className="mt-2 text-[10px] opacity-45">
                              Model cache metadata appears after the first catalog refresh.
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void refreshLocalModels(true)}
                            disabled={localModelStatusPending}
                            className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                            style={{
                              border: `1px solid ${localModelStatusPending ? border : accent}`,
                              background: localModelStatusPending ? 'rgba(255,255,255,0.03)' : `${accent}16`,
                              color: text,
                              opacity: localModelStatusPending ? 0.72 : 1,
                            }}
                          >
                            {localModelStatusPending ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                            Refresh Models
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleOpenLocalModelCache()}
                            className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                            style={{ border: `1px solid ${border}`, background: 'rgba(255,255,255,0.03)', color: text }}
                          >
                            <FolderOpen size={11} />
                            Open Cache Folder
                          </button>
                        </div>
                      </div>
                    </OverviewCard>

                    <OverviewCard
                      title="Acceleration Lane"
                      subtitle="Backend preferences stay explicit. CUDA is optional, and the UI only offers the NVIDIA lane when the acceleration runtime actually detects it."
                      badges={[
                        cudaProviderReady ? 'CUDA ready' : 'CUDA unavailable',
                        settings.system.accelerationRoutingMode,
                        cudaProviderStatus?.available ? 'provider detected' : 'cpu fallback',
                      ]}
                    >
                      <div className="space-y-3">
                        <div className="rounded border px-3 py-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                            <Cpu size={11} />
                            <span>CUDA Python Provider</span>
                          </div>
                          <div className="mt-2 text-[11px]" style={{ color: text }}>
                            {cudaProviderStatus?.label ?? 'CUDA Python Sidecar'}
                          </div>
                          <p className="mt-1 text-[11px] leading-4 opacity-45">
                            {cudaProviderStatus?.detail
                              ?? 'The acceleration runtime has not reported a CUDA-ready provider yet, so CPU and ONNX remain the portable lanes.'}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void handleProbeAccelerationPipeline()}
                            disabled={accelerationProbePending}
                            className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                            style={{
                              border: `1px solid ${accelerationProbePending ? border : accent}`,
                              background: accelerationProbePending ? 'rgba(255,255,255,0.03)' : `${accent}16`,
                              color: text,
                              opacity: accelerationProbePending ? 0.72 : 1,
                            }}
                          >
                            {accelerationProbePending ? <Loader2 size={11} className="animate-spin" /> : <Cpu size={11} />}
                            Probe CUDA / AI
                          </button>
                        </div>

                        <div className="rounded border px-3 py-2 text-[11px]" style={{ borderColor: border, background: 'rgba(255,255,255,0.02)', color: muted }}>
                          {accelerationPipelineStatus}
                        </div>
                      </div>
                    </OverviewCard>

                    <OverviewCard
                      title="Active Semantic Lane"
                      subtitle="Semantic indexing is the first capability online, but the binding model is shared so future local-model features land on the same contract."
                      badges={[
                        semanticIndexingSelectedModel?.label ?? 'No model',
                        semanticIndexingBackendLabel,
                        semanticIndexingSelectedHardwareProfile?.label ?? 'Profile pending',
                      ]}
                    >
                      <div className="space-y-3">
                        <div className="rounded border px-3 py-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                            <Bot size={11} />
                            <span>Current Active Model</span>
                          </div>
                          <div className="mt-2 text-[11px]" style={{ color: text }}>
                            {semanticIndexingSelectedModel?.label ?? 'No semantic model selected'}
                          </div>
                          <p className="mt-1 text-[11px] leading-4 opacity-45">
                            {semanticIndexingSelectedModel?.description
                              ?? 'Choose a curated embedding model below to drive semantic indexing and similarity search.'}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <ThemeBadge label={`Backend ${semanticIndexingBackendLabel}`} active />
                            <ThemeBadge label={semanticIndexingSelectedModelStatus?.installed ? 'Installed' : 'Not warmed'} />
                            {semanticIndexingSelectedHardwareProfile
                              ? <ThemeBadge label={semanticIndexingSelectedHardwareProfile.label} />
                              : null}
                          </div>
                        </div>

                        <div className="rounded border px-3 py-2 text-[11px]" style={{ borderColor: border, background: 'rgba(255,255,255,0.02)', color: muted }}>
                          {semanticIndexOverrideEntries.length > 0
                            ? `${semanticIndexOverrideEntries.length} per-root override${semanticIndexOverrideEntries.length === 1 ? '' : 's'} pinned for semantic indexing.`
                            : 'No per-root semantic overrides yet; the default semantic binding applies to every local index root.'}
                        </div>
                      </div>
                    </OverviewCard>
                  </div>

                  {localModelNotice ? (
                    <div className="rounded border px-3 py-2 text-[11px]" style={{ borderColor: `${accent}44`, background: `${accent}12`, color: text }}>
                      {localModelNotice}
                    </div>
                  ) : null}
                  {localModelStatusError ? (
                    <div className="rounded border px-3 py-2 text-[11px]" style={{ borderColor: '#7f1d1d', background: 'rgba(127,29,29,0.18)', color: '#fecaca' }}>
                      {localModelStatusError}
                    </div>
                  ) : null}

                  <OverviewCard
                    title="Capability Routing"
                    subtitle="Model and backend bindings are capability-driven. Semantic indexing is live now; local inference and source separation stay visible so the settings surface does not have to be reinvented when those lanes arrive."
                    badges={['Shared bindings', 'Capability-first', 'Future-ready']}
                  >
                    <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                      {localModelCapabilityCatalog.map(capability => {
                        const binding = settings.models.capabilityBindings[capability.id] ?? {
                          modelId: capability.defaultModelId,
                          backendPreference: capability.defaultBackendPreference,
                        };
                        const selectedModel = getLocalModelDefinition(binding.modelId)
                          ?? getLocalModelDefinitionByProviderModelId(binding.modelId);
                        const selectedModelStatus = selectedModel
                          ? localModelStatusById.get(selectedModel.id) ?? null
                          : null;
                        const capabilityModels = getCapabilityModels(capability.id);

                        return (
                          <div
                            key={capability.id}
                            className="rounded border p-3"
                            style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-[11px] font-semibold" style={{ color: text }}>{capability.label}</div>
                                <p className="mt-1 text-[11px] leading-4 opacity-45">{capability.description}</p>
                              </div>
                              <ThemeBadge label={capability.availability === 'active' ? 'Active' : 'Planned'} active={capability.availability === 'active'} />
                            </div>

                            {capability.availability === 'active' ? (
                              <div className="mt-3 space-y-3">
                                <label className="block">
                                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Model</div>
                                  <select
                                    aria-label={`${capability.label} model`}
                                    value={binding.modelId ?? ''}
                                    onChange={event => handleUpdateModelCapabilityBinding(capability.id, {
                                      modelId: event.target.value || null,
                                    })}
                                    className="mt-2 w-full rounded border px-3 py-2 text-[11px] outline-none"
                                    style={settingsSelectStyle}
                                  >
                                    {capabilityModels.map(model => (
                                      <option key={model.id} value={model.id}>
                                        {model.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>

                                <div>
                                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Backend</div>
                                  <div className="mt-2 grid grid-cols-2 gap-2">
                                    {localModelBackendOptions
                                      .filter(option => capability.backendOptionIds.includes(option.id))
                                      .map(option => {
                                        const active = binding.backendPreference === option.id;
                                        const disabled = option.id === 'cuda' && !cudaProviderReady;
                                        return (
                                          <button
                                            key={`${capability.id}-${option.id}`}
                                            type="button"
                                            aria-label={`Use ${option.label} backend for ${capability.label}`}
                                            onClick={() => {
                                              if (!disabled) {
                                                handleUpdateModelCapabilityBinding(capability.id, {
                                                  backendPreference: option.id,
                                                });
                                              }
                                            }}
                                            disabled={disabled}
                                            title={disabled ? 'CUDA is unavailable until an NVIDIA-capable sidecar provider is detected.' : option.description}
                                            className="rounded px-3 py-2 text-left transition-colors"
                                            style={{
                                              border: `1px solid ${active ? accent : border}`,
                                              background: active ? `${accent}16` : 'rgba(255,255,255,0.03)',
                                              color: text,
                                              opacity: disabled ? 0.45 : 1,
                                              cursor: disabled ? 'not-allowed' : 'pointer',
                                            }}
                                          >
                                            <div className="text-[10px] font-semibold uppercase tracking-[0.12em]">{option.label}</div>
                                            <div className="mt-1 text-[10px] leading-4 opacity-55">{option.description}</div>
                                          </button>
                                        );
                                      })}
                                  </div>
                                </div>

                                <div className="rounded border px-3 py-2 text-[10px]" style={{ borderColor: border, background: 'rgba(255,255,255,0.02)', color: muted }}>
                                  {selectedModel?.label ?? 'No model selected'} · {selectedModelStatus?.installed ? 'Installed' : 'Not warmed'}
                                  {selectedModel ? ` · ${formatLocalModelEstimatedFootprint(selectedModel.estimatedFootprintMb)}` : ''}
                                </div>
                              </div>
                            ) : (
                              <div className="mt-3 rounded border px-3 py-3 text-[11px]" style={{ borderColor: border, background: 'rgba(255,255,255,0.02)', color: muted }}>
                                Curated models for this capability have not been published yet. The shared cache and capability binding system is already in place, so this lane can come online without another settings refactor.
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </OverviewCard>

                  <OverviewCard
                    title="Installed Model Catalog"
                    subtitle="Curated models stay visible even before they are warmed so operators can see the intended hardware profile, backend bias, and cache footprint before downloading anything."
                    badges={[`${localModelDefinitions.length} curated`, 'Download on demand', 'Shared cache']}
                  >
                    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                      {localModelDefinitions.map(model => {
                        const status = localModelStatusById.get(model.id) ?? null;
                        const hardwareProfile = getLocalModelHardwareProfile(model.hardwareProfileId);
                        const recommendedBackendLabel = localModelBackendOptions.find(
                          option => option.id === model.recommendedBackendPreference,
                        )?.label ?? model.recommendedBackendPreference;
                        const prewarmDisabled = modelPrewarmPendingId != null && modelPrewarmPendingId !== model.id;
                        const semanticModelActive = semanticIndexingBinding.modelId === model.id;

                        return (
                          <div
                            key={model.id}
                            className="rounded border p-3"
                            style={{
                              borderColor: semanticModelActive ? `${accent}66` : border,
                              background: semanticModelActive ? `${accent}0f` : 'rgba(255,255,255,0.025)',
                            }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-[11px] font-semibold" style={{ color: text }}>{model.label}</div>
                                <p className="mt-1 text-[11px] leading-4 opacity-45">{model.description}</p>
                              </div>
                              <div className="flex flex-wrap justify-end gap-1.5">
                                {semanticModelActive ? <ThemeBadge label="Active Semantic Model" active /> : null}
                                <ThemeBadge label={status?.installed ? 'Installed' : 'Not Warmed'} active={status?.installed === true} />
                              </div>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {hardwareProfile ? <ThemeBadge label={hardwareProfile.label} /> : null}
                              <ThemeBadge label={`Recommend ${recommendedBackendLabel}`} />
                              <ThemeBadge label={formatLocalModelEstimatedFootprint(model.estimatedFootprintMb)} />
                              {model.tags.slice(0, 3).map(tag => (
                                <ThemeBadge key={`${model.id}-${tag}`} label={tag} />
                              ))}
                            </div>

                            <div className="mt-3 rounded border px-3 py-3 text-[10px]" style={{ borderColor: border, background: 'rgba(255,255,255,0.02)', color: muted }}>
                              <div style={{ fontFamily: appearance.fonts.mono }}>{model.providerModelId}</div>
                              <div className="mt-2">
                                Last warmed: {formatModelTimestamp(status?.lastWarmedAtMs)}
                              </div>
                              <div className="mt-1">
                                Last used: {formatModelTimestamp(status?.lastUsedAtMs)}
                              </div>
                              {status?.backendKinds.length ? (
                                <div className="mt-2">Backends: {status.backendKinds.join(', ')}</div>
                              ) : null}
                              {status?.providerKinds.length ? (
                                <div className="mt-1">Providers: {status.providerKinds.join(', ')}</div>
                              ) : null}
                              {status?.lastError ? (
                                <div className="mt-2 rounded border px-2 py-1.5" style={{ borderColor: 'rgba(245,158,11,0.35)', background: 'rgba(245,158,11,0.08)', color: text }}>
                                  {status.lastError}
                                </div>
                              ) : null}
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => handleUpdateModelCapabilityBinding(semanticIndexingCapabilityId, { modelId: model.id })}
                                className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                                style={{
                                  border: `1px solid ${semanticModelActive ? accent : border}`,
                                  background: semanticModelActive ? `${accent}16` : 'rgba(255,255,255,0.03)',
                                  color: text,
                                }}
                              >
                                <Bot size={11} />
                                {semanticModelActive ? 'Semantic Default' : 'Use For Semantic Indexing'}
                              </button>
                              <button
                                type="button"
                                onClick={() => void handlePrewarmLocalModel(
                                  model.id,
                                  model.capabilityIds[0] ?? semanticIndexingCapabilityId,
                                  normalizeLocalModelBackendPreference(model.recommendedBackendPreference),
                                )}
                                disabled={prewarmDisabled}
                                className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                                style={{
                                  border: `1px solid ${accent}`,
                                  background: `${accent}16`,
                                  color: text,
                                  opacity: prewarmDisabled ? 0.52 : 1,
                                }}
                              >
                                {modelPrewarmPendingId === model.id ? (
                                  <Loader2 size={11} className="animate-spin" />
                                ) : (
                                  <Download size={11} />
                                )}
                                {status?.installed ? 'Rewarm Model' : 'Download / Prewarm'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </OverviewCard>

                  {semanticIndexingCapability && semanticIndexingCapability.supportsPerRootOverrides ? (
                    <OverviewCard
                      title="Semantic Index Root Overrides"
                      subtitle="Pin a specific embedding model and backend for one local root without changing the global semantic default."
                      badges={['Per-root', 'Manual', `${semanticIndexOverrideEntries.length} overrides`]}
                    >
                      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                        <div className="rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Create Override</div>
                          <p className="mt-1 text-[11px] opacity-45">
                            Use this when one project root needs a different embedding quality or a forced CPU/ONNX lane than the rest of the machine.
                          </p>

                          <div className="mt-3 grid grid-cols-1 gap-3">
                            <label className="block">
                              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Root Path</div>
                              <input
                                aria-label="Semantic index override root path"
                                value={semanticOverrideRootPathDraft}
                                onChange={event => setSemanticOverrideRootPathDraft(event.target.value)}
                                placeholder="/workspace/project"
                                className="mt-2 w-full rounded border px-3 py-2 text-[11px] outline-none"
                                style={settingsMonoFieldStyle}
                              />
                            </label>

                            <label className="block">
                              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Model</div>
                              <select
                                aria-label="Semantic index override model"
                                value={semanticOverrideModelIdDraft ?? ''}
                                onChange={event => setSemanticOverrideModelIdDraft(event.target.value || null)}
                                className="mt-2 w-full rounded border px-3 py-2 text-[11px] outline-none"
                                style={settingsSelectStyle}
                              >
                                {semanticIndexingModels.map(model => (
                                  <option key={`semantic-override-${model.id}`} value={model.id}>
                                    {model.label}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <div>
                              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Backend</div>
                              <div className="mt-2 grid grid-cols-2 gap-2">
                                {localModelBackendOptions
                                  .filter(option => semanticIndexingCapability.backendOptionIds.includes(option.id))
                                  .map(option => {
                                    const active = semanticOverrideBackendPreferenceDraft === option.id;
                                    const disabled = option.id === 'cuda' && !cudaProviderReady;
                                    return (
                                      <button
                                        key={`semantic-override-backend-${option.id}`}
                                        type="button"
                                        aria-label={`Use ${option.label} backend for semantic index override`}
                                        onClick={() => {
                                          if (!disabled) {
                                            setSemanticOverrideBackendPreferenceDraft(option.id);
                                          }
                                        }}
                                        disabled={disabled}
                                        className="rounded px-3 py-2 text-left transition-colors"
                                        style={{
                                          border: `1px solid ${active ? accent : border}`,
                                          background: active ? `${accent}16` : 'rgba(255,255,255,0.03)',
                                          color: text,
                                          opacity: disabled ? 0.45 : 1,
                                          cursor: disabled ? 'not-allowed' : 'pointer',
                                        }}
                                      >
                                        <div className="text-[10px] font-semibold uppercase tracking-[0.12em]">{option.label}</div>
                                        <div className="mt-1 text-[10px] leading-4 opacity-55">{option.description}</div>
                                      </button>
                                    );
                                  })}
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={handleApplySemanticIndexOverride}
                                disabled={!semanticOverrideRootPathDraft.trim()}
                                className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                                style={{
                                  border: `1px solid ${accent}`,
                                  background: `${accent}16`,
                                  color: text,
                                  opacity: semanticOverrideRootPathDraft.trim() ? 1 : 0.5,
                                }}
                              >
                                <Plus size={11} />
                                Save Override
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Current Overrides</div>
                          <p className="mt-1 text-[11px] opacity-45">
                            Overrides only affect future semantic index builds and queries for the matching root path.
                          </p>

                          <div className="mt-3 space-y-2">
                            {semanticIndexOverrideEntries.length > 0 ? semanticIndexOverrideEntries.map(([rootPath, binding]) => {
                              const overrideModel = getLocalModelDefinition(binding.modelId)
                                ?? getLocalModelDefinitionByProviderModelId(binding.modelId);
                              const backendLabel = localModelBackendOptions.find(option => option.id === binding.backendPreference)?.label
                                ?? binding.backendPreference;
                              return (
                                <div
                                  key={`semantic-override-entry-${rootPath}`}
                                  className="rounded border px-3 py-3"
                                  style={{ borderColor: border, background: 'rgba(255,255,255,0.02)' }}
                                >
                                  <div className="break-all text-[10px]" style={{ color: muted, fontFamily: appearance.fonts.mono }}>
                                    {rootPath}
                                  </div>
                                  <div className="mt-2 text-[11px]" style={{ color: text }}>
                                    {overrideModel?.label ?? binding.modelId ?? 'No model'} · {backendLabel}
                                  </div>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSemanticOverrideRootPathDraft(rootPath);
                                        setSemanticOverrideModelIdDraft(binding.modelId);
                                        setSemanticOverrideBackendPreferenceDraft(binding.backendPreference);
                                      }}
                                      className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                                      style={{ border: `1px solid ${border}`, background: 'rgba(255,255,255,0.03)', color: text }}
                                    >
                                      <Bot size={11} />
                                      Load Into Editor
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveSemanticIndexOverride(rootPath)}
                                      className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                                      style={{ border: `1px solid ${border}`, background: 'rgba(255,255,255,0.03)', color: text }}
                                    >
                                      <Trash2 size={11} />
                                      Remove
                                    </button>
                                  </div>
                                </div>
                              );
                            }) : (
                              <div className="rounded border px-3 py-3 text-[11px] opacity-45" style={{ borderColor: border, background: 'rgba(255,255,255,0.02)' }}>
                                No semantic root overrides yet.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </OverviewCard>
                  ) : null}
                </div>
              </section>
            )}

            {activeSection === 'appearance' && (
              <section className="rounded border p-4" style={{ borderColor: 'var(--overlay-workbench-settings-card-border)', background: 'var(--overlay-workbench-settings-card-bg)' }}>
                <SectionTitle
                  icon={<Palette size={12} />}
                  title="Appearance"
                  subtitle="Theme recipes, UI fonts, and direct palette editing."
                />

                <div className="mt-4 space-y-4">
                  <div className="rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Theme Packages</div>
                        <p className="mt-1 text-[11px] opacity-40">
                          Drop packaged themes into <code>{themePackagesDirectory}</code> and GreebleFS will discover them as curated themes with assets, visuals, and any modular top-bar contributions they publish.
                          Official pilot themes surface first, built-ins stay supported, and archive material remains selectable without dominating the page.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void onOpenThemesFolder()}
                          className="rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                          style={{ border: `1px solid ${border}`, background: 'rgba(255,255,255,0.04)', color: text }}
                        >
                          Open Folder
                        </button>
                        <button
                          type="button"
                          onClick={() => void onRefreshThemes()}
                          className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                          style={{ border: `1px solid ${accent}`, background: `${accent}18`, color: text }}
                        >
                          <RefreshCw size={10} />
                          Refresh
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px]">
                      <span className="rounded border px-2 py-1 font-semibold uppercase tracking-[0.12em]" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text }}>
                        {themePackagesLoading ? 'Scanning Packages' : `${themePackages.length} Package${themePackages.length === 1 ? '' : 's'} Loaded`}
                      </span>
                      <span className="rounded border px-2 py-1 font-semibold uppercase tracking-[0.12em]" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: muted }}>
                        Active Source: {getThemeSourceLabel(editableTheme)}
                      </span>
                    </div>

                    {themePackagesError && (
                      <div className="mt-3 rounded border px-3 py-2 text-[11px]" style={{ borderColor: '#7f1d1d', background: 'rgba(127,29,29,0.18)', color: '#fecaca' }}>
                        Theme package scan failed: {themePackagesError}
                      </div>
                    )}

                    {themePackagesWarnings.length > 0 && (
                      <div className="mt-3 rounded border px-3 py-3 text-[11px]" style={{ borderColor: '#854d0e', background: 'rgba(133,77,14,0.18)', color: '#fde68a' }}>
                        <div className="font-semibold uppercase tracking-[0.12em]">Package warnings</div>
                        <div className="mt-2 space-y-1.5">
                          {themePackagesWarnings.map(warning => (
                            <div key={warning}>{warning}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">Curated Theme Suite</label>
                    <ThemeCatalogGrid
                      themes={appearance.themes}
                      activeThemeId={settings.appearance.activeThemeId}
                      onSelect={applyThemeSelection}
                      themePackageLookup={themePackageLookup}
                      createThemeCardMotion={bindSettingsCardMotion}
                    />
                  </div>

                  <div className="rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Dock Theme Mode</div>
                        <p className="mt-1 text-[11px] opacity-40">
                          Keep dock mode on the application theme, or pin dock mode to a completely different theme while still honoring dock-specific recipe overrides.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {[
                          {
                            value: 'follow-app',
                            label: 'Follow Application',
                            description: 'Dock uses the app theme plus any dock-specific recipes declared by that theme.',
                          },
                          {
                            value: 'override',
                            label: 'Override Theme',
                            description: 'Dock uses its own separately selected theme.',
                          },
                        ].map(option => {
                          const active = settings.appearance.dockThemeMode === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => updateAppearance({ dockThemeMode: option.value as 'follow-app' | 'override' })}
                              className="rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                              style={{
                                border: `1px solid ${active ? accent : border}`,
                                background: active ? `${accent}18` : 'rgba(255,255,255,0.04)',
                                color: text,
                              }}
                              title={option.description}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px]">
                      <span className="rounded border px-2 py-1 font-semibold uppercase tracking-[0.12em]" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text }}>
                        Dock Source: {settings.appearance.dockThemeMode === 'override' ? 'Override Theme' : 'Application Theme'}
                      </span>
                      <span className="rounded border px-2 py-1 font-semibold uppercase tracking-[0.12em]" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: muted }}>
                        Current Dock Theme: {dockAppearance.baseTheme.name}
                      </span>
                    </div>
                    {settings.appearance.dockThemeMode === 'follow-app' ? (
                      <div className="mt-3 rounded border px-3 py-2 text-[11px]" style={{ borderColor: `${accent}33`, background: `${accent}10`, color: text }}>
                        Dock mode is following <strong>{appAppearance.baseTheme.name}</strong>. If that theme declares `theme.dock.workbench` or `theme.dock.explorer`, those dock-specific recipes are applied automatically.
                      </div>
                    ) : null}
                  </div>

                  {settings.appearance.dockThemeMode === 'override' && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">Curated Dock Theme Suite</label>
                      <ThemeCatalogGrid
                        themes={appearance.themes}
                        activeThemeId={settings.appearance.activeDockThemeId}
                        onSelect={applyDockThemeSelection}
                        themePackageLookup={themePackageLookup}
                        createThemeCardMotion={bindSettingsCardMotion}
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">
                      <Type size={10} />
                      UI Font
                    </label>
                    <div className="grid grid-cols-1 gap-1 md:grid-cols-2">
                      {overlayFontCatalog.map(font => {
                        const active = settings.appearance.uiFontFamily === font.family;
                        return (
                          <button
                            key={font.id}
                            onClick={() => updateAppearance({ uiFontFamily: font.family })}
                            className="w-full rounded px-3 py-2 text-left text-[11px] transition-colors hover:bg-white/5"
                            style={{
                              fontFamily: font.family,
                              background: active ? `${accent}18` : 'transparent',
                              border: `1px solid ${active ? accent : 'rgba(255,255,255,0.08)'}`,
                              color: active ? text : muted,
                            }}
                          >
                            {font.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <ColorToken label="Accent" value={editableTheme.palette.accent} onChange={value => updateThemePalette({ accent: value, accentSoft: `${value}22` })} />
                    <ColorToken label="App Background" value={editableTheme.palette.appBackground} onChange={value => updateThemePalette({ appBackground: value, shellBackgroundSolid: value })} />
                    <ColorToken label="Panel" value={editableTheme.palette.panelBackground} onChange={value => updateThemePalette({ panelBackground: value, sidebarBackground: value })} />
                    <ColorToken label="Text" value={editableTheme.palette.textPrimary} onChange={value => updateThemePalette({ textPrimary: value })} />
                  </div>

                  <div className="grid grid-cols-1 gap-2 xl:grid-cols-4">
                    <RangeField
                      label="Window Opacity"
                      description="How translucent the overlay surface should feel."
                      min={overlayVisualControls.opacity.min}
                      max={overlayVisualControls.opacity.max}
                      step={overlayVisualControls.opacity.step}
                      value={settings.appearance.appOpacity}
                      valueLabel={formatOverlayVisualControlValue('opacity', settings.appearance.appOpacity)}
                      onChange={value => updateAppearance({ appOpacity: clampOverlayVisualControlValue('opacity', value) })}
                    />
                    <RangeField
                      label="Panel Transparency"
                      description="Fade panel chrome away while keeping the actual panel content readable."
                      min={overlayVisualControls.panelTransparency.min}
                      max={overlayVisualControls.panelTransparency.max}
                      step={overlayVisualControls.panelTransparency.step}
                      value={settings.appearance.panelTransparency}
                      valueLabel={formatOverlayVisualControlValue('panelTransparency', settings.appearance.panelTransparency)}
                      onChange={value => updateAppearance({ panelTransparency: clampOverlayVisualControlValue('panelTransparency', value) })}
                    />
                    <RangeField
                      label="Blur Strength"
                      description="Scale the glass softness separately from overall opacity so fully opaque shells can still feel frosted."
                      min={overlayVisualControls.blurStrength.min}
                      max={overlayVisualControls.blurStrength.max}
                      step={overlayVisualControls.blurStrength.step}
                      value={settings.appearance.appBlurStrength}
                      valueLabel={formatOverlayVisualControlValue('blurStrength', settings.appearance.appBlurStrength)}
                      onChange={value => updateAppearance({ appBlurStrength: clampOverlayVisualControlValue('blurStrength', value) })}
                    />
                    <RangeField
                      label="Window Zoom"
                      description="Scale the full overlay shell without changing monitor placement."
                      min={overlayVisualControls.zoom.min}
                      max={overlayVisualControls.zoom.max}
                      step={overlayVisualControls.zoom.step}
                      value={settings.appearance.appZoom}
                      valueLabel={formatOverlayVisualControlValue('zoom', settings.appearance.appZoom)}
                      onChange={value => updateAppearance({ appZoom: clampOverlayVisualControlValue('zoom', value) })}
                    />
                  </div>

                  <label className="flex items-center justify-between rounded border px-3 py-2 text-[11px]" style={{ borderColor: border }}>
                    <div>
                      <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Native Glass Blur</div>
                      <p className="mt-1 text-[11px] opacity-40">Use compositor-backed window blur when the platform supports it, then tune the glass amount with Blur Strength.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.appearance.appBlur}
                      onChange={event => updateAppearance({ appBlur: event.target.checked })}
                    />
                  </label>
                </div>
              </section>
            )}

            {activeSection === 'top-bars' && (
              <section className="rounded border p-4" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
                <SectionTitle
                  icon={<SlidersHorizontal size={12} />}
                  title="Top Bars"
                  subtitle="Standalone shell chrome workflows that can follow theme defaults or stay pinned independently."
                />

                <div className="mt-4 space-y-4">
                  <div className="rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Top Bar Catalog</div>
                        <p className="mt-1 text-[11px] opacity-40">
                          Top bars now have their own authored storage root in <code>{topBarPackagesDirectory}</code>. Built-ins always stay available, standalone top-bar packages live there, and theme packages in <code>{themePackagesDirectory}</code> can still contribute additional shell chrome workflows without forcing users to swap the entire theme.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void onRefreshTopBars()}
                          className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                          style={{ border: `1px solid ${border}`, background: 'rgba(255,255,255,0.04)', color: text }}
                        >
                          <RefreshCw size={10} />
                          Refresh
                        </button>
                        <button
                          type="button"
                          onClick={() => void onOpenTopBarsFolder()}
                          className="rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                          style={{ border: `1px solid ${accent}`, background: `${accent}18`, color: text }}
                        >
                          Open Top Bars Folder
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px]">
                      <span className="rounded border px-2 py-1 font-semibold uppercase tracking-[0.12em]" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text }}>
                        Current: {resolvedTopBarSelection.topBar.name}
                      </span>
                      <span className="rounded border px-2 py-1 font-semibold uppercase tracking-[0.12em]" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: muted }}>
                        Mode: {settings.appearance.activeTopBarId == null ? 'Follow Theme' : 'Pinned'}
                      </span>
                      <span className="rounded border px-2 py-1 font-semibold uppercase tracking-[0.12em]" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: muted }}>
                        {topBarCatalogLoading ? 'Scanning Catalog' : `Catalog: ${availableTopBars.length} top bars`}
                      </span>
                      <span className="rounded border px-2 py-1 font-semibold uppercase tracking-[0.12em]" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: muted }}>
                        Standalone: {authoredTopBarCount}
                      </span>
                      <span className="rounded border px-2 py-1 font-semibold uppercase tracking-[0.12em]" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: muted }}>
                        Theme Contributed: {themeContributedTopBarCount}
                      </span>
                    </div>

                    <div className="mt-3 rounded border px-3 py-2 text-[11px]" style={{ borderColor: `${accent}33`, background: `${accent}10`, color: text }}>
                      {followThemeTopBarDetail}
                    </div>

                    <div className="mt-3 rounded border px-3 py-2 text-[11px]" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)', color: muted }}>
                      Standalone top bars refresh from <code>{topBarPackagesDirectory}</code>. Theme-contributed top bars still refresh from the theme package pipeline in <code>{themePackagesDirectory}</code>.
                    </div>

                    {topBarPackagesError ? (
                      <div className="mt-3 rounded border px-3 py-2 text-[11px]" style={{ borderColor: '#7f1d1d', background: 'rgba(127,29,29,0.18)', color: '#fecaca' }}>
                        Top-bar package scan failed: {topBarPackagesError}
                      </div>
                    ) : null}

                    {topBarPackagesWarnings.length > 0 ? (
                      <div className="mt-3 rounded border px-3 py-3 text-[11px]" style={{ borderColor: '#854d0e', background: 'rgba(133,77,14,0.18)', color: '#fde68a' }}>
                        <div className="font-semibold uppercase tracking-[0.12em]">Top-bar warnings</div>
                        <div className="mt-2 space-y-1.5">
                          {topBarPackagesWarnings.map(warning => (
                            <div key={warning}>{warning}</div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {resolvedTopBarSelection.explicitSelectionMissing ? (
                      <div className="mt-3 rounded border px-3 py-2 text-[11px]" style={{ borderColor: '#854d0e', background: 'rgba(133,77,14,0.18)', color: '#fde68a' }}>
                        The pinned top bar id <code>{settings.appearance.activeTopBarId}</code> is no longer available, so the shell is temporarily following the active theme fallback until you pin another one.
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">Selection</label>
                    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => updateAppearance({ activeTopBarId: null })}
                        className="w-full rounded border p-3 text-left transition-colors"
                        style={{
                          borderColor: settings.appearance.activeTopBarId == null ? accent : border,
                          background: settings.appearance.activeTopBarId == null ? `${accent}12` : 'rgba(255,255,255,0.03)',
                          color: text,
                          boxShadow: settings.appearance.activeTopBarId == null ? `inset 0 0 0 1px ${accent}22` : 'none',
                        }}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-[11px] font-semibold">Follow Theme</div>
                            <div className="mt-1 text-[11px] leading-4 opacity-55">
                              Let the current app theme choose the top bar. Theme packages can publish explicit defaults, and older themes still map through the legacy workbench top-bar style fallback.
                            </div>
                          </div>
                          {settings.appearance.activeTopBarId == null ? <ThemeBadge label="Active" active /> : null}
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-1.5">
                          <ThemeBadge label={`Resolved ${resolvedTopBarSelection.topBar.name}`} active={settings.appearance.activeTopBarId == null} />
                          <ThemeBadge label={appearance.baseTheme.name} />
                          <ThemeBadge label={resolvedTopBarSelection.resolvedFrom === 'theme-default' ? 'Theme Default' : resolvedTopBarSelection.resolvedFrom === 'theme-legacy-style' ? 'Legacy Fallback' : 'Built-In Fallback'} />
                        </div>
                      </button>

                      {availableTopBars.map(topBar => (
                        <TopBarCatalogCard
                          key={topBar.id}
                          topBar={topBar}
                          active={settings.appearance.activeTopBarId === topBar.id}
                          border={border}
                          accent={accent}
                          text={text}
                          muted={muted}
                          onClick={() => updateAppearance({ activeTopBarId: topBar.id })}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {activeSection === 'icons' && (
              <section className="rounded border p-4" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
                <SectionTitle
                  icon={<Image size={12} />}
                  title="Icon Themes"
                  subtitle="VS Code-style icon packs for explorer file icons, semantic folders, and stock shell glyphs."
                />

                <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                  <div className="rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Pack Directory</div>
                        <p className="mt-1 text-[11px] opacity-40">
                          Drop `icon-theme.json` manifests into the icon-themes root. Packs can override file/folder mappings plus stock UI glyph slots without touching thumbnail generation.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => void onRefreshIconThemes()}
                          className="inline-flex items-center gap-2 rounded px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                          style={{ border: `1px solid ${border}`, background: 'rgba(255,255,255,0.04)', color: text }}
                        >
                          <RefreshCw size={11} />
                          Refresh
                        </button>
                        <button
                          onClick={() => void onOpenIconThemesFolder()}
                          className="inline-flex items-center gap-2 rounded px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                          style={{ border: `1px solid ${accent}55`, background: `${accent}18`, color: text }}
                        >
                          <FolderOpen size={11} />
                          Open Folder
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px]">
                      <span className="rounded border px-2 py-1 font-semibold uppercase tracking-[0.12em]" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text }}>
                        Active: {activeIconThemePackage?.name ?? 'Follow Theme Default'}
                      </span>
                      <span className="rounded border px-2 py-1 font-semibold uppercase tracking-[0.12em]" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: muted }}>
                        Catalog: {iconThemePackages.length} packs
                      </span>
                      <span className="rounded border px-2 py-1 font-semibold uppercase tracking-[0.12em]" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: muted }}>
                        Root: {iconThemePackagesDirectory}
                      </span>
                    </div>

                    {iconThemePackagesLoading ? (
                      <div className="mt-3 rounded border px-3 py-2 text-[11px] opacity-55" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
                        Scanning icon themes...
                      </div>
                    ) : null}
                    {iconThemePackagesError ? (
                      <div className="mt-3 rounded border px-3 py-2 text-[11px]" style={{ borderColor: `${effectiveTheme.palette.danger}55`, background: `${effectiveTheme.palette.danger}14`, color: text }}>
                        {iconThemePackagesError}
                      </div>
                    ) : null}
                    {iconThemePackagesWarnings.length > 0 ? (
                      <div className="mt-3 rounded border px-3 py-2 text-[11px]" style={{ borderColor: `${effectiveTheme.palette.warning}55`, background: `${effectiveTheme.palette.warning}14`, color: text }}>
                        {iconThemePackagesWarnings[0]}
                      </div>
                    ) : null}

                    <div className="mt-4 grid grid-cols-1 gap-2 lg:grid-cols-2">
                      <button
                        onClick={() => applyIconThemeSelection(null)}
                        className="rounded px-3 py-3 text-left transition-colors"
                        style={{
                          border: `1px solid ${normalizedActiveIconThemeId == null ? accent : border}`,
                          background: normalizedActiveIconThemeId == null ? `${accent}16` : 'rgba(255,255,255,0.03)',
                          color: text,
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold">Follow Theme Default</span>
                          <span className="text-[9px] uppercase tracking-[0.14em]" style={{ color: normalizedActiveIconThemeId == null ? accent : muted }}>
                            {themeIconTheme.name}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] opacity-45">
                          The active shell theme continues to provide its default icon theme. Switching the shell theme also switches the icons.
                        </p>
                      </button>

                      {iconThemePackages.map(iconThemePackage => {
                        const active = normalizedActiveIconThemeId === normalizeIconThemePackageSelectionId(iconThemePackage.id);
                        return (
                          <button
                            key={iconThemePackage.id}
                            onClick={() => applyIconThemeSelection(iconThemePackage.id)}
                            className="rounded px-3 py-3 text-left transition-colors"
                            style={{
                              border: `1px solid ${active ? accent : border}`,
                              background: active ? `${accent}16` : 'rgba(255,255,255,0.03)',
                              color: text,
                            }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-semibold">{iconThemePackage.name}</span>
                              <span className="text-[9px] uppercase tracking-[0.14em]" style={{ color: active ? accent : muted }}>
                                {iconThemePackage.sourceKind === 'built-in' ? 'Built-In' : 'Pack'}
                              </span>
                            </div>
                            <p className="mt-1 text-[11px] opacity-45">
                              {iconThemePackage.description || 'Dedicated icon pack for explorer assets and shell UI slots.'}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-1">
                              <ThemeBadge label={`${iconThemePackage.capabilitySummary.iconDefinitions} glyphs`} active={active} />
                              <ThemeBadge label={`${iconThemePackage.capabilitySummary.uiIcons} UI`} active={active} />
                              <ThemeBadge label={`${iconThemePackage.capabilitySummary.fileExtensions} ext`} active={active} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Live Preview</div>
                    <p className="mt-1 text-[11px] opacity-40">
                      Explorer files and stock shell glyphs swap immediately. Thumbnail generation remains separate and only wins when the explorer decides a thumbnail should render.
                    </p>

                    <div className="mt-3 rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Explorer</div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {[
                          { id: 'folder', label: 'Folder', src: getNamedFolderIconSrc(settings.explorer.defaultFolderIcon, false, themeIconTheme) },
                          { id: 'folder-open', label: 'Folder Open', src: getNamedFolderIconSrc(settings.explorer.defaultFolderIcon, true, themeIconTheme) ?? getNamedFolderIconSrc(settings.explorer.defaultFolderIcon, false, themeIconTheme) },
                          { id: 'typescript', label: 'main.ts', src: resolveFileIconSrc('main.ts', 'ts', themeIconTheme) },
                          { id: 'json', label: 'theme.json', src: resolveFileIconSrc('theme.json', 'json', themeIconTheme) },
                          { id: 'markdown', label: 'README.md', src: resolveFileIconSrc('README.md', 'md', themeIconTheme) },
                          { id: 'shader', label: 'shell.wgsl', src: resolveFileIconSrc('shell.wgsl', 'wgsl', themeIconTheme) },
                        ].map(preview => (
                          <div key={preview.id} className="flex items-center gap-2 rounded border px-2 py-2" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                            <img src={preview.src} width={20} height={20} style={{ objectFit: 'contain', flexShrink: 0 }} draggable={false} />
                            <span className="truncate text-[10px]" style={{ color: text }}>{preview.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-3 rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Shell UI</div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {[
                          { id: 'explorer', label: 'Explorer', icon: <FolderOpen size={15} /> },
                          { id: 'search', label: 'Search', icon: <Search size={15} /> },
                          { id: 'terminal', label: 'Terminal', icon: <TerminalSquare size={15} /> },
                          { id: 'settings', label: 'Settings', icon: <Settings2 size={15} /> },
                          { id: 'refresh', label: 'Refresh', icon: <RefreshCw size={15} /> },
                          { id: 'layout', label: 'Layouts', icon: <LayoutGrid size={15} /> },
                          { id: 'git', label: 'Git', icon: <GitBranch size={15} /> },
                          { id: 'capture', label: 'Capture', icon: <Camera size={15} /> },
                          { id: 'plugins', label: 'Plugins', icon: <Puzzle size={15} /> },
                          { id: 'wallpaper', label: 'Wallpapers', icon: <MonitorPlay size={15} /> },
                        ].map(preview => (
                          <div key={preview.id} className="flex items-center gap-2 rounded border px-2 py-2" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)', color: text }}>
                            <span style={{ display: 'flex', color: accent }}>{preview.icon}</span>
                            <span className="truncate text-[10px]">{preview.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-3 rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Panel Tabs</div>
                          <p className="mt-1 text-[11px] opacity-40">
                            Panel chrome can target dedicated `panel_&lt;id&gt;` UI slots, including folder plugins that register their own top-bar tabs.
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {[
                          {
                            id: 'explorer',
                            label: 'Explorer',
                            slotId: getPanelIconSlotId('explorer'),
                            icon: <ThemedPanelIcon panelId="explorer" fallbackSlotId="folder_open" fallbackIcon={FolderOpen} size={15} />,
                          },
                          {
                            id: 'storage',
                            label: 'Storage',
                            slotId: getPanelIconSlotId('storage'),
                            icon: <ThemedPanelIcon panelId="storage" fallbackSlotId="hard_drive" fallbackIcon={HardDrive} size={15} />,
                          },
                          {
                            id: 'notes',
                            label: 'Notes',
                            slotId: getPanelIconSlotId('notes'),
                            icon: <ThemedPanelIcon panelId="notes" fallbackSlotId="sticky_note" fallbackIcon={StickyNote} size={15} />,
                          },
                          {
                            id: 'screenshots',
                            label: 'Screenshots',
                            slotId: getPanelIconSlotId('screenshots'),
                            icon: <ThemedPanelIcon panelId="screenshots" fallbackSlotId="camera" fallbackIcon={Camera} size={15} />,
                          },
                          {
                            id: 'plugins',
                            label: 'Plugins',
                            slotId: getPanelIconSlotId('plugins'),
                            icon: <ThemedPanelIcon panelId="plugins" fallbackSlotId="puzzle" fallbackIcon={Puzzle} size={15} />,
                          },
                          {
                            id: 'settings',
                            label: 'Settings',
                            slotId: getPanelIconSlotId('settings'),
                            icon: <ThemedPanelIcon panelId="settings" fallbackSlotId="settings2" fallbackIcon={Settings2} size={15} />,
                          },
                          {
                            id: 'drawable-canvas',
                            label: 'Drawable Canvas',
                            slotId: getPanelIconSlotId('drawable-canvas'),
                            icon: <ThemedPanelIcon panelId="drawable-canvas" fallbackSlotId="puzzle" fallbackIcon={Puzzle} size={15} />,
                          },
                        ].map(preview => (
                          <div key={preview.id} className="flex items-center gap-2 rounded border px-2 py-2" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)', color: text }}>
                            <span style={{ display: 'flex', color: accent }}>{preview.icon}</span>
                            <div className="min-w-0">
                              <div className="truncate text-[10px]">{preview.label}</div>
                              <div className="truncate text-[8px] opacity-40">{preview.slotId}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <label className="mt-3 flex items-center justify-between rounded border px-3 py-2 text-[11px]" style={{ borderColor: border }}>
                      <div>
                        <div className="font-semibold uppercase tracking-[0.12em] opacity-60">OS Icon Fallback</div>
                        <p className="mt-1 text-[11px] opacity-40">
                          Keep icon themes primary for explorer files and semantic folders, then let {platformLabel}&apos;s native icon service fill holes when the active pack has no direct match.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.appearance.useNativeOsIcons}
                        onChange={event => updateAppearance({ useNativeOsIcons: event.target.checked })}
                      />
                    </label>
                  </div>
                </div>

                <div className="mt-4 rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Folder Icon Authoring</div>
                      <p className="mt-1 text-[11px] opacity-40">
                        Curated coding-folder rules land first. Anything that misses falls back to the default folder icon from the active icon theme.
                      </p>
                    </div>
                    <button
                      onClick={() => updateExplorer({ folderIconRules: createDefaultFolderIconRules() })}
                      className="rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
                      style={{ border: `1px solid ${border}`, background: 'rgba(255,255,255,0.04)', color: text }}
                    >
                      Restore Rules
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[140px_minmax(0,1fr)]">
                    <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">Default Fallback</label>
                    <div className="flex items-center gap-3 rounded border px-3 py-2" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)' }}>
                      <img
                        src={getNamedFolderIconSrc(settings.explorer.defaultFolderIcon, false, themeIconTheme)}
                        width={22}
                        height={22}
                        style={{ objectFit: 'contain', flexShrink: 0 }}
                        draggable={false}
                      />
                      <select
                        aria-label="Default fallback folder icon"
                        value={settings.explorer.defaultFolderIcon}
                        onChange={event => updateExplorer({ defaultFolderIcon: event.target.value as FolderIconValue })}
                        className="w-full bg-transparent text-[11px] outline-none"
                        style={settingsMonoSelectStyle}
                      >
                        {FOLDER_ICON_OPTIONS.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    {settings.explorer.folderIconRules.map(rule => (
                      <div key={rule.id} className="rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
                        <div className="grid grid-cols-1 gap-2 xl:grid-cols-[120px_minmax(0,1.1fr)_minmax(0,0.9fr)_36px]">
                          <div className="flex items-center gap-2 rounded border px-2 py-2" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)' }}>
                            <img
                              src={getNamedFolderIconSrc(rule.icon, false, themeIconTheme)}
                              width={18}
                              height={18}
                              style={{ objectFit: 'contain', flexShrink: 0 }}
                              draggable={false}
                            />
                            <input
                              value={rule.label}
                              onChange={event => updateFolderRule(rule.id, { label: event.target.value })}
                              className="w-full bg-transparent text-[11px] outline-none"
                              style={{ color: text }}
                            />
                          </div>
                          <input
                            value={stringifyMatchers(rule.matchers)}
                            onChange={event => updateFolderRule(rule.id, { matchers: parseMatcherInput(event.target.value) })}
                            placeholder="src, source, source_code"
                            className="w-full rounded border px-3 py-2 text-[11px] outline-none"
                            style={settingsMonoFieldStyle}
                          />
                          <select
                            aria-label={`Folder icon for ${rule.label}`}
                            value={rule.icon}
                            onChange={event => updateFolderRule(rule.id, { icon: event.target.value as FolderIconValue })}
                            className="w-full rounded border px-3 py-2 text-[11px] outline-none"
                            style={settingsMonoSelectStyle}
                          >
                            {FOLDER_ICON_OPTIONS.map(option => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => removeFolderRule(rule.id)}
                            className="flex items-center justify-center rounded border"
                            title="Remove Rule"
                            style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: muted }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={addFolderRule}
                      className="inline-flex items-center gap-2 rounded px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                      style={{ background: `${accent}18`, color: text, border: `1px solid ${accent}55` }}
                    >
                      <Plus size={11} />
                      Add Rule
                    </button>
                    <span className="text-[10px] opacity-40">
                      Matchers are normalized, so `src-tauri`, `src tauri`, and `src_tauri` resolve the same way.
                    </span>
                  </div>

                  <div className="mt-4 rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.02)' }}>
                    <label className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">
                      <Search size={11} />
                      Icon Catalog
                    </label>
                    <input
                      value={folderIconSearch}
                      onChange={event => setFolderIconSearch(event.target.value)}
                      placeholder="Filter icon names"
                      className="mt-2 w-full rounded border px-3 py-2 text-[11px] outline-none"
                      style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text }}
                    />
                    <OverlayScrollArea style={{ marginTop: 12, maxHeight: 220 }} viewportStyle={{ paddingRight: 4 }}>
                      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                        {filteredFolderIconOptions.map(option => (
                          <button
                            key={option.value}
                            onClick={() => updateExplorer({ defaultFolderIcon: option.value })}
                            className="flex items-center gap-2 rounded border px-2 py-2 text-left text-[10px]"
                            style={{
                              borderColor: settings.explorer.defaultFolderIcon === option.value ? accent : border,
                              background: settings.explorer.defaultFolderIcon === option.value ? `${accent}14` : 'rgba(255,255,255,0.03)',
                              color: text,
                            }}
                            title="Set as default fallback"
                          >
                            <img src={option.closedSrc} width={18} height={18} style={{ objectFit: 'contain', flexShrink: 0 }} draggable={false} />
                            <span className="truncate">{option.label}</span>
                          </button>
                        ))}
                      </div>
                    </OverlayScrollArea>
                  </div>
                </div>
              </section>
            )}

            {activeSection === 'wallpapers' && (
              <section className="rounded border p-4" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
                <SectionTitle
                  icon={<MonitorPlay size={12} />}
                  title="Wallpapers"
                  subtitle="Theme-backed wallpaper defaults, user overrides, and authored live backgrounds that still stack with shader passes."
                />

                <input
                  ref={wallpaperFileInputRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,.gif,.webp,.bmp,.svg,.avif,.mp4,.webm,.mov,.m4v,.ogv,.ts,.tsx,.js,.jsx"
                  multiple
                  hidden
                  onChange={event => { void handleWallpaperFileSelection(event); }}
                />

                <div className="mt-4 space-y-4">
                  <div className="rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Wallpaper Stack</div>
                        <p className="mt-1 text-[11px] opacity-40">
                          Wallpapers render as the base pass. Theme gradients, theme visuals, and shader surfaces stay above them, so animated backgrounds and shader atmospherics can run together instead of competing.
                        </p>
                      </div>
                      <span className="rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ borderColor: accent, background: `${accent}14`, color: accent }}>
                        {wallpaperSelectionSummary}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px]">
                      <div className="opacity-45">
                        {availableWallpapers.length} ready wallpapers
                        {themeWallpaperAvailable ? ' · theme wallpaper available' : ''}
                        {wallpaperFailures.length > 0 ? ` · ${wallpaperFailures.length} failed loads` : ''}
                        {wallpapersLoading ? ' · refreshing…' : ''}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void onRefreshWallpapers()}
                          className="inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 transition-colors"
                          style={{ borderColor: border, background: 'rgba(255,255,255,0.03)', color: text }}
                        >
                          <RefreshCw size={12} />
                          Refresh Wallpapers
                        </button>
                        <button
                          type="button"
                          onClick={triggerWallpaperImport}
                          className="inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 transition-colors"
                          style={{ borderColor: accent, background: `${accent}16`, color: text }}
                        >
                          <Plus size={12} />
                          Import Files
                        </button>
                        <button
                          type="button"
                          onClick={() => void onOpenWallpapersFolder()}
                          className="inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 transition-colors"
                          style={{ borderColor: accent, background: `${accent}16`, color: text }}
                        >
                          <FolderOpen size={12} />
                          Open Folder
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 rounded border px-3 py-2 text-[11px]" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
                      <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Authoring Folder</div>
                      <div className="mt-1 break-all opacity-55">{wallpapersDirectory}</div>
                      {wallpapersError ? (
                        <div className="mt-2 rounded border px-2 py-1.5 text-[10px]" style={{ borderColor: 'rgba(245,158,11,0.35)', background: 'rgba(245,158,11,0.08)', color: text }}>
                          {wallpapersError}
                        </div>
                      ) : null}
                    </div>

                    {wallpaperNotice ? (
                      <div className="mt-3 rounded border px-3 py-2 text-[11px]" style={{ borderColor: `${accent}44`, background: `${accent}12`, color: text }}>
                        {wallpaperNotice}
                      </div>
                    ) : null}
                    {wallpaperImportError ? (
                      <div className="mt-3 rounded border px-3 py-2 text-[11px]" style={{ borderColor: '#7f1d1d', background: 'rgba(127,29,29,0.18)', color: '#fecaca' }}>
                        {wallpaperImportError}
                      </div>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.25fr_0.75fr]">
                    <div className="rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Live Assignment</div>
                          <p className="mt-1 text-[11px] opacity-40">
                            Following the theme keeps wallpaper selection inside the theme system. A user override swaps only the base wallpaper layer and leaves theme visuals plus shader treatments intact.
                          </p>
                        </div>
                        <span className="rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ borderColor: accent, background: `${accent}14`, color: accent }}>
                          {getOverlayWallpaperFitModeLabel(settings.appearance.wallpaperFitMode)}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => updateAppearance({ activeWallpaperId: null })}
                          className="overflow-hidden rounded text-left transition-colors"
                          style={{
                            border: `1px solid ${activeWallpaperSelectionId == null ? accent : border}`,
                            background: activeWallpaperSelectionId == null ? `${accent}14` : 'rgba(255,255,255,0.03)',
                            color: text,
                          }}
                        >
                          <div
                            className="h-24 w-full"
                            style={{
                              backgroundImage: editableTheme.assets?.backgroundUrl
                                ? `linear-gradient(180deg, rgba(5,10,18,0.18), rgba(5,10,18,0.72)), url("${editableTheme.assets.backgroundUrl}")`
                                : `linear-gradient(135deg, ${editableTheme.palette.appBackgroundAlt}, ${editableTheme.palette.appBackground})`,
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                            }}
                          />
                          <div className="space-y-1 px-3 py-3">
                            <div className="flex items-center gap-2 text-[11px] font-semibold">
                              <Palette size={13} />
                              <span>Follow Theme Wallpaper</span>
                            </div>
                            <p className="text-[10px] leading-4 opacity-55">
                              {themeWallpaperAvailable
                                ? `Use ${editableTheme.name}'s packaged wallpaper asset as the base render layer.`
                                : `${editableTheme.name} does not currently ship a wallpaper asset, so the base layer stays empty.`}
                            </p>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => updateAppearance({ activeWallpaperId: wallpaperSystemConfig.noneWallpaperId })}
                          className="overflow-hidden rounded text-left transition-colors"
                          style={{
                            border: `1px solid ${activeWallpaperSelectionId === wallpaperSystemConfig.noneWallpaperId ? accent : border}`,
                            background: activeWallpaperSelectionId === wallpaperSystemConfig.noneWallpaperId ? `${accent}14` : 'rgba(255,255,255,0.03)',
                            color: text,
                          }}
                        >
                          <div className="flex h-24 w-full items-center justify-center" style={{ background: `linear-gradient(135deg, ${editableTheme.palette.appBackgroundAlt}, ${editableTheme.palette.panelBackground})` }}>
                            <Image size={28} style={{ color: muted }} />
                          </div>
                          <div className="space-y-1 px-3 py-3">
                            <div className="flex items-center gap-2 text-[11px] font-semibold">
                              <Image size={13} />
                              <span>Disable Wallpaper Layer</span>
                            </div>
                            <p className="text-[10px] leading-4 opacity-55">
                              Keep the shell on theme gradients, theme visuals, and shaders without any wallpaper asset at the base.
                            </p>
                          </div>
                        </button>

                        {availableWallpapers.map(wallpaper => {
                          const active = activeWallpaperSelectionId === wallpaper.id;
                          const previewBackground = wallpaper.previewUrl
                            ? `linear-gradient(180deg, rgba(5,10,18,0.14), rgba(5,10,18,0.72)), url("${wallpaper.previewUrl}")`
                            : `linear-gradient(135deg, ${editableTheme.palette.appBackgroundAlt}, ${editableTheme.palette.panelBackground})`;
                          return (
                            <button
                              key={wallpaper.id}
                              type="button"
                              onClick={() => updateAppearance({ activeWallpaperId: wallpaper.id })}
                              className="overflow-hidden rounded text-left transition-colors"
                              style={{
                                border: `1px solid ${active ? accent : border}`,
                                background: active ? `${accent}12` : 'rgba(255,255,255,0.03)',
                                color: text,
                              }}
                            >
                              <div className="relative h-24 w-full" style={{ backgroundImage: previewBackground, backgroundSize: 'cover', backgroundPosition: 'center' }}>
                                <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-2">
                                  <ThemeBadge label={getOverlayWallpaperKindLabel(wallpaper.kind)} active={active} />
                                  <ThemeBadge label={wallpaper.source === 'theme-asset' ? 'Theme' : 'Library'} />
                                </div>
                                {!wallpaper.previewUrl ? (
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    {wallpaper.kind === 'video'
                                      ? <MonitorPlay size={28} style={{ color: muted }} />
                                      : wallpaper.kind === 'live'
                                        ? <Sparkles size={28} style={{ color: muted }} />
                                        : <Image size={28} style={{ color: muted }} />}
                                  </div>
                                ) : null}
                              </div>
                              <div className="space-y-1 px-3 py-3">
                                <div className="flex items-center gap-2 text-[11px] font-semibold">
                                  <span>{wallpaper.name}</span>
                                  {active ? <ThemeBadge label="Live" active /> : null}
                                </div>
                                <p className="text-[10px] leading-4 opacity-55">
                                  {wallpaper.description ?? `${getOverlayWallpaperKindLabel(wallpaper.kind)} wallpaper from ${wallpaper.source === 'theme-asset' ? 'the active theme' : 'the wallpaper library'}.`}
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  <ThemeBadge label={wallpaper.group} />
                                  {wallpaper.tags.slice(0, 2).map(tag => (
                                    <ThemeBadge key={`${wallpaper.id}-${tag}`} label={tag} />
                                  ))}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Wallpaper Controls</div>
                        <p className="mt-1 text-[11px] opacity-40">
                          These controls apply to both theme-provided wallpapers and user overrides.
                        </p>
                        <div className="mt-3 space-y-2">
                          <RangeField
                            label="Wallpaper Opacity"
                            description="Fade the wallpaper base layer without turning off shader or theme passes above it."
                            min={overlayVisualControls.opacity.min}
                            max={overlayVisualControls.opacity.max}
                            step={overlayVisualControls.opacity.step}
                            value={settings.appearance.wallpaperOpacity}
                            valueLabel={formatOverlayVisualControlValue('opacity', settings.appearance.wallpaperOpacity)}
                            onChange={value => updateAppearance({ wallpaperOpacity: clampOverlayVisualControlValue('opacity', value) })}
                          />

                          <div className="rounded border p-3" style={{ borderColor: 'var(--overlay-workbench-settings-card-border)', background: 'var(--overlay-workbench-settings-card-bg)' }}>
                            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Wallpaper Fit</div>
                            <div className="mt-2 grid grid-cols-1 gap-2">
                              {overlayWallpaperFitModes.map(mode => {
                                const active = settings.appearance.wallpaperFitMode === mode.id;
                                return (
                                  <button
                                    key={mode.id}
                                    type="button"
                                    onClick={() => updateAppearance({ wallpaperFitMode: mode.id })}
                                    className="rounded px-3 py-2 text-left transition-colors"
                                    style={{
                                      border: `1px solid ${active ? accent : border}`,
                                      background: active ? `${accent}14` : 'rgba(255,255,255,0.03)',
                                      color: text,
                                    }}
                                  >
                                    <div className="text-[11px] font-semibold">{mode.label}</div>
                                    <div className="mt-1 text-[10px] leading-4 opacity-55">{mode.description}</div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <label className="flex items-center justify-between rounded border px-3 py-2 text-[11px]" style={{ borderColor: border }}>
                            <div>
                              <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Mute Wallpaper Audio</div>
                              <p className="mt-1 text-[11px] opacity-40">Keep imported video or live wallpapers silent unless you explicitly want sound in the shell.</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <VolumeX size={14} style={{ color: muted }} />
                              <input
                                type="checkbox"
                                checked={settings.appearance.wallpaperMuted}
                                onChange={event => updateAppearance({ wallpaperMuted: event.target.checked })}
                              />
                            </div>
                          </label>
                        </div>
                      </div>

                      {wallpaperFailures.length > 0 ? (
                        <div className="rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Load Errors</div>
                          <div className="mt-3 space-y-2">
                            {wallpaperFailures.map(wallpaper => (
                              <div
                                key={`wallpaper-error-${wallpaper.filePath}`}
                                className="rounded border px-3 py-2"
                                style={{ borderColor: 'rgba(245,158,11,0.35)', background: 'rgba(245,158,11,0.08)', color: text }}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="text-[11px] font-semibold">{wallpaper.name}</div>
                                  <span className="text-[9px] uppercase tracking-[0.12em] opacity-55">Load Error</span>
                                </div>
                                <div className="mt-1 break-all text-[10px] opacity-55">{wallpaper.filePath}</div>
                                <pre className="mt-2 whitespace-pre-wrap text-[10px] leading-4 opacity-80">{wallpaper.error}</pre>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {activeSection === 'shaders' && (
              <section className="rounded border p-4" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
                <SectionTitle
                  icon={<Sparkles size={12} />}
                  title="Shaders"
                  subtitle="Dedicated shell shader profiles with a separate authoring/runtime path from motion."
                />

                <div className="mt-4 space-y-4">
                  <div className="rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Shader Catalog</div>
                        <p className="mt-1 text-[11px] opacity-40">
                          Shader authoring lives in its own catalog now. Use this page to browse built-ins plus folder-authored profiles, inspect load failures, and choose whether the shell stays in performance mode, follows the theme default, or uses a user override.
                        </p>
                      </div>
                      <span className="rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text }}>
                        Shader
                      </span>
                    </div>

                    <div className="mt-3 rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Shader Performance Mode</div>
                          <p className="mt-1 text-[11px] opacity-40">
                            Performance is the default. Balanced restores theme shader defaults with a capped preview budget. Quality spends more on the preview host when you want fidelity over throughput.
                          </p>
                        </div>
                        <span className="rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ borderColor: accent, background: `${accent}14`, color: accent }}>
                          {shaderPerformanceProfile.label}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
                        {shaderPerformanceProfiles.map(profile => {
                          const active = profile.id === shaderPerformanceMode;
                          return (
                            <button
                              key={profile.id}
                              type="button"
                              onClick={() => updateAppearance({ shaderPerformanceMode: profile.id })}
                              className="rounded px-3 py-2 text-left transition-colors"
                              style={{
                                border: `1px solid ${active ? accent : border}`,
                                background: active ? `${accent}16` : 'rgba(255,255,255,0.03)',
                                color: text,
                              }}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-semibold">{profile.label}</span>
                                {active ? (
                                  <span className="text-[9px] uppercase tracking-[0.14em]" style={{ color: accent }}>
                                    Active
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-1 text-[11px] opacity-45">{profile.description}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px]">
                      <div className="opacity-45">
                        {availableShaders.length} ready profiles
                        {shaderFailures.length > 0 ? ` · ${shaderFailures.length} failed loads` : ''}
                        {shadersLoading ? ' · refreshing…' : ''}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => void onRefreshShaders()}
                          className="inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 transition-colors"
                          style={{ borderColor: border, background: 'rgba(255,255,255,0.03)', color: text }}
                        >
                          <RefreshCw size={12} />
                          Refresh Shaders
                        </button>
                        <button
                          onClick={() => void onOpenShadersFolder()}
                          className="inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 transition-colors"
                          style={{ borderColor: accent, background: `${accent}16`, color: text }}
                        >
                          <FolderOpen size={12} />
                          Open Folder
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 rounded border px-3 py-2 text-[11px]" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
                      <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Authoring Folder</div>
                      <div className="mt-1 break-all opacity-55">{shadersDirectory}</div>
                      {shadersError && (
                        <div className="mt-2 rounded border px-2 py-1.5 text-[10px]" style={{ borderColor: 'rgba(245,158,11,0.35)', background: 'rgba(245,158,11,0.08)', color: text }}>
                          {shadersError}
                        </div>
                      )}
                    </div>

                    {shaderFailures.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {shaderFailures.map(shader => (
                          <div
                            key={`shader-error-${shader.filePath}`}
                            className="rounded border px-3 py-2"
                            style={{ borderColor: 'rgba(245,158,11,0.35)', background: 'rgba(245,158,11,0.08)', color: text }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-[11px] font-semibold">{shader.name}</div>
                              <span className="text-[9px] uppercase tracking-[0.12em] opacity-55">Load Error</span>
                            </div>
                            <div className="mt-1 break-all text-[10px] opacity-55">{shader.filePath}</div>
                            <pre className="mt-2 whitespace-pre-wrap text-[10px] leading-4 opacity-80">{shader.error}</pre>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.2fr_0.8fr]">
                    <div className="rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Live Assignment</div>
                          <p className="mt-1 text-[11px] opacity-40">
                            A user override wins over the active theme. Clearing the override hands control back to the theme default when performance mode allows it, and unresolved IDs collapse safely to <code>none</code>.
                          </p>
                        </div>
                        <span className="rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ borderColor: accent, background: `${accent}14`, color: accent }}>
                          {shaderSelectionSummary}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-2">
                        <button
                          type="button"
                          onClick={() => updateAppearance({ activeShaderId: null, shaderPerformanceMode: 'balanced' })}
                          className="rounded px-3 py-2 text-left transition-colors"
                          aria-pressed={settings.appearance.activeShaderId == null && shaderPerformanceProfile.shellUsesThemeDefault && Boolean(editableTheme.defaultShaderId)}
                          style={{
                            border: `1px solid ${settings.appearance.activeShaderId == null && shaderPerformanceProfile.shellUsesThemeDefault && Boolean(editableTheme.defaultShaderId) ? accent : border}`,
                            background: settings.appearance.activeShaderId == null && shaderPerformanceProfile.shellUsesThemeDefault && Boolean(editableTheme.defaultShaderId) ? `${accent}16` : 'rgba(255,255,255,0.03)',
                            color: text,
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-semibold">Follow Theme Default</span>
                            <span className="text-[9px] uppercase tracking-[0.14em]" style={{ color: settings.appearance.activeShaderId == null && shaderPerformanceProfile.shellUsesThemeDefault && Boolean(editableTheme.defaultShaderId) ? accent : muted }}>
                              {editableTheme.defaultShaderId ?? 'none'}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] opacity-45">
                            {editableTheme.defaultShaderId
                              ? `Active theme ${editableTheme.name} defaults to ${editableTheme.defaultShaderId}.`
                              : `Active theme ${editableTheme.name} does not define a shader, so the shell falls back to none.`
                            }{!shaderPerformanceProfile.shellUsesThemeDefault ? ' Performance mode keeps the theme default suspended until you switch to Balanced or Quality.' : ''}
                          </p>
                        </button>

                        {availableShaders.map(shader => {
                          const overrideActive = settings.appearance.activeShaderId === shader.id;
                          const effectiveActive = effectiveShaderId === shader.id;
                          const surfaceSummary = getShaderEnabledSurfaceIds(shader)
                            .map(surface => getOverlayShaderSurfaceLabel(surface))
                            .join(' · ');
                          return (
                            <button
                              key={`shader-${shader.id}`}
                              type="button"
                              onClick={() => updateAppearance({ activeShaderId: shader.id })}
                              className="rounded px-3 py-2 text-left transition-colors"
                              style={{
                                border: `1px solid ${overrideActive ? accent : border}`,
                                background: overrideActive ? `${accent}16` : 'rgba(255,255,255,0.03)',
                                color: text,
                              }}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-semibold">{shader.name}</span>
                                <span className="text-[9px] uppercase tracking-[0.14em]" style={{ color: overrideActive ? accent : muted }}>
                                  {shader.group}
                                </span>
                              </div>
                              <p className="mt-1 text-[11px] opacity-45">{shader.description ?? 'Shell shader profile.'}</p>
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-[9px] uppercase tracking-[0.12em] opacity-55">
                                <span>{surfaceSummary || 'No Surfaces'}</span>
                                {shader.controls.length > 0 && <span>{shader.controls.length} Controls</span>}
                                {effectiveActive && <span style={{ color: accent }}>Live</span>}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Effective Shader</div>
                        <div className="mt-2 flex items-start justify-between gap-3">
                          <div>
                            <div className="text-[12px] font-semibold">{effectiveShader?.name ?? 'None'}</div>
                            <p className="mt-1 text-[11px] opacity-45">
                              {effectiveShader?.description ?? 'No shader surfaces are currently active.'}
                            </p>
                          </div>
                          <span className="rounded border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em]" style={{ borderColor: border, color: muted }}>
                            {effectiveShader?.id ?? 'none'}
                          </span>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2 text-[9px] uppercase tracking-[0.12em]">
                          {(effectiveShader?.tags ?? []).map(tag => (
                            <span key={`shader-tag-${tag}`} className="rounded border px-2 py-1" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)', color: muted }}>
                              {tag}
                            </span>
                          ))}
                          {(effectiveShader?.tags ?? []).length === 0 && (
                            <span className="opacity-45">No metadata tags</span>
                          )}
                        </div>
                      </div>

                      <div className="rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Shader Controls</div>
                            <p className="mt-1 text-[11px] opacity-45">
                              Shaders can expose their own live tweak set. Overrides are stored per shader, so changing profiles does not wipe a tuned setup for another one.
                            </p>
                          </div>
                          {effectiveShader && effectiveShader.controls.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const nextShaderControlValues = { ...settings.appearance.shaderControlValues };
                                delete nextShaderControlValues[effectiveShader.id];
                                updateAppearance({ shaderControlValues: nextShaderControlValues });
                              }}
                              className="rounded border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em]"
                              style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: muted }}
                            >
                              Reset Shader
                            </button>
                          )}
                        </div>

                        {effectiveShader && effectiveShader.controls.length > 0 ? (
                          <div className="mt-3 space-y-2">
                            {effectiveShader.controls.map(control => (
                              <RangeField
                                key={`shader-control-${effectiveShader.id}-${control.id}`}
                                label={control.label}
                                description={control.description ?? `Live ${effectiveShader.name} control.`}
                                min={control.min}
                                max={control.max}
                                step={control.step}
                                value={effectiveShaderControlValues[control.id] ?? control.defaultValue ?? control.min}
                                valueLabel={formatShaderControlValue(
                                  control,
                                  effectiveShaderControlValues[control.id] ?? control.defaultValue ?? control.min,
                                )}
                                onChange={value => setShaderControlValue(effectiveShader, control, value)}
                              />
                            ))}
                          </div>
                        ) : (
                          <div className="mt-3 rounded border px-3 py-2 text-[11px] opacity-55" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
                            {effectiveShader
                              ? `${effectiveShader.name} does not expose live controls yet. Add a \`controls\` array in the shader module to surface tweakable sliders here.`
                              : 'No shader is currently active, so there are no live controls to show.'}
                          </div>
                        )}
                      </div>

                      <div className="rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Surface Coverage</div>
                        <div className="mt-3 grid grid-cols-1 gap-2">
                          {(['background', 'topBar', 'border'] as const).map(surface => {
                            const enabled = enabledShaderSurfaces.includes(surface);
                            return (
                              <div
                                key={`shader-surface-${surface}`}
                                className="rounded border px-3 py-2"
                                style={{
                                  borderColor: enabled ? `${accent}55` : border,
                                  background: enabled ? `${accent}12` : 'rgba(255,255,255,0.03)',
                                  color: text,
                                }}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[11px] font-semibold">{getOverlayShaderSurfaceLabel(surface)}</span>
                                  <span className="text-[9px] uppercase tracking-[0.12em]" style={{ color: enabled ? accent : muted }}>
                                    {enabled ? 'Enabled' : 'Off'}
                                  </span>
                                </div>
                                <p className="mt-1 text-[11px] opacity-45">
                                  {enabled
                                    ? `${effectiveShader?.name ?? 'Current shader'} actively renders this shell surface.`
                                    : `${effectiveShader?.name ?? 'Current shader'} does not supply a renderer for this surface.`}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {activeSection === 'animations' && (
              <section className="rounded border p-4" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
                <SectionTitle
                  icon={<RotateCcw size={12} />}
                  title="Animations"
                  subtitle="Window open and close choreography lives here. Keep authored transition modules separate from shell interaction motion."
                />

                <div className="mt-4 space-y-4">
                  <div
                    className="rounded border p-3"
                    {...shellTransitionMotionCard.motionDataAttributes}
                    onPointerEnter={shellTransitionMotionCard.onPointerEnter}
                    onPointerLeave={shellTransitionMotionCard.onPointerLeave}
                    onPointerDown={shellTransitionMotionCard.onPointerDown}
                    onPointerUp={shellTransitionMotionCard.onPointerUp}
                    onPointerCancel={shellTransitionMotionCard.onPointerCancel}
                    style={{
                      borderColor: border,
                      background: 'rgba(255,255,255,0.025)',
                      ...shellTransitionMotionCard.motionStyle,
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Shell Transitions</div>
                        <p className="mt-1 text-[11px] opacity-40">
                          Keep window open and close choreography separate from interaction motion. Browse authored modules here, assign live bindings, and manage the animation folder without crowding the rest of Appearance.
                        </p>
                      </div>
                      <span className="rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text }}>
                        Transition Lane
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px]">
                      <div className="opacity-45">
                        {availableAnimations.length} ready modules
                        {animationFailures.length > 0 ? ` · ${animationFailures.length} failed loads` : ''}
                        {animationsLoading ? ' · refreshing…' : ''}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => void onRefreshAnimations()}
                          className="inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 transition-colors"
                          style={{ borderColor: border, background: 'rgba(255,255,255,0.03)', color: text }}
                        >
                          <RefreshCw size={12} />
                          Refresh Motion
                        </button>
                        <button
                          onClick={() => void onOpenAnimationsFolder()}
                          className="inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 transition-colors"
                          style={{ borderColor: accent, background: `${accent}16`, color: text }}
                        >
                          <FolderOpen size={12} />
                          Open Folder
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 rounded border px-3 py-2 text-[11px]" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
                      <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Authoring Folder</div>
                      <div className="mt-1 break-all opacity-55">{animationsDirectory}</div>
                      {animationsError && (
                        <div className="mt-2 rounded border px-2 py-1.5 text-[10px]" style={{ borderColor: 'rgba(245,158,11,0.35)', background: 'rgba(245,158,11,0.08)', color: text }}>
                          {animationsError}
                        </div>
                      )}
                    </div>

                    {animationFailures.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {animationFailures.map(animation => (
                          <div
                            key={`animation-error-${animation.filePath}`}
                            className="rounded border px-3 py-2"
                            style={{ borderColor: 'rgba(245,158,11,0.35)', background: 'rgba(245,158,11,0.08)', color: text }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-[11px] font-semibold">{animation.name}</div>
                              <span className="text-[9px] uppercase tracking-[0.12em] opacity-55">Load Error</span>
                            </div>
                            <div className="mt-1 break-all text-[10px] opacity-55">{animation.filePath}</div>
                            <pre className="mt-2 whitespace-pre-wrap text-[10px] leading-4 opacity-80">{animation.error}</pre>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">Open Motion</label>
                        <div className="grid grid-cols-1 gap-2">
                          <button
                            onClick={() => updateAppearance({ appOpenAnimation: null })}
                            className="rounded px-3 py-2 text-left transition-colors"
                            style={{
                              border: `1px solid ${settings.appearance.appOpenAnimation == null ? accent : border}`,
                              background: settings.appearance.appOpenAnimation == null ? `${accent}16` : 'rgba(255,255,255,0.03)',
                              color: text,
                            }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-semibold">Follow Theme Default</span>
                              <span className="text-[9px] uppercase tracking-[0.14em]" style={{ color: settings.appearance.appOpenAnimation == null ? accent : muted }}>
                                {effectiveOpenAnimationId}
                              </span>
                            </div>
                            <p className="mt-1 text-[11px] opacity-45">
                              {editableTheme.defaultOpenAnimationId
                                ? `Active theme ${editableTheme.name} defaults open motion to ${editableTheme.defaultOpenAnimationId}.`
                                : `Active theme ${editableTheme.name} does not define open motion, so GreebleFS falls back to ${animationSystemConfig.defaultOpenAnimationId}.`}
                            </p>
                          </button>
                          {openAnimationOptions.map(animation => {
                            const active = settings.appearance.appOpenAnimation === animation.id;
                            return (
                              <button
                                key={`open-${animation.id}`}
                                onClick={() => updateAppearance({ appOpenAnimation: animation.id })}
                                className="rounded px-3 py-2 text-left transition-colors"
                                style={{
                                  border: `1px solid ${active ? accent : border}`,
                                  background: active ? `${accent}16` : 'rgba(255,255,255,0.03)',
                                  color: text,
                                }}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[11px] font-semibold">{animation.name}</span>
                                  <span className="text-[9px] uppercase tracking-[0.14em]" style={{ color: active ? accent : muted }}>
                                    {animation.group}
                                  </span>
                                </div>
                                <p className="mt-1 text-[11px] opacity-45">{animation.description ?? 'Authored window opening motion module.'}</p>
                              </button>
                            );
                          })}
                          {openAnimationOptions.length === 0 && (
                            <div className="rounded border px-3 py-2 text-[11px] opacity-45" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
                              No open-capable motion modules loaded yet.
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">Close Motion</label>
                        <div className="grid grid-cols-1 gap-2">
                          <button
                            onClick={() => updateAppearance({ appCloseAnimation: null })}
                            className="rounded px-3 py-2 text-left transition-colors"
                            style={{
                              border: `1px solid ${settings.appearance.appCloseAnimation == null ? accent : border}`,
                              background: settings.appearance.appCloseAnimation == null ? `${accent}16` : 'rgba(255,255,255,0.03)',
                              color: text,
                            }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-semibold">Follow Theme Default</span>
                              <span className="text-[9px] uppercase tracking-[0.14em]" style={{ color: settings.appearance.appCloseAnimation == null ? accent : muted }}>
                                {effectiveCloseAnimationId}
                              </span>
                            </div>
                            <p className="mt-1 text-[11px] opacity-45">
                              {editableTheme.defaultCloseAnimationId
                                ? `Active theme ${editableTheme.name} defaults close motion to ${editableTheme.defaultCloseAnimationId}.`
                                : `Active theme ${editableTheme.name} does not define close motion, so GreebleFS falls back to ${animationSystemConfig.defaultCloseAnimationId}.`}
                            </p>
                          </button>
                          {closeAnimationOptions.map(animation => {
                            const active = settings.appearance.appCloseAnimation === animation.id;
                            return (
                              <button
                                key={`close-${animation.id}`}
                                onClick={() => updateAppearance({ appCloseAnimation: animation.id })}
                                className="rounded px-3 py-2 text-left transition-colors"
                                style={{
                                  border: `1px solid ${active ? accent : border}`,
                                  background: active ? `${accent}16` : 'rgba(255,255,255,0.03)',
                                  color: text,
                                }}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[11px] font-semibold">{animation.name}</span>
                                  <span className="text-[9px] uppercase tracking-[0.14em]" style={{ color: active ? accent : muted }}>
                                    {animation.group}
                                  </span>
                                </div>
                                <p className="mt-1 text-[11px] opacity-45">{animation.description ?? 'Authored window closing motion module.'}</p>
                              </button>
                            );
                          })}
                          {closeAnimationOptions.length === 0 && (
                            <div className="rounded border px-3 py-2 text-[11px] opacity-45" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
                              No close-capable motion modules loaded yet.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                      <RangeField
                        label="Animation Duration"
                        description="How long each open or close pass gets to play before the window settles."
                        min={140}
                        max={1200}
                        step={20}
                        value={settings.appearance.appAnimationDurationMs}
                        valueLabel={`${settings.appearance.appAnimationDurationMs}ms`}
                        onChange={value => updateAppearance({ appAnimationDurationMs: clampOverlayAnimationDuration(value) })}
                      />
                      <RangeField
                        label="Animation Intensity"
                        description="Push the translation, breakup, and glow harder without changing the active recipe."
                        min={0.55}
                        max={1.8}
                        step={0.05}
                        value={settings.appearance.appAnimationIntensity}
                        valueLabel={`${settings.appearance.appAnimationIntensity.toFixed(2)}x`}
                        onChange={value => updateAppearance({ appAnimationIntensity: clampOverlayAnimationIntensity(value) })}
                      />
                    </div>
                  </div>
                </div>
              </section>
            )}

            {activeSection === 'interaction-motion' && (
              <section className="rounded border p-4" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
                <SectionTitle
                  icon={<Sparkles size={12} />}
                  title="Interaction Motion"
                  subtitle="Shell micro-interactions live here: explorer entries, rail items, tabs, buttons, and settings cards. Window open/close animation stays in Animations."
                />

                <div className="mt-4 space-y-4">
                  <div
                    className="rounded border p-3"
                    {...interactionMotionCard.motionDataAttributes}
                    onPointerEnter={interactionMotionCard.onPointerEnter}
                    onPointerLeave={interactionMotionCard.onPointerLeave}
                    onPointerDown={interactionMotionCard.onPointerDown}
                    onPointerUp={interactionMotionCard.onPointerUp}
                    onPointerCancel={interactionMotionCard.onPointerCancel}
                    style={{
                      borderColor: border,
                      background: 'rgba(255,255,255,0.025)',
                      ...interactionMotionCard.motionStyle,
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Interaction Motion</div>
                        <p className="mt-1 text-[11px] opacity-40">
                          Shared resolver drives explorer entries, rail items, preview workflow tabs, panel tabs, top-bar buttons, and settings cards. Theme defaults still land first, and settings overrides only step in when you ask for them.
                        </p>
                      </div>
                      <span
                        className="rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                        style={{
                          borderColor: settings.appearance.interactionMotionEnabled ? `${accent}66` : border,
                          background: settings.appearance.interactionMotionEnabled ? `${accent}16` : 'rgba(255,255,255,0.04)',
                          color: settings.appearance.interactionMotionEnabled ? accent : text,
                        }}
                      >
                        {settings.appearance.interactionMotionEnabled ? 'Live' : 'Disabled'}
                      </span>
                    </div>

                    <div className="mt-3 space-y-3">
                      <div className="rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Resolver State</div>
                            <p className="mt-1 text-[11px] opacity-45">
                              Chrome lane and file/folder lane resolve separately now. Current live routing:
                              {' '}
                              <strong>{effectiveInteractionMotionProfileLabel}</strong>.
                            </p>
                          </div>
                          <label className="inline-flex items-center gap-2 text-[11px] font-medium" style={{ color: text }}>
                            <input
                              type="checkbox"
                              aria-label="Enable interaction motion"
                              checked={settings.appearance.interactionMotionEnabled}
                              onChange={event => updateAppearance({ interactionMotionEnabled: event.target.checked })}
                            />
                            <span>Enable Interaction Motion</span>
                          </label>
                        </div>

                        {sharedInteractionMotionPresetId && (
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded border px-3 py-2" style={{ borderColor: `${accent}44`, background: `${accent}0c` }}>
                            <div>
                              <div className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: accent }}>Shared Legacy Fallback</div>
                              <div className="mt-1 text-[10px] leading-4 opacity-55">
                                Old shared preset <strong>{sharedInteractionMotionPresetId}</strong> still exists. Module cards can override it, or clear it so only theme + module routing remain.
                              </div>
                            </div>
                            <button
                              type="button"
                              aria-label="Clear shared interaction motion fallback"
                              onClick={() => updateAppearance({ interactionMotionPresetId: null })}
                              className="rounded px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors"
                              style={{
                                border: `1px solid ${accent}66`,
                                background: `${accent}16`,
                                color: accent,
                              }}
                            >
                              Clear Shared Fallback
                            </button>
                          </div>
                        )}
                      </div>

                      <RangeField
                        label="Master Motion Intensity"
                        description="Global multiplier applied before each module lane and per-surface override. Use this as the broad shell-wide gain control."
                        min={0.25}
                        max={2.5}
                        step={0.05}
                        value={settings.appearance.interactionMotionIntensity}
                        valueLabel={`${settings.appearance.interactionMotionIntensity.toFixed(2)}x`}
                        onChange={value => updateAppearance({ interactionMotionIntensity: clampInteractionMotionIntensity(value) })}
                      />

                      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                        {interactionMotionModuleEditorStates.map(moduleState => {
                          const moduleEnabled = moduleState.moduleOverride.enabled !== false;
                          const followLabel = moduleState.moduleOverride.presetId == null
                            ? (sharedInteractionMotionPresetId
                              ? `Following shared fallback ${sharedInteractionMotionPresetId}.`
                              : themeInteractionMotionPresetId
                                ? `Following theme default ${themeInteractionMotionPresetId}.`
                                : 'Following the built-in subtle fallback.')
                            : 'Pinned by module settings.';

                          return (
                            <div
                              key={`interaction-motion-module-${moduleState.module.id}`}
                              className="rounded border p-3"
                              style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">{moduleState.module.label}</div>
                                  <p className="mt-1 text-[11px] leading-4 opacity-45">
                                    {moduleState.module.description}
                                    {' '}
                                    Live preset: <strong>{moduleState.effectiveProfile.label}</strong>. {followLabel}
                                  </p>
                                </div>
                                <label className="inline-flex items-center gap-2 text-[11px] font-medium" style={{ color: text }}>
                                  <input
                                    type="checkbox"
                                    aria-label={`Enable ${moduleState.module.label} interaction motion`}
                                    checked={moduleEnabled}
                                    onChange={event => setInteractionMotionModuleEnabled(moduleState.module.id, event.target.checked)}
                                  />
                                  <span>Lane Enabled</span>
                                </label>
                              </div>

                              <div className="mt-3 rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Preset Studio</div>
                                    <div className="mt-1 text-[10px] leading-4 opacity-45">
                                      Pick motion family per lane. Files can bounce while chrome stays restrained, or vice versa.
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    aria-label={`Follow theme interaction motion preset for ${moduleState.module.label}`}
                                    onClick={() => setInteractionMotionModulePresetId(moduleState.module.id, null)}
                                    className="rounded px-3 py-2 text-left transition-colors"
                                    style={{
                                      border: `1px solid ${moduleState.moduleOverride.presetId == null ? accent : border}`,
                                      background: moduleState.moduleOverride.presetId == null ? `${accent}16` : 'rgba(255,255,255,0.03)',
                                      color: text,
                                      minWidth: '14rem',
                                    }}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-[11px] font-semibold">Follow Routing</span>
                                      <span className="text-[9px] font-semibold uppercase tracking-[0.12em]" style={{ color: moduleState.moduleOverride.presetId == null ? accent : muted }}>
                                        Default Path
                                      </span>
                                    </div>
                                    <div className="mt-1 text-[10px] leading-4 opacity-50">{followLabel}</div>
                                  </button>
                                </div>

                                <div className="mt-4 space-y-3">
                                  {interactionMotionPresetGroups.map(group => (
                                    <div key={`${moduleState.module.id}-${group.id}`} className="space-y-2">
                                      <div className="flex items-center justify-between gap-3">
                                        <div>
                                          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">{group.label}</div>
                                          <div className="mt-1 text-[10px] leading-4 opacity-45">{group.subtitle}</div>
                                        </div>
                                        <span className="rounded border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em]" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: muted }}>
                                          {group.options.length} presets
                                        </span>
                                      </div>

                                      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                        {group.options.map(option => {
                                          const active = moduleState.moduleOverride.presetId === option.id;
                                          return (
                                            <button
                                              key={`interaction-motion-preset-${moduleState.module.id}-${option.id}`}
                                              type="button"
                                              aria-label={`Use ${option.label} interaction motion preset for ${moduleState.module.label}`}
                                              onClick={() => setInteractionMotionModulePresetId(moduleState.module.id, option.id)}
                                              className="rounded px-3 py-3 text-left transition-colors"
                                              style={{
                                                border: `1px solid ${active ? accent : border}`,
                                                background: active ? `${accent}16` : 'rgba(255,255,255,0.03)',
                                                color: text,
                                              }}
                                            >
                                              <div className="flex items-start justify-between gap-2">
                                                <div>
                                                  <div className="text-[11px] font-semibold">{option.label}</div>
                                                  <div className="mt-1 text-[9px] font-semibold uppercase tracking-[0.12em]" style={{ color: active ? accent : muted }}>
                                                    {group.label}
                                                  </div>
                                                </div>
                                                {moduleState.effectivePresetId === option.id && (
                                                  <span className="rounded border px-1.5 py-1 text-[8px] font-semibold uppercase tracking-[0.12em]" style={{ borderColor: `${accent}66`, color: accent }}>
                                                    Live
                                                  </span>
                                                )}
                                              </div>
                                              <div className="mt-2 text-[10px] leading-4 opacity-50">{option.description}</div>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="mt-3">
                                <RangeField
                                  label={`${moduleState.module.label} Intensity`}
                                  description="Lane-specific multiplier after the master intensity. Use this to keep chrome restrained while files/icons go harder."
                                  min={0.25}
                                  max={2.5}
                                  step={0.05}
                                  value={moduleState.moduleOverride.intensityMultiplier}
                                  valueLabel={`${moduleState.moduleOverride.intensityMultiplier.toFixed(2)}x`}
                                  onChange={value => setInteractionMotionModuleIntensity(moduleState.module.id, value)}
                                />
                              </div>

                              <div className="mt-3 rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Modifier Controls</div>
                                    <div className="mt-1 text-[10px] leading-4 opacity-45">
                                      Selected preset exposes its own tweak set, KCloner-style.
                                    </div>
                                  </div>
                                  <span className="rounded border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em]" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: muted }}>
                                    {moduleState.modifierControls.length > 0 ? `${moduleState.modifierControls.length} knobs` : 'No extra knobs'}
                                  </span>
                                </div>

                                {moduleState.modifierControls.length > 0 ? (
                                  <div className="mt-3 space-y-3">
                                    {moduleState.modifierControls.map(control => (
                                      <RangeField
                                        key={`${moduleState.module.id}-${moduleState.effectivePresetId}-${control.id}`}
                                        label={control.label}
                                        description={control.description}
                                        min={control.min}
                                        max={control.max}
                                        step={control.step}
                                        value={moduleState.modifierValues[control.id]}
                                        valueLabel={formatInteractionMotionModifierControlValue(
                                          control,
                                          moduleState.modifierValues[control.id],
                                        )}
                                        onChange={value => setInteractionMotionModuleModifierValue(
                                          moduleState.module.id,
                                          moduleState.effectivePresetId,
                                          control.id,
                                          value,
                                        )}
                                      />
                                    ))}
                                  </div>
                                ) : (
                                  <div className="mt-3 rounded border px-3 py-2 text-[10px] leading-4 opacity-55" style={{ borderColor: border, background: 'rgba(255,255,255,0.02)' }}>
                                    This profile stays simple. Switch to a KCloner motion family to get a richer tweak set for this lane.
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Surface Overrides</div>
                            <p className="mt-1 text-[11px] opacity-45">
                              Disable motion on one surface without changing the module preset or tweak values feeding the rest of that lane.
                            </p>
                          </div>
                          <span className="rounded border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em]" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: muted }}>
                            {interactionMotionSurfaceCatalog.length} surfaces
                          </span>
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
                          {interactionMotionModuleCatalog.map(module => (
                            <div key={`interaction-motion-surface-group-${module.id}`} className="rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.02)' }}>
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">{module.label}</div>
                                  <div className="mt-1 text-[10px] leading-4 opacity-45">{module.description}</div>
                                </div>
                                <span className="rounded border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em]" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: muted }}>
                                  {module.surfaceIds.length} surfaces
                                </span>
                              </div>

                              <div className="mt-3 grid grid-cols-1 gap-2">
                                {interactionMotionSurfaceCatalog
                                  .filter(surface => surface.moduleId === module.id)
                                  .map(surface => {
                                    const override = settings.appearance.interactionMotionSurfaceOverrides[surface.id];
                                    const surfaceEnabled = typeof override === 'boolean'
                                      ? override
                                      : override?.enabled !== false;
                                    return (
                                      <label
                                        key={`interaction-motion-surface-${surface.id}`}
                                        className="flex items-start gap-3 rounded border px-3 py-2"
                                        style={{
                                          borderColor: surfaceEnabled ? border : `${accent}44`,
                                          background: surfaceEnabled ? 'rgba(255,255,255,0.02)' : `${accent}0c`,
                                        }}
                                      >
                                        <input
                                          type="checkbox"
                                          aria-label={`Enable ${surface.label} interaction motion`}
                                          checked={surfaceEnabled}
                                          onChange={event => setInteractionMotionSurfaceEnabled(surface.id, event.target.checked)}
                                        />
                                        <span style={{ minWidth: 0 }}>
                                          <span className="text-[11px] font-semibold" style={{ color: text }}>{surface.label}</span>
                                          <span className="mt-1 block text-[10px] leading-4 opacity-50">{surface.description}</span>
                                        </span>
                                      </label>
                                    );
                                  })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <InteractionMotionLab
                        appearance={appAppearance}
                        accent={accent}
                        border={border}
                        text={text}
                        muted={muted}
                      />
                    </div>
                  </div>
                </div>
              </section>
            )}

            {activeSection === 'hotkeys' && (
              <section className="rounded border p-4" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
                <SectionTitle
                  icon={<TerminalSquare size={12} />}
                  title="Hotkeys"
                  subtitle="Keep the overlay opener configurable and expose the shell presentation toggles alongside the first global gesture controls."
                />

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  {hotkeyBindingDefinitions
                    .filter(definition => (
                      definition.scope === 'global'
                      || definition.scope === 'gesture'
                      || definition.key === 'windowModeToggle'
                      || definition.key === 'zenFocusModeToggle'
                      || definition.key === 'toggleDeveloperTelemetryHud'
                    ))
                    .map(definition => (
                      <ShortcutField
                        key={definition.key}
                        bindingKey={definition.key}
                        value={settings.keybindings[definition.key]}
                        onCommit={value => updateKeybindings({ [definition.key]: value })}
                      />
                    ))}
                </div>
                <div className="mt-4 rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Explorer Hotkeys</div>
                  <p className="mt-1 text-[11px] opacity-40">
                    These bindings drive the file browser directly, keeping the content-browser flow on the same data-driven shortcut system as the rest of the app.
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    {hotkeyBindingDefinitions
                      .filter(definition => [
                        'newFile',
                        'newFolder',
                        'renameItem',
                        'deleteItem',
                        'duplicateItem',
                        'refreshExplorer',
                        'goBackDirectory',
                        'goForwardDirectory',
                        'goHomeDirectory',
                        'cycleExplorerSearchMode',
                        'findSimilarSelection',
                        'goUpDirectory',
                        'explorerMoveSelectionUp',
                        'explorerMoveSelectionDown',
                        'explorerMoveSelectionLeft',
                        'explorerMoveSelectionRight',
                        'toggleExplorerSources',
                        'togglePreviewLock',
                        'copyPath',
                        'copySelection',
                        'cutSelection',
                        'pasteSelection',
                        'toggleHiddenFiles',
                        'toggleExplorerLayout',
                        'cycleConstellationLens',
                        'toggleConstellationRouteMode',
                        'toggleConstellationPinSelection',
                        'togglePreviewTerminal',
                        'searchExplorer',
                        'selectAllExplorer',
                        'clearExplorerSelection',
                      ].includes(definition.key))
                      .map(definition => (
                        <ShortcutField
                          key={definition.key}
                          bindingKey={definition.key}
                          value={settings.keybindings[definition.key]}
                          onCommit={value => updateKeybindings({ [definition.key]: value })}
                        />
                      ))}
                  </div>
                </div>
                <div className="mt-4 rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Audio Workbench Hotkeys</div>
                  <p className="mt-1 text-[11px] opacity-40">
                    Power-user bindings for the explorer audio preview and editor: playback, preview-edit switching, trim navigation, silence review, and fast clip export all route through the same settings-backed shortcut system.
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    {hotkeyBindingDefinitions
                      .filter(definition => [
                        'audioWorkbenchPlayPause',
                        'audioWorkbenchToggleEditMode',
                        'audioWorkbenchJumpToSelectionStart',
                        'audioWorkbenchJumpToSelectionEnd',
                        'audioWorkbenchPreviousSilence',
                        'audioWorkbenchNextSilence',
                        'audioWorkbenchExportClip',
                      ].includes(definition.key))
                      .map(definition => (
                        <ShortcutField
                          key={definition.key}
                          bindingKey={definition.key}
                          value={settings.keybindings[definition.key]}
                          onCommit={value => updateKeybindings({ [definition.key]: value })}
                        />
                      ))}
                  </div>
                </div>
                <div className="mt-4 rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Shader Workbench Hotkeys</div>
                  <p className="mt-1 text-[11px] opacity-40">
                    Keyboard coverage for the explorer shader workbench: save, preview/edit mode switching, and scene host toggling all stay on the same settings-backed shortcut layer as the other inline workbenches.
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    {hotkeyBindingDefinitions
                      .filter(definition => [
                        'saveFile',
                        'shaderWorkbenchToggleEditMode',
                        'shaderWorkbenchToggleScene',
                      ].includes(definition.key))
                      .map(definition => (
                        <ShortcutField
                          key={definition.key}
                          bindingKey={definition.key}
                          value={settings.keybindings[definition.key]}
                          onCommit={value => updateKeybindings({ [definition.key]: value })}
                        />
                      ))}
                  </div>
                </div>
                <div className="mt-4 rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Spreadsheet Workbench Hotkeys</div>
                  <p className="mt-1 text-[11px] opacity-40">
                    Keyboard coverage for the spreadsheet preview/editor: preview-edit mode switching, sheet travel, sheet creation, formula focus, and save all stay inside the shared explorer shortcut system.
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    {hotkeyBindingDefinitions
                      .filter(definition => [
                        'saveFile',
                        'spreadsheetWorkbenchToggleEditMode',
                        'spreadsheetWorkbenchPreviousSheet',
                        'spreadsheetWorkbenchNextSheet',
                        'spreadsheetWorkbenchNewSheet',
                        'spreadsheetWorkbenchFocusFormulaBar',
                      ].includes(definition.key))
                      .map(definition => (
                        <ShortcutField
                          key={definition.key}
                          bindingKey={definition.key}
                          value={settings.keybindings[definition.key]}
                          onCommit={value => updateKeybindings({ [definition.key]: value })}
                        />
                      ))}
                  </div>
                </div>
                <div className="mt-4 rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">PDF Workbench Hotkeys</div>
                  <p className="mt-1 text-[11px] opacity-40">
                    Keyboard coverage for the inline PDF workbench: page travel, zoom, save, and preview/edit mode switching all stay inside the shared explorer shortcut system.
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    {hotkeyBindingDefinitions
                      .filter(definition => [
                        'saveFile',
                        'pdfWorkbenchPreviousPage',
                        'pdfWorkbenchNextPage',
                        'pdfWorkbenchZoomIn',
                        'pdfWorkbenchZoomOut',
                        'pdfWorkbenchToggleEditMode',
                      ].includes(definition.key))
                      .map(definition => (
                        <ShortcutField
                          key={definition.key}
                          bindingKey={definition.key}
                          value={settings.keybindings[definition.key]}
                          onCommit={value => updateKeybindings({ [definition.key]: value })}
                        />
                      ))}
                  </div>
                </div>
                <div className="mt-4 rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Image Editor Hotkeys</div>
                  <p className="mt-1 text-[11px] opacity-40">
                    Keyboard coverage for the explorer image editor: save, undo, redo, reset, and selection cleanup all stay on the same settings-backed shortcut layer as the rest of the shell.
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    {hotkeyBindingDefinitions
                      .filter(definition => [
                        'saveFile',
                        'deleteItem',
                        'imageEditorUndo',
                        'imageEditorRedo',
                        'imageEditorReset',
                      ].includes(definition.key))
                      .map(definition => (
                        <ShortcutField
                          key={definition.key}
                          bindingKey={definition.key}
                          value={settings.keybindings[definition.key]}
                          onCommit={value => updateKeybindings({ [definition.key]: value })}
                        />
                      ))}
                  </div>
                </div>
              </section>
            )}

            {activeSection === 'terminal' && (
              <section className="rounded border p-4" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
                <SectionTitle
                  icon={<TerminalSquare size={12} />}
                  title="Terminal"
                  subtitle="Application mode, dock mode, integrated shell defaults, and external terminal handoff."
                />

                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-3 md:col-span-2 rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Shell Presentation</div>
                        <p className="mt-1 text-[11px] opacity-40">
                          `Ctrl+Space` always shows the current presentation mode. Use {formatHotkeyLabel(settings.keybindings.windowModeToggle)} to swap between the dock-style overlay shell and a regular desktop application window, and {formatHotkeyLabel(settings.keybindings.zenFocusModeToggle)} to hide the shell top bar for a cleaner explorer-focused pass.
                        </p>
                      </div>
                      <span className="rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text }}>
                        {settings.terminal.windowMode === 'windowed' ? 'Application Window' : 'Dock Overlay'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      {([
                        {
                          value: 'overlay',
                          label: 'Dock Mode',
                          description: 'Pins the shell to the monitor edge, keeps the hotkey-driven dock flow, and uses the current anchor behavior.',
                        },
                        {
                          value: 'windowed',
                          label: 'Application Mode',
                          description: 'Opens as a regular resizable desktop window with native minimize, maximize, and close controls.',
                        },
                      ] as const satisfies Array<{ value: TerminalWindowMode; label: string; description: string }>).map(option => {
                        const active = settings.terminal.windowMode === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                              if (onSetWindowMode) {
                                void onSetWindowMode(option.value);
                                return;
                              }
                              updateTerminal({ windowMode: option.value });
                            }}
                            className="rounded px-3 py-3 text-left transition-colors"
                            style={{
                              border: `1px solid ${active ? accent : border}`,
                              background: active ? `${accent}14` : 'rgba(255,255,255,0.03)',
                              color: text,
                            }}
                          >
                            <div className="text-[11px] font-semibold">{option.label}</div>
                            <p className="mt-1 text-[11px] opacity-45">{option.description}</p>
                          </button>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">Windowed Width</label>
                        <input
                          type="number"
                          min={720}
                          step={20}
                          value={settings.terminal.windowedWidth}
                          onChange={event => updateTerminal({ windowedWidth: Number(event.target.value) })}
                          className="w-full rounded border px-3 py-2 text-[11px] outline-none"
                          style={settingsFieldStyle}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">Windowed Height</label>
                        <input
                          type="number"
                          min={480}
                          step={20}
                          value={settings.terminal.windowedHeight}
                          onChange={event => updateTerminal({ windowedHeight: Number(event.target.value) })}
                          className="w-full rounded border px-3 py-2 text-[11px] outline-none"
                          style={settingsFieldStyle}
                        />
                      </div>
                    </div>

                    <label
                      className="flex items-center justify-between gap-3 rounded border px-3 py-2 text-[11px]"
                      style={{ borderColor: border }}
                    >
                      <div>
                        <div className="font-medium">Show Terminal Sidebar</div>
                        <p className="mt-1 text-[10px] opacity-45">
                          Keeps the directories and command rail expanded when the terminal opens. You can still tuck it away live from the terminal header.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        aria-label="Show terminal sidebar"
                        checked={settings.terminal.showSidebar}
                        onChange={event => updateTerminal({ showSidebar: event.target.checked })}
                      />
                    </label>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">Integrated Shell</label>
                    <input
                      value={settings.terminal.shell}
                      onChange={event => updateTerminal({ shell: event.target.value })}
                      className="w-full rounded border px-3 py-2 text-[11px] outline-none"
                      style={settingsMonoFieldStyle}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">Terminal Font</label>
                    <input
                      value={settings.terminal.fontFamily}
                      onChange={event => updateTerminal({ fontFamily: event.target.value })}
                      className="w-full rounded border px-3 py-2 text-[11px] outline-none"
                      style={settingsMonoFieldStyle}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">Font Size</label>
                    <input
                      type="number"
                      min={8}
                      max={24}
                      value={settings.terminal.fontSize}
                      onChange={event => updateTerminal({ fontSize: Number(event.target.value) })}
                      className="w-full rounded border px-3 py-2 text-[11px] outline-none"
                      style={settingsFieldStyle}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">Cursor Style</label>
                    <select
                      aria-label="Cursor Style"
                      value={settings.terminal.cursorStyle}
                      onChange={event => updateTerminal({ cursorStyle: event.target.value as typeof settings.terminal.cursorStyle })}
                      className="w-full rounded border px-3 py-2 text-[11px] outline-none"
                      style={settingsSelectStyle}
                    >
                      <option value="bar">Bar</option>
                      <option value="block">Block</option>
                      <option value="underline">Underline</option>
                    </select>
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">Open Target</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['integrated', 'external'] as const).map(mode => {
                        const active = settings.terminal.preferredOpenMode === mode;
                        return (
                          <button
                            key={mode}
                            onClick={() => updateTerminal({ preferredOpenMode: mode })}
                            className="rounded px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
                            style={{
                              background: active ? `${accent}20` : 'rgba(255,255,255,0.04)',
                              color: active ? text : muted,
                              border: `1px solid ${active ? accent : border}`,
                            }}
                          >
                            {mode}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">External Terminal Profile</label>
                    <select
                      aria-label="External Terminal Profile"
                      value={settings.terminal.externalTerminalProfile}
                      onChange={event => updateTerminal({ externalTerminalProfile: event.target.value as ExternalTerminalProfile })}
                      className="w-full rounded border px-3 py-2 text-[11px] outline-none"
                      style={settingsSelectStyle}
                    >
                      {profileOptions.map(option => (
                        <option key={option.id} value={option.id}>{option.label}</option>
                      ))}
                    </select>
                    <p className="text-[11px] opacity-40">
                      {profileOptions.find(option => option.id === settings.terminal.externalTerminalProfile)?.description ?? 'Use a platform-appropriate terminal profile.'}
                    </p>
                  </div>

                  {(settings.terminal.externalTerminalProfile === 'custom' || settings.terminal.preferredOpenMode === 'external') && (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">External Command</label>
                        <input
                          value={settings.terminal.externalTerminalCommand}
                          onChange={event => updateTerminal({ externalTerminalCommand: event.target.value })}
                          className="w-full rounded border px-3 py-2 text-[11px] outline-none"
                          style={settingsMonoFieldStyle}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">External Args</label>
                        <textarea
                          value={settings.terminal.externalTerminalArgs}
                          onChange={event => updateTerminal({ externalTerminalArgs: event.target.value })}
                          className="min-h-[92px] w-full rounded border px-3 py-2 text-[11px] outline-none"
                          style={settingsMonoFieldStyle}
                        />
                      </div>
                    </>
                  )}

                  <label className="flex items-center justify-between rounded border px-3 py-2 text-[11px]" style={{ borderColor: border }}>
                    <span>Cursor Blink</span>
                    <input
                      type="checkbox"
                      checked={settings.terminal.cursorBlink}
                      onChange={event => updateTerminal({ cursorBlink: event.target.checked })}
                    />
                  </label>
                </div>
              </section>
            )}

            {activeSection === 'layouts' && (
              <section className="rounded border p-4" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
                <SectionTitle
                  icon={<LayoutGrid size={12} />}
                  title="Layouts"
                  subtitle="Drive the whole shell from a manifest instead of a single hardcoded chrome layout."
                />

                <div className="mt-4 space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">Manifest Path</label>
                    <input
                      value={settings.layout.configPath}
                      onChange={event => updateLayout({ configPath: event.target.value })}
                      placeholder="Leave blank to probe ~/.greeblefs/greeblefs.layouts.json or .toml"
                      className="w-full rounded border px-3 py-2 text-[11px] outline-none"
                      style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text, fontFamily: appearance.fonts.mono }}
                    />
                    <div className="flex flex-wrap items-center gap-2 text-[10px]">
                      <button
                        onClick={() => updateLayout({ configPath: '' })}
                        className="rounded px-2 py-1 font-semibold uppercase tracking-[0.14em]"
                        style={{ border: `1px solid ${border}`, background: 'rgba(255,255,255,0.04)', color: text }}
                      >
                        Use Auto Probe
                      </button>
                      <span
                        className="rounded border px-2 py-1 font-semibold uppercase tracking-[0.14em]"
                        style={{
                          borderColor: layoutManifestState.sourceError ? '#f97316' : accent,
                          background: layoutManifestState.sourceError ? 'rgba(249,115,22,0.12)' : `${accent}12`,
                          color: layoutManifestState.sourceError ? '#fdba74' : text,
                        }}
                      >
                        {layoutManifestState.sourceType === 'file' ? 'External Manifest' : 'Built In'}
                      </span>
                    </div>
                    <p className="text-[11px] opacity-40">
                      {layoutSourceSummary}
                    </p>
                    {layoutManifestState.sourceError && (
                      <div className="rounded border px-3 py-2 text-[11px]" style={{ borderColor: '#7f1d1d', background: 'rgba(127,29,29,0.18)', color: '#fecaca' }}>
                        Manifest load failed: {layoutManifestState.sourceError}
                      </div>
                    )}
                  </div>

                  <div className="rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Profiles</div>
                        <p className="mt-1 text-[11px] opacity-40">
                          Click a profile to switch the entire workbench layout. The GreebleFS chrome button still cycles this same ordered set.
                        </p>
                      </div>
                      <span className="rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text }}>
                        {layoutManifestState.manifest.profiles.length} loaded
                      </span>
                    </div>

                    <div className="mt-3 space-y-2">
                      {layoutManifestState.manifest.profiles.map(profile => {
                        const active = profile.id === activeLayoutProfile.id;
                        return (
                          <button
                            key={profile.id}
                            onClick={() => updateLayout({ activeProfileId: profile.id })}
                            className="w-full rounded border px-3 py-3 text-left transition-colors"
                            style={{
                              borderColor: active ? accent : border,
                              background: active ? `${accent}16` : 'rgba(255,255,255,0.03)',
                              color: text,
                            }}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-[11px] font-semibold">{profile.label}</div>
                                <p className="mt-1 text-[11px] opacity-45">{profile.description}</p>
                              </div>
                              {active && (
                                <span className="rounded border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em]" style={{ borderColor: accent, color: accent }}>
                                  Live
                                </span>
                              )}
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2 text-[9px] font-semibold uppercase tracking-[0.12em] opacity-70">
                              <span className="rounded border px-2 py-1" style={{ borderColor: border }}>
                                Bar {profile.chrome.barPosition}
                              </span>
                              <span className="rounded border px-2 py-1" style={{ borderColor: border }}>
                                Dock {profile.controlDock.enabled ? profile.controlDock.side : 'off'}
                              </span>
                              <span className="rounded border px-2 py-1" style={{ borderColor: border }}>
                                Pinned {profile.pinnedPanels.length}
                              </span>
                              <span className="rounded border px-2 py-1" style={{ borderColor: border }}>
                                Default {profile.behavior.defaultActivePanelId}
                              </span>
                              <span className="rounded border px-2 py-1" style={{ borderColor: border }}>
                                Primary {profile.interaction.primaryAxisOwner}
                              </span>
                              <span className="rounded border px-2 py-1" style={{ borderColor: border }}>
                                Command {profile.interaction.commandOwner}
                              </span>
                              <span className="rounded border px-2 py-1" style={{ borderColor: border }}>
                                Back {profile.interaction.backBehavior}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {activeSection === 'system' && (
              <section className="rounded border p-4" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
                <SectionTitle
                  icon={<Settings2 size={12} />}
                  title="System"
                  subtitle="Machine-level startup behavior and OS integration state."
                />

                <div className="mt-4 space-y-3">
                  <label className="flex items-center justify-between rounded border px-3 py-3 text-[11px]" style={{ borderColor: border }}>
                    <div>
                      <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Launch At Startup</div>
                      <p className="mt-1 text-[11px] opacity-40">
                        Registers GreebleFS as a login item so the tray and overlay are available after sign-in.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.system.launchAtStartup}
                      disabled={startupSyncPending}
                      onChange={event => void setLaunchAtStartup(event.target.checked)}
                    />
                  </label>
                  <label className="flex items-center justify-between rounded border px-3 py-3 text-[11px]" style={{ borderColor: border }}>
                    <div>
                      <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Hide App In Tray</div>
                      <p className="mt-1 text-[11px] opacity-40">
                        Keeps a {platform === 'macos' ? 'menu bar' : 'system tray'} entry available so the overlay can stay resident when the main window is hidden.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.system.hideAppInTray}
                      onChange={event => setHideAppInTray(event.target.checked)}
                    />
                  </label>
                  <label className="flex items-center justify-between rounded border px-3 py-3 text-[11px]" style={{ borderColor: border }}>
                    <div>
                      <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Show In Taskbar</div>
                      <p className="mt-1 text-[11px] opacity-40">
                        Shows the main window in the {platform === 'macos' ? 'Dock' : 'taskbar'} while the shell is running so application mode behaves like a regular desktop app.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.system.showInTaskbar}
                      onChange={event => setShowInTaskbar(event.target.checked)}
                    />
                  </label>
                  <div className="rounded border px-3 py-3 text-[11px]" style={{ borderColor: border }}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold uppercase tracking-[0.12em] opacity-60">GPU Runtime</div>
                        <p className="mt-1 text-[11px] opacity-40">
                          Controls the native `wgpu` offload lane used for image thumbnails, image preview rendering, and audio analysis/spectrogram work. `Safe` forces CPU fallback.
                        </p>
                      </div>
                      <span
                        className="rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                        style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text }}
                      >
                        {getGpuTierModeLabel(gpuRuntimeSnapshot.effectiveTier)}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-4">
                      {gpuRuntimeTierOptions.map(option => {
                        const active = settings.system.gpuTierMode === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => updateSystem({ gpuTierMode: option.id })}
                            className="rounded px-3 py-3 text-left transition-colors"
                            style={{
                              border: `1px solid ${active ? accent : border}`,
                              background: active ? `${accent}14` : 'rgba(255,255,255,0.03)',
                              color: text,
                            }}
                          >
                            <div className="text-[10px] font-semibold uppercase tracking-[0.12em]">
                              {option.label}
                            </div>
                            <p className="mt-2 text-[11px] leading-4 opacity-65">
                              {option.description}
                            </p>
                          </button>
                        );
                      })}
                    </div>

                    <div
                      className="mt-3 rounded border px-3 py-2 text-[11px]"
                      style={{ borderColor: border, background: 'rgba(255,255,255,0.025)', color: text }}
                    >
                      {gpuRuntimeDiagnosticsSummary}
                    </div>
                    <div
                      className="mt-2 rounded border px-3 py-2 text-[11px]"
                      style={{ borderColor: border, background: 'rgba(255,255,255,0.025)', color: muted }}
                    >
                      {gpuRuntimeFeedStatus}
                    </div>
                    {gpuRuntimeSnapshot.workloads.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {gpuRuntimeSnapshot.workloads.map(workload => (
                          <span
                            key={workload.workloadId}
                            className="rounded border px-2 py-1 text-[10px] uppercase tracking-[0.12em]"
                            style={{ borderColor: border, background: 'rgba(255,255,255,0.03)', color: text }}
                          >
                            {workload.label} · {workload.ready ? 'GPU ready' : 'CPU fallback'} · exec {workload.executions} · fallback {workload.fallbackCount}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="rounded border px-3 py-3 text-[11px]" style={{ borderColor: border }}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Acceleration Pipeline</div>
                        <p className="mt-1 text-[11px] opacity-40">
                          Cross-provider routing for CPU fallback, the native `wgpu` lane, and the Python-sidecar CUDA/AI lane. Future thumbnail, media, indexing, inference, and similarity features should resolve through this contract.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleProbeAccelerationPipeline()}
                        disabled={accelerationProbePending}
                        className="rounded border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors"
                        style={{
                          borderColor: accelerationProbePending ? border : accent,
                          background: accelerationProbePending ? 'rgba(255,255,255,0.03)' : `${accent}14`,
                          color: text,
                          opacity: accelerationProbePending ? 0.7 : 1,
                        }}
                      >
                        {accelerationProbePending ? 'Probing…' : 'Probe CUDA / AI'}
                      </button>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-4">
                      {accelerationRoutingModeOptions.map(option => {
                        const active = settings.system.accelerationRoutingMode === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => updateSystem({ accelerationRoutingMode: option.id })}
                            className="rounded px-3 py-3 text-left transition-colors"
                            style={{
                              border: `1px solid ${active ? accent : border}`,
                              background: active ? `${accent}14` : 'rgba(255,255,255,0.03)',
                              color: text,
                            }}
                          >
                            <div className="text-[10px] font-semibold uppercase tracking-[0.12em]">
                              {option.label}
                            </div>
                            <p className="mt-2 text-[11px] leading-4 opacity-65">
                              {option.description}
                            </p>
                          </button>
                        );
                      })}
                    </div>

                    <div
                      className="mt-3 rounded border px-3 py-2 text-[11px]"
                      style={{ borderColor: border, background: 'rgba(255,255,255,0.025)', color: text }}
                    >
                      {accelerationProviderSummary}
                    </div>
                    <div
                      className="mt-2 rounded border px-3 py-2 text-[11px]"
                      style={{ borderColor: border, background: 'rgba(255,255,255,0.025)', color: muted }}
                    >
                      {accelerationPipelineStatus}
                    </div>

                    {accelerationRuntimeSnapshot.providers.length > 0 ? (
                      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
                        {accelerationRuntimeSnapshot.providers.map(provider => (
                          <div
                            key={provider.providerKind}
                            className="rounded border px-3 py-3"
                            style={{ borderColor: border, background: 'rgba(255,255,255,0.02)', color: text }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-[10px] font-semibold uppercase tracking-[0.12em]">
                                {provider.label}
                              </div>
                              <span className="opacity-55">
                                {provider.ready ? 'Ready' : provider.available ? 'Detected' : 'Unavailable'}
                              </span>
                            </div>
                            <p className="mt-2 text-[11px] leading-4 opacity-70">
                              {provider.detail}
                            </p>
                            {provider.supportedWorkloadIds.length > 0 ? (
                              <div className="mt-2 text-[10px] uppercase tracking-[0.12em] opacity-50">
                                {provider.supportedWorkloadIds.join(' · ')}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : null}

                    <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                      {accelerationWorkloadRoutes.map(route => (
                        <div
                          key={route.definition.id}
                          className="rounded border px-3 py-3"
                          style={{ borderColor: border, background: 'rgba(255,255,255,0.02)', color: text }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.12em]">
                              {route.definition.label}
                            </div>
                            <span className="opacity-55">
                              {route.resolution.provider?.label ?? route.resolution.providerKind}
                            </span>
                          </div>
                          <p className="mt-2 text-[11px] leading-4 opacity-65">
                            {route.definition.description}
                          </p>
                          <div className="mt-2 text-[10px] uppercase tracking-[0.12em] opacity-50">
                            {route.resolution.ready
                              ? 'provider ready'
                              : route.resolution.available
                                ? 'provider detected'
                                : 'cpu fallback'}
                          </div>
                        </div>
                      ))}
                    </div>

                    {accelerationRuntimeSnapshot.pythonProbe ? (
                      <div
                        className="mt-3 rounded border px-3 py-3 text-[11px]"
                        style={{ borderColor: border, background: 'rgba(255,255,255,0.02)', color: text }}
                      >
                        <div className="font-semibold uppercase tracking-[0.12em] opacity-60">
                          Python CUDA Probe
                        </div>
                        <p className="mt-2 opacity-70">
                          {accelerationRuntimeSnapshot.pythonProbe.platform} · Python {accelerationRuntimeSnapshot.pythonProbe.pythonVersion}
                          {accelerationRuntimeSnapshot.pythonProbe.cudaVisibleDevices
                            ? ` · CUDA_VISIBLE_DEVICES=${accelerationRuntimeSnapshot.pythonProbe.cudaVisibleDevices}`
                            : ''}
                        </p>
                        {accelerationRuntimeSnapshot.pythonProbe.torch.devices.length > 0 ? (
                          <p className="mt-2 opacity-65">
                            Torch devices: {accelerationRuntimeSnapshot.pythonProbe.torch.devices.map(device => device.name).join(', ')}
                          </p>
                        ) : null}
                        {accelerationRuntimeSnapshot.pythonProbe.optionalModules.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {accelerationRuntimeSnapshot.pythonProbe.optionalModules.map(module => (
                              <span
                                key={module.id}
                                className="rounded border px-2 py-1 text-[10px] uppercase tracking-[0.12em]"
                                style={{ borderColor: border, background: 'rgba(255,255,255,0.03)', color: text }}
                              >
                                {module.id} · {module.imported ? 'ready' : module.installed ? 'installed' : 'missing'}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <label className="flex items-center justify-between rounded border px-3 py-3 text-[11px]" style={{ borderColor: border }}>
                    <div>
                      <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Developer Mode</div>
                      <p className="mt-1 text-[11px] opacity-40">
                        Enables live watchers and hot reload for plugins, shaders, animations, and explorer metadata. Leave this off for the normal production path and use manual refresh actions instead.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.system.developerMode}
                      onChange={event => updateSystem({ developerMode: event.target.checked })}
                    />
                  </label>
                  <label className="flex items-center justify-between rounded border px-3 py-3 text-[11px]" style={{ borderColor: border }}>
                    <div className="pr-4">
                      <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Developer Telemetry</div>
                      <p className="mt-1 text-[11px] opacity-40">
                        Records frontend, bridge, native, and plugin/runtime spans into structured session traces for deep debugging in dev and installed builds.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.system.developerTelemetryEnabled}
                      onChange={event => updateSystem({ developerTelemetryEnabled: event.target.checked })}
                    />
                  </label>
                  <label className="flex items-center justify-between rounded border px-3 py-3 text-[11px]" style={{ borderColor: border }}>
                    <div className="pr-4">
                      <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Source Trace Mode</div>
                      <p className="mt-1 text-[11px] opacity-40">
                        Dev-only extra trace depth with source-aware stacks and callsites. Pressing {formatHotkeyLabel(settings.keybindings.toggleDeveloperTelemetryHud)} also arms this automatically when the HUD opens.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.system.sourceTraceModeEnabled}
                      onChange={event => updateSystem({ sourceTraceModeEnabled: event.target.checked })}
                    />
                  </label>
                  <label className="flex items-center justify-between rounded border px-3 py-3 text-[11px]" style={{ borderColor: border }}>
                    <div className="pr-4">
                      <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Consumer Diagnostics</div>
                      <p className="mt-1 text-[11px] opacity-40">
                        Keeps local diagnostic traces available for support bundles when themes, plugins, or renderers misbehave in production.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.system.consumerDiagnosticsEnabled}
                      onChange={event => updateSystem({ consumerDiagnosticsEnabled: event.target.checked })}
                    />
                  </label>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="rounded border px-3 py-3 text-[11px]" style={{ borderColor: border }}>
                      <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Capture Mode</div>
                      <p className="mt-1 opacity-40">Raw keeps the deepest trace. Sampled trims noise. Perf-only records timing without full action detail.</p>
                      <select
                        aria-label="Telemetry Capture Mode"
                        value={settings.system.developerTelemetryCaptureMode}
                        onChange={event => updateSystem({
                          developerTelemetryCaptureMode: event.target.value as typeof settings.system.developerTelemetryCaptureMode,
                        })}
                        className="mt-3 w-full rounded border bg-transparent px-2 py-2 text-[11px]"
                        style={settingsSelectStyle}
                      >
                        <option value="raw">Raw</option>
                        <option value="sampled">Sampled</option>
                        <option value="perf-only">Perf Only</option>
                      </select>
                    </label>
                    <label className="rounded border px-3 py-3 text-[11px]" style={{ borderColor: border }}>
                      <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Payload Detail</div>
                      <p className="mt-1 opacity-40">Metadata-only avoids noisy args. Small payload mode preserves compact command details for debugging.</p>
                      <select
                        aria-label="Telemetry Payload Detail"
                        value={settings.system.developerTelemetryPayloadMode}
                        onChange={event => updateSystem({
                          developerTelemetryPayloadMode: event.target.value as typeof settings.system.developerTelemetryPayloadMode,
                        })}
                        className="mt-3 w-full rounded border bg-transparent px-2 py-2 text-[11px]"
                        style={settingsSelectStyle}
                      >
                        <option value="metadata-only">Metadata Only</option>
                        <option value="metadata+small-payloads">Metadata + Small Payloads</option>
                      </select>
                    </label>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <label className="rounded border px-3 py-3 text-[11px]" style={{ borderColor: border }}>
                      <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Max Session File</div>
                      <p className="mt-1 opacity-40">Hard cap before the native writer rolls to the next session file.</p>
                      <input
                        type="number"
                        min={8}
                        max={512}
                        step={1}
                        value={settings.system.developerTelemetryMaxFileSizeMb}
                        onChange={event => updateSystem({
                          developerTelemetryMaxFileSizeMb: Number(event.target.value),
                        })}
                        className="mt-3 w-full rounded border bg-transparent px-2 py-2 text-[11px]"
                        style={settingsFieldStyle}
                      />
                    </label>
                    <label className="flex items-center justify-between rounded border px-3 py-3 text-[11px]" style={{ borderColor: border }}>
                      <div className="pr-4">
                        <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Write Trace Files</div>
                        <p className="mt-1 opacity-40">Persist session JSONL traces to disk for later inspection and bundle export.</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.system.developerTelemetryWriteToFile}
                        onChange={event => updateSystem({ developerTelemetryWriteToFile: event.target.checked })}
                      />
                    </label>
                    <label className="flex items-center justify-between rounded border px-3 py-3 text-[11px]" style={{ borderColor: border }}>
                      <div className="pr-4">
                        <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Show Inspector Surface</div>
                        <p className="mt-1 opacity-40">Keeps the live telemetry inspector lane available for future dev HUD and diagnostics UI.</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.system.developerTelemetryShowInspector}
                        onChange={event => updateSystem({ developerTelemetryShowInspector: event.target.checked })}
                      />
                    </label>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <label className="flex items-center justify-between rounded border px-3 py-3 text-[11px]" style={{ borderColor: border }}>
                      <div className="pr-4">
                        <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Plugin Runtime Diagnostics</div>
                        <p className="mt-1 opacity-40">Include plugin attribution and execution context in consumer bundles.</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.system.consumerDiagnosticsIncludePluginRuntime}
                        onChange={event => updateSystem({ consumerDiagnosticsIncludePluginRuntime: event.target.checked })}
                      />
                    </label>
                    <label className="flex items-center justify-between rounded border px-3 py-3 text-[11px]" style={{ borderColor: border }}>
                      <div className="pr-4">
                        <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Renderer Diagnostics</div>
                        <p className="mt-1 opacity-40">Include renderer/theme execution context in exported support bundles.</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.system.consumerDiagnosticsIncludeRendererRuntime}
                        onChange={event => updateSystem({ consumerDiagnosticsIncludeRendererRuntime: event.target.checked })}
                      />
                    </label>
                    <label className="flex items-center justify-between rounded border px-3 py-3 text-[11px]" style={{ borderColor: border }}>
                      <div className="pr-4">
                        <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Perf Samples In Bundles</div>
                        <p className="mt-1 opacity-40">Keep performance timing summaries alongside trace files for support triage.</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.system.consumerDiagnosticsIncludePerfSamples}
                        onChange={event => updateSystem({ consumerDiagnosticsIncludePerfSamples: event.target.checked })}
                      />
                    </label>
                  </div>
                  {platform === 'linux' && (
                    <label className="flex items-center justify-between gap-4 rounded border px-3 py-3 text-[11px]" style={{ borderColor: border }}>
                      <div className="min-w-0">
                        <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Linux Display Backend</div>
                        <p className="mt-1 text-[11px] opacity-40">
                          Chooses whether GreebleFS launches through Auto selection, X11 fallback, or native Wayland. Auto will switch to X11 on NVIDIA Wayland sessions when XWayland is available.
                        </p>
                      </div>
                      <select
                        aria-label="Linux Display Backend"
                        value={settings.system.linuxDisplayBackendPreference}
                        disabled={linuxDisplayBackendSyncPending}
                        onChange={event => void setLinuxDisplayBackendPreference(
                          event.target.value as LinuxDisplayBackendPreference,
                        )}
                        className="min-w-[140px] rounded border bg-transparent px-2 py-1 text-[11px]"
                        style={settingsSelectStyle}
                      >
                        <option value="auto">Auto</option>
                        <option
                          value="x11"
                          disabled={linuxDisplayBackendStatus != null && !availableLinuxDisplayBackends.includes('x11')}
                        >
                          X11
                        </option>
                        <option
                          value="wayland"
                          disabled={linuxDisplayBackendStatus != null && !availableLinuxDisplayBackends.includes('wayland')}
                        >
                          Wayland
                        </option>
                      </select>
                    </label>
                  )}
                  <div className="rounded border px-3 py-3 text-[11px]" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Telemetry Session</div>
                        <p className="mt-1 opacity-40">
                          {telemetryStatusPending
                            ? 'Refreshing telemetry session status...'
                            : telemetryStatusError
                              ? `Telemetry unavailable: ${telemetryStatusError}`
                              : telemetryStatus == null
                                ? 'No telemetry session has been created yet.'
                                : `Enabled ${telemetryStatus.config.developer_telemetry_enabled || telemetryStatus.config.consumer_diagnostics_enabled ? 'yes' : 'no'} · records ${telemetryStatus.recent_record_count} · session ${telemetryStatus.session_id} · file ${telemetryStatus.current_file_path ?? 'not started'}`}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void refreshTelemetryStatus()}
                          className="rounded border px-3 py-2 transition-colors"
                          style={{ borderColor: border }}
                        >
                          Refresh
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleTelemetryExport()}
                          disabled={telemetryActionPending != null}
                          className="rounded border px-3 py-2 transition-colors disabled:opacity-50"
                          style={{ borderColor: border }}
                        >
                          {telemetryActionPending === 'export' ? 'Exporting...' : 'Export Support Bundle'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleTelemetryClear()}
                          disabled={telemetryActionPending != null}
                          className="rounded border px-3 py-2 transition-colors disabled:opacity-50"
                          style={{ borderColor: border, color: '#fca5a5' }}
                        >
                          {telemetryActionPending === 'clear' ? 'Clearing...' : 'Clear Sessions'}
                        </button>
                      </div>
                    </div>
                    {telemetryNotice ? (
                      <div className="mt-3 rounded border px-3 py-2" style={{ borderColor: border, color: text }}>
                        {telemetryNotice}
                      </div>
                    ) : null}
                  </div>
                  <div className="rounded border px-3 py-2 text-[11px]" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)', color: startupSyncError ? '#fda4af' : muted }}>
                    {startupSyncPending
                      ? 'Updating OS startup registration...'
                      : startupSyncError
                        ? `Startup registration failed: ${startupSyncError}`
                        : `Current status: startup ${settings.system.launchAtStartup ? 'enabled' : 'disabled'} · tray ${systemPresentationState.trayVisible ? 'enabled' : 'disabled'} · ${platform === 'macos' ? 'Dock' : 'taskbar'} ${systemPresentationState.taskbarVisible ? 'enabled' : 'disabled'} · recovery path ${systemPresentationState.recoveryPath === 'tray' ? (platform === 'macos' ? 'Dock' : 'tray') : platform === 'macos' ? 'Dock' : 'taskbar'} · developer mode ${settings.system.developerMode ? 'enabled' : 'disabled'} · deep telemetry ${settings.system.developerTelemetryEnabled ? 'enabled' : 'disabled'} · source trace ${settings.system.sourceTraceModeEnabled ? 'enabled' : 'disabled'} · consumer diagnostics ${settings.system.consumerDiagnosticsEnabled ? 'enabled' : 'disabled'}${platform === 'linux' && linuxDisplayBackendStatusSummary ? ` · ${linuxDisplayBackendStatusSummary}` : ''}`}
                  </div>
                </div>
              </section>
            )}

            {activeSection === 'explorer' && (
              <section className="rounded border p-4" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
                <SectionTitle
                  icon={<FolderOpen size={12} />}
                  title="Explorer"
                  subtitle="Startup path, folder activation, visibility rules, and bookmark quality-of-life."
                />

                <div className="mt-4 space-y-3">
                  <div className="rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">File Clicking</div>
                        <p className="mt-1 text-[11px] opacity-40">
                          Choose how folders activate in the browser. Files still preview on single click and open on double click.
                        </p>
                      </div>
                      <span className="rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text }}>
                        {settings.explorer.folderClickMode === 'single' ? 'Single Click' : 'Double Click'}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                      {([
                        {
                          value: 'single',
                          label: 'Single Click',
                          description: 'Open folders on the first plain click, closer to a content-browser flow.',
                        },
                        {
                          value: 'double',
                          label: 'Double Click',
                          description: 'Keep folders selection-first and require a second click to enter them.',
                        },
                      ] as const).map(option => {
                        const active = settings.explorer.folderClickMode === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => updateExplorer({ folderClickMode: option.value })}
                            className="rounded px-3 py-3 text-left transition-colors"
                            style={{
                              border: `1px solid ${active ? accent : border}`,
                              background: active ? `${accent}14` : 'rgba(255,255,255,0.03)',
                              color: text,
                            }}
                          >
                            <div className="text-[11px] font-semibold">{option.label}</div>
                            <p className="mt-1 text-[11px] opacity-45">{option.description}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Content Layout</div>
                        <p className="mt-1 text-[11px] opacity-40">
                          Match the explorer to a UE-style content browser. Ctrl/Cmd + wheel in the explorer steps through these modes without shrinking the whole UI.
                        </p>
                      </div>
                      <span className="rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text }}>
                        {getExplorerViewModeDefinition(settings.explorer.viewMode).label}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                      {explorerViewModes.map(option => {
                        const active = settings.explorer.viewMode === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => updateExplorer({ viewMode: option.id })}
                            className="rounded px-3 py-3 text-left transition-colors"
                            style={{
                              border: `1px solid ${active ? accent : border}`,
                              background: active ? `${accent}14` : 'rgba(255,255,255,0.03)',
                              color: text,
                            }}
                          >
                            <div className="text-[11px] font-semibold">{option.label}</div>
                            <p className="mt-1 text-[11px] opacity-45">{option.description}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Thumbnail Rendering</div>
                        <p className="mt-1 text-[11px] opacity-40">
                          Generated thumbnails replace file icons with native previews for images, 3D models, code, shaders, audio waveforms, and video posters. Video hover-scrub uses a cached frame montage instead of live playback.
                        </p>
                      </div>
                      <span className="rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text }}>
                        {settings.explorer.thumbnails.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                      <label className="flex items-center justify-between rounded border px-3 py-2 text-[11px]" style={{ borderColor: border }}>
                        <span>Enable Generated Thumbnails</span>
                        <input
                          type="checkbox"
                          checked={settings.explorer.thumbnails.enabled}
                          onChange={event => updateExplorer({
                            thumbnails: {
                              ...settings.explorer.thumbnails,
                              enabled: event.target.checked,
                            },
                          })}
                        />
                      </label>
                      <label className="flex items-center justify-between rounded border px-3 py-2 text-[11px]" style={{ borderColor: border, opacity: settings.explorer.thumbnails.enabled ? 1 : 0.55 }}>
                        <span>Video Hover Scrub</span>
                        <input
                          type="checkbox"
                          checked={settings.explorer.thumbnails.enableVideoHoverScrub}
                          disabled={!settings.explorer.thumbnails.enabled || !settings.explorer.thumbnails.includeVideo}
                          onChange={event => updateExplorer({
                            thumbnails: {
                              ...settings.explorer.thumbnails,
                              enableVideoHoverScrub: event.target.checked,
                            },
                          })}
                        />
                      </label>
                      <label className="flex items-center justify-between rounded border px-3 py-2 text-[11px]" style={{ borderColor: border, opacity: settings.explorer.thumbnails.enabled ? 1 : 0.55 }}>
                        <span>Image Files</span>
                        <input
                          type="checkbox"
                          checked={settings.explorer.thumbnails.includeImages}
                          disabled={!settings.explorer.thumbnails.enabled}
                          onChange={event => updateExplorer({
                            thumbnails: {
                              ...settings.explorer.thumbnails,
                              includeImages: event.target.checked,
                            },
                          })}
                        />
                      </label>
                      <label className="flex items-center justify-between rounded border px-3 py-2 text-[11px]" style={{ borderColor: border, opacity: settings.explorer.thumbnails.enabled ? 1 : 0.55 }}>
                        <span>3D Models</span>
                        <input
                          type="checkbox"
                          checked={settings.explorer.thumbnails.includeModels}
                          disabled={!settings.explorer.thumbnails.enabled}
                          onChange={event => updateExplorer({
                            thumbnails: {
                              ...settings.explorer.thumbnails,
                              includeModels: event.target.checked,
                            },
                          })}
                        />
                      </label>
                      <label className="flex items-center justify-between rounded border px-3 py-2 text-[11px]" style={{ borderColor: border, opacity: settings.explorer.thumbnails.enabled ? 1 : 0.55 }}>
                        <span>Code Files</span>
                        <input
                          type="checkbox"
                          checked={settings.explorer.thumbnails.includeCode}
                          disabled={!settings.explorer.thumbnails.enabled}
                          onChange={event => updateExplorer({
                            thumbnails: {
                              ...settings.explorer.thumbnails,
                              includeCode: event.target.checked,
                            },
                          })}
                        />
                      </label>
                      <label className="flex items-center justify-between rounded border px-3 py-2 text-[11px]" style={{ borderColor: border, opacity: settings.explorer.thumbnails.enabled ? 1 : 0.55 }}>
                        <span>Shader Files</span>
                        <input
                          type="checkbox"
                          checked={settings.explorer.thumbnails.includeShaders}
                          disabled={!settings.explorer.thumbnails.enabled}
                          onChange={event => updateExplorer({
                            thumbnails: {
                              ...settings.explorer.thumbnails,
                              includeShaders: event.target.checked,
                            },
                          })}
                        />
                      </label>
                      <label className="flex items-center justify-between rounded border px-3 py-2 text-[11px]" style={{ borderColor: border, opacity: settings.explorer.thumbnails.enabled ? 1 : 0.55 }}>
                        <span>Audio Waveforms</span>
                        <input
                          type="checkbox"
                          checked={settings.explorer.thumbnails.includeAudio}
                          disabled={!settings.explorer.thumbnails.enabled}
                          onChange={event => updateExplorer({
                            thumbnails: {
                              ...settings.explorer.thumbnails,
                              includeAudio: event.target.checked,
                            },
                          })}
                        />
                      </label>
                      <label className="flex items-center justify-between rounded border px-3 py-2 text-[11px]" style={{ borderColor: border, opacity: settings.explorer.thumbnails.enabled ? 1 : 0.55 }}>
                        <span>Video Posters</span>
                        <input
                          type="checkbox"
                          checked={settings.explorer.thumbnails.includeVideo}
                          disabled={!settings.explorer.thumbnails.enabled}
                          onChange={event => updateExplorer({
                            thumbnails: {
                              ...settings.explorer.thumbnails,
                              includeVideo: event.target.checked,
                            },
                          })}
                        />
                      </label>
                    </div>

                    <div className="mt-3 rounded border px-3 py-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)', opacity: settings.explorer.thumbnails.enabled && settings.explorer.thumbnails.enableVideoHoverScrub && settings.explorer.thumbnails.includeVideo ? 1 : 0.55 }}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Hover Montage Frames</div>
                          <p className="mt-1 text-[11px] opacity-40">
                            Cached frame count for each video hover-scrub sequence.
                          </p>
                        </div>
                        <span className="rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text }}>
                          {settings.explorer.thumbnails.videoHoverScrubFrameCount} frames
                        </span>
                      </div>
                      <input
                        className="mt-3 w-full"
                        type="range"
                        min={1}
                        max={10}
                        step={1}
                        value={settings.explorer.thumbnails.videoHoverScrubFrameCount}
                        disabled={!settings.explorer.thumbnails.enabled || !settings.explorer.thumbnails.enableVideoHoverScrub || !settings.explorer.thumbnails.includeVideo}
                        onChange={event => updateExplorer({
                          thumbnails: {
                            ...settings.explorer.thumbnails,
                            videoHoverScrubFrameCount: clampVideoHoverScrubFrameCount(Number(event.target.value)),
                          },
                        })}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">Startup Path</label>
                    <input
                      value={settings.explorer.defaultPath}
                      onChange={event => updateExplorer({ defaultPath: event.target.value })}
                      className="w-full rounded border px-3 py-2 text-[11px] outline-none"
                      style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text, fontFamily: appearance.fonts.mono }}
                    />
                    <p className="text-[11px] opacity-40">Use `.` to prefer the detected home directory for the current machine.</p>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <label className="flex items-center justify-between rounded border px-3 py-2 text-[11px]" style={{ borderColor: border }}>
                      <span>Show Hidden Files</span>
                      <input
                        type="checkbox"
                        checked={settings.explorer.showHiddenFiles}
                        onChange={event => updateExplorer({ showHiddenFiles: event.target.checked })}
                      />
                    </label>
                    <label className="flex items-center justify-between rounded border px-3 py-2 text-[11px]" style={{ borderColor: border }}>
                      <div className="pr-4">
                        <div>Double-Click Empty Space to Go Up/Back</div>
                        <p className="mt-1 text-[10px] opacity-45">
                          Navigates to the parent directory when double-clicking on empty space in the file area.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.explorer.doubleClickEmptyToGoBack}
                        onChange={event => updateExplorer({ doubleClickEmptyToGoBack: event.target.checked })}
                      />
                    </label>
                    <label className="flex items-center justify-between rounded border px-3 py-2 text-[11px]" style={{ borderColor: border }}>
                      <span>Confirm Delete</span>
                      <input
                        type="checkbox"
                        checked={settings.explorer.confirmDelete}
                        onChange={event => updateExplorer({ confirmDelete: event.target.checked })}
                      />
                    </label>
                  </div>

                  <div className="rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Context Menu Composer</div>
                        <p className="mt-1 text-[11px] opacity-40">
                          Every explorer menu item now resolves through a typed catalog. Built-ins and plugin items share the same ordering and visibility controls.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={resetContextMenuLayout}
                        className="rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
                        style={{ border: `1px solid ${border}`, background: 'rgba(255,255,255,0.04)', color: text }}
                      >
                        Normalize Order
                      </button>
                    </div>

                    <div className="mt-3 space-y-2">
                      {contextMenuCatalog.map((item, index) => {
                        const enabled = isExplorerContextMenuItemEnabled(item.id, settings.explorer.contextMenuItemOverrides);
                        const isFirst = index === 0;
                        const isLast = index === contextMenuCatalog.length - 1;
                        const sourceLabel = item.source === 'built-in'
                          ? 'Built-in'
                          : `Plugin · ${item.pluginName}`;
                        const contextLabel = item.contexts.join(' + ');
                        const executionLabel = item.execution.kind === 'plugin-backend'
                          ? `Backend · ${item.execution.entry}`
                          : item.execution.kind === 'terminal-template'
                            ? 'Terminal Template'
                            : item.execution.kind === 'panel-request'
                              ? `Panel Request · ${item.execution.panelId}`
                              : 'Host Action';

                        return (
                          <div
                            key={item.id}
                            className="rounded border px-3 py-3"
                            style={{ borderColor: enabled ? border : `${border}99`, background: enabled ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.015)', opacity: enabled ? 1 : 0.78 }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-[11px] font-semibold">{item.title}</div>
                                <div className="mt-1 flex flex-wrap gap-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] opacity-60">
                                  <ThemeBadge label={sourceLabel} />
                                  <ThemeBadge label={contextLabel} />
                                  <ThemeBadge label={executionLabel} />
                                </div>
                                {item.description && (
                                  <p className="mt-2 text-[11px] opacity-45">{item.description}</p>
                                )}
                              </div>
                              <label className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">
                                <span>Enabled</span>
                                <input
                                  type="checkbox"
                                  checked={enabled}
                                  onChange={event => toggleContextMenuItemEnabled(item.id, event.target.checked)}
                                />
                              </label>
                            </div>

                            <div className="mt-3 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => moveContextMenuItem(item.id, 'up')}
                                disabled={isFirst}
                                className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                                style={{ border: `1px solid ${border}`, background: 'rgba(255,255,255,0.04)', color: isFirst ? muted : text, opacity: isFirst ? 0.5 : 1 }}
                              >
                                <ArrowUp size={11} />
                                Up
                              </button>
                              <button
                                type="button"
                                onClick={() => moveContextMenuItem(item.id, 'down')}
                                disabled={isLast}
                                className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                                style={{ border: `1px solid ${border}`, background: 'rgba(255,255,255,0.04)', color: isLast ? muted : text, opacity: isLast ? 0.5 : 1 }}
                              >
                                <ArrowDown size={11} />
                                Down
                              </button>
                              <span className="text-[10px] opacity-45">
                                Slot {(index + 1).toString().padStart(2, '0')}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    onClick={() => void seedDefaultBookmarks()}
                    className="w-full rounded px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
                    style={{ background: `${accent}18`, color: text, border: `1px solid ${accent}55` }}
                  >
                    Seed Platform Bookmarks
                  </button>
                </div>
              </section>
            )}

            {activeSection === 'home' && (
              <section className="rounded border p-4" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
                <SectionTitle
                  icon={<Home size={12} />}
                  title="Home"
                  subtitle="Dedicated explorer landing surface with pack selection, preset routing, telemetry, and managed authoring."
                />

                <div className="mt-4 space-y-3">
                  <div className="rounded border p-3" style={{ borderColor: `${accent}44`, background: `${accent}0d` }}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="max-w-[760px]">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: muted }}>Explorer Home Runtime</div>
                        <p className="mt-2 text-[12px] leading-5" style={{ color: muted }}>
                          Home is no longer the OS home directory. It is now an app-owned explorer surface at <code>greeblefs://home</code> with pack switching, preset state, and local usage telemetry that feeds most-used and recent folder lanes.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.12em]">
                        <span className="rounded border px-2 py-1" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text }}>
                          {activeHomePack?.name ?? 'No Pack'}
                        </span>
                        <span className="rounded border px-2 py-1" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text }}>
                          {settings.home.usageTrackingEnabled ? 'Usage Tracking On' : 'Usage Tracking Off'}
                        </span>
                        <span className="rounded border px-2 py-1" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text }}>
                          {homePacks.length} Pack{homePacks.length === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => void onRefreshHomePacks()}
                      className="rounded px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
                      style={{ border: `1px solid ${border}`, background: 'rgba(255,255,255,0.04)', color: text }}
                    >
                      Refresh Home Packs
                    </button>
                    <button
                      type="button"
                      onClick={() => void onOpenHomePacksFolder()}
                      className="rounded px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
                      style={{ border: `1px solid ${accent}55`, background: `${accent}16`, color: text }}
                    >
                      Open Home Packs Folder
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleResetHomeUsage()}
                      className="rounded px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
                      style={{ border: `1px solid ${border}`, background: 'rgba(255,255,255,0.04)', color: text }}
                    >
                      Reset Usage Snapshot
                    </button>
                  </div>

                  <div className="rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Managed Root</div>
                        <p className="mt-1 text-[11px] opacity-40">
                          Drop authored Home packs into <code>{homePacksDirectory}</code>. Runtime discovery follows the same managed-content flow as themes and other shell assets.
                        </p>
                      </div>
                      <span className="rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text }}>
                        {homePacksLoading ? 'Scanning' : 'Ready'}
                      </span>
                    </div>
                    <div className="mt-3 rounded border px-3 py-2 text-[10px]" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.12)', color: muted, fontFamily: appearance.fonts.mono }}>
                      {homePacksDirectory}
                    </div>
                    {homePacksError ? (
                      <div className="mt-3 rounded border px-3 py-2 text-[11px]" style={{ borderColor: '#7f1d1d', background: 'rgba(127,29,29,0.18)', color: '#fecaca' }}>
                        {homePacksError}
                      </div>
                    ) : null}
                    {[...new Set([...homePacksWarnings, ...homeSelection.warnings])].length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {[...new Set([...homePacksWarnings, ...homeSelection.warnings])].map((warning) => (
                          <div
                            key={warning}
                            className="rounded border px-3 py-2 text-[11px]"
                            style={{ borderColor: 'rgba(245,158,11,0.28)', background: 'rgba(120,53,15,0.18)', color: '#fde68a' }}
                          >
                            {warning}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.35fr_0.65fr]">
                    <div className="rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Home Pack</div>
                          <p className="mt-1 text-[11px] opacity-40">
                            App themes can suggest a Home pack, but the Home selection persists independently.
                          </p>
                        </div>
                        <span className="rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text }}>
                          Theme Suggestion · {appearance.baseTheme.defaultHomePackId ?? 'None'}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                        {homePacks.map((pack) => {
                          const active = activeHomePack?.id === pack.id;
                          return (
                            <button
                              key={pack.id}
                              type="button"
                              onClick={() => updateHome({ activePackId: pack.id })}
                              className="rounded px-3 py-3 text-left transition-colors"
                              style={{
                                border: `1px solid ${active ? accent : border}`,
                                background: active ? `${accent}14` : 'rgba(255,255,255,0.03)',
                                color: text,
                              }}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-[11px] font-semibold">{pack.name}</div>
                                  <div className="mt-1 text-[10px] uppercase tracking-[0.12em] opacity-50">
                                    {pack.sourceKind === 'built-in' ? 'Built-In' : 'Home Folder'}
                                  </div>
                                </div>
                                {pack.warnings.length > 0 ? (
                                  <ThemeBadge label={`${pack.warnings.length} warn`} />
                                ) : null}
                              </div>
                              <p className="mt-2 text-[11px] opacity-45">{pack.description ?? 'No description provided.'}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Usage Telemetry</div>
                      <p className="mt-1 text-[11px] opacity-40">
                        Successful local folder navigations feed the Home most-used and recent lanes. Cloud and virtual paths are ignored.
                      </p>

                      <label className="mt-3 flex items-center justify-between rounded border px-3 py-2 text-[11px]" style={{ borderColor: border }}>
                        <span>Enable local Home usage tracking</span>
                        <input
                          type="checkbox"
                          checked={settings.home.usageTrackingEnabled}
                          onChange={(event) => updateHome({ usageTrackingEnabled: event.target.checked })}
                        />
                      </label>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                        <div className="rounded border px-3 py-2" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
                          <div className="opacity-50">Most Used</div>
                          <div className="mt-1 font-semibold">{homeMostUsedFolders.length}</div>
                        </div>
                        <div className="rounded border px-3 py-2" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
                          <div className="opacity-50">Recent</div>
                          <div className="mt-1 font-semibold">{homeRecentFolders.length}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {activeHomePack?.runtime.presets.length ? (
                    <div className="rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Preset</div>
                          <p className="mt-1 text-[11px] opacity-40">
                            Presets let a single pack ship multiple home layouts without changing the active pack itself.
                          </p>
                        </div>
                        <span className="rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text }}>
                          {activeHomePresetId ?? 'Default'}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                        {activeHomePack.runtime.presets.map((preset) => {
                          const active = activeHomePresetId === preset.id;
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => setHomePresetSelection(activeHomePack.id, preset.id)}
                              className="rounded px-3 py-3 text-left transition-colors"
                              style={{
                                border: `1px solid ${active ? accent : border}`,
                                background: active ? `${accent}14` : 'rgba(255,255,255,0.03)',
                                color: text,
                              }}
                            >
                              <div className="text-[11px] font-semibold">{preset.name}</div>
                              <p className="mt-1 text-[11px] opacity-45">{preset.description ?? `${preset.modules.length} host modules`}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <div className="rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Telemetry Preview</div>
                      <div className="mt-3 space-y-2">
                        {homeMostUsedFolders.slice(0, 4).map((entry) => (
                          <div key={`most-used-${entry.path}`} className="rounded border px-3 py-2 text-[11px]" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
                            <div className="font-semibold">{entry.label}</div>
                            <div className="mt-1 opacity-45">{entry.path}</div>
                          </div>
                        ))}
                        {homeMostUsedFolders.length === 0 ? (
                          <div className="rounded border px-3 py-3 text-[11px] opacity-45" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
                            No usage data yet. Navigate through local folders from Explorer Home or normal directory views to fill this in.
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Active Pack Settings</div>
                      <div className="mt-3">
                        {ActiveHomePackSettingsComponent && activeHomePack && homePackSettingsHost ? (
                          <ActiveHomePackSettingsComponent
                            pack={activeHomePack.runtime}
                            host={homePackSettingsHost}
                          />
                        ) : (
                          <div className="rounded border px-3 py-3 text-[11px] opacity-45" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
                            The active Home pack does not expose custom settings yet.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {activeSection === 'cloud' && (
              <section className="rounded border p-4" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
                <SectionTitle
                  icon={<HardDrive size={12} />}
                  title="Cloud Accounts"
                  subtitle="Browser-based OAuth for Google Drive and Dropbox, with one drive rail entry per connected account."
                />

                <div className="mt-4 space-y-4">
                  <div className="rounded border p-3" style={{ borderColor: `${accent}44`, background: `${accent}0d` }}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="max-w-[720px]">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: muted }}>Cloud Drive Integration</div>
                        <p className="mt-1 text-[11px] leading-5" style={{ color: muted }}>
                          Connected accounts appear in the explorer `Drives` rail as first-class locations. Tokens stay in the OS keychain; only lightweight account metadata is kept in app storage.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.12em]">
                        <span className="rounded border px-2 py-1" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text }}>
                          {connectedCloudAccountCount} Connected
                        </span>
                        <span className="rounded border px-2 py-1" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text }}>
                          {configuredCloudProviderCount}/2 Providers Ready
                        </span>
                      </div>
                    </div>
                    {cloudNotice ? (
                      <div className="mt-3 rounded border px-3 py-2 text-[11px]" style={{ borderColor: `${accent}55`, background: `${accent}10`, color: text }}>
                        {cloudNotice}
                      </div>
                    ) : null}
                    {cloudError ? (
                      <div className="mt-3 rounded border px-3 py-2 text-[11px]" style={{ borderColor: 'rgba(248,113,113,0.4)', background: 'rgba(248,113,113,0.12)', color: '#fecaca' }}>
                        {cloudError}
                      </div>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                    {CLOUD_PROVIDER_IDS.map(providerId => {
                      const provider = safeCloudSnapshot.providers.find(item => item.provider === providerId) ?? {
                        provider: providerId,
                        configured: false,
                        missing_configuration: ['client ID'],
                        configuration_source: 'none' as const,
                        client_id: null,
                        client_secret_present: false,
                      };
                      const providerAccounts = safeCloudSnapshot.accounts.filter(account => account.provider === providerId);
                      const providerLabel = getCloudProviderLabel(providerId);
                      const providerBusy = cloudAuthProvider === providerId;
                      const providerCredentialBusy = cloudCredentialBusyProvider === providerId;
                      const providerDraft = cloudCredentialDrafts[providerId];
                      const providerActionDisabled = providerBusy || providerCredentialBusy;

                      return (
                        <div key={providerId} className="rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="max-w-[520px]">
                              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">{providerLabel}</div>
                              <p className="mt-1 text-[11px] opacity-40">
                                {provider.configured
                                  ? 'Use the system browser to connect one or more accounts. Each connected account becomes its own explorer drive.'
                                  : 'Save a client ID here to enable browser login without external environment variables.'}
                              </p>
                            </div>
                            <button
                              type="button"
                              disabled={!provider.configured || providerActionDisabled}
                              onClick={() => void connectCloudProvider(providerId)}
                              className="rounded px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                              style={{
                                border: `1px solid ${provider.configured ? `${accent}55` : border}`,
                                background: provider.configured ? `${accent}18` : 'rgba(255,255,255,0.04)',
                                color: provider.configured ? text : muted,
                                opacity: providerActionDisabled ? 0.7 : 1,
                              }}
                            >
                              {providerBusy ? 'Waiting...' : providerAccounts.length > 0 ? 'Connect Another' : 'Connect Account'}
                            </button>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.12em]">
                            <span className="rounded border px-2 py-1" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: provider.configured ? text : '#fda4af' }}>
                              {provider.configured ? 'Configured' : 'Needs Credentials'}
                            </span>
                            <span className="rounded border px-2 py-1" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text }}>
                              {getCloudProviderConfigurationSourceLabel(provider.configuration_source)}
                            </span>
                            <span className="rounded border px-2 py-1" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text }}>
                              {provider.client_secret_present ? 'Secret Stored' : 'No Secret'}
                            </span>
                            <span className="rounded border px-2 py-1" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text }}>
                              {providerAccounts.length} account{providerAccounts.length === 1 ? '' : 's'}
                            </span>
                          </div>

                          {!provider.configured && provider.missing_configuration.length > 0 ? (
                            <div className="mt-3 rounded border px-3 py-2 text-[11px]" style={{ borderColor: 'rgba(248,113,113,0.28)', background: 'rgba(248,113,113,0.08)', color: '#fecaca' }}>
                              Missing: {provider.missing_configuration.join(', ')}
                            </div>
                          ) : null}

                          <div className="mt-4 space-y-3 rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.02)' }}>
                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">
                                  {providerLabel} Client ID
                                </label>
                                <input
                                  aria-label={`${providerLabel} client ID`}
                                  value={providerDraft.clientId}
                                  onChange={event => updateCloudCredentialDraft(providerId, 'clientId', event.target.value)}
                                  placeholder={providerId === 'google-drive' ? 'Google OAuth client ID' : 'Dropbox app key / client ID'}
                                  className="w-full rounded border px-3 py-2 text-[11px] outline-none"
                                  style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text, fontFamily: appearance.fonts.mono }}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">
                                  {providerLabel} Client Secret
                                </label>
                                <input
                                  aria-label={`${providerLabel} client secret`}
                                  type="password"
                                  value={providerDraft.clientSecret}
                                  onChange={event => updateCloudCredentialDraft(providerId, 'clientSecret', event.target.value)}
                                  placeholder={provider.client_secret_present ? 'Stored in keychain. Type to replace or leave blank.' : 'Optional, depending on provider app setup'}
                                  className="w-full rounded border px-3 py-2 text-[11px] outline-none"
                                  style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text, fontFamily: appearance.fonts.mono }}
                                />
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={providerActionDisabled || providerDraft.clientId.trim().length === 0}
                                onClick={() => void saveCloudProviderCredentials(providerId)}
                                className="rounded px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                                style={{
                                  border: `1px solid ${accent}55`,
                                  background: `${accent}18`,
                                  color: text,
                                  opacity: providerActionDisabled ? 0.7 : 1,
                                }}
                              >
                                {providerCredentialBusy && cloudCredentialBusyAction === 'save' ? 'Saving...' : 'Save Credentials'}
                              </button>
                              <button
                                type="button"
                                disabled={providerActionDisabled || provider.configuration_source !== 'settings'}
                                onClick={() => void clearSavedCloudProviderCredentials(providerId)}
                                className="rounded px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                                style={{ border: `1px solid ${border}`, background: 'rgba(255,255,255,0.04)', color: muted, opacity: providerActionDisabled ? 0.7 : 1 }}
                              >
                                {providerCredentialBusy && cloudCredentialBusyAction === 'clear' ? 'Clearing...' : 'Clear Saved'}
                              </button>
                            </div>

                            <div className="space-y-1 text-[11px] opacity-45" style={{ color: muted }}>
                              {providerId === 'google-drive' ? (
                                <p>
                                  Use a Google Cloud OAuth desktop client. This flow uses the system browser, PKCE, and a localhost callback.
                                </p>
                              ) : (
                                <p>
                                  Register <span style={{ fontFamily: appearance.fonts.mono }}>{DROPBOX_CALLBACK_URI}</span> in the Dropbox App Console. The callback URI is fixed so it can be whitelisted.
                                </p>
                              )}
                              <p>Client secrets stay in the OS keychain when provided. Leave the secret blank if your client type does not require one.</p>
                            </div>
                          </div>

                          <div className="mt-3 space-y-2">
                            {providerAccounts.length === 0 ? (
                              <div className="rounded border px-3 py-3 text-[11px] opacity-45" style={{ borderColor: border, background: 'rgba(255,255,255,0.02)', color: muted }}>
                                {cloudLoading ? 'Loading account state...' : `No ${providerLabel} accounts connected yet.`}
                              </div>
                            ) : providerAccounts.map(account => (
                              <div key={account.id} className="rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <div className="text-[11px] font-semibold" style={{ color: text }}>
                                      {account.display_name}
                                    </div>
                                    <div className="mt-1 text-[11px] opacity-45" style={{ color: muted }}>
                                      {account.email}
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.12em]">
                                      <span className="rounded border px-2 py-1" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: account.status === 'connected' ? text : '#fda4af' }}>
                                        {account.status}
                                      </span>
                                      <span className="rounded border px-2 py-1" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text }}>
                                        {account.drive_label}
                                      </span>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => void disconnectProviderAccount(account)}
                                    className="rounded px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                                    style={{ border: `1px solid ${border}`, background: 'rgba(255,255,255,0.04)', color: muted }}
                                  >
                                    Disconnect
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => void refreshCloudAccounts()}
                    className="inline-flex items-center gap-2 rounded px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                    style={{ background: 'rgba(255,255,255,0.04)', color: text, border: `1px solid ${border}` }}
                  >
                    <RefreshCw size={11} />
                    Refresh Cloud Status
                  </button>
                </div>
              </section>
            )}

            {activeSection === 'audio' && (
              <div className="mx-auto max-w-4xl space-y-6 pt-2 pb-6">
                <SectionTitle
                  icon={<Music size={14} />}
                  title="Audio Integration"
                  subtitle={activeSectionMeta.detail}
                />
                <OverviewCard
                  title="VST3 Discovery Paths"
                  subtitle="Platform standard fallback scans are automatic. Add arbitrary extra paths here."
                  badges={[]}
                >
                  <div className="space-y-2">
                    {settings.audio.vst3AdditionalFolders.map((folder, i) => (
                      <div key={folder} className="flex items-center gap-2 rounded border px-3 py-2 text-[11px]" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
                        <div className="flex-1 truncate opacity-80">{folder}</div>
                        <button
                          type="button"
                          className="shrink-0 p-1 font-semibold uppercase tracking-[0.14em]"
                          style={{ color: '#ef4444' }}
                          onClick={() => {
                            const clone = [...settings.audio.vst3AdditionalFolders];
                            clone.splice(i, 1);
                            updateAudio({ vst3AdditionalFolders: clone });
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    {settings.audio.vst3AdditionalFolders.length === 0 && (
                      <div className="py-2 text-[11px] font-style-italic opacity-40">No additional scan paths configured. Default OS paths will still be scanned.</div>
                    )}
                    <div className="pt-2">
                      <button
                        type="button"
                        className="rounded border px-4 py-2 text-[10px] uppercase font-semibold tracking-[0.1em] transition-opacity hover:opacity-80"
                        style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)' }}
                        onClick={async () => {
                          const { open } = await import('@tauri-apps/plugin-fs').catch(() => ({ open: null as any }));
                          if (open) {
                            const picked = await open({ directory: true, multiple: true }) as string[] | null;
                            if (picked && picked.length > 0) {
                              const newFolders = [...settings.audio.vst3AdditionalFolders];
                              picked.forEach(p => { if (!newFolders.includes(p)) newFolders.push(p); });
                              updateAudio({ vst3AdditionalFolders: newFolders });
                            }
                          }
                        }}
                      >
                        Add Folder…
                      </button>
                    </div>
                  </div>
                </OverviewCard>
              </div>
            )}

            {activeSection === 'screenshots' && (
              <section className="rounded border p-4" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
                <SectionTitle
                  icon={<Camera size={12} />}
                  title="Screenshots"
                  subtitle="Default capture behavior, save path, and proof-session polish for the built-in screenshot workflow."
                />

                <div className="mt-4 space-y-4">
                  <div className="rounded border p-3" style={{ borderColor: `${accent}44`, background: `${accent}0d` }}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="max-w-[720px]">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: muted }}>Proof Capture Defaults</div>
                        <p className="mt-1 text-[11px] leading-5" style={{ color: muted }}>
                          The Screenshots panel now follows these defaults directly. Pick whether a fresh capture opens as an area snip or a full-screen proof pass, choose the primary output action, and decide whether the tool clears back to the library after a save.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.12em]">
                        <span className="rounded border px-2 py-1" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text }}>
                          {settings.screenshots.defaultCaptureMode === 'monitor' ? 'Full Monitor Default' : 'Area Snip Default'}
                        </span>
                        <span className="rounded border px-2 py-1" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text }}>
                          {formatScreenshotOutputActionLabel(settings.screenshots.defaultOutputAction)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Save Directory</div>
                        <p className="mt-1 text-[11px] opacity-40">
                          Every saved or annotated capture lands here. The Settings overview and the Screenshots panel both read from this same path.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void openWorkspaceDirectory('Screenshots', settings.screenshots.saveDirectory || screenshotFeatureConfig.defaultSaveDirectory)}
                          className="rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                          style={{ border: `1px solid ${accent}55`, background: `${accent}16`, color: text }}
                        >
                          Open Save Folder
                        </button>
                        <button
                          type="button"
                          onClick={() => updateScreenshots({ saveDirectory: screenshotFeatureConfig.defaultSaveDirectory })}
                          className="rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                          style={{ border: `1px solid ${border}`, background: 'rgba(255,255,255,0.04)', color: text }}
                        >
                          Reset Directory
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 space-y-1.5">
                      <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">Folder Path</label>
                      <input
                        value={settings.screenshots.saveDirectory}
                        onChange={event => updateScreenshots({ saveDirectory: event.target.value })}
                        className="w-full rounded border px-3 py-2 text-[11px] outline-none"
                        style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text, fontFamily: appearance.fonts.mono }}
                      />
                      <p className="text-[11px] opacity-40">OverlayTerm creates the folder on demand before the first saved capture.</p>
                    </div>
                  </div>

                  <div className="rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Default Capture Mode</div>
                      <p className="mt-1 text-[11px] opacity-40">
                        This sets how a fresh monitor preview behaves before the operator does anything else in the screenshot tool.
                      </p>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                      {screenshotFeatureConfig.captureModes.map(mode => {
                        const active = settings.screenshots.defaultCaptureMode === mode.id;
                        return (
                          <button
                            key={mode.id}
                            type="button"
                            onClick={() => updateScreenshots({ defaultCaptureMode: mode.id })}
                            className="rounded px-3 py-3 text-left transition-colors"
                            style={{
                              border: `1px solid ${active ? accent : border}`,
                              background: active ? `${accent}14` : 'rgba(255,255,255,0.03)',
                              color: text,
                            }}
                          >
                            <div className="text-[11px] font-semibold">{mode.label}</div>
                            <p className="mt-1 text-[11px] opacity-45">{mode.description}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Default Output Action</div>
                      <p className="mt-1 text-[11px] opacity-40">
                        The screenshot toolbar promotes this action first for both region captures and full-monitor proof runs.
                      </p>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
                      {screenshotFeatureConfig.outputActions.map(action => {
                        const active = settings.screenshots.defaultOutputAction === action.id;
                        return (
                          <button
                            key={action.id}
                            type="button"
                            onClick={() => updateScreenshots({ defaultOutputAction: action.id })}
                            className="rounded px-3 py-3 text-left transition-colors"
                            style={{
                              border: `1px solid ${active ? accent : border}`,
                              background: active ? `${accent}14` : 'rgba(255,255,255,0.03)',
                              color: text,
                            }}
                          >
                            <div className="text-[11px] font-semibold">{formatScreenshotOutputActionLabel(action.id)}</div>
                            <p className="mt-1 text-[11px] opacity-45">{action.description}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <label className="flex items-center justify-between rounded border px-3 py-2 text-[11px]" style={{ borderColor: border }}>
                      <span>Show composition grid over the capture preview</span>
                      <input
                        type="checkbox"
                        aria-label="Show composition grid"
                        checked={settings.screenshots.showGrid}
                        onChange={event => updateScreenshots({ showGrid: event.target.checked })}
                      />
                    </label>
                    <label className="flex items-center justify-between rounded border px-3 py-2 text-[11px]" style={{ borderColor: border }}>
                      <span>Jump back to the library after save actions</span>
                      <input
                        type="checkbox"
                        aria-label="Jump back to the library after save actions"
                        checked={settings.screenshots.closeEditorAfterAction}
                        onChange={event => updateScreenshots({ closeEditorAfterAction: event.target.checked })}
                      />
                    </label>
                  </div>
                </div>
              </section>
            )}

            {activeSection === 'theme-json' && (
              <section className="rounded border p-4" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
                <SectionTitle
                  icon={<Palette size={12} />}
                  title="Theme JSON"
                  subtitle="Paste, tweak, or version your custom theme directly."
                />

                <div className="mt-4 space-y-2">
                  <textarea
                    value={themeDraft}
                    onChange={event => {
                      setThemeDraft(event.target.value);
                      if (themeImportError) {
                        setThemeImportError(null);
                      }
                    }}
                    className="min-h-[280px] w-full rounded border px-3 py-3 text-[11px] outline-none"
                    style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text, fontFamily: appearance.fonts.mono }}
                  />
                  {themeImportError ? (
                    <div
                      className="rounded border px-3 py-2 text-[11px]"
                      style={{
                        borderColor: 'rgba(248,113,113,0.3)',
                        background: 'rgba(127,29,29,0.28)',
                        color: '#fca5a5',
                      }}
                    >
                      {themeImportError}
                    </div>
                  ) : null}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setThemeDraft(serializeTheme(editableTheme));
                        setThemeImportError(null);
                      }}
                      className="rounded px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
                      style={{ background: 'rgba(255,255,255,0.06)', color: text, border: `1px solid ${border}` }}
                    >
                      Reset Draft
                    </button>
                    <button
                      onClick={applyThemeDraft}
                      className="rounded px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
                      style={{ background: `${accent}20`, color: text, border: `1px solid ${accent}` }}
                    >
                      Import / Apply
                    </button>
                  </div>
                </div>
              </section>
            )}
          </div>
        </OverlayScrollArea>
      </main>
    </div>
  );
}
