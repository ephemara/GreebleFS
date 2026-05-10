import { FolderOpen, Palette, RefreshCw } from '@/components/AppIcons';
import {
  ensureFontFamilyLoaded,
  getThemeSourceLabel,
  overlayFontCatalog,
  type OverlayThemeDefinition,
  type ResolvedOverlayAppearance,
} from '../../../config/appearance';
import {
  mergeOverlayColorInputValue,
  normalizeOverlayColorInputValue,
} from '../../../config/colorUtils';
import type { LoadedOverlayThemePackage } from '../../../config/themePackages';
import { clampOverlayVisualControlValue, formatOverlayVisualControlValue, overlayVisualControls } from '../../../config/overlayWindow';
import type { InteractionMotionBinding } from '../../../animation/interactionMotion';
import { OverlayToggle } from '../../OverlayToggle';
import { ThemeCatalogGrid, getActiveThemeCatalogPackage, renderThemeCatalogPackageBadges } from '../ThemeCatalog';
import {
  RangeField,
  SettingsCompactActionButton,
  SettingsCompactSection,
  SettingsControlRow,
  SettingsIconActionButton,
  SettingsInlineNotice,
  SettingsKeyValueRow,
  SettingsMetricStrip,
  SettingsInspectorPanel,
  SettingsSectionScaffold,
  SettingsSelect,
  ThemeBadge,
} from '../SettingsPrimitives';

