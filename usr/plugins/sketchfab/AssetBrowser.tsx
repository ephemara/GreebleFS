import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  definePlugin,
  getPluginPanelOpenRequestEvent,
  readPluginPanelOpenRequest,
} from 'overlayterm-plugin';
import {
  Download,
  ExternalLink,
  FolderOpen,
  KeyRound,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import {
  requestSketchfabDownloadAsset,
  searchSketchfabModels,
  type SketchfabDownloadAsset,
  type SketchfabModelSummary,
} from './sketchfabService';

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

type OverlayPluginProps = {
  plugin: {
    id: string;
    name: string;
  };
  api: OverlayPluginApi;
  appearance: {
    theme: {
      palette?: {
        accent?: string;
        shellBackground?: string;
        panelBackground?: string;
        textPrimary?: string;
        textMuted?: string;
        border?: string;
      };
    };
  };
  host?: {
    compact: boolean;
    density: 'compact' | 'regular';
  };
};

type FileEntry = {
  name: string;
};

type SketchfabPluginSettings = {
  accessToken: string;
  targetDirectory: string;
  lastQuery: string;
  autoReveal: boolean;
};

const SETTINGS_STORAGE_FILE = 'settings.json';
const DESTINATION_PATH_PAYLOAD_KEY = 'destinationPath';
const MAX_RESULTS_PER_PAGE = 24;

function SketchfabBrowserPanel({ plugin, api, appearance, host }: OverlayPluginProps) {
  const palette = appearance.theme.palette ?? {};
  const accent = palette.accent ?? '#ff8b38';
  const textPrimary = palette.textPrimary ?? '#f7f6f3';
  const textMuted = palette.textMuted ?? 'rgba(247, 246, 243, 0.62)';
  const shellBackground = palette.shellBackground ?? '#111113';
  const panelBackground = palette.panelBackground ?? 'rgba(19, 19, 24, 0.92)';
  const borderColor = palette.border ?? 'rgba(255, 255, 255, 0.12)';
  const compact = host?.compact === true;

  const [query, setQuery] = useState('');
  const [targetDirectory, setTargetDirectory] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [autoReveal, setAutoReveal] = useState(true);
  const [models, setModels] = useState<SketchfabModelSummary[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [prevCursor, setPrevCursor] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [downloadingUid, setDownloadingUid] = useState('');
  const [statusMessage, setStatusMessage] = useState('Right-click any folder in Explorer and send it here, or type a target path manually.');
  const [errorMessage, setErrorMessage] = useState('');
  const lastHandledRequestNonceRef = useRef('');
  const searchRequestIdRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      try {
        const rawSettings = await api.storage?.readTextFile(SETTINGS_STORAGE_FILE);
        if (!rawSettings || cancelled) {
          return;
        }
        const parsed = JSON.parse(rawSettings) as Partial<SketchfabPluginSettings>;
        if (cancelled) {
          return;
        }
        setAccessToken(typeof parsed.accessToken === 'string' ? parsed.accessToken : '');
        setTargetDirectory(typeof parsed.targetDirectory === 'string' ? parsed.targetDirectory : '');
        setQuery(typeof parsed.lastQuery === 'string' ? parsed.lastQuery : '');
        setAutoReveal(parsed.autoReveal !== false);
      } catch {
        if (!cancelled) {
          setAutoReveal(true);
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

    void api.storage.writeTextFile(SETTINGS_STORAGE_FILE, JSON.stringify({
      accessToken,
      targetDirectory,
      lastQuery: query,
      autoReveal,
    }, null, 2));
  }, [accessToken, api.storage, autoReveal, query, targetDirectory]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const applyIncomingOpenRequest = (request: { nonce?: string; payload?: Record<string, string> } | null | undefined) => {
      const nextNonce = request?.nonce?.trim();
      const nextDestinationPath = request?.payload?.[DESTINATION_PATH_PAYLOAD_KEY]?.trim();
      if (!nextNonce || !nextDestinationPath || lastHandledRequestNonceRef.current === nextNonce) {
        return;
      }

      lastHandledRequestNonceRef.current = nextNonce;
      setTargetDirectory(nextDestinationPath);
      setErrorMessage('');
      setStatusMessage(`Target folder updated from Explorer: ${nextDestinationPath}`);
    };

    applyIncomingOpenRequest(readPluginPanelOpenRequest(plugin.id));

    const handleOpenRequest = (event: Event) => {
      applyIncomingOpenRequest((event as CustomEvent<{ nonce?: string; payload?: Record<string, string> }>).detail);
    };

    const eventName = getPluginPanelOpenRequestEvent(plugin.id);
    window.addEventListener(eventName, handleOpenRequest);
    return () => {
      window.removeEventListener(eventName, handleOpenRequest);
    };
  }, [plugin.id]);

  const canSearch = query.trim().length > 0;
  const canDownload = targetDirectory.trim().length > 0 && accessToken.trim().length > 0;
  const searchSummary = useMemo(() => {
    if (searching) {
      return 'Searching Sketchfab...';
    }
    if (models.length === 0) {
      return canSearch
        ? 'Search Sketchfab for downloadable models.'
        : 'Enter a search phrase to browse downloadable models.';
    }
    return `${models.length} shown${totalCount > models.length ? ` of ${formatInteger(totalCount)}` : ''}`;
  }, [canSearch, models.length, searching, totalCount]);

  const handleSearch = async (cursor?: string | null) => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return;
    }

    const requestId = searchRequestIdRef.current + 1;
    searchRequestIdRef.current = requestId;
    setSearching(true);
    setErrorMessage('');
    try {
      const result = await searchSketchfabModels(trimmedQuery, {
        accessToken,
        cursor,
        count: MAX_RESULTS_PER_PAGE,
      });
      if (searchRequestIdRef.current !== requestId) {
        return;
      }

      setModels(result.models);
      setTotalCount(result.totalCount);
      setNextCursor(result.nextCursor);
      setPrevCursor(result.prevCursor);
      setStatusMessage(result.models.length > 0
        ? `Loaded ${result.models.length} Sketchfab models for "${trimmedQuery}".`
        : `No downloadable Sketchfab models matched "${trimmedQuery}".`);
    } catch (error) {
      if (searchRequestIdRef.current === requestId) {
        setModels([]);
        setTotalCount(0);
        setNextCursor(null);
        setPrevCursor(null);
        setErrorMessage(String(error));
      }
    } finally {
      if (searchRequestIdRef.current === requestId) {
        setSearching(false);
      }
    }
  };

  const handleRevealTargetDirectory = async () => {
    const trimmedTargetDirectory = targetDirectory.trim();
    if (!trimmedTargetDirectory) {
      return;
    }
    await api.invoke('fs_reveal_in_explorer', { path: trimmedTargetDirectory });
  };

  const handleDownloadModel = async (model: SketchfabModelSummary) => {
    const trimmedTargetDirectory = targetDirectory.trim();
    if (!trimmedTargetDirectory) {
      setErrorMessage('Choose a destination folder before downloading.');
      return;
    }
    if (!accessToken.trim()) {
      setErrorMessage('Downloads require a Sketchfab OAuth access token.');
      return;
    }

    setDownloadingUid(model.uid);
    setErrorMessage('');
    setStatusMessage(`Preparing ${model.name}...`);

    try {
      const asset = await requestSketchfabDownloadAsset(model.uid, accessToken);
      const assetBytes = await fetchAssetBytes(asset.url);
      await api.invoke('fs_create_dir', { path: trimmedTargetDirectory });

      const assetFileName = await createUniqueLeafName(
        trimmedTargetDirectory,
        createPreferredAssetLeafName(model.name, asset),
        api,
      );
      const assetPath = joinPlatformPath(trimmedTargetDirectory, assetFileName);
      await api.invoke('fs_write_file', {
        path: assetPath,
        content: { kind: 'bytes', value: Array.from(assetBytes) },
      });

      const attributionLeafName = await createUniqueLeafName(
        trimmedTargetDirectory,
        `${removeLeafExtension(assetFileName)}.sketchfab.json`,
        api,
      );
      await api.invoke('fs_write_file', {
        path: joinPlatformPath(trimmedTargetDirectory, attributionLeafName),
        content: {
          kind: 'text',
          value: JSON.stringify(createAttributionPayload(model, asset, assetFileName), null, 2),
        },
      });

      if (autoReveal) {
        await api.invoke('fs_reveal_in_explorer', { path: assetPath });
      }

      setStatusMessage(`Saved ${assetFileName} into ${trimmedTargetDirectory}.`);
    } catch (error) {
      setErrorMessage(String(error));
    } finally {
      setDownloadingUid('');
    }
  };

  return (
    <div
      style={{
        height: '100%',
        minHeight: 0,
        display: 'grid',
        gridTemplateColumns: compact ? '1fr' : 'minmax(0, 1.7fr) minmax(300px, 0.9fr)',
        background: `radial-gradient(circle at 0% 0%, ${multiplyAlpha(accent, 0.18)} 0%, transparent 36%), linear-gradient(180deg, ${shellBackground} 0%, #09090d 100%)`,
        color: textPrimary,
      }}
    >
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', borderRight: compact ? 'none' : `1px solid ${borderColor}` }}>
        <header style={{ padding: compact ? 18 : 24, borderBottom: `1px solid ${borderColor}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase', color: multiplyAlpha(accent, 0.95), fontWeight: 700 }}>
                Sketchfab Ingest
              </div>
              <div style={{ marginTop: 8, fontSize: compact ? 24 : 30, fontWeight: 800, lineHeight: 1.05 }}>
                Search downloadable 3D assets and drop them straight into your filesystem.
              </div>
              <div style={{ marginTop: 10, maxWidth: 760, color: textMuted, fontSize: 13, lineHeight: 1.6 }}>
                This panel keeps the destination folder explicit, accepts Explorer handoffs, and writes the downloaded asset plus a small Sketchfab attribution manifest beside it.
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <InfoBadge label="Target" value={targetDirectory.trim() ? 'Bound' : 'Unset'} accent={accent} />
              <InfoBadge label="Token" value={accessToken.trim() ? 'Loaded' : 'Required'} accent={accent} />
              <InfoBadge label="Results" value={searching ? '...' : formatInteger(totalCount)} accent={accent} />
            </div>
          </div>

          <form
            onSubmit={event => {
              event.preventDefault();
              void handleSearch(null);
            }}
            style={{ marginTop: 18, display: 'flex', gap: 10, flexWrap: 'wrap' }}
          >
            <label style={{ flex: 1, minWidth: 260 }}>
              <span style={sectionLabelStyle(textMuted)}>Search Sketchfab</span>
              <div style={fieldShellStyle(panelBackground, borderColor)}>
                <Search size={16} color={textMuted} />
                <input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="stylized ruins, modular sci fi, photogrammetry rock..."
                  style={fieldInputStyle(textPrimary)}
                />
              </div>
            </label>

            <button type="submit" disabled={!canSearch || searching} style={primaryButtonStyle(accent, !canSearch || searching)}>
              {searching ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
              <span>{searching ? 'Searching' : 'Search'}</span>
            </button>
          </form>

          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', color: textMuted, fontSize: 12 }}>
            <span>{searchSummary}</span>
            <button type="button" disabled={!prevCursor || searching} onClick={() => void handleSearch(prevCursor)} style={secondaryButtonStyle(borderColor, textPrimary, !prevCursor || searching)}>
              Previous
            </button>
            <button type="button" disabled={!nextCursor || searching} onClick={() => void handleSearch(nextCursor)} style={secondaryButtonStyle(borderColor, textPrimary, !nextCursor || searching)}>
              Next
            </button>
          </div>
        </header>

        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: compact ? 16 : 20 }}>
          {models.length === 0 ? (
            <EmptyStateCard
              accent={accent}
              title="No models loaded yet"
              body="Run a search to browse downloadable Sketchfab models. Search is public, but downloads require an OAuth access token."
            />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fill, minmax(250px, 1fr))', gap: 14 }}>
              {models.map(model => {
                const downloading = downloadingUid === model.uid;
                return (
                  <article key={model.uid} style={resultCardStyle(panelBackground, borderColor)}>
                    <div style={thumbnailShellStyle(borderColor, model.thumbnailUrl)}>
                      {model.thumbnailUrl ? (
                        <img src={model.thumbnailUrl} alt={model.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ color: textMuted, fontSize: 12 }}>No preview</div>
                      )}
                    </div>

                    <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.2 }}>{model.name}</div>
                        <div style={{ marginTop: 6, color: textMuted, fontSize: 12 }}>
                          {model.author.displayName}
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {model.license?.label ? <TagChip label={model.license.label} accent={accent} /> : null}
                        {model.vertexCount ? <TagChip label={`${formatInteger(model.vertexCount)} verts`} accent={accent} /> : null}
                        {model.animationCount ? <TagChip label={`${formatInteger(model.animationCount)} anim`} accent={accent} /> : null}
                        {model.archivesAvailable.length > 0 ? (
                          <TagChip label={model.archivesAvailable.join(' / ')} accent={accent} />
                        ) : null}
                      </div>

                      {model.description ? (
                        <div style={{ color: textMuted, fontSize: 12, lineHeight: 1.55 }}>
                          {truncateText(model.description, 180)}
                        </div>
                      ) : null}

                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => void handleDownloadModel(model)}
                          disabled={!canDownload || downloading}
                          style={primaryButtonStyle(accent, !canDownload || downloading)}
                        >
                          {downloading ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
                          <span>{downloading ? 'Saving...' : 'Download Here'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => window.open(model.viewerUrl, '_blank', 'noopener,noreferrer')}
                          style={secondaryButtonStyle(borderColor, textPrimary, !model.viewerUrl)}
                          disabled={!model.viewerUrl}
                        >
                          <ExternalLink size={14} />
                          <span>Viewer</span>
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <aside style={{ minWidth: 0, padding: compact ? 16 : 20, display: 'flex', flexDirection: 'column', gap: 14, background: multiplyAlpha(panelBackground, 0.92) }}>
        <SidebarCard title="Destination Folder" icon={<FolderOpen size={16} color={accent} />} borderColor={borderColor}>
          <label style={{ display: 'block' }}>
            <span style={sectionLabelStyle(textMuted)}>Target path</span>
            <div style={fieldShellStyle(panelBackground, borderColor)}>
              <input
                value={targetDirectory}
                onChange={event => setTargetDirectory(event.target.value)}
                placeholder="/path/to/assets or D:\\Assets\\Characters"
                style={fieldInputStyle(textPrimary)}
              />
            </div>
          </label>
          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => void handleRevealTargetDirectory()} disabled={!targetDirectory.trim()} style={secondaryButtonStyle(borderColor, textPrimary, !targetDirectory.trim())}>
              Reveal Target
            </button>
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: textMuted, lineHeight: 1.55 }}>
            Explorer background and folder context menus can push a directory straight into this field.
          </div>
        </SidebarCard>

        <SidebarCard title="Download Auth" icon={<KeyRound size={16} color={accent} />} borderColor={borderColor}>
          <label style={{ display: 'block' }}>
            <span style={sectionLabelStyle(textMuted)}>Sketchfab OAuth access token</span>
            <div style={fieldShellStyle(panelBackground, borderColor)}>
              <input
                value={accessToken}
                onChange={event => setAccessToken(event.target.value)}
                placeholder="Paste your Sketchfab OAuth access token"
                style={fieldInputStyle(textPrimary)}
              />
            </div>
          </label>
          <label style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center', fontSize: 12, color: textMuted }}>
            <input
              type="checkbox"
              checked={autoReveal}
              onChange={event => setAutoReveal(event.target.checked)}
            />
            Reveal the downloaded file in Explorer after saving it
          </label>
        </SidebarCard>

        <SidebarCard title="Notes" icon={<ShieldCheck size={16} color={accent} />} borderColor={borderColor}>
          <ul style={{ margin: 0, paddingLeft: 18, color: textMuted, fontSize: 12, lineHeight: 1.7 }}>
            <li>Search is public. Downloads require a valid Sketchfab OAuth access token.</li>
            <li>The plugin writes the downloaded asset and a sibling `.sketchfab.json` attribution file.</li>
            <li>When Sketchfab only exposes a glTF archive, this plugin saves the archive directly instead of unpacking it.</li>
          </ul>
        </SidebarCard>

        <div
          style={{
            marginTop: 'auto',
            padding: 14,
            borderRadius: 16,
            border: `1px solid ${errorMessage ? 'rgba(255, 106, 106, 0.35)' : borderColor}`,
            background: errorMessage ? 'rgba(96, 24, 24, 0.28)' : 'rgba(255,255,255,0.03)',
            color: errorMessage ? '#ffb6b6' : textMuted,
            fontSize: 12,
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
          }}
        >
          {errorMessage || statusMessage}
        </div>
      </aside>
    </div>
  );
}

function InfoBadge({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{
      borderRadius: 999,
      border: `1px solid ${multiplyAlpha(accent, 0.28)}`,
      background: multiplyAlpha(accent, 0.12),
      padding: '8px 12px',
      minWidth: 90,
    }}
    >
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', opacity: 0.62 }}>{label}</div>
      <div style={{ marginTop: 3, fontSize: 12, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function SidebarCard(args: {
  title: string;
  icon: React.ReactNode;
  borderColor: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ borderRadius: 18, border: `1px solid ${args.borderColor}`, padding: 16, background: 'rgba(255,255,255,0.03)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        {args.icon}
        <div style={{ fontSize: 13, fontWeight: 700 }}>{args.title}</div>
      </div>
      {args.children}
    </section>
  );
}

function EmptyStateCard({ accent, title, body }: { accent: string; title: string; body: string }) {
  return (
    <div style={{
      borderRadius: 22,
      border: `1px dashed ${multiplyAlpha(accent, 0.38)}`,
      padding: 22,
      background: multiplyAlpha(accent, 0.08),
    }}
    >
      <div style={{ fontSize: 18, fontWeight: 700 }}>{title}</div>
      <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.65, opacity: 0.76 }}>{body}</div>
    </div>
  );
}

function TagChip({ label, accent }: { label: string; accent: string }) {
  return (
    <div style={{
      borderRadius: 999,
      border: `1px solid ${multiplyAlpha(accent, 0.26)}`,
      padding: '4px 8px',
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
      background: multiplyAlpha(accent, 0.1),
    }}
    >
      {label}
    </div>
  );
}

async function fetchAssetBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Sketchfab asset download failed.');
  }
  return new Uint8Array(await response.arrayBuffer());
}

async function createUniqueLeafName(
  directoryPath: string,
  preferredLeafName: string,
  api: OverlayPluginApi,
): Promise<string> {
  const trimmedPreferredLeafName = preferredLeafName.trim();
  if (!trimmedPreferredLeafName) {
    return 'download.bin';
  }

  let entries: FileEntry[] = [];
  try {
    entries = await api.invoke<FileEntry[]>('fs_list_dir', { path: directoryPath, showHidden: false });
  } catch {
    return trimmedPreferredLeafName;
  }

  const existingNames = new Set(entries.map(entry => entry.name));
  if (!existingNames.has(trimmedPreferredLeafName)) {
    return trimmedPreferredLeafName;
  }

  const baseName = removeLeafExtension(trimmedPreferredLeafName);
  const extension = getLeafExtension(trimmedPreferredLeafName);
  for (let index = 2; index < 1000; index += 1) {
    const candidate = extension
      ? `${baseName}-${index}.${extension}`
      : `${baseName}-${index}`;
    if (!existingNames.has(candidate)) {
      return candidate;
    }
  }

  return `${baseName}-${Date.now()}.${extension || 'bin'}`;
}

function createPreferredAssetLeafName(modelName: string, asset: SketchfabDownloadAsset): string {
  const safeBaseName = sanitizeLeafName(modelName) || 'sketchfab-model';
  const safeExtension = sanitizeLeafName(asset.fileExtension).replace(/[^a-z0-9]/g, '') || 'bin';
  return `${safeBaseName}.${safeExtension}`;
}

function createAttributionPayload(
  model: SketchfabModelSummary,
  asset: SketchfabDownloadAsset,
  savedFileName: string,
): Record<string, unknown> {
  return {
    source: 'Sketchfab',
    modelUid: model.uid,
    modelName: model.name,
    viewerUrl: model.viewerUrl,
    savedFileName,
    savedFormat: asset.format,
    savedArchive: asset.archive,
    downloadedAt: new Date().toISOString(),
    author: {
      displayName: model.author.displayName,
      username: model.author.username,
      profileUrl: model.author.profileUrl,
    },
    license: model.license,
  };
}

function joinPlatformPath(basePath: string, leafName: string): string {
  const separator = basePath.includes('\\') && !basePath.includes('/') ? '\\' : '/';
  return basePath.endsWith(separator)
    ? `${basePath}${leafName}`
    : `${basePath}${separator}${leafName}`;
}

function sanitizeLeafName(value: string): string {
  return value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/\.+$/g, '')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
}

function removeLeafExtension(value: string): string {
  return value.replace(/\.[^.]+$/, '');
}

function getLeafExtension(value: string): string {
  const extension = value.split('.').pop();
  return extension && extension !== value ? extension : '';
}

function truncateText(value: string, limit: number): string {
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, limit - 1).trimEnd()}…`;
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function multiplyAlpha(color: string, alpha: number): string {
  if (color.startsWith('#')) {
    const normalized = color.slice(1);
    const hex = normalized.length === 3
      ? normalized.split('').map(part => part + part).join('')
      : normalized.slice(0, 6);
    const red = Number.parseInt(hex.slice(0, 2), 16);
    const green = Number.parseInt(hex.slice(2, 4), 16);
    const blue = Number.parseInt(hex.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }
  return color;
}

function sectionLabelStyle(textMuted: string): React.CSSProperties {
  return {
    display: 'block',
    marginBottom: 7,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: textMuted,
  };
}

function fieldShellStyle(background: string, borderColor: string): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    border: `1px solid ${borderColor}`,
    background,
    padding: '0 12px',
    minHeight: 44,
  };
}

function fieldInputStyle(textPrimary: string): React.CSSProperties {
  return {
    flex: 1,
    minWidth: 0,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    color: textPrimary,
    fontSize: 13,
  };
}

function primaryButtonStyle(accent: string, disabled: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    border: 'none',
    borderRadius: 14,
    padding: '0 16px',
    minHeight: 44,
    background: disabled ? 'rgba(255,255,255,0.12)' : accent,
    color: disabled ? 'rgba(255,255,255,0.45)' : '#111113',
    fontWeight: 800,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}

function secondaryButtonStyle(borderColor: string, textPrimary: string, disabled: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    border: `1px solid ${borderColor}`,
    padding: '9px 12px',
    background: disabled ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.05)',
    color: disabled ? 'rgba(255,255,255,0.4)' : textPrimary,
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}

function resultCardStyle(background: string, borderColor: string): React.CSSProperties {
  return {
    borderRadius: 22,
    border: `1px solid ${borderColor}`,
    background,
    padding: 14,
  };
}

function thumbnailShellStyle(borderColor: string, thumbnailUrl: string | null): React.CSSProperties {
  return {
    borderRadius: 18,
    border: `1px solid ${borderColor}`,
    aspectRatio: '16 / 10',
    overflow: 'hidden',
    background: thumbnailUrl
      ? 'rgba(255,255,255,0.03)'
      : 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
    display: 'grid',
    placeItems: 'center',
  };
}

export default definePlugin({
  name: 'Sketchfab Browser',
  description: 'Search Sketchfab and download downloadable 3D assets into the active Explorer folder.',
  keepMounted: true,
  component: SketchfabBrowserPanel,
});
