import { PanelCardStrip } from '../components/panel-cards';
import { SurfaceStage } from '../components/surface-stage';
import { ThreeBackdrop } from '../components/three-backdrop';
import { getMonolithTokens } from '../theme-tokens';

export function renderDockMonolithShell(host) {
  const tokens = getMonolithTokens(host, 'dock');
  const panels = host.shellModel.launcher.panels;
  const activePanel = panels.find(panel => panel.id === host.activePanelId) ?? panels[0] ?? null;

  return (
    <div
      data-vector-monolith-shell="true"
      data-vector-monolith-mode="dock"
      style={{
        position: 'relative',
        display: 'flex',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
        color: tokens.text,
        background:
          'linear-gradient(180deg, rgba(2,5,8,0.7), rgba(1,3,6,0.92)), radial-gradient(circle at 50% 0%, rgba(100,244,215,0.08), transparent 24%)',
      }}
    >
      {host.wallpaper.renderBackdropStack()}
      <ThreeBackdrop host={host} mode="dock" />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0) 22%), radial-gradient(circle at 88% 18%, rgba(255,156,88,0.12), transparent 18%)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'grid',
          transformStyle: 'preserve-3d',
          gridTemplateRows: 'auto minmax(0, 1fr) auto',
          width: '100%',
          minHeight: 0,
          padding: tokens.shellInset,
          gap: tokens.gap,
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto minmax(0, 1fr) auto',
            gap: tokens.gap,
            alignItems: 'center',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 16px',
              borderRadius: 999,
              border: `1px solid ${tokens.border}`,
              background: 'rgba(4, 10, 14, 0.78)',
              color: tokens.text,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}
          >
            <span>{host.layout.overlayAnchor === 'bottom' ? 'Bottom Anchor' : 'Top Anchor'}</span>
            <span style={{ width: 42, height: 1, background: tokens.borderStrong }} />
            <span>Dock Lane</span>
          </div>
          <div
            style={{
              minWidth: 0,
              padding: '10px 12px',
              borderRadius: 24,
              border: `1px solid ${tokens.border}`,
              background: tokens.card,
              boxShadow: tokens.shadow,
              overflow: 'hidden',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
            }}
          >
            <PanelCardStrip
              host={host}
              panels={panels}
              activePanelId={activePanel?.id ?? null}
              mode="dock"
              orientation="horizontal"
            />
          </div>
          <div style={tokens.utilitySurfaceStyle}>{host.renderUtilityActionsSurface()}</div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 272px',
            gap: tokens.gap,
            minHeight: 0,
          }}
        >
          <SurfaceStage
            host={host}
            activePanel={activePanel}
            mode="dock"
            eyebrow="Runway Focus"
            title={activePanel?.label ?? 'Dock Surface'}
            subtitle={activePanel?.description ?? 'Overlay mode compresses the shell into a runway deck while keeping the same host-owned panel surface alive on stage.'}
          />

          <aside
            style={{
              display: 'grid',
              gridTemplateRows: 'auto minmax(0, 1fr) auto',
              gap: 12,
              minHeight: 0,
            }}
          >
            <div
              style={{
                padding: '18px 18px 16px',
                borderRadius: 28,
                border: `1px solid ${tokens.border}`,
                background: tokens.card,
                boxShadow: tokens.shadow,
                backdropFilter: 'blur(18px)',
                WebkitBackdropFilter: 'blur(18px)',
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: tokens.ember,
                }}
              >
                Dock Control
              </div>
              <div style={{ marginTop: 10, fontSize: 24, fontWeight: 700, lineHeight: 1.05 }}>
                {host.layoutProfile.label}
              </div>
              <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.6, color: tokens.textMuted }}>
                The dock package lane tightens the stage, shifts to runway navigation, and keeps the overlay shell leaner than the full app lane.
              </div>
            </div>

            <div
              style={{
                minHeight: 0,
                padding: 12,
                borderRadius: 28,
                border: `1px solid ${tokens.border}`,
                background: tokens.cardStrong,
                boxShadow: tokens.shadow,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  marginBottom: 10,
                  paddingInline: 6,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: tokens.ember,
                }}
              >
                Utility Bay
              </div>
              <div style={{ minHeight: 0, height: '100%', overflow: 'auto' }}>
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
                  borderRadius: 18,
                  border: `1px solid ${tokens.border}`,
                  background: tokens.card,
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: tokens.ember,
                  }}
                >
                  Panels
                </div>
                <div style={{ marginTop: 8, fontSize: 18, fontWeight: 700 }}>
                  {panels.length}
                </div>
              </div>
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 18,
                  border: `1px solid ${tokens.border}`,
                  background: tokens.card,
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: tokens.ember,
                  }}
                >
                  Pinned
                </div>
                <div style={{ marginTop: 8, fontSize: 18, fontWeight: 700 }}>
                  {host.pinnedPanelIds.length}
                </div>
              </div>
            </div>
          </aside>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto minmax(0, 1fr) auto',
            gap: tokens.gap,
            alignItems: 'center',
            minHeight: 0,
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              borderRadius: 999,
              border: `1px solid ${tokens.border}`,
              background: 'rgba(4, 10, 14, 0.72)',
              color: tokens.text,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}
          >
            <span>{host.theme.name}</span>
          </div>
          <div
            style={{
              minHeight: 0,
              padding: 10,
              borderRadius: 22,
              border: `1px solid ${tokens.border}`,
              background: tokens.card,
              boxShadow: tokens.shadow,
              overflow: 'hidden',
            }}
          >
            {host.renderPinnedPanels('left')}
          </div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              borderRadius: 999,
              border: `1px solid ${tokens.border}`,
              background: 'rgba(4, 10, 14, 0.72)',
              color: tokens.text,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}
          >
            <span>Runway Deck</span>
          </div>
        </div>
      </div>
    </div>
  );
}
