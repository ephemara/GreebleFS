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
  Star,
  StickyNote,
  Terminal,
  WandSparkles,
} from 'lucide-react';
import { defineHomePack } from 'greeblefs-home-pack';

const MOODS = {
  blueberry: {
    accent: '#73B9FF',
    accentSoft: 'rgba(115, 185, 255, 0.18)',
    secondary: '#FFD36B',
    spotlight:
      'radial-gradient(circle at 18% 16%, rgba(197,225,255,0.86), transparent 24%), radial-gradient(circle at 82% 16%, rgba(255,214,226,0.74), transparent 24%), linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(255,246,236,0.98) 100%)',
  },
  peach: {
    accent: '#FF9BB0',
    accentSoft: 'rgba(255, 155, 176, 0.16)',
    secondary: '#8DB6FF',
    spotlight:
      'radial-gradient(circle at 18% 16%, rgba(255,214,226,0.82), transparent 24%), radial-gradient(circle at 82% 16%, rgba(255,235,179,0.78), transparent 24%), linear-gradient(180deg, rgba(255,251,246,0.94) 0%, rgba(255,241,228,0.98) 100%)',
  },
  mint: {
    accent: '#78D4AB',
    accentSoft: 'rgba(120, 212, 171, 0.16)',
    secondary: '#8F9DFF',
    spotlight:
      'radial-gradient(circle at 18% 16%, rgba(188,235,203,0.82), transparent 24%), radial-gradient(circle at 82% 16%, rgba(197,225,255,0.78), transparent 24%), linear-gradient(180deg, rgba(255,252,247,0.94) 0%, rgba(244,255,247,0.98) 100%)',
  },
};

const PANEL_ICONS = {
  explorer: FolderOpen,
  terminal: Terminal,
  settings: Settings2,
  plugins: Puzzle,
  notes: StickyNote,
  storage: HardDrive,
};

function pickMood(host) {
  const moodId =
    typeof host.packState.mood === 'string' && MOODS[host.packState.mood]
      ? host.packState.mood
      : 'blueberry';
  return MOODS[moodId];
}

function pickSourceLane(host) {
  return host.packState.sourceLane === 'quick-access' ? 'quick-access' : 'bookmarks';
}

function formatRelativeTime(timestamp) {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return 'cold';
  }

  const deltaMs = Date.now() - timestamp;
  if (deltaMs < 60_000) {
    return 'just now';
  }
  if (deltaMs < 3_600_000) {
    return `${Math.max(1, Math.round(deltaMs / 60_000))}m ago`;
  }
  if (deltaMs < 86_400_000) {
    return `${Math.max(1, Math.round(deltaMs / 3_600_000))}h ago`;
  }
  return `${Math.max(1, Math.round(deltaMs / 86_400_000))}d ago`;
}

function cardGradient(mood, index) {
  const shift = (index % 4) * 8;
  return `linear-gradient(${136 + shift}deg, ${mood.accentSoft} 0%, rgba(255,255,255,0.88) 52%, rgba(255,245,236,0.94) 100%)`;
}

function getRunwayItems(host) {
  const sourceLane = pickSourceLane(host);
  const bookmarkItems = host.bookmarks.map((bookmark, index) => ({
    id: `bookmark:${bookmark.id}`,
    label: bookmark.label,
    path: bookmark.path,
    eyebrow: `Bookmark ${String(index + 1).padStart(2, '0')}`,
    meta: bookmark.path,
    sourceLane: 'bookmarks',
  }));
  const quickItems = host.quickAccess.map((item, index) => ({
    id: `quick:${item.id}`,
    label: item.label,
    path: item.path,
    eyebrow: `Quick Access ${String(index + 1).padStart(2, '0')}`,
    meta: item.description || item.path,
    sourceLane: 'quick-access',
  }));

  if (sourceLane === 'quick-access' && quickItems.length > 0) {
    return quickItems;
  }
  if (bookmarkItems.length > 0) {
    return bookmarkItems;
  }
  return quickItems;
}

function getSelectedRunwayItem(host, items) {
  const selectedId =
    typeof host.packState.selectedCardId === 'string' ? host.packState.selectedCardId : '';
  return items.find(item => item.id === selectedId) || items[0] || null;
}

