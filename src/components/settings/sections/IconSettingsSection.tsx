import type { CSSProperties } from 'react';
import {
  FolderOpen,
  GitBranch,
  HardDrive,
  Image,
  LayoutGrid,
  MonitorPlay,
  Plus,
  Puzzle,
  RefreshCw,
  Search,
  Settings2,
  StickyNote,
  TerminalSquare,
  ThemedPanelIcon,
  Trash2,
} from '@/components/AppIcons';
import { OverlayScrollArea } from '../../OverlayScrollArea';
import type { LoadedIconThemePackage } from '../../../config/iconThemePackages';
import { normalizeIconThemePackageSelectionId } from '../../../config/iconThemePackages';
import {
  FOLDER_ICON_OPTIONS,
  getNamedFolderIconSrc,
  normalizeFolderIconMatcher,
  type FolderIconRule,
  type FolderIconValue,
} from '../../../config/folderIcons';
import { getPanelIconSlotId } from '@/components/AppIcons';
import { resolveFileIconSrc, type OverlayResolvedIconTheme } from '../../../config/iconTheme';
import {
  SettingsActionStrip,
  SettingsCatalogCard,
  SettingsCatalogGrid,
  SettingsInspectorPanel,
  SettingsSectionBlock,
  SettingsSectionHeader,
  SettingsRow,
  ThemeBadge,
} from '../SettingsPrimitives';

function getIconThemePackageSourceBadgeLabel(sourceKind: LoadedIconThemePackage['sourceKind']): string {
  switch (sourceKind) {
    case 'built-in':
      return 'Built-In';
    case 'vscode-icon-theme-directory':
      return 'VS Code Folder';
    case 'vscode-icon-theme-vsix':
      return 'VS Code VSIX';
    default:
      return 'Pack';
  }
}

function parseFolderIconMatchers(value: string): string[] {
  return value
    .split(',')
    .map(part => normalizeFolderIconMatcher(part))
    .filter(Boolean);
}

function stringifyFolderIconMatchers(matchers: string[]): string {
  return matchers.join(', ');
}

