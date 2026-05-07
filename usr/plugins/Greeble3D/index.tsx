import React, { useMemo, useState } from 'react';
import { definePlugin } from 'overlayterm-plugin';

function buildFileUrl(absolutePath) {
  const normalizedPath = absolutePath.replace(/\\/g, '/');
  return normalizedPath.startsWith('/')
    ? `file://${encodeURI(normalizedPath)}`
    : `file:///${encodeURI(normalizedPath)}`;
}

function buildHierarchicalAssetUrl(absolutePath, referenceUrl) {
  if (!absolutePath) {
    return '';
  }

  if (!referenceUrl) {
    return buildFileUrl(absolutePath);
  }

  try {
    const parsedReferenceUrl = new URL(referenceUrl);
    if (parsedReferenceUrl.protocol === 'file:') {
      return buildFileUrl(absolutePath);
    }

    // `convertFileSrc(...)` flattens the whole absolute path into one encoded segment,
    // which breaks relative HTML/JS asset resolution for standalone app bundles.
    const normalizedPath = absolutePath.replace(/\\/g, '/');
    const encodedSegments = normalizedPath
      .split('/')
      .filter(Boolean)
      .map((segment) => encodeURIComponent(segment));

    return `${parsedReferenceUrl.protocol}//${parsedReferenceUrl.host}/${encodedSegments.join('/')}`;
  } catch {
    return buildFileUrl(absolutePath);
  }
}

function Greeble3DWorkbenchPanel({ api, host, appearance }) {
  const [frameLoaded, setFrameLoaded] = useState(false);
  const panelUrl = useMemo(() => {
    const entryPath = api.assets?.resolvePath('dist/app/index.html') ?? '';
    const referenceUrl = api.assets?.resolveUrl('dist/app/index.html') ?? '';
    const baseUrl = buildHierarchicalAssetUrl(entryPath, referenceUrl);
    if (!baseUrl) {
      return '';
    }

    const panelEntryUrl = new URL(baseUrl);
    panelEntryUrl.searchParams.set('embedded', '1');
    panelEntryUrl.searchParams.set('host', 'greeblefs');
    return panelEntryUrl.toString();
  }, [api.assets]);

  const compact = host?.compact ?? false;
  const accent = appearance.cssVars['--overlay-accent'] ?? 'var(--overlay-accent)';

  if (!panelUrl) {
    return (
      <div
        style={{
          flex: 1,
          display: 'grid',
          placeItems: 'center',
          padding: 24,
          color: 'var(--overlay-text-primary)',
          background: 'var(--overlay-bg-panel)',
          fontFamily: 'var(--overlay-font-ui, sans-serif)',
        }}
      >
        Greeble3D could not resolve its bundled app entry.
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden',
        background: '#050505',
      }}
    >
      {!frameLoaded ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            display: 'grid',
            placeItems: 'center',
            background:
              'radial-gradient(circle at top, rgba(71, 85, 105, 0.22), rgba(5, 5, 5, 0.96) 60%)',
            color: 'var(--overlay-text-primary)',
            fontFamily: 'var(--overlay-font-ui, sans-serif)',
          }}
        >
          <div
            style={{
              display: 'grid',
              gap: 10,
              justifyItems: 'center',
              padding: compact ? 16 : 20,
              borderRadius: 16,
              border: `1px solid color-mix(in srgb, ${accent} 40%, transparent)`,
              background: 'rgba(4, 7, 11, 0.78)',
              boxShadow: '0 24px 80px rgba(0, 0, 0, 0.35)',
            }}
          >
            <div style={{ fontSize: compact ? 15 : 17, fontWeight: 700 }}>
              Booting Greeble3D
            </div>
            <div
              style={{
                maxWidth: 360,
                textAlign: 'center',
                fontSize: 12,
                lineHeight: 1.5,
                color: 'var(--overlay-text-muted)',
              }}
            >
              Loading the portable standalone build inside the workbench surface.
            </div>
          </div>
        </div>
      ) : null}
      <iframe
        title="Greeble3D Workbench"
        src={panelUrl}
        allow="fullscreen; clipboard-read; clipboard-write"
        onLoad={() => setFrameLoaded(true)}
        style={{
          flex: 1,
          width: '100%',
          height: '100%',
          minWidth: 0,
          minHeight: 0,
          border: 'none',
          background: '#050505',
        }}
      />
    </div>
  );
}

export default definePlugin({
  name: 'Greeble3D',
  description: 'Portable Greeble3D modeler panel.',
  component: Greeble3DWorkbenchPanel,
});
