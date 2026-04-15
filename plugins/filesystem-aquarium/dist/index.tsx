import React, { useEffect, useRef, useState } from 'react';
import { definePlugin } from 'overlayterm-plugin';

type OverlayPluginStorageApi = {
  rootDir: string;
  ensureDir: (relativePath?: string) => Promise<string>;
  readTextFile: (relativePath: string) => Promise<string>;
  writeTextFile: (relativePath: string, data: string) => Promise<void>;
};

type OverlayPluginApi = {
  invoke: <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
  storage?: OverlayPluginStorageApi;
};

type OverlayTheme = {
  palette?: {
    accent?: string;
    shellBackground?: string;
    panelBackground?: string;
    textPrimary?: string;
    textMuted?: string;
  };
};

type OverlayPluginProps = {
  api: OverlayPluginApi;
  appearance: { theme: OverlayTheme };
  host?: { width: number; height: number; compact: boolean; density: 'compact' | 'regular' };
};

type FileEntry = {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified: number;
  extension: string;
};

type AquariumCreature = {
  id: string;
  path: string;
  name: string;
  extension: string;
  isDirectory: boolean;
  size: number;
  modified: number;
  species: string;
  lane: number;
  x: number;
  y: number;
  scale: number;
  speedMs: number;
  activity: number;
  rarity: string;
  hue: number;
};

type AquariumSnapshot = {
  rootPath: string;
  creatures: AquariumCreature[];
  fileCount: number;
  directoryCount: number;
  totalBytes: number;
  activeCount: number;
  extensionLeaders: string[];
  waterHue: number;
  glowHue: number;
  currentStrength: number;
  weatherLabel: string;
};

const STORAGE_FILE = 'filesystem-aquarium/state.json';
const MAX_CREATURES = 72;
const MAX_SCAN_DEPTH = 2;
const AQUARIUM_OPEN_REQUEST_EVENT = 'greeblefs:filesystem-aquarium:open-request';
const AQUARIUM_OPEN_REQUEST_STORAGE_KEY = 'greeblefs:filesystem-aquarium:open-request';

type AquariumOpenRequest = {
  path: string;
  requestedAt: number;
  nonce: string;
};

