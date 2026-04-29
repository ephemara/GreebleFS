import { useMemo, type ReactNode } from 'react';
import { LayoutGrid, Sparkles } from '@/components/AppIcons';
import type { OverlayThemeDefinition } from '../../config/appearance';
import type { LoadedOverlayThemePackage } from '../../config/themePackages';
import type { InteractionMotionBinding } from '../../animation/interactionMotion';
import { ThemeBadge } from './SettingsPrimitives';
import { getThemeSourceLabel } from '../../config/appearance';

type ThemeCatalogSectionId = 'official-pilot' | 'built-in' | 'legacy-archive';
type ThemeCatalogDensity = 'comfortable' | 'compact';

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
  switch (sourceKind) {
    case 'plugin-package':
      return 'Plugin Package';
    case 'vscode-theme-directory':
      return 'VS Code Folder';
    case 'vscode-theme-vsix':
      return 'VS Code VSIX';
    default:
      return 'Theme Folder';
  }
}

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

function getThemeCatalogEntryKey(
  theme: OverlayThemeDefinition,
  packageInfo: LoadedOverlayThemePackage | undefined,
  index: number,
): string {
  const sourceKind = packageInfo?.sourceKind ?? theme.source ?? 'built-in';
  const sourceLabel = packageInfo?.sourceLabel ?? packageInfo?.directoryPath ?? 'catalog';
  return `${theme.id}:${sourceKind}:${sourceLabel}:${index}`;
}

