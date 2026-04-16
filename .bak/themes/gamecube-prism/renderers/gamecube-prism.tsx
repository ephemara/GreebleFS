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

const prismSlots = [
  { left: '50%', top: '8%', rotate: 0, scale: 0.98 },
  { left: '82%', top: '16%', rotate: 10, scale: 0.9 },
  { left: '95%', top: '50%', rotate: 18, scale: 0.86 },
  { left: '82%', top: '84%', rotate: 10, scale: 0.9 },
  { left: '50%', top: '93%', rotate: 0, scale: 0.98 },
  { left: '18%', top: '84%', rotate: -10, scale: 0.9 },
  { left: '5%', top: '50%', rotate: -18, scale: 0.86 },
  { left: '18%', top: '16%', rotate: -10, scale: 0.9 },
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
      label: 'Prism Facets',
      order: 0,
      panels: host.shellModel.launcher.panels,
    },
  ];
}

function resolvePrismSlot(index, total) {
  const baseSlot = prismSlots[index % prismSlots.length];
  const layer = Math.floor(index / prismSlots.length);
  const scale = Math.max(0.7, baseSlot.scale - layer * 0.08);
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
    pinnedPanels: true,
    wallpaper: true,
  },
  component({ host }) {
    const layout = host.shellModel.layout;
    const launcherGroups = resolveLauncherGroups(host);
    const panels = host.shellModel.launcher.panels;
    const activePanel = panels.find(panel => panel.id === host.activePanelId) ?? panels[0] ?? null;
    const centerStageWidth = resolveCssLength(host, '--overlay-workbench-prism-stage-width', 'min(72vw, 1280px)');
    const centerStageHeight = resolveCssLength(host, '--overlay-workbench-prism-stage-height', 'min(76vh, 736px)');
    const prismCoreSize = resolveCssNumber(host, '--overlay-workbench-prism-core-size', 716);
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
          background: 'linear-gradient(180deg, rgba(5, 6, 14, 0.99), rgba(4, 5, 12, 0.99))',
        }}
      >
        {host.wallpaper.renderBackdropStack()}

        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background: [
              'radial-gradient(circle at 50% 24%, rgba(115,103,240,0.2), transparent 22%)',
              'radial-gradient(circle at 50% 48%, rgba(91,199,255,0.06), transparent 42%)',
              'linear-gradient(180deg, rgba(255,255,255,0.018), rgba(255,255,255,0) 22%)',
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
              'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
            backgroundSize: '42px 42px',
            maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.36), transparent 92%)',
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
              border: '1px solid rgba(118,124,176,0.22)',
              background: 'rgba(8, 10, 20, 0.92)',
              boxShadow: '0 18px 42px rgba(0,0,0,0.26)',
              color: '#f4f6ff',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }}
          >
            <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(223,227,247,0.56)' }}>
              Prism Lock
            </div>
            <div style={{ marginTop: 10, fontSize: 26, fontWeight: 700, lineHeight: 1.05 }}>
              {activePanel?.label ?? 'Launcher'}
            </div>
            <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.6, color: 'rgba(223,227,247,0.72)' }}>
              {activePanel?.description ?? 'A faceted shell for a faceted app: the active surface lives in the center vault.'}
            </div>
          </section>

          <section
            style={{
              flex: 1,
              minHeight: 0,
              padding: 14,
              borderRadius: 30,
              border: '1px solid rgba(118,124,176,0.22)',
              background: 'rgba(7, 9, 18, 0.84)',
              boxShadow: '0 16px 38px rgba(0,0,0,0.22)',
              overflow: 'auto',
              color: '#f5f7ff',
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
                    background: 'linear-gradient(135deg, rgba(124,110,255,0.08), rgba(255,255,255,0.02))',
                  }}
                >
                  <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(223,227,247,0.56)' }}>
                    {group.label}
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                    <span style={{ fontSize: 18, fontWeight: 700 }}>{group.panels.length}</span>
                    <span style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(223,227,247,0.68)' }}>
                      Facets
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
                border: '1px solid rgba(118,124,176,0.24)',
                background: 'radial-gradient(circle at 50% 46%, rgba(22,23,44,0.97), rgba(6,7,15,0.99))',
                boxShadow: '0 32px 88px rgba(0,0,0,0.6)',
                overflow: 'hidden',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
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
                aria-hidden
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'linear-gradient(135deg, transparent 46%, rgba(124,110,255,0.08) 47%, rgba(124,110,255,0.08) 53%, transparent 54%), linear-gradient(225deg, transparent 46%, rgba(77,199,255,0.06) 47%, rgba(77,199,255,0.06) 53%, transparent 54%)',
                  pointerEvents: 'none',
                  opacity: 0.45,
                }}
              />

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
                <span>Facet Count</span>
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
                  borderRadius: 36,
                  border: '1px solid rgba(124, 110, 255, 0.24)',
                  background: 'linear-gradient(180deg, rgba(20, 18, 38, 0.94), rgba(8, 9, 18, 0.98))',
                  boxShadow: '0 30px 84px rgba(0,0,0,0.5)',
                  overflow: 'hidden',
                }}
              >
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'radial-gradient(circle at 50% 0%, rgba(115,103,240,0.16), transparent 24%), linear-gradient(135deg, rgba(255,255,255,0.03), transparent 36%)',
                    pointerEvents: 'none',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    width: '48%',
                    height: '48%',
                    transform: 'translate(-50%, -50%) rotate(45deg)',
                    borderRadius: 28,
                    border: '1px solid rgba(124,110,255,0.18)',
                    boxShadow: '0 0 0 88px rgba(124,110,255,0.03), 0 0 0 172px rgba(77,199,255,0.02)',
                    pointerEvents: 'none',
                  }}
                />
                <div style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%', minHeight: 0 }}>
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
                      width: isActive ? 122 : 96,
                      height: isActive ? 122 : 96,
                      borderRadius: 26,
                      border: isActive ? '1px solid rgba(124,110,255,0.5)' : '1px solid rgba(118,124,176,0.18)',
                      background: isActive
                        ? 'linear-gradient(180deg, rgba(115,103,240,0.2), rgba(14,15,29,0.985))'
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
                  {activePanel?.description ?? 'Select a prism facet to bring a surface into the center vault.'}
                </div>
              </section>

              <section
                style={{
                  flex: 1,
                  minHeight: 0,
                  padding: 14,
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
                  {launcherGroups.slice(0, 4).map(group => (
                    <button
                      key={group.id}
                      onClick={() => {
                        const firstPanel = group.panels[0];
                        if (firstPanel) {
                          host.activatePanel(firstPanel.id);
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        padding: '12px 14px',
                        borderRadius: 18,
                        border: '1px solid rgba(255,255,255,0.06)',
                        background: 'linear-gradient(135deg, rgba(124,110,255,0.08), rgba(255,255,255,0.02))',
                        color: '#f5f7ff',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                        <span style={{ fontSize: 12, fontWeight: 700 }}>{group.label}</span>
                        <span style={{ fontSize: 10, lineHeight: 1.4, color: 'rgba(223,227,247,0.68)' }}>
                          {group.panels.length} panels in this facet cluster
                        </span>
                      </span>
                      <span
                        style={{
                          width: 32,
                          height: 32,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 12,
                          background: 'rgba(124,110,255,0.16)',
                          color: '#d6d1ff',
                          flexShrink: 0,
                        }}
                      >
                        {group.panels.length}
                      </span>
                    </button>
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
