import React from 'react';
import { Camera, FolderOpen, Image, RefreshCcw, Search } from 'lucide-react';
import { definePlugin } from 'overlayterm-plugin';

const GALLERY_LIMIT = 240;
const DEFAULT_GALLERY_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'svg',
  'bmp',
  'ico',
  'avif',
  'tiff',
  'tif',
];

const panelStyle = {
  display: 'grid',
  gridTemplateRows: 'auto 1fr',
  height: '100%',
  minHeight: 0,
  overflow: 'hidden',
  color: 'var(--overlay-text-primary)',
  background: 'var(--overlay-surface-base)',
  fontFamily: 'var(--overlay-font-ui, sans-serif)',
};

const headerStyle = {
  display: 'grid',
  gap: 12,
  padding: 16,
  borderBottom: '1px solid var(--overlay-border-subtle)',
  background: 'var(--overlay-surface-raised)',
};

const titleRowStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
};

const titleStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  minWidth: 0,
  fontSize: 16,
  fontWeight: 700,
};

const toolbarStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(160px, 1fr) auto',
  gap: 10,
  alignItems: 'center',
};

const searchBoxStyle = {
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
  alignItems: 'center',
  gap: 8,
  minHeight: 36,
  padding: '0 10px',
  border: '1px solid var(--overlay-border-muted)',
  borderRadius: 6,
  background: 'var(--overlay-surface-base)',
};

const inputStyle = {
  minWidth: 0,
  border: 0,
  outline: 'none',
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
};

const buttonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  minHeight: 36,
  padding: '0 12px',
  border: '1px solid var(--overlay-border-muted)',
  borderRadius: 6,
  background: 'var(--overlay-button-secondary-bg, var(--overlay-surface-base))',
  color: 'var(--overlay-text-primary)',
  cursor: 'pointer',
  font: 'inherit',
  fontWeight: 600,
};

const statusStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: 10,
  minHeight: 24,
  color: 'var(--overlay-text-secondary)',
  fontSize: 12,
};

const gridWrapStyle = {
  minHeight: 0,
  overflowX: 'hidden',
  overflowY: 'auto',
  padding: 16,
};

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(128px, 1fr))',
  gap: 12,
};

const tileStyle = {
  display: 'grid',
  gridTemplateRows: 'minmax(0, 1fr) auto',
  aspectRatio: '1 / 1.18',
  minWidth: 0,
  overflow: 'hidden',
  border: '1px solid var(--overlay-border-subtle)',
  borderRadius: 8,
  background: 'var(--overlay-surface-raised)',
  color: 'inherit',
  cursor: 'pointer',
  padding: 0,
  textAlign: 'left',
};

const imageFrameStyle = {
  minHeight: 0,
  overflow: 'hidden',
  background: 'var(--overlay-surface-sunken, #101217)',
};

const imageStyle = {
  display: 'block',
  width: '100%',
  height: '100%',
  objectFit: 'cover',
};

const captionStyle = {
  display: 'grid',
  gap: 2,
  padding: 8,
  minWidth: 0,
};

const nameStyle = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: 12,
  fontWeight: 650,
};

const pathStyle = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: 'var(--overlay-text-muted)',
  fontSize: 11,
};

const emptyStateStyle = {
  display: 'grid',
  justifyItems: 'center',
  alignContent: 'center',
  gap: 12,
  minHeight: 260,
  color: 'var(--overlay-text-secondary)',
  textAlign: 'center',
};

function formatCount(count) {
  return `${count.toLocaleString()} ${count === 1 ? 'picture' : 'pictures'}`;
}

function parseTextList(value, splitPattern) {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => parseTextList(entry, splitPattern));
  }
  if (typeof value !== 'string') {
    return [];
  }
  return value
    .split(splitPattern)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseRootPaths(value) {
  return [...new Set(parseTextList(value, /[\n\r;]+/g))];
}

function parseExtensions(value) {
  const parsed = parseTextList(value, /[\n\r,;\s]+/g)
    .map((extension) => extension.replace(/^\.+/, '').toLowerCase())
    .filter((extension) => /^[a-z0-9]{1,24}$/.test(extension));
  const unique = [...new Set(parsed)];
  return unique.length > 0 ? unique : DEFAULT_GALLERY_EXTENSIONS;
}

function readBooleanSetting(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

function readNumberSetting(value, fallback, min, max) {
  const candidate = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim()
      ? Number(value)
      : fallback;
  if (!Number.isFinite(candidate)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(candidate)));
}

