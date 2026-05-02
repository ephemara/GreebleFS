import {
  ArrowRight,
  FolderOpen,
  HardDrive,
  LayoutGrid,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  Star,
  Terminal,
} from 'lucide-react';
import { defineHomePack } from 'greeblefs-home-pack';

const MOODS = {
  sunrise: {
    accent: '#ff7b7b',
    accentSoft: 'rgba(255, 123, 123, 0.18)',
    secondary: '#ffd36c',
    shell:
      'radial-gradient(circle at 12% 12%, rgba(255, 173, 110, 0.18), transparent 26%), radial-gradient(circle at 84% 14%, rgba(255, 107, 152, 0.18), transparent 28%), linear-gradient(145deg, rgba(36, 16, 24, 0.98), rgba(18, 12, 24, 0.99) 58%, rgba(10, 12, 18, 0.99))',
  },
  midnight: {
    accent: '#89a7ff',
    accentSoft: 'rgba(137, 167, 255, 0.18)',
    secondary: '#64f2ff',
    shell:
      'radial-gradient(circle at 12% 12%, rgba(119, 170, 255, 0.16), transparent 26%), radial-gradient(circle at 84% 14%, rgba(100, 242, 255, 0.16), transparent 26%), linear-gradient(145deg, rgba(12, 20, 38, 0.98), rgba(10, 13, 26, 0.99) 58%, rgba(7, 10, 17, 0.99))',
  },
  mint: {
    accent: '#74f0b8',
    accentSoft: 'rgba(116, 240, 184, 0.16)',
    secondary: '#d8ff72',
    shell:
      'radial-gradient(circle at 12% 12%, rgba(116, 240, 184, 0.16), transparent 26%), radial-gradient(circle at 84% 14%, rgba(216, 255, 114, 0.16), transparent 26%), linear-gradient(145deg, rgba(10, 28, 24, 0.98), rgba(9, 18, 18, 0.99) 58%, rgba(7, 10, 17, 0.99))',
  },
};

const PANEL_ICONS = {
  terminal: Terminal,
  settings: Settings2,
  plugins: LayoutGrid,
  notes: Sparkles,
  storage: HardDrive,
};

