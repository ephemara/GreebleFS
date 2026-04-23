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
} from 'lucide-react';
import { defineHomePack } from 'greeblefs-home-pack';

const COLORWAYS = {
  ember: {
    accent: '#ff8a4c',
    accentSoft: 'rgba(255, 138, 76, 0.2)',
    line: 'rgba(255, 138, 76, 0.48)',
    glow: 'rgba(255, 122, 56, 0.32)',
    hero:
      'radial-gradient(circle at 18% 18%, rgba(255, 168, 102, 0.28), transparent 30%), radial-gradient(circle at 82% 20%, rgba(255, 94, 58, 0.24), transparent 26%), linear-gradient(140deg, rgba(39, 20, 11, 0.96), rgba(16, 11, 14, 0.98) 54%, rgba(9, 12, 18, 0.99))',
  },
  glacier: {
    accent: '#64e6ff',
    accentSoft: 'rgba(100, 230, 255, 0.18)',
    line: 'rgba(100, 230, 255, 0.44)',
    glow: 'rgba(72, 176, 255, 0.28)',
    hero:
      'radial-gradient(circle at 15% 15%, rgba(146, 237, 255, 0.22), transparent 28%), radial-gradient(circle at 84% 18%, rgba(88, 146, 255, 0.2), transparent 24%), linear-gradient(145deg, rgba(7, 25, 36, 0.96), rgba(7, 16, 28, 0.99) 58%, rgba(8, 10, 17, 0.99))',
  },
  signal: {
    accent: '#b8ff4a',
    accentSoft: 'rgba(184, 255, 74, 0.16)',
    line: 'rgba(184, 255, 74, 0.42)',
    glow: 'rgba(164, 255, 74, 0.24)',
    hero:
      'radial-gradient(circle at 16% 20%, rgba(184, 255, 74, 0.18), transparent 28%), radial-gradient(circle at 84% 16%, rgba(78, 255, 158, 0.18), transparent 24%), linear-gradient(145deg, rgba(18, 28, 8, 0.96), rgba(13, 17, 11, 0.99) 58%, rgba(8, 10, 17, 0.99))',
  },
};

const LAUNCHPAD_ICONS = {
  terminal: Terminal,
  settings: Settings2,
  plugins: Puzzle,
  notes: StickyNote,
  screenshots: Sparkles,
  storage: HardDrive,
};

function pickColorway(host) {
  const colorwayId =
    typeof host.packState.colorway === 'string' && COLORWAYS[host.packState.colorway]
      ? host.packState.colorway
      : 'ember';
  return COLORWAYS[colorwayId];
}

function pickTelemetryLane(host) {
  return host.packState.focusLane === 'recent'
    ? host.recentFolders
    : host.mostUsedFolders;
}

