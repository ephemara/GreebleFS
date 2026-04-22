import React, { useMemo } from 'react';
import {
  FolderOpen,
  HardDrive,
  LayoutGrid,
  Puzzle,
  RefreshCw,
  Search,
  Settings2,
  StickyNote,
  Terminal,
} from '@/components/AppIcons';

import type { ResolvedOverlayAppearance } from '../../config/appearance';
import { createDefaultDirectoryBookmarks } from '../../config/platform';
import type { SettingsSectionKey } from '../../config/settingsNavigation';
import type { LoadedExplorerHomePack } from '../../config/homePackages';
import type {
  ExplorerDriveInfo,
  ExplorerSavedSearch,
  ExplorerTaskSnapshot,
} from '../../runtime/explorerBackend';
import type {
  ExplorerHomeBookmarkItem,
  ExplorerHomeLaunchpadItem,
  ExplorerHomePackContext,
  ExplorerHomePackHost,
  ExplorerHomePackModuleLayout,
  ExplorerHomePackPresetDefinition,
  ExplorerHomeUsageEntry,
} from './homePackRuntime';
import { ExplorerHomePackBoundary } from './homePackRuntime';

const FALLBACK_EXPLORER_HOME_PACK_ID = 'command-center';

export interface ExplorerHomeHostData {
  appearance: ResolvedOverlayAppearance;
  activePresetId: string | null;
  usageTrackingEnabled: boolean;
  quickAccess: ExplorerHomePackHost['quickAccess'];
  bookmarks: ExplorerHomeBookmarkItem[];
  mostUsedFolders: ExplorerHomeUsageEntry[];
  recentFolders: ExplorerHomeUsageEntry[];
  savedSearches: ExplorerSavedSearch[];
  drives: ExplorerDriveInfo[];
  tasks: ExplorerTaskSnapshot[];
  launchpad: ExplorerHomeLaunchpadItem[];
  packState: Record<string, unknown>;
  packWarnings: string[];
  diagnostics: ExplorerHomePackHost['diagnostics'];
}

export interface ExplorerHomeHostActions {
  navigate: (path: string) => void;
  openSavedSearch: (savedSearch: ExplorerSavedSearch) => void;
  openPanel: (panelId: string) => void;
  openSettingsSection: (section: SettingsSectionKey) => void;
  refresh: () => void;
  updatePackState: (updates: Record<string, unknown>) => void;
  setPreset: (presetId: string | null) => void;
}

export interface ResolvedExplorerHomePackSelection {
  activePack: LoadedExplorerHomePack | null;
  requestedPackId: string | null;
  selectedPackError: string | null;
  warnings: string[];
  isFallback: boolean;
  authoredPackCount: number;
}

interface ExplorerHomeSurfaceProps {
  appearance: ResolvedOverlayAppearance;
  packs: LoadedExplorerHomePack[];
  requestedPackId: string | null;
  themeDefaultPackId?: string | null;
  activePresetIdByPackId: Record<string, string | null>;
  usageTrackingEnabled: boolean;
  quickAccess: ExplorerHomePackHost['quickAccess'];
  bookmarks: ExplorerHomeBookmarkItem[];
  mostUsedFolders: ExplorerHomeUsageEntry[];
  recentFolders: ExplorerHomeUsageEntry[];
  savedSearches: ExplorerSavedSearch[];
  drives: ExplorerDriveInfo[];
  tasks: ExplorerTaskSnapshot[];
  launchpad: ExplorerHomeLaunchpadItem[];
  packState: Record<string, unknown>;
  onNavigate: (path: string) => void;
  onOpenSavedSearch: (savedSearch: ExplorerSavedSearch) => void;
  onOpenPanel: (panelId: string) => void;
  onOpenSettingsSection: (section: SettingsSectionKey) => void;
  onRefresh: () => void;
  onUpdatePackState: (updates: Record<string, unknown>) => void;
  onSetPreset: (presetId: string | null) => void;
}