function readGallerySettings(api) {
  const settings = api.settings;
  return {
    rootPaths: parseRootPaths(settings?.getValue('rootPaths', '') ?? ''),
    extensions: parseExtensions(
      settings?.getValue(
        'fileExtensions',
        DEFAULT_GALLERY_EXTENSIONS.join(', '),
      ) ?? DEFAULT_GALLERY_EXTENSIONS.join(', '),
    ),
    resultLimit: readNumberSetting(
      settings?.getValue('resultLimit', GALLERY_LIMIT),
      GALLERY_LIMIT,
      24,
      500,
    ),
    includeHidden: readBooleanSetting(
      settings?.getValue('includeHidden', false),
      false,
    ),
  };
}

function useGallerySettings(api) {
  const [gallerySettings, setGallerySettings] = React.useState(() =>
    readGallerySettings(api),
  );

  React.useEffect(() => {
    setGallerySettings(readGallerySettings(api));
    return api.settings?.subscribe(() => {
      setGallerySettings(readGallerySettings(api));
    });
  }, [api]);

  return gallerySettings;
}

function IndexPhotoGalleryPanel({ api }) {
  const [query, setQuery] = React.useState('');
  const [pictures, setPictures] = React.useState([]);
  const [status, setStatus] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const gallerySettings = useGallerySettings(api);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextStatus, nextPictures] = await Promise.all([
        api.index.global.init(),
        api.index.media.findPictures({
          query: query.trim() || null,
          limit: gallerySettings.resultLimit,
          rootPaths: gallerySettings.rootPaths,
          extensions: gallerySettings.extensions,
          includeHidden: gallerySettings.includeHidden,
        }),
      ]);
      setStatus(nextStatus);
      setPictures(nextPictures);
    } catch (caught) {
      setError(String(caught));
    } finally {
      setLoading(false);
    }
  }, [api, gallerySettings, query]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const startScan = React.useCallback(async () => {
    setError(null);
    try {
      await api.index.global.startScan(
        gallerySettings.rootPaths.length > 0
          ? { driveRoots: gallerySettings.rootPaths }
          : undefined,
      );
      const nextStatus = await api.index.global.getStatus();
      setStatus(nextStatus);
    } catch (caught) {
      setError(String(caught));
    }
  }, [api, gallerySettings.rootPaths]);

  const openPicture = React.useCallback(async (picture) => {
    await api.host.explorer.openPath(picture.path);
  }, [api]);

  const statusText = loading
    ? 'Loading index'
    : error
      ? error
      : formatCount(pictures.length);
  const indexText = status?.isIndexValid
    ? `${status.indexedItemCount.toLocaleString()} indexed items`
    : 'Index not ready';
  const scopeText = gallerySettings.rootPaths.length > 0
    ? `${gallerySettings.rootPaths.length} scoped ${gallerySettings.rootPaths.length === 1 ? 'folder' : 'folders'}`
    : 'All indexed folders';
  const typeText = `${gallerySettings.extensions.length} file types`;

  return (
    <section style={panelStyle}>
      <header style={headerStyle}>
        <div style={titleRowStyle}>
          <div style={titleStyle}>
            <Camera size={18} />
            <span>Index Photo Gallery</span>
          </div>
          <button
            type="button"
            style={buttonStyle}
            onClick={refresh}
            title="Refresh"
            aria-label="Refresh"
          >
            <RefreshCcw size={16} />
          </button>
        </div>
        <div style={toolbarStyle}>
          <label style={searchBoxStyle}>
            <Search size={15} />
            <input
              style={inputStyle}
              value={query}
              placeholder="Search pictures"
              onChange={(event) => setQuery(event.currentTarget.value)}
            />
          </label>
          <button type="button" style={buttonStyle} onClick={startScan}>
            <Image size={16} />
            <span>Scan</span>
          </button>
        </div>
        <div style={statusStyle}>
          <span>{statusText}</span>
          <span>{indexText}</span>
          <span>{scopeText}</span>
          <span>{typeText}</span>
        </div>
      </header>
      <div style={gridWrapStyle}>
        {pictures.length === 0 ? (
          <div style={emptyStateStyle}>
            <Image size={36} />
            <strong>No indexed pictures</strong>
            <button type="button" style={buttonStyle} onClick={startScan}>
              <RefreshCcw size={16} />
              <span>Start Scan</span>
            </button>
          </div>
        ) : (
          <div style={gridStyle}>
            {pictures.map((picture) => (
              <button
                key={picture.path}
                type="button"
                style={tileStyle}
                onClick={() => openPicture(picture)}
                title={picture.path}
              >
                <span style={imageFrameStyle}>
                  <img
                    alt={picture.name}
                    src={picture.assetUrl}
                    style={imageStyle}
                    loading="lazy"
                  />
                </span>
                <span style={captionStyle}>
                  <span style={nameStyle}>{picture.name}</span>
                  <span style={pathStyle}>
                    <FolderOpen size={11} />
                    {' '}
                    {picture.path}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default definePlugin({
  name: 'Index Photo Gallery',
  description: 'First-party gallery plugin backed by the global filename index.',
  keepMounted: true,
  component: IndexPhotoGalleryPanel,
});
