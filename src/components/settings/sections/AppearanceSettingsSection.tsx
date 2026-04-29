import { Palette, RefreshCw } from '@/components/AppIcons';
import {
  ensureFontFamilyLoaded,
  getThemeSourceLabel,
  overlayFontCatalog,
  type OverlayThemeDefinition,
  type ResolvedOverlayAppearance,
} from '../../../config/appearance';
import type { LoadedOverlayThemePackage } from '../../../config/themePackages';
import { clampOverlayVisualControlValue, formatOverlayVisualControlValue, overlayVisualControls } from '../../../config/overlayWindow';
import type { InteractionMotionBinding } from '../../../animation/interactionMotion';
import { ThemeCatalogGrid, getActiveThemeCatalogPackage, renderThemeCatalogPackageBadges } from '../ThemeCatalog';
import {
  RangeField,
  SettingsActionStrip,
  SettingsCatalogCard,
  SettingsInspectorPanel,
  SettingsRow,
  SettingsSectionBlock,
  SettingsSectionHeader,
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
  void muted;

  return (
    <section className="min-w-0 space-y-3" data-settings-section="appearance">
      <SettingsSectionHeader
        icon={<Palette size={12} />}
        title="Appearance"
        subtitle="Theme recipes, UI fonts, and direct palette editing."
      />

      <div
        className="grid min-w-0 grid-cols-1 gap-3 2xl:grid-cols-[minmax(0,1fr)_minmax(17.5rem,21rem)]"
        data-appearance-layout="compact-theme-catalog"
      >
        <div className="min-w-0 space-y-3">
          <SettingsSectionBlock
            title="Theme Bundles"
            subtitle={(
              <>
                Drop native bundles, VS Code color-theme folders, or <code>.vsix</code> archives into <code>{themePackagesDirectory}</code>.
              </>
            )}
            actions={(
              <SettingsActionStrip>
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
              </SettingsActionStrip>
            )}
            tone="muted"
            contentClassName="space-y-3"
          >
            <div className="flex flex-wrap items-center gap-2 text-[10px]">
              <ThemeBadge label={themePackagesLoading ? 'Scanning Bundles' : `${themePackagesCount} Bundles Loaded`} active />
              <ThemeBadge label={`Active Source ${getThemeSourceLabel(editableTheme)}`} />
            </div>

            <p className="text-[11px] leading-4 opacity-40">
              Official pilot bundles surface first, built-ins stay supported, and compatibility imports stay clearly labeled so cached .vsix extracts never masquerade as authored bundles.
            </p>

            {themePackagesError ? (
              <div className="rounded border px-3 py-2 text-[11px]" style={{ borderColor: '#7f1d1d', background: 'rgba(127,29,29,0.18)', color: '#fecaca' }}>
                Theme package scan failed: {themePackagesError}
              </div>
            ) : null}

            {themePackagesWarnings.length > 0 ? (
              <div className="rounded border px-3 py-3 text-[11px]" style={{ borderColor: '#854d0e', background: 'rgba(133,77,14,0.18)', color: '#fde68a' }}>
                <div className="font-semibold uppercase tracking-[0.12em]">Package warnings</div>
                <div className="mt-2 space-y-1.5">
                  {themePackagesWarnings.map(warning => (
                    <div key={warning}>{warning}</div>
                  ))}
                </div>
              </div>
            ) : null}
          </SettingsSectionBlock>

          <div className="min-w-0 space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">Curated Theme Suite</label>
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
              <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">Curated Dock Theme Suite</label>
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
            subtitle={activeThemePackage?.description ?? activeTheme?.description ?? 'Choose an active theme bundle and adjust how the dock follows it.'}
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

              <SettingsSectionBlock
                title="Dock Theme Mode"
                subtitle="Keep dock mode on the application theme, or pin dock mode to a separate theme while still honoring dock-specific recipe overrides."
                tone="muted"
              >
                <div className="grid min-w-0 grid-cols-1 gap-2">
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
                  ].map(option => (
                    <SettingsCatalogCard
                      key={option.value}
                      title={option.label}
                      description={option.description}
                      active={dockThemeMode === option.value}
                      accent={accent}
                      onClick={() => onUpdateAppearance({ dockThemeMode: option.value as 'follow-app' | 'override' })}
                    />
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px]">
                  <ThemeBadge label={`Dock Source ${dockThemeMode === 'override' ? 'Override Theme' : 'Application Theme'}`} active />
                  <ThemeBadge label={`Current Dock Theme ${dockAppearanceName}`} />
                </div>

                {dockThemeMode === 'follow-app' ? (
                  <div className="mt-3 rounded border px-3 py-2 text-[11px]" style={{ borderColor: `${accent}33`, background: `${accent}10`, color: text }}>
                    Dock mode is following <strong>{appAppearanceName}</strong>. Dock-specific recipes declared by that theme resolve automatically.
                  </div>
                ) : null}
              </SettingsSectionBlock>

              <SettingsSectionBlock
                title="Typography"
                subtitle="Choose the UI font family for shell chrome and settings surfaces."
                tone="muted"
              >
                <div className="grid min-w-0 grid-cols-1 gap-2">
                  {overlayFontCatalog.map(font => {
                    const active = uiFontFamily === font.family;
                    return (
                      <SettingsCatalogCard
                        key={font.id}
                        title={font.name}
                        subtitle={active ? 'Active UI Font' : 'UI Font'}
                        description={font.family}
                        active={active}
                        accent={accent}
                        onClick={() => {
                          void ensureFontFamilyLoaded(font.family);
                          onUpdateAppearance({ uiFontFamily: font.family });
                        }}
                        style={{
                          fontFamily: font.family,
                        }}
                      />
                    );
                  })}
                </div>
              </SettingsSectionBlock>

              <SettingsSectionBlock
                title="Palette Tokens"
                subtitle="Directly tune the editable theme bundle palette."
                tone="muted"
              >
                <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 2xl:grid-cols-1">
                  <ColorToken label="Accent" value={editableTheme.palette.accent} onChange={value => onUpdateThemePalette({ accent: value, accentSoft: `${value}22` })} />
                  <ColorToken label="App Background" value={editableTheme.palette.appBackground} onChange={value => onUpdateThemePalette({ appBackground: value, shellBackgroundSolid: value })} />
                  <ColorToken label="Panel" value={editableTheme.palette.panelBackground} onChange={value => onUpdateThemePalette({ panelBackground: value, sidebarBackground: value })} />
                  <ColorToken label="Text" value={editableTheme.palette.textPrimary} onChange={value => onUpdateThemePalette({ textPrimary: value })} />
                </div>
              </SettingsSectionBlock>
            </div>
          </SettingsInspectorPanel>

          <SettingsInspectorPanel
            title="Surface Controls"
            subtitle="Tune shell translucency, glass strength, and scale without leaving the active theme."
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
              <SettingsRow
                title="Native Glass Blur"
                description="Use compositor-backed window blur when the platform supports it, then tune the glass amount with Blur Strength."
                control={(
                  <input
                    type="checkbox"
                    checked={appBlur}
                    onChange={event => onUpdateAppearance({ appBlur: event.target.checked })}
                  />
                )}
              />
            </div>
          </SettingsInspectorPanel>
        </div>
      </div>
    </section>
  );
}
