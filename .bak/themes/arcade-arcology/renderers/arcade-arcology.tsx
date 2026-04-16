import { Building2, Layers3, Sparkles } from 'lucide-react';
import { defineThemeRenderer } from 'overlayterm-theme-renderer';

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function resolveCssLength(host, name: string, fallback: string): string {
  const value = host.appearance.cssVars?.[name];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function resolveCssNumber(host, name: string, fallback: number): number {
  const value = host.appearance.cssVars?.[name];
  const parsed = typeof value === 'string' ? Number.parseFloat(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolveArcologyContext(host) {
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
    const { panels, groups, activePanel, activeGroup, activeGroupPanels } = resolveArcologyContext(host);

    const shellInset = layout.shellInset;
    const panelGap = layout.panelGap;
    const railWidth = clampNumber(
      resolveCssNumber(host, '--overlay-workbench-arcology-rail-width', launcherRegion.visible ? launcherRegion.width : 300),
      250,
      360,
    );
    const rightRailWidth = clampNumber(
      pinnedRightRegion.visible ? pinnedRightRegion.width : Math.max(250, railWidth - 26),
      230,
      340,
    );
    const stageWidth = resolveCssLength(
      host,
      '--overlay-workbench-arcology-stage-width',
      `min(${Math.max(540, Math.floor(contentRegion.width * 0.84))}px, 1120px)`,
    );
    const stageHeight = resolveCssLength(
      host,
      '--overlay-workbench-arcology-stage-height',
      `min(${Math.max(400, Math.floor(contentRegion.height * 0.72))}px, 760px)`,
    );
    const skylineGap = clampNumber(
      resolveCssNumber(host, '--overlay-workbench-arcology-skyline-gap', Math.max(10, panelGap)),
      8,
      18,
    );

    return (
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          background: 'linear-gradient(180deg, #070A10 0%, #04060A 100%)',
          fontFamily: '"Space Grotesk", "Avenir Next", "Segoe UI", sans-serif',
        }}
      >
        {host.wallpaper.renderBackdropStack()}

        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: 'radial-gradient(circle at 18% 18%, rgba(255,155,90,0.14), transparent 22%), radial-gradient(circle at 82% 16%, rgba(107,231,255,0.12), transparent 18%), radial-gradient(circle at 50% 40%, rgba(255,255,255,0.04), transparent 26%), linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0) 26%)',
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
            padding: shellInset + 12,
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
              border: '1px solid rgba(146,164,191,0.18)',
              background: 'rgba(10, 12, 19, 0.74)',
              boxShadow: '0 18px 42px rgba(0,0,0,0.24)',
              color: '#f5f8ff',
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
                  border: '1px solid rgba(255, 155, 90, 0.16)',
                  background: 'linear-gradient(180deg, rgba(255,155,90,0.16), rgba(255,255,255,0.06))',
                  color: '#ffb27e',
                  boxShadow: '0 12px 26px rgba(255,155,90,0.08)',
                }}
              >
                <Building2 size={18} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                <div style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(194,208,226,0.56)' }}>
                  Arcade Arcology
                </div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>
                  {activePanel?.label ?? 'Launcher'}
                </div>
                <div style={{ fontSize: 12, lineHeight: 1.5, color: 'rgba(194,208,226,0.7)' }}>
                  {activePanel?.description ?? 'A tower shell built from the launcher groups, the active content stage, and a separate observatory rail.'}
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
              gridTemplateColumns: `${railWidth}px minmax(0, 1fr) ${rightRailWidth}px`,
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
                  border: '1px solid rgba(146,164,191,0.18)',
                  background: 'rgba(10, 12, 19, 0.74)',
                  boxShadow: '0 18px 42px rgba(0,0,0,0.24)',
                  color: '#f5f8ff',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                    <div style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(194,208,226,0.56)' }}>
                      District Rail
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
                      border: '1px solid rgba(107,231,255,0.16)',
                      background: 'rgba(107,231,255,0.08)',
                      color: '#6be7ff',
                    }}
                  >
                    <Layers3 size={18} />
                  </div>
                </div>

                <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.6, color: 'rgba(194,208,226,0.72)' }}>
                  The launcher is rendered as districts, not an afterthought rail. That keeps the theme readable as the viewport collapses.
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
                        border: isActive ? '1px solid rgba(255,155,90,0.3)' : '1px solid rgba(146,164,191,0.08)',
                        background: isActive ? 'rgba(255,155,90,0.14)' : 'rgba(8, 11, 18, 0.64)',
                        color: isActive ? '#ffb27e' : '#c2d0e2',
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
                  border: '1px solid rgba(146,164,191,0.12)',
                  background: 'rgba(8, 11, 18, 0.68)',
                  boxShadow: '0 16px 38px rgba(0,0,0,0.22)',
                  overflow: 'auto',
                  backdropFilter: 'blur(18px)',
                  WebkitBackdropFilter: 'blur(18px)',
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
                        padding: '13px 14px',
                        borderRadius: 22,
                        border: isActive ? '1px solid rgba(255,155,90,0.28)' : '1px solid rgba(146,164,191,0.08)',
                        background: isActive
                          ? 'linear-gradient(180deg, rgba(255,155,90,0.14), rgba(11,13,20,0.96))'
                          : 'linear-gradient(180deg, rgba(28,34,50,0.88), rgba(11,13,20,0.9))',
                        boxShadow: isActive ? '0 18px 34px rgba(0,0,0,0.22)' : '0 12px 24px rgba(0,0,0,0.12)',
                        color: '#f5f8ff',
                        cursor: 'pointer',
                        textAlign: 'left',
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
                          flexShrink: 0,
                        }}
                      >
                        {panel.icon}
                      </span>
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                        <span style={{ fontSize: 12, fontWeight: 700 }}>{panel.label}</span>
                        <span style={{ fontSize: 10, lineHeight: 1.45, color: 'rgba(194,208,226,0.68)' }}>
                          {panel.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>

            <main
              style={{
                position: 'relative',
                minWidth: 0,
                minHeight: 0,
                borderRadius: 42,
                border: '1px solid rgba(146,164,191,0.18)',
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
                  pointerEvents: 'none',
                  background: 'radial-gradient(circle at 50% 30%, rgba(255,155,90,0.12), transparent 28%), linear-gradient(135deg, rgba(255,255,255,0.04), transparent 44%)',
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
                  border: '1px solid rgba(146,164,191,0.18)',
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
                  border: '1px solid rgba(146,164,191,0.18)',
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
                <div style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%', padding: Math.max(12, layout.contentInnerPadding) }}>
                  {host.renderDefaultContentSurface()}
                </div>
              </div>

              <div
                style={{
                  position: 'absolute',
                  left: 18,
                  right: 18,
                  bottom: 18,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  gap: skylineGap,
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
                        alignItems: 'flex-start',
                        gap: 10,
                        padding: '12px 14px',
                        borderRadius: 24,
                        border: isActive ? '1px solid rgba(255,155,90,0.28)' : '1px solid rgba(146,164,191,0.08)',
                        background: isActive
                          ? 'linear-gradient(180deg, rgba(255,155,90,0.14), rgba(11,13,20,0.96))'
                          : 'linear-gradient(180deg, rgba(28,34,50,0.88), rgba(11,13,20,0.9))',
                        boxShadow: isActive ? '0 18px 34px rgba(0,0,0,0.22)' : '0 12px 24px rgba(0,0,0,0.12)',
                        color: '#f5f8ff',
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <span
                        style={{
                          width: 36,
                          height: 36,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 14,
                          background: isActive ? 'rgba(255,155,90,0.14)' : 'rgba(255,255,255,0.05)',
                          color: isActive ? '#ffb27e' : '#dce7f4',
                          flexShrink: 0,
                        }}
                      >
                        {panel.icon}
                      </span>
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                        <span style={{ fontSize: 11, fontWeight: 700 }}>{panel.label}</span>
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
                <div style={{ marginTop: 10, fontSize: 26, lineHeight: 1.04, fontWeight: 700 }}>
                  {activePanel?.label ?? 'Launcher'}
                </div>
                <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.6, color: 'rgba(194,208,226,0.72)' }}>
                  The right rail carries secondary surfaces and pinned panels so the tower stays readable when the layout compresses.
                </div>
              </div>

              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  padding: 12,
                  borderRadius: 30,
                  border: '1px solid rgba(146,164,191,0.18)',
                  background: 'rgba(8, 11, 18, 0.64)',
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
                    border: '1px solid rgba(146,164,191,0.12)',
                    background: 'rgba(10, 12, 19, 0.72)',
                    color: '#f5f8ff',
                    fontSize: 10,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                  }}
                >
                  <div style={{ opacity: 0.58 }}>Layout</div>
                  <div style={{ marginTop: 6, color: '#ffb27e' }}>{host.layoutProfile.label}</div>
                </div>
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 20,
                    border: '1px solid rgba(146,164,191,0.12)',
                    background: 'rgba(10, 12, 19, 0.72)',
                    color: '#f5f8ff',
                    fontSize: 10,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                  }}
                >
                  <div style={{ opacity: 0.58 }}>Chrome</div>
                  <div style={{ marginTop: 6, color: '#6be7ff' }}>{chromeRegion.height}px</div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    );
  },
});
