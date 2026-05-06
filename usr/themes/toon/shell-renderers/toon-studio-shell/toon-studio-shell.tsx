import { defineThemeRenderer } from 'overlayterm-theme-renderer';

import { pickToonGroupSwatch } from './helpers/stickerPalette';

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function createStickerButtonStyle(panel, swatch) {
  return {
    width: '100%',
    border: `1px solid ${panel.isActive ? swatch.border : 'rgba(109, 125, 166, 0.16)'}`,
    borderRadius: 18,
    background: panel.isActive ? swatch.background : 'rgba(255,255,255,0.72)',
    boxShadow: panel.isActive ? swatch.shadow : '0 10px 22px rgba(95, 104, 154, 0.1)',
    padding: '10px 11px 9px',
    textAlign: 'left',
    cursor: 'pointer',
    transform: panel.isActive ? 'translate3d(-2px, -2px, 0)' : panel.isOpen ? 'translate3d(0, -1px, 0)' : 'none',
    transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease, background 180ms ease',
  };
}

function LauncherSticker({ group, groupIndex }) {
  return (
    <section style={{ display: 'grid', gap: 8 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <div
          style={{
            fontSize: 9,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            fontWeight: 900,
            color: 'rgba(69, 80, 107, 0.72)',
          }}
        >
          {group.label}
        </div>
        <div
          style={{
            minWidth: 20,
            height: 20,
            borderRadius: 999,
            border: '1px solid rgba(109, 125, 166, 0.14)',
            background: 'rgba(255, 255, 255, 0.74)',
            display: 'grid',
            placeItems: 'center',
            fontSize: 9,
            fontWeight: 900,
            color: '#45506B',
          }}
        >
          {group.panels.length}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {group.panels.map((panel, panelIndex) => {
          const swatch = pickToonGroupSwatch(groupIndex + panelIndex);
          return (
            <button
              key={panel.id}
              type="button"
              onClick={() => panel.activate()}
              style={createStickerButtonStyle(panel, swatch)}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 12,
                    border: `1px solid ${swatch.border}`,
                    background: 'rgba(255,255,255,0.68)',
                    display: 'grid',
                    placeItems: 'center',
                    color: swatch.text,
                    flexShrink: 0,
                  }}
                >
                  {panel.icon}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 900,
                      color: swatch.text,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {panel.label}
                  </div>
                  <div
                    style={{
                      marginTop: 3,
                      fontSize: 10,
                      lineHeight: 1.35,
                      color: 'rgba(69, 80, 107, 0.72)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {panel.description}
                  </div>
                </div>
                <div
                  style={{
                    minWidth: 8,
                    height: 8,
                    borderRadius: 999,
                    background: panel.isActive ? '#73B9FF' : panel.isPinned ? '#FFD36B' : 'rgba(109, 125, 166, 0.18)',
                    boxShadow: panel.isActive ? '0 0 0 4px rgba(115, 185, 255, 0.14)' : 'none',
                    flexShrink: 0,
                  }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function PinnedShelf({ title, subtitle, children }) {
  return (
    <section
      style={{
        display: 'grid',
        gap: 10,
        minHeight: 0,
        borderRadius: 24,
        border: '1px solid rgba(109, 125, 166, 0.16)',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.78) 0%, rgba(255,247,238,0.94) 100%)',
        boxShadow: '0 18px 38px rgba(95, 104, 154, 0.12)',
        padding: 12,
      }}
    >
      <div>
        <div
          style={{
            fontSize: 9,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            fontWeight: 900,
            color: '#73B9FF',
          }}
        >
          {title}
        </div>
        <div
          style={{
            marginTop: 4,
            fontSize: 11,
            lineHeight: 1.45,
            color: 'rgba(69, 80, 107, 0.72)',
          }}
        >
          {subtitle}
        </div>
      </div>
      <div style={{ minHeight: 0, overflow: 'hidden' }}>{children}</div>
    </section>
  );
}

function SurfaceCard({ children, radius = 22, padding = 10, minWidth = 0 }) {
  return (
    <div
      style={{
        minWidth,
        borderRadius: radius,
        border: '1px solid rgba(109, 125, 166, 0.18)',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.78) 0%, rgba(255,247,239,0.94) 100%)',
        boxShadow: '0 14px 28px rgba(95, 104, 154, 0.12)',
        padding,
      }}
    >
      {children}
    </div>
  );
}

export default defineThemeRenderer({
  name: 'Toon Studio Shell',
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
    pinnedPanels: true,
    wallpaper: true,
  },
  component({ host }) {
    const shellLayout = host.shellModel.layout;
    const launcher = host.shellModel.launcher;
    const activePanel = launcher.panels.find(panel => panel.isActive) ?? launcher.panels[0] ?? null;
    const visibleUtilityActions = host.shellModel.chrome.utilityActions.filter(action => action.isVisible);
    const compactLauncherWidth = shellLayout.regions.launcher.visible
      ? clamp(Math.round(shellLayout.viewportWidth * 0.17), 188, 212)
      : 0;
    const gridTemplateColumns = [
      shellLayout.regions.pinnedLeft.visible ? `${shellLayout.regions.pinnedLeft.width}px` : null,
      shellLayout.regions.launcher.visible ? `${compactLauncherWidth}px` : `${clamp(launcher.railWidth, 188, 212)}px`,
      'minmax(0, 1fr)',
      shellLayout.regions.pinnedRight.visible ? `${shellLayout.regions.pinnedRight.width}px` : null,
    ]
      .filter(Boolean)
      .join(' ');
    const chromeContentSurface = host.renderChromeContentSurface();
    const windowControlsSurface = host.renderWindowControlsSurface();

    return (
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          background: 'linear-gradient(180deg, #FFF8EE 0%, #FFEEDA 100%)',
        }}
      >
        {host.wallpaper.renderBackdropStack()}

        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(circle at 14% 10%, rgba(255,255,255,0.44), transparent 24%), radial-gradient(circle at 84% 12%, rgba(255,214,226,0.22), transparent 22%), linear-gradient(180deg, rgba(255,255,255,0.24), rgba(255,255,255,0) 28%)',
            pointerEvents: 'none',
          }}
        />

        {windowControlsSurface ? (
          <div
            style={{
              position: 'absolute',
              top: Math.max(10, shellLayout.shellInset - 2),
              right: Math.max(10, shellLayout.shellInset - 2),
              zIndex: 3,
            }}
          >
            {windowControlsSurface}
          </div>
        ) : null}

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'grid',
            gridTemplateColumns,
            width: '100%',
            minHeight: 0,
            gap: shellLayout.panelGap,
            padding: shellLayout.shellInset,
          }}
        >
          {shellLayout.regions.pinnedLeft.visible ? (
            <PinnedShelf
              title="Pinned Left"
              subtitle="Theme-owned pinned surfaces stay in the layout instead of floating off-stage."
            >
              {host.renderPinnedPanels('left')}
            </PinnedShelf>
          ) : null}

          <aside
            style={{
              display: 'grid',
              gridTemplateRows: 'auto auto minmax(0, 1fr)',
              gap: 10,
              minHeight: 0,
              borderRadius: 26,
              border: '1px solid rgba(109, 125, 166, 0.18)',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.82) 0%, rgba(255,244,234,0.96) 100%)',
              boxShadow: '0 20px 42px rgba(95, 104, 154, 0.14)',
              padding: 12,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'grid',
                gap: 8,
                borderRadius: 18,
                border: '1px solid rgba(109, 125, 166, 0.16)',
                background:
                  'linear-gradient(180deg, rgba(255,255,255,0.88) 0%, rgba(255, 241, 198, 0.82) 100%)',
                padding: 12,
                boxShadow: '0 12px 24px rgba(95, 104, 154, 0.1)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 9,
                      letterSpacing: '0.2em',
                      textTransform: 'uppercase',
                      fontWeight: 900,
                      color: '#45506B',
                    }}
                  >
                    Toon Studio
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 18,
                      lineHeight: 0.96,
                      fontWeight: 900,
                      color: '#2D3348',
                    }}
                  >
                    Compact Rail
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => host.openSettings()}
                  style={{
                    minHeight: 32,
                    padding: '0 12px',
                    borderRadius: 999,
                    border: '1px solid rgba(109, 125, 166, 0.16)',
                    background: 'rgba(255,255,255,0.86)',
                    color: '#2D3348',
                    fontSize: 9,
                    fontWeight: 900,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  Tune
                </button>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: 8,
              }}
            >
              {[
                { label: 'Panels', value: launcher.panels.length },
                { label: 'Pinned', value: host.pinnedPanelIds.length },
                { label: 'Actions', value: visibleUtilityActions.length },
              ].map(metric => (
                <div
                  key={metric.label}
                  style={{
                    borderRadius: 14,
                    border: '1px solid rgba(109, 125, 166, 0.14)',
                    background: 'rgba(255,255,255,0.72)',
                    padding: '8px 8px 7px',
                  }}
                >
                  <div style={{ fontSize: 9, color: 'rgba(69, 80, 107, 0.62)' }}>{metric.label}</div>
                  <div style={{ marginTop: 4, fontSize: 15, fontWeight: 900, color: '#2D3348' }}>{metric.value}</div>
                </div>
              ))}
            </div>

            <div
              style={{
                minHeight: 0,
                overflowY: 'auto',
                display: 'grid',
                gap: 12,
                paddingRight: 4,
              }}
            >
              {launcher.groups.map((group, index) => (
                <LauncherSticker key={group.id} group={group} groupIndex={index} />
              ))}
            </div>
          </aside>

          <section
            style={{
              minWidth: 0,
              minHeight: 0,
              display: 'grid',
              gridTemplateRows: 'auto minmax(0, 1fr)',
              gap: 10,
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: visibleUtilityActions.length > 0 ? 'minmax(0, 1fr) auto' : 'minmax(0, 1fr)',
                gap: 10,
                alignItems: 'start',
              }}
            >
              <SurfaceCard>
                {chromeContentSurface}
              </SurfaceCard>

              {visibleUtilityActions.length > 0 ? (
                <SurfaceCard radius={20} padding={8} minWidth={212}>
                  {host.renderUtilityActionsSurface()}
                </SurfaceCard>
              ) : null}
            </div>

            <div
              style={{
                minHeight: 0,
                borderRadius: 28,
                border: '1px solid rgba(109, 125, 166, 0.18)',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.84) 0%, rgba(255,248,240,0.96) 100%)',
                boxShadow: '0 22px 46px rgba(95, 104, 154, 0.14)',
                overflow: 'hidden',
                padding: 10,
                display: 'grid',
                gridTemplateRows: 'auto minmax(0, 1fr)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '2px 4px 10px',
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    fontWeight: 900,
                    color: '#73B9FF',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Live Panel
                </div>
                <div
                  style={{
                    fontSize: 18,
                    lineHeight: 1,
                    fontWeight: 900,
                    color: '#2D3348',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {activePanel ? activePanel.label : host.theme.name}
                </div>
                <div
                  style={{
                    minWidth: 0,
                    flex: 1,
                    fontSize: 11,
                    lineHeight: 1.45,
                    color: 'rgba(69, 80, 107, 0.72)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {activePanel?.description ?? 'Theme-owned chrome, launcher, content frame, wallpaper, and pinned shelves are all active in this shell.'}
                </div>
                <div
                  style={{
                    flexShrink: 0,
                    padding: '7px 10px 6px',
                    borderRadius: 999,
                    border: '1px solid rgba(109, 125, 166, 0.14)',
                    background: 'rgba(255,255,255,0.74)',
                    fontSize: 9,
                    fontWeight: 900,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: '#45506B',
                  }}
                >
                  {host.renderRuntime.kind}
                </div>
              </div>

              <div style={{ minHeight: 0, borderRadius: 20, overflow: 'hidden' }}>
                {host.renderDefaultContentSurface()}
              </div>
            </div>
          </section>

          {shellLayout.regions.pinnedRight.visible ? (
            <PinnedShelf
              title="Pinned Right"
              subtitle="Pinned panels keep their own authored lane so utility surfaces can become part of the scene."
            >
              {host.renderPinnedPanels('right')}
            </PinnedShelf>
          ) : null}
        </div>
      </div>
    );
  },
});