export function IconSettingsSection({
  iconThemePackagesDirectory,
  iconThemePackages,
  iconThemePackagesLoading,
  iconThemePackagesError,
  iconThemePackagesWarnings,
  activeIconThemePackage,
  normalizedActiveIconThemeId,
  themeIconTheme,
  border,
  accent,
  text,
  muted,
  platformLabel,
  filteredFolderIconOptions,
  folderIconSearch,
  onFolderIconSearchChange,
  useNativeOsIcons,
  defaultFolderIcon,
  folderIconRules,
  onRefreshIconThemes,
  onOpenIconThemesFolder,
  onApplyIconThemeSelection,
  onToggleNativeOsIcons,
  onRestoreFolderRules,
  onSetDefaultFolderIcon,
  onUpdateFolderRule,
  onRemoveFolderRule,
  onAddFolderRule,
  settingsMonoFieldStyle,
  settingsMonoSelectStyle,
}: {
  iconThemePackagesDirectory: string;
  iconThemePackages: LoadedIconThemePackage[];
  iconThemePackagesLoading: boolean;
  iconThemePackagesError: string | null;
  iconThemePackagesWarnings: string[];
  activeIconThemePackage: LoadedIconThemePackage | null;
  normalizedActiveIconThemeId: string | null;
  themeIconTheme: OverlayResolvedIconTheme;
  border: string;
  accent: string;
  text: string;
  muted: string;
  platformLabel: string;
  filteredFolderIconOptions: ReadonlyArray<{ value: FolderIconValue; label: string; closedSrc: string }>;
  folderIconSearch: string;
  onFolderIconSearchChange: (value: string) => void;
  useNativeOsIcons: boolean;
  defaultFolderIcon: FolderIconValue;
  folderIconRules: FolderIconRule[];
  onRefreshIconThemes: () => Promise<void> | void;
  onOpenIconThemesFolder: () => Promise<void> | void;
  onApplyIconThemeSelection: (iconThemeId: string | null) => void;
  onToggleNativeOsIcons: (enabled: boolean) => void;
  onRestoreFolderRules: () => void;
  onSetDefaultFolderIcon: (icon: FolderIconValue) => void;
  onUpdateFolderRule: (ruleId: string, patch: Partial<FolderIconRule>) => void;
  onRemoveFolderRule: (ruleId: string) => void;
  onAddFolderRule: () => void;
  settingsMonoFieldStyle: CSSProperties;
  settingsMonoSelectStyle: CSSProperties;
}) {
  return (
    <section className="space-y-4" data-settings-section="icons">
      <SettingsSectionHeader
        icon={<Image size={12} />}
        title="Icon Themes"
        subtitle="Theme packs for semantic files plus real OS app icons for shortcuts and executables."
      />

      <SettingsRow
        title="Explorer OS App Icons"
        description={(
          <>
            Show real {platformLabel} shell icons for <code>.lnk</code>, <code>.exe</code>, installers, and web shortcuts before generic theme glyphs.
          </>
        )}
        control={(
          <button
            type="button"
            aria-label={`Native OS Icons ${useNativeOsIcons ? 'On' : 'Off'}`}
            aria-pressed={useNativeOsIcons}
            onClick={() => onToggleNativeOsIcons(!useNativeOsIcons)}
            className="rounded px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
            style={{
              border: `1px solid ${useNativeOsIcons ? accent : border}`,
              background: useNativeOsIcons ? `${accent}22` : 'rgba(255,255,255,0.04)',
              color: text,
            }}
          >
            Native OS Icons {useNativeOsIcons ? 'On' : 'Off'}
          </button>
        )}
        descriptionAlwaysVisible
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(360px,0.7fr)]">
        <div className="space-y-3">
          <SettingsSectionBlock
            title="Pack Directory"
            subtitle={(
              <>
                Drop native <code>icon-theme.json</code> packs, VS Code icon-theme extension folders, or <code>.vsix</code> archives into <code>{iconThemePackagesDirectory}</code>. GreebleFS imports the icon payload into the existing icon catalog automatically, including common VS Code font-backed file icons.
              </>
            )}
            tone="muted"
          >
            <SettingsActionStrip>
              <button
                type="button"
                onClick={() => void onRefreshIconThemes()}
                className="inline-flex items-center gap-2 rounded px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                style={{ border: `1px solid ${border}`, background: 'rgba(255,255,255,0.04)', color: text }}
              >
                <RefreshCw size={11} />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => void onOpenIconThemesFolder()}
                className="inline-flex items-center gap-2 rounded px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                style={{ border: `1px solid ${accent}55`, background: `${accent}18`, color: text }}
              >
                <FolderOpen size={11} />
                Open Folder
              </button>
            </SettingsActionStrip>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px]">
              <ThemeBadge label={`Active ${activeIconThemePackage?.name ?? 'Follow Theme Default'}`} active />
              <ThemeBadge label={`Catalog ${iconThemePackages.length} packs`} />
              <ThemeBadge label={`Root ${iconThemePackagesDirectory}`} />
            </div>

            {iconThemePackagesLoading ? (
              <div className="mt-3 rounded border px-3 py-2 text-[11px] opacity-55" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
                Scanning icon themes...
              </div>
            ) : null}
            {iconThemePackagesError ? (
              <div className="mt-3 rounded border px-3 py-2 text-[11px]" style={{ borderColor: 'var(--overlay-danger)', background: 'color-mix(in srgb, var(--overlay-danger) 12%, transparent)', color: text }}>
                {iconThemePackagesError}
              </div>
            ) : null}
            {iconThemePackagesWarnings.length > 0 ? (
              <div className="mt-3 rounded border px-3 py-2 text-[11px]" style={{ borderColor: 'var(--overlay-warning)', background: 'color-mix(in srgb, var(--overlay-warning) 12%, transparent)', color: text }}>
                {iconThemePackagesWarnings[0]}
              </div>
            ) : null}
          </SettingsSectionBlock>

          <SettingsCatalogGrid className="lg:grid-cols-2">
            <SettingsCatalogCard
              title="Follow Theme Default"
              subtitle={themeIconTheme.name}
              description="The active shell theme continues to provide its default icon theme. Switching the shell theme also switches the icons."
              active={normalizedActiveIconThemeId == null}
              accent={accent}
              onClick={() => onApplyIconThemeSelection(null)}
            />

            {iconThemePackages.map(iconThemePackage => {
              const active = normalizedActiveIconThemeId === normalizeIconThemePackageSelectionId(iconThemePackage.id);
              return (
                <SettingsCatalogCard
                  key={iconThemePackage.id}
                  title={iconThemePackage.name}
                  subtitle={getIconThemePackageSourceBadgeLabel(iconThemePackage.sourceKind)}
                  description={iconThemePackage.description || 'Dedicated icon pack for explorer assets and shell UI slots.'}
                  active={active}
                  accent={accent}
                  onClick={() => onApplyIconThemeSelection(iconThemePackage.id)}
                  metadata={(
                    <div className="flex flex-wrap gap-1">
                      <ThemeBadge label={`${iconThemePackage.capabilitySummary.iconDefinitions} glyphs`} active={active} />
                      <ThemeBadge label={`${iconThemePackage.capabilitySummary.uiIcons} UI`} active={active} />
                      <ThemeBadge label={`${iconThemePackage.capabilitySummary.fileExtensions} ext`} active={active} />
                    </div>
                  )}
                />
              );
            })}
          </SettingsCatalogGrid>
        </div>

        <div className="space-y-3">
          <SettingsInspectorPanel
            title="Live Preview"
            subtitle="Explorer files and stock shell glyphs swap immediately. Thumbnail generation remains separate and only wins when the explorer decides a thumbnail should render."
            badges={[
              activeIconThemePackage?.name ?? 'Follow Theme Default',
              useNativeOsIcons ? 'OS app icons on' : 'OS app icons off',
            ]}
            accent={accent}
          >
            <div className="space-y-3">
              <SettingsSectionBlock title="Explorer" subtitle="Immediate file and folder preview." tone="muted">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'folder', label: 'Folder', src: getNamedFolderIconSrc(defaultFolderIcon, false, themeIconTheme) },
                    { id: 'folder-open', label: 'Folder Open', src: getNamedFolderIconSrc(defaultFolderIcon, true, themeIconTheme) ?? getNamedFolderIconSrc(defaultFolderIcon, false, themeIconTheme) },
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
              </SettingsSectionBlock>

              <SettingsSectionBlock title="Shell UI" subtitle="Shared UI slot previews." tone="muted">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'explorer', label: 'Explorer', icon: <FolderOpen size={15} /> },
                    { id: 'search', label: 'Search', icon: <Search size={15} /> },
                    { id: 'terminal', label: 'Terminal', icon: <TerminalSquare size={15} /> },
                    { id: 'settings', label: 'Settings', icon: <Settings2 size={15} /> },
                    { id: 'refresh', label: 'Refresh', icon: <RefreshCw size={15} /> },
                    { id: 'layout', label: 'Layouts', icon: <LayoutGrid size={15} /> },
                    { id: 'git', label: 'Git', icon: <GitBranch size={15} /> },
                    { id: 'plugins', label: 'Plugins', icon: <Puzzle size={15} /> },
                    { id: 'wallpaper', label: 'Wallpapers', icon: <MonitorPlay size={15} /> },
                  ].map(preview => (
                    <div key={preview.id} className="flex items-center gap-2 rounded border px-2 py-2" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)', color: text }}>
                      <span style={{ display: 'flex', color: accent }}>{preview.icon}</span>
                      <span className="truncate text-[10px]">{preview.label}</span>
                    </div>
                  ))}
                </div>
              </SettingsSectionBlock>

              <SettingsSectionBlock
                title="Panel Tabs"
                subtitle="Panel chrome can target dedicated panel slot ids."
                tone="muted"
              >
                <div className="grid grid-cols-2 gap-2">
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
              </SettingsSectionBlock>

            </div>
          </SettingsInspectorPanel>
        </div>
      </div>

      <SettingsSectionBlock
        title="Folder Icon Authoring"
        subtitle="Curated coding-folder rules land first. Anything that misses falls back to the default folder icon from the active icon theme."
        tone="muted"
        actions={(
          <button
            type="button"
            onClick={onRestoreFolderRules}
            className="rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
            style={{ border: `1px solid ${border}`, background: 'rgba(255,255,255,0.04)', color: text }}
          >
            Restore Rules
          </button>
        )}
      >
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-[140px_minmax(0,1fr)]">
              <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">Default Fallback</label>
              <div className="flex items-center gap-3 rounded border px-3 py-2" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)' }}>
                <img
                  src={getNamedFolderIconSrc(defaultFolderIcon, false, themeIconTheme)}
                  width={22}
                  height={22}
                  style={{ objectFit: 'contain', flexShrink: 0 }}
                  draggable={false}
                />
                <select
                  aria-label="Default fallback folder icon"
                  value={defaultFolderIcon}
                  onChange={event => onSetDefaultFolderIcon(event.target.value as FolderIconValue)}
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

            <div className="space-y-2">
              {folderIconRules.map(rule => (
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
                        onChange={event => onUpdateFolderRule(rule.id, { label: event.target.value })}
                        className="w-full bg-transparent text-[11px] outline-none"
                        style={{ color: text }}
                      />
                    </div>
                    <input
                      value={stringifyFolderIconMatchers(rule.matchers)}
                      onChange={event => onUpdateFolderRule(rule.id, { matchers: parseFolderIconMatchers(event.target.value) })}
                      placeholder="src, source, source_code"
                      className="w-full rounded border px-3 py-2 text-[11px] outline-none"
                      style={settingsMonoFieldStyle}
                    />
                    <select
                      aria-label={`Folder icon for ${rule.label}`}
                      value={rule.icon}
                      onChange={event => onUpdateFolderRule(rule.id, { icon: event.target.value as FolderIconValue })}
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
                      type="button"
                      onClick={() => onRemoveFolderRule(rule.id)}
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

            <SettingsActionStrip>
              <button
                type="button"
                onClick={onAddFolderRule}
                className="inline-flex items-center gap-2 rounded px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                style={{ background: `${accent}18`, color: text, border: `1px solid ${accent}55` }}
              >
                <Plus size={11} />
                Add Rule
              </button>
              <span className="text-[10px] opacity-40">
                Matchers are normalized, so `src-tauri`, `src tauri`, and `src_tauri` resolve the same way.
              </span>
            </SettingsActionStrip>
          </div>

          <SettingsInspectorPanel
            title="Icon Catalog"
            subtitle="Filter icon names and set the current default fallback quickly."
            tone="muted"
            accent={accent}
          >
            <label className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">
              <Search size={11} />
              Icon Catalog
            </label>
            <input
              value={folderIconSearch}
              onChange={event => onFolderIconSearchChange(event.target.value)}
              placeholder="Filter icon names"
              className="mt-2 w-full rounded border px-3 py-2 text-[11px] outline-none"
              style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text }}
            />
            <OverlayScrollArea style={{ marginTop: 12, maxHeight: 360 }} viewportStyle={{ paddingRight: 4 }}>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-2">
                {filteredFolderIconOptions.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onSetDefaultFolderIcon(option.value)}
                    className="flex items-center gap-2 rounded border px-2 py-2 text-left text-[10px]"
                    style={{
                      borderColor: defaultFolderIcon === option.value ? accent : border,
                      background: defaultFolderIcon === option.value ? `${accent}14` : 'rgba(255,255,255,0.03)',
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
          </SettingsInspectorPanel>
        </div>
      </SettingsSectionBlock>
    </section>
  );
}
