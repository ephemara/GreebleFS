import { Compass, Orbit, Sparkles } from 'lucide-react';
import { defineThemeRenderer } from 'overlayterm-theme-renderer';

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function safeClampNumber(value: number, min: number, max: number): number {
  return max < min ? max : clampNumber(value, min, max);
}

function resolvePanelSet(host) {
  const panels = host.shellModel.launcher.panels;
  const groups = host.shellModel.launcher.groups;
  const activePanel = panels.find(panel => panel.id === host.activePanelId) ?? panels[0] ?? null;
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
  const angle = ratio * Math.PI * 2 - Math.PI / 2;
  const wobble = Math.sin(index * 0.82) * 0.12;

  return {
    x: Math.cos(angle) * radius * (0.88 + wobble),
    y: Math.sin(angle) * radius * (0.78 - wobble),
    scale: 0.86 + ((Math.cos(angle * 2) + 1) / 2) * 0.14,
    depth: 100 + (safeTotal - index),
  };
}

function renderStatPill(label: string, value: string) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '9px 12px',
        borderRadius: 999,
        border: '1px solid rgba(212,175,55,0.16)',
        background: 'rgba(5, 11, 20, 0.72)',
        color: '#FAEDCD',
        fontSize: 10,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
      }}
    >
      <span style={{ opacity: 0.64 }}>{label}</span>
      <span style={{ color: '#D4AF37' }}>{value}</span>
    </div>
  );
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
    const chromeRegion = layout.regions.chrome;
    const pinnedRightRegion = layout.regions.pinnedRight;
    const { panels, activePanel, groups, activeGroup, activeGroupPanels } = resolvePanelSet(host);

    const shellInset = Math.max(16, layout.shellInset);
    const panelGap = Math.max(12, layout.panelGap);
    const contentPadding = Math.max(16, layout.contentInnerPadding);

    const stageWidth = safeClampNumber(contentRegion.width - contentPadding * 2, 1080, 1840);
    const stageHeight = safeClampNumber(contentRegion.height - contentPadding * 2, 720, 1040);
    const shortestAxis = Math.min(stageWidth, stageHeight);
    const contentFrameWidth = safeClampNumber(stageWidth * 0.84, 820, Math.max(stageWidth - 88, 0));
    const contentFrameHeight = safeClampNumber(stageHeight * 0.72, 540, Math.max(stageHeight - 120, 0));
    const launcherOrbitRadius = safeClampNumber(shortestAxis * 0.44, 220, Math.max(140, shortestAxis / 2 - 72));
    const panelOrbitRadius = safeClampNumber(shortestAxis * 0.3, 168, Math.max(120, shortestAxis / 2 - 168));
    const contentRingRadius = safeClampNumber(shortestAxis * 0.22, 120, Math.max(100, shortestAxis / 2 - 220));

    const stageCenterX = stageWidth / 2;
    const stageCenterY = stageHeight / 2;

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
          color: '#FAEDCD',
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
            0%, 100% { opacity: 0.34; transform: scale(0.94); }
            50% { opacity: 0.74; transform: scale(1.05); }
          }
        `}</style>
        {host.wallpaper.renderBackdropStack()}

        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background:
              'radial-gradient(circle at 50% 47%, rgba(212,175,55,0.14), transparent 18%), radial-gradient(circle at 25% 18%, rgba(94,119,255,0.08), transparent 24%), radial-gradient(circle at 78% 26%, rgba(255,138,91,0.08), transparent 22%), linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0) 36%)',
          }}
        />

        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: '50%',
            top: '52%',
            width: Math.max(1200, stageWidth + launcherRegion.width + pinnedRightRegion.width),
            height: Math.max(980, stageHeight + chromeRegion.height + 180),
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            border: '1px solid rgba(212, 175, 55, 0.05)',
            boxShadow: '0 0 0 1px rgba(212, 175, 55, 0.02) inset',
            pointerEvents: 'none',
          }}
        />

        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: Math.max(contentFrameWidth + 220, stageWidth * 0.94),
            height: Math.max(contentFrameHeight + 220, stageHeight * 0.94),
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            border: '1px solid rgba(212, 175, 55, 0.08)',
            pointerEvents: 'none',
            animation: 'celestial-astrolabe-ring-slow 150s linear infinite',
          }}
        />

        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: Math.max(contentFrameWidth * 0.72, contentRingRadius * 2),
            height: Math.max(contentFrameHeight * 0.72, contentRingRadius * 2),
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
            display: 'flex',
            flex: 1,
            minHeight: 0,
            flexDirection: 'column',
            gap: panelGap,
            padding: shellInset + 10,
          }}
        >
          <header
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) auto',
              alignItems: 'center',
              gap: 16,
              minHeight: 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                minWidth: 0,
                padding: '10px 14px',
                borderRadius: 999,
                border: '1px solid rgba(212,175,55,0.18)',
                background: 'rgba(5, 11, 20, 0.74)',
                boxShadow: '0 18px 34px rgba(0,0,0,0.32)',
                backdropFilter: 'blur(18px)',
                WebkitBackdropFilter: 'blur(18px)',
              }}
            >
              <Compass size={18} color="#D4AF37" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', opacity: 0.72 }}>
                  Celestial Astrolabe
                </div>
                <div style={{ fontSize: 15, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#FAEDCD' }}>
                  {activePanel?.label ?? 'Observatory'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
              {renderStatPill('Layout', host.layoutProfile.label)}
              {renderStatPill('Chrome', `${chromeRegion.height}px`)}
              {renderStatPill('Orbit', `${groups.length} groups`)}
              {host.renderUtilityActionsSurface()}
            </div>
          </header>

          <div
            style={{
              position: 'relative',
              flex: 1,
              minHeight: 0,
              display: 'grid',
              placeItems: 'center',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'relative',
                width: Math.max(0, Math.min(stageWidth, contentFrameWidth + 160)),
                height: Math.max(0, Math.min(stageHeight, contentFrameHeight + 160)),
              }}
            >
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: Math.max(contentFrameWidth + 160, 0),
                  height: Math.max(contentFrameHeight + 160, 0),
                  transform: 'translate(-50%, -50%)',
                  borderRadius: '50%',
                  border: '1px solid rgba(212,175,55,0.18)',
                  boxShadow: '0 0 0 1px rgba(212,175,55,0.04) inset',
                  pointerEvents: 'none',
                }}
              />

              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: Math.max(contentFrameWidth * 0.64, 460),
                  height: Math.max(contentFrameHeight * 0.58, 320),
                  transform: 'translate(-50%, -50%)',
                  borderRadius: '50%',
                  background:
                    'radial-gradient(circle, rgba(212,175,55,0.14) 0%, rgba(212,175,55,0.06) 40%, transparent 72%)',
                  boxShadow: '0 0 120px rgba(212,175,55,0.08)',
                  pointerEvents: 'none',
                }}
              />

              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: contentFrameWidth,
                  height: contentFrameHeight,
                  transform: 'translate(-50%, -50%)',
                  borderRadius: 48,
                  border: '1px solid rgba(212,175,55,0.24)',
                  background: 'linear-gradient(180deg, rgba(8, 14, 25, 0.96), rgba(4, 8, 15, 0.98))',
                  boxShadow: '0 34px 88px rgba(0,0,0,0.6)',
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
                    background:
                      'radial-gradient(circle at 50% 30%, rgba(212,175,55,0.1), transparent 28%), linear-gradient(135deg, rgba(255,255,255,0.04), transparent 36%)',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: 22,
                    right: 22,
                    top: 18,
                    zIndex: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    pointerEvents: 'none',
                  }}
                >
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 14px',
                      borderRadius: 999,
                      border: '1px solid rgba(212,175,55,0.18)',
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
                    <span style={{ color: '#D4AF37' }}>{activePanel?.label ?? 'Observatory'}</span>
                  </div>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 14px',
                      borderRadius: 999,
                      border: '1px solid rgba(212,175,55,0.18)',
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
                    <span>Launcher Count</span>
                    <span style={{ color: '#D4AF37' }}>{panels.length}</span>
                  </div>
                </div>

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

              {groups.map((group, index) => {
                const orbit = resolveOrbitSlot(index, groups.length, launcherOrbitRadius);
                const isActive = group.id === activeGroup?.id;
                const nodeSize = isActive ? 90 : 74;
                const nodeX = safeClampNumber(stageCenterX + orbit.x, nodeSize / 2 + 12, stageWidth - nodeSize / 2 - 12);
                const nodeY = safeClampNumber(stageCenterY + orbit.y, nodeSize / 2 + 12, stageHeight - nodeSize / 2 - 12);
                const targetPanelId = group.panels[0]?.id;

                return (
                  <button
                    key={group.id}
                    onClick={() => {
                      if (targetPanelId) {
                        host.activatePanel(targetPanelId);
                      }
                    }}
                    style={{
                      position: 'absolute',
                      left: nodeX,
                      top: nodeY,
                      width: nodeSize,
                      height: nodeSize,
                      transform: `translate(-50%, -50%) scale(${isActive ? orbit.scale * 1.08 : orbit.scale})`,
                      zIndex: isActive ? 12 : orbit.depth,
                      borderRadius: '50%',
                      border: isActive ? '1px solid rgba(212,175,55,0.4)' : '1px solid rgba(212,175,55,0.18)',
                      background: isActive
                        ? 'radial-gradient(circle at 30% 30%, rgba(250,237,205,0.34), rgba(212,175,55,0.18) 52%, rgba(5,11,20,0.95) 100%)'
                        : 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.08), rgba(8,14,25,0.88) 70%)',
                      color: isActive ? '#FAEDCD' : '#D4AF37',
                      boxShadow: isActive
                        ? '0 0 28px rgba(212,175,55,0.34), inset 0 0 18px rgba(212,175,55,0.16)'
                        : '0 10px 20px rgba(0,0,0,0.42)',
                      cursor: 'pointer',
                      transition: 'transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease',
                      display: 'grid',
                      placeItems: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    <div style={{ display: 'grid', placeItems: 'center', gap: 4, textAlign: 'center' }}>
                      <div style={{ lineHeight: 0 }}>{group.icon ?? <Sparkles size={18} />}</div>
                      <div style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', maxWidth: 54 }}>
                        {group.label}
                      </div>
                    </div>
                  </button>
                );
              })}

              {activeGroupPanels.map((panel, index) => {
                const orbit = resolveOrbitSlot(index, activeGroupPanels.length, panelOrbitRadius);
                const isActive = panel.id === activePanel?.id;
                const nodeSize = isActive ? 78 : 64;
                const nodeX = safeClampNumber(stageCenterX + orbit.x, nodeSize / 2 + 16, stageWidth - nodeSize / 2 - 16);
                const nodeY = safeClampNumber(stageCenterY + orbit.y, nodeSize / 2 + 16, stageHeight - nodeSize / 2 - 16);

                return (
                  <button
                    key={panel.id}
                    onClick={panel.activate}
                    style={{
                      position: 'absolute',
                      left: nodeX,
                      top: nodeY,
                      width: nodeSize,
                      height: nodeSize,
                      transform: `translate(-50%, -50%) scale(${isActive ? orbit.scale * 1.08 : orbit.scale})`,
                      zIndex: isActive ? 10 : orbit.depth,
                      borderRadius: '50%',
                      border: isActive ? '1px solid rgba(212,175,55,0.34)' : '1px solid rgba(212,175,55,0.16)',
                      background: isActive
                        ? 'radial-gradient(circle at 30% 30%, rgba(250,237,205,0.26), rgba(212,175,55,0.18) 52%, rgba(5,11,20,0.96) 100%)'
                        : 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.08), rgba(8,14,25,0.88) 70%)',
                      color: isActive ? '#FAEDCD' : '#D4AF37',
                      boxShadow: isActive
                        ? '0 0 24px rgba(212,175,55,0.3), inset 0 0 16px rgba(212,175,55,0.14)'
                        : '0 10px 18px rgba(0,0,0,0.38)',
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
            </div>
          </div>

          <footer
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              minHeight: 0,
              padding: '14px 16px 16px',
              borderRadius: 34,
              border: '1px solid rgba(212,175,55,0.14)',
              background: 'rgba(5, 11, 20, 0.7)',
              boxShadow: '0 24px 54px rgba(0,0,0,0.28)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <Orbit size={14} color="#D4AF37" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(250,237,205,0.56)' }}>
                    Observatory Deck
                  </div>
                  <div style={{ fontSize: 16, lineHeight: 1.05, color: '#FAEDCD' }}>
                    {activeGroup?.label ?? 'All Surfaces'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {renderStatPill('Shell', host.layoutProfile.label)}
                {renderStatPill('Inset', `${shellInset}px`)}
                {renderStatPill('Panels', `${activeGroupPanels.length}/${panels.length}`)}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 10,
                alignItems: 'stretch',
              }}
            >
              {activeGroupPanels.map(panel => {
                const isActive = panel.id === activePanel?.id;
                return (
                  <button
                    key={panel.id}
                    onClick={panel.activate}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 10,
                      minHeight: 48,
                      padding: '10px 14px',
                      borderRadius: 18,
                      border: isActive ? '1px solid rgba(212,175,55,0.32)' : '1px solid rgba(212,175,55,0.12)',
                      background: isActive
                        ? 'linear-gradient(180deg, rgba(212,175,55,0.16), rgba(8, 14, 25, 0.96))'
                        : 'linear-gradient(180deg, rgba(9, 16, 29, 0.82), rgba(5, 11, 20, 0.9))',
                      color: '#F7F2E2',
                      textAlign: 'left',
                      cursor: 'pointer',
                      boxShadow: isActive ? '0 16px 30px rgba(0,0,0,0.24)' : '0 10px 18px rgba(0,0,0,0.14)',
                    }}
                  >
                    <span
                      style={{
                        width: isActive ? 38 : 34,
                        height: isActive ? 38 : 34,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 12,
                        flexShrink: 0,
                        background: isActive ? 'rgba(212,175,55,0.16)' : 'rgba(255,255,255,0.04)',
                        color: isActive ? '#FAEDCD' : '#D4AF37',
                      }}
                    >
                      {panel.icon}
                    </span>
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em' }}>{panel.label}</span>
                      <span style={{ fontSize: 10, lineHeight: 1.45, color: 'rgba(250,237,205,0.66)' }}>
                        {panel.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            {pinnedRightRegion.visible ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 12,
                  minHeight: 0,
                }}
              >
                {host.renderPinnedPanels('right')}
              </div>
            ) : null}
          </footer>
        </div>
      </div>
    );
  },
});