function normalizePackId(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function canRenderExplorerHomePack(pack: LoadedExplorerHomePack | null | undefined): boolean {
  if (!pack) {
    return false;
  }

  return Boolean(pack.runtime.component) || pack.runtime.presets.length > 0;
}

export function createExplorerHomeQuickAccessItems(
  userHomePath: string | null | undefined,
): ExplorerHomePackHost['quickAccess'] {
  const homePath = typeof userHomePath === 'string' ? userHomePath.trim() : '';
  if (!homePath) {
    return [];
  }

  return createDefaultDirectoryBookmarks(homePath).map((bookmark) => ({
    id: bookmark.id,
    label: bookmark.name,
    path: bookmark.value,
    description: bookmark.value,
  }));
}

export function createExplorerHomeLaunchpadItems(): ExplorerHomeLaunchpadItem[] {
  return [
    {
      id: 'launchpad-terminal',
      label: 'Terminal',
      description: 'Open the integrated shell.',
      panelId: 'terminal',
    },
    {
      id: 'launchpad-settings',
      label: 'Settings',
      description: 'Tune Home packs, shell chrome, and explorer behavior.',
      panelId: 'settings',
    },
    {
      id: 'launchpad-plugins',
      label: 'Plugins',
      description: 'Browse live runtime extensions.',
      panelId: 'plugins',
    },
    {
      id: 'launchpad-notes',
      label: 'Notes',
      description: 'Jump to built-in notes and reference material.',
      panelId: 'notes',
    },
    {
      id: 'launchpad-screenshots',
      label: 'Screenshots',
      description: 'Capture and annotate proof without leaving the shell.',
      panelId: 'screenshots',
    },
    {
      id: 'launchpad-storage',
      label: 'Storage',
      description: 'Inspect storage surfaces and roots.',
      panelId: 'storage',
    },
  ];
}

export function resolveExplorerHomePackSelection(args: {
  packs: LoadedExplorerHomePack[];
  requestedPackId?: string | null;
  themeDefaultPackId?: string | null;
}): ResolvedExplorerHomePackSelection {
  const fallbackPack = args.packs.find((pack) => pack.id === FALLBACK_EXPLORER_HOME_PACK_ID)
    ?? args.packs[0]
    ?? null;
  const preferredPackId = normalizePackId(args.requestedPackId)
    ?? normalizePackId(args.themeDefaultPackId)
    ?? fallbackPack?.id
    ?? null;
  const preferredPack = preferredPackId
    ? args.packs.find((pack) => pack.id === preferredPackId) ?? null
    : null;
  const activePack = canRenderExplorerHomePack(preferredPack)
    ? preferredPack
    : canRenderExplorerHomePack(fallbackPack)
      ? fallbackPack
      : preferredPack ?? fallbackPack;
  const missingRequestedPack = preferredPackId != null && preferredPack == null;
  const invalidRequestedPack = preferredPack != null && !canRenderExplorerHomePack(preferredPack);
  const selectedPackError = missingRequestedPack
    ? `Selected home pack "${preferredPackId}" is not available.`
    : invalidRequestedPack
      ? `Selected home pack "${preferredPack?.name ?? preferredPackId}" could not render, so GreebleFS fell back to ${activePack?.name ?? 'the default home pack'}.`
      : null;
  const warnings = Array.from(new Set([
    ...(activePack?.warnings ?? []),
    ...(selectedPackError ? [selectedPackError] : []),
  ]));

  return {
    activePack,
    requestedPackId: preferredPackId,
    selectedPackError,
    warnings,
    isFallback: Boolean(activePack && preferredPackId && activePack.id !== preferredPackId),
    authoredPackCount: args.packs.filter((pack) => pack.sourceKind !== 'built-in').length,
  };
}

export function createExplorerHomeHost(
  data: ExplorerHomeHostData,
  actions: ExplorerHomeHostActions,
): ExplorerHomePackHost {
  return {
    appearance: data.appearance,
    activePresetId: data.activePresetId,
    usageTrackingEnabled: data.usageTrackingEnabled,
    quickAccess: data.quickAccess,
    bookmarks: data.bookmarks,
    mostUsedFolders: data.mostUsedFolders,
    recentFolders: data.recentFolders,
    savedSearches: data.savedSearches,
    drives: data.drives,
    tasks: data.tasks,
    launchpad: data.launchpad,
    packState: data.packState,
    packWarnings: data.packWarnings,
    diagnostics: data.diagnostics,
    navigate: actions.navigate,
    openSavedSearch: actions.openSavedSearch,
    openPanel: actions.openPanel,
    openSettingsSection: actions.openSettingsSection,
    refresh: actions.refresh,
    updatePackState: actions.updatePackState,
    setPreset: actions.setPreset,
  };
}

function resolveActivePreset(
  pack: LoadedExplorerHomePack | null,
  requestedPresetId: string | null,
): ExplorerHomePackPresetDefinition | null {
  if (!pack) {
    return null;
  }

  if (requestedPresetId) {
    const explicitPreset = pack.runtime.presets.find((preset) => preset.id === requestedPresetId);
    if (explicitPreset) {
      return explicitPreset;
    }
  }

  const defaultPresetId = normalizePackId(pack.runtime.defaultPresetId);
  if (defaultPresetId) {
    const defaultPreset = pack.runtime.presets.find((preset) => preset.id === defaultPresetId);
    if (defaultPreset) {
      return defaultPreset;
    }
  }

  return pack.runtime.presets[0] ?? null;
}

function formatRelativeTime(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return 'Unknown';
  }

  const deltaMs = Date.now() - timestamp;
  if (deltaMs < 60_000) {
    return 'Just now';
  }
  if (deltaMs < 3_600_000) {
    return `${Math.max(1, Math.round(deltaMs / 60_000))}m ago`;
  }
  if (deltaMs < 86_400_000) {
    return `${Math.max(1, Math.round(deltaMs / 3_600_000))}h ago`;
  }

  return `${Math.max(1, Math.round(deltaMs / 86_400_000))}d ago`;
}