function formatRelativeTime(timestamp) {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return 'No recent signal';
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

function formatDriveUsage(drive) {
  if (drive.kind === 'cloud') {
    return `${drive.provider} cloud`;
  }

  const usedBytes = Math.max(0, (drive.total_bytes ?? 0) - (drive.free_bytes ?? 0));
  const totalBytes = Math.max(1, drive.total_bytes ?? 1);
  const percent = Math.round((usedBytes / totalBytes) * 100);
  return `${percent}% used`;
}

function getDriveFill(drive) {
  if (drive.kind === 'cloud') {
    return 0.45;
  }

  const usedBytes = Math.max(0, (drive.total_bytes ?? 0) - (drive.free_bytes ?? 0));
  const totalBytes = Math.max(1, drive.total_bytes ?? 1);
  return Math.max(0.08, Math.min(1, usedBytes / totalBytes));
}

function getTaskStatusLabel(task) {
  if (task.status === 'completed') {
    return 'Completed';
  }
  if (task.status === 'running') {
    return 'Running';
  }
  if (task.status === 'failed') {
    return 'Failed';
  }
  return task.status || 'Queued';
}

function getTaskProgress(task) {
  if (
    typeof task.progressCurrent !== 'number' ||
    typeof task.progressTotal !== 'number' ||
    task.progressTotal <= 0
  ) {
    return 0.2;
  }

  return Math.max(0.08, Math.min(1, task.progressCurrent / task.progressTotal));
}

function updatePackState(host, updates) {
  host.updatePackState(updates);
}

function ToggleChip({ active, label, onClick, colorway }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        borderRadius: 999,
        border: `1px solid ${active ? colorway.line : 'rgba(255,255,255,0.1)'}`,
        background: active ? colorway.accentSoft : 'rgba(255,255,255,0.03)',
        color: active ? '#f7fbff' : 'rgba(225,232,240,0.76)',
        minHeight: 34,
        padding: '0 12px',
        fontSize: 11,
        fontWeight: 700,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

function AtlasCockpitSettings({ host }) {
  const colorway = pickColorway(host);
  const focusLane = host.packState.focusLane === 'recent' ? 'recent' : 'most-used';
  const currentColorway =
    typeof host.packState.colorway === 'string' && COLORWAYS[host.packState.colorway]
      ? host.packState.colorway
      : 'ember';
  const showDriveMatrix = host.packState.showDriveMatrix !== false;
  const showSavedSearches = host.packState.showSavedSearches !== false;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ fontSize: 11, lineHeight: 1.65, color: 'var(--overlay-text-muted)' }}>
        Atlas Cockpit is the dense, operator-first example. It should feel like the explorer home screen grew up into a control deck.
      </div>

      <div>
        <div style={{ marginBottom: 8, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: colorway.accent }}>
          Telemetry Focus
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <ToggleChip
            active={focusLane === 'most-used'}
            label="Most Used"
            onClick={() => updatePackState(host, { focusLane: 'most-used' })}
            colorway={colorway}
          />
          <ToggleChip
            active={focusLane === 'recent'}
            label="Recent"
            onClick={() => updatePackState(host, { focusLane: 'recent' })}
            colorway={colorway}
          />
        </div>
      </div>

      <div>
        <div style={{ marginBottom: 8, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: colorway.accent }}>
          Colorway
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {Object.keys(COLORWAYS).map((colorwayId) => (
            <ToggleChip
              key={colorwayId}
              active={currentColorway === colorwayId}
              label={colorwayId[0].toUpperCase() + colorwayId.slice(1)}
              onClick={() => updatePackState(host, { colorway: colorwayId })}
              colorway={colorway}
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
            Show drive matrix
          </span>
          <span style={{ display: 'block', marginTop: 4, fontSize: 11, color: 'var(--overlay-text-muted)' }}>
            Keep the lower hardware / cloud pressure board visible.
          </span>
        </span>
        <input
          type="checkbox"
          checked={showDriveMatrix}
          onChange={(event) => updatePackState(host, { showDriveMatrix: event.target.checked })}
        />
      </label>

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
            Show saved-search rack
          </span>
          <span style={{ display: 'block', marginTop: 4, fontSize: 11, color: 'var(--overlay-text-muted)' }}>
            Keep a recursive-search panel in the right lane.
          </span>
        </span>
        <input
          type="checkbox"
          checked={showSavedSearches}
          onChange={(event) => updatePackState(host, { showSavedSearches: event.target.checked })}
        />
      </label>
    </div>
  );
}

function AtlasCockpit({ host }) {
  const colorway = pickColorway(host);
  const telemetryLane = pickTelemetryLane(host);
  const showDriveMatrix = host.packState.showDriveMatrix !== false;
  const showSavedSearches = host.packState.showSavedSearches !== false;
  const heroTarget =
    telemetryLane[0] ||
    host.bookmarks[0] ||
    host.quickAccess[0] ||
    host.recentFolders[0] ||
    null;
  const activeTasks = host.tasks
    .filter((task) => task.status !== 'completed')
    .slice(0, 4);
  const spotlightEntries = telemetryLane.slice(0, 5);
  const quickTargets = host.quickAccess.slice(0, 4);
  const savedSearches = host.savedSearches.slice(0, 4);
  const launchpad = host.launchpad.slice(0, 6);
  const drives = host.drives.slice(0, 6);
  const warningText = host.packWarnings[0] || host.diagnostics.selectedPackError || null;

  return (
    <div
      style={{
        minHeight: '100%',
        padding: '22px 22px 34px',
        display: 'grid',
        gap: 18,
        background:
          'radial-gradient(circle at top left, rgba(255,255,255,0.04), transparent 26%), radial-gradient(circle at 80% 10%, rgba(255,255,255,0.03), transparent 24%), linear-gradient(180deg, rgba(8,11,18,0.96) 0%, rgba(5,8,14,0.99) 100%)',
      }}
    >
      <section
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 28,
          border: `1px solid ${colorway.line}`,
          background: colorway.hero,
          boxShadow: `0 30px 80px ${colorway.glow}`,
          padding: 24,
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 'auto -6% -30% auto',
            width: 300,
            height: 300,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${colorway.accentSoft}, transparent 70%)`,
            filter: 'blur(18px)',
            pointerEvents: 'none',
          }}
        />

        <div style={{ position: 'relative', display: 'grid', gap: 18 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
            <div style={{ maxWidth: 760 }}>
              <div style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 800, color: colorway.accent }}>
                Atlas Cockpit
              </div>
              <h2 style={{ marginTop: 10, fontSize: 34, lineHeight: 1.02, color: '#f7fbff' }}>
                Run the explorer like an operations wall.
              </h2>
              <p style={{ marginTop: 12, maxWidth: 760, fontSize: 13, lineHeight: 1.7, color: 'rgba(232,238,246,0.82)' }}>
                This pack is the dense reference implementation: telemetry-heavy, fast to scan, and built to make Home feel like a live system surface instead of a polite empty page.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <ToggleChip
                active={host.packState.focusLane !== 'recent'}
                label="Most Used"
                onClick={() => updatePackState(host, { focusLane: 'most-used' })}
                colorway={colorway}
              />
              <ToggleChip
                active={host.packState.focusLane === 'recent'}
                label="Recent"
                onClick={() => updatePackState(host, { focusLane: 'recent' })}
                colorway={colorway}
              />
              <button
                type="button"
                onClick={() => host.openSettingsSection('home')}
                style={{
                  minHeight: 34,
                  padding: '0 12px',
                  borderRadius: 999,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.05)',
                  color: '#f7fbff',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Customize
              </button>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12,
            }}
          >
            {[
              {
                label: 'Quick Access',
                value: String(host.quickAccess.length),
                detail: 'platform shortcuts',
              },
              {
                label: 'Bookmarks',
                value: String(host.bookmarks.length),
                detail: 'pinned explorer roots',
              },
              {
                label: host.packState.focusLane === 'recent' ? 'Recent Lane' : 'Most Used',
                value: String(telemetryLane.length),
                detail: host.usageTrackingEnabled ? 'telemetry live' : 'telemetry paused',
              },
              {
                label: 'Task Center',
                value: String(activeTasks.length),
                detail: activeTasks.length > 0 ? 'work in flight' : 'quiet',
              },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  borderRadius: 18,
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.05)',
                  padding: '14px 14px 12px',
                  minHeight: 92,
                }}
              >
                <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(231,239,247,0.62)' }}>
                  {stat.label}
                </div>
                <div style={{ marginTop: 10, fontSize: 30, fontWeight: 800, color: '#f7fbff' }}>
                  {stat.value}
                </div>
                <div style={{ marginTop: 6, fontSize: 11, color: 'rgba(231,239,247,0.72)' }}>
                  {stat.detail}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => heroTarget && host.navigate(heroTarget.path)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                minHeight: 38,
                padding: '0 14px',
                borderRadius: 12,
                border: 'none',
                background: colorway.accent,
                color: '#091019',
                fontSize: 11,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              <FolderOpen size={14} />
              {heroTarget ? `Open ${heroTarget.label}` : 'Open Focus Folder'}
            </button>
            <button
              type="button"
              onClick={() => host.openPanel('terminal')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                minHeight: 38,
                padding: '0 14px',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.05)',
                color: '#f7fbff',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Terminal size={14} />
              Open Terminal
            </button>
            <button
              type="button"
              onClick={() => host.refresh()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                minHeight: 38,
                padding: '0 14px',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.05)',
                color: '#f7fbff',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={14} />
              Refresh Surface
            </button>
          </div>
        </div>
      </section>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.35fr) minmax(320px, 0.95fr)',
          gap: 18,
        }}
      >
        <section
          style={{
            borderRadius: 24,
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'linear-gradient(180deg, rgba(11,15,24,0.98) 0%, rgba(8,11,18,0.99) 100%)',
            padding: 18,
            display: 'grid',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: colorway.accent }}>
                Primary Lane
              </div>
              <div style={{ marginTop: 6, fontSize: 18, fontWeight: 800, color: '#f7fbff' }}>
                {host.packState.focusLane === 'recent' ? 'Recent Folders' : 'Most Used Folders'}
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'rgba(223,231,239,0.72)' }}>
              {host.usageTrackingEnabled ? 'Telemetry live' : 'Telemetry paused'}
            </div>
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            {spotlightEntries.length > 0 ? (
              spotlightEntries.map((entry, index) => {
                const fill = Math.max(
                  0.12,
                  Math.min(
                    1,
                    spotlightEntries[0] && spotlightEntries[0].openCount > 0
                      ? entry.openCount / spotlightEntries[0].openCount
                      : 0.24,
                  ),
                );

                return (
                  <button
                    key={`${entry.path}:${index}`}
                    type="button"
                    onClick={() => host.navigate(entry.path)}
                    style={{
                      display: 'grid',
                      gap: 10,
                      borderRadius: 18,
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: index === 0 ? colorway.accentSoft : 'rgba(255,255,255,0.03)',
                      padding: '14px 14px 12px',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#f7fbff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {entry.label}
                        </div>
                        <div style={{ marginTop: 5, fontSize: 11, color: 'rgba(223,231,239,0.68)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {entry.path}
                        </div>
                      </div>
                      <ArrowRight size={15} color={colorway.accent} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1, height: 7, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${Math.round(fill * 100)}%`,
                            height: '100%',
                            borderRadius: 999,
                            background: `linear-gradient(90deg, ${colorway.accent} 0%, rgba(255,255,255,0.82) 100%)`,
                          }}
                        />
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#f7fbff' }}>
                        {entry.openCount}x
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(223,231,239,0.7)' }}>
                      Last used {formatRelativeTime(entry.lastOpenedAt)}
                    </div>
                  </button>
                );
              })
            ) : (
              <div
                style={{
                  borderRadius: 18,
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.03)',
                  padding: 18,
                  fontSize: 12,
                  lineHeight: 1.65,
                  color: 'rgba(223,231,239,0.72)',
                }}
              >
                Navigate a few local folders and Atlas will start building a live telemetry lane here.
              </div>
            )}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: 10,
            }}
          >
            {quickTargets.map((target) => (
              <button
                key={target.id}
                type="button"
                onClick={() => host.navigate(target.path)}
                style={{
                  borderRadius: 16,
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.03)',
                  padding: '12px 12px 11px',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FolderOpen size={14} color={colorway.accent} />
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#f7fbff' }}>{target.label}</div>
                </div>
                <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(223,231,239,0.64)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {target.description || target.path}
                </div>
              </button>
            ))}
          </div>
        </section>

        <div style={{ display: 'grid', gap: 18 }}>
          <section
            style={{
              borderRadius: 24,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'linear-gradient(180deg, rgba(12,16,26,0.98) 0%, rgba(8,11,18,0.99) 100%)',
              padding: 18,
              display: 'grid',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: colorway.accent }}>
                Shell Launch
              </div>
              <div style={{ fontSize: 11, color: 'rgba(223,231,239,0.64)' }}>
                {launchpad.length} routes
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              {launchpad.map((item) => {
                const Icon = LAUNCHPAD_ICONS[item.panelId] || LayoutGrid;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => host.openPanel(item.panelId)}
                    style={{
                      borderRadius: 16,
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: 'rgba(255,255,255,0.04)',
                      padding: '13px 12px',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <Icon size={15} color={colorway.accent} />
                    <div style={{ marginTop: 10, fontSize: 12, fontWeight: 800, color: '#f7fbff' }}>
                      {item.label}
                    </div>
                    <div style={{ marginTop: 5, fontSize: 11, lineHeight: 1.5, color: 'rgba(223,231,239,0.64)' }}>
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
              background: 'linear-gradient(180deg, rgba(12,16,26,0.98) 0%, rgba(8,11,18,0.99) 100%)',
              padding: 18,
              display: 'grid',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: colorway.accent }}>
                Task Center
              </div>
              <button
                type="button"
                onClick={() => host.openPanel('explorer')}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: colorway.accent,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Open Explorer
              </button>
            </div>
            {activeTasks.length > 0 ? (
              activeTasks.map((task) => (
                <div
                  key={task.id}
                  style={{
                    borderRadius: 16,
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.03)',
                    padding: '12px 12px 11px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#f7fbff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {task.title}
                      </div>
                      <div style={{ marginTop: 5, fontSize: 11, color: 'rgba(223,231,239,0.64)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {task.detail || getTaskStatusLabel(task)}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: colorway.accent }}>
                      {getTaskStatusLabel(task)}
                    </div>
                  </div>
                  <div style={{ marginTop: 10, height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${Math.round(getTaskProgress(task) * 100)}%`,
                        height: '100%',
                        borderRadius: 999,
                        background: `linear-gradient(90deg, ${colorway.accent} 0%, rgba(255,255,255,0.82) 100%)`,
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div
                style={{
                  borderRadius: 16,
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.03)',
                  padding: 16,
                  fontSize: 12,
                  lineHeight: 1.6,
                  color: 'rgba(223,231,239,0.7)',
                }}
              >
                No active explorer work right now. Atlas will surface long-running copies, moves, renames, and scan jobs here.
              </div>
            )}
          </section>

          {showSavedSearches ? (
            <section
              style={{
                borderRadius: 24,
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'linear-gradient(180deg, rgba(12,16,26,0.98) 0%, rgba(8,11,18,0.99) 100%)',
                padding: 18,
                display: 'grid',
                gap: 10,
              }}
            >
              <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: colorway.accent }}>
                Search Rack
              </div>
              {savedSearches.length > 0 ? (
                savedSearches.map((savedSearch) => (
                  <button
                    key={savedSearch.id}
                    type="button"
                    onClick={() => host.openSavedSearch(savedSearch)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      borderRadius: 14,
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: 'rgba(255,255,255,0.03)',
                      padding: '12px 12px 11px',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#f7fbff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {savedSearch.name}
                      </div>
                      <div style={{ marginTop: 5, fontSize: 11, color: 'rgba(223,231,239,0.64)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {savedSearch.searchMode} :: {savedSearch.rootPath}
                      </div>
                    </div>
                    <Search size={14} color={colorway.accent} />
                  </button>
                ))
              ) : (
                <div style={{ fontSize: 12, color: 'rgba(223,231,239,0.7)' }}>
                  No saved searches yet. Once you save recursive search recipes, Atlas gives them a dedicated rack.
                </div>
              )}
            </section>
          ) : null}
        </div>
      </div>

      {showDriveMatrix ? (
        <section
          style={{
            borderRadius: 24,
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'linear-gradient(180deg, rgba(12,16,26,0.98) 0%, rgba(8,11,18,0.99) 100%)',
            padding: 18,
            display: 'grid',
            gap: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: colorway.accent }}>
                Root Pressure
              </div>
              <div style={{ marginTop: 6, fontSize: 18, fontWeight: 800, color: '#f7fbff' }}>
                Drives, roots, and cloud lanes
              </div>
            </div>
            {warningText ? (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  borderRadius: 999,
                  border: '1px solid rgba(255, 218, 112, 0.22)',
                  background: 'rgba(255, 218, 112, 0.1)',
                  color: '#ffd66f',
                  padding: '8px 10px',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                <Zap size={13} />
                {warningText}
              </div>
            ) : null}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 12,
            }}
          >
            {drives.map((drive) => (
              <button
                key={drive.id}
                type="button"
                onClick={() => host.navigate(drive.path)}
                style={{
                  borderRadius: 18,
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.03)',
                  padding: 14,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#f7fbff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {drive.label}
                    </div>
                    <div style={{ marginTop: 5, fontSize: 11, color: 'rgba(223,231,239,0.62)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {drive.path}
                    </div>
                  </div>
                  <HardDrive size={15} color={colorway.accent} />
                </div>
                <div style={{ marginTop: 12, height: 7, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.round(getDriveFill(drive) * 100)}%`,
                      height: '100%',
                      borderRadius: 999,
                      background: `linear-gradient(90deg, ${colorway.accent} 0%, rgba(255,255,255,0.82) 100%)`,
                    }}
                  />
                </div>
                <div style={{ marginTop: 9, fontSize: 11, color: 'rgba(223,231,239,0.7)' }}>
                  {formatDriveUsage(drive)}
                </div>
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export const homePack = defineHomePack({
  id: 'atlas-cockpit',
  name: 'Atlas Cockpit',
  description:
    'Dense command bridge for operators who want Home to behave like a live control surface.',
  supportsLiveSwap: true,
  component: AtlasCockpit,
  settingsComponent: AtlasCockpitSettings,
});
