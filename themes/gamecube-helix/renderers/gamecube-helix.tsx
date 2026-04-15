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

function resolveHelixSlot(index, total, amplitude, pitch) {
  const ratio = total <= 1 ? 0 : index / (total - 1);
  const angle = ratio * Math.PI * 4.25;
  const curve = Math.sin(angle);
  const lift = Math.cos(angle);

  return {
    left: `calc(50% + ${curve * amplitude}px)`,
    top: `calc(${12 + ratio * 76}% + ${lift * (pitch * 0.004)}px)`,
    rotate: curve * 12,
    scale: 0.82 + ((lift + 1) / 2) * 0.16,
    depth: 100 + (total - index),
  };
}

export default defineThemeRenderer({
  name: 'GameCube Helix Shell',
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
    const activePanel = panels.find(panel => panel.id === host.activePanelId) ?? panels[0] ?? null;
    const stageWidth = resolveCssLength(host, '--overlay-workbench-helix-stage-width', 'min(72%, 980px)');
    const stageHeight = resolveCssLength(host, '--overlay-workbench-helix-stage-height', 'min(76%, 676px)');
    const trackWidth = resolveCssLength(host, '--overlay-workbench-helix-track-width', 'min(100%, 366px)');
    const trackAmplitude = resolveCssNumber(host, '--overlay-workbench-helix-track-amplitude', 118);
    const trackPitch = resolveCssNumber(host, '--overlay-workbench-helix-track-pitch', 520);

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
            background: 'radial-gradient(circle at 18% 18%, rgba(77,216,255,0.16), transparent 22%), radial-gradient(circle at 82% 16%, rgba(255,111,142,0.12), transparent 18%), linear-gradient(180deg, rgba(255,255,255,0.03), transparent 34%)',
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
          {host.renderUtilityActionsSurface()}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 0.88fr)',
              gap: 16,
              minHeight: 0,
            }}
          >
            <main
              style={{
                position: 'relative',
                minHeight: 0,
                borderRadius: 42,
                border: '1px solid rgba(126, 142, 194, 0.18)',
                background: 'linear-gradient(180deg, rgba(14, 18, 34, 0.96), rgba(8, 10, 18, 0.96))',
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
                  background: 'radial-gradient(circle at 50% 36%, rgba(77,216,255,0.16), transparent 28%), linear-gradient(135deg, rgba(255,255,255,0.04), transparent 42%)',
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
                  border: '1px solid rgba(126, 142, 194, 0.18)',
                  background: 'rgba(10, 14, 25, 0.74)',
                  color: '#f2f7ff',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  zIndex: 2,
                }}
              >
                <span>Helix Core</span>
                <span style={{ color: '#4dd8ff' }}>{activePanel?.label ?? 'Launcher'}</span>
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
                  border: '1px solid rgba(126, 142, 194, 0.18)',
                  background: 'rgba(10, 14, 25, 0.74)',
                  color: '#d4e1f6',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  zIndex: 2,
                }}
              >
                <span>Spine Width</span>
                <span style={{ color: '#ffbb64' }}>{panels.length}</span>
              </div>

              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: stageWidth,
                  height: stageHeight,
                  transform: 'translate(-50%, -50%)',
                  borderRadius: 38,
                  border: '1px solid rgba(77, 216, 255, 0.22)',
                  background: 'linear-gradient(180deg, rgba(26, 29, 54, 0.92), rgba(10, 11, 20, 0.94))',
                  boxShadow: '0 24px 54px rgba(0, 0, 0, 0.38)',
                  overflow: 'hidden',
                }}
              >
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'radial-gradient(circle at 50% 50%, rgba(77,216,255,0.1), transparent 30%), linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0) 30%)',
                    pointerEvents: 'none',
                  }}
                />
                <div style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%' }}>
                  {activePanel ? host.renderPanelSurface(activePanel.id, { forceMount: true, forceVisible: true }) : null}
                </div>
              </div>

              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: trackWidth,
                  height: `${trackPitch}px`,
                  transform: 'translate(-50%, -50%)',
                  pointerEvents: 'none',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '6%',
                    bottom: '6%',
                    width: 6,
                    transform: 'translateX(-50%)',
                    borderRadius: 999,
                    background: 'linear-gradient(180deg, rgba(77,216,255,0.06), rgba(77,216,255,0.3), rgba(255,111,142,0.14))',
                    boxShadow: '0 0 30px rgba(77,216,255,0.16)',
                    opacity: 0.9,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '6%',
                    bottom: '6%',
                    width: 1,
                    transform: 'translateX(-50%)',
                    background: 'linear-gradient(180deg, rgba(255,255,255,0), rgba(255,255,255,0.2), rgba(255,255,255,0))',
                    opacity: 0.8,
                  }}
                />
              </div>

              {panels.map((panel, index) => {
                const slot = resolveHelixSlot(index, panels.length, trackAmplitude, trackPitch);
                const isActive = panel.id === activePanel?.id;

                return (
                  <button
                    key={panel.id}
                    onClick={() => host.activatePanel(panel.id)}
                    style={{
                      position: 'absolute',
                      left: slot.left,
                      top: slot.top,
                      zIndex: isActive ? 4 : slot.depth,
                      width: isActive ? 196 : 160,
                      minHeight: isActive ? 96 : 78,
                      borderRadius: 999,
                      border: isActive ? '1px solid rgba(77,216,255,0.42)' : '1px solid rgba(126, 142, 194, 0.16)',
                      background: isActive
                        ? 'linear-gradient(180deg, rgba(77,216,255,0.18), rgba(14, 18, 34, 0.98))'
                        : 'linear-gradient(180deg, rgba(24, 28, 46, 0.94), rgba(10, 12, 22, 0.9))',
                      boxShadow: isActive
                        ? '0 0 0 1px rgba(77,216,255,0.18), 0 22px 42px rgba(0,0,0,0.32)'
                        : '0 14px 30px rgba(0,0,0,0.26)',
                      color: '#f5f9ff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: isActive ? '14px 16px' : '12px 14px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'transform 180ms ease, background 180ms ease, border-color 180ms ease, box-shadow 180ms ease',
                      transform: `translate(-50%, -50%) rotate(${slot.rotate}deg) scale(${isActive ? 1.04 : slot.scale})`,
                    }}
                  >
                    <span
                      style={{
                        width: isActive ? 44 : 38,
                        height: isActive ? 44 : 38,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 16,
                        flexShrink: 0,
                        background: isActive ? 'rgba(77,216,255,0.16)' : 'rgba(255,255,255,0.05)',
                        color: isActive ? '#d7f7ff' : '#d4e1f6',
                      }}
                    >
                      {panel.icon}
                    </span>

                    <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: isActive ? 13 : 12, fontWeight: 700 }}>{panel.label}</span>
                        {isActive ? (
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4dd8ff' }} />
                        ) : null}
                      </span>
                      {isActive ? (
                        <span style={{ fontSize: 10, lineHeight: 1.45, color: 'rgba(212,225,246,0.7)', maxWidth: 150 }}>
                          {panel.description}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
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
                  border: '1px solid rgba(126,142,194,0.18)',
                  background: 'rgba(10, 14, 25, 0.74)',
                  boxShadow: '0 18px 42px rgba(0,0,0,0.24)',
                  color: '#f5f9ff',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                }}
              >
                <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(212,225,246,0.56)' }}>
                  Helix Focus
                </div>
                <div style={{ marginTop: 10, fontSize: 26, fontWeight: 700, lineHeight: 1.1 }}>
                  {activePanel?.label ?? 'Launcher'}
                </div>
                <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.6, color: 'rgba(212,225,246,0.72)' }}>
                  {activePanel?.description ?? 'Ride the ribbon to bring a panel into the core.'}
                </div>
              </div>

              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  padding: 12,
                  borderRadius: 30,
                  border: '1px solid rgba(126,142,194,0.18)',
                  background: 'rgba(8, 10, 18, 0.58)',
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
                          borderRadius: 999,
                          border: isActive ? '1px solid rgba(77,216,255,0.3)' : '1px solid rgba(255,255,255,0.06)',
                          background: isActive ? 'rgba(19, 24, 42, 0.9)' : 'rgba(8, 10, 18, 0.5)',
                          color: '#f5f9ff',
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
                            background: isActive ? 'rgba(77,216,255,0.14)' : 'rgba(255,255,255,0.05)',
                            color: isActive ? '#d7f7ff' : '#d4e1f6',
                            flexShrink: 0,
                          }}
                        >
                          {panel.icon}
                        </span>
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                          <span style={{ fontSize: 12, fontWeight: 700 }}>{panel.label}</span>
                          <span style={{ fontSize: 10, lineHeight: 1.4, color: 'rgba(212,225,246,0.68)' }}>
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

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <div style={{ display: 'flex', gap: 12, minHeight: 0, overflow: 'hidden' }}>
              {host.renderPinnedPanels('left')}
            </div>

            <div
              style={{
                padding: '12px 18px',
                borderRadius: 999,
                border: '1px solid rgba(126,142,194,0.18)',
                background: 'rgba(10, 14, 25, 0.8)',
                boxShadow: '0 18px 38px rgba(0,0,0,0.3)',
                color: '#f4f8ff',
                backdropFilter: 'blur(18px)',
                WebkitBackdropFilter: 'blur(18px)',
              }}
            >
              <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(212,225,246,0.56)' }}>
                Center Stage
              </div>
              <div style={{ marginTop: 6, fontSize: 18, fontWeight: 700 }}>
                {activePanel?.label ?? 'Launcher'}
              </div>
              <div style={{ marginTop: 4, fontSize: 11, lineHeight: 1.45, color: 'rgba(212,225,246,0.72)', maxWidth: 420 }}>
                {activePanel?.description ?? 'Rotate the ribbon and pull a panel into the helix core.'}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', minHeight: 0, overflow: 'hidden', gap: 12 }}>
              {host.renderPinnedPanels('right')}
            </div>
          </div>
        </div>
      </div>
    );
  },
});