function renderModuleLabel(moduleId: string): string {
  switch (moduleId) {
    case 'quick-access':
      return 'Quick Access';
    case 'bookmarks':
      return 'Bookmarks';
    case 'most-used-folders':
      return 'Most Used';
    case 'recent-folders':
      return 'Recent';
    case 'saved-searches':
      return 'Saved Searches';
    case 'task-center':
      return 'Task Center';
    case 'drives':
      return 'Drives + Roots';
    case 'launchpad':
      return 'Launchpad';
    default:
      return moduleId;
  }
}

function renderLaunchpadIcon(panelId: string) {
  switch (panelId) {
    case 'terminal':
      return <Terminal size={15} />;
    case 'settings':
      return <Settings2 size={15} />;
    case 'plugins':
      return <Puzzle size={15} />;
    case 'notes':
      return <StickyNote size={15} />;
    case 'storage':
      return <HardDrive size={15} />;
    default:
      return <LayoutGrid size={15} />;
  }
}

function HomeModuleCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        borderRadius: 20,
        border: '1px solid var(--overlay-explorer-chip-border)',
        background: 'linear-gradient(180deg, rgba(14,19,30,0.98) 0%, rgba(9,12,20,0.98) 100%)',
        padding: 16,
      }}
    >
      <div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--overlay-accent)',
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div style={{ marginTop: 6, fontSize: 11, lineHeight: 1.5, color: 'var(--overlay-text-muted)' }}>
            {subtitle}
          </div>
        ) : null}
      </div>
      <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
        {children}
      </div>
    </section>
  );
}

function HomeActionRow({
  label,
  meta,
  icon,
  onClick,
}: {
  label: string;
  meta: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '12px 14px',
        borderRadius: 14,
        border: '1px solid var(--overlay-explorer-chip-border)',
        background: 'var(--overlay-explorer-chip-bg)',
        color: 'var(--overlay-text-primary)',
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      <span style={{ color: 'var(--overlay-accent)', marginTop: 1 }}>{icon}</span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontSize: 12, fontWeight: 700 }}>
          {label}
        </span>
        <span
          style={{
            display: 'block',
            marginTop: 4,
            fontSize: 11,
            lineHeight: 1.5,
            color: 'var(--overlay-text-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={meta}
        >
          {meta}
        </span>
      </span>
    </button>
  );
}

