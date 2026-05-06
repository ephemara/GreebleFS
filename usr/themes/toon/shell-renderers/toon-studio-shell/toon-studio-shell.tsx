import { defineThemeRenderer } from 'overlayterm-theme-renderer';

import { pickToonGroupSwatch } from './helpers/stickerPalette';

function createStickerButtonStyle(panel, swatch) {
  return {
    width: '100%',
    border: `1px solid ${panel.isActive ? swatch.border : 'rgba(109, 125, 166, 0.16)'}`,
    borderRadius: 22,
    background: panel.isActive ? swatch.background : 'rgba(255, 255, 255, 0.72)',
    boxShadow: panel.isActive ? swatch.shadow : '0 12px 28px rgba(95, 104, 154, 0.12)',
    padding: '14px 15px 13px',
    textAlign: 'left',
    cursor: 'pointer',
    transform: panel.isActive ? 'translate3d(-4px, -3px, 0)' : panel.isOpen ? 'translate3d(0, -2px, 0)' : 'none',
    transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease, background 180ms ease',
  };
}

function LauncherSticker({ group, groupIndex }) {
  return (
    <section style={{ display: 'grid', gap: 10 }}>
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
            fontSize: 10,
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
            minWidth: 24,
            height: 24,
            borderRadius: 999,
            border: '1px solid rgba(109, 125, 166, 0.14)',
            background: 'rgba(255, 255, 255, 0.74)',
            display: 'grid',
            placeItems: 'center',
            fontSize: 10,
            fontWeight: 900,
            color: '#45506B',
          }}
        >
          {group.panels.length}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
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
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 14,
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
                      fontSize: 13,
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
                      marginTop: 4,
                      fontSize: 11,
                      lineHeight: 1.45,
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
                    minWidth: 10,
                    height: 10,
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
        gap: 12,
        minHeight: 0,
        borderRadius: 30,
        border: '1px solid rgba(109, 125, 166, 0.16)',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.78) 0%, rgba(255,247,238,0.94) 100%)',
        boxShadow: '0 24px 52px rgba(95, 104, 154, 0.14)',
        padding: 16,
      }}
    >
      <div>
        <div
          style={{
            fontSize: 10,
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
            marginTop: 6,
            fontSize: 12,
            lineHeight: 1.5,
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
    const gridTemplateColumns = [
      shellLayout.regions.pinnedLeft.visible ? `${shellLayout.regions.pinnedLeft.width}px` : null,
      shellLayout.regions.launcher.visible ? `${shellLayout.regions.launcher.width}px` : `${launcher.railWidth}px`,
      'minmax(0, 1fr)',
      shellLayout.regions.pinnedRight.visible ? `${shellLayout.regions.pinnedRight.width}px` : null,
    ]
      .filter(Boolean)
      .join(' ');

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
              gridTemplateRows: 'auto minmax(0, 1fr) auto',
              gap: 14,
              minHeight: 0,
              borderRadius: 34,
              border: '1px solid rgba(109, 125, 166, 0.18)',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.82) 0%, rgba(255,244,234,0.96) 100%)',
              boxShadow: '0 28px 60px rgba(95, 104, 154, 0.18)',
              padding: 18,
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'grid', gap: 12 }}>
              <div
                style={{
                  borderRadius: 24,
                  border: '1px solid rgba(109, 125, 166, 0.14)',
                  background:
                    'linear-gradient(180deg, rgba(255,255,255,0.86) 0%, rgba(255, 241, 198, 0.78) 100%)',
                  padding: 16,
                  boxShadow: '0 14px 32px rgba(95, 104, 154, 0.12)',
                }}
              >
                <div
                  style={{
                    fontSize: 10,
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
                    marginTop: 10,
                    fontSize: 26,
                    lineHeight: 0.95,
                    fontWeight: 900,
                    color: '#2D3348',
                  }}
                >
                  Sticker
                  <br />
                  Launcher
                </div>
                <div
                  style={{
                    marginTop: 10,
                    fontSize: 12,
                    lineHeight: 1.6,
                    color: 'rgba(69, 80, 107, 0.72)',
                  }}
                >
                  A custom launcher shell that keeps real panel routing while remapping the app into a pastel broadcast board.
                </div>
              </div>

              <button
                type="button"
                onClick={() => host.openSettings()}
                style={{
                  minHeight: 40,
                  borderRadius: 16,
                  border: '1px solid rgba(109, 125, 166, 0.16)',
                  background: 'rgba(255,255,255,0.78)',
                  color: '#2D3348',
                  fontSize: 11,
                  fontWeight: 900,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                }}
              >
                Tune The Shell
              </button>
            </div>

            <div
              style={{
                minHeight: 0,
                overflowY: 'auto',
                display: 'grid',
                gap: 16,
                paddingRight: 4,
              }}
            >
              {launcher.groups.map((group, index) => (
                <LauncherSticker key={group.id} group={group} groupIndex={index} />
              ))}
            </div>

            <div
              style={{
                display: 'grid',
                gap: 8,
                borderRadius: 22,
                border: '1px dashed rgba(109, 125, 166, 0.18)',
                background: 'rgba(255,255,255,0.56)',
                padding: 14,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  fontWeight: 900,
                  color: '#73B9FF',
                }}
              >
                Live Shell Stats
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                {[
                  { label: 'Panels', value: launcher.panels.length },
                  { label: 'Pinned', value: host.pinnedPanelIds.length },
                  { label: 'Actions', value: visibleUtilityActions.length },
                ].map(metric => (
                  <div
                    key={metric.label}
                    style={{
                      borderRadius: 16,
                      border: '1px solid rgba(109, 125, 166, 0.14)',
                      background: 'rgba(255,255,255,0.72)',
                      padding: '10px 10px 9px',
                    }}
                  >
                    <div style={{ fontSize: 10, color: 'rgba(69, 80, 107, 0.62)' }}>{metric.label}</div>
                    <div style={{ marginTop: 6, fontSize: 18, fontWeight: 900, color: '#2D3348' }}>{metric.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <section
            style={{
              minWidth: 0,
              minHeight: 0,
              display: 'grid',
              gridTemplateRows: 'auto auto minmax(0, 1fr)',
              gap: 14,
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) auto',
                gap: 14,
                alignItems: 'start',
              }}
            >
              <div
                style={{
                  minWidth: 0,
                  borderRadius: 28,
                  border: '1px solid rgba(109, 125, 166, 0.18)',
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.78) 0%, rgba(255,247,239,0.94) 100%)',
                  boxShadow: '0 18px 44px rgba(95, 104, 154, 0.14)',
                  padding: 12,
                }}
              >
                {host.renderDefaultChromeSurface()}
              </div>

              <div
                style={{
                  minWidth: 240,
                  borderRadius: 24,
                  border: '1px solid rgba(109, 125, 166, 0.16)',
                  background: 'rgba(255,255,255,0.82)',
                  boxShadow: '0 16px 34px rgba(95, 104, 154, 0.12)',
                  padding: 10,
                }}
              >
                {host.renderUtilityActionsSurface()}
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) auto',
                gap: 14,
                alignItems: 'stretch',
              }}
            >
              <div
                style={{
                  borderRadius: 30,
                  border: '1px solid rgba(109, 125, 166, 0.16)',
                  background:
                    'linear-gradient(180deg, rgba(197,225,255,0.62) 0%, rgba(255,255,255,0.78) 42%, rgba(255,243,198,0.74) 100%)',
                  boxShadow: '0 24px 52px rgba(95, 104, 154, 0.16)',
                  padding: 18,
                  display: 'grid',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    fontWeight: 900,
                    color: '#45506B',
                  }}
                >
                  Active Broadcast
                </div>
                <div
                  style={{
                    fontSize: 34,
                    lineHeight: 0.95,
                    fontWeight: 900,
                    color: '#2D3348',
                  }}
                >
                  {activePanel ? activePanel.label : host.theme.name}
                </div>
                <div
                  style={{
                    maxWidth: 880,
                    fontSize: 13,
                    lineHeight: 1.7,
                    color: 'rgba(69, 80, 107, 0.76)',
                  }}
                >
                  {activePanel?.description ?? 'Theme-owned chrome, launcher, content frame, wallpaper, and pinned shelves are all active in this shell.'}
                </div>
              </div>

              <div
                style={{
                  minWidth: 188,
                  borderRadius: 24,
                  border: '1px solid rgba(109, 125, 166, 0.16)',
                  background: 'rgba(255,255,255,0.82)',
                  padding: 16,
                  display: 'grid',
                  gap: 8,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    fontWeight: 900,
                    color: '#73B9FF',
                  }}
                >
                  Runtime
                </div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#2D3348' }}>{host.renderRuntime.kind}</div>
                <div style={{ fontSize: 11, lineHeight: 1.55, color: 'rgba(69, 80, 107, 0.72)' }}>
                  {host.layout.windowMode === 'windowed' ? 'Windowed chrome bypass stays compatible.' : 'Overlay mode keeps the full themed chrome stack.'}
                </div>
              </div>
            </div>

            <div
              style={{
                minHeight: 0,
                borderRadius: 34,
                border: '1px solid rgba(109, 125, 166, 0.18)',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.84) 0%, rgba(255,248,240,0.96) 100%)',
                boxShadow: '0 30px 64px rgba(95, 104, 154, 0.18)',
                overflow: 'hidden',
                padding: 14,
              }}
            >
              <div style={{ minHeight: '100%', borderRadius: 24, overflow: 'hidden' }}>
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
