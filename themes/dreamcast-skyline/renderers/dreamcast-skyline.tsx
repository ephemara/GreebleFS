import { defineThemeRenderer } from 'overlayterm-theme-renderer';

export default defineThemeRenderer({
  name: 'Dreamcast Skyline Shell',
  apiVersion: 1,
  supportsLiveSwap: true,
  fallbackRuntime: 'channel-launcher',
  capabilities: {
    customScreens: true,
    wallpaperScene: true,
    surfaceAdapters: true,
  },
  component({ host }) {
    const panels = host.panels.filter(panel => !panel.isPinned);
    const activePanel = panels.find(panel => panel.id === host.activePanelId) ?? panels[0] ?? null;
    const spotlightPanels = panels.slice(0, 4);

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
            background: 'linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0) 30%), radial-gradient(circle at 82% 14%, rgba(255,117,42,0.08), transparent 18%)',
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.45fr) 360px',
            width: '100%',
            minHeight: 0,
            padding: 18,
            gap: 16,
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateRows: 'auto minmax(0, 1fr)',
              gap: 14,
              minHeight: 0,
            }}
          >
            {host.renderChromeBar()}

            <div
              style={{
                display: 'grid',
                gridTemplateRows: 'minmax(280px, 0.82fr) minmax(0, 1fr)',
                gap: 14,
                minHeight: 0,
              }}
            >
              <div
                style={{
                  position: 'relative',
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) 248px',
                  gap: 14,
                  minHeight: 0,
                }}
              >
                <div
                  style={{
                    position: 'relative',
                    minHeight: 0,
                    borderRadius: 30,
                    border: '1px solid rgba(33,53,62,0.12)',
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.74), rgba(246,249,250,0.66))',
                    boxShadow: '0 24px 54px rgba(31, 41, 46, 0.12)',
                    backdropFilter: 'blur(14px)',
                    WebkitBackdropFilter: 'blur(14px)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      opacity: 0.36,
                      pointerEvents: 'none',
                    }}
                  >
                    {host.wallpaper.renderBackground({ opacity: 0.42 })}
                  </div>
                  <div style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%' }}>
                    {activePanel ? host.renderPanelSurface(activePanel.id, { forceMount: true, forceVisible: true }) : null}
                  </div>
                </div>

                <div
                  style={{
                    position: 'relative',
                    minHeight: 0,
                    borderRadius: 28,
                    border: '1px solid rgba(33,53,62,0.12)',
                    background: 'rgba(255,255,255,0.72)',
                    boxShadow: '0 18px 40px rgba(31, 41, 46, 0.1)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      opacity: 0.58,
                      pointerEvents: 'none',
                    }}
                  >
                    {host.wallpaper.renderBackground({ opacity: 0.68, fitMode: 'cover' })}
                  </div>
                  <div
                    style={{
                      position: 'relative',
                      zIndex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      width: '100%',
                      height: '100%',
                      padding: 16,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(28,43,51,0.56)' }}>
                        Scene Monitor
                      </div>
                      <div style={{ marginTop: 10, fontSize: 24, fontWeight: 700, color: '#1c2b33' }}>
                        {activePanel?.label ?? 'Skyline'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {spotlightPanels.map(panel => {
                        const isActive = panel.id === activePanel?.id;
                        return (
                          <button
                            key={panel.id}
                            onClick={() => host.activatePanel(panel.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              padding: '10px 12px',
                              borderRadius: 18,
                              border: isActive ? '1px solid rgba(255,117,42,0.24)' : '1px solid rgba(33,53,62,0.08)',
                              background: isActive ? 'rgba(255,255,255,0.84)' : 'rgba(255,255,255,0.62)',
                              color: '#1c2b33',
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                          >
                            <span
                              style={{
                                width: 30,
                                height: 30,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: 12,
                                background: 'rgba(255,117,42,0.1)',
                                color: '#ff752a',
                                flexShrink: 0,
                              }}
                            >
                              {panel.icon}
                            </span>
                            <span style={{ fontSize: 11, fontWeight: 700 }}>{panel.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                  gap: 14,
                  minHeight: 0,
                }}
              >
                {spotlightPanels.map(panel => {
                  const isActive = panel.id === activePanel?.id;
                  return (
                    <button
                      key={panel.id}
                      onClick={() => host.activatePanel(panel.id)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        minHeight: 132,
                        padding: '16px 16px 14px',
                        borderRadius: 24,
                        border: isActive ? '1px solid rgba(255,117,42,0.26)' : '1px solid rgba(33,53,62,0.08)',
                        background: isActive ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.76)',
                        boxShadow: isActive ? '0 18px 36px rgba(31,41,46,0.12)' : '0 12px 24px rgba(31,41,46,0.06)',
                        color: '#1c2b33',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span
                        style={{
                          width: 42,
                          height: 42,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 15,
                          background: 'rgba(255,117,42,0.1)',
                          color: '#ff752a',
                        }}
                      >
                        {panel.icon}
                      </span>
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <span style={{ fontSize: 12, fontWeight: 700 }}>{panel.label}</span>
                        <span style={{ fontSize: 10, lineHeight: 1.45, color: 'rgba(48,67,77,0.66)' }}>
                          {panel.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <aside
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              minHeight: 0,
              padding: 16,
              borderRadius: 30,
              border: '1px solid rgba(33,53,62,0.12)',
              background: 'rgba(255,255,255,0.74)',
              boxShadow: '0 20px 42px rgba(31,41,46,0.08)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
            }}
          >
            <div>
              <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(48,67,77,0.56)' }}>
                Quick Launch
              </div>
              <div style={{ marginTop: 8, fontSize: 26, fontWeight: 700, color: '#1c2b33' }}>
                Skyline Deck
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0, overflow: 'auto', paddingRight: 2 }}>
              {panels.map(panel => {
                const isActive = panel.id === activePanel?.id;
                return (
                  <button
                    key={panel.id}
                    onClick={() => host.activatePanel(panel.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 14px',
                      borderRadius: 18,
                      border: isActive ? '1px solid rgba(255,117,42,0.24)' : '1px solid rgba(33,53,62,0.08)',
                      background: isActive ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.7)',
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
                        background: 'rgba(255,117,42,0.1)',
                        color: '#ff752a',
                        flexShrink: 0,
                      }}
                    >
                      {panel.icon}
                    </span>
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                      <span style={{ fontSize: 12, fontWeight: 700 }}>{panel.label}</span>
                      <span style={{ fontSize: 10, lineHeight: 1.4, color: 'rgba(48,67,77,0.66)' }}>
                        {panel.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>
        </div>
      </div>
    );
  },
});
