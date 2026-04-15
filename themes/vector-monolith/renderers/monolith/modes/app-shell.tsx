import { PanelCardStrip } from '../components/panel-cards';
import { SurfaceStage } from '../components/surface-stage';
import { ThreeBackdrop } from '../components/three-backdrop';
import { getMonolithTokens } from '../theme-tokens';

function renderSignalCard(label, value, tokens) {
  return (
    <div
      style={{
        padding: '14px 16px',
        borderRadius: 20,
        border: `1px solid ${tokens.border}`,
        background: tokens.cardStrong,
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
        {label}
      </div>
      <div style={{ marginTop: 8, fontSize: 20, fontWeight: 700, color: tokens.text }}>
        {value}
      </div>
    </div>
  );
}

export function renderAppMonolithShell(host) {
  const tokens = getMonolithTokens(host, 'app');
  const panels = host.shellModel.launcher.panels;
  const activePanel = panels.find(panel => panel.id === host.activePanelId) ?? panels[0] ?? null;

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
        color: tokens.text,
        background:
          'linear-gradient(180deg, rgba(2,6,9,0.72), rgba(1,4,6,0.92)), radial-gradient(circle at 50% 16%, rgba(100,244,215,0.08), transparent 22%)',
      }}
    >
      {host.wallpaper.renderBackdropStack()}
      <ThreeBackdrop host={host} mode="app" />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 12% 14%, rgba(255,156,88,0.14), transparent 18%), linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0) 24%)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'grid',
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
            gridTemplateColumns: 'minmax(0, 1fr) auto',
            gap: tokens.gap,
            alignItems: 'start',
          }}
        >
          <div
            style={{
              padding: '18px 20px',
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
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: tokens.ember,
              }}
            >
              Three.js Command Volume
            </div>
            <div style={{ marginTop: 10, fontSize: 34, fontWeight: 700, lineHeight: 1 }}>
              {host.theme.name}
            </div>
            <div style={{ marginTop: 10, maxWidth: 720, fontSize: 13, lineHeight: 1.7, color: tokens.textMuted }}>
              {host.theme.description
                ?? 'A floating monolith shell that keeps host panels intact while pushing the chrome into a volumetric lane.'}
            </div>
          </div>
          <div style={tokens.utilitySurfaceStyle}>{host.renderUtilityActionsSurface()}</div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `${tokens.railWidth} minmax(0, 1fr) ${tokens.sideWidth}`,
            gap: tokens.gap,
            minHeight: 0,
          }}
        >
          <aside
            style={{
              display: 'grid',
              gridTemplateRows: 'auto minmax(0, 1fr)',
              gap: 12,
              minHeight: 0,
              padding: '18px 18px 16px',
              borderRadius: 30,
              border: `1px solid ${tokens.border}`,
              background: tokens.card,
              boxShadow: tokens.shadow,
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: tokens.ember,
                }}
              >
                Navigation Pods
              </div>
              <div style={{ marginTop: 8, fontSize: 24, fontWeight: 700 }}>
                {activePanel?.label ?? 'Panel Grid'}
              </div>
              <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.6, color: tokens.textMuted }}>
                Pull a launcher capsule forward to throw that host surface onto the stage.
              </div>
            </div>
            <PanelCardStrip
              host={host}
              panels={panels}
              activePanelId={activePanel?.id ?? null}
              mode="app"
              orientation="vertical"
              showDescriptions
            />
          </aside>

          <SurfaceStage
            host={host}
            activePanel={activePanel}
            mode="app"
            eyebrow="Active Surface"
            title={activePanel?.label ?? 'Workbench Surface'}
            subtitle={activePanel?.description ?? 'The current panel is projected onto the monolith stage with the native host surface intact.'}
          />

          <aside
            style={{
              display: 'grid',
              gridTemplateRows: 'auto auto minmax(0, 1fr)',
              gap: 12,
              minHeight: 0,
            }}
          >
            <div
              style={{
                padding: '18px 18px 16px',
                borderRadius: 30,
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
                Focus Deck
              </div>
              <div style={{ marginTop: 10, fontSize: 26, fontWeight: 700, lineHeight: 1.05 }}>
                {host.layoutProfile.label}
              </div>
              <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.6, color: tokens.textMuted }}>
                App mode keeps the wide monolith stage, full signal rail, and the larger panel deck tuned for browsing-heavy sessions.
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
              {renderSignalCard('Panels', String(panels.length), tokens)}
              {renderSignalCard('Open', String(host.openPanelIds.length), tokens)}
              {renderSignalCard('Pinned', String(host.pinnedPanelIds.length), tokens)}
            </div>

            <div
              style={{
                minHeight: 0,
                padding: 12,
                borderRadius: 30,
                border: `1px solid ${tokens.border}`,
                background: tokens.cardStrong,
                boxShadow: tokens.shadow,
                overflow: 'hidden',
                backdropFilter: 'blur(18px)',
                WebkitBackdropFilter: 'blur(18px)',
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
          </aside>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) auto',
            gap: tokens.gap,
            alignItems: 'end',
            minHeight: 0,
          }}
        >
          <div
            style={{
              minHeight: 0,
              padding: 12,
              borderRadius: 26,
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
              padding: '12px 16px',
              borderRadius: 999,
              border: `1px solid ${tokens.border}`,
              background: 'rgba(4, 10, 14, 0.78)',
              color: tokens.text,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
            }}
          >
            <span>App Lane</span>
            <span style={{ width: 44, height: 1, background: tokens.borderStrong }} />
            <span>Vector Monolith</span>
          </div>
        </div>
      </div>
    </div>
  );
}
