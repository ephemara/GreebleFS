import React from 'react';
import {
  ArrowRight,
  FolderOpen,
  HardDrive,
  LayoutGrid,
  Puzzle,
  Search,
  Settings2,
  Sparkles,
  StickyNote,
  Terminal,
} from '@/components/AppIcons';

import {
  createLoadedExplorerHomePackRuntime,
  type ExplorerHomeBookmarkItem,
  type ExplorerHomePackRendererProps,
  type ExplorerHomePackSettingsProps,
  type LoadedExplorerHomePackRuntime,
} from './homePackRuntime';

const runtimeFilePath = 'builtin:explorer-home-pack';

function formatRelativeTime(timestamp: number): string {
  if (!timestamp) {
    return 'Never';
  }

  const elapsedMs = Math.max(0, Date.now() - timestamp);
  const elapsedMinutes = Math.round(elapsedMs / 60000);
  if (elapsedMinutes < 1) {
    return 'Just now';
  }
  if (elapsedMinutes < 60) {
    return `${elapsedMinutes}m ago`;
  }
  const elapsedHours = Math.round(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return `${elapsedHours}h ago`;
  }
  const elapsedDays = Math.round(elapsedHours / 24);
  return `${elapsedDays}d ago`;
}

function HomeSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        border: '1px solid var(--overlay-explorer-chip-border)',
        borderRadius: 18,
        background: 'color-mix(in srgb, var(--overlay-explorer-content-bg) 86%, black 14%)',
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--overlay-accent)' }}>
          {title}
        </div>
        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--overlay-text-muted)' }}>
          {subtitle}
        </div>
      </div>
      {children}
    </section>
  );
}