function pickMood(host) {
  const moodId =
    typeof host.packState.mood === 'string' && MOODS[host.packState.mood]
      ? host.packState.mood
      : 'midnight';
  return MOODS[moodId];
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

function getDeckItems(host) {
  const preferredSource =
    host.packState.sourceLane === 'quick-access' ? 'quick-access' : 'bookmarks';
  const bookmarkItems = host.bookmarks.map((bookmark, index) => ({
    id: `bookmark:${bookmark.id}`,
    label: bookmark.label,
    path: bookmark.path,
    eyebrow: `Bookmark ${String(index + 1).padStart(2, '0')}`,
    meta: bookmark.path,
    sourceLane: 'bookmarks',
  }));
  const quickAccessItems = host.quickAccess.map((item, index) => ({
    id: `quick:${item.id}`,
    label: item.label,
    path: item.path,
    eyebrow: `Quick Access ${String(index + 1).padStart(2, '0')}`,
    meta: item.description || item.path,
    sourceLane: 'quick-access',
  }));

  if (preferredSource === 'bookmarks' && bookmarkItems.length > 0) {
    return bookmarkItems;
  }
  if (preferredSource === 'quick-access' && quickAccessItems.length > 0) {
    return quickAccessItems;
  }
  return bookmarkItems.length > 0 ? bookmarkItems : quickAccessItems;
}

function getSelectedDeckItem(host, items) {
  const selectedId =
    typeof host.packState.selectedItemId === 'string' ? host.packState.selectedItemId : '';
  return items.find((item) => item.id === selectedId) || items[0] || null;
}

function cardGradient(mood, index) {
  const shift = (index % 4) * 9;
  return `linear-gradient(${140 + shift}deg, ${mood.accentSoft} 0%, rgba(255,255,255,0.04) 58%, rgba(255,255,255,0.02) 100%)`;
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
        border: `1px solid ${active ? mood.accent : 'rgba(255,255,255,0.1)'}`,
        background: active ? mood.accentSoft : 'rgba(255,255,255,0.03)',
        color: active ? '#f8fbff' : 'rgba(225,232,240,0.78)',
        fontSize: 11,
        fontWeight: 700,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

function PrismSwitchboardSettings({ host }) {
  const mood = pickMood(host);
  const sourceLane = host.packState.sourceLane === 'quick-access' ? 'quick-access' : 'bookmarks';
  const currentMood =
    typeof host.packState.mood === 'string' && MOODS[host.packState.mood]
      ? host.packState.mood
      : 'midnight';
  const showTelemetry = host.packState.showTelemetry !== false;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ fontSize: 11, lineHeight: 1.65, color: 'var(--overlay-text-muted)' }}>
        Prism Switchboard is the expressive card-switcher example. It exists to prove Home packs can keep persistent local state and feel more like a curated shell scene than a dashboard.
      </div>

      <div>
        <div style={{ marginBottom: 8, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: mood.accent }}>
          Deck Source
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <ControlChip
            active={sourceLane === 'bookmarks'}
            label="Bookmarks"
            onClick={() => host.updatePackState({ sourceLane: 'bookmarks', selectedItemId: null })}
            mood={mood}
          />
          <ControlChip
            active={sourceLane === 'quick-access'}
            label="Quick Access"
            onClick={() => host.updatePackState({ sourceLane: 'quick-access', selectedItemId: null })}
            mood={mood}
          />
        </div>
      </div>

      <div>
        <div style={{ marginBottom: 8, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: mood.accent }}>
          Mood
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {Object.keys(MOODS).map((moodId) => (
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
          gap: 12,
          borderRadius: 14,
          border: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(255,255,255,0.03)',
          padding: '10px 12px',
        }}
      >
        <span>
          <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--overlay-text-primary)' }}>
            Show telemetry strip
          </span>
          <span style={{ display: 'block', marginTop: 4, fontSize: 11, color: 'var(--overlay-text-muted)' }}>
            Keep recent and most-used lanes visible below the deck.
          </span>
        </span>
        <input
          type="checkbox"
          checked={showTelemetry}
          onChange={(event) => host.updatePackState({ showTelemetry: event.target.checked })}
        />
      </label>
    </div>
  );
}