function renderPresetModule(
  module: ExplorerHomePackModuleLayout,
  host: ExplorerHomePackHost,
): React.ReactNode {
  const limit = module.limit ?? 6;

  switch (module.moduleId) {
    case 'quick-access':
      return (
        <HomeModuleCard
          title={module.title ?? renderModuleLabel(module.moduleId)}
          subtitle={module.description ?? 'Fast platform shortcuts and operator roots.'}
        >
          {host.quickAccess.slice(0, limit).map((item) => (
            <HomeActionRow
              key={item.id}
              label={item.label}
              meta={item.description ?? item.path}
              icon={<FolderOpen size={15} />}
              onClick={() => host.navigate(item.path)}
            />
          ))}
        </HomeModuleCard>
      );
    case 'bookmarks':
      return (
        <HomeModuleCard
          title={module.title ?? renderModuleLabel(module.moduleId)}
          subtitle={module.description ?? 'Pinned folders from the explorer rail.'}
        >
          {host.bookmarks.slice(0, limit).map((bookmark) => (
            <HomeActionRow
              key={bookmark.id}
              label={bookmark.label}
              meta={bookmark.path}
              icon={<FolderOpen size={15} />}
              onClick={() => host.navigate(bookmark.path)}
            />
          ))}
        </HomeModuleCard>
      );
    case 'most-used-folders':
      return (
        <HomeModuleCard
          title={module.title ?? renderModuleLabel(module.moduleId)}
          subtitle={module.description ?? 'Frequently opened local folders.'}
        >
          {host.mostUsedFolders.slice(0, limit).map((entry) => (
            <HomeActionRow
              key={entry.path}
              label={entry.label}
              meta={`${entry.openCount} opens · ${formatRelativeTime(entry.lastOpenedAt)}`}
              icon={<FolderOpen size={15} />}
              onClick={() => host.navigate(entry.path)}
            />
          ))}
        </HomeModuleCard>
      );
    case 'recent-folders':
      return (
        <HomeModuleCard
          title={module.title ?? renderModuleLabel(module.moduleId)}
          subtitle={module.description ?? 'Recent local folders with one-click recall.'}
        >
          {host.recentFolders.slice(0, limit).map((entry) => (
            <HomeActionRow
              key={entry.path}
              label={entry.label}
              meta={formatRelativeTime(entry.lastOpenedAt)}
              icon={<FolderOpen size={15} />}
              onClick={() => host.navigate(entry.path)}
            />
          ))}
        </HomeModuleCard>
      );
    case 'saved-searches':
      return (
        <HomeModuleCard
          title={module.title ?? renderModuleLabel(module.moduleId)}
          subtitle={module.description ?? 'Pinned recursive search recipes.'}
        >
          {host.savedSearches.slice(0, limit).map((savedSearch) => (
            <HomeActionRow
              key={savedSearch.id}
              label={savedSearch.name}
              meta={`${savedSearch.searchMode} · ${savedSearch.rootPath}`}
              icon={<Search size={15} />}
              onClick={() => host.openSavedSearch(savedSearch)}
            />
          ))}
        </HomeModuleCard>
      );
    case 'task-center':
      return (
        <HomeModuleCard
          title={module.title ?? renderModuleLabel(module.moduleId)}
          subtitle={module.description ?? 'Recent file operations and background explorer work.'}
        >
          {host.tasks.slice(0, limit).map((task) => (
            <HomeActionRow
              key={task.id}
              label={task.title}
              meta={task.detail ?? task.status}
              icon={<RefreshCw size={15} />}
              onClick={() => host.openPanel('explorer')}
            />
          ))}
        </HomeModuleCard>
      );
    case 'drives':
      return (
        <HomeModuleCard
          title={module.title ?? renderModuleLabel(module.moduleId)}
          subtitle={module.description ?? 'Local roots and connected cloud lanes.'}
        >
          {host.drives.slice(0, limit).map((drive) => (
            <HomeActionRow
              key={drive.id}
              label={drive.label}
              meta={drive.path}
              icon={<HardDrive size={15} />}
              onClick={() => host.navigate(drive.path)}
            />
          ))}
        </HomeModuleCard>
      );
    case 'launchpad':
      return (
        <HomeModuleCard
          title={module.title ?? renderModuleLabel(module.moduleId)}
          subtitle={module.description ?? 'Jump across the rest of the shell.'}
        >
          {host.launchpad.slice(0, limit).map((item) => (
            <HomeActionRow
              key={item.id}
              label={item.label}
              meta={item.description}
              icon={renderLaunchpadIcon(item.panelId)}
              onClick={() => host.openPanel(item.panelId)}
            />
          ))}
        </HomeModuleCard>
      );
    default:
      return (
        <HomeModuleCard
          title={module.title ?? renderModuleLabel(module.moduleId)}
          subtitle={module.description ?? 'This module id is not supported by the host catalog yet.'}
        >
          <div style={{ fontSize: 12, color: 'var(--overlay-text-muted)' }}>
            Unknown module id: <code>{module.moduleId}</code>
          </div>
        </HomeModuleCard>
      );
  }
}

