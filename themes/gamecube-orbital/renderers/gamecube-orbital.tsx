import { defineThemeRenderer } from 'overlayterm-theme-renderer';

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

function orbitPoint(index, total, radiusX, radiusY) {
  const angle = ((Math.PI * 2) / total) * index - Math.PI / 2;
  return {
    angle,
    left: `calc(50% + ${Math.cos(angle) * radiusX}px)`,
    top: `calc(50% + ${Math.sin(angle) * radiusY}px)`,
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
    wallpaper: true,
  },
  component({ host }) {
    const panels = host.panels.filter(panel => !panel.isPinned);
    const activePanel = panels.find(panel => panel.id === host.activePanelId) ?? panels[0] ?? null;
    const centerStageWidth = resolveCssLength(
      host,
      '--overlay-workbench-gamecube-stage-width',
      'min(calc(100% - 88px), 1260px)',
    );
    const centerStageHeight = resolveCssLength(
      host,
      '--overlay-workbench-gamecube-stage-height',
      'min(calc(100% - 96px), 700px)',
    );
    const orbitalHaloSize = resolveCssNumber(
      host,
      '--overlay-workbench-gamecube-halo-size',
      720,
    );
    const orbitalHaloInnerRing = resolveCssNumber(
      host,
      '--overlay-workbench-gamecube-halo-inner-ring',
      126,
    );
    const orbitalHaloOuterRing = resolveCssNumber(
      host,
      '--overlay-workbench-gamecube-halo-outer-ring',
      246,
    );
    const outerOrbitRadiusX = resolveCssNumber(
      host,
      '--overlay-workbench-gamecube-orbit-radius-x-outer',
      492,
    );
    const outerOrbitRadiusY = resolveCssNumber(
      host,
      '--overlay-workbench-gamecube-orbit-radius-y-outer',
      276,
    );
    const innerOrbitRadiusX = resolveCssNumber(
      host,
      '--overlay-workbench-gamecube-orbit-radius-x-inner',
      398,
    );
    const innerOrbitRadiusY = resolveCssNumber(
      host,
      '--overlay-workbench-gamecube-orbit-radius-y-inner',
      224,
    );

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
            background: 'radial-gradient(circle at center, rgba(115,103,240,0.11), transparent 40%), radial-gradient(circle at 50% 58%, rgba(76,180,255,0.05), transparent 54%), linear-gradient(180deg, rgba(255,255,255,0.018), rgba(255,255,255,0) 20%)',
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
              border: '1px solid rgba(117, 123, 172, 0.24)',
              background: 'radial-gradient(circle at center, rgba(18,18,38,0.94), rgba(7,8,18,0.985))',
              boxShadow: '0 34px 84px rgba(2, 2, 10, 0.62)',
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
                  width: orbitalHaloSize,
                  height: orbitalHaloSize,
                  borderRadius: '50%',
                  border: '1px solid rgba(124, 110, 255, 0.14)',
                  boxShadow: `0 0 0 ${orbitalHaloInnerRing}px rgba(124,110,255,0.05), 0 0 0 ${orbitalHaloOuterRing}px rgba(77,199,255,0.03)`,
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
                border: '1px solid rgba(117, 123, 172, 0.24)',
                background: 'rgba(8,10,20,0.9)',
                color: '#f2f4ff',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
              }}
            >
              <span>Orbital Focus</span>
              <span style={{ color: '#5bc7ff' }}>{activePanel?.label ?? 'Launcher'}</span>
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
                border: '1px solid rgba(117, 123, 172, 0.24)',
                background: 'rgba(8,10,20,0.9)',
                color: '#d9def4',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
              }}
            >
              <span>Cube Ring</span>
              <span style={{ color: '#7c6eff' }}>{panels.length}</span>
            </div>

            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: centerStageWidth,
                height: centerStageHeight,
                transform: 'translate(-50%, -50%)',
                borderRadius: 32,
                border: '1px solid rgba(124, 110, 255, 0.28)',
                background: 'linear-gradient(180deg, rgba(20,18,40,0.95), rgba(8,9,18,0.95))',
                boxShadow: '0 30px 80px rgba(3, 4, 16, 0.58)',
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
                useOuterRing ? outerOrbitRadiusX : innerOrbitRadiusX,
                useOuterRing ? outerOrbitRadiusY : innerOrbitRadiusY,
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
                    transform: `translate(-50%, -50%) rotate(${point.angle}rad)`,
                    width: isActive ? 120 : 94,
                    height: isActive ? 120 : 94,
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
                      transform: `rotate(${-point.angle}rad)`,
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
                      transform: `rotate(${-point.angle}rad)`,
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
              border: '1px solid rgba(117, 123, 172, 0.24)',
              background: 'rgba(8,10,20,0.9)',
              boxShadow: '0 18px 38px rgba(4,4,12,0.3)',
              color: '#f2f4ff',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
            }}
          >
              <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(173,181,214,0.62)' }}>
                Center Stage
              </div>
              <div style={{ marginTop: 6, fontSize: 18, fontWeight: 700 }}>
                {activePanel?.label ?? 'Launcher'}
              </div>
              <div style={{ marginTop: 4, fontSize: 11, lineHeight: 1.45, color: 'rgba(201,206,235,0.74)', maxWidth: 420 }}>
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
