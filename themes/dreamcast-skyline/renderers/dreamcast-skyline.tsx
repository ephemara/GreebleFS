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

function resolveLauncherGroups(host) {
  if (host.shellModel.launcher.groups.length > 0) {
    return host.shellModel.launcher.groups;
  }

  return [
    {
      id: 'launch',
      label: 'Launch Deck',
      order: 0,
      panels: host.shellModel.launcher.panels,
    },
  ];
}

function readPanelList(host) {
  return host.shellModel.launcher.panels;
}

export default defineThemeRenderer({
  name: 'Dreamcast Skyline Shell',
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
    const panels = readPanelList(host);
    const activePanel = panels.find(panel => panel.id === host.activePanelId) ?? panels[0] ?? null;
    const featuredPanels = panels.slice(0, 4);

    return (
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          background: 'linear-gradient(180deg, rgba(250, 252, 255, 0.98), rgba(241, 245, 248, 0.98))',
        }}
      >
        {host.wallpaper.renderBackdropStack()}

        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background: [
              'radial-gradient(circle at 18% 18%, rgba(255,117,42,0.12), transparent 18%)',
              'radial-gradient(circle at 82% 16%, rgba(77,216,255,0.12), transparent 18%)',
              'linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0) 30%)',
              'linear-gradient(180deg, transparent 72%, rgba(36, 56, 66, 0.08) 72%, rgba(36, 56, 66, 0.08) 74%, transparent 74%)',
            ].join(', '),
            pointerEvents: 'none',
          }}
        />

        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: '50%',
            bottom: 0,
            width: '86%',
            height: '18%',
            transform: 'translateX(-50%)',
            background: 'linear-gradient(180deg, transparent, rgba(38, 57, 67, 0.08))',
            borderTopLeftRadius: 160,
            borderTopRightRadius: 160,
            pointerEvents: 'none',
          }}
        />

        <div style={regionStyle(layout.regions.chrome, { zIndex: 3, padding: '0 18px 12px' })}>
          {host.renderUtilityActionsSurface()}
        </div>

        <div style={regionStyle(layout.regions.launcher, { zIndex: 2, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 })}>
          <section
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              padding: 18,
              borderRadius: 30,
              border: '1px solid rgba(33,53,62,0.12)',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.82), rgba(244,248,250,0.7))',
              boxShadow: '0 18px 42px rgba(31, 41, 46, 0.1)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
            }}
          >
            <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(28,43,51,0.56)' }}>
              Dreamcast Skyline
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#1c2b33', lineHeight: 1.05 }}>
              {activePanel?.label ?? 'Launcher'}
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.6, color: 'rgba(48,67,77,0.72)' }}>
              {activePanel?.description ?? 'Select a skyline node to open the scene inside the central glass deck.'}
            </div>
          </section>

          <section
            style={{
              flex: 1,
              minHeight: 0,
              padding: 14,
              borderRadius: 30,
              border: '1px solid rgba(33,53,62,0.12)',
              background: 'rgba(255,255,255,0.7)',
              boxShadow: '0 16px 38px rgba(31,41,46,0.08)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              overflow: 'auto',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {launcherGroups.slice(0, 4).map(group => (
                <div key={group.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      fontSize: 10,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: 'rgba(48,67,77,0.54)',
                    }}
                  >
                    <span>{group.label}</span>
                    <span>{group.panels.length}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {group.panels.slice(0, 4).map(panel => {
                      const isActive = panel.id === activePanel?.id;

                      return (
                        <button
                          key={panel.id}
                          onClick={() => host.activatePanel(panel.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '10px 12px',
                            borderRadius: 18,
                            border: isActive ? '1px solid rgba(255,117,42,0.28)' : '1px solid rgba(33,53,62,0.08)',
                            background: isActive ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.74)',
                            color: '#1c2b33',
                            cursor: 'pointer',
                            textAlign: 'left',
                            boxShadow: isActive ? '0 16px 28px rgba(31,41,46,0.1)' : 'none',
                          }}
                        >
                          <span
                            style={{
                              width: 30,
                              height: 30,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: 12,
                              background: 'rgba(255,117,42,0.1)',
                              color: '#ff752a',
                              flexShrink: 0,
                            }}
                          >
                            {panel.icon}
                          </span>
                          <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                            <span style={{ fontSize: 12, fontWeight: 700 }}>{panel.label}</span>
                            <span style={{ fontSize: 10, lineHeight: 1.4, color: 'rgba(48,67,77,0.66)' }}>
                              {panel.description}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section
            style={{
              padding: 16,
              borderRadius: 28,
              border: '1px solid rgba(33,53,62,0.12)',
              background: 'rgba(255,255,255,0.72)',
              boxShadow: '0 14px 32px rgba(31,41,46,0.08)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
            }}
          >
            <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(48,67,77,0.54)' }}>
              Control Drift
            </div>
            <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.55, color: 'rgba(48,67,77,0.78)' }}>
              The renderer owns the launcher, chrome, content frame, and pinned surfaces. The host stays out of the way.
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
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) 284px',
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
                borderRadius: 38,
                border: '1px solid rgba(33,53,62,0.12)',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.86), rgba(244,248,250,0.76))',
                boxShadow: '0 24px 54px rgba(31, 41, 46, 0.1)',
                overflow: 'hidden',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
              }}
            >
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.46), rgba(255,255,255,0) 28%), radial-gradient(circle at 50% 18%, rgba(77,216,255,0.08), transparent 20%)',
                  pointerEvents: 'none',
                }}
              />
              <div style={{ position: 'absolute', inset: 0, opacity: 0.34, pointerEvents: 'none' }}>
                {host.wallpaper.renderBackground({ opacity: 0.34, fitMode: 'cover' })}
              </div>
              <div
                style={{
                  position: 'relative',
                  zIndex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  width: '100%',
                  height: '100%',
                  minHeight: 0,
                  padding: 18,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(28,43,51,0.56)' }}>
                      Scene Monitor
                    </div>
                    <div style={{ marginTop: 8, fontSize: 24, fontWeight: 700, color: '#1c2b33' }}>
                      {activePanel?.label ?? 'Skyline'}
                    </div>
                  </div>
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: 999,
                      border: '1px solid rgba(255,117,42,0.2)',
                      background: 'rgba(255,255,255,0.82)',
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: '#ff752a',
                    }}
                  >
                    Skyline Deck
                  </div>
                </div>

                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    marginTop: 16,
                    borderRadius: 30,
                    border: '1px solid rgba(33,53,62,0.08)',
                    background: 'rgba(255,255,255,0.74)',
                    overflow: 'hidden',
                  }}
                >
                  {activePanel ? host.renderPanelSurface(activePanel.id, { forceMount: true, forceVisible: true }) : null}
                </div>
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
              <section
                style={{
                  padding: 18,
                  borderRadius: 30,
                  border: '1px solid rgba(33,53,62,0.12)',
                  background: 'rgba(255,255,255,0.76)',
                  boxShadow: '0 18px 40px rgba(31, 41, 46, 0.08)',
                  color: '#1c2b33',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                }}
              >
                <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(48,67,77,0.56)' }}>
                  Active Signal
                </div>
                <div style={{ marginTop: 10, fontSize: 26, fontWeight: 700, lineHeight: 1.08 }}>
                  {activePanel?.label ?? 'Launcher'}
                </div>
                <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.6, color: 'rgba(48,67,77,0.74)' }}>
                  {activePanel?.description ?? 'Select a deck node to bring a surface forward.'}
                </div>
              </section>

              <section
                style={{
                  flex: 1,
                  minHeight: 0,
                  padding: 14,
                  borderRadius: 30,
                  border: '1px solid rgba(33,53,62,0.12)',
                  background: 'rgba(255,255,255,0.7)',
                  boxShadow: '0 16px 38px rgba(31,41,46,0.08)',
                  overflow: 'auto',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {featuredPanels.map((panel, index) => {
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
                          border: isActive ? '1px solid rgba(255,117,42,0.26)' : '1px solid rgba(33,53,62,0.08)',
                          background: isActive ? 'rgba(255,255,255,0.94)' : 'rgba(255,255,255,0.72)',
                          color: '#1c2b33',
                          cursor: 'pointer',
                          textAlign: 'left',
                          boxShadow: isActive ? '0 14px 28px rgba(31,41,46,0.1)' : 'none',
                          transform: `translateX(${index % 2 === 0 ? 0 : 8}px)`,
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
                            background: 'rgba(255,117,42,0.1)',
                            color: '#ff752a',
                            flexShrink: 0,
                          }}
                        >
                          {panel.icon}
                        </span>
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                          <span style={{ fontSize: 12, fontWeight: 700 }}>{panel.label}</span>
                          <span style={{ fontSize: 10, lineHeight: 1.4, color: 'rgba(48,67,77,0.66)' }}>
                            {panel.description}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            </aside>
          </div>
        </div>

        {layout.regions.pinnedLeft.visible ? (
          <div style={regionStyle(layout.regions.pinnedLeft, { zIndex: 2, padding: 10, pointerEvents: 'auto' })}>
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'stretch' }}>
              {host.renderPinnedPanels('left')}
            </div>
          </div>
        ) : null}

        {layout.regions.pinnedRight.visible ? (
          <div style={regionStyle(layout.regions.pinnedRight, { zIndex: 2, padding: 10, pointerEvents: 'auto' })}>
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end' }}>
              {host.renderPinnedPanels('right')}
            </div>
          </div>
        ) : null}
      </div>
    );
  },
});