function ExplorerHomePresetSurface({
  pack,
  host,
}: {
  pack: LoadedExplorerHomePack;
  host: ExplorerHomePackHost;
}) {
  const activePreset = resolveActivePreset(pack, host.activePresetId);
  const modules = activePreset?.modules ?? [];

  return (
    <div style={{ display: 'grid', gap: 18, padding: '18px 20px 28px' }}>
      <section
        style={{
          borderRadius: 24,
          padding: 20,
          border: '1px solid var(--overlay-explorer-chip-border)',
          background: 'linear-gradient(180deg, rgba(13,18,31,0.96) 0%, rgba(7,10,18,0.99) 100%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--overlay-accent)',
              }}
            >
              Explorer Home
            </div>
            <h2 style={{ marginTop: 10, fontSize: 28, lineHeight: 1.05, color: 'var(--overlay-text-primary)' }}>
              {pack.name}
            </h2>
            <p style={{ marginTop: 8, maxWidth: 780, fontSize: 12, lineHeight: 1.65, color: 'var(--overlay-text-muted)' }}>
              {pack.description ?? 'Manifest-driven home pack using the built-in host module catalog.'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {pack.runtime.presets.length > 1 && (
              <select
                value={activePreset?.id ?? ''}
                onChange={(event) => host.setPreset(event.target.value || null)}
                style={{
                  minHeight: 36,
                  borderRadius: 12,
                  border: '1px solid var(--overlay-explorer-chip-border)',
                  background: 'var(--overlay-explorer-chip-bg)',
                  color: 'var(--overlay-text-primary)',
                  padding: '0 12px',
                  fontSize: 11,
                }}
              >
                {pack.runtime.presets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={() => host.openSettingsSection('home')}
              style={{
                minHeight: 36,
                padding: '0 12px',
                borderRadius: 12,
                border: '1px solid var(--overlay-explorer-chip-border)',
                background: 'var(--overlay-explorer-chip-bg)',
                color: 'var(--overlay-text-primary)',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              Customize Home
            </button>
          </div>
        </div>
      </section>

      {modules.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 18,
          }}
        >
          {modules.map((module) => (
            <React.Fragment key={module.id}>
              {renderPresetModule(module, host)}
            </React.Fragment>
          ))}
        </div>
      ) : (
        <HomeModuleCard title="Empty Preset" subtitle="This Home preset does not define any modules yet.">
          <div style={{ fontSize: 12, color: 'var(--overlay-text-muted)' }}>
            Add modules to the active preset or switch to another preset from Settings.
          </div>
        </HomeModuleCard>
      )}
    </div>
  );
}

function renderFallbackSurface(message: string) {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: 280, padding: 24 }}>
      <div
        style={{
          maxWidth: 620,
          borderRadius: 20,
          border: '1px solid var(--overlay-explorer-chip-border)',
          background: 'linear-gradient(180deg, rgba(17,22,35,0.96) 0%, rgba(9,12,20,0.99) 100%)',
          padding: 24,
          color: 'var(--overlay-text-primary)',
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--overlay-accent)' }}>
          Explorer Home
        </div>
        <div style={{ marginTop: 10, fontSize: 18, fontWeight: 700 }}>
          Home pack fallback
        </div>
        <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.6, color: 'var(--overlay-text-muted)' }}>
          {message}
        </div>
      </div>
    </div>
  );
}