function ControlChip({ active, label, onClick, mood }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        minHeight: 34,
        padding: '0 12px',
        borderRadius: 999,
        border: `1px solid ${active ? mood.accent : 'rgba(109, 125, 166, 0.14)'}`,
        background: active ? mood.accentSoft : 'rgba(255,255,255,0.72)',
        color: '#2D3348',
        fontSize: 11,
        fontWeight: 800,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

function SectionCard({ title, accent, children }) {
  return (
    <section
      style={{
        borderRadius: 26,
        border: '1px solid rgba(109, 125, 166, 0.14)',
        background: 'rgba(255,255,255,0.74)',
        boxShadow: '0 16px 36px rgba(95, 104, 154, 0.12)',
        padding: 16,
        display: 'grid',
        gap: 12,
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          fontWeight: 900,
          color: accent,
        }}
      >
        {title}
      </div>
      {children}
    </section>
  );
}

function ToonClubhouseSettings({ host }) {
  const mood = pickMood(host);
  const sourceLane = pickSourceLane(host);
  const showLaunchpad = host.packState.showLaunchpad !== false;
  const showTelemetry = host.packState.showTelemetry !== false;
  const currentMood =
    typeof host.packState.mood === 'string' && MOODS[host.packState.mood]
      ? host.packState.mood
      : 'blueberry';

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ fontSize: 11, lineHeight: 1.65, color: 'var(--overlay-text-muted)' }}>
        Toon Clubhouse is the bright editorial home pack for the `toon` bundle. It keeps persistent pack state, leans on saved searches and launchpad actions, and proves that a theme-owned Home surface can feel authored rather than generic.
      </div>

      <div>
        <div
          style={{
            marginBottom: 8,
            fontSize: 10,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: mood.accent,
          }}
        >
          Runway Source
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <ControlChip
            active={sourceLane === 'bookmarks'}
            label="Bookmarks"
            onClick={() => host.updatePackState({ sourceLane: 'bookmarks', selectedCardId: null })}
            mood={mood}
          />
          <ControlChip
            active={sourceLane === 'quick-access'}
            label="Quick Access"
            onClick={() => host.updatePackState({ sourceLane: 'quick-access', selectedCardId: null })}
            mood={mood}
          />
        </div>
      </div>

      <div>
        <div
          style={{
            marginBottom: 8,
            fontSize: 10,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: mood.accent,
          }}
        >
          Mood
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {Object.keys(MOODS).map(moodId => (
            <ControlChip
              key={moodId}
              active={currentMood === moodId}
              label={moodId[0].toUpperCase() + moodId.slice(1)}
              onClick={() => host.updatePackState({ mood: moodId })}
              mood={mood}
            />
          ))}
        </div>
      </div>

      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
          borderRadius: 18,
          border: '1px solid rgba(109, 125, 166, 0.14)',
          background: 'rgba(255,255,255,0.72)',
          padding: '12px 14px',
        }}
      >
        <span>
          <span style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--overlay-text-primary)' }}>
            Show launchpad wall
          </span>
          <span style={{ display: 'block', marginTop: 4, fontSize: 11, color: 'var(--overlay-text-muted)' }}>
            Keep the app route buttons visible under the saved-search stickers.
          </span>
        </span>
        <input
          type="checkbox"
          checked={showLaunchpad}
          onChange={event => host.updatePackState({ showLaunchpad: event.target.checked })}
        />
      </label>

      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
          borderRadius: 18,
          border: '1px solid rgba(109, 125, 166, 0.14)',
          background: 'rgba(255,255,255,0.72)',
          padding: '12px 14px',
        }}
      >
        <span>
          <span style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--overlay-text-primary)' }}>
            Show telemetry lane
          </span>
          <span style={{ display: 'block', marginTop: 4, fontSize: 11, color: 'var(--overlay-text-muted)' }}>
            Toggle between the recent and most-used folder strips at the bottom.
          </span>
        </span>
        <input
          type="checkbox"
          checked={showTelemetry}
          onChange={event => host.updatePackState({ showTelemetry: event.target.checked })}
        />
      </label>
    </div>
  );
}

