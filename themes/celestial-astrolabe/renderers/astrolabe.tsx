import { Compass, Orbit, Sparkles } from 'lucide-react';
import { defineThemeRenderer } from 'overlayterm-theme-renderer';

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function resolvePanelSet(host) {
  const panels = host.shellModel.launcher.panels;
  const activePanel = panels.find(panel => panel.id === host.activePanelId) ?? panels[0] ?? null;
  const groups = host.shellModel.launcher.groups;
  const activeGroup = groups.find(group => group.panels.some(panel => panel.id === activePanel?.id)) ?? groups[0] ?? null;

  return {
    panels,
    activePanel,
    groups,
    activeGroup,
    activeGroupPanels: activeGroup?.panels ?? panels,
  };
}

function resolveOrbitSlot(index: number, total: number, radius: number): { x: number; y: number; scale: number; depth: number } {
  const safeTotal = Math.max(total, 1);
  const ratio = safeTotal <= 1 ? 0 : index / safeTotal;
  const angle = ratio * Math.PI * 2;
  const wobble = Math.sin(index * 0.82) * 0.12;
  return {
    x: Math.cos(angle) * radius * (0.84 + wobble),
    y: Math.sin(angle) * radius * (0.84 - wobble),
    scale: 0.86 + ((Math.cos(angle * 2) + 1) / 2) * 0.14,
    depth: 100 + (safeTotal - index),
  };
}

