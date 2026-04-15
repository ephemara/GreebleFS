import { defineThemeRenderer } from 'overlayterm-theme-renderer';

function resolveRegionWidth(region: { visible: boolean; width: number }, fallback: number): number {
  return region.visible ? Math.max(fallback, region.width) : 0;
}

function resolveActiveGroup(groups: Array<{ id: string; label: string; panels: Array<{ id: string }> }>, activePanelId: string | null) {
  return groups.find(group => group.panels.some(panel => panel.id === activePanelId)) ?? groups[0] ?? null;
}

function resolveWaveOffset(index: number, total: number) {
  const ratio = total <= 1 ? 0 : index / (total - 1);
  const curve = Math.sin(ratio * Math.PI * 1.6);
  const lift = Math.cos(ratio * Math.PI * 2.2);

  return {
    translateX: Math.round((curve - 0.5) * 10),
    translateY: Math.round((lift + 1) * 5),
    scale: 0.92 + (1 - ratio) * 0.06,
    opacity: 0.8 + (1 - ratio) * 0.2,
  };
}

export default defineThemeRenderer({
  name: 'XMB Crosswave Shell',
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
    wallpaper: true,
  },
  component({ host }) {
    const regions = host.shellModel.layout.regions;
    const groups = host.shellModel.launcher.groups;
    const panels = host.shellModel.launcher.panels;
    const activePanel = panels.find(panel => panel.id === host.activePanelId) ?? panels[0] ?? null;
    const activeGroup = resolveActiveGroup(groups, activePanel?.id ?? null);
    const activeGroupPanels = activeGroup?.panels.length ? activeGroup.panels : panels.slice(0, 6);

    const launcherWidth = resolveRegionWidth(regions.launcher, 288);
    const rightWidth = resolveRegionWidth(regions.pinnedRight, 302);
    const showLauncherRail = launcherWidth > 0;
    const showRightRail = rightWidth > 0;
    const shellColumns = [
      showLauncherRail ? `${launcherWidth}px` : null,
      'minmax(0, 1.42fr)',
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
          color: '#eaf6ff',
          background:
            'linear-gradient(180deg, rgba(5,12,24,0.96), rgba(8,16,30,0.94) 42%, rgba(4,10,18,0.98)), radial-gradient(circle at 16% 12%, rgba(93,223,255,0.18), transparent 22%), radial-gradient(circle at 84% 18%, rgba(111,146,255,0.14), transparent 18%)',
        }}
      >
        {host.wallpaper.renderBackdropStack()}

        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0) 20%), radial-gradient(circle at 50% 12%, rgba(93,223,255,0.16), transparent 24%), radial-gradient(circle at 50% 88%, rgba(111,146,255,0.12), transparent 22%)',
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
            padding: Math.max(16, host.shellModel.layout.shellInset),
            gap: Math.max(14, host.shellModel.layout.panelGap),
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
                border: '1px solid rgba(126, 142, 194, 0.16)',
                background: 'rgba(10, 14, 25, 0.68)',
                boxShadow: '0 18px 46px rgba(0, 0, 0, 0.34)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'rgba(175, 199, 225, 0.58)',
                }}
              >
                XMB Crosswave
              </div>
              <div style={{ marginTop: 10, fontSize: 34, fontWeight: 700, lineHeight: 1.02 }}>
                {host.theme.name}
              </div>
              <div style={{ marginTop: 10, maxWidth: 760, fontSize: 13, lineHeight: 1.7, color: 'rgba(215, 228, 243, 0.76)' }}>
                {host.theme.description ?? 'A console-grade shell with axis-first navigation, glossy depth, and a single launcher system rendered as the wave itself.'}
              </div>
            </div>

            <div
              style={{
                minWidth: 0,
                padding: 12,
                borderRadius: 24,
                border: '1px solid rgba(126, 142, 194, 0.16)',
                background: 'rgba(10, 14, 25, 0.68)',
                boxShadow: '0 14px 36px rgba(0, 0, 0, 0.28)',
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
                  border: '1px solid rgba(126, 142, 194, 0.16)',
                  background: 'rgba(8, 14, 25, 0.72)',
                  boxShadow: '0 22px 48px rgba(0, 0, 0, 0.32)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
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
                    color: 'rgba(175, 199, 225, 0.58)',
                  }}
                >
                  Category Rail
                </div>
                <div style={{ marginTop: 8, fontSize: 24, fontWeight: 700, color: '#f4fbff' }}>
                  {activeGroup?.label ?? 'Launcher'}
                </div>
                <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.55, color: 'rgba(215, 228, 243, 0.7)' }}>
                  The rail stays narrow and deliberate so the launcher feels like a console axis, not a duplicated app drawer.
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {groups.map(group => {
                  const isActive = group.id === activeGroup?.id;

                  return (
                    <button
                      key={group.id}
                      onClick={() => group.panels[0]?.activate()}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 12px',
                        borderRadius: 18,
                        border: isActive ? '1px solid rgba(93,223,255,0.26)' : '1px solid rgba(126, 142, 194, 0.1)',
                        background: isActive ? 'rgba(93,223,255,0.12)' : 'rgba(255,255,255,0.04)',
                        color: isActive ? '#f4fbff' : 'rgba(215, 228, 243, 0.7)',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 999,
                          background: isActive ? '#5ddfff' : 'rgba(93,223,255,0.3)',
                          boxShadow: isActive ? '0 0 0 6px rgba(93,223,255,0.12)' : 'none',
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                        <span style={{ fontSize: 11, fontWeight: 700 }}>{group.label}</span>
                        <span style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(215, 228, 243, 0.52)' }}>
                          {group.panels.length} lanes
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div
                style={{
                  minHeight: 0,
                  padding: 12,
                  borderRadius: 24,
                  border: '1px solid rgba(126, 142, 194, 0.12)',
                  background: 'rgba(255,255,255,0.04)',
                }}
              >
                <div
                  style={{
                    marginBottom: 10,
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color: 'rgba(175, 199, 225, 0.58)',
                  }}
                >
                  Active Lane
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {activeGroupPanels.slice(0, 4).map(panel => {
                    const isActive = panel.id === activePanel?.id;

                    return (
                      <button
                        key={panel.id}
                        onClick={() => panel.activate()}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '10px 12px',
                          borderRadius: 18,
                          border: isActive ? '1px solid rgba(93,223,255,0.28)' : '1px solid rgba(126, 142, 194, 0.1)',
                          background: isActive ? 'rgba(18, 32, 58, 0.9)' : 'rgba(255,255,255,0.05)',
                          color: '#f4fbff',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <span
                          style={{
                            width: 28,
                            height: 28,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 12,
                            background: 'rgba(93,223,255,0.12)',
                            color: isActive ? '#5ddfff' : '#d7f6ff',
                            flexShrink: 0,
                          }}
                        >
                          {panel.icon}
                        </span>
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                          <span style={{ fontSize: 11, fontWeight: 700 }}>{panel.label}</span>
                          <span style={{ fontSize: 9, color: 'rgba(215, 228, 243, 0.56)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
                    border: '1px solid rgba(126, 142, 194, 0.12)',
                    background: 'rgba(255,255,255,0.04)',
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
                      color: 'rgba(175, 199, 225, 0.58)',
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
                position: 'relative',
                minHeight: 0,
                borderRadius: 42,
                border: '1px solid rgba(126, 142, 194, 0.18)',
                background:
                  'linear-gradient(180deg, rgba(13, 18, 34, 0.98), rgba(6, 10, 20, 0.98)), radial-gradient(circle at 50% 16%, rgba(93,223,255,0.14), transparent 22%)',
                boxShadow: '0 30px 88px rgba(0, 0, 0, 0.52)',
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
                  background:
                    'radial-gradient(circle at 50% 34%, rgba(93,223,255,0.16), transparent 28%), linear-gradient(135deg, rgba(255,255,255,0.05), transparent 38%)',
                  pointerEvents: 'none',
                }}
              />

              <div
                style={{
                  position: 'relative',
                  zIndex: 1,
                  display: 'grid',
                  gridTemplateRows: 'auto minmax(0, 1fr) auto',
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
                        color: 'rgba(175, 199, 225, 0.58)',
                      }}
                    >
                      Crosswave Stage
                    </div>
                    <div style={{ marginTop: 8, fontSize: 28, fontWeight: 700, color: '#f4fbff' }}>
                      {activePanel?.label ?? 'Launcher Surface'}
                    </div>
                    <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.65, color: 'rgba(215, 228, 243, 0.72)' }}>
                      {activePanel?.description ?? 'A single focal surface sits in the center while the launcher wave crosses the shell beneath it.'}
                    </div>
                  </div>

                  <div
                    style={{
                      minWidth: 0,
                      padding: '10px 12px',
                      borderRadius: 18,
                      border: '1px solid rgba(126, 142, 194, 0.14)',
                      background: 'rgba(255,255,255,0.05)',
                      color: 'rgba(215, 228, 243, 0.72)',
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
                    gridTemplateRows: 'minmax(0, 1fr) auto',
                    gap: 12,
                    minHeight: 0,
                  }}
                >
                  <div
                    style={{
                      minHeight: 0,
                      borderRadius: 36,
                      border: '1px solid rgba(126, 142, 194, 0.16)',
                      background:
                        'linear-gradient(180deg, rgba(18, 24, 42, 0.96), rgba(9, 13, 24, 0.98)), radial-gradient(circle at 50% 30%, rgba(93,223,255,0.14), transparent 28%)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                      overflow: 'hidden',
                    }}
                  >
                    {activePanel ? host.renderPanelSurface(activePanel.id, { forceMount: true, forceVisible: true }) : null}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: 10,
                      alignItems: 'stretch',
                      overflowX: 'auto',
                      padding: '2px 4px 0',
                      minHeight: 108,
                    }}
                  >
                    {activeGroupPanels.map((panel, index) => {
                      const isActive = panel.id === activePanel?.id;
                      const wave = resolveWaveOffset(index, activeGroupPanels.length);

                      return (
                        <button
                          key={panel.id}
                          onClick={() => panel.activate()}
                          style={{
                            flex: '0 0 auto',
                            width: isActive ? 206 : 164,
                            minHeight: isActive ? 96 : 82,
                            borderRadius: 999,
                            border: isActive ? '1px solid rgba(93,223,255,0.32)' : '1px solid rgba(126, 142, 194, 0.12)',
                            background: isActive
                              ? 'linear-gradient(180deg, rgba(93,223,255,0.18), rgba(10, 16, 30, 0.98))'
                              : 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))',
                            boxShadow: isActive ? '0 18px 40px rgba(0, 0, 0, 0.34)' : 'none',
                            color: '#f4fbff',
                            cursor: 'pointer',
                            transform: `translateX(${wave.translateX}px) translateY(${wave.translateY}px) scale(${wave.scale})`,
                            opacity: wave.opacity,
                            textAlign: 'left',
                            padding: '12px 14px',
                            display: 'grid',
                            gridTemplateColumns: '40px minmax(0, 1fr)',
                            gap: 10,
                            alignItems: 'center',
                          }}
                        >
                          <span
                            style={{
                              width: 40,
                              height: 40,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: 14,
                              background: 'rgba(93,223,255,0.1)',
                              color: isActive ? '#5ddfff' : '#d7f6ff',
                              flexShrink: 0,
                            }}
                          >
                            {panel.icon}
                          </span>
                          <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {panel.label}
                            </span>
                            <span style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(215, 228, 243, 0.56)' }}>
                              {panel.kind}
                            </span>
                          </span>
                        </button>
                      );
                    })}
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
                  border: '1px solid rgba(126, 142, 194, 0.16)',
                  background: 'rgba(8, 14, 25, 0.72)',
                  boxShadow: '0 22px 48px rgba(0, 0, 0, 0.32)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
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
                    color: 'rgba(175, 199, 225, 0.58)',
                  }}
                >
                  Focus Line
                </div>
                <div style={{ marginTop: 8, fontSize: 24, fontWeight: 700, color: '#f4fbff' }}>
                  {activePanel?.label ?? 'Surface'}
                </div>
                <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.55, color: 'rgba(215, 228, 243, 0.7)' }}>
                  The side rail keeps the current panel, metadata, and pinned surfaces readable without collapsing into a second top bar.
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
                    border: '1px solid rgba(126, 142, 194, 0.12)',
                    background: 'rgba(255,255,255,0.05)',
                  }}
                >
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: 'rgba(175, 199, 225, 0.58)',
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
                    border: '1px solid rgba(126, 142, 194, 0.12)',
                    background: 'rgba(255,255,255,0.05)',
                  }}
                >
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: 'rgba(175, 199, 225, 0.58)',
                    }}
                  >
                    Pinned
                  </div>
                  <div style={{ marginTop: 8, fontSize: 20, fontWeight: 700 }}>
                    {host.pinnedPanelIds.length}
                  </div>
                </div>
              </div>

              <div
                style={{
                  minHeight: 0,
                  padding: 12,
                  borderRadius: 24,
                  border: '1px solid rgba(126, 142, 194, 0.12)',
                  background: 'rgba(255,255,255,0.04)',
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
                    color: 'rgba(175, 199, 225, 0.58)',
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
