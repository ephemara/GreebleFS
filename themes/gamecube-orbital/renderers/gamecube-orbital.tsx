import { defineThemeRenderer } from 'overlayterm-theme-renderer';

function orbitPoint(index, total, radiusX, radiusY) {
  const angle = ((Math.PI * 2) / total) * index - Math.PI / 2;
  return {
    left: `calc(50% + ${Math.cos(angle) * radiusX}px)`,
    top: `calc(50% + ${Math.sin(angle) * radiusY}px)`,
  };
}

export default defineThemeRenderer({
  name: 'GameCube Orbital Shell',
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
            background: 'radial-gradient(circle at center, rgba(139,115,255,0.12), transparent 34%), linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0) 34%)',
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 380px',
            width: '100%',
            minHeight: 0,
            padding: 22,
            gap: 20,
          }}
        >
          <div
            style={{
              position: 'relative',
              minHeight: 0,
              borderRadius: 38,
              border: '1px solid rgba(169,154,255,0.16)',
              background: 'radial-gradient(circle at center, rgba(18,14,36,0.84), rgba(8,8,18,0.76))',
              boxShadow: '0 30px 72px rgba(4, 4, 12, 0.48)',
              backdropFilter: 'blur(22px)',
              WebkitBackdropFilter: 'blur(22px)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'grid',
                placeItems: 'center',
                pointerEvents: 'none',
              }}
            >
              <div
                aria-hidden
                style={{
                  width: 560,
                  height: 560,
                  borderRadius: '50%',
                  border: '1px solid rgba(169,154,255,0.12)',
                  boxShadow: '0 0 0 80px rgba(139,115,255,0.03), 0 0 0 160px rgba(139,115,255,0.02)',
                }}
              />
            </div>

            <div
              style={{
                position: 'relative',
                zIndex: 1,
                display: 'grid',
                gridTemplateRows: 'auto minmax(0, 1fr)',
                width: '100%',
                height: '100%',
                padding: 18,
                gap: 16,
              }}
            >
              {host.renderChromeBar()}

              <div style={{ position: 'relative', minHeight: 0 }}>
                <div
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    width: 'min(72%, 760px)',
                    height: 'min(72%, 520px)',
                    transform: 'translate(-50%, -50%)',
                    borderRadius: 30,
                    border: '1px solid rgba(169,154,255,0.2)',
                    background: 'linear-gradient(180deg, rgba(26,20,52,0.86), rgba(12,12,24,0.76))',
                    boxShadow: '0 24px 58px rgba(4, 4, 12, 0.42)',
                    overflow: 'hidden',
                  }}
                >
                  {activePanel ? host.renderPanelSurface(activePanel.id, { forceMount: true, forceVisible: true }) : null}
                </div>

                {panels.map((panel, index) => {
                  const point = orbitPoint(index, panels.length, 320, 200);
                  const isActive = panel.id === activePanel?.id;
                  return (
                    <button
                      key={panel.id}
                      onClick={() => host.activatePanel(panel.id)}
                      style={{
                        position: 'absolute',
                        left: point.left,
                        top: point.top,
                        transform: 'translate(-50%, -50%) scale(1)',
                        width: isActive ? 124 : 96,
                        height: isActive ? 124 : 96,
                        borderRadius: 28,
                        border: isActive ? '1px solid rgba(169,154,255,0.36)' : '1px solid rgba(169,154,255,0.14)',
                        background: isActive
                          ? 'linear-gradient(180deg, rgba(70,52,122,0.92), rgba(38,29,68,0.86))'
                          : 'linear-gradient(180deg, rgba(30,24,58,0.82), rgba(18,14,36,0.74))',
                        boxShadow: isActive ? '0 18px 42px rgba(0,0,0,0.34)' : '0 10px 24px rgba(0,0,0,0.22)',
                        color: '#f6f1ff',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        cursor: 'pointer',
                      }}
                    >
                      <span
                        style={{
                          width: isActive ? 48 : 38,
                          height: isActive ? 48 : 38,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 16,
                          background: isActive ? 'rgba(139,115,255,0.16)' : 'rgba(255,255,255,0.06)',
                          color: isActive ? '#8bd2ff' : '#d7cfff',
                        }}
                      >
                        {panel.icon}
                      </span>
                      <span style={{ fontSize: isActive ? 11 : 10, fontWeight: 700, letterSpacing: '0.04em' }}>
                        {panel.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <aside
            style={{
              display: 'grid',
              gridTemplateRows: 'auto minmax(0, 1fr)',
              gap: 14,
              minHeight: 0,
            }}
          >
            <div
              style={{
                padding: 18,
                borderRadius: 30,
                border: '1px solid rgba(169,154,255,0.16)',
                background: 'rgba(18,14,36,0.74)',
                boxShadow: '0 18px 42px rgba(4,4,12,0.28)',
                color: '#f5efff',
              }}
            >
              <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(215,207,255,0.6)' }}>
                Orbital Focus
              </div>
              <div style={{ marginTop: 10, fontSize: 28, fontWeight: 700 }}>
                {activePanel?.label ?? 'Launcher'}
              </div>
              <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.55, color: 'rgba(215,207,255,0.72)' }}>
                {activePanel?.description ?? 'Select a cube to rotate a panel into the center stage.'}
              </div>
            </div>

            <div
              style={{
                minHeight: 0,
                padding: 14,
                borderRadius: 30,
                border: '1px solid rgba(169,154,255,0.14)',
                background: 'rgba(14,12,28,0.72)',
                boxShadow: '0 18px 42px rgba(4,4,12,0.24)',
                overflow: 'auto',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                        borderRadius: 22,
                        border: isActive ? '1px solid rgba(169,154,255,0.28)' : '1px solid rgba(255,255,255,0.06)',
                        background: isActive ? 'rgba(42,33,72,0.84)' : 'rgba(20,16,40,0.54)',
                        color: '#f5efff',
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
                          background: 'rgba(139,115,255,0.12)',
                          color: isActive ? '#8bd2ff' : '#d7cfff',
                          flexShrink: 0,
                        }}
                      >
                        {panel.icon}
                      </span>
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                        <span style={{ fontSize: 12, fontWeight: 700 }}>{panel.label}</span>
                        <span style={{ fontSize: 10, lineHeight: 1.4, color: 'rgba(215,207,255,0.66)' }}>
                          {panel.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      </div>
    );
  },
});
