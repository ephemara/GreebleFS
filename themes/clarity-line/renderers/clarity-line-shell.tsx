import { defineThemeRenderer } from 'overlayterm-theme-renderer';

function resolveRegionWidth(region: { visible: boolean; width: number }, fallback: number): number {
  return region.visible ? Math.max(fallback, region.width) : 0;
}

function resolveActiveGroup(groups: Array<{ id: string; panels: Array<{ id: string }> }>, activePanelId: string | null) {
  return groups.find(group => group.panels.some(panel => panel.id === activePanelId)) ?? groups[0] ?? null;
}

export default defineThemeRenderer({
  name: 'Clarity Line Shell',
  apiVersion: 1,
  supportsLiveSwap: true,
  fallbackRuntime: 'workbench-tabs',
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
    const activeGroupPanels = activeGroup?.panels.length ? activeGroup.panels : panels.slice(0, 7);

    const launcherWidth = resolveRegionWidth(regions.launcher, 296);
    const rightWidth = resolveRegionWidth(regions.pinnedRight, 302);
    const showLauncherRail = launcherWidth > 0;
    const showRightRail = rightWidth > 0;
    const shellColumns = [
      showLauncherRail ? `${launcherWidth}px` : null,
      'minmax(0, 1.45fr)',
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
          color: '#18212a',
          background:
            'linear-gradient(180deg, rgba(247,243,237,0.96), rgba(236,239,244,0.94) 48%, rgba(222,227,233,0.98)), radial-gradient(circle at 14% 8%, rgba(255,255,255,0.96), transparent 30%), radial-gradient(circle at 84% 18%, rgba(125,143,168,0.16), transparent 26%)',
        }}
      >
        {host.wallpaper.renderBackdropStack()}

        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.3), rgba(255,255,255,0) 28%), radial-gradient(circle at 50% 10%, rgba(255,255,255,0.55), transparent 20%), radial-gradient(circle at 50% 88%, rgba(84,112,146,0.08), transparent 24%)',
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
              gap: 16,
              alignItems: 'start',
            }}
          >
            <div
              style={{
                padding: '18px 20px',
                borderRadius: 28,
                border: '1px solid rgba(118, 135, 154, 0.16)',
                background: 'rgba(255,255,255,0.74)',
                boxShadow: '0 18px 40px rgba(51, 65, 80, 0.09)',
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
                  color: 'rgba(58, 74, 92, 0.56)',
                }}
              >
                Clarity Line
              </div>
              <div style={{ marginTop: 10, fontSize: 34, fontWeight: 700, lineHeight: 1.02, color: '#16202b' }}>
                {host.theme.name}
              </div>
              <div style={{ marginTop: 10, maxWidth: 760, fontSize: 13, lineHeight: 1.7, color: 'rgba(40, 54, 68, 0.76)' }}>
                {host.theme.description ?? 'An editorial shell tuned for calm contrast, high signal navigation, and viewport-safe composition.'}
              </div>
              <div
                style={{
                  marginTop: 14,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 10,
                }}
              >
                <span
                  style={{
                    padding: '9px 12px',
                    borderRadius: 999,
                    border: '1px solid rgba(118, 135, 154, 0.16)',
                    background: 'rgba(255,255,255,0.72)',
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'rgba(40, 54, 68, 0.72)',
                  }}
                >
                  {groups.length} groups
                </span>
                <span
                  style={{
                    padding: '9px 12px',
                    borderRadius: 999,
                    border: '1px solid rgba(118, 135, 154, 0.16)',
                    background: 'rgba(255,255,255,0.72)',
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'rgba(40, 54, 68, 0.72)',
                  }}
                >
                  {panels.length} launchers
                </span>
                <span
                  style={{
                    padding: '9px 12px',
                    borderRadius: 999,
                    border: '1px solid rgba(118, 135, 154, 0.16)',
                    background: 'rgba(255,255,255,0.72)',
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'rgba(40, 54, 68, 0.72)',
                  }}
                >
                  {activePanel?.label ?? 'No active surface'}
                </span>
              </div>
            </div>

            <div
              style={{
                minWidth: 0,
                padding: 12,
                borderRadius: 24,
                border: '1px solid rgba(118, 135, 154, 0.14)',
                background: 'rgba(255,255,255,0.68)',
                boxShadow: '0 14px 30px rgba(51, 65, 80, 0.08)',
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
                  borderRadius: 32,
                  border: '1px solid rgba(118, 135, 154, 0.16)',
                  background: 'rgba(255,255,255,0.8)',
                  boxShadow: '0 20px 46px rgba(51, 65, 80, 0.1)',
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
                    color: 'rgba(58, 74, 92, 0.56)',
                  }}
                >
                  Launcher Index
                </div>
                <div style={{ marginTop: 8, fontSize: 24, fontWeight: 700, color: '#16202b' }}>
                  {activeGroup?.label ?? 'Panels'}
                </div>
                <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.55, color: 'rgba(40, 54, 68, 0.7)' }}>
                  Grouped launcher cards keep the shell legible and prevent the old duplicate-chrome pattern from creeping back in.
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
                        border: isActive ? '1px solid rgba(109, 131, 164, 0.26)' : '1px solid rgba(118, 135, 154, 0.12)',
                        background: isActive ? 'rgba(224, 232, 240, 0.98)' : 'rgba(255,255,255,0.76)',
                        color: '#16202b',
                        cursor: 'pointer',
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span>{group.label}</span>
                      <span style={{ color: '#5d748c' }}>{group.panels.length}</span>
                    </button>
                  );
                })}
              </div>

              <div
                style={{
                  minHeight: 0,
                  overflow: 'auto',
                  paddingRight: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                {activeGroupPanels.map(panel => {
                  const isActive = panel.id === activePanel?.id;

                  return (
                    <button
                      key={panel.id}
                      onClick={() => panel.activate()}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '48px minmax(0, 1fr)',
                        gap: 12,
                        alignItems: 'center',
                        padding: '12px 12px 12px 10px',
                        borderRadius: 22,
                        border: isActive ? '1px solid rgba(109, 131, 164, 0.24)' : '1px solid rgba(118, 135, 154, 0.1)',
                        background: isActive
                          ? 'linear-gradient(180deg, rgba(232, 237, 242, 0.98), rgba(247, 248, 250, 0.96))'
                          : 'rgba(255,255,255,0.72)',
                        boxShadow: isActive ? '0 12px 24px rgba(51, 65, 80, 0.08)' : 'none',
                        color: '#16202b',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transform: isActive ? 'translateX(4px)' : 'translateX(0)',
                        transition: 'transform 180ms ease, background 180ms ease, border-color 180ms ease',
                      }}
                    >
                      <span
                        style={{
                          width: 48,
                          height: 48,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 16,
                          background: isActive ? 'rgba(109, 131, 164, 0.12)' : 'rgba(118, 135, 154, 0.08)',
                          color: isActive ? '#40607e' : '#687d94',
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
                            color: 'rgba(40, 54, 68, 0.68)',
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

              {regions.pinnedLeft.visible ? (
                <div
                  style={{
                    minHeight: 0,
                    padding: 12,
                    borderRadius: 20,
                    border: '1px solid rgba(118, 135, 154, 0.12)',
                    background: 'rgba(244, 247, 250, 0.86)',
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
                      color: 'rgba(58, 74, 92, 0.56)',
                    }}
                  >
                    Left Pinned
                  </div>
                  <div style={{ minHeight: 0, maxHeight: 240, overflow: 'auto' }}>
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
                borderRadius: 40,
                border: '1px solid rgba(118, 135, 154, 0.18)',
                background:
                  'linear-gradient(180deg, rgba(248, 249, 251, 0.92), rgba(236, 240, 244, 0.96)), radial-gradient(circle at 50% 8%, rgba(255,255,255,0.84), transparent 28%)',
                boxShadow: '0 28px 64px rgba(51, 65, 80, 0.12)',
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
                    'linear-gradient(135deg, rgba(109, 131, 164, 0.08), transparent 34%), radial-gradient(circle at 18% 20%, rgba(255,255,255,0.72), transparent 20%), radial-gradient(circle at 82% 18%, rgba(109,131,164,0.08), transparent 16%)',
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
                        color: 'rgba(58, 74, 92, 0.56)',
                      }}
                    >
                      Stage View
                    </div>
                    <div style={{ marginTop: 8, fontSize: 28, fontWeight: 700, color: '#16202b' }}>
                      {activePanel?.label ?? 'Workbench Surface'}
                    </div>
                    <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.65, color: 'rgba(40, 54, 68, 0.72)' }}>
                      {activePanel?.description ?? 'The currently active host panel is projected into a clean, viewport-safe editorial frame.'}
                    </div>
                  </div>

                  <div
                    style={{
                      minWidth: 0,
                      padding: '10px 12px',
                      borderRadius: 18,
                      border: '1px solid rgba(118, 135, 154, 0.12)',
                      background: 'rgba(255,255,255,0.72)',
                      color: 'rgba(40, 54, 68, 0.76)',
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
                    minHeight: 0,
                    borderRadius: 32,
                    border: '1px solid rgba(118, 135, 154, 0.14)',
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.92), rgba(245,248,251,0.84))',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.62)',
                    overflow: 'hidden',
                  }}
                >
                  {activePanel ? host.renderPanelSurface(activePanel.id, { forceMount: true, forceVisible: true }) : null}
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
                  borderRadius: 32,
                  border: '1px solid rgba(118, 135, 154, 0.16)',
                  background: 'rgba(255,255,255,0.76)',
                  boxShadow: '0 20px 46px rgba(51, 65, 80, 0.1)',
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
                    color: 'rgba(58, 74, 92, 0.56)',
                  }}
                >
                  Working Set
                </div>
                <div style={{ marginTop: 8, fontSize: 24, fontWeight: 700, color: '#16202b' }}>
                  {activeGroup?.label ?? 'Surface'}
                </div>
                <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.55, color: 'rgba(40, 54, 68, 0.7)' }}>
                  The rail stays lightweight and keeps pinned surfaces visible without forcing a second launcher system into the shell.
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
                    border: '1px solid rgba(118, 135, 154, 0.12)',
                    background: 'rgba(248, 250, 252, 0.92)',
                  }}
                >
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: 'rgba(58, 74, 92, 0.56)',
                    }}
                  >
                    Groups
                  </div>
                  <div style={{ marginTop: 8, fontSize: 20, fontWeight: 700, color: '#16202b' }}>
                    {groups.length}
                  </div>
                </div>
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 18,
                    border: '1px solid rgba(118, 135, 154, 0.12)',
                    background: 'rgba(248, 250, 252, 0.92)',
                  }}
                >
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: 'rgba(58, 74, 92, 0.56)',
                    }}
                  >
                    Open
                  </div>
                  <div style={{ marginTop: 8, fontSize: 20, fontWeight: 700, color: '#16202b' }}>
                    {host.openPanelIds.length}
                  </div>
                </div>
              </div>

              <div
                style={{
                  minHeight: 0,
                  padding: 12,
                  borderRadius: 22,
                  border: '1px solid rgba(118, 135, 154, 0.12)',
                  background: 'rgba(245, 248, 250, 0.9)',
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
                    color: 'rgba(58, 74, 92, 0.56)',
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
