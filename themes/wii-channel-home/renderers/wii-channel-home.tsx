import { defineThemeRenderer } from 'overlayterm-theme-renderer';

export default defineThemeRenderer({
  name: 'Wii Channel Home Shell',
  apiVersion: 1,
  supportsLiveSwap: true,
  fallbackRuntime: 'channel-launcher',
  capabilities: {
    customScreens: true,
    wallpaperScene: true,
    surfaceAdapters: true,
  },
  surfaceOwnership: {
    launcher: true,
    chrome: true,
    contentFrame: true,
    wallpaper: true,
  },
  component({ host }) {
    const panels = host.panels.filter(panel => !panel.isPinned);
    const activePanel = panels.find(panel => panel.id === host.activePanelId) ?? panels[0] ?? null;
    const featuredPanels = panels.slice(0, 6);

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
            background: 'linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0) 34%)',
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'grid',
            gridTemplateRows: 'auto minmax(0, 1fr) auto',
            width: '100%',
            minHeight: 0,
            padding: 18,
            gap: 16,
          }}
        >
          {host.renderChromeBar()}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) 280px',
              gap: 16,
              minHeight: 0,
            }}
          >
            <div
              style={{
                minHeight: 0,
                borderRadius: 34,
                border: '1px solid rgba(53,124,174,0.14)',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.88), rgba(245,250,255,0.76))',
                boxShadow: '0 26px 56px rgba(56, 108, 148, 0.16)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                overflow: 'hidden',
              }}
            >
              {activePanel ? host.renderPanelSurface(activePanel.id, { forceMount: true, forceVisible: true }) : null}
            </div>

            <aside
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                minHeight: 0,
              }}
            >
              <div
                style={{
                  padding: 18,
                  borderRadius: 30,
                  border: '1px solid rgba(53,124,174,0.12)',
                  background: 'rgba(255,255,255,0.72)',
                  boxShadow: '0 18px 40px rgba(56,108,148,0.12)',
                }}
              >
                <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(48,67,77,0.58)' }}>
                  Channel Focus
                </div>
                <div style={{ marginTop: 10, fontSize: 26, fontWeight: 700, color: '#1c2b33' }}>
                  {activePanel?.label ?? 'Channel'}
                </div>
                <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.55, color: 'rgba(48,67,77,0.72)' }}>
                  {activePanel?.description ?? 'Select a panel to open its channel.'}
                </div>
              </div>

              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  padding: 12,
                  borderRadius: 30,
                  border: '1px solid rgba(53,124,174,0.12)',
                  background: 'rgba(255,255,255,0.62)',
                  boxShadow: '0 18px 40px rgba(56,108,148,0.1)',
                  overflow: 'auto',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {panels.map(panel => (
                    <button
                      key={panel.id}
                      onClick={() => host.activatePanel(panel.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '12px 14px',
                        borderRadius: 20,
                        border: panel.id === activePanel?.id
                          ? '1px solid rgba(53,185,255,0.26)'
                          : '1px solid rgba(53,124,174,0.08)',
                        background: panel.id === activePanel?.id
                          ? 'rgba(226,245,255,0.92)'
                          : 'rgba(255,255,255,0.76)',
                        color: '#1c2b33',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span
                        style={{
                          width: 34,
                          height: 34,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 12,
                          background: 'rgba(53,185,255,0.12)',
                          color: '#2f8dcc',
                          flexShrink: 0,
                        }}
                      >
                        {panel.icon}
                      </span>
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                        <span style={{ fontSize: 12, fontWeight: 700 }}>{panel.label}</span>
                        <span style={{ fontSize: 10, lineHeight: 1.4, color: 'rgba(48,67,77,0.62)' }}>
                          {panel.description}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </aside>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
              gap: 14,
            }}
          >
            {featuredPanels.map(panel => {
              const isActive = panel.id === activePanel?.id;
              return (
                <button
                  key={panel.id}
                  onClick={() => host.activatePanel(panel.id)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    minHeight: 132,
                    padding: '14px 10px',
                    borderRadius: 30,
                    border: isActive ? '1px solid rgba(53,185,255,0.24)' : '1px solid rgba(53,124,174,0.08)',
                    background: isActive
                      ? 'linear-gradient(180deg, rgba(255,255,255,0.96), rgba(229,245,255,0.88))'
                      : 'linear-gradient(180deg, rgba(255,255,255,0.88), rgba(245,250,255,0.82))',
                    boxShadow: isActive ? '0 18px 36px rgba(56,108,148,0.16)' : '0 14px 28px rgba(56,108,148,0.08)',
                    color: '#1c2b33',
                    cursor: 'pointer',
                  }}
                >
                  <span
                    style={{
                      width: 48,
                      height: 48,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 18,
                      background: isActive ? 'rgba(53,185,255,0.14)' : 'rgba(53,185,255,0.08)',
                      color: isActive ? '#2aaeff' : '#2f8dcc',
                    }}
                  >
                    {panel.icon}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>
                    {panel.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  },
});
