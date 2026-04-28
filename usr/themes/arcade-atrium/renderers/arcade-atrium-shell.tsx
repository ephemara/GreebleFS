import { Waves } from 'lucide-react';
import { defineThemeRenderer } from 'overlayterm-theme-renderer';

export default defineThemeRenderer({
  name: 'Arcade Atrium Shell',
  apiVersion: 1,
  supportsLiveSwap: true,
  fallbackRuntime: 'channel-launcher',
  capabilities: {
    customScreens: true,
    wallpaperScene: true,
    surfaceAdapters: true,
  },
  component({ host }) {
    const launcherPanels = host.panels.filter(panel => !panel.isPinned);
    const activePanel = launcherPanels.find(panel => panel.id === host.activePanelId) ?? launcherPanels[0] ?? null;

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
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0) 28%), radial-gradient(circle at 82% 12%, rgba(255,147,79,0.08), transparent 20%)',
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'grid',
            gridTemplateColumns: '320px minmax(0, 1fr)',
            width: '100%',
            minHeight: 0,
            padding: 18,
            gap: 16,
          }}
        >
          <aside
            style={{
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              gap: 12,
              padding: 16,
              borderRadius: 28,
              border: '1px solid rgba(35, 183, 255, 0.14)',
              background: 'rgba(255,255,255,0.32)',
              boxShadow: '0 18px 42px rgba(17, 55, 76, 0.1)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#1d4d66' }}>
                <Waves size={18} />
                <div>
                  <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.6 }}>
                    Arcade Atrium
                  </div>
                  <div style={{ marginTop: 4, fontSize: 18, fontWeight: 700 }}>
                    Launch Surfaces
                  </div>
                </div>
              </div>

              {activePanel ? (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 10px',
                    borderRadius: 999,
                    background: 'rgba(255,255,255,0.58)',
                    color: '#1d4d66',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  <span>{activePanel.label}</span>
                  {activePanel.isOpen ? (
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: activePanel.isActive ? '#23b7ff' : '#ff934f',
                      }}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0, overflow: 'auto', paddingRight: 2 }}>
              {launcherPanels.map(panel => {
                const isActive = panel.isActive;
                return (
                  <button
                    key={panel.id}
                    onClick={() => host.activatePanel(panel.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                      padding: '14px 14px 15px',
                      borderRadius: 22,
                      border: isActive
                        ? '1px solid rgba(35,183,255,0.28)'
                        : '1px solid rgba(36,96,126,0.08)',
                      background: isActive
                        ? 'linear-gradient(180deg, rgba(255,255,255,0.92), rgba(223,247,255,0.84))'
                        : 'rgba(255,255,255,0.54)',
                      boxShadow: isActive ? '0 10px 28px rgba(35,183,255,0.12)' : 'none',
                      color: '#123148',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <span
                      style={{
                        width: 38,
                        height: 38,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 15,
                        flexShrink: 0,
                        background: isActive ? 'rgba(35,183,255,0.14)' : 'rgba(255,255,255,0.62)',
                        color: isActive ? '#109be0' : '#26445a',
                      }}
                    >
                      {panel.icon}
                    </span>

                    <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>{panel.label}</span>
                        {panel.isOpen ? (
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: panel.isActive ? '#23b7ff' : '#ff934f',
                            }}
                          />
                        ) : null}
                      </span>
                      <span style={{ fontSize: 11, lineHeight: 1.45, color: 'rgba(18,49,72,0.66)' }}>
                        {panel.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              minWidth: 0,
              minHeight: 0,
              gap: 12,
            }}
          >
            {host.renderChromeBar()}

            <div style={{ display: 'flex', flex: 1, minHeight: 0, minWidth: 0, gap: 12 }}>
              {host.renderPinnedPanels('left')}
              <div style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
                {host.renderDefaultContentSurface()}
              </div>
              {host.renderPinnedPanels('right')}
            </div>
          </div>
        </div>
      </div>
    );
  },
});
