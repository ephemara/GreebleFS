import { defineThemeRenderer } from 'overlayterm-theme-renderer';

const rootStyle = {
  position: 'relative',
  display: 'flex',
  flex: 1,
  minHeight: 0,
  overflow: 'hidden',
} as const;

const backdropWashStyle = {
  position: 'absolute',
  inset: 0,
  background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.48), rgba(255, 255, 255, 0) 28%)',
  pointerEvents: 'none',
} as const;

const shellGridStyle = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gridTemplateColumns: 'minmax(220px, 248px) minmax(0, 1fr)',
  width: '100%',
  minHeight: 0,
  padding: 14,
  gap: 12,
} as const;

const sidebarStyle = {
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  gap: 12,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(15, 23, 42, 0.08)',
  background: 'rgba(255, 255, 255, 0.92)',
  boxShadow: '0 16px 36px rgba(15, 23, 42, 0.08)',
} as const;

const titleBlockStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
} as const;

const eyebrowStyle = {
  fontSize: 10,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: 'rgba(15, 23, 42, 0.5)',
} as const;

const titleStyle = {
  fontSize: 18,
  fontWeight: 600,
  lineHeight: 1.15,
  color: '#0f172a',
} as const;

const descriptionStyle = {
  fontSize: 12,
  lineHeight: 1.5,
  color: 'rgba(15, 23, 42, 0.64)',
} as const;

const navWrapStyle = {
  flex: 1,
  minHeight: 0,
  overflow: 'auto',
  paddingRight: 2,
} as const;

const mainStyle = {
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
  minHeight: 0,
  gap: 12,
} as const;

const contentRowStyle = {
  display: 'flex',
  flex: 1,
  minWidth: 0,
  minHeight: 0,
  gap: 12,
} as const;

const contentWrapStyle = {
  flex: 1,
  minWidth: 0,
  minHeight: 0,
} as const;

export default defineThemeRenderer({
  name: 'Clarity Line Shell',
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
      <div style={rootStyle}>
        {host.wallpaper.renderBackdropStack()}
        <div aria-hidden style={backdropWashStyle} />

        <div style={shellGridStyle}>
          <aside style={sidebarStyle}>
            <div style={titleBlockStyle}>
              <div style={eyebrowStyle}>Clarity Line</div>
              <div style={titleStyle}>{host.theme.name}</div>
              <div style={descriptionStyle}>
                {host.theme.description ?? 'Quiet editorial shell with calm contrast.'}
              </div>
            </div>

            <div style={navWrapStyle}>
              {host.renderDefaultNavigationSurface()}
            </div>
          </aside>

          <section style={mainStyle}>
            {host.renderUtilityActionsSurface()}

            <div style={contentRowStyle}>
              {host.renderPinnedPanels('left')}

              <div style={contentWrapStyle}>
                {host.renderDefaultContentSurface()}
              </div>

              {host.renderPinnedPanels('right')}
            </div>
          </section>
        </div>
      </div>
    );
  },
});