function PrismSwitchboard({ host }) {
  const mood = pickMood(host);
  const deckItems = getDeckItems(host);
  const selectedItem = getSelectedDeckItem(host, deckItems);
  const showTelemetry = host.packState.showTelemetry !== false;
  const recentFolders = host.recentFolders.slice(0, 4);
  const mostUsedFolders = host.mostUsedFolders.slice(0, 4);
  const savedSearches = host.savedSearches.slice(0, 4);
  const launchpad = host.launchpad.slice(0, 4);
  const activeTask = host.tasks.find((task) => task.status !== 'completed') || null;

  return (
    <div
      style={{
        minHeight: '100%',
        padding: '24px 24px 34px',
        display: 'grid',
        gap: 18,
        background:
          'radial-gradient(circle at 18% 12%, rgba(255,255,255,0.04), transparent 22%), radial-gradient(circle at 86% 8%, rgba(255,255,255,0.03), transparent 24%), linear-gradient(180deg, rgba(8,11,18,0.96) 0%, rgba(5,7,13,0.99) 100%)',
      }}
    >
      <section
        style={{
          borderRadius: 30,
          border: '1px solid rgba(255,255,255,0.08)',
          background: mood.shell,
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
            inset: 'auto auto -22% -6%',
            width: 260,
            height: 260,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${mood.accentSoft}, transparent 70%)`,
            filter: 'blur(18px)',
            pointerEvents: 'none',
          }}
        />

        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ maxWidth: 760 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 800, color: mood.secondary }}>
              Prism Switchboard
            </div>
            <h2 style={{ marginTop: 10, fontSize: 34, lineHeight: 1.02, color: '#f8fbff' }}>
              Turn favorite folders into a real deck.
            </h2>
            <p style={{ marginTop: 12, maxWidth: 760, fontSize: 13, lineHeight: 1.7, color: 'rgba(236,242,248,0.8)' }}>
              Prism is the card-switcher showcase: persistent selection, oversized destination cards, and a home surface that feels authored rather than assembled.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <ControlChip
              active={host.packState.sourceLane !== 'quick-access'}
              label="Bookmarks"
              onClick={() => host.updatePackState({ sourceLane: 'bookmarks', selectedItemId: null })}
              mood={mood}
            />
            <ControlChip
              active={host.packState.sourceLane === 'quick-access'}
              label="Quick Access"
              onClick={() => host.updatePackState({ sourceLane: 'quick-access', selectedItemId: null })}
              mood={mood}
            />
            <button
              type="button"
              onClick={() => host.openSettingsSection('home')}
              style={{
                minHeight: 34,
                padding: '0 12px',
                borderRadius: 999,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.04)',
                color: '#f8fbff',
                fontSize: 11,
                fontWeight: 700,
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
            gridTemplateColumns: 'minmax(0, 1.15fr) minmax(280px, 0.85fr)',
            gap: 18,
            alignItems: 'stretch',
          }}
        >
          <div
            style={{
              position: 'relative',
              borderRadius: 28,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)',
              padding: 20,
              minHeight: 320,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 'auto -10% -14% auto',
                width: 260,
                height: 260,
                borderRadius: '50%',
                background: `radial-gradient(circle, ${mood.accentSoft}, transparent 70%)`,
                filter: 'blur(16px)',
                pointerEvents: 'none',
              }}
            />

            {selectedItem ? (
              <div style={{ position: 'relative', display: 'grid', gap: 18, height: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                  <div style={{ maxWidth: 620 }}>
                    <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: mood.secondary }}>
                      {selectedItem.eyebrow}
                    </div>
                    <div style={{ marginTop: 12, fontSize: 38, lineHeight: 0.98, fontWeight: 900, color: '#f8fbff' }}>
                      {selectedItem.label}
                    </div>
                    <div style={{ marginTop: 12, maxWidth: 640, fontSize: 13, lineHeight: 1.75, color: 'rgba(236,242,248,0.78)' }}>
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
                      label: 'Deck Source',
                      value: selectedItem.sourceLane === 'bookmarks' ? 'Bookmarks' : 'Quick Access',
                    },
                    {
                      label: 'Recent Activity',
                      value:
                        host.recentFolders.find((entry) => entry.path === selectedItem.path)
                          ? formatRelativeTime(
                              host.recentFolders.find((entry) => entry.path === selectedItem.path).lastOpenedAt,
                            )
                          : 'Waiting for visits',
                    },
                    {
                      label: 'Launch Actions',
                      value: `${launchpad.length} nearby routes`,
                    },
                  ].map((stat, index) => (
                    <div
                      key={stat.label}
                      style={{
                        borderRadius: 18,
                        border: '1px solid rgba(255,255,255,0.08)',
                        background: cardGradient(mood, index),
                        padding: '13px 13px 12px',
                      }}
                    >
                      <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(236,242,248,0.6)' }}>
                        {stat.label}
                      </div>
                      <div style={{ marginTop: 10, fontSize: 14, fontWeight: 800, color: '#f8fbff' }}>
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
                      borderRadius: 12,
                      border: 'none',
                      background: mood.accent,
                      color: '#081018',
                      fontSize: 11,
                      fontWeight: 800,
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
                      borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: 'rgba(255,255,255,0.04)',
                      color: '#f8fbff',
                      fontSize: 11,
                      fontWeight: 700,
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
                      borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: 'rgba(255,255,255,0.04)',
                      color: '#f8fbff',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <RefreshCw size={14} />
                    Refresh
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 13, lineHeight: 1.7, color: 'rgba(236,242,248,0.78)' }}>
                Prism needs bookmarks or quick access destinations before it can build a switchboard.
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            {deckItems.slice(0, 6).map((item, index) => {
              const active = selectedItem && selectedItem.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => host.updatePackState({ selectedItemId: item.id })}
                  style={{
                    borderRadius: 20,
                    border: `1px solid ${active ? mood.accent : 'rgba(255,255,255,0.08)'}`,
                    background: active ? cardGradient(mood, index) : 'rgba(255,255,255,0.03)',
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
                      <div style={{ marginTop: 8, fontSize: 14, fontWeight: 800, color: '#f8fbff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.label}
                      </div>
                      <div style={{ marginTop: 5, fontSize: 11, color: 'rgba(236,242,248,0.66)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.meta}
                      </div>
                    </div>
                    <ArrowRight size={15} color={active ? mood.accent : 'rgba(236,242,248,0.56)'} />
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
        <section
          style={{
            borderRadius: 24,
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.03)',
            padding: 16,
            display: 'grid',
            gap: 10,
          }}
        >
          <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: mood.secondary }}>
            Saved Searches
          </div>
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
                  borderRadius: 16,
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: cardGradient(mood, index),
                  padding: '12px 12px 11px',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#f8fbff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {savedSearch.name}
                  </div>
                  <div style={{ marginTop: 5, fontSize: 11, color: 'rgba(236,242,248,0.66)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {savedSearch.searchMode} :: {savedSearch.rootPath}
                  </div>
                </div>
                <Search size={14} color={mood.secondary} />
              </button>
            ))
          ) : (
            <div style={{ fontSize: 12, color: 'rgba(236,242,248,0.68)' }}>
              Save a few recursive searches and Prism gives them dedicated switchboard slots.
            </div>
          )}
        </section>

        <section
          style={{
            borderRadius: 24,
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.03)',
            padding: 16,
            display: 'grid',
            gap: 10,
          }}
        >
          <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: mood.secondary }}>
            Launch Routes
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            {launchpad.map((item, index) => {
              const Icon = PANEL_ICONS[item.panelId] || LayoutGrid;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => host.openPanel(item.panelId)}
                  style={{
                    borderRadius: 16,
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: cardGradient(mood, index),
                    padding: '12px 12px 11px',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <Icon size={15} color={mood.secondary} />
                  <div style={{ marginTop: 9, fontSize: 12, fontWeight: 800, color: '#f8fbff' }}>
                    {item.label}
                  </div>
                  <div style={{ marginTop: 5, fontSize: 11, lineHeight: 1.5, color: 'rgba(236,242,248,0.66)' }}>
                    {item.description}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section
          style={{
            borderRadius: 24,
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.03)',
            padding: 16,
            display: 'grid',
            gap: 10,
          }}
        >
          <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: mood.secondary }}>
            Live Pulse
          </div>
          {activeTask ? (
            <div
              style={{
                borderRadius: 18,
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.04)',
                padding: 14,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 800, color: '#f8fbff' }}>{activeTask.title}</div>
              <div style={{ marginTop: 6, fontSize: 11, color: 'rgba(236,242,248,0.66)' }}>
                {activeTask.detail || activeTask.status}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'rgba(236,242,248,0.68)' }}>
              No live explorer work right now. Prism keeps this slot for the next active task pulse.
            </div>
          )}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 10,
            }}
          >
            {(showTelemetry ? recentFolders : mostUsedFolders).map((entry, index) => (
              <button
                key={`${entry.path}:${index}`}
                type="button"
                onClick={() => host.navigate(entry.path)}
                style={{
                  borderRadius: 16,
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: cardGradient(mood, index),
                  padding: '12px 12px 11px',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 800, color: '#f8fbff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {entry.label}
                </div>
                <div style={{ marginTop: 5, fontSize: 11, color: 'rgba(236,242,248,0.66)' }}>
                  {showTelemetry ? `last seen ${formatRelativeTime(entry.lastOpenedAt)}` : `${entry.openCount} opens`}
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export const homePack = defineHomePack({
  id: 'prism-switchboard',
  name: 'Prism Switchboard',
  description:
    'Persistent card-switcher for favorite folders, built as the expressive editorial showcase pack.',
  supportsLiveSwap: true,
  component: PrismSwitchboard,
  settingsComponent: PrismSwitchboardSettings,
});