export function ExplorerHomeSurface({
  appearance,
  packs,
  requestedPackId,
  themeDefaultPackId = null,
  activePresetIdByPackId,
  usageTrackingEnabled,
  quickAccess,
  bookmarks,
  mostUsedFolders,
  recentFolders,
  savedSearches,
  drives,
  tasks,
  launchpad,
  packState,
  onNavigate,
  onOpenSavedSearch,
  onOpenPanel,
  onOpenSettingsSection,
  onRefresh,
  onUpdatePackState,
  onSetPreset,
}: ExplorerHomeSurfaceProps) {
  const selection = useMemo(
    () => resolveExplorerHomePackSelection({
      packs,
      requestedPackId,
      themeDefaultPackId,
    }),
    [packs, requestedPackId, themeDefaultPackId],
  );
  const activePack = selection.activePack;
  const activePresetId = activePack
    ? (typeof activePresetIdByPackId[activePack.id] === 'string'
      ? activePresetIdByPackId[activePack.id]
      : activePresetIdByPackId[activePack.id] === null
        ? null
        : null)
    : null;

  const host = useMemo<ExplorerHomePackHost | null>(() => {
    if (!activePack) {
      return null;
    }

    return createExplorerHomeHost(
      {
        appearance,
        activePresetId,
        usageTrackingEnabled,
        quickAccess,
        bookmarks,
        mostUsedFolders,
        recentFolders,
        savedSearches,
        drives,
        tasks,
        launchpad,
        packState,
        packWarnings: selection.warnings,
        diagnostics: {
          isFallback: selection.isFallback,
          authoredPackCount: selection.authoredPackCount,
          selectedPackError: selection.selectedPackError,
        },
      },
      {
        navigate: onNavigate,
        openSavedSearch: onOpenSavedSearch,
        openPanel: onOpenPanel,
        openSettingsSection: onOpenSettingsSection,
        refresh: onRefresh,
        updatePackState: onUpdatePackState,
        setPreset: onSetPreset,
      },
    );
  }, [
    activePack,
    activePresetId,
    activePresetIdByPackId,
    appearance,
    bookmarks,
    drives,
    launchpad,
    mostUsedFolders,
    onNavigate,
    onOpenPanel,
    onOpenSavedSearch,
    onOpenSettingsSection,
    onRefresh,
    onSetPreset,
    onUpdatePackState,
    packState,
    quickAccess,
    recentFolders,
    savedSearches,
    selection.authoredPackCount,
    selection.isFallback,
    selection.selectedPackError,
    selection.warnings,
    tasks,
    usageTrackingEnabled,
  ]);

  if (!activePack || !host) {
    return renderFallbackSurface(
      'No Home packs are currently available. Open Settings -> Home to inspect the runtime catalog.',
    );
  }

  const packContext: ExplorerHomePackContext = activePack.runtime;
  const fallback = (
    <ExplorerHomePresetSurface
      pack={activePack}
      host={host}
    />
  );

  if (!activePack.runtime.component) {
    return fallback;
  }

  return (
    <ExplorerHomePackBoundary
      pack={activePack.runtime}
      fallback={fallback}
      onError={() => {
        console.warn(`GreebleFS: falling back to preset renderer for home pack ${activePack.id}`);
      }}
      render={(Component) => (
        <Component
          pack={packContext}
          host={host}
        />
      )}
    />
  );
}
