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
  surfaceOwnership: {
    chrome: true,
    launcher: true,
    contentFrame: true,
    pinnedPanels: false,
    wallpaper: true,
  },
  component({ host }) {
    const launcherWidth = host.shellModel.layout.regions.launcher.width || 280;

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
            gridTemplateColumns: `${launcherWidth}px minmax(0, 1fr)`,
            width: '100%',
            minHeight: 0,
            padding: host.shellModel.layout.shellInset + 12,
            gap: Math.max(12, host.shellModel.layout.panelGap),
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
              minHeight: 0,
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
              gap: 12,
            }}
          >
            {host.renderUtilityActionsSurface()}
            <div style={{ flex: 1, minHeight: 0 }}>
              {host.renderDefaultContentSurface()}
            </div>
          </section>
        </div>
      </div>
    );
  },
});