function HomeListRow({
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
        alignItems: 'center',
        gap: 12,
        width: '100%',
        padding: '12px 14px',
        borderRadius: 14,
        border: '1px solid var(--overlay-explorer-chip-border)',
        background: 'color-mix(in srgb, var(--overlay-explorer-chip-bg) 88%, white 12%)',
        color: 'var(--overlay-text-primary)',
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      <span style={{ display: 'inline-flex', color: 'var(--overlay-accent)' }}>{icon}</span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {label}
        </span>
        <span style={{ display: 'block', marginTop: 3, fontSize: 11, color: 'var(--overlay-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {meta}
        </span>
      </span>
      <ArrowRight size={12} style={{ color: 'var(--overlay-text-dim)' }} />
    </button>
  );
}

function renderBookmarkLabel(bookmark: ExplorerHomeBookmarkItem): string {
  return bookmark.label || bookmark.path;
}

function CommandCenterSettings({ host }: ExplorerHomePackSettingsProps) {
  const emphasis = typeof host.packState.emphasis === 'string' ? host.packState.emphasis : 'most-used';

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ fontSize: 11, color: 'var(--overlay-text-muted)' }}>
        Command Center can bias the hero strip toward either the most-used or recent telemetry lane.
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {[
          { id: 'most-used', label: 'Most Used' },
          { id: 'recent', label: 'Recent' },
        ].map(option => {
          const active = emphasis === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => host.updatePackState({ emphasis: option.id })}
              style={{
                padding: '8px 10px',
                borderRadius: 12,
                border: `1px solid ${active ? 'var(--overlay-accent)' : 'var(--overlay-explorer-chip-border)'}`,
                background: active
                  ? 'color-mix(in srgb, var(--overlay-accent) 18%, transparent)'
                  : 'var(--overlay-explorer-chip-bg)',
                color: 'var(--overlay-text-primary)',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FavoritesDeckSettings({ host }: ExplorerHomePackSettingsProps) {
  const showTelemetry = host.packState.showTelemetry !== false;

  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '10px 12px',
        borderRadius: 12,
        border: '1px solid var(--overlay-explorer-chip-border)',
        background: 'var(--overlay-explorer-chip-bg)',
      }}
    >
      <span>
        <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--overlay-text-primary)' }}>
          Show usage telemetry lane
        </span>
        <span style={{ display: 'block', marginTop: 4, fontSize: 11, color: 'var(--overlay-text-muted)' }}>
          Keep the deck focused on favorites only, or add the recent/most-used strip underneath.
        </span>
      </span>
      <input
        type="checkbox"
        checked={showTelemetry}
        onChange={(event) => host.updatePackState({ showTelemetry: event.target.checked })}
      />
    </label>
  );
}

function CommandCenterPack({ host }: ExplorerHomePackRendererProps) {
  const emphasis = typeof host.packState.emphasis === 'string' ? host.packState.emphasis : 'most-used';
  const heroEntries = (emphasis === 'recent' ? host.recentFolders : host.mostUsedFolders).slice(0, 4);
  const recentTasks = host.tasks.slice(0, 4);

  return (
    <div style={{ display: 'grid', gap: 18, padding: '18px 20px 28px' }}>
      <section
        style={{
          borderRadius: 24,
          padding: 22,
          border: '1px solid color-mix(in srgb, var(--overlay-accent) 32%, var(--overlay-explorer-chip-border))',
          background: 'linear-gradient(140deg, color-mix(in srgb, var(--overlay-accent) 18%, rgba(7,10,18,0.98)) 0%, rgba(9,12,20,0.96) 58%, rgba(5,7,13,0.98) 100%)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.34)',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18 }}>
          <div style={{ maxWidth: 640 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--overlay-accent)' }}>
              Command Center
            </div>
            <h2 style={{ marginTop: 10, fontSize: 30, lineHeight: 1.05, color: 'var(--overlay-text-primary)' }}>
              Home is a cockpit now.
            </h2>
            <p style={{ marginTop: 10, fontSize: 13, lineHeight: 1.6, color: 'var(--overlay-text-muted)' }}>
              Surface the folders you actually use, keep live task state visible, and jump across the rest of the shell without burning time on a dead landing page.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(100px, 1fr))', gap: 10, minWidth: 320 }}>
            {[
              { label: 'Quick Access', value: String(host.quickAccess.length) },
              { label: 'Saved Searches', value: String(host.savedSearches.length) },
              { label: 'Launchpad', value: String(host.launchpad.length) },
            ].map(stat => (
              <div
                key={stat.label}
                style={{
                  borderRadius: 16,
                  border: '1px solid color-mix(in srgb, white 12%, transparent)',
                  background: 'rgba(255,255,255,0.04)',
                  padding: '14px 12px',
                }}
              >
                <div style={{ fontSize: 10, color: 'var(--overlay-text-dim)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                  {stat.label}
                </div>
                <div style={{ marginTop: 10, fontSize: 24, fontWeight: 800, color: 'var(--overlay-text-primary)' }}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          {heroEntries.length > 0 ? heroEntries.map(entry => (
            <HomeListRow
              key={`${entry.path}:${entry.lastOpenedAt}`}
              label={entry.label}
              meta={`${entry.openCount} opens · ${formatRelativeTime(entry.lastOpenedAt)}`}
              icon={<FolderOpen size={15} />}
              onClick={() => host.navigate(entry.path)}
            />
          )) : (
            <div style={{ padding: 14, borderRadius: 14, border: '1px dashed var(--overlay-explorer-chip-border)', color: 'var(--overlay-text-muted)', fontSize: 12 }}>
              Folder usage fills in automatically as you move through real directories.
            </div>
          )}
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 18 }}>
        <HomeSection title="Quick Access" subtitle="Platform shortcuts that should always stay one hit away.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            {host.quickAccess.map(item => (
              <HomeListRow
                key={item.id}
                label={item.label}
                meta={item.description ?? item.path}
                icon={<FolderOpen size={15} />}
                onClick={() => host.navigate(item.path)}
              />
            ))}
          </div>
        </HomeSection>

        <HomeSection title="Launchpad" subtitle="Open the rest of the shell from the same landing surface.">
          <div style={{ display: 'grid', gap: 10 }}>
            {host.launchpad.map(item => (
              <HomeListRow
                key={item.id}
                label={item.label}
                meta={item.description}
                icon={
                  item.panelId === 'terminal' ? <Terminal size={15} /> :
                    item.panelId === 'notes' ? <StickyNote size={15} /> :
                      item.panelId === 'settings' ? <Settings2 size={15} /> :
                        item.panelId === 'plugins' ? <Puzzle size={15} /> :
                          item.panelId === 'storage' ? <HardDrive size={15} /> :
                            <LayoutGrid size={15} />
                }
                onClick={() => host.openPanel(item.panelId)}
              />
            ))}
          </div>
        </HomeSection>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '0.95fr 1.05fr', gap: 18 }}>
        <HomeSection title="Bookmarks" subtitle="Pinned folders and favorite lanes from the explorer rail.">
          <div style={{ display: 'grid', gap: 10 }}>
            {host.bookmarks.slice(0, 6).map(bookmark => (
              <HomeListRow
                key={bookmark.id}
                label={renderBookmarkLabel(bookmark)}
                meta={bookmark.path}
                icon={<Sparkles size={15} />}
                onClick={() => host.navigate(bookmark.path)}
              />
            ))}
          </div>
        </HomeSection>

        <HomeSection title="Task Center" subtitle="Recent file operations and background explorer work.">
          <div style={{ display: 'grid', gap: 10 }}>
            {recentTasks.length > 0 ? recentTasks.map(task => (
              <div
                key={task.id}
                style={{
                  padding: '12px 14px',
                  borderRadius: 14,
                  border: '1px solid var(--overlay-explorer-chip-border)',
                  background: 'var(--overlay-explorer-chip-bg)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--overlay-text-primary)' }}>
                    {task.title}
                  </span>
                  <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: task.status === 'running' ? 'var(--overlay-warning)' : task.status === 'succeeded' ? 'var(--overlay-success)' : 'var(--overlay-text-dim)' }}>
                    {task.status}
                  </span>
                </div>
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--overlay-text-muted)' }}>
                  {task.detail ?? 'Explorer task in progress.'}
                </div>
              </div>
            )) : (
              <div style={{ padding: 14, borderRadius: 14, border: '1px dashed var(--overlay-explorer-chip-border)', color: 'var(--overlay-text-muted)', fontSize: 12 }}>
                Recent operations will appear here once the explorer task feed starts moving.
              </div>
            )}
          </div>
        </HomeSection>
      </div>
    </div>
  );
}

