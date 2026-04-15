import { getMonolithTokens } from '../theme-tokens';

export function SurfaceStage({
  host,
  activePanel,
  mode,
  eyebrow,
  title,
  subtitle,
}) {
  const tokens = getMonolithTokens(host, mode);
  const isDock = mode === 'dock';
  const stageTransform = isDock
    ? 'perspective(1800px) rotateX(14deg) translateY(6px)'
    : 'perspective(2200px) rotateX(10deg) rotateY(-4deg)';
  const renderedSurface = activePanel
    ? host.renderPanelSurface(activePanel.id, { forceMount: true, forceVisible: true })
    : host.renderDefaultContentSurface();

  return (
    <section
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        padding: isDock ? 16 : 20,
        borderRadius: isDock ? 28 : 34,
        border: `1px solid ${tokens.border}`,
        background: tokens.card,
        boxShadow: tokens.deepShadow,
        overflow: 'hidden',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0) 24%), radial-gradient(circle at 80% 12%, rgba(255,156,88,0.12), transparent 20%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          gap: 14,
          alignItems: 'start',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: tokens.ember,
            }}
          >
            {eyebrow}
          </div>
          <div style={{ marginTop: 8, fontSize: isDock ? 24 : 30, fontWeight: 700, lineHeight: 1.05 }}>
            {title}
          </div>
          <div style={{ marginTop: 6, maxWidth: 520, fontSize: 12, lineHeight: 1.6, color: tokens.textMuted }}>
            {subtitle}
          </div>
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
          }}
        >
          <span>{isDock ? 'Runway Stage' : 'Volume Stage'}</span>
          <span style={{ width: 42, height: 1, background: tokens.borderStrong }} />
          <span>{activePanel?.label ?? 'Panel Surface'}</span>
        </div>
      </div>
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          flex: 1,
          minHeight: 0,
          display: 'grid',
          placeItems: 'center',
          marginTop: 18,
          overflow: 'hidden',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: '14% 8% 8%',
            borderRadius: isDock ? 26 : 34,
            background:
              'radial-gradient(circle at 50% 0%, rgba(100,244,215,0.18), transparent 28%), linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0))',
            filter: 'blur(14px)',
            opacity: 0.9,
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'relative',
            width: tokens.stageWidth,
            maxWidth: '100%',
            height: tokens.stageHeight,
            maxHeight: '100%',
            minHeight: isDock ? 280 : 360,
            transform: stageTransform,
            transformStyle: 'preserve-3d',
          }}
        >
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: '8% 7% -4%',
              borderRadius: isDock ? 28 : 36,
              background: 'rgba(0, 0, 0, 0.42)',
              transform: 'translateZ(-80px)',
              filter: 'blur(28px)',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              borderRadius: isDock ? 28 : 36,
              border: `1px solid ${tokens.borderStrong}`,
              background: tokens.stage,
              boxShadow: '0 30px 84px rgba(0, 0, 0, 0.38)',
              overflow: 'hidden',
            }}
          >
            <div
              aria-hidden
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0) 18%), radial-gradient(circle at 50% 0%, rgba(100,244,215,0.14), transparent 30%), repeating-linear-gradient(90deg, rgba(100,244,215,0.04) 0 1px, transparent 1px 120px)',
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                position: 'relative',
                zIndex: 1,
                width: '100%',
                height: '100%',
                minHeight: 0,
                overflow: 'hidden',
                borderRadius: isDock ? 28 : 36,
              }}
            >
              {renderedSurface}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
