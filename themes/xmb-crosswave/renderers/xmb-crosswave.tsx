import { defineThemeRenderer } from 'overlayterm-theme-renderer';

export default defineThemeRenderer({
  name: 'XMB Crosswave Shell',
  apiVersion: 1,
  supportsLiveSwap: true,
  fallbackRuntime: 'cross-axis-media',
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
    const panels = host.shellModel.launcher.panels;
    const groups = host.shellModel.launcher.groups;
    const activePanel = panels.find(panel => panel.id === host.activePanelId) ?? panels[0] ?? null;
    const activeGroup = groups.find(group => group.panels.some(panel => panel.id === activePanel?.id)) ?? groups[0] ?? null;
    const activeGroupPanels = activeGroup?.panels ?? panels;

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
            background: 'linear-gradient(180deg, rgba(5,12,24,0.3), rgba(5,12,24,0.02) 26%, rgba(5,12,24,0.42) 100%), radial-gradient(circle at 18% 22%, rgba(93,223,255,0.12), transparent 24%), radial-gradient(circle at 84% 18%, rgba(255,255,255,0.06), transparent 18%)',
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
            padding: '18px 26px 20px',
            gap: 18,
          }}
        >
          {host.renderUtilityActionsSurface()}

          <div
            style={{
              display: 'grid',
              gridTemplateRows: 'auto auto minmax(0, 1fr)',
              gap: 18,
              minHeight: 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                overflowX: 'auto',
                paddingBottom: 4,
              }}
            >
              {groups.map(group => {
                const isActive = group.id === activeGroup?.id;
                return (
                  <button
                    key={group.id}
                    onClick={() => host.activatePanel(group.panels[0]?.id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 16px',
                      borderRadius: 999,
                      border: isActive ? '1px solid rgba(93,223,255,0.26)' : '1px solid rgba(255,255,255,0.08)',
                      background: isActive ? 'rgba(93,223,255,0.12)' : 'rgba(7,16,28,0.28)',
                      color: isActive ? '#e8fdff' : 'rgba(223,244,255,0.72)',
                      cursor: 'pointer',
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.16em',
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span>{group.label}</span>
                    <span style={{ color: '#5ddfff' }}>{group.panels.length}</span>
                  </button>
                );
              })}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 18,
                overflowX: 'auto',
                padding: '18px 4px 22px',
                minHeight: 140,
              }}
            >
              {activeGroupPanels.map(panel => {
                const isActive = panel.id === activePanel?.id;
                return (
                  <button
                    key={panel.id}
                    onClick={() => host.activatePanel(panel.id)}
                    style={{
                      display: 'grid',
                      gridTemplateRows: '58px auto',
                      alignItems: 'center',
                      justifyItems: 'center',
                      gap: 12,
                      minWidth: isActive ? 190 : 142,
                      padding: isActive ? '18px 18px 16px' : '14px 14px 12px',
                      borderRadius: 30,
                      border: isActive ? '1px solid rgba(93,223,255,0.28)' : '1px solid rgba(255,255,255,0.08)',
                      background: isActive
                        ? 'linear-gradient(180deg, rgba(16,35,56,0.8), rgba(8,18,30,0.72))'
                        : 'linear-gradient(180deg, rgba(8,18,30,0.38), rgba(8,18,30,0.28))',
                      boxShadow: isActive ? '0 24px 54px rgba(0, 0, 0, 0.34)' : 'none',
                      color: '#effbff',
                      cursor: 'pointer',
                      transform: isActive ? 'translateY(-6px)' : 'scale(0.94)',
                      transition: 'transform 180ms ease, background 180ms ease, border-color 180ms ease',
                    }}
                  >
                    <span
                      style={{
                        width: isActive ? 58 : 46,
                        height: isActive ? 58 : 46,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 18,
                        background: isActive ? 'rgba(93,223,255,0.16)' : 'rgba(255,255,255,0.08)',
                        color: isActive ? '#5ddfff' : '#d7f6ff',
                      }}
                    >
                      {panel.icon}
                    </span>
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
                      <span style={{ fontSize: isActive ? 13 : 12, fontWeight: 700 }}>{panel.label}</span>
                      {isActive ? (
                        <span style={{ fontSize: 10, lineHeight: 1.45, color: 'rgba(215,246,255,0.68)', maxWidth: 180 }}>
                          {panel.description}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) 320px',
                gap: 20,
                minHeight: 0,
              }}
            >
              <div
                style={{
                  minHeight: 0,
                  borderRadius: 34,
                  border: '1px solid rgba(93,223,255,0.16)',
                  background: 'linear-gradient(180deg, rgba(14,22,38,0.78), rgba(8,14,28,0.68))',
                  boxShadow: '0 26px 56px rgba(0, 0, 0, 0.34)',
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
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
                  padding: 18,
                  borderRadius: 28,
                  border: '1px solid rgba(93,223,255,0.14)',
                  background: 'rgba(8,18,30,0.42)',
                  boxShadow: '0 18px 44px rgba(0,0,0,0.22)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                }}
              >
                <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(223,250,255,0.56)' }}>
                  Active Lane
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#e8fdff' }}>
                  {activePanel?.label ?? 'Panel'}
                </div>
                <div style={{ fontSize: 12, lineHeight: 1.6, color: 'rgba(215,246,255,0.68)' }}>
                  {activePanel?.description ?? 'Select a surface to bring it into focus.'}
                </div>
                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {activeGroupPanels.map(panel => {
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
                          border: isActive ? '1px solid rgba(93,223,255,0.24)' : '1px solid rgba(255,255,255,0.06)',
                          background: isActive ? 'rgba(17,36,58,0.72)' : 'rgba(8,18,30,0.34)',
                          color: '#effbff',
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
                            background: 'rgba(93,223,255,0.12)',
                            color: isActive ? '#5ddfff' : '#d7f6ff',
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
              </aside>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 24,
              color: 'rgba(223,250,255,0.58)',
              fontSize: 11,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
            }}
          >
            <span>Crosswave</span>
            <span style={{ width: 48, height: 1, background: 'rgba(93,223,255,0.22)' }} />
            <span>{activeGroup?.label ?? 'Media'}</span>
            <span style={{ width: 48, height: 1, background: 'rgba(93,223,255,0.22)' }} />
            <span>{host.layoutProfile.label}</span>
          </div>
        </div>
      </div>
    );
  },
});
