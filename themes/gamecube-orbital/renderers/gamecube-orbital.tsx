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

const controllerPalette = [
  {
    border: 'rgba(124, 110, 255, 0.54)',
    glow: 'rgba(124, 110, 255, 0.28)',
    icon: '#cbbfff',
    iconBackground: 'rgba(124, 110, 255, 0.16)',
  },
  {
    border: 'rgba(91, 198, 121, 0.5)',
    glow: 'rgba(91, 198, 121, 0.24)',
    icon: '#bff3cb',
    iconBackground: 'rgba(91, 198, 121, 0.14)',
  },
  {
    border: 'rgba(214, 219, 236, 0.42)',
    glow: 'rgba(214, 219, 236, 0.18)',
    icon: '#eff3ff',
    iconBackground: 'rgba(214, 219, 236, 0.12)',
  },
  {
    border: 'rgba(218, 92, 118, 0.46)',
    glow: 'rgba(218, 92, 118, 0.22)',
    icon: '#ffd2dc',
    iconBackground: 'rgba(218, 92, 118, 0.14)',
  },
  {
    border: 'rgba(242, 202, 84, 0.48)',
    glow: 'rgba(242, 202, 84, 0.24)',
    icon: '#fff0b4',
    iconBackground: 'rgba(242, 202, 84, 0.14)',
  },
  {
    border: 'rgba(91, 199, 255, 0.48)',
    glow: 'rgba(91, 199, 255, 0.22)',
    icon: '#c9eeff',
    iconBackground: 'rgba(91, 199, 255, 0.14)',
  },
];

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
      label: 'Orbital Ring',
      order: 0,
      panels: host.shellModel.launcher.panels,
    },
  ];
}

