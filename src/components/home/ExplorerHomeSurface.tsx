import React, { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  ArrowRight,
  FolderOpen,
  HardDrive,
  LayoutGrid,
  Puzzle,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  StickyNote,
  Terminal,
} from '@/components/AppIcons';
import { AppSelect } from '../AppSelect';

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
  ExplorerHomeActionItem,
  ExplorerHomeLaunchpadItem,
  ExplorerHomePackContext,
  ExplorerHomePackHost,
  ExplorerHomePackModuleLayout,
  ExplorerHomePackPresetDefinition,
  ExplorerHomeUsageEntry,
  ExplorerHomeViewportState,
  ExplorerHomeWidgetItem,
} from './homePackRuntime';
import { ExplorerHomePackBoundary } from './homePackRuntime';

const FALLBACK_EXPLORER_HOME_PACK_ID = 'magnum-opus';

const explorerHomeSurfaceShellStyle: CSSProperties = {
  width: '100%',
  maxWidth: '100%',
  minWidth: 0,
  minHeight: '100%',
  boxSizing: 'border-box',
  overflowX: 'hidden',
  containerType: 'inline-size',
  background: 'var(--overlay-explorer-content-bg)',
};

export interface ExplorerHomeHostData {
  appearance: ResolvedOverlayAppearance;
  viewport: ExplorerHomeViewportState;
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
  actions: ExplorerHomeActionItem[];
  widgets: ExplorerHomeWidgetItem[];
  packState: Record<string, unknown>;
  packWarnings: string[];
  diagnostics: ExplorerHomePackHost['diagnostics'];
}