function ThemeCatalogCard({
  themeOption,
  packageInfo,
  active,
  sectionId,
  density,
  onSelect,
  motionBinding,
}: {
  themeOption: OverlayThemeDefinition;
  packageInfo: LoadedOverlayThemePackage | undefined;
  active: boolean;
  sectionId: ThemeCatalogSectionId;
  density: ThemeCatalogDensity;
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
  ].filter((value): value is string => Boolean(value));
  const visibleCapabilityLabels = capabilityLabels.slice(0, density === 'compact' ? 4 : 10);
  const visibleTags = (packageInfo?.tags ?? []).slice(0, density === 'compact' ? 1 : 3);
  const previewMinHeight = density === 'compact'
    ? (sectionId === 'official-pilot' ? '6.5rem' : '5rem')
    : (sectionId === 'official-pilot' ? '11rem' : '6.75rem');

  return (
    <button
      type="button"
      data-settings-catalog-card={themeOption.name}
      data-theme-catalog-theme-id={themeOption.id}
      onClick={() => onSelect(themeOption.id)}
      className="min-w-0 overflow-hidden rounded text-left transition-opacity hover:opacity-100"
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
          minHeight: previewMinHeight,
          backgroundImage: previewBackground,
          backgroundSize: packageInfo?.previewUrl ? 'cover' : '100% 100%',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1">
            <ThemeBadge label={getThemeSourceLabel(themeOption)} active={active} />
            {packageInfo ? <ThemeBadge label={getThemePackageSourceBadgeLabel(packageInfo.sourceKind)} active={active} /> : null}
            <ThemeBadge label={getThemeCatalogBadgeLabel(sectionId, packageInfo)} active={active} />
          </div>
          {packageInfo && density !== 'compact' ? (
            <div className="flex min-w-0 shrink items-center justify-end gap-1">
              {packageInfo.warnings.length ? <ThemeBadge label={`Warnings ${packageInfo.warnings.length}`} /> : null}
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
          {active ? <span className="text-[9px] font-semibold uppercase tracking-[0.12em] opacity-75">Live</span> : null}
        </div>
      </div>
      <div className={density === 'compact' ? 'space-y-2 px-2.5 py-2' : sectionId === 'legacy-archive' ? 'space-y-2 px-3 py-2.5' : 'space-y-2 px-3 py-3'}>
        <div className="flex min-w-0 items-center gap-1.5 text-[9px] uppercase tracking-[0.12em] opacity-55">
          <span className="truncate">{themeOption.id}</span>
          {packageInfo?.sourceLabel && density !== 'compact' ? (
            <>
              <span aria-hidden="true">•</span>
              <span className="truncate">{packageInfo.sourceLabel}</span>
            </>
          ) : null}
          {packageInfo?.homepage && density !== 'compact' ? <span className="truncate">• {packageInfo.homepage.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span> : null}
        </div>
        {description ? (
          <p className={density === 'compact' ? 'max-h-12 overflow-hidden break-words text-[11px] leading-4 opacity-70' : sectionId === 'official-pilot' ? 'min-h-[3rem] break-words text-[11px] leading-4 opacity-75' : 'min-h-[2.5rem] break-words text-[11px] leading-4 opacity-70'}>
            {description}
          </p>
        ) : (
          <p className={density === 'compact' ? 'text-[11px] leading-4 opacity-35' : 'min-h-[2.5rem] text-[11px] leading-4 opacity-35'}>No package summary provided yet.</p>
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
          {visibleCapabilityLabels.map(label => (
            <ThemeBadge key={`${themeOption.id}-${label}`} label={label} />
          ))}
          {visibleTags.map(tag => (
            <ThemeBadge key={`${themeOption.id}-tag-${tag}`} label={tag} />
          ))}
        </div>
        {packageInfo?.warnings.length && density !== 'compact' ? (
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
  density,
}: {
  sectionId: ThemeCatalogSectionId;
  themes: OverlayThemeDefinition[];
  activeThemeId: string | null;
  onSelect: (themeId: string) => void;
  themePackageLookup: Map<string, LoadedOverlayThemePackage>;
  createThemeCardMotion?: (active: boolean) => InteractionMotionBinding;
  density: ThemeCatalogDensity;
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
      className={density === 'compact' ? 'rounded border p-2.5' : 'rounded border p-3'}
      style={sectionStyle}
    >
      <div className={density === 'compact' ? 'mb-2.5 flex flex-wrap items-start justify-between gap-2' : 'mb-3 flex flex-wrap items-start justify-between gap-3'}>
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] opacity-65">
            {isOfficialSuite ? <Sparkles size={11} /> : <LayoutGrid size={11} />}
            <span>{getThemeCatalogSectionTitle(sectionId)}</span>
          </div>
          <p className={density === 'compact' ? 'mt-1 max-w-prose text-[11px] leading-4 opacity-48' : 'mt-1 text-[11px] leading-4 opacity-48'}>
            {getThemeCatalogSectionSubtitle(sectionId)}
          </p>
        </div>
        <ThemeBadge label={`${themes.length} theme${themes.length === 1 ? '' : 's'}`} active={isOfficialSuite} />
      </div>
      <div className={density === 'compact' ? 'grid grid-cols-1 gap-2 md:grid-cols-2 2xl:grid-cols-3' : isOfficialSuite ? 'grid grid-cols-1 gap-4 xl:grid-cols-2' : 'grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3'}>
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
              density={density}
              onSelect={onSelect}
              motionBinding={createThemeCardMotion?.(active)}
            />
          );
        })}
      </div>
    </section>
  );
}

export function ThemeCatalogGrid({
  themes,
  activeThemeId,
  onSelect,
  themePackageLookup,
  createThemeCardMotion,
  density = 'comfortable',
}: {
  themes: OverlayThemeDefinition[];
  activeThemeId: string | null;
  onSelect: (themeId: string) => void;
  themePackageLookup: Map<string, LoadedOverlayThemePackage>;
  createThemeCardMotion?: (active: boolean) => InteractionMotionBinding;
  density?: ThemeCatalogDensity;
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
    <div className={density === 'compact' ? 'space-y-3' : 'space-y-4'} data-settings-catalog-grid="theme-catalog" data-theme-catalog-density={density}>
      {catalogSections.map(section => (
        <ThemeCatalogSection
          key={section.sectionId}
          sectionId={section.sectionId}
          themes={section.themes}
          activeThemeId={activeThemeId}
          onSelect={onSelect}
          themePackageLookup={themePackageLookup}
          createThemeCardMotion={createThemeCardMotion}
          density={density}
        />
      ))}
    </div>
  );
}

export function getActiveThemeCatalogPackage(
  activeThemeId: string | null,
  themes: OverlayThemeDefinition[],
  themePackageLookup: Map<string, LoadedOverlayThemePackage>,
): {
  activeTheme: OverlayThemeDefinition | null;
  activeThemePackage: LoadedOverlayThemePackage | null;
  resolvedSectionId: ThemeCatalogSectionId;
} {
  const activeTheme = themes.find(theme => theme.id === activeThemeId) ?? null;
  const activeThemePackage = activeTheme ? (themePackageLookup.get(activeTheme.id) ?? null) : null;

  return {
    activeTheme,
    activeThemePackage,
    resolvedSectionId: activeTheme ? resolveThemeCatalogSectionId(activeTheme, activeThemePackage ?? undefined) : 'built-in',
  };
}

export function renderThemeCatalogPackageBadges(
  activeTheme: OverlayThemeDefinition | null,
  activeThemePackage: LoadedOverlayThemePackage | null,
): ReactNode {
  if (!activeTheme) {
    return null;
  }

  return (
    <>
      <ThemeBadge label={getThemeSourceLabel(activeTheme)} active />
      {activeThemePackage ? <ThemeBadge label={getThemePackageSourceBadgeLabel(activeThemePackage.sourceKind)} /> : null}
      {activeThemePackage?.catalog.badgeLabel ? <ThemeBadge label={activeThemePackage.catalog.badgeLabel} /> : null}
    </>
  );
}
