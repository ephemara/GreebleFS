import { getMonolithTokens } from '../theme-tokens';

export function PanelCardStrip({
  host,
  panels,
  activePanelId,
  mode,
  orientation = 'vertical',
  showDescriptions = false,
}) {
  const tokens = getMonolithTokens(host, mode);
  const isHorizontal = orientation === 'horizontal';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isHorizontal ? 'row' : 'column',
        gap: 10,
        minWidth: 0,
        minHeight: 0,
        overflowX: isHorizontal ? 'auto' : 'hidden',
        overflowY: isHorizontal ? 'hidden' : 'auto',
        paddingRight: isHorizontal ? 0 : 2,
      }}
    >
      {panels.map((panel, index) => {
        const isActive = panel.id === activePanelId;
        const buttonTransform = isHorizontal
          ? `perspective(900px) rotateX(${isActive ? 12 : 16}deg) translateY(${isActive ? -3 : 0}px)`
          : `perspective(1200px) rotateY(${isActive ? -6 : -12}deg) translateX(${isActive ? 6 : 0}px)`;

        return (
          <button
            key={panel.id}
            type="button"
            onClick={() => host.activatePanel(panel.id)}
            style={{
              display: 'flex',
              flexDirection: showDescriptions && !isHorizontal ? 'row' : 'column',
              alignItems: showDescriptions && !isHorizontal ? 'center' : 'flex-start',
              gap: showDescriptions && !isHorizontal ? 12 : 10,
              minWidth: isHorizontal ? 152 : 0,
              padding: isHorizontal ? '12px 14px' : '14px 16px',
              borderRadius: isHorizontal ? 20 : 24,
              border: `1px solid ${isActive ? tokens.borderStrong : tokens.border}`,
              background: isActive
                ? 'linear-gradient(180deg, rgba(100,244,215,0.18), rgba(7,18,24,0.96))'
                : 'linear-gradient(180deg, rgba(10,24,30,0.9), rgba(5,12,17,0.94))',
              boxShadow: isActive ? tokens.deepShadow : '0 18px 34px rgba(0, 0, 0, 0.26)',
              color: tokens.text,
              cursor: 'pointer',
              textAlign: 'left',
              transform: buttonTransform,
              transformOrigin: isHorizontal ? 'center bottom' : 'left center',
              transition: 'transform 160ms ease, border-color 160ms ease, background 160ms ease',
              flexShrink: isHorizontal ? 0 : 1,
            }}
          >
            <span
              style={{
                width: isHorizontal ? 38 : 42,
                height: isHorizontal ? 38 : 42,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: isHorizontal ? 14 : 16,
                background: isActive ? tokens.accentSoft : 'rgba(255,255,255,0.04)',
                color: isActive ? tokens.accentStrong : tokens.text,
                flexShrink: 0,
              }}
            >
              {panel.icon}
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.03em' }}>
                {panel.label}
              </span>
              {showDescriptions ? (
                <span style={{ fontSize: 10, lineHeight: 1.45, color: tokens.textMuted }}>
                  {panel.description}
                </span>
              ) : (
                <span
                  style={{
                    fontSize: 9,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: isActive ? tokens.ember : tokens.textMuted,
                  }}
                >
                  Slot {index + 1}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
