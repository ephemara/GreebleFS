import type { CSSProperties, ReactNode } from 'react';
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
  SettingsCatalogCard,
  SettingsCatalogGrid,
  SettingsCompactActionButton,
  SettingsCompactSection,
  SettingsControlRow,
  SettingsIconActionButton,
  SettingsInlineNotice,
  SettingsKeyValueRow,
  SettingsMetricStrip,
  SettingsOverflowMenu,
  SettingsSectionScaffold,
  SettingsSelect,
} from '../SettingsPrimitives';

type CompactIconPreviewItem = {
  id: string;
  label: string;
  detail?: string;
  imageSrc?: string | null;
  icon?: ReactNode;
};

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

function CompactIconPreviewGroup({
  title,
  items,
  accent,
  border,
  text,
}: {
  title: string;
  items: CompactIconPreviewItem[];
  accent: string;
  border: string;
  text: string;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-1 px-1 text-[9px] font-semibold uppercase opacity-45">{title}</div>
      <div className="grid min-w-0 grid-cols-1 gap-1 sm:grid-cols-2">
        {items.map(item => (
          <div
            key={item.id}
            className="grid min-h-8 min-w-0 grid-cols-[1.375rem_minmax(0,1fr)] items-center gap-2 rounded border px-2 py-1"
            style={{
              borderColor: border,
              background: 'var(--overlay-workbench-settings-badge-bg)',
              color: text,
            }}
          >
            <span className="flex h-5 w-5 items-center justify-center" style={{ color: accent }}>
              {item.imageSrc ? (
                <img
                  src={item.imageSrc}
                  alt=""
                  width={18}
                  height={18}
                  style={{ objectFit: 'contain', flexShrink: 0 }}
                  draggable={false}
                />
              ) : item.icon}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[10px]">{item.label}</span>
              {item.detail ? <span className="block truncate text-[8px] opacity-40">{item.detail}</span> : null}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompactCatalogMetadata({
  items,
  active,
  accent,
  border,
}: {
  items: Array<{ id: string; label: string }>;
  active: boolean;
  accent: string;
  border: string;
}) {
  return (
    <div className="grid grid-cols-3 gap-1">
      {items.map(item => (
        <span
          key={item.id}
          className="truncate rounded border px-1.5 py-0.5 text-center text-[8px] font-semibold uppercase"
          style={{
            borderColor: active ? `${accent}66` : border,
            background: active ? `${accent}14` : 'var(--overlay-workbench-settings-badge-bg)',
          }}
          title={item.label}
        >
          {item.label}
        </span>
      ))}
    </div>
  );
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
  const activeIconThemeLabel = activeIconThemePackage?.name ?? 'Follow Theme Default';
  const activeIconThemeSourceLabel = activeIconThemePackage
    ? getIconThemePackageSourceBadgeLabel(activeIconThemePackage.sourceKind)
    : themeIconTheme.name;
  const nativeOsIconStatus = useNativeOsIcons ? 'On' : 'Off';
  const folderPreviewClosedSrc = getNamedFolderIconSrc(defaultFolderIcon, false, themeIconTheme);
  const folderPreviewOpenSrc = getNamedFolderIconSrc(defaultFolderIcon, true, themeIconTheme) ?? folderPreviewClosedSrc;
  const filePreviewItems: CompactIconPreviewItem[] = [
    { id: 'folder', label: 'Folder', imageSrc: folderPreviewClosedSrc },
    { id: 'folder-open', label: 'Folder Open', imageSrc: folderPreviewOpenSrc },
    { id: 'typescript', label: 'main.ts', imageSrc: resolveFileIconSrc('main.ts', 'ts', themeIconTheme) },
    { id: 'json', label: 'theme.json', imageSrc: resolveFileIconSrc('theme.json', 'json', themeIconTheme) },
    { id: 'markdown', label: 'README.md', imageSrc: resolveFileIconSrc('README.md', 'md', themeIconTheme) },
    { id: 'shader', label: 'shell.wgsl', imageSrc: resolveFileIconSrc('shell.wgsl', 'wgsl', themeIconTheme) },
  ];
  const shellPreviewItems: CompactIconPreviewItem[] = [
    { id: 'explorer', label: 'Explorer', icon: <FolderOpen size={14} /> },
    { id: 'search', label: 'Search', icon: <Search size={14} /> },
    { id: 'terminal', label: 'Terminal', icon: <TerminalSquare size={14} /> },
    { id: 'settings', label: 'Settings', icon: <Settings2 size={14} /> },
    { id: 'refresh', label: 'Refresh', icon: <RefreshCw size={14} /> },
    { id: 'layout', label: 'Layouts', icon: <LayoutGrid size={14} /> },
    { id: 'git', label: 'Git', icon: <GitBranch size={14} /> },
    { id: 'plugins', label: 'Plugins', icon: <Puzzle size={14} /> },
    { id: 'wallpaper', label: 'Wallpapers', icon: <MonitorPlay size={14} /> },
  ];
  const panelPreviewItems: CompactIconPreviewItem[] = [
    {
      id: 'explorer',
      label: 'Explorer',
      detail: getPanelIconSlotId('explorer'),
      icon: <ThemedPanelIcon panelId="explorer" fallbackSlotId="folder_open" fallbackIcon={FolderOpen} size={14} />,
    },
    {
      id: 'storage',
      label: 'Storage',
      detail: getPanelIconSlotId('storage'),
      icon: <ThemedPanelIcon panelId="storage" fallbackSlotId="hard_drive" fallbackIcon={HardDrive} size={14} />,
    },
    {
      id: 'notes',
      label: 'Notes',
      detail: getPanelIconSlotId('notes'),
      icon: <ThemedPanelIcon panelId="notes" fallbackSlotId="sticky_note" fallbackIcon={StickyNote} size={14} />,
    },
    {
      id: 'plugins',
      label: 'Plugins',
      detail: getPanelIconSlotId('plugins'),
      icon: <ThemedPanelIcon panelId="plugins" fallbackSlotId="puzzle" fallbackIcon={Puzzle} size={14} />,
    },
    {
      id: 'settings',
      label: 'Settings',
      detail: getPanelIconSlotId('settings'),
      icon: <ThemedPanelIcon panelId="settings" fallbackSlotId="settings2" fallbackIcon={Settings2} size={14} />,
    },
    {
      id: 'drawable-canvas',
      label: 'Drawable Canvas',
      detail: getPanelIconSlotId('drawable-canvas'),
      icon: <ThemedPanelIcon panelId="drawable-canvas" fallbackSlotId="puzzle" fallbackIcon={Puzzle} size={14} />,
    },
  ];

  return (
    <SettingsSectionScaffold
      sectionKey="icons"
      icon={<Image size={12} />}
      title="Icon Themes"
      subtitle="Icon packs, OS app icons, and folder rules."
      badges={[activeIconThemeLabel, `${iconThemePackages.length} packs`]}
      className="space-y-3"
    >
      <span className="sr-only">
        Choose a dedicated icon theme, keep folder rules in one place, and make Explorer show real OS app icons for shortcuts and executables.
      </span>
      <SettingsCompactSection
        title="Icon Sources"
        subtitle={activeIconThemeLabel}
        actions={(
          <>
            <SettingsIconActionButton
              aria-label="Refresh icon themes"
              title="Refresh icon themes"
              onClick={() => void onRefreshIconThemes()}
              disabled={iconThemePackagesLoading}
            >
              <RefreshCw size={12} />
            </SettingsIconActionButton>
            <SettingsIconActionButton
              aria-label="Open icon themes folder"
              title="Open icon themes folder"
              onClick={() => void onOpenIconThemesFolder()}
            >
              <FolderOpen size={12} />
            </SettingsIconActionButton>
          </>
        )}
      >
        <SettingsControlRow
          label="Explorer OS App Icons"
          detail={platformLabel}
          control={(
            <span className="truncate text-[11px]" style={{ color: muted }}>
              .lnk / .exe / .msi / .url
            </span>
          )}
          action={(
            <SettingsCompactActionButton
              active={useNativeOsIcons}
              accent={accent}
              aria-label={`Native OS Icons ${nativeOsIconStatus}`}
              aria-pressed={useNativeOsIcons}
              onClick={() => onToggleNativeOsIcons(!useNativeOsIcons)}
            >
              {nativeOsIconStatus}
            </SettingsCompactActionButton>
          )}
        />

        <div className="space-y-2 border-t p-2" style={{ borderColor: 'var(--overlay-workbench-settings-card-border)' }}>
          <SettingsMetricStrip
            items={[
              { id: 'active', label: 'Active', value: activeIconThemeLabel, tone: 'accent' },
              {
                id: 'catalog',
                label: 'Catalog',
                value: iconThemePackagesLoading ? 'Scanning' : `${iconThemePackages.length} packs`,
              },
              { id: 'native', label: `${platformLabel} Icons`, value: nativeOsIconStatus },
            ]}
          />
        </div>

        <SettingsKeyValueRow
          label="Root"
          value={(
            <span className="block min-w-0 truncate" style={{ fontFamily: 'var(--overlay-font-mono)' }} title={iconThemePackagesDirectory}>
              {iconThemePackagesDirectory}
            </span>
          )}
          action={(
            <SettingsIconActionButton
              aria-label="Open icon pack root"
              title="Open icon pack root"
              onClick={() => void onOpenIconThemesFolder()}
            >
              <FolderOpen size={12} />
            </SettingsIconActionButton>
          )}
        />
        <SettingsKeyValueRow label="Source" value={activeIconThemeSourceLabel} />

        {iconThemePackagesLoading ? (
          <div className="px-2 pb-2">
            <SettingsInlineNotice tone="info">Scanning icon themes</SettingsInlineNotice>
          </div>
        ) : null}
        {iconThemePackagesError ? (
          <div className="px-2 pb-2">
            <SettingsInlineNotice tone="danger">{iconThemePackagesError}</SettingsInlineNotice>
          </div>
        ) : null}
        {iconThemePackagesWarnings.length > 0 ? (
          <div className="px-2 pb-2">
            <SettingsInlineNotice tone="warning">{iconThemePackagesWarnings[0]}</SettingsInlineNotice>
          </div>
        ) : null}
      </SettingsCompactSection>

      <div className="grid min-w-0 grid-cols-1 gap-3 2xl:grid-cols-[minmax(0,1fr)_minmax(19rem,0.58fr)]">
        <SettingsCompactSection
          title="Pack Catalog"
          subtitle={iconThemePackagesLoading ? 'Scanning' : `${iconThemePackages.length + 1} choices`}
        >
          <SettingsCatalogGrid className="p-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-2">
            <SettingsCatalogCard
              title="Follow Theme Default"
              subtitle={themeIconTheme.name}
              active={normalizedActiveIconThemeId == null}
              accent={accent}
              onClick={() => onApplyIconThemeSelection(null)}
              className="!px-2 !py-2"
              metadata={(
                <CompactCatalogMetadata
                  active={normalizedActiveIconThemeId == null}
                  accent={accent}
                  border={border}
                  items={[
                    { id: 'source', label: 'Theme' },
                    { id: 'files', label: 'Files' },
                    { id: 'ui', label: 'UI' },
                  ]}
                />
              )}
            />

            {iconThemePackages.map(iconThemePackage => {
              const active = normalizedActiveIconThemeId === normalizeIconThemePackageSelectionId(iconThemePackage.id);
              return (
                <SettingsCatalogCard
                  key={iconThemePackage.id}
                  title={iconThemePackage.name}
                  subtitle={getIconThemePackageSourceBadgeLabel(iconThemePackage.sourceKind)}
                  active={active}
                  accent={accent}
                  onClick={() => onApplyIconThemeSelection(iconThemePackage.id)}
                  className="!px-2 !py-2"
                  metadata={(
                    <CompactCatalogMetadata
                      active={active}
                      accent={accent}
                      border={border}
                      items={[
                        { id: 'glyphs', label: `${iconThemePackage.capabilitySummary.iconDefinitions} glyphs` },
                        { id: 'ui', label: `${iconThemePackage.capabilitySummary.uiIcons} UI` },
                        { id: 'ext', label: `${iconThemePackage.capabilitySummary.fileExtensions} ext` },
                      ]}
                    />
                  )}
                />
              );
            })}
          </SettingsCatalogGrid>
        </SettingsCompactSection>

        <SettingsCompactSection
          title="Live Preview"
          subtitle={`${activeIconThemeLabel} / OS ${nativeOsIconStatus}`}
        >
          <div className="min-w-0 space-y-3 p-2">
            <CompactIconPreviewGroup title="Explorer" items={filePreviewItems} accent={accent} border={border} text={text} />
            <CompactIconPreviewGroup title="Shell UI" items={shellPreviewItems} accent={accent} border={border} text={text} />
            <CompactIconPreviewGroup title="Panel Tabs" items={panelPreviewItems} accent={accent} border={border} text={text} />
          </div>
        </SettingsCompactSection>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-3 2xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.46fr)]">
        <SettingsCompactSection
          title="Folder Rules"
          subtitle={`${folderIconRules.length} rules`}
          actions={(
            <>
              <SettingsIconActionButton
                aria-label="Add folder icon rule"
                title="Add folder icon rule"
                accent={accent}
                onClick={onAddFolderRule}
              >
                <Plus size={12} />
              </SettingsIconActionButton>
              <SettingsOverflowMenu label="More">
                <SettingsCompactActionButton
                  className="w-full justify-start"
                  onClick={onRestoreFolderRules}
                >
                  <RefreshCw size={11} />
                  Restore
                </SettingsCompactActionButton>
              </SettingsOverflowMenu>
            </>
          )}
        >
          <SettingsControlRow
            label="Default"
            detail="Fallback"
            control={(
              <div className="flex min-w-0 items-center gap-2">
                <img
                  src={folderPreviewClosedSrc}
                  alt=""
                  width={20}
                  height={20}
                  style={{ objectFit: 'contain', flexShrink: 0 }}
                  draggable={false}
                />
                <SettingsSelect
                  aria-label="Default fallback folder icon"
                  value={defaultFolderIcon}
                  onChange={event => onSetDefaultFolderIcon(event.target.value as FolderIconValue)}
                  className="w-full"
                  style={settingsMonoSelectStyle}
                >
                  {FOLDER_ICON_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </SettingsSelect>
              </div>
            )}
          />

          <div className="border-t" style={{ borderColor: 'var(--overlay-workbench-settings-card-border)' }}>
            {folderIconRules.map(rule => (
              <div
                key={rule.id}
                className="grid min-h-9 min-w-0 grid-cols-1 items-center gap-2 border-t px-3 py-1.5 first:border-t-0 xl:grid-cols-[minmax(10rem,0.34fr)_minmax(0,1fr)_minmax(9rem,0.28fr)_auto]"
                style={{
                  borderColor: 'var(--overlay-workbench-settings-card-border)',
                  color: text,
                }}
              >
                <div
                  className="flex min-w-0 items-center gap-2 rounded border px-2 py-1"
                  style={{ borderColor: border, background: 'var(--overlay-workbench-settings-badge-bg)' }}
                >
                  <img
                    src={getNamedFolderIconSrc(rule.icon, false, themeIconTheme)}
                    alt=""
                    width={17}
                    height={17}
                    style={{ objectFit: 'contain', flexShrink: 0 }}
                    draggable={false}
                  />
                  <input
                    aria-label={`Folder rule label ${rule.label}`}
                    value={rule.label}
                    onChange={event => onUpdateFolderRule(rule.id, { label: event.target.value })}
                    className="min-w-0 flex-1 bg-transparent text-[11px] outline-none"
                    style={{ color: text }}
                  />
                </div>

                <input
                  aria-label={`Folder matchers for ${rule.label}`}
                  value={stringifyFolderIconMatchers(rule.matchers)}
                  onChange={event => onUpdateFolderRule(rule.id, { matchers: parseFolderIconMatchers(event.target.value) })}
                  placeholder="src, source, source_code"
                  title="Comma-separated matcher names"
                  className="h-7 min-w-0 rounded border px-2 text-[11px] outline-none"
                  style={settingsMonoFieldStyle}
                />

                <SettingsSelect
                  aria-label={`Folder icon for ${rule.label}`}
                  value={rule.icon}
                  onChange={event => onUpdateFolderRule(rule.id, { icon: event.target.value as FolderIconValue })}
                  className="w-full"
                  style={settingsMonoSelectStyle}
                >
                  {FOLDER_ICON_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </SettingsSelect>

                <SettingsIconActionButton
                  aria-label={`Remove ${rule.label} folder rule`}
                  title="Remove rule"
                  onClick={() => onRemoveFolderRule(rule.id)}
                  style={{ color: muted }}
                >
                  <Trash2 size={12} />
                </SettingsIconActionButton>
              </div>
            ))}
          </div>
        </SettingsCompactSection>

        <SettingsCompactSection
          title="Icon Catalog"
          subtitle={`${filteredFolderIconOptions.length} shown`}
        >
          <SettingsControlRow
            label="Search"
            detail={folderIconSearch ? 'Filtered' : 'All icons'}
            control={(
              <div
                className="flex h-7 min-w-0 items-center gap-2 rounded border px-2"
                style={{
                  borderColor: border,
                  background: 'var(--overlay-workbench-settings-badge-bg)',
                  color: text,
                }}
              >
                <Search size={12} />
                <input
                  value={folderIconSearch}
                  onChange={event => onFolderIconSearchChange(event.target.value)}
                  placeholder="Filter"
                  className="min-w-0 flex-1 bg-transparent text-[11px] outline-none"
                  style={{ color: text }}
                />
              </div>
            )}
          />

          {filteredFolderIconOptions.length === 0 ? (
            <div className="p-2">
              <SettingsInlineNotice tone="muted">No icon matches</SettingsInlineNotice>
            </div>
          ) : (
            <OverlayScrollArea style={{ maxHeight: 320 }} viewportStyle={{ padding: 8 }}>
              <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 2xl:grid-cols-2">
                {filteredFolderIconOptions.map(option => {
                  const active = defaultFolderIcon === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => onSetDefaultFolderIcon(option.value)}
                      className="grid min-h-7 min-w-0 grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-1.5 rounded border px-1.5 py-1 text-left text-[10px]"
                      style={{
                        borderColor: active ? accent : border,
                        background: active ? `${accent}14` : 'var(--overlay-workbench-settings-badge-bg)',
                        color: text,
                      }}
                      title={`Set ${option.label} as default fallback`}
                      aria-pressed={active}
                    >
                      <img
                        src={option.closedSrc}
                        alt=""
                        width={17}
                        height={17}
                        style={{ objectFit: 'contain', flexShrink: 0 }}
                        draggable={false}
                      />
                      <span className="truncate">{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </OverlayScrollArea>
          )}
        </SettingsCompactSection>
      </div>
    </SettingsSectionScaffold>
  );
}