function FavoritesDeckPack({ host }: ExplorerHomePackRendererProps) {
  const showTelemetry = host.packState.showTelemetry !== false;

  return (
    <div style={{ display: 'grid', gap: 18, padding: '18px 20px 28px' }}>
      <section
        style={{
          borderRadius: 24,
          padding: 20,
          border: '1px solid var(--overlay-explorer-chip-border)',
          background: 'linear-gradient(180deg, rgba(12,17,27,0.96) 0%, rgba(7,10,18,0.98) 100%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--overlay-accent)' }}>
              Favorites Deck
            </div>
            <h2 style={{ marginTop: 8, fontSize: 26, lineHeight: 1.1, color: 'var(--overlay-text-primary)' }}>
              Swipe through the folders that matter.
            </h2>
          </div>
          <button
            type="button"
            onClick={() => host.openSettingsSection('home')}
            style={{
              padding: '10px 12px',
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

        <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          {[...host.bookmarks.slice(0, 4), ...host.quickAccess.slice(0, 2).map(item => ({
            id: item.id,
            label: item.label,
            path: item.path,
            color: null,
            categoryIds: [],
          }))].map(card => (
            <button
              key={card.id}
              type="button"
              onClick={() => host.navigate(card.path)}
              style={{
                minHeight: 180,
                padding: 18,
                borderRadius: 22,
                border: '1px solid color-mix(in srgb, var(--overlay-accent) 28%, var(--overlay-explorer-chip-border))',
                background: 'radial-gradient(circle at top left, color-mix(in srgb, var(--overlay-accent) 24%, transparent) 0%, rgba(255,255,255,0.02) 46%, rgba(4,6,12,0.7) 100%)',
                color: 'var(--overlay-text-primary)',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'inline-flex', padding: 10, borderRadius: 14, background: 'rgba(255,255,255,0.06)', color: 'var(--overlay-accent)' }}>
                <FolderOpen size={18} />
              </div>
              <div style={{ marginTop: 42, fontSize: 18, fontWeight: 800, lineHeight: 1.1 }}>
                {renderBookmarkLabel(card)}
              </div>
              <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.5, color: 'var(--overlay-text-muted)' }}>
                {card.path}
              </div>
            </button>
          ))}
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <HomeSection title="Saved Searches" subtitle="Pinned search workflows keep one-click recall.">
          <div style={{ display: 'grid', gap: 10 }}>
            {host.savedSearches.slice(0, 5).map(search => (
              <HomeListRow
                key={search.id}
                label={search.name}
                meta={`${search.searchMode} · ${search.rootPath}`}
                icon={<Search size={15} />}
                onClick={() => host.openSavedSearch(search)}
              />
            ))}
          </div>
        </HomeSection>

        <HomeSection title="Drives + Roots" subtitle="Local roots and cloud entries still stay visible from the deck.">
          <div style={{ display: 'grid', gap: 10 }}>
            {host.drives.slice(0, 6).map(drive => (
              <HomeListRow
                key={drive.id}
                label={drive.label}
                meta={drive.path}
                icon={<HardDrive size={15} />}
                onClick={() => host.navigate(drive.path)}
              />
            ))}
          </div>
        </HomeSection>
      </div>

      {showTelemetry && (
        <HomeSection title="Telemetry Strip" subtitle="Recent and most-used folder lanes, kept compact under the deck.">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ display: 'grid', gap: 10 }}>
              {host.recentFolders.slice(0, 4).map(entry => (
                <HomeListRow
                  key={`recent-${entry.path}`}
                  label={entry.label}
                  meta={formatRelativeTime(entry.lastOpenedAt)}
                  icon={<FolderOpen size={15} />}
                  onClick={() => host.navigate(entry.path)}
                />
              ))}
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {host.mostUsedFolders.slice(0, 4).map(entry => (
                <HomeListRow
                  key={`most-used-${entry.path}`}
                  label={entry.label}
                  meta={`${entry.openCount} opens`}
                  icon={<Sparkles size={15} />}
                  onClick={() => host.navigate(entry.path)}
                />
              ))}
            </div>
          </div>
        </HomeSection>
      )}
    </div>
  );
}

