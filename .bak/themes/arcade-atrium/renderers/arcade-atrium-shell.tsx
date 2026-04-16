import { Waves, Sparkles } from 'lucide-react';
import { defineThemeRenderer } from 'overlayterm-theme-renderer';

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function resolveLaunchContext(host) {
  const panels = host.shellModel.launcher.panels;
  const groups = host.shellModel.launcher.groups;
  const activePanel = panels.find(panel => panel.id === host.activePanelId) ?? panels[0] ?? null;
  const activeGroup = groups.find(group => group.panels.some(panel => panel.id === activePanel?.id)) ?? groups[0] ?? null;
  return {
    panels,
    groups,
    activePanel,
    activeGroup,
    activeGroupPanels: activeGroup?.panels ?? panels,
  };
}

export default defineThemeRenderer({
  name: 'Arcade Atrium Shell',
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
    const layout = host.shellModel.layout;
    const launcherRegion = layout.regions.launcher;
    const contentRegion = layout.regions.content;
    const pinnedRightRegion = layout.regions.pinnedRight;
    const chromeRegion = layout.regions.chrome;
    const { panels, groups, activePanel, activeGroup, activeGroupPanels } = resolveLaunchContext(host);

    const shellInset = layout.shellInset;
    const panelGap = layout.panelGap;
    const leftRailWidth = clampNumber(launcherRegion.visible ? launcherRegion.width : 312, 260, 388);
    const rightRailWidth = clampNumber(pinnedRightRegion.visible ? pinnedRightRegion.width : 286, 240, 344);
    const stageMinHeight = Math.max(360, contentRegion.height - Math.max(0, layout.contentInnerPadding * 2));

    return (
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          fontFamily: '"Space Grotesk", "Inter", "Segoe UI", sans-serif',
          background: 'linear-gradient(180deg, #09121D 0%, #050A12 100%)',
        }}
      >
        {host.wallpaper.renderBackdropStack()}

        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: 'radial-gradient(circle at 16% 14%, rgba(35,183,255,0.16), transparent 24%), radial-gradient(circle at 84% 18%, rgba(255,147,79,0.12), transparent 20%), radial-gradient(circle at 52% 34%, rgba(255,255,255,0.05), transparent 32%), linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0) 24%)',
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
            gap: Math.max(14, panelGap),
            padding: shellInset + 10,
          }}
        >
          <header
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) auto',
              alignItems: 'center',
              gap: 14,
              padding: '10px 14px',
              borderRadius: 24,
              border: '1px solid rgba(35, 183, 255, 0.14)',
              background: 'rgba(255,255,255,0.1)',
              boxShadow: '0 18px 32px rgba(11, 22, 34, 0.22)',
              backdropFilter: 'blur(22px)',
              WebkitBackdropFilter: 'blur(22px)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 16,
                  display: 'grid',
                  placeItems: 'center',
                  background: 'linear-gradient(180deg, rgba(35,183,255,0.18), rgba(255,255,255,0.1))',
                  color: '#1d4d66',
                  boxShadow: '0 10px 24px rgba(35,183,255,0.14)',
                }}
              >
                <Waves size={18} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                <div style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(18,49,72,0.56)' }}>
                  Arcade Atrium
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#123148' }}>
                  {activePanel?.label ?? 'Launcher'}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(18,49,72,0.66)' }}>
                  {activePanel?.description ?? 'Launch surfaces, focus rails, and a centered stage without chrome duplication.'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              {host.renderUtilityActionsSurface()}
            </div>
          </header>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `${leftRailWidth}px minmax(0, 1fr) ${rightRailWidth}px`,
              gap: Math.max(14, panelGap),
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
                  padding: 16,
                  borderRadius: 30,
                  border: '1px solid rgba(35,183,255,0.14)',
                  background: 'rgba(255,255,255,0.35)',
                  boxShadow: '0 18px 42px rgba(17,55,76,0.12)',
                  color: '#123148',
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                    <div style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(29,77,102,0.56)' }}>
                      Launch Deck
                    </div>
                    <div style={{ fontSize: 26, lineHeight: 1.02, fontWeight: 700 }}>
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
                      background: 'rgba(35,183,255,0.12)',
                      color: '#109be0',
                    }}
                  >
                    <Sparkles size={18} />
                  </div>
                </div>

                <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.6, color: 'rgba(18,49,72,0.68)' }}>
                  {host.layoutProfile.label} tuned into an atrium layout with a dedicated launch rail and a single center stage.
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
                        border: isActive ? '1px solid rgba(35,183,255,0.28)' : '1px solid rgba(36,96,126,0.08)',
                        background: isActive ? 'rgba(35,183,255,0.14)' : 'rgba(255,255,255,0.48)',
                        color: isActive ? '#109be0' : '#1d4d66',
                        cursor: 'pointer',
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                      }}
                    >
                      <span>{group.label}</span>
                      <span style={{ opacity: 0.72 }}>{group.panels.length}</span>
                    </button>
                  );
                })}
              </div>

              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  padding: 12,
                  borderRadius: 30,
                  border: '1px solid rgba(35,183,255,0.12)',
                  background: 'rgba(255,255,255,0.22)',
                  overflow: 'auto',
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
                }}
              >
                {activeGroupPanels.map(panel => {
                  const isActive = panel.id === activePanel?.id;
                  return (
                    <button
                      key={panel.id}
                      onClick={panel.activate}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 12,
                        padding: '13px 13px 14px',
                        borderRadius: 22,
                        border: isActive ? '1px solid rgba(35,183,255,0.26)' : '1px solid rgba(36,96,126,0.08)',
                        background: isActive
                          ? 'linear-gradient(180deg, rgba(255,255,255,0.94), rgba(223,247,255,0.88))'
                          : 'rgba(255,255,255,0.58)',
                        boxShadow: isActive ? '0 12px 28px rgba(35,183,255,0.12)' : 'none',
                        color: '#123148',
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <span
                        style={{
                          width: 38,
                          height: 38,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 14,
                          flexShrink: 0,
                          background: isActive ? 'rgba(35,183,255,0.16)' : 'rgba(255,255,255,0.78)',
                          color: isActive ? '#109be0' : '#26445a',
                        }}
                      >
                        {panel.icon}
                      </span>

                      <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 700 }}>{panel.label}</span>
                          {panel.isOpen ? (
                            <span
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                background: panel.isActive ? '#23b7ff' : '#ff934f',
                              }}
                            />
                          ) : null}
                        </span>
                        <span style={{ fontSize: 11, lineHeight: 1.45, color: 'rgba(18,49,72,0.66)' }}>
                          {panel.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>

            <section
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                minHeight: 0,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  padding: '0 2px',
                  color: '#dff4ff',
                }}
              >
                <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(223,244,255,0.52)' }}>
                  Atrium Stage
                </div>
                <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(223,244,255,0.52)' }}>
                  {groups.length} groups · {panels.length} panels
                </div>
              </div>

              <div
                style={{
                  position: 'relative',
                  flex: 1,
                  minHeight: stageMinHeight,
                  borderRadius: 40,
                  border: '1px solid rgba(35,183,255,0.14)',
                  background: 'linear-gradient(180deg, rgba(14,22,38,0.84), rgba(8,14,28,0.72))',
                  boxShadow: '0 28px 64px rgba(0,0,0,0.34)',
                  overflow: 'hidden',
                }}
              >
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    background: 'radial-gradient(circle at 50% 30%, rgba(35,183,255,0.12), transparent 28%), linear-gradient(135deg, rgba(255,255,255,0.05), transparent 42%)',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: 18,
                    top: 16,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '9px 12px',
                    borderRadius: 999,
                    border: '1px solid rgba(35,183,255,0.14)',
                    background: 'rgba(10, 19, 31, 0.72)',
                    color: '#e8fdff',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    zIndex: 2,
                  }}
                >
                  <span>Center Stage</span>
                  <span style={{ color: '#23b7ff' }}>{activePanel?.label ?? 'Launcher'}</span>
                </div>

                <div
                  style={{
                    position: 'absolute',
                    right: 18,
                    top: 16,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '9px 12px',
                    borderRadius: 999,
                    border: '1px solid rgba(35,183,255,0.14)',
                    background: 'rgba(10, 19, 31, 0.72)',
                    color: '#e8fdff',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    zIndex: 2,
                  }}
                >
                  <span>Stage Width</span>
                  <span style={{ color: '#ff934f' }}>{Math.round(contentRegion.width)}px</span>
                </div>

                <div
                  style={{
                    position: 'relative',
                    zIndex: 1,
                    width: '100%',
                    height: '100%',
                    padding: Math.max(12, layout.contentInnerPadding),
                  }}
                >
                  {host.renderDefaultContentSurface()}
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  gap: 10,
                }}
              >
                {activeGroupPanels.slice(0, 3).map(panel => {
                  const isActive = panel.id === activePanel?.id;
                  return (
                    <button
                      key={panel.id}
                      onClick={() => host.activatePanel(panel.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '11px 12px',
                        borderRadius: 18,
                        border: isActive ? '1px solid rgba(35,183,255,0.24)' : '1px solid rgba(36,96,126,0.08)',
                        background: isActive ? 'rgba(35,183,255,0.14)' : 'rgba(255,255,255,0.52)',
                        color: '#123148',
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ flexShrink: 0 }}>{panel.icon}</span>
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                        <span style={{ fontSize: 11, fontWeight: 700 }}>{panel.label}</span>
                        <span style={{ fontSize: 10, color: 'rgba(18,49,72,0.62)' }}>{panel.description}</span>
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
              <div
                style={{
                  padding: 16,
                  borderRadius: 30,
                  border: '1px solid rgba(35,183,255,0.14)',
                  background: 'rgba(255,255,255,0.28)',
                  boxShadow: '0 18px 42px rgba(17,55,76,0.12)',
                  color: '#123148',
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
                }}
              >
                <div style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(29,77,102,0.56)' }}>
                  Service Rack
                </div>
                <div style={{ marginTop: 10, fontSize: 26, lineHeight: 1.02, fontWeight: 700 }}>
                  {activePanel?.label ?? 'Launcher'}
                </div>
                <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.6, color: 'rgba(18,49,72,0.68)' }}>
                  Utility actions sit apart from the launch deck so the shell stays legible when the viewport tightens.
                </div>
              </div>

              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  padding: 12,
                  borderRadius: 30,
                  border: '1px solid rgba(35,183,255,0.12)',
                  background: 'rgba(255,255,255,0.22)',
                  overflow: 'auto',
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
                    border: '1px solid rgba(35,183,255,0.12)',
                    background: 'rgba(255,255,255,0.28)',
                    color: '#123148',
                    fontSize: 10,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                  }}
                >
                  <div style={{ opacity: 0.58 }}>Chrome</div>
                  <div style={{ marginTop: 6, color: '#1d4d66' }}>{chromeRegion.height}px</div>
                </div>
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 20,
                    border: '1px solid rgba(35,183,255,0.12)',
                    background: 'rgba(255,255,255,0.28)',
                    color: '#123148',
                    fontSize: 10,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                  }}
                >
                  <div style={{ opacity: 0.58 }}>Mode</div>
                  <div style={{ marginTop: 6, color: '#1d4d66' }}>{host.renderRuntime.kind}</div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    );
  },
});
