import React from 'react';
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
  Zap,
} from '@/components/AppIcons';

import {
  createLoadedExplorerHomePackRuntime,
  type ExplorerHomePackRendererProps,
  type ExplorerHomePackSettingsProps,
  type ExplorerHomeUsageEntry,
  type LoadedExplorerHomePackRuntime,
} from './homePackRuntime';

const runtimeFilePath = 'builtin:explorer-home-pack';

function formatRelativeTime(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return 'cold';
  }

  const elapsedMs = Math.max(0, Date.now() - timestamp);
  const elapsedMinutes = Math.round(elapsedMs / 60000);
  if (elapsedMinutes < 1) {
    return 'now';
  }
  if (elapsedMinutes < 60) {
    return `${elapsedMinutes}m`;
  }
  const elapsedHours = Math.round(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return `${elapsedHours}h`;
  }
  return `${Math.round(elapsedHours / 24)}d`;
}

function getDriveUsageLabel(drive: { kind?: string; provider?: string; total_bytes?: number | null; free_bytes?: number | null }): string {
  if (drive.kind === 'cloud') {
    return drive.provider ? `${drive.provider}` : 'cloud';
  }

  const totalBytes = typeof drive.total_bytes === 'number' ? drive.total_bytes : 0;
  const freeBytes = typeof drive.free_bytes === 'number' ? drive.free_bytes : 0;
  if (totalBytes <= 0) {
    return 'local';
  }

  return `${Math.round(((totalBytes - freeBytes) / totalBytes) * 100)}%`;
}

function isTaskActive(status: string): boolean {
  return !['completed', 'succeeded', 'success', 'cancelled', 'canceled'].includes(status);
}

function renderLaunchpadIcon(panelId: string) {
  switch (panelId) {
    case 'terminal':
      return <Terminal size={14} />;
    case 'settings':
      return <Settings2 size={14} />;
    case 'plugins':
      return <Puzzle size={14} />;
    case 'notes':
      return <StickyNote size={14} />;
    case 'storage':
      return <HardDrive size={14} />;
    default:
      return <LayoutGrid size={14} />;
  }
}

function selectFocusFolders(
  lane: unknown,
  mostUsedFolders: ExplorerHomeUsageEntry[],
  recentFolders: ExplorerHomeUsageEntry[],
): ExplorerHomeUsageEntry[] {
  if (lane === 'recent') {
    return recentFolders;
  }
  if (lane === 'most-used') {
    return mostUsedFolders;
  }
  return mostUsedFolders.length > 0 ? mostUsedFolders : recentFolders;
}

function CompactSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
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
        gap: 8,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minWidth: 0 }}>
        <div
          style={{
            minWidth: 0,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--overlay-accent)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function HomeRouteButton({
  label,
  meta,
  icon,
  onClick,
  strong = false,
}: {
  label: string;
  meta: string;
  icon: React.ReactNode;
  onClick: () => void;
  strong?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        minWidth: 0,
        minHeight: strong ? 42 : 34,
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        borderRadius: 7,
        border: strong
          ? '1px solid color-mix(in srgb, var(--overlay-accent) 44%, var(--overlay-explorer-chip-border))'
          : '1px solid var(--overlay-explorer-chip-border)',
        background: strong
          ? 'color-mix(in srgb, var(--overlay-accent) 14%, var(--overlay-explorer-chip-bg))'
          : 'var(--overlay-explorer-chip-bg)',
        color: 'var(--overlay-text-primary)',
        padding: strong ? '8px 10px' : '7px 9px',
        textAlign: 'left',
        cursor: 'pointer',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      <span style={{ display: 'inline-flex', color: 'var(--overlay-accent)', flexShrink: 0 }}>
        {icon}
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontSize: strong ? 12 : 11, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </span>
        <span style={{ display: 'block', marginTop: 2, fontSize: 10, color: 'var(--overlay-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {meta}
        </span>
      </span>
      <ArrowRight size={12} style={{ color: 'var(--overlay-text-dim)', flexShrink: 0 }} />
    </button>
  );
}

function MetricCell({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        minWidth: 0,
        borderRadius: 7,
        border: '1px solid var(--overlay-explorer-chip-border)',
        background: 'var(--overlay-explorer-chip-bg)',
        padding: '7px 8px',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ fontSize: 9, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--overlay-text-dim)' }}>
        {label}
      </div>
      <div style={{ marginTop: 4, fontSize: 16, fontWeight: 900, color: 'var(--overlay-text-primary)' }}>
        {value}
      </div>
    </div>
  );
}

function TinyButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      style={{
        minHeight: 30,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderRadius: 7,
        border: '1px solid var(--overlay-explorer-chip-border)',
        background: 'var(--overlay-explorer-chip-bg)',
        color: 'var(--overlay-text-primary)',
        padding: '0 8px',
        fontSize: 10,
        fontWeight: 800,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function ToggleChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        minHeight: 28,
        borderRadius: 7,
        border: active
          ? '1px solid var(--overlay-accent)'
          : '1px solid var(--overlay-explorer-chip-border)',
        background: active
          ? 'color-mix(in srgb, var(--overlay-accent) 18%, transparent)'
          : 'var(--overlay-explorer-chip-bg)',
        color: 'var(--overlay-text-primary)',
        padding: '0 8px',
        fontSize: 10,
        fontWeight: 800,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

function MagnumOpusSettings({ host }: ExplorerHomePackSettingsProps) {
  const focusLane = host.packState.focusLane === 'recent'
    ? 'recent'
    : host.packState.focusLane === 'most-used'
      ? 'most-used'
      : 'smart';
  const showActions = host.packState.showActions !== false;
  const showWidgets = host.packState.showWidgets !== false;

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {[
          ['smart', 'Smart'],
          ['most-used', 'Used'],
          ['recent', 'Recent'],
        ].map(([id, label]) => (
          <ToggleChip
            key={id}
            active={focusLane === id}
            label={label}
            onClick={() => host.updatePackState({ focusLane: id })}
          />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <ToggleChip
          active={showActions}
          label="Actions"
          onClick={() => host.updatePackState({ showActions: !showActions })}
        />
        <ToggleChip
          active={showWidgets}
          label="Widgets"
          onClick={() => host.updatePackState({ showWidgets: !showWidgets })}
        />
      </div>
    </div>
  );
}

function MagnumOpusHome({ host }: ExplorerHomePackRendererProps) {
  const focusLane = host.packState.focusLane;
  const focusFolders = selectFocusFolders(focusLane, host.mostUsedFolders, host.recentFolders);
  const primaryFolder = focusFolders[0] ?? null;
  const quickRoutes = [
    ...focusFolders.slice(0, 4).map((entry) => ({
      id: `focus:${entry.path}`,
      label: entry.label,
      meta: `${entry.openCount}x · ${formatRelativeTime(entry.lastOpenedAt)}`,
      path: entry.path,
    })),
    ...host.quickAccess.slice(0, 4).map((item) => ({
      id: `quick:${item.id}`,
      label: item.label,
      meta: item.description ?? item.path,
      path: item.path,
    })),
  ];
  const uniqueQuickRoutes = Array.from(
    new Map(quickRoutes.map((route) => [route.path, route])).values(),
  ).slice(0, host.viewport.density === 'narrow' ? 5 : 8);
  const activeTasks = host.tasks.filter((task) => isTaskActive(task.status)).slice(0, 3);
  const runnableActions = host.actions.filter((action) => action.canRunFromHome).slice(0, 5);
  const visibleWidgets = host.widgets.filter((widget) => widget.canRenderInHome).slice(0, 2);
  const showActions = host.packState.showActions !== false;
  const showWidgets = host.packState.showWidgets !== false;
  const isWide = host.viewport.density === 'wide';

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '100%',
        minHeight: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        display: 'grid',
        gap: 10,
        padding: 10,
        overflowX: 'hidden',
      }}
    >
      <CompactSection
        title="Home"
        action={(
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <TinyButton label="Refresh" icon={<RefreshCw size={12} />} onClick={() => host.refresh()} />
            <TinyButton label="Tune" icon={<Settings2 size={12} />} onClick={() => host.openSettingsSection('home')} />
          </div>
        )}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 120px), 1fr))',
            gap: 7,
            minWidth: 0,
          }}
        >
          <MetricCell label="Routes" value={String(host.quickAccess.length + host.bookmarks.length)} />
          <MetricCell label="Actions" value={String(host.actions.length)} />
          <MetricCell label="Widgets" value={String(host.widgets.length)} />
          <MetricCell label="Tasks" value={String(activeTasks.length)} />
        </div>
        {primaryFolder ? (
          <HomeRouteButton
            strong
            label={primaryFolder.label}
            meta={`${primaryFolder.openCount} opens · ${formatRelativeTime(primaryFolder.lastOpenedAt)}`}
            icon={<Zap size={15} />}
            onClick={() => host.navigate(primaryFolder.path)}
          />
        ) : host.quickAccess[0] ? (
          <HomeRouteButton
            strong
            label={host.quickAccess[0].label}
            meta={host.quickAccess[0].description ?? host.quickAccess[0].path}
            icon={<FolderOpen size={15} />}
            onClick={() => host.navigate(host.quickAccess[0].path)}
          />
        ) : null}
      </CompactSection>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isWide
            ? 'minmax(0, 1.15fr) minmax(220px, 0.85fr)'
            : 'minmax(0, 1fr)',
          gap: 10,
          minWidth: 0,
        }}
      >
        <CompactSection title="Routes">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))',
              gap: 6,
              minWidth: 0,
            }}
          >
            {uniqueQuickRoutes.map((route) => (
              <HomeRouteButton
                key={route.id}
                label={route.label}
                meta={route.meta}
                icon={<FolderOpen size={14} />}
                onClick={() => host.navigate(route.path)}
              />
            ))}
          </div>
        </CompactSection>

        <CompactSection title="Launch">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 118px), 1fr))',
              gap: 6,
              minWidth: 0,
            }}
          >
            {host.launchpad.slice(0, 6).map((item) => (
              <HomeRouteButton
                key={item.id}
                label={item.label}
                meta={item.description}
                icon={renderLaunchpadIcon(item.panelId)}
                onClick={() => host.openPanel(item.panelId)}
              />
            ))}
          </div>
        </CompactSection>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isWide
            ? 'repeat(3, minmax(0, 1fr))'
            : 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
          gap: 10,
          minWidth: 0,
        }}
      >
        <CompactSection title="Search">
          <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
            {host.savedSearches.slice(0, 4).map((savedSearch) => (
              <HomeRouteButton
                key={savedSearch.id}
                label={savedSearch.name}
                meta={`${savedSearch.searchMode} · ${savedSearch.rootPath}`}
                icon={<Search size={14} />}
                onClick={() => host.openSavedSearch(savedSearch)}
              />
            ))}
            {host.savedSearches.length === 0 ? (
              <span style={{ fontSize: 10, color: 'var(--overlay-text-muted)' }}>No saved searches</span>
            ) : null}
          </div>
        </CompactSection>

        <CompactSection title="Drives">
          <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
            {host.drives.slice(0, 4).map((drive) => (
              <HomeRouteButton
                key={drive.id}
                label={drive.label}
                meta={`${getDriveUsageLabel(drive)} · ${drive.path}`}
                icon={<HardDrive size={14} />}
                onClick={() => host.navigate(drive.path)}
              />
            ))}
          </div>
        </CompactSection>

        <CompactSection title="Tasks">
          <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
            {activeTasks.length > 0 ? activeTasks.map((task) => (
              <HomeRouteButton
                key={task.id}
                label={task.title}
                meta={task.detail ?? task.status}
                icon={<RefreshCw size={14} />}
                onClick={() => host.openPanel('explorer')}
              />
            )) : (
              <span style={{ fontSize: 10, color: 'var(--overlay-text-muted)' }}>Quiet</span>
            )}
          </div>
        </CompactSection>
      </div>

      {(showActions || showWidgets) ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: showActions && showWidgets && isWide
              ? 'minmax(0, 0.9fr) minmax(0, 1.1fr)'
              : 'minmax(0, 1fr)',
            gap: 10,
            minWidth: 0,
          }}
        >
          {showActions ? (
            <CompactSection title="Actions">
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))',
                  gap: 6,
                  minWidth: 0,
                }}
              >
                {runnableActions.length > 0 ? runnableActions.map((action) => (
                  <HomeRouteButton
                    key={action.id}
                    label={action.title}
                    meta={`${action.presentationKind} · ${action.sourceBadgeLabel}`}
                    icon={<Sparkles size={14} />}
                    onClick={() => host.runAction(action.id)}
                  />
                )) : (
                  <span style={{ fontSize: 10, color: 'var(--overlay-text-muted)' }}>No runnable actions</span>
                )}
              </div>
            </CompactSection>
          ) : null}

          {showWidgets ? (
            <CompactSection title="Widgets">
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))',
                  gap: 6,
                  minWidth: 0,
                }}
              >
                {visibleWidgets.length > 0 ? visibleWidgets.map((widget) => {
                  const renderedWidget = host.renderWidget(widget.id, `magnum:${widget.id}`);
                  return (
                    <div
                      key={widget.id}
                      style={{
                        minWidth: 0,
                        borderRadius: 7,
                        border: '1px solid var(--overlay-explorer-chip-border)',
                        background: 'var(--overlay-explorer-chip-bg)',
                        padding: renderedWidget ? 6 : '7px 9px',
                        overflow: 'hidden',
                      }}
                    >
                      {renderedWidget ?? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <LayoutGrid size={14} style={{ color: 'var(--overlay-accent)', flexShrink: 0 }} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 11, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                }) : (
                  <span style={{ fontSize: 10, color: 'var(--overlay-text-muted)' }}>No widgets mounted</span>
                )}
              </div>
            </CompactSection>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function createBuiltInHomeRuntime(input: {
  id: string;
  name: string;
  description: string;
  defaultPresetId: string;
}): LoadedExplorerHomePackRuntime {
  return createLoadedExplorerHomePackRuntime(
    {
      id: input.id,
      name: input.name,
      description: input.description,
      supportsLiveSwap: true,
      defaultPresetId: input.defaultPresetId,
      presets: [
        {
          id: 'compact',
          name: 'Compact',
          modules: [
            { id: 'quick-access', moduleId: 'quick-access', limit: 6 },
            { id: 'launchpad', moduleId: 'launchpad', limit: 6 },
            { id: 'actions', moduleId: 'actions', limit: 5 },
            { id: 'widgets', moduleId: 'widgets', limit: 2 },
          ],
        },
        {
          id: 'ops',
          name: 'Ops',
          modules: [
            { id: 'most-used', moduleId: 'most-used-folders', limit: 6 },
            { id: 'task-center', moduleId: 'task-center', limit: 4 },
            { id: 'saved-searches', moduleId: 'saved-searches', limit: 4 },
            { id: 'drives', moduleId: 'drives', limit: 4 },
          ],
        },
      ],
      component: MagnumOpusHome,
      settingsComponent: MagnumOpusSettings,
    },
    {
      id: input.id,
      name: input.name,
      filePath: runtimeFilePath,
      packRoot: runtimeFilePath,
      entryModule: 'builtin',
    },
  );
}

export function getBuiltInExplorerHomePacks(): LoadedExplorerHomePackRuntime[] {
  return [
    createBuiltInHomeRuntime({
      id: 'magnum-opus',
      name: 'Magnum Opus',
      description: 'Compact action, widget, folder, and task surface.',
      defaultPresetId: 'compact',
    }),
    createBuiltInHomeRuntime({
      id: 'command-center',
      name: 'Command Center',
      description: 'Compact operational Home surface.',
      defaultPresetId: 'ops',
    }),
    createBuiltInHomeRuntime({
      id: 'favorites-deck',
      name: 'Favorites Deck',
      description: 'Compact favorite-folder Home surface.',
      defaultPresetId: 'compact',
    }),
  ];
}
