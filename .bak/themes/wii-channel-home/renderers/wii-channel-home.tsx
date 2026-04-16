import { defineThemeRenderer } from 'overlayterm-theme-renderer';

function resolveRegionWidth(region: { visible: boolean; width: number }, fallback: number): number {
  return region.visible ? Math.max(fallback, region.width) : 0;
}

function resolveActiveGroup(groups: Array<{ id: string; label: string; panels: Array<{ id: string }> }>, activePanelId: string | null) {
  return groups.find(group => group.panels.some(panel => panel.id === activePanelId)) ?? groups[0] ?? null;
}

export default defineThemeRenderer({
  name: 'Wii Channel Home Shell',
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
    const regions = host.shellModel.layout.regions;
    const groups = host.shellModel.launcher.groups;
    const panels = host.shellModel.launcher.panels;
    const activePanel = panels.find(panel => panel.id === host.activePanelId) ?? panels[0] ?? null;
    const activeGroup = resolveActiveGroup(groups, activePanel?.id ?? null);
    const featuredPanels = (activeGroup?.panels.length ? activeGroup.panels : panels).slice(0, 8);

    const launcherWidth = resolveRegionWidth(regions.launcher, 282);
    const rightWidth = resolveRegionWidth(regions.pinnedRight, 292);
    const showLauncherRail = launcherWidth > 0;
    const showRightRail = rightWidth > 0;
    const shellColumns = [
      showLauncherRail ? `${launcherWidth}px` : null,
      'minmax(0, 1.4fr)',
      showRightRail ? `${rightWidth}px` : null,
    ].filter(Boolean).join(' ');

    return (
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          color: '#14303d',
          background:
            'linear-gradient(180deg, rgba(241,248,252,0.98), rgba(230,240,246,0.96) 54%, rgba(220,232,239,0.98)), radial-gradient(circle at 14% 10%, rgba(255,255,255,0.98), transparent 26%), radial-gradient(circle at 82% 20%, rgba(81,161,209,0.12), transparent 22%)',
        }}
      >
        {host.wallpaper.renderBackdropStack()}

        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.34), rgba(255,255,255,0) 28%), radial-gradient(circle at 50% 6%, rgba(255,255,255,0.62), transparent 22%), radial-gradient(circle at 50% 90%, rgba(81,161,209,0.08), transparent 24%)',
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'grid',
            gridTemplateRows: 'auto minmax(0, 1fr)',
            width: '100%',
            minHeight: 0,
            padding: Math.max(14, host.shellModel.layout.shellInset),
            gap: Math.max(12, host.shellModel.layout.panelGap),
          }}
        >
          <header
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) auto',
              gap: 14,
              alignItems: 'start',
            }}
          >
            <div
              style={{
                padding: '18px 20px',
                borderRadius: 28,
                border: '1px solid rgba(81, 161, 209, 0.14)',
                background: 'rgba(255,255,255,0.8)',
                boxShadow: '0 18px 40px rgba(59, 97, 118, 0.12)',
                backdropFilter: 'blur(18px)',
                WebkitBackdropFilter: 'blur(18px)',
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'rgba(46, 79, 96, 0.56)',
                }}
              >
                Wii Channel Home
              </div>
              <div style={{ marginTop: 10, fontSize: 34, fontWeight: 700, lineHeight: 1.02, color: '#14303d' }}>
                {host.theme.name}
              </div>
              <div style={{ marginTop: 10, maxWidth: 760, fontSize: 13, lineHeight: 1.7, color: 'rgba(33, 58, 73, 0.76)' }}>
                {host.theme.description ?? 'A bright channel wall with a hero surface, rounded cards, and a relaxed but disciplined launcher hierarchy.'}
              </div>
            </div>

            <div
              style={{
                minWidth: 0,
                padding: 12,
                borderRadius: 24,
                border: '1px solid rgba(81, 161, 209, 0.12)',
                background: 'rgba(255,255,255,0.74)',
                boxShadow: '0 14px 32px rgba(59, 97, 118, 0.1)',
              }}
            >
              {host.renderUtilityActionsSurface()}
            </div>
          </header>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: shellColumns,
              gap: Math.max(12, host.shellModel.layout.panelGap),
              minHeight: 0,
            }}
          >
            {showLauncherRail ? (
              <aside
                style={{
                  display: 'grid',
                  gridTemplateRows: 'auto auto minmax(0, 1fr) auto',
                  gap: 12,
                  minHeight: 0,
                  padding: 16,
                  borderRadius: 34,
                  border: '1px solid rgba(81, 161, 209, 0.14)',
                  background: 'rgba(255,255,255,0.8)',
                  boxShadow: '0 20px 44px rgba(59, 97, 118, 0.1)',
                  backdropFilter: 'blur(18px)',
                  WebkitBackdropFilter: 'blur(18px)',
                  overflow: 'hidden',
                }}
              >
              <div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color: 'rgba(46, 79, 96, 0.56)',
                  }}
                >
                  Channel Hub
                </div>
                <div style={{ marginTop: 8, fontSize: 24, fontWeight: 700, color: '#14303d' }}>
                  {activeGroup?.label ?? 'Launcher'}
                </div>
                <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.55, color: 'rgba(33, 58, 73, 0.7)' }}>
                  Grouped channels keep the layout readable and make the shell feel intentional instead of overbuilt.
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {groups.map(group => {
                  const isActive = group.id === activeGroup?.id;

                  return (
                    <button
                      key={group.id}
                      onClick={() => group.panels[0]?.activate()}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '9px 12px',
                        borderRadius: 999,
                        border: isActive ? '1px solid rgba(81,161,209,0.24)' : '1px solid rgba(81, 161, 209, 0.1)',
                        background: isActive ? 'rgba(226, 244, 253, 0.98)' : 'rgba(255,255,255,0.74)',
                        color: '#14303d',
                        cursor: 'pointer',
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span>{group.label}</span>
                      <span style={{ color: '#4a8fb8' }}>{group.panels.length}</span>
                    </button>
                  );
                })}
              </div>

              <div
                style={{
                  minHeight: 0,
                  padding: 12,
                  borderRadius: 24,
                  border: '1px solid rgba(81, 161, 209, 0.12)',
                  background: 'linear-gradient(180deg, rgba(250,252,254,0.98), rgba(240,246,250,0.92))',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    marginBottom: 10,
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color: 'rgba(46, 79, 96, 0.56)',
                  }}
                >
                  Active Channels
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0, overflow: 'auto' }}>
                  {featuredPanels.map((panel, index) => {
                    const isActive = panel.id === activePanel?.id;

                    return (
                      <button
                        key={panel.id}
                        onClick={() => panel.activate()}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '42px minmax(0, 1fr)',
                          gap: 10,
                          alignItems: 'center',
                          padding: '10px 10px 10px 8px',
                          borderRadius: 20,
                          border: isActive ? '1px solid rgba(81,161,209,0.24)' : '1px solid rgba(81, 161, 209, 0.08)',
                          background: isActive
                            ? 'linear-gradient(180deg, rgba(226, 244, 253, 0.98), rgba(243, 249, 253, 0.96))'
                            : 'rgba(255,255,255,0.8)',
                          boxShadow: isActive ? '0 12px 26px rgba(59, 97, 118, 0.1)' : 'none',
                          color: '#14303d',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transform: `translateX(${isActive ? 4 : index % 2 ? 8 : 0}px)`,
                        }}
                      >
                        <span
                          style={{
                            width: 42,
                            height: 42,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 16,
                            background: isActive ? 'rgba(81,161,209,0.14)' : 'rgba(81,161,209,0.08)',
                            color: '#2f8dcc',
                            flexShrink: 0,
                          }}
                        >
                          {panel.icon}
                        </span>
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                          <span style={{ fontSize: 12, fontWeight: 700 }}>{panel.label}</span>
                          <span style={{ fontSize: 10, lineHeight: 1.45, color: 'rgba(33, 58, 73, 0.66)' }}>
                            {panel.description}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {regions.pinnedLeft.visible ? (
                <div
                  style={{
                    minHeight: 0,
                    padding: 12,
                    borderRadius: 24,
                    border: '1px solid rgba(81, 161, 209, 0.12)',
                    background: 'rgba(248, 252, 255, 0.9)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      marginBottom: 10,
                      fontSize: 9,
                      fontWeight: 800,
                      letterSpacing: '0.16em',
                      textTransform: 'uppercase',
                      color: 'rgba(46, 79, 96, 0.56)',
                    }}
                  >
                    Left Pinned
                  </div>
                  <div style={{ minHeight: 0, height: '100%', overflow: 'auto' }}>
                    {host.renderPinnedPanels('left')}
                  </div>
                </div>
              ) : null}
              </aside>
            ) : null}

            <main
              style={{
                display: 'grid',
                gridTemplateRows: 'minmax(0, 1fr) auto',
                gap: 14,
                minHeight: 0,
              }}
            >
              <div
                style={{
                  position: 'relative',
                  minHeight: 0,
                  borderRadius: 40,
                  border: '1px solid rgba(81, 161, 209, 0.14)',
                  background:
                    'linear-gradient(180deg, rgba(255,255,255,0.9), rgba(240,247,251,0.88)), radial-gradient(circle at 50% 22%, rgba(81,161,209,0.1), transparent 24%)',
                  boxShadow: '0 24px 54px rgba(59, 97, 118, 0.12)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  overflow: 'hidden',
                }}
              >
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                      'radial-gradient(circle at 50% 34%, rgba(255,255,255,0.72), transparent 26%), linear-gradient(135deg, rgba(81,161,209,0.08), transparent 42%)',
                    pointerEvents: 'none',
                  }}
                />

                <div
                  style={{
                    position: 'relative',
                    zIndex: 1,
                    display: 'grid',
                    gridTemplateRows: 'auto minmax(0, 1fr)',
                    minHeight: 0,
                    height: '100%',
                    padding: 18,
                    gap: 14,
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 1fr) auto',
                      gap: 12,
                      alignItems: 'start',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          letterSpacing: '0.16em',
                          textTransform: 'uppercase',
                          color: 'rgba(46, 79, 96, 0.56)',
                        }}
                      >
                        Hero Channel
                      </div>
                      <div style={{ marginTop: 8, fontSize: 28, fontWeight: 700, color: '#14303d' }}>
                        {activePanel?.label ?? 'Channel'}
                      </div>
                      <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.65, color: 'rgba(33, 58, 73, 0.72)' }}>
                        {activePanel?.description ?? 'The active host surface sits in a soft, premium frame that keeps the layout calm and readable.'}
                      </div>
                    </div>

                    <div
                      style={{
                        minWidth: 0,
                        padding: '10px 12px',
                        borderRadius: 18,
                        border: '1px solid rgba(81, 161, 209, 0.12)',
                        background: 'rgba(255,255,255,0.78)',
                        color: 'rgba(33, 58, 73, 0.76)',
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {host.layoutProfile.label}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateRows: 'minmax(0, 1.12fr) minmax(164px, 0.58fr)',
                      gap: 14,
                      minHeight: 0,
                    }}
                  >
                    <div
                      style={{
                        minHeight: 0,
                        borderRadius: 34,
                        border: '1px solid rgba(81, 161, 209, 0.12)',
                        background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(241,247,250,0.94))',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.72)',
                        overflow: 'hidden',
                      }}
                    >
                      {activePanel ? host.renderPanelSurface(activePanel.id, { forceMount: true, forceVisible: true }) : null}
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                        gap: 12,
                        minHeight: 0,
                      }}
                    >
                      {featuredPanels.slice(0, 4).map(panel => {
                        const isActive = panel.id === activePanel?.id;

                        return (
                          <button
                            key={panel.id}
                            onClick={() => panel.activate()}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'flex-start',
                              justifyContent: 'space-between',
                              gap: 12,
                              minHeight: 150,
                              padding: '16px 14px 14px',
                              borderRadius: 28,
                              border: isActive ? '1px solid rgba(81,161,209,0.24)' : '1px solid rgba(81, 161, 209, 0.08)',
                              background: isActive
                                ? 'linear-gradient(180deg, rgba(226, 244, 253, 0.98), rgba(244, 249, 253, 0.96))'
                                : 'linear-gradient(180deg, rgba(255,255,255,0.96), rgba(243,248,251,0.9))',
                              boxShadow: isActive ? '0 16px 32px rgba(59, 97, 118, 0.12)' : '0 10px 20px rgba(59, 97, 118, 0.06)',
                              color: '#14303d',
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                          >
                            <span
                              style={{
                                width: 44,
                                height: 44,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: 16,
                                background: isActive ? 'rgba(81,161,209,0.14)' : 'rgba(81,161,209,0.08)',
                                color: '#2f8dcc',
                              }}
                            >
                              {panel.icon}
                            </span>
                            <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                              <span style={{ fontSize: 12, fontWeight: 700 }}>{panel.label}</span>
                              <span
                                style={{
                                  fontSize: 10,
                                  lineHeight: 1.45,
                                  color: 'rgba(33, 58, 73, 0.66)',
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                }}
                              >
                                {panel.description}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </main>

            {showRightRail ? (
              <aside
                style={{
                  display: 'grid',
                  gridTemplateRows: 'auto auto minmax(0, 1fr)',
                  gap: 12,
                  minHeight: 0,
                  padding: 16,
                  borderRadius: 34,
                  border: '1px solid rgba(81, 161, 209, 0.14)',
                  background: 'rgba(255,255,255,0.8)',
                  boxShadow: '0 20px 44px rgba(59, 97, 118, 0.1)',
                  backdropFilter: 'blur(18px)',
                  WebkitBackdropFilter: 'blur(18px)',
                  overflow: 'hidden',
                }}
              >
              <div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color: 'rgba(46, 79, 96, 0.56)',
                  }}
                >
                  Side Dock
                </div>
                <div style={{ marginTop: 8, fontSize: 24, fontWeight: 700, color: '#14303d' }}>
                  {activePanel?.label ?? 'Surface'}
                </div>
                <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.55, color: 'rgba(33, 58, 73, 0.7)' }}>
                  Pinned panels stay in a clear, friendly side dock instead of getting buried under a second chrome layer.
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
                    borderRadius: 18,
                    border: '1px solid rgba(81, 161, 209, 0.12)',
                    background: 'rgba(245, 249, 252, 0.96)',
                  }}
                >
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: 'rgba(46, 79, 96, 0.56)',
                    }}
                  >
                    Panels
                  </div>
                  <div style={{ marginTop: 8, fontSize: 20, fontWeight: 700 }}>
                    {panels.length}
                  </div>
                </div>
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 18,
                    border: '1px solid rgba(81, 161, 209, 0.12)',
                    background: 'rgba(245, 249, 252, 0.96)',
                  }}
                >
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: 'rgba(46, 79, 96, 0.56)',
                    }}
                  >
                    Open
                  </div>
                  <div style={{ marginTop: 8, fontSize: 20, fontWeight: 700 }}>
                    {host.openPanelIds.length}
                  </div>
                </div>
              </div>

              <div
                style={{
                  minHeight: 0,
                  padding: 12,
                  borderRadius: 24,
                  border: '1px solid rgba(81, 161, 209, 0.12)',
                  background: 'linear-gradient(180deg, rgba(250,252,254,0.98), rgba(239,245,249,0.92))',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    marginBottom: 10,
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color: 'rgba(46, 79, 96, 0.56)',
                  }}
                >
                  Right Pinned
                </div>
                <div style={{ minHeight: 0, height: '100%', overflow: 'auto' }}>
                  {host.renderPinnedPanels('right')}
                </div>
              </div>
              </aside>
            ) : null}
          </div>
        </div>
      </div>
    );
  },
});
