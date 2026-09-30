import { Palette } from '@/components/AppIcons';
import {
  getThemeSourceLabel,
  type OverlayThemeDefinition,
  type ResolvedOverlayAppearance,
} from '../../../config/appearance';
import type { LoadedOverlayThemePackage } from '../../../config/themePackages';
import { OverlayToggle } from '../../OverlayToggle';
import { ThemeCatalogGrid, getActiveThemeCatalogPackage, renderThemeCatalogPackageBadges } from '../ThemeCatalog';
import {
  SettingsCompactSection,
  SettingsControlRow,
  SettingsInlineNotice,
  SettingsInspectorPanel,
  SettingsKeyValueRow,
  SettingsMetricStrip,
  SettingsSectionScaffold,
  ThemeBadge,
} from '../SettingsPrimitives';

export function AppearanceDockSettingsSection({
  appearance,
  themePackageLookup,
  themePackagesCount,
  appAppearanceName,
  dockAppearanceName,
  activeDockThemeId,
  dockThemeMode,
  accent,
  onApplyDockThemeSelection,
  onUpdateAppearance,
  onOpenDockSettings,
}: {
  appearance: ResolvedOverlayAppearance;
  themePackageLookup: Map<string, LoadedOverlayThemePackage>;
  themePackagesCount: number;
  appAppearanceName: string;
  dockAppearanceName: string;
  activeDockThemeId: string | null;
  dockThemeMode: 'follow-app' | 'override';
  accent: string;
  onApplyDockThemeSelection: (themeId: string) => void;
  onUpdateAppearance: (patch: {
    dockThemeMode?: 'follow-app' | 'override';
    activeDockThemeId?: string | null;
  }) => void;
  onOpenDockSettings?: () => void;
}) {
  const isOverride = dockThemeMode === 'override';
  const { activeTheme: activeDockTheme, activeThemePackage: activeDockPackage } =
    getActiveThemeCatalogPackage(activeDockThemeId, appearance.themes, themePackageLookup);
  const dockSourceLabel = activeDockTheme
    ? getThemeSourceLabel(activeDockTheme)
    : 'Follows app';
  const dockReadyCount = appearance.themes.filter(
    theme => theme.dock?.workbench || theme.dock?.explorer,
  ).length;

  return (
    <SettingsSectionScaffold
      sectionKey="appearance-dock"
      className="space-y-2.5"
      icon={<Palette size={12} />}
      title="Dock Appearance"
      subtitle={isOverride ? `Override · ${dockAppearanceName}` : `Follows ${appAppearanceName}`}
    >
      <div
        className="grid min-w-0 grid-cols-1 gap-2.5 2xl:grid-cols-[minmax(0,1fr)_minmax(17.5rem,21rem)]"
        data-appearance-dock-layout="dock-theme-catalog"
      >
        <div className="min-w-0 space-y-2.5">
          <SettingsCompactSection
            title="Dock Theme Override"
            subtitle="Give the dock its own theme without touching the application shell. Off = dock follows the app theme plus any dock recipe overlays."
          >
            <div className="min-w-0 space-y-1.5 p-2">
              <SettingsMetricStrip
                items={[
                  { id: 'mode', label: 'Mode', value: isOverride ? 'Override' : 'Follow app', tone: isOverride ? 'accent' : 'default' },
                  { id: 'dock-theme', label: 'Dock theme', value: isOverride ? (activeDockTheme?.name ?? 'Missing') : appAppearanceName, tone: isOverride ? 'accent' : 'default' },
                  { id: 'dock-ready', label: 'Dock-ready', value: dockReadyCount },
                ]}
              />
              <SettingsControlRow
                label="Override dock theme"
                detail={isOverride ? 'Dock uses its own theme' : 'Dock follows the app theme'}
                control={(
                  <OverlayToggle
                    size="compact"
                    aria-label="Override dock theme"
                    checked={isOverride}
                    onChange={event => {
                      const nextOverride = event.target.checked;
                      if (nextOverride) {
                        // Pin current app theme as the starting override so the
                        // switch never flashes to a missing-theme fallback.
                        const fallbackId = activeDockThemeId ?? appearance.app.baseTheme.id ?? appearance.baseTheme.id;
                        onUpdateAppearance({ dockThemeMode: 'override', activeDockThemeId: fallbackId });
                      } else {
                        onUpdateAppearance({ dockThemeMode: 'follow-app' });
                      }
                    }}
                  />
                )}
              />
              {!isOverride ? (
                <SettingsInlineNotice tone="info">
                  Dock follows {appAppearanceName}. Theme dock recipe overlays (`theme.dock.workbench` / `theme.dock.explorer`) still apply on top — that&apos;s where UE5-style compact chrome lives.
                </SettingsInlineNotice>
              ) : null}
              {isOverride && !activeDockTheme ? (
                <SettingsInlineNotice tone="warning">
                  The pinned dock theme is missing. Pick another dock theme below — the shell holds the last good dock theme until you do.
                </SettingsInlineNotice>
              ) : null}
            </div>
          </SettingsCompactSection>

          {isOverride ? (
            <div className="min-w-0 space-y-1.5">
              <label className="text-[10px] font-semibold uppercase opacity-50">Dock Theme Suite</label>
              <ThemeCatalogGrid
                themes={appearance.themes}
                activeThemeId={activeDockThemeId}
                onSelect={onApplyDockThemeSelection}
                themePackageLookup={themePackageLookup}
                density="compact"
              />
            </div>
          ) : (
            <SettingsInlineNotice tone="info">
              Enable the override to pick a dedicated dock theme from the {themePackagesCount} installed bundles.
            </SettingsInlineNotice>
          )}
        </div>

        <div className="min-w-0 space-y-3">
          <SettingsInspectorPanel
            title="Dock Theme Inspector"
            subtitle={isOverride ? (activeDockPackage?.description ?? activeDockTheme?.description ?? 'Dock override routing') : 'Dock follows the app theme'}
            badges={[
              isOverride ? (activeDockTheme?.name ?? 'Missing theme') : `Follows ${appAppearanceName}`,
              dockSourceLabel,
            ]}
            accent={accent}
          >
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {isOverride ? renderThemeCatalogPackageBadges(activeDockTheme, activeDockPackage) : null}
                <ThemeBadge label={`App ${appAppearanceName}`} />
                <ThemeBadge label={`Dock ${dockAppearanceName}`} active={isOverride} />
              </div>
              <SettingsCompactSection title="Routing">
                <SettingsKeyValueRow label="App Theme" value={appAppearanceName} />
                <SettingsKeyValueRow
                  label="Dock Theme"
                  value={isOverride ? (activeDockTheme?.name ?? 'Missing — pick below') : `${appAppearanceName} (follow)`}
                />
                <SettingsKeyValueRow label="Recipe overlays" value={dockReadyCount > 0 ? `${dockReadyCount} themes ship dock chrome` : 'No dock overlays installed'} />
              </SettingsCompactSection>
              <SettingsCompactSection title="What makes a dock theme UE5-grade">
                <div className="space-y-1 p-2 text-[11px] leading-4 opacity-60">
                  <p>1. Tight `theme.dock.workbench` chrome (short top bar, dense rails) so the content grid owns the pixels.</p>
                  <p>2. `theme.dock.explorer` toolbar + grid density tuned for a 400–500px tall strip.</p>
                  <p>3. A dock layout (`kind: dock`) with bottom-edge placement and inline preview — see Dock Mode settings.</p>
                </div>
                {onOpenDockSettings ? (
                  <div className="p-2 pt-0">
                    <button
                      type="button"
                      onClick={onOpenDockSettings}
                      className="rounded border px-2.5 py-1.5 text-[10px] font-semibold"
                      style={{ borderColor: `${accent}66`, color: accent }}
                    >
                      Open Dock Mode settings
                    </button>
                  </div>
                ) : null}
              </SettingsCompactSection>
            </div>
          </SettingsInspectorPanel>
        </div>
      </div>
    </SettingsSectionScaffold>
  );
}

export type AppearanceDockThemeSelection = Pick<
  OverlayThemeDefinition,
  'id' | 'name'
>;