function ColorToken({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const colorInputValue = normalizeOverlayColorInputValue(value);

  return (
    <label className="flex flex-col gap-1 rounded border p-2" style={{ borderColor: 'var(--overlay-workbench-settings-card-border)', background: 'var(--overlay-workbench-settings-card-bg)' }}>
      <span className="text-[9px] font-semibold uppercase tracking-wide opacity-50">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={colorInputValue}
          onChange={event => onChange(mergeOverlayColorInputValue(event.target.value, value))}
          className="h-7 w-9 rounded border-0 bg-transparent p-0"
        />
        <input
          value={value}
          onChange={event => onChange(event.target.value)}
          className="w-full bg-transparent text-[10px] outline-none"
        />
      </div>
    </label>
  );
}

export function AppearanceSettingsSection({
  appearance,
  themePackageLookup,
  themePackagesDirectory,
  themePackagesCount,
  themePackagesLoading,
  themePackagesError,
  themePackagesWarnings,
  editableTheme,
  appAppearanceName,
  dockAppearanceName,
  activeThemeId,
  activeDockThemeId,
  dockThemeMode,
  uiFontFamily,
  appOpacity,
  panelTransparency,
  appBlurStrength,
  appZoom,
  appBlur,
  border,
  accent,
  text,
  muted,
  onOpenThemesFolder,
  onRefreshThemes,
  onApplyThemeSelection,
  onApplyDockThemeSelection,
  onUpdateAppearance,
  onUpdateThemePalette,
  createThemeCardMotion,
}: {
  appearance: ResolvedOverlayAppearance;
  themePackageLookup: Map<string, LoadedOverlayThemePackage>;
  themePackagesDirectory: string;
  themePackagesCount: number;
  themePackagesLoading: boolean;
  themePackagesError: string | null;
  themePackagesWarnings: string[];
  editableTheme: OverlayThemeDefinition;
  appAppearanceName: string;
  dockAppearanceName: string;
  activeThemeId: string | null;
  activeDockThemeId: string | null;
  dockThemeMode: 'follow-app' | 'override';
  uiFontFamily: string;
  appOpacity: number;
  panelTransparency: number;
  appBlurStrength: number;
  appZoom: number;
  appBlur: boolean;
  border: string;
  accent: string;
  text: string;
  muted: string;
  onOpenThemesFolder: () => Promise<void> | void;
  onRefreshThemes: () => Promise<void> | void;
  onApplyThemeSelection: (themeId: string) => void;
  onApplyDockThemeSelection: (themeId: string) => void;
  onUpdateAppearance: (patch: {
    dockThemeMode?: 'follow-app' | 'override';
    uiFontFamily?: string;
    appOpacity?: number;
    panelTransparency?: number;
    appBlurStrength?: number;
    appZoom?: number;
    appBlur?: boolean;
  }) => void;
  onUpdateThemePalette: (patch: Partial<OverlayThemeDefinition['palette']>) => void;
  createThemeCardMotion?: (active: boolean) => InteractionMotionBinding;
}) {
  const { activeTheme, activeThemePackage } = getActiveThemeCatalogPackage(
    activeThemeId,
    appearance.themes,
    themePackageLookup,
  );
  const activeThemeSourceLabel = getThemeSourceLabel(editableTheme);
  const activeFont = overlayFontCatalog.find(font => font.family === uiFontFamily);
  const fontOptions = activeFont
    ? overlayFontCatalog
    : [{ id: 'current-font', name: 'Current Font', family: uiFontFamily }, ...overlayFontCatalog];
  void muted;
  void border;
  void text;

  return (
    <SettingsSectionScaffold
      sectionKey="appearance"
      className="space-y-2.5"
      icon={<Palette size={12} />}
      title="Appearance"
      subtitle={`${themePackagesCount} bundles · ${appAppearanceName}`}
    >
      <div
        className="grid min-w-0 grid-cols-1 gap-2.5 2xl:grid-cols-[minmax(0,1fr)_minmax(17.5rem,21rem)]"
        data-appearance-layout="compact-theme-catalog"
      >
        <div className="min-w-0 space-y-2.5">
          <SettingsCompactSection
            title="Themes"
            subtitle={themePackagesDirectory}
            actions={(
              <>
                <SettingsIconActionButton
                  onClick={() => void onOpenThemesFolder()}
                  aria-label="Open themes folder"
                  title="Open themes folder"
                >
                  <FolderOpen size={12} />
                </SettingsIconActionButton>
                <SettingsCompactActionButton
                  onClick={() => void onRefreshThemes()}
                  accent={accent}
                  aria-label="Refresh themes"
                  title="Refresh themes"
                >
                  <RefreshCw size={10} />
                  Refresh
                </SettingsCompactActionButton>
              </>
            )}
          >
            <div className="min-w-0 space-y-1.5 p-2">
              <SettingsMetricStrip
                items={[
                  {
                    id: 'bundles',
                    label: 'Bundles',
                    value: themePackagesLoading ? 'Scanning' : themePackagesCount,
                    tone: themePackagesLoading ? 'accent' : 'default',
                  },
                  {
                    id: 'source',
                    label: 'Source',
                    value: activeThemeSourceLabel,
                  },
                  {
                    id: 'active',
                    label: 'Active',
                    value: activeTheme?.name ?? editableTheme.name,
                    tone: 'accent',
                  },
                ]}
              />
              {themePackagesError ? (
                <SettingsInlineNotice tone="danger">
                  Theme scan failed: {themePackagesError}
                </SettingsInlineNotice>
              ) : null}

              {themePackagesWarnings.map(warning => (
                <SettingsInlineNotice key={warning} tone="warning">
                  {warning}
                </SettingsInlineNotice>
              ))}
            </div>
          </SettingsCompactSection>

          <div className="min-w-0 space-y-1.5">
            <label className="text-[10px] font-semibold uppercase opacity-50">Theme Suite</label>
            <ThemeCatalogGrid
              themes={appearance.themes}
              activeThemeId={activeThemeId}
              onSelect={onApplyThemeSelection}
              themePackageLookup={themePackageLookup}
              createThemeCardMotion={createThemeCardMotion}
              density="compact"
            />
          </div>

          {dockThemeMode === 'override' ? (
            <div className="min-w-0 space-y-1.5">
              <label className="text-[10px] font-semibold uppercase opacity-50">Dock Suite</label>
              <ThemeCatalogGrid
                themes={appearance.themes}
                activeThemeId={activeDockThemeId}
                onSelect={onApplyDockThemeSelection}
                themePackageLookup={themePackageLookup}
                createThemeCardMotion={createThemeCardMotion}
                density="compact"
              />
            </div>
          ) : null}
        </div>

        <div className="min-w-0 space-y-3">
          <SettingsInspectorPanel
            title="Theme Inspector"
            subtitle={activeThemePackage?.description ?? activeTheme?.description ?? 'Theme routing'}
            badges={[
              activeTheme?.name ?? editableTheme.name,
              dockThemeMode === 'override' ? 'Dock override' : 'Dock follows app',
            ]}
            accent={accent}
          >
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {renderThemeCatalogPackageBadges(activeTheme, activeThemePackage)}
                <ThemeBadge label={`App ${appAppearanceName}`} />
                <ThemeBadge label={`Dock ${dockAppearanceName}`} />
              </div>

              <SettingsCompactSection title="Routing">
                <SettingsControlRow
                  label="Dock Mode"
                  detail={dockThemeMode === 'override' ? 'Pinned theme' : 'App theme'}
                  control={(
                    <SettingsSelect
                      value={dockThemeMode}
                      onChange={event => onUpdateAppearance({ dockThemeMode: event.target.value as 'follow-app' | 'override' })}
                      aria-label="Dock theme mode"
                    >
                      <option value="follow-app">Follow App</option>
                      <option value="override">Override Theme</option>
                    </SettingsSelect>
                  )}
                />
                <SettingsKeyValueRow label="App Theme" value={appAppearanceName} />
                <SettingsKeyValueRow label="Dock Theme" value={dockAppearanceName} />
                {dockThemeMode === 'follow-app' ? (
                  <SettingsInlineNotice tone="info">
                    Dock follows {appAppearanceName}
                  </SettingsInlineNotice>
                ) : null}
              </SettingsCompactSection>

              <SettingsCompactSection title="Typography">
                <SettingsControlRow
                  label="UI Font"
                  detail={activeFont?.name ?? 'Current'}
                  control={(
                    <SettingsSelect
                      value={uiFontFamily}
                      onChange={event => {
                        void ensureFontFamilyLoaded(event.target.value);
                        onUpdateAppearance({ uiFontFamily: event.target.value });
                      }}
                      aria-label="UI font"
                      style={{ fontFamily: uiFontFamily }}
                    >
                      {fontOptions.map(font => (
                        <option key={font.id} value={font.family} style={{ fontFamily: font.family }}>
                          {font.name}
                        </option>
                      ))}
                    </SettingsSelect>
                  )}
                />
                <SettingsKeyValueRow label="Family" value={uiFontFamily} />
              </SettingsCompactSection>

              <SettingsCompactSection title="Palette">
                <div className="grid min-w-0 grid-cols-1 gap-2 p-2 sm:grid-cols-2 2xl:grid-cols-1">
                  <ColorToken label="Accent" value={editableTheme.palette.accent} onChange={value => onUpdateThemePalette({ accent: value, accentSoft: `${value}22` })} />
                  <ColorToken label="App Background" value={editableTheme.palette.appBackground} onChange={value => onUpdateThemePalette({ appBackground: value, shellBackgroundSolid: value })} />
                  <ColorToken label="Panel" value={editableTheme.palette.panelBackground} onChange={value => onUpdateThemePalette({ panelBackground: value, sidebarBackground: value })} />
                  <ColorToken label="Text" value={editableTheme.palette.textPrimary} onChange={value => onUpdateThemePalette({ textPrimary: value })} />
                </div>
              </SettingsCompactSection>
            </div>
          </SettingsInspectorPanel>

          <SettingsInspectorPanel
            title="Surface Controls"
            subtitle="Opacity, blur, zoom"
            accent={accent}
            tone="muted"
          >
            <div className="min-w-0 space-y-2.5">
              <RangeField
                label="Window Opacity"
                description="How translucent the overlay surface should feel."
                min={overlayVisualControls.opacity.min}
                max={overlayVisualControls.opacity.max}
                step={overlayVisualControls.opacity.step}
                value={appOpacity}
                valueLabel={formatOverlayVisualControlValue('opacity', appOpacity)}
                onChange={value => onUpdateAppearance({ appOpacity: clampOverlayVisualControlValue('opacity', value) })}
                density="compact"
              />
              <RangeField
                label="Panel Transparency"
                description="Fade panel chrome away while keeping the actual panel content readable."
                min={overlayVisualControls.panelTransparency.min}
                max={overlayVisualControls.panelTransparency.max}
                step={overlayVisualControls.panelTransparency.step}
                value={panelTransparency}
                valueLabel={formatOverlayVisualControlValue('panelTransparency', panelTransparency)}
                onChange={value => onUpdateAppearance({ panelTransparency: clampOverlayVisualControlValue('panelTransparency', value) })}
                density="compact"
              />
              <RangeField
                label="Blur Strength"
                description="Scale the glass softness separately from overall opacity so fully opaque shells can still feel frosted."
                min={overlayVisualControls.blurStrength.min}
                max={overlayVisualControls.blurStrength.max}
                step={overlayVisualControls.blurStrength.step}
                value={appBlurStrength}
                valueLabel={formatOverlayVisualControlValue('blurStrength', appBlurStrength)}
                onChange={value => onUpdateAppearance({ appBlurStrength: clampOverlayVisualControlValue('blurStrength', value) })}
                density="compact"
              />
              <RangeField
                label="Window Zoom"
                description="Scale the full overlay shell without changing monitor placement."
                min={overlayVisualControls.zoom.min}
                max={overlayVisualControls.zoom.max}
                step={overlayVisualControls.zoom.step}
                value={appZoom}
                valueLabel={formatOverlayVisualControlValue('zoom', appZoom)}
                onChange={value => onUpdateAppearance({ appZoom: clampOverlayVisualControlValue('zoom', value) })}
                density="compact"
              />
              <SettingsCompactSection title="Native">
                <SettingsControlRow
                  label="Native Glass Blur"
                  control={appBlur ? 'On' : 'Off'}
                  action={(
                    <OverlayToggle
                      size="compact"
                      aria-label="Native Glass Blur"
                      checked={appBlur}
                      onChange={event => onUpdateAppearance({ appBlur: event.target.checked })}
                    />
                  )}
                />
              </SettingsCompactSection>
            </div>
          </SettingsInspectorPanel>
        </div>
      </div>
    </SettingsSectionScaffold>
  );
}
