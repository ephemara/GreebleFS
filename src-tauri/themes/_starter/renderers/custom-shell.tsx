import { defineThemeRenderer } from 'overlayterm-theme-renderer';

export default defineThemeRenderer({
  name: 'Custom Shell',
  apiVersion: 1,
  supportsLiveSwap: true,
  fallbackRuntime: 'workbench-tabs',
  capabilities: {
    customScreens: true,
    wallpaperScene: true,
    surfaceAdapters: true,
  },
  component({ host }) {
    return (
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {host.wallpaper.renderBackdropStack()}

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'grid',
            gridTemplateColumns: '280px minmax(0, 1fr)',
            width: '100%',
            minHeight: 0,
          }}
        >
          <aside
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              padding: 18,
              borderRight: '1px solid var(--overlay-workbench-chrome-border)',
              background: 'color-mix(in srgb, var(--overlay-bg-shell) 84%, transparent)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }}
          >
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>
                {host.theme.name}
              </div>
            </div>
            {host.renderDefaultNavigationSurface()}
          </aside>

          <section
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              minWidth: 0,
              minHeight: 0,
            }}
          >
            {host.renderChromeBar()}
            <div style={{ flex: 1, minHeight: 0 }}>
              {host.renderDefaultContentSurface()}
            </div>
          </section>
        </div>
      </div>
    );
  },
});
