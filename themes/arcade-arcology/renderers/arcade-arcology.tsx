import { defineThemeRenderer } from 'overlayterm-theme-renderer';

function resolveCssLength(host, name, fallback) {
  const value = host.appearance.cssVars?.[name];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function resolveCssNumber(host, name, fallback) {
  const value = host.appearance.cssVars?.[name];
  const parsed = typeof value === 'string' ? Number.parseFloat(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default defineThemeRenderer({
  name: 'Arcade Arcology Shell',
  apiVersion: 1,
  supportsLiveSwap: true,
  fallbackRuntime: 'desktop-stack',
  capabilities: {
    customScreens: true,
    wallpaperScene: true,
    surfaceAdapters: true,
  },
  surfaceOwnership: {
    chrome: true,
    contentFrame: true,
    wallpaper: true,
  },
  component({ host }) {
    const panels = host.panels.filter(panel => !panel.isPinned);
    const activePanel = panels.find(panel => panel.id === host.activePanelId) ?? panels[0] ?? null;
    const featuredPanels = panels.slice(0, 6);
    const stageWidth = resolveCssLength(host, '--overlay-workbench-arcology-stage-width', 'min(78%, 1080px)');
    const stageHeight = resolveCssLength(host, '--overlay-workbench-arcology-stage-height', 'min(70%, 660px)');
    const railWidth = resolveCssNumber(host, '--overlay-workbench-arcology-rail-width', 300);
    const skylineGap = resolveCssNumber(host, '--overlay-workbench-arcology-skyline-gap', 10);

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
            background: 'radial-gradient(circle at 14% 20%, rgba(255,155,90,0.14), transparent 22%), radial-gradient(circle at 82% 18%, rgba(107,231,255,0.12), transparent 18%), linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0) 30%)',
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
            padding: 20,
            gap: 18,
          }}
        >
          {host.renderChromeBar()}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `${railWidth}px minmax(0, 1fr) ${railWidth}px`,
              gap: 16,
              minHeight: 0,
            }}
          >
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
                  border: '1px solid rgba(146, 164, 191, 0.18)',
                  background: 'rgba(10, 12, 19, 0.74)',
                  boxShadow: '0 18px 42px rgba(0,0,0,0.24)',
                  color: '#f5f8ff',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                }}
              >
                <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(194,208,226,0.56)' }}>
                  Arcology Control
                </div>
                <div style={{ marginTop: 10, fontSize: 26, fontWeight: 700, lineHeight: 1.1 }}>
                  {activePanel?.label ?? 'Launcher'}
                </div>
                <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.6, color: 'rgba(194,208,226,0.72)' }}>
                  {activePanel?.description ?? 'Choose a tower or district to bring it into the center stage.'}
                </div>
              </div>

              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  padding: 12,
                  borderRadius: 30,
                  border: '1px solid rgba(146, 164, 191, 0.18)',
                  background: 'rgba(8, 11, 18, 0.64)',
                  boxShadow: '0 16px 38px rgba(0,0,0,0.22)',
                  overflow: 'auto',
                  backdropFilter: 'blur(18px)',
                  WebkitBackdropFilter: 'blur(18px)',
                }}
              >
                {host.renderDefaultNavigationSurface()}
              </div>

              <div style={{ display: 'flex', minHeight: 0, gap: 12, overflow: 'hidden' }}>
                {host.renderPinnedPanels('left')}
              </div>
            </aside>

            <main
              style={{
                position: 'relative',
                minHeight: 0,
                borderRadius: 42,
                border: '1px solid rgba(255, 155, 90, 0.18)',
                background: 'linear-gradient(180deg, rgba(14, 17, 26, 0.96), rgba(7, 9, 14, 0.96))',
                boxShadow: '0 30px 84px rgba(0, 0, 0, 0.58)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                overflow: 'hidden',
              }}
            >
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'radial-gradient(circle at 50% 30%, rgba(255,155,90,0.12), transparent 28%), linear-gradient(135deg, rgba(255,255,255,0.04), transparent 44%)',
                  pointerEvents: 'none',
                }}
              />

              <div
                style={{
                  position: 'absolute',
                  left: 20,
                  top: 18,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  borderRadius: 999,
                  border: '1px solid rgba(146, 164, 191, 0.18)',
                  background: 'rgba(10, 12, 19, 0.74)',
                  color: '#f5f8ff',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  zIndex: 2,
                }}
              >
                <span>Arcology Tower</span>
                <span style={{ color: '#ff9b5a' }}>{activePanel?.label ?? 'Launcher'}</span>
              </div>

              <div
                style={{
                  position: 'absolute',
                  right: 20,
                  top: 18,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  borderRadius: 999,
                  border: '1px solid rgba(146, 164, 191, 0.18)',
                  background: 'rgba(10, 12, 19, 0.74)',
                  color: '#dce7f4',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  zIndex: 2,
                }}
              >
                <span>Floor Count</span>
                <span style={{ color: '#6be7ff' }}>{panels.length}</span>
              </div>

              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: stageWidth,
                  height: stageHeight,
                  transform: 'translate(-50%, -50%)',
                  borderRadius: 34,
                  border: '1px solid rgba(255, 155, 90, 0.2)',
                  background: 'linear-gradient(180deg, rgba(22, 26, 38, 0.92), rgba(11, 13, 20, 0.96))',
                  boxShadow: '0 24px 54px rgba(0, 0, 0, 0.38)',
                  overflow: 'hidden',
                }}
              >
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'radial-gradient(circle at 50% 40%, rgba(255,155,90,0.08), transparent 26%), linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0) 30%)',
                    pointerEvents: 'none',
                  }}
                />
                <div style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%' }}>
                  {activePanel ? host.renderPanelSurface(activePanel.id, { forceMount: true, forceVisible: true }) : null}
                </div>
              </div>

              <div
                style={{
                  position: 'absolute',
                  left: 20,
                  right: 20,
                  bottom: 20,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  gap: skylineGap,
                }}
              >
                {featuredPanels.map((panel, index) => {
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
                        minHeight: 122 + (index % 2) * 18,
                        padding: '15px 16px 14px',
                        borderRadius: 24,
                        border: isActive ? '1px solid rgba(255,155,90,0.28)' : '1px solid rgba(146,164,191,0.08)',
                        background: isActive
                          ? 'linear-gradient(180deg, rgba(255,155,90,0.14), rgba(11,13,20,0.96))'
                          : 'linear-gradient(180deg, rgba(28,34,50,0.88), rgba(11,13,20,0.9))',
                        boxShadow: isActive ? '0 18px 34px rgba(0,0,0,0.22)' : '0 12px 24px rgba(0,0,0,0.12)',
                        color: '#f5f8ff',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transform: `translateY(${index % 2 === 0 ? 0 : 10}px)`,
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
                          background: isActive ? 'rgba(255,155,90,0.14)' : 'rgba(255,255,255,0.05)',
                          color: isActive ? '#ffb27e' : '#dce7f4',
                        }}
                      >
                        {panel.icon}
                      </span>
                      <span style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                        <span style={{ fontSize: 12, fontWeight: 700 }}>{panel.label}</span>
                        <span style={{ fontSize: 10, lineHeight: 1.45, color: 'rgba(194,208,226,0.68)' }}>
                          {panel.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </main>

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
                  border: '1px solid rgba(146,164,191,0.18)',
                  background: 'rgba(10, 12, 19, 0.74)',
                  boxShadow: '0 18px 42px rgba(0,0,0,0.24)',
                  color: '#f5f8ff',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                }}
              >
                <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(194,208,226,0.56)' }}>
                  Skyline Stack
                </div>
                <div style={{ marginTop: 10, fontSize: 26, fontWeight: 700, lineHeight: 1.1 }}>
                  {activePanel?.label ?? 'Launcher'}
                </div>
                <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.6, color: 'rgba(194,208,226,0.72)' }}>
                  {activePanel?.description ?? 'Select a floor and pull a surface into the tower.'}
                </div>
              </div>

              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  padding: 12,
                  borderRadius: 30,
                  border: '1px solid rgba(146,164,191,0.18)',
                  background: 'rgba(8, 11, 18, 0.6)',
                  boxShadow: '0 16px 38px rgba(0,0,0,0.22)',
                  overflow: 'auto',
                  backdropFilter: 'blur(18px)',
                  WebkitBackdropFilter: 'blur(18px)',
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
                          borderRadius: 18,
                          border: isActive ? '1px solid rgba(255,155,90,0.28)' : '1px solid rgba(255,255,255,0.06)',
                          background: isActive ? 'rgba(24, 30, 44, 0.92)' : 'rgba(8, 11, 18, 0.5)',
                          color: '#f5f8ff',
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
                            background: isActive ? 'rgba(255,155,90,0.14)' : 'rgba(255,255,255,0.05)',
                            color: isActive ? '#ffb27e' : '#dce7f4',
                            flexShrink: 0,
                          }}
                        >
                          {panel.icon}
                        </span>
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                          <span style={{ fontSize: 12, fontWeight: 700 }}>{panel.label}</span>
                          <span style={{ fontSize: 10, lineHeight: 1.4, color: 'rgba(194,208,226,0.68)' }}>
                            {panel.description}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', minHeight: 0, gap: 12, overflow: 'hidden', justifyContent: 'flex-end' }}>
                {host.renderPinnedPanels('right')}
              </div>
            </aside>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                borderRadius: 999,
                border: '1px solid rgba(146,164,191,0.16)',
                background: 'rgba(10, 12, 19, 0.72)',
                color: '#c2d0e2',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                justifySelf: 'start',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
              }}
            >
              <span>District</span>
              <span style={{ width: 44, height: 1, background: 'rgba(255,255,255,0.1)' }} />
              <span>{host.layoutProfile.label}</span>
            </div>

            <div
              style={{
                padding: '12px 18px',
                borderRadius: 999,
                border: '1px solid rgba(146,164,191,0.18)',
                background: 'rgba(10, 12, 19, 0.8)',
                boxShadow: '0 18px 38px rgba(0,0,0,0.3)',
                color: '#f5f8ff',
                backdropFilter: 'blur(18px)',
                WebkitBackdropFilter: 'blur(18px)',
              }}
            >
              <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(194,208,226,0.56)' }}>
                Center Stage
              </div>
              <div style={{ marginTop: 6, fontSize: 18, fontWeight: 700 }}>
                {activePanel?.label ?? 'Launcher'}
              </div>
              <div style={{ marginTop: 4, fontSize: 11, lineHeight: 1.45, color: 'rgba(194,208,226,0.72)', maxWidth: 420 }}>
                {activePanel?.description ?? 'Arcade lights, skyline cards, and a tower stage for the active panel.'}
              </div>
            </div>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                borderRadius: 999,
                border: '1px solid rgba(146,164,191,0.16)',
                background: 'rgba(10, 12, 19, 0.72)',
                color: '#c2d0e2',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                justifySelf: 'end',
                justifyContent: 'flex-end',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
              }}
            >
              <span>{host.theme.name}</span>
              <span style={{ width: 44, height: 1, background: 'rgba(255,255,255,0.1)' }} />
              <span>{panels.length} floors</span>
            </div>
          </div>
        </div>
      </div>
    );
  },
});
