import { defineThemeRenderer } from 'overlayterm-theme-renderer';

function orbitPoint(index, total, radiusX, radiusY) {
  const angle = ((Math.PI * 2) / total) * index - Math.PI / 2;
  return {
    angle,
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
            background: 'radial-gradient(circle at center, rgba(139,115,255,0.16), transparent 34%), radial-gradient(circle at center, rgba(139,210,255,0.08), transparent 54%), linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0) 34%)',
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
            padding: 22,
            gap: 18,
          }}
        >
          {host.renderChromeBar()}

          <div
            style={{
              position: 'relative',
              minHeight: 0,
              borderRadius: 40,
              border: '1px solid rgba(169,154,255,0.16)',
              background: 'radial-gradient(circle at center, rgba(18,14,36,0.8), rgba(8,8,18,0.74))',
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
                  boxShadow: '0 0 0 92px rgba(139,115,255,0.03), 0 0 0 182px rgba(139,115,255,0.02)',
                }}
              />
            </div>

            <div
              style={{
                position: 'absolute',
                left: 28,
                top: 24,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                borderRadius: 999,
                border: '1px solid rgba(169,154,255,0.14)',
                background: 'rgba(18,14,36,0.62)',
                color: '#f5efff',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
              }}
            >
              <span>Orbital Focus</span>
              <span style={{ color: '#8bd2ff' }}>{activePanel?.label ?? 'Launcher'}</span>
            </div>

            <div
              style={{
                position: 'absolute',
                right: 28,
                top: 24,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                borderRadius: 999,
                border: '1px solid rgba(169,154,255,0.14)',
                background: 'rgba(18,14,36,0.62)',
                color: '#d7cfff',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
              }}
            >
              <span>Cube Ring</span>
              <span style={{ color: '#8b73ff' }}>{panels.length}</span>
            </div>

            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: 'min(68%, 760px)',
                height: 'min(66%, 520px)',
                transform: 'translate(-50%, -50%)',
                borderRadius: 32,
                border: '1px solid rgba(169,154,255,0.22)',
                background: 'linear-gradient(180deg, rgba(26,20,52,0.88), rgba(12,12,24,0.8))',
                boxShadow: '0 26px 62px rgba(4, 4, 12, 0.44)',
                overflow: 'hidden',
              }}
            >
              {activePanel ? host.renderPanelSurface(activePanel.id, { forceMount: true, forceVisible: true }) : null}
            </div>

            {panels.map((panel, index) => {
              const useOuterRing = index % 2 === 0;
              const point = orbitPoint(
                index,
                panels.length,
                useOuterRing ? 390 : 310,
                useOuterRing ? 240 : 188,
              );
              const isActive = panel.id === activePanel?.id;

              return (
                <button
                  key={panel.id}
                  onClick={() => host.activatePanel(panel.id)}
                  style={{
                    position: 'absolute',
                    left: point.left,
                    top: point.top,
                    transform: `translate(-50%, -50%) rotate(${point.angle}rad)`,
                    width: isActive ? 132 : 104,
                    height: isActive ? 132 : 104,
                    borderRadius: 30,
                    border: isActive ? '1px solid rgba(169,154,255,0.38)' : '1px solid rgba(169,154,255,0.14)',
                    background: isActive
                      ? 'linear-gradient(180deg, rgba(70,52,122,0.94), rgba(38,29,68,0.88))'
                      : 'linear-gradient(180deg, rgba(30,24,58,0.84), rgba(18,14,36,0.76))',
                    boxShadow: isActive ? '0 20px 44px rgba(0,0,0,0.34)' : '0 12px 28px rgba(0,0,0,0.22)',
                    color: '#f6f1ff',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    transition: 'width 180ms ease, height 180ms ease, background 180ms ease, border-color 180ms ease',
                  }}
                >
                  <span
                    style={{
                      transform: `rotate(${-point.angle}rad)`,
                      width: isActive ? 50 : 40,
                      height: isActive ? 50 : 40,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 18,
                      background: isActive ? 'rgba(139,115,255,0.16)' : 'rgba(255,255,255,0.06)',
                      color: isActive ? '#8bd2ff' : '#d7cfff',
                    }}
                  >
                    {panel.icon}
                  </span>
                  <span
                    style={{
                      transform: `rotate(${-point.angle}rad)`,
                      fontSize: isActive ? 11 : 10,
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                    }}
                  >
                    {panel.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr',
              alignItems: 'center',
              gap: 16,
              minHeight: 0,
            }}
          >
            <div style={{ display: 'flex', minHeight: 0, gap: 12 }}>
              {host.renderPinnedPanels('left')}
            </div>

            <div
              style={{
                padding: '12px 18px',
                borderRadius: 999,
                border: '1px solid rgba(169,154,255,0.16)',
                background: 'rgba(18,14,36,0.72)',
                boxShadow: '0 18px 38px rgba(4,4,12,0.22)',
                color: '#f5efff',
                backdropFilter: 'blur(18px)',
                WebkitBackdropFilter: 'blur(18px)',
              }}
            >
              <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(215,207,255,0.58)' }}>
                Center Stage
              </div>
              <div style={{ marginTop: 6, fontSize: 18, fontWeight: 700 }}>
                {activePanel?.label ?? 'Launcher'}
              </div>
              <div style={{ marginTop: 4, fontSize: 11, lineHeight: 1.45, color: 'rgba(215,207,255,0.72)', maxWidth: 420 }}>
                {activePanel?.description ?? 'Rotate a cube to pull a panel into the center stage.'}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', minHeight: 0, gap: 12 }}>
              {host.renderPinnedPanels('right')}
            </div>
          </div>
        </div>
      </div>
    );
  },
});
