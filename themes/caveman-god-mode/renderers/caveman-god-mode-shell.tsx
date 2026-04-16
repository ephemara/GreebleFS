import { defineThemeRenderer } from 'overlayterm-theme-renderer';

import { cavemanPalette } from './lib/palette';
import {
  renderGodModeLauncher,
  renderGodModeTelemetry,
} from './lib/surfaces';

export default defineThemeRenderer({
  name: 'Caveman God Mode Shell',
  apiVersion: 1,
  supportsLiveSwap: true,
  fallbackRuntime: 'desktop-stack',
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
    const activePanel = host.shellModel.launcher.panels.find(panel => panel.isActive)
      ?? host.shellModel.launcher.panels[0]
      ?? null;
    const launcherGroups = host.shellModel.launcher.groups.length > 0
      ? host.shellModel.launcher.groups
      : [{
          id: 'primary',
          label: 'Primary',
          order: 0,
          panels: host.shellModel.launcher.panels,
        }];
    const utilitySurface = host.renderUtilityActionsSurface();

    return (
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {host.wallpaper.renderBackdropStack()}

        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0) 18%), radial-gradient(circle at 20% 20%, rgba(93,228,255,0.12), transparent 22%), radial-gradient(circle at 84% 14%, rgba(255,157,110,0.09), transparent 18%)',
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'grid',
            gridTemplateColumns: '320px minmax(0, 1fr) 300px',
            width: '100%',
            minHeight: 0,
            padding: 18,
            gap: 16,
          }}
        >
          <aside style={{ minHeight: 0, overflow: 'auto', paddingRight: 2 }}>
            <div
              style={{
                display: 'grid',
                gap: 14,
              }}
            >
              <section
                style={{
                  padding: 18,
                  borderRadius: 24,
                  border: `1px solid ${cavemanPalette.shellBorderWarm}`,
                  background: cavemanPalette.shellPanel,
                  boxShadow: cavemanPalette.shellShadow,
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: cavemanPalette.textDim }}>
                  Caveman Pilot
                </div>
                <div style={{ marginTop: 10, fontSize: 26, fontWeight: 700, color: cavemanPalette.textStrong }}>
                  {host.theme.name}
                </div>
                <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.55, color: cavemanPalette.textSoft }}>
                  A renderer-owned command citadel that future LLMs can copy as the baseline for ambitious shell packages.
                </div>
              </section>

              {renderGodModeLauncher(
                launcherGroups,
                activePanel?.id ?? null,
                panelId => host.activatePanel(panelId),
              )}
            </div>
          </aside>

          <section
            style={{
              display: 'grid',
              gridTemplateRows: 'auto minmax(0, 1fr)',
              minWidth: 0,
              minHeight: 0,
              gap: 14,
            }}
          >
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
                  padding: '16px 18px',
                  borderRadius: 24,
                  border: `1px solid ${cavemanPalette.shellBorder}`,
                  background: cavemanPalette.shellGlass,
                  boxShadow: cavemanPalette.shellShadow,
                  backdropFilter: 'blur(22px)',
                  WebkitBackdropFilter: 'blur(22px)',
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: cavemanPalette.textDim }}>
                  Focus Stage
                </div>
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: cavemanPalette.textStrong }}>
                    {activePanel?.label ?? 'No Active Surface'}
                  </div>
                  <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: cavemanPalette.accent }}>
                    {host.layoutProfile.label}
                  </div>
                </div>
                <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.55, color: cavemanPalette.textSoft }}>
                  {activePanel?.description ?? 'Activate a launcher surface to populate the command stage.'}
                </div>
              </div>

              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '0 16px',
                  borderRadius: 22,
                  border: `1px solid ${cavemanPalette.shellBorderWarm}`,
                  background: cavemanPalette.shellGlass,
                  boxShadow: cavemanPalette.shellShadow,
                  color: cavemanPalette.signalWarm,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  backdropFilter: 'blur(22px)',
                  WebkitBackdropFilter: 'blur(22px)',
                }}
              >
                Renderer-Owned Shell
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr)',
                minHeight: 0,
                gap: 14,
              }}
            >
              <div
                style={{
                  position: 'relative',
                  minHeight: 0,
                  borderRadius: 30,
                  border: `1px solid ${cavemanPalette.shellBorder}`,
                  background: cavemanPalette.shellPanel,
                  boxShadow: cavemanPalette.stageShadow,
                  overflow: 'hidden',
                }}
              >
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0) 14%), radial-gradient(circle at 50% -10%, rgba(93,228,255,0.12), transparent 30%)',
                    pointerEvents: 'none',
                  }}
                />
                <div style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%' }}>
                  {activePanel
                    ? host.renderPanelSurface(activePanel.id, { forceMount: true, forceVisible: true })
                    : host.renderDefaultContentSurface()}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 14 }}>
                {host.renderPinnedPanels('left')}
                {host.renderPinnedPanels('right')}
              </div>
            </div>
          </section>

          <aside style={{ minHeight: 0, overflow: 'auto', paddingRight: 2 }}>
            {renderGodModeTelemetry(activePanel, host.layoutProfile, utilitySurface)}
          </aside>
        </div>
      </div>
    );
  },
});