function ToonClubhouse({ host }) {
  const mood = pickMood(host);
  const runwayItems = getRunwayItems(host);
  const selectedItem = getSelectedRunwayItem(host, runwayItems);
  const recentFolders = host.recentFolders.slice(0, 4);
  const mostUsedFolders = host.mostUsedFolders.slice(0, 4);
  const savedSearches = host.savedSearches.slice(0, 4);
  const launchpad = host.packState.showLaunchpad === false ? [] : host.launchpad.slice(0, 4);
  const drives = host.drives.slice(0, 4);
  const visibleUsage = host.packState.showTelemetry === false ? mostUsedFolders : recentFolders;
  const activeTask = host.tasks.find(task => task.status === 'running') || host.tasks[0] || null;

  return (
    <div
      style={{
        minHeight: '100%',
        padding: '24px 24px 34px',
        display: 'grid',
        gap: 16,
        background:
          'radial-gradient(circle at 16% 10%, rgba(255,255,255,0.36), transparent 24%), radial-gradient(circle at 84% 8%, rgba(255,214,226,0.24), transparent 24%), linear-gradient(180deg, rgba(255,248,240,0.96) 0%, rgba(255,238,223,0.98) 100%)',
      }}
    >
      <section
        style={{
          borderRadius: 34,
          border: '1px solid rgba(109, 125, 166, 0.14)',
          background: mood.spotlight,
          boxShadow: '0 28px 60px rgba(95, 104, 154, 0.16)',
          padding: 22,
          display: 'grid',
          gap: 18,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 'auto -8% -16% auto',
            width: 320,
            height: 320,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${mood.accentSoft}, transparent 72%)`,
            filter: 'blur(16px)',
            pointerEvents: 'none',
          }}
        />

        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ maxWidth: 780 }}>
            <div
              style={{
                fontSize: 10,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                fontWeight: 900,
                color: mood.secondary,
              }}
            >
              Toon Clubhouse
            </div>
            <h2 style={{ marginTop: 10, fontSize: 36, lineHeight: 0.96, color: '#2D3348' }}>
              A bright folder runway with stickers, routes, and live explorer pulse.
            </h2>
            <p style={{ marginTop: 12, maxWidth: 780, fontSize: 13, lineHeight: 1.7, color: 'rgba(69, 80, 107, 0.8)' }}>
              This home pack is the theme-owned showcase surface for Toon: persistent runway selection, saved-search stickers, launchpad routes, task pulse, and real pack settings.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <ControlChip
              active={pickSourceLane(host) === 'bookmarks'}
              label="Bookmarks"
              onClick={() => host.updatePackState({ sourceLane: 'bookmarks', selectedCardId: null })}
              mood={mood}
            />
            <ControlChip
              active={pickSourceLane(host) === 'quick-access'}
              label="Quick Access"
              onClick={() => host.updatePackState({ sourceLane: 'quick-access', selectedCardId: null })}
              mood={mood}
            />
            <button
              type="button"
              onClick={() => host.openSettingsSection('home')}
              style={{
                minHeight: 34,
                padding: '0 12px',
                borderRadius: 999,
                border: '1px solid rgba(109, 125, 166, 0.14)',
                background: 'rgba(255,255,255,0.78)',
                color: '#2D3348',
                fontSize: 11,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Pack Settings
            </button>
          </div>
        </div>

        <div
          style={{
            position: 'relative',
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.14fr) minmax(280px, 0.86fr)',
            gap: 16,
            alignItems: 'stretch',
          }}
        >
          <div
            style={{
              borderRadius: 30,
              border: '1px solid rgba(109, 125, 166, 0.14)',
              background: 'rgba(255,255,255,0.72)',
              padding: 20,
              minHeight: 320,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 'auto -8% -16% auto',
                width: 260,
                height: 260,
                borderRadius: '50%',
                background: `radial-gradient(circle, ${mood.accentSoft}, transparent 72%)`,
                filter: 'blur(12px)',
                pointerEvents: 'none',
              }}
            />

            {selectedItem ? (
              <div style={{ position: 'relative', display: 'grid', gap: 18, height: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ maxWidth: 620 }}>
                    <div
                      style={{
                        fontSize: 10,
                        letterSpacing: '0.16em',
                        textTransform: 'uppercase',
                        color: mood.secondary,
                      }}
                    >
                      {selectedItem.eyebrow}
                    </div>
                    <div style={{ marginTop: 12, fontSize: 40, lineHeight: 0.96, fontWeight: 900, color: '#2D3348' }}>
                      {selectedItem.label}
                    </div>
                    <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.75, color: 'rgba(69, 80, 107, 0.76)' }}>
                      {selectedItem.meta}
                    </div>
                  </div>
                  <Star size={18} color={mood.secondary} />
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: 10,
                  }}
                >
                  {[
                    {
                      label: 'Source',
                      value: selectedItem.sourceLane === 'bookmarks' ? 'Bookmarks' : 'Quick Access',
                    },
                    {
                      label: 'Last Seen',
                      value:
                        host.recentFolders.find(entry => entry.path === selectedItem.path)
                          ? formatRelativeTime(
                              host.recentFolders.find(entry => entry.path === selectedItem.path).lastOpenedAt,
                            )
                          : 'Waiting for visits',
                    },
                    {
                      label: 'Nearby Routes',
                      value: `${host.launchpad.length} launch routes`,
                    },
                  ].map((stat, index) => (
                    <div
                      key={stat.label}
                      style={{
                        borderRadius: 18,
                        border: '1px solid rgba(109, 125, 166, 0.14)',
                        background: cardGradient(mood, index),
                        padding: '13px 13px 12px',
                      }}
                    >
                      <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(69, 80, 107, 0.6)' }}>
                        {stat.label}
                      </div>
                      <div style={{ marginTop: 10, fontSize: 14, fontWeight: 900, color: '#2D3348' }}>
                        {stat.value}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 'auto' }}>
                  <button
                    type="button"
                    onClick={() => host.navigate(selectedItem.path)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      minHeight: 40,
                      padding: '0 14px',
                      borderRadius: 14,
                      border: 'none',
                      background: mood.accent,
                      color: '#112238',
                      fontSize: 11,
                      fontWeight: 900,
                      cursor: 'pointer',
                    }}
                  >
                    <FolderOpen size={14} />
                    Open Folder
                  </button>
                  <button
                    type="button"
                    onClick={() => host.openPanel('terminal')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      minHeight: 40,
                      padding: '0 14px',
                      borderRadius: 14,
                      border: '1px solid rgba(109, 125, 166, 0.14)',
                      background: 'rgba(255,255,255,0.82)',
                      color: '#2D3348',
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    <Terminal size={14} />
                    Terminal
                  </button>
                  <button
                    type="button"
                    onClick={() => host.refresh()}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      minHeight: 40,
                      padding: '0 14px',
                      borderRadius: 14,
                      border: '1px solid rgba(109, 125, 166, 0.14)',
                      background: 'rgba(255,255,255,0.82)',
                      color: '#2D3348',
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    <RefreshCw size={14} />
                    Refresh
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 13, lineHeight: 1.7, color: 'rgba(69, 80, 107, 0.76)' }}>
                Toon Clubhouse needs bookmarks or quick access destinations before it can build the runway.
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            {runwayItems.slice(0, 6).map((item, index) => {
              const active = selectedItem && selectedItem.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => host.updatePackState({ selectedCardId: item.id })}
                  style={{
                    borderRadius: 20,
                    border: `1px solid ${active ? mood.accent : 'rgba(109, 125, 166, 0.14)'}`,
                    background: active ? cardGradient(mood, index) : 'rgba(255,255,255,0.72)',
                    boxShadow: active ? '0 16px 34px rgba(95, 104, 154, 0.14)' : '0 10px 24px rgba(95, 104, 154, 0.08)',
                    padding: '14px 14px 13px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transform: active ? 'translateX(-6px)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: mood.secondary }}>
                        {item.eyebrow}
                      </div>
                      <div style={{ marginTop: 8, fontSize: 14, fontWeight: 900, color: '#2D3348', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.label}
                      </div>
                      <div style={{ marginTop: 5, fontSize: 11, color: 'rgba(69, 80, 107, 0.66)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.meta}
                      </div>
                    </div>
                    <ArrowRight size={15} color={active ? mood.accent : 'rgba(69, 80, 107, 0.56)'} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 14,
        }}
      >
        <SectionCard title="Saved Search Stickers" accent={mood.secondary}>
          {savedSearches.length > 0 ? (
            savedSearches.map((savedSearch, index) => (
              <button
                key={savedSearch.id}
                type="button"
                onClick={() => host.openSavedSearch(savedSearch)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  borderRadius: 18,
                  border: '1px solid rgba(109, 125, 166, 0.14)',
                  background: cardGradient(mood, index),
                  padding: '12px 12px 11px',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: '#2D3348', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {savedSearch.name}
                  </div>
                  <div style={{ marginTop: 5, fontSize: 11, color: 'rgba(69, 80, 107, 0.66)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {savedSearch.searchMode} · {savedSearch.rootPath}
                  </div>
                </div>
                <Search size={14} color={mood.secondary} />
              </button>
            ))
          ) : (
            <div style={{ fontSize: 12, color: 'rgba(69, 80, 107, 0.68)' }}>
              Save a few recursive searches and the Clubhouse gives them sticker slots.
            </div>
          )}
        </SectionCard>

        <SectionCard title="Launchpad Wall" accent={mood.accent}>
          {launchpad.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              {launchpad.map((item, index) => {
                const Icon = PANEL_ICONS[item.panelId] || LayoutGrid;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => host.openPanel(item.panelId)}
                    style={{
                      borderRadius: 18,
                      border: '1px solid rgba(109, 125, 166, 0.14)',
                      background: cardGradient(mood, index),
                      padding: '12px 12px 11px',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <Icon size={15} color={mood.accent} />
                    <div style={{ marginTop: 9, fontSize: 12, fontWeight: 900, color: '#2D3348' }}>{item.label}</div>
                    <div style={{ marginTop: 5, fontSize: 11, lineHeight: 1.5, color: 'rgba(69, 80, 107, 0.66)' }}>
                      {item.description}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'rgba(69, 80, 107, 0.68)' }}>
              Hide the launchpad wall in pack settings if you want a stricter editorial surface.
            </div>
          )}
        </SectionCard>

        <SectionCard title="Pulse + Drives" accent={mood.secondary}>
          {activeTask ? (
            <div
              style={{
                borderRadius: 18,
                border: '1px solid rgba(109, 125, 166, 0.14)',
                background: 'rgba(255,255,255,0.82)',
                padding: 14,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: '#2D3348' }}>{activeTask.title}</div>
                <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: mood.accent }}>
                  {activeTask.status}
                </div>
              </div>
              <div style={{ marginTop: 6, fontSize: 11, color: 'rgba(69, 80, 107, 0.68)' }}>
                {activeTask.detail ?? 'Explorer task in progress.'}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'rgba(69, 80, 107, 0.68)' }}>
              No active explorer task right now. The pulse tile wakes up as soon as background work starts.
            </div>
          )}

          <div style={{ display: 'grid', gap: 10 }}>
            {drives.slice(0, 3).map((drive, index) => (
              <button
                key={`${drive.kind}:${drive.id}`}
                type="button"
                onClick={() => host.navigate(drive.path)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  borderRadius: 18,
                  border: '1px solid rgba(109, 125, 166, 0.14)',
                  background: cardGradient(mood, index),
                  padding: '12px 12px 11px',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: '#2D3348', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {drive.label}
                  </div>
                  <div style={{ marginTop: 5, fontSize: 11, color: 'rgba(69, 80, 107, 0.66)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {drive.path}
                  </div>
                </div>
                <HardDrive size={15} color={mood.secondary} />
              </button>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard title={host.packState.showTelemetry === false ? 'Most Used Ribbon' : 'Recent Ribbon'} accent={mood.accent}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          {visibleUsage.map((entry, index) => (
            <button
              key={`${entry.path}:${index}`}
              type="button"
              onClick={() => host.navigate(entry.path)}
              style={{
                borderRadius: 18,
                border: '1px solid rgba(109, 125, 166, 0.14)',
                background: cardGradient(mood, index),
                padding: '12px 12px 11px',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 900, color: '#2D3348', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {entry.label}
              </div>
              <div style={{ marginTop: 5, fontSize: 11, color: 'rgba(69, 80, 107, 0.66)' }}>
                {host.packState.showTelemetry === false
                  ? `${entry.openCount} opens`
                  : `last seen ${formatRelativeTime(entry.lastOpenedAt)}`}
              </div>
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => host.openPanel('plugins')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              minHeight: 36,
              padding: '0 12px',
              borderRadius: 14,
              border: '1px solid rgba(109, 125, 166, 0.14)',
              background: 'rgba(255,255,255,0.82)',
              color: '#2D3348',
              fontSize: 11,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            <WandSparkles size={14} />
            Plugins
          </button>
          <button
            type="button"
            onClick={() => host.openPanel('notes')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              minHeight: 36,
              padding: '0 12px',
              borderRadius: 14,
              border: '1px solid rgba(109, 125, 166, 0.14)',
              background: 'rgba(255,255,255,0.82)',
              color: '#2D3348',
              fontSize: 11,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            <Sparkles size={14} />
            Notes
          </button>
        </div>
      </SectionCard>
    </div>
  );
}

export const homePack = defineHomePack({
  id: 'toon-clubhouse',
  name: 'Toon Clubhouse',
  description:
    'Theme-owned pastel runway for favorite folders, saved-search stickers, and live explorer pulse.',
  supportsLiveSwap: true,
  component: ToonClubhouse,
  settingsComponent: ToonClubhouseSettings,
});