export interface ExplorerHomeHostActions {
  navigate: (path: string) => void;
  openSavedSearch: (savedSearch: ExplorerSavedSearch) => void;
  openPanel: (panelId: string) => void;
  openSettingsSection: (section: SettingsSectionKey) => void;
  runAction: (actionId: string) => void;
  renderWidget: (widgetId: string, slotId?: string) => React.ReactNode;
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
  actions: ExplorerHomeActionItem[];
  widgets: ExplorerHomeWidgetItem[];
  packState: Record<string, unknown>;
  onNavigate: (path: string) => void;
  onOpenSavedSearch: (savedSearch: ExplorerSavedSearch) => void;
  onOpenPanel: (panelId: string) => void;
  onOpenSettingsSection: (section: SettingsSectionKey) => void;
  onRunAction: (actionId: string) => void;
  onRenderWidget: (widgetId: string, slotId?: string) => React.ReactNode;
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

function createExplorerHomeViewportState(width: number): ExplorerHomeViewportState {
  const measuredWidth = Number.isFinite(width) ? Math.max(0, Math.round(width)) : 0;
  return {
    width: measuredWidth,
    density: measuredWidth > 0 && measuredWidth < 560
      ? 'narrow'
      : measuredWidth > 0 && measuredWidth < 920
        ? 'compact'
        : 'wide',
  };
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
      description: 'Integrated shell',
      panelId: 'terminal',
    },
    {
      id: 'launchpad-settings',
      label: 'Settings',
      description: 'Control deck',
      panelId: 'settings',
    },
    {
      id: 'launchpad-plugins',
      label: 'Plugins',
      description: 'Runtime extensions',
      panelId: 'plugins',
    },
    {
      id: 'launchpad-notes',
      label: 'Notes',
      description: 'Notes surface',
      panelId: 'notes',
    },
    {
      id: 'launchpad-storage',
      label: 'Storage',
      description: 'Storage map',
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
    viewport: data.viewport,
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
    actions: data.actions,
    widgets: data.widgets,
    packState: data.packState,
    packWarnings: data.packWarnings,
    diagnostics: data.diagnostics,
    navigate: actions.navigate,
    openSavedSearch: actions.openSavedSearch,
    openPanel: actions.openPanel,
    openSettingsSection: actions.openSettingsSection,
    runAction: actions.runAction,
    renderWidget: actions.renderWidget,
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
    case 'actions':
      return 'Actions';
    case 'widgets':
      return 'Widgets';
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
        minWidth: 0,
        borderRadius: 8,
        border: '1px solid var(--overlay-explorer-chip-border)',
        background: 'color-mix(in srgb, var(--overlay-explorer-content-bg) 88%, black 12%)',
        padding: 10,
        display: 'grid',
        gap: 9,
        boxSizing: 'border-box',
      }}
    >
      <div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--overlay-accent)',
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div style={{ marginTop: 4, fontSize: 10, lineHeight: 1.35, color: 'var(--overlay-text-muted)' }}>
            {subtitle}
          </div>
        ) : null}
      </div>
      <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
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
  disabled = false,
}: {
  label: string;
  meta: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        width: '100%',
        minWidth: 0,
        minHeight: 34,
        padding: '7px 9px',
        borderRadius: 7,
        border: '1px solid var(--overlay-explorer-chip-border)',
        background: 'var(--overlay-explorer-chip-bg)',
        color: disabled ? 'var(--overlay-text-dim)' : 'var(--overlay-text-primary)',
        textAlign: 'left',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.64 : 1,
        boxSizing: 'border-box',
      }}
    >
      <span style={{ color: 'var(--overlay-accent)', display: 'inline-flex', flexShrink: 0 }}>{icon}</span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontSize: 11, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </span>
        <span
          style={{
            display: 'block',
            marginTop: 2,
            fontSize: 10,
            lineHeight: 1.25,
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
      <ArrowRight size={12} style={{ color: 'var(--overlay-text-dim)', flexShrink: 0 }} />
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
    case 'actions': {
      const preferredActions = host.actions
        .filter((action) => action.canRunFromHome)
        .slice(0, limit);
      const fallbackActions = preferredActions.length > 0
        ? preferredActions
        : host.actions.slice(0, limit);
      return (
        <HomeModuleCard
          title={module.title ?? renderModuleLabel(module.moduleId)}
          subtitle={module.description}
        >
          {fallbackActions.length > 0 ? fallbackActions.map((action) => (
            <HomeActionRow
              key={action.id}
              label={action.title}
              meta={`${action.presentationKind} · ${action.sourceBadgeLabel}`}
              icon={<Sparkles size={15} />}
              disabled={!action.canRunFromHome}
              onClick={() => host.runAction(action.id)}
            />
          )) : (
            <div style={{ fontSize: 10, color: 'var(--overlay-text-muted)' }}>
              No actions loaded
            </div>
          )}
        </HomeModuleCard>
      );
    }
    case 'widgets':
      return (
        <HomeModuleCard
          title={module.title ?? renderModuleLabel(module.moduleId)}
          subtitle={module.description}
        >
          {host.widgets.slice(0, limit).map((widget) => {
            const widgetNode = widget.canRenderInHome
              ? host.renderWidget(widget.id, `${module.id}:${widget.id}`)
              : null;
            return (
              <div
                key={widget.id}
                style={{
                  minWidth: 0,
                  borderRadius: 7,
                  border: '1px solid var(--overlay-explorer-chip-border)',
                  background: 'var(--overlay-explorer-chip-bg)',
                  padding: widgetNode ? 6 : '7px 9px',
                  overflow: 'hidden',
                }}
              >
                {widgetNode ?? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <LayoutGrid size={14} style={{ color: 'var(--overlay-accent)', flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {widget.shortLabel || widget.title}
                      </div>
                      <div style={{ marginTop: 2, fontSize: 10, color: 'var(--overlay-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {widget.category}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {host.widgets.length === 0 ? (
            <div style={{ fontSize: 10, color: 'var(--overlay-text-muted)' }}>
              No widgets loaded
            </div>
          ) : null}
        </HomeModuleCard>
      );
    default:
      return (
        <HomeModuleCard
          title={module.title ?? renderModuleLabel(module.moduleId)}
          subtitle={module.description}
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
  const surfaceIsNarrow = host.viewport.density === 'narrow';

  return (
    <div style={{ display: 'grid', gap: 10, padding: '10px', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box' }}>
      <section
        style={{
          minWidth: 0,
          borderRadius: 8,
          padding: 10,
          border: '1px solid var(--overlay-explorer-chip-border)',
          background: 'color-mix(in srgb, var(--overlay-explorer-content-bg) 90%, black 10%)',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--overlay-accent)',
              }}
            >
              {activePreset?.name ?? 'Home'}
            </div>
            <h2 style={{ marginTop: 4, fontSize: 18, lineHeight: 1.1, color: 'var(--overlay-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {pack.name}
            </h2>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {pack.runtime.presets.length > 1 && (
              <AppSelect
                value={activePreset?.id ?? ''}
                onChange={(event) => host.setPreset(event.target.value || null)}
                style={{
                  minHeight: 30,
                  borderRadius: 7,
                  border: '1px solid var(--overlay-explorer-chip-border)',
                  background: 'var(--overlay-explorer-chip-bg)',
                  color: 'var(--overlay-text-primary)',
                  padding: '0 8px',
                  fontSize: 11,
                }}
              >
                {pack.runtime.presets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </AppSelect>
            )}
            <button
              type="button"
              onClick={() => host.openSettingsSection('home')}
              style={{
                minHeight: 30,
                padding: '0 9px',
                borderRadius: 7,
                border: '1px solid var(--overlay-explorer-chip-border)',
                background: 'var(--overlay-explorer-chip-bg)',
                color: 'var(--overlay-text-primary)',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              Tune
            </button>
          </div>
        </div>
      </section>

      {modules.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: surfaceIsNarrow
              ? 'minmax(0, 1fr)'
              : 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
            gap: 10,
            minWidth: 0,
          }}
        >
          {modules.map((module) => (
            <React.Fragment key={module.id}>
              {renderPresetModule(module, host)}
            </React.Fragment>
          ))}
        </div>
      ) : (
        <HomeModuleCard title="Empty Preset">
          <div style={{ fontSize: 12, color: 'var(--overlay-text-muted)' }}>
            No modules
          </div>
        </HomeModuleCard>
      )}
    </div>
  );
}

function renderFallbackSurface(message: string) {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: 180, padding: 12, minWidth: 0 }}>
      <div
        style={{
          width: 'min(100%, 420px)',
          borderRadius: 8,
          border: '1px solid var(--overlay-explorer-chip-border)',
          background: 'var(--overlay-explorer-chip-bg)',
          padding: 12,
          color: 'var(--overlay-text-primary)',
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--overlay-accent)' }}>
          Explorer Home
        </div>
        <div style={{ marginTop: 6, fontSize: 13, fontWeight: 700 }}>
          Home pack unavailable
        </div>
        <div style={{ marginTop: 6, fontSize: 11, lineHeight: 1.45, color: 'var(--overlay-text-muted)' }}>
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
  actions,
  widgets,
  packState,
  onNavigate,
  onOpenSavedSearch,
  onOpenPanel,
  onOpenSettingsSection,
  onRunAction,
  onRenderWidget,
  onRefresh,
  onUpdatePackState,
  onSetPreset,
}: ExplorerHomeSurfaceProps) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const [measuredViewportWidth, setMeasuredViewportWidth] = useState(0);
  const viewport = useMemo(
    () => createExplorerHomeViewportState(measuredViewportWidth),
    [measuredViewportWidth],
  );
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

  useEffect(() => {
    const node = surfaceRef.current;
    if (!node) {
      return undefined;
    }

    const updateWidth = () => {
      const nextWidth = Math.round(node.getBoundingClientRect().width);
      setMeasuredViewportWidth((currentWidth) => (
        currentWidth === nextWidth ? currentWidth : nextWidth
      ));
    };

    updateWidth();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateWidth);
      return () => window.removeEventListener('resize', updateWidth);
    }

    const observer = new ResizeObserver(updateWidth);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const host = useMemo<ExplorerHomePackHost | null>(() => {
    if (!activePack) {
      return null;
    }

    return createExplorerHomeHost(
      {
        appearance,
        viewport,
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
        actions,
        widgets,
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
        runAction: onRunAction,
        renderWidget: onRenderWidget,
        refresh: onRefresh,
        updatePackState: onUpdatePackState,
        setPreset: onSetPreset,
      },
    );
  }, [
    actions,
    activePack,
    activePresetId,
    appearance,
    bookmarks,
    drives,
    launchpad,
    mostUsedFolders,
    onNavigate,
    onOpenPanel,
    onOpenSavedSearch,
    onOpenSettingsSection,
    onRunAction,
    onRenderWidget,
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
    viewport,
    widgets,
  ]);

  if (!activePack || !host) {
    return (
      <div ref={surfaceRef} data-overlay-explorer-home-surface style={explorerHomeSurfaceShellStyle}>
        {renderFallbackSurface(
          'No Home packs are currently available. Open Settings -> Home to inspect the runtime catalog.',
        )}
      </div>
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
    return (
      <div ref={surfaceRef} data-overlay-explorer-home-surface style={explorerHomeSurfaceShellStyle}>
        {fallback}
      </div>
    );
  }

  return (
    <div ref={surfaceRef} data-overlay-explorer-home-surface style={explorerHomeSurfaceShellStyle}>
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
    </div>
  );
}