export function getBuiltInExplorerHomePacks(): LoadedExplorerHomePackRuntime[] {
  return [
    createLoadedExplorerHomePackRuntime(
      {
        id: 'command-center',
        name: 'Command Center',
        description: 'Dense operational cockpit for quick-access folders, task activity, and cross-shell launch surfaces.',
        supportsLiveSwap: true,
        defaultPresetId: 'cockpit',
        presets: [
          {
            id: 'cockpit',
            name: 'Cockpit',
            description: 'Hero telemetry strip with dense operational sections underneath.',
            modules: [
              { id: 'quick-access', moduleId: 'quick-access', style: 'hero' },
              { id: 'launchpad', moduleId: 'launchpad', style: 'grid' },
              { id: 'bookmarks', moduleId: 'bookmarks', style: 'list' },
              { id: 'task-center', moduleId: 'task-center', style: 'dense' },
            ],
          },
          {
            id: 'navigator',
            name: 'Navigator',
            description: 'Slightly flatter browsing-biased pass of the same pack.',
            modules: [
              { id: 'bookmarks', moduleId: 'bookmarks', style: 'cards' },
              { id: 'saved-searches', moduleId: 'saved-searches', style: 'list' },
              { id: 'drives', moduleId: 'drives', style: 'list' },
            ],
          },
        ],
        component: CommandCenterPack,
        settingsComponent: CommandCenterSettings,
      },
      {
        id: 'command-center',
        name: 'Command Center',
        filePath: runtimeFilePath,
        packRoot: runtimeFilePath,
        entryModule: 'builtin',
      },
    ),
    createLoadedExplorerHomePackRuntime(
      {
        id: 'favorites-deck',
        name: 'Favorites Deck',
        description: 'Card-forward favorite-folder deck with saved-search and drive lanes.',
        supportsLiveSwap: true,
        defaultPresetId: 'carousel',
        presets: [
          {
            id: 'carousel',
            name: 'Carousel',
            description: 'Hero favorite cards with compact utility lanes below.',
            modules: [
              { id: 'bookmarks', moduleId: 'bookmarks', style: 'cards' },
              { id: 'saved-searches', moduleId: 'saved-searches', style: 'list' },
              { id: 'drives', moduleId: 'drives', style: 'dense' },
            ],
          },
          {
            id: 'atlas',
            name: 'Atlas',
            description: 'Flatter grid for favorites plus telemetry strip.',
            modules: [
              { id: 'quick-access', moduleId: 'quick-access', style: 'grid' },
              { id: 'recent-folders', moduleId: 'recent-folders', style: 'list' },
              { id: 'most-used-folders', moduleId: 'most-used-folders', style: 'list' },
            ],
          },
        ],
        component: FavoritesDeckPack,
        settingsComponent: FavoritesDeckSettings,
      },
      {
        id: 'favorites-deck',
        name: 'Favorites Deck',
        filePath: runtimeFilePath,
        packRoot: runtimeFilePath,
        entryModule: 'builtin',
      },
    ),
  ];
}
