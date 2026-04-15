import { defineThemeRenderer } from 'overlayterm-theme-renderer';

const prismSlots = [
  { left: '50%', top: '8%', rotate: 0, scale: 0.96 },
  { left: '82%', top: '16%', rotate: 10, scale: 0.88 },
  { left: '95%', top: '50%', rotate: 18, scale: 0.86 },
  { left: '82%', top: '84%', rotate: 10, scale: 0.88 },
  { left: '50%', top: '93%', rotate: 0, scale: 0.96 },
  { left: '18%', top: '84%', rotate: -10, scale: 0.88 },
  { left: '5%', top: '50%', rotate: -18, scale: 0.86 },
  { left: '18%', top: '16%', rotate: -10, scale: 0.88 },
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

function resolvePrismSlot(index, total) {
  const baseSlot = prismSlots[index % prismSlots.length];
  const layer = Math.floor(index / prismSlots.length);
  const scale = Math.max(0.72, baseSlot.scale - layer * 0.09);
  const offset = layer * 18;
  const depth = 100 + (total - index);

  return {
    left: baseSlot.left,
    top: `calc(${baseSlot.top} + ${offset}px)`,
    rotate: baseSlot.rotate + (layer % 2 === 0 ? 0 : 6),
    scale,
    depth,
  };
}

export default defineThemeRenderer({
  name: 'GameCube Prism Shell',
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
    const centerStageWidth = resolveCssLength(host, '--overlay-workbench-prism-stage-width', 'min(calc(100% - 92px), 1320px)');
    const centerStageHeight = resolveCssLength(host, '--overlay-workbench-prism-stage-height', 'min(calc(100% - 108px), 720px)');
    const prismCoreSize = resolveCssNumber(host, '--overlay-workbench-prism-core-size', 728);
    const ringOuterX = resolveCssNumber(host, '--overlay-workbench-prism-ring-x-outer', 486);
    const ringOuterY = resolveCssNumber(host, '--overlay-workbench-prism-ring-y-outer', 272);
    const ringInnerX = resolveCssNumber(host, '--overlay-workbench-prism-ring-x-inner', 362);
    const ringInnerY = resolveCssNumber(host, '--overlay-workbench-prism-ring-y-inner', 204);

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
            background: 'radial-gradient(circle at 50% 26%, rgba(115,103,240,0.16), transparent 24%), radial-gradient(circle at 50% 48%, rgba(91,199,255,0.05), transparent 46%), linear-gradient(180deg, rgba(255,255,255,0.018), rgba(255,255,255,0) 22%)',
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
            padding: 14,
            gap: 14,
          }}
        >
          {host.renderChromeBar()}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) 284px',
              gap: 12,
              minHeight: 0,
            }}
          >
            <main
              style={{
                position: 'relative',
                minHeight: 0,
                borderRadius: 42,
                border: '1px solid rgba(118, 124, 176, 0.24)',
                background: 'radial-gradient(circle at 50% 46%, rgba(22, 23, 44, 0.97), rgba(6, 7, 15, 0.985))',
                boxShadow: '0 32px 88px rgba(0, 0, 0, 0.6)',
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
                  display: 'grid',
                  placeItems: 'center',
                  pointerEvents: 'none',
                }}
              >
                <div
                  style={{
                    width: prismCoreSize,
                    height: prismCoreSize,
                    transform: 'rotate(45deg)',
                    borderRadius: 44,
                    border: '1px solid rgba(124, 110, 255, 0.24)',
                    boxShadow: `0 0 0 ${ringInnerX}px rgba(124,110,255,0.04), 0 0 0 ${ringOuterX}px rgba(77,199,255,0.03)`,
                  }}
                />
              </div>

              <div
                style={{
                  position: 'absolute',
                  left: 24,
                  top: 20,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  borderRadius: 999,
                  border: '1px solid rgba(118, 124, 176, 0.24)',
                  background: 'rgba(8, 10, 20, 0.9)',
                  color: '#f4f6ff',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  zIndex: 2,
                }}
              >
                <span>Prism Lock</span>
                <span style={{ color: '#7c6eff' }}>{activePanel?.label ?? 'Launcher'}</span>
              </div>

              <div
                style={{
                  position: 'absolute',
                  right: 24,
                  top: 20,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  borderRadius: 999,
                  border: '1px solid rgba(118, 124, 176, 0.24)',
                  background: 'rgba(8, 10, 20, 0.9)',
                  color: '#dfe3f7',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  zIndex: 2,
                }}
              >
                <span>Orbit Pods</span>
                <span style={{ color: '#5bc7ff' }}>{panels.length}</span>
              </div>

              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: centerStageWidth,
                  height: centerStageHeight,
                  transform: 'translate(-50%, -50%) perspective(1200px) rotateX(3deg)',
                  borderRadius: 34,
                  border: '1px solid rgba(124, 110, 255, 0.3)',
                  background: 'linear-gradient(180deg, rgba(22, 20, 44, 0.96), rgba(8, 9, 19, 0.96))',
                  boxShadow: '0 32px 84px rgba(0, 0, 0, 0.46)',
                  overflow: 'hidden',
                }}
              >
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'radial-gradient(circle at 50% 0%, rgba(115,103,240,0.12), transparent 26%), linear-gradient(135deg, rgba(255,255,255,0.016), transparent 34%)',
                    pointerEvents: 'none',
                  }}
                />
                <div style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%' }}>
                  {activePanel ? host.renderPanelSurface(activePanel.id, { forceMount: true, forceVisible: true }) : null}
                </div>
              </div>

              {panels.map((panel, index) => {
                const slot = resolvePrismSlot(index, panels.length);
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
                      width: isActive ? 118 : 94,
                      height: isActive ? 118 : 94,
                      borderRadius: 28,
                      border: isActive ? '1px solid rgba(124,110,255,0.48)' : '1px solid rgba(118,124,176,0.18)',
                      background: isActive
                        ? 'linear-gradient(180deg, rgba(115,103,240,0.18), rgba(14,15,29,0.985))'
                        : 'linear-gradient(180deg, rgba(21,23,40,0.95), rgba(9,10,19,0.95))',
                      boxShadow: isActive
                        ? '0 0 0 1px rgba(124,110,255,0.22), 0 24px 44px rgba(0,0,0,0.34)'
                        : '0 14px 32px rgba(0,0,0,0.28)',
                      color: '#f6f5ff',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      cursor: 'pointer',
                      transition: 'transform 180ms ease, background 180ms ease, border-color 180ms ease, box-shadow 180ms ease',
                      transform: `translate(-50%, -50%) rotate(${slot.rotate}deg) scale(${isActive ? 1.04 : slot.scale})`,
                    }}
                  >
                    <span
                      style={{
                        transform: `rotate(${-slot.rotate}deg)`,
                        width: isActive ? 46 : 36,
                        height: isActive ? 46 : 36,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 18,
                        background: isActive ? 'rgba(124,110,255,0.18)' : 'rgba(255,255,255,0.05)',
                        color: isActive ? '#d6d1ff' : '#dfe3f7',
                      }}
                    >
                      {panel.icon}
                    </span>
                    <span
                      style={{
                        transform: `rotate(${-slot.rotate}deg)`,
                        fontSize: isActive ? 11 : 10,
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        textShadow: '0 1px 10px rgba(0,0,0,0.55)',
                      }}
                    >
                      {panel.label}
                    </span>
                    {isActive ? (
                      <span
                        style={{
                          transform: `rotate(${-slot.rotate}deg)`,
                          fontSize: 9,
                          color: 'rgba(223,227,247,0.72)',
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase',
                        }}
                      >
                        Live Prism
                      </span>
                    ) : null}
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
                  border: '1px solid rgba(118,124,176,0.22)',
                  background: 'rgba(8, 10, 20, 0.9)',
                  boxShadow: '0 18px 42px rgba(0,0,0,0.26)',
                  color: '#f5f7ff',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                }}
              >
                <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(223,227,247,0.56)' }}>
                  Prism Focus
                </div>
                <div style={{ marginTop: 10, fontSize: 26, fontWeight: 700, lineHeight: 1.1 }}>
                  {activePanel?.label ?? 'Launcher'}
                </div>
                <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.6, color: 'rgba(223,227,247,0.72)' }}>
                  {activePanel?.description ?? 'Select a prism pod to bring a surface into the center stage.'}
                </div>
              </div>

              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  padding: 12,
                  borderRadius: 30,
                  border: '1px solid rgba(118,124,176,0.22)',
                  background: 'rgba(7, 9, 18, 0.88)',
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
                          border: isActive ? '1px solid rgba(124,110,255,0.26)' : '1px solid rgba(255,255,255,0.06)',
                          background: isActive ? 'rgba(21,24,44,0.88)' : 'rgba(11,12,24,0.5)',
                          color: '#f5f7ff',
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
                            background: isActive ? 'rgba(124,110,255,0.16)' : 'rgba(255,255,255,0.05)',
                            color: isActive ? '#d6d1ff' : '#dfe3f7',
                            flexShrink: 0,
                          }}
                        >
                          {panel.icon}
                        </span>
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                          <span style={{ fontSize: 12, fontWeight: 700 }}>{panel.label}</span>
                          <span style={{ fontSize: 10, lineHeight: 1.4, color: 'rgba(223,227,247,0.68)' }}>
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
                border: '1px solid rgba(118,124,176,0.22)',
                background: 'rgba(8, 10, 20, 0.9)',
                boxShadow: '0 18px 38px rgba(0,0,0,0.32)',
                color: '#f4f6ff',
                backdropFilter: 'blur(18px)',
                WebkitBackdropFilter: 'blur(18px)',
              }}
            >
              <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(223,227,247,0.54)' }}>
                Center Stage
              </div>
              <div style={{ marginTop: 6, fontSize: 18, fontWeight: 700 }}>
                {activePanel?.label ?? 'Launcher'}
              </div>
              <div style={{ marginTop: 4, fontSize: 11, lineHeight: 1.45, color: 'rgba(223,227,247,0.72)', maxWidth: 420 }}>
                {activePanel?.description ?? 'Rotate a prism pod to pull a panel into the center stage.'}
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