export default defineThemeRenderer({
  name: 'Celestial Astrolabe',
  apiVersion: 1,
  supportsLiveSwap: true,
  fallbackRuntime: 'channel-launcher',
  capabilities: {
    customScreens: true,
    wallpaperScene: true,
    surfaceAdapters: true,
  },
  surfaceOwnership: {
    chrome: true,
    launcher: true,
    contentFrame: true,
    pinnedPanels: false,
    wallpaper: true,
  },
  component({ host }) {
    const layout = host.shellModel.layout;
    const launcherRegion = layout.regions.launcher;
    const contentRegion = layout.regions.content;
    const pinnedRightRegion = layout.regions.pinnedRight;
    const chromeRegion = layout.regions.chrome;
    const { panels, activePanel, groups, activeGroup, activeGroupPanels } = resolvePanelSet(host);

    const shellInset = layout.shellInset;
    const panelGap = layout.panelGap;
    const contentPadding = Math.max(12, layout.contentInnerPadding);
    const launcherColumnWidth = clampNumber(launcherRegion.visible ? launcherRegion.width : 352, 280, 460);
    const rightRailWidth = clampNumber(pinnedRightRegion.visible ? pinnedRightRegion.width : 284, 250, 348);
    const contentStageHeight = Math.max(320, contentRegion.height - contentPadding * 2);
    const orbitDiameter = clampNumber(Math.min(launcherRegion.width || 440, contentRegion.height || 680), 360, 560);
    const orbitRadius = Math.max(120, Math.min(orbitDiameter * 0.34, 220));

    return (
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          backgroundColor: '#03060C',
          fontFamily: '"Cormorant Garamond", "Iowan Old Style", serif',
        }}
      >
        <style>{`
          @keyframes celestial-astrolabe-ring-slow {
            from { transform: translate(-50%, -50%) rotate(0deg); }
            to { transform: translate(-50%, -50%) rotate(360deg); }
          }

          @keyframes celestial-astrolabe-ring-reverse {
            from { transform: translate(-50%, -50%) rotate(0deg); }
            to { transform: translate(-50%, -50%) rotate(-360deg); }
          }

          @keyframes celestial-astrolabe-glint {
            0%, 100% { opacity: 0.36; transform: scale(0.92); }
            50% { opacity: 0.72; transform: scale(1.06); }
          }
        `}</style>
        {host.wallpaper.renderBackdropStack()}

        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: 'radial-gradient(circle at 50% 46%, rgba(212,175,55,0.11), transparent 18%), radial-gradient(circle at 22% 20%, rgba(94,119,255,0.08), transparent 24%), radial-gradient(circle at 78% 26%, rgba(255,138,91,0.08), transparent 22%), linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0) 38%)',
          }}
        />

        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '52%',
            width: Math.max(980, launcherColumnWidth + contentRegion.width + rightRailWidth),
            height: Math.max(980, contentRegion.height + 260),
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            border: '1px solid rgba(212, 175, 55, 0.05)',
            boxShadow: '0 0 0 1px rgba(212, 175, 55, 0.02) inset',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: Math.max(780, launcherColumnWidth * 2),
            height: Math.max(780, contentRegion.height * 0.9),
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            border: '1px solid rgba(212, 175, 55, 0.08)',
            pointerEvents: 'none',
            animation: 'celestial-astrolabe-ring-slow 150s linear infinite',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: Math.max(560, launcherColumnWidth * 1.25),
            height: Math.max(560, contentRegion.height * 0.56),
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            border: '2px dashed rgba(212, 175, 55, 0.08)',
            pointerEvents: 'none',
            animation: 'celestial-astrolabe-ring-reverse 92s linear infinite',
          }}
        />

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            height: '100%',
            display: 'grid',
            gridTemplateRows: 'auto minmax(0, 1fr)',
            gap: Math.max(16, panelGap),
            padding: shellInset + 12,
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.12fr) auto',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 14px',
                borderRadius: 999,
                border: '1px solid rgba(212, 175, 55, 0.18)',
                background: 'rgba(5, 11, 20, 0.72)',
                color: '#D4AF37',
                boxShadow: '0 18px 34px rgba(0,0,0,0.3)',
                backdropFilter: 'blur(18px)',
                WebkitBackdropFilter: 'blur(18px)',
              }}
            >
              <Compass size={18} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <div style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', opacity: 0.72 }}>
                  Celestial Astrolabe
                </div>
                <div style={{ fontSize: 15, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#FAEDCD' }}>
                  {activePanel?.label ?? 'Launcher'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              {host.renderUtilityActionsSurface()}
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `${launcherColumnWidth}px minmax(0, 1fr) ${rightRailWidth}px`,
              gap: Math.max(16, panelGap),
              minHeight: 0,
            }}
          >
            <aside
              style={{
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                gap: 12,
                padding: 16,
                borderRadius: 34,
                border: '1px solid rgba(212, 175, 55, 0.14)',
                background: 'rgba(5, 11, 20, 0.68)',
                boxShadow: '0 24px 54px rgba(0, 0, 0, 0.42)',
                backdropFilter: 'blur(18px)',
                WebkitBackdropFilter: 'blur(18px)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                  <div style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(250,237,205,0.54)' }}>
                    Constellation Atlas
                  </div>
                  <div style={{ fontSize: 24, lineHeight: 1.04, color: '#FAEDCD' }}>
                    {activeGroup?.label ?? 'Launcher'}
                  </div>
                </div>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 16,
                    display: 'grid',
                    placeItems: 'center',
                    border: '1px solid rgba(212, 175, 55, 0.18)',
                    background: 'rgba(212, 175, 55, 0.08)',
                    color: '#FAEDCD',
                    animation: 'celestial-astrolabe-glint 6s ease-in-out infinite',
                  }}
                >
                  <Sparkles size={18} />
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {groups.map(group => {
                  const isActive = group.id === activeGroup?.id;
                  return (
                    <button
                      key={group.id}
                      onClick={() => host.activatePanel(group.panels[0]?.id)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '9px 12px',
                        borderRadius: 999,
                        border: isActive ? '1px solid rgba(212,175,55,0.32)' : '1px solid rgba(212,175,55,0.12)',
                        background: isActive ? 'rgba(212,175,55,0.16)' : 'rgba(11, 18, 32, 0.58)',
                        color: isActive ? '#FAEDCD' : '#D4AF37',
                        cursor: 'pointer',
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                      }}
                    >
                      <span>{group.label}</span>
                      <span style={{ opacity: 0.68 }}>{group.panels.length}</span>
                    </button>
                  );
                })}
              </div>

              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflow: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  paddingRight: 2,
                }}
              >
                {activeGroupPanels.map((panel, index) => {
                  const isActive = panel.id === activePanel?.id;
                  const orbit = resolveOrbitSlot(index, activeGroupPanels.length, 18);

                  return (
                    <button
                      key={panel.id}
                      onClick={panel.activate}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 12,
                        padding: '14px 14px 15px',
                        borderRadius: 24,
                        border: isActive ? '1px solid rgba(212,175,55,0.34)' : '1px solid rgba(212,175,55,0.1)',
                        background: isActive
                          ? 'linear-gradient(180deg, rgba(212,175,55,0.14), rgba(8, 14, 25, 0.96))'
                          : 'linear-gradient(180deg, rgba(9, 16, 29, 0.82), rgba(5, 11, 20, 0.88))',
                        boxShadow: isActive ? '0 18px 34px rgba(0,0,0,0.26)' : '0 10px 22px rgba(0,0,0,0.14)',
                        color: '#F7F2E2',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transform: `translateX(${orbit.x * 0.1}px)`,
                      }}
                    >
                      <span
                        style={{
                          width: isActive ? 40 : 34,
                          height: isActive ? 40 : 34,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 14,
                          flexShrink: 0,
                          background: isActive ? 'rgba(212,175,55,0.16)' : 'rgba(255,255,255,0.04)',
                          color: isActive ? '#FAEDCD' : '#D4AF37',
                          boxShadow: isActive ? '0 0 22px rgba(212,175,55,0.18)' : 'none',
                        }}
                      >
                        {panel.icon}
                      </span>
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em' }}>{panel.label}</span>
                        <span style={{ fontSize: 10, lineHeight: 1.45, color: 'rgba(250,237,205,0.66)' }}>
                          {panel.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 20,
                  border: '1px solid rgba(212, 175, 55, 0.12)',
                  background: 'rgba(10, 16, 29, 0.72)',
                  color: 'rgba(250,237,205,0.78)',
                  fontSize: 10,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                }}
              >
                {host.layoutProfile.label} · {panels.length} bodies in orbit
              </div>
            </aside>

            <main
              style={{
                position: 'relative',
                minWidth: 0,
                minHeight: 0,
                borderRadius: 40,
                border: '1px solid rgba(212, 175, 55, 0.2)',
                background: 'linear-gradient(180deg, rgba(6, 10, 18, 0.9), rgba(3, 6, 12, 0.94))',
                boxShadow: '0 30px 84px rgba(0,0,0,0.58)',
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
                  pointerEvents: 'none',
                  background: 'radial-gradient(circle at 50% 32%, rgba(212,175,55,0.12), transparent 24%), linear-gradient(135deg, rgba(255,255,255,0.04), transparent 38%)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: orbitDiameter,
                  height: orbitDiameter,
                  transform: 'translate(-50%, -50%)',
                  pointerEvents: 'none',
                  borderRadius: '50%',
                  border: '1px solid rgba(212, 175, 55, 0.16)',
                  boxShadow: '0 0 0 1px rgba(212, 175, 55, 0.06) inset',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: Math.min(orbitDiameter * 0.64, contentRegion.width * 0.62),
                  height: Math.min(orbitDiameter * 0.64, contentStageHeight * 0.72),
                  transform: 'translate(-50%, -50%)',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(212,175,55,0.12) 0%, rgba(212,175,55,0.05) 42%, transparent 72%)',
                  boxShadow: '0 0 120px rgba(212,175,55,0.08)',
                  pointerEvents: 'none',
                }}
              />

              <div
                style={{
                  position: 'absolute',
                  left: 22,
                  right: 22,
                  top: 18,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  zIndex: 2,
                }}
              >
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    borderRadius: 999,
                    border: '1px solid rgba(212, 175, 55, 0.18)',
                    background: 'rgba(5, 11, 20, 0.74)',
                    color: '#FAEDCD',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                  }}
                >
                  <span>Current Star</span>
                  <span style={{ color: '#D4AF37' }}>{activePanel?.label ?? 'Launcher'}</span>
                </div>

                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    borderRadius: 999,
                    border: '1px solid rgba(212, 175, 55, 0.18)',
                    background: 'rgba(5, 11, 20, 0.74)',
                    color: '#FAEDCD',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                  }}
                >
                  <span>Chrome Height</span>
                  <span style={{ color: '#D4AF37' }}>{chromeRegion.height}px</span>
                </div>
              </div>

              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: Math.min(contentRegion.width - 24, orbitDiameter + 148),
                  height: Math.min(contentStageHeight, orbitDiameter + 112),
                  transform: 'translate(-50%, -50%)',
                  borderRadius: 36,
                  border: '1px solid rgba(212,175,55,0.24)',
                  background: 'linear-gradient(180deg, rgba(8, 14, 25, 0.96), rgba(4, 8, 15, 0.98))',
                  boxShadow: '0 24px 60px rgba(0,0,0,0.52)',
                  overflow: 'hidden',
                }}
              >
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    background: 'radial-gradient(circle at 50% 30%, rgba(212,175,55,0.1), transparent 28%), linear-gradient(135deg, rgba(255,255,255,0.03), transparent 36%)',
                  }}
                />
                <div
                  style={{
                    position: 'relative',
                    zIndex: 1,
                    width: '100%',
                    height: '100%',
                    padding: contentPadding,
                  }}
                >
                  {activePanel ? host.renderPanelSurface(activePanel.id, { forceMount: true, forceVisible: true }) : null}
                </div>
              </div>

              {panels.map((panel, index) => {
                const isActive = panel.id === activePanel?.id;
                const orbit = resolveOrbitSlot(index, panels.length, orbitRadius);

                return (
                  <button
                    key={panel.id}
                    onClick={() => host.activatePanel(panel.id)}
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: '50%',
                      transform: `translate(-50%, -50%) translate(${orbit.x}px, ${orbit.y}px) scale(${isActive ? orbit.scale * 1.08 : orbit.scale})`,
                      zIndex: isActive ? 8 : orbit.depth,
                      width: isActive ? 78 : 60,
                      height: isActive ? 78 : 60,
                      borderRadius: '50%',
                      border: isActive ? '1px solid rgba(212,175,55,0.42)' : '1px solid rgba(212,175,55,0.18)',
                      background: isActive
                        ? 'radial-gradient(circle at 30% 30%, rgba(250,237,205,0.34), rgba(212,175,55,0.18) 52%, rgba(5,11,20,0.95) 100%)'
                        : 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.08), rgba(8,14,25,0.88) 70%)',
                      color: isActive ? '#FAEDCD' : '#D4AF37',
                      boxShadow: isActive
                        ? '0 0 28px rgba(212,175,55,0.34), inset 0 0 18px rgba(212,175,55,0.16)'
                        : '0 10px 20px rgba(0,0,0,0.4)',
                      cursor: 'pointer',
                      transition: 'transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease',
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    {panel.icon}
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
                  padding: 16,
                  borderRadius: 30,
                  border: '1px solid rgba(212,175,55,0.14)',
                  background: 'rgba(5, 11, 20, 0.68)',
                  boxShadow: '0 18px 42px rgba(0,0,0,0.24)',
                  color: '#FAEDCD',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(250,237,205,0.54)' }}>
                  <Orbit size={14} />
                  <span>Observation Rail</span>
                </div>
                <div style={{ marginTop: 10, fontSize: 24, lineHeight: 1.05 }}>
                  {activePanel?.label ?? 'Launcher'}
                </div>
                <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.6, color: 'rgba(250,237,205,0.72)' }}>
                  {activePanel?.description ?? 'Choose a surface and let the orbit snap it into focus.'}
                </div>
              </div>

              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  padding: 12,
                  borderRadius: 30,
                  border: '1px solid rgba(212,175,55,0.12)',
                  background: 'rgba(7, 13, 23, 0.62)',
                  boxShadow: '0 16px 38px rgba(0,0,0,0.22)',
                  overflow: 'auto',
                  backdropFilter: 'blur(18px)',
                  WebkitBackdropFilter: 'blur(18px)',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {host.renderPinnedPanels('right')}
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 20,
                    border: '1px solid rgba(212,175,55,0.12)',
                    background: 'rgba(10, 16, 29, 0.72)',
                    color: 'rgba(250,237,205,0.82)',
                    fontSize: 10,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                  }}
                >
                  <div style={{ opacity: 0.58 }}>Layout</div>
                  <div style={{ marginTop: 6, color: '#FAEDCD' }}>{host.layoutProfile.label}</div>
                </div>
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 20,
                    border: '1px solid rgba(212,175,55,0.12)',
                    background: 'rgba(10, 16, 29, 0.72)',
                    color: 'rgba(250,237,205,0.82)',
                    fontSize: 10,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                  }}
                >
                  <div style={{ opacity: 0.58 }}>Theme</div>
                  <div style={{ marginTop: 6, color: '#FAEDCD' }}>{panels.length} bodies</div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    );
  },
});
