import { defineThemeRenderer } from 'overlayterm-theme-renderer';

function regionStyle(region, extra = {}) {
  if (!region.visible) {
    return { display: 'none' };
  }

  return {
    position: 'absolute',
    left: region.x,
    top: region.y,
    width: region.width,
    height: region.height,
    overflow: 'hidden',
    ...extra,
  };
}

function resolveCssLength(host, name, fallback) {
  const value = host.appearance.cssVars?.[name];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function resolveCssNumber(host, name, fallback) {
  const value = host.appearance.cssVars?.[name];
  const parsed = typeof value === 'string' ? Number.parseFloat(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolveLauncherGroups(host) {
  if (host.shellModel.launcher.groups.length > 0) {
    return host.shellModel.launcher.groups;
  }

  return [
    {
      id: 'launch',
      label: 'Helix Spine',
      order: 0,
      panels: host.shellModel.launcher.panels,
    },
  ];
}

function resolveHelixOffset(index, total, amplitude) {
  const ratio = total <= 1 ? 0 : index / (total - 1);
  const angle = ratio * Math.PI * 4.2;
  const curve = Math.sin(angle);
  const lift = Math.cos(angle);

  return {
    left: `calc(50% + ${curve * amplitude}px)`,
    wobble: curve * 4.5,
    lift: lift * 0.75,
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
    pinnedPanels: true,
    wallpaper: true,
  },
  component({ host }) {
    const layout = host.shellModel.layout;
    const launcherGroups = resolveLauncherGroups(host);
    const panels = host.shellModel.launcher.panels;
    const activePanel = panels.find(panel => panel.id === host.activePanelId) ?? panels[0] ?? null;
    const stageWidth = resolveCssLength(host, '--overlay-workbench-helix-stage-width', 'min(72vw, 1060px)');
    const stageHeight = resolveCssLength(host, '--overlay-workbench-helix-stage-height', 'min(76vh, 720px)');
    const spineAmplitude = resolveCssNumber(host, '--overlay-workbench-helix-spine-amplitude', 78);

    return (
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          background: 'linear-gradient(180deg, rgba(7, 11, 24, 0.98), rgba(4, 7, 14, 0.98))',
        }}
      >
        {host.wallpaper.renderBackdropStack()}

        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background: [
              'radial-gradient(circle at 18% 16%, rgba(77,216,255,0.16), transparent 22%)',
              'radial-gradient(circle at 82% 18%, rgba(255,111,142,0.1), transparent 20%)',
              'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0) 24%)',
            ].join(', '),
            pointerEvents: 'none',
          }}
        />

        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: '62%',
            height: '62%',
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            border: '1px solid rgba(77,216,255,0.1)',
            boxShadow: '0 0 0 120px rgba(77,216,255,0.02), 0 0 0 240px rgba(255,111,142,0.015)',
            pointerEvents: 'none',
          }}
        />

        <div style={regionStyle(layout.regions.chrome, { zIndex: 3, padding: '0 18px 12px' })}>
          {host.renderUtilityActionsSurface()}
        </div>

        <div style={regionStyle(layout.regions.launcher, { zIndex: 2, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 })}>
          <section
            style={{
              padding: 18,
              borderRadius: 30,
              border: '1px solid rgba(126, 142, 194, 0.18)',
              background: 'rgba(10, 14, 25, 0.76)',
              boxShadow: '0 18px 42px rgba(0, 0, 0, 0.24)',
              color: '#f5f9ff',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
            }}
          >
            <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(212,225,246,0.56)' }}>
              Helix Control
            </div>
            <div style={{ marginTop: 10, fontSize: 26, fontWeight: 700, lineHeight: 1.05 }}>
              {activePanel?.label ?? 'Launcher'}
            </div>
            <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.6, color: 'rgba(212,225,246,0.74)' }}>
              {activePanel?.description ?? 'The rail owns launch, the core owns content, and the host does not inject duplicate chrome.'}
            </div>
          </section>

          <section
            style={{
              flex: 1,
              minHeight: 0,
              padding: 14,
              borderRadius: 30,
              border: '1px solid rgba(126, 142, 194, 0.18)',
              background: 'rgba(8, 10, 18, 0.7)',
              boxShadow: '0 16px 38px rgba(0,0,0,0.22)',
              overflow: 'auto',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {launcherGroups.slice(0, 4).map(group => (
                <div key={group.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      fontSize: 10,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: 'rgba(212,225,246,0.56)',
                    }}
                  >
                    <span>{group.label}</span>
                    <span>{group.panels.length}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {group.panels.slice(0, 5).map((panel, index) => {
                      const isActive = panel.id === activePanel?.id;
                      const offset = Math.sin(index * 0.95) * spineAmplitude * 0.08;
                      const tilt = Math.sin(index * 0.6) * 4;

                      return (
                        <button
                          key={panel.id}
                          onClick={() => host.activatePanel(panel.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '10px 12px',
                            marginLeft: `${Math.max(-8, offset)}px`,
                            borderRadius: 18,
                            border: isActive ? '1px solid rgba(77,216,255,0.28)' : '1px solid rgba(126,142,194,0.12)',
                            background: isActive ? 'rgba(19, 24, 42, 0.92)' : 'rgba(9, 11, 20, 0.58)',
                            color: '#f5f9ff',
                            cursor: 'pointer',
                            textAlign: 'left',
                            boxShadow: isActive ? '0 16px 32px rgba(0,0,0,0.3)' : 'none',
                            transform: `rotate(${tilt}deg)`,
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
                              background: isActive ? 'rgba(77,216,255,0.16)' : 'rgba(255,255,255,0.05)',
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
              ))}
            </div>
          </section>
        </div>

        <div
          style={regionStyle(layout.regions.content, {
            zIndex: 2,
            padding: layout.contentInnerPadding,
          })}
        >
          <div
            style={{
              position: 'relative',
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) 300px',
              gap: 16,
              width: '100%',
              height: '100%',
              minHeight: 0,
            }}
          >
            <section
              style={{
                position: 'relative',
                minHeight: 0,
                borderRadius: 44,
                border: '1px solid rgba(126, 142, 194, 0.18)',
                background: 'radial-gradient(circle at 50% 34%, rgba(77,216,255,0.14), rgba(8,10,18,0.96) 38%, rgba(5,6,14,0.98) 100%)',
                boxShadow: '0 32px 84px rgba(0,0,0,0.58)',
                overflow: 'hidden',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
              }}
            >
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'radial-gradient(circle at 50% 50%, rgba(77,216,255,0.08), transparent 24%), linear-gradient(135deg, rgba(255,255,255,0.03), transparent 38%)',
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
                <span>Panels</span>
                <span style={{ color: '#ffbb64' }}>{panels.length}</span>
              </div>

              <div
                style={{
                  position: 'absolute',
                  left: 24,
                  right: 24,
                  top: 68,
                  bottom: 18,
                  borderRadius: 36,
                  border: '1px solid rgba(126, 142, 194, 0.14)',
                  background: 'rgba(255,255,255,0.02)',
                  overflow: 'hidden',
                }}
              >
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: 0,
                    bottom: 0,
                    width: 2,
                    transform: 'translateX(-50%)',
                    background: 'linear-gradient(180deg, rgba(77,216,255,0), rgba(77,216,255,0.35), rgba(77,216,255,0))',
                    boxShadow: '0 0 24px rgba(77,216,255,0.18)',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    width: stageWidth,
                    height: stageHeight,
                    transform: 'translate(-50%, -50%)',
                    borderRadius: 36,
                    border: '1px solid rgba(77,216,255,0.2)',
                    background: 'linear-gradient(180deg, rgba(24, 30, 52, 0.94), rgba(10, 12, 20, 0.98))',
                    boxShadow: '0 24px 54px rgba(0,0,0,0.4)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    aria-hidden
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'radial-gradient(circle at 50% 22%, rgba(77,216,255,0.14), transparent 26%), linear-gradient(135deg, rgba(255,255,255,0.04), transparent 44%)',
                      pointerEvents: 'none',
                    }}
                  />
                  <div style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%', minHeight: 0 }}>
                    {activePanel ? host.renderPanelSurface(activePanel.id, { forceMount: true, forceVisible: true }) : null}
                  </div>
                </div>

                {panels.map((panel, index) => {
                  const slot = resolveHelixOffset(index, panels.length, Math.min(layout.regions.content.width * 0.28, 286));
                  const isActive = panel.id === activePanel?.id;

                  return (
                    <button
                      key={panel.id}
                      onClick={() => host.activatePanel(panel.id)}
                      style={{
                        position: 'absolute',
                        left: slot.left,
                        top: `${10 + (index / Math.max(1, panels.length - 1)) * 80}%`,
                        zIndex: isActive ? 4 : slot.depth,
                        width: isActive ? 174 : 146,
                        minHeight: isActive ? 92 : 78,
                        borderRadius: 999,
                        border: isActive ? '1px solid rgba(77,216,255,0.36)' : '1px solid rgba(126,142,194,0.12)',
                        background: isActive
                          ? 'linear-gradient(180deg, rgba(77,216,255,0.16), rgba(14,18,34,0.98))'
                          : 'linear-gradient(180deg, rgba(18, 22, 36, 0.94), rgba(9, 10, 18, 0.96))',
                        boxShadow: isActive
                          ? '0 0 0 1px rgba(77,216,255,0.2), 0 20px 42px rgba(0,0,0,0.34)'
                          : '0 14px 30px rgba(0,0,0,0.24)',
                        color: '#f5f9ff',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: isActive ? '14px 16px' : '12px 14px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'transform 180ms ease, background 180ms ease, border-color 180ms ease, box-shadow 180ms ease',
                        transform: `translate(-50%, -50%) rotate(${slot.wobble}deg) translateY(${slot.lift}px)`,
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
                          {isActive ? <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4dd8ff' }} /> : null}
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
              </div>
            </section>

            <aside
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                minHeight: 0,
              }}
            >
              <section
                style={{
                  padding: 18,
                  borderRadius: 30,
                  border: '1px solid rgba(126,142,194,0.18)',
                  background: 'rgba(10, 14, 25, 0.76)',
                  boxShadow: '0 18px 42px rgba(0,0,0,0.24)',
                  color: '#f5f9ff',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                }}
              >
                <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(212,225,246,0.56)' }}>
                  Helix Focus
                </div>
                <div style={{ marginTop: 10, fontSize: 26, fontWeight: 700, lineHeight: 1.08 }}>
                  {activePanel?.label ?? 'Launcher'}
                </div>
                <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.6, color: 'rgba(212,225,246,0.72)' }}>
                  {activePanel?.description ?? 'Pull a node through the helix to make it live in the center stage.'}
                </div>
              </section>

              <section
                style={{
                  flex: 1,
                  minHeight: 0,
                  padding: 14,
                  borderRadius: 30,
                  border: '1px solid rgba(126,142,194,0.18)',
                  background: 'rgba(8, 10, 18, 0.64)',
                  boxShadow: '0 16px 38px rgba(0,0,0,0.22)',
                  overflow: 'auto',
                  color: '#f5f9ff',
                  backdropFilter: 'blur(18px)',
                  WebkitBackdropFilter: 'blur(18px)',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {launcherGroups.slice(0, 4).map(group => (
                    <div
                      key={group.id}
                      style={{
                        padding: 12,
                        borderRadius: 20,
                        border: '1px solid rgba(255,255,255,0.06)',
                        background: 'rgba(255,255,255,0.03)',
                      }}
                    >
                      <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(212,225,246,0.56)' }}>
                        {group.label}
                      </div>
                      <div style={{ marginTop: 8, fontSize: 18, fontWeight: 700 }}>
                        {group.panels.length}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        </div>

        {layout.regions.pinnedLeft.visible ? (
          <div style={regionStyle(layout.regions.pinnedLeft, { zIndex: 2, padding: 10 })}>
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'stretch' }}>
              {host.renderPinnedPanels('left')}
            </div>
          </div>
        ) : null}

        {layout.regions.pinnedRight.visible ? (
          <div style={regionStyle(layout.regions.pinnedRight, { zIndex: 2, padding: 10 })}>
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end' }}>
              {host.renderPinnedPanels('right')}
            </div>
          </div>
        ) : null}
      </div>
    );
  },
});