function resolveOrbitPoint(index, total, radiusX, radiusY, ringShift = 0) {
  const ratio = total <= 1 ? 0 : index / total;
  const angle = ratio * Math.PI * 2 + ringShift - Math.PI / 2;
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
    const centerStageWidth = resolveCssLength(host, '--overlay-workbench-gamecube-stage-width', 'min(72vw, 1260px)');
    const centerStageHeight = resolveCssLength(host, '--overlay-workbench-gamecube-stage-height', 'min(76vh, 720px)');
    const haloSize = resolveCssNumber(host, '--overlay-workbench-gamecube-halo-size', 720);
    const haloInnerRing = resolveCssNumber(host, '--overlay-workbench-gamecube-halo-inner-ring', 126);
    const haloOuterRing = resolveCssNumber(host, '--overlay-workbench-gamecube-halo-outer-ring', 246);

    const orbitBaseRadiusX = Math.min(Math.max(layout.regions.content.width * 0.34, 180), 460);
    const orbitBaseRadiusY = Math.min(Math.max(layout.regions.content.height * 0.24, 110), 260);
    const innerOrbitRadiusX = Math.max(orbitBaseRadiusX * 0.72, 150);
    const innerOrbitRadiusY = Math.max(orbitBaseRadiusY * 0.72, 96);

    return (
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          background: 'linear-gradient(180deg, rgba(6, 8, 18, 0.98), rgba(3, 5, 12, 0.99))',
        }}
      >
        {host.wallpaper.renderBackdropStack()}

        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background: [
              'radial-gradient(circle at center, rgba(115,103,240,0.11), transparent 34%)',
              'radial-gradient(circle at 50% 58%, rgba(76,180,255,0.07), transparent 54%)',
              'linear-gradient(180deg, rgba(255,255,255,0.018), rgba(255,255,255,0) 20%)',
            ].join(', '),
            pointerEvents: 'none',
          }}
        />

        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.38), transparent 92%)',
            pointerEvents: 'none',
            opacity: 0.4,
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
              border: '1px solid rgba(117, 123, 172, 0.24)',
              background: 'rgba(8, 10, 20, 0.88)',
              boxShadow: '0 18px 42px rgba(0,0,0,0.24)',
              color: '#f2f4ff',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
            }}
          >
            <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(173,181,214,0.62)' }}>
              Orbital Control
            </div>
            <div style={{ marginTop: 10, fontSize: 26, fontWeight: 700, lineHeight: 1.05 }}>
              {activePanel?.label ?? 'Launcher'}
            </div>
            <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.6, color: 'rgba(201,206,235,0.74)' }}>
              {activePanel?.description ?? 'The orbit stage owns launch. The side rail is just telemetry and context.'}
            </div>
          </section>

          <section
            style={{
              flex: 1,
              minHeight: 0,
              padding: 14,
              borderRadius: 30,
              border: '1px solid rgba(117, 123, 172, 0.24)',
              background: 'rgba(8,10,20,0.72)',
              boxShadow: '0 16px 38px rgba(0,0,0,0.22)',
              overflow: 'auto',
              color: '#f2f4ff',
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
                  <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(173,181,214,0.62)' }}>
                    {group.label}
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                    <span style={{ fontSize: 18, fontWeight: 700 }}>{group.panels.length}</span>
                    <span style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(201,206,235,0.72)' }}>
                      Nodes
                    </span>
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
                border: '1px solid rgba(117, 123, 172, 0.24)',
                background: 'radial-gradient(circle at center, rgba(18,18,38,0.96), rgba(6,7,15,0.985))',
                boxShadow: '0 34px 84px rgba(2, 2, 10, 0.62)',
                overflow: 'hidden',
                backdropFilter: 'blur(22px)',
                WebkitBackdropFilter: 'blur(22px)',
              }}
            >
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'grid',
                  placeItems: 'center',
                  pointerEvents: 'none',
                }}
              >
                <div
                  style={{
                    width: haloSize,
                    height: haloSize,
                    borderRadius: '50%',
                    border: '1px solid rgba(124, 110, 255, 0.14)',
                    boxShadow: `0 0 0 ${haloInnerRing}px rgba(124,110,255,0.05), 0 0 0 ${haloOuterRing}px rgba(77,199,255,0.03)`,
                  }}
                />
              </div>

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
                  border: '1px solid rgba(117, 123, 172, 0.24)',
                  background: 'rgba(8,10,20,0.9)',
                  color: '#f2f4ff',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  zIndex: 2,
                }}
              >
                <span>Orbital Focus</span>
                <span style={{ color: '#5bc7ff' }}>{activePanel?.label ?? 'Launcher'}</span>
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
                  border: '1px solid rgba(117, 123, 172, 0.24)',
                  background: 'rgba(8,10,20,0.9)',
                  color: '#d9def4',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  zIndex: 2,
                }}
              >
                <span>Orbit Nodes</span>
                <span style={{ color: '#7c6eff' }}>{panels.length}</span>
              </div>

              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: stageWidth,
                  height: stageHeight,
                  transform: 'translate(-50%, -50%)',
                  borderRadius: 36,
                  border: '1px solid rgba(124, 110, 255, 0.18)',
                  background: 'linear-gradient(180deg, rgba(20, 18, 40, 0.94), rgba(8, 9, 18, 0.98))',
                  boxShadow: '0 32px 80px rgba(0, 0, 0, 0.5)',
                  overflow: 'hidden',
                }}
              >
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'radial-gradient(circle at 50% 50%, rgba(77,216,255,0.1), transparent 28%), linear-gradient(135deg, rgba(255,255,255,0.03), transparent 36%)',
                    pointerEvents: 'none',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    width: '34%',
                    height: '34%',
                    transform: 'translate(-50%, -50%)',
                    borderRadius: '50%',
                    border: '1px solid rgba(77,216,255,0.14)',
                    boxShadow: '0 0 0 78px rgba(77,216,255,0.03), 0 0 0 160px rgba(124,110,255,0.02)',
                    pointerEvents: 'none',
                  }}
                />
                <div style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%', minHeight: 0 }}>
                  {activePanel ? host.renderPanelSurface(activePanel.id, { forceMount: true, forceVisible: true }) : null}
                </div>
              </div>

              {panels.map((panel, index) => {
                const useOuterRing = index % 2 === 0;
                const point = resolveOrbitPoint(
                  index,
                  panels.length,
                  useOuterRing ? orbitBaseRadiusX : innerOrbitRadiusX,
                  useOuterRing ? orbitBaseRadiusY : innerOrbitRadiusY,
                  useOuterRing ? 0 : Math.PI / panels.length,
                );
                const isActive = panel.id === activePanel?.id;
                const colors = controllerPalette[index % controllerPalette.length];

                return (
                  <button
                    key={panel.id}
                    onClick={() => host.activatePanel(panel.id)}
                    style={{
                      position: 'absolute',
                      left: point.left,
                      top: point.top,
                      transform: `translate(-50%, -50%) rotate(${(index % 2 === 0 ? 1 : -1) * 6}deg)`,
                      width: isActive ? 124 : 98,
                      height: isActive ? 124 : 98,
                      borderRadius: 28,
                      border: isActive ? `1px solid ${colors.border}` : '1px solid rgba(117, 123, 172, 0.18)',
                      background: isActive
                        ? `linear-gradient(180deg, ${colors.glow}, rgba(14,15,30,0.98))`
                        : 'linear-gradient(180deg, rgba(19,21,38,0.94), rgba(9,10,18,0.94))',
                      boxShadow: isActive
                        ? `0 0 0 1px ${colors.glow}, 0 20px 44px rgba(0,0,0,0.38)`
                        : '0 14px 32px rgba(0,0,0,0.3)',
                      color: '#f6f3ff',
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
                        transform: 'rotate(0deg)',
                        width: isActive ? 46 : 36,
                        height: isActive ? 46 : 36,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 18,
                        background: isActive ? colors.iconBackground : 'rgba(255,255,255,0.05)',
                        color: isActive ? colors.icon : '#d9def4',
                      }}
                    >
                      {panel.icon}
                    </span>
                    <span
                      style={{
                        transform: 'rotate(0deg)',
                        fontSize: isActive ? 11 : 10,
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        textShadow: '0 1px 10px rgba(0,0,0,0.55)',
                      }}
                    >
                      {panel.label}
                    </span>
                  </button>
                );
              })}
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
                  border: '1px solid rgba(117, 123, 172, 0.24)',
                  background: 'rgba(8,10,20,0.9)',
                  boxShadow: '0 18px 42px rgba(0,0,0,0.24)',
                  color: '#f5f9ff',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                }}
              >
                <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(173,181,214,0.62)' }}>
                  Orbital Focus
                </div>
                <div style={{ marginTop: 10, fontSize: 26, fontWeight: 700, lineHeight: 1.08 }}>
                  {activePanel?.label ?? 'Launcher'}
                </div>
                <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.6, color: 'rgba(201,206,235,0.74)' }}>
                  {activePanel?.description ?? 'The ring is the launcher. The rail only explains what is already in motion.'}
                </div>
              </section>

              <section
                style={{
                  flex: 1,
                  minHeight: 0,
                  padding: 14,
                  borderRadius: 30,
                  border: '1px solid rgba(117, 123, 172, 0.24)',
                  background: 'rgba(8,10,20,0.76)',
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
                      <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(173,181,214,0.62)' }}>
                        {group.label}
                      </div>
                      <div style={{ marginTop: 8, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                        <span style={{ fontSize: 18, fontWeight: 700 }}>{group.panels.length}</span>
                        <span style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(201,206,235,0.72)' }}>
                          Nodes
                        </span>
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