function FilesystemAquarium({ api, appearance, host }: OverlayPluginProps) {
  const accent = appearance.theme.palette?.accent ?? '#6ee7f9';
  const textPrimary = appearance.theme.palette?.textPrimary ?? '#f3fbff';
  const textMuted = appearance.theme.palette?.textMuted ?? 'rgba(214, 237, 255, 0.72)';
  const shellBackground = appearance.theme.palette?.shellBackground ?? '#06131c';
  const panelBackground = appearance.theme.palette?.panelBackground ?? 'rgba(4, 15, 24, 0.68)';

  const [rootPath, setRootPath] = useState('');
  const [draftRootPath, setDraftRootPath] = useState('');
  const [snapshot, setSnapshot] = useState<AquariumSnapshot | null>(null);
  const [selectedPath, setSelectedPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refreshNonce, setRefreshNonce] = useState(0);
  const requestVersionRef = useRef(0);
  const lastHandledOpenRequestRef = useRef('');

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      try {
        const persisted = await api.storage?.readTextFile(STORAGE_FILE);
        if (!persisted || cancelled) {
          return;
        }
        const parsed = JSON.parse(persisted) as { rootPath?: string };
        if (parsed.rootPath) {
          setRootPath(parsed.rootPath);
          setDraftRootPath(parsed.rootPath);
        }
      } catch {
        if (!cancelled) {
          setDraftRootPath('');
        }
      }
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [api.storage]);

  useEffect(() => {
    if (!api.storage) {
      return;
    }

    void api.storage.ensureDir('filesystem-aquarium');
    void api.storage.writeTextFile(STORAGE_FILE, JSON.stringify({ rootPath }, null, 2));
  }, [api.storage, rootPath]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const applyOpenRequest = (request: AquariumOpenRequest | null | undefined) => {
      const nextPath = request?.path?.trim();
      const nextNonce = request?.nonce?.trim();
      if (!nextPath || !nextNonce || lastHandledOpenRequestRef.current === nextNonce) {
        return;
      }

      lastHandledOpenRequestRef.current = nextNonce;
      setDraftRootPath(nextPath);
      setRootPath(nextPath);
      setRefreshNonce(currentValue => currentValue + 1);
    };

    applyOpenRequest(readPersistedOpenRequest());

    const handleOpenRequest = (event: Event) => {
      applyOpenRequest((event as CustomEvent<AquariumOpenRequest>).detail);
    };

    window.addEventListener(AQUARIUM_OPEN_REQUEST_EVENT, handleOpenRequest);
    return () => {
      window.removeEventListener(AQUARIUM_OPEN_REQUEST_EVENT, handleOpenRequest);
    };
  }, []);

  useEffect(() => {
    if (!rootPath.trim()) {
      setSnapshot(null);
      setSelectedPath('');
      setError('');
      return;
    }

    let disposed = false;

    const refreshSnapshot = async () => {
      const requestVersion = requestVersionRef.current + 1;
      requestVersionRef.current = requestVersion;
      setLoading(true);
      setError('');
      try {
        const nextSnapshot = await buildAquariumSnapshot(rootPath, api);
        if (disposed || requestVersionRef.current !== requestVersion) {
          return;
        }
        setSnapshot(nextSnapshot);
        setSelectedPath(currentSelectedPath => {
          if (!currentSelectedPath) {
            return nextSnapshot.creatures[0]?.path ?? '';
          }
          return nextSnapshot.creatures.some(creature => creature.path === currentSelectedPath)
            ? currentSelectedPath
            : nextSnapshot.creatures[0]?.path ?? '';
        });
      } catch (nextError) {
        if (!disposed) {
          setSnapshot(null);
          setSelectedPath('');
          setError(String(nextError));
        }
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    };

    void refreshSnapshot();
    const intervalId = window.setInterval(() => {
      void refreshSnapshot();
    }, 20000);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
    };
  }, [api, refreshNonce, rootPath]);

  const selectedCreature = snapshot?.creatures.find(creature => creature.path === selectedPath) ?? null;
  const sceneCompact = host?.compact === true || (host?.width ?? 0) < 1100;
  const sceneDensity = host?.density ?? 'regular';
  const reefHue = snapshot?.waterHue ?? 198;
  const reefGlowHue = snapshot?.glowHue ?? 176;
  const currentStrength = snapshot?.currentStrength ?? 0.45;
  const weatherLabel = snapshot?.weatherLabel ?? 'Waiting for a habitat';

  const handleDockRoot = () => {
    const nextRoot = draftRootPath.trim();
    setRootPath(nextRoot);
    setRefreshNonce(currentValue => currentValue + 1);
  };

  const handleSelectCreature = (creature: AquariumCreature) => {
    setSelectedPath(creature.path);
  };

  const handleRevealCreature = async (creature: AquariumCreature) => {
    await api.invoke('fs_reveal_in_explorer', { path: creature.path });
  };

  const handleOpenCreature = async (creature: AquariumCreature) => {
    if (creature.isDirectory) {
      setDraftRootPath(creature.path);
      setRootPath(creature.path);
      return;
    }
    await api.invoke('fs_open_file', { path: creature.path });
  };

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        color: textPrimary,
        background: `radial-gradient(circle at 20% 12%, hsla(${reefGlowHue}, 92%, 64%, 0.16), transparent 34%), radial-gradient(circle at 78% 0%, hsla(${reefHue}, 96%, 56%, 0.22), transparent 28%), linear-gradient(180deg, ${shellBackground} 0%, #031018 42%, #02090f 100%)`,
        overflow: 'hidden',
      }}
    >
      <style>{`
        @keyframes aquarium-current {
          0% { transform: translate3d(-3%, 0%, 0px); }
          50% { transform: translate3d(3%, 1.5%, 0px); }
          100% { transform: translate3d(-3%, 0%, 0px); }
        }
        @keyframes aquarium-bubble {
          0% { transform: translate3d(0px, 16px, 0px) scale(0.92); opacity: 0; }
          15% { opacity: 0.52; }
          100% { transform: translate3d(18px, -180px, 0px) scale(1.12); opacity: 0; }
        }
        @keyframes aquarium-creature {
          0% { transform: translate3d(-12px, 0px, 0px); }
          50% { transform: translate3d(12px, -7px, 0px); }
          100% { transform: translate3d(-12px, 0px, 0px); }
        }
        @keyframes aquarium-pulse {
          0% { box-shadow: 0 0 0 0 rgba(110, 231, 249, 0.0); }
          50% { box-shadow: 0 0 28px 3px rgba(110, 231, 249, 0.2); }
          100% { box-shadow: 0 0 0 0 rgba(110, 231, 249, 0.0); }
        }
      `}</style>

      <div style={{ padding: sceneCompact ? '14px 14px 10px' : '18px 18px 12px', borderBottom: '1px solid rgba(183, 233, 255, 0.14)' }}>
        <div style={{ display: 'flex', alignItems: sceneCompact ? 'stretch' : 'center', gap: 10, flexDirection: sceneCompact ? 'column' : 'row' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: textMuted }}>
              Filesystem Aquarium
            </div>
            <div style={{ marginTop: 6, fontSize: sceneCompact ? 22 : 26, fontWeight: 800, lineHeight: 1.02 }}>
              Your files drift through a living biome.
            </div>
            <div style={{ marginTop: 8, maxWidth: 860, fontSize: 13, lineHeight: 1.55, color: textMuted }}>
              Paste a folder path, dock the habitat, and the plugin will turn recent activity into currents, weather, and file-creatures you can open or descend into.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: sceneCompact ? 'stretch' : 'flex-end' }}>
            <MetricCapsule label="Weather" value={weatherLabel} accent={accent} />
            <MetricCapsule label="Current" value={`${Math.round(currentStrength * 100)}%`} accent={accent} />
            <MetricCapsule label="Density" value={sceneDensity} accent={accent} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          <input
            value={draftRootPath}
            onChange={event => setDraftRootPath(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                handleDockRoot();
              }
            }}
            placeholder="/path/to/project-or-folder"
            style={{
              flex: 1,
              minWidth: 240,
              borderRadius: 14,
              border: '1px solid rgba(183, 233, 255, 0.18)',
              background: 'rgba(5, 18, 28, 0.82)',
              color: textPrimary,
              padding: '12px 14px',
              outline: 'none',
              fontSize: 13,
            }}
          />
          <ActionButton label={rootPath.trim() ? 'Move Habitat' : 'Dock Habitat'} onClick={handleDockRoot} accent={accent} />
          <ActionButton label="Refresh Reef" onClick={() => setRefreshNonce(currentValue => currentValue + 1)} accent={accent} quiet />
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0, flexDirection: sceneCompact ? 'column' : 'row' }}>
        <div style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <div
            style={{
              position: 'absolute',
              inset: '-4%',
              opacity: 0.52,
              background: `linear-gradient(180deg, transparent 0%, hsla(${reefHue}, 80%, 56%, 0.06) 30%, hsla(${reefGlowHue}, 84%, 52%, 0.1) 100%)`,
              animation: `aquarium-current ${Math.max(12000 - currentStrength * 2600, 7200)}ms ease-in-out infinite`,
            }}
          />

          {createBubbleSeeds(16).map(seed => (
            <div
              key={seed.id}
              style={{
                position: 'absolute',
                left: `${seed.left}%`,
                bottom: -24,
                width: seed.size,
                height: seed.size,
                borderRadius: 999,
                border: '1px solid rgba(194, 237, 255, 0.32)',
                background: 'rgba(165, 233, 255, 0.08)',
                animation: `aquarium-bubble ${seed.duration}ms linear ${seed.delay}ms infinite`,
              }}
            />
          ))}

          {!rootPath.trim() ? (
            <EmptyHabitatPanel accent={accent} textMuted={textMuted} />
          ) : null}

          {loading ? (
            <div style={overlayMessageStyle('rgba(7, 18, 29, 0.72)')}>
              Sampling the reef...
            </div>
          ) : null}

          {error ? (
            <div style={overlayMessageStyle('rgba(71, 19, 27, 0.84)')}>
              {error}
            </div>
          ) : null}

          {snapshot?.creatures.map(creature => {
            const isSelected = selectedCreature?.path === creature.path;
            const glow = `hsla(${creature.hue}, 92%, 66%, ${0.22 + creature.activity * 0.45})`;
            const body = `linear-gradient(135deg, hsla(${creature.hue}, 88%, 70%, 0.98), hsla(${(creature.hue + 40) % 360}, 92%, 52%, 0.96))`;
            return (
              <button
                key={creature.id}
                type="button"
                onClick={() => handleSelectCreature(creature)}
                onDoubleClick={() => void handleOpenCreature(creature)}
                title={`${creature.name} (${creature.species})`}
                style={{
                  position: 'absolute',
                  left: `${creature.x}%`,
                  top: `${creature.y}%`,
                  transform: `translate(-50%, -50%) scale(${creature.scale})`,
                  width: creature.isDirectory ? 92 : 78,
                  height: creature.isDirectory ? 54 : 46,
                  border: isSelected ? `1px solid ${accent}` : '1px solid rgba(216, 244, 255, 0.16)',
                  borderRadius: creature.isDirectory ? 18 : 999,
                  background: body,
                  color: '#031018',
                  cursor: 'pointer',
                  boxShadow: `${glow} 0 0 24px, rgba(0, 0, 0, 0.32) 0 18px 40px`,
                  animation: `aquarium-creature ${creature.speedMs}ms ease-in-out infinite, aquarium-pulse ${4200 + creature.lane * 300}ms ease-in-out infinite`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 10px',
                  textAlign: 'center',
                }}
              >
                <div style={{ pointerEvents: 'none', width: '100%' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {creature.species}
                  </div>
                  <div style={{ marginTop: 2, fontSize: 10, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {creature.name}
                  </div>
                </div>
              </button>
            );
          })}

          <div style={{ position: 'absolute', inset: 'auto 16px 14px 16px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(snapshot?.extensionLeaders ?? []).slice(0, 5).map(extension => (
              <div key={extension} style={memoryMoteStyle(extension, accent)}>
                {extension}
              </div>
            ))}
          </div>
        </div>

        <aside
          style={{
            width: sceneCompact ? '100%' : 320,
            borderLeft: sceneCompact ? 'none' : '1px solid rgba(183, 233, 255, 0.14)',
            borderTop: sceneCompact ? '1px solid rgba(183, 233, 255, 0.14)' : 'none',
            background: panelBackground,
            backdropFilter: 'blur(18px)',
            padding: 16,
            overflow: 'auto',
          }}
        >
          <SectionTitle>Biome Readout</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            <ReadoutCard label="Files" value={String(snapshot?.fileCount ?? 0)} />
            <ReadoutCard label="Folders" value={String(snapshot?.directoryCount ?? 0)} />
            <ReadoutCard label="Active" value={String(snapshot?.activeCount ?? 0)} />
            <ReadoutCard label="Mass" value={formatBytes(snapshot?.totalBytes ?? 0)} />
          </div>

          <SectionTitle>Selected Creature</SectionTitle>
          {selectedCreature ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={detailPanelStyle()}>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{selectedCreature.name}</div>
                <div style={{ marginTop: 4, fontSize: 12, color: textMuted }}>{selectedCreature.species} • {selectedCreature.rarity}</div>
                <div style={{ marginTop: 12, fontSize: 12, lineHeight: 1.6, color: textMuted, wordBreak: 'break-word' }}>
                  {selectedCreature.path}
                </div>
              </div>

              <div style={detailPanelStyle()}>
                <DetailRow label="Kind" value={selectedCreature.isDirectory ? 'Directory biome' : selectedCreature.extension || 'File artifact'} />
                <DetailRow label="Activity" value={`${Math.round(selectedCreature.activity * 100)}%`} />
                <DetailRow label="Size" value={formatBytes(selectedCreature.size)} />
                <DetailRow label="Modified" value={formatRelativeTime(selectedCreature.modified)} />
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <ActionButton label={selectedCreature.isDirectory ? 'Dive Into Habitat' : 'Open Artifact'} onClick={() => void handleOpenCreature(selectedCreature)} accent={accent} />
                <ActionButton label="Reveal In Explorer" onClick={() => void handleRevealCreature(selectedCreature)} accent={accent} quiet />
              </div>
            </div>
          ) : (
            <div style={detailPanelStyle()}>
              <div style={{ fontSize: 13, color: textMuted, lineHeight: 1.6 }}>
                Click a creature to inspect the file or folder it represents.
              </div>
            </div>
          )}

          <SectionTitle>How To Use It</SectionTitle>
          <div style={detailPanelStyle()}>
            <div style={{ fontSize: 12, lineHeight: 1.65, color: textMuted }}>
              Start with a project root, notes folder, screenshot dump, or mood archive. Recent edits intensify the weather, directories become larger reef bodies, and double-clicking a creature either opens the file or descends into that directory as a new habitat.
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

async function buildAquariumSnapshot(rootPath: string, api: OverlayPluginApi): Promise<AquariumSnapshot> {
  const queue: Array<{ path: string; depth: number }> = [{ path: rootPath, depth: 0 }];
  const seenDirectories = new Set<string>();
  const scannedEntries: Array<FileEntry & { depth: number }> = [];
  const now = Date.now();

  while (queue.length > 0 && scannedEntries.length < MAX_CREATURES) {
    const current = queue.shift();
    if (!current || seenDirectories.has(current.path)) {
      continue;
    }
    seenDirectories.add(current.path);

    let listed: FileEntry[] = [];
    try {
      listed = await api.invoke<FileEntry[]>('fs_list_dir', { path: current.path, showHidden: false });
    } catch {
      continue;
    }
    const sorted = [...listed].sort((left, right) => {
      if (left.is_dir !== right.is_dir) {
        return left.is_dir ? -1 : 1;
      }
      return left.name.localeCompare(right.name);
    });

    for (const entry of sorted) {
      scannedEntries.push({ ...entry, depth: current.depth });
      if (scannedEntries.length >= MAX_CREATURES) {
        break;
      }
      if (entry.is_dir && current.depth < MAX_SCAN_DEPTH) {
        queue.push({ path: entry.path, depth: current.depth + 1 });
      }
    }
  }

  const fileCount = scannedEntries.filter(entry => !entry.is_dir).length;
  const directoryCount = scannedEntries.filter(entry => entry.is_dir).length;
  const totalBytes = scannedEntries.reduce((sum, entry) => sum + Math.max(entry.size || 0, 0), 0);
  const activeCount = scannedEntries.filter(entry => now - entry.modified < 1000 * 60 * 60 * 24).length;
  const extensionCounts = new Map<string, number>();

  scannedEntries.forEach(entry => {
    const key = entry.is_dir ? 'dir' : (entry.extension || 'file');
    extensionCounts.set(key, (extensionCounts.get(key) ?? 0) + 1);
  });

  const extensionLeaders = Array.from(extensionCounts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6)
    .map(([extension]) => extension);

  const creatures = scannedEntries.map((entry, index) => createCreature(entry, index, scannedEntries.length, now));
  const dominantHash = hashString(`${rootPath}:${extensionLeaders.join('|')}`);
  const waterHue = dominantHash % 360;
  const glowHue = (waterHue + 48 + (activeCount * 7)) % 360;
  const currentStrength = Math.min(1, 0.25 + (activeCount / Math.max(scannedEntries.length || 1, 1)) * 1.4);
  const weatherLabel = activeCount === 0
    ? 'Sleep tide'
    : activeCount < Math.max(3, Math.floor(scannedEntries.length * 0.18))
      ? 'Soft drift'
      : activeCount < Math.max(7, Math.floor(scannedEntries.length * 0.38))
        ? 'Bloom current'
        : 'Electric squall';

  return {
    rootPath,
    creatures,
    fileCount,
    directoryCount,
    totalBytes,
    activeCount,
    extensionLeaders,
    waterHue,
    glowHue,
    currentStrength,
    weatherLabel,
  };
}

function createCreature(entry: FileEntry & { depth: number }, index: number, total: number, now: number): AquariumCreature {
  const pathHash = hashString(entry.path);
  const laneCount = 5;
  const lane = index % laneCount;
  const column = Math.floor(index / laneCount);
  const baseX = 10 + ((column + 1) / (Math.ceil(total / laneCount) + 1)) * 80;
  const x = clamp(baseX + ((pathHash % 9) - 4), 8, 92);
  const y = clamp(18 + lane * 15 + (((pathHash >> 3) % 8) - 4), 12, 86);
  const activity = scoreActivity(entry.modified, now);
  const species = classifySpecies(entry);
  const hue = (hashString(`${entry.extension}:${species}`) % 360);
  const rarity = entry.is_dir
    ? 'Anchor beast'
    : entry.size > 5_000_000
      ? 'Leviathan'
      : activity > 0.72
        ? 'Current-touched'
        : 'Archive drifter';

  return {
    id: entry.path,
    path: entry.path,
    name: entry.name,
    extension: entry.extension,
    isDirectory: entry.is_dir,
    size: entry.size,
    modified: entry.modified,
    species,
    lane,
    x,
    y,
    scale: entry.is_dir ? 1 + entry.depth * 0.08 : 0.92 + Math.min(entry.size / 2_000_000, 0.22),
    speedMs: Math.max(5200, 12000 - ((pathHash % 2800) + Math.round(activity * 1800))),
    activity,
    rarity,
    hue,
  };
}

function classifySpecies(entry: FileEntry): string {
  if (entry.is_dir) {
    return 'reefback';
  }

  const extension = (entry.extension || '').toLowerCase();
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(extension)) {
    return 'jelly';
  }
  if (['mp4', 'mov', 'webm', 'mp3', 'wav', 'flac'].includes(extension)) {
    return 'ray';
  }
  if (['rs', 'ts', 'tsx', 'js', 'jsx', 'py', 'go', 'java', 'cpp', 'c', 'h'].includes(extension)) {
    return 'angler';
  }
  if (['md', 'txt', 'pdf', 'doc', 'docx', 'rtf'].includes(extension)) {
    return 'kitefin';
  }
  if (['zip', 'tar', 'gz', '7z'].includes(extension)) {
    return 'urchin';
  }
  return 'minnow';
}

function scoreActivity(modified: number, now: number): number {
  const ageMs = Math.max(now - modified, 0);
  const oneHour = 1000 * 60 * 60;
  const oneDay = oneHour * 24;
  const oneWeek = oneDay * 7;
  if (ageMs <= oneHour) {
    return 1;
  }
  if (ageMs <= oneDay) {
    return 0.78;
  }
  if (ageMs <= oneWeek) {
    return 0.52;
  }
  if (ageMs <= oneWeek * 4) {
    return 0.28;
  }
  return 0.12;
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatBytes(value: number): string {
  if (value <= 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const sized = value / (1024 ** exponent);
  return `${sized.toFixed(sized >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function formatRelativeTime(timestamp: number): string {
  const deltaMs = Date.now() - timestamp;
  const minutes = Math.floor(deltaMs / (1000 * 60));
  if (minutes < 1) {
    return 'just now';
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 30) {
    return `${days}d ago`;
  }
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function createBubbleSeeds(count: number): Array<{ id: string; left: number; size: number; duration: number; delay: number }> {
  return Array.from({ length: count }, (_, index) => ({
    id: `bubble-${index}`,
    left: 8 + ((index * 13) % 84),
    size: 6 + (index % 4) * 4,
    duration: 5400 + (index % 5) * 1200,
    delay: index * 430,
  }));
}

function readPersistedOpenRequest(): AquariumOpenRequest | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(AQUARIUM_OPEN_REQUEST_STORAGE_KEY);
    if (!rawValue) {
      return null;
    }
    const parsed = JSON.parse(rawValue) as Partial<AquariumOpenRequest>;
    if (typeof parsed.path !== 'string' || !parsed.path.trim()) {
      return null;
    }
    if (typeof parsed.nonce !== 'string' || !parsed.nonce.trim()) {
      return null;
    }
    return {
      path: parsed.path.trim(),
      requestedAt: typeof parsed.requestedAt === 'number' ? parsed.requestedAt : 0,
      nonce: parsed.nonce,
    };
  } catch {
    return null;
  }
}

function ActionButton({ label, onClick, accent, quiet = false }: { label: string; onClick: () => void; accent: string; quiet?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        borderRadius: 14,
        border: quiet ? '1px solid rgba(183, 233, 255, 0.18)' : `1px solid ${accent}`,
        background: quiet ? 'rgba(5, 18, 28, 0.72)' : `linear-gradient(135deg, ${accent}, rgba(255, 255, 255, 0.88))`,
        color: quiet ? '#eaf9ff' : '#031018',
        padding: '11px 14px',
        fontSize: 12,
        fontWeight: 800,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

function MetricCapsule({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{ borderRadius: 999, border: '1px solid rgba(183, 233, 255, 0.18)', padding: '8px 12px', background: 'rgba(5, 18, 28, 0.56)' }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(214, 237, 255, 0.66)' }}>{label}</div>
      <div style={{ marginTop: 3, fontSize: 12, fontWeight: 800, color: accent }}>{value}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 18, marginBottom: 10, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'rgba(214, 237, 255, 0.66)' }}>
      {children}
    </div>
  );
}

function ReadoutCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={detailPanelStyle()}>
      <div style={{ fontSize: 11, color: 'rgba(214, 237, 255, 0.66)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 18, fontWeight: 800 }}>{value}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12, lineHeight: 1.5 }}>
      <span style={{ color: 'rgba(214, 237, 255, 0.66)' }}>{label}</span>
      <span style={{ textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function EmptyHabitatPanel({ accent, textMuted }: { accent: string; textMuted: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 24,
        borderRadius: 28,
        border: '1px dashed rgba(183, 233, 255, 0.2)',
        background: 'rgba(4, 16, 26, 0.44)',
        display: 'grid',
        placeItems: 'center',
        textAlign: 'center',
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 580 }}>
        <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.04em', color: accent }}>
          Empty Tank
        </div>
        <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.7, color: textMuted }}>
          Give the aquarium a real folder path. Project roots turn into dense coral systems. Screenshots become glowing jelly schools. Notes and docs drift like paper kites.
        </div>
      </div>
    </div>
  );
}

function overlayMessageStyle(background: string): React.CSSProperties {
  return {
    position: 'absolute',
    top: 18,
    left: '50%',
    transform: 'translateX(-50%)',
    borderRadius: 999,
    padding: '10px 14px',
    background,
    color: '#f5fbff',
    fontSize: 12,
    fontWeight: 700,
    zIndex: 2,
  };
}

function detailPanelStyle(): React.CSSProperties {
  return {
    borderRadius: 18,
    border: '1px solid rgba(183, 233, 255, 0.16)',
    background: 'rgba(5, 18, 28, 0.66)',
    padding: 14,
  };
}

function memoryMoteStyle(label: string, accent: string): React.CSSProperties {
  return {
    borderRadius: 999,
    padding: '7px 10px',
    fontSize: 11,
    fontWeight: 700,
    border: '1px solid rgba(183, 233, 255, 0.16)',
    background: label === 'dir' ? `color-mix(in srgb, ${accent} 18%, rgba(5, 18, 28, 0.74))` : 'rgba(5, 18, 28, 0.74)',
    color: '#eaf9ff',
  };
}

export default definePlugin({
  id: 'filesystem-aquarium',
  name: 'Filesystem Aquarium',
  description: 'A living reef where files become creatures, folders become biomes, and recent activity reshapes the weather.',
  keepMounted: true,
  component: FilesystemAquarium,
});
